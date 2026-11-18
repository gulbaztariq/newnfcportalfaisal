const { test, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;
const fs = require('fs'); const path = require('path');
const { admin, user, publicRoutes, auth, VIEWPORTS } = require('./routes');

const WORK = path.join(__dirname, '..', '.work'); const SHOTS = path.join(WORK, 'shots'); fs.mkdirSync(SHOTS, { recursive: true });
const FINDINGS = path.join(WORK, 'findings.jsonl');
const record = (f) => fs.appendFileSync(FINDINGS, `${JSON.stringify(f)}\n`);
const settle = (page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));

/** everything we look at on one page at one viewport */
async function inspect(page, vw, vh) {
  return page.evaluate(([vw]) => {
    const out = { overflow: 0, offenders: [], tiny: [], brokenImgs: [], h1: document.querySelectorAll('h1').length, title: document.title };
    out.overflow = document.documentElement.scrollWidth - document.documentElement.clientWidth;
    const inScroller = (e) => { for (let n = e.parentElement; n && n !== document.body; n = n.parentElement) { const o = getComputedStyle(n).overflowX; if ((o === 'auto' || o === 'scroll' || o === 'hidden' || o === 'clip') && n.scrollWidth <= n.clientWidth + 1) return true; if (o === 'auto' || o === 'scroll') return true; } return false; };
    if (out.overflow > 1) {
      out.offenders = [...document.querySelectorAll('body *')].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.right > vw + 1 && getComputedStyle(e).position !== 'fixed' && !inScroller(e); })
        .slice(0, 4).map((e) => `${e.tagName.toLowerCase()}.${String(e.className).split(' ').slice(0, 4).join('.')}`.slice(0, 90));
    }
    out.tiny = [...document.querySelectorAll('button,a[href],[role=button],[role=switch],input:not([type=hidden]),select')].filter((e) => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.opacity !== '0' && (r.height < 24 || r.width < 24) && !(e.tagName === 'A' && e.closest('p,li,span') && e.textContent.trim().length > 0 && e.parentElement.textContent.trim().length > e.textContent.trim().length); })
      .slice(0, 5).map((e) => `${e.tagName.toLowerCase()} ${Math.round(e.getBoundingClientRect().width)}x${Math.round(e.getBoundingClientRect().height)} "${(e.getAttribute('aria-label') || e.textContent || e.type || '').trim().slice(0, 20)}"`);
    out.brokenImgs = [...document.images].filter((i) => i.complete && i.naturalWidth === 0 && i.src && getComputedStyle(i).display !== 'none').slice(0, 3).map((i) => i.src.slice(-60));
    return out;
  }, [vw]);
}

function suite(role, routes, storage) {
  test.describe(role, () => {
    if (storage) test.use({ storageState: storage });
    for (const route of routes) {
      test(`${role} ${route}`, async ({ page }, info) => {
        const errors = []; const bad = [];
        page.on('pageerror', (e) => errors.push(`pageerror: ${e.message.slice(0, 160)}`));
        page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text().slice(0, 160)}`); });
        page.on('response', (r) => { const u = r.url(); if (r.status() >= 400 && !/favicon|\/api\/auth\/me|hot-update/.test(u)) bad.push(`${r.status()} ${u.replace(/^https?:\/\/[^/]+/, '').slice(0, 90)}`); });
        page.on('requestfailed', (r) => { if (!/net::ERR_ABORTED/.test(r.failure()?.errorText || '')) bad.push(`FAILED ${r.url().slice(0, 90)}`); });
        await page.setViewportSize({ width: 1280, height: 720 });
        await page.goto(route, { waitUntil: 'domcontentloaded' });
        await page.waitForLoadState('networkidle').catch(() => {});
        await page.locator('h1').first().waitFor({ state: 'visible', timeout: 15_000 }).catch(() => {}); // pages with no h1 are reported below
        const add = (sev, vw, kind, detail) => record({ role, route, vw, sev, kind, detail });

        for (const [w, h] of VIEWPORTS) {
          await page.setViewportSize({ width: w, height: h }); await settle(page);
          const r = await inspect(page, w, h);
          if (r.overflow > 1) { add('high', w, 'horizontal-overflow', `${r.overflow}px: ${r.offenders.join(' | ')}`); await page.screenshot({ path: path.join(SHOTS, `${role}${route.replace(/\W+/g, '_')}-${w}.png`) }).catch(() => {}); }
          if (r.brokenImgs.length) add('high', w, 'broken-image', r.brokenImgs.join(', '));
          if (w <= 480 && r.tiny.length) add('low', w, 'tiny-touch-target', r.tiny.join(' ; '));
        }
        await page.setViewportSize({ width: 1280, height: 720 }); await settle(page);
        const r = await inspect(page, 1280, 720);
        if (r.h1 !== 1 && !route.includes('does-not-exist')) add('medium', 1280, 'h1-count', `${r.h1} h1 elements`);
        if (!r.title.trim()) add('medium', 1280, 'empty-title', 'document.title is empty');
        for (const e of [...new Set(errors)]) if (!(route === '/user/company-analytics' && /403/.test(e))) add('high', 1280, 'console-error', e);
        // expected: the company analytics API answers 403 to an account that has no company (the page shows that message)
        for (const b of [...new Set(bad)]) if (!/fonts\.(googleapis|gstatic)\.com/.test(b) && !route.includes('does-not-exist') && !(route === '/user/company-analytics' && b.startsWith('403'))) add('high', 1280, 'bad-request', b);

        // accessibility (WCAG 2.2 AA): wait for the page-enter fade to finish, so contrast is measured on the settled page
        await page.waitForFunction(() => { const m = document.querySelector('main > div'); return !m || getComputedStyle(m).opacity === '1'; }).catch(() => {});
        await page.waitForFunction(() => document.getAnimations().length === 0, null, { timeout: 3000 }).catch(() => {});
        const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze().catch(() => ({ violations: [] }));
        for (const v of axe.violations) add(v.impact === 'critical' || v.impact === 'serious' ? 'medium' : 'low', 1280, `axe:${v.id}`, `${v.impact}: ${v.help} (${v.nodes.length}) e.g. ${v.nodes[0]?.target?.join(' ').slice(0, 80)}`);

        // keyboard: the first stops of Tab must show a visible focus indicator
        await page.keyboard.press('Tab');
        let noFocus = 0;
        for (let i = 0; i < 10; i++) {
          const vis = await page.evaluate(() => { const e = document.activeElement; if (!e || e === document.body) return 'none'; const s = getComputedStyle(e); return (s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0) || s.boxShadow !== 'none' || e.matches(':focus-visible') ? 'ok' : 'hidden'; });
          if (vis === 'hidden') noFocus += 1; await page.keyboard.press('Tab');
        }
        if (noFocus > 3) add('medium', 1280, 'focus-indicator', `${noFocus} of 10 tab stops had no visible focus style`);
        const real = errors.filter((e) => !(route === '/user/company-analytics' && /403/.test(e)) && !(/fonts\.(googleapis|gstatic)/.test(e) && /ERR_(SOCKET|INTERNET|NAME|CONNECTION)|net::/.test(e)));
        expect.soft(real.length, `console errors: ${real.join(' | ')}`).toBe(0);
      });
    }
  });
}

suite('admin', admin, path.join(WORK, 'admin.json'));
suite('user', user, path.join(WORK, 'user.json'));
suite('public', publicRoutes, undefined);
suite('auth', auth, undefined);

// cross-browser smoke (Firefox and WebKit run only these)
for (const route of ['/', '/shop', '/login', '/blog', '/directory']) {
  test(`@cross ${route} renders at phone, tablet and desktop`, async ({ page, browserName }) => {
    const errors = []; page.on('pageerror', (e) => errors.push(e.message));
    for (const [w, h] of [[375, 667], [820, 1180], [1440, 900]]) {
      await page.setViewportSize({ width: w, height: h }); await page.goto(route); await page.waitForLoadState('networkidle').catch(() => {}); await settle(page);
      const r = await inspect(page, w, h);
      if (r.overflow > 1) record({ role: browserName, route, vw: w, sev: 'high', kind: 'horizontal-overflow', detail: `${r.overflow}px ${r.offenders.join(' | ')}` });
    }
    if (errors.length) record({ role: browserName, route, vw: 0, sev: 'high', kind: 'console-error', detail: errors[0].slice(0, 160) });
    expect(errors, errors.join(' | ')).toEqual([]);
  });
}
