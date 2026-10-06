/* User panel: WhatsApp stores - catalogue shops whose cart is sent as a WhatsApp order message */
const express = require('express');
const { Op } = require('sequelize');
const sanitizeHtml = require('sanitize-html');
const dayjs = require('dayjs');
const M = require('../../models');
const { wrap, fail, validate, pick, toBool, paginate, paged } = require('../../utils/http');
const { makeUpload, fileUrl } = require('../../middleware/upload');
const { trackStorage, removeOwned, requireFeature } = require('./helpers');
const subs = require('../../services/subscription');
const docs = require('../../services/documents');
const RESERVED = require('../../utils/reserved');

const r = express.Router();
const plain = (h) => sanitizeHtml(String(h || ''), { allowedTags: ['p', 'br', 'b', 'strong', 'i', 'em', 'ul', 'ol', 'li', 'a', 'h2', 'h3'], allowedSchemes: ['http', 'https', 'mailto', 'tel'] });
const STORE_TEMPLATES = ['modern', 'boutique', 'grocery', 'restaurant', 'jewellery', 'electronics', 'fashion', 'beauty', 'home-decor', 'sports'];

async function ownStore(req, id = req.params.sid) {
  const s = await M.WhatsappStore.findOne({ where: { id, user_id: req.user.id } });
  if (!s) fail(404, 'Store not found');
  return s;
}

const storeUpload = makeUpload('stores', { maxMb: 5 }).fields([{ name: 'logo', maxCount: 1 }, { name: 'cover_image', maxCount: 1 }]);
const FIELDS = ['name', 'slogan', 'whatsapp_number', 'region_code', 'email', 'address', 'template', 'currency_code', 'currency_icon', 'announcement', 'delivery_charge', 'site_title', 'meta_description'];

function storeData(b, existing) {
  const d = pick(b, FIELDS);
  for (const [k, v] of Object.entries(d)) if (v === '') d[k] = null;
  if (d.whatsapp_number) d.whatsapp_number = String(d.whatsapp_number).replace(/[^\d]/g, '');
  if (d.region_code) d.region_code = String(d.region_code).replace(/\D/g, '');
  if (d.template && !STORE_TEMPLATES.includes(d.template)) d.template = 'modern';
  if (d.delivery_charge !== undefined) d.delivery_charge = Math.max(0, Number(d.delivery_charge) || 0);
  for (const k of ['delivery_enabled', 'takeaway_enabled', 'status', 'business_directory']) if (b[k] !== undefined) d[k] = toBool(b[k]);
  for (const k of ['terms', 'privacy', 'refund_policy', 'shipping_policy']) if (b[k] !== undefined) d[k] = plain(b[k]) || null;
  if (b.theme) { let t = b.theme; if (typeof t === 'string') { try { t = JSON.parse(t); } catch { t = {}; } } d.theme = Object.fromEntries(Object.entries(pick(t, ['primary', 'secondary', 'background', 'text'])).filter(([, v]) => /^#[0-9a-f]{6}$/i.test(v))); }
  if (b.business_hours) { let h = b.business_hours; if (typeof h === 'string') { try { h = JSON.parse(h); } catch { h = {}; } } d.business_hours = h; }
  if (b.youtube_banner !== undefined) { const m = String(b.youtube_banner || '').match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([\w-]{11})/); d.youtube_banner = m ? m[1] : null; }
  if (existing === undefined && !d.template) d.template = 'modern';
  return d;
}

r.get('/stores', wrap(async (req, res) => {
  const rows = await M.WhatsappStore.findAll({ where: { user_id: req.user.id }, order: [['id', 'DESC']] });
  const counts = await M.StoreOrder.count({ where: { store_id: rows.map((s) => s.id) }, group: ['store_id'] });
  const byStore = Object.fromEntries(counts.map((c) => [c.store_id, c.count]));
  res.json({ data: rows.map((s) => ({ ...s.toJSON(), orders_count: byStore[s.id] || 0 })), templates: STORE_TEMPLATES });
}));
r.post('/stores', storeUpload, trackStorage, wrap(async (req, res) => {
  await requireFeature(req, 'whatsapp_store', 'WhatsApp store');
  validate(req.body, { name: 'required|max:150', url_alias: 'required|alias', whatsapp_number: 'required|max:30' });
  const sub = await subs.current(req.user.id);
  const limit = sub?.plan?.no_of_whatsapp_stores || 1;
  if ((await M.WhatsappStore.count({ where: { user_id: req.user.id } })) >= limit) fail(422, `Your plan allows ${limit} store(s)`);
  const alias = String(req.body.url_alias).toLowerCase();
  if (RESERVED.has(alias) || (await M.WhatsappStore.findOne({ where: { url_alias: alias } }))) fail(422, 'Validation failed', { url_alias: 'This store link is already taken' });
  const st = await M.WhatsappStore.create({ ...storeData(req.body), url_alias: alias, user_id: req.user.id, logo: fileUrl('stores', req.files?.logo?.[0]), cover_image: fileUrl('stores', req.files?.cover_image?.[0]) });
  res.status(201).json({ data: st, message: 'Store created' });
}));
r.get('/stores/:sid', wrap(async (req, res) => {
  const st = await ownStore(req);
  const [categories, products] = await Promise.all([
    M.StoreCategory.findAll({ where: { store_id: st.id }, order: [['sort', 'ASC'], ['id', 'ASC']] }),
    M.StoreProduct.findAll({ where: { store_id: st.id }, order: [['sort', 'ASC'], ['id', 'ASC']] }),
  ]);
  res.json({ data: { ...st.toJSON(), categories, products }, templates: STORE_TEMPLATES });
}));
r.put('/stores/:sid', storeUpload, trackStorage, wrap(async (req, res) => {
  const st = await ownStore(req);
  validate({ ...st.toJSON(), ...req.body }, { name: 'required|max:150', whatsapp_number: 'required|max:30' });
  const data = storeData(req.body, st);
  if (req.body.url_alias && req.body.url_alias.toLowerCase() !== st.url_alias) {
    const alias = req.body.url_alias.toLowerCase();
    if (!/^[a-z0-9][a-z0-9-_]{1,79}$/.test(alias) || RESERVED.has(alias) || (await M.WhatsappStore.findOne({ where: { url_alias: alias } }))) fail(422, 'Validation failed', { url_alias: 'This store link is not available' });
    data.url_alias = alias;
  }
  for (const f of ['logo', 'cover_image']) if (req.files?.[f]?.[0]) { removeOwned(req, st[f]); data[f] = fileUrl('stores', req.files[f][0]); }
  await st.update(data);
  res.json({ data: st, message: 'Store updated' });
}));
r.post('/stores/:sid/duplicate', wrap(async (req, res) => {
  const st = await ownStore(req);
  const sub = await subs.current(req.user.id);
  if ((await M.WhatsappStore.count({ where: { user_id: req.user.id } })) >= (sub?.plan?.no_of_whatsapp_stores || 1)) fail(422, 'Store limit reached');
  const j = { ...st.get() }; delete j.id; delete j.created_at; delete j.updated_at;
  const copy = await M.WhatsappStore.create({ ...j, url_alias: `${st.url_alias}-copy-${Date.now().toString(36)}`.slice(0, 80), name: `${st.name} (copy)`, views: 0 });
  const catMap = {};
  for (const c of await M.StoreCategory.findAll({ where: { store_id: st.id }, raw: true })) { const old = c.id; delete c.id; catMap[old] = (await M.StoreCategory.create({ ...c, store_id: copy.id })).id; }
  for (const p of await M.StoreProduct.findAll({ where: { store_id: st.id }, raw: true })) { delete p.id; await M.StoreProduct.create({ ...p, store_id: copy.id, category_id: catMap[p.category_id] || null }); }
  res.status(201).json({ data: copy, message: 'Store duplicated' });
}));
r.delete('/stores/:sid', wrap(async (req, res) => {
  const st = await ownStore(req);
  removeOwned(req, st.logo); removeOwned(req, st.cover_image);
  await st.destroy();
  res.json({ message: 'Store deleted' });
}));

/* categories */
const catUpload = makeUpload('stores', { maxMb: 5 }).single('image');
r.post('/stores/:sid/categories', catUpload, trackStorage, wrap(async (req, res) => {
  const st = await ownStore(req);
  validate(req.body, { name: 'required|max:120' });
  const c = await M.StoreCategory.create({ store_id: st.id, name: req.body.name, sort: Number(req.body.sort || 0), image: fileUrl('stores', req.file) });
  res.status(201).json({ data: c, message: 'Category added' });
}));
r.put('/stores/:sid/categories/:cid', catUpload, trackStorage, wrap(async (req, res) => {
  const st = await ownStore(req);
  const c = await M.StoreCategory.findOne({ where: { id: req.params.cid, store_id: st.id } });
  if (!c) fail(404, 'Not found');
  const data = { name: req.body.name || c.name, sort: Number(req.body.sort ?? c.sort) };
  if (req.file) { removeOwned(req, c.image); data.image = fileUrl('stores', req.file); }
  await c.update(data);
  res.json({ data: c, message: 'Category updated' });
}));
r.delete('/stores/:sid/categories/:cid', wrap(async (req, res) => {
  const st = await ownStore(req);
  const c = await M.StoreCategory.findOne({ where: { id: req.params.cid, store_id: st.id } });
  if (!c) fail(404, 'Not found');
  await M.StoreProduct.update({ category_id: null }, { where: { category_id: c.id } });
  removeOwned(req, c.image);
  await c.destroy();
  res.json({ message: 'Category deleted' });
}));

/* products */
const prodUpload = makeUpload('stores', { maxMb: 5 }).array('images', 6);
const prodData = (b) => {
  const d = pick(b, ['name', 'description', 'price', 'sale_price', 'stock', 'sort', 'category_id']);
  d.price = Number(d.price || 0);
  d.sale_price = d.sale_price === '' || d.sale_price === undefined || d.sale_price === null ? null : Number(d.sale_price);
  d.stock = d.stock === '' || d.stock === undefined || d.stock === null ? null : Math.max(0, parseInt(d.stock, 10) || 0);
  d.sort = Number(d.sort || 0);
  d.category_id = d.category_id ? Number(d.category_id) : null;
  if (b.status !== undefined) d.status = toBool(b.status);
  return d;
};
r.post('/stores/:sid/products', prodUpload, trackStorage, wrap(async (req, res) => {
  const st = await ownStore(req);
  validate(req.body, { name: 'required|max:150', price: 'required|numeric', sale_price: 'numeric', stock: 'numeric' });
  const data = prodData(req.body);
  if (data.category_id && !(await M.StoreCategory.findOne({ where: { id: data.category_id, store_id: st.id } }))) data.category_id = null;
  const p = await M.StoreProduct.create({ ...data, store_id: st.id, images: (req.files || []).map((f) => fileUrl('stores', f)) });
  res.status(201).json({ data: p, message: 'Product added' });
}));
r.put('/stores/:sid/products/:pid', prodUpload, trackStorage, wrap(async (req, res) => {
  const st = await ownStore(req);
  const p = await M.StoreProduct.findOne({ where: { id: req.params.pid, store_id: st.id } });
  if (!p) fail(404, 'Not found');
  validate({ ...p.toJSON(), ...req.body }, { name: 'required|max:150', price: 'required|numeric' });
  let keep = p.images || [];
  if (req.body.keep_images !== undefined) {
    let k = []; try { k = JSON.parse(req.body.keep_images); } catch { k = []; }
    for (const u of keep) if (!k.includes(u)) removeOwned(req, u);
    keep = keep.filter((u) => k.includes(u));
  }
  await p.update({ ...prodData(req.body), images: [...keep, ...(req.files || []).map((f) => fileUrl('stores', f))].slice(0, 6) });
  res.json({ data: p, message: 'Product updated' });
}));
r.delete('/stores/:sid/products/:pid', wrap(async (req, res) => {
  const st = await ownStore(req);
  const p = await M.StoreProduct.findOne({ where: { id: req.params.pid, store_id: st.id } });
  if (!p) fail(404, 'Not found');
  for (const u of p.images || []) removeOwned(req, u);
  await p.destroy();
  res.json({ message: 'Product deleted' });
}));

/* orders */
r.get('/store-orders', wrap(async (req, res) => {
  const p = paginate(req);
  const storeIds = (await M.WhatsappStore.findAll({ where: { user_id: req.user.id }, attributes: ['id'] })).map((s) => s.id);
  const where = { store_id: req.query.store_id ? storeIds.filter((id) => id === Number(req.query.store_id)) : storeIds };
  if (req.query.status) where.status = req.query.status;
  const q = (req.query.search || '').trim();
  if (q) where[Op.or] = ['order_number', 'customer_name', 'customer_phone'].map((f) => ({ [f]: { [Op.like]: `%${q}%` } }));
  const { rows, count } = await M.StoreOrder.findAndCountAll({ where, include: [{ model: M.WhatsappStore, attributes: ['id', 'name', 'currency_icon'] }], order: [['id', 'DESC']], limit: p.limit, offset: p.offset });
  res.json(paged(rows, count, p));
}));
async function ownOrder(req) {
  const o = await M.StoreOrder.findByPk(req.params.oid, { include: [M.WhatsappStore] });
  if (!o || o.whatsapp_store.user_id !== req.user.id) fail(404, 'Order not found');
  return o;
}
r.patch('/store-orders/:oid', wrap(async (req, res) => {
  validate(req.body, { status: 'required|in:pending,confirmed,dispatched,delivered,cancelled' });
  const o = await ownOrder(req);
  // put stock back when an order is cancelled
  if (req.body.status === 'cancelled' && o.status !== 'cancelled') {
    for (const it of o.items || []) await M.StoreProduct.increment('stock', { by: it.qty, where: { id: it.product_id, stock: { [Op.ne]: null } } });
  }
  await o.update({ status: req.body.status });
  res.json({ message: `Order ${req.body.status}` });
}));
r.delete('/store-orders/:oid', wrap(async (req, res) => { const o = await ownOrder(req); await o.destroy(); res.json({ message: 'Order deleted' }); }));
r.get('/store-orders/:oid/invoice', wrap(async (req, res) => {
  const o = await ownOrder(req);
  const cur = o.whatsapp_store.currency_icon || '$';
  const pdf = await docs.invoicePdf({
    number: o.order_number, date: o.created_at, status: o.status, method: o.delivery_type === 'takeaway' ? 'Take-away' : 'Delivery',
    billTo: { name: o.customer_name, email: o.customer_phone, address: o.customer_address },
    items: (o.items || []).map((it) => ({ description: it.name, qty: it.qty, price: Number(it.price) })),
    subtotal: Number(o.subtotal), discount: 0, delivery: Number(o.delivery_charge), total: Number(o.total), currency: cur,
  });
  res.type('application/pdf').set('Content-Disposition', `attachment; filename="${o.order_number}.pdf"`).send(pdf);
}));
r.get('/stores/:sid/analytics', wrap(async (req, res) => {
  const st = await ownStore(req);
  const since = dayjs().subtract(29, 'day').startOf('day');
  const orders = await M.StoreOrder.findAll({ where: { store_id: st.id, created_at: { [Op.gte]: since.toDate() } }, raw: true });
  const byDay = Array.from({ length: 30 }, (_, i) => since.add(i, 'day')).map((d) => {
    const day = orders.filter((o) => dayjs(o.created_at).isSame(d, 'day') && o.status !== 'cancelled');
    return { label: d.format('DD MMM'), value: day.length, revenue: day.reduce((n, o) => n + Number(o.total), 0) };
  });
  const top = {};
  for (const o of orders) if (o.status !== 'cancelled') for (const it of (typeof o.items === 'string' ? JSON.parse(o.items) : o.items) || []) top[it.name] = (top[it.name] || 0) + it.qty;
  res.json({ views: st.views, orders: orders.length, revenue: byDay.reduce((n, d) => n + d.revenue, 0), byDay, top: Object.entries(top).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 5) });
}));

module.exports = r;
