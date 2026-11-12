/*
 * Scheduled jobs for hosts that stop idle apps (e.g. Hostinger Node.js hosting). Run it from the host's cron scheduler:
 *   node server/src/scripts/cron.js            every hour: plan expiry reminders, weekly product sync (runs itself once a week), overdue invoices
 *   node server/src/scripts/cron.js courier    every 30 minutes: courier tracking
 * Run it with the same environment variables as the app. Set JOBS_MODE=cron on the app so the in-process timers stay off.
 */
const { sequelize } = require('../models');
const jobs = require('../services/jobs');

(async () => {
  const task = process.argv[2] === 'courier' ? 'courier' : 'hourly';
  const t0 = Date.now();
  try {
    await sequelize.authenticate();
    if (task === 'courier') await jobs.courierSync(); else await jobs.runHourly();
    console.log(`cron ${task} finished in ${Date.now() - t0} ms`);
  } catch (e) { console.error(`cron ${task} failed:`, e.message); process.exitCode = 1; }
  await sequelize.close().catch(() => {});
  process.exit();
})();
