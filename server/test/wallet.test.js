/* Wallet passes: Apple .pkpass (signed with throwaway test certificates) and Google Wallet save link (signed with a throwaway key). */
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'); const os = require('os'); const path = require('path'); const crypto = require('crypto');
const { spawnSync } = require('child_process');
const JSZip = require('jszip'); const jwt = require('jsonwebtoken');
const { boot, client, makeUser, M, settings } = require('./helpers');
const wallet = require('../src/services/wallet');

let ctx; let card; let certs; let google;
const sh = (args, cwd) => { const r = spawnSync('openssl', args, { cwd, encoding: 'utf8' }); assert.equal(r.status, 0, r.stderr); };
before(async () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'wallet-test-'));
  sh(['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', 'ca.key', '-out', 'ca.pem', '-subj', '/CN=Test WWDR', '-days', '2'], d);
  sh(['req', '-newkey', 'rsa:2048', '-nodes', '-keyout', 's.key', '-out', 's.csr', '-subj', '/CN=Pass Type ID: pass.test.card/UID=TEAM123456'], d);
  sh(['x509', '-req', '-in', 's.csr', '-CA', 'ca.pem', '-CAkey', 'ca.key', '-CAcreateserial', '-out', 's.pem', '-days', '2'], d);
  certs = { wwdr: fs.readFileSync(path.join(d, 'ca.pem'), 'utf8'), cert: fs.readFileSync(path.join(d, 's.pem'), 'utf8'), key: fs.readFileSync(path.join(d, 's.key'), 'utf8') }; fs.rmSync(d, { recursive: true, force: true });
  google = crypto.generateKeyPairSync('rsa', { modulusLength: 2048, publicKeyEncoding: { type: 'spki', format: 'pem' }, privateKeyEncoding: { type: 'pkcs8', format: 'pem' } });
  ctx = await boot();
  const u = await makeUser({}); const plan = await M.Plan.create({ name: 'W plan', price: 1, frequency: 'yearly', no_of_vcards: 5, custom_duration_days: 365 }); await require('../src/services/subscription').activate(u.id, plan);
  const tpl = await M.Template.findOne() || await M.Template.create({ name: 'T', slug: 'w-t', status: true });
  card = await M.Vcard.create({ user_id: u.id, template_id: tpl.id, url_alias: `wal-${Date.now()}`, name: 'Wallet card', first_name: 'Sara', last_name: 'Malik', job_title: 'Head of Sales', company: 'Acme Traders', email: 'sara@acme.test', phone: '3001234567', region_code: '92', location: 'Lahore', status: true, show_qr_code: true, theme: { primary: '#0a7d4b' }, social_links: { website: 'https://acme.test' } });
});
after(async () => { ctx.server.close(); await M.sequelize.close(); });
const get = (p) => client(ctx.base).get(p);
const appleOn = (over = {}) => settings.set({ apple_wallet_enable: '1', apple_pass_type_id: 'pass.test.card', apple_team_id: 'TEAM123456', apple_wallet_cert: certs.cert, apple_wallet_key: certs.key, apple_wwdr_cert: certs.wwdr, ...over });
const googleOn = (over = {}) => settings.set({ google_wallet_enable: '1', google_wallet_issuer_id: '3388000000012345678', google_wallet_sa_email: 'wallet@proj.iam.gserviceaccount.com', google_wallet_sa_key: google.privateKey, ...over });

test('nothing is offered until the credentials are set: routes 404 and the card shows no wallet buttons', async () => {
  assert.deepEqual(wallet.ready(await settings.all()), { apple: false, google: false });
  assert.equal((await get(`/${card.url_alias}/wallet.pkpass`)).status, 404); assert.equal((await get(`/${card.url_alias}/wallet-google`)).status, 404);
  const html = (await get(`/${card.url_alias}`)).text; assert.ok(!html.includes('wallet.pkpass') && !html.includes('wallet-google'));
});
test('a missing field keeps a wallet switched off even when "enabled" is on', async () => {
  await appleOn({ apple_team_id: '' }); await googleOn({ google_wallet_sa_key: '' });
  assert.deepEqual(wallet.ready(await settings.all()), { apple: false, google: false });
  await settings.set({ apple_wallet_enable: '0', google_wallet_enable: '0' });
});
test('Apple: the pass is a signed .pkpass with the card details, a QR code and matching file hashes', async () => {
  await appleOn(); assert.equal(wallet.ready(await settings.all()).apple, true);
  const r = await fetch(`${ctx.base}/${card.url_alias}/wallet.pkpass`, { headers: { 'X-Forwarded-For': '10.99.1.1' } });
  assert.equal(r.status, 200, await r.clone().text()); assert.equal(r.headers.get('content-type'), 'application/vnd.apple.pkpass'); assert.match(r.headers.get('content-disposition'), /\.pkpass/);
  const zip = await JSZip.loadAsync(Buffer.from(await r.arrayBuffer())); const names = Object.keys(zip.files);
  for (const f of ['pass.json', 'manifest.json', 'signature', 'icon.png', 'icon@2x.png']) assert.ok(names.includes(f), `${f} in ${names}`);
  const pass = JSON.parse(await zip.file('pass.json').async('string'));
  assert.equal(pass.passTypeIdentifier, 'pass.test.card'); assert.equal(pass.teamIdentifier, 'TEAM123456'); assert.equal(pass.serialNumber, `card-${card.id}`); assert.equal(pass.organizationName, 'Acme Traders');
  assert.equal(pass.generic.primaryFields[0].value, 'Sara Malik'); assert.equal(pass.generic.primaryFields[0].label, 'Head of Sales');
  assert.ok(pass.generic.auxiliaryFields.some((f) => f.value === '+92 3001234567') && pass.generic.auxiliaryFields.some((f) => f.value === 'sara@acme.test'));
  const code = (pass.barcodes || [pass.barcode])[0]; assert.equal(code.format, 'PKBarcodeFormatQR'); assert.match(code.message, new RegExp(`/${card.url_alias}\\?via=qr$`));
  assert.equal(pass.backgroundColor, 'rgb(10,125,75)');
  const manifest = JSON.parse(await zip.file('manifest.json').async('string'));
  for (const [file, sha] of Object.entries(manifest)) assert.equal(crypto.createHash('sha1').update(await zip.file(file).async('nodebuffer')).digest('hex'), sha, `hash of ${file}`);
  const sig = await zip.file('signature').async('nodebuffer'); assert.ok(sig.length > 500 && sig[0] === 0x30, 'a DER PKCS#7 signature');
  const png = await zip.file('icon.png').async('nodebuffer'); assert.equal(png.slice(1, 4).toString(), 'PNG'); assert.equal(png.readUInt32BE(16), 58);
});
test('Apple: the page shows the button; other cards and unknown cards behave', async () => {
  assert.ok((await get(`/${card.url_alias}`)).text.includes(`/${card.url_alias}/wallet.pkpass`));
  assert.equal((await get('/no-such-card-here/wallet.pkpass')).status, 404);
  await settings.set({ apple_wallet_key: 'not a key' });
  const bad = await fetch(`${ctx.base}/${card.url_alias}/wallet.pkpass`, { headers: { 'X-Forwarded-For': '10.99.1.2' } }); assert.equal(bad.status, 502, 'a broken certificate gives a clear error, not a crash');
  await appleOn();
});
test('Google: the save link is a valid RS256 token for the issuer, with the card inside', async () => {
  await googleOn(); assert.equal(wallet.ready(await settings.all()).google, true);
  const r = await get(`/${card.url_alias}/wallet-google`); assert.equal(r.status, 302);
  const loc = r.headers.get('location'); assert.match(loc, /^https:\/\/pay\.google\.com\/gp\/v\/save\//);
  const token = loc.split('/save/')[1]; const p = jwt.verify(token, google.publicKey, { algorithms: ['RS256'] });
  assert.equal(p.iss, 'wallet@proj.iam.gserviceaccount.com'); assert.equal(p.aud, 'google'); assert.equal(p.typ, 'savetowallet'); assert.ok(Array.isArray(p.origins));
  const obj = p.payload.genericObjects[0]; assert.equal(obj.id, `3388000000012345678.card-${card.id}`); assert.equal(obj.classId, '3388000000012345678.nfcprofile_card'); assert.equal(p.payload.genericClasses[0].id, obj.classId);
  assert.equal(obj.header.defaultValue.value, 'Sara Malik'); assert.equal(obj.cardTitle.defaultValue.value, 'Acme Traders'); assert.equal(obj.hexBackgroundColor, '#0a7d4b'); assert.equal(obj.barcode.type, 'QR_CODE');
  assert.ok(obj.textModulesData.some((m) => m.body === '+92 3001234567')); assert.equal(obj.linksModuleData.uris[0].uri, `${require('../src/config').appUrl}/${card.url_alias}`);
  assert.ok((await get(`/${card.url_alias}`)).text.includes(`/${card.url_alias}/wallet-google`), 'button on the card');
});
test('Google: a key pasted with literal \\n sequences (as in a service-account JSON file) still works', async () => {
  await googleOn({ google_wallet_sa_key: google.privateKey.replace(/\n/g, '\\n') });
  const r = await get(`/${card.url_alias}/wallet-google`); assert.equal(r.status, 302); jwt.verify(r.headers.get('location').split('/save/')[1], google.publicKey, { algorithms: ['RS256'] });
});
test('private keys are hidden in the admin settings view', async () => {
  const view = await settings.adminSettings(); for (const k of ['apple_wallet_key', 'apple_wallet_key_pass', 'google_wallet_sa_key']) assert.ok(!String(view[k] || '').includes('PRIVATE KEY'), k);
  assert.ok(!JSON.stringify(await settings.publicSettings()).includes('PRIVATE KEY'));
});
