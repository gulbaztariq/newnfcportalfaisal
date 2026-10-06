/*
 * Dynamic short links: every QR code and NFC tag points at /r/{code}; the destination can be changed
 * later (by the owner, or only by admins when locked) without re-printing the card or re-writing the chip.
 */
const crypto = require('crypto');
const { appUrl } = require('../config');

const ALPHABET = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no look-alikes
const randomCode = (n = 7) => Array.from(crypto.randomBytes(n), (b) => ALPHABET[b % ALPHABET.length]).join('');
const shortUrl = (code) => `${appUrl}/r/${code}`;
const CODE_RE = /^[A-Za-z0-9_-]{3,40}$/;

async function uniqueCode(M, n = 7) {
  for (let i = 0; i < 20; i += 1) {
    const code = randomCode(n);
    if (!(await M.ShortLink.findOne({ where: { code } }))) return code;
  }
  return randomCode(n + 3);
}

/** The default short link of a vCard (created on demand) */
async function forVcard(v) {
  const M = require('../models');
  let link = await M.ShortLink.findOne({ where: { vcard_id: v.id, target_type: 'vcard' }, order: [['id', 'ASC']] });
  if (!link) link = await M.ShortLink.create({ code: await uniqueCode(M), title: v.name, target_type: 'vcard', vcard_id: v.id, user_id: v.user_id });
  return link;
}

/** Where a link goes right now (null = inactive / unassigned) */
async function destination(link) {
  const M = require('../models');
  if (!link.status) return null;
  if (link.target_type === 'vcard' && link.vcard_id) {
    const v = await M.Vcard.findByPk(link.vcard_id, { attributes: ['url_alias', 'status', 'custom_domain', 'custom_domain_status'] });
    return v && v.status ? `${appUrl}/${v.url_alias}` : null;
  }
  if (link.target_type === 'store' && link.store_id) {
    const st = await M.WhatsappStore.findByPk(link.store_id, { attributes: ['url_alias', 'status'] });
    return st && st.status ? `${appUrl}/s/${st.url_alias}` : null;
  }
  if (link.target_type === 'url' && /^https?:\/\//i.test(link.target_url || '')) return link.target_url;
  return null;
}

function parseUa(ua = '') {
  const device = /ipad|tablet/i.test(ua) ? 'tablet' : /mobile|android|iphone/i.test(ua) ? 'mobile' : 'desktop';
  const browser = /edg\//i.test(ua) ? 'Edge' : /opr\//i.test(ua) ? 'Opera' : /chrome/i.test(ua) ? 'Chrome' : /firefox/i.test(ua) ? 'Firefox' : /safari/i.test(ua) ? 'Safari' : 'Other';
  const os = /android/i.test(ua) ? 'Android' : /iphone|ipad|ios/i.test(ua) ? 'iOS' : /windows/i.test(ua) ? 'Windows' : /mac os/i.test(ua) ? 'macOS' : /linux/i.test(ua) ? 'Linux' : 'Other';
  return { device, browser, os };
}

module.exports = { randomCode, uniqueCode, shortUrl, forVcard, destination, parseUa, CODE_RE };
