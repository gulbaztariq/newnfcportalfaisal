/* QA report 18 Nov 2026: users, plans, vCards (H2, M3, M11, M19, M22, M24, M32, L1, L28). */
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { boot, client, makeUser, settings, M, outbox } = require('./helpers');
const subs = require('../src/services/subscription');

let ctx; let a; let tpl;
before(async () => {
  ctx = await boot(); await settings.set({ enforce_2fa_staff: '0' });
  const sa = await makeUser({ role: 'super_admin' }); a = client(ctx.base); assert.equal((await a.post('/api/auth/login', { email: sa.email, password: 'Passw0rd!x' })).status, 200);
  tpl = await M.Template.findOne() || await M.Template.create({ name: 'T', slug: 'qa-t', status: true });
});
after(async () => { ctx.server.close(); await M.sequelize.close(); });
let n = 0; const mail = () => `qa_${Date.now()}_${++n}@example.test`;

test('H2: a new user (and an organisation owner) always gets an active plan, even if no plan is marked default', async () => {
  await M.Plan.update({ is_default: false }, { where: {} });
  const cheap = await M.Plan.create({ name: 'Cheap', price: 5, frequency: 'monthly', status: true }); await M.Plan.create({ name: 'Dear', price: 50, frequency: 'monthly', status: true });
  const r = await a.post('/api/admin/users', { first_name: 'Ali', email: mail(), password: 'Secret12', password_confirmation: 'Secret12' }); assert.equal(r.status, 201, r.text);
  const sub = await subs.current(r.body.data.id); assert.ok(sub, 'has an active subscription'); assert.equal(sub.plan_id, cheap.id, 'fallback: the cheapest active plan');
  assert.ok(new Date(sub.ends_at) > new Date());
  const def = await M.Plan.create({ name: 'Free', price: 0, frequency: 'monthly', status: true, is_default: true });
  const r2 = await a.post('/api/admin/users', { first_name: 'Bo', email: mail(), password: 'Secret12', password_confirmation: 'Secret12', is_organisation: '1', org_name: 'Acme' }); assert.equal(r2.status, 201, r2.text);
  assert.equal((await subs.current(r2.body.data.id)).plan_id, def.id, 'the marked default plan wins');
  const html = await fetch(`${ctx.base}/${(await M.Vcard.findOne({ where: { user_id: r2.body.data.id } })).url_alias}`); assert.equal(html.status, 200, 'their public card is available');
});

test('M3/L1: an invited user is not "verified" until they confirm; phones are stored with a country code', async () => {
  const inv = await a.post('/api/admin/users', { first_name: 'Inv', email: mail() }); assert.equal(inv.status, 201, inv.text);
  assert.equal((await M.User.findByPk(inv.body.data.id)).email_verified_at, null);
  const direct = await a.post('/api/admin/users', { first_name: 'Dir', email: mail(), password: 'Secret12', password_confirmation: 'Secret12', contact: '0300 1234567' });
  const u = await M.User.findByPk(direct.body.data.id); assert.ok(u.email_verified_at); assert.equal(u.region_code, '92'); assert.equal(u.contact, '3001234567');
  const intl = await a.post('/api/admin/users', { first_name: 'Int', email: mail(), password: 'Secret12', password_confirmation: 'Secret12', contact: '+92 321 5551234' });
  const u2 = await M.User.findByPk(intl.body.data.id); assert.equal(u2.region_code, '92'); assert.equal(u2.contact, '3215551234');
});

test('M22: organisation user count must be 1 or more', async () => {
  for (const seats of ['-5', '0']) { const r = await a.post('/api/admin/users', { first_name: 'O', email: mail(), password: 'Secret12', password_confirmation: 'Secret12', is_organisation: '1', org_name: 'Org', seats }); assert.equal(r.status, 422, seats); assert.match(r.body.errors.seats, /1 or more/); }
  assert.equal((await a.post('/api/admin/users', { first_name: 'O', email: mail(), password: 'Secret12', password_confirmation: 'Secret12', is_organisation: '1', org_name: 'Org', seats: '5' })).status, 201);
});

test('M32: deleting a user leaves no short link pointing at their deleted vCard', async () => {
  const r = await a.post('/api/admin/users', { first_name: 'Del', email: mail(), password: 'Secret12', password_confirmation: 'Secret12' }); const uid = r.body.data.id;
  const card = await M.Vcard.findOne({ where: { user_id: uid } });
  const link = await M.ShortLink.create({ code: `qa${Date.now()}`, user_id: uid, vcard_id: card.id, target_type: 'vcard', status: true });
  assert.equal((await a.del(`/api/admin/users/${uid}`)).status, 200);
  const after = await M.ShortLink.findByPk(link.id); assert.equal(after.target_type, 'unassigned'); assert.equal(after.vcard_id, null);
  const link2 = await M.ShortLink.create({ code: `qb${Date.now()}`, vcard_id: (await M.Vcard.create({ user_id: (await makeUser()).id, name: 'x', url_alias: `x${Date.now()}`, template_id: tpl.id })).id, target_type: 'vcard' });
  await M.Vcard.destroy({ where: { id: link2.vcard_id } }); assert.equal((await M.ShortLink.findByPk(link2.id)).target_type, 'unassigned', 'also when a vCard is deleted on its own');
});

test('M11/M19/M24: one definition of "available": admin list and dashboard agree with the public page', async () => {
  const live = await makeUser({}); const off = await makeUser({ is_active: false }); const nop = await makeUser({});
  const plan = await M.Plan.findOne(); await subs.activate(live.id, plan); await subs.activate(off.id, plan);
  const mk = (u, alias) => M.Vcard.create({ user_id: u.id, name: alias, url_alias: `${alias}${Date.now()}`, template_id: tpl.id, status: true });
  const c1 = await mk(live, 'live'); const c2 = await mk(off, 'off'); const c3 = await mk(nop, 'nop');
  const list = await a.get('/api/admin/vcards?search=' + 'live'); assert.equal(list.body.data.find((x) => x.id === c1.id).availability, 'live');
  assert.equal((await a.get('/api/admin/vcards?search=off')).body.data.find((x) => x.id === c2.id).availability, 'owner_inactive');
  assert.equal((await a.get('/api/admin/vcards?search=nop')).body.data.find((x) => x.id === c3.id).availability, 'plan_expired');
  const dash = (await a.get('/api/admin/dashboard')).body.stats; const all = await M.Vcard.count(); assert.ok(dash.activeVcards < all, 'not every card counts as active'); assert.equal(dash.activeVcards + dash.inactiveVcards, all);
  assert.equal((await fetch(`${ctx.base}/${c3.url_alias}`)).status, 503, 'the public page says unavailable for plan_expired');
});

test('L28: the dashboard "new today" does not count cancelled orders', async () => {
  const u = await makeUser({}); const base = { user_id: u.id, name: 'C', phone: '03001234567', quantity: 1, amount: 100, order_status: 'cancelled', order_number: `ORD-C${Date.now()}` };
  await M.NfcOrder.create(base).catch(() => {});
  const before = (await a.get('/api/admin/dashboard')).body.business.today_orders;
  await M.NfcOrder.create({ ...base, order_number: `ORD-D${Date.now()}` }).catch(() => {});
  assert.equal((await a.get('/api/admin/dashboard')).body.business.today_orders, before);
});
