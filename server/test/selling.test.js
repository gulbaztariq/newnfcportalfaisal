/* Selling on a vCard: the owner's own payment settings, product orders, paid appointments. Gateways are faked (no network). */
const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { boot, client, makeUser, outbox, M } = require('./helpers');
const us = require('../src/services/usersettings');
const userpay = require('../src/services/userpay');

let ctx; let owner; let card; let product; let c; let other;
before(async () => {
  ctx = await boot();
  owner = await makeUser({}); other = await makeUser({});
  const plan = await M.Plan.create({ name: 'Sell plan', price: 1, frequency: 'yearly', no_of_vcards: 10, custom_duration_days: 365 });
  for (const u of [owner, other]) await require('../src/services/subscription').activate(u.id, plan);
  const tpl = await M.Template.findOne() || await M.Template.create({ name: 'T', slug: 'sell-t', status: true });
  card = await M.Vcard.create({ user_id: owner.id, name: 'Shop card', url_alias: `sell-${Date.now()}`, template_id: tpl.id, status: true, appointment_settings: { enabled: true, paid: true, price: 500, duration: 30, slots: { mon: [{ from: '09:00', to: '17:00' }], tue: [{ from: '09:00', to: '17:00' }], wed: [{ from: '09:00', to: '17:00' }], thu: [{ from: '09:00', to: '17:00' }], fri: [{ from: '09:00', to: '17:00' }], sat: [{ from: '09:00', to: '17:00' }], sun: [{ from: '09:00', to: '17:00' }] } } });
  product = await M.VcardProduct.create({ vcard_id: card.id, name: 'NFC keyring', price: 1500, currency_code: 'PKR' });
  c = client(ctx.base); assert.equal((await c.post('/api/auth/login', { email: owner.email, password: 'Passw0rd!x' })).status, 200);
});
after(async () => { ctx.server.close(); await M.sequelize.close(); });
beforeEach(() => { outbox.length = 0; });

const pub = (path, body) => client(ctx.base).post(`/api/public/vcards/${card.url_alias}${path}`, body);

test('settings: secrets are write-only and sealed; enabling a gateway needs its keys', async () => {
  const empty = await c.get('/api/user/settings'); assert.equal(empty.status, 200); assert.deepEqual(empty.body.data.methods, []);
  const bad = await c.put('/api/user/settings', { stripe_enable: true }); assert.equal(bad.status, 422); assert.match(bad.body.errors.stripe_secret, /Stripe secret key is required/);
  assert.equal((await c.put('/api/user/settings', { currency_code: 'rupees' })).status, 422);
  assert.equal((await c.put('/api/user/settings', { manual_enable: true })).status, 422, 'bank transfer needs instructions');
  const ok = await c.put('/api/user/settings', { stripe_enable: true, stripe_secret: 'sk_test_SECRETVALUE', currency_code: 'pkr', manual_enable: true, manual_guide: 'Send to Easypaisa 0300' });
  assert.equal(ok.status, 200, ok.text); assert.equal(ok.body.data.has_stripe_secret, true); assert.equal(ok.body.data.currency_code, 'PKR');
  assert.ok(!JSON.stringify(ok.body).includes('SECRETVALUE'));
  const row = await M.UserSetting.findOne({ where: { user_id: owner.id } }); assert.ok(!String(row.secrets).includes('SECRETVALUE'), 'sealed at rest'); assert.equal(us.open(row.secrets).stripe_secret, 'sk_test_SECRETVALUE');
  assert.deepEqual(ok.body.data.methods.map((m) => m.id), ['stripe', 'manual']);
  const keep = await c.put('/api/user/settings', { time_format: '12' }); assert.equal(keep.body.data.has_stripe_secret, true, 'an empty secret keeps the saved one');
  assert.equal((await client(ctx.base).get('/api/user/settings')).status, 401);
});

test('the card shows Buy only when the owner can be paid', async () => {
  const html = await (await fetch(`${ctx.base}/${card.url_alias}`)).text();
  assert.match(html, /data-buy="\d+"/); assert.match(html, /id="buym"/); assert.match(html, /Bank transfer \/ cash/); assert.ok(!html.includes('SECRETVALUE'));
  const tpl = await M.Template.findOne(); const plain = await M.Vcard.create({ user_id: other.id, name: 'No pay', url_alias: `nopay-${Date.now()}`, template_id: tpl.id, status: true });
  await M.VcardProduct.create({ vcard_id: plain.id, name: 'Thing', price: 10 });
  assert.ok(!(await (await fetch(`${ctx.base}/${plain.url_alias}`)).text()).includes('data-buy='));
});

test('bank-transfer order: validated, saved, both sides e-mailed, owner manages it', async () => {
  const bad = await pub('/orders', { product_id: product.id, customer_name: '', method: 'manual' }); assert.equal(bad.status, 422); assert.match(bad.body.errors.customer_name, /Name is required/);
  assert.equal((await pub('/orders', { product_id: product.id, customer_name: 'Ali', method: 'manual' })).status, 422, 'needs a contact');
  assert.equal((await pub('/orders', { product_id: product.id, customer_name: 'Ali', customer_phone: '03001234567', method: 'paypal' })).status, 422, 'method not offered');
  assert.equal((await pub('/orders', { product_id: 999999, customer_name: 'Ali', customer_phone: '03001234567', method: 'manual' })).status, 404);
  const r = await pub('/orders', { product_id: product.id, customer_name: 'Ali', customer_email: 'ali@example.test', quantity: 2, method: 'manual', customer_address: 'Lahore' });
  assert.equal(r.status, 201, r.text); assert.match(r.body.guide, /Easypaisa/);
  const o = await M.VcardOrder.findOne({ where: { order_number: r.body.order } }); assert.equal(Number(o.amount), 3000); assert.equal(o.currency_code, 'PKR'); assert.equal(o.payment_status, 'pending');
  await new Promise((x) => setTimeout(x, 100));
  assert.ok(outbox.some((m) => m.key === 'vcard_order_owner' && m.to === owner.email)); assert.ok(outbox.some((m) => m.key === 'vcard_order_customer' && m.to === 'ali@example.test'));
  const list = await c.get('/api/user/product-orders'); assert.equal(list.body.data.length, 1); assert.ok(!('token' in list.body.data[0]));
  assert.equal((await c.del(`/api/user/product-orders/${o.id}`)).status, 422, 'open orders cannot be deleted');
  assert.equal((await c.patch(`/api/user/product-orders/${o.id}`, { payment_status: 'paid', status: 'approved' })).status, 200);
  assert.equal((await M.VcardOrder.findByPk(o.id)).payment_status, 'paid');
  const pdf = await fetch(`${ctx.base}/api/user/product-orders/${o.id}/invoice`, { headers: { Cookie: Object.entries(c.cookies()).map(([k, v]) => `${k}=${v}`).join('; ') } }); assert.equal(pdf.status, 200); assert.match(pdf.headers.get('content-type'), /pdf/);
  const oc = client(ctx.base); await oc.post('/api/auth/login', { email: other.email, password: 'Passw0rd!x' });
  assert.equal((await oc.patch(`/api/user/product-orders/${o.id}`, { status: 'cancelled' })).status, 404, "another user's order");
  assert.equal((await oc.get('/api/user/product-orders')).body.data.length, 0);
  await c.patch(`/api/user/product-orders/${o.id}`, { status: 'delivered' }); assert.equal((await c.del(`/api/user/product-orders/${o.id}`)).status, 200);
});

test('online order: paid only after the gateway confirms, and only once', async () => {
  const real = { ...userpay._G.stripe }; let paid = false; let checks = 0;
  userpay._G.stripe.start = async (o) => ({ ref: `cs_${o.id}`, url: 'https://pay.example/checkout' });
  userpay._G.stripe.paid = async () => { checks += 1; return paid; };
  try {
    const r = await pub('/orders', { product_id: product.id, customer_name: 'Sara', customer_phone: '03009998887', method: 'stripe' });
    assert.equal(r.status, 201, r.text); assert.equal(r.body.pay_url, 'https://pay.example/checkout');
    const o = await M.VcardOrder.findOne({ where: { order_number: r.body.order } });
    const back = (q = '') => fetch(`${ctx.base}/pay/card/${o.token}${q}`, { redirect: 'manual' });
    let res = await back('?cancelled=1'); assert.match(res.headers.get('location'), /order=cancelled/); assert.equal(checks, 0);
    res = await back(); assert.match(res.headers.get('location'), /order=pending/); assert.equal((await M.VcardOrder.findByPk(o.id)).payment_status, 'pending', 'the redirect alone proves nothing');
    paid = true; res = await back(); assert.match(res.headers.get('location'), new RegExp(`/${card.url_alias}\\?order=paid`));
    assert.equal((await M.VcardOrder.findByPk(o.id)).payment_status, 'paid');
    const n = checks; await back(); assert.equal(checks, n, 'a paid order is not re-verified');
    assert.equal((await c.patch(`/api/user/product-orders/${o.id}`, { payment_status: 'pending' })).status, 422, 'online payments cannot be edited by hand');
    assert.equal((await fetch(`${ctx.base}/pay/card/nope`, { redirect: 'manual' })).status, 303);
  } finally { Object.assign(userpay._G.stripe, real); }
});

test('paid appointment: a payment method is required and paying marks it paid', async () => {
  const real = { ...userpay._G.stripe };
  userpay._G.stripe.start = async (o) => ({ ref: `cs_a${o.id}`, url: 'https://pay.example/appt' }); userpay._G.stripe.paid = async () => true;
  try {
    const d = new Date(Date.now() + 3 * 86400000); const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const slots = await (await fetch(`${ctx.base}/api/public/vcards/${card.url_alias}/slots?date=${date}`)).json(); const s = slots.data[0];
    const base = { name: 'Omar', phone: '03001112223', date, from_time: s.from, to_time: s.to };
    const none = await pub('/appointments', base); assert.equal(none.status, 422); assert.match(none.body.errors.method, /choose how you want to pay/);
    const r = await pub('/appointments', { ...base, method: 'stripe' }); assert.equal(r.status, 201, r.text); assert.equal(r.body.pay_url, 'https://pay.example/appt');
    const o = await M.VcardOrder.findOne({ where: { kind: 'appointment' } }); assert.equal(Number(o.amount), 500);
    assert.equal((await M.Appointment.findByPk(o.appointment_id)).paid, false);
    await fetch(`${ctx.base}/pay/card/${o.token}`, { redirect: 'manual' });
    assert.equal((await M.Appointment.findByPk(o.appointment_id)).paid, true);
  } finally { Object.assign(userpay._G.stripe, real); }
});
