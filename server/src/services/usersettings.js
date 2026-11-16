/*
 * A user's own settings: display preferences, their payment gateways (so visitors pay them directly for vCard products and
 * paid appointments) and their own mail server. Secret values are sealed with AES-256-GCM and are write-only for the browser.
 */
const crypto = require('crypto');
const M = require('../models');
const { jwtSecret } = require('../config');

const KEY = crypto.createHash('sha256').update(`user-settings:${process.env.SETTINGS_KEY || jwtSecret}`).digest();
function seal(obj) {
  const iv = crypto.randomBytes(12); const c = crypto.createCipheriv('aes-256-gcm', KEY, iv);
  const body = Buffer.concat([c.update(JSON.stringify(obj), 'utf8'), c.final()]);
  return [iv, c.getAuthTag(), body].map((b) => b.toString('base64')).join('.');
}
function open(text) {
  if (!text) return {};
  try {
    const [iv, tag, body] = String(text).split('.').map((x) => Buffer.from(x, 'base64'));
    const d = crypto.createDecipheriv('aes-256-gcm', KEY, iv); d.setAuthTag(tag);
    return JSON.parse(Buffer.concat([d.update(body), d.final()]).toString('utf8'));
  } catch { return {}; } // key changed or damaged value: treat as not configured
}

// plain values the owner can read back
const PLAIN = ['currency_code', 'time_format', 'order_emails', 'manual_enable', 'manual_guide',
  'stripe_enable', 'paypal_enable', 'paypal_mode', 'paypal_client_id', 'paystack_enable', 'flutterwave_enable', 'razorpay_enable', 'razorpay_key',
  'smtp_enable', 'smtp_host', 'smtp_port', 'smtp_user', 'smtp_from_name', 'smtp_from_email', 'smtp_secure'];
// write-only values
const SECRET = ['stripe_secret', 'paypal_secret', 'paystack_secret', 'flutterwave_secret', 'razorpay_secret', 'smtp_password'];
const GATEWAYS = { stripe: ['stripe_secret'], paypal: ['paypal_client_id', 'paypal_secret'], paystack: ['paystack_secret'], flutterwave: ['flutterwave_secret'], razorpay: ['razorpay_key', 'razorpay_secret'] };
const LABELS = { stripe: 'Card (Stripe)', paypal: 'PayPal', paystack: 'Paystack', flutterwave: 'Flutterwave', razorpay: 'Razorpay', manual: 'Bank transfer / cash' };

/** everything, secrets included: server-side use only */
async function full(userId) {
  const row = await M.UserSetting.findOne({ where: { user_id: userId } });
  return { ...(row?.data || {}), ...open(row?.secrets) };
}
/** safe for the owner's browser: secrets become true/false */
async function view(userId) {
  const all = await full(userId);
  const out = {}; for (const k of PLAIN) out[k] = all[k] ?? '';
  for (const k of SECRET) out[`has_${k}`] = !!all[k];
  out.methods = methodsOf(all);
  return out;
}
async function save(userId, body) {
  const [row] = await M.UserSetting.findOrCreate({ where: { user_id: userId }, defaults: { data: {} } });
  const data = { ...(row.data || {}) }; const secrets = open(row.secrets);
  for (const k of PLAIN) if (body[k] !== undefined) data[k] = typeof body[k] === 'boolean' ? (body[k] ? '1' : '0') : String(body[k] ?? '').trim().slice(0, k === 'manual_guide' ? 3000 : 300);
  for (const k of SECRET) { const v = String(body[k] ?? '').trim(); if (v) secrets[k] = v.slice(0, 500); if (body[`clear_${k}`]) delete secrets[k]; }
  await row.update({ data, secrets: seal(secrets) });
  return view(userId);
}
/** payment methods a visitor can choose on this owner's cards */
function methodsOf(all) {
  const list = Object.entries(GATEWAYS).filter(([g, need]) => all[`${g}_enable`] === '1' && need.every((k) => all[k])).map(([g]) => ({ id: g, label: LABELS[g] }));
  if (all.manual_enable === '1') list.push({ id: 'manual', label: LABELS.manual, guide: all.manual_guide || '' });
  return list;
}
async function methods(userId) { return methodsOf(await full(userId)); }

module.exports = { full, view, save, methods, methodsOf, PLAIN, SECRET, LABELS, seal, open };
