/* Admin tools: translations, extra scripts + CSP, panel colour, database upgrade, domain guide, coupon usage, Facebook login. */
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { boot, client, makeUser, settings, M } = require('./helpers');
const subs = require('../src/services/subscription');

let ctx; let admin; let staff; let user; let card;
before(async () => {
  ctx = await boot(); await settings.set({ enforce_2fa_staff: '0' });
  const sa = await makeUser({ role: 'super_admin' }); admin = client(ctx.base); assert.equal((await admin.post('/api/auth/login', { email: sa.email, password: 'Passw0rd!x' })).status, 200);
  const st = await makeUser({ role: 'admin' }); staff = client(ctx.base); await staff.post('/api/auth/login', { email: st.email, password: 'Passw0rd!x' });
  user = await makeUser({}); const plan = await M.Plan.create({ name: 'T plan', price: 100, frequency: 'yearly', no_of_vcards: 5, custom_duration_days: 365 });
  const coupon = await M.CouponCode.create({ coupon_name: 'EID20', type: 'percentage', discount: 20, status: true });
  await subs.activate(user.id, plan, { coupon: { id: coupon.id, code: 'EID20', type: 'percentage', discount: 20 }, discount: 20 });
  const tpl = await M.Template.findOne() || await M.Template.create({ name: 'T', slug: 'at-t', status: true });
  card = await M.Vcard.create({ user_id: user.id, name: 'Tr card', url_alias: `tr-${Date.now()}`, template_id: tpl.id, status: true });
});
after(async () => { ctx.server.close(); await M.sequelize.close(); });

test('translations: saved wording shows on the card; empty goes back to the standard text', async () => {
  const list = await admin.get('/api/admin/translations?lang=en'); assert.equal(list.status, 200); const save = list.body.data.find((r) => r.key === 'save'); assert.equal(save.english, 'Save Contact');
  assert.equal((await admin.put('/api/admin/translations', { lang: 'en', values: { save: 'Add me to your phone', nonsense_key: 'x', share: '<b>Send</b>' } })).status, 200);
  const html = await (await fetch(`${ctx.base}/${card.url_alias}`)).text();
  assert.match(html, /Add me to your phone/); assert.ok(!html.includes('<b>Send</b>'), 'markup is stripped from translations'); assert.match(html, /bSend\/b/);
  const again = await admin.get('/api/admin/translations?lang=en'); assert.equal(again.body.data.find((r) => r.key === 'save').value, 'Add me to your phone'); assert.ok(!again.body.data.some((r) => r.key === 'nonsense_key'));
  assert.equal((await admin.put('/api/admin/translations', { lang: 'DROP TABLE', values: {} })).status, 422);
  await admin.put('/api/admin/translations', { lang: 'en', values: {} });
  assert.match(await (await fetch(`${ctx.base}/${card.url_alias}`)).text(), /Save Contact/);
  assert.equal((await client(ctx.base).get('/api/admin/translations')).status, 401);
});

test('extra scripts: only https addresses, and their origin is allowed by the page security header', async () => {
  const bad = await admin.put('/api/admin/settings', { front_extra_scripts: 'javascript:alert(1)' }); assert.equal(bad.status, 422); assert.ok(bad.body.errors.front_extra_scripts);
  assert.equal((await admin.put('/api/admin/settings', { front_extra_scripts: '<script>alert(1)</script>' })).status, 422);
  assert.equal((await admin.put('/api/admin/settings', { front_extra_scripts: 'https://cdn.chat-widget.example/w.js\nhttps://px.example.org/p.js' })).status, 200);
  const pub = await (await fetch(`${ctx.base}/api/public/settings`)).json(); assert.deepEqual(pub.data.front_extra_scripts, ['https://cdn.chat-widget.example/w.js', 'https://px.example.org/p.js']);
  const csp = (await fetch(`${ctx.base}/api/public/settings`)).headers.get('content-security-policy'); assert.match(csp, /script-src[^;]*https:\/\/cdn\.chat-widget\.example/); assert.ok(!/script-src[^;]*'unsafe-inline'/.test(csp), 'inline scripts stay blocked');
  await admin.put('/api/admin/settings', { front_extra_scripts: '' });
  assert.ok(!(await fetch(`${ctx.base}/api/public/settings`)).headers.get('content-security-policy').includes('chat-widget'));
});

test('panel colour, sign-in design, cookie notice and section switches are validated and public', async () => {
  assert.equal((await admin.put('/api/admin/settings', { panel_color: 'red' })).status, 422);
  assert.equal((await admin.put('/api/admin/settings', { auth_theme: 'hacker' })).status, 422);
  assert.equal((await admin.put('/api/admin/settings', { panel_color: '#2563eb', auth_theme: 'centered', cookie_consent_enable: '1', cookie_consent_text: 'Cookies <script>x</script>help', front_sec_faqs: '0', i18n_overrides: '{"en":{"save":"hijack"}}' })).status, 200);
  const s = (await (await fetch(`${ctx.base}/api/public/settings`)).json()).data;
  assert.equal(s.panel_color, '#2563eb'); assert.equal(s.auth_theme, 'centered'); assert.equal(s.cookie_consent_enable, '1'); assert.equal(s.cookie_consent_text, 'Cookies xhelp'); assert.equal(s.front_sec_faqs, '0');
  assert.ok(!('facebook_app_secret' in s) && !('i18n_overrides' in s));
  assert.ok(!(await (await fetch(`${ctx.base}/${card.url_alias}`)).text()).includes('hijack'), 'translations cannot be set through general settings');
});

test('database upgrade is super-admin only and safe to repeat', async () => {
  assert.equal((await staff.post('/api/admin/settings/db-upgrade')).status, 403);
  const before = await M.User.count(); const r = await admin.post('/api/admin/settings/db-upgrade'); assert.equal(r.status, 200, r.text); assert.match(r.body.message, /up to date|upgraded/);
  assert.equal((await admin.post('/api/admin/settings/db-upgrade')).status, 200); assert.equal(await M.User.count(), before);
});

test('custom-domain guide is a PDF; coupon usage lists who used it', async () => {
  const pdf = await fetch(`${ctx.base}/api/admin/custom-domains/guide`, { headers: { Cookie: Object.entries(admin.cookies()).map(([k, v]) => `${k}=${v}`).join('; ') } });
  assert.equal(pdf.status, 200); assert.match(pdf.headers.get('content-type'), /pdf/); assert.equal(Buffer.from(await pdf.arrayBuffer()).subarray(0, 4).toString(), '%PDF');
  const c = await M.CouponCode.findOne({ where: { coupon_name: 'EID20' } });
  const uses = await admin.get(`/api/admin/coupon-uses/${c.id}`); assert.equal(uses.status, 200); assert.equal(uses.body.data.length, 1); assert.equal(uses.body.data[0].user.email, user.email);
  assert.equal((await admin.get('/api/admin/coupon-uses/999999')).status, 404);
  assert.equal((await admin.get('/api/admin/custom-domains')).status, 200, 'the list still works next to the guide');
});

test('Facebook login: off by default; a token for another app or without e-mail is refused; a good one signs in', async () => {
  const pub = client(ctx.base);
  assert.equal((await pub.post('/api/auth/facebook', { access_token: 'x' })).status, 422);
  await settings.set({ facebook_login_enable: '1', facebook_app_id: '111', facebook_app_secret: 'shh', login_otp_enable: '0' });
  const real = global.fetch; let debug = { data: { is_valid: true, app_id: '999', user_id: '42' } }; let me = { id: '42', email: 'fbuser@example.test', first_name: 'Fa', last_name: 'Bo' };
  global.fetch = async (u, o) => (String(u).includes('graph.facebook.com/debug_token') ? new Response(JSON.stringify(debug)) : String(u).includes('graph.facebook.com/me') ? new Response(JSON.stringify(me)) : real(u, o));
  try {
    assert.equal((await pub.post('/api/auth/facebook', { access_token: 'tok' })).status, 422, 'token issued for another app');
    debug = { data: { is_valid: true, app_id: '111', user_id: '42' } }; me = { id: '42' };
    const noMail = await pub.post('/api/auth/facebook', { access_token: 'tok' }); assert.equal(noMail.status, 422); assert.match(noMail.body.message, /did not share an e-mail/);
    me = { id: '77', email: 'x@example.test' }; assert.equal((await pub.post('/api/auth/facebook', { access_token: 'tok' })).status, 422, 'profile does not match the token');
    me = { id: '42', email: 'fbuser@example.test', first_name: 'Fa', last_name: 'Bo' };
    const ok = await pub.post('/api/auth/facebook', { access_token: 'tok' }); assert.equal(ok.status, 200, ok.text); assert.equal(ok.body.user.email, 'fbuser@example.test');
    assert.ok(await M.User.findOne({ where: { email: 'fbuser@example.test' } }));
  } finally { global.fetch = real; }
});
