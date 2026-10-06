/* /r/:code dynamic redirects (QR + NFC) and public invoice pages (/invoice/:token) */
const crypto = require('crypto');
const M = require('../models');
const shortlinks = require('../services/shortlinks');
const invoices = require('../services/invoices');
const settings = require('../services/settings');
const { renderInvoice } = require('../views/invoice');
const errorPage = require('../views/errors');
const { jwtSecret } = require('../config');

const BOT = /bot|crawl|spider|preview|facebookexternalhit|whatsapp|slurp/i;

async function redirect(req, res, next) {
  try {
    if (!shortlinks.CODE_RE.test(req.params.code)) return next();
    const link = await M.ShortLink.findOne({ where: { code: req.params.code } });
    if (!link) return next();
    const to = await shortlinks.destination(link);
    if (!to) {
      return res.status(link.status ? 200 : 410).send(errorPage(link.status ? 'NFC' : 410, link.status ? 'This tag is not activated yet' : 'This link is no longer active', link.status ? 'The owner has not connected this NFC tag / QR code to a card yet.' : 'The owner switched this link off.'));
    }
    const ua = String(req.get('user-agent') || '');
    if (!BOT.test(ua)) {
      const { device, browser, os } = shortlinks.parseUa(ua);
      M.ShortLinkClick.create({ short_link_id: link.id, device, browser, os, referrer: String(req.get('referer') || '').slice(0, 250) || null, ip_hash: crypto.createHash('sha256').update(`${req.ip}:${jwtSecret}`).digest('hex') }).catch(() => {});
      link.increment('clicks').catch(() => {});
      link.update({ last_clicked_at: new Date() }).catch(() => {});
    }
    res.set('Cache-Control', 'no-store'); // destinations can change at any time
    res.redirect(302, to);
  } catch (e) { next(e); }
}

async function load(req) {
  if (!/^[a-f0-9]{48}$/.test(req.params.token)) return null;
  return M.Invoice.findOne({ where: { token: req.params.token }, include: [{ model: M.InvoicePayment, as: 'payments' }] });
}
async function invoice(req, res, next) {
  try {
    const inv = await load(req);
    if (!inv) return next();
    const s = await settings.all();
    const tpl = String(req.query.template || '');
    res.set('X-Robots-Tag', 'noindex').set('Content-Security-Policy', `default-src 'none'; img-src 'self' data: https:; style-src 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; script-src 'nonce-${res.locals.nonce}'; base-uri 'none'; form-action 'none'; frame-ancestors 'self' ${require('../config').clientUrl}`);
    res.send(renderInvoice(inv.toJSON(), s, { template: invoices.TEMPLATES[tpl] ? tpl : inv.template, nonce: res.locals.nonce, preview: req.query.embed === '1' }));
  } catch (e) { next(e); }
}
async function invoicePdf(req, res, next) {
  try {
    const inv = await load(req);
    if (!inv) return next();
    res.type('application/pdf').set('Content-Disposition', `inline; filename="${inv.number}.pdf"`).send(await invoices.pdf(inv));
  } catch (e) { next(e); }
}

module.exports = { redirect, invoice, invoicePdf };
