const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { Op, fn, col } = require('sequelize');
const dayjs = require('dayjs');
const QRCode = require('qrcode');
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
const fs = require('fs');

const r = express.Router();
r.use(requireRole('user'), companyWorkspace);
const org = require('../../services/organisation');
// organisation members whose organisation locked card management
const cardsUnlocked = (req, _res, next) => (org.isLocked(req.user, 'manage_cards') ? next(new HttpError(403, 'Your organisation manages your cards. Please contact your organisation administrator.')) : next());
const { trackStorage, removeOwned } = require('./helpers');

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
  res.json({ data: all.map((t) => ({ ...t.toJSON(), allowed: allowed.includes(t.id) })), features: sub?.plan?.features || {} });
}));

r.get('/vcards/check-alias', wrap(async (req, res) => {
  const alias = String(req.query.alias || '').toLowerCase();
  const taken = RESERVED.has(alias) || !!(await M.Vcard.findOne({ where: { url_alias: alias, id: { [Op.ne]: req.query.id || 0 } } }));
  res.json({ available: !taken && /^[a-z0-9][a-z0-9-_]{1,79}$/.test(alias) });
}));

r.post('/vcards', cardsUnlocked, wrap(async (req, res) => {
  validate(req.body, { name: 'required|max:120', url_alias: 'required|alias', template_id: 'required' });
  const check = await subs.canCreateVcard(req.user.id);
  if (!check.ok) fail(422, check.reason);
  const alias = String(req.body.url_alias).toLowerCase();
  if (RESERVED.has(alias) || (await M.Vcard.findOne({ where: { url_alias: alias } }))) fail(422, 'Validation failed', { url_alias: 'This URL alias is already taken' });
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

const vcardUpload = makeUpload('vcards', { maxMb: 5 }).fields([{ name: 'profile_image', maxCount: 1 }, { name: 'cover_image', maxCount: 1 }]);
const videoUpload = makeUpload('vcards', { types: { 'video/mp4': '.mp4', 'video/webm': '.webm' }, maxMb: 25 }).single('video');
const VCARD_FIELDS = ['name', 'occupation', 'description', 'first_name', 'last_name', 'email', 'region_code', 'phone', 'alternative_email', 'alternative_phone',
  'location', 'location_url', 'company', 'job_title', 'dob', 'site_title', 'meta_keyword', 'meta_description', 'google_analytics', 'default_language', 'custom_css', 'custom_code', 'custom_code_enabled'];
const JSON_FIELDS = ['theme', 'social_links', 'custom_links', 'business_hours', 'sections', 'iframes', 'payment_links', 'qr_settings', 'appointment_settings'];
const sanitizeHtml = require('sanitize-html');
const legalHtml = (h) => sanitizeHtml(String(h || ''), { allowedTags: sanitizeHtml.defaults.allowedTags.concat(['h1', 'h2', 'u', 's']), allowedSchemes: ['http', 'https', 'mailto', 'tel'] });
const hhmm = (t) => (/^\d{2}:\d{2}$/.test(String(t)) ? t : null);
const safeUrl = (u) => (!u || /^(https?:|mailto:|tel:)/i.test(String(u).trim()) ? u : `https://${u}`);

r.put('/vcards/:id', vcardUpload, trackStorage, wrap(async (req, res) => {
  const v = await ownVcard(req);
  const b = { ...req.body };
  org.stripCardLocks(req.user, b, req.files); // fields locked by the member's organisation stay as they are
  for (const k of JSON_FIELDS) if (typeof b[k] === 'string') { try { b[k] = JSON.parse(b[k]); } catch { delete b[k]; } }
  validate({ ...v.toJSON(), ...b }, { name: 'required|max:120', url_alias: 'required|alias', email: 'email', location_url: 'url' });
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

  if (b.url_alias && b.url_alias.toLowerCase() !== v.url_alias) {
    const alias = b.url_alias.toLowerCase();
    if (RESERVED.has(alias) || (await M.Vcard.findOne({ where: { url_alias: alias } }))) fail(422, 'Validation failed', { url_alias: 'This URL alias is already taken' });
    data.url_alias = alias;
  }
  if (b.template_id && Number(b.template_id) !== v.template_id) {
    const allowed = sub?.plan?.templates?.map((t) => t.id) || [];
    if (!allowed.includes(Number(b.template_id))) fail(422, 'Validation failed', { template_id: 'This template is not included in your plan' });
    data.template_id = Number(b.template_id);
  }
  if (b.theme) {
    const t = pick(b.theme, ['primary', 'secondary', 'background', 'text', 'font']);
    for (const k of ['primary', 'secondary', 'background', 'text']) if (t[k] && !/^#[0-9a-f]{6}$/i.test(t[k])) delete t[k];
    if (t.font && !/^[\w\s',-]{1,80}$/.test(t.font)) delete t.font;
    data.theme = { ...(v.theme || {}), ...t };
  }
  if (b.social_links) data.social_links = Object.fromEntries(Object.entries(b.social_links).filter(([, u]) => u).map(([k, u]) => [k, safeUrl(String(u).slice(0, 500))]));
  if (b.custom_links && features.custom_links) data.custom_links = (Array.isArray(b.custom_links) ? b.custom_links : []).slice(0, 20).map((l) => ({ label: String(l.label || '').slice(0, 80), url: safeUrl(String(l.url || '').slice(0, 500)) })).filter((l) => l.label && l.url);
  if (b.business_hours) data.business_hours = b.business_hours;
  if (b.sections) data.sections = Object.fromEntries(Object.entries(b.sections).map(([k, val]) => [k, toBool(val)]));
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
  if (b.payment_links !== undefined && features.payment_links) data.payment_links = (Array.isArray(b.payment_links) ? b.payment_links : []).slice(0, 10).map((l) => ({ label: String(l.label || '').slice(0, 80), url: safeUrl(String(l.url || '').slice(0, 500)), type: String(l.type || 'link').slice(0, 20) })).filter((l) => l.label && l.url);
  if (b.terms_conditions !== undefined) data.terms_conditions = legalHtml(b.terms_conditions) || null;
  if (b.privacy_policy !== undefined) data.privacy_policy = legalHtml(b.privacy_policy) || null;
  for (const k of ['sticky_bar', 'ask_before_contact', 'enquiry_attachment']) if (b[k] !== undefined) data[k] = toBool(b[k]);
  if (b.newsletter_popup !== undefined) data.newsletter_popup = features.newsletter ? toBool(b.newsletter_popup) : false;
  if (b.pwa_enable !== undefined) data.pwa_enable = features.pwa ? toBool(b.pwa_enable) : false;
  if (b.business_directory !== undefined) data.business_directory = features.business_directory ? toBool(b.business_directory) : false;
  if (b.week_format !== undefined) data.week_format = b.week_format === 'sun' ? 'sun' : 'mon';
  if (b.qr_settings) {
    const q = pick(b.qr_settings, ['fg', 'bg', 'size', 'margin', 'ec']);
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

r.get('/vcards/:id/qrcode', wrap(async (req, res) => {
  const v = await ownVcard(req);
  const q = v.qr_settings || {};
  const opts = { width: Number(req.query.size) || q.size || 600, margin: q.margin ?? 2, errorCorrectionLevel: q.ec || 'M', color: { dark: q.fg || v.theme?.primary || '#000000', light: q.bg || '#ffffff' } };
  // QR codes point at the vCard's dynamic short link (destination can change later); ?direct=1 encodes the vCard URL itself
  const target = req.query.direct === '1' ? `${appUrl}/${v.url_alias}` : require('../../services/shortlinks').shortUrl((await require('../../services/shortlinks').forVcard(v)).code);
  if (req.query.format === 'svg') {
    return res.set('Content-Type', 'image/svg+xml').set('Content-Disposition', `attachment; filename="${v.url_alias}-qr.svg"`).send(await QRCode.toString(target, { ...opts, type: 'svg' }));
  }
  const png = await QRCode.toBuffer(target, opts);
  res.set('Content-Type', 'image/png').set('Content-Disposition', `attachment; filename="${v.url_alias}-qr.png"`).send(png);
}));

r.post('/vcards/:id/cover-video', videoUpload, trackStorage, wrap(async (req, res) => {
  const v = await ownVcard(req);
  if (!req.file) fail(422, 'Validation failed', { video: 'Choose an MP4 or WebM video' });
  removeOwned(req, v.cover_video);
  await v.update({ cover_video: fileUrl('vcards', req.file), cover_type: 'video' });
  res.json({ data: v.toJSON(), message: 'Cover video uploaded' });
}));

/* per-vCard analytics */
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
    await item.destroy();
    res.json({ message: 'Deleted' });
  }));
}

r.get('/enquiries', wrap(async (req, res) => {
  const p = paginate(req);
  const ids = (await M.Vcard.findAll({ where: { user_id: req.user.id }, attributes: ['id'] })).map((v) => v.id);
  const { rows, count } = await M.VcardEnquiry.findAndCountAll({ where: { vcard_id: ids }, include: [{ model: M.Vcard, attributes: ['id', 'name'] }], order: [['id', 'DESC']], limit: p.limit, offset: p.offset });
  res.json(paged(rows, count, p));
}));
r.delete('/enquiries/:id', wrap(async (req, res) => {
  const e = await M.VcardEnquiry.findByPk(req.params.id, { include: [M.Vcard] });
  if (!e || e.vcard.user_id !== req.user.id) fail(404, 'Not found');
  await e.destroy();
  res.json({ message: 'Deleted' });
}));

/* =========================================================== subscription */
r.get('/plans', wrap(async (req, res) => {
  const plans = await M.Plan.findAll({ where: { status: true }, include: [M.Currency, { model: M.Template, attributes: ['id', 'name'] }], order: [['price', 'ASC']] });
  const s = await settings.publicSettings();
  const gateways = [...payments.NAMES, 'manual_payment'].filter((g) => s[`${g}_enable`] === '1').map((g) => g.replace('_payment', ''));
  res.json({ data: plans, current: await subs.current(req.user.id), gateways, manual_payment_guide: s.manual_payment_guide, features: M.PLAN_FEATURES });
}));

r.post('/coupon/check', wrap(async (req, res) => {
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
  validate(req.body, { nfc_card_id: 'required', vcard_id: 'required', name: 'required|max:120', email: 'required|email', phone: 'required|max:30', address: 'required|max:1000', quantity: 'required|numeric', payment_type: `required|in:manual,${payments.NAMES.join(',')}` });
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
  validate(req.body, { amount: 'required|numeric', email: 'required|email', bank_details: 'required|max:2000' });
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
    title = 'Enquiries'; cols = [['vcard', 'vCard'], ['name', 'Name'], ['email', 'E-mail'], ['phone', 'Phone'], ['product_name', 'About'], ['message', 'Message'], ['date', 'Date']];
    rows = (await M.VcardEnquiry.findAll({ where, raw: true, order: [['id', 'DESC']] })).map((x) => ({ ...x, vcard: names[x.vcard_id], date: fmt(x.created_at) }));
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

r.use(require('./content'));
r.use(require('./store'));
r.use(require('./business'));

module.exports = r;
