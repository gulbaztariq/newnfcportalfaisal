/* Admin: translations of the public card texts, database upgrade, custom-domain guide, who used a coupon. */
const express = require('express');
const PDFDocument = require('pdfkit');
const M = require('../../models');
const settings = require('../../services/settings');
const i18n = require('../../views/templates/i18n');
const { wrap, fail, validate } = require('../../utils/http');
const { isSuperAdmin } = require('../../middleware/auth');
const { appUrl } = require('../../config');

const r = express.Router();

/* ---------------------------------------------------------- translations */
const readOverrides = async () => { try { return JSON.parse((await settings.get('i18n_overrides')) || '{}') || {}; } catch { return {}; } };
r.get('/translations', wrap(async (req, res) => {
  const langs = await M.Language.findAll({ attributes: ['name', 'iso_code', 'status'], order: [['name', 'ASC']] });
  const codes = [...new Set([...i18n.LANGS, ...langs.map((l) => l.iso_code)])];
  const lang = codes.includes(req.query.lang) ? req.query.lang : 'en';
  const ov = (await readOverrides())[lang] || {};
  const base = i18n.base(lang); const en = i18n.base('en');
  res.json({
    lang,
    languages: codes.map((c) => ({ code: c, name: langs.find((l) => l.iso_code === c)?.name || c.toUpperCase(), builtin: i18n.LANGS.includes(c) })),
    data: i18n.KEYS.map((key) => ({ key, english: en[key], standard: base[key], value: ov[key] ?? '' })),
  });
}));
r.put('/translations', wrap(async (req, res) => {
  validate(req.body, { lang: 'required|max:10' }, { lang: 'Language' });
  const lang = String(req.body.lang);
  if (!/^[a-z]{2,3}(-[A-Za-z]{2,4})?$/.test(lang)) fail(422, 'Language code is not valid', { lang: 'Language code is not valid' });
  const all = await readOverrides();
  const next = {};
  for (const [k, val] of Object.entries(req.body.values && typeof req.body.values === 'object' ? req.body.values : {})) {
    const text = i18n.clean(val); // no markup: these texts go straight into the card page
    if (i18n.KEYS.includes(k) && text) next[k] = text; // empty = use the standard wording again
  }
  if (Object.keys(next).length) all[lang] = next; else delete all[lang];
  await settings.set({ i18n_overrides: JSON.stringify(all) });
  res.json({ message: 'Translations saved' });
}));

/* -------------------------------------------------------- database upgrade */
r.post('/settings/db-upgrade', isSuperAdmin, wrap(async (_req, res) => {
  const added = await require('../../services/dbsync').safeSync();
  settings.clearCache();
  res.json({ message: added.length ? `Database upgraded: ${added.length} new field(s) added` : 'The database is already up to date', added });
}));

/* ------------------------------------------------------ custom domain guide */
r.get('/custom-domains/guide', wrap(async (_req, res) => {
  const host = appUrl.replace(/^https?:\/\//, '');
  const doc = new PDFDocument({ size: 'A4', margin: 56 });
  const chunks = []; doc.on('data', (c) => chunks.push(c));
  const done = new Promise((ok) => doc.on('end', ok));
  const h = (t) => doc.moveDown(0.8).fontSize(14).fillColor('#111').font('Helvetica-Bold').text(t).moveDown(0.3);
  const p = (t) => doc.fontSize(11).fillColor('#333').font('Helvetica').text(t, { lineGap: 3 });
  doc.fontSize(20).font('Helvetica-Bold').fillColor('#111').text('Custom domain guide');
  p(`How to open a card on your own domain (for example card.yourcompany.com) instead of ${host}.`);
  h('1. Choose the address');
  p('Use a sub-domain such as card.yourcompany.com. A sub-domain is the easiest because it does not affect your main website or e-mail.');
  h('2. Add a DNS record at your domain provider');
  p('Open the DNS settings of your domain (cPanel > Zone Editor, or your registrar\'s DNS page) and add:');
  p(`   Type: CNAME\n   Name / Host: card   (the part before your domain)\n   Target / Points to: ${host}\n   TTL: 14400 or Automatic`);
  p('In cPanel: Domains > Zone Editor > Manage > Add Record > CNAME. Save the record.');
  h('3. Add the domain to the hosting of this system');
  p(`The server that runs ${host} must also answer for the new domain. In cPanel or hPanel open Domains (or Aliases / Parked domains), add card.yourcompany.com and point it to the same folder as ${host}. Then issue the free SSL certificate for it (cPanel > SSL/TLS Status > Run AutoSSL).`);
  h('4. Enter the domain on the card');
  p('The card owner opens the card > Advanced > Custom domain, types card.yourcompany.com and saves. The request appears in Admin > Custom domains.');
  h('5. Approve it');
  p('In Admin > Custom domains press Approve. The card then opens on the new domain. If the domain was rejected, the owner can correct it and save again to re-apply.');
  h('Checking and problems');
  p('DNS changes can take from a few minutes up to 24 hours. "Not secure" warning: the SSL certificate was not issued yet (step 3). Still the old page: the domain is not added to the hosting (step 3) or the CNAME points somewhere else.');
  doc.end(); await done;
  res.type('application/pdf').set('Content-Disposition', 'attachment; filename="custom-domain-guide.pdf"').send(Buffer.concat(chunks));
}));

/* ------------------------------------------------------------ coupon usage */
r.get('/coupon-uses/:id', wrap(async (req, res) => {
  const c = await M.CouponCode.findByPk(req.params.id);
  if (!c) fail(404, 'Not found');
  const subs = await M.Subscription.findAll({ include: [{ model: M.User, attributes: ['id', 'first_name', 'last_name', 'email'] }, { model: M.Plan, attributes: ['id', 'name'] }], order: [['id', 'DESC']], limit: 2000 });
  const name = String(c.coupon_name).toLowerCase();
  const used = subs.filter((s) => { const m = s.coupon_code_meta; const code = typeof m === 'string' ? m : m?.code || m?.coupon_name || m?.name; return code && String(code).toLowerCase() === name; });
  res.json({ data: used.map((s) => ({ id: s.id, user: s.user ? { id: s.user.id, name: `${s.user.first_name || ''} ${s.user.last_name || ''}`.trim(), email: s.user.email } : null, plan: s.plan?.name || '-', discount: s.discount ?? null, date: s.created_at })), coupon: c.coupon_name });
}));

module.exports = r;
