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
    let query = supabase.from("paquetes_registro").select("id, tracking, nombre_paqueteria, tipo_paquete, contenido, notas, notas_imagenes, registro, estado, hora_fecha, creado_en").ilike("estado", "%recibido%").order("creado_en", { ascending: false }).limit(100);
    if (search) query = query.or(`tracking.ilike.%${search}%,nombre_paqueteria.ilike.%${search}%,contenido.ilike.%${search}%`);
    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json({ packages: data || [] });
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
    const note = [body?.owner_unknown ? "UNKNOWN OWNER - pending customer identification" : "", String(body?.note || "").trim()].filter(Boolean).join("\n") || null;
    const { data, error } = await supabase.from("paquetes_registro").insert({ tracking, nombre_paqueteria: String(body?.carrier || "").trim() || "", tipo_paquete: type, contenido: String(body?.contents || "").trim() || null, notas: note, registro: actor.name, estado: "Recibido" }).select("id, tracking, nombre_paqueteria, tipo_paquete, contenido, notas, registro, estado, hora_fecha").single();
    if (error) throw error;
    await supabase.from("staff_action_logs").insert({ actor_id: actor.user.id, actor_name: actor.name, actor_email: actor.user.email || null, actor_role: actor.role, action: "receiving_package_created", entity_type: "paquetes_registro", entity_id: data.id, tracking, success: true, details: { type, owner_unknown: Boolean(body?.owner_unknown), source: "scanner_workflow_app" } });
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
    const update = { tracking: String(body?.tracking || "").trim().toUpperCase(), nombre_paqueteria: String(body?.carrier || "").trim(), tipo_paquete: body?.type === "BOX" ? "BOX" : "PACKAGE", contenido: String(body?.contents || "").trim() || null, notas: String(body?.note || "").trim() || null };
    if (!update.tracking) return NextResponse.json({ error: "Tracking number is required" }, { status: 400 });
    const { data, error } = await supabase.from("paquetes_registro").update(update).eq("id", id).select("id, tracking, nombre_paqueteria, tipo_paquete, contenido, notas, registro, estado, hora_fecha").single();
    if (error) throw error;
    await supabase.from("staff_action_logs").insert({ actor_id: actor.user.id, actor_name: actor.name, actor_email: actor.user.email || null, actor_role: actor.role, action: "receiving_package_updated", entity_type: "paquetes_registro", entity_id: id, tracking: data.tracking, success: true, details: { source: "scanner_workflow_app" } });
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
