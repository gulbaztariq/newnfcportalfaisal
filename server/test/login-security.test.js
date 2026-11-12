/* Extra layer for super admin, staff and company admins: authenticator app after the e-mailed code, lockout, alerts, short sessions. */
const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { boot, client, makeUser, outbox, settings, M, setMail } = require('./helpers');
const totp = require('../src/services/totp');

let ctx;
before(async () => { ctx = await boot(); });
after(async () => { ctx.server.close(); await M.sequelize.close(); });
beforeEach(async () => { outbox.length = 0; setMail({ configured: true, fails: false }); await settings.set({ login_otp_enable: '1', enforce_2fa_staff: '1', require_totp_staff: '1', require_totp_company: '1', max_login_attempts: '5', lockout_minutes: '15' }); });

const codeFromMail = () => outbox.filter((m) => m.key === 'login_code').at(-1)?.values.code;
const now = (secret) => totp.hotp(secret, Math.floor(Date.now() / 30000));

async function emailStep(c, email) {
  const a = await c.post('/api/auth/login-code', { email });
  assert.equal(a.status, 200);
  return c.post('/api/auth/two-factor', { challenge: a.body.challenge, code: codeFromMail() });
}

test('super admin: e-mailed code alone does not sign in; the authenticator must be set up first, then every sign-in asks for it', async () => {
  const admin = await makeUser({ role: 'super_admin' }); const c = client(ctx.base);
  const r = await emailStep(c, admin.email);
  assert.equal(r.status, 200); assert.equal(r.body.setup_required, true); assert.ok(r.body.setup_token); assert.ok(!r.body.user);
  assert.equal((await c.get('/api/auth/me')).body.user, null, 'no session yet');
  assert.equal((await c.post('/api/auth/2fa/setup-login', { setup_token: 'junk' })).status, 422);
  const setup = await c.post('/api/auth/2fa/setup-login', { setup_token: r.body.setup_token });
  assert.equal(setup.status, 200); assert.ok(setup.body.secret); assert.match(setup.body.qr, /^data:image/);
  assert.equal((await c.post('/api/auth/2fa/enable-login', { setup_token: r.body.setup_token, code: '000000' })).status, 422, 'wrong app code');
  const done = await c.post('/api/auth/2fa/enable-login', { setup_token: r.body.setup_token, code: now(setup.body.secret) });
  assert.equal(done.status, 200, done.text); assert.equal(done.body.user.id, admin.id); assert.equal(done.body.recovery_codes.length >= 8, true);
  assert.equal((await c.get('/api/auth/me')).body.user.id, admin.id, 'signed in after setup');
  // next time: e-mailed code, then the app code
  const c2 = client(ctx.base); const step = await emailStep(c2, admin.email);
  assert.equal(step.body.method, 'totp'); assert.ok(!step.body.user);
  assert.equal((await c2.post('/api/auth/two-factor', { challenge: step.body.challenge, code: '000000' })).status, 422);
  const ok = await c2.post('/api/auth/two-factor', { challenge: step.body.challenge, code: now(setup.body.secret) });
  assert.equal(ok.status, 200); assert.equal(ok.body.user.id, admin.id);
  assert.equal((await c2.post('/api/auth/2fa/disable', { password: 'Passw0rd!x' })).status, 403, 'required, so it cannot be switched off');
});

test('company owner and company manager need the authenticator too; members and plain users do not', async () => {
  const owner = await makeUser({ is_organisation: true, company_role: 'owner' });
  const manager = await makeUser({ organisation_id: owner.id, company_role: 'manager' });
  const member = await makeUser({ organisation_id: owner.id, company_role: 'member' });
  const plain = await makeUser();
  assert.equal((await emailStep(client(ctx.base), owner.email)).body.setup_required, true);
  assert.equal((await emailStep(client(ctx.base), manager.email)).body.setup_required, true);
  assert.equal((await emailStep(client(ctx.base), member.email)).body.user.id, member.id);
  assert.equal((await emailStep(client(ctx.base), plain.email)).body.user.id, plain.id);
});

test('the requirement can be switched off per group, and the password path is covered as well', async () => {
  await settings.set({ require_totp_company: '0' });
  const owner = await makeUser({ is_organisation: true, company_role: 'owner' });
  assert.equal((await emailStep(client(ctx.base), owner.email)).body.user.id, owner.id);
  await settings.set({ require_totp_company: '1' });
  setMail({ configured: false }); // no mail: password is the first step, the authenticator still follows
  const admin = await makeUser({ role: 'admin' });
  const r = await client(ctx.base).post('/api/auth/login', { email: admin.email, password: 'Passw0rd!x' });
  assert.equal(r.body.setup_required, true);
});

test('wrong codes count towards the account lockout, so codes cannot be guessed across many requests', async () => {
  const u = await makeUser(); await settings.set({ max_login_attempts: '3' });
  const c = client(ctx.base);
  for (let i = 0; i < 3; i += 1) {
    const a = await c.post('/api/auth/login-code', { email: u.email });
    const wrong = codeFromMail() === '111111' ? '222222' : '111111';
    await c.post('/api/auth/two-factor', { challenge: a.body.challenge, code: wrong });
    await M.User.update({ login_otp_expires_at: new Date(Date.now() + 60000), login_otp_hash: (await M.User.scope('withSecrets').findByPk(u.id)).login_otp_hash }, { where: { id: u.id } });
    if (i < 2) await M.User.update({ login_otp_expires_at: new Date(Date.now() - 120000) }, { where: { id: u.id } }); // let the cooldown pass
  }
  const locked = await M.User.scope('withSecrets').findByPk(u.id); assert.ok(locked.locked_until && new Date(locked.locked_until) > new Date(), 'locked');
  const a = await client(ctx.base).post('/api/auth/login-code', { email: u.email });
  assert.equal(outbox.filter((m) => m.key === 'login_code').length <= 3, true, 'no new code is mailed while locked');
  const t = await client(ctx.base).post('/api/auth/two-factor', { challenge: a.body.challenge, code: '123456' });
  assert.ok([422, 429].includes(t.status));
});

test('sessions: staff and company admins get an 8 hour cookie, everyone else 7 days', async () => {
  await settings.set({ require_totp_staff: '0', require_totp_company: '0' });
  const maxAge = (r) => Number((String(r.headers?.['set-cookie'] || r.cookies || '').match(/Max-Age=(\d+)/i) || [])[1]);
  const admin = await makeUser({ role: 'admin' }); const plain = await makeUser();
  const a = await client(ctx.base).post('/api/auth/login', { email: admin.email, password: 'Passw0rd!x' });
  const code = codeFromMail(); assert.ok(code);
  const jwt = require('jsonwebtoken'); const { jwtSecret } = require('../src/config');
  const tok = (u) => jwt.sign({ sub: u.id, v: 0 }, jwtSecret); void tok;
  const mw = require('../src/middleware/auth');
  const fake = () => { const o = {}; return { cookie: (n, t, opts) => { o.opts = opts; o.token = t; }, o }; };
  const x = fake(); mw.issueToken(x, admin); const y = fake(); mw.issueToken(y, plain); const z = fake(); mw.issueToken(z, await makeUser({ is_organisation: true, company_role: 'owner' }));
  assert.equal(x.o.opts.maxAge, 8 * 3600 * 1000); assert.equal(z.o.opts.maxAge, 8 * 3600 * 1000); assert.equal(y.o.opts.maxAge, 7 * 24 * 3600 * 1000);
  const exp = (t) => { const p = jwt.decode(t); return p.exp - p.iat; };
  assert.equal(exp(x.o.token), 8 * 3600); assert.equal(exp(y.o.token), 7 * 24 * 3600); void a; void maxAge;
});

test('a sign-in from a new device or network e-mails a privileged account; known ones and plain users stay quiet', async () => {
  await settings.set({ require_totp_staff: '0' });
  const admin = await makeUser({ role: 'admin' }); const plain = await makeUser();
  const sign = (email, ua) => { const c = client(ctx.base); return c.post('/api/auth/login-code', { email }, { 'user-agent': ua, 'X-Forwarded-For': '9.9.9.9' }).then(async (a) => c.post('/api/auth/two-factor', { challenge: a.body.challenge, code: codeFromMail() }, { 'user-agent': ua, 'X-Forwarded-For': '9.9.9.9' })); };
  const wait = () => new Promise((r) => setTimeout(r, 150));
  await sign(admin.email, 'Mozilla/5.0 (Windows NT 10.0) Chrome/124.0 Safari/537.36'); await wait();
  assert.equal(outbox.filter((m) => m.key === 'login_alert').length, 0, 'the very first sign-in is not an alert');
  await sign(admin.email, 'Mozilla/5.0 (Windows NT 10.0) Chrome/124.0 Safari/537.36'); await wait();
  assert.equal(outbox.filter((m) => m.key === 'login_alert').length, 0, 'same device: quiet');
  await sign(admin.email, 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) Safari/604.1'); await wait();
  const alert = outbox.filter((m) => m.key === 'login_alert'); assert.equal(alert.length, 1); assert.equal(alert[0].to, admin.email); assert.match(alert[0].values.device, /Safari on iOS/);
  await sign(plain.email, 'A'); await sign(plain.email, 'B'); await wait();
  assert.equal(outbox.filter((m) => m.key === 'login_alert' && m.to === plain.email).length, 0, 'plain users are not alerted');
  assert.ok((await M.ActivityLog.count({ where: { user_id: admin.id, action: 'auth.login' } })) >= 3, 'every sign-in is in the audit log');
});
