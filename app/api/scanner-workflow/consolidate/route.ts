import { NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { DATABASE_STATUS } from "@/lib/shipping-rules";

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

async function saveCheckinRelationship(
  supabase: SupabaseClient,
  paqueteId: string,
  values: {
    parent_box_id?: string | null;
    numero_cliente_id?: string | null;
    consolidacion: boolean;
    cargos_adicionales?: string | null;
  },
) {
  const { data: existing, error: lookupError } = await supabase
    .from("paquetes_checkin")
    .select("id")
    .eq("paquete_id", paqueteId)
    .maybeSingle();
  if (lookupError) throw lookupError;
  if (existing?.id) {
    const { error } = await supabase.from("paquetes_checkin").update(values).eq("id", existing.id);
    if (error) throw error;
    return;
  }
  const { error } = await supabase.from("paquetes_checkin").insert({ paquete_id: paqueteId, ...values });
  if (error) throw error;
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
    await saveCheckinRelationship(supabase, boxId, { parent_box_id: null, numero_cliente_id: inheritedCustomerId, consolidacion: true });
    const { data: childCheckins, error: childCheckinsError } = await supabase
      .from("paquetes_checkin")
      .select("paquete_id, cargos_adicionales")
      .in("paquete_id", childIds)
      .order("creado_en", { ascending: false })
      .limit(5000);
    if (childCheckinsError) throw childCheckinsError;
    const latestChildCheckin = new Map<string, string | null>();
    for (const checkin of childCheckins || []) {
      if (!latestChildCheckin.has(checkin.paquete_id)) {
        latestChildCheckin.set(checkin.paquete_id, checkin.cargos_adicionales);
      }
    }
    for (const child of children) {
      const existingCharges = String(latestChildCheckin.get(child.id) || "")
        .split(",")
        .map((charge) => charge.trim())
        .filter(Boolean)
        .filter((charge) => charge !== "Consolidation fee ($2.5)");
      const charges = [...existingCharges, "Consolidation fee ($2.5)"].join(", ");
      await saveCheckinRelationship(supabase, child.id, {
        parent_box_id: boxId,
        numero_cliente_id: inheritedCustomerId,
        consolidacion: true,
        cargos_adicionales: charges,
      });
    }
    const { error: updateError } = await supabase.from("paquetes_registro").update({ estado: DATABASE_STATUS.CHECK_IN, numero_cliente_id: inheritedCustomerId }).eq("id", boxId);
    if (updateError) throw updateError;
    const { error: childBillingError } = await supabase
      .from("paquetes_registro")
      .update({
        estado: DATABASE_STATUS.CHECK_IN,
        numero_cliente_id: inheritedCustomerId,
        billing_subtotal: 2.5,
        billing_tax: 0.375,
        billing_total: 2.875,
      })
      .in("id", children.map((child) => child.id));
    if (childBillingError) throw childBillingError;
    await supabase.from("staff_action_logs").insert({ staff_user_id: actor.user.id, action: "CONSOLIDATE_SHIPMENTS", entity_type: "paquetes_registro", entity_id: boxId, details: { box_tracking: box.tracking, child_trackings: children.map((child) => child.tracking), customer_id: inheritedCustomerId } });
    return NextResponse.json({ box_tracking: box.tracking, child_trackings: children.map((child) => child.tracking), count: children.length });
  } catch (error) {
    return errorResponse(error);
  }
}
