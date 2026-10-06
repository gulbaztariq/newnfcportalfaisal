const jwt = require('jsonwebtoken');
const { User } = require('../models');
const { jwtSecret, isProd } = require('../config');
const { HttpError } = require('../utils/http');

const COOKIE = 'vc_session';
const IMP_COOKIE = 'vc_admin_session';
const cookieOpts = { httpOnly: true, sameSite: 'strict', secure: isProd, path: '/', maxAge: 1000 * 60 * 60 * 24 * 7 };

function issueToken(res, user, cookie = COOKIE) {
  const token = jwt.sign({ sub: user.id, v: user.token_version || 0 }, jwtSecret, { expiresIn: '7d' });
  res.cookie(cookie, token, cookieOpts);
  return token;
}
const clearTokens = (res) => { res.clearCookie(COOKIE, { path: '/' }); res.clearCookie(IMP_COOKIE, { path: '/' }); };

async function userFromToken(token) {
  if (!token) return null;
  try {
    const payload = jwt.verify(token, jwtSecret);
    const user = await User.scope('withSecrets').findByPk(payload.sub);
    if (!user || !user.is_active || (user.token_version || 0) !== payload.v) return null;
    if (user.organisation_id && user.org_status && user.org_status !== 'active') return null; // locked / blocked by the organisation
    return user;
  } catch { return null; }
}

/** Attaches req.user when a valid session cookie is present. */
async function loadUser(req, _res, next) {
  req.user = await userFromToken(req.cookies[COOKIE]);
  req.impersonator = req.cookies[IMP_COOKIE] ? await userFromToken(req.cookies[IMP_COOKIE]) : null;
  next();
}

const requireAuth = (req, _res, next) => (req.user ? next() : next(new HttpError(401, 'Unauthenticated')));
const requireRole = (...roles) => (req, _res, next) => {
  if (!req.user) return next(new HttpError(401, 'Unauthenticated'));
  if (!roles.includes(req.user.role)) return next(new HttpError(403, 'You are not allowed to do this'));
  next();
};
const isAdmin = requireRole('super_admin', 'admin', 'manager', 'supervisor');
const isSuperAdmin = requireRole('super_admin');

/** Admin panel: managers / supervisors only reach the modules the super admin granted them */
function adminPermissions(req, _res, next) {
  const perms = require('../services/permissions');
  if (req.user.role === 'super_admin' || req.user.role === 'admin') return next();
  const mod = perms.moduleFor(perms.ADMIN_PATHS, req.path);
  const action = perms.actionOf(req.method);
  if (mod === undefined) return action === 'view' ? next() : next(new HttpError(403, 'You do not have permission to do this'));
  if (!perms.can(req.user, `${mod}.${action}`)) return next(new HttpError(403, `You do not have permission to ${action} ${perms.ADMIN_MODULES[mod] || mod}`));
  next();
}

/** A permission check usable inside routes: requirePerm('finance.manage') */
const requirePerm = (key) => (req, _res, next) => (require('../services/permissions').can(req.user, key) ? next() : next(new HttpError(403, 'You do not have permission to do this')));

/**
 * User portal: company managers / supervisors work on the company (owner) account with the permissions the
 * owner granted. req.actor is the signed-in person, req.user becomes the company owner.
 */
async function companyWorkspace(req, _res, next) {
  try {
    const u = req.user;
    if (!u.organisation_id || !['manager', 'supervisor'].includes(u.company_role)) return next();
    const perms = require('../services/permissions');
    const mod = perms.moduleFor(perms.COMPANY_PATHS, req.path);
    if (mod === null) return next(); // personal things (announcements) stay on the member
    const action = perms.actionOf(req.method);
    if (mod === undefined || !perms.can(u, `${mod}.${action}`)) return next(new HttpError(403, 'Your company role does not allow this'));
    const owner = await User.scope('withSecrets').findOne({ where: { id: u.organisation_id, is_active: true } });
    if (!owner) return next(new HttpError(403, 'Your company account is not active'));
    req.actor = u; req.user = owner;
    next();
  } catch (e) { next(e); }
}

module.exports = { COOKIE, IMP_COOKIE, cookieOpts, issueToken, clearTokens, loadUser, requireAuth, requireRole, isAdmin, isSuperAdmin, adminPermissions, requirePerm, companyWorkspace };
