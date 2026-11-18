/* QA report 18 Nov 2026: inventory, purchases, vendors (H1, H6, M1, M2, M5, M16, M17, M18, L2, L3). */
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { boot, client, makeUser, settings, M } = require('./helpers');
const inventory = require('../src/services/inventory');

let ctx; let a;
before(async () => {
  ctx = await boot(); await settings.set({ enforce_2fa_staff: '0' });
  const sa = await makeUser({ role: 'super_admin' }); a = client(ctx.base); assert.equal((await a.post('/api/auth/login', { email: sa.email, password: 'Passw0rd!x' })).status, 200);
});
after(async () => { ctx.server.close(); await M.sequelize.close(); });
const item = async (extra = {}) => { const r = await a.post('/api/admin/inventory/items', { name: `Chip ${Math.random()}`, purchase_price: 12.5, opening_stock: 50, ...extra }); assert.equal(r.status, 201, r.text); return r.body.data; };
const stock = async (id) => (await inventory.levels([id]))[id]?.total || 0;

test('H1/L3: an adjustment can never take stock below zero, and the message says what is available', async () => {
  const it = await item(); assert.equal(await stock(it.id), 50);
  const bad = await a.post('/api/admin/inventory/adjust', { inventory_item_id: it.id, quantity: -100, type: 'adjustment' });
  assert.equal(bad.status, 422); assert.match(bad.body.message, /below 0.*Only 50/); assert.equal(await stock(it.id), 50, 'nothing was saved');
  assert.equal((await a.post('/api/admin/inventory/adjust', { inventory_item_id: it.id, quantity: 100, type: 'damage' })).status, 422, 'damage is a removal too');
  assert.equal((await a.post('/api/admin/inventory/adjust', { inventory_item_id: it.id, quantity: 0, type: 'adjustment' })).status, 422);
  assert.equal((await a.post('/api/admin/inventory/adjust', { inventory_item_id: it.id, quantity: -50, type: 'adjustment' })).status, 200); assert.equal(await stock(it.id), 0, 'down to exactly 0 is fine');
  const t = await a.post('/api/admin/inventory/transfer', { inventory_item_id: it.id, quantity: 5, to_vendor_id: null, from_vendor_id: null }); assert.equal(t.status, 422);
  const v = await M.Vendor.create({ name: 'Printer', type: 'printing' });
  const t2 = await a.post('/api/admin/inventory/transfer', { inventory_item_id: it.id, quantity: 5, to_vendor_id: v.id }); assert.equal(t2.status, 422); assert.match(t2.body.message, /Only 0 available/, 'never "Only -50 available"');
});

test('M1/M2: negative opening stock and negative reorder level are refused with field errors', async () => {
  const r = await a.post('/api/admin/inventory/items', { name: 'Neg', opening_stock: -3 }); assert.equal(r.status, 422); assert.match(r.body.errors.opening_stock, /0 or more/);
  const r2 = await a.post('/api/admin/inventory/items', { name: 'Neg2', reorder_level: -5 }); assert.equal(r2.status, 422); assert.match(r2.body.errors.reorder_level, /0 or more/);
  const it = await item(); assert.equal((await a.put(`/api/admin/inventory/items/${it.id}`, { name: it.name, reorder_level: -1 })).status, 422);
});

test('L2/M6-style: auto SKUs are one tidy pattern; duplicates are refused regardless of case', async () => {
  const x = await item(); const y = await item(); assert.match(x.sku, /^INV-\d{5}$/); assert.match(y.sku, /^INV-\d{5}$/); assert.notEqual(x.sku, y.sku);
  const d = await a.post('/api/admin/inventory/items', { name: 'Dup', sku: x.sku.toLowerCase() }); assert.equal(d.status, 422); assert.match(d.body.errors.sku, /already used/);
});

test('M5: low stock counts items at or under the reorder level and ANY negative stock', async () => {
  const low = await item({ reorder_level: 60 }); const fine = await item({ reorder_level: 5 }); const neg = await item({ opening_stock: 0 });
  await M.StockMovement.create({ inventory_item_id: neg.id, type: 'adjustment', quantity: -7, date: '2026-11-18' }); // as old data can already hold
  const ids = (await inventory.lowStock()).map((x) => x.id);
  assert.ok(ids.includes(low.id)); assert.ok(!ids.includes(fine.id)); assert.ok(ids.includes(neg.id), 'negative stock is flagged even with reorder level 0');
});

test('H6: a purchase prices the average from positive stock only (negative counts as 0)', async () => {
  const it = await item({ opening_stock: 0, purchase_price: 5595 });
  await M.StockMovement.create({ inventory_item_id: it.id, type: 'adjustment', quantity: -50, date: '2026-11-18' });
  const r = await a.post('/api/admin/purchases', { date: '2026-11-18', supplier_name: 'S', items: JSON.stringify([{ inventory_item_id: it.id, quantity: 10, unit_price: 15 }]) });
  assert.equal(r.status, 201, r.text);
  const after = await M.InventoryItem.findByPk(it.id); assert.equal(Number(after.purchase_price), 15, 'avg cost is the new unit cost, not 5,595');
});

test('M16: purchases refuse negative freight, duties, rates, quantities and prices', async () => {
  const it = await item(); const line = (o = {}) => JSON.stringify([{ inventory_item_id: it.id, quantity: 1, unit_price: 10, ...o }]);
  for (const [body, field] of [[{ shipping_cost: -5 }, 'shipping_cost'], [{ customs_duty: -1 }, 'customs_duty'], [{ exchange_rate: 0 }, 'exchange_rate'], [{ paid_amount: -9 }, 'paid_amount']]) {
    const r = await a.post('/api/admin/purchases', { date: '2026-11-18', items: line(), ...body }); assert.equal(r.status, 422, field); assert.ok(r.body.errors[field], field);
  }
  assert.equal((await a.post('/api/admin/purchases', { date: '2026-11-18', items: line({ quantity: 0 }) })).status, 422);
  assert.equal((await a.post('/api/admin/purchases', { date: '2026-11-18', items: line({ unit_price: -2 }) })).status, 422);
  assert.equal((await a.post('/api/admin/purchases', { date: '2026-11-18', items: line(), shipping_cost: 4 })).status, 201);
});

test('M17/M18: vendors: no negative opening balance or rate; a payment needs an account and cannot exceed what is owed', async () => {
  assert.equal((await a.post('/api/admin/vendors', { name: 'V1', opening_balance: -300 })).status, 422);
  assert.equal((await a.post('/api/admin/vendors', { name: 'V1', rates: JSON.stringify([{ label: 'Card', rate: -4 }]) })).status, 422);
  const v = (await a.post('/api/admin/vendors', { name: 'Printers', type: 'printing', opening_balance: 100 })).body.data;
  const acc = await M.FinanceAccount.create({ name: 'Cash', type: 'cash', opening_balance: 0 });
  const noAcc = await a.post('/api/admin/vendor-payments', { vendor_id: v.id, amount: 50, date: '2026-11-18' }); assert.equal(noAcc.status, 422); assert.match(noAcc.body.errors.account_id, /choose an account/i);
  const over = await a.post('/api/admin/vendor-payments', { vendor_id: v.id, amount: 5000, date: '2026-11-18', account_id: acc.id }); assert.equal(over.status, 422); assert.match(over.body.errors.amount, /owe only Rs 100/);
  assert.equal((await a.post('/api/admin/vendor-payments', { vendor_id: v.id, amount: 100, date: '2026-11-18', account_id: acc.id })).status, 201);
  const none = await a.post('/api/admin/vendor-payments', { vendor_id: v.id, amount: 1, date: '2026-11-18', account_id: acc.id }); assert.equal(none.status, 422); assert.match(none.body.errors.amount, /No bills/);
  await a.post('/api/admin/vendor-bills', { vendor_id: v.id, amount: 40, date: '2026-11-18' });
  assert.equal((await a.post('/api/admin/vendor-payments', { vendor_id: v.id, amount: 40, date: '2026-11-18', account_id: acc.id })).status, 201);
});
