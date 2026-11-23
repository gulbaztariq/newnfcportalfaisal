/* Lead follow-up (status, tags, notes, filters, export) and signed outgoing webhooks. */
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http'); const crypto = require('crypto');
const { boot, client, makeUser, M } = require('./helpers');
const { sign } = require('../src/services/webhooks');

let ctx; let u; let other; let card; let c; let oc; let sink; let hits = [];
before(async () => {
  ctx = await boot(); u = await makeUser({}); other = await makeUser({});
  const plan = await M.Plan.create({ name: 'LW plan', price: 1, frequency: 'yearly', no_of_vcards: 10, custom_duration_days: 365, features: { enquiry_form: true } });
  for (const x of [u, other]) await require('../src/services/subscription').activate(x.id, plan);
  const tpl = await M.Template.findOne() || await M.Template.create({ name: 'T', slug: 'x-t', status: true });
  card = await M.Vcard.create({ user_id: u.id, name: 'Lead card', first_name: 'Sara', url_alias: `lw-${Date.now()}`, template_id: tpl.id, status: true, enable_enquiry_form: true });
  c = client(ctx.base); oc = client(ctx.base);
  await c.post('/api/auth/login', { email: u.email, password: 'Passw0rd!x' }); await oc.post('/api/auth/login', { email: other.email, password: 'Passw0rd!x' });
  sink = http.createServer((req, res) => { let b = ''; req.on('data', (d) => { b += d; }); req.on('end', () => { hits.push({ headers: req.headers, body: b }); res.statusCode = req.url === '/fail' ? 500 : 200; res.end('ok'); }); });
  await new Promise((r) => sink.listen(0, '127.0.0.1', r));
});
after(async () => { sink.close(); ctx.server.close(); await M.sequelize.close(); });
const sinkUrl = (p = '/hook') => `http://127.0.0.1:${sink.address().port}${p}`;
const anon = () => client(ctx.base);
const lead = (body = {}) => anon().post(`/api/public/vcards/${card.url_alias}/enquiry`, { name: 'Ali', email: 'ali@example.com', phone: '03001234567', message: 'Interested', ...body }).then((r) => ({ status: r.status }));
const subscribe = (email) => anon().post(`/api/public/vcards/${card.url_alias}/subscribe`, { email });
const wait = async (fn, ms = 3000) => { const t = Date.now(); while (Date.now() - t < ms) { if (fn()) return true; await new Promise((r) => setTimeout(r, 40)); } return false; };

test('leads: new lead defaults to status new; owner can set status, tags and notes', async () => {
  assert.equal((await lead()).status, 200);
  const list = (await c.get('/api/user/enquiries')).body; const e = list.data[0];
  assert.equal(e.status, 'new'); assert.deepEqual(e.tags, []); assert.equal(list.counts.new, 1);
  const r = await c.patch(`/api/user/enquiries/${e.id}`, { status: 'qualified', tags: ['hot', ' hot ', 'expo 2026', ''], notes: 'Call on Monday' });
  assert.equal(r.status, 200); assert.deepEqual(r.body.data.tags, ['hot', 'expo 2026']);
  const after = (await c.get('/api/user/enquiries?status=qualified')).body;
  assert.equal(after.data.length, 1); assert.equal(after.counts.qualified, 1); assert.equal(after.counts.new, 0);
  assert.equal((await c.get('/api/user/enquiries?search=monday')).body.data.length, 1);
  assert.equal((await c.get('/api/user/enquiries?status=won')).body.data.length, 0);
  assert.equal((await c.patch(`/api/user/enquiries/${e.id}`, { status: 'bogus' })).status, 422);
});
test('leads: another account cannot read or change them', async () => {
  const e = (await c.get('/api/user/enquiries')).body.data[0];
  assert.equal((await oc.get('/api/user/enquiries')).body.data.length, 0);
  assert.equal((await oc.patch(`/api/user/enquiries/${e.id}`, { status: 'lost' })).status, 404);
  assert.equal((await M.VcardEnquiry.findByPk(e.id)).status, 'qualified');
});
test('leads: CSV export carries status, tags and notes', async () => {
  const r = await c.get('/api/user/export/enquiries?format=csv');
  assert.equal(r.status, 200); assert.match(r.text, /Status/); assert.match(r.text, /qualified/); assert.match(r.text, /hot, expo 2026/); assert.match(r.text, /Call on Monday/);
});
test('webhooks: address rules, event choice, ownership', async () => {
  assert.equal((await c.post('/api/user/webhooks', { name: 'x', url: 'http://example.com/h', events: ['lead.created'] })).status, 422, 'plain http refused');
  assert.equal((await c.post('/api/user/webhooks', { name: 'x', url: 'https://127.0.0.1/h', events: ['lead.created'] })).status, 422, 'private address refused');
  assert.equal((await c.post('/api/user/webhooks', { name: 'x', url: 'https://u:p@example.com/h', events: ['lead.created'] })).status, 422);
  assert.equal((await c.post('/api/user/webhooks', { name: 'x', url: sinkUrl(), events: ['nope'] })).status, 422);
  const h = (await c.post('/api/user/webhooks', { name: 'Zap', url: sinkUrl(), events: ['lead.created'] })).body.data;
  assert.match(h.secret, /^whsec_/);
  assert.equal((await oc.put(`/api/user/webhooks/${h.id}`, { name: 'hijack' })).status, 404);
  assert.equal((await oc.del(`/api/user/webhooks/${h.id}`)).status, 404);
  assert.equal((await oc.get('/api/user/webhooks')).body.data.length, 0);
});
test('webhooks: a new lead is delivered signed; verify the signature; log is kept', async () => {
  hits = []; const h = (await c.get('/api/user/webhooks')).body.data[0];
  assert.equal((await lead({ name: 'Zainab' })).status, 200);
  assert.ok(await wait(() => hits.length === 1), 'delivered');
  const { headers, body } = hits[0]; const p = JSON.parse(body);
  assert.equal(p.event, 'lead.created'); assert.equal(p.data.lead.name, 'Zainab'); assert.equal(p.data.card.alias, card.url_alias);
  assert.equal(headers['x-nfc-signature'], sign(h.secret, headers['x-nfc-timestamp'], body));
  assert.equal(headers['x-nfc-signature'], `sha256=${crypto.createHmac('sha256', h.secret).update(`${headers['x-nfc-timestamp']}.${body}`).digest('hex')}`);
  await wait(async () => false, 200);
  const log = (await c.get(`/api/user/webhooks/${h.id}/deliveries`)).body.data; assert.equal(log[0].ok, true); assert.equal(log[0].status, 200);
});
test('webhooks: events not subscribed to, paused hooks and other accounts get nothing', async () => {
  hits = []; const h = (await c.get('/api/user/webhooks')).body.data[0];
  await oc.post('/api/user/webhooks', { name: 'Other', url: sinkUrl('/other'), events: ['lead.created'] });
  await c.put(`/api/user/webhooks/${h.id}`, { events: ['subscriber.created'] });
  await lead(); await new Promise((r) => setTimeout(r, 400)); assert.equal(hits.length, 0, 'lead event not subscribed');
  await subscribe('new@example.com');
  assert.ok(await wait(() => hits.length === 1)); assert.equal(JSON.parse(hits[0].body).event, 'subscriber.created');
  hits = []; await c.put(`/api/user/webhooks/${h.id}`, { active: false }); await subscribe('n2@example.com');
  await new Promise((r) => setTimeout(r, 400)); assert.equal(hits.length, 0, 'paused');
});
test('webhooks: test button reports failures, and 10 failures pause the hook', async () => {
  const h = (await c.post('/api/user/webhooks', { name: 'Bad', url: sinkUrl('/fail'), events: ['lead.created'] })).body.data;
  const t = await c.post(`/api/user/webhooks/${h.id}/test`); assert.equal(t.body.data.ok, false); assert.equal(t.body.data.status, 500);
  for (let i = 0; i < 9; i += 1) await c.post(`/api/user/webhooks/${h.id}/test`);
  const now = (await c.get('/api/user/webhooks')).body.data.find((x) => x.id === h.id); assert.equal(now.active, false); assert.equal(now.failures, 10);
  const rot = await c.post(`/api/user/webhooks/${h.id}/secret`); assert.notEqual(rot.body.data.secret, h.secret);
});
