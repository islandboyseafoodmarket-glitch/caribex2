import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function getAdminClient() {
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Supabase server environment variables are missing");
  }
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function requireAdmin(request: Request) {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) {
    throw new Error("Authentication is required");
  }
  const supabaseAdmin = getAdminClient();
  const token = authorization.slice("Bearer ".length);
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) throw new Error("Invalid authentication token");

  const { data: admin, error: adminError } = await supabaseAdmin
    .from("administradores")
    .select("id")
    .eq("id", data.user.id)
    .maybeSingle();
  if (adminError || !admin) throw new Error("Administrator access is required");

  return { supabaseAdmin, userId: data.user.id };
}

function getWeekBounds(date = new Date()) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const day = start.getDay();
  start.setDate(start.getDate() - (day === 0 ? 6 : day - 1));
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function normalizePort(value: unknown) {
  const port = String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  if (port.includes("ceiba")) return "la_ceiba";
  if (port === "utila") return "utila";
  return null;
}

export async function GET(request: Request) {
  try {
    const { supabaseAdmin } = await requireAdmin(request);
    const [{ data: manifests, error: manifestError }, { data: containers, error: containerError }] =
      await Promise.all([
        supabaseAdmin
          .from("ferry_manifests")
          .select("*")
          .order("creado_en", { ascending: false }),
        supabaseAdmin.from("contenedores").select("id, codigo").order("creado_en", { ascending: false }),
      ]);
    if (manifestError) throw manifestError;
    if (containerError) throw containerError;

    const manifestIds = (manifests || []).map((manifest) => manifest.id);
    const { data: entries, error: entriesError } = manifestIds.length
      ? await supabaseAdmin
          .from("ferry_manifest_entries")
          .select("manifiesto_id, puerto, numero_reserva, nombre_receptor")
          .in("manifiesto_id", manifestIds)
      : { data: [], error: null };
    if (entriesError) throw entriesError;

    const entryCounts = new Map<string, number>();
    for (const entry of entries || []) {
      entryCounts.set(entry.manifiesto_id, (entryCounts.get(entry.manifiesto_id) || 0) + 1);
    }

    return NextResponse.json({
      manifests: (manifests || []).map((manifest) => ({
        ...manifest,
        entry_count: entryCounts.get(manifest.id) || 0,
      })),
      containers: containers || [],
    });
  } catch (error: any) {
    const message = error?.message || "Could not load ferry manifests";
    return NextResponse.json({ error: message }, { status: message.includes("required") || message.includes("Administrator") ? 403 : 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { supabaseAdmin, userId } = await requireAdmin(request);
    const body = await request.json();
    const containerId = String(body?.contenedor_id || "");
    if (!containerId) return NextResponse.json({ error: "A container is required" }, { status: 400 });

    const { data: existing } = await supabaseAdmin
      .from("ferry_manifests")
      .select("id")
      .eq("contenedor_id", containerId)
      .maybeSingle();
    if (existing) return NextResponse.json({ error: "This container already has a ferry manifest" }, { status: 409 });

    const { data: links, error: linksError } = await supabaseAdmin
      .from("contenedor_paquetes")
      .select("paquete_id")
      .eq("contenedor_id", containerId);
    if (linksError) throw linksError;
    const packageIds = (links || []).map((link) => link.paquete_id).filter(Boolean);
    if (!packageIds.length) return NextResponse.json({ error: "This container has no packages" }, { status: 400 });

    const { data: packages, error: packagesError } = await supabaseAdmin
      .from("paquetes_registro")
      .select("id, tracking, contenido, notas, numero_cliente_id")
      .in("id", packageIds);
    if (packagesError) throw packagesError;
    const customerIds = Array.from(new Set((packages || []).map((item) => item.numero_cliente_id).filter(Boolean)));
    if (!customerIds.length) return NextResponse.json({ error: "No packages have assigned customers" }, { status: 400 });

    const { data: customers, error: customersError } = await supabaseAdmin
      .from("numero_cliente")
      .select("id, numero_cliente, nombre, puerto")
      .in("id", customerIds);
    if (customersError) throw customersError;
    const customerById = new Map((customers || []).map((customer) => [customer.id, customer]));

    const entryRows = (packages || [])
      .map((item) => {
        const customer = customerById.get(item.numero_cliente_id);
        const port = normalizePort(customer?.puerto);
        if (!customer || !port) return null;
        const source = `${item.notas || ""} ${item.contenido || ""}`;
        const quantityMatch = source.match(/(?:BOXES?|PACKAGES?)\s*[=:]\s*\d+/i);
        return {
          paquete_id: item.id,
          numero_cliente_id: customer.id,
          puerto: port,
          numero_cuenta: String(customer.numero_cliente),
          nombre_cliente: customer.nombre,
          etiqueta_cantidad: quantityMatch?.[0]?.toUpperCase().replace(":", "=") || "BOX= 1",
        };
      })
      .filter(Boolean) as Array<Record<string, string>>;
    if (!entryRows.length) return NextResponse.json({ error: "No La Ceiba or Utila packages were found" }, { status: 400 });

    const { start, end } = getWeekBounds();
    const { data: manifest, error: insertError } = await supabaseAdmin
      .from("ferry_manifests")
      .insert({
        contenedor_id: containerId,
        token: randomBytes(24).toString("hex"),
        semana_inicio: start.toISOString(),
        semana_fin: end.toISOString(),
        estado: "active",
        creado_por: userId,
      })
      .select("*")
      .single();
    if (insertError || !manifest) throw insertError || new Error("Manifest was not created");

    const { error: entryError } = await supabaseAdmin
      .from("ferry_manifest_entries")
      .insert(entryRows.map((entry) => ({ ...entry, manifiesto_id: manifest.id })));
    if (entryError) {
      await supabaseAdmin.from("ferry_manifests").delete().eq("id", manifest.id);
      throw entryError;
    }

    return NextResponse.json({ manifest }, { status: 201 });
  } catch (error: any) {
    const message = error?.message || "Could not create ferry manifest";
    return NextResponse.json({ error: message }, { status: message.includes("required") || message.includes("Administrator") ? 403 : 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const { supabaseAdmin } = await requireAdmin(request);
    const body = await request.json();
    const manifestId = String(body?.id || "");
    if (!manifestId) return NextResponse.json({ error: "Manifest id is required" }, { status: 400 });
    const { error } = await supabaseAdmin
      .from("ferry_manifests")
      .update({ estado: "archived", archivado_en: new Date().toISOString() })
      .eq("id", manifestId);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    const message = error?.message || "Could not archive ferry manifest";
    return NextResponse.json({ error: message }, { status: message.includes("required") || message.includes("Administrator") ? 403 : 500 });
  }
}
