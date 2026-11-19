import { randomInt } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { FERRY_PORT_ORDER, normalizeFerryPort } from "@/lib/shipping-rules";

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
  const { data, error } = await supabase.auth.getUser(authorization.slice(7));
  if (error || !data.user) throw new Error("Invalid authentication token");
  const [{ data: admin, error: adminError }, { data: staff, error: staffError }] = await Promise.all([
    supabase.from("administradores").select("id").eq("id", data.user.id).maybeSingle(),
    supabase.from("personal").select("id").eq("id", data.user.id).maybeSingle(),
  ]);
  if (adminError || staffError) throw new Error("Unable to verify staff access");
  if (!admin && !staff) throw new Error("Staff access is required");
  return data.user.id;
}

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "Unexpected error";
  const status = /authentication|token|access|required/i.test(message) ? 401 : 500;
  return NextResponse.json({ error: message }, { status });
}

function createTrackingCode() {
  return `${String(randomInt(0, 100000)).padStart(5, "0")}-2026-Caribex`;
}

export async function GET(request: Request) {
  try {
    const supabase = adminClient();
    await requireStaff(request, supabase);
    const { data, error } = await supabase
      .from("caribex_manual_labels")
      .select("id, tracking, created_at, account_number, destination_port")
      .eq("status", "available")
      .order("created_at", { ascending: false })
      .limit(5000);
    if (error) throw error;
    return NextResponse.json({ labels: data || [] });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const supabase = adminClient();
    const actorId = await requireStaff(request, supabase);
    let body: { count?: unknown; accountNumber?: unknown; destinationPort?: unknown };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "A valid JSON request body is required." }, { status: 400 });
    }
    const count = Number(body?.count);
    if (!Number.isInteger(count) || count < 1 || count > 100) {
      return NextResponse.json({ error: "Label quantity must be a whole number from 1 to 100." }, { status: 400 });
    }
    const accountNumber = body?.accountNumber == null ? "" : String(body.accountNumber).trim();
    const destinationInput = body?.destinationPort == null ? "" : String(body.destinationPort).trim();
    const destinationPort = destinationInput ? normalizeFerryPort(destinationInput) : null;
    if (Boolean(accountNumber) !== Boolean(destinationInput)) {
      return NextResponse.json({ error: "Choose both a ferry destination and customer account number, or leave both blank." }, { status: 400 });
    }
    if (accountNumber && (!/^\d{1,30}$/.test(accountNumber) || !destinationPort || !FERRY_PORT_ORDER.includes(destinationPort))) {
      return NextResponse.json({ error: "Enter a valid customer account number and ferry destination." }, { status: 400 });
    }
    if (accountNumber) {
      const { data: customer, error: customerError } = await supabase
        .from("numero_cliente")
        .select("numero_cliente, puerto")
        .eq("numero_cliente", accountNumber)
        .limit(1)
        .maybeSingle();
      if (customerError) throw customerError;
      if (!customer) return NextResponse.json({ error: "Customer account number was not found." }, { status: 400 });
      if (normalizeFerryPort(customer.puerto) !== destinationPort) {
        return NextResponse.json({ error: "The selected ferry destination does not match this customer account." }, { status: 400 });
      }
    }

    // Retry an entire atomic batch if an extremely unlikely random code collides with a
    // previously issued label or an existing shipment tracking number.
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const codes = new Set<string>();
      while (codes.size < count) codes.add(createTrackingCode());
      const { data, error } = await supabase
        .from("caribex_manual_labels")
        .insert(Array.from(codes, (tracking) => ({
          tracking,
          created_by: actorId,
          account_number: accountNumber || null,
          destination_port: destinationPort,
        })))
        .select("id, tracking, created_at, account_number, destination_port");
      if (!error) return NextResponse.json({ labels: data || [] }, { status: 201 });
      if (error.code !== "23505" || attempt === 7) throw error;
    }

    return NextResponse.json({ error: "Unable to generate unique manual labels. Please try again." }, { status: 409 });
  } catch (error) {
    return errorResponse(error);
  }
}
