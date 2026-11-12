/*
 * Signature collection: designs with their OWN page structure (not a skin over the classic cover/avatar/buttons page).
 * Each "archetype" builds its own header markup and decides how the content sections are presented:
 *
 *   card      a physical 3D card that tilts with the pointer and flips on tap
 *   sheet     full-screen portrait, content in a bottom sheet with sliding tabs and a floating dock
 *   bento     a tile grid: photo, name, save, actions, location, hours and socials are all tiles
 *   editorial magazine cover: stacked display name, ticker, numbered index, snap carousels
 *   pass      a wallet pass with a tear-off stub; sections are a stack of folding passes
 *   orbit     a HUD: social icons orbit the photo, control pads, cut-corner glass panels
 *
 * The section blocks themselves (forms, booking, gallery, ...) come from render.js, so every feature keeps working.
 * All user text is escaped here exactly as in render.js; URLs go through url().
 */
const { esc, url } = require('../../utils/html');

// layout name -> archetype
const ARCH = { sxcard: 'card', sxsheet: 'sheet', sxbento: 'bento', sxeditorial: 'editorial', sxpass: 'pass', sxorbit: 'orbit' };

// more designs live in their own files; each exports { designs: { layout: (kit) => ({ main, dock?, script? }) }, CSS }
const PACKS = [require('./signature2'), require('./signature3'), require('./signature4')];
const EXTRA = Object.assign({}, ...PACKS.map((p) => p.designs));
for (const k of Object.keys(EXTRA)) ARCH[k] = k;

const TABS = [
  ['about', ['about', 'hours', 'testimonials', 'embeds', 'blog']],
  ['services', ['services', 'products', 'menu', 'gallery', 'appointments', 'payments']],
  ['contact', ['contact', 'social', 'links', 'map', 'qr', 'enquiry']],
];

function build(c) {
  const { v, L, alias, fullName, initials, phone, wa, mapHref, socials, SOCIAL, BRAND, blocks, order, HEAD, hasHours, todayHours, t12, install } = c;
  const arch = ARCH[c.layout];
  const acts = [
    phone && { href: `tel:${esc(phone)}`, icon: 'ri-phone-fill', label: L.call, sub: phone },
    v.email && { href: `mailto:${esc(v.email)}`, icon: 'ri-mail-fill', label: L.email, sub: v.email },
    wa && { href: url(wa), icon: 'ri-whatsapp-fill', label: L.whatsapp, sub: (String(wa).match(/\d{7,}/) || [''])[0] ? `+${String(wa).match(/\d{7,}/)[0]}` : '', ext: true },
    mapHref && { href: url(mapHref), icon: 'ri-map-pin-2-fill', label: L.directions, sub: v.location, ext: true },
  ].filter(Boolean);
  const A = (a, cls, inner) => `<a class="x-a ${cls}" href="${a.href}"${a.ext ? ' target="_blank" rel="noopener"' : ''} aria-label="${a.label}">${inner}</a>`;
  const share = (cls, inner) => `<button class="x-a ${cls}" type="button" id="share" aria-label="${L.share}">${inner}</button>`;
  const save = (cls, inner) => `<a class="save ${cls}" id="save" href="/${alias}/contact.vcf">${inner}</a>`;
  const avatar = (cls = '') => (v.profile_image
    ? `<img class="avatar ${cls}" src="${url(v.profile_image)}" alt="${esc(fullName)}" width="400" height="400" fetchpriority="high">`
    : `<div class="avatar ph ${cls}" aria-hidden="true">${esc(initials)}</div>`);
  const verified = v.is_verified ? '<i class="ri-checkbox-circle-fill" title="Verified"></i>' : '';
  const role = v.job_title || v.occupation;
  const roleP = role ? `<p class="role">${esc(role)}</p>` : '';
  const [first, ...restName] = fullName.split(/\s+/);
  const stacked = `${esc(first)}${restName.length ? `<br>${esc(restName.join(' '))}` : ''}`;
  const hoursText = hasHours ? (todayHours?.open ? `${L.open || 'Open'} ${t12(todayHours.from)} - ${t12(todayHours.to)}` : (L.closed || 'Closed')) : '';
  const sections = (keys) => order.filter((k) => blocks[k] && (!keys || keys.includes(k))).map((k) => blocks[k]).join('\n');
  const socialLinks = (cls, max = 99) => socials.slice(0, max).map(([k, u], i) => `<a class="${cls}" href="${url(u)}" target="_blank" rel="noopener" aria-label="${SOCIAL[k][1]}" title="${SOCIAL[k][1]}" style="--i:${i};--bc:${BRAND[k] || '#888'}"><i class="${SOCIAL[k][0]}"></i></a>`).join('');

  if (EXTRA[c.layout]) {
    const sentence = String(v.description || '').split(/(?<=[.!?])\s/)[0].slice(0, 150);
    return { dock: '', script: '', ...EXTRA[c.layout]({ ...c, acts, A, share, save, avatar, verified, role, roleP, first, rest: restName.join(' '), stacked, hoursText, sections, socialLinks, sentence, esc, url }) };
  }

  /* ---------------------------------------------------------------- card */
  if (arch === 'card') {
    const site = v.social_links?.website ? String(v.social_links.website).replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '') : '';
    const lines = [phone && ['ri-phone-line', phone], v.email && ['ri-mail-line', v.email], site && ['ri-global-line', site], v.location && ['ri-map-pin-line', v.location]].filter(Boolean).slice(0, 4);
    return {
      main: `<header class="x-stage">
    <div class="x-card" role="button" tabindex="0" aria-pressed="false" aria-label="${esc(fullName)}">
      <div class="x-face x-front">
        <div class="x-top"><span class="x-mono">${esc(initials)}</span><i class="ri-wifi-line x-nfc" aria-hidden="true"></i></div>
        <span class="x-chip" aria-hidden="true"></span>
        <div class="x-cid"><h1 class="name">${esc(fullName)}${verified}</h1>${roleP}${v.company ? `<p class="x-co x-meta">${esc(v.company)}</p>` : ''}</div>
      </div>
      <div class="x-face x-back" aria-hidden="true">
        <div class="x-strip"></div>
        <div class="x-bl">${lines.map(([i, t]) => `<p><i class="${i}"></i><span>${esc(t)}</span></p>`).join('')}</div>
        ${v.show_qr_code ? `<img class="x-qr" src="/${alias}/qr.png" alt="" loading="lazy" width="92" height="92">` : `<span class="x-mono x-big">${esc(initials)}</span>`}
      </div>
    </div>
    <p class="x-hint"><i class="ri-refresh-line"></i>Tap the card</p>
  </header>
  <div class="x-under">
    ${v.profile_image ? `<div class="x-av">${avatar()}</div>` : ''}
    <nav class="x-acts x-actions" aria-label="Contact">${acts.map((a) => A(a, 'x-circ', `<i class="${a.icon}"></i><span>${a.label}</span>`)).join('')}${share('x-circ', `<i class="ri-share-forward-fill"></i><span>${L.share}</span>`)}</nav>
    ${save('x-foil', `<i class="ri-user-add-line"></i><span>${L.save}</span>`)}
    ${install}
  </div>
  ${sections()}`,
      dock: '',
      script: "var xc=$('.x-card');if(xc){var xs=xc.parentNode;xs.addEventListener('pointermove',function(e){if(e.pointerType==='touch')return;var r=xc.getBoundingClientRect(),x=(e.clientX-r.left)/r.width-.5,y=(e.clientY-r.top)/r.height-.5;xc.classList.add('tilting');xc.style.setProperty('--ry',(x*20)+'deg');xc.style.setProperty('--rx',(-y*16)+'deg');xc.style.setProperty('--mx',x*2)});xs.addEventListener('pointerleave',function(){xc.classList.remove('tilting');xc.style.setProperty('--ry','0deg');xc.style.setProperty('--rx','0deg');xc.style.setProperty('--mx',0)});var xf=function(){var on=xc.classList.toggle('flipped');xc.setAttribute('aria-pressed',on)};xc.addEventListener('click',xf);xc.addEventListener('keydown',function(e){if(e.key==='Enter'||e.key===' '){e.preventDefault();xf()}})}",
    };
  }

  /* ---------------------------------------------------------------- sheet */
  if (arch === 'sheet') {
    const labels = { about: L.about, services: L.services, contact: L.contact };
    const tabs = TABS.map(([k, keys]) => [k, sections(keys)]).filter(([, html]) => html);
    return {
      main: `<header class="x-hero">
    <div class="x-photo">${avatar()}</div>
    <div class="x-bar">${v.company ? `<span class="x-brand x-meta"><i class="ri-building-line"></i>${esc(v.company)}</span>` : '<span></span>'}${share('x-round', '<i class="ri-share-forward-line"></i>')}</div>
    <div class="x-title">${roleP}<h1 class="name">${stacked}${verified}</h1>
      ${v.location || hoursText ? `<div class="x-chips x-meta">${v.location ? `<span><i class="ri-map-pin-line"></i>${esc(v.location)}</span>` : ''}${hoursText ? `<span><i class="ri-time-line"></i>${hoursText}</span>` : ''}</div>` : ''}</div>
    <span class="x-cue" aria-hidden="true"><i class="ri-arrow-down-s-line"></i></span>
  </header>
  <div class="x-sheet">
    <span class="x-grab" aria-hidden="true"></span>
    ${tabs.length > 1 ? `<nav class="x-tabs" role="tablist">${tabs.map(([k], i) => `<button type="button" role="tab" data-tab="${i}" aria-selected="${i === 0}"${i === 0 ? ' class="on"' : ''}>${labels[k]}</button>`).join('')}<span class="x-ind" aria-hidden="true"></span></nav>` : ''}
    ${tabs.map(([, html], i) => `<div class="x-panel${i === 0 ? ' on' : ''}" data-panel="${i}" role="tabpanel">${html}</div>`).join('\n')}
    ${install}
  </div>`,
      dock: `<nav class="x-dock${v.sticky_bar === false ? ' x-static' : ''}" aria-label="Quick actions">${save('', `<i class="ri-user-add-fill"></i><span>${L.save}</span>`)}<span class="x-actions">${acts.slice(0, 3).map((a) => A(a, 'x-round', `<i class="${a.icon}"></i>`)).join('')}</span></nav>`,
      script: "var xb=$$('.x-tabs [data-tab]');function xt(i){xb.forEach(function(b){var on=b.getAttribute('data-tab')==i;b.classList.toggle('on',on);b.setAttribute('aria-selected',on);if(on){var d=$('.x-ind');if(d){d.style.width=b.offsetWidth+'px';d.style.transform='translateX('+b.offsetLeft+'px)'}}});$$('[data-panel]').forEach(function(p){p.classList.toggle('on',p.getAttribute('data-panel')==i)})}xb.forEach(function(b){b.addEventListener('click',function(){xt(b.getAttribute('data-tab'))})});if(xb.length){xt(0);window.addEventListener('resize',function(){var o=$('.x-tabs .on');if(o)xt(o.getAttribute('data-tab'))});if(document.fonts&&document.fonts.ready)document.fonts.ready.then(function(){var o=$('.x-tabs .on');if(o)xt(o.getAttribute('data-tab'))})}$$('[data-enq]').forEach(function(b){b.addEventListener('click',function(){var f=$('#enq'),p=f&&f.closest('[data-panel]');if(p)xt(p.getAttribute('data-panel'))})});",
    };
  }

  /* ---------------------------------------------------------------- bento */
  if (arch === 'bento') {
    return {
      main: `<div class="x-bento">
    <div class="x-t x-ph">${avatar()}</div>
    <div class="x-t x-idt">${share('x-sh', '<i class="ri-share-forward-line"></i>')}<h1 class="name">${stacked}${verified}</h1>${roleP}${v.company ? `<span class="x-co x-meta"><i class="ri-building-line"></i>${esc(v.company)}</span>` : ''}</div>
    ${save('x-t x-sv', `<span>${L.save}</span><i class="ri-arrow-right-up-line"></i>`)}
    ${acts.length ? `<nav class="x-row x-actions" aria-label="Contact">${acts.map((a) => A(a, 'x-t x-act', `<i class="${a.icon}"></i><span>${a.label}</span>`)).join('')}</nav>` : ''}
    ${v.location || hoursText ? `<div class="x-row x-meta">${v.location ? `<a class="x-t x-loc" href="${url(mapHref)}" target="_blank" rel="noopener"><i class="ri-map-pin-2-fill"></i><span>${esc(v.location)}</span></a>` : ''}${hoursText ? `<div class="x-t x-hrs${todayHours?.open ? ' is-open' : ''}"><span class="x-dot" aria-hidden="true"></span><span>${hoursText}</span></div>` : ''}</div>` : ''}
    ${c.sec.social && socials.length ? `<div class="x-socs">${socialLinks('x-t x-soc')}</div>` : ''}
    ${install}
  </div>
  ${sections(order.filter((k) => k !== 'social'))}`,
      dock: '', script: '',
    };
  }

  /* ---------------------------------------------------------------- editorial */
  if (arch === 'editorial') {
    const tick = (c.services.length ? c.services.map((s) => s.name) : [role, v.company, v.location]).filter(Boolean).slice(0, 8);
    const run = tick.map((t) => `<span>${esc(t)}</span>`).join('<i>&#10022;</i>');
    return {
      main: `<header class="x-mast">
    <div class="x-rule x-meta"><span>${esc(v.company || 'Profile')}</span>${v.location ? `<span>${esc(v.location)}</span>` : ''}${share('x-shr', `${L.share}<i class="ri-arrow-right-up-line"></i>`)}</div>
    <div class="x-cover"><h1 class="name">${stacked}${verified}</h1><div class="x-fig">${avatar()}</div></div>
    ${roleP}
  </header>
  ${tick.length ? `<div class="x-tick" aria-hidden="true"><div>${run}<i>&#10022;</i>${run}<i>&#10022;</i></div></div>` : ''}
  <nav class="x-index x-actions" aria-label="Contact">${acts.map((a, i) => A(a, 'x-ix', `<em>0${i + 1}</em><b>${a.label}</b><small>${esc(a.sub || '')}</small><i class="ri-arrow-right-line"></i>`)).join('')}</nav>
  ${save('x-bar', `<span>${L.save}</span><i class="ri-download-line"></i>`)}
  ${install}
  <div class="x-body">${sections()}</div>`,
      dock: '', script: '',
    };
  }

  /* ---------------------------------------------------------------- pass */
  if (arch === 'pass') {
    const fields = [phone && [L.phone, phone], v.email && [L.email, v.email], v.location && [L.location, v.location], hoursText && [L.hours, hoursText]].filter(Boolean).slice(0, 4);
    const folds = order.filter((k) => blocks[k]);
    return {
      main: `<section class="x-pass">
    <div class="x-phead"><span class="x-org"><i class="ri-building-line"></i>${esc(v.company || c.appName)}</span><i class="ri-wifi-line x-nfc" aria-hidden="true"></i></div>
    <div class="x-pmain">${avatar()}<div><h1 class="name">${esc(fullName)}${verified}</h1>${roleP}</div></div>
    ${fields.length ? `<dl class="x-fields x-meta">${fields.map(([l, val]) => `<div><dt>${l}</dt><dd>${esc(val)}</dd></div>`).join('')}</dl>` : ''}
    <div class="x-tear" aria-hidden="true"></div>
    <div class="x-stub"><span class="x-code" aria-hidden="true"></span>${save('', `<i class="ri-user-add-line"></i><span>${L.save}</span>`)}</div>
  </section>
  <nav class="x-quick x-actions" aria-label="Contact">${acts.map((a) => A(a, 'x-q', `<i class="${a.icon}"></i><span>${a.label}</span>`)).join('')}${share('x-q', `<i class="ri-share-forward-fill"></i><span>${L.share}</span>`)}</nav>
  ${install}
  <div class="x-stack">${folds.map((k, i) => `<details class="x-fold" name="x-fold"${i === 0 ? ' open' : ''}><summary><i class="${HEAD[k]?.icon || 'ri-file-list-line'}" aria-hidden="true"></i><span>${HEAD[k]?.text || ''}</span><i class="ri-arrow-down-s-line x-chev" aria-hidden="true"></i></summary>${blocks[k]}</details>`).join('\n')}</div>`,
      dock: '', script: '',
    };
  }

  /* ---------------------------------------------------------------- orbit */
  const sats = c.sec.social ? socials.slice(0, 8) : [];
  return {
    main: `<header class="x-hud">
    <div class="x-floor" aria-hidden="true"></div>
    <div class="x-orbit" style="--n:${sats.length || 1}">
      <span class="x-ring x-r1" aria-hidden="true"></span><span class="x-ring x-r2" aria-hidden="true"></span><span class="x-ring x-r3" aria-hidden="true"></span>
      ${avatar()}
      ${sats.length ? `<div class="x-sats">${socialLinks('x-sat', 8)}</div>` : ''}
    </div>
    <h1 class="name">${esc(fullName)}${verified}</h1>${roleP}
    ${v.company || v.location ? `<div class="x-tags x-meta">${v.company ? `<span><i class="ri-building-line"></i>${esc(v.company)}</span>` : ''}${v.location ? `<span><i class="ri-map-pin-line"></i>${esc(v.location)}</span>` : ''}</div>` : ''}
  </header>
  <nav class="x-pads x-actions" aria-label="Contact">${acts.map((a) => A(a, 'x-pad', `<i class="${a.icon}"></i><span><b>${a.label}</b><small>${esc(a.sub || '')}</small></span>`)).join('')}${share('x-pad', `<i class="ri-share-forward-fill"></i><span><b>${L.share}</b><small>${esc(c.link.replace(/^https?:\/\//, ''))}</small></span>`)}</nav>
  ${save('x-go', `<i class="ri-user-add-line"></i><span>${L.save}</span>`)}
  ${install}
  ${sections(order.filter((k) => k !== 'social' || socials.length > 8))}`,
    dock: '', script: '',
  };
}

const CSS = String.raw`
@property --flip{syntax:"<angle>";inherits:true;initial-value:0deg}
@keyframes x-float{from{transform:rotateX(3deg) rotateY(-9deg) translateY(0)}to{transform:rotateX(-2deg) rotateY(9deg) translateY(-8px)}}
@keyframes x-spin{to{transform:rotate(360deg)}}
@keyframes x-spin-r{to{transform:rotate(-360deg)}}
@keyframes x-tick{to{transform:translateX(-50%)}}
@keyframes x-in{from{opacity:0;transform:translateY(22px) scale(.97)}to{opacity:1;transform:none}}
@keyframes x-rise{from{transform:translateY(46px);opacity:0}to{transform:none;opacity:1}}
@keyframes x-ken{from{transform:scale(1.12)}to{transform:scale(1)}}
@keyframes x-par{to{transform:scale(1.16) translateY(54px);filter:brightness(.55)}}
@keyframes x-ping{0%{box-shadow:0 0 0 0 color-mix(in srgb,#22c55e 60%,transparent)}70%,100%{box-shadow:0 0 0 10px transparent}}
@keyframes x-cue{0%,100%{transform:translateY(0);opacity:.9}50%{transform:translateY(7px);opacity:.4}}
@keyframes x-floor{to{background-position:0 34px,0 0}}
@keyframes x-glow{from{opacity:.55}to{opacity:1}}

/* ================================================================== sxcard: a physical card you can tilt and flip */
.l-sxcard{--r:14px;--foil:linear-gradient(115deg,var(--p),var(--s) 38%,color-mix(in srgb,var(--p) 55%,#000) 62%,var(--s) 82%,var(--p))}
.l-sxcard .x-stage{position:relative;padding:64px 28px 14px;perspective:1100px;text-align:center;background:radial-gradient(64% 46% at 50% 36%,color-mix(in srgb,var(--p) 24%,transparent),transparent 72%)}
.l-sxcard .x-card{position:relative;z-index:1;width:100%;aspect-ratio:1.586;transform-style:preserve-3d;cursor:pointer;outline-offset:8px;animation:x-float 7s ease-in-out infinite alternate}
.l-sxcard .x-card.tilting,.l-sxcard .x-card.flipped{animation:none;transform:rotateX(var(--rx,0deg)) rotateY(calc(var(--ry,0deg) + var(--flip,0deg)));transition:transform .75s cubic-bezier(.2,.85,.25,1)}
.l-sxcard .x-card.tilting{transition:transform .09s linear}
.l-sxcard .x-card.flipped{--flip:180deg}
.l-sxcard .x-face{position:absolute;inset:0;border-radius:20px;overflow:hidden;-webkit-backface-visibility:hidden;backface-visibility:hidden;padding:22px 24px;display:flex;flex-direction:column;justify-content:space-between;text-align:start;background:linear-gradient(140deg,color-mix(in srgb,var(--tx) 12%,var(--bg)),var(--bg) 46%,color-mix(in srgb,var(--p) 14%,var(--bg)));box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--p) 55%,transparent),inset 0 1px 0 rgba(255,255,255,.22),0 2px 0 color-mix(in srgb,var(--p) 30%,#000),0 34px 50px -26px rgba(0,0,0,.9)}
.l-sxcard .x-face:before{content:"";position:absolute;inset:0;background:repeating-linear-gradient(100deg,rgba(255,255,255,.04) 0 1px,transparent 1px 3px);pointer-events:none}
.l-sxcard .x-face:after{content:"";position:absolute;inset:-60% -30%;background:linear-gradient(112deg,transparent 42%,rgba(255,255,255,.28) 50%,transparent 58%);transform:translateX(calc(var(--mx,0) * 55%));transition:transform .25s;mix-blend-mode:screen;pointer-events:none}
.l-sxcard .x-back{transform:rotateY(180deg);flex-direction:row;align-items:flex-end;gap:14px;padding-top:66px}
.l-sxcard .x-top{display:flex;justify-content:space-between;align-items:flex-start;position:relative}
.l-sxcard .x-mono{font-size:21px;font-weight:600;letter-spacing:.12em;background:var(--foil);-webkit-background-clip:text;background-clip:text;color:transparent}
.l-sxcard .x-big{font-size:54px;letter-spacing:.04em;line-height:1;align-self:center}
.l-sxcard .x-nfc{font-size:26px;color:var(--p);transform:rotate(90deg);opacity:.9}
.l-sxcard .x-chip{position:absolute;left:24px;top:40%;width:44px;height:33px;border-radius:7px;background:var(--foil);box-shadow:inset 0 0 0 1px rgba(0,0,0,.25)}
.l-sxcard .x-chip:before{content:"";position:absolute;inset:0;background:linear-gradient(90deg,transparent 31%,rgba(0,0,0,.35) 31% 34%,transparent 34% 66%,rgba(0,0,0,.35) 66% 69%,transparent 69%),linear-gradient(transparent 46%,rgba(0,0,0,.35) 46% 54%,transparent 54%)}
.l-sxcard .x-cid{position:relative}
@media(max-width:350px){.l-sxcard .x-chip{display:none}.l-sxcard .x-face{padding:16px 18px}}
.l-sxcard .name{display:block;text-align:start;font-size:clamp(21px,6.6vw,30px);font-weight:500;letter-spacing:.02em;line-height:1.1;animation:none}
.l-sxcard .name i{font-size:.6em;margin-inline-start:6px;color:var(--p);vertical-align:middle}
.l-sxcard .role{margin-top:5px;text-align:start;font-size:10.5px;letter-spacing:.3em;text-transform:uppercase;color:var(--p);font-weight:600}
.l-sxcard .x-co{margin-top:3px;font-size:12.5px;color:var(--muted)}
.l-sxcard .x-strip{position:absolute;inset:26px 0 auto;height:34px;background:#000;opacity:.85}
.l-sxcard .x-bl{flex:1;min-width:0;display:grid;gap:5px}
.l-sxcard .x-bl p{display:flex;align-items:center;gap:8px;font-size:12px;min-width:0}
.l-sxcard .x-bl i{color:var(--p);font-size:14px}
.l-sxcard .x-bl span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.l-sxcard .x-qr{width:84px;height:84px;border-radius:8px;background:#fff;padding:5px;flex:none}
.l-sxcard .x-hint{position:relative;z-index:1;margin-top:40px;font-size:10.5px;letter-spacing:.28em;text-transform:uppercase;color:var(--muted);display:inline-flex;align-items:center;gap:8px}
.l-sxcard .x-hint i{font-size:14px;color:var(--p)}
.l-sxcard .x-under{padding:18px 28px 0;text-align:center}
.l-sxcard .x-av{display:flex;justify-content:center;margin-bottom:22px}
.l-sxcard .avatar{width:76px;height:76px;border:1px solid color-mix(in srgb,var(--p) 60%,transparent);padding:4px;background:var(--bg);box-shadow:0 0 0 6px color-mix(in srgb,var(--p) 8%,transparent)}
.l-sxcard .x-acts{display:flex;justify-content:center;gap:14px;flex-wrap:wrap}
.l-sxcard .x-circ{display:grid;justify-items:center;gap:8px;background:none;border:0;font:inherit;color:var(--muted);font-size:10.5px;letter-spacing:.08em;text-transform:uppercase;cursor:pointer;animation:x-in .7s var(--ease) both}
.l-sxcard .x-circ:nth-child(2){animation-delay:.06s}.l-sxcard .x-circ:nth-child(3){animation-delay:.12s}.l-sxcard .x-circ:nth-child(4){animation-delay:.18s}.l-sxcard .x-circ:nth-child(5){animation-delay:.24s}
.l-sxcard .x-circ i{width:52px;height:52px;border-radius:50%;display:grid;place-items:center;font-size:20px;color:var(--p);border:1px solid color-mix(in srgb,var(--p) 50%,transparent);background:color-mix(in srgb,var(--p) 6%,transparent);transition:transform .35s var(--ease),background .25s,color .25s,box-shadow .3s}
.l-sxcard .x-circ:hover i{background:var(--p);color:var(--onp);transform:translateY(-4px);box-shadow:0 14px 24px -12px var(--p)}
.l-sxcard .x-circ:active i{transform:scale(.92)}
.l-sxcard .save{margin:26px 0 0;height:58px;border-radius:4px;background:var(--foil);background-size:220% 100%;color:var(--onp);letter-spacing:.26em;text-transform:uppercase;font-size:12px;box-shadow:0 22px 40px -22px var(--p);transition:background-position .9s var(--ease),transform .3s var(--ease)}
.l-sxcard .save:hover{background-position:100% 0}
.l-sxcard .save:after{display:none}
.l-sxcard .install{margin-inline:0;width:100%}
.l-sxcard .sec{padding:40px 28px 0}
.l-sxcard .sec h3{justify-content:center;color:var(--p);letter-spacing:.36em;font-size:10.5px;font-weight:600;margin:0 0 16px}
.l-sxcard .sec h3 i{display:none}
.l-sxcard .sec h3:before,.l-sxcard .sec h3:after{content:"";flex:1;height:1px;background:linear-gradient(90deg,transparent,color-mix(in srgb,var(--p) 60%,transparent))}
.l-sxcard .sec h3:after{transform:scaleX(-1)}
.l-sxcard .box,.l-sxcard .links a,.l-sxcard .social a,.l-sxcard .pays a,.l-sxcard .post,.l-sxcard .prod,.l-sxcard .embed{background:color-mix(in srgb,var(--p) 4%,transparent);border-color:color-mix(in srgb,var(--p) 22%,transparent);box-shadow:none}
.l-sxcard .about{text-align:center;font-size:16px}
.l-sxcard .row>i:not(.go),.l-sxcard .links a i,.l-sxcard .pays a i,.l-sxcard .svc .ic{background:transparent;border:1px solid color-mix(in srgb,var(--p) 40%,transparent);border-radius:50%}
.l-sxcard .social{display:flex;flex-wrap:wrap;justify-content:center}
.l-sxcard .social a{width:50px;border-radius:50%}

/* ================================================================== sxsheet: full-screen portrait, bottom sheet, sliding tabs, dock */
.l-sxsheet{--r:22px;overflow:clip;background:#000}
.l-sxsheet .x-hero{position:sticky;top:0;height:min(88vh,700px);min-height:460px;color:#fff;overflow:hidden}
@media(min-width:520px){.l-sxsheet .x-hero{border-radius:36px 36px 0 0}}
.l-sxsheet .x-photo{position:absolute;inset:0}
.l-sxsheet .x-photo:after{content:"";position:absolute;inset:0;background:linear-gradient(rgba(0,0,0,.34),transparent 26%,transparent 44%,rgba(0,0,0,.88))}
.l-sxsheet .avatar{width:100%;height:100%;border:0;border-radius:0;box-shadow:none;object-fit:cover;object-position:center 22%;animation:x-ken 1.6s var(--ease) both}
.l-sxsheet .avatar.ph{font-size:150px;background:linear-gradient(160deg,var(--p),var(--s))}
@supports (animation-timeline:scroll()){.l-sxsheet .x-photo{animation:x-par linear both;animation-timeline:scroll(root);animation-range:0 620px}}
.l-sxsheet .x-bar{position:absolute;inset:18px 18px auto;display:flex;justify-content:space-between;align-items:center;z-index:2}
.l-sxsheet .x-brand{display:inline-flex;align-items:center;gap:7px;padding:9px 15px;border-radius:999px;font-size:13px;font-weight:600;background:rgba(255,255,255,.16);backdrop-filter:blur(14px) saturate(1.5);-webkit-backdrop-filter:blur(14px) saturate(1.5);border:1px solid rgba(255,255,255,.22)}
.l-sxsheet .x-round{width:46px;height:46px;flex:none;border-radius:50%;display:grid;place-items:center;font-size:19px;color:inherit;cursor:pointer;background:rgba(255,255,255,.16);backdrop-filter:blur(14px) saturate(1.5);-webkit-backdrop-filter:blur(14px) saturate(1.5);border:1px solid rgba(255,255,255,.22);transition:transform .3s var(--ease),background .25s}
.l-sxsheet .x-round:hover{transform:scale(1.08);background:rgba(255,255,255,.3)}
.l-sxsheet .x-title{position:absolute;inset:auto 24px 74px;z-index:2}
.l-sxsheet .role{color:rgba(255,255,255,.86);font-size:12px;letter-spacing:.26em;text-transform:uppercase;font-weight:600;margin:0 0 12px;text-align:start;animation:x-rise .8s .25s var(--ease) both}
.l-sxsheet .name{display:block;text-align:start;color:#fff;font-size:clamp(46px,14.5vw,66px);font-weight:700;line-height:.94;letter-spacing:-.05em;overflow-wrap:anywhere;animation:x-rise .9s .1s var(--ease) both}
.l-sxsheet .name i{font-size:.36em;color:#fff;vertical-align:.5em;margin-inline-start:8px}
.l-sxsheet .x-chips{display:flex;flex-wrap:wrap;gap:8px;margin-top:18px;animation:x-rise .8s .35s var(--ease) both}
.l-sxsheet .x-chips span{display:inline-flex;align-items:center;gap:6px;padding:7px 13px;border-radius:999px;font-size:12.5px;font-weight:500;background:rgba(255,255,255,.14);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px)}
.l-sxsheet .x-cue{position:absolute;left:50%;bottom:36px;margin-left:-12px;font-size:24px;z-index:2;animation:x-cue 1.8s ease-in-out infinite}
.l-sxsheet .x-sheet{position:relative;z-index:3;margin-top:-28px;padding-bottom:6px;min-height:60vh;background:var(--bg);border-radius:32px 32px 0 0;box-shadow:0 -24px 50px -20px rgba(0,0,0,.6)}
.l-sxsheet .x-grab{display:block;width:44px;height:5px;border-radius:5px;background:var(--line);margin:0 auto;position:relative;top:10px}
.l-sxsheet .x-tabs{position:sticky;top:10px;z-index:5;display:flex;gap:4px;margin:22px 18px 0;padding:5px;border-radius:999px;background:color-mix(in srgb,var(--tx) 7%,var(--bg));box-shadow:0 0 0 1px var(--line)}
.l-sxsheet .x-tabs button{position:relative;z-index:1;flex:1;height:42px;border:0;background:none;border-radius:999px;font:inherit;font-size:13.5px;font-weight:600;color:var(--muted);cursor:pointer;transition:color .3s}
.l-sxsheet .x-tabs button.on{color:var(--onp)}
.l-sxsheet .x-ind{position:absolute;top:5px;left:0;height:42px;border-radius:999px;background:var(--p);box-shadow:0 10px 20px -10px var(--p);transition:transform .45s var(--ease),width .45s var(--ease)}
.l-sxsheet .x-panel{display:none}
.l-sxsheet .x-panel.on{display:block;animation:x-rise .5s var(--ease) both}
.l-sxsheet .sec{padding:26px 18px 0;animation:none}
.l-sxsheet .sec h3{font-size:19px;font-weight:700;letter-spacing:-.02em;text-transform:none;color:var(--tx);margin-inline:2px}
.l-sxsheet .sec h3 i{display:none}
.l-sxsheet .s-about .box{background:none;border:0;box-shadow:none;padding:0 2px;font-size:17px;line-height:1.65}
.l-sxsheet .gal{grid-template-columns:1fr 1fr;gap:6px}
.l-sxsheet .gal a{border-radius:16px}
.l-sxsheet .gal a:nth-child(3n+1){grid-column:span 2}
.l-sxsheet .gal a:nth-child(3n+1) img{aspect-ratio:16/10}
.l-sxsheet .foot,.l-sxsheet>div[style]{background:var(--bg);position:relative;z-index:3}
.l-sxsheet~.x-dock{position:fixed;z-index:20;left:50%;bottom:14px;transform:translateX(-50%);width:min(448px,calc(100% - 24px));display:flex;gap:8px;padding:8px;border-radius:999px;background:color-mix(in srgb,var(--bg) 72%,transparent);backdrop-filter:blur(20px) saturate(1.6);-webkit-backdrop-filter:blur(20px) saturate(1.6);border:1px solid var(--line);box-shadow:0 20px 44px -14px rgba(0,0,0,.5);animation:vc-bar .8s .9s var(--ease) both}
.l-sxsheet~.x-dock.x-static{position:static;transform:none;margin:0 auto 20px;animation:none}
.l-sxsheet~.x-dock .save{flex:1;margin:0;height:52px;font-size:15px;box-shadow:none;animation:none}
.l-sxsheet~.x-dock .x-actions{display:flex;gap:8px}
.l-sxsheet~.x-dock .x-round{width:52px;height:52px;border-radius:50%;display:grid;place-items:center;font-size:21px;background:var(--chip);color:var(--p);transition:transform .3s var(--ease)}
.l-sxsheet~.x-dock .x-round:hover{transform:translateY(-3px)}

/* ================================================================== sxbento: everything is a tile */
.l-sxbento{--r:28px;background:color-mix(in srgb,var(--p) 6%,var(--bg))}
.l-sxbento .x-bento{display:grid;grid-template-columns:1fr 1fr;gap:10px;padding:14px}
.l-sxbento .x-t{position:relative;overflow:hidden;border-radius:28px;background:color-mix(in srgb,var(--p) 10%,var(--bg));color:var(--tx);border:0;font:inherit;animation:x-in .7s var(--ease) both;transition:transform .35s var(--ease),border-radius .45s var(--ease),box-shadow .35s,background .25s,color .25s}
.l-sxbento .x-bento>:nth-child(2){animation-delay:.06s}.l-sxbento .x-bento>:nth-child(3){animation-delay:.12s}.l-sxbento .x-bento>:nth-child(4) .x-t{animation-delay:.18s}.l-sxbento .x-bento>:nth-child(5) .x-t{animation-delay:.24s}.l-sxbento .x-bento>:nth-child(6) .x-t{animation-delay:.3s}
.l-sxbento a.x-t:hover{transform:translateY(-3px);box-shadow:0 2px 4px rgba(0,0,0,.14),0 16px 28px -14px rgba(0,0,0,.34)}
.l-sxbento a.x-t:active{transform:scale(.97)}
.l-sxbento .x-ph{aspect-ratio:1}
.l-sxbento .avatar{width:100%;height:100%;border:0;border-radius:0;box-shadow:none;object-fit:cover;object-position:center 20%;animation:x-ken 1.4s var(--ease) both}
.l-sxbento .avatar.ph{font-size:64px}
.l-sxbento .x-idt{aspect-ratio:1;padding:18px;display:flex;flex-direction:column;justify-content:flex-end;background:var(--p);color:var(--onp)}
.l-sxbento .x-sh{position:absolute;top:12px;inset-inline-end:12px;width:40px;height:40px;border-radius:50%;border:0;display:grid;place-items:center;font-size:18px;cursor:pointer;color:inherit;background:color-mix(in srgb,var(--onp) 16%,transparent);transition:transform .3s var(--ease)}
.l-sxbento .x-sh:hover{transform:rotate(-12deg) scale(1.1)}
.l-sxbento .name{display:block;text-align:start;font-size:clamp(23px,7vw,30px);font-weight:500;line-height:1.05;letter-spacing:-.02em;color:inherit;overflow-wrap:anywhere}
.l-sxbento .name i{font-size:.55em;color:inherit;margin-inline-start:5px;vertical-align:middle}
.l-sxbento .role{text-align:start;color:inherit;opacity:.85;font-size:13.5px;margin-top:8px}
.l-sxbento .x-co{display:inline-flex;align-items:center;gap:6px;margin-top:10px;font-size:12px;font-weight:500;opacity:.9}
.l-sxbento .save{grid-column:span 2;margin:0;height:76px;padding:0 16px 0 26px;justify-content:space-between;border-radius:28px;font-size:20px;font-weight:500;letter-spacing:-.01em;background:color-mix(in srgb,var(--s) 34%,var(--bg));color:var(--tx);box-shadow:none}
.l-sxbento .save:after{display:none}
.l-sxbento .save i{width:46px;height:46px;border-radius:50%;display:grid;place-items:center;background:var(--tx);color:var(--bg);font-size:22px;transition:transform .45s var(--ease)}
.l-sxbento .save:hover{border-radius:40px}
.l-sxbento .save:hover i{transform:rotate(45deg)}
.l-sxbento .x-row{grid-column:span 2;display:grid;grid-auto-flow:column;grid-auto-columns:1fr;gap:10px}
.l-sxbento .x-act{aspect-ratio:1;display:flex;flex-direction:column;justify-content:space-between;padding:14px;font-size:12px;font-weight:500;background:color-mix(in srgb,var(--p) 12%,var(--bg))}
.l-sxbento .x-act i{font-size:24px;color:var(--p);transition:color .25s}
.l-sxbento .x-act:hover{border-radius:50%;background:var(--p);color:var(--onp);align-items:center;justify-content:center;gap:4px}
.l-sxbento .x-act:hover i{color:inherit}
.l-sxbento .x-loc,.l-sxbento .x-hrs{display:flex;align-items:center;gap:10px;padding:18px;font-size:13.5px;font-weight:500;min-height:68px;min-width:0}
.l-sxbento .x-loc{background:color-mix(in srgb,var(--s) 22%,var(--bg))}
.l-sxbento .x-loc i{font-size:20px;color:color-mix(in srgb,var(--s) 60%,var(--tx))}
.l-sxbento .x-dot{width:10px;height:10px;flex:none;border-radius:50%;background:#9ca3af}
.l-sxbento .is-open .x-dot{background:#22c55e;animation:x-ping 2s ease-out infinite}
.l-sxbento .x-socs{grid-column:span 2;display:grid;grid-template-columns:repeat(auto-fit,minmax(50px,1fr));gap:10px}
.l-sxbento .x-soc{aspect-ratio:1;display:grid;place-items:center;font-size:24px;border-radius:22px}
.l-sxbento .x-soc:hover{background:var(--bc);color:#fff;border-radius:50%}
.l-sxbento .install{grid-column:span 2;margin:0;width:100%}
.l-sxbento .sec{margin:10px 14px 0;padding:22px 20px 20px;border-radius:28px;background:var(--bg)}
.l-sxbento .sec h3{color:var(--tx);font-size:17px;font-weight:500;letter-spacing:0;text-transform:none;margin:0 0 14px}
.l-sxbento .sec h3 i{width:34px;height:34px;border-radius:50%;display:grid;place-items:center;background:color-mix(in srgb,var(--p) 14%,var(--bg))}
.l-sxbento .box,.l-sxbento .links a,.l-sxbento .pays a,.l-sxbento .post,.l-sxbento .prod{background:color-mix(in srgb,var(--p) 6%,var(--bg));border-color:transparent;box-shadow:none;border-radius:20px}
.l-sxbento .s-about .box{background:none;padding:0;font-size:16.5px;line-height:1.6}
.l-sxbento .foot{padding-top:26px}

/* ================================================================== sxeditorial: magazine cover */
.l-sxeditorial{--r:0px}
.l-sxeditorial .x-mast{padding:20px 22px 0}
.l-sxeditorial .x-rule{display:flex;align-items:center;gap:14px;padding-bottom:12px;border-bottom:2px solid var(--tx);font-size:10.5px;font-weight:600;letter-spacing:.2em;text-transform:uppercase}
.l-sxeditorial .x-rule span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.l-sxeditorial .x-shr{margin-inline-start:auto;flex:none;display:inline-flex;align-items:center;gap:4px;background:none;border:0;font:inherit;letter-spacing:inherit;text-transform:inherit;color:var(--tx);cursor:pointer}
.l-sxeditorial .x-shr i{font-size:14px;transition:transform .3s var(--ease)}
.l-sxeditorial .x-shr:hover i{transform:translate(3px,-3px)}
.l-sxeditorial .x-cover{position:relative;padding-top:26px;min-height:300px}
.l-sxeditorial .name{position:relative;z-index:2;display:block;text-align:start;font-size:clamp(58px,19vw,92px);font-weight:500;line-height:.86;letter-spacing:-.045em;overflow-wrap:anywhere;mix-blend-mode:difference;color:#fff;animation:x-rise 1s var(--ease) both}
.l-sxeditorial .name i{font-size:.22em;vertical-align:1.6em;margin-inline-start:6px;color:inherit}
.l-sxeditorial .x-fig{position:absolute;z-index:1;inset-inline-end:0;top:54px;width:54%;aspect-ratio:3/4;border-radius:999px 999px 0 0;overflow:hidden;animation:x-in 1.1s .15s var(--ease) both}
.l-sxeditorial .avatar{width:100%;height:100%;border:0;border-radius:0;box-shadow:none;object-fit:cover;object-position:center 18%;filter:grayscale(1) contrast(1.05);animation:x-ken 1.8s var(--ease) both;transition:filter .6s}
.l-sxeditorial .x-fig:hover .avatar{filter:none}
.l-sxeditorial .avatar.ph{font-size:64px;background:var(--tx);color:var(--bg)}
.l-sxeditorial .role{position:relative;z-index:2;text-align:start;max-width:42%;margin-top:22px;font-size:15px;font-style:italic;line-height:1.35;color:var(--tx)}
.l-sxeditorial .x-tick{margin-top:30px;overflow:hidden;background:var(--tx);color:var(--bg)}
.l-sxeditorial .x-tick div{display:flex;align-items:center;gap:22px;width:max-content;padding:13px 0;font-size:13px;font-weight:600;letter-spacing:.18em;text-transform:uppercase;white-space:nowrap;animation:x-tick 26s linear infinite}
.l-sxeditorial .x-tick i{font-style:normal;color:var(--p)}
.l-sxeditorial .x-index{padding:8px 22px 0}
.l-sxeditorial .x-ix{display:grid;grid-template-columns:38px 1fr auto;align-items:baseline;column-gap:6px;padding:20px 0 18px;border-bottom:1px solid var(--tx);transition:padding .45s var(--ease),color .3s}
.l-sxeditorial .x-ix em{font-style:normal;font-size:11px;font-weight:600;letter-spacing:.1em;color:var(--p)}
.l-sxeditorial .x-ix b{font-size:30px;font-weight:500;letter-spacing:-.03em;line-height:1}
.l-sxeditorial .x-ix small{grid-column:2;margin-top:6px;font-size:12.5px;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.l-sxeditorial .x-ix i{grid-row:1/3;grid-column:3;align-self:center;font-size:26px;transition:transform .45s var(--ease)}
.l-sxeditorial .x-ix:hover{padding-inline-start:12px;color:var(--p)}
.l-sxeditorial .x-ix:hover i{transform:translateX(8px) rotate(-45deg)}
.l-sxeditorial .save{margin:26px 22px 0;height:64px;padding:0 24px;border-radius:0;justify-content:space-between;background:var(--tx);color:var(--bg);box-shadow:none;font-size:13px;letter-spacing:.24em;text-transform:uppercase;transition:background .3s,color .3s}
.l-sxeditorial .save:after{display:none}
.l-sxeditorial .save:hover{background:var(--p);color:var(--onp);transform:none;box-shadow:none}
.l-sxeditorial .install{margin-inline:22px;width:calc(100% - 44px);border-radius:0}
.l-sxeditorial .x-body{counter-reset:xs}
.l-sxeditorial .sec{counter-increment:xs;padding:54px 22px 0}
.l-sxeditorial .sec h3{display:block;margin:0 0 20px;padding-top:12px;border-top:2px solid var(--tx);color:var(--tx);font-size:40px;font-weight:500;letter-spacing:-.04em;line-height:1;text-transform:none}
.l-sxeditorial .sec h3 i{display:none}
.l-sxeditorial .sec h3:before{content:counter(xs,decimal-leading-zero) " /";display:block;margin-bottom:14px;font-size:11px;font-weight:600;letter-spacing:.2em;color:var(--p)}
.l-sxeditorial .box,.l-sxeditorial .links a,.l-sxeditorial .pays a,.l-sxeditorial .post,.l-sxeditorial .prod,.l-sxeditorial .embed{border-radius:0;background:transparent;box-shadow:none;border-width:0 0 1px;border-color:var(--tx);padding-inline:0}
.l-sxeditorial .s-about .box{border:0;padding:0;font-size:21px;line-height:1.45;letter-spacing:-.01em}
.l-sxeditorial .s-about .box:first-letter{font-size:3.1em;float:inline-start;line-height:.8;padding:6px 8px 0 0;color:var(--p)}
.l-sxeditorial .svc{display:flex;gap:14px;overflow-x:auto;scroll-snap-type:x mandatory;padding:0 22px 6px;margin-inline:-22px;border:0;scrollbar-width:none}
.l-sxeditorial .svc::-webkit-scrollbar,.l-sxeditorial .gal::-webkit-scrollbar{display:none}
.l-sxeditorial .svc .item{flex:0 0 72%;scroll-snap-align:start;flex-direction:column;padding:18px;border:1px solid var(--tx)!important;min-height:190px}
.l-sxeditorial .svc b{font-size:22px;font-weight:500;letter-spacing:-.02em}
.l-sxeditorial .svc img,.l-sxeditorial .svc .ic{border-radius:0;background:var(--tx);color:var(--bg)}
.l-sxeditorial .gal{display:flex;gap:10px;overflow-x:auto;scroll-snap-type:x mandatory;padding:0 22px;margin-inline:-22px;scrollbar-width:none}
.l-sxeditorial .gal a{flex:0 0 62%;scroll-snap-align:start;border-radius:0}
.l-sxeditorial .gal img{aspect-ratio:3/4;filter:grayscale(1);transition:filter .5s,transform .6s var(--ease)}
.l-sxeditorial .gal a:hover img{filter:none}
.l-sxeditorial .row>i:not(.go),.l-sxeditorial .links a i,.l-sxeditorial .pays a i{border-radius:0;background:var(--tx);color:var(--bg)}
.l-sxeditorial .social{display:flex;flex-wrap:wrap;gap:0;padding:1px 0 0 1px}
.l-sxeditorial .social a{width:25%;aspect-ratio:1;border-radius:0;background:transparent;box-shadow:none;border:1px solid var(--tx);margin:-1px 0 0 -1px;color:var(--tx)}
.l-sxeditorial .social a:hover{background:var(--tx);color:var(--bg);transform:none;box-shadow:none}
.l-sxeditorial .btn,.l-sxeditorial .chips button,.l-sxeditorial form.enq input,.l-sxeditorial form.enq textarea{border-radius:0}
.l-sxeditorial .foot{margin-top:54px;border-top:2px solid var(--tx);text-align:start;padding-inline:22px}

/* ================================================================== sxpass: wallet pass + folding stack */
.l-sxpass{--r:18px;background:color-mix(in srgb,var(--p) 9%,var(--bg))}
.l-sxpass .x-pass{position:relative;margin:22px 16px 0;border-radius:24px;background:var(--bg);filter:drop-shadow(0 30px 34px rgba(10,20,45,.28));animation:x-in .9s var(--ease) both}
.l-sxpass .x-phead{display:flex;justify-content:space-between;align-items:center;padding:16px 20px;border-radius:24px 24px 0 0;color:var(--onp);background:linear-gradient(120deg,var(--p),color-mix(in srgb,var(--p) 70%,#000));border-bottom:3px solid var(--s)}
.l-sxpass .x-org{display:inline-flex;align-items:center;gap:8px;font-size:12px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;min-width:0}
.l-sxpass .x-nfc{font-size:22px;transform:rotate(90deg);color:var(--s)}
.l-sxpass .x-pmain{display:grid;grid-template-columns:auto 1fr;gap:16px;align-items:center;padding:22px 20px 6px}
.l-sxpass .avatar{width:84px;height:84px;border-radius:22px;border:0;box-shadow:0 0 0 3px var(--bg),0 0 0 5px var(--s)}
.l-sxpass .avatar.ph{font-size:28px}
.l-sxpass .name{display:block;text-align:start;font-size:25px;font-weight:600;line-height:1.1;letter-spacing:-.02em}
.l-sxpass .name i{font-size:.62em;margin-inline-start:5px;color:var(--s);vertical-align:middle}
.l-sxpass .role{text-align:start;margin-top:5px;font-size:13.5px}
.l-sxpass .x-fields{display:grid;grid-template-columns:1fr 1fr;gap:16px 14px;padding:18px 20px 22px}
.l-sxpass .x-fields div{min-width:0}
.l-sxpass dt{font-size:9.5px;font-weight:700;letter-spacing:.2em;text-transform:uppercase;color:color-mix(in srgb,var(--s) 70%,var(--tx))}
.l-sxpass dd{margin-top:4px;font-size:13.5px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.l-sxpass .x-tear{position:relative;height:0;margin:0 22px;border-top:2px dashed var(--line)}
.l-sxpass .x-tear:before,.l-sxpass .x-tear:after{content:"";position:absolute;top:-14px;width:26px;height:26px;border-radius:50%;background:color-mix(in srgb,var(--p) 9%,var(--bg))}
.l-sxpass .x-tear:before{left:-35px}.l-sxpass .x-tear:after{right:-35px}
.l-sxpass .x-stub{display:grid;grid-template-columns:1fr auto;gap:16px;align-items:center;padding:20px}
.l-sxpass .x-code{height:46px;opacity:.85;background:repeating-linear-gradient(90deg,var(--tx) 0 2px,transparent 2px 5px,var(--tx) 5px 6px,transparent 6px 10px,var(--tx) 10px 13px,transparent 13px 15px,var(--tx) 15px 16px,transparent 16px 21px)}
.l-sxpass .save{margin:0;height:46px;padding:0 20px;border-radius:14px;font-size:14px;background:var(--p);box-shadow:0 14px 24px -14px var(--p)}
.l-sxpass .x-quick{display:flex;gap:10px;padding:20px 16px 4px;overflow-x:auto;scrollbar-width:none}
.l-sxpass .x-quick::-webkit-scrollbar{display:none}
.l-sxpass .x-q{flex:1 0 auto;min-width:64px;display:grid;justify-items:center;gap:7px;padding:14px 8px 11px;border-radius:18px;border:0;font:inherit;font-size:11.5px;font-weight:600;cursor:pointer;background:var(--bg);color:var(--tx);box-shadow:0 12px 24px -18px rgba(10,20,45,.5);transition:transform .35s var(--ease)}
.l-sxpass .x-q i{font-size:21px;color:var(--p)}
.l-sxpass .x-q:hover{transform:translateY(-4px)}
.l-sxpass .install{margin-inline:16px;width:calc(100% - 32px)}
.l-sxpass .x-stack{padding:22px 16px 0}
.l-sxpass .x-fold{position:relative;margin-top:-14px;border-radius:22px 22px 0 0;background:var(--bg);box-shadow:0 -10px 24px -16px rgba(10,20,45,.45);padding-bottom:18px;transition:margin .45s var(--ease),border-radius .45s var(--ease)}
.l-sxpass .x-fold:first-child{margin-top:0}
.l-sxpass .x-fold:last-child{border-radius:22px;padding-bottom:4px}
.l-sxpass .x-fold[open]{margin-bottom:26px;border-radius:22px;padding-bottom:8px}
.l-sxpass .x-fold[open]+.x-fold{margin-top:0}
.l-sxpass summary{list-style:none;display:flex;align-items:center;gap:12px;padding:16px 18px 18px;cursor:pointer;font-weight:700;font-size:14.5px;-webkit-tap-highlight-color:transparent}
.l-sxpass summary::-webkit-details-marker{display:none}
.l-sxpass summary>i:first-child{width:34px;height:34px;border-radius:11px;display:grid;place-items:center;font-size:17px;background:var(--p);color:var(--onp)}
.l-sxpass .x-fold:nth-child(even) summary>i:first-child{background:var(--s);color:var(--ons)}
.l-sxpass summary span{flex:1}
.l-sxpass .x-chev{font-size:20px;color:var(--muted);transition:transform .4s var(--ease)}
.l-sxpass .x-fold[open] .x-chev{transform:rotate(180deg)}
.l-sxpass .x-fold .sec{padding:0 14px 10px;animation:x-rise .45s var(--ease) both}
.l-sxpass .x-fold .sec h3{display:none}
.l-sxpass .box,.l-sxpass .links a,.l-sxpass .pays a,.l-sxpass .post,.l-sxpass .prod{box-shadow:none;background:color-mix(in srgb,var(--p) 4%,var(--bg))}
@supports (interpolate-size:allow-keywords){.l-sxpass .x-fold{interpolate-size:allow-keywords}.l-sxpass .x-fold::details-content{block-size:0;overflow:clip;transition:block-size .45s cubic-bezier(.16,1,.3,1),content-visibility .45s allow-discrete}.l-sxpass .x-fold[open]::details-content{block-size:auto}}

/* ================================================================== sxorbit: HUD with orbiting socials */
.l-sxorbit{--r:6px;--cut:polygon(0 0,calc(100% - 14px) 0,100% 14px,100% 100%,14px 100%,0 calc(100% - 14px))}
.l-sxorbit .x-hud{position:relative;padding:34px 20px 0;text-align:center;overflow:hidden}
.l-sxorbit .x-hud:before{content:"";position:absolute;inset:-10% -20% auto;height:420px;background:radial-gradient(40% 46% at 28% 40%,color-mix(in srgb,var(--p) 46%,transparent),transparent 70%),radial-gradient(40% 46% at 74% 34%,color-mix(in srgb,var(--s) 40%,transparent),transparent 70%);filter:blur(30px);animation:x-glow 5s ease-in-out infinite alternate;pointer-events:none}
.l-sxorbit .x-floor{position:absolute;left:-40%;right:-40%;top:210px;height:260px;background:linear-gradient(color-mix(in srgb,var(--p) 50%,transparent) 1px,transparent 1px) 0 0/100% 34px,linear-gradient(90deg,color-mix(in srgb,var(--p) 50%,transparent) 1px,transparent 1px) 0 0/34px 100%;transform:perspective(320px) rotateX(64deg);transform-origin:top;-webkit-mask-image:linear-gradient(transparent,#000 30%,transparent 92%);mask-image:linear-gradient(transparent,#000 30%,transparent 92%);opacity:.5;animation:x-floor 2.4s linear infinite;pointer-events:none}
.l-sxorbit .x-orbit{position:relative;width:292px;height:292px;max-width:100%;margin:0 auto;display:grid;place-items:center}
.l-sxorbit .x-ring{position:absolute;border-radius:50%;pointer-events:none}
.l-sxorbit .x-r1{inset:20px;border:1px dashed color-mix(in srgb,var(--p) 60%,transparent);animation:x-spin 60s linear infinite}
.l-sxorbit .x-r2{inset:66px;background:conic-gradient(var(--p),transparent 28%,transparent 50%,var(--s),transparent 78%);-webkit-mask:radial-gradient(circle,transparent calc(71% - 3px),#000 calc(71% - 2px));mask:radial-gradient(circle,transparent calc(71% - 3px),#000 calc(71% - 2px));animation:x-spin 6s linear infinite}
.l-sxorbit .x-r3{inset:-6px;border:1px solid color-mix(in srgb,var(--tx) 10%,transparent)}
.l-sxorbit .avatar{position:relative;width:132px;height:132px;border:0;box-shadow:0 0 0 4px var(--bg),0 0 34px -2px var(--p),0 0 80px -10px var(--s)}
.l-sxorbit .x-sats{position:absolute;inset:0;animation:x-spin 44s linear infinite}
.l-sxorbit .x-orbit:hover .x-sats,.l-sxorbit .x-orbit:hover .x-sat i{animation-play-state:paused}
.l-sxorbit .x-sat{position:absolute;top:50%;left:50%;width:44px;height:44px;margin:-22px;border-radius:50%;display:grid;place-items:center;font-size:19px;color:var(--tx);background:color-mix(in srgb,var(--bg) 70%,transparent);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);border:1px solid color-mix(in srgb,var(--p) 55%,transparent);box-shadow:0 0 18px -6px var(--p);transform:rotate(calc(360deg / var(--n) * var(--i))) translateY(-126px) rotate(calc(-360deg / var(--n) * var(--i)));transition:background .25s,color .25s,box-shadow .3s}
.l-sxorbit .x-sat i{animation:x-spin-r 44s linear infinite}
.l-sxorbit .x-sat:hover{background:var(--bc);color:#fff;border-color:transparent;box-shadow:0 0 26px -2px var(--bc)}
.l-sxorbit .name{position:relative;margin-top:22px;font-size:31px;font-weight:700;letter-spacing:.01em;background:linear-gradient(90deg,var(--tx),var(--p) 60%,var(--s));-webkit-background-clip:text;background-clip:text;color:transparent}
.l-sxorbit .name i{-webkit-text-fill-color:var(--s);font-size:.7em}
.l-sxorbit .role{position:relative;font-size:12px;letter-spacing:.3em;text-transform:uppercase;color:var(--p);margin-top:10px}
.l-sxorbit .x-tags{position:relative;display:flex;flex-wrap:wrap;justify-content:center;gap:8px;margin-top:16px}
.l-sxorbit .x-tags span{display:inline-flex;align-items:center;gap:6px;padding:6px 14px;font-size:12px;clip-path:polygon(8px 0,100% 0,calc(100% - 8px) 100%,0 100%);background:color-mix(in srgb,var(--p) 16%,transparent)}
.l-sxorbit .x-pads{position:relative;display:grid;grid-template-columns:1fr 1fr;gap:10px;padding:30px 18px 0}
.l-sxorbit .x-pad{position:relative;display:flex;align-items:center;gap:12px;min-width:0;padding:14px;border:0;font:inherit;text-align:start;color:var(--tx);cursor:pointer;clip-path:var(--cut);background:linear-gradient(135deg,color-mix(in srgb,var(--p) 22%,transparent),color-mix(in srgb,var(--tx) 5%,transparent));animation:x-in .7s var(--ease) both;transition:transform .3s var(--ease),background .3s,color .3s}
.l-sxorbit .x-pad:nth-child(2){animation-delay:.07s}.l-sxorbit .x-pad:nth-child(3){animation-delay:.14s}.l-sxorbit .x-pad:nth-child(4){animation-delay:.21s}.l-sxorbit .x-pad:nth-child(5){animation-delay:.28s}
.l-sxorbit .x-pad:last-child:nth-child(odd){grid-column:span 2}
.l-sxorbit .x-pad>i{font-size:22px;color:var(--p);flex:none}
.l-sxorbit .x-pad span{min-width:0;display:block}
.l-sxorbit .x-pad b{display:block;font-size:14px;font-weight:600}
.l-sxorbit .x-pad small{display:block;font-size:11px;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.l-sxorbit .x-pad:hover{transform:translateY(-3px);background:linear-gradient(135deg,var(--p),color-mix(in srgb,var(--p) 40%,var(--s)));color:var(--onp)}
.l-sxorbit .x-pad:hover>i,.l-sxorbit .x-pad:hover small{color:inherit}
.l-sxorbit .save{margin:12px 18px 0;height:56px;border-radius:0;clip-path:var(--cut);background:linear-gradient(100deg,var(--p),var(--s));letter-spacing:.2em;text-transform:uppercase;font-size:13px;box-shadow:none}
.l-sxorbit .install{margin-inline:18px;width:calc(100% - 36px)}
.l-sxorbit .sec{padding:32px 18px 0}
.l-sxorbit .sec h3{color:var(--p);letter-spacing:.24em;font-size:11px}
.l-sxorbit .sec h3:after{content:"";flex:1;height:1px;background:linear-gradient(90deg,color-mix(in srgb,var(--p) 60%,transparent),transparent)}
.l-sxorbit .box,.l-sxorbit .links a,.l-sxorbit .pays a,.l-sxorbit .post,.l-sxorbit .prod{border-radius:0;clip-path:var(--cut);border:0;box-shadow:none;background:linear-gradient(135deg,color-mix(in srgb,var(--p) 13%,transparent),color-mix(in srgb,var(--tx) 4%,transparent))}
.l-sxorbit .row>i:not(.go),.l-sxorbit .links a i,.l-sxorbit .svc .ic,.l-sxorbit .pays a i{border-radius:0;clip-path:polygon(6px 0,100% 0,100% calc(100% - 6px),calc(100% - 6px) 100%,0 100%,0 6px)}
.l-sxorbit .social a{border-radius:0;clip-path:var(--cut);border:0;box-shadow:none;background:color-mix(in srgb,var(--p) 12%,transparent)}
.l-sxorbit .btn{border-radius:0;clip-path:var(--cut)}
@media (hover:none){.l-sxbento .x-act:hover{border-radius:28px;align-items:stretch;justify-content:space-between}.l-sxeditorial .x-ix:hover{padding-inline-start:0}}
`;

module.exports = { ARCH, build, CSS: CSS + PACKS.map((p) => p.CSS).join('') };
