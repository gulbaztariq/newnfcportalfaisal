const { esc, url, color, nl2br } = require('../../utils/html');
const { TEMPLATES, LAYOUTS } = require('./catalog');
const BASE_CSS = require('./styles');
const { t: labelsFor, RTL } = require('./i18n');

const BY_SLUG = Object.fromEntries(TEMPLATES.map((t) => [t.slug, t]));

const SOCIAL = {
  website: ['ri-global-line', 'Website'], facebook: ['ri-facebook-fill', 'Facebook'], instagram: ['ri-instagram-line', 'Instagram'],
  twitter: ['ri-twitter-fill', 'X / Twitter'], linkedin: ['ri-linkedin-fill', 'LinkedIn'], youtube: ['ri-youtube-fill', 'YouTube'],
  whatsapp: ['ri-whatsapp-line', 'WhatsApp'], tiktok: ['ri-music-2-fill', 'TikTok'], pinterest: ['ri-pinterest-fill', 'Pinterest'],
  github: ['ri-github-fill', 'GitHub'], telegram: ['ri-telegram-fill', 'Telegram'], snapchat: ['ri-snapchat-fill', 'Snapchat'],
  reddit: ['ri-reddit-fill', 'Reddit'], dribbble: ['ri-dribbble-fill', 'Dribbble'], behance: ['ri-behance-fill', 'Behance'], discord: ['ri-discord-fill', 'Discord'],
};
const DAYS = [['mon', 'Monday'], ['tue', 'Tuesday'], ['wed', 'Wednesday'], ['thu', 'Thursday'], ['fri', 'Friday'], ['sat', 'Saturday'], ['sun', 'Sunday']];
const GOOGLE_FONTS = {
  Inter: 'Inter:wght@400;500;600;700;800',
  Poppins: 'Poppins:wght@400;500;600;700;800',
  'Playfair Display': 'Playfair+Display:wght@400;500;600;700',
  Montserrat: 'Montserrat:wght@400;500;600;700;800',
  Lora: 'Lora:wght@400;500;600;700',
  'Space Grotesk': 'Space+Grotesk:wght@400;500;600;700',
  Roboto: 'Roboto:wght@400;500;700',
  'Open Sans': 'Open+Sans:wght@400;600;700',
  'DM Sans': 'DM+Sans:wght@400;500;600;700',
  Outfit: 'Outfit:wght@400;500;600;700',
  'Plus Jakarta Sans': 'Plus+Jakarta+Sans:wght@400;500;600;700',
  Manrope: 'Manrope:wght@400;500;600;700',
  'Cormorant Garamond': 'Cormorant+Garamond:wght@400;500;600;700',
  Fraunces: 'Fraunces:wght@400;500;600;700',
  Sora: 'Sora:wght@400;500;600;700',
  Syne: 'Syne:wght@400;500;600;700',
  'JetBrains Mono': 'JetBrains+Mono:wght@400;500;600;700',
  'IBM Plex Mono': 'IBM+Plex+Mono:wght@400;500;600;700',
  Quicksand: 'Quicksand:wght@400;500;600;700',
  Urbanist: 'Urbanist:wght@400;500;600;700',
  Rubik: 'Rubik:wght@400;500;600;700',
  Lexend: 'Lexend:wght@400;500;600;700',
  'IBM Plex Sans': 'IBM+Plex+Sans:wght@400;500;600;700',
  Figtree: 'Figtree:wght@400;500;600;700',
  Barlow: 'Barlow:wght@400;500;600;700',
  Bitter: 'Bitter:wght@400;500;600;700',
  'Bodoni Moda': 'Bodoni+Moda:wght@400;500;600;700',
  Unbounded: 'Unbounded:wght@400;500;600;700',
  'Chakra Petch': 'Chakra+Petch:wght@400;500;600;700',
  'EB Garamond': 'EB+Garamond:wght@400;500;600;700',
  'Libre Franklin': 'Libre+Franklin:wght@400;500;600;700',
  Nunito: 'Nunito:wght@400;500;600;700;800',
  'Bricolage Grotesque': 'Bricolage+Grotesque:wght@400;500;600;700;800',
  Archivo: 'Archivo:wght@400;500;600;700;800',
  'Baloo 2': 'Baloo+2:wght@400;500;600;700;800',
  'Libre Baskerville': 'Libre+Baskerville:wght@400;700',
  Amiri: 'Amiri:wght@400;700',
};
const PAY_ICONS = { paypal: 'ri-paypal-fill', upi: 'ri-qr-scan-2-line', bank: 'ri-bank-line', crypto: 'ri-bit-coin-line', link: 'ri-secure-payment-line' };

function fontParts(font) {
  const first = String(font || '').split(',')[0].replace(/['"]/g, '').trim();
  if (!GOOGLE_FONTS[first]) return { family: "'Inter', system-ui, sans-serif", google: GOOGLE_FONTS.Inter };
  // rebuild the stack from the whitelisted family name so no user text reaches the stylesheet
  const f = String(font);
  const fallback = /mono/i.test(f) ? 'ui-monospace, monospace' : /serif/i.test(f.replace(/sans-serif/gi, '')) ? 'Georgia, serif' : 'system-ui, sans-serif';
  return { family: "'" + first + "', " + fallback, google: GOOGLE_FONTS[first] };
}
/** JSON for inline <script> blocks: '<' is escaped so user text can never close the script element */
const js = (x) => JSON.stringify(x ?? null).replace(/</g, '\\u003c');
const hex6 = (c) => (/^#[0-9a-f]{3}$/i.test(c) ? `#${c[1]}${c[1]}${c[2]}${c[2]}${c[3]}${c[3]}` : c);
/** WCAG relative luminance of a hex colour (0 = black, 1 = white) */
function lum(c) {
  const h = String(hex6(c) || '').replace('#', '');
  if (!/^[0-9a-f]{6}/i.test(h)) return 1;
  const [r, g, b] = [0, 2, 4].map((i) => { const x = parseInt(h.slice(i, i + 2), 16) / 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const onColor = (c) => (lum(c) > 0.38 ? '#0b0f19' : '#ffffff');
const money = (p, cur) => (p === null || p === undefined || p === '' ? '' : `${esc(cur || '')} ${Number(p).toLocaleString('en-US', { maximumFractionDigits: 2 })}`.trim());

/** Content-Security-Policy for public vCard pages (embeds need https frames) */
function vcardCsp(nonce, clientUrl) {
  return [
    "default-src 'self'", `script-src 'self' 'nonce-${nonce}' https://www.googletagmanager.com`, "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' data: https://fonts.gstatic.com", "img-src 'self' data: blob: https:", "media-src 'self'", 'frame-src https:',
    "connect-src 'self' https://www.google-analytics.com https://*.google-analytics.com", "form-action 'self'", "base-uri 'self'", "object-src 'none'",
    `frame-ancestors 'self' ${clientUrl}`, "manifest-src 'self'", "worker-src 'self'",
  ].join('; ');
}


function vcardFile(v) {
  const lines = ['BEGIN:VCARD', 'VERSION:3.0', `N:${v.last_name || ''};${v.first_name || v.name};;;`, `FN:${[v.first_name, v.last_name].filter(Boolean).join(' ') || v.name}`];
  if (v.company) lines.push(`ORG:${v.company}`);
  if (v.job_title || v.occupation) lines.push(`TITLE:${v.job_title || v.occupation}`);
  if (v.phone) lines.push(`TEL;TYPE=CELL:${v.region_code ? `+${v.region_code}` : ''}${v.phone}`);
  if (v.alternative_phone) lines.push(`TEL;TYPE=WORK:${v.alternative_phone}`);
  if (v.email) lines.push(`EMAIL;TYPE=INTERNET:${v.email}`);
  if (v.alternative_email) lines.push(`EMAIL;TYPE=WORK:${v.alternative_email}`);
  if (v.location) lines.push(`ADR;TYPE=WORK:;;${v.location};;;;`);
  if (v.social_links?.website) lines.push(`URL:${v.social_links.website}`);
  if (v.dob) lines.push(`BDAY:${v.dob}`);
  lines.push('END:VCARD');
  return lines.map((l) => l.replace(/\r?\n/g, ' ')).join('\r\n');
}

/** theme -> CSS variables + meta shared by the main page and sub pages */
function themeOf(v, template, app) {
  const def = BY_SLUG[template?.slug] || TEMPLATES[0];
  const layout = LAYOUTS.includes(def.layout) ? def.layout : 'classic';
  const th = { ...def.defaults, ...(template?.defaults || {}), ...(v.theme || {}) };
  const p = hex6(color(th.primary, def.defaults.primary));
  const s = hex6(color(th.secondary, def.defaults.secondary));
  const bg = hex6(color(th.background, def.defaults.background));
  const tx = color(th.text, def.defaults.text);
  const font = fontParts(th.font || def.defaults.font);
  // light/dark surfaces follow the actual background colour, so any layout works with any palette
  const dark = lum(bg) < 0.2;
  const vars = `--p:${p};--s:${s};--bg:${bg};--tx:${tx};--font:${font.family};--onp:${onColor(p)};--ons:${onColor(s)};`
    + `--page:color-mix(in srgb,${p} ${dark ? 7 : 6}%,${dark ? '#04050a' : '#eceef3'});--muted:color-mix(in srgb,${tx} 62%,transparent);`
    + `--card:${dark ? `color-mix(in srgb,${tx} 5%,${bg})` : `color-mix(in srgb,#fff 82%,${bg})`};--line:color-mix(in srgb,${tx} ${dark ? 12 : 9}%,transparent);`
    + `--chip:color-mix(in srgb,${p} ${dark ? 18 : 12}%,transparent);`
    + `--sh:${dark ? '0 1px 0 rgba(255,255,255,.04) inset,0 20px 40px -24px rgba(0,0,0,.8)' : '0 1px 2px rgba(16,24,40,.04),0 12px 32px -16px rgba(16,24,40,.16)'};color-scheme:${dark ? 'dark' : 'light'}`;
  const lang = v.default_language || 'en';
  return { layout, dark, lowp: dark && lum(p) < 0.1, p, font, vars, lang, dir: RTL.has(lang) ? 'rtl' : 'ltr', L: labelsFor(lang), favicon: app.favicon };
}

function headTags({ v, th, title, desc, link, appUrl, nonce, noindex }) {
  return `<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc || '')}">
${noindex ? '<meta name="robots" content="noindex">' : ''}
${v.meta_keyword ? `<meta name="keywords" content="${esc(v.meta_keyword)}">` : ''}
<meta name="theme-color" content="${th.p}">
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc || '')}"><meta property="og:url" content="${esc(link)}"><meta property="og:type" content="profile">
${v.profile_image ? `<meta property="og:image" content="${esc(appUrl + v.profile_image)}"><link rel="apple-touch-icon" href="${url(v.profile_image)}">` : ''}
<meta name="twitter:card" content="summary">
<link rel="canonical" href="${esc(link)}">
<link rel="icon" href="${url(v.profile_image || th.favicon)}">
${v.pwa_enable ? `<link rel="manifest" href="/${esc(v.url_alias)}/manifest.webmanifest"><meta name="apple-mobile-web-app-capable" content="yes">` : ''}
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=${th.font.google}&display=swap">
<link rel="preload" href="/vendor/remixicon/remixicon.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/vendor/remixicon/remixicon.css">
<style>:root{${th.vars}}${BASE_CSS}</style>
${v.custom_css ? `<style>${String(v.custom_css).replace(/<\/?style[^>]*>/gi, '').replace(/<\//g, '<\\/')}</style>` : ''}
${v.google_analytics ? `<script async src="https://www.googletagmanager.com/gtag/js?id=${esc(v.google_analytics)}"></script><script nonce="${nonce}">window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config',${js(v.google_analytics)});</script>` : ''}`;
}

function footer(v, app, appUrl, L, pages) {
  const legal = [
    ...(pages || []).map((pg) => [`/${v.url_alias}/p/${pg.slug}`, pg.title]),
    v.terms_conditions && [`/${v.url_alias}/terms`, L.terms], v.privacy_policy && [`/${v.url_alias}/privacy`, L.privacy],
  ].filter(Boolean);
  return `<footer class="foot">${legal.length ? `<div class="legal">${legal.map(([h, l]) => `<a href="${esc(h)}">${esc(l)}</a>`).join('')}</div>` : ''}${v.hide_branding ? '' : `${L.madeby} <a href="${esc(appUrl)}" target="_blank" rel="noopener">${esc(app.app_name)}</a>`}</footer>`;
}

/**
 * Render a public vCard page. Everything user-supplied is escaped; URLs are scheme-checked; colours are hex-checked.
 */
function render({ v, template, services = [], gallery = [], testimonials = [], products = [], blogs = [], pages = [], app, appUrl, nonce }) {
  const th = themeOf(v, template, app);
  const { layout, L } = th;
  const sec = { contact: true, social: true, services: true, gallery: true, testimonials: true, hours: true, qr: true, enquiry: true, links: true, products: true, appointments: true, blog: true, embeds: true, payments: true, map: true, ...(v.sections || {}) };
  const link = `${appUrl}/${v.url_alias}`;
  const fullName = [v.first_name, v.last_name].filter(Boolean).join(' ') || v.name;
  const initials = fullName.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  const phone = v.phone ? `${v.region_code ? `+${v.region_code}` : ''}${v.phone}` : '';
  const wa = v.social_links?.whatsapp || (phone ? `https://wa.me/${phone.replace(/\D/g, '')}` : '');
  const title = v.site_title || `${fullName}${v.occupation ? ` - ${v.occupation}` : ''}`;
  const days = v.week_format === 'sun' ? [DAYS[6], ...DAYS.slice(0, 6)] : DAYS;
  const today = DAYS[(new Date().getDay() + 6) % 7][0];
  const alias = esc(v.url_alias);

  const H = (icon, label) => `<h3><i class="${icon}" aria-hidden="true"></i><span>${label}</span></h3>`; // section heading (labels are our own i18n strings)
  const mapHref = v.location ? (v.location_url || `https://maps.google.com/?q=${encodeURIComponent(v.location)}`) : '';

  let cover = `<div class="cover ${v.cover_image ? 'img' : 'g'}"${v.cover_image ? ` style="background-image:url('${url(v.cover_image)}')"` : ''}></div>`;
  if (v.cover_type === 'video' && v.cover_video) cover = `<div class="cover media"><video src="${url(v.cover_video)}" autoplay muted loop playsinline preload="metadata" id="cv"></video><button class="mute" type="button" id="mute" aria-label="Unmute"><i class="ri-volume-mute-line"></i></button></div>`;
  if (v.cover_type === 'youtube' && v.youtube_link && /^[\w-]{11}$/.test(v.youtube_link)) cover = `<div class="cover media"><iframe src="https://www.youtube-nocookie.com/embed/${v.youtube_link}?autoplay=1&mute=1&loop=1&playlist=${v.youtube_link}&controls=0&playsinline=1" allow="autoplay; encrypted-media" title="cover" loading="lazy"></iframe></div>`;

  const contactRows = [
    v.email && ['ri-mail-line', L.email, v.email, `mailto:${v.email}`],
    v.alternative_email && ['ri-mail-line', L.email, v.alternative_email, `mailto:${v.alternative_email}`],
    phone && ['ri-phone-line', L.phone, phone, `tel:${phone}`],
    v.alternative_phone && ['ri-phone-line', L.phone, v.alternative_phone, `tel:${v.alternative_phone}`],
    v.dob && ['ri-cake-2-line', 'Birthday', v.dob, null],
    v.location && ['ri-map-pin-line', L.location, v.location, mapHref],
  ].filter(Boolean);
  const socials = Object.entries(v.social_links || {}).filter(([k, u]) => SOCIAL[k] && u);
  const hours = v.business_hours || {};
  const hasHours = DAYS.some(([d]) => hours[d]?.open);
  const cats = [...new Set(gallery.map((g) => g.category).filter(Boolean))];
  const appt = v.appointment_settings || {};
  const apptOn = sec.appointments && appt.enabled && Object.values(appt.slots || {}).some((x) => x?.length);
  const currencyOf = (pr) => pr.currency_code || '';

  const productsHtml = sec.products && products.length ? `<section class="sec">${H('ri-shopping-bag-3-line', L.products)}<div class="prods">${products.map((pr) => {
    const img = (pr.images || [])[0];
    return `<div class="prod"><div class="img">${img ? `<img src="${url(img)}" alt="${esc(pr.name)}" loading="lazy" data-lb="${url(img)}">` : ''}${(pr.images || []).length > 1 ? `<div class="dots">${pr.images.map(() => '<span></span>').join('')}</div>` : ''}</div>
    <div class="body"><b>${esc(pr.name)}</b>${pr.price !== null && pr.price !== undefined ? `<span class="price">${money(pr.price, currencyOf(pr))}</span>` : ''}${pr.in_stock === false ? `<span class="out">${L.out}</span>` : ''}
    ${pr.description ? `<p style="font-size:12px;color:var(--muted)">${esc(String(pr.description).slice(0, 110))}</p>` : ''}
    <div class="row2">${v.enable_enquiry_form ? `<button type="button" data-enq="${esc(pr.name)}">${L.enquire}</button>` : ''}${pr.product_url ? `<a class="pri" href="${url(pr.product_url)}" target="_blank" rel="noopener">${L.buy}</a>` : ''}</div></div></div>`;
  }).join('')}</div></section>` : '';

  const galleryHtml = sec.gallery && gallery.length ? `<section class="sec">${H('ri-image-2-line', L.gallery)}${cats.length > 1 ? `<div class="chips" id="gcats"><button class="on" data-cat="">${L.all}</button>${cats.map((c) => `<button data-cat="${esc(c)}">${esc(c)}</button>`).join('')}</div>` : ''}<div class="gal" id="gal">${gallery.map((g) => (g.type === 'youtube' && /^[\w-]{11}$/.test(g.video_url || '')
    ? `<a class="vid" href="#" data-cat="${esc(g.category || '')}" data-yt="${esc(g.video_url)}"><img src="https://i.ytimg.com/vi/${esc(g.video_url)}/hqdefault.jpg" alt="${esc(g.caption || '')}" loading="lazy"></a>`
    : g.image ? `<a href="#" data-cat="${esc(g.category || '')}" data-lb="${url(g.image)}"><img src="${url(g.image)}" alt="${esc(g.caption || '')}" loading="lazy"></a>` : '')).join('')}</div></section>` : '';

  const embeds = [];
  if (sec.embeds && v.instagram_embed) {
    const m = String(v.instagram_embed).match(/instagram\.com\/(p|reel|tv)\/([\w-]+)/);
    if (m) embeds.push(`<div class="embed"><iframe src="https://www.instagram.com/${m[1]}/${m[2]}/embed" height="560" loading="lazy" title="Instagram"></iframe></div>`);
  }
  if (sec.embeds && v.linkedin_embed && /^urn:li:(share|ugcPost|activity):\d+$/.test(v.linkedin_embed)) embeds.push(`<div class="embed"><iframe src="https://www.linkedin.com/embed/feed/update/${esc(v.linkedin_embed)}" height="520" loading="lazy" title="LinkedIn"></iframe></div>`);
  for (const f of v.iframes || []) if (/^https:\/\//.test(f.url)) embeds.push(`<div class="embed"><iframe src="${url(f.url)}" height="360" loading="lazy" title="${esc(f.title || 'embed')}" sandbox="allow-scripts allow-same-origin allow-popups allow-forms"></iframe></div>`);

  const html = `<!doctype html>
<html lang="${esc(th.lang)}" dir="${th.dir}">
<head>
${headTags({ v, th, title, desc: v.meta_description || v.description || v.occupation, link, appUrl, nonce })}
</head>
<body>
<main class="wrap l-${layout} ${th.dark ? 'is-dark' : 'is-light'}${th.lowp ? ' lowp' : ''} ${v.profile_image ? 'has-av' : 'no-av'}">
  <header class="hero">
    ${cover}
    <div class="hero-main">
      <div class="av">${v.profile_image ? `<img class="avatar" src="${url(v.profile_image)}" alt="${esc(fullName)}" width="140" height="140" fetchpriority="high">` : `<div class="avatar ph" aria-hidden="true">${esc(initials)}</div>`}</div>
      <div class="id">
        <div class="id-text">
          <h1 class="name">${esc(fullName)}${v.is_verified ? '<i class="ri-checkbox-circle-fill" title="Verified"></i>' : ''}</h1>
          ${v.occupation || v.job_title ? `<p class="role">${esc(v.job_title || v.occupation)}</p>` : ''}
          ${v.company || v.location ? `<div class="meta">${v.company ? `<span class="company"><i class="ri-building-line"></i>${esc(v.company)}</span>` : ''}${v.location ? `<span class="loc"><i class="ri-map-pin-line"></i>${esc(v.location)}</span>` : ''}</div>` : ''}
        </div>
      </div>
    </div>
  </header>

  <nav class="actions" aria-label="Contact">
    ${phone ? `<a class="act" href="tel:${esc(phone)}"><i class="ri-phone-line"></i><span>${L.call}</span></a>` : ''}
    ${v.email ? `<a class="act" href="mailto:${esc(v.email)}"><i class="ri-mail-line"></i><span>${L.email}</span></a>` : ''}
    ${wa ? `<a class="act" href="${url(wa)}" target="_blank" rel="noopener"><i class="ri-whatsapp-line"></i><span>${L.whatsapp}</span></a>` : ''}
    ${mapHref ? `<a class="act" href="${url(mapHref)}" target="_blank" rel="noopener"><i class="ri-map-pin-2-line"></i><span>${L.directions}</span></a>` : ''}
    <button class="act" type="button" id="share"><i class="ri-share-line"></i><span>${L.share}</span></button>
  </nav>
  <a class="save" id="save" href="/${alias}/contact.vcf"><i class="ri-user-add-line"></i>${L.save}</a>
  ${v.pwa_enable ? `<button class="install" id="install" type="button"><i class="ri-download-cloud-2-line"></i>${L.install}</button>` : ''}

  ${v.description ? `<section class="sec">${H('ri-user-3-line', L.about)}<div class="box about">${nl2br(v.description)}</div></section>` : ''}

  ${sec.contact && contactRows.length ? `<section class="sec">${H('ri-contacts-book-2-line', L.contact)}<div class="box list">${contactRows.map(([i, l, val, h]) => `${h ? `<a class="row" href="${url(h)}"${h.startsWith('http') ? ' target="_blank" rel="noopener"' : ''}>` : '<div class="row">'}<i class="${i}"></i><div><small>${l}</small><span>${esc(val)}</span></div>${h ? '<i class="ri-arrow-right-s-line go" aria-hidden="true"></i></a>' : '</div>'}`).join('')}</div></section>` : ''}

  ${sec.social && socials.length ? `<section class="sec">${H('ri-share-circle-line', L.social)}<div class="social">${socials.map(([k, u]) => `<a href="${url(u)}" target="_blank" rel="noopener" aria-label="${SOCIAL[k][1]}" title="${SOCIAL[k][1]}"><i class="${SOCIAL[k][0]}"></i></a>`).join('')}</div></section>` : ''}

  ${sec.links && (v.custom_links || []).length ? `<section class="sec">${H('ri-links-line', L.links)}<div class="links">${v.custom_links.map((l) => `<a href="${url(l.url)}" target="_blank" rel="noopener"><span>${esc(l.label)}</span><i class="ri-arrow-right-up-line"></i></a>`).join('')}</div></section>` : ''}

  ${sec.services && services.length ? `<section class="sec">${H('ri-briefcase-4-line', L.services)}<div class="box svc">${services.map((x) => `<div class="item">${x.image ? `<img src="${url(x.image)}" alt="" loading="lazy">` : '<span class="ic" aria-hidden="true"><i class="ri-star-line"></i></span>'}<div><b>${esc(x.name)}</b>${x.description ? `<p>${esc(x.description)}</p>` : ''}${x.service_url ? `<a class="more" href="${url(x.service_url)}" target="_blank" rel="noopener">${L.readmore} &rarr;</a>` : ''}${v.enable_enquiry_form ? ` <a class="more" href="#enq" data-enq="${esc(x.name)}">${L.enquire}</a>` : ''}</div></div>`).join('')}</div></section>` : ''}

  ${productsHtml}

  ${apptOn ? `<section class="sec" id="appt-sec">${H('ri-calendar-event-line', L.appointment)}<div class="box appt" id="appt">
    ${appt.paid && appt.price ? `<p class="price"><i class="ri-price-tag-3-line"></i> ${esc(appt.price)} · ${appt.duration || 30} min</p>` : `<p class="price"><i class="ri-time-line"></i> ${appt.duration || 30} min</p>`}
    <div class="days" id="days"></div><div class="slots" id="slots"></div>
    <form class="enq" id="book" novalidate style="display:none">
      ${appt.by_service && services.length ? `<select name="service_name" style="width:100%;padding:12px 14px;border-radius:12px;border:1px solid var(--line);background:var(--bg);color:var(--tx);font-family:inherit"><option value="">${L.service}</option>${services.map((x) => `<option>${esc(x.name)}</option>`).join('')}</select>` : ''}
      <input name="name" placeholder="${L.name}" maxlength="120" required><input name="email" type="email" placeholder="${L.email}" maxlength="191"><input name="phone" placeholder="${L.phone}" maxlength="30">
      <textarea name="notes" rows="2" placeholder="${L.message}" maxlength="1000"></textarea>
      <button class="btn" type="submit"><i class="ri-calendar-check-line"></i>${L.book}</button><div class="msg" id="book-msg"></div>
    </form></div></section>` : ''}

  ${galleryHtml}

  ${sec.testimonials && testimonials.length ? `<section class="sec">${H('ri-chat-quote-line', L.testimonials)}<div class="tst">${testimonials.map((t) => `<div class="box"><p class="q">&ldquo;${esc(t.description)}&rdquo;</p><div class="who">${t.image ? `<img src="${url(t.image)}" alt="" loading="lazy">` : ''}${esc(t.name)}</div></div>`).join('')}</div></section>` : ''}

  ${sec.payments && (v.payment_links || []).length ? `<section class="sec">${H('ri-wallet-3-line', L.payments)}<div class="pays">${v.payment_links.map((l) => `<a href="${url(l.url)}" target="_blank" rel="noopener"><i class="${PAY_ICONS[l.type] || PAY_ICONS.link}"></i>${esc(l.label)}</a>`).join('')}</div></section>` : ''}

  ${sec.blog && blogs.length ? `<section class="sec">${H('ri-article-line', L.blog)}<div class="posts">${blogs.map((b) => `<a class="post" href="/${alias}/blog/${esc(b.slug)}">${b.image ? `<img src="${url(b.image)}" alt="" loading="lazy">` : ''}<div><b>${esc(b.title)}</b><small>${esc(String(b.created_at).slice(0, 10))} · ${L.readmore}</small></div></a>`).join('')}</div></section>` : ''}

  ${embeds.length ? `<section class="sec">${H('ri-play-circle-line', L.videos)}<div style="display:grid;gap:12px">${embeds.join('')}</div></section>` : ''}

  ${sec.map && v.location_embed && /^https:\/\/(www\.)?google\.[a-z.]+\/maps\/embed/.test(v.location_embed) ? `<section class="sec">${H('ri-map-2-line', L.location)}<div class="embed"><iframe src="${url(v.location_embed)}" height="260" loading="lazy" referrerpolicy="no-referrer-when-downgrade" title="map"></iframe></div></section>` : ''}

  ${sec.hours && hasHours ? `<section class="sec">${H('ri-time-line', L.hours)}<div class="box hours">${days.map(([d, label]) => `<div class="d${d === today ? ' today' : ''}"><span>${label}</span><span>${hours[d]?.open ? `${esc(hours[d].from)} - ${esc(hours[d].to)}` : L.closed}</span></div>`).join('')}</div></section>` : ''}

  ${sec.qr && v.show_qr_code ? `<section class="sec">${H('ri-qr-code-line', L.qr)}<div class="box qr"><img src="/${alias}/qr.png" alt="QR code" loading="lazy" width="120" height="120"><div><p>${L.scan}</p><a class="btn" style="margin-top:10px" href="/${alias}/qr.png" download="${alias}-qr.png"><i class="ri-download-line"></i>${L.download}</a></div></div></section>` : ''}

  ${sec.enquiry && v.enable_enquiry_form ? `<section class="sec" id="enq-sec">${H('ri-mail-send-line', L.touch)}<div class="box"><form class="enq" id="enq" novalidate>
    <input name="name" placeholder="${L.name}" maxlength="120" required>
    <input name="email" type="email" placeholder="${L.email}" maxlength="191">
    <input name="phone" placeholder="${L.phone}" maxlength="30">
    <input name="product_name" id="enq-about" type="hidden">
    <textarea name="message" rows="3" placeholder="${L.message}" maxlength="2000" required></textarea>
    ${v.enquiry_attachment ? `<label style="font-size:13px;color:var(--muted)">${L.attach}<input name="attachment" type="file" accept="image/*,application/pdf" style="margin-top:6px"></label>` : ''}
    <input name="website" tabindex="-1" autocomplete="off" style="position:absolute;left:-9999px" aria-hidden="true">
    <button class="btn" type="submit"><i class="ri-send-plane-line"></i>${L.send}</button><div class="msg" id="enq-msg"></div>
  </form></div></section>` : ''}

  ${footer(v, app, appUrl, L, pages)}
  ${v.sticky_bar !== false ? '<div style="height:70px"></div>' : ''}
</main>

${v.sticky_bar !== false ? `<nav class="sticky" aria-label="Quick actions">${phone ? `<a href="tel:${esc(phone)}" aria-label="${L.call}"><i class="ri-phone-fill"></i></a>` : ''}${wa ? `<a href="${url(wa)}" target="_blank" rel="noopener" aria-label="WhatsApp"><i class="ri-whatsapp-fill"></i></a>` : ''}<a class="main" href="/${alias}/contact.vcf" data-save aria-label="${L.save}"><i class="ri-user-add-fill"></i></a>${v.email ? `<a href="mailto:${esc(v.email)}" aria-label="${L.email}"><i class="ri-mail-fill"></i></a>` : ''}<button type="button" data-share aria-label="${L.share}"><i class="ri-share-forward-fill"></i></button></nav>` : ''}

<div class="lb" id="lb"><button class="x" type="button" aria-label="Close">&times;</button><div id="lbc"></div></div>
${v.ask_before_contact ? `<div class="modal" id="askm"><div class="sheet"><h4>${L.save}</h4><p>${L.details}</p><form id="ask"><input name="name" placeholder="${L.name}" required maxlength="120"><input name="email" type="email" placeholder="${L.email}" maxlength="191"><input name="phone" placeholder="${L.phone}" maxlength="30"><button class="btn" type="submit">${L.continue}</button></form></div></div>` : ''}
${v.newsletter_popup ? `<div class="modal" id="nlm"><div class="sheet"><h4>${L.newsletter}</h4><p>${L.newsletter_text}</p><form id="nl"><input name="email" type="email" placeholder="${L.email}" required maxlength="191"><button class="btn" type="submit">${L.subscribe}</button><div class="msg" id="nl-msg"></div></form></div></div>` : ''}
<div class="toast" id="toast"></div>
<script nonce="${nonce}">
(function(){
  var A=${js(v.url_alias)},API='/api/public/vcards/'+encodeURIComponent(A);
  var $=function(s){return document.querySelector(s)},$$=function(s){return Array.prototype.slice.call(document.querySelectorAll(s))};
  var t=$('#toast');function toast(m){t.textContent=m;t.classList.add('show');setTimeout(function(){t.classList.remove('show')},2400)}
  function post(u,body,isForm){return fetch(u,{method:'POST',headers:isForm?{'X-Requested-With':'XMLHttpRequest'}:{'Content-Type':'application/json','X-Requested-With':'XMLHttpRequest'},body:isForm?body:JSON.stringify(body)}).then(function(r){return r.json().then(function(j){return{ok:r.ok,j:j}})})}
  function share(){var d={title:${js(fullName)},url:${js(link)}};if(navigator.share){navigator.share(d).catch(function(){})}else if(navigator.clipboard){navigator.clipboard.writeText(d.url).then(function(){toast('Link copied')})}}
  $('#share').addEventListener('click',share);$$('[data-share]').forEach(function(b){b.addEventListener('click',share)});
  var cv=$('#cv'),mu=$('#mute');if(cv&&mu)mu.addEventListener('click',function(){cv.muted=!cv.muted;mu.innerHTML=cv.muted?'<i class="ri-volume-mute-line"></i>':'<i class="ri-volume-up-line"></i>'});
  /* lightbox */
  var lb=$('#lb'),lbc=$('#lbc');function openLb(h){lbc.innerHTML=h;lb.classList.add('show')}
  lb.addEventListener('click',function(e){if(e.target===lb||e.target.classList.contains('x')){lb.classList.remove('show');lbc.innerHTML=''}});
  $$('[data-lb]').forEach(function(a){a.addEventListener('click',function(e){e.preventDefault();var i=document.createElement('img');i.src=a.getAttribute('data-lb');lbc.innerHTML='';lbc.appendChild(i);lb.classList.add('show')})});
  $$('[data-yt]').forEach(function(a){a.addEventListener('click',function(e){e.preventDefault();var id=a.getAttribute('data-yt');if(!/^[\\w-]{11}$/.test(id))return;openLb('<iframe src="https://www.youtube-nocookie.com/embed/'+id+'?autoplay=1" allow="autoplay; encrypted-media; fullscreen" allowfullscreen></iframe>')})});
  $$('#gcats button').forEach(function(b){b.addEventListener('click',function(){$$('#gcats button').forEach(function(x){x.classList.remove('on')});b.classList.add('on');var c=b.getAttribute('data-cat');$$('#gal a').forEach(function(a){a.style.display=!c||a.getAttribute('data-cat')===c?'':'none'})})});
  /* enquiry */
  var f=$('#enq');
  $$('[data-enq]').forEach(function(b){b.addEventListener('click',function(e){e.preventDefault();if(!f)return;$('#enq-about').value=b.getAttribute('data-enq');var m=f.querySelector('textarea');if(!m.value)m.value=b.getAttribute('data-enq')+': ';f.scrollIntoView({behavior:'smooth',block:'center'});m.focus()})});
  if(f)f.addEventListener('submit',function(e){e.preventDefault();var m=$('#enq-msg'),b=f.querySelector('button');var fd=new FormData(f);
    if(!fd.get('name')||!fd.get('message')){m.textContent='Please fill in your name and message.';return}b.disabled=true;
    post(API+'/enquiry',fd,true).then(function(x){m.textContent=x.j.message||'';if(x.ok)f.reset()}).catch(function(){m.textContent='Could not send, please try again.'}).finally(function(){b.disabled=false})});
  /* ask details before saving contact */
  var askm=$('#askm');if(askm){var go=function(e){e.preventDefault();askm.classList.add('show')};$('#save').addEventListener('click',go);$$('[data-save]').forEach(function(a){a.addEventListener('click',go)});
    askm.addEventListener('click',function(e){if(e.target===askm)askm.classList.remove('show')});
    $('#ask').addEventListener('submit',function(e){e.preventDefault();var d=Object.fromEntries(new FormData(e.target));d.message='Downloaded the contact card';post(API+'/enquiry',d).finally(function(){askm.classList.remove('show');location.href='/'+A+'/contact.vcf'})})}
  /* newsletter popup */
  var nlm=$('#nlm');if(nlm){try{if(!sessionStorage.getItem('nl_'+A))setTimeout(function(){nlm.classList.add('show');sessionStorage.setItem('nl_'+A,'1')},8000)}catch(e){}
    nlm.addEventListener('click',function(e){if(e.target===nlm)nlm.classList.remove('show')});
    $('#nl').addEventListener('submit',function(e){e.preventDefault();post(API+'/subscribe',Object.fromEntries(new FormData(e.target))).then(function(x){$('#nl-msg').textContent=x.j.message||'';if(x.ok)setTimeout(function(){nlm.classList.remove('show')},1200)})})}
  /* appointments */
  var ap=$('#appt');if(ap){var sel={date:null,slot:null},days=$('#days'),slots=$('#slots'),book=$('#book'),W=['sun','mon','tue','wed','thu','fri','sat'],AV=${js(Object.fromEntries(Object.entries(appt.slots || {}).map(([d, x]) => [d, (x || []).length > 0])))},BL=${js(appt.blocked || [])};
    for(var i=0;i<21;i++){(function(i){var d=new Date();d.setDate(d.getDate()+i);var iso=d.getFullYear()+'-'+('0'+(d.getMonth()+1)).slice(-2)+'-'+('0'+d.getDate()).slice(-2);var b=document.createElement('button');b.type='button';b.className='day';b.innerHTML='<small>'+d.toLocaleDateString(undefined,{weekday:'short'})+'</small><b>'+d.getDate()+'</b>';b.disabled=!AV[W[d.getDay()]]||BL.indexOf(iso)>-1;
      b.addEventListener('click',function(){$$('.day').forEach(function(x){x.classList.remove('on')});b.classList.add('on');sel.date=iso;sel.slot=null;book.style.display='none';slots.innerHTML='...';
        fetch(API+'/slots?date='+iso).then(function(r){return r.json()}).then(function(j){slots.innerHTML='';if(!j.data||!j.data.length){slots.textContent=${js(L.noslots)};return}
          j.data.forEach(function(s){var sb=document.createElement('button');sb.type='button';sb.className='slot';sb.textContent=s.from+' - '+s.to;sb.addEventListener('click',function(){$$('.slot').forEach(function(x){x.classList.remove('on')});sb.classList.add('on');sel.slot=s;book.style.display='grid'});slots.appendChild(sb)})})});days.appendChild(b)})(i)}
    book.addEventListener('submit',function(e){e.preventDefault();var d=Object.fromEntries(new FormData(book));if(!d.name||!sel.slot)return;d.date=sel.date;d.from_time=sel.slot.from;d.to_time=sel.slot.to;var bt=book.querySelector('button');bt.disabled=true;
      post(API+'/appointments',d).then(function(x){$('#book-msg').textContent=x.j.message||'';if(x.ok){book.reset();book.style.display='none';slots.innerHTML=''}}).finally(function(){bt.disabled=false})})}
  /* PWA */
  ${v.pwa_enable ? `if('serviceWorker' in navigator)navigator.serviceWorker.register('/sw.js').catch(function(){});var dp,ib=$('#install');window.addEventListener('beforeinstallprompt',function(e){e.preventDefault();dp=e;if(ib)ib.style.display='flex'});if(ib)ib.addEventListener('click',function(){if(!dp)return;dp.prompt();dp.userChoice.finally(function(){ib.style.display='none';dp=null})});window.addEventListener('appinstalled',function(){if(ib)ib.style.display='none'});` : ''}
})();
</script>
</body>
</html>`;
  return html;
}

/** Sub pages of a vCard: blog post, custom page, terms, privacy */
function renderSubPage({ v, template, app, appUrl, nonce, title, bodyHtml, image, date }) {
  const th = themeOf(v, template, app);
  const link = `${appUrl}/${v.url_alias}`;
  return `<!doctype html>
<html lang="${esc(th.lang)}" dir="${th.dir}"><head>
${headTags({ v, th, title: `${title} - ${[v.first_name, v.last_name].filter(Boolean).join(' ') || v.name}`, desc: v.meta_description || v.description, link, appUrl, nonce })}
</head><body><main class="wrap l-${th.layout} ${th.dark ? 'is-dark' : 'is-light'}">
<div class="page-body"><a class="backlink" href="/${esc(v.url_alias)}"><i class="ri-arrow-left-line"></i>${th.L.back}</a>
${image ? `<img src="${url(image)}" alt="" style="width:100%;aspect-ratio:16/9;object-fit:cover;border-radius:18px;margin-top:16px">` : ''}
<h1>${esc(title)}</h1>${date ? `<p style="color:var(--muted);font-size:13px;margin:-8px 0 16px">${esc(String(date).slice(0, 10))}</p>` : ''}
<div class="content">${bodyHtml}</div></div>
${footer(v, app, appUrl, th.L, [])}
</main></body></html>`;
}

function renderLocked({ v, app, error, nonce }) {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(v.name)}</title>
<meta name="robots" content="noindex"><link rel="icon" href="${url(app.favicon)}">
<style nonce="${nonce}">*{box-sizing:border-box}body{font-family:system-ui,-apple-system,'Segoe UI',sans-serif;margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px;color:#101828;background:radial-gradient(60% 50% at 10% 0%,rgba(109,93,252,.22),transparent 70%),radial-gradient(50% 50% at 100% 100%,rgba(236,72,153,.16),transparent 70%),#f3f4f8}
form{background:rgba(255,255,255,.9);backdrop-filter:blur(12px);padding:34px 28px 28px;border-radius:28px;box-shadow:0 0 0 1px rgba(16,24,40,.06),0 40px 80px -30px rgba(16,24,40,.35);width:min(380px,100%);text-align:center;animation:up .6s cubic-bezier(.16,1,.3,1) both}
.lk{width:60px;height:60px;margin:0 auto 16px;border-radius:20px;display:grid;place-items:center;background:linear-gradient(135deg,#6d5dfc,#ec4899);box-shadow:0 14px 30px -12px #6d5dfc}.lk svg{width:26px;height:26px}
h1{font-size:21px;margin:0 0 6px;letter-spacing:-.02em}p{color:#667085;margin:0 0 22px;font-size:14px}
input{width:100%;padding:14px 16px;border:1px solid #e4e7ec;border-radius:14px;font-size:15px;background:#fff;transition:border-color .2s,box-shadow .2s}input:focus{outline:0;border-color:#6d5dfc;box-shadow:0 0 0 4px rgba(109,93,252,.15)}
button{margin-top:12px;width:100%;height:50px;border:0;border-radius:999px;background:#6d5dfc;color:#fff;font-weight:600;font-size:15px;cursor:pointer;box-shadow:0 14px 28px -14px #6d5dfc;transition:transform .2s}button:hover{transform:translateY(-1px)}
.e{color:#d92d20;font-size:13px;margin-top:10px}@keyframes up{from{opacity:0;transform:translateY(16px)}}@media (prefers-reduced-motion:reduce){form{animation:none}}</style></head>
<body><form method="post" action="/${esc(v.url_alias)}/unlock"><div class="lk" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="11" width="16" height="10" rx="2.5"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg></div><h1>${esc(v.name)}</h1><p>This vCard is password protected.</p>
<input type="password" name="password" placeholder="Password" required autofocus><button type="submit">Unlock</button>${error ? `<div class="e">${esc(error)}</div>` : ''}</form></body></html>`;
}

/** plan expired / visitor limit reached */
function renderUnavailable({ v, app, reason }) {
  const L = labelsFor(v.default_language || 'en');
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(v.name)}</title><meta name="robots" content="noindex"><link rel="icon" href="${url(app.favicon)}">
<style>body{font-family:system-ui,-apple-system,'Segoe UI',sans-serif;color:#e7e7f3;display:grid;place-items:center;min-height:100vh;margin:0;text-align:center;padding:20px;background:radial-gradient(60% 50% at 50% 0%,rgba(109,93,252,.28),transparent 70%),#0b0b14}div{max-width:380px;padding:34px 28px;border-radius:28px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08)}b{display:block;font-size:22px;margin-bottom:8px;letter-spacing:-.02em}p{color:#9a9ab5;margin:0;line-height:1.55}</style></head>
<body><div><b>${esc(v.name)}</b><p>${esc(reason || L.unavailable)}</p></div></body></html>`;
}

function manifest(v, app) {
  const name = [v.first_name, v.last_name].filter(Boolean).join(' ') || v.name;
  const icon = v.profile_image || '/brand/logo-mark.svg';
  return {
    name, short_name: name.slice(0, 12), start_url: `/${v.url_alias}`, scope: `/${v.url_alias}`, display: 'standalone',
    background_color: color(v.theme?.background, '#ffffff'), theme_color: color(v.theme?.primary, '#6d5dfc'),
    icons: [{ src: icon, sizes: '512x512', type: icon.endsWith('.svg') ? 'image/svg+xml' : icon.endsWith('.png') ? 'image/png' : 'image/jpeg', purpose: 'any' }], description: v.occupation || app.app_name,
  };
}

module.exports = { render, renderSubPage, renderLocked, renderUnavailable, manifest, vcardFile, vcardCsp, SOCIAL, DAYS };
