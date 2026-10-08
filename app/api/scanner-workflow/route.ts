import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { centralAmericaDateParts } from "../../../lib/staff-date-format";
import { invoiceApprovalStatus } from "@/lib/invoice-approval";
import { calculateWorkflowBilling, isBox } from "@/lib/workflow-billing";
import { DATABASE_STATUS, normalizeFerryPort, statusMatches } from "@/lib/shipping-rules";

export const dynamic = "force-dynamic";

type WorkflowStep = { key: string; status: string; label: string; description: string };

const WORKFLOW: WorkflowStep[] = [
  { key: "RECEIVED", status: DATABASE_STATUS.RECEIVED, label: "Received", description: "Shipment received" },
  { key: "CHECK_IN", status: DATABASE_STATUS.CHECK_IN, label: "Check In", description: "Shipment checked in" },
  { key: "IN_TRANSIT", status: DATABASE_STATUS.IN_TRANSIT, label: "In Transit", description: "Shipment moved in transit" },
  { key: "UNLOADED", status: DATABASE_STATUS.UNLOADED, label: "Ready for Pickup", description: "Shipment unloaded and ready for pickup" },
  { key: "PICKED_UP", status: DATABASE_STATUS.PICKED_UP, label: "Picked Up", description: "Shipment picked up" },
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

function currentIndex(status: unknown, deliveredAt?: unknown, unloadedAt?: unknown) {
  const value = normalize(status);
  if (deliveredAt) return 4;
  if (unloadedAt && !value.includes("entregado") && !value.includes("recogido") && !value.includes("picked")) return 3;
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

function getWeekBounds(date = new Date()) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const day = start.getDay();
  start.setDate(start.getDate() - (day === 0 ? 6 : day - 1));
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function ferryPortForCustomer(customer: any) {
  const port = normalizeFerryPort(customer?.puerto);
  return port === "la_ceiba" || port === "utila" ? port : null;
}

async function registerFerryShipment(supabase: SupabaseClient, shipment: any, customer: any, createdBy: string) {
  const puerto = ferryPortForCustomer(customer);
  if (!puerto) return { isFerry: false as const };

  const { data: link, error: linkError } = await supabase
    .from("contenedor_paquetes")
    .select("contenedor_id")
    .eq("paquete_id", shipment.id)
    .limit(1)
    .maybeSingle();
  if (linkError) throw linkError;
  if (!link?.contenedor_id) return { isFerry: true as const, puerto, registered: false as const };

  let { data: manifest, error: manifestError } = await supabase
    .from("ferry_manifests")
    .select("id, token")
    .eq("contenedor_id", link.contenedor_id)
    .maybeSingle();
  if (manifestError) throw manifestError;

  if (!manifest) {
    const { start, end } = getWeekBounds();
    const created = await supabase
      .from("ferry_manifests")
      .insert({
        contenedor_id: link.contenedor_id,
        token: randomBytes(24).toString("hex"),
        semana_inicio: start.toISOString(),
        semana_fin: end.toISOString(),
        estado: "active",
        creado_por: createdBy,
      })
      .select("id, token")
      .maybeSingle();
    if (created.error) {
      const retry = await supabase
        .from("ferry_manifests")
        .select("id, token")
        .eq("contenedor_id", link.contenedor_id)
        .maybeSingle();
      if (retry.error || !retry.data) throw created.error;
      manifest = retry.data;
    } else {
      manifest = created.data;
    }
  }
  if (!manifest) return { isFerry: true as const, puerto, registered: false as const };

  const { error: entryError } = await supabase
    .from("ferry_manifest_entries")
    .upsert({
      manifiesto_id: manifest.id,
      paquete_id: shipment.id,
      numero_cliente_id: customer.id || shipment.numero_cliente_id,
      puerto,
      numero_cuenta: String(customer.numero_cliente || ""),
      nombre_cliente: customer.nombre || "Unknown customer",
      etiqueta_cantidad: "BOX= 1",
    }, { onConflict: "manifiesto_id,paquete_id" });
  if (entryError) throw entryError;
  return { isFerry: true as const, puerto, registered: true as const, manifestToken: manifest.token };
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

async function ensureCheckinRecord(supabase: SupabaseClient, shipment: { id: string; numero_cliente_id?: string | null }) {
  const { data: existing, error: lookupError } = await supabase
    .from("paquetes_checkin")
    .select("id")
    .eq("paquete_id", shipment.id)
    .order("creado_en", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (lookupError) throw lookupError;
  if (existing) return existing;
  const { data: created, error: insertError } = await supabase
    .from("paquetes_checkin")
    .insert({ paquete_id: shipment.id, numero_cliente_id: shipment.numero_cliente_id || null })
    .select("id")
    .single();
  if (insertError) throw insertError;
  return created;
}

async function getContainerInvoiceReadiness(supabase: SupabaseClient, shipment: any) {
  const [{ data: directLink, error: directLinkError }, { data: checkin, error: checkinError }] = await Promise.all([
    supabase.from("contenedor_paquetes").select("contenedor_id").eq("paquete_id", shipment.id).limit(1).maybeSingle(),
    supabase.from("paquetes_checkin").select("parent_box_id").eq("paquete_id", shipment.id).order("creado_en", { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (directLinkError) throw directLinkError;
  if (checkinError) throw checkinError;

  let containerId = directLink?.contenedor_id || null;
  if (!containerId && checkin?.parent_box_id) {
    const { data: parentLink, error: parentLinkError } = await supabase
      .from("contenedor_paquetes")
      .select("contenedor_id")
      .eq("paquete_id", checkin.parent_box_id)
      .limit(1)
      .maybeSingle();
    if (parentLinkError) throw parentLinkError;
    containerId = parentLink?.contenedor_id || null;
  }
  if (!containerId) return { inContainer: false, ready: true, pending: [] as string[] };

  const { data: links, error: linksError } = await supabase
    .from("contenedor_paquetes")
    .select("paquete_id")
    .eq("contenedor_id", containerId)
    .limit(5000);
  if (linksError) throw linksError;
  const directIds = Array.from(new Set((links || []).map((link) => link.paquete_id).filter(Boolean)));
  if (!directIds.length) return { inContainer: true, ready: true, pending: [] as string[] };

  const { data: directRows, error: directRowsError } = await supabase
    .from("paquetes_registro")
    .select("id, tracking, estado, numero_cliente_id")
    .in("id", directIds)
    .neq("estado", "Archivado")
    .limit(5000);
  if (directRowsError) throw directRowsError;

  const customerRows = (directRows || []).filter((row) => row.numero_cliente_id === shipment.numero_cliente_id);
  const parentIds = (directRows || []).map((row) => row.id);
  const { data: childLinks, error: childLinksError } = parentIds.length
    ? await supabase.from("paquetes_checkin").select("paquete_id, parent_box_id").in("parent_box_id", parentIds).limit(5000)
    : { data: [], error: null };
  if (childLinksError) throw childLinksError;
  const childIds = Array.from(new Set((childLinks || []).map((link) => link.paquete_id).filter(Boolean)));
  const { data: childRows, error: childRowsError } = childIds.length
    ? await supabase.from("paquetes_registro").select("id, tracking, estado, numero_cliente_id").in("id", childIds).neq("estado", "Archivado").limit(5000)
    : { data: [], error: null };
  if (childRowsError) throw childRowsError;

  const relevant = [...customerRows, ...(childRows || []).filter((row) => row.numero_cliente_id === shipment.numero_cliente_id)]
    .filter((row, index, rows) => rows.findIndex((candidate) => candidate.id === row.id) === index);
  const pending = relevant
    .filter((row) => !statusMatches(row.estado, DATABASE_STATUS.UNLOADED) && !statusMatches(row.estado, DATABASE_STATUS.PICKED_UP))
    .map((row) => row.tracking)
    .filter(Boolean);
  return { inContainer: true, ready: pending.length === 0, pending };
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

    let query = supabase.from("paquetes_registro").select("id, tracking, nombre_paqueteria, tipo_paquete, estado, issue_status, numero_cliente_id, billing_subtotal, billing_tax, billing_total, invoice_status, approval_status, fecha_descargado, hora_descargado, fecha_entregado, hora_entregado, numero_cliente:numero_cliente_id (id, numero_cliente, nombre, email, telefono, puerto)");
    const idMatch = rawCode.match(/(?:pedidos\/)?([0-9a-f]{8}-[0-9a-f-]{27})/i);
    if (idMatch) query = query.eq("id", idMatch[1]);
    else query = query.ilike("tracking", rawCode).neq("estado", "Archivado").order("creado_en", { ascending: false });
    const { data, error } = await query.maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: "Shipment not found", code: "NOT_FOUND" }, { status: 404 });
    const index = currentIndex(data.estado, data.fecha_entregado || data.hora_entregado, data.fecha_descargado || data.hora_descargado);
    const next = index < WORKFLOW.length - 1 ? WORKFLOW[index + 1] : null;
    const customer = Array.isArray(data.numero_cliente) ? data.numero_cliente[0] : data.numero_cliente;
    const puerto = ferryPortForCustomer(customer);
    return NextResponse.json({ shipment: data, current: WORKFLOW[index], next, workflow: WORKFLOW, ferry: puerto ? { isFerry: true, puerto } : { isFerry: false } });
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

    const { data: shipment, error: lookupError } = await supabase.from("paquetes_registro").select("id, tracking, nombre_paqueteria, contenido, notas, notas_imagenes, estado, issue_status, tipo_paquete, billing_subtotal, billing_tax, billing_total, invoice_status, approval_status, fecha_descargado, hora_descargado, fecha_entregado, hora_entregado, numero_cliente_id, numero_cliente:numero_cliente_id (id, numero_cliente, nombre, email, telefono, puerto)").eq("id", shipmentId).maybeSingle();
    if (lookupError) throw lookupError;
    if (!shipment) return NextResponse.json({ error: "Shipment not found" }, { status: 404 });

    const beforeIndex = currentIndex(shipment.estado, shipment.fecha_entregado || shipment.hora_entregado, shipment.fecha_descargado || shipment.hora_descargado);
    const expectedNext = WORKFLOW[beforeIndex + 1];
    if (!expectedNext || expectedNext.key !== requestedKey) {
      return NextResponse.json({ error: "Only the next workflow status can be applied", current: WORKFLOW[beforeIndex], next: expectedNext || null }, { status: 409 });
    }

    if (expectedNext.key === "IN_TRANSIT") {
      return NextResponse.json({
        error: "Individual In-Transit is disabled. Use Check In all to create one container for the eligible shipment group.",
        code: "BULK_IN_TRANSIT_REQUIRED",
        tracking: shipment.tracking,
      }, { status: 409 });
    }

    if (expectedNext.key === "CHECK_IN") await ensureCheckinRecord(supabase, shipment);

    const now = centralAmericaDateParts();
    const payload: Record<string, unknown> = { estado: expectedNext.status };
    if (expectedNext.key === "UNLOADED") {
      payload.fecha_descargado = now.date;
      payload.hora_descargado = now.time;
      payload.descargado = actor.profile?.nombre || actor.profile?.nombre_personal || actor.user.email || "Staff";
    }
    if (expectedNext.key === "PICKED_UP") {
      payload.fecha_entregado = now.date;
      payload.hora_entregado = now.time;
      payload.entregado_por = actor.profile?.nombre || actor.profile?.nombre_personal || actor.user.email || "Staff";
      payload.issue_status = "RESOLVED";
    }
    let ferry: { isFerry: boolean; puerto?: string; registered?: boolean; manifestToken?: string } = { isFerry: false };
    let invoice: { sent: boolean; reason?: string } = {
      sent: false,
      reason: "Invoice delivery is evaluated after the shipment is unloaded.",
    };
    const { error: updateError } = await supabase.from("paquetes_registro").update(payload).eq("id", shipmentId);
    if (updateError) throw updateError;

    const customer = Array.isArray(shipment.numero_cliente) ? shipment.numero_cliente[0] : shipment.numero_cliente;
    let unloadedChildren: Array<{ id: string; tracking: string }> = [];
    let pickedUpChildren: Array<{ id: string; tracking: string }> = [];
    if (expectedNext.key === "UNLOADED" && isBox(shipment)) {
      const { data: childLinks, error: childLinkError } = await supabase
        .from("paquetes_checkin")
        .select("paquete_id")
        .eq("parent_box_id", shipment.id)
        .limit(5000);
      if (childLinkError) throw childLinkError;
      const childIds = Array.from(new Set((childLinks || []).map((row) => row.paquete_id).filter(Boolean)));
      if (childIds.length) {
        const { data: children, error: childError } = await supabase
          .from("paquetes_registro")
          .select("id, tracking, estado")
          .in("id", childIds)
          .neq("estado", DATABASE_STATUS.PICKED_UP)
          .neq("estado", "Archivado")
          .limit(5000);
        if (childError) throw childError;
        const { error: childUpdateError } = await supabase
          .from("paquetes_registro")
          .update(payload)
          .in("id", (children || []).map((child) => child.id));
        if (childUpdateError) throw childUpdateError;
        unloadedChildren = (children || []).map((child) => ({ id: child.id, tracking: child.tracking }));
      }
    }
    if (expectedNext.key === "PICKED_UP" && isBox(shipment)) {
      const { data: childLinks, error: childLinkError } = await supabase
        .from("paquetes_checkin")
        .select("paquete_id")
        .eq("parent_box_id", shipment.id)
        .limit(5000);
      if (childLinkError) throw childLinkError;
      const childIds = Array.from(new Set((childLinks || []).map((row) => row.paquete_id).filter(Boolean)));
      if (childIds.length) {
        const { data: children, error: childError } = await supabase
          .from("paquetes_registro")
          .select("id, tracking, estado")
          .in("id", childIds)
          .neq("estado", DATABASE_STATUS.PICKED_UP)
          .neq("estado", "Archivado")
          .limit(5000);
        if (childError) throw childError;
        const { error: childUpdateError } = await supabase
          .from("paquetes_registro")
          .update(payload)
          .in("id", (children || []).map((child) => child.id));
        if (childUpdateError) throw childUpdateError;
        pickedUpChildren = (children || []).map((child) => ({ id: child.id, tracking: child.tracking }));
      }
    }
    if (expectedNext.key === "UNLOADED") {
      try {
        ferry = await registerFerryShipment(supabase, shipment, customer, actor.user.id);
      } catch (ferryError) {
        console.error("Ferry report registration failed after unload", ferryError);
        ferry = { isFerry: Boolean(ferryPortForCustomer(customer)), puerto: ferryPortForCustomer(customer) || undefined, registered: false };
      }
      const approvalStatus = invoiceApprovalStatus(shipment);
      let subtotal = Number(shipment.billing_subtotal);
      let tax = Number(shipment.billing_tax);
      let total = Number(shipment.billing_total);
      if (!Number.isFinite(total) || total <= 0) {
        const checkin = await getLatestCheckin(supabase, shipment.id);
        const billing = calculateWorkflowBilling({ ...shipment, ...checkin });
        if (billing) {
          subtotal = billing.subtotal;
          tax = billing.tax;
          total = billing.total;
          const { error: billingError } = await supabase.from("paquetes_registro").update({ billing_subtotal: subtotal, billing_tax: tax, billing_total: total }).eq("id", shipment.id);
          if (billingError) throw billingError;
        }
      }
      await supabase.from("paquetes_registro").update({ approval_status: approvalStatus }).eq("id", shipment.id);
      const invoiceReadiness = await getContainerInvoiceReadiness(supabase, shipment);
      if (!invoiceReadiness.ready) invoice = { sent: false, reason: `Invoice held until all items for this customer in the container are unloaded. Pending: ${invoiceReadiness.pending.join(", ")}` };
      else if (shipment.invoice_status === "SENT") invoice = { sent: false, reason: "Invoice was already sent." };
      else if (approvalStatus !== "APPROVED") invoice = { sent: false, reason: "Invoice requires review because the shipment has an internal note or photo." };
      else if (!customer?.email) invoice = { sent: false, reason: "Customer has no email address." };
      else if (!Number.isFinite(total) || total <= 0) invoice = { sent: false, reason: "Shipment has no valid billing total." };
      else {
        const invoiceResponse = await fetch(new URL("/api/send-invoice", request.url), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: request.headers.get("authorization") || "",
          },
          body: JSON.stringify({
            to: customer.email,
            subject: `Invoice for ${customer.nombre || shipment.tracking}`,
            clientName: customer.nombre || "",
            clientNumber: customer.numero_cliente || null,
            tracking: shipment.tracking,
            typeLabel: shipment.tipo_paquete || "Shipment",
            contents: shipment.contenido || null,
            subtotal: Number.isFinite(subtotal) ? subtotal : 0,
            tax: Number.isFinite(tax) ? tax : 0,
            total,
            extraCharges: [],
            isConsolidationBox: false,
            consolidatedPackagesCount: null,
          }),
        });
        if (invoiceResponse.ok) {
          const { error: invoiceStatusError } = await supabase.from("paquetes_registro").update({ invoice_status: "SENT" }).eq("id", shipment.id);
          if (invoiceStatusError) throw invoiceStatusError;
          invoice = { sent: true };
        } else {
          const invoicePayload = await invoiceResponse.json().catch(() => ({}));
          invoice = { sent: false, reason: invoicePayload.error || "Invoice email could not be sent." };
        }
      }
    }
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
      details: { from_status: shipment.estado, to_status: expectedNext.status, invoice_sent: invoice.sent, invoice_reason: invoice.reason || null, source: "scanner_workflow_app" },
      user_agent: request.headers.get("user-agent") || null,
    });
    return NextResponse.json({ ok: true, previous: WORKFLOW[beforeIndex], current: expectedNext, tracking: shipment.tracking, unloaded_children: unloadedChildren, picked_up_children: pickedUpChildren, invoice, ferry });
  } catch (error) {
    return errorResponse(error);
  }
}
