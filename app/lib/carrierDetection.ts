export type CarrierType = "fedex" | "ups" | "dhl" | "usps" | "amazon" | "shein" | "unknown";

export interface CarrierInfo {
  carrier: CarrierType;
  trackingNumber: string;
  confidence: number;
  serviceLevel?: string;
}

function isValidUpsCheckDigit(value: string): boolean {
  if (!/^1Z[A-Z0-9]{16}$/.test(value)) return false;
  const body = value.slice(2, -1);
  const checkDigit = Number(value[value.length - 1]);
  let sum = 0;
  for (let index = body.length - 1, weight = 2; index >= 0; index--, weight = weight === 2 ? 1 : 2) {
    const code = body.charCodeAt(index);
    const numericValue = code >= 48 && code <= 57
      ? code - 48
      : ((code - 65 + 2) % 10);
    sum += numericValue * weight;
  }
  return (10 - (sum % 10)) % 10 === checkDigit;
}

/** Detect a carrier from the contents returned by a barcode scanner. */
export function detectCarrier(barcode: string): CarrierInfo {
  // Scanners may return the whole label text, including spaces, hyphens,
  // or text such as "UPS GROUND TRACKING #:" around the actual number.
  const cleanBarcode = barcode.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");

  // UPS: extract the standard 1Z format even when it is embedded in label text.
  const upsMatch = cleanBarcode.match(/1Z[A-Z0-9]{16}/);
  if (upsMatch) {
    const trackingNumber = upsMatch[0];
    return {
      carrier: "ups",
      trackingNumber,
      confidence: isValidUpsCheckDigit(trackingNumber) ? 99 : 90,
      serviceLevel: cleanBarcode.includes("UPSGROUND") ? "UPS Ground" : undefined,
    };
  }

  // USPS: preserve the complete 20–22 digit tracking number. Some scanner
  // payloads contain extra label text, so extract the full USPS sequence.
  const uspsMatch = cleanBarcode.match(/(?:92|93|94|95)\d{18,20}/);
  if (uspsMatch) {
    return { carrier: "usps", trackingNumber: uspsMatch[0], confidence: 96 };
  }
  if (/^[A-Z]{2}\d{9}US$/.test(cleanBarcode)) {
    return { carrier: "usps", trackingNumber: cleanBarcode, confidence: 92 };
  }

  // FedEx: the shipping label can encode a longer carrier barcode, while the
  // customer-facing tracking number is the final 12 digits (for example,
  // 8767 4172 2731 -> 876741722731).
  if (/^(?:749[0-9]|96[0-9]{2})\d{8}$/.test(cleanBarcode)) {
    return { carrier: "fedex", trackingNumber: cleanBarcode.slice(-12), confidence: 88 };
  }
  if (/^\d{15}$|^\d{20}$|^\d{22}$/.test(cleanBarcode)) {
    return { carrier: "fedex", trackingNumber: cleanBarcode.slice(-12), confidence: 70 };
  }
  const trailingFedexDigits = cleanBarcode.match(/(\d{12})$/)?.[1];
  if (trailingFedexDigits && (/^96/.test(cleanBarcode) || barcode.toUpperCase().includes("FEDEX"))) {
    return { carrier: "fedex", trackingNumber: trailingFedexDigits, confidence: 82 };
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
