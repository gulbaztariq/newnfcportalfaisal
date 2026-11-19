// Lighthouse on the production build, served by the API exactly like the live site (static dist, same security headers).
// usage: node lighthouse.js <baseUrl> [mobile|desktop|both]
const lighthouse = require('lighthouse').default || require('lighthouse');
const chromeLauncher = require('chrome-launcher');
const { chromium } = require('@playwright/test');
const fs = require('fs'); const path = require('path');
const base = process.argv[2] || 'http://localhost:5102'; const modes = process.argv[3] === 'mobile' ? ['mobile'] : process.argv[3] === 'desktop' ? ['desktop'] : ['mobile', 'desktop'];
const pages = JSON.parse(process.env.LH_PAGES || '["/","/shop","/blog","/directory","/login","/register","/checkout","/track"]');
const authedPages = { admin: ['/admin/dashboard', '/admin/orders', '/admin/products', '/admin/finance'], user: ['/user/dashboard', '/user/vcards', '/user/vcards/1/edit', '/user/analytics'] };
const WORK = path.join(__dirname, '.work'); const OUT = path.join(WORK, 'lighthouse'); fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const chrome = await chromeLauncher.launch({ chromePath: chromium.executablePath(), chromeFlags: ['--headless=new', '--no-sandbox'] });
  const rows = [];
  const run = async (label, url, mode, cookies) => {
    const flags = { port: chrome.port, output: 'json', logLevel: 'error', onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'], formFactor: mode, screenEmulation: mode === 'desktop' ? { mobile: false, width: 1350, height: 940, deviceScaleFactor: 1, disabled: false } : undefined, throttlingMethod: 'simulate', extraHeaders: cookies ? { Cookie: cookies } : undefined };
    const cfg = mode === 'desktop' ? { extends: 'lighthouse:default', settings: { formFactor: 'desktop', screenEmulation: flags.screenEmulation, throttling: { rttMs: 40, throughputKbps: 10240, cpuSlowdownMultiplier: 1 } } } : undefined;
    const r = await lighthouse(url, flags, cfg); const l = r.lhr; const a = l.audits;
    const score = (k) => Math.round((l.categories[k]?.score ?? 0) * 100);
    const row = { label, mode, perf: score('performance'), a11y: score('accessibility'), bp: score('best-practices'), seo: score('seo'), lcp: Math.round(a['largest-contentful-paint'].numericValue), cls: +a['cumulative-layout-shift'].numericValue.toFixed(3), tbt: Math.round(a['total-blocking-time'].numericValue), fcp: Math.round(a['first-contentful-paint'].numericValue), si: Math.round(a['speed-index'].numericValue),
      failed: Object.values(a).filter((x) => x.score !== null && x.score < 0.9 && x.scoreDisplayMode !== 'informative' && x.scoreDisplayMode !== 'notApplicable' && x.scoreDisplayMode !== 'manual').map((x) => `${x.id}(${Math.round(x.score * 100)})`) };
    rows.push(row); fs.writeFileSync(path.join(OUT, `${label.replace(/\W+/g, '_')}-${mode}.json`), JSON.stringify(l)); console.log(JSON.stringify({ ...row, failed: row.failed.slice(0, 8) }));
  };
  for (const mode of modes) for (const p of pages) await run(`public${p}`, base + p, mode);
  if (process.env.LH_PUBLIC_ONLY) { fs.writeFileSync(path.join(OUT, 'summary-live.json'), JSON.stringify(rows, null, 1)); await chrome.kill(); return; }
  for (const [role, ps] of Object.entries(authedPages)) {
    const st = JSON.parse(fs.readFileSync(path.join(WORK, `${role}.json`), 'utf8')); const cookie = st.cookies.map((c) => `${c.name}=${c.value}`).join('; ');
    for (const mode of modes) for (const p of ps) await run(`${role}${p}`, base + p, mode, cookie);
  }
  fs.writeFileSync(path.join(OUT, 'summary.json'), JSON.stringify(rows, null, 1)); await chrome.kill();
})().catch((e) => { console.error(e); process.exit(1); });
