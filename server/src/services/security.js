/*
 * Security helpers: e-mail login codes, account lockout, automatic IP bans for abusive clients, audit log.
 * Network-level DDoS protection belongs in front of the app (Railway edge / Cloudflare); this layer stops
 * brute force, credential stuffing and request floods that reach the app.
 */
const crypto = require('crypto');
const settings = require('./settings');
const mail = require('./mail');

const hash = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');

/* ------------------------------------------------------------ e-mail login code */
async function sendLoginCode(user) {
  const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
  await user.update({ login_otp_hash: hash(`${user.id}:${code}`), login_otp_expires_at: new Date(Date.now() + 10 * 60 * 1000), login_otp_attempts: 0 });
  await mail.sendTemplate('login_code', user.email, { name: user.first_name, code });
}
/** true when the code matches; burns the code after 5 wrong tries or on success */
async function checkLoginCode(user, code) {
  if (!user.login_otp_hash || !user.login_otp_expires_at || new Date(user.login_otp_expires_at) < new Date()) return false;
  const ok = crypto.timingSafeEqual(Buffer.from(user.login_otp_hash), Buffer.from(hash(`${user.id}:${String(code).trim()}`)));
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
  try {
    const { ActivityLog } = require('../models');
    await ActivityLog.create({ user_id: req.actor?.id || req.user?.id || null, action, entity, entity_id: entityId || null, ip: req.ip, user_agent: String(req.get('user-agent') || '').slice(0, 250), meta: meta || {} });
  } catch (e) { console.error('[audit]', e.message); }
}

module.exports = { sendLoginCode, checkLoginCode, lockoutState, registerFailure, clearFailures, ipGuard, strike, bannedList, unban, audit };
