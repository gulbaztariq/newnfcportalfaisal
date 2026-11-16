/* User: own settings (preferences, payment gateways, mail server) and the orders visitors placed on their vCards. */
const express = require('express');
const { Op } = require('sequelize');
const M = require('../../models');
const us = require('../../services/usersettings');
const docs = require('../../services/documents');
const mail = require('../../services/mail');
const { wrap, fail, validate, paginate, paged } = require('../../utils/http');

const r = express.Router();

/* ------------------------------------------------------------ settings */
r.get('/settings', wrap(async (req, res) => res.json({ data: await us.view(req.user.id) })));
r.put('/settings', wrap(async (req, res) => {
  const b = req.body || {};
  validate(b, { currency_code: 'max:10', time_format: 'in:12,24', paypal_mode: 'in:sandbox,live', smtp_host: 'max:191', smtp_port: 'integer|minv:1|maxv:65535', smtp_user: 'max:191', smtp_from_email: 'email|max:191', smtp_from_name: 'max:120', manual_guide: 'max:3000' },
    { currency_code: 'Currency', time_format: 'Time format', paypal_mode: 'PayPal mode', smtp_host: 'Mail server', smtp_port: 'Port', smtp_user: 'User name', smtp_from_email: 'From e-mail address', smtp_from_name: 'From name', manual_guide: 'Payment instructions' });
  if (b.currency_code && !/^[A-Za-z]{3}$/.test(String(b.currency_code))) fail(422, 'Currency must be a 3-letter code such as USD or PKR', { currency_code: 'Currency must be a 3-letter code such as USD or PKR' });
  if (b.currency_code) b.currency_code = String(b.currency_code).toUpperCase();
  const before = await us.full(req.user.id);
  const need = { stripe: [['stripe_secret', 'Stripe secret key']], paypal: [['paypal_client_id', 'PayPal client ID'], ['paypal_secret', 'PayPal secret']], paystack: [['paystack_secret', 'Paystack secret key']], flutterwave: [['flutterwave_secret', 'Flutterwave secret key']], razorpay: [['razorpay_key', 'Razorpay key ID'], ['razorpay_secret', 'Razorpay key secret']] };
  const errors = {};
  for (const [g, keys] of Object.entries(need)) {
    const on = b[`${g}_enable`] === true || b[`${g}_enable`] === '1';
    if (!on) continue;
    for (const [k, label] of keys) if (!String(b[k] ?? '').trim() && !before[k]) errors[k] = `${label} is required`;
  }
  if ((b.manual_enable === true || b.manual_enable === '1') && !String(b.manual_guide ?? before.manual_guide ?? '').trim()) errors.manual_guide = 'Payment instructions are required';
  if (b.smtp_enable === true || b.smtp_enable === '1') {
    for (const [k, label] of [['smtp_host', 'Mail server'], ['smtp_port', 'Port'], ['smtp_from_email', 'From e-mail address']]) if (!String(b[k] ?? before[k] ?? '').trim()) errors[k] = `${label} is required`;
  }
  if (Object.keys(errors).length) fail(422, Object.values(errors)[0], errors);
  res.json({ message: 'Settings saved', data: await us.save(req.user.id, b) });
}));
r.post('/settings/test-mail', wrap(async (req, res) => {
  const all = await us.full(req.user.id);
  if (all.smtp_enable !== '1' || !all.smtp_host) fail(422, 'Save and switch on your mail server first');
  try { await mail.sendVia(mail.userTransport(all), { to: req.user.email, subject: 'Test e-mail', html: '<p>Your own mail server works. E-mails from your cards will be sent from this address.</p>' }); } catch (e) { fail(422, `The mail server refused: ${String(e.message).slice(0, 160)}`); }
  res.json({ message: `Test e-mail sent to ${req.user.email}` });
}));

/* -------------------------------------------------------- product orders */
const ownCards = async (req) => (await M.Vcard.findAll({ where: { user_id: req.user.id }, attributes: ['id'] })).map((v) => v.id);
async function ownOrder(req) {
  const o = await M.VcardOrder.findOne({ where: { id: req.params.oid, vcard_id: await ownCards(req) }, include: [{ model: M.Vcard, attributes: ['id', 'name', 'url_alias', 'user_id'] }] });
  if (!o) fail(404, 'Order not found');
  return o;
}
r.get('/product-orders', wrap(async (req, res) => {
  const p = paginate(req);
  const where = { vcard_id: await ownCards(req) };
  for (const k of ['status', 'payment_status', 'kind']) if (req.query[k]) where[k] = req.query[k];
  if (req.query.vcard_id) where.vcard_id = where.vcard_id.filter((id) => id === Number(req.query.vcard_id));
  const q = (req.query.search || '').trim();
  if (q) where[Op.or] = ['order_number', 'customer_name', 'customer_phone', 'customer_email', 'item_name'].map((f) => ({ [f]: { [Op.like]: `%${q}%` } }));
  const { rows, count } = await M.VcardOrder.findAndCountAll({ where, attributes: { exclude: ['token', 'gateway_ref'] }, include: [{ model: M.Vcard, attributes: ['id', 'name'] }], order: [['id', 'DESC']], limit: p.limit, offset: p.offset });
  res.json(paged(rows, count, p));
}));
r.patch('/product-orders/:oid', wrap(async (req, res) => {
  validate(req.body, { status: 'in:pending,approved,rejected,delivered,cancelled', payment_status: 'in:pending,paid' }, { status: 'Status', payment_status: 'Payment status' });
  const o = await ownOrder(req);
  const patch = {};
  if (req.body.status) patch.status = req.body.status;
  // only a manual (bank / cash) payment can be marked by hand; online payments are confirmed by the gateway
  if (req.body.payment_status) { if (o.gateway !== 'manual') fail(422, 'Online payments are confirmed by the payment provider'); patch.payment_status = req.body.payment_status; }
  if (!Object.keys(patch).length) fail(422, 'Nothing to change');
  await o.update(patch);
  if (patch.payment_status === 'paid' && o.kind === 'appointment' && o.appointment_id) await M.Appointment.update({ paid: true }, { where: { id: o.appointment_id } });
  if (patch.status && o.customer_email) mail.sendTemplate('vcard_order_status', o.customer_email, { customer: o.customer_name, order: o.order_number, item: o.item_name, status: patch.status, vcard: o.vcard.name }, { ownerId: req.user.id }).catch(() => {});
  res.json({ message: 'Order updated' });
}));
r.delete('/product-orders/:oid', wrap(async (req, res) => {
  const o = await ownOrder(req);
  if (!['delivered', 'cancelled', 'rejected'].includes(o.status)) fail(422, 'Only delivered, cancelled or rejected orders can be deleted');
  await o.destroy();
  res.json({ message: 'Order deleted' });
}));
r.get('/product-orders/:oid/invoice', wrap(async (req, res) => {
  const o = await ownOrder(req);
  const pdf = await docs.invoicePdf({
    number: o.order_number, date: o.created_at, status: o.payment_status, method: us.LABELS[o.gateway] || o.gateway,
    billTo: { name: o.customer_name, email: o.customer_email || o.customer_phone, address: o.customer_address },
    items: [{ description: o.item_name, qty: o.quantity, price: Number(o.unit_price) }],
    subtotal: Number(o.amount), discount: 0, total: Number(o.amount), currency: o.currency_code,
  });
  res.type('application/pdf').set('Content-Disposition', `attachment; filename="${o.order_number}.pdf"`).send(pdf);
}));

/* ---------------------------------------------------------------- storage */
const fs = require('fs');
const path = require('path');
const { uploadDir } = require('../../config');
const subsSvc = require('../../services/subscription');
function sizeOf(url) {
  if (!url || typeof url !== 'string' || !url.startsWith('/uploads/')) return 0;
  const file = path.resolve(uploadDir, url.slice('/uploads/'.length));
  if (!file.startsWith(path.resolve(uploadDir))) return 0;
  try { return fs.statSync(file).size; } catch { return 0; }
}
r.get('/storage', wrap(async (req, res) => {
  const cards = await M.Vcard.findAll({ where: { user_id: req.user.id }, attributes: ['id', 'profile_image', 'cover_image', 'cover_video', 'menu_pages'] });
  const ids = cards.map((v) => v.id);
  const [gallery, products, services, testimonials, blogs, stores] = await Promise.all([
    M.VcardGallery.findAll({ where: { vcard_id: ids }, attributes: ['image'], raw: true }),
    M.VcardProduct.findAll({ where: { vcard_id: ids }, attributes: ['images'] }),
    M.VcardService.findAll({ where: { vcard_id: ids }, attributes: ['image'], raw: true }),
    M.VcardTestimonial.findAll({ where: { vcard_id: ids }, attributes: ['image'], raw: true }),
    M.VcardBlog.findAll({ where: { vcard_id: ids }, attributes: ['image'], raw: true }),
    M.WhatsappStore.findAll({ where: { user_id: req.user.id }, attributes: ['logo', 'cover_image'], raw: true }),
  ]);
  const sum = (list) => list.reduce((n, u) => n + sizeOf(u), 0);
  const parts = [
    ['Profile and cover images', sum(cards.flatMap((v) => [v.profile_image, v.cover_image, v.cover_video, ...(v.menu_pages || [])]))],
    ['Gallery', sum(gallery.map((x) => x.image))],
    ['Products', sum(products.flatMap((x) => x.images || []))],
    ['Services', sum(services.map((x) => x.image))],
    ['Testimonials', sum(testimonials.map((x) => x.image))],
    ['Blogs', sum(blogs.map((x) => x.image))],
    ['WhatsApp stores', sum(stores.flatMap((x) => [x.logo, x.cover_image]))],
    ['Account photo', sizeOf(req.user.avatar)],
  ].map(([label, bytes]) => ({ label, bytes }));
  const sub = await subsSvc.current(req.user.id).catch(() => null);
  const limitMb = Number(sub?.plan?.storage_limit || 0);
  const used = Number(req.user.storage_used || 0);
  res.json({ data: { used, limit: limitMb * 1024 * 1024, free: Math.max(0, limitMb * 1024 * 1024 - used), parts, other: Math.max(0, used - parts.reduce((n, x) => n + x.bytes, 0)) } });
}));

/* --------------------------------------------------------- delete account */
r.delete('/account', wrap(async (req, res) => {
  const u = req.user;
  if (req.impersonator) fail(403, 'Sign in as this user to delete the account');
  if (u.organisation_id && !u.is_organisation) fail(422, 'Your account belongs to a company. Ask your company admin to remove it.');
  if (String(req.body?.confirm || '').trim().toLowerCase() !== String(u.email).toLowerCase()) fail(422, 'Type your e-mail address to confirm', { confirm: 'Type your e-mail address exactly to confirm' });
  const cardIds = (await M.Vcard.findAll({ where: { user_id: u.id }, attributes: ['id'] })).map((v) => v.id);
  await M.VcardOrder.destroy({ where: { vcard_id: cardIds } });
  await M.Vcard.destroy({ where: { user_id: u.id } });
  await M.WhatsappStore.destroy({ where: { user_id: u.id } });
  await M.UserSetting.destroy({ where: { user_id: u.id } });
  if (u.is_organisation) {
    await M.User.update({ organisation_id: null, company_role: null, permissions: null, org_status: 'active', locked_fields: null }, { where: { organisation_id: u.id } });
    await M.Organisation.destroy({ where: { owner_id: u.id } });
  }
  const email = u.email;
  await u.destroy();
  require('../../middleware/auth').clearTokens(res);
  require('../../services/extras').slack('user_registered', `Account deleted by its owner: ${email}`);
  res.json({ message: 'Your account and its data have been deleted' });
}));

module.exports = r;
