/* Print-ready HTML invoices (A4). Six templates share one structure; each has its own look. */
const dayjs = require('dayjs');
const { esc, color } = require('../utils/html');

const ACCENTS = { modern: '#6d5dfc', classic: '#1f2937', minimal: '#111111', bold: '#e11d48', elegant: '#b08d57', corporate: '#0f4c81' };
const FONTS = {
  modern: "'Plus Jakarta Sans', system-ui, sans-serif", classic: "'Libre Baskerville', Georgia, serif", minimal: "'Inter', system-ui, sans-serif",
  bold: "'Space Grotesk', system-ui, sans-serif", elegant: "'Cormorant Garamond', Georgia, serif", corporate: "'IBM Plex Sans', system-ui, sans-serif",
};
const GF = 'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;800&family=Libre+Baskerville:wght@400;700&family=Inter:wght@400;600;800&family=Space+Grotesk:wght@400;600;700&family=Cormorant+Garamond:wght@500;700&family=IBM+Plex+Sans:wght@400;600;700&display=swap';

const money = (v, cur) => `${esc(cur || '')} ${Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`.trim();
const d = (v) => (v ? dayjs(v).format('DD MMM YYYY') : '-');
const nl = (s) => esc(s).replace(/\n/g, '<br>');
const STATUS = { paid: ['Paid', '#16a34a'], partial: ['Partially paid', '#d97706'], overdue: ['Overdue', '#dc2626'], sent: ['Unpaid', '#6b7280'], draft: ['Draft', '#6b7280'], cancelled: ['Cancelled', '#6b7280'] };

const CSS = (tpl, a) => `
*{box-sizing:border-box;margin:0;padding:0}
@page{size:A4;margin:0}
html{background:#e9e9f1}
body{font-family:${FONTS[tpl]};color:#111827;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.bar{position:sticky;top:0;z-index:5;display:flex;gap:8px;justify-content:center;padding:12px;background:rgba(17,17,27,.85);backdrop-filter:blur(8px)}
.bar a,.bar button{font:600 13px system-ui,sans-serif;border:0;border-radius:10px;padding:9px 16px;cursor:pointer;text-decoration:none;background:#fff;color:#111}
.bar .p{background:${a};color:#fff}
.sheet{width:210mm;min-height:297mm;margin:24px auto;background:#fff;position:relative;overflow:hidden;box-shadow:0 30px 80px -30px rgba(15,15,40,.35);padding:18mm 16mm 24mm}
.muted{color:#6b7280}.small{font-size:11px}.up{text-transform:uppercase;letter-spacing:.14em;font-size:10px;font-weight:700}
.head{display:flex;justify-content:space-between;gap:24px;align-items:flex-start}
.brand{display:flex;gap:14px;align-items:center}.brand img{max-height:56px;max-width:140px;object-fit:contain}
.brand h1{font-size:22px;font-weight:800;letter-spacing:-.01em}
.title{text-align:right}.title h2{font-size:34px;font-weight:800;letter-spacing:-.02em;line-height:1}.title .no{margin-top:6px;font-weight:600}
.meta{display:grid;grid-template-columns:1.4fr 1fr 1fr;gap:18px;margin-top:34px}
.meta .v{margin-top:6px;font-size:13px;line-height:1.5}.meta b{font-size:15px}
.pill{display:inline-block;margin-top:8px;padding:4px 12px;border-radius:99px;color:#fff;font:700 10px system-ui,sans-serif;letter-spacing:.08em;text-transform:uppercase}
table{width:100%;border-collapse:collapse;margin-top:34px;font-size:13px}
th{text-align:left;padding:11px 12px}th.r,td.r{text-align:right}
td{padding:12px;border-bottom:1px solid #eef0f4;vertical-align:top}
.sum{display:flex;justify-content:flex-end;margin-top:18px}
.sum table{width:320px;margin:0}.sum td{border:0;padding:6px 12px}
.grand td{font-size:17px;font-weight:800;padding:12px}
.notes{display:grid;grid-template-columns:1fr 1fr;gap:22px;margin-top:40px;font-size:12px;line-height:1.6}
.notes h4{margin-bottom:6px}
.foot{position:absolute;left:16mm;right:16mm;bottom:10mm;display:flex;justify-content:space-between;font-size:10px;color:#9ca3af;border-top:1px solid #eef0f4;padding-top:8px}
.stamp{position:absolute;right:26mm;top:112mm;transform:rotate(-14deg);border:4px solid #16a34a;color:#16a34a;font:800 34px system-ui,sans-serif;padding:6px 18px;border-radius:12px;opacity:.18;letter-spacing:.1em}
/* ------------ templates */
.t-modern .sheet{padding-top:0}
.t-modern .band{margin:0 -16mm 0;padding:16mm 16mm 12mm;background:linear-gradient(135deg,${a},${a}cc 60%,#b44cf5);color:#fff;position:relative}
.t-modern .band:after{content:"";position:absolute;right:-60px;top:-80px;width:260px;height:260px;border-radius:50%;background:rgba(255,255,255,.12)}
.t-modern .band .muted{color:rgba(255,255,255,.8)}
.t-modern th{background:${a}14;color:${a};font-size:11px;text-transform:uppercase;letter-spacing:.1em}
.t-modern th:first-child{border-radius:10px 0 0 10px}.t-modern th:last-child{border-radius:0 10px 10px 0}
.t-modern .grand td{background:${a};color:#fff}.t-modern .grand td:first-child{border-radius:12px 0 0 12px}.t-modern .grand td:last-child{border-radius:0 12px 12px 0}
.t-classic .sheet{border-top:10px solid ${a}}
.t-classic .head{border-bottom:2px solid #111;padding-bottom:16px}
.t-classic .title h2{font-weight:700;letter-spacing:.12em;font-size:28px}
.t-classic th{border-top:2px solid #111;border-bottom:1px solid #111;font-size:11px;text-transform:uppercase;letter-spacing:.12em}
.t-classic .grand td{border-top:2px solid #111;border-bottom:4px double #111}
.t-minimal .title h2{font-weight:300;font-size:44px;letter-spacing:-.04em}
.t-minimal th{border-bottom:1px solid #111;font-weight:600;font-size:11px;color:#6b7280}
.t-minimal td{border-bottom:1px solid #f1f1f1}
.t-minimal .grand td{border-top:1px solid #111}
.t-bold .sheet{padding-top:0}
.t-bold .band{margin:0 -16mm;padding:16mm;background:#0b0b12;color:#fff;position:relative}
.t-bold .band:before{content:"";position:absolute;left:0;bottom:0;width:100%;height:8px;background:${a}}
.t-bold .band .muted{color:#a1a1aa}
.t-bold .title h2{font-size:52px;color:${a}}
.t-bold th{background:#0b0b12;color:#fff;font-size:11px;text-transform:uppercase;letter-spacing:.12em}
.t-bold .grand td{background:${a};color:#fff;font-size:20px}
.t-elegant .sheet{border:1px solid ${a}55;outline:8px solid #fff;outline-offset:-18px}
.t-elegant .head{flex-direction:column;align-items:center;text-align:center}
.t-elegant .brand{flex-direction:column}
.t-elegant .brand h1{font-size:30px;font-weight:700;letter-spacing:.06em}
.t-elegant .title{text-align:center}.t-elegant .title h2{font-size:18px;letter-spacing:.5em;color:${a};font-weight:700;margin-top:10px}
.t-elegant .rule{height:1px;background:linear-gradient(90deg,transparent,${a},transparent);margin:18px 0}
.t-elegant th{color:${a};border-bottom:1px solid ${a};font-size:12px;letter-spacing:.2em;text-transform:uppercase}
.t-elegant .grand td{color:${a};border-top:1px solid ${a};font-size:22px}
.t-corporate .sheet{padding-left:28mm}
.t-corporate .side{position:absolute;left:0;top:0;bottom:0;width:12mm;background:${a}}
.t-corporate .side:after{content:"";position:absolute;left:12mm;top:0;bottom:0;width:3mm;background:${a}33}
.t-corporate th{background:#eef2f7;color:#0f172a;font-size:11px;text-transform:uppercase;letter-spacing:.08em}
.t-corporate .grand td{background:#0f172a;color:#fff}
@media print{html{background:#fff}.bar{display:none}.sheet{margin:0;box-shadow:none;width:auto;min-height:297mm}}
@media screen and (max-width:820px){.sheet{width:100%;margin:0;padding:10mm 6mm 26mm}.meta,.notes{grid-template-columns:1fr}.t-modern .band,.t-bold .band{margin:0 -6mm;padding:10mm 6mm}}
`;

function renderInvoice(inv, s, { template, nonce, preview } = {}) {
  const tpl = ACCENTS[template] ? template : 'modern';
  const a = color(s.invoice_accent, ACCENTS[tpl]);
  const cur = inv.currency_icon;
  const company = s.invoice_company_name || s.app_name || 'Company';
  const logo = s.invoice_logo || s.app_logo;
  const [label, sc] = STATUS[inv.status] || STATUS.sent;
  const fromLines = [s.invoice_company_address || s.address, s.invoice_company_phone || (s.phone ? `+${s.region_code || ''} ${s.phone}` : ''), s.invoice_company_email || s.email, s.invoice_tax_id ? `Tax ID: ${s.invoice_tax_id}` : ''].filter(Boolean);
  const balance = Math.max(0, Number(inv.total) - Number(inv.paid_amount || 0));
  const head = `
    <div class="head">
      <div class="brand">${logo && /^(\/uploads\/|https:)/.test(logo) ? `<img src="${esc(logo)}" alt="">` : ''}<div><h1>${esc(company)}</h1><div class="small muted" style="margin-top:4px;line-height:1.5">${fromLines.map(esc).join('<br>')}</div></div></div>
      <div class="title"><h2>INVOICE</h2><div class="no">#${esc(inv.number)}</div></div>
    </div>`;
  return `<!doctype html><html lang="en" class="t-${tpl}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Invoice ${esc(inv.number)} - ${esc(company)}</title><link rel="stylesheet" href="${GF}"><style>${CSS(tpl, a)}</style></head><body class="t-${tpl}">
${preview ? '' : `<div class="bar"><button class="p" id="print">Print / Save as PDF</button><a href="/invoice/${esc(inv.token)}/pdf">Download PDF</a></div>`}
<div class="sheet">
  ${tpl === 'corporate' ? '<div class="side"></div>' : ''}
  ${tpl === 'modern' || tpl === 'bold' ? `<div class="band">${head}</div>` : head}
  ${tpl === 'elegant' ? '<div class="rule"></div>' : ''}
  ${inv.status === 'paid' ? '<div class="stamp">PAID</div>' : ''}
  <div class="meta">
    <div><div class="up muted">Billed to</div><div class="v"><b>${esc(inv.customer_name)}</b>${inv.customer_company ? `<br>${esc(inv.customer_company)}` : ''}${inv.customer_address ? `<br>${nl(inv.customer_address)}` : ''}${inv.customer_phone ? `<br>${esc(inv.customer_phone)}` : ''}${inv.customer_email ? `<br>${esc(inv.customer_email)}` : ''}</div></div>
    <div><div class="up muted">Issued</div><div class="v"><b>${d(inv.issue_date)}</b></div><div class="up muted" style="margin-top:14px">Due</div><div class="v"><b>${d(inv.due_date)}</b></div></div>
    <div style="text-align:right"><div class="up muted">Amount due</div><div class="v"><b style="font-size:22px">${money(balance, cur)}</b></div><span class="pill" style="background:${sc}">${label}</span></div>
  </div>
  <table><thead><tr><th>Description</th><th class="r">Qty</th><th class="r">Unit price</th><th class="r">Amount</th></tr></thead><tbody>
  ${(inv.items || []).map((it) => `<tr><td>${esc(it.description)}</td><td class="r">${esc(it.quantity)}</td><td class="r">${money(it.unit_price, cur)}</td><td class="r"><b>${money(it.total, cur)}</b></td></tr>`).join('')}
  </tbody></table>
  <div class="sum"><table>
    <tr><td class="muted">Subtotal</td><td class="r">${money(inv.subtotal, cur)}</td></tr>
    ${Number(inv.discount) > 0 ? `<tr><td class="muted">Discount</td><td class="r">- ${money(inv.discount, cur)}</td></tr>` : ''}
    ${Number(inv.tax_amount) > 0 ? `<tr><td class="muted">${esc(inv.tax_name || 'Tax')} (${Number(inv.tax_rate)}%)</td><td class="r">${money(inv.tax_amount, cur)}</td></tr>` : ''}
    ${Number(inv.delivery_charges) > 0 ? `<tr><td class="muted">Delivery</td><td class="r">${money(inv.delivery_charges, cur)}</td></tr>` : ''}
    <tr class="grand"><td>Total</td><td class="r">${money(inv.total, cur)}</td></tr>
    ${Number(inv.paid_amount) > 0 ? `<tr><td class="muted">Paid</td><td class="r">- ${money(inv.paid_amount, cur)}</td></tr><tr><td><b>Balance due</b></td><td class="r"><b>${money(balance, cur)}</b></td></tr>` : ''}
  </table></div>
  <div class="notes">
    ${s.invoice_bank_details ? `<div><h4 class="up" style="color:${a}">Payment details</h4><div>${nl(s.invoice_bank_details)}</div></div>` : ''}
    ${inv.notes ? `<div><h4 class="up" style="color:${a}">Notes</h4><div>${nl(String(inv.notes).replace(/<[^>]+>/g, ''))}</div></div>` : ''}
    ${inv.terms ? `<div style="grid-column:1/-1"><h4 class="up" style="color:${a}">Terms &amp; conditions</h4><div class="muted">${nl(String(inv.terms).replace(/<[^>]+>/g, ''))}</div></div>` : ''}
  </div>
  <div class="foot"><span>${esc(s.invoice_footer || `Thank you for your business - ${company}`)}</span><span>${esc(inv.number)}</span></div>
</div>
${preview ? '' : `<script nonce="${nonce}">document.getElementById('print').addEventListener('click',function(){window.print()});</script>`}
</body></html>`;
}

module.exports = { renderInvoice };
