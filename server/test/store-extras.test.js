/* WhatsApp store extras: language / RTL, newsletter popup + subscribers, trending video, QR, installable app, custom CSS. */
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { boot, client, makeUser, M } = require('./helpers');

let ctx; let c; let st; let u;
before(async () => {
  ctx = await boot(); u = await makeUser({});
  const plan = await M.Plan.create({ name: 'S plan', price: 1, frequency: 'yearly', no_of_vcards: 5, no_of_whatsapp_stores: 5, custom_duration_days: 365, features: { whatsapp_store: true } });
  await require('../src/services/subscription').activate(u.id, plan);
  st = await M.WhatsappStore.create({ user_id: u.id, name: 'Karachi Kicks', url_alias: `kk-${Date.now()}`, whatsapp_number: '923001234567', status: true });
  const cat = await M.StoreCategory.create({ store_id: st.id, name: 'Shoes' });
  for (const n of ['Runner', 'Trainer', 'Slider']) await M.StoreProduct.create({ store_id: st.id, category_id: cat.id, name: n, price: 100, status: true });
  c = client(ctx.base); assert.equal((await c.post('/api/auth/login', { email: u.email, password: 'Passw0rd!x' })).status, 200);
});
after(async () => { ctx.server.close(); await M.sequelize.close(); });
const page = async () => (await fetch(`${ctx.base}/s/${st.url_alias}`)).text();
const save = (extras) => c.put(`/api/user/stores/${st.id}`, { name: st.name, whatsapp_number: '923001234567', extras });

test('extras are saved clean and shown on the store', async () => {
  const r = await save({ language: 'ar', font: 'Comic Sans', newsletter_popup: true, show_qr: true, pwa: true, trending_video: 'https://youtu.be/dQw4w9WgXcQ', custom_css: '.card{border-radius:2px}</style><script>alert(1)</script>@import url(http://evil);' });
  assert.equal(r.status, 200, r.text);
  const x = (await M.WhatsappStore.findByPk(st.id)).extras;
  assert.equal(x.language, 'ar'); assert.equal(x.font, '', 'unknown fonts are dropped'); assert.equal(x.trending_video, 'dQw4w9WgXcQ'); assert.ok(!x.custom_css.includes('<') && !/@import/i.test(x.custom_css));
  const html = await page();
  assert.match(html, /<html lang="ar" dir="rtl">/); assert.match(html, /أضف إلى السلة/); assert.match(html, /id="nl"/); assert.match(html, /class="trend"/); assert.match(html, /youtube-nocookie\.com\/embed\/dQw4w9WgXcQ/);
  assert.match(html, new RegExp(`/s/${st.url_alias}/qr\\.png`)); assert.match(html, /manifest\.webmanifest/); assert.match(html, /id="totop"/); assert.ok(!html.includes('<script>alert(1)'));
  assert.match(html, /wa\.me\/\?text=/, 'product share on WhatsApp'); assert.match(html, /L\.also/, 'recommended products with a buy button');
  const qr = await fetch(`${ctx.base}/s/${st.url_alias}/qr.png`); assert.match(qr.headers.get('content-type'), /png/);
  const man = await fetch(`${ctx.base}/s/${st.url_alias}/manifest.webmanifest`); assert.equal(man.status, 200); assert.equal((await man.json()).name, 'Karachi Kicks');
});

test('newsletter: validated, saved once, listed for the owner only; off means closed', async () => {
  const pub = client(ctx.base);
  const bad = await pub.post(`/api/public/stores/${st.url_alias}/subscribe`, { email: 'nope' }); assert.equal(bad.status, 422); assert.match(bad.body.errors.email, /valid e-mail address/);
  assert.equal((await pub.post(`/api/public/stores/${st.url_alias}/subscribe`, { email: 'Fan@Example.test' })).status, 201);
  assert.equal((await pub.post(`/api/public/stores/${st.url_alias}/subscribe`, { email: 'fan@example.test' })).status, 201);
  const list = await c.get(`/api/user/stores/${st.id}/subscribers`); assert.equal(list.body.data.length, 1); assert.equal(list.body.data[0].email, 'fan@example.test');
  const o = await makeUser({}); const oc = client(ctx.base); await oc.post('/api/auth/login', { email: o.email, password: 'Passw0rd!x' });
  assert.equal((await oc.get(`/api/user/stores/${st.id}/subscribers`)).status, 404);
  await save({ language: 'en', newsletter_popup: false, pwa: false });
  assert.equal((await pub.post(`/api/public/stores/${st.url_alias}/subscribe`, { email: 'x@example.test' })).status, 404);
  assert.notEqual((await fetch(`${ctx.base}/s/${st.url_alias}/manifest.webmanifest`)).headers.get('content-type')?.includes('manifest'), true);
  const html = await page(); assert.match(html, /<html lang="en">/); assert.match(html, /Add to cart/); assert.ok(!html.includes('id="nl"'));
});
