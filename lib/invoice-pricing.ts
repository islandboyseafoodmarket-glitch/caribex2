// The 15% charge is a handling fee. Legacy billing_tax and tax_enabled fields
// remain in the database/API for compatibility; they do not represent sales tax.
export const HANDLING_FEE_RATE = 0.15;
/** @deprecated Use HANDLING_FEE_RATE. Retained for existing integrations. */
export const SALES_TAX_RATE = HANDLING_FEE_RATE;
export const INVOICE_DISCOUNT_RATE = 0.10;
export const CUBIC_FOOT_RATE = 18.5;
export const CONSOLIDATION_UNIT_PRICE = 2.5;

export const INVOICE_DISCOUNTS = {
  discount_10: { label: "Discount (10%)", scope: "invoice", rate: 0.10 },
  discount_15: { label: "Discount (15%)", scope: "invoice", rate: 0.15 },
  business_discount: { label: "Business Discount (10%)", scope: "invoice", rate: 0.10 },
  vip_discount: { label: "VIP Discount (25%)", scope: "invoice", rate: 0.25 },
  customer_appreciation: { label: "Customer Appreciation (10%)", scope: "invoice", rate: 0.10 },
  ferry_charge_offset: { label: "Ferry Charge Offset (10%)", scope: "shipping", rate: 0.10 },
} as const;

export type InvoiceDiscountCode = keyof typeof INVOICE_DISCOUNTS;

export type BillableInvoiceItem = {
  id: string;
  label: string;
  unitPrice: number;
  unit: string;
};

/** Internal invoice catalog only. This is not used by the public marketing pages. */
export const BILLABLE_INVOICE_ITEMS: BillableInvoiceItem[] = [
  { id: "consolidation", label: "Consolidation", unitPrice: CONSOLIDATION_UNIT_PRICE, unit: "consolidate" },
  { id: "washer-dryer-stove", label: "Washer / dryer / stove", unitPrice: 350, unit: "item" },
  { id: "standard-refrigerator", label: "Standard refrigerator", unitPrice: 425, unit: "item" },
  { id: "dishwasher", label: "Dishwasher", unitPrice: 295, unit: "item" },
  { id: "bin-16-gallon", label: "16-gallon bin", unitPrice: 40, unit: "bin" },
  { id: "bin-17-gallon", label: "17-gallon bin", unitPrice: 45, unit: "bin" },
  { id: "bin-18-gallon", label: "18-gallon bin", unitPrice: 47.5, unit: "bin" },
  { id: "bin-19-gallon", label: "19-gallon bin", unitPrice: 50, unit: "bin" },
  { id: "bin-20-gallon", label: "20-gallon bin", unitPrice: 55, unit: "bin" },
  { id: "bin-27-gallon", label: "27-gallon bin", unitPrice: 90, unit: "bin" },
  { id: "bin-30-gallon", label: "30-gallon bin", unitPrice: 95, unit: "bin" },
  { id: "bin-38-gallon", label: "38-gallon bin", unitPrice: 120, unit: "bin" },
  { id: "bin-40-gallon", label: "40-gallon bin", unitPrice: 128, unit: "bin" },
  { id: "bin-45-gallon-barrel", label: "45-gallon bin / barrel", unitPrice: 132, unit: "bin / barrel" },
  { id: "bin-50-gallon", label: "50-gallon bin", unitPrice: 140, unit: "bin" },
  { id: "bin-55-gallon", label: "55-gallon bin", unitPrice: 150, unit: "bin" },
  { id: "bin-60-gallon", label: "60-gallon bin", unitPrice: 160, unit: "bin" },
  { id: "bin-65-gallon", label: "65-gallon bin", unitPrice: 165, unit: "bin" },
  { id: "bin-70-gallon", label: "70-gallon bin", unitPrice: 170, unit: "bin" },
  { id: "bin-77-gallon", label: "77-gallon bin", unitPrice: 180, unit: "bin" },
  { id: "wire-14-2-250ft", label: "250 ft of 14/2 wire", unitPrice: 30, unit: "roll" },
  { id: "wire-12-2-250ft", label: "250 ft of 12/2 wire", unitPrice: 30, unit: "roll" },
  { id: "wire-14-3-250ft", label: "250 ft of 14/3 wire", unitPrice: 30, unit: "roll" },
  { id: "wire-10-2-250ft", label: "250 ft of 10/2 wire", unitPrice: 35, unit: "roll" },
  { id: "tv-24-30", label: "24–30 inch TV", unitPrice: 50, unit: "TV" },
  { id: "tv-32", label: "32 inch TV", unitPrice: 65, unit: "TV" },
  { id: "tv-40", label: "40 inch TV", unitPrice: 75, unit: "TV" },
  { id: "tv-43", label: "43 inch TV", unitPrice: 95, unit: "TV" },
  { id: "tv-50", label: "50 inch TV", unitPrice: 150, unit: "TV" },
  { id: "tv-55", label: "55 inch TV", unitPrice: 165, unit: "TV" },
  { id: "tv-65", label: "65 inch TV", unitPrice: 185, unit: "TV" },
  { id: "tv-70", label: "70 inch TV", unitPrice: 205, unit: "TV" },
  { id: "tv-75", label: "75 inch TV", unitPrice: 230, unit: "TV" },
  { id: "tv-85", label: "85 inch TV", unitPrice: 285, unit: "TV" },
];

export function roundMoney(value: number): number {
  return Number.isFinite(value) ? Number(value.toFixed(2)) : 0;
}

export function formatCatalogCharge(item: BillableInvoiceItem, quantity: number): string {
  const amount = roundMoney(item.unitPrice * quantity);
  const quantityLabel = quantity === 1 ? "" : ` × ${quantity}`;
  return `${item.label}${quantityLabel} (+$${amount.toFixed(2)})`;
}

export function parseInvoiceChargeLine(label: string): { description: string; amount: number } {
  const value = String(label || "").trim();
  const amountMatch = value.match(/\s*\(([+-])\s*\$\s*([\d,]+(?:\.\d{1,2})?)\)\s*$/);
  if (amountMatch && amountMatch.index !== undefined) {
    const amount = Number(amountMatch[2].replaceAll(",", ""));
    return {
      description: value.slice(0, amountMatch.index).trim() || value,
      amount: roundMoney(amountMatch[1] === "-" ? -amount : amount),
    };
  }

  const legacyAmountMatch = value.match(/\s*\(\$\s*([\d,]+(?:\.\d{1,2})?)\)\s*$/);
  if (legacyAmountMatch && legacyAmountMatch.index !== undefined) {
    const amount = Number(legacyAmountMatch[1].replaceAll(",", ""));
    return {
      description: value.slice(0, legacyAmountMatch.index).trim() || value,
      amount: roundMoney(amount),
    };
  }

  return { description: value, amount: 0 };
}

export function formatInvoiceDiscountLine(code: InvoiceDiscountCode, amount: number): string {
  const definition = INVOICE_DISCOUNTS[code];
  return `${definition.label} (-$${roundMoney(Math.abs(amount)).toFixed(2)})`;
}

export function parseInvoiceDiscountLine(label: string): { code: InvoiceDiscountCode; label: string; amount: number } | null {
  const parsed = parseInvoiceChargeLine(label);
  if (parsed.amount >= 0) return null;
  const normalizedDescription = parsed.description.replace(/\s+/g, " ").trim().toLowerCase();
  const legacyCodeByDescription: Partial<Record<string, InvoiceDiscountCode>> = {
    discount: "discount_10",
    "discount (10%)": "discount_10",
    "business discount": "business_discount",
    "customer appreciation": "customer_appreciation",
    "ferry charge offset": "ferry_charge_offset",
    "vip discount": "vip_discount",
  };
  const legacyCode = legacyCodeByDescription[normalizedDescription] || null;
  const match = legacyCode
    ? [legacyCode, INVOICE_DISCOUNTS[legacyCode]] as const
    : (Object.entries(INVOICE_DISCOUNTS) as [InvoiceDiscountCode, (typeof INVOICE_DISCOUNTS)[InvoiceDiscountCode]][])
      .find(([, definition]) => definition.label.toLowerCase() === normalizedDescription);
  return match ? { code: match[0], label: match[1].label, amount: roundMoney(Math.abs(parsed.amount)) } : null;
}
