import { NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { BILLABLE_INVOICE_ITEMS, INVOICE_DISCOUNTS, INVOICE_DISCOUNT_RATE, SALES_TAX_RATE, formatCatalogCharge, formatInvoiceDiscountLine, parseInvoiceChargeLine, parseInvoiceDiscountLine, roundMoney, type InvoiceDiscountCode } from "@/lib/invoice-pricing";
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

async function updateInvoiceDiscount(
  supabase: SupabaseClient,
  staff: InvoiceActor,
  shipmentId: string,
  action: "apply" | "remove",
  code?: InvoiceDiscountCode,
) {
  if (staff.role !== "admin") {
    return NextResponse.json({ error: "Only an administrator can apply or remove invoice discounts" }, { status: 403 });
  }
  if (!shipmentId || (action === "apply" && (typeof code !== "string" || !Object.hasOwn(INVOICE_DISCOUNTS, code)))) {
    return NextResponse.json({ error: "A valid shipment and discount are required" }, { status: 400 });
  }

  const { data: shipment, error: shipmentError } = await supabase
    .from("paquetes_registro")
    .select("id, tracking, tipo_paquete, billing_subtotal, billing_tax, invoice_status")
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
  if (!checkin?.id) return NextResponse.json({ error: "A check-in record is required to edit this invoice" }, { status: 409 });

  const priorCharges = String(checkin.cargos_adicionales || "").split(",").map((value) => value.trim()).filter(Boolean);
  const parsedPrior = priorCharges.map((label) => ({ label, parsed: parseInvoiceChargeLine(label), discount: parseInvoiceDiscountLine(label) }));
  const isLegacyDiscount = (entry: typeof parsedPrior[number]) => entry.parsed.description === "Discount" && entry.parsed.amount < 0;
  const removableEntries = parsedPrior.filter((entry) => entry.discount || isLegacyDiscount(entry));
  const workflow = calculateWorkflowBilling({
    tipo_paquete: shipment.tipo_paquete,
    alto: checkin.alto,
    ancho: checkin.ancho,
    largo: checkin.largo,
    cargos_adicionales: priorCharges.filter((_, index) => !removableEntries.some((entry) => entry.label === priorCharges[index])).join(", "),
  });

  const storedSubtotal = shipment.billing_subtotal == null ? Number.NaN : Number(shipment.billing_subtotal);
  const calculatedSubtotal = workflow?.subtotal;
  const currentSubtotal = Number.isFinite(storedSubtotal) && storedSubtotal >= 0
    ? storedSubtotal
    : calculatedSubtotal;
  if (currentSubtotal == null || !Number.isFinite(currentSubtotal) || currentSubtotal < 0) {
    return NextResponse.json({ error: "Calculate a valid invoice subtotal before applying a discount" }, { status: 409 });
  }

  let nextCharges = priorCharges;
  let discountAmount = 0;
  let resultCode: InvoiceDiscountCode | null = null;

  if (action === "remove") {
    if (removableEntries.length === 0) {
      return NextResponse.json({ error: "No invoice discount is currently applied" }, { status: 409 });
    }
    const removedSignedAmount = roundMoney(removableEntries.reduce((sum, entry) => sum + entry.parsed.amount, 0));
    discountAmount = roundMoney(Math.abs(removedSignedAmount));
    nextCharges = priorCharges.filter((label) => !removableEntries.some((entry) => entry.label === label));
    resultCode = removableEntries.find((entry) => entry.discount)?.discount?.code || null;
  } else {
    if (removableEntries.length > 0) {
      return NextResponse.json({ error: "Remove the current discount before applying a different one" }, { status: 409 });
    }
    let eligibleSubtotal = currentSubtotal;
    if (INVOICE_DISCOUNTS[code!].scope === "shipping") {
      if (!workflow) return NextResponse.json({ error: "Shipping charges could not be calculated for this shipment" }, { status: 409 });
      const merchandiseAmount = priorCharges.reduce((sum, label) => {
        const parsed = parseInvoiceChargeLine(label);
        const normalizedDescription = parsed.description.replace(/\s×\s\d+$/i, "").trim().toLowerCase();
        const isMerchandise = BILLABLE_INVOICE_ITEMS.some((item) => item.id !== "consolidation" && item.label.toLowerCase() === normalizedDescription);
        return sum + (isMerchandise ? parsed.amount : 0);
      }, 0);
      const unexplainedInvoiceAmount = currentSubtotal - workflow.subtotal;
      eligibleSubtotal = Math.min(currentSubtotal, Math.max(0, workflow.subtotal - merchandiseAmount + Math.max(0, unexplainedInvoiceAmount)));
    }
    discountAmount = roundMoney(Math.min(currentSubtotal, eligibleSubtotal) * INVOICE_DISCOUNT_RATE);
    if (discountAmount <= 0) return NextResponse.json({ error: "This invoice has no eligible amount for the selected discount" }, { status: 409 });
    nextCharges = [...priorCharges, formatInvoiceDiscountLine(code!, discountAmount)];
    resultCode = code!;
  }

  const nextSubtotal = roundMoney(Math.max(0, currentSubtotal + (action === "apply" ? -discountAmount : discountAmount)));
  const taxEnabled = shipment.billing_tax == null ? true : Number(shipment.billing_tax) > 0;
  const tax = taxEnabled ? roundMoney(nextSubtotal * SALES_TAX_RATE) : 0;
  const total = roundMoney(nextSubtotal + tax);

  const { error: checkinUpdateError } = await supabase
    .from("paquetes_checkin")
    .update({ cargos_adicionales: nextCharges.join(", ") || null })
    .eq("id", checkin.id);
  if (checkinUpdateError) throw checkinUpdateError;

  const { error: invoiceUpdateError } = await supabase
    .from("paquetes_registro")
    .update({ billing_subtotal: nextSubtotal, billing_tax: tax, billing_total: total })
    .eq("id", shipment.id);
  if (invoiceUpdateError) {
    await supabase.from("paquetes_checkin").update({ cargos_adicionales: checkin.cargos_adicionales || null }).eq("id", checkin.id);
    throw invoiceUpdateError;
  }

  await supabase.from("staff_action_logs").insert({
    actor_id: staff.user.id,
    actor_name: staff.name,
    actor_email: staff.user.email || null,
    actor_role: staff.role,
    action: action === "apply" ? "invoice_discount_applied" : "invoice_discount_removed",
    entity_type: "paquetes_registro",
    entity_id: shipment.id,
    tracking: shipment.tracking,
    success: true,
    details: { discount_code: resultCode, discount_amount: discountAmount, subtotal: nextSubtotal, tax, total, tax_enabled: taxEnabled },
  });

  return NextResponse.json({ ok: true, action, discountCode: resultCode, discountAmount, subtotal: nextSubtotal, tax, total, taxEnabled });
}

export async function PATCH(request: Request) {
  try {
    const supabase = adminClient();
    const staff = await actor(request, supabase);
    const body = await request.json();
    const shipmentId = String(body?.shipment_id || "").trim();
    if (body?.discount_action === "apply" || body?.discount_action === "remove") {
      return updateInvoiceDiscount(supabase, staff, shipmentId, body.discount_action, body.discount_code);
    }
    if (staff.role !== "admin") return NextResponse.json({ error: "Only an administrator can change sales-tax settings" }, { status: 403 });
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
