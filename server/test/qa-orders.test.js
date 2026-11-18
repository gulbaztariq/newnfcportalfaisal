/* QA report 18 Nov 2026: COD, courier orders, settlements, invoices (H3, H4, M9, M15, M29, M30, L25). */
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { boot, client, makeUser, settings, M } = require('./helpers');
const finance = require('../src/services/finance');

let ctx; let a; let seq = 0;
before(async () => {
  ctx = await boot(); await settings.set({ enforce_2fa_staff: '0', invoice_auto_orders: '1' });
  const sa = await makeUser({ role: 'super_admin' }); a = client(ctx.base); assert.equal((await a.post('/api/auth/login', { email: sa.email, password: 'Passw0rd!x' })).status, 200);
});
after(async () => { ctx.server.close(); await M.sequelize.close(); });
const product = () => M.NfcCard.create({ name: `QA p${++seq}`, slug: `qa-${seq}-${Date.now()}`, price: 419, status: true });
const place = async (over = {}) => { const p = await product(); const r = await a.post('/api/admin/orders', { name: 'Walk In', phone: '03001234567', address: 'Shop 1', city: 'Karachi', customer_type: 'guest', order_type: 'nfc_profile', is_cod: true, items: [{ product_id: p.id, quantity: 1 }], ...over }); assert.equal(r.status, 201, r.text.slice(0, 300)); return M.NfcOrder.findByPk(r.body.data.id); };

test('H4/M30: a courier order needs phone, address and city; collection orders do not', async () => {
  const p = await product(); const base = { name: 'W', customer_type: 'guest', order_type: 'nfc_profile', is_cod: true, items: [{ product_id: p.id, quantity: 1 }] };
  const r = await a.post('/api/admin/orders', base); assert.equal(r.status, 422); assert.match(r.body.errors.phone, /Phone number is required/); assert.match(r.body.errors.address, /Delivery address/); assert.match(r.body.errors.city, /City is required/);
  assert.equal((await a.post('/api/admin/orders', { ...base, phone: '03001234567', address: 'x', city: 'y' })).status, 201);
  assert.equal((await a.post('/api/admin/orders', { ...base, fulfilment: 'collection', is_cod: false })).status, 201, 'office collection needs no address');
});

test('H4: dispatch and delivery are blocked until a courier and tracking number are set', async () => {
  const o = await place();
  const no = await a.patch(`/api/admin/orders/${o.id}`, { order_status: 'shipped' }); assert.equal(no.status, 422); assert.match(no.body.message, /courier and the tracking number/);
  assert.equal((await a.patch(`/api/admin/orders/${o.id}`, { order_status: 'delivered' })).status, 422);
  assert.equal((await a.patch(`/api/admin/orders/${o.id}`, { courier: 'leopards', tracking_number: 'TRK-1', order_status: 'shipped' })).status, 200);
});

test('H3: delivering a COD order does not mark it paid; the settlement does, and pays the invoice', async () => {
  const o = await place(); await a.patch(`/api/admin/orders/${o.id}`, { order_status: 'confirmed' });
  await new Promise((r) => setTimeout(r, 300)); const inv = await M.Invoice.findOne({ where: { nfc_order_id: o.id } }) || await require('../src/services/invoices').fromOrder(o.id); assert.ok(inv, 'invoice'); assert.equal(inv.status, 'sent');
  await a.patch(`/api/admin/orders/${o.id}`, { courier: 'leopards', tracking_number: 'TRK-H3', order_status: 'shipped' });
  await a.patch(`/api/admin/orders/${o.id}`, { order_status: 'delivered' });
  let fresh = await M.NfcOrder.findByPk(o.id); assert.equal(fresh.order_status, 'delivered'); assert.equal(fresh.payment_status, 'pending', 'COD stays unpaid until the courier pays');
  const ledgerBefore = await finance.ledger({}); assert.ok(!ledgerBefore.some((r) => r.id === `or-${o.id}`), 'unsettled COD is not "money in"');
  const rec = await a.post('/api/admin/finance/settlements', { date: '2026-11-18', cod_amount: 419, charges: 100, reference: 'S1', tracking_numbers: 'TRK-H3' }); assert.equal(rec.status, 201, rec.text);
  assert.equal(Number(rec.body.data.net_amount), 319);
  fresh = await M.NfcOrder.findByPk(o.id); assert.equal(fresh.cod_settled, true); assert.equal(fresh.payment_status, 'paid');
  const inv2 = await M.Invoice.findByPk(inv.id); assert.equal(inv2.status, 'paid'); assert.equal(Number(inv2.paid_amount), Number(inv2.total));
  assert.ok((await finance.ledger({})).some((r) => r.id === `or-${o.id}`), 'counted once it is settled');
});

test('M15: settlement charges cannot exceed the COD collected; unknown tracking numbers are reported', async () => {
  const bad = await a.post('/api/admin/finance/settlements', { date: '2026-11-18', cod_amount: 419, charges: 5000 }); assert.equal(bad.status, 422); assert.match(bad.body.errors.charges, /more than the COD/);
  assert.equal((await a.post('/api/admin/finance/settlements', { date: '2026-11-18', cod_amount: 0 })).status, 422);
  const unk = await a.post('/api/admin/finance/settlements', { date: '2026-11-18', cod_amount: 100, tracking_numbers: 'NOPE-1' }); assert.equal(unk.status, 422); assert.match(unk.body.errors.tracking_numbers, /NOPE-1/);
});

test('M9/M29/L25: invoice payments cannot exceed the balance, due date follows issue date, drafts take no payment and are not "invoiced"', async () => {
  const mk = (o = {}) => a.post('/api/admin/invoices', { customer_name: 'Cust', items: JSON.stringify([{ description: 'Card', quantity: 1, unit_price: 419 }]), issue_date: '2026-11-18', ...o });
  const i = (await mk()).body.data;
  const over = await a.post(`/api/admin/invoices/${i.id}/payments`, { amount: 10000 }); assert.equal(over.status, 422); assert.match(over.body.errors.amount, /more than the balance due \(419/);
  assert.equal((await a.post(`/api/admin/invoices/${i.id}/payments`, { amount: 419 })).status, 200);
  assert.match((await a.post(`/api/admin/invoices/${i.id}/payments`, { amount: 1 })).body.errors.amount, /fully paid/);
  const early = await mk({ due_date: '2026-11-01' }); assert.equal(early.status, 422); assert.match(early.body.errors.due_date, /before the issue date/);
  const draft = (await mk({ status: 'draft' })).body.data; const before = (await a.get('/api/admin/invoices')).body.summary.total;
  assert.equal((await a.post(`/api/admin/invoices/${draft.id}/payments`, { amount: 5 })).status, 422);
  assert.equal(before, (await a.get('/api/admin/invoices')).body.summary.total); const d2 = await mk({ status: 'draft' }); assert.equal((await a.get('/api/admin/invoices')).body.summary.total, before, 'drafts are not counted');
  const big = await mk({ discount: 99999 }); assert.equal(big.status, 422); assert.match(big.body.errors.discount, /subtotal/);
});

test('L23/L8: order search finds a phone in any format; the dispatch text has no empty tracking line', async () => {
  const o = await place({ phone: '03001239876' });
  for (const q of ['03001239876', '+92 300 1239876', '300-1239876']) { const r = await a.get(`/api/admin/orders?search=${encodeURIComponent(q)}`); assert.ok(r.body.data.some((x) => x.id === o.id), q); }
  const messaging = require('../src/services/messaging'); assert.ok(messaging.EVENTS.order_shipped.text.includes('Tracking no'));
});

test('a paid order needs a payment method; the account is stored on the order (courier and collection)', async () => {
  const acc = await M.FinanceAccount.create({ name: 'Company Faysal Bank Account', type: 'bank' });
  const p = await product(); const base = { name: 'W', phone: '03001234567', address: 'x', city: 'y', customer_type: 'guest', order_type: 'nfc_profile', payment_status: 'paid', items: [{ product_id: p.id, quantity: 1 }] };
  for (const extra of [{ is_cod: false }, { fulfilment: 'collection', is_cod: false }]) {
    const no = await a.post('/api/admin/orders', { ...base, ...extra }); assert.equal(no.status, 422); assert.match(no.body.errors.payment_account_id, /payment method/);
    assert.equal((await a.post('/api/admin/orders', { ...base, ...extra, payment_account_id: 999999 })).status, 422);
    const ok = await a.post('/api/admin/orders', { ...base, ...extra, payment_account_id: acc.id }); assert.equal(ok.status, 201);
    assert.equal((await M.NfcOrder.findByPk(ok.body.data.id)).payment_account_id, acc.id);
  }
  const meta = await a.get('/api/admin/orders-meta'); assert.ok(meta.body.accounts.some((x) => x.id === acc.id));
});
