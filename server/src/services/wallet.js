/*
 * Wallet passes for a card: Apple Wallet (.pkpass) and Google Wallet ("Save to Google Wallet" link).
 * Both need accounts only the site owner can create, so everything is switched on from Admin > Settings once the credentials are pasted in:
 *   Apple:  Apple Developer account -> Pass Type ID certificate (PEM cert + private key) + Apple's WWDR certificate + Team ID
 *   Google: Google Wallet issuer ID + a service account (email + private key) that is allowed on that issuer
 * Nothing here is public until the matching "enable" switch is on and every field is filled in.
 */
const zlib = require('zlib');
const jwt = require('jsonwebtoken');
const settings = require('./settings');

const pem = (s) => String(s || '').replace(/\\n/g, '\n').trim();
const hex6 = (c, d) => (/^#[0-9a-f]{6}$/i.test(String(c || '')) ? String(c).toLowerCase() : d);
const rgb = (h) => `rgb(${parseInt(h.slice(1, 3), 16)},${parseInt(h.slice(3, 5), 16)},${parseInt(h.slice(5, 7), 16)})`;
const light = (h) => { const [r, g, b] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255); return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.55; };

/** which wallets this site can offer right now (booleans only, safe for page rendering) */
function ready(s) {
  const apple = s.apple_wallet_enable === '1' && !!(pem(s.apple_wallet_cert) && pem(s.apple_wallet_key) && pem(s.apple_wwdr_cert) && String(s.apple_pass_type_id || '').trim() && String(s.apple_team_id || '').trim());
  const google = s.google_wallet_enable === '1' && !!(String(s.google_wallet_issuer_id || '').trim() && String(s.google_wallet_sa_email || '').trim() && pem(s.google_wallet_sa_key));
  return { apple, google };
}

/* ---- a plain square PNG in one colour (pass icons are required by Apple; this keeps us free of image libraries) ---- */
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = (buf) => { let c = 0xffffffff; for (const b of buf) c = CRC[(c ^ b) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function chunk(type, data) { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td)); return Buffer.concat([len, td, crc]); }
function solidPng(size, hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const row = Buffer.concat([Buffer.from([0]), Buffer.from(Array.from({ length: size }, () => [r, g, b]).flat())]);
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(Buffer.concat(Array.from({ length: size }, () => row)))), chunk('IEND', Buffer.alloc(0))]);
}

const fullName = (v) => [v.first_name, v.last_name].filter(Boolean).join(' ') || v.name || '';
const phoneOf = (v) => (v.phone ? `${v.region_code ? `+${String(v.region_code).replace(/\D/g, '')} ` : ''}${v.phone}`.trim() : '');
const serialOf = (v) => `card-${v.id}`;

/** Apple Wallet pass (Buffer of a .pkpass) */
async function applePass(v, appUrl) {
  const s = await settings.all();
  if (!ready(s).apple) throw Object.assign(new Error('Apple Wallet is not set up'), { status: 404 });
  const { PKPass } = require('passkit-generator');
  const bg = hex6(v.theme?.primary, '#3e007d'); const fg = light(bg) ? '#111111' : '#ffffff';
  const url = `${appUrl}/${v.url_alias}`;
  const pass = new PKPass({ 'icon.png': solidPng(58, bg), 'icon@2x.png': solidPng(116, bg), 'icon@3x.png': solidPng(174, bg) },
    { wwdr: pem(s.apple_wwdr_cert), signerCert: pem(s.apple_wallet_cert), signerKey: pem(s.apple_wallet_key), signerKeyPassphrase: String(s.apple_wallet_key_pass || '') || undefined },
    { formatVersion: 1, passTypeIdentifier: String(s.apple_pass_type_id).trim(), teamIdentifier: String(s.apple_team_id).trim(), organizationName: String(v.company || s.app_name || 'Digital card').slice(0, 60), description: `${fullName(v)} digital business card`.slice(0, 80),
      serialNumber: serialOf(v), backgroundColor: rgb(bg), foregroundColor: fg === '#ffffff' ? 'rgb(255,255,255)' : 'rgb(17,17,17)', labelColor: fg === '#ffffff' ? 'rgb(235,225,255)' : 'rgb(60,60,60)', logoText: String(v.company || '').slice(0, 30) || undefined });
  pass.type = 'generic';
  pass.primaryFields.push({ key: 'name', label: String(v.job_title || v.occupation || 'Name').slice(0, 40), value: fullName(v) });
  const phone = phoneOf(v);
  if (v.company) pass.secondaryFields.push({ key: 'company', label: 'Company', value: String(v.company).slice(0, 80) });
  if (phone) pass.auxiliaryFields.push({ key: 'phone', label: 'Phone', value: phone });
  if (v.email) pass.auxiliaryFields.push({ key: 'email', label: 'E-mail', value: v.email });
  pass.backFields.push({ key: 'card', label: 'Digital card', value: url });
  if (v.social_links?.website) pass.backFields.push({ key: 'web', label: 'Website', value: String(v.social_links.website) });
  if (v.location) pass.backFields.push({ key: 'addr', label: 'Address', value: String(v.location) });
  pass.setBarcodes({ message: `${url}?via=qr`, format: 'PKBarcodeFormatQR', messageEncoding: 'iso-8859-1', altText: v.url_alias });
  return pass.getAsBuffer();
}

/** Google Wallet "Save to Google Wallet" URL (a signed link; the class and the pass travel inside it) */
async function googleSaveUrl(v, appUrl) {
  const s = await settings.all();
  if (!ready(s).google) throw Object.assign(new Error('Google Wallet is not set up'), { status: 404 });
  const issuer = String(s.google_wallet_issuer_id).trim();
  const bg = hex6(v.theme?.primary, '#3e007d'); const url = `${appUrl}/${v.url_alias}`; const lang = (txt) => ({ defaultValue: { language: 'en-US', value: String(txt).slice(0, 100) } });
  const classId = `${issuer}.nfcprofile_card`; const objectId = `${issuer}.card-${v.id}`.replace(/[^\w.-]/g, '_');
  const phone = phoneOf(v);
  const photo = v.profile_image && /^https:\/\//i.test(appUrl) ? `${appUrl}${v.profile_image}` : '';
  const object = { id: objectId, classId, state: 'ACTIVE', hexBackgroundColor: bg, cardTitle: lang(v.company || s.app_name || 'Digital card'), header: lang(fullName(v)), ...(v.job_title || v.occupation ? { subheader: lang(v.job_title || v.occupation) } : {}),
    barcode: { type: 'QR_CODE', value: `${url}?via=qr`, alternateText: v.url_alias }, ...(photo ? { logo: { sourceUri: { uri: photo }, contentDescription: lang(fullName(v)) } } : {}),
    textModulesData: [phone && { id: 'phone', header: 'Phone', body: phone }, v.email && { id: 'email', header: 'E-mail', body: v.email }].filter(Boolean),
    linksModuleData: { uris: [{ id: 'card', description: 'Open my digital card', uri: url }] } };
  const token = jwt.sign({ iss: String(s.google_wallet_sa_email).trim(), aud: 'google', typ: 'savetowallet', origins: [new URL(appUrl).origin], payload: { genericClasses: [{ id: classId }], genericObjects: [object] } }, pem(s.google_wallet_sa_key), { algorithm: 'RS256' });
  return `https://pay.google.com/gp/v/save/${token}`;
}

module.exports = { ready, applePass, googleSaveUrl, solidPng, serialOf };
