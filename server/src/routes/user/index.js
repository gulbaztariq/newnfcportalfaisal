const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { Op, fn, col } = require('sequelize');
const dayjs = require('dayjs');
const QRCode = require('qrcode');
const qrstyle = require('../../services/qrstyle');
const M = require('../../models');
const { HttpError, wrap, fail, validate, pick, toBool, paginate, paged } = require('../../utils/http');
const { requireRole, companyWorkspace } = require('../../middleware/auth');
const { makeUpload, fileUrl, removeFile, DOC_TYPES } = require('../../middleware/upload');
const subs = require('../../services/subscription');
const payments = require('../../services/payments');
const settings = require('../../services/settings');
const { appUrl } = require('../../config');
const RESERVED = require('../../utils/reserved');
const extras = require('../../services/extras');
const docs = require('../../services/documents');
const labels = require('../../utils/labels');
const mail = require('../../services/mail');
const webhooks = require('../../services/webhooks');
const fs = require('fs');

const r = express.Router();
r.use(requireRole('user'), companyWorkspace);
const org = require('../../services/organisation');
// organisation members whose organisation locked card management
const cardsUnlocked = (req, _res, next) => (org.isLocked(req.user, 'manage_cards') ? next(new HttpError(403, 'Your organisation manages your cards. Please contact your organisation administrator.')) : next());
const { trackStorage, removeOwned } = require('./helpers');
const { render: renderCard, vcardCsp } = require('../../views/templates/render');
const { TEMPLATES: CATALOG, CATEGORIES, metaOf } = require('../../views/templates/catalog');
const custom = require('../../views/templates/custom');
const { clientUrl } = require('../../config');
const CATALOG_BY_SLUG = Object.fromEntries(CATALOG.map((t) => [t.slug, t]));

const ownVcard = async (req, id = req.params.id) => {
  const v = await M.Vcard.findOne({ where: { id, user_id: req.user.id } });
  if (!v) fail(404, 'vCard not found');
  return v;
};
const hideSecret = (v) => v.toJSON(); // Vcard#toJSON strips the password hash

/* ============================================================== dashboard */
r.get('/dashboard', wrap(async (req, res) => {
  const vcards = await M.Vcard.findAll({ where: { user_id: req.user.id }, attributes: ['id', 'name', 'url_alias', 'views', 'status'] });
  const ids = vcards.map((v) => v.id);
  const since = dayjs().subtract(29, 'day').startOf('day');
  const views = ids.length ? await M.VcardView.findAll({ where: { vcard_id: ids, created_at: { [Op.gte]: since.toDate() } }, attributes: ['created_at', 'device'], raw: true }) : [];
  const days = Array.from({ length: 30 }, (_, i) => since.add(i, 'day'));
  const enquiries = ids.length ? await M.VcardEnquiry.count({ where: { vcard_id: ids } }) : 0;
  const devices = views.reduce((o, v) => ((o[v.device || 'desktop'] = (o[v.device || 'desktop'] || 0) + 1), o), {});
  const recentEnquiries = ids.length ? await M.VcardEnquiry.findAll({ where: { vcard_id: ids }, order: [['id', 'DESC']], limit: 5, include: [{ model: M.Vcard, attributes: ['name'] }] }) : [];
  res.json({
    stats: { vcards: vcards.length, active: vcards.filter((v) => v.status).length, views: vcards.reduce((s, v) => s + v.views, 0), enquiries },
    chart: { labels: days.map((d) => d.format('DD MMM')), data: days.map((d) => views.filter((v) => dayjs(v.created_at).isSame(d, 'day')).length) },
    devices, recentEnquiries, subscription: await subs.current(req.user.id),
    vcards: vcards.map((v) => ({ id: v.id, name: v.name, alias: v.url_alias, live: !!v.status })),
  });
}));

/* ================================================================= vcards */
r.get('/vcards', wrap(async (req, res) => {
  const rows = await M.Vcard.findAll({ where: { user_id: req.user.id }, order: [['id', 'DESC']], include: [{ model: M.Template, attributes: ['id', 'name'] }] });
  res.json({ data: rows.map(hideSecret), app_url: appUrl });
}));

r.get('/vcards/templates', wrap(async (req, res) => {
  const sub = await subs.current(req.user.id);
  const allowed = sub?.plan?.templates?.map((t) => t.id) || [];
  const all = await M.Template.findAll({ where: { status: true }, order: [['id', 'ASC']] });
  // gallery metadata (category, description, collection) lives in the catalogue, next to the layout itself
  const used = await M.Vcard.findAll({ attributes: ['template_id', [fn('COUNT', col('id')), 'n']], group: ['template_id'], raw: true });
  const uses = Object.fromEntries(used.map((u) => [u.template_id, Number(u.n)]));
  res.json({
    data: all.map((t) => ({ ...t.toJSON(), ...metaOf(CATALOG_BY_SLUG[t.slug] || t), avatar_fixed: custom.AVATAR_FIXED.has(CATALOG_BY_SLUG[t.slug]?.layout), uses: uses[t.id] || 0, allowed: allowed.includes(t.id) })),
    categories: CATEGORIES, features: sub?.plan?.features || {},
    schema: { keys: custom.KEYS, colors: custom.COLORS, enums: custom.ENUMS, numbers: custom.NUMBERS, bools: custom.BOOLS, fonts: Object.keys(custom.GOOGLE_FONTS) },
  });
}));

r.get('/vcards/check-alias', wrap(async (req, res) => {
  const alias = String(req.query.alias || '').toLowerCase();
  const taken = RESERVED.has(alias) || !!(await M.Vcard.findOne({ where: { url_alias: alias, id: { [Op.ne]: req.query.id || 0 } } }));
  res.json({ available: !taken && /^[a-z0-9][a-z0-9-_]{1,79}$/.test(alias) });
}));

r.post('/vcards', cardsUnlocked, wrap(async (req, res) => {
  validate(req.body, { name: 'required|max:120', template_id: 'required' });
  const check = await subs.canCreateVcard(req.user.id);
  if (!check.ok) fail(422, check.reason);
  // the card link is generated, never typed: it stays fixed for the life of the card
  const alias = await require('../../services/onboarding').freeAlias(req.body.name);
  const allowed = check.sub.plan.templates.map((t) => t.id);
  if (!allowed.includes(Number(req.body.template_id))) fail(422, 'Validation failed', { template_id: 'This template is not included in your plan' });
  const tpl = await M.Template.findByPk(req.body.template_id);
  const v = await M.Vcard.create({
    ...pick(req.body, ['name', 'occupation', 'description']), url_alias: alias, template_id: tpl.id, user_id: req.user.id,
    first_name: req.user.first_name, last_name: req.user.last_name, email: req.user.email, theme: tpl.defaults || {},
    sections: { contact: true, social: true, services: true, gallery: true, testimonials: true, hours: true, qr: true, enquiry: true },
  });
  res.status(201).json({ data: hideSecret(v), message: 'vCard created successfully' });
}));

r.get('/vcards/:id', wrap(async (req, res) => {
  const v = await ownVcard(req);
  const [services, gallery, testimonials] = await Promise.all([
    M.VcardService.findAll({ where: { vcard_id: v.id }, order: [['sort', 'ASC'], ['id', 'ASC']] }),
    M.VcardGallery.findAll({ where: { vcard_id: v.id } }),
    M.VcardTestimonial.findAll({ where: { vcard_id: v.id } }),
  ]);
  const sub = await subs.current(req.user.id);
  res.json({ data: { ...hideSecret(v), services, gallery, testimonials }, features: sub?.plan?.features || {}, app_url: appUrl });
}));

const sectionsOf = (x) => Object.fromEntries(Object.entries(x || {}).filter(([k]) => SECTION_KEYS.includes(k)).map(([k, val]) => [k, toBool(val)]));
const orderOf = (x) => [...new Set((Array.isArray(x) ? x : []).filter((k) => SECTION_KEYS.includes(k)))];
const titlesOf = (x) => Object.fromEntries(Object.entries(x && typeof x === 'object' ? x : {}).filter(([k, val]) => SECTION_KEYS.includes(k) && typeof val === 'string' && val.trim()).map(([k, val]) => [k, val.trim().slice(0, 60)]));

/* unsaved text from the editor, kept in memory for the live preview only (never written to the database) */
const DRAFTS = new Map(); const DRAFT_TTL = 30 * 60 * 1000;
const DRAFT_TEXT = { first_name: 100, last_name: 100, occupation: 150, job_title: 150, company: 150, description: 5000, email: 191, region_code: 8, phone: 30, alternative_email: 191, alternative_phone: 30, location: 255, location_url: 500, name: 120, menu_title: 120, menu_desc: 500 };
function draftContent(b, features) {
  const out = {};
  for (const [k, n] of Object.entries(DRAFT_TEXT)) if (b[k] !== undefined) out[k] = k === 'description' ? String(b[k] ?? '').slice(0, n) : cutStr(b[k], n) || null;
  if (b.location_url) out.location_url = /^https?:\/\//i.test(String(b.location_url)) ? cutStr(b.location_url, 500) : null;
  if (b.social_links && typeof b.social_links === 'object') out.social_links = cleanSocial(b.social_links);
  if (features.custom_links && Array.isArray(b.custom_links)) out.custom_links = cleanCustomLinks(b.custom_links);
  if (Array.isArray(b.bank_accounts)) out.bank_accounts = cleanBanks(b.bank_accounts);
  if (features.payment_links && Array.isArray(b.payment_links)) out.payment_links = cleanPayLinks(b.payment_links);
  if (b.business_hours && typeof b.business_hours === 'object' && !Array.isArray(b.business_hours)) {
    out.business_hours = Object.fromEntries(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].filter((d) => b.business_hours[d]).map((d) => [d, { open: toBool(b.business_hours[d].open), from: hhmm(b.business_hours[d].from) || '09:00', to: hhmm(b.business_hours[d].to) || '17:00' }]));
  }
  return out;
}
r.post('/vcards/:id/preview-draft', wrap(async (req, res) => {
  const v = await ownVcard(req);
  const sub = await subs.current(req.user.id);
  const content = draftContent(req.body && typeof req.body === 'object' ? req.body : {}, sub?.plan?.features || {});
  const key = `${req.user.id}:${v.id}`;
  DRAFTS.delete(key); DRAFTS.set(key, { content, at: Date.now() });
  for (const [k, x] of DRAFTS) if (Date.now() - x.at > DRAFT_TTL || DRAFTS.size > 500) DRAFTS.delete(k); // oldest first
  res.json({ ok: true });
}));

/**
 * Live preview for the design editor: the owner's real card rendered with an unsaved design (template, theme, sections).
 * Read-only: nothing is stored, no view is counted. The draft travels base64url-encoded in ?d= and is validated like a save.
 */
r.get('/vcards/:id/preview', wrap(async (req, res) => {
  const v = await ownVcard(req);
  let d = {};
  try {
    const raw = Buffer.from(String(req.query.d || ''), 'base64url').toString('utf8');
    if (raw && raw.length <= 12000) d = JSON.parse(raw);
  } catch { d = {}; }
  if (!d || typeof d !== 'object' || Array.isArray(d)) d = {};
  let template = await M.Template.findByPk(v.template_id);
  if (d.template_id && Number(d.template_id) !== v.template_id) {
    const sub = await subs.current(req.user.id);
    const allowed = sub?.plan?.templates?.map((t) => t.id) || [];
    if (allowed.includes(Number(d.template_id))) template = (await M.Template.findByPk(Number(d.template_id))) || template;
  }
  const card = { ...v.toJSON(), theme: d.theme && typeof d.theme === 'object' ? custom.sanitizeTheme(d.theme, v.theme) : custom.sanitizeTheme({}, v.theme) };
  const draft = DRAFTS.get(`${req.user.id}:${v.id}`);
  if (draft && Date.now() - draft.at < DRAFT_TTL) Object.assign(card, draft.content); // unsaved text, links and accounts typed in the editor
  if (d.sections) card.sections = sectionsOf(d.sections);
  if (Array.isArray(d.section_order)) card.section_order = orderOf(d.section_order);
  if (d.section_titles) card.section_titles = titlesOf(d.section_titles);
  const [services, gallery, testimonials, products, blogs, pages, app] = await Promise.all([
    M.VcardService.findAll({ where: { vcard_id: v.id }, order: [['sort', 'ASC'], ['id', 'ASC']] }),
    M.VcardGallery.findAll({ where: { vcard_id: v.id }, limit: 60 }),
    M.VcardTestimonial.findAll({ where: { vcard_id: v.id }, limit: 20 }),
    M.VcardProduct.findAll({ where: { vcard_id: v.id }, order: [['sort', 'ASC'], ['id', 'ASC']], limit: 60 }),
    M.VcardBlog.findAll({ where: { vcard_id: v.id, status: true }, attributes: ['title', 'slug', 'image', 'created_at'], order: [['id', 'DESC']], limit: 6 }),
    M.VcardPage.findAll({ where: { vcard_id: v.id, status: true }, attributes: ['title', 'slug'], order: [['id', 'ASC']] }),
    settings.all(),
  ]);
  res.set({ 'Content-Security-Policy': vcardCsp(res.locals.nonce, clientUrl), 'X-Robots-Tag': 'noindex', 'Cache-Control': 'no-store' });
  res.type('html').send(renderCard({ v: card, template, services, gallery, testimonials, products, blogs, pages, app, appUrl, nonce: res.locals.nonce, preview: { still: d.still === true } }));
}));

const vcardUpload = makeUpload('vcards', { maxMb: 5 }).fields([{ name: 'profile_image', maxCount: 1 }, { name: 'cover_image', maxCount: 1 }, { name: 'bg_image', maxCount: 1 }]);
const videoUpload = makeUpload('vcards', { types: { 'video/mp4': '.mp4', 'video/webm': '.webm' }, maxMb: 25 }).single('video');
const VCARD_FIELDS = ['name', 'occupation', 'description', 'first_name', 'last_name', 'email', 'region_code', 'phone', 'alternative_email', 'alternative_phone',
  'location', 'location_url', 'company', 'job_title', 'dob', 'menu_title', 'menu_desc', 'site_title', 'meta_keyword', 'meta_description', 'google_analytics', 'default_language', 'custom_css', 'custom_code', 'custom_code_enabled'];
const JSON_FIELDS = ['theme', 'social_links', 'custom_links', 'business_hours', 'sections', 'section_order', 'section_titles', 'iframes', 'payment_links', 'bank_accounts', 'qr_settings', 'appointment_settings', 'extras'];
// sections of the public card that can be shown/hidden, reordered and renamed (views/templates/render.js)
const SECTION_KEYS = ['about', 'contact', 'social', 'links', 'menu', 'services', 'products', 'store', 'appointments', 'gallery', 'testimonials', 'payments', 'blog', 'embeds', 'map', 'hours', 'qr', 'enquiry'];
const sanitizeHtml = require('sanitize-html');
const legalHtml = (h) => sanitizeHtml(String(h || ''), { allowedTags: sanitizeHtml.defaults.allowedTags.concat(['h1', 'h2', 'u', 's']), allowedSchemes: ['http', 'https', 'mailto', 'tel'] });
const hhmm = (t) => (/^\d{2}:\d{2}$/.test(String(t)) ? t : null);
const safeUrl = (u) => (!u || /^(https?:|mailto:|tel:)/i.test(String(u).trim()) ? u : `https://${u}`);
const cutStr = (x, n) => String(x ?? '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, n);
// the same cleaning is used when saving a card and when building the live preview of unsaved text
const cleanBanks = (list) => (Array.isArray(list) ? list : []).slice(0, 200).map((a) => ({
  kind: a?.kind === 'wallet' ? 'wallet' : 'bank', name: cutStr(a?.name, 80), title: cutStr(a?.title, 120), account: cutStr(a?.account, 60),
  iban: cutStr(a?.iban, 40).replace(/\s+/g, '').toUpperCase(), note: cutStr(a?.note, 200),
})).filter((a) => a.name && (a.account || a.iban));
const cleanPayLinks = (list) => (Array.isArray(list) ? list : []).slice(0, 10).map((l) => ({ label: String(l?.label || '').slice(0, 80), url: safeUrl(String(l?.url || '').slice(0, 500)), type: String(l?.type || 'link').slice(0, 20) })).filter((l) => l.label && l.url);
const cleanSocial = (o) => Object.fromEntries(Object.entries(o && typeof o === 'object' && !Array.isArray(o) ? o : {}).filter(([, u]) => u).map(([k, u]) => [k, safeUrl(String(u).slice(0, 500))]));
const cleanCustomLinks = (list) => (Array.isArray(list) ? list : []).slice(0, 20).map((l) => ({ label: String(l?.label || '').slice(0, 80), url: safeUrl(String(l?.url || '').slice(0, 500)), desc: String(l?.desc || '').slice(0, 90), badge: String(l?.badge || '').slice(0, 20), featured: l?.featured === true || l?.featured === 'true', icon: /^ri-[a-z0-9-]{2,40}$/.test(l?.icon || '') ? l.icon : '' })).filter((l) => l.label && l.url);

r.put('/vcards/:id', vcardUpload, trackStorage, wrap(async (req, res) => {
  const v = await ownVcard(req);
  const b = { ...req.body };
  org.stripCardLocks(req.user, b, req.files); // fields locked by the member's organisation stay as they are
  if (org.isLocked(req.user, 'theme') && req.files) delete req.files.bg_image;
  for (const k of JSON_FIELDS) if (typeof b[k] === 'string') { try { b[k] = JSON.parse(b[k]); } catch { delete b[k]; } }
  validate({ ...v.toJSON(), ...b }, { name: 'required|max:120', url_alias: 'required|alias', first_name: 'max:100', last_name: 'max:100', occupation: 'max:150', company: 'max:150', job_title: 'max:150', email: 'email|max:191', alternative_email: 'email|max:191', phone: 'phone', alternative_phone: 'phone', location: 'max:300', location_url: 'url|max:1000', dob: 'date' });
  const sub = await subs.current(req.user.id);
  const features = sub?.plan?.features || {};
  const data = pick(b, VCARD_FIELDS);
  for (const [k, val] of Object.entries(data)) if (val === '') data[k] = null;
  if (!features.custom_css) delete data.custom_css;
  if (!features.custom_code) { delete data.custom_code; delete data.custom_code_enabled; }
  if (data.custom_code_enabled !== undefined) data.custom_code_enabled = data.custom_code_enabled === true || data.custom_code_enabled === 'true' || data.custom_code_enabled === '1';
  if (data.custom_code && data.custom_code.length > 500000) fail(422, 'Validation failed', { custom_code: 'The code is too large (max 500 KB)' });
  if (!features.seo) for (const k of ['site_title', 'meta_keyword', 'meta_description', 'google_analytics']) delete data[k];
  if (data.google_analytics && !/^(G|UA|GT)-[A-Z0-9-]+$/i.test(data.google_analytics)) fail(422, 'Validation failed', { google_analytics: 'Use the measurement ID, e.g. G-XXXXXXX' });

  // the card link is printed on QR codes and written into NFC cards, so it never changes after the card is created
  if (b.url_alias && String(b.url_alias).toLowerCase() !== v.url_alias) fail(422, 'Validation failed', { url_alias: 'The card link cannot be changed because it may already be printed on QR codes or written into NFC cards.' });
  if (b.template_id && Number(b.template_id) !== v.template_id) {
    const allowed = sub?.plan?.templates?.map((t) => t.id) || [];
    if (!allowed.includes(Number(b.template_id))) fail(422, 'Validation failed', { template_id: 'This template is not included in your plan' });
    data.template_id = Number(b.template_id);
  }
  if ((b.theme && typeof b.theme === 'object') || req.files?.bg_image?.[0]) {
    // every option is validated against the schema in views/templates/custom.js; '' removes an option
    const theme = custom.sanitizeTheme(b.theme, v.theme);
    if (req.files?.bg_image?.[0]) theme.bg_image = fileUrl('vcards', req.files.bg_image[0]);
    if (v.theme?.bg_image && v.theme.bg_image !== theme.bg_image) removeOwned(req, v.theme.bg_image);
    data.theme = theme;
  }
  if (b.social_links) data.social_links = cleanSocial(b.social_links);
  if (b.custom_links && features.custom_links) data.custom_links = cleanCustomLinks(b.custom_links);
  if (b.business_hours) data.business_hours = b.business_hours;
  if (b.sections) data.sections = sectionsOf(b.sections);
  if (Array.isArray(b.section_order)) data.section_order = orderOf(b.section_order);
  if (b.section_titles && typeof b.section_titles === 'object') data.section_titles = titlesOf(b.section_titles);
  for (const k of ['status', 'enable_enquiry_form', 'show_qr_code']) if (b[k] !== undefined) data[k] = toBool(b[k]);
  if (b.hide_branding !== undefined) data.hide_branding = features.hide_branding ? toBool(b.hide_branding) : false;
  if (b.password !== undefined && features.password) data.password = b.password ? await bcrypt.hash(String(b.password), 10) : null;
  for (const f of ['profile_image', 'cover_image']) if (req.files?.[f]?.[0]) { removeOwned(req, v[f]); data[f] = fileUrl('vcards', req.files[f][0]); }
  if (b.remove_cover_image === '1') { removeOwned(req, v.cover_image); data.cover_image = null; }

  // media, embeds and behaviour (gated by plan features)
  if (b.cover_type !== undefined) data.cover_type = ['image', 'video', 'youtube'].includes(b.cover_type) ? b.cover_type : 'image';
  if (b.youtube_link !== undefined) {
    const m = String(b.youtube_link || '').match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([\w-]{11})/) || String(b.youtube_link || '').match(/^([\w-]{11})$/);
    if (b.youtube_link && !m) fail(422, 'Validation failed', { youtube_link: 'Enter a valid YouTube link' });
    data.youtube_link = m ? m[1] : null;
  }
  if (b.instagram_embed !== undefined) {
    if (b.instagram_embed && !features.instagram_embed) fail(422, 'Instagram embed is not included in your plan');
    if (b.instagram_embed && !/^https:\/\/(www\.)?instagram\.com\/(p|reel|tv)\/[\w-]+/i.test(b.instagram_embed)) fail(422, 'Validation failed', { instagram_embed: 'Paste an Instagram post or reel link' });
    data.instagram_embed = b.instagram_embed || null;
  }
  if (b.linkedin_embed !== undefined) {
    if (b.linkedin_embed && !features.linkedin_embed) fail(422, 'LinkedIn embed is not included in your plan');
    const urn = String(b.linkedin_embed || '').match(/urn:li:(share|ugcPost|activity):\d+/) || String(b.linkedin_embed || '').match(/activity-(\d+)/);
    if (b.linkedin_embed && !urn) fail(422, 'Validation failed', { linkedin_embed: 'Paste the LinkedIn post link or its embed code' });
    data.linkedin_embed = urn ? (urn[0].startsWith('urn') ? urn[0] : `urn:li:activity:${urn[1]}`) : null;
  }
  if (b.iframes !== undefined && features.iframes) data.iframes = (Array.isArray(b.iframes) ? b.iframes : []).slice(0, 5).filter((x) => /^https:\/\//.test(x?.url || '')).map((x) => ({ title: String(x.title || '').slice(0, 80), url: String(x.url).slice(0, 500) }));
  if (b.location_embed !== undefined) {
    const src = (String(b.location_embed || '').match(/src="([^"]+)"/) || [null, b.location_embed])[1];
    if (src && !/^https:\/\/(www\.)?google\.[a-z.]+\/maps\/embed/.test(src)) fail(422, 'Validation failed', { location_embed: 'Paste the Google Maps "Embed a map" code or URL' });
    data.location_embed = src || null;
  }
  if (b.payment_links !== undefined) {
    const links = cleanPayLinks(b.payment_links);
    // never drop typed links silently: tell the owner when the plan does not include them
    if (!features.payment_links && links.length && JSON.stringify(links) !== JSON.stringify(v.payment_links || [])) fail(422, 'Payment links are not included in your plan. Bank and wallet accounts do not need a plan feature: add those instead, or upgrade your plan.');
    if (features.payment_links) data.payment_links = links;
  }
  // bank / wallet accounts to receive money: as many as the owner wants, each with a copy button on the card
  if (b.bank_accounts !== undefined) data.bank_accounts = cleanBanks(b.bank_accounts);
  if (b.terms_conditions !== undefined) data.terms_conditions = legalHtml(b.terms_conditions) || null;
  if (b.privacy_policy !== undefined) data.privacy_policy = legalHtml(b.privacy_policy) || null;
  for (const k of ['sticky_bar', 'ask_before_contact', 'enquiry_attachment']) if (b[k] !== undefined) data[k] = toBool(b[k]);
  if (b.newsletter_popup !== undefined) data.newsletter_popup = features.newsletter ? toBool(b.newsletter_popup) : false;
  if (b.pwa_enable !== undefined) data.pwa_enable = features.pwa ? toBool(b.pwa_enable) : false;
  if (b.business_directory !== undefined) data.business_directory = features.business_directory ? toBool(b.business_directory) : false;
  if (b.week_format !== undefined) data.week_format = b.week_format === 'sun' ? 'sun' : 'mon';
  if (b.extras && typeof b.extras === 'object') {
    const x = b.extras; const bn = x.banner && typeof x.banner === 'object' ? x.banner : {};
    const str = (val, n) => String(val ?? '').trim().slice(0, n);
    const link = str(bn.url, 500);
    if (link && !/^(https?:\/\/|mailto:|tel:)/i.test(link)) fail(422, 'Validation failed', { banner_url: 'Banner link must start with https://' });
    let storeId = Number(x.store_id) || null;
    if (storeId && !(await M.WhatsappStore.findOne({ where: { id: storeId, user_id: v.user_id }, attributes: ['id'] }))) storeId = null;
    data.extras = {
      banner: { enabled: toBool(bn.enabled) && !!str(bn.title, 80), title: str(bn.title, 80), text: str(bn.text, 300), button: str(bn.button, 30), url: link },
      terms_checkbox: toBool(x.terms_checkbox), share_sheet: x.share_sheet === undefined ? true : toBool(x.share_sheet),
      dob_icon: /^ri-[a-z0-9-]{2,40}$/.test(String(x.dob_icon || '')) ? x.dob_icon : '', store_id: storeId, whatsapp_text: str(x.whatsapp_text, 300).replace(/[\r\n]+/g, ' '),
    };
  } else delete data.extras;
  if (b.qr_settings) {
    const q = pick(b.qr_settings, ['fg', 'bg', 'size', 'margin', 'ec', 'style', 'eye']);
    q.style = qrstyle.STYLES.includes(q.style) && features.custom_qrcode ? q.style : 'square'; q.eye = qrstyle.EYES.includes(q.eye) && features.custom_qrcode ? q.eye : 'square';
    if (!features.custom_qrcode) { delete q.fg; delete q.bg; }
    for (const k of ['fg', 'bg']) if (q[k] && !/^#[0-9a-f]{6}$/i.test(q[k])) delete q[k];
    q.size = Math.min(1200, Math.max(200, Number(q.size) || 600)); q.margin = Math.min(8, Math.max(0, Number(q.margin ?? 2)));
    q.ec = ['L', 'M', 'Q', 'H'].includes(q.ec) ? q.ec : 'M';
    data.qr_settings = q;
  }
  if (b.appointment_settings) {
    if (!features.appointments && toBool(b.appointment_settings.enabled)) fail(422, 'Appointments are not included in your plan');
    const a = b.appointment_settings;
    const slots = {};
    for (const d of ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']) slots[d] = (Array.isArray(a.slots?.[d]) ? a.slots[d] : []).slice(0, 12).map((x) => ({ from: hhmm(x.from), to: hhmm(x.to) })).filter((x) => x.from && x.to && x.from < x.to);
    data.appointment_settings = {
      enabled: toBool(a.enabled), paid: toBool(a.paid), price: Math.max(0, Number(a.price) || 0), duration: [15, 20, 30, 45, 60, 90, 120].includes(Number(a.duration)) ? Number(a.duration) : 30,
      slots, blocked: (Array.isArray(a.blocked) ? a.blocked : []).filter((x) => /^\d{4}-\d{2}-\d{2}$/.test(x)).slice(0, 200), by_service: toBool(a.by_service),
    };
  }
  if (b.custom_domain !== undefined) {
    const dom = String(b.custom_domain || '').toLowerCase().trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    if (dom && !features.allow_custom_domain) fail(422, 'Custom domains are not included in your plan');
    if (dom && !/^([a-z0-9-]+\.)+[a-z]{2,}$/.test(dom)) fail(422, 'Validation failed', { custom_domain: 'Enter a domain like card.yourcompany.com' });
    if (dom && (await M.Vcard.findOne({ where: { custom_domain: dom, id: { [Op.ne]: v.id } } }))) fail(422, 'Validation failed', { custom_domain: 'This domain is already used' });
    if (dom !== (v.custom_domain || '')) { data.custom_domain = dom || null; data.custom_domain_status = dom ? 'pending' : null; }
  }
  await v.update(data);
  res.json({ data: hideSecret(v), message: 'vCard updated successfully' });
}));

/* copy parts of one card onto the owner's other cards: one person often manages several cards under one e-mail */
const COPY_GROUPS = {
  contact: ['email', 'region_code', 'phone', 'alternative_email', 'alternative_phone', 'location', 'location_url'],
  business: ['company', 'job_title', 'occupation', 'description'],
  social: ['social_links'], links: ['custom_links'], payments: ['bank_accounts', 'payment_links'], hours: ['business_hours'],
  design: ['template_id', 'theme', 'sections', 'section_order', 'section_titles'],
};
r.post('/vcards/:id/copy-to', cardsUnlocked, wrap(async (req, res) => {
  const src = await ownVcard(req);
  const groups = [...new Set((Array.isArray(req.body.groups) ? req.body.groups : []).filter((g) => Object.hasOwn(COPY_GROUPS, g)))];
  if (!groups.length) fail(422, 'Validation failed', { groups: 'Choose what to copy' });
  const ids = [...new Set((Array.isArray(req.body.target_ids) ? req.body.target_ids : []).map(Number).filter((n) => Number.isInteger(n) && n > 0 && n !== src.id))].slice(0, 100);
  const targets = ids.length ? await M.Vcard.findAll({ where: { id: ids, user_id: req.user.id } }) : [];
  if (!targets.length) fail(422, 'Validation failed', { target_ids: 'Choose at least one of your other cards' });
  const sub = await subs.current(req.user.id);
  const features = sub?.plan?.features || {};
  const body = {};
  for (const f of groups.flatMap((g) => COPY_GROUPS[g])) body[f] = src[f] === undefined ? null : JSON.parse(JSON.stringify(src[f] ?? null));
  org.stripCardLocks(req.user, body); // fields locked by the organisation are never overwritten
  if (!features.custom_links) delete body.custom_links;
  if (!features.payment_links) delete body.payment_links;
  if (body.template_id && !(sub?.plan?.templates || []).some((t) => t.id === body.template_id)) { delete body.template_id; delete body.theme; }
  if (body.theme && typeof body.theme === 'object') delete body.theme.bg_image; // an uploaded background belongs to one card
  const fields = Object.keys(body);
  if (!fields.length) fail(422, 'Validation failed', { groups: 'Nothing to copy: these details are managed by your organisation or not in your plan' });
  for (const t of targets) await t.update(body);
  res.json({ copied: fields, cards: targets.length, message: `Copied to ${targets.length} card${targets.length === 1 ? '' : 's'}` });
}));

r.post('/vcards/:id/duplicate', cardsUnlocked, wrap(async (req, res) => {
  const v = await ownVcard(req);
  const check = await subs.canCreateVcard(req.user.id);
  if (!check.ok) fail(422, check.reason);
  const j = v.toJSON();
  delete j.id; delete j.created_at; delete j.updated_at;
  const copy = await M.Vcard.create({ ...j, url_alias: `${v.url_alias}-${crypto.randomBytes(2).toString('hex')}`.slice(0, 80), name: `${v.name} (copy)`, views: 0, is_verified: false });
  for (const Model of [M.VcardService, M.VcardTestimonial, M.VcardProduct, M.VcardBlog, M.VcardPage]) {
    const items = await Model.findAll({ where: { vcard_id: v.id }, raw: true });
    for (const it of items) { delete it.id; await Model.create({ ...it, vcard_id: copy.id }); }
  }
  res.status(201).json({ data: hideSecret(copy), message: 'vCard duplicated' });
}));

r.delete('/vcards/:id', cardsUnlocked, wrap(async (req, res) => {
  const v = await ownVcard(req);
  removeFile(v.profile_image); removeFile(v.cover_image);
  await v.destroy();
  res.json({ message: 'vCard deleted' });
}));


/* email signature: email-safe HTML for a card (style, colour, photo, QR, social links, button text) */
r.get('/vcards/:id/signature', wrap(async (req, res) => {
  const v = await ownVcard(req); const q = req.query;
  const on = (x, d) => (x === undefined ? d : !['0', 'false', 'off'].includes(String(x)));
  const html = require('../../services/signature').build(v, { style: q.style, color: q.color, photo: on(q.photo, true), qr: on(q.qr, false), social: on(q.social, true), button: q.button }, appUrl);
  res.json({ html, styles: require('../../services/signature').STYLES });
}));
r.get('/vcards/:id/qrcode', wrap(async (req, res) => {
  const v = await ownVcard(req);
  const q = v.qr_settings || {};
  const opts = { width: Number(req.query.size) || q.size || 600, margin: q.margin ?? 2, errorCorrectionLevel: q.ec || 'M', color: { dark: q.fg || v.theme?.primary || '#000000', light: q.bg || '#ffffff' } };
  // QR codes point at the vCard's dynamic short link (destination can change later); ?direct=1 encodes the vCard URL itself
  const target = `${req.query.direct === '1' ? `${appUrl}/${v.url_alias}` : require('../../services/shortlinks').shortUrl((await require('../../services/shortlinks').forVcard(v)).code)}?via=qr`; // via=qr: scans are counted as QR scans
  if (req.query.format === 'svg' || qrstyle.isStyled(q)) {
    // styled codes (dots, rounded, round eyes) only exist as SVG; the editor turns it into a PNG in the browser when asked
    const out = qrstyle.svg(target, { fg: opts.color.dark, bg: opts.color.light, margin: opts.margin, ec: opts.errorCorrectionLevel, style: q.style, eye: q.eye, size: opts.width });
    res.set('Content-Type', 'image/svg+xml');
    if (req.query.inline !== '1') res.set('Content-Disposition', `attachment; filename="${v.url_alias}-qr.svg"`);
    return res.send(out);
  }
  const png = await QRCode.toBuffer(target, opts);
  res.set('Content-Type', 'image/png').set('Content-Disposition', `attachment; filename="${v.url_alias}-qr.png"`).send(png);
}));

/* multi-page menu / catalogue viewer: pages are images, shown full screen behind the "View Full Menu" card */
const MENU_MAX = 30;
const menuUpload = makeUpload('vcards', { maxMb: 8 }).array('pages', 10);
r.post('/vcards/:id/menu', menuUpload, trackStorage, wrap(async (req, res) => {
  const v = await ownVcard(req);
  const files = req.files || [];
  if (!files.length) fail(422, 'Validation failed', { pages: 'Choose one or more images' });
  const cur = Array.isArray(v.menu_pages) ? v.menu_pages : [];
  const added = files.map((f) => fileUrl('vcards', f));
  if (cur.length + added.length > MENU_MAX) { for (const u of added) removeOwned(req, u); fail(422, 'Validation failed', { pages: `A menu can have up to ${MENU_MAX} pages` }); }
  const pages = [...cur, ...added];
  await v.update({ menu_pages: pages });
  res.json({ data: { menu_pages: pages }, message: `${added.length} page${added.length > 1 ? 's' : ''} added` });
}));
r.put('/vcards/:id/menu', wrap(async (req, res) => {
  const v = await ownVcard(req);
  const cur = Array.isArray(v.menu_pages) ? v.menu_pages : [];
  const keep = [...new Set((Array.isArray(req.body.pages) ? req.body.pages : []).filter((u) => cur.includes(u)))]; // reorder / remove only, never add arbitrary URLs
  for (const u of cur.filter((x) => !keep.includes(x))) removeOwned(req, u);
  await v.update({ menu_pages: keep });
  res.json({ data: { menu_pages: keep }, message: 'Menu updated' });
}));

r.post('/vcards/:id/cover-video', videoUpload, trackStorage, wrap(async (req, res) => {
  const v = await ownVcard(req);
  if (!req.file) fail(422, 'Validation failed', { video: 'Choose an MP4 or WebM video' });
  removeOwned(req, v.cover_video);
  await v.update({ cover_video: fileUrl('vcards', req.file), cover_type: 'video' });
  res.json({ data: v.toJSON(), message: 'Cover video uploaded' });
}));

/* analytics dashboard: every card of this user, or one (?vcard=id) */
r.get('/analytics', wrap(async (req, res) => {
  const mine = await M.Vcard.findAll({ where: { user_id: req.user.id }, attributes: ['id', 'name', 'url_alias', 'status'], order: [['id', 'ASC']], raw: true });
  const raw = req.query.vcard;
  const want = raw && raw !== 'all' ? Number(raw) : null;
  if (raw && raw !== 'all' && (!Number.isInteger(want) || !mine.some((c) => c.id === want))) fail(404, 'vCard not found');
  const data = await require('../../services/analytics').report(want ? [want] : mine.map((c) => c.id), require('../../services/analytics').optionsFrom(req.query));
  res.json({ data, cards: mine.map((c) => ({ id: c.id, name: c.name, alias: c.url_alias, live: !!c.status })) });
}));

/* company analytics: the owner's own cards plus every member's, with a per-person breakdown (?member=userId to focus on one person) */
r.get('/analytics/company', wrap(async (req, res) => {
  if (!req.user.is_organisation) fail(403, 'Only organisation accounts have company analytics');
  const analytics = require('../../services/analytics');
  const [profile, limit, members] = await Promise.all([org.profileOf(req.user), org.seatLimit(req.user), M.User.findAll({ where: { organisation_id: req.user.id }, attributes: ['id', 'first_name', 'last_name', 'email', 'company_role', 'org_status'], raw: true })]);
  const owner = { id: req.user.id, first_name: req.user.first_name, last_name: req.user.last_name, email: req.user.email, company_role: 'owner', org_status: 'active' };
  const everyone = [owner, ...members];
  const cards = await M.Vcard.findAll({ where: { user_id: everyone.map((u) => u.id) }, attributes: ['id', 'name', 'url_alias', 'status', 'user_id'], order: [['id', 'ASC']], raw: true });
  const who = (u) => `${u.first_name} ${u.last_name || ''}`.trim() || u.email;
  const people = everyone.map((u) => ({ id: u.id, name: u.id === req.user.id ? `${who(u)} (owner)` : who(u), email: u.email, role: u.company_role || 'member', status: u.org_status || 'active', cardIds: cards.filter((c) => c.user_id === u.id).map((c) => c.id) }));
  const rawMember = req.query.member; const memberId = rawMember && rawMember !== 'all' ? Number(rawMember) : null;
  if (rawMember && rawMember !== 'all' && (!Number.isInteger(memberId) || !people.some((p) => p.id === memberId))) fail(404, 'Member not found');
  const rawCard = req.query.vcard; const cardId = rawCard && rawCard !== 'all' ? Number(rawCard) : null;
  if (rawCard && rawCard !== 'all' && (!Number.isInteger(cardId) || !cards.some((c) => c.id === cardId))) fail(404, 'vCard not found');
  let ids = cards.map((c) => c.id);
  if (memberId) ids = people.find((p) => p.id === memberId).cardIds;
  if (cardId) ids = ids.filter((i) => i === cardId);
  const data = await analytics.report(ids, { ...analytics.optionsFrom(req.query), people });
  const ownerOf = Object.fromEntries(everyone.map((u) => [u.id, people.find((p) => p.id === u.id).name]));
  res.json({
    data,
    cards: cards.filter((c) => !memberId || c.user_id === memberId).map((c) => ({ id: c.id, name: c.name, alias: c.url_alias, live: !!c.status, owner: ownerOf[c.user_id] })),
    people: people.map((p) => ({ id: p.id, name: p.name })),
    company: {
      name: profile.name, seats: { limit, used: members.length },
      members: { total: members.length, active: members.filter((m) => (m.org_status || 'active') === 'active').length, locked: members.filter((m) => m.org_status === 'locked').length, blocked: members.filter((m) => m.org_status === 'blocked').length },
      cards: { total: cards.length, live: cards.filter((c) => c.status).length },
    },
  });
}));

/* per-vCard analytics (older, simpler view) */
r.get('/vcards/:id/analytics', wrap(async (req, res) => {
  const v = await ownVcard(req);
  const days = Math.min(365, Math.max(7, Number(req.query.days) || 30));
  const since = dayjs().subtract(days - 1, 'day').startOf('day');
  const views = await M.VcardView.findAll({ where: { vcard_id: v.id, created_at: { [Op.gte]: since.toDate() } }, attributes: ['created_at', 'device', 'referrer'], raw: true });
  const byDay = Array.from({ length: days }, (_, i) => since.add(i, 'day')).map((d) => ({ label: d.format('DD MMM'), value: views.filter((x) => dayjs(x.created_at).isSame(d, 'day')).length }));
  const tally = (key, fn) => Object.entries(views.reduce((o, x) => { const k = fn ? fn(x[key]) : x[key] || 'unknown'; o[k] = (o[k] || 0) + 1; return o; }, {})).map(([name, value]) => ({ name, value })).sort((a, b2) => b2.value - a.value);
  const host = (u) => { try { return u ? new URL(u).hostname.replace(/^www\./, '') : 'Direct / NFC / QR'; } catch { return 'Direct / NFC / QR'; } };
  const [enquiries, appointments, subscribers] = await Promise.all([M.VcardEnquiry.count({ where: { vcard_id: v.id } }), M.Appointment.count({ where: { vcard_id: v.id } }), M.VcardSubscriber.count({ where: { vcard_id: v.id } })]);
  res.json({ total: v.views, period: views.length, byDay, devices: tally('device'), referrers: tally('referrer', host).slice(0, 8), enquiries, appointments, subscribers });
}));

/* gallery extras: an audio clip, a short video or a document (PDF) */
const mediaUpload = makeUpload('vcards', { types: require('../../middleware/upload').MEDIA_TYPES, maxMb: 15 }).single('file');
r.post('/vcards/:id/gallery-media', mediaUpload, trackStorage, wrap(async (req, res) => {
  const v = await ownVcard(req);
  if (!req.file) fail(422, 'Validation failed', { file: 'Please choose an audio, video or PDF file' });
  validate(req.body, { caption: 'required|max:150', category: 'max:80' }, { caption: 'Title', category: 'Category' });
  if ((await M.VcardGallery.count({ where: { vcard_id: v.id } })) >= 50) fail(422, 'Limit reached (50 items)');
  const type = req.file.mimetype.startsWith('audio/') ? 'audio' : req.file.mimetype.startsWith('video/') ? 'video' : 'file';
  const item = await M.VcardGallery.create({ vcard_id: v.id, image: '', type, video_url: fileUrl('vcards', req.file), caption: req.body.caption, category: req.body.category || null });
  res.status(201).json({ data: item, message: 'Saved' });
}));

/* vCard sub resources: services, testimonials, gallery */
const subUpload = makeUpload('vcards', { maxMb: 4 }).single('image');
for (const [path, Model, fields, rules] of [
  ['services', M.VcardService, ['name', 'description', 'service_url', 'sort'], { name: 'required|max:150', service_url: 'url' }],
  ['testimonials', M.VcardTestimonial, ['name', 'description'], { name: 'required|max:120', description: 'required' }],
  ['gallery', M.VcardGallery, ['caption', 'category', 'type', 'video_url'], {}],
]) {
  r.post(`/vcards/:id/${path}`, subUpload, trackStorage, wrap(async (req, res) => {
    const v = await ownVcard(req);
    validate(req.body, rules);
    if (path === 'gallery') {
      if (req.body.type === 'youtube') {
        const m = String(req.body.video_url || '').match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([\w-]{11})/);
        if (!m) fail(422, 'Validation failed', { video_url: 'Enter a valid YouTube link' });
        req.body.video_url = m[1];
      } else if (!req.file) fail(422, 'Validation failed', { image: 'Please choose an image' });
      else req.body.type = 'image';
    }
    if ((await Model.count({ where: { vcard_id: v.id } })) >= 50) fail(422, 'Limit reached (50 items)');
    const item = await Model.create({ ...pick(req.body, fields), vcard_id: v.id, image: fileUrl('vcards', req.file) || (path === 'gallery' ? '' : null) });
    res.status(201).json({ data: item, message: 'Saved' });
  }));
  r.put(`/vcards/:id/${path}/:itemId`, subUpload, trackStorage, wrap(async (req, res) => {
    const v = await ownVcard(req);
    const item = await Model.findOne({ where: { id: req.params.itemId, vcard_id: v.id } });
    if (!item) fail(404, 'Not found');
    validate({ ...item.toJSON(), ...req.body }, rules);
    const data = pick(req.body, fields);
    if (req.file) { removeOwned(req, item.image); data.image = fileUrl('vcards', req.file); }
    await item.update(data);
    res.json({ data: item, message: 'Updated' });
  }));
  r.delete(`/vcards/:id/${path}/:itemId`, wrap(async (req, res) => {
    const v = await ownVcard(req);
    const item = await Model.findOne({ where: { id: req.params.itemId, vcard_id: v.id } });
    if (!item) fail(404, 'Not found');
    removeFile(item.image);
    if (path === 'gallery' && String(item.video_url || '').startsWith('/uploads/')) removeFile(item.video_url);
    await item.destroy();
    res.json({ message: 'Deleted' });
  }));
}

const LEAD_STATUS = ['new', 'contacted', 'qualified', 'won', 'lost'];
r.get('/enquiries', wrap(async (req, res) => {
  const p = paginate(req);
  const ids = (await M.Vcard.findAll({ where: { user_id: req.user.id }, attributes: ['id'] })).map((v) => v.id);
  const where = { vcard_id: ids };
  if (LEAD_STATUS.includes(req.query.status)) where.status = req.query.status;
  if (req.query.vcard_id && ids.includes(Number(req.query.vcard_id))) where.vcard_id = Number(req.query.vcard_id);
  const q = String(req.query.search || '').trim().slice(0, 80);
  if (q) where[Op.or] = ['name', 'email', 'phone', 'message', 'notes', 'tags'].map((f) => ({ [f]: { [Op.like]: `%${q.replace(/[%_]/g, '\\$&')}%` } }));
  const { rows, count } = await M.VcardEnquiry.findAndCountAll({ where, include: [{ model: M.Vcard, attributes: ['id', 'name'] }], order: [['id', 'DESC']], limit: p.limit, offset: p.offset });
  const tally = await M.VcardEnquiry.findAll({ where: { vcard_id: ids }, attributes: ['status', [fn('COUNT', col('id')), 'n']], group: ['status'], raw: true });
  const body = paged(rows, count, p);
  body.counts = Object.fromEntries(LEAD_STATUS.map((st) => [st, Number(tally.find((x) => (x.status || 'new') === st)?.n || 0)]));
  res.json(body);
}));
/** follow-up fields the owner can change: status, tags, notes */
r.patch('/enquiries/:id', wrap(async (req, res) => {
  const e = await M.VcardEnquiry.findByPk(req.params.id, { include: [M.Vcard] });
  if (!e || e.vcard.user_id !== req.user.id) fail(404, 'Not found');
  const b = req.body || {}; const data = {};
  if (b.status !== undefined) { if (!LEAD_STATUS.includes(b.status)) fail(422, 'Choose a valid status', { status: 'Choose a valid status' }); data.status = b.status; }
  if (b.tags !== undefined) {
    if (!Array.isArray(b.tags)) fail(422, 'Tags must be a list', { tags: 'Tags must be a list' });
    data.tags = [...new Set(b.tags.map((t) => String(t).replace(/[\r\n]/g, ' ').trim().slice(0, 30)).filter(Boolean))].slice(0, 12);
  }
  if (b.notes !== undefined) data.notes = String(b.notes).slice(0, 4000) || null;
  await e.update(data);
  res.json({ message: 'Saved', data: e });
}));
r.delete('/enquiries/:id', wrap(async (req, res) => {
  const e = await M.VcardEnquiry.findByPk(req.params.id, { include: [M.Vcard] });
  if (!e || e.vcard.user_id !== req.user.id) fail(404, 'Not found');
  await e.destroy();
  res.json({ message: 'Deleted' });
}));


/* ============================================================ Google Contacts */
const gcontacts = require('../../services/googlecontacts');
r.get('/integrations/google', wrap(async (req, res) => res.json(await gcontacts.status(req.user.id))));
r.post('/integrations/google/connect', wrap(async (req, res) => { try { res.json({ url: await gcontacts.authUrl(req.user.id) }); } catch (e) { fail(e.status || 500, e.message); } }));
r.put('/integrations/google', wrap(async (req, res) => { if (!(await gcontacts.status(req.user.id)).connected) fail(422, 'Connect your Google account first'); await gcontacts.setAuto(req.user.id, toBool(req.body.auto)); res.json(await gcontacts.status(req.user.id)); }));
r.post('/integrations/google/disconnect', wrap(async (req, res) => { await gcontacts.disconnect(req.user.id); res.json({ message: 'Google disconnected', ...(await gcontacts.status(req.user.id)) }); }));
r.post('/integrations/google/sync-all', wrap(async (req, res) => {
  try { const out = await gcontacts.syncAll(req.user.id); res.json({ ...out, message: `${out.sent} lead(s) added to Google Contacts${out.remaining ? `, ${out.remaining} more to send` : ''}` }); } catch (e) { fail(e.status || 502, e.message); }
}));

/* ================================================================ webhooks */
const hookOut = (h) => ({ id: h.id, name: h.name, url: h.url, secret: h.secret, events: h.events || [], active: h.active, last_status: h.last_status, last_at: h.last_at, failures: h.failures });
const hookFields = async (b) => {
  validate(b, { name: 'required|max:80', url: 'required|max:500' });
  const events = (Array.isArray(b.events) ? b.events : []).filter((e) => webhooks.EVENTS[e]);
  if (!events.length) fail(422, 'Choose at least one event', { events: 'Choose at least one event' });
  await webhooks.checkUrl(b.url).catch((e) => fail(422, e.message, { url: e.message }));
  return { name: String(b.name).trim(), url: String(b.url).trim(), events };
};
const ownHook = async (req) => { const h = await M.Webhook.findByPk(req.params.id); if (!h || h.user_id !== req.user.id) fail(404, 'Not found'); return h; };
r.get('/webhooks', wrap(async (req, res) => res.json({ data: (await M.Webhook.findAll({ where: { user_id: req.user.id }, order: [['id', 'DESC']] })).map(hookOut), events: webhooks.EVENTS })));
r.post('/webhooks', wrap(async (req, res) => {
  if (await M.Webhook.count({ where: { user_id: req.user.id } }) >= 10) fail(422, 'You can add up to 10 webhooks');
  const h = await M.Webhook.create({ ...(await hookFields(req.body || {})), user_id: req.user.id, secret: webhooks.newSecret(), active: true });
  res.status(201).json({ message: 'Webhook added', data: hookOut(h) });
}));
r.put('/webhooks/:id', wrap(async (req, res) => {
  const h = await ownHook(req); const b = req.body || {};
  const data = await hookFields({ name: b.name ?? h.name, url: b.url ?? h.url, events: b.events ?? h.events });
  if (b.active !== undefined) { data.active = toBool(b.active); if (data.active) data.failures = 0; }
  await h.update(data);
  res.json({ message: 'Saved', data: hookOut(h) });
}));
r.post('/webhooks/:id/secret', wrap(async (req, res) => { const h = await ownHook(req); await h.update({ secret: webhooks.newSecret() }); res.json({ message: 'New signing secret created', data: hookOut(h) }); }));
r.delete('/webhooks/:id', wrap(async (req, res) => { const h = await ownHook(req); await h.destroy(); res.json({ message: 'Deleted' }); }));
r.post('/webhooks/:id/test', wrap(async (req, res) => {
  const h = await ownHook(req);
  const out = await webhooks.deliver(h, 'lead.created', { test: true, card: { id: 0, name: 'Sample card', alias: 'sample' }, lead: { id: 0, name: 'Sample Lead', email: 'lead@example.com', phone: '+923001234567', message: 'This is a test delivery from NFC Profile', status: 'new' } });
  res.json({ message: out.ok ? 'Test delivered' : `Test failed: ${out.error}`, data: out });
}));
r.get('/webhooks/:id/deliveries', wrap(async (req, res) => { const h = await ownHook(req); res.json({ data: await M.WebhookDelivery.findAll({ where: { webhook_id: h.id }, order: [['id', 'DESC']], limit: 30 }) }); }));

/* =========================================================== subscription */
r.get('/plans', wrap(async (req, res) => {
  const plans = await M.Plan.findAll({ where: { status: true }, include: [M.Currency, { model: M.Template, attributes: ['id', 'name'] }], order: [['price', 'ASC']] });
  const s = await settings.publicSettings();
  const gateways = [...payments.NAMES, 'manual_payment'].filter((g) => s[`${g}_enable`] === '1').map((g) => g.replace('_payment', ''));
  res.json({ data: plans, current: await subs.current(req.user.id), gateways, manual_payment_guide: s.manual_payment_guide, features: M.PLAN_FEATURES });
}));

r.post('/coupon/check', wrap(async (req, res) => {
  validate(req.body, { plan_id: 'required', code: 'required|max:40' }, { code: 'Coupon code' });
  const plan = await M.Plan.findOne({ where: { id: req.body.plan_id, status: true } });
  if (!plan) fail(404, 'Plan not found');
  try { res.json(await subs.applyCoupon(plan, String(req.body.code || '').toUpperCase())); } catch (e) { fail(422, e.message); }
}));

const receiptUpload = makeUpload('receipts', { types: DOC_TYPES, maxMb: 5 }).single('attachment');
r.post('/subscribe', receiptUpload, wrap(async (req, res) => {
  validate(req.body, { plan_id: 'required', payment_type: `required|in:free,manual,${payments.NAMES.join(',')}` });
  const plan = await M.Plan.findOne({ where: { id: req.body.plan_id, status: true } });
  if (!plan) fail(404, 'Plan not found');
  let quote;
  try { quote = await subs.applyCoupon(plan, req.body.coupon ? String(req.body.coupon).toUpperCase() : null); } catch (e) { fail(422, e.message); }

  if (quote.payable <= 0) {
    await subs.activate(req.user.id, plan, { paymentType: 'free', amount: 0, discount: quote.discount, coupon: quote.coupon });
    await subs.consumeCoupon(quote.coupon);
    return res.json({ message: `You are now subscribed to ${plan.name}` });
  }
  if (req.body.payment_type === 'manual') {
    if ((await settings.get('manual_payment_enable')) !== '1') fail(422, 'Manual payment is disabled');
    if (await M.Transaction.findOne({ where: { user_id: req.user.id, type: 'manual', status: 'pending', purpose: 'subscription' } })) fail(422, 'You already have a manual payment waiting for approval');
    const t = await M.Transaction.create({ user_id: req.user.id, amount: quote.payable, tax_amount: quote.tax, type: 'manual', status: 'pending', purpose: 'subscription', notes: String(req.body.notes || '').slice(0, 1000), attachment: fileUrl('receipts', req.file), meta: { plan_id: plan.id, tax: quote.tax, discount: quote.discount } });
    await M.Subscription.create({ user_id: req.user.id, plan_id: plan.id, transaction_id: t.id, plan_amount: plan.price, discount: quote.discount, payable_amount: quote.payable, plan_frequency: plan.frequency, status: 'pending', payment_type: 'manual', coupon_code_meta: quote.coupon, tax_amount: quote.tax });
    return res.json({ message: 'Your payment request was sent. The plan will be activated after approval.' });
  }
  const session = await payments.createCheckout(req.body.payment_type, { user: req.user, plan, quote, purpose: 'subscription' });
  res.json({ redirect: session.url });
}));

r.get('/payment/:gateway/success', wrap(async (req, res) => {
  const result = await payments.verify(req.params.gateway, req.query, req.user);
  res.json(result);
}));

r.get('/transactions', wrap(async (req, res) => {
  const p = paginate(req);
  const { rows, count } = await M.Transaction.findAndCountAll({ where: { user_id: req.user.id }, include: [{ model: M.Subscription, include: [{ model: M.Plan, attributes: ['name'] }] }], order: [['id', 'DESC']], limit: p.limit, offset: p.offset });
  res.json(paged(rows, count, p));
}));

/* ============================================================== NFC orders */
r.get('/nfc-cards', wrap(async (_req, res) => res.json({ data: await M.NfcCard.findAll({ where: { status: true } }) })));
r.get('/nfc-orders', wrap(async (req, res) => {
  const rows = await M.NfcOrder.findAll({ where: { user_id: req.user.id }, attributes: { exclude: ['admin_note', 'cost_amount', 'stock_vendor_id', 'courier_charges'] }, include: [{ model: M.NfcCard, attributes: ['name', 'front_image'] }, { model: M.Vcard, attributes: ['name', 'url_alias'] }, { model: M.NfcOrderItem, as: 'items' }], order: [['id', 'DESC']] });
  res.json({ data: rows });
}));
const logoUpload = makeUpload('nfc', { maxMb: 3 }).single('logo');
r.post('/nfc-orders', logoUpload, wrap(async (req, res) => {
  validate(req.body, { nfc_card_id: 'required', vcard_id: 'required', name: 'required|max:120', email: 'required|email', phone: 'required|phone', address: 'required|max:1000', quantity: 'required|integer|minv:1|maxv:1000', payment_type: `required|in:manual,${payments.NAMES.join(',')}` });
  const card = await M.NfcCard.findOne({ where: { id: req.body.nfc_card_id, status: true } });
  if (!card) fail(404, 'Card type not found');
  const vcard = await ownVcard(req, req.body.vcard_id);
  const qty = Math.min(1000, Math.max(1, parseInt(req.body.quantity, 10)));
  const s = await settings.all();
  const subtotal = Math.round(Number(card.price) * qty * 100) / 100;
  const taxAmount = Math.round(subtotal * Number(s.nfc_tax_rate || 0)) / 100;
  const amount = Math.round((subtotal + taxAmount) * 100) / 100;
  const order = await M.NfcOrder.create({
    ...pick(req.body, ['name', 'designation', 'company_name', 'email', 'phone', 'region_code', 'address']),
    order_number: `NFC-${dayjs().format('YYMMDD')}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`,
    user_id: req.user.id, vcard_id: vcard.id, nfc_card_id: card.id, quantity: qty, unit_price: card.price, amount, tax_amount: taxAmount,
    payment_type: req.body.payment_type, logo: fileUrl('nfc', req.file),
  });
  if (req.body.payment_type === 'manual') {
    const t = await M.Transaction.create({ user_id: req.user.id, amount, type: 'manual', status: 'pending', purpose: 'nfc_order', meta: { nfc_order_id: order.id } });
    await order.update({ transaction_id: t.id });
    return res.status(201).json({ data: order, message: 'Order placed. It will be processed after payment approval.' });
  }
  const session = await payments.createCheckout(req.body.payment_type, { user: req.user, order, purpose: 'nfc_order' });
  res.json({ redirect: session.url });
}));

/* ============================================================ affiliation */
r.get('/affiliation', wrap(async (req, res) => {
  const [referrals, withdrawals] = await Promise.all([
    M.AffiliateUser.findAll({ where: { affiliated_by: req.user.id }, include: [{ model: M.User, as: 'referred', attributes: ['first_name', 'last_name', 'email'] }], order: [['id', 'DESC']] }),
    M.Withdrawal.findAll({ where: { user_id: req.user.id }, order: [['id', 'DESC']] }),
  ]);
  const earned = referrals.filter((a) => a.status === 'approved').reduce((s, a) => s + Number(a.amount), 0);
  const withdrawn = withdrawals.filter((w) => w.status !== 'rejected').reduce((s, w) => s + Number(w.amount), 0);
  res.json({ referrals, withdrawals, earned, balance: Math.max(0, earned - withdrawn), link: `${appUrl}/register?ref=${req.user.affiliate_code}`, min_withdrawal: Number(await settings.get('min_withdrawal_amount')) });
}));
r.post('/withdrawals', wrap(async (req, res) => {
  validate(req.body, { amount: 'required|numeric|minv:0.01', email: 'required|email', bank_details: 'required|max:2000' });
  const referrals = await M.AffiliateUser.findAll({ where: { affiliated_by: req.user.id, status: 'approved' } });
  const withdrawals = await M.Withdrawal.findAll({ where: { user_id: req.user.id, status: { [Op.ne]: 'rejected' } } });
  const balance = referrals.reduce((s, a) => s + Number(a.amount), 0) - withdrawals.reduce((s, w) => s + Number(w.amount), 0);
  const amount = Number(req.body.amount);
  const min = Number(await settings.get('min_withdrawal_amount'));
  if (amount <= 0 || amount > balance) fail(422, 'Validation failed', { amount: `Amount must be between 1 and ${balance}` });
  if (amount < min) fail(422, 'Validation failed', { amount: `Minimum withdrawal amount is ${min}` });
  await M.Withdrawal.create({ user_id: req.user.id, amount, email: req.body.email, bank_details: req.body.bank_details });
  res.status(201).json({ message: 'Withdrawal request sent' });
}));

/* ------------------------------------------------ invoices / downloads */
r.get('/transactions/:id/invoice', wrap(async (req, res) => {
  const t = await M.Transaction.findOne({ where: { id: req.params.id, user_id: req.user.id }, include: [M.User, { model: M.Subscription, include: [{ model: M.Plan, include: [M.Currency] }] }] });
  if (!t) fail(404, 'Not found');
  res.type('application/pdf').set('Content-Disposition', `attachment; filename="invoice-${t.id}.pdf"`).send(await docs.invoicePdf(labels.transactionInvoice(t)));
}));
r.get('/nfc-orders/:id/invoice', wrap(async (req, res) => {
  const o = await M.NfcOrder.findOne({ where: { id: req.params.id, user_id: req.user.id }, include: [M.NfcCard] });
  if (!o) fail(404, 'Not found');
  res.type('application/pdf').set('Content-Disposition', `attachment; filename="${o.order_number}.pdf"`).send(await docs.invoicePdf(labels.nfcInvoice(o)));
}));
r.get('/plans/:id/pdf', wrap(async (req, res) => {
  const plan = await M.Plan.findOne({ where: { id: req.params.id, status: true }, include: [M.Currency] });
  if (!plan) fail(404, 'Not found');
  res.type('application/pdf').set('Content-Disposition', `attachment; filename="${plan.name}-plan.pdf"`).send(await docs.planPdf(plan, labels.FEATURE_LABELS));
}));
r.get('/export/:what', wrap(async (req, res) => {
  const ids = (await M.Vcard.findAll({ where: { user_id: req.user.id }, attributes: ['id', 'name'] }));
  const names = Object.fromEntries(ids.map((v) => [v.id, v.name]));
  const where = { vcard_id: ids.map((v) => v.id) };
  const fmt = (x) => dayjs(x).format('YYYY-MM-DD HH:mm');
  let title; let cols; let rows;
  if (req.params.what === 'enquiries') {
    title = 'Enquiries'; cols = [['vcard', 'vCard'], ['name', 'Name'], ['email', 'E-mail'], ['phone', 'Phone'], ['product_name', 'About'], ['message', 'Message'], ['status', 'Status'], ['tags', 'Tags'], ['notes', 'Notes'], ['date', 'Date']];
    rows = (await M.VcardEnquiry.findAll({ where, order: [['id', 'DESC']] })).map((e) => ({ ...e.toJSON(), vcard: names[e.vcard_id], tags: (e.tags || []).join(', '), status: e.status || 'new', date: fmt(e.created_at) }));
  } else if (req.params.what === 'appointments') {
    title = 'Appointments'; cols = [['vcard', 'vCard'], ['name', 'Name'], ['email', 'E-mail'], ['phone', 'Phone'], ['date', 'Date'], ['time', 'Time'], ['status', 'Status']];
    rows = (await M.Appointment.findAll({ where, raw: true, order: [['date', 'DESC']] })).map((x) => ({ ...x, vcard: names[x.vcard_id], time: `${x.from_time}-${x.to_time}` }));
  } else if (req.params.what === 'subscribers') {
    title = 'Subscribers'; cols = [['vcard', 'vCard'], ['email', 'E-mail'], ['date', 'Subscribed']];
    rows = (await M.VcardSubscriber.findAll({ where, raw: true, order: [['id', 'DESC']] })).map((x) => ({ ...x, vcard: names[x.vcard_id], date: fmt(x.created_at) }));
  } else fail(404, 'Not found');
  const out = await docs.exportRows(String(req.query.format || 'csv'), title, cols.map(([key, label]) => ({ key, label })), rows);
  res.type(out.type).set('Content-Disposition', `attachment; filename="${req.params.what}.${out.ext}"`).send(out.body);
}));

r.use(require('./selling'));
r.use(require('./content'));
r.use(require('./store'));
r.use(require('./business'));

module.exports = r;
