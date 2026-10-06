/**
 * Payment gateways. Each gateway implements createCheckout(ctx) -> { url } (hosted payment page) and
 * verify(query, user) -> confirms the payment with the gateway API (never trusts the redirect alone).
 * Return URLs go through /pay/return/:gateway on this server (some gateways POST back), which redirects
 * to the React success page that calls verify.
 */
const crypto = require('crypto');
const M = require('../models');
const settings = require('./settings');
const subs = require('./subscription');
const { clientUrl, appUrl } = require('../config');
const { HttpError } = require('../utils/http');

const returnUrl = (g) => `${appUrl}/pay/return/${g}`;
const cancelUrl = (ctx) => `${clientUrl}/user/${ctx.purpose === 'subscription' ? 'plans' : 'nfc-orders'}?cancelled=1`;
const fail = (msg) => { throw new HttpError(422, msg); };
const round2 = (n) => Math.round(Number(n) * 100) / 100;

async function currencyCode(plan) {
  const id = plan?.currency_id || (await settings.get('default_currency_id'));
  if (id) { const c = await M.Currency.findByPk(id); if (c) return c.currency_code; }
  return 'USD';
}
function describe(ctx) {
  if (ctx.purpose === 'subscription') return { name: `${ctx.plan.name} plan`, amount: round2(ctx.quote.total) };
  return { name: `NFC card order ${ctx.order.order_number}`, amount: round2(ctx.order.amount) };
}
async function pendingTransaction(ctx, type) {
  const d = describe(ctx);
  return M.Transaction.create({
    user_id: ctx.user.id, amount: d.amount, type, status: 'pending', purpose: ctx.purpose,
    tax_amount: ctx.purpose === 'subscription' ? ctx.quote.tax : ctx.order.tax_amount || 0,
    meta: ctx.purpose === 'subscription' ? { plan_id: ctx.plan.id, discount: ctx.quote.discount, tax: ctx.quote.tax, coupon: ctx.quote.coupon } : { nfc_order_id: ctx.order.id },
  });
}

/** Called once the gateway confirmed payment. Idempotent. */
async function fulfil(t, paidAmount) {
  if (t.status === 'paid') return;
  if (paidAmount !== undefined && Number(paidAmount) + 0.01 < Number(t.amount)) fail('The paid amount does not match the order');
  await t.update({ status: 'paid' });
  if (t.purpose === 'subscription') {
    const plan = await M.Plan.findByPk(t.meta.plan_id);
    await subs.activate(t.user_id, plan, { transactionId: t.id, paymentType: t.type, amount: t.amount, discount: t.meta.discount || 0, tax: t.meta.tax || 0, coupon: t.meta.coupon || null });
    await subs.consumeCoupon(t.meta.coupon);
  } else {
    await M.NfcOrder.update({ payment_status: 'paid', transaction_id: t.id }, { where: { id: t.meta.nfc_order_id } });
  }
  require('./extras').slack('payment', `Payment of ${t.amount} received via ${t.type} (#${t.id})`);
  if (t.purpose === 'subscription' && (await settings.get('invoice_auto_subscriptions')) !== '0') require('./invoices').fromTransaction(t.id).catch((e) => console.error('[invoice]', e.message));
}
const findTx = async (ref, user, type) => {
  const t = await M.Transaction.findOne({ where: { transaction_id: String(ref || ''), user_id: user.id, type } });
  if (!t) throw new HttpError(404, 'Transaction not found');
  return t;
};
const done = (t) => ({ message: 'Payment successful', purpose: t.purpose });
async function cfg(prefix, required) {
  const s = await settings.all();
  if (s[`${prefix}_enable`] !== '1' || required.some((k) => !s[`${prefix}_${k}`])) fail(`${prefix[0].toUpperCase()}${prefix.slice(1)} is not configured`);
  return s;
}
async function json(resp) { const j = await resp.json().catch(() => ({})); return { ok: resp.ok, j }; }

/* ------------------------------------------------------------------ Stripe */
const stripe = {
  async client() { const s = await cfg('stripe', ['secret']); return require('stripe')(s.stripe_secret); },
  async createCheckout(ctx) {
    const client = await this.client();
    const d = describe(ctx);
    const t = await pendingTransaction(ctx, 'stripe');
    const session = await client.checkout.sessions.create({
      mode: 'payment', customer_email: ctx.user.email, client_reference_id: String(t.id),
      line_items: [{ quantity: 1, price_data: { currency: (await currencyCode(ctx.plan)).toLowerCase(), unit_amount: Math.round(d.amount * 100), product_data: { name: d.name } } }],
      success_url: `${clientUrl}/user/payment/stripe/success?session_id={CHECKOUT_SESSION_ID}`, cancel_url: cancelUrl(ctx),
    });
    await t.update({ transaction_id: session.id });
    return { url: session.url };
  },
  async verify(q, user) {
    const client = await this.client();
    const session = await client.checkout.sessions.retrieve(String(q.session_id || ''));
    const t = await findTx(session.id, user, 'stripe');
    if (session.payment_status !== 'paid') fail('Payment was not completed');
    await fulfil(t, session.amount_total / 100);
    return done(t);
  },
};

/* ------------------------------------------------------------------ PayPal */
const paypal = {
  async token() {
    const s = await cfg('paypal', ['client_id', 'secret']);
    const base = s.paypal_mode === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';
    const r = await fetch(`${base}/v1/oauth2/token`, { method: 'POST', body: 'grant_type=client_credentials', headers: { Authorization: `Basic ${Buffer.from(`${s.paypal_client_id}:${s.paypal_secret}`).toString('base64')}`, 'Content-Type': 'application/x-www-form-urlencoded' } });
    if (!r.ok) throw new HttpError(502, 'Could not connect to PayPal');
    return { base, token: (await r.json()).access_token };
  },
  async createCheckout(ctx) {
    const { base, token } = await this.token();
    const d = describe(ctx);
    const t = await pendingTransaction(ctx, 'paypal');
    const { ok, j } = await json(await fetch(`${base}/v2/checkout/orders`, {
      method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ intent: 'CAPTURE', purchase_units: [{ reference_id: String(t.id), description: d.name, amount: { currency_code: await currencyCode(ctx.plan), value: d.amount.toFixed(2) } }], application_context: { return_url: returnUrl('paypal'), cancel_url: cancelUrl(ctx) } }),
    }));
    if (!ok) throw new HttpError(502, j.message || 'PayPal error');
    await t.update({ transaction_id: j.id });
    return { url: j.links.find((l) => l.rel === 'approve').href };
  },
  async verify(q, user) {
    const { base, token } = await this.token();
    const t = await findTx(q.token, user, 'paypal');
    if (t.status !== 'paid') {
      const { ok, j } = await json(await fetch(`${base}/v2/checkout/orders/${encodeURIComponent(t.transaction_id)}/capture`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }));
      if (!ok || j.status !== 'COMPLETED') fail('Payment was not completed');
      await fulfil(t, j.purchase_units?.[0]?.payments?.captures?.[0]?.amount?.value);
    }
    return done(t);
  },
};

/* ---------------------------------------------------------------- Paystack */
const paystack = {
  async createCheckout(ctx) {
    const s = await cfg('paystack', ['secret']);
    const d = describe(ctx);
    const t = await pendingTransaction(ctx, 'paystack');
    const reference = `vc_${t.id}_${crypto.randomBytes(4).toString('hex')}`;
    const { ok, j } = await json(await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST', headers: { Authorization: `Bearer ${s.paystack_secret}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: ctx.user.email, amount: Math.round(d.amount * 100), currency: await currencyCode(ctx.plan), reference, callback_url: returnUrl('paystack') }),
    }));
    if (!ok || !j.status) throw new HttpError(502, j.message || 'Paystack error');
    await t.update({ transaction_id: reference });
    return { url: j.data.authorization_url };
  },
  async verify(q, user) {
    const s = await cfg('paystack', ['secret']);
    const t = await findTx(q.reference || q.trxref, user, 'paystack');
    const { j } = await json(await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(t.transaction_id)}`, { headers: { Authorization: `Bearer ${s.paystack_secret}` } }));
    if (j.data?.status !== 'success') fail('Payment was not completed');
    await fulfil(t, j.data.amount / 100);
    return done(t);
  },
};

/* ------------------------------------------------------------- Flutterwave */
const flutterwave = {
  async createCheckout(ctx) {
    const s = await cfg('flutterwave', ['secret']);
    const d = describe(ctx);
    const t = await pendingTransaction(ctx, 'flutterwave');
    const ref = `vc_${t.id}_${crypto.randomBytes(4).toString('hex')}`;
    const { ok, j } = await json(await fetch('https://api.flutterwave.com/v3/payments', {
      method: 'POST', headers: { Authorization: `Bearer ${s.flutterwave_secret}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ tx_ref: ref, amount: d.amount, currency: await currencyCode(ctx.plan), redirect_url: returnUrl('flutterwave'), customer: { email: ctx.user.email, name: ctx.user.fullName() }, customizations: { title: d.name }, payment_options: 'card,mobilemoney,ussd,banktransfer' }),
    }));
    if (!ok || j.status !== 'success') throw new HttpError(502, j.message || 'Flutterwave error');
    await t.update({ transaction_id: ref });
    return { url: j.data.link };
  },
  async verify(q, user) {
    const s = await cfg('flutterwave', ['secret']);
    const t = await findTx(q.tx_ref, user, 'flutterwave');
    if (q.status && q.status !== 'successful' && q.status !== 'completed') fail('Payment was not completed');
    const { j } = await json(await fetch(`https://api.flutterwave.com/v3/transactions/${encodeURIComponent(q.transaction_id)}/verify`, { headers: { Authorization: `Bearer ${s.flutterwave_secret}` } }));
    if (j.data?.status !== 'successful' || j.data.tx_ref !== t.transaction_id) fail('Payment was not completed');
    await fulfil(t, j.data.amount);
    return done(t);
  },
};

/* ---------------------------------------------------------------- Razorpay */
const razorpay = {
  auth: (s) => `Basic ${Buffer.from(`${s.razorpay_key}:${s.razorpay_secret}`).toString('base64')}`,
  async createCheckout(ctx) {
    const s = await cfg('razorpay', ['key', 'secret']);
    const d = describe(ctx);
    const t = await pendingTransaction(ctx, 'razorpay');
    const { ok, j } = await json(await fetch('https://api.razorpay.com/v1/payment_links', {
      method: 'POST', headers: { Authorization: this.auth(s), 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: Math.round(d.amount * 100), currency: await currencyCode(ctx.plan), reference_id: `vc_${t.id}`, description: d.name, customer: { name: ctx.user.fullName(), email: ctx.user.email }, callback_url: returnUrl('razorpay'), callback_method: 'get' }),
    }));
    if (!ok) throw new HttpError(502, j.error?.description || 'Razorpay error');
    await t.update({ transaction_id: j.id });
    return { url: j.short_url };
  },
  async verify(q, user) {
    const s = await cfg('razorpay', ['key', 'secret']);
    const t = await findTx(q.razorpay_payment_link_id, user, 'razorpay');
    const expected = crypto.createHmac('sha256', s.razorpay_secret).update(`${q.razorpay_payment_link_id}|${q.razorpay_payment_link_reference_id}|${q.razorpay_payment_link_status}|${q.razorpay_payment_id}`).digest('hex');
    if (expected !== q.razorpay_signature) fail('Invalid payment signature');
    const { j } = await json(await fetch(`https://api.razorpay.com/v1/payment_links/${encodeURIComponent(t.transaction_id)}`, { headers: { Authorization: this.auth(s) } }));
    if (j.status !== 'paid') fail('Payment was not completed');
    await fulfil(t, j.amount_paid / 100);
    return done(t);
  },
};

/* ------------------------------------------------------------- MercadoPago */
const mercadopago = {
  async createCheckout(ctx) {
    const s = await cfg('mercadopago', ['access_token']);
    const d = describe(ctx);
    const t = await pendingTransaction(ctx, 'mercadopago');
    const ref = `vc_${t.id}`;
    const { ok, j } = await json(await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST', headers: { Authorization: `Bearer ${s.mercadopago_access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: [{ title: d.name, quantity: 1, unit_price: d.amount, currency_id: await currencyCode(ctx.plan) }], payer: { email: ctx.user.email }, external_reference: ref, back_urls: { success: returnUrl('mercadopago'), failure: cancelUrl(ctx), pending: returnUrl('mercadopago') }, auto_return: 'approved' }),
    }));
    if (!ok) throw new HttpError(502, j.message || 'MercadoPago error');
    await t.update({ transaction_id: ref });
    return { url: s.mercadopago_access_token.startsWith('TEST-') ? j.sandbox_init_point || j.init_point : j.init_point };
  },
  async verify(q, user) {
    const s = await cfg('mercadopago', ['access_token']);
    const t = await findTx(q.external_reference, user, 'mercadopago');
    const { j } = await json(await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(q.payment_id || q.collection_id)}`, { headers: { Authorization: `Bearer ${s.mercadopago_access_token}` } }));
    if (j.status !== 'approved' || j.external_reference !== t.transaction_id) fail('Payment was not completed');
    await fulfil(t, j.transaction_amount);
    return done(t);
  },
};

/* ---------------------------------------------------------------- Cashfree */
const cashfree = {
  base: (s) => (s.cashfree_mode === 'live' ? 'https://api.cashfree.com/pg' : 'https://sandbox.cashfree.com/pg'),
  headers: (s) => ({ 'x-client-id': s.cashfree_app_id, 'x-client-secret': s.cashfree_secret, 'x-api-version': '2023-08-01', 'Content-Type': 'application/json' }),
  async createCheckout(ctx) {
    const s = await cfg('cashfree', ['app_id', 'secret']);
    const d = describe(ctx);
    const t = await pendingTransaction(ctx, 'cashfree');
    const linkId = `vc_${t.id}_${crypto.randomBytes(3).toString('hex')}`;
    const { ok, j } = await json(await fetch(`${this.base(s)}/links`, {
      method: 'POST', headers: this.headers(s),
      body: JSON.stringify({ link_id: linkId, link_amount: d.amount, link_currency: await currencyCode(ctx.plan), link_purpose: d.name, customer_details: { customer_email: ctx.user.email, customer_name: ctx.user.fullName(), customer_phone: String(ctx.user.contact || '9999999999').replace(/\D/g, '').slice(-10) || '9999999999' }, link_meta: { return_url: `${returnUrl('cashfree')}?link_id=${linkId}` } }),
    }));
    if (!ok) throw new HttpError(502, j.message || 'Cashfree error');
    await t.update({ transaction_id: linkId });
    return { url: j.link_url };
  },
  async verify(q, user) {
    const s = await cfg('cashfree', ['app_id', 'secret']);
    const t = await findTx(q.link_id, user, 'cashfree');
    const { j } = await json(await fetch(`${this.base(s)}/links/${encodeURIComponent(t.transaction_id)}`, { headers: this.headers(s) }));
    if (j.link_status !== 'PAID') fail('Payment was not completed');
    await fulfil(t, j.link_amount_paid);
    return done(t);
  },
};

/* -------------------------------------------------------------- SSLCommerz */
const sslcommerz = {
  base: (s) => (s.sslcommerz_mode === 'live' ? 'https://securepay.sslcommerz.com' : 'https://sandbox.sslcommerz.com'),
  async createCheckout(ctx) {
    const s = await cfg('sslcommerz', ['store_id', 'store_password']);
    const d = describe(ctx);
    const t = await pendingTransaction(ctx, 'sslcommerz');
    const tranId = `vc_${t.id}_${crypto.randomBytes(3).toString('hex')}`;
    const body = new URLSearchParams({
      store_id: s.sslcommerz_store_id, store_passwd: s.sslcommerz_store_password, total_amount: d.amount.toFixed(2), currency: await currencyCode(ctx.plan), tran_id: tranId,
      success_url: returnUrl('sslcommerz'), fail_url: cancelUrl(ctx), cancel_url: cancelUrl(ctx),
      cus_name: ctx.user.fullName(), cus_email: ctx.user.email, cus_phone: ctx.user.contact || '01700000000', cus_add1: 'N/A', cus_city: 'N/A', cus_country: 'Bangladesh',
      shipping_method: 'NO', product_name: d.name, product_category: 'Service', product_profile: 'non-physical-goods',
    });
    const { j } = await json(await fetch(`${this.base(s)}/gwprocess/v4/api.php`, { method: 'POST', body }));
    if (j.status !== 'SUCCESS') throw new HttpError(502, j.failedreason || 'SSLCommerz error');
    await t.update({ transaction_id: tranId });
    return { url: j.GatewayPageURL };
  },
  async verify(q, user) {
    const s = await cfg('sslcommerz', ['store_id', 'store_password']);
    const t = await findTx(q.tran_id, user, 'sslcommerz');
    const url = `${this.base(s)}/validator/api/validationserverAPI.php?val_id=${encodeURIComponent(q.val_id || '')}&store_id=${encodeURIComponent(s.sslcommerz_store_id)}&store_passwd=${encodeURIComponent(s.sslcommerz_store_password)}&format=json`;
    const { j } = await json(await fetch(url));
    if (!['VALID', 'VALIDATED'].includes(j.status) || j.tran_id !== t.transaction_id) fail('Payment was not completed');
    await fulfil(t, j.amount);
    return done(t);
  },
};

/* ----------------------------------------------------------------- PayFast */
const payfast = {
  host: (s) => (s.payfast_mode === 'live' ? 'https://www.payfast.co.za' : 'https://sandbox.payfast.co.za'),
  sign(params, passphrase) {
    const str = Object.entries(params).filter(([, v]) => v !== '' && v !== undefined).map(([k, v]) => `${k}=${encodeURIComponent(String(v).trim()).replace(/%20/g, '+')}`).join('&');
    return crypto.createHash('md5').update(passphrase ? `${str}&passphrase=${encodeURIComponent(passphrase.trim()).replace(/%20/g, '+')}` : str).digest('hex');
  },
  async createCheckout(ctx) {
    const s = await cfg('payfast', ['merchant_id', 'merchant_key']);
    const d = describe(ctx);
    const t = await pendingTransaction(ctx, 'payfast');
    const ref = `vc_${t.id}`;
    await t.update({ transaction_id: ref });
    const params = {
      merchant_id: s.payfast_merchant_id, merchant_key: s.payfast_merchant_key,
      return_url: `${returnUrl('payfast')}?m_payment_id=${ref}`, cancel_url: cancelUrl(ctx), notify_url: `${appUrl}/pay/notify/payfast`,
      email_address: ctx.user.email, m_payment_id: ref, amount: d.amount.toFixed(2), item_name: d.name.slice(0, 100),
    };
    params.signature = this.sign(params, s.payfast_passphrase);
    return { url: `${this.host(s)}/eng/process?${new URLSearchParams(params)}` };
  },
  /** server-to-server ITN: validates signature + amount with PayFast, then fulfils */
  async notify(body) {
    const s = await cfg('payfast', ['merchant_id', 'merchant_key']);
    const { signature, ...rest } = body;
    if (this.sign(rest, s.payfast_passphrase) !== signature) fail('Invalid signature');
    const check = await fetch(`${this.host(s)}/eng/query/validate`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(body) });
    if ((await check.text()).trim() !== 'VALID') fail('PayFast validation failed');
    const t = await M.Transaction.findOne({ where: { transaction_id: String(body.m_payment_id || ''), type: 'payfast' } });
    if (t && body.payment_status === 'COMPLETE') await fulfil(t, body.amount_gross);
  },
  async verify(q, user) {
    const t = await findTx(q.m_payment_id, user, 'payfast');
    await t.reload();
    if (t.status !== 'paid') return { message: 'Payment received - it will be confirmed by PayFast in a moment. Refresh this page shortly.', purpose: t.purpose, pending: true };
    return done(t);
  },
};

/* ----------------------------------------------------------------- PhonePe */
const phonepe = {
  base: (s) => (s.phonepe_env === 'PROD' ? 'https://api.phonepe.com/apis/hermes' : 'https://api-preprod.phonepe.com/apis/pg-sandbox'),
  xverify: (s, payloadOrEmpty, path) => `${crypto.createHash('sha256').update(payloadOrEmpty + path + s.phonepe_salt_key).digest('hex')}###${s.phonepe_salt_index || 1}`,
  async createCheckout(ctx) {
    const s = await cfg('phonepe', ['merchant_id', 'salt_key']);
    const d = describe(ctx);
    const t = await pendingTransaction(ctx, 'phonepe');
    const mtid = `VC${t.id}${crypto.randomBytes(3).toString('hex')}`.slice(0, 35);
    const payload = Buffer.from(JSON.stringify({ merchantId: s.phonepe_merchant_id, merchantTransactionId: mtid, merchantUserId: `U${ctx.user.id}`, amount: Math.round(d.amount * 100), redirectUrl: `${returnUrl('phonepe')}?mtid=${mtid}`, redirectMode: 'REDIRECT', callbackUrl: `${returnUrl('phonepe')}?mtid=${mtid}`, paymentInstrument: { type: 'PAY_PAGE' } })).toString('base64');
    const { j } = await json(await fetch(`${this.base(s)}/pg/v1/pay`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-VERIFY': this.xverify(s, payload, '/pg/v1/pay') }, body: JSON.stringify({ request: payload }) }));
    if (!j.success) throw new HttpError(502, j.message || 'PhonePe error');
    await t.update({ transaction_id: mtid });
    return { url: j.data.instrumentResponse.redirectInfo.url };
  },
  async verify(q, user) {
    const s = await cfg('phonepe', ['merchant_id', 'salt_key']);
    const t = await findTx(q.mtid, user, 'phonepe');
    const path = `/pg/v1/status/${s.phonepe_merchant_id}/${t.transaction_id}`;
    const { j } = await json(await fetch(`${this.base(s)}${path}`, { headers: { 'Content-Type': 'application/json', 'X-VERIFY': this.xverify(s, '', path), 'X-MERCHANT-ID': s.phonepe_merchant_id } }));
    if (j.code !== 'PAYMENT_SUCCESS') fail('Payment was not completed');
    await fulfil(t, j.data.amount / 100);
    return done(t);
  },
};

/* ------------------------------------------------------------------ Iyzico */
const iyzico = {
  base: (s) => (s.iyzico_mode === 'live' ? 'https://api.iyzipay.com' : 'https://sandbox-api.iyzipay.com'),
  async call(s, path, bodyObj) {
    const body = JSON.stringify(bodyObj);
    const rnd = `${Date.now()}${crypto.randomBytes(4).toString('hex')}`;
    const sig = crypto.createHmac('sha256', s.iyzico_secret).update(rnd + path + body).digest('hex');
    const auth = Buffer.from(`apiKey:${s.iyzico_api_key}&randomKey:${rnd}&signature:${sig}`).toString('base64');
    return json(await fetch(`${this.base(s)}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `IYZWSv2 ${auth}`, 'x-iyzi-rnd': rnd }, body }));
  },
  async createCheckout(ctx) {
    const s = await cfg('iyzico', ['api_key', 'secret']);
    const d = describe(ctx);
    const t = await pendingTransaction(ctx, 'iyzico');
    const conv = `vc_${t.id}`;
    const price = d.amount.toFixed(2);
    const addr = { contactName: ctx.user.fullName(), city: 'Istanbul', country: 'Turkey', address: 'N/A' };
    const { j } = await this.call(s, '/payment/iyzipos/checkoutform/initialize/auth/ecom', {
      locale: 'en', conversationId: conv, price, paidPrice: price, currency: await currencyCode(ctx.plan), basketId: conv, paymentGroup: 'PRODUCT',
      callbackUrl: returnUrl('iyzico'),
      buyer: { id: `U${ctx.user.id}`, name: ctx.user.first_name, surname: ctx.user.last_name || ctx.user.first_name, email: ctx.user.email, identityNumber: '11111111111', registrationAddress: 'N/A', city: 'Istanbul', country: 'Turkey', ip: '85.34.78.112' },
      shippingAddress: addr, billingAddress: addr,
      basketItems: [{ id: conv, name: d.name, category1: 'Service', itemType: 'VIRTUAL', price }],
    });
    if (j.status !== 'success') throw new HttpError(502, j.errorMessage || 'Iyzico error');
    await t.update({ transaction_id: j.token });
    return { url: j.paymentPageUrl };
  },
  async verify(q, user) {
    const s = await cfg('iyzico', ['api_key', 'secret']);
    const t = await findTx(q.token, user, 'iyzico');
    const { j } = await this.call(s, '/payment/iyzipos/checkoutform/auth/ecom/detail', { locale: 'en', token: t.transaction_id });
    if (j.paymentStatus !== 'SUCCESS') fail('Payment was not completed');
    await fulfil(t, j.paidPrice);
    return done(t);
  },
};

const gateways = { stripe, paypal, paystack, flutterwave, razorpay, mercadopago, cashfree, sslcommerz, payfast, phonepe, iyzico };
const NAMES = Object.keys(gateways);

module.exports = {
  NAMES,
  createCheckout(type, ctx) { const g = gateways[type]; if (!g) fail('Unknown payment method'); return g.createCheckout(ctx); },
  verify(type, query, user) { const g = gateways[type]; if (!g) fail('Unknown payment method'); return g.verify(query, user); },
  payfastNotify: (body) => payfast.notify(body),
};
