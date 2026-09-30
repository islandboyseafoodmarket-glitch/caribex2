import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase environment variables are missing");
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

export async function POST(request: Request) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const { id } = await request.json();

    if (!id) {
      return NextResponse.json(
        { error: "Falta el id del usuario" },
        { status: 400 },
      );
    }

    // 1. Borrar de tabla personal (si existe)
    const { error: personalError } = await supabaseAdmin
      .from("personal")
      .delete()
      .eq("id", id);

    if (personalError) {
      return NextResponse.json(
        { error: personalError.message },
        { status: 400 },
      );
    }

    // 2. Borrar del sistema de Auth
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(id);

    if (authError) {
      return NextResponse.json(
        { error: authError.message },
        { status: 400 },
      );
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Error inesperado" },
      { status: 500 },
    );
  }
}
