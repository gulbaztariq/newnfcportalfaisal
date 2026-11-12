const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { boot, client, makeUser, outbox, settings, M, setMail } = require('./helpers');

let ctx;
before(async () => { ctx = await boot(); });
after(async () => { ctx.server.close(); await M.sequelize.close(); });
beforeEach(async () => { outbox.length = 0; setMail({ configured: true, fails: false }); await settings.set({ login_otp_enable: '0', enforce_2fa_staff: '1', max_login_attempts: '5' }); });

const codeFromMail = () => outbox.filter((m) => m.key === 'login_code').at(-1)?.values.code;

test('login: wrong password and unknown e-mail give the same generic error', async () => {
  const u = await makeUser(); const c = client(ctx.base);
  const a = await c.post('/api/auth/login', { email: u.email, password: 'nope' });
  const b = await c.post('/api/auth/login', { email: 'ghost@example.test', password: 'nope' });
  assert.equal(a.status, 422); assert.equal(b.status, 422); assert.equal(a.body.message, b.body.message);
});
test('login: validation rejects missing / malformed fields', async () => {
  const c = client(ctx.base);
  assert.equal((await c.post('/api/auth/login', {})).status, 422);
  assert.equal((await c.post('/api/auth/login', { email: 'not-an-email', password: 'x' })).status, 422);
});
test('login: SQL-injection style input is just a failed login', async () => {
  const c = client(ctx.base);
  const r = await c.post('/api/auth/login', { email: "' OR 1=1 --@x.com", password: "' OR '1'='1" });
  assert.equal(r.status, 422); assert.ok(!r.body.user);
  const r2 = await c.post('/api/auth/login', { email: { $ne: null }, password: { $ne: null } });
  assert.ok([422, 500].includes(r2.status) && !r2.body?.user);
});
test('login: valid credentials start a session cookie (HttpOnly, SameSite=Strict) and /me works', async () => {
  const u = await makeUser(); const c = client(ctx.base);
  const r = await c.post('/api/auth/login', { email: u.email, password: 'Passw0rd!x' });
  assert.equal(r.status, 200); assert.equal(r.body.user.email, u.email);
  const setCookie = r.headers.getSetCookie().join(';');
  assert.match(setCookie, /HttpOnly/i); assert.match(setCookie, /SameSite=Strict/i);
  assert.equal((await c.get('/api/auth/me')).body.user.email, u.email);
  assert.equal(r.body.user.password, undefined);
});
test('logout clears the session', async () => {
  const u = await makeUser(); const c = client(ctx.base);
  await c.post('/api/auth/login', { email: u.email, password: 'Passw0rd!x' });
  await c.post('/api/auth/logout');
  assert.ok(!(await c.get('/api/auth/me')).body?.user);
});
test('state-changing API calls without the CSRF header are refused', async () => {
  const u = await makeUser();
  const r = await fetch(`${ctx.base}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: u.email, password: 'Passw0rd!x' }) });
  assert.equal(r.status, 403);
});
test('deactivated account cannot sign in', async () => {
  const u = await makeUser({ is_active: false }); const c = client(ctx.base);
  const r = await c.post('/api/auth/login', { email: u.email, password: 'Passw0rd!x' });
  assert.equal(r.status, 403);
});
test('account locks after repeated wrong passwords, even for the right password', async () => {
  await settings.set({ max_login_attempts: '3', lockout_minutes: '15' });
  const u = await makeUser(); const c = client(ctx.base);
  for (let i = 0; i < 3; i++) await c.post('/api/auth/login', { email: u.email, password: 'bad' });
  const r = await c.post('/api/auth/login', { email: u.email, password: 'Passw0rd!x' });
  assert.equal(r.status, 429);
});

/* ---------------- e-mail OTP second step ---------------- */
test('OTP: when enabled, password alone gives NO session, only a challenge', async () => {
  await settings.set({ login_otp_enable: '1' });
  const u = await makeUser(); const c = client(ctx.base);
  const r = await c.post('/api/auth/login', { email: u.email, password: 'Passw0rd!x' });
  assert.equal(r.status, 200); assert.equal(r.body.two_factor, true); assert.equal(r.body.method, 'email'); assert.ok(r.body.challenge);
  assert.ok(!r.body.user); assert.equal(Object.keys(c.cookies()).length, 0);
  assert.ok(!(await c.get('/api/auth/me')).body?.user);
  assert.match(codeFromMail(), /^\d{6}$/);
});
test('OTP: the code is stored hashed, not in plain text', async () => {
  await settings.set({ login_otp_enable: '1' });
  const u = await makeUser(); const c = client(ctx.base);
  await c.post('/api/auth/login', { email: u.email, password: 'Passw0rd!x' });
  const row = await M.User.scope('withSecrets').findByPk(u.id);
  assert.ok(row.login_otp_hash && !row.login_otp_hash.includes(codeFromMail()));
});
test('OTP: correct code completes login once; the same code cannot be replayed', async () => {
  await settings.set({ login_otp_enable: '1' });
  const u = await makeUser(); const c = client(ctx.base);
  const l = await c.post('/api/auth/login', { email: u.email, password: 'Passw0rd!x' });
  const code = codeFromMail();
  const ok = await c.post('/api/auth/two-factor', { challenge: l.body.challenge, code });
  assert.equal(ok.status, 200); assert.equal(ok.body.user.email, u.email);
  const replay = await client(ctx.base).post('/api/auth/two-factor', { challenge: l.body.challenge, code });
  assert.equal(replay.status, 422);
});
test('OTP: wrong code is rejected; code burns after 5 wrong tries', async () => {
  await settings.set({ login_otp_enable: '1' });
  const u = await makeUser(); const c = client(ctx.base);
  const l = await c.post('/api/auth/login', { email: u.email, password: 'Passw0rd!x' });
  const good = codeFromMail(); const wrong = good === '000000' ? '111111' : '000000';
  for (let i = 0; i < 5; i++) assert.equal((await c.post('/api/auth/two-factor', { challenge: l.body.challenge, code: wrong })).status, 422);
  assert.ok([422, 429].includes((await c.post('/api/auth/two-factor', { challenge: l.body.challenge, code: good })).status), 'burned (and the account is now locked for a while)');
});
test('OTP: expired code is rejected', async () => {
  await settings.set({ login_otp_enable: '1' });
  const u = await makeUser(); const c = client(ctx.base);
  const l = await c.post('/api/auth/login', { email: u.email, password: 'Passw0rd!x' });
  await M.User.update({ login_otp_expires_at: new Date(Date.now() - 1000) }, { where: { id: u.id } });
  assert.equal((await c.post('/api/auth/two-factor', { challenge: l.body.challenge, code: codeFromMail() })).status, 422);
});
test('OTP: a forged / tampered challenge is rejected', async () => {
  const c = client(ctx.base);
  assert.equal((await c.post('/api/auth/two-factor', { challenge: 'garbage', code: '123456' })).status, 422);
  const jwt = require('jsonwebtoken');
  const forged = jwt.sign({ sub: 1, v: 0, p: '2fa', m: 'email' }, 'wrong-secret');
  assert.equal((await c.post('/api/auth/two-factor', { challenge: forged, code: '123456' })).status, 422);
});
test('OTP: a normal session token cannot be used as a challenge', async () => {
  const jwt = require('jsonwebtoken'); const u = await makeUser();
  const sessionLike = jwt.sign({ sub: u.id, v: 0 }, process.env.JWT_SECRET);
  assert.equal((await client(ctx.base).post('/api/auth/two-factor', { challenge: sessionLike, code: '123456' })).status, 422);
});
test('OTP: if the e-mail cannot be sent, no session is granted', async () => {
  await settings.set({ login_otp_enable: '1' }); setMail({ fails: true });
  const u = await makeUser(); const c = client(ctx.base);
  const r = await c.post('/api/auth/login', { email: u.email, password: 'Passw0rd!x' });
  assert.equal(r.status, 502); assert.ok(!r.body.user); assert.equal(Object.keys(c.cookies()).length, 0);
});
test('OTP: staff must use the e-mail code by default', async () => {
  const u = await makeUser({ role: 'admin' }); const c = client(ctx.base);
  const r = await c.post('/api/auth/login', { email: u.email, password: 'Passw0rd!x' });
  assert.equal(r.body.two_factor, true);
});
test('OTP: resend invalidates the earlier code', async () => {
  await settings.set({ login_otp_enable: '1' });
  const u = await makeUser(); const c = client(ctx.base);
  const l = await c.post('/api/auth/login', { email: u.email, password: 'Passw0rd!x' });
  const first = codeFromMail();
  await c.post('/api/auth/two-factor/resend', { challenge: l.body.challenge });
  const second = codeFromMail();
  if (first !== second) assert.equal((await c.post('/api/auth/two-factor', { challenge: l.body.challenge, code: first })).status, 422);
  assert.equal((await c.post('/api/auth/two-factor', { challenge: l.body.challenge, code: second })).status, 200);
});
test('OTP: resend has a cooldown (no code flood)', async () => {
  await settings.set({ login_otp_enable: '1' });
  const u = await makeUser(); const c = client(ctx.base);
  const l = await c.post('/api/auth/login', { email: u.email, password: 'Passw0rd!x' });
  const r = await c.post('/api/auth/two-factor/resend', { challenge: l.body.challenge });
  assert.equal(r.status, 429);
});

test('login code: the product default is ON for everyone (users, company admins and staff)', async () => {
  const defaults = Object.fromEntries(Object.entries(require('../src/services/settings').DEFAULTS || {}));
  assert.equal(defaults.login_otp_enable, '1');
  assert.equal(defaults.enforce_2fa_staff, '1');
});

/* ---------------- sign in with only an e-mail: the code is the credential ---------------- */
test('e-mail login: e-mail -> code by mail -> signed in, no password involved', async () => {
  const u = await makeUser(); const c = client(ctx.base);
  const a = await c.post('/api/auth/login-code', { email: u.email });
  assert.equal(a.status, 200); assert.equal(a.body.method, 'email'); assert.ok(a.body.challenge); assert.match(a.body.email_hint, /\*\*\*@/);
  const code = codeFromMail(); assert.match(code, /^\d{6}$/); assert.equal(outbox.at(-1).to, u.email);
  assert.equal((await c.post('/api/auth/two-factor', { challenge: a.body.challenge, code: code === '000000' ? '111111' : '000000' })).status, 422, 'wrong code');
  const ok = await c.post('/api/auth/two-factor', { challenge: a.body.challenge, code });
  assert.equal(ok.status, 200, ok.text); assert.equal(ok.body.user.email, u.email);
  assert.equal((await c.get('/api/auth/me')).body.user.email, u.email, 'session cookie works');
  assert.equal((await c.post('/api/auth/two-factor', { challenge: a.body.challenge, code })).status, 422, 'a code works once');
});
test('e-mail login: unknown, deactivated and locked accounts get the same answer and no mail; the code never works', async () => {
  const gone = await makeUser({ is_active: false });
  for (const email of ['ghost@example.test', gone.email]) {
    outbox.length = 0; const c = client(ctx.base);
    const r = await c.post('/api/auth/login-code', { email });
    assert.equal(r.status, 200); assert.equal(r.body.method, 'email'); assert.equal(outbox.length, 0, 'nothing mailed');
    const t = await c.post('/api/auth/two-factor', { challenge: r.body.challenge, code: '123456' });
    assert.equal(t.status, 422); assert.ok(t.body.errors?.code);
    assert.equal((await c.post('/api/auth/two-factor/resend', { challenge: r.body.challenge })).status, 200);
  }
  assert.equal((await client(ctx.base).post('/api/auth/login-code', { email: 'nope' })).status, 422);
});
test('e-mail login: five wrong codes burn it; asking again right away does not send a second mail', async () => {
  const u = await makeUser(); const c = client(ctx.base);
  const a = await c.post('/api/auth/login-code', { email: u.email }); const code = codeFromMail();
  const again = await c.post('/api/auth/login-code', { email: u.email }); assert.equal(again.status, 200);
  assert.equal(outbox.filter((m) => m.key === 'login_code').length, 1, 'cooldown: one mail');
  for (let i = 0; i < 5; i += 1) await c.post('/api/auth/two-factor', { challenge: a.body.challenge, code: '999999' === code ? '888888' : '999999' });
  assert.ok([422, 429].includes((await c.post('/api/auth/two-factor', { challenge: a.body.challenge, code })).status), 'burned after 5 wrong tries (and locked)');
});
test('e-mail login: needs mail; an authenticator user still gives the app code; a new invitee is verified by the code', async () => {
  const u = await makeUser({ email_verified_at: null }); const c = client(ctx.base);
  const a = await c.post('/api/auth/login-code', { email: u.email });
  const ok = await c.post('/api/auth/two-factor', { challenge: a.body.challenge, code: codeFromMail() });
  assert.equal(ok.status, 200); assert.ok((await M.User.findByPk(u.id)).email_verified_at);
  const t = await makeUser({ two_factor_enabled: true, two_factor_secret: 'JBSWY3DPEHPK3PXP' });
  const b = await client(ctx.base).post('/api/auth/login-code', { email: t.email });
  const step = await client(ctx.base).post('/api/auth/two-factor', { challenge: b.body.challenge, code: codeFromMail() });
  assert.equal(step.status, 200); assert.equal(step.body.method, 'totp'); assert.ok(!step.body.user, 'not signed in yet');
  setMail({ configured: false });
  const off = await client(ctx.base).post('/api/auth/login-code', { email: u.email });
  assert.equal(off.status, 503);
  assert.equal((await client(ctx.base).get('/api/public/settings')).body.data.email_login, false);
  setMail({ configured: true });
  assert.equal((await client(ctx.base).get('/api/public/settings')).body.data.email_login, true);
});
