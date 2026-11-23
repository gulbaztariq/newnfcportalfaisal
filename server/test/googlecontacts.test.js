/* Google Contacts sync with Google itself mocked (no network): OAuth state, token storage, lead push, bulk push, revoke handling. */
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { boot, client, makeUser, M, settings } = require('./helpers');
const gc = require('../src/services/googlecontacts');
const usersettings = require('../src/services/usersettings');

let ctx; let u; let card; let c; let calls = []; let realFetch; let tokenMode = 'ok';
const idToken = `x.${Buffer.from(JSON.stringify({ email: 'owner@gmail.test' })).toString('base64url')}.y`;
before(async () => {
  ctx = await boot(); u = await makeUser({});
  const plan = await M.Plan.create({ name: 'GC plan', price: 1, frequency: 'yearly', no_of_vcards: 5, custom_duration_days: 365 }); await require('../src/services/subscription').activate(u.id, plan);
  const tpl = await M.Template.findOne() || await M.Template.create({ name: 'T', slug: 'gc-t', status: true });
  card = await M.Vcard.create({ user_id: u.id, template_id: tpl.id, url_alias: `gc-${Date.now()}`, name: 'GC card', status: true, enable_enquiry_form: true });
  c = client(ctx.base); await c.post('/api/auth/login', { email: u.email, password: 'Passw0rd!x' });
  realFetch = global.fetch;
  global.fetch = async (url, opts = {}) => {
    const s = String(url);
    if (!/googleapis\.com|accounts\.google\.com/.test(s)) return realFetch(url, opts);
    calls.push({ url: s, opts });
    const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
    if (s.includes('oauth2.googleapis.com/token')) {
      const p = new URLSearchParams(String(opts.body));
      if (p.get('grant_type') === 'refresh_token') return tokenMode === 'revoked' ? json(400, { error: 'invalid_grant' }) : json(200, { access_token: 'access-1' });
      return json(200, tokenMode === 'noRefresh' ? { access_token: 'a', id_token: idToken } : { access_token: 'a', refresh_token: 'refresh-1', id_token: idToken });
    }
    if (s.includes('people:createContact')) return json(200, { resourceName: `people/c${calls.length}` });
    return json(200, {});
  };
});
after(async () => { global.fetch = realFetch; ctx.server.close(); await M.sequelize.close(); });
const lead = (name = 'Ali Raza') => client(ctx.base).post(`/api/public/vcards/${card.url_alias}/enquiry`, { name, email: 'ali@example.com', phone: '0300 123-4567', message: 'Need cards' });
const wait = async (fn, ms = 3000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fn()) return true; await new Promise((r) => setTimeout(r, 40)); } return false; };

test('not set up: status says so and Connect is refused', async () => {
  assert.equal((await c.get('/api/user/integrations/google')).body.configured, false);
  assert.equal((await c.post('/api/user/integrations/google/connect')).status, 422);
});
test('connect: auth URL carries the right scope and a state that cannot be forged or reused after expiry', async () => {
  await settings.set({ google_client_id: 'cid.apps.googleusercontent.com', google_client_secret: 'csecret' });
  const r = await c.post('/api/user/integrations/google/connect'); assert.equal(r.status, 200);
  const url = new URL(r.body.url); assert.equal(url.hostname, 'accounts.google.com'); assert.equal(url.searchParams.get('access_type'), 'offline');
  assert.match(url.searchParams.get('scope'), /auth\/contacts/); assert.match(url.searchParams.get('redirect_uri'), /\/api\/public\/integrations\/google\/callback$/);
  const state = url.searchParams.get('state'); assert.equal(gc.readState(state), u.id);
  assert.equal(gc.readState(`${state}x`), null); assert.equal(gc.readState('garbage'), null);
  const [body] = state.split('.'); assert.equal(gc.readState(`${body}.${'A'.repeat(43)}`), null);
  const old = Buffer.from(JSON.stringify({ u: u.id, e: Date.now() - 1000 })).toString('base64url'); assert.equal(gc.readState(`${old}.${require('crypto').createHmac('sha256', `google-state:${require('../src/config').jwtSecret}`).update(old).digest('base64url')}`), null, 'expired');
});
test('callback: bad state refused; good state stores the token sealed and never shows it', async () => {
  assert.equal((await client(ctx.base).get('/api/public/integrations/google/callback?code=abc&state=nope')).status, 400);
  const state = new URL((await c.post('/api/user/integrations/google/connect')).body.url).searchParams.get('state');
  const r = await client(ctx.base).get(`/api/public/integrations/google/callback?code=abc&state=${encodeURIComponent(state)}`);
  assert.equal(r.status, 302); assert.match(r.headers.get('location'), /\/user\/webhooks\?google=connected$/);
  const st = (await c.get('/api/user/integrations/google')).body; assert.equal(st.connected, true); assert.equal(st.email, 'owner@gmail.test'); assert.equal(st.auto, true);
  assert.ok(!JSON.stringify(st).includes('refresh-1')); assert.ok(!JSON.stringify(await usersettings.view(u.id)).includes('refresh-1'));
  const row = await M.UserSetting.findOne({ where: { user_id: u.id } }); assert.ok(!String(row.secrets).includes('refresh-1'), 'sealed at rest');
  const denied = await client(ctx.base).get(`/api/public/integrations/google/callback?error=access_denied&state=${encodeURIComponent(state)}`); assert.match(denied.headers.get('location'), /google=denied/);
});
test('new lead is added to Google Contacts once, with name, email, phone and a note', async () => {
  calls = []; assert.equal((await lead()).status, 200);
  assert.ok(await wait(() => calls.some((x) => x.url.includes('createContact'))), 'pushed');
  const call = calls.find((x) => x.url.includes('createContact')); assert.equal(call.opts.headers.Authorization, 'Bearer access-1');
  const body = JSON.parse(call.opts.body); assert.equal(body.names[0].givenName, 'Ali'); assert.equal(body.names[0].familyName, 'Raza'); assert.equal(body.emailAddresses[0].value, 'ali@example.com');
  assert.equal(body.phoneNumbers[0].value, '03001234567'); assert.match(body.biographies[0].value, /GC card.*Need cards/);
  assert.ok(await wait(async () => (await M.VcardEnquiry.findOne({ where: { vcard_id: card.id } })).google_contact), 'resource name stored');
});
test('auto-sync off: new leads are not sent; "send existing leads" sends them once', async () => {
  assert.equal((await c.put('/api/user/integrations/google', { auto: false })).body.auto, false);
  calls = []; await lead('Sana Malik'); await new Promise((r) => setTimeout(r, 400)); assert.equal(calls.filter((x) => x.url.includes('createContact')).length, 0);
  let r = await c.post('/api/user/integrations/google/sync-all'); assert.equal(r.status, 200); assert.equal(r.body.sent, 1);
  r = await c.post('/api/user/integrations/google/sync-all'); assert.equal(r.body.sent, 0, 'nothing sent twice');
});
test('revoked in Google: the connection is dropped; disconnect clears everything', async () => {
  tokenMode = 'revoked'; await lead('Zed'); await M.UserSetting.update({ data: { ...(await M.UserSetting.findOne({ where: { user_id: u.id } })).data, google_sync: '1' } }, { where: { user_id: u.id } });
  const r = await c.post('/api/user/integrations/google/sync-all'); assert.ok(r.status >= 400);
  assert.equal((await c.get('/api/user/integrations/google')).body.connected, false, 'forgotten after invalid_grant');
  tokenMode = 'ok'; const state = new URL((await c.post('/api/user/integrations/google/connect')).body.url).searchParams.get('state');
  await client(ctx.base).get(`/api/public/integrations/google/callback?code=abc&state=${encodeURIComponent(state)}`);
  assert.equal((await c.get('/api/user/integrations/google')).body.connected, true);
  assert.equal((await c.post('/api/user/integrations/google/disconnect')).body.connected, false);
  assert.equal((await c.post('/api/user/integrations/google/sync-all')).status, 422);
  tokenMode = 'noRefresh'; const s2 = new URL((await c.post('/api/user/integrations/google/connect')).body.url).searchParams.get('state');
  assert.match((await client(ctx.base).get(`/api/public/integrations/google/callback?code=abc&state=${encodeURIComponent(s2)}`)).headers.get('location'), /google=failed/);
});
