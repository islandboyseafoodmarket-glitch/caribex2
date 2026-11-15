import {
  authErrorResponse,
  checkRateLimit,
  createAdminClient,
  createPublicAuthClient,
  jsonResponse,
  normalizeEmail,
  publicOrigin,
  rateLimitResponse,
  requestIp,
  requireStaffOrAdmin,
} from "../../../lib/scanner-api";

export const dynamic = "force-dynamic";

const GENERIC_RESET_MESSAGE = "If an account matches that email, a password reset link has been sent.";
const RESET_REDIRECT = "/?recovery=1";

export async function POST(request: Request) {
  const rateLimit = checkRateLimit(`scanner-account:${requestIp(request)}`, 5, 15 * 60 * 1000);
  if (!rateLimit.allowed) return rateLimitResponse(rateLimit.retryAfterSeconds);

  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return jsonResponse({ error: "A JSON object is required" }, { status: 400 });
    }

    const payload = body as Record<string, unknown>;
    const action = payload.action;
    if (action !== "password_reset" && action !== "password_change") {
      return jsonResponse({ error: "action must be password_reset or password_change" }, { status: 400 });
    }

    if (action === "password_reset") {
      const email = normalizeEmail(payload.email);
      if (!email) return jsonResponse({ error: "email must be a valid email address" }, { status: 400 });

      const authClient = createPublicAuthClient();
      const { error } = await authClient.auth.resetPasswordForEmail(email, {
        redirectTo: `${publicOrigin()}${RESET_REDIRECT}`,
      });
      if (error) {
        // Do not disclose whether the address exists or expose provider details.
        console.warn("[scanner-account] Password reset provider error", error.message);
      }
      return jsonResponse({ success: true, message: GENERIC_RESET_MESSAGE });
    }

    if (typeof payload.current_password !== "string" || !payload.current_password) {
      return jsonResponse({ error: "current_password is required" }, { status: 400 });
    }
    if (typeof payload.new_password !== "string" || payload.new_password.length < 8) {
      return jsonResponse({ error: "new_password must be at least 8 characters" }, { status: 400 });
    }
    if (payload.new_password.length > 256) {
      return jsonResponse({ error: "new_password is too long" }, { status: 400 });
    }

    const supabase = createAdminClient();
    const actor = await requireStaffOrAdmin(request, supabase);
    if (!actor.user.email) return jsonResponse({ error: "Authenticated account has no email address" }, { status: 400 });

    const verificationClient = createPublicAuthClient();
    const { error: verificationError } = await verificationClient.auth.signInWithPassword({
      email: actor.user.email,
      password: payload.current_password,
    });
    if (verificationError) return jsonResponse({ error: "Current password is incorrect" }, { status: 401 });

    const { error: updateError } = await supabase.auth.admin.updateUserById(actor.user.id, {
      password: payload.new_password,
    });
    if (updateError) throw updateError;

    return jsonResponse({ success: true, message: "Password changed successfully." });
  } catch (error) {
    if (error instanceof Error && /authentication|token|required|access/i.test(error.message)) {
      return authErrorResponse(error);
    }
    console.error("[scanner-account] Account action failed", error);
    return jsonResponse({ error: "Account action could not be completed" }, { status: 500 });
  }
}
