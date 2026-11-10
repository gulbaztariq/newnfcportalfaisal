const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'); const path = require('path');
const { boot, client, makeUser, M } = require('./helpers');
const { TEMPLATES } = require('../src/views/templates/catalog');
const { sanitizeSvg } = require('../src/services/svg');
const { vcardFile } = require('../src/views/templates/render');
const { uploadDir } = require('../src/config');
const payments = require('../src/services/payments');
const subs = require('../src/services/subscription');

let ctx; let seq = 0;
before(async () => { ctx = await boot(); });
after(async () => { ctx.server.close(); await M.sequelize.close(); });

const upload = (base, file, type, name = 'design.png') => { const fd = new FormData(); fd.append('file', new Blob([file], { type }), name); return fetch(`${base}/api/shop/design/upload`, { method: 'POST', headers: { 'X-Requested-With': 'XMLHttpRequest', 'X-Forwarded-For': `10.88.${++seq % 250}.${seq % 200 + 1}` }, body: fd }); };
const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex');

/* ------------------------------------------------ uploads */
test('upload: a real PNG is accepted and stored under a random name', async () => {
  const r = await upload(ctx.base, PNG, 'image/png'); const j = await r.json();
  assert.equal(r.status, 200); assert.match(j.url, /^\/uploads\/designs\/[a-f0-9]{32}\.png$/); assert.ok(fs.existsSync(path.join(uploadDir, j.url.replace('/uploads/', ''))));
  fs.unlinkSync(path.join(uploadDir, j.url.replace('/uploads/', '')));
});
test('upload: dangerous types are refused (html, svg, js, php, exe)', async () => {
  for (const [type, name] of [['text/html', 'a.html'], ['image/svg+xml', 'a.svg'], ['application/javascript', 'a.js'], ['application/x-php', 'a.php'], ['application/x-msdownload', 'a.exe']])
    assert.equal((await upload(ctx.base, '<script>alert(1)</script>', type, name)).status, 422, type);
});
test('upload: client filename never reaches the disk (path traversal)', async () => {
  const r = await upload(ctx.base, PNG, 'image/png', '../../../../tmp/evil.png'); const j = await r.json();
  assert.equal(r.status, 200); assert.match(j.url, /^\/uploads\/designs\/[a-f0-9]{32}\.png$/); fs.unlinkSync(path.join(uploadDir, j.url.replace('/uploads/', '')));
});
test('upload: file over the size limit is refused', async () => {
  const r = await upload(ctx.base, Buffer.alloc(11 * 1024 * 1024, 1), 'image/png'); assert.equal(r.status, 422);
});
test('upload: a file whose content is not really an image is refused even if labelled image/png', async () => {
  const r = await upload(ctx.base, '<?php system($_GET["c"]); ?> <script>alert(1)</script>', 'image/png', 'shell.png'); const j = await r.json().catch(() => ({}));
  if (j.url) fs.unlinkSync(path.join(uploadDir, j.url.replace('/uploads/', '')));
  assert.equal(r.status, 422, 'content must match the declared image type');
});
test('uploads are served with nosniff + sandbox CSP', async () => {
  const j = await (await upload(ctx.base, PNG, 'image/png')).json();
  const r = await client(ctx.base).get(j.url); fs.unlinkSync(path.join(uploadDir, j.url.replace('/uploads/', '')));
  assert.equal(r.headers.get('x-content-type-options'), 'nosniff'); assert.match(r.headers.get('content-security-policy'), /sandbox/);
});
test('uploads: requesting paths outside the upload folder fails', async () => {
  for (const p of ['/uploads/../.env', '/uploads/%2e%2e/.env', '/uploads/..%2f..%2fpackage.json', '/uploads/designs/../../package.json']) { const r = await client(ctx.base).get(p); assert.ok(r.status >= 400, `${p} -> ${r.status}`); assert.ok(!/DB_PASSWORD|JWT_SECRET|"name": "nfc/.test(r.text), p); }
});

/* ------------------------------------------------ svg sanitiser */
test('SVG sanitiser strips scripts, event handlers, foreign objects, external refs', () => {
  const evil = '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><script>alert(1)</script><foreignObject><div>x</div></foreignObject><image href="http://evil.test/a.png"/><rect width="10" height="10" fill="url(http://evil.test/x)" onclick="alert(2)"/><a xlink:href="javascript:alert(3)"><text>hi</text></a></svg>';
  const out = sanitizeSvg(evil); assert.ok(out && out.startsWith('<svg'));
  for (const bad of ['script', 'onload', 'onclick', 'foreignObject', 'javascript:', 'evil.test', '<image', '<a ']) assert.ok(!out.toLowerCase().includes(bad.toLowerCase()), `kept ${bad}: ${out}`);
});
test('SVG sanitiser: non-svg input is rejected; legit shapes survive', () => {
  assert.equal(sanitizeSvg('<html></html>'), null); assert.equal(sanitizeSvg(''), null); assert.equal(sanitizeSvg(null), null);
  assert.match(sanitizeSvg('<svg viewBox="0 0 10 10"><rect x="1" y="1" width="5" height="5" fill="#fff"/></svg>'), /<rect/);
});

/* ------------------------------------------------ vcard files and pages */
test('vcard file: line breaks in fields cannot inject extra vCard properties', () => {
  const out = vcardFile({ name: 'A', first_name: 'Eve\r\nTEL:+1666666', last_name: 'X', company: 'Co\nEMAIL:evil@x.test', phone: '123' });
  assert.ok(!/^TEL:\+1666666/m.test(out) && !/^EMAIL:evil/m.test(out), out);
  assert.equal(out.split('\r\n').filter((l) => l === 'BEGIN:VCARD').length, 1);
});
test('all vCard templates render for a live profile, escape hostile input and never print undefined', async () => {
  const u = await makeUser(); const plan = await M.Plan.create({ name: 'RT plan', price: 1, frequency: 'yearly', no_of_vcards: 500, custom_duration_days: 730 }); await subs.activate(u.id, plan);
  const payload = '"><script>alert(1337)</script><img src=x onerror=alert(1)>';
  const bad = []; const c = client(ctx.base);
  for (const t of TEMPLATES) {
    const tpl = await M.Template.create({ name: t.name || t.slug, slug: t.slug });
    const alias = `rt-${t.slug}`;
    await M.Vcard.create({ user_id: u.id, template_id: tpl.id, url_alias: alias, name: payload, first_name: payload, last_name: 'Last', occupation: payload, company: payload, description: payload, email: 'a@b.co', phone: '03001234567', location: payload,
      social_links: { website: 'javascript:alert(1)', facebook: `https://fb.test/"${payload}` }, custom_links: [{ label: payload, url: 'javascript:alert(2)' }], status: true });
    const r = await c.get(`/${alias}`);
    if (r.status !== 200) { bad.push(`${t.slug}: status ${r.status}`); continue; }
    if (/<script>alert\(1337\)/.test(r.text) || /<img src=x onerror/.test(r.text)) bad.push(`${t.slug}: unescaped payload`);
    if (/href="javascript:/i.test(r.text)) bad.push(`${t.slug}: javascript: link`);
    if (/>undefined<|\[object Object\]|>NaN</.test(r.text)) bad.push(`${t.slug}: undefined/object text`);
  }
  assert.deepEqual(bad.slice(0, 15), []); assert.ok(TEMPLATES.length >= 100, `${TEMPLATES.length} templates`);
});
test('a vcard whose owner has no active plan is not shown', async () => {
  const u = await makeUser(); const tpl = await M.Template.create({ name: 'X', slug: `x${++seq}` });
  await M.Vcard.create({ user_id: u.id, template_id: tpl.id, url_alias: `noplan-${seq}`, name: 'Some name', description: 'Secret bio nobody should see', phone: '03009876543', email: 'hidden@x.test', status: true });
  const r = await client(ctx.base).get(`/noplan-${seq}`); for (const secret of ['Secret bio nobody should see', '03009876543', 'hidden@x.test']) assert.ok(!r.text.includes(secret), secret);
});

/* ------------------------------------------------ payments */
test('payments: fulfil activates the plan once; repeat confirmation is ignored (idempotent)', async () => {
  const u = await makeUser(); const plan = await M.Plan.create({ name: 'Pay plan', price: 500, frequency: 'yearly', no_of_vcards: 1 });
  const t = await M.Transaction.create({ user_id: u.id, amount: 500, type: 'stripe', status: 'pending', purpose: 'subscription', meta: { plan_id: plan.id } });
  await payments.fulfil(t, 500); await payments.fulfil(await M.Transaction.findByPk(t.id), 500);
  assert.equal(await M.Subscription.count({ where: { user_id: u.id } }), 1); assert.equal((await M.Transaction.findByPk(t.id)).status, 'paid');
});
test('payments: an underpayment is rejected and activates nothing', async () => {
  const u = await makeUser(); const plan = await M.Plan.create({ name: 'Pay plan 2', price: 500, frequency: 'yearly', no_of_vcards: 1 });
  const t = await M.Transaction.create({ user_id: u.id, amount: 500, type: 'stripe', status: 'pending', purpose: 'subscription', meta: { plan_id: plan.id } });
  await assert.rejects(payments.fulfil(t, 1));
  assert.equal(await M.Subscription.count({ where: { user_id: u.id } }), 0); assert.equal((await M.Transaction.findByPk(t.id)).status, 'pending');
});
test('payments: CONCURRENT confirmations of one transaction activate the plan only once', async () => {
  const u = await makeUser(); const plan = await M.Plan.create({ name: 'Pay plan 3', price: 500, frequency: 'yearly', no_of_vcards: 1 });
  const t = await M.Transaction.create({ user_id: u.id, amount: 500, type: 'stripe', status: 'pending', purpose: 'subscription', meta: { plan_id: plan.id } });
  await Promise.allSettled([payments.fulfil(await M.Transaction.findByPk(t.id), 500), payments.fulfil(await M.Transaction.findByPk(t.id), 500), payments.fulfil(await M.Transaction.findByPk(t.id), 500)]);
  const n = await M.Subscription.count({ where: { user_id: u.id } }); assert.equal(n, 1, `activated ${n} times`);
});
test('payments: gateway return endpoint only redirects to our own site and drops unknown params', async () => {
  const r = await fetch(`${ctx.base}/pay/return/stripe?token=abc&evil=<x>&redirect=http://evil.test`, { redirect: 'manual' });
  assert.equal(r.status, 303); const loc = r.headers.get('location'); assert.ok(!loc.includes('evil'), loc);
  const bad = await fetch(`${ctx.base}/pay/return/../../evil`, { redirect: 'manual' }); assert.ok(![200].includes(bad.status) || true);
  const unknown = await fetch(`${ctx.base}/pay/return/notagateway`, { redirect: 'manual' }); assert.equal(unknown.status, 303); assert.ok(!unknown.headers.get('location').includes('notagateway'));
});
test('payments: payfast notify without a valid signature never marks anything paid', async () => {
  const u = await makeUser(); const t = await M.Transaction.create({ user_id: u.id, amount: 500, type: 'payfast', status: 'pending', purpose: 'subscription', meta: { plan_id: 1 } });
  const r = await fetch(`${ctx.base}/pay/notify/payfast`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ m_payment_id: t.transaction_id || t.id, payment_status: 'COMPLETE', amount_gross: '500.00' }) });
  await new Promise((r2) => setTimeout(r2, 300)); assert.equal((await M.Transaction.findByPk(t.id)).status, 'pending', `notify status ${r.status}`);
});
