/* Email signatures: email-safe HTML, escaping, campaign tags, ownership. */
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { boot, client, makeUser, M } = require('./helpers');
const sig = require('../src/services/signature');

let ctx; let u; let other; let card; let c; let oc;
before(async () => {
  ctx = await boot(); u = await makeUser({}); other = await makeUser({});
  const tpl = await M.Template.findOne() || await M.Template.create({ name: 'T', slug: 'sig-t', status: true });
  card = await M.Vcard.create({ user_id: u.id, template_id: tpl.id, url_alias: `sig-${Date.now()}`, name: 'Sig card', first_name: 'Ayesha', last_name: 'Khan <b>', job_title: 'Sales & Growth', company: 'Acme "Ltd"', email: 'a@acme.test', phone: '03001234567', region_code: '92', location: 'Lahore', status: true,
    social_links: { website: 'https://acme.test/', linkedin: 'https://linkedin.com/in/ayesha', facebook: 'javascript:alert(1)', whatsapp: 'https://wa.me/923001234567' }, theme: { primary: '#aa1122' } });
  c = client(ctx.base); oc = client(ctx.base);
  await c.post('/api/auth/login', { email: u.email, password: 'Passw0rd!x' }); await oc.post('/api/auth/login', { email: other.email, password: 'Passw0rd!x' });
});
after(async () => { ctx.server.close(); await M.sequelize.close(); });

test('every style is email-safe: no scripts, no SVG, no style/class blocks, tagged links, escaped text', () => {
  for (const style of Object.keys(sig.STYLES)) {
    const h = sig.build(card, { style, qr: true, button: 'Save <me>' }, 'https://app.test');
    assert.ok(!/<script|<svg|<style|class=|javascript:/i.test(h), style); assert.ok(h.includes('utm_campaign=signature'), `${style} tagged`);
    assert.ok(h.includes('Khan &lt;b&gt;') && h.includes('Sales &amp; Growth') && h.includes('Acme &quot;Ltd&quot;'), `${style} escaped`);
    assert.ok(h.includes('mailto:a@acme.test') && h.includes('tel:+923001234567'.replace('+923001234567', '+92')), `${style} contact links`);
    assert.ok(h.includes('#aa1122'), `${style} uses the card colour`);
    assert.ok(!h.includes('<me>'), 'button text escaped');
  }
  const b = sig.build(card, { style: 'banner' }, 'https://app.test'); assert.ok(b.includes('/contact.vcf'));
  assert.ok(sig.build(card, { qr: true }, 'https://app.test').includes('/qr.png')); assert.ok(!sig.build(card, { qr: false }, 'https://app.test').includes('/qr.png'));
  assert.ok(!sig.build(card, {}, 'https://app.test').includes('facebook'), 'unsafe link dropped');
});
test('options: colour must be a hex value, photo and social can be switched off, styled QR is skipped', () => {
  assert.ok(sig.build(card, { color: 'red;x' }, '').includes('#aa1122'));
  assert.ok(sig.build(card, { color: '#00ff00' }, '').includes('#00ff00'));
  const withPhoto = { ...card.toJSON(), profile_image: '/uploads/x.jpg' };
  assert.ok(sig.build(withPhoto, {}, 'https://a.test').includes('https://a.test/uploads/x.jpg')); assert.ok(!sig.build(withPhoto, { photo: false }, 'https://a.test').includes('<img'));
  assert.ok(!sig.build(card, { social: false }, '').includes('LinkedIn'));
  assert.ok(!sig.build({ ...card.toJSON(), qr_settings: { style: 'dots' } }, { qr: true }, '').includes('/qr.png'));
});
test('API: owner gets the signature, other accounts get 404', async () => {
  const r = await c.get(`/api/user/vcards/${card.id}/signature?style=modern&qr=1&color=%23112233`);
  assert.equal(r.status, 200); assert.ok(r.body.html.includes('#112233') && r.body.html.includes('Ayesha')); assert.ok(r.body.styles.classic);
  assert.equal((await oc.get(`/api/user/vcards/${card.id}/signature`)).status, 404);
  assert.equal((await client(ctx.base).get(`/api/user/vcards/${card.id}/signature`)).status, 401);
});
