/* Test harness: isolated in-memory sqlite database (never the shared MySQL), real Express app on an ephemeral port, mail captured in memory. */
process.env.DB_DIALECT = 'sqlite';
delete process.env.DB_STORAGE;
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-not-for-production';
delete process.env.DISABLE_LOGIN_OTP;

const bcrypt = require('bcryptjs');
const mail = require('../src/services/mail');
const settings = require('../src/services/settings');
const M = require('../src/models');

const outbox = [];
let mailConfigured = true;
let mailFails = false;
mail.sendTemplate = async (key, to, values) => { if (mailFails) throw new Error('smtp down'); outbox.push({ key, to, values }); };
mail.isConfigured = async () => mailConfigured;

async function boot() {
  await M.sequelize.query('PRAGMA foreign_keys = ON');
  await M.sequelize.sync({ force: true });
  const app = require('../src/index');
  await require('../src/services/settings').set({ login_otp_enable: '0', require_totp_staff: '0', require_totp_company: '0' }); // the product default is ON; ordinary tests log in with a password only (auth.test.js covers the code)
  const server = await new Promise((res) => { const s = app.listen(0, '127.0.0.1', () => res(s)); });
  const base = `http://127.0.0.1:${server.address().port}`;
  return { server, base };
}

/** Tiny cookie-keeping client. */
let ipSeq = 10;
function client(base) {
  let cookies = {};
  const ip = `10.${(ipSeq >> 16) & 255}.${(ipSeq >> 8) & 255}.${ipSeq++ & 255}`; // each client = its own IP so per-IP limiters do not leak between tests
  const call = async (method, path, body, headers = {}) => {
    const res = await fetch(base + path, {
      method, redirect: 'manual',
      headers: { 'X-Forwarded-For': ip, 'X-Requested-With': 'XMLHttpRequest', 'Content-Type': 'application/json', Cookie: Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join('; '), ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    for (const c of res.headers.getSetCookie()) { const [kv] = c.split(';'); const i = kv.indexOf('='); const k = kv.slice(0, i); const v = kv.slice(i + 1); if (v) cookies[k] = v; else delete cookies[k]; }
    const text = await res.text(); let json; try { json = JSON.parse(text); } catch { json = undefined; }
    return { status: res.status, body: json, text, headers: res.headers };
  };
  return { get: (p, h) => call('GET', p, undefined, h), post: (p, b, h) => call('POST', p, b ?? {}, h), patch: (p, b, h) => call('PATCH', p, b ?? {}, h), put: (p, b, h) => call('PUT', p, b ?? {}, h), del: (p, h) => call('DELETE', p, undefined, h), cookies: () => cookies, reset: () => { cookies = {}; } };
}

async function makeUser(over = {}) {
  const email = over.email || `test_${Math.random().toString(36).slice(2, 9)}@example.test`;
  return M.User.create({ first_name: 'Test', last_name: 'User', role: 'user', is_active: true, email_verified_at: new Date(), ...over, email, password: await bcrypt.hash(over.plain || 'Passw0rd!x', 4) });
}

module.exports = { boot, client, makeUser, outbox, settings, M, setMail: (o) => { if ('configured' in o) mailConfigured = o.configured; if ('fails' in o) mailFails = o.fails; } };
