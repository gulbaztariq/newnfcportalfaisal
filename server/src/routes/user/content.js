/* User panel: vCard products, appointments, blog, custom pages, newsletter subscribers, AI tools, organisation */
const express = require('express');
const bcrypt = require('bcryptjs');
const { Op } = require('sequelize');
const sanitizeHtml = require('sanitize-html');
const M = require('../../models');
const { wrap, fail, validate, pick, toBool, paginate, paged } = require('../../utils/http');
const { makeUpload, fileUrl, removeFile } = require('../../middleware/upload');
const { trackStorage, removeOwned, ownVcardOf, featuresOf, requireFeature } = require('./helpers');
const mail = require('../../services/mail');
const ai = require('../../services/ai');
const subs = require('../../services/subscription');
const perms = require('../../services/permissions');
const org = require('../../services/organisation');
const COMPANY_STAFF = ['manager', 'supervisor', 'member'];
const listOf = (v) => { if (Array.isArray(v)) return v; try { return JSON.parse(v); } catch { return []; } };

const r = express.Router();
const richText = (h) => sanitizeHtml(String(h || ''), {
  allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img', 'h1', 'h2', 'u', 's']),
  allowedAttributes: { ...sanitizeHtml.defaults.allowedAttributes, img: ['src', 'alt'] }, allowedSchemes: ['http', 'https', 'mailto', 'tel'],
});
const slugify = (t) => String(t || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 140) || `item-${Date.now()}`;
async function uniqueSlug(Model, vcardId, base, id = 0) {
  let slug = base; let i = 1;
  while (await Model.findOne({ where: { vcard_id: vcardId, slug, id: { [Op.ne]: id } } })) slug = `${base}-${++i}`;
  return slug;
}

/* ============================================================ products */
const productUpload = makeUpload('products', { maxMb: 5 }).array('images', 6);
r.get('/vcards/:id/products', wrap(async (req, res) => {
  const v = await ownVcardOf(req, req.params.id);
  res.json({ data: await M.VcardProduct.findAll({ where: { vcard_id: v.id }, order: [['sort', 'ASC'], ['id', 'ASC']] }) });
}));
const productData = (b) => {
  const d = pick(b, ['name', 'description', 'price', 'currency_code', 'product_url', 'sort']);
  d.price = d.price === '' || d.price === undefined ? null : Number(d.price);
  d.sort = Number(d.sort || 0);
  d.in_stock = b.in_stock === undefined ? true : toBool(b.in_stock);
  if (d.product_url && !/^https?:\/\//i.test(d.product_url)) d.product_url = `https://${d.product_url}`;
  return d;
};
r.post('/vcards/:id/products', productUpload, trackStorage, wrap(async (req, res) => {
  await requireFeature(req, 'products', 'Products');
  const v = await ownVcardOf(req, req.params.id);
  validate(req.body, { name: 'required|max:150', price: 'numeric', product_url: 'max:500' });
  if ((await M.VcardProduct.count({ where: { vcard_id: v.id } })) >= 100) fail(422, 'Limit reached (100 products)');
  const item = await M.VcardProduct.create({ ...productData(req.body), vcard_id: v.id, images: (req.files || []).map((f) => fileUrl('products', f)) });
  res.status(201).json({ data: item, message: 'Product added' });
}));
r.put('/vcards/:id/products/:pid', productUpload, trackStorage, wrap(async (req, res) => {
  const v = await ownVcardOf(req, req.params.id);
  const item = await M.VcardProduct.findOne({ where: { id: req.params.pid, vcard_id: v.id } });
  if (!item) fail(404, 'Not found');
  validate({ ...item.toJSON(), ...req.body }, { name: 'required|max:150', price: 'numeric' });
  let keep = item.images || [];
  if (req.body.keep_images !== undefined) {
    let k = []; try { k = JSON.parse(req.body.keep_images); } catch { k = []; }
    for (const url of keep) if (!k.includes(url)) removeOwned(req, url);
    keep = keep.filter((u) => k.includes(u));
  }
  await item.update({ ...productData(req.body), images: [...keep, ...(req.files || []).map((f) => fileUrl('products', f))].slice(0, 6) });
  res.json({ data: item, message: 'Product updated' });
}));
r.delete('/vcards/:id/products/:pid', wrap(async (req, res) => {
  const v = await ownVcardOf(req, req.params.id);
  const item = await M.VcardProduct.findOne({ where: { id: req.params.pid, vcard_id: v.id } });
  if (!item) fail(404, 'Not found');
  for (const u of item.images || []) removeOwned(req, u);
  await item.destroy();
  res.json({ message: 'Product deleted' });
}));

/* ========================================================= appointments */
const myVcardIds = async (req) => (await M.Vcard.findAll({ where: { user_id: req.user.id }, attributes: ['id'] })).map((v) => v.id);
r.get('/appointments', wrap(async (req, res) => {
  const p = paginate(req);
  const where = { vcard_id: await myVcardIds(req) };
  if (req.query.status) where.status = req.query.status;
  if (req.query.vcard_id) where.vcard_id = Number(req.query.vcard_id);
  if (req.query.from) where.date = { [Op.gte]: req.query.from };
  const { rows, count } = await M.Appointment.findAndCountAll({ where, include: [{ model: M.Vcard, attributes: ['id', 'name', 'url_alias'] }], order: [['date', 'DESC'], ['from_time', 'DESC']], limit: p.limit, offset: p.offset });
  res.json(paged(rows, count, p));
}));
r.get('/appointments/calendar', wrap(async (req, res) => {
  const where = { vcard_id: await myVcardIds(req), status: { [Op.ne]: 'cancelled' } };
  if (req.query.month) where.date = { [Op.like]: `${String(req.query.month).slice(0, 7)}%` };
  res.json({ data: await M.Appointment.findAll({ where, attributes: ['id', 'name', 'date', 'from_time', 'to_time', 'status', 'service_name'], include: [{ model: M.Vcard, attributes: ['name'] }], order: [['date', 'ASC'], ['from_time', 'ASC']] }) });
}));
r.patch('/appointments/:aid', wrap(async (req, res) => {
  validate(req.body, { status: 'in:pending,confirmed,completed,cancelled' });
  const a = await M.Appointment.findOne({ where: { id: req.params.aid, vcard_id: await myVcardIds(req) }, include: [M.Vcard] });
  if (!a) fail(404, 'Not found');
  const data = {};
  if (req.body.status) data.status = req.body.status;
  if (req.body.paid !== undefined) data.paid = toBool(req.body.paid);
  await a.update(data);
  if (data.status && a.email && data.status !== 'pending') {
    mail.sendTemplate('appointment_status', a.email, { customer: a.name, date: a.date, time: `${a.from_time} - ${a.to_time}`, vcard: a.vcard?.name, status: data.status }).catch(() => {});
  }
  res.json({ message: 'Appointment updated' });
}));
r.delete('/appointments/:aid', wrap(async (req, res) => {
  const a = await M.Appointment.findOne({ where: { id: req.params.aid, vcard_id: await myVcardIds(req) } });
  if (!a) fail(404, 'Not found');
  await a.destroy();
  res.json({ message: 'Appointment deleted' });
}));

/* ============================================================== blog */
const blogUpload = makeUpload('blogs', { maxMb: 5 }).single('image');
r.get('/vcards/:id/blogs', wrap(async (req, res) => {
  const v = await ownVcardOf(req, req.params.id);
  res.json({ data: await M.VcardBlog.findAll({ where: { vcard_id: v.id }, order: [['id', 'DESC']] }) });
}));
r.post('/vcards/:id/blogs', blogUpload, trackStorage, wrap(async (req, res) => {
  await requireFeature(req, 'blog', 'Blog');
  const v = await ownVcardOf(req, req.params.id);
  validate(req.body, { title: 'required|max:200', description: 'required' });
  const item = await M.VcardBlog.create({ vcard_id: v.id, title: req.body.title, slug: await uniqueSlug(M.VcardBlog, v.id, slugify(req.body.slug || req.body.title)), description: richText(req.body.description), status: req.body.status === undefined ? true : toBool(req.body.status), image: fileUrl('blogs', req.file) });
  res.status(201).json({ data: item, message: 'Post published' });
}));
r.put('/vcards/:id/blogs/:bid', blogUpload, trackStorage, wrap(async (req, res) => {
  const v = await ownVcardOf(req, req.params.id);
  const item = await M.VcardBlog.findOne({ where: { id: req.params.bid, vcard_id: v.id } });
  if (!item) fail(404, 'Not found');
  validate({ ...item.toJSON(), ...req.body }, { title: 'required|max:200' });
  const data = { title: req.body.title ?? item.title, status: req.body.status === undefined ? item.status : toBool(req.body.status) };
  if (req.body.description !== undefined) data.description = richText(req.body.description);
  if (req.body.slug !== undefined || req.body.title !== undefined) data.slug = await uniqueSlug(M.VcardBlog, v.id, slugify(req.body.slug || data.title), item.id);
  if (req.file) { removeOwned(req, item.image); data.image = fileUrl('blogs', req.file); }
  await item.update(data);
  res.json({ data: item, message: 'Post updated' });
}));
r.delete('/vcards/:id/blogs/:bid', wrap(async (req, res) => {
  const v = await ownVcardOf(req, req.params.id);
  const item = await M.VcardBlog.findOne({ where: { id: req.params.bid, vcard_id: v.id } });
  if (!item) fail(404, 'Not found');
  removeOwned(req, item.image);
  await item.destroy();
  res.json({ message: 'Post deleted' });
}));

/* ======================================================== custom pages */
r.get('/vcards/:id/pages', wrap(async (req, res) => {
  const v = await ownVcardOf(req, req.params.id);
  res.json({ data: await M.VcardPage.findAll({ where: { vcard_id: v.id }, order: [['id', 'ASC']] }) });
}));
r.post('/vcards/:id/pages', wrap(async (req, res) => {
  await requireFeature(req, 'custom_pages', 'Custom pages');
  const v = await ownVcardOf(req, req.params.id);
  validate(req.body, { title: 'required|max:150', content: 'required' });
  if ((await M.VcardPage.count({ where: { vcard_id: v.id } })) >= 10) fail(422, 'Limit reached (10 pages)');
  const item = await M.VcardPage.create({ vcard_id: v.id, title: req.body.title, slug: await uniqueSlug(M.VcardPage, v.id, slugify(req.body.slug || req.body.title)), content: richText(req.body.content), status: req.body.status === undefined ? true : toBool(req.body.status) });
  res.status(201).json({ data: item, message: 'Page created' });
}));
r.put('/vcards/:id/pages/:pid', wrap(async (req, res) => {
  const v = await ownVcardOf(req, req.params.id);
  const item = await M.VcardPage.findOne({ where: { id: req.params.pid, vcard_id: v.id } });
  if (!item) fail(404, 'Not found');
  validate({ ...item.toJSON(), ...req.body }, { title: 'required|max:150' });
  const data = { title: req.body.title ?? item.title, status: req.body.status === undefined ? item.status : toBool(req.body.status) };
  if (req.body.content !== undefined) data.content = richText(req.body.content);
  data.slug = await uniqueSlug(M.VcardPage, v.id, slugify(req.body.slug || data.title), item.id);
  await item.update(data);
  res.json({ data: item, message: 'Page updated' });
}));
r.delete('/vcards/:id/pages/:pid', wrap(async (req, res) => {
  const v = await ownVcardOf(req, req.params.id);
  const n = await M.VcardPage.destroy({ where: { id: req.params.pid, vcard_id: v.id } });
  if (!n) fail(404, 'Not found');
  res.json({ message: 'Page deleted' });
}));

/* ============================================ newsletter subscribers */
r.get('/subscribers', wrap(async (req, res) => {
  const p = paginate(req);
  const { rows, count } = await M.VcardSubscriber.findAndCountAll({ where: { vcard_id: await myVcardIds(req) }, include: [{ model: M.Vcard, attributes: ['id', 'name'] }], order: [['id', 'DESC']], limit: p.limit, offset: p.offset });
  res.json(paged(rows, count, p));
}));
r.delete('/subscribers/:sid', wrap(async (req, res) => {
  const n = await M.VcardSubscriber.destroy({ where: { id: req.params.sid, vcard_id: await myVcardIds(req) } });
  if (!n) fail(404, 'Not found');
  res.json({ message: 'Subscriber removed' });
}));

/* =============================================================== AI */
r.post('/ai/vcard-draft', wrap(async (req, res) => {
  await requireFeature(req, 'ai_tools', 'AI tools');
  validate(req.body, { profession: 'required|max:120', name: 'max:120', company: 'max:150', brief: 'max:1500', language: 'max:40' });
  const draft = await ai.vcardDraft(pick(req.body, ['name', 'profession', 'company', 'brief', 'language']));
  for (const k of ['primary', 'secondary', 'background', 'text']) if (!/^#[0-9a-f]{6}$/i.test(draft.theme?.[k] || '')) delete draft.theme[k];
  res.json({ data: draft });
}));
r.post('/ai/describe', wrap(async (req, res) => {
  await requireFeature(req, 'ai_tools', 'AI tools');
  validate(req.body, { title: 'required|max:150', kind: 'in:vcard,service,product,store product,store,blog post', details: 'max:1500', tone: 'max:40', language: 'max:40' });
  res.json({ description: await ai.describe(pick(req.body, ['title', 'kind', 'details', 'tone', 'language'])) });
}));

/* ======================================================= organisation */
// The owner manages everything; company managers with the "members" permission work here through companyWorkspace
// (req.user = owner, req.actor = the manager). Managers cannot change themselves, other managers or the company profile.
async function orgOwner(req) {
  if (!req.user.is_organisation) fail(403, 'Only organisation accounts can manage members');
  return req.user;
}
async function memberOf(req, { secrets = false } = {}) {
  const owner = await orgOwner(req);
  const m = await (secrets ? M.User.scope('withSecrets') : M.User).findOne({ where: { id: req.params.mid, organisation_id: owner.id } });
  if (!m) fail(404, 'Member not found');
  if (req.actor && m.id === req.actor.id) fail(403, 'You cannot change your own account here');
  if (req.actor && m.company_role === 'manager') fail(403, 'Only the organisation owner can change managers');
  return m;
}
const orgUpload = makeUpload('organisations', { maxMb: 2 }).single('logo');
const memberPhotoUpload = makeUpload('vcards', { maxMb: 4 }).single('profile_image');
const websiteOf = (u) => { const w = String(u || '').trim(); return !w ? null : /^https?:\/\//i.test(w) ? w.slice(0, 255) : `https://${w}`.slice(0, 255); };
const memberJson = (m, byUser = {}) => ({ ...m.toJSON(), company_role: m.company_role || 'member', org_status: m.org_status || 'active', locked_fields: org.lockedOf(m), effective_permissions: perms.permissionsOf(m), vcards_count: byUser[m.id] || 0 });

r.get('/organisation', wrap(async (req, res) => {
  const owner = await orgOwner(req);
  const [profile, limit, used] = await Promise.all([org.profileOf(owner), org.seatLimit(owner), org.seatsUsed(owner)]);
  res.json({ data: profile, seats: { limit, used }, is_owner: !req.actor, lockable: org.LOCKABLE });
}));
r.put('/organisation', orgUpload, wrap(async (req, res) => {
  const owner = await orgOwner(req);
  if (req.actor) fail(403, 'Only the organisation owner can change the company profile');
  validate(req.body, { name: 'required|max:150', email: 'email', phone: 'max:40', address: 'max:500', city: 'max:120', country: 'max:120' });
  const data = { ...pick(req.body, ['name', 'email', 'phone', 'address', 'city', 'country']), website: websiteOf(req.body.website) };
  for (const [k, v] of Object.entries(data)) if (v === '') data[k] = null;
  let row = await M.Organisation.findOne({ where: { owner_id: owner.id } });
  if (req.file) { if (row?.logo) removeFile(row.logo); data.logo = fileUrl('organisations', req.file); }
  if (req.body.remove_logo === '1' && row?.logo) { removeFile(row.logo); data.logo = null; }
  row = row ? await row.update(data) : await M.Organisation.create({ ...data, owner_id: owner.id });
  org.logEvent(owner.id, req.user, 'profile_updated', 'Updated the company profile', { fields: Object.keys(data) });
  res.json({ data: row, message: 'Company profile saved' });
}));
r.post('/organisation/enable', wrap(async (req, res) => {
  await requireFeature(req, 'organisation', 'Organisation accounts');
  if (req.user.organisation_id) fail(422, 'Members of an organisation cannot create their own organisation');
  await req.user.update({ is_organisation: true, company_role: 'owner' });
  if (!(await M.Organisation.findOne({ where: { owner_id: req.user.id } }))) await M.Organisation.create({ owner_id: req.user.id, name: req.user.fullName() });
  org.logEvent(req.user.id, req.user, 'organisation_created', `${req.user.fullName()} turned their account into an organisation`);
  res.json({ message: 'Organisation enabled. You can now add team members.' });
}));

r.get('/organisation/members', wrap(async (req, res) => {
  const owner = await orgOwner(req);
  const members = await M.User.findAll({ where: { organisation_id: owner.id }, order: [['id', 'DESC']] });
  const counts = await M.Vcard.count({ where: { user_id: members.map((m) => m.id) }, group: ['user_id'] });
  const byUser = Object.fromEntries(counts.map((c) => [c.user_id, c.count]));
  res.json({ data: members.map((m) => memberJson(m, byUser)), limit: await org.seatLimit(owner), modules: perms.COMPANY_MODULES, defaults: { manager: perms.DEFAULTS.company_manager, supervisor: perms.DEFAULTS.company_supervisor }, lockable: org.LOCKABLE, is_owner: !req.actor });
}));
r.post('/organisation/members', wrap(async (req, res) => {
  const owner = await orgOwner(req);
  validate(req.body, { first_name: 'required|max:100', last_name: 'max:100', email: 'required|email', password: 'min:8|max:100', contact: 'max:30', job_title: 'max:150' });
  if (req.actor && req.body.company_role === 'manager') fail(403, 'Only the organisation owner can add managers');
  const limit = await org.seatLimit(owner);
  if ((await org.seatsUsed(owner)) >= limit) fail(422, `Your organisation allows ${limit} user(s). Contact the administrator for more seats.`);
  const email = String(req.body.email).toLowerCase().trim();
  if (await M.User.findOne({ where: { email } })) fail(422, 'Validation failed', { email: 'This e-mail is already registered' });
  const { member, password } = await org.createMember(owner, {
    ...pick(req.body, ['first_name', 'last_name', 'contact', 'region_code', 'job_title', 'password']), email,
    company_role: COMPANY_STAFF.includes(req.body.company_role) ? req.body.company_role : 'member',
    permissions: req.body.permissions !== undefined ? listOf(req.body.permissions) : undefined,
  }, { notify: req.body.notify === undefined ? true : toBool(req.body.notify) });
  org.logEvent(owner.id, req.actor || req.user, 'member_added', `Added ${member.fullName()} as ${member.company_role}`, { member_id: member.id });
  // the password goes back to the manager once (they keep the members' logins); it is never stored in plain text
  res.status(201).json({ data: memberJson(member), password, message: 'User added' });
}));
r.post('/organisation/members/import', wrap(async (req, res) => {
  const owner = await orgOwner(req);
  const csv = String(req.body.csv || '');
  if (!csv.trim()) fail(422, 'Choose a CSV file');
  if (csv.length > 900 * 1024) fail(422, 'The file is too large (max 900 KB, about 10,000 rows)');
  const role = ['member', 'supervisor'].includes(req.body.default_role) || (!req.actor && req.body.default_role === 'manager') ? req.body.default_role : 'member';
  const result = await org.importMembers(owner, csv, { notify: req.body.notify === undefined ? true : toBool(req.body.notify), defaultRole: role });
  // managers cannot create other managers, even from a file
  if (req.actor) for (const c of result.created.filter((x) => x.role === 'manager')) { await M.User.update({ company_role: 'member' }, { where: { id: c.id } }); c.role = 'member'; }
  if (result.created.length) org.logEvent(owner.id, req.actor || req.user, 'members_imported', `Imported ${result.created.length} user(s) from a CSV file: ${result.created.slice(0, 5).map((c) => c.name).join(', ')}${result.created.length > 5 ? '...' : ''}`, { member_ids: result.created.map((c) => c.id) });
  res.json({ ...result, message: `${result.created.length} user(s) imported${result.errors.length ? `, ${result.errors.length} row(s) skipped` : ''}` });
}));
r.patch('/organisation/members/:mid', wrap(async (req, res) => {
  const m = await memberOf(req, { secrets: true });
  const data = {};
  const bump = () => { data.token_version = (m.token_version || 0) + 1; };
  const notes = [];
  if (req.body.is_active !== undefined) {
    data.is_active = toBool(req.body.is_active);
    if (!data.is_active) bump();
  }
  if (req.body.org_status !== undefined) {
    if (!org.ORG_STATUSES.includes(req.body.org_status)) fail(422, 'Unknown status');
    data.org_status = req.body.org_status;
    if (data.org_status !== 'active') bump(); // signs the member out everywhere
    notes.push({ active: 'Account unlocked', locked: 'Account locked', blocked: 'Account and cards blocked' }[data.org_status]);
  }
  if (req.body.company_role !== undefined) {
    if (!COMPANY_STAFF.includes(req.body.company_role)) fail(422, 'Unknown role');
    if (req.actor && req.body.company_role === 'manager') fail(403, 'Only the organisation owner can make someone a manager');
    data.company_role = req.body.company_role;
    bump();
  }
  if (req.body.permissions !== undefined) data.permissions = perms.clean(listOf(req.body.permissions), true);
  if (req.body.locked_fields !== undefined) data.locked_fields = org.cleanLocks(listOf(req.body.locked_fields));
  let password;
  if (req.body.password !== undefined) {
    password = String(req.body.password || '') || org.randomPassword();
    if (password.length < 8 || password.length > 100) fail(422, 'Validation failed', { password: 'Use 8 to 100 characters' });
    data.password = await bcrypt.hash(password, 12);
    bump();
    notes.push('Password reset');
  }
  await m.update(data);
  if (password && toBool(req.body.notify)) org.credentialsMail(m, password);
  // journey
  const who = m.fullName(); const actor = req.actor || req.user; const ev = (type, msg) => org.logEvent(m.organisation_id, actor, type, msg, { member_id: m.id });
  if (data.org_status) ev(`member_${data.org_status === 'active' ? 'unlocked' : data.org_status}`, `${{ active: 'Unlocked', locked: 'Locked', blocked: 'Blocked (account and cards)' }[data.org_status]} ${who}`);
  if (data.is_active !== undefined) ev(data.is_active ? 'member_activated' : 'member_deactivated', `${data.is_active ? 'Activated' : 'Deactivated'} ${who}`);
  if (data.company_role) ev('role_changed', `Gave ${who} the ${data.company_role} role`);
  else if (data.permissions) ev('permissions_changed', `Changed ${who}'s access (${data.permissions.filter((k) => k.endsWith('.manage')).length} module(s) with manage rights)`);
  if (data.locked_fields) ev('locks_changed', `Locked ${data.locked_fields.length} field(s) for ${who}`);
  if (password) ev('password_reset', `Reset ${who}'s password`);
  res.json({ data: memberJson(m), password, message: notes.join(' · ') || 'User updated' });
}));
/* one member's account + card details, with the per-field locks */
r.get('/organisation/members/:mid/details', wrap(async (req, res) => {
  const m = await memberOf(req);
  const vcards = await M.Vcard.findAll({ where: { user_id: m.id }, attributes: ['id', 'url_alias', 'profile_image', ...org.CARD_FIELDS], order: [['id', 'ASC']] });
  res.json({ data: memberJson(m), vcards, lockable: org.LOCKABLE });
}));
r.put('/organisation/members/:mid/details', memberPhotoUpload, wrap(async (req, res) => {
  const m = await memberOf(req);
  validate(req.body, { first_name: 'required|max:100', last_name: 'max:100', email: 'required|email', contact: 'max:30' });
  const email = String(req.body.email).toLowerCase().trim();
  if (email !== m.email && (await M.User.findOne({ where: { email } }))) fail(422, 'Validation failed', { email: 'This e-mail is already registered' });
  const account = { ...pick(req.body, ['first_name', 'last_name', 'contact', 'region_code']), email };
  if (req.body.locked_fields !== undefined) account.locked_fields = org.cleanLocks(listOf(req.body.locked_fields));
  if (req.body.vcard_id) {
    const card = await M.Vcard.findOne({ where: { id: req.body.vcard_id, user_id: m.id } });
    if (!card) fail(404, 'Card not found');
    let c = req.body.card || {};
    if (typeof c === 'string') { try { c = JSON.parse(c); } catch { c = {}; } }
    validate({ ...card.toJSON(), ...c }, { name: 'required|max:120', email: 'email', location_url: 'url' });
    const data = pick(c, org.CARD_FIELDS);
    for (const [k, v] of Object.entries(data)) data[k] = v === '' || v === null ? null : String(v).slice(0, k === 'description' ? 5000 : 500);
    if (data.name === null) delete data.name;
    if (req.file) { removeOwned(req, card.profile_image); data.profile_image = fileUrl('vcards', req.file); }
    await card.update(data);
  }
  await m.update(account);
  org.logEvent(m.organisation_id, req.actor || req.user, 'details_updated', `Edited ${m.fullName()}'s details${account.locked_fields ? ` (${account.locked_fields.length} field(s) locked)` : ''}`, { member_id: m.id });
  res.json({ data: memberJson(m), message: 'Details saved' });
}));
r.delete('/organisation/members/:mid', wrap(async (req, res) => {
  const m = await memberOf(req);
  await M.Vcard.destroy({ where: { user_id: m.id } });
  await m.destroy();
  org.logEvent(m.organisation_id, req.actor || req.user, 'member_removed', `Removed ${m.fullName()} (${m.email})`, { member_id: m.id });
  res.json({ message: 'User removed' });
}));
r.get('/organisation/vcards', wrap(async (req, res) => {
  const owner = await orgOwner(req);
  const members = await M.User.findAll({ where: { organisation_id: owner.id }, attributes: ['id', 'first_name', 'last_name', 'email'] });
  const rows = await M.Vcard.findAll({ where: { user_id: members.map((m) => m.id) }, attributes: ['id', 'name', 'url_alias', 'views', 'status', 'user_id'], include: [{ model: M.User, attributes: ['id', 'first_name', 'last_name', 'org_status'] }] });
  res.json({ data: rows });
}));

/* announcements to every member (in the portal + by e-mail) */
r.get('/organisation/announcements', wrap(async (req, res) => {
  const owner = await orgOwner(req);
  const rows = await M.Announcement.findAll({ where: { audience: 'organisation', organisation_id: owner.id }, order: [['id', 'DESC']], limit: 100, include: [{ model: M.User, as: 'creator', attributes: ['id', 'first_name', 'last_name'] }] });
  const reads = rows.length ? await M.AnnouncementRead.count({ where: { announcement_id: rows.map((a) => a.id) }, group: ['announcement_id'] }) : [];
  const byId = Object.fromEntries(reads.map((x) => [x.announcement_id, x.count]));
  res.json({ data: rows.map((a) => ({ ...a.toJSON(), reads: byId[a.id] || 0 })), members: await org.seatsUsed(owner) });
}));
r.post('/organisation/announcements', wrap(async (req, res) => {
  const owner = await orgOwner(req);
  validate(req.body, { title: 'required|max:200', body: 'required' });
  const body = richText(req.body.body);
  if (!body.replace(/<[^>]*>/g, '').trim()) fail(422, 'Validation failed', { body: 'Write a message' });
  const { announcement, recipients } = await org.announce(owner, req.actor || req.user, { title: String(req.body.title).trim(), body, type: req.body.type });
  org.logEvent(owner.id, req.actor || req.user, 'announcement_sent', `Sent the announcement "${announcement.title}" to ${recipients} user(s)`, { announcement_id: announcement.id });
  res.status(201).json({ data: announcement, message: `Announcement sent to ${recipients} user(s)` });
}));
r.delete('/organisation/announcements/:aid', wrap(async (req, res) => {
  const owner = await orgOwner(req);
  const n = await M.Announcement.destroy({ where: { id: req.params.aid, audience: 'organisation', organisation_id: owner.id } });
  if (!n) fail(404, 'Not found');
  res.json({ message: 'Announcement deleted' });
}));

r.get('/features', wrap(async (req, res) => { await featuresOf(req); res.json({ features: req._features, plan: req._sub?.plan || null, storage_used: Number(req.user.storage_used || 0) }); }));

module.exports = r;
