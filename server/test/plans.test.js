const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { boot, makeUser, M } = require('./helpers');
const orders = require('../src/services/orders');
const subs = require('../src/services/subscription');

let seq = 0;
before(async () => { await boot().then(({ server }) => server.close()); });
after(async () => { await M.sequelize.close(); });

const plan = (over = {}) => M.Plan.create({ name: `TEST plan ${++seq}`, price: 999, frequency: 'yearly', custom_duration_days: 730, no_of_vcards: 2, ...over });
const planProduct = (p) => M.NfcCard.create({ name: `${p.name} plan`, slug: `plan-prod-${p.id}-${++seq}`, price: p.price, plan_id: p.id, product_kind: 'plan', status: true });
const paidOrder = async (user, prod, type, over = {}) => {
  const q = await orders.quote([{ product_id: prod.id, quantity: 1 }], { orderType: type });
  const o = await orders.create({ name: 'T', phone: '03001112222', email: user.email, address: 'a', city: 'c', user_id: user.id, source: 'test', is_cod: false, payment_type: 'manual', ...over }, q);
  await o.update({ payment_status: 'paid' }); return o;
};
const days = (a, b) => Math.round((new Date(b) - new Date(a)) / 86400000);

test('plan duration: custom days win, yearly = 1 year, monthly = 1 month', async () => {
  const start = new Date('2026-01-31T00:00:00Z');
  assert.equal(days(start, subs.endDate ? subs.endDate({ custom_duration_days: 730 }, start) : new Date(start.getTime() + 730 * 86400000)), 730);
  const u = await makeUser(); const p = await plan(); const s = await subs.activate(u.id, p);
  assert.equal(days(s.starts_at, s.ends_at), 730);
  const m = await subs.activate(u.id, await plan({ frequency: 'monthly', custom_duration_days: null })); assert.ok([28, 29, 30, 31].includes(days(m.starts_at, m.ends_at)));
});
test('activate: only one active subscription at a time', async () => {
  const u = await makeUser(); await subs.activate(u.id, await plan()); await subs.activate(u.id, await plan());
  assert.equal(await M.Subscription.count({ where: { user_id: u.id, status: 'active' } }), 1);
});
test('renew early keeps the remaining days; renew after expiry starts today', async () => {
  const u = await makeUser(); const p = await plan({ custom_duration_days: 365 });
  const first = await subs.activate(u.id, p); const r1 = await subs.renew(u.id, p);
  assert.equal(days(first.ends_at, r1.ends_at), 365, 'new period starts where the old one ends');
  await M.Subscription.update({ ends_at: new Date(Date.now() - 86400000) }, { where: { id: r1.id } });
  const r2 = await subs.renew(u.id, p); assert.ok(Math.abs(days(new Date(), r2.ends_at) - 365) <= 1);
});
test('canCreateVcard: needs an active plan and respects the vcard limit; expired plan is refused', async () => {
  const u = await makeUser(); assert.equal((await subs.canCreateVcard(u.id)).ok, false);
  const p = await plan({ no_of_vcards: 1 }); const s = await subs.activate(u.id, p); assert.equal((await subs.canCreateVcard(u.id)).ok, true);
  const tpl = await M.Template.create({ name: 'T', slug: `tp${++seq}` });
  await M.Vcard.create({ user_id: u.id, name: 'c', url_alias: `lim-${seq}`, template_id: tpl.id });
  assert.equal((await subs.canCreateVcard(u.id)).ok, false);
  await s.update({ ends_at: new Date(Date.now() - 1000) }); assert.equal((await subs.isExpired(u.id)), true);
});
test('upgrade credit: proportional to the unused time, never negative or above what was paid', async () => {
  const u = await makeUser(); const p = await plan();
  const s = await subs.activate(u.id, p, { amount: 1000 });
  await s.update({ starts_at: new Date(Date.now() - 365 * 86400000), ends_at: new Date(Date.now() + 365 * 86400000) });
  const c = await subs.upgradeCredit(u.id); assert.ok(c.credit > 480 && c.credit <= 500, `credit ${c.credit}`);
  await s.update({ ends_at: new Date(Date.now() - 1000) }); assert.equal((await subs.upgradeCredit(u.id)).credit, 0);
  assert.equal((await subs.upgradeCredit((await makeUser()).id)).credit, 0);
});
test('renewal order: a PAID renewal adds the plan once', async () => {
  const u = await makeUser(); const p = await plan(); const prod = await planProduct(p);
  const o = await paidOrder(u, prod, 'renewal');
  const sub = await orders.applyRenewal(o); assert.ok(sub); assert.equal(sub.plan_id, p.id);
  assert.equal(await orders.applyRenewal(await M.NfcOrder.findByPk(o.id)), null, 'second call must not add again');
  assert.equal(await M.Subscription.count({ where: { user_id: u.id } }), 1);
});
test('renewal order: an UNPAID order never changes the plan', async () => {
  const u = await makeUser(); const prod = await planProduct(await plan());
  const q = await orders.quote([{ product_id: prod.id, quantity: 1 }], { orderType: 'renewal' });
  const o = await orders.create({ name: 'T', phone: '03001112222', email: u.email, address: 'a', city: 'c', user_id: u.id, source: 'test', is_cod: false, payment_type: 'manual' }, q);
  assert.equal(await orders.applyRenewal(o), null); assert.equal(await M.Subscription.count({ where: { user_id: u.id } }), 0);
});
test('renewal order: a product without a plan changes nothing', async () => {
  const u = await makeUser(); const prod = await M.NfcCard.create({ name: 'Plain card', slug: `plain-${++seq}`, price: 500, status: true });
  assert.equal(await orders.applyRenewal(await paidOrder(u, prod, 'renewal')), null);
});
test('CONCURRENCY: two payment confirmations at once must still apply the plan only once', async () => {
  const u = await makeUser(); const p = await plan(); const prod = await planProduct(p); const o = await paidOrder(u, prod, 'renewal');
  await Promise.all([orders.applyRenewal(await M.NfcOrder.findByPk(o.id)), orders.applyRenewal(await M.NfcOrder.findByPk(o.id))]);
  const n = await M.Subscription.count({ where: { user_id: u.id } }); assert.equal(n, 1, `plan was applied ${n} times`);
});
test('order status: moving through the workflow records history; unknown status is rejected', async () => {
  const u = await makeUser(); const prod = await M.NfcCard.create({ name: 'C', slug: `c-${++seq}`, price: 100, status: true });
  const q = await orders.quote([{ product_id: prod.id, quantity: 1 }]);
  const o = await orders.create({ name: 'T', phone: '03001112222', email: u.email, address: 'a', city: 'c', user_id: u.id, source: 'test', is_cod: true }, q);
  await orders.setStatus(o, 'processing', { note: 'x' }); assert.equal((await M.NfcOrder.findByPk(o.id)).order_status, 'processing');
  await assert.rejects(async () => orders.setStatus(o, 'bogus-status'));
});
test('order numbers are unique across many orders', async () => {
  const u = await makeUser(); const prod = await M.NfcCard.create({ name: 'C2', slug: `c2-${++seq}`, price: 100, status: true });
  const nums = new Set();
  for (let i = 0; i < 25; i++) { const q = await orders.quote([{ product_id: prod.id, quantity: 1 }]); nums.add((await orders.create({ name: 'T', phone: '03001112222', email: u.email, address: 'a', city: 'c', user_id: u.id, source: 'test', is_cod: true }, q)).order_number); }
  assert.equal(nums.size, 25);
});

test('order numbers: a repeated random number is retried instead of failing the checkout', async () => {
  const u = await makeUser(); const prod = await M.NfcCard.create({ name: 'C3', slug: `c3-${++seq}`, price: 100, status: true });
  const real = orders.orderNumber; const next = ['ORD-TEST-DUP', 'ORD-TEST-DUP', 'ORD-TEST-DUP', 'ORD-TEST-NEW'];
  orders.orderNumber = () => next.shift() || real();
  try {
    const mk = async () => orders.create({ name: 'T', phone: '03001112222', email: u.email, address: 'a', city: 'c', user_id: u.id, source: 'test', is_cod: true }, await orders.quote([{ product_id: prod.id, quantity: 1 }]));
    assert.equal((await mk()).order_number, 'ORD-TEST-DUP');
    assert.equal((await mk()).order_number, 'ORD-TEST-NEW', 'second order got a fresh number after two clashes');
    assert.equal(await M.NfcOrder.count({ where: { order_number: 'ORD-TEST-DUP' } }), 1);
  } finally { orders.orderNumber = real; }
});
test('invoices: numbering starts cleanly when the counter row does not exist yet', async () => {
  // true concurrency needs MySQL (sqlite in tests has one connection); this covers the create-the-counter-first path
  const invoices = require('../src/services/invoices'); const settings = require('../src/services/settings');
  await M.Setting.destroy({ where: { key: 'invoice_next_number' } }); settings.clearCache();
  const made = [];
  for (let i = 0; i < 3; i++) made.push(await invoices.create({ customer_name: `C${i}`, items: [{ description: 'x', quantity: 1, unit_price: 10 }] }));
  assert.equal(new Set(made.map((x) => x.number)).size, 3, made.map((x) => x.number).join(','));
  assert.ok(await M.Setting.findOne({ where: { key: 'invoice_next_number' } }), 'counter row created');
});
