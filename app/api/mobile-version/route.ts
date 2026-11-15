import { NextResponse } from "next/server";
import releaseHistory from "./release-history.json";

export const dynamic = "force-dynamic";

const releaseNotes = [
  "Customer Pickup uses fresh server data: invoice-only billing records and consolidated children are excluded from physical package counts.",
  "Unloaded port suffixes and English/Spanish status aliases are recognized; a pickup timestamp overrides a stale status label.",
  "The server returns checked-at time and a unique request ID; unverified or failed refreshes cannot remain usable as fresh Pickup results.",
  "Application Report is available in every workflow stage and native dialog. It is text-only and saved in Admin Activity logs, separate from package notes/photos.",
  "All containers now opens a compact fixed-height dropdown instead of a long strip; it closes after selecting a container.",
  "The last collected package in a container opens the required customer signature. A partial collection requires a staff/admin reason first.",
  "Partial-pickup reasons include Customer will return for the remaining packages. Unscanned packages stay available; only collected tracking numbers are signed.",
  "Pickup blocks another customer's box/package and shows its owner. Signatures validate the exact shipment/customer/container batch.",
  "Scans and pickup-completion checks are serialized to prevent rapid entries from losing packages in the signature batch.",
  "Top Home, bottom Home, customer editing, and stage navigation cannot silently discard an unsigned Pickup batch. Home otherwise returns to welcome without signing out.",
  "Consolidation requires the BOX and all children to be registered, Received, assigned to the same customer, and not already inside another BOX.",
  "Success, error, and stage notices use one floating top banner for 10 seconds. Sync preserves stage and unsaved drafts; sign-out clears them.",
  "Already-unloaded scans show Package Details. Only Update Package opens the internal note, problem flag, and photo editor; it does not advance the stage.",
  "Updates now has New updates and All updates tabs with every published note, including release history, without the old 12-note limit.",
  "v1.2.40 uses Android code 1243. v1.2.37 rollback uses code 1244 and the same signing certificate. Returning after rollback needs a higher-code forward build.",
  "30 automated tests and signed APK integrity/version checks passed. Physical-device acceptance and crash recovery of an unsaved signature are not claimed completed.",
];

export async function GET() {
  return NextResponse.json(
    {
      app: "Caribex Warehouse Management",
      version: "1.2.40",
      version_code: 1243,
      apk_url: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663449196187/afIJpjSGxscnwCkw.apk",
      filename: "Caribex-Warehouse-Management-1.2.40.apk",
      apk_sha256: "18fb208b557def21a68e7f914c21b553a14e124792dce58ac0733a89a6d53241",
      release_notes: releaseNotes,
      release_history: [
        { version: "1.2.40", version_code: 1243, release_notes: releaseNotes },
        ...releaseHistory,
      ],
      rollback_releases: [
        {
          app: "Caribex Warehouse Management",
          version: "1.2.37",
          version_code: 1244,
          apk_url: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663449196187/nWPriiQvMgNTkGQC.apk",
          filename: "Caribex-Warehouse-Management-1.2.37-rollback-code-1244.apk",
          apk_sha256: "e037269ee5ea60c459f72055765e8f499cbf94b5dc525cb2be892100e3091f5b",
          release_notes: [
            "Original v1.2.37 application payload with Android code 1244 and the existing signing certificate so it can replace v1.2.40/code 1243 without uninstalling.",
            "This rolls back the phone app only, not the server database. A later forward installation must use Android code greater than 1244.",
          ],
        },
      ],
    },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}
