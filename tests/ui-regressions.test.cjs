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
  const nav = admin.match(/<nav className="admin-horizontal-nav"[^>]*>([\s\S]*?)<\/nav>/);
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
  assert.match(warehouse, /width=\{112\} height=\{48\}/);
  assert.doesNotMatch(warehouse, /ga-nav-brand|ga-nav-logo|ga-nav-title-main/);
  assert.doesNotMatch(css, /#f2a51a/);
});

test('Warehouse stylesheet parses and defines a separate accent for every stage', () => {
  const sheet = postcss.parse(css);
  assert.ok(sheet.nodes.length);
  const stages = ['RECIBIDO_FLORIDA', 'REGISTRO', 'EN_TRANSITO', 'DESCARGADO_ROATAN', 'PASTILLA', 'FACTURAS'];
  const accents = new Set();
  for (const stage of stages) {
    const rule = sheet.nodes.find((node) => node.type === 'rule' && node.selector === `.ga-compact-navigation [data-stage="${stage}"]`);
    assert.ok(rule, `Accent rule required for ${stage}`);
    accents.add(rule.nodes.find((node) => node.prop === '--tab-color').value);
  }
  assert.equal(accents.size, stages.length);
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

test('Blue page backgrounds and the existing light tab strip are preserved', () => {
  assert.match(css, /\.ga-page-wrapper\s*\{[^}]*background: #2f6f9d;/);
  assert.match(css, /\.ga-compact-navigation\s*\{[^}]*background: #f1f2ee;/);
  assert.match(admin, /--bg-main: #2f6f9d;/);
  assert.match(admin, /\.admin-horizontal-nav\s*\{[^}]*background: #f1f2ee;/);
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

test('Small Caribex headers precede the tab rows on Admin and Staff', () => {
  assert.ok(admin.indexOf('<div className="admin-compact-brand">') < admin.indexOf('<nav className="admin-horizontal-nav"'));
  assert.ok(warehouse.indexOf('<div className="ga-compact-brand">') < warehouse.indexOf('<nav className="ga-compact-navigation"'));
  assert.match(admin, /width=\{112\} height=\{48\} sizes="112px"/);
  assert.match(css, /\.ga-compact-brand img \{ width: 112px; height: 48px;/);
});

test('Shipment tracking numbers are accessible buttons opening the existing detail modal', () => {
  assert.ok(admin.includes('aria-label={`Open shipment details for tracking ${p.tracking}`}'));
  assert.ok(admin.includes('onClick={() => void abrirDetallePedido(p.id)}'));
  assert.match(admin, /onClick=\{\(\) => void abrirDetallePedido\(p\.id\)\}[\s\S]{0,500}#\{p\.tracking\}[\s\S]{0,50}<\/button>/);
});

test('Each Track Package stage has a distinct accent color', () => {
  const styles = admin.match(/const TRACK_STAGE_STYLES[\s\S]*?=\s*\{([\s\S]*?)\n\};/);
  assert.ok(styles);
  const entries = [...styles[1].matchAll(/(RECEIVED|REGISTERED|IN_TRANSIT|UNLOADED|PICKED_UP):\s*\{\s*color:\s*['"]([^'"]+)['"]/g)];
  assert.equal(entries.length, 5);
  assert.equal(new Set(entries.map((entry) => entry[2])).size, 5);
});

test('Track Package pickup history has no three-month limit or older-package counter', () => {
  assert.doesNotMatch(admin, /last 3 months|collected before|collectionPeriod|trackPickupMonths/);
  assert.match(admin, /Picked up, by container/);
});
