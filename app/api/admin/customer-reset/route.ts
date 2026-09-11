import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
const RESEND_API_KEY = process.env.RESEND_API_KEY;
function adminClient() { const url = process.env.NEXT_PUBLIC_SUPABASE_URL; const key = process.env.SUPABASE_SERVICE_ROLE_KEY; if (!url || !key) throw new Error("Supabase server environment variables are missing"); return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } }); }
export async function POST(request: Request) {
  try {
    const bearer = request.headers.get("authorization") || "";
    const supabase = adminClient();
    const { data: authData, error: authError } = await supabase.auth.getUser(bearer.startsWith("Bearer ") ? bearer.slice(7) : "");
    if (authError || !authData.user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    const { data: admin } = await supabase.from("administradores").select("id").eq("id", authData.user.id).maybeSingle();
    if (!admin) return NextResponse.json({ error: "Administrator access required" }, { status: 403 });
    const { customer_id } = await request.json();
    const { data: customer } = await supabase.from("numero_cliente").select("nombre, email, auth_user_id, numero_cliente").eq("id", customer_id).maybeSingle();
    if (!customer?.email || !customer.auth_user_id) return NextResponse.json({ error: "Customer does not have a portal account" }, { status: 400 });
    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({ type: "recovery", email: customer.email, options: { redirectTo: `${new URL(request.url).origin}/portal` } });
    if (linkError || !linkData.properties?.action_link) throw linkError || new Error("Could not generate reset link");
    if (!RESEND_API_KEY) return NextResponse.json({ error: "Email service is not configured" }, { status: 503 });
    const html = `<p>Hello ${customer.nombre || "Customer"},</p><p>An administrator requested a password reset for your Caribex account #${customer.numero_cliente}.</p><p><a href="${linkData.properties.action_link}">Change your password</a></p><p>This link expires according to your Supabase Auth settings.</p>`;
    const sent = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "billing@caribexlogisticsgroup.com", to: customer.email, subject: "Caribex password reset", html }) });
    if (!sent.ok) throw new Error("Failed to send reset email");
    await supabase.from("customer_password_reset_requests").update({ status: "completed", handled_at: new Date().toISOString(), handled_by: authData.user.id }).eq("email", customer.email).eq("status", "requested");
    return NextResponse.json({ ok: true });
  } catch (error: any) { return NextResponse.json({ error: error?.message || "Could not reset customer password" }, { status: 500 }); }
}
