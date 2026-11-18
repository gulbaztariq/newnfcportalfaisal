/*
 * Security helpers: e-mail login codes, account lockout, automatic IP bans for abusive clients, audit log.
 * Network-level DDoS protection belongs in front of the app (Railway edge / Cloudflare); this layer stops
 * brute force, credential stuffing and request floods that reach the app.
 */
const crypto = require('crypto');
const settings = require('./settings');
const mail = require('./mail');
const { HttpError } = require('../utils/http');
const { jwtSecret } = require('../config');

const hash = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');
// keyed hash for sign-in codes: a leaked database alone cannot be used to brute-force the 1,000,000 possible codes
const otpHash = (s) => crypto.createHmac('sha256', jwtSecret).update(String(s)).digest('hex');
const RESEND_COOLDOWN_S = 60;

/* ------------------------------------------------------------ e-mail login code */
async function sendLoginCode(user, { resend = false } = {}) {
  const minutes = Math.max(1, Number((await settings.get('login_otp_minutes')) || 5));
  const sentAt = user.login_otp_expires_at ? new Date(user.login_otp_expires_at).getTime() - minutes * 60000 : 0;
  const wait = Math.ceil((sentAt + RESEND_COOLDOWN_S * 1000 - Date.now()) / 1000);
  if (resend && user.login_otp_hash && wait > 0) throw new HttpError(429, `Please wait ${wait} seconds before requesting another code`);
  const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
  await user.update({ login_otp_hash: otpHash(`${user.id}:${code}`), login_otp_expires_at: new Date(Date.now() + minutes * 60 * 1000), login_otp_attempts: 0 });
  await mail.sendTemplate('login_code', user.email, { name: user.first_name, code, minutes });
}
/** true when the code matches; burns the code after 5 wrong tries or on success */
async function checkLoginCode(user, code) {
  if (!user.login_otp_hash || !user.login_otp_expires_at || new Date(user.login_otp_expires_at) < new Date()) return false;
  const ok = crypto.timingSafeEqual(Buffer.from(user.login_otp_hash), Buffer.from(otpHash(`${user.id}:${String(code).trim()}`)));
  if (ok) { await user.update({ login_otp_hash: null, login_otp_expires_at: null, login_otp_attempts: 0 }); return true; }
  const attempts = (user.login_otp_attempts || 0) + 1;
  await user.update(attempts >= 5 ? { login_otp_hash: null, login_otp_expires_at: null, login_otp_attempts: 0 } : { login_otp_attempts: attempts });
  return false;
}

/* ------------------------------------------------------------ account lockout */
async function lockoutState(user) {
  return user.locked_until && new Date(user.locked_until) > new Date() ? Math.ceil((new Date(user.locked_until) - Date.now()) / 60000) : 0;
}
async function registerFailure(user) {
  const s = await settings.all();
  const max = Number(s.max_login_attempts || 5);
  const n = (user.failed_logins || 0) + 1;
  if (n >= max) await user.update({ failed_logins: 0, locked_until: new Date(Date.now() + Number(s.lockout_minutes || 15) * 60000) });
  else await user.update({ failed_logins: n });
}
const clearFailures = (user) => ((user.failed_logins || user.locked_until) ? user.update({ failed_logins: 0, locked_until: null }) : null);

/* ------------------------------------------------------------ IP abuse guard */
const strikes = new Map(); // ip -> {n, first}
const banned = new Map(); // ip -> until
const WINDOW = 10 * 60 * 1000;
function strike(ip, weight = 1) {
  if (!ip) return;
  const now = Date.now();
  const e = strikes.get(ip);
  const cur = e && now - e.first < WINDOW ? e : { n: 0, first: now };
  cur.n += weight;
  strikes.set(ip, cur);
  if (cur.n >= 80) { banned.set(ip, now + 30 * 60 * 1000); strikes.delete(ip); console.warn(`[security] temporarily banned ${ip}`); }
  if (strikes.size > 100000) strikes.clear();
}
/** Express middleware: rejects banned IPs, adds strikes for 401/403/404 floods and 429s */
function ipGuard(req, res, next) {
  const until = banned.get(req.ip);
  if (until && until > Date.now()) { res.set('Retry-After', '1800'); return res.status(429).json({ message: 'Too many requests. Try again later.' }); }
  if (until) banned.delete(req.ip);
  res.on('finish', () => {
    if (res.statusCode === 429) strike(req.ip, 1);
    else if (res.statusCode === 401 || res.statusCode === 403) strike(req.ip, 1);
    else if (res.statusCode === 404 && /\.(php|asp|env|git|sql|bak)|wp-|admin\.php/i.test(req.path)) strike(req.ip, 4); // scanners
  });
  next();
}
const bannedList = () => [...banned.entries()].filter(([, u]) => u > Date.now()).map(([ip, u]) => ({ ip, until: new Date(u) }));
const unban = (ip) => banned.delete(ip);

/* ------------------------------------------------------------ audit log */
async function audit(req, action, entity, entityId, meta) {
  req._audited = true; // the generic admin logger (below) skips requests that already wrote a detailed entry
  try {
    const { ActivityLog } = require('../models');
    await ActivityLog.create({ user_id: req.actor?.id || req.user?.id || null, action, entity, entity_id: entityId || null, ip: req.ip, user_agent: String(req.get('user-agent') || '').slice(0, 250), meta: meta || {} });
  } catch (e) { console.error('[audit]', e.message); }
}

/** every admin change is logged: who did what, to which record, with the values (never passwords, tokens or keys) */
const SENSITIVE = /pass|secret|token|key|credential|otp|code|hash|authorization/i;
function safeMeta(body) {
  const out = {};
  for (const [k, v] of Object.entries(body && typeof body === 'object' ? body : {}).slice(0, 25)) {
    if (SENSITIVE.test(k) || v === undefined || v === null || typeof v === 'object') continue;
    out[k] = String(v).slice(0, 160);
  }
  return out;
}
function adminAuditLogger(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  res.on('finish', () => {
    if (res.statusCode >= 400 || req._audited) return;
    // req.path is rewritten by nested routers while the request runs, so the full original URL is used
    const full = String(req.originalUrl || '').split('?')[0].replace(/^\/api\/admin/, '');
    const parts = full.split('/').filter(Boolean);
    const id = parts.find((x, i) => i > 0 && /^\d+$/.test(x)) || null;
    const words = parts.filter((x) => !/^\d+$/.test(x));
    const verb = { POST: 'create', PUT: 'update', PATCH: 'update', DELETE: 'delete' }[req.method] || req.method.toLowerCase();
    // POST /inventory/adjust -> inventory.adjust ; POST /inventory/items -> inventory.items.create ; DELETE /vendors/4 -> vendors.delete
    const named = ['adjust', 'transfer', 'send', 'sync', 'import', 'bulk', 'bulk-delete', 'resend-invite', 'resend-verification', 'reset-authenticator', 'sign-out', 'unlink', 'connect', 'test', 'notify', 'track', 'book', 'refresh', 'db-upgrade', 'default', 'status', 'config', 'qr-config', 'limits', 'reset-price', 'short-link', 'invoice', 'impersonate', 'courier', 'components', 'payments', 'clone'];
    const action = words.length > 1 && named.includes(words.at(-1)) ? words.join('.') : `${words.join('.') || 'admin'}.${verb}`;
    audit(req, action, words[0] || 'admin', id ? Number(id) : null, { path: req.originalUrl.split('?')[0], values: safeMeta(req.body), changed: full.startsWith('/settings') ? Object.keys(req.body || {}).filter((k) => !SENSITIVE.test(k)).slice(0, 40) : undefined });
  });
  next();
}

module.exports = { adminAuditLogger, sendLoginCode, checkLoginCode, lockoutState, registerFailure, clearFailures, ipGuard, strike, bannedList, unban, audit };
