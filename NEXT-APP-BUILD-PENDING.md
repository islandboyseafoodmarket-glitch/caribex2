# Caribex Next App Build — Pending Implementation List

This list consolidates the mobile-app changes approved or requested for the next Android build. No application code is changed by this checklist.

## 1. Unknown shipment / unknown box Check-In workflow

Implement the workflow shown in the provided scanner screenshots:

1. Staff scans a shipment that is not in the system.
2. The app displays **Package not found** and the scanned tracking number.
3. Staff taps **Unload Unknown**.
4. The app displays the **Unload Unknown – Warning** confirmation.
5. Staff taps **Proceed to Unload**.
6. The app opens the full **Check In** screen shown in the reference image, with the scanned tracking number already filled in.
7. Staff or admin completes the Check-In information.
8. Tapping **Complete** saves the shipment and allows it to continue through the normal unloading workflow.
9. The tracking number must not require a second scan.

The app must not directly unload the unknown shipment without first collecting the required Check-In information.

## 2. Full Check-In screen for unknown shipments

Match the requested layout and workflow:

- Header with back arrow, **Check In**, and **Rescan**.
- Package type selector: **Box** or **Package**.
- Price field.
- Price helper text explaining that the price is calculated from dimensions.
- Charges section.
- Package Measurements section:
  - Height
  - Width
  - Length
  - Weight where required by billing.
- **This package contains (0)** counter.
- **Add an item** control.
- **Manual** item entry.
- **Scan** item entry.
- **Scan Next** button.
- **Complete** button.

## 3. Unknown-box billing calculation

Unknown boxes must use the same billing rules as normal boxes:

- Calculate volume from Length × Width × Height.
- Apply the standard Caribex box rate.
- Calculate subtotal, tax, and total.
- Save the result in:
  - `billing_subtotal`
  - `billing_tax`
  - `billing_total`
- Save additional charges in `paquetes_checkin.cargos_adicionales` when authorized.
- Do not send an invoice prematurely merely because an unknown box was created.
- Preserve the existing invoice-release rules.

## 4. Price and charges permissions

The correct rule is:

- **Staff:** may enter measurements and view the calculated price, but may not edit the price or restricted charges.
- **Admin:** has access to the price and charges controls and may enter or adjust them normally.
- The restriction must be enforced in both the UI and the API; it must not rely only on hiding controls in the app.

The wording should be **“Admin-only price and charges controls”** rather than saying that admins are restricted.

## 5. Custom additional charges in Check-In

Additional Charges must be collapsed by default. Do not show a visible dropdown or list of preset charges on the initial Check-In screen.

The collapsed row should show:

```text
Additional Charges                                      +
```

When an admin taps the plus control, expand the section and provide custom entry fields:

- What is it for? / Description.
- Amount.
- **Add charge** action.
- Remove action for charges already entered.
- **Add another charge** action for multiple custom charges.

Each custom charge must be saved with its description and amount, included in the billing total, and shown as a separate additional line item on the invoice. The standard calculated shipment price must remain separate from additional charges.

Staff may see the collapsed section as read-only or unavailable, but may not add or edit charges. Admins may expand the section and add, edit, or remove custom charges.

## 6. Remove the duplicate Check-In bulk button

Keep the bulk action in the Check-In page header beside **Refresh** and **Consolidate**.

Remove the duplicate bulk-action rendering from the shared scanner section.

Keep the underlying `moveAllCheckInToTransit()` function unchanged unless testing identifies a separate issue.

There should be only one visible bulk action for moving the Check-In group to In-Transit.

## 7. Ferry unload alert timing

Keep the ferry behavior already implemented locally:

- Do not alert when the shipment is only looked up.
- Trigger the alert only after the unload request succeeds.
- Keep the unloading dialog open while the alert is shown.
- Show the foreground **SET ASIDE — FERRY PACKAGE** alert immediately after the successful unload response.
- Play the triple beep and vibration at that point.
- Include La Ceiba, Utila, and Guanaja.
- Allow staff to acknowledge the alert and then use **Scan Next**.

## 8. Customer search display and port account colors

When searching by customer name, show both:

- Customer name.
- Account number with the appropriate port prefix.

Keep the customer name full black. Apply the port color only to the account-number line, including its port prefix:

- Roatán accounts: black/normal account color.
- La Ceiba accounts: existing La Ceiba color.
- Utila accounts: existing Utila color.
- Guanaja accounts: existing Guanaja color.
- Any other port: the designated non-Roatán port color.

Use the customer's actual `puerto` value. Do not infer the port from the customer's name. The port prefix and port label must be displayed with correct capitalization everywhere in the app, including search results, selected-customer summaries, Check-In, Receiving, and shipment details.

Apply this to the customer search dropdowns used by:

- Client Pickup.
- Receiving.
- Check-In customer selection.

## 9. Unloaded-stage selectable package search

When staff chooses **Manual Entry** from Container Unloading, open a full **Suggestions** screen rather than showing search controls on the main unloading screen. The screen should match the approved reference layout:

- Back arrow and **Suggestions** title.
- Report indicator in the top-right.
- Informational panel explaining that the search covers boxes still on a container and boxes received before the latest container that were never checked in.
- One compact search-type selector, closed by default.
- Search input and blue **Search** button on the same row.
- Empty state reading **Start typing to see suggestions** before input is entered.

The search-type selector must offer:

- Account Number.
- Tracking Number.
- Customer Name.

The selected mode controls the input placeholder and validation. Account Number requires an account number before searching; Tracking Number searches by any entered part of the tracking number; Customer Name searches the client name. Results must be selectable and show tracking number, customer name, account number, port/location, current status, and Box or Package type. Searching and selecting must not change shipment status; only the unload action may advance the shipment.

## 10. Manual-selection unload confirmation

After staff taps a search result, show a confirmation dialog before changing any shipment status. The dialog must say:

> **Confirm selection**
>
> You're about to unload the following package.

Show the selected shipment details in the dialog:

- Tracking number.
- Client/customer name.
- Account number.
- Box or package type where available.

Provide two clear actions:

- **Cancel** — closes the dialog and leaves the shipment unchanged.
- **Confirm to Unload** — performs the unload transition only after the staff member confirms.

The confirmation must use the exact result selected from the Suggestions screen, prevent accidental status changes, and preserve the existing post-unload behavior, including ferry alerts when applicable.

## 11. Staff permissions and scanner approved roles

Make the scanner login honor the permissions saved in the Admin staff-management page. When a staff member has **Workflow App / Shipment workflow** enabled in `personal.permissions`, the scanner must return the approved workflow roles:

- Receiving.
- Check In.
- Container Unloading.
- Client Pickup.

Administrator accounts must continue receiving all workflow roles. The scanner should not show a separate Admin workflow tile unless a real in-app Admin destination is implemented. After deployment, staff must sign out and sign back in so the approved-role list refreshes.

## 12. Save customer assignment from the mobile app

When staff assign a customer to a problem package or unknown package in the app, the assignment must be persisted instead of only changing the visible selection:

- Send the selected `customer_id` with the mobile save request.
- Update `paquetes_registro.numero_cliente_id`.
- Update the latest `paquetes_checkin.numero_cliente_id` when a Check-In record exists.
- Return the updated customer in the API response.
- Refresh the shipment details immediately so the new customer, account number, and port are visible.
- Show a clear success or error message.

This must work for both newly created unknown shipments and existing problem/unknown shipments edited from the app, matching the working Admin website behavior.

## 13. Check In search by account number

The Check In search must find shipments when staff enter a customer account number. Search must support:

- Tracking number.
- Customer name.
- Customer account number.

The account-number and customer-name searches must query the related customer record through `numero_cliente_id`, not only search shipment fields such as tracking, carrier, or contents. Customer-name search must support partial, case-insensitive matches, so entering either a full name or part of a name returns that customer's eligible shipments. Results should show the tracking number, customer name, account number, port/location, and current status before the staff member checks the shipment in.

An account number that has no eligible Received or Check-In shipments must return a clear “No shipments found for this account” message rather than a generic lookup error.

## 14. Validation before the next build

Before building the APK:

- Run Android TypeScript validation.
- Run lint and tests if available.
- Verify that the unknown shipment tracking number is preserved through the warning and Check-In screen.
- Verify staff cannot edit admin-only price and charges.
- Verify admins can edit price and charges.
- Verify unknown-box billing is calculated from saved dimensions.
- Verify only one Check-In bulk button is visible.
- Verify the ferry alert occurs only after successful unload.
- Verify La Ceiba, Utila, and Guanaja alert behavior.
- Verify customer account numbers and port colors in search results.
- Verify a customer assigned from the app remains assigned after closing, reopening, syncing, and refreshing a problem or unknown shipment.
- Verify Check In finds eligible shipments by account number, customer name, and tracking number.
- Do not build or publish until these checks pass.

## 15. Client Pickup count refresh after consecutive scans

The Client Pickup summary must remain accurate while staff scan several packages for the same customer:

- After every successful pickup scan, refresh the customer summary from the server and show the new collected and remaining counts immediately.
- Prevent an older in-flight customer-search response from overwriting the newer result after consecutive scans.
- Keep the count definition consistent: exclude consolidated child packages from the pickup count because they are collected with the main BOX.
- Clearly define whether `total` means all customer shipments or only shipments currently ready/picked up; do not let On-the-way shipments silently change the displayed denominator.
- Ensure the scanned package is not left in an orphaned/stale local result after the pickup transition.
- Test the sequence of scanning two packages and then a third, confirming that the collected and pending numbers update after each scan.

## 16. Preserve complete USPS tracking numbers

The next app release must keep the full USPS tracking number printed under **USPS TRACKING #**:

- Do not remove the first three digits from valid 20- or 22-digit USPS numbers.
- Use the complete value for Receiving, workflow lookup, consolidation, unloading, and pickup.
- Keep backward-compatible lookup for older records created with the shortened value.
- Regression-test labels beginning with the 92, 93, 94, and 95 USPS series.

## 17. Scan-or-manual-only consolidation

The Consolidation screen must not display dropdowns or shipment lists:

- Select the main BOX only by scanning it or entering its tracking number manually.
- Add each PACKAGE only by scanning it or entering its tracking number manually.
- Do not allow selecting a BOX or PACKAGE from a visible list.
- Keep the main BOX-first rule and require at least one PACKAGE before saving.
- Verify that scanned and manually entered tracking numbers use the same validation and duplicate-prevention rules.

## 18. Append packages to an existing consolidation

Staff must be able to scan or manually enter a BOX that already has packages consolidated inside it and add more packages later:

- Scanning an existing consolidated BOX must reopen that BOX as the selected main box instead of rejecting it or treating it as unavailable.
- Show the packages already inside the BOX and preserve them unchanged.
- Allow staff to scan or manually enter one or more additional PACKAGE tracking numbers.
- Prevent adding the same package twice, adding the main BOX as its own child, or adding a package already consolidated into a different BOX.
- Save only the newly added package links while retaining all existing consolidation links.
- Refresh the BOX contents and package count immediately after a successful append.
- Preserve the existing status cascade so the main BOX and all child packages continue to unload and complete pickup together.

## 19. Keep workflow stage status filters consistent

- A shipment created in Receiving with status `Recibido` must appear in Check In immediately.
- The Check In API, mobile list, bulk actions, and web stage views must use the same eligible status contract.
- Refreshing or reopening a stage must re-query the server and must not depend on stale local state.
- After an individual Check In transition, refresh the Check In list rather than reverting to the Receiving list.
- Audit every stage transition for the same mismatch: Receiving → Check In → In-Transit → Unloaded → Client Pickup.
