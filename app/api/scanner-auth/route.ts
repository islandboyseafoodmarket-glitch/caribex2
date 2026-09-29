import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const WORKFLOW_ROLES = ["Receiving", "Check In", "Container Unloading", "Client Pickup"];

function approvedRoles(value: unknown, isAdmin: boolean) {
  if (isAdmin) return WORKFLOW_ROLES;
  if (Array.isArray(value)) return value.filter((role): role is string => typeof role === "string" && WORKFLOW_ROLES.includes(role));
  if (typeof value === "string") {
    const roles = value.split(/[,|;]/).map((role) => role.trim()).filter(Boolean);
    return roles.flatMap((role) => WORKFLOW_ROLES.filter((candidate) => candidate.toLowerCase() === role.toLowerCase()));
  }
  return [];
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
    const body = await request.json();
    const email = String(body?.email || "").trim().toLowerCase();
    const password = String(body?.password || "");
    const refreshToken = String(body?.refresh_token || "");
    const authClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { autoRefreshToken: false, persistSession: false } });

    const result = refreshToken
      ? await authClient.auth.refreshSession({ refresh_token: refreshToken })
      : await authClient.auth.signInWithPassword({ email, password });
    if (result.error || !result.data.session || !result.data.user) return NextResponse.json({ error: result.error?.message || "Invalid login" }, { status: 401 });

    const userId = result.data.user.id;
    const [{ data: admin }, { data: staff }] = await Promise.all([
      supabase.from("administradores").select("id, rol").eq("id", userId).maybeSingle(),
      supabase.from("personal").select("id, nombre, nombre_personal, rol").eq("id", userId).maybeSingle(),
    ]);
    if (!admin && !staff) return NextResponse.json({ error: "This account is not authorized for warehouse workflow access" }, { status: 403 });

    return NextResponse.json({
      session: { access_token: result.data.session.access_token, refresh_token: result.data.session.refresh_token },
      operator: staff?.nombre || staff?.nombre_personal || result.data.user.email || "Staff",
      role: admin ? "admin" : "staff",
      approved_roles: approvedRoles(staff?.rol, Boolean(admin)),
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Authentication failed" }, { status: 500 });
  }
}
