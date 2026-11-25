/*
 * Managed links. A super admin generates a link (kind: redirect | vcard | review) with its own plan, usually while creating an order.
 * Nothing is attached to anyone yet: whoever opens the link first lands on a claim page, confirms an e-mail with a one-time code
 * and (for a business card) adds the profile details; the link then belongs to that e-mail. One link belongs to one e-mail, one
 * e-mail can own many links. The owner (or an admin) can reset a link back to "unclaimed" or move it to another e-mail, and is
 * asked whether the data goes with it or is wiped.
 */
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const dayjs = require('dayjs');
const { Op } = require('sequelize');
const M = require('../models');
const { jwtSecret } = require('../config');
const { HttpError, fail } = require('../utils/http');
const shortlinks = require('./shortlinks');
const subscription = require('./subscription');
const settings = require('./settings');
const mail = require('./mail');

const KINDS = ['redirect', 'vcard', 'review'];
const KIND_LABEL = { redirect: 'Redirect link', vcard: 'Business card', review: 'Review link' };
const OTP_MINUTES = 10;
const COOLDOWN_S = 45;
const MAX_ATTEMPTS = 5;
const REVIEW_HOST = /^https:\/\/(www\.)?(google\.[a-z.]{2,8}|g\.page|maps\.app\.goo\.gl|goo\.gl|search\.google\.com|maps\.google\.[a-z.]{2,8})(\/|$)/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const cleanEmail = (e) => String(e || '').trim().toLowerCase();
const errs = (field, message) => fail(422, 'Validation failed', { [field]: message });

/** unclaimed | active | paused | expired | details_pending | legacy (a link made before this feature: old behaviour) */
function stateOf(link) {
  if (!link.kind) return 'legacy';
  if (!link.claimed_at) return 'unclaimed';
  if (!link.status) return 'paused';
  if (link.expires_at && new Date(link.expires_at) < new Date()) return 'expired';
  if (link.details_pending) return 'details_pending';
  return 'active';
}

/* ------------------------------------------------------------------ generating */
function checkDestination(kind, url, { required = false } = {}) {
  const u = String(url || '').trim();
  if (!u) { if (required) errs('url', kind === 'review' ? 'Paste the Google review link' : 'Enter the web address this link should open'); return ''; }
  if (u.length > 1000 || !/^https?:\/\/[^\s]+$/i.test(u)) errs('url', 'Enter a full web address starting with https://');
  if (kind === 'review' && !REVIEW_HOST.test(u)) errs('url', 'Use the Google review link of your business (it starts with https://search.google.com/ or https://g.page/)');
  return u;
}

/** Create `qty` unclaimed links. `ordered_for` is only a reference to the customer; the owner is whoever claims the link. */
async function generate({ kind, planId, qty = 1, templateId, presetUrl, orderedFor, orderId, title }) {
  if (!KINDS.includes(kind)) errs('kind', 'Choose a link type');
  const n = Math.min(200, Math.max(1, parseInt(qty, 10) || 1));
  const plan = planId ? await M.Plan.findOne({ where: { id: planId, status: true } }) : null;
  if (!plan) errs('plan_id', 'Choose a plan for this link');
  let template = null;
  if (kind === 'vcard' && templateId) {
    template = await M.Template.findOne({ where: { id: templateId, status: true } });
    if (!template) errs('template_id', 'This template is not available');
  }
  const preset = kind === 'vcard' ? '' : checkDestination(kind, presetUrl);
  if (orderedFor && !(await M.User.findOne({ where: { id: orderedFor, role: 'user' }, attributes: ['id'] }))) errs('user_id', 'User not found');
  const out = [];
  for (let i = 0; i < n; i += 1) {
    out.push(await M.ShortLink.create({
      code: await shortlinks.uniqueCode(M), title: String(title || KIND_LABEL[kind]).slice(0, 150), target_type: 'unassigned', kind, plan_id: plan.id,
      template_id: template?.id || null, preset_url: preset || null, ordered_for: orderedFor || null, nfc_order_id: orderId || null,
    }));
  }
  return out;
}

/* ------------------------------------------------------------------ one-time codes */
const hashOf = (linkId, email, purpose, code) => crypto.createHmac('sha256', jwtSecret).update(`${linkId}:${email}:${purpose}:${code}`).digest('hex');

/** E-mail a 6-digit code for `purpose` to `email`. Only the newest code works. */
async function startOtp(link, email, purpose, payload = {}, action = 'confirm') {
  email = cleanEmail(email);
  if (!EMAIL.test(email)) errs('email', 'Enter a valid e-mail address');
  if (!(await mail.isConfigured())) fail(503, 'E-mail is not set up on this server yet, so codes cannot be sent. Please contact the administrator.');
  const last = await M.LinkOtp.findOne({ where: { link_id: link.id, email, purpose, used_at: null }, order: [['id', 'DESC']] });
  if (last) {
    const wait = Math.ceil((new Date(last.created_at).getTime() + COOLDOWN_S * 1000 - Date.now()) / 1000);
    if (wait > 0) throw new HttpError(429, `Please wait ${wait} seconds before asking for another code`);
  }
  await M.LinkOtp.destroy({ where: { link_id: link.id, email, purpose } }); // earlier codes stop working at once
  const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
  await M.LinkOtp.create({ link_id: link.id, email, purpose, code_hash: hashOf(link.id, email, purpose, code), expires_at: dayjs().add(OTP_MINUTES, 'minute').toDate(), payload });
  await mail.sendTemplate('link_code', email, { code, minutes: OTP_MINUTES, action, link: shortlinks.shortUrl(link.code) });
  return { sent_to: email, minutes: OTP_MINUTES };
}

/** Verify a code. Burns it after 5 wrong tries and after success. Returns the payload stored with it. */
async function checkOtp(link, email, purpose, code) {
  email = cleanEmail(email);
  const bad = () => errs('code', 'The code is invalid or has expired');
  const row = await M.LinkOtp.findOne({ where: { link_id: link.id, email, purpose, used_at: null }, order: [['id', 'DESC']] });
  if (!row || new Date(row.expires_at) < new Date()) bad();
  const given = hashOf(link.id, email, purpose, String(code || '').trim());
  const ok = given.length === row.code_hash.length && crypto.timingSafeEqual(Buffer.from(given), Buffer.from(row.code_hash));
  if (!ok) {
    const attempts = (row.attempts || 0) + 1;
    if (attempts >= MAX_ATTEMPTS) await row.destroy(); else await row.update({ attempts });
    bad();
  }
  await row.update({ used_at: new Date() });
  return row.payload || {};
}

/* ------------------------------------------------------------------ accounts and cards */
async function ensureUser(email) {
  email = cleanEmail(email);
  let user = await M.User.scope('withSecrets').findOne({ where: { email } });
  if (user) {
    if (user.role !== 'user') errs('email', 'This e-mail belongs to a staff account. Use a customer e-mail address.');
    if (!user.is_active || user.org_status === 'blocked') errs('email', 'This account is not active. Please contact support.');
    return user;
  }
  const name = email.split('@')[0].replace(/[^a-zA-Z0-9]+/g, ' ').trim().slice(0, 60) || 'Customer';
  user = await M.User.create({
    first_name: name, last_name: '-', email, role: 'user', is_active: true, email_verified_at: new Date(),
    password: await bcrypt.hash(crypto.randomBytes(24).toString('hex'), 10), // signs in with the e-mailed code, can set a password later
    affiliate_code: crypto.randomBytes(5).toString('hex'),
  });
  return user;
}

const str = (x, n) => String(x ?? '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, n);
function cleanProfile(d = {}) {
  const first = str(d.first_name, 100); const last = str(d.last_name, 100);
  if (!first) errs('first_name', 'Enter your first name');
  const phone = str(d.phone, 30);
  if (phone && !/^[0-9+()\-\s]{5,30}$/.test(phone)) errs('phone', 'Enter a valid phone number');
  return { first_name: first, last_name: last, job_title: str(d.job_title, 150) || null, company: str(d.company, 150) || null, phone: phone.replace(/\D/g, '') || null, region_code: str(d.region_code, 8).replace(/\D/g, '') || null };
}

async function createCard(link, user, details) {
  const p = cleanProfile(details);
  const s = await settings.all();
  const tpl = (link.template_id && (await M.Template.findOne({ where: { id: link.template_id, status: true } })))
    || (await M.Template.findOne({ where: { slug: s.default_vcard_template || 'vcard1', status: true } })) || (await M.Template.findOne({ where: { status: true }, order: [['id', 'ASC']] }));
  if (!tpl) fail(503, 'No card template is available yet. Please contact the administrator.');
  const name = `${p.first_name} ${p.last_name}`.trim();
  return M.Vcard.create({
    name, url_alias: await require('./onboarding').freeAlias(name), template_id: tpl.id, user_id: user.id, ...p, email: user.email, occupation: p.job_title,
    theme: tpl.defaults || {}, sections: { contact: true, social: true, services: true, gallery: true, testimonials: true, hours: true, qr: true, enquiry: true },
  });
}

/** check the entered details without saving anything (so a typo never burns a one-time code) */
function validateDetails(link, details = {}) {
  if (link.kind === 'vcard') cleanProfile(details); else checkDestination(link.kind, details.url || link.preset_url, { required: true });
}

/** apply what the owner entered for the link's kind (destination, or the profile for a card) */
async function applyDetails(link, user, details = {}) {
  const d = {};
  if (link.kind === 'vcard') {
    const card = await createCard(link, user, details);
    Object.assign(d, { target_type: 'vcard', vcard_id: card.id, target_url: null });
  } else {
    const url = checkDestination(link.kind, details.url || link.preset_url, { required: true });
    Object.assign(d, { target_type: 'url', target_url: url, vcard_id: null });
  }
  return d;
}

/* ------------------------------------------------------------------ claim */
async function claim(link, user, details) {
  if (stateOf(link) !== 'unclaimed') fail(409, 'This link has already been claimed.');
  const d = await applyDetails(link, user, details);
  const plan = link.plan_id ? await M.Plan.findByPk(link.plan_id) : null;
  await link.update({
    ...d, user_id: user.id, claimed_at: new Date(), claimed_email: user.email, details_pending: false, status: true, preset_url: null,
    expires_at: plan ? subscription.endDate(plan, new Date()) : null,
  });
  return link;
}

/** a link moved with its data wiped: the new owner adds the details first */
async function completeDetails(link, user, details) {
  if (link.user_id !== user.id || !link.details_pending) fail(422, 'Nothing to complete for this link');
  const d = await applyDetails(link, user, details);
  await link.update({ ...d, details_pending: false });
  return link;
}

/* ------------------------------------------------------------------ reset and move */
/** Back to unclaimed. keep = the previous owner keeps the card (now a normal card without this link) / the destination is remembered. wipe = deleted. */
async function reset(link, { wipe }) {
  if (stateOf(link) === 'unclaimed' || stateOf(link) === 'legacy') fail(422, 'This link is not attached to anyone.');
  const keepUrl = link.target_type === 'url' ? link.target_url : null;
  const cardId = link.vcard_id;
  await link.update({
    user_id: null, claimed_at: null, claimed_email: null, expires_at: null, status: true, details_pending: false, target_type: 'unassigned',
    vcard_id: null, target_url: null, preset_url: !wipe && keepUrl ? keepUrl : null,
  });
  if (wipe && cardId) { const card = await M.Vcard.findByPk(cardId); if (card) await card.destroy(); }
  return link;
}

/** Move to another e-mail. keep = the card/destination goes with it. wipe = deleted, the new owner adds the details first. */
async function transfer(link, toEmail, { wipe }) {
  if (stateOf(link) === 'unclaimed' || stateOf(link) === 'legacy') fail(422, 'This link is not attached to anyone, so it cannot be moved.');
  const to = await ensureUser(toEmail);
  if (to.id === link.user_id) errs('email', 'This link already belongs to that e-mail.');
  const cardId = link.vcard_id;
  const d = { user_id: to.id, claimed_email: to.email };
  if (link.kind === 'vcard' && cardId) {
    const card = await M.Vcard.findByPk(cardId);
    if (card && !wipe) {
      await card.update({ user_id: to.id, email: card.email === link.claimed_email ? to.email : card.email });
      await M.ShortLink.update({ user_id: to.id }, { where: { vcard_id: card.id, id: { [Op.ne]: link.id } } });
    } else {
      if (card) { await link.update({ vcard_id: null }); await card.destroy(); }
      Object.assign(d, { vcard_id: null, target_type: 'unassigned', details_pending: true });
    }
  } else if (wipe) Object.assign(d, { target_url: null, target_type: 'unassigned', details_pending: true });
  await link.update(d);
  return { link, to };
}

/* ------------------------------------------------------------------ plan per link */
/** The plan that applies to a card: the plan of the link it is attached to, otherwise its owner's subscription. */
async function subFor(v, userId) {
  if (v?.id) {
    const link = await M.ShortLink.findOne({ where: { vcard_id: v.id, kind: 'vcard', plan_id: { [Op.ne]: null }, claimed_at: { [Op.ne]: null } }, order: [['id', 'ASC']] });
    if (link) {
      const plan = await M.Plan.findByPk(link.plan_id, { include: [M.Template] });
      if (plan) return { plan, plan_id: plan.id, status: 'active', starts_at: link.claimed_at, ends_at: link.expires_at || dayjs().add(100, 'year').toDate(), linked: true, link_id: link.id, user_id: link.user_id };
    }
  }
  return subscription.current(userId || v?.user_id);
}

const publicInfo = async (link) => ({
  code: link.code, kind: link.kind, state: stateOf(link), kind_label: KIND_LABEL[link.kind] || null,
  plan: link.plan_id ? (await M.Plan.findByPk(link.plan_id, { attributes: ['id', 'name'] }))?.name || null : null,
  needs: link.kind === 'vcard' ? 'profile' : 'url', preset_url: link.preset_url || null,
});

module.exports = { validateDetails, KINDS, KIND_LABEL, OTP_MINUTES, stateOf, generate, startOtp, checkOtp, ensureUser, claim, completeDetails, reset, transfer, subFor, publicInfo, cleanEmail, checkDestination };
