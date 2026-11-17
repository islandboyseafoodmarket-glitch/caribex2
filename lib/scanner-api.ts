import { createHash } from "crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_RATE_LIMIT_BUCKETS = 5000;

type RateLimitBucket = {
  count: number;
  resetAt: number;
};

type ScannerActor = {
  actorId: string | null;
  actorName: string;
  actorEmail: string | null;
  actorRole: string;
  authenticated: boolean;
};

type AuthenticatedStaff = {
  user: { id: string; email?: string | null };
  role: "admin" | "staff";
};

const rateLimitBuckets = new Map<string, RateLimitBucket>();

export function createAdminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase server environment variables are missing");
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

export function createPublicAuthClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Supabase public environment variables are missing");
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

export function requestIp(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    "unknown"
  );
}

/**
 * Best-effort per-instance throttling for public mobile endpoints. The gateway
 * remains the right place for durable/global throttling; this prevents burst
 * abuse without adding a database table or migration to the app.
 */
export function checkRateLimit(key: string, limit: number, windowMs: number): { allowed: boolean; retryAfterSeconds: number } {
  const now = Date.now();
  if (rateLimitBuckets.size > MAX_RATE_LIMIT_BUCKETS) {
    Array.from(rateLimitBuckets.entries()).forEach(([bucketKey, bucket]) => {
      if (bucket.resetAt <= now) rateLimitBuckets.delete(bucketKey);
    });
  }

  const existing = rateLimitBuckets.get(key);
  if (!existing || existing.resetAt <= now) {
    rateLimitBuckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (existing.count >= limit) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }

  existing.count += 1;
  return { allowed: true, retryAfterSeconds: 0 };
}

export function rateLimitResponse(retryAfterSeconds: number) {
  return new Response(JSON.stringify({ error: "Too many requests. Please try again later." }), {
    status: 429,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "Retry-After": String(retryAfterSeconds),
    },
  });
}

export function normalizeEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  return email && email.length <= 320 && EMAIL_PATTERN.test(email) ? email : null;
}

export function publicOrigin(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || "https://www.caribexlogisticsgroup.com").replace(/\/$/, "");
}

function bearerToken(request: Request): string | null {
  const authorization = request.headers.get("authorization") || "";
  if (!authorization.startsWith("Bearer ")) return null;
  const token = authorization.slice("Bearer ".length).trim();
  return token || null;
}

function scannerSessionHash(request: Request): string | null {
  const token = request.headers.get("x-scanner-session")?.trim();
  return token ? createHash("sha256").update(token).digest("hex") : null;
}

export async function resolveScannerActor(request: Request, supabase: SupabaseClient): Promise<ScannerActor> {
  const token = bearerToken(request);
  if (!token) {
    return {
      actorId: null,
      actorName: "Anonymous mobile user",
      actorEmail: null,
      actorRole: "anonymous",
      authenticated: false,
    };
  }

  const { data: authData, error: authError } = await supabase.auth.getUser(token);
  if (authError || !authData.user) {
    return {
      actorId: null,
      actorName: "Anonymous mobile user",
      actorEmail: null,
      actorRole: "anonymous",
      authenticated: false,
    };
  }

  const [{ data: admin }, { data: staff }] = await Promise.all([
    supabase.from("administradores").select("id, rol").eq("id", authData.user.id).maybeSingle(),
    supabase.from("personal").select("id, rol, nombre, nombre_personal").eq("id", authData.user.id).maybeSingle(),
  ]);
  const actorName = admin
    ? "Admin"
    : staff?.nombre || staff?.nombre_personal ||
      (authData.user.user_metadata?.full_name as string | undefined) ||
      authData.user.email ||
      "Authenticated user";

  return {
    actorId: authData.user.id,
    actorName,
    actorEmail: authData.user.email || null,
    actorRole: admin ? "admin" : staff ? "staff" : "authenticated_user",
    authenticated: true,
  };
}

export async function requireStaffOrAdmin(request: Request, supabase: SupabaseClient): Promise<AuthenticatedStaff> {
  const token = bearerToken(request);
  if (!token) throw new Error("Authentication is required");

  const { data: authData, error: authError } = await supabase.auth.getUser(token);
  if (authError || !authData.user) throw new Error("Invalid authentication token");

  const [{ data: admin }, { data: staff }] = await Promise.all([
    supabase.from("administradores").select("id").eq("id", authData.user.id).maybeSingle(),
    supabase.from("personal").select("id").eq("id", authData.user.id).maybeSingle(),
  ]);
  if (!admin && !staff) throw new Error("Staff access is required");

  const activeSessionHash = scannerSessionHash(request);
  if (!activeSessionHash) throw new Error("Scanner session is missing. Sign in again.");
  const { data: activeSession, error: sessionError } = await supabase
    .from("scanner_active_sessions")
    .select("session_hash")
    .eq("user_id", authData.user.id)
    .maybeSingle();
  if (sessionError || activeSession?.session_hash !== activeSessionHash) {
    throw new Error("This scanner session was replaced by a newer sign-in. Please sign in again.");
  }

  return { user: authData.user, role: admin ? "admin" : "staff" };
}

export function isValidEmail(value: string): boolean {
  return value.length <= 320 && EMAIL_PATTERN.test(value);
}

export function jsonResponse(body: unknown, init?: ResponseInit): Response {
  const headers = new Headers(init?.headers);
  headers.set("Content-Type", "application/json");
  headers.set("Cache-Control", "no-store");
  return new Response(JSON.stringify(body), { ...init, headers });
}

export function authErrorResponse(error: unknown): Response {
  const message = error instanceof Error ? error.message : "Unexpected error";
  const status = /authentication|token|required/i.test(message) ? 401 : /access/i.test(message) ? 403 : 500;
  return jsonResponse({ error: message }, { status });
}
