import { NextResponse } from "next/server";
import { supabase } from "../../../../../lib/supabaseClient";

export async function POST(
  request: Request,
  { params }: { params: { id: string } },
) {
  const { id } = params;
  const body = await request.json();
  const { estado, usuario } = body;

  if (!id || !estado) {
    return NextResponse.json(
      { error: "ID y estado son obligatorios" },
      { status: 400 },
    );
  }

  const payload: Record<string, any> = { estado };
  const now = new Date();
  if (estado === "Descargado") {
    payload.fecha_descargado = now.toISOString().split("T")[0];
    payload.hora_descargado = now.toTimeString().split(" ")[0];
    if (usuario) {
      payload.descargado = usuario;
    }
  }
  if (estado === "Entregado") {
    payload.fecha_entregado = now.toISOString().split("T")[0];
    payload.hora_entregado = now.toTimeString().split(" ")[0];
    if (usuario) {
      payload.entregado_por = usuario;
    }
  }

  const { error } = await supabase
    .from("paquetes_registro")
    .update(payload)
    .eq("id", id);

  if (error) {
    return NextResponse.json(
      { error: error.message || "No se pudo actualizar el estado" },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
