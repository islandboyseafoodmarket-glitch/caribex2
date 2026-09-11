import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
function adminClient() { const url = process.env.NEXT_PUBLIC_SUPABASE_URL; const key = process.env.SUPABASE_SERVICE_ROLE_KEY; if (!url || !key) throw new Error("Supabase server environment variables are missing"); return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } }); }
export async function POST(request: Request) {
  const supabase = adminClient();
  try {
    const body = await request.json();
    const name = String(body?.nombre || "").trim();
    const email = String(body?.email || "").trim().toLowerCase();
    const phone = String(body?.telefono || "").trim();
    const port = String(body?.puerto || "").trim();
    const accountType = String(body?.tipoCuenta || "Personal");
    if (!name || !email || !phone || !port) return NextResponse.json({ error: "All required customer fields must be completed" }, { status: 400 });
    const { data: existing } = await supabase.from("numero_cliente").select("id").eq("email", email).maybeSingle();
    if (existing) return NextResponse.json({ error: "A customer with this email already exists" }, { status: 409 });
    const { data: maxRow } = await supabase.from("numero_cliente").select("numero_cliente").order("numero_cliente", { ascending: false }).limit(1).maybeSingle();
    const accountNumber = Math.max(Number(maxRow?.numero_cliente || 299) + 1, 300);
    const initialPassword = `Caribex${accountNumber}`;
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({ email, password: initialPassword, email_confirm: true, user_metadata: { customer_account_number: accountNumber, must_change_password: true } });
    if (authError || !authData.user) throw authError || new Error("Could not create customer login");
    const { error: insertError } = await supabase.from("numero_cliente").insert({ nombre: name, email, telefono: phone, puerto: port, tipo_cuenta: accountType, numero_cliente: accountNumber, auth_user_id: authData.user.id });
    if (insertError) { await supabase.auth.admin.deleteUser(authData.user.id); throw insertError; }
    return NextResponse.json({ accountNumber, initialPassword });
  } catch (error: any) { return NextResponse.json({ error: error?.message || "Could not create customer account" }, { status: 500 }); }
}
