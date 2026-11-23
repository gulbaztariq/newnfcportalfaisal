/*
 * Google Contacts sync. A card owner connects their own Google account (OAuth, scope "contacts") and every new lead
 * from their cards is added to their Google Contacts (people.googleapis.com createContact). Their phone then has the lead.
 *  - the platform needs ONE Google OAuth client (Admin > Settings: client ID + client secret); each user only clicks Connect
 *  - the user's refresh token is stored AES-sealed (same as other per-user secrets) and never sent to the browser
 *  - redirect URI to register in Google Cloud: <APP_URL>/api/public/integrations/google/callback
 *  - a lead is pushed once (enquiry.google_contact keeps the Google resource name)
 */
const crypto = require('crypto');
const M = require('../models');
const settings = require('./settings');
const usersettings = require('./usersettings');
const { appUrl, jwtSecret } = require('../config');

const SCOPE = 'openid email https://www.googleapis.com/auth/contacts';
const redirectUri = () => `${appUrl}/api/public/integrations/google/callback`;
const b64 = (s) => Buffer.from(s).toString('base64url');

async function config() {
  const [id, secret] = await Promise.all([settings.get('google_client_id'), settings.get('google_client_secret')]);
  return { id: String(id || '').trim(), secret: String(secret || '').trim(), configured: !!(id && secret) };
}

/** short-lived signed state so the callback knows which user is connecting (and cannot be forged) */
const sign = (body) => crypto.createHmac('sha256', `google-state:${jwtSecret}`).update(body).digest('base64url');
function makeState(userId) { const body = b64(JSON.stringify({ u: userId, e: Date.now() + 10 * 60 * 1000 })); return `${body}.${sign(body)}`; }
function readState(state) {
  const [body, sig] = String(state || '').split('.');
  if (!body || !sig || sig.length !== sign(body).length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(sign(body)))) return null;
  try { const p = JSON.parse(Buffer.from(body, 'base64url').toString()); return p.e > Date.now() && Number.isInteger(p.u) ? p.u : null; } catch { return null; }
}

async function authUrl(userId) {
  const c = await config(); if (!c.configured) throw Object.assign(new Error('Google Contacts is not set up by the administrator yet'), { status: 422 });
  const q = new URLSearchParams({ client_id: c.id, redirect_uri: redirectUri(), response_type: 'code', scope: SCOPE, access_type: 'offline', prompt: 'consent', state: makeState(userId) });
  return `https://accounts.google.com/o/oauth2/v2/auth?${q}`;
}

async function tokenCall(params) {
  const c = await config();
  const res = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: c.id, client_secret: c.secret, ...params }), signal: AbortSignal.timeout(10000) });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(body.error_description || body.error || `Google answered ${res.status}`), { code: body.error });
  return body;
}

async function rowOf(userId) { return M.UserSetting.findOne({ where: { user_id: userId } }); }
async function writeState(userId, { data = {}, secrets = {}, dropSecrets = [] }) {
  const [row] = await M.UserSetting.findOrCreate({ where: { user_id: userId }, defaults: { data: {} } });
  const s = usersettings.open(row.secrets); for (const k of dropSecrets) delete s[k];
  await row.update({ data: { ...(row.data || {}), ...data }, secrets: usersettings.seal({ ...s, ...secrets }) });
}

/** callback: swap the code for tokens and remember the refresh token + the Google address */
async function connect(userId, code) {
  const t = await tokenCall({ code, grant_type: 'authorization_code', redirect_uri: redirectUri() });
  if (!t.refresh_token) throw new Error('Google did not return offline access. Remove the app from your Google account permissions and connect again.');
  let email = '';
  try { email = JSON.parse(Buffer.from(String(t.id_token).split('.')[1], 'base64url').toString()).email || ''; } catch { /* optional */ }
  await writeState(userId, { data: { google_email: email, google_sync: '1' }, secrets: { google_refresh_token: t.refresh_token } });
  return email;
}
async function disconnect(userId) {
  const row = await rowOf(userId); const token = usersettings.open(row?.secrets).google_refresh_token;
  if (token) fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`, { method: 'POST', signal: AbortSignal.timeout(8000) }).catch(() => {});
  await writeState(userId, { data: { google_email: '', google_sync: '0' }, dropSecrets: ['google_refresh_token'] });
}
async function status(userId) {
  const c = await config(); const row = await rowOf(userId); const has = !!usersettings.open(row?.secrets).google_refresh_token;
  return { configured: c.configured, connected: has, email: has ? row.data?.google_email || '' : '', auto: has && row.data?.google_sync === '1', redirect_uri: redirectUri() };
}
const setAuto = (userId, on) => writeState(userId, { data: { google_sync: on ? '1' : '0' } });

async function accessToken(userId) {
  const row = await rowOf(userId); const refresh = usersettings.open(row?.secrets).google_refresh_token;
  if (!refresh) return null;
  try { return (await tokenCall({ refresh_token: refresh, grant_type: 'refresh_token' })).access_token; } catch (e) {
    if (e.code === 'invalid_grant') await writeState(userId, { data: { google_email: '', google_sync: '0' }, dropSecrets: ['google_refresh_token'] }); // revoked in Google: forget it
    throw e;
  }
}

const cleanPhone = (p) => String(p || '').replace(/[^\d+]/g, '').slice(0, 30);
/** the People API body for a lead */
function personOf(lead, cardName) {
  const parts = String(lead.name || '').trim().split(/\s+/); const given = parts.shift() || 'Lead';
  const note = `Lead from "${cardName || 'your NFC card'}" (NFC Profile)${lead.message ? `: ${String(lead.message).slice(0, 300)}` : ''}`;
  return {
    names: [{ givenName: given, familyName: parts.join(' ') || undefined }],
    ...(lead.email ? { emailAddresses: [{ value: lead.email }] } : {}), ...(cleanPhone(lead.phone) ? { phoneNumbers: [{ value: cleanPhone(lead.phone) }] } : {}),
    biographies: [{ value: note, contentType: 'TEXT_PLAIN' }],
  };
}
/** push one stored lead (VcardEnquiry row) to the owner's Google Contacts; returns the resource name */
async function pushLead(userId, enquiry, cardName, token) {
  if (enquiry.google_contact) return enquiry.google_contact;
  const t = token || await accessToken(userId); if (!t) return null;
  const res = await fetch('https://people.googleapis.com/v1/people:createContact', { method: 'POST', headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' }, body: JSON.stringify(personOf(enquiry, cardName)), signal: AbortSignal.timeout(10000) });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error?.message || `Google answered ${res.status}`);
  await enquiry.update({ google_contact: String(body.resourceName || '').slice(0, 100) || 'created' });
  return body.resourceName;
}
/** new lead on a card: add it to Google Contacts when the owner connected and left auto-sync on. Never throws. */
function onLead(userId, enquiry, card) {
  (async () => {
    const s = await status(userId); if (!s.connected || !s.auto) return;
    await pushLead(userId, enquiry, card?.name);
  })().catch((e) => console.error('[google contacts]', e.message));
}
/** "send existing leads": every lead of the owner not yet in Google (newest first, at most 200 per run) */
async function syncAll(userId) {
  const token = await accessToken(userId); if (!token) throw Object.assign(new Error('Connect your Google account first'), { status: 422 });
  const cards = await M.Vcard.findAll({ where: { user_id: userId }, attributes: ['id', 'name'], raw: true });
  const names = Object.fromEntries(cards.map((c) => [c.id, c.name]));
  const leads = await M.VcardEnquiry.findAll({ where: { vcard_id: cards.map((c) => c.id), google_contact: null }, order: [['id', 'DESC']], limit: 200 });
  let sent = 0; const errors = [];
  for (const l of leads) { try { await pushLead(userId, l, names[l.vcard_id], token); sent += 1; } catch (e) { errors.push(e.message); if (errors.length >= 3) break; } }
  return { sent, remaining: Math.max(0, leads.length - sent), error: errors[0] || null };
}

module.exports = { config, authUrl, connect, disconnect, status, setAuto, readState, onLead, syncAll, pushLead, personOf, redirectUri, SCOPE };
