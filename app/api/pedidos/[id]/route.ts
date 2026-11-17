import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Supabase environment variables are missing");
  return createClient(url, key);
}

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const supabase = getSupabase();
  const { id } = params;

  if (!id) {
    return NextResponse.json(
      { error: "El identificador del pedido es requerido" },
      { status: 400 },
    );
  }

  // Older mobile builds open a selected customer shipment by its tracking
  // number, while QR links may still pass the internal UUID. Support both
  // identifiers so a tracking click does not incorrectly return "not found".
  const shipmentFields =
    "tracking, nombre_paqueteria, tipo_paquete, contenido, estado, numero_cliente_id, fecha_descargado, hora_descargado, fecha_entregado, hora_entregado";
  const isUuid = /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(id);
  let lookup = supabase.from("paquetes_registro").select(shipmentFields);
  lookup = isUuid ? lookup.eq("id", id) : lookup.ilike("tracking", id.trim());
  const { data, error } = await lookup.maybeSingle();

  if (error) {
    return NextResponse.json(
      { error: error.message || "No se pudo consultar el pedido" },
      { status: 500 },
    );
  }

  if (!data) {
    return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });
  }

  return NextResponse.json({ pedido: data });
}
