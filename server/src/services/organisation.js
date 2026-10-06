/*
 * Organisations: company profile, seats, members (single + CSV import), member lock / block,
 * per-field locks on member cards, and announcements e-mailed to every member.
 * An organisation is owned by a user (users.is_organisation); members have users.organisation_id = owner id.
 */
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { clientUrl } = require('../config');
const mail = require('./mail');
const subs = require('./subscription');
const onboarding = require('./onboarding');
const perms = require('./permissions');

const M = () => require('../models');

const LOCKED_MESSAGE = 'Your account has been locked by your organisation. Please contact your organisation administrator.';
const ORG_STATUSES = ['active', 'locked', 'blocked'];
const ROLES = ['member', 'supervisor', 'manager'];

/* Fields an organisation can lock on a member. Card fields map to vCard columns, account fields to the user profile. */
const LOCKABLE = {
  first_name: 'First name', last_name: 'Last name', occupation: 'Occupation', job_title: 'Job title', company: 'Company',
  description: 'About', email: 'E-mail', phone: 'Phone', alternative_email: 'Alternative e-mail', alternative_phone: 'Alternative phone',
  location: 'Address / location', location_url: 'Google Maps link', profile_image: 'Profile photo', cover_image: 'Cover image',
  social_links: 'Social links', custom_links: 'Custom links', name: 'Card name', url_alias: 'Card link', template_id: 'Template', theme: 'Colours & font',
  manage_cards: 'Create, duplicate & delete cards',
};
// request keys that travel with a locked field
const LINKED = { phone: ['phone', 'region_code'], location_url: ['location_url', 'location_embed'], cover_image: ['cover_image', 'remove_cover_image'] };
// account profile keys covered by a lock
const PROFILE_KEYS = { first_name: ['first_name'], last_name: ['last_name'], email: ['email'], phone: ['contact', 'region_code'], profile_image: ['avatar'] };
// card fields the organisation can edit for a member
const CARD_FIELDS = ['name', 'first_name', 'last_name', 'occupation', 'job_title', 'company', 'description', 'email', 'region_code', 'phone', 'alternative_email', 'alternative_phone', 'location', 'location_url'];

const cleanLocks = (list) => [...new Set((Array.isArray(list) ? list : []).map(String))].filter((k) => LOCKABLE[k]);
const lockedOf = (user) => (user?.organisation_id ? cleanLocks(user.locked_fields) : []);
const isLocked = (user, key) => lockedOf(user).includes(key);
const canSignIn = (user) => !user.organisation_id || !user.org_status || user.org_status === 'active';
/** public pages (vCards, stores) of blocked members are hidden */
const isLive = (user) => !!user && user.is_active && user.org_status !== 'blocked';

/** Drop locked fields from a member's own vCard update (body + uploaded files) */
function stripCardLocks(user, body, files) {
  for (const k of lockedOf(user)) for (const key of LINKED[k] || [k]) { delete body[key]; if (files) delete files[key]; }
}
/** Drop locked fields from a member's own account profile update */
function stripProfileLocks(user, data) {
  for (const k of lockedOf(user)) for (const key of PROFILE_KEYS[k] || []) delete data[key];
}

async function profileOf(owner) {
  const org = await M().Organisation.findOne({ where: { owner_id: owner.id } });
  return org || { owner_id: owner.id, name: `${owner.first_name} ${owner.last_name}`.trim(), seats: 0 };
}

/** Seats: the number set on the organisation, otherwise the plan's organisation-user limit */
async function seatLimit(owner) {
  const org = await M().Organisation.findOne({ where: { owner_id: owner.id }, attributes: ['seats'] });
  if (org?.seats > 0) return org.seats;
  return (await subs.current(owner.id))?.plan?.no_of_organization_users || 0;
}
const seatsUsed = (owner) => M().User.count({ where: { organisation_id: owner.id } });

const randomPassword = () => `${crypto.randomBytes(6).toString('base64url')}${crypto.randomInt(10, 99)}`;
const credentialsMail = (user, password) => mail.sendTemplate('welcome', user.email, { name: user.first_name, email: user.email, password, login_url: `${clientUrl}/login` })
  .catch((e) => console.error('[organisation mail]', e.message));

/**
 * Create one member inside the organisation. Members share the organisation's plan.
 * Returns { member, password } (password = the plain one, generated when not given).
 */
async function createMember(owner, input, { notify = true, company } = {}) {
  const email = String(input.email || '').toLowerCase().trim();
  const password = input.password ? String(input.password) : randomPassword();
  const role = ROLES.includes(input.company_role) ? input.company_role : 'member';
  const member = await M().User.create({
    first_name: String(input.first_name).trim().slice(0, 100), last_name: String(input.last_name || '').trim().slice(0, 100), email,
    contact: input.contact ? String(input.contact).slice(0, 30) : null, region_code: input.region_code ? String(input.region_code).replace(/\D/g, '').slice(0, 8) : null,
    role: 'user', organisation_id: owner.id, company_role: role, org_status: 'active',
    permissions: role !== 'member' && input.permissions !== undefined ? perms.clean(input.permissions, true) : null,
    password: await bcrypt.hash(password, 12), email_verified_at: new Date(), affiliate_code: crypto.randomBytes(5).toString('hex'),
  });
  const sub = await subs.current(owner.id);
  if (sub?.plan) await subs.activate(member.id, sub.plan, { paymentType: 'organisation' });
  if (role === 'member') {
    const v = await onboarding.defaultVcard(member);
    // company details on the member's starter card
    const org = company || (await M().Organisation.findOne({ where: { owner_id: owner.id } }));
    if (v && org) {
      const social = { ...(v.social_links || {}) };
      if (org.website) social.website = org.website;
      await v.update({ company: org.name, job_title: input.job_title ? String(input.job_title).slice(0, 150) : v.job_title, location: [org.address, org.city, org.country].filter(Boolean).join(', ') || null, social_links: social });
    }
  }
  if (notify) credentialsMail(member, password);
  return { member, password };
}

/* ------------------------------------------------------------------ CSV */
/** Minimal RFC 4180 parser (quoted fields, escaped quotes, CRLF) */
function parseCsv(text) {
  const rows = []; let row = []; let cell = ''; let quoted = false;
  const src = String(text || '').replace(/^﻿/, '');
  for (let i = 0; i < src.length; i += 1) {
    const c = src[i];
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') { cell += '"'; i += 1; } else if (c === '"') quoted = false; else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ',' || c === ';') { row.push(cell); cell = ''; } else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i += 1;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((x) => String(x).trim()));
}

const HEADER_ALIASES = {
  first_name: ['first_name', 'firstname', 'first name', 'name'], last_name: ['last_name', 'lastname', 'last name', 'surname'],
  email: ['email', 'e-mail', 'email address'], contact: ['phone', 'contact', 'mobile'], region_code: ['country_code', 'region_code', 'code'],
  password: ['password'], company_role: ['role', 'company_role'], job_title: ['job_title', 'job title', 'designation', 'title'],
};
function csvRecords(text) {
  const [head, ...rows] = parseCsv(text);
  if (!head) return [];
  const cols = head.map((h) => String(h).trim().toLowerCase());
  const idx = Object.fromEntries(Object.entries(HEADER_ALIASES).map(([k, names]) => [k, cols.findIndex((c) => names.includes(c))]));
  return rows.map((r, i) => ({ line: i + 2, ...Object.fromEntries(Object.entries(idx).filter(([, n]) => n >= 0).map(([k, n]) => [k, String(r[n] ?? '').trim()])) }));
}

/** Bulk import members from CSV text. Valid rows are created until the seats run out; the rest are reported. */
async function importMembers(owner, text, { notify = true, defaultRole = 'member' } = {}) {
  const records = csvRecords(text);
  if (!records.length) return { created: [], errors: [{ line: 1, message: 'The file has no rows. Use the sample file as a template.' }] };
  if (records.length > 1000) return { created: [], errors: [{ line: 1, message: 'Import at most 1000 users at a time' }] };
  const limit = await seatLimit(owner);
  let used = await seatsUsed(owner);
  const company = await M().Organisation.findOne({ where: { owner_id: owner.id } });
  const seen = new Set();
  const created = []; const errors = [];
  for (const r of records) {
    const email = String(r.email || '').toLowerCase();
    const fail = (message) => errors.push({ line: r.line, email, message });
    if (!r.first_name) { fail('First name is missing'); continue; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { fail('E-mail is missing or invalid'); continue; }
    if (seen.has(email)) { fail('Duplicate e-mail in the file'); continue; }
    seen.add(email);
    if (r.password && r.password.length < 8) { fail('Password must be at least 8 characters'); continue; }
    if (used >= limit) { fail(`No seats left (${limit} allowed)`); continue; }
    if (await M().User.findOne({ where: { email }, attributes: ['id'] })) { fail('This e-mail is already registered'); continue; }
    const role = ROLES.includes(String(r.company_role || '').toLowerCase()) ? String(r.company_role).toLowerCase() : defaultRole;
    try {
      const { member, password } = await createMember(owner, { ...r, email, company_role: role }, { notify, company });
      used += 1;
      created.push({ id: member.id, name: `${member.first_name} ${member.last_name}`.trim(), email, password, role });
    } catch (e) { fail(e.message); }
  }
  return { created, errors };
}

/* --------------------------------------------------------- announcements */
async function announce(owner, actor, { title, body, type }) {
  const a = await M().Announcement.create({
    title, body, type: ['info', 'success', 'warning', 'danger', 'promo'].includes(type) ? type : 'info', audience: 'organisation', organisation_id: owner.id,
    send_email: true, status: true, created_by: actor.id,
  });
  const members = await M().User.findAll({ where: { organisation_id: owner.id, is_active: true }, attributes: ['id', 'email', 'first_name'] });
  await a.update({ emailed_at: new Date() });
  // e-mail in the background; the announcement also shows in each member's portal
  (async () => {
    for (const u of members) await mail.sendTemplate('announcement', u.email, { name: u.first_name, title, body_html: body || '' }).catch((e) => console.error('[org announcement]', e.message));
  })();
  return { announcement: a, recipients: members.length };
}

/* --------------------------------------------------------------- journey */
const fullName = (u) => `${u?.first_name || ''} ${u?.last_name || ''}`.trim();
function actorKind(ownerId, actor) {
  if (!actor) return 'system';
  if (M().STAFF_ROLES.includes(actor.role)) return 'staff';
  if (actor.id === ownerId) return 'owner';
  return actor.company_role || 'member';
}
/** Record a step in the organisation's journey (never throws) */
async function logEvent(ownerId, actor, type, message, meta = {}) {
  try {
    await M().OrganisationEvent.create({ owner_id: ownerId, actor_id: actor?.id || null, actor_name: actor ? fullName(actor) : 'System', actor_kind: actorKind(ownerId, actor), type, message: String(message).slice(0, 500), meta });
  } catch (e) { console.error('[organisation event]', e.message); }
}

const CHANNEL = { shop: 'the website shop', portal: 'the user portal', admin: 'staff' };
/** Full journey: logged events + every order + members / creation from before the log existed. Newest first. */
async function timeline(owner) {
  const X = M();
  const [events, members] = await Promise.all([
    X.OrganisationEvent.findAll({ where: { owner_id: owner.id }, order: [['id', 'DESC']], limit: 1000 }),
    X.User.findAll({ where: { organisation_id: owner.id }, attributes: ['id', 'first_name', 'last_name', 'email', 'company_role', 'created_at'] }),
  ]);
  const people = Object.fromEntries([owner, ...members].map((u) => [u.id, u]));
  const { Op } = require('sequelize');
  const orders = await X.NfcOrder.findAll({
    where: { [Op.or]: [{ organisation_id: owner.id }, { user_id: Object.keys(people).map(Number) }] },
    attributes: ['id', 'order_number', 'amount', 'source', 'user_id', 'organisation_id', 'order_status', 'created_at', 'name'],
    include: [{ model: X.User, as: 'creator', attributes: ['id', 'first_name', 'last_name'] }, { model: X.NfcOrderItem, as: 'items', attributes: ['name', 'quantity'] }],
    order: [['id', 'DESC']], limit: 500,
  });
  const items = events.map((e) => ({ id: `e${e.id}`, at: e.created_at, type: e.type, message: e.message, actor_name: e.actor_name, actor_kind: e.actor_kind, meta: e.meta }));
  for (const o of orders) {
    const contact = people[o.user_id];
    const what = (o.items || []).map((i) => `${i.quantity}x ${i.name}`).join(', ');
    const by = o.creator ? fullName(o.creator) : contact ? fullName(contact) : o.name;
    items.push({
      id: `o${o.id}`, at: o.created_at, type: 'order',
      message: o.creator
        ? `${contact ? `${fullName(contact)} contacted us and ` : ''}${fullName(o.creator)} placed order ${o.order_number}${what ? `: ${what}` : ''}`
        : `Order ${o.order_number} placed${contact ? ` by ${fullName(contact)}` : ''} via ${CHANNEL[o.source] || o.source}${what ? `: ${what}` : ''}`,
      actor_name: by, actor_kind: o.creator ? 'staff' : contact ? actorKind(owner.id, contact) : 'system',
      meta: { order_id: o.id, order_number: o.order_number, amount: Number(o.amount), status: o.order_status },
    });
  }
  // history from before the journey log: creation + members that joined
  if (!events.some((e) => e.type === 'organisation_created')) items.push({ id: 'created', at: owner.created_at, type: 'organisation_created', message: `${fullName(owner)} became the organisation owner`, actor_name: fullName(owner), actor_kind: 'owner', meta: {} });
  const logged = new Set(events.flatMap((e) => (e.type === 'member_added' ? [e.meta?.member_id] : e.type === 'members_imported' ? e.meta?.member_ids || [] : [])));
  for (const m of members) if (!logged.has(m.id)) items.push({ id: `m${m.id}`, at: m.created_at, type: 'member_added', message: `${fullName(m)} (${m.company_role || 'member'}) joined`, actor_name: null, actor_kind: 'system', meta: { member_id: m.id } });
  return items.sort((a, b) => new Date(b.at) - new Date(a.at));
}

module.exports = {
  LOCKED_MESSAGE, ORG_STATUSES, ROLES, LOCKABLE, CARD_FIELDS, cleanLocks, lockedOf, isLocked, canSignIn, isLive, stripCardLocks, stripProfileLocks,
  profileOf, seatLimit, seatsUsed, randomPassword, credentialsMail, createMember, parseCsv, importMembers, announce, logEvent, timeline, fullName,
};
