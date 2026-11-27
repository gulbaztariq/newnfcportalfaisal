/*
 * Sellable stock, the WooCommerce way. A product either counts its own pieces (stock_qty) or, when it has variations,
 * the pieces of each variation (variants[].stock). Orders take pieces off when they are created and give them back when
 * the order is cancelled or returned; every change is written to the stock log with the balance after it.
 * (The older "inventory" module is about raw materials and costing and is separate from this.)
 */
const { HttpError } = require('../utils/http');

const M = () => require('../models');
const whole = (n) => Math.trunc(Number(n) || 0);

/** what is left of a product (or one of its variations); tracked=false means unlimited */
function available(p, variantName) {
  if (!p.manage_stock) return { tracked: false, qty: null };
  const vs = Array.isArray(p.variants) ? p.variants : [];
  if (vs.length) { const v = vs.find((x) => x.name === variantName); return { tracked: true, qty: whole(v?.stock) }; }
  return { tracked: true, qty: whole(p.stock_qty) };
}
const statusOf = (qty, p) => (qty <= 0 ? (p.allow_backorder ? 'backorder' : 'out') : qty <= whole(p.low_stock_threshold) ? 'low' : 'in');

/** per product: the overall state for lists (a variable product is out only when every variation is) */
function summary(p) {
  if (!p.manage_stock) return { tracked: false, status: 'in', qty: null };
  const vs = Array.isArray(p.variants) ? p.variants : [];
  if (!vs.length) { const q = whole(p.stock_qty); return { tracked: true, status: statusOf(q, p), qty: q }; }
  const qs = vs.map((v) => whole(v.stock)); const total = qs.reduce((a, b) => a + b, 0);
  const status = qs.every((q) => q <= 0) ? statusOf(0, p) : qs.some((q) => q > 0 && q <= whole(p.low_stock_threshold)) ? 'low' : 'in';
  return { tracked: true, status, qty: total };
}

/** write the new quantity into the product (stock_qty, or the variation inside the variants list) */
async function write(p, variantName, qty, t) {
  const vs = Array.isArray(p.variants) ? p.variants : [];
  if (vs.length) { await p.update({ variants: vs.map((v) => (v.name === variantName ? { ...v, stock: qty } : v)) }, { transaction: t }); } else await p.update({ stock_qty: qty }, { transaction: t });
}

async function move(p, variantName, change, { reason, order, note, actor, t }) {
  const cur = available(p, variantName).qty;
  const balance = cur + change;
  await write(p, variantName, balance, t);
  await M().ProductStockLog.create({ nfc_card_id: p.id, variant: variantName || null, change, balance, reason, note: note ? String(note).slice(0, 300) : null, nfc_order_id: order?.id || null, created_by: actor?.id || null }, { transaction: t });
  return balance;
}

/** take the ordered pieces off the stock (inside the order's transaction). Refuses when there is not enough and backorders are off. */
async function take(lines, order, t) {
  const need = new Map();
  for (const l of lines) { const k = `${l.product.id}|${l.variant || ''}`; need.set(k, { id: l.product.id, variant: l.variant || '', qty: (need.get(k)?.qty || 0) + whole(l.quantity) }); }
  let any = false;
  for (const n of need.values()) {
    const p = await M().NfcCard.findByPk(n.id, { transaction: t, lock: t.LOCK.UPDATE }); // two orders at once cannot both take the last piece
    if (!p || !p.manage_stock) continue;
    const cur = available(p, n.variant).qty;
    if (n.qty > cur && !p.allow_backorder) throw new HttpError(422, cur > 0 ? `Only ${cur} left of ${p.name}${n.variant ? ` (${n.variant})` : ''}` : `${p.name}${n.variant ? ` (${n.variant})` : ''} is out of stock`);
    await move(p, n.variant, -n.qty, { reason: 'order', order, t }); any = true;
  }
  if (any) await order.update({ sellable_stock_taken: true }, { transaction: t });
}

/** a cancelled or returned order gives its pieces back */
async function give(order, actor) {
  if (!order.sellable_stock_taken) return;
  const { sequelize, NfcOrderItem, NfcCard } = M();
  await sequelize.transaction(async (t) => {
    const items = await NfcOrderItem.findAll({ where: { nfc_order_id: order.id }, transaction: t });
    for (const it of items) {
      const p = it.nfc_card_id && await NfcCard.findByPk(it.nfc_card_id, { transaction: t, lock: t.LOCK.UPDATE });
      if (!p || !p.manage_stock) continue;
      await move(p, it.variant || '', whole(it.quantity), { reason: 'cancel', order, actor, t });
    }
    await order.update({ sellable_stock_taken: false }, { transaction: t });
  });
}

/** a manual change from the Products page: add / remove pieces (change) or count them again (set) */
async function adjust(p, { variant, change, set, note }, actor) {
  if (!p.manage_stock) throw new HttpError(422, 'Turn on "Manage stock" for this product first');
  const vs = Array.isArray(p.variants) ? p.variants : [];
  const name = vs.length ? String(variant || '') : '';
  if (vs.length && !vs.some((v) => v.name === name)) throw new HttpError(422, 'Choose the variation');
  const cur = available(p, name).qty;
  const delta = set !== undefined && set !== '' && set !== null ? whole(set) - cur : whole(change);
  if (!delta) throw new HttpError(422, 'Enter how many pieces to add or remove');
  if (cur + delta < 0) throw new HttpError(422, 'The stock cannot go below zero');
  const { sequelize } = M();
  return sequelize.transaction(async (t) => {
    const row = await M().NfcCard.findByPk(p.id, { transaction: t, lock: t.LOCK.UPDATE });
    return move(row, name, delta, { reason: set !== undefined && set !== '' && set !== null ? 'set' : 'adjust', note, actor, t });
  });
}

module.exports = { available, summary, statusOf, take, give, adjust };
