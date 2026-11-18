/*
 * Product catalogue cleanup (QA report H5): finds products that share a SKU (case-insensitive) and gives every duplicate after
 * the first a unique one. Nothing is deleted or merged. Dry run by default:
 *   node server/src/scripts/product-cleanup.js          (shows what would change)
 *   node server/src/scripts/product-cleanup.js --apply  (does it)
 */
const { Op } = require('sequelize');
const { sequelize, NfcCard } = require('../models');

(async () => {
  const apply = process.argv.includes('--apply');
  await sequelize.authenticate();
  const all = await NfcCard.findAll({ where: { sku: { [Op.ne]: null } }, attributes: ['id', 'name', 'sku', 'order_source_id'], order: [['order_source_id', 'ASC'], ['id', 'ASC']] });
  const seen = new Map(); const taken = new Set(all.map((p) => String(p.sku).toUpperCase()));
  const changes = [];
  for (const p of all) {
    const key = String(p.sku).trim().toUpperCase();
    if (!key) continue;
    if (!seen.has(key)) { seen.set(key, p.id); continue; }
    let n = 2; let next = `${key}-${n}`;
    while (taken.has(next)) next = `${key}-${++n}`;
    taken.add(next); changes.push({ id: p.id, name: p.name, from: p.sku, to: next });
    if (apply) await p.update({ sku: next });
  }
  const empty = await NfcCard.count({ where: { [Op.or]: [{ sku: null }, { sku: '' }] } });
  console.log(`${changes.length} duplicate SKU(s) ${apply ? 'renamed' : 'found (dry run, nothing changed)'}; ${empty} product(s) have no SKU.`);
  for (const c of changes.slice(0, 60)) console.log(`  #${c.id} ${c.name}: ${c.from} -> ${c.to}`);
  if (changes.length > 60) console.log(`  ... and ${changes.length - 60} more`);
  await sequelize.close();
})().catch((e) => { console.error(e); process.exit(1); });
