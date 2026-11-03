import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const PREPAID_ACCOUNT_TYPE = "Developer / Builder — Prepaid";
const RESEND_API_KEY = process.env.RESEND_API_KEY;

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character] || character);
}

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

    const { data: customer, error: customerError } = await supabase
      .from("numero_cliente")
      .select("id, nombre, numero_cliente, email, telefono, puerto, tipo_cuenta, prepaid_allowance_cubic_feet, prepaid_used_cubic_feet, creado_en")
      .eq("email", userData.user.email.toLowerCase())
      .maybeSingle();
    if (customerError) throw customerError;
    if (!customer) return NextResponse.json({ error: "Customer profile not found" }, { status: 404 });

    const isPrepaid = customer.tipo_cuenta === PREPAID_ACCOUNT_TYPE;
    const packageFields = isPrepaid
      ? "id, tracking, nombre_paqueteria, tipo_paquete, contenido, estado, registro, hora_fecha, fecha_transito, fecha_descargado, fecha_entregado, hora_entregado, cubic_feet, prepaid_review_required, prepaid_review_status"
      : "id, tracking, nombre_paqueteria, tipo_paquete, contenido, estado, registro, hora_fecha, fecha_transito, fecha_descargado, fecha_entregado, hora_entregado";

    const [{ data: packages, error: packageError }, { data: invoices, error: invoiceError }, { data: ferry, error: ferryError }] = await Promise.all([
      // Staff-only notes and prepaid review fields are intentionally omitted from standard accounts.
      supabase.from("paquetes_registro").select(packageFields).eq("numero_cliente_id", customer.id).order("registro", { ascending: false }),
      supabase.from("paquetes_registro").select("id, tracking, nombre_paqueteria, tipo_paquete, contenido, billing_subtotal, billing_tax, billing_total, approval_status, invoice_status, payment_method, payment_date, registro, creado_en").eq("numero_cliente_id", customer.id).not("billing_total", "is", null).order("registro", { ascending: false }),
      supabase.from("ferry_manifest_entries").select("id, puerto, numero_reserva, nombre_receptor, enviado_en, manifiesto_id").eq("numero_cliente_id", customer.id).order("enviado_en", { ascending: false }),
    ]);
    if (packageError || invoiceError || ferryError) throw packageError || invoiceError || ferryError;

    const client = {
      nombre: customer.nombre,
      numero_cliente: customer.numero_cliente,
      email: customer.email,
      telefono: customer.telefono,
      puerto: customer.puerto,
      tipo_cuenta: customer.tipo_cuenta,
      ...(isPrepaid ? {
        prepaid_allowance_cubic_feet: customer.prepaid_allowance_cubic_feet,
        prepaid_used_cubic_feet: customer.prepaid_used_cubic_feet,
      } : {}),
    };

    return NextResponse.json({ client, packages: packages || [], invoices: invoices || [], ferry: ferry || [] }, { headers: { "Cache-Control": "private, no-store" } });
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

    const { data: client } = await supabase
      .from("numero_cliente")
      .select("id, nombre, email, auth_user_id, numero_cliente")
      .eq("email", email)
      .maybeSingle();
    await supabase.from("customer_password_reset_requests").insert({ numero_cliente_id: client?.id || null, email });

    if (client?.auth_user_id && client.email && RESEND_API_KEY) {
      const resetUrl = "https://www.caribexlogisticsgroup.com/?recovery=1";
      const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({ type: "recovery", email: client.email, options: { redirectTo: resetUrl } });
      if (!linkError && linkData.properties?.action_link) {
        const recoveryLink = new URL(linkData.properties.action_link);
        recoveryLink.searchParams.set("redirect_to", resetUrl);
        const safeName = escapeHtml(client.nombre || "Customer");
        const safeLink = escapeHtml(recoveryLink.toString());
        const html = `<p>Hello ${safeName},</p><p>Use the button below to change your CARIBEX LOGISTICS GROUP portal password.</p><p><a href="${safeLink}" style="display:inline-block;background:#0f4c81;color:#fff;padding:12px 18px;border-radius:8px;text-decoration:none;font-weight:700">Change your password</a></p><p>Hola ${safeName},</p><p>Usa el botón para cambiar la contraseña de tu portal de CARIBEX LOGISTICS GROUP.</p><p>This link expires according to your Supabase Auth settings.</p>`;
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({ from: "info@caribexlogisticsgroup.com", to: client.email, subject: "CARIBEX LOGISTICS GROUP customer portal password reset / Restablecimiento de contraseña", html }),
        });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Could not record reset request" }, { status: 500 });
  }
}
