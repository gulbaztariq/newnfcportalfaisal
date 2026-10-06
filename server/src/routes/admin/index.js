const express = require('express');
const crypto = require('crypto');
const { Op, fn, col } = require('sequelize');
const dayjs = require('dayjs');
const sanitizeHtml = require('sanitize-html');
const M = require('../../models');
const crud = require('../../utils/crud');
const { wrap, fail, validate, pick, toBool, paginate, paged } = require('../../utils/http');
const { isAdmin, adminPermissions } = require('../../middleware/auth');
const { makeUpload, fileUrl } = require('../../middleware/upload');
const usersRouter = require('./users');
const settings = require('../../services/settings');
const subs = require('../../services/subscription');
const mail = require('../../services/mail');
const docs = require('../../services/documents');
const extras = require('../../services/extras');
const { FEATURE_LABELS } = require('../../utils/labels');

const r = express.Router();
r.use(isAdmin, adminPermissions);

const richText = (html) => sanitizeHtml(html || '', {
  allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img', 'h1', 'h2', 'span', 'u', 's']),
  allowedAttributes: { ...sanitizeHtml.defaults.allowedAttributes, '*': ['class', 'style'], img: ['src', 'alt', 'width', 'height'] },
  allowedSchemes: ['http', 'https', 'mailto', 'tel'],
});

/* =============================================================== dashboard */
r.get('/dashboard', wrap(async (_req, res) => {
  const [organisations, stores] = await Promise.all([M.User.count({ where: { is_organisation: true } }), M.WhatsappStore.count()]);
  const [activeUsers, inactiveUsers, activeVcards, inactiveVcards, income] = await Promise.all([
    M.User.count({ where: { role: 'user', is_active: true } }),
    M.User.count({ where: { role: 'user', is_active: false } }),
    M.Vcard.count({ where: { status: true } }),
    M.Vcard.count({ where: { status: false } }),
    M.Transaction.sum('amount', { where: { status: 'paid' } }),
  ]);

  const plans = await M.Plan.findAll({ attributes: ['id', 'name'] });
  const planCounts = await M.Subscription.findAll({ attributes: ['plan_id', [fn('COUNT', col('id')), 'total']], where: { status: 'active' }, group: ['plan_id'], raw: true });
  const byPlan = Object.fromEntries(planCounts.map((p) => [p.plan_id, Number(p.total)]));

  // income of the last 12 months
  const since = dayjs().subtract(11, 'month').startOf('month').toDate();
  const tx = await M.Transaction.findAll({ where: { status: 'paid', created_at: { [Op.gte]: since } }, attributes: ['amount', 'created_at'], raw: true });
  const months = Array.from({ length: 12 }, (_, i) => dayjs(since).add(i, 'month'));
  const incomeByMonth = months.map((m) => tx.filter((t) => dayjs(t.created_at).isSame(m, 'month')).reduce((s, t) => s + Number(t.amount), 0));

  const recent = {};
  for (const [key, from] of [['day', dayjs().startOf('day')], ['week', dayjs().startOf('week')], ['month', dayjs().startOf('month')]]) {
    recent[key] = await M.User.findAll({ where: { role: 'user', created_at: { [Op.gte]: from.toDate() } }, order: [['id', 'DESC']], limit: 10, attributes: ['id', 'first_name', 'last_name', 'email', 'avatar', 'created_at', 'is_active'] });
  }
  const currency = await defaultCurrency();
  // business snapshot (orders, COD, stock, invoices)
  const monthStart = dayjs().startOf('month').toDate();
  const [openOrders, todayOrders, monthOrders, codPending, unpaid, low] = await Promise.all([
    M.NfcOrder.count({ where: { order_status: ['pending', 'confirmed', 'designing', 'printing', 'ready', 'processing'] } }),
    M.NfcOrder.count({ where: { created_at: { [Op.gte]: dayjs().startOf('day').toDate() } } }),
    M.NfcOrder.findAll({ where: { created_at: { [Op.gte]: monthStart }, order_status: { [Op.notIn]: ['cancelled', 'returned'] } }, attributes: ['amount'], raw: true }),
    M.NfcOrder.sum('amount', { where: { is_cod: true, cod_settled: false, order_status: ['shipped', 'delivered'] } }),
    M.Invoice.findAll({ where: { status: ['sent', 'partial', 'overdue'] }, attributes: ['total', 'paid_amount'], raw: true }),
    require('../../services/inventory').lowStock(),
  ]);
  const business = {
    open_orders: openOrders, today_orders: todayOrders, month_sales: monthOrders.reduce((a, o) => a + Number(o.amount), 0), month_orders: monthOrders.length,
    cod_pending: Number(codPending || 0), unpaid_invoices: unpaid.reduce((a, i) => a + Number(i.total) - Number(i.paid_amount), 0), low_stock: low,
  };
  res.json({
    business,
    stats: { activeUsers, inactiveUsers, activeVcards, inactiveVcards, income: Number(income || 0), organisations, stores },
    plans: plans.map((p) => ({ name: p.name, total: byPlan[p.id] || 0 })),
    income: { labels: months.map((m) => m.format('MMM YY')), data: incomeByMonth },
    recent, currency,
  });
}));
async function defaultCurrency() {
  const id = await settings.get('default_currency_id');
  return (id && (await M.Currency.findByPk(id))) || (await M.Currency.findOne({ where: { currency_code: 'USD' } }));
}

/* ======================================================= users and admins */
r.use(require('./business'));
r.use('/users', usersRouter('user'));
r.use('/admins', usersRouter('admin'));

/* ================================================================ templates */
r.get('/templates', wrap(async (_req, res) => {
  const rows = await M.Template.findAll({ order: [['id', 'ASC']] });
  const used = await M.Vcard.findAll({ attributes: ['template_id', [fn('COUNT', col('id')), 'total']], group: ['template_id'], raw: true });
  const byTpl = Object.fromEntries(used.map((u) => [u.template_id, Number(u.total)]));
  res.json({ data: rows.map((t) => ({ ...t.toJSON(), vcards_count: byTpl[t.id] || 0 })) });
}));
r.patch('/templates/:id', wrap(async (req, res) => {
  const t = await M.Template.findByPk(req.params.id);
  if (!t) fail(404, 'Not found');
  await t.update(pick({ ...req.body, status: req.body.status === undefined ? undefined : toBool(req.body.status) }, ['name', 'profession', 'status']));
  res.json({ data: t, message: 'Template updated' });
}));

/* =================================================================== vcards */
r.get('/vcards', wrap(async (req, res) => {
  const p = paginate(req);
  const where = {};
  const q = (req.query.search || '').trim();
  if (q) where[Op.or] = ['name', 'url_alias', 'occupation'].map((f) => ({ [f]: { [Op.like]: `%${q}%` } }));
  if (req.query.template_id) where.template_id = req.query.template_id;
  if (req.query.status !== undefined && req.query.status !== '') where.status = toBool(req.query.status);
  const { rows, count } = await M.Vcard.findAndCountAll({
    where, order: [['id', 'DESC']], limit: p.limit, offset: p.offset,
    attributes: ['id', 'name', 'url_alias', 'occupation', 'profile_image', 'status', 'is_verified', 'views', 'created_at', 'template_id', 'user_id'],
    include: [{ model: M.User, attributes: ['id', 'first_name', 'last_name', 'email'] }, { model: M.Template, attributes: ['id', 'name'] }],
  });
  res.json(paged(rows, count, p));
}));
r.patch('/vcards/:id', wrap(async (req, res) => {
  const v = await M.Vcard.findByPk(req.params.id);
  if (!v) fail(404, 'Not found');
  const data = {};
  if (req.body.is_verified !== undefined) data.is_verified = toBool(req.body.is_verified);
  if (req.body.status !== undefined) data.status = toBool(req.body.status);
  await v.update(data);
  res.json({ message: 'vCard updated' });
}));
r.delete('/vcards/:id', wrap(async (req, res) => {
  const v = await M.Vcard.findByPk(req.params.id);
  if (!v) fail(404, 'Not found');
  await v.destroy();
  res.json({ message: 'Deleted successfully' });
}));

/* ==================================================================== plans */
const planBody = (b) => {
  const d = pick(b, ['name', 'currency_id', 'price', 'frequency', 'trial_days', 'no_of_vcards', 'storage_limit', 'tax_name', 'tax_rate', 'no_of_visitors', 'no_of_organization_users', 'no_of_whatsapp_stores', 'no_of_short_links', 'custom_duration_days']);
  for (const k of ['tax_rate', 'no_of_visitors', 'no_of_organization_users', 'no_of_whatsapp_stores', 'no_of_short_links']) d[k] = Number(d[k] || 0);
  d.custom_duration_days = d.custom_duration_days ? Number(d.custom_duration_days) : null;
  d.tax_name = d.tax_name || null;
  d.status = b.status === undefined ? true : toBool(b.status);
  d.custom_select = toBool(b.custom_select);
  d.features = Object.fromEntries(M.PLAN_FEATURES.map((f) => [f, toBool(b.features?.[f])]));
  return d;
};
const planRules = { name: 'required|max:100', currency_id: 'required', price: 'required|numeric', frequency: 'required|in:monthly,yearly,unlimited', no_of_vcards: 'required|numeric', trial_days: 'numeric', storage_limit: 'numeric' };
r.get('/plans', wrap(async (_req, res) => {
  const rows = await M.Plan.findAll({ include: [M.Currency, { model: M.Template, attributes: ['id', 'name'] }], order: [['id', 'ASC']] });
  const active = await M.Subscription.findAll({ attributes: ['plan_id', [fn('COUNT', col('id')), 'total']], where: { status: 'active' }, group: ['plan_id'], raw: true });
  const byPlan = Object.fromEntries(active.map((a) => [a.plan_id, Number(a.total)]));
  res.json({ data: rows.map((p) => ({ ...p.toJSON(), subscribers: byPlan[p.id] || 0 })), features: M.PLAN_FEATURES });
}));
r.get('/plans/:id', wrap(async (req, res) => {
  const p = await M.Plan.findByPk(req.params.id, { include: [M.Currency, { model: M.Template, attributes: ['id'] }] });
  if (!p) fail(404, 'Not found');
  res.json({ data: p, features: M.PLAN_FEATURES });
}));
r.post('/plans', wrap(async (req, res) => {
  validate(req.body, planRules);
  if (!Array.isArray(req.body.template_ids) || !req.body.template_ids.length) fail(422, 'Validation failed', { template_ids: 'Select at least one template' });
  const plan = await M.Plan.create(planBody(req.body));
  await plan.setTemplates(req.body.template_ids);
  res.status(201).json({ data: plan, message: 'Plan created successfully' });
}));
r.put('/plans/:id', wrap(async (req, res) => {
  const plan = await M.Plan.findByPk(req.params.id);
  if (!plan) fail(404, 'Not found');
  validate(req.body, planRules);
  if (!Array.isArray(req.body.template_ids) || !req.body.template_ids.length) fail(422, 'Validation failed', { template_ids: 'Select at least one template' });
  await plan.update(planBody(req.body));
  await plan.setTemplates(req.body.template_ids);
  res.json({ data: plan, message: 'Plan updated successfully' });
}));
r.patch('/plans/:id/default', wrap(async (req, res) => {
  const plan = await M.Plan.findByPk(req.params.id);
  if (!plan) fail(404, 'Not found');
  await M.Plan.update({ is_default: false }, { where: {} });
  await plan.update({ is_default: true, status: true });
  res.json({ message: `${plan.name} is now the default plan` });
}));
r.patch('/plans/:id/status', wrap(async (req, res) => {
  const plan = await M.Plan.findByPk(req.params.id);
  if (!plan) fail(404, 'Not found');
  if (plan.is_default && !toBool(req.body.status)) fail(422, 'The default plan cannot be deactivated');
  await plan.update({ status: toBool(req.body.status) });
  res.json({ message: 'Status updated' });
}));
r.delete('/plans/:id', wrap(async (req, res) => {
  const plan = await M.Plan.findByPk(req.params.id);
  if (!plan) fail(404, 'Not found');
  if (plan.is_default) fail(422, 'The default plan cannot be deleted');
  if (await M.Subscription.count({ where: { plan_id: plan.id, status: 'active' } })) fail(422, 'This plan has active subscribers and cannot be deleted');
  await plan.destroy();
  res.json({ message: 'Deleted successfully' });
}));

/* ======================================================= subscriptions */
r.get('/subscriptions', wrap(async (req, res) => {
  const p = paginate(req);
  const where = {};
  if (req.query.status) where.status = req.query.status;
  if (req.query.plan_id) where.plan_id = req.query.plan_id;
  const q = (req.query.search || '').trim();
  const userWhere = q ? { [Op.or]: ['first_name', 'last_name', 'email'].map((f) => ({ [f]: { [Op.like]: `%${q}%` } })) } : undefined;
  const { rows, count } = await M.Subscription.findAndCountAll({
    where, order: [['id', 'DESC']], limit: p.limit, offset: p.offset,
    include: [{ model: M.User, where: userWhere, attributes: ['id', 'first_name', 'last_name', 'email', 'avatar'] }, { model: M.Plan, attributes: ['id', 'name', 'price'], include: [M.Currency] }],
  });
  res.json(paged(rows, count, p));
}));
r.put('/subscriptions/:id', wrap(async (req, res) => {
  const s = await M.Subscription.findByPk(req.params.id);
  if (!s) fail(404, 'Not found');
  validate(req.body, { ends_at: 'required' });
  const ends = dayjs(req.body.ends_at);
  if (!ends.isValid()) fail(422, 'Validation failed', { ends_at: 'Invalid date' });
  await s.update({ ends_at: ends.endOf('day').toDate(), notes: req.body.notes ?? s.notes });
  res.json({ message: 'Subscription end date updated' });
}));

/* ==================================================== transactions / cash */
r.get('/transactions', wrap(async (req, res) => {
  const p = paginate(req);
  const where = {};
  if (req.query.type) where.type = req.query.type;
  if (req.query.status) where.status = req.query.status;
  if (req.query.purpose) where.purpose = req.query.purpose;
  const { rows, count } = await M.Transaction.findAndCountAll({
    where, order: [['id', 'DESC']], limit: p.limit, offset: p.offset,
    include: [{ model: M.User, attributes: ['id', 'first_name', 'last_name', 'email', 'avatar'] }, { model: M.Subscription, include: [{ model: M.Plan, attributes: ['id', 'name'] }] }],
  });
  res.json(paged(rows, count, p));
}));
r.patch('/transactions/:id/status', wrap(async (req, res) => {
  validate(req.body, { status: 'required|in:paid,rejected' });
  const t = await M.Transaction.findByPk(req.params.id);
  if (!t) fail(404, 'Not found');
  if (t.type !== 'manual') fail(422, 'Only manual (cash) payments can be approved or rejected');
  if (t.status !== 'pending') fail(422, 'This payment was already processed');
  await t.update({ status: req.body.status, notes: req.body.notes || t.notes });
  if (t.purpose === 'subscription') {
    const pending = await M.Subscription.findOne({ where: { transaction_id: t.id } });
    if (pending) {
      if (req.body.status === 'paid') {
        await M.Subscription.update({ status: 'inactive' }, { where: { user_id: t.user_id, status: 'active' } });
        const plan = await M.Plan.findByPk(pending.plan_id);
        await pending.update({ status: 'active', starts_at: new Date(), ends_at: subs.endDate(plan) });
        await subs.consumeCoupon(pending.coupon_code_meta);
      } else await pending.update({ status: 'inactive' });
    }
  } else {
    await M.NfcOrder.update({ payment_status: req.body.status }, { where: { transaction_id: t.id } });
  }
  const user = await M.User.findByPk(t.user_id);
  if (user) mail.sendTemplate('payment_status', user.email, { amount: t.amount, status: req.body.status === 'paid' ? 'approved' : 'rejected' }).catch(() => {});
  if (req.body.status === 'paid') extras.slack('payment', `Manual payment of ${t.amount} approved for ${user?.email}`);
  if (req.body.status === 'paid' && t.purpose === 'subscription' && (await settings.get('invoice_auto_subscriptions')) !== '0') require('../../services/invoices').fromTransaction(t.id).catch((e) => console.error('[invoice]', e.message));
  res.json({ message: req.body.status === 'paid' ? 'Payment approved' : 'Payment rejected' });
}));

/* ============================================================ NFC cards */
// NFC products + orders live in ./business.js

/* ============================================ affiliations / withdrawals */
r.get('/affiliations', wrap(async (req, res) => {
  const p = paginate(req);
  const where = req.query.status ? { status: req.query.status } : {};
  const { rows, count } = await M.AffiliateUser.findAndCountAll({
    where, order: [['id', 'DESC']], limit: p.limit, offset: p.offset,
    include: [{ model: M.User, as: 'affiliator', attributes: ['id', 'first_name', 'last_name', 'email'] }, { model: M.User, as: 'referred', attributes: ['id', 'first_name', 'last_name', 'email'] }],
  });
  res.json(paged(rows, count, p));
}));
r.patch('/affiliations/:id', wrap(async (req, res) => {
  validate(req.body, { status: 'required|in:approved,rejected,pending' });
  const a = await M.AffiliateUser.findByPk(req.params.id);
  if (!a) fail(404, 'Not found');
  await a.update({ status: req.body.status, is_verified: req.body.status === 'approved' });
  res.json({ message: 'Affiliation updated' });
}));
r.get('/withdrawals', wrap(async (req, res) => {
  const p = paginate(req);
  const where = req.query.status ? { status: req.query.status } : {};
  const { rows, count } = await M.Withdrawal.findAndCountAll({ where, order: [['id', 'DESC']], limit: p.limit, offset: p.offset, include: [{ model: M.User, attributes: ['id', 'first_name', 'last_name', 'email'] }] });
  res.json(paged(rows, count, p));
}));
r.patch('/withdrawals/:id', wrap(async (req, res) => {
  validate(req.body, { status: 'required|in:approved,rejected' });
  const w = await M.Withdrawal.findByPk(req.params.id);
  if (!w) fail(404, 'Not found');
  if (w.status !== 'pending') fail(422, 'This withdrawal was already processed');
  if (req.body.status === 'rejected' && !req.body.rejection_note) fail(422, 'Validation failed', { rejection_note: 'Please give a reason' });
  await w.update({ status: req.body.status, rejection_note: req.body.rejection_note || null, paid_by: req.body.paid_by || null });
  res.json({ message: `Withdrawal ${req.body.status}` });
}));

/* ============================================================ masters */
r.use('/currencies', crud(M.Currency, { fields: ['currency_name', 'currency_icon', 'currency_code'], rules: { currency_name: 'required|max:100', currency_icon: 'required|max:10', currency_code: 'required|max:10' }, search: ['currency_name', 'currency_code'], order: [['currency_name', 'ASC']],
  canDelete: async (row) => ((await M.Plan.count({ where: { currency_id: row.id } })) ? 'This currency is used by a plan' : null) }));
r.use('/countries', crud(M.Country, { fields: ['name', 'short_code', 'phone_code'], rules: { name: 'required|max:120', short_code: 'required|max:5' }, search: ['name', 'short_code'], order: [['name', 'ASC']] }));
r.use('/states', crud(M.State, { fields: ['name', 'country_id'], rules: { name: 'required|max:120', country_id: 'required' }, search: ['name'], filters: ['country_id'], include: [M.Country], order: [['name', 'ASC']] }));
r.use('/cities', crud(M.City, { fields: ['name', 'state_id'], rules: { name: 'required|max:120', state_id: 'required' }, search: ['name'], filters: ['state_id'], include: [{ model: M.State, include: [M.Country] }], order: [['name', 'ASC']] }));
r.use('/languages', crud(M.Language, { fields: ['name', 'iso_code', 'status'], booleans: ['status'], rules: { name: 'required|max:60', iso_code: 'required|max:10' }, search: ['name', 'iso_code'], order: [['name', 'ASC']],
  canDelete: async (row) => (row.is_default ? 'The default language cannot be deleted' : null) }));
r.use('/coupon-codes', crud(M.CouponCode, {
  fields: ['coupon_name', 'type', 'discount', 'expire_at', 'coupon_limit', 'status'], booleans: ['status'], search: ['coupon_name'],
  rules: { coupon_name: 'required|max:60', type: 'required|in:percentage,fixed', discount: 'required|numeric', coupon_limit: 'numeric' },
  beforeSave: (data, _req, row) => {
    data.coupon_name = String(data.coupon_name || row?.coupon_name).toUpperCase().replace(/\s+/g, '');
    if (data.type === 'percentage' && Number(data.discount) > 100) fail(422, 'Validation failed', { discount: 'Percentage cannot exceed 100' });
    if (!row || Number(row.coupon_limit) !== Number(data.coupon_limit)) data.coupon_limit_left = data.coupon_limit || null;
    return data;
  },
}));

/* ============================================================ front CMS */
r.use('/features', crud(M.Feature, { fields: ['title', 'description'], files: ['image'], folder: 'cms', rules: { title: 'required|max:150', description: 'required' }, order: [['id', 'ASC']] }));
r.use('/about-us', crud(M.AboutUs, { fields: ['title', 'description'], files: ['image'], folder: 'cms', rules: { title: 'required|max:150', description: 'required' }, order: [['id', 'ASC']] }));
r.use('/front-testimonials', crud(M.FrontTestimonial, { fields: ['name', 'designation', 'description'], files: ['image'], folder: 'cms', rules: { name: 'required|max:120', description: 'required' }, search: ['name'] }));
r.use('/front-faqs', crud(M.FrontFaq, { fields: ['title', 'description'], rules: { title: 'required|max:255', description: 'required' }, search: ['title'] }));
r.use('/enquiries', crud(M.Enquiry, { fields: [], search: ['name', 'email', 'subject'] }));
r.use('/email-subscribers', crud(M.EmailSubscription, { fields: [], search: ['email'] }));

/* ============================================================ send email */
r.get('/sent-emails', wrap(async (req, res) => {
  const p = paginate(req);
  const { rows, count } = await M.SentEmail.findAndCountAll({ order: [['id', 'DESC']], limit: p.limit, offset: p.offset, include: [{ model: M.User, as: 'sender', attributes: ['id', 'first_name', 'last_name'] }] });
  res.json(paged(rows, count, p));
}));
r.post('/send-email', wrap(async (req, res) => {
  validate(req.body, { subject: 'required|max:255', description: 'required', audience: 'required|in:all_users,subscribers,enquiries,custom' });
  let recipients = [];
  if (req.body.audience === 'all_users') recipients = (await M.User.findAll({ where: { role: 'user', is_active: true }, attributes: ['email'] })).map((u) => u.email);
  if (req.body.audience === 'subscribers') recipients = (await M.EmailSubscription.findAll({ attributes: ['email'] })).map((u) => u.email);
  if (req.body.audience === 'enquiries') recipients = (await M.Enquiry.findAll({ attributes: ['email'] })).map((u) => u.email);
  if (req.body.audience === 'custom') recipients = String(req.body.emails || '').split(/[\s,;]+/).map((e) => e.trim().toLowerCase()).filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
  recipients = [...new Set(recipients)];
  if (!recipients.length) fail(422, 'Validation failed', { emails: 'No valid recipients found' });
  const html = richText(req.body.description);
  // send in bcc batches of 50 so recipients never see each other
  for (let i = 0; i < recipients.length; i += 50) await mail.send({ to: undefined, bcc: recipients.slice(i, i + 50), subject: req.body.subject, html });
  await M.SentEmail.create({ subject: req.body.subject, description: html, recipients, sender_id: req.user.id });
  res.json({ message: `E-mail sent to ${recipients.length} recipient(s)` });
}));

/* ============================================================== settings */
const settingsUpload = makeUpload('settings', { maxMb: 2 }).fields([{ name: 'app_logo' }, { name: 'dashboard_logo' }, { name: 'favicon' }, { name: 'home_image' }, { name: 'invoice_logo' }]);
r.get('/settings', wrap(async (_req, res) => {
  res.json({ data: await settings.adminSettings(), currencies: await M.Currency.findAll({ order: [['currency_name', 'ASC']] }) });
}));
r.put('/settings', settingsUpload, wrap(async (req, res) => {
  const values = { ...req.body };
  for (const k of settings.SECRET_KEYS) if (values[k] === '********') delete values[k]; // unchanged secret
  for (const k of ['terms_conditions', 'privacy_policy', 'manual_payment_guide']) if (values[k] !== undefined) values[k] = richText(values[k]);
  for (const k of Object.keys(values)) if (/^mail_tpl_\w+_body$/.test(k)) values[k] = richText(values[k]);
  if (values.home_custom_css !== undefined) values.home_custom_css = String(values.home_custom_css).replace(/<[^>]*>/g, '').slice(0, 20000);
  if (values.slack_webhook_url && values.slack_webhook_url !== '********' && !/^https:\/\/hooks\.slack\.com\//.test(values.slack_webhook_url)) fail(422, 'Validation failed', { slack_webhook_url: 'Use a https://hooks.slack.com/... incoming webhook URL' });
  for (const k of ['app_logo', 'dashboard_logo', 'favicon', 'home_image', 'invoice_logo']) if (req.files?.[k]?.[0]) values[k] = fileUrl('settings', req.files[k][0]);
  if (values.google_analytics !== undefined && values.google_analytics && !/^(G|UA|GT|AW)-[A-Z0-9-]+$/i.test(values.google_analytics.trim())) {
    fail(422, 'Validation failed', { google_analytics: 'Enter the measurement ID only, e.g. G-XXXXXXX' });
  }
  await settings.set(values);
  res.json({ data: await settings.adminSettings(), message: 'Settings updated successfully' });
}));

/* ================================================ extra admin tools */
// bulk delete users / vCards
r.post('/users/bulk-delete', wrap(async (req, res) => {
  const ids = (Array.isArray(req.body.ids) ? req.body.ids : []).map(Number).filter(Boolean);
  if (!ids.length) fail(422, 'Select at least one user');
  await M.Vcard.destroy({ where: { user_id: ids } });
  // members of a deleted organisation become individual users
  await M.User.update({ organisation_id: null, company_role: null, permissions: null, org_status: 'active', locked_fields: null }, { where: { organisation_id: ids } });
  await M.Organisation.destroy({ where: { owner_id: ids } });
  const n = await M.User.destroy({ where: { id: ids, role: 'user' } });
  res.json({ message: `${n} user(s) deleted` });
}));
r.post('/vcards/bulk-delete', wrap(async (req, res) => {
  const ids = (Array.isArray(req.body.ids) ? req.body.ids : []).map(Number).filter(Boolean);
  if (!ids.length) fail(422, 'Select at least one vCard');
  const n = await M.Vcard.destroy({ where: { id: ids } });
  res.json({ message: `${n} vCard(s) deleted` });
}));
r.post('/users/:id/resend-verification', wrap(async (req, res) => {
  const user = await M.User.scope('withSecrets').findOne({ where: { id: req.params.id } });
  if (!user) fail(404, 'Not found');
  if (user.email_verified_at) fail(422, 'This e-mail is already verified');
  await require('../auth').sendVerification(user);
  res.json({ message: 'Verification e-mail sent' });
}));

// clone a vCard (optionally to another user)
r.post('/vcards/:id/clone', wrap(async (req, res) => {
  const v = await M.Vcard.findByPk(req.params.id);
  if (!v) fail(404, 'Not found');
  const target = req.body.user_id ? await M.User.findOne({ where: { id: req.body.user_id, role: 'user' } }) : await M.User.findByPk(v.user_id);
  if (!target) fail(422, 'Validation failed', { user_id: 'User not found' });
  const j = { ...v.get() };
  delete j.id; delete j.created_at; delete j.updated_at;
  const copy = await M.Vcard.create({ ...j, user_id: target.id, url_alias: `${v.url_alias}-${crypto.randomBytes(2).toString('hex')}`.slice(0, 80), name: `${v.name} (copy)`, views: 0, is_verified: false, custom_domain: null, custom_domain_status: null });
  for (const Model of [M.VcardService, M.VcardTestimonial, M.VcardProduct, M.VcardGallery, M.VcardBlog, M.VcardPage]) {
    for (const it of await Model.findAll({ where: { vcard_id: v.id }, raw: true })) { delete it.id; await Model.create({ ...it, vcard_id: copy.id }); }
  }
  res.status(201).json({ data: copy, message: `vCard cloned to ${target.first_name} ${target.last_name}` });
}));

// custom domain requests
r.get('/custom-domains', wrap(async (req, res) => {
  const where = { custom_domain: { [Op.ne]: null } };
  if (req.query.status) where.custom_domain_status = req.query.status;
  const rows = await M.Vcard.findAll({ where, attributes: ['id', 'name', 'url_alias', 'custom_domain', 'custom_domain_status', 'updated_at'], include: [{ model: M.User, attributes: ['id', 'first_name', 'last_name', 'email'] }], order: [['updated_at', 'DESC']] });
  res.json({ data: rows, target: require('../../config').appUrl.replace(/^https?:\/\//, '') });
}));
r.patch('/custom-domains/:id', wrap(async (req, res) => {
  validate(req.body, { status: 'required|in:approved,rejected' });
  const v = await M.Vcard.findByPk(req.params.id);
  if (!v || !v.custom_domain) fail(404, 'Not found');
  await v.update({ custom_domain_status: req.body.status });
  res.json({ message: `Domain ${req.body.status}` });
}));

// PDFs
r.get('/plans/:id/pdf', wrap(async (req, res) => {
  const plan = await M.Plan.findByPk(req.params.id, { include: [M.Currency] });
  if (!plan) fail(404, 'Not found');
  res.type('application/pdf').set('Content-Disposition', `attachment; filename="${plan.name}-plan.pdf"`).send(await docs.planPdf(plan, FEATURE_LABELS));
}));
r.get('/transactions/:id/invoice', wrap(async (req, res) => {
  const t = await M.Transaction.findByPk(req.params.id, { include: [M.User, { model: M.Subscription, include: [{ model: M.Plan, include: [M.Currency] }] }] });
  if (!t) fail(404, 'Not found');
  res.type('application/pdf').set('Content-Disposition', `attachment; filename="invoice-${t.id}.pdf"`).send(await docs.invoicePdf(require('../../utils/labels').transactionInvoice(t)));
}));
r.get('/nfc-orders/:id/invoice', wrap(async (req, res) => {
  const o = await M.NfcOrder.findByPk(req.params.id, { include: [M.NfcCard, M.Transaction] });
  if (!o) fail(404, 'Not found');
  res.type('application/pdf').set('Content-Disposition', `attachment; filename="${o.order_number}.pdf"`).send(await docs.invoicePdf(require('../../utils/labels').nfcInvoice(o)));
}));

// exports (csv / xlsx / pdf)
const EXPORTS = {
  enquiries: { model: 'Enquiry', title: 'Enquiries', cols: [['name', 'Name'], ['email', 'E-mail'], ['subject', 'Subject'], ['message', 'Message'], ['created_at', 'Date']] },
  subscribers: { model: 'EmailSubscription', title: 'Subscribers', cols: [['email', 'E-mail'], ['created_at', 'Subscribed']] },
  users: { model: 'User', title: 'Users', where: { role: 'user' }, cols: [['first_name', 'First name'], ['last_name', 'Last name'], ['email', 'E-mail'], ['contact', 'Phone'], ['is_active', 'Active'], ['created_at', 'Joined']] },
};
r.get('/export/:what', wrap(async (req, res) => {
  const e = EXPORTS[req.params.what];
  if (!e) fail(404, 'Not found');
  const rows = (await M[e.model].findAll({ where: e.where || {}, order: [['id', 'DESC']], raw: true })).map((x) => ({ ...x, created_at: dayjs(x.created_at).format('YYYY-MM-DD HH:mm') }));
  const out = await docs.exportRows(String(req.query.format || 'csv'), e.title, e.cols.map(([key, label]) => ({ key, label })), rows);
  res.type(out.type).set('Content-Disposition', `attachment; filename="${req.params.what}.${out.ext}"`).send(out.body);
}));

// front blog
r.use('/front-blogs', crud(M.FrontBlog, {
  fields: ['title', 'slug', 'excerpt', 'content', 'status'], booleans: ['status'], files: ['image'], folder: 'cms', search: ['title'],
  rules: { title: 'required|max:200', content: 'required' },
  beforeSave: async (data, _req, row) => {
    if (data.content !== undefined) data.content = richText(data.content);
    const base = String(data.slug || data.title || row?.title || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 180) || `post-${Date.now()}`;
    if (!row || (data.slug !== undefined && data.slug !== row.slug)) {
      let slug = base; let i = 1;
      while (await M.FrontBlog.findOne({ where: { slug, id: { [Op.ne]: row?.id || 0 } } })) slug = `${base}-${++i}`;
      data.slug = slug;
    }
    return data;
  },
}));

// e-mail templates
r.get('/email-templates', wrap(async (_req, res) => {
  const s = await settings.all();
  res.json({ data: Object.entries(mail.TEMPLATES).map(([key, t]) => ({ key, subject: s[`mail_tpl_${key}_subject`] || t.subject, body: s[`mail_tpl_${key}_body`] || t.body, default_subject: t.subject, default_body: t.body, placeholders: [...new Set((t.subject + t.body).match(/\{\{\s*\w+\s*\}\}/g) || [])] })) });
}));
r.post('/settings/test-mail', wrap(async (req, res) => {
  validate(req.body, { email: 'required|email' });
  try { await mail.send({ to: req.body.email, subject: 'Test e-mail', html: '<p>Your mail settings work.</p>' }); } catch (e) { fail(422, `Could not send: ${e.message}`); }
  res.json({ message: `Test e-mail sent to ${req.body.email}` });
}));
r.post('/settings/test-slack', wrap(async (_req, res) => {
  const s = await settings.all();
  if (!s.slack_webhook_url) fail(422, 'Save a webhook URL first');
  const resp = await fetch(s.slack_webhook_url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: `*${s.app_name}* · Slack integration works :tada:` }) }).catch(() => null);
  if (!resp || !resp.ok) fail(422, 'Slack rejected the message, check the webhook URL');
  res.json({ message: 'Test message sent to Slack' });
}));

// WhatsApp stores (all users)
r.get('/whatsapp-stores', wrap(async (req, res) => {
  const p = paginate(req);
  const q = (req.query.search || '').trim();
  const where = q ? { [Op.or]: [{ name: { [Op.like]: `%${q}%` } }, { url_alias: { [Op.like]: `%${q}%` } }] } : {};
  const { rows, count } = await M.WhatsappStore.findAndCountAll({ where, order: [['id', 'DESC']], limit: p.limit, offset: p.offset, include: [{ model: M.User, attributes: ['id', 'first_name', 'last_name', 'email'] }] });
  res.json(paged(rows, count, p));
}));
r.patch('/whatsapp-stores/:id', wrap(async (req, res) => {
  const st = await M.WhatsappStore.findByPk(req.params.id);
  if (!st) fail(404, 'Not found');
  await st.update({ status: toBool(req.body.status) });
  res.json({ message: 'Store updated' });
}));
r.delete('/whatsapp-stores/:id', wrap(async (req, res) => {
  const st = await M.WhatsappStore.findByPk(req.params.id);
  if (!st) fail(404, 'Not found');
  await st.destroy();
  res.json({ message: 'Store deleted' });
}));

/* ============================================ lookups used by admin forms */
r.get('/lookups', wrap(async (_req, res) => {
  const [currencies, templates, plans] = await Promise.all([
    M.Currency.findAll({ order: [['currency_name', 'ASC']] }),
    M.Template.findAll({ attributes: ['id', 'name', 'slug', 'profession'], order: [['id', 'ASC']] }),
    M.Plan.findAll({ where: { status: true }, attributes: ['id', 'name', 'price', 'frequency'] }),
  ]);
  res.json({ currencies, templates, plans });
}));

module.exports = r;
