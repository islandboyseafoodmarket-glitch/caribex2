const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

function loadTypeScript(relativeFile) {
  const filename = path.resolve(root, relativeFile);
  const compiled = new Module(filename, module);
  compiled.filename = filename;
  compiled.paths = Module._nodeModulePaths(path.dirname(filename));
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
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
  });
  compiled._compile(result.outputText, filename);
  return compiled.exports;
}

test('Percentage discount save uses the dedicated PATCH API and never needs a dollar amount', () => {
  const admin = read('app/login/panelAdmin.tsx');
  const handler = admin.match(/const saveAdminInvoiceDiscount = async[\s\S]*?\n  };/);
  assert.ok(handler, 'Dedicated discount save handler must exist');
  assert.match(handler[0], /fetch\("\/api\/invoice-catalog"/);
  assert.match(handler[0], /method: "PATCH"/);
  assert.match(handler[0], /discount_action: action/);
  assert.match(handler[0], /discount_code: invoiceDiscountCode/);
  assert.doesNotMatch(handler[0], /invoiceAddOnAmount/);
  assert.match(admin, /Percentage discount \(server-calculated, 10%\)/);
  assert.match(admin, /onClick=\{\(\) => void saveAdminInvoiceDiscount\("apply"\)\}/);
  assert.match(admin, /Fixed amount \(required for fixed charges\)/);
});

test('Discount response updates the actual invoice state and closes only after success', () => {
  const admin = read('app/login/panelAdmin.tsx');
  const handler = admin.match(/const saveAdminInvoiceDiscount = async[\s\S]*?\n  };/);
  assert.ok(handler);
  assert.match(handler[0], /updateFacturaEnEstado\(editingInvoiceAddOns\.id, \{ subtotal, tax, total \}\)/);
  assert.match(handler[0], /await cargarFacturas\(\)/);
  assert.match(handler[0], /setAdminNotice\(action === "apply"/);
  assert.match(handler[0], /setEditingInvoiceAddOns\(null\)/);
  assert.match(handler[0], /setInvoiceDiscountError/);
  assert.match(handler[0], /setIsSavingInvoiceDiscount\(true\)/);
});

test('Server pricing retains the 10% rate, handling fee, and defined scopes', () => {
  const pricing = loadTypeScript('lib/invoice-pricing.ts');
  assert.equal(pricing.INVOICE_DISCOUNT_RATE, 0.10);
  assert.equal(pricing.HANDLING_FEE_RATE, 0.15);
  assert.equal(pricing.INVOICE_DISCOUNTS.business_discount.scope, 'invoice');
  assert.equal(pricing.INVOICE_DISCOUNTS.customer_appreciation.scope, 'invoice');
  assert.equal(pricing.INVOICE_DISCOUNTS.ferry_charge_offset.scope, 'shipping');

  const discount = pricing.roundMoney(125 * pricing.INVOICE_DISCOUNT_RATE);
  const subtotal = pricing.roundMoney(125 - discount);
  const handling = pricing.roundMoney(subtotal * pricing.HANDLING_FEE_RATE);
  assert.equal(discount, 12.5);
  assert.equal(subtotal, 112.5);
  assert.equal(handling, 16.88);
  assert.equal(pricing.roundMoney(subtotal + handling), 129.38);
});

test('API validates discount actions and calculates the amount server-side', () => {
  const route = read('app/api/invoice-catalog/route.ts');
  assert.match(route, /body\?\.discount_action === "apply" \|\| body\?\.discount_action === "remove"/);
  assert.match(route, /typeof code !== "string" \|\| !Object\.hasOwn\(INVOICE_DISCOUNTS, code\)/);
  assert.match(route, /discountAmount = roundMoney\(Math\.min\(currentSubtotal, eligibleSubtotal\) \* INVOICE_DISCOUNT_RATE\)/);
  assert.match(route, /discountAmount, subtotal: nextSubtotal, tax, total/);
  assert.doesNotMatch(route, /body\.discount_amount/);
});
