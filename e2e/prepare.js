// Builds a fresh throwaway sqlite database with the demo data (never the live database).
const { spawnSync } = require('child_process');
const fs = require('fs'); const path = require('path');
const ROOT = path.resolve(__dirname, '..'); const WORK = path.join(__dirname, '.work');
fs.mkdirSync(WORK, { recursive: true });
const DB = path.join(WORK, 'e2e.sqlite'); if (fs.existsSync(DB)) fs.unlinkSync(DB);
const env = { ...process.env, DB_DIALECT: 'sqlite', DB_STORAGE: DB, UPLOAD_DIR: path.join(WORK, 'uploads'), NODE_ENV: 'development' };
for (const args of [['server/src/scripts/sync.js', '--force'], ['server/src/scripts/seed.js']]) {
  const r = spawnSync(process.execPath, args, { cwd: ROOT, env, stdio: 'inherit' }); if (r.status) process.exit(r.status);
}
console.log('e2e database ready:', DB);

// let the test accounts sign in without a second factor (this database is throwaway)
const r = spawnSync(process.execPath, ['-e', `
  (async () => { const settings = require('./server/src/services/settings'); const { sequelize } = require('./server/src/models');
    await settings.set({ enforce_2fa_staff: '0', require_totp_staff: '0', require_totp_company: '0', login_otp_enable: '0' }); await sequelize.close(); })();`], { cwd: ROOT, env, stdio: 'inherit' });
if (r.status) process.exit(r.status);
