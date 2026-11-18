/* QA report M4 / M27: every admin change is written to the activity log, without secrets. */
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { boot, client, makeUser, settings, M } = require('./helpers');

let ctx; let a; let sa;
before(async () => {
  ctx = await boot(); await settings.set({ enforce_2fa_staff: '0' });
  sa = await makeUser({ role: 'super_admin' }); a = client(ctx.base); assert.equal((await a.post('/api/auth/login', { email: sa.email, password: 'Passw0rd!x' })).status, 200);
});
after(async () => { ctx.server.close(); await M.sequelize.close(); });
const last = async (action) => { await new Promise((r) => setTimeout(r, 120)); return M.ActivityLog.findOne({ where: { action }, order: [['id', 'DESC']] }); };

test('inventory, finance, vendors, coupons, products and settings changes all appear in the log with the actor and values', async () => {
  const it = (await a.post('/api/admin/inventory/items', { name: 'Logged chip', purchase_price: 5, opening_stock: 10 })).body.data;
  let l = await last('inventory.items.create'); assert.ok(l, 'item create'); assert.equal(l.user_id, sa.id); assert.equal(l.meta.values.name, 'Logged chip');
  await a.post('/api/admin/inventory/adjust', { inventory_item_id: it.id, quantity: -3, type: 'adjustment' });
  l = await last('inventory.adjust'); assert.ok(l, 'adjust'); assert.equal(l.meta.values.quantity, '-3');
  await a.post('/api/admin/vendors', { name: 'LogVendor' }); assert.ok(await last('vendors.create'));
  await a.post('/api/admin/coupon-codes', { coupon_name: 'LOGME', type: 'fixed', discount: 5, status: true }); assert.ok(await last('coupon-codes.create'));
  const p = (await a.post('/api/admin/nfc-cards', { name: 'Logged product', price: 10 })).body.data; await a.del(`/api/admin/nfc-cards/${p.id}`);
  l = await last('nfc-cards.delete'); assert.ok(l); assert.equal(l.entity_id, p.id);
  await a.put('/api/admin/settings', { shop_min_order: '50', stripe_secret: 'sk_live_TOPSECRET' });
  l = await last('settings.update'); assert.ok(l, 'settings'); assert.ok(l.meta.changed.includes('shop_min_order')); assert.ok(!JSON.stringify(l.meta).includes('TOPSECRET'), 'secrets never reach the log'); assert.ok(!l.meta.changed.includes('stripe_secret'));
  await new Promise((r) => setTimeout(r, 150)); const failed = await a.post('/api/admin/inventory/adjust', { inventory_item_id: it.id, quantity: -999, type: 'adjustment' }); assert.equal(failed.status, 422);
  await new Promise((r) => setTimeout(r, 150)); assert.equal(await M.ActivityLog.count({ where: { action: 'inventory.adjust' } }), 1, 'a refused change is not logged as done');
});

test('a change that already writes its own detailed entry is not logged twice', async () => {
  await new Promise((r) => setTimeout(r, 200)); const before = await M.ActivityLog.count();
  const u = await a.post('/api/admin/users', { first_name: 'Log', email: `log_${Date.now()}@example.test`, password: 'Secret12', password_confirmation: 'Secret12' }); assert.equal(u.status, 201);
  await new Promise((r) => setTimeout(r, 200)); const mine = await M.ActivityLog.count({ where: { action: 'user.create' } }); assert.equal(mine, 1); assert.equal(await M.ActivityLog.count({ where: { action: 'users.create' } }), 0);
  assert.ok((await M.ActivityLog.count()) - before <= 2);
});
