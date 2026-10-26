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
  assert.match(warehouse, /width=\{156\} height=\{68\}/);
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
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true },
  });
  compiled._compile(result.outputText, filename);
  return compiled.exports;
}

test('Page backgrounds stay blue and both top tab strips use the requested darker blue', () => {
  assert.match(css, /\.ga-page-wrapper\s*\{[^}]*background: #2f6f9d;/);
  assert.match(css, /\.ga-compact-navigation\s*\{[^}]*background: #173f64;/);
  assert.match(admin, /--bg-main: #2f6f9d;/);
  assert.match(admin, /\.admin-horizontal-nav\s*\{[^}]*background: #173f64;/);
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
  assert.match(admin, /width=\{156\} height=\{68\} sizes="156px"/);
  assert.match(css, /\.ga-compact-brand img \{ width: 156px; height: 68px;/);
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
  assert.match(shared, /\.invoice-workspace \.tab-pill \{/);
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
  assert.match(admin, /tabColorStyle\(INVOICE_FILTER_COLORS\.pending\)/);
  assert.match(admin, /tabColorStyle\(INVOICE_FILTER_COLORS\.approved\)/);
  assert.match(admin, /tabColorStyle\(INVOICE_FILTER_COLORS\.sent\)/);
  assert.match(admin, /tabColorStyle\(INVOICE_FILTER_COLORS\.paid\)/);
  assert.match(staff, /tabColorStyle\(INVOICE_FILTER_COLORS\[tab\.id\]\)/);
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

test('Admin navigation restores the four functional groups in the right-side workspace layout', () => {
  assert.match(admin, /admin-workspace-layout/);
  assert.match(admin, /admin-right-navigation/);
  for (const heading of [/Shipments\s*\/\s*Operations/, /Customers/, /Invoices\s*\/\s*Finances/, /Administration/]) {
    assert.match(admin, heading);
  }
  assert.match(admin, /\.admin-workspace-layout\s*\{[^}]*grid-template-columns:/);
  assert.match(admin, /\.admin-right-navigation\s*\{[^}]*grid-column:\s*2/);
});
