/*
 * Orders (NFC products from the shop, the user portal or created by admins):
 * pricing (variants, customisation, tax, delivery, COD charges), creation, workflow steps with history,
 * notifications (e-mail + WhatsApp/SMS), stock consumption and invoices.
 */
const crypto = require('crypto');
const dayjs = require('dayjs');
const { Op } = require('sequelize');
const settings = require('./settings');
const messaging = require('./messaging');
const inventory = require('./inventory');
const mail = require('./mail');
const { HttpError } = require('../utils/http');

const M = () => require('../models');
const r2 = (n) => Math.round(Number(n || 0) * 100) / 100;

const STEPS = ['pending', 'confirmed', 'designing', 'printing', 'ready', 'shipped', 'delivered'];
const ALL_STATUSES = [...STEPS, 'processing', 'returned', 'cancelled'];
const LABELS = { pending: 'Pending', confirmed: 'Confirmed', designing: 'Designing', printing: 'Printing', processing: 'Processing', ready: 'Ready to dispatch', shipped: 'Dispatched', delivered: 'Delivered', returned: 'Returned', cancelled: 'Cancelled' };

/** Placeholder e-mail on our own domain, for customers without an e-mail address (admin orders) */
async function dummyDomain() {
  const s = await settings.all();
  if (s.dummy_email_domain) return String(s.dummy_email_domain).trim().replace(/^@/, '').toLowerCase();
  const host = new URL(require('../config').appUrl).hostname;
  return host.includes('.') ? host.replace(/^www\./, '') : `${host}.local`;
}
async function isDummyEmail(email) { return String(email || '').toLowerCase().endsWith(`@${await dummyDomain()}`); }

const orderNumber = () => `ORD-${dayjs().format('YYMMDD')}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

/**
 * Price a cart. lines: [{product_id, quantity, variant, customization, unit_price?}]
 * returns { lines:[{product, name, variant, quantity, unit_price, customization, customization_price, total}], subtotal, discount, tax, delivery, cod, total }
 * Admin-only options (never passed by the website shop): priceOverride (use each line's unit_price), discountType + discountValue
 * (fixed amount or percent), delivery (manual delivery charges) and collection (customer collects at the office: no delivery / COD fee).
 */
/** Wholesale tiers: [{min, percent}] sorted by min. A product can override the global tiers from the settings. */
function parseTiers(raw) {
  let t = raw;
  if (typeof t === 'string') { try { t = JSON.parse(t); } catch { t = []; } }
  return (Array.isArray(t) ? t : []).map((x) => ({ min: Math.max(1, parseInt(x?.min, 10) || 0), percent: Math.min(100, Math.max(0, Number(x?.percent) || 0)) })).filter((x) => x.min > 0).sort((a, b) => a.min - b.min);
}
const tierFor = (tiers, qty) => tiers.filter((x) => x.min <= qty).at(-1) || null;
/** Product price after its own discount (fixed or percent) */
const afterDiscount = (price, type, value) => {
  const v = Math.max(0, Number(value) || 0);
  return Math.max(0, r2(type === 'percent' ? price * (1 - Math.min(100, v) / 100) : price - (type === 'fixed' ? v : 0)));
};

/** Order types: what each one needs. Used by the order wizard and by quote(). */
const ORDER_TYPES = {
  nfc_profile: { label: 'NFC Business Card', physical: true },
  social: { label: 'Social / review card', physical: true },
  wholesale: { label: 'Wholesale (bulk)', physical: true },
  sample: { label: 'Samples before bulk', physical: true },
  card_printing: { label: 'Card + printing (no profile)', physical: true },
  printing: { label: 'Printing only', physical: true },
  reprint: { label: 'Card reprinting (metal / wood / PVC...)', physical: true },
  digital: { label: 'Digital profile only', physical: false },
  renewal: { label: 'Plan renewal', physical: false },
  upgrade: { label: 'Plan upgrade', physical: false },
  contact_tag: { label: 'Car contact tag (number hidden)', physical: true },
  airport_tag: { label: 'Airport tag (luggage)', physical: true },
};
const NO_SHIP_TYPES = ['digital', 'renewal', 'upgrade']; // nothing is delivered: no delivery or COD charge

async function quote(lines, { is_cod = false, discount = 0, discountType, discountValue, delivery: deliveryOverride, collection = false, priceOverride = false, orderType = 'nfc_profile', sampleCredit = 0, planCredit = 0 } = {}) {
  const s = await settings.all();
  const type = ORDER_TYPES[orderType] ? orderType : 'nfc_profile';
  const globalTiers = parseTiers(s.wholesale_tiers);
  const sampleMarkup = Math.max(0, Number(s.sample_markup_percent) || 0);
  const sampleMax = Math.max(1, parseInt(s.sample_max_qty, 10) || 5);
  const warnings = [];
  const { NfcCard, Plan } = M();
  const out = [];
  for (const l of (Array.isArray(lines) ? lines : []).slice(0, 50)) {
    const p = await NfcCard.findOne({ where: { id: l.product_id, status: true }, include: [{ model: Plan, as: 'plan', attributes: ['id', 'name', 'frequency'] }] });
    if (!p) throw new HttpError(422, 'A product in your cart is no longer available');
    const qty = Math.min(1000, Math.max(1, parseInt(l.quantity, 10) || 1));
    const variant = (p.variants || []).find((v) => v.name === l.variant) || null;
    if ((p.variants || []).length && !variant) throw new HttpError(422, `Choose an option for ${p.name}`);
    const basePrice = r2(Number(p.price) + Number(variant?.price_delta || 0));
    const discounted = afterDiscount(basePrice, p.discount_type, p.discount_value); // the product's own discount
    let listPrice = discounted; let tierPercent = 0;
    if (type === 'sample') {
      if (qty > sampleMax) throw new HttpError(422, `Samples are limited to ${sampleMax} pieces per product (${p.name})`);
      // a sample costs more than a normal piece: its own price, or the normal price plus the sample markup
      listPrice = Number(p.sample_price) > 0 ? r2(Number(p.sample_price) + Number(variant?.price_delta || 0)) : r2(basePrice * (1 + sampleMarkup / 100));
    } else if (type === 'wholesale') {
      const tiers = p.no_wholesale_tiers ? [] : parseTiers(p.wholesale_tiers).length ? parseTiers(p.wholesale_tiers) : globalTiers; // switched off: the price is already a wholesale price
      const tier = tierFor(tiers, qty);
      tierPercent = tier?.percent || 0;
      listPrice = r2(discounted * (1 - tierPercent / 100));
      if (tiers.length && qty < tiers[0].min) warnings.push(`${p.name}: wholesale pricing starts at ${tiers[0].min} pieces`);
    }
    const own = priceOverride && l.unit_price !== undefined && l.unit_price !== null && l.unit_price !== '' ? r2(l.unit_price) : null;
    if (own !== null && (Number.isNaN(own) || own < 0)) throw new HttpError(422, `Enter a valid price for ${p.name}`);
    const unit = own ?? listPrice;
    const custom = !!l.customization && Number(p.customization_price) > 0;
    const cPrice = custom ? r2(p.customization_price) : 0;
    out.push({ product: p, name: p.name, variant: variant?.name || null, quantity: qty, list_price: listPrice, base_price: basePrice, tier_percent: tierPercent, unit_price: unit, customization: custom, customization_price: cPrice, total: r2((unit + cPrice) * qty), plan: p.plan ? { id: p.plan.id, name: p.plan.name } : null });
  }
  if (!out.length) throw new HttpError(422, 'Your cart is empty');
  const subtotal = r2(out.reduce((a, l) => a + l.total, 0));
  const dVal = Math.max(0, r2(discountValue ?? discount));
  const dType = discountType === 'percent' ? 'percent' : 'fixed';
  const disc = Math.min(subtotal, dType === 'percent' ? r2((subtotal * Math.min(100, dVal)) / 100) : dVal);
  // sample credit: what the customer paid for samples is deducted from the bulk order
  const credit = type === 'wholesale' ? Math.min(Math.max(0, r2(sampleCredit)), r2(subtotal - disc)) : 0;
  // plan upgrade: the unused time of the current plan comes off the price
  const pcredit = type === 'upgrade' ? Math.min(Math.max(0, r2(planCredit)), r2(subtotal - disc)) : 0;
  const tax = r2(((subtotal - disc - credit - pcredit) * Number(s.nfc_tax_rate || 0)) / 100);
  const freeAbove = Number(s.free_delivery_above || 0);
  const autoDelivery = freeAbove > 0 && subtotal - disc >= freeAbove ? 0 : r2(s.delivery_charges || 0);
  const manual = deliveryOverride !== undefined && deliveryOverride !== null && deliveryOverride !== '' ? Math.max(0, r2(deliveryOverride)) : null;
  const noShip = collection || !ORDER_TYPES[type].physical; // digital profiles ship nothing
  const delivery = noShip ? 0 : manual ?? autoDelivery;
  const cod = is_cod && !noShip ? r2(s.cod_charges || 0) : 0;
  return {
    lines: out, order_type: type, sample_credit: credit, plan_credit: pcredit, warnings, subtotal, discount: disc, discount_type: dType, discount_value: dVal, tax, delivery, delivery_default: autoDelivery, cod,
    total: r2(subtotal - disc - credit - pcredit + tax + delivery + cod), tax_name: s.nfc_tax_name || 'Tax', tax_rate: Number(s.nfc_tax_rate || 0),
  };
}

/** Create an order + its items. data: customer fields, source, user_id, vcard_id, design fields */
async function create(data, q) {
  const { NfcOrder, NfcOrderItem, sequelize } = M();
  const first = q.lines[0];
  const order = await sequelize.transaction(async (t) => {
    const o = await NfcOrder.create({
      ...data,
      order_number: orderNumber(), access_token: crypto.randomBytes(16).toString('hex'),
      nfc_card_id: first.product.id, quantity: q.lines.reduce((a, l) => a + l.quantity, 0), unit_price: first.unit_price,
      order_type: q.order_type || 'nfc_profile', sample_credit: q.sample_credit || 0, plan_credit: q.plan_credit || 0, subtotal: q.subtotal, discount: q.discount, discount_type: q.discount ? q.discount_type : null, discount_value: q.discount ? q.discount_value : 0, tax_amount: q.tax, delivery_charges: q.delivery, cod_charges: q.cod, amount: q.total,
      status_history: [{ status: 'pending', at: new Date(), by: data.source === 'shop' ? 'customer' : 'system' }],
    }, { transaction: t });
    for (const l of q.lines) {
      await NfcOrderItem.create({ nfc_order_id: o.id, nfc_card_id: l.product.id, name: l.name, variant: l.variant, quantity: l.quantity, unit_price: l.unit_price, customization: l.customization, customization_price: l.customization_price, total: l.total }, { transaction: t });
    }
    return o;
  });
  const s = await settings.all();
  const { appUrl } = require('../config');
  if (order.email && !(await isDummyEmail(order.email))) mail.sendTemplate('order_placed', order.email, { name: order.name, order: order.order_number, total: `${s.shop_currency_icon || 'Rs'} ${Number(order.amount).toLocaleString('en-US')}`, payment: order.is_cod ? 'Cash on delivery' : order.payment_type, track_url: `${appUrl}/track/${order.order_number}?t=${order.access_token}` }).catch(() => {});
  messaging.orderEvent('order_placed', order).catch(() => {});
  messaging.orderEvent('admin_order_placed', order).catch(() => {});
  require('./extras').slack('nfc_order', `New order ${order.order_number} from ${order.name} (${order.city || '-'}) - ${order.amount}`).catch?.(() => {});
  return order;
}

/** Move an order through the workflow */
async function setStatus(order, status, { actor, note, vendorId } = {}) {
  if (!ALL_STATUSES.includes(status)) throw new HttpError(422, 'Unknown status');
  if (order.order_status === status) return order;
  const prev = order.order_status;
  if (status === 'shipped' && !order.stock_consumed) await inventory.consumeForOrder(order, vendorId ?? order.stock_vendor_id, actor?.id);
  if ((status === 'cancelled' || status === 'returned') && order.stock_consumed) await inventory.restoreForOrder(order, actor?.id);
  const history = [...(order.status_history || []), { status, at: new Date(), by: actor ? `${actor.first_name} ${actor.last_name}`.trim() : 'system', note: note || undefined }];
  const data = { order_status: status, status_history: history };
  if (status === 'shipped') data.dispatched_at = new Date();
  if (status === 'delivered') { data.delivered_at = new Date(); if (order.is_cod || order.payment_type === 'collection') data.payment_status = 'paid'; }
  await order.update(data);
  // e-mail for portal orders (existing template) + WhatsApp/SMS step messages
  if (order.email && !(await isDummyEmail(order.email))) mail.sendTemplate('nfc_status', order.email, { order: order.order_number, status: LABELS[status] }).catch(() => {});
  messaging.orderEvent(`order_${status}`, order).catch(() => {});
  if (status === 'shipped') messaging.orderEvent('admin_order_shipped', order).catch(() => {});
  if (status === 'confirmed' && prev === 'pending' && (await settings.get('invoice_auto_orders')) !== '0') require('./invoices').fromOrder(order.id).catch((e) => console.error('[invoice]', e.message));
  return order;
}

/**
 * Renewal orders add their plan to the customer's subscription once they are paid (never twice).
 * Called when an order is created as paid and whenever its payment status changes to paid.
 */
async function applyRenewal(order) {
  if (!order || !['renewal', 'upgrade'].includes(order.order_type) || order.plan_applied_at || order.payment_status !== 'paid' || !order.user_id) return null;
  const { NfcOrderItem, NfcCard, Plan } = M();
  const item = await NfcOrderItem.findOne({ where: { nfc_order_id: order.id }, include: [{ model: NfcCard, as: 'product' }] });
  const planId = item?.product?.plan_id;
  const plan = planId ? await Plan.findByPk(planId) : null;
  if (!plan) return null;
  const subs = require('./subscription');
  // renewal: the new period follows the current one. upgrade: the new plan starts now, the unused time was credited in the price
  const sub = order.order_type === 'upgrade'
    ? await subs.activate(order.user_id, plan, { amount: order.amount, paymentType: order.payment_type || 'upgrade' })
    : await subs.renew(order.user_id, plan, { amount: order.amount, paymentType: order.payment_type || 'renewal' });
  await order.update({ plan_applied_at: new Date() });
  return sub;
}

/** Revenue-recognised orders (for analytics): delivered, or paid and not cancelled/returned */
const revenueWhere = () => ({ [Op.or]: [{ order_status: 'delivered' }, { payment_status: 'paid', order_status: { [Op.notIn]: ['cancelled', 'returned'] } }] });

module.exports = { NO_SHIP_TYPES, applyRenewal, ORDER_TYPES, parseTiers, tierFor, afterDiscount, STEPS, ALL_STATUSES, LABELS, quote, create, setStatus, revenueWhere, orderNumber, dummyDomain, isDummyEmail };
