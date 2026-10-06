/*
 * WhatsApp + SMS notifications for order steps (placed, confirmed, designing, printing, ready, dispatched, delivered...).
 * Providers (Settings > WhatsApp & SMS):
 *   WhatsApp: meta (WhatsApp Business Cloud API), twilio, http (any gateway, URL/body template)
 *   SMS:      twilio, http (any gateway, e.g. local Pakistani SMS providers)
 * Each event has an editable text with {{placeholders}}, and for Meta an optional approved template name
 * (business-initiated WhatsApp messages outside the 24h window must use approved templates).
 */
const settings = require('./settings');

const EVENTS = {
  order_placed: { label: 'Order placed', text: 'Hi {{name}}, thank you for your order {{order}} ({{total}}, {{payment}}). We will confirm it shortly. Track: {{track_url}}' },
  order_confirmed: { label: 'Order confirmed', text: 'Hi {{name}}, your order {{order}} is confirmed. Track: {{track_url}}' },
  order_designing: { label: 'Designing', text: 'Hi {{name}}, our designers are working on your order {{order}}.' },
  order_printing: { label: 'Printing', text: 'Hi {{name}}, your order {{order}} is now being printed.' },
  order_ready: { label: 'Ready to dispatch', text: 'Hi {{name}}, your order {{order}} is packed and ready to dispatch.' },
  order_shipped: { label: 'Dispatched', text: 'Hi {{name}}, your order {{order}} has been dispatched via {{courier}}. Tracking no: {{tracking}}. {{payment_note}}' },
  order_delivered: { label: 'Delivered', text: 'Hi {{name}}, your order {{order}} has been delivered. Thank you for choosing {{app_name}}!' },
  order_returned: { label: 'Returned', text: 'Hi {{name}}, your order {{order}} was returned to us. Please contact us to re-deliver.' },
  order_cancelled: { label: 'Cancelled', text: 'Hi {{name}}, your order {{order}} has been cancelled. Contact us if this is a mistake.' },
  admin_order_placed: { label: 'Admin: new order', text: 'New order {{order}} from {{name}} ({{phone}}) - {{total}} {{payment}}. City: {{city}}' },
  admin_order_shipped: { label: 'Admin: order dispatched', text: 'Order {{order}} dispatched via {{courier}}, tracking {{tracking}}, COD {{cod}}.' },
};
const CUSTOMER_DEFAULT = new Set(['order_placed', 'order_confirmed', 'order_shipped', 'order_delivered']);

function normalizePhone(phone, region) {
  let d = String(phone || '').replace(/[^\d+]/g, '');
  if (!d) return '';
  if (d.startsWith('+')) return d.slice(1);
  if (d.startsWith('00')) return d.slice(2);
  if (d.startsWith('0')) return `${String(region || '92').replace(/\D/g, '')}${d.slice(1)}`;
  return d;
}

const fill = (tpl, vals) => String(tpl || '').replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => (vals[k] === undefined || vals[k] === null ? '' : String(vals[k])));
const placeholders = (tpl) => (String(tpl).match(/\{\{\s*\w+\s*\}\}/g) || []).map((x) => x.replace(/[{}\s]/g, ''));

/** gateway templates accept {to} / {message} (and {{to}} / {{message}}) */
const fillGateway = (tpl, vals) => String(tpl || '').replace(/\{\{?\s*(\w+)\s*\}?\}/g, (m, k) => (k in vals ? String(vals[k]) : m));

async function httpGateway({ url, method, body, headers }, vals) {
  const u = fillGateway(url, Object.fromEntries(Object.entries(vals).map(([k, v]) => [k, encodeURIComponent(v)])));
  const init = { method: method || 'GET', signal: AbortSignal.timeout(15000), headers: {} };
  if (headers) { try { Object.assign(init.headers, JSON.parse(headers)); } catch { /* ignore bad JSON */ } }
  if (init.method !== 'GET' && body) {
    init.body = fillGateway(body, Object.fromEntries(Object.entries(vals).map(([k, v]) => [k, JSON.stringify(String(v)).slice(1, -1)])));
    if (!init.headers['Content-Type']) init.headers['Content-Type'] = /^\s*[{[]/.test(init.body) ? 'application/json' : 'application/x-www-form-urlencoded';
  }
  const r = await fetch(u, init);
  const t = (await r.text()).slice(0, 300);
  if (!r.ok) throw new Error(`HTTP ${r.status} ${t}`);
  return t;
}

async function twilio(s, from, to, body) {
  const auth = Buffer.from(`${s.twilio_sid}:${s.twilio_token}`).toString('base64');
  const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(s.twilio_sid)}/Messages.json`, {
    method: 'POST', headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ From: from, To: to, Body: body }), signal: AbortSignal.timeout(15000),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.message || `Twilio HTTP ${r.status}`);
}

async function sendWhatsapp(to, text, { event, vals } = {}) {
  const s = await settings.all();
  const provider = s.whatsapp_provider || 'meta';
  if (provider === 'meta') {
    if (!s.whatsapp_phone_number_id || !s.whatsapp_access_token) throw new Error('WhatsApp Cloud API is not configured');
    const tplName = event && s[`wa_tpl_${event}`];
    const payload = tplName
      ? { messaging_product: 'whatsapp', to, type: 'template', template: { name: tplName, language: { code: s.whatsapp_template_language || 'en' }, components: [{ type: 'body', parameters: placeholders(s[`msg_tpl_${event}`] || EVENTS[event].text).map((k) => ({ type: 'text', text: String(vals?.[k] ?? '-') || '-' })) }] } }
      : { messaging_product: 'whatsapp', to, type: 'text', text: { body: text, preview_url: true } };
    const r = await fetch(`https://graph.facebook.com/${s.whatsapp_api_version || 'v21.0'}/${encodeURIComponent(s.whatsapp_phone_number_id)}/messages`, {
      method: 'POST', headers: { Authorization: `Bearer ${s.whatsapp_access_token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal: AbortSignal.timeout(15000),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error?.message || `WhatsApp HTTP ${r.status}`);
    return;
  }
  if (provider === 'twilio') return twilio(s, `whatsapp:+${String(s.twilio_whatsapp_from || '').replace(/\D/g, '')}`, `whatsapp:+${to}`, text);
  return httpGateway({ url: s.whatsapp_http_url, method: s.whatsapp_http_method, body: s.whatsapp_http_body, headers: s.whatsapp_http_headers }, { to, message: text });
}

async function sendSms(to, text) {
  const s = await settings.all();
  if ((s.sms_provider || 'http') === 'twilio') return twilio(s, s.twilio_sms_from, `+${to}`, text);
  if (!s.sms_http_url) throw new Error('SMS gateway URL is not configured');
  return httpGateway({ url: s.sms_http_url, method: s.sms_http_method, body: s.sms_http_body, headers: s.sms_http_headers }, { to, message: text });
}

async function log(entry) { try { await require('../models').MessageLog.create(entry); } catch (e) { console.error('[messaging]', e.message); } }

/** Deliver one message on one channel and log it */
async function deliver(channel, rawTo, text, meta = {}) {
  const s = await settings.all();
  const to = normalizePhone(rawTo, s.phone_default_region || '92');
  if (!to) return;
  const enabled = channel === 'whatsapp' ? s.whatsapp_enable === '1' : s.sms_enable === '1';
  if (!enabled) return log({ channel, to, event: meta.event, body: text, status: 'skipped', error: `${channel} disabled`, nfc_order_id: meta.orderId });
  try {
    if (channel === 'whatsapp') await sendWhatsapp(to, text, meta); else await sendSms(to, text);
    await log({ channel, to, event: meta.event, body: text, status: 'sent', nfc_order_id: meta.orderId });
  } catch (e) {
    await log({ channel, to, event: meta.event, body: text, status: 'failed', error: String(e.message).slice(0, 480), nfc_order_id: meta.orderId });
  }
}

/** Fire an order event: customer + admin recipients according to Settings > Notifications */
async function orderEvent(event, order, extra = {}) {
  if (!EVENTS[event]) return;
  const s = await settings.all();
  const { appUrl } = require('../config');
  const cur = s.shop_currency_icon || 'Rs';
  const vals = {
    app_name: s.app_name, name: order.name, phone: order.phone, city: order.city || '', order: order.order_number,
    status: order.order_status, total: `${cur} ${Number(order.amount).toLocaleString('en-US')}`,
    payment: order.is_cod ? 'Cash on delivery' : order.payment_status === 'paid' ? 'Paid' : 'Payment pending',
    payment_note: order.is_cod && order.payment_status !== 'paid' ? `Please keep ${cur} ${Number(order.amount).toLocaleString('en-US')} ready (COD).` : '',
    cod: order.is_cod ? `${cur} ${Number(order.amount).toLocaleString('en-US')}` : 'No',
    courier: order.courier === 'leopards' ? 'Leopards Courier' : order.courier || 'courier', tracking: order.tracking_number || '-',
    track_url: order.access_token ? `${appUrl}/track/${order.order_number}?t=${order.access_token}` : `${appUrl}/track`,
    ...extra,
  };
  const text = fill(s[`msg_tpl_${event}`] || EVENTS[event].text, vals);
  const on = (key, def) => (s[key] === undefined || s[key] === '' ? def : s[key] === '1');
  const jobs = [];
  if (event.startsWith('admin_')) {
    const admins = String(s.notify_admin_numbers || '').split(/[\s,;]+/).filter(Boolean);
    for (const n of admins) {
      if (on(`notify_${event}_whatsapp`, true)) jobs.push(deliver('whatsapp', n, text, { event, vals, orderId: order.id }));
      if (on(`notify_${event}_sms`, false)) jobs.push(deliver('sms', n, text, { event, vals, orderId: order.id }));
    }
  } else if (order.phone) {
    if (on(`notify_${event}_whatsapp`, CUSTOMER_DEFAULT.has(event))) jobs.push(deliver('whatsapp', order.phone, text, { event, vals, orderId: order.id }));
    if (on(`notify_${event}_sms`, event === 'order_shipped')) jobs.push(deliver('sms', order.phone, text, { event, vals, orderId: order.id }));
  }
  await Promise.all(jobs);
}

module.exports = { EVENTS, orderEvent, deliver, normalizePhone, sendWhatsapp, sendSms };
