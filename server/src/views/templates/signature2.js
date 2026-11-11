/*
 * Signature designs, pack 2: minimal, luxury and corporate. See signature.js for the kit each design receives.
 *
 *   sxindex   a typographic index: one statement, a table of contact rows, sections as hairline accordions
 *   sxarch    arched portrait on a shelf, pill actions, a sticky chip bar that jumps between sections
 *   sxwave    soft colour wash, morphing photo, an app-style tab bar with a raised save button
 *   sxcontact a phone contact screen: square action buttons and grouped inset lists
 *   sxdeck    a metal card and every section as slides you swipe sideways, with dots
 *   sxspot    a stage: a light beam on the portrait, vertical side text, engraved links
 *   sxsign    a wide film-strip photo, a signature-style name that writes itself, key strip
 *   sxrail    a full-height colour rail with the actions, content beside it
 */
const designs = {
  sxindex: (k) => {
    const { v, L, esc } = k;
    const keys = k.order.filter((x) => k.blocks[x]);
    return {
      main: `<header class="x-top">${k.avatar()}<div><h1 class="name">${esc(k.fullName)}${k.verified}</h1>${k.roleP}</div>${k.share('x-ic', '<i class="ri-share-forward-line"></i>')}</header>
  ${k.sentence || k.role ? `<p class="x-lede">${esc(k.sentence || k.role)}</p>` : ''}
  <nav class="x-list x-actions" aria-label="Contact">${k.acts.map((a) => k.A(a, 'x-li', `<span>${a.label}</span><b>${esc(a.sub || '')}</b><i class="ri-arrow-right-up-line"></i>`)).join('')}</nav>
  ${k.save('', `<span>${L.save}</span><i class="ri-download-2-line"></i>`)}
  ${k.install}
  <div class="x-accs">${keys.map((x, i) => `<details class="x-acc" name="x-acc"${i === 0 ? ' open' : ''}><summary><em>${String(i + 1).padStart(2, '0')}</em><span>${k.HEAD[x]?.text || ''}</span><i class="ri-add-line" aria-hidden="true"></i></summary>${k.blocks[x]}</details>`).join('\n')}</div>`,
    };
  },

  sxarch: (k) => {
    const { v, L, esc } = k;
    const keys = k.order.filter((x) => k.blocks[x]);
    return {
      main: `<header class="x-arch"><span class="x-sun" aria-hidden="true"></span>
    <div class="x-frame">${k.avatar()}</div><span class="x-shelf" aria-hidden="true"></span>
    <h1 class="name">${esc(k.fullName)}${k.verified}</h1>${k.roleP}
    ${v.company || v.location ? `<div class="x-chips x-meta">${v.company ? `<span>${esc(v.company)}</span>` : ''}${v.location ? `<span>${esc(v.location)}</span>` : ''}</div>` : ''}
  </header>
  <nav class="x-pills x-actions" aria-label="Contact">${k.acts.map((a) => k.A(a, 'x-pill', `<i class="${a.icon}"></i>${a.label}`)).join('')}${k.share('x-pill', `<i class="ri-share-forward-fill"></i>${L.share}`)}</nav>
  ${k.save('', `<i class="ri-user-add-line"></i><span>${L.save}</span>`)}
  ${k.install}
  ${keys.length > 1 ? `<nav class="x-jump" aria-label="Sections">${keys.map((x) => `<button type="button" data-jump="${x}">${k.HEAD[x]?.text || ''}</button>`).join('')}</nav>` : ''}
  ${k.sections()}`,
      script: "$$('[data-jump]').forEach(function(b){b.addEventListener('click',function(){var s=$('.s-'+b.getAttribute('data-jump'));if(s)s.scrollIntoView({behavior:'smooth',block:'start'})})});",
    };
  },

  sxwave: (k) => {
    const { v, L, esc } = k;
    const [a1, a2, a3, a4] = k.acts;
    const tab = (a) => (a ? k.A(a, 'x-tb', `<i class="${a.icon}"></i><span>${a.label}</span>`) : '<span class="x-tb"></span>');
    return {
      main: `<header class="x-wv">
    <div class="x-txt">${k.roleP}<h1 class="name">${k.stacked}${k.verified}</h1></div>
    <div class="x-blob">${k.avatar()}</div>
    ${v.company || v.location || k.hoursText ? `<div class="x-chips x-meta">${v.company ? `<span><i class="ri-building-line"></i>${esc(v.company)}</span>` : ''}${v.location ? `<span><i class="ri-map-pin-line"></i>${esc(v.location)}</span>` : ''}${k.hoursText ? `<span><i class="ri-time-line"></i>${k.hoursText}</span>` : ''}</div>` : ''}
    ${k.share('x-shw', `<i class="ri-share-forward-line"></i>${L.share}`)}
  </header>
  ${k.install}
  ${k.sections()}`,
      dock: `<nav class="x-tabbar${v.sticky_bar === false ? ' x-static' : ''}" aria-label="Quick actions"><span class="x-actions">${tab(a1)}${tab(a2)}</span>${k.save('', `<i class="ri-user-add-fill"></i><span>${L.save}</span>`)}<span class="x-actions">${tab(a3)}${tab(a4)}</span></nav>`,
    };
  },

  sxcontact: (k) => {
    const { L, esc } = k;
    return {
      main: `<header class="x-ct">${k.share('x-edit', L.share)}${k.avatar()}<h1 class="name">${esc(k.fullName)}${k.verified}</h1>${k.roleP}${k.v.company ? `<p class="x-co x-meta">${esc(k.v.company)}</p>` : ''}</header>
  ${k.acts.length ? `<nav class="x-quad x-actions" aria-label="Contact">${k.acts.map((a) => k.A(a, 'x-qb', `<i class="${a.icon}"></i><span>${a.label}</span>`)).join('')}</nav>` : ''}
  <div class="x-grp">${k.save('', `<span>${L.save}</span><i class="ri-user-add-line"></i>`)}</div>
  ${k.install}
  ${k.sections()}`,
    };
  },

  sxdeck: (k) => {
    const { v, L, esc } = k;
    const keys = k.order.filter((x) => k.blocks[x]);
    return {
      main: `<header class="x-dh">${k.avatar()}<div><h1 class="name">${esc(k.fullName)}${k.verified}</h1>${k.roleP}</div>${k.share('x-ic', '<i class="ri-share-forward-line"></i>')}</header>
  <div class="x-deck">
    <article class="x-slide x-s0"><div class="x-metal"><div class="x-row1"><span class="x-mono">${esc(k.initials)}</span><i class="ri-wifi-line x-nfc" aria-hidden="true"></i></div>
      <div><p class="x-cn">${esc(k.fullName)}</p>${v.company ? `<p class="x-cc x-meta">${esc(v.company)}</p>` : ''}</div></div>
      ${k.acts.length ? `<ul class="x-info x-meta">${k.acts.filter((a) => a.sub).slice(0, 3).map((a) => `<li><i class="${a.icon}"></i><span>${esc(a.sub)}</span></li>`).join('')}</ul>` : ''}</article>
    ${keys.map((x) => `<article class="x-slide">${k.blocks[x]}</article>`).join('\n')}
  </div>
  <div class="x-dots" role="tablist" aria-label="Slides">${['', ...keys].map((x, i) => `<button type="button" aria-label="${i + 1}"${i === 0 ? ' class="on"' : ''}></button>`).join('')}</div>
  <nav class="x-keys x-actions" aria-label="Contact">${k.acts.map((a) => k.A(a, 'x-key', `<i class="${a.icon}"></i><span>${a.label}</span>`)).join('')}</nav>
  ${k.save('', `<i class="ri-user-add-line"></i><span>${L.save}</span>`)}
  ${k.install}`,
      script: "var dk=$('.x-deck');if(dk){var dsl=$$('.x-slide'),dds=$$('.x-dots button'),dgo=function(i){dk.scrollTo({left:dsl[i].offsetLeft-(dk.clientWidth-dsl[i].offsetWidth)/2,behavior:'smooth'})},dup=function(){var c=dk.scrollLeft+dk.clientWidth/2,b=0,m=1e9;dsl.forEach(function(s,i){var d=Math.abs(s.offsetLeft+s.offsetWidth/2-c);if(d<m){m=d;b=i}});dds.forEach(function(d,i){d.classList.toggle('on',i===b)})};dk.addEventListener('scroll',dup,{passive:true});dds.forEach(function(d,i){d.addEventListener('click',function(){dgo(i)})});$$('[data-enq]').forEach(function(b){b.addEventListener('click',function(){var f=$('#enq'),s=f&&f.closest('.x-slide');if(s)dgo(dsl.indexOf(s))})})}",
    };
  },

  sxspot: (k) => {
    const { v, L, esc } = k;
    return {
      main: `<header class="x-sp"><span class="x-beam" aria-hidden="true"></span><span class="x-pool" aria-hidden="true"></span>
    ${k.role ? `<span class="x-vl x-meta" aria-hidden="true">${esc(k.role)}</span>` : ''}${v.company ? `<span class="x-vr x-meta">${esc(v.company)}</span>` : ''}
    ${k.avatar()}
    <h1 class="name">${esc(k.fullName)}${k.verified}</h1>${k.roleP}
  </header>
  <nav class="x-links x-actions" aria-label="Contact">${k.acts.map((a) => k.A(a, 'x-ln', a.label)).join('')}${k.share('x-ln', L.share)}</nav>
  ${k.save('', `<span>${L.save}</span>`)}
  ${k.install}
  ${k.sections()}`,
    };
  },

  sxsign: (k) => {
    const { v, L, esc } = k;
    return {
      main: `<header class="x-sn"><div class="x-strip">${k.avatar()}</div>
    ${v.company || v.location ? `<span class="x-vert x-meta">${esc([v.company, v.location].filter(Boolean).join('  /  '))}</span>` : ''}
    ${k.share('x-ic', '<i class="ri-share-forward-line"></i>')}
    <div class="x-nm"><h1 class="name">${esc(k.fullName)}${k.verified}</h1>
      <svg class="x-fl" viewBox="0 0 210 26" aria-hidden="true"><path d="M2 18c30-14 58-14 84-4s46 10 62 0 34-10 60 2"/></svg>${k.roleP}</div>
  </header>
  <nav class="x-keys2 x-actions" aria-label="Contact">${k.acts.map((a, i) => k.A(a, 'x-k', `<em>0${i + 1}</em><i class="${a.icon}"></i><b>${a.label}</b><small>${esc(a.sub || '')}</small>`)).join('')}</nav>
  ${k.save('', `<span>${L.save}</span><i class="ri-arrow-right-line"></i>`)}
  ${k.install}
  ${k.sections()}`,
    };
  },

  sxrail: (k) => {
    const { v, L, esc } = k;
    return {
      main: `<div class="x-cols">
    <aside class="x-side"><span class="x-logo" aria-hidden="true">${esc(k.initials)}</span>
      <span class="x-vname x-meta">${esc(v.company || k.fullName)}</span>
      <nav class="x-actions" aria-label="Contact">${k.acts.map((a) => k.A(a, 'x-sb', `<i class="${a.icon}"></i>`)).join('')}${k.share('x-sb', '<i class="ri-share-forward-fill"></i>')}</nav></aside>
    <div class="x-main2">
      <header class="x-rh">${k.avatar()}<h1 class="name">${k.stacked}${k.verified}</h1>${k.roleP}
        ${v.location || k.hoursText ? `<div class="x-facts x-meta">${v.location ? `<span><i class="ri-map-pin-line"></i>${esc(v.location)}</span>` : ''}${k.hoursText ? `<span><i class="ri-time-line"></i>${k.hoursText}</span>` : ''}</div>` : ''}</header>
      ${k.save('', `<i class="ri-user-add-line"></i><span>${L.save}</span>`)}
      ${k.install}
      ${k.sections()}
    </div>
  </div>`,
    };
  },
};

const CSS = String.raw`
@keyframes x-bob{from{transform:translateY(0)}to{transform:translateY(-10px)}}
@keyframes x-wipe{from{clip-path:inset(0 100% 0 0)}to{clip-path:inset(-10% -10% -10% 0)}}
@keyframes x-draw{to{stroke-dashoffset:0}}
@keyframes x-dk{0%,100%{transform:scale(.93);opacity:.55}45%,55%{transform:none;opacity:1}}
@keyframes x-sheen2{0%{background-position:-160% 0}60%,100%{background-position:260% 0}}
@keyframes x-blob{0%,100%{border-radius:42% 58% 60% 40%/45% 45% 55% 55%}50%{border-radius:58% 42% 45% 55%/55% 60% 40% 45%}}

/* ================================================================== sxindex: typographic index with hairline accordions */
.l-sxindex{--r:0px}
.l-sxindex .x-top{display:grid;grid-template-columns:auto 1fr auto;gap:14px;align-items:center;padding:28px 26px 0}
.l-sxindex .avatar{width:56px;height:56px;border:0;box-shadow:0 0 0 1px var(--line)}
.l-sxindex .avatar.ph{font-size:19px}
.l-sxindex .name{display:block;text-align:start;font-size:17px;font-weight:600;letter-spacing:-.01em}
.l-sxindex .name i{font-size:.85em;margin-inline-start:4px;vertical-align:middle}
.l-sxindex .role{text-align:start;margin-top:1px;font-size:13.5px}
.l-sxindex .x-ic{width:42px;height:42px;border-radius:50%;border:1px solid var(--line);background:none;color:var(--tx);font-size:17px;cursor:pointer;display:grid;place-items:center;transition:background .25s,color .25s}
.l-sxindex .x-ic:hover{background:var(--tx);color:var(--bg)}
.l-sxindex .x-lede{padding:56px 26px 0;font-size:31px;line-height:1.16;letter-spacing:-.035em;font-weight:500;text-wrap:balance;animation:x-rise .9s var(--ease) both}
.l-sxindex .x-list{padding:48px 26px 0}
.l-sxindex .x-li{display:grid;grid-template-columns:104px 1fr auto;align-items:center;gap:8px;padding:17px 0;border-top:1px solid var(--line);font-size:15px;transition:color .25s,padding .4s var(--ease)}
.l-sxindex .x-li span{color:var(--muted);font-size:13px}
.l-sxindex .x-li b{font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.l-sxindex .x-li i{font-size:18px;transition:transform .35s var(--ease)}
.l-sxindex .x-li:hover{color:var(--p);padding-inline-start:8px}
.l-sxindex .x-li:hover i{transform:translate(3px,-3px)}
.l-sxindex .save{margin:0 26px;height:auto;padding:19px 0;border-radius:0;background:none;color:var(--tx);box-shadow:none;justify-content:space-between;border-block:1px solid var(--tx);font-size:15px;font-weight:600;transition:color .25s,padding .4s var(--ease)}
.l-sxindex .save:after{display:none}
.l-sxindex .save:hover{transform:none;box-shadow:none;color:var(--p);padding-inline:8px}
.l-sxindex .install{margin-inline:26px;width:calc(100% - 52px)}
.l-sxindex .x-accs{padding:56px 26px 0}
.l-sxindex .x-acc{border-top:1px solid var(--line)}
.l-sxindex .x-acc:last-child{border-bottom:1px solid var(--line)}
.l-sxindex summary{list-style:none;display:grid;grid-template-columns:44px 1fr auto;align-items:center;padding:21px 0;cursor:pointer;font-size:21px;font-weight:500;letter-spacing:-.025em;-webkit-tap-highlight-color:transparent}
.l-sxindex summary::-webkit-details-marker{display:none}
.l-sxindex summary em{font-style:normal;font-size:11px;font-weight:500;letter-spacing:.06em;color:var(--muted)}
.l-sxindex summary i{font-size:22px;transition:transform .4s var(--ease)}
.l-sxindex .x-acc[open] summary i{transform:rotate(45deg)}
.l-sxindex .x-acc[open] summary{color:var(--p)}
.l-sxindex .x-acc .sec{padding:0 0 26px;animation:x-rise .45s var(--ease) both}
.l-sxindex .x-acc .sec h3{display:none}
.l-sxindex .box,.l-sxindex .links a,.l-sxindex .pays a,.l-sxindex .post{background:transparent;border:0;box-shadow:none;padding-inline:0;border-radius:0}
.l-sxindex .box.list{padding:0}
.l-sxindex .row{padding-inline:0}
.l-sxindex .row>i:not(.go){background:transparent;width:22px;height:22px;color:var(--tx)}
.l-sxindex .about{font-size:17px;line-height:1.6}
.l-sxindex .svc,.l-sxindex .hours{padding:0}
.l-sxindex .social{display:flex;flex-wrap:wrap;gap:6px}
.l-sxindex .social a{width:46px;border-radius:50%;background:transparent;box-shadow:none;color:var(--tx)}
.l-sxindex .links a{border-bottom:1px solid var(--line)}
@supports (interpolate-size:allow-keywords){.l-sxindex .x-acc{interpolate-size:allow-keywords}.l-sxindex .x-acc::details-content{block-size:0;overflow:clip;transition:block-size .45s cubic-bezier(.16,1,.3,1),content-visibility .45s allow-discrete}.l-sxindex .x-acc[open]::details-content{block-size:auto}}

/* ================================================================== sxarch: arched portrait, pills, sticky section chips */
.l-sxarch{--r:22px;overflow:clip}
.l-sxarch .x-arch{position:relative;padding:46px 24px 0;text-align:center}
.l-sxarch .x-sun{position:absolute;top:34px;inset-inline-end:40px;width:78px;height:78px;border-radius:50%;background:var(--s);opacity:.75;animation:x-bob 4s ease-in-out infinite alternate}
.l-sxarch .x-frame{position:relative;width:206px;height:266px;margin:0 auto;border-radius:999px 999px 0 0;overflow:hidden;box-shadow:0 0 0 10px color-mix(in srgb,var(--s) 30%,var(--bg));animation:x-in 1s var(--ease) both}
.l-sxarch .avatar{width:100%;height:100%;border:0;border-radius:0;box-shadow:none;object-fit:cover;object-position:center 18%;animation:x-ken 1.6s var(--ease) both}
.l-sxarch .avatar.ph{font-size:70px}
.l-sxarch .x-shelf{display:block;width:262px;max-width:100%;height:10px;margin:10px auto 0;border-radius:10px;background:var(--p)}
.l-sxarch .name{margin-top:30px;font-size:35px;font-weight:500;letter-spacing:-.025em}
.l-sxarch .role{letter-spacing:.2em;text-transform:uppercase;font-size:11.5px;margin-top:12px}
.l-sxarch .x-chips{display:flex;flex-wrap:wrap;justify-content:center;gap:6px 18px;margin-top:16px;font-size:13.5px;font-style:italic;color:var(--muted)}
.l-sxarch .x-pills{display:flex;flex-wrap:wrap;justify-content:center;gap:8px;padding:28px 20px 0}
.l-sxarch .x-pill{display:inline-flex;align-items:center;gap:8px;height:46px;padding:0 18px;border:0;border-radius:999px;font:inherit;font-size:13.5px;font-weight:600;cursor:pointer;color:var(--tx);background:color-mix(in srgb,var(--s) 26%,var(--bg));transition:transform .35s var(--ease),background .25s,color .25s}
.l-sxarch .x-pill i{font-size:17px;color:var(--p);transition:color .25s}
.l-sxarch .x-pill:hover{background:var(--p);color:var(--onp);transform:translateY(-3px)}
.l-sxarch .x-pill:hover i{color:inherit}
.l-sxarch .save{margin:14px auto 0;width:max-content;max-width:calc(100% - 48px);padding:0 34px;height:54px;box-shadow:none}
.l-sxarch .install{margin:10px auto 0;width:max-content;padding:0 26px}
.l-sxarch .x-jump{position:sticky;top:0;z-index:6;display:flex;gap:6px;overflow-x:auto;scrollbar-width:none;margin-top:34px;padding:12px 20px;background:color-mix(in srgb,var(--bg) 84%,transparent);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);border-block:1px solid var(--line)}
.l-sxarch .x-jump::-webkit-scrollbar{display:none}
.l-sxarch .x-jump button{flex:none;height:34px;padding:0 14px;border-radius:999px;border:1px solid var(--line);background:none;font:inherit;font-size:12.5px;font-weight:600;color:var(--tx);cursor:pointer;transition:background .25s,color .25s}
.l-sxarch .x-jump button:hover{background:var(--tx);color:var(--bg)}
.l-sxarch .sec{padding:42px 24px 0;scroll-margin-top:66px}
.l-sxarch .sec h3{justify-content:center;letter-spacing:.2em}
.l-sxarch .sec h3 i{display:none}
.l-sxarch .box,.l-sxarch .links a,.l-sxarch .pays a,.l-sxarch .post,.l-sxarch .prod{background:color-mix(in srgb,var(--s) 15%,var(--bg));border-color:transparent;box-shadow:none}
.l-sxarch .about{text-align:center;font-size:16px}
.l-sxarch .social{display:flex;flex-wrap:wrap;justify-content:center}
.l-sxarch .social a{width:52px;border-radius:50%;background:color-mix(in srgb,var(--s) 20%,var(--bg));border-color:transparent;box-shadow:none;color:var(--tx)}
.l-sxarch .gal a{border-radius:999px 999px 14px 14px}
.l-sxarch .gal img{aspect-ratio:3/4}

/* ================================================================== sxwave: colour wash, morphing photo, app tab bar */
.l-sxwave{--r:26px;background:linear-gradient(168deg,color-mix(in srgb,var(--p) 36%,var(--bg)),var(--bg) 44%,color-mix(in srgb,var(--s) 30%,var(--bg)))}
.l-sxwave .x-wv{display:grid;grid-template-columns:1fr auto;gap:14px;align-items:center;padding:58px 24px 0}
.l-sxwave .role{text-align:start;font-size:13px;font-weight:600;color:var(--p);margin:0 0 10px}
.l-sxwave .name{display:block;text-align:start;font-size:clamp(34px,10.5vw,44px);font-weight:700;line-height:1;letter-spacing:-.045em;overflow-wrap:anywhere;animation:x-rise .9s var(--ease) both}
.l-sxwave .name i{font-size:.45em;margin-inline-start:6px;vertical-align:.3em}
.l-sxwave .x-blob{width:148px;height:148px;overflow:hidden;border-radius:42% 58% 60% 40%/45% 45% 55% 55%;box-shadow:0 30px 50px -22px color-mix(in srgb,var(--p) 80%,#000);animation:x-in .9s var(--ease) both,x-blob 9s 1s ease-in-out infinite}
.l-sxwave .avatar{width:100%;height:100%;border:0;border-radius:0;box-shadow:none;object-fit:cover;animation:none}
.l-sxwave .avatar.ph{font-size:50px}
.l-sxwave .x-chips{grid-column:1/-1;display:flex;flex-wrap:wrap;gap:8px;margin-top:14px}
.l-sxwave .x-chips span,.l-sxwave .x-shw{display:inline-flex;align-items:center;gap:6px;padding:8px 14px;border-radius:999px;font-size:12.5px;font-weight:600;background:color-mix(in srgb,var(--bg) 58%,transparent);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);border:1px solid color-mix(in srgb,#fff 50%,transparent)}
.l-sxwave .x-shw{grid-column:1/-1;justify-self:start;font:inherit;font-size:12.5px;font-weight:600;color:var(--p);cursor:pointer}
.l-sxwave .sec{padding:28px 18px 0}
.l-sxwave .box,.l-sxwave .links a,.l-sxwave .social a,.l-sxwave .pays a,.l-sxwave .post,.l-sxwave .prod{background:color-mix(in srgb,var(--bg) 60%,transparent);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);border:1px solid color-mix(in srgb,#fff 46%,transparent);box-shadow:0 22px 40px -32px color-mix(in srgb,var(--p) 80%,#000)}
.l-sxwave.is-dark .box,.l-sxwave.is-dark .links a,.l-sxwave.is-dark .social a,.l-sxwave.is-dark .x-chips span{border-color:color-mix(in srgb,#fff 12%,transparent)}
.l-sxwave .foot{padding-bottom:60px}
.l-sxwave~.x-tabbar{position:fixed;z-index:20;left:50%;bottom:12px;transform:translateX(-50%);width:min(452px,calc(100% - 20px));display:grid;grid-template-columns:1fr auto 1fr;align-items:end;padding:8px 10px;border-radius:30px;background:color-mix(in srgb,var(--bg) 74%,transparent);backdrop-filter:blur(22px) saturate(1.6);-webkit-backdrop-filter:blur(22px) saturate(1.6);border:1px solid var(--line);box-shadow:0 22px 46px -16px rgba(0,0,0,.45);animation:vc-bar .8s .8s var(--ease) both}
.l-sxwave~.x-tabbar.x-static{position:static;transform:none;margin:0 auto 20px;animation:none}
.l-sxwave~.x-tabbar .x-actions{display:grid;grid-template-columns:1fr 1fr}
.l-sxwave~.x-tabbar .x-tb{display:grid;justify-items:center;gap:3px;padding:6px 2px;font-size:10.5px;font-weight:600;color:var(--muted);min-width:0;transition:color .25s,transform .3s var(--ease)}
.l-sxwave~.x-tabbar .x-tb i{font-size:21px}
.l-sxwave~.x-tabbar .x-tb span{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.l-sxwave~.x-tabbar a.x-tb:hover{color:var(--p);transform:translateY(-2px)}
.l-sxwave~.x-tabbar .save{margin:-30px 8px 0;width:68px;height:68px;border-radius:50%;padding:0;background:linear-gradient(135deg,var(--p),var(--s));box-shadow:0 0 0 6px var(--bg),0 16px 30px -10px var(--p);animation:none}
.l-sxwave~.x-tabbar .save span{display:none}
.l-sxwave~.x-tabbar .save i{font-size:26px}
.l-sxwave~.x-tabbar .save:after{display:none}

/* ================================================================== sxcontact: a phone contact screen */
.l-sxcontact{--r:12px;background:color-mix(in srgb,var(--tx) 6%,var(--bg))}
.l-sxcontact .x-ct{position:relative;padding:54px 20px 0;text-align:center}
.l-sxcontact .x-edit{position:absolute;top:16px;inset-inline-end:16px;background:none;border:0;font:inherit;font-size:16px;color:var(--p);cursor:pointer}
.l-sxcontact .avatar{width:108px;height:108px;border:0;box-shadow:none;margin:0 auto}
.l-sxcontact .name{font-size:28px;font-weight:600;letter-spacing:-.02em;margin-top:12px}
.l-sxcontact .role{font-size:15px;margin-top:3px}
.l-sxcontact .x-co{font-size:15px;color:var(--muted)}
.l-sxcontact .x-quad{display:grid;grid-auto-flow:column;grid-auto-columns:1fr;gap:8px;padding:20px 16px 0}
.l-sxcontact .x-qb{display:grid;justify-items:center;gap:5px;padding:11px 4px 9px;border-radius:12px;background:var(--bg);color:var(--p);font-size:11px;font-weight:500;min-width:0;animation:x-in .6s var(--ease) both;transition:background .2s,color .2s,transform .2s}
.l-sxcontact .x-qb:nth-child(2){animation-delay:.05s}.l-sxcontact .x-qb:nth-child(3){animation-delay:.1s}.l-sxcontact .x-qb:nth-child(4){animation-delay:.15s}
.l-sxcontact .x-qb i{font-size:21px}
.l-sxcontact .x-qb span{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.l-sxcontact .x-qb:hover{background:var(--p);color:var(--onp)}
.l-sxcontact .x-qb:active{transform:scale(.95)}
.l-sxcontact .x-grp{margin:16px 16px 0;border-radius:12px;background:var(--bg);overflow:hidden}
.l-sxcontact .save{margin:0;height:50px;border-radius:0;background:none;color:var(--p);box-shadow:none;justify-content:space-between;padding:0 16px;font-size:16px;font-weight:400}
.l-sxcontact .save:after{display:none}
.l-sxcontact .save:hover{transform:none;box-shadow:none;background:color-mix(in srgb,var(--p) 8%,transparent)}
.l-sxcontact .install{margin:10px 16px 0;width:calc(100% - 32px);border-radius:12px}
.l-sxcontact .sec{padding:26px 16px 0}
.l-sxcontact .sec h3{margin:0 16px 7px;font-size:12.5px;font-weight:400;letter-spacing:.03em;color:var(--muted)}
.l-sxcontact .sec h3 i{display:none}
.l-sxcontact .box,.l-sxcontact .pays a,.l-sxcontact .post,.l-sxcontact .prod{background:var(--bg);border:0;box-shadow:none;border-radius:12px}
.l-sxcontact .box.list{padding:0 0 0 16px;gap:0}
.l-sxcontact .row{padding:10px 16px 10px 0;border-radius:0;gap:0}
.l-sxcontact .row+.row{border-top:1px solid var(--line)}
.l-sxcontact a.row:hover{background:transparent}
.l-sxcontact .row>i:not(.go){display:none}
.l-sxcontact .row small{color:var(--tx);font-size:13px;font-weight:400}
.l-sxcontact .row span{color:var(--p);font-weight:400;font-size:16.5px}
.l-sxcontact .links{gap:0;border-radius:12px;overflow:hidden;background:var(--bg)}
.l-sxcontact .links a{background:transparent;border:0;border-radius:0;box-shadow:none;padding:12px 12px 12px 16px;color:var(--p);font-weight:400;font-size:16.5px}
.l-sxcontact .links a+a{border-top:1px solid var(--line)}
.l-sxcontact .links a:hover{transform:none}
.l-sxcontact .links a i{background:transparent;color:var(--muted)}
.l-sxcontact .social{display:flex;flex-wrap:wrap;gap:8px}
.l-sxcontact .social a{width:54px;border-radius:14px;border:0;box-shadow:none;background:var(--bg)}
.l-sxcontact .about{font-size:16px}

/* ================================================================== sxdeck: a metal card and sections as swipeable slides */
.l-sxdeck{--r:20px;background:linear-gradient(180deg,color-mix(in srgb,#fff 55%,var(--bg)),var(--bg))}
.l-sxdeck .x-dh{display:grid;grid-template-columns:auto 1fr auto;gap:12px;align-items:center;padding:22px 20px 0}
.l-sxdeck .avatar{width:50px;height:50px;border:2px solid #fff;box-shadow:0 0 0 1px rgba(40,48,66,.18)}
.l-sxdeck .avatar.ph{font-size:17px}
.l-sxdeck .name{display:block;text-align:start;font-size:17px;font-weight:600}
.l-sxdeck .name i{font-size:.85em;margin-inline-start:4px;vertical-align:middle}
.l-sxdeck .role{text-align:start;font-size:12.5px;margin:0}
.l-sxdeck .x-ic{width:44px;height:44px;border-radius:50%;border:1px solid var(--line);font-size:17px;cursor:pointer;display:grid;place-items:center;color:var(--tx);background:linear-gradient(160deg,color-mix(in srgb,#fff 70%,var(--bg)),color-mix(in srgb,var(--tx) 8%,var(--bg)));box-shadow:inset 0 1px 0 rgba(255,255,255,.7)}
.l-sxdeck .x-deck{display:flex;align-items:flex-start;gap:14px;overflow-x:auto;scroll-snap-type:x mandatory;scrollbar-width:none;padding:24px 20px 28px;-webkit-overflow-scrolling:touch}
.l-sxdeck .x-deck::-webkit-scrollbar{display:none}
.l-sxdeck .x-slide{flex:0 0 86%;min-width:0;scroll-snap-align:center;border-radius:24px;padding-bottom:20px;background:linear-gradient(160deg,color-mix(in srgb,#fff 66%,var(--bg)),color-mix(in srgb,var(--tx) 5%,var(--bg)));box-shadow:inset 0 1px 0 rgba(255,255,255,.8),0 0 0 1px var(--line),0 26px 40px -28px rgba(40,48,66,.7)}
@supports (animation-timeline:view()){.l-sxdeck .x-slide{animation:x-dk linear both;animation-timeline:view(inline)}}
.l-sxdeck .x-s0{padding:0;background:none;box-shadow:none}
.l-sxdeck .x-metal{position:relative;overflow:hidden;aspect-ratio:1.586;border-radius:24px;padding:22px 24px;display:flex;flex-direction:column;justify-content:space-between;color:#1b2030;background:linear-gradient(115deg,#d6d9e1,#f8f9fb 28%,#b9bfcb 52%,#eef0f5 74%,#c6cad4);box-shadow:inset 0 1px 0 rgba(255,255,255,.8),0 0 0 1px rgba(40,48,66,.14),0 26px 40px -28px rgba(40,48,66,.7)}
.l-sxdeck .x-metal:before{content:"";position:absolute;inset:0;background:repeating-linear-gradient(90deg,rgba(255,255,255,.45) 0 1px,transparent 1px 3px);opacity:.5}
.l-sxdeck .x-metal:after{content:"";position:absolute;inset:0;background:linear-gradient(105deg,transparent 30%,rgba(255,255,255,.85) 46%,transparent 60%);background-size:260% 100%;animation:x-sheen2 7s 1s ease-in-out infinite}
.l-sxdeck .x-info{list-style:none;margin-top:16px;display:grid;gap:2px}
.l-sxdeck .x-info li{display:grid;grid-template-columns:auto 1fr;gap:12px;align-items:center;padding:9px 6px;font-size:14px;font-weight:500;border-bottom:1px solid var(--line)}
.l-sxdeck .x-info li:last-child{border:0}
.l-sxdeck .x-info i{color:var(--muted);font-size:17px}
.l-sxdeck .x-info span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.l-sxdeck .x-row1{position:relative;z-index:1;display:flex;justify-content:space-between;align-items:flex-start}
.l-sxdeck .x-mono{font-size:30px;font-weight:700;letter-spacing:.06em;color:#2b3142;text-shadow:0 1px 0 rgba(255,255,255,.8)}
.l-sxdeck .x-nfc{font-size:26px;transform:rotate(90deg);color:#4b5263}
.l-sxdeck .x-metal>div:last-child{position:relative;z-index:1}
.l-sxdeck .x-cn{font-size:16px;font-weight:600;letter-spacing:.2em;text-transform:uppercase;text-shadow:0 1px 0 rgba(255,255,255,.8)}
.l-sxdeck .x-cc{margin-top:4px;font-size:11.5px;letter-spacing:.16em;text-transform:uppercase;color:#4b5263}
.l-sxdeck .x-slide:not(.x-s0){max-height:350px;overflow-y:auto;overscroll-behavior:contain;scrollbar-width:thin}
.l-sxdeck .x-slide .sec{padding:20px 18px 0;animation:none}
.l-sxdeck .x-slide .box,.l-sxdeck .x-slide .links a,.l-sxdeck .x-slide .pays a{background:color-mix(in srgb,var(--bg) 60%,transparent);box-shadow:none}
.l-sxdeck .x-dots{display:flex;justify-content:center;gap:6px;margin-top:-8px}
.l-sxdeck .x-dots button{width:8px;height:8px;padding:0;border:0;border-radius:8px;background:color-mix(in srgb,var(--tx) 22%,transparent);cursor:pointer;transition:width .4s var(--ease),background .3s}
.l-sxdeck .x-dots .on{width:24px;background:var(--tx)}
.l-sxdeck .x-keys{display:grid;grid-auto-flow:column;grid-auto-columns:1fr;gap:10px;padding:24px 20px 0}
.l-sxdeck .x-key{display:grid;justify-items:center;gap:6px;padding:14px 4px 11px;border-radius:18px;font-size:11.5px;font-weight:600;min-width:0;color:var(--tx);border:1px solid var(--line);background:linear-gradient(160deg,color-mix(in srgb,#fff 70%,var(--bg)),color-mix(in srgb,var(--tx) 8%,var(--bg)));box-shadow:inset 0 1px 0 rgba(255,255,255,.7);transition:transform .3s var(--ease),background .25s,color .25s}
.l-sxdeck .x-key i{font-size:21px}
.l-sxdeck .x-key:hover{transform:translateY(-3px);background:var(--tx);color:var(--bg)}
.l-sxdeck .save{margin:12px 20px 0;border-radius:18px;background:linear-gradient(120deg,color-mix(in srgb,var(--tx) 80%,#fff),var(--tx));color:var(--bg);box-shadow:0 20px 34px -20px var(--tx)}

/* ================================================================== sxspot: a stage with a light beam */
.l-sxspot{--r:4px}
.l-sxspot .x-sp{position:relative;padding:0 24px;text-align:center;overflow:hidden}
.l-sxspot .x-beam{position:absolute;top:-30px;left:50%;width:360px;height:440px;margin-left:-180px;clip-path:polygon(43% 0,57% 0,100% 100%,0 100%);background:linear-gradient(color-mix(in srgb,var(--p) 70%,transparent),transparent 88%);filter:blur(4px);opacity:.42;animation:x-glow 4s ease-in-out infinite alternate}
.l-sxspot .x-pool{position:absolute;top:290px;left:50%;width:250px;height:54px;margin-left:-125px;border-radius:50%;background:radial-gradient(color-mix(in srgb,var(--p) 55%,transparent),transparent 70%)}
.l-sxspot .x-vl,.l-sxspot .x-vr{position:absolute;top:150px;max-height:210px;overflow:hidden;white-space:nowrap;writing-mode:vertical-rl;font-size:9.5px;letter-spacing:.42em;text-transform:uppercase;color:var(--p)}
.l-sxspot .x-vl{left:20px;transform:rotate(180deg)}
.l-sxspot .x-vr{right:20px}
.l-sxspot .avatar{position:relative;margin:150px auto 0;width:156px;height:156px;border:1px solid var(--p);padding:6px;background:transparent;box-shadow:0 34px 60px -18px #000}
.l-sxspot .avatar.ph{background:linear-gradient(135deg,var(--p),var(--s));background-clip:content-box}
.l-sxspot .name{position:relative;margin-top:44px;font-size:clamp(20px,6.4vw,27px);font-weight:500;letter-spacing:.24em;text-transform:uppercase;background:linear-gradient(100deg,var(--p),var(--s) 50%,var(--p));-webkit-background-clip:text;background-clip:text;color:transparent}
.l-sxspot .name i{-webkit-text-fill-color:var(--p);font-size:.7em;letter-spacing:0}
.l-sxspot .role{position:relative;display:none}
.l-sxspot .x-links{display:flex;flex-wrap:wrap;justify-content:center;padding:26px 16px 0}
.l-sxspot .x-ln{position:relative;padding:9px 15px;background:none;border:0;font:inherit;font-size:10.5px;letter-spacing:.26em;text-transform:uppercase;color:var(--tx);cursor:pointer;transition:color .25s}
.l-sxspot .x-ln+.x-ln:before{content:"\25C6";position:absolute;left:-3px;top:50%;transform:translateY(-50%);font-size:6px;letter-spacing:0;color:var(--p)}
.l-sxspot .x-ln:hover{color:var(--p)}
.l-sxspot .save{position:relative;overflow:visible;margin:30px 46px 0;height:56px;border-radius:0;background:transparent;border:1px solid var(--p);color:var(--p);box-shadow:none;letter-spacing:.3em;text-transform:uppercase;font-size:11.5px;transition:background .3s,color .3s}
.l-sxspot .save:after{content:"";position:absolute;inset:-6px;left:-6px;width:auto;transform:none;animation:none;background:none;border:1px solid color-mix(in srgb,var(--p) 35%,transparent)}
.l-sxspot .save:hover{background:var(--p);color:var(--onp);transform:none;box-shadow:none}
.l-sxspot .install{margin-inline:46px;width:calc(100% - 92px);border-radius:0}
.l-sxspot .sec{padding:44px 30px 0}
.l-sxspot .sec h3{display:block;text-align:center;color:var(--p);letter-spacing:.38em;font-size:10.5px;font-weight:600;margin:0 0 18px}
.l-sxspot .sec h3 i{display:none}
.l-sxspot .sec h3:after{content:"\25C6";display:block;margin-top:10px;font-size:7px;letter-spacing:0}
.l-sxspot .box,.l-sxspot .links a,.l-sxspot .pays a,.l-sxspot .post{background:transparent;box-shadow:none;border-width:1px 0;border-radius:0;border-color:color-mix(in srgb,var(--p) 26%,transparent)}
.l-sxspot .about{text-align:center;font-size:16.5px;line-height:1.75}
.l-sxspot .row>i:not(.go),.l-sxspot .links a i,.l-sxspot .svc .ic{background:transparent;border:1px solid color-mix(in srgb,var(--p) 40%,transparent);border-radius:50%}
.l-sxspot .social{display:flex;flex-wrap:wrap;justify-content:center}
.l-sxspot .social a{width:48px;border-radius:50%;background:transparent;box-shadow:none;border-color:color-mix(in srgb,var(--p) 40%,transparent)}

/* ================================================================== sxsign: film-strip photo and a name that writes itself */
.l-sxsign{--r:8px}
.l-sxsign .x-sn{position:relative}
.l-sxsign .x-strip{position:relative;height:250px;overflow:hidden}
.l-sxsign .x-strip:after{content:"";position:absolute;inset:0;background:linear-gradient(rgba(0,0,0,.25),transparent 35%,var(--bg))}
.l-sxsign .avatar{width:100%;height:100%;border:0;border-radius:0;box-shadow:none;object-fit:cover;object-position:center 22%;filter:grayscale(1) contrast(1.1);animation:x-ken 1.8s var(--ease) both}
.l-sxsign .avatar.ph{font-size:90px}
.l-sxsign .x-vert{position:absolute;top:18px;left:18px;max-height:200px;overflow:hidden;white-space:nowrap;writing-mode:vertical-rl;font-size:9.5px;letter-spacing:.36em;text-transform:uppercase;color:#fff;text-shadow:0 1px 6px rgba(0,0,0,.6)}
.l-sxsign .x-ic{position:absolute;top:16px;inset-inline-end:16px;width:44px;height:44px;border-radius:50%;border:1px solid rgba(255,255,255,.4);background:rgba(0,0,0,.3);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);color:#fff;font-size:17px;cursor:pointer;display:grid;place-items:center}
.l-sxsign .x-nm{position:relative;padding:0 26px;margin-top:-54px}
.l-sxsign .name{display:block;text-align:start;font-size:clamp(44px,13.5vw,62px);font-weight:500;font-style:italic;line-height:1;letter-spacing:-.03em;animation:x-wipe 1.5s .2s cubic-bezier(.6,0,.2,1) both}
.l-sxsign .name i{font-size:.34em;font-style:normal;vertical-align:.9em;margin-inline-start:8px}
.l-sxsign .x-fl{display:block;width:210px;height:26px;margin-top:6px;color:var(--p);fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-dasharray:330;stroke-dashoffset:330;animation:x-draw 1.3s 1.3s var(--ease) forwards}
.l-sxsign .role{text-align:start;margin-top:14px;font-size:11.5px;letter-spacing:.28em;text-transform:uppercase;color:var(--p)}
.l-sxsign .x-keys2{display:flex;gap:10px;overflow-x:auto;scrollbar-width:none;padding:32px 26px 0}
.l-sxsign .x-keys2::-webkit-scrollbar{display:none}
.l-sxsign .x-k{position:relative;flex:none;width:136px;padding:14px 14px 16px;border-radius:10px;border:1px solid color-mix(in srgb,var(--p) 45%,transparent);transition:background .3s,color .3s,transform .35s var(--ease)}
.l-sxsign .x-k em{font-style:normal;font-size:10.5px;letter-spacing:.1em;color:var(--p)}
.l-sxsign .x-k i{position:absolute;top:12px;inset-inline-end:12px;font-size:18px;color:var(--p)}
.l-sxsign .x-k b{display:block;margin-top:26px;font-size:17px;font-weight:500}
.l-sxsign .x-k small{display:block;font-size:11.5px;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.l-sxsign .x-k:hover{background:var(--p);color:var(--onp);transform:translateY(-4px)}
.l-sxsign .x-k:hover em,.l-sxsign .x-k:hover i,.l-sxsign .x-k:hover small{color:inherit}
.l-sxsign .save{margin:22px 26px 0;border-radius:6px;justify-content:space-between;padding:0 22px;background:var(--tx);color:var(--bg);box-shadow:none;font-size:14.5px;letter-spacing:.04em}
.l-sxsign .save i{transition:transform .35s var(--ease)}
.l-sxsign .save:hover i{transform:translateX(6px)}
.l-sxsign .install{margin-inline:26px;width:calc(100% - 52px);border-radius:6px}
.l-sxsign .sec{padding:44px 26px 0}
.l-sxsign .sec h3{margin-inline:0;color:var(--tx);font-size:25px;font-weight:500;font-style:italic;letter-spacing:-.02em;text-transform:none}
.l-sxsign .sec h3 i{display:none}
.l-sxsign .sec h3:after{content:"";flex:1;height:1px;background:var(--line)}
.l-sxsign .box,.l-sxsign .links a,.l-sxsign .pays a,.l-sxsign .post{background:transparent;box-shadow:none;border-width:0;border-inline-start:1px solid color-mix(in srgb,var(--p) 50%,transparent);border-radius:0}
.l-sxsign .box.list{padding:0 8px}
.l-sxsign .social a{border-radius:50%;background:transparent;box-shadow:none}

/* ================================================================== sxrail: full-height colour rail with the actions */
.l-sxrail{--r:10px;overflow:clip}
.l-sxrail .x-cols{display:grid;grid-template-columns:66px 1fr}
.l-sxrail .x-side{position:sticky;top:0;align-self:start;height:100vh;max-height:860px;display:flex;flex-direction:column;align-items:center;padding:16px 0 18px;color:var(--onp);background:linear-gradient(var(--p),color-mix(in srgb,var(--p) 66%,#000))}
.l-sxrail .x-logo{width:42px;height:42px;flex:none;border-radius:11px;display:grid;place-items:center;font-weight:700;font-size:14px;letter-spacing:.04em;background:var(--s);color:var(--ons)}
.l-sxrail .x-vname{flex:1;min-height:0;margin:18px 0;overflow:hidden;white-space:nowrap;writing-mode:vertical-rl;transform:rotate(180deg);font-size:10.5px;font-weight:600;letter-spacing:.32em;text-transform:uppercase;opacity:.82}
.l-sxrail .x-side nav{display:grid;gap:8px}
.l-sxrail .x-sb{width:44px;height:44px;border-radius:13px;border:0;display:grid;place-items:center;font-size:19px;cursor:pointer;color:inherit;background:color-mix(in srgb,var(--onp) 13%,transparent);animation:x-in .6s var(--ease) both;transition:background .25s,color .25s,transform .3s var(--ease)}
.l-sxrail .x-sb:nth-child(2){animation-delay:.06s}.l-sxrail .x-sb:nth-child(3){animation-delay:.12s}.l-sxrail .x-sb:nth-child(4){animation-delay:.18s}.l-sxrail .x-sb:nth-child(5){animation-delay:.24s}
.l-sxrail .x-sb:hover{background:var(--s);color:var(--ons);transform:translateX(4px)}
.l-sxrail .x-main2{min-width:0}
.l-sxrail .x-rh{padding:28px 20px 0}
.l-sxrail .avatar{width:92px;height:92px;border-radius:14px;border:0;box-shadow:0 16px 30px -18px rgba(15,23,42,.6)}
.l-sxrail .avatar.ph{font-size:30px}
.l-sxrail .name{display:block;text-align:start;margin-top:18px;font-size:31px;font-weight:700;line-height:1.02;letter-spacing:-.035em;overflow-wrap:anywhere}
.l-sxrail .name i{font-size:.5em;margin-inline-start:6px;vertical-align:.25em}
.l-sxrail .role{text-align:start;margin-top:10px;font-size:13px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--p)}
.l-sxrail .x-facts{display:grid;gap:6px;margin-top:16px;font-size:13.5px;color:var(--muted)}
.l-sxrail .x-facts span{display:flex;align-items:center;gap:8px}
.l-sxrail .x-facts i{color:var(--s)}
.l-sxrail .save{margin:20px 20px 0;border-radius:8px;height:50px;font-size:14.5px;box-shadow:none}
.l-sxrail .save:after{display:none}
.l-sxrail .install{margin-inline:20px;width:calc(100% - 40px);border-radius:8px}
.l-sxrail .sec{padding:28px 20px 0}
.l-sxrail .sec h3{margin-inline:0;padding-bottom:9px;border-bottom:2px solid var(--p);color:var(--tx);letter-spacing:.1em}
.l-sxrail .sec h3 i{color:var(--s)}
.l-sxrail .box,.l-sxrail .links a,.l-sxrail .pays a,.l-sxrail .post{box-shadow:none}
.l-sxrail .row>i:not(.go),.l-sxrail .svc .ic,.l-sxrail .links a i{border-radius:9px}
.l-sxrail .social a{border-radius:10px;box-shadow:none}
.l-sxrail .gal{grid-template-columns:1fr 1fr}
`;

module.exports = { designs, CSS };
