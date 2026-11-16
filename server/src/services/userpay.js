/*
 * Payments that go to a vCard owner (not to the platform): products sold on a card and paid appointments.
 * The buyer is a visitor without an account, so an order is found by its random token, and every payment is confirmed
 * with the gateway's API using the OWNER'S keys before it is marked paid (the browser redirect alone is never trusted).
 */
const crypto = require('crypto');
const { Op } = require('sequelize');
const M = require('../models');
const us = require('./usersettings');
const mail = require('./mail');
const { appUrl } = require('../config');
const { HttpError } = require('../utils/http');

const fail = (msg, status = 422) => { throw new HttpError(status, msg); };
const back = (o) => `${appUrl}/pay/card/${o.token}`;
const J = async (r) => ({ ok: r.ok, j: await r.json().catch(() => ({})) });
const cents = (o) => Math.round(Number(o.amount) * 100);
const ZERO_DECIMAL = ['JPY', 'KRW', 'VND', 'CLP', 'UGX', 'XAF', 'XOF', 'PYG', 'RWF'];
const minor = (o) => (ZERO_DECIMAL.includes(String(o.currency_code).toUpperCase()) ? Math.round(Number(o.amount)) : cents(o));

const G = {
  stripe: {
    async start(o, k) {
      const session = await require('stripe')(k.stripe_secret).checkout.sessions.create({
        mode: 'payment', customer_email: o.customer_email || undefined, client_reference_id: o.order_number,
        line_items: [{ quantity: 1, price_data: { currency: o.currency_code.toLowerCase(), unit_amount: minor(o), product_data: { name: `${o.item_name}${o.quantity > 1 ? ` x ${o.quantity}` : ''}` } } }],
        success_url: back(o), cancel_url: `${back(o)}?cancelled=1`,
      });
      return { ref: session.id, url: session.url };
    },
    async paid(o, k) {
      const s = await require('stripe')(k.stripe_secret).checkout.sessions.retrieve(o.gateway_ref);
      return s.payment_status === 'paid' && s.amount_total >= minor(o);
    },
  },
  paypal: {
    async api(k) {
      const base = k.paypal_mode === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';
      const r = await fetch(`${base}/v1/oauth2/token`, { method: 'POST', body: 'grant_type=client_credentials', headers: { Authorization: `Basic ${Buffer.from(`${k.paypal_client_id}:${k.paypal_secret}`).toString('base64')}`, 'Content-Type': 'application/x-www-form-urlencoded' }, signal: AbortSignal.timeout(20000) });
      if (!r.ok) fail('Could not connect to PayPal', 502);
      return { base, h: { Authorization: `Bearer ${(await r.json()).access_token}`, 'Content-Type': 'application/json' } };
    },
    async start(o, k) {
      const { base, h } = await this.api(k);
      const { ok, j } = await J(await fetch(`${base}/v2/checkout/orders`, { method: 'POST', headers: h, body: JSON.stringify({ intent: 'CAPTURE', purchase_units: [{ reference_id: o.order_number, description: o.item_name.slice(0, 120), amount: { currency_code: o.currency_code, value: Number(o.amount).toFixed(2) } }], application_context: { return_url: back(o), cancel_url: `${back(o)}?cancelled=1` } }) }));
      if (!ok) fail(j.message || 'PayPal error', 502);
      return { ref: j.id, url: j.links.find((l) => l.rel === 'approve').href };
    },
    async paid(o, k) {
      const { base, h } = await this.api(k);
      const { ok, j } = await J(await fetch(`${base}/v2/checkout/orders/${encodeURIComponent(o.gateway_ref)}/capture`, { method: 'POST', headers: h }));
      const cap = j.purchase_units?.[0]?.payments?.captures?.[0];
      if (ok && j.status === 'COMPLETED') return Number(cap?.amount?.value) + 0.01 >= Number(o.amount);
      const g = await J(await fetch(`${base}/v2/checkout/orders/${encodeURIComponent(o.gateway_ref)}`, { headers: h })); // already captured on an earlier visit
      return g.j.status === 'COMPLETED';
    },
  },
  paystack: {
    async start(o, k) {
      const reference = `vo_${o.id}_${crypto.randomBytes(4).toString('hex')}`;
      const { ok, j } = await J(await fetch('https://api.paystack.co/transaction/initialize', { method: 'POST', headers: { Authorization: `Bearer ${k.paystack_secret}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: o.customer_email, amount: cents(o), currency: o.currency_code, reference, callback_url: back(o) }) }));
      if (!ok || !j.status) fail(j.message || 'Paystack error', 502);
      return { ref: reference, url: j.data.authorization_url };
    },
    async paid(o, k) {
      const { j } = await J(await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(o.gateway_ref)}`, { headers: { Authorization: `Bearer ${k.paystack_secret}` } }));
      return j.data?.status === 'success' && j.data.amount >= cents(o);
    },
  },
  flutterwave: {
    async start(o, k) {
      const ref = `vo_${o.id}_${crypto.randomBytes(4).toString('hex')}`;
      const { ok, j } = await J(await fetch('https://api.flutterwave.com/v3/payments', { method: 'POST', headers: { Authorization: `Bearer ${k.flutterwave_secret}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ tx_ref: ref, amount: Number(o.amount), currency: o.currency_code, redirect_url: back(o), customer: { email: o.customer_email, name: o.customer_name, phonenumber: o.customer_phone || undefined }, customizations: { title: o.item_name.slice(0, 80) }, payment_options: 'card,mobilemoney,ussd,banktransfer' }) }));
      if (!ok || j.status !== 'success') fail(j.message || 'Flutterwave error', 502);
      return { ref, url: j.data.link };
    },
    async paid(o, k, q) {
      const h = { Authorization: `Bearer ${k.flutterwave_secret}` };
      const { j } = q.transaction_id
        ? await J(await fetch(`https://api.flutterwave.com/v3/transactions/${encodeURIComponent(q.transaction_id)}/verify`, { headers: h }))
        : await J(await fetch(`https://api.flutterwave.com/v3/transactions/verify_by_reference?tx_ref=${encodeURIComponent(o.gateway_ref)}`, { headers: h }));
      return j.data?.status === 'successful' && j.data.tx_ref === o.gateway_ref && Number(j.data.amount) + 0.01 >= Number(o.amount) && j.data.currency === o.currency_code;
    },
  },
  razorpay: {
    auth: (k) => `Basic ${Buffer.from(`${k.razorpay_key}:${k.razorpay_secret}`).toString('base64')}`,
    async start(o, k) {
      const { ok, j } = await J(await fetch('https://api.razorpay.com/v1/payment_links', { method: 'POST', headers: { Authorization: this.auth(k), 'Content-Type': 'application/json' }, body: JSON.stringify({ amount: cents(o), currency: o.currency_code, reference_id: o.order_number, description: o.item_name.slice(0, 200), customer: { name: o.customer_name, email: o.customer_email || undefined, contact: o.customer_phone || undefined }, callback_url: back(o), callback_method: 'get' }) }));
      if (!ok) fail(j.error?.description || 'Razorpay error', 502);
      return { ref: j.id, url: j.short_url };
    },
    async paid(o, k) {
      const { j } = await J(await fetch(`https://api.razorpay.com/v1/payment_links/${encodeURIComponent(o.gateway_ref)}`, { headers: { Authorization: this.auth(k) } }));
      return j.status === 'paid' && j.amount_paid >= cents(o);
    },
  },
};

const orderNumber = () => `VO-${Date.now().toString(36).toUpperCase()}${crypto.randomBytes(2).toString('hex').toUpperCase()}`;

/** creates the order and, for online methods, the hosted payment page. Returns { order, url? , guide? } */
async function begin(vcard, fields, methodId) {
  const all = await us.full(vcard.user_id);
  const method = us.methodsOf(all).find((m) => m.id === methodId);
  if (!method) fail('This payment method is not available');
  if (methodId !== 'manual' && ['paystack', 'flutterwave'].includes(methodId) && !fields.customer_email) fail('Please enter your e-mail address for this payment method');
  const o = await M.VcardOrder.create({ ...fields, vcard_id: vcard.id, order_number: orderNumber(), token: crypto.randomBytes(24).toString('hex'), gateway: methodId });
  if (methodId === 'manual') return { order: o, guide: method.guide };
  try {
    const { ref, url } = await G[methodId].start(o, all);
    await o.update({ gateway_ref: ref });
    return { order: o, url };
  } catch (e) {
    await o.update({ payment_status: 'failed' });
    if (e instanceof HttpError) throw e;
    console.error('[userpay]', methodId, e.message);
    fail('The payment page could not be opened. Please try another method.', 502);
  }
}

/** after the buyer returns from the gateway: confirm with the gateway, then mark paid once */
async function confirm(token, query = {}) {
  const o = await M.VcardOrder.findOne({ where: { token: String(token || '') }, include: [{ model: M.Vcard, include: [{ model: M.User, attributes: ['id', 'email', 'first_name'] }] }] });
  if (!o) fail('Order not found', 404);
  if (o.payment_status === 'paid' || o.gateway === 'manual' || !G[o.gateway] || !o.gateway_ref) return o;
  if (query.cancelled) return o;
  const all = await us.full(o.vcard.user_id);
  let ok = false;
  try { ok = await G[o.gateway].paid(o, all, query); } catch (e) { console.error('[userpay] verify', o.gateway, e.message); }
  if (!ok) return o;
  const [claimed] = await M.VcardOrder.update({ payment_status: 'paid' }, { where: { id: o.id, payment_status: { [Op.ne]: 'paid' } } });
  o.payment_status = 'paid';
  if (claimed) await onPaid(o);
  return o;
}

async function onPaid(o) {
  if (o.kind === 'appointment' && o.appointment_id) await M.Appointment.update({ paid: true }, { where: { id: o.appointment_id } });
  notify(o, 'paid').catch(() => {});
}

/** e-mails the owner (unless switched off) and the customer */
async function notify(o, event) {
  const vcard = o.vcard || await M.Vcard.findByPk(o.vcard_id, { include: [{ model: M.User, attributes: ['id', 'email'] }] });
  const all = await us.full(vcard.user_id);
  const vals = { order: o.order_number, item: o.item_name, quantity: o.quantity, amount: `${o.currency_code} ${Number(o.amount).toFixed(2)}`, customer: o.customer_name, contact: [o.customer_email, o.customer_phone].filter(Boolean).join(' · '), address: o.customer_address || '-', vcard: vcard.name, status: event === 'paid' ? 'paid' : o.gateway === 'manual' ? 'awaiting payment' : 'pending', notes: o.notes || '' };
  if (all.order_emails !== '0' && vcard.user?.email) await mail.sendTemplate('vcard_order_owner', vcard.user.email, vals).catch(() => {});
  if (o.customer_email) await mail.sendTemplate('vcard_order_customer', o.customer_email, vals, { ownerId: vcard.user_id }).catch(() => {});
}

module.exports = { begin, confirm, notify, _G: G };
