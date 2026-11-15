export function isInvoiceOnlyShipment(shipment: {
  tipo_paquete?: string | null;
  nombre_paqueteria?: string | null;
}): boolean {
  const type = String(shipment.tipo_paquete || "").trim().toUpperCase();
  const carrier = String(shipment.nombre_paqueteria || "").trim().toLowerCase();
  return type === "MANUAL_INVOICE" || carrier === "manual invoice";
}
