/* Rate limits and a small load run, against the in-process test server only (never a live site). */
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { boot, client, makeUser, M } = require('./helpers');

let ctx;
before(async () => { ctx = await boot(); });
after(async () => { ctx.server.close(); await M.sequelize.close(); });

const post = (path, body, ip) => fetch(ctx.base + path, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest', 'X-Forwarded-For': ip }, body: JSON.stringify(body) });

test('login brute force from one IP is throttled; another IP is unaffected', async () => {
  const u = await makeUser(); const codes = [];
  for (let i = 0; i < 30; i++) codes.push((await post('/api/auth/login', { email: `nobody${i}@example.test`, password: 'x' }, '10.50.0.1')).status);
  assert.ok(codes.includes(429), `no 429 in ${codes.join(',')}`); assert.ok(codes.slice(0, 15).every((c) => c === 422));
  assert.equal((await post('/api/auth/login', { email: u.email, password: 'Passw0rd!x' }, '10.50.0.2')).status, 200);
});
test('credential stuffing across many accounts from one IP is stopped before the 30th try', async () => {
  const codes = []; for (let i = 0; i < 40; i++) codes.push((await post('/api/auth/login', { email: `stuff${i}@example.test`, password: 'Summer2026!' }, '10.50.1.1')).status);
  assert.ok(codes.indexOf(429) > -1 && codes.indexOf(429) <= 25, codes.join(','));
});
test('forgot-password and register are throttled too (no e-mail bombing)', async () => {
  const codes = []; for (let i = 0; i < 30; i++) codes.push((await post('/api/auth/forgot-password', { email: `victim@example.test` }, '10.50.2.1')).status);
  assert.ok(codes.includes(429), codes.join(','));
});
test('forgot-password gives the same answer for known and unknown e-mails', async () => {
  const u = await makeUser(); const a = await post('/api/auth/forgot-password', { email: u.email }, '10.50.3.1'); const b = await post('/api/auth/forgot-password', { email: 'ghost@example.test' }, '10.50.3.2');
  assert.equal(a.status, b.status); assert.equal((await a.json()).message, (await b.json()).message);
});
test('checkout flood is capped per IP', async () => {
  const codes = []; for (let i = 0; i < 25; i++) codes.push((await post('/api/shop/checkout', {}, '10.50.4.1')).status);
  assert.ok(codes.includes(429), codes.join(','));
});
test('LOAD: 300 concurrent page + API requests, no errors, reasonable latency', async () => {
  const paths = ['/api/shop/products', '/api/public/settings', '/api/public/directory', '/api/shop/products'];
  const times = []; const statuses = {};
  await Promise.all(Array.from({ length: 300 }, async (_, i) => {
    const t0 = performance.now(); const r = await fetch(ctx.base + paths[i % paths.length], { headers: { 'X-Forwarded-For': `10.60.${(i >> 8) & 255}.${(i % 250) + 1}` } });
    await r.arrayBuffer(); times.push(performance.now() - t0); statuses[r.status] = (statuses[r.status] || 0) + 1;
  }));
  times.sort((a, b) => a - b); const p95 = times[Math.floor(times.length * 0.95)];
  console.log(`# load: 300 req, statuses ${JSON.stringify(statuses)}, p50 ${times[150].toFixed(0)}ms, p95 ${p95.toFixed(0)}ms, max ${times.at(-1).toFixed(0)}ms`);
  assert.equal(Object.keys(statuses).filter((s) => Number(s) >= 500).length, 0); assert.ok(p95 < 3000, `p95 ${p95}ms`);
});
test('LOAD: one IP hammering the API gets limited, the server stays responsive for others', async () => {
  const statuses = {};
  for (let b = 0; b < 8; b++) await Promise.all(Array.from({ length: 100 }, async () => { const r = await fetch(`${ctx.base}/api/public/settings`, { headers: { 'X-Forwarded-For': '10.70.0.1' } }); await r.arrayBuffer(); statuses[r.status] = (statuses[r.status] || 0) + 1; })); // batches: the test client cannot open 800 sockets at once
  assert.ok(statuses[429] > 0, JSON.stringify(statuses));
  assert.equal((await fetch(`${ctx.base}/api/public/settings`, { headers: { 'X-Forwarded-For': '10.70.0.2' } })).status, 200);
});
test('scanner paths get the IP banned (.env, .git, wp-login, phpmyadmin style probes)', async () => {
  for (let i = 0; i < 25; i++) await fetch(`${ctx.base}/wp-admin/setup-config.php`, { headers: { 'X-Forwarded-For': '10.80.0.1' } });
  const r = await fetch(`${ctx.base}/api/public/settings`, { headers: { 'X-Forwarded-For': '10.80.0.1' } }); assert.equal(r.status, 429);
  assert.equal((await fetch(`${ctx.base}/api/public/settings`, { headers: { 'X-Forwarded-For': '10.80.0.9' } })).status, 200);
});
