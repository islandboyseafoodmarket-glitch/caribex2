import { NextResponse } from "next/server";
import releaseHistory from "./release-history.json";

export const dynamic = "force-dynamic";

const releaseNotes = [
  "Customer Lookup and Send to Ferry are available only inside the Admin tools menu; they no longer appear on every workflow stage.",
  "Ferry destinations load when the Admin Send to Ferry tool opens, with continuous scan/manual-entry support for the selected dispatch batch.",
  "Send to Ferry reads the newly created unloaded container and clearly reports when no eligible shipments exist for the selected destination.",
  "Customer Lookup opens a dedicated Box History dialog when a tracking number is selected, including shipment history and billing totals.",
  "Scans with an invalid, unknown, duplicate, or wrong-stage label show a clear error or warning with guidance; no status change is made.",
  "The scanner now keeps scanned shipment details in a temporary dialog until Close or the next scan, and the camera/report controls use compact layouts.",
  "The mobile Admin tools now return readable JSON errors instead of exposing a JSON parse error when the server responds with an error.",
  "The Updates screen reads the complete server-published release history, including the last two mobile releases.",
  "A new sign-in on another phone replaces the previous scanner session for that account. The older phone is signed out on its next API request.",
  "When a newer version is available, sign-in shows a clear New version available popup asking the operator to update.",
  "v1.2.46 uses Android code 1255 and the existing compatible signing certificate.",
  "Mobile TypeScript checks and 39 automated tests passed; physical-device acceptance testing remains required.",
];

export async function GET() {
  return NextResponse.json(
    {
      app: "Caribex Warehouse Management",
      version: "1.2.48",
      version_code: 1258,
      apk_url: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663449196187/CPVKIPNtYjJXWVDH.apk",
      filename: "Caribex-Warehouse-Management-1.2.48.apk",
      apk_sha256: "9ef61a51b78270e0e5c29375eef3c0dab3aa2129eabe911fb5886a1a8b81cbb8",
      release_notes: releaseNotes,
      release_history: [
        { version: "1.2.48", version_code: 1258, release_notes: releaseNotes },
        { version: "1.2.47", version_code: 1256, release_notes: [
          "One active scanner session per account: a newer phone sign-in replaces the older scanner session.",
          "The sign-in update prompt clearly asks the operator to install a newer release.",
        ] },
        { version: "1.2.46", version_code: 1255, release_notes: [
          "Customer Lookup and Send to Ferry were added to the mobile Admin menu and removed from individual workflow stages.",
          "Dispatches filtering supports Client ID, Show ID, and ferry booking number on the web dashboard.",
          "v1.2.46 uses Android code 1255 and the existing compatible signing certificate.",
        ] },
        { version: "1.2.45", version_code: 1254, release_notes: [
          "Dispatches filtering now supports Client ID, formatted Show ID, and ferry booking number.",
          "The web Admin and Staff warehouse view includes the Dispatches surface alongside the existing Ferry Manifest page.",
          "Admin Customer Lookup and Ferry tools were added to the mobile Admin menu for controlled staff workflows.",
          "v1.2.45 uses Android code 1254 and the existing compatible signing certificate.",
        ] },
        { version: "1.2.44", version_code: 1252, release_notes: releaseNotes },
        { version: "1.2.43", version_code: 1250, release_notes: releaseNotes },
        { version: "1.2.40", version_code: 1243, release_notes: [
          "Customer Pickup uses fresh server data: invoice-only billing records and consolidated children are excluded from physical package counts.",
          "Unloaded port suffixes and English/Spanish status aliases are recognized; a pickup timestamp overrides a stale status label.",
          "Application Report is available in every workflow stage and native dialog. It is text-only and saved in Admin Activity logs, separate from package notes/photos.",
          "All containers now opens a compact fixed-height dropdown instead of a long strip; it closes after selecting a container.",
          "The last collected package in a container opens the required customer signature. A partial collection requires a staff/admin reason first.",
          "Success, error, and stage notices use one floating top banner for 10 seconds. Sync preserves stage and unsaved drafts; sign-out clears them.",
          "Already-unloaded scans show Package Details. Only Update Package opens the internal note, problem flag, and photo editor; it does not advance the stage.",
          "Updates now has New updates and All updates tabs with every published note, including release history, without the old 12-note limit.",
          "v1.2.40 uses Android code 1243. v1.2.37 rollback uses code 1244 and the same signing certificate.",
        ] },
        ...releaseHistory,
      ],
      rollback_releases: [
        {
          app: "Caribex Warehouse Management",
          version: "1.2.40",
          version_code: 1257,
          apk_url: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663449196187/OSNxbbHOwacUVYxv.apk",
          filename: "Caribex-Warehouse-Management-1.2.40-rollback-code-1257.apk",
          apk_sha256: "26e193ea1478c86c441af5a7cd9c5eedb053d630e045df1f941ae39351752f0a",
          release_notes: [
            "v1.2.40 application payload with Android code 1257 and the existing signing certificate so it can replace v1.2.48/code 1258 without uninstalling.",
            "This rolls back the phone app only, not the server database. A later forward installation must use Android code greater than 1257.",
          ],
        },
      ],
    },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}
