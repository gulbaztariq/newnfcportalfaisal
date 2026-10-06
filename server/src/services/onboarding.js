/* New-account helpers: default vCard + default short link */
const crypto = require('crypto');
const settings = require('./settings');
const RESERVED = require('../utils/reserved');

const M = () => require('../models');

async function freeAlias(base) {
  const clean = String(base || 'card').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'card';
  let alias = clean.length < 2 ? `${clean}-card` : clean;
  for (let i = 0; i < 30 && (RESERVED.has(alias) || (await M().Vcard.findOne({ where: { url_alias: alias } }))); i += 1) alias = `${clean}-${crypto.randomBytes(2).toString('hex')}`;
  return alias;
}

/** Create a starter vCard for a brand-new user (Settings > General > default vCard; force = an admin asked for it). Never throws. */
async function defaultVcard(user, { force = false } = {}) {
  try {
    const s = await settings.all();
    if ((!force && s.default_vcard_enable === '0') || user.role !== 'user') return null;
    if (await M().Vcard.count({ where: { user_id: user.id } })) return null;
    const tpl = (await M().Template.findOne({ where: { slug: s.default_vcard_template || 'vcard1', status: true } })) || (await M().Template.findOne({ where: { status: true }, order: [['id', 'ASC']] }));
    if (!tpl) return null;
    const name = `${user.first_name} ${user.last_name}`.trim();
    const v = await M().Vcard.create({
      name, url_alias: await freeAlias(name), template_id: tpl.id, user_id: user.id,
      first_name: user.first_name, last_name: user.last_name, email: user.email, phone: user.contact || null, region_code: user.region_code || null,
      theme: tpl.defaults || {}, sections: { contact: true, social: true, services: true, gallery: true, testimonials: true, hours: true, qr: true, enquiry: true },
    });
    await require('./shortlinks').forVcard(v);
    return v;
  } catch (e) { console.error('[onboarding] default vCard failed:', e.message); return null; }
}

module.exports = { defaultVcard, freeAlias };
