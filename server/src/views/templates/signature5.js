/*
 * Signature designs, pack 5: "Tap profile" cards. The family comes from the card you tap against a phone: a profile screen
 * with a cover photo, a round portrait with a verified badge, three round actions (call, e-mail, add contact), one big
 * "Connect with me" button and a "My links" sheet where every network is a round brand icon with its name underneath.
 * See signature.js for the kit each design receives.
 *
 *   sxtap        the original: inset cover photo, black pill button, white links sheet with a 3 x n grid of round icons
 *   sxtapnight   the same screen in the dark: glass sheet, white pill button
 *   sxtapring    no cover photo: a gradient ring around the portrait, pill actions with labels, a compact 4-column grid
 *   sxtapfull    a tall full-bleed cover; one big sheet rises over it and holds everything
 *   sxtapwallet  a coloured background, the profile as a floating card, links as a row you swipe sideways
 *   sxtaplist    the same sheet but every link is a row: round icon, name, chevron
 *   sxtapgrad    a gradient cover that curves away, a squircle portrait and app-icon style links
 *   sxtapsplit   compact: portrait and name side by side, actions in a row, 4-column links
 *   sxtapbold    the name written over the cover photo, outlined round icons, a "Connect" bar that stays on screen
 *   sxtapsoft    pastel colour, a soft squircle portrait and tinted round links
 */
// brand colour of each network on its round tile (some differ from the brand-colour table, which is tuned for dark cards)
const TILE = { tiktok: '#111111', snapchat: '#fffc00', github: '#181717', website: '#475569', twitter: '#111111', telegram: '#2aabee' };
const DARK_ICON = new Set(['snapchat']);

function parts(k) {
  const { v, L, esc } = k;
  const items = [];
  if (k.sec.social) for (const [key, u] of k.socials) items.push({ key, href: u, icon: k.SOCIAL[key][0], label: k.SOCIAL[key][1], color: TILE[key] || k.BRAND[key] || '#64748b' });
  if (k.sec.links) for (const l of (v.custom_links || [])) if (l && l.url) items.push({ key: 'link', href: l.url, icon: /^ri-[a-z0-9-]+$/.test(l.icon || '') ? l.icon : 'ri-links-line', label: l.label || 'Link', color: null });
  const link = (it, i, kind) => {
    const style = `--i:${i}${it.color ? `;--ic:${it.color};--ict:${DARK_ICON.has(it.key) ? '#111' : '#fff'}` : ''}`;
    const common = `href="${k.url(it.href)}" target="_blank" rel="noopener" style="${style}" data-k="${it.key}"`;
    if (kind === 'list') return `<a class="tp-r${it.color ? '' : ' tp-n'}" ${common}><span class="tp-lc"><i class="${it.icon}"></i></span><span class="tp-ln">${esc(it.label)}</span><i class="ri-arrow-right-s-line tp-go" aria-hidden="true"></i></a>`;
    return `<a class="tp-l${it.color ? '' : ' tp-n'}" ${common}><span class="tp-lc"><i class="${it.icon}"></i></span><span class="tp-ln">${esc(it.label)}</span></a>`;
  };
  const cover = (extra = '') => `<div class="tp-cover${v.cover_image ? ' tp-img' : ''}"${v.cover_image ? ` style="background-image:url('${k.url(v.cover_image)}')"` : ''}>${extra}</div>`;
  const shareBtn = (cls = 'tp-share') => k.share(cls, '<i class="ri-share-forward-line"></i>');
  const sheet = (kind = 'circle', cls = '') => (items.length
    ? `<section class="tp-sheet ${cls}"><span class="tp-grab" aria-hidden="true"></span><h2 class="tp-st">${esc(L.mylinks || 'My links')}</h2>
      <div class="${kind === 'list' ? 'tp-rows' : 'tp-grid'} x-socs">${items.map((it, i) => link(it, i, kind)).join('')}</div></section>` : '');
  const acts = (pills, n = 2) => {
    const list = k.acts.slice(0, n);
    const addIcon = `<a class="x-a tp-a" href="/${k.alias}/contact.vcf" aria-label="${esc(L.save)}"><i class="ri-user-add-line"></i>${pills ? `<span>${esc(L.save)}</span>` : ''}</a>`;
    return `<nav class="tp-acts${pills ? ' tp-pills' : ''} x-actions" aria-label="Contact">${list.map((a) => k.A(a, 'tp-a', `<i class="${a.icon.replace('-fill', '-line')}"></i>${pills ? `<span>${a.label}</span>` : ''}`)).join('')}${addIcon}</nav>`;
  };
  const connect = (cls = '') => k.save(`tp-cta ${cls}`, `<span>${esc(L.connect || 'Connect with me')}</span>`);
  const rest = k.sections(k.order.filter((x) => x !== 'social' && x !== 'links'));
  const ident = `<h1 class="name">${esc(k.fullName)}${k.verified}</h1>${k.roleP}`;
  return { items, link, cover, shareBtn, sheet, acts, connect, rest, ident };
}

const designs = {
  sxtap: (k) => {
    const p = parts(k);
    return { main: `<div class="tp tp-std">
  <header class="tp-head">${p.cover(p.shareBtn())}<div class="tp-av">${k.avatar()}</div>${p.ident}</header>
  ${p.acts()}${p.connect()}${k.install}
  ${p.sheet()}
  ${p.rest}
</div>` };
  },

  sxtapnight: (k) => {
    const p = parts(k);
    return { main: `<div class="tp tp-std tp-night">
  <header class="tp-head">${p.cover(p.shareBtn())}<div class="tp-av">${k.avatar()}</div>${p.ident}</header>
  ${p.acts()}${p.connect()}${k.install}
  ${p.sheet()}
  ${p.rest}
</div>` };
  },

  sxtapring: (k) => {
    const p = parts(k);
    return { main: `<div class="tp tp-ring">
  <header class="tp-head"><span class="tp-blob" aria-hidden="true"></span>${p.shareBtn()}<div class="tp-av"><span class="tp-halo" aria-hidden="true"></span>${k.avatar()}</div>${p.ident}</header>
  ${p.acts(true, 3)}${p.connect()}${k.install}
  ${p.sheet('circle', 'tp-four')}
  ${p.rest}
</div>` };
  },

  sxtapfull: (k) => {
    const p = parts(k);
    return { main: `<div class="tp tp-full">
  <header class="tp-hero">${p.cover(p.shareBtn())}</header>
  <div class="tp-over"><span class="tp-grab" aria-hidden="true"></span>
    <div class="tp-av">${k.avatar()}</div>${p.ident}
    ${p.acts()}${p.connect()}${k.install}
    ${p.items.length ? `<h2 class="tp-st">${k.esc(k.L.mylinks || 'My links')}</h2><div class="tp-grid x-socs">${p.items.map((it, i) => p.link(it, i, 'circle')).join('')}</div>` : ''}
  </div>
  ${p.rest}
</div>` };
  },

  sxtapwallet: (k) => {
    const p = parts(k);
    return { main: `<div class="tp tp-wallet">
  <div class="tp-card">${p.shareBtn()}<div class="tp-av">${k.avatar()}</div>${p.ident}${p.acts()}${p.connect()}${k.install}</div>
  ${p.items.length ? `<h2 class="tp-st tp-onbg">${k.esc(k.L.mylinks || 'My links')}</h2><div class="tp-scroll x-socs">${p.items.map((it, i) => p.link(it, i, 'circle')).join('')}</div>` : ''}
  <div class="tp-rest">${p.rest}</div>
</div>` };
  },

  sxtaplist: (k) => {
    const p = parts(k);
    return { main: `<div class="tp tp-std tp-list">
  <header class="tp-head">${p.cover(p.shareBtn())}<div class="tp-av">${k.avatar()}</div>${p.ident}</header>
  ${p.acts()}${p.connect()}${k.install}
  ${p.sheet('list')}
  ${p.rest}
</div>` };
  },

  sxtapgrad: (k) => {
    const p = parts(k);
    return { main: `<div class="tp tp-grad">
  <header class="tp-head">${p.cover(p.shareBtn())}<div class="tp-av">${k.avatar()}</div>${p.ident}</header>
  ${p.acts()}${p.connect()}${k.install}
  ${p.sheet('circle', 'tp-squares')}
  ${p.rest}
</div>` };
  },

  sxtapsplit: (k) => {
    const p = parts(k);
    const { v, esc } = k;
    return { main: `<div class="tp tp-split">
  <header class="tp-row"><div class="tp-av">${k.avatar()}</div>
    <div class="tp-id">${p.ident}${v.company ? `<p class="tp-co">${esc(v.company)}</p>` : ''}</div>${p.shareBtn()}</header>
  ${p.acts(false, 3)}${p.connect()}${k.install}
  ${p.sheet('circle', 'tp-four')}
  ${p.rest}
</div>` };
  },

  sxtapbold: (k) => {
    const p = parts(k);
    const { v, esc } = k;
    return {
      main: `<div class="tp tp-bold">
  <header class="tp-head">${p.cover(`${p.shareBtn()}<div class="tp-ov">${v.company ? `<span class="tp-co">${esc(v.company)}</span>` : ''}<h1 class="name">${k.stacked}${k.verified}</h1>${k.roleP}</div>`)}<div class="tp-av">${k.avatar()}</div></header>
  ${p.acts()}${k.install}
  ${p.sheet('circle', 'tp-line')}
  ${p.rest}
</div>`,
      dock: `<nav class="tp-dock" aria-label="Save">${p.connect()}</nav>`,
    };
  },

  sxtapsoft: (k) => {
    const p = parts(k);
    return { main: `<div class="tp tp-soft">
  <header class="tp-head"><span class="tp-dots" aria-hidden="true"></span>${p.shareBtn()}<div class="tp-av">${k.avatar()}</div>${p.ident}</header>
  ${p.acts()}${p.connect()}${k.install}
  ${p.sheet('circle', 'tp-pastel')}
  ${p.rest}
</div>` };
  },
};

const CSS = String.raw`
@keyframes tp-pop{from{opacity:0;transform:translateY(14px) scale(.9)}to{opacity:1;transform:none}}
@keyframes tp-spin{to{transform:rotate(360deg)}}
@keyframes tp-drift{from{transform:translate3d(-4%,0,0)}to{transform:translate3d(4%,3%,0)}}

/* ================================================================== shared: the tap profile screen */
.tp{--ease:cubic-bezier(.16,1,.3,1);padding-bottom:26px}
.tp .tp-cover{position:relative;height:158px;margin:14px 14px 0;border-radius:26px;overflow:hidden;background:linear-gradient(135deg,var(--s),var(--p))}
.tp .tp-cover.tp-img{background-size:cover;background-position:center}
.tp .tp-share{position:absolute;top:12px;inset-inline-end:12px;z-index:2;width:38px;height:38px;border-radius:50%;border:0;display:grid;place-items:center;font-size:18px;color:#fff;background:rgba(0,0,0,.32);backdrop-filter:blur(8px);cursor:pointer;transition:transform .25s var(--ease),background .25s}
.tp .tp-share:hover{transform:scale(1.08);background:rgba(0,0,0,.5)}
.tp .tp-av{position:relative;z-index:2;width:104px;height:104px;margin:-54px auto 0}
.tp .avatar{width:104px;height:104px;border:4px solid var(--bg);box-shadow:0 14px 30px -14px rgba(0,0,0,.45);animation:tp-pop .7s var(--ease) both}
.tp .avatar.ph{font-size:34px}
.tp .name{display:flex;align-items:center;justify-content:center;gap:6px;margin:12px 20px 0;font-size:22px;font-weight:700;letter-spacing:-.02em;text-align:center;overflow-wrap:anywhere}
.tp .name i{font-size:19px;color:#1d9bf0}
.tp .role{margin:4px 20px 0;text-align:center;font-size:13px;color:var(--muted);font-weight:500}
.tp .tp-acts{display:flex;justify-content:center;gap:14px;margin:18px 20px 0}
.tp .tp-a{width:52px;height:52px;border-radius:50%;display:grid;place-items:center;font-size:21px;color:var(--tx);background:var(--card);border:1px solid var(--line);box-shadow:0 10px 22px -16px rgba(0,0,0,.5);transition:transform .25s var(--ease),background .25s,color .25s}
.tp .tp-a:hover{transform:translateY(-3px);background:var(--tx);color:var(--bg)}
.tp .tp-cta{margin:18px 24px 0;height:54px;border-radius:999px;background:var(--p);color:var(--onp);font-size:15px;font-weight:600;box-shadow:0 18px 30px -18px color-mix(in srgb,var(--p) 80%,#000)}
.tp .tp-cta:after{display:none}
.tp .tp-cta:active{transform:scale(.98)}
.tp .install{margin:12px 24px 0;width:calc(100% - 48px)}
.tp .tp-sheet{margin:22px 12px 0;padding:10px 16px 24px;border-radius:30px;background:var(--card);border:1px solid var(--line);box-shadow:0 24px 50px -34px rgba(0,0,0,.35)}
.tp .tp-grab{display:block;width:40px;height:4px;margin:0 auto 14px;border-radius:4px;background:color-mix(in srgb,var(--tx) 16%,transparent)}
.tp .tp-st{margin:0 0 18px;text-align:center;font-size:13px;font-weight:600;color:var(--muted);letter-spacing:.01em;text-transform:none}
.tp .tp-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:22px 6px}
.tp .tp-l{display:grid;justify-items:center;align-content:start;gap:9px;min-width:0;color:var(--tx);animation:tp-pop .6s calc(var(--i)*55ms + .1s) var(--ease) both}
.tp .tp-lc{width:64px;height:64px;border-radius:50%;display:grid;place-items:center;font-size:29px;color:var(--ict,var(--onp));background:var(--ic,var(--p));box-shadow:0 14px 24px -14px var(--ic,var(--p));transition:transform .3s var(--ease)}
.tp .tp-l:hover .tp-lc{transform:translateY(-4px) scale(1.06)}
.tp .tp-l:active .tp-lc{transform:scale(.94)}
.tp .tp-ln{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11.5px;font-weight:600;color:var(--muted)}
.tp [data-k=instagram] .tp-lc{background:radial-gradient(circle at 30% 107%,#fdf497 0,#fdf497 5%,#fd5949 45%,#d6249f 60%,#285aeb 90%)}
.tp .tp-n .tp-lc{background:color-mix(in srgb,var(--p) 14%,var(--bg));color:var(--p);box-shadow:none}
.tp .sec{padding:20px 14px 0}
.tp .tp-rest{padding-top:6px}

/* ---------------- sxtap: the original */
.l-sxtap{--r:24px}
.tp-std .tp-cta{background:#0a0a0a;color:#fff}
.tp-std .tp-a{background:#fff}

/* ---------------- sxtapnight: the same screen in the dark */
.tp-night .tp-a{background:rgba(255,255,255,.07);border-color:rgba(255,255,255,.14);color:var(--tx);box-shadow:none}
.tp-night .tp-a:hover{background:#fff;color:#0b0b12}
.tp-night .tp-cta{background:#fff;color:#0b0b12;box-shadow:0 18px 34px -20px rgba(255,255,255,.55)}
.tp-night .tp-sheet{background:linear-gradient(180deg,rgba(255,255,255,.08),rgba(255,255,255,.03));border-color:rgba(255,255,255,.12);backdrop-filter:blur(14px);box-shadow:0 30px 60px -36px #000}
.tp-night .tp-cover{background:linear-gradient(135deg,#312e81,#1e1b4b 60%,#0b0b12)}
.tp-night .tp-ln{color:rgba(255,255,255,.72)}
.tp-night .tp-n .tp-lc{background:rgba(255,255,255,.1);color:#fff}

/* ---------------- sxtapring: no cover, a ring around the portrait */
.tp-ring .tp-head{position:relative;padding-top:44px;overflow:hidden}
.tp-ring .tp-blob{position:absolute;inset:-120px -40px auto;height:340px;z-index:0;background:radial-gradient(60% 60% at 30% 40%,color-mix(in srgb,var(--p) 38%,transparent),transparent 70%),radial-gradient(55% 55% at 75% 30%,color-mix(in srgb,var(--s) 38%,transparent),transparent 70%);animation:tp-drift 12s ease-in-out infinite alternate}
.tp-ring .tp-share{background:color-mix(in srgb,var(--tx) 10%,transparent);color:var(--tx);top:14px}
.tp-ring .tp-av{width:132px;height:132px;margin:0 auto;display:grid;place-items:center}
.tp-ring .tp-halo{position:absolute;inset:0;border-radius:50%;background:conic-gradient(from 0deg,var(--p),var(--s),var(--p));animation:tp-spin 9s linear infinite;-webkit-mask:radial-gradient(farthest-side,transparent calc(100% - 5px),#000 calc(100% - 4px));mask:radial-gradient(farthest-side,transparent calc(100% - 5px),#000 calc(100% - 4px))}
.tp-ring .avatar{width:116px;height:116px;border-width:5px}
.tp-ring .tp-pills .tp-a{display:inline-flex;align-items:center;justify-content:center;width:auto;height:46px;padding:0 16px;border-radius:999px;gap:7px;font-size:18px}
.tp-ring .tp-pills .tp-a span{font-size:13px;font-weight:600}
.tp-ring .tp-acts{flex-wrap:wrap;gap:9px}
.tp-ring .tp-cta{background:linear-gradient(110deg,var(--p),var(--s));color:var(--onp)}
.tp-four .tp-grid{grid-template-columns:repeat(4,minmax(0,1fr));gap:18px 4px}
.tp-four .tp-lc{width:54px;height:54px;font-size:24px}
.tp-four .tp-ln{font-size:10.5px}
.tp-ring .tp-sheet{background:transparent;border:0;box-shadow:none}

/* ---------------- sxtapfull: tall cover, one big sheet */
.tp-full{padding-bottom:30px}
.tp-full .tp-hero{position:relative}
.tp-full .tp-cover{height:340px;margin:0;border-radius:0 0 34px 34px}
.tp-full .tp-over{position:relative;z-index:3;margin:-70px 12px 0;padding:10px 14px 26px;border-radius:32px;background:var(--card);border:1px solid var(--line);box-shadow:0 30px 60px -36px rgba(0,0,0,.5)}
.tp-full .tp-av{margin-top:-62px}
.tp-full .tp-grab{margin-bottom:0}
.tp-full .tp-st{margin-top:26px}
.tp-full .tp-cta{background:linear-gradient(110deg,var(--p),var(--s))}

/* ---------------- sxtapwallet: coloured page, floating profile card, links you swipe */
.tp-wallet{background:linear-gradient(170deg,var(--p),color-mix(in srgb,var(--p) 55%,#000));padding:22px 0 30px;min-height:100vh}
.tp-wallet .tp-card{position:relative;margin:0 16px;padding:30px 0 26px;border-radius:34px;background:var(--bg);box-shadow:0 40px 70px -34px rgba(0,0,0,.6)}
.tp-wallet .tp-card .tp-share{top:16px;background:color-mix(in srgb,var(--tx) 9%,transparent);color:var(--tx)}
.tp-wallet .tp-av{margin:0 auto}
.tp-wallet .avatar{border-color:var(--p)}
.tp-wallet .tp-cta{background:var(--p);color:var(--onp)}
.tp-wallet .tp-st.tp-onbg{margin:26px 0 14px;color:rgba(255,255,255,.8)}
.tp-wallet .tp-scroll{display:flex;gap:18px;overflow-x:auto;padding:4px 22px 14px;scroll-snap-type:x mandatory;scrollbar-width:none}
.tp-wallet .tp-scroll::-webkit-scrollbar{display:none}
.tp-wallet .tp-l{flex:0 0 74px;scroll-snap-align:start}
.tp-wallet .tp-ln{color:rgba(255,255,255,.85)}
.tp-wallet .tp-n .tp-lc{background:rgba(255,255,255,.18);color:#fff}
.tp-wallet .tp-rest{margin:10px 16px 0;border-radius:30px;background:var(--bg);padding-bottom:22px}
.tp-wallet .tp-rest:empty{display:none}

/* ---------------- sxtaplist: every link is a row */
.tp-list .tp-rows{display:grid;gap:10px}
.tp-list .tp-r{display:flex;align-items:center;gap:14px;padding:10px 14px 10px 10px;border-radius:999px;background:var(--bg);border:1px solid var(--line);color:var(--tx);animation:tp-pop .55s calc(var(--i)*55ms + .1s) var(--ease) both;transition:transform .25s var(--ease),border-color .25s}
.tp-list .tp-r:hover{transform:translateX(3px);border-color:color-mix(in srgb,var(--p) 50%,transparent)}
.tp-list .tp-r .tp-lc{width:46px;height:46px;font-size:22px;box-shadow:none}
.tp-list .tp-r .tp-ln{flex:1;font-size:15px;font-weight:600;color:var(--tx)}
.tp-list .tp-go{font-size:22px;color:var(--muted)}
.tp-list .tp-n .tp-lc{background:color-mix(in srgb,var(--p) 14%,var(--bg));color:var(--p)}
.tp-list .tp-st{text-align:start;margin-inline:6px}

/* ---------------- sxtapgrad: curved gradient cover, squircle portrait, app icons */
.tp-grad .tp-cover{height:190px;margin:0;border-radius:0 0 50% 50%/0 0 34px 34px;background:radial-gradient(70% 90% at 20% 0%,color-mix(in srgb,var(--s) 85%,#fff),transparent 70%),linear-gradient(135deg,var(--p),var(--s))}
.tp-grad .tp-cover.tp-img{background-size:cover;background-position:center}
.tp-grad .tp-av{margin-top:-56px}
.tp-grad .avatar{border-radius:30px}
.tp-grad .tp-a{border-radius:18px}
.tp-grad .tp-cta{background:linear-gradient(110deg,var(--p),var(--s));color:var(--onp)}
.tp-squares .tp-lc{border-radius:20px}
.tp-squares .tp-grab{display:none}

/* ---------------- sxtapsplit: compact */
.tp-split .tp-row{display:flex;align-items:center;gap:14px;padding:22px 20px 0}
.tp-split .tp-av{flex:none;width:84px;height:84px;margin:0}
.tp-split .avatar{width:84px;height:84px;border-width:3px}
.tp-split .tp-id{min-width:0;flex:1}
.tp-split .name{justify-content:flex-start;margin:0;font-size:20px;text-align:start}
.tp-split .role{margin:3px 0 0;text-align:start}
.tp-split .tp-co{margin:3px 0 0;font-size:12px;color:var(--p);font-weight:600}
.tp-split .tp-share{position:static;flex:none;background:color-mix(in srgb,var(--tx) 8%,transparent);color:var(--tx)}
.tp-split .tp-acts{justify-content:space-between;margin:18px 20px 0}
.tp-split .tp-a{flex:1;width:auto;height:48px;border-radius:16px}
.tp-split .tp-cta{border-radius:16px;height:50px}
.tp-split .tp-sheet{background:transparent;border:0;box-shadow:none;padding-top:0}
.tp-split .tp-grab{display:none}
.tp-split .tp-st{text-align:start;margin-inline:4px}

/* ---------------- sxtapbold: name over the cover, outlined icons, sticky connect bar */
.tp-bold{padding-bottom:104px}
.tp-bold .tp-cover{height:260px;border-radius:28px;background:linear-gradient(150deg,var(--p),color-mix(in srgb,var(--p) 40%,#000))}
.tp-bold .tp-cover:after{content:"";position:absolute;inset:0;background:linear-gradient(transparent 35%,rgba(0,0,0,.72))}
.tp-bold .tp-ov{position:absolute;z-index:1;inset-inline:20px;bottom:20px;color:#fff}
.tp-bold .tp-co{display:inline-block;margin-bottom:8px;padding:4px 11px;border-radius:999px;background:var(--s);color:#111;font-size:11px;font-weight:800;letter-spacing:.04em;text-transform:uppercase}
.tp-bold .name{justify-content:flex-start;margin:0;color:#fff;font-size:34px;font-weight:800;letter-spacing:-.04em;line-height:1;text-align:start}
.tp-bold .name i{color:var(--s)}
.tp-bold .role{margin:8px 0 0;color:rgba(255,255,255,.85);text-align:start;font-size:14px}
.tp-bold .tp-av{position:absolute;inset-inline-end:34px;top:174px;width:84px;height:84px;margin:0}
.tp-bold .avatar{width:84px;height:84px;border-width:4px;border-color:var(--bg)}
.tp-bold .tp-head{position:relative}
.tp-bold .tp-acts{margin-top:20px}
.tp-bold .tp-a{background:transparent;border:2px solid var(--p);color:var(--p);box-shadow:none}
.tp-bold .tp-a:hover{background:var(--p);color:var(--onp)}
.tp-line .tp-lc{background:transparent;color:var(--ic,var(--p));border:2.5px solid var(--ic,var(--p));box-shadow:none}
.tp-line [data-k=instagram] .tp-lc{background:transparent;border-color:#d6249f;color:#d6249f}
.tp-line .tp-n .tp-lc{border-color:var(--p);color:var(--p)}
.tp-line{background:transparent;border:0;box-shadow:none}
.tp-line .tp-grab{display:none}
.tp-dock{position:fixed;z-index:40;left:0;right:0;bottom:0;padding:14px 16px calc(14px + env(safe-area-inset-bottom));background:linear-gradient(transparent,color-mix(in srgb,var(--bg) 92%,transparent) 40%)}
.tp-dock .tp-cta{margin:0 auto;max-width:440px;height:56px;background:var(--p);color:var(--onp);font-weight:700;letter-spacing:.01em;box-shadow:0 18px 36px -14px var(--p)}

/* ---------------- sxtapsoft: pastel */
.tp-soft{background:linear-gradient(180deg,color-mix(in srgb,var(--s) 28%,var(--bg)),var(--bg) 360px)}
.tp-soft .tp-head{position:relative;padding-top:48px;overflow:hidden}
.tp-soft .tp-dots{position:absolute;inset:0 0 auto;height:230px;background-image:radial-gradient(color-mix(in srgb,var(--p) 22%,transparent) 2px,transparent 2.5px);background-size:22px 22px;-webkit-mask:linear-gradient(#000,transparent);mask:linear-gradient(#000,transparent)}
.tp-soft .tp-share{background:color-mix(in srgb,var(--p) 14%,transparent);color:var(--p);top:14px}
.tp-soft .tp-av{margin:0 auto;width:118px;height:118px}
.tp-soft .avatar{width:118px;height:118px;border-radius:38px;border:5px solid #fff}
.tp-soft .tp-a{border-radius:20px;background:#fff;border-color:transparent;color:var(--p);box-shadow:0 14px 26px -18px var(--p)}
.tp-soft .tp-a:hover{background:var(--p);color:var(--onp)}
.tp-soft .tp-cta{background:linear-gradient(110deg,var(--p),color-mix(in srgb,var(--p) 55%,var(--s)));box-shadow:0 20px 34px -18px var(--p)}
.tp-pastel{border-radius:34px;background:#fff;border-color:transparent}
.tp-pastel .tp-lc{background:color-mix(in srgb,var(--ic,var(--p)) 16%,#fff);color:var(--ic,var(--p));box-shadow:none}
.tp-pastel [data-k=instagram] .tp-lc{background:#fde7f3;color:#d6249f}
.tp-pastel [data-k=snapchat] .tp-lc{color:#d6c800;background:#fffde0}
.tp-pastel .tp-n .tp-lc{background:color-mix(in srgb,var(--p) 14%,#fff)}

@media(prefers-reduced-motion:reduce){.tp *{animation:none!important}}
@media(min-width:520px){.tp-full .tp-cover{height:380px}}
`;

module.exports = { designs, CSS };
