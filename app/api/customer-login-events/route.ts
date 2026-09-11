import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
function adminClient() { const url = process.env.NEXT_PUBLIC_SUPABASE_URL; const key = process.env.SUPABASE_SERVICE_ROLE_KEY; if (!url || !key) throw new Error("Supabase server environment variables are missing"); return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } }); }
export async function POST(request: Request) {
  try {
    const { email } = await request.json();
    const supabase = adminClient();
    const normalized = String(email || "").trim().toLowerCase();
    if (normalized) await supabase.from("customer_password_reset_requests").insert({ email: normalized, status: "requested" });
    return NextResponse.json({ ok: true });
  } catch { return NextResponse.json({ ok: true }); }
}
