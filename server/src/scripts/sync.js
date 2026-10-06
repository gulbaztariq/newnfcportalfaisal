/*
 * Database schema sync.
 *   --force : drop & re-create everything (DANGER, development only)
 *   --safe  : create missing tables, add missing columns and apply known column changes. Never drops data.
 *   (none)  : sequelize alter (development only)
 */
const { sequelize } = require('../models');

// columns whose definition changed after the first release (applied idempotently in --safe mode)
const CHANGES = [
  ['transactions', 'purpose'],
  ['vcard_galleries', 'image'],
  ['users', 'role'],
  ['nfc_orders', 'order_status'],
];

async function safeSync() {
  const qi = sequelize.getQueryInterface();
  await sequelize.sync(); // creates tables that don't exist yet
  for (const model of Object.values(sequelize.models)) {
    const table = model.getTableName();
    const name = typeof table === 'string' ? table : table.tableName;
    const existing = await qi.describeTable(name);
    for (const [attr, def] of Object.entries(model.rawAttributes)) {
      const field = def.field || attr;
      if (existing[field]) continue;
      const { type, allowNull, defaultValue } = def;
      await qi.addColumn(name, field, { type, allowNull: allowNull !== false, defaultValue });
      console.log(`+ ${name}.${field}`);
    }
  }
  for (const [table, field] of CHANGES) {
    const model = Object.values(sequelize.models).find((m) => { const t = m.getTableName(); return (typeof t === 'string' ? t : t.tableName) === table; });
    const attr = Object.values(model.rawAttributes).find((a) => (a.field || a.fieldName) === field);
    if (sequelize.getDialect() === 'sqlite') continue; // sqlite cannot alter column types; dev databases are re-created instead
    await qi.changeColumn(table, field, { type: attr.type, allowNull: attr.allowNull !== false, defaultValue: attr.defaultValue });
  }
}

(async () => {
  const force = process.argv.includes('--force');
  await sequelize.authenticate();
  if (sequelize.getDialect() === 'mysql') await sequelize.query('SET FOREIGN_KEY_CHECKS = 0');
  if (process.argv.includes('--safe')) await safeSync();
  else await sequelize.sync(force ? { force: true } : { alter: true });
  if (sequelize.getDialect() === 'mysql') await sequelize.query('SET FOREIGN_KEY_CHECKS = 1');
  console.log(`Database ${force ? 're-created' : 'synchronised'}.`);
  await sequelize.close();
})().catch((e) => { console.error(e); process.exit(1); });
