/* Admin: WhatsApp numbers (Cloud API) that turn incoming messages into leads. See services/whatsapp.js */
const express = require('express');
const M = require('../../models');
const wa = require('../../services/whatsapp');
const settings = require('../../services/settings');
const { wrap, fail, validate } = require('../../utils/http');

const r = express.Router();
const view = (l) => ({
  id: l.id, label: l.label, phone_number_id: l.phone_number_id, display_phone: l.display_phone, status: !!l.status, vcard_id: l.vcard_id,
  card: l.vcard ? { id: l.vcard.id, name: l.vcard.name, alias: l.vcard.url_alias } : null, has_token: !!l.access_token,
  messages_count: l.messages_count || 0, last_message_at: l.last_message_at,
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
  res.json({ data: lines.map(view), cards, leads, webhook: { url: wa.webhookUrl(), verify_token: token, has_app_secret: !!secret } });
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
  await line.destroy(); // leads already received stay on the card
  res.json({ message: 'Number removed' });
}));

module.exports = r;
