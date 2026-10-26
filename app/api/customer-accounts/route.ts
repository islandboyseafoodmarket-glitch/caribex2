import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  isReferralSource,
  referralSourceNeedsDetails,
} from "../../../lib/referral-source";

const REFERRAL_DETAILS_MAX_LENGTH = 180;

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Supabase server environment variables are missing");
  }
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function isMissingReferralColumns(error: unknown): boolean {
  const candidate = error as { code?: string; message?: string } | null;
  const message = String(candidate?.message || "").toLowerCase();
  return (
    candidate?.code === "42703" ||
    candidate?.code === "PGRST204" ||
    (message.includes("heard_about_us") &&
      (message.includes("column") ||
        message.includes("schema cache") ||
        message.includes("does not exist"))) ||
    (message.includes("heard_about_us_details") &&
      (message.includes("column") ||
        message.includes("schema cache") ||
        message.includes("does not exist")))
  );
}

export async function GET() {
  try {
    const supabase = adminClient();
    const { error } = await supabase
      .from("numero_cliente")
      .select("heard_about_us, heard_about_us_details")
      .limit(1);

    return NextResponse.json({ referral_available: !error });
  } catch {
    return NextResponse.json({ referral_available: false });
  }
}

export async function POST(request: Request) {
  const supabase = adminClient();

  try {
    const body = await request.json();
    const name = String(body?.nombre || "").trim();
    const email = String(body?.email || "").trim().toLowerCase();
    const phone = String(body?.telefono || "").trim();
    const port = String(body?.puerto || "").trim();
    const accountType = String(body?.tipoCuenta || "Personal");

    const rawReferralSource = body?.heardAboutUs;
    const rawReferralDetails = body?.heardAboutUsDetails;
    if (
      rawReferralSource !== undefined &&
      rawReferralSource !== null &&
      typeof rawReferralSource !== "string"
    ) {
      return NextResponse.json({ error: "Invalid referral source" }, { status: 400 });
    }
    if (
      rawReferralDetails !== undefined &&
      rawReferralDetails !== null &&
      typeof rawReferralDetails !== "string"
    ) {
      return NextResponse.json({ error: "Invalid referral detail" }, { status: 400 });
    }

    const heardAboutUs = (rawReferralSource || "").trim();
    const heardAboutUsDetails = (rawReferralDetails || "").trim();
    if (heardAboutUs && !isReferralSource(heardAboutUs)) {
      return NextResponse.json({ error: "Invalid referral source" }, { status: 400 });
    }
    if (heardAboutUsDetails.length > REFERRAL_DETAILS_MAX_LENGTH) {
      return NextResponse.json(
        { error: `Referral detail must be ${REFERRAL_DETAILS_MAX_LENGTH} characters or fewer` },
        { status: 400 },
      );
    }
    if (heardAboutUsDetails && !heardAboutUs) {
      return NextResponse.json(
        { error: "Referral detail requires a referral source" },
        { status: 400 },
      );
    }
    if (
      heardAboutUsDetails &&
      heardAboutUs &&
      !referralSourceNeedsDetails(heardAboutUs)
    ) {
      return NextResponse.json(
        { error: "Referral detail is only available for a referred customer or Other" },
        { status: 400 },
      );
    }

    if (!name || !email || !phone || !port) {
      return NextResponse.json(
        { error: "All required customer fields must be completed" },
        { status: 400 },
      );
    }

    const normalizedPhone = phone.replace(/\D/g, "");
    const [{ data: emailMatch }, { data: nameMatch }, { data: phoneRows }] =
      await Promise.all([
        supabase.from("numero_cliente").select("id").eq("email", email).maybeSingle(),
        supabase.from("numero_cliente").select("id").ilike("nombre", name).maybeSingle(),
        supabase.from("numero_cliente").select("id, telefono").limit(5000),
      ]);
    const phoneMatch = (phoneRows || []).find(
      (row: { telefono?: string }) =>
        String(row.telefono || "").replace(/\D/g, "") === normalizedPhone,
    );
    if (emailMatch) {
      return NextResponse.json({ error: "A customer with this email already exists" }, { status: 409 });
    }
    if (nameMatch) {
      return NextResponse.json({ error: "A customer with this name already exists" }, { status: 409 });
    }
    if (phoneMatch) {
      return NextResponse.json({ error: "A customer with this phone number already exists" }, { status: 409 });
    }

    const { data: maxRow } = await supabase
      .from("numero_cliente")
      .select("numero_cliente")
      .order("numero_cliente", { ascending: false })
      .limit(1)
      .maybeSingle();
    const accountNumber = Math.max(Number(maxRow?.numero_cliente || 299) + 1, 300);
    const initialPassword = `Caribex${accountNumber}`;
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password: initialPassword,
      email_confirm: true,
      user_metadata: {
        customer_account_number: accountNumber,
        must_change_password: true,
      },
    });
    if (authError || !authData.user) {
      throw authError || new Error("Could not create customer login");
    }

    const customerInsert: Record<string, string | number> = {
      nombre: name,
      email,
      telefono: phone,
      puerto: port,
      tipo_cuenta: accountType,
      numero_cliente: accountNumber,
      auth_user_id: authData.user.id,
    };
    if (heardAboutUs) {
      customerInsert.heard_about_us = heardAboutUs;
      if (heardAboutUsDetails) {
        customerInsert.heard_about_us_details = heardAboutUsDetails;
      }
    }

    const { error: insertError } = await supabase
      .from("numero_cliente")
      .insert(customerInsert);
    if (insertError) {
      await supabase.auth.admin.deleteUser(authData.user.id);
      if (heardAboutUs && isMissingReferralColumns(insertError)) {
        return NextResponse.json(
          {
            error:
              "Referral source is not configured yet. Apply the customer referral migration before submitting an answer.",
          },
          { status: 503 },
        );
      }
      throw insertError;
    }

    await supabase.from("customer_portal_login_events").insert({
      email,
      customer_name: name,
      account_number: accountNumber,
      event_type: "account_created",
      success: true,
      reason: `Customer account #${accountNumber} created with portal access`,
    });
    return NextResponse.json({ accountNumber, initialPassword });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Could not create customer account";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
