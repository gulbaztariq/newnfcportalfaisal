// Logs in as admin and as a normal user, creates edge-case data (long names, missing images), and records real record ids for the route list.
const { request } = require('@playwright/test');
const fs = require('fs'); const path = require('path');
const WORK = path.join(__dirname, '.work'); const API = 'http://localhost:5102'; const H = { 'X-Requested-With': 'XMLHttpRequest' };

module.exports = async () => {
  fs.mkdirSync(WORK, { recursive: true });
  const login = async (email, file) => {
    const ctx = await request.newContext({ baseURL: API, extraHTTPHeaders: H });
    const r = await ctx.post('/api/auth/login', { data: { email, password: '123456' } });
    if (!r.ok()) throw new Error(`login ${email} failed: ${r.status()} ${await r.text()}`);
    await ctx.storageState({ path: path.join(WORK, file) }); return ctx;
  };
  const admin = await login('sadmin@vcard.com', 'admin.json'); const user = await login('user@vcard.com', 'user.json');
  const list = async (ctx, url) => { const r = await ctx.get(url); return r.ok() ? ((await r.json()).data || []) : []; };

  // edge-case data: very long text, special characters, empty optional fields
  const long = 'Extraordinarily long product name that keeps going to test wrapping and truncation inside cards 0123456789 ' .repeat(2).trim();
  await admin.post('/api/admin/nfc-cards', { data: { name: long, slug: 'e2e-long', price: 123456789.5, status: true, description: '' } }).catch(() => {});
  await admin.post('/api/admin/nfc-cards', { data: { name: 'Café <b>"Quotes"</b> & Ünïcödé 日本語 مرحبا', slug: 'e2e-special', price: 0, status: true } }).catch(() => {});
  await user.post('/api/user/vcards', { data: { name: long, first_name: 'Ünïcödé', last_name: 'X'.repeat(80) } }).catch(() => {});

  const ids = {};
  ids.orders = (await list(admin, '/api/admin/orders?per_page=3')).map((x) => x.id);
  ids.users = (await list(admin, '/api/admin/users?per_page=3')).map((x) => x.id);
  ids.vendors = (await list(admin, '/api/admin/vendors?per_page=2')).map((x) => x.id);
  ids.invoices = (await list(admin, '/api/admin/invoices?per_page=2')).map((x) => x.id);
  ids.guests = (await list(admin, '/api/admin/guest-customers?per_page=2')).map((x) => x.id);
  ids.plans = (await list(admin, '/api/admin/plans?per_page=2')).map((x) => x.id);
  ids.vcards = (await list(user, '/api/user/vcards')).map((x) => x.id);
  ids.adminVcards = (await list(admin, '/api/admin/vcards?per_page=3')).map((x) => ({ id: x.id, alias: x.url_alias }));
  const shop = await (await request.newContext({ baseURL: API })).get('/api/shop/products').catch(() => null);
  ids.shop = shop && shop.ok() ? ((await shop.json()).data || []).slice(0, 4).map((x) => x.slug) : [];
  ids.blog = (await list(admin, '/api/admin/blog?per_page=2')).map((x) => x.slug).filter(Boolean);
  ids.orderNumbers = (await list(admin, '/api/admin/orders?per_page=2')).map((x) => x.order_number);
  fs.writeFileSync(path.join(WORK, 'ids.json'), JSON.stringify(ids, null, 2));
  await admin.dispose(); await user.dispose();
};
