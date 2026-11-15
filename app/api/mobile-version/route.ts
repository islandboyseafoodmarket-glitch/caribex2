import { NextResponse } from "next/server";
import releaseHistory from "./release-history.json";

export const dynamic = "force-dynamic";

const releaseNotes = [
  "Pickup search now keeps the selected customer account ID when Search is pressed again, preventing a false Customer not found message.",
  "Shipment status values display in English throughout the scanner, including finished and picked-up shipments; legacy Spanish database values remain supported internally.",
  "Removed the extra large Home shortcut; the existing bottom Home navigation remains the single Home action.",
  "Settings now includes scan sounds, camera flashlight, connection test, Updates, Change password, and Sign out. Change stage remains on the main workflow screen.",
  "Report dialog layout remains usable while typing; the form scrolls without collapsing when Android opens the keyboard.",
  "The camera flashlight preference is saved on the device, and scan sound preference can be turned off without disabling visual notices.",
  "v1.2.41 uses Android code 1245 and the existing compatible signing certificate. It installs over v1.2.40/code 1243; code 1244 remains reserved for the v1.2.37 rollback.",
  "37 automated tests and signed APK integrity/version checks passed. Physical-device acceptance still requires staff testing.",
];

export async function GET() {
  return NextResponse.json(
    {
      app: "Caribex Warehouse Management",
      version: "1.2.41",
      version_code: 1245,
      apk_url: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663449196187/MvSmCAbYRXXdwgpl.apk",
      filename: "Caribex-Warehouse-Management-1.2.41.apk",
      apk_sha256: "525b3375eb603c435705131c0bc2cdffb2a4e813eac66c5017510f91e72ae7e6",
      release_notes: releaseNotes,
      release_history: [
        { version: "1.2.41", version_code: 1245, release_notes: releaseNotes },
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
