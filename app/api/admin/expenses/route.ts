import { NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const PAYMENT_METHODS = ["Zelle", "PayPal", "Cash", "Bank Transfer", "Wire", "Credit granted"] as const;
type PaymentMethod = (typeof PAYMENT_METHODS)[number];
type ExpenseStatus = "PAID" | "UNPAID";
type ExpenseActor = { id: string };
type SupabaseError = { code?: string; message?: string };

class HttpError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) {
    super(message);
    this.name = "HttpError";
  }
}

function adminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new HttpError(503, "SERVER_CONFIGURATION_ERROR", "The expenses service is not configured");
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

async function requireAdmin(request: Request, supabase: SupabaseClient): Promise<ExpenseActor> {
  const authorization = request.headers.get("authorization") || "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match?.[1]?.trim()) throw new HttpError(401, "AUTHENTICATION_REQUIRED", "Please sign in to continue");

  const { data, error } = await supabase.auth.getUser(match[1].trim());
  if (error || !data.user) throw new HttpError(401, "INVALID_AUTHENTICATION", "Your session is invalid or expired");

  const { data: admin, error: adminError } = await supabase
    .from("administradores")
    .select("id")
    .eq("id", data.user.id)
    .maybeSingle();
  if (adminError) throw new HttpError(500, "ADMIN_CHECK_FAILED", "Could not verify administrator access");
  if (!admin) throw new HttpError(403, "ADMIN_ACCESS_REQUIRED", "Administrator access is required");
  return { id: data.user.id };
}

function invalid(code: string, message: string): never {
  throw new HttpError(400, code, message);
}

function text(value: unknown, name: string, max: number, required: boolean): string | null {
  if (value == null) {
    if (required) invalid(`INVALID_${name.toUpperCase()}`, `${name} is required`);
    return null;
  }
  if (typeof value !== "string") invalid(`INVALID_${name.toUpperCase()}`, `${name} must be text`);
  const normalized = value.trim();
  if (!normalized && required) invalid(`INVALID_${name.toUpperCase()}`, `${name} is required`);
  if (normalized.length > max) invalid(`INVALID_${name.toUpperCase()}`, `${name} must be ${max} characters or fewer`);
  return normalized || null;
}

function uuid(value: unknown, name: string): string {
  if (typeof value !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    invalid(`INVALID_${name.toUpperCase()}`, `${name} must be a valid UUID`);
  }
  return value;
}

function expenseDate(value: unknown): string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) invalid("INVALID_EXPENSE_DATE", "Enter a valid expense date");
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) invalid("INVALID_EXPENSE_DATE", "Enter a valid expense date");
  return value;
}

function amount(value: unknown): string {
  const raw = typeof value === "number" ? String(value) : typeof value === "string" ? value.trim() : "";
  const numeric = /^\d+(?:\.\d{1,2})?$/.test(raw) ? Number(raw) : Number.NaN;
  if (!Number.isFinite(numeric) || numeric <= 0 || numeric >= 1000000000000) {
    invalid("INVALID_EXPENSE_AMOUNT", "Amount must be greater than zero and use no more than two decimal places");
  }
  return numeric.toFixed(2);
}

function expenseStatus(value: unknown): ExpenseStatus {
  if (value !== "PAID" && value !== "UNPAID") invalid("INVALID_EXPENSE_STATUS", "Choose paid or unpaid status");
  return value;
}

function paymentMethod(value: unknown, status: ExpenseStatus): PaymentMethod | null {
  if (status === "UNPAID" && (value == null || value === "")) return null;
  if (typeof value !== "string" || !PAYMENT_METHODS.includes(value as PaymentMethod)) {
    invalid("INVALID_EXPENSE_PAYMENT_METHOD", status === "PAID" ? "Choose a payment method for a paid expense" : "Unpaid expenses cannot have a payment method");
  }
  return value as PaymentMethod;
}

function rpcRow(data: unknown): Record<string, unknown> | null {
  const value = Array.isArray(data) ? data[0] : data;
  return value && typeof value === "object" ? value as Record<string, unknown> : null;
}

function friendlyRpcError(error: SupabaseError): HttpError {
  const message = String(error.message || "");
  if (/IDEMPOTENCY_CONFLICT/i.test(message)) return new HttpError(409, "IDEMPOTENCY_CONFLICT", "This request key was already used for different expense details");
  if (/EXPENSE_ALREADY_VOIDED/i.test(message)) return new HttpError(409, "EXPENSE_ALREADY_VOIDED", "This expense has already been voided");
  if (/EXPENSE_NOT_FOUND/i.test(message)) return new HttpError(404, "EXPENSE_NOT_FOUND", "The expense could not be found");
  if (/ADMIN_ACTOR_REQUIRED/i.test(message)) return new HttpError(403, "ADMIN_ACCESS_REQUIRED", "Administrator access is required");
  if (/EXPENSE_VOID_REASON_REQUIRED/i.test(message)) return new HttpError(400, "VOID_REASON_REQUIRED", "Enter a reason to void this expense");
  if (/EXPENSE_ID_REQUIRED/i.test(message)) return new HttpError(400, "EXPENSE_ID_REQUIRED", "Choose an expense to void");
  if (/IDEMPOTENCY_KEY_REQUIRED/i.test(message)) return new HttpError(400, "IDEMPOTENCY_KEY_REQUIRED", "A request key is required; please try again");
  if (/EXPENSE_DATE_REQUIRED/i.test(message)) return new HttpError(400, "EXPENSE_DATE_REQUIRED", "Enter the expense date");
  if (/INVALID_EXPENSE_CATEGORY/i.test(message)) return new HttpError(400, "INVALID_EXPENSE_CATEGORY", "Enter a category (up to 120 characters)");
  if (/INVALID_EXPENSE_PAYEE/i.test(message)) return new HttpError(400, "INVALID_EXPENSE_PAYEE", "Enter a payee (up to 240 characters)");
  if (/INVALID_EXPENSE_AMOUNT/i.test(message)) return new HttpError(400, "INVALID_EXPENSE_AMOUNT", "Enter a positive amount with up to two decimal places");
  if (/INVALID_EXPENSE_STATUS/i.test(message)) return new HttpError(400, "INVALID_EXPENSE_STATUS", "Choose paid or unpaid status");
  if (/INVALID_EXPENSE_PAYMENT_METHOD/i.test(message)) return new HttpError(400, "INVALID_EXPENSE_PAYMENT_METHOD", "Choose a valid payment method for a paid expense");
  if (/INVALID_EXPENSE_NOTES/i.test(message)) return new HttpError(400, "INVALID_EXPENSE_NOTES", "Notes must be 2,000 characters or fewer");
  return new HttpError(500, "EXPENSES_REQUEST_FAILED", "The expenses request could not be completed");
}

function errorResponse(error: unknown) {
  if (error instanceof HttpError) return NextResponse.json({ code: error.code, error: error.message }, { status: error.status });
  const mapped = friendlyRpcError((error || {}) as SupabaseError);
  return NextResponse.json({ code: mapped.code, error: mapped.message }, { status: mapped.status });
}

export async function GET(request: Request) {
  try {
    const supabase = adminClient();
    await requireAdmin(request, supabase);
    const search = new URL(request.url).searchParams;
    const rawLimit = search.get("limit") ?? "25";
    const rawOffset = search.get("offset") ?? "0";
    if (!/^\d+$/.test(rawLimit) || !/^\d+$/.test(rawOffset)) invalid("INVALID_PAGINATION", "Page size and offset must be whole numbers");
    const limit = Number(rawLimit);
    const offset = Number(rawOffset);
    if (limit < 1 || limit > 100 || !Number.isSafeInteger(offset) || offset < 0) invalid("INVALID_PAGINATION", "Page size must be 1–100 and offset cannot be negative");

    const [entriesResult, countResult, metricsResult] = await Promise.all([
      supabase.rpc("get_admin_expenses", { p_limit: limit, p_offset: offset }),
      supabase.rpc("get_admin_expense_count"),
      supabase.rpc("get_admin_expense_metrics"),
    ]);
    if (entriesResult.error) throw entriesResult.error;
    if (countResult.error) throw countResult.error;
    if (metricsResult.error) throw metricsResult.error;
    const countRow = rpcRow(countResult.data);
    const metricsRow = rpcRow(metricsResult.data);
    return NextResponse.json({
      entries: entriesResult.data || [],
      totalCount: Number(countRow?.total_count || 0),
      metrics: metricsRow || {},
      limit,
      offset,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const supabase = adminClient();
    const actor = await requireAdmin(request, supabase);
    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      invalid("INVALID_JSON", "Request body must be valid JSON");
    }
    if (!body || typeof body !== "object" || Array.isArray(body)) invalid("INVALID_REQUEST", "Request body must be an object");

    const action = body.action;
    const idempotencyKey = uuid(body.idempotency_key, "idempotency_key");
    let data: unknown;
    if (action === "record") {
      const date = expenseDate(body.expense_date);
      const category = text(body.category, "category", 120, true)!;
      const payee = text(body.payee, "payee", 240, true)!;
      const amountValue = amount(body.amount);
      const status = expenseStatus(body.status);
      const method = paymentMethod(body.payment_method, status);
      const notes = text(body.notes, "notes", 2000, false);
      const result = await supabase.rpc("record_admin_expense", {
        p_expense_date: date,
        p_category: category,
        p_payee: payee,
        p_amount: amountValue,
        p_status: status,
        p_payment_method: method,
        p_notes: notes,
        p_idempotency_key: idempotencyKey,
        p_actor: actor.id,
      });
      if (result.error) throw result.error;
      data = result.data;
    } else if (action === "void") {
      const expenseId = uuid(body.expense_id, "expense_id");
      const reason = text(body.reason, "void_reason", 2000, true)!;
      const result = await supabase.rpc("void_admin_expense", {
        p_expense_id: expenseId,
        p_reason: reason,
        p_idempotency_key: idempotencyKey,
        p_actor: actor.id,
      });
      if (result.error) throw result.error;
      data = result.data;
    } else {
      invalid("INVALID_ACTION", "Action must be record or void");
    }
    const entry = rpcRow(data);
    if (!entry) throw new HttpError(500, "EXPENSES_REQUEST_FAILED", "The expenses service returned no entry");
    return NextResponse.json({ ok: true, replayed: Boolean(entry.replayed), entry }, { status: entry.replayed ? 200 : 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

// Ledger entries are append-only. Voiding is the only supported correction; no PUT/PATCH/DELETE handlers.
