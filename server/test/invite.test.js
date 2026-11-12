/* Adding a person with only a name and an e-mail: they get a link, choose their password, then sign in. */
const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { boot, client, makeUser, outbox, settings, M, setMail } = require('./helpers');
const subs = require('../src/services/subscription');

let ctx; let seq = 0;
before(async () => { ctx = await boot(); });
after(async () => { ctx.server.close(); await M.sequelize.close(); });
beforeEach(async () => { outbox.length = 0; setMail({ configured: true, fails: false }); await settings.set({ login_otp_enable: '0', enforce_2fa_staff: '0' }); });

const tokenOf = (url) => new URL(url).searchParams.get('token');
const login = (email, password) => client(ctx.base).post('/api/auth/login', { email, password });

async function setPassword(inviteUrl, password) {
  const u = new URL(inviteUrl);
  assert.equal(u.searchParams.get('invite'), '1');
  return client(ctx.base).post('/api/auth/reset-password', { email: u.searchParams.get('email'), token: tokenOf(inviteUrl), password, password_confirmation: password });
}

test('admin adds a user with only a name and an e-mail: invitation mailed, user sets a password and signs in', async () => {
  const admin = await makeUser({ role: 'super_admin' }); const c = client(ctx.base);
  assert.equal((await c.post('/api/auth/login', { email: admin.email, password: 'Passw0rd!x' })).status, 200);
  const email = `invitee_${++seq}@example.test`;
  const r = await c.post('/api/admin/users', { first_name: 'Sarah', email });
  assert.equal(r.status, 201, r.text); assert.ok(r.body.invite_url); assert.equal(r.body.invite_sent, true);
  const mail = outbox.find((m) => m.key === 'invite'); assert.ok(mail, 'invitation e-mail'); assert.equal(mail.to, email); assert.equal(mail.values.invite_url, r.body.invite_url);
  assert.ok(!outbox.some((m) => m.key === 'welcome'), 'no password e-mail');
  assert.equal((await login(email, 'anything')).status, 422, 'cannot sign in before choosing a password');
  assert.equal((await setPassword(r.body.invite_url, 'short')).status, 422, 'weak password refused');
  assert.equal((await setPassword(r.body.invite_url, 'My-Own-Pass-77')).status, 200);
  assert.equal((await login(email, 'My-Own-Pass-77')).status, 200, 'signs in with the chosen password');
  assert.equal((await setPassword(r.body.invite_url, 'Another-Pass-88')).status, 422, 'the link works once');
  const u = await M.User.findOne({ where: { email } }); assert.ok(u.email_verified_at); assert.ok(u.is_active);
});

test('invitation links expire, and "resend invite" issues a fresh one that replaces the old', async () => {
  const admin = await makeUser({ role: 'super_admin' }); const c = client(ctx.base);
  await c.post('/api/auth/login', { email: admin.email, password: 'Passw0rd!x' });
  const email = `invitee_${++seq}@example.test`;
  const first = (await c.post('/api/admin/users', { first_name: 'Ana', email })).body;
  await M.User.update({ reset_expires_at: new Date(Date.now() - 1000) }, { where: { email } });
  assert.equal((await setPassword(first.invite_url, 'My-Own-Pass-77')).status, 422, 'expired');
  const u = await M.User.findOne({ where: { email } });
  const again = await c.post(`/api/admin/users/${u.id}/resend-invite`);
  assert.equal(again.status, 200); assert.ok(again.body.invite_url); assert.notEqual(tokenOf(again.body.invite_url), tokenOf(first.invite_url));
  assert.equal((await setPassword(first.invite_url, 'My-Own-Pass-77')).status, 422, 'old link is dead');
  assert.equal((await setPassword(again.body.invite_url, 'My-Own-Pass-77')).status, 200);
});

test('when e-mail is not configured the invitation link still comes back so it can be shared', async () => {
  const admin = await makeUser({ role: 'super_admin' }); const c = client(ctx.base);
  await c.post('/api/auth/login', { email: admin.email, password: 'Passw0rd!x' });
  setMail({ fails: true });
  const r = await c.post('/api/admin/users', { first_name: 'Noor', email: `invitee_${++seq}@example.test` });
  assert.equal(r.status, 201); assert.equal(r.body.invite_sent, false); assert.ok(r.body.invite_url); assert.match(r.body.message, /share/i);
});

test('an admin can still set a password by hand (no invitation then)', async () => {
  const admin = await makeUser({ role: 'super_admin' }); const c = client(ctx.base);
  await c.post('/api/auth/login', { email: admin.email, password: 'Passw0rd!x' });
  const email = `invitee_${++seq}@example.test`;
  const r = await c.post('/api/admin/users', { first_name: 'Ben', last_name: 'Ali', email, password: 'Typed-Pass-99', password_confirmation: 'Typed-Pass-99' });
  assert.equal(r.status, 201); assert.equal(r.body.invite_url, undefined); assert.ok(outbox.some((m) => m.key === 'welcome'));
  assert.equal((await login(email, 'Typed-Pass-99')).status, 200);
});

test('company owner adds a member with a name and e-mail: member gets an invitation, owner can copy the link and resend it', async () => {
  const owner = await makeUser({ is_organisation: true, company_role: 'owner' });
  const plan = await M.Plan.create({ name: `Inv plan ${++seq}`, price: 1, frequency: 'yearly', no_of_vcards: 10, no_of_organization_users: 5, custom_duration_days: 365, features: { organisation: true } });
  await subs.activate(owner.id, plan); await M.Organisation.create({ owner_id: owner.id, name: 'Acme Co', seats: 5 });
  const c = client(ctx.base); assert.equal((await c.post('/api/auth/login', { email: owner.email, password: 'Passw0rd!x' })).status, 200);
  const email = `member_${++seq}@example.test`;
  const r = await c.post('/api/user/organisation/members', { first_name: 'Maya', email });
  assert.equal(r.status, 201, r.text); assert.ok(r.body.invite_url); assert.equal(r.body.password, null); assert.equal(r.body.invite_sent, true);
  const mail = outbox.find((m) => m.key === 'invite'); assert.equal(mail.values.inviter, 'Acme Co');
  assert.equal((await setPassword(r.body.invite_url, 'Member-Pass-55')).status, 200);
  assert.equal((await login(email, 'Member-Pass-55')).status, 200);
  const m = await M.User.findOne({ where: { email } }); assert.equal(m.organisation_id, owner.id);
  const quiet = await c.post('/api/user/organisation/members', { first_name: 'Quinn', email: `member_${++seq}@example.test`, notify: false });
  assert.ok(quiet.body.invite_url); assert.ok(!outbox.some((x) => x.to === quiet.body.data.email), 'notify off: nothing mailed');
  const again = await c.post(`/api/user/organisation/members/${quiet.body.data.id}/resend-invite`);
  assert.equal(again.status, 200); assert.equal(again.body.invite_sent, true);
  const outsider = await makeUser(); const oc = client(ctx.base); await oc.post('/api/auth/login', { email: outsider.email, password: 'Passw0rd!x' });
  assert.notEqual((await oc.post(`/api/user/organisation/members/${quiet.body.data.id}/resend-invite`)).status, 200, 'only the owner');
});
