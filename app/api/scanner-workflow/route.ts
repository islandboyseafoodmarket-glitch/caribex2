import { NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { calculateWorkflowBilling, isBox } from "@/lib/workflow-billing";

export const dynamic = "force-dynamic";

type WorkflowStep = { key: string; status: string; label: string; description: string };

const WORKFLOW: WorkflowStep[] = [
  { key: "RECEIVED", status: "Recibido", label: "Received", description: "Shipment received" },
  { key: "CHECK_IN", status: "Registrado", label: "Check In", description: "Shipment checked in" },
  { key: "IN_TRANSIT", status: "En tránsito", label: "In Transit", description: "Shipment moved in transit" },
  { key: "UNLOADED", status: "Descargado", label: "Ready for Pickup", description: "Shipment unloaded and ready for pickup" },
  { key: "PICKED_UP", status: "Entregado", label: "Picked Up", description: "Shipment picked up" },
];

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
  const profile = staff
    ? { nombre: staff.nombre, nombre_personal: staff.nombre_personal, rol: staff.rol }
    : { nombre: null, nombre_personal: null, rol: admin?.rol || "administrador" };
  return { user: data.user, role: admin ? "admin" : "staff", profile };
}

function normalize(value: unknown) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function currentIndex(status: unknown) {
  const value = normalize(status);
  if (value.includes("entregado") || value.includes("recogido") || value.includes("picked")) return 4;
  if (value.includes("descargado") || value.includes("unloaded") || value.includes("ready")) return 3;
  if (value.includes("transito") || value.includes("transit")) return 2;
  if (value.includes("registrado") || value.includes("check") || value.includes("registro")) return 1;
  return 0;
}

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "Unexpected error";
  const status = /authentication|token|access|required/i.test(message) ? 401 : 500;
  return NextResponse.json({ error: message }, { status });
}

async function getLatestCheckin(supabase: SupabaseClient, packageId: string) {
  const { data, error } = await supabase
    .from("paquetes_checkin")
    .select("id, alto, ancho, largo, peso, cargos_adicionales")
    .eq("paquete_id", packageId)
    .order("creado_en", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function validateAndRecalculateBox(supabase: SupabaseClient, shipment: any) {
  if (!isBox(shipment)) return;
  const checkin = await getLatestCheckin(supabase, shipment.id);
  const dimensionsPresent = [checkin?.alto, checkin?.ancho, checkin?.largo]
    .every((value) => Number.isFinite(Number(value)) && Number(value) > 0);
  if (!dimensionsPresent) {
    throw new Error(`BOX ${shipment.tracking} cannot move to In-Transit until Length, Width, and Height are entered.`);
  }

  let billingTotal = Number(shipment.billing_total);
  if (!Number.isFinite(billingTotal) || billingTotal <= 0) {
    const billing = calculateWorkflowBilling({ ...shipment, ...checkin });
    if (!billing) throw new Error(`BOX ${shipment.tracking} cannot move to In-Transit until its billing total is calculated.`);
    const { error } = await supabase.from("paquetes_registro").update({
      billing_subtotal: billing.subtotal,
      billing_tax: billing.tax,
      billing_total: billing.total,
      invoice_status: shipment.invoice_status || "PENDING",
    }).eq("id", shipment.id);
    if (error) throw error;
    billingTotal = billing.total;
  }
  if (!Number.isFinite(billingTotal) || billingTotal <= 0) {
    throw new Error(`BOX ${shipment.tracking} cannot move to In-Transit without a valid billing total.`);
  }
}

export async function GET(request: Request) {
  try {
    const supabase = adminClient();
    await requireStaff(request, supabase);
    const url = new URL(request.url);
    const rawCode = url.searchParams.get("code")?.trim() || "";
    if (!rawCode) return NextResponse.json({ error: "Scan or enter a tracking number" }, { status: 400 });

    let query = supabase.from("paquetes_registro").select("id, tracking, nombre_paqueteria, tipo_paquete, estado, numero_cliente_id, billing_subtotal, billing_tax, billing_total, invoice_status, approval_status, numero_cliente:numero_cliente_id (numero_cliente, nombre)");
    const idMatch = rawCode.match(/(?:pedidos\/)?([0-9a-f]{8}-[0-9a-f-]{27})/i);
    if (idMatch) query = query.eq("id", idMatch[1]);
    else query = query.ilike("tracking", rawCode);
    const { data, error } = await query.maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: "Shipment not found", code: "NOT_FOUND" }, { status: 404 });
    const index = currentIndex(data.estado);
    const next = index < WORKFLOW.length - 1 ? WORKFLOW[index + 1] : null;
    return NextResponse.json({ shipment: data, current: WORKFLOW[index], next, workflow: WORKFLOW });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const supabase = adminClient();
    const actor = await requireStaff(request, supabase);
    const body = await request.json();
    const shipmentId = String(body?.shipment_id || "").trim();
    const requestedKey = String(body?.next_key || "").trim();
    if (!shipmentId || !requestedKey) return NextResponse.json({ error: "Shipment and next status are required" }, { status: 400 });

    const { data: shipment, error: lookupError } = await supabase.from("paquetes_registro").select("id, tracking, estado, tipo_paquete, billing_subtotal, billing_tax, billing_total, invoice_status, approval_status, numero_cliente_id, numero_cliente:numero_cliente_id (numero_cliente, nombre)").eq("id", shipmentId).maybeSingle();
    if (lookupError) throw lookupError;
    if (!shipment) return NextResponse.json({ error: "Shipment not found" }, { status: 404 });

    const beforeIndex = currentIndex(shipment.estado);
    const expectedNext = WORKFLOW[beforeIndex + 1];
    if (!expectedNext || expectedNext.key !== requestedKey) {
      return NextResponse.json({ error: "Only the next workflow status can be applied", current: WORKFLOW[beforeIndex], next: expectedNext || null }, { status: 409 });
    }

    if (expectedNext.key === "IN_TRANSIT") {
      try {
        await validateAndRecalculateBox(supabase, shipment);
      } catch (error) {
        const message = error instanceof Error ? error.message : "BOX billing validation failed";
        return NextResponse.json({ error: message, code: "BILLING_VALIDATION_REQUIRED", tracking: shipment.tracking }, { status: 422 });
      }
    }

    const now = new Date();
    const payload: Record<string, unknown> = { estado: expectedNext.status };
    if (expectedNext.key === "UNLOADED") {
      payload.fecha_descargado = now.toISOString().split("T")[0];
      payload.hora_descargado = now.toTimeString().split(" ")[0];
      payload.descargado = actor.profile?.nombre || actor.profile?.nombre_personal || actor.user.email || "Staff";
    }
    if (expectedNext.key === "PICKED_UP") {
      payload.fecha_entregado = now.toISOString().split("T")[0];
      payload.hora_entregado = now.toTimeString().split(" ")[0];
      payload.entregado_por = actor.profile?.nombre || actor.profile?.nombre_personal || actor.user.email || "Staff";
    }
    const { error: updateError } = await supabase.from("paquetes_registro").update(payload).eq("id", shipmentId);
    if (updateError) throw updateError;

    const customer = Array.isArray(shipment.numero_cliente) ? shipment.numero_cliente[0] : shipment.numero_cliente;
    await supabase.from("staff_action_logs").insert({
      actor_id: actor.user.id,
      actor_name: actor.profile?.nombre || actor.profile?.nombre_personal || actor.user.email || null,
      actor_email: actor.user.email || null,
      actor_role: actor.role,
      action: "workflow_status_change",
      entity_type: "paquetes_registro",
      entity_id: shipment.id,
      tracking: shipment.tracking,
      customer_name: customer?.nombre || null,
      customer_account_number: customer?.numero_cliente || null,
      success: true,
      details: { from_status: shipment.estado, to_status: expectedNext.status, source: "scanner_workflow_app" },
      user_agent: request.headers.get("user-agent") || null,
    });
    return NextResponse.json({ ok: true, previous: WORKFLOW[beforeIndex], current: expectedNext, tracking: shipment.tracking });
  } catch (error) {
    return errorResponse(error);
  }
}
