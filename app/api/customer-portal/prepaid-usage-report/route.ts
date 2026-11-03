import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createPrepaidUsageReportPdf, type PrepaidReportShipment } from "@/lib/prepaid-usage-report";

export const dynamic = "force-dynamic";

const PREPAID_ACCOUNT_TYPE = "Developer / Builder — Prepaid";
const PAGE_SIZE = 500;
const CHUNK_SIZE = 150;

type ShipmentRow = {
  id: string;
  tracking: string | null;
  nombre_paqueteria: string | null;
  tipo_paquete: string | null;
  contenido: string | null;
  estado: string | null;
  cubic_feet: number | string | null;
  creado_en: string | null;
  registro: string | null;
  hora_fecha: string | null;
};
type CheckinRow = { paquete_id: string | null; alto: number | string | null; ancho: number | string | null; largo: number | string | null; creado_en: string | null };
type LinkRow = { paquete_id: string | null; contenedor_id: string | null };
type ContainerRow = { id: string; codigo: string | null };

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase server environment variables are missing");
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

function finiteNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function chunks<T>(values: T[], size: number) {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += size) result.push(values.slice(index, index + size));
  return result;
}

async function fetchShipments(supabase: ReturnType<typeof adminClient>, customerId: string) {
  const results: ShipmentRow[] = [];
  for (let start = 0; ; start += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("paquetes_registro")
      .select("id, tracking, nombre_paqueteria, tipo_paquete, contenido, estado, cubic_feet, creado_en, registro, hora_fecha")
      .eq("numero_cliente_id", customerId)
      .order("creado_en", { ascending: false })
      .range(start, start + PAGE_SIZE - 1);
    if (error) throw error;
    const rows = (data || []) as ShipmentRow[];
    results.push(...rows);
    if (rows.length < PAGE_SIZE) break;
  }
  return results;
}

async function fetchRelatedRows<T>(
  supabase: ReturnType<typeof adminClient>,
  table: string,
  select: string,
  column: string,
  ids: string[],
  orderBy?: string,
) {
  const results: T[] = [];
  for (const idChunk of chunks(ids, CHUNK_SIZE)) {
    for (let start = 0; ; start += PAGE_SIZE) {
      let query = supabase.from(table).select(select).in(column, idChunk);
      if (orderBy) query = query.order(orderBy, { ascending: false });
      const { data, error } = await query.range(start, start + PAGE_SIZE - 1);
      if (error) throw error;
      const rows = (data || []) as T[];
      results.push(...rows);
      if (rows.length < PAGE_SIZE) break;
    }
  }
  return results;
}

export async function GET(request: Request) {
  try {
    const authorization = request.headers.get("authorization") || "";
    const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
    if (!token) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

    const supabase = adminClient();
    const { data: authData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !authData.user?.email) return NextResponse.json({ error: "Invalid session" }, { status: 401 });

    const { data: customer, error: customerError } = await supabase
      .from("numero_cliente")
      .select("id, nombre, email, numero_cliente, puerto, tipo_cuenta, prepaid_allowance_cubic_feet, prepaid_used_cubic_feet, prepaid_rate_per_cubic_foot")
      .eq("email", authData.user.email.toLowerCase())
      .maybeSingle();
    if (customerError) throw customerError;
    if (!customer) return NextResponse.json({ error: "Customer profile not found" }, { status: 404 });
    if (customer.tipo_cuenta !== PREPAID_ACCOUNT_TYPE) {
      return NextResponse.json({ error: "This report is available only to Developer / Builder prepaid accounts" }, { status: 403 });
    }

    const shipments = await fetchShipments(supabase, customer.id);
    const shipmentIds = shipments.map((shipment) => shipment.id).filter(Boolean);
    const [checkins, links] = shipmentIds.length
      ? await Promise.all([
          fetchRelatedRows<CheckinRow>(supabase, "paquetes_checkin", "paquete_id, alto, ancho, largo, creado_en", "paquete_id", shipmentIds, "creado_en"),
          fetchRelatedRows<LinkRow>(supabase, "contenedor_paquetes", "paquete_id, contenedor_id", "paquete_id", shipmentIds),
        ])
      : [[], []] as [CheckinRow[], LinkRow[]];

    const latestCheckin = new Map<string, CheckinRow>();
    for (const row of checkins) {
      if (row.paquete_id && !latestCheckin.has(String(row.paquete_id))) latestCheckin.set(String(row.paquete_id), row);
    }
    const containerIds = Array.from(new Set(links.map((row) => String(row.contenedor_id || "")).filter(Boolean)));
    const containers = containerIds.length
      ? await fetchRelatedRows<ContainerRow>(supabase, "contenedores", "id, codigo", "id", containerIds)
      : [];
    const containerById = new Map(containers.map((row) => [String(row.id), String(row.codigo || row.id)]));
    const containerLabels = new Map<string, Set<string>>();
    for (const link of links) {
      if (!link.paquete_id || !link.contenedor_id) continue;
      const labels = containerLabels.get(String(link.paquete_id)) || new Set<string>();
      labels.add(containerById.get(String(link.contenedor_id)) || String(link.contenedor_id));
      containerLabels.set(String(link.paquete_id), labels);
    }

    const reportShipments: PrepaidReportShipment[] = shipments.map((shipment) => {
      const checkin = latestCheckin.get(String(shipment.id));
      return {
        id: shipment.id,
        tracking: shipment.tracking,
        carrier: shipment.nombre_paqueteria,
        type: shipment.tipo_paquete,
        stage: shipment.estado,
        contents: shipment.contenido,
        length: checkin?.largo ?? null,
        width: checkin?.ancho ?? null,
        height: checkin?.alto ?? null,
        storedCubicFeet: shipment.cubic_feet,
        date: shipment.creado_en || shipment.registro || shipment.hora_fecha,
        containerLabels: Array.from(containerLabels.get(String(shipment.id)) || []),
      };
    });

    const allowance = finiteNumber(customer.prepaid_allowance_cubic_feet);
    const used = finiteNumber(customer.prepaid_used_cubic_feet);
    const remaining = Math.max(0, allowance - used);
    const rate = finiteNumber(customer.prepaid_rate_per_cubic_foot, 18.5) || 18.5;
    const pdfBytes = await createPrepaidUsageReportPdf({
      customer: { id: customer.id, name: customer.nombre, accountNumber: customer.numero_cliente, port: customer.puerto, email: customer.email || authData.user.email },
      allowance,
      used,
      remaining,
      rate,
      shipments: reportShipments,
    });
    const account = String(customer.numero_cliente ?? "account").replace(/[^a-z0-9_-]/gi, "");
    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="caribex-prepaid-usage-${account}.pdf"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Could not create prepaid usage report" }, { status: 500, headers: { "Cache-Control": "private, no-store" } });
  }
}
