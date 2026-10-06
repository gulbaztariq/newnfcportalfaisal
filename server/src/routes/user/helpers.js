/* Shared helpers for the user panel routers */
const fs = require('fs');
const M = require('../../models');
const extras = require('../../services/extras');
const subs = require('../../services/subscription');
const { removeFile } = require('../../middleware/upload');
const { fail } = require('../../utils/http');

/** after an upload: enforce the plan storage limit and account the bytes */
async function trackStorage(req, _res, next) {
  const files = [req.file, ...(Array.isArray(req.files) ? req.files : Object.values(req.files || {}).flat())].filter(Boolean);
  const bytes = files.reduce((n, f) => n + (f.size || 0), 0);
  if (!bytes) return next();
  try {
    await extras.assertStorage(req.user, bytes, await subs.current(req.user.id));
    await extras.addStorage(req.user, bytes);
    next();
  } catch (e) {
    for (const f of files) fs.promises.unlink(f.path).catch(() => {});
    next(e);
  }
}

const removeOwned = (req, url) => { if (!url) return; extras.freeStorage(req.user.id, url, M.User); removeFile(url); };

async function ownVcardOf(req, id) {
  const v = await M.Vcard.findOne({ where: { id, user_id: req.user.id } });
  if (!v) fail(404, 'vCard not found');
  return v;
}

/** plan features of the signed-in user (cached per request) */
async function featuresOf(req) {
  if (!req._features) { const sub = await subs.current(req.user.id); req._sub = sub; req._features = sub?.plan?.features || {}; }
  return req._features;
}
async function requireFeature(req, key, label) {
  if (!(await featuresOf(req))[key]) fail(422, `${label} is not included in your plan. Upgrade to unlock it.`);
}

module.exports = { trackStorage, removeOwned, ownVcardOf, featuresOf, requireFeature };
