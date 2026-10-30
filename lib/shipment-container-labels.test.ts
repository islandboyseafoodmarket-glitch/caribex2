import assert from "node:assert/strict";
import {
  fetchPagedShipmentRows,
  resolveShipmentContainerLabels,
  type ShipmentCheckinRow,
  type ShipmentContainerLinkRow,
} from "./shipment-container-labels";

const checkin = (paquete_id: string, parent_box_id: string | null, creado_en: string, id: string): ShipmentCheckinRow => ({
  id,
  paquete_id,
  parent_box_id,
  creado_en,
});

const labels = (result: ReturnType<typeof resolveShipmentContainerLabels>, id: string) => result.labelsByPackage.get(id) || [];

export async function runShipmentContainerLabelTests(): Promise<void> {
  const links: ShipmentContainerLinkRow[] = [
    { paquete_id: "direct", contenedor_id: "c1" },
    { paquete_id: "direct", contenedor_id: "c1" },
    { paquete_id: "direct", contenedor_id: "c2" },
    { paquete_id: "parent", contenedor_id: "c3" },
    { paquete_id: "outside", contenedor_id: "c4" },
  ];
  const checkins: ShipmentCheckinRow[] = [
    checkin("parent-only", "parent", "2026-01-01T00:00:00Z", "parent-only-1"),
    checkin("multi-level", "parent-only", "2026-01-01T00:00:00Z", "multi-level-1"),
    checkin("outside-root", "outside", "2026-01-01T00:00:00Z", "outside-root-1"),
    checkin("cleared", "parent", "2026-01-01T00:00:00Z", "cleared-old"),
    checkin("cleared", null, "2026-02-01T00:00:00Z", "cleared-new"),
    checkin("cycle-a", "cycle-b", "2026-01-01T00:00:00Z", "cycle-a-1"),
    checkin("cycle-b", "cycle-a", "2026-01-01T00:00:00Z", "cycle-b-1"),
  ];
  const result = resolveShipmentContainerLabels(
    ["direct", "parent-only", "multi-level", "outside-root", "missing", "cleared", "cycle-a", "cycle-b"],
    links,
    checkins,
    [
      { id: "c1", codigo: "CONT-A" },
      { id: "c2", codigo: "CONT-B" },
      { id: "c3", codigo: "CONT-PARENT" },
      { id: "c4", codigo: "CONT-OUTSIDE" },
    ],
  );

  assert.deepEqual(labels(result, "direct"), ["CONT-A", "CONT-B"]);
  assert.deepEqual(labels(result, "parent-only"), ["CONT-PARENT"]);
  assert.deepEqual(labels(result, "multi-level"), ["CONT-PARENT"]);
  assert.deepEqual(labels(result, "outside-root"), ["CONT-OUTSIDE"]);
  assert.deepEqual(labels(result, "missing"), []);
  assert.deepEqual(labels(result, "cleared"), []);
  assert.deepEqual(labels(result, "cycle-a"), []);
  assert.deepEqual(labels(result, "cycle-b"), []);
  assert.equal(result.insideBoxIds.has("parent-only"), true);
  assert.equal(result.insideBoxIds.has("cleared"), false);

  const pageRows = await fetchPagedShipmentRows(async (offset, limit) => ({
    data: offset === 0 ? Array.from({ length: limit }, (_, index) => index) : [limit],
    error: null,
  }), 1000);
  assert.equal(pageRows.length, 1001);

  await assert.rejects(
    () => fetchPagedShipmentRows(async () => ({ data: [], error: { message: "lookup failed" } }), 500),
    /lookup failed/,
  );
}
