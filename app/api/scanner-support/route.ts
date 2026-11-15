import { createAdminClient, checkRateLimit, jsonResponse, normalizeEmail, rateLimitResponse, requestIp, resolveScannerActor } from "../../../lib/scanner-api";

export const dynamic = "force-dynamic";

const MAX_MESSAGE_LENGTH = 4000;
const MAX_APP_VERSION_LENGTH = 80;

export async function POST(request: Request) {
  const rateLimit = checkRateLimit(`scanner-support:${requestIp(request)}`, 5, 15 * 60 * 1000);
  if (!rateLimit.allowed) return rateLimitResponse(rateLimit.retryAfterSeconds);

  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return jsonResponse({ error: "A JSON object is required" }, { status: 400 });
    }

    const payload = body as Record<string, unknown>;
    const message = typeof payload.message === "string" ? payload.message.trim() : "";
    const appVersion = typeof payload.app_version === "string" ? payload.app_version.trim() : "";
    const emailValue = payload.email === undefined || payload.email === null ? null : normalizeEmail(payload.email);

    if (!message || message.length > MAX_MESSAGE_LENGTH) {
      return jsonResponse({ error: `message is required and must be at most ${MAX_MESSAGE_LENGTH} characters` }, { status: 400 });
    }
    if (!appVersion || appVersion.length > MAX_APP_VERSION_LENGTH) {
      return jsonResponse({ error: `app_version is required and must be at most ${MAX_APP_VERSION_LENGTH} characters` }, { status: 400 });
    }
    if (payload.email !== undefined && payload.email !== null && !emailValue) {
      return jsonResponse({ error: "email must be a valid email address" }, { status: 400 });
    }

    const supabase = createAdminClient();
    const actor = await resolveScannerActor(request, supabase);
    const { data, error } = await supabase
      .from("staff_action_logs")
      .insert({
        actor_id: actor.actorId,
        actor_name: actor.actorName,
        actor_email: actor.actorEmail,
        actor_role: actor.actorRole,
        action: "mobile_support_report",
        entity_type: "mobile_support_report",
        entity_id: null,
        success: true,
        details: {
          source: "mobile_welcome_screen",
          report_message: message,
          app_version: appVersion,
          submitted_email: emailValue,
          authenticated_actor: actor.authenticated,
        },
        ip_address: requestIp(request),
        user_agent: request.headers.get("user-agent") || null,
      })
      .select("id")
      .single();

    if (error || !data?.id) throw error || new Error("Support report could not be saved");
    return jsonResponse({ success: true, id: data.id });
  } catch (error) {
    console.error("[scanner-support] Failed to save mobile support report", error);
    return jsonResponse({ error: "Support report could not be saved" }, { status: 500 });
  }
}
