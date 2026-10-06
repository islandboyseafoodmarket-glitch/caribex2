import { NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { CHECK_IN_STAGE_QUERY, RECEIVING_STAGE_QUERY } from "@/lib/shipping-rules";

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
    supabase.from("administradores").select("id").eq("id", data.user.id).maybeSingle(),
    supabase.from("personal").select("id, nombre, nombre_personal").eq("id", data.user.id).maybeSingle(),
  ]);
  if (!admin && !staff) throw new Error("Staff access is required");
  return { user: data.user, name: staff?.nombre || staff?.nombre_personal || data.user.email || "Staff", role: admin ? "admin" : "staff" };
}

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "Unexpected error";
  return NextResponse.json({ error: message }, { status: /authentication|token|access|required/i.test(message) ? 401 : 500 });
}

function normalizeUspsTracking(tracking: string, carrier: string) {
  const value = tracking.trim().toUpperCase();
  const carrierValue = carrier.trim().toUpperCase();
  // The installed Caribex APK sends the full USPS barcode payload. For the
  // numeric USPS labels used by Caribex, the first three digits are the
  // service prefix and are not part of the customer-facing tracking number.
  if (carrierValue === "USPS" && /^\d{20}$|^\d{22}$/.test(value)) {
    return value.slice(3);
  }
  return value;
}

async function findTrackingMatches(supabase: SupabaseClient, tracking: string, excludeId?: string) {
  let query = supabase
    .from("paquetes_registro")
    .select("id, tracking, estado")
    .ilike("tracking", tracking)
    .limit(10);
  if (excludeId) query = query.neq("id", excludeId);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function GET(request: Request) {
  try {
    const supabase = adminClient();
    await requireStaff(request, supabase);
    const params = new URL(request.url).searchParams;
    const search = params.get("search")?.trim() || "";
    const stage = params.get("stage") === "check_in" ? "check_in" : "received";
    const statuses = stage === "check_in" ? CHECK_IN_STAGE_QUERY : RECEIVING_STAGE_QUERY;
    let query = supabase.from("paquetes_registro").select("id, tracking, nombre_paqueteria, tipo_paquete, contenido, notas, notas_imagenes, registro, estado, hora_fecha, creado_en, numero_cliente_id, billing_subtotal, billing_tax, billing_total, invoice_status, approval_status, numero_cliente:numero_cliente_id (id, numero_cliente, nombre)").in("estado", statuses).order("creado_en", { ascending: false }).limit(1000);
    if (search) query = query.or(`tracking.ilike.%${search}%,nombre_paqueteria.ilike.%${search}%,contenido.ilike.%${search}%`);
    const { data, error } = await query;
    if (error) throw error;
    const ids = (data || []).map((row) => row.id);
    const { data: checkins, error: checkinError } = ids.length
      ? await supabase.from("paquetes_checkin").select("paquete_id, alto, ancho, largo, peso, cargos_adicionales, creado_en").in("paquete_id", ids).order("creado_en", { ascending: false })
      : { data: [], error: null };
    if (checkinError) throw checkinError;
    const checkinByPackage = new Map<string, any>();
    for (const row of checkins || []) checkinByPackage.set(String(row.paquete_id), row);
    return NextResponse.json({ stage, status_values: statuses, packages: (data || []).map((row) => ({ ...row, checkin: checkinByPackage.get(String(row.id)) || null })) });
  } catch (error) { return errorResponse(error); }
}

export async function POST(request: Request) {
  try {
    const supabase = adminClient();
    const actor = await requireStaff(request, supabase);
    const isMultipart = request.headers.get("content-type")?.toLowerCase().includes("multipart/form-data") || false;
    const body = isMultipart ? await request.formData() : await request.json();
    const value = (key: string) => isMultipart ? String(body.get(key) || "") : String(body?.[key] || "");
    const ownerUnknown = value("owner_unknown").toLowerCase() === "true";
    const noteText = value("note").trim();
    const photo = isMultipart ? body.get("photo") : null;
    const carrier = value("carrier").trim();
    const tracking = normalizeUspsTracking(value("tracking"), carrier);
    const type = value("type") === "BOX" ? "BOX" : value("type") === "PACKAGE" ? "PACKAGE" : "";
    if (!tracking) return NextResponse.json({ error: "Tracking number or barcode is required" }, { status: 400 });
    if (!type) return NextResponse.json({ error: "Select Box or Package" }, { status: 400 });
    if (ownerUnknown && !noteText && !(photo instanceof File && photo.size > 0)) return NextResponse.json({ error: "Unknown Owner requires an internal note or a photo" }, { status: 400 });
    if (photo && !(photo instanceof File)) return NextResponse.json({ error: "Invalid photo upload" }, { status: 400 });
    if (photo instanceof File && photo.size > 8 * 1024 * 1024) return NextResponse.json({ error: "Photo must be 8 MB or smaller" }, { status: 400 });
    const existingMatches = await findTrackingMatches(supabase, tracking);
    if (existingMatches.length) {
      const existing = existingMatches[0];
      return NextResponse.json({
        error: "This tracking number is already registered and cannot be received a second time.",
        code: "DUPLICATE_TRACKING",
        tracking: existing.tracking,
        current_status: existing.estado,
        matches: existingMatches.map((match) => ({ id: match.id, tracking: match.tracking, current_status: match.estado })),
      }, { status: 409 });
    }
    const customerId = value("customer_id").trim() || null;
    const note = [ownerUnknown ? "UNKNOWN OWNER - pending customer identification" : "", noteText].filter(Boolean).join("\n") || null;
    const { data, error } = await supabase.from("paquetes_registro").insert({ tracking, nombre_paqueteria: carrier, tipo_paquete: type, contenido: value("contents").trim() || null, notas: note, numero_cliente_id: customerId, registro: actor.name, estado: "Recibido" }).select("id, tracking, nombre_paqueteria, tipo_paquete, contenido, notas, notas_imagenes, registro, estado, hora_fecha").single();
    if (error) throw error;
    let savedPackage = data;
    if (photo instanceof File && photo.size > 0) {
      const extension = (photo.name.split(".").pop() || "jpg").replace(/[^a-z0-9]/gi, "").toLowerCase() || "jpg";
      const path = `scanner/${data.id}/${Date.now()}-${crypto.randomUUID()}.${extension}`;
      const upload = await supabase.storage.from("notas-imagenes").upload(path, photo, { contentType: photo.type || "image/jpeg", upsert: false });
      if (upload.error) throw upload.error;
      const { data: publicUrl } = supabase.storage.from("notas-imagenes").getPublicUrl(path);
      const { data: updated, error: imageError } = await supabase.from("paquetes_registro").update({ notas_imagenes: [publicUrl.publicUrl] }).eq("id", data.id).select("id, tracking, nombre_paqueteria, tipo_paquete, contenido, notas, notas_imagenes, registro, estado, hora_fecha").single();
      if (imageError) throw imageError;
      savedPackage = updated;
    }
    await supabase.from("staff_action_logs").insert({ actor_id: actor.user.id, actor_name: actor.name, actor_email: actor.user.email || null, actor_role: actor.role, action: "receiving_package_created", entity_type: "paquetes_registro", entity_id: data.id, tracking, success: true, details: { type, owner_unknown: ownerUnknown, customer_id: customerId, photo_uploaded: photo instanceof File, source: "scanner_workflow_app" } });
    return NextResponse.json({ package: savedPackage });
  } catch (error) { return errorResponse(error); }
}

export async function PATCH(request: Request) {
  try {
    const supabase = adminClient();
    const actor = await requireStaff(request, supabase);
    const body = await request.json();
    const id = String(body?.id || "").trim();
    if (!id) return NextResponse.json({ error: "Package id is required" }, { status: 400 });
    const customerId = String(body?.customer_id || "").trim() || null;
    const carrier = String(body?.carrier || "").trim();
    const update = { tracking: normalizeUspsTracking(String(body?.tracking || ""), carrier), nombre_paqueteria: carrier, tipo_paquete: body?.type === "BOX" ? "BOX" : "PACKAGE", contenido: String(body?.contents || "").trim() || null, notas: String(body?.note || "").trim() || null, numero_cliente_id: customerId };
    if (!update.tracking) return NextResponse.json({ error: "Tracking number is required" }, { status: 400 });
    const existingMatches = await findTrackingMatches(supabase, update.tracking, id);
    if (existingMatches.length) {
      return NextResponse.json({
        error: "That tracking number belongs to another shipment and cannot be reused.",
        code: "DUPLICATE_TRACKING",
        tracking: update.tracking,
        matches: existingMatches.map((match) => ({ id: match.id, tracking: match.tracking, current_status: match.estado })),
      }, { status: 409 });
    }
    const { data, error } = await supabase.from("paquetes_registro").update(update).eq("id", id).select("id, tracking, nombre_paqueteria, tipo_paquete, contenido, notas, registro, estado, hora_fecha").single();
    if (error) throw error;
    const hasCheckinFields = [body?.alto, body?.ancho, body?.largo, body?.peso, body?.cargos_adicionales].some((value) => value !== undefined);
    if (hasCheckinFields) {
      const checkinPayload = {
        paquete_id: id,
        alto: body?.alto === "" || body?.alto == null ? null : Number(body.alto),
        ancho: body?.ancho === "" || body?.ancho == null ? null : Number(body.ancho),
        largo: body?.largo === "" || body?.largo == null ? null : Number(body.largo),
        peso: body?.peso === "" || body?.peso == null ? null : Number(body.peso),
        cargos_adicionales: String(body?.cargos_adicionales || "").trim() || null,
      };
      const { data: existingCheckin } = await supabase.from("paquetes_checkin").select("id").eq("paquete_id", id).order("creado_en", { ascending: false }).limit(1).maybeSingle();
      const checkinResult = existingCheckin?.id
        ? await supabase.from("paquetes_checkin").update(checkinPayload).eq("id", existingCheckin.id)
        : await supabase.from("paquetes_checkin").insert(checkinPayload);
      if (checkinResult.error) throw checkinResult.error;
    }
    await supabase.from("staff_action_logs").insert({ actor_id: actor.user.id, actor_name: actor.name, actor_email: actor.user.email || null, actor_role: actor.role, action: "receiving_package_updated", entity_type: "paquetes_registro", entity_id: id, tracking: data.tracking, success: true, details: { customer_id: customerId, source: "scanner_workflow_app" } });
    return NextResponse.json({ package: data });
  } catch (error) { return errorResponse(error); }
}

export async function DELETE(request: Request) {
  try {
    const supabase = adminClient();
    const actor = await requireStaff(request, supabase);
    const id = new URL(request.url).searchParams.get("id")?.trim();
    if (!id) return NextResponse.json({ error: "Package id is required" }, { status: 400 });
    const { data: existing } = await supabase.from("paquetes_registro").select("tracking").eq("id", id).maybeSingle();
    const { error } = await supabase.from("paquetes_registro").delete().eq("id", id);
    if (error) throw error;
    await supabase.from("staff_action_logs").insert({ actor_id: actor.user.id, actor_name: actor.name, actor_email: actor.user.email || null, actor_role: actor.role, action: "receiving_package_deleted", entity_type: "paquetes_registro", entity_id: id, tracking: existing?.tracking || null, success: true, details: { source: "scanner_workflow_app" } });
    return NextResponse.json({ ok: true });
  } catch (error) { return errorResponse(error); }
}
