import { NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { DATABASE_STATUS, normalizeStatus, statusMatches } from "../../../lib/shipping-rules";
import { isInvoiceOnlyShipment } from "../../../lib/shipment-eligibility";

const MAX_SHIPMENTS = 100;
const MAX_TRACKING_LENGTH = 200;
const MAX_SIGNATURE_PATH_LENGTH = 200000;
const MAX_CUSTOMER_SHIPMENTS = 5000;
const MAX_PARTIAL_REASON_LENGTH = 2000;

type ShipmentRow = {
  id: string;
  tracking: string | null;
  numero_cliente_id: string | null;
  estado: string | null;
  issue_status: string | null;
  fecha_entregado: string | null;
  hora_entregado: string | null;
};

type CustomerShipmentRow = ShipmentRow & {
  tipo_paquete: string | null;
  nombre_paqueteria: string | null;
};

function client() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase server environment variables are missing");
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}
async function auth(request: Request, supabase: SupabaseClient) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) throw new Error("Authentication is required");
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) throw new Error("Invalid authentication token");
  const [{ data: admin }, { data: staff }] = await Promise.all([
    supabase.from("administradores").select("id, rol").eq("id", data.user.id).maybeSingle(),
    supabase.from("personal").select("id, nombre, nombre_personal, rol").eq("id", data.user.id).maybeSingle(),
  ]);
  if (!admin && !staff) throw new Error("Staff access is required");
  return { user: data.user, role: admin ? "admin" : "staff", name: admin ? "Admin" : staff?.nombre || staff?.nombre_personal || data.user.email || "Staff" };
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeContainerCode(value: unknown) {
  const normalized = text(value);
  return !normalized || normalized.toUpperCase() === "UNASSIGNED" ? "UNASSIGNED" : normalized;
}

function stringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const values = value.map((item) => (typeof item === "string" ? item.trim() : ""));
  return values.every(Boolean) ? values : null;
}

function invalid(message: string, code: string, status = 400) {
  return NextResponse.json({ error: message, code }, { status });
}

function isArchived(row: ShipmentRow) {
  return normalizeStatus(row.estado) === normalizeStatus("Archivado");
}

function isPickedUp(row: ShipmentRow) {
  return statusMatches(row.estado, DATABASE_STATUS.PICKED_UP) || Boolean(row.fecha_entregado || row.hora_entregado);
}

export async function GET(request: Request) {
  try {
    const supabase = client();
    await auth(request, supabase);
    const url = new URL(request.url);
    const shipmentId = url.searchParams.get("shipment_id")?.trim() || "";
    const tracking = url.searchParams.get("tracking")?.trim() || "";
    if (!shipmentId && !tracking) return NextResponse.json({ error: "A shipment ID or tracking number is required" }, { status: 400 });

    const byShipment = shipmentId
      ? await supabase.from("pickup_signatures").select("id, signed_at, shipment_ids, trackings, signature_paths, captured_by_role").contains("shipment_ids", [shipmentId]).order("signed_at", { ascending: true }).limit(100)
      : { data: [], error: null };
    const byTracking = tracking
      ? await supabase.from("pickup_signatures").select("id, signed_at, shipment_ids, trackings, signature_paths, captured_by_role").contains("trackings", [tracking]).order("signed_at", { ascending: true }).limit(100)
      : { data: [], error: null };
    if (byShipment.error || byTracking.error) throw byShipment.error || byTracking.error;

    const signatures = new Map<string, any>();
    [...(byShipment.data || []), ...(byTracking.data || [])].forEach((signature) => {
      if (signature?.id) signatures.set(String(signature.id), signature);
    });
    return NextResponse.json({ signatures: Array.from(signatures.values()).sort((a, b) => String(a.signed_at || "").localeCompare(String(b.signed_at || ""))) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load pickup signatures";
    return NextResponse.json({ error: message }, { status: /authentication|token|access|required/i.test(message) ? 401 : 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = client();
    const staff = await auth(request, supabase);
    const body = await request.json();

    const paths = stringArray(body?.signature_paths);
    const rawShipmentIds = body?.shipment_ids === undefined ? [] : stringArray(body.shipment_ids);
    const rawTrackings = body?.trackings === undefined ? [] : stringArray(body.trackings);
    if (!paths?.length || paths.some((path) => path.length >= MAX_SIGNATURE_PATH_LENGTH)) {
      return invalid("A valid signature is required", "INVALID_SIGNATURE", 400);
    }
    if (rawShipmentIds === null || rawTrackings === null) {
      return invalid("Shipment IDs and trackings must be string arrays", "INVALID_SHIPMENT_REFERENCE", 400);
    }

    const shipmentIds = rawShipmentIds;
    const trackings = rawTrackings;
    if (!shipmentIds.length && !trackings.length) return invalid("A signature and at least one shipment are required", "INVALID_SHIPMENT_REFERENCE", 400);
    if (shipmentIds.length > MAX_SHIPMENTS || trackings.length > MAX_SHIPMENTS) {
      return invalid(`A maximum of ${MAX_SHIPMENTS} shipments may be signed at once`, "TOO_MANY_SHIPMENTS", 400);
    }
    if (trackings.some((tracking) => tracking.length > MAX_TRACKING_LENGTH)) {
      return invalid("A tracking number is too long", "INVALID_SHIPMENT_REFERENCE", 400);
    }
    if (new Set(shipmentIds).size !== shipmentIds.length || new Set(trackings).size !== trackings.length) {
      return invalid("Duplicate shipment IDs or trackings are not allowed", "DUPLICATE_SHIPMENT_REFERENCE", 409);
    }
    if (shipmentIds.length && shipmentIds.length !== trackings.length) {
      return invalid("Each shipment ID must have exactly one matching tracking number", "SHIPMENT_TRACKING_MISMATCH", 409);
    }

    const suppliedCustomerId = text(body?.customer_id);
    if (!suppliedCustomerId) {
      return invalid("A valid customer ID is required", "INVALID_CUSTOMER_REFERENCE", 400);
    }

    const hasContainerCode = body && Object.prototype.hasOwnProperty.call(body, "container_code");
    if (hasContainerCode && typeof body.container_code !== "string") {
      return invalid("container_code must be a string", "INVALID_CONTAINER_REFERENCE", 400);
    }
    const suppliedContainerCode = hasContainerCode ? normalizeContainerCode(body.container_code) : null;
    if (suppliedContainerCode && suppliedContainerCode.length > MAX_TRACKING_LENGTH) {
      return invalid("The container code is too long", "INVALID_CONTAINER_REFERENCE", 400);
    }

    if (body?.partial_pickup_reason !== undefined && typeof body.partial_pickup_reason !== "string") {
      return invalid("partial_pickup_reason must be a string", "INVALID_PARTIAL_PICKUP_REASON", 400);
    }
    const partialPickupReason = text(body?.partial_pickup_reason);
    if (partialPickupReason.length > MAX_PARTIAL_REASON_LENGTH) {
      return invalid("The partial pickup reason is too long", "INVALID_PARTIAL_PICKUP_REASON", 400);
    }

    const rawRemainingTrackings = body?.remaining_trackings === undefined ? [] : stringArray(body.remaining_trackings);
    if (rawRemainingTrackings === null) {
      return invalid("remaining_trackings must be a string array", "INVALID_REMAINING_TRACKINGS", 400);
    }
    if (rawRemainingTrackings.length > MAX_SHIPMENTS || rawRemainingTrackings.some((tracking) => tracking.length > MAX_TRACKING_LENGTH)) {
      return invalid(`A maximum of ${MAX_SHIPMENTS} remaining trackings may be supplied`, "INVALID_REMAINING_TRACKINGS", 400);
    }

    const lookupValues = shipmentIds.length ? shipmentIds : trackings;
    const lookupColumn = shipmentIds.length ? "id" : "tracking";
    let shipmentQuery = supabase
      .from("paquetes_registro")
      .select("id, tracking, numero_cliente_id, estado, issue_status, fecha_entregado, hora_entregado")
      .in(lookupColumn, lookupValues);
    // Legacy tracking-only callers may omit IDs, but customer_id still scopes
    // resolution so a duplicate tracking owned by another customer cannot win.
    if (!shipmentIds.length && suppliedCustomerId) shipmentQuery = shipmentQuery.eq("numero_cliente_id", suppliedCustomerId);
    const { data: rows, error: shipmentError } = await shipmentQuery.limit(MAX_SHIPMENTS * 5);
    if (shipmentError) throw shipmentError;
    const found = (rows || []) as ShipmentRow[];

    let resolvedRows: ShipmentRow[];
    if (shipmentIds.length) {
      const byId = new Map(found.map((row) => [String(row.id), row]));
      const missingId = shipmentIds.find((id) => !byId.has(id));
      if (missingId) return invalid("One or more shipment IDs could not be found", "SHIPMENT_NOT_FOUND", 409);
      resolvedRows = shipmentIds.map((id) => byId.get(id)!);
      const mismatchedPair = resolvedRows.findIndex((row, index) => text(row.tracking) !== trackings[index]);
      if (mismatchedPair >= 0) {
        return invalid("Shipment IDs and tracking numbers do not correspond", "SHIPMENT_TRACKING_MISMATCH", 409);
      }
    } else {
      resolvedRows = [];
      for (const tracking of trackings) {
        const candidates = found.filter((row) => text(row.tracking) === tracking);
        if (!candidates.length) return invalid(`Tracking ${tracking} could not be found`, "SHIPMENT_NOT_FOUND", 409);
        if (candidates.length !== 1) {
          return invalid(`Tracking ${tracking} is ambiguous; scan a shipment ID as well`, "AMBIGUOUS_TRACKING", 409);
        }
        resolvedRows.push(candidates[0]);
      }
    }

    const customerIds = new Set(resolvedRows.map((row) => text(row.numero_cliente_id)));
    if (customerIds.size !== 1 || customerIds.has("")) {
      return invalid("The pickup contains shipments from more than one customer", "MIXED_CUSTOMERS", 409);
    }
    const resolvedCustomerId = Array.from(customerIds)[0];
    if (suppliedCustomerId && resolvedCustomerId !== suppliedCustomerId) {
      return invalid("The shipments do not belong to the selected customer", "CUSTOMER_MISMATCH", 409);
    }

    const invalidRow = resolvedRows.find((row) => isArchived(row) || !isPickedUp(row));
    if (invalidRow) {
      if (isArchived(invalidRow)) return invalid("Archived shipments cannot receive pickup signatures", "ARCHIVED_SHIPMENT", 409);
      if (!isPickedUp(invalidRow)) return invalid("All shipments must already be picked up", "SHIPMENT_NOT_PICKED_UP", 409);
    }

    const finalTrackings = resolvedRows.map((row) => text(row.tracking));
    let authoritativeRemainingTrackings: string[] = [];

    if (suppliedContainerCode) {
      const { data: customerShipments, error: customerShipmentError } = await supabase
        .from("paquetes_registro")
        .select("id, tracking, numero_cliente_id, estado, issue_status, fecha_entregado, hora_entregado, tipo_paquete, nombre_paqueteria")
        .eq("numero_cliente_id", resolvedCustomerId)
        .neq("estado", "Archivado")
        .limit(MAX_CUSTOMER_SHIPMENTS);
      if (customerShipmentError) throw customerShipmentError;

      const customerRows = (customerShipments || []) as CustomerShipmentRow[];
      const customerPackageIds = customerRows.map((row) => row.id);
      const [{ data: childLinks, error: childLinkError }, { data: containerLinks, error: containerLinkError }] = await Promise.all([
        customerPackageIds.length
          ? supabase.from("paquetes_checkin").select("paquete_id, parent_box_id").in("paquete_id", customerPackageIds).limit(MAX_CUSTOMER_SHIPMENTS)
          : Promise.resolve({ data: [], error: null }),
        customerPackageIds.length
          ? supabase.from("contenedor_paquetes").select("paquete_id, contenedor_id").in("paquete_id", customerPackageIds).limit(MAX_CUSTOMER_SHIPMENTS)
          : Promise.resolve({ data: [], error: null }),
      ]);
      if (childLinkError || containerLinkError) throw childLinkError || containerLinkError;

      const consolidatedChildIds = new Set(
        (childLinks || [])
          .filter((link) => Boolean(link.parent_box_id))
          .map((link) => String(link.paquete_id)),
      );
      const containerIds = Array.from(new Set((containerLinks || []).map((link) => link.contenedor_id).filter(Boolean)));
      const { data: containers, error: containerError } = containerIds.length
        ? await supabase.from("contenedores").select("id, codigo").in("id", containerIds).limit(MAX_CUSTOMER_SHIPMENTS)
        : { data: [], error: null };
      if (containerError) throw containerError;

      const containerById = new Map((containers || []).map((container) => [String(container.id), text(container.codigo)]));
      const containerByPackageId = new Map<string, string>();
      for (const link of containerLinks || []) {
        const code = containerById.get(String(link.contenedor_id));
        if (code) containerByPackageId.set(String(link.paquete_id), code);
      }

      const mismatchedContainer = resolvedRows.find((row) => normalizeContainerCode(containerByPackageId.get(String(row.id))) !== suppliedContainerCode);
      if (mismatchedContainer) {
        return invalid("The supplied container does not match every signed shipment", "CONTAINER_MISMATCH", 409);
      }

      const signedIds = new Set(resolvedRows.map((row) => String(row.id)));
      authoritativeRemainingTrackings = customerRows
        .filter((row) => !signedIds.has(String(row.id)))
        .filter((row) => !consolidatedChildIds.has(String(row.id)))
        .filter((row) => !isInvoiceOnlyShipment(row))
        .filter((row) => statusMatches(row.estado, DATABASE_STATUS.UNLOADED) && !isPickedUp(row))
        .filter((row) => normalizeContainerCode(containerByPackageId.get(String(row.id))) === suppliedContainerCode)
        .map((row) => text(row.tracking))
        .filter(Boolean)
        .filter((tracking, index, values) => values.indexOf(tracking) === index);

      if (authoritativeRemainingTrackings.length > 0 && !partialPickupReason) {
        return NextResponse.json({
          error: "A reason is required when ready shipments remain unscanned in this customer/container pickup",
          code: "PARTIAL_PICKUP_REASON_REQUIRED",
          remaining_trackings: authoritativeRemainingTrackings,
        }, { status: 409 });
      }
    }

    const { data, error } = await supabase
      .from("pickup_signatures")
      .insert({ numero_cliente_id: resolvedCustomerId, shipment_ids: resolvedRows.map((row) => row.id), trackings: finalTrackings, signature_paths: paths, captured_by: staff.user.id, captured_by_role: staff.role })
      .select("id, signed_at, shipment_ids, trackings")
      .single();
    if (error) throw error;
    const linkedLogs = resolvedRows.map((row) => ({
      actor_id: staff.user.id,
      actor_name: staff.name,
      actor_email: staff.user.email || null,
      actor_role: staff.role,
      action: "pickup_signature_saved",
      entity_type: "paquetes_registro",
      entity_id: row.id,
      tracking: text(row.tracking),
      success: true,
      details: {
        signature_id: data.id,
        signed_at: data.signed_at,
        scanned_tracking_numbers: finalTrackings,
        shipment_count: resolvedRows.length,
        partial_pickup_reason: partialPickupReason || null,
        container_code: suppliedContainerCode,
        unscanned_tracking_numbers: authoritativeRemainingTrackings,
        source: "client_pickup_session",
      },
    }));
    if (linkedLogs.length) {
      const { error: logError } = await supabase.from("staff_action_logs").insert(linkedLogs);
      if (logError) console.warn("[pickup-signatures] Signature saved; audit linkage failed", logError.message);
    }
    return NextResponse.json({ ok: true, signature: data, remaining_trackings: authoritativeRemainingTrackings });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save pickup signature";
    return NextResponse.json({ error: message }, { status: /authentication|token|access|required/i.test(message) ? 401 : 500 });
  }
}
