/* Card tools: fixed card link, generated links, live preview of unsaved text, copy details between a user's cards,
   payment links never dropped silently, and a super admin creating a card for a user. */
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { boot, client, makeUser, outbox, settings, M, setMail } = require('./helpers');
const subs = require('../src/services/subscription');

let ctx; let owner; let oc; let other; let tpl; let planFull; let planBasic;
before(async () => {
  ctx = await boot(); setMail({ configured: true, fails: false });
  tpl = await M.Template.create({ name: 'Tool tpl', slug: 'tool-tpl', status: true, defaults: {} });
  planFull = await M.Plan.create({ name: 'Full', price: 1, frequency: 'yearly', no_of_vcards: 10, custom_duration_days: 365, features: { social_links: true, custom_links: true, payment_links: true } });
  planBasic = await M.Plan.create({ name: 'Basic', price: 1, frequency: 'yearly', no_of_vcards: 10, custom_duration_days: 365, features: { social_links: true } });
  await planFull.setTemplates([tpl]); await planBasic.setTemplates([tpl]);
  owner = await makeUser({}); other = await makeUser({});
  await subs.activate(owner.id, planFull); await subs.activate(other.id, planFull);
  oc = client(ctx.base); await oc.post('/api/auth/login', { email: owner.email, password: 'Passw0rd!x' });
});
after(async () => { ctx.server.close(); await M.sequelize.close(); });
const mk = (user, over = {}) => M.Vcard.create({ user_id: user.id, template_id: tpl.id, name: 'Card', url_alias: `ct-${Math.random().toString(36).slice(2, 9)}`, status: true, ...over });

test('a new card gets a generated link; a typed link is ignored and two cards with one name stay unique', async () => {
  const a = await oc.post('/api/user/vcards', { name: 'Sales Card', url_alias: 'my-own-choice', template_id: tpl.id });
  assert.equal(a.status, 201, a.text);
  assert.notEqual(a.body.data.url_alias, 'my-own-choice'); assert.match(a.body.data.url_alias, /^sales-card/);
  const b = await oc.post('/api/user/vcards', { name: 'Sales Card', template_id: tpl.id });
  assert.equal(b.status, 201, b.text); assert.notEqual(b.body.data.url_alias, a.body.data.url_alias);
});

test('the card link cannot be changed by the owner; saving with the same link still works', async () => {
  const v = await mk(owner);
  const bad = await oc.put(`/api/user/vcards/${v.id}`, { name: 'Renamed', url_alias: 'something-else' });
  assert.equal(bad.status, 422); assert.ok(bad.body.errors?.url_alias);
  assert.equal((await M.Vcard.findByPk(v.id)).url_alias, v.url_alias, 'link untouched');
  const ok = await oc.put(`/api/user/vcards/${v.id}`, { name: 'Renamed', url_alias: v.url_alias.toUpperCase() });
  assert.equal(ok.status, 200, ok.text); assert.equal((await M.Vcard.findByPk(v.id)).name, 'Renamed');
});

test('live preview shows unsaved text and accounts without saving them, and is private to the owner', async () => {
  const v = await mk(owner, { first_name: 'Saved', last_name: 'Name' });
  const draft = { first_name: 'Typing', last_name: 'Live', company: 'Draft Co', bank_accounts: [{ kind: 'bank', name: 'Meezan Bank', account: '0123456789', title: 'Draft Co' }, { name: 'No number' }], social_links: { website: 'https://draft.test' } };
  assert.equal((await oc.post(`/api/user/vcards/${v.id}/preview-draft`, draft)).status, 200);
  const pv = await oc.get(`/api/user/vcards/${v.id}/preview`);
  assert.equal(pv.status, 200);
  assert.ok(pv.text.includes('Typing Live'), 'typed name shown'); assert.ok(pv.text.includes('Draft Co')); assert.ok(pv.text.includes('Meezan Bank') && pv.text.includes('s-payments'), 'bank account shown in the Pay Me section');
  assert.ok(!pv.text.includes('No number'), 'incomplete account not shown');
  const row = await M.Vcard.findByPk(v.id); assert.equal(row.first_name, 'Saved'); assert.deepEqual(row.bank_accounts || [], [], 'nothing was saved');
  const sc = client(ctx.base); await sc.post('/api/auth/login', { email: other.email, password: 'Passw0rd!x' });
  assert.equal((await sc.post(`/api/user/vcards/${v.id}/preview-draft`, draft)).status, 404, "another user's card");
  assert.equal((await sc.get(`/api/user/vcards/${v.id}/preview`)).status, 404);
  await oc.post(`/api/user/vcards/${v.id}/preview-draft`, {}); // an empty draft goes back to the saved text
  assert.ok((await oc.get(`/api/user/vcards/${v.id}/preview`)).text.includes('Saved Name'));
});

test('draft text is escaped in the preview (no script injection)', async () => {
  const v = await mk(owner);
  await oc.post(`/api/user/vcards/${v.id}/preview-draft`, { first_name: '<script>alert(1)</script>', company: '"><img src=x onerror=alert(1)>', social_links: { website: 'javascript:alert(1)' } });
  const pv = (await oc.get(`/api/user/vcards/${v.id}/preview`)).text;
  assert.ok(!pv.includes('<script>alert(1)</script>')); assert.ok(!pv.includes('"><img src=x'));
});

test('payment links are not dropped silently: the owner is told when the plan lacks them, bank accounts always save', async () => {
  const bu = await makeUser({}); await subs.activate(bu.id, planBasic);
  const bc = client(ctx.base); await bc.post('/api/auth/login', { email: bu.email, password: 'Passw0rd!x' });
  const v = await mk(bu);
  const r = await bc.put(`/api/user/vcards/${v.id}`, { payment_links: [{ label: 'PayPal', url: 'https://paypal.me/x', type: 'paypal' }] });
  assert.equal(r.status, 422); assert.match(r.body.message, /not included in your plan/i);
  const ok = await bc.put(`/api/user/vcards/${v.id}`, { payment_links: [], bank_accounts: [{ kind: 'wallet', name: 'JazzCash', account: '03001234567' }] });
  assert.equal(ok.status, 200, ok.text); assert.equal((await M.Vcard.findByPk(v.id)).bank_accounts[0].name, 'JazzCash');
  const page = await client(ctx.base).get(`/${v.url_alias}`); assert.ok(page.text.includes('JazzCash'), 'shows on the public card');
});

test('copy details from one card to the owner’s other cards; never another user’s card, never the link', async () => {
  const src = await mk(owner, { company: 'Acme', phone: '3001234567', region_code: '92', bank_accounts: [{ kind: 'bank', name: 'HBL', account: '111' }], social_links: { website: 'https://acme.test' }, theme: { primary: '#112233', bg_image: '/uploads/x.png' } });
  const t1 = await mk(owner, { company: 'Old' }); const t2 = await mk(owner); const foreign = await mk(other, { company: 'Foreign' });
  const res = await oc.post(`/api/user/vcards/${src.id}/copy-to`, { target_ids: [t1.id, t2.id, foreign.id, src.id], groups: ['business', 'contact', 'payments', 'social', 'design'] });
  assert.equal(res.status, 200, res.text); assert.equal(res.body.cards, 2);
  for (const id of [t1.id, t2.id]) {
    const t = await M.Vcard.findByPk(id);
    assert.equal(t.company, 'Acme'); assert.equal(t.phone, '3001234567'); assert.equal(t.bank_accounts[0].name, 'HBL'); assert.equal(t.social_links.website, 'https://acme.test');
    assert.equal(t.theme.primary, '#112233'); assert.equal(t.theme.bg_image, undefined, 'an uploaded background stays with its card');
  }
  assert.notEqual((await M.Vcard.findByPk(t1.id)).url_alias, src.url_alias, 'links stay different');
  assert.equal((await M.Vcard.findByPk(foreign.id)).company, 'Foreign', "another user's card untouched");
  assert.equal((await oc.post(`/api/user/vcards/${src.id}/copy-to`, { target_ids: [foreign.id], groups: ['contact'] })).status, 422, 'only foreign cards chosen');
  assert.equal((await oc.post(`/api/user/vcards/${src.id}/copy-to`, { target_ids: [t1.id], groups: [] })).status, 422, 'nothing chosen');
  assert.equal((await oc.post(`/api/user/vcards/${src.id}/copy-to`, { target_ids: [t1.id], groups: ['url_alias', 'bogus'] })).status, 422, 'unknown groups ignored');
  // a card of another user cannot be used as the source
  const sc = client(ctx.base); await sc.post('/api/auth/login', { email: other.email, password: 'Passw0rd!x' });
  assert.equal((await sc.post(`/api/user/vcards/${src.id}/copy-to`, { target_ids: [foreign.id], groups: ['contact'] })).status, 404);
});

test('copy skips custom links when the plan lacks them', async () => {
  const bu = await makeUser({}); await subs.activate(bu.id, planBasic);
  const bc = client(ctx.base); await bc.post('/api/auth/login', { email: bu.email, password: 'Passw0rd!x' });
  const a = await mk(bu, { custom_links: [{ label: 'X', url: 'https://x.test' }], company: 'Basic Co' }); const b = await mk(bu);
  assert.equal((await bc.post(`/api/user/vcards/${a.id}/copy-to`, { target_ids: [b.id], groups: ['links', 'business'] })).status, 200);
  const t = await M.Vcard.findByPk(b.id); assert.equal(t.company, 'Basic Co'); assert.deepEqual(t.custom_links || [], []);
  assert.equal((await bc.post(`/api/user/vcards/${a.id}/copy-to`, { target_ids: [b.id], groups: ['links'] })).status, 422, 'only links chosen and not allowed: nothing to copy');
});

const codeFromMail = () => outbox.filter((m) => m.key === 'login_code').at(-1)?.values.code;
async function superAdmin() {
  const u = await makeUser({ role: 'super_admin' });
  await settings.set({ login_otp_enable: '1', enforce_2fa_staff: '1', require_totp_staff: '0', max_login_attempts: '50' });
  const c = client(ctx.base); const a = await c.post('/api/auth/login-code', { email: u.email });
  assert.equal((await c.post('/api/auth/two-factor', { challenge: a.body.challenge, code: codeFromMail() })).status, 200);
  await settings.set({ require_totp_staff: '1' }); return c;
}
test('a super admin creates a card and assigns it to a user: generated link, several cards under one login', async () => {
  const ac = await superAdmin();
  const u = await makeUser({ first_name: 'Hina', last_name: 'Shah' }); await subs.activate(u.id, planBasic);
  const before = await M.Vcard.count({ where: { user_id: u.id } });
  const r1 = await ac.post('/api/admin/vcards', { user_id: u.id, name: 'Reception desk' });
  assert.equal(r1.status, 201, r1.text); const r2 = await ac.post('/api/admin/vcards', { user_id: u.id });
  assert.equal(r2.status, 201, r2.text);
  const mine = await M.Vcard.findAll({ where: { user_id: u.id } });
  assert.equal(mine.length, before + 2); assert.equal(new Set(mine.map((c) => c.url_alias)).size, mine.length, 'unique links');
  assert.equal(r1.body.data.email, u.email); assert.match(r1.body.data.url_alias, /^reception-desk/); assert.match(r2.body.data.url_alias, /^hina-shah/);
  assert.equal((await ac.post('/api/admin/vcards', { user_id: 999999 })).status, 422);
  assert.equal((await ac.post('/api/admin/vcards', {})).status, 422);
  const admin2 = await makeUser({ role: 'admin' });
  assert.equal((await ac.post('/api/admin/vcards', { user_id: admin2.id })).status, 422, 'only regular users own cards');
  // a normal user cannot reach the admin route
  const nc = client(ctx.base); await nc.post('/api/auth/login', { email: u.email, password: 'Passw0rd!x' });
  assert.ok([401, 403].includes((await nc.post('/api/admin/vcards', { user_id: u.id })).status));
});

test('a user created by an admin always gets a starter card with a generated link', async () => {
  const ac = await superAdmin();
  await settings.set({ default_vcard_enable: '0' });
  const email = `adm_${Math.random().toString(36).slice(2, 8)}@example.test`;
  const r = await ac.post('/api/admin/users', { first_name: 'Zara', last_name: 'Ali', email, password: 'Passw0rd!x1', password_confirmation: 'Passw0rd!x1', role: 'user' });
  assert.ok([200, 201].includes(r.status), r.text);
  const u = await M.User.findOne({ where: { email } }); const cards = await M.Vcard.findAll({ where: { user_id: u.id } });
  assert.equal(cards.length, 1); assert.match(cards[0].url_alias, /^zara-ali/);
  await settings.set({ default_vcard_enable: '1' });
});
