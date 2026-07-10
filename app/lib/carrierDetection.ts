export type CarrierType = "fedex" | "ups" | "dhl" | "usps" | "amazon" | "unknown";

export interface CarrierInfo {
  carrier: CarrierType;
  trackingNumber: string;
  confidence: number; // 0-100
}

/**
 * Detect carrier from barcode/tracking number
 */
export function detectCarrier(barcode: string): CarrierInfo {
  const cleanBarcode = barcode.trim().toUpperCase();

  // UPS: Starts with 1Z, followed by 16 characters
  if (/^1Z[A-Z0-9]{16}$/.test(cleanBarcode)) {
    return {
      carrier: "ups",
      trackingNumber: cleanBarcode,
      confidence: 95,
    };
  }

  // FedEx: 12 digits, specific prefixes
  if (/^\d{12}$/.test(cleanBarcode)) {
    const prefix = cleanBarcode.substring(0, 4);
    // FedEx typically uses 7490, 7491, 7492, etc.
    if (["7490", "7491", "7492", "7493", "7494"].includes(prefix)) {
      return {
        carrier: "fedex",
        trackingNumber: cleanBarcode,
        confidence: 90,
      };
    }
  }

  // DHL: 10 digits
  if (/^\d{10}$/.test(cleanBarcode)) {
    return {
      carrier: "dhl",
      trackingNumber: cleanBarcode,
      confidence: 85,
    };
  }

  // USPS: 20-22 digits, starts with 94
  if (/^94\d{18,20}$/.test(cleanBarcode)) {
    return {
      carrier: "usps",
      trackingNumber: cleanBarcode,
      confidence: 92,
    };
  }

  // Amazon: QR code pattern (contains specific markers)
  if (cleanBarcode.includes("AMAZON") || /^[A-Z0-9]{15,}$/.test(cleanBarcode)) {
    return {
      carrier: "amazon",
      trackingNumber: cleanBarcode,
      confidence: 80,
    };
  }

  // Unknown carrier
  return {
    carrier: "unknown",
    trackingNumber: cleanBarcode,
    confidence: 0,
  };
}

/**
 * Validate tracking number format for detected carrier
 */
export function validateTrackingNumber(carrier: CarrierType, trackingNumber: string): boolean {
  const patterns: Record<CarrierType, RegExp> = {
    ups: /^1Z[A-Z0-9]{16}$/,
    fedex: /^\d{12}$/,
    dhl: /^\d{10}$/,
    usps: /^94\d{18,20}$/,
    amazon: /^[A-Z0-9]{15,}$/,
    unknown: /^.+$/,
  };

  return patterns[carrier].test(trackingNumber.toUpperCase());
}
