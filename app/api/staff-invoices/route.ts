import { NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { calculateWorkflowBilling } from "@/lib/workflow-billing";

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase server environment variables are missing");
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}
async function actor(request: Request, supabase: SupabaseClient) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) throw new Error("Authentication is required");
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) throw new Error("Invalid authentication token");
  const [{ data: admin }, { data: staff }] = await Promise.all([
    supabase.from("administradores").select("id").eq("id", data.user.id).maybeSingle(),
    supabase.from("personal").select("id, nombre, nombre_personal").eq("id", data.user.id).maybeSingle(),
  ]);
  if (!admin && !staff) throw new Error("Staff access is required");
  return { user: data.user, name: admin ? "Admin" : staff?.nombre || staff?.nombre_personal || data.user.email || "Staff", role: admin ? "admin" : "staff" };
}
export async function POST(request: Request) {
  try {
    const supabase = adminClient();
    const staff = await actor(request, supabase);
    const body = await request.json();
    const customerId = String(body?.customer_id || "").trim() || null;
    const tracking = String(body?.tracking || `MANUAL-${Date.now()}`).trim().toUpperCase();
    const type = body?.type === "BOX" ? "BOX" : "PACKAGE";
    const description = String(body?.description || "Manual shipment").trim();
    const dimensions = { alto: Number(body?.height) || null, ancho: Number(body?.width) || null, largo: Number(body?.length) || null, peso: Number(body?.weight) || null };
    if (!description) return NextResponse.json({ error: "Description is required" }, { status: 400 });
    const customer = customerId ? (await supabase.from("numero_cliente").select("id, numero_cliente, nombre").eq("id", customerId).maybeSingle()).data : null;
    if (customerId && !customer) return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    const billing = calculateWorkflowBilling({ tipo_paquete: type, ...dimensions, cargos_adicionales: body?.additional_charges || null });
    const subtotal = Number(body?.subtotal);
    const tax = Number(body?.tax);
    const total = Number(body?.total);
    const finalSubtotal = Number.isFinite(subtotal) && subtotal >= 0 ? subtotal : billing?.subtotal || 0;
    const finalTax = Number.isFinite(tax) && tax >= 0 ? tax : finalSubtotal * 0.15;
    const finalTotal = Number.isFinite(total) && total >= 0 ? total : finalSubtotal + finalTax;
    const { data: shipment, error } = await supabase.from("paquetes_registro").insert({ tracking, tipo_paquete: type, contenido: description, notas: "MANUAL INVOICE CREATED BY STAFF", numero_cliente_id: customerId, registro: staff.name, estado: "Descargado", billing_subtotal: finalSubtotal, billing_tax: finalTax, billing_total: finalTotal, approval_status: "PENDING", invoice_status: "PENDING" }).select("id, tracking, tipo_paquete, contenido, numero_cliente_id, billing_subtotal, billing_tax, billing_total, approval_status, invoice_status").single();
    if (error) throw error;
    if (Object.values(dimensions).some(Boolean)) await supabase.from("paquetes_checkin").insert({ paquete_id: shipment.id, numero_cliente_id: customerId, ...dimensions, cargos_adicionales: body?.additional_charges || null });
    await supabase.from("staff_action_logs").insert({ actor_id: staff.user.id, actor_name: staff.name, actor_email: staff.user.email || null, actor_role: staff.role, action: "manual_invoice_created", entity_type: "paquetes_registro", entity_id: shipment.id, tracking, customer_name: customer?.nombre || null, customer_account_number: customer?.numero_cliente || null, success: true, details: { source: "staff_invoice_panel", description, type } });
    return NextResponse.json({ ok: true, shipment });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not create manual invoice";
    return NextResponse.json({ error: message }, { status: /authentication|token|access|required/i.test(message) ? 401 : 500 });
  }
}
