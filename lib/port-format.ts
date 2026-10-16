const CANONICAL_PORT_LABELS: Record<string, string> = {
  la_ceiba: "La Ceiba",
  utila: "Utila",
  guanaja: "Guanaja",
  roatan: "Roatán",
  roatán: "Roatán",
  puerto_cortes: "Puerto Cortés",
  puerto_cortés: "Puerto Cortés",
  puerto_lempira: "Puerto Lempira",
  san_pedro_sula: "San Pedro Sula",
  tegucigalpa: "Tegucigalpa",
  trujillo: "Trujillo",
  miami: "Miami",
  houston: "Houston",
  los_angeles: "Los Angeles",
};

function portKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[–—]/g, "-")
    .replace(/[\s-]+/g, "_");
}

/** Format a stored port key/value for display only. */
export function formatPortName(value: unknown, fallback = "—"): string {
  if (typeof value !== "string" || !value.trim()) return fallback;
  const trimmed = value.trim();
  const canonical = CANONICAL_PORT_LABELS[portKey(trimmed)];
  if (canonical) return canonical;
  return trimmed
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

/** Display an account number with its port prefix; Roatán accounts stay numeric. */
export function formatAccountNumber(value: unknown, port: unknown, fallback = "—"): string {
  if (value == null || String(value).trim() === "") return fallback;
  const number = String(value).trim();
  const normalizedPort = portKey(String(port || ""));
  if (!normalizedPort || normalizedPort === "roatan" || normalizedPort === "roatán") return number;
  const label = formatPortName(port, "");
  const prefix = label.trim().charAt(0).toUpperCase();
  return prefix ? `${prefix}-${number}` : number;
}
