/* PDF invoices / plan sheets and CSV / XLSX / PDF exports */
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');
const dayjs = require('dayjs');
const settings = require('./settings');

const money = (v, cur = '$') => `${cur}${Number(v || 0).toFixed(2)}`;

function pdfToBuffer(build) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 48 });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c)); doc.on('end', () => resolve(Buffer.concat(chunks))); doc.on('error', reject);
    build(doc);
    doc.end();
  });
}

function header(doc, s, title, sub) {
  doc.rect(0, 0, doc.page.width, 110).fill('#6d5dfc');
  doc.fillColor('#ffffff').fontSize(22).font('Helvetica-Bold').text(s.app_name || 'NFC Profile', 48, 36);
  doc.fontSize(10).font('Helvetica').text([s.email, s.phone && `+${s.region_code} ${s.phone}`, s.address].filter(Boolean).join('  ·  '), 48, 66, { width: 330 });
  doc.fontSize(20).font('Helvetica-Bold').text(title, 360, 36, { width: 190, align: 'right' });
  if (sub) doc.fontSize(10).font('Helvetica').text(sub, 360, 66, { width: 190, align: 'right' });
  doc.fillColor('#27273a').moveDown(4);
}

/**
 * invoice({ number, date, status, billTo:{name,email,address}, items:[{description,qty,price}], subtotal, discount, taxName, taxAmount, total, currency, method })
 */
async function invoicePdf(inv) {
  const s = await settings.all();
  return pdfToBuffer((doc) => {
    header(doc, s, 'INVOICE', `#${inv.number}`);
    const y = 140;
    doc.fontSize(9).fillColor('#8b8ba7').text('BILLED TO', 48, y).text('DETAILS', 360, y);
    doc.fontSize(11).fillColor('#27273a').font('Helvetica-Bold').text(inv.billTo.name || '-', 48, y + 14).font('Helvetica')
      .fontSize(10).text([inv.billTo.email, inv.billTo.address].filter(Boolean).join('\n'), 48, y + 30, { width: 280 });
    doc.fontSize(10).text(`Date: ${dayjs(inv.date).format('DD MMM YYYY')}\nStatus: ${String(inv.status || '').toUpperCase()}\nPayment: ${inv.method || '-'}`, 360, y + 14, { width: 190, align: 'right' });

    let ty = 250;
    doc.rect(48, ty, 499, 26).fill('#f2f0ff');
    doc.fillColor('#27273a').font('Helvetica-Bold').fontSize(10)
      .text('Description', 60, ty + 8).text('Qty', 330, ty + 8, { width: 40, align: 'right' }).text('Price', 380, ty + 8, { width: 70, align: 'right' }).text('Amount', 460, ty + 8, { width: 80, align: 'right' });
    doc.font('Helvetica');
    ty += 34;
    for (const it of inv.items) {
      doc.text(it.description, 60, ty, { width: 260 }).text(String(it.qty), 330, ty, { width: 40, align: 'right' })
        .text(money(it.price, inv.currency), 380, ty, { width: 70, align: 'right' }).text(money(it.price * it.qty, inv.currency), 460, ty, { width: 80, align: 'right' });
      ty += 24;
      doc.moveTo(48, ty - 6).lineTo(547, ty - 6).strokeColor('#ececf5').stroke();
    }
    const row = (label, val, bold) => { doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(bold ? 12 : 10).text(label, 330, ty, { width: 120, align: 'right' }).text(val, 460, ty, { width: 80, align: 'right' }); ty += bold ? 22 : 18; };
    ty += 6;
    row('Subtotal', money(inv.subtotal, inv.currency));
    if (Number(inv.discount) > 0) row('Discount', `-${money(inv.discount, inv.currency)}`);
    if (Number(inv.taxAmount) > 0) row(inv.taxName || 'Tax', money(inv.taxAmount, inv.currency));
    if (Number(inv.delivery) > 0) row('Delivery', money(inv.delivery, inv.currency));
    doc.moveTo(330, ty).lineTo(547, ty).strokeColor('#6d5dfc').stroke(); ty += 8;
    row('Total', money(inv.total, inv.currency), true);
    doc.fontSize(9).fillColor('#8b8ba7').text('Thank you for your business.', 48, 760, { align: 'center', width: 499 });
  });
}

/** Plan brochure PDF (plan comparison sheet users can download) */
async function planPdf(plan, featureLabels) {
  const s = await settings.all();
  const cur = plan.currency?.currency_icon || '$';
  return pdfToBuffer((doc) => {
    header(doc, s, plan.name.toUpperCase(), 'Subscription plan');
    doc.fontSize(30).font('Helvetica-Bold').fillColor('#6d5dfc').text(`${cur}${Number(plan.price).toFixed(2)}`, 48, 140);
    doc.fontSize(11).font('Helvetica').fillColor('#8b8ba7').text(plan.custom_duration_days ? `for ${plan.custom_duration_days} days` : plan.frequency === 'unlimited' ? 'lifetime' : `per ${plan.frequency === 'yearly' ? 'year' : 'month'}`, 48, 178);
    let y = 215;
    const line = (t, on = true) => { doc.fillColor(on ? '#16a34a' : '#c4c4d4').font('Helvetica-Bold').text(on ? '+' : '-', 48, y).fillColor(on ? '#27273a' : '#a0a0b8').font('Helvetica').text(t, 66, y); y += 20; };
    line(`${plan.no_of_vcards} vCards`); line(`${plan.trial_days || 0} trial days`); line(`${plan.storage_limit} MB storage`);
    line(plan.no_of_visitors ? `${plan.no_of_visitors} card visits per period` : 'Unlimited card visits');
    if (Number(plan.tax_rate) > 0) line(`${plan.tax_name || 'Tax'} ${Number(plan.tax_rate)}% applies`);
    y += 8;
    for (const [k, l] of Object.entries(featureLabels)) line(l, !!plan.features?.[k]);
  });
}

/** rows: array of objects, columns: [{key,label}] */
async function exportRows(format, title, columns, rows) {
  if (format === 'csv') {
    const cell = (v) => { const s = String(v ?? ''); return /[",\n]/.test(s) || /^[=+\-@]/.test(s) ? `"${s.replace(/^([=+\-@])/, "'$1").replace(/"/g, '""')}"` : s; };
    return { body: Buffer.from(`﻿${[columns.map((c) => c.label).join(','), ...rows.map((r) => columns.map((c) => cell(r[c.key])).join(','))].join('\r\n')}`), type: 'text/csv; charset=utf-8', ext: 'csv' };
  }
  if (format === 'xlsx' || format === 'xls') {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet(title.slice(0, 30));
    ws.columns = columns.map((c) => ({ header: c.label, key: c.key, width: Math.max(12, c.label.length + 4) }));
    ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF6D5DFC' } };
    rows.forEach((r) => ws.addRow(Object.fromEntries(columns.map((c) => [c.key, r[c.key] ?? '']))));
    return { body: Buffer.from(await wb.xlsx.writeBuffer()), type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', ext: 'xlsx' };
  }
  const s = await settings.all();
  const body = await pdfToBuffer((doc) => {
    header(doc, s, title.toUpperCase(), dayjs().format('DD MMM YYYY'));
    let y = 140;
    const w = 499 / columns.length;
    doc.rect(48, y, 499, 22).fill('#f2f0ff'); doc.fillColor('#27273a').font('Helvetica-Bold').fontSize(9);
    columns.forEach((c, i) => doc.text(c.label, 52 + i * w, y + 7, { width: w - 8 }));
    y += 28; doc.font('Helvetica');
    for (const r of rows) {
      if (y > 780) { doc.addPage(); y = 48; }
      const h = Math.max(...columns.map((c) => doc.heightOfString(String(r[c.key] ?? ''), { width: w - 8 })));
      columns.forEach((c, i) => doc.text(String(r[c.key] ?? ''), 52 + i * w, y, { width: w - 8 }));
      y += h + 8;
    }
  });
  return { body, type: 'application/pdf', ext: 'pdf' };
}

module.exports = { invoicePdf, planPdf, exportRows };
