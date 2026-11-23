/*
 * End-to-end scenario: one company ("Acme Traders") from sign-up to clean-up, adding data and then changing it.
 * Real HTTP against the real app and a throwaway database; only Google is mocked. Steps run in order and build on each other.
 *
 *  1 owner builds the company        7 visitors scan, tap, click campaign links, send leads
 *  2 team design + CSV check/import  8 member follows up leads (update), exports
 *  3 invited member joins            9 analytics shows what happened
 *  4 member fills in the card       10 owner changes the design and applies it to everyone (update)
 *  5 public card + .vcf shows it    11 lock, unlock, block, remove
 *  6 member connects webhook+Google 12 another company cannot see any of it
 */
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const { boot, client, makeUser, M, settings, outbox, setMail } = require('./helpers');
const subs = require('../src/services/subscription');
const shortlinks = require('../src/services/shortlinks');
const wa = require('../src/services/whatsapp');

const UA = { 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 Version/17.4 Mobile/15E148 Safari/604.1' };
const wait = async (fn, ms = 4000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fn()) return true; await new Promise((r) => setTimeout(r, 40)); } return false; };

let ctx; let owner; let oc; let tplA; let tplB; let member; let mc; let card; let sink; let hits = []; let gcalls = []; let realFetch; let outsider; let xc;
const PASS = 'Member-Pass-2026!';

before(async () => {
  ctx = await boot(); setMail({ configured: true, fails: false }); await settings.set({ login_otp_enable: '0', enforce_2fa_staff: '0', google_client_id: 'cid', google_client_secret: 'csecret' });
  owner = await makeUser({}); outsider = await makeUser({});
  const plan = await M.Plan.create({ name: 'Business', price: 10, frequency: 'yearly', no_of_vcards: 10, no_of_organization_users: 3, custom_duration_days: 365, storage_limit: 500, features: { organisation: true, enquiry_form: true, custom_qrcode: true, analytics: true } });
  await subs.activate(owner.id, plan); await subs.activate(outsider.id, plan);
  tplA = await M.Template.create({ name: 'Scenario A', slug: 'scn-a', status: true, defaults: {} });
  tplB = await M.Template.create({ name: 'Scenario B', slug: 'scn-b', status: true, defaults: {} });
  oc = client(ctx.base); xc = client(ctx.base);
  await oc.post('/api/auth/login', { email: owner.email, password: 'Passw0rd!x' }); await xc.post('/api/auth/login', { email: outsider.email, password: 'Passw0rd!x' });
  sink = http.createServer((req, res) => { let b = ''; req.on('data', (d) => { b += d; }); req.on('end', () => { hits.push({ url: req.url, body: b }); res.statusCode = 200; res.end('ok'); }); });
  await new Promise((r) => sink.listen(0, '127.0.0.1', r));
  realFetch = global.fetch;
  global.fetch = async (url, opts = {}) => {
    const s = String(url); if (!/googleapis\.com|accounts\.google\.com/.test(s)) return realFetch(url, opts);
    gcalls.push({ url: s, opts }); const json = (st, b) => new Response(JSON.stringify(b), { status: st, headers: { 'Content-Type': 'application/json' } });
    if (s.includes('/token')) return new URLSearchParams(String(opts.body)).get('grant_type') === 'refresh_token' ? json(200, { access_token: 'acc' }) : json(200, { access_token: 'a', refresh_token: 'r1', id_token: `x.${Buffer.from(JSON.stringify({ email: 'sara@gmail.test' })).toString('base64url')}.y` });
    if (s.includes('createContact')) return json(200, { resourceName: `people/c${gcalls.length}` });
    return json(200, {});
  };
});
after(async () => { global.fetch = realFetch; sink.close(); ctx.server.close(); await M.sequelize.close(); });

const sinkUrl = (p = '/hook') => `http://127.0.0.1:${sink.address().port}${p}`;
const visit = (path) => client(ctx.base).get(path, UA); // every call is a new visitor (own IP)
const lead = (alias, body) => client(ctx.base).post(`/api/public/vcards/${alias}/enquiry`, body);
const csv = (rows) => ['first_name,last_name,email,job_title,alt_email,location', ...rows].join('\n');

/* ------------------------------------------------------------ 1 company */
test('1. owner turns the account into an organisation and saves the company profile', async () => {
  assert.equal((await oc.post('/api/user/organisation/enable')).status, 200);
  assert.equal((await oc.put('/api/user/organisation', { name: 'Acme Traders', website: 'acme.test', email: 'hello@acme.test', city: 'Lahore', country: 'Pakistan', address: 'Plot 5, Gulberg' })).status, 200);
  const r = (await oc.get('/api/user/organisation')).body; assert.equal(r.data.name, 'Acme Traders'); assert.equal(r.seats.limit, 3); assert.equal(r.seats.used, 0);
  // update: change the city, the rest stays
  await oc.put('/api/user/organisation', { name: 'Acme Traders', website: 'acme.test', email: 'hello@acme.test', city: 'Islamabad', country: 'Pakistan', address: 'Plot 5, Gulberg' });
  assert.equal((await oc.get('/api/user/organisation')).body.data.city, 'Islamabad');
});

/* --------------------------------------------------- 2 design + import */
test('2. team design is saved; the CSV check finds the bad rows without creating anyone; the import creates the good ones', async () => {
  assert.equal((await oc.put('/api/user/organisation/brand', { template: 'scn-a', primary: '#0a7d4b', background: '#fafafa' })).status, 200);
  const file = csv(['Sara,Malik,sara@acme.test,Head of Sales,sara.work@acme.test,"Office 3, Gulberg"', 'Bilal,Ahmed,not-an-email,Designer,,', 'Sara,Dup,sara@acme.test,Clone,,', 'Omar,Sheikh,omar@acme.test,Driver,,']);
  const check = (await oc.post('/api/user/organisation/members/import', { dry_run: true, csv: file })).body;
  assert.equal(check.created.length, 2); assert.equal(check.errors.length, 2); assert.equal(await M.User.count({ where: { organisation_id: owner.id } }), 0, 'check creates nobody');
  assert.ok(check.errors.some((e) => /invalid/i.test(e.message)) && check.errors.some((e) => /Duplicate/i.test(e.message)));
  outbox.length = 0;
  const done = (await oc.post('/api/user/organisation/members/import', { csv: file, notify: false })).body;
  assert.equal(done.created.length, 2, JSON.stringify(done.errors)); assert.equal(await M.User.count({ where: { organisation_id: owner.id } }), 2);
  member = await M.User.findOne({ where: { email: 'sara@acme.test' } }); assert.ok(member); globalThis.__invite = done.created.find((x) => x.email === 'sara@acme.test').invite_url; assert.ok(globalThis.__invite);
  // seats: limit 3, two used; a fourth person is refused once the seats run out
  const more = (await oc.post('/api/user/organisation/members/import', { csv: csv(['A,One,a1@acme.test,,,', 'B,Two,b2@acme.test,,,']), notify: false })).body;
  assert.equal(more.created.length, 1); assert.match(more.errors[0].message, /No seats left/);
});

/* ------------------------------------------------------------ 3 member */
test('3. the invited member sets a password and signs in; their starter card has the team design and company details', async () => {
  const u = new URL(globalThis.__invite);
  assert.equal((await client(ctx.base).post('/api/auth/reset-password', { email: u.searchParams.get('email'), token: u.searchParams.get('token'), password: PASS, password_confirmation: PASS })).status, 200);
  mc = client(ctx.base); assert.equal((await mc.post('/api/auth/login', { email: member.email, password: PASS })).status, 200);
  card = await M.Vcard.findOne({ where: { user_id: member.id } }); assert.ok(card, 'starter card exists');
  assert.equal(card.template_id, tplA.id); assert.equal(card.theme.primary, '#0a7d4b'); assert.equal(card.company, 'Acme Traders'); assert.equal(card.job_title, 'Head of Sales');
  assert.equal(card.alternative_email, 'sara.work@acme.test'); assert.equal(card.location, 'Office 3, Gulberg');
});

/* ---------------------------------------------------- 4 member edits */
test('4. the member fills in their card: phone, WhatsApp message, bank accounts, payment details (add, then update)', async () => {
  const put = (body) => mc.put(`/api/user/vcards/${card.id}`, body);
  let r = await put({ phone: '3001234567', region_code: '92', description: 'Head of Sales, Acme Traders.', social_links: { website: 'https://acme.test', linkedin: 'https://linkedin.com/in/sara', instagram: 'https://instagram.com/sara' },
    extras: { whatsapp_text: 'Hi Sara, I saw your card' }, bank_accounts: [{ kind: 'bank', name: 'Meezan Bank', title: 'Acme Traders', account: '0123456789012', iban: 'pk36 meze 0000 0123 4567 8901' }, { kind: 'wallet', name: 'JazzCash', title: 'Sara Malik', account: '03001234567' }] });
  assert.equal(r.status, 200, r.text);
  await card.reload(); assert.equal(card.bank_accounts.length, 2); assert.equal(card.bank_accounts[0].iban, 'PK36MEZE0000012345678901', 'IBAN cleaned');
  // update: change one account's number, add a custom wallet, drop the one with no number
  r = await put({ bank_accounts: [{ kind: 'bank', name: 'Meezan Bank', title: 'Acme Traders', account: '0999999999999' }, { kind: 'wallet', name: 'My Local Wallet', title: 'Sara', account: '0345' }, { kind: 'bank', name: 'Empty Bank' }] });
  assert.equal(r.status, 200); await card.reload();
  assert.deepEqual(card.bank_accounts.map((a) => [a.name, a.account]), [['Meezan Bank', '0999999999999'], ['My Local Wallet', '0345']], 'edited, custom name kept, empty one dropped');
});

/* ----------------------------------------------- 5 public page + vcf */
test('5. the public card and the contact file show what the member entered', async () => {
  const page = (await visit(`/${card.url_alias}`)).text;
  assert.ok(page.includes('Sara') && page.includes('Acme Traders')); assert.ok(page.includes('0999999999999') && page.includes('data-copy="0999999999999"'), 'copy button for the account number');
  assert.ok(page.includes('My Local Wallet') && !page.includes('Empty Bank')); assert.ok(page.includes('wa.me/923001234567?text=Hi%20Sara%2C%20I%20saw%20your%20card'), 'WhatsApp opens with the prepared message');
  const vcf = (await visit(`/${card.url_alias}/contact.vcf`)).text;
  assert.match(vcf, /^BEGIN:VCARD\r\nVERSION:3\.0/); assert.match(vcf, /TEL;TYPE=CELL,VOICE,PREF:\+923001234567/); assert.match(vcf, /EMAIL;TYPE=INTERNET,PREF:sara@acme\.test/);
  assert.match(vcf, /ORG:Acme Traders/); assert.match(vcf, /TITLE:Head of Sales/); assert.match(vcf, /X-SOCIALPROFILE;TYPE=linkedin:https:\/\/linkedin\.com\/in\/sara/); assert.ok(/URL;TYPE=PROFILE:/.test(vcf));
});

/* ---------------------------------------------- 6 webhook + google */
test('6. the member connects a webhook and Google Contacts', async () => {
  const w = await mc.post('/api/user/webhooks', { name: 'CRM', url: sinkUrl('/crm'), events: ['lead.created', 'subscriber.created'] }); assert.equal(w.status, 201, w.text);
  const state = new URL((await mc.post('/api/user/integrations/google/connect')).body.url).searchParams.get('state');
  const cb = await client(ctx.base).get(`/api/public/integrations/google/callback?code=abc&state=${encodeURIComponent(state)}`); assert.match(cb.headers.get('location'), /google=connected/);
  const st = (await mc.get('/api/user/integrations/google')).body; assert.equal(st.connected, true); assert.equal(st.email, 'sara@gmail.test');
});

/* ----------------------------------------------------- 7 visitors */
test('7. visitors scan the QR, tap the NFC card, follow a campaign link, write to the member, subscribe, and message on WhatsApp', async () => {
  const link = await shortlinks.forVcard(card);
  // QR: the code opens /r/<code>?via=qr, which sends the visitor to the card; NFC: /r/<code> with nothing else
  for (const [via, qs] of [['qr', '?via=qr'], ['nfc', '']]) { const r = await visit(`/r/${link.code}${qs}`); assert.equal(r.status, 302); const to = new URL(r.headers.get('location')); assert.equal(to.searchParams.get('via'), via); assert.equal((await visit(`${to.pathname}${to.search}`)).status, 200); }
  assert.equal((await visit(`/${card.url_alias}?utm_source=newsletter&utm_medium=email&utm_campaign=eid-sale`)).status, 200);
  assert.equal((await visit(`/${card.url_alias}?utm_source=newsletter&utm_medium=email&utm_campaign=eid-sale`)).status, 200);
  assert.equal((await visit(`/${card.url_alias}`)).status, 200);
  hits = []; gcalls = [];
  assert.equal((await lead(card.url_alias, { name: 'Ayesha Khan', email: 'ayesha@client.test', phone: '0321 7654321', message: 'We need 40 cards for our team' })).status, 200);
  assert.equal((await lead(card.url_alias, { name: '', message: '' })).status, 422, 'empty form refused');
  assert.equal((await client(ctx.base).post(`/api/public/vcards/${card.url_alias}/subscribe`, { email: 'reader@client.test' })).status, 200);
  const line = await M.WhatsappLine.create({ user_id: member.id, vcard_id: card.id, label: 'Sales line', phone_number_id: `pn-${Date.now()}`, provider: 'qr', status: true });
  await wa.receive(line, { waId: '923335556666', name: 'Hamza', text: 'Price of the metal card?', msgId: `m-${Date.now()}` });
  assert.ok(await wait(() => hits.length >= 3), `webhook deliveries: ${hits.length}`);
  const events = hits.map((h) => JSON.parse(h.body).event).sort(); assert.deepEqual(events, ['lead.created', 'lead.created', 'subscriber.created']);
  assert.ok(await wait(() => gcalls.filter((c) => c.url.includes('createContact')).length >= 2), 'both leads pushed to Google Contacts');
  const names = gcalls.filter((c) => c.url.includes('createContact')).map((c) => JSON.parse(c.opts.body).names[0].givenName).sort(); assert.deepEqual(names, ['Ayesha', 'Hamza']);
});

/* ------------------------------------------------- 8 follow-up (update) */
test('8. the member follows up leads: status, tags and notes are updated, filtered, searched and exported', async () => {
  const list = (await mc.get('/api/user/enquiries')).body; assert.equal(list.data.length, 2); assert.equal(list.counts.new, 2);
  const ayesha = list.data.find((e) => e.name === 'Ayesha Khan'); const hamza = list.data.find((e) => e.name === 'Hamza');
  assert.equal((await mc.patch(`/api/user/enquiries/${ayesha.id}`, { status: 'contacted', tags: ['team-order', 'hot'], notes: 'Called, wants a quote' })).status, 200);
  assert.equal((await mc.patch(`/api/user/enquiries/${ayesha.id}`, { status: 'won', notes: 'PO received' })).status, 200, 'update again');
  assert.equal((await mc.patch(`/api/user/enquiries/${hamza.id}`, { status: 'lost' })).status, 200);
  const won = (await mc.get('/api/user/enquiries?status=won')).body; assert.equal(won.data.length, 1); assert.equal(won.data[0].notes, 'PO received'); assert.deepEqual(won.data[0].tags, ['team-order', 'hot'], 'tags untouched by a later update');
  const counts = (await mc.get('/api/user/enquiries')).body.counts; assert.deepEqual([counts.new, counts.won, counts.lost], [0, 1, 1]);
  assert.equal((await mc.get('/api/user/enquiries?search=team-order')).body.data.length, 1); assert.equal((await mc.get('/api/user/enquiries?search=nothing-like-this')).body.data.length, 0);
  const csvOut = (await mc.get('/api/user/export/enquiries?format=csv')).text; assert.match(csvOut, /Ayesha Khan/); assert.match(csvOut, /won/); assert.match(csvOut, /PO received/); assert.match(csvOut, /team-order, hot/);
  // the lead's Google record was created once; "send existing" does not duplicate it
  assert.equal((await mc.post('/api/user/integrations/google/sync-all')).body.sent, 0);
});

/* --------------------------------------------------------- 9 analytics */
test('9. analytics shows the visits by channel and campaign, and the company view includes the member', async () => {
  const r = (await mc.get(`/api/user/analytics?days=7&tz=0&vcard=${card.id}`)).body.data;
  const ch = Object.fromEntries(r.channels.map((x) => [x.name, x.value]));
  assert.equal(ch['QR scan'], 1); assert.equal(ch['NFC / short link'], 1); assert.equal(ch['Campaign link'], 2); console.log('VIEWS', JSON.stringify((await M.VcardView.findAll({ where: { vcard_id: card.id }, raw: true })).map((v) => [v.via, v.utm_campaign, v.referrer])));
  assert.equal(ch['Direct / NFC / QR'], 2, 'two plain opens: the check in step 5 and the one in step 7');
  assert.deepEqual(r.campaigns.map((x) => [x.name, x.value]), [['eid-sale', 2]]); assert.equal(r.campaignSources[0].name, 'newsletter / email');
  assert.ok(r.kpis.views.value >= 5);
  const company = (await oc.get('/api/user/analytics/company?days=7&tz=0')).body; assert.ok(company.data.kpis.views.value >= 5, 'owner sees the member\'s views'); assert.equal(company.company.members.total, 3);
  const filtered = (await mc.get(`/api/user/analytics?days=7&tz=0&vcard=${card.id}&campaign=eid-sale`)).body.data; assert.equal(filtered.kpis.views.value, 2);
  // the member cannot open the company report
  assert.equal((await mc.get('/api/user/analytics/company')).status, 403);
});

/* ------------------------------------- 10 owner updates the design */
test('10. the owner changes the team design and applies it to every card; exports and signatures show the team', async () => {
  await oc.put('/api/user/organisation/brand', { template: 'scn-b', primary: '#7a1fa2' });
  assert.equal((await card.reload()).template_id, tplA.id, 'saving the design alone changes no card');
  const r = await oc.post('/api/user/organisation/brand/apply', { template: true, colours: true }); assert.equal(r.status, 200); assert.ok(r.body.updated >= 2);
  await card.reload(); assert.equal(card.template_id, tplB.id); assert.equal(card.theme.primary, '#7a1fa2'); assert.equal(card.job_title, 'Head of Sales', 'personal content untouched');
  assert.equal((await visit(`/${card.url_alias}`)).status, 200, 'card still renders with the new design');
  const team = (await oc.get('/api/user/organisation/members/export?format=csv')).text; assert.match(team, /sara@acme\.test/); assert.match(team, /Head of Sales/);
  const sigs = await oc.get('/api/user/organisation/members/signatures'); assert.equal(sigs.status, 200); assert.match(sigs.text, /sara@acme\.test/); assert.match(sigs.text, /#7a1fa2/); assert.ok(!/<script/i.test(sigs.text));
  const own = (await mc.get(`/api/user/vcards/${card.id}/signature?style=banner`)).body.html; assert.ok(own.includes('Save my contact') && own.includes('utm_campaign=signature'));
});

/* ----------------------------------------------- 11 lock / block / remove */
test('11. lock, unlock, block and remove a member', async () => {
  assert.equal((await oc.patch(`/api/user/organisation/members/${member.id}`, { org_status: 'locked' })).status, 200);
  assert.notEqual((await client(ctx.base).post('/api/auth/login', { email: member.email, password: PASS })).status, 200, 'locked member cannot sign in');
  assert.equal((await visit(`/${card.url_alias}`)).status, 200, 'a locked member\'s card stays online');
  await oc.patch(`/api/user/organisation/members/${member.id}`, { org_status: 'active' });
  assert.equal((await client(ctx.base).post('/api/auth/login', { email: member.email, password: PASS })).status, 200, 'unlocked');
  await oc.patch(`/api/user/organisation/members/${member.id}`, { org_status: 'blocked' });
  assert.notEqual((await visit(`/${card.url_alias}`)).status, 200, 'a blocked member\'s card is hidden');
  await oc.patch(`/api/user/organisation/members/${member.id}`, { org_status: 'active' });
  assert.equal((await oc.del(`/api/user/organisation/members/${member.id}`)).status, 200);
  assert.equal(await M.User.count({ where: { organisation_id: owner.id } }), 2, 'Omar and the one imported later remain');
  assert.equal(await M.User.findOne({ where: { id: member.id } }), null); assert.equal(await M.Vcard.findOne({ where: { id: card.id } }), null, 'their card is deleted with them');
  assert.equal((await visit(`/${card.url_alias}`)).status, 404);
  const seats = (await oc.get('/api/user/organisation')).body.seats; assert.equal(seats.used, 2); assert.equal(seats.limit - seats.used, 1, 'a seat is free again');
});

/* ------------------------------------------------------- 12 isolation */
test('12. another company sees none of it', async () => {
  await xc.post('/api/user/organisation/enable');
  assert.equal((await xc.get('/api/user/organisation/members')).body.data.length, 0);
  assert.equal((await xc.get('/api/user/enquiries')).body.data.length, 0); assert.equal((await xc.get('/api/user/webhooks')).body.data.length, 0);
  assert.equal((await xc.get('/api/user/integrations/google')).body.connected, false);
  const other = await M.User.findOne({ where: { email: 'omar@acme.test' } }); assert.ok(other);
  assert.equal((await xc.patch(`/api/user/organisation/members/${other.id}`, { org_status: 'blocked' })).status, 404, 'cannot touch another company\'s member');
  assert.equal((await xc.put('/api/user/organisation/brand', { template: 'scn-a' })).status, 200); // own company only
  assert.equal((await M.Vcard.findOne({ where: { user_id: other.id } })).template_id, tplB.id, 'their brand change did not reach Acme');
  await xc.post('/api/user/organisation/brand/apply', { template: true });
  assert.equal((await M.Vcard.findOne({ where: { user_id: other.id } })).template_id, tplB.id, 'applying it did not reach Acme either');
});
