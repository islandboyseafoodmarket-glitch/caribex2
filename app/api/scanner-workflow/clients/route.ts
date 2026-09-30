import { NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

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
}

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "Unexpected error";
  return NextResponse.json({ error: message }, { status: /authentication|token|access|required/i.test(message) ? 401 : 500 });
}

export async function GET(request: Request) {
  try {
    const supabase = adminClient();
    await requireStaff(request, supabase);
    const url = new URL(request.url);
    const query = url.searchParams.get("query")?.trim() || "";
    const clientId = url.searchParams.get("client_id")?.trim() || "";
    const view = url.searchParams.get("view") || "ready";
    if (url.searchParams.get("list") === "1") {
      const { data: clients, error: clientListError } = await supabase
        .from("numero_cliente")
        .select("id, numero_cliente, nombre, email, telefono, puerto")
        .order("nombre", { ascending: true })
        .limit(1000);
      if (clientListError) throw clientListError;
      return NextResponse.json({ clients: clients || [] });
    }
    if (query.length < 1 && !clientId) return NextResponse.json({ client: null, packages: [] });

    const numeric = query.replace(/[^0-9]/g, "");
    let clientQuery = supabase.from("numero_cliente").select("id, numero_cliente, nombre, email, telefono, puerto").limit(5);
    if (clientId) clientQuery = clientQuery.eq("id", clientId);
    else if (numeric && numeric === query.replace(/^L/i, "").replace(/^0+/, "") && numeric.length > 0) clientQuery = clientQuery.eq("numero_cliente", Number(numeric));
    else clientQuery = clientQuery.ilike("nombre", `%${query}%`);
    const { data: clients, error: clientError } = await clientQuery;
    if (clientError) throw clientError;
    const client = clients?.[0] || null;
    if (!client) return NextResponse.json({ client: null, packages: [] });

    const statusFilters: Record<string, string[]> = {
      ready: ["Descargado", "Unloaded", "Ready for Pickup", "Listo para recoger"],
      picked: ["Entregado", "Picked Up", "Recogido"],
      way: ["En tránsito", "In Transit", "En camino", "On the way"],
    };
    const { data: allPackages, error: packageError } = await supabase
      .from("paquetes_registro")
      .select("id, tracking, nombre_paqueteria, tipo_paquete, estado, invoice_status, approval_status, billing_total, fecha_descargado, hora_descargado")
      .eq("numero_cliente_id", client.id)
      .order("registro", { ascending: false })
      .limit(100);
    if (packageError) throw packageError;
    const packages = (allPackages || []).filter((item) => {
      const status = String(item.estado || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
      if (view === "ready") return status.includes("descargado") || status.includes("unloaded") || status.includes("ready for pickup") || status.includes("listo para recoger");
      return (statusFilters[view] || statusFilters.ready).some((allowed) => status === allowed.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase());
    });
    const collected = (allPackages || []).filter((item) => ["Entregado", "Picked Up", "Recogido"].includes(String(item.estado || ""))).length;
    const total = (allPackages || []).length;
    return NextResponse.json({ client, packages, view, summary: { collected, total, pending: Math.max(total - collected, 0) } });
  } catch (error) {
    return errorResponse(error);
  }
}
