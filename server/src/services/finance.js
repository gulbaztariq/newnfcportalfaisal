/*
 * Real-time finance & profit analytics. Everything is computed live from the source records, so the numbers
 * never drift from the orders, subscriptions, expenses, vendor bills, purchases and courier data:
 *   Revenue  = subscriptions (paid, excl. tax) + orders (delivered or paid, excl. tax) + manual income + standalone invoice payments
 *   COGS     = order cost snapshots (materials from inventory + printing/extra cost); estimated from current costs until dispatch
 *   Courier  = courier charges of dispatched orders
 *   Expenses = manual expenses + vendor bills marked "other" (printing bills are already inside COGS)
 *   Net profit = Revenue - COGS - Courier - Expenses
 */
const { Op } = require('sequelize');
const dayjs = require('dayjs');
const inventory = require('./inventory');
const orders = require('./orders');

const M = () => require('../models');
const r2 = (n) => Math.round(Number(n || 0) * 100) / 100;
const num = (v) => Number(v || 0);

function range(q = {}) {
  const to = q.to ? dayjs(q.to).endOf('day') : dayjs().endOf('day');
  const from = q.from ? dayjs(q.from).startOf('day') : to.subtract(11, 'month').startOf('month');
  return { from, to, where: { [Op.gte]: from.toDate(), [Op.lte]: to.toDate() }, dateWhere: { [Op.gte]: from.format('YYYY-MM-DD'), [Op.lte]: to.format('YYYY-MM-DD') } };
}

async function unitCosts() {
  const products = await M().NfcCard.findAll({ attributes: ['id'] });
  const out = {};
  for (const p of products) out[p.id] = await inventory.productUnitCost(p.id);
  return out;
}

async function report(q = {}) {
  const { from, to, where, dateWhere } = range(q);
  const X = M();
  const [txs, ords, entries, bills, vpays, purchases, settlements, invPays, costs] = await Promise.all([
    X.Transaction.findAll({ where: { status: 'paid', purpose: 'subscription', created_at: where }, attributes: ['id', 'amount', 'tax_amount', 'type', 'created_at'], raw: true }),
    X.NfcOrder.findAll({ where: { ...orders.revenueWhere(), created_at: where }, include: [{ model: X.NfcOrderItem, as: 'items' }] }),
    X.FinanceEntry.findAll({ where: { date: dateWhere }, include: [{ model: X.Partner, as: 'partner', attributes: ['id', 'name'] }] }),
    X.VendorBill.findAll({ where: { date: dateWhere }, include: [{ model: X.Vendor, attributes: ['id', 'name'] }] }),
    X.VendorPayment.findAll({ where: { date: dateWhere }, include: [{ model: X.Partner, as: 'partner', attributes: ['id', 'name'] }, { model: X.Vendor, attributes: ['id', 'name'] }] }),
    X.Purchase.findAll({ where: { date: dateWhere }, include: [{ model: X.Partner, as: 'partner', attributes: ['id', 'name'] }] }),
    X.CourierSettlement.findAll({ where: { date: dateWhere } }),
    X.InvoicePayment.findAll({ where: { date: dateWhere }, include: [{ model: X.Invoice, attributes: ['type'], where: { type: 'manual' } }] }),
    unitCosts(),
  ]);

  // month buckets
  const months = [];
  for (let m = from.startOf('month'); m.isBefore(to) || m.isSame(to, 'month'); m = m.add(1, 'month')) months.push(m.format('YYYY-MM'));
  const series = Object.fromEntries(months.map((k) => [k, { month: k, revenue: 0, cogs: 0, courier: 0, expenses: 0, profit: 0, orders: 0 }]));
  const bucket = (d) => series[dayjs(d).format('YYYY-MM')];

  const totals = { subscription_revenue: 0, order_revenue: 0, other_income: 0, tax_collected: 0, delivery_collected: 0, cogs: 0, courier: 0, expenses: 0, orders: 0, units: 0 };
  const byProduct = {};
  const byCategory = {};
  const byPartner = {};
  const addPartner = (p, amount, kind) => { const k = p?.name || 'Company account'; const e = byPartner[k] || (byPartner[k] = { name: k, expenses: 0, vendor_payments: 0, purchases: 0, total: 0 }); e[kind] += amount; e.total += amount; };

  for (const t of txs) {
    const rev = num(t.amount) - num(t.tax_amount);
    totals.subscription_revenue += rev; totals.tax_collected += num(t.tax_amount);
    const b = bucket(t.created_at); if (b) b.revenue += rev;
  }
  for (const o of ords) {
    const rev = num(o.amount) - num(o.tax_amount);
    let cost = num(o.cost_amount);
    const items = o.items || [];
    if (!o.stock_consumed || !cost) cost = items.reduce((a, it) => a + (num(it.unit_cost) || costs[it.nfc_card_id] || 0) * num(it.quantity), 0);
    totals.order_revenue += rev; totals.tax_collected += num(o.tax_amount); totals.delivery_collected += num(o.delivery_charges);
    totals.cogs += cost; totals.courier += num(o.courier_charges); totals.orders += 1;
    const b = bucket(o.created_at); if (b) { b.revenue += rev; b.cogs += cost; b.courier += num(o.courier_charges); b.orders += 1; }
    for (const it of items) {
      const key = it.name;
      const e = byProduct[key] || (byProduct[key] = { name: key, units: 0, revenue: 0, cost: 0, profit: 0 });
      const uc = num(it.unit_cost) || costs[it.nfc_card_id] || 0;
      e.units += num(it.quantity); e.revenue += num(it.total); e.cost += uc * num(it.quantity); totals.units += num(it.quantity);
    }
  }
  for (const e of entries) {
    const a = num(e.amount);
    const b = bucket(e.date);
    if (e.type === 'income') { totals.other_income += a; if (b) b.revenue += a; continue; }
    totals.expenses += a; if (b) b.expenses += a;
    const c = e.category || 'Uncategorised'; byCategory[c] = (byCategory[c] || 0) + a;
    addPartner(e.partner, a, 'expenses');
  }
  for (const bl of bills) {
    if (bl.category !== 'other') continue;
    const a = num(bl.amount); totals.expenses += a;
    const b = bucket(bl.date); if (b) b.expenses += a;
    byCategory['Vendor bills'] = (byCategory['Vendor bills'] || 0) + a;
  }
  for (const p of invPays) { totals.other_income += num(p.amount); const b = bucket(p.date); if (b) b.revenue += num(p.amount); }
  for (const vp of vpays) addPartner(vp.partner, num(vp.amount), 'vendor_payments');
  for (const pu of purchases) addPartner(pu.partner, num(pu.paid_amount), 'purchases');

  const revenue = totals.subscription_revenue + totals.order_revenue + totals.other_income;
  const gross = revenue - totals.cogs;
  const net = gross - totals.courier - totals.expenses;
  for (const s of Object.values(series)) s.profit = s.revenue - s.cogs - s.courier - s.expenses;
  for (const p of Object.values(byProduct)) p.profit = p.revenue - p.cost;

  // balances (all-time)
  const [accounts, unpaidInvoices, codPending, vendors, stockValue] = await Promise.all([accountBalances(), receivables(), codOutstanding(), vendorBalances(), inventoryValue()]);

  const round = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, typeof v === 'number' ? r2(v) : v]));
  return {
    range: { from: from.format('YYYY-MM-DD'), to: to.format('YYYY-MM-DD') },
    summary: round({ ...totals, revenue, gross_profit: gross, net_profit: net, margin: revenue ? (net / revenue) * 100 : 0, cash_in_settlements: settlements.reduce((a, s) => a + num(s.net_amount), 0) }),
    series: Object.values(series).map(round),
    products: Object.values(byProduct).map(round).sort((a, b) => b.profit - a.profit),
    expense_categories: Object.entries(byCategory).map(([name, value]) => ({ name, value: r2(value) })).sort((a, b) => b.value - a.value),
    partners: Object.values(byPartner).map(round),
    accounts, receivables: unpaidInvoices, cod_outstanding: codPending, vendors, inventory_value: stockValue,
  };
}

async function accountBalances() {
  const X = M();
  const accs = await X.FinanceAccount.findAll({ order: [['id', 'ASC']] });
  const out = [];
  for (const a of accs) {
    const [inc, exp, vp, pu, st] = await Promise.all([
      X.FinanceEntry.sum('amount', { where: { account_id: a.id, type: 'income' } }), X.FinanceEntry.sum('amount', { where: { account_id: a.id, type: 'expense', status: 'paid' } }),
      X.VendorPayment.sum('amount', { where: { account_id: a.id } }), X.Purchase.sum('paid_amount', { where: { account_id: a.id } }), X.CourierSettlement.sum('net_amount', { where: { account_id: a.id } }),
    ]);
    out.push({ id: a.id, name: a.name, type: a.type, balance: r2(num(a.opening_balance) + num(inc) + num(st) - num(exp) - num(vp) - num(pu)) });
  }
  return out;
}
async function receivables() {
  const rows = await M().Invoice.findAll({ where: { status: { [Op.in]: ['sent', 'partial', 'overdue'] } }, attributes: ['total', 'paid_amount', 'status'] });
  return { count: rows.length, amount: r2(rows.reduce((a, i) => a + num(i.total) - num(i.paid_amount), 0)), overdue: rows.filter((i) => i.status === 'overdue').length };
}
async function codOutstanding() {
  const rows = await M().NfcOrder.findAll({ where: { is_cod: true, cod_settled: false, order_status: { [Op.in]: ['shipped', 'delivered'] } }, attributes: ['amount', 'order_status'] });
  return { count: rows.length, amount: r2(rows.reduce((a, o) => a + num(o.amount), 0)), delivered: rows.filter((o) => o.order_status === 'delivered').length };
}
async function vendorBalances() {
  const X = M();
  const vendors = await X.Vendor.findAll({ order: [['name', 'ASC']] });
  const out = [];
  for (const v of vendors) {
    const [billed, paid] = await Promise.all([X.VendorBill.sum('amount', { where: { vendor_id: v.id } }), X.VendorPayment.sum('amount', { where: { vendor_id: v.id } })]);
    out.push({ id: v.id, name: v.name, type: v.type, billed: r2(num(billed) + num(v.opening_balance)), paid: r2(paid), balance: r2(num(v.opening_balance) + num(billed) - num(paid)) });
  }
  return out;
}
async function inventoryValue() {
  const items = await M().InventoryItem.findAll({ attributes: ['id', 'purchase_price', 'sale_price'] });
  const lv = await inventory.levels(items.map((i) => i.id));
  return {
    cost: r2(items.reduce((a, i) => a + (lv[i.id]?.total || 0) * num(i.purchase_price), 0)),
    retail: r2(items.reduce((a, i) => a + (lv[i.id]?.total || 0) * num(i.sale_price), 0)),
    units: r2(items.reduce((a, i) => a + (lv[i.id]?.total || 0), 0)),
  };
}

/** Unified ledger (latest first) for the finance screen */
async function ledger(q = {}) {
  const { dateWhere, where } = range(q);
  const X = M();
  const [entries, txs, ords, vpays, purchases, settlements, invPays, bills] = await Promise.all([
    X.FinanceEntry.findAll({ where: { date: dateWhere }, include: [{ model: X.Partner, as: 'partner', attributes: ['name'] }, { model: X.FinanceAccount, as: 'account', attributes: ['name'] }] }),
    X.Transaction.findAll({ where: { status: 'paid', created_at: where }, include: [{ model: X.User, attributes: ['first_name', 'last_name'] }] }),
    X.NfcOrder.findAll({ where: { ...orders.revenueWhere(), created_at: where }, attributes: ['id', 'order_number', 'name', 'amount', 'created_at', 'payment_type', 'is_cod', 'courier_charges'] }),
    X.VendorPayment.findAll({ where: { date: dateWhere }, include: [{ model: X.Vendor, attributes: ['name'] }, { model: X.Partner, as: 'partner', attributes: ['name'] }] }),
    X.Purchase.findAll({ where: { date: dateWhere } }),
    X.CourierSettlement.findAll({ where: { date: dateWhere } }),
    X.InvoicePayment.findAll({ where: { date: dateWhere }, include: [{ model: X.Invoice, attributes: ['number', 'type', 'customer_name'] }] }),
    X.VendorBill.findAll({ where: { date: dateWhere }, include: [{ model: X.Vendor, attributes: ['name'] }] }),
  ]);
  const rows = [
    ...entries.map((e) => ({ date: e.date, kind: e.type, source: 'Manual', title: e.title, category: e.category, amount: num(e.amount), party: e.partner?.name, account: e.account?.name, attachment: e.attachment, id: `fe-${e.id}` })),
    ...txs.filter((t) => t.purpose !== 'nfc_order').map((t) => ({ date: dayjs(t.created_at).format('YYYY-MM-DD'), kind: 'income', source: 'Subscription', title: `${t.purpose === 'subscription' ? 'Plan payment' : t.purpose} (${t.type})`, category: 'Subscriptions', amount: num(t.amount), party: t.user ? `${t.user.first_name} ${t.user.last_name}` : '', id: `tx-${t.id}` })),
    ...ords.map((o) => ({ date: dayjs(o.created_at).format('YYYY-MM-DD'), kind: 'income', source: 'Order', title: `Order ${o.order_number}`, category: o.is_cod ? 'COD sales' : 'Online sales', amount: num(o.amount), party: o.name, id: `or-${o.id}` })),
    ...ords.filter((o) => num(o.courier_charges) > 0).map((o) => ({ date: dayjs(o.created_at).format('YYYY-MM-DD'), kind: 'expense', source: 'Courier', title: `Courier charges ${o.order_number}`, category: 'Courier', amount: num(o.courier_charges), id: `cc-${o.id}` })),
    ...vpays.map((p) => ({ date: p.date, kind: 'expense', source: 'Vendor payment', title: `Payment to ${p.vendor?.name || 'vendor'}`, category: 'Vendors', amount: num(p.amount), party: p.partner?.name, attachment: p.attachment, id: `vp-${p.id}` })),
    ...bills.map((b) => ({ date: b.date, kind: 'bill', source: 'Vendor bill', title: `Bill ${b.bill_no || ''} - ${b.vendor?.name || ''}`, category: b.category === 'other' ? 'Vendor bills' : 'Printing (in product cost)', amount: num(b.amount), attachment: b.attachment, id: `vb-${b.id}` })),
    ...purchases.map((p) => ({ date: p.date, kind: 'purchase', source: p.is_import ? 'Import' : 'Purchase', title: `${p.is_import ? 'Import' : 'Purchase'} ${p.invoice_no || ''} ${p.supplier_name || ''}`.trim(), category: 'Stock', amount: num(p.total), attachment: p.attachment, id: `pu-${p.id}` })),
    ...settlements.map((s) => ({ date: s.date, kind: 'income', source: 'Courier settlement', title: `Leopards COD settlement ${s.reference || ''}`.trim(), category: 'COD settlement', amount: num(s.net_amount), attachment: s.attachment, id: `cs-${s.id}`, info: true })),
    ...invPays.map((p) => ({ date: p.date, kind: 'income', source: 'Invoice', title: `Invoice ${p.invoice?.number} payment`, category: 'Invoices', amount: num(p.amount), party: p.invoice?.customer_name, id: `ip-${p.id}` })),
  ];
  return rows.sort((a, b) => String(b.date).localeCompare(String(a.date)));
}

module.exports = { report, ledger, accountBalances, vendorBalances, inventoryValue, receivables, codOutstanding, range };
