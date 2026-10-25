import { NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase server environment variables are missing");
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

async function requireStaff(request: Request, supabase: SupabaseClient) {
  const authorization = request.headers.get("authorization") || "";
  if (!authorization.startsWith("Bearer ")) throw new Error("Authentication is required");
  const { data, error } = await supabase.auth.getUser(authorization.slice(7));
  if (error || !data.user) throw new Error("Invalid authentication token");
  const [{ data: admin }, { data: staff }] = await Promise.all([
    supabase.from("administradores").select("id, rol").eq("id", data.user.id).maybeSingle(),
    supabase.from("personal").select("id, rol, nombre, nombre_personal").eq("id", data.user.id).maybeSingle(),
  ]);
  if (!admin && !staff) throw new Error("Staff access is required");
  return {
    user: data.user,
    role: admin ? "admin" : "staff",
    name: admin
      ? "Admin"
      : staff?.nombre || staff?.nombre_personal ||
        (data.user.user_metadata?.full_name as string | undefined) ||
        data.user.email ||
        "Staff",
  };
}

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "Unexpected error";
  const status = /authentication|token|access|required/i.test(message) ? 401 : 500;
  return NextResponse.json({ error: message }, { status });
}

function isPhotoFile(value: FormDataEntryValue): value is File {
  return (
    typeof value !== "string" &&
    typeof (value as File).arrayBuffer === "function" &&
    typeof (value as File).size === "number" &&
    Number((value as File).size) > 0
  );
}

export async function POST(request: Request) {
  try {
    const supabase = adminClient();
    const actor = await requireStaff(request, supabase);
    const isMultipart = request.headers.get("content-type")?.toLowerCase().includes("multipart/form-data") || false;
    if (!isMultipart) return NextResponse.json({ error: "Problem photos must be uploaded as multipart form data" }, { status: 400 });
    const form = await request.formData();
    const shipmentId = String(form.get("shipment_id") || "").trim();
    const note = String(form.get("note") || "").trim();
    const problem = String(form.get("problem") || "false").toLowerCase() === "true";
    const suppliedPhotos = form.getAll("photo");
    const photos = suppliedPhotos.filter(isPhotoFile);
    if (!shipmentId) return NextResponse.json({ error: "Shipment is required" }, { status: 400 });
    if (note.length > 4000) return NextResponse.json({ error: "The note is too long" }, { status: 400 });
    if (suppliedPhotos.some((value) => typeof value === "string")) return NextResponse.json({ error: "Invalid photo upload" }, { status: 400 });
    if (suppliedPhotos.length > 0 && photos.length === 0) return NextResponse.json({ error: "The selected photo was empty or could not be read. Choose the photo again and retry." }, { status: 400 });
    if (photos.some((photo) => photo.size > 8 * 1024 * 1024)) return NextResponse.json({ error: "Photo must be 8 MB or smaller" }, { status: 400 });
    if (!note && !problem && photos.length === 0) return NextResponse.json({ error: "Add a note, mark a problem, or attach a photo" }, { status: 400 });

    const { data: shipment, error: lookupError } = await supabase
      .from("paquetes_registro")
      .select("id, tracking, notas, notas_imagenes, numero_cliente_id")
      .eq("id", shipmentId)
      .maybeSingle();
    if (lookupError) throw lookupError;
    if (!shipment) return NextResponse.json({ error: "Shipment not found" }, { status: 404 });

    const { data: existingCheckin, error: checkinLookupError } = await supabase
      .from("paquetes_checkin")
      .select("id, problema, problema_notas")
      .eq("paquete_id", shipment.id)
      .order("creado_en", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (checkinLookupError) throw checkinLookupError;

    let imageUrls = Array.isArray(shipment.notas_imagenes) ? shipment.notas_imagenes.filter((value: unknown): value is string => typeof value === "string") : [];
    for (const photo of photos) {
      const extension = (photo.name.split(".").pop() || "jpg").replace(/[^a-z0-9]/gi, "").toLowerCase() || "jpg";
      const path = `scanner/${shipment.id}/${Date.now()}-${crypto.randomUUID()}.${extension}`;
      const upload = await supabase.storage.from("notas-imagenes").upload(path, photo, { contentType: photo.type || "image/jpeg", upsert: false });
      if (upload.error) throw upload.error;
      const { data: publicUrl } = supabase.storage.from("notas-imagenes").getPublicUrl(path);
      if (publicUrl.publicUrl) imageUrls = [...imageUrls, publicUrl.publicUrl];
    }

    const nextProblem = problem || Boolean(existingCheckin?.problema);
    const nextProblemNote = problem && note ? note : existingCheckin?.problema_notas || null;
    const { data: savedShipment, error: updateError } = await supabase
      .from("paquetes_registro")
      .update({ notas: note || shipment.notas || null, notas_imagenes: imageUrls })
      .eq("id", shipment.id)
      .select("id, tracking, notas, notas_imagenes")
      .single();
    if (updateError) throw updateError;
    const checkinPayload = {
      paquete_id: shipment.id,
      numero_cliente_id: shipment.numero_cliente_id || null,
      problema: nextProblem,
      problema_notas: nextProblemNote,
    };
    const checkinWrite = existingCheckin?.id
      ? await supabase.from("paquetes_checkin").update({ problema: nextProblem, problema_notas: nextProblemNote }).eq("id", existingCheckin.id)
      : await supabase.from("paquetes_checkin").insert(checkinPayload);
    if (checkinWrite.error) throw checkinWrite.error;
    await supabase.from("staff_action_logs").insert({
      actor_id: actor.user.id,
      actor_name: actor.name,
      actor_email: actor.user.email || null,
      actor_role: actor.role,
      action: photos.length ? "package_issue_photo_uploaded" : problem ? "package_problem_noted" : "package_internal_note_added",
      entity_type: "paquetes_registro",
      entity_id: shipment.id,
      tracking: shipment.tracking,
      success: true,
      details: { has_note: Boolean(note), problem, photo_uploaded: photos.length > 0, photo_count: photos.length, source: "scanner_workflow_app" },
      user_agent: request.headers.get("user-agent") || null,
    });
    return NextResponse.json({ ok: true, tracking: savedShipment.tracking, note: savedShipment.notas, problem: nextProblem, problem_note: nextProblemNote, image_urls: savedShipment.notas_imagenes || imageUrls, photo_uploaded: photos.length > 0 });
  } catch (error) {
    return errorResponse(error);
  }
}
