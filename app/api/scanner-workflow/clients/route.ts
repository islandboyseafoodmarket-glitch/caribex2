import { NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { isArchivedShipment, isInvoiceOnlyShipment, isInTransitShipment, isPickedUpShipment, isReadyForPickupShipment } from "@/lib/shipment-eligibility";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function liveJson(body: object, status = 200) {
  return NextResponse.json(body, { status, headers: {
    "Cache-Control": "private, no-store, no-cache, max-age=0, must-revalidate",
    "CDN-Cache-Control": "no-store", "Vercel-CDN-Cache-Control": "no-store",
    "Pragma": "no-cache", "Expires": "0", "Vary": "Authorization",
  } });
}

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase server environment variables are missing");
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false }, global: { fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }) } });
}

async function requireStaff(request: Request, supabase: SupabaseClient) {
  const authorization = request.headers.get("authorization") || "";
  if (!authorization.startsWith("Bearer ")) throw new Error("Authentication is required");
  const { data, error } = await supabase.auth.getUser(authorization.slice(7));
  if (error || !data.user) throw new Error("Invalid authentication token");
  const [{ data: admin }, { data: staff }] = await Promise.all([
    supabase.from("administradores").select("id").eq("id", data.user.id).maybeSingle(),
    supabase.from("personal").select("id").eq("id", data.user.id).maybeSingle(),
  ]);
  if (!admin && !staff) throw new Error("Staff access is required");
  return { userId: data.user.id, role: admin ? "admin" : "staff" };
}

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "Unexpected error";
  return liveJson({ error: message }, /authentication|token|access|required/i.test(message) ? 401 : 500);
}

export async function GET(request: Request) {
  const requestStartedAt = Date.now();
  const requestUrl = new URL(request.url);
  const requestId = requestUrl.searchParams.get("_request_id") || `server-${requestStartedAt}`;
  const debug = (event: string, details: Record<string, unknown> = {}) => {
    // Never log authorization headers, passwords, email addresses, phone numbers, or tokens.
    console.info("[client-pickup-debug]", JSON.stringify({ event, request_id: requestId, ...details }));
  };
  try {
    const supabase = adminClient();
    const actor = await requireStaff(request, supabase);
    const url = requestUrl;
    const query = url.searchParams.get("query")?.trim() || "";
    const clientId = url.searchParams.get("client_id")?.trim() || "";
    const view = url.searchParams.get("view") || "ready";
    debug("request", { method: request.method, path: url.pathname, query, client_id: clientId || null, view, actor_id: actor.userId, actor_role: actor.role });
    if (url.searchParams.get("list") === "1") {
      const { data: clients, error: clientListError } = await supabase
        .from("numero_cliente")
        .select("id, numero_cliente, nombre, email, telefono, puerto")
        .order("nombre", { ascending: true })
        .limit(1000);
      if (clientListError) throw clientListError;
      debug("response", { status: 200, list: true, client_count: clients?.length || 0, duration_ms: Date.now() - requestStartedAt });
      return liveJson({ clients: clients || [], checked_at: new Date().toISOString(), request_id: requestId });
    }
    if (query.length < 1 && !clientId) {
      debug("response", { status: 200, client_id: null, package_count: 0, duration_ms: Date.now() - requestStartedAt });
      return liveJson({ client: null, packages: [], checked_at: new Date().toISOString(), request_id: requestId });
    }

    const numeric = query.replace(/[^0-9]/g, "");
    let clientQuery = supabase.from("numero_cliente").select("id, numero_cliente, nombre, email, telefono, puerto").limit(5);
    if (clientId) clientQuery = clientQuery.eq("id", clientId);
    else if (numeric && numeric === query.replace(/^L/i, "").replace(/^0+/, "") && numeric.length > 0) clientQuery = clientQuery.eq("numero_cliente", Number(numeric));
    else clientQuery = clientQuery.ilike("nombre", `%${query}%`);
    const { data: clients, error: clientError } = await clientQuery;
    if (clientError) throw clientError;
    const client = clients?.[0] || null;
    if (!client) {
      debug("response", { status: 200, client_id: null, matched_client_count: clients?.length || 0, package_count: 0, duration_ms: Date.now() - requestStartedAt });
      return liveJson({ client: null, packages: [], checked_at: new Date().toISOString(), request_id: requestId });
    }

    const { data: allPackages, error: packageError } = await supabase
      .from("paquetes_registro")
      .select("id, tracking, nombre_paqueteria, tipo_paquete, estado, invoice_status, approval_status, billing_total, fecha_descargado, hora_descargado, fecha_entregado, hora_entregado")
      .eq("numero_cliente_id", client.id)
      .neq("estado", "Archivado")
      .order("registro", { ascending: false })
      // Client Pickup must count every shipment for the customer, not only the
      // first 100 rows returned by Supabase.
      .limit(5000);
    if (packageError) throw packageError;
    const packageIds = (allPackages || []).map((item) => item.id);
    const { data: childLinks, error: childLinkError } = packageIds.length
      ? await supabase.from("paquetes_checkin").select("paquete_id, parent_box_id").in("paquete_id", packageIds).limit(5000)
      : { data: [], error: null };
    if (childLinkError) throw childLinkError;
    const { data: ferryEntries, error: ferryEntryError } = packageIds.length
      ? await supabase.from("ferry_manifest_entries").select("paquete_id, numero_reserva").in("paquete_id", packageIds).not("despachado_en", "is", null).limit(5000)
      : { data: [], error: null };
    if (ferryEntryError) throw ferryEntryError;
    const ferryDispatchedIds = new Set((ferryEntries || []).map((entry) => entry.paquete_id));
    const ferryBookingByPackageId = new Map<string, string>();
    for (const entry of ferryEntries || []) {
      const booking = String(entry.numero_reserva || "").trim();
      if (entry.paquete_id && booking && !ferryBookingByPackageId.has(entry.paquete_id)) {
        ferryBookingByPackageId.set(entry.paquete_id, booking);
      }
    }
    const consolidatedChildIds = new Set(
      (childLinks || [])
        .filter((link) => Boolean(link.parent_box_id))
        .map((link) => link.paquete_id),
    );
    // A consolidated child travels inside its main BOX and must not appear as
    // a second pickup item. It remains in the database for history and is
    // marked Entregado automatically when the main BOX is collected.
    const pickupPackages = (allPackages || []).filter((item) => !consolidatedChildIds.has(item.id) && !isInvoiceOnlyShipment(item) && !isArchivedShipment(item));
    const { data: containerLinks, error: linkError } = packageIds.length
      ? await supabase.from("contenedor_paquetes").select("paquete_id, contenedor_id").in("paquete_id", packageIds).limit(5000)
      : { data: [], error: null };
    if (linkError) throw linkError;
    const containerIds = Array.from(new Set((containerLinks || []).map((link) => link.contenedor_id).filter(Boolean)));
    const { data: containers, error: containerError } = containerIds.length
      ? await supabase.from("contenedores").select("id, codigo, creado_en").in("id", containerIds).limit(5000)
      : { data: [], error: null };
    if (containerError) throw containerError;
    const containerById = new Map((containers || []).map((container) => [container.id, { code: container.codigo, createdAt: container.creado_en }]));
    const containerByPackageId = new Map<string, { code: string; createdAt: string | null }>();
    for (const link of containerLinks || []) {
      const container = containerById.get(link.contenedor_id);
      if (container?.code) containerByPackageId.set(link.paquete_id, { code: container.code, createdAt: container.createdAt || null });
    }
    const isPickedUp = isPickedUpShipment;
    const isReadyForPickup = isReadyForPickupShipment;
    const withContainers = pickupPackages.map((item) => ({
      ...item,
      // Keep the legacy mobile app compatible: it renders every
      // `sent_to_ferry` package as awaiting booking, so only expose that flag
      // while the dispatched package still lacks a booking number.
      sent_to_ferry: ferryDispatchedIds.has(item.id) && !ferryBookingByPackageId.has(item.id),
      ferry_booking_number: ferryBookingByPackageId.get(item.id) || null,
      ferry_booking_confirmed: ferryBookingByPackageId.has(item.id),
      container_code: containerByPackageId.get(item.id)?.code || null,
      container_created_at: containerByPackageId.get(item.id)?.createdAt || null,
    }));
    const packages = withContainers.filter((item) => {
      if (view === "ready") return isReadyForPickup(item);
      if (view === "picked") return isPickedUp(item);
      return view === "way" ? isInTransitShipment(item) : isReadyForPickup(item);
    });
    const pickupSet = withContainers.filter((item) => isReadyForPickup(item) || isPickedUp(item));
    const collected = pickupSet.filter((item) => isPickedUp(item)).length;
    const total = pickupSet.length;
    debug("response", {
      status: 200,
      client_id: client.id,
      account_number: client.numero_cliente,
      all_package_count: allPackages?.length || 0,
      ferry_row_count: ferryEntries?.length || 0,
      ferry_dispatched_count: ferryDispatchedIds.size,
      ferry_booking_count: ferryBookingByPackageId.size,
      returned_package_count: packages.length,
      returned_pickup_package_count: pickupSet.length,
      sent_to_ferry_ids: withContainers.filter((item) => item.sent_to_ferry).map((item) => item.id),
      booked_package_ids: withContainers.filter((item) => item.ferry_booking_confirmed).map((item) => item.id),
      returned_packages: packages.map((item) => ({ id: item.id, tracking: item.tracking, estado: item.estado, sent_to_ferry: item.sent_to_ferry, ferry_booking_confirmed: item.ferry_booking_confirmed, ferry_booking_number: item.ferry_booking_number || null })),
      duration_ms: Date.now() - requestStartedAt,
    });
    return liveJson({ client, packages, pickup_packages: pickupSet, view, checked_at: new Date().toISOString(), request_id: requestId, summary: { collected, total, pending: Math.max(total - collected, 0) } });
  } catch (error) {
    debug("error", { message: error instanceof Error ? error.message : "Unexpected error", duration_ms: Date.now() - requestStartedAt });
    return errorResponse(error);
  }
}
