/*
 * Order source product sync: reads the public product feed of a website (WooCommerce Store API or Shopify products.json)
 * and keeps a local product (NfcCard) per remote product, linked to the order source.
 *  - the remote price is always stored in source_price
 *  - price (what orders use) follows the remote price until someone edits it (price_locked), then it stays as edited
 *  - discount, sample price, wholesale tiers and product kind are ours and never touched by the sync
 */
const dns = require('dns').promises;
const net = require('net');
const { Op } = require('sequelize');
const { HttpError } = require('../utils/http');

const M = () => require('../models');
const r2 = (n) => Math.round(Number(n || 0) * 100) / 100;
const MAX_PAGES = 20;

const isPrivateIp = (ip) => {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127);
  }
  const x = ip.toLowerCase();
  return x === '::1' || x.startsWith('fc') || x.startsWith('fd') || x.startsWith('fe80') || x.startsWith('::ffff:127.') || x.startsWith('::ffff:10.') || x.startsWith('::ffff:192.168.');
};
/** only public http(s) hosts: an order source URL must never let the server reach internal services */
async function assertPublicUrl(raw) {
  let u;
  try { u = new URL(raw); } catch { throw new HttpError(422, 'This website address is not valid'); }
  if (!/^https?:$/.test(u.protocol)) throw new HttpError(422, 'Only http and https addresses can be synced');
  const host = u.hostname.replace(/^\[|\]$/g, '');
  const addrs = net.isIP(host) ? [{ address: host }] : await dns.lookup(host, { all: true }).catch(() => { throw new HttpError(422, `Could not find ${host}`); });
  if (addrs.some((a) => isPrivateIp(a.address))) throw new HttpError(422, 'This address points to a private network and cannot be synced');
  return u;
}

async function getJson(url, headers = {}) {
  await assertPublicUrl(url);
  const res = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': 'NFCProfile-ProductSync/1.0', ...headers }, redirect: 'follow', signal: AbortSignal.timeout(20000) });
  if (!res.ok) return { ok: false, status: res.status };
  const ct = res.headers.get('content-type') || '';
  if (!/json/i.test(ct)) return { ok: false, status: res.status };
  return { ok: true, json: await res.json(), headers: res.headers };
}

const decode = (t) => String(t || '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&#8217;/g, "'").replace(/&#8211;/g, '-').replace(/&#038;/g, '&');
const plain = (html) => decode(String(html || '').replace(/<(script|style)[\s\S]*?<\/\1>/gi, '').replace(/<\/(p|div|li|h\d)>/gi, '\n').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '')).replace(/\n{3,}/g, '\n\n').trim();
const slugify = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 120);

/** WooCommerce public Store API (prices are in minor units, e.g. 150000 = 1500.00) */
async function readWoo(base) {
  const out = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const r = await getJson(`${base}/wp-json/wc/store/v1/products?per_page=100&page=${page}`);
    if (!r.ok || !Array.isArray(r.json)) { if (page === 1) return null; break; }
    for (const p of r.json) {
      const minor = Number(p.prices?.currency_minor_unit ?? 2);
      const toMoney = (v) => (v === undefined || v === null || v === '' ? 0 : r2(Number(v) / 10 ** minor));
      out.push({
        id: String(p.id), name: decode(p.name), url: p.permalink, sku: p.sku || null, description: plain(p.short_description || p.description), category: decode(p.categories?.[0]?.name || ''),
        price: toMoney(p.prices?.price), compare: toMoney(p.prices?.regular_price) > toMoney(p.prices?.price) ? toMoney(p.prices?.regular_price) : null, images: (p.images || []).map((i) => i.src).filter(Boolean), variants: [],
      });
    }
    if (page >= Number(r.headers.get('x-wp-totalpages') || 1)) break;
  }
  return out;
}
/** Shopify public products.json */
async function readShopify(base) {
  const out = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const r = await getJson(`${base}/products.json?limit=250&page=${page}`);
    if (!r.ok || !Array.isArray(r.json?.products)) { if (page === 1) return null; break; }
    if (!r.json.products.length) break;
    for (const p of r.json.products) {
      const vs = (p.variants || []).filter((v) => v.price !== undefined);
      const base0 = vs.length ? Math.min(...vs.map((v) => Number(v.price))) : 0;
      const multi = vs.length > 1 && vs.some((v) => Number(v.price) !== base0 || (v.title && v.title !== 'Default Title'));
      out.push({
        id: String(p.id), name: decode(p.title), url: `${base}/products/${p.handle}`, sku: vs[0]?.sku || null, description: plain(p.body_html), category: decode(p.product_type || ''),
        price: r2(base0), compare: vs[0]?.compare_at_price && Number(vs[0].compare_at_price) > base0 ? r2(vs[0].compare_at_price) : null, images: (p.images || []).map((i) => i.src).filter(Boolean),
        variants: multi ? vs.map((v) => ({ name: String(v.title).slice(0, 60), price_delta: r2(Number(v.price) - base0) })) : [],
      });
    }
    if (r.json.products.length < 250) break;
  }
  return out;
}

/** Fetch everything the site offers. Tries the shop folder first when the address has one, then the site root. */
async function fetchProducts(sourceUrl) {
  const u = await assertPublicUrl(sourceUrl);
  const bases = [...new Set([`${u.origin}${u.pathname.replace(/\/+$/, '')}`, u.origin])];
  for (const base of bases) {
    const woo = await readWoo(base).catch(() => null); if (woo) return { platform: 'woocommerce', products: woo };
    const shop = await readShopify(base).catch(() => null); if (shop) return { platform: 'shopify', products: shop };
  }
  throw new HttpError(422, 'No product feed found on this website (WooCommerce and Shopify are supported). You can add its products by pasting a list instead.');
}

/** Product kind from the name, only for the confident cases. Everything else stays unset for you to tag in the price list. */
const guessKind = (name) => (/digital business card/i.test(name) ? 'nfc_profile' : /all[- ]in[- ]one.*social|social.*all[- ]in[- ]one/i.test(name) ? 'social_profile' : null);

/** Upsert the local products of a source. Returns counts. */
async function syncSource(source) {
  const { NfcCard, OrderSource } = M();
  if (!source.url) throw new HttpError(422, 'Add the website address to this source first');
  let found;
  try { found = await fetchProducts(source.url); } catch (e) { await source.update({ sync_message: String(e.message).slice(0, 250), last_synced_at: new Date() }); throw e; }
  let created = 0; let updated = 0;
  for (const p of found.products) {
    if (!p.name) continue;
    let row = await NfcCard.findOne({ where: { order_source_id: source.id, external_id: p.id } });
    const images = p.images.slice(0, 6);
    if (row) {
      const data = { source_price: p.price, source_url: p.url, synced_at: new Date(), compare_price: p.compare, images: images.length ? images : row.images };
      if (!row.price_locked) data.price = p.price; // an edited price is ours: keep it
      if (!row.sku && p.sku) data.sku = p.sku;
      await row.update(data); updated++;
    } else {
      let slug = `${slugify(p.name)}-s${source.id}`; let i = 1;
      while (await NfcCard.findOne({ where: { slug } })) slug = `${slugify(p.name)}-s${source.id}-${++i}`;
      await NfcCard.create({
        name: p.name.slice(0, 120), description: p.description, short_description: p.description.slice(0, 500), price: p.price, source_price: p.price, compare_price: p.compare, category: (p.category || '').slice(0, 60) || null, sku: p.sku ? String(p.sku).slice(0, 60) : null,
        product_kind: guessKind(p.name), images, front_image: images[0] && images[0].length <= 255 ? images[0] : null, variants: p.variants, status: true, show_in_shop: false, slug: slug.slice(0, 150),
        order_source_id: source.id, external_id: p.id, source_url: p.url, synced_at: new Date(),
      }); created++;
    }
  }
  await source.update({ platform: found.platform, last_synced_at: new Date(), sync_message: `${found.products.length} products (${created} new, ${updated} updated)` });
  return { platform: found.platform, total: found.products.length, created, updated };
}

/** Fallback for sites without a feed: "Product name, price" one per line */
async function importPasted(source, text) {
  const { NfcCard } = M();
  const lines = String(text || '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean).slice(0, 500);
  let created = 0; let updated = 0;
  for (const line of lines) {
    const m = line.match(/^(.*?)[\s,;\t|]+(?:rs\.?|pkr|\$)?\s*([\d.,]+)\s*$/i);
    if (!m || !m[1].trim()) continue;
    const name = m[1].trim().replace(/[,;|]+$/, '').slice(0, 120);
    const price = r2(m[2].replace(/,/g, ''));
    const ext = `manual:${slugify(name)}`;
    const row = await NfcCard.findOne({ where: { order_source_id: source.id, external_id: ext } });
    if (row) { await row.update({ source_price: price, ...(row.price_locked ? {} : { price }), synced_at: new Date() }); updated++; continue; }
    let slug = `${slugify(name)}-s${source.id}`; let i = 1;
    while (await NfcCard.findOne({ where: { slug: { [Op.eq]: slug } } })) slug = `${slugify(name)}-s${source.id}-${++i}`;
    await NfcCard.create({ name, price, source_price: price, status: true, show_in_shop: false, slug, order_source_id: source.id, external_id: ext, synced_at: new Date() }); created++;
  }
  await source.update({ platform: source.platform || 'manual', last_synced_at: new Date(), sync_message: `${created + updated} products from your list (${created} new, ${updated} updated)` });
  return { total: created + updated, created, updated };
}

module.exports = { syncSource, importPasted, fetchProducts, assertPublicUrl };
