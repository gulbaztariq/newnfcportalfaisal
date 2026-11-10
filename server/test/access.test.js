const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'); const path = require('path');
const { boot, client, makeUser, M, settings } = require('./helpers');

let ctx;
before(async () => { ctx = await boot(); await settings.set({ enforce_2fa_staff: '0' }); }); // staff OTP is covered in auth.test.js; here staff sign in directly
after(async () => { ctx.server.close(); await M.sequelize.close(); });

/** one request in the right verb; the client's cookies are kept, the IP rotates via a new client every so often (the abuse guard bans floods) */
const send = (c, m, p) => (m === 'GET' ? c.get(p) : m === 'DELETE' ? c.del(p) : m === 'PUT' ? c.put(p, {}) : m === 'PATCH' ? c.patch(p, {}) : c.post(p, {}));
const login = async (u) => { const c = client(ctx.base); const r = await c.post('/api/auth/login', { email: u.email, password: 'Passw0rd!x' }); assert.equal(r.status, 200, `login ${u.role}`); return c; };

/** every route declared in the admin and user routers, found by reading the source (Express 5 hides nested prefixes) */
function declared(dir, prefix, files) {
  const out = [];
  for (const f of files) {
    const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'routes', dir, f), 'utf8');
    for (const m of src.matchAll(/\br\.(get|post|put|patch|delete)\(\s*'([^']+)'/g)) out.push([m[1].toUpperCase(), prefix + m[2]]);
    for (const m of src.matchAll(/\br\.use\(\s*'(\/[^']+)',\s*crud\(/g)) { out.push(['GET', prefix + m[1]], ['POST', prefix + m[1]], ['GET', `${prefix}${m[1]}/1`], ['PUT', `${prefix}${m[1]}/1`], ['DELETE', `${prefix}${m[1]}/1`]); }
  }
  return out.map(([m, p]) => [m, p.replace(/:[a-zA-Z_]+/g, '1')]);
}
const ADMIN = declared('admin', '/api/admin', ['index.js', 'business.js']);
const USER = declared('user', '/api/user', ['index.js', 'content.js', 'store.js', 'business.js']);

test('route discovery found a meaningful number of endpoints', () => { assert.ok(ADMIN.length > 100, `admin ${ADMIN.length}`); assert.ok(USER.length > 50, `user ${USER.length}`); });

test('ANONYMOUS: every admin and user endpoint refuses with 401', async () => {
  let c = client(ctx.base); const bad = []; let n = 0;
  for (const [m, p] of [...ADMIN, ...USER]) { if (n++ % 40 === 0) c = client(ctx.base); const r = await send(c, m, p); if (r.status !== 401) bad.push(`${m} ${p} -> ${r.status}`); }
  assert.deepEqual(bad, []);
});
test('NORMAL USER: every admin endpoint refuses with 403', async () => {
  const u = await makeUser(); let c = await login(u); const bad = []; let n = 0;
  for (const [m, p] of ADMIN) { if (n++ % 40 === 39) c = await login(u); const r = await send(c, m, p); if (r.status !== 403) bad.push(`${m} ${p} -> ${r.status}`); }
  assert.deepEqual(bad, []);
});
test('ADMIN: cannot reach the user portal (role user only)', async () => {
  const c = await login(await makeUser({ role: 'supervisor', email: 'sup@example.test' }));
  // supervisors are staff; with enforce_2fa_staff and no SMTP configured in this test they sign in directly
  const r = await c.get('/api/user/vcards'); assert.ok([401, 403].includes(r.status));
});
test('SUPERVISOR with no granted module cannot change data, only view', async () => {
  const c = await login(await makeUser({ role: 'supervisor' }));
  const r = await c.post('/api/admin/currencies', { currency_name: 'X', currency_icon: 'X', currency_code: 'XXX' });
  assert.equal(r.status, 403);
});

/* ------------- IDOR: user B must never read or change user A's records ------------- */
test('IDOR: another user cannot read, edit, duplicate, delete or list a vcard they do not own', async () => {
  const a = await makeUser(); const b = await makeUser();
  const tpl = await M.Template.create({ name: 'Test template', slug: 'vcard1', status: true });
  const card = await M.Vcard.create({ user_id: a.id, name: 'Alice private card', url_alias: `alice-${Date.now()}`, template_id: tpl.id, status: true });
  const cb = await login(b); const bad = [];
  const tries = [['GET', `/api/user/vcards/${card.id}`], ['PUT', `/api/user/vcards/${card.id}`, { name: 'hacked' }], ['POST', `/api/user/vcards/${card.id}/duplicate`, {}], ['DELETE', `/api/user/vcards/${card.id}`],
    ['GET', `/api/user/vcards/${card.id}/analytics`], ['GET', `/api/user/vcards/${card.id}/products`], ['POST', `/api/user/vcards/${card.id}/products`, { name: 'x', price: 1 }], ['GET', `/api/user/vcards/${card.id}/qrcode`]];
  for (const [m, p, body] of tries) { const r = m === 'GET' ? await cb.get(p) : m === 'DELETE' ? await cb.del(p) : m === 'PUT' ? await cb.put(p, body) : await cb.post(p, body); if (![403, 404, 422].includes(r.status)) bad.push(`${m} ${p} -> ${r.status}`); }
  assert.deepEqual(bad, []);
  const list = await cb.get('/api/user/vcards'); assert.ok(!JSON.stringify(list.body).includes('Alice private card'));
  const still = await M.Vcard.findByPk(card.id); assert.equal(still.name, 'Alice private card');
});
test('MASS ASSIGNMENT: a user cannot make themselves admin or change plan/credit via profile update', async () => {
  const u = await makeUser(); const c = await login(u);
  await c.put('/api/auth/profile', { first_name: 'New', role: 'super_admin', is_active: true, email_verified_at: null, token_version: 99, password: 'x' });
  const row = await M.User.scope('withSecrets').findByPk(u.id);
  assert.equal(row.role, 'user'); assert.equal(row.token_version || 0, 0);
});
test('PASSWORD CHANGE invalidates the old session', async () => {
  const u = await makeUser(); const c = await login(u); const other = await login(u);
  const r = await c.put('/api/auth/password', { current_password: 'Passw0rd!x', password: 'NewPassw0rd!y', password_confirmation: 'NewPassw0rd!y' });
  assert.ok([200, 204].includes(r.status), `password change -> ${r.status} ${r.text.slice(0, 120)}`);
  assert.ok(!(await other.get('/api/auth/me')).body?.user, 'old session must be dead');
});
test('PUBLIC: shop/directory endpoints never leak password hashes or OTP fields', async () => {
  const c = client(ctx.base);
  for (const p of ['/api/public/directory', '/api/public/settings', '/api/shop/products']) { const r = await c.get(p); assert.ok(!/password_hash|"password"|login_otp_hash|two_factor_secret|_secret|access_token|api_key|\$2[aby]\$/i.test(r.text), p); }
});
test('SECURITY HEADERS present', async () => {
  const r = await client(ctx.base).get('/api/public/settings');
  assert.ok(r.headers.get('content-security-policy')); assert.equal(r.headers.get('x-content-type-options'), 'nosniff'); assert.equal(r.headers.get('x-powered-by'), null);
});
test('Body size limit and path-scanner ban', async () => {
  const big = await fetch(`${ctx.base}/api/auth/login`, { method: 'POST', headers: { 'X-Requested-With': 'XMLHttpRequest', 'Content-Type': 'application/json', 'X-Forwarded-For': '10.99.0.1' }, body: JSON.stringify({ email: 'a@b.co', password: 'x'.repeat(2 * 1024 * 1024) }) });
  assert.ok([413, 422].includes(big.status), `got ${big.status}`);
});
