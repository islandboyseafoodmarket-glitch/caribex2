import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !serviceRoleKey) {
  // Solo log en servidor
  console.warn(
    "Supabase URL o SUPABASE_SERVICE_ROLE_KEY no están configurados. Revisa tu .env.local",
  );
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

export async function POST(request: Request) {
  try {
    const { email, nombre, password } = await request.json();

    if (!email || !nombre || !password) {
      return NextResponse.json(
        { error: "Faltan campos requeridos" },
        { status: 400 },
      );
    }

    // 1. Crear usuario en Supabase Auth
    const { data: userData, error: authError } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });

    if (authError || !userData?.user) {
      console.error("Supabase Auth error:", authError);
      return NextResponse.json(
        { error: authError?.message || "No se pudo crear el usuario" },
        { status: 400 },
      );
    }

    const userId = userData.user.id;

    // 2. Insertar en tabla personal (vínculo con rol y nombre)
    const { error: insertError } = await supabaseAdmin
      .from("personal")
      .insert({ id: userId, nombre, rol: "personal" });

    if (insertError) {
      return NextResponse.json(
        { error: insertError.message },
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
