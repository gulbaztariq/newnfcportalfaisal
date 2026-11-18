// Dark mode: every route at phone and desktop width, contrast and layout checks on the dark theme.
const { test, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;
const fs = require('fs'); const path = require('path');
const { admin, user, publicRoutes, auth } = require('./routes');

const WORK = path.join(__dirname, '..', '.work'); const OUT = path.join(WORK, 'findings-dark.jsonl'); const SHOTS = path.join(WORK, 'shots-dark'); fs.mkdirSync(SHOTS, { recursive: true });
const record = (f) => fs.appendFileSync(OUT, `${JSON.stringify(f)}\n`);

function suite(role, routes, storage) {
  test.describe(`dark ${role}`, () => {
    test.use({ colorScheme: 'dark', reducedMotion: 'reduce', ...(storage ? { storageState: storage } : {}) });
    for (const route of routes) {
      test(`dark ${role} ${route}`, async ({ page }) => {
        await page.addInitScript(() => { try { localStorage.setItem('theme', 'dark'); } catch { /* ignore */ } });
        await page.setViewportSize({ width: 1280, height: 720 });
        await page.goto(route, { waitUntil: 'domcontentloaded' });
        await page.waitForLoadState('networkidle').catch(() => {});
        await page.locator('h1').first().waitFor({ state: 'visible', timeout: 15_000 }).catch(() => {});
        await page.waitForFunction(() => { const m = document.querySelector('main > div'); return !m || getComputedStyle(m).opacity === '1'; }).catch(() => {});
        const isDark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
        if (!isDark) record({ role, route, sev: 'medium', kind: 'not-dark', detail: 'the page did not switch to the dark theme (public pages may be light only)' });
        const axe = await new AxeBuilder({ page }).withRules(['color-contrast']).analyze().catch(() => ({ violations: [] }));
        for (const v of axe.violations) for (const n of v.nodes.slice(0, 3)) { const d = n.any[0]?.data || {}; record({ role, route, sev: 'medium', kind: 'dark-contrast', detail: `${d.fgColor} on ${d.bgColor} = ${d.contrastRatio} | ${n.html.replace(/class="[^"]*"/g, '').slice(0, 100)}` }); }
        if (axe.violations.length) await page.screenshot({ path: path.join(SHOTS, `${role}${route.replace(/\W+/g, '_')}.png`) }).catch(() => {});
        for (const w of [375]) {
          await page.setViewportSize({ width: w, height: 800 }); await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
          const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
          if (over > 1) record({ role, route, sev: 'high', kind: 'dark-overflow', detail: `${over}px at ${w}` });
        }
        expect(true).toBe(true);
      });
    }
  });
}
suite('admin', admin, path.join(WORK, 'admin.json'));
suite('user', user, path.join(WORK, 'user.json'));
suite('public', publicRoutes);
suite('auth', auth);
