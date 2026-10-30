export const SHIPMENT_LOOKUP_BATCH_SIZE = 100;
export const SHIPMENT_LOOKUP_PAGE_SIZE = 500;

export type ShipmentContainerLinkRow = {
  paquete_id: string | number | null;
  contenedor_id: string | number | null;
};

export type ShipmentCheckinRow = {
  id?: string | number | null;
  paquete_id: string | number | null;
  parent_box_id?: string | number | null;
  alto?: number | null;
  ancho?: number | null;
  largo?: number | null;
  peso?: number | null;
  problema?: boolean | null;
  problema_notas?: string | null;
  cargos_adicionales?: string | null;
  consolidacion?: boolean | null;
  creado_en?: string | null;
  [key: string]: unknown;
};

export type ShipmentContainerRow = {
  id: string | number | null;
  codigo?: string | null;
};

export type ShipmentLookupQueryResult<T> = {
  data: T[] | null;
  error: { message: string } | null;
};

type ShipmentLookupPageFetcher<T> = (
  offset: number,
  limit: number,
) => PromiseLike<ShipmentLookupQueryResult<T>>;

function key(value: unknown): string {
  return String(value ?? "").trim();
}

function nonEmpty(value: unknown): string | null {
  const normalized = key(value);
  return normalized || null;
}

function timestamp(value: unknown): number | null {
  const raw = nonEmpty(value);
  if (!raw) return null;
  const parsed = Date.parse(raw);
  return Number.isNaN(parsed) ? null : parsed;
}

function isNewerCheckin(candidate: ShipmentCheckinRow, current: ShipmentCheckinRow): boolean {
  const candidateTime = timestamp(candidate.creado_en);
  const currentTime = timestamp(current.creado_en);
  if (candidateTime !== null && currentTime !== null && candidateTime !== currentTime) {
    return candidateTime > currentTime;
  }
  if (candidateTime !== null && currentTime === null) return true;
  if (candidateTime === null && currentTime !== null) return false;
  return key(candidate.id) > key(current.id);
}

export function latestCheckinsByPackage(rows: ShipmentCheckinRow[]): Map<string, ShipmentCheckinRow> {
  const latest = new Map<string, ShipmentCheckinRow>();
  for (const row of rows) {
    const packageId = nonEmpty(row.paquete_id);
    if (!packageId) continue;
    const current = latest.get(packageId);
    if (!current || isNewerCheckin(row, current)) latest.set(packageId, row);
  }
  return latest;
}

function dedupe(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const normalized = value.trim();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
  }
  return result;
}

export type ResolvedShipmentContainerLookup = {
  labelsByPackage: Map<string, string[]>;
  insideBoxIds: Set<string>;
};

export function resolveShipmentContainerLabels(
  packageIds: string[],
  links: ShipmentContainerLinkRow[],
  checkins: ShipmentCheckinRow[],
  containers: ShipmentContainerRow[],
): ResolvedShipmentContainerLookup {
  const containerById = new Map<string, string>();
  for (const container of containers) {
    const containerId = nonEmpty(container.id);
    if (!containerId) continue;
    containerById.set(containerId, nonEmpty(container.codigo) || containerId);
  }

  const directContainerIdsByPackage = new Map<string, string[]>();
  for (const link of links) {
    const packageId = nonEmpty(link.paquete_id);
    const containerId = nonEmpty(link.contenedor_id);
    if (!packageId || !containerId) continue;
    const current = directContainerIdsByPackage.get(packageId) || [];
    current.push(containerId);
    directContainerIdsByPackage.set(packageId, current);
  }

  const latestByPackage = latestCheckinsByPackage(checkins);
  const labelsFor = (packageId: string, path: Set<string>): string[] => {
    const directIds = directContainerIdsByPackage.get(packageId) || [];
    if (directIds.length) {
      return dedupe(directIds.map((containerId) => containerById.get(containerId) || containerId));
    }

    if (path.has(packageId)) return [];
    const nextPath = new Set(path);
    nextPath.add(packageId);
    const parentId = nonEmpty(latestByPackage.get(packageId)?.parent_box_id);
    if (!parentId || nextPath.has(parentId)) return [];
    return labelsFor(parentId, nextPath);
  };

  const labelsByPackage = new Map<string, string[]>();
  const insideBoxIds = new Set<string>();
  for (const rawPackageId of packageIds) {
    const packageId = key(rawPackageId);
    if (!packageId) continue;
    const latestCheckin = latestByPackage.get(packageId);
    if (nonEmpty(latestCheckin?.parent_box_id)) insideBoxIds.add(packageId);
    labelsByPackage.set(packageId, labelsFor(packageId, new Set()));
  }

  return { labelsByPackage, insideBoxIds };
}

export async function fetchPagedShipmentRows<T>(
  fetchPage: ShipmentLookupPageFetcher<T>,
  pageSize = SHIPMENT_LOOKUP_PAGE_SIZE,
): Promise<T[]> {
  if (pageSize < 1) throw new Error("Shipment lookup page size must be positive.");
  const rows: T[] = [];
  let offset = 0;
  while (true) {
    const result = await fetchPage(offset, pageSize);
    if (result.error) throw new Error(result.error.message || "Shipment lookup query failed.");
    const page = result.data || [];
    rows.push(...page);
    if (page.length < pageSize) return rows;
    offset += pageSize;
  }
}

export async function fetchShipmentRowsInBatches<T>(
  ids: string[],
  fetchPage: (ids: string[], offset: number, limit: number) => PromiseLike<ShipmentLookupQueryResult<T>>,
  batchSize = SHIPMENT_LOOKUP_BATCH_SIZE,
  pageSize = SHIPMENT_LOOKUP_PAGE_SIZE,
): Promise<T[]> {
  if (batchSize < 1) throw new Error("Shipment lookup batch size must be positive.");
  const rows: T[] = [];
  const uniqueIds = Array.from(new Set(ids.map(key).filter(Boolean)));
  for (let index = 0; index < uniqueIds.length; index += batchSize) {
    const batch = uniqueIds.slice(index, index + batchSize);
    rows.push(...await fetchPagedShipmentRows((offset, limit) => fetchPage(batch, offset, limit), pageSize));
  }
  return rows;
}

export type ShipmentContainerLookupFetchers = {
  fetchLinks: (ids: string[], offset: number, limit: number) => PromiseLike<ShipmentLookupQueryResult<ShipmentContainerLinkRow>>;
  fetchCheckins: (ids: string[], offset: number, limit: number) => PromiseLike<ShipmentLookupQueryResult<ShipmentCheckinRow>>;
  fetchContainers: (ids: string[], offset: number, limit: number) => PromiseLike<ShipmentLookupQueryResult<ShipmentContainerRow>>;
};

export async function loadShipmentContainerLookup(
  packageIds: string[],
  fetchers: ShipmentContainerLookupFetchers,
  batchSize = SHIPMENT_LOOKUP_BATCH_SIZE,
  pageSize = SHIPMENT_LOOKUP_PAGE_SIZE,
): Promise<ResolvedShipmentContainerLookup & { checkins: ShipmentCheckinRow[] }> {
  const rootIds = Array.from(new Set(packageIds.map(key).filter(Boolean)));
  const links: ShipmentContainerLinkRow[] = [];
  const checkins: ShipmentCheckinRow[] = [];
  const fetchedPackageIds = new Set<string>();
  let frontier = rootIds;

  while (frontier.length) {
    frontier = frontier.filter((id) => !fetchedPackageIds.has(id));
    frontier.forEach((id) => fetchedPackageIds.add(id));
    if (!frontier.length) break;

    const [frontierLinks, frontierCheckins] = await Promise.all([
      fetchShipmentRowsInBatches(frontier, fetchers.fetchLinks, batchSize, pageSize),
      fetchShipmentRowsInBatches(frontier, fetchers.fetchCheckins, batchSize, pageSize),
    ]);
    links.push(...frontierLinks);
    checkins.push(...frontierCheckins);

    const latest = latestCheckinsByPackage(checkins);
    const parentIds = frontier.map((id) => nonEmpty(latest.get(id)?.parent_box_id));
    frontier = Array.from(new Set(
      parentIds.filter((id): id is string => id !== null && !fetchedPackageIds.has(id)),
    ));
  }

  const containerIds = Array.from(new Set(links.map((link) => nonEmpty(link.contenedor_id)).filter((id): id is string => Boolean(id))));
  const containers = containerIds.length
    ? await fetchShipmentRowsInBatches(containerIds, fetchers.fetchContainers, batchSize, pageSize)
    : [];
  const resolved = resolveShipmentContainerLabels(rootIds, links, checkins, containers);
  return { ...resolved, checkins };
}
