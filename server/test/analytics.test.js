/* Card analytics: the report maths, the visitor-action tracking and who may see what. */
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const { boot, client, makeUser, M, settings } = require('./helpers');
const analytics = require('../src/services/analytics');
const { render } = require('../src/views/templates/render');
const { TEMPLATES } = require('../src/views/templates/catalog');
const subs = require('../src/services/subscription');

let ctx; let seq = 0;
before(async () => { ctx = await boot(); });
after(async () => { ctx.server.close(); await M.sequelize.close(); });

const NOW = new Date('2026-06-15T12:00:00Z'); // a Monday
const at = (daysAgo, hour = 10, min = 0) => { const d = new Date(NOW); d.setUTCDate(d.getUTCDate() - daysAgo); d.setUTCHours(hour, min, 0, 0); return d; };
const hash = (n) => crypto.createHash('sha256').update(`visitor${n}`).digest('hex');
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1';
const WIN_CHROME = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

async function card(user, over = {}) {
  const tpl = await M.Template.findOne() || await M.Template.create({ name: 'T', slug: `an-${++seq}` });
  return M.Vcard.create({ user_id: user.id, template_id: tpl.id, url_alias: `an-card-${++seq}`, name: `Card ${seq}`, status: true, ...over });
}
const recent = (daysAgo) => new Date(Date.now() - daysAgo * 86400000 - 3600000); // for the API tests, which always use the real clock
const view = (v, daysAgo, o = {}) => ({ vcard_id: v.id, ip_hash: hash(o.who ?? 1), user_agent: o.ua || IPHONE, referrer: o.ref || '', device: o.device || 'mobile', created_at: o.real ? recent(daysAgo) : at(daysAgo, o.hour ?? 10, o.min ?? 0) });
const event = (v, daysAgo, type, o = {}) => ({ vcard_id: v.id, type, label: o.label || null, visitor: hash(o.who ?? 1), device: 'mobile', created_at: at(daysAgo, o.hour ?? 10, 5) });

/* ------------------------------------------------ the report */
test('report: views, visitors, previous period, change and the daily series', async () => {
  const u = await makeUser(); const v = await card(u);
  await M.VcardView.bulkCreate([
    ...[0, 1, 1, 2, 5].map((d, i) => view(v, d, { who: i % 3 })), // 5 views by 3 visitors this week (days 0-6)
    ...[8, 9].map((d) => view(v, d, { who: 7 })), // 2 views in the previous 7 days
  ]);
  const r = await analytics.report([v.id], { days: 7, now: NOW });
  assert.equal(r.kpis.views.value, 5); assert.equal(r.kpis.views.previous, 2); assert.equal(r.kpis.views.change, 150);
  assert.equal(r.kpis.visitors.value, 3); assert.equal(r.kpis.visitors.previous, 1);
  assert.equal(r.series.length, 7); assert.equal(r.series.at(-1).date, '2026-06-15'); assert.equal(r.series[0].date, '2026-06-09');
  assert.equal(r.series.at(-1).views, 1); assert.equal(r.series.at(-2).views, 2); assert.equal(r.series.reduce((a, p) => a + p.views, 0), 5);
  assert.equal(r.series.reduce((a, p) => a + p.previous, 0), 2, 'previous period lines up day by day');
  assert.equal(r.range.days, 7); assert.equal(r.hasData, true);
});

test('report: only the asked cards are included, and no cards means an empty report', async () => {
  const u = await makeUser(); const a = await card(u); const b = await card(u);
  await M.VcardView.bulkCreate([view(a, 0), view(a, 1), view(b, 0)]);
  assert.equal((await analytics.report([a.id], { days: 7, now: NOW })).kpis.views.value, 2);
  assert.equal((await analytics.report([a.id, b.id], { days: 7, now: NOW })).kpis.views.value, 3);
  const none = await analytics.report([], { days: 7, now: NOW });
  assert.equal(none.kpis.views.value, 0); assert.equal(none.hasData, false); assert.deepEqual(none.topCards, []);
});

test('report: actions, saves, leads, engagement and the funnel', async () => {
  const u = await makeUser(); const v = await card(u);
  await M.VcardView.bulkCreate([view(v, 0, { who: 1 }), view(v, 0, { who: 2 }), view(v, 1, { who: 3 }), view(v, 2, { who: 4 })]);
  await M.VcardEvent.bulkCreate([event(v, 0, 'save', { who: 1 }), event(v, 0, 'call', { who: 1 }), event(v, 1, 'whatsapp', { who: 3 }), event(v, 3, 'call', { who: 9 }), event(v, 1, 'social', { who: 3, label: 'Instagram' })]);
  await M.VcardEnquiry.create({ vcard_id: v.id, name: 'L', email: 'l@x.co', message: 'hi', created_at: at(0) });
  await M.VcardSubscriber.create({ vcard_id: v.id, email: 's@x.co', created_at: at(1) });
  const r = await analytics.report([v.id], { days: 7, now: NOW });
  assert.equal(r.kpis.actions.value, 5); assert.equal(r.kpis.saves.value, 1); assert.equal(r.kpis.leads.value, 2);
  // visitors 1 (day 0) and 3 (day 1) acted on the day they viewed: 2 of 4 views
  assert.equal(r.kpis.engagement.value, 50);
  assert.deepEqual(r.funnel.map((s) => s.value), [4, 2, 1, 2]);
  assert.deepEqual(r.actions.map((a) => [a.type, a.value]).sort(), [['call', 2], ['save', 1], ['social', 1], ['whatsapp', 1]]);
  assert.deepEqual(r.topLinks, [{ name: 'Instagram', value: 1 }]);
});

test('report: traffic sources, channels, devices, browsers and systems', async () => {
  const u = await makeUser(); const v = await card(u);
  await M.VcardView.bulkCreate([
    view(v, 0, { ref: '' }), view(v, 0, { ref: '', who: 2 }),
    view(v, 1, { ref: 'https://www.google.com/search?q=x', who: 3, ua: WIN_CHROME, device: 'desktop' }),
    view(v, 1, { ref: 'https://l.instagram.com/?u=1', who: 4 }),
    view(v, 2, { ref: 'https://blog.example.org/post', who: 5, ua: WIN_CHROME, device: 'desktop' }),
    view(v, 2, { ref: 'not a url', who: 6 }),
  ]);
  const r = await analytics.report([v.id], { days: 7, now: NOW });
  const ch = Object.fromEntries(r.channels.map((c) => [c.name, c.value]));
  assert.deepEqual(ch, { 'Direct / NFC / QR': 3, Search: 1, Social: 1, Referral: 1 });
  assert.ok(r.sources.some((s) => s.name === 'google.com' && s.value === 1)); assert.ok(r.sources.some((s) => s.name === 'blog.example.org'));
  assert.deepEqual(Object.fromEntries(r.devices.map((d) => [d.name, d.value])), { Mobile: 4, Desktop: 2 });
  assert.deepEqual(Object.fromEntries(r.browsers.map((d) => [d.name, d.value])), { Safari: 4, Chrome: 2 });
  assert.deepEqual(Object.fromEntries(r.systems.map((d) => [d.name, d.value])), { iOS: 4, Windows: 2 });
  assert.deepEqual(analytics.sourceOf('https://t.co/abc'), { source: 't.co', channel: 'Social' });
  assert.equal(analytics.agentOf('Mozilla/5.0 (Linux; Android 13) SamsungBrowser/24.0 Chrome/117 Mobile').browser, 'Samsung Internet');
  assert.deepEqual(analytics.agentOf(''), { browser: 'Unknown', os: 'Unknown' });
});

test('report: the heatmap and the day boundaries follow the owner\'s time zone', async () => {
  const u = await makeUser(); const v = await card(u);
  // Sunday 14 June 21:30 UTC. In UTC that is Sunday evening; in Pakistan (UTC+5) it is already Monday 15 June 02:30
  await M.VcardView.create(view(v, 1, { hour: 21, min: 30 }));
  const utc = await analytics.report([v.id], { days: 7, now: NOW, tz: 0 });
  assert.equal(utc.heatmap[6][21], 1, 'Sunday 21h'); assert.equal(utc.series.at(-2).views, 1, 'counted on the 14th'); assert.equal(utc.series.at(-1).views, 0);
  const pk = await analytics.report([v.id], { days: 7, now: NOW, tz: 300 });
  assert.equal(pk.heatmap[0][2], 1, 'Monday 02h'); assert.equal(pk.heatmap[6][21], 0); assert.equal(pk.series.at(-1).views, 1, 'counted on the 15th'); assert.equal(pk.series.at(-1).date, '2026-06-15');
  assert.equal(utc.byWeekday[6].value, 1); assert.equal(pk.byWeekday[0].value, 1); assert.equal(utc.byHour[21].value, 1); assert.equal(pk.byHour[2].value, 1);
  // a view after the end of the owner's "today" is outside the period
  await M.VcardView.create(view(v, 0, { hour: 23, min: 30, who: 2 }));
  assert.equal((await analytics.report([v.id], { days: 7, now: NOW, tz: 300 })).kpis.views.value, 1);
  assert.equal((await analytics.report([v.id], { days: 7, now: NOW, tz: 0 })).kpis.views.value, 2);
});

test('report: top cards are ranked by views and include change and action rate', async () => {
  const u = await makeUser(); const a = await card(u, { name: 'Busy' }); const b = await card(u, { name: 'Quiet' });
  await M.VcardView.bulkCreate([...[0, 1, 2, 3].map((d) => view(a, d, { who: d })), view(b, 0), view(a, 9)]);
  await M.VcardEvent.create(event(a, 0, 'call', { who: 0 }));
  const r = await analytics.report([a.id, b.id], { days: 7, now: NOW });
  assert.deepEqual(r.topCards.map((c) => c.name), ['Busy', 'Quiet']);
  assert.equal(r.topCards[0].views, 4); assert.equal(r.topCards[0].change, 300); assert.equal(r.topCards[0].conversion, 25); assert.equal(r.topCards[1].conversion, 0);
});

test('report: insights are written in plain words and handle an empty period', async () => {
  const u = await makeUser(); const v = await card(u);
  const empty = await analytics.report([v.id], { days: 30, now: NOW });
  assert.equal(empty.insights.length, 1); assert.match(empty.insights[0].text, /No views/);
  await M.VcardView.bulkCreate(Array.from({ length: 12 }, (_, i) => view(v, i % 3, { who: i, hour: 16 })));
  const r = await analytics.report([v.id], { days: 30, now: NOW });
  assert.ok(r.insights.some((i) => /Most views arrive on/.test(i.text) && /4 PM/.test(i.text)), JSON.stringify(r.insights));
  assert.ok(r.insights.length <= 5);
});

test('report: bad periods and time zones are clamped, not trusted', async () => {
  const u = await makeUser(); const v = await card(u);
  assert.equal((await analytics.report([v.id], { days: 100000, now: NOW })).range.days, 366);
  assert.equal((await analytics.report([v.id], { days: -5, now: NOW })).range.days, 1);
  assert.equal((await analytics.report([v.id], { days: 'abc', now: NOW })).range.days, 30);
  await analytics.report([v.id], { days: 7, tz: 'DROP TABLE', now: NOW });
  await analytics.report([v.id], { days: 7, tz: 99999, now: NOW });
});

/* ------------------------------------------------ who can see it */
test('report: custom range, previous-year comparison, no comparison and weekly buckets', async () => {
  const u = await makeUser(); const v = await card(u);
  await M.VcardView.bulkCreate([view(v, 3), view(v, 4, { who: 2 }), view(v, 20, { who: 3 })]);
  const r = await analytics.report([v.id], { from: '2026-06-10', to: '2026-06-14', now: NOW });
  assert.equal(r.range.days, 5); assert.equal(r.kpis.views.value, 2); assert.equal(r.series[0].date, '2026-06-10');
  assert.equal(r.range.previousFrom, '2026-06-05');
  const none = await analytics.report([v.id], { days: 30, compare: 'none', now: NOW });
  assert.equal(none.kpis.views.previous, null); assert.equal(none.kpis.views.change, null);
  const yr = await analytics.report([v.id], { days: 30, compare: 'year', now: NOW });
  assert.equal(yr.range.previousFrom, '2025-05-17');
  const wk = await analytics.report([v.id], { days: 30, granularity: 'week', now: NOW });
  assert.equal(wk.series.length, 5); assert.equal(wk.series.reduce((a, p) => a + p.views, 0), 3);
  const future = await analytics.report([v.id], { from: '2026-06-10', to: '2030-01-01', now: NOW });
  assert.equal(future.range.to, '2026-06-15', 'the range never runs into the future');
  const junk = await analytics.report([v.id], { from: 'abc', to: 'def', now: NOW });
  assert.equal(junk.range.days, 30);
});

test('report: filters narrow views, their actions and visitors; leads are not attributed', async () => {
  const u = await makeUser(); const v = await card(u);
  await M.VcardView.bulkCreate([
    view(v, 0, { who: 1 }), view(v, 1, { who: 1 }), // phone visitor, returns on a second day
    view(v, 0, { who: 2, ua: WIN_CHROME, device: 'desktop', ref: 'https://www.google.com/' }),
    view(v, 2, { who: 3, ref: 'https://www.instagram.com/' }),
  ]);
  await M.VcardEvent.bulkCreate([event(v, 0, 'call', { who: 1 }), event(v, 0, 'save', { who: 2 })]);
  await M.VcardEnquiry.create({ vcard_id: v.id, name: 'L', email: 'l@x.co', message: 'hi', created_at: at(0) });
  const base = { days: 7, now: NOW };
  assert.equal((await analytics.report([v.id], base)).kpis.views.value, 4);
  const desk = await analytics.report([v.id], { ...base, filters: { device: 'desktop' } });
  assert.equal(desk.kpis.views.value, 1); assert.equal(desk.kpis.actions.value, 1); assert.equal(desk.kpis.leads.value, 1); assert.equal(desk.leadsNotFiltered, true);
  assert.equal((await analytics.report([v.id], { ...base, filters: { channel: 'Search' } })).kpis.views.value, 1);
  assert.equal((await analytics.report([v.id], { ...base, filters: { channel: 'Social' } })).kpis.views.value, 1);
  assert.equal((await analytics.report([v.id], { ...base, filters: { os: 'iOS' } })).kpis.views.value, 3);
  assert.equal((await analytics.report([v.id], { ...base, filters: { browser: 'Chrome' } })).kpis.views.value, 1);
  assert.equal((await analytics.report([v.id], { ...base, filters: { visitor: 'returning' } })).kpis.views.value, 2);
  assert.equal((await analytics.report([v.id], { ...base, filters: { visitor: 'new' } })).kpis.views.value, 2);
  const act = await analytics.report([v.id], { ...base, filters: { action: 'save' } });
  assert.equal(act.kpis.views.value, 4); assert.equal(act.kpis.actions.value, 1);
  const none = await analytics.report([v.id], { ...base, filters: { device: 'tablet' } });
  assert.equal(none.kpis.views.value, 0); assert.match(none.insights[0].text, /filters/);
  const split = await analytics.report([v.id], base);
  assert.equal(split.newVsReturning.find((x) => x.name === 'Returning visitors').value, 1);
  assert.equal(split.leadParts[0].value, 1);
  const q = analytics.optionsFrom({ days: '7', device: 'desktop', evil: 'x', channel: ['a'] });
  assert.deepEqual(q.filters, { device: 'desktop' });
});

async function login(user, plain = 'Passw0rd!x') {
  const c = client(ctx.base); const r = await c.post('/api/auth/login', { email: user.email, password: plain }); assert.equal(r.status, 200, r.text); return c;
}
async function subscribed() {
  const u = await makeUser(); const plan = await M.Plan.create({ name: `An plan ${++seq}`, price: 1, frequency: 'yearly', no_of_vcards: 10, custom_duration_days: 365 }); await subs.activate(u.id, plan); return u;
}

test('user dashboard API: only your own cards, anonymous refused, other people\'s cards are not found', async () => {
  const me = await subscribed(); const other = await subscribed();
  const mine = await card(me); const theirs = await card(other);
  await M.VcardView.bulkCreate([view(mine, 0, { real: true }), view(mine, 1, { real: true }), view(theirs, 0, { real: true }), view(theirs, 0, { who: 2, real: true }), view(theirs, 1, { who: 3, real: true })]);
  assert.equal((await client(ctx.base).get('/api/user/analytics')).status, 401);
  const c = await login(me);
  let r = await c.get('/api/user/analytics?days=30&tz=0'); assert.equal(r.status, 200);
  assert.equal(r.body.cards.length, 1); assert.equal(r.body.cards[0].id, mine.id); assert.equal(r.body.data.kpis.views.value, 2, 'the other user\'s views are not in my numbers');
  r = await c.get(`/api/user/analytics?vcard=${mine.id}`); assert.equal(r.status, 200); assert.equal(r.body.data.topCards.length, 1);
  r = await c.get(`/api/user/analytics?vcard=${theirs.id}`); assert.equal(r.status, 404, 'someone else\'s card');
  r = await c.get('/api/user/analytics?vcard=abc'); assert.equal(r.status, 404);
  r = await c.get('/api/user/analytics?vcard=1%20OR%201=1'); assert.equal(r.status, 404); r = await c.get('/api/user/analytics?vcard=all'); assert.equal(r.status, 200);
});

test('admin analytics API: admins see the platform, ordinary users are refused', async () => {
  const u = await subscribed(); const v = await card(u); await M.VcardView.bulkCreate([view(v, 0, { real: true }), view(v, 1, { who: 2, real: true })]);
  await settings.set({ enforce_2fa_staff: '0' }); const admin = await makeUser({ role: 'super_admin' });
  assert.equal((await client(ctx.base).get('/api/admin/dashboard/card-analytics')).status, 401);
  assert.equal((await (await login(u)).get('/api/admin/dashboard/card-analytics')).status, 403, 'a customer cannot read platform analytics');
  const a = await login(admin);
  let r = await a.get('/api/admin/dashboard/card-analytics?days=30'); assert.equal(r.status, 200); assert.ok(r.body.data.kpis.views.value >= 2); assert.ok(r.body.totals.cards >= 1);
  r = await a.get(`/api/admin/dashboard/card-analytics?user=${u.id}&days=30`); assert.equal(r.body.data.kpis.views.value, 2);
  r = await a.get(`/api/admin/dashboard/card-analytics?vcard=${v.id}`); assert.equal(r.body.data.topCards[0].id, v.id);
});

/* ------------------------------------------------ tracking */
const post = (c, alias, body, ua = IPHONE) => c.post(`/api/public/vcards/${alias}/event`, body, { 'User-Agent': ua });
const eventCount = (v, type) => M.VcardEvent.count({ where: { vcard_id: v.id, ...(type ? { type } : {}) } });
const planFor = async (u) => { const plan = await M.Plan.create({ name: `Trk ${++seq}`, price: 1, frequency: 'yearly', no_of_vcards: 10, custom_duration_days: 365 }); await subs.activate(u.id, plan); };

test('tracking: taps are stored without personal data; unknown types, bots and unknown cards are ignored', async () => {
  const u = await makeUser(); await planFor(u); const v = await card(u); const c = client(ctx.base);
  for (const t of ['call', 'email', 'whatsapp', 'map', 'share', 'social', 'link']) assert.equal((await post(c, v.url_alias, { type: t, label: `L-${t}` })).status, 204, t);
  assert.equal(await eventCount(v), 7);
  const row = await M.VcardEvent.findOne({ where: { vcard_id: v.id, type: 'social' }, raw: true });
  assert.equal(row.label, 'L-social'); assert.match(row.visitor, /^[a-f0-9]{64}$/); assert.equal(row.device, 'mobile');
  assert.ok(!JSON.stringify(row).includes('10.'), 'no IP address is stored');
  assert.equal((await post(c, v.url_alias, { type: 'hack', label: 'x' })).status, 204); assert.equal((await post(c, v.url_alias, { type: 'save' })).status, 204, 'saves are counted by the server, not by the page');
  assert.equal((await post(c, v.url_alias, { type: 'call' }, 'Googlebot/2.1')).status, 204); assert.equal((await post(c, v.url_alias, {})).status, 204);
  assert.equal((await post(c, 'no-such-card-xyz', { type: 'call' })).status, 204);
  assert.equal(await eventCount(v), 7, 'nothing extra was stored');
  const long = await post(c, v.url_alias, { type: 'link', label: 'x'.repeat(500) }); assert.equal(long.status, 204);
  assert.equal((await M.VcardEvent.findOne({ where: { vcard_id: v.id, type: 'link' }, order: [['id', 'DESC']], raw: true })).label.length, 80);
});

test('tracking: downloading the contact file counts one save, bots do not, and a hidden card records nothing', async () => {
  const u = await makeUser(); await planFor(u); const v = await card(u); const c = client(ctx.base);
  assert.equal((await c.get(`/${v.url_alias}/contact.vcf`, { 'User-Agent': IPHONE })).status, 200); await new Promise((r) => setTimeout(r, 50));
  assert.equal(await eventCount(v, 'save'), 1);
  assert.equal((await c.get(`/${v.url_alias}/contact.vcf`, { 'User-Agent': 'Googlebot/2.1' })).status, 200); await new Promise((r) => setTimeout(r, 50));
  assert.equal(await eventCount(v, 'save'), 1);
  const hidden = await card(u, { status: false });
  await post(c, hidden.url_alias, { type: 'call' }); assert.equal(await eventCount(hidden), 0);
});

test('tracking: the public card page carries the tracker, the editor preview does not', async () => {
  const tpl = TEMPLATES[0]; const base = { v: { url_alias: 'trk', name: 'T', sections: {}, theme: {} }, template: tpl, app: { app_name: 'X', favicon: '/f' }, appUrl: 'http://x', nonce: 'n' };
  const js = (html) => html.split('<script nonce="n">')[1].split('</script>')[0];
  const pub = js(render(base)); assert.ok(pub.includes('/event') && pub.includes("'call'") && pub.includes("'whatsapp'"));
  assert.doesNotThrow(() => new Function(pub));
  assert.ok(pub.includes('replace(/\\s+/g,'), 'whitespace is collapsed with a real \\s (a template-string escape bug once turned every "s" into a space)');
  assert.ok(!js(render({ ...base, preview: { still: true } })).includes('/event'), 'editor preview taps are not counted');
  for (const t of TEMPLATES.slice(140)) assert.ok(js(render({ ...base, template: t })).includes('/event'), t.slug);
});
