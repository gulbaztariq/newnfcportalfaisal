/*
 * Public shop API (/api/shop): NFC products catalogue, cart quote, design (AI / upload), checkout and order tracking.
 * Checkout without an account creates one automatically (credentials e-mailed, default vCard created) so the
 * NFC product can point at the buyer's own vCard; an existing e-mail must sign in first.
 */
const express = require('express');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const M = require('../models');
const { wrap, fail, validate, pick, toBool } = require('../utils/http');
const { makeUpload, fileUrl, DOC_TYPES } = require('../middleware/upload');
const { issueToken } = require('../middleware/auth');
const settings = require('../services/settings');
const orders = require('../services/orders');
const contacttags = require('../services/contacttags');
const extras = require('../services/extras');
const mail = require('../services/mail');
const ai = require('../services/ai');
const payments = require('../services/payments');
const subs = require('../services/subscription');
const onboarding = require('../services/onboarding');
const shortlinks = require('../services/shortlinks');
const { sanitizeSvg } = require('../services/svg');
const { uploadDir, clientUrl } = require('../config');

const r = express.Router();
const checkoutLimiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: 15, standardHeaders: true, legacyHeaders: false, message: { message: 'Too many orders from this network, please try again later.' } });
const aiLimiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: 6, standardHeaders: true, legacyHeaders: false, message: { message: 'You reached the AI design limit for now. Try again in an hour.' } });
const uploadLimiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false });
const jsonList = (v) => { if (Array.isArray(v)) return v; try { const j = JSON.parse(v); return Array.isArray(j) ? j : []; } catch { return []; } };
const PRODUCT_ATTRS = ['id', 'name', 'slug', 'category', 'short_description', 'description', 'price', 'compare_price', 'customization_price', 'size_label', 'variants', 'front_image', 'back_image', 'images', 'featured', 'sort'];

async function shopOn() { if ((await settings.get('shop_enable')) === '0') fail(404, 'The shop is closed'); }

r.get('/products', wrap(async (_req, res) => {
  await shopOn();
  const s = await settings.all();
  const rows = await M.NfcCard.findAll({ where: { status: true, show_in_shop: true }, attributes: PRODUCT_ATTRS, order: [['sort', 'ASC'], ['id', 'ASC']] });
  res.set('Cache-Control', 'public, max-age=60');
  res.json({
    data: rows, categories: [...new Set(rows.map((p) => p.category).filter(Boolean))],
    config: {
      currency: s.shop_currency_icon || 'Rs', currency_code: s.shop_currency_code || 'PKR', delivery_charges: Number(s.delivery_charges || 0), free_delivery_above: Number(s.free_delivery_above || 0),
      cod_enable: s.cod_enable !== '0', cod_charges: Number(s.cod_charges || 0), tax_name: s.nfc_tax_name || 'Tax', tax_rate: Number(s.nfc_tax_rate || 0),
      online_payment: s.online_payment_enable !== '0', ai_design: s.shop_ai_design_enable !== '0' && s.ai_enable === '1', upload_design: s.shop_upload_design_enable !== '0',
      courier_cities: s.leopards_enable === '1', min_order: Number(s.shop_min_order || 0),
    },
  });
}));
r.get('/products/:slug', wrap(async (req, res) => {
  await shopOn();
  const p = await M.NfcCard.findOne({ where: { slug: req.params.slug, status: true, show_in_shop: true }, attributes: PRODUCT_ATTRS });
  if (!p) fail(404, 'Product not found');
  res.json({ data: p });
}));
r.post('/quote', wrap(async (req, res) => {
  await shopOn();
  const q = await orders.quote(jsonList(req.body.items), { is_cod: toBool(req.body.is_cod) });
  res.json({ ...q, lines: q.lines.map(({ product, ...l }) => ({ ...l, product_id: product.id, image: product.front_image })) });
}));
r.get('/cities', wrap(async (_req, res) => {
  if ((await settings.get('leopards_enable')) !== '1') return res.json({ data: [] });
  try { res.json({ data: (await require('../services/leopards').cities()).filter((c) => c.destination) }); } catch { res.json({ data: [] }); }
}));

/* ------------------------------------------------------------- designs */
const designDir = path.join(uploadDir, 'designs');
fs.mkdirSync(designDir, { recursive: true });
async function saveSvg(svg) {
  const clean = sanitizeSvg(svg);
  if (!clean) return null;
  const name = `${crypto.randomBytes(16).toString('hex')}.svg`;
  await fs.promises.writeFile(path.join(designDir, name), clean);
  return `/uploads/designs/${name}`;
}
r.post('/design/ai', aiLimiter, wrap(async (req, res) => {
  await shopOn();
  const s = await settings.all();
  if (s.shop_ai_design_enable === '0') fail(422, 'AI design is not available right now');
  if (!req.user && !(await extras.verifyRecaptcha(req.body.recaptcha_token, req.ip))) fail(422, 'reCAPTCHA check failed, please try again');
  validate(req.body, { name: 'max:120', title: 'max:120', company: 'max:150', prompt: 'max:1000', style: 'max:120', colors: 'max:120' });
  const product = req.body.product_id ? await M.NfcCard.findByPk(req.body.product_id, { attributes: ['name'] }) : null;
  const d = await ai.cardDesign({ ...pick(req.body, ['name', 'title', 'company', 'phone', 'email', 'website', 'style', 'colors', 'prompt']), product: product?.name || 'NFC business card' });
  const [front, back] = await Promise.all([saveSvg(d.front_svg), saveSvg(d.back_svg)]);
  if (!front || !back) fail(502, 'The AI design could not be created, please try again');
  res.json({ front, back, concept: d.concept });
}));
const designUpload = makeUpload('designs', { types: { ...DOC_TYPES }, maxMb: 10 }).single('file');
r.post('/design/upload', uploadLimiter, designUpload, wrap(async (req, res) => {
  if (!req.file) fail(422, 'Choose a PNG, JPG, WEBP or PDF file');
  res.json({ url: fileUrl('designs', req.file), name: req.file.originalname?.slice(0, 120) });
}));
const isDesignUrl = (u) => !u || /^\/uploads\/designs\/[a-f0-9]{32}\.(svg|png|jpe?g|webp|gif|pdf)$/.test(String(u));

/* ------------------------------------------------------------- checkout */
r.post('/checkout', checkoutLimiter, wrap(async (req, res) => {
  await shopOn();
  const s = await settings.all();
  validate(req.body, { name: 'required|max:120', phone: 'required|max:30', email: 'required|email|max:191', address: 'required|max:1000', city: 'required|max:120', company_name: 'max:150', customer_note: 'max:2000', design_prompt: 'max:2000' });
  if (!req.user && !(await extras.verifyRecaptcha(req.body.recaptcha_token, req.ip))) fail(422, 'reCAPTCHA check failed, please try again');
  if (await extras.isBlockedEmail(req.body.email)) fail(422, 'Validation failed', { email: 'This e-mail domain is not allowed' });
  const isCod = toBool(req.body.is_cod);
  if (isCod && s.cod_enable === '0') fail(422, 'Cash on delivery is not available');
  const paymentType = isCod ? 'cod' : String(req.body.payment_type || 'manual');
  if (!isCod && paymentType !== 'manual' && !payments.NAMES.includes(paymentType)) fail(422, 'Choose a payment method');
  for (const k of ['design_front', 'design_back', 'design_file']) if (!isDesignUrl(req.body[k])) fail(422, 'Invalid design file');
  const q = await orders.quote(jsonList(req.body.items), { is_cod: isCod });
  // a cart of only tag products is a tag order (car contact tags / airport tags): the tags are made below
  const tagKinds = q.lines.map((l) => l.product.product_kind);
  if (tagKinds.every((k) => contacttags.TAG_KIND_OF[k])) q.order_type = tagKinds.every((k) => k === 'airport_tag') ? 'airport_tag' : 'contact_tag';
  if (Number(s.shop_min_order || 0) > q.subtotal) fail(422, `The minimum order is ${s.shop_currency_icon || 'Rs'} ${s.shop_min_order}`);

  // account: signed-in user, or a new account for a new e-mail
  const email = String(req.body.email).toLowerCase().trim();
  let user = req.user && req.user.role === 'user' ? req.user : null;
  let created = false;
  if (!user) {
    const existing = await M.User.findOne({ where: { email } });
    if (existing) {
      if (!isCod) fail(409, 'This e-mail already has an account. Please sign in to pay online, or choose cash on delivery.');
    } else if (s.register_enable !== '0') {
      const password = crypto.randomBytes(6).toString('base64url');
      const [first, ...rest] = String(req.body.name).trim().split(/\s+/);
      user = await M.User.create({ first_name: first.slice(0, 100), last_name: rest.join(' ').slice(0, 100), email, contact: req.body.phone, role: 'user', password: await bcrypt.hash(password, 12), email_verified_at: new Date(), affiliate_code: crypto.randomBytes(5).toString('hex') });
      await subs.assignDefaultPlan(user.id);
      await onboarding.defaultVcard(user);
      mail.sendTemplate('welcome', email, { name: user.first_name, email, password, login_url: `${clientUrl}/login` }).catch(() => {});
      user = await M.User.scope('withSecrets').findByPk(user.id);
      created = true;
    } else if (!isCod) fail(422, 'Online payment needs an account. Please choose cash on delivery.');
  }
  const vcard = user ? (req.body.vcard_id ? await M.Vcard.findOne({ where: { id: req.body.vcard_id, user_id: user.id } }) : await M.Vcard.findOne({ where: { user_id: user.id }, order: [['id', 'ASC']] })) : null;
  const design = ['standard', 'ai', 'upload', 'custom_code'].includes(req.body.design_type) ? req.body.design_type : 'standard';
  const order = await orders.create({
    ...pick(req.body, ['name', 'phone', 'address', 'city', 'courier_city_id', 'company_name', 'designation', 'customer_note', 'design_prompt']),
    email, user_id: user?.id || null, vcard_id: vcard?.id || null, source: 'shop', is_cod: isCod, payment_type: paymentType,
    design_type: design, design_front: req.body.design_front || null, design_back: req.body.design_back || null, design_file: req.body.design_file || null,
  }, q);
  if (vcard) await M.ShortLink.create({ code: await shortlinks.uniqueCode(M), title: `Order ${order.order_number}`, target_type: 'vcard', vcard_id: vcard.id, user_id: user.id, nfc_order_id: order.id });
  const tags = await contacttags.createForLines(order, q.lines, { userId: user?.id }); // owner = the buyer; the tag links are on the tracking page
  if (created) issueToken(res, user);

  const trackUrl = `/track/${order.order_number}?t=${order.access_token}`;
  if (isCod || paymentType === 'manual') {
    if (paymentType === 'manual') {
      const t = await M.Transaction.create({ user_id: user?.id || null, amount: order.amount, type: 'manual', status: 'pending', purpose: 'nfc_order', meta: { nfc_order_id: order.id } });
      await order.update({ transaction_id: t.id });
    }
    return res.status(201).json({ order: order.order_number, track_url: trackUrl, account_created: created, message: isCod ? 'Order placed! Pay cash when it arrives.' : 'Order placed! It will be processed after payment approval.' });
  }
  const session = await payments.createCheckout(paymentType, { user, order, purpose: 'nfc_order' });
  res.json({ redirect: session.url, order: order.order_number, track_url: trackUrl, account_created: created });
}));

/* ------------------------------------------------------------- tracking */
async function trackedOrder(req, withItems) {
  const q = { ...req.query, ...(req.body || {}) };
  const o = await M.NfcOrder.findOne({ where: { order_number: String(req.params.number).toUpperCase() }, include: withItems ? [{ model: M.NfcOrderItem, as: 'items' }, M.Transaction] : [M.Transaction] });
  const own = o && req.user && o.user_id === req.user.id;
  const t = Buffer.from(String(q.t || ''));
  const tokenOk = o && o.access_token && t.length === Buffer.byteLength(o.access_token) && crypto.timingSafeEqual(t, Buffer.from(o.access_token));
  const phoneOk = o && q.phone && String(q.phone).replace(/\D/g, '').length >= 8 && String(o.phone).replace(/\D/g, '').slice(-8) === String(q.phone).replace(/\D/g, '').slice(-8);
  if (!o || !(own || tokenOk || phoneOk)) fail(404, 'Order not found. Check the order number and phone number.');
  o.privileged = !!(own || tokenOk); // the order link or the signed-in owner (not just the phone number) may see the private tag links
  return o;
}

/** bank transfer / cash orders: the buyer uploads the payment receipt for the admin to approve (Cash payments) */
const receiptUpload = makeUpload('receipts', { types: DOC_TYPES, maxMb: 8 }).single('receipt');
r.post('/track/:number/receipt', uploadLimiter, receiptUpload, wrap(async (req, res) => {
  const o = await trackedOrder(req);
  if (!req.file) fail(422, 'Choose an image or PDF of your payment receipt');
  if (o.payment_type !== 'manual' || o.payment_status !== 'pending' || !o.transaction) fail(422, 'This order does not need a payment receipt');
  await o.transaction.update({ attachment: fileUrl('receipts', req.file), notes: String(req.body.note || '').slice(0, 500) || o.transaction.notes });
  require('../services/messaging').orderEvent('admin_order_placed', o, { payment: 'Receipt uploaded - approve in Cash payments' }).catch(() => {});
  res.json({ message: 'Receipt received. We will confirm your payment shortly.' });
}));

r.get('/track/:number', wrap(async (req, res) => {
  const o = await trackedOrder(req, true);
  const s = await settings.all();
  res.json({
    data: {
      ...pick(o.toJSON(), ['order_number', 'order_status', 'payment_status', 'is_cod', 'amount', 'subtotal', 'discount', 'tax_amount', 'delivery_charges', 'cod_charges', 'city', 'courier', 'tracking_number', 'courier_status', 'courier_status_at', 'created_at', 'dispatched_at', 'delivered_at', 'design_type', 'design_front', 'design_back', 'design_file']),
      payment_type: o.payment_type, receipt_uploaded: !!o.transaction?.attachment,
      name: o.name, items: (o.items || []).map((i) => pick(i.toJSON(), ['name', 'variant', 'quantity', 'unit_price', 'customization', 'customization_price', 'total'])),
      history: (o.status_history || []).map((h) => ({ status: h.status, at: h.at })), courier_history: (o.courier_history || []).slice(-15),
      tags: (await M.ContactTag.findAll({ where: { nfc_order_id: o.id }, order: [['id', 'ASC']], limit: 50 })).map((t) => ({ code: t.code, kind: t.kind, label: t.label, url: contacttags.url(t), qr_url: `${contacttags.url(t)}/qr.png`, manage_url: o.privileged ? contacttags.manageUrl(t) : null })),
    },
    steps: orders.STEPS, labels: orders.LABELS, currency: s.shop_currency_icon || 'Rs',
  });
}));

module.exports = r;
