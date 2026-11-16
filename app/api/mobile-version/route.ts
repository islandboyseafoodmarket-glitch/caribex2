import { NextResponse } from "next/server";
import releaseHistory from "./release-history.json";

export const dynamic = "force-dynamic";

const releaseNotes = [
  "Caribex launcher icon restored in the Android native resources; the app now displays the correct Caribex logo on the phone.",
  "Customer signature dialog now fits smaller phone screens and keeps the Complete pickup action visible, with scrolling available when needed.",
  "Pickup success notification is shorter and no longer adds the extra unscanned-packages message.",
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
      version: "1.2.44",
      version_code: 1252,
      apk_url: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663449196187/HUdiXupUtWMtLMZo.apk",
      filename: "Caribex-Warehouse-Management-1.2.44-logo-fix.apk",
      apk_sha256: "c0f5a57d9ed20d8f0243f7a5b2d2a3f9d5b8cc1870a40c2c7cecb342f24ecb81",
      release_notes: releaseNotes,
      release_history: [
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
          version_code: 1253,
          apk_url: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663449196187/nfaofHqBjiGWZPtX.apk",
          filename: "Caribex-Warehouse-Management-1.2.40-rollback-code-1253.apk",
          apk_sha256: "efeea57bafabc30fa88965ecb95072d773b87916443c3ca2902c92d408ccc928",
          release_notes: [
            "v1.2.40 application payload with Android code 1253 and the existing signing certificate so it can replace v1.2.44/code 1252 without uninstalling.",
            "This rolls back the phone app only, not the server database. A later forward installation must use Android code greater than 1253.",
          ],
        },
      ],
    },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}
