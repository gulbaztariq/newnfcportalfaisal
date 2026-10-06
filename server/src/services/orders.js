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
async function quote(lines, { is_cod = false, discount = 0, discountType, discountValue, delivery: deliveryOverride, collection = false, priceOverride = false } = {}) {
  const s = await settings.all();
  const { NfcCard, Plan } = M();
  const out = [];
  for (const l of (Array.isArray(lines) ? lines : []).slice(0, 50)) {
    const p = await NfcCard.findOne({ where: { id: l.product_id, status: true }, include: [{ model: Plan, as: 'plan', attributes: ['id', 'name', 'frequency'] }] });
    if (!p) throw new HttpError(422, 'A product in your cart is no longer available');
    const qty = Math.min(1000, Math.max(1, parseInt(l.quantity, 10) || 1));
    const variant = (p.variants || []).find((v) => v.name === l.variant) || null;
    if ((p.variants || []).length && !variant) throw new HttpError(422, `Choose an option for ${p.name}`);
    const listPrice = r2(Number(p.price) + Number(variant?.price_delta || 0));
    const own = priceOverride && l.unit_price !== undefined && l.unit_price !== null && l.unit_price !== '' ? r2(l.unit_price) : null;
    if (own !== null && (Number.isNaN(own) || own < 0)) throw new HttpError(422, `Enter a valid price for ${p.name}`);
    const unit = own ?? listPrice;
    const custom = !!l.customization && Number(p.customization_price) > 0;
    const cPrice = custom ? r2(p.customization_price) : 0;
    out.push({ product: p, name: p.name, variant: variant?.name || null, quantity: qty, list_price: listPrice, unit_price: unit, customization: custom, customization_price: cPrice, total: r2((unit + cPrice) * qty), plan: p.plan ? { id: p.plan.id, name: p.plan.name } : null });
  }
  if (!out.length) throw new HttpError(422, 'Your cart is empty');
  const subtotal = r2(out.reduce((a, l) => a + l.total, 0));
  const dVal = Math.max(0, r2(discountValue ?? discount));
  const dType = discountType === 'percent' ? 'percent' : 'fixed';
  const disc = Math.min(subtotal, dType === 'percent' ? r2((subtotal * Math.min(100, dVal)) / 100) : dVal);
  const tax = r2(((subtotal - disc) * Number(s.nfc_tax_rate || 0)) / 100);
  const freeAbove = Number(s.free_delivery_above || 0);
  const autoDelivery = freeAbove > 0 && subtotal - disc >= freeAbove ? 0 : r2(s.delivery_charges || 0);
  const manual = deliveryOverride !== undefined && deliveryOverride !== null && deliveryOverride !== '' ? Math.max(0, r2(deliveryOverride)) : null;
  const delivery = collection ? 0 : manual ?? autoDelivery;
  const cod = is_cod && !collection ? r2(s.cod_charges || 0) : 0;
  return {
    lines: out, subtotal, discount: disc, discount_type: dType, discount_value: dVal, tax, delivery, delivery_default: autoDelivery, cod,
    total: r2(subtotal - disc + tax + delivery + cod), tax_name: s.nfc_tax_name || 'Tax', tax_rate: Number(s.nfc_tax_rate || 0),
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
      subtotal: q.subtotal, discount: q.discount, discount_type: q.discount ? q.discount_type : null, discount_value: q.discount ? q.discount_value : 0, tax_amount: q.tax, delivery_charges: q.delivery, cod_charges: q.cod, amount: q.total,
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

/** Revenue-recognised orders (for analytics): delivered, or paid and not cancelled/returned */
const revenueWhere = () => ({ [Op.or]: [{ order_status: 'delivered' }, { payment_status: 'paid', order_status: { [Op.notIn]: ['cancelled', 'returned'] } }] });

module.exports = { STEPS, ALL_STATUSES, LABELS, quote, create, setStatus, revenueWhere, orderNumber, dummyDomain, isDummyEmail };
