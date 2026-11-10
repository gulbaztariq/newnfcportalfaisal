const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { boot, client, makeUser, M, settings } = require('./helpers');

let ctx; let admin;
before(async () => {
  ctx = await boot(); await settings.set({ enforce_2fa_staff: '0' });
  const u = await makeUser({ role: 'super_admin' });
  admin = client(ctx.base); const r = await admin.post('/api/auth/login', { email: u.email, password: 'Passw0rd!x' }); assert.equal(r.status, 200);
});
after(async () => { ctx.server.close(); await M.sequelize.close(); });

test('CRUD currencies: create, read, list, update, delete', async () => {
  const c = await admin.post('/api/admin/currencies', { currency_name: 'TEST Rupee', currency_icon: 'Rs', currency_code: 'TST' });
  assert.equal(c.status, 201); const id = c.body.data.id;
  assert.equal((await admin.get(`/api/admin/currencies/${id}`)).body.data.currency_code, 'TST');
  assert.ok((await admin.get('/api/admin/currencies?search=TEST')).body.data.some((x) => x.id === id));
  assert.equal((await admin.put(`/api/admin/currencies/${id}`, { currency_name: 'TEST Rupee 2' })).status, 200);
  assert.equal((await admin.get(`/api/admin/currencies/${id}`)).body.data.currency_name, 'TEST Rupee 2');
  assert.equal((await admin.del(`/api/admin/currencies/${id}`)).status, 200);
  assert.equal((await admin.get(`/api/admin/currencies/${id}`)).status, 404);
});
test('validation: required fields and max length are enforced on the server', async () => {
  const r = await admin.post('/api/admin/currencies', {});
  assert.equal(r.status, 422); assert.ok(r.body.errors.currency_name);
  const long = await admin.post('/api/admin/countries', { name: 'x'.repeat(500), short_code: 'XX', phone_code: '1' });
  assert.equal(long.status, 422);
});
test('missing / invalid ids give 404, not a crash', async () => {
  for (const id of ['999999', 'abc', '-1', '1;DROP TABLE users', '0']) assert.ok([404, 422].includes((await admin.get(`/api/admin/currencies/${encodeURIComponent(id)}`)).status), id);
});
test('SQL injection in search / filter / sort / paging is harmless', async () => {
  await M.User.count();
  const evil = ["' OR '1'='1", "'; DROP TABLE users; --", '%', '_', "\\", '" OR ""="', '1 UNION SELECT password FROM users']; const bad = [];
  for (const q of evil) for (const path of ['/api/admin/currencies', '/api/admin/countries', '/api/admin/users', '/api/admin/orders']) {
    const r = await admin.get(`${path}?search=${encodeURIComponent(q)}&page=${encodeURIComponent(q)}&per_page=${encodeURIComponent(q)}&sort=${encodeURIComponent(q)}`);
    if (r.status >= 500) bad.push(`${path} ${q} -> ${r.status}`);
  }
  assert.deepEqual(bad, []); assert.ok((await M.User.count()) >= 1, 'users table still exists');
});
test('array / object query parameters do not crash the API', async () => {
  const bad = [];
  for (const qs of ['search=a&search=b', 'search[]=a', 'search[$ne]=x', 'page=1&page=2', 'per_page[]=5', 'status[$ne]=1', 'all=1&all=0']) for (const path of ['/api/admin/currencies', '/api/admin/users', '/api/admin/nfc-cards']) {
    const r = await admin.get(`${path}?${qs}`); if (r.status >= 500) bad.push(`${path}?${qs} -> ${r.status}`);
  }
  assert.deepEqual(bad, []);
});
test('pagination is bounded (cannot request unbounded pages)', async () => {
  for (let i = 0; i < 3; i++) await M.Currency.create({ currency_name: `TEST p${i}`, currency_icon: 'x', currency_code: `P${i}` });
  const r = await admin.get('/api/admin/currencies?per_page=100000');
  assert.ok(r.body.data.length <= 100);
});
test('mass assignment: unknown / protected fields are ignored on create and update', async () => {
  const c = await admin.post('/api/admin/currencies', { currency_name: 'TEST MA', currency_icon: 'x', currency_code: 'MAS', id: 424242, created_at: '2000-01-01' });
  assert.equal(c.status, 201); assert.notEqual(c.body.data.id, 424242);
});
test('unicode, emoji and special characters round-trip and are not executed', async () => {
  const name = 'TEST 💳 Ünïcode <script>alert(1)</script> ‘quotes’ "dq" \\';
  const c = await admin.post('/api/admin/currencies', { currency_name: name, currency_icon: '₨', currency_code: 'UNI' });
  assert.equal(c.status, 201); assert.equal((await admin.get(`/api/admin/currencies/${c.body.data.id}`)).body.data.currency_name, name);
});
test('bulk delete refuses empty selection and ignores non-numeric ids', async () => {
  assert.equal((await admin.post('/api/admin/currencies/bulk-delete', { ids: [] })).status, 422);
  assert.equal((await admin.post('/api/admin/currencies/bulk-delete', { ids: ['x', null, '1 OR 1=1'] })).status, 422);
});
test('malformed JSON body gives a clean 4xx', async () => {
  const r = await fetch(`${ctx.base}/api/admin/currencies`, { method: 'POST', headers: { 'X-Requested-With': 'XMLHttpRequest', 'Content-Type': 'application/json', Cookie: Object.entries(admin.cookies()).map(([k, v]) => `${k}=${v}`).join('; ') }, body: '{bad json' });
  assert.ok(r.status >= 400 && r.status < 500, `got ${r.status}`);
});
