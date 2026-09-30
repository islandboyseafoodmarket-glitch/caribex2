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
  return { user: data.user, role: admin ? "admin" : "staff" };
}

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "Unexpected error";
  return NextResponse.json({ error: message }, { status: /authentication|token|access|required/i.test(message) ? 401 : 500 });
}

export async function POST(request: Request) {
  try {
    const supabase = adminClient();
    const actor = await requireStaff(request, supabase);
    const body = await request.json();
    const boxId = String(body?.box_id || "").trim();
    const childIds = Array.from(new Set((Array.isArray(body?.child_ids) ? body.child_ids : []).map((id: unknown) => String(id).trim()).filter(Boolean)));
    const customerId = String(body?.customer_id || "").trim() || null;
    if (!boxId || !childIds.length) return NextResponse.json({ error: "Select one BOX and at least one PACKAGE" }, { status: 400 });
    if (childIds.includes(boxId)) return NextResponse.json({ error: "The BOX cannot be one of its own children" }, { status: 400 });

    const { data: rows, error: rowsError } = await supabase.from("paquetes_registro").select("id, tracking, tipo_paquete, estado, numero_cliente_id").in("id", [boxId, ...childIds]);
    if (rowsError) throw rowsError;
    const box = (rows || []).find((row) => row.id === boxId);
    const children = (rows || []).filter((row) => childIds.includes(row.id));
    if (!box || box.tipo_paquete !== "BOX") return NextResponse.json({ error: "Select a valid BOX shipment" }, { status: 400 });
    if (children.length !== childIds.length || children.some((row) => row.tipo_paquete !== "PACKAGE")) return NextResponse.json({ error: "Every selected child must be a PACKAGE shipment" }, { status: 400 });

    const inheritedCustomerId = customerId || box.numero_cliente_id || null;
    const { error: boxCheckinError } = await supabase.from("paquetes_checkin").insert({ paquete_id: boxId, numero_cliente_id: inheritedCustomerId, consolidacion: true });
    if (boxCheckinError) throw boxCheckinError;
    const { error: childCheckinError } = await supabase.from("paquetes_checkin").insert(children.map((child) => ({ paquete_id: child.id, parent_box_id: boxId, numero_cliente_id: inheritedCustomerId, consolidacion: true })));
    if (childCheckinError) throw childCheckinError;
    const ids = [boxId, ...children.map((child) => child.id)];
    const { error: updateError } = await supabase.from("paquetes_registro").update({ estado: "Check In", numero_cliente_id: inheritedCustomerId }).in("id", ids);
    if (updateError) throw updateError;
    await supabase.from("staff_action_logs").insert({ staff_user_id: actor.user.id, action: "CONSOLIDATE_SHIPMENTS", entity_type: "paquetes_registro", entity_id: boxId, details: { box_tracking: box.tracking, child_trackings: children.map((child) => child.tracking), customer_id: inheritedCustomerId } });
    return NextResponse.json({ box_tracking: box.tracking, child_trackings: children.map((child) => child.tracking), count: children.length });
  } catch (error) {
    return errorResponse(error);
  }
}
