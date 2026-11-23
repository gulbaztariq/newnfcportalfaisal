/* Team onboarding: CSV check (dry run), extra columns, team card design for new and existing members, member export. */
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { boot, client, makeUser, M } = require('./helpers');
const subs = require('../src/services/subscription');

let ctx; let owner; let c; let stranger; let sc; let tplA; let tplB;
before(async () => {
  ctx = await boot(); owner = await makeUser({}); stranger = await makeUser({});
  const plan = await M.Plan.create({ name: 'Team plan', price: 1, frequency: 'yearly', no_of_vcards: 10, no_of_organization_users: 5, custom_duration_days: 365, features: { organisation: true } });
  await subs.activate(owner.id, plan); await subs.activate(stranger.id, plan);
  tplA = await M.Template.create({ name: 'Brand A', slug: 'brand-a', status: true, defaults: {} });
  tplB = await M.Template.create({ name: 'Brand B', slug: 'brand-b', status: true, defaults: {} });
  c = client(ctx.base); sc = client(ctx.base);
  await c.post('/api/auth/login', { email: owner.email, password: 'Passw0rd!x' }); await sc.post('/api/auth/login', { email: stranger.email, password: 'Passw0rd!x' });
  assert.equal((await c.post('/api/user/organisation/enable')).status, 200);
  await c.put('/api/user/organisation', { name: 'Acme Ltd', website: 'acme.test', city: 'Lahore', country: 'Pakistan' });
});
after(async () => { ctx.server.close(); await M.sequelize.close(); });
const csv = (rows) => ['first_name,last_name,email,job_title,alt_email,location,linkedin', ...rows].join('\n');

test('team design: owner saves it, bad template and colours are refused, others cannot', async () => {
  assert.equal((await c.put('/api/user/organisation/brand', { template: 'nope' })).status, 422);
  assert.equal((await sc.put('/api/user/organisation/brand', { template: 'brand-a' })).status, 403, 'not an organisation');
  const r = await c.put('/api/user/organisation/brand', { template: 'brand-a', primary: '#112233', secondary: 'red', font: "Jost, sans-serif<script>" });
  assert.equal(r.status, 200); const b = (await c.get('/api/user/organisation')).body.data.brand;
  assert.equal(b.template, 'brand-a'); assert.equal(b.primary, '#112233'); assert.equal(b.secondary, undefined, 'invalid colour dropped'); assert.ok(!/[<>]/.test(b.font), 'font cleaned');
});
test('CSV check is a dry run: reports problems, creates nothing', async () => {
  const before = await M.User.count({ where: { organisation_id: owner.id } });
  const r = await c.post('/api/user/organisation/members/import', { dry_run: true, csv: csv(['Ayesha,Khan,ayesha.t@acme.test,Sales,,,', 'Bad,Row,not-an-email,,,,', 'Ayesha,Dup,ayesha.t@acme.test,,,,']) });
  assert.equal(r.status, 200); assert.equal(r.body.dry_run, true); assert.equal(r.body.created.length, 1); assert.equal(r.body.errors.length, 2);
  assert.equal(await M.User.count({ where: { organisation_id: owner.id } }), before, 'nothing created');
});
test('import: new members get the team design, company details and the extra columns', async () => {
  const r = await c.post('/api/user/organisation/members/import', { notify: false, csv: csv(['Ayesha,Khan,ayesha.t@acme.test,Sales Lead,ayesha.work@acme.test,"Office 4, Lahore",https://linkedin.com/in/ayesha']) });
  assert.equal(r.body.created.length, 1, r.text);
  const m = await M.User.findOne({ where: { email: 'ayesha.t@acme.test' } }); const v = await M.Vcard.findOne({ where: { user_id: m.id } });
  assert.equal(v.template_id, tplA.id); assert.equal(v.theme.primary, '#112233'); assert.equal(v.company, 'Acme Ltd'); assert.equal(v.job_title, 'Sales Lead');
  assert.equal(v.alternative_email, 'ayesha.work@acme.test'); assert.equal(v.location, 'Office 4, Lahore'); assert.equal(v.social_links.linkedin, 'https://linkedin.com/in/ayesha');
});
test('apply to all: changes member cards only, in the parts chosen', async () => {
  await c.post('/api/user/organisation/members/import', { notify: false, csv: csv(['Bilal,Ahmed,bilal.t@acme.test,Designer,,,']) });
  const ownerCard = await M.Vcard.create({ user_id: owner.id, name: 'Owner card', url_alias: `own-${Date.now()}`, template_id: tplB.id, status: true });
  await c.put('/api/user/organisation/brand', { template: 'brand-b', primary: '#ff0000' });
  assert.equal((await c.post('/api/user/organisation/brand/apply', {})).status, 422, 'must choose something');
  const r = await c.post('/api/user/organisation/brand/apply', { template: true, colours: false, company: false });
  assert.equal(r.body.updated, 2);
  const cards = await M.Vcard.findAll({ include: [{ model: M.User, where: { organisation_id: owner.id }, required: true }] });
  assert.ok(cards.length >= 2 && cards.every((x) => x.template_id === tplB.id), 'template applied');
  assert.ok(cards.every((x) => x.theme.primary === '#112233'), 'colours untouched when not chosen');
  assert.equal((await ownerCard.reload()).template_id, tplB.id);
  await c.post('/api/user/organisation/brand/apply', { colours: true });
  assert.ok((await M.Vcard.findAll({ include: [{ model: M.User, where: { organisation_id: owner.id }, required: true }] })).every((x) => x.theme.primary === '#ff0000'));
  assert.equal((await sc.post('/api/user/organisation/brand/apply', { template: true })).status, 403);
});
test('member export: CSV with card link and counts, owner only', async () => {
  const r = await c.get('/api/user/organisation/members/export?format=csv');
  assert.equal(r.status, 200); assert.match(r.text, /Name,E-mail,Role,Status,Job title,Cards,Card link,Views,Leads/); assert.match(r.text, /ayesha\.t@acme\.test/); assert.match(r.text, /Sales Lead/);
  assert.equal((await sc.get('/api/user/organisation/members/export')).status, 403);
});
