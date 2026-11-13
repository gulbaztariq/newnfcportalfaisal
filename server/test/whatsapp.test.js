/* WhatsApp lead numbers (Cloud API): webhook handshake, signature, lead creation, no duplicates, admin management. */
const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const { boot, client, makeUser, outbox, settings, M, setMail } = require('./helpers');

let ctx; let owner; let card; let sa; let admin; let tpl; let seq = 0;
const SECRET = 'a'.repeat(32);
before(async () => {
  ctx = await boot();
  await settings.set({ enforce_2fa_staff: '0' });
  owner = await makeUser({});
  tpl = await M.Template.findOne() || await M.Template.create({ name: 'T', slug: 'wa-t', status: true });
  card = await M.Vcard.create({ user_id: owner.id, name: 'Sales card', url_alias: `wa-${Date.now()}`, template_id: tpl.id, status: true });
  sa = await makeUser({ role: 'super_admin' });
  admin = client(ctx.base); assert.equal((await admin.post('/api/auth/login', { email: sa.email, password: 'Passw0rd!x' })).status, 200);
});
after(async () => { ctx.server.close(); await M.sequelize.close(); });
beforeEach(async () => { outbox.length = 0; setMail({ configured: true, fails: false }); await settings.set({ whatsapp_app_secret: SECRET }); });

const hook = (body, { sign = true, secret = SECRET } = {}) => {
  const raw = JSON.stringify(body);
  const headers = { 'Content-Type': 'application/json' };
  if (sign) headers['X-Hub-Signature-256'] = `sha256=${crypto.createHmac('sha256', secret).update(raw).digest('hex')}`;
  return fetch(`${ctx.base}/webhooks/whatsapp`, { method: 'POST', headers, body: raw });
};
const msg = (pid, from, text, id = `wamid.${++seq}`, name = 'Ali Khan') => ({ entry: [{ changes: [{ value: { metadata: { phone_number_id: pid }, contacts: [{ wa_id: from, profile: { name } }], messages: [{ from, id, type: 'text', text: { body: text } }] } }] }] });
const wait = () => new Promise((r) => setTimeout(r, 150));
async function addLine(pid, extra = {}) {
  const real = global.fetch;
  global.fetch = async (u, o) => (String(u).includes('graph.facebook.com') ? new Response(JSON.stringify({ display_phone_number: '+92 300 1112233', verified_name: 'Shop' }), { status: 200 }) : real(u, o));
  try { return await admin.post('/api/admin/whatsapp-lines', { label: 'Sales', phone_number_id: pid, access_token: 'EAAB-token', vcard_id: card.id, ...extra }); } finally { global.fetch = real; }
}

test('webhook handshake only answers with the right verify token', async () => {
  const l = await admin.get('/api/admin/whatsapp-lines'); assert.equal(l.status, 200, l.text); const token = l.body.webhook.verify_token;
  assert.ok(token && l.body.webhook.url.endsWith('/webhooks/whatsapp'));
  const ok = await fetch(`${ctx.base}/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=${token}&hub.challenge=12345`);
  assert.equal(ok.status, 200); assert.equal(await ok.text(), '12345');
  assert.equal((await fetch(`${ctx.base}/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=1`)).status, 403);
  assert.equal((await fetch(`${ctx.base}/webhooks/whatsapp`)).status, 403);
});

test('a message becomes a lead on the card; later messages from the same person are added, not duplicated', async () => {
  const r = await addLine('1001'); assert.equal(r.status, 201, r.text); assert.equal(r.body.data.display_phone, '+92 300 1112233'); assert.ok(!('access_token' in r.body.data));
  assert.equal((await hook(msg('1001', '923001234567', 'Hi, price of NFC card?'))).status, 200); await wait();
  let leads = await M.VcardEnquiry.findAll({ where: { source: 'whatsapp' } });
  assert.equal(leads.length, 1); assert.equal(leads[0].vcard_id, card.id); assert.equal(leads[0].name, 'Ali Khan'); assert.equal(leads[0].phone, '+923001234567'); assert.match(leads[0].message, /price of NFC/);
  assert.ok(outbox.some((m) => m.key === 'enquiry_received' && m.to === owner.email));
  await hook(msg('1001', '923001234567', 'And delivery to Lahore?')); await wait();
  const same = msg('1001', '923001234567', 'Retry me', 'wamid.same'); await hook(same); await hook(same); await wait();
  leads = await M.VcardEnquiry.findAll({ where: { source: 'whatsapp' } });
  assert.equal(leads.length, 1); assert.match(leads[0].message, /Lahore/); assert.equal(leads[0].message.split('Retry me').length, 2, 'a redelivered message is added once');
  await hook(msg('1001', '923009999999', 'Another person')); await wait();
  assert.equal(await M.VcardEnquiry.count({ where: { source: 'whatsapp' } }), 2);
  const line = await M.WhatsappLine.findOne({ where: { phone_number_id: '1001' } }); assert.equal(line.messages_count, 4);
});

test('unsigned, wrongly signed and unknown-number deliveries create nothing', async () => {
  const before = await M.VcardEnquiry.count();
  assert.equal((await hook(msg('1001', '92300', 'x'), { sign: false })).status, 403);
  assert.equal((await hook(msg('1001', '92300', 'x'), { secret: 'b'.repeat(32) })).status, 403);
  assert.equal((await hook(msg('9999', '92300', 'unknown number'))).status, 200); await wait();
  await settings.set({ whatsapp_app_secret: '' });
  assert.equal((await hook(msg('1001', '92300', 'no secret saved'))).status, 403, 'fails closed without an app secret');
  assert.equal(await M.VcardEnquiry.count(), before);
});

test('a paused number and delivery receipts are ignored', async () => {
  const line = await M.WhatsappLine.findOne({ where: { phone_number_id: '1001' } }); await line.update({ status: false });
  const n = await M.VcardEnquiry.count(); await hook(msg('1001', '92311', 'paused')); await wait(); assert.equal(await M.VcardEnquiry.count(), n);
  await line.update({ status: true });
  await hook({ entry: [{ changes: [{ value: { metadata: { phone_number_id: '1001' }, statuses: [{ id: 'x', status: 'read' }] } }] }] }); await wait(); assert.equal(await M.VcardEnquiry.count(), n);
});

test('admin manages numbers: validation, duplicates, token never returned, super admin only', async () => {
  const bad = await admin.post('/api/admin/whatsapp-lines', { label: '', phone_number_id: 'abc' }); assert.equal(bad.status, 422); assert.ok(bad.body.errors.label && bad.body.errors.phone_number_id);
  assert.match(bad.body.errors.label, /Name is required/);
  assert.equal((await addLine('1001')).status, 422, 'duplicate number');
  const noToken = await admin.post('/api/admin/whatsapp-lines', { label: 'X', phone_number_id: '2002' }); assert.equal(noToken.status, 422); assert.ok(noToken.body.errors.access_token);
  const list = await admin.get('/api/admin/whatsapp-lines'); assert.ok(!JSON.stringify(list.body).includes('EAAB-token')); assert.equal(list.body.data[0].has_token, true);
  assert.equal((await admin.put('/api/admin/whatsapp-lines/config', { app_secret: 'short' })).status, 422);
  assert.equal((await admin.put('/api/admin/whatsapp-lines/config', { app_secret: 'c'.repeat(32) })).status, 200);
  const staff = await makeUser({ role: 'admin' }); const sc = client(ctx.base); await settings.set({ require_totp_staff: '0', login_otp_enable: '0', enforce_2fa_staff: '0' });
  assert.equal((await sc.post('/api/auth/login', { email: staff.email, password: 'Passw0rd!x' })).status, 200);
  assert.equal((await sc.get('/api/admin/whatsapp-lines')).status, 403);
  assert.equal((await client(ctx.base).get('/api/admin/whatsapp-lines')).status, 401);
  const id = list.body.data[0].id; assert.equal((await admin.del(`/api/admin/whatsapp-lines/${id}`)).status, 200);
  assert.equal(await M.VcardEnquiry.count({ where: { source: 'whatsapp' } }) > 0, true, 'received leads stay');
});
