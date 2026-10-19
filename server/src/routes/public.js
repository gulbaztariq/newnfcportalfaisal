const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const QRCode = require('qrcode');
const dayjs = require('dayjs');
const { Op, fn, col } = require('sequelize');
const M = require('../models');
const { wrap, fail, validate } = require('../utils/http');
const settings = require('../services/settings');
const subs = require('../services/subscription');
const extras = require('../services/extras');
const mail = require('../services/mail');
const { makeUpload, fileUrl, DOC_TYPES } = require('../middleware/upload');
const { render, renderSubPage, renderLocked, renderUnavailable, manifest, vcardFile, vcardCsp } = require('../views/templates/render');
const { renderStore, renderStorePage } = require('../views/store');
const { TEMPLATES } = require('../views/templates/catalog');
const { appUrl, clientUrl, jwtSecret, isProd } = require('../config');
const { esc } = require('../utils/html');
const RESERVED = require('../utils/reserved');

const { isLive } = require('../services/organisation'); // blocked organisation members have no public pages
const api = express.Router();
const pages = express.Router();
const formLimiter = rateLimit({ windowMs: 10 * 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false, message: { message: 'Too many requests, please try again later.' } });
const orderLimiter = rateLimit({ windowMs: 10 * 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false, message: { message: 'Too many orders, please try again later.' } });

/* ================================================================= API */
api.get('/settings', wrap(async (_req, res) => res.json({ data: await settings.publicSettings() })));

/* data for the React landing page (front CMS) */
api.get('/landing', wrap(async (_req, res) => {
  const [features, about, plans, testimonials, faqs, templates, blogs] = await Promise.all([
    M.Feature.findAll({ order: [['id', 'ASC']] }), M.AboutUs.findAll({ order: [['id', 'ASC']], limit: 6 }),
    M.Plan.findAll({ where: { status: true }, include: [M.Currency, { model: M.Template, attributes: ['id'] }], order: [['price', 'ASC']] }),
    M.FrontTestimonial.findAll({ order: [['id', 'DESC']] }), M.FrontFaq.findAll({ order: [['id', 'ASC']] }),
    M.Template.findAll({ where: { status: true }, attributes: ['id', 'name', 'slug', 'profession'], order: [['id', 'ASC']] }),
    M.FrontBlog.findAll({ where: { status: true }, attributes: ['id', 'title', 'slug', 'excerpt', 'image', 'created_at'], order: [['id', 'DESC']], limit: 3 }),
  ]);
  res.set('Cache-Control', 'public, max-age=60');
  res.json({
    settings: await settings.publicSettings(), features, about, testimonials, faqs, templates, blogs,
    plans: plans.map((p) => ({ ...p.toJSON(), templates_count: p.templates.length, templates: undefined })),
  });
}));

api.get('/pages/:slug', wrap(async (req, res) => {
  const key = { 'terms-conditions': 'terms_conditions', 'privacy-policy': 'privacy_policy' }[req.params.slug];
  if (!key) fail(404, 'Not found');
  res.json({ title: req.params.slug === 'terms-conditions' ? 'Terms & Conditions' : 'Privacy Policy', html: await settings.get(key) });
}));

/* front blog */
api.get('/blogs', wrap(async (_req, res) => {
  res.json({ data: await M.FrontBlog.findAll({ where: { status: true }, attributes: ['id', 'title', 'slug', 'excerpt', 'image', 'created_at'], order: [['id', 'DESC']] }) });
}));
api.get('/blogs/:slug', wrap(async (req, res) => {
  const b = await M.FrontBlog.findOne({ where: { slug: req.params.slug, status: true } });
  if (!b) fail(404, 'Not found');
  res.json({ data: b });
}));

/* business directory (vCards + WhatsApp stores that opted in): Recent / Popular / Trending / All, type filter, 12 per page */
const DIR_PER_PAGE = 12;
api.get('/directory', wrap(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  if ((await settings.get('business_directory_enable')) === '0') return res.json({ data: [], meta: { page, per_page: DIR_PER_PAGE, total: 0, pages: 1 }, templates: [] });
  const q = String(req.query.search || '').trim().slice(0, 80);
  const sort = ['recent', 'popular', 'trending', 'all'].includes(req.query.sort) ? req.query.sort : 'recent';
  const type = ['all', 'vcard', 'store'].includes(req.query.type) ? req.query.type : 'all';
  const templateId = Number(req.query.template_id) || 0;
  const where = { business_directory: true, status: true };
  if (q) where[Op.or] = ['name', 'occupation', 'company', 'location', 'first_name', 'last_name'].map((f) => ({ [f]: { [Op.like]: `%${q}%` } }));
  if (templateId) where.template_id = templateId;
  const [vcards, stores, templates, recent] = await Promise.all([
    type === 'store' ? [] : M.Vcard.findAll({ where, attributes: ['id', 'name', 'first_name', 'last_name', 'url_alias', 'occupation', 'company', 'location', 'description', 'profile_image', 'cover_image', 'is_verified', 'template_id', 'theme', 'views', 'created_at'], include: [{ model: M.Template, attributes: ['name', 'profession'] }, { model: M.User, attributes: ['is_active', 'org_status'], where: { is_active: true, org_status: { [Op.or]: [null, { [Op.ne]: 'blocked' }] } } }], limit: 1000 }),
    type === 'vcard' || templateId ? [] : M.WhatsappStore.findAll({ where: { business_directory: true, status: true, ...(q ? { name: { [Op.like]: `%${q}%` } } : {}) }, attributes: ['id', 'name', 'url_alias', 'slogan', 'logo', 'cover_image', 'address', 'views', 'created_at'], limit: 1000 }),
    M.Template.findAll({ where: { status: true }, attributes: ['id', 'name', 'profession'], order: [['id', 'ASC']] }),
    // trending = visits in the last 7 days
    sort === 'trending' && type !== 'store' ? M.VcardView.findAll({ where: { created_at: { [Op.gte]: new Date(Date.now() - 7 * 864e5) } }, attributes: ['vcard_id', [fn('COUNT', col('id')), 'n']], group: ['vcard_id'], raw: true }) : [],
  ]);
  const trend = new Map(recent.map((x) => [x.vcard_id, Number(x.n)]));
  const items = [
    ...vcards.map((v) => ({
      type: 'vcard', id: v.id, name: [v.first_name, v.last_name].filter(Boolean).join(' ') || v.name, url: `/${v.url_alias}`, tagline: [v.occupation, v.company].filter(Boolean).join(' · '),
      description: String(v.description || '').slice(0, 140), location: v.location, cover: v.cover_image, avatar: v.profile_image, verified: v.is_verified, label: v.template?.profession || 'vCard', color: v.theme?.primary || null,
      views: v.views || 0, trend: trend.get(v.id) || 0, date: v.get('created_at'),
    })),
    ...stores.map((st) => ({ type: 'store', id: st.id, name: st.name, url: `/s/${st.url_alias}`, tagline: st.slogan, location: st.address, cover: st.cover_image, avatar: st.logo, label: 'WhatsApp store', views: st.views || 0, trend: 0, date: st.get('created_at') })),
  ];
  const byDate = (a, b) => new Date(b.date) - new Date(a.date);
  items.sort(sort === 'popular' ? (a, b) => b.views - a.views || byDate(a, b)
    : sort === 'trending' ? (a, b) => b.trend - a.trend || b.views - a.views || byDate(a, b)
      : sort === 'all' ? (a, b) => a.name.localeCompare(b.name) : byDate);
  const total = items.length;
  const pages = Math.max(1, Math.ceil(total / DIR_PER_PAGE));
  res.set('Cache-Control', 'public, max-age=60');
  res.json({ data: items.slice((Math.min(page, pages) - 1) * DIR_PER_PAGE, Math.min(page, pages) * DIR_PER_PAGE), meta: { page: Math.min(page, pages), per_page: DIR_PER_PAGE, total, pages }, templates });
}));

async function guardEmail(email) { if (email && (await extras.isBlockedEmail(email))) fail(422, 'Validation failed', { email: 'This e-mail domain is not allowed' }); }

api.post('/contact', formLimiter, wrap(async (req, res) => {
  if (req.body.website) return res.json({ message: 'Thank you!' }); // honeypot
  validate(req.body, { name: 'required|max:120', email: 'required|email|max:191', subject: 'max:255', message: 'required|max:3000' });
  if (!(await extras.verifyRecaptcha(req.body.recaptcha_token, req.ip))) fail(422, 'reCAPTCHA check failed, please try again');
  await guardEmail(req.body.email);
  await M.Enquiry.create({ name: req.body.name, email: req.body.email, subject: req.body.subject, message: req.body.message });
  res.json({ message: 'Thank you for contacting us. We will get back to you soon.' });
}));

api.post('/subscribe', formLimiter, wrap(async (req, res) => {
  validate(req.body, { email: 'required|email|max:191' });
  await guardEmail(req.body.email);
  const email = String(req.body.email).toLowerCase().trim();
  await M.EmailSubscription.findOrCreate({ where: { email } });
  res.json({ message: 'You are subscribed to our newsletter.' });
}));

/* ------------------------------------------------------- vCard public API */
async function liveVcard(alias) {
  const v = await M.Vcard.findOne({ where: { url_alias: alias, status: true }, include: [{ model: M.User, attributes: ['id', 'email', 'first_name', 'is_active', 'org_status'] }] });
  if (!v || !isLive(v.user)) fail(404, 'Not found');
  return v;
}

const enquiryUpload = makeUpload('enquiries', { types: DOC_TYPES, maxMb: 5 }).single('attachment');
api.post('/vcards/:alias/enquiry', formLimiter, enquiryUpload, wrap(async (req, res) => {
  if (req.body.website) return res.json({ message: 'Thank you!' });
  const v = await liveVcard(req.params.alias);
  if (!v.enable_enquiry_form && req.body.message !== 'Downloaded the contact card') fail(404, 'Not found');
  validate(req.body, { name: 'required|max:120', email: 'email|max:191', phone: 'max:30', message: 'required|max:2000', product_name: 'max:150' });
  await guardEmail(req.body.email);
  const e = await M.VcardEnquiry.create({
    vcard_id: v.id, name: req.body.name, email: req.body.email || null, phone: req.body.phone || null, message: req.body.message,
    product_name: req.body.product_name || null, attachment: v.enquiry_attachment && req.file ? fileUrl('enquiries', req.file) : null,
  });
  if (req.body.message !== 'Downloaded the contact card') {
    mail.sendTemplate('enquiry_received', v.user.email, { vcard: v.name, customer: e.name, contact: [e.email, e.phone].filter(Boolean).join(' · '), message: e.message }).catch(() => {});
  }
  res.json({ message: 'Your message has been sent. Thank you!' });
}));

api.post('/vcards/:alias/subscribe', formLimiter, wrap(async (req, res) => {
  const v = await liveVcard(req.params.alias);
  validate(req.body, { email: 'required|email|max:191' });
  await guardEmail(req.body.email);
  await M.VcardSubscriber.findOrCreate({ where: { vcard_id: v.id, email: String(req.body.email).toLowerCase().trim() } });
  res.json({ message: 'Thanks for subscribing!' });
}));

/** free slots for a day (minus booked ones and blocked dates) */
async function freeSlots(v, date) {
  const a = v.appointment_settings || {};
  if (!a.enabled || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return [];
  const d = dayjs(date);
  if (!d.isValid() || d.isBefore(dayjs().startOf('day')) || d.isAfter(dayjs().add(90, 'day')) || (a.blocked || []).includes(date)) return [];
  const key = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][d.day()];
  const dur = Number(a.duration) || 30;
  const toMin = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
  const fmt = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  const booked = new Set((await M.Appointment.findAll({ where: { vcard_id: v.id, date, status: { [Op.ne]: 'cancelled' } }, attributes: ['from_time'], raw: true })).map((x) => x.from_time));
  const nowMin = d.isSame(dayjs(), 'day') ? dayjs().hour() * 60 + dayjs().minute() + 30 : -1;
  const out = [];
  for (const w of a.slots?.[key] || []) {
    for (let m = toMin(w.from); m + dur <= toMin(w.to); m += dur) if (m > nowMin && !booked.has(fmt(m))) out.push({ from: fmt(m), to: fmt(m + dur) });
  }
  return out;
}
api.get('/vcards/:alias/slots', wrap(async (req, res) => {
  const v = await liveVcard(req.params.alias);
  res.set('Cache-Control', 'no-store').json({ data: await freeSlots(v, String(req.query.date || '')) });
}));
api.post('/vcards/:alias/appointments', formLimiter, wrap(async (req, res) => {
  const v = await liveVcard(req.params.alias);
  validate(req.body, { name: 'required|max:120', email: 'email|max:191', phone: 'max:30', date: 'required', from_time: 'required', to_time: 'required', notes: 'max:1000', service_name: 'max:150' });
  if (!req.body.email && !req.body.phone) fail(422, 'Please leave an e-mail or phone number');
  await guardEmail(req.body.email);
  const slot = (await freeSlots(v, req.body.date)).find((s) => s.from === req.body.from_time && s.to === req.body.to_time);
  if (!slot) fail(422, 'This time is no longer available, please pick another slot');
  const a = v.appointment_settings || {};
  const ap = await M.Appointment.create({ vcard_id: v.id, name: req.body.name, email: req.body.email || null, phone: req.body.phone || null, date: req.body.date, from_time: slot.from, to_time: slot.to, notes: req.body.notes || null, service_name: req.body.service_name || null, amount: a.paid ? Number(a.price || 0) : 0 });
  mail.sendTemplate('appointment_booked', v.user.email, { customer: ap.name, date: ap.date, time: `${ap.from_time} - ${ap.to_time}`, vcard: v.name, notes: ap.notes || '' }).catch(() => {});
  extras.slack('appointment', `New appointment on ${ap.date} ${ap.from_time} for ${v.name}`);
  res.status(201).json({ message: 'Your appointment request was sent. You will receive a confirmation soon.' });
}));

/* -------------------------------------------------- WhatsApp store API */
api.post('/stores/:alias/orders', orderLimiter, wrap(async (req, res) => {
  const st = await M.WhatsappStore.findOne({ where: { url_alias: req.params.alias, status: true }, include: [{ model: M.User, attributes: ['email', 'is_active', 'org_status'] }] });
  if (!st || !isLive(st.user)) fail(404, 'Store not found');
  validate(req.body, { customer_name: 'required|max:120', customer_phone: 'required|max:30', customer_address: 'max:500', notes: 'max:500', delivery_type: 'in:delivery,takeaway' });
  const type = req.body.delivery_type || (st.delivery_enabled ? 'delivery' : 'takeaway');
  if ((type === 'delivery' && !st.delivery_enabled) || (type === 'takeaway' && !st.takeaway_enabled)) fail(422, 'This option is not available');
  if (type === 'delivery' && !String(req.body.customer_address || '').trim()) fail(422, 'Validation failed', { customer_address: 'Please enter your delivery address' });
  const lines = (Array.isArray(req.body.items) ? req.body.items : []).slice(0, 50).map((x) => ({ id: Number(x.product_id), qty: Math.min(99, Math.max(1, parseInt(x.qty, 10) || 1)) })).filter((x) => x.id);
  if (!lines.length) fail(422, 'Your cart is empty');
  const products = await M.StoreProduct.findAll({ where: { id: lines.map((l) => l.id), store_id: st.id, status: true } });
  const items = [];
  for (const l of lines) {
    const p = products.find((x) => x.id === l.id);
    if (!p) continue;
    if (p.stock !== null && p.stock < l.qty) fail(422, `Only ${p.stock} left of ${p.name}`);
    items.push({ product_id: p.id, name: p.name, qty: l.qty, price: Number(p.sale_price ?? p.price) });
  }
  if (!items.length) fail(422, 'These products are no longer available');
  const subtotal = Math.round(items.reduce((n, i) => n + i.price * i.qty, 0) * 100) / 100;
  const delivery = type === 'delivery' ? Number(st.delivery_charge || 0) : 0;
  const order = await M.StoreOrder.create({
    store_id: st.id, order_number: `WS-${dayjs().format('YYMMDD')}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`,
    customer_name: req.body.customer_name, customer_phone: req.body.customer_phone, customer_address: req.body.customer_address || null,
    delivery_type: type, items, subtotal, delivery_charge: delivery, total: subtotal + delivery, notes: req.body.notes || null,
  });
  for (const i of items) await M.StoreProduct.decrement('stock', { by: i.qty, where: { id: i.product_id, stock: { [Op.ne]: null } } });
  const cur = st.currency_icon || '';
  const msg = [`*New order ${order.order_number}*`, '', ...items.map((i) => `• ${i.qty} x ${i.name} - ${cur}${(i.price * i.qty).toFixed(2)}`), '',
    `Subtotal: ${cur}${subtotal.toFixed(2)}`, delivery ? `Delivery: ${cur}${delivery.toFixed(2)}` : null, `*Total: ${cur}${(subtotal + delivery).toFixed(2)}*`, '',
    `Name: ${order.customer_name}`, `Phone: ${order.customer_phone}`, type === 'delivery' ? `Address: ${order.customer_address}` : 'Pick-up: Take-away', order.notes ? `Notes: ${order.notes}` : null].filter((x) => x !== null).join('\n');
  mail.sendTemplate('store_order', st.user.email, { order: order.order_number, total: `${cur}${Number(order.total).toFixed(2)}`, store: st.name, customer: order.customer_name }).catch(() => {});
  extras.slack('store_order', `New WhatsApp store order ${order.order_number} (${cur}${Number(order.total).toFixed(2)}) on ${st.name}`);
  res.status(201).json({ message: 'Order created', order_number: order.order_number, whatsapp_url: `https://wa.me/${`${st.region_code || ''}${st.whatsapp_number}`.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}` });
}));

/* ======================================================= vCard pages */
const SAMPLE = {
  url_alias: 'preview', profile_image: '/brand/sample-portrait.svg', name: 'Alex Morgan', first_name: 'Alex', last_name: 'Morgan', occupation: 'Product Designer', company: 'Acme Studio',
  description: 'I design delightful digital products and brand experiences. Let’s build something great together.',
  email: 'alex@example.com', phone: '5550100', region_code: '1', location: 'San Francisco, CA', is_verified: true, show_qr_code: false, enable_enquiry_form: true, sticky_bar: false,
  social_links: { website: 'https://example.com', linkedin: 'https://linkedin.com', instagram: 'https://instagram.com', twitter: 'https://x.com', whatsapp: 'https://wa.me/15550100' },
  custom_links: [{ label: 'My Portfolio', url: 'https://example.com', desc: 'Selected work and case studies' }, { label: 'Book a table', url: 'https://example.com', desc: 'Reserve in 30 seconds', badge: 'New', icon: 'ri-calendar-event-line', featured: true }],
  business_hours: { mon: { open: true, from: '09:00', to: '17:00' }, tue: { open: true, from: '09:00', to: '17:00' }, wed: { open: true, from: '09:00', to: '17:00' }, thu: { open: true, from: '09:00', to: '17:00' }, fri: { open: true, from: '09:00', to: '15:00' } },
  sections: {}, theme: {},
};
const setCsp = (res) => res.set('Content-Security-Policy', vcardCsp(res.locals.nonce, clientUrl));

pages.get('/t/preview/:slug', wrap(async (req, res) => {
  const tpl = await M.Template.findOne({ where: { slug: req.params.slug } }) || TEMPLATES.find((t) => t.slug === req.params.slug);
  if (!tpl) fail(404, 'Not found');
  const s = await settings.all();
  const services = [{ name: 'Brand Identity', description: 'Logos, colour systems and guidelines.' }, { name: 'UI / UX Design', description: 'Web and mobile product design.' }];
  const testimonials = [{ name: 'Jamie Lee', description: 'Wonderful to work with, delivered beyond expectations.' }];
  res.set('X-Robots-Tag', 'noindex');
  setCsp(res);
  // ?full=1 shows the quick-action bar and a sample gallery (the picker thumbnails leave them out)
  const full = req.query.full === '1';
  const gallery = full ? Array.from({ length: 6 }, (_, i) => ({ image: '/brand/sample-portrait.svg', caption: `Sample ${i + 1}` })) : [];
  res.send(render({ v: { ...SAMPLE, sticky_bar: full, menu_pages: full ? ['/brand/sample-portrait.svg', '/brand/sample-portrait.svg', '/brand/sample-portrait.svg'] : [], menu_desc: 'Burgers, pizzas and deals', social_links: { ...SAMPLE.social_links, telegram: 'https://t.me/example' }, theme: req.query.primary ? { primary: `#${String(req.query.primary).replace(/[^0-9a-f]/gi, '')}` } : {} }, template: tpl, services, gallery, testimonials, app: s, appUrl, nonce: res.locals.nonce }));
}));

const unlockSig = (v) => crypto.createHmac('sha256', jwtSecret).update(`${v.id}:${v.password}`).digest('hex').slice(0, 32);
const recentViews = new Map(); // ip+vcard -> timestamp (de-duplicate view counting)
const BOT = /bot|crawl|spider|preview|facebookexternalhit|whatsapp|slurp|curl|wget/i;

function countView(req, v) {
  const ua = String(req.get('user-agent') || '');
  if (BOT.test(ua)) return;
  const ipHash = crypto.createHash('sha256').update(`${req.ip}:${jwtSecret}`).digest('hex');
  const key = `${v.id}:${ipHash}`;
  const now = Date.now();
  if (recentViews.get(key) > now - 30 * 60 * 1000) return;
  recentViews.set(key, now);
  if (recentViews.size > 50000) recentViews.clear();
  const device = /mobile|android|iphone/i.test(ua) ? 'mobile' : /ipad|tablet/i.test(ua) ? 'tablet' : 'desktop';
  M.Vcard.increment('views', { where: { id: v.id } }).catch(() => {});
  M.VcardView.create({ vcard_id: v.id, ip_hash: ipHash, user_agent: ua.slice(0, 255), referrer: String(req.get('referer') || '').slice(0, 255), device }).catch(() => {});
}

async function findVcard(alias) {
  if (!/^[a-z0-9][a-z0-9-_]{1,79}$/i.test(alias) || RESERVED.has(alias.toLowerCase())) return null;
  const v = await M.Vcard.findOne({ where: { url_alias: alias.toLowerCase() }, include: [M.Template, { model: M.User, attributes: ['id', 'is_active', 'org_status'] }] });
  if (!v || !v.status || !isLive(v.user)) return null;
  return v;
}

/* plan checks are cached for a minute to keep the page instant */
const planCache = new Map();
async function planGate(v) {
  const hit = planCache.get(v.user_id);
  if (hit && hit.t > Date.now() - 60_000) return hit.reason;
  let reason = null;
  const sub = await subs.current(v.user_id);
  if (!sub || new Date(sub.ends_at) < new Date()) reason = 'This card is currently unavailable.';
  else if (sub.plan?.no_of_visitors) {
    const ids = (await M.Vcard.findAll({ where: { user_id: v.user_id }, attributes: ['id'], raw: true })).map((x) => x.id);
    const used = await M.VcardView.count({ where: { vcard_id: ids, created_at: { [Op.gte]: extras.periodStart(sub) } } });
    if (used >= sub.plan.no_of_visitors) reason = 'This card has reached its visitor limit for now. Please try again later.';
  }
  planCache.set(v.user_id, { t: Date.now(), reason });
  if (planCache.size > 20000) planCache.clear();
  return reason;
}

const locked = (req, v) => v.password && req.cookies[`vc_unlock_${v.id}`] !== unlockSig(v);

async function vcardPage(req, res, v) {
  const s = await settings.all();
  setCsp(res);
  const reason = await planGate(v);
  if (reason) return res.status(503).send(renderUnavailable({ v, app: s, reason }));
  if (locked(req, v)) return res.send(renderLocked({ v, app: s, nonce: res.locals.nonce }));
  const [services, gallery, testimonials, products, blogs, pageList] = await Promise.all([
    M.VcardService.findAll({ where: { vcard_id: v.id }, order: [['sort', 'ASC'], ['id', 'ASC']] }),
    M.VcardGallery.findAll({ where: { vcard_id: v.id }, limit: 60 }),
    M.VcardTestimonial.findAll({ where: { vcard_id: v.id }, limit: 20 }),
    M.VcardProduct.findAll({ where: { vcard_id: v.id }, order: [['sort', 'ASC'], ['id', 'ASC']], limit: 60 }),
    M.VcardBlog.findAll({ where: { vcard_id: v.id, status: true }, attributes: ['title', 'slug', 'image', 'created_at'], order: [['id', 'DESC']], limit: 6 }),
    M.VcardPage.findAll({ where: { vcard_id: v.id, status: true }, attributes: ['title', 'slug'], order: [['id', 'ASC']] }),
  ]);
  countView(req, v);
  res.set('Cache-Control', 'no-cache');
  if (v.custom_code_enabled && v.custom_code && (await customCodeAllowed(v))) {
    // own design: shown in a sandboxed frame (opaque origin: its scripts can never touch this site's cookies or APIs)
    res.set('Content-Security-Policy', `default-src 'none'; frame-src 'self'; style-src 'unsafe-inline'; img-src 'self' data:; frame-ancestors 'self' ${clientUrl}`);
    return res.send(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(v.name)}</title><meta name="description" content="${esc(v.description || v.occupation || '')}"><link rel="icon" href="${esc(s.favicon || '/brand/favicon.svg')}"><style>html,body{margin:0;height:100%}iframe{border:0;width:100%;height:100%;display:block}</style></head><body><iframe src="/c/${esc(v.url_alias)}" title="${esc(v.name)}" sandbox="allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals allow-downloads" allow="clipboard-write; web-share"></iframe></body></html>`);
  }
  res.send(render({ v, template: v.template, services, gallery, testimonials, products, blogs, pages: pageList, app: s, appUrl, nonce: res.locals.nonce }));
}

async function customCodeAllowed(v) {
  const sub = await require('../services/subscription').current(v.user_id);
  return !!sub?.plan?.features?.custom_code;
}
/* the owner's own HTML/CSS/JS, served with a CSP sandbox (unique origin) so it cannot read cookies or call the API */
pages.get('/c/:alias', wrap(async (req, res, next) => {
  const v = await findVcard(req.params.alias);
  if (!v || !v.custom_code_enabled || !v.custom_code || !(await customCodeAllowed(v))) return next();
  if (locked(req, v)) return res.redirect(302, `/${v.url_alias}`);
  const vals = { name: [v.first_name, v.last_name].filter(Boolean).join(' ') || v.name, first_name: v.first_name, last_name: v.last_name, occupation: v.occupation, company: v.company, email: v.email, phone: v.phone ? `+${v.region_code || ''}${v.phone}` : '', location: v.location, description: v.description, profile_image: v.profile_image ? `${appUrl}${v.profile_image}` : '', cover_image: v.cover_image ? `${appUrl}${v.cover_image}` : '', vcf_url: `${appUrl}/${v.url_alias}/contact.vcf`, card_url: `${appUrl}/${v.url_alias}` };
  const html = String(v.custom_code).replace(/\{\{\s*(\w+)\s*\}\}/g, (m, k) => (k in vals ? esc(vals[k] ?? '') : m));
  res.set('Content-Security-Policy', "sandbox allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals allow-downloads; default-src * data: blob: 'unsafe-inline' 'unsafe-eval'; frame-ancestors 'self'");
  res.set('X-Robots-Tag', 'noindex').set('Cache-Control', 'no-cache');
  res.type('html').send(/<html[\s>]/i.test(html) ? html : `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>${html}</body></html>`);
}));

/* custom domains: an approved domain serves its vCard at "/" */
const appHost = new URL(appUrl).hostname;
async function customDomain(req, res, next) {
  const host = String(req.hostname || '').toLowerCase();
  if (!host || host === appHost || host === 'localhost' || host.endsWith('.up.railway.app') || /^[\d.]+$/.test(host)) return next();
  if (req.path.startsWith('/api') || req.path.startsWith('/uploads') || req.path.startsWith('/vendor') || req.path.startsWith('/brand') || req.path === '/sw.js') return next();
  const v = await M.Vcard.findOne({ where: { custom_domain: host, custom_domain_status: 'approved' }, include: [M.Template, { model: M.User, attributes: ['id', 'is_active', 'org_status'] }] }).catch(() => null);
  if (!v || !v.status || !isLive(v.user)) return next();
  if (req.path === '/' || req.path === `/${v.url_alias}`) return vcardPage(req, res, v).catch(next);
  return next();
}

/* sitemap + robots */
pages.get('/sitemap.xml', wrap(async (_req, res) => {
  const [vcards, blogs, stores] = await Promise.all([
    M.Vcard.findAll({ where: { status: true, password: null }, attributes: ['url_alias', 'updated_at'], limit: 45000 }),
    M.FrontBlog.findAll({ where: { status: true }, attributes: ['slug', 'updated_at'] }),
    M.WhatsappStore.findAll({ where: { status: true }, attributes: ['url_alias', 'updated_at'] }),
  ]);
  const u = (loc, d) => `<url><loc>${appUrl}${loc}</loc>${d ? `<lastmod>${dayjs(d).format('YYYY-MM-DD')}</lastmod>` : ''}</url>`;
  const body = ['/', '/directory', '/blog', '/terms-conditions', '/privacy-policy'].map((x) => u(x)).join('')
    + vcards.map((v) => u(`/${v.url_alias}`, v.updated_at)).join('') + blogs.map((b) => u(`/blog/${b.slug}`, b.updated_at)).join('') + stores.map((st) => u(`/s/${st.url_alias}`, st.updated_at)).join('');
  res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${body}</urlset>`);
}));
pages.get('/robots.txt', (_req, res) => res.type('text/plain').send(`User-agent: *\nDisallow: /admin\nDisallow: /user\nDisallow: /api\nSitemap: ${appUrl}/sitemap.xml\n`));

/* WhatsApp store pages */
pages.get('/s/:alias', wrap(async (req, res, next) => {
  const st = await M.WhatsappStore.findOne({ where: { url_alias: String(req.params.alias).toLowerCase(), status: true }, include: [{ model: M.User, attributes: ['is_active', 'org_status'] }] });
  if (!st || !isLive(st.user)) return next();
  const [categories, products] = await Promise.all([
    M.StoreCategory.findAll({ where: { store_id: st.id }, order: [['sort', 'ASC'], ['id', 'ASC']] }),
    M.StoreProduct.findAll({ where: { store_id: st.id, status: true }, order: [['sort', 'ASC'], ['id', 'ASC']] }),
  ]);
  M.WhatsappStore.increment('views', { where: { id: st.id } }).catch(() => {});
  setCsp(res);
  res.send(renderStore({ st, categories, products, app: await settings.all(), nonce: res.locals.nonce, appUrl }));
}));
pages.get('/s/:alias/:page', wrap(async (req, res, next) => {
  if (!['terms', 'privacy', 'refund', 'shipping'].includes(req.params.page)) return next();
  const st = await M.WhatsappStore.findOne({ where: { url_alias: String(req.params.alias).toLowerCase(), status: true } });
  const key = { terms: 'terms', privacy: 'privacy', refund: 'refund_policy', shipping: 'shipping_policy' }[req.params.page];
  if (!st || !st[key]) return next();
  res.send(renderStorePage({ st, title: { terms: 'Terms & Conditions', privacy: 'Privacy Policy', refund: 'Refund & Cancellation', shipping: 'Shipping & Delivery' }[req.params.page], html: st[key] }));
}));

/* ------------------------------------------------------- contact tags (/tag/{code}): reach the owner without seeing their number */
const contactTags = require('../services/contacttags');
const { renderTag, renderInactive, renderManage } = require('../views/tag');
const tagLimiter = rateLimit({ windowMs: 10 * 60 * 1000, limit: 8, standardHeaders: true, legacyHeaders: false, message: { message: 'Too many messages from this device, please try again later.' } });
const tagScans = new Map(); // ip+tag -> timestamp (one scan counted per minute)
const tagOf = async (code) => (/^[A-Z2-9]{6,12}$/.test(String(code).toUpperCase()) ? M.ContactTag.findOne({ where: { code: String(code).toUpperCase() } }) : null);
const tagHeaders = (res) => { res.set('X-Robots-Tag', 'noindex, nofollow'); res.set('Cache-Control', 'no-store'); setCsp(res); };

pages.get('/tag/:code', wrap(async (req, res) => {
  const [tag, app] = [await tagOf(req.params.code), await settings.all()];
  tagHeaders(res);
  if (!tag || !tag.status) return res.status(404).send(renderInactive({ app, appUrl }));
  const key = `${req.ip}|${tag.id}`;
  if (!BOT.test(req.get('user-agent') || '') && Date.now() - (tagScans.get(key) || 0) > 60000) { tagScans.set(key, Date.now()); if (tagScans.size > 5000) tagScans.clear(); M.ContactTag.increment('scans', { where: { id: tag.id } }).catch(() => {}); }
  res.send(renderTag({ tag, app, appUrl, nonce: res.locals.nonce }));
}));

pages.get('/tag/:code/qr.png', wrap(async (req, res) => {
  const tag = await tagOf(req.params.code);
  if (!tag) return res.status(404).end();
  const png = await QRCode.toBuffer(contactTags.url(tag), { width: 640, margin: 2, errorCorrectionLevel: 'M' });
  res.set('Content-Type', 'image/png').set('Cache-Control', 'public, max-age=86400').send(png);
}));

/** a visitor's message or call-back request: stored, then relayed to the owner (the number is never returned) */
pages.post('/tag/:code/send', tagLimiter, async (req, res, next) => {
  // errors here are JSON (the tag page's script reads them), not the HTML error page
  try { await sendToTagOwner(req, res); } catch (e) { if (e && e.status) return res.status(e.status).json({ message: e.message }); next(e); }
});
const sendToTagOwner = async (req, res) => {
  const tag = await tagOf(req.params.code);
  if (!tag || !tag.status) fail(404, 'This tag is not active');
  const b = req.body || {};
  if (b.website) return res.json({ message: 'Sent.' }); // honeypot
  const type = b.type === 'callback' ? 'callback' : 'message';
  const phone = contactTags.cleanPhone(b.phone);
  const text = String(b.text || '').trim().slice(0, 500);
  const name = String(b.name || '').trim().slice(0, 80);
  if (type === 'callback' && !contactTags.validPhone(phone)) fail(422, 'Please enter your phone number so the owner can call you back.');
  if (type === 'message' && !text) fail(422, 'Please write a short message.');
  if (phone && !contactTags.validPhone(phone)) fail(422, 'That phone number does not look right.');
  const recent = await M.ContactTagMessage.count({ where: { contact_tag_id: tag.id, created_at: { [Op.gte]: new Date(Date.now() - 3600 * 1000) } } });
  if (recent >= 10) fail(429, 'This tag has received many messages in the last hour. Please try again later.');
  const to_role = b.to_role === 'emergency' && tag.emergency_phone ? 'emergency' : 'owner';
  const msg = await M.ContactTagMessage.create({ contact_tag_id: tag.id, to_role, type, name: name || null, phone: phone || null, text: text || null, ip: req.ip });
  const { delivery } = await contactTags.notify(tag, { to_role, type, name, phone, text });
  await msg.update({ delivery });
  const alerted = Object.values(delivery).includes('sent');
  res.json({ delivered: alerted, message: alerted ? (type === 'callback' ? 'Done. The owner has been asked to call you back.' : 'Sent. The owner has been notified.') : 'Your message was saved, but we could not alert the owner right now. Please try again in a little while.' });
};

/* the owner's secret page */
const manageTag = async (req, res) => {
  const tag = await tagOf(req.params.code);
  const k = req.method === 'POST' ? req.body?.k : req.query.k;
  if (!tag || !contactTags.sameToken(k, tag.manage_token)) { tagHeaders(res); return res.status(404).send(renderInactive({ app: await settings.all(), appUrl })); }
  return tag;
};
pages.get('/tag/:code/manage', wrap(async (req, res) => {
  const tag = await manageTag(req, res); if (!tag || res.headersSent) return;
  tagHeaders(res);
  const messages = await M.ContactTagMessage.findAll({ where: { contact_tag_id: tag.id }, order: [['id', 'DESC']], limit: 20 });
  res.send(renderManage({ tag, messages, app: await settings.all(), appUrl, nonce: res.locals.nonce, saved: req.query.saved === '1' }));
}));
pages.post('/tag/:code/manage', formLimiter, wrap(async (req, res) => {
  const tag = await manageTag(req, res); if (!tag || res.headersSent) return;
  const b = req.body; const str = (v, n) => String(v || '').trim().slice(0, n) || null;
  const phone = contactTags.cleanPhone(b.owner_phone); const ephone = contactTags.cleanPhone(b.emergency_phone);
  const email = str(b.owner_email, 191);
  let error = null;
  if (!phone && !email) error = 'Add your phone number or your e-mail, so people can reach you.';
  else if (phone && !contactTags.validPhone(phone)) error = 'Your phone number does not look right.';
  else if (ephone && !contactTags.validPhone(ephone)) error = 'The emergency phone number does not look right.';
  else if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) error = 'Enter a valid e-mail address.';
  if (error) {
    tagHeaders(res);
    const messages = await M.ContactTagMessage.findAll({ where: { contact_tag_id: tag.id }, order: [['id', 'DESC']], limit: 20 });
    return res.status(422).send(renderManage({ tag, messages, app: await settings.all(), appUrl, nonce: res.locals.nonce, error }));
  }
  await tag.update({
    label: str(b.label, 80), kind: contactTags.KINDS.includes(b.kind) ? b.kind : 'other', public_note: str(b.public_note, 300), owner_name: str(b.owner_name, 120), owner_phone: phone || null, owner_email: email,
    emergency_name: str(b.emergency_name, 120), emergency_phone: ephone || null, notify_whatsapp: b.notify_whatsapp === '1', notify_sms: b.notify_sms === '1', notify_email: b.notify_email === '1', status: b.status === '1',
  });
  res.redirect(303, `/tag/${tag.code}/manage?k=${tag.manage_token}&saved=1`);
}));

pages.get('/:alias', wrap(async (req, res, next) => {
  const v = await findVcard(req.params.alias);
  if (!v) return next();
  await vcardPage(req, res, v);
}));

/* sub pages: blog post, custom page, terms, privacy */
async function subPage(req, res, next, build) {
  const v = await findVcard(req.params.alias);
  if (!v) return next();
  const s = await settings.all();
  setCsp(res);
  if (await planGate(v)) return res.status(503).send(renderUnavailable({ v, app: s }));
  if (locked(req, v)) return res.redirect(302, `/${v.url_alias}`);
  const data = await build(v);
  if (!data) return next();
  res.send(renderSubPage({ v, template: v.template, app: s, appUrl, nonce: res.locals.nonce, ...data }));
}
pages.get('/:alias/blog/:slug', wrap((req, res, next) => subPage(req, res, next, async (v) => {
  const b = await M.VcardBlog.findOne({ where: { vcard_id: v.id, slug: req.params.slug, status: true } });
  return b && { title: b.title, bodyHtml: b.description, image: b.image, date: b.created_at };
})));
pages.get('/:alias/p/:slug', wrap((req, res, next) => subPage(req, res, next, async (v) => {
  const pg = await M.VcardPage.findOne({ where: { vcard_id: v.id, slug: req.params.slug, status: true } });
  return pg && { title: pg.title, bodyHtml: pg.content };
})));
pages.get('/:alias/:doc', wrap((req, res, next) => (!['terms', 'privacy'].includes(req.params.doc) ? next() : subPage(req, res, next, async (v) => {
  const html = req.params.doc === 'terms' ? v.terms_conditions : v.privacy_policy;
  return html && { title: req.params.doc === 'terms' ? 'Terms & Conditions' : 'Privacy Policy', bodyHtml: html };
}))));

pages.get('/:alias/manifest.webmanifest', wrap(async (req, res, next) => {
  const v = await findVcard(req.params.alias);
  if (!v || !v.pwa_enable) return next();
  res.type('application/manifest+json').send(JSON.stringify(manifest(v, await settings.all())));
}));

pages.post('/:alias/unlock', formLimiter, express.urlencoded({ extended: false }), wrap(async (req, res, next) => {
  const v = await findVcard(req.params.alias);
  if (!v || !v.password) return next();
  if (!(await bcrypt.compare(String(req.body.password || ''), v.password))) {
    return res.status(422).send(renderLocked({ v, app: await settings.all(), error: 'Incorrect password', nonce: res.locals.nonce }));
  }
  res.cookie(`vc_unlock_${v.id}`, unlockSig(v), { httpOnly: true, sameSite: 'lax', secure: isProd, maxAge: 12 * 3600 * 1000 });
  res.redirect(303, `/${v.url_alias}`);
}));

pages.get('/:alias/contact.vcf', wrap(async (req, res, next) => {
  const v = await findVcard(req.params.alias);
  if (!v || locked(req, v)) return next();
  res.set('Content-Type', 'text/vcard; charset=utf-8').set('Content-Disposition', `attachment; filename="${v.url_alias}.vcf"`).send(vcardFile(v));
}));

pages.get('/:alias/qr.png', wrap(async (req, res, next) => {
  const v = await findVcard(req.params.alias);
  if (!v) return next();
  const q = v.qr_settings || {};
  const png = await QRCode.toBuffer(`${appUrl}/${v.url_alias}`, { width: 480, margin: q.margin ?? 1, errorCorrectionLevel: q.ec || 'M', color: { dark: /^#[0-9a-f]{6}$/i.test(q.fg || '') ? q.fg : /^#[0-9a-f]{6}$/i.test(v.theme?.primary || '') ? v.theme.primary : '#000000', light: /^#[0-9a-f]{6}$/i.test(q.bg || '') ? q.bg : '#ffffff' } });
  res.set('Content-Type', 'image/png').set('Cache-Control', 'public, max-age=3600').send(png);
}));

module.exports = { api, pages, customDomain };
