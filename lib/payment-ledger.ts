export const PAYMENT_METHODS = [
  "Zelle",
  "PayPal",
  "Cash",
  "Bank Transfer",
  "Wire",
  "Credit granted",
] as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
export type LedgerEntryType = "PAYMENT" | "REVERSAL";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_AMOUNT_CENTS = 9_999_999_999_999;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

export function parseUuid(value: unknown, field: string): string {
  if (!isUuid(value)) throw new PaymentInputError(`${field} must be a valid UUID`);
  return value;
}

export function parsePaymentDate(value: unknown, field = "payment_date", optional = true): string | null {
  if (value == null || value === "") {
    if (optional) return null;
    throw new PaymentInputError(`${field} is required`);
  }
  if (typeof value !== "string" || !DATE_RE.test(value)) {
    throw new PaymentInputError(`${field} must be an ISO date (YYYY-MM-DD)`);
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new PaymentInputError(`${field} must be a valid calendar date`);
  }
  return value;
}

/** Parse money without binary floating-point rounding. Returns integer USD cents. */
export function parseAmountCents(value: unknown): number {
  const text = typeof value === "number" && Number.isFinite(value) ? String(value) : typeof value === "string" ? value.trim() : "";
  if (!/^\d+(?:\.\d{1,2})?$/.test(text)) {
    throw new PaymentInputError("amount must be a positive USD amount with at most two decimals");
  }
  const [whole, fraction = ""] = text.split(".");
  const cents = Number(`${whole}${fraction.padEnd(2, "0")}`);
  if (!Number.isSafeInteger(cents) || cents <= 0 || cents > MAX_AMOUNT_CENTS) {
    throw new PaymentInputError("amount is outside the supported USD range");
  }
  return cents;
}

export function centsToAmount(cents: number): number {
  return cents / 100;
}

export function parsePaymentMethod(value: unknown): PaymentMethod {
  if (typeof value !== "string") throw new PaymentInputError("method is required");
  const match = PAYMENT_METHODS.find((method) => method.toLowerCase() === value.trim().toLowerCase());
  if (!match) throw new PaymentInputError(`method must be one of: ${PAYMENT_METHODS.join(", ")}`);
  return match;
}

export function optionalText(value: unknown, field: string, maxLength = 2000): string | null {
  if (value == null || value === "") return null;
  if (typeof value !== "string") throw new PaymentInputError(`${field} must be text`);
  const text = value.trim();
  if (text.length > maxLength) throw new PaymentInputError(`${field} is too long`);
  return text || null;
}

export class PaymentInputError extends Error {
  readonly status = 400;
  constructor(message: string) {
    super(message);
    this.name = "PaymentInputError";
  }
}

export type PaymentLedgerEntry = {
  id: string;
  invoice_id: string;
  entry_type: LedgerEntryType;
  amount: number | string;
  method: PaymentMethod | null;
  reference: string | null;
  notes: string | null;
  payment_date: string | null;
  created_by: string | null;
  created_at: string;
  original_payment_id: string | null;
  idempotency_key: string;
  is_legacy: boolean;
};

export type PaymentSummary = {
  invoice_id: string;
  billing_total: number | string | null;
  paid: number | string;
  balance: number | string;
  invoice_status: string | null;
};
