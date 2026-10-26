import type { CSSProperties } from "react";

export type ShipmentStageColor = { color: string; background: string; border: string };

// Track Package is the canonical palette for stage and selected-tab colors.
export const SHIPMENT_STAGE_COLORS: Record<string, ShipmentStageColor> = {
  RECEIVED: { color: "#475569", background: "#f1f5f9", border: "#cbd5e1" },
  REGISTERED: { color: "#15803d", background: "#f0fdf4", border: "#86efac" },
  IN_TRANSIT: { color: "#0f766e", background: "#f0fdfa", border: "#5eead4" },
  UNLOADED: { color: "#b45309", background: "#fffbeb", border: "#fcd34d" },
  PICKED_UP: { color: "#7e22ce", background: "#faf5ff", border: "#d8b4fe" },
};

export const WORKFLOW_STAGE_COLORS: Record<string, ShipmentStageColor> = {
  RECEIVED: SHIPMENT_STAGE_COLORS.RECEIVED,
  RECIBIDO_FLORIDA: SHIPMENT_STAGE_COLORS.RECEIVED,
  CHECK_IN: SHIPMENT_STAGE_COLORS.REGISTERED,
  REGISTRO: SHIPMENT_STAGE_COLORS.REGISTERED,
  IN_TRANSIT: SHIPMENT_STAGE_COLORS.IN_TRANSIT,
  EN_TRANSITO: SHIPMENT_STAGE_COLORS.IN_TRANSIT,
  UNLOADED: SHIPMENT_STAGE_COLORS.UNLOADED,
  DESCARGADO_ROATAN: SHIPMENT_STAGE_COLORS.UNLOADED,
  PICKED_UP: SHIPMENT_STAGE_COLORS.PICKED_UP,
  PASTILLA: SHIPMENT_STAGE_COLORS.PICKED_UP,
  FACTURAS: SHIPMENT_STAGE_COLORS.UNLOADED,
};

export const NAV_SECTION_COLORS = {
  operations: SHIPMENT_STAGE_COLORS.RECEIVED,
  customers: SHIPMENT_STAGE_COLORS.REGISTERED,
  billing: SHIPMENT_STAGE_COLORS.UNLOADED,
  admin: SHIPMENT_STAGE_COLORS.PICKED_UP,
  tools: SHIPMENT_STAGE_COLORS.IN_TRANSIT,
};

export const INVOICE_FILTER_COLORS: Record<string, ShipmentStageColor> = {
  all: SHIPMENT_STAGE_COLORS.RECEIVED,
  pending: SHIPMENT_STAGE_COLORS.RECEIVED,
  approved: SHIPMENT_STAGE_COLORS.REGISTERED,
  sent: SHIPMENT_STAGE_COLORS.IN_TRANSIT,
  paid: SHIPMENT_STAGE_COLORS.PICKED_UP,
  problems: SHIPMENT_STAGE_COLORS.UNLOADED,
};

export function tabColorStyle(palette: ShipmentStageColor): CSSProperties {
  return {
    "--tab-color": palette.color,
    "--tab-tint": palette.background,
    "--tab-border": palette.border,
  } as CSSProperties;
}
