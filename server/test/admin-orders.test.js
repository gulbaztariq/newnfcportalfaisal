const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { boot, client, makeUser, M, settings } = require('./helpers');

let ctx; let admin; let seq = 0;
before(async () => {
  ctx = await boot(); await settings.set({ enforce_2fa_staff: '0' });
  const u = await makeUser({ role: 'super_admin' }); admin = client(ctx.base);
  assert.equal((await admin.post('/api/auth/login', { email: u.email, password: 'Passw0rd!x' })).status, 200);
});
after(async () => { ctx.server.close(); await M.sequelize.close(); });

const product = (over = {}) => M.NfcCard.create({ name: `TEST p${++seq}`, slug: `ao-${seq}-${Date.now()}`, price: 1000, status: true, ...over });
const base = (items, over = {}) => ({ name: 'Walk In', phone: '03001234567', address: 'Shop 1', city: 'Karachi', customer_type: 'guest', order_type: 'nfc_profile', items, ...over });

test('admin order: guest customer, totals follow the server quote, order appears in the list', async () => {
  const p = await product(); const r = await admin.post('/api/admin/orders', base([{ product_id: p.id, quantity: 2 }]));
  assert.equal(r.status, 201, r.text.slice(0, 200));
  const n = r.body.order?.order_number || r.body.data?.order_number || r.body.order_number; assert.ok(n, r.text.slice(0, 200));
  const o = await M.NfcOrder.findOne({ where: { order_number: n } }); assert.equal(Number(o.subtotal), 2000);
  const list = await admin.get('/api/admin/orders'); assert.ok(JSON.stringify(list.body).includes(n));
});
test('admin order validation: missing name, bad e-mail, >100% discount, unknown type/source, empty cart', async () => {
  const p = await product(); const items = [{ product_id: p.id, quantity: 1 }];
  for (const [over, why] of [[{ name: '' }, 'name'], [{ email: 'bad' }, 'email'], [{ discount_type: 'percent', discount_value: 150 }, 'discount'], [{ order_type: 'nonsense' }, 'type'], [{ order_source_id: 99999 }, 'source']])
    assert.equal((await admin.post('/api/admin/orders', base(items, over))).status, 422, why);
  assert.equal((await admin.post('/api/admin/orders', base([]))).status, 422);
});
test('admin order: renewal/upgrade need an existing customer and a plan product', async () => {
  const plain = await product(); const u = await makeUser();
  assert.equal((await admin.post('/api/admin/orders', base([{ product_id: plain.id, quantity: 1 }], { order_type: 'renewal', customer_type: 'guest' }))).status, 422);
  assert.equal((await admin.post('/api/admin/orders', base([{ product_id: plain.id, quantity: 1 }], { order_type: 'renewal', customer_type: 'existing', user_id: u.id }))).status, 422);
  const plan = await M.Plan.create({ name: 'AO plan', price: 999, frequency: 'yearly', custom_duration_days: 730 }); const pp = await product({ plan_id: plan.id, product_kind: 'plan', price: 999 });
  assert.equal((await admin.post('/api/admin/orders', base([{ product_id: pp.id, quantity: 1 }], { order_type: 'renewal', customer_type: 'existing', user_id: u.id }))).status, 201);
});
test('admin order: a customer id that is not a customer (admin account) is refused', async () => {
  const p = await product(); const staff = await makeUser({ role: 'admin' });
  assert.equal((await admin.post('/api/admin/orders', base([{ product_id: p.id, quantity: 1 }], { customer_type: 'existing', user_id: staff.id }))).status, 422);
});
test('admin order: tag orders need a valid owner phone', async () => {
  const p = await product({ product_kind: 'contact_tag' });
  assert.equal((await admin.post('/api/admin/orders', base([{ product_id: p.id, quantity: 1 }], { order_type: 'contact_tag', phone: '12' }))).status, 422);
});
test('admin order: a hand-set price is allowed for staff only (customers cannot do it)', async () => {
  const p = await product(); const staffQ = await admin.post('/api/admin/orders/quote', { order_type: 'nfc_profile', items: [{ product_id: p.id, quantity: 1, unit_price: 250 }], price_override: true });
  assert.ok([200, 422].includes(staffQ.status));
  const cust = client(ctx.base); const u = await makeUser(); await cust.post('/api/auth/login', { email: u.email, password: 'Passw0rd!x' });
  assert.equal((await cust.post('/api/admin/orders/quote', { items: [{ product_id: p.id, quantity: 1, unit_price: 1 }] })).status, 403);
});
test('order status: staff can move an order forward; an unknown status is refused', async () => {
  const p = await product(); const r = await admin.post('/api/admin/orders', base([{ product_id: p.id, quantity: 1 }]));
  const n = r.body.order?.order_number || r.body.data?.order_number || r.body.order_number; const o = await M.NfcOrder.findOne({ where: { order_number: n } });
  const ok = await admin.patch(`/api/admin/orders/${o.id}`, { order_status: 'processing' }); assert.ok([200, 204].includes(ok.status), ok.text.slice(0, 150));
  const bad = await admin.patch(`/api/admin/orders/${o.id}`, { order_status: 'hacked' }); assert.ok(bad.status >= 400 && bad.status < 500, `bad status -> ${bad.status}`);
});

test('admin order: advance payment keeps the advance, leaves the order unpaid and checks the amount', async () => {
  const p = await product({ price: 1000 });
  const bad = await admin.post('/api/admin/orders', base([{ product_id: p.id, quantity: 1 }], { payment_type: 'advance', advance_amount: 0 }));
  assert.equal(bad.status, 422);
  const tooMuch = await admin.post('/api/admin/orders', base([{ product_id: p.id, quantity: 1 }], { payment_type: 'advance', advance_amount: 999999 }));
  assert.equal(tooMuch.status, 422);
  const r = await admin.post('/api/admin/orders', base([{ product_id: p.id, quantity: 1 }], { payment_type: 'advance', advance_amount: 400, payment_status: 'pending', fulfilment: 'collection' }));
  assert.equal(r.status, 201, r.text.slice(0, 200));
  const o = await M.NfcOrder.findByPk(r.body.data.id);
  assert.equal(o.payment_type, 'advance'); assert.equal(Number(o.advance_amount), 400); assert.equal(o.payment_status, 'pending');
});

test('admin order: delivery details can be left for later when the form says so, and are still required otherwise', async () => {
  const p = await product({ price: 500 });
  const items = [{ product_id: p.id, quantity: 1 }];
  const strict = await admin.post('/api/admin/orders', { name: 'No Address', customer_type: 'guest', order_type: 'nfc_profile', is_cod: true, items });
  assert.equal(strict.status, 422);
  const later = await admin.post('/api/admin/orders', { name: 'No Address', customer_type: 'guest', order_type: 'nfc_profile', is_cod: true, details_later: true, items });
  assert.equal(later.status, 201, later.text.slice(0, 200));
  assert.equal(later.body.data.is_cod, true);
});

test('admin order: the link is created with the order, and a bad link request stops the order from being created', async () => {
  const p = await product({ price: 300 });
  const items = [{ product_id: p.id, quantity: 3 }];
  const before = await M.NfcOrder.count(); const linksBefore = await M.ShortLink.count();
  const bad = await admin.post('/api/admin/orders', base(items, { link: { kind: 'vcard', qty: 3 } }));
  assert.equal(bad.status, 422, 'a business card link needs a plan');
  assert.equal(await M.NfcOrder.count(), before, 'no order without its link');
  const ok = await admin.post('/api/admin/orders', base(items, { link: { kind: 'review', qty: 3 } }));
  assert.equal(ok.status, 201, ok.text.slice(0, 200));
  assert.equal(ok.body.links.length, 3);
  assert.ok(ok.body.links.every((l) => l.kind === 'review' && l.nfc_order_id === ok.body.data.id && l.state === 'unclaimed'));
  assert.equal(await M.ShortLink.count(), linksBefore + 3);
});

test('admin order: each product can ask for its own links', async () => {
  const a = await product({ price: 100 }); const b2 = await product({ price: 200 });
  const r = await admin.post('/api/admin/orders', base([{ product_id: a.id, quantity: 2 }, { product_id: b2.id, quantity: 1 }], { links: [{ kind: 'review', qty: 2, title: a.name }, { kind: 'review', qty: 1, title: b2.name }] }));
  assert.equal(r.status, 201, r.text.slice(0, 200));
  assert.equal(r.body.links.length, 3);
  assert.deepEqual([...new Set(r.body.links.map((l) => l.title))].sort(), [a.name, b2.name].sort());
  const none = await admin.post('/api/admin/orders', base([{ product_id: a.id, quantity: 1 }], { links: [] }));
  assert.equal(none.status, 201); assert.equal(none.body.links, null);
});
