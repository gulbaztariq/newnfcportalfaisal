/* Admin: WhatsApp numbers (Cloud API) that turn incoming messages into leads. See services/whatsapp.js */
const express = require('express');
const M = require('../../models');
const QRCode = require('qrcode');
const crypto = require('crypto');
const { Op } = require('sequelize');
const wa = require('../../services/whatsapp');
const gw = require('../../services/wagateway');
const safety = require('../../services/wasafety');
const settings = require('../../services/settings');
const { wrap, fail, validate } = require('../../utils/http');

const r = express.Router();
const fs_rm = (id) => { try { require('fs').rmSync(gw.sessionDir(id), { recursive: true, force: true }); } catch { /* nothing to remove */ } };
const view = (l) => ({
  id: l.id, label: l.label, phone_number_id: l.phone_number_id, display_phone: l.display_phone, status: !!l.status, vcard_id: l.vcard_id,
  card: l.vcard ? { id: l.vcard.id, name: l.vcard.name, alias: l.vcard.url_alias } : null, has_token: !!l.access_token,
  messages_count: l.messages_count || 0, last_message_at: l.last_message_at,
  provider: l.provider || 'cloud', qr_status: l.qr_status, connected_at: l.connected_at,
  limits: { daily_limit: l.daily_limit, hourly_limit: l.hourly_limit, quiet_start: l.quiet_start, quiet_end: l.quiet_end },
});
const RULES = { label: 'required|max:80', phone_number_id: 'required|numeric|max:40' };
const LABELS = { label: 'Name', phone_number_id: 'Phone number ID' };

r.get('/', wrap(async (_req, res) => {
  const [lines, cards, secret, token] = await Promise.all([
    M.WhatsappLine.findAll({ include: [{ model: M.Vcard, attributes: ['id', 'name', 'url_alias'] }], order: [['id', 'ASC']] }),
    M.Vcard.findAll({ attributes: ['id', 'name', 'url_alias'], order: [['name', 'ASC']], limit: 1000 }),
    settings.get('whatsapp_app_secret'), wa.verifyToken(),
  ]);
  const leads = await M.VcardEnquiry.count({ where: { source: 'whatsapp' } });
  const lease = await M.WaLease.findByPk(1);
  res.json({
    data: lines.map(view), cards, leads, webhook: { url: wa.webhookUrl(), verify_token: token, has_app_secret: !!secret },
    qr: { enabled: (await settings.get('wa_qr_enable')) === '1', timezone: await settings.get('wa_timezone'), running: !!(lease?.holder && new Date(lease.until) > new Date()), caps: { daily: safety.HARD_MAX_DAILY, hourly: safety.HARD_MAX_HOURLY } },
  });
}));

/* ---------------------------------------------------------- QR-linked numbers */
const isQr = (l) => l && l.provider === 'qr';
const fail404 = () => fail(404, 'Not found');
const hhmm = (v) => /^([01]?\d|2[0-3]):[0-5]\d$/.test(String(v || ''));

r.put('/qr-config', wrap(async (req, res) => {
  const on = req.body.enabled === true || req.body.enabled === 'true' || req.body.enabled === 1 || req.body.enabled === '1';
  const tz = req.body.timezone ? String(req.body.timezone) : null;
  if (tz) { try { new Intl.DateTimeFormat('en', { timeZone: tz }); } catch { fail(422, 'Time zone is not valid', { timezone: 'Time zone is not valid, for example Asia/Karachi' }); } }
  await settings.set({ wa_qr_enable: on ? '1' : '0', ...(tz ? { wa_timezone: tz } : {}) });
  res.json({ message: on ? 'QR numbers are on' : 'QR numbers are off' });
}));

r.post('/qr', wrap(async (req, res) => {
  validate(req.body, { label: 'required|max:80' }, { label: 'Name' });
  if (req.body.vcard_id && !(await M.Vcard.findByPk(req.body.vcard_id))) fail(422, 'Choose a card from the list', { vcard_id: 'Choose a card from the list' });
  if ((await settings.get('wa_qr_enable')) !== '1') fail(422, 'Turn on QR numbers first', { label: 'Turn on QR numbers first' });
  const line = await M.WhatsappLine.create({ label: String(req.body.label).trim(), provider: 'qr', phone_number_id: `qr-${crypto.randomBytes(6).toString('hex')}`, vcard_id: req.body.vcard_id || null, status: true, qr_status: 'starting', command: 'connect' });
  res.status(201).json({ message: 'Open the QR code and scan it with the phone', data: view(await M.WhatsappLine.findByPk(line.id, { include: [M.Vcard] })) });
}));

r.get('/:id/qr', wrap(async (req, res) => {
  const l = await M.WhatsappLine.findByPk(req.params.id); if (!isQr(l)) fail404();
  const qr = l.qr_status === 'qr' && l.qr_code ? await QRCode.toDataURL(l.qr_code, { margin: 1, width: 280 }) : null;
  res.json({ status: l.qr_status, qr, phone: l.display_phone });
}));
r.post('/:id/connect', wrap(async (req, res) => {
  const l = await M.WhatsappLine.findByPk(req.params.id); if (!isQr(l)) fail404();
  await l.update({ command: 'connect', qr_status: 'starting', qr_code: null, status: true });
  res.json({ message: 'Connecting' });
}));
r.post('/:id/unlink', wrap(async (req, res) => {
  const l = await M.WhatsappLine.findByPk(req.params.id); if (!isQr(l)) fail404();
  await l.update({ command: 'logout' });
  res.json({ message: 'Unlinking this number' });
}));
r.put('/:id/limits', wrap(async (req, res) => {
  const l = await M.WhatsappLine.findByPk(req.params.id); if (!isQr(l)) fail404();
  const b = req.body; const errors = {};
  const daily = Number(b.daily_limit); const hourly = Number(b.hourly_limit);
  if (!Number.isInteger(daily) || daily < 1 || daily > safety.HARD_MAX_DAILY) errors.daily_limit = `Daily limit must be a whole number from 1 to ${safety.HARD_MAX_DAILY}`;
  if (!Number.isInteger(hourly) || hourly < 1 || hourly > safety.HARD_MAX_HOURLY) errors.hourly_limit = `Hourly limit must be a whole number from 1 to ${safety.HARD_MAX_HOURLY}`;
  if (!hhmm(b.quiet_start)) errors.quiet_start = 'Quiet hours start must look like 23:00';
  if (!hhmm(b.quiet_end)) errors.quiet_end = 'Quiet hours end must look like 07:00';
  if (Object.keys(errors).length) fail(422, Object.values(errors)[0], errors);
  await l.update({ daily_limit: daily, hourly_limit: hourly, quiet_start: b.quiet_start, quiet_end: b.quiet_end });
  res.json({ message: 'Limits saved' });
}));

/* inbox: people who wrote to a QR number, newest first */
r.get('/inbox', wrap(async (req, res) => {
  const where = {}; if (req.query.line_id) where.line_id = req.query.line_id;
  const q = String(req.query.q || '').trim(); if (q) where[Op.or] = [{ wa_id: { [Op.like]: `%${q.replace(/\D/g, '') || q}%` } }, { name: { [Op.like]: `%${q}%` } }];
  const qrLines = (await M.WhatsappLine.findAll({ where: { provider: 'qr' }, attributes: ['id', 'label'] }));
  where.line_id = req.query.line_id ? req.query.line_id : { [Op.in]: qrLines.map((x) => x.id) };
  const contacts = await M.WhatsappContact.findAll({ where, order: [['last_in_at', 'DESC']], limit: 100 });
  const names = Object.fromEntries(qrLines.map((x) => [x.id, x.label]));
  const out = [];
  for (const c of contacts) {
    const last = await M.WhatsappMessage.findOne({ where: { line_id: c.line_id, wa_id: c.wa_id }, order: [['id', 'DESC']] });
    out.push({ line_id: c.line_id, line: names[c.line_id], wa_id: c.wa_id, name: c.name, opted_out: !!c.opted_out, last_in_at: c.last_in_at, last: last ? { body: last.body, direction: last.direction, status: last.status, at: last.created_at } : null });
  }
  res.json({ data: out });
}));
r.get('/:id/thread/:waId', wrap(async (req, res) => {
  const l = await M.WhatsappLine.findByPk(req.params.id); if (!isQr(l)) fail404();
  const contact = await M.WhatsappContact.findOne({ where: { line_id: l.id, wa_id: req.params.waId } }); if (!contact) fail404();
  const rows = await M.WhatsappMessage.findAll({ where: { line_id: l.id, wa_id: contact.wa_id }, order: [['id', 'DESC']], limit: 60 });
  const window = contact.last_in_at ? Math.max(0, 24 * 3600 * 1000 - (Date.now() - new Date(contact.last_in_at))) : 0;
  res.json({ contact: { wa_id: contact.wa_id, name: contact.name, opted_out: !!contact.opted_out, can_reply_for_ms: contact.opted_out ? 0 : window }, data: rows.reverse().map((m) => ({ id: m.id, direction: m.direction, body: m.body, status: m.status, error: m.error, at: m.sent_at || m.created_at })) });
}));
r.post('/:id/send', wrap(async (req, res) => {
  const l = await M.WhatsappLine.findByPk(req.params.id); if (!isQr(l)) fail404();
  validate(req.body, { wa_id: 'required', text: 'required|max:1000' }, { wa_id: 'Recipient', text: 'Message' });
  const out = await gw.queueReply({ line: l, waId: String(req.body.wa_id), text: req.body.text, userId: req.user.id });
  if (!out.ok) fail(422, out.reason, { text: out.reason });
  res.status(202).json({ message: out.waiting ? `Queued. ${out.waiting} ahead of it; replies go out slowly on purpose` : 'Queued. It is sent in a few seconds, at a human pace', data: { id: out.message.id } });
}));

r.put('/config', wrap(async (req, res) => {
  const secret = String(req.body.app_secret || '').trim();
  if (!secret) fail(422, 'App secret is required', { app_secret: 'App secret is required' });
  if (secret.length < 16 || secret.length > 128) fail(422, 'App secret does not look right', { app_secret: 'App secret does not look right. Copy it from Meta: App settings > Basic > App secret.' });
  await settings.set({ whatsapp_app_secret: secret });
  res.json({ message: 'App secret saved' });
}));

async function save(line, body) {
  const data = { label: String(body.label).trim(), phone_number_id: String(body.phone_number_id).trim(), vcard_id: body.vcard_id || null, status: body.status === undefined ? true : !!body.status && body.status !== 'false' };
  if (data.vcard_id && !(await M.Vcard.findByPk(data.vcard_id))) fail(422, 'Choose a card from the list', { vcard_id: 'Choose a card from the list' });
  const dup = await M.WhatsappLine.findOne({ where: { phone_number_id: data.phone_number_id } });
  if (dup && (!line || dup.id !== line.id)) fail(422, 'This number is already added', { phone_number_id: 'This number is already added' });
  const token = String(body.access_token || '').trim();
  if (token) data.access_token = token;
  if (!line && !token) fail(422, 'Access token is required', { access_token: 'Access token is required' });
  if (line) { await line.update(data); return line; }
  return M.WhatsappLine.create(data);
}

r.post('/', wrap(async (req, res) => {
  validate(req.body, RULES, LABELS);
  const line = await save(null, req.body);
  try { const info = await wa.check(line); await line.update({ display_phone: info.phone }); } catch (e) { await line.destroy(); fail(422, `Meta did not accept this number: ${e.message}`, { access_token: `Meta did not accept this: ${e.message}` }); }
  res.status(201).json({ message: 'Number connected', data: view(await M.WhatsappLine.findByPk(line.id, { include: [M.Vcard] })) });
}));

r.put('/:id', wrap(async (req, res) => {
  const line = await M.WhatsappLine.findByPk(req.params.id) || fail(404, 'Not found');
  if (line.provider === 'qr') {
    validate(req.body, { label: 'required|max:80' }, LABELS);
    if (req.body.vcard_id && !(await M.Vcard.findByPk(req.body.vcard_id))) fail(422, 'Choose a card from the list', { vcard_id: 'Choose a card from the list' });
    await line.update({ label: String(req.body.label).trim(), vcard_id: req.body.vcard_id || null, ...(req.body.status === undefined ? {} : { status: req.body.status === true || req.body.status === 'true' }) });
    return res.json({ message: 'Saved', data: view(await M.WhatsappLine.findByPk(line.id, { include: [M.Vcard] })) });
  }
  validate(req.body, RULES, LABELS);
  await save(line, req.body);
  res.json({ message: 'Saved', data: view(await M.WhatsappLine.findByPk(line.id, { include: [M.Vcard] })) });
}));

r.post('/:id/test', wrap(async (req, res) => {
  const line = await M.WhatsappLine.findByPk(req.params.id) || fail(404, 'Not found');
  try { const info = await wa.check(line); await line.update({ display_phone: info.phone }); res.json({ message: `Connected to ${info.phone}${info.name ? ` (${info.name})` : ''}` }); } catch (e) { fail(422, `Meta did not accept this number: ${e.message}`); }
}));

r.delete('/:id', wrap(async (req, res) => {
  const line = await M.WhatsappLine.findByPk(req.params.id) || fail(404, 'Not found');
  if (line.provider === 'qr') { await line.update({ command: 'logout' }); await new Promise((r2) => setTimeout(r2, 400)); fs_rm(line.id); }
  await line.destroy(); // leads already received stay on the card
  res.json({ message: 'Number removed' });
}));

module.exports = r;
