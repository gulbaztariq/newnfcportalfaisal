/* User portal: dynamic short links (plan feature url_shortener), own invoices, order details */
const express = require('express');
const dayjs = require('dayjs');
const QRCode = require('qrcode');
const { Op } = require('sequelize');
const M = require('../../models');
const { wrap, fail, validate, pick, toBool } = require('../../utils/http');
const { requireFeature, featuresOf } = require('./helpers');
const shortlinks = require('../../services/shortlinks');
const invoices = require('../../services/invoices');
const orders = require('../../services/orders');
const subs = require('../../services/subscription');
const { appUrl } = require('../../config');

const r = express.Router();
const withUrl = (l) => ({ ...l.toJSON(), short_url: shortlinks.shortUrl(l.code) });

/* ------------------------------------------------------------ short links */
r.get('/short-links', wrap(async (req, res) => {
  await featuresOf(req);
  const rows = await M.ShortLink.findAll({ where: { user_id: req.user.id }, order: [['id', 'DESC']], include: [{ model: M.Vcard, attributes: ['id', 'name', 'url_alias'] }, { model: M.WhatsappStore, attributes: ['id', 'name', 'url_alias'] }] });
  const sub = await subs.current(req.user.id);
  res.json({ data: rows.map(withUrl), enabled: !!req._features?.url_shortener, limit: sub?.plan?.no_of_short_links || 0 });
}));
async function targetOf(req, b, row) {
  const d = pick(b, ['title', 'note']);
  if (b.target_type !== undefined || !row) {
    const type = b.target_type || 'vcard';
    validate({ target_type: type }, { target_type: 'in:url,vcard,store' });
    d.target_type = type; d.vcard_id = null; d.store_id = null;
    if (type === 'url') { validate(b, { target_url: 'required|url|max:1000' }); d.target_url = b.target_url; }
    if (type === 'vcard') { const v = await M.Vcard.findOne({ where: { id: b.vcard_id, user_id: req.user.id } }); if (!v) fail(422, 'Validation failed', { vcard_id: 'Select one of your vCards' }); d.vcard_id = v.id; }
    if (type === 'store') { const st = await M.WhatsappStore.findOne({ where: { id: b.store_id, user_id: req.user.id } }); if (!st) fail(422, 'Validation failed', { store_id: 'Select one of your stores' }); d.store_id = st.id; }
  }
  if (b.status !== undefined) d.status = toBool(b.status);
  return d;
}
r.post('/short-links', wrap(async (req, res) => {
  await requireFeature(req, 'url_shortener', 'Dynamic links');
  const sub = await subs.current(req.user.id);
  const limit = sub?.plan?.no_of_short_links || 0;
  // default vCard links (one per card) do not count against the limit
  const used = await M.ShortLink.count({ where: { user_id: req.user.id, [Op.or]: [{ target_type: { [Op.ne]: 'vcard' } }, { title: { [Op.ne]: null } }] } });
  if (limit && used >= limit) fail(422, `Your plan allows ${limit} dynamic link(s)`);
  const d = await targetOf(req, req.body);
  const link = await M.ShortLink.create({ code: await shortlinks.uniqueCode(M), ...d, user_id: req.user.id });
  res.status(201).json({ data: withUrl(link), message: 'Dynamic link created' });
}));
/** claim a pre-printed tag: enter its code (printed on the pack) to connect it to your card */
r.post('/short-links/claim', wrap(async (req, res) => {
  validate(req.body, { code: 'required|max:40' });
  const link = await M.ShortLink.findOne({ where: { code: String(req.body.code).trim() } });
  if (!link || (link.user_id && link.user_id !== req.user.id) || (link.target_type !== 'unassigned' && !link.user_id)) fail(404, 'This code was not found or is already activated');
  const d = await targetOf(req, { target_type: 'vcard', ...req.body });
  await link.update({ ...d, user_id: req.user.id });
  res.json({ data: withUrl(link), message: 'Tag activated! It now opens your card.' });
}));
r.put('/short-links/:id', wrap(async (req, res) => {
  const link = await M.ShortLink.findOne({ where: { id: req.params.id, user_id: req.user.id } });
  if (!link) fail(404, 'Not found');
  if (link.locked) fail(403, 'This link is managed by the administrator');
  if (link.target_type !== 'vcard' || req.body.target_type !== 'vcard') await requireFeature(req, 'url_shortener', 'Dynamic links');
  await link.update(await targetOf(req, req.body, link));
  res.json({ data: withUrl(link), message: 'Destination updated. Your QR codes and NFC tags now open the new link.' });
}));
r.delete('/short-links/:id', wrap(async (req, res) => {
  const link = await M.ShortLink.findOne({ where: { id: req.params.id, user_id: req.user.id } });
  if (!link) fail(404, 'Not found');
  if (link.locked || link.nfc_order_id) fail(422, 'This link is written on an NFC product and cannot be deleted. Change its destination instead.');
  await link.destroy();
  res.json({ message: 'Deleted' });
}));
r.get('/short-links/:id/qrcode', wrap(async (req, res) => {
  const link = await M.ShortLink.findOne({ where: { id: req.params.id, user_id: req.user.id } });
  if (!link) fail(404, 'Not found');
  const opts = { width: Math.min(2000, Number(req.query.size) || 600), margin: 2, errorCorrectionLevel: 'M' };
  if (req.query.format === 'svg') return res.type('image/svg+xml').set('Content-Disposition', `attachment; filename="${link.code}.svg"`).send(await QRCode.toString(shortlinks.shortUrl(link.code), { ...opts, type: 'svg' }));
  res.type('image/png').set('Content-Disposition', `${req.query.download ? 'attachment' : 'inline'}; filename="${link.code}.png"`).send(await QRCode.toBuffer(shortlinks.shortUrl(link.code), opts));
}));
r.get('/short-links/:id/stats', wrap(async (req, res) => {
  const link = await M.ShortLink.findOne({ where: { id: req.params.id, user_id: req.user.id } });
  if (!link) fail(404, 'Not found');
  const clicks = await M.ShortLinkClick.findAll({ where: { short_link_id: link.id, created_at: { [Op.gte]: dayjs().subtract(30, 'day').toDate() } }, attributes: ['device', 'created_at'], raw: true });
  const days = {}; for (let i = 29; i >= 0; i -= 1) days[dayjs().subtract(i, 'day').format('YYYY-MM-DD')] = 0;
  for (const c of clicks) { const k = dayjs(c.created_at).format('YYYY-MM-DD'); if (k in days) days[k] += 1; }
  const devices = Object.entries(clicks.reduce((a, c) => ((a[c.device || 'other'] = (a[c.device || 'other'] || 0) + 1), a), {})).map(([name, value]) => ({ name, value }));
  res.json({ total: link.clicks, daily: Object.entries(days).map(([date, value]) => ({ date, value })), devices });
}));
r.get('/vcards/:id/short-link', wrap(async (req, res) => {
  const v = await M.Vcard.findOne({ where: { id: req.params.id, user_id: req.user.id } });
  if (!v) fail(404, 'Not found');
  res.json({ data: withUrl(await shortlinks.forVcard(v)) });
}));

/* ------------------------------------------------------------ orders + invoices */
r.get('/orders/:id', wrap(async (req, res) => {
  const o = await M.NfcOrder.findOne({ where: { id: req.params.id, user_id: req.user.id }, include: [{ model: M.NfcOrderItem, as: 'items' }, { model: M.Vcard, attributes: ['id', 'name', 'url_alias'] }] });
  if (!o) fail(404, 'Not found');
  const [invoice, links] = await Promise.all([M.Invoice.findOne({ where: { nfc_order_id: o.id }, attributes: ['id', 'number', 'status', 'total', 'token'] }), M.ShortLink.findAll({ where: { nfc_order_id: o.id } })]);
  const j = o.toJSON();
  for (const k of ['admin_note', 'cost_amount', 'stock_vendor_id', 'stock_consumed', 'courier_charges']) delete j[k];
  res.json({ data: j, invoice: invoice && { ...invoice.toJSON(), url: `${appUrl}/invoice/${invoice.token}` }, links: links.map(withUrl), steps: orders.STEPS, labels: orders.LABELS });
}));
r.get('/invoices', wrap(async (req, res) => {
  const rows = await M.Invoice.findAll({ where: { user_id: req.user.id, status: { [Op.ne]: 'draft' } }, order: [['id', 'DESC']], attributes: ['id', 'number', 'type', 'status', 'total', 'paid_amount', 'currency_icon', 'issue_date', 'due_date', 'token'] });
  res.json({ data: rows.map((i) => ({ ...i.toJSON(), url: `${appUrl}/invoice/${i.token}` })) });
}));
r.post('/transactions/:id/invoice-link', wrap(async (req, res) => {
  const t = await M.Transaction.findOne({ where: { id: req.params.id, user_id: req.user.id, status: 'paid' } });
  if (!t) fail(404, 'Not found');
  const inv = await invoices.fromTransaction(t.id);
  res.json({ url: `${appUrl}/invoice/${inv.token}` });
}));

module.exports = r;
