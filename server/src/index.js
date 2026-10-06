const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const helmet = require('helmet');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const config = require('./config');
const { sequelize } = require('./models');
const { loadUser } = require('./middleware/auth');
const { HttpError } = require('./utils/http');
const errorPage = require('./views/errors');

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);
// abuse guard first: temporarily bans IPs that flood auth / scan for exploits
const security = require('./services/security');
app.use(security.ipGuard);
// generous per-IP limit for everything (pages, assets, uploads); the API has its own stricter limits
app.use(require('express-rate-limit')({ windowMs: 60 * 1000, limit: 600, standardHeaders: true, legacyHeaders: false, message: 'Too many requests',
  skip: (req) => req.path.startsWith('/api/') || /^\/(build|vendor|brand|uploads|fonts)\//.test(req.path) || /\.(js|css|svg|png|jpe?g|webp|woff2?|ico|map)$/.test(req.path) }));

// per-request nonce for the small inline scripts on server rendered pages
app.use((_req, res, next) => { res.locals.nonce = crypto.randomBytes(16).toString('base64'); next(); });
app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      'script-src': ["'self'", (_req, res) => `'nonce-${res.locals.nonce}'`, 'https://www.googletagmanager.com', 'https://js.stripe.com', 'https://accounts.google.com', 'https://www.google.com', 'https://www.gstatic.com'],
      'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com', 'https://accounts.google.com'],
      'font-src': ["'self'", 'data:', 'https://fonts.gstatic.com'],
      'img-src': ["'self'", 'data:', 'blob:', 'https:'],
      'connect-src': ["'self'", 'https://www.google-analytics.com', 'https://*.google-analytics.com', 'https://accounts.google.com'],
      'frame-src': ["'self'", 'https://js.stripe.com', 'https://accounts.google.com', 'https://www.google.com'],
      'frame-ancestors': ["'self'", config.clientUrl],
      'form-action': ["'self'"],
      'upgrade-insecure-requests': config.isProd ? [] : null,
    },
  },
  crossOriginEmbedderPolicy: false,
}));
app.use(compression());
app.use(cookieParser());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));

/* ---------------------------------------------------------------- static */
app.use(express.static(config.publicDir, { index: false, maxAge: config.isProd ? '30d' : 0 }));
app.use('/uploads', (_req, res, next) => { res.set('X-Content-Type-Options', 'nosniff').set('Content-Security-Policy', "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox"); next(); },
  express.static(config.uploadDir, { maxAge: config.isProd ? '7d' : 0, fallthrough: false }));

/* ------------------------------------------------------------------- API */
const api = express.Router();
api.use(rateLimit({ windowMs: 60 * 1000, limit: 600, standardHeaders: true, legacyHeaders: false, message: { message: 'Too many requests' } }));
// CSRF defence: session cookies are SameSite=strict, and state-changing calls must carry a header a cross-site form cannot set
api.use((req, _res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  if (req.get('X-Requested-With') !== 'XMLHttpRequest') return next(new HttpError(403, 'Invalid request'));
  next();
});
api.use(loadUser);
api.use('/auth', require('./routes/auth').router);
api.use('/admin', require('./routes/admin'));
api.use('/user', require('./routes/user'));
api.use('/public', require('./routes/public').api);
api.use('/shop', require('./routes/shop'));
api.use((_req, _res, next) => next(new HttpError(404, 'Not found')));
app.use('/api', api);

/* ---------------------------------------------- payment gateway returns */
// some gateways POST back to the return URL, so this lives outside /api (no CSRF header possible)
const RETURN_KEYS = ['token', 'reference', 'trxref', 'tx_ref', 'transaction_id', 'status', 'razorpay_payment_id', 'razorpay_payment_link_id', 'razorpay_payment_link_reference_id', 'razorpay_payment_link_status', 'razorpay_signature', 'payment_id', 'collection_id', 'external_reference', 'link_id', 'val_id', 'tran_id', 'm_payment_id', 'mtid'];
app.all('/pay/return/:gateway', (req, res) => {
  if (!require('./services/payments').NAMES.includes(req.params.gateway)) return res.redirect(303, `${config.clientUrl}/user/plans`);
  const src = { ...req.query, ...(req.body || {}) };
  const q = new URLSearchParams(Object.fromEntries(RETURN_KEYS.filter((k) => src[k] !== undefined).map((k) => [k, String(src[k]).slice(0, 300)])));
  res.redirect(303, `${config.clientUrl}/user/payment/${req.params.gateway}/success?${q}`);
});
app.post('/pay/notify/payfast', (req, res) => {
  require('./services/payments').payfastNotify(req.body || {}).catch((e) => console.error('payfast itn', e.message)).finally(() => res.sendStatus(200));
});

/* -------------------------------------------- dynamic short links (QR / NFC) */
app.get('/r/:code', require('./routes/redirects').redirect);
app.get('/invoice/:token', require('./routes/redirects').invoice);
app.get('/invoice/:token/pdf', require('./routes/redirects').invoicePdf);

/* ------------------------------------------------------- custom domains */
app.use(require('./routes/public').customDomain);

/* ------------------------------------------------------------------ SPA */
const SPA = /^\/($|(login|register|forgot-password|reset-password|verify-email|two-factor|terms-conditions|privacy-policy|directory|blog|shop|cart|checkout|track|admin|user)(\/|$))/;
const spaIndex = path.join(config.clientDist, 'index.html');
app.use((req, res, next) => {
  if (req.method !== 'GET' || !SPA.test(req.path)) return next();
  if (fs.existsSync(spaIndex)) return res.sendFile(spaIndex);
  return res.redirect(config.clientUrl + req.originalUrl); // development: React runs on the Vite dev server
});
if (fs.existsSync(config.clientDist)) app.use(express.static(config.clientDist, { index: false, maxAge: config.isProd ? '30d' : 0 }));

/* ---------------------------------------------------- landing and vCards */
app.use(require('./routes/public').pages);

/* ---------------------------------------------------------------- errors */
app.use((req, res) => res.status(404).send(errorPage(404, 'Oops, the page you are looking for is not available.', 'The page you are trying to access has been removed or never existed.')));
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, _next) => {
  let status = err.status || (err.code === 'LIMIT_FILE_SIZE' ? 422 : 500);
  let message = err.code === 'LIMIT_FILE_SIZE' ? 'The file is too large' : err.message;
  if (err.name === 'SequelizeUniqueConstraintError') { status = 422; message = 'This value is already taken'; }
  if (err.name === 'SequelizeForeignKeyConstraintError') { status = 422; message = 'This record is in use and cannot be changed'; }
  if (status >= 500) { console.error(err); message = config.isProd ? 'Server error' : message; }
  if (req.originalUrl.startsWith('/api')) return res.status(status).json({ message, errors: err.errors && !Array.isArray(err.errors) ? err.errors : undefined });
  res.status(status).send(errorPage(status, status === 404 ? 'Not found' : 'Something went wrong', message));
});

async function start() {
  if (config.isProd && (config.jwtSecret === 'dev-secret' || config.jwtSecret.startsWith('change-me'))) {
    throw new Error('Set a strong JWT_SECRET environment variable before running in production');
  }
  await sequelize.authenticate();
  if (config.db.dialect === 'sqlite') await sequelize.query('PRAGMA foreign_keys = ON');
  require('./services/jobs').start();
  app.listen(config.port, '0.0.0.0', () => console.log(`Server running on ${config.appUrl} (port ${config.port})`));
}
if (require.main === module) start().catch((e) => { console.error('Failed to start:', e.message); process.exit(1); });

module.exports = app;
