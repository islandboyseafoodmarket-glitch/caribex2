import { NextResponse } from "next/server";
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { createPrepaidUsageReportPdf, type PrepaidReportShipment } from "@/lib/prepaid-usage-report";

export const dynamic = "force-dynamic";

const PREPAID_ACCOUNT_TYPE = "Developer / Builder — Prepaid";
const RESEND_FROM = "info@caribexlogisticsgroup.com";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PAGE_SIZE = 1000;

type Actor = {
  user: User;
  role: string;
  name: string;
};

type CustomerRow = {
  id: string;
  nombre: string | null;
  email: string | null;
  numero_cliente: string | number | null;
  puerto: string | null;
  tipo_cuenta: string | null;
  prepaid_allowance_cubic_feet: number | string | null;
  prepaid_used_cubic_feet: number | string | null;
  prepaid_rate_per_cubic_foot: number | string | null;
};

type ShipmentRow = {
  id: string;
  tracking: string | null;
  nombre_paqueteria: string | null;
  tipo_paquete: string | null;
  contenido: string | null;
  estado: string | null;
  cubic_feet: number | string | null;
  numero_cliente_id: string | null;
  creado_en: string | null;
  registro: string | null;
  hora_fecha: string | null;
};

type CheckinRow = {
  paquete_id: string;
  parent_box_id: string | null;
  alto: number | string | null;
  ancho: number | string | null;
  largo: number | string | null;
  creado_en: string | null;
};

type LinkRow = { paquete_id: string; contenedor_id: string };
type ContainerRow = { id: string; codigo: string | null };

class RouteError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = "RouteError";
  }
}

function serviceClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new RouteError(503, "Supabase server configuration is missing");
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

async function requireAdmin(request: Request, supabase: SupabaseClient): Promise<Actor> {
  const authorization = request.headers.get("authorization") || "";
  if (!authorization.startsWith("Bearer ")) throw new RouteError(401, "Authentication is required");
  const token = authorization.slice("Bearer ".length).trim();
  if (!token) throw new RouteError(401, "Authentication is required");

  const { data: authData, error: authError } = await supabase.auth.getUser(token);
  if (authError || !authData.user) throw new RouteError(401, "Invalid authentication token");

  const { data: admin, error: adminError } = await supabase
    .from("administradores")
    .select("id, rol")
    .eq("id", authData.user.id)
    .maybeSingle();
  if (adminError) throw new RouteError(500, `Could not verify administrator access: ${adminError.message}`);
  if (!admin) throw new RouteError(403, "Administrator access is required");

  const metadata = authData.user.user_metadata || {};
  const metadataName = typeof metadata.full_name === "string" ? metadata.full_name : typeof metadata.name === "string" ? metadata.name : "";
  return {
    user: authData.user,
    role: String(admin.rol || "admin"),
    name: metadataName.trim() || authData.user.email || "Admin",
  };
}

async function fetchPaged<T>(makeQuery: () => any): Promise<T[]> {
  const rows: T[] = [];
  let offset = 0;
  while (true) {
    const { data, error } = await makeQuery().range(offset, offset + PAGE_SIZE - 1);
    if (error) throw new RouteError(500, `Could not load prepaid report data: ${error.message}`);
    const page = (data || []) as T[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) return rows;
    offset += PAGE_SIZE;
  }
}

async function fetchInChunks<T>(ids: string[], makeQuery: (chunk: string[]) => any): Promise<T[]> {
  const rows: T[] = [];
  for (let index = 0; index < ids.length; index += PAGE_SIZE) {
    const chunk = ids.slice(index, index + PAGE_SIZE);
    rows.push(...await fetchPaged<T>(() => makeQuery(chunk)));
  }
  return rows;
}

function finiteNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseBody(body: unknown): { customerId: string; expectedEmail?: string; idempotencyKey?: string } {
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new RouteError(400, "Request body must be an object");
  const record = body as Record<string, unknown>;
  const allowed = new Set(["customerId", "expectedEmail", "idempotencyKey"]);
  const unexpected = Object.keys(record).filter((key) => !allowed.has(key));
  if (unexpected.length) throw new RouteError(400, `Unsupported request field: ${unexpected[0]}`);

  const customerId = typeof record.customerId === "string" ? record.customerId.trim() : "";
  if (!UUID_PATTERN.test(customerId)) throw new RouteError(400, "customerId must be a valid UUID");

  let expectedEmail: string | undefined;
  if (record.expectedEmail !== undefined) {
    if (typeof record.expectedEmail !== "string" || !record.expectedEmail.trim()) throw new RouteError(400, "expectedEmail must be a non-empty string when provided");
    expectedEmail = record.expectedEmail.trim();
  }

  let idempotencyKey: string | undefined;
  if (record.idempotencyKey !== undefined) {
    if (typeof record.idempotencyKey !== "string" || !UUID_PATTERN.test(record.idempotencyKey.trim())) throw new RouteError(400, "idempotencyKey must be a valid UUID when provided");
    idempotencyKey = record.idempotencyKey.trim();
  }
  return { customerId, expectedEmail, idempotencyKey };
}

function escapeHtml(value: unknown): string {
  return String(value ?? "").replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character] || character);
}

async function writeAudit(supabase: SupabaseClient, actor: Actor, customer: CustomerRow, success: boolean, details: Record<string, unknown>, errorMessage: string | null) {
  const { error } = await supabase.from("staff_action_logs").insert({
    actor_id: actor.user.id,
    actor_name: actor.name,
    actor_email: actor.user.email || null,
    actor_role: actor.role,
    action: "email_prepaid_usage_report",
    entity_type: "numero_cliente",
    entity_id: customer.id,
    customer_name: customer.nombre || null,
    customer_account_number: customer.numero_cliente || null,
    success,
    error_message: errorMessage,
    details,
    ip_address: null,
    user_agent: null,
  });
  if (error) throw new RouteError(500, `Email provider completed, but audit logging failed: ${error.message}`);
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function reportDate(row: ShipmentRow): string | null {
  return row.hora_fecha || row.creado_en || null;
}

function buildEmailBody(customer: CustomerRow, allowance: number, used: number, remaining: number, rate: number, shipmentCount: number): { html: string; text: string } {
  const name = escapeHtml(customer.nombre || "Customer");
  const account = escapeHtml(customer.numero_cliente ?? "-");
  const port = escapeHtml(customer.puerto || "Port not provided");
  const allowanceText = allowance.toFixed(2);
  const usedText = used.toFixed(2);
  const remainingText = remaining.toFixed(2);
  const rateText = rate.toFixed(2);
  return {
    html: `<p>Hello ${name},</p><p>Attached is your Caribex prepaid cubic-foot usage report for account #${account}.</p><p><strong>Allowance:</strong> ${allowanceText} ft3<br><strong>Used:</strong> ${usedText} ft3<br><strong>Remaining:</strong> ${remainingText} ft3<br><strong>Rate:</strong> $${rateText}/ft3<br><strong>Port:</strong> ${port}<br><strong>Shipments listed:</strong> ${shipmentCount}</p><p>This report is provided for your records. Please contact Caribex Logistics Group with any questions.</p>`,
    text: `Hello ${customer.nombre || "Customer"},\n\nAttached is your Caribex prepaid cubic-foot usage report for account #${customer.numero_cliente ?? "-"}.\n\nAllowance: ${allowanceText} ft3\nUsed: ${usedText} ft3\nRemaining: ${remainingText} ft3\nRate: $${rateText}/ft3\nPort: ${customer.puerto || "Port not provided"}\nShipments listed: ${shipmentCount}\n\nThis report is provided for your records. Please contact Caribex Logistics Group with any questions.`,
  };
}

export async function POST(request: Request) {
  let supabase: SupabaseClient | null = null;
  let actor: Actor | null = null;
  let customer: CustomerRow | null = null;
  let requestValues: { customerId: string; expectedEmail?: string; idempotencyKey?: string } | null = null;

  try {
    supabase = serviceClient();
    actor = await requireAdmin(request, supabase);
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new RouteError(400, "Request body must be valid JSON");
    }
    requestValues = parseBody(body);

    if (!process.env.RESEND_API_KEY) throw new RouteError(503, "Email service is not configured; no email was sent");

    const { data, error: customerError } = await supabase
      .from("numero_cliente")
      .select("id, nombre, email, numero_cliente, puerto, tipo_cuenta, prepaid_allowance_cubic_feet, prepaid_used_cubic_feet, prepaid_rate_per_cubic_foot")
      .eq("id", requestValues.customerId)
      .maybeSingle();
    if (customerError) throw new RouteError(500, `Could not load customer: ${customerError.message}`);
    if (!data) throw new RouteError(404, "Customer not found");
    customer = data as CustomerRow;
    if (customer.tipo_cuenta !== PREPAID_ACCOUNT_TYPE) throw new RouteError(400, "Customer is not a Developer / Builder prepaid account");

    const savedEmail = typeof customer.email === "string" ? customer.email.trim() : "";
    if (!savedEmail) throw new RouteError(400, "Customer does not have a saved email address");
    if (requestValues.expectedEmail && normalizeEmail(requestValues.expectedEmail) !== normalizeEmail(savedEmail)) {
      throw new RouteError(409, "The saved customer email changed. Review the recipient and try again.");
    }

    const shipments = await fetchPaged<ShipmentRow>(() => supabase!
      .from("paquetes_registro")
      .select("id, tracking, nombre_paqueteria, tipo_paquete, contenido, estado, cubic_feet, numero_cliente_id, creado_en, registro, hora_fecha")
      .eq("numero_cliente_id", requestValues!.customerId)
      .order("creado_en", { ascending: false }));
    const shipmentIds = shipments.map((row) => row.id).filter(Boolean);

    const [links, checkins] = shipmentIds.length
      ? await Promise.all([
          fetchInChunks<LinkRow>(shipmentIds, (chunk) => supabase!.from("contenedor_paquetes").select("paquete_id, contenedor_id").in("paquete_id", chunk).order("paquete_id", { ascending: true })),
          fetchInChunks<CheckinRow>(shipmentIds, (chunk) => supabase!.from("paquetes_checkin").select("paquete_id, parent_box_id, alto, ancho, largo, creado_en").in("paquete_id", chunk).order("creado_en", { ascending: false })),
        ])
      : [[], []] as [LinkRow[], CheckinRow[]];

    const directLinks = new Map<string, Set<string>>();
    for (const link of links) {
      if (!link.paquete_id || !link.contenedor_id) continue;
      const labels = directLinks.get(String(link.paquete_id)) || new Set<string>();
      labels.add(String(link.contenedor_id));
      directLinks.set(String(link.paquete_id), labels);
    }
    const containerIds = Array.from(new Set(links.map((link) => String(link.contenedor_id)).filter(Boolean)));
    const containers = containerIds.length
      ? await fetchInChunks<ContainerRow>(containerIds, (chunk) => supabase!.from("contenedores").select("id, codigo").in("id", chunk))
      : [];
    const containerById = new Map(containers.map((container) => [String(container.id), String(container.codigo || container.id)]));

    const latestCheckinByPackage = new Map<string, CheckinRow>();
    for (const checkin of checkins) {
      if (!latestCheckinByPackage.has(String(checkin.paquete_id))) latestCheckinByPackage.set(String(checkin.paquete_id), checkin);
    }

    const reportShipments: PrepaidReportShipment[] = shipments.map((row) => {
      const labels = Array.from(new Set(Array.from(directLinks.get(String(row.id)) || []).map((id) => containerById.get(id) || id)));
      const checkin = latestCheckinByPackage.get(String(row.id));
      return {
        id: row.id,
        tracking: row.tracking,
        carrier: row.nombre_paqueteria,
        type: row.tipo_paquete,
        stage: row.estado,
        contents: row.contenido,
        length: checkin?.largo ?? null,
        width: checkin?.ancho ?? null,
        height: checkin?.alto ?? null,
        storedCubicFeet: row.cubic_feet,
        date: reportDate(row),
        containerLabels: labels,
      };
    });

    const allowance = finiteNumber(customer.prepaid_allowance_cubic_feet);
    const used = finiteNumber(customer.prepaid_used_cubic_feet);
    const remaining = Math.max(0, allowance - used);
    const rate = finiteNumber(customer.prepaid_rate_per_cubic_foot, 18.5) || 18.5;
    const pdfBytes = await createPrepaidUsageReportPdf({
      customer: { id: customer.id, name: customer.nombre, accountNumber: customer.numero_cliente, port: customer.puerto, email: savedEmail },
      allowance,
      used,
      remaining,
      rate,
      shipments: reportShipments,
    });
    const emailBody = buildEmailBody(customer, allowance, used, remaining, rate, reportShipments.length);
    const resendHeaders: Record<string, string> = { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" };
    if (requestValues.idempotencyKey) resendHeaders["Idempotency-Key"] = requestValues.idempotencyKey;

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: resendHeaders,
      body: JSON.stringify({
        from: RESEND_FROM,
        to: [savedEmail],
        subject: `Caribex Logistics - Prepaid usage report - Account #${customer.numero_cliente ?? "-"}`,
        html: emailBody.html,
        text: emailBody.text,
        attachments: [{ filename: `caribex-prepaid-usage-${customer.numero_cliente ?? "account"}.pdf`, content: Buffer.from(pdfBytes).toString("base64") }],
      }),
    });
    const responseText = await resendResponse.text();
    if (!resendResponse.ok) {
      const providerDetail = (() => {
        try {
          const parsed = JSON.parse(responseText) as { message?: string; error?: string };
          return parsed.message || parsed.error || responseText;
        } catch {
          return responseText;
        }
      })();
      const providerError = `Resend rejected the prepaid usage report (${resendResponse.status}): ${providerDetail || "unknown provider error"}`;
      try {
        await writeAudit(supabase, actor, customer, false, { customer_id: customer.id, recipient: savedEmail, shipment_count: reportShipments.length, idempotency_key: requestValues.idempotencyKey || null }, providerError);
      } catch (auditError) {
        console.error("Failed to write failed prepaid usage report audit", auditError);
      }
      throw new RouteError(502, providerError);
    }

    let warning: string | undefined;
    try {
      await writeAudit(supabase, actor, customer, true, {
        customer_id: customer.id,
        recipient: savedEmail,
        allowance_cubic_feet: allowance,
        used_cubic_feet: used,
        remaining_cubic_feet: remaining,
        rate_per_cubic_foot: rate,
        shipment_count: reportShipments.length,
        idempotency_key: requestValues.idempotencyKey || null,
      }, null);
    } catch (auditError) {
      console.error("Report email sent, but its activity log could not be saved", auditError);
      warning = "The report was sent, but the activity log could not be updated. Do not resend just to update the log.";
    }
    return NextResponse.json({ ok: true, recipient: savedEmail, ...(warning ? { warning } : {}) });
  } catch (error) {
    const status = error instanceof RouteError ? error.status : 500;
    const message = error instanceof Error ? error.message : "Could not send prepaid usage report";
    console.error("Error sending prepaid usage report", error);
    return NextResponse.json({ error: message }, { status });
  }
}
