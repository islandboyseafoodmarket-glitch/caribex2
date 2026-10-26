import { NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { parseInvoiceChargeLine, SALES_TAX_RATE, roundMoney } from "@/lib/invoice-pricing";

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
    const type = "PACKAGE";
    const chargeLines = String(body?.additional_charges || "").split(",").map((line) => line.trim()).filter(Boolean);
    const description = String(body?.description || chargeLines.map((line) => parseInvoiceChargeLine(line).description).join(", ") || "Manual invoice").trim();
    if (!customerId) return NextResponse.json({ error: "Select a customer" }, { status: 400 });
    if (!chargeLines.length) return NextResponse.json({ error: "Select a catalog item or operational extra" }, { status: 400 });
    const customer = customerId ? (await supabase.from("numero_cliente").select("id, numero_cliente, nombre").eq("id", customerId).maybeSingle()).data : null;
    if (customerId && !customer) return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    const finalSubtotal = roundMoney(chargeLines.reduce((sum, line) => sum + parseInvoiceChargeLine(line).amount, 0));
    if (finalSubtotal <= 0) return NextResponse.json({ error: "The selected catalog items or operational extras do not have a billable amount" }, { status: 400 });
    const taxEnabled = staff.role === "admin" && typeof body?.tax_enabled === "boolean" ? body.tax_enabled : true;
    const finalTax = taxEnabled ? roundMoney(finalSubtotal * SALES_TAX_RATE) : 0;
    const finalTotal = roundMoney(finalSubtotal + finalTax);
    const { data: shipment, error } = await supabase.from("paquetes_registro").insert({ tracking, tipo_paquete: type, contenido: description, notas: "MANUAL INVOICE CREATED BY STAFF", numero_cliente_id: customerId, registro: staff.name, estado: "Descargado", billing_subtotal: finalSubtotal, billing_tax: finalTax, billing_total: finalTotal, approval_status: "PENDING", invoice_status: "PENDING" }).select("id, tracking, tipo_paquete, contenido, numero_cliente_id, billing_subtotal, billing_tax, billing_total, approval_status, invoice_status").single();
    if (error) throw error;
    const { error: checkinError } = await supabase.from("paquetes_checkin").insert({ paquete_id: shipment.id, numero_cliente_id: customerId, cargos_adicionales: body?.additional_charges || null });
    if (checkinError) {
      await supabase.from("paquetes_registro").delete().eq("id", shipment.id);
      throw checkinError;
    }
    await supabase.from("staff_action_logs").insert({ actor_id: staff.user.id, actor_name: staff.name, actor_email: staff.user.email || null, actor_role: staff.role, action: "manual_invoice_created", entity_type: "paquetes_registro", entity_id: shipment.id, tracking, customer_name: customer?.nombre || null, customer_account_number: customer?.numero_cliente || null, success: true, details: { source: "staff_invoice_panel", description, type } });
    return NextResponse.json({ ok: true, shipment });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not create manual invoice";
    return NextResponse.json({ error: message }, { status: /authentication|token|access|required/i.test(message) ? 401 : 500 });
  }
}
