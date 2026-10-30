import { NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  centsToAmount,
  optionalText,
  parseAmountCents,
  parsePaymentDate,
  parsePaymentMethod,
  parseUuid,
  PaymentInputError,
  type PaymentLedgerEntry,
  type PaymentSummary,
} from "@/lib/payment-ledger";

export const dynamic = "force-dynamic";

const MIGRATION_REQUIRED_CODE = "PAYMENT_LEDGER_MIGRATION_REQUIRED";

type PaymentActor = { id: string; email?: string | null; isAdmin: boolean };
type SupabaseError = { code?: string; message?: string; details?: string; hint?: string };

class HttpError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) {
    super(message);
    this.name = "HttpError";
  }
}

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase server environment variables are missing");
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

async function requireInvoiceAccess(request: Request, supabase: SupabaseClient): Promise<PaymentActor> {
  const authorization = request.headers.get("authorization") || "";
  if (!/^Bearer\s+/i.test(authorization)) throw new HttpError(401, "AUTHENTICATION_REQUIRED", "Authentication is required");
  const token = authorization.replace(/^Bearer\s+/i, "").trim();
  if (!token) throw new HttpError(401, "AUTHENTICATION_REQUIRED", "Authentication is required");
  const { data: authData, error: authError } = await supabase.auth.getUser(token);
  if (authError || !authData.user) throw new HttpError(401, "INVALID_AUTHENTICATION", "Invalid authentication token");

  const [{ data: admin, error: adminError }, { data: staff, error: staffError }] = await Promise.all([
    supabase.from("administradores").select("id").eq("id", authData.user.id).maybeSingle(),
    supabase.from("personal").select("id, permissions").eq("id", authData.user.id).maybeSingle(),
  ]);
  if (adminError) throw adminError;
  if (staffError) throw staffError;
  if (admin) return { id: authData.user.id, email: authData.user.email, isAdmin: true };
  const permissions = staff?.permissions && typeof staff.permissions === "object"
    ? staff.permissions as Record<string, unknown>
    : {};
  if (!staff || permissions.invoices !== true) {
    throw new HttpError(403, "INVOICE_ACCESS_REQUIRED", "Invoice access is required to view or record payments");
  }
  return { id: authData.user.id, email: authData.user.email, isAdmin: false };
}

function isMissingLedger(error: SupabaseError | null | undefined) {
  if (!error) return false;
  const code = String(error.code || "").toUpperCase();
  const message = String(error.message || "").toLowerCase();
  return code === "42P01" || code === "42883" || code === "PGRST202" || code === "PGRST205"
    || message.includes("invoice_payment_entries")
    || message.includes("invoice_payment_balances")
    || message.includes("record_invoice_payment")
    || message.includes("reverse_invoice_payment")
    || message.includes("does not exist");
}

function ledgerMissing(): HttpError {
  return new HttpError(503, MIGRATION_REQUIRED_CODE, "The payment ledger migration is required before payment operations are available");
}

function errorCode(error: SupabaseError) {
  const message = String(error.message || "");
  if (/IDEMPOTENCY_CONFLICT/i.test(message)) return [409, "IDEMPOTENCY_CONFLICT"] as const;
  if (/EXCEEDS_OUTSTANDING_BALANCE/i.test(message)) return [409, "PAYMENT_EXCEEDS_OUTSTANDING_BALANCE"] as const;
  if (/PAYMENT_ALREADY_REVERSED/i.test(message)) return [409, "PAYMENT_ALREADY_REVERSED"] as const;
  if (/ORIGINAL_PAYMENT_NOT_FOUND/i.test(message)) return [404, "ORIGINAL_PAYMENT_NOT_FOUND"] as const;
  if (/INVOICE_NOT_FOUND/i.test(message)) return [404, "INVOICE_NOT_FOUND"] as const;
  if (/INVOICE_TOTAL_REQUIRED/i.test(message)) return [409, "INVOICE_TOTAL_REQUIRED"] as const;
  if (/ADMIN_ACTOR_REQUIRED/i.test(message)) return [403, "ADMIN_ACCESS_REQUIRED"] as const;
  if (/IDEMPOTENCY_KEY_REQUIRED/i.test(message)) return [400, "IDEMPOTENCY_KEY_REQUIRED"] as const;
  if (/INVALID_PAYMENT_METHOD/i.test(message)) return [400, "INVALID_PAYMENT_METHOD"] as const;
  if (/INVALID_PAYMENT_AMOUNT/i.test(message)) return [400, "INVALID_PAYMENT_AMOUNT"] as const;
  if (/PAYMENT_DATE_REQUIRED/i.test(message)) return [400, "PAYMENT_DATE_REQUIRED"] as const;
  if (/PAYMENT_ID_REQUIRED/i.test(message)) return [400, "PAYMENT_ID_REQUIRED"] as const;
  if (/REVERSAL_REASON_REQUIRED/i.test(message)) return [400, "REVERSAL_REASON_REQUIRED"] as const;
  if (/INVOICE_PAYMENT_ACTOR_REQUIRED/i.test(message)) return [403, "INVOICE_ACCESS_REQUIRED"] as const;
  return [500, "PAYMENT_LEDGER_ERROR"] as const;
}

function errorResponse(error: unknown) {
  if (error instanceof HttpError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
  }
  if (error instanceof PaymentInputError) {
    return NextResponse.json({ error: error.message, code: "INVALID_REQUEST" }, { status: 400 });
  }
  const candidate = (error || {}) as SupabaseError;
  if (isMissingLedger(candidate)) {
    const missing = ledgerMissing();
    return NextResponse.json({ error: missing.message, code: missing.code }, { status: missing.status });
  }
  const [status, code] = errorCode(candidate);
  const message = status === 500 ? "Payment ledger request failed" : String(candidate.message || code);
  return NextResponse.json({ error: message, code }, { status });
}

function numberValue(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value || 0);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : 0;
}

function nullableNumber(value: unknown): number | null {
  return value == null ? null : numberValue(value);
}

function normalizeEntry(row: Record<string, unknown>): PaymentLedgerEntry {
  return {
    id: String(row.entry_id || row.id),
    invoice_id: String(row.invoice_id),
    entry_type: String(row.entry_type) as PaymentLedgerEntry["entry_type"],
    amount: numberValue(row.amount),
    method: (row.method as PaymentLedgerEntry["method"]) || null,
    reference: (row.reference as string | null) || null,
    notes: (row.notes as string | null) || null,
    payment_date: row.payment_date == null ? null : String(row.payment_date),
    created_by: (row.created_by as string | null) || null,
    created_at: String(row.created_at),
    original_payment_id: (row.original_payment_id as string | null) || null,
    idempotency_key: String(row.idempotency_key),
    is_legacy: Boolean(row.is_legacy),
  };
}

function normalizeSummary(row: Record<string, unknown>, invoice?: Record<string, unknown>): PaymentSummary & Record<string, unknown> {
  return {
    invoice_id: String(row.invoice_id || invoice?.id),
    billing_total: nullableNumber(row.billing_total ?? invoice?.billing_total),
    paid: numberValue(row.paid),
    balance: numberValue(row.balance),
    invoice_status: (row.invoice_status ?? invoice?.invoice_status ?? null) as string | null,
    tracking: invoice?.tracking ?? null,
    payment_method: invoice?.payment_method ?? null,
    payment_reference: invoice?.payment_reference ?? null,
    payment_date: invoice?.payment_date ?? null,
    payment_notes: invoice?.payment_notes ?? null,
  };
}

async function getSummaries(supabase: SupabaseClient, invoiceIds: string[]) {
  const [{ data: invoices, error: invoiceError }, { data: balances, error: balanceError }] = await Promise.all([
    supabase
      .from("paquetes_registro")
      .select("id, tracking, billing_total, invoice_status, payment_method, payment_reference, payment_date, payment_notes")
      .in("id", invoiceIds),
    supabase.from("invoice_payment_balances").select("invoice_id, billing_total, paid, balance, invoice_status").in("invoice_id", invoiceIds),
  ]);
  if (invoiceError) throw invoiceError;
  if (balanceError) throw balanceError;
  const invoiceById = new Map((invoices || []).map((invoice) => [String(invoice.id), invoice as Record<string, unknown>]));
  const balanceById = new Map((balances || []).map((balance) => [String(balance.invoice_id), balance as Record<string, unknown>]));
  const missing = invoiceIds.find((id) => !invoiceById.has(id));
  if (missing) throw new HttpError(404, "INVOICE_NOT_FOUND", "Invoice not found");
  return invoiceIds.reduce<Record<string, PaymentSummary & Record<string, unknown>>>((result, id) => {
    const invoice = invoiceById.get(id)!;
    result[id] = normalizeSummary(balanceById.get(id) || {
      invoice_id: id,
      billing_total: invoice.billing_total,
      paid: 0,
      balance: numberValue(invoice.billing_total),
      invoice_status: invoice.invoice_status,
    }, invoice);
    return result;
  }, {});
}

async function assertLedgerReady(supabase: SupabaseClient) {
  // Probe the view even for an empty/invalid-looking request so the UI can
  // reliably distinguish an uninstalled migration from ordinary bad input.
  const { error } = await supabase.from("invoice_payment_balances").select("invoice_id").limit(1);
  if (error && isMissingLedger(error)) throw ledgerMissing();
  if (error) throw error;
}

export async function GET(request: Request) {
  try {
    const supabase = adminClient();
    await requireInvoiceAccess(request, supabase);
    await assertLedgerReady(supabase);
    const url = new URL(request.url);
    const invoiceIdValue = url.searchParams.get("invoice_id")?.trim() || "";
    const invoiceIdsValue = url.searchParams.get("invoice_ids")?.trim() || "";
    if (invoiceIdValue && invoiceIdsValue) {
      throw new HttpError(400, "AMBIGUOUS_INVOICE_QUERY", "Use invoice_id or invoice_ids, not both");
    }
    if (invoiceIdValue) {
      const invoiceId = parseUuid(invoiceIdValue, "invoice_id");
      const summaries = await getSummaries(supabase, [invoiceId]);
      const { data: entries, error } = await supabase
        .from("invoice_payment_entries")
        .select("id, invoice_id, entry_type, amount, method, reference, notes, payment_date, created_by, created_at, original_payment_id, idempotency_key, is_legacy")
        .eq("invoice_id", invoiceId)
        .order("created_at", { ascending: true })
        .order("id", { ascending: true });
      if (error) throw error;
      return NextResponse.json({ invoice: summaries[invoiceId], entries: (entries || []).map((entry) => normalizeEntry(entry as Record<string, unknown>)) });
    }

    const rawIds = invoiceIdsValue.split(",").map((id) => id.trim()).filter(Boolean);
    if (rawIds.length === 0) throw new HttpError(400, "INVOICE_IDS_REQUIRED", "invoice_id or invoice_ids is required");
    const invoiceIds = Array.from(new Set(rawIds));
    if (invoiceIds.length > 200) throw new HttpError(400, "TOO_MANY_INVOICES", "invoice_ids is limited to 200 invoices");
    invoiceIds.forEach((id) => parseUuid(id, "invoice_ids"));
    return NextResponse.json({ summaries: await getSummaries(supabase, invoiceIds) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const supabase = adminClient();
    const actor = await requireInvoiceAccess(request, supabase);
    await assertLedgerReady(supabase);
    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      throw new HttpError(400, "INVALID_JSON", "Request body must be valid JSON");
    }
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      throw new HttpError(400, "INVALID_REQUEST", "Request body must be an object");
    }

    const action = body.action == null ? "payment" : String(body.action).trim().toLowerCase();
    if (action === "reverse" && !actor.isAdmin) {
      throw new HttpError(403, "ADMIN_ACCESS_REQUIRED", "Only an administrator can reverse a recorded payment");
    }
    const idempotencyKey = parseUuid(body.idempotency_key, "idempotency_key");
    let rpcData: unknown;
    if (action === "reverse") {
      const paymentId = parseUuid(body.payment_id, "payment_id");
      const reason = optionalText(body.reason, "reason", 2000);
      if (!reason) throw new PaymentInputError("reason is required for a reversal");
      const paymentDate = parsePaymentDate(body.payment_date, "payment_date", true);
      const { data, error } = await supabase.rpc("reverse_invoice_payment", {
        p_payment_id: paymentId,
        p_reason: reason,
        p_idempotency_key: idempotencyKey,
        p_actor: actor.id,
        p_payment_date: paymentDate,
      });
      if (error) throw error;
      rpcData = Array.isArray(data) ? data[0] : data;
    } else {
      if (action !== "payment") throw new HttpError(400, "INVALID_ACTION", "action must be payment or reverse");
      const invoiceId = parseUuid(body.invoice_id, "invoice_id");
      const amountCents = parseAmountCents(body.amount);
      const method = parsePaymentMethod(body.method);
      const reference = optionalText(body.reference, "reference", 500);
      const notes = optionalText(body.notes, "notes", 2000);
      const paymentDate = parsePaymentDate(body.payment_date, "payment_date", false);
      const customerInvoiceNote = optionalText(body.customer_invoice_note, "customer_invoice_note", 2000);
      const { data, error } = await supabase.rpc("record_invoice_payment", {
        p_invoice_id: invoiceId,
        p_amount: centsToAmount(amountCents).toFixed(2),
        p_method: method,
        p_reference: reference,
        p_notes: notes,
        p_payment_date: paymentDate,
        p_idempotency_key: idempotencyKey,
        p_actor: actor.id,
        p_customer_invoice_note: customerInvoiceNote,
      });
      if (error) throw error;
      rpcData = Array.isArray(data) ? data[0] : data;
    }

    if (!rpcData || typeof rpcData !== "object") throw new Error("Payment RPC returned no entry");
    const row = rpcData as Record<string, unknown>;
    const entry = normalizeEntry(row);
    return NextResponse.json({
      ok: true,
      replayed: Boolean(row.replayed),
      entry,
      invoice: {
        invoice_id: String(row.invoice_id),
        billing_total: nullableNumber(row.billing_total),
        paid: numberValue(row.paid),
        balance: numberValue(row.balance),
        invoice_status: row.invoice_status == null ? null : String(row.invoice_status),
      },
    }, { status: row.replayed ? 200 : 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

// Explicitly no PUT/PATCH/DELETE handlers: ledger entries cannot be edited or deleted.
