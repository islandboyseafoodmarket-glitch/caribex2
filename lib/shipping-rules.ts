export const DATABASE_STATUS = {
  RECEIVED: "Recibido",
  CHECK_IN: "Registrado",
  IN_TRANSIT: "En tránsito",
  UNLOADED: "Descargado (Roatan)",
  PICKED_UP: "Entregado",
} as const;

export type DatabaseShipmentStatus = (typeof DATABASE_STATUS)[keyof typeof DATABASE_STATUS];

export const FERRY_PORT = {
  LA_CEIBA: "la_ceiba",
  UTILA: "utila",
  GUANAJA: "guanaja",
} as const;

export type FerryPort = (typeof FERRY_PORT)[keyof typeof FERRY_PORT];

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
  if (port.includes("ceiba")) return FERRY_PORT.LA_CEIBA;
  if (port === FERRY_PORT.UTILA) return FERRY_PORT.UTILA;
  if (port === FERRY_PORT.GUANAJA) return FERRY_PORT.GUANAJA;
  return null;
}

export const RECEIVING_STAGE_QUERY = [DATABASE_STATUS.RECEIVED] as const;
export const CHECK_IN_STAGE_QUERY = [DATABASE_STATUS.CHECK_IN, "Check In", "Check-in"] as const;
