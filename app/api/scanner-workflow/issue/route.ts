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
    name: staff?.nombre || staff?.nombre_personal || data.user.email || "Staff",
  };
}

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "Unexpected error";
  const status = /authentication|token|access|required/i.test(message) ? 401 : 500;
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: Request) {
  try {
    const supabase = adminClient();
    const actor = await requireStaff(request, supabase);
    const form = await request.formData();
    const shipmentId = String(form.get("shipment_id") || "").trim();
    const note = String(form.get("note") || "").trim();
    const problem = String(form.get("problem") || "false").toLowerCase() === "true";
    const photo = form.get("photo");
    if (!shipmentId) return NextResponse.json({ error: "Shipment is required" }, { status: 400 });
    if (note.length > 4000) return NextResponse.json({ error: "The note is too long" }, { status: 400 });
    if (photo && !(photo instanceof File)) return NextResponse.json({ error: "Invalid photo upload" }, { status: 400 });
    if (photo instanceof File && photo.size > 8 * 1024 * 1024) return NextResponse.json({ error: "Photo must be 8 MB or smaller" }, { status: 400 });

    const { data: shipment, error: lookupError } = await supabase
      .from("paquetes_registro")
      .select("id, tracking, notas, problema, problema_notas, notas_imagenes")
      .eq("id", shipmentId)
      .maybeSingle();
    if (lookupError) throw lookupError;
    if (!shipment) return NextResponse.json({ error: "Shipment not found" }, { status: 404 });

    let imageUrls = Array.isArray(shipment.notas_imagenes) ? shipment.notas_imagenes.filter((value: unknown): value is string => typeof value === "string") : [];
    if (photo instanceof File && photo.size > 0) {
      const extension = (photo.name.split(".").pop() || "jpg").replace(/[^a-z0-9]/gi, "").toLowerCase() || "jpg";
      const path = `scanner/${shipment.id}/${Date.now()}-${crypto.randomUUID()}.${extension}`;
      const upload = await supabase.storage.from("notas-imagenes").upload(path, photo, { contentType: photo.type || "image/jpeg", upsert: false });
      if (upload.error) throw upload.error;
      const { data: publicUrl } = supabase.storage.from("notas-imagenes").getPublicUrl(path);
      imageUrls = [...imageUrls, publicUrl.publicUrl];
    }

    const update: Record<string, unknown> = {
      notas: note || shipment.notas || null,
      problema: problem || Boolean(shipment.problema),
      problema_notas: problem && note ? note : shipment.problema_notas || null,
      notas_imagenes: imageUrls,
    };
    const { error: updateError } = await supabase.from("paquetes_registro").update(update).eq("id", shipment.id);
    if (updateError) throw updateError;
    await supabase.from("staff_action_logs").insert({
      actor_id: actor.user.id,
      actor_name: actor.name,
      actor_email: actor.user.email || null,
      actor_role: actor.role,
      action: photo instanceof File ? "package_issue_photo_uploaded" : problem ? "package_problem_noted" : "package_internal_note_added",
      entity_type: "paquetes_registro",
      entity_id: shipment.id,
      tracking: shipment.tracking,
      success: true,
      details: { has_note: Boolean(note), problem, photo_uploaded: photo instanceof File, source: "scanner_workflow_app" },
      user_agent: request.headers.get("user-agent") || null,
    });
    return NextResponse.json({ ok: true, tracking: shipment.tracking, image_urls: imageUrls, photo_uploaded: photo instanceof File });
  } catch (error) {
    return errorResponse(error);
  }
}
