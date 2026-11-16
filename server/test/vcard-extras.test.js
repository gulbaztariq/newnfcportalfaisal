/* vCard extras: styled QR, banner, terms checkbox, share sheet, gallery media, store section, birthday icon. */
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'); const os = require('os'); const path = require('path');
const { boot, client, makeUser, M } = require('./helpers');
const qrstyle = require('../src/services/qrstyle');

let ctx; let u; let card; let c; let store;
const put = (body) => c.put(`/api/user/vcards/${card.id}`, body);
const page = async () => (await fetch(`${ctx.base}/${card.url_alias}`)).text();
before(async () => {
  ctx = await boot(); u = await makeUser({});
  const feats = Object.fromEntries(['custom_qrcode', 'gallery', 'products_services', 'enquiry_form', 'whatsapp_store'].map((k) => [k, true]));
  const plan = await M.Plan.create({ name: 'X plan', price: 1, frequency: 'yearly', no_of_vcards: 10, custom_duration_days: 365, storage_limit: 500, features: feats });
  await require('../src/services/subscription').activate(u.id, plan);
  const tpl = await M.Template.findOne() || await M.Template.create({ name: 'T', slug: 'x-t', status: true });
  card = await M.Vcard.create({ user_id: u.id, name: 'Extras card', first_name: 'Sara', url_alias: `ex-${Date.now()}`, template_id: tpl.id, status: true, dob: '1990-05-01', terms_conditions: '<p>Be nice</p>', enable_enquiry_form: true });
  store = await M.WhatsappStore.create({ user_id: u.id, name: 'Sara Shop', url_alias: `shop-${Date.now()}`, whatsapp_number: '923001234567', slogan: 'Fresh daily', status: true });
  c = client(ctx.base); assert.equal((await c.post('/api/auth/login', { email: u.email, password: 'Passw0rd!x' })).status, 200);
});
after(async () => { ctx.server.close(); await M.sequelize.close(); });

test('styled QR: valid SVG for every style, same grid as the plain code', () => {
  for (const style of qrstyle.STYLES) for (const eye of qrstyle.EYES) {
    const s = qrstyle.svg('https://example.com/card', { style, eye, fg: '#112233', bg: '#ffffff' });
    assert.match(s, /^<svg xmlns/); assert.match(s, /fill="#112233"/); assert.ok(!s.includes('NaN') && !s.includes('undefined'), `${style}/${eye}`);
  }
  assert.ok(qrstyle.svg('x', { style: 'dots' }).includes('<circle')); assert.ok(qrstyle.svg('x', { fg: 'javascript:1' }).includes('fill="#000000"'), 'bad colours fall back');
  assert.equal(qrstyle.isStyled({ style: 'square', eye: 'square' }), false); assert.equal(qrstyle.isStyled({ eye: 'circle' }), true);
});

test('QR style is saved and served: card shows the SVG, the PNG address redirects', async () => {
  assert.equal((await put({ name: card.name, url_alias: card.url_alias, qr_settings: { style: 'dots', eye: 'circle', fg: '#aa0000' } })).status, 200);
  const v = await M.Vcard.findByPk(card.id); assert.equal(v.qr_settings.style, 'dots'); assert.equal(v.qr_settings.eye, 'circle');
  assert.match(await page(), new RegExp(`/${card.url_alias}/qr\\.svg`));
  const svg = await fetch(`${ctx.base}/${card.url_alias}/qr.svg`); assert.match(svg.headers.get('content-type'), /svg/); assert.match(await svg.text(), /<circle/);
  assert.equal((await fetch(`${ctx.base}/${card.url_alias}/qr.png`, { redirect: 'manual' })).status, 302);
  await put({ name: card.name, url_alias: card.url_alias, qr_settings: { style: 'hacker', eye: 'square' } });
  assert.equal((await M.Vcard.findByPk(card.id)).qr_settings.style, 'square', 'unknown styles are dropped');
  assert.match((await fetch(`${ctx.base}/${card.url_alias}/qr.png`)).headers.get('content-type'), /png/);
});

test('banner, share sheet, birthday icon and store section render; unsafe values are cleaned', async () => {
  const bad = await put({ name: card.name, url_alias: card.url_alias, extras: { banner: { enabled: true, title: 'Sale', url: 'javascript:alert(1)' } } }); assert.equal(bad.status, 422);
  const r = await put({ name: card.name, url_alias: card.url_alias, extras: { banner: { enabled: true, title: 'Eid sale <b>', text: '20% off', button: 'Shop now', url: 'https://example.com/sale' }, dob_icon: 'ri-gift-line"><script>', store_id: store.id, terms_checkbox: true } });
  assert.equal(r.status, 200, r.text);
  const x = (await M.Vcard.findByPk(card.id)).extras; assert.equal(x.dob_icon, '', 'a bad icon name is dropped'); assert.equal(x.store_id, store.id); assert.equal(x.share_sheet, true);
  await put({ name: card.name, url_alias: card.url_alias, extras: { ...x, dob_icon: 'ri-gift-line' } });
  const html = await page();
  assert.match(html, /id="bnm"/); assert.match(html, /Eid sale &lt;b&gt;/); assert.match(html, /https:\/\/example\.com\/sale/);
  assert.match(html, /id="shm"/); assert.match(html, /data-sh="whatsapp"/); assert.match(html, /data-sh="snapchat"/);
  assert.match(html, /ri-gift-line/); assert.match(html, new RegExp(`/s/${store.url_alias}`)); assert.match(html, /Sara Shop/);
  const other = await makeUser({}); const os2 = await M.WhatsappStore.create({ user_id: other.id, name: 'Not mine', url_alias: `nm-${Date.now()}`, whatsapp_number: '923001234568', status: true });
  await put({ name: card.name, url_alias: card.url_alias, extras: { ...x, store_id: os2.id } });
  assert.equal((await M.Vcard.findByPk(card.id)).extras.store_id, null, "someone else's store cannot be attached");
});

test('terms checkbox: shown on the form and enforced by the server', async () => {
  const x = (await M.Vcard.findByPk(card.id)).extras; await put({ name: card.name, url_alias: card.url_alias, extras: { ...x, terms_checkbox: true } });
  assert.match(await page(), /name="accept_terms"/);
  const pub = client(ctx.base);
  const no = await pub.post(`/api/public/vcards/${card.url_alias}/enquiry`, { name: 'Ali', email: 'ali@example.test', message: 'Hello' }); assert.equal(no.status, 422); assert.match(no.body.errors.accept_terms, /accept the terms/);
  assert.equal((await pub.post(`/api/public/vcards/${card.url_alias}/enquiry`, { name: 'Ali', email: 'ali@example.test', message: 'Hello', accept_terms: '1' })).status, 200);
});

test('gallery media: audio and PDF are accepted and shown; a fake file is refused', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gm-'));
  const send = async (name, type, bytes, caption = 'My clip') => {
    const fd = new FormData(); fd.append('caption', caption); fd.append('file', new Blob([bytes], { type }), name);
    return fetch(`${ctx.base}/api/user/vcards/${card.id}/gallery-media`, { method: 'POST', body: fd, headers: { 'X-Requested-With': 'XMLHttpRequest', Cookie: Object.entries(c.cookies()).map(([k, v]) => `${k}=${v}`).join('; ') } });
  };
  const mp3 = Buffer.concat([Buffer.from('ID3'), Buffer.alloc(64)]); const pdf = Buffer.from('%PDF-1.4\n%fake but signed\n');
  const a = await send('song.mp3', 'audio/mpeg', mp3, 'Our jingle'); assert.equal(a.status, 201, await a.clone().text()); assert.equal((await a.json()).data.type, 'audio');
  const f = await send('menu.pdf', 'application/pdf', pdf, 'Price list'); assert.equal(f.status, 201); assert.equal((await f.json()).data.type, 'file');
  assert.equal((await send('evil.mp3', 'audio/mpeg', Buffer.from('<script>alert(1)</script>'))).status, 422, 'content must match the type');
  assert.equal((await send('x.exe', 'application/x-msdownload', Buffer.from('MZ'))).status, 422);
  assert.equal((await send('song.mp3', 'audio/mpeg', mp3, '')).status, 422, 'a title is required');
  const html = await page(); assert.match(html, /<audio controls/); assert.match(html, /Our jingle/); assert.match(html, /Price list/); assert.match(html, /download/);
  fs.rmSync(dir, { recursive: true, force: true });
});
