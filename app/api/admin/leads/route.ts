import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase server environment variables are missing");
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

async function requireAdmin(request: Request, supabase: ReturnType<typeof serviceClient>) {
  const header = request.headers.get("authorization") || "";
  if (!header.startsWith("Bearer ")) throw new Error("Authentication is required");
  const { data, error } = await supabase.auth.getUser(header.slice(7));
  if (error || !data.user) throw new Error("Invalid authentication token");
  const { data: admin } = await supabase.from("administradores").select("id").eq("id", data.user.id).maybeSingle();
  const role = String(data.user.app_metadata?.role || data.user.user_metadata?.role || "").toLowerCase();
  if (!admin && !["admin", "administrator"].includes(role)) throw new Error("Administrator access is required");
  return data.user;
}

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "Unable to load customer leads";
  const status = /authentication|required|administrator|invalid/i.test(message) ? 403 : 500;
  return NextResponse.json({ error: message }, { status });
}

export async function GET(request: Request) {
  try {
    const supabase = serviceClient();
    await requireAdmin(request, supabase);
    const { data, error } = await supabase
      .from("customer_leads")
      .select("id, nombre, email, mensaje, asunto, fuente, estado, creado_en")
      .order("creado_en", { ascending: false })
      .limit(500);
    if (error) throw error;
    return NextResponse.json({ leads: data || [] });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const supabase = serviceClient();
    await requireAdmin(request, supabase);
    const body = await request.json();
    const id = String(body?.id || "").trim();
    if (!id) return NextResponse.json({ error: "Lead id is required" }, { status: 400 });
    const update: Record<string, string> = {};
    if (typeof body.estado === "string") update.estado = body.estado;
    if (typeof body.mensaje === "string") update.mensaje = body.mensaje;
    if (!Object.keys(update).length) return NextResponse.json({ error: "No lead changes supplied" }, { status: 400 });
    const { data, error } = await supabase.from("customer_leads").update(update).eq("id", id).select("id, nombre, email, mensaje, asunto, fuente, estado, creado_en").single();
    if (error) throw error;
    return NextResponse.json({ lead: data });
  } catch (error) {
    return errorResponse(error);
  }
}
