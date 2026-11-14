/*
 * WhatsApp lead capture (Meta WhatsApp Business Cloud API).
 * Each number is a "line" (Admin > WhatsApp leads). Meta posts incoming messages to /webhooks/whatsapp; every new sender
 * becomes a lead (a vCard enquiry tagged "WhatsApp") on the card the line points to. More messages from the same person
 * on the same number are added to that lead instead of creating duplicates.
 */
const crypto = require('crypto');
const M = require('../models');
const settings = require('./settings');
const mail = require('./mail');
const safety = require('./wasafety');
const { appUrl } = require('../config');

const seen = new Set(); // message ids already handled (Meta retries deliveries)
const remember = (id) => { seen.add(id); if (seen.size > 5000) seen.delete(seen.values().next().value); };

const webhookUrl = () => `${appUrl}/webhooks/whatsapp`;

async function verifyToken() {
  let t = await settings.get('whatsapp_verify_token');
  if (!t) { t = crypto.randomBytes(18).toString('hex'); await settings.set({ whatsapp_verify_token: t }); }
  return t;
}

const same = (a, b) => { const x = Buffer.from(String(a)); const y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); };

/** Meta's one-time check when the webhook is saved in the Meta dashboard */
async function challenge(q) {
  if (q['hub.mode'] !== 'subscribe' || !q['hub.verify_token'] || !q['hub.challenge']) return null;
  return same(q['hub.verify_token'], await verifyToken()) ? String(q['hub.challenge']) : null;
}

/** deliveries are signed with the Meta app secret; without a saved secret nothing is accepted */
async function signatureOk(raw, header) {
  const secret = await settings.get('whatsapp_app_secret');
  if (!secret || !raw || !header) return false;
  const want = `sha256=${crypto.createHmac('sha256', secret).update(raw).digest('hex')}`;
  return same(header, want);
}

/** short readable text for any kind of incoming message */
function textOf(m) {
  switch (m.type) {
    case 'text': return m.text?.body || '';
    case 'button': return m.button?.text || '';
    case 'interactive': return m.interactive?.button_reply?.title || m.interactive?.list_reply?.title || '';
    case 'image': case 'video': case 'document': case 'audio': case 'sticker':
      return `[${m.type}]${m[m.type]?.caption ? ` ${m[m.type].caption}` : ''}`;
    case 'location': return `[location] ${[m.location?.name, m.location?.address].filter(Boolean).join(', ') || `${m.location?.latitude},${m.location?.longitude}`}`;
    case 'contacts': return '[shared a contact]';
    default: return `[${m.type || 'message'}]`;
  }
}

async function addLead(line, waId, name, text) {
  const phone = `+${String(waId).replace(/\D/g, '')}`.slice(0, 30);
  const existing = await M.VcardEnquiry.findOne({ where: { vcard_id: line.vcard_id, line_id: line.id, wa_id: waId } });
  if (existing) {
    const merged = `${existing.message || ''}\n${text}`.trim().slice(-4000);
    existing.message = merged; if (name && /^\+?\d+$/.test(existing.name)) existing.name = name.slice(0, 120);
    existing.changed('updated_at', true); await existing.save();
    return { lead: existing, created: false };
  }
  const lead = await M.VcardEnquiry.create({ vcard_id: line.vcard_id, line_id: line.id, wa_id: waId, source: 'whatsapp', name: (name || phone).slice(0, 120), phone, message: text.slice(0, 4000) });
  return { lead, created: true };
}

/**
 * One incoming message from either connection type (official API webhook or QR gateway).
 * Records the contact + message, honours STOP, and turns a new sender into a lead.
 */
async function receive(line, { waId, jid, name, text, msgId }) {
  if (msgId && seen.has(msgId)) return { duplicate: true };
  if (msgId) { remember(msgId); if (await M.WhatsappMessage.findOne({ where: { line_id: line.id, wa_msg_id: msgId }, attributes: ['id'] })) return { duplicate: true }; }
  const [contact] = await M.WhatsappContact.findOrCreate({ where: { line_id: line.id, wa_id: waId }, defaults: { jid: jid || null, name: name || null } });
  const patch = { last_in_at: new Date() };
  if (jid) patch.jid = jid;
  if (name && !contact.name) patch.name = String(name).slice(0, 120);
  if (safety.STOP_WORDS.test(text)) patch.opted_out = true; else if (safety.START_WORDS.test(text)) patch.opted_out = false;
  await contact.update(patch);
  await M.WhatsappMessage.create({ line_id: line.id, wa_id: waId, direction: 'in', body: String(text).slice(0, 4000), status: 'received', wa_msg_id: msgId || null });
  await line.update({ messages_count: (line.messages_count || 0) + 1, last_message_at: new Date() });
  if (!line.vcard_id) return { created: false }; // no card chosen yet: nothing to attach a lead to
  const { lead, created } = await addLead(line, waId, name, text);
  if (created) {
    const card = await M.Vcard.findByPk(line.vcard_id, { include: [{ model: M.User, attributes: ['email'] }] });
    if (card?.user?.email) mail.sendTemplate('enquiry_received', card.user.email, { vcard: card.name, customer: lead.name, contact: `${lead.phone} (WhatsApp)`, message: lead.message }).catch(() => {});
  }
  return { created };
}

/** handles one official-API webhook body; never throws (Meta must always get a 200) */
async function ingest(body) {
  const out = { leads: 0, messages: 0 };
  try {
    for (const entry of body?.entry || []) {
      for (const ch of entry.changes || []) {
        const v = ch.value || {};
        const pid = v.metadata?.phone_number_id;
        if (!pid || !Array.isArray(v.messages)) continue; // delivery / read receipts etc.
        const line = await M.WhatsappLine.findOne({ where: { phone_number_id: String(pid) } });
        if (!line || !line.status) continue;
        const names = Object.fromEntries((v.contacts || []).map((c) => [c.wa_id, c.profile?.name]));
        for (const m of v.messages) {
          if (!m.from) continue;
          const r = await receive(line, { waId: String(m.from), jid: `${m.from}@s.whatsapp.net`, name: names[m.from], text: textOf(m), msgId: m.id });
          if (r.duplicate) continue;
          out.messages += 1; if (r.created) out.leads += 1;
        }
      }
    }
  } catch (e) { console.error('whatsapp webhook', e.message); }
  return out;
}

/** asks Meta who owns this number + token, so a wrong id or token is caught when it is saved */
async function check(line) {
  const version = (await settings.get('whatsapp_api_version')) || 'v21.0';
  const r = await fetch(`https://graph.facebook.com/${version}/${encodeURIComponent(line.phone_number_id)}?fields=display_phone_number,verified_name`, {
    headers: { Authorization: `Bearer ${line.access_token}` }, signal: AbortSignal.timeout(15000),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error?.message || `Meta answered HTTP ${r.status}`);
  return { phone: j.display_phone_number, name: j.verified_name };
}

module.exports = { webhookUrl, verifyToken, challenge, signatureOk, ingest, receive, check, textOf };
