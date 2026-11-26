/**
 * Empty the product list:  node src/scripts/clear-products.js
 * A product no order uses is deleted; one an order already used is only switched off (the order keeps its line).
 * Order sources are left as they are, so a website can be fetched again later.
 */
const M = require('../models');

(async () => {
  const all = await M.NfcCard.findAll({ attributes: ['id', 'name'] });
  let deleted = 0; let switchedOff = 0;
  for (const p of all) {
    try { await p.destroy(); deleted += 1; } catch { await M.NfcCard.update({ status: false, show_in_shop: false }, { where: { id: p.id } }); switchedOff += 1; }
  }
  console.log(`products deleted: ${deleted}, switched off because orders use them: ${switchedOff}`);
  console.log(`active products now: ${await M.NfcCard.count({ where: { status: true } })}`);
  process.exit(0);
})().catch((e) => { console.error('failed:', e.message); process.exit(1); });
