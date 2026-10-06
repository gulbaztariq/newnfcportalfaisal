/* Small cross-cutting services: Slack notifications, reCAPTCHA, blocked e-mail domains, Google sign-in, plan limits */
const fs = require('fs');
const path = require('path');
const dayjs = require('dayjs');
const settings = require('./settings');
const { uploadDir } = require('../config');

/* -------------------------------------------------------------- Slack */
async function slack(event, text) {
  const s = await settings.all();
  if (!s.slack_webhook_url || s.slack_enable !== '1') return;
  const events = String(s.slack_events || 'user_registered,payment,nfc_order,store_order,appointment').split(',');
  if (!events.includes(event)) return;
  try {
    await fetch(s.slack_webhook_url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: `*${s.app_name}* · ${text}` }) });
  } catch (e) { console.error('slack', e.message); }
}

/* ----------------------------------------------------------- reCAPTCHA v3 */
async function verifyRecaptcha(token, ip) {
  const s = await settings.all();
  if (s.recaptcha_enable !== '1' || !s.recaptcha_secret) return true;
  if (!token) return false;
  try {
    const r = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ secret: s.recaptcha_secret, response: token, remoteip: ip || '' }),
    });
    const j = await r.json();
    return !!j.success && (j.score === undefined || j.score >= Number(s.recaptcha_min_score || 0.5));
  } catch { return false; }
}

/* ------------------------------------------------------- blocked domains */
async function isBlockedEmail(email) {
  const list = String((await settings.get('blocked_email_domains')) || '').toLowerCase().split(/[\s,;]+/).filter(Boolean);
  const domain = String(email || '').toLowerCase().split('@')[1];
  return !!domain && list.some((d) => domain === d || domain.endsWith(`.${d}`));
}

/* --------------------------------------------------------- Google sign in */
async function verifyGoogleIdToken(idToken) {
  const s = await settings.all();
  if (s.google_login_enable !== '1' || !s.google_client_id) throw new Error('Google sign-in is disabled');
  const r = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`);
  const j = await r.json();
  if (!r.ok || j.aud !== s.google_client_id || !['accounts.google.com', 'https://accounts.google.com'].includes(j.iss) || j.email_verified !== 'true') {
    throw new Error('Could not verify your Google account');
  }
  return { email: String(j.email).toLowerCase(), first_name: j.given_name || j.name || 'User', last_name: j.family_name || '', avatar: j.picture };
}

/* ------------------------------------------------------------ storage */
function fileSize(url) {
  if (!url || !String(url).startsWith('/uploads/')) return 0;
  try { return fs.statSync(path.join(uploadDir, url.replace('/uploads/', ''))).size; } catch { return 0; }
}
/** throws when the user's plan storage would be exceeded by `bytes` */
async function assertStorage(user, bytes, sub) {
  const limitMb = sub?.plan?.storage_limit;
  if (!limitMb) return;
  if (Number(user.storage_used || 0) + bytes > limitMb * 1024 * 1024) {
    const err = new Error(`Storage limit reached (${limitMb} MB). Delete some files or upgrade your plan.`); err.status = 422; throw err;
  }
}
async function addStorage(user, bytes) { if (bytes) await user.increment('storage_used', { by: bytes }); }
async function freeStorage(userId, url, User) {
  const b = fileSize(url);
  if (b && userId) await User.decrement('storage_used', { by: b, where: { id: userId } });
}

/* --------------------------------------------------------- period window */
function periodStart(sub) { return sub?.starts_at ? dayjs(sub.starts_at).toDate() : dayjs().startOf('month').toDate(); }

module.exports = { slack, verifyRecaptcha, isBlockedEmail, verifyGoogleIdToken, fileSize, assertStorage, addStorage, freeStorage, periodStart };
