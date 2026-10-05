import { NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { calculateWorkflowBilling, isBox } from "@/lib/workflow-billing";
import { CHECK_IN_STAGE_QUERY, DATABASE_STATUS, RECEIVING_STAGE_QUERY } from "@/lib/shipping-rules";

export const dynamic = "force-dynamic";

function client() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase server environment variables are missing");
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

async function staff(request: Request, supabase: SupabaseClient) {
  const header = request.headers.get("authorization") || "";
  if (!header.startsWith("Bearer ")) throw new Error("Authentication is required");
  const { data, error } = await supabase.auth.getUser(header.slice(7));
  if (error || !data.user) throw new Error("Invalid authentication token");
  const [{ data: admin }, { data: member }] = await Promise.all([
    supabase.from("administradores").select("id, rol").eq("id", data.user.id).maybeSingle(),
    supabase.from("personal").select("id, rol, nombre, nombre_personal").eq("id", data.user.id).maybeSingle(),
  ]);
  if (!admin && !member) throw new Error("Staff access is required");
  const profile = (member || admin || {}) as {
    nombre?: string | null;
    nombre_personal?: string | null;
    rol?: string | null;
  };
  return { user: data.user, role: admin ? "admin" : "staff", profile };
}

export async function POST(request: Request) {
  try {
    const supabase = client();
    const actor = await staff(request, supabase);
    const body = await request.json();
    const nextKey = String(body?.next_key || "");
    if (nextKey === "CHECK_IN") {
      const { data: received, error: listError } = await supabase
        .from("paquetes_registro")
        .select("id, tracking, numero_cliente_id")
        .in("estado", RECEIVING_STAGE_QUERY)
        .limit(500);
      if (listError) throw listError;
      const ids = (received || []).map((row) => row.id);
      if (!ids.length) return NextResponse.json({ ok: true, moved: 0 });
      const { data: existingCheckins, error: checkinLookupError } = await supabase
        .from("paquetes_checkin")
        .select("paquete_id")
        .in("paquete_id", ids);
      if (checkinLookupError) throw checkinLookupError;
      const existingIds = new Set((existingCheckins || []).map((row) => String(row.paquete_id)));
      const missingCheckins = (received || [])
        .filter((row) => !existingIds.has(String(row.id)))
        .map((row) => ({ paquete_id: row.id, numero_cliente_id: row.numero_cliente_id || null }));
      if (missingCheckins.length) {
        const { error: checkinInsertError } = await supabase.from("paquetes_checkin").insert(missingCheckins);
        if (checkinInsertError) throw checkinInsertError;
      }
      const { error: updateError } = await supabase.from("paquetes_registro").update({ estado: DATABASE_STATUS.CHECK_IN }).in("id", ids);
      if (updateError) throw updateError;
      await supabase.from("staff_action_logs").insert({
        actor_id: actor.user.id,
        actor_name: actor.profile?.nombre || actor.profile?.nombre_personal || actor.user.email || null,
        actor_email: actor.user.email || null,
        actor_role: actor.role,
        action: "bulk_workflow_status_change",
        entity_type: "paquetes_registro",
        entity_id: null,
        success: true,
        details: { from_status: DATABASE_STATUS.RECEIVED, to_status: DATABASE_STATUS.CHECK_IN, moved: ids.length, source: "scanner_workflow_app" },
        user_agent: request.headers.get("user-agent") || null,
      });
      return NextResponse.json({ ok: true, moved: ids.length });
    }
    if (nextKey !== "IN_TRANSIT") {
      return NextResponse.json({ error: "Only bulk Recibido to Check In or Check In to In-Transit is supported" }, { status: 400 });
    }
    const { data: rows, error: listError } = await supabase
      .from("paquetes_registro")
      .select("id, tracking, tipo_paquete, billing_subtotal, billing_tax, billing_total, invoice_status")
      .in("estado", CHECK_IN_STAGE_QUERY)
      .limit(500);
    if (listError) throw listError;
    const candidates = rows || [];
    const ids = candidates.map((row) => row.id);
    if (!ids.length) return NextResponse.json({ ok: true, moved: 0, blocked: [] });

    const { data: checkins, error: checkinError } = await supabase
      .from("paquetes_checkin")
      .select("paquete_id, alto, ancho, largo, peso, cargos_adicionales, creado_en")
      .in("paquete_id", ids)
      .order("creado_en", { ascending: false });
    if (checkinError) throw checkinError;
    const latestCheckin = new Map<string, any>();
    for (const row of checkins || []) latestCheckin.set(String(row.paquete_id), row);

    const blocked: Array<{ id: string; tracking: string; reason: string }> = [];
    const billingUpdates: Array<{ id: string; billing_subtotal: number; billing_tax: number; billing_total: number; invoice_status: string }> = [];
    for (const row of candidates) {
      if (!isBox(row)) continue;
      const checkin = latestCheckin.get(String(row.id));
      const hasDimensions = [checkin?.alto, checkin?.ancho, checkin?.largo]
        .every((value) => Number.isFinite(Number(value)) && Number(value) > 0);
      if (!hasDimensions) {
        blocked.push({ id: row.id, tracking: row.tracking, reason: "Length, Width, and Height are required" });
        continue;
      }
      const existingTotal = Number(row.billing_total);
      if (!Number.isFinite(existingTotal) || existingTotal <= 0) {
        const billing = calculateWorkflowBilling({ ...row, ...checkin });
        if (!billing) {
          blocked.push({ id: row.id, tracking: row.tracking, reason: "Billing total could not be calculated" });
          continue;
        }
        billingUpdates.push({ id: row.id, billing_subtotal: billing.subtotal, billing_tax: billing.tax, billing_total: billing.total, invoice_status: row.invoice_status || "PENDING" });
      }
    }
    if (blocked.length) {
      return NextResponse.json({ error: "Bulk move blocked: one or more BOX shipments need measurements or billing", code: "BILLING_VALIDATION_REQUIRED", blocked }, { status: 422 });
    }
    for (const update of billingUpdates) {
      const { error } = await supabase.from("paquetes_registro").update({ billing_subtotal: update.billing_subtotal, billing_tax: update.billing_tax, billing_total: update.billing_total, invoice_status: update.invoice_status }).eq("id", update.id);
      if (error) throw error;
    }
    const now = new Date();
    const containerCode = `CONT-${now.toISOString().slice(0, 10)}-${String(Date.now()).slice(-6)}`;
    const { data: container, error: containerError } = await supabase
      .from("contenedores")
      .insert({ codigo: containerCode })
      .select("id, codigo")
      .single();
    if (containerError || !container) throw containerError || new Error("Could not create container for In-Transit");

    const { error: linkError } = await supabase.from("contenedor_paquetes").insert(ids.map((paquete_id) => ({ contenedor_id: container.id, paquete_id })));
    if (linkError) {
      await supabase.from("contenedores").delete().eq("id", container.id);
      throw linkError;
    }

    const { error: updateError } = await supabase.from("paquetes_registro").update({ estado: DATABASE_STATUS.IN_TRANSIT, fecha_transito: now.toISOString() }).in("id", ids);
    if (updateError) throw updateError;
    await supabase.from("staff_action_logs").insert({
      actor_id: actor.user.id,
      actor_name: actor.profile?.nombre || actor.profile?.nombre_personal || actor.user.email || null,
      actor_email: actor.user.email || null,
      actor_role: actor.role,
      action: "bulk_workflow_status_change",
      entity_type: "paquetes_registro",
      entity_id: null,
      success: true,
      details: { from_status: DATABASE_STATUS.CHECK_IN, to_status: DATABASE_STATUS.IN_TRANSIT, moved: ids.length, container_code: container.codigo, recalculated_billing: billingUpdates.length, source: "scanner_workflow_app" },
      user_agent: request.headers.get("user-agent") || null,
    });
    return NextResponse.json({ ok: true, moved: ids.length, blocked: [], recalculated_billing: billingUpdates.length, container });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: /authentication|token|access|required/i.test(message) ? 401 : 500 });
  }
}
