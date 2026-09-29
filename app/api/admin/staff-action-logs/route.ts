import { NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase server environment variables are missing");
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

async function requireStaff(request: Request, supabase: SupabaseClient) {
  const authorization = request.headers.get("authorization") || "";
  if (!authorization.startsWith("Bearer ")) throw new Error("Authentication is required");
  const token = authorization.slice("Bearer ".length);
  const { data: authData, error: authError } = await supabase.auth.getUser(token);
  if (authError || !authData.user) throw new Error("Invalid authentication token");

  const [{ data: admin }, { data: staff }] = await Promise.all([
    supabase.from("administradores").select("id, rol").eq("id", authData.user.id).maybeSingle(),
    supabase.from("personal").select("id, rol, nombre, nombre_personal").eq("id", authData.user.id).maybeSingle(),
  ]);
  if (!admin && !staff) throw new Error("Staff access is required");
  const profile = staff
    ? { nombre: staff.nombre, nombre_personal: staff.nombre_personal, rol: staff.rol }
    : { nombre: null, nombre_personal: null, rol: admin?.rol || "administrador" };
  return { user: authData.user, role: admin ? "admin" : "staff", profile };
}

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "Unexpected error";
  const status = message.includes("required") || message.includes("token") || message.includes("access") ? 401 : 500;
  return NextResponse.json({ error: message }, { status });
}

export async function GET(request: Request) {
  try {
    const supabase = adminClient();
    await requireStaff(request, supabase);
    const url = new URL(request.url);
    const search = url.searchParams.get("search")?.trim() || "";
    const action = url.searchParams.get("action")?.trim() || "";
    const limit = Math.min(Math.max(Number(url.searchParams.get("limit") || 200), 1), 500);

    let query = supabase
      .from("staff_action_logs")
      .select("id, actor_id, actor_name, actor_email, actor_role, action, entity_type, entity_id, tracking, customer_name, customer_account_number, success, error_message, details, ip_address, user_agent, created_at")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (action && action !== "ALL") query = query.eq("action", action);
    if (search) {
      const escaped = search.replace(/,/g, " ");
      query = query.or(`actor_name.ilike.%${escaped}%,actor_email.ilike.%${escaped}%,tracking.ilike.%${escaped}%,customer_name.ilike.%${escaped}%,entity_type.ilike.%${escaped}%`);
    }
    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json({ logs: data || [] });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const supabase = adminClient();
    const actor = await requireStaff(request, supabase);
    const body = await request.json();
    const action = String(body?.action || "").trim();
    const entityType = String(body?.entity_type || "").trim();
    if (!action || !entityType) return NextResponse.json({ error: "action and entity_type are required" }, { status: 400 });

    const { data, error } = await supabase.from("staff_action_logs").insert({
      actor_id: actor.user.id,
      actor_name: actor.profile?.nombre || actor.profile?.nombre_personal || actor.user.email || null,
      actor_email: actor.user.email || null,
      actor_role: actor.role,
      action,
      entity_type: entityType,
      entity_id: body?.entity_id || null,
      tracking: body?.tracking || null,
      customer_name: body?.customer_name || null,
      customer_account_number: body?.customer_account_number || null,
      success: body?.success !== false,
      error_message: body?.error_message || null,
      details: body?.details && typeof body.details === "object" ? body.details : {},
      ip_address: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null,
      user_agent: request.headers.get("user-agent") || null,
    }).select("id, created_at").single();
    if (error) throw error;
    return NextResponse.json({ ok: true, log: data });
  } catch (error) {
    return errorResponse(error);
  }
}
