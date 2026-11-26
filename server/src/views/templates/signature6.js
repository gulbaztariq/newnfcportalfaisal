/*
 * Signature designs, pack 6: five "link profile" pages inspired by the modern link-in-bio screens but built for a business card.
 * Every design reads the real card through the kit (see signature.js): nothing is hard-coded, a field that is empty leaves no gap,
 * and the save / QR / map / enquiry / hours sections come from the shared blocks so VCF, NFC and subscription logic stay as they are.
 *
 *   pxcreator    Minimalist Creator: centred, colourful and calm. Round portrait, bio, social row, one featured link and pill buttons
 *   pxexecutive  Luxury Executive: charcoal and gold, serif name, framed portrait, premium contact tiles and list links
 *   pxbusiness   Modern Business: clean SaaS look. Header band, company tile, contact grid, location card, business links
 *   pxportfolio  Creative Portfolio: editorial. Huge name, offset portrait, project cards, the gallery up front, contact call-out
 *   pxsocial     Modern Social Profile: vibrant gradient, large network buttons, glass link cards, video block right after the bio
 */
const icon = (l) => (/^ri-[a-z0-9-]+$/.test(l.icon || '') ? l.icon : 'ri-links-line');

/** pieces every design uses */
function parts(k) {
  const { v, L, esc, url } = k;
  const links = k.sec.links ? (v.custom_links || []).filter((l) => l && l.url) : [];
  const socials = k.sec.social ? k.socials : [];
  const website = k.socials.find(([key, u]) => key === 'website' && /^(https?:)?\/\//i.test(String(u).trim()) || key === 'website' && /^[\w-]+(\.[\w-]+)+/.test(String(u).trim()));
  const featured = links.find((l) => l.featured) || null;
  const others = links.filter((l) => l !== featured);
  const cover = v.cover_image ? url(v.cover_image) : '';
  const bio = String(v.description || '').trim();
  const rest = k.sections(k.order.filter((x) => x !== 'social' && x !== 'links'));
  const act = (name) => k.acts.find((a) => a.icon.includes(name));
  const linkBtn = (l, cls, i = 0) => `<a class="${cls}" href="${url(l.url)}" target="_blank" rel="noopener" style="--i:${i}"><i class="${icon(l)}" aria-hidden="true"></i><span class="px-lt"><b>${esc(l.label || 'Link')}</b>${l.desc ? `<small>${esc(l.desc)}</small>` : ''}</span>${l.badge ? `<em class="px-badge">${esc(l.badge)}</em>` : ''}<i class="ri-arrow-right-up-line px-go" aria-hidden="true"></i></a>`;
  const save = (cls, label) => k.save(cls, `<i class="ri-user-add-fill" aria-hidden="true"></i><span>${esc(label || L.save)}</span>`);
  const hours = k.hoursText ? `<span class="px-chip"><i class="ri-time-line" aria-hidden="true"></i>${esc(k.hoursText)}</span>` : '';
  const where = v.location ? `<span class="px-chip"><i class="ri-map-pin-2-line" aria-hidden="true"></i>${esc(v.location)}</span>` : '';
  const company = v.company ? `<span class="px-chip"><i class="ri-building-line" aria-hidden="true"></i>${esc(v.company)}</span>` : '';
  const chips = (...xs) => { const h = xs.filter(Boolean).join(''); return h ? `<div class="px-chips">${h}</div>` : ''; };
  return { links, socials, website, featured, others, cover, bio, rest, act, linkBtn, save, hours, where, company, chips };
}

const designs = {
  /* ---------------------------------------------------------------- 1 Minimalist Creator */
  pxcreator: (k) => {
    const p = parts(k); const { esc, v } = k;
    const row = p.socials.length ? `<div class="px-socs x-socs">${k.socialLinks('px-soc')}</div>` : '';
    const feat = p.featured ? `<a class="px-feat" href="${k.url(p.featured.url)}" target="_blank" rel="noopener"><span class="px-feat-ic"><i class="${icon(p.featured)}" aria-hidden="true"></i></span><span class="px-lt"><b>${esc(p.featured.label || 'Featured')}</b>${p.featured.desc ? `<small>${esc(p.featured.desc)}</small>` : ''}</span>${p.featured.badge ? `<em class="px-badge">${esc(p.featured.badge)}</em>` : ''}<i class="ri-arrow-right-line px-go" aria-hidden="true"></i></a>` : '';
    return { main: `<div class="px px-creator">
  <header class="px-head">
    <div class="px-ring">${k.avatar()}</div>
    <h1 class="name">${esc(k.fullName)}${k.verified}</h1>${k.roleP}
    ${p.bio ? `<p class="px-bio">${esc(p.bio.length > 220 ? `${p.bio.slice(0, 217)}...` : p.bio)}</p>` : ''}
    ${p.chips(p.company, p.where, p.hours)}
  </header>
  ${row}
  ${feat}
  ${p.others.length ? `<nav class="px-stack" aria-label="Links">${p.others.map((l, i) => p.linkBtn(l, 'px-pill', i)).join('')}</nav>` : ''}
  <div class="px-cta">${p.save('px-btn', k.L.save)}${k.share('px-ghost', '<i class="ri-share-forward-line" aria-hidden="true"></i>')}</div>
  ${k.install}
  ${p.rest}
</div>` };
  },

  /* ---------------------------------------------------------------- 2 Luxury Executive */
  pxexecutive: (k) => {
    const p = parts(k); const { esc, v, L } = k;
    const tiles = [
      p.act('phone') && { a: p.act('phone'), t: L.call },
      p.act('whatsapp') && { a: p.act('whatsapp'), t: L.whatsapp },
      p.act('mail') && { a: p.act('mail'), t: L.email },
      p.website && { a: { href: k.url(p.website[1]), icon: 'ri-global-line', label: 'Website', sub: String(p.website[1]).replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, ''), ext: true }, t: 'Website' },
    ].filter(Boolean);
    const socs = p.socials.filter(([key]) => key !== 'website');
    return { main: `<div class="px px-exec">
  <header class="px-head"${p.cover ? ` style="--cv:url('${p.cover}')"` : ''}>
    ${k.share('px-share', '<i class="ri-share-forward-line" aria-hidden="true"></i>')}
    <div class="px-frame">${k.avatar()}</div>
    <div class="px-id"><h1 class="name">${esc(k.fullName)}${k.verified}</h1>${k.roleP}${v.company ? `<p class="px-co">${esc(v.company)}</p>` : ''}</div>
  </header>
  <i class="px-rule" aria-hidden="true"></i>
  ${p.bio ? `<p class="px-bio">${esc(p.bio.length > 260 ? `${p.bio.slice(0, 257)}...` : p.bio)}</p>` : ''}
  ${tiles.length ? `<nav class="px-tiles x-actions" aria-label="Contact">${tiles.map(({ a, t }) => k.A(a, 'px-tile', `<i class="${a.icon}" aria-hidden="true"></i><span><b>${esc(t)}</b>${a.sub ? `<small>${esc(String(a.sub).slice(0, 34))}</small>` : ''}</span>`)).join('')}</nav>` : ''}
  ${p.save('px-gold', L.save)}
  ${k.install}
  ${socs.length ? `<div class="px-socs x-socs">${socs.map(([key, u], i) => `<a class="px-soc" href="${k.url(u)}" target="_blank" rel="noopener" aria-label="${esc(k.SOCIAL[key][1])}" title="${esc(k.SOCIAL[key][1])}" style="--i:${i}"><i class="${k.SOCIAL[key][0]}" aria-hidden="true"></i></a>`).join('')}</div>` : ''}
  ${p.links.length ? `<nav class="px-list" aria-label="Links">${p.links.map((l, i) => p.linkBtn(l, 'px-row', i)).join('')}</nav>` : ''}
  ${p.rest}
</div>` };
  },

  /* ---------------------------------------------------------------- 3 Modern Business */
  pxbusiness: (k) => {
    const p = parts(k); const { esc, v, L } = k;
    const mono = esc((v.company || k.fullName).trim().slice(0, 1).toUpperCase());
    const wa = p.act('whatsapp'); const call = p.act('phone'); const mail = p.act('mail'); const map = p.act('map');
    const tile = (a, label, ic) => (a ? k.A(a, 'px-ct', `<span class="px-ci"><i class="${ic}" aria-hidden="true"></i></span><span class="px-ctx"><b>${esc(label)}</b>${a.sub ? `<small>${esc(String(a.sub).slice(0, 38))}</small>` : ''}</span>`) : '');
    const web = p.website ? k.A({ href: k.url(p.website[1]), label: 'Website', ext: true }, 'px-ct', `<span class="px-ci"><i class="ri-global-line" aria-hidden="true"></i></span><span class="px-ctx"><b>Website</b><small>${esc(String(p.website[1]).replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '').slice(0, 38))}</small></span>`) : '';
    const grid = [tile(call, L.call, 'ri-phone-line'), tile(mail, L.email, 'ri-mail-line'), web].filter(Boolean).join('');
    return { main: `<div class="px px-biz">
  <header class="px-head">
    <div class="px-band${p.cover ? ' px-img' : ''}"${p.cover ? ` style="background-image:url('${p.cover}')"` : ''}>${k.share('px-share', '<i class="ri-share-forward-line" aria-hidden="true"></i>')}</div>
    <div class="px-av">${k.avatar()}</div>
    <h1 class="name">${esc(k.fullName)}${k.verified}</h1>${k.roleP}
    ${v.company ? `<p class="px-company"><span class="px-mono" aria-hidden="true">${mono}</span>${esc(v.company)}</p>` : ''}
    ${p.chips(p.where, p.hours)}
  </header>
  <div class="px-ctas">${p.save('px-primary', L.save)}${wa ? k.A(wa, 'px-wa', `<i class="ri-whatsapp-line" aria-hidden="true"></i><span>${esc(L.whatsapp)}</span>`) : ''}</div>
  ${k.install}
  ${p.bio ? `<p class="px-bio">${esc(p.bio.length > 240 ? `${p.bio.slice(0, 237)}...` : p.bio)}</p>` : ''}
  ${grid ? `<nav class="px-grid x-actions" aria-label="Contact">${grid}</nav>` : ''}
  ${map || v.location ? `<div class="px-loc"><i class="ri-map-pin-2-fill" aria-hidden="true"></i><span><b>${esc(v.location || L.directions)}</b><small>${esc(L.directions)}</small></span>${map ? k.A(map, 'px-dir', `<span>${esc(L.directions)}</span><i class="ri-navigation-line" aria-hidden="true"></i>`) : ''}</div>` : ''}
  ${p.links.length ? `<nav class="px-links" aria-label="Links">${p.links.map((l, i) => p.linkBtn(l, 'px-lk', i)).join('')}</nav>` : ''}
  ${p.socials.length ? `<div class="px-socs x-socs">${k.socialLinks('px-soc')}</div>` : ''}
  ${p.rest}
</div>` };
  },

  /* ---------------------------------------------------------------- 4 Creative Portfolio */
  pxportfolio: (k) => {
    const p = parts(k); const { esc, v, L } = k;
    const cards = p.links.map((l, i) => `<a class="px-proj" href="${k.url(l.url)}" target="_blank" rel="noopener" style="--i:${i}"><span class="px-pn">${String(i + 1).padStart(2, '0')}</span><span class="px-pt"><b>${esc(l.label || 'Project')}</b>${l.desc ? `<small>${esc(l.desc)}</small>` : ''}</span>${l.badge ? `<em class="px-badge">${esc(l.badge)}</em>` : ''}<i class="ri-arrow-right-up-line px-go" aria-hidden="true"></i></a>`).join('');
    const gallery = k.sec.gallery ? k.sections(['gallery']) : '';
    const embeds = k.sec.embeds ? k.sections(['embeds']) : '';
    const rest = k.sections(k.order.filter((x) => !['social', 'links', 'gallery', 'embeds'].includes(x)));
    const mail = p.act('mail'); const wa = p.act('whatsapp'); const call = p.act('phone');
    return { main: `<div class="px px-folio">
  <header class="px-head">
    <div class="px-ph"><div class="px-pic">${k.avatar()}</div></div>
    <div class="px-tx">
      ${k.share('px-share', '<i class="ri-share-forward-line" aria-hidden="true"></i>')}
      ${k.roleP}
      <h1 class="name">${k.stacked}${k.verified}</h1>
      ${p.bio ? `<p class="px-bio">${esc(p.bio.length > 200 ? `${p.bio.slice(0, 197)}...` : p.bio)}</p>` : ''}
      ${p.chips(p.company, p.where, p.hours)}
    </div>
  </header>
  ${cards ? `<section class="px-sec"><h2 class="px-h">Featured work</h2><nav class="px-projs" aria-label="Projects">${cards}</nav></section>` : ''}
  ${gallery}
  ${embeds}
  ${p.socials.length ? `<section class="px-sec"><h2 class="px-h">Elsewhere</h2><div class="px-soclist x-socs">${p.socials.map(([key, u], i) => `<a href="${k.url(u)}" target="_blank" rel="noopener" style="--i:${i}"><i class="${k.SOCIAL[key][0]}" aria-hidden="true"></i><span>${esc(k.SOCIAL[key][1])}</span><i class="ri-arrow-right-up-line" aria-hidden="true"></i></a>`).join('')}</div></section>` : ''}
  ${mail || wa || call ? `<section class="px-hire"><h2>${esc(L.contact || 'Contact')}</h2><div class="px-hire-b x-actions">${[mail, wa, call].filter(Boolean).map((a) => k.A(a, 'px-hb', `<i class="${a.icon}" aria-hidden="true"></i><span>${esc(a.label)}</span>`)).join('')}</div>${p.save('px-save', L.save)}</section>` : p.save('px-save', L.save)}
  ${k.install}
  ${rest}
</div>` };
  },

  /* ---------------------------------------------------------------- 5 Modern Social Profile */
  pxsocial: (k) => {
    const p = parts(k); const { esc, v, L } = k;
    const big = p.socials.map(([key, u], i) => `<a class="px-sb" href="${k.url(u)}" target="_blank" rel="noopener" data-k="${key}" style="--i:${i};--bc:${k.BRAND[key] || '#64748b'}"><i class="${k.SOCIAL[key][0]}" aria-hidden="true"></i><span>${esc(k.SOCIAL[key][1])}</span><i class="ri-arrow-right-s-line px-go" aria-hidden="true"></i></a>`).join('');
    const embeds = k.sec.embeds ? k.sections(['embeds']) : '';
    const rest = k.sections(k.order.filter((x) => !['social', 'links', 'embeds'].includes(x)));
    return { main: `<div class="px px-soc5">
  <i class="px-orb px-o1" aria-hidden="true"></i><i class="px-orb px-o2" aria-hidden="true"></i>
  <header class="px-head">
    ${k.share('px-share', '<i class="ri-share-forward-line" aria-hidden="true"></i>')}
    <div class="px-ring">${k.avatar()}</div>
    <h1 class="name">${esc(k.fullName)}${k.verified}</h1>${k.roleP}
    ${p.bio ? `<p class="px-bio">${esc(p.bio.length > 200 ? `${p.bio.slice(0, 197)}...` : p.bio)}</p>` : ''}
    ${p.chips(p.company, p.where)}
  </header>
  ${p.save('px-follow', L.save)}
  ${k.install}
  ${big ? `<nav class="px-bigs x-socs" aria-label="Social">${big}</nav>` : ''}
  ${embeds}
  ${p.links.length ? `<nav class="px-glass" aria-label="Links">${p.links.map((l, i) => p.linkBtn(l, `px-gl${l.featured ? ' px-star' : ''}`, i)).join('')}</nav>` : ''}
  ${rest}
</div>` };
  },
};

/** `&` stands for the layout class so the page-layout filter in render.js keeps the rules of a design only on its own pages */
const scope = (layout, css) => css.replace(/&/g, `.l-${layout}`);

const COMMON = `
& .px{position:relative;max-width:520px;margin:0 auto;padding:0 18px 12px;box-sizing:border-box}
& .px *{box-sizing:border-box}
& .px a{text-decoration:none}
& .px .px-lt{display:flex;flex-direction:column;min-width:0;gap:1px;text-align:left}
& .px .px-lt b,& .px .px-pt b{font-weight:700;overflow:hidden;text-overflow:ellipsis}
& .px .px-lt small,& .px .px-pt small{font-size:12px;opacity:.7;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
& .px .px-badge{font-style:normal;font-size:10px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;padding:3px 8px;border-radius:99px;background:var(--p);color:var(--onp)}
& .px .px-chips{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin-top:12px}
& .px .px-chip{display:inline-flex;align-items:center;gap:6px;font-size:12.5px;font-weight:600;padding:6px 12px;border-radius:99px;background:color-mix(in srgb,var(--tx) 7%,transparent);color:inherit}
& .px .sec{margin-left:0;margin-right:0}
& .px .save{margin-left:0;margin-right:0}
& .px :focus-visible{outline:3px solid color-mix(in srgb,var(--p) 70%,#fff);outline-offset:2px}
@media(prefers-reduced-motion:reduce){& .px *{animation:none!important;transition:none!important}}
`;

const CREATOR = `
& .px-creator{padding-top:34px}
& .px-creator:before{content:"";position:fixed;inset:0;z-index:-1;background:radial-gradient(60% 40% at 15% 0%,color-mix(in srgb,var(--p) 22%,transparent),transparent 70%),radial-gradient(60% 40% at 95% 12%,color-mix(in srgb,var(--s) 26%,transparent),transparent 70%),var(--bg)}
& .px-creator .px-head{text-align:center}
& .px-creator .px-ring{width:132px;height:132px;margin:0 auto;padding:4px;border-radius:50%;background:conic-gradient(from 210deg,var(--p),var(--s),var(--p));box-shadow:0 18px 40px -18px var(--p)}
& .px-creator .avatar{width:100%;height:100%;border-radius:50%;object-fit:cover;border:4px solid var(--bg)}
& .px-creator .name{margin:16px 0 2px;font-size:clamp(24px,7vw,30px);line-height:1.15;letter-spacing:-.02em}
& .px-creator .role{margin:0;font-size:14.5px;opacity:.75;font-weight:600}
& .px-creator .px-bio{margin:12px auto 0;max-width:36ch;font-size:14.5px;line-height:1.55;opacity:.82}
& .px-creator .px-socs{display:flex;flex-wrap:wrap;gap:10px;justify-content:center;margin:20px 0 6px}
& .px-creator .px-soc{width:46px;height:46px;border-radius:50%;display:grid;place-items:center;font-size:21px;background:color-mix(in srgb,var(--bc,var(--p)) 14%,var(--bg));color:var(--bc,var(--p));transition:transform .2s,background .2s,color .2s}
& .px-creator .px-soc:hover{transform:translateY(-3px);background:var(--bc,var(--p));color:#fff}
& .px-creator .px-feat{display:flex;align-items:center;gap:14px;margin-top:18px;padding:18px;border-radius:24px;color:var(--onp);background:linear-gradient(120deg,var(--p),var(--s));box-shadow:0 22px 40px -22px var(--p);transition:transform .2s}
& .px-creator .px-feat:hover{transform:translateY(-3px)}
& .px-creator .px-feat-ic{width:52px;height:52px;border-radius:16px;display:grid;place-items:center;font-size:26px;background:rgba(255,255,255,.22);flex:none}
& .px-creator .px-feat .px-lt{flex:1}
& .px-creator .px-feat .px-lt b{font-size:17px}
& .px-creator .px-feat .px-badge{background:#fff;color:var(--p)}
& .px-creator .px-stack{display:grid;gap:12px;margin-top:14px}
& .px-creator .px-pill{display:flex;align-items:center;gap:14px;min-height:58px;padding:12px 20px;border-radius:99px;background:color-mix(in srgb,var(--tx) 5%,var(--bg));border:1.5px solid color-mix(in srgb,var(--tx) 14%,transparent);color:inherit;font-size:15px;transition:transform .2s,border-color .2s,box-shadow .2s;animation:px-up .5s both;animation-delay:calc(var(--i)*60ms)}
& .px-creator .px-pill>i:first-child{font-size:20px;color:var(--p)}
& .px-creator .px-pill .px-lt{flex:1}
& .px-creator .px-pill .px-go{margin-left:auto;opacity:.45;transition:transform .2s,opacity .2s}
& .px-creator .px-pill:hover{transform:translateY(-2px);border-color:var(--p);box-shadow:0 14px 28px -18px var(--p)}
& .px-creator .px-pill:hover .px-go{opacity:1;transform:translate(2px,-2px)}
& .px-creator .px-cta{display:flex;gap:10px;margin:22px 0 4px}
& .px-creator .px-btn{margin:0;flex:1;display:flex;align-items:center;justify-content:center;gap:8px;height:54px;border-radius:99px;font-weight:700;font-size:15px;background:var(--tx);color:var(--bg);transition:transform .2s}
& .px-creator .px-btn:hover{transform:translateY(-2px)}
& .px-creator .px-ghost{width:54px;height:54px;border-radius:50%;display:grid;place-items:center;font-size:22px;border:1.5px solid color-mix(in srgb,var(--tx) 18%,transparent);background:transparent;color:inherit;cursor:pointer}
@keyframes px-up{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
`;

const EXEC = `
& .px-exec{padding-top:0;max-width:540px}
& .px-exec:before{content:"";position:fixed;inset:0;z-index:-1;background:radial-gradient(80% 50% at 50% 0%,color-mix(in srgb,var(--p) 14%,transparent),transparent 70%),var(--bg)}
& .px-exec .px-head{position:relative;display:flex;align-items:flex-end;gap:18px;padding:64px 4px 22px;background:linear-gradient(180deg,transparent,color-mix(in srgb,var(--bg) 100%,transparent) 96%),var(--cv,none) center/cover no-repeat;margin:0 -18px;padding-left:22px;padding-right:22px}
& .px-exec .px-share{position:absolute;top:16px;right:18px;width:42px;height:42px;border-radius:50%;display:grid;place-items:center;font-size:19px;border:1px solid color-mix(in srgb,var(--p) 55%,transparent);background:rgba(0,0,0,.25);color:var(--p);cursor:pointer}
& .px-exec .px-frame{flex:none;width:112px;height:128px;padding:4px;border:1.5px solid var(--p);border-radius:6px;background:var(--bg);box-shadow:0 20px 40px -20px #000}
& .px-exec .avatar{width:100%;height:100%;border-radius:3px;object-fit:cover;background:linear-gradient(145deg,color-mix(in srgb,var(--p) 55%,var(--bg)),color-mix(in srgb,var(--p) 18%,var(--bg)))}
& .px-exec .px-id{min-width:0;padding-bottom:4px}
& .px-exec .name{margin:0;font-size:clamp(26px,7.5vw,34px);line-height:1.1;font-weight:600;letter-spacing:.01em}
& .px-exec .role{margin:6px 0 0;font-size:12px;letter-spacing:.2em;text-transform:uppercase;color:var(--p);font-weight:600}
& .px-exec .px-co{margin:6px 0 0;font-size:14px;opacity:.75}
& .px-exec .px-rule{display:block;height:1px;margin:2px 0 18px;background:linear-gradient(90deg,transparent,var(--p),transparent)}
& .px-exec .px-bio{margin:0 0 18px;font-size:14.5px;line-height:1.65;opacity:.8;text-align:center}
& .px-exec .px-tiles{display:grid;grid-template-columns:1fr 1fr;gap:10px}
& .px-exec .px-tile{display:flex;align-items:center;gap:12px;padding:14px;border-radius:10px;color:inherit;background:linear-gradient(145deg,color-mix(in srgb,var(--tx) 7%,var(--bg)),color-mix(in srgb,var(--tx) 2%,var(--bg)));border:1px solid color-mix(in srgb,var(--p) 28%,transparent);transition:transform .2s,border-color .2s,box-shadow .2s}
& .px-exec .px-tile:hover{transform:translateY(-2px);border-color:var(--p);box-shadow:0 16px 30px -20px var(--p)}
& .px-exec .px-tile>i{font-size:22px;color:var(--p);flex:none}
& .px-exec .px-tile span{display:flex;flex-direction:column;min-width:0}
& .px-exec .px-tile b{font-size:14px;font-weight:600}
& .px-exec .px-tile small{font-size:11.5px;opacity:.65;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
& .px-exec .px-gold{margin:12px 0 0;display:flex;align-items:center;justify-content:center;gap:10px;margin-top:12px;height:56px;border-radius:10px;font-weight:700;font-size:15px;letter-spacing:.08em;text-transform:uppercase;color:#17130a;background:linear-gradient(135deg,#e8cf8b,var(--p) 45%,#9a7a2c);box-shadow:0 18px 36px -18px var(--p);transition:transform .2s}
& .px-exec .px-gold:hover{transform:translateY(-2px)}
& .px-exec .px-socs{display:flex;flex-wrap:wrap;gap:10px;justify-content:center;margin:20px 0 4px}
& .px-exec .px-soc{width:44px;height:44px;border-radius:8px;display:grid;place-items:center;font-size:20px;color:var(--p);border:1px solid color-mix(in srgb,var(--p) 40%,transparent);transition:background .2s,color .2s}
& .px-exec .px-soc:hover{background:var(--p);color:#17130a}
& .px-exec .px-list{display:grid;gap:10px;margin-top:16px}
& .px-exec .px-row{display:flex;align-items:center;gap:14px;padding:16px;border-radius:10px;color:inherit;background:color-mix(in srgb,var(--tx) 4%,var(--bg));border:1px solid color-mix(in srgb,var(--tx) 10%,transparent);transition:border-color .2s,transform .2s;animation:px-up .5s both;animation-delay:calc(var(--i)*60ms)}
& .px-exec .px-row>i:first-child{font-size:20px;color:var(--p)}
& .px-exec .px-row .px-lt{flex:1}
& .px-exec .px-row .px-go{color:var(--p);transition:transform .2s}
& .px-exec .px-row:hover{border-color:var(--p);transform:translateX(3px)}
& .px-exec .px-row:hover .px-go{transform:translate(3px,-3px)}
& .px-exec .px-badge{background:var(--p);color:#17130a}
`;

const BIZ = `
& .px-biz{padding-top:0;max-width:560px}
& .px-biz .px-head{text-align:center;margin:0 -18px}
& .px-biz .px-band{position:relative;height:150px;background:linear-gradient(120deg,var(--p),var(--s));border-radius:0 0 34px 34px}
& .px-biz .px-band.px-img{background-size:cover;background-position:center}
& .px-biz .px-band.px-img:after{content:"";position:absolute;inset:0;border-radius:inherit;background:linear-gradient(180deg,transparent 40%,rgba(0,0,0,.28))}
& .px-biz .px-share{position:absolute;z-index:2;top:14px;right:16px;width:40px;height:40px;border-radius:50%;display:grid;place-items:center;font-size:18px;border:0;background:rgba(255,255,255,.9);color:var(--p);cursor:pointer}
& .px-biz .px-av{position:relative;z-index:1;width:112px;height:112px;margin:-56px auto 0}
& .px-biz .avatar{width:100%;height:100%;border-radius:30px;object-fit:cover;border:5px solid var(--bg);box-shadow:0 18px 36px -18px rgba(15,23,42,.45)}
& .px-biz .name{margin:14px 18px 0;font-size:clamp(23px,6.5vw,28px);line-height:1.15;letter-spacing:-.02em}
& .px-biz .role{margin:4px 18px 0;font-size:14.5px;font-weight:600;color:var(--p)}
& .px-biz .px-company{display:inline-flex;align-items:center;gap:8px;margin:10px 0 0;font-size:14px;font-weight:600;opacity:.85}
& .px-biz .px-mono{width:26px;height:26px;border-radius:8px;display:grid;place-items:center;font-size:13px;font-weight:800;background:var(--p);color:var(--onp)}
& .px-biz .px-ctas{display:grid;grid-template-columns:1.4fr 1fr;gap:10px;margin-top:20px}
& .px-biz .px-primary,& .px-biz .px-wa{margin:0;display:flex;align-items:center;justify-content:center;gap:8px;height:52px;border-radius:16px;font-weight:700;font-size:14.5px;transition:transform .2s,box-shadow .2s}
& .px-biz .px-primary{background:var(--p);color:var(--onp);box-shadow:0 16px 30px -16px var(--p)}
& .px-biz .px-wa{background:#25d366;color:#fff;box-shadow:0 16px 30px -18px #25d366}
& .px-biz .px-primary:hover,& .px-biz .px-wa:hover{transform:translateY(-2px)}
& .px-biz .px-primary:only-child{grid-column:1/-1}
& .px-biz .px-bio{margin:18px 2px 0;font-size:14.5px;line-height:1.6;opacity:.8;text-align:center}
& .px-biz .px-grid{display:grid;grid-template-columns:1fr;gap:10px;margin-top:18px}
@media(min-width:420px){& .px-biz .px-grid{grid-template-columns:1fr 1fr}}
& .px-biz .px-ct{display:flex;align-items:center;gap:12px;padding:14px;border-radius:18px;color:inherit;background:var(--bg);border:1px solid color-mix(in srgb,var(--tx) 10%,transparent);box-shadow:0 10px 24px -20px rgba(15,23,42,.5);transition:transform .2s,border-color .2s}
& .px-biz .px-ct:hover{transform:translateY(-2px);border-color:var(--p)}
& .px-biz .px-ci{width:42px;height:42px;border-radius:13px;display:grid;place-items:center;font-size:20px;flex:none;background:color-mix(in srgb,var(--p) 12%,var(--bg));color:var(--p)}
& .px-biz .px-ctx{display:flex;flex-direction:column;min-width:0}
& .px-biz .px-ctx b{font-size:14px}
& .px-biz .px-ctx small{font-size:12px;opacity:.65;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
& .px-biz .px-loc{display:flex;align-items:center;gap:12px;margin-top:10px;padding:14px;border-radius:18px;background:color-mix(in srgb,var(--p) 8%,var(--bg));border:1px solid color-mix(in srgb,var(--p) 18%,transparent)}
& .px-biz .px-loc>i{font-size:24px;color:var(--p);flex:none}
& .px-biz .px-loc>span{display:flex;flex-direction:column;min-width:0;flex:1}
& .px-biz .px-loc b{font-size:14px;overflow:hidden;text-overflow:ellipsis}
& .px-biz .px-loc small{font-size:12px;opacity:.65}
& .px-biz .px-loc>span small{display:none}
& .px-biz .px-dir{display:inline-flex;align-items:center;gap:6px;padding:10px 14px;border-radius:12px;font-size:13px;font-weight:700;background:var(--p);color:var(--onp);flex:none}
& .px-biz .px-links{display:grid;gap:10px;margin-top:18px}
& .px-biz .px-lk{display:flex;align-items:center;gap:14px;padding:16px;border-radius:18px;color:inherit;background:var(--bg);border:1px solid color-mix(in srgb,var(--tx) 10%,transparent);transition:transform .2s,border-color .2s,box-shadow .2s;animation:px-up .5s both;animation-delay:calc(var(--i)*60ms)}
& .px-biz .px-lk>i:first-child{width:40px;height:40px;border-radius:12px;display:grid;place-items:center;font-size:19px;background:color-mix(in srgb,var(--s) 14%,var(--bg));color:var(--p);flex:none}
& .px-biz .px-lk .px-lt{flex:1}
& .px-biz .px-lk .px-go{opacity:.4;transition:transform .2s}
& .px-biz .px-lk:hover{transform:translateY(-2px);border-color:var(--p);box-shadow:0 16px 30px -22px var(--p)}
& .px-biz .px-lk:hover .px-go{opacity:1;transform:translate(2px,-2px)}
& .px-biz .px-socs{display:flex;flex-wrap:wrap;gap:10px;justify-content:center;margin:20px 0 4px}
& .px-biz .px-soc{width:44px;height:44px;border-radius:14px;display:grid;place-items:center;font-size:20px;background:color-mix(in srgb,var(--bc,var(--p)) 12%,var(--bg));color:var(--bc,var(--p));transition:transform .2s}
& .px-biz .px-soc:hover{transform:translateY(-3px)}
`;

const FOLIO = `
& .px-folio{padding-top:28px;max-width:600px}
& .px-folio .px-head{display:grid;grid-template-columns:132px 1fr;gap:18px;align-items:end}
@media(max-width:360px){& .px-folio .px-head{grid-template-columns:1fr}}
& .px-folio .px-ph{position:relative;padding:0 10px 10px 0}
& .px-folio .px-ph:after{content:"";position:absolute;inset:12px 0 0 12px;z-index:0;border:2px solid var(--p);border-radius:6px}
& .px-folio .px-pic{position:relative;z-index:1;aspect-ratio:3/4;overflow:hidden;border-radius:6px;background:var(--s)}
& .px-folio .avatar{width:100%;height:100%;object-fit:cover;border-radius:0}
& .px-folio .role{margin:0 0 6px;font-size:11.5px;letter-spacing:.22em;text-transform:uppercase;color:var(--p);font-weight:700}
& .px-folio .name{margin:0;font-size:clamp(34px,10vw,52px);line-height:.95;letter-spacing:-.035em;font-weight:800}
& .px-folio .px-bio{margin:12px 0 0;font-size:14.5px;line-height:1.55;opacity:.8}
& .px-folio .px-chips{justify-content:flex-start}
& .px-folio .px-share{float:right;width:40px;height:40px;border-radius:50%;display:grid;place-items:center;font-size:18px;border:1.5px solid color-mix(in srgb,var(--tx) 25%,transparent);background:transparent;color:inherit;cursor:pointer;margin:0 0 6px 8px}
& .px-folio .px-sec{margin-top:34px}
& .px-folio .px-h{margin:0 0 12px;font-size:12px;letter-spacing:.24em;text-transform:uppercase;font-weight:700;opacity:.55}
& .px-folio .px-projs{display:grid;gap:12px}
& .px-folio .px-proj{position:relative;display:flex;align-items:center;gap:16px;min-height:96px;padding:18px;border-radius:6px;color:#fff;overflow:hidden;background:linear-gradient(135deg,hsl(calc(var(--i)*47 + 8) 78% 46%),hsl(calc(var(--i)*47 + 48) 82% 36%));transition:transform .25s,box-shadow .25s;animation:px-up .55s both;animation-delay:calc(var(--i)*70ms)}
& .px-folio .px-proj:nth-child(3n+1){min-height:130px}
& .px-folio .px-proj:hover{transform:translateY(-3px) rotate(-.4deg);box-shadow:0 22px 40px -22px #000}
& .px-folio .px-pn{font-size:30px;font-weight:800;opacity:.45;letter-spacing:-.04em;flex:none}
& .px-folio .px-pt{display:flex;flex-direction:column;min-width:0;flex:1}
& .px-folio .px-pt b{font-size:18px;line-height:1.2}
& .px-folio .px-go{font-size:22px;flex:none;transition:transform .2s}
& .px-folio .px-proj:hover .px-go{transform:translate(3px,-3px)}
& .px-folio .px-badge{background:#fff;color:#111}
& .px-folio .px-soclist{display:grid}
& .px-folio .px-soclist a{display:flex;align-items:center;gap:12px;padding:15px 2px;color:inherit;border-bottom:1px solid color-mix(in srgb,var(--tx) 14%,transparent);font-weight:700;font-size:16px;transition:padding .2s,color .2s}
& .px-folio .px-soclist a span{flex:1}
& .px-folio .px-soclist a>i:first-child{font-size:20px;color:var(--p)}
& .px-folio .px-soclist a>i:last-child{opacity:.4}
& .px-folio .px-soclist a:hover{padding-left:10px;color:var(--p)}
& .px-folio .px-hire{margin-top:36px;padding:26px 20px;border-radius:6px;text-align:center;color:var(--onp);background:var(--p)}
& .px-folio .px-hire h2{margin:0 0 14px;font-size:clamp(26px,8vw,38px);letter-spacing:-.03em;line-height:1}
& .px-folio .px-hire-b{display:flex;flex-wrap:wrap;gap:8px;justify-content:center}
& .px-folio .px-hb{display:inline-flex;align-items:center;gap:8px;padding:11px 16px;border-radius:99px;font-weight:700;font-size:14px;color:var(--p);background:#fff;transition:transform .2s}
& .px-folio .px-hb:hover{transform:translateY(-2px)}
& .px-folio .px-save{margin:12px 0 0;display:flex;align-items:center;justify-content:center;gap:8px;margin-top:12px;height:52px;border-radius:6px;font-weight:800;font-size:15px;background:#111;color:#fff}
`;

const SOC5 = `
& .px-soc5{padding-top:30px;max-width:500px}
& .px-soc5:before{content:"";position:fixed;inset:0;z-index:-2;background:linear-gradient(165deg,color-mix(in srgb,var(--p) 55%,var(--bg)) 0%,var(--bg) 46%,color-mix(in srgb,var(--s) 45%,var(--bg)) 100%)}
& .px-soc5 .px-orb{position:fixed;z-index:-1;border-radius:50%;filter:blur(70px);opacity:.55;pointer-events:none;animation:px-float 12s ease-in-out infinite alternate}
& .px-soc5 .px-o1{width:260px;height:260px;left:-80px;top:-60px;background:var(--p)}
& .px-soc5 .px-o2{width:300px;height:300px;right:-110px;top:340px;background:var(--s);animation-delay:-5s}
@keyframes px-float{to{transform:translate(30px,40px) scale(1.12)}}
& .px-soc5 .px-head{position:relative;text-align:center}
& .px-soc5 .px-share{position:absolute;top:0;right:0;width:42px;height:42px;border-radius:50%;display:grid;place-items:center;font-size:19px;border:0;color:inherit;background:rgba(255,255,255,.14);backdrop-filter:blur(10px);cursor:pointer}
& .px-soc5 .px-ring{width:136px;height:136px;margin:0 auto;padding:5px;border-radius:50%;background:conic-gradient(from 0deg,var(--p),var(--s),#ffd166,var(--p));animation:px-spin 8s linear infinite}
& .px-soc5 .px-ring .avatar{animation:px-spin 8s linear infinite reverse}
@keyframes px-spin{to{transform:rotate(360deg)}}
& .px-soc5 .avatar{width:100%;height:100%;border-radius:50%;object-fit:cover;border:5px solid var(--bg)}
& .px-soc5 .name{margin:16px 0 2px;font-size:clamp(25px,7.5vw,32px);line-height:1.12;letter-spacing:-.02em;font-weight:800}
& .px-soc5 .role{margin:0;font-size:14.5px;opacity:.85;font-weight:600}
& .px-soc5 .px-bio{margin:12px auto 0;max-width:36ch;font-size:14.5px;line-height:1.55;opacity:.85}
& .px-soc5 .px-follow{margin:20px 0 0;display:flex;align-items:center;justify-content:center;gap:8px;margin-top:20px;height:56px;border-radius:99px;font-weight:800;font-size:16px;color:#fff;background:linear-gradient(110deg,var(--p),var(--s));box-shadow:0 20px 38px -18px var(--p);transition:transform .2s}
& .px-soc5 .px-follow:hover{transform:translateY(-2px) scale(1.01)}
& .px-soc5 .px-bigs{display:grid;gap:10px;margin-top:18px}
& .px-soc5 .px-sb{display:flex;align-items:center;gap:14px;min-height:60px;padding:12px 18px;border-radius:20px;color:#fff;font-weight:700;font-size:15.5px;background:var(--bc);box-shadow:0 14px 28px -18px var(--bc);transition:transform .2s,filter .2s;animation:px-up .5s both;animation-delay:calc(var(--i)*55ms)}
& .px-soc5 .px-sb>i:first-child{font-size:26px}
& .px-soc5 .px-sb span{flex:1}
& .px-soc5 .px-sb[data-k=snapchat]{color:#111}
& .px-soc5 .px-sb:hover{transform:translateY(-3px);filter:brightness(1.07)}
& .px-soc5 .px-go{opacity:.7}
& .px-soc5 .px-glass{display:grid;gap:10px;margin-top:14px}
& .px-soc5 .px-gl{display:flex;align-items:center;gap:14px;padding:16px;border-radius:20px;color:inherit;background:color-mix(in srgb,var(--tx) 9%,transparent);border:1px solid color-mix(in srgb,var(--tx) 16%,transparent);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);transition:transform .2s,background .2s;animation:px-up .5s both;animation-delay:calc(var(--i)*55ms)}
& .px-soc5 .px-gl>i:first-child{font-size:22px;flex:none}
& .px-soc5 .px-gl .px-lt{flex:1}
& .px-soc5 .px-gl:hover{transform:translateY(-3px);background:color-mix(in srgb,var(--tx) 15%,transparent)}
& .px-soc5 .px-star{background:linear-gradient(120deg,color-mix(in srgb,var(--p) 55%,transparent),color-mix(in srgb,var(--s) 55%,transparent));padding:20px}
& .px-soc5 .px-badge{background:#fff;color:#111}
& .px-soc5 .s-embeds{margin-top:16px}
`;

const CSS = scope('pxcreator', COMMON + CREATOR).replace(/\.l-pxcreator \.px\b/g, '.l-pxcreator .px')
  + ['pxexecutive', 'pxbusiness', 'pxportfolio', 'pxsocial'].map((l, i) => scope(l, COMMON + [EXEC, BIZ, FOLIO, SOC5][i])).join('\n');

module.exports = { designs, CSS };
