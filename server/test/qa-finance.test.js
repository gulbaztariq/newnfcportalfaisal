/* QA report 18 Nov 2026: products, finance, coupons, languages, templates (H5, M6, M7, M10, M13, M14, M20, M31, M33, M34, L6, L7, L15). */
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { boot, client, makeUser, settings, M } = require('./helpers');

let ctx; let a;
before(async () => {
  ctx = await boot(); await settings.set({ enforce_2fa_staff: '0' });
  const sa = await makeUser({ role: 'super_admin' }); a = client(ctx.base); assert.equal((await a.post('/api/auth/login', { email: sa.email, password: 'Passw0rd!x' })).status, 200);
});
after(async () => { ctx.server.close(); await M.sequelize.close(); });
let n = 0; const uniq = (p) => `${p}${Date.now()}${++n}`;

test('H5/M6/L7/M33: products have unique SKUs (any case), sane prices, and a paginated filtered list', async () => {
  const mk = (o = {}) => a.post('/api/admin/nfc-cards', { name: uniq('P'), price: 100, ...o });
  const first = await mk({ sku: 'ab-100' }); assert.equal(first.status, 201, first.text); assert.equal(first.body.data.sku, 'AB-100');
  const dup = await mk({ sku: 'AB-100' }); assert.equal(dup.status, 422); assert.match(dup.body.errors.sku, /already used/);
  assert.equal((await mk({ sku: 'ab-100 ' })).status, 422, 'case and spaces do not make it different');
  assert.equal((await mk({ customization_price: -10 })).status, 422); assert.equal((await mk({ compare_price: 50 })).status, 422);
  for (let i = 0; i < 30; i += 1) await M.NfcCard.create({ name: uniq('Bulk'), slug: uniq('bulk'), price: 5, status: true, show_in_shop: i % 2 === 0 });
  const page = await a.get('/api/admin/nfc-cards?page=1&per_page=10'); assert.equal(page.status, 200); assert.equal(page.body.data.length, 10); assert.ok(page.body.meta?.total >= 31 || page.body.total >= 31 || JSON.stringify(page.body).includes('"total"'));
  const hidden = await a.get('/api/admin/nfc-cards?visibility=hidden&per_page=50'); assert.ok(hidden.body.data.every((p) => p.show_in_shop === false));
  const found = await a.get('/api/admin/nfc-cards?search=ab-100'); assert.equal(found.body.data.length, 1);
  assert.equal((await a.get('/api/admin/nfc-cards?all=1')).body.data.length >= 31, true, 'dropdowns still get everything');
  const src = await M.OrderSource.create({ name: 'Site', status: true }); await M.NfcCard.create({ name: uniq('Syn'), slug: uniq('syn'), price: 9, order_source_id: src.id, show_in_shop: false });
  assert.ok((await a.get('/api/admin/nfc-cards?source=shop&per_page=100')).body.data.every((p) => !p.order_source_id)); assert.ok((await a.get('/api/admin/nfc-cards?source=synced')).body.data.every((p) => p.order_source_id));
});

test('M7: costing components need a quantity above 0', async () => {
  const p = await M.NfcCard.create({ name: uniq('C'), slug: uniq('c'), price: 1 }); const it = (await a.post('/api/admin/inventory/items', { name: uniq('I'), purchase_price: 5 })).body.data;
  const bad = await a.put(`/api/admin/nfc-cards/${p.id}/components`, { components: JSON.stringify([{ inventory_item_id: it.id, quantity: -2 }]) }); assert.equal(bad.status, 422); assert.match(bad.body.errors.components, /more than 0/);
  assert.equal((await a.put(`/api/admin/nfc-cards/${p.id}/components`, { components: JSON.stringify([{ inventory_item_id: it.id, quantity: 2 }]) })).status, 200);
});

test('M10: an order-source item discount can never be above its price', async () => {
  const src = await M.OrderSource.create({ name: uniq('S'), status: true }); const p = await M.NfcCard.create({ name: uniq('X'), slug: uniq('x'), price: 100, source_price: 100, order_source_id: src.id });
  const bad = await a.put(`/api/admin/order-sources/${src.id}/products`, { products: JSON.stringify([{ id: p.id, discount_type: 'fixed', discount_value: 150 }]) }); assert.equal(bad.status, 422); assert.match(bad.body.errors.products, /discount cannot be more than the price/);
  assert.equal((await a.put(`/api/admin/order-sources/${src.id}/products`, { products: JSON.stringify([{ id: p.id, discount_type: 'fixed', discount_value: 40 }]) })).status, 200);
  const imp = await a.post(`/api/admin/order-sources/${src.id}/import`, { text: 'Blue card, 1500\nthis line has no price\nRed card 900' }); assert.equal(imp.status, 200); assert.match(imp.body.message, /1 line skipped.*this line has no price/);
});

test('M13/M14/L6/M31: partner shares total at most 100%, expenses need an account when paid, categories are case-insensitive, used accounts cannot be deleted', async () => {
  assert.equal((await a.post('/api/admin/finance/partners', { name: 'P1', share_percent: 60 })).status, 201);
  const over = await a.post('/api/admin/finance/partners', { name: 'P2', share_percent: 100 }); assert.equal(over.status, 422); assert.match(over.body.errors.share_percent, /cannot be more than 100%/);
  assert.equal((await a.post('/api/admin/finance/partners', { name: 'P2', share_percent: 40 })).status, 201);
  const acc = (await a.post('/api/admin/finance/accounts', { name: 'Bank', type: 'bank', opening_balance: 0 })).body.data;
  const noAcc = await a.post('/api/admin/finance/entries', { type: 'expense', date: '2026-11-18', title: 'Rent', amount: 100, status: 'paid' }); assert.equal(noAcc.status, 422); assert.match(noAcc.body.errors.account_id, /Choose the account/);
  assert.equal((await a.post('/api/admin/finance/entries', { type: 'expense', date: '2026-11-18', title: 'Unpaid bill', amount: 100, status: 'unpaid' })).status, 201, 'an unpaid bill needs no account yet');
  assert.equal((await a.post('/api/admin/finance/entries', { type: 'expense', date: '2026-11-18', title: 'Rent', amount: 100, status: 'paid', account_id: acc.id })).status, 201);
  const del = await a.del(`/api/admin/finance/accounts/${acc.id}`); assert.equal(del.status, 422); assert.match(del.body.message, /1 transaction/);
  assert.equal((await a.post('/api/admin/finance/categories', { name: 'Courier', type: 'expense' })).status, 201);
  assert.equal((await a.post('/api/admin/finance/categories', { name: 'courier', type: 'expense' })).status, 422);
  assert.equal((await a.post('/api/admin/finance/categories', { name: 'courier', type: 'income' })).status, 201, 'a different type is fine');
});

test('M20/M34/L15: coupons need a future expiry, language codes are letters only, template names are unique', async () => {
  const old = await a.post('/api/admin/coupon-codes', { coupon_name: 'OLD1', type: 'fixed', discount: 5, expire_at: '2020-01-01', status: true }); assert.equal(old.status, 422); assert.match(old.body.errors.expire_at, /today or later/);
  assert.equal((await a.post('/api/admin/coupon-codes', { coupon_name: 'OLD2', type: 'fixed', discount: 5, expire_at: '2020-01-01', status: false })).status, 201, 'an ended coupon can exist if it is switched off');
  assert.equal((await a.post('/api/admin/coupon-codes', { coupon_name: 'NEW1', type: 'fixed', discount: 5, expire_at: '2099-01-01', status: true })).status, 201);
  const bad = await a.post('/api/admin/languages', { name: 'Odd', iso_code: '!@#$%' }); assert.equal(bad.status, 422); assert.match(bad.body.errors.iso_code, /2 or 3 letters/);
  assert.equal((await a.post('/api/admin/languages', { name: 'Portuguese BR', iso_code: 'PT-BR' })).status, 201); assert.equal((await M.Language.findOne({ where: { name: 'Portuguese BR' } })).iso_code, 'pt-br');
  const t1 = await M.Template.create({ name: 'Spotlight QA', slug: uniq('t'), status: true }); const t2 = await M.Template.create({ name: 'Other QA', slug: uniq('t'), status: true });
  const dup = await a.patch(`/api/admin/templates/${t2.id}`, { name: 'spotlight qa' }); assert.equal(dup.status, 422); assert.match(dup.body.errors.name, /already has this name/);
  assert.equal((await a.patch(`/api/admin/templates/${t1.id}`, { name: 'Spotlight QA' })).status, 200, 'keeping its own name is fine');
});
