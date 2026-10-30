import { NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type ApiError = { status: number; code: string; message: string };
type RpcResult = {
  invoice_id: string;
  tracking: string | null;
  late_fee_amount: number | string;
  billing_subtotal: number | string;
  billing_tax: number | string | null;
  billing_total: number | string;
  paid: number | string;
  balance: number | string;
  invoice_sent_at: string;
};

function serviceClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase server environment variables are missing");
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

function apiError(status: number, code: string, message: string): ApiError {
  return { status, code, message };
}

function mapRpcError(error: { code?: string; message?: string }): ApiError {
  const message = String(error.message || "");
  if (/INVOICE_NOT_FOUND/i.test(message)) return apiError(404, "INVOICE_NOT_FOUND", "Invoice not found");
  if (/INVOICE_SENT_TIMESTAMP_REQUIRED/i.test(message)) return apiError(409, "INVOICE_SENT_TIMESTAMP_REQUIRED", "This invoice has no sent timestamp, so its 30-day overdue period cannot be verified");
  if (/INVOICE_NOT_30_DAYS_OVERDUE/i.test(message)) return apiError(409, "INVOICE_NOT_30_DAYS_OVERDUE", "The invoice must have been sent at least 30 days ago before a late fee can be applied");
  if (/INVOICE_ALREADY_PAID/i.test(message)) return apiError(409, "INVOICE_ALREADY_PAID", "A late fee cannot be applied to a paid invoice");
  if (/INVOICE_NO_OUTSTANDING_BALANCE/i.test(message)) return apiError(409, "INVOICE_NO_OUTSTANDING_BALANCE", "The invoice has no outstanding balance");
  if (/INVOICE_PAYMENT_BALANCE_MISSING/i.test(message)) return apiError(503, "INVOICE_PAYMENT_BALANCE_MISSING", "The invoice payment balance is unavailable; verify the payment-ledger migration");
  if (/INVOICE_CHECKIN_REQUIRED/i.test(message)) return apiError(409, "INVOICE_CHECKIN_REQUIRED", "A check-in record is required before applying a late fee");
  if (/LATE_FEE_ALREADY_APPLIED/i.test(message)) return apiError(409, "LATE_FEE_ALREADY_APPLIED", "A late fee is already recorded for this invoice");
  if (/LATE_FEE_AMOUNT_TOO_SMALL/i.test(message)) return apiError(409, "LATE_FEE_AMOUNT_TOO_SMALL", "The invoice total is too small to produce a late fee of at least one cent");
  if (/INVOICE_TOTAL_REQUIRED/i.test(message)) return apiError(409, "INVOICE_TOTAL_REQUIRED", "The invoice must have a subtotal and total before a late fee can be applied");
  if (/INVOICE_ID_REQUIRED/i.test(message)) return apiError(400, "INVOICE_ID_REQUIRED", "A valid invoice_id is required");

  const code = String(error.code || "").toUpperCase();
  if (["42P01", "42703", "42883", "PGRST202", "PGRST205"].includes(code)
      || /invoice_payment_balances|apply_invoice_late_fee|invoice_sent_at|does not exist/i.test(message)) {
    return apiError(503, "INVOICE_LATE_FEE_MIGRATION_REQUIRED", "The invoice late-fee and payment-ledger migrations must be applied before this operation is available");
  }
  return apiError(500, "INVOICE_LATE_FEE_FAILED", "Could not apply the invoice late fee");
}

function errorResponse(error: ApiError) {
  return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
}

export async function POST(request: Request) {
  let supabase: SupabaseClient;
  try {
    supabase = serviceClient();
  } catch {
    return errorResponse(apiError(500, "SERVER_CONFIGURATION_ERROR", "Supabase server configuration is missing"));
  }

  const authorization = request.headers.get("authorization") || "";
  const bearer = authorization.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  if (!bearer) return errorResponse(apiError(401, "AUTHENTICATION_REQUIRED", "A Bearer access token is required"));

  const { data: authData, error: authError } = await supabase.auth.getUser(bearer);
  if (authError || !authData.user) return errorResponse(apiError(401, "INVALID_AUTHENTICATION", "The supplied access token is invalid or expired"));

  const [{ data: admin, error: adminError }, { data: staff, error: staffError }] = await Promise.all([
    supabase.from("administradores").select("id, rol").eq("id", authData.user.id).maybeSingle(),
    supabase.from("personal").select("id, rol, nombre, nombre_personal, permissions").eq("id", authData.user.id).maybeSingle(),
  ]);
  if (adminError || staffError) {
    return errorResponse(apiError(500, "STAFF_PROFILE_LOOKUP_FAILED", "Could not verify the caller's admin or staff permissions"));
  }
  const isAdmin = Boolean(admin);
  if (!isAdmin) {
    const permissions = staff?.permissions && typeof staff.permissions === "object"
      ? staff.permissions as Record<string, unknown>
      : {};
    if (!staff || permissions.invoice_edit !== true) {
      return errorResponse(apiError(403, "INVOICE_EDIT_PERMISSION_REQUIRED", "Admin access or Staff permission invoice_edit is required"));
    }
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse(apiError(400, "INVALID_JSON", "Request body must be valid JSON"));
  }
  const invoiceId = body && typeof body === "object" ? String((body as { invoice_id?: unknown }).invoice_id ?? "").trim() : "";
  if (!UUID_PATTERN.test(invoiceId)) {
    return errorResponse(apiError(400, "INVALID_INVOICE_ID", "invoice_id must be a valid UUID"));
  }

  // The RPC owns all invoice/check-in/ledger-sensitive work and performs it
  // atomically under the invoice row lock. The route never directly updates them.
  const { data: rpcData, error: rpcError } = await supabase.rpc("apply_invoice_late_fee", { p_invoice_id: invoiceId });
  if (rpcError) return errorResponse(mapRpcError(rpcError));
  const result = (Array.isArray(rpcData) ? rpcData[0] : rpcData) as RpcResult | null;
  if (!result) return errorResponse(apiError(500, "INVOICE_LATE_FEE_EMPTY_RESULT", "The late-fee operation returned no invoice totals"));

  const actorName = isAdmin
    ? "Admin"
    : staff?.nombre || staff?.nombre_personal || authData.user.email || "Staff";
  const { error: auditError } = await supabase.from("staff_action_logs").insert({
    actor_id: authData.user.id,
    actor_name: actorName,
    actor_email: authData.user.email || null,
    actor_role: isAdmin ? "admin" : "staff",
    action: "invoice_late_fee_applied",
    entity_type: "paquetes_registro",
    entity_id: result.invoice_id,
    tracking: result.tracking,
    success: true,
    details: {
      source: "admin_invoice_late_fee_api",
      late_fee_amount: Number(result.late_fee_amount),
      billing_subtotal: Number(result.billing_subtotal),
      billing_tax: result.billing_tax == null ? null : Number(result.billing_tax),
      billing_total: Number(result.billing_total),
      paid: Number(result.paid),
      balance: Number(result.balance),
      invoice_sent_at: result.invoice_sent_at,
    },
    ip_address: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null,
    user_agent: request.headers.get("user-agent") || null,
  });
  if (auditError) {
    return NextResponse.json({
      error: "The late fee was applied, but its staff audit event could not be saved. Do not retry; the invoice already contains the fee.",
      code: "LATE_FEE_AUDIT_FAILED",
      applied: true,
      invoice: result,
    }, { status: 500 });
  }

  return NextResponse.json({ ok: true, invoice: result });
}
