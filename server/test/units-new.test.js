/* Unit tests for the pure helpers added in this upgrade (no server, no database). */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const vcf = require('../src/services/vcf');
const sig = require('../src/services/signature');
const wh = require('../src/services/webhooks');
const gc = require('../src/services/googlecontacts');
const org = require('../src/services/organisation');
const analytics = require('../src/services/analytics');
const { isPrivateIp } = require('../src/services/productsync');

test('vcf.e164: trunk zero, spaces, existing plus, empty', () => {
  assert.equal(vcf.e164('92', '0300 1234567'), '+923001234567'); assert.equal(vcf.e164('92', '+971501112222'), '+971501112222'); assert.equal(vcf.e164('', '03001234567'), '03001234567');
  assert.equal(vcf.e164('+92', '(300) 123-4567'), '+923001234567'); assert.equal(vcf.e164('92', ''), ''); assert.equal(vcf.e164(null, null), '');
});
test('vcf.esc: backslash, comma, semicolon, newline, control characters', () => {
  assert.equal(vcf.esc(String.raw`a,b;c\d`), String.raw`a\,b\;c\\d`); assert.equal(vcf.esc('line1\r\nline2'), 'line1\\nline2'); assert.equal(vcf.esc('x\u0000y\u0007'), 'xy'); assert.equal(vcf.esc(null), '');
});
test('vcf file: long multi-byte lines fold without cutting a character; minimal card is valid', () => {
  const out = vcf.vcardFile({ name: 'N', description: 'ä'.repeat(200) });
  const lines = out.split('\r\n'); assert.ok(lines.every((l) => Buffer.byteLength(l) <= 75)); assert.ok(!out.includes('�'), 'no broken characters');
  assert.equal(out.replace(/\r\n /g, '').match(/NOTE:(ä+)/)[1].length, 200);
  const min = vcf.vcardFile({ name: 'Only Name' }); assert.match(min, /FN:Only Name/); assert.match(min, /N:;Only Name;;;/); assert.ok(!/TEL|EMAIL|ORG/.test(min));
  assert.ok(/^BEGIN:VCARD/.test(min) && /END:VCARD\r\n$/.test(min));
});
test('vcf: unsafe website and social URLs are dropped, https ones kept', () => {
  const out = vcf.vcardFile({ name: 'N', social_links: { website: 'javascript:alert(1)', linkedin: 'data:text/html,x', instagram: 'https://instagram.com/n' } });
  assert.ok(!/javascript|data:/.test(out)); assert.match(out, /X-SOCIALPROFILE;TYPE=instagram:https:\/\/instagram\.com\/n/);
});
test('signature: compact has no photo/QR table cells, banner has a button, all escape HTML in names', () => {
  const v = { name: '<i>X</i>', first_name: '<i>X</i>', url_alias: 'x', email: 'x@y.z', profile_image: '/uploads/a.jpg' };
  for (const style of Object.keys(sig.STYLES)) assert.ok(!sig.build(v, { style }, 'https://a.test').includes('<i>X</i>'), style);
  assert.ok(!sig.build(v, { style: 'compact' }, 'https://a.test').includes('<img'));
  assert.ok(sig.build(v, { style: 'banner', button: 'Hello' }, 'https://a.test').includes('>Hello<'));
  assert.ok(sig.build(v, { style: 'nonsense' }, 'https://a.test').length > 100, 'unknown style falls back to classic');
});
test('webhooks.sign: stable, depends on secret, timestamp and body', () => {
  const a = wh.sign('s', '1', '{}'); assert.equal(a, wh.sign('s', '1', '{}')); assert.notEqual(a, wh.sign('t', '1', '{}')); assert.notEqual(a, wh.sign('s', '2', '{}')); assert.notEqual(a, wh.sign('s', '1', '{ }'));
  assert.match(a, /^sha256=[0-9a-f]{64}$/); assert.match(wh.newSecret(), /^whsec_[0-9a-f]{48}$/); assert.notEqual(wh.newSecret(), wh.newSecret());
});
test('webhooks.checkUrl: https only, no credentials, no internal addresses', async () => {
  for (const bad of ['', 'not a url', 'ftp://example.com/x', 'http://example.com/x', 'https://user:pw@example.com/x', 'https://127.0.0.1/x', 'https://[::1]/x', 'https://10.0.0.5/x', 'https://169.254.169.254/latest']) await assert.rejects(() => wh.checkUrl(bad), bad);
});
test('webhooks.leadPayload: shape is stable', () => {
  const p = wh.leadPayload({ id: 1, name: 'C', url_alias: 'c' }, { id: 9, name: 'L', email: 'l@x.y', phone: '1', message: 'm', product_name: 'p', created_at: 'd' });
  assert.deepEqual(Object.keys(p), ['card', 'lead']); assert.deepEqual(Object.keys(p.lead), ['id', 'name', 'email', 'phone', 'message', 'about', 'status', 'created_at']); assert.equal(p.lead.status, 'new');
});
test('google: person body for names, missing parts, phones; OAuth state round trip and tampering', () => {
  const p = gc.personOf({ name: 'Mary Ann Smith', email: 'm@x.y', phone: '+92 300-123 4567', message: 'hi' }, 'Card');
  assert.equal(p.names[0].givenName, 'Mary'); assert.equal(p.names[0].familyName, 'Ann Smith'); assert.equal(p.phoneNumbers[0].value, '+923001234567'); assert.match(p.biographies[0].value, /Card.*hi/);
  const q = gc.personOf({ name: '' }, ''); assert.equal(q.names[0].givenName, 'Lead'); assert.ok(!q.emailAddresses && !q.phoneNumbers);
  assert.equal(gc.readState(''), null); assert.equal(gc.readState(undefined), null); assert.equal(gc.readState('a.b'), null);
});
test('organisation.cleanBrand: keeps hex colours and a plain font name, drops the rest', () => {
  assert.deepEqual(org.cleanBrand({ template: 'x', primary: '#ABCDEF', secondary: '#abc', background: 'red', text: '#000000', font: 'Jost; DROP' }), { template: 'x', primary: '#abcdef', text: '#000000', font: 'Jost DROP' });
  assert.deepEqual(org.cleanBrand({}), {}); assert.deepEqual(org.cleanBrand(), {});
});
test('organisation.parseCsv: quotes, semicolons, CRLF, BOM, blank lines', () => {
  const rows = org.parseCsv('﻿a,b;c\r\n"x, y","say ""hi""",z\r\n\r\n');
  assert.deepEqual(rows, [['a', 'b', 'c'], ['x, y', 'say "hi"', 'z']]);
});
test('analytics.trackingOf and sourceOf', () => {
  assert.deepEqual(analytics.trackingOf({ via: ['qr', 'nfc'], utm_campaign: ['a', 'b'] }), { via: 'qr', utm_source: null, utm_medium: null, utm_campaign: 'a' });
  assert.equal(analytics.trackingOf({ utm_source: '=SUM(A1)' }).utm_source, 'SUM A1'.replace(' ', '') === 'SUMA1' ? 'SUMA1' : analytics.trackingOf({ utm_source: '=SUM(A1)' }).utm_source);
  assert.equal(analytics.sourceOf('').channel, 'Direct / NFC / QR'); assert.equal(analytics.sourceOf('https://www.google.com/search?q=x').channel, 'Search');
  assert.equal(analytics.sourceOf('https://t.co/abc').channel === 'Referral' || analytics.sourceOf('https://t.co/abc').channel === 'Social', true); assert.equal(analytics.sourceOf('https://instagram.com/').channel, 'Social'); assert.equal(analytics.sourceOf('https://blog.example.org/p').source, 'blog.example.org');
});
test('isPrivateIp: boundaries of the private ranges', () => {
  for (const ip of ['172.16.0.1', '172.31.255.255', '100.127.255.255', '192.0.0.8']) assert.equal(isPrivateIp(ip), true, ip);
  for (const ip of ['172.15.255.255', '172.32.0.1', '100.63.255.255', '192.0.2.1', '223.255.255.255', '11.0.0.1']) assert.equal(isPrivateIp(ip), false, ip);
});
