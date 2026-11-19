import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { DATABASE_STATUS, FERRY_PORT, FERRY_PORT_LABELS, type FerryPort, normalizeFerryPort, statusMatches } from "@/lib/shipping-rules";

export const dynamic = "force-dynamic";

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase server environment variables are missing");
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
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
  return data.user.id;
}

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "Unexpected error";
  return NextResponse.json({ error: message }, { status: /authentication|token|access|required/i.test(message) ? 401 : 500 });
}

const APP_PORTS = [FERRY_PORT.LA_CEIBA, FERRY_PORT.UTILA, FERRY_PORT.GUANAJA, FERRY_PORT.SAN_PEDRO_SULA, FERRY_PORT.TEGUCIGALPA] as const;
function parsePort(value: unknown): FerryPort | null {
  const normalized = normalizeFerryPort(value);
  return normalized && APP_PORTS.includes(normalized) ? normalized : null;
}

async function containerPackages(supabase: SupabaseClient, containerId: string) {
  const { data: links, error: linkError } = await supabase.from("contenedor_paquetes").select("paquete_id").eq("contenedor_id", containerId).limit(5000);
  if (linkError) throw linkError;
  const ids = Array.from(new Set((links || []).map((row) => row.paquete_id).filter(Boolean)));
  if (!ids.length) return [];
  const { data: packages, error } = await supabase.from("paquetes_registro").select("id, tracking, nombre_paqueteria, tipo_paquete, contenido, estado, numero_cliente_id, fecha_descargado, hora_descargado, fecha_entregado, hora_entregado").in("id", ids).limit(5000);
  if (error) throw error;
  const customerIds = Array.from(new Set((packages || []).map((row) => row.numero_cliente_id).filter(Boolean)));
  const { data: customers, error: customerError } = customerIds.length
    ? await supabase.from("numero_cliente").select("id, numero_cliente, nombre, email, puerto").in("id", customerIds)
    : { data: [], error: null };
  if (customerError) throw customerError;
  const customersById = new Map((customers || []).map((row) => [row.id, row]));
  return (packages || []).map((row) => ({ ...row, customer: customersById.get(row.numero_cliente_id) || null }));
}

async function getDispatchedIds(supabase: SupabaseClient, packageIds: string[]) {
  if (!packageIds.length) return new Set<string>();
  const { data, error } = await supabase.from("ferry_manifest_entries").select("paquete_id").in("paquete_id", packageIds).not("despachado_en", "is", null).limit(5000);
  if (error) throw error;
  return new Set((data || []).map((row) => row.paquete_id));
}

function isReadyToDispatch(row: any) {
  return statusMatches(row.estado, DATABASE_STATUS.UNLOADED) && !row.fecha_entregado && !row.hora_entregado;
}

export async function GET(request: Request) {
  try {
    const supabase = adminClient();
    await requireStaff(request, supabase);
    const url = new URL(request.url);
    const port = parsePort(url.searchParams.get("port"));
    if (!port) return NextResponse.json({ ports: APP_PORTS.map((value) => ({ value, label: FERRY_PORT_LABELS[value] })) });
    const { data: containers, error: containerError } = await supabase.from("contenedores").select("id, codigo, creado_en").order("creado_en", { ascending: false }).limit(500);
    if (containerError) throw containerError;
    const results = [];
    const metrics = { containersWithShipments: 0, readyShipments: 0, matchingDestinationShipments: 0, lockedContainers: 0 };
    for (const container of containers || []) {
      const rows = await containerPackages(supabase, container.id);
      const dispatched = await getDispatchedIds(supabase, rows.map((row) => row.id));
      if (rows.length) metrics.containersWithShipments += 1;
      const ready = rows.filter(isReadyToDispatch);
      metrics.readyShipments += ready.length;
      const matching = ready.filter((row) => parsePort(row.customer?.puerto) === port);
      metrics.matchingDestinationShipments += matching.length;
      if (matching.length && dispatched.size) {
        metrics.lockedContainers += 1;
        continue;
      }
      if (matching.length) results.push({ id: container.id, code: container.codigo || container.id, created_at: container.creado_en, shipment_count: matching.length, shipments: matching.map((row) => ({ id: row.id, tracking: row.tracking || "—", carrier: row.nombre_paqueteria || null, package_type: row.tipo_paquete || null, customer_name: row.customer?.nombre || "Unassigned", account_number: row.customer?.numero_cliente ?? null, destination: port })) });
    }
    let reasonCode = "containers_available";
    let message = `${results.length} container${results.length === 1 ? " is" : "s are"} available for ${FERRY_PORT_LABELS[port]}. A container is locked after its first shipment is sent to the ferry.`;
    let messageEs = `${results.length} contenedor${results.length === 1 ? " está" : "es están"} disponible${results.length === 1 ? "" : "s"} para ${FERRY_PORT_LABELS[port]}. Un contenedor se bloquea después de enviar su primer envío al ferry.`;
    if (!results.length) {
      if (!containers?.length) {
        reasonCode = "no_containers_registered";
        message = "No containers are registered. Ask an Admin to add or refresh a container.";
        messageEs = "No hay contenedores registrados. Pida a un administrador que agregue o actualice un contenedor.";
      } else if (!metrics.containersWithShipments) {
        reasonCode = "no_shipments_assigned";
        message = "No shipments are linked to the registered containers.";
        messageEs = "No hay envíos vinculados a los contenedores registrados.";
      } else if (!metrics.readyShipments) {
        reasonCode = "no_unloaded_shipments";
        message = "No linked shipments are currently Unloaded and undelivered. Only those shipments can be sent to the ferry.";
        messageEs = "Ningún envío vinculado está descargado y sin entregar. Solo esos envíos se pueden enviar al ferry.";
      } else if (!metrics.matchingDestinationShipments) {
        reasonCode = "no_shipments_for_destination";
        message = `No Unloaded shipments are assigned to ${FERRY_PORT_LABELS[port]}. Check the customers’ port assignments.`;
        messageEs = `No hay envíos descargados asignados a ${FERRY_PORT_LABELS[port]}. Revise los puertos asignados a los clientes.`;
      } else {
        reasonCode = "containers_already_dispatched";
        message = `Unloaded shipments for ${FERRY_PORT_LABELS[port]} exist, but every matching container is locked because a shipment from it has already been sent to the ferry. Choose a different container.`;
        messageEs = `Hay envíos descargados para ${FERRY_PORT_LABELS[port]}, pero todos sus contenedores están bloqueados porque ya se envió un envío de cada uno al ferry. Elija otro contenedor.`;
      }
    }
    return NextResponse.json({
      port,
      port_label: FERRY_PORT_LABELS[port],
      containers: results,
      message,
      message_es: messageEs,
      ...(results.length ? {} : { error: message }),
      availability: { available: results.length > 0, count: results.length, reason_code: results.length ? null : reasonCode, message, message_es: messageEs, ...metrics },
    }, { status: results.length ? 200 : 409 });
  } catch (error) { return errorResponse(error); }
}

export async function POST(request: Request) {
  try {
    const supabase = adminClient();
    const userId = await requireStaff(request, supabase);
    const body = await request.json();
    const port = parsePort(body?.port);
    const containerId = String(body?.container_id || "").trim();
    const tracking = String(body?.tracking || "").trim();
    if (!port || !containerId || !tracking) return NextResponse.json({ error: "Ferry destination, container, and tracking number are required" }, { status: 400 });
    const rows = await containerPackages(supabase, containerId);
    const row = rows.find((item) => String(item.tracking || "").trim().toLowerCase() === tracking.toLowerCase());
    if (!row) return NextResponse.json({ error: "This tracking number is not in the selected container" }, { status: 404 });
    if (!isReadyToDispatch(row)) return NextResponse.json({ error: "This shipment is not unloaded and ready for ferry dispatch" }, { status: 409 });
    const rowPort = parsePort(row.customer?.puerto);
    if (rowPort !== port) return NextResponse.json({ error: `This shipment belongs to ${rowPort ? FERRY_PORT_LABELS[rowPort] : "another destination"}, not ${FERRY_PORT_LABELS[port]}` }, { status: 409 });
    const dispatched = await getDispatchedIds(supabase, rows.map((item) => item.id));
    if (dispatched.size) {
      const message = "This container is no longer available because a shipment from it has already been sent to the ferry. Choose another container.";
      const messageEs = "Este contenedor ya no está disponible porque uno de sus envíos ya se envió al ferry. Elija otro contenedor.";
      return NextResponse.json({ error: message, message, message_es: messageEs, reason_code: "container_already_dispatched" }, { status: 409 });
    }
    let { data: manifest, error: manifestError } = await supabase.from("ferry_manifests").select("id, token").eq("contenedor_id", containerId).eq("ubicacion", port === FERRY_PORT.LA_CEIBA || port === FERRY_PORT.UTILA ? "la_ceiba_utila" : port).eq("estado", "active").limit(1).maybeSingle();
    if (manifestError) throw manifestError;
    if (!manifest) {
      const start = new Date(); start.setHours(0, 0, 0, 0);
      const end = new Date(start); end.setDate(end.getDate() + 6); end.setHours(23, 59, 59, 999);
      const created = await supabase.from("ferry_manifests").insert({ contenedor_id: containerId, ubicacion: port === FERRY_PORT.LA_CEIBA || port === FERRY_PORT.UTILA ? "la_ceiba_utila" : port, token: randomBytes(24).toString("hex"), semana_inicio: start.toISOString(), semana_fin: end.toISOString(), estado: "active", creado_por: userId }).select("id, token").single();
      if (created.error) throw created.error;
      manifest = created.data;
    }
    const dispatchedAt = new Date().toISOString();
    const { data: existingEntry, error: existingEntryError } = await supabase
      .from("ferry_manifest_entries")
      .select("id")
      .eq("manifiesto_id", manifest.id)
      .eq("paquete_id", row.id)
      .maybeSingle();
    if (existingEntryError) throw existingEntryError;

    const { data: entry, error: entryError } = existingEntry
      ? await supabase
          .from("ferry_manifest_entries")
          .update({ despachado_en: dispatchedAt })
          .eq("id", existingEntry.id)
          .select("id, paquete_id, despachado_en")
          .single()
      : await supabase
          .from("ferry_manifest_entries")
          .insert({ manifiesto_id: manifest.id, paquete_id: row.id, numero_cliente_id: row.numero_cliente_id, puerto: rowPort, numero_cuenta: String(row.customer?.numero_cliente || ""), nombre_cliente: row.customer?.nombre || "Unknown customer", etiqueta_cantidad: "BOX= 1", despachado_en: dispatchedAt })
          .select("id, paquete_id, despachado_en")
          .single();
    if (entryError) throw entryError;
    return NextResponse.json({ ok: true, entry, shipment: { id: row.id, tracking: row.tracking, customer_name: row.customer?.nombre || "Unassigned", account_number: row.customer?.numero_cliente ?? null }, port, port_label: FERRY_PORT_LABELS[port], manifest_id: manifest.id }, { status: 201 });
  } catch (error) { return errorResponse(error); }
}
