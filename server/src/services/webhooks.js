/*
 * Outgoing webhooks. Each owner can register URLs (Zapier "Catch Hook", Make, n8n, their own CRM) that receive a JSON POST
 * when a lead, appointment or newsletter sign-up arrives on one of their cards.
 *  - every request is signed:  X-NFC-Signature: sha256=<hmac of "<timestamp>.<body>" with the webhook secret>
 *  - only public https hosts (no internal network), no redirects, 6 s timeout, delivery log kept (last 50)
 *  - a webhook that fails 10 times in a row pauses itself
 */
const crypto = require('crypto');
const M = require('../models');
const http = require('http');
const https = require('https');
const dns = require('dns');
const { assertPublicUrl, isPrivateIp } = require('./productsync');
const { HttpError } = require('../utils/http');
const { isProd } = require('../config');

const EVENTS = { 'lead.created': 'New enquiry', 'appointment.created': 'New appointment', 'subscriber.created': 'New newsletter subscriber' };
const MAX_FAILS = 10;

const newSecret = () => `whsec_${crypto.randomBytes(24).toString('hex')}`;
const sign = (secret, ts, body) => `sha256=${crypto.createHmac('sha256', secret).update(`${ts}.${body}`).digest('hex')}`;

/** throws a 422 unless the URL is a public https address (http://localhost allowed outside production, for development) */
async function checkUrl(raw) {
  let u;
  try { u = new URL(raw); } catch { throw new HttpError(422, 'Enter a valid web address'); }
  if (!isProd && ['localhost', '127.0.0.1'].includes(u.hostname) && u.protocol === 'http:') return u;
  if (u.protocol !== 'https:') throw new HttpError(422, 'The webhook address must start with https://');
  if (u.username || u.password) throw new HttpError(422, 'Do not put a user name or password in the address');
  return assertPublicUrl(raw);
}


/** POST without following redirects. The address is checked again at connect time (not only when saved), so a host that later
 *  resolves to an internal address (DNS rebinding) is refused. */
function post(urlStr, headers, body, ms = 6000) {
  const u = new URL(urlStr); const lib = u.protocol === 'https:' ? https : http;
  const dev = !isProd && ['localhost', '127.0.0.1'].includes(u.hostname);
  const lookup = (host, opts, cb) => dns.lookup(host, opts, (err, addr, fam) => {
    if (err) return cb(err);
    const list = Array.isArray(addr) ? addr : [{ address: addr, family: fam }];
    if (list.some((a) => isPrivateIp(a.address))) return cb(new Error('This address points to a private network'));
    return Array.isArray(addr) ? cb(null, addr) : cb(null, addr, fam);
  });
  return new Promise((resolve, reject) => {
    const req = lib.request({ protocol: u.protocol, hostname: u.hostname.replace(/^\[|\]$/g, ''), port: u.port || undefined, path: `${u.pathname}${u.search}`, method: 'POST', timeout: ms, headers: { ...headers, 'Content-Length': Buffer.byteLength(body) }, ...(dev ? {} : { lookup }) }, (res) => {
      res.resume(); res.on('end', () => resolve({ status: res.statusCode })); res.on('error', reject);
    });
    req.on('timeout', () => req.destroy(new Error('The server did not answer in time')));
    req.on('error', reject); req.end(body);
  });
}

async function deliver(hook, event, data, { log = true } = {}) {
  const ts = Math.floor(Date.now() / 1000);
  const body = JSON.stringify({ id: crypto.randomUUID(), event, created: new Date().toISOString(), data });
  const t0 = Date.now(); let status = 0; let error = null;
  try {
    await checkUrl(hook.url); // re-checked on every send: DNS may have changed since it was saved
    const res = await post(hook.url, { 'Content-Type': 'application/json', 'User-Agent': 'NFCProfile-Webhook/1.0', 'X-NFC-Event': event, 'X-NFC-Timestamp': String(ts), 'X-NFC-Signature': sign(hook.secret, ts, body) }, body);
    status = res.status;
    if (res.status < 200 || res.status >= 300) error = `The server answered ${res.status}`;
  } catch (e) { error = String(e.message || e).slice(0, 200); }
  const ok = status >= 200 && status < 300;
  if (log) {
    await M.WebhookDelivery.create({ webhook_id: hook.id, event, status, ok, error, ms: Date.now() - t0 }).catch(() => {});
    const keep = await M.WebhookDelivery.findAll({ where: { webhook_id: hook.id }, attributes: ['id'], order: [['id', 'DESC']], offset: 50, raw: true }).catch(() => []);
    if (keep.length) await M.WebhookDelivery.destroy({ where: { id: keep.map((k) => k.id) } }).catch(() => {});
    const failures = ok ? 0 : (hook.failures || 0) + 1;
    await hook.update({ last_status: status, last_at: new Date(), failures, active: failures >= MAX_FAILS ? false : hook.active }).catch(() => {});
  }
  return { ok, status, error, ms: Date.now() - t0 };
}

/** fire-and-forget: tells every active webhook of the card owner that subscribed to this event. Never throws. */
function emit(userId, event, data) {
  (async () => {
    const hooks = await M.Webhook.findAll({ where: { user_id: userId, active: true } });
    await Promise.all(hooks.filter((h) => (h.events || []).includes(event)).map((h) => deliver(h, event, data)));
  })().catch(() => {});
}

const leadPayload = (v, e) => ({ card: { id: v.id, name: v.name, alias: v.url_alias }, lead: { id: e.id, name: e.name, email: e.email, phone: e.phone, message: e.message, about: e.product_name, status: e.status || 'new', created_at: e.created_at } });

module.exports = { EVENTS, newSecret, checkUrl, deliver, emit, sign, leadPayload };
