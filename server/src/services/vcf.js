/* Builds the downloadable .vcf contact file (vCard 3.0, RFC 2426) for a card.
   Works on iPhone Contacts, Android / Google Contacts, Outlook and macOS Contacts. */
const fs = require('fs');
const path = require('path');
const { uploadDir } = require('../config');

/** text values: backslash, comma, semicolon and line breaks must be escaped; control characters dropped */
const esc = (s) => String(s ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').replace(/\\/g, '\\\\').replace(/\r?\n|\r/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;').trim();
/** URI values only need line breaks removed */
const uri = (s) => String(s ?? '').replace(/[\r\n\u0000-\u001f]/g, '').trim();
/** lines longer than 75 octets are folded with CRLF + one space */
function fold(line) {
  const buf = Buffer.from(line, 'utf8');
  if (buf.length <= 75) return line;
  const out = []; let i = 0; let first = true;
  while (i < buf.length) {
    let end = Math.min(i + (first ? 75 : 74), buf.length);
    while (end < buf.length && (buf[end] & 0xc0) === 0x80) end -= 1; // never cut inside a UTF-8 character
    out.push((first ? '' : ' ') + buf.slice(i, end).toString('utf8'));
    i = end; first = false;
  }
  return out.join('\r\n');
}
/** +<country><number>: drops the trunk "0" and any spaces/dashes */
function e164(region, phone) {
  const digits = String(phone || '').replace(/[^\d+]/g, '');
  if (!digits) return '';
  if (digits.startsWith('+')) return digits;
  const r = String(region || '').replace(/\D/g, '');
  return r ? `+${r}${digits.replace(/^0+/, '')}` : digits;
}
const SOCIAL_BASE = { facebook: 1, instagram: 1, twitter: 1, linkedin: 1, youtube: 1, tiktok: 1, pinterest: 1, github: 1, telegram: 1, snapchat: 1, behance: 1, dribbble: 1 };
const safeUrl = (u) => (/^https?:\/\//i.test(String(u || '').trim()) ? uri(u) : '');

/** profile photo as base64 (the phone shows it in Contacts); only small local JPEG/PNG files, anything else is skipped */
function photoLine(rel) {
  try {
    const m = /^\/uploads\/([\w./-]+)$/.exec(String(rel || ''));
    if (!m || m[1].includes('..')) return '';
    const file = path.join(uploadDir, m[1]);
    if (!file.startsWith(path.resolve(uploadDir) + path.sep) || !fs.existsSync(file)) return '';
    const buf = fs.readFileSync(file);
    if (!buf.length || buf.length > 300 * 1024) return '';
    const type = buf[0] === 0xff && buf[1] === 0xd8 ? 'JPEG' : buf.slice(1, 4).toString() === 'PNG' ? 'PNG' : '';
    return type ? `PHOTO;ENCODING=b;TYPE=${type}:${buf.toString('base64')}` : '';
  } catch { return ''; }
}

/** @param {object} v the vcard row  @param {{appUrl?:string}} [opts] */
function vcardFile(v, opts = {}) {
  const first = v.first_name || (v.last_name ? '' : v.name) || '';
  const full = [v.first_name, v.last_name].filter(Boolean).join(' ') || v.name || '';
  const L = ['BEGIN:VCARD', 'VERSION:3.0', `PRODID:-//NFC Profile//vCard//EN`, `N:${esc(v.last_name)};${esc(first)};;;`, `FN:${esc(full)}`];
  if (v.company) L.push(`ORG:${esc(v.company)}`);
  const title = v.job_title || v.occupation;
  if (title) L.push(`TITLE:${esc(title)}`);
  const cell = e164(v.region_code, v.phone);
  if (cell) L.push(`TEL;TYPE=CELL,VOICE,PREF:${uri(cell)}`);
  const alt = e164(v.region_code, v.alternative_phone);
  if (alt) L.push(`TEL;TYPE=WORK,VOICE:${uri(alt)}`);
  if (v.email) L.push(`EMAIL;TYPE=INTERNET,PREF:${uri(v.email)}`);
  if (v.alternative_email) L.push(`EMAIL;TYPE=INTERNET,WORK:${uri(v.alternative_email)}`);
  if (v.location) L.push(`ADR;TYPE=WORK:;;${esc(v.location)};;;;`, `LABEL;TYPE=WORK:${esc(v.location)}`);
  const web = safeUrl(v.social_links?.website);
  if (web) L.push(`URL;TYPE=WORK:${web}`);
  if (opts.appUrl && v.url_alias) L.push(`URL;TYPE=PROFILE:${uri(opts.appUrl)}/${encodeURIComponent(v.url_alias)}`);
  for (const k of Object.keys(SOCIAL_BASE)) {
    const u = safeUrl(v.social_links?.[k]);
    if (u) L.push(`X-SOCIALPROFILE;TYPE=${k}:${u}`);
  }
  const wa = String(v.social_links?.whatsapp || '').match(/\d{6,}/);
  if (wa) L.push(`X-SOCIALPROFILE;TYPE=whatsapp:https://wa.me/${wa[0]}`);
  if (v.dob) L.push(`BDAY:${uri(v.dob)}`);
  if (v.description) L.push(`NOTE:${esc(String(v.description).slice(0, 500))}`);
  const photo = photoLine(v.profile_image);
  if (photo) L.push(photo);
  L.push(`REV:${new Date().toISOString().replace(/[-:]|\.\d+/g, '')}`, 'END:VCARD');
  return `${L.map(fold).join('\r\n')}\r\n`;
}

module.exports = { vcardFile, e164, esc };
