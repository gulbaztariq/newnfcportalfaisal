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
  if (process.argv.includes('--safe')) await safeSync((line) => console.log(line));
  else await sequelize.sync(force ? { force: true } : { alter: true });
  if (sequelize.getDialect() === 'mysql') await sequelize.query('SET FOREIGN_KEY_CHECKS = 1');
  console.log(`Database ${force ? 're-created' : 'synchronised'}.`);
  await sequelize.close();
})().catch((e) => { console.error(e); process.exit(1); });
