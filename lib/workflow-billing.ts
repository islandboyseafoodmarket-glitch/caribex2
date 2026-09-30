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
  if (extras.includes("Consolidation fee ($2.5)")) extrasAmount += 2.5;
  if (extras.includes("Forklift charge ($100)")) extrasAmount += 100;
  if (extras.includes("Miscellaneous fee ($10)")) extrasAmount += 10;
  const handlingCharge = extras.includes("Handling fees") ? base * 0.15 : 0;
  return { extrasAmount, handlingCharge };
}

export function calculateWorkflowBilling(input: WorkflowBillingInput): WorkflowBillingResult | null {
  const type = normalized(input.tipo_paquete);
  const isBox = type.includes("BOX") || type.includes("CAJA");
  const isPackage = type.includes("PACKAGE") || type.includes("PAQUETE");
  if (!isBox && !isPackage) return null;

  let base: number;
  let volumeFt3 = 0;
  if (isPackage) {
    base = 18.5;
  } else {
    const height = Number(input.alto);
    const width = Number(input.ancho);
    const length = Number(input.largo);
    if (![height, width, length].every((value) => Number.isFinite(value) && value > 0)) return null;
    volumeFt3 = (length * width * height) / 1728;
    if (!Number.isFinite(volumeFt3) || volumeFt3 <= 0) return null;
    base = volumeFt3 * 18.5;
  }

  const { extrasAmount, handlingCharge } = extrasAndHandling(input.cargos_adicionales, base);
  const subtotal = base + extrasAmount + handlingCharge;
  const tax = subtotal * 0.15;
  const total = subtotal + tax;
  return { subtotal, tax, total, base, volumeFt3 };
}

export function isBox(input: WorkflowBillingInput) {
  const type = normalized(input.tipo_paquete);
  return type.includes("BOX") || type.includes("CAJA");
}
