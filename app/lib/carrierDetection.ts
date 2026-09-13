export type CarrierType = "fedex" | "ups" | "dhl" | "usps" | "amazon" | "shein" | "unknown";

export interface CarrierInfo {
  carrier: CarrierType;
  trackingNumber: string;
  confidence: number;
}

function isValidUpsCheckDigit(value: string): boolean {
  if (!/^1Z[A-Z0-9]{16}$/.test(value)) return false;
  const body = value.slice(2, -1);
  const checkDigit = Number(value[value.length - 1]);
  let sum = 0;
  for (let index = body.length - 1, weight = 2; index >= 0; index--, weight = weight === 2 ? 1 : 2) {
    const code = body.charCodeAt(index);
    const numericValue = code >= 48 && code <= 57 ? code - 48 : code - 55;
    sum += numericValue * weight;
  }
  return (10 - (sum % 10)) % 10 === checkDigit;
}

/** Detect a carrier from the contents returned by a barcode scanner. */
export function detectCarrier(barcode: string): CarrierInfo {
  // Scanners may include spaces or hyphens between barcode groups.
  const cleanBarcode = barcode.trim().toUpperCase().replace(/[\s-]/g, "");

  // UPS: standard 1Z format, including its check digit.
  if (isValidUpsCheckDigit(cleanBarcode)) {
    return { carrier: "ups", trackingNumber: cleanBarcode, confidence: 98 };
  }

  // USPS: numeric formats commonly begin with 92, 93, 94, or 95, or use
  // the international two-letter + nine-digit + US format.
  if (/^(?:92|93|94|95)\d{18,20}$/.test(cleanBarcode) || /^[A-Z]{2}\d{9}US$/.test(cleanBarcode)) {
    return { carrier: "usps", trackingNumber: cleanBarcode, confidence: 92 };
  }

  // FedEx: common barcode lengths are 12, 15, 20, and 22 digits. Twelve
  // digits are only classified with known FedEx prefixes to avoid confusing
  // arbitrary numeric references with FedEx tracking numbers.
  if (/^(?:749[0-9]|96[0-9]{2})\d{8}$/.test(cleanBarcode)) {
    return { carrier: "fedex", trackingNumber: cleanBarcode.slice(-9), confidence: 88 };
  }
  if (/^\d{15}$|^\d{20}$|^\d{22}$/.test(cleanBarcode)) {
    return { carrier: "fedex", trackingNumber: cleanBarcode.slice(-9), confidence: 70 };
  }

  // DHL Express: commonly ten numeric digits. This is intentionally below
  // USPS/FedEx rules because numeric-only formats can overlap.
  if (/^\d{10}$/.test(cleanBarcode)) {
    return { carrier: "dhl", trackingNumber: cleanBarcode, confidence: 85 };
  }

  // Amazon Logistics: TBA tracking numbers or an explicit Amazon QR payload.
  if (/^TBA\d{10,12}$/.test(cleanBarcode) || cleanBarcode.includes("AMAZON")) {
    return { carrier: "amazon", trackingNumber: cleanBarcode, confidence: 95 };
  }

  // SheIn uses multiple last-mile carriers, so a generic number cannot safely
  // identify it. Explicit SheIn payloads can be recognized.
  if (/^(?:SHEIN|SHIN)[A-Z0-9]{6,}$/.test(cleanBarcode)) {
    return { carrier: "shein", trackingNumber: cleanBarcode, confidence: 90 };
  }

  return { carrier: "unknown", trackingNumber: cleanBarcode, confidence: 0 };
}

/** Validate a tracking number against the selected carrier's known format. */
export function validateTrackingNumber(carrier: CarrierType, trackingNumber: string): boolean {
  const value = trackingNumber.trim().toUpperCase().replace(/[\s-]/g, "");
  if (carrier === "ups") return isValidUpsCheckDigit(value);

  const patterns: Record<CarrierType, RegExp> = {
    ups: /^1Z[A-Z0-9]{16}$/,
    fedex: /^(?:\d{12}|\d{15}|\d{20}|\d{22})$/,
    dhl: /^\d{10}$/,
    usps: /^(?:(?:92|93|94|95)\d{18,20}|[A-Z]{2}\d{9}US)$/,
    amazon: /^(?:TBA\d{10,12}|[A-Z0-9]*AMAZON[A-Z0-9]*)$/,
    shein: /^(?:SHEIN|SHIN)[A-Z0-9]{6,}$/,
    unknown: /^.+$/,
  };

  return patterns[carrier].test(value);
}

export const CARRIER_LABELS: Record<Exclude<CarrierType, "unknown">, string> = {
  amazon: "Amazon logistics",
  ups: "UPS",
  shein: "SheIn",
  fedex: "FedEx",
  dhl: "DHL",
  usps: "USPS",
};
