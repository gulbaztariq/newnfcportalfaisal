const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const QRCode = require('qrcode');
const rateLimit = require('express-rate-limit');
const { User, AffiliateUser } = require('../models');
const { wrap, fail, validate, pick } = require('../utils/http');
const { issueToken, clearTokens, requireAuth, COOKIE, IMP_COOKIE, cookieOpts } = require('../middleware/auth');
const { makeUpload, fileUrl, removeFile } = require('../middleware/upload');
const settings = require('../services/settings');
const subs = require('../services/subscription');
const mail = require('../services/mail');
const totp = require('../services/totp');
const extras = require('../services/extras');
const security = require('../services/security');
const onboarding = require('../services/onboarding');
const perms = require('../services/permissions');
const { STAFF_ROLES } = require('../models');
const { clientUrl, jwtSecret } = require('../config');

const org = require('../services/organisation');
const r = express.Router();
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false, message: { message: 'Too many attempts, please try again later.' } });
const codeLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false, message: { message: 'Too many code attempts, please try again later.' } });

const publicUser = (u, impersonator) => ({
  id: u.id, first_name: u.first_name, last_name: u.last_name, email: u.email, contact: u.contact, region_code: u.region_code,
  role: u.role, avatar: u.avatar, language: u.language, theme_mode: u.theme_mode, affiliate_code: u.affiliate_code,
  two_factor_enabled: !!u.two_factor_enabled, email_verified: !!u.email_verified_at,
  is_organisation: !!u.is_organisation, organisation_id: u.organisation_id || null, company_role: u.company_role || (u.is_organisation ? 'owner' : null),
  locked_fields: org.lockedOf(u),
  permissions: perms.permissionsOf(u), is_staff: STAFF_ROLES.includes(u.role),
  impersonating: !!impersonator, impersonator: impersonator ? { id: impersonator.id, name: impersonator.fullName() } : null,
});

async function sendVerification(user) {
  const token = crypto.randomBytes(32).toString('hex');
  await user.update({ email_verify_token: crypto.createHash('sha256').update(token).digest('hex') });
  const url = `${clientUrl}/verify-email?token=${token}&email=${encodeURIComponent(user.email)}`;
  await mail.sendTemplate('verify_email', user.email, { name: user.first_name, verify_url: url });
}

/** Finish a login: 2FA challenge when enabled, otherwise start the session */
async function completeLogin(res, user) {
  const s = await settings.all();
  if (s.email_verification_enable === '1' && !user.email_verified_at && user.role === 'user') {
    fail(403, 'Please verify your e-mail address first. Check your inbox or request a new link.');
  }
  if (user.two_factor_enabled) {
    const challenge = jwt.sign({ sub: user.id, v: user.token_version || 0, p: '2fa', m: 'totp' }, jwtSecret, { expiresIn: '5m' });
    return res.json({ two_factor: true, method: 'totp', challenge });
  }
  // e-mail code on every sign-in: when enabled for everyone, and always for staff that have no authenticator yet
  const staff = STAFF_ROLES.includes(user.role);
  // (skipped while no SMTP server is configured, so nobody gets locked out by codes that cannot be delivered)
  // emergency switch: set DISABLE_LOGIN_OTP=1 on the server if the mail server breaks
  if ((s.login_otp_enable === '1' || (staff && s.enforce_2fa_staff !== '0')) && process.env.DISABLE_LOGIN_OTP !== '1' && (await mail.isConfigured())) {
    try { await security.sendLoginCode(user); } catch (e) { console.error('[login code]', e.message); fail(502, 'We could not e-mail your sign-in code. Please try again in a moment.'); }
    const challenge = jwt.sign({ sub: user.id, v: user.token_version || 0, p: '2fa', m: 'email' }, jwtSecret, { expiresIn: '10m' });
    const [n, d] = String(user.email).split('@');
    return res.json({ two_factor: true, method: 'email', challenge, email_hint: `${n.slice(0, 2)}***@${d}` });
  }
  await user.update({ last_login_at: new Date() });
  res.clearCookie(IMP_COOKIE, { path: '/' });
  issueToken(res, user);
  return res.json({ user: publicUser(user) });
}

r.post('/login', authLimiter, wrap(async (req, res) => {
  validate(req.body, { email: 'required|email', password: 'required' });
  const user = await User.scope('withSecrets').findOne({ where: { email: String(req.body.email).toLowerCase().trim() } });
  // identical message for unknown e-mail and wrong password (no user enumeration)
  const locked = user ? await security.lockoutState(user) : 0;
  if (locked) fail(429, `Too many failed attempts. Try again in ${locked} minute(s) or reset your password.`);
  if (!user || !(await bcrypt.compare(String(req.body.password), user.password))) {
    if (user) await security.registerFailure(user);
    security.strike(req.ip, 2);
    fail(422, 'These credentials do not match our records.');
  }
  if (!user.is_active) fail(403, 'Your account is deactivated. Please contact the administrator.');
  if (!org.canSignIn(user)) fail(403, org.LOCKED_MESSAGE);
  await security.clearFailures(user);
  await completeLogin(res, user);
}));

/** Send a new e-mail sign-in code for a pending e-mail challenge */
r.post('/two-factor/resend', codeLimiter, wrap(async (req, res) => {
  let payload;
  try { payload = jwt.verify(String(req.body.challenge || ''), jwtSecret); } catch { fail(422, 'Your sign-in session expired, please sign in again'); }
  if (payload.p !== '2fa' || payload.m !== 'email') fail(422, 'Invalid request');
  const user = await User.scope('withSecrets').findByPk(payload.sub);
  if (!user || !user.is_active || !org.canSignIn(user)) fail(422, 'Invalid request');
  await security.sendLoginCode(user);
  res.json({ message: 'A new code has been sent' });
}));

/** Second step: 6-digit authenticator code, a one-time recovery code, or the e-mailed code */
r.post('/two-factor', codeLimiter, wrap(async (req, res) => {
  let payload;
  try { payload = jwt.verify(String(req.body.challenge || ''), jwtSecret); } catch { fail(422, 'Your sign-in session expired, please sign in again'); }
  if (payload.p !== '2fa') fail(422, 'Invalid request');
  const user = await User.scope('withSecrets').findByPk(payload.sub);
  if (!user || !user.is_active || (user.token_version || 0) !== payload.v) fail(422, 'Invalid request');
  if (!org.canSignIn(user)) fail(403, org.LOCKED_MESSAGE);
  const code = String(req.body.code || '').trim();
  if (payload.m === 'email') {
    if (!(await security.checkLoginCode(user, code))) { security.strike(req.ip, 2); fail(422, 'Validation failed', { code: 'The code is invalid or expired' }); }
    await user.update({ last_login_at: new Date() });
    res.clearCookie(IMP_COOKIE, { path: '/' });
    issueToken(res, user);
    return res.json({ user: publicUser(user) });
  }
  let ok = totp.verify(user.two_factor_secret, code);
  if (!ok && code.length > 6) {
    const h = totp.hashCode(code);
    const list = user.two_factor_recovery || [];
    if (list.includes(h)) { ok = true; await user.update({ two_factor_recovery: list.filter((x) => x !== h) }); }
  }
  if (!ok) { security.strike(req.ip, 2); fail(422, 'Validation failed', { code: 'The code is invalid or expired' }); }
  await user.update({ last_login_at: new Date() });
  res.clearCookie(IMP_COOKIE, { path: '/' });
  issueToken(res, user);
  res.json({ user: publicUser(user) });
}));

async function checkBotAndDomain(req) {
  if (!(await extras.verifyRecaptcha(req.body.recaptcha_token, req.ip))) fail(422, 'reCAPTCHA check failed, please try again');
  if (await extras.isBlockedEmail(req.body.email)) fail(422, 'Validation failed', { email: 'This e-mail domain is not allowed' });
}

async function createAccount({ first_name, last_name, email, password, contact, region_code, referral, avatar, verified }) {
  const user = await User.create({
    first_name, last_name, email, role: 'user', contact, region_code, avatar,
    password: await bcrypt.hash(String(password), 12),
    email_verified_at: verified ? new Date() : null,
    affiliate_code: crypto.randomBytes(5).toString('hex'),
  });
  await subs.assignDefaultPlan(user.id);
  if (referral) {
    const affiliator = await User.findOne({ where: { affiliate_code: String(referral) } });
    if (affiliator) {
      const s = await settings.all();
      await AffiliateUser.create({ affiliated_by: affiliator.id, user_id: user.id, amount: Number(s.affiliation_amount || 0), status: 'pending' });
    }
  }
  extras.slack('user_registered', `New user registered: ${first_name} ${last_name} <${email}>`);
  await onboarding.defaultVcard(user);
  return User.scope('withSecrets').findByPk(user.id);
}

r.post('/register', authLimiter, wrap(async (req, res) => {
  const s = await settings.all();
  if (s.register_enable !== '1') fail(403, 'Registration is currently disabled');
  validate(req.body, { first_name: 'required|max:100', last_name: 'required|max:100', email: 'required|email|max:191', password: 'required|min:8|max:100', contact: 'max:30' });
  if (req.body.password !== req.body.password_confirmation) fail(422, 'Validation failed', { password_confirmation: 'Passwords do not match' });
  if (!req.body.terms) fail(422, 'Validation failed', { terms: 'You must accept the terms' });
  await checkBotAndDomain(req);
  const email = String(req.body.email).toLowerCase().trim();
  if (await User.findOne({ where: { email } })) fail(422, 'Validation failed', { email: 'This e-mail is already registered' });
  const needsVerify = s.email_verification_enable === '1';
  const user = await createAccount({ ...pick(req.body, ['first_name', 'last_name', 'password', 'contact', 'region_code', 'referral']), email, verified: !needsVerify });
  if (needsVerify) {
    await sendVerification(user);
    return res.status(201).json({ verify: true, message: 'Account created! We sent you a link to verify your e-mail address.' });
  }
  issueToken(res, user);
  res.status(201).json({ user: publicUser(user) });
}));

/* ---------------------------------------------------- e-mail verification */
r.post('/verify-email', authLimiter, wrap(async (req, res) => {
  validate(req.body, { email: 'required|email', token: 'required' });
  const user = await User.scope('withSecrets').findOne({ where: { email: String(req.body.email).toLowerCase().trim() } });
  const hash = crypto.createHash('sha256').update(String(req.body.token)).digest('hex');
  if (!user || !user.email_verify_token || user.email_verify_token !== hash) fail(422, 'This verification link is invalid or has already been used.');
  await user.update({ email_verified_at: new Date(), email_verify_token: null });
  res.json({ message: 'Your e-mail address is verified. You can sign in now.' });
}));
r.post('/resend-verification', authLimiter, wrap(async (req, res) => {
  validate(req.body, { email: 'required|email' });
  const user = await User.scope('withSecrets').findOne({ where: { email: String(req.body.email).toLowerCase().trim() } });
  if (user && !user.email_verified_at) await sendVerification(user);
  res.json({ message: 'If the account exists and is not verified yet, a new link has been sent.' });
}));

/* ------------------------------------------------------------ Google */
r.post('/google', authLimiter, wrap(async (req, res) => {
  let g;
  try { g = await extras.verifyGoogleIdToken(String(req.body.credential || '')); } catch (e) { fail(422, e.message); }
  let user = await User.scope('withSecrets').findOne({ where: { email: g.email } });
  if (!user) {
    if ((await settings.get('register_enable')) !== '1') fail(403, 'Registration is currently disabled');
    if (await extras.isBlockedEmail(g.email)) fail(422, 'This e-mail domain is not allowed');
    user = await createAccount({ ...g, password: crypto.randomBytes(24).toString('hex'), referral: req.body.referral, verified: true });
  } else if (!user.email_verified_at) await user.update({ email_verified_at: new Date() });
  if (!user.is_active) fail(403, 'Your account is deactivated. Please contact the administrator.');
  if (!org.canSignIn(user)) fail(403, org.LOCKED_MESSAGE);
  await completeLogin(res, user);
}));

r.post('/logout', (req, res) => { clearTokens(res); res.json({ message: 'Logged out' }); });

r.get('/me', wrap(async (req, res) => {
  if (!req.user) return res.json({ user: null });
  res.json({ user: publicUser(req.user, req.impersonator) });
}));

r.post('/forgot-password', authLimiter, wrap(async (req, res) => {
  validate(req.body, { email: 'required|email' });
  const user = await User.scope('withSecrets').findOne({ where: { email: String(req.body.email).toLowerCase().trim() } });
  if (user) {
    const token = crypto.randomBytes(32).toString('hex');
    await user.update({ reset_token: crypto.createHash('sha256').update(token).digest('hex'), reset_expires_at: new Date(Date.now() + 60 * 60 * 1000) });
    await mail.sendTemplate('reset_password', user.email, { name: user.first_name, reset_url: `${clientUrl}/reset-password?token=${token}&email=${encodeURIComponent(user.email)}` });
  }
  res.json({ message: 'If this e-mail is registered, a reset link has been sent.' });
}));

r.post('/reset-password', authLimiter, wrap(async (req, res) => {
  validate(req.body, { email: 'required|email', token: 'required', password: 'required|min:8|max:100' });
  if (req.body.password !== req.body.password_confirmation) fail(422, 'Validation failed', { password_confirmation: 'Passwords do not match' });
  const user = await User.scope('withSecrets').findOne({ where: { email: String(req.body.email).toLowerCase().trim() } });
  const hash = crypto.createHash('sha256').update(String(req.body.token)).digest('hex');
  if (!user || !user.reset_token || user.reset_token !== hash || new Date(user.reset_expires_at) < new Date()) fail(422, 'This password reset link is invalid or has expired.');
  await user.update({ password: await bcrypt.hash(String(req.body.password), 12), reset_token: null, reset_expires_at: null, token_version: (user.token_version || 0) + 1 });
  res.json({ message: 'Your password has been reset. Please sign in.' });
}));

/* ---------------------------------------------------------------- profile */
const avatarUpload = makeUpload('avatars', { maxMb: 5 });
r.put('/profile', requireAuth, avatarUpload.single('avatar'), wrap(async (req, res) => {
  validate(req.body, { first_name: 'required|max:100', last_name: 'required|max:100', email: 'required|email' });
  const data = pick(req.body, ['first_name', 'last_name', 'contact', 'region_code', 'language', 'theme_mode', 'timezone']);
  const email = String(req.body.email).toLowerCase().trim();
  if (email !== req.user.email && (await User.findOne({ where: { email } }))) fail(422, 'Validation failed', { email: 'This e-mail is already registered' });
  data.email = email;
  if (req.file) { removeFile(req.user.avatar); data.avatar = fileUrl('avatars', req.file); }
  if (!req.impersonator) org.stripProfileLocks(req.user, data); // fields locked by the member's organisation
  await req.user.update(data);
  res.json({ user: publicUser(req.user, req.impersonator), message: 'Profile updated successfully' });
}));

r.put('/password', requireAuth, wrap(async (req, res) => {
  validate(req.body, { current_password: 'required', password: 'required|min:8|max:100' });
  if (req.body.password !== req.body.password_confirmation) fail(422, 'Validation failed', { password_confirmation: 'Passwords do not match' });
  if (!(await bcrypt.compare(String(req.body.current_password), req.user.password))) fail(422, 'Validation failed', { current_password: 'Current password is incorrect' });
  const u = await req.user.update({ password: await bcrypt.hash(String(req.body.password), 12), token_version: (req.user.token_version || 0) + 1 });
  issueToken(res, u);
  res.json({ message: 'Password changed successfully' });
}));

/* -------------------------------------------------------- two-factor setup */
r.post('/2fa/setup', requireAuth, wrap(async (req, res) => {
  if (req.user.two_factor_enabled) fail(422, 'Two-factor authentication is already enabled');
  const secret = totp.generateSecret();
  await req.user.update({ two_factor_secret: secret });
  const url = totp.otpauthUrl(secret, req.user.email, (await settings.get('app_name')) || 'InfyVCards');
  res.json({ secret, qr: await QRCode.toDataURL(url, { margin: 1, width: 240 }) });
}));
r.post('/2fa/enable', requireAuth, codeLimiter, wrap(async (req, res) => {
  if (!req.user.two_factor_secret) fail(422, 'Start the setup first');
  if (!totp.verify(req.user.two_factor_secret, req.body.code)) fail(422, 'Validation failed', { code: 'The code is invalid, check your authenticator app' });
  const { codes, hashes } = totp.recoveryCodes();
  await req.user.update({ two_factor_enabled: true, two_factor_recovery: hashes });
  res.json({ recovery_codes: codes, message: 'Two-factor authentication enabled' });
}));
r.post('/2fa/recovery-codes', requireAuth, codeLimiter, wrap(async (req, res) => {
  if (!req.user.two_factor_enabled || !totp.verify(req.user.two_factor_secret, req.body.code)) fail(422, 'Validation failed', { code: 'The code is invalid' });
  const { codes, hashes } = totp.recoveryCodes();
  await req.user.update({ two_factor_recovery: hashes });
  res.json({ recovery_codes: codes, message: 'New recovery codes generated' });
}));
r.post('/2fa/disable', requireAuth, codeLimiter, wrap(async (req, res) => {
  validate(req.body, { password: 'required' });
  if (!(await bcrypt.compare(String(req.body.password), req.user.password))) fail(422, 'Validation failed', { password: 'Password is incorrect' });
  await req.user.update({ two_factor_enabled: false, two_factor_secret: null, two_factor_recovery: [] });
  res.json({ message: 'Two-factor authentication disabled' });
}));

/* ---------------------------------------------------------- announcements */
r.get('/announcements', requireAuth, wrap(async (req, res) => res.json({ data: await require('../services/announcements').visibleFor(req.user) })));
r.post('/announcements/:id/read', requireAuth, wrap(async (req, res) => {
  const { AnnouncementRead } = require('../models');
  await AnnouncementRead.findOrCreate({ where: { announcement_id: Number(req.params.id), user_id: req.user.id } });
  res.json({ ok: true });
}));
r.post('/announcements/read-all', requireAuth, wrap(async (req, res) => {
  const { AnnouncementRead } = require('../models');
  for (const a of await require('../services/announcements').visibleFor(req.user)) if (!a.read) await AnnouncementRead.findOrCreate({ where: { announcement_id: a.id, user_id: req.user.id } });
  res.json({ ok: true });
}));

/* ---------------------------------------------------------- impersonation */
r.post('/leave-impersonation', wrap(async (req, res) => {
  if (!req.impersonator) fail(422, 'You are not impersonating anyone');
  res.cookie(COOKIE, req.cookies[IMP_COOKIE], cookieOpts);
  res.clearCookie(IMP_COOKIE, { path: '/' });
  res.json({ user: publicUser(req.impersonator) });
}));

module.exports = { router: r, publicUser, sendVerification };
