import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase server environment variables are missing");
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = String(body?.email || "").trim().toLowerCase();
    if (!email) return NextResponse.json({ ok: true });

    const supabase = adminClient();
    const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
    const { data: customer } = await supabase
      .from("numero_cliente")
      .select("nombre, numero_cliente")
      .eq("email", email)
      .maybeSingle();
    await supabase.from("customer_portal_login_events").insert({
      email,
      customer_name: customer?.nombre || null,
      account_number: customer?.numero_cliente || null,
      event_type: String(body?.eventType || "login_attempt"),
      success: body?.success === true,
      reason: body?.reason ? String(body.reason).slice(0, 240) : null,
      ip_address: forwardedFor,
      user_agent: request.headers.get("user-agent"),
    });
    return NextResponse.json({ ok: true });
  } catch {
    // Login telemetry must never block or reveal information during sign-in.
    return NextResponse.json({ ok: true });
  }
}
