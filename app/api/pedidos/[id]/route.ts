import { NextResponse } from "next/server";
import { supabase } from "../../../../lib/supabaseClient";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const { id } = params;

  if (!id) {
    return NextResponse.json(
      { error: "El identificador del pedido es requerido" },
      { status: 400 },
    );
  }

  const { data, error } = await supabase
    .from("paquetes_registro")
    .select(
      "tracking, nombre_paqueteria, tipo_paquete, contenido, notas, estado, numero_cliente_id, fecha_descargado, hora_descargado, fecha_entregado, hora_entregado",
    )
    .eq("id", id)
    .maybeSingle();

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
