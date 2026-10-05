import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { centralAmericaDateParts } from "@/lib/staff-date-format";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Supabase environment variables are missing");
  return createClient(url, key);
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } },
) {
  const supabase = getSupabase();
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
  const now = centralAmericaDateParts();
  if (estado === "Descargado") {
    payload.fecha_descargado = now.date;
    payload.hora_descargado = now.time;
    if (usuario) {
      payload.descargado = usuario;
    }
  }
  if (estado === "Entregado") {
    payload.fecha_entregado = now.date;
    payload.hora_entregado = now.time;
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
