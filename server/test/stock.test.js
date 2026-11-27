/* Sellable stock like WooCommerce: a product (or each variation) counts its pieces; orders take them off, cancelling gives them back */
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { boot, client, makeUser, M, settings } = require('./helpers');

let ctx; let admin; let seq = 0;
before(async () => {
  ctx = await boot(); await settings.set({ enforce_2fa_staff: '0' });
  const u = await makeUser({ role: 'super_admin' }); admin = client(ctx.base);
  assert.equal((await admin.post('/api/auth/login', { email: u.email, password: 'Passw0rd!x' })).status, 200);
});
after(async () => { ctx.server.close(); await M.sequelize.close(); });

const order = (items) => admin.post('/api/admin/orders', { name: 'Walk In', phone: '03001234567', address: 'Shop 1', city: 'Karachi', customer_type: 'guest', order_type: 'nfc_profile', items });
const fresh = (id) => M.NfcCard.findByPk(id);
const make = async (body) => { const r = await admin.post('/api/admin/nfc-cards', { name: `Stock p${++seq}`, price: 1000, ...body }); assert.equal(r.status, 201, r.text); return r.body.data; };

test('a simple product: orders take pieces off, too many is refused, cancel gives them back, every change is logged', async () => {
  const p = await make({ manage_stock: true, stock_qty: 5, low_stock_threshold: 1 });
  assert.equal((await order([{ product_id: p.id, quantity: 6 }])).status, 422, 'more than in stock');
  assert.equal((await fresh(p.id)).stock_qty, 5, 'a refused order changes nothing');
  const ok = await order([{ product_id: p.id, quantity: 3 }]); assert.equal(ok.status, 201, ok.text);
  assert.equal((await fresh(p.id)).stock_qty, 2);
  assert.equal((await order([{ product_id: p.id, quantity: 3 }])).status, 422, 'only 2 left');
  assert.equal((await admin.patch(`/api/admin/orders/${ok.body.data.id}`, { order_status: 'cancelled' })).status, 200);
  assert.equal((await fresh(p.id)).stock_qty, 5, 'cancelled: pieces are back');
  const log = (await admin.get(`/api/admin/nfc-cards/${p.id}/stock-log`)).body.data;
  assert.deepEqual(log.map((x) => [x.reason, x.change, x.balance]).reverse(), [['set', 5, 5], ['order', -3, 2], ['cancel', 3, 5]]);
});

test('variations count their own stock; a disabled variation cannot be ordered; backorders keep selling', async () => {
  const p = await make({ manage_stock: true, variants: JSON.stringify([{ name: 'Black / PVC', sku: 'bp-1', price_delta: 0, stock: 2 }, { name: 'White / Metal', price_delta: 500, stock: 10 }, { name: 'Gold / Wood', stock: 9, enabled: false }]) });
  assert.equal((await order([{ product_id: p.id, quantity: 3, variant: 'Black / PVC' }])).status, 422);
  assert.equal((await order([{ product_id: p.id, quantity: 2, variant: 'Black / PVC' }])).status, 201);
  let vs = (await fresh(p.id)).variants; assert.equal(vs.find((v) => v.name === 'Black / PVC').stock, 0); assert.equal(vs.find((v) => v.name === 'White / Metal').stock, 10, 'other variations untouched');
  assert.equal(vs[0].sku, 'BP-1');
  assert.equal((await order([{ product_id: p.id, quantity: 1, variant: 'Gold / Wood' }])).status, 422, 'a disabled variation is not for sale');
  assert.equal((await admin.put(`/api/admin/nfc-cards/${p.id}`, { allow_backorder: '1' })).status, 200);
  assert.equal((await order([{ product_id: p.id, quantity: 4, variant: 'Black / PVC' }])).status, 201, 'backorder allowed');
  vs = (await fresh(p.id)).variants; assert.equal(vs.find((v) => v.name === 'Black / PVC').stock, -4);
  assert.equal((await admin.put(`/api/admin/nfc-cards/${p.id}`, { variants: JSON.stringify([{ name: 'A', stock: 1 }, { name: 'a', stock: 1 }]) })).status, 422, 'duplicate variation names');
});

test('manual stock changes: add, remove, count again; never below zero; products without stock management say so', async () => {
  const p = await make({ manage_stock: true, stock_qty: 4 });
  assert.equal((await admin.post(`/api/admin/nfc-cards/${p.id}/stock`, { change: 6, note: 'New delivery' })).status, 200); assert.equal((await fresh(p.id)).stock_qty, 10);
  assert.equal((await admin.post(`/api/admin/nfc-cards/${p.id}/stock`, { change: -11 })).status, 422);
  assert.equal((await admin.post(`/api/admin/nfc-cards/${p.id}/stock`, { set: 7 })).status, 200); assert.equal((await fresh(p.id)).stock_qty, 7);
  assert.equal((await admin.post(`/api/admin/nfc-cards/${p.id}/stock`, {})).status, 422);
  const plain = await make({});
  assert.equal((await admin.post(`/api/admin/nfc-cards/${plain.id}/stock`, { change: 1 })).status, 422);
  assert.equal((await order([{ product_id: plain.id, quantity: 500 }])).status, 201, 'not managed = unlimited');
});

test('the last piece goes to one order only', async () => {
  const p = await make({ manage_stock: true, stock_qty: 1 });
  assert.equal((await order([{ product_id: p.id, quantity: 1 }])).status, 201);
  assert.equal((await order([{ product_id: p.id, quantity: 1 }])).status, 422); assert.equal((await fresh(p.id)).stock_qty, 0);
});
