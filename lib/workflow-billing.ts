import {
  CUBIC_FOOT_RATE,
  HANDLING_FEE_RATE,
  parseInvoiceChargeLine,
  roundMoney,
} from "./invoice-pricing";

export type WorkflowBillingInput = {
  tipo_paquete?: unknown;
  alto?: unknown;
  ancho?: unknown;
  largo?: unknown;
  cargos_adicionales?: unknown;
};

export type WorkflowBillingResult = {
  subtotal: number;
  tax: number;
  total: number;
  base: number;
  volumeFt3: number;
};

function normalized(value: unknown) {
  return String(value || "").trim().toUpperCase();
}

function extrasAndHandling(raw: unknown, base: number) {
  const extras = String(raw || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  let extrasAmount = 0;
  let handlingCharge = 0;

  for (const extra of extras) {
    const parsed = parseInvoiceChargeLine(extra);
    if (parsed.description === "Handling fees" && parsed.amount === 0) {
      handlingCharge += base * HANDLING_FEE_RATE;
      continue;
    }
    extrasAmount += parsed.amount;
  }

  return { extrasAmount, handlingCharge };
}

export function calculateWorkflowBilling(input: WorkflowBillingInput): WorkflowBillingResult | null {
  const type = normalized(input.tipo_paquete);
  const isBoxItem = type.includes("BOX") || type.includes("CAJA");
  const isPackage = type.includes("PACKAGE") || type.includes("PAQUETE");
  if (!isBoxItem && !isPackage) return null;

  let base: number;
  let volumeFt3 = 0;
  if (isPackage) {
    base = CUBIC_FOOT_RATE;
  } else {
    const height = Number(input.alto);
    const width = Number(input.ancho);
    const length = Number(input.largo);
    if (![height, width, length].every((value) => Number.isFinite(value) && value > 0)) return null;
    volumeFt3 = (length * width * height) / 1728;
    if (!Number.isFinite(volumeFt3) || volumeFt3 <= 0) return null;
    base = volumeFt3 * CUBIC_FOOT_RATE;
  }

  const { extrasAmount, handlingCharge } = extrasAndHandling(input.cargos_adicionales, base);
  const subtotal = roundMoney(base + extrasAmount + handlingCharge);
  const tax = roundMoney(subtotal * HANDLING_FEE_RATE);
  const total = roundMoney(subtotal + tax);
  return { subtotal, tax, total, base, volumeFt3 };
}

export function isBox(input: WorkflowBillingInput) {
  const type = normalized(input.tipo_paquete);
  return type.includes("BOX") || type.includes("CAJA");
}
