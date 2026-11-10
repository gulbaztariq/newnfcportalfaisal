const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { boot, client, makeUser, outbox, M, settings } = require('./helpers');
const orders = require('../src/services/orders');

let ctx; let seq = 0;
before(async () => { ctx = await boot(); });
after(async () => { ctx.server.close(); await M.sequelize.close(); });
beforeEach(async () => { await settings.set({ delivery_charges: '149', free_delivery_above: '0', cod_charges: '0', cod_enable: '1', nfc_tax_rate: '0', shop_min_order: '0', register_enable: '1', shop_enable: '1' }); });

const product = (over = {}) => M.NfcCard.create({ name: `TEST card ${++seq}`, slug: `test-card-${seq}-${Date.now()}`, price: 1000, status: true, show_in_shop: true, product_kind: 'nfc_profile', ...over });
const cust = (over = {}) => ({ name: 'Ali Khan', phone: '03001234567', email: `buyer${++seq}@example.test`, address: 'House 1, Street 2', city: 'Lahore', is_cod: true, ...over });

/* ------------------------------------------------ pricing rules (unit) */
test('quote: price x quantity plus delivery', async () => {
  const p = await product(); const q = await orders.quote([{ product_id: p.id, quantity: 3 }]);
  assert.equal(q.subtotal, 3000); assert.equal(q.delivery, 149); assert.equal(q.total, 3149);
});
test('quote: free delivery above threshold, COD charge added only for physical COD orders', async () => {
  await settings.set({ free_delivery_above: '2000', cod_charges: '50' }); const p = await product();
  const a = await orders.quote([{ product_id: p.id, quantity: 2 }], { is_cod: true }); assert.equal(a.delivery, 0); assert.equal(a.cod, 50); assert.equal(a.total, 2050);
  const b = await orders.quote([{ product_id: p.id, quantity: 1 }], { is_cod: true }); assert.equal(b.delivery, 149);
});
test('quote: product discount percent and fixed', async () => {
  const a = await product({ discount_type: 'percent', discount_value: 20 }); const b = await product({ discount_type: 'fixed', discount_value: 300 });
  assert.equal((await orders.quote([{ product_id: a.id, quantity: 1 }])).subtotal, 800);
  assert.equal((await orders.quote([{ product_id: b.id, quantity: 1 }])).subtotal, 700);
});
test('quote: a discount can never push the price below zero', async () => {
  const p = await product({ price: 100, discount_type: 'fixed', discount_value: 5000 });
  const q = await orders.quote([{ product_id: p.id, quantity: 1 }], { discountType: 'fixed', discountValue: 99999 });
  assert.ok(q.subtotal >= 0 && q.total >= 0 && q.discount <= q.subtotal);
  const pct = await orders.quote([{ product_id: (await product()).id, quantity: 1 }], { discountType: 'percent', discountValue: 500 });
  assert.ok(pct.discount <= pct.subtotal);
});
test('quote: wholesale tiers apply from the threshold, product can switch them off', async () => {
  await settings.set({ wholesale_tiers: JSON.stringify([{ min: 25, percent: 10 }, { min: 50, percent: 15 }]) });
  const p = await product(); const off = await product({ no_wholesale_tiers: true });
  assert.equal((await orders.quote([{ product_id: p.id, quantity: 24 }], { orderType: 'wholesale' })).lines[0].unit_price, 1000);
  assert.equal((await orders.quote([{ product_id: p.id, quantity: 25 }], { orderType: 'wholesale' })).lines[0].unit_price, 900);
  assert.equal((await orders.quote([{ product_id: p.id, quantity: 50 }], { orderType: 'wholesale' })).lines[0].unit_price, 850);
  assert.equal((await orders.quote([{ product_id: off.id, quantity: 50 }], { orderType: 'wholesale' })).lines[0].unit_price, 1000);
});
test('quote: samples cost more and are capped per product', async () => {
  await settings.set({ sample_markup_percent: '50', sample_max_qty: '5' }); const p = await product();
  assert.equal((await orders.quote([{ product_id: p.id, quantity: 2 }], { orderType: 'sample' })).lines[0].unit_price, 1500);
  await assert.rejects(orders.quote([{ product_id: p.id, quantity: 6 }], { orderType: 'sample' }), /limited to 5/);
});
test('quote: digital, renewal and upgrade orders have no delivery or COD charge', async () => {
  await settings.set({ cod_charges: '99' }); const p = await product();
  for (const t of ['digital', 'renewal', 'upgrade']) { const q = await orders.quote([{ product_id: p.id, quantity: 1 }], { orderType: t, is_cod: true }); assert.equal(q.delivery, 0, t); assert.equal(q.cod, 0, t); }
});
test('quote: plan credit on upgrade is capped at the price', async () => {
  const p = await product({ price: 500 });
  const q = await orders.quote([{ product_id: p.id, quantity: 1 }], { orderType: 'upgrade', planCredit: 99999 });
  assert.equal(q.total, 0);
});
test('quote: bad quantities are clamped, unknown / inactive products and empty carts are rejected', async () => {
  const p = await product();
  assert.equal((await orders.quote([{ product_id: p.id, quantity: -5 }])).lines[0].quantity, 1);
  assert.equal((await orders.quote([{ product_id: p.id, quantity: 'abc' }])).lines[0].quantity, 1);
  assert.equal((await orders.quote([{ product_id: p.id, quantity: 999999 }])).lines[0].quantity, 1000);
  await assert.rejects(orders.quote([{ product_id: 987654, quantity: 1 }]), /no longer available/);
  const off = await product({ status: false }); await assert.rejects(orders.quote([{ product_id: off.id, quantity: 1 }]), /no longer available/);
  await assert.rejects(orders.quote([]), /empty/); await assert.rejects(orders.quote('x'), /empty/); await assert.rejects(orders.quote(null), /empty/);
});
test('quote: a product with options needs a valid option and adds its price difference', async () => {
  const p = await product({ variants: [{ name: 'Metal', price_delta: 500 }, { name: 'PVC', price_delta: 0 }] });
  await assert.rejects(orders.quote([{ product_id: p.id, quantity: 1 }]), /Choose an option/);
  await assert.rejects(orders.quote([{ product_id: p.id, quantity: 1, variant: 'Gold' }]), /Choose an option/);
  assert.equal((await orders.quote([{ product_id: p.id, quantity: 1, variant: 'Metal' }])).lines[0].unit_price, 1500);
});
test('quote: tax is applied on the discounted amount', async () => {
  await settings.set({ nfc_tax_rate: '10' }); const p = await product();
  const q = await orders.quote([{ product_id: p.id, quantity: 1 }], { discountType: 'fixed', discountValue: 100 });
  assert.equal(q.tax, 90);
});
test('price tampering: a customer cannot set their own unit price through the public quote', async () => {
  const p = await product(); const c = client(ctx.base);
  const r = await c.post('/api/shop/quote', { items: [{ product_id: p.id, quantity: 1, unit_price: 1 }] });
  assert.equal(r.status, 200); assert.equal(JSON.stringify(r.body).includes('"unit_price":1,'), false);
  assert.ok(r.body.subtotal === 1000 || r.body.data?.subtotal === 1000, r.text.slice(0, 200));
});

/* ------------------------------------------------ public shop + checkout (HTTP) */
test('shop: lists only active products that are shown in the shop; closed shop returns 404', async () => {
  const shown = await product(); const hidden = await product({ show_in_shop: false }); const off = await product({ status: false });
  const c = client(ctx.base); const r = await c.get('/api/shop/products'); const ids = r.body.data.map((x) => x.id);
  assert.ok(ids.includes(shown.id) && !ids.includes(hidden.id) && !ids.includes(off.id));
  assert.equal((await c.get(`/api/shop/products/${hidden.slug}`)).status, 404);
  await settings.set({ shop_enable: '0' }); assert.equal((await c.get('/api/shop/products')).status, 404);
});
test('checkout (COD, guest): creates account + order, tracking works only with the right token', async () => {
  const p = await product(); const c = client(ctx.base); const body = cust();
  const r = await c.post('/api/shop/checkout', { ...body, items: [{ product_id: p.id, quantity: 2 }] });
  assert.equal(r.status, 201, r.text); assert.ok(r.body.order && r.body.track_url);
  const order = await M.NfcOrder.findOne({ where: { order_number: r.body.order } });
  assert.equal(Number(order.amount), 2149); assert.equal(order.order_status, 'pending');
  assert.ok(await M.User.findOne({ where: { email: body.email } }));
  const other = client(ctx.base);
  assert.equal((await other.get(`/api/shop/track/${r.body.order}`)).status, 404);
  assert.equal((await other.get(`/api/shop/track/${r.body.order}?t=wrong`)).status, 404);
  assert.equal((await other.get(`/api/shop/track/${r.body.order}?t=${order.access_token}`)).status, 200);
  assert.equal((await other.get(`/api/shop/track/${r.body.order}?phone=${body.phone}`)).status, 200);
  assert.equal((await other.get(`/api/shop/track/${r.body.order}?phone=0300000000`)).status, 404);
});
test('checkout: the server price is used even if the cart carries a fake price or amount', async () => {
  const p = await product(); const c = client(ctx.base);
  const r = await c.post('/api/shop/checkout', { ...cust(), amount: 1, total: 1, items: [{ product_id: p.id, quantity: 1, unit_price: 1, price: 1 }] });
  assert.equal(r.status, 201); assert.equal(Number((await M.NfcOrder.findOne({ where: { order_number: r.body.order } })).amount), 1149);
});
test('checkout validation: required fields, bad e-mail, long text, empty cart, bad product', async () => {
  const p = await product(); const c = client(ctx.base); const items = [{ product_id: p.id, quantity: 1 }];
  assert.equal((await c.post('/api/shop/checkout', { items })).status, 422);
  assert.equal((await c.post('/api/shop/checkout', { ...cust({ email: 'nope' }), items })).status, 422);
  assert.equal((await c.post('/api/shop/checkout', { ...cust({ name: 'x'.repeat(500) }), items })).status, 422);
  assert.equal((await c.post('/api/shop/checkout', { ...cust(), items: [] })).status, 422);
  assert.equal((await c.post('/api/shop/checkout', { ...cust(), items: [{ product_id: 424242, quantity: 1 }] })).status, 422);
  assert.equal((await c.post('/api/shop/checkout', { ...cust(), items: 'not-json' })).status, 422);
});
test('checkout: invalid design file path is refused (no path traversal into other uploads)', async () => {
  const p = await product(); const c = client(ctx.base);
  for (const bad of ['../../etc/passwd', '/uploads/../.env', 'http://evil.test/x.png', '/uploads/designs/x.svg']) assert.equal((await c.post('/api/shop/checkout', { ...cust(), design_front: bad, items: [{ product_id: p.id, quantity: 1 }] })).status, 422, bad);
});
test('checkout: COD can be switched off; minimum order is enforced', async () => {
  const p = await product(); const c = client(ctx.base);
  await settings.set({ cod_enable: '0' }); assert.equal((await c.post('/api/shop/checkout', { ...cust(), items: [{ product_id: p.id, quantity: 1 }] })).status, 422);
  await settings.set({ cod_enable: '1', shop_min_order: '5000' }); assert.equal((await c.post('/api/shop/checkout', { ...cust(), items: [{ product_id: p.id, quantity: 1 }] })).status, 422);
});
test('checkout: an existing customer must sign in to pay online (no account takeover by e-mail)', async () => {
  const u = await makeUser(); const p = await product(); const c = client(ctx.base);
  const r = await c.post('/api/shop/checkout', { ...cust({ email: u.email, is_cod: false, payment_type: 'manual' }), items: [{ product_id: p.id, quantity: 1 }] });
  assert.equal(r.status, 409);
});
test('checkout: an order never attaches to a vcard owned by someone else', async () => {
  const victim = await makeUser(); const tpl = await M.Template.create({ name: 'T', slug: `t${++seq}` });
  const card = await M.Vcard.create({ user_id: victim.id, name: 'Victim card', url_alias: `victim-${seq}`, template_id: tpl.id });
  const p = await product(); const buyer = await makeUser(); const c = client(ctx.base);
  await c.post('/api/auth/login', { email: buyer.email, password: 'Passw0rd!x' });
  const r = await c.post('/api/shop/checkout', { ...cust({ email: buyer.email }), vcard_id: card.id, items: [{ product_id: p.id, quantity: 1 }] });
  assert.equal(r.status, 201); const o = await M.NfcOrder.findOne({ where: { order_number: r.body.order } }); assert.notEqual(o.vcard_id, card.id);
});

/* ------------------------------------------------ contact tags */
test('contact tags: shop order creates tags; public page never reveals owner phone or e-mail; manage link is private', async () => {
  const p = await product({ product_kind: 'contact_tag', tags_per_unit: 2, price: 699 }); const c = client(ctx.base); const body = cust({ phone: '03459998887' });
  const r = await c.post('/api/shop/checkout', { ...body, items: [{ product_id: p.id, quantity: 1 }] });
  assert.equal(r.status, 201, r.text);
  const order = await M.NfcOrder.findOne({ where: { order_number: r.body.order } }); assert.equal(order.order_type, 'contact_tag');
  const tags = await M.ContactTag.findAll({ where: { nfc_order_id: order.id } }); assert.equal(tags.length, 2);
  await tags[0].update({ owner_phone: '03455551234', owner_email: 'private-owner@example.test', emergency_phone: '03456660000', owner_name: 'Private Owner' });
  const page = await client(ctx.base).get(`/tag/${tags[0].code}`);
  assert.equal(page.status, 200);
  for (const secret of ['03455551234', 'private-owner@example.test', '03456660000', tags[0].manage_token, '3455551234']) assert.ok(!page.text.includes(secret), `public page leaks ${secret}`);
  assert.equal((await client(ctx.base).get(`/tag/${tags[0].code}/manage`)).status === 200, false, 'manage without token must not open');
  const anon = await client(ctx.base).get(`/api/shop/track/${r.body.order}?phone=${body.phone}`);
  assert.ok(!JSON.stringify(anon.body).includes(tags[0].manage_token), 'phone-only tracking must not reveal the private setup link');
});
test('contact tags: unknown / malformed codes give 404 and no stack trace', async () => {
  for (const code of ['ZZZZZZ', '../etc', "' OR 1=1", 'a'.repeat(200)]) { const r = await client(ctx.base).get(`/tag/${encodeURIComponent(code)}`); assert.ok([404, 400].includes(r.status), `${code} -> ${r.status}`); assert.ok(!/at .*\.js:\d+/.test(r.text)); }
});
test('contact tags: message form refuses honeypot bots and empty messages', async () => {
  const p = await product({ product_kind: 'contact_tag' }); const c = client(ctx.base);
  const r = await c.post('/api/shop/checkout', { ...cust(), items: [{ product_id: p.id, quantity: 1 }] });
  const o = await M.NfcOrder.findOne({ where: { order_number: r.body.order } }); const tag = await M.ContactTag.findOne({ where: { nfc_order_id: o.id } });
  const before = await M.ContactTagMessage.count();
  const post = (body) => fetch(`${ctx.base}/tag/${tag.code}/send`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest', 'X-Forwarded-For': `10.77.${++seq % 250}.1` }, body: JSON.stringify(body) });
  await post({ message: 'hi', website: 'http://spam.test' }); await post({ message: '' });
  assert.equal(await M.ContactTagMessage.count(), before, 'bot / empty messages must not be stored');
});
