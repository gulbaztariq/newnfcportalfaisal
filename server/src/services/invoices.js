/*
 * Invoice management: numbering (Settings > Invoices), creation from orders / subscriptions / manual,
 * payments, status, PDF (five template styles; the HTML version in views/invoice.js is print-ready too).
 */
const crypto = require('crypto');
const dayjs = require('dayjs');
const PDFDocument = require('pdfkit');
const settings = require('./settings');
const { HttpError } = require('../utils/http');

const M = () => require('../models');
const r2 = (n) => Math.round(Number(n || 0) * 100) / 100;

const TEMPLATES = {
  modern: { label: 'Modern', accent: '#6d5dfc' },
  classic: { label: 'Classic', accent: '#1f2937' },
  minimal: { label: 'Minimal', accent: '#111111' },
  bold: { label: 'Bold', accent: '#e11d48' },
  elegant: { label: 'Elegant', accent: '#b08d57' },
  corporate: { label: 'Corporate', accent: '#0f4c81' },
};

async function nextNumber() {
  const { Setting, Invoice, sequelize } = M();
  const s = await settings.all();
  const prefix = s.invoice_prefix ?? 'INV-';
  const pad = Number(s.invoice_number_padding || 5);
  return sequelize.transaction(async (t) => {
    const row = await Setting.findOne({ where: { key: 'invoice_next_number' }, transaction: t, lock: t.LOCK?.UPDATE });
    let n = Math.max(1, parseInt(row?.value || s.invoice_next_number || '1', 10));
    while (await Invoice.findOne({ where: { number: `${prefix}${String(n).padStart(pad, '0')}` }, transaction: t })) n += 1;
    if (row) await row.update({ value: String(n + 1) }, { transaction: t }); else await Setting.create({ key: 'invoice_next_number', value: String(n + 1) }, { transaction: t });
    settings.clearCache?.();
    return `${prefix}${String(n).padStart(pad, '0')}`;
  });
}

/** Recalculate totals and status from items/payments */
function totals(inv) {
  const items = (inv.items || []).map((it) => ({ description: String(it.description || '').slice(0, 300), quantity: Number(it.quantity || 1), unit_price: r2(it.unit_price), total: r2(Number(it.quantity || 1) * Number(it.unit_price || 0)) }));
  const subtotal = r2(items.reduce((a, it) => a + it.total, 0));
  const discount = Math.min(subtotal, r2(inv.discount));
  const tax = r2(((subtotal - discount) * Number(inv.tax_rate || 0)) / 100);
  const total = r2(subtotal - discount + tax + Number(inv.delivery_charges || 0));
  return { items, subtotal, discount, tax_amount: tax, total };
}
function statusOf(inv) {
  if (inv.status === 'cancelled' || inv.status === 'draft') return inv.status;
  const paid = Number(inv.paid_amount || 0);
  if (paid >= Number(inv.total) - 0.009 && Number(inv.total) > 0) return 'paid';
  if (paid > 0) return 'partial';
  if (inv.due_date && dayjs(inv.due_date).isBefore(dayjs(), 'day')) return 'overdue';
  return 'sent';
}

async function create(data, userId) {
  const s = await settings.all();
  const t = totals(data);
  const inv = await M().Invoice.create({
    ...data, ...t, number: data.number || await nextNumber(), token: crypto.randomBytes(24).toString('hex'),
    issue_date: data.issue_date || dayjs().format('YYYY-MM-DD'),
    due_date: data.due_date || dayjs().add(Number(s.invoice_due_days || 7), 'day').format('YYYY-MM-DD'),
    template: data.template || s.invoice_template || 'modern',
    currency_code: data.currency_code || s.shop_currency_code || 'PKR', currency_icon: data.currency_icon || s.shop_currency_icon || 'Rs',
    notes: data.notes ?? s.invoice_notes, terms: data.terms ?? s.invoice_terms, created_by: userId || null,
    status: data.status || 'sent',
  });
  await inv.update({ status: statusOf(inv) });
  return inv;
}

/** Invoice for an order (idempotent) */
async function fromOrder(orderId, userId) {
  const { NfcOrder, NfcOrderItem, Invoice } = M();
  const existing = await Invoice.findOne({ where: { nfc_order_id: orderId } });
  if (existing) return existing;
  const o = await NfcOrder.findByPk(orderId, { include: [{ model: NfcOrderItem, as: 'items' }] });
  if (!o) throw new HttpError(404, 'Order not found');
  const items = (o.items || []).flatMap((it) => {
    const rows = [{ description: `${it.name}${it.variant ? ` (${it.variant})` : ''}`, quantity: it.quantity, unit_price: it.unit_price }];
    if (it.customization) rows.push({ description: `Customisation - ${it.name}`, quantity: it.quantity, unit_price: it.customization_price });
    return rows;
  });
  if (!items.length) items.push({ description: 'NFC card', quantity: o.quantity, unit_price: o.unit_price });
  if (Number(o.cod_charges) > 0) items.push({ description: 'Cash on delivery charges', quantity: 1, unit_price: o.cod_charges });
  const s = await settings.all();
  const taxRate = Number(o.subtotal) > 0 ? r2((Number(o.tax_amount) / Math.max(0.01, Number(o.subtotal) - Number(o.discount || 0))) * 100) : Number(s.nfc_tax_rate || 0);
  return create({
    type: 'order', nfc_order_id: o.id, user_id: o.user_id, customer_name: o.name, customer_email: o.email, customer_phone: o.phone,
    customer_company: o.company_name, customer_address: [o.address, o.city].filter(Boolean).join(', '),
    items, discount: o.discount, tax_name: s.nfc_tax_name || 'Tax', tax_rate: Number(o.tax_amount) > 0 ? taxRate : 0, delivery_charges: o.delivery_charges,
    paid_amount: o.payment_status === 'paid' ? o.amount : 0, issue_date: dayjs(o.created_at).format('YYYY-MM-DD'),
  }, userId);
}

/** Invoice for a paid subscription transaction (idempotent) */
async function fromTransaction(txId, userId) {
  const { Invoice, Transaction, Subscription, Plan, Currency, User } = M();
  const existing = await Invoice.findOne({ where: { transaction_id: txId } });
  if (existing) return existing;
  const t = await Transaction.findByPk(txId, { include: [User, { model: Subscription, include: [{ model: Plan, include: [Currency] }] }] });
  if (!t) throw new HttpError(404, 'Transaction not found');
  const plan = t.subscription?.plan;
  const tax = Number(t.tax_amount || 0);
  const total = Number(t.amount);
  return create({
    type: 'subscription', transaction_id: t.id, user_id: t.user_id, customer_name: t.user ? `${t.user.first_name} ${t.user.last_name}` : 'Customer', customer_email: t.user?.email,
    items: [{ description: plan ? `${plan.name} plan (${plan.frequency})` : 'Subscription', quantity: 1, unit_price: r2(total - tax + Number(t.subscription?.discount || 0)) }],
    discount: t.subscription?.discount || 0, tax_name: plan?.tax_name || 'Tax', tax_rate: plan?.tax_rate || 0,
    paid_amount: t.status === 'paid' ? total : 0, currency_code: plan?.currency?.currency_code, currency_icon: plan?.currency?.currency_icon,
    issue_date: dayjs(t.created_at).format('YYYY-MM-DD'),
  }, userId);
}

async function addPayment(inv, { amount, date, method, reference, note }) {
  const a = r2(amount);
  if (!(a > 0)) throw new HttpError(422, 'Validation failed', { amount: 'Enter an amount' });
  await M().InvoicePayment.create({ invoice_id: inv.id, amount: a, date: date || dayjs().format('YYYY-MM-DD'), method, reference, note });
  const paid = r2(Number(inv.paid_amount || 0) + a);
  await inv.update({ paid_amount: paid });
  await inv.update({ status: statusOf(inv) });
  if (inv.nfc_order_id && paid >= Number(inv.total)) await M().NfcOrder.update({ payment_status: 'paid' }, { where: { id: inv.nfc_order_id } });
  return inv;
}

/* ------------------------------------------------------------------ PDF */
const fmt = (v, cur) => `${cur || ''} ${Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`.trim();

async function pdf(inv) {
  const s = await settings.all();
  const tpl = TEMPLATES[inv.template] ? inv.template : 'modern';
  const accent = /^#[0-9a-f]{6}$/i.test(s.invoice_accent || '') ? s.invoice_accent : TEMPLATES[tpl].accent;
  const serif = tpl === 'classic' || tpl === 'elegant';
  const F = serif ? { r: 'Times-Roman', b: 'Times-Bold' } : { r: 'Helvetica', b: 'Helvetica-Bold' };
  const company = s.invoice_company_name || s.app_name || 'Company';
  const logoPath = (() => {
    const u = s.invoice_logo || s.app_logo;
    if (!u || !u.startsWith('/uploads/')) return null;
    const p = require('path').join(require('../config').uploadDir, u.replace(/^\/uploads\//, ''));
    return require('fs').existsSync(p) && /\.(png|jpe?g)$/i.test(p) ? p : null;
  })();
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 48, info: { Title: `Invoice ${inv.number}` } });
    const chunks = []; doc.on('data', (c) => chunks.push(c)); doc.on('end', () => resolve(Buffer.concat(chunks))); doc.on('error', reject);
    const W = doc.page.width; const L = 48; const R = W - 48;
    const cur = inv.currency_icon;
    // header
    if (tpl === 'modern' || tpl === 'bold' || tpl === 'corporate') {
      doc.rect(0, 0, W, tpl === 'bold' ? 150 : 120).fill(accent);
      if (tpl === 'modern') doc.circle(W - 40, -10, 90).fillOpacity(0.15).fill('#ffffff').fillOpacity(1);
      doc.fillColor('#ffffff');
    } else {
      doc.fillColor('#111111');
      if (tpl === 'elegant') doc.rect(L, 40, R - L, 1).fill(accent).fillColor('#111111');
    }
    let hy = 44;
    if (logoPath) { try { doc.image(logoPath, L, hy - 4, { fit: [54, 54] }); } catch { /* ignore bad image */ } }
    const cx = logoPath ? L + 66 : L;
    doc.font(F.b).fontSize(tpl === 'minimal' ? 16 : 20).text(company, cx, hy, { width: 280 });
    doc.font(F.r).fontSize(9).text([s.invoice_company_address || s.address, s.invoice_company_phone || (s.phone && `+${s.region_code} ${s.phone}`), s.invoice_company_email || s.email, s.invoice_tax_id && `Tax ID: ${s.invoice_tax_id}`].filter(Boolean).join('\n'), cx, hy + 26, { width: 260 });
    doc.font(F.b).fontSize(tpl === 'bold' ? 30 : 24).text('INVOICE', 330, hy, { width: R - 330, align: 'right' });
    doc.font(F.r).fontSize(10).text(`# ${inv.number}`, 330, hy + (tpl === 'bold' ? 38 : 30), { width: R - 330, align: 'right' });
    let y = tpl === 'bold' ? 180 : 150;
    doc.fillColor('#6b7280').font(F.b).fontSize(8).text('BILL TO', L, y).text('INVOICE DATE', 330, y, { width: 100 }).text('DUE DATE', 440, y, { width: R - 440, align: 'right' });
    doc.fillColor('#111111').font(F.b).fontSize(11).text(inv.customer_name, L, y + 13, { width: 260 });
    doc.font(F.r).fontSize(9).fillColor('#374151').text([inv.customer_company, inv.customer_address, inv.customer_phone, inv.customer_email].filter(Boolean).join('\n'), L, y + 28, { width: 260 });
    doc.fillColor('#111111').fontSize(10).text(dayjs(inv.issue_date).format('DD MMM YYYY'), 330, y + 13, { width: 100 }).text(inv.due_date ? dayjs(inv.due_date).format('DD MMM YYYY') : '-', 440, y + 13, { width: R - 440, align: 'right' });
    const status = String(inv.status).toUpperCase();
    doc.roundedRect(R - 90, y + 32, 90, 20, 10).fill(inv.status === 'paid' ? '#16a34a' : inv.status === 'overdue' ? '#dc2626' : inv.status === 'partial' ? '#d97706' : '#6b7280');
    doc.fillColor('#ffffff').font(F.b).fontSize(8).text(status, R - 90, y + 38, { width: 90, align: 'center' });
    // items
    y += 100;
    const head = () => {
      if (tpl === 'minimal' || tpl === 'classic' || tpl === 'elegant') { doc.moveTo(L, y + 20).lineTo(R, y + 20).lineWidth(1).strokeColor(tpl === 'elegant' ? accent : '#111111').stroke(); doc.fillColor('#111111'); }
      else { doc.roundedRect(L, y, R - L, 24, 6).fill(tpl === 'corporate' ? '#eef2f7' : `${accent}`); doc.fillColor(tpl === 'corporate' ? '#0f172a' : '#ffffff'); }
      doc.font(F.b).fontSize(9).text('DESCRIPTION', L + 10, y + 8).text('QTY', 320, y + 8, { width: 40, align: 'right' }).text('PRICE', 370, y + 8, { width: 80, align: 'right' }).text('AMOUNT', 455, y + 8, { width: R - 465, align: 'right' });
      y += 32;
    };
    head();
    doc.font(F.r).fontSize(10).fillColor('#111111');
    (inv.items || []).forEach((it, i) => {
      if (y > 700) { doc.addPage(); y = 60; head(); doc.font(F.r).fontSize(10).fillColor('#111111'); }
      const h = Math.max(16, doc.heightOfString(it.description, { width: 250 }));
      if (i % 2 === 1 && tpl !== 'minimal') doc.rect(L, y - 5, R - L, h + 10).fill('#f8f8fb').fillColor('#111111');
      doc.text(it.description, L + 10, y, { width: 250 }).text(String(it.quantity), 320, y, { width: 40, align: 'right' }).text(fmt(it.unit_price, cur), 370, y, { width: 80, align: 'right' }).text(fmt(it.total, cur), 455, y, { width: R - 465, align: 'right' });
      y += h + 10;
    });
    // totals
    y += 8;
    const row = (label, val, strong) => {
      doc.font(strong ? F.b : F.r).fontSize(strong ? 12 : 10).fillColor(strong ? '#111111' : '#374151').text(label, 330, y, { width: 120, align: 'right' }).text(val, 455, y, { width: R - 465, align: 'right' });
      y += strong ? 24 : 18;
    };
    row('Subtotal', fmt(inv.subtotal, cur));
    if (Number(inv.discount) > 0) row('Discount', `- ${fmt(inv.discount, cur)}`);
    if (Number(inv.tax_amount) > 0) row(`${inv.tax_name || 'Tax'} (${Number(inv.tax_rate)}%)`, fmt(inv.tax_amount, cur));
    if (Number(inv.delivery_charges) > 0) row('Delivery', fmt(inv.delivery_charges, cur));
    doc.roundedRect(330, y - 2, R - 330, 30, 6).fill(tpl === 'minimal' ? '#111111' : accent);
    doc.fillColor('#ffffff').font(F.b).fontSize(12).text('Total', 340, y + 7, { width: 100 }).text(fmt(inv.total, cur), 440, y + 7, { width: R - 450, align: 'right' });
    y += 40;
    if (Number(inv.paid_amount) > 0) { row('Paid', fmt(inv.paid_amount, cur)); row('Balance due', fmt(Math.max(0, inv.total - inv.paid_amount), cur), true); }
    // notes
    y = Math.max(y + 10, 560);
    const block = (title, text) => { if (!text) return; doc.fillColor(accent).font(F.b).fontSize(9).text(title.toUpperCase(), L, y); doc.fillColor('#374151').font(F.r).fontSize(9).text(String(text).replace(/<[^>]+>/g, ''), L, y + 13, { width: R - L }); y = doc.y + 12; };
    block('Payment details', s.invoice_bank_details);
    block('Notes', inv.notes);
    block('Terms & conditions', inv.terms);
    doc.fillColor('#9ca3af').font(F.r).fontSize(8).text(s.invoice_footer || `Thank you for your business - ${company}`, L, 790, { width: R - L, align: 'center' });
    doc.end();
  });
}

module.exports = { TEMPLATES, nextNumber, totals, statusOf, create, fromOrder, fromTransaction, addPayment, pdf };
