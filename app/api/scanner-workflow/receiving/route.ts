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

export async function GET(request: Request) {
  try {
    const supabase = adminClient();
    await requireStaff(request, supabase);
    const search = new URL(request.url).searchParams.get("search")?.trim() || "";
    let query = supabase.from("paquetes_registro").select("id, tracking, nombre_paqueteria, tipo_paquete, contenido, notas, notas_imagenes, registro, estado, hora_fecha, creado_en, numero_cliente_id, billing_subtotal, billing_tax, billing_total, invoice_status, approval_status, numero_cliente:numero_cliente_id (id, numero_cliente, nombre)").eq("estado", "Recibido").order("creado_en", { ascending: false }).limit(1000);
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
    return NextResponse.json({ packages: (data || []).map((row) => ({ ...row, checkin: checkinByPackage.get(String(row.id)) || null })) });
  } catch (error) { return errorResponse(error); }
}

export async function POST(request: Request) {
  try {
    const supabase = adminClient();
    const actor = await requireStaff(request, supabase);
    const body = await request.json();
    const tracking = String(body?.tracking || "").trim().toUpperCase();
    const type = body?.type === "BOX" ? "BOX" : body?.type === "PACKAGE" ? "PACKAGE" : "";
    if (!tracking) return NextResponse.json({ error: "Tracking number or barcode is required" }, { status: 400 });
    if (!type) return NextResponse.json({ error: "Select Box or Package" }, { status: 400 });
    const { data: existing } = await supabase.from("paquetes_registro").select("id").eq("tracking", tracking).maybeSingle();
    if (existing) return NextResponse.json({ error: "A shipment with this tracking number is already registered" }, { status: 409 });
    const customerId = String(body?.customer_id || "").trim() || null;
    const note = [body?.owner_unknown ? "UNKNOWN OWNER - pending customer identification" : "", String(body?.note || "").trim()].filter(Boolean).join("\n") || null;
    const { data, error } = await supabase.from("paquetes_registro").insert({ tracking, nombre_paqueteria: String(body?.carrier || "").trim() || "", tipo_paquete: type, contenido: String(body?.contents || "").trim() || null, notas: note, numero_cliente_id: customerId, registro: actor.name, estado: "Recibido" }).select("id, tracking, nombre_paqueteria, tipo_paquete, contenido, notas, registro, estado, hora_fecha").single();
    if (error) throw error;
    await supabase.from("staff_action_logs").insert({ actor_id: actor.user.id, actor_name: actor.name, actor_email: actor.user.email || null, actor_role: actor.role, action: "receiving_package_created", entity_type: "paquetes_registro", entity_id: data.id, tracking, success: true, details: { type, owner_unknown: Boolean(body?.owner_unknown), customer_id: customerId, source: "scanner_workflow_app" } });
    return NextResponse.json({ package: data });
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
    const update = { tracking: String(body?.tracking || "").trim().toUpperCase(), nombre_paqueteria: String(body?.carrier || "").trim(), tipo_paquete: body?.type === "BOX" ? "BOX" : "PACKAGE", contenido: String(body?.contents || "").trim() || null, notas: String(body?.note || "").trim() || null, numero_cliente_id: customerId };
    if (!update.tracking) return NextResponse.json({ error: "Tracking number is required" }, { status: 400 });
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
