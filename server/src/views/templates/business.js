/*
 * Business layouts (appended after social.js). Same DOM and theme tokens as the other layouts.
 * Layouts in BAR_LAYOUTS (catalog.js) also get the labelled bottom action bar (.stk-bar): Call / WhatsApp / Directions / Save.
 */
module.exports = String.raw`
/* ================================================================== labelled bottom action bar */
.stk-bar{left:0;right:0;bottom:0;transform:none;width:min(480px,100%);margin:0 auto;border-radius:0;padding:8px 10px calc(8px + env(safe-area-inset-bottom));gap:6px;border:0;border-top:1px solid var(--line);background:color-mix(in srgb,var(--bg) 92%,transparent);box-shadow:0 -12px 30px -18px rgba(0,0,0,.35);animation:pm-bar .6s .8s var(--ease,ease) both}
.stk-bar a{flex:1 1 0;width:auto;height:50px;border-radius:14px;flex-direction:column;gap:2px;display:flex;align-items:center;justify-content:center;font-size:19px;background:color-mix(in srgb,var(--tx) 9%,transparent);color:var(--tx);min-width:0}
.stk-bar a span{font-size:10.5px;font-weight:700;letter-spacing:.01em;line-height:1;color:inherit}
.stk-bar .main{background:var(--s);color:var(--ons);width:auto}
.stk-bar .wa{background:#25d366;color:#fff}
@keyframes pm-bar{from{transform:translateY(100%)}to{transform:none}}

/* ================================================================== agency: bold typographic studio, huge name, flat colour blocks */
.l-agency{--r:6px}
.l-agency .cover{height:200px;border-radius:0}
.l-agency .cover.g{background:var(--p)}
.l-agency .cover.g:before{background:repeating-linear-gradient(135deg,rgba(255,255,255,.13) 0 2px,transparent 2px 18px)}
.l-agency .cover.g:after{display:none}
.l-agency .hero,.l-agency .name{text-align:start;justify-content:flex-start}
.l-agency .hero-main{padding:0 22px}
.l-agency .av{justify-content:flex-start;margin-top:-52px}
.l-agency .avatar{width:104px;height:104px;border-radius:0;border:5px solid var(--bg);box-shadow:8px 8px 0 var(--s)}
.l-agency .id{padding-top:22px}
.l-agency .name{font-size:clamp(34px,10.5vw,46px);font-weight:900;letter-spacing:-.05em;line-height:.95;text-transform:uppercase}
.l-agency .name i{color:var(--s)}
.l-agency .role{color:var(--p);font-weight:800;text-transform:uppercase;letter-spacing:.1em;font-size:12.5px}
.l-agency .meta{justify-content:flex-start}
.l-agency .company,.l-agency .loc{border-radius:0;background:transparent;border:2px solid var(--tx);color:var(--tx);font-size:12px;text-transform:uppercase;letter-spacing:.06em}
.l-agency .actions{padding:22px 22px 0;gap:0}
.l-agency .act{height:64px;border-radius:0;background:var(--tx);color:var(--bg);margin-left:-1px;border-right:1px solid var(--bg)}
.l-agency .act span{color:inherit;opacity:1}
.l-agency .act:hover{background:var(--p);color:var(--onp);transform:none;box-shadow:none}
.l-agency .save{margin:0 22px;height:58px;border-radius:0;background:var(--s);color:var(--ons);text-transform:uppercase;letter-spacing:.1em;font-size:14px;font-weight:800;box-shadow:none}
.l-agency .save:after{display:none}
.l-agency .sec{padding:32px 22px 0}
.l-agency .sec h3{color:var(--tx);font-size:22px;font-weight:900;letter-spacing:-.03em;text-transform:uppercase}
.l-agency .sec h3 i{display:none}
.l-agency .box,.l-agency .links a,.l-agency .social a,.l-agency .pays a,.l-agency .post,.l-agency .prod,.l-agency .embed{border-radius:0;box-shadow:none;border:2px solid var(--tx);background:transparent}
.l-agency .links a:hover{background:var(--p);border-color:var(--p);color:var(--onp);transform:none}
.l-agency .row>i:not(.go),.l-agency .links a i{border-radius:0;background:var(--p);color:var(--onp)}

/* ================================================================== letterhead: formal stationery, centred crest rule, serif */
.l-letterhead{--r:3px;font-size:15.5px}
.l-letterhead .cover{display:none}
.l-letterhead .hero{padding:42px 26px 0;border-top:8px solid var(--p)}
.l-letterhead .av{margin:0}
.l-letterhead .avatar{width:96px;height:96px;border:0;box-shadow:0 0 0 1px var(--line),0 0 0 6px var(--bg),0 0 0 7px var(--p)}
.l-letterhead .id{padding-top:22px}
.l-letterhead .name{font-size:30px;font-weight:600;letter-spacing:.02em}
.l-letterhead .name i{color:var(--p)}
.l-letterhead .role{font-style:italic;font-size:16px}
.l-letterhead .id-text:after{content:"";display:block;margin:18px auto 0;width:100%;height:5px;border-top:1px solid var(--p);border-bottom:1px solid var(--p);opacity:.7}
.l-letterhead .company,.l-letterhead .loc{background:transparent;border:0;padding:0;border-radius:0;font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:var(--muted)}
.l-letterhead .company{color:var(--p)}
.l-letterhead .actions{padding:22px 26px 0;gap:0;border-top:0}
.l-letterhead .act{height:62px;border-radius:0;background:transparent;border:1px solid var(--line);color:var(--p);margin-left:-1px}
.l-letterhead .act:hover{background:var(--p);color:var(--onp);transform:none;box-shadow:none}
.l-letterhead .save{margin:14px 26px 0;border-radius:2px;letter-spacing:.2em;text-transform:uppercase;font-size:12.5px;box-shadow:none}
.l-letterhead .save:after{display:none}
.l-letterhead .sec{padding:32px 26px 0}
.l-letterhead .sec h3{color:var(--p);letter-spacing:.24em;font-size:11.5px;border-bottom:1px solid var(--line);padding-bottom:9px}
.l-letterhead .sec h3 i{display:none}
.l-letterhead .box,.l-letterhead .links a,.l-letterhead .social a,.l-letterhead .pays a,.l-letterhead .post,.l-letterhead .prod,.l-letterhead .embed{background:transparent;border:0;box-shadow:none;border-radius:0}
.l-letterhead .box{padding:4px 0 0}
.l-letterhead .box.list{padding:0}
.l-letterhead .row>i:not(.go){background:transparent;border:0;color:var(--p);width:24px;font-size:18px}
.l-letterhead .links a{border-bottom:1px solid var(--line);padding:14px 2px}
.l-letterhead .social a{border:1px solid var(--line);border-radius:50%}
.l-letterhead .svc{padding:0}

/* ================================================================== saas: clean product-company look, dotted grid, gradient badge */
.l-saas{--r:16px;background-image:radial-gradient(color-mix(in srgb,var(--tx) 11%,transparent) 1px,transparent 1.4px);background-size:20px 20px;background-color:var(--bg)}
.l-saas .cover{height:150px;margin:14px 14px 0;border-radius:20px}
.l-saas .cover.g{background:linear-gradient(120deg,var(--p),var(--s))}
.l-saas .hero{text-align:start}
.l-saas .hero-main{padding:0 22px;display:grid;grid-template-columns:auto 1fr;gap:14px;align-items:end}
.l-saas .av{margin-top:-38px}
.l-saas .avatar{width:84px;height:84px;border-radius:22px;border:4px solid var(--bg);box-shadow:0 12px 24px -12px rgba(0,0,0,.4)}
.l-saas .id{padding:0 0 6px;min-width:0}
.l-saas .name{justify-content:flex-start;font-size:23px;font-weight:800}
.l-saas .role{font-size:14px;margin-top:1px}
.l-saas .meta{grid-column:1/-1;justify-content:flex-start;margin-top:12px}
.l-saas .id-text>.meta{display:flex}
.l-saas .company{background:linear-gradient(120deg,color-mix(in srgb,var(--p) 16%,transparent),color-mix(in srgb,var(--s) 16%,transparent));color:var(--tx)}
.l-saas .actions{padding:18px 18px 0;gap:8px}
.l-saas .act{height:60px;border-radius:16px;background:var(--card);border:1px solid var(--line);box-shadow:var(--sh)}
.l-saas .save{margin:12px 18px 0;border-radius:14px;height:52px;background:linear-gradient(120deg,var(--p),var(--s))}
.l-saas .sec h3{color:var(--tx);text-transform:none;letter-spacing:-.01em;font-size:15px}
.l-saas .sec h3 i{width:26px;height:26px;border-radius:8px;display:grid;place-items:center;background:var(--chip);font-size:14px}
.l-saas .box,.l-saas .links a,.l-saas .social a,.l-saas .pays a,.l-saas .post,.l-saas .prod,.l-saas .embed{background:color-mix(in srgb,var(--bg) 88%,transparent);backdrop-filter:blur(4px)}

/* ================================================================== bizcard: the page opens with a physical business card */
.l-bizcard{--r:18px;background:var(--page)}
.l-bizcard .cover{display:none}
.l-bizcard .hero{padding:26px 18px 6px}
.l-bizcard .hero-main{position:relative;display:grid;grid-template-columns:1fr auto;gap:12px;align-items:start;min-height:230px;padding:26px 24px 24px 30px;border-radius:12px;background:var(--bg);color:var(--tx);text-align:start;
  box-shadow:0 1px 0 rgba(255,255,255,.7) inset,0 2px 4px rgba(15,23,42,.08),0 24px 44px -22px rgba(15,23,42,.45);animation:vc-deal .9s .1s var(--ease) both}
.l-bizcard .hero-main:before{content:"";position:absolute;left:0;top:0;bottom:0;width:10px;border-radius:12px 0 0 12px;background:linear-gradient(var(--p),var(--s))}
.l-bizcard .hero-main:after{content:"";position:absolute;right:-30px;bottom:-30px;width:120px;height:120px;border-radius:50%;background:var(--chip)}
.l-bizcard .av{order:2;margin:0;position:relative;z-index:2}
.l-bizcard .avatar{width:78px;height:78px;border-radius:12px;border:0;box-shadow:0 0 0 1px var(--line)}
.l-bizcard .id{order:1;padding:0;min-width:0;position:relative;z-index:2;align-self:stretch;display:flex;align-items:flex-end}
.l-bizcard .id-text{width:100%}
.l-bizcard .name{justify-content:flex-start;font-size:25px;font-weight:800;letter-spacing:-.03em}
.l-bizcard .name i{color:var(--p)}
.l-bizcard .role{color:var(--p);font-weight:700;font-size:13px;text-transform:uppercase;letter-spacing:.08em}
.l-bizcard .meta{justify-content:flex-start;margin-top:12px;gap:2px 12px}
.l-bizcard .company,.l-bizcard .loc{background:transparent;border:0;padding:0;font-size:12.5px;color:var(--muted)}
.l-bizcard .company{color:var(--tx);font-weight:700}
.l-bizcard .actions{padding-top:22px}
.l-bizcard .act{border-radius:14px;background:var(--bg);border:1px solid var(--line);box-shadow:var(--sh)}
.l-bizcard .save{border-radius:14px}
.l-bizcard .box,.l-bizcard .links a,.l-bizcard .social a,.l-bizcard .pays a,.l-bizcard .post,.l-bizcard .prod{background:var(--bg)}

/* ================================================================== local: neighbourhood business, cover photo, open-now badge, info rows */
.l-local{--r:18px}
.l-local .cover{height:230px}
.l-local .cover.g{background:linear-gradient(160deg,var(--p),color-mix(in srgb,var(--p) 40%,#000))}
.l-local .cover:after{content:"";position:absolute;inset:0;background:linear-gradient(transparent 45%,rgba(0,0,0,.55));-webkit-mask-image:none;mask-image:none;opacity:1}
.l-local .hero,.l-local .name{text-align:start;justify-content:flex-start}
.l-local .hero-main{padding:0 20px;display:grid;grid-template-columns:auto 1fr;gap:14px;align-items:end;margin-top:-62px;position:relative;z-index:3}
.l-local .av{margin:0}
.l-local .avatar{width:92px;height:92px;border-radius:22px;border:4px solid var(--bg);box-shadow:0 14px 26px -12px rgba(0,0,0,.5)}
.l-local .id{padding:0;min-width:0;color:#fff;align-self:start;margin-top:-34px}
.l-local .name{font-size:23px;color:#fff;text-shadow:0 2px 14px rgba(0,0,0,.45)}
.l-local .name i{color:#7dd3fc}
.l-local .role{color:rgba(255,255,255,.9)}
.l-local .meta{display:none}
.l-local .actions{padding:30px 16px 0;gap:8px}
.l-local .act{height:66px;border-radius:18px}
.l-local .save{margin:12px 16px 0;border-radius:18px}
.l-local .sec{padding:26px 16px 0}
.l-local .sec h3{color:var(--tx);text-transform:none;letter-spacing:-.01em;font-size:17px}
.l-local .box.hours{border-color:color-mix(in srgb,var(--p) 30%,transparent);background:color-mix(in srgb,var(--p) 5%,var(--card))}
.l-local .row>i:not(.go){border-radius:50%}
.l-local .foot{padding-bottom:84px}

/* ================================================================== shopfront: storefront banner, products first-class */
.l-shopfront{--r:16px}
.l-shopfront .cover{height:160px;border-radius:0 0 28px 28px}
.l-shopfront .cover.g{background:linear-gradient(135deg,var(--p),var(--s))}
.l-shopfront .hero-main{padding:0 20px}
.l-shopfront .avatar{width:112px;height:112px;border-radius:30px;border-width:5px}
.l-shopfront .av{margin-top:-56px}
.l-shopfront .name{font-size:26px;font-weight:800}
.l-shopfront .company{background:var(--p);color:var(--onp)}
.l-shopfront .actions{padding-top:20px}
.l-shopfront .act{border-radius:18px;background:var(--card);border:1px solid var(--line)}
.l-shopfront .save{border-radius:18px;height:54px}
.l-shopfront .sec h3{color:var(--tx);text-transform:none;font-size:18px;letter-spacing:-.02em;font-weight:800}
.l-shopfront .sec h3 i{display:none}
.l-shopfront .s-products .prods{gap:14px}
.l-shopfront .prod{border-radius:22px;border:0;box-shadow:0 18px 34px -24px rgba(0,0,0,.45)}
.l-shopfront .prod .img{aspect-ratio:4/5}
.l-shopfront .prod .price{display:inline-block;align-self:flex-start;padding:2px 10px;border-radius:999px;background:var(--p);color:var(--onp);font-size:13px}
.l-shopfront .prod .row2 .pri{border-radius:999px}
.l-shopfront .foot{padding-bottom:84px}

/* ================================================================== clinic: calm healthcare, soft tint, trust-first */
.l-clinic{--r:20px;background:linear-gradient(color-mix(in srgb,var(--p) 9%,var(--bg)),var(--bg) 320px) no-repeat,var(--bg)}
.l-clinic .cover{display:none}
.l-clinic .hero{padding-top:40px}
.l-clinic .av{margin:0;position:relative}
.l-clinic .avatar{width:122px;height:122px;border:5px solid var(--bg);box-shadow:0 0 0 2px color-mix(in srgb,var(--p) 40%,transparent),0 22px 40px -22px var(--p)}
.l-clinic .av:after{content:"+";position:absolute;right:calc(50% - 68px);bottom:6px;width:32px;height:32px;border-radius:50%;display:grid;place-items:center;background:var(--p);color:var(--onp);font-size:24px;font-weight:700;line-height:1;box-shadow:0 0 0 4px var(--bg)}
.l-clinic .name{font-size:27px;font-weight:700}
.l-clinic .role{color:var(--p);font-weight:600}
.l-clinic .company{background:var(--chip)}
.l-clinic .actions{padding-top:22px}
.l-clinic .act{border-radius:20px;background:var(--bg);border:1px solid color-mix(in srgb,var(--p) 25%,transparent);box-shadow:0 10px 20px -16px var(--p)}
.l-clinic .save{border-radius:18px;height:54px}
.l-clinic .sec h3{color:var(--p);font-size:12px}
.l-clinic .box,.l-clinic .links a,.l-clinic .social a,.l-clinic .pays a,.l-clinic .post,.l-clinic .prod{border-color:color-mix(in srgb,var(--p) 14%,var(--line));box-shadow:0 10px 24px -20px var(--p)}
.l-clinic .box.hours .d.today{background:var(--chip);margin-inline:-12px;padding-inline:12px;border-radius:10px}
.l-clinic .foot{padding-bottom:84px}

/* ================================================================== estate: real estate, full-bleed hero, dark info band, gold accents */
.l-estate{--r:14px}
.l-estate .cover{height:300px}
.l-estate .cover.g{background:linear-gradient(160deg,var(--p),color-mix(in srgb,var(--p) 30%,#000))}
.l-estate .cover:after{content:"";position:absolute;inset:0;background:linear-gradient(transparent 40%,rgba(0,0,0,.7));-webkit-mask-image:none;mask-image:none;opacity:1}
.l-estate .hero,.l-estate .name{text-align:start;justify-content:flex-start}
.l-estate .hero-main{position:absolute;left:0;right:0;bottom:0;padding:0 20px 20px;z-index:3;display:flex;align-items:flex-end;gap:14px}
.l-estate .av{margin:0}
.l-estate .avatar{width:84px;height:84px;border:3px solid var(--s);box-shadow:0 14px 26px -12px rgba(0,0,0,.6)}
.l-estate .id{padding:0;min-width:0;color:#fff}
.l-estate .name{font-size:24px;color:#fff;text-shadow:0 2px 16px rgba(0,0,0,.5)}
.l-estate .name i{color:var(--s)}
.l-estate .role{color:var(--s);font-weight:700;text-transform:uppercase;letter-spacing:.12em;font-size:11.5px}
.l-estate .meta{justify-content:flex-start;margin-top:8px}
.l-estate .company,.l-estate .loc{background:rgba(255,255,255,.16);color:#fff;border:0;backdrop-filter:blur(6px)}
.l-estate .actions{margin-top:0;padding:0;gap:0;background:var(--p);color:var(--onp)}
.l-estate .act{height:70px;border-radius:0;background:transparent;color:var(--onp)}
.l-estate .act span{color:inherit;opacity:.9}
.l-estate .act:hover{background:rgba(255,255,255,.14);color:var(--onp);transform:none;box-shadow:none}
.l-estate .save{margin:16px 20px 0;border-radius:10px;background:var(--s);color:var(--ons);text-transform:uppercase;letter-spacing:.12em;font-size:13px}
.l-estate .sec h3{color:var(--p);letter-spacing:.2em;font-size:11.5px}
.l-estate .sec h3 i{color:var(--s)}
.l-estate .box,.l-estate .links a,.l-estate .social a,.l-estate .pays a,.l-estate .post,.l-estate .prod{border-radius:12px}
.l-estate .foot{padding-bottom:84px}

/* ================================================================== bistro: hospitality, warm dark overlay, menu-style dotted leaders */
.l-bistro{--r:10px}
.l-bistro .cover{height:260px}
.l-bistro .cover.g{background:radial-gradient(70% 80% at 50% 0%,color-mix(in srgb,var(--s) 55%,transparent),transparent 70%),var(--p)}
.l-bistro .cover:after{content:"";position:absolute;inset:0;background:linear-gradient(rgba(0,0,0,.15),var(--bg));-webkit-mask-image:none;mask-image:none;opacity:1}
.l-bistro .av{margin-top:-86px}
.l-bistro .avatar{width:124px;height:124px;border:3px solid var(--s);padding:4px;background:var(--bg);box-shadow:0 0 0 6px var(--bg),0 24px 44px -20px rgba(0,0,0,.6)}
.l-bistro .name{font-size:32px;font-weight:600;letter-spacing:.01em}
.l-bistro .role{font-style:italic;color:var(--s);font-size:16px}
.l-bistro .id-text:after{content:"\2766";display:block;margin-top:12px;color:var(--s);font-size:18px}
.l-bistro .company,.l-bistro .loc{background:transparent;border:0;padding:0 4px;color:var(--muted)}
.l-bistro .actions{padding-top:16px}
.l-bistro .act{border-radius:10px;background:transparent;border:1px solid color-mix(in srgb,var(--s) 55%,transparent);color:var(--s)}
.l-bistro .act:hover{background:var(--s);color:var(--ons)}
.l-bistro .save{border-radius:10px;background:var(--s);color:var(--ons);letter-spacing:.14em;text-transform:uppercase;font-size:13px}
.l-bistro .sec h3{justify-content:center;color:var(--s);letter-spacing:.3em;font-size:11.5px}
.l-bistro .sec h3 i{display:none}
.l-bistro .sec h3:before,.l-bistro .sec h3:after{content:"";flex:1;border-top:1px solid color-mix(in srgb,var(--s) 45%,transparent)}
.l-bistro .box,.l-bistro .links a,.l-bistro .social a,.l-bistro .pays a,.l-bistro .post,.l-bistro .prod{background:color-mix(in srgb,var(--tx) 4%,transparent);border-color:color-mix(in srgb,var(--s) 22%,transparent);box-shadow:none}
.l-bistro .svc .item{align-items:baseline}
.l-bistro .svc b:after{content:"";display:inline-block;width:100%;height:0}
.l-bistro .hours .d span:first-child{flex:1;display:flex;align-items:baseline}
.l-bistro .hours .d span:first-child:after{content:"";flex:1;margin:0 8px;border-bottom:2px dotted color-mix(in srgb,var(--tx) 25%,transparent);transform:translateY(-3px)}
.l-bistro .hours .d.today span:first-child:after{width:auto;height:auto;border-radius:0;background:none;box-shadow:none;margin:0 8px;display:block}
.l-bistro .foot{padding-bottom:84px}

/* ================================================================== boardroom: executive, charcoal and gold, monogram rule */
.l-boardroom{--r:8px;background:linear-gradient(180deg,color-mix(in srgb,var(--p) 14%,var(--bg)),var(--bg) 260px) no-repeat,var(--bg)}
.l-boardroom .cover{display:none}
.l-boardroom .hero{text-align:start;padding:44px 26px 0}
.l-boardroom .hero-main{padding:0;display:grid;grid-template-columns:auto 1fr;gap:18px;align-items:center}
.l-boardroom .av{margin:0}
.l-boardroom .avatar{width:108px;height:132px;border-radius:6px;border:0;box-shadow:0 0 0 1px color-mix(in srgb,var(--s) 60%,transparent),10px 10px 0 -2px color-mix(in srgb,var(--s) 22%,transparent),0 24px 40px -22px #000;object-fit:cover}
.l-boardroom .id{padding:0;min-width:0}
.l-boardroom .name{justify-content:flex-start;font-size:26px;font-weight:600;letter-spacing:.01em;line-height:1.1}
.l-boardroom .name i{color:var(--s)}
.l-boardroom .role{color:var(--s);text-transform:uppercase;letter-spacing:.18em;font-size:11px;font-weight:700;margin-top:8px}
.l-boardroom .meta{justify-content:flex-start;margin-top:12px;gap:4px 10px}
.l-boardroom .company,.l-boardroom .loc{background:transparent;border:0;padding:0;font-size:12.5px;color:var(--muted)}
.l-boardroom .company{color:var(--tx);font-weight:700}
.l-boardroom .hero:after{content:"";display:block;height:1px;margin-top:26px;background:linear-gradient(90deg,var(--s),transparent)}
.l-boardroom .actions{padding:20px 26px 0;gap:8px}
.l-boardroom .act{height:62px;border-radius:6px;background:transparent;border:1px solid color-mix(in srgb,var(--s) 45%,transparent);color:var(--s)}
.l-boardroom .act:hover{background:var(--s);color:var(--ons);transform:none;box-shadow:none}
.l-boardroom .save{margin:12px 26px 0;border-radius:6px;background:var(--s);color:var(--ons);letter-spacing:.16em;text-transform:uppercase;font-size:12.5px;box-shadow:none}
.l-boardroom .save:after{display:none}
.l-boardroom .sec{padding:30px 26px 0}
.l-boardroom .sec h3{color:var(--s);letter-spacing:.24em;font-size:11px}
.l-boardroom .sec h3 i{display:none}
.l-boardroom .sec h3:after{content:"";flex:1;height:1px;background:linear-gradient(90deg,color-mix(in srgb,var(--s) 50%,transparent),transparent)}
.l-boardroom .box,.l-boardroom .links a,.l-boardroom .social a,.l-boardroom .pays a,.l-boardroom .post,.l-boardroom .prod,.l-boardroom .embed{border-radius:6px;box-shadow:none;background:color-mix(in srgb,var(--tx) 4%,transparent);border-color:color-mix(in srgb,var(--s) 22%,var(--line))}
.l-boardroom .foot{padding-bottom:84px}
.l-boardroom .row>i:not(.go),.l-boardroom .links a i{background:transparent;border:1px solid color-mix(in srgb,var(--s) 45%,transparent);color:var(--s);border-radius:6px}
`;
