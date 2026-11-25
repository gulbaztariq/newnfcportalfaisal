/* What super admins do is logged with their e-mail and shown only to super admins. */
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { boot, client, makeUser, settings, M, setMail } = require('./helpers');

let ctx; let sa; let ad; let sac; let adc; let target;
before(async () => {
  ctx = await boot(); setMail({ configured: true, fails: false });
  await settings.set({ login_otp_enable: '0', enforce_2fa_staff: '0', require_totp_staff: '0', max_login_attempts: '50' });
  sa = await makeUser({ role: 'super_admin' }); ad = await makeUser({ role: 'admin' }); target = await makeUser({});
  sac = client(ctx.base); await sac.post('/api/auth/login', { email: sa.email, password: 'Passw0rd!x' });
  adc = client(ctx.base); await adc.post('/api/auth/login', { email: ad.email, password: 'Passw0rd!x' });
});
after(async () => { ctx.server.close(); await M.sequelize.close(); });

test('a super admin action is stored with the e-mail and role of who did it', async () => {
  const r = await sac.put(`/api/admin/users/${target.id}`, { first_name: 'Changed', last_name: 'User', email: target.email });
  assert.equal(r.status, 200, r.text);
  const row = await M.ActivityLog.findOne({ where: { action: 'user.update', user_id: sa.id }, order: [['id', 'DESC']] });
  assert.equal(row.actor_email, sa.email); assert.equal(row.actor_role, 'super_admin');
});

test('super admins see the log; admins and customers cannot open it', async () => {
  const ok = await sac.get('/api/admin/super-admin-log');
  assert.equal(ok.status, 200, ok.text);
  assert.ok(ok.body.data.some((l) => l.actor_email === sa.email && l.action === 'user.update'));
  assert.equal((await adc.get('/api/admin/super-admin-log')).status, 403);
  const cc = client(ctx.base); await cc.post('/api/auth/login', { email: target.email, password: 'Passw0rd!x' });
  assert.ok([401, 403].includes((await cc.get('/api/admin/super-admin-log')).status));
});

test('the ordinary activity list hides super admin rows from other staff but not from super admins', async () => {
  const forAdmin = await adc.get('/api/admin/activity-logs?per_page=100');
  assert.equal(forAdmin.status, 200, forAdmin.text);
  assert.ok(!forAdmin.body.data.some((l) => l.actor_email === sa.email || l.user?.email === sa.email), 'admin must not see super admin rows');
  const forSuper = await sac.get('/api/admin/activity-logs?per_page=100');
  assert.ok(forSuper.body.data.some((l) => l.actor_email === sa.email));
});

test('a log entry keeps its actor even after that account is demoted', async () => {
  await M.User.update({ role: 'user' }, { where: { id: sa.id } });
  await M.User.update({ role: 'super_admin' }, { where: { id: ad.id } });
  const sac2 = client(ctx.base); await sac2.post('/api/auth/login', { email: ad.email, password: 'Passw0rd!x' });
  const l = await sac2.get('/api/admin/super-admin-log');
  assert.equal(l.status, 200, l.text);
  assert.ok(l.body.data.some((x) => x.actor_email === sa.email), 'old super admin entries still listed by e-mail');
});
