import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(
    {
      app: "Caribex Warehouse Management",
      version: "1.2.39",
      version_code: 1241,
      apk_url: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663449196187/etrSunJTuXhtNwCl.apk",
      filename: "Caribex-Warehouse-Management-1.2.39.apk",
      apk_sha256: "e326e5265651bc42f43da4915f0242b5d31de9dd8a78f6bdee50ca263b6ac14d",
      rollback_releases: [
        {
          app: "Caribex Warehouse Management",
          version: "1.2.37",
          version_code: 1242,
          apk_url: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663449196187/NfJmLneIvnJjPPtY.apk",
          filename: "Caribex-Warehouse-Management-1.2.37-rollback-code-1242.apk",
          release_notes: [
            "Original v1.2.37 application with Android code 1242 and the existing signing certificate so it can replace v1.2.39/code 1241 without uninstalling.",
            "After installing this rollback, a subsequent forward APK must have Android code greater than 1242. The static code-1241 v1.2.39 APK cannot reinstall over it normally.",
          ],
        },
      ],
      release_notes: [
        "Every stage-selection, successful-scan, and error notice uses the same floating top banner for 10 seconds.",
        "Home returns to the first Caribex welcome screen without signing out; leftover workflow dialogs are closed.",
        "Receiving, Check In, and Unloading SCAN and MANUAL ENTRY buttons now match the Pickup layout; manual entry opens when tapped.",
        "Removed the Real customer information and filter wording from Pickup while retaining customer details and all/specific-container selection.",
        "Pickup rejects another customer's package and displays the package owner's name; the server validates the expected customer before pickup when provided.",
        "Picked-up shipments are excluded from the available list, stale customer responses are rejected, and only successful pickups enter the signature batch.",
        "Pickup signatures validate exact tracking/ID pairs and the selected customer before saving.",
        "Sync refreshes server data without clearing the stage, shipment, notes, or photos; failed list refreshes do not show a false success notice.",
        "Sign out clears workflow drafts, customer selections, role, stored credentials, and prior sign-in email; fresh sign-in starts clean.",
        "The welcome Report action is a text-only application report saved for Admin Activity Logs, separate from package notes/photos.",
        "The welcome password action uses a real password-reset email when signed out or an authorized current-password-verified change when signed in.",
        "The original Caribex logo is used for the welcome screen and Android launcher icon.",
        "Already-unloaded scans show Package Details; Update Package alone opens the note, problem flag, and photo editor without advancing the shipment stage.",
        "Already checked-in rows are labeled Checked in instead of offering an invalid repeat Check In action; they remain available for the In-Transit batch.",
        "Forward version is v1.2.39/code 1241; rollback target remains v1.2.37 with compatible code 1242. APK versions and existing signing certificate were verified; physical-device installation is not claimed.",
      ],
    },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}
