/* WhatsApp QR numbers: the safety rules, the slow outgoing queue, inbox + limits API. (No real WhatsApp connection is made.) */
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { boot, client, makeUser, settings, M } = require('./helpers');
const safety = require('../src/services/wasafety');
const gw = require('../src/services/wagateway');
const wa = require('../src/services/whatsapp');

const NOW = new Date('2026-06-10T10:00:00Z'); // 15:00 in Karachi
const line = (o = {}) => ({ status: true, qr_status: 'connected', daily_limit: 40, hourly_limit: 10, quiet_start: '23:00', quiet_end: '07:00', connected_at: new Date('2026-05-01'), ...o });
const contact = (o = {}) => ({ opted_out: false, last_in_at: new Date(NOW - 3600 * 1000), ...o });
const ok = (o = {}) => safety.checkSend({ line: line(o.line), contact: o.contact === undefined ? contact() : o.contact, text: o.text ?? 'Hello, thanks for writing', now: o.now || NOW, counts: o.counts || {}, tz: 'Asia/Karachi' });

test('only people who wrote first, within 24 hours, and never after STOP', () => {
  assert.equal(ok().ok, true);
  assert.match(ok({ contact: null }).reason, /has not messaged/);
  assert.match(ok({ contact: contact({ last_in_at: new Date(NOW - 25 * 3600 * 1000) }) }).reason, /24 hours/);
  assert.match(ok({ contact: contact({ opted_out: true }) }).reason, /asked to stop/);
  assert.match(ok({ line: { qr_status: 'disconnected' } }).reason, /not connected/);
  assert.match(ok({ line: { status: false } }).reason, /switched off/);
  assert.match(ok({ text: '   ' }).reason, /Type a message/);
  assert.match(ok({ text: 'x'.repeat(1001) }).reason, /1000/);
});

test('quiet hours, daily and hourly caps, warm-up and anti-broadcast rules', () => {
  assert.match(ok({ now: new Date('2026-06-10T19:30:00Z') }).reason, /Quiet hours/, '00:30 in Karachi');
  assert.equal(ok({ now: new Date('2026-06-10T03:00:00Z') }).ok, true, '08:00 in Karachi is fine');
  assert.match(ok({ counts: { day: 40 } }).reason, /Daily limit/);
  assert.match(ok({ counts: { hour: 10 } }).reason, /Hourly limit/);
  assert.match(ok({ line: { daily_limit: 5000 }, counts: { day: 100 } }).reason, /Daily limit/, 'never above the hard maximum');
  assert.match(ok({ line: { connected_at: new Date(NOW - 3600 * 1000) }, counts: { day: 10 } }).reason, /warms up/, 'a number linked an hour ago may send 10 a day');
  assert.equal(safety.warmupCap(0.5), 10); assert.equal(safety.warmupCap(2), 20); assert.equal(safety.warmupCap(5), 30); assert.equal(safety.warmupCap(9), 100);
  assert.match(ok({ counts: { toRecipientDay: 10 } }).reason, /many messages/);
  assert.match(ok({ counts: { sameTextRecipients: 3 } }).reason, /same message/);
  assert.match(ok({ counts: { recentFailures: 3 } }).reason, /paused for a while/);
  assert.equal(safety.inQuietHours(new Date('2026-06-10T12:00:00Z'), '09:00', '18:00', 'UTC'), true);
  assert.equal(safety.inQuietHours(NOW, '23:00', '23:00', 'Asia/Karachi'), false, 'equal times mean no quiet window');
  for (let i = 0; i < 50; i++) { const g = safety.gapMs(); assert.ok(g >= 6000 && g < 20000); }
  assert.match('STOP', safety.STOP_WORDS); assert.match('stop.', safety.STOP_WORDS); assert.doesNotMatch('please do not stop calling me', safety.STOP_WORDS);
});

let ctx; let admin; let card; let qline;
before(async () => {
  ctx = await boot(); await settings.set({ enforce_2fa_staff: '0' });
  const owner = await makeUser({}); const tpl = await M.Template.findOne() || await M.Template.create({ name: 'T', slug: 'qr-t', status: true });
  card = await M.Vcard.create({ user_id: owner.id, name: 'QR card', url_alias: `qr-${Date.now()}`, template_id: tpl.id, status: true });
  const sa = await makeUser({ role: 'super_admin' }); admin = client(ctx.base);
  assert.equal((await admin.post('/api/auth/login', { email: sa.email, password: 'Passw0rd!x' })).status, 200);
});
after(async () => { ctx.server.close(); await M.sequelize.close(); });

test('QR numbers must be switched on first; creating one asks the gateway to connect it', async () => {
  assert.equal((await admin.post('/api/admin/whatsapp-lines/qr', { label: 'Sales', vcard_id: card.id })).status, 422);
  assert.equal((await admin.put('/api/admin/whatsapp-lines/qr-config', { enabled: true, timezone: 'Nowhere/City' })).status, 422);
  assert.equal((await admin.put('/api/admin/whatsapp-lines/qr-config', { enabled: true, timezone: 'Asia/Karachi' })).status, 200);
  assert.equal((await admin.post('/api/admin/whatsapp-lines/qr', { label: '', vcard_id: card.id })).status, 422);
  const r = await admin.post('/api/admin/whatsapp-lines/qr', { label: 'Sales', vcard_id: card.id }); assert.equal(r.status, 201, r.text);
  qline = await M.WhatsappLine.findByPk(r.body.data.id); assert.equal(qline.provider, 'qr'); assert.equal(qline.command, 'connect'); assert.equal(qline.qr_status, 'starting');
  await qline.update({ qr_status: 'qr', qr_code: '2@fakeqrtext' });
  const q = await admin.get(`/api/admin/whatsapp-lines/${qline.id}/qr`); assert.match(q.body.qr, /^data:image\/png;base64,/);
  const list = await admin.get('/api/admin/whatsapp-lines'); assert.equal(list.body.qr.enabled, true); assert.ok(!JSON.stringify(list.body).includes('fakeqrtext'), 'QR text only through the QR endpoint');
});

test('limits are validated and saved', async () => {
  const bad = await admin.put(`/api/admin/whatsapp-lines/${qline.id}/limits`, { daily_limit: 500, hourly_limit: 10, quiet_start: '23:00', quiet_end: '07:00' }); assert.equal(bad.status, 422); assert.match(bad.body.errors.daily_limit, /1 to 100/);
  assert.equal((await admin.put(`/api/admin/whatsapp-lines/${qline.id}/limits`, { daily_limit: 20, hourly_limit: 5, quiet_start: '22:00', quiet_end: 'late' })).status, 422);
  assert.equal((await admin.put(`/api/admin/whatsapp-lines/${qline.id}/limits`, { daily_limit: 20, hourly_limit: 5, quiet_start: '22:00', quiet_end: '08:00' })).status, 200);
  const l = await M.WhatsappLine.findByPk(qline.id); assert.equal(l.daily_limit, 20); assert.equal(l.quiet_start, '22:00');
});

test('a QR message becomes a lead and shows in the inbox; STOP blocks replies', async () => {
  await qline.update({ qr_status: 'connected', connected_at: new Date(Date.now() - 20 * 86400000), quiet_start: '00:00', quiet_end: '00:00' });
  const fresh = await M.WhatsappLine.findByPk(qline.id);
  await wa.receive(fresh, { waId: '923001112222', jid: '923001112222@s.whatsapp.net', name: 'Bilal', text: 'Salam, card ki price?', msgId: 'qr-1' });
  await wa.receive(fresh, { waId: '923001112222', jid: '923001112222@s.whatsapp.net', name: 'Bilal', text: 'Salam, card ki price?', msgId: 'qr-1' });
  assert.equal(await M.VcardEnquiry.count({ where: { wa_id: '923001112222' } }), 1);
  assert.equal(await M.WhatsappMessage.count({ where: { line_id: qline.id, direction: 'in' } }), 1, 'a redelivered message is stored once');
  const inbox = await admin.get('/api/admin/whatsapp-lines/inbox'); assert.equal(inbox.body.data.length, 1); assert.equal(inbox.body.data[0].name, 'Bilal');
  const th = await admin.get(`/api/admin/whatsapp-lines/${qline.id}/thread/923001112222`); assert.equal(th.body.data.length, 1); assert.ok(th.body.contact.can_reply_for_ms > 0);
  await wa.receive(fresh, { waId: '923004445555', jid: '923004445555@s.whatsapp.net', name: 'Sana', text: 'STOP', msgId: 'qr-2' });
  const blocked = await admin.post(`/api/admin/whatsapp-lines/${qline.id}/send`, { wa_id: '923004445555', text: 'Hi' }); assert.equal(blocked.status, 422); assert.match(blocked.body.message, /asked to stop/);
  const stranger = await admin.post(`/api/admin/whatsapp-lines/${qline.id}/send`, { wa_id: '923009998888', text: 'Hi' }); assert.equal(stranger.status, 422); assert.match(stranger.body.message, /has not messaged/);
});

test('replies are queued, then sent one at a time with a pause, using a fake connection', async () => {
  const sent = []; const presence = [];
  const fake = { sendPresenceUpdate: async (p, j) => presence.push(p + ':' + j), sendMessage: async (jid, m) => { sent.push([jid, m.text]); return { key: { id: `out-${sent.length}` } }; } };
  gw._sockets.set(qline.id, { sock: fake, status: 'connected', retries: [], lastSendAt: 0, gap: 0 });
  const r1 = await admin.post(`/api/admin/whatsapp-lines/${qline.id}/send`, { wa_id: '923001112222', text: 'Walaikum salam! Card Rs 1500.' }); assert.equal(r1.status, 202, r1.text);
  const r2 = await admin.post(`/api/admin/whatsapp-lines/${qline.id}/send`, { wa_id: '923001112222', text: 'Anything else?' }); assert.equal(r2.status, 202);
  assert.equal(sent.length, 0, 'nothing is sent inside the request');
  await gw._deliverNext(); assert.equal(sent.length, 1); assert.deepEqual(sent[0], ['923001112222@s.whatsapp.net', 'Walaikum salam! Card Rs 1500.']);
  assert.ok(presence.includes('composing:923001112222@s.whatsapp.net'), 'shows typing first');
  await gw._deliverNext(); assert.equal(sent.length, 1, 'the second reply waits for the pause between sends');
  const e = gw._sockets.get(qline.id); assert.ok(e.gap >= 6000, 'a human pause was set'); e.lastSendAt = 0;
  await gw._deliverNext(); assert.equal(sent.length, 2);
  assert.equal(await M.WhatsappMessage.count({ where: { line_id: qline.id, direction: 'out', status: 'sent' } }), 2);
  gw._sockets.delete(qline.id);
});

test('the daily limit stops queueing, and an unlinked line is not sendable', async () => {
  await qline.update({ daily_limit: 2 });
  const over = await admin.post(`/api/admin/whatsapp-lines/${qline.id}/send`, { wa_id: '923001112222', text: 'third today' }); assert.equal(over.status, 422); assert.match(over.body.message, /Daily limit/);
  await qline.update({ qr_status: 'logged_out' });
  const off = await admin.post(`/api/admin/whatsapp-lines/${qline.id}/send`, { wa_id: '923001112222', text: 'x' }); assert.equal(off.status, 422);
});

test('QR numbers are super-admin only; unlink asks the gateway to log out', async () => {
  const staff = await makeUser({ role: 'admin' }); const sc = client(ctx.base); await settings.set({ login_otp_enable: '0', require_totp_staff: '0', enforce_2fa_staff: '0' });
  await sc.post('/api/auth/login', { email: staff.email, password: 'Passw0rd!x' });
  assert.equal((await sc.get('/api/admin/whatsapp-lines/inbox')).status, 403);
  assert.equal((await sc.post(`/api/admin/whatsapp-lines/${qline.id}/send`, { wa_id: '1', text: 'x' })).status, 403);
  assert.equal((await admin.post(`/api/admin/whatsapp-lines/${qline.id}/unlink`)).status, 200);
  assert.equal((await M.WhatsappLine.findByPk(qline.id)).command, 'logout');
  assert.equal((await fetch(`${ctx.base}/health`)).status, 200);
});
