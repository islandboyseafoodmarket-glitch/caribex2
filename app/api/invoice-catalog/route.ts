import { NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { BILLABLE_INVOICE_ITEMS, SALES_TAX_RATE, formatCatalogCharge, roundMoney } from "@/lib/invoice-pricing";
import { calculateWorkflowBilling } from "@/lib/workflow-billing";

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase server environment variables are missing");
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

type InvoiceActor = {
  user: { id: string; email?: string };
  name: string;
  role: "admin" | "staff";
};

async function actor(request: Request, supabase: SupabaseClient): Promise<InvoiceActor> {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) throw new Error("Authentication is required");
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) throw new Error("Invalid authentication token");
  const [{ data: admin }, { data: staff }] = await Promise.all([
    supabase.from("administradores").select("id").eq("id", data.user.id).maybeSingle(),
    supabase.from("personal").select("id, nombre, nombre_personal").eq("id", data.user.id).maybeSingle(),
  ]);
  if (!admin && !staff) throw new Error("Staff access is required");
  return {
    user: { id: data.user.id, email: data.user.email },
    name: admin ? "Admin" : staff?.nombre || staff?.nombre_personal || data.user.email || "Staff",
    role: admin ? "admin" : "staff",
  };
}

function authError(error: unknown) {
  const message = error instanceof Error ? error.message : "Invoice request failed";
  return NextResponse.json(
    { error: message },
    { status: /authentication|token/i.test(message) ? 401 : /access|required/i.test(message) ? 403 : 500 },
  );
}

export async function POST(request: Request) {
  try {
    const supabase = adminClient();
    const staff = await actor(request, supabase);

    const body = await request.json();
    const shipmentId = String(body?.shipment_id || "").trim();
    const itemId = String(body?.item_id || "").trim();
    const quantity = Number(body?.quantity);
    const item = BILLABLE_INVOICE_ITEMS.find((candidate) => candidate.id === itemId);
    if (!shipmentId || !item) return NextResponse.json({ error: "A shipment and valid catalog item are required" }, { status: 400 });
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100) {
      return NextResponse.json({ error: "Quantity must be a whole number from 1 to 100" }, { status: 400 });
    }

    const { data: shipment, error: shipmentError } = await supabase
      .from("paquetes_registro")
      .select("id, tracking, tipo_paquete, numero_cliente_id, billing_subtotal, billing_tax, billing_total, invoice_status")
      .eq("id", shipmentId)
      .maybeSingle();
    if (shipmentError) throw shipmentError;
    if (!shipment) return NextResponse.json({ error: "Invoice shipment not found" }, { status: 404 });
    if (String(shipment.invoice_status || "").toUpperCase() === "PAID") {
      return NextResponse.json({ error: "A paid invoice cannot be changed" }, { status: 409 });
    }

    const { data: checkin, error: checkinError } = await supabase
      .from("paquetes_checkin")
      .select("id, alto, ancho, largo, cargos_adicionales")
      .eq("paquete_id", shipment.id)
      .order("creado_en", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (checkinError) throw checkinError;

    let subtotal = Number(shipment.billing_subtotal);
    if (!Number.isFinite(subtotal) || subtotal < 0) {
      const calculated = calculateWorkflowBilling({ ...shipment, ...checkin });
      if (!calculated) return NextResponse.json({ error: "Calculate the shipment invoice before adding catalog items" }, { status: 409 });
      subtotal = calculated.subtotal;
    }

    const addedAmount = roundMoney(item.unitPrice * quantity);
    const nextSubtotal = roundMoney(subtotal + addedAmount);
    const taxEnabled = shipment.billing_tax == null ? true : Number(shipment.billing_tax) > 0;
    const tax = taxEnabled ? roundMoney(nextSubtotal * SALES_TAX_RATE) : 0;
    const total = roundMoney(nextSubtotal + tax);
    const chargeLabel = formatCatalogCharge(item, quantity);
    const priorCharges = String(checkin?.cargos_adicionales || "").split(",").map((value) => value.trim()).filter(Boolean);
    const nextCharges = [...priorCharges, chargeLabel].join(", ");

    let createdCheckinId: string | null = null;
    if (checkin?.id) {
      const { error } = await supabase.from("paquetes_checkin").update({ cargos_adicionales: nextCharges }).eq("id", checkin.id);
      if (error) throw error;
    } else {
      const { data: inserted, error } = await supabase
        .from("paquetes_checkin")
        .insert({ paquete_id: shipment.id, numero_cliente_id: shipment.numero_cliente_id, cargos_adicionales: nextCharges })
        .select("id")
        .single();
      if (error) throw error;
      createdCheckinId = inserted.id;
    }

    const { error: updateError } = await supabase
      .from("paquetes_registro")
      .update({ billing_subtotal: nextSubtotal, billing_tax: tax, billing_total: total })
      .eq("id", shipment.id);
    if (updateError) {
      if (checkin?.id) await supabase.from("paquetes_checkin").update({ cargos_adicionales: checkin.cargos_adicionales || null }).eq("id", checkin.id);
      else if (createdCheckinId) await supabase.from("paquetes_checkin").delete().eq("id", createdCheckinId);
      throw updateError;
    }

    await supabase.from("staff_action_logs").insert({
      actor_id: staff.user.id,
      actor_name: staff.name,
      actor_email: staff.user.email || null,
      actor_role: staff.role,
      action: "invoice_catalog_item_added",
      entity_type: "paquetes_registro",
      entity_id: shipment.id,
      tracking: shipment.tracking,
      success: true,
      details: { item_id: item.id, description: item.label, quantity, unit_price: item.unitPrice, amount: addedAmount, tax_enabled: taxEnabled },
    });

    return NextResponse.json({ ok: true, chargeLabel, subtotal: nextSubtotal, tax, total, taxEnabled });
  } catch (error) {
    return authError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const supabase = adminClient();
    const staff = await actor(request, supabase);
    if (staff.role !== "admin") return NextResponse.json({ error: "Only an administrator can change sales-tax settings" }, { status: 403 });

    const body = await request.json();
    const shipmentId = String(body?.shipment_id || "").trim();
    const taxEnabled = body?.tax_enabled;
    if (!shipmentId || typeof taxEnabled !== "boolean") {
      return NextResponse.json({ error: "Shipment and tax setting are required" }, { status: 400 });
    }

    const { data: shipment, error: shipmentError } = await supabase
      .from("paquetes_registro")
      .select("id, tracking, billing_subtotal, invoice_status")
      .eq("id", shipmentId)
      .maybeSingle();
    if (shipmentError) throw shipmentError;
    if (!shipment) return NextResponse.json({ error: "Invoice shipment not found" }, { status: 404 });
    if (String(shipment.invoice_status || "").toUpperCase() === "PAID") {
      return NextResponse.json({ error: "A paid invoice cannot be changed" }, { status: 409 });
    }

    const subtotal = Number(shipment.billing_subtotal);
    if (!Number.isFinite(subtotal) || subtotal < 0) {
      return NextResponse.json({ error: "A valid invoice subtotal is required before changing tax" }, { status: 409 });
    }
    const tax = taxEnabled ? roundMoney(subtotal * SALES_TAX_RATE) : 0;
    const total = roundMoney(subtotal + tax);
    const { error: updateError } = await supabase
      .from("paquetes_registro")
      .update({ billing_tax: tax, billing_total: total })
      .eq("id", shipment.id);
    if (updateError) throw updateError;

    await supabase.from("staff_action_logs").insert({
      actor_id: staff.user.id,
      actor_name: staff.name,
      actor_email: staff.user.email || null,
      actor_role: staff.role,
      action: "invoice_sales_tax_toggled",
      entity_type: "paquetes_registro",
      entity_id: shipment.id,
      tracking: shipment.tracking,
      success: true,
      details: { tax_enabled: taxEnabled, tax_rate: SALES_TAX_RATE, tax_amount: tax, total },
    });

    return NextResponse.json({ ok: true, subtotal: roundMoney(subtotal), tax, total, taxEnabled });
  } catch (error) {
    return authError(error);
  }
}
