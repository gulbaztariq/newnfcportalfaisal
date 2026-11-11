/* Signature template collection, the customisation schema and the editor preview route. */
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { boot, client, makeUser, M } = require('./helpers');
const { TEMPLATES, LAYOUTS, CATEGORIES, metaOf } = require('../src/views/templates/catalog');
const { render, cssFor, BASE_CSS } = require('../src/views/templates/render');
const signature = require('../src/views/templates/signature');
const custom = require('../src/views/templates/custom');
const subs = require('../src/services/subscription');

let ctx;
before(async () => { ctx = await boot(); });
after(async () => { ctx.server.close(); await M.sequelize.close(); });

const SIG = TEMPLATES.filter((t) => signature.ARCH[t.layout]);
const app = { app_name: 'Test', favicon: '/f.svg' };
const HOURS = Object.fromEntries(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map((d) => [d, { open: true, from: '09:00', to: '17:00' }]));
const FULL = {
  url_alias: 'alex', name: 'Alex Morgan', first_name: 'Alex', last_name: 'Morgan', occupation: 'Product Designer', company: 'Acme Studio', description: 'I design products. I also teach.',
  email: 'alex@example.com', phone: '5550100', region_code: '1', location: 'San Francisco, CA', is_verified: true, show_qr_code: true, enable_enquiry_form: true, profile_image: '/uploads/vcards/a.jpg', cover_image: '/uploads/vcards/c.jpg',
  social_links: { website: 'https://example.com', instagram: 'https://instagram.com/alex', linkedin: 'https://linkedin.com/in/alex', whatsapp: 'https://wa.me/15550100' },
  custom_links: [{ label: 'Portfolio', url: 'https://example.com/work' }], business_hours: HOURS, sections: {}, theme: {},
  appointment_settings: { enabled: true, slots: { mon: [{ from: '09:00', to: '10:00' }] } },
};
const extras = { services: [{ name: 'Brand identity', description: 'Logos and systems' }, { name: 'UI design' }], gallery: [{ image: '/uploads/g1.jpg', caption: 'One' }, { image: '/uploads/g2.jpg' }, { type: 'youtube', video_url: 'dQw4w9WgXcQ' }], testimonials: [{ name: 'Jamie', description: 'Great work' }] };
const page = (t, v, more = {}) => render({ v, template: t, ...more, app, appUrl: 'http://x.test', nonce: 'n' });
const bodyOf = (html) => html.split('</style>').pop().split('<script')[0];
const count = (html, re) => (html.match(re) || []).length;

/* ------------------------------------------------ collection */
test('signature collection: 30 designs, each with its own layout, name, category and description', () => {
  assert.equal(SIG.length, 30);
  assert.equal(new Set(SIG.map((t) => t.layout)).size, 30, 'every design has its own page structure');
  assert.equal(new Set(SIG.map((t) => t.name)).size, 30);
  for (const t of SIG) {
    const m = metaOf(t);
    assert.ok(CATEGORIES.includes(m.category), `${t.slug} category`);
    assert.ok(m.description.length > 20, `${t.slug} description`);
    assert.equal(m.collection, 'signature'); assert.ok(LAYOUTS.includes(t.layout));
    for (const k of ['primary', 'secondary', 'background', 'text']) assert.match(t.defaults[k], /^#[0-9a-f]{6}$/i, `${t.slug} ${k}`);
    assert.deepEqual(custom.sanitizeTheme({}, t.defaults), t.defaults, `${t.slug} defaults pass the schema unchanged`);
  }
});
test('the 140 earlier templates are still in the catalogue, unchanged in number and order', () => {
  assert.equal(TEMPLATES.length, 170);
  assert.deepEqual(TEMPLATES.slice(0, 140).map((t) => t.slug), Array.from({ length: 140 }, (_, i) => `vcard${i + 1}`));
  assert.ok(TEMPLATES.slice(0, 140).every((t) => !signature.ARCH[t.layout]));
  for (const t of TEMPLATES) assert.ok(CATEGORIES.includes(metaOf(t).category), t.slug);
});

/* ------------------------------------------------ rendering, one design at a time */
for (const t of SIG) {
  test(`${t.name} (${t.layout}): full profile shows the real data and working links`, () => {
    const html = page(t, FULL, extras); const body = bodyOf(html);
    assert.ok(html.includes(`l-${t.layout}`));
    assert.ok(body.includes('Morgan'), 'name'); assert.ok(body.includes('Product Designer'), 'role');
    assert.equal(count(html, /id="share"/g), 1, 'one share control'); assert.equal(count(html, /id="save"/g), 1, 'one save control');
    assert.ok(/href="\/alex\/contact\.vcf"/.test(html), 'save contact link');
    assert.ok(body.includes('href="tel:+15550100"'), 'phone link'); assert.ok(body.includes('href="mailto:alex@example.com"'), 'e-mail link');
    assert.ok(body.includes('https://wa.me/15550100'), 'whatsapp link'); assert.ok(body.includes('https://instagram.com/alex'), 'social link');
    assert.ok(body.includes('/uploads/vcards/a.jpg'), 'profile image'); assert.ok(body.includes('/alex/qr.png'), 'qr code');
    assert.ok(body.includes('id="enq"'), 'enquiry form'); assert.ok(body.includes('id="appt"'), 'appointments'); assert.ok(body.includes('Brand identity'), 'services');
    assert.ok(!/undefined|\[object Object\]|>NaN</.test(body), 'no undefined text');
  });
  test(`${t.name} (${t.layout}): empty profile, long content and hostile input are handled`, () => {
    const empty = page(t, { url_alias: 'e', name: 'Solo', sections: {}, theme: {} });
    assert.ok(!/undefined|\[object Object\]/.test(bodyOf(empty))); assert.equal(count(empty, /id="save"/g), 1); assert.equal(count(empty, /id="share"/g), 1);
    assert.ok(!bodyOf(empty).includes('href="tel:'), 'no phone link without a phone');
    const long = 'Bartholomew-Maximilian Featherstonehaugh-Cholmondeley '.repeat(3).trim();
    const x = '"><script>alert(1337)</script><img src=x onerror=alert(1)>';
    const html = page(t, { ...FULL, first_name: long, last_name: x, occupation: x, company: `${long} ${x}`, location: x, description: `${x} ${'word '.repeat(400)}`,
      social_links: { website: 'javascript:alert(1)', instagram: `https://ig.test/"${x}` }, custom_links: [{ label: x, url: 'javascript:alert(2)' }],
      theme: { primary: 'red;}body{display:none', heading: '</style><script>alert(9)</script>', font: "x'}*{color:red", bg_type: 'url(evil)', bg_image: 'javascript:alert(3)' } }, { services: [{ name: x, description: x }] });
    assert.ok(!/<script>alert\(1337\)/.test(html) && !/<img src=x onerror/.test(html), 'payload escaped');
    assert.ok(!/href="javascript:/i.test(html), 'no javascript: links');
    assert.ok(!html.includes('body{display:none') && !html.includes('*{color:red') && !html.includes('alert(9)') && !html.includes('url(evil)') && !html.includes('alert(3)'), 'theme cannot inject CSS or script');
    assert.ok(html.includes(long.slice(0, 40)), 'long name is shown');
  });
}
test('sections follow the owner order, hidden sections disappear and custom headings are used', () => {
  for (const t of SIG) {
    const html = bodyOf(page(t, { ...FULL, sections: { social: false, qr: false }, section_order: ['enquiry', 'about'], section_titles: { about: 'My story' } }, extras));
    assert.ok(!html.includes('/alex/qr.png') || t.layout === 'sxcard', `${t.layout} qr hidden`);
    assert.ok(!html.includes('s-social'), `${t.layout} social section hidden`);
    assert.ok(html.includes('My story') || t.layout === 'sxletter', `${t.layout} custom heading`);
    if (!['sxsheet', 'sxletter'].includes(t.layout)) assert.ok(html.indexOf('s-enquiry') < html.indexOf('s-about'), `${t.layout} order`);
  }
});

/* ------------------------------------------------ stylesheet */
test('each page only carries the styles of its own layout, and nothing is lost', () => {
  const opens = (s) => count(s, /\{/g); const closes = (s) => count(s, /\}/g);
  assert.equal(opens(BASE_CSS), closes(BASE_CSS));
  for (const l of LAYOUTS) {
    const css = cssFor(l); const own = new RegExp(`\\.l-${l}(?![\\w-])`, 'g');
    assert.equal(opens(css), closes(css), l);
    assert.equal(count(css, own), count(BASE_CSS, own), `${l} keeps all of its rules`);
    assert.ok(css.includes('.wrap{'), 'base rules'); assert.ok(css.includes('@keyframes vc-up'), 'keyframes');
    assert.ok(css.length < BASE_CSS.length / 3, `${l} is much smaller than the full sheet`);
  }
  assert.ok(!cssFor('sxcard').includes('.l-sxterm .x-win') && !cssFor('classic').includes('.l-sxcard .x-card') && cssFor('sxcard').includes('.l-sxcard .x-card'));
});
test('pages respect reduced motion and stay small', () => {
  for (const t of SIG) {
    const html = page(t, FULL, extras);
    assert.ok(html.includes('prefers-reduced-motion:reduce'), t.layout);
    assert.ok(html.length < 110 * 1024, `${t.layout} is ${Math.round(html.length / 1024)} KB`);
    assert.ok(!/<script[^>]+src=(?!"https:\/\/www\.googletagmanager)/.test(html), 'no third-party scripts');
  }
});

/* ------------------------------------------------ customisation schema */
test('theme schema: unknown keys are dropped, bad values ignored, empty values remove an option', () => {
  const saved = { primary: '#112233', font: "'Inter', system-ui, sans-serif", radius: 'soft' };
  const out = custom.sanitizeTheme({ primary: 'not-a-colour', secondary: '#ABCDEF', evil: 'x', __proto__: { a: 1 }, radius: '', button: '#ff0000', anim: 'explode', scale: 9, weight: '650', tracking: -1, hide_cover: '1', hide_save: 'nope', heading_font: 'Comic Sans', name_font: 'Lato', bg_image: '/etc/passwd' }, saved);
  assert.deepEqual(out, { primary: '#112233', secondary: '#abcdef', font: "'Inter', system-ui, sans-serif", button: '#ff0000', scale: 1.2, weight: 650, tracking: -0.04, hide_cover: true, name_font: "'Lato', system-ui, sans-serif" });
  assert.deepEqual(custom.sanitizeTheme('junk', saved), saved); assert.deepEqual(custom.sanitizeTheme(null, null), {});
  assert.deepEqual(custom.sanitizeTheme({ hide_cover: false, button: null }, { hide_cover: true, button: '#000000' }), {});
  for (const k of Object.keys(out)) assert.ok(custom.KEYS.includes(k));
});
test('theme options become classes and variables, on old and new templates alike', () => {
  const theme = { button: '#ff0000', button_text: '#ff0101', heading: '#00aa00', accent: '#0000ff', surface: '#fafafa', border: '#cccccc', icon: '#123456', bg_type: 'linear', bg2: '#eeeeee', bg_angle: 45,
    heading_font: "'Lato', system-ui, sans-serif", weight: 800, scale: 1.1, tracking: 0.05, leading: 1.7, align: 'start', spacing: 'airy', width: 'wide', btn_style: 'outline', social_style: 'brand', shadow: 'none', anim: 'fade', anim_speed: 'slow', reveal: 'off', hide_meta: true, avatar_shape: 'square' };
  for (const t of [TEMPLATES[0], TEMPLATES[100], SIG[0], SIG[17]]) {
    const html = page(t, { ...FULL, theme }, extras); const main = html.match(/<main class="([^"]+)"/)[1];
    for (const c of ['c-btn', 'c-hd', 'c-acc', 'c-sf', 'c-icn', 'c-bg-linear', 'c-hf', 'c-fw', 'c-fs', 'c-ls', 'c-lh', 'c-align-start', 'c-spacing-airy', 'c-width-wide', 'c-btnstyle-outline', 'c-socialstyle-brand', 'c-shadow-none', 'c-anim-fade', 'c-animspeed-slow', 'c-reveal-off', 'c-hide-meta'])
      assert.ok(main.split(' ').includes(c), `${t.slug} ${c}`);
    assert.equal(main.includes('c-avs-square'), !custom.AVATAR_FIXED.has(t.layout), 'avatar shape only where the design allows it');
    assert.ok(html.includes('--btn:#ff0000') && html.includes('--bga:45deg') && html.includes('family=Lato'));
    assert.ok(html.includes('--onbtn:#ffffff'), 'unreadable button text is replaced by a readable colour');
  }
  const plain = page(TEMPLATES[0], FULL).match(/<main class="([^"]+)"/)[1];
  assert.ok(!/\bc-/.test(plain), 'a card without custom options gets no modifier classes');
});

/* ------------------------------------------------ over HTTP: save, preview, gallery data */
async function owner(templates) {
  const u = await makeUser(); const plan = await M.Plan.create({ name: `Tpl plan ${Math.random()}`, price: 1, frequency: 'yearly', no_of_vcards: 10, custom_duration_days: 365 });
  await plan.setTemplates(templates); await subs.activate(u.id, plan);
  const c = client(ctx.base); const r = await c.post('/api/auth/login', { email: u.email, password: 'Passw0rd!x' }); assert.equal(r.status, 200);
  return { u, c };
}
const draft = (d) => Buffer.from(JSON.stringify(d)).toString('base64url');

test('editor: templates list carries gallery data; theme saves, updates and resets; switching template keeps content', async () => {
  const a = await M.Template.create({ name: 'Obsidian Luxury', slug: 'vcard141', defaults: SIG[0].defaults });
  const b = await M.Template.create({ name: 'Classic', slug: 'vcard1', defaults: TEMPLATES[0].defaults });
  const locked = await M.Template.create({ name: 'Neon Future', slug: 'vcard146', defaults: {} });
  const { u, c } = await owner([a, b]);
  const list = await c.get('/api/user/vcards/templates'); assert.equal(list.status, 200);
  const row = list.body.data.find((t) => t.slug === 'vcard141');
  assert.equal(row.category, 'Luxury'); assert.equal(row.collection, 'signature'); assert.equal(row.allowed, true); assert.equal(row.avatar_fixed, true); assert.ok(row.description);
  assert.equal(list.body.data.find((t) => t.slug === 'vcard146').allowed, false);
  assert.deepEqual(list.body.categories, CATEGORIES); assert.ok(list.body.schema.keys.includes('button') && list.body.schema.fonts.includes('Lato'));

  const v = await M.Vcard.create({ user_id: u.id, template_id: b.id, url_alias: 'edit-me', name: 'Edit me', description: 'Keep this text', phone: '03001234567', theme: { primary: '#111111' }, status: true });
  let r = await c.put(`/api/user/vcards/${v.id}`, { theme: { primary: '#222222', button: '#ff0000', anim: 'zoom', evil: '}x{', scale: 1.1 } }); assert.equal(r.status, 200);
  assert.deepEqual((await v.reload()).theme, { primary: '#222222', button: '#ff0000', anim: 'zoom', scale: 1.1 });
  r = await c.put(`/api/user/vcards/${v.id}`, { theme: { button: '', anim: 'nope' } }); assert.equal(r.status, 200);
  assert.deepEqual((await v.reload()).theme, { primary: '#222222', anim: 'zoom', scale: 1.1 }, 'empty removes, invalid keeps the saved value');
  r = await c.put(`/api/user/vcards/${v.id}`, { template_id: a.id, theme: Object.fromEntries(custom.KEYS.map((k) => [k, ''])) }); assert.equal(r.status, 200);
  await v.reload(); assert.equal(v.template_id, a.id); assert.deepEqual(v.theme, {}); assert.equal(v.description, 'Keep this text'); assert.equal(v.url_alias, 'edit-me');
  r = await c.put(`/api/user/vcards/${v.id}`, { template_id: locked.id }); assert.equal(r.status, 422, 'a template outside the plan is refused');
  const pub = await client(ctx.base).get('/edit-me'); assert.equal(pub.status, 200); assert.ok(pub.text.includes('l-sxcard') && pub.text.includes('Keep this text'));
});
test('preview: shows an unsaved design on the real card without storing anything or counting a view', async () => {
  const a = await M.Template.create({ name: 'Material Motion', slug: 'vcard143', defaults: SIG[2].defaults });
  const b = await M.Template.create({ name: 'Minimal', slug: 'vcard12', defaults: TEMPLATES[11].defaults });
  const other = await M.Template.create({ name: 'Not in plan', slug: 'vcard145', defaults: {} });
  const { u, c } = await owner([a, b]);
  const v = await M.Vcard.create({ user_id: u.id, template_id: b.id, url_alias: 'pv-card', name: 'Preview Person', description: 'Hello from the saved card', theme: { primary: '#111111' }, status: false });
  let r = await c.get(`/api/user/vcards/${v.id}/preview`); assert.equal(r.status, 200); assert.match(r.headers.get('content-type'), /text\/html/);
  assert.ok(r.text.includes('Preview Person') && r.text.includes('l-minimal')); assert.equal(r.headers.get('cache-control'), 'no-store'); assert.equal(r.headers.get('x-robots-tag'), 'noindex');
  assert.match(r.headers.get('content-security-policy'), /frame-ancestors 'self'/);
  r = await c.get(`/api/user/vcards/${v.id}/preview?d=${draft({ template_id: a.id, theme: { primary: '#abcdef', btn_style: 'outline', evil: '}body{' }, sections: { about: false }, still: true })}`);
  assert.equal(r.status, 200); assert.ok(r.text.includes('l-sxbento') && r.text.includes('--p:#abcdef') && r.text.includes('c-btnstyle-outline') && r.text.includes('pv-still'));
  assert.ok(!bodyOf(r.text).includes('Hello from the saved card'), 'hidden section'); assert.ok(!r.text.includes('}body{'));
  r = await c.get(`/api/user/vcards/${v.id}/preview?d=${draft({ template_id: other.id })}`); assert.ok(r.text.includes('l-minimal'), 'a template outside the plan is not previewed');
  for (const junk of ['%%%', draft('text'), draft([1]), 'x'.repeat(13000)]) assert.equal((await c.get(`/api/user/vcards/${v.id}/preview?d=${junk}`)).status, 200);
  await v.reload(); assert.equal(v.template_id, b.id); assert.deepEqual(v.theme, { primary: '#111111' }); assert.equal(v.views || 0, 0);
  assert.equal(await M.VcardView.count({ where: { vcard_id: v.id } }), 0);
  assert.equal((await client(ctx.base).get(`/api/user/vcards/${v.id}/preview`)).status, 401, 'signed-out visitors are refused');
  const stranger = await owner([a]); assert.equal((await stranger.c.get(`/api/user/vcards/${v.id}/preview`)).status, 404, "another user's card is not found");
});
