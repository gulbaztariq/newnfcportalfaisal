/*
 * Social-media layouts (appended after premium.js). Same DOM and theme tokens as the other layouts.
 * Every layout here is listed in SOCIAL_LAYOUTS (catalog.js) and so also gets the floating action stack (.stk-fab).
 */
module.exports = String.raw`
/* ================================================================== floating action stack (WhatsApp, call, e-mail, Telegram, Instagram, save, share) */
.stk-fab{left:auto;right:max(14px,calc(50% - 226px));bottom:16px;transform:none;flex-direction:column;align-items:center;gap:8px;padding:0;border:0;border-radius:0;background:none;box-shadow:none;backdrop-filter:none;-webkit-backdrop-filter:none;animation:pm-fab .6s 1s var(--ease,ease) both}
.stk-fab a,.stk-fab button{width:42px;height:42px;font-size:18px;background:var(--card);color:var(--p);border:1px solid var(--line);box-shadow:0 10px 24px -10px rgba(0,0,0,.45)}
.stk-fab .main{width:42px;background:var(--p);color:var(--onp);border-color:transparent}
.stk-fab .ig{color:#e1306c}
.stk-fab .tg{color:#2aabee}
.stk-fab .wa{position:relative;width:60px;height:60px;font-size:31px;background:#25d366;color:#fff;border:0;box-shadow:0 14px 30px -10px rgba(37,211,102,.8)}
.stk-fab .wa:before{content:"";position:absolute;inset:0;border-radius:50%;border:2px solid #25d366;animation:pm-ring 2.4s 2s ease-out infinite;pointer-events:none}
.stk-fab a:hover,.stk-fab button:hover{transform:translateY(-3px) scale(1.05)}
@keyframes pm-fab{from{opacity:0;transform:translateY(30px)}to{opacity:1;transform:none}}
@keyframes pm-ring{0%{transform:scale(1);opacity:.7}100%{transform:scale(1.7);opacity:0}}
.stk-flash a,.stk-flash button{border:2px solid #111;box-shadow:3px 3px 0 #111;color:#111}
.stk-flash .main{background:#111;color:#fffc00}
.stk-flash .wa{border:2px solid #111}
.stk-beat a,.stk-beat button{box-shadow:-2px 0 0 #25f4ee,2px 0 0 #fe2c55}
.stk-chat a:not(.wa),.stk-chat button{background:#fff;color:#128c7e}
.stk-xfeed a,.stk-xfeed button,.stk-thread a,.stk-thread button{box-shadow:0 4px 14px -6px rgba(0,0,0,.35)}

/* ================================================================== story: Instagram-style profile, gradient story ring, highlights row, tight grid */
.l-story{--r:14px}
.l-story .cover{display:none}
.l-story .hero{padding-top:46px}
.l-story .av{margin:0}
.l-story .avatar{width:112px;height:112px;border:0;padding:4px;background:conic-gradient(from 200deg,var(--s),var(--p),#a62fbf,var(--s));box-shadow:inset 0 0 0 4px var(--bg),0 18px 36px -20px var(--p)}
.l-story .avatar.ph{background:linear-gradient(45deg,var(--s),var(--p) 60%,#a62fbf)}
.l-story .name{font-size:21px;font-weight:700;letter-spacing:-.02em}
.l-story .role{font-size:14.5px;color:var(--tx);font-weight:500;opacity:.85}
.l-story .company,.l-story .loc{background:transparent;border:0;padding:0;font-size:13px;color:#00376b;font-weight:600}
.l-story.is-dark .company,.l-story.is-dark .loc{color:#e0f1ff}
.l-story .actions{padding:18px 20px 0;gap:8px}
.l-story .act{height:36px;border-radius:9px;flex-direction:row;gap:6px;background:color-mix(in srgb,var(--tx) 7%,var(--bg));color:var(--tx);font-size:12.5px;font-weight:600}
.l-story .act i{font-size:16px}
.l-story .act span{display:none}
.l-story .act:hover{background:color-mix(in srgb,var(--tx) 13%,var(--bg));color:var(--tx);box-shadow:none;transform:none}
.l-story .save{height:40px;border-radius:10px;margin-top:12px;background:linear-gradient(45deg,var(--s),var(--p) 70%);font-size:14.5px;box-shadow:none}
.l-story .sec{padding-top:26px}
.l-story .sec h3{justify-content:center;color:var(--tx);font-size:11.5px}
.l-story .sec h3 i{display:none}
.l-story .s-social .social{display:flex;gap:14px;overflow-x:auto;padding:4px 4px 8px;scrollbar-width:none}
.l-story .s-social .social::-webkit-scrollbar{display:none}
.l-story .s-social .social a{flex:none;width:64px;height:64px;aspect-ratio:auto;border:0;border-radius:50%;padding:0;background:conic-gradient(var(--s),var(--p),#a62fbf,var(--s));color:var(--tx);box-shadow:none;position:relative;font-size:24px}
.l-story .s-social .social a:before{content:"";position:absolute;inset:2.5px;border-radius:50%;background:var(--bg);z-index:0}
.l-story .s-social .social a i{position:relative;z-index:1}
.l-story .s-social .social a:hover{background:conic-gradient(var(--s),var(--p),#a62fbf,var(--s));color:var(--p);transform:scale(1.06)}
.l-story .gal{gap:3px;grid-template-columns:repeat(3,1fr)}
.l-story .gal a{border-radius:0}
.l-story .box,.l-story .links a,.l-story .pays a,.l-story .post,.l-story .prod,.l-story .embed{box-shadow:none}
.l-story .links a{border-radius:10px}

/* ================================================================== beat: TikTok-style, black stage with cyan / pink glitch */
.l-beat{--r:14px}
.l-beat .cover{display:none}
.l-beat .hero{padding-top:50px}
.l-beat .av{margin:0}
.l-beat .avatar{width:108px;height:108px;border:0;box-shadow:-4px 0 0 var(--p),4px 0 0 var(--s),0 20px 40px -20px #000}
.l-beat .name{font-size:24px;font-weight:800;letter-spacing:-.02em;text-shadow:-1.5px 0 var(--p),1.5px 0 var(--s)}
.l-beat .name i{color:#20d5ec;text-shadow:none}
.l-beat .role{font-weight:600;color:var(--tx);opacity:.85}
.l-beat .company,.l-beat .loc{background:color-mix(in srgb,var(--tx) 8%,transparent);border:0}
.l-beat .actions{padding-top:20px}
.l-beat .act{height:48px;border-radius:6px;flex-direction:row;gap:7px;background:color-mix(in srgb,var(--tx) 10%,transparent);color:var(--tx);font-size:13px}
.l-beat .act span{opacity:1}
.l-beat .act i{font-size:18px}
.l-beat .act:hover{background:var(--s);color:#fff;box-shadow:none}
.l-beat .save{border-radius:6px;background:var(--s);color:#fff;box-shadow:-3px 0 0 var(--p);height:50px}
.l-beat .save:after{display:none}
.l-beat .sec h3{color:var(--tx);font-size:13px;letter-spacing:.08em}
.l-beat .sec h3 i{color:var(--p)}
.l-beat .box,.l-beat .links a,.l-beat .social a,.l-beat .pays a,.l-beat .post,.l-beat .prod,.l-beat .embed{background:color-mix(in srgb,var(--tx) 6%,transparent);border:0;border-radius:8px;box-shadow:none}
.l-beat .links a{border-radius:6px;box-shadow:inset 3px 0 0 var(--p)}
.l-beat .links a:hover{box-shadow:inset 3px 0 0 var(--s),-2px 0 0 var(--p)}
.l-beat .social a{border-radius:8px}
.l-beat .gal a{border-radius:6px}

/* ================================================================== flash: Snapchat-style, loud yellow, chunky outlines, round everything */
.l-flash{--r:26px;--k:var(--tx)}
.l-flash .cover{display:none}
.l-flash .hero{padding-top:44px}
.l-flash .av{margin:0}
.l-flash .avatar{width:136px;height:136px;border:4px solid var(--k);box-shadow:6px 6px 0 var(--k);background:#fff}
.l-flash .avatar.ph{background:var(--s);color:var(--bg)}
.l-flash .name{font-size:32px;font-weight:900;letter-spacing:-.04em}
.l-flash .role{color:var(--k);font-weight:700}
.l-flash .company,.l-flash .loc{background:#fff;border:2.5px solid var(--k);color:var(--k)}
.l-flash .act{height:64px;border-radius:22px;background:var(--k);color:var(--bg);border:0}
.l-flash .act span{color:inherit;opacity:1}
.l-flash .act:hover{background:#fff;color:var(--k);box-shadow:0 0 0 3px var(--k)}
.l-flash .save{border-radius:22px;background:#fff;color:var(--k);border:3px solid var(--k);box-shadow:5px 5px 0 var(--k);height:58px}
.l-flash .save:after{display:none}
.l-flash .sec h3{color:var(--k);font-size:14px;font-weight:900}
.l-flash .sec h3 i{color:var(--k)}
.l-flash .box,.l-flash .links a,.l-flash .social a,.l-flash .pays a,.l-flash .post,.l-flash .prod,.l-flash .embed{background:#fff;color:#111;border:3px solid var(--k);box-shadow:5px 5px 0 var(--k)}
.l-flash .row small,.l-flash .svc p{color:#555}
.l-flash .row>i:not(.go),.l-flash .links a i{background:var(--bg);color:var(--k)}
.l-flash .social a{border-radius:20px;color:var(--k)}
.l-flash .social a:hover{background:var(--k);color:var(--bg)}

/* ================================================================== channel: YouTube-style banner, channel header, subscribe button, video grid */
.l-channel{--r:12px}
.l-channel .cover{height:128px;margin:12px 12px 0;border-radius:14px}
.l-channel .hero,.l-channel .name{text-align:start;justify-content:flex-start}
.l-channel .hero-main{display:grid;grid-template-columns:auto 1fr;gap:16px;align-items:center;padding:18px 20px 0}
.l-channel .av{margin:0}
.l-channel .avatar{width:92px;height:92px;border:0;box-shadow:0 8px 20px -10px rgba(0,0,0,.4)}
.l-channel .id{padding:0;min-width:0}
.l-channel .name{font-size:24px;font-weight:800;letter-spacing:-.03em}
.l-channel .role{font-size:14px;margin-top:2px}
.l-channel .meta{justify-content:flex-start;margin-top:8px;gap:6px}
.l-channel .company,.l-channel .loc{background:color-mix(in srgb,var(--tx) 7%,transparent);border:0;font-size:12px;padding:4px 10px}
.l-channel .actions{overflow-x:auto;scrollbar-width:none;gap:8px;padding:16px 20px 0}
.l-channel .actions::-webkit-scrollbar{display:none}
.l-channel .act{flex:none;height:36px;padding:0 15px;flex-direction:row;gap:7px;border-radius:999px;background:color-mix(in srgb,var(--tx) 8%,transparent);color:var(--tx);font-size:13.5px;font-weight:600}
.l-channel .act i{font-size:17px}
.l-channel .act span{opacity:1}
.l-channel .act:hover{background:color-mix(in srgb,var(--tx) 14%,transparent);color:var(--tx);box-shadow:none;transform:none}
.l-channel .save{height:42px;border-radius:999px;background:var(--p);font-size:14.5px;letter-spacing:.02em;text-transform:uppercase;box-shadow:none}
.l-channel .save:after{display:none}
.l-channel .sec h3{color:var(--tx);font-size:16px;letter-spacing:-.01em;text-transform:none;font-weight:700}
.l-channel .sec h3 i{display:none}
.l-channel .box,.l-channel .links a,.l-channel .social a,.l-channel .pays a,.l-channel .post,.l-channel .prod,.l-channel .embed{box-shadow:none;border-radius:12px}
.l-channel .gal{grid-template-columns:1fr 1fr;gap:12px}
.l-channel .gal a{border-radius:12px}
.l-channel .gal img{aspect-ratio:16/9}
.l-channel .post{flex-direction:column;align-items:stretch;padding:0;overflow:hidden}
.l-channel .post img{width:100%;height:auto;aspect-ratio:16/9;border-radius:0}
.l-channel .post>div{padding:10px 12px 12px}

/* ================================================================== xfeed: X / Twitter-style, hairline feed, outline pills */
.l-xfeed{--r:16px}
.l-xfeed .cover{height:118px}
.l-xfeed .cover.g{background:color-mix(in srgb,var(--tx) 14%,var(--bg))}
.l-xfeed .cover.g:before,.l-xfeed .cover.g:after{display:none}
.l-xfeed .hero,.l-xfeed .name{text-align:start;justify-content:flex-start}
.l-xfeed .hero-main{padding:0 18px}
.l-xfeed .av{justify-content:flex-start;margin-top:-44px}
.l-xfeed .avatar{width:88px;height:88px;border-width:4px;box-shadow:none}
.l-xfeed .id{padding-top:10px}
.l-xfeed .name{font-size:21px;font-weight:800;letter-spacing:-.02em}
.l-xfeed .name i{color:var(--p)}
.l-xfeed .role{font-size:14.5px;margin-top:2px}
.l-xfeed .meta{justify-content:flex-start;gap:4px 14px;margin-top:10px}
.l-xfeed .company,.l-xfeed .loc{background:transparent;border:0;padding:0;color:var(--muted);font-weight:500}
.l-xfeed .actions{padding:16px 18px 0;gap:8px}
.l-xfeed .act{height:38px;border-radius:999px;flex-direction:row;gap:6px;background:transparent;border:1px solid color-mix(in srgb,var(--tx) 25%,transparent);color:var(--tx);font-size:13.5px;font-weight:700}
.l-xfeed .act span{opacity:1}
.l-xfeed .act i{font-size:16px}
.l-xfeed .act:hover{background:color-mix(in srgb,var(--tx) 8%,transparent);color:var(--tx);box-shadow:none;transform:none}
.l-xfeed .save{margin:10px 18px 0;height:42px;border-radius:999px;background:var(--tx);color:var(--bg);box-shadow:none;font-size:15px;font-weight:700}
.l-xfeed .save:after{display:none}
.l-xfeed .sec{padding:0 0 0;margin-top:22px;border-top:1px solid var(--line)}
.l-xfeed .sec h3{margin:0;padding:14px 18px 10px;font-size:19px;font-weight:800;letter-spacing:-.02em;text-transform:none;color:var(--tx)}
.l-xfeed .sec h3 i{display:none}
.l-xfeed .sec>*:not(h3){margin:0 18px}
.l-xfeed .box,.l-xfeed .links a,.l-xfeed .social a,.l-xfeed .pays a,.l-xfeed .post,.l-xfeed .prod,.l-xfeed .embed{box-shadow:none;background:transparent}
.l-xfeed .links a{border-radius:999px;justify-content:center;text-align:center;font-weight:700;position:relative}
.l-xfeed .links a i{position:absolute;inset-inline-end:10px;background:transparent}
.l-xfeed .foot{padding-top:30px}

/* ================================================================== network: LinkedIn-style professional card on a grey canvas */
.l-network{--r:12px;background:var(--page)}
.l-network .hero{margin:12px 12px 0;border-radius:14px;background:var(--bg);overflow:hidden;box-shadow:0 0 0 1px var(--line);text-align:start;padding-bottom:20px}
.l-network .cover{height:104px}
.l-network .hero-main{padding:0 20px}
.l-network .av{justify-content:flex-start;margin-top:-48px}
.l-network .avatar{width:96px;height:96px;border-width:4px;box-shadow:none}
.l-network .id{padding-top:10px}
.l-network .name{justify-content:flex-start;font-size:23px;font-weight:700;letter-spacing:-.02em}
.l-network .name i{color:var(--p)}
.l-network .role{color:var(--tx);font-size:15px;font-weight:500}
.l-network .meta{justify-content:flex-start;gap:4px 12px;margin-top:8px}
.l-network .company,.l-network .loc{background:transparent;border:0;padding:0;font-size:13px;color:var(--muted);font-weight:500}
.l-network .company{color:var(--tx);font-weight:600}
.l-network .actions{padding:14px 12px 0;gap:8px}
.l-network .act{height:40px;border-radius:999px;flex-direction:row;gap:6px;background:var(--bg);border:1.5px solid var(--p);color:var(--p);font-size:13.5px;font-weight:600}
.l-network .act span{color:inherit;opacity:1}
.l-network .act i{font-size:16px}
.l-network .act:hover{background:var(--chip);color:var(--p);box-shadow:none;transform:none}
.l-network .save{margin:8px 12px 0;height:44px;border-radius:999px;box-shadow:none;font-size:15px}
.l-network .save:after{display:none}
.l-network .sec{margin:10px 12px 0;padding:18px 18px 18px;border-radius:14px;background:var(--bg);box-shadow:0 0 0 1px var(--line)}
.l-network .sec h3{margin:0 0 12px;font-size:17px;text-transform:none;letter-spacing:-.01em;color:var(--tx);font-weight:700}
.l-network .sec h3 i{display:none}
.l-network .sec .box,.l-network .sec .links a,.l-network .sec .social a,.l-network .sec .pays a,.l-network .sec .post,.l-network .sec .prod,.l-network .sec .embed{box-shadow:none;background:transparent}
.l-network .sec>.box{border:0;padding:0}
.l-network .box.list{padding:0}
.l-network .links a{border-radius:999px;border-color:var(--p);color:var(--p);justify-content:center;position:relative}
.l-network .links a i{position:absolute;inset-inline-end:8px}
.l-network .foot{padding-top:24px}

/* ================================================================== pinboard: Pinterest-style, warm and rounded, masonry gallery */
.l-pinboard{--r:26px}
.l-pinboard .cover{display:none}
.l-pinboard .hero{padding-top:44px}
.l-pinboard .av{margin:0}
.l-pinboard .avatar{width:118px;height:118px;border:0;box-shadow:0 0 0 5px color-mix(in srgb,var(--p) 14%,var(--bg)),0 22px 40px -22px rgba(0,0,0,.5)}
.l-pinboard .name{font-size:30px;font-weight:800;letter-spacing:-.04em}
.l-pinboard .role{font-size:15px;font-weight:500}
.l-pinboard .company{background:transparent;color:var(--p);padding:0;font-weight:700}
.l-pinboard .loc{border:0;padding:0}
.l-pinboard .actions{justify-content:center;gap:10px;padding-top:18px}
.l-pinboard .act{flex:0 0 52px;height:52px;border-radius:50%;background:color-mix(in srgb,var(--tx) 7%,var(--bg));color:var(--tx)}
.l-pinboard .act span{display:none}
.l-pinboard .act:hover{background:var(--tx);color:var(--bg);box-shadow:none}
.l-pinboard .save{height:54px;background:var(--p);box-shadow:none;font-size:16px}
.l-pinboard .save:after{display:none}
.l-pinboard .sec h3{justify-content:center;color:var(--tx);font-size:13px}
.l-pinboard .sec h3 i{display:none}
.l-pinboard .box,.l-pinboard .links a,.l-pinboard .social a,.l-pinboard .pays a,.l-pinboard .post,.l-pinboard .prod,.l-pinboard .embed{border:0;box-shadow:0 1px 2px rgba(0,0,0,.05),0 14px 30px -22px rgba(0,0,0,.35)}
.l-pinboard .gal{display:block;columns:2;column-gap:10px}
.l-pinboard .gal a{display:block;margin-bottom:10px;border-radius:20px;break-inside:avoid}
.l-pinboard .gal img{aspect-ratio:auto}
.l-pinboard .gal a:nth-child(3n+1) img{aspect-ratio:3/4}
.l-pinboard .gal a:nth-child(3n+2) img{aspect-ratio:1}
.l-pinboard .gal a:nth-child(3n) img{aspect-ratio:4/5}
.l-pinboard .links a{border-radius:999px}

/* ================================================================== groove: Spotify-style, album-art portrait, numbered track list */
.l-groove{--r:10px;background:linear-gradient(color-mix(in srgb,var(--p) 42%,var(--bg)),var(--bg) 340px) no-repeat,var(--bg)}
.l-groove .cover{display:none}
.l-groove .hero{text-align:start;padding:46px 20px 0}
.l-groove .hero-main{padding:0;display:grid;grid-template-columns:1fr;gap:18px}
.l-groove .av{justify-content:flex-start;margin:0}
.l-groove .avatar{width:168px;height:168px;border-radius:8px;border:0;box-shadow:0 22px 40px -14px rgba(0,0,0,.7)}
.l-groove .id{padding:0}
.l-groove .id-text:before{content:"PROFILE";display:block;font-size:11px;font-weight:700;letter-spacing:.14em;margin-bottom:2px}
.l-groove .name{justify-content:flex-start;font-size:clamp(30px,10vw,42px);font-weight:900;letter-spacing:-.04em;line-height:1.02}
.l-groove .name i{color:#3d91f4}
.l-groove .role{color:var(--tx);font-weight:600;opacity:.8}
.l-groove .meta{justify-content:flex-start;gap:4px 12px}
.l-groove .company,.l-groove .loc{background:transparent;border:0;padding:0;font-size:13px;color:var(--muted)}
.l-groove .actions{padding:20px 20px 0;gap:8px}
.l-groove .act{height:44px;border-radius:999px;flex-direction:row;gap:6px;background:transparent;border:1px solid color-mix(in srgb,var(--tx) 35%,transparent);color:var(--tx);font-size:13px;font-weight:700}
.l-groove .act span{opacity:1}
.l-groove .act:hover{background:color-mix(in srgb,var(--tx) 10%,transparent);color:var(--tx);border-color:var(--tx);box-shadow:none;transform:scale(1.03)}
.l-groove .save{margin:12px 20px 0;height:52px;background:var(--p);color:#000;font-weight:800;letter-spacing:.02em;box-shadow:none}
.l-groove .save:after{display:none}
.l-groove .sec h3{color:var(--tx);font-size:19px;letter-spacing:-.02em;text-transform:none;font-weight:800}
.l-groove .sec h3 i{display:none}
.l-groove .box,.l-groove .pays a,.l-groove .post,.l-groove .prod,.l-groove .embed{background:var(--card);border:0;box-shadow:none}
.l-groove .links{counter-reset:tr;gap:2px}
.l-groove .links a{counter-increment:tr;background:transparent;border:0;box-shadow:none;border-radius:8px;padding:12px 10px;gap:14px;justify-content:flex-start}
.l-groove .links a:before{content:counter(tr);width:22px;text-align:center;color:var(--muted);font-variant-numeric:tabular-nums;font-weight:500}
.l-groove .links a span{flex:1}
.l-groove .links a:hover{background:color-mix(in srgb,var(--tx) 10%,transparent);transform:none}
.l-groove .links a:hover:before{content:"\25B6";color:var(--p);font-size:11px}
.l-groove .links a i{background:transparent}
.l-groove .social a{background:var(--card);border:0;box-shadow:none;border-radius:50%}

/* ================================================================== stream: Twitch-style, banner, live portrait, info panels */
.l-stream{--r:8px}
.l-stream .cover{height:132px}
.l-stream .hero,.l-stream .name{text-align:start;justify-content:flex-start}
.l-stream .hero-main{display:grid;grid-template-columns:auto 1fr;gap:16px;align-items:start;padding:0 18px}
.l-stream .av{margin-top:-40px;position:relative}
.l-stream .avatar{width:96px;height:96px;border-radius:50%;border:3px solid var(--p);box-shadow:0 0 0 4px var(--bg),0 0 28px -4px var(--p)}
.l-stream .av:after{content:"LIVE";position:absolute;left:50%;bottom:-8px;transform:translateX(-50%);padding:2px 8px;border-radius:4px;background:#eb0400;color:#fff;font-size:10.5px;font-weight:800;letter-spacing:.08em;animation:pm-live 2s ease-in-out infinite}
.l-stream .id{padding:14px 0 0;min-width:0}
.l-stream .name{font-size:23px;font-weight:800}
.l-stream .name i{color:var(--p)}
.l-stream .role{font-size:14px;margin-top:2px}
.l-stream .meta{justify-content:flex-start;margin-top:8px;gap:6px}
.l-stream .company,.l-stream .loc{background:color-mix(in srgb,var(--p) 18%,transparent);border:0;color:var(--tx);font-size:11.5px;padding:3px 9px;border-radius:5px}
.l-stream .actions{padding:26px 18px 0;gap:8px}
.l-stream .act{height:40px;border-radius:6px;flex-direction:row;gap:6px;background:color-mix(in srgb,var(--tx) 10%,transparent);color:var(--tx);font-size:12.5px;font-weight:700}
.l-stream .act span{opacity:1}
.l-stream .act i{font-size:16px}
.l-stream .act:hover{background:var(--p);color:#fff;box-shadow:none;transform:none}
.l-stream .save{margin:10px 18px 0;height:44px;border-radius:6px;background:var(--p);color:#fff;box-shadow:none;font-size:14.5px}
.l-stream .save:after{display:none}
.l-stream .sec{padding:22px 18px 0}
.l-stream .sec h3{margin:0;padding:10px 14px;background:color-mix(in srgb,var(--p) 22%,var(--bg));border-radius:8px 8px 0 0;color:var(--tx);font-size:12px;letter-spacing:.1em}
.l-stream .sec>:not(h3){border-radius:0 0 8px 8px;border-top:0}
.l-stream .sec .social,.l-stream .sec .links,.l-stream .sec .pays,.l-stream .sec .posts,.l-stream .sec .prods,.l-stream .sec .tst,.l-stream .sec .gal,.l-stream .sec .chips{background:color-mix(in srgb,var(--tx) 5%,var(--bg));padding:12px;border-radius:0 0 8px 8px}
.l-stream .box,.l-stream .links a,.l-stream .social a,.l-stream .pays a,.l-stream .post,.l-stream .prod,.l-stream .embed{box-shadow:none;border-radius:6px}
.l-stream .sec>.box{background:color-mix(in srgb,var(--tx) 5%,var(--bg))}
@keyframes pm-live{0%,100%{opacity:1}50%{opacity:.6}}

/* ================================================================== chat: WhatsApp-style, green header bar, doodle wallpaper, bubbles */
.l-chat{--r:14px;background-color:var(--bg);background-image:radial-gradient(color-mix(in srgb,var(--tx) 9%,transparent) 1.2px,transparent 1.6px),radial-gradient(color-mix(in srgb,var(--tx) 6%,transparent) 1px,transparent 1.4px);background-size:26px 26px,26px 26px;background-position:0 0,13px 13px}
.l-chat .cover{display:none}
.l-chat .hero{background:var(--p);color:var(--onp);text-align:start;padding:14px 16px 18px;box-shadow:0 2px 0 rgba(0,0,0,.08)}
.l-chat .hero-main{display:flex;align-items:center;gap:12px;padding:0}
.l-chat .av{margin:0}
.l-chat .avatar{width:58px;height:58px;border:0;box-shadow:none}
.l-chat .avatar.ph{font-size:20px;background:rgba(255,255,255,.22);color:inherit}
.l-chat .id{padding:0;min-width:0}
.l-chat .name{justify-content:flex-start;font-size:19px;font-weight:600;color:inherit;letter-spacing:-.01em}
.l-chat .name i{color:inherit}
.l-chat .role{color:inherit;opacity:.85;font-size:13px;margin-top:0}
.l-chat .meta{justify-content:flex-start;margin-top:6px;gap:6px}
.l-chat .company,.l-chat .loc{background:rgba(255,255,255,.18);color:inherit;border:0;font-size:11.5px;padding:2px 9px}
.l-chat .actions{padding:16px 16px 0;gap:8px}
.l-chat .act{height:56px;border-radius:14px;background:#fff;color:#128c7e;border:0;box-shadow:0 1px 1px rgba(0,0,0,.12)}
.l-chat .act span{color:#111b21;opacity:.8}
.l-chat .act:hover{background:var(--s);color:#fff;box-shadow:0 1px 1px rgba(0,0,0,.12)}
.l-chat .act:hover span{color:#fff}
.l-chat .save{margin:10px 16px 0;height:50px;border-radius:14px;background:var(--s);color:#fff;box-shadow:0 1px 1px rgba(0,0,0,.18);font-size:15px}
.l-chat .save:after{display:none}
.l-chat .sec{padding:20px 16px 0}
.l-chat .sec h3{display:block;width:max-content;max-width:100%;margin:0 auto 12px;padding:5px 12px;border-radius:8px;background:color-mix(in srgb,#fff 80%,var(--bg));color:#54656f;font-size:11.5px;letter-spacing:.05em;box-shadow:0 1px 1px rgba(0,0,0,.1)}
.l-chat .sec h3 i{display:none}
.l-chat .box,.l-chat .links a,.l-chat .social a,.l-chat .pays a,.l-chat .post,.l-chat .prod,.l-chat .embed{background:#fff;color:#111b21;border:0;box-shadow:0 1px 1px rgba(0,0,0,.14)}
.l-chat .box{position:relative;border-radius:0 14px 14px 14px;margin-inline-start:8px}
.l-chat .box:before{content:"";position:absolute;top:0;inset-inline-start:-8px;border:8px solid transparent;border-top-color:#fff;border-inline-end-color:#fff}
.l-chat .box.about,.l-chat .box .q{color:#111b21}
.l-chat .row small,.l-chat .svc p,.l-chat .hours .d span:last-child,.l-chat .qr p{color:#667781}
.l-chat .row span,.l-chat .svc b{color:#111b21}
.l-chat .links a{border-radius:12px;color:#128c7e;justify-content:center;font-weight:600}
.l-chat .links a i{display:none}
.l-chat .social a{border-radius:50%;color:#128c7e}
.l-chat .box.hours .d,.l-chat .box .item{color:#111b21}
.l-chat .foot,.l-chat .legal a{color:#54656f}

/* ================================================================== plane: Telegram-style, sky gradient header and grouped list cards */
.l-plane{--r:16px;background:var(--bg)}
.l-plane:before{content:"";position:absolute;left:0;right:0;top:0;height:330px;z-index:-1;background:linear-gradient(170deg,var(--p),var(--s))}
.l-plane:after{content:"";position:absolute;left:0;right:0;top:230px;height:100px;z-index:-1;background:linear-gradient(transparent,var(--bg))}
.l-plane .cover{display:none}
.l-plane .hero{padding-top:44px;color:#fff}
.l-plane .av{margin:0}
.l-plane .avatar{width:104px;height:104px;border:4px solid rgba(255,255,255,.9);box-shadow:0 18px 34px -16px rgba(0,0,0,.45)}
.l-plane .avatar.ph{background:rgba(255,255,255,.22);color:#fff}
.l-plane .name{font-size:26px;font-weight:700;color:#fff;letter-spacing:-.02em}
.l-plane .name i,.l-plane .role{color:#fff}
.l-plane .role{opacity:.9;font-size:14.5px}
.l-plane .company,.l-plane .loc{background:rgba(255,255,255,.2);color:#fff;border:0}
.l-plane .actions{padding:22px 16px 0;gap:8px}
.l-plane .act{height:68px;border-radius:16px;background:var(--bg);color:var(--p);border:0;box-shadow:0 12px 24px -16px rgba(0,0,0,.4)}
.l-plane .act:hover{background:var(--p);color:#fff}
.l-plane .save{margin:12px 16px 0;height:52px;border-radius:14px;background:var(--p);box-shadow:0 14px 28px -16px var(--p)}
.l-plane .sec{padding:22px 16px 0}
.l-plane .sec h3{color:var(--p);font-size:12.5px;letter-spacing:.06em;margin-bottom:8px}
.l-plane .sec h3 i{display:none}
.l-plane .box,.l-plane .links a,.l-plane .social a,.l-plane .pays a,.l-plane .post,.l-plane .prod,.l-plane .embed{border:0;box-shadow:none;background:color-mix(in srgb,var(--tx) 5%,var(--bg))}
.l-plane .row>i:not(.go){border-radius:50%;background:var(--p);color:#fff}
.l-plane .links a i{background:var(--p);color:#fff}
.l-plane .social a{border-radius:16px}

/* ================================================================== thread: Threads-style, stacked post cards on soft grey */
.l-thread{--r:22px;background:color-mix(in srgb,var(--tx) 5%,var(--bg))}
.l-thread .cover{display:none}
.l-thread .hero{padding:16px 14px 0}
.l-thread .hero-main{padding:30px 20px 24px;border-radius:26px;background:var(--bg);box-shadow:0 0 0 1px var(--line),0 12px 30px -24px rgba(0,0,0,.4)}
.l-thread .av{margin:0}
.l-thread .avatar{width:92px;height:92px;border:0;box-shadow:0 0 0 1px var(--line)}
.l-thread .name{font-size:23px;font-weight:700;letter-spacing:-.03em}
.l-thread .name i{color:#0095f6}
.l-thread .role{font-size:14.5px}
.l-thread .company,.l-thread .loc{background:transparent;border:0;padding:0;color:var(--muted);font-weight:500}
.l-thread .actions{padding:14px 14px 0;gap:8px}
.l-thread .act{height:44px;border-radius:14px;flex-direction:row;gap:6px;background:var(--bg);border:1px solid var(--line);color:var(--tx);font-size:13px;font-weight:600}
.l-thread .act span{opacity:1}
.l-thread .act i{font-size:17px}
.l-thread .act:hover{background:var(--tx);color:var(--bg);box-shadow:none;transform:none}
.l-thread .save{margin:8px 14px 0;height:48px;border-radius:14px;background:var(--tx);color:var(--bg);box-shadow:none}
.l-thread .save:after{display:none}
.l-thread .sec{margin:10px 14px 0;padding:18px;border-radius:26px;background:var(--bg);box-shadow:0 0 0 1px var(--line)}
.l-thread .sec h3{margin:0 0 12px;color:var(--tx);font-size:13px;font-weight:700;letter-spacing:0;text-transform:none}
.l-thread .sec h3 i{display:none}
.l-thread .sec .box,.l-thread .sec .links a,.l-thread .sec .social a,.l-thread .sec .pays a,.l-thread .sec .post,.l-thread .sec .prod,.l-thread .sec .embed{box-shadow:none;background:transparent}
.l-thread .sec>.box{border:0;padding:0}
.l-thread .box.list{padding:0}
.l-thread .links a{border-radius:16px}
.l-thread .foot{padding-top:26px}
`;
