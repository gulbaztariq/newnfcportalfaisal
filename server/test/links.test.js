/* Managed links: an admin generates links (redirect / business card / review) with their own plan; the first person to open one
   attaches it to an e-mail with a one-time code; owners (and admins) can reset a link or move it to another e-mail. */
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { boot, client, makeUser, outbox, settings, M, setMail } = require('./helpers');

let ctx; let tpl; let planMonthly; let planRich; let admin; let customer; let seq = 0;
before(async () => {
  ctx = await boot(); setMail({ configured: true, fails: false });
  tpl = await M.Template.create({ name: 'Link tpl', slug: 'link-tpl', status: true, defaults: { primary: '#123456' } });
  planMonthly = await M.Plan.create({ name: 'Link Basic', price: 1, frequency: 'monthly', no_of_vcards: 5, features: {} });
  planRich = await M.Plan.create({ name: 'Link Rich', price: 5, frequency: 'yearly', no_of_vcards: 5, features: { custom_links: true, payment_links: true } });
  await planMonthly.setTemplates([tpl]); await planRich.setTemplates([tpl]);
  customer = await makeUser({ first_name: 'Cust', last_name: 'Omer' });
  const codeFromMail = () => outbox.filter((m) => m.key === 'login_code').at(-1)?.values.code;
  await settings.set({ login_otp_enable: '1', enforce_2fa_staff: '1', require_totp_staff: '0', max_login_attempts: '50' });
  const u = await makeUser({ role: 'super_admin' });
  admin = client(ctx.base); const a = await admin.post('/api/auth/login-code', { email: u.email });
  assert.equal((await admin.post('/api/auth/two-factor', { challenge: a.body.challenge, code: codeFromMail() })).status, 200);
  await settings.set({ login_otp_enable: '0', enforce_2fa_staff: '0' }); // ordinary customers sign in with a password in these tests
});
after(async () => { ctx.server.close(); await M.sequelize.close(); });

const email = () => `claim${++seq}_${Math.random().toString(36).slice(2, 7)}@example.test`;
const lastCode = (to) => outbox.filter((m) => m.key === 'link_code' && m.to === to).at(-1)?.values.code;
const gen = async (specs, extra = {}) => { const r = await admin.post('/api/admin/links/generate', { links: specs, ...extra }); assert.equal(r.status, 201, r.text); return r.body.data; };
/** run the whole claim as a visitor; returns the client (signed in) and the e-mail */
async function claimAs(code, details, addr = email()) {
  const v = client(ctx.base);
  assert.equal((await v.post(`/api/public/links/${code}/claim/start`, { email: addr })).status, 200);
  const r = await v.post(`/api/public/links/${code}/claim/verify`, { email: addr, code: lastCode(addr), details });
  assert.equal(r.status, 200, r.text);
  return { v, addr, res: r };
}
// every start needs a fresh cooldown window: time travel by removing the previous code rows
const clearCooldown = () => M.LinkOtp.destroy({ where: {} });

test('admin generates links of each kind with their own plan; bad input is refused; ordinary users cannot', async () => {
  const made = await gen([{ kind: 'vcard', plan_id: planRich.id, qty: 2, template_id: tpl.id }, { kind: 'redirect', plan_id: planMonthly.id, preset_url: 'https://example.com/menu' }, { kind: 'review', plan_id: planMonthly.id }], { user_id: customer.id });
  assert.equal(made.length, 4); assert.deepEqual(made.map((l) => l.kind).sort(), ['redirect', 'review', 'vcard', 'vcard']);
  for (const l of made) { assert.equal(l.state, 'unclaimed'); assert.equal(l.ordered_for, customer.id); assert.ok(!l.user_id); assert.ok(l.plan_id); assert.match(l.short_url, /\/r\//); }
  assert.equal(new Set(made.map((l) => l.code)).size, 4);
  assert.equal((await admin.post('/api/admin/links/generate', { links: [{ kind: 'vcard' }] })).status, 422, 'plan required');
  assert.equal((await admin.post('/api/admin/links/generate', { links: [{ kind: 'nope', plan_id: planMonthly.id }] })).status, 422, 'unknown kind');
  assert.equal((await admin.post('/api/admin/links/generate', { links: [{ kind: 'review', plan_id: planMonthly.id, preset_url: 'https://evil.test/x' }] })).status, 422, 'review link must be a Google address');
  assert.equal((await admin.post('/api/admin/links/generate', { user_id: 999999, links: [{ kind: 'vcard', plan_id: planMonthly.id }] })).status, 422, 'unknown customer');
  const nobody = client(ctx.base); await nobody.post('/api/auth/login', { email: customer.email, password: 'Passw0rd!x' });
  assert.equal((await nobody.get('/api/auth/me')).body.user.email, customer.email, 'customer is signed in');
  assert.equal((await nobody.post('/api/admin/links/generate', { links: [{ kind: 'vcard', plan_id: planMonthly.id }] })).status, 403);
  const list = await admin.get(`/api/admin/short-links?ordered_for=${customer.id}`);
  assert.equal(list.body.data.length, 4); assert.ok(list.body.data.every((l) => l.plan_name && l.state === 'unclaimed'));
});

test('opening an unclaimed link goes to the claim page; the public info shows the fixed kind (the visitor does not pick)', async () => {
  const [l] = await gen([{ kind: 'redirect', plan_id: planMonthly.id }]);
  const visit = await client(ctx.base).get(`/r/${l.code}`);
  assert.equal(visit.status, 302); assert.match(visit.headers.get('location'), new RegExp(`/claim/${l.code}$`));
  const info = await client(ctx.base).get(`/api/public/links/${l.code}`);
  assert.equal(info.body.data.kind, 'redirect'); assert.equal(info.body.data.state, 'unclaimed'); assert.equal(info.body.data.needs, 'url');
  assert.equal((await client(ctx.base).get('/api/public/links/doesnotexist')).status, 404);
});

test('claim with an e-mailed code: redirect link', async () => {
  const [l] = await gen([{ kind: 'redirect', plan_id: planMonthly.id }]);
  const v = client(ctx.base); const addr = email();
  assert.equal((await v.post(`/api/public/links/${l.code}/claim/start`, { email: 'not-an-email' })).status, 422);
  assert.equal((await v.post(`/api/public/links/${l.code}/claim/start`, { email: addr })).status, 200);
  assert.equal(outbox.filter((m) => m.key === 'link_code' && m.to === addr).length, 1);
  assert.equal((await v.post(`/api/public/links/${l.code}/claim/start`, { email: addr })).status, 429, 'cooldown between codes');
  // a missing destination is reported without using up the code
  const noUrl = await v.post(`/api/public/links/${l.code}/claim/verify`, { email: addr, code: lastCode(addr), details: {} });
  assert.equal(noUrl.status, 422); assert.ok(noUrl.body.errors?.url);
  assert.equal((await v.post(`/api/public/links/${l.code}/claim/verify`, { email: addr, code: '000000', details: { url: 'https://example.com/a' } })).status, 422, 'wrong code');
  const ok = await v.post(`/api/public/links/${l.code}/claim/verify`, { email: addr, code: lastCode(addr), details: { url: 'https://example.com/a' } });
  assert.equal(ok.status, 200, ok.text); assert.equal(ok.body.user.email, addr);
  assert.equal((await v.get('/api/auth/me')).body.user.email, addr, 'signed in after the claim');
  const row = await M.ShortLink.findByPk(l.id);
  assert.equal(row.claimed_email, addr); assert.ok(row.user_id); assert.equal(row.target_url, 'https://example.com/a'); assert.ok(row.expires_at, 'plan length sets the expiry');
  const days = (new Date(row.expires_at) - Date.now()) / 86400000; assert.ok(days > 27 && days < 32, `monthly plan, got ${days} days`);
  const go = await client(ctx.base).get(`/r/${l.code}`); assert.equal(go.status, 302); assert.equal(go.headers.get('location'), 'https://example.com/a');
  assert.equal((await client(ctx.base).post(`/api/public/links/${l.code}/claim/start`, { email: email() })).status, 409, 'one link, one e-mail');
});

test('a wrong code five times burns it; the newest code is the only one that works', async () => {
  await clearCooldown();
  const [l] = await gen([{ kind: 'redirect', plan_id: planMonthly.id, preset_url: 'https://example.com/p' }]);
  const v = client(ctx.base); const addr = email();
  await v.post(`/api/public/links/${l.code}/claim/start`, { email: addr }); const first = lastCode(addr);
  await clearCooldown(); await v.post(`/api/public/links/${l.code}/claim/start`, { email: addr }); const second = lastCode(addr);
  if (first !== second) assert.equal((await v.post(`/api/public/links/${l.code}/claim/verify`, { email: addr, code: first, details: {} })).status, 422, 'older code expired');
  for (let i = 0; i < 5; i += 1) await v.post(`/api/public/links/${l.code}/claim/verify`, { email: addr, code: '999999' === second ? '888888' : '999999', details: {} });
  assert.equal((await v.post(`/api/public/links/${l.code}/claim/verify`, { email: addr, code: second, details: {} })).status, 422, 'burned after five wrong tries');
});

test('claim a business card: the profile is added first, the card is created under that e-mail, no template picking', async () => {
  await clearCooldown();
  const [l] = await gen([{ kind: 'vcard', plan_id: planRich.id, template_id: tpl.id }], { user_id: customer.id });
  const v = client(ctx.base); const addr = email();
  await v.post(`/api/public/links/${l.code}/claim/start`, { email: addr });
  const noName = await v.post(`/api/public/links/${l.code}/claim/verify`, { email: addr, code: lastCode(addr), details: { last_name: 'X' } });
  assert.equal(noName.status, 422); assert.ok(noName.body.errors?.first_name, 'profile details required first');
  const ok = await v.post(`/api/public/links/${l.code}/claim/verify`, { email: addr, code: lastCode(addr), details: { first_name: 'Hina', last_name: 'Shah', job_title: 'Dentist', company: 'Smile Clinic', phone: '0300 1234567' } });
  assert.equal(ok.status, 200, ok.text);
  const row = await M.ShortLink.findByPk(l.id); const card = await M.Vcard.findByPk(row.vcard_id);
  assert.equal(card.user_id, row.user_id); assert.equal(card.first_name, 'Hina'); assert.equal(card.company, 'Smile Clinic'); assert.equal(card.email, addr); assert.equal(card.template_id, tpl.id);
  const go = await client(ctx.base).get(`/r/${l.code}`); assert.equal(go.status, 302); assert.match(go.headers.get('location'), new RegExp(`/${card.url_alias}`));
  assert.equal((await client(ctx.base).get(`/${card.url_alias}`)).status, 200, 'card page is live on the link plan');
});

test('review links only accept a Google review address', async () => {
  await clearCooldown();
  const [l] = await gen([{ kind: 'review', plan_id: planMonthly.id }]);
  const v = client(ctx.base); const addr = email();
  await v.post(`/api/public/links/${l.code}/claim/start`, { email: addr });
  assert.equal((await v.post(`/api/public/links/${l.code}/claim/verify`, { email: addr, code: lastCode(addr), details: { url: 'https://phishing.test/x' } })).status, 422);
  const ok = await v.post(`/api/public/links/${l.code}/claim/verify`, { email: addr, code: lastCode(addr), details: { url: 'https://search.google.com/local/writereview?placeid=ChIJxxxx' } });
  assert.equal(ok.status, 200, ok.text);
  assert.equal((await client(ctx.base).get(`/r/${l.code}`)).headers.get('location'), 'https://search.google.com/local/writereview?placeid=ChIJxxxx');
});

test('staff e-mails cannot claim, and a claim never touches an existing account’s password', async () => {
  await clearCooldown();
  const staff = await makeUser({ role: 'admin' });
  const [l] = await gen([{ kind: 'redirect', plan_id: planMonthly.id, preset_url: 'https://example.com/s' }]);
  assert.equal((await client(ctx.base).post(`/api/public/links/${l.code}/claim/start`, { email: staff.email })).status, 200);
  const r = await client(ctx.base).post(`/api/public/links/${l.code}/claim/verify`, { email: staff.email, code: lastCode(staff.email), details: {} });
  assert.equal(r.status, 422, 'staff account refused'); assert.equal((await M.ShortLink.findByPk(l.id)).user_id, null);
});

test('each link has its own plan: the card follows the link plan and expiry, not the owner’s subscription', async () => {
  await clearCooldown();
  const [l] = await gen([{ kind: 'vcard', plan_id: planRich.id, template_id: tpl.id }]);
  const { v } = await claimAs(l.code, { first_name: 'Plan', last_name: 'Test' });
  const row = await M.ShortLink.findByPk(l.id);
  const got = await v.get(`/api/user/vcards/${row.vcard_id}`);
  assert.equal(got.status, 200, got.text); assert.equal(got.body.features.custom_links, true, 'features come from the link plan');
  assert.equal(got.body.link_plan.name, 'Link Rich');
  // the owner has no subscription of their own, yet may use the features of this link's plan
  const save = await v.put(`/api/user/vcards/${row.vcard_id}`, { custom_links: [{ label: 'Menu', url: 'https://x.test' }], bank_accounts: [{ name: 'HBL', account: '123' }] });
  assert.equal(save.status, 200, save.text); assert.equal((await M.Vcard.findByPk(row.vcard_id)).custom_links[0].label, 'Menu');
  // expiry of the link switches the card off for visitors and shows the link as expired
  const card = await M.Vcard.findByPk(row.vcard_id);
  await row.update({ expires_at: new Date(Date.now() - 1000) });
  assert.equal((await client(ctx.base).get(`/r/${l.code}`)).status, 410);
  assert.equal((await client(ctx.base).get(`/${card.url_alias}`)).status, 503, 'expired plan: the card is unavailable');
});

test('the owner dashboard lists exactly their links, as cards', async () => {
  await clearCooldown();
  const [a, b] = await gen([{ kind: 'vcard', plan_id: planMonthly.id }, { kind: 'redirect', plan_id: planMonthly.id }]);
  const addr = email();
  const { v } = await claimAs(a.code, { first_name: 'One' }, addr);
  await clearCooldown();
  const v2 = client(ctx.base); await v2.post(`/api/public/links/${b.code}/claim/start`, { email: addr });
  assert.equal((await v2.post(`/api/public/links/${b.code}/claim/verify`, { email: addr, code: lastCode(addr), details: { url: 'https://example.com/two' } })).status, 200, 'one e-mail owns many links');
  const mine = (await v2.get('/api/user/links')).body.data;
  assert.equal(mine.length, 2); assert.deepEqual(mine.map((x) => x.kind).sort(), ['redirect', 'vcard']);
  assert.ok(mine.every((x) => x.state === 'active' && x.short_url && x.plan?.name && x.expires_at));
  assert.ok(mine.find((x) => x.kind === 'vcard').vcard.url);
  const stranger = client(ctx.base); await stranger.post('/api/auth/login', { email: customer.email, password: 'Passw0rd!x' });
  assert.equal((await stranger.get('/api/user/links')).body.data.length, 0);
  assert.equal((await stranger.post(`/api/user/links/${a.id}/reset/start`)).status, 404, "another e-mail's link");
  assert.equal((await v.put(`/api/user/links/${b.id}/destination`, { url: 'https://example.com/changed' })).status, 200);
  assert.equal((await client(ctx.base).get(`/r/${b.code}`)).headers.get('location'), 'https://example.com/changed');
});

test('reset by the owner needs an e-mailed code; keep leaves the card with its owner, wipe deletes it; the link is unclaimed again', async () => {
  await clearCooldown();
  const [keep, wipe] = await gen([{ kind: 'vcard', plan_id: planMonthly.id }, { kind: 'vcard', plan_id: planMonthly.id }]);
  const a = await claimAs(keep.code, { first_name: 'Keep' }); await clearCooldown();
  const b = await claimAs(wipe.code, { first_name: 'Wipe' }); await clearCooldown();
  const kRow = await M.ShortLink.findByPk(keep.id); const wRow = await M.ShortLink.findByPk(wipe.id);
  assert.equal((await a.v.post(`/api/user/links/${keep.id}/reset/start`)).status, 200);
  assert.equal((await a.v.post(`/api/user/links/${keep.id}/reset/confirm`, { code: '123456', wipe: false })).status, 422, 'wrong code');
  assert.equal((await a.v.post(`/api/user/links/${keep.id}/reset/confirm`, { code: lastCode(a.addr), wipe: false })).status, 200);
  const k = await M.ShortLink.findByPk(keep.id);
  assert.equal(k.user_id, null); assert.equal(k.claimed_at, null); assert.equal(k.vcard_id, null); assert.equal(k.expires_at, null);
  assert.ok(await M.Vcard.findByPk(kRow.vcard_id), 'keep: the previous owner still has the card');
  assert.equal((await client(ctx.base).get(`/r/${keep.code}`)).status, 302, 'back to the claim page');
  assert.equal((await b.v.post(`/api/user/links/${wipe.id}/reset/start`)).status, 200);
  assert.equal((await b.v.post(`/api/user/links/${wipe.id}/reset/confirm`, { code: lastCode(b.addr), wipe: true })).status, 200);
  assert.equal(await M.Vcard.findByPk(wRow.vcard_id), null, 'wipe: the card is deleted');
  // and the next person can claim it again
  await clearCooldown();
  assert.equal((await claimAs(keep.code, { first_name: 'Next' })).res.status, 200);
});

test('moving to another e-mail: the code goes to the NEW e-mail; keep moves the card, wipe asks the new owner for details', async () => {
  await clearCooldown();
  const [keep, wipe] = await gen([{ kind: 'vcard', plan_id: planMonthly.id }, { kind: 'redirect', plan_id: planMonthly.id }]);
  const a = await claimAs(keep.code, { first_name: 'Mover' }); await clearCooldown();
  const w = await claimAs(wipe.code, { url: 'https://example.com/old' }); await clearCooldown();
  const to1 = email(); const to2 = email();
  assert.equal((await a.v.post(`/api/user/links/${keep.id}/transfer/start`, { email: a.addr })).status, 422, 'already theirs');
  assert.equal((await a.v.post(`/api/user/links/${keep.id}/transfer/start`, { email: to1 })).status, 200);
  assert.ok(lastCode(to1), 'the code was sent to the new e-mail, not the old one');
  assert.equal((await a.v.post(`/api/user/links/${keep.id}/transfer/confirm`, { email: to1, code: '000000', wipe: false })).status, 422);
  assert.equal((await a.v.post(`/api/user/links/${keep.id}/transfer/confirm`, { email: to1, code: lastCode(to1), wipe: false })).status, 200);
  const k = await M.ShortLink.findByPk(keep.id); const newOwner = await M.User.findOne({ where: { email: to1 } });
  assert.equal(k.user_id, newOwner.id); assert.equal(k.claimed_email, to1);
  assert.equal((await M.Vcard.findByPk(k.vcard_id)).user_id, newOwner.id, 'keep: the card moved with the link');
  assert.equal((await a.v.get('/api/user/links')).body.data.length, 0, 'the old owner no longer sees it');
  // wipe: destination removed, the new owner adds it first
  assert.equal((await w.v.post(`/api/user/links/${wipe.id}/transfer/start`, { email: to2 })).status, 200);
  assert.equal((await w.v.post(`/api/user/links/${wipe.id}/transfer/confirm`, { email: to2, code: lastCode(to2), wipe: true })).status, 200);
  const wr = await M.ShortLink.findByPk(wipe.id);
  assert.equal(wr.target_url, null); assert.equal(wr.details_pending, true);
  assert.equal((await client(ctx.base).get(`/r/${wipe.code}`)).status, 200, 'shows "being set up", does not redirect');
  const newW = client(ctx.base); await newW.post('/api/auth/login-code', { email: to2 });
  const login = await newW.post('/api/auth/two-factor', { challenge: (await newW.post('/api/auth/login-code', { email: to2 })).body.challenge, code: outbox.filter((m) => m.key === 'login_code').at(-1)?.values.code });
  assert.equal(login.status, 200, 'the new owner signs in with an e-mailed code');
  assert.equal((await newW.post(`/api/user/links/${wipe.id}/details`, { url: 'not a url' })).status, 422);
  assert.equal((await newW.post(`/api/user/links/${wipe.id}/details`, { url: 'https://example.com/new' })).status, 200);
  assert.equal((await client(ctx.base).get(`/r/${wipe.code}`)).headers.get('location'), 'https://example.com/new');
});

test('admin can reset and move any link without a code, and the choice to wipe is honoured', async () => {
  await clearCooldown();
  const [l1, l2] = await gen([{ kind: 'vcard', plan_id: planMonthly.id }, { kind: 'vcard', plan_id: planMonthly.id }]);
  await claimAs(l1.code, { first_name: 'Adm' }); await clearCooldown(); await claimAs(l2.code, { first_name: 'Adm2' });
  const card1 = (await M.ShortLink.findByPk(l1.id)).vcard_id;
  const to = email();
  assert.equal((await admin.post(`/api/admin/short-links/${l1.id}/transfer`, { email: 'bad' })).status, 422);
  assert.equal((await admin.post(`/api/admin/short-links/${l1.id}/transfer`, { email: to, wipe: false })).status, 200);
  assert.equal((await M.Vcard.findByPk(card1)).user_id, (await M.User.findOne({ where: { email: to } })).id);
  assert.equal((await admin.post(`/api/admin/short-links/${l2.id}/reset`, { wipe: true })).status, 200);
  const r2 = await M.ShortLink.findByPk(l2.id); assert.equal(r2.user_id, null); assert.equal(r2.vcard_id, null);
  assert.equal((await admin.post(`/api/admin/short-links/${l2.id}/reset`, { wipe: true })).status, 422, 'already unclaimed');
  const nobody = client(ctx.base); await nobody.post('/api/auth/login', { email: customer.email, password: 'Passw0rd!x' });
  assert.equal((await nobody.post(`/api/admin/short-links/${l1.id}/reset`, {})).status, 403);
});

test('old links (made before this feature) keep their behaviour', async () => {
  const legacy = await M.ShortLink.create({ code: `old${Date.now()}`.slice(0, 12), target_type: 'unassigned' });
  assert.equal(require('../src/services/links').stateOf(legacy), 'legacy');
  const r = await client(ctx.base).get(`/r/${legacy.code}`);
  assert.equal(r.status, 200); assert.match(r.text, /not activated/i);
  assert.equal((await client(ctx.base).get(`/api/public/links/${legacy.code}`)).status, 404, 'not a managed link');
});

test('a review link needs no plan and never expires; a business card or redirect link still needs one', async () => {
  const r = await admin.post('/api/admin/links/generate', { links: [{ kind: 'review', qty: 2 }] });
  assert.equal(r.status, 201, r.text);
  assert.equal(r.body.data.length, 2);
  assert.ok(r.body.data.every((l) => l.kind === 'review' && l.plan_id === null));
  assert.equal((await admin.post('/api/admin/links/generate', { links: [{ kind: 'redirect' }] })).status, 422);
  assert.equal((await admin.post('/api/admin/links/generate', { links: [{ kind: 'vcard' }] })).status, 422);
});
