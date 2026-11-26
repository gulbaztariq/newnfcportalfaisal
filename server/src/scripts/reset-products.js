/**
 * Replace the product list with the catalogue of a website:  node src/scripts/reset-products.js "NFC Products" https://nfcproducts.com.pk
 *  - every product that no order uses is deleted; a product an order already used is only switched off (the order keeps its line)
 *  - the website becomes an order source (made if missing) and its products are fetched from its public product feed
 */
const M = require('../models');
const productsync = require('../services/productsync');

(async () => {
  const [name, url] = [process.argv[2], process.argv[3]];
  if (!name || !url) { console.log('usage: reset-products.js "Source name" https://website'); process.exit(1); }
  const all = await M.NfcCard.findAll({ attributes: ['id', 'name'] });
  let deleted = 0; let switchedOff = 0;
  for (const p of all) {
    try { await p.destroy(); deleted += 1; } catch { await M.NfcCard.update({ status: false, show_in_shop: false }, { where: { id: p.id } }); switchedOff += 1; }
  }
  console.log(`products deleted: ${deleted}, switched off because orders use them: ${switchedOff}`);
  const host = new URL(url).hostname.replace(/^www\./, '');
  let src = (await M.OrderSource.findAll()).find((s) => s.url && new URL(s.url).hostname.replace(/^www\./, '') === host) || await M.OrderSource.findOne({ where: { name } });
  if (!src) src = await M.OrderSource.create({ name, url, status: true });
  else await src.update({ name, url, status: true });
  const r = await productsync.syncSource(src);
  console.log(`synced ${src.name}: ${r.platform}, ${r.total} found, ${r.created} added`);
  console.log(`products now: ${await M.NfcCard.count({ where: { status: true } })}`);
  process.exit(0);
})().catch((e) => { console.error('failed:', e.message); process.exit(1); });
