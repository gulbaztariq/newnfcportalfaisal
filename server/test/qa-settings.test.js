/* QA report 18 Nov 2026: settings validation, short-link batches (H7, M23, M28). */
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { boot, client, makeUser, settings, M } = require('./helpers');

let ctx; let a;
before(async () => {
  ctx = await boot(); await settings.set({ enforce_2fa_staff: '0' });
  const sa = await makeUser({ role: 'super_admin' }); a = client(ctx.base); assert.equal((await a.post('/api/auth/login', { email: sa.email, password: 'Passw0rd!x' })).status, 200);
});
after(async () => { ctx.server.close(); await M.sequelize.close(); });

test('H7: shop settings refuse negative amounts, tax over 100, tier discount over 100, bad tiers', async () => {
  for (const [body, field] of [[{ shop_min_order: '-100' }, 'shop_min_order'], [{ nfc_tax_rate: '150' }, 'nfc_tax_rate'], [{ sample_markup_percent: '-20' }, 'sample_markup_percent'], [{ cod_charges: '-5' }, 'cod_charges'], [{ sample_max_qty: '0' }, 'sample_max_qty']]) {
    const r = await a.put('/api/admin/settings', body); assert.equal(r.status, 422, field); assert.ok(r.body.errors[field], field);
  }
  const t1 = await a.put('/api/admin/settings', { wholesale_tiers: JSON.stringify([{ min: 25, percent: 150 }]) }); assert.equal(t1.status, 422); assert.match(t1.body.errors.wholesale_tiers, /between 0 and 100/);
  const t2 = await a.put('/api/admin/settings', { wholesale_tiers: JSON.stringify([{ min: 50, percent: 10 }, { min: 25, percent: 15 }]) }); assert.equal(t2.status, 422); assert.match(t2.body.errors.wholesale_tiers, /go up/);
  assert.equal((await a.put('/api/admin/settings', { shop_min_order: '100', nfc_tax_rate: '17', wholesale_tiers: JSON.stringify([{ min: 25, percent: 10 }, { min: 50, percent: 15 }]) })).status, 200);
  assert.equal(await settings.get('nfc_tax_rate'), '17');
});

test('M23: invoice numbering settings: next number above the last issued, digits 1-10, due days 0 or more', async () => {
  await M.Invoice.create({ number: 'INV-00007', type: 'manual', customer_name: 'X', items: [], subtotal: 1, total: 1, status: 'sent', token: 't'.repeat(20) }).catch(() => {});
  const low = await a.put('/api/admin/settings', { invoice_next_number: '1' }); assert.equal(low.status, 422); assert.match(low.body.errors.invoice_next_number, /higher than the last one issued/);
  assert.equal((await a.put('/api/admin/settings', { invoice_number_padding: '-2' })).status, 422); assert.equal((await a.put('/api/admin/settings', { invoice_number_padding: '11' })).status, 422);
  assert.equal((await a.put('/api/admin/settings', { invoice_due_days: '-10' })).status, 422);
  assert.equal((await a.put('/api/admin/settings', { invoice_next_number: '50', invoice_number_padding: '6', invoice_due_days: '14' })).status, 200);
});

test('M28: bulk short links: limits are explained, not clamped; a batch can be deleted while unused', async () => {
  const big = await a.post('/api/admin/short-links/bulk', { count: 6000 }); assert.equal(big.status, 422); assert.match(big.body.errors.count, /5000 or less/);
  const len = await a.post('/api/admin/short-links/bulk', { count: 5, length: 1 }); assert.equal(len.status, 422); assert.match(len.body.errors.length, /5 or more/);
  const ok = await a.post('/api/admin/short-links/bulk', { count: 6, batch: 'QA batch' }); assert.equal(ok.status, 201, ok.text);
  const one = await M.ShortLink.findOne({ where: { batch: 'QA batch' } }); await one.update({ clicks: 3 });
  const del = await a.del('/api/admin/short-links/batch/QA%20batch'); assert.equal(del.status, 200); assert.match(del.body.message, /5 unused links deleted.*1 that are already in use were kept/);
  assert.equal(await M.ShortLink.count({ where: { batch: 'QA batch' } }), 1);
  assert.equal((await a.del('/api/admin/short-links/batch/QA%20batch')).status, 422);
  assert.equal((await a.del('/api/admin/short-links/batch/Nope')).status, 404);
});
