/*
 * Safe database upgrade: creates tables that do not exist yet, adds missing columns and applies the known column changes.
 * Never drops a table, a column or a row. Used by `npm run db:update` and by the "Upgrade database" button in Settings.
 */
const { sequelize } = require('../models');

// columns whose definition changed after the first release (applied idempotently)
const CHANGES = [
  ['transactions', 'purpose'],
  ['vcard_galleries', 'image'],
  ['users', 'role'],
  ['nfc_orders', 'order_status'],
];

async function safeSync(log = () => {}) {
  const qi = sequelize.getQueryInterface();
  const added = [];
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
      added.push(`${name}.${field}`); log(`+ ${name}.${field}`);
    }
  }
  for (const [table, field] of CHANGES) {
    const model = Object.values(sequelize.models).find((m) => { const t = m.getTableName(); return (typeof t === 'string' ? t : t.tableName) === table; });
    const attr = Object.values(model.rawAttributes).find((a) => (a.field || a.fieldName) === field);
    if (sequelize.getDialect() === 'sqlite') continue; // sqlite cannot alter column types; dev databases are re-created instead
    await qi.changeColumn(table, field, { type: attr.type, allowNull: attr.allowNull !== false, defaultValue: attr.defaultValue });
  }
  return added;
}

module.exports = { safeSync };
