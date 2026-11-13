/* Sub admins (admin / manager / supervisor) added by the super admin: invitation, e-mail code, authenticator, permissions, recovery. */
const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { boot, client, makeUser, outbox, settings, M, setMail } = require('./helpers');
const totp = require('../src/services/totp');

let ctx; let seq = 0;
before(async () => { ctx = await boot(); });
after(async () => { ctx.server.close(); await M.sequelize.close(); });
beforeEach(async () => { outbox.length = 0; setMail({ configured: true, fails: false }); await settings.set({ login_otp_enable: '1', enforce_2fa_staff: '1', require_totp_staff: '1', max_login_attempts: '5' }); });

const codeFromMail = () => outbox.filter((m) => m.key === 'login_code').at(-1)?.values.code;
const now = (secret) => totp.hotp(secret, Math.floor(Date.now() / 30000));
async function superAdmin() { const u = await makeUser({ role: 'super_admin' }); await settings.set({ require_totp_staff: '0' }); const c = client(ctx.base); const a = await c.post('/api/auth/login-code', { email: u.email }); assert.equal((await c.post('/api/auth/two-factor', { challenge: a.body.challenge, code: codeFromMail() })).status, 200); await settings.set({ require_totp_staff: '1' }); return { u, c }; }

test('super admin adds a sub admin with only a name and e-mail; they sign in with a code and set up the authenticator', async () => {
  const { c } = await superAdmin();
  for (const role of ['admin', 'manager', 'supervisor']) {
    outbox.length = 0;
    const email = `staff_${++seq}@example.test`;
    const r = await c.post('/api/admin/admins', { first_name: 'Sara', email, role });
    assert.equal(r.status, 201, r.text); assert.equal(r.body.data.role, role); assert.ok(r.body.invite_url); assert.ok(outbox.some((m) => m.key === 'invite' && m.to === email));
    const s = client(ctx.base);
    const a = await s.post('/api/auth/login-code', { email }); const step = await s.post('/api/auth/two-factor', { challenge: a.body.challenge, code: codeFromMail() });
    assert.equal(step.body.setup_required, true, `${role}: authenticator is required`);
    const setup = await s.post('/api/auth/2fa/setup-login', { setup_token: step.body.setup_token });
    const done = await s.post('/api/auth/2fa/enable-login', { setup_token: step.body.setup_token, code: now(setup.body.secret) });
    assert.equal(done.status, 200); assert.equal(done.body.user.role, role); assert.equal(done.body.user.is_staff, true);
    assert.equal((await s.post('/api/auth/2fa/disable', { password: 'x' })).status, 403, 'cannot be switched off');
  }
});

test('a sub admin cannot manage other sub admins, and only gets the modules they were granted', async () => {
  await settings.set({ require_totp_staff: '0' });
  const mgr = await makeUser({ role: 'manager', permissions: ['dashboard.view'] }); const other = await makeUser({ role: 'supervisor' });
  const c = client(ctx.base); const a = await c.post('/api/auth/login-code', { email: mgr.email }); await c.post('/api/auth/two-factor', { challenge: a.body.challenge, code: codeFromMail() });
  assert.equal((await c.get('/api/admin/admins')).status, 403, 'staff list is super-admin only');
  assert.equal((await c.post(`/api/admin/admins/${other.id}/reset-authenticator`)).status, 403);
  assert.equal((await c.get('/api/admin/dashboard/card-analytics')).status, 200, 'granted: dashboard (card analytics)');
  assert.equal((await c.get('/api/admin/users')).status, 403, 'not granted: users');
  assert.equal((await c.get('/api/admin/orders')).status, 403, 'not granted: orders');
});

test('super admin can reset a lost authenticator and sign a sub admin out everywhere; super admins cannot be targeted', async () => {
  const { u: sa, c } = await superAdmin();
  const staff = await makeUser({ role: 'admin', two_factor_enabled: true, two_factor_secret: 'JBSWY3DPEHPK3PXP', two_factor_recovery: ['x'] });
  const sessions = client(ctx.base); await settings.set({ require_totp_staff: '0', enforce_2fa_staff: '0', login_otp_enable: '0' });
  assert.equal((await sessions.post('/api/auth/login', { email: staff.email, password: 'Passw0rd!x' })).status, 200);
  await settings.set({ require_totp_staff: '1', enforce_2fa_staff: '1', login_otp_enable: '1' });
  const list = await c.get('/api/admin/admins'); const row = list.body.data.find((x) => x.id === staff.id); assert.equal(row.two_factor_enabled, true); assert.ok('last_login_at' in row);
  const r = await c.post(`/api/admin/admins/${staff.id}/reset-authenticator`); assert.equal(r.status, 200, r.text);
  const after = await M.User.scope('withSecrets').findByPk(staff.id); assert.equal(after.two_factor_enabled, false); assert.equal(after.two_factor_secret, null);
  assert.ok(outbox.some((m) => m.key === 'security_notice' && m.to === staff.email));
  assert.equal((await sessions.get('/api/auth/me')).body.user, null, 'old session is dead');
  assert.equal((await c.post(`/api/admin/admins/${sa.id}/reset-authenticator`)).status, 404, 'a super admin is not a sub admin');
  assert.equal((await c.post(`/api/admin/admins/${staff.id}/sign-out`)).status, 200);
  assert.equal((await c.post('/api/admin/admins/999999/sign-out')).status, 404);
});

test('a deactivated sub admin is refused at once and gets no codes', async () => {
  const { c } = await superAdmin();
  const staff = await makeUser({ role: 'admin' }); await settings.set({ require_totp_staff: '0' });
  const s = client(ctx.base); const a = await s.post('/api/auth/login-code', { email: staff.email }); await s.post('/api/auth/two-factor', { challenge: a.body.challenge, code: codeFromMail() });
  assert.equal((await s.get('/api/auth/me')).body.user.id, staff.id);
  assert.equal((await c.patch(`/api/admin/admins/${staff.id}/status`, { is_active: false })).status, 200);
  assert.equal((await s.get('/api/auth/me')).body.user, null, 'session ends at once');
  outbox.length = 0; await client(ctx.base).post('/api/auth/login-code', { email: staff.email });
  assert.equal(outbox.filter((m) => m.key === 'login_code').length, 0, 'no code for a deactivated account');
});
