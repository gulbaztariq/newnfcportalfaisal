// End-to-end sweep: every route at every viewport, plus accessibility, console and network checks.
// Starts its own throwaway API (sqlite) and the Vite client, so it never touches the live database.
const { defineConfig, devices } = require('@playwright/test');
const path = require('path');

const NODE = process.env.NODE_BIN || process.execPath;
const ROOT = path.resolve(__dirname, '..');
const DB = process.env.E2E_DB || path.join(__dirname, '.work', 'e2e.sqlite');
const API_PORT = 5102; const WEB_PORT = 5174;

module.exports = defineConfig({
  testDir: './tests',
  outputDir: './.work/artifacts',
  timeout: 60_000,
  fullyParallel: true,
  workers: Number(process.env.WORKERS || 4),
  retries: 1,
  reporter: [['list'], ['json', { outputFile: './.work/report.json' }]],
  globalSetup: require.resolve('./global-setup.js'),
  use: { baseURL: `http://localhost:${WEB_PORT}`, trace: 'off', screenshot: 'off', actionTimeout: 10_000, navigationTimeout: 30_000 },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] }, grep: /@cross/ },
    { name: 'webkit', use: { ...devices['Desktop Safari'] }, grep: /@cross/ },
  ],
  webServer: [
    { command: `"${NODE}" server/src/index.js`, cwd: ROOT, url: `http://localhost:${API_PORT}/health`, reuseExistingServer: true, timeout: 120_000,
      env: { PORT: String(API_PORT), DB_DIALECT: 'sqlite', DB_STORAGE: DB, UPLOAD_DIR: path.join(__dirname, '.work', 'uploads'), NODE_ENV: 'development', APP_URL: `http://localhost:${WEB_PORT}`, CLIENT_URL: `http://localhost:${WEB_PORT}`, JOBS_MODE: 'cron', WA_GATEWAY: '0' } },
    { command: `"${NODE}" client/node_modules/vite/bin/vite.js client --port ${WEB_PORT} --strictPort`, cwd: ROOT, url: `http://localhost:${WEB_PORT}`, reuseExistingServer: true, timeout: 120_000, env: { VITE_API_TARGET: `http://localhost:${API_PORT}` } },
  ],
});
