# Current interface update

- [x] Restore the Caribex logo/header above the tabs on Admin and Staff, retaining compact account controls and the blue page background. The latest request enlarges the logo moderately to 156 × 68 pixels so it is visible without restoring the oversized banner.
- [x] Make each tracking number in Admin's Shipments tab clickable. Clicking opens the existing shipment-details modal rather than navigating away or changing shipment data.
- [x] Match Track Package's picked-up-by-container display to the supplied reference using collapsible container cards and stacked package details: tracking number, carrier/type/container, first-received date, and last-scanned date. Preserve detail-modal links.
- [x] Disregard the last-three-months filter and the separate older-package count. Show the customer's full picked-up history for the current search.
- [x] Give each Track Package stage a distinct color while retaining the existing page background. Correct the duplicate green accents by making Unloaded amber; keep Received slate, Registered green, In transit teal, and Picked up purple.
- [x] Match the Staff invoice layout to Admin using shared card spacing, header/actions, filter tabs, table columns and button styling. Preserve Staff-specific access restrictions and invoice calculations.
- [x] Use a solid darker blue background for the Staff top tab bar and the Admin navigation, with readable labels. Preserve the blue page background. The latest placement choice moves Admin navigation to the right side.
- [x] Resume stage-color work: selected tabs and stage filters must match the corresponding Track Package colors on Admin, Staff, and the workflow app.
- [x] In Client 360, after selecting a customer, clicking the Invoice entry in package history opens the actual invoice in a modal. Load persisted catalog charges and dimensions; do not substitute an inline summary or create an invoice as a side effect.
- [x] Restore the Admin navigation groups on the right side of the page: Shipments/Operations, Customers, Invoices/Finances, and Administration. Keep all 16 destinations, use compact controls instead of the old bulky buttons, keep dark-blue styling and the larger visible logo, and adapt the layout for narrow screens.
- [ ] Build the Payments area like the supplied reference: customer/container search, switchable Owing only (on = balance remaining, off = every invoice including paid), Total/Paid/Balance/Status columns, actual invoice modal, and payment recording. Payments cannot be edited or deleted; corrections are append-only reversals. Production activation requires the ledger migration.
- [ ] Add optional How did you hear about us? to signup and display it in Admin Customers details and Client 360. Preserve existing signup while the referral-field migration is not yet installed.

Validation: An isolated snapshot of the completed UI update passed TypeScript, all 18 regression checks, and the production build before commit and push. Production database access was not authorized; new Payments and referral migrations will be delivered and tested separately. No live customer records were created or modified during testing.
