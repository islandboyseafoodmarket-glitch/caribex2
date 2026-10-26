const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const postcss = require('postcss');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const admin = read('app/login/panelAdmin.tsx');
const staff = read('app/InvoicesStage.tsx');
const warehouse = read('app/GestionAlmacen.tsx');
const css = read('app/globals.css');

test('Admin shipment loader does not request the absent updated_at column', () => {
  const loader = admin.match(/const cargarPedidos = useCallback\(async \(\) => \{([\s\S]*?)\n  \}, \[\]\);/);
  assert.ok(loader, 'Shipment loader must exist');
  const select = loader[1].match(/\.select\(\s*"([^"]+)"/);
  assert.ok(select, 'Explicit shipment column list must exist');
  assert.doesNotMatch(select[1], /\bupdated_at\b/);
  assert.match(select[1], /\bcreado_en\b/);
});

test('Admin preserves all 16 navigation destinations and compact account controls', () => {
  const nav = admin.match(/<nav className="admin-horizontal-nav[^\"]*"[^>]*>([\s\S]*?)<\/nav>/);
  assert.ok(nav);
  assert.equal((nav[1].match(/<button /g) || []).length, 16);
  assert.match(admin, /admin-account-controls/);
  assert.match(admin, /Change password/);
  assert.match(admin, /Sign out/);
  assert.match(admin, /admin-compact-brand/);
  assert.doesNotMatch(admin, /<div className="admin-brand-logo"/);
  assert.doesNotMatch(admin, /#f2a51a/);
  for (const category of ['operations', 'customers', 'billing', 'admin']) {
    assert.ok(nav[1].includes(`admin-horizontal-tab--${category}`));
  }
});

test('Warehouse has a shared flat navigation with stage permissions and counters intact', () => {
  assert.match(warehouse, /<nav className="ga-compact-navigation"/);
  assert.match(warehouse, /data-stage=\{stage\.id\}/);
  assert.match(warehouse, /staffPermissions\.invoices !== false/);
  assert.match(warehouse, /stageCounts\[stage\.id\]/);
  assert.match(warehouse, /ga-compact-brand/);
  assert.match(warehouse, /width=\{320\} height=\{80\}/);
  assert.doesNotMatch(warehouse, /ga-nav-brand|ga-nav-logo|ga-nav-title-main/);
  assert.doesNotMatch(css, /#f2a51a/);
});

test('Warehouse stylesheet parses and stage tabs use the Track Package palette', () => {
  const sheet = postcss.parse(css);
  assert.ok(sheet.nodes.length);
  const palette = loadTypeScript('lib/shipment-colors.ts');
  const mappings = { RECIBIDO_FLORIDA: 'RECEIVED', REGISTRO: 'REGISTERED', EN_TRANSITO: 'IN_TRANSIT', DESCARGADO_ROATAN: 'UNLOADED', PASTILLA: 'PICKED_UP' };
  for (const [staffStage, trackStage] of Object.entries(mappings)) {
    assert.deepEqual(palette.WORKFLOW_STAGE_COLORS[staffStage], palette.SHIPMENT_STAGE_COLORS[trackStage]);
  }
  assert.match(warehouse, /tabColorStyle\(WORKFLOW_STAGE_COLORS\[stage\.id\]\)/);
  assert.match(css, /\.ga-compact-navigation \.ga-stage-label \{ display: inline;/);
});

test('Staff manual invoice keeps catalog selection and customer validation', () => {
  assert.match(staff, /pendingCatalogLines/);
  assert.match(staff, /if \(!manual\.customer_id\)/);
  assert.match(staff, /formatCatalogCharge/);
  assert.match(staff, /onCreateManualInvoice/);
  assert.match(staff, /aria-modal="true"/);
  assert.match(staff, /role="dialog"/);
});

const Module = require('node:module');
const ts = require('typescript');
const compiledCache = new Map();
function loadTypeScript(relativeFile) {
  const filename = path.resolve(root, relativeFile);
  if (compiledCache.has(filename)) return compiledCache.get(filename).exports;
  const compiled = new Module(filename, module);
  compiled.filename = filename;
  compiled.paths = Module._nodeModulePaths(path.dirname(filename));
  compiledCache.set(filename, compiled);
  const nativeRequire = compiled.require.bind(compiled);
  compiled.require = (name) => {
    if (name.startsWith('.')) {
      const base = path.resolve(path.dirname(filename), name);
      for (const extension of ['.ts', '.tsx']) {
        if (fs.existsSync(base + extension)) return loadTypeScript(path.relative(root, base + extension));
      }
    }
    return nativeRequire(name);
  };
  const result = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    fileName: filename,
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  });
  compiled._compile(result.outputText, filename);
  return compiled.exports;
}

test('Page stays blue and Admin/Staff navigation uses the requested solid-blue background', () => {
  assert.match(css, /\.ga-page-wrapper\s*\{[^}]*background: #2f6f9d;/);
  assert.match(css, /\.ga-compact-navigation\s*\{[^}]*background: #173f64;/);
  assert.match(admin, /--bg-main: #2f6f9d;/);
  assert.match(read('app/admin-navigation.css'), /\.dashboard-root \.admin-right-navigation\s*\{[^}]*background: #173f64;/);
});

test('Enabled and disabled invoice previews say handling fee and retain the 15% amount', () => {
  const React = require('react');
  const { renderToStaticMarkup } = require('react-dom/server');
  const pricing = loadTypeScript('lib/invoice-pricing.ts');
  const Preview = loadTypeScript('components/InvoicePreview.tsx').default;
  assert.equal(pricing.HANDLING_FEE_RATE, 0.15);
  assert.equal(pricing.SALES_TAX_RATE, pricing.HANDLING_FEE_RATE, 'Legacy import remains compatible');
  const washer = pricing.BILLABLE_INVOICE_ITEMS.find((item) => item.id === 'washer-dryer-stove');
  assert.ok(washer);
  for (const enabled of [true, false]) {
    const fee = enabled ? pricing.roundMoney(washer.unitPrice * pricing.HANDLING_FEE_RATE) : 0;
    const total = pricing.roundMoney(washer.unitPrice + fee);
    const html = renderToStaticMarkup(React.createElement(Preview, {
      clientName: 'TEST ONLY', tracking: 'TEST-NOT-SAVED', typeLabel: washer.label,
      billingSubtotal: washer.unitPrice, billingTax: fee, billingTotal: total,
    }));
    assert.ok(html.includes(enabled ? 'Handling fee (15%)' : 'Handling fee (not applied)'));
    assert.ok(html.includes(`$${fee.toFixed(2)}`));
    assert.ok(html.includes(`$${total.toFixed(2)}`));
    assert.doesNotMatch(html, /sales tax/i);
  }
});

test('Invoice forms, email templates, summaries and reports use handling-fee terminology', () => {
  for (const file of [
    'app/login/panelAdmin.tsx', 'app/InvoicesStage.tsx', 'app/GestionAlmacen.tsx',
    'app/api/send-invoice/route.ts', 'app/api/invoice-catalog/route.ts',
    'components/InvoicePreview.tsx', 'app/login/ContainersAdmin.tsx', 'app/login/ReportsAdmin.tsx',
  ]) {
    const content = read(file);
    assert.doesNotMatch(content, /sales tax|sales-tax settings|>Tax</i, file);
    assert.match(content, /handling fee|handling-fee/i, file);
  }
});

test('Moderately enlarged Caribex headers precede the tab rows on Admin and Staff', () => {
  assert.ok(admin.indexOf('<div className="admin-compact-brand">') < admin.indexOf('<nav className="admin-horizontal-nav'));
  assert.ok(warehouse.indexOf('<div className="ga-compact-brand">') < warehouse.indexOf('<nav className="ga-compact-navigation"'));
  assert.match(admin, /width=\{320\} height=\{80\} sizes="320px"/);
  assert.match(css, /\.ga-compact-brand img \{ width: 320px; height: 80px;/);
});

test('Shipment tracking numbers are accessible buttons opening the existing detail modal', () => {
  assert.ok(admin.includes('aria-label={`Open shipment details for tracking ${p.tracking}`}'));
  assert.ok(admin.includes('onClick={() => void abrirDetallePedido(p.id)}'));
  assert.match(admin, /onClick=\{\(\) => void abrirDetallePedido\(p\.id\)\}[\s\S]{0,500}#\{p\.tracking\}[\s\S]{0,50}<\/button>/);
});

test('Each Track Package stage has a distinct accent color', () => {
  const palette = loadTypeScript('lib/shipment-colors.ts').SHIPMENT_STAGE_COLORS;
  assert.match(admin, /const TRACK_STAGE_STYLES = SHIPMENT_STAGE_COLORS;/);
  assert.equal(Object.keys(palette).length, 5);
  assert.equal(new Set(Object.values(palette).map((entry) => entry.color)).size, 5);
});

test('Track Package pickup history has no three-month limit or older-package counter', () => {
  assert.doesNotMatch(admin, /last 3 months|collected before|collectionPeriod|trackPickupMonths/);
  assert.match(admin, /Picked up, by container/);
});

test('Admin and Staff invoice panels share one layout stylesheet and table geometry', () => {
  const shared = read('app/invoice-workspace.css');
  postcss.parse(shared);
  assert.match(css, /@import "\.\/invoice-workspace\.css";/);
  assert.match(admin, /data-card--invoices invoice-workspace/);
  assert.match(warehouse, /activeStage === "FACTURAS" \? " invoice-workspace"/);
  assert.match(warehouse, /ga-main--invoices/);
  assert.match(admin, /className="invoice-table-header"/);
  assert.match(admin, /className="invoice-table-row"/);
  assert.match(staff, /className="invoice-table-header"/);
  assert.match(staff, /className="invoice-table-row"/);
  assert.match(shared, /--invoice-columns: minmax\(220px, 2fr\) 200px 150px 100px 140px 140px 280px;/);
  assert.match(shared, /min-width: 1280px;/);
  assert.match(shared, /\.invoice-workspace \.invoice-status-tabs \.tab-pill \{/);
  assert.match(shared, /\.invoice-workspace \.ga-primary-button/);
});

test('Staff invoice panel renders the common header, filters and table for an existing invoice', () => {
  const React = require('react');
  const { renderToStaticMarkup } = require('react-dom/server');
  const InvoicePanel = loadTypeScript('app/InvoicesStage.tsx').default;
  const html = renderToStaticMarkup(React.createElement(InvoicePanel, {
    isEs: false,
    packages: [{ id: 'TEST-NOT-SAVED', tracking: 'TEST-TRACKING', type: 'PACKAGE', estado: 'Descargado', clienteNombre: 'TEST CUSTOMER', numeroCliente: 123, numeroClienteId: 'TEST-CUSTOMER', billing_total: 100, approval_status: 'PENDING', invoice_status: 'PENDING' }],
    onView: () => {}, onCreateManualInvoice: () => {},
  }));
  assert.match(html, /invoice-panel-header/);
  assert.match(html, /invoice-panel-heading/);
  assert.match(html, /invoice-table-scroll/);
  assert.match(html, /invoice-table-header/);
  assert.match(html, /invoice-table-row/);
  assert.match(html, /TEST-TRACKING/);
  assert.match(html, /TEST CUSTOMER/);
  assert.match(html, /Create invoice/);
  assert.doesNotMatch(html, /title="Aprobar factura"|title="Marcar como pagada"|title="Edit invoice add-ons"/);
});

test('Admin and Staff selected invoice filters use the same shared palette', () => {
  assert.match(admin, /<InvoiceStatusTabs/);
  assert.match(staff, /<InvoiceStatusTabs/);
  assert.match(read('components/InvoiceStatusTabs.tsx'), /tabColorStyle\(INVOICE_FILTER_COLORS\[tab\.id\]\)/);
  const colors = loadTypeScript('lib/shipment-colors.ts');
  assert.deepEqual(colors.INVOICE_FILTER_COLORS.sent, colors.SHIPMENT_STAGE_COLORS.IN_TRANSIT);
  assert.deepEqual(colors.INVOICE_FILTER_COLORS.approved, colors.SHIPMENT_STAGE_COLORS.REGISTERED);
  assert.match(read('app/scanner-workflow/page.tsx'), /WORKFLOW_STAGE_COLORS\[step\.key\]/);
});

test('Client 360 invoice entries open the actual invoice modal on Admin and Staff', () => {
  const client360 = read('app/login/Client360Admin.tsx');
  assert.match(warehouse, /onClick=\{\(\) => void handleOpenInvoiceModal\(pkg\)\}/);
  assert.match(warehouse, /Open invoice for/);
  assert.match(client360, /event\.stopPropagation\(\); void openInvoice\(pkg, invoice\);/);
  assert.match(client360, /aria-modal="true" aria-label="Invoice"/);
  assert.match(client360, /extraCharges=\{selectedInvoice\.extraCharges\}/);
  assert.match(client360, /boxSize=\{selectedInvoice\.boxSize\}/);
  const loader = client360.match(/const openInvoice = async[\s\S]*?\n  };/);
  assert.ok(loader);
  assert.match(loader[0], /\.from\("paquetes_checkin"\)/);
  assert.match(loader[0], /cargos_adicionales/);
  assert.doesNotMatch(loader[0], /\.insert\(|\.update\(|\.delete\(|sendInvoice|createInvoice/);
});

test('Actual invoice rendering retains persisted catalog items and handling-fee totals', () => {
  const React = require('react');
  const { renderToStaticMarkup } = require('react-dom/server');
  const pricing = loadTypeScript('lib/invoice-pricing.ts');
  const Preview = loadTypeScript('components/InvoicePreview.tsx').default;
  const washer = pricing.BILLABLE_INVOICE_ITEMS.find((item) => item.id === 'washer-dryer-stove');
  const subtotal = pricing.roundMoney(washer.unitPrice * 2);
  const fee = pricing.roundMoney(subtotal * pricing.HANDLING_FEE_RATE);
  const total = pricing.roundMoney(subtotal + fee);
  const html = renderToStaticMarkup(React.createElement(Preview, {
    tracking: 'TEST-NOT-SAVED', typeLabel: 'PACKAGE', extraCharges: [pricing.formatCatalogCharge(washer, 2)],
    billingSubtotal: subtotal, billingTax: fee, billingTotal: total,
  }));
  assert.match(html, /Washer/i);
  assert.match(html, /Handling fee \(15%\)/);
  assert.ok(html.includes(`$${total.toFixed(2)}`));
});

test('Admin navigation preserves the four functional groups in the left-side workspace layout', () => {
  assert.match(admin, /admin-workspace-layout/);
  assert.match(admin, /admin-right-navigation/);
  for (const heading of [/Shipments\s*\/\s*Operations/, /Customers/, /Invoices\s*\/\s*Finances/, /Administration/]) {
    assert.match(admin, heading);
  }
  const placement = read('app/admin-navigation.css');
  assert.match(placement, /grid-template-columns: minmax\(240px, 260px\) minmax\(0, 1fr\);/);
  assert.match(placement, /\.dashboard-root \.admin-right-navigation\s*\{[^}]*grid-column:\s*1/);
  assert.match(placement, /\.dashboard-root \.admin-workspace-layout > \.data-card\s*\{[^}]*grid-column:\s*2/);
});


test('Payments Owing-only switch includes paid invoices when off and uses ledger balances when on', () => {
  const React = require('react');
  const { renderToStaticMarkup } = require('react-dom/server');
  const Payments = loadTypeScript('app/login/PaymentsAdmin.tsx').default;
  const invoices = [
    { id: 'test-paid', tracking: 'PAID-REFERENCE', clienteNombre: 'Paid customer', clienteNumero: 1, carrier: null, tipo_paquete: 'PACKAGE', contenido: null, creado_en: null, subtotal: 100, tax: 0, total: 100, invoice_status: 'PAID' },
    { id: 'test-owing', tracking: 'OWING-REFERENCE', clienteNombre: 'Owing customer', clienteNumero: 2, carrier: null, tipo_paquete: 'PACKAGE', contenido: null, creado_en: null, subtotal: 100, tax: 0, total: 100, invoice_status: 'PENDING' },
  ];
  const common = { invoices, totals: { invoiced: 200, paid: 125, outstanding: 75 }, filters: { dateFrom: '', dateTo: '', customer: '', port: 'ALL', container: 'ALL' }, onFiltersChange() {}, onStatusFilterChange() {}, ports: [], containers: [], onRecordPayment() {}, onViewPaymentHistory() {}, balances: { 'test-paid': { paid: 100, balance: 0 }, 'test-owing': { paid: 25, balance: 75 } } };
  const all = renderToStaticMarkup(React.createElement(Payments, { ...common, statusFilter: 'ALL' }));
  const owing = renderToStaticMarkup(React.createElement(Payments, { ...common, statusFilter: 'OUTSTANDING' }));
  assert.match(all, /PAID-REFERENCE/);
  assert.match(all, /OWING-REFERENCE/);
  assert.doesNotMatch(owing, /PAID-REFERENCE/);
  assert.match(owing, /OWING-REFERENCE/);
  assert.match(owing, /\$25\.00/);
  assert.match(owing, /\$75\.00/);
  for (const label of ['Client ID', 'Invoice', 'Container', 'Total', 'Paid', 'Balance', 'Status', 'Record payment', 'History']) assert.ok(all.includes(label));
  assert.match(read('app/login/PaymentsAdmin.tsx'), /event\.target\.checked \? "OUTSTANDING" : "ALL"/);
});

test('Payment amounts and dates reject invalid or imprecise financial inputs', () => {
  const ledger = loadTypeScript('lib/payment-ledger.ts');
  assert.equal(ledger.parseAmountCents('12.34'), 1234);
  for (const amount of ['0', '-1', '1.001', 'NaN', '1e3']) assert.throws(() => ledger.parseAmountCents(amount));
  assert.equal(ledger.parsePaymentDate('2026-10-26'), '2026-10-26');
  assert.throws(() => ledger.parsePaymentDate('2026-02-30'));
});

test('Payments use append-only RPCs and explicit reversals, not direct mark-paid writes', () => {
  const api = read('app/api/admin/payments/route.ts');
  const sql = read('supabase/migrations/20261026100000_add_immutable_invoice_payments.sql');
  const dialog = read('components/PaymentLedgerDialog.tsx');
  assert.match(api, /requireAdmin/);
  assert.match(api, /rpc\("record_invoice_payment"/);
  assert.match(api, /rpc\("reverse_invoice_payment"/);
  assert.doesNotMatch(api, /export async function (PUT|PATCH|DELETE)/);
  assert.match(sql, /tg_op in \('UPDATE', 'DELETE', 'TRUNCATE'\)/);
  assert.match(sql, /invoice_payment_summary_guard/);
  assert.match(dialog, /idempotency_key: paymentKey/);
  assert.match(dialog, /action: "reverse"/);
  assert.match(dialog, /original entry stays in history/);
  assert.doesNotMatch(admin, /handleConfirmPayInvoice/);
});

test('Signup referral answers are optional, guarded by schema availability, and visible to Admin', () => {
  const signup = read('app/login/numeroCliente.tsx');
  const api = read('app/api/customer-accounts/route.ts');
  const client360 = read('app/login/Client360Admin.tsx');
  assert.match(signup, /referral_available/);
  assert.match(signup, /heardAboutUsDetails/);
  assert.match(api, /Referral detail requires a referral source/);
  assert.match(api, /customerInsert\.heard_about_us = heardAboutUs/);
  assert.match(api, /referral_available: !error/);
  assert.match(admin, /heard_about_us, heard_about_us_details/);
  assert.match(admin, /How did you hear about us\?/);
  assert.match(client360, /selected\.heard_about_us/);
});

test('Empty prepaid shipment-review notice is not displayed in Payments', () => {
  assert.match(admin, /activeTab === 'prepaid' && facturas\.some/);
  assert.doesNotMatch(admin, /activeTab === 'finanzas' && \(\s*<div[^>]*#[fF]59e0b/);
});


test('Unavailable balances never render guessed paid amounts or balance-derived status', () => {
  const React = require('react');
  const { renderToStaticMarkup } = require('react-dom/server');
  const Payments = loadTypeScript('app/login/PaymentsAdmin.tsx').default;
  const html = renderToStaticMarkup(React.createElement(Payments, {
    invoices: [{ id: 'unknown', tracking: 'UNKNOWN-BALANCE', clienteNombre: 'TEST ONLY', clienteNumero: 1, carrier: null, tipo_paquete: null, creado_en: null, subtotal: 100, tax: 0, total: 100, invoice_status: 'PAID' }],
    totals: { invoiced: 100, paid: 7777.77, outstanding: 8888.88 },
    filters: { dateFrom: '', dateTo: '', customer: '', port: 'ALL', container: 'ALL' },
    statusFilter: 'ALL', ports: [], containers: [], balancesReady: false, recordingEnabled: false,
    onFiltersChange() {}, onStatusFilterChange() {}, onRecordPayment() {},
  }));
  assert.match(html, /Verified payment balances are unavailable/);
  assert.doesNotMatch(html, /7,?777\.77|8,?888\.88|Recorded — no edits/);
  assert.doesNotMatch(admin.match(/const financeTotals = useMemo\([\s\S]*?\}\), \[financeRows, paymentBalances\]\);/)[0], /invoice_status === "PAID"/);
});

test('Calendar payment dates do not move to the prior day in UTC-minus time zones', () => {
  const React = require('react');
  const { renderToStaticMarkup } = require('react-dom/server');
  const Payments = loadTypeScript('app/login/PaymentsAdmin.tsx').default;
  const previous = process.env.TZ;
  process.env.TZ = 'America/Los_Angeles';
  try {
    const html = renderToStaticMarkup(React.createElement(Payments, {
      invoices: [{ id: 'date-test', tracking: 'DATE-TEST', clienteNombre: 'TEST ONLY', clienteNumero: 1, carrier: null, tipo_paquete: null, creado_en: null, subtotal: 100, tax: 0, total: 100, invoice_status: 'PAID', payment_date: '2026-10-26' }],
      totals: { invoiced: 100, paid: 100, outstanding: 0 }, balances: { 'date-test': { paid: 100, balance: 0 } },
      filters: { dateFrom: '', dateTo: '', customer: '', port: 'ALL', container: 'ALL' },
      statusFilter: 'ALL', ports: [], containers: [], onFiltersChange() {}, onStatusFilterChange() {}, onRecordPayment() {},
    }));
    assert.match(html, /10\/26\/2026/);
    assert.doesNotMatch(html, /10\/25\/2026/);
  } finally { if (previous === undefined) delete process.env.TZ; else process.env.TZ = previous; }
  assert.match(admin, /const date = invoice\.payment_date \? invoice\.payment_date\.slice/);
});

test('Staff rejects anonymous sessions, unknown package types are safe, and legacy PAID shortcuts are blocked', () => {
  assert.doesNotMatch(warehouse, /Permitir acceso sin autenticación|setCurrentUserName\("Staff"\)/);
  assert.match(warehouse, /if \(error \|\| !data\?\.user\) \{[\s\S]*?router\.replace\("\/login"\)/);
  assert.match(warehouse, /type: PackageCategoryId \| null;/);
  assert.match(warehouse, /if \(!id\) return isEs \? "Tipo desconocido" : "Unknown type"/);
  assert.match(warehouse, /if \(status === "PAID"\) \{/);
  assert.match(admin, /if \(status === 'PAID'\) \{/);
});


test('Admin and Staff use identical shared invoice tab markup and heading treatment', () => {
  const React = require('react');
  const { renderToStaticMarkup } = require('react-dom/server');
  const Tabs = loadTypeScript('components/InvoiceStatusTabs.tsx').default;
  const html = renderToStaticMarkup(React.createElement(Tabs, { value: 'pending', onChange() {} }));
  assert.equal((html.match(/<button /g) || []).length, 6);
  for (const label of ['Pending approval', 'Approved', 'All', 'Problems', 'Sent', 'Paid']) assert.ok(html.includes(label));
  assert.match(admin, /<InvoiceStatusTabs/);
  assert.match(staff, /<InvoiceStatusTabs value=\{activeFilter\}/);
  assert.match(staff, /<h3 className="invoice-panel-heading"/);
  assert.doesNotMatch(staff, /ga-state-header-icon|invoiceTabs\.map/);
  assert.match(read('app/invoice-workspace.css'), /\.invoice-workspace \.invoice-status-tabs \.tab-pill/);
});


test('Staff selected and hovered navigation tabs are solid stage colors with white content', () => {
  const rules = postcss.parse(css).nodes.filter((node) => node.type === 'rule');
  const active = rules.find((rule) => rule.selector.includes('.ga-stage-chip-active') && !rule.selector.includes('.ga-stage-badge'));
  const hover = rules.find((rule) => rule.selector.includes('.ga-stage-chip:hover'));
  for (const rule of [active, hover]) {
    assert.ok(rule);
    assert.equal(rule.nodes.find((node) => node.prop === 'background').value, 'var(--tab-color)');
    assert.equal(rule.nodes.find((node) => node.prop === 'color').value, '#ffffff');
  }
  assert.match(css, /\.ga-workspace-tab-active \.ga-stage-badge\s*\{[^}]*background: transparent;[^}]*color: #ffffff;/);
});

test('Solid Admin sidebar and selected stage colors keep readable contrast', () => {
  const sidebar = read('app/admin-navigation.css');
  assert.match(sidebar, /\.admin-horizontal-tab\s*\{[^}]*background: #214b73;[^}]*color: #e2e8f0;/);
  assert.match(sidebar, /\.admin-horizontal-tab\.active\s*\{[^}]*background: var\(--tab-color, #475569\);[^}]*color: #ffffff;/);
  const luminance = (hex) => {
    const c = hex.slice(1).match(/../g).map((n) => parseInt(n, 16) / 255).map((n) => n <= .04045 ? n / 12.92 : ((n + .055) / 1.055) ** 2.4);
    return c[0] * .2126 + c[1] * .7152 + c[2] * .0722;
  };
  const contrast = (a, b) => { const x = luminance(a), y = luminance(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
  assert.ok(contrast('#e2e8f0', '#214b73') >= 4.5);
  assert.ok(contrast('#bfdbfe', '#173f64') >= 4.5);
  const stages = loadTypeScript('lib/shipment-colors.ts').SHIPMENT_STAGE_COLORS;
  for (const palette of Object.values(stages)) assert.ok(contrast('#ffffff', palette.color) >= 4.5, palette.color);
});

test('Portal Alerts loads during initialization and never presents an unverified zero', () => {
  assert.match(admin, /cargarLeads\(\);\s*void cargarPortalEvents\(\);/);
  assert.match(admin, /realtime-portal-events/);
  assert.match(admin, /portalEventsRequestRef\.current \+= 1/);
  const expression = admin.match(/const portalAlertsBadge = ([\s\S]*?);/)[1];
  const badge = new Function('portalEventsStatus', 'portalEvents', `return ${expression};`);
  const events = [{ success: true }, { success: false }, { success: false }];
  assert.equal(badge('ready', events), 2);
  assert.equal(badge('ready', []), 0);
  assert.equal(badge('loading', []), '…');
  assert.equal(badge('idle', []), '?');
  assert.equal(badge('error', []), '?');
  assert.match(admin, /portalEventsStatus === 'ready' && portalEvents\.length === 0/);
});

test('Customer Leads uses scoped solid title and column headers with readable controls', () => {
  const leads = read('app/admin-leads.css');
  postcss.parse(leads);
  assert.match(css, /@import "\.\/admin-leads\.css";/);
  assert.match(admin, /activeTab === 'leads' \? 'data-card--leads'/);
  assert.match(leads, /\.card-header-inner\s*\{[^}]*background: #173f64;/);
  assert.match(leads, /\.admin-table thead th\s*\{[^}]*background: #173f64;[^}]*color: #ffffff;/);
  assert.match(leads, /\.admin-table tbody td\s*\{[^}]*background: #ffffff;[^}]*color: #0f172a;/);
  assert.match(leads, /\.admin-table textarea\s*\{[^}]*background: #ffffff;[^}]*color: #0f172a;/);
});


test('All Admin/Staff workspaces use opaque panel surfaces and solid readable header bars', () => {
  const theme = read('app/workspace-theme.css');
  const parsed = postcss.parse(theme);
  assert.match(css, /@import "\.\/workspace-theme\.css";/);
  assert.match(theme, /\.ga-page-wrapper \.ga-state-card\s*\{[^}]*background: #eaf3fb;/);
  assert.match(theme, /\.invoice-panel-header\s*\{[^}]*background: #173f64;/);
  const header = parsed.nodes.find((node) => node.type === 'rule' && node.selector.includes('.invoice-workspace .invoice-table-header') && !node.selector.includes('> span'));
  assert.equal(header.nodes.find((node) => node.prop === 'background').value, '#173f64');
  assert.equal(header.nodes.find((node) => node.prop === 'color').value, '#ffffff');
  assert.equal(header.nodes.find((node) => node.prop === 'color').important, true);
});

test('Shared Admin/Staff invoice filter tabs no longer have clear or two-tone backgrounds', () => {
  const shared = postcss.parse(read('app/invoice-workspace.css'));
  const base = shared.nodes.find((node) => node.type === 'rule' && node.selector === '.invoice-workspace .invoice-status-tabs .tab-pill');
  const active = shared.nodes.find((node) => node.type === 'rule' && node.selector === '.invoice-workspace .invoice-status-tabs .tab-pill.active');
  assert.equal(base.nodes.find((node) => node.prop === 'background').value, '#214b73');
  assert.equal(active.nodes.find((node) => node.prop === 'background').value, 'var(--tab-color, #166534)');
  assert.equal(active.nodes.find((node) => node.prop === 'color').value, '#ffffff');
});
