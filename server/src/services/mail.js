/*
 * E-mail: SMTP credentials come from Settings > Mail (falls back to MAIL_* env vars, then to console logging).
 * Every system e-mail uses an editable template (Settings > Email Templates) with {{placeholders}}.
 */
const nodemailer = require('nodemailer');
const { mail } = require('../config');
const settings = require('./settings');

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

let cached = { key: null, transport: null };
async function transport() {
  const s = await settings.all();
  const host = s.mail_host || mail.host;
  const key = JSON.stringify([host, s.mail_port, s.mail_username, s.mail_password, s.mail_encryption]);
  if (cached.key === key) return cached.transport;
  const t = host
    ? nodemailer.createTransport({
      host, port: Number(s.mail_port || mail.port || 587), secure: (s.mail_encryption || (mail.secure ? 'ssl' : 'tls')) === 'ssl',
      auth: (s.mail_username || mail.user) ? { user: s.mail_username || mail.user, pass: s.mail_password || mail.password } : undefined,
    })
    : nodemailer.createTransport({ jsonTransport: true });
  cached = { key, transport: t, live: !!host };
  return t;
}

async function layout(title, bodyHtml) {
  const s = await settings.all();
  return `<!doctype html><html><body style="margin:0;background:#f4f4fb;font-family:Inter,Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 12px">
  <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;max-width:100%">
  <tr><td style="background:linear-gradient(135deg,#6d5dfc,#b44cf5);color:#fff;padding:22px 28px;font-size:20px;font-weight:bold">${esc(s.app_name)}</td></tr>
  <tr><td style="padding:28px;color:#27273a;font-size:15px;line-height:1.6"><h2 style="margin-top:0;font-size:20px">${esc(title)}</h2>${bodyHtml}</td></tr>
  <tr><td style="padding:16px 28px;color:#9a9ab5;font-size:12px;border-top:1px solid #eee">&copy; ${new Date().getFullYear()} ${esc(s.app_name)}</td></tr>
  </table></td></tr></table></body></html>`;
}

/** html: trusted HTML (already sanitised / escaped by the caller) */
async function send({ to, subject, html, bcc, attachments }) {
  const s = await settings.all();
  const from = s.mail_from_address ? `${s.mail_from_name || s.app_name} <${s.mail_from_address}>` : mail.from;
  const t = await transport();
  const info = await t.sendMail({ from, to, bcc, subject, html: await layout(subject, html), attachments });
  if (!cached.live) console.log(`[mail:dev] to=${to || ''} bcc=${(bcc || []).length || ''} subject="${subject}"`);
  return info;
}

/** default templates - admins can override subject/body in Settings > Email Templates */
const TEMPLATES = {
  welcome: { subject: 'Welcome to {{app_name}}', body: '<p>Hello {{name}},</p><p>An account has been created for you.</p><p><b>E-mail:</b> {{email}}<br><b>Password:</b> {{password}}</p><p><a href="{{login_url}}">Sign in</a> and change your password.</p>' },
  verify_email: { subject: 'Verify your e-mail address', body: '<p>Hello {{name}},</p><p>Please confirm your e-mail address to activate your account.</p><p><a href="{{verify_url}}" style="background:#6d5dfc;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">Verify e-mail</a></p>' },
  reset_password: { subject: 'Reset your password', body: '<p>Click the button below to reset your password. The link expires in 60 minutes.</p><p><a href="{{reset_url}}" style="background:#6d5dfc;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">Reset password</a></p>' },
  plan_expiring: { subject: 'Your {{plan}} plan expires in {{days}} day(s), on {{date}}', body: '<p>Hello {{name}},</p><p>Your <b>{{plan}}</b> plan expires on <b>{{date}}</b> (in {{days}} day(s)). Renew now to keep your vCards online.</p><p><a href="{{plans_url}}">Renew plan</a></p>' },
  payment_status: { subject: 'Payment {{status}}', body: '<p>Your payment of <b>{{amount}}</b> has been <b>{{status}}</b>.</p>' },
  nfc_status: { subject: 'NFC order {{order}} is {{status}}', body: '<p>Your NFC card order <b>{{order}}</b> status is now <b>{{status}}</b>.</p>' },
  appointment_booked: { subject: 'New appointment on {{date}}', body: '<p><b>{{customer}}</b> booked an appointment on <b>{{date}}</b> at <b>{{time}}</b> via {{vcard}}.</p><p>{{notes}}</p>' },
  appointment_status: { subject: 'Your appointment is {{status}}', body: '<p>Hello {{customer}},</p><p>Your appointment on <b>{{date}}</b> at <b>{{time}}</b> with {{vcard}} is <b>{{status}}</b>.</p>' },
  enquiry_received: { subject: 'New enquiry from {{customer}}', body: '<p>You received a new enquiry on <b>{{vcard}}</b>.</p><p><b>{{customer}}</b> ({{contact}})</p><p>{{message}}</p>' },
  login_code: { subject: 'Your sign-in code: {{code}}', body: '<p>Hello {{name}},</p><p>Use this code to finish signing in. It expires in 10 minutes.</p><p style="font-size:30px;font-weight:bold;letter-spacing:8px">{{code}}</p><p>If this was not you, change your password right away.</p>' },
  order_placed: { subject: 'Order {{order}} received', body: '<p>Hello {{name}},</p><p>Thank you! We received your order <b>{{order}}</b> for <b>{{total}}</b> ({{payment}}).</p><p>Track it any time: <a href="{{track_url}}">{{track_url}}</a></p>' },
  invoice_sent: { subject: 'Invoice {{number}} from {{app_name}}', body: '<p>Hello {{name}},</p><p>Please find invoice <b>{{number}}</b> for <b>{{total}}</b>, due on <b>{{due}}</b>.</p><p><a href="{{invoice_url}}" style="background:#6d5dfc;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">View invoice</a></p>' },
  announcement: { subject: '{{title}}', body: '<p>Hello {{name}},</p>{{body_html}}' },
  store_order: { subject: 'New order {{order}} on {{store}}', body: '<p>A new order <b>{{order}}</b> worth <b>{{total}}</b> was placed on <b>{{store}}</b> by {{customer}}.</p>' },
};

/** send a template; values are HTML-escaped (except keys ending in _url which are escaped as attributes) */
async function sendTemplate(key, to, values = {}) {
  const s = await settings.all();
  const t = TEMPLATES[key];
  const subject = s[`mail_tpl_${key}_subject`] || t.subject;
  const body = s[`mail_tpl_${key}_body`] || t.body;
  const vals = { app_name: s.app_name, ...values };
  const fill = (str, html) => str.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => (vals[k] === undefined ? '' : html && !k.endsWith('_html') ? esc(vals[k]) : String(vals[k])));
  return send({ to, subject: fill(subject, false), html: fill(body, true) });
}

/** true when a real SMTP server is configured (otherwise mail is only logged) */
async function isConfigured() { const s = await settings.all(); return !!(s.mail_host || mail.host); }

module.exports = { send, sendTemplate, esc, TEMPLATES, isConfigured };
