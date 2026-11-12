/* Validation messages name the field: "E-mail address is required", never a bare "This field is required". */
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { boot, client, makeUser, M } = require('./helpers');
const { validate } = require('../src/utils/http');

let ctx;
before(async () => { ctx = await boot(); });
after(async () => { ctx.server.close(); await M.sequelize.close(); });

const errs = (body, rules, labels) => { try { validate(body, rules, labels); return {}; } catch (e) { return e.errors || {}; } };

test('required: the message names the field the person sees', () => {
  const e = errs({}, { email: 'required|email', first_name: 'required', last_name: 'required', contact: 'required', customer_name: 'required', url_alias: 'required', password_confirmation: 'required', no_of_vcards: 'required' });
  assert.equal(e.email, 'E-mail address is required'); assert.equal(e.first_name, 'First name is required'); assert.equal(e.last_name, 'Last name is required');
  assert.equal(e.contact, 'Phone number is required'); assert.equal(e.customer_name, 'Customer name is required'); assert.equal(e.url_alias, 'Card link is required');
  assert.equal(e.password_confirmation, 'Password confirmation is required'); assert.equal(e.no_of_vcards, 'Number of vCards is required');
  for (const m of Object.values(e)) assert.ok(!/this field/i.test(m), m);
});
test('selects and ids read as a choice; custom labels win', () => {
  const e = errs({}, { plan_id: 'required', template_id: 'required', status: 'required|in:a,b', code: 'required' }, { code: 'Coupon code' });
  assert.equal(e.plan_id, 'Please choose a plan'); assert.equal(e.template_id, 'Please choose a template'); assert.equal(e.status, 'Please choose a status'); assert.equal(e.code, 'Coupon code is required');
});
test('format rules: e-mail, phone, url, alias, numbers, dates, length, matching', () => {
  const e = errs({ email: 'x', alternative_email: 'y', contact: '12', link_url: 'ftp://a', url_alias: 'a b', price: 'abc', qty: '1.5', amount: '-1', date: 'not a date', password: 'abc', name: 'x'.repeat(200), pc: 'q', status: 'zzz' },
    { email: 'email', alternative_email: 'email', contact: 'phone', link_url: 'url', url_alias: 'alias', price: 'numeric', qty: 'integer', amount: 'minv:0', date: 'date', password: 'min:8', name: 'max:120', pc: 'same:password', status: 'in:a,b' });
  assert.match(e.email, /^Enter a valid e-mail address/); assert.equal(e.alternative_email, 'Alternative e-mail must be a valid e-mail address');
  assert.match(e.contact, /Phone number is not a valid phone number/); assert.match(e.link_url, /^Link address must be a valid web address/);
  assert.match(e.url_alias, /^Card link can only contain letters/); assert.equal(e.price, 'Price must be a number'); assert.equal(e.qty, 'Qty must be a whole number');
  assert.equal(e.amount, 'Amount must be 0 or more'); assert.equal(e.date, 'Date must be a valid date'); assert.equal(e.password, 'Password must be at least 8 characters');
  assert.equal(e.name, 'Name must be 120 characters or fewer'); assert.equal(e.pc, 'Pc does not match password'); assert.equal(e.status, 'Choose a valid status');
  assert.deepEqual(errs({ email: 'a@b.co', contact: '+92 300 1234567', link_url: 'https://x.co', url_alias: 'ok-1', price: '5.5', qty: '3', date: '2026-01-01' }, { email: 'email', contact: 'phone', link_url: 'url', url_alias: 'alias', price: 'numeric', qty: 'integer', date: 'date' }), {});
});
test('API: registration, login and forgot-password say which field is wrong', async () => {
  const c = client(ctx.base);
  let r = await c.post('/api/auth/register', {}); assert.equal(r.status, 422);
  assert.equal(r.body.errors.first_name, 'First name is required'); assert.equal(r.body.errors.last_name, 'Last name is required'); assert.equal(r.body.errors.email, 'E-mail address is required'); assert.equal(r.body.errors.password, 'Password is required');
  r = await c.post('/api/auth/register', { first_name: 'A', last_name: 'B', email: 'nope', password: 'short', contact: 'abc' });
  assert.match(r.body.errors.email, /valid e-mail/); assert.equal(r.body.errors.password, 'Password must be at least 8 characters'); assert.match(r.body.errors.contact, /Phone number/);
  r = await c.post('/api/auth/login', {}); assert.equal(r.body.errors.email, 'E-mail address is required'); assert.equal(r.body.errors.password, 'Password is required');
  r = await c.post('/api/auth/forgot-password', { email: 'bad' }); assert.match(r.body.errors.email, /valid e-mail/);
});
test('API: signed-in forms (card, invoice lines, coupon) give field-specific messages', async () => {
  const admin = await makeUser({ role: 'super_admin' }); const c = client(ctx.base);
  await require('./helpers').settings.set({ enforce_2fa_staff: '0', login_otp_enable: '0' });
  assert.equal((await c.post('/api/auth/login', { email: admin.email, password: 'Passw0rd!x' })).status, 200);
  let r = await c.post('/api/admin/invoices', {}); assert.equal(r.body.errors.customer_name, 'Customer name is required');
  r = await c.post('/api/admin/invoices', { customer_name: 'A', customer_email: 'x', tax_rate: '150', items: [] });
  assert.match(r.body.errors.customer_email, /Customer e-mail must be a valid e-mail/); assert.equal(r.body.errors.tax_rate, 'Tax rate must be 100 or less');
  r = await c.post('/api/admin/invoices', { customer_name: 'A', items: JSON.stringify([{ description: '', quantity: 1, unit_price: 5 }]) }); assert.equal(r.body.errors.items, 'Line 1: description is required');
  r = await c.post('/api/admin/invoices', { customer_name: 'A', items: JSON.stringify([{ description: 'x', quantity: 1, unit_price: -5 }]) }); assert.equal(r.body.errors.items, 'Line 1: price must be zero or more');
  r = await c.post('/api/admin/plans', {}); assert.equal(r.body.errors.name, 'Name is required'); assert.equal(r.body.errors.currency_id, 'Please choose a currency'); assert.equal(r.body.errors.price, 'Price is required');
  r = await c.post('/api/admin/plans', { name: 'P', currency_id: 1, price: '-3', frequency: 'weekly', no_of_vcards: '1.5' });
  assert.equal(r.body.errors.price, 'Price must be 0 or more'); assert.equal(r.body.errors.frequency, 'Choose a valid frequency'); assert.equal(r.body.errors.no_of_vcards, 'Number of vCards must be a whole number');
});
