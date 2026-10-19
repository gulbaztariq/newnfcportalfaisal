/*
 * Admin: orders (shop + portal) with courier + workflow, product costing (BOM), dynamic short links, invoices,
 * finance (accounts, partners, expenses/income, courier settlements, ledger, profit analytics), inventory
 * (items, stock movements, transfers, purchases/imports), printing vendors (rates, bills, payments),
 * announcements, activity / message logs, roles meta, security bans.
 */
const express = require('express');
const dayjs = require('dayjs');
const { Op } = require('sequelize');
const sanitizeHtml = require('sanitize-html');
const M = require('../../models');
const crud = require('../../utils/crud');
const { wrap, fail, validate, pick, toBool, paginate, paged } = require('../../utils/http');
const { makeUpload, fileUrl, DOC_TYPES } = require('../../middleware/upload');
const settings = require('../../services/settings');
const orders = require('../../services/orders');
const leopards = require('../../services/leopards');
const messaging = require('../../services/messaging');
const inventory = require('../../services/inventory');
const invoices = require('../../services/invoices');
const finance = require('../../services/finance');
const shortlinks = require('../../services/shortlinks');
const perms = require('../../services/permissions');
const security = require('../../services/security');
const mail = require('../../services/mail');
const docs = require('../../services/documents');
const { appUrl, clientUrl } = require('../../config');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const subs = require('../../services/subscription');
const onboarding = require('../../services/onboarding');
const productsync = require('../../services/productsync');

const r = express.Router();
const r2 = (n) => Math.round(Number(n || 0) * 100) / 100;
const jsonList = (v) => { if (Array.isArray(v)) return v; try { const j = JSON.parse(v); return Array.isArray(j) ? j : []; } catch { return []; } };
const richText = (h) => sanitizeHtml(String(h || ''), { allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img', 'h1', 'h2', 'span', 'u', 's']), allowedAttributes: { ...sanitizeHtml.defaults.allowedAttributes, '*': ['class', 'style'], img: ['src', 'alt'] }, allowedSchemes: ['http', 'https', 'mailto', 'tel'] });
const docUpload = (folder) => makeUpload(folder, { types: DOC_TYPES, maxMb: 8 });
const today = () => dayjs().format('YYYY-MM-DD');

/* ============================================================== meta */
r.get('/roles/meta', (_req, res) => res.json({ modules: perms.ADMIN_MODULES, defaults: { manager: perms.DEFAULTS.manager, supervisor: perms.DEFAULTS.supervisor } }));
r.get('/security/bans', (_req, res) => res.json({ data: security.bannedList() }));
r.delete('/security/bans/:ip', (req, res) => { security.unban(req.params.ip); res.json({ message: 'IP unbanned' }); });

/* ============================================================== products (shop) */
const PRODUCT_FIELDS = ['name', 'description', 'price', 'status', 'slug', 'category', 'sku', 'short_description', 'compare_price', 'customization_price', 'size_label', 'variants', 'featured', 'show_in_shop', 'sort', 'weight_grams', 'extra_cost', 'track_stock', 'plan_id', 'product_kind', 'discount_type', 'discount_value', 'sample_price', 'wholesale_tiers', 'order_source_id'];
const PRODUCT_KINDS = ['nfc_profile', 'social_static', 'social_dynamic', 'social_profile', 'printing', 'digital'];
const slugify = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 140);
r.get('/nfc-cards/:id/components', wrap(async (req, res) => {
  const rows = await M.ProductComponent.findAll({ where: { nfc_card_id: req.params.id }, include: [{ model: M.InventoryItem, as: 'item' }] });
  res.json({ data: rows, unit_cost: await inventory.productUnitCost(req.params.id) });
}));
r.put('/nfc-cards/:id/components', wrap(async (req, res) => {
  const p = await M.NfcCard.findByPk(req.params.id);
  if (!p) fail(404, 'Not found');
  const list = jsonList(req.body.components).filter((c) => c.inventory_item_id && Number(c.quantity) > 0);
  await M.ProductComponent.destroy({ where: { nfc_card_id: p.id } });
  for (const c of list) await M.ProductComponent.create({ nfc_card_id: p.id, inventory_item_id: Number(c.inventory_item_id), quantity: Number(c.quantity) });
  if (req.body.extra_cost !== undefined) await p.update({ extra_cost: r2(req.body.extra_cost) });
  res.json({ message: 'Costing saved', unit_cost: await inventory.productUnitCost(p.id) });
}));
r.use('/nfc-cards', crud(M.NfcCard, {
  fields: PRODUCT_FIELDS, booleans: ['status', 'featured', 'show_in_shop', 'track_stock'], files: ['front_image', 'back_image'], folder: 'nfc',
  rules: { name: 'required|max:120', price: 'required|numeric' }, search: ['name', 'sku', 'category'], order: [['sort', 'ASC'], ['id', 'ASC']],
  include: [{ model: M.Plan, as: 'plan', attributes: ['id', 'name', 'frequency'] }],
  beforeSave: async (data, _req, row) => {
    if (data.plan_id !== undefined) data.plan_id = Number(data.plan_id) || null; // empty = non-plan product
    if (data.order_source_id !== undefined) data.order_source_id = Number(data.order_source_id) || null;
    if (data.product_kind !== undefined) data.product_kind = PRODUCT_KINDS.includes(data.product_kind) ? data.product_kind : null;
    if (data.discount_type !== undefined) data.discount_type = ['fixed', 'percent'].includes(data.discount_type) ? data.discount_type : null;
    if (data.discount_value !== undefined) data.discount_value = Math.max(0, r2(data.discount_value));
    if (data.discount_type === 'percent' && Number(data.discount_value) > 100) data.discount_value = 100;
    if (data.sample_price !== undefined) data.sample_price = data.sample_price === '' || data.sample_price === null ? null : Math.max(0, r2(data.sample_price));
    if (data.wholesale_tiers !== undefined) { const t = orders.parseTiers(data.wholesale_tiers); data.wholesale_tiers = t.length ? t : null; } // empty = use the global tiers
    if (row?.order_source_id && data.price !== undefined && r2(data.price) !== r2(row.price)) data.price_locked = true; // hand-edited price: the sync keeps it
    if (data.variants !== undefined) data.variants = jsonList(data.variants).filter((v) => v && v.name).map((v) => ({ name: String(v.name).slice(0, 60), price_delta: r2(v.price_delta) }));
    const base = slugify(data.slug || data.name || row?.name) || `product-${Date.now()}`;
    if (!row || (data.slug !== undefined && data.slug !== row.slug) || !row.slug) {
      let slug = base; let i = 1;
      while (await M.NfcCard.findOne({ where: { slug, id: { [Op.ne]: row?.id || 0 } } })) slug = `${base}-${++i}`;
      data.slug = slug;
    }
    return data;
  },
}));

/* ============================================================== orders */
const ORDER_INCLUDE = () => [
  { model: M.User, attributes: ['id', 'first_name', 'last_name', 'email'] }, { model: M.Vcard, attributes: ['id', 'name', 'url_alias'] },
  { model: M.NfcCard, attributes: ['id', 'name', 'front_image'] }, { model: M.NfcOrderItem, as: 'items' }, M.Transaction,
  { model: M.OrderSource, as: 'order_source', attributes: ['id', 'name'] }, { model: M.User, as: 'creator', attributes: ['id', 'first_name', 'last_name', 'role'] },
  { model: M.GuestCustomer, as: 'guest', attributes: ['id', 'name'] }, { model: M.User, as: 'organisation', attributes: ['id', 'first_name', 'last_name'], include: [{ model: M.Organisation, attributes: ['name', 'logo'] }] },
];
const listOrders = wrap(async (req, res) => {
  const p = paginate(req);
  const where = {};
  for (const k of ['order_status', 'payment_status', 'source', 'order_source_id', 'fulfilment', 'created_by', 'order_type']) if (req.query[k]) where[k] = req.query[k];
  if (req.query.customer === 'guest') where.guest_customer_id = { [Op.ne]: null };
  if (req.query.customer === 'organisation') where.organisation_id = { [Op.ne]: null };
  if (req.query.customer === 'registered') Object.assign(where, { user_id: { [Op.ne]: null }, organisation_id: null });
  for (const k of ['guest_customer_id', 'organisation_id']) if (req.query[k]) where[k] = req.query[k];
  if (req.query.is_cod !== undefined && req.query.is_cod !== '') where.is_cod = toBool(req.query.is_cod);
  if (req.query.courier === 'booked') where.tracking_number = { [Op.ne]: null };
  if (req.query.courier === 'unbooked') where.tracking_number = null;
  if (req.query.from) where.created_at = { [Op.gte]: dayjs(req.query.from).startOf('day').toDate(), ...(req.query.to ? { [Op.lte]: dayjs(req.query.to).endOf('day').toDate() } : {}) };
  const q = (req.query.search || '').trim();
  if (q) where[Op.or] = ['order_number', 'name', 'email', 'phone', 'company_name', 'tracking_number', 'city'].map((f) => ({ [f]: { [Op.like]: `%${q}%` } }));
  const { rows, count } = await M.NfcOrder.findAndCountAll({ where, order: [['id', 'DESC']], limit: p.limit, offset: p.offset, include: ORDER_INCLUDE(), distinct: true });
  const counts = await M.NfcOrder.count({ group: ['order_status'] });
  res.json({ ...paged(rows, count, p), counts: Object.fromEntries(counts.map((c) => [c.order_status, c.count])), labels: orders.LABELS, steps: orders.STEPS });
});
r.get('/orders', listOrders);
r.get('/nfc-orders', listOrders);

r.get('/orders/:id', wrap(async (req, res) => {
  const o = await M.NfcOrder.findByPk(req.params.id, { include: ORDER_INCLUDE() });
  if (!o) fail(404, 'Not found');
  const [invoice, messages, movements, links, vendors] = await Promise.all([
    M.Invoice.findOne({ where: { nfc_order_id: o.id }, attributes: ['id', 'number', 'status', 'total', 'paid_amount', 'token'] }),
    M.MessageLog.findAll({ where: { nfc_order_id: o.id }, order: [['id', 'DESC']], limit: 50 }),
    M.StockMovement.findAll({ where: { nfc_order_id: o.id }, include: [{ model: M.InventoryItem, as: 'item', attributes: ['name'] }, { model: M.Vendor, as: 'location', attributes: ['name'] }] }),
    M.ShortLink.findAll({ where: { nfc_order_id: o.id } }),
    M.Vendor.findAll({ where: { status: true }, attributes: ['id', 'name', 'type'] }),
  ]);
  res.json({ data: o, invoice, messages, movements, links: links.map((l) => ({ ...l.toJSON(), short_url: shortlinks.shortUrl(l.code) })), vendors, labels: orders.LABELS, steps: orders.STEPS, track_url: `${appUrl}/track/${o.order_number}?t=${o.access_token}` });
}));

/* ---------------------------------------------- admin creates an order (wizard: phone / WhatsApp / walk-in / other websites) */
/** credit for a bulk order that follows a sample order: the sample products' total (never delivery), once per sample order */
async function sampleCreditFor(b) {
  if (b.order_type !== 'wholesale' || !b.sample_order_id || (await settings.get('sample_credit_enable')) === '0') return { credit: 0, order: null };
  const so = await M.NfcOrder.findOne({ where: { id: b.sample_order_id, order_type: 'sample', order_status: { [Op.ne]: 'cancelled' } }, include: [{ model: M.NfcOrderItem, as: 'items' }] });
  if (!so) fail(422, 'Validation failed', { sample_order_id: 'Choose a sample order' });
  const used = await M.NfcOrder.count({ where: { parent_order_id: so.id, order_status: { [Op.ne]: 'cancelled' } } });
  if (used) fail(422, 'Validation failed', { sample_order_id: 'This sample order was already credited to a bulk order' });
  return { credit: r2((so.items || []).reduce((a, i) => a + Number(i.total), 0)), order: so };
}
const adminQuoteOpts = async (b) => {
  const collection = b.fulfilment === 'collection';
  return {
    is_cod: !collection && b.order_type !== 'digital' && toBool(b.is_cod), collection, priceOverride: true, orderType: b.order_type || 'nfc_profile', sampleCredit: (await sampleCreditFor(b)).credit,
    discountType: b.discount_type === 'percent' ? 'percent' : 'fixed', discountValue: b.discount_value,
    delivery: b.delivery_charges === undefined || b.delivery_charges === null || b.delivery_charges === '' ? undefined : b.delivery_charges,
  };
};
const quoteJson = (q) => ({ ...q, lines: q.lines.map(({ product, ...l }) => ({ ...l, product_id: product.id })) });

r.get('/orders-meta', wrap(async (_req, res) => {
  const s = await settings.all();
  const [sources, products, plans] = await Promise.all([
    M.OrderSource.findAll({ where: { status: true }, attributes: ['id', 'name', 'url'], order: [['name', 'ASC']] }),
    M.NfcCard.findAll({ where: { status: true }, attributes: ['id', 'name', 'price', 'variants', 'customization_price', 'plan_id', 'front_image', 'product_kind', 'order_source_id', 'discount_type', 'discount_value', 'sample_price', 'wholesale_tiers'], include: [{ model: M.Plan, as: 'plan', attributes: ['id', 'name'] }], order: [['sort', 'ASC'], ['id', 'ASC']] }),
    M.Plan.findAll({ where: { status: true }, attributes: ['id', 'name'] }),
  ]);
  res.json({
    sources, products, plans, dummy_domain: await orders.dummyDomain(), currency: s.shop_currency_icon || 'Rs',
    order_types: Object.entries(orders.ORDER_TYPES).map(([key, t]) => ({ key, ...t })), wholesale_tiers: orders.parseTiers(s.wholesale_tiers), sample_markup_percent: Number(s.sample_markup_percent || 0), sample_max_qty: Number(s.sample_max_qty || 5), sample_credit_enable: s.sample_credit_enable !== '0',
    delivery_charges: Number(s.delivery_charges || 0), cod_charges: Number(s.cod_charges || 0), tax_name: s.nfc_tax_name || 'Tax', tax_rate: Number(s.nfc_tax_rate || 0),
  });
}));
/* sample orders that can still be credited to a bulk order */
r.get('/sample-orders', wrap(async (req, res) => {
  const q = String(req.query.q || '').trim().slice(0, 80);
  const where = { order_type: 'sample', order_status: { [Op.ne]: 'cancelled' } };
  if (q) where[Op.or] = ['order_number', 'name', 'phone', 'company_name'].map((f) => ({ [f]: { [Op.like]: `%${q}%` } }));
  const rows = await M.NfcOrder.findAll({ where, include: [{ model: M.NfcOrderItem, as: 'items' }], order: [['id', 'DESC']], limit: 25 });
  const used = new Set((await M.NfcOrder.findAll({ where: { parent_order_id: rows.map((o) => o.id), order_status: { [Op.ne]: 'cancelled' } }, attributes: ['parent_order_id'], raw: true })).map((x) => x.parent_order_id));
  res.json({ data: rows.filter((o) => !used.has(o.id)).map((o) => ({ id: o.id, order_number: o.order_number, name: o.name, company_name: o.company_name, phone: o.phone, status: o.order_status, credit: r2((o.items || []).reduce((a, i) => a + Number(i.total), 0)), created_at: o.created_at })) });
}));
r.post('/orders/quote', wrap(async (req, res) => {
  res.json(quoteJson(await orders.quote(jsonList(req.body.items), await adminQuoteOpts(req.body))));
}));

/*
 * customer_type: existing (a registered customer, user_id) | new (creates an account + vCard) |
 * organisation (organisation_id = owner, contact_id = the person who placed it) | guest (no account: Guest customers)
 */
const phoneKey = (p) => String(p || '').replace(/\D/g, '').slice(-10) || null;
r.post('/orders', wrap(async (req, res) => {
  const b = req.body;
  const collection = b.fulfilment === 'collection';
  const type = ['existing', 'new', 'organisation', 'guest'].includes(b.customer_type) ? b.customer_type : toBool(b.create_account) ? 'new' : 'guest';
  // phone and address are optional for staff orders
  validate(b, { name: 'required|max:120', phone: 'max:30', address: 'max:1000', city: 'max:120', email: `${type === 'new' ? 'required|' : ''}email|max:191`, company_name: 'max:150', discount_value: 'numeric', delivery_charges: 'numeric' });
  if (b.discount_type === 'percent' && Number(b.discount_value) > 100) fail(422, 'Validation failed', { discount_value: 'A percentage cannot be more than 100' });
  const source = b.order_source_id ? await M.OrderSource.findByPk(b.order_source_id) : null;
  if (b.order_source_id && !source) fail(422, 'Validation failed', { order_source_id: 'Unknown order source' });
  if (b.order_type && !orders.ORDER_TYPES[b.order_type]) fail(422, 'Validation failed', { order_type: 'Unknown order type' });
  const sampleOf = (await sampleCreditFor(b)).order;
  const q = await orders.quote(jsonList(b.items), await adminQuoteOpts(b));
  const email = b.email ? String(b.email).toLowerCase().trim() : null;
  const dummy = email ? await orders.isDummyEmail(email) : false;

  let user = null; let vcard = null; let account = null; let guest = null; let orgOwner = null;
  if (type === 'existing') {
    user = await M.User.findOne({ where: { id: b.user_id || 0, role: 'user' } });
    if (!user) fail(422, 'Validation failed', { user_id: 'Choose a customer' });
    if (user.is_organisation) orgOwner = user;
    else if (user.organisation_id) orgOwner = await M.User.findByPk(user.organisation_id);
  } else if (type === 'organisation') {
    orgOwner = await M.User.findOne({ where: { id: b.organisation_id || 0, role: 'user', is_organisation: true } });
    if (!orgOwner) fail(422, 'Validation failed', { organisation_id: 'Choose an organisation' });
    user = b.contact_id ? await M.User.findOne({ where: { id: b.contact_id, [Op.or]: [{ id: orgOwner.id }, { organisation_id: orgOwner.id }] } }) : orgOwner;
    if (!user) fail(422, 'Validation failed', { contact_id: 'This person is not in the organisation' });
  } else if (type === 'new') {
    // new customer: account + vCard (plan comes from the products); an existing account with this e-mail is reused
    user = await M.User.findOne({ where: { email } });
    if (user && user.role !== 'user') fail(422, 'Validation failed', { email: 'This e-mail belongs to a staff account' });
    const plan = q.lines.find((l) => l.product.plan_id)?.product.plan_id;
    if (!user) {
      const password = crypto.randomBytes(6).toString('base64url');
      const [first, ...rest] = String(b.name).trim().split(/\s+/);
      user = await M.User.create({ first_name: first.slice(0, 100), last_name: rest.join(' ').slice(0, 100), email, contact: b.phone || null, role: 'user', password: await bcrypt.hash(password, 12), email_verified_at: new Date(), affiliate_code: crypto.randomBytes(5).toString('hex') });
      const planRow = plan ? await M.Plan.findByPk(plan) : null;
      if (planRow) await subs.activate(user.id, planRow, { paymentType: 'admin' }); else await subs.assignDefaultPlan(user.id);
      if (!dummy) mail.sendTemplate('welcome', email, { name: user.first_name, email, password, login_url: `${clientUrl}/login` }).catch(() => {});
      account = { created: true, email, password, plan: planRow?.name || null };
    } else {
      account = { created: false, email };
    }
  } else {
    // guest: recognised again by phone or e-mail, details refreshed
    const key = phoneKey(b.phone);
    guest = b.guest_customer_id ? await M.GuestCustomer.findByPk(b.guest_customer_id) : null;
    if (!guest && (key || email)) guest = await M.GuestCustomer.findOne({ where: { [Op.or]: [key && { phone_key: key }, email && { email }].filter(Boolean) }, order: [['id', 'DESC']] });
    const g = { name: b.name, phone: b.phone || null, phone_key: key, email, company_name: b.company_name || null, address: b.address || null, city: b.city || null };
    for (const k of Object.keys(g)) if (guest && (g[k] === null || g[k] === '')) delete g[k]; // keep known details when left empty
    guest = guest ? await guest.update(g) : await M.GuestCustomer.create(g);
  }
  if (user && (type === 'new' || type === 'existing' || type === 'organisation')) {
    vcard = await M.Vcard.findOne({ where: { user_id: user.id }, order: [['id', 'ASC']] });
    if (!vcard && type === 'new') vcard = await onboarding.defaultVcard(user, { force: true });
    if (vcard && type === 'new' && b.company_name && !vcard.company) await vcard.update({ company: String(b.company_name).slice(0, 150) });
    if (vcard && account) account.vcard_url = `${appUrl}/${vcard.url_alias}`;
  }

  const isCod = !collection && b.order_type !== 'digital' && toBool(b.is_cod);
  const o = await orders.create({
    ...pick(b, ['name', 'phone', 'address', 'city', 'courier_city_id', 'company_name', 'designation', 'customer_note', 'admin_note']),
    email, user_id: user?.id || null, vcard_id: vcard?.id || null, guest_customer_id: guest?.id || null, organisation_id: orgOwner?.id || null,
    fulfilment: collection ? 'collection' : b.order_type === 'digital' ? 'digital' : 'delivery', is_cod: isCod,
    social_variant: ['static', 'dynamic', 'profile'].includes(b.social_variant) ? b.social_variant : null, parent_order_id: sampleOf?.id || null,
    payment_type: isCod ? 'cod' : collection && b.payment_status !== 'paid' ? 'collection' : (b.payment_type || 'manual'),
    payment_status: b.payment_status === 'paid' ? 'paid' : 'pending', source: 'admin', design_type: 'standard',
    order_source_id: source?.id || null, created_by: req.user.id,
  }, q);
  if (vcard) await M.ShortLink.create({ code: await shortlinks.uniqueCode(M), title: `Order ${o.order_number}`, target_type: 'vcard', vcard_id: vcard.id, user_id: user.id, nfc_order_id: o.id });
  // organisation orders appear in the organisation journey (services/organisation.js timeline) with the contact and the staff member
  security.audit(req, 'order.create', 'nfc_order', o.id, { type, account: account?.created || undefined });
  res.status(201).json({ data: o, account, guest: guest ? { id: guest.id, name: guest.name } : null, message: `Order ${o.order_number} created` });
}));

/* customer search for the order wizard: name, e-mail or phone in one box */
const likeAny = (fields, q) => ({ [Op.or]: fields.map((f) => ({ [f]: { [Op.like]: `%${q}%` } })) });
r.get('/customers/search', wrap(async (req, res) => {
  const q = String(req.query.q || '').trim().slice(0, 100);
  const where = { role: 'user', is_active: true, ...(q ? likeAny(['first_name', 'last_name', 'email', 'contact'], q) : {}) };
  const [first, ...rest] = q.split(/\s+/); // "Fayz Khan" matches first + last name
  if (rest.length) where[Op.or].push({ first_name: { [Op.like]: `${first}%` }, last_name: { [Op.like]: `${rest.join(' ')}%` } });
  const users = await M.User.findAll({ where, attributes: ['id', 'first_name', 'last_name', 'email', 'contact', 'region_code', 'is_organisation', 'organisation_id', 'company_role'], order: [['id', 'DESC']], limit: 20 });
  const orgIds = [...new Set(users.map((u) => (u.is_organisation ? u.id : u.organisation_id)).filter(Boolean))];
  const names = orgIds.length ? Object.fromEntries((await M.Organisation.findAll({ where: { owner_id: orgIds }, attributes: ['owner_id', 'name'] })).map((o) => [o.owner_id, o.name])) : {};
  res.json({ data: users.map((u) => ({ ...u.toJSON(), name: u.fullName(), organisation_name: names[u.is_organisation ? u.id : u.organisation_id] || null })) });
}));
r.get('/organisations/search', wrap(async (req, res) => {
  const q = String(req.query.q || '').trim().slice(0, 100);
  const owners = await M.User.findAll({
    where: { role: 'user', is_organisation: true, ...(q ? { [Op.or]: [...likeAny(['first_name', 'last_name', 'email', 'contact'], q)[Op.or], { '$organisation.name$': { [Op.like]: `%${q}%` } }] } : {}) },
    include: [{ model: M.Organisation, required: false, attributes: ['name', 'logo', 'phone', 'address', 'city'] }],
    attributes: ['id', 'first_name', 'last_name', 'email', 'contact'], order: [['id', 'DESC']], limit: 20, subQuery: false,
  });
  res.json({ data: owners.map((o) => ({ id: o.id, name: o.organisation?.name || o.fullName(), logo: o.organisation?.logo || null, owner: o.fullName(), email: o.email, phone: o.organisation?.phone || o.contact, address: o.organisation?.address, city: o.organisation?.city })) });
}));
r.get('/organisations/:id/people', wrap(async (req, res) => {
  const owner = await M.User.findOne({ where: { id: req.params.id, is_organisation: true }, attributes: ['id', 'first_name', 'last_name', 'email', 'contact', 'company_role'] });
  if (!owner) fail(404, 'Not found');
  const members = await M.User.findAll({ where: { organisation_id: owner.id }, attributes: ['id', 'first_name', 'last_name', 'email', 'contact', 'company_role', 'org_status'], order: [['first_name', 'ASC']] });
  res.json({ data: [{ ...owner.toJSON(), company_role: 'owner' }, ...members.map((m) => m.toJSON())] });
}));

/* guest customers: everyone who ordered without an account, with their order journey */
r.get('/guest-customers', wrap(async (req, res) => {
  const p = paginate(req, 15);
  const q = String(req.query.search || '').trim();
  const where = q ? likeAny(['name', 'phone', 'email', 'company_name', 'city'], q) : {};
  const { rows, count } = await M.GuestCustomer.findAndCountAll({ where, order: [['updated_at', 'DESC']], limit: p.limit, offset: p.offset });
  const stats = rows.length ? await M.NfcOrder.findAll({ where: { guest_customer_id: rows.map((g) => g.id), order_status: { [Op.ne]: 'cancelled' } }, attributes: ['guest_customer_id', [M.sequelize.fn('count', M.sequelize.col('id')), 'orders'], [M.sequelize.fn('sum', M.sequelize.col('amount')), 'spent'], [M.sequelize.fn('max', M.sequelize.col('created_at')), 'last_order']], group: ['guest_customer_id'], raw: true }) : [];
  const by = Object.fromEntries(stats.map((x) => [x.guest_customer_id, x]));
  res.json(paged(rows.map((g) => ({ ...g.toJSON(), orders: Number(by[g.id]?.orders || 0), spent: Number(by[g.id]?.spent || 0), last_order: by[g.id]?.last_order || null })), count, p));
}));
r.get('/guest-customers/:id', wrap(async (req, res) => {
  const g = await M.GuestCustomer.findByPk(req.params.id);
  if (!g) fail(404, 'Not found');
  const rows = await M.NfcOrder.findAll({
    where: { guest_customer_id: g.id }, order: [['id', 'DESC']],
    include: [{ model: M.NfcOrderItem, as: 'items' }, { model: M.OrderSource, as: 'order_source', attributes: ['id', 'name'] }, { model: M.User, as: 'creator', attributes: ['id', 'first_name', 'last_name'] }],
  });
  const live = rows.filter((o) => o.order_status !== 'cancelled');
  res.json({ data: g, orders: rows, stats: { orders: live.length, spent: live.reduce((a, o) => a + Number(o.amount), 0), items: live.reduce((a, o) => a + (o.items || []).reduce((x, i) => x + i.quantity, 0), 0), first: rows.at(-1)?.created_at || null } });
}));
r.put('/guest-customers/:id', wrap(async (req, res) => {
  const g = await M.GuestCustomer.findByPk(req.params.id);
  if (!g) fail(404, 'Not found');
  validate(req.body, { name: 'required|max:120', phone: 'max:30', email: 'email|max:191', company_name: 'max:150', city: 'max:120', address: 'max:1000', notes: 'max:5000' });
  const data = pick(req.body, ['name', 'phone', 'email', 'company_name', 'address', 'city', 'notes']);
  for (const [k, v] of Object.entries(data)) if (v === '') data[k] = null;
  if (data.phone !== undefined) data.phone_key = phoneKey(data.phone);
  await g.update(data);
  res.json({ data: g, message: 'Guest customer saved' });
}));

/* order sources (Orders > Order sources): each website gets its own product list and price list */
const sourceOr404 = async (id) => { const src = await M.OrderSource.findByPk(id); if (!src) fail(404, 'Not found'); return src; };
r.get('/order-sources/summary', wrap(async (_req, res) => {
  const rows = await M.NfcCard.findAll({ where: { order_source_id: { [Op.ne]: null } }, attributes: ['order_source_id', [M.sequelize.fn('count', M.sequelize.col('id')), 'n']], group: ['order_source_id'], raw: true });
  res.json({ data: Object.fromEntries(rows.map((x) => [x.order_source_id, Number(x.n)])) });
}));
r.post('/order-sources/:id/sync', wrap(async (req, res) => {
  const src = await sourceOr404(req.params.id);
  const out = await productsync.syncSource(src);
  security.audit(req, 'order_source.sync', 'order_source', src.id, out);
  res.json({ data: out, message: `${out.total} products read from ${src.name} (${out.created} new, ${out.updated} updated)` });
}));
r.post('/order-sources/:id/import', wrap(async (req, res) => {
  const src = await sourceOr404(req.params.id);
  const out = await productsync.importPasted(src, req.body.text);
  if (!out.total) fail(422, 'Validation failed', { text: 'Write one product per line, like: Blue NFC card, 1500' });
  res.json({ data: out, message: `${out.total} products saved (${out.created} new, ${out.updated} updated)` });
}));
const PRICE_COLS = ['id', 'name', 'sku', 'front_image', 'images', 'price', 'source_price', 'price_locked', 'discount_type', 'discount_value', 'sample_price', 'wholesale_tiers', 'product_kind', 'status', 'source_url', 'variants', 'synced_at'];
r.get('/order-sources/:id/products', wrap(async (req, res) => {
  const src = await sourceOr404(req.params.id);
  const rows = await M.NfcCard.findAll({ where: { order_source_id: src.id }, attributes: PRICE_COLS, order: [['name', 'ASC']] });
  res.json({ source: src, data: rows });
}));
r.put('/order-sources/:id/products', wrap(async (req, res) => {
  const src = await sourceOr404(req.params.id);
  const list = jsonList(req.body.products).slice(0, 1000);
  let n = 0;
  for (const x of list) {
    const row = await M.NfcCard.findOne({ where: { id: x.id, order_source_id: src.id } });
    if (!row) continue;
    const data = {};
    if (x.price !== undefined && x.price !== '') { const price = Math.max(0, r2(x.price)); data.price = price; data.price_locked = row.source_price !== null && price !== r2(row.source_price); }
    if (x.discount_type !== undefined) data.discount_type = ['fixed', 'percent'].includes(x.discount_type) ? x.discount_type : null;
    if (x.discount_value !== undefined) data.discount_value = Math.max(0, Math.min(x.discount_type === 'percent' ? 100 : 1e9, r2(x.discount_value)));
    if (x.sample_price !== undefined) data.sample_price = x.sample_price === '' || x.sample_price === null ? null : Math.max(0, r2(x.sample_price));
    if (x.product_kind !== undefined) data.product_kind = PRODUCT_KINDS.includes(x.product_kind) ? x.product_kind : null;
    if (x.status !== undefined) data.status = toBool(x.status);
    if (Object.keys(data).length) { await row.update(data); n++; }
  }
  res.json({ message: `${n} product${n === 1 ? '' : 's'} saved` });
}));
r.post('/nfc-cards/:id/reset-price', wrap(async (req, res) => {
  const p = await M.NfcCard.findByPk(req.params.id);
  if (!p) fail(404, 'Not found');
  if (p.source_price === null || p.source_price === undefined) fail(422, 'This product has no website price to go back to');
  await p.update({ price: p.source_price, price_locked: false });
  res.json({ data: p, message: 'Price reset to the website price' });
}));

/* order sources (Orders > Order sources) */
r.use('/order-sources', crud(M.OrderSource, {
  fields: ['name', 'url', 'status'], booleans: ['status'], rules: { name: 'required|max:100', url: 'url' }, search: ['name'], order: [['name', 'ASC']],
  beforeSave: (data) => { if (data.url === '') data.url = null; return data; },
  canDelete: async (row) => ((await M.NfcOrder.count({ where: { order_source_id: row.id } })) ? 'This source is used by orders. Switch it off instead.' : null),
}));

r.patch('/orders/:id', wrap(async (req, res) => {
  const o = await M.NfcOrder.findByPk(req.params.id);
  if (!o) fail(404, 'Not found');
  const data = pick(req.body, ['admin_note', 'city', 'courier_city_id', 'address', 'phone', 'email', 'name']);
  if (req.body.tracking_number !== undefined) data.tracking_number = String(req.body.tracking_number || '').trim() || null;
  if (req.body.courier !== undefined) data.courier = req.body.courier || null;
  if (req.body.courier_charges !== undefined) data.courier_charges = r2(req.body.courier_charges);
  if (req.body.payment_status !== undefined) { validate(req.body, { payment_status: 'in:pending,paid,rejected' }); data.payment_status = req.body.payment_status; }
  if (req.body.is_cod !== undefined) data.is_cod = toBool(req.body.is_cod);
  if (req.body.cod_settled !== undefined) data.cod_settled = toBool(req.body.cod_settled);
  if (req.body.nfc_written !== undefined) data.nfc_written = toBool(req.body.nfc_written);
  if (Object.keys(data).length) await o.update(data);
  if (req.body.order_status) {
    validate(req.body, { order_status: `in:${orders.ALL_STATUSES.join(',')}` });
    await orders.setStatus(o, req.body.order_status, { actor: req.user, note: req.body.note, vendorId: req.body.stock_vendor_id ? Number(req.body.stock_vendor_id) : undefined });
  }
  security.audit(req, 'order.update', 'nfc_order', o.id, { status: req.body.order_status });
  res.json({ data: o, message: 'Order updated' });
}));
r.delete('/orders/:id', wrap(async (req, res) => {
  const o = await M.NfcOrder.findByPk(req.params.id);
  if (!o) fail(404, 'Not found');
  if (o.stock_consumed) await inventory.restoreForOrder(o, req.user.id);
  await o.destroy();
  security.audit(req, 'order.delete', 'nfc_order', o.id, { number: o.order_number });
  res.json({ message: 'Order deleted' });
}));
r.post('/orders/:id/notify', wrap(async (req, res) => {
  const o = await M.NfcOrder.findByPk(req.params.id);
  if (!o) fail(404, 'Not found');
  const event = req.body.event || `order_${o.order_status}`;
  if (!messaging.EVENTS[event]) fail(422, 'No message is defined for this step');
  await messaging.orderEvent(event, o);
  res.json({ message: 'Notification sent (see the message log below)' });
}));
r.post('/orders/:id/invoice', wrap(async (req, res) => {
  const inv = await invoices.fromOrder(Number(req.params.id), req.user.id);
  res.json({ data: inv, message: `Invoice ${inv.number} ready` });
}));
r.post('/orders/:id/short-link', wrap(async (req, res) => {
  const o = await M.NfcOrder.findByPk(req.params.id);
  if (!o) fail(404, 'Not found');
  const link = await M.ShortLink.create({ code: await shortlinks.uniqueCode(M), title: `Order ${o.order_number}`, target_type: o.vcard_id ? 'vcard' : 'unassigned', vcard_id: o.vcard_id, user_id: o.user_id, nfc_order_id: o.id, locked: toBool(req.body.locked) });
  res.status(201).json({ data: { ...link.toJSON(), short_url: shortlinks.shortUrl(link.code) }, message: 'Redirect link created. Write it to the NFC chip / print it as QR.' });
}));

/* ------------------------------------------------------------- courier (Leopards) */
r.get('/courier/cities', wrap(async (_req, res) => res.json({ data: await leopards.cities() })));
r.post('/orders/:id/courier/book', wrap(async (req, res) => {
  const o = await M.NfcOrder.findByPk(req.params.id, { include: [{ model: M.NfcOrderItem, as: 'items', include: [{ model: M.NfcCard, as: 'product', attributes: ['weight_grams'] }] }] });
  if (!o) fail(404, 'Not found');
  if (o.tracking_number && o.courier === 'leopards') fail(422, `Already booked: ${o.tracking_number}`);
  if (req.body.courier_city_id) await o.update({ courier_city_id: String(req.body.courier_city_id), city: req.body.city || o.city });
  o.weight_grams = req.body.weight || (o.items || []).reduce((a, it) => a + (it.product?.weight_grams || 50) * it.quantity, 0) || undefined;
  const b = await leopards.book(o);
  await o.update({ courier: 'leopards', tracking_number: b.track_number, courier_slip: b.slip_link, courier_status: 'Booked', courier_status_at: new Date(), courier_history: [{ status: 'Booked', at: new Date().toISOString() }] });
  if (req.body.dispatch !== false && ['pending', 'confirmed', 'designing', 'printing', 'ready', 'processing'].includes(o.order_status)) {
    await orders.setStatus(o, 'shipped', { actor: req.user, note: `Leopards ${b.track_number}`, vendorId: req.body.stock_vendor_id ? Number(req.body.stock_vendor_id) : undefined });
  }
  res.json({ data: o, message: `Booked with Leopards: ${b.track_number}` });
}));
async function syncTracking(o, actor) {
  const [t] = await leopards.track(o.tracking_number);
  if (!t) return o;
  const data = { courier_status: t.status, courier_status_at: new Date(), courier_history: t.history };
  if (t.charges && !Number(o.courier_charges)) data.courier_charges = t.charges;
  await o.update(data);
  const wf = leopards.workflowStatus(t.status);
  if (wf && wf !== o.order_status && !(wf === 'shipped' && ['delivered', 'returned'].includes(o.order_status))) await orders.setStatus(o, wf, { actor, note: `Leopards: ${t.status}` });
  return o;
}
r.post('/orders/:id/courier/track', wrap(async (req, res) => {
  const o = await M.NfcOrder.findByPk(req.params.id);
  if (!o || !o.tracking_number) fail(404, 'This order has no tracking number');
  await syncTracking(o, req.user);
  res.json({ data: o, message: `Status: ${o.courier_status || '-'}` });
}));
r.post('/orders/:id/courier/cancel', wrap(async (req, res) => {
  const o = await M.NfcOrder.findByPk(req.params.id);
  if (!o || !o.tracking_number) fail(404, 'This order has no tracking number');
  await leopards.cancel(o.tracking_number);
  await o.update({ courier_status: 'Cancelled', courier_status_at: new Date(), tracking_number: null, courier_slip: null });
  res.json({ message: 'Shipment cancelled at Leopards' });
}));
r.post('/courier/sync', wrap(async (req, res) => {
  const list = await M.NfcOrder.findAll({ where: { courier: 'leopards', tracking_number: { [Op.ne]: null }, order_status: { [Op.in]: ['shipped', 'ready'] } }, limit: 200 });
  let n = 0;
  for (const o of list) { try { await syncTracking(o, req.user); n += 1; } catch (e) { if (e.status === 422 && /disabled|Add the/.test(e.message)) throw e; } }
  res.json({ message: `${n} shipment(s) refreshed` });
}));
r.post('/courier/payments-sync', wrap(async (_req, res) => {
  const list = await M.NfcOrder.findAll({ where: { courier: 'leopards', is_cod: true, cod_settled: false, tracking_number: { [Op.ne]: null } }, limit: 200 });
  if (!list.length) return res.json({ message: 'No unsettled COD shipments', data: [] });
  const pays = await leopards.payments(list.map((o) => o.tracking_number));
  let settled = 0;
  for (const p of pays) {
    if (!/paid|settled|cheque|transferred/i.test(p.status)) continue;
    const o = list.find((x) => x.tracking_number === p.track_number);
    if (o) { await o.update({ cod_settled: true, ...(p.charges && !Number(o.courier_charges) ? { courier_charges: p.charges } : {}) }); settled += 1; }
  }
  res.json({ data: pays, message: `${settled} COD shipment(s) marked as settled` });
}));

/* ============================================================== short links */
r.get('/short-links', wrap(async (req, res) => {
  const p = paginate(req, 20);
  const where = {};
  if (req.query.batch) where.batch = req.query.batch;
  if (req.query.target_type) where.target_type = req.query.target_type;
  const q = (req.query.search || '').trim();
  if (q) where[Op.or] = ['code', 'title', 'target_url', 'batch', 'note'].map((f) => ({ [f]: { [Op.like]: `%${q}%` } }));
  const { rows, count } = await M.ShortLink.findAndCountAll({ where, order: [['id', 'DESC']], limit: p.limit, offset: p.offset, include: [{ model: M.User, attributes: ['id', 'first_name', 'last_name', 'email'] }, { model: M.Vcard, attributes: ['id', 'name', 'url_alias'] }] });
  const batches = await M.ShortLink.findAll({ attributes: ['batch'], where: { batch: { [Op.ne]: null } }, group: ['batch'], raw: true });
  res.json({ ...paged(rows.map((l) => ({ ...l.toJSON(), short_url: shortlinks.shortUrl(l.code) })), count, p), batches: batches.map((b) => b.batch) });
}));
async function linkBody(b, row) {
  const d = pick(b, ['title', 'note', 'batch']);
  if (b.code !== undefined && b.code !== row?.code) {
    if (!shortlinks.CODE_RE.test(String(b.code))) fail(422, 'Validation failed', { code: '3-40 letters, numbers, - or _' });
    if (await M.ShortLink.findOne({ where: { code: b.code, id: { [Op.ne]: row?.id || 0 } } })) fail(422, 'Validation failed', { code: 'This code is taken' });
    d.code = b.code;
  }
  if (b.target_type !== undefined) {
    validate(b, { target_type: 'in:url,vcard,store,unassigned' });
    d.target_type = b.target_type;
    if (b.target_type === 'url') { validate(b, { target_url: 'required|url|max:1000' }); d.target_url = b.target_url; }
    if (b.target_type === 'vcard') { const v = await M.Vcard.findByPk(b.vcard_id); if (!v) fail(422, 'Validation failed', { vcard_id: 'Select a vCard' }); d.vcard_id = v.id; d.user_id = v.user_id; }
    if (b.target_type === 'store') { const st = await M.WhatsappStore.findByPk(b.store_id); if (!st) fail(422, 'Validation failed', { store_id: 'Select a store' }); d.store_id = st.id; d.user_id = st.user_id; }
  }
  if (b.user_id !== undefined && b.target_type !== 'vcard' && b.target_type !== 'store') d.user_id = b.user_id || null;
  for (const k of ['status', 'locked']) if (b[k] !== undefined) d[k] = toBool(b[k]);
  return d;
}
r.post('/short-links', wrap(async (req, res) => {
  const d = await linkBody({ target_type: 'url', ...req.body });
  const link = await M.ShortLink.create({ code: d.code || await shortlinks.uniqueCode(M), ...d });
  res.status(201).json({ data: link, message: `Short link ${shortlinks.shortUrl(link.code)} created` });
}));
r.put('/short-links/:id', wrap(async (req, res) => {
  const link = await M.ShortLink.findByPk(req.params.id);
  if (!link) fail(404, 'Not found');
  await link.update(await linkBody(req.body, link));
  security.audit(req, 'shortlink.update', 'short_link', link.id, { target_type: link.target_type });
  res.json({ data: link, message: 'Redirect updated' });
}));
r.delete('/short-links/:id', wrap(async (req, res) => { await M.ShortLink.destroy({ where: { id: req.params.id } }); res.json({ message: 'Deleted' }); }));
r.post('/short-links/bulk-delete', wrap(async (req, res) => { const n = await M.ShortLink.destroy({ where: { id: jsonList(req.body.ids).map(Number) } }); res.json({ message: `${n} deleted` }); }));
/** bulk-generate unassigned links for pre-printed NFC tags / QR stickers */
r.post('/short-links/bulk', wrap(async (req, res) => {
  const count = Math.min(5000, Math.max(1, parseInt(req.body.count, 10) || 0));
  const batch = String(req.body.batch || `Batch ${dayjs().format('YYYY-MM-DD HH:mm')}`).slice(0, 60);
  const d = req.body.target_url ? { target_type: 'url', target_url: req.body.target_url } : { target_type: 'unassigned' };
  if (d.target_url) validate(req.body, { target_url: 'url' });
  const rows = [];
  for (let i = 0; i < count; i += 1) rows.push({ code: await shortlinks.uniqueCode(M, Number(req.body.length) >= 5 ? Number(req.body.length) : 7), batch, locked: toBool(req.body.locked), ...d });
  await M.ShortLink.bulkCreate(rows);
  res.status(201).json({ message: `${count} links generated in "${batch}"`, batch });
}));
r.get('/short-links/export', wrap(async (req, res) => {
  const where = req.query.batch ? { batch: req.query.batch } : {};
  const rows = (await M.ShortLink.findAll({ where, order: [['id', 'ASC']], include: [{ model: M.Vcard, attributes: ['url_alias'] }] })).map((l) => ({ code: l.code, short_url: shortlinks.shortUrl(l.code), target: l.target_type === 'url' ? l.target_url : l.target_type === 'vcard' ? `${appUrl}/${l.vcard?.url_alias || ''}` : l.target_type, batch: l.batch || '', clicks: l.clicks, status: l.status ? 'active' : 'off' }));
  const out = await docs.exportRows(String(req.query.format || 'csv'), 'Short links', [['code', 'Code'], ['short_url', 'Short URL (QR / NFC)'], ['target', 'Destination'], ['batch', 'Batch'], ['clicks', 'Clicks'], ['status', 'Status']].map(([key, label]) => ({ key, label })), rows);
  res.type(out.type).set('Content-Disposition', `attachment; filename="short-links.${out.ext}"`).send(out.body);
}));
r.get('/short-links/:id/qrcode', wrap(async (req, res) => {
  const link = await M.ShortLink.findByPk(req.params.id);
  if (!link) fail(404, 'Not found');
  const png = await require('qrcode').toBuffer(shortlinks.shortUrl(link.code), { width: Math.min(2000, Number(req.query.size) || 800), margin: 2, errorCorrectionLevel: 'M' });
  res.type('image/png').set('Content-Disposition', `attachment; filename="${link.code}.png"`).send(png);
}));
r.get('/short-links/:id/stats', wrap(async (req, res) => {
  const link = await M.ShortLink.findByPk(req.params.id);
  if (!link) fail(404, 'Not found');
  const clicks = await M.ShortLinkClick.findAll({ where: { short_link_id: link.id, created_at: { [Op.gte]: dayjs().subtract(90, 'day').toDate() } }, attributes: ['device', 'browser', 'os', 'referrer', 'created_at'], raw: true });
  const by = (k) => Object.entries(clicks.reduce((a, c) => ((a[c[k] || 'Unknown'] = (a[c[k] || 'Unknown'] || 0) + 1), a), {})).map(([name, value]) => ({ name, value }));
  const days = {}; for (let i = 29; i >= 0; i -= 1) days[dayjs().subtract(i, 'day').format('YYYY-MM-DD')] = 0;
  for (const c of clicks) { const d = dayjs(c.created_at).format('YYYY-MM-DD'); if (d in days) days[d] += 1; }
  res.json({ total: link.clicks, devices: by('device'), browsers: by('browser'), os: by('os'), daily: Object.entries(days).map(([date, value]) => ({ date, value })) });
}));

/* ============================================================== invoices */
r.get('/invoices/templates', (_req, res) => res.json({ data: Object.entries(invoices.TEMPLATES).map(([key, t]) => ({ key, ...t })) }));
r.get('/invoices', wrap(async (req, res) => {
  const p = paginate(req);
  const where = {};
  if (req.query.status) where.status = req.query.status;
  if (req.query.type) where.type = req.query.type;
  const q = (req.query.search || '').trim();
  if (q) where[Op.or] = ['number', 'customer_name', 'customer_email', 'customer_phone'].map((f) => ({ [f]: { [Op.like]: `%${q}%` } }));
  // refresh overdue flags
  await M.Invoice.update({ status: 'overdue' }, { where: { status: { [Op.in]: ['sent', 'partial'] }, due_date: { [Op.lt]: today() }, paid_amount: 0 } });
  const { rows, count } = await M.Invoice.findAndCountAll({ where, order: [['id', 'DESC']], limit: p.limit, offset: p.offset, include: [{ model: M.NfcOrder, attributes: ['id', 'order_number'] }] });
  const sums = await M.Invoice.findAll({ attributes: ['status', 'total', 'paid_amount'], raw: true });
  const s = { total: 0, paid: 0, outstanding: 0, overdue: 0 };
  for (const i of sums) { if (i.status === 'cancelled') continue; s.total += Number(i.total); s.paid += Number(i.paid_amount); if (i.status !== 'draft') s.outstanding += Number(i.total) - Number(i.paid_amount); if (i.status === 'overdue') s.overdue += Number(i.total) - Number(i.paid_amount); }
  res.json({ ...paged(rows, count, p), summary: Object.fromEntries(Object.entries(s).map(([k, v]) => [k, r2(v)])) });
}));
r.get('/invoices/:id', wrap(async (req, res) => {
  const inv = await M.Invoice.findByPk(req.params.id, { include: [{ model: M.InvoicePayment, as: 'payments' }, { model: M.NfcOrder, attributes: ['id', 'order_number'] }] });
  if (!inv) fail(404, 'Not found');
  res.json({ data: inv, public_url: `${appUrl}/invoice/${inv.token}` });
}));
const INVOICE_FIELDS = ['customer_name', 'customer_email', 'customer_phone', 'customer_address', 'customer_company', 'discount', 'tax_name', 'tax_rate', 'delivery_charges', 'issue_date', 'due_date', 'template', 'notes', 'terms', 'currency_code', 'currency_icon'];
const invoiceBody = (b) => {
  validate(b, { customer_name: 'required|max:150', customer_email: 'email' });
  const d = pick(b, INVOICE_FIELDS);
  if (d.template && !invoices.TEMPLATES[d.template]) d.template = 'modern';
  d.items = jsonList(b.items);
  if (!d.items.length) fail(422, 'Add at least one line item');
  for (const k of ['issue_date', 'due_date']) if (d[k] === '') d[k] = null;
  return d;
};
r.post('/invoices', wrap(async (req, res) => {
  const inv = await invoices.create({ ...invoiceBody(req.body), type: 'manual', status: req.body.status === 'draft' ? 'draft' : 'sent' }, req.user.id);
  res.status(201).json({ data: inv, message: `Invoice ${inv.number} created` });
}));
r.put('/invoices/:id', wrap(async (req, res) => {
  const inv = await M.Invoice.findByPk(req.params.id);
  if (!inv) fail(404, 'Not found');
  const d = invoiceBody(req.body);
  const t = invoices.totals({ ...inv.toJSON(), ...d });
  await inv.update({ ...d, ...t, ...(req.body.status && ['draft', 'sent', 'cancelled'].includes(req.body.status) ? { status: req.body.status } : {}) });
  await inv.update({ status: invoices.statusOf(inv) });
  res.json({ data: inv, message: 'Invoice updated' });
}));
r.delete('/invoices/:id', wrap(async (req, res) => { await M.Invoice.destroy({ where: { id: req.params.id } }); res.json({ message: 'Invoice deleted' }); }));
r.post('/invoices/:id/payments', wrap(async (req, res) => {
  const inv = await M.Invoice.findByPk(req.params.id);
  if (!inv) fail(404, 'Not found');
  await invoices.addPayment(inv, req.body);
  res.json({ data: inv, message: 'Payment recorded' });
}));
r.delete('/invoices/:id/payments/:pid', wrap(async (req, res) => {
  const inv = await M.Invoice.findByPk(req.params.id);
  const p = inv && await M.InvoicePayment.findOne({ where: { id: req.params.pid, invoice_id: inv.id } });
  if (!p) fail(404, 'Not found');
  await p.destroy();
  await inv.update({ paid_amount: r2(Math.max(0, Number(inv.paid_amount) - Number(p.amount))) });
  await inv.update({ status: invoices.statusOf(inv) });
  res.json({ message: 'Payment removed' });
}));
r.post('/invoices/:id/send', wrap(async (req, res) => {
  const inv = await M.Invoice.findByPk(req.params.id);
  if (!inv) fail(404, 'Not found');
  const to = req.body.email || inv.customer_email;
  if (!to) fail(422, 'Validation failed', { email: 'Add a customer e-mail first' });
  const pdf = await invoices.pdf(inv);
  await mail.send({ to, subject: `Invoice ${inv.number}`, html: `<p>Hello ${mail.esc(inv.customer_name)},</p><p>Please find invoice <b>${mail.esc(inv.number)}</b> for <b>${mail.esc(inv.currency_icon)} ${Number(inv.total).toLocaleString('en-US')}</b> attached${inv.due_date ? `, due on <b>${dayjs(inv.due_date).format('DD MMM YYYY')}</b>` : ''}.</p><p><a href="${appUrl}/invoice/${inv.token}">View it online</a></p>`, attachments: [{ filename: `${inv.number}.pdf`, content: pdf }] });
  await inv.update({ sent_at: new Date(), status: inv.status === 'draft' ? 'sent' : inv.status });
  if (req.body.whatsapp && inv.customer_phone) messaging.deliver('whatsapp', inv.customer_phone, `Hello ${inv.customer_name}, your invoice ${inv.number} (${inv.currency_icon} ${Number(inv.total).toLocaleString('en-US')}): ${appUrl}/invoice/${inv.token}`, { event: 'invoice' }).catch(() => {});
  res.json({ message: `Invoice sent to ${to}` });
}));
r.get('/invoices/:id/pdf', wrap(async (req, res) => {
  const inv = await M.Invoice.findByPk(req.params.id);
  if (!inv) fail(404, 'Not found');
  res.type('application/pdf').set('Content-Disposition', `attachment; filename="${inv.number}.pdf"`).send(await invoices.pdf(inv));
}));
r.post('/transactions/:id/invoice', wrap(async (req, res) => { const inv = await invoices.fromTransaction(Number(req.params.id), req.user.id); res.json({ data: inv, message: `Invoice ${inv.number} ready` }); }));

/* ============================================================== finance */
r.get('/finance/report', wrap(async (req, res) => res.json(await finance.report(req.query))));
r.get('/analytics/profit', wrap(async (req, res) => res.json(await finance.report(req.query))));
r.get('/finance/ledger', wrap(async (req, res) => res.json({ data: await finance.ledger(req.query) })));
const sendExport = async (res, fmt, name, title, cols, rows) => {
  const out = await docs.exportRows(String(fmt || 'xlsx'), title, cols.map(([key, label]) => ({ key, label })), rows);
  res.type(out.type).set('Content-Disposition', `attachment; filename="${name}.${out.ext}"`).send(out.body);
};
r.get('/finance/ledger/export', wrap(async (req, res) => {
  const rows = (await finance.ledger(req.query)).map((x) => ({ ...x, kind: x.kind === 'income' ? 'Money in' : x.kind === 'expense' ? 'Money out' : x.kind, amount: r2(x.amount) }));
  await sendExport(res, req.query.format, 'ledger', 'Ledger', [['date', 'Date'], ['kind', 'Type'], ['source', 'Source'], ['title', 'Description'], ['category', 'Category'], ['party', 'Party'], ['account', 'Account'], ['amount', 'Amount']], rows);
}));
r.get('/finance/report/export', wrap(async (req, res) => {
  const rep = await finance.report(req.query);
  if (req.query.what === 'products') return sendExport(res, req.query.format, 'product-profit', 'Profit by product', [['name', 'Product'], ['units', 'Units'], ['revenue', 'Revenue'], ['cost', 'Cost'], ['profit', 'Profit']], rep.products);
  await sendExport(res, req.query.format, 'profit-and-loss', `Profit & loss ${rep.range.from} to ${rep.range.to}`, [['month', 'Month'], ['orders', 'Orders'], ['revenue', 'Revenue'], ['cogs', 'Cost of goods'], ['courier', 'Courier'], ['expenses', 'Expenses'], ['profit', 'Net profit']],
    [...rep.series, { month: 'TOTAL', orders: rep.summary.orders, revenue: rep.summary.revenue, cogs: rep.summary.cogs, courier: rep.summary.courier, expenses: rep.summary.expenses, profit: rep.summary.net_profit }]);
}));
r.use('/finance/accounts', crud(M.FinanceAccount, { fields: ['name', 'type', 'opening_balance', 'note', 'status'], booleans: ['status'], rules: { name: 'required|max:120' }, order: [['id', 'ASC']] }));
r.use('/finance/partners', crud(M.Partner, { fields: ['name', 'email', 'phone', 'share_percent', 'note', 'status'], booleans: ['status'], rules: { name: 'required|max:120', email: 'email' }, order: [['id', 'ASC']] }));
r.use('/finance/categories', crud(M.FinanceCategory, { fields: ['name', 'type'], rules: { name: 'required|max:120', type: 'required|in:expense,income' }, order: [['name', 'ASC']], filters: ['type'] }));
r.use('/finance/entries', crud(M.FinanceEntry, {
  fields: ['type', 'date', 'title', 'category', 'amount', 'account_id', 'partner_id', 'vendor_id', 'payment_method', 'reference', 'description', 'status'],
  files: ['attachment'], folder: 'finance', types: DOC_TYPES, search: ['title', 'category', 'reference', 'description'], filters: ['type', 'partner_id', 'account_id', 'category', 'status', 'vendor_id'],
  rules: { type: 'required|in:expense,income', date: 'required', title: 'required|max:200', amount: 'required|numeric', status: 'in:paid,unpaid' },
  include: [{ model: M.Partner, as: 'partner', attributes: ['id', 'name'] }, { model: M.FinanceAccount, as: 'account', attributes: ['id', 'name'] }, { model: M.Vendor, attributes: ['id', 'name'] }, { model: M.User, as: 'creator', attributes: ['id', 'first_name', 'last_name'] }],
  order: [['date', 'DESC'], ['id', 'DESC']],
  beforeSave: (data, req, row) => { if (!row) data.created_by = req.user.id; return data; },
}));
r.use('/finance/settlements', crud(M.CourierSettlement, {
  fields: ['courier', 'date', 'reference', 'cod_amount', 'charges', 'net_amount', 'tracking_numbers', 'note', 'account_id'], files: ['attachment'], folder: 'finance', types: DOC_TYPES,
  rules: { date: 'required', cod_amount: 'numeric', charges: 'numeric' }, order: [['date', 'DESC']],
  include: [{ model: M.FinanceAccount, as: 'account', attributes: ['id', 'name'] }],
  beforeSave: async (data) => {
    const list = Array.isArray(data.tracking_numbers) ? data.tracking_numbers : String(data.tracking_numbers || '').split(/[\s,;]+/).filter(Boolean);
    data.tracking_numbers = list;
    data.net_amount = r2(data.net_amount !== undefined && data.net_amount !== null && data.net_amount !== '' ? data.net_amount : Number(data.cod_amount || 0) - Number(data.charges || 0));
    if (list.length) await M.NfcOrder.update({ cod_settled: true }, { where: { tracking_number: list } });
    return data;
  },
}));
r.get('/finance/cod-pending', wrap(async (_req, res) => {
  res.json({ data: await M.NfcOrder.findAll({ where: { is_cod: true, cod_settled: false, order_status: { [Op.in]: ['shipped', 'delivered'] } }, attributes: ['id', 'order_number', 'name', 'city', 'amount', 'courier_charges', 'tracking_number', 'order_status', 'dispatched_at', 'delivered_at'], order: [['id', 'DESC']] }) });
}));

/* ============================================================== inventory */
r.get('/inventory/items', wrap(async (req, res) => {
  const where = {};
  const q = (req.query.search || '').trim();
  if (q) where[Op.or] = ['name', 'sku', 'category'].map((f) => ({ [f]: { [Op.like]: `%${q}%` } }));
  if (req.query.category) where.category = req.query.category;
  const items = await M.InventoryItem.findAll({ where, order: [['name', 'ASC']] });
  const lv = await inventory.levels(items.map((i) => i.id));
  const vendors = await M.Vendor.findAll({ attributes: ['id', 'name'] });
  res.json({
    data: items.map((i) => ({ ...i.toJSON(), stock: r2(lv[i.id]?.total || 0), value: r2((lv[i.id]?.total || 0) * Number(i.purchase_price)), locations: Object.entries(lv[i.id]?.byLocation || {}).filter(([, q2]) => q2).map(([k, q2]) => ({ vendor_id: k === 'main' ? null : Number(k), name: k === 'main' ? 'Main store' : vendors.find((v) => v.id === Number(k))?.name || 'Vendor', qty: r2(q2) })), low: i.reorder_level > 0 && (lv[i.id]?.total || 0) <= i.reorder_level })),
    locations: [{ id: null, name: 'Main store' }, ...vendors.map((v) => ({ id: v.id, name: v.name }))],
  });
}));
r.use('/inventory/items', crud(M.InventoryItem, {
  fields: ['name', 'sku', 'category', 'unit', 'purchase_price', 'sale_price', 'reorder_level', 'description', 'status'], booleans: ['status'],
  rules: { name: 'required|max:150', purchase_price: 'numeric', sale_price: 'numeric' },
  beforeSave: async (data, req, row) => {
    if (data.sku) { if (await M.InventoryItem.findOne({ where: { sku: data.sku, id: { [Op.ne]: row?.id || 0 } } })) fail(422, 'Validation failed', { sku: 'SKU already used' }); } else if (!row) data.sku = `INV-${Date.now().toString(36).toUpperCase()}`;
    return data;
  },
  afterSave: async (row, req) => {
    const q = Number(req.body.opening_stock || 0);
    if (q > 0 && !(await M.StockMovement.count({ where: { inventory_item_id: row.id } }))) await M.StockMovement.create({ inventory_item_id: row.id, vendor_id: req.body.opening_vendor_id || null, type: 'opening', quantity: q, unit_cost: row.purchase_price, date: today(), reference: 'Opening stock', created_by: req.user.id });
  },
}));
r.get('/inventory/movements', wrap(async (req, res) => {
  const p = paginate(req, 25);
  const where = {};
  if (req.query.item_id) where.inventory_item_id = req.query.item_id;
  if (req.query.vendor_id) where.vendor_id = req.query.vendor_id === 'main' ? null : req.query.vendor_id;
  if (req.query.type) where.type = req.query.type;
  const { rows, count } = await M.StockMovement.findAndCountAll({ where, order: [['id', 'DESC']], limit: p.limit, offset: p.offset, include: [{ model: M.InventoryItem, as: 'item', attributes: ['id', 'name', 'unit'] }, { model: M.Vendor, as: 'location', attributes: ['id', 'name'] }, { model: M.User, as: 'creator', attributes: ['first_name', 'last_name'] }, { model: M.NfcOrder, attributes: ['id', 'order_number'] }] });
  res.json(paged(rows, count, p));
}));
r.post('/inventory/adjust', wrap(async (req, res) => {
  validate(req.body, { inventory_item_id: 'required', quantity: 'required|numeric', type: 'required|in:adjustment,damage,return,opening' });
  const item = await M.InventoryItem.findByPk(req.body.inventory_item_id);
  if (!item) fail(404, 'Item not found');
  let q = Number(req.body.quantity);
  if (req.body.type === 'damage') q = -Math.abs(q);
  await M.StockMovement.create({ inventory_item_id: item.id, vendor_id: req.body.vendor_id || null, type: req.body.type, quantity: q, unit_cost: item.purchase_price, date: req.body.date || today(), note: req.body.note, reference: req.body.reference || 'Manual', created_by: req.user.id });
  res.json({ message: 'Stock updated' });
}));
r.post('/inventory/transfer', wrap(async (req, res) => {
  validate(req.body, { inventory_item_id: 'required', quantity: 'required|numeric' });
  await inventory.transfer({ itemId: req.body.inventory_item_id, fromVendorId: req.body.from_vendor_id || null, toVendorId: req.body.to_vendor_id || null, quantity: req.body.quantity, date: req.body.date, note: req.body.note, userId: req.user.id });
  res.json({ message: 'Stock transferred' });
}));
r.get('/inventory/low-stock', wrap(async (_req, res) => res.json({ data: await inventory.lowStock() })));

/* ------------------------------------------------------------- purchases / imports */
const purchaseUpload = docUpload('purchases').single('attachment');
r.get('/purchases', wrap(async (req, res) => {
  const p = paginate(req);
  const where = req.query.is_import !== undefined && req.query.is_import !== '' ? { is_import: toBool(req.query.is_import) } : {};
  const { rows, count } = await M.Purchase.findAndCountAll({ where, order: [['date', 'DESC'], ['id', 'DESC']], limit: p.limit, offset: p.offset, include: [{ model: M.Vendor, as: 'supplier', attributes: ['id', 'name'] }, { model: M.Vendor, as: 'location', attributes: ['id', 'name'] }, { model: M.Partner, as: 'partner', attributes: ['id', 'name'] }] });
  res.json(paged(rows, count, p));
}));
r.post('/purchases', purchaseUpload, wrap(async (req, res) => {
  validate(req.body, { date: 'required' });
  const data = {
    ...pick(req.body, ['supplier_name', 'invoice_no', 'date', 'origin_country', 'currency', 'note']),
    is_import: toBool(req.body.is_import), exchange_rate: Number(req.body.exchange_rate || 1) || 1,
    supplier_id: req.body.supplier_id || null, location_vendor_id: req.body.location_vendor_id || null, account_id: req.body.account_id || null, partner_id: req.body.partner_id || null,
    items: jsonList(req.body.items).map((l) => ({ inventory_item_id: Number(l.inventory_item_id), name: String(l.name || '').slice(0, 150), quantity: Number(l.quantity), unit_price: Number(l.unit_price || 0) })),
    shipping_cost: r2(req.body.shipping_cost), customs_duty: r2(req.body.customs_duty), clearing_charges: r2(req.body.clearing_charges), other_charges: r2(req.body.other_charges),
    paid_amount: r2(req.body.paid_amount), attachment: fileUrl('purchases', req.file),
  };
  const pur = await M.sequelize.transaction(async (t) => {
    const row = await M.Purchase.create(data, { transaction: t });
    const tot = await inventory.applyPurchase(row, req.user.id, t);
    await row.update(tot, { transaction: t });
    if (req.body.paid_amount === undefined || req.body.paid_amount === '') await row.update({ paid_amount: tot.total }, { transaction: t });
    return row;
  });
  res.status(201).json({ data: pur, message: 'Purchase recorded and stock added' });
}));
r.delete('/purchases/:id', wrap(async (req, res) => {
  const pur = await M.Purchase.findByPk(req.params.id);
  if (!pur) fail(404, 'Not found');
  await M.StockMovement.destroy({ where: { purchase_id: pur.id } });
  await pur.destroy();
  res.json({ message: 'Purchase deleted and its stock removed' });
}));

/* ------------------------------------------------------------- vendors */
r.get('/vendors/:id/overview', wrap(async (req, res) => {
  const v = await M.Vendor.findByPk(req.params.id);
  if (!v) fail(404, 'Not found');
  const [bills, pays, items] = await Promise.all([
    M.VendorBill.findAll({ where: { vendor_id: v.id }, order: [['date', 'DESC']] }),
    M.VendorPayment.findAll({ where: { vendor_id: v.id }, order: [['date', 'DESC']], include: [{ model: M.Partner, as: 'partner', attributes: ['name'] }, { model: M.FinanceAccount, as: 'account', attributes: ['name'] }] }),
    M.InventoryItem.findAll({ attributes: ['id', 'name', 'unit', 'purchase_price'] }),
  ]);
  const lv = await inventory.levels(items.map((i) => i.id));
  const stock = items.map((i) => ({ id: i.id, name: i.name, unit: i.unit, qty: r2(lv[i.id]?.byLocation?.[v.id] || 0), value: r2((lv[i.id]?.byLocation?.[v.id] || 0) * Number(i.purchase_price)) })).filter((x) => x.qty);
  const billed = bills.reduce((a, b) => a + Number(b.amount), 0) + Number(v.opening_balance || 0);
  const paid = pays.reduce((a, p) => a + Number(p.amount), 0);
  res.json({ data: v, bills, payments: pays, stock, totals: { billed: r2(billed), paid: r2(paid), balance: r2(billed - paid) } });
}));
r.get('/vendors', wrap(async (req, res) => {
  const rows = await M.Vendor.findAll({ order: [['name', 'ASC']], where: req.query.type ? { type: req.query.type } : {} });
  const bal = await finance.vendorBalances();
  res.json({ data: rows.map((v) => ({ ...v.toJSON(), ...(bal.find((b) => b.id === v.id) || {}), name: v.name, type: v.type })) });
}));
r.use('/vendors', crud(M.Vendor, {
  fields: ['name', 'type', 'contact_person', 'phone', 'email', 'address', 'rates', 'opening_balance', 'notes', 'status'], booleans: ['status'],
  rules: { name: 'required|max:150', email: 'email' },
  beforeSave: (data) => { if (data.rates !== undefined) data.rates = jsonList(data.rates).filter((x) => x && x.label).map((x) => ({ label: String(x.label).slice(0, 120), rate: r2(x.rate), unit: String(x.unit || 'pc').slice(0, 20) })); return data; },
}));
r.use('/vendor-bills', crud(M.VendorBill, {
  fields: ['vendor_id', 'bill_no', 'date', 'due_date', 'amount', 'category', 'description', 'items'], files: ['attachment'], folder: 'vendors', types: DOC_TYPES,
  rules: { vendor_id: 'required', date: 'required', amount: 'required|numeric', category: 'in:printing,other' }, filters: ['vendor_id', 'category'], order: [['date', 'DESC']],
  include: [{ model: M.Vendor, attributes: ['id', 'name'] }],
  beforeSave: (data) => { if (data.items !== undefined) data.items = jsonList(data.items); if (data.due_date === '') data.due_date = null; return data; },
}));
r.use('/vendor-payments', crud(M.VendorPayment, {
  fields: ['vendor_id', 'vendor_bill_id', 'amount', 'date', 'method', 'reference', 'note', 'account_id', 'partner_id'], files: ['attachment'], folder: 'vendors', types: DOC_TYPES,
  rules: { vendor_id: 'required', date: 'required', amount: 'required|numeric' }, filters: ['vendor_id', 'partner_id'], order: [['date', 'DESC']],
  include: [{ model: M.Vendor, attributes: ['id', 'name'] }, { model: M.Partner, as: 'partner', attributes: ['id', 'name'] }, { model: M.FinanceAccount, as: 'account', attributes: ['id', 'name'] }],
}));

/* ============================================================== announcements */
r.use('/announcements', crud(M.Announcement, {
  where: { audience: { [Op.ne]: 'organisation' } }, // organisations' own announcements stay in their portal
  fields: ['title', 'body', 'type', 'audience', 'plan_id', 'starts_at', 'ends_at', 'pinned', 'send_email', 'link_url', 'link_label', 'status'], booleans: ['pinned', 'send_email', 'status'],
  rules: { title: 'required|max:200', type: 'in:info,success,warning,danger,promo', audience: 'in:all,users,staff,plan', link_url: 'url' }, search: ['title'],
  include: [{ model: M.Plan, attributes: ['id', 'name'] }],
  beforeSave: (data, req, row) => {
    if (data.body !== undefined) data.body = richText(data.body);
    for (const k of ['starts_at', 'ends_at', 'plan_id']) if (data[k] === '') data[k] = null;
    if (!row) data.created_by = req.user.id;
    return data;
  },
  afterSave: async (row) => { if (row.send_email && !row.emailed_at && row.status) require('../../services/announcements').email(row).catch((e) => console.error('[announcement]', e.message)); },
}));
r.get('/announcements-stats/:id', wrap(async (req, res) => res.json({ reads: await M.AnnouncementRead.count({ where: { announcement_id: req.params.id } }) })));

/* ============================================================== logs */
r.get('/activity-logs', wrap(async (req, res) => {
  const p = paginate(req, 25);
  const where = req.query.user_id ? { user_id: req.query.user_id } : {};
  if (req.query.search) where.action = { [Op.like]: `%${req.query.search}%` };
  const { rows, count } = await M.ActivityLog.findAndCountAll({ where, order: [['id', 'DESC']], limit: p.limit, offset: p.offset, include: [{ model: M.User, attributes: ['id', 'first_name', 'last_name', 'email', 'role'] }] });
  res.json(paged(rows, count, p));
}));
r.get('/message-logs', wrap(async (req, res) => {
  const p = paginate(req, 25);
  const where = {};
  if (req.query.channel) where.channel = req.query.channel;
  if (req.query.status) where.status = req.query.status;
  const { rows, count } = await M.MessageLog.findAndCountAll({ where, order: [['id', 'DESC']], limit: p.limit, offset: p.offset, include: [{ model: M.NfcOrder, attributes: ['id', 'order_number'] }] });
  res.json(paged(rows, count, p));
}));
r.get('/messaging/events', wrap(async (_req, res) => {
  const s = await settings.all();
  res.json({ data: Object.entries(messaging.EVENTS).map(([key, e]) => ({ key, label: e.label, text: s[`msg_tpl_${key}`] || e.text, default_text: e.text, wa_template: s[`wa_tpl_${key}`] || '', whatsapp: s[`notify_${key}_whatsapp`] ?? '', sms: s[`notify_${key}_sms`] ?? '' })) });
}));
r.post('/messaging/test', wrap(async (req, res) => {
  validate(req.body, { to: 'required|max:30', channel: 'required|in:whatsapp,sms' });
  const to = messaging.normalizePhone(req.body.to, (await settings.get('phone_default_region')) || '92');
  try {
    if (req.body.channel === 'whatsapp') await messaging.sendWhatsapp(to, req.body.text || 'Test message from your NFC platform'); else await messaging.sendSms(to, req.body.text || 'Test message from your NFC platform');
  } catch (e) { fail(422, `Not sent: ${e.message}`); }
  res.json({ message: `Test ${req.body.channel} message sent to +${to}` });
}));

module.exports = r;
