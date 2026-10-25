import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const RESEND_API_KEY = process.env.RESEND_API_KEY;

function escapeHtml(value: unknown) {
  return String(value ?? "").replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;",
  })[character] || character);
}

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase server environment variables are missing");
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

export async function POST(request: Request) {
  try {
    const supabase = adminClient();
    const bearer = request.headers.get("authorization") || "";
    const { data: authData, error: authError } = await supabase.auth.getUser(bearer.startsWith("Bearer ") ? bearer.slice(7) : "");
    if (authError || !authData.user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    const { data: admin } = await supabase.from("administradores").select("id").eq("id", authData.user.id).maybeSingle();
    if (!admin) return NextResponse.json({ error: "Administrator access required" }, { status: 403 });

    const { customer_id, allowance } = await request.json();
    const { data: customer, error: customerError } = await supabase
      .from("numero_cliente")
      .select("nombre, email, numero_cliente, puerto, tipo_cuenta, prepaid_allowance_cubic_feet")
      .eq("id", customer_id)
      .maybeSingle();
    if (customerError) throw customerError;
    if (!customer?.email) return NextResponse.json({ error: "Developer does not have an email address" }, { status: 400 });
    if (customer.tipo_cuenta !== "Developer / Builder — Prepaid") return NextResponse.json({ error: "Customer is not a Developer / Builder prepaid account" }, { status: 400 });
    if (!RESEND_API_KEY) return NextResponse.json({ error: "Email service is not configured" }, { status: 503 });

    const safeName = escapeHtml(customer.nombre || "Developer / Builder");
    const safeAccount = escapeHtml(customer.numero_cliente);
    const safeAllowance = escapeHtml(Number(allowance ?? customer.prepaid_allowance_cubic_feet ?? 0).toFixed(2));
    const safePort = escapeHtml(customer.puerto || "Not specified");
    const portalUrl = "https://www.caribexlogisticsgroup.com/portal/login";
    const html = `<!DOCTYPE html><html><body style="margin:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;color:#0f172a;"><div style="max-width:680px;margin:0 auto;padding:28px 16px;"><div style="background:#fff;border-radius:16px;padding:32px;box-shadow:0 8px 24px rgba(15,23,42,.08);"><div style="text-align:center;margin-bottom:24px;"><div style="font-size:24px;font-weight:800;color:#0f4c81;">Caribex Logistics Group</div><div style="font-size:12px;color:#64748b;margin-top:4px;">Developer / Builder account approval</div></div><h1 style="font-size:22px;margin:0 0 16px;">Your account is approved, ${safeName}</h1><p style="line-height:1.6;margin:0 0 14px;">Your Caribex Developer / Builder prepaid account has been approved and is ready for eligible shipments.</p><p style="line-height:1.6;margin:0 0 18px;">Su cuenta prepaga de Desarrollador / Constructor de Caribex fue aprobada y está lista para envíos elegibles.</p><div style="background:#dcfce7;border:1px solid #86efac;border-radius:12px;padding:18px;margin:22px 0;"><h2 style="font-size:16px;margin:0 0 10px;color:#166534;">Approved account details</h2><p style="margin:6px 0;"><strong>Account number / Número:</strong> ${safeAccount}</p><p style="margin:6px 0;"><strong>Assigned allowance / Límite asignado:</strong> ${safeAllowance} ft³</p><p style="margin:6px 0;"><strong>Port / Puerto:</strong> ${safePort}</p><p style="margin:6px 0;"><strong>Status / Estado:</strong> Approved / Activa</p></div><h2 style="font-size:17px;margin:24px 0 10px;">What happens next</h2><ol style="line-height:1.7;margin:0 0 16px;padding-left:22px;"><li>Your prepaid allowance is reduced as eligible shipments are received and measured.</li><li>You can view used cubic feet and your remaining balance in the Customer Portal.</li><li>Shipments that exceed the remaining allowance may require Admin review before completion.</li><li>Contact Caribex if you need additional cubic-foot capacity or your project volume changes.</li></ol><p style="text-align:center;margin:22px 0;"><a href="${portalUrl}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:8px;">Open Customer Portal</a></p><p style="line-height:1.6;margin:0;">Please keep this email for your records. Need help? Contact Caribex at <strong>+50489467476</strong>.</p></div><p style="font-size:12px;color:#64748b;text-align:center;margin:16px 0 0;">This is an automatic account-approval message.</p></div></body></html>`;
    const sent = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "info@caribexlogisticsgroup.com", to: customer.email, subject: `Caribex Logistics — Your Developer / Builder account is approved ${customer.numero_cliente}`, html }) });
    if (!sent.ok) return NextResponse.json({ error: "Failed to send approval email" }, { status: 502 });
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("Error sending prepaid approval email", error);
    return NextResponse.json({ error: error?.message || "Could not send approval email" }, { status: 500 });
  }
}
