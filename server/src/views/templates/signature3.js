/*
 * Signature designs, pack 3: professional, creative and sales. See signature.js for the kit each design receives.
 *
 *   sxdash     a business dashboard: figures strip (services, reviews, photos), two large call buttons
 *   sxtimeline sections hang on a numbered vertical line that fills as you scroll
 *   sxletter   a formal letter: letterhead, the bio as the letter, a signature and numbered footnote contacts
 *   sxclinic   appointment first: status pill, a booking card, fact cells and a two-button bottom bar
 *   sxposter   a poster grid: colour cells, giant initials, a turning text ring, sticker buttons
 *   sxstory    a social profile: story bars, highlight circles for each network, tight photo grid
 *   sxchat     a conversation: message bubbles, quick-reply chips, a contact-card attachment
 *   sxlisting  a property listing: swipeable photo header, agent strip, large tiles, call bar
 */
const designs = {
  sxdash: (k) => {
    const { v, L, esc } = k;
    const kpi = [[k.services.length, L.services], [k.testimonials.length, L.testimonials], [k.gallery.length, L.gallery]].filter(([n]) => n > 0);
    const [a1, a2, ...more] = k.acts;
    return {
      main: `<header class="x-db">
    <div class="x-dtop"><span class="x-org x-meta"><i class="ri-building-line"></i>${esc(v.company || k.appName)}</span>${k.share('x-ic', '<i class="ri-share-forward-line"></i>')}</div>
    <div class="x-did">${k.avatar()}<div><h1 class="name">${esc(k.fullName)}${k.verified}</h1>${k.roleP}</div></div>
  </header>
  ${kpi.length || k.hoursText ? `<div class="x-kpi x-meta">${kpi.map(([n, l]) => `<div><b>${n}</b><span>${l}</span></div>`).join('')}${k.hoursText ? `<div class="x-st${k.todayHours?.open ? ' is-open' : ''}"><b><span class="x-dot"></span></b><span>${k.hoursText}</span></div>` : ''}</div>` : ''}
  <nav class="x-cta x-actions" aria-label="Contact">${[a1, a2].filter(Boolean).map((a) => k.A(a, 'x-big', `<i class="${a.icon}"></i><span><b>${a.label}</b><small>${esc(a.sub || '')}</small></span>`)).join('')}${more.map((a) => k.A(a, 'x-sm', `<i class="${a.icon}"></i>${a.label}`)).join('')}</nav>
  ${k.save('', `<i class="ri-user-add-line"></i><span>${L.save}</span>`)}
  ${k.install}
  ${k.sections()}`,
    };
  },

  sxtimeline: (k) => {
    const { v, L, esc } = k;
    const keys = k.order.filter((x) => k.blocks[x]);
    return {
      main: `<header class="x-th">${k.avatar()}<h1 class="name">${k.stacked}${k.verified}</h1>${k.roleP}
    ${v.company || v.location ? `<div class="x-chips x-meta">${v.company ? `<span><i class="ri-building-line"></i>${esc(v.company)}</span>` : ''}${v.location ? `<span><i class="ri-map-pin-line"></i>${esc(v.location)}</span>` : ''}</div>` : ''}
  </header>
  <nav class="x-acts x-actions" aria-label="Contact">${k.acts.map((a) => k.A(a, 'x-ab', `<i class="${a.icon}"></i><span>${a.label}</span>`)).join('')}${k.share('x-ab', `<i class="ri-share-forward-fill"></i><span>${L.share}</span>`)}</nav>
  ${k.save('', `<i class="ri-user-add-line"></i><span>${L.save}</span>`)}
  ${k.install}
  <div class="x-spine"><span class="x-fill" aria-hidden="true"></span>${keys.map((x, i) => `<div class="x-node"><span class="x-n" aria-hidden="true">${String(i + 1).padStart(2, '0')}</span>${k.blocks[x]}</div>`).join('\n')}</div>`,
    };
  },

  sxletter: (k) => {
    const { v, L, esc } = k;
    return {
      main: `<article class="x-letter">
    <header class="x-lh"><span class="x-crest" aria-hidden="true">${esc(k.initials)}</span><p class="x-firm">${esc(v.company || k.fullName)}</p>${v.location ? `<p class="x-addr x-meta">${esc(v.location)}</p>` : ''}${k.share('x-shr', `<i class="ri-share-forward-line"></i>${L.share}`)}</header>
    ${k.blocks.about ? `<div class="x-lbody">${k.blocks.about}</div>` : ''}
    <div class="x-sig">${k.avatar()}<div><h1 class="name">${esc(k.fullName)}${k.verified}</h1>${k.roleP}</div></div>
    ${k.acts.length ? `<ol class="x-notes x-actions">${k.acts.map((a) => `<li>${k.A(a, 'x-nt', `<b>${a.label}</b><span>${esc(a.sub || '')}</span>`)}</li>`).join('')}</ol>` : ''}
    ${k.save('', `<span class="x-seal" aria-hidden="true"><i class="ri-user-add-line"></i></span><span>${L.save}</span>`)}
  </article>
  ${k.install}
  ${k.sections(k.order.filter((x) => x !== 'about'))}`,
    };
  },

  sxclinic: (k) => {
    const { v, L, esc } = k;
    const [call, ...others] = k.acts;
    const facts = [k.phone && ['ri-phone-line', L.phone, k.phone], v.email && ['ri-mail-line', L.email, v.email], v.location && ['ri-map-pin-line', L.location, v.location]].filter(Boolean);
    return {
      main: `<header class="x-cl">
    <div class="x-clt"><span class="x-plus" aria-hidden="true"></span><span class="x-org x-meta">${esc(v.company || k.appName)}</span>${k.share('x-ic', '<i class="ri-share-forward-line"></i>')}</div>
    <div class="x-clc">${k.avatar()}<div><h1 class="name">${esc(k.fullName)}${k.verified}</h1>${k.roleP}
      ${k.hoursText ? `<span class="x-st x-meta${k.todayHours?.open ? ' is-open' : ''}"><span class="x-dot"></span>${k.hoursText}</span>` : ''}</div></div>
  </header>
  <div class="x-book x-actions">
    <p><i class="${k.blocks.appointments ? 'ri-calendar-check-line' : 'ri-chat-smile-2-line'}"></i>${k.blocks.appointments ? L.appointment : L.touch}</p>
    <div>${k.blocks.appointments ? `<a class="x-a x-bk" href="#appt-sec"><i class="ri-calendar-event-fill"></i>${L.book}</a>` : ''}${others.slice(0, k.blocks.appointments ? 1 : 2).map((a) => k.A(a, 'x-bk x-alt', `<i class="${a.icon}"></i>${a.label}`)).join('')}</div>
  </div>
  ${facts.length ? `<div class="x-facts x-meta">${facts.map(([i, l, t]) => `<div><i class="${i}"></i><small>${l}</small><b>${esc(t)}</b></div>`).join('')}</div>` : ''}
  ${k.install}
  ${k.sections()}`,
      dock: `<nav class="x-bar2${v.sticky_bar === false ? ' x-static' : ''}" aria-label="Quick actions">${call ? k.A(call, 'x-call', `<i class="${call.icon}"></i><span>${call.label}</span>`) : ''}${k.save('', `<i class="ri-user-add-fill"></i><span>${L.save}</span>`)}</nav>`,
    };
  },

  sxposter: (k) => {
    const { v, L, esc } = k;
    const ring = esc(`${k.role || k.fullName} • `.repeat(4).slice(0, 78));
    return {
      main: `<header class="x-po">
    <div class="x-c1" aria-hidden="true"><span>${esc(k.initials)}</span></div>
    <div class="x-c2">${k.avatar()}<svg class="x-ring" viewBox="0 0 100 100" aria-hidden="true"><defs><path id="xr" d="M50,50 m-40,0 a40,40 0 1,1 80,0 a40,40 0 1,1 -80,0"/></defs><text><textPath href="#xr">${ring}</textPath></text></svg></div>
    <div class="x-c3"><h1 class="name">${k.stacked}${k.verified}</h1></div>
    <div class="x-c4">${k.roleP}${v.company ? `<p class="x-co x-meta">${esc(v.company)}</p>` : ''}${k.share('x-shr', `${L.share}<i class="ri-arrow-right-up-line"></i>`)}</div>
  </header>
  <nav class="x-stk x-actions" aria-label="Contact">${k.acts.map((a) => k.A(a, 'x-s', `<i class="${a.icon}"></i>${a.label}`)).join('')}</nav>
  ${k.save('', `<span>${L.save}</span><i class="ri-arrow-right-line"></i>`)}
  ${k.install}
  ${k.sections()}`,
    };
  },

  sxstory: (k) => {
    const { v, L, esc } = k;
    const hl = k.sec.social ? k.socials.slice(0, 12) : [];
    return {
      main: `<header class="x-sy">
    <div class="x-bars" aria-hidden="true"><span></span><span></span><span></span></div>
    <div class="x-syr"><div class="x-ringw">${k.avatar()}</div><div><h1 class="name">${esc(k.fullName)}${k.verified}</h1>${k.roleP}</div>${k.share('x-ic', '<i class="ri-share-forward-line"></i>')}</div>
    ${v.company || v.location ? `<p class="x-bio x-meta">${[v.company, v.location].filter(Boolean).map(esc).join(' · ')}</p>` : ''}
  </header>
  <div class="x-igb">${k.save('', `<span>${L.save}</span>`)}<span class="x-actions">${k.acts.slice(0, 3).map((a) => k.A(a, 'x-ig', `<i class="${a.icon}"></i><span>${a.label}</span>`)).join('')}</span></div>
  ${hl.length ? `<div class="x-hl">${hl.map(([n, u]) => `<a href="${k.url(u)}" target="_blank" rel="noopener" style="--bc:${k.BRAND[n] || '#888'}"><span><i class="${k.SOCIAL[n][0]}"></i></span><small>${k.SOCIAL[n][1]}</small></a>`).join('')}</div>` : ''}
  ${k.install}
  ${k.sections(k.order.filter((x) => x !== 'social' || k.socials.length > 12))}`,
    };
  },

  sxchat: (k) => {
    const { v, L, esc } = k;
    const keys = k.order.filter((x) => k.blocks[x]);
    return {
      main: `<header class="x-cht">${k.avatar()}<div><h1 class="name">${esc(k.fullName)}${k.verified}</h1><p class="x-on${k.todayHours?.open || !k.hasHours ? ' is-open' : ''}"><span class="x-dot"></span>${k.hoursText || esc(k.role || '')}</p></div>${k.share('x-ic', '<i class="ri-share-forward-line"></i>')}</header>
  <div class="x-thread">
    ${k.role ? `<div class="x-b x-in"><p class="role">${esc(k.role)}${v.company ? ` · ${esc(v.company)}` : ''}</p></div>` : ''}
    ${k.sentence ? `<div class="x-b x-in"><p>${esc(k.sentence)}</p></div>` : ''}
    <div class="x-typing" aria-hidden="true"><span></span><span></span><span></span></div>
    <nav class="x-qr x-actions" aria-label="Contact">${k.acts.map((a) => k.A(a, 'x-chip', `<i class="${a.icon}"></i>${a.label}`)).join('')}</nav>
    <div class="x-b x-in x-vcf"><div class="x-vc"><span class="x-vi" aria-hidden="true"><i class="ri-contacts-book-2-fill"></i></span><div><b>${esc(k.fullName)}</b>${v.location ? `<small class="x-meta">${esc(v.location)}</small>` : ''}</div></div>${k.save('', `<span>${L.save}</span>`)}</div>
    ${k.install}
    ${keys.map((x) => `<div class="x-msg"><span class="x-lab"><i class="${k.HEAD[x]?.icon || ''}" aria-hidden="true"></i>${k.HEAD[x]?.text || ''}</span>${k.blocks[x]}</div>`).join('\n')}
  </div>`,
    };
  },

  sxlisting: (k) => {
    const { v, L, esc } = k;
    const pics = k.gallery.filter((g) => g.image).slice(0, 6);
    const [a1, a2] = k.acts;
    return {
      main: `<header class="x-ls">
    ${pics.length ? `<div class="x-car">${pics.map((g, i) => `<img src="${k.url(g.image)}" alt="${esc(g.caption || '')}"${i ? ' loading="lazy"' : ''}>`).join('')}</div><span class="x-cnt"><i class="ri-image-2-line"></i>${pics.length}</span>`
    : `<div class="x-car x-none${v.cover_image ? ' x-img' : ''}"${v.cover_image ? ` style="background-image:url('${k.url(v.cover_image)}')"` : ''}></div>`}
    ${k.share('x-ic', '<i class="ri-share-forward-line"></i>')}
    <div class="x-agent">${k.avatar()}<div><h1 class="name">${esc(k.fullName)}${k.verified}</h1>${k.roleP}${v.company ? `<p class="x-co x-meta">${esc(v.company)}</p>` : ''}</div></div>
  </header>
  ${v.location || k.hoursText ? `<div class="x-tags x-meta">${v.location ? `<a href="${k.url(k.mapHref)}" target="_blank" rel="noopener"><i class="ri-map-pin-2-fill"></i>${esc(v.location)}</a>` : ''}${k.hoursText ? `<span><i class="ri-time-fill"></i>${k.hoursText}</span>` : ''}</div>` : ''}
  <nav class="x-mini x-actions" aria-label="Contact">${k.acts.slice(1).map((a) => k.A(a, 'x-mi', `<i class="${a.icon}"></i><span>${a.label}</span>`)).join('')}</nav>
  ${k.save('', `<i class="ri-user-add-line"></i><span>${L.save}</span>`)}
  ${k.install}
  ${k.sections()}`,
      dock: a1 ? `<nav class="x-bar3${v.sticky_bar === false ? ' x-static' : ''} x-actions" aria-label="Quick actions">${k.A(a1, 'x-c1', `<i class="${a1.icon}"></i><span>${a1.label}</span>`)}${a2 ? k.A(a2, 'x-c2', `<i class="${a2.icon}"></i><span>${a2.label}</span>`) : ''}</nav>` : '',
    };
  },
};

const CSS = String.raw`
@keyframes x-grow{from{transform:scaleY(0)}to{transform:scaleY(1)}}
@keyframes x-bar{from{transform:scaleX(0)}to{transform:scaleX(1)}}
@keyframes x-type{0%,60%,100%{transform:translateY(0);opacity:.4}30%{transform:translateY(-5px);opacity:1}}
@keyframes x-bub{from{opacity:0;transform:translateY(14px) scale(.96)}to{opacity:1;transform:none}}
@keyframes x-gone{to{opacity:0;height:0;margin:0;padding:0}}

/* ================================================================== sxdash: business dashboard */
.l-sxdash{--r:16px;background:color-mix(in srgb,var(--p) 5%,var(--bg))}
.l-sxdash .x-db{padding:16px 18px 62px;color:var(--onp);background:linear-gradient(140deg,var(--p),color-mix(in srgb,var(--p) 60%,var(--s)));border-radius:0 0 30px 30px}
.l-sxdash .x-dtop{display:flex;justify-content:space-between;align-items:center}
.l-sxdash .x-org{display:inline-flex;align-items:center;gap:7px;font-size:11.5px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;opacity:.9}
.l-sxdash .x-ic{width:42px;height:42px;border-radius:13px;border:0;display:grid;place-items:center;font-size:18px;cursor:pointer;color:inherit;background:color-mix(in srgb,var(--onp) 15%,transparent)}
.l-sxdash .x-did{display:grid;grid-template-columns:auto 1fr;gap:16px;align-items:center;margin-top:24px}
.l-sxdash .avatar{width:82px;height:82px;border-radius:24px;border:3px solid color-mix(in srgb,var(--onp) 60%,transparent);box-shadow:0 18px 30px -16px rgba(0,0,0,.6)}
.l-sxdash .avatar.ph{font-size:27px;background:color-mix(in srgb,var(--onp) 18%,transparent)}
.l-sxdash .name{display:block;text-align:start;font-size:26px;font-weight:800;line-height:1.08;letter-spacing:-.03em;color:inherit}
.l-sxdash .name i{color:inherit;font-size:.65em;margin-inline-start:5px;vertical-align:middle}
.l-sxdash .role{text-align:start;color:inherit;opacity:.86;font-size:14px;margin-top:5px}
.l-sxdash .x-kpi{position:relative;display:grid;grid-auto-flow:column;grid-auto-columns:1fr;margin:-40px 16px 0;border-radius:20px;background:var(--bg);box-shadow:0 24px 44px -28px rgba(15,23,42,.6),0 0 0 1px var(--line);animation:x-in .8s .1s var(--ease) both}
.l-sxdash .x-kpi div{padding:16px 6px 14px;text-align:center;min-width:0}
.l-sxdash .x-kpi div+div{border-inline-start:1px solid var(--line)}
.l-sxdash .x-kpi b{display:grid;place-items:center;height:30px;font-size:25px;font-weight:800;letter-spacing:-.03em;color:var(--p)}
.l-sxdash .x-kpi span{display:block;margin-top:3px;font-size:10.5px;font-weight:600;letter-spacing:.04em;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.l-sxdash .x-dot{display:block;width:12px;height:12px;margin:0;border-radius:50%;background:#9ca3af}
.l-sxdash .is-open .x-dot{background:#22c55e;animation:x-ping 2s ease-out infinite}
.l-sxdash .x-cta{display:grid;grid-template-columns:1fr 1fr;gap:10px;padding:16px 16px 0}
.l-sxdash .x-big{display:flex;align-items:center;gap:12px;padding:15px 14px;border-radius:18px;min-width:0;background:var(--p);color:var(--onp);box-shadow:0 18px 30px -18px var(--p);transition:transform .3s var(--ease)}
.l-sxdash .x-big:nth-child(2){background:var(--s);color:var(--ons);box-shadow:0 18px 30px -18px var(--s)}
.l-sxdash .x-big:only-child,.l-sxdash .x-big:first-child:nth-last-child(odd){grid-column:span 2}
.l-sxdash .x-big>i{font-size:24px;flex:none}
.l-sxdash .x-big span{min-width:0}
.l-sxdash .x-big b{display:block;font-size:15.5px}
.l-sxdash .x-big small{display:block;font-size:11.5px;opacity:.85;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.l-sxdash .x-big:hover{transform:translateY(-3px)}
.l-sxdash .x-sm{display:flex;align-items:center;justify-content:center;gap:8px;height:46px;border-radius:14px;font-size:13px;font-weight:600;background:var(--bg);border:1px solid var(--line);color:var(--tx)}
.l-sxdash .x-sm i{font-size:17px;color:var(--p)}
.l-sxdash .x-sm:last-child:nth-child(odd){grid-column:span 2}
.l-sxdash .save{margin:10px 16px 0;height:50px;border-radius:14px;background:transparent;border:1.5px dashed color-mix(in srgb,var(--p) 55%,transparent);color:var(--p);box-shadow:none;font-size:14.5px}
.l-sxdash .save:after{display:none}
.l-sxdash .save:hover{background:var(--chip);box-shadow:none}
.l-sxdash .install{margin-inline:16px;width:calc(100% - 32px)}
.l-sxdash .sec{margin:12px 16px 0;padding:18px 16px 16px;border-radius:20px;background:var(--bg);box-shadow:0 0 0 1px var(--line)}
.l-sxdash .sec h3{margin:0 0 12px;color:var(--tx);font-size:13px;letter-spacing:.06em}
.l-sxdash .sec h3 i{width:30px;height:30px;border-radius:9px;display:grid;place-items:center;background:var(--chip)}
.l-sxdash .box,.l-sxdash .links a,.l-sxdash .pays a,.l-sxdash .post{background:color-mix(in srgb,var(--p) 4%,var(--bg));box-shadow:none;border-color:transparent}
.l-sxdash .s-about .box{background:none;padding:0}
.l-sxdash .foot{padding-top:24px}

/* ================================================================== sxtimeline: sections on a numbered line */
.l-sxtimeline{--r:18px}
.l-sxtimeline .x-th{padding:40px 24px 0}
.l-sxtimeline .avatar{width:96px;height:96px;border:0;box-shadow:0 0 0 4px var(--bg),0 0 0 6px var(--p)}
.l-sxtimeline .avatar.ph{font-size:32px}
.l-sxtimeline .name{display:block;text-align:start;margin-top:24px;font-size:clamp(36px,11vw,46px);font-weight:700;line-height:1;letter-spacing:-.045em;overflow-wrap:anywhere}
.l-sxtimeline .name i{font-size:.42em;vertical-align:.35em;margin-inline-start:6px}
.l-sxtimeline .role{text-align:start;margin-top:12px;font-size:16px;font-weight:600;color:var(--p)}
.l-sxtimeline .x-chips{display:flex;flex-wrap:wrap;gap:6px 16px;margin-top:14px;font-size:13.5px;color:var(--muted)}
.l-sxtimeline .x-chips span{display:inline-flex;align-items:center;gap:6px}
.l-sxtimeline .x-acts{display:flex;gap:8px;overflow-x:auto;scrollbar-width:none;padding:24px 24px 0}
.l-sxtimeline .x-acts::-webkit-scrollbar{display:none}
.l-sxtimeline .x-ab{flex:none;display:inline-flex;align-items:center;gap:8px;height:44px;padding:0 16px;border-radius:999px;border:1px solid var(--line);background:var(--card);font:inherit;font-size:13.5px;font-weight:600;color:var(--tx);cursor:pointer;transition:background .25s,color .25s,border-color .25s}
.l-sxtimeline .x-ab i{color:var(--p);font-size:17px}
.l-sxtimeline .x-ab:hover{background:var(--p);color:var(--onp);border-color:var(--p)}
.l-sxtimeline .x-ab:hover i{color:inherit}
.l-sxtimeline .save{margin:14px 24px 0;border-radius:16px}
.l-sxtimeline .install{margin-inline:24px;width:calc(100% - 48px)}
.l-sxtimeline .x-spine{position:relative;margin-top:44px;padding:0 20px 0 62px}
.l-sxtimeline .x-spine:before,.l-sxtimeline .x-fill{content:"";position:absolute;top:0;bottom:0;inset-inline-start:37px;width:2px;background:var(--line)}
.l-sxtimeline .x-fill{background:linear-gradient(var(--p),var(--s));transform-origin:top;transform:scaleY(0)}
@supports (animation-timeline:view()){.l-sxtimeline .x-fill{animation:x-grow linear both;animation-timeline:view();animation-range:entry 20% exit 60%}}
.l-sxtimeline .x-node{position:relative;padding-bottom:34px}
.l-sxtimeline .x-n{position:absolute;top:0;inset-inline-start:-44px;width:40px;height:40px;border-radius:50%;display:grid;place-items:center;font-size:12px;font-weight:700;background:var(--bg);color:var(--p);box-shadow:0 0 0 2px var(--p),0 0 0 7px var(--bg)}
.l-sxtimeline .x-node .sec{padding:0}
.l-sxtimeline .x-node .sec h3{margin:0 0 14px;min-height:40px;color:var(--tx);font-size:19px;font-weight:700;letter-spacing:-.02em;text-transform:none}
.l-sxtimeline .x-node .sec h3 i{display:none}
.l-sxtimeline .gal{grid-template-columns:1fr 1fr}

/* ================================================================== sxletter: a formal letter */
.l-sxletter{--r:2px;background:color-mix(in srgb,var(--tx) 6%,var(--bg))}
.l-sxletter .x-letter{position:relative;margin:18px 14px 0;padding:34px 26px 30px;background:var(--bg);box-shadow:0 1px 2px rgba(0,0,0,.08),0 30px 50px -34px rgba(0,0,0,.5);animation:x-in .9s var(--ease) both}
.l-sxletter .x-letter:before{content:"";position:absolute;inset:0 0 auto;height:5px;background:var(--p)}
.l-sxletter .x-lh{position:relative;text-align:center;padding-bottom:20px;border-bottom:3px double var(--tx)}
.l-sxletter .x-crest{display:grid;place-items:center;width:58px;height:58px;margin:0 auto 12px;border-radius:50%;border:1px solid var(--s);box-shadow:0 0 0 4px var(--bg),0 0 0 5px var(--s);font-size:18px;letter-spacing:.06em;color:var(--p)}
.l-sxletter .x-firm{font-size:13px;font-weight:700;letter-spacing:.3em;text-transform:uppercase;color:var(--p)}
.l-sxletter .x-addr{margin-top:5px;font-size:12.5px;font-style:italic;color:var(--muted)}
.l-sxletter .x-shr{position:absolute;top:-16px;inset-inline-end:-10px;display:inline-flex;align-items:center;gap:5px;background:none;border:0;font:inherit;font-size:11.5px;color:var(--s);cursor:pointer}
.l-sxletter .x-lbody .sec{padding:26px 0 0;animation:none}
.l-sxletter .x-lbody .sec h3{display:none}
.l-sxletter .x-lbody .box{background:none;border:0;box-shadow:none;padding:0;font-size:16px;line-height:1.85;text-align:justify;hyphens:auto}
.l-sxletter .x-lbody .box:first-letter{font-size:3em;float:inline-start;line-height:.82;padding:5px 8px 0 0;color:var(--p)}
.l-sxletter .x-sig{display:grid;grid-template-columns:auto 1fr;gap:14px;align-items:center;margin-top:30px}
.l-sxletter .avatar{width:60px;height:60px;border:1px solid var(--s);padding:3px;background:var(--bg);box-shadow:none}
.l-sxletter .avatar.ph{font-size:19px;background:var(--p);background-clip:content-box}
.l-sxletter .name{display:block;text-align:start;font-size:29px;font-weight:500;font-style:italic;letter-spacing:-.01em;line-height:1.1}
.l-sxletter .name i{font-size:.55em;font-style:normal;margin-inline-start:5px;vertical-align:middle;color:var(--s)}
.l-sxletter .role{text-align:start;margin-top:4px;font-size:11px;letter-spacing:.24em;text-transform:uppercase;color:var(--s);font-weight:600}
.l-sxletter .x-notes{list-style:none;counter-reset:fn;margin-top:28px;padding-top:14px;border-top:1px solid var(--tx)}
.l-sxletter .x-notes li{counter-increment:fn}
.l-sxletter .x-nt{display:grid;grid-template-columns:22px 96px 1fr;align-items:baseline;padding:7px 0;font-size:13.5px;transition:color .25s}
.l-sxletter .x-nt:before{content:counter(fn);font-size:10px;vertical-align:super;color:var(--s);font-weight:700}
.l-sxletter .x-nt b{font-weight:600}
.l-sxletter .x-nt span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-decoration:underline;text-decoration-color:color-mix(in srgb,var(--s) 60%,transparent);text-underline-offset:3px}
.l-sxletter .x-nt:hover{color:var(--s)}
.l-sxletter .save{margin:26px 0 0;height:60px;border-radius:2px;justify-content:flex-start;gap:16px;padding:0 20px 0 12px;background:var(--p);box-shadow:none;letter-spacing:.2em;text-transform:uppercase;font-size:12px}
.l-sxletter .save:after{display:none}
.l-sxletter .x-seal{width:40px;height:40px;border-radius:50%;display:grid;place-items:center;background:var(--s);color:var(--ons);box-shadow:0 0 0 3px color-mix(in srgb,var(--s) 40%,transparent);transition:transform .5s var(--ease)}
.l-sxletter .save:hover .x-seal{transform:rotate(-14deg) scale(1.08)}
.l-sxletter .install{margin-inline:14px;width:calc(100% - 28px)}
.l-sxletter .sec{padding:34px 26px 0}
.l-sxletter .sec h3{justify-content:center;margin:0 0 14px;color:var(--p);font-size:11.5px;letter-spacing:.3em}
.l-sxletter .sec h3 i{display:none}
.l-sxletter .box,.l-sxletter .links a,.l-sxletter .pays a,.l-sxletter .post{background:var(--bg);box-shadow:none;border-color:var(--line)}
.l-sxletter .row>i:not(.go),.l-sxletter .links a i,.l-sxletter .svc .ic{background:transparent;color:var(--s)}
.l-sxletter .social{display:flex;flex-wrap:wrap;justify-content:center}
.l-sxletter .social a{width:48px;border-radius:50%;background:var(--bg);box-shadow:none;border-color:var(--s);color:var(--p)}

/* ================================================================== sxclinic: appointment first */
.l-sxclinic{--r:20px;background:color-mix(in srgb,var(--p) 6%,var(--bg))}
.l-sxclinic .x-cl{padding:16px 16px 0}
.l-sxclinic .x-clt{display:grid;grid-template-columns:auto 1fr auto;gap:10px;align-items:center}
.l-sxclinic .x-plus{width:38px;height:38px;border-radius:12px;background:linear-gradient(#fff,#fff) center/18px 5px no-repeat,linear-gradient(#fff,#fff) center/5px 18px no-repeat,var(--p);animation:x-bob 3s ease-in-out infinite alternate}
.l-sxclinic .x-org{font-size:13.5px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.l-sxclinic .x-ic{width:40px;height:40px;border-radius:50%;border:0;background:var(--bg);color:var(--p);font-size:17px;cursor:pointer;display:grid;place-items:center}
.l-sxclinic .x-clc{display:grid;grid-template-columns:auto 1fr;gap:16px;align-items:center;margin-top:16px;padding:18px;border-radius:24px;background:var(--bg);box-shadow:0 20px 40px -30px color-mix(in srgb,var(--p) 80%,#000);animation:x-in .8s var(--ease) both}
.l-sxclinic .avatar{width:96px;height:112px;border-radius:20px;border:0;box-shadow:none}
.l-sxclinic .avatar.ph{font-size:32px}
.l-sxclinic .name{display:block;text-align:start;font-size:22px;font-weight:700;line-height:1.15;letter-spacing:-.02em}
.l-sxclinic .name i{font-size:.75em;margin-inline-start:4px;vertical-align:middle}
.l-sxclinic .role{display:inline-block;margin-top:8px;padding:4px 11px;border-radius:999px;font-size:12.5px;font-weight:600;background:color-mix(in srgb,var(--s) 18%,transparent);color:color-mix(in srgb,var(--s) 60%,var(--tx))}
.l-sxclinic .x-st{display:flex;align-items:center;gap:7px;margin-top:10px;font-size:12.5px;font-weight:600;color:var(--muted)}
.l-sxclinic .x-dot{width:9px;height:9px;border-radius:50%;background:#9ca3af}
.l-sxclinic .is-open .x-dot{background:#22c55e;animation:x-ping 2s ease-out infinite}
.l-sxclinic .x-book{margin:12px 16px 0;padding:18px;border-radius:24px;color:var(--onp);background:linear-gradient(135deg,var(--p),color-mix(in srgb,var(--p) 55%,var(--s)));animation:x-in .8s .1s var(--ease) both}
.l-sxclinic .x-book p{display:flex;align-items:center;gap:8px;font-size:17px;font-weight:700;letter-spacing:-.01em}
.l-sxclinic .x-book p i{font-size:21px}
.l-sxclinic .x-book div{display:grid;grid-auto-flow:column;grid-auto-columns:1fr;gap:8px;margin-top:14px}
.l-sxclinic .x-book div:empty{display:none}
.l-sxclinic .x-bk{display:flex;align-items:center;justify-content:center;gap:8px;height:48px;border-radius:15px;font-size:14px;font-weight:700;background:#fff;color:var(--p);min-width:0;transition:transform .3s var(--ease)}
.l-sxclinic .x-alt{background:color-mix(in srgb,#fff 18%,transparent);color:inherit}
.l-sxclinic .x-bk:hover{transform:translateY(-2px)}
.l-sxclinic .x-facts{display:grid;grid-auto-flow:column;grid-auto-columns:1fr;gap:8px;padding:12px 16px 0}
.l-sxclinic .x-facts div{min-width:0;padding:14px 12px;border-radius:18px;background:var(--bg)}
.l-sxclinic .x-facts i{display:grid;place-items:center;width:34px;height:34px;border-radius:50%;font-size:17px;background:var(--chip);color:var(--p)}
.l-sxclinic .x-facts small{display:block;margin-top:10px;font-size:11px;color:var(--muted)}
.l-sxclinic .x-facts b{display:block;font-size:12.5px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.l-sxclinic .install{margin-inline:16px;width:calc(100% - 32px)}
.l-sxclinic .sec{padding:26px 16px 0;scroll-margin-top:16px}
.l-sxclinic .sec h3 i{width:28px;height:28px;border-radius:9px;display:grid;place-items:center;background:var(--bg)}
.l-sxclinic .box,.l-sxclinic .links a,.l-sxclinic .pays a,.l-sxclinic .post,.l-sxclinic .social a{background:var(--bg);border-color:transparent;box-shadow:none}
.l-sxclinic .row>i:not(.go),.l-sxclinic .svc .ic{border-radius:50%}
.l-sxclinic~.x-bar2{position:fixed;z-index:20;left:50%;bottom:0;transform:translateX(-50%);width:min(480px,100%);display:grid;grid-template-columns:1fr 1.4fr;gap:8px;padding:10px 14px calc(10px + env(safe-area-inset-bottom));background:color-mix(in srgb,var(--bg) 84%,transparent);backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);border-top:1px solid var(--line)}
.l-sxclinic~.x-bar2.x-static{position:static;transform:none;margin:0 auto}
.l-sxclinic~.x-bar2 .x-call{display:flex;align-items:center;justify-content:center;gap:8px;height:52px;border-radius:16px;font-weight:700;font-size:15px;background:var(--chip);color:var(--p)}
.l-sxclinic~.x-bar2 .save{margin:0;height:52px;border-radius:16px;font-size:15px;box-shadow:none;animation:none}
.l-sxclinic~.x-bar2 .save:only-child{grid-column:span 2}

/* ================================================================== sxposter: a poster grid */
.l-sxposter{--r:0px;--bd:2px solid var(--tx)}
.l-sxposter .x-po{display:grid;grid-template-columns:1fr 1fr;border-bottom:var(--bd)}
.l-sxposter .x-c1{position:relative;aspect-ratio:1;overflow:hidden;background:var(--p);color:var(--onp);border-inline-end:var(--bd)}
.l-sxposter .x-c1 span{position:absolute;left:-6px;bottom:-26px;font-size:150px;font-weight:800;line-height:1;letter-spacing:-.08em;transform:rotate(-8deg);transform-origin:bottom left;animation:x-in 1s var(--ease) both}
.l-sxposter .x-c2{position:relative;aspect-ratio:1;display:grid;place-items:center;background:var(--s)}
.l-sxposter .avatar{width:58%;height:58%;border-radius:50%;border:var(--bd);box-shadow:none;object-fit:cover}
.l-sxposter .avatar.ph{font-size:40px;background:var(--bg);color:var(--tx)}
.l-sxposter .x-ring{position:absolute;inset:6%;animation:x-spin 22s linear infinite}
.l-sxposter .x-ring text{font-size:8.2px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;fill:var(--ons)}
.l-sxposter .x-c3{grid-column:span 2;padding:18px 18px 14px;border-top:var(--bd);overflow:hidden}
.l-sxposter .name{display:block;text-align:start;font-size:clamp(54px,17.5vw,84px);font-weight:800;line-height:.86;letter-spacing:-.06em;text-transform:uppercase;overflow-wrap:anywhere;animation:x-rise .9s var(--ease) both}
.l-sxposter .name i{font-size:.24em;vertical-align:1.4em;margin-inline-start:6px}
.l-sxposter .x-c4{grid-column:span 2;display:flex;flex-wrap:wrap;align-items:center;gap:8px 14px;padding:12px 18px;border-top:var(--bd);background:var(--tx);color:var(--bg)}
.l-sxposter .role{margin:0;color:inherit;font-size:13px;font-weight:700;letter-spacing:.14em;text-transform:uppercase}
.l-sxposter .x-co{font-size:13px;opacity:.75}
.l-sxposter .x-shr{margin-inline-start:auto;display:inline-flex;align-items:center;gap:4px;background:none;border:0;font:inherit;font-size:13px;font-weight:700;color:var(--p);cursor:pointer}
.l-sxposter .x-stk{display:flex;flex-wrap:wrap;gap:10px;padding:24px 18px 0}
.l-sxposter .x-s{display:inline-flex;align-items:center;gap:8px;height:50px;padding:0 20px;border:var(--bd);border-radius:999px;font-size:15px;font-weight:700;background:var(--bg);box-shadow:4px 4px 0 var(--tx);animation:x-in .7s var(--ease) both;transition:transform .25s var(--ease),box-shadow .25s,background .2s}
.l-sxposter .x-s:nth-child(odd){transform:rotate(-2deg)}
.l-sxposter .x-s:nth-child(even){transform:rotate(1.5deg);background:var(--s);color:var(--ons)}
.l-sxposter .x-s:nth-child(3n){background:var(--p);color:var(--onp)}
.l-sxposter .x-s:hover{transform:translate(-2px,-2px) rotate(0);box-shadow:7px 7px 0 var(--tx)}
.l-sxposter .save{margin:22px 18px 0;height:66px;border-radius:0;justify-content:space-between;padding:0 22px;background:var(--tx);color:var(--bg);box-shadow:6px 6px 0 var(--p);font-size:19px;font-weight:800;text-transform:uppercase;letter-spacing:-.01em}
.l-sxposter .save:after{display:none}
.l-sxposter .save:hover{transform:translate(-2px,-2px);box-shadow:9px 9px 0 var(--p)}
.l-sxposter .install{margin-inline:18px;width:calc(100% - 36px);border-radius:0}
.l-sxposter .sec{padding:44px 18px 0}
.l-sxposter .sec h3{margin:0 0 14px;color:var(--tx);font-size:30px;font-weight:800;letter-spacing:-.04em;text-transform:uppercase}
.l-sxposter .sec h3 i{display:none}
.l-sxposter .box,.l-sxposter .links a,.l-sxposter .pays a,.l-sxposter .post,.l-sxposter .prod{border:var(--bd);border-radius:0;box-shadow:5px 5px 0 var(--tx);background:var(--bg)}
.l-sxposter .row>i:not(.go),.l-sxposter .links a i,.l-sxposter .svc .ic{border-radius:0;background:var(--s);color:var(--ons)}
.l-sxposter .social a{border:var(--bd);border-radius:50%;box-shadow:3px 3px 0 var(--tx);background:var(--bg);color:var(--tx)}
.l-sxposter .gal{gap:0;border:var(--bd)}
.l-sxposter .gal a{border-radius:0}
.l-sxposter .btn,.l-sxposter .chips button,.l-sxposter form.enq input,.l-sxposter form.enq textarea{border-radius:0}
.l-sxposter .foot{margin-top:44px;border-top:var(--bd)}

/* ================================================================== sxstory: a social profile */
.l-sxstory{--r:16px}
.l-sxstory .x-sy{padding:12px 16px 0}
.l-sxstory .x-bars{display:grid;grid-auto-flow:column;grid-auto-columns:1fr;gap:4px}
.l-sxstory .x-bars span{position:relative;height:3px;border-radius:3px;overflow:hidden;background:var(--line)}
.l-sxstory .x-bars span:after{content:"";position:absolute;inset:0;background:var(--tx);transform-origin:left;transform:scaleX(0);animation:x-bar 2.2s linear forwards}
.l-sxstory .x-bars span:nth-child(2):after{animation-delay:2.2s}
.l-sxstory .x-bars span:nth-child(3):after{animation-delay:4.4s}
.l-sxstory .x-syr{display:grid;grid-template-columns:auto 1fr auto;gap:14px;align-items:center;margin-top:20px}
.l-sxstory .x-ringw{position:relative;width:88px;height:88px;border-radius:50%;padding:4px;background:conic-gradient(var(--p),var(--s),var(--p))}
.l-sxstory .avatar{width:100%;height:100%;border:3px solid var(--bg);box-shadow:none}
.l-sxstory .avatar.ph{font-size:26px}
.l-sxstory .name{display:block;text-align:start;font-size:21px;font-weight:800;letter-spacing:-.02em;line-height:1.15}
.l-sxstory .name i{font-size:.8em;margin-inline-start:4px;vertical-align:middle;color:#3897f0}
.l-sxstory .role{text-align:start;margin-top:3px;font-size:14px}
.l-sxstory .x-ic{width:40px;height:40px;border-radius:50%;border:1px solid var(--line);background:none;color:var(--tx);font-size:17px;cursor:pointer;display:grid;place-items:center}
.l-sxstory .x-bio{margin-top:14px;font-size:14px;color:var(--muted)}
.l-sxstory .x-igb{display:grid;grid-template-columns:1.3fr 2fr;gap:6px;padding:16px 16px 0}
.l-sxstory .save{margin:0;height:38px;border-radius:10px;font-size:14px;font-weight:700;box-shadow:none;background:linear-gradient(110deg,var(--p),var(--s))}
.l-sxstory .x-igb .x-actions{display:grid;grid-auto-flow:column;grid-auto-columns:1fr;gap:6px}
.l-sxstory .x-ig{display:flex;align-items:center;justify-content:center;gap:5px;height:38px;border-radius:10px;font-size:13px;font-weight:700;min-width:0;background:color-mix(in srgb,var(--tx) 8%,var(--bg));color:var(--tx);transition:background .2s}
.l-sxstory .x-ig span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.l-sxstory .x-ig:hover{background:color-mix(in srgb,var(--tx) 16%,var(--bg))}
.l-sxstory .x-hl{display:flex;gap:14px;overflow-x:auto;scrollbar-width:none;padding:22px 16px 4px}
.l-sxstory .x-hl::-webkit-scrollbar{display:none}
.l-sxstory .x-hl a{flex:none;width:68px;text-align:center;animation:x-in .6s var(--ease) both;animation-delay:calc(var(--i,0) * 50ms)}
.l-sxstory .x-hl span{display:grid;place-items:center;width:66px;height:66px;margin:0 auto;border-radius:50%;font-size:26px;color:#fff;background:var(--bc);box-shadow:0 0 0 3px var(--bg),0 0 0 5px color-mix(in srgb,var(--bc) 70%,transparent);transition:transform .35s var(--ease)}
.l-sxstory .x-hl a:hover span{transform:scale(1.08) rotate(-6deg)}
.l-sxstory .x-hl small{display:block;margin-top:8px;font-size:11px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.l-sxstory .install{margin-inline:16px;width:calc(100% - 32px)}
.l-sxstory .sec{padding:26px 16px 0}
.l-sxstory .sec h3{color:var(--tx);font-size:15px;font-weight:800;letter-spacing:-.01em;text-transform:none}
.l-sxstory .sec h3 i{display:none}
.l-sxstory .box,.l-sxstory .pays a,.l-sxstory .post{box-shadow:none}
.l-sxstory .s-about .box{background:none;border:0;padding:0}
.l-sxstory .links a{border:0;box-shadow:none;padding:18px 16px 18px 20px;color:#fff;background:linear-gradient(110deg,var(--p),var(--s))}
.l-sxstory .links a:nth-child(even){background:linear-gradient(110deg,var(--s),var(--p))}
.l-sxstory .links a i{background:rgba(255,255,255,.22);color:#fff}
.l-sxstory .gal{gap:2px;margin-inline:-16px}
.l-sxstory .gal a{border-radius:0}

/* ================================================================== sxchat: a conversation */
.l-sxchat{--r:18px;overflow:clip;background:color-mix(in srgb,var(--p) 7%,var(--bg))}
.l-sxchat .x-cht{position:sticky;top:0;z-index:6;display:grid;grid-template-columns:auto 1fr auto;gap:12px;align-items:center;padding:12px 16px;background:color-mix(in srgb,var(--bg) 82%,transparent);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);border-bottom:1px solid var(--line)}
.l-sxchat .avatar{width:44px;height:44px;border:0;box-shadow:none}
.l-sxchat .avatar.ph{font-size:15px}
.l-sxchat .name{display:block;text-align:start;font-size:16px;font-weight:700}
.l-sxchat .name i{font-size:.9em;margin-inline-start:4px;vertical-align:middle}
.l-sxchat .x-on{display:flex;align-items:center;gap:6px;font-size:12px;color:var(--muted)}
.l-sxchat .x-dot{width:8px;height:8px;border-radius:50%;background:#9ca3af}
.l-sxchat .is-open .x-dot{background:#22c55e;animation:x-ping 2s ease-out infinite}
.l-sxchat .x-ic{width:40px;height:40px;border-radius:50%;border:0;background:var(--chip);color:var(--p);font-size:17px;cursor:pointer;display:grid;place-items:center}
.l-sxchat .x-thread{display:flex;flex-direction:column;align-items:flex-start;gap:8px;padding:20px 14px 0}
.l-sxchat .x-b{max-width:86%;padding:12px 16px;border-radius:20px 20px 20px 6px;background:var(--bg);font-size:15.5px;line-height:1.5;box-shadow:0 10px 20px -16px rgba(15,23,42,.5);animation:x-bub .5s var(--ease) both}
.l-sxchat .x-b:nth-child(1){animation-delay:.3s}.l-sxchat .x-b:nth-child(2){animation-delay:.9s}
.l-sxchat .x-b .role{margin:0;text-align:start;color:var(--tx);font-weight:600;font-size:15.5px}
.l-sxchat .x-typing{display:flex;gap:4px;padding:14px 16px;border-radius:20px 20px 20px 6px;background:var(--bg);overflow:hidden;animation:x-bub .4s 1.3s var(--ease) both,x-gone .3s 2.3s forwards}
.l-sxchat .x-typing span{width:7px;height:7px;border-radius:50%;background:var(--muted);animation:x-type 1s infinite}
.l-sxchat .x-typing span:nth-child(2){animation-delay:.15s}.l-sxchat .x-typing span:nth-child(3){animation-delay:.3s}
.l-sxchat .x-qr{align-self:flex-end;display:flex;flex-wrap:wrap;justify-content:flex-end;gap:8px;max-width:94%;margin:6px 0;animation:x-bub .5s 2.4s var(--ease) both}
.l-sxchat .x-chip{display:inline-flex;align-items:center;gap:7px;height:42px;padding:0 16px;border-radius:999px;font-size:14px;font-weight:600;background:var(--p);color:var(--onp);box-shadow:0 12px 20px -14px var(--p);transition:transform .3s var(--ease)}
.l-sxchat .x-chip:hover{transform:translateY(-3px) scale(1.03)}
.l-sxchat .x-b.x-vcf{width:86%;padding:8px;animation-delay:2.7s}
.l-sxchat .x-vc{display:grid;grid-template-columns:auto 1fr;gap:12px;align-items:center;padding:8px}
.l-sxchat .x-vi{width:46px;height:46px;border-radius:14px;display:grid;place-items:center;font-size:22px;background:var(--chip);color:var(--p)}
.l-sxchat .x-vc b{display:block;font-size:15px}
.l-sxchat .x-vc small{display:block;font-size:12px;color:var(--muted)}
.l-sxchat .save{margin:4px 0 0;height:44px;border-radius:14px;background:var(--chip);color:var(--p);box-shadow:none;font-size:14.5px;font-weight:700;animation:none}
.l-sxchat .save:after{display:none}
.l-sxchat .save:hover{background:var(--p);color:var(--onp)}
.l-sxchat .install{margin:0;width:86%}
.l-sxchat .x-msg{width:94%;margin-top:14px}
.l-sxchat .x-lab{display:inline-flex;align-items:center;gap:6px;margin:0 0 6px 6px;font-size:11.5px;font-weight:600;color:var(--muted)}
.l-sxchat .x-lab i{color:var(--p);font-size:14px}
.l-sxchat .x-msg .sec{padding:14px;border-radius:20px 20px 20px 6px;background:var(--bg);box-shadow:0 10px 20px -16px rgba(15,23,42,.5)}
.l-sxchat .x-msg .sec h3{display:none}
.l-sxchat .x-msg .box,.l-sxchat .x-msg .links a,.l-sxchat .x-msg .pays a,.l-sxchat .x-msg .social a{background:color-mix(in srgb,var(--p) 5%,var(--bg));border-color:transparent;box-shadow:none}
.l-sxchat .s-about .box{background:none;padding:0}
.l-sxchat .gal{grid-template-columns:1fr 1fr}

/* ================================================================== sxlisting: a property listing */
.l-sxlisting{--r:14px}
.l-sxlisting .x-ls{position:relative}
.l-sxlisting .x-car{display:flex;height:300px;overflow-x:auto;scroll-snap-type:x mandatory;scrollbar-width:none}
.l-sxlisting .x-car::-webkit-scrollbar{display:none}
.l-sxlisting .x-car img{flex:0 0 100%;width:100%;height:100%;object-fit:cover;scroll-snap-align:start}
.l-sxlisting .x-none{background:linear-gradient(var(--s),var(--s)) 8% 100%/15% 46% no-repeat,linear-gradient(var(--s),var(--s)) 30% 100%/19% 74% no-repeat,linear-gradient(var(--s),var(--s)) 56% 100%/16% 38% no-repeat,linear-gradient(var(--s),var(--s)) 82% 100%/21% 60% no-repeat,linear-gradient(160deg,color-mix(in srgb,var(--p) 78%,#000),var(--p));background-blend-mode:soft-light,soft-light,soft-light,soft-light,normal}
.l-sxlisting .x-none.x-img{background-size:cover;background-position:center;background-blend-mode:normal}
.l-sxlisting .x-cnt{position:absolute;top:16px;inset-inline-start:16px;display:inline-flex;align-items:center;gap:6px;padding:7px 12px;border-radius:999px;font-size:12.5px;font-weight:700;color:#fff;background:rgba(0,0,0,.5);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px)}
.l-sxlisting .x-ic{position:absolute;top:14px;inset-inline-end:14px;width:44px;height:44px;border-radius:50%;border:0;background:rgba(255,255,255,.92);color:#111;font-size:18px;cursor:pointer;display:grid;place-items:center;box-shadow:0 8px 20px -8px rgba(0,0,0,.5)}
.l-sxlisting .x-agent{position:relative;z-index:2;display:grid;grid-template-columns:auto 1fr;gap:14px;align-items:center;margin:-64px 16px 0;padding:14px;border-radius:18px;background:var(--bg);border-bottom:3px solid var(--s);box-shadow:0 30px 50px -30px rgba(10,20,40,.7);animation:x-in .8s var(--ease) both}
.l-sxlisting .avatar{width:86px;height:104px;border-radius:12px;border:0;box-shadow:none}
.l-sxlisting .avatar.ph{font-size:28px}
.l-sxlisting .name{display:block;text-align:start;font-size:21px;font-weight:700;letter-spacing:-.02em;line-height:1.15}
.l-sxlisting .name i{font-size:.75em;margin-inline-start:4px;vertical-align:middle}
.l-sxlisting .role{text-align:start;margin-top:5px;font-size:11.5px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:color-mix(in srgb,var(--s) 70%,var(--tx))}
.l-sxlisting .x-co{margin-top:6px;font-size:13px;color:var(--muted)}
.l-sxlisting .x-tags{display:flex;gap:8px;overflow-x:auto;scrollbar-width:none;padding:16px 16px 0}
.l-sxlisting .x-tags>*{flex:none;display:inline-flex;align-items:center;gap:6px;padding:9px 14px;border-radius:10px;font-size:13px;font-weight:600;background:var(--chip);color:var(--tx)}
.l-sxlisting .x-tags i{color:var(--p)}
.l-sxlisting .x-mini{display:grid;grid-auto-flow:column;grid-auto-columns:1fr;gap:8px;padding:10px 16px 0}
.l-sxlisting .x-mini:empty{display:none}
.l-sxlisting .x-mi{display:flex;align-items:center;justify-content:center;gap:7px;height:46px;border-radius:12px;border:1px solid var(--line);font-size:13px;font-weight:600;min-width:0}
.l-sxlisting .x-mi i{color:var(--p);font-size:17px}
.l-sxlisting .x-mi span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.l-sxlisting .save{margin:10px 16px 0;border-radius:12px;height:50px;font-size:15px;background:var(--tx);color:var(--bg);box-shadow:none}
.l-sxlisting .install{margin-inline:16px;width:calc(100% - 32px)}
.l-sxlisting .sec{padding:28px 16px 0}
.l-sxlisting .sec h3{color:var(--tx);font-size:18px;font-weight:700;letter-spacing:-.02em;text-transform:none}
.l-sxlisting .sec h3 i{display:none}
.l-sxlisting .gal{grid-template-columns:1fr 1fr;gap:10px}
.l-sxlisting .gal a{border-radius:12px}
.l-sxlisting .gal img{aspect-ratio:4/3}
.l-sxlisting .gal a:first-child{grid-column:span 2}
.l-sxlisting .gal a:first-child img{aspect-ratio:16/9}
.l-sxlisting .s-enquiry .box{border-top:3px solid var(--s)}
.l-sxlisting~.x-bar3{position:fixed;z-index:20;left:50%;bottom:0;transform:translateX(-50%);width:min(480px,100%);display:grid;grid-auto-flow:column;grid-auto-columns:1fr;gap:8px;padding:10px 14px calc(10px + env(safe-area-inset-bottom));background:color-mix(in srgb,var(--bg) 86%,transparent);backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);border-top:1px solid var(--line)}
.l-sxlisting~.x-bar3.x-static{position:static;transform:none;margin:0 auto}
.l-sxlisting~.x-bar3 a{display:flex;align-items:center;justify-content:center;gap:8px;height:52px;border-radius:14px;font-weight:700;font-size:15px;background:var(--p);color:var(--onp)}
.l-sxlisting~.x-bar3 .x-c2{background:var(--s);color:var(--ons)}
`;

module.exports = { designs, CSS };
