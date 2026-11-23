/* Campaign (utm_*) and QR / NFC tracking on card views. */
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { boot, client, makeUser, M } = require('./helpers');
const analytics = require('../src/services/analytics');
const shortlinks = require('../src/services/shortlinks');

let ctx; let u; let card; let link; let n = 0;
before(async () => {
  ctx = await boot(); u = await makeUser({});
  const plan = await M.Plan.create({ name: 'Cmp plan', price: 1, frequency: 'yearly', no_of_vcards: 10, custom_duration_days: 365 }); await require('../src/services/subscription').activate(u.id, plan);
  const tpl = await M.Template.findOne() || await M.Template.create({ name: 'T', slug: 'cmp-t', status: true });
  card = await M.Vcard.create({ user_id: u.id, template_id: tpl.id, url_alias: `cmp-${Date.now()}`, name: 'Campaign card', status: true });
  link = await shortlinks.forVcard(card);
});
after(async () => { ctx.server.close(); await M.sequelize.close(); });
const UA = { 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 Version/17.4 Mobile/15E148 Safari/604.1' };
const open = (qs = '') => client(ctx.base).get(`/${card.url_alias}${qs}`, UA); // each client has its own IP, so every call is a new visitor
const settle = () => new Promise((r) => setTimeout(r, 150));

test('trackingOf keeps only plain, short values', () => {
  const t = analytics.trackingOf({ via: 'QR', utm_source: '<b>news</b>letter', utm_medium: 'email', utm_campaign: 'x'.repeat(200) });
  assert.equal(t.via, 'qr'); assert.ok(!/[<>]/.test(t.utm_source));
  assert.equal(t.utm_campaign.length, 80); assert.equal(analytics.trackingOf({ via: 'evil' }).via, null); assert.equal(analytics.trackingOf({}).utm_campaign, null);
});
test('views store via and utm tags; the report shows QR, NFC, campaigns and filters by campaign', async () => {
  const first = await open('?via=qr'); assert.equal(first.status, 200, first.text.slice(0, 300));
  assert.equal((await open('?utm_source=newsletter&utm_medium=email&utm_campaign=expo-2026')).status, 200);
  assert.equal((await open('?utm_source=newsletter&utm_medium=email&utm_campaign=expo-2026')).status, 200);
  assert.equal((await open('?via=nfc&utm_campaign=cards')).status, 200);
  await open(); await settle();
  const r = await analytics.report([card.id], { days: 7 });
  const ch = Object.fromEntries(r.channels.map((x) => [x.name, x.value]));
  assert.equal(ch['QR scan'], 1); assert.equal(ch['NFC / short link'], 1); assert.equal(ch['Campaign link'], 2); assert.equal(ch['Direct / NFC / QR'], 1);
  assert.deepEqual(r.campaigns.map((x) => [x.name, x.value]), [['expo-2026', 2], ['cards', 1]]);
  assert.equal(r.campaignSources[0].name, 'newsletter / email'); assert.equal(r.campaignSources[0].value, 2);
  const f = await analytics.report([card.id], { days: 7, filters: { campaign: 'expo-2026' } });
  assert.equal(f.kpis.views.value, 2);
  const q = await analytics.report([card.id], { days: 7, filters: { channel: 'QR scan' } }); assert.equal(q.kpis.views.value, 1);
});
test('short link keeps counting: NFC by default, QR when the code says so, tags pass through', async () => {
  const c = client(ctx.base);
  let r = await c.get(`/r/${link.code}`, UA); assert.equal(r.status, 302);
  assert.equal(new URL(r.headers.get('location')).searchParams.get('via'), 'nfc');
  r = await c.get(`/r/${link.code}?via=qr&utm_campaign=poster&utm_source=%3Cx%3E`, UA);
  const loc = new URL(r.headers.get('location')); assert.equal(loc.pathname, `/${card.url_alias}`); assert.equal(loc.searchParams.get('via'), 'qr');
  assert.equal(loc.searchParams.get('utm_campaign'), 'poster'); assert.ok(!/[<>]/.test(loc.searchParams.get('utm_source') || ''));
});
test('the QR code images carry via=qr', async () => {
  const login = client(ctx.base); await login.post('/api/auth/login', { email: u.email, password: 'Passw0rd!x' });
  const svg = await login.get(`/api/user/vcards/${card.id}/qrcode?format=svg&inline=1`); assert.equal(svg.status, 200);
  assert.equal((await client(ctx.base).get(`/${card.url_alias}/qr.svg`)).status, 200);
});
