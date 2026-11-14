/*
 * WhatsApp QR gateway: links WhatsApp numbers by scanning a QR code (like WhatsApp Web) using Baileys, receives messages as leads,
 * and sends replies slowly under the safety rules in wasafety.js.
 *
 * Runs inside the web app. Only ONE process may hold the connections (WhatsApp logs a number out if two clients use it), so a
 * database lease decides which one. Everything else talks to it through the database: the admin page asks for a connection by
 * setting line.command, the QR code and status are written to the line, and replies wait in whatsapp_messages (status "queued")
 * until this process sends them. This also works when the host starts several copies of the app.
 *
 * Unofficial: WhatsApp can ban numbers used this way. Every limit here exists to keep the numbers looking like a person.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { Op } = require('sequelize');
const M = require('../models');
const settings = require('./settings');
const wa = require('./whatsapp');
const safety = require('./wasafety');
const config = require('../config');

const ME = `${os.hostname()}-${process.pid}-${crypto.randomBytes(3).toString('hex')}`;
const LEASE_MS = 60 * 1000;
const TICK_MS = 3000;
const sessionRoot = () => process.env.WA_SESSION_DIR || path.join(path.dirname(config.uploadDir), 'nfc-wa-sessions'); // outside the app folder: survives redeploys
const sessionDir = (id) => path.join(sessionRoot(), `line-${id}`);

const sockets = new Map(); // line id -> { sock, status, retries: [timestamps], timer, lastSendAt }
let baileys = null; let timer = null; let owner = false; let busy = false; let lastError = null;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function lib() {
  if (!baileys) baileys = await import('@whiskeysockets/baileys'); // ESM package, loaded lazily: the app still runs if it is missing
  return baileys;
}

/* ------------------------------------------------------------------ lease */
async function holdLease() {
  const now = new Date();
  await M.WaLease.findOrCreate({ where: { id: 1 }, defaults: { holder: null, until: new Date(0) } });
  const [n] = await M.WaLease.update({ holder: ME, until: new Date(now.getTime() + LEASE_MS) }, { where: { id: 1, [Op.or]: [{ holder: ME }, { holder: null }, { until: { [Op.lt]: now } }] } });
  return n > 0;
}
async function releaseLease() { await M.WaLease.update({ until: new Date(0), holder: null }, { where: { id: 1, holder: ME } }).catch(() => {}); }

/* ------------------------------------------------------------ connections */
const setLine = (id, patch) => M.WhatsappLine.update(patch, { where: { id } }).catch((e) => console.error('wa line', e.message));

async function closeSocket(id) {
  const e = sockets.get(id); if (!e) return;
  sockets.delete(id); clearTimeout(e.timer);
  try { e.sock.ev.removeAllListeners(); e.sock.end(undefined); } catch { /* already closed */ }
}

function textFrom(b, message) {
  const m = b.normalizeMessageContent(message) || {};
  if (m.conversation) return m.conversation;
  if (m.extendedTextMessage?.text) return m.extendedTextMessage.text;
  for (const k of ['imageMessage', 'videoMessage', 'documentMessage']) if (m[k]) return `[${k.replace('Message', '')}]${m[k].caption ? ` ${m[k].caption}` : ''}`;
  if (m.audioMessage) return '[voice message]';
  if (m.locationMessage) return '[location]';
  if (m.contactMessage || m.contactsArrayMessage) return '[shared a contact]';
  if (m.stickerMessage) return '[sticker]';
  if (m.buttonsResponseMessage?.selectedDisplayText) return m.buttonsResponseMessage.selectedDisplayText;
  if (m.listResponseMessage?.title) return m.listResponseMessage.title;
  return '';
}

async function onMessages(line, b, { messages, type }) {
  if (type !== 'notify') return; // history sync is never imported
  for (const msg of messages) {
    try {
      const jid = msg.key?.remoteJid || '';
      if (msg.key.fromMe || !msg.message) continue;
      if (jid.endsWith('@g.us') || jid.endsWith('@broadcast') || jid.endsWith('@newsletter') || jid === 'status@broadcast') continue; // people only, never groups or status
      const real = jid.endsWith('@lid') ? (msg.key.remoteJidAlt || msg.key.senderPn || null) : jid; // WhatsApp hides some numbers behind a LID
      const waId = String(real || jid).split('@')[0].split(':')[0].replace(/\D/g, '');
      if (!waId) continue;
      const text = textFrom(b, msg.message);
      if (!text) continue;
      const fresh = await M.WhatsappLine.findByPk(line.id);
      if (!fresh || !fresh.status) continue;
      await wa.receive(fresh, { waId, jid, name: msg.pushName, text, msgId: msg.key.id });
    } catch (e) { console.error('wa inbound', e.message); }
  }
}

async function connect(line) {
  const b = await lib();
  await closeSocket(line.id);
  fs.mkdirSync(sessionDir(line.id), { recursive: true, mode: 0o700 });
  const { state, saveCreds } = await b.useMultiFileAuthState(sessionDir(line.id));
  const { version } = await b.fetchLatestBaileysVersion().catch(() => ({}));
  const make = b.makeWASocket || b.default;
  const s = make({
    auth: state, version, browser: b.Browsers.macOS('Chrome'), logger: require('pino')({ level: 'silent' }),
    syncFullHistory: false, markOnlineOnConnect: false, generateHighQualityLinkPreview: false, shouldSyncHistoryMessage: () => false, // no history import, and the phone keeps its own "online" status
  });
  const entry = { sock: s, status: 'connecting', retries: sockets.get(line.id)?.retries || [], timer: null, lastSendAt: 0 };
  sockets.set(line.id, entry);
  await setLine(line.id, { qr_status: 'connecting', command: null });

  s.ev.on('creds.update', saveCreds);
  s.ev.on('messages.upsert', (ev) => onMessages(line, b, ev));
  s.ev.on('connection.update', async (u) => {
    if (sockets.get(line.id) !== entry) return;
    if (u.qr) { entry.status = 'qr'; await setLine(line.id, { qr_status: 'qr', qr_code: u.qr }); }
    if (u.connection === 'open') {
      entry.status = 'connected';
      const phone = String(s.user?.id || '').split(':')[0].split('@')[0];
      await setLine(line.id, { qr_status: 'connected', qr_code: null, display_phone: phone ? `+${phone}` : null, connected_at: (await M.WhatsappLine.findByPk(line.id))?.connected_at || new Date() });
    }
    if (u.connection === 'close') {
      const code = u.lastDisconnect?.error?.output?.statusCode;
      await closeSocket(line.id);
      if (code === b.DisconnectReason.loggedOut) { // unlinked from the phone: wipe the session, never retry on its own
        fs.rmSync(sessionDir(line.id), { recursive: true, force: true });
        return setLine(line.id, { qr_status: 'logged_out', qr_code: null, connected_at: null });
      }
      if (code === b.DisconnectReason.connectionReplaced) return setLine(line.id, { qr_status: 'paused', qr_code: null }); // another client took the session: do not fight for it
      const now = Date.now(); entry.retries = entry.retries.filter((t) => now - t < 3600 * 1000); entry.retries.push(now);
      if (entry.retries.length > 6) return setLine(line.id, { qr_status: 'paused', qr_code: null }); // flapping: stop, a person must press Connect
      await setLine(line.id, { qr_status: 'disconnected', qr_code: null });
      const delay = Math.min(5 * 60 * 1000, 5000 * 2 ** (entry.retries.length - 1));
      const keep = entry.retries;
      sockets.set(line.id, { sock: null, status: 'waiting', retries: keep, timer: setTimeout(() => { sockets.delete(line.id); }, delay), lastSendAt: 0 }); // tick() reconnects once the delay is over
    }
  });
}

async function logout(line) {
  const e = sockets.get(line.id);
  try { await e?.sock?.logout(); } catch { /* the phone may already have unlinked it */ }
  await closeSocket(line.id);
  fs.rmSync(sessionDir(line.id), { recursive: true, force: true });
  await setLine(line.id, { qr_status: 'logged_out', qr_code: null, command: null, connected_at: null });
}

/* ---------------------------------------------------------------- sending */
async function countsFor(line, waId, text, now) {
  const dayStart = new Date(now); dayStart.setHours(0, 0, 0, 0);
  const base = { line_id: line.id, direction: 'out', status: 'sent' };
  const [day, hour, toRecipientDay, sameRows, recentFailures] = await Promise.all([
    M.WhatsappMessage.count({ where: { ...base, sent_at: { [Op.gte]: dayStart } } }),
    M.WhatsappMessage.count({ where: { ...base, sent_at: { [Op.gte]: new Date(now - 3600 * 1000) } } }),
    M.WhatsappMessage.count({ where: { ...base, wa_id: waId, sent_at: { [Op.gte]: dayStart } } }),
    M.WhatsappMessage.findAll({ where: { ...base, body: text, sent_at: { [Op.gte]: dayStart } }, attributes: ['wa_id'], raw: true }),
    M.WhatsappMessage.count({ where: { line_id: line.id, direction: 'out', status: 'failed', updated_at: { [Op.gte]: new Date(now - 10 * 60 * 1000) } } }),
  ]);
  return { day, hour, toRecipientDay, sameTextRecipients: new Set(sameRows.map((r) => r.wa_id).filter((w) => w !== waId)).size, recentFailures };
}

/** called by the admin API: checks the rules, then queues the reply (the gateway sends it later, at a human pace) */
async function queueReply({ line, waId, text, userId }) {
  const contact = await M.WhatsappContact.findOne({ where: { line_id: line.id, wa_id: waId } });
  const now = new Date();
  const tz = await settings.get('wa_timezone');
  const verdict = safety.checkSend({ line, contact, text, now, tz, counts: await countsFor(line, waId, String(text || '').trim(), now) });
  if (!verdict.ok) return verdict;
  const pending = await M.WhatsappMessage.count({ where: { line_id: line.id, direction: 'out', status: 'queued' } });
  if (pending >= 10) return { ok: false, reason: 'Ten replies are already waiting to go out from this number. They are sent slowly on purpose' };
  const row = await M.WhatsappMessage.create({ line_id: line.id, wa_id: waId, direction: 'out', body: String(text).trim(), status: 'queued', user_id: userId || null });
  return { ok: true, message: row, waiting: pending };
}

async function deliverNext() {
  for (const [id, e] of sockets) {
    if (e.status !== 'connected' || !e.sock) continue;
    if (Date.now() - e.lastSendAt < (e.gap || 0)) continue;
    const row = await M.WhatsappMessage.findOne({ where: { line_id: id, direction: 'out', status: 'queued' }, order: [['id', 'ASC']] });
    if (!row) continue;
    const line = await M.WhatsappLine.findByPk(id);
    const contact = await M.WhatsappContact.findOne({ where: { line_id: id, wa_id: row.wa_id } });
    const now = new Date();
    const verdict = safety.checkSend({ line, contact, text: row.body, now, tz: await settings.get('wa_timezone'), counts: await countsFor(line, row.wa_id, row.body, now) });
    if (!verdict.ok) {
      // quiet hours / limits: keep it queued for a while (it may go out later), but never past 6 hours
      if (now - new Date(row.created_at) > 6 * 3600 * 1000) await row.update({ status: 'failed', error: verdict.reason.slice(0, 250) });
      e.gap = 60000; e.lastSendAt = Date.now(); continue;
    }
    const jid = contact.jid || `${row.wa_id}@s.whatsapp.net`;
    e.lastSendAt = Date.now(); e.gap = safety.gapMs();
    try {
      await e.sock.sendPresenceUpdate('composing', jid);
      await sleep(process.env.NODE_ENV === 'test' ? 0 : safety.typingMs(row.body.length));
      const res = await e.sock.sendMessage(jid, { text: row.body });
      await e.sock.sendPresenceUpdate('paused', jid).catch(() => {});
      await row.update({ status: 'sent', sent_at: new Date(), wa_msg_id: res?.key?.id || null, error: null });
    } catch (err) {
      await row.update({ status: 'failed', error: String(err.message || err).slice(0, 250) });
    }
  }
}

/* ------------------------------------------------------------------- loop */
async function tick() {
  if (busy) return; busy = true;
  try {
    if ((await settings.get('wa_qr_enable')) !== '1') { if (sockets.size) await stop(false); owner = false; return; }
    owner = await holdLease();
    if (!owner) { if (sockets.size) await stop(false); return; }
    const lines = await M.WhatsappLine.findAll({ where: { provider: 'qr' } });
    for (const line of lines) {
      const e = sockets.get(line.id);
      if (line.command === 'logout') { await logout(line); continue; }
      if (!line.status) { if (e) await closeSocket(line.id); if (line.qr_status !== 'disconnected' && line.qr_status !== 'logged_out') await setLine(line.id, { qr_status: 'disconnected', qr_code: null }); continue; }
      if (line.command === 'connect') { if (e) await closeSocket(line.id); await connect(line); continue; }
      if (e) continue; // already running (or waiting out its reconnect delay)
      if (line.qr_status === 'paused' || line.qr_status === 'logged_out') continue; // a person has to press Connect
      await connect(line); // new line, restart, or the reconnect delay is over
    }
    for (const id of [...sockets.keys()]) if (!lines.some((l) => l.id === id)) await closeSocket(id); // line was deleted
    await deliverNext();
  } catch (err) { lastError = err.message; console.error('wa gateway', err.message); } finally { busy = false; }
}

async function stop(release = true) {
  for (const id of [...sockets.keys()]) await closeSocket(id);
  if (release) { clearInterval(timer); timer = null; await releaseLease(); }
}

function start() {
  if (timer || process.env.WA_GATEWAY === '0') return;
  timer = setInterval(tick, TICK_MS); timer.unref?.();
  process.once('SIGTERM', () => { stop().finally(() => process.exit(0)); });
  setTimeout(tick, 2000).unref?.();
}

const summary = () => ({ owner, lines: sockets.size, error: lastError });

module.exports = { start, stop, tick, queueReply, summary, sessionDir, _sockets: sockets, _deliverNext: deliverNext };
