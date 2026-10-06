/*
 * vCard stylesheet: base components + 24 structural layouts + CSS-only motion.
 * Theme tokens come from render.js (themeOf): --p --s --bg --tx --font --onp --ons --page --muted --card --line --chip --sh
 * Layout class sits on <main class="wrap l-{layout} is-dark|is-light has-av|no-av">.
 */
module.exports = `
*{box-sizing:border-box;margin:0;padding:0}
html{-webkit-text-size-adjust:100%;scroll-behavior:smooth}
body{font-family:var(--font);background:var(--page);color:var(--tx);line-height:1.55;font-size:15px;min-height:100vh;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;text-rendering:optimizeLegibility}
body:before{content:"";position:fixed;inset:0;z-index:-1;pointer-events:none;background:radial-gradient(60% 45% at 8% 0%,color-mix(in srgb,var(--p) 16%,transparent),transparent 70%),radial-gradient(55% 45% at 100% 100%,color-mix(in srgb,var(--s) 14%,transparent),transparent 70%)}
a{color:inherit;text-decoration:none;-webkit-tap-highlight-color:transparent}
img{max-width:100%;display:block}
button{-webkit-tap-highlight-color:transparent}
:focus-visible{outline:2px solid var(--p);outline-offset:3px}
::selection{background:var(--p);color:var(--onp)}

.wrap{--r:22px;--ease:cubic-bezier(.16,1,.3,1);max-width:480px;margin:0 auto;background:var(--bg);min-height:100vh;position:relative;overflow:hidden;isolation:isolate}
@media(min-width:520px){body{padding:40px 16px}.wrap{min-height:auto;border-radius:36px;box-shadow:0 0 0 1px var(--line),0 50px 100px -40px rgba(15,23,42,.45),0 20px 40px -30px rgba(15,23,42,.3)}}

/* ------------------------------------------------------------------ hero (classic = default) */
.hero{position:relative;text-align:center}
.cover{position:relative;height:210px;background:linear-gradient(135deg,var(--p),var(--s));background-size:cover;background-position:center;overflow:hidden}
.cover.g:before{content:"";position:absolute;inset:0;background:radial-gradient(circle at 16% 20%,rgba(255,255,255,.3),transparent 36%),radial-gradient(circle at 86% 6%,rgba(255,255,255,.18),transparent 30%),radial-gradient(circle at 70% 130%,rgba(0,0,0,.22),transparent 55%)}
.cover.g:after{content:"";position:absolute;inset:0;opacity:.22;background-image:radial-gradient(rgba(255,255,255,.95) 1px,transparent 1.3px);background-size:18px 18px;-webkit-mask-image:linear-gradient(135deg,#000,transparent 65%);mask-image:linear-gradient(135deg,#000,transparent 65%)}
.cover video{width:100%;height:100%;object-fit:cover;display:block}
.cover iframe{width:100%;height:100%;border:0;pointer-events:none;transform:scale(1.35)}
.mute{position:absolute;right:12px;bottom:12px;z-index:3;width:38px;height:38px;border-radius:50%;border:0;background:rgba(0,0,0,.45);backdrop-filter:blur(8px);color:#fff;font-size:18px;cursor:pointer;display:grid;place-items:center}
.hero-main{position:relative;z-index:2;padding:0 24px}
.av{position:relative;display:flex;justify-content:center;margin-top:-70px}
.avatar{width:140px;height:140px;border-radius:50%;object-fit:cover;border:5px solid var(--bg);background:var(--bg);box-shadow:0 18px 40px -16px rgba(0,0,0,.45)}
.avatar.ph{display:flex;align-items:center;justify-content:center;font-size:46px;font-weight:700;letter-spacing:-.02em;color:var(--onp);background:linear-gradient(135deg,var(--p),var(--s))}
.id{padding-top:16px}
.name{font-size:28px;font-weight:700;letter-spacing:-.03em;line-height:1.15;display:flex;align-items:center;justify-content:center;gap:6px;flex-wrap:wrap;text-wrap:balance}
.name i{color:var(--p);font-size:.78em;line-height:1}
.role{margin-top:6px;color:var(--muted);font-size:15.5px;font-weight:500;text-wrap:balance}
.meta{display:flex;flex-wrap:wrap;justify-content:center;gap:8px;margin-top:14px}
.company,.loc{display:inline-flex;align-items:center;gap:6px;padding:6px 13px;border-radius:999px;font-size:13px;font-weight:600;line-height:1.3;max-width:100%}
.company{background:var(--chip);color:var(--p)}
.loc{border:1px solid var(--line);color:var(--muted);font-weight:500}

/* ------------------------------------------------------------------ actions + save */
.actions{display:flex;gap:6px;padding:24px 20px 0}
.act{flex:1 1 0;min-width:0;height:72px;padding:0 1px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:5px;border-radius:999px;background:var(--chip);color:var(--p);border:0;cursor:pointer;font:inherit;font-size:10.5px;font-weight:600;letter-spacing:-.01em;transition:transform .3s var(--ease),background .25s,color .25s,box-shadow .3s}
.act i{font-size:22px;line-height:1}
.act span{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--tx);opacity:.75;transition:color .25s,opacity .25s}
.act:hover{transform:translateY(-3px);background:var(--p);color:var(--onp);box-shadow:0 14px 26px -14px var(--p)}
.act:hover span{color:inherit;opacity:1}
.act:active{transform:scale(.94)}
.save{position:relative;overflow:hidden;margin:14px 20px 0;display:flex;align-items:center;justify-content:center;gap:10px;height:56px;border-radius:999px;background:var(--p);color:var(--onp);font-weight:600;font-size:16px;letter-spacing:-.01em;box-shadow:0 18px 34px -16px var(--p);transition:transform .3s var(--ease),box-shadow .3s}
.save i{font-size:20px}
.save:after{content:"";position:absolute;top:0;bottom:0;width:40%;left:-60%;background:linear-gradient(100deg,transparent,rgba(255,255,255,.38),transparent);transform:skewX(-20deg);animation:vc-shine 4s 1.6s ease-in-out infinite;pointer-events:none}
.save:hover{transform:translateY(-2px);box-shadow:0 24px 44px -18px var(--p)}
.save:active{transform:scale(.97)}
.install{margin:10px 20px 0;display:none;align-items:center;justify-content:center;gap:8px;height:48px;border-radius:999px;border:1.5px dashed color-mix(in srgb,var(--p) 60%,transparent);color:var(--p);font-weight:600;background:transparent;cursor:pointer;font-family:inherit;font-size:14px;width:calc(100% - 40px)}

/* ------------------------------------------------------------------ sections */
.sec{padding:30px 20px 0}
.sec h3{display:flex;align-items:center;gap:8px;margin:0 4px 12px;font-size:12px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--muted)}
.sec h3 i{font-size:15px;color:var(--p);letter-spacing:0}
.box{background:var(--card);border-radius:var(--r);padding:20px;border:1px solid var(--line);box-shadow:var(--sh);transition:transform .3s var(--ease),box-shadow .3s,border-color .3s}
.about{font-size:15px;line-height:1.7;opacity:.92}
.box.list{padding:8px;display:flex;flex-direction:column;gap:2px}
.row{display:flex;align-items:center;gap:14px;padding:10px 10px;border-radius:calc(var(--r) - 8px);transition:background .2s}
a.row:hover{background:var(--chip)}
.row>i:not(.go){width:42px;height:42px;flex:none;border-radius:14px;display:grid;place-items:center;background:var(--chip);color:var(--p);font-size:19px}
.row>div{min-width:0;flex:1}
.row small{display:block;color:var(--muted);font-size:12px;font-weight:500}
.row span{display:block;word-break:break-word;font-weight:600;font-size:14.5px}
.row .go{flex:none;color:var(--muted);font-size:18px;transition:transform .25s var(--ease)}
a.row:hover .go{transform:translateX(3px);color:var(--p)}
.social{display:grid;grid-template-columns:repeat(auto-fill,minmax(54px,1fr));gap:10px}
.social a{aspect-ratio:1;border-radius:18px;display:grid;place-items:center;font-size:22px;background:var(--card);border:1px solid var(--line);color:var(--p);box-shadow:var(--sh);transition:transform .3s var(--ease),background .25s,color .25s,box-shadow .3s}
.social a:hover{background:var(--p);color:var(--onp);transform:translateY(-3px);box-shadow:0 14px 26px -14px var(--p)}
.links{display:grid;gap:10px}
.links a{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:15px 16px 15px 20px;border-radius:var(--r);background:var(--card);border:1px solid var(--line);font-weight:600;box-shadow:var(--sh);transition:transform .3s var(--ease),border-color .25s,box-shadow .3s}
.links a i{width:34px;height:34px;flex:none;border-radius:50%;display:grid;place-items:center;background:var(--chip);color:var(--p);transition:transform .3s var(--ease),background .25s,color .25s}
.links a:hover{border-color:color-mix(in srgb,var(--p) 50%,transparent);transform:translateY(-2px)}
.links a:hover i{background:var(--p);color:var(--onp);transform:rotate(45deg)}
.svc{display:grid;gap:0;padding:6px 20px}
.svc .item{display:flex;gap:14px;align-items:flex-start;padding:14px 0}
.svc .item+.item{border-top:1px solid var(--line)}
.svc img,.svc .ic{width:56px;height:56px;border-radius:16px;object-fit:cover;flex:none}
.svc .ic{display:grid;place-items:center;background:var(--chip);color:var(--p);font-size:22px}
.svc b{display:block;margin-bottom:2px;font-size:15.5px;letter-spacing:-.01em}
.svc p{color:var(--muted);font-size:14px}
.svc .more{font-size:13px;color:var(--p);font-weight:600;margin-top:6px;margin-inline-end:10px;display:inline-block}
.gal{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
.gal a{display:block;border-radius:14px;overflow:hidden;position:relative}
.gal img{aspect-ratio:1;object-fit:cover;width:100%;transition:transform .5s var(--ease)}
.gal a:hover img{transform:scale(1.07)}
.gal .vid:after{content:"\\25B6";position:absolute;inset:0;display:grid;place-items:center;color:#fff;font-size:20px;background:rgba(0,0,0,.28)}
.chips{display:flex;gap:6px;overflow-x:auto;margin-bottom:12px;scrollbar-width:none}
.chips::-webkit-scrollbar{display:none}
.chips button{flex:none;padding:7px 15px;border-radius:999px;border:1px solid var(--line);background:var(--card);color:var(--tx);font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;transition:all .2s}
.chips button.on{background:var(--p);color:var(--onp);border-color:var(--p)}
.tst{display:grid;gap:12px}
.tst .box{position:relative;padding-top:26px}
.tst .box:before{content:"\\201C";position:absolute;top:-6px;inset-inline-end:18px;font-size:90px;line-height:1;font-family:Georgia,serif;color:var(--p);opacity:.14}
.tst .q{font-size:15px;line-height:1.65}
.tst .who{display:flex;align-items:center;gap:10px;margin-top:14px;font-weight:700;font-size:14px}
.tst .who img{width:38px;height:38px;border-radius:50%;object-fit:cover}
.tst .who:before{content:"";width:18px;height:2px;background:var(--p);border-radius:2px}
.tst .who:has(img):before{display:none}
.hours{padding:10px 20px}
.hours .d{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:10px 0;font-size:14px}
.hours .d+.d{border-top:1px solid var(--line)}
.hours .d span:last-child{font-variant-numeric:tabular-nums;color:var(--muted)}
.hours .d.today{color:var(--p);font-weight:700}
.hours .d.today span:first-child:after{content:"";display:inline-block;width:7px;height:7px;border-radius:50%;background:var(--p);margin-inline-start:8px;vertical-align:middle;box-shadow:0 0 0 4px var(--chip)}
.hours .d.today span:last-child{color:var(--p)}
.qr{display:flex;align-items:center;gap:18px}
.qr img{width:120px;height:120px;border-radius:16px;background:#fff;padding:8px;flex:none;box-shadow:0 0 0 1px var(--line)}
.qr p{color:var(--muted);font-size:14px}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:12px 20px;border-radius:999px;background:var(--p);color:var(--onp);font-weight:600;border:0;cursor:pointer;font-family:inherit;font-size:14px;transition:transform .25s var(--ease),box-shadow .25s,opacity .2s}
.btn:hover{transform:translateY(-1px);box-shadow:0 12px 24px -12px var(--p)}
.btn:active{transform:scale(.97)}
.btn:disabled{opacity:.6;cursor:wait}
form.enq{display:grid;gap:10px}
form.enq .btn{width:100%;height:50px;margin-top:4px}
form.enq input,form.enq textarea,form.enq select,.modal input,.appt input,.appt textarea{width:100%;padding:13px 16px;border-radius:14px;border:1px solid var(--line);background:color-mix(in srgb,var(--bg) 70%,var(--card));color:var(--tx);font-family:inherit;font-size:15px;transition:border-color .2s,box-shadow .2s}
form.enq textarea{resize:vertical;min-height:96px}
form.enq input::placeholder,form.enq textarea::placeholder,.modal input::placeholder{color:var(--muted)}
form.enq input:focus,form.enq textarea:focus,form.enq select:focus,.modal input:focus{outline:0;border-color:var(--p);box-shadow:0 0 0 4px var(--chip)}
form.enq label{font-size:13px;color:var(--muted)}
.msg{font-size:14px;margin-top:4px;color:var(--p);font-weight:500}
.prods{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.prod{background:var(--card);border:1px solid var(--line);border-radius:var(--r);overflow:hidden;display:flex;flex-direction:column;box-shadow:var(--sh);transition:transform .3s var(--ease),box-shadow .3s}
.prod:hover{transform:translateY(-3px)}
.prod .img{aspect-ratio:1;background:var(--chip);position:relative;overflow:hidden}
.prod .img img{width:100%;height:100%;object-fit:cover;transition:transform .5s var(--ease)}
.prod:hover .img img{transform:scale(1.06)}
.prod .dots{position:absolute;bottom:8px;left:0;right:0;display:flex;gap:4px;justify-content:center}
.prod .dots span{width:6px;height:6px;border-radius:50%;background:rgba(255,255,255,.7)}
.prod .body{padding:12px 12px 12px;display:flex;flex-direction:column;gap:4px;flex:1}
.prod b{font-size:14px;line-height:1.3}
.prod .price{color:var(--p);font-weight:700;font-size:14.5px}
.prod .out{font-size:11px;color:#dc2626;font-weight:600}
.prod .row2{display:flex;gap:6px;margin-top:auto;padding-top:8px}
.prod .row2 a,.prod .row2 button{flex:1;text-align:center;padding:9px 6px;border-radius:999px;font-size:12px;font-weight:600;border:1px solid var(--line);background:var(--bg);color:var(--tx);cursor:pointer;font-family:inherit}
.prod .row2 .pri{background:var(--p);color:var(--onp);border-color:var(--p)}
.embed{border-radius:var(--r);overflow:hidden;border:1px solid var(--line);background:var(--card);box-shadow:var(--sh)}
.embed iframe{width:100%;border:0;display:block}
.pays{display:grid;gap:10px}
.pays a{display:flex;align-items:center;gap:12px;padding:12px 16px 12px 12px;border-radius:var(--r);background:var(--card);border:1px solid var(--line);font-weight:600;box-shadow:var(--sh);transition:transform .3s var(--ease),border-color .25s}
.pays a:hover{transform:translateY(-2px);border-color:color-mix(in srgb,var(--p) 50%,transparent)}
.pays a i{width:40px;height:40px;border-radius:14px;display:grid;place-items:center;background:var(--chip);color:var(--p);font-size:19px}
.posts{display:grid;gap:12px}
.post{display:flex;gap:14px;align-items:center;background:var(--card);border:1px solid var(--line);border-radius:var(--r);padding:10px;box-shadow:var(--sh);transition:transform .3s var(--ease)}
.post:hover{transform:translateY(-2px)}
.post img{width:76px;height:76px;border-radius:calc(var(--r) - 8px);object-fit:cover;flex:none}
.post b{display:block;font-size:14.5px;line-height:1.35}
.post small{color:var(--muted);font-size:12px}
.appt .price{font-size:13px;color:var(--muted);margin-bottom:10px;display:flex;align-items:center;gap:6px}
.appt .days{display:flex;gap:8px;overflow-x:auto;padding-bottom:6px;scrollbar-width:none}
.appt .days::-webkit-scrollbar{display:none}
.appt .day{flex:none;width:60px;padding:10px 0;border-radius:18px;border:1px solid var(--line);background:var(--bg);text-align:center;cursor:pointer;font-family:inherit;color:var(--tx);transition:all .2s}
.appt .day small{display:block;font-size:11px;color:var(--muted)}
.appt .day b{font-size:18px}
.appt .day.on{background:var(--p);color:var(--onp);border-color:var(--p)}.appt .day.on small{color:inherit;opacity:.8}
.appt .day:disabled{opacity:.35;cursor:not-allowed}
.appt .slots{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0}
.appt .slot{padding:9px 14px;border-radius:999px;border:1px solid var(--line);background:var(--bg);font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;color:var(--tx)}
.appt .slot.on{background:var(--p);color:var(--onp);border-color:var(--p)}

/* ------------------------------------------------------------------ chrome */
.foot{text-align:center;padding:36px 20px 40px;color:var(--muted);font-size:12px}
.foot a{color:var(--p);font-weight:600}
.legal{display:flex;flex-wrap:wrap;gap:6px 16px;justify-content:center;margin-bottom:10px}
.legal a{color:var(--muted);font-weight:500}
.legal a:hover{color:var(--p)}
.sticky{position:fixed;left:50%;bottom:14px;transform:translateX(-50%);z-index:20;display:flex;gap:6px;padding:6px;border-radius:999px;background:color-mix(in srgb,var(--bg) 78%,transparent);backdrop-filter:blur(16px) saturate(1.4);-webkit-backdrop-filter:blur(16px) saturate(1.4);box-shadow:0 16px 40px -12px rgba(0,0,0,.4);border:1px solid var(--line);animation:vc-bar .7s 1s var(--ease,ease) both}
.sticky a,.sticky button{width:46px;height:46px;border-radius:50%;display:grid;place-items:center;font-size:20px;background:var(--chip);color:var(--p);border:0;cursor:pointer;transition:transform .25s}
.sticky a:hover,.sticky button:hover{transform:translateY(-2px)}
.sticky .main{background:var(--p);color:var(--onp);width:54px}
.toast{position:fixed;left:50%;bottom:24px;transform:translateX(-50%) translateY(140px);background:#111827;color:#fff;padding:11px 20px;border-radius:999px;font-size:14px;font-weight:500;transition:transform .35s cubic-bezier(.16,1,.3,1);z-index:60;box-shadow:0 12px 30px -10px rgba(0,0,0,.5)}
.toast.show{transform:translateX(-50%) translateY(0)}
.lb{position:fixed;inset:0;background:rgba(5,6,10,.92);backdrop-filter:blur(6px);z-index:50;display:none;align-items:center;justify-content:center;padding:20px}
.lb.show{display:flex;animation:vc-fade .25s ease}
.lb img{max-height:85vh;border-radius:14px}
.lb iframe{width:min(900px,95vw);aspect-ratio:16/9;border:0;border-radius:14px}
.lb .x{position:absolute;top:14px;right:14px;width:42px;height:42px;border-radius:50%;border:0;background:rgba(255,255,255,.15);color:#fff;font-size:22px;cursor:pointer}
.modal{position:fixed;inset:0;z-index:40;background:rgba(5,6,10,.55);backdrop-filter:blur(4px);display:none;align-items:flex-end;justify-content:center}
.modal.show{display:flex}
.modal .sheet{width:100%;max-width:480px;background:var(--bg);color:var(--tx);border-radius:28px 28px 0 0;padding:14px 22px 26px;animation:sheet .45s cubic-bezier(.16,1,.3,1)}
.modal .sheet:before{content:"";display:block;width:40px;height:4px;border-radius:4px;background:var(--line);margin:0 auto 16px}
.modal h4{font-size:19px;margin-bottom:4px;letter-spacing:-.01em}.modal p{color:var(--muted);font-size:14px;margin-bottom:16px}
.modal form{display:grid;gap:10px}
.modal .btn{height:50px}
.page-body{padding:24px 22px}
.page-body h1{font-size:28px;margin:14px 0 14px;letter-spacing:-.03em;line-height:1.2}
.page-body .content{line-height:1.75}
.page-body .content h2,.page-body .content h3{margin:1.2em 0 .5em;letter-spacing:-.01em}
.page-body .content p,.page-body .content ul,.page-body .content ol{margin:0 0 1em}
.page-body .content ul{padding-inline-start:1.3em;list-style:disc}.page-body .content ol{padding-inline-start:1.3em}
.page-body .content a{color:var(--p);text-decoration:underline}
.page-body .content img{border-radius:14px;margin:10px 0}
.page-body .content blockquote{border-inline-start:3px solid var(--p);padding-inline-start:14px;color:var(--muted);margin:0 0 1em}
.backlink{display:inline-flex;align-items:center;gap:6px;padding:8px 14px 8px 10px;border-radius:999px;background:var(--chip);color:var(--p);font-weight:600;font-size:14px}
/* very dark primary on a dark background: lift accent text/icons so they stay readable */
.lowp .company,.lowp .row>i:not(.go),.lowp .social a:not(:hover),.lowp .links a i,.lowp .pays a i,.lowp .sec h3 i,.lowp .act:not(:hover),.lowp .svc .ic,.lowp .svc .more,.lowp .name i,.lowp .foot a,.lowp .prod .price{color:color-mix(in srgb,var(--p) 40%,var(--tx))}
[dir=rtl] .links a i,[dir=rtl] .row .go,[dir=rtl] .backlink i{transform:scaleX(-1)}

/* ================================================================== LAYOUTS */

/* modern: curved cover, squircle avatar aligned to the start edge */
.l-modern .cover{height:240px;border-radius:0 0 42px 42px}
.l-modern .hero,.l-modern .name{text-align:start;justify-content:flex-start}
.l-modern .av{justify-content:flex-start;margin-top:-58px}
.l-modern .avatar{width:116px;height:116px;border-radius:34px;border-width:4px}
.l-modern .meta{justify-content:flex-start}
.l-modern .name{font-size:30px}
.l-modern .actions{padding-top:22px}
.l-modern .act{border-radius:22px}

/* minimal: no cover, airy, outline controls */
.l-minimal{--r:18px}
.l-minimal .cover{display:none}
.l-minimal .hero{padding-top:60px}
.l-minimal .av{margin:0}
.l-minimal .avatar{width:112px;height:112px;border:0;box-shadow:0 0 0 1px var(--line),0 0 0 8px color-mix(in srgb,var(--line) 40%,transparent)}
.l-minimal .id{padding-top:22px}
.l-minimal .name{font-size:32px;font-weight:600;letter-spacing:-.035em}
.l-minimal .company{background:transparent;color:var(--tx);border:1px solid var(--line)}
.l-minimal .act{background:transparent;border:1px solid var(--line);color:var(--tx)}
.l-minimal .act:hover{background:var(--tx);color:var(--bg);box-shadow:none}
.l-minimal .save{background:var(--tx);color:var(--bg);box-shadow:none}
.l-minimal .save:after{display:none}
.l-minimal .sec{padding-top:36px}
.l-minimal .sec h3{font-weight:600;letter-spacing:.2em}
.l-minimal .sec h3 i{display:none}
.l-minimal .box{background:transparent;box-shadow:none;border-width:1px 0 0;border-radius:0;padding:18px 4px 0}
.l-minimal .box.list{padding:6px 0 0}
.l-minimal .row>i:not(.go){background:transparent;border:1px solid var(--line);color:var(--tx);border-radius:50%}
.l-minimal .svc{padding:0 4px}
.l-minimal .hours{padding:4px 4px 0}
.l-minimal .social a,.l-minimal .links a,.l-minimal .pays a,.l-minimal .post,.l-minimal .prod,.l-minimal .embed{box-shadow:none}
.l-minimal .social a{border-radius:50%;background:transparent;color:var(--tx)}
.l-minimal .social a:hover{background:var(--tx);color:var(--bg)}

/* dark: glowing header fading into the page */
.l-dark .cover{height:250px;-webkit-mask-image:linear-gradient(#000 45%,transparent);mask-image:linear-gradient(#000 45%,transparent)}
.l-dark .av{margin-top:-104px}
.l-dark .avatar{border:3px solid var(--p);box-shadow:0 0 0 7px color-mix(in srgb,var(--p) 14%,transparent),0 0 60px -6px var(--p)}
.l-dark .act{background:color-mix(in srgb,var(--tx) 6%,transparent);border:1px solid var(--line)}
.l-dark .save{background:linear-gradient(120deg,var(--p),color-mix(in srgb,var(--p) 55%,var(--s)))}
.l-dark .box,.l-dark .links a,.l-dark .social a{background:color-mix(in srgb,var(--tx) 4%,transparent)}
.l-dark .sec h3 i{text-shadow:0 0 12px var(--p)}

/* card: floating inset cover */
.l-card{--r:24px}
.l-card .cover{height:220px;margin:12px 12px 0;border-radius:28px;box-shadow:0 24px 40px -22px var(--p)}
.l-card .avatar{border-radius:38px;width:132px;height:132px}
.l-card .av{margin-top:-66px}
.l-card .box,.l-card .links a,.l-card .social a{border-color:transparent;box-shadow:0 2px 4px rgba(15,23,42,.03),0 18px 40px -20px rgba(15,23,42,.22)}
.l-card .act{border-radius:24px}

/* split: inset cover, start-aligned identity, two-column pill actions */
.l-split .cover{height:170px;margin:16px 16px 0;border-radius:26px}
.l-split .hero,.l-split .name{text-align:start;justify-content:flex-start}
.l-split .hero-main{padding:0 20px}
.l-split .av{justify-content:flex-start;margin:-52px 0 0 22px}
.l-split .avatar{width:104px;height:104px;border-radius:28px;border-width:4px}
.l-split .meta{justify-content:flex-start}
.l-split .actions{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.l-split .act{flex-direction:row;height:52px;gap:8px;font-size:13.5px;justify-content:flex-start;padding:0 18px}
.l-split .act i{font-size:19px}
.l-split .act:last-child:nth-child(odd){grid-column:span 2;justify-content:center}
[dir=rtl] .l-split .av{margin:-52px 22px 0 0}

/* bold: full-bleed header with the identity overlaid on a gradient fade */
.l-bold .cover{height:460px}
.l-bold .cover:after{content:"";position:absolute;inset:0;opacity:1;background:linear-gradient(180deg,transparent 30%,rgba(0,0,0,.25) 55%,rgba(0,0,0,.85));-webkit-mask-image:none;mask-image:none}
.l-bold .hero-main{position:absolute;left:0;right:0;bottom:0;padding:0 24px 28px;text-align:start;color:#fff}
.l-bold .av{margin:0 0 16px;justify-content:flex-start}
.l-bold .avatar{width:80px;height:80px;border:3px solid rgba(255,255,255,.9);box-shadow:0 10px 30px -10px rgba(0,0,0,.6)}
.l-bold .avatar.ph{font-size:28px}
.l-bold .name{justify-content:flex-start;font-size:38px;font-weight:800;letter-spacing:-.04em;line-height:1.05;color:#fff}
.l-bold .name i{color:#fff}
.l-bold .role{color:rgba(255,255,255,.82);font-size:16px}
.l-bold .meta{justify-content:flex-start}
.l-bold .company{background:rgba(255,255,255,.18);color:#fff;backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px)}
.l-bold .loc{border-color:rgba(255,255,255,.3);color:rgba(255,255,255,.85)}
.l-bold .actions{margin-top:-2px}
.l-bold .act{border-radius:20px}
.l-bold .sec h3{font-size:20px;letter-spacing:-.02em;text-transform:none;color:var(--tx);font-weight:800}

/* elegant: serif rhythm, framed portrait, ornament rules */
.l-elegant{--r:6px;font-size:16px}
.l-elegant .cover{height:160px}
.l-elegant .av{margin-top:-74px}
.l-elegant .avatar{border:1px solid var(--s);padding:6px;box-shadow:0 0 0 6px var(--bg),0 20px 40px -20px rgba(0,0,0,.4)}
.l-elegant .name{font-size:32px;font-weight:600;letter-spacing:-.01em}
.l-elegant .role{text-transform:uppercase;letter-spacing:.24em;font-size:11.5px;font-weight:600;color:var(--s);margin-top:10px}
.l-elegant .company{background:transparent;color:var(--tx);border-top:1px solid var(--line);border-bottom:1px solid var(--line);border-radius:0;padding:6px 4px}
.l-elegant .loc{border:0}
.l-elegant .act{border-radius:999px;background:transparent;border:1px solid color-mix(in srgb,var(--s) 60%,transparent);color:var(--p)}
.l-elegant .save{border-radius:4px;letter-spacing:.14em;text-transform:uppercase;font-size:13px}
.l-elegant .sec h3{justify-content:center;color:var(--s);letter-spacing:.3em;font-size:11px}
.l-elegant .sec h3 i{display:none}
.l-elegant .sec h3:before,.l-elegant .sec h3:after{content:"";flex:0 1 48px;height:1px;background:linear-gradient(90deg,transparent,var(--s))}
.l-elegant .sec h3:after{background:linear-gradient(90deg,var(--s),transparent)}
.l-elegant .box{box-shadow:none}
.l-elegant .row>i:not(.go),.l-elegant .social a,.l-elegant .links a i{border-radius:50%}
.l-elegant .social a{box-shadow:none;border-radius:50%}
.l-elegant .links a{box-shadow:none}

/* soft: pillowy, round, shadow-only surfaces */
.l-soft{--r:28px}
.l-soft .cover{height:190px;border-radius:0 0 50% 50%/0 0 44px 44px}
.l-soft .box,.l-soft .links a,.l-soft .social a,.l-soft .pays a,.l-soft .post,.l-soft .prod,.l-soft .embed{border-color:transparent;box-shadow:0 2px 6px rgba(15,23,42,.03),0 20px 40px -22px color-mix(in srgb,var(--p) 45%,rgba(15,23,42,.25))}
.l-soft .actions{gap:4px}
.l-soft .act{background:transparent;height:auto;gap:8px}
.l-soft .act i{width:58px;height:58px;border-radius:50%;display:grid;place-items:center;background:var(--chip);transition:transform .3s var(--ease),background .25s,color .25s,box-shadow .3s}
.l-soft .act:hover{background:transparent;box-shadow:none;color:var(--p)}
.l-soft .act:hover i{background:var(--p);color:var(--onp);transform:translateY(-3px);box-shadow:0 14px 24px -12px var(--p)}
.l-soft .act:hover span{color:var(--tx)}
.l-soft .social a{border-radius:50%}
.l-soft .row>i:not(.go){border-radius:50%}

/* corporate: solid band, structured, start-aligned */
.l-corporate{--r:14px}
.l-corporate .cover.g{background:linear-gradient(115deg,var(--p) 0 68%,color-mix(in srgb,var(--p) 80%,var(--s)) 68% 76%,var(--s) 76%)}
.l-corporate .cover{height:140px}
.l-corporate .cover.g:after{display:none}
.l-corporate .hero,.l-corporate .name{text-align:start;justify-content:flex-start}
.l-corporate .av{justify-content:flex-start;margin-top:-62px}
.l-corporate .avatar{border-radius:20px;width:124px;height:124px;border-width:4px}
.l-corporate .meta{justify-content:flex-start}
.l-corporate .company{background:var(--s);color:var(--ons);border-radius:8px}
.l-corporate .loc{border-radius:8px}
.l-corporate .act{border-radius:14px}
.l-corporate .save{border-radius:14px}
.l-corporate .sec h3{color:var(--tx);letter-spacing:.08em}
.l-corporate .sec h3:before{content:"";width:4px;height:16px;border-radius:2px;background:var(--p)}
.l-corporate .sec h3 i{display:none}

/* photo: full-bleed portrait header that fades into the page */
.l-photo.has-av .cover{display:none}
.l-photo.has-av .hero-main{padding:0}
.l-photo.has-av .av{margin:0;display:block}
.l-photo.has-av .avatar{width:100%;height:auto;aspect-ratio:4/5;max-height:560px;border:0;border-radius:0;box-shadow:none;object-position:center 25%;animation:vc-zoom 1.1s var(--ease) both}
.l-photo.has-av .av:after{content:"";position:absolute;left:0;right:0;bottom:-2px;height:64%;background:linear-gradient(to bottom,transparent,color-mix(in srgb,var(--bg) 70%,transparent) 55%,var(--bg))}
.l-photo.has-av .id{position:relative;z-index:3;margin-top:-132px;padding:0 24px}
.l-photo .name{font-size:36px;font-weight:800;letter-spacing:-.04em;line-height:1.05}
.l-photo .act{border-radius:20px}
.l-photo.no-av .cover{height:300px}

/* glass: frosted panels floating over colour blobs */
.l-glass{--r:24px;--gl:color-mix(in srgb,var(--tx) 8%,transparent);--gb:color-mix(in srgb,var(--tx) 16%,transparent);background:radial-gradient(70% 40% at 0% 0%,color-mix(in srgb,var(--p) 55%,transparent),transparent 70%),radial-gradient(60% 35% at 100% 30%,color-mix(in srgb,var(--s) 50%,transparent),transparent 70%),radial-gradient(70% 40% at 20% 85%,color-mix(in srgb,var(--p) 35%,transparent),transparent 70%),var(--bg)}
.l-glass:before{content:"";position:absolute;z-index:-1;width:260px;height:260px;border-radius:50%;top:360px;right:-80px;background:var(--s);filter:blur(70px);opacity:.45;animation:vc-float 14s ease-in-out infinite alternate}
.l-glass .cover{height:200px;margin:14px 14px 0;border-radius:28px;opacity:.9}
.l-glass .hero-main{margin:-64px 16px 0;padding:0 20px 24px;background:var(--gl);border:1px solid var(--gb);border-radius:30px;backdrop-filter:blur(22px) saturate(1.5);-webkit-backdrop-filter:blur(22px) saturate(1.5);box-shadow:0 30px 60px -30px rgba(0,0,0,.6)}
.l-glass .av{margin-top:-58px}
.l-glass .avatar{border:3px solid var(--gb);background:transparent}
.l-glass .box,.l-glass .links a,.l-glass .social a,.l-glass .pays a,.l-glass .post,.l-glass .prod,.l-glass .embed,.l-glass .act,.l-glass .chips button{background:var(--gl);border:1px solid var(--gb);backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);box-shadow:none}
.l-glass .act{color:var(--tx)}
.l-glass .act:hover{background:var(--p);color:var(--onp)}
.l-glass .company{background:color-mix(in srgb,var(--p) 25%,transparent);color:var(--tx)}
.l-glass .row>i:not(.go),.l-glass .links a i,.l-glass .pays a i{background:color-mix(in srgb,var(--p) 25%,transparent);color:var(--tx)}
.l-glass .save{background:linear-gradient(120deg,var(--p),var(--s));color:var(--onp)}
.l-glass .sec h3 i{color:var(--tx)}

/* sidebar: vertical accent rail, start-aligned editorial header */
.l-sidebar{--r:14px;padding-inline-start:10px}
.l-sidebar:before{content:"";position:absolute;top:0;bottom:0;inset-inline-start:0;width:10px;background:linear-gradient(var(--p),var(--s))}
.l-sidebar .cover{display:none}
.l-sidebar .hero{text-align:start;padding:44px 0 0}
.l-sidebar .hero-main{display:flex;gap:18px;align-items:center;padding:0 22px}
.l-sidebar .av{margin:0;flex:none}
.l-sidebar .avatar{width:96px;height:96px;border-radius:28px;border:0;box-shadow:0 18px 30px -16px var(--p)}
.l-sidebar .avatar.ph{font-size:32px}
.l-sidebar .id{padding:0;min-width:0}
.l-sidebar .name{justify-content:flex-start;font-size:26px}
.l-sidebar .role{font-size:14.5px}
.l-sidebar .meta{justify-content:flex-start;margin-top:10px}
.l-sidebar .actions{padding-top:28px}
.l-sidebar .act{border-radius:16px}
.l-sidebar .save{border-radius:16px}
.l-sidebar .sec h3{color:var(--tx)}
.l-sidebar .sec h3 i{width:26px;height:26px;border-radius:8px;display:grid;place-items:center;background:var(--p);color:var(--onp);font-size:13px}
.l-sidebar .box{border-inline-start:3px solid var(--p)}

/* editorial: magazine masthead, oversized serif name, numbered sections */
.l-editorial{--r:4px;counter-reset:sec;font-size:16px}
.l-editorial .cover{display:none}
.l-editorial .hero{text-align:start;padding:34px 0 0}
.l-editorial .hero-main{display:flex;flex-direction:column;padding:0 24px}
.l-editorial .id{order:1;padding:0}
.l-editorial .av{order:2;margin:22px 0 0;display:block}
.l-editorial .avatar{width:100%;height:auto;aspect-ratio:1/1.05;border-radius:4px;border:0;box-shadow:none;object-position:center 20%;animation:vc-zoom 1.1s .1s var(--ease) both}
.l-editorial .avatar.ph{aspect-ratio:16/9;font-size:64px}
.l-editorial .id-text{display:flex;flex-direction:column}
.l-editorial .meta{order:-1;margin:0 0 22px;padding:10px 0;border-top:2px solid var(--tx);border-bottom:1px solid var(--tx);justify-content:space-between;gap:4px}
.l-editorial .company,.l-editorial .loc{padding:0;background:none;border:0;border-radius:0;color:var(--tx);text-transform:uppercase;letter-spacing:.18em;font-size:10.5px;font-weight:700}
.l-editorial .company i,.l-editorial .loc i{display:none}
.l-editorial .name{justify-content:flex-start;font-size:46px;font-weight:600;letter-spacing:-.045em;line-height:.98}
.l-editorial .role{font-style:italic;font-size:18px;margin-top:12px;color:var(--p)}
.l-editorial .act{border-radius:4px;background:transparent;border:1px solid var(--tx);color:var(--tx)}
.l-editorial .act:hover{background:var(--tx);color:var(--bg);box-shadow:none}
.l-editorial .save{border-radius:4px;background:var(--p);text-transform:uppercase;letter-spacing:.16em;font-size:13px;box-shadow:none}
.l-editorial .sec{padding-top:40px}
.l-editorial .sec h3{margin:0 0 16px;padding-top:12px;border-top:1px solid var(--tx);color:var(--tx);font-size:12px;letter-spacing:.2em}
.l-editorial .sec h3 i{display:none}
.l-editorial .sec h3:before{counter-increment:sec;content:counter(sec,decimal-leading-zero);font-size:26px;letter-spacing:-.02em;color:var(--p);margin-inline-end:6px;font-weight:600}
.l-editorial .box{background:transparent;border:0;box-shadow:none;padding:0}
.l-editorial .box.list{padding:0}
.l-editorial .about:first-letter{float:left;float:inline-start;font-size:3.6em;line-height:.85;margin:.06em .1em 0 0;color:var(--p);font-weight:600}
.l-editorial .svc{padding:0}
.l-editorial .hours{padding:0}
.l-editorial .row>i:not(.go){border-radius:4px}
.l-editorial .social a,.l-editorial .links a,.l-editorial .pays a,.l-editorial .post{box-shadow:none;border-color:var(--tx)}
.l-editorial .links a i{border-radius:4px}

/* brutal: thick outlines, hard offset shadows */
.l-brutal{--r:14px;--bd:2.5px solid var(--tx);--hs:5px 5px 0 var(--tx)}
.l-brutal .cover{height:170px;border-bottom:var(--bd)}
.l-brutal .cover.g{background:var(--p)}
.l-brutal .cover.g:before{background:repeating-linear-gradient(-45deg,transparent 0 18px,color-mix(in srgb,var(--onp) 14%,transparent) 18px 20px)}
.l-brutal .cover.g:after{opacity:1;background-image:radial-gradient(circle,var(--s) 0 36px,transparent 37px),radial-gradient(circle,var(--tx) 0 3px,transparent 3.5px);background-size:auto,16px 16px;background-position:88% 30%,0 0;background-repeat:no-repeat,repeat;-webkit-mask-image:none;mask-image:none;opacity:.9}
.l-brutal .hero,.l-brutal .name{text-align:start;justify-content:flex-start}
.l-brutal .av{justify-content:flex-start;margin-top:-58px}
.l-brutal .avatar{width:118px;height:118px;border-radius:18px;border:var(--bd);box-shadow:6px 6px 0 var(--tx);transform:rotate(-3deg);animation:vc-drop .8s .12s var(--ease) both}
.l-brutal .name{font-size:34px;font-weight:800;letter-spacing:-.04em;text-transform:uppercase;line-height:1}
.l-brutal .role{color:var(--tx);font-weight:600}
.l-brutal .meta{justify-content:flex-start}
.l-brutal .company,.l-brutal .loc{border:var(--bd);border-radius:8px;background:var(--s);color:var(--ons);box-shadow:3px 3px 0 var(--tx)}
.l-brutal .loc{background:var(--bg);color:var(--tx)}
.l-brutal .act{border-radius:12px;background:var(--bg);border:var(--bd);box-shadow:var(--hs);color:var(--tx)}
.l-brutal .act span{opacity:1}
.l-brutal .act:hover{transform:translate(-2px,-2px);box-shadow:7px 7px 0 var(--tx);background:var(--p);color:var(--onp)}
.l-brutal .act:active,.l-brutal .save:active{transform:translate(4px,4px);box-shadow:1px 1px 0 var(--tx)}
.l-brutal .save{border-radius:14px;border:var(--bd);box-shadow:var(--hs);text-transform:uppercase;letter-spacing:.06em;font-weight:800}
.l-brutal .save:hover{transform:translate(-2px,-2px);box-shadow:7px 7px 0 var(--tx)}
.l-brutal .save:after{display:none}
.l-brutal .sec h3{display:inline-flex;background:var(--tx);color:var(--bg);padding:6px 12px;border-radius:8px;transform:rotate(-1.5deg);margin-inline-start:2px}
.l-brutal .sec h3 i{color:var(--s)}
.l-brutal .box,.l-brutal .links a,.l-brutal .social a,.l-brutal .pays a,.l-brutal .post,.l-brutal .prod,.l-brutal .embed{border:var(--bd);box-shadow:var(--hs)}
.l-brutal .links a:hover,.l-brutal .social a:hover,.l-brutal .pays a:hover{transform:translate(-2px,-2px);box-shadow:7px 7px 0 var(--tx)}
.l-brutal .row>i:not(.go),.l-brutal .links a i,.l-brutal .pays a i{border:2px solid var(--tx);border-radius:10px}
@media(min-width:520px){.l-brutal.wrap{box-shadow:10px 10px 0 var(--tx);border:3px solid var(--tx)}}

/* mesh: animated gradient mesh with an overlapping identity card */
.l-mesh{--r:24px}
.l-mesh .cover{height:300px}
.l-mesh .cover.g{background:radial-gradient(at 18% 22%,var(--p) 0,transparent 55%),radial-gradient(at 82% 12%,var(--s) 0,transparent 50%),radial-gradient(at 72% 82%,color-mix(in srgb,var(--p) 55%,#fff) 0,transparent 55%),radial-gradient(at 12% 92%,color-mix(in srgb,var(--s) 65%,#000) 0,transparent 50%),color-mix(in srgb,var(--p) 70%,var(--s));background-size:180% 180%;animation:vc-cover .9s var(--ease) both,vc-mesh 16s ease-in-out infinite alternate}
.l-mesh .cover.g:after{display:none}
.l-mesh .cover.g:before{background:radial-gradient(circle at 50% 50%,rgba(255,255,255,.18),transparent 60%);mix-blend-mode:overlay}
.l-mesh .hero-main{margin:-100px 16px 0;padding:0 20px 24px;background:var(--card);border-radius:32px;box-shadow:0 30px 60px -30px rgba(15,23,42,.35),0 0 0 1px var(--line)}
.l-mesh .av{margin-top:-60px}
.l-mesh .avatar{width:124px;height:124px;border-color:var(--card)}
.l-mesh .actions{padding-top:20px}
.l-mesh .act{border-radius:22px}
.l-mesh .save{background:linear-gradient(120deg,var(--p),var(--s));color:var(--onp)}

/* mono: monochrome, hairlines, terminal hints */
.l-mono{--r:10px}
.l-mono .cover{display:none}
.l-mono .hero{text-align:start;padding:44px 0 0}
.l-mono .hero-main{padding:0 24px}
.l-mono .av{justify-content:flex-start;margin:0 0 22px}
.l-mono .avatar{width:84px;height:84px;border-radius:14px;border:1px solid var(--line);filter:grayscale(1) contrast(1.05);transition:filter .5s}
.l-mono .avatar:hover{filter:none}
.l-mono .avatar.ph{background:var(--tx);color:var(--bg);font-size:28px}
.l-mono .id{padding:0}
.l-mono .name{justify-content:flex-start;font-size:30px;letter-spacing:-.04em}
.l-mono .name i{color:var(--p)}
.l-mono .role{color:var(--muted)}
.l-mono .role:before{content:"> ";color:var(--p)}
.l-mono .meta{justify-content:flex-start}
.l-mono .company,.l-mono .loc{padding:4px 10px;border-radius:6px;background:transparent;border:1px solid var(--line);color:var(--tx);font-weight:500}
.l-mono .company i{display:none}
.l-mono .company:before{content:"@";color:var(--p)}
.l-mono .act{font-size:10px;letter-spacing:-.03em;border-radius:10px;background:transparent;border:1px solid var(--line);color:var(--tx)}
.l-mono .act:hover{background:var(--tx);color:var(--bg);box-shadow:none}
.l-mono .save{border-radius:10px;background:var(--tx);color:var(--bg);box-shadow:none}
.l-mono .save:after{display:none}
.l-mono .sec h3{text-transform:none;letter-spacing:0;font-size:13px;color:var(--p);font-weight:600}
.l-mono .sec h3 i{display:none}
.l-mono .sec h3:before{content:"//";color:var(--muted)}
.l-mono .box,.l-mono .links a,.l-mono .social a,.l-mono .pays a,.l-mono .post,.l-mono .prod,.l-mono .embed{box-shadow:none;border-style:dashed}
.l-mono .row>i:not(.go),.l-mono .links a i,.l-mono .pays a i{background:transparent;border:1px solid var(--line);color:var(--tx);border-radius:8px}
.l-mono .social a{color:var(--tx)}
.l-mono .social a:hover,.l-mono .links a:hover i{background:var(--tx);color:var(--bg)}

/* luxe: noir, gold hairlines, serif, framed */
.l-luxe{--r:18px;font-size:16px}
.l-luxe:after{content:"";position:absolute;inset:10px;border:1px solid color-mix(in srgb,var(--p) 35%,transparent);border-radius:28px;pointer-events:none;z-index:5}
.l-luxe .cover{height:210px}
.l-luxe .cover.g{background:radial-gradient(80% 90% at 50% 0%,color-mix(in srgb,var(--p) 45%,transparent),transparent 70%),repeating-linear-gradient(135deg,color-mix(in srgb,var(--p) 12%,transparent) 0 1px,transparent 1px 12px),var(--bg)}
.l-luxe .cover.g:before,.l-luxe .cover.g:after{display:none}
.l-luxe .cover.img:after,.l-luxe .cover.media:after{content:"";position:absolute;inset:0;background:linear-gradient(transparent 30%,var(--bg))}
.l-luxe .av{margin-top:-74px}
.l-luxe .avatar{border:1px solid var(--p);padding:6px;background:var(--bg);box-shadow:0 0 0 7px var(--bg),0 0 0 8px color-mix(in srgb,var(--p) 40%,transparent),0 30px 60px -20px rgba(0,0,0,.8)}
.l-luxe .avatar.ph{background:linear-gradient(135deg,var(--p),var(--s));background-clip:content-box}
.l-luxe .name{font-size:34px;font-weight:500;letter-spacing:.01em}
.l-luxe .name i{color:var(--p)}
.l-luxe .role{text-transform:uppercase;letter-spacing:.3em;font-size:11px;font-weight:600;color:var(--p);margin-top:10px}
.l-luxe .id-text:after{content:"";display:block;width:140px;height:1px;margin:20px auto 0;background:linear-gradient(90deg,transparent,var(--p),transparent)}
.l-luxe .company{background:transparent;color:var(--s);border:1px solid color-mix(in srgb,var(--p) 40%,transparent)}
.l-luxe .loc{border-color:color-mix(in srgb,var(--p) 25%,transparent)}
.l-luxe .actions{padding:24px 28px 0}
.l-luxe .act{background:transparent;border:1px solid color-mix(in srgb,var(--p) 45%,transparent);color:var(--p)}
.l-luxe .act:hover{background:var(--p);color:var(--onp)}
.l-luxe .save{margin:14px 28px 0;background:linear-gradient(120deg,var(--p),var(--s) 50%,var(--p));color:var(--onp);letter-spacing:.18em;text-transform:uppercase;font-size:13px}
.l-luxe .install{margin-inline:28px;width:calc(100% - 56px)}
.l-luxe .sec{padding:34px 28px 0}
.l-luxe .sec h3{justify-content:center;color:var(--p);letter-spacing:.32em;font-size:11px}
.l-luxe .sec h3 i{display:none}
.l-luxe .sec h3:before,.l-luxe .sec h3:after{content:"\\25C6";font-size:7px;letter-spacing:0;opacity:.8}
.l-luxe .box,.l-luxe .links a,.l-luxe .social a,.l-luxe .pays a,.l-luxe .post,.l-luxe .prod,.l-luxe .embed{background:color-mix(in srgb,var(--p) 5%,transparent);border-color:color-mix(in srgb,var(--p) 22%,transparent);box-shadow:none}
.l-luxe .row>i:not(.go),.l-luxe .links a i,.l-luxe .pays a i{background:transparent;border:1px solid color-mix(in srgb,var(--p) 40%,transparent);border-radius:50%}
.l-luxe .social a{border-radius:50%}
.l-luxe .foot{padding-bottom:46px}

/* playful: blob portrait, colourful chips, bouncy hovers */
.l-playful{--r:28px}
.l-playful .cover{height:200px;border-radius:0 0 48% 52%/0 0 46px 34px}
.l-playful .cover.g:after{opacity:.5;background-image:radial-gradient(circle,rgba(255,255,255,.9) 0 3px,transparent 3.5px),radial-gradient(circle,color-mix(in srgb,var(--s) 80%,#fff) 0 5px,transparent 5.5px);background-size:46px 46px,70px 70px;background-position:0 0,23px 30px;-webkit-mask-image:none;mask-image:none}
.l-playful .av{margin-top:-72px}
.l-playful .avatar{border-radius:42% 58% 60% 40%/45% 45% 55% 55%;border-width:6px;animation:vc-pop .7s .15s cubic-bezier(.34,1.56,.64,1) both,vc-blob 10s 1s ease-in-out infinite}
.l-playful .name{font-size:31px;font-weight:800;letter-spacing:-.03em}
.l-playful .company{background:var(--s);color:var(--ons);transform:rotate(-2deg)}
.l-playful .loc{transform:rotate(1.5deg)}
.l-playful .act{border-radius:24px;background:var(--p);color:var(--onp)}
.l-playful .act span{color:inherit;opacity:.95}
.l-playful .act:nth-child(2n){background:var(--s);color:var(--ons)}
.l-playful .act:nth-child(3n){background:color-mix(in srgb,var(--p) 55%,var(--s))}
.l-playful .act:hover{transform:translateY(-4px) rotate(-4deg);box-shadow:0 14px 24px -12px var(--tx)}
.l-playful .act:nth-child(2n):hover{transform:translateY(-4px) rotate(4deg)}
.l-playful .save{border-radius:24px;background:var(--tx);color:var(--bg);box-shadow:5px 6px 0 var(--s)}
.l-playful .sec h3{text-transform:none;letter-spacing:-.01em;font-size:20px;font-weight:800;color:var(--tx)}
.l-playful .sec h3 span{text-decoration:underline wavy var(--s) 2px;text-underline-offset:7px}
.l-playful .sec h3 i{font-size:20px}
.l-playful .box,.l-playful .links a,.l-playful .pays a,.l-playful .post,.l-playful .prod{border:2px solid color-mix(in srgb,var(--p) 18%,transparent);box-shadow:6px 6px 0 color-mix(in srgb,var(--s) 30%,transparent)}
.l-playful .links a:hover,.l-playful .pays a:hover{transform:translateY(-2px) rotate(-.6deg)}
.l-playful .social a{border-radius:40% 60% 55% 45%/50% 45% 55% 50%;box-shadow:none}
.l-playful .social a:nth-child(2n){border-radius:55% 45% 40% 60%/45% 55% 45% 55%}
.l-playful .social a:hover{transform:translateY(-4px) rotate(8deg)}

/* splithero: identity and a tall portrait side by side */
.l-splithero{--r:22px}
.l-splithero .cover{display:none}
.l-splithero .hero{text-align:start}
.l-splithero .hero-main{display:grid;grid-template-columns:1fr 44%;gap:18px;align-items:end;padding:34px 20px 26px;background:linear-gradient(160deg,color-mix(in srgb,var(--p) 16%,var(--bg)),color-mix(in srgb,var(--s) 18%,var(--bg)));border-radius:0 0 36px 36px;overflow:hidden}
.l-splithero .hero-main:before{content:"";position:absolute;width:240px;height:240px;border-radius:50%;right:-70px;top:-60px;background:radial-gradient(circle,color-mix(in srgb,var(--s) 55%,transparent),transparent 70%)}
[dir=rtl] .l-splithero .hero-main:before{right:auto;left:-70px}
.l-splithero .av{order:2;margin:0;display:block}
.l-splithero .avatar{width:100%;height:auto;aspect-ratio:3/4;border-radius:24px 24px 90px 24px;border:0;box-shadow:0 30px 50px -24px color-mix(in srgb,var(--p) 70%,#000)}
.l-splithero .avatar.ph{font-size:40px}
.l-splithero .id{order:1;padding:0 0 6px}
.l-splithero .name{justify-content:flex-start;font-size:27px;font-weight:800;letter-spacing:-.04em;line-height:1.05}
.l-splithero .role{font-size:14.5px}
.l-splithero .meta{justify-content:flex-start;flex-direction:column;align-items:flex-start}
.l-splithero .company{background:var(--p);color:var(--onp)}
.l-splithero .loc{border-color:color-mix(in srgb,var(--tx) 18%,transparent)}
.l-splithero .act{border-radius:22px}

/* stack: the header is a physical business card with cards stacked behind */
.l-stack{--r:22px}
.l-stack .cover{display:none}
.l-stack .hero{text-align:start;padding:28px 18px 26px}
.l-stack .hero-main{display:grid;grid-template-columns:1fr auto;gap:16px;align-items:start;min-height:216px;padding:24px;border-radius:26px;color:var(--onp);background:linear-gradient(135deg,var(--p),color-mix(in srgb,var(--p) 55%,var(--s)));box-shadow:0 14px 0 -6px color-mix(in srgb,var(--s) 55%,var(--bg)),0 28px 0 -12px color-mix(in srgb,var(--s) 28%,var(--bg)),0 40px 50px -24px rgba(15,23,42,.45);overflow:hidden;animation:vc-deal .9s .1s var(--ease) both}
.l-stack .hero-main:before{content:"";position:absolute;width:260px;height:260px;border-radius:50%;right:-90px;bottom:-130px;background:radial-gradient(circle,rgba(255,255,255,.28),transparent 65%)}
.l-stack .hero-main:after{content:"";position:absolute;left:24px;bottom:24px;width:40px;height:30px;border-radius:7px;background:linear-gradient(135deg,#f5e3a8,#c8a84e);box-shadow:inset 0 0 0 1px rgba(0,0,0,.15)}
.l-stack .av{order:2;margin:0}
.l-stack .avatar{width:74px;height:74px;border:3px solid rgba(255,255,255,.85);box-shadow:0 10px 24px -10px rgba(0,0,0,.5)}
.l-stack .avatar.ph{font-size:26px;background:rgba(255,255,255,.2)}
.l-stack .id{order:1;padding:0;min-width:0;padding-bottom:44px}
.l-stack .name{justify-content:flex-start;font-size:26px;color:inherit}
.l-stack .name i{color:inherit}
.l-stack .role{color:inherit;opacity:.85;font-size:14.5px}
.l-stack .meta{justify-content:flex-start}
.l-stack .company{background:rgba(255,255,255,.2);color:inherit}
.l-stack .loc{border-color:rgba(255,255,255,.35);color:inherit;opacity:.9}
.l-stack .actions{padding-top:12px}
.l-stack .act{border-radius:20px}
.l-stack .box,.l-stack .links a,.l-stack .pays a,.l-stack .post{box-shadow:0 8px 0 -4px color-mix(in srgb,var(--p) 16%,var(--bg)),0 14px 30px -18px rgba(15,23,42,.3)}

/* neon: synthwave grid, glow */
.l-neon{--r:18px}
.l-neon .cover{height:240px}
.l-neon .cover.g{background:radial-gradient(ellipse 60% 70% at 50% 100%,color-mix(in srgb,var(--s) 55%,transparent),transparent 70%),radial-gradient(circle at 50% 78%,color-mix(in srgb,var(--p) 80%,#fff) 0 42px,transparent 43px),var(--bg)}
.l-neon .cover.g:before{top:52%;left:-50%;right:-50%;bottom:-40%;background:repeating-linear-gradient(90deg,color-mix(in srgb,var(--p) 70%,transparent) 0 1px,transparent 1px 44px),repeating-linear-gradient(0deg,color-mix(in srgb,var(--p) 70%,transparent) 0 1px,transparent 1px 30px);transform:perspective(260px) rotateX(62deg);transform-origin:50% 0;animation:vc-grid 3s linear infinite;-webkit-mask-image:linear-gradient(transparent,#000 40%);mask-image:linear-gradient(transparent,#000 40%)}
.l-neon .cover.g:after{background:linear-gradient(transparent 60%,var(--bg));opacity:1;-webkit-mask-image:none;mask-image:none}
.l-neon .av{margin-top:-78px}
.l-neon .avatar{border:2px solid var(--p);box-shadow:0 0 0 5px var(--bg),0 0 26px var(--p),0 0 70px -10px var(--s);animation:vc-pop .6s .15s cubic-bezier(.34,1.56,.64,1) both,vc-glow 3s 1s ease-in-out infinite alternate}
.l-neon .name{text-shadow:0 0 22px color-mix(in srgb,var(--p) 65%,transparent);letter-spacing:-.02em}
.l-neon .role{color:var(--s);text-shadow:0 0 14px color-mix(in srgb,var(--s) 50%,transparent)}
.l-neon .company{background:transparent;border:1px solid color-mix(in srgb,var(--p) 60%,transparent);box-shadow:0 0 16px -4px var(--p),inset 0 0 12px -6px var(--p)}
.l-neon .act{font-size:10px;letter-spacing:-.02em;background:transparent;border:1px solid color-mix(in srgb,var(--p) 45%,transparent);border-radius:18px}
.l-neon .act i{filter:drop-shadow(0 0 6px var(--p))}
.l-neon .act:hover{background:color-mix(in srgb,var(--p) 14%,transparent);color:var(--p);box-shadow:0 0 24px -4px var(--p),inset 0 0 14px -6px var(--p)}
.l-neon .act:hover span{color:var(--tx)}
.l-neon .save{border-radius:18px;box-shadow:0 0 30px -4px var(--p),0 0 60px -20px var(--s)}
.l-neon .sec h3{color:var(--p);text-shadow:0 0 12px color-mix(in srgb,var(--p) 60%,transparent);letter-spacing:.24em}
.l-neon .box,.l-neon .links a,.l-neon .social a,.l-neon .pays a,.l-neon .post,.l-neon .prod,.l-neon .embed{background:color-mix(in srgb,var(--p) 5%,transparent);border-color:color-mix(in srgb,var(--p) 26%,transparent);box-shadow:none}
.l-neon .links a:hover,.l-neon .social a:hover{box-shadow:0 0 26px -6px var(--p)}

/* paper: dotted stationery, polaroid portrait, stamp badge */
.l-paper{--r:8px;background-color:var(--bg);background-image:radial-gradient(color-mix(in srgb,var(--tx) 13%,transparent) 1px,transparent 1.4px);background-size:16px 16px}
.l-paper .cover{display:none}
.l-paper .hero{padding-top:48px}
.l-paper .av{margin:0}
.l-paper .avatar{width:180px;height:196px;border-radius:3px;border:0;padding:10px 10px 34px;background:#fff;box-shadow:0 1px 2px rgba(0,0,0,.12),0 18px 34px -16px rgba(0,0,0,.35);transform:rotate(-3deg);animation:vc-drop .8s .12s var(--ease) both}
.l-paper .avatar.ph{background:linear-gradient(135deg,var(--p),var(--s)) content-box,#fff}
.l-paper .av:before{content:"";position:absolute;top:-12px;left:50%;width:92px;height:28px;margin-left:-46px;z-index:2;background:color-mix(in srgb,var(--s) 35%,rgba(255,255,255,.55));transform:rotate(-6deg);box-shadow:0 1px 2px rgba(0,0,0,.08)}
.l-paper .id{padding-top:22px}
.l-paper .name{font-size:31px}
.l-paper .role{font-style:italic}
.l-paper .company{background:transparent;color:var(--p);border:2px solid var(--p);border-radius:6px;text-transform:uppercase;letter-spacing:.12em;font-size:11.5px;font-weight:700;transform:rotate(-2deg)}
.l-paper .loc{border-style:dashed}
.l-paper .act{font-size:10px;letter-spacing:-.02em;border-radius:14px;background:color-mix(in srgb,var(--card) 70%,transparent);border:1.5px solid color-mix(in srgb,var(--tx) 14%,transparent);color:var(--p)}
.l-paper .save{border-radius:12px;box-shadow:0 2px 0 color-mix(in srgb,var(--p) 60%,#000),0 14px 24px -14px var(--p)}
.l-paper .save:after{display:none}
.l-paper .sec h3{color:var(--tx);border-bottom:1.5px dashed color-mix(in srgb,var(--tx) 25%,transparent);padding-bottom:8px}
.l-paper .box,.l-paper .links a,.l-paper .social a,.l-paper .pays a,.l-paper .post,.l-paper .prod{box-shadow:0 1px 0 var(--line),0 12px 22px -18px rgba(0,0,0,.45)}

/* aurora: soft animated light behind the header, gradient-ring portrait */
.l-aurora{--r:24px;background:radial-gradient(90% 40% at 0% 45%,color-mix(in srgb,var(--p) 7%,transparent),transparent 70%),radial-gradient(80% 40% at 100% 75%,color-mix(in srgb,var(--s) 8%,transparent),transparent 70%),var(--bg)}
.l-aurora .cover{height:250px;-webkit-mask-image:linear-gradient(#000 45%,transparent);mask-image:linear-gradient(#000 45%,transparent)}
.l-aurora .cover.g{background:transparent}
.l-aurora .cover.g:before{inset:-30%;background:radial-gradient(40% 50% at 25% 40%,var(--p),transparent 70%),radial-gradient(38% 45% at 75% 35%,var(--s),transparent 70%),radial-gradient(45% 40% at 55% 75%,color-mix(in srgb,var(--p) 50%,var(--s)),transparent 70%);filter:blur(34px);opacity:.75;animation:vc-aurora 18s ease-in-out infinite alternate}
.l-aurora .cover.g:after{display:none}
.l-aurora .av{margin-top:-96px}
.l-aurora .avatar{border:0;padding:4px;background:conic-gradient(from 210deg,var(--p),var(--s),var(--p));box-shadow:inset 0 0 0 3px var(--bg),0 24px 44px -20px var(--p)}
.l-aurora .avatar.ph{background:linear-gradient(135deg,var(--p),var(--s))}
.l-aurora .company{background:linear-gradient(120deg,color-mix(in srgb,var(--p) 14%,transparent),color-mix(in srgb,var(--s) 14%,transparent))}
.l-aurora .act{border-radius:22px;background:color-mix(in srgb,var(--card) 70%,transparent);border:1px solid var(--line);box-shadow:var(--sh)}
.l-aurora .act:hover{background:linear-gradient(135deg,var(--p),var(--s));color:var(--onp)}
.l-aurora .save{background:linear-gradient(120deg,var(--p),var(--s))}
.l-aurora .box,.l-aurora .links a,.l-aurora .social a,.l-aurora .pays a,.l-aurora .post{background:color-mix(in srgb,var(--card) 82%,transparent);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px)}

/* ------------------------------------------------------------------ motion */
@keyframes vc-up{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:none}}
@keyframes vc-fade{from{opacity:0}to{opacity:1}}
@keyframes vc-pop{from{opacity:0;transform:scale(.7)}to{opacity:1;transform:none}}
@keyframes vc-zoom{from{opacity:0;transform:scale(1.08)}to{opacity:1;transform:none}}
@keyframes vc-drop{from{opacity:0;transform:translateY(-24px) rotate(6deg)}to{opacity:1;transform:rotate(-3deg)}}
@keyframes vc-deal{from{opacity:0;transform:translateY(30px) rotate(-4deg) scale(.96)}to{opacity:1;transform:none}}
@keyframes vc-cover{from{opacity:0;transform:scale(1.06)}to{opacity:1;transform:none}}
@keyframes vc-bar{from{opacity:0;transform:translate(-50%,40px)}to{opacity:1;transform:translate(-50%,0)}}
@keyframes vc-shine{0%{left:-60%}30%,100%{left:130%}}
@keyframes vc-mesh{0%{background-position:0% 0%}100%{background-position:100% 100%}}
@keyframes vc-aurora{0%{transform:translate(-6%,-4%) rotate(0deg) scale(1)}100%{transform:translate(6%,4%) rotate(14deg) scale(1.12)}}
@keyframes vc-float{0%{transform:translate(0,0)}100%{transform:translate(-60px,120px)}}
@keyframes vc-blob{0%,100%{border-radius:42% 58% 60% 40%/45% 45% 55% 55%}50%{border-radius:58% 42% 45% 55%/55% 60% 40% 45%}}
@keyframes vc-glow{from{box-shadow:0 0 0 5px var(--bg),0 0 18px var(--p),0 0 50px -10px var(--s)}to{box-shadow:0 0 0 5px var(--bg),0 0 34px var(--p),0 0 90px -10px var(--s)}}
@keyframes vc-grid{from{background-position:0 0}to{background-position:0 30px}}
@keyframes sheet{from{transform:translateY(100%)}}
.cover{animation:vc-cover 1s var(--ease) both}
.avatar{animation:vc-pop .65s .12s cubic-bezier(.34,1.56,.64,1) both}
.id{animation:vc-up .7s .22s var(--ease) both}
.actions .act{animation:vc-up .6s var(--ease) both}
.actions .act:nth-child(1){animation-delay:.3s}.actions .act:nth-child(2){animation-delay:.36s}.actions .act:nth-child(3){animation-delay:.42s}.actions .act:nth-child(4){animation-delay:.48s}.actions .act:nth-child(5){animation-delay:.54s}
.save{animation:vc-up .6s .58s var(--ease) both}
.save:after{animation:vc-shine 4.5s 1.8s ease-in-out infinite}
.sec{animation:vc-up .7s var(--ease) both;animation-timeline:view();animation-range:entry 0% cover 22%}
@supports not (animation-timeline:view()){.sec{animation-delay:.62s}}
@media (prefers-reduced-motion:reduce){html{scroll-behavior:auto}*,*:before,*:after{animation:none!important;transition:none!important}}
`;
