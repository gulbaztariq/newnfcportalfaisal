const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { Op } = require('sequelize');
const { User, Vcard, Subscription, Plan, Organisation } = require('../../models');
const { wrap, fail, validate, pick, toBool, paginate, paged } = require('../../utils/http');
const { makeUpload, fileUrl, removeFile } = require('../../middleware/upload');
const { issueToken, isSuperAdmin, COOKIE, IMP_COOKIE, cookieOpts } = require('../../middleware/auth');
const subs = require('../../services/subscription');
const mail = require('../../services/mail');
const settings = require('../../services/settings');
const { clientUrl } = require('../../config');
const perms = require('../../services/permissions');
const onboarding = require('../../services/onboarding');
const { audit } = require('../../services/security');
const org = require('../../services/organisation');

const STAFF = ['admin', 'manager', 'supervisor'];

/** role = 'user' | 'admin' — the same controller serves "Users" and "Staff" (admins, managers, supervisors) menus */
const parseList = (v) => { if (Array.isArray(v)) return v; try { return JSON.parse(v); } catch { return String(v || '').split(',').filter(Boolean); } };

/* organisation accounts: company details sent as org_* fields next to the owner's user fields */
const ORG_RULES = { org_name: 'required|max:150', org_email: 'email|max:191', org_phone: 'max:40', org_address: 'max:500', org_city: 'max:120', org_country: 'max:120', seats: 'numeric' };
function orgData(b) {
  const w = String(b.org_website || '').trim();
  const d = {
    name: b.org_name, website: !w ? null : /^https?:\/\//i.test(w) ? w.slice(0, 255) : `https://${w}`.slice(0, 255),
    email: b.org_email, phone: b.org_phone, address: b.org_address, city: b.org_city, country: b.org_country,
    seats: Math.max(0, Math.min(100000, parseInt(b.seats, 10) || 0)),
  };
  for (const [k, v] of Object.entries(d)) if (v === '' || v === undefined) d[k] = null;
  d.seats = d.seats || 0;
  return d;
}
const fileOf = (req, name) => req.files?.[name]?.[0];

module.exports = function usersRouter(role) {
  const r = express.Router();
  if (role === 'admin') r.use(isSuperAdmin); // only the super admin manages admins
  const upload = makeUpload('avatars', { maxMb: 2 }).fields([{ name: 'avatar', maxCount: 1 }, { name: 'logo', maxCount: 1 }]);
  const roleWhere = role === 'admin' ? STAFF : 'user';
  const staffRole = (b) => (STAFF.includes(b.role) ? b.role : 'manager');

  r.get('/', wrap(async (req, res) => {
    const p = paginate(req);
    const where = { role: roleWhere };
    if (role === 'admin' && STAFF.includes(req.query.role)) where.role = req.query.role;
    const q = (req.query.search || '').trim();
    if (q) where[Op.or] = ['first_name', 'last_name', 'email'].map((f) => ({ [f]: { [Op.like]: `%${q}%` } }));
    if (req.query.status === 'active') where.is_active = true;
    if (req.query.status === 'inactive') where.is_active = false;
    if (role === 'user' && req.query.type === 'organisation') where.is_organisation = true;
    if (role === 'user' && req.query.type === 'member') where.organisation_id = { [Op.ne]: null };
    if (role === 'user' && req.query.type === 'individual') Object.assign(where, { is_organisation: false, organisation_id: null });
    if (role === 'user' && req.query.organisation_id) where.organisation_id = req.query.organisation_id;
    const include = role === 'user' ? [{ model: Subscription, where: { status: 'active' }, required: false, include: [{ model: Plan, attributes: ['id', 'name'] }] }, { model: Organisation, required: false }] : [];
    const { rows, count } = await User.findAndCountAll({ where, include, order: [['id', 'DESC']], limit: p.limit, offset: p.offset, distinct: true });
    const counts = role === 'user' ? await Vcard.count({ where: { user_id: rows.map((u) => u.id) }, group: ['user_id'] }) : [];
    const byUser = Object.fromEntries(counts.map((c) => [c.user_id, c.count]));
    // organisations: members count; members: their organisation's name
    const ownerIds = rows.filter((u) => u.is_organisation).map((u) => u.id);
    const memberCounts = ownerIds.length ? await User.count({ where: { organisation_id: ownerIds }, group: ['organisation_id'] }) : [];
    const membersOf = Object.fromEntries(memberCounts.map((c) => [c.organisation_id, c.count]));
    const orgIds = [...new Set(rows.map((u) => u.organisation_id).filter(Boolean))];
    const orgNames = orgIds.length ? Object.fromEntries((await Organisation.findAll({ where: { owner_id: orgIds }, attributes: ['owner_id', 'name'] })).map((o) => [o.owner_id, o.name])) : {};
    const planLimits = {};
    for (const u of rows.filter((x) => x.is_organisation)) planLimits[u.id] = await org.seatLimit(u);
    res.json(paged(rows.map((u) => ({
      ...u.toJSON(), vcards_count: byUser[u.id] || 0, plan: u.subscriptions?.[0]?.plan || null,
      members_count: u.is_organisation ? membersOf[u.id] || 0 : undefined, seats: u.is_organisation ? planLimits[u.id] : undefined,
      organisation_name: u.organisation_id ? orgNames[u.organisation_id] || null : undefined,
    })), count, p));
  }));

  r.get('/:id', wrap(async (req, res) => {
    const user = await User.findOne({ where: { id: req.params.id, role: roleWhere } });
    if (!user) fail(404, 'Not found');
    const [vcards, subscription] = await Promise.all([
      Vcard.findAll({ where: { user_id: user.id }, attributes: ['id', 'name', 'url_alias', 'occupation', 'status', 'views', 'created_at'] }),
      subs.current(user.id),
    ]);
    let organisation = null;
    if (user.is_organisation) {
      const members = await User.findAll({ where: { organisation_id: user.id }, order: [['id', 'DESC']] });
      const profile = await org.profileOf(user);
      organisation = { ...(profile.toJSON ? profile.toJSON() : profile), seats_limit: await org.seatLimit(user), members };
    } else if (user.organisation_id) {
      const owner = await User.findByPk(user.organisation_id, { attributes: ['id', 'first_name', 'last_name', 'email'] });
      organisation = { member_of: owner, name: (await Organisation.findOne({ where: { owner_id: user.organisation_id }, attributes: ['name'] }))?.name || owner?.fullName() };
    }
    res.json({ data: { ...user.toJSON(), vcards, subscription, organisation_profile: organisation } });
  }));

  r.post('/', upload, wrap(async (req, res) => {
    const isOrg = role === 'user' && toBool(req.body.is_organisation);
    validate(req.body, { first_name: 'required|max:100', last_name: 'required|max:100', email: 'required|email|max:191', password: 'required|min:6|max:100', ...(isOrg ? ORG_RULES : {}) });
    if (req.body.password !== req.body.password_confirmation) fail(422, 'Validation failed', { password_confirmation: 'Passwords do not match' });
    const email = String(req.body.email).toLowerCase().trim();
    if (await User.findOne({ where: { email } })) fail(422, 'Validation failed', { email: 'This e-mail is already registered' });
    const user = await User.create({
      ...pick(req.body, ['first_name', 'last_name', 'contact', 'region_code']), email, role: role === 'admin' ? staffRole(req.body) : 'user',
      permissions: role === 'admin' && req.body.permissions !== undefined ? perms.clean(parseList(req.body.permissions)) : null,
      is_active: req.body.is_active === undefined ? true : toBool(req.body.is_active),
      password: await bcrypt.hash(String(req.body.password), 12), email_verified_at: new Date(),
      affiliate_code: crypto.randomBytes(5).toString('hex'), avatar: fileUrl('avatars', fileOf(req, 'avatar')),
      is_organisation: isOrg, company_role: isOrg ? 'owner' : null,
    });
    if (isOrg) {
      const o = await Organisation.create({ ...orgData(req.body), owner_id: user.id, logo: fileUrl('avatars', fileOf(req, 'logo')) || null });
      org.logEvent(user.id, req.user, 'organisation_created', `Organisation ${o.name} created with ${user.fullName()} as owner${o.seats ? ` (${o.seats} seats)` : ''}`);
    }
    if (role === 'user') {
      const plan = req.body.plan_id ? await Plan.findByPk(req.body.plan_id) : null;
      if (plan) await subs.activate(user.id, plan, { paymentType: 'admin' }); else await subs.assignDefaultPlan(user.id);
      await onboarding.defaultVcard(user);
    }
    audit(req, 'user.create', 'user', user.id, { role: user.role, organisation: isOrg || undefined });
    // credentials e-mail (the password is only in the e-mail, never logged)
    mail.sendTemplate('welcome', email, { name: user.first_name, email, password: req.body.password, login_url: `${clientUrl}/login` })
      .catch((e) => console.error('mail error', e.message));
    res.status(201).json({ data: user, message: `${role === 'admin' ? 'Staff member' : isOrg ? 'Organisation' : 'User'} created successfully. Login details were e-mailed.` });
  }));

  r.put('/:id', upload, wrap(async (req, res) => {
    const user = await User.findOne({ where: { id: req.params.id, role: roleWhere } });
    if (!user) fail(404, 'Not found');
    // an individual can be turned into an organisation (never a member of another one)
    const isOrg = role === 'user' && (user.is_organisation || (toBool(req.body.is_organisation) && !user.organisation_id));
    validate(req.body, { first_name: 'required|max:100', last_name: 'required|max:100', email: 'required|email|max:191', password: 'min:6|max:100', ...(isOrg && req.body.org_name !== undefined ? ORG_RULES : {}) });
    const email = String(req.body.email).toLowerCase().trim();
    if (email !== user.email && (await User.findOne({ where: { email } }))) fail(422, 'Validation failed', { email: 'This e-mail is already registered' });
    const data = { ...pick(req.body, ['first_name', 'last_name', 'contact', 'region_code']), email };
    if (req.body.is_active !== undefined) data.is_active = toBool(req.body.is_active);
    if (role === 'admin') {
      if (req.body.role !== undefined) data.role = staffRole(req.body);
      if (req.body.permissions !== undefined) data.permissions = perms.clean(parseList(req.body.permissions));
      if (data.role && data.role !== user.role) data.token_version = (user.token_version || 0) + 1;
    }
    if (req.body.password) {
      if (req.body.password !== req.body.password_confirmation) fail(422, 'Validation failed', { password_confirmation: 'Passwords do not match' });
      data.password = await bcrypt.hash(String(req.body.password), 12);
      data.token_version = (user.token_version || 0) + 1;
    }
    if (fileOf(req, 'avatar')) { removeFile(user.avatar); data.avatar = fileUrl('avatars', fileOf(req, 'avatar')); }
    if (isOrg && !user.is_organisation) Object.assign(data, { is_organisation: true, company_role: 'owner' });
    if (isOrg && req.body.org_name !== undefined) {
      const o = orgData(req.body);
      const row = await Organisation.findOne({ where: { owner_id: user.id } });
      if (fileOf(req, 'logo')) { if (row?.logo) removeFile(row.logo); o.logo = fileUrl('avatars', fileOf(req, 'logo')); }
      const oldSeats = row ? Number(row.seats || 0) : 0;
      if (row) await row.update(o); else await Organisation.create({ ...o, owner_id: user.id });
      if (!user.is_organisation) org.logEvent(user.id, req.user, 'organisation_created', `${user.fullName()}'s account was turned into the organisation ${o.name}`);
      else if (oldSeats !== o.seats) org.logEvent(user.id, req.user, 'seats_changed', `Seats changed to ${o.seats || 'the plan limit'}`);
      else org.logEvent(user.id, req.user, 'profile_updated', 'Company details updated by staff');
    }
    await user.update(data);
    audit(req, 'user.update', 'user', user.id, { fields: Object.keys(data).filter((k) => k !== 'password') });
    res.json({ data: user, message: 'Updated successfully' });
  }));

  r.patch('/:id/status', wrap(async (req, res) => {
    const user = await User.scope('withSecrets').findOne({ where: { id: req.params.id, role: roleWhere } });
    if (!user) fail(404, 'Not found');
    const active = toBool(req.body.is_active);
    // deactivation also kills existing sessions
    await user.update({ is_active: active, token_version: active ? user.token_version : (user.token_version || 0) + 1 });
    res.json({ message: active ? 'Activated successfully' : 'Deactivated successfully' });
  }));

  r.patch('/:id/verify-email', wrap(async (req, res) => {
    const user = await User.findOne({ where: { id: req.params.id, role: roleWhere } });
    if (!user) fail(404, 'Not found');
    await user.update({ email_verified_at: new Date() });
    res.json({ message: 'E-mail verified successfully' });
  }));

  r.delete('/:id', wrap(async (req, res) => {
    const user = await User.findOne({ where: { id: req.params.id, role: roleWhere } });
    if (!user) fail(404, 'Not found');
    if (user.id === req.user.id) fail(422, 'You cannot delete yourself');
    await Vcard.destroy({ where: { user_id: user.id } });
    if (user.is_organisation) {
      await User.update({ organisation_id: null, company_role: null, permissions: null, org_status: 'active', locked_fields: null }, { where: { organisation_id: user.id } });
      await Organisation.destroy({ where: { owner_id: user.id } });
    }
    await user.destroy();
    audit(req, 'user.delete', 'user', user.id, { email: user.email });
    res.json({ message: 'Deleted successfully' });
  }));

  if (role === 'user') {
    /* organisation journey + bulk import (super admin) */
    const ownerOf = async (id) => {
      const owner = await User.findOne({ where: { id, role: 'user', is_organisation: true } });
      if (!owner) fail(404, 'Organisation not found');
      return owner;
    };
    r.get('/:id/timeline', wrap(async (req, res) => res.json({ data: await org.timeline(await ownerOf(req.params.id)) })));
    r.post('/:id/organisation/import', wrap(async (req, res) => {
      const owner = await ownerOf(req.params.id);
      const csv = String(req.body.csv || '');
      if (!csv.trim()) fail(422, 'Choose a CSV file');
      if (csv.length > 900 * 1024) fail(422, 'The file is too large (max 900 KB, about 10,000 rows)');
      const result = await org.importMembers(owner, csv, { notify: toBool(req.body.notify), defaultRole: org.ROLES.includes(req.body.default_role) ? req.body.default_role : 'member' });
      if (result.created.length) org.logEvent(owner.id, req.user, 'members_imported', `Imported ${result.created.length} user(s) from a CSV file: ${result.created.slice(0, 5).map((c) => c.name).join(', ')}${result.created.length > 5 ? '...' : ''}`, { member_ids: result.created.map((c) => c.id) });
      audit(req, 'organisation.import', 'user', owner.id, { created: result.created.length });
      res.json({ ...result, message: `${result.created.length} user(s) imported${result.errors.length ? `, ${result.errors.length} row(s) skipped` : ''}` });
    }));

    r.post('/:id/impersonate', wrap(async (req, res) => {
      const user = await User.scope('withSecrets').findOne({ where: { id: req.params.id, role: 'user' } });
      if (!user) fail(404, 'Not found');
      if (!user.is_active) fail(422, 'This user is deactivated');
      if (!org.canSignIn(user)) fail(422, `This user is ${user.org_status} by their organisation`);
      res.cookie(IMP_COOKIE, req.cookies[COOKIE], cookieOpts); // keep the admin session to come back
      issueToken(res, user);
      res.json({ message: `You are now logged in as ${user.fullName()}` });
    }));
  }
  return r;
};
