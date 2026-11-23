/*
 * Email signatures: email-safe HTML (tables + inline styles, no scripts, no SVG, no web fonts) built from a vCard.
 * Every link carries campaign tags, so clicks from signatures show up under Analytics > Campaigns as "email-signature".
 */
const qrstyle = require('./qrstyle');

const STYLES = { classic: 'Classic', modern: 'Modern bar', compact: 'Compact', banner: 'With button' };
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const hex = (c, d) => (/^#[0-9a-f]{6}$/i.test(String(c || '')) ? String(c).toLowerCase() : d);
const safeUrl = (u) => (/^https?:\/\//i.test(String(u || '').trim()) ? esc(String(u).trim()) : '');
const NETS = [['linkedin', 'LinkedIn'], ['instagram', 'Instagram'], ['facebook', 'Facebook'], ['twitter', 'X'], ['youtube', 'YouTube'], ['tiktok', 'TikTok'], ['whatsapp', 'WhatsApp']];

/** @param {object} v vcard row  @param {{style,color,photo,qr,social,button}} o  @param {string} appUrl */
function build(v, o = {}, appUrl = '') {
  const style = STYLES[o.style] ? o.style : 'classic';
  const color = hex(o.color, hex(v.theme?.primary, '#3e007d'));
  const name = [v.first_name, v.last_name].filter(Boolean).join(' ') || v.name || '';
  const title = [v.job_title || v.occupation, v.company].filter(Boolean).join(' | ');
  const tag = '?utm_source=email-signature&utm_medium=email&utm_campaign=signature';
  const card = `${appUrl}/${encodeURIComponent(v.url_alias)}${tag}`;
  const vcf = `${appUrl}/${encodeURIComponent(v.url_alias)}/contact.vcf`;
  const phone = v.phone ? `${v.region_code ? `+${String(v.region_code).replace(/\D/g, '')} ` : ''}${v.phone}`.trim() : '';
  const digits = phone.replace(/[^\d+]/g, '');
  const photo = o.photo !== false && v.profile_image ? `${appUrl}${v.profile_image}` : '';
  const qr = o.qr && !qrstyle.isStyled(v.qr_settings) ? `${appUrl}/${encodeURIComponent(v.url_alias)}/qr.png` : '';
  const site = safeUrl(v.social_links?.website);
  const F = "font-family:Arial,Helvetica,sans-serif;";
  const a = (href, text, extra = '') => `<a href="${href}" style="color:${color};text-decoration:none;${extra}">${text}</a>`;
  const rows = [
    phone && `<tr><td style="${F}font-size:13px;color:#444444;padding:1px 0;">${a(`tel:${esc(digits)}`, esc(phone), 'color:#444444;')}</td></tr>`,
    v.email && `<tr><td style="${F}font-size:13px;color:#444444;padding:1px 0;">${a(`mailto:${esc(v.email)}`, esc(v.email), 'color:#444444;')}</td></tr>`,
    site && `<tr><td style="${F}font-size:13px;padding:1px 0;">${a(site, esc(site.replace(/^https?:\/\/(www\.)?/i, '').replace(/\/$/, '')))}</td></tr>`,
    v.location && `<tr><td style="${F}font-size:12px;color:#777777;padding:1px 0;">${esc(v.location)}</td></tr>`,
  ].filter(Boolean).join('');
  const links = o.social === false ? '' : NETS.map(([k, l]) => { const u = k === 'whatsapp' ? (String(v.social_links?.whatsapp || '').match(/\d{6,}/) ? `https://wa.me/${String(v.social_links.whatsapp).match(/\d{6,}/)[0]}` : '') : safeUrl(v.social_links?.[k]); return u && a(u, l, 'font-weight:bold;'); }).filter(Boolean).join(' &nbsp;|&nbsp; ');
  const social = links ? `<tr><td style="${F}font-size:12px;padding-top:6px;">${links}</td></tr>` : '';
  const label = esc(String(o.button || 'Save my contact').slice(0, 40));
  const button = `<tr><td style="padding-top:10px;"><a href="${vcf}" style="${F}display:inline-block;background:${color};color:#ffffff;font-size:12px;font-weight:bold;text-decoration:none;padding:8px 14px;border-radius:4px;">${label}</a> <a href="${card}" style="${F}display:inline-block;color:${color};font-size:12px;font-weight:bold;text-decoration:none;padding:8px 6px;">View my digital card</a></td></tr>`;
  const head = `<tr><td style="${F}font-size:16px;font-weight:bold;color:#111111;padding-bottom:1px;">${esc(name)}</td></tr>${title ? `<tr><td style="${F}font-size:13px;color:${color};padding-bottom:6px;">${esc(title)}</td></tr>` : ''}`;
  const img = (size, round) => (photo ? `<img src="${esc(photo)}" width="${size}" height="${size}" alt="${esc(name)}" style="display:block;width:${size}px;height:${size}px;object-fit:cover;border-radius:${round ? '50%' : '6px'};border:0;">` : '');
  const qrImg = qr ? `<td style="padding-left:14px;vertical-align:middle;"><a href="${card}"><img src="${esc(qr)}" width="84" height="84" alt="Scan for my digital card" style="display:block;border:0;"></a></td>` : '';
  let body;
  if (style === 'compact') {
    body = `<table cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;"><tr><td style="${F}font-size:13px;color:#444444;"><b style="color:#111111;">${esc(name)}</b>${title ? ` | <span style="color:${color};">${esc(title)}</span>` : ''}<br>${[phone && a(`tel:${esc(digits)}`, esc(phone), 'color:#444444;'), v.email && a(`mailto:${esc(v.email)}`, esc(v.email), 'color:#444444;'), a(card, 'My digital card')].filter(Boolean).join(' &nbsp;|&nbsp; ')}</td></tr></table>`;
  } else if (style === 'modern') {
    body = `<table cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;"><tr><td style="width:4px;background:${color};font-size:0;line-height:0;">&nbsp;</td><td style="padding-left:12px;"><table cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;"><tr>${photo ? `<td style="vertical-align:top;padding-right:12px;">${img(72, true)}</td>` : ''}<td style="vertical-align:top;"><table cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">${head}${rows}${social}</table></td>${qrImg}</tr></table></td></tr></table>`;
  } else {
    body = `<table cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;"><tr>${photo ? `<td style="vertical-align:top;padding-right:14px;">${img(80, false)}</td>` : ''}<td style="vertical-align:top;${photo ? `border-left:2px solid ${color};padding-left:14px;` : ''}"><table cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">${head}${rows}${social}${style === 'banner' ? button : `<tr><td style="${F}font-size:12px;padding-top:6px;">${a(card, 'View my digital card', 'font-weight:bold;')}</td></tr>`}</table></td>${qrImg}</tr></table>`;
  }
  return body;
}

module.exports = { build, STYLES };
