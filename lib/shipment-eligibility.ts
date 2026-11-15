type PickupRow = {
  tipo_paquete?: string | null;
  nombre_paqueteria?: string | null;
  estado?: string | null;
  fecha_entregado?: string | null;
  hora_entregado?: string | null;
};

function normalized(value: unknown): string {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim().replace(/[\s_-]+/g, " ");
}

export function isInvoiceOnlyShipment(shipment: PickupRow): boolean {
  return String(shipment.tipo_paquete || "").trim().toUpperCase() === "MANUAL_INVOICE" || normalized(shipment.nombre_paqueteria) === "manual invoice";
}

export function isArchivedShipment(shipment: PickupRow): boolean {
  return ["archivado", "archived"].includes(normalized(shipment.estado));
}

export function isPickedUpShipment(shipment: PickupRow): boolean {
  const status = normalized(shipment.estado);
  return Boolean(shipment.fecha_entregado || shipment.hora_entregado) ||
    ["entregado", "picked up", "recogido", "collected", "delivered"].some((prefix) => status.startsWith(prefix));
}

export function isReadyForPickupShipment(shipment: PickupRow): boolean {
  if (isInvoiceOnlyShipment(shipment) || isArchivedShipment(shipment) || isPickedUpShipment(shipment)) return false;
  const status = normalized(shipment.estado);
  return ["descargado", "unloaded", "ready for pickup"].some((prefix) => status.startsWith(prefix));
}

export function isInTransitShipment(shipment: PickupRow): boolean {
  if (isInvoiceOnlyShipment(shipment) || isArchivedShipment(shipment) || isPickedUpShipment(shipment)) return false;
  const status = normalized(shipment.estado);
  return status.includes("transito") || status.includes("transit");
}
