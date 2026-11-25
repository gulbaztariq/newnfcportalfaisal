/*
 * Database schema sync.
 *   --force : drop & re-create everything (DANGER, development only)
 *   --safe  : create missing tables, add missing columns and apply known column changes. Never drops data.
 *   (none)  : sequelize alter (development only)
 */
const { sequelize } = require('../models');

const { safeSync } = require('../services/dbsync');

(async () => {
  const force = process.argv.includes('--force');
  await sequelize.authenticate();
  if (sequelize.getDialect() === 'mysql') await sequelize.query('SET FOREIGN_KEY_CHECKS = 0');
  if (process.argv.includes('--safe')) {
    await safeSync((line) => console.log(line));
    // activity log entries written before the actor's e-mail and role were stored with them: fill them in once, while the accounts still have those roles
    try {
      await sequelize.query('UPDATE activity_logs SET actor_email = (SELECT email FROM users WHERE users.id = activity_logs.user_id), actor_role = (SELECT role FROM users WHERE users.id = activity_logs.user_id) WHERE actor_email IS NULL AND user_id IS NOT NULL');
      console.log('Activity log actors recorded.');
    } catch (e) { console.log('Activity log backfill skipped:', e.message); }
  }
  else await sequelize.sync(force ? { force: true } : { alter: true });
  if (sequelize.getDialect() === 'mysql') await sequelize.query('SET FOREIGN_KEY_CHECKS = 1');
  console.log(`Database ${force ? 're-created' : 'synchronised'}.`);
  await sequelize.close();
})().catch((e) => { console.error(e); process.exit(1); });
