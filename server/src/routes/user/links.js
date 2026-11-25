/* User portal: the owner's managed links (claimed with a one-time e-mail code): cards on the dashboard, destination, reset and move */
const express = require('express');
const { Op } = require('sequelize');
const M = require('../../models');
const { wrap, fail, validate, toBool } = require('../../utils/http');
const links = require('../../services/links');
const shortlinks = require('../../services/shortlinks');
const security = require('../../services/security');
const { appUrl } = require('../../config');

const r = express.Router();
const own = async (req) => {
  const l = await M.ShortLink.findOne({ where: { id: req.params.id, user_id: req.user.id } });
  if (!l || !l.kind) fail(404, 'Link not found');
  return l;
};
async function card(l) {
  const plan = l.plan_id ? await M.Plan.findByPk(l.plan_id, { attributes: ['id', 'name'] }) : null;
  const v = l.vcard_id ? await M.Vcard.findByPk(l.vcard_id, { attributes: ['id', 'name', 'url_alias', 'profile_image', 'occupation', 'company', 'status', 'views'] }) : null;
  return {
    id: l.id, code: l.code, short_url: shortlinks.shortUrl(l.code), kind: l.kind, kind_label: links.KIND_LABEL[l.kind], state: links.stateOf(l), title: l.title,
    target_url: l.target_type === 'url' ? l.target_url : null, clicks: l.clicks, last_clicked_at: l.last_clicked_at, claimed_at: l.claimed_at, expires_at: l.expires_at, locked: l.locked,
    plan: plan ? { id: plan.id, name: plan.name } : null,
    vcard: v ? { id: v.id, name: v.name, url: `${appUrl}/${v.url_alias}`, image: v.profile_image, occupation: v.occupation, company: v.company, status: v.status, views: v.views } : null,
  };
}

/** every link and card the signed-in e-mail owns, for the dashboard */
r.get('/links', wrap(async (req, res) => {
  const rows = await M.ShortLink.findAll({ where: { user_id: req.user.id, kind: { [Op.ne]: null } }, order: [['claimed_at', 'DESC'], ['id', 'DESC']] });
  const data = []; for (const l of rows) data.push(await card(l));
  res.json({ data });
}));

/** add the destination (redirect / review) or the card details (business card) for a link that is waiting for them */
r.post('/links/:id/details', wrap(async (req, res) => {
  const l = await own(req);
  links.validateDetails(l, req.body);
  await links.completeDetails(l, req.user, req.body);
  res.json({ data: await card(l), message: 'Saved. The link is live.' });
}));

/** change where a redirect / review link goes (cards are edited in the card editor) */
r.put('/links/:id/destination', wrap(async (req, res) => {
  const l = await own(req);
  if (l.kind === 'vcard') fail(422, 'Edit this card in the card editor.');
  if (links.stateOf(l) === 'unclaimed') fail(422, 'This link is not active.');
  if (l.locked) fail(403, 'This link is managed by the administrator');
  const url = links.checkDestination(l.kind, req.body.url, { required: true });
  await l.update({ target_type: 'url', target_url: url, details_pending: false });
  res.json({ data: await card(l), message: 'Destination updated. Your QR codes and NFC tags now open the new address.' });
}));
r.post('/links/:id/pause', wrap(async (req, res) => {
  const l = await own(req);
  await l.update({ status: toBool(req.body.paused) ? false : true });
  res.json({ data: await card(l), message: l.status ? 'Link resumed' : 'Link paused' });
}));

/* reset (back to unclaimed): a code goes to the owner's e-mail. The owner chooses whether the data is wiped. */
r.post('/links/:id/reset/start', wrap(async (req, res) => {
  const l = await own(req);
  res.json({ ...(await links.startOtp(l, req.user.email, 'reset', {}, 'reset')), message: 'We e-mailed you a confirmation code' });
}));
r.post('/links/:id/reset/confirm', wrap(async (req, res) => {
  const l = await own(req);
  validate(req.body, { code: 'required' });
  await links.checkOtp(l, req.user.email, 'reset', req.body.code);
  const wipe = toBool(req.body.wipe);
  await links.reset(l, { wipe });
  security.audit(req, 'link.reset', 'short_link', l.id, { code: l.code, wipe });
  res.json({ message: 'The link is unclaimed again. The next person who opens it can attach it to their e-mail.' });
}));

/* move to another e-mail: the code goes to the NEW e-mail, so the new owner has to agree. */
r.post('/links/:id/transfer/start', wrap(async (req, res) => {
  const l = await own(req);
  validate(req.body, { email: 'required|email' });
  const to = links.cleanEmail(req.body.email);
  if (to === links.cleanEmail(req.user.email)) fail(422, 'Validation failed', { email: 'This link already belongs to that e-mail.' });
  res.json({ ...(await links.startOtp(l, to, 'transfer', { to }, 'accept')), message: `We e-mailed a code to ${to}. Enter it here to finish moving the link.` });
}));
r.post('/links/:id/transfer/confirm', wrap(async (req, res) => {
  const l = await own(req);
  validate(req.body, { email: 'required|email', code: 'required' });
  await links.checkOtp(l, req.body.email, 'transfer', req.body.code);
  const wipe = toBool(req.body.wipe);
  const { to } = await links.transfer(l, req.body.email, { wipe });
  security.audit(req, 'link.transfer', 'short_link', l.id, { code: l.code, to: to.email, wipe });
  res.json({ message: `The link now belongs to ${to.email}.` });
}));

module.exports = r;
