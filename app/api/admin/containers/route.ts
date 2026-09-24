import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase server environment variables are missing");
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

async function requireAdmin(request: Request) {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) throw new Error("Authentication is required");
  const supabase = adminClient();
  const { data: userData, error: userError } = await supabase.auth.getUser(authorization.slice(7));
  if (userError || !userData.user) throw new Error("Invalid authentication token");
  const { data: admin, error: adminError } = await supabase
    .from("administradores")
    .select("id")
    .eq("id", userData.user.id)
    .maybeSingle();
  if (adminError || !admin) throw new Error("Administrator access is required");
  return supabase;
}

export async function GET(request: Request) {
  try {
    const supabase = await requireAdmin(request);
    const [{ data: containers, error: containerError }, { data: links, error: linkError }] = await Promise.all([
      supabase.from("contenedores").select("id, codigo, descripcion, creado_en, creado_por").order("creado_en", { ascending: false }),
      supabase.from("contenedor_paquetes").select("contenedor_id, paquete_id, creado_en"),
    ]);
    if (containerError) throw containerError;
    if (linkError) throw linkError;

    const packageIds = Array.from(new Set((links || []).map((link) => link.paquete_id).filter(Boolean)));
    const { data: shipments, error: shipmentError } = packageIds.length
      ? await supabase.from("paquetes_registro").select("id, tracking, nombre_paqueteria, tipo_paquete, contenido, notas, creado_en, registro, estado, hora_fecha, descargado, fecha_descargado, hora_descargado, fecha_entregado, hora_entregado, numero_cliente_id, billing_subtotal, billing_tax, billing_total").in("id", packageIds)
      : { data: [], error: null };
    if (shipmentError) throw shipmentError;

    const customerIds = Array.from(new Set((shipments || []).map((shipment) => shipment.numero_cliente_id).filter(Boolean)));
    const { data: customers, error: customerError } = customerIds.length
      ? await supabase.from("numero_cliente").select("id, numero_cliente, nombre, email, telefono, puerto, tipo_cuenta").in("id", customerIds)
      : { data: [], error: null };
    if (customerError) throw customerError;

    const checkinIds = packageIds;
    const { data: checkins, error: checkinError } = checkinIds.length
      ? await supabase.from("paquetes_checkin").select("paquete_id, alto, ancho, largo, peso, problema, problema_notas, cargos_adicionales, consolidacion, parent_box_id, creado_en").in("paquete_id", checkinIds)
      : { data: [], error: null };
    if (checkinError) throw checkinError;

    const customerById = new Map((customers || []).map((customer) => [customer.id, customer]));
    const shipmentById = new Map((shipments || []).map((shipment) => [shipment.id, shipment]));
    const checkinByPackageId = new Map((checkins || []).map((checkin) => [checkin.paquete_id, checkin]));
    const linksByContainer = new Map<string, any[]>();
    for (const link of links || []) {
      const shipment = shipmentById.get(link.paquete_id);
      if (!shipment) continue;
      const customer = customerById.get(shipment.numero_cliente_id);
      const checkin = checkinByPackageId.get(link.paquete_id);
      const row = { ...shipment, customer: customer || null, checkin: checkin || null, linked_at: link.creado_en };
      const current = linksByContainer.get(link.contenedor_id) || [];
      current.push(row);
      linksByContainer.set(link.contenedor_id, current);
    }

    return NextResponse.json({
      containers: (containers || []).map((container) => ({
        ...container,
        shipments: linksByContainer.get(container.id) || [],
      })),
    });
  } catch (error: any) {
    const message = error?.message || "Could not load containers";
    return NextResponse.json({ error: message }, { status: message.includes("required") || message.includes("Administrator") ? 403 : 500 });
  }
}
