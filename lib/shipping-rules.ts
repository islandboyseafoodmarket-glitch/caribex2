export const DATABASE_STATUS = {
  RECEIVED: "Recibido",
  CHECK_IN: "Registrado",
  IN_TRANSIT: "En tránsito",
  UNLOADED: "Descargado",
  PICKED_UP: "Entregado",
} as const;

export type DatabaseShipmentStatus = (typeof DATABASE_STATUS)[keyof typeof DATABASE_STATUS];

export const FERRY_PORT = {
  LA_CEIBA: "la_ceiba",
  UTILA: "utila",
  GUANAJA: "guanaja",
  SAN_PEDRO_SULA: "san_pedro_sula",
  TEGUCIGALPA: "tegucigalpa",
} as const;

export type FerryPort = (typeof FERRY_PORT)[keyof typeof FERRY_PORT];

export const FERRY_PORT_ORDER: FerryPort[] = [
  FERRY_PORT.LA_CEIBA,
  FERRY_PORT.UTILA,
  FERRY_PORT.GUANAJA,
  FERRY_PORT.SAN_PEDRO_SULA,
  FERRY_PORT.TEGUCIGALPA,
];

export const FERRY_PORT_LABELS: Record<FerryPort, string> = {
  [FERRY_PORT.LA_CEIBA]: "La Ceiba",
  [FERRY_PORT.UTILA]: "Utila",
  [FERRY_PORT.GUANAJA]: "Guanaja",
  [FERRY_PORT.SAN_PEDRO_SULA]: "San Pedro Sula",
  [FERRY_PORT.TEGUCIGALPA]: "Tegucigalpa",
};

export function normalizeStatus(value: unknown) {
  return String(value || "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function statusMatches(value: unknown, expected: DatabaseShipmentStatus) {
  const actual = normalizeStatus(value);
  const target = normalizeStatus(expected);
  if (expected === DATABASE_STATUS.UNLOADED) return actual.startsWith("descargado");
  return actual === target;
}

export function normalizeFerryPort(value: unknown): FerryPort | null {
  const port = String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  if (port.includes("san pedro") || port.includes("san-pedro") || port.includes("san_pedro")) return FERRY_PORT.SAN_PEDRO_SULA;
  if (port.includes("tegucigalpa")) return FERRY_PORT.TEGUCIGALPA;
  if (port.includes("ceiba")) return FERRY_PORT.LA_CEIBA;
  if (port.includes("utila")) return FERRY_PORT.UTILA;
  if (port.includes("guanaja")) return FERRY_PORT.GUANAJA;
  return null;
}

export const RECEIVING_STAGE_QUERY = [DATABASE_STATUS.RECEIVED] as const;
// A newly received shipment remains `Recibido` until staff completes the
// individual Check In action. Keep legacy Check In spellings readable too.
export const CHECK_IN_STAGE_QUERY = [DATABASE_STATUS.RECEIVED, DATABASE_STATUS.CHECK_IN, "Check In", "Check-in"] as const;
// Never let the bulk In-Transit action skip the individual Check In step.
export const IN_TRANSIT_STAGE_QUERY = [DATABASE_STATUS.CHECK_IN, "Check In", "Check-in"] as const;
