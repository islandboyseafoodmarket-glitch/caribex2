import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase server environment variables are missing");
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

export async function GET(request: Request) {
  try {
    const bearer = request.headers.get("authorization") || "";
    const token = bearer.startsWith("Bearer ") ? bearer.slice(7) : "";
    if (!token) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    const supabase = adminClient();
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData.user?.email) return NextResponse.json({ error: "Invalid session" }, { status: 401 });
    const { data: client, error: clientError } = await supabase.from("numero_cliente").select("id, nombre, numero_cliente, email, telefono, puerto, tipo_cuenta, creado_en").eq("email", userData.user.email.toLowerCase()).maybeSingle();
    if (clientError) throw clientError;
    if (!client) return NextResponse.json({ error: "Customer profile not found" }, { status: 404 });
    const [{ data: packages, error: packageError }, { data: invoices, error: invoiceError }, { data: ferry, error: ferryError }] = await Promise.all([
      supabase.from("paquetes_registro").select("id, tracking, nombre_paqueteria, tipo_paquete, contenido, estado, registro, fecha_entregado, problema, problema_notas").eq("numero_cliente_id", client.id).order("registro", { ascending: false }),
      supabase.from("paquetes_registro").select("id, tracking, billing_subtotal, billing_tax, billing_total, approval_status, invoice_status").eq("numero_cliente_id", client.id).not("billing_total", "is", null).order("registro", { ascending: false }),
      supabase.from("ferry_manifest_entries").select("id, puerto, numero_reserva, nombre_receptor, enviado_en, manifiesto_id").eq("numero_cliente_id", client.id).order("enviado_en", { ascending: false }),
    ]);
    if (packageError || invoiceError || ferryError) throw packageError || invoiceError || ferryError;
    return NextResponse.json({ client, packages: packages || [], invoices: invoices || [], ferry: ferry || [] });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Could not load customer portal" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = String(body?.email || "").trim().toLowerCase();
    const supabase = adminClient();
    if (!email || !email.includes("@")) return NextResponse.json({ error: "A valid email is required" }, { status: 400 });
    const { data: client } = await supabase.from("numero_cliente").select("id").eq("email", email).maybeSingle();
    await supabase.from("customer_password_reset_requests").insert({ numero_cliente_id: client?.id || null, email });
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Could not record reset request" }, { status: 500 });
  }
}
