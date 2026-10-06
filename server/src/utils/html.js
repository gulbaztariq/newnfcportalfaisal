const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
/** Only allow http(s)/mailto/tel URLs into href attributes */
const url = (u) => { const s = String(u ?? '').trim(); return /^(https?:|mailto:|tel:|\/)/i.test(s) ? esc(s) : '#'; };
/** Only allow hex colours into CSS */
const color = (c, def) => (/^#[0-9a-f]{3,8}$/i.test(String(c || '')) ? c : def);
const nl2br = (s) => esc(s).replace(/\n/g, '<br>');
module.exports = { esc, url, color, nl2br };
