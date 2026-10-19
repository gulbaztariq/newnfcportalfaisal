/*
 * Contact tags: a QR / NFC tag that lets anyone reach the owner WITHOUT seeing their phone number.
 * The public page only offers "send a message" and "ask for a call back"; the owner (or the emergency contact) is
 * notified on WhatsApp / SMS / e-mail from here, so numbers are never shown to the person who scanned.
 */
const crypto = require('crypto');
const settings = require('./settings');
const messaging = require('./messaging');
const mail = require('./mail');
const { esc } = require('../utils/html');
const { appUrl } = require('../config');

const M = () => require('../models');
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no 0/O/1/I/L: easy to read out loud
const KINDS = ['vehicle', 'bag', 'keys', 'pet', 'door', 'other'];

const randomCode = () => Array.from(crypto.randomBytes(8), (b) => ALPHABET[b % ALPHABET.length]).join('');
async function uniqueCode() {
  const { ContactTag } = M();
  for (let i = 0; i < 8; i++) { const c = randomCode(); if (!(await ContactTag.findOne({ where: { code: c }, attributes: ['id'] }))) return c; }
  throw new Error('Could not create a tag code');
}
const url = (tag) => `${appUrl}/tag/${tag.code}`;
const manageUrl = (tag) => `${appUrl}/tag/${tag.code}/manage?k=${tag.manage_token}`;
const sameToken = (a, b) => { const x = Buffer.from(String(a || '')); const y = Buffer.from(String(b || '')); return x.length === y.length && x.length > 0 && crypto.timingSafeEqual(x, y); };
const cleanPhone = (p) => String(p || '').replace(/[^\d+]/g, '').replace(/(?!^)\+/g, '').slice(0, 20);
const validPhone = (p) => /^\+?\d{7,15}$/.test(String(p || ''));

/** One tag per piece ordered (capped); the customer is the first owner and can change everything from their manage link */
async function createForOrder(order, quantity, { userId } = {}) {
  const { ContactTag } = M();
  const tags = [];
  for (let i = 0; i < Math.min(Math.max(1, quantity), 200); i++) {
    tags.push(await ContactTag.create({
      code: await uniqueCode(), manage_token: crypto.randomBytes(18).toString('hex'), owner_name: order.name, owner_phone: cleanPhone(order.phone) || null, owner_email: order.email && !(await require('./orders').isDummyEmail(order.email)) ? order.email : null,
      nfc_order_id: order.id, user_id: userId || order.user_id || null,
    }));
  }
  return tags;
}

/**
 * Relay a visitor's message / call-back request to the owner (or the emergency contact).
 * Never throws: each channel reports sent | skipped | failed in `delivery`.
 */
async function notify(tag, msg) {
  const s = await settings.all();
  const toEmergency = msg.to_role === 'emergency' && tag.emergency_phone;
  const phone = toEmergency ? tag.emergency_phone : tag.owner_phone;
  const who = toEmergency ? tag.emergency_name || 'the emergency contact' : tag.owner_name || 'the owner';
  const from = msg.name ? `${msg.name}${msg.phone ? ` (${msg.phone})` : ''}` : msg.phone || 'Someone';
  const label = tag.label ? ` "${tag.label}"` : '';
  const text = msg.type === 'callback'
    ? `Tag${label}: ${from} asks you to call them back.${msg.text ? ` Note: ${msg.text}` : ''}`
    : `Tag${label}: ${from} wrote: ${msg.text || '(no text)'}${msg.phone ? ` Reply or call: ${msg.phone}` : ''}`;
  const delivery = {};
  const channel = async (key, on, fn) => {
    if (!on) { delivery[key] = 'off'; return; }
    try { const r = await fn(); delivery[key] = r === 'sent' ? 'sent' : r === 'failed' ? 'failed' : 'skipped'; } catch (e) { delivery[key] = 'failed'; console.error(`[contact tag ${key}]`, e.message); }
  };
  if (phone) {
    // owner's own settings decide the channels; the emergency contact gets WhatsApp and SMS
    await channel('whatsapp', toEmergency || tag.notify_whatsapp, () => messaging.deliver('whatsapp', phone, text, { event: 'contact_tag' }));
    await channel('sms', toEmergency || tag.notify_sms, () => messaging.deliver('sms', phone, text, { event: 'contact_tag' }));
  }
  await channel('email', !toEmergency && tag.notify_email && tag.owner_email, async () => {
    if (!(await mail.isConfigured())) return 'skipped';
    await mail.send({ to: tag.owner_email, subject: `${msg.type === 'callback' ? 'Call-back request' : 'New message'} for your tag${label}`, html: `<p>Hello ${esc(who)},</p><p>${esc(text)}</p><p><a href="${esc(manageUrl(tag))}">Open your tag</a></p>` });
    return 'sent';
  });
  return { text, delivery };
}

module.exports = { KINDS, uniqueCode, createForOrder, notify, url, manageUrl, sameToken, cleanPhone, validPhone };
