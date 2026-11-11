/*
 * Signature designs, pack 4: technology, hospitality and personal brand. See signature.js for the kit each design receives.
 *
 *   sxpitch    a pitch deck: scroll progress bar, statement name, sections as numbered slides
 *   sxmenu     a restaurant / hotel menu: photo header, medallion, services with dotted leaders
 *   sxglass    layered glass panes, widgets and a phone-style dock of app icons
 *   sxholo     a holographic ID badge hanging from a strap that swings
 *   sxterm     a terminal window: commands, output, numbered shortcuts
 *   sxaurora   moving aurora light, a floating island bar, keycap rows
 *   sxbrand    a colour panel with the first name in outline letters, a pull quote, big paired buttons
 *   sxpolaroid a fan of photo prints that spreads when touched, stamp buttons, paper notes
 */
const APP = { 'ri-phone-fill': '#34c759', 'ri-mail-fill': '#0a84ff', 'ri-whatsapp-fill': '#25d366', 'ri-map-pin-2-fill': '#ff9f0a' };

const designs = {
  sxpitch: (k) => {
    const { v, L, esc } = k;
    const keys = k.order.filter((x) => k.blocks[x]);
    return {
      main: `<span class="x-prog" aria-hidden="true"></span>
  <header class="x-p0">
    <div class="x-ptop">${v.company ? `<span class="x-co x-meta">${esc(v.company)}</span>` : '<span></span>'}${k.share('x-shr', `${L.share}<i class="ri-arrow-right-up-line"></i>`)}</div>
    <h1 class="name">${k.stacked}${k.verified}</h1>${k.roleP}
    <div class="x-shot">${k.avatar()}</div>
  </header>
  <nav class="x-pa x-actions" aria-label="Contact">${k.acts.map((a) => k.A(a, 'x-pb', `<i class="${a.icon}"></i><span>${a.label}</span>`)).join('')}</nav>
  ${k.save('', `<span>${L.save}</span><i class="ri-arrow-right-line"></i>`)}
  ${k.install}
  <div class="x-slides">${keys.map((x, i) => `<div class="x-sl"><span class="x-num" aria-hidden="true">${String(i + 1).padStart(2, '0')}</span>${k.blocks[x]}</div>`).join('\n')}</div>`,
    };
  },

  sxmenu: (k) => {
    const { v, L, esc } = k;
    const [a1, a2, ...more] = k.acts;
    return {
      main: `<header class="x-mn">
    <div class="x-bg${v.cover_image ? ' x-img' : ''}"${v.cover_image ? ` style="background-image:url('${k.url(v.cover_image)}')"` : ''}></div>
    ${k.share('x-ic', '<i class="ri-share-forward-line"></i>')}
    <div class="x-ttl"><span class="x-orn" aria-hidden="true">&#10022;</span>${k.roleP}<h1 class="name">${esc(k.fullName)}${k.verified}</h1>
      ${v.company || v.location ? `<p class="x-sub x-meta">${[v.company, v.location].filter(Boolean).map(esc).join(' · ')}</p>` : ''}</div>
    <div class="x-med">${k.avatar()}</div>
  </header>
  ${k.hoursText ? `<p class="x-open x-meta">${k.hoursText}</p>` : ''}
  <nav class="x-two x-actions" aria-label="Contact">${[a1, a2].filter(Boolean).map((a) => k.A(a, 'x-bt', `<i class="${a.icon}"></i>${a.label}`)).join('')}${more.map((a) => k.A(a, 'x-tx', a.label)).join('')}</nav>
  ${k.save('', `<span>${L.save}</span>`)}
  ${k.install}
  ${k.sections()}`,
    };
  },

  sxglass: (k) => {
    const { v, L, esc } = k;
    const wid = [k.hoursText && ['ri-time-fill', L.hours, k.hoursText], v.location && ['ri-map-pin-2-fill', L.location, v.location], v.company && ['ri-building-fill', L.company || 'Company', v.company]].filter(Boolean).slice(0, 2);
    return {
      main: `<header class="x-gl"><span class="x-pane x-p2" aria-hidden="true"></span><span class="x-pane x-p1" aria-hidden="true"></span>
    <div class="x-pane x-front">${k.share('x-ic', '<i class="ri-share-forward-line"></i>')}${k.avatar()}<h1 class="name">${esc(k.fullName)}${k.verified}</h1>${k.roleP}</div>
  </header>
  ${wid.length ? `<div class="x-wid x-meta">${wid.map(([i, l, t]) => `<div><i class="${i}"></i><small>${l}</small><b>${esc(t)}</b></div>`).join('')}</div>` : ''}
  <nav class="x-appdock x-actions" aria-label="Contact">${k.acts.map((a) => k.A(a, 'x-app', `<span style="--ac:${APP[a.icon] || '#8e8e93'}"><i class="${a.icon}"></i></span><small>${a.label}</small>`)).join('')}</nav>
  ${k.save('', `<i class="ri-user-add-line"></i><span>${L.save}</span>`)}
  ${k.install}
  ${k.sections()}`,
    };
  },

  sxholo: (k) => {
    const { v, L, esc } = k;
    return {
      main: `<header class="x-hb"><div class="x-swing">
    <span class="x-strap" aria-hidden="true"></span><span class="x-clip" aria-hidden="true"></span>
    <div class="x-badge">
      <div class="x-bh"><span class="x-meta">${esc(v.company || k.appName)}</span><i class="ri-wifi-line" aria-hidden="true"></i></div>
      ${k.avatar()}
      <h1 class="name">${esc(k.fullName)}${k.verified}</h1>${k.roleP}
      <div class="x-bc"><span class="x-code" aria-hidden="true"></span>${k.share('x-ic', '<i class="ri-share-forward-line"></i>')}</div>
    </div></div>
  </header>
  <nav class="x-gk x-actions" aria-label="Contact">${k.acts.map((a) => k.A(a, 'x-g', `<i class="${a.icon}"></i><span><b>${a.label}</b><small>${esc(a.sub || '')}</small></span>`)).join('')}</nav>
  ${k.save('', `<i class="ri-user-add-line"></i><span>${L.save}</span>`)}
  ${k.install}
  ${k.sections()}`,
    };
  },

  sxterm: (k) => {
    const { L, esc } = k;
    return {
      main: `<div class="x-win">
    <div class="x-chrome"><span></span><span></span><span></span><b>${esc(k.alias)}@card: ~</b>${k.share('x-ic', '<i class="ri-share-forward-line"></i>')}</div>
    <div class="x-tty">
      <p class="x-cmd">whoami</p>
      <div class="x-out x-who">${k.avatar()}<div><h1 class="name">${esc(k.fullName)}${k.verified}</h1>${k.roleP}${k.v.company ? `<p class="x-co x-meta">${esc(k.v.company)}</p>` : ''}</div></div>
      ${k.acts.length ? `<p class="x-cmd">ls ./contact</p>
      <nav class="x-out x-cmds x-actions" aria-label="Contact">${k.acts.map((a, i) => k.A(a, 'x-c', `<em>[${i + 1}]</em><b>${a.label}</b><small>${esc(a.sub || '')}</small>`)).join('')}</nav>` : ''}
      <p class="x-cmd">./save-contact<span class="x-cur" aria-hidden="true"></span></p>
      ${k.save('', `<span>${L.save}</span>`)}
    </div>
  </div>
  ${k.install}
  ${k.sections()}`,
    };
  },

  sxaurora: (k) => {
    const { v, L, esc } = k;
    return {
      main: `<div class="x-isl">${k.avatar()}<span class="x-meta">${esc(v.company || k.role || k.first)}</span>${k.share('x-ic', '<i class="ri-share-forward-line"></i>')}</div>
  <header class="x-au"><span class="x-sky" aria-hidden="true"></span>
    <h1 class="name">${k.stacked}${k.verified}</h1>${k.roleP}
    ${v.location || k.hoursText ? `<div class="x-chips x-meta">${v.location ? `<span><i class="ri-map-pin-line"></i>${esc(v.location)}</span>` : ''}${k.hoursText ? `<span><i class="ri-time-line"></i>${k.hoursText}</span>` : ''}</div>` : ''}
  </header>
  <nav class="x-rows x-actions" aria-label="Contact">${k.acts.map((a, i) => k.A(a, 'x-r', `<kbd>${i + 1}</kbd><i class="${a.icon}"></i><span><b>${a.label}</b><small>${esc(a.sub || '')}</small></span><i class="ri-arrow-right-line x-go"></i>`)).join('')}</nav>
  ${k.save('', `<i class="ri-user-add-line"></i><span>${L.save}</span>`)}
  ${k.install}
  ${k.sections()}`,
    };
  },

  sxbrand: (k) => {
    const { v, L, esc } = k;
    return {
      main: `<header class="x-br">
    <div class="x-panel"><span class="x-outl" aria-hidden="true">${esc(k.first)}</span>${k.share('x-ic', '<i class="ri-share-forward-line"></i>')}${v.company ? `<span class="x-co x-meta">${esc(v.company)}</span>` : ''}</div>
    <div class="x-avw">${k.avatar()}</div>
    <h1 class="name">${k.stacked}${k.verified}</h1>${k.roleP}
    ${k.sentence ? `<blockquote class="x-quote">${esc(k.sentence)}</blockquote>` : ''}
  </header>
  <nav class="x-duo x-actions" aria-label="Contact">${k.acts.map((a) => k.A(a, 'x-d', `<i class="${a.icon}"></i><b>${a.label}</b><i class="ri-arrow-right-up-line x-go"></i>`)).join('')}</nav>
  ${k.save('', `<i class="ri-user-add-line"></i><span>${L.save}</span>`)}
  ${k.install}
  ${k.sections()}`,
    };
  },

  sxpolaroid: (k) => {
    const { v, L, esc } = k;
    const pics = k.gallery.filter((g) => g.image).slice(0, 2);
    const print = (g, cls) => `<div class="x-pol ${cls}">${g ? `<img src="${k.url(g.image)}" alt="" loading="lazy">` : '<span class="x-blank"></span>'}</div>`;
    return {
      main: `<header class="x-pl">
    <div class="x-fan" role="button" tabindex="0" aria-label="${esc(k.fullName)}">${print(pics[1], 'x-p3')}${print(pics[0], 'x-p2')}<div class="x-pol x-p1">${k.avatar()}<span class="x-cap">${esc(k.first)}</span></div></div>
    <h1 class="name">${esc(k.fullName)}${k.verified}</h1>${k.roleP}
    ${v.company || v.location ? `<p class="x-sub x-meta">${[v.company, v.location].filter(Boolean).map(esc).join(' · ')}</p>` : ''}
  </header>
  <nav class="x-stamps x-actions" aria-label="Contact">${k.acts.map((a) => k.A(a, 'x-stp', `<i class="${a.icon}"></i><span>${a.label}</span>`)).join('')}${k.share('x-stp', `<i class="ri-share-forward-fill"></i><span>${L.share}</span>`)}</nav>
  ${k.save('', `<i class="ri-user-add-line"></i><span>${L.save}</span>`)}
  ${k.install}
  ${k.sections()}`,
      script: "var xfan=$('.x-fan');if(xfan){var xft=function(){xfan.classList.toggle('open')};xfan.addEventListener('click',xft);xfan.addEventListener('keydown',function(e){if(e.key==='Enter'||e.key===' '){e.preventDefault();xft()}})}",
    };
  },
};

const CSS = String.raw`
@keyframes x-swing{from{transform:rotate(-3.2deg)}to{transform:rotate(3.2deg)}}
@keyframes x-holo{to{background-position:200% 50%}}
@keyframes x-blink{50%{opacity:0}}
@keyframes x-line2{from{opacity:0;transform:translateX(-8px)}to{opacity:1;transform:none}}
@keyframes x-sky{from{transform:translate3d(-5%,-3%,0) rotate(0) scale(1)}to{transform:translate3d(5%,4%,0) rotate(12deg) scale(1.15)}}
@keyframes x-prog{from{transform:scaleX(0)}to{transform:scaleX(1)}}

/* ================================================================== sxpitch: a pitch deck */
.l-sxpitch{--r:18px}
.l-sxpitch .x-prog{position:fixed;z-index:30;top:0;left:0;right:0;height:4px;background:linear-gradient(90deg,var(--p),var(--s));transform-origin:left;transform:scaleX(0)}
@supports (animation-timeline:scroll()){.l-sxpitch .x-prog{animation:x-prog linear both;animation-timeline:scroll(root)}}
.l-sxpitch .x-p0{padding:22px 24px 0}
.l-sxpitch .x-ptop{display:flex;justify-content:space-between;align-items:center;gap:12px}
.l-sxpitch .x-co{display:inline-flex;padding:6px 13px;border-radius:999px;font-size:12.5px;font-weight:700;background:var(--tx);color:var(--bg);max-width:60%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.l-sxpitch .x-shr{display:inline-flex;align-items:center;gap:4px;background:none;border:0;font:inherit;font-size:13px;font-weight:600;color:var(--tx);cursor:pointer}
.l-sxpitch .name{display:block;text-align:start;margin-top:34px;font-size:clamp(46px,14.5vw,64px);font-weight:700;line-height:.95;letter-spacing:-.055em;overflow-wrap:anywhere;animation:x-rise .9s var(--ease) both}
.l-sxpitch .name i{font-size:.36em;vertical-align:.6em;margin-inline-start:6px}
.l-sxpitch .role{text-align:start;margin-top:16px;font-size:19px;line-height:1.3;color:var(--tx);opacity:.7;animation:x-rise .9s .1s var(--ease) both}
.l-sxpitch .x-shot{margin-top:26px;aspect-ratio:16/10;border-radius:24px;overflow:hidden;box-shadow:0 34px 60px -34px rgba(15,23,42,.7);animation:x-in 1s .15s var(--ease) both}
.l-sxpitch .avatar{width:100%;height:100%;border:0;border-radius:0;box-shadow:none;object-fit:cover;object-position:center 24%;animation:x-ken 1.6s var(--ease) both}
.l-sxpitch .avatar.ph{font-size:80px}
.l-sxpitch .x-pa{display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:18px 24px 0}
.l-sxpitch .x-pb{display:flex;align-items:center;gap:10px;padding:14px;border-radius:16px;border:1px solid var(--line);background:var(--card);font-size:12.5px;font-weight:600;min-width:0;transition:background .25s,color .25s,transform .3s var(--ease)}
.l-sxpitch .x-pb i{font-size:20px;color:var(--p)}
.l-sxpitch .x-pb span{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}

.l-sxpitch .x-pb:last-child:nth-child(odd){grid-column:span 2}
.l-sxpitch .x-pb:hover{background:var(--tx);color:var(--bg);transform:translateY(-3px)}
.l-sxpitch .x-pb:hover i{color:inherit}
.l-sxpitch .save{margin:10px 24px 0;border-radius:16px;justify-content:space-between;padding:0 22px;background:linear-gradient(110deg,var(--p),var(--s))}
.l-sxpitch .save i{transition:transform .35s var(--ease)}
.l-sxpitch .save:hover i{transform:translateX(6px)}
.l-sxpitch .install{margin-inline:24px;width:calc(100% - 48px)}
.l-sxpitch .x-slides{padding:30px 14px 0;display:grid;gap:14px}
.l-sxpitch .x-sl{position:relative;overflow:hidden;padding:26px 18px 20px;border-radius:26px;background:var(--card);border:1px solid var(--line)}
.l-sxpitch .x-num{position:absolute;top:-22px;inset-inline-end:8px;font-size:110px;font-weight:800;line-height:1;letter-spacing:-.06em;color:var(--p);opacity:.09;pointer-events:none}
.l-sxpitch .x-sl .sec{padding:0}
.l-sxpitch .x-sl .sec h3{margin:0 0 16px;color:var(--tx);font-size:22px;font-weight:700;letter-spacing:-.03em;text-transform:none}
.l-sxpitch .x-sl .sec h3 i{display:none}
.l-sxpitch .x-sl .sec h3:before{content:"";width:9px;height:9px;border-radius:3px;background:linear-gradient(135deg,var(--p),var(--s))}
.l-sxpitch .x-sl .box,.l-sxpitch .x-sl .links a,.l-sxpitch .x-sl .pays a{background:color-mix(in srgb,var(--p) 4%,var(--bg));box-shadow:none}
.l-sxpitch .s-about .box{background:none;border:0;padding:0;font-size:18px;line-height:1.5}

/* ================================================================== sxmenu: a restaurant / hotel menu */
.l-sxmenu{--r:4px}
.l-sxmenu .x-mn{position:relative;min-height:400px;display:grid;align-items:center;text-align:center;color:#fff;padding:60px 26px 80px}
.l-sxmenu .x-bg{position:absolute;inset:0;background:radial-gradient(80% 70% at 50% 20%,color-mix(in srgb,var(--s) 40%,transparent),transparent 70%),linear-gradient(170deg,var(--p),color-mix(in srgb,var(--p) 46%,#000))}
.l-sxmenu .x-bg.x-img{background-size:cover;background-position:center}
.l-sxmenu .x-bg:after{content:"";position:absolute;inset:0;background:linear-gradient(rgba(0,0,0,.3),rgba(0,0,0,.5))}
.l-sxmenu .x-bg:before{content:"";position:absolute;inset:14px;border:1px solid color-mix(in srgb,var(--s) 70%,transparent);z-index:1}
.l-sxmenu .x-ic{position:absolute;top:26px;inset-inline-end:26px;z-index:2;width:42px;height:42px;border-radius:50%;border:1px solid rgba(255,255,255,.5);background:rgba(0,0,0,.25);color:#fff;font-size:17px;cursor:pointer;display:grid;place-items:center}
.l-sxmenu .x-ttl{position:relative;z-index:1}
.l-sxmenu .x-orn{display:block;color:var(--s);font-size:15px;margin-bottom:14px}
.l-sxmenu .role{color:var(--s);font-size:11px;letter-spacing:.36em;text-transform:uppercase;margin:0 0 14px}
.l-sxmenu .name{color:#fff;font-size:clamp(38px,11.5vw,50px);font-weight:500;line-height:1.05;letter-spacing:.005em;animation:x-rise 1s var(--ease) both}
.l-sxmenu .name i{color:var(--s);font-size:.4em;vertical-align:.5em}
.l-sxmenu .x-sub{margin-top:14px;font-size:14.5px;font-style:italic;opacity:.9}
.l-sxmenu .x-med{position:absolute;z-index:2;left:50%;bottom:-52px;margin-left:-55px}
.l-sxmenu .avatar{width:110px;height:110px;border:1px solid var(--s);padding:5px;background:var(--bg);box-shadow:0 20px 40px -18px rgba(0,0,0,.7)}
.l-sxmenu .avatar.ph{font-size:34px;background:linear-gradient(135deg,var(--p),var(--s));background-clip:content-box}
.l-sxmenu .x-open{margin-top:70px;text-align:center;font-size:12px;letter-spacing:.2em;text-transform:uppercase;color:var(--muted)}
.l-sxmenu .x-mn+.x-two{margin-top:74px}
.l-sxmenu .x-two{display:flex;flex-wrap:wrap;justify-content:center;gap:10px 8px;padding:18px 26px 0}
.l-sxmenu .x-bt{flex:1 1 40%;display:flex;align-items:center;justify-content:center;gap:8px;height:52px;border:1px solid var(--tx);font-size:12px;letter-spacing:.18em;text-transform:uppercase;font-weight:600;transition:background .3s,color .3s}
.l-sxmenu .x-bt i{color:var(--s);font-size:17px}
.l-sxmenu .x-bt:hover{background:var(--tx);color:var(--bg)}
.l-sxmenu .x-tx{padding:6px 12px;font-size:12px;letter-spacing:.16em;text-transform:uppercase;color:var(--muted);text-decoration:underline;text-underline-offset:5px;text-decoration-color:var(--s)}
.l-sxmenu .save{margin:14px 26px 0;border-radius:0;background:var(--s);color:var(--ons);box-shadow:none;letter-spacing:.24em;text-transform:uppercase;font-size:12.5px}
.l-sxmenu .install{margin-inline:26px;width:calc(100% - 52px);border-radius:0}
.l-sxmenu .sec{padding:46px 26px 0}
.l-sxmenu .sec h3{display:block;text-align:center;margin:0 0 20px;color:var(--tx);font-size:27px;font-weight:500;letter-spacing:0;text-transform:none}
.l-sxmenu .sec h3 i{display:none}
.l-sxmenu .sec h3:after{content:"\2726";display:block;margin-top:8px;font-size:11px;color:var(--s)}
.l-sxmenu .box,.l-sxmenu .links a,.l-sxmenu .pays a,.l-sxmenu .post{background:transparent;box-shadow:none;border-color:color-mix(in srgb,var(--s) 40%,transparent)}
.l-sxmenu .about{text-align:center;font-size:16.5px;line-height:1.75}
.l-sxmenu .s-about .box{border:0;padding:0}
.l-sxmenu .svc{padding:0;border:0}
.l-sxmenu .svc .item{padding:13px 0;border:0!important}
.l-sxmenu .svc img,.l-sxmenu .svc .ic{display:none}
.l-sxmenu .svc .item>div{flex:1;min-width:0}
.l-sxmenu .svc b{display:flex;align-items:baseline;gap:10px;font-size:17px;font-weight:600}
.l-sxmenu .svc b:after{content:"";flex:1;border-bottom:2px dotted color-mix(in srgb,var(--tx) 40%,transparent);transform:translateY(-4px)}
.l-sxmenu .svc p{font-style:italic}
.l-sxmenu .hours{outline:1px solid color-mix(in srgb,var(--s) 40%,transparent);outline-offset:-6px;padding:18px 24px}
.l-sxmenu .gal{gap:4px;grid-template-columns:1fr 1fr}
.l-sxmenu .gal a{border-radius:0}
.l-sxmenu .gal img{aspect-ratio:4/5}
.l-sxmenu .social{display:flex;flex-wrap:wrap;justify-content:center}
.l-sxmenu .social a{width:50px;border-radius:50%;background:transparent;box-shadow:none;border-color:color-mix(in srgb,var(--s) 55%,transparent);color:var(--s)}
.l-sxmenu .btn,.l-sxmenu form.enq input,.l-sxmenu form.enq textarea{border-radius:0}

/* ================================================================== sxglass: layered panes, widgets, app dock */
.l-sxglass{--r:26px;--gl:linear-gradient(150deg,color-mix(in srgb,#fff 22%,transparent),color-mix(in srgb,#fff 7%,transparent));background:radial-gradient(90% 46% at 0% 0%,color-mix(in srgb,var(--p) 72%,transparent),transparent 70%),radial-gradient(80% 44% at 100% 30%,color-mix(in srgb,var(--s) 64%,transparent),transparent 72%),radial-gradient(90% 50% at 20% 100%,color-mix(in srgb,var(--p) 50%,transparent),transparent 70%),var(--bg)}
.l-sxglass .x-gl{position:relative;padding:74px 30px 0}
.l-sxglass .x-pane{display:block;border-radius:34px;background:var(--gl);backdrop-filter:blur(26px) saturate(1.7);-webkit-backdrop-filter:blur(26px) saturate(1.7);border:1px solid color-mix(in srgb,#fff 34%,transparent);box-shadow:inset 0 1px 0 color-mix(in srgb,#fff 46%,transparent),0 40px 70px -44px rgba(0,0,0,.8)}
.l-sxglass .x-p1,.l-sxglass .x-p2{position:absolute;left:30px;right:30px;height:200px;animation:x-in 1s var(--ease) both}
.l-sxglass .x-p2{top:34px;transform:scale(.84);opacity:.5}
.l-sxglass .x-p1{top:54px;transform:scale(.92);opacity:.75;animation-delay:.08s}
.l-sxglass .x-front{position:relative;padding:28px 22px 30px;text-align:center;animation:x-in 1s .16s var(--ease) both}
.l-sxglass .x-ic{position:absolute;top:16px;inset-inline-end:16px;width:40px;height:40px;border-radius:50%;border:1px solid color-mix(in srgb,#fff 30%,transparent);background:color-mix(in srgb,#fff 14%,transparent);color:var(--tx);font-size:16px;cursor:pointer;display:grid;place-items:center}
.l-sxglass .avatar{width:112px;height:112px;margin:0 auto;border:3px solid color-mix(in srgb,#fff 70%,transparent);box-shadow:0 24px 40px -18px rgba(0,0,0,.7)}
.l-sxglass .name{margin-top:18px;font-size:27px}
.l-sxglass .x-wid{display:grid;grid-auto-flow:column;grid-auto-columns:1fr;gap:12px;padding:16px 18px 0}
.l-sxglass .x-wid div{min-width:0;padding:16px;border-radius:26px;background:var(--gl);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);border:1px solid color-mix(in srgb,#fff 28%,transparent)}
.l-sxglass .x-wid i{font-size:24px;color:var(--tx)}
.l-sxglass .x-wid small{display:block;margin-top:14px;font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--muted)}
.l-sxglass .x-wid b{display:block;margin-top:2px;font-size:14px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.l-sxglass .x-appdock{display:grid;grid-auto-flow:column;grid-auto-columns:1fr;margin:16px 18px 0;padding:14px 8px 10px;border-radius:32px;background:var(--gl);backdrop-filter:blur(24px) saturate(1.6);-webkit-backdrop-filter:blur(24px) saturate(1.6);border:1px solid color-mix(in srgb,#fff 30%,transparent)}
.l-sxglass .x-app{display:grid;justify-items:center;gap:6px;min-width:0;font-size:10.5px;color:var(--tx);animation:x-in .7s var(--ease) both}
.l-sxglass .x-app:nth-child(2){animation-delay:.06s}.l-sxglass .x-app:nth-child(3){animation-delay:.12s}.l-sxglass .x-app:nth-child(4){animation-delay:.18s}
.l-sxglass .x-app span{width:58px;height:58px;border-radius:17px;display:grid;place-items:center;font-size:28px;color:#fff;background:linear-gradient(160deg,color-mix(in srgb,var(--ac) 80%,#fff),var(--ac));box-shadow:inset 0 1px 0 rgba(255,255,255,.4),0 12px 20px -12px var(--ac);transition:transform .35s cubic-bezier(.34,1.56,.64,1)}
.l-sxglass .x-app:hover span{transform:translateY(-8px) scale(1.12)}
.l-sxglass .x-app small{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.l-sxglass .save{margin:16px 18px 0;border-radius:24px;background:color-mix(in srgb,#fff 90%,transparent);color:#10131c;box-shadow:0 24px 44px -22px rgba(0,0,0,.7)}
.l-sxglass .install{margin-inline:18px;width:calc(100% - 36px)}
.l-sxglass .sec{padding:28px 18px 0}
.l-sxglass .sec h3,.l-sxglass .sec h3 i{color:var(--tx)}
.l-sxglass .box,.l-sxglass .links a,.l-sxglass .social a,.l-sxglass .pays a,.l-sxglass .post,.l-sxglass .prod{background:var(--gl);backdrop-filter:blur(20px) saturate(1.6);-webkit-backdrop-filter:blur(20px) saturate(1.6);border:1px solid color-mix(in srgb,#fff 28%,transparent);box-shadow:inset 0 1px 0 color-mix(in srgb,#fff 30%,transparent)}
.l-sxglass .row>i:not(.go),.l-sxglass .svc .ic,.l-sxglass .links a i,.l-sxglass .pays a i{background:color-mix(in srgb,#fff 18%,transparent);color:var(--tx)}
.l-sxglass .social a{color:var(--tx)}
.l-sxglass.is-light{--gl:linear-gradient(150deg,color-mix(in srgb,#fff 74%,transparent),color-mix(in srgb,#fff 42%,transparent))}

/* ================================================================== sxholo: a holographic badge on a strap */
.l-sxholo{--r:18px}
.l-sxholo .x-hb{position:relative;padding:0 34px;overflow:hidden;background:radial-gradient(70% 50% at 50% 46%,color-mix(in srgb,var(--p) 30%,transparent),transparent 72%)}
.l-sxholo .x-swing{transform-origin:50% 0;animation:x-swing 4.6s ease-in-out infinite alternate}
.l-sxholo .x-strap{display:block;width:30px;height:86px;margin:0 auto;background:repeating-linear-gradient(180deg,var(--p) 0 10px,color-mix(in srgb,var(--p) 70%,#000) 10px 12px)}
.l-sxholo .x-clip{display:block;width:54px;height:20px;margin:0 auto -8px;position:relative;z-index:2;border-radius:6px;background:linear-gradient(#e5e7eb,#9ca3af);box-shadow:0 2px 4px rgba(0,0,0,.4)}
.l-sxholo .x-badge{position:relative;padding:28px 22px 20px;border-radius:26px;text-align:center;background:color-mix(in srgb,var(--tx) 7%,var(--bg));backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);box-shadow:0 40px 60px -34px #000}
.l-sxholo .x-badge:before{content:"";position:absolute;inset:0;border-radius:26px;padding:1.5px;background:linear-gradient(115deg,#ff5fd2,#5fd0ff,#7dffb0,#ffe66d,#ff5fd2);background-size:200% 100%;-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask:linear-gradient(#000 0 0) content-box exclude,linear-gradient(#000 0 0);animation:x-holo 5s linear infinite;pointer-events:none}
.l-sxholo .x-badge:after{content:"";position:absolute;inset:0;border-radius:26px;background:linear-gradient(115deg,transparent 30%,color-mix(in srgb,#5fd0ff 20%,transparent) 45%,color-mix(in srgb,#ff5fd2 18%,transparent) 55%,transparent 70%);background-size:200% 100%;animation:x-holo 5s linear infinite;mix-blend-mode:screen;pointer-events:none}
.l-sxholo .x-bh{display:flex;justify-content:space-between;align-items:center;margin-bottom:22px;font-size:10.5px;font-weight:700;letter-spacing:.24em;text-transform:uppercase;color:var(--p)}
.l-sxholo .x-bh i{font-size:20px;transform:rotate(90deg)}
.l-sxholo .avatar{width:136px;height:150px;margin:0 auto;border-radius:22px;border:1px solid color-mix(in srgb,var(--tx) 30%,transparent);box-shadow:0 20px 40px -18px #000}
.l-sxholo .avatar.ph{font-size:44px}
.l-sxholo .name{margin-top:20px;font-size:26px;letter-spacing:-.01em}
.l-sxholo .role{font-size:11.5px;letter-spacing:.26em;text-transform:uppercase;color:var(--p);margin-top:8px}
.l-sxholo .x-bc{position:relative;z-index:1;display:grid;grid-template-columns:1fr auto;gap:14px;align-items:center;margin-top:22px;padding-top:16px;border-top:1px dashed var(--line)}
.l-sxholo .x-code{height:38px;opacity:.8;background:repeating-linear-gradient(90deg,var(--tx) 0 2px,transparent 2px 5px,var(--tx) 5px 6px,transparent 6px 10px,var(--tx) 10px 13px,transparent 13px 15px,var(--tx) 15px 16px,transparent 16px 21px)}
.l-sxholo .x-ic{width:42px;height:42px;border-radius:13px;border:1px solid var(--line);background:color-mix(in srgb,var(--tx) 8%,transparent);color:var(--tx);font-size:17px;cursor:pointer;display:grid;place-items:center}
.l-sxholo .x-gk{display:grid;grid-template-columns:1fr 1fr;gap:10px;padding:30px 18px 0}
.l-sxholo .x-g{display:flex;align-items:center;gap:12px;min-width:0;padding:14px;border-radius:20px;background:color-mix(in srgb,var(--tx) 6%,transparent);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);border:1px solid color-mix(in srgb,var(--tx) 14%,transparent);transition:transform .3s var(--ease),border-color .3s}
.l-sxholo .x-g:last-child:nth-child(odd){grid-column:span 2}
.l-sxholo .x-g>i{font-size:22px;color:var(--p)}
.l-sxholo .x-g span{min-width:0}
.l-sxholo .x-g b{display:block;font-size:14px}
.l-sxholo .x-g small{display:block;font-size:11px;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.l-sxholo .x-g:hover{transform:translateY(-3px);border-color:var(--p)}
.l-sxholo .save{margin:12px 18px 0;border-radius:20px;background:linear-gradient(115deg,var(--p),var(--s))}
.l-sxholo .install{margin-inline:18px;width:calc(100% - 36px)}
.l-sxholo .sec{padding:30px 18px 0}
.l-sxholo .box,.l-sxholo .links a,.l-sxholo .social a,.l-sxholo .pays a,.l-sxholo .post,.l-sxholo .prod{background:color-mix(in srgb,var(--tx) 5%,transparent);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);border:1px solid color-mix(in srgb,var(--tx) 13%,transparent);box-shadow:none}

/* ================================================================== sxterm: a terminal window */
.l-sxterm{--r:4px;background:linear-gradient(color-mix(in srgb,var(--p) 6%,transparent) 1px,transparent 1px) 0 0/100% 28px,linear-gradient(90deg,color-mix(in srgb,var(--p) 6%,transparent) 1px,transparent 1px) 0 0/28px 100%,var(--bg)}
.l-sxterm .x-win{margin:16px 12px 0;border-radius:12px;overflow:hidden;background:color-mix(in srgb,var(--bg) 92%,var(--p));box-shadow:0 0 0 1px color-mix(in srgb,var(--p) 40%,transparent),0 30px 60px -30px #000,0 0 60px -30px var(--p);animation:x-in .8s var(--ease) both}
.l-sxterm .x-chrome{display:flex;align-items:center;gap:7px;padding:11px 12px;background:color-mix(in srgb,var(--tx) 8%,var(--bg));border-bottom:1px solid color-mix(in srgb,var(--p) 30%,transparent)}
.l-sxterm .x-chrome>span{width:11px;height:11px;border-radius:50%;background:#ff5f57}
.l-sxterm .x-chrome>span:nth-child(2){background:#febc2e}
.l-sxterm .x-chrome>span:nth-child(3){background:#28c840}
.l-sxterm .x-chrome b{flex:1;text-align:center;font-size:11.5px;font-weight:500;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.l-sxterm .x-ic{width:30px;height:30px;border-radius:6px;border:0;background:none;color:var(--p);font-size:16px;cursor:pointer;display:grid;place-items:center}
.l-sxterm .x-tty{padding:16px 16px 20px}
.l-sxterm .x-tty>*{animation:x-line2 .4s var(--ease) both}
.l-sxterm .x-tty>:nth-child(1){animation-delay:.3s}.l-sxterm .x-tty>:nth-child(2){animation-delay:.6s}.l-sxterm .x-tty>:nth-child(3){animation-delay:1s}.l-sxterm .x-tty>:nth-child(4){animation-delay:1.3s}.l-sxterm .x-tty>:nth-child(5){animation-delay:1.7s}.l-sxterm .x-tty>:nth-child(6){animation-delay:2s}
.l-sxterm .x-cmd{margin-top:16px;font-size:13px;color:var(--tx)}
.l-sxterm .x-cmd:first-child{margin-top:0}
.l-sxterm .x-cmd:before{content:"\276F  ";color:var(--p);font-weight:700}
.l-sxterm .x-cur{display:inline-block;width:8px;height:15px;margin-inline-start:4px;vertical-align:-2px;background:var(--p);animation:x-blink 1s steps(1) infinite}
.l-sxterm .x-out{margin-top:10px}
.l-sxterm .x-who{display:grid;grid-template-columns:auto 1fr;gap:14px;align-items:center}
.l-sxterm .avatar{width:84px;height:84px;border-radius:0;border:1px solid var(--p);padding:3px;background:var(--bg);box-shadow:5px 5px 0 color-mix(in srgb,var(--p) 40%,transparent);clip-path:polygon(0 0,calc(100% - 12px) 0,100% 12px,100% 100%,12px 100%,0 calc(100% - 12px))}
.l-sxterm .avatar.ph{font-size:26px}
.l-sxterm .name{display:block;text-align:start;font-size:21px;letter-spacing:-.01em}
.l-sxterm .name i{font-size:.8em;margin-inline-start:4px;vertical-align:middle}
.l-sxterm .role{text-align:start;margin-top:4px;font-size:12.5px;color:var(--p)}
.l-sxterm .role:before{content:"// "}
.l-sxterm .x-co{font-size:12px;color:var(--muted)}
.l-sxterm .x-cmds{display:grid;gap:2px}
.l-sxterm .x-c{display:grid;grid-template-columns:34px 104px 1fr;align-items:baseline;padding:8px 6px;font-size:13.5px;transition:background .2s,color .2s}
.l-sxterm .x-c em{font-style:normal;color:var(--p)}
.l-sxterm .x-c b{font-weight:600}
.l-sxterm .x-c small{color:var(--muted);font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.l-sxterm .x-c:hover{background:var(--p);color:var(--onp)}
.l-sxterm .x-c:hover em,.l-sxterm .x-c:hover small{color:inherit}
.l-sxterm .save{margin:12px 0 0;height:50px;border-radius:0;font-size:13px;letter-spacing:.14em;text-transform:uppercase;box-shadow:none;clip-path:polygon(0 0,calc(100% - 12px) 0,100% 12px,100% 100%,12px 100%,0 calc(100% - 12px))}
.l-sxterm .save:before{content:"[ ";white-space:pre}
.l-sxterm .save:after{content:" ]";white-space:pre;position:static;width:auto;background:none;transform:none;animation:none}
.l-sxterm .install{margin-inline:12px;width:calc(100% - 24px);border-radius:0}
.l-sxterm .sec{padding:28px 14px 0}
.l-sxterm .sec h3{margin-inline:0;color:var(--p);letter-spacing:.1em}
.l-sxterm .sec h3 i{display:none}
.l-sxterm .sec h3:before{content:"##"}
.l-sxterm .box,.l-sxterm .links a,.l-sxterm .social a,.l-sxterm .pays a,.l-sxterm .post,.l-sxterm .prod{border-radius:0;background:color-mix(in srgb,var(--bg) 90%,var(--p));border-color:color-mix(in srgb,var(--p) 30%,transparent);box-shadow:none}
.l-sxterm .row>i:not(.go),.l-sxterm .links a i,.l-sxterm .svc .ic,.l-sxterm .btn,.l-sxterm form.enq input,.l-sxterm form.enq textarea{border-radius:0}

/* ================================================================== sxaurora: aurora light, island bar, keycap rows */
.l-sxaurora{--r:20px;overflow:clip}
.l-sxaurora .x-isl{position:sticky;top:10px;z-index:8;display:flex;align-items:center;gap:10px;width:max-content;max-width:calc(100% - 32px);margin:12px auto 0;padding:6px 6px 6px 6px;border-radius:999px;background:color-mix(in srgb,#000 78%,transparent);color:#fff;backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);box-shadow:0 14px 30px -12px rgba(0,0,0,.7);animation:x-in .8s var(--ease) both}
.l-sxaurora .x-isl .avatar{width:34px;height:34px;border:0;box-shadow:none;animation:none}
.l-sxaurora .x-isl .avatar.ph{font-size:12px}
.l-sxaurora .x-isl span{font-size:13px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.l-sxaurora .x-ic{width:34px;height:34px;flex:none;border-radius:50%;border:0;background:rgba(255,255,255,.16);color:#fff;font-size:15px;cursor:pointer;display:grid;place-items:center}
.l-sxaurora .x-au{position:relative;padding:74px 24px 10px;text-align:center}
.l-sxaurora .x-sky{position:absolute;z-index:-1;inset:-120px -30% -40px;background:radial-gradient(36% 30% at 30% 40%,var(--p),transparent 70%),radial-gradient(34% 32% at 72% 34%,var(--s),transparent 70%),radial-gradient(40% 28% at 52% 70%,color-mix(in srgb,var(--p) 50%,var(--s)),transparent 72%);filter:blur(38px);opacity:.8;animation:x-sky 13s ease-in-out infinite alternate}
.l-sxaurora .name{display:block;font-size:clamp(46px,15vw,68px);font-weight:600;line-height:.95;letter-spacing:-.055em;overflow-wrap:anywhere;animation:x-rise 1s var(--ease) both}
.l-sxaurora .name i{font-size:.34em;vertical-align:.7em;margin-inline-start:6px}
.l-sxaurora .role{margin-top:18px;font-size:16px;color:var(--tx);opacity:.8}
.l-sxaurora .x-chips{display:flex;flex-wrap:wrap;justify-content:center;gap:8px;margin-top:18px}
.l-sxaurora .x-chips span{display:inline-flex;align-items:center;gap:6px;padding:7px 13px;border-radius:999px;font-size:12.5px;background:color-mix(in srgb,var(--tx) 9%,transparent);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px)}
.l-sxaurora .x-rows{display:grid;gap:8px;padding:34px 18px 0}
.l-sxaurora .x-r{display:grid;grid-template-columns:auto auto 1fr auto;gap:12px;align-items:center;padding:12px 14px 12px 12px;border-radius:18px;background:color-mix(in srgb,var(--tx) 6%,transparent);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);border:1px solid var(--line);animation:x-in .7s var(--ease) both;transition:transform .3s var(--ease),background .25s}
.l-sxaurora .x-r:nth-child(2){animation-delay:.07s}.l-sxaurora .x-r:nth-child(3){animation-delay:.14s}.l-sxaurora .x-r:nth-child(4){animation-delay:.21s}
.l-sxaurora kbd{display:grid;place-items:center;width:28px;height:28px;border-radius:8px;font:inherit;font-size:12px;font-weight:700;color:var(--muted);background:color-mix(in srgb,var(--tx) 8%,transparent);border:1px solid var(--line);border-bottom-width:3px}
.l-sxaurora .x-r>i:not(.x-go){font-size:21px;color:var(--p)}
.l-sxaurora .x-r span{min-width:0}
.l-sxaurora .x-r b{display:block;font-size:15px;font-weight:600}
.l-sxaurora .x-r small{display:block;font-size:12px;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.l-sxaurora .x-go{color:var(--muted);transition:transform .35s var(--ease)}
.l-sxaurora .x-r:hover{transform:translateX(4px);background:color-mix(in srgb,var(--tx) 11%,transparent)}
.l-sxaurora .x-r:hover .x-go{transform:translateX(5px);color:var(--p)}
.l-sxaurora .save{margin:12px 18px 0;border-radius:18px;background:linear-gradient(110deg,var(--p),var(--s))}
.l-sxaurora .install{margin-inline:18px;width:calc(100% - 36px)}
.l-sxaurora .sec{padding:32px 18px 0}
.l-sxaurora .sec h3{width:max-content;max-width:100%;background:linear-gradient(90deg,var(--p),var(--s));-webkit-background-clip:text;background-clip:text;color:transparent}
.l-sxaurora .sec h3 i{display:none}
.l-sxaurora .box,.l-sxaurora .links a,.l-sxaurora .social a,.l-sxaurora .pays a,.l-sxaurora .post{background:color-mix(in srgb,var(--tx) 5%,transparent)}

/* ================================================================== sxbrand: outline name on a colour panel */
.l-sxbrand{--r:22px}
.l-sxbrand .x-br{padding:0 24px}
.l-sxbrand .x-panel{position:relative;height:230px;margin:0 -24px;overflow:hidden;background:linear-gradient(150deg,var(--p),color-mix(in srgb,var(--p) 55%,var(--s)));color:var(--onp);border-radius:0 0 40px 40px}
.l-sxbrand .x-outl{position:absolute;left:-8px;bottom:-34px;font-size:150px;font-weight:800;line-height:1;letter-spacing:-.05em;white-space:nowrap;text-transform:uppercase;color:transparent;-webkit-text-stroke:1.5px color-mix(in srgb,var(--onp) 60%,transparent);animation:x-rise 1.1s var(--ease) both}
.l-sxbrand .x-ic{position:absolute;top:18px;inset-inline-end:18px;width:44px;height:44px;border-radius:50%;border:0;background:color-mix(in srgb,var(--onp) 16%,transparent);color:inherit;font-size:18px;cursor:pointer;display:grid;place-items:center}
.l-sxbrand .x-co{position:absolute;top:26px;inset-inline-start:24px;font-size:12px;font-weight:700;letter-spacing:.18em;text-transform:uppercase}
.l-sxbrand .x-avw{position:relative;margin-top:-66px}
.l-sxbrand .avatar{width:132px;height:132px;border:6px solid var(--bg);box-shadow:0 24px 40px -22px rgba(15,23,42,.6)}
.l-sxbrand .name{display:block;text-align:start;margin-top:18px;font-size:clamp(38px,11.5vw,48px);font-weight:800;line-height:.98;letter-spacing:-.045em;overflow-wrap:anywhere}
.l-sxbrand .name i{font-size:.42em;vertical-align:.4em;margin-inline-start:6px}
.l-sxbrand .role{text-align:start;margin-top:10px;font-size:16px;font-weight:600;color:var(--p)}
.l-sxbrand .x-quote{margin-top:24px;padding-inline-start:18px;border-inline-start:4px solid var(--p);font-size:20px;line-height:1.4;font-weight:500;letter-spacing:-.01em;text-wrap:balance}
.l-sxbrand .x-duo{display:grid;grid-template-columns:1fr 1fr;gap:10px;padding:26px 24px 0}
.l-sxbrand .x-d{position:relative;display:grid;gap:22px;padding:16px;border-radius:22px;background:var(--chip);min-width:0;transition:background .3s,color .3s,transform .35s var(--ease)}
.l-sxbrand .x-d:last-child:nth-child(odd){grid-column:span 2}
.l-sxbrand .x-d>i:first-child{font-size:24px;color:var(--p)}
.l-sxbrand .x-d b{font-size:16px;font-weight:700}
.l-sxbrand .x-go{position:absolute;top:14px;inset-inline-end:14px;font-size:20px;opacity:.5;transition:transform .35s var(--ease),opacity .25s}
.l-sxbrand .x-d:hover{background:var(--p);color:var(--onp);transform:translateY(-4px)}
.l-sxbrand .x-d:hover>i:first-child{color:inherit}
.l-sxbrand .x-d:hover .x-go{transform:translate(3px,-3px);opacity:1}
.l-sxbrand .save{margin:10px 24px 0;border-radius:22px}
.l-sxbrand .install{margin-inline:24px;width:calc(100% - 48px)}
.l-sxbrand .sec{padding:34px 24px 0}
.l-sxbrand .sec h3{margin-inline:0;color:var(--tx);font-size:22px;font-weight:800;letter-spacing:-.03em;text-transform:none}
.l-sxbrand .sec h3 i{display:none}
.l-sxbrand .tst .box{background:color-mix(in srgb,var(--p) 7%,var(--bg));border-color:transparent}

/* ================================================================== sxpolaroid: a fan of prints */
.l-sxpolaroid{--r:4px;background:repeating-linear-gradient(0deg,color-mix(in srgb,var(--tx) 2.5%,transparent) 0 1px,transparent 1px 4px),var(--bg)}
.l-sxpolaroid .x-pl{padding:46px 24px 0;text-align:center}
.l-sxpolaroid .x-fan{position:relative;width:206px;height:258px;margin:0 auto;cursor:pointer;outline-offset:14px}
.l-sxpolaroid .x-pol{position:absolute;inset:0;padding:11px 11px 46px;background:#fff;box-shadow:0 1px 2px rgba(0,0,0,.16),0 24px 40px -22px rgba(0,0,0,.55);transition:transform .6s cubic-bezier(.34,1.3,.64,1)}
.l-sxpolaroid .x-pol img,.l-sxpolaroid .x-blank,.l-sxpolaroid .x-pol .avatar{display:block;width:100%;height:100%;object-fit:cover}
.l-sxpolaroid .x-blank{background:linear-gradient(135deg,var(--p),var(--s))}
.l-sxpolaroid .x-p3{transform:rotate(-9deg) translate(-14px,6px)}
.l-sxpolaroid .x-p2{transform:rotate(7deg) translate(14px,2px)}
.l-sxpolaroid .x-p2 .x-blank{background:linear-gradient(135deg,var(--s),var(--p))}
.l-sxpolaroid .x-p1{transform:rotate(-2deg);animation:x-in .9s var(--ease) both}
.l-sxpolaroid .x-fan:hover .x-p3,.l-sxpolaroid .x-fan.open .x-p3{transform:rotate(-19deg) translate(-74px,14px)}
.l-sxpolaroid .x-fan:hover .x-p2,.l-sxpolaroid .x-fan.open .x-p2{transform:rotate(17deg) translate(74px,10px)}
.l-sxpolaroid .x-fan:hover .x-p1,.l-sxpolaroid .x-fan.open .x-p1{transform:rotate(0) translateY(-8px)}
.l-sxpolaroid .avatar{border:0;border-radius:0;box-shadow:none;animation:none}
.l-sxpolaroid .avatar.ph{display:flex;font-size:60px}
.l-sxpolaroid .x-cap{position:absolute;left:0;right:0;bottom:9px;font-size:21px;font-style:italic;color:#2a2622;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding:0 10px}
.l-sxpolaroid .name{margin-top:40px;font-size:38px;font-weight:500;font-style:italic;letter-spacing:-.02em;line-height:1.05}
.l-sxpolaroid .name i{font-style:normal;font-size:.5em}
.l-sxpolaroid .role{font-size:11.5px;letter-spacing:.3em;text-transform:uppercase;margin-top:12px}
.l-sxpolaroid .x-sub{margin-top:12px;font-size:14px;font-style:italic;color:var(--muted)}
.l-sxpolaroid .x-stamps{display:flex;flex-wrap:wrap;justify-content:center;gap:12px;padding:28px 18px 0}
.l-sxpolaroid .x-stp{display:grid;place-content:center;justify-items:center;gap:3px;width:74px;height:74px;border-radius:50%;border:1.5px dashed var(--p);background:none;font:inherit;font-size:8.5px;font-weight:700;letter-spacing:.03em;text-transform:uppercase;color:var(--p);cursor:pointer;box-shadow:inset 0 0 0 4px var(--bg),inset 0 0 0 5px color-mix(in srgb,var(--p) 50%,transparent);transition:transform .4s cubic-bezier(.34,1.56,.64,1),background .25s,color .25s}
.l-sxpolaroid .x-stp:nth-child(odd){transform:rotate(-7deg)}
.l-sxpolaroid .x-stp:nth-child(even){transform:rotate(6deg)}
.l-sxpolaroid .x-stp i{font-size:21px}
.l-sxpolaroid .x-stp:hover{transform:rotate(0) scale(1.1);background:var(--p);color:var(--onp)}
.l-sxpolaroid .save{margin:24px auto 0;width:max-content;max-width:calc(100% - 48px);padding:0 34px;border-radius:999px;background:var(--tx);color:var(--bg);box-shadow:none;font-style:italic}
.l-sxpolaroid .install{margin:10px auto 0;width:max-content;padding:0 26px}
.l-sxpolaroid .sec{padding:44px 22px 0}
.l-sxpolaroid .sec h3{justify-content:center;color:var(--tx);font-size:25px;font-weight:500;font-style:italic;letter-spacing:-.01em;text-transform:none}
.l-sxpolaroid .sec h3 i{display:none}
.l-sxpolaroid .box{position:relative;background:color-mix(in srgb,#fff 60%,var(--bg));box-shadow:0 14px 24px -18px rgba(0,0,0,.45);border-color:transparent}
.l-sxpolaroid .box:before{content:"";position:absolute;top:-10px;left:50%;width:74px;height:22px;margin-left:-37px;transform:rotate(-2deg);background:color-mix(in srgb,var(--s) 45%,transparent);box-shadow:0 1px 2px rgba(0,0,0,.1)}
.l-sxpolaroid .links a,.l-sxpolaroid .pays a{background:color-mix(in srgb,#fff 60%,var(--bg));box-shadow:none}
.l-sxpolaroid .about{text-align:center}
.l-sxpolaroid .gal{gap:14px;grid-template-columns:1fr 1fr}
.l-sxpolaroid .gal a{border-radius:0;padding:8px 8px 26px;background:#fff;box-shadow:0 1px 2px rgba(0,0,0,.14),0 16px 26px -18px rgba(0,0,0,.5)}
.l-sxpolaroid .gal a:nth-child(odd){transform:rotate(-1.8deg)}
.l-sxpolaroid .gal a:nth-child(even){transform:rotate(1.4deg) translateY(10px)}
.l-sxpolaroid .social{display:flex;flex-wrap:wrap;justify-content:center}
.l-sxpolaroid .social a{width:50px;border-radius:50%;background:transparent;box-shadow:none;border-color:var(--tx);color:var(--tx)}
`;

module.exports = { designs, CSS };
