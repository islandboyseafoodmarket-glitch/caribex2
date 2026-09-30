import { NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function client() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase server environment variables are missing");
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

async function staff(request: Request, supabase: SupabaseClient) {
  const header = request.headers.get("authorization") || "";
  if (!header.startsWith("Bearer ")) throw new Error("Authentication is required");
  const { data, error } = await supabase.auth.getUser(header.slice(7));
  if (error || !data.user) throw new Error("Invalid authentication token");
  const [{ data: admin }, { data: member }] = await Promise.all([
    supabase.from("administradores").select("id, rol").eq("id", data.user.id).maybeSingle(),
    supabase.from("personal").select("id, rol, nombre, nombre_personal").eq("id", data.user.id).maybeSingle(),
  ]);
  if (!admin && !member) throw new Error("Staff access is required");
  return { user: data.user, role: admin ? "admin" : "staff", profile: member || admin };
}

export async function POST(request: Request) {
  try {
    const supabase = client();
    const actor = await staff(request, supabase);
    const body = await request.json();
    if (String(body?.next_key || "") !== "IN_TRANSIT") {
      return NextResponse.json({ error: "Only bulk Check In to In-Transit is supported" }, { status: 400 });
    }
    const { data: rows, error: listError } = await supabase
      .from("paquetes_registro")
      .select("id, tracking")
      .in("estado", ["Registrado", "Check In", "Check-in"])
      .limit(500);
    if (listError) throw listError;
    const ids = (rows || []).map((row) => row.id);
    if (!ids.length) return NextResponse.json({ ok: true, moved: 0 });
    const { error: updateError } = await supabase.from("paquetes_registro").update({ estado: "En tránsito" }).in("id", ids);
    if (updateError) throw updateError;
    await supabase.from("staff_action_logs").insert({
      actor_id: actor.user.id,
      actor_name: actor.profile?.nombre || actor.profile?.nombre_personal || actor.user.email || null,
      actor_email: actor.user.email || null,
      actor_role: actor.role,
      action: "bulk_workflow_status_change",
      entity_type: "paquetes_registro",
      entity_id: null,
      success: true,
      details: { from_status: "Registrado", to_status: "En tránsito", moved: ids.length, source: "scanner_workflow_app" },
      user_agent: request.headers.get("user-agent") || null,
    });
    return NextResponse.json({ ok: true, moved: ids.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: /authentication|token|access|required/i.test(message) ? 401 : 500 });
  }
}
