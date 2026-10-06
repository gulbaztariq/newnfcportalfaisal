/*
 * Inventory: stock is the signed sum of stock movements per item and location (vendor_id null = main store).
 * Purchases (local or imported) add stock at landed cost and update the weighted average cost.
 * Products (NFC cards / tags / standees) consume inventory items through their components when an order is
 * dispatched; the cost snapshot on the order drives the profit analytics.
 */
const { fn, col, Op } = require('sequelize');
const dayjs = require('dayjs');
const { HttpError } = require('../utils/http');

const M = () => require('../models');
const r2 = (n) => Math.round(Number(n || 0) * 100) / 100;

/** { [itemId]: { total, byLocation: { [vendorId|'main']: qty } } } */
async function levels(itemIds) {
  const where = itemIds ? { inventory_item_id: itemIds } : {};
  const rows = await M().StockMovement.findAll({ where, attributes: ['inventory_item_id', 'vendor_id', [fn('SUM', col('quantity')), 'qty']], group: ['inventory_item_id', 'vendor_id'], raw: true });
  const out = {};
  for (const r of rows) {
    const e = out[r.inventory_item_id] || (out[r.inventory_item_id] = { total: 0, byLocation: {} });
    const q = Number(r.qty || 0);
    e.total += q; e.byLocation[r.vendor_id || 'main'] = (e.byLocation[r.vendor_id || 'main'] || 0) + q;
  }
  return out;
}

async function qtyAt(itemId, vendorId, t) {
  const v = await M().StockMovement.sum('quantity', { where: { inventory_item_id: itemId, vendor_id: vendorId || null }, transaction: t });
  return Number(v || 0);
}

/** Unit cost of a product = components x average cost + extra (printing/labour) cost */
async function productUnitCost(productId) {
  const p = await M().NfcCard.findByPk(productId, { include: [{ model: M().ProductComponent, as: 'components', include: [{ model: M().InventoryItem, as: 'item' }] }] });
  if (!p) return 0;
  return r2((p.components || []).reduce((s, c) => s + Number(c.quantity) * Number(c.item?.purchase_price || 0), 0) + Number(p.extra_cost || 0));
}

/** Record a purchase: allocate landed costs by line value, add stock, update weighted average cost */
async function applyPurchase(purchase, userId, t) {
  const { InventoryItem, StockMovement } = M();
  const rate = Number(purchase.exchange_rate || 1) || 1;
  const lines = (purchase.items || []).filter((l) => l.inventory_item_id && Number(l.quantity) > 0);
  if (!lines.length) throw new HttpError(422, 'Add at least one item with a quantity');
  const base = lines.reduce((s, l) => s + Number(l.quantity) * Number(l.unit_price || 0) * rate, 0);
  const extras = ['shipping_cost', 'customs_duty', 'clearing_charges', 'other_charges'].reduce((s, k) => s + Number(purchase[k] || 0), 0);
  for (const l of lines) {
    const item = await InventoryItem.findByPk(l.inventory_item_id, { transaction: t });
    if (!item) throw new HttpError(422, 'Unknown inventory item');
    const value = Number(l.quantity) * Number(l.unit_price || 0) * rate;
    const share = base > 0 ? value / base : 1 / lines.length;
    const landedUnit = (value + extras * share) / Number(l.quantity);
    const onHand = Math.max(0, Number((await StockMovement.sum('quantity', { where: { inventory_item_id: item.id }, transaction: t })) || 0));
    const avg = onHand + Number(l.quantity) > 0 ? (onHand * Number(item.purchase_price || 0) + Number(l.quantity) * landedUnit) / (onHand + Number(l.quantity)) : landedUnit;
    await item.update({ purchase_price: r2(avg) }, { transaction: t });
    await StockMovement.create({
      inventory_item_id: item.id, vendor_id: purchase.location_vendor_id || null, type: 'purchase', quantity: Number(l.quantity), unit_cost: r2(landedUnit),
      date: purchase.date, reference: purchase.invoice_no || `PUR-${purchase.id}`, purchase_id: purchase.id, created_by: userId,
      note: purchase.is_import ? `Import from ${purchase.origin_country || 'abroad'}` : null,
    }, { transaction: t });
  }
  return { subtotal: r2(base), total: r2(base + extras) };
}

async function transfer({ itemId, fromVendorId, toVendorId, quantity, date, note, userId }) {
  const { StockMovement, InventoryItem, sequelize } = M();
  const q = Number(quantity);
  if (!(q > 0)) throw new HttpError(422, 'Enter a quantity');
  if ((fromVendorId || null) === (toVendorId || null)) throw new HttpError(422, 'Pick two different locations');
  const item = await InventoryItem.findByPk(itemId);
  if (!item) throw new HttpError(404, 'Item not found');
  await sequelize.transaction(async (t) => {
    if ((await qtyAt(item.id, fromVendorId, t)) < q) throw new HttpError(422, 'Not enough stock at the source location');
    const common = { inventory_item_id: item.id, unit_cost: item.purchase_price, date: date || dayjs().format('YYYY-MM-DD'), note, created_by: userId, reference: 'Transfer' };
    await StockMovement.create({ ...common, vendor_id: fromVendorId || null, type: 'transfer_out', quantity: -q }, { transaction: t });
    await StockMovement.create({ ...common, vendor_id: toVendorId || null, type: 'transfer_in', quantity: q }, { transaction: t });
  });
}

/** Consume stock for an order (on dispatch). Stores item cost snapshots and order cost. */
async function consumeForOrder(order, vendorId, userId) {
  const { NfcOrderItem, NfcCard, ProductComponent, InventoryItem, StockMovement, sequelize } = M();
  if (order.stock_consumed) return;
  const items = await NfcOrderItem.findAll({ where: { nfc_order_id: order.id } });
  await sequelize.transaction(async (t) => {
    let cost = 0;
    for (const it of items) {
      const p = it.nfc_card_id ? await NfcCard.findByPk(it.nfc_card_id, { include: [{ model: ProductComponent, as: 'components', include: [{ model: InventoryItem, as: 'item' }] }], transaction: t }) : null;
      let unit = Number(p?.extra_cost || 0);
      for (const c of p?.components || []) {
        const need = Number(c.quantity) * Number(it.quantity);
        unit += Number(c.quantity) * Number(c.item.purchase_price || 0);
        if (p.track_stock) {
          await StockMovement.create({ inventory_item_id: c.inventory_item_id, vendor_id: vendorId || null, type: 'sale', quantity: -need, unit_cost: c.item.purchase_price, date: dayjs().format('YYYY-MM-DD'), reference: order.order_number, nfc_order_id: order.id, created_by: userId }, { transaction: t });
        }
      }
      await it.update({ unit_cost: r2(unit) }, { transaction: t });
      cost += unit * Number(it.quantity);
    }
    await order.update({ stock_consumed: true, stock_vendor_id: vendorId || null, cost_amount: r2(cost) }, { transaction: t });
  });
}

/** Put stock back for a cancelled / returned order */
async function restoreForOrder(order, userId) {
  const { StockMovement, sequelize } = M();
  if (!order.stock_consumed) return;
  const moves = await StockMovement.findAll({ where: { nfc_order_id: order.id, type: 'sale' } });
  await sequelize.transaction(async (t) => {
    for (const m of moves) await StockMovement.create({ inventory_item_id: m.inventory_item_id, vendor_id: m.vendor_id, type: 'return', quantity: -Number(m.quantity), unit_cost: m.unit_cost, date: dayjs().format('YYYY-MM-DD'), reference: order.order_number, nfc_order_id: order.id, created_by: userId, note: `Order ${order.order_status}` }, { transaction: t });
    await order.update({ stock_consumed: false }, { transaction: t });
  });
}

/** Items at or below their reorder level */
async function lowStock() {
  const items = await M().InventoryItem.findAll({ where: { status: true, reorder_level: { [Op.gt]: 0 } } });
  const lv = await levels(items.map((i) => i.id));
  return items.filter((i) => (lv[i.id]?.total || 0) <= i.reorder_level).map((i) => ({ id: i.id, name: i.name, qty: lv[i.id]?.total || 0, reorder_level: i.reorder_level }));
}

module.exports = { levels, qtyAt, productUnitCost, applyPurchase, transfer, consumeForOrder, restoreForOrder, lowStock, r2 };
