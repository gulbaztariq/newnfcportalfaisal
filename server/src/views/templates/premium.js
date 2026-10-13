/*
 * Premium vCard layouts (appended after styles.js). Same DOM and theme tokens as the base layouts:
 * --p --s --bg --tx --font --onp --ons --page --muted --card --line --chip --sh
 * `.deco` (initials, hidden by default) is an optional decorative hook in the header.
 */
module.exports = String.raw`
.deco{display:none}

/* ================================================================== banner: wide brand banner, start-aligned identity (Blinq-style) */
.l-banner{--r:18px}
.l-banner .cover{height:180px}
.l-banner .cover.g:after{opacity:.12}
.l-banner .hero,.l-banner .name{text-align:start;justify-content:flex-start}
.l-banner .hero-main{padding:0 22px}
.l-banner .av{justify-content:flex-start;margin-top:-58px}
.l-banner .avatar{width:116px;height:116px;border-width:4px;box-shadow:0 10px 30px -12px rgba(0,0,0,.35)}
.l-banner .id{padding-top:14px}
.l-banner .name{font-size:27px;font-weight:800}
.l-banner .role{font-size:15px}
.l-banner .meta{justify-content:flex-start}
.l-banner .company{background:transparent;color:var(--tx);padding-inline-start:0;font-size:14px}
.l-banner .company i{color:var(--p)}
.l-banner .actions{padding:20px 22px 0;gap:8px}
.l-banner .act{height:64px;border-radius:16px;background:var(--card);border:1px solid var(--line);box-shadow:var(--sh)}
.l-banner .save{margin:12px 22px 0;border-radius:14px;height:52px}
.l-banner .save:after{display:none}
.l-banner .install{margin-inline:22px;width:calc(100% - 44px);border-radius:14px}
.l-banner .sec{padding:28px 22px 0}
.l-banner .sec h3{text-transform:none;letter-spacing:-.01em;font-size:17px;color:var(--tx);margin-inline:0}
.l-banner .sec h3 i{display:none}
.l-banner .box,.l-banner .links a,.l-banner .social a,.l-banner .pays a,.l-banner .post,.l-banner .prod,.l-banner .embed{box-shadow:none}
.l-banner .row>i:not(.go){border-radius:50%;background:var(--p);color:var(--onp);width:38px;height:38px;font-size:17px}
.l-banner .links a{border-radius:14px}

/* ================================================================== wave: coloured header with a flowing wave edge */
.l-wave{--r:20px}
.l-wave .cover{height:250px;-webkit-mask:linear-gradient(#000,#000) top/100% calc(100% - 46px) no-repeat,url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 480 48' preserveAspectRatio='none'%3E%3Cpath d='M0 0h480v18c-60 26-120 30-180 14S180 2 120 10 40 40 0 30z'/%3E%3C/svg%3E") bottom/100% 47px no-repeat;mask:linear-gradient(#000,#000) top/100% calc(100% - 46px) no-repeat,url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 480 48' preserveAspectRatio='none'%3E%3Cpath d='M0 0h480v18c-60 26-120 30-180 14S180 2 120 10 40 40 0 30z'/%3E%3C/svg%3E") bottom/100% 47px no-repeat}
.l-wave .cover.g{background:linear-gradient(160deg,var(--p) 20%,var(--s))}
.l-wave .cover.g:after{opacity:.1}
.l-wave .hero:before{content:"";position:absolute;left:0;right:0;top:0;height:262px;background:color-mix(in srgb,var(--s) 35%,transparent);-webkit-mask:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 480 48' preserveAspectRatio='none'%3E%3Cpath d='M0 0h480v30c-50-22-110-26-170-8S170 46 110 38 30 12 0 22z'/%3E%3C/svg%3E") bottom/100% 48px no-repeat,linear-gradient(#000,#000) top/100% calc(100% - 47px) no-repeat;mask:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 480 48' preserveAspectRatio='none'%3E%3Cpath d='M0 0h480v30c-50-22-110-26-170-8S170 46 110 38 30 12 0 22z'/%3E%3C/svg%3E") bottom/100% 48px no-repeat,linear-gradient(#000,#000) top/100% calc(100% - 47px) no-repeat}
.l-wave .cover{z-index:1}
.l-wave .av{margin-top:-98px}
.l-wave .avatar{width:132px;height:132px;border:5px solid var(--bg);box-shadow:0 20px 40px -18px color-mix(in srgb,var(--p) 80%,#000)}
.l-wave .act{border-radius:20px;background:var(--card);border:1px solid var(--line);box-shadow:var(--sh)}
.l-wave .act:hover{background:var(--p)}
.l-wave .save{background:linear-gradient(110deg,var(--p),var(--s))}
.l-wave .sec h3{color:var(--p)}
.l-wave .box{border:0}
.l-wave .row>i:not(.go),.l-wave .links a i,.l-wave .pays a i{border-radius:50%}

/* ================================================================== linkhub: gradient canvas with stacked link pills (Linktree-style) */
.l-linkhub{--r:999px;background:linear-gradient(165deg,var(--p),color-mix(in srgb,var(--p) 45%,var(--s)) 55%,var(--s))}
.l-linkhub:before{content:"";position:absolute;inset:0;z-index:-1;background:radial-gradient(60% 30% at 20% 0%,rgba(255,255,255,.28),transparent 70%),radial-gradient(50% 30% at 100% 60%,rgba(255,255,255,.14),transparent 70%)}
.l-linkhub .cover{display:none}
.l-linkhub .hero{padding-top:56px;color:var(--onp)}
.l-linkhub .av{margin:0}
.l-linkhub .avatar{width:104px;height:104px;border:3px solid rgba(255,255,255,.85);box-shadow:0 16px 36px -14px rgba(0,0,0,.45)}
.l-linkhub .avatar.ph{background:rgba(255,255,255,.22);color:var(--onp)}
.l-linkhub .name{font-size:24px;color:inherit}
.l-linkhub .name i,.l-linkhub .role{color:inherit}
.l-linkhub .role{opacity:.85}
.l-linkhub .company,.l-linkhub .loc{background:rgba(255,255,255,.18);color:inherit;border:0}
.l-linkhub .actions{justify-content:center;gap:10px;padding-top:20px}
.l-linkhub .act{flex:0 0 48px;height:48px;border-radius:50%;background:rgba(255,255,255,.18);color:var(--onp)}
.l-linkhub .act span{display:none}
.l-linkhub .act:hover{background:var(--bg);color:var(--p)}
.l-linkhub .save{background:var(--bg);color:var(--tx);box-shadow:0 14px 30px -16px rgba(0,0,0,.45)}
.l-linkhub .sec h3{justify-content:center;color:var(--onp);opacity:.85}
.l-linkhub .sec h3 i{color:inherit}
.l-linkhub .box{border-radius:26px;border:0;background:var(--bg)}
.l-linkhub .links a{justify-content:center;text-align:center;position:relative;min-height:58px;background:var(--bg);border:0;box-shadow:0 10px 24px -16px rgba(0,0,0,.5)}
.l-linkhub .links a i{position:absolute;inset-inline-end:10px}
.l-linkhub .links a:hover{transform:scale(1.02)}
.l-linkhub .social{display:flex;flex-wrap:wrap;justify-content:center;gap:4px}
.l-linkhub .social a{width:48px;aspect-ratio:1;background:transparent;border:0;box-shadow:none;color:var(--onp);font-size:24px}
.l-linkhub .social a:hover{background:rgba(255,255,255,.18);color:var(--onp)}
.l-linkhub .pays a,.l-linkhub .post,.l-linkhub .prod,.l-linkhub .embed{border:0;border-radius:24px;background:var(--bg)}
.l-linkhub .prod .img{border-radius:0}
.l-linkhub .chips button{background:rgba(255,255,255,.18);border:0;color:var(--onp)}
.l-linkhub .chips button.on{background:var(--bg);color:var(--tx)}
.l-linkhub .foot,.l-linkhub .foot a,.l-linkhub .legal a{color:var(--onp)}

/* ================================================================== breeze: pastel blurred blobs, frosted pills */
.l-breeze{--r:26px;background:var(--bg)}
.l-breeze:before{content:"";position:absolute;inset:-20% -30% auto;height:900px;z-index:-1;background:radial-gradient(30% 28% at 22% 22%,color-mix(in srgb,var(--p) 55%,transparent),transparent 70%),radial-gradient(32% 26% at 80% 34%,color-mix(in srgb,var(--s) 55%,transparent),transparent 70%),radial-gradient(28% 24% at 50% 62%,color-mix(in srgb,var(--p) 30%,var(--s) 30%),transparent 70%);filter:blur(40px);animation:vc-aurora 16s ease-in-out infinite alternate}
.l-breeze .cover{display:none}
.l-breeze .hero{padding-top:58px}
.l-breeze .av{margin:0}
.l-breeze .avatar{width:124px;height:124px;border:6px solid color-mix(in srgb,var(--bg) 70%,transparent);box-shadow:0 24px 50px -20px color-mix(in srgb,var(--p) 70%,transparent)}
.l-breeze .name{font-size:30px;font-weight:700}
.l-breeze .company,.l-breeze .loc{background:color-mix(in srgb,var(--bg) 60%,transparent);border:1px solid color-mix(in srgb,var(--bg) 80%,transparent);color:var(--tx);backdrop-filter:blur(10px)}
.l-breeze .act,.l-breeze .box,.l-breeze .links a,.l-breeze .social a,.l-breeze .pays a,.l-breeze .post,.l-breeze .prod,.l-breeze .embed{background:color-mix(in srgb,var(--bg) 62%,transparent);border:1px solid color-mix(in srgb,var(--bg) 85%,transparent);backdrop-filter:blur(16px) saturate(1.3);-webkit-backdrop-filter:blur(16px) saturate(1.3);box-shadow:0 10px 30px -18px rgba(30,20,60,.25)}
.l-breeze .act{color:var(--tx)}
.l-breeze .act i{color:var(--p)}
.l-breeze .act:hover i{color:inherit}
.l-breeze .save{background:linear-gradient(120deg,var(--p),var(--s));color:var(--onp)}
.l-breeze .links a{border-radius:999px;justify-content:center;position:relative;min-height:56px}
.l-breeze .links a i{position:absolute;inset-inline-end:10px}
.l-breeze .social a{border-radius:50%}
.l-breeze .sec h3{justify-content:center}

/* ================================================================== cinema: full portrait card with a frosted name plate */
.l-cinema{--r:22px}
.l-cinema .cover{display:none}
.l-cinema .hero{padding:14px 14px 0;text-align:start}
.l-cinema .hero-main{position:relative;height:min(540px,128vw);border-radius:32px;overflow:hidden;padding:0;box-shadow:0 30px 60px -30px rgba(0,0,0,.6)}
.l-cinema .av{position:absolute;inset:0;margin:0}
.l-cinema .avatar{width:100%;height:100%;border:0;border-radius:0;box-shadow:none;animation:vc-zoom 1.2s var(--ease) both}
.l-cinema .avatar.ph{font-size:110px;background:linear-gradient(160deg,var(--p),var(--s))}
.l-cinema .hero-main:after{content:"";position:absolute;inset:40% 0 0;background:linear-gradient(transparent,rgba(0,0,0,.55));pointer-events:none}
.l-cinema .id{position:absolute;z-index:2;left:12px;right:12px;bottom:12px;padding:18px 20px;border-radius:24px;color:#fff;background:rgba(20,20,24,.32);border:1px solid rgba(255,255,255,.18);backdrop-filter:blur(18px) saturate(1.4);-webkit-backdrop-filter:blur(18px) saturate(1.4)}
.l-cinema .name{justify-content:flex-start;font-size:28px;color:#fff}
.l-cinema .name i{color:var(--s)}
.l-cinema .role{color:rgba(255,255,255,.82)}
.l-cinema .meta{justify-content:flex-start;margin-top:10px}
.l-cinema .company,.l-cinema .loc{background:rgba(255,255,255,.16);border:0;color:#fff}
.l-cinema .actions{padding:18px 20px 0}
.l-cinema .act{border-radius:22px;background:var(--card);border:1px solid var(--line)}
.l-cinema .save{background:var(--tx);color:var(--bg);box-shadow:none}
.l-cinema .sec h3{color:var(--tx)}
.l-cinema .sec h3 i{color:var(--s)}

/* ================================================================== metal: brushed metal card with chip and contactless mark */
.l-metal{--r:16px;background:radial-gradient(80% 50% at 50% 0%,color-mix(in srgb,var(--p) 14%,transparent),transparent 70%),var(--bg)}
.l-metal .cover{display:none}
.l-metal .hero{padding:26px 18px 6px;text-align:start}
.l-metal .hero-main{position:relative;display:grid;grid-template-columns:1fr auto;align-items:end;aspect-ratio:1.586;padding:22px;border-radius:20px;overflow:hidden;color:#f3f3f5;
  background:repeating-linear-gradient(90deg,rgba(255,255,255,.035) 0 1px,transparent 1px 3px),linear-gradient(135deg,color-mix(in srgb,var(--p) 34%,#2b2b31),#111114 48%,color-mix(in srgb,var(--s) 18%,#26262c));
  box-shadow:inset 0 1px 0 rgba(255,255,255,.18),inset 0 0 0 1px rgba(255,255,255,.08),0 30px 60px -26px rgba(0,0,0,.9);animation:vc-deal .9s .1s var(--ease) both}
.l-metal .hero-main:before{content:"";position:absolute;inset:-50%;background:linear-gradient(105deg,transparent 42%,rgba(255,255,255,.16) 50%,transparent 58%);animation:pm-sheen 6s 1.2s ease-in-out infinite;pointer-events:none}
.l-metal .hero-main:after{content:"";position:absolute;left:22px;top:24px;width:44px;height:34px;border-radius:7px;background:linear-gradient(135deg,#f6e7b0,#b8913f 60%,#e7cf86);box-shadow:inset 0 0 0 1px rgba(0,0,0,.25),inset 14px 0 0 -13px rgba(0,0,0,.3),inset -14px 0 0 -13px rgba(0,0,0,.3),inset 0 11px 0 -10px rgba(0,0,0,.3),inset 0 -11px 0 -10px rgba(0,0,0,.3)}
.l-metal .deco{display:block;position:absolute;z-index:3;top:46px;right:42px;width:18px;height:30px;opacity:.8;background:radial-gradient(circle at 0 50%,transparent 4px,#f3f3f5 4px 6px,transparent 6px 9px,#f3f3f5 9px 11px,transparent 11px 14px,#f3f3f5 14px 16px,transparent 16px)}
.l-metal .deco span{display:none}
.l-metal .av{order:2;margin:0;align-self:end}
.l-metal .avatar{width:64px;height:64px;border:2px solid rgba(255,255,255,.55);background:#222;box-shadow:0 8px 20px -8px #000}
.l-metal .avatar.ph{font-size:22px;background:linear-gradient(135deg,#55555c,#2a2a2f);color:#eee}
.l-metal .id{order:1;padding:0;min-width:0}
.l-metal .name{justify-content:flex-start;font-size:23px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;background:linear-gradient(180deg,#ffffff,#a9a9b2);-webkit-background-clip:text;background-clip:text;color:transparent;text-shadow:0 1px 0 rgba(0,0,0,.3)}
.l-metal .name i{color:var(--s);-webkit-text-fill-color:var(--s)}
.l-metal .role{color:color-mix(in srgb,var(--s) 70%,#fff);letter-spacing:.16em;text-transform:uppercase;font-size:11px;margin-top:4px}
.l-metal .meta{justify-content:flex-start;margin-top:8px;gap:6px}
.l-metal .company,.l-metal .loc{padding:3px 9px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.12);color:#d8d8de;font-size:11.5px}
.l-metal .act{border-radius:14px;background:linear-gradient(180deg,color-mix(in srgb,var(--tx) 8%,transparent),color-mix(in srgb,var(--tx) 3%,transparent));border:1px solid var(--line);color:var(--s)}
.l-metal .act:hover{background:var(--s);color:var(--ons)}
.l-metal .save{border-radius:14px;background:linear-gradient(180deg,#f2f2f4,#b9b9c1);color:#111;box-shadow:inset 0 1px 0 #fff,0 14px 30px -16px rgba(0,0,0,.9);letter-spacing:.08em;text-transform:uppercase;font-size:13px}
.l-metal .sec h3{color:var(--s);letter-spacing:.24em}
.l-metal .sec h3 i{color:var(--s)}
.l-metal .box,.l-metal .links a,.l-metal .social a,.l-metal .pays a,.l-metal .post,.l-metal .prod,.l-metal .embed{background:linear-gradient(180deg,color-mix(in srgb,var(--tx) 6%,transparent),color-mix(in srgb,var(--tx) 2%,transparent));border-color:color-mix(in srgb,var(--tx) 12%,transparent);box-shadow:inset 0 1px 0 color-mix(in srgb,var(--tx) 8%,transparent)}
.l-metal .row>i:not(.go),.l-metal .links a i,.l-metal .pays a i{background:transparent;border:1px solid color-mix(in srgb,var(--s) 40%,transparent);color:var(--s)}
.l-metal .social a{color:var(--s)}
@keyframes pm-sheen{0%{transform:translateX(-40%)}40%,100%{transform:translateX(40%)}}

/* ================================================================== ticket: boarding pass with notches, tear line and barcode */
.l-ticket{--r:16px}
.l-ticket .cover{display:none}
.l-ticket .hero{padding:24px 18px 4px;text-align:start}
.l-ticket .hero-main{position:relative;display:grid;grid-template-columns:auto 1fr;gap:16px;align-items:start;padding:22px 22px 92px;border-radius:22px;color:var(--onp);
  background:radial-gradient(120% 80% at 100% 0%,color-mix(in srgb,var(--s) 45%,transparent),transparent 60%),var(--p);
  -webkit-mask:radial-gradient(circle 15px at 0 calc(100% - 70px),#0000 97%,#000) left/51% 100% no-repeat,radial-gradient(circle 15px at 100% calc(100% - 70px),#0000 97%,#000) right/51% 100% no-repeat;
  mask:radial-gradient(circle 15px at 0 calc(100% - 70px),#0000 97%,#000) left/51% 100% no-repeat,radial-gradient(circle 15px at 100% calc(100% - 70px),#0000 97%,#000) right/51% 100% no-repeat;
  filter:drop-shadow(0 20px 26px rgba(15,23,42,.22));animation:vc-deal .9s .1s var(--ease) both}
.l-ticket .hero-main:after{content:"";position:absolute;left:24px;right:24px;bottom:70px;border-top:2px dashed color-mix(in srgb,var(--onp) 45%,transparent)}
.l-ticket .deco{display:block;position:absolute;z-index:3;right:40px;bottom:22px;width:84px;height:36px;color:var(--onp);opacity:.85;background:repeating-linear-gradient(90deg,currentColor 0 2px,transparent 2px 4px,currentColor 4px 5px,transparent 5px 8px,currentColor 8px 11px,transparent 11px 12px)}
.l-ticket .deco span{display:none}
.l-ticket .av{margin:0}
.l-ticket .avatar{width:76px;height:76px;border-radius:18px;border:3px solid color-mix(in srgb,var(--onp) 70%,transparent);box-shadow:none}
.l-ticket .avatar.ph{font-size:26px;background:color-mix(in srgb,var(--onp) 18%,transparent)}
/* opacity-only entrance: a transform would make .id the containing block of the absolutely placed .meta */
.l-ticket .id{padding:0;min-width:0;animation:vc-fade .7s .22s ease both}
.l-ticket .id-text:before{content:"BOARDING PASS · NFC";display:block;font-size:10px;font-weight:700;letter-spacing:.24em;opacity:.7;margin-bottom:6px}
.l-ticket .name{justify-content:flex-start;font-size:24px;color:inherit}
.l-ticket .name i,.l-ticket .role{color:inherit}
.l-ticket .role{opacity:.85;font-size:14px}
.l-ticket .meta{position:absolute;left:22px;bottom:20px;right:124px;margin:0;justify-content:flex-start;flex-wrap:nowrap;gap:6px;overflow:hidden}
.l-ticket .company,.l-ticket .loc{background:color-mix(in srgb,var(--onp) 16%,transparent);border:0;color:inherit;font-size:12px;padding:5px 10px;min-width:0;flex:0 1 auto;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.l-ticket .actions{padding-top:18px}
.l-ticket .act{border-radius:14px;border:1.5px dashed color-mix(in srgb,var(--p) 40%,transparent);background:transparent}
.l-ticket .save{border-radius:14px}
.l-ticket .sec h3{font-size:11px;letter-spacing:.26em}
.l-ticket .box,.l-ticket .links a,.l-ticket .pays a,.l-ticket .post,.l-ticket .prod{border-style:dashed;border-width:1.5px;box-shadow:none}
.l-ticket .social a{border-style:dashed;box-shadow:none}

/* ================================================================== bento: everything is a tile */
.l-bento{--r:26px;background:color-mix(in srgb,var(--tx) 3%,var(--bg))}
.l-bento .cover{display:none}
.l-bento .hero{padding:18px 16px 0;text-align:start}
.l-bento .hero-main{display:grid;grid-template-columns:132px 1fr;gap:10px;padding:0}
.l-bento .av{margin:0}
.l-bento .avatar{width:132px;height:132px;border-radius:26px;border:0;box-shadow:var(--sh)}
.l-bento .avatar.ph{font-size:42px}
.l-bento .id{padding:16px 18px;border-radius:26px;background:var(--p);color:var(--onp);display:flex;align-items:flex-end;min-width:0}
.l-bento .name{justify-content:flex-start;font-size:22px;line-height:1.1;color:inherit}
.l-bento .name i{color:inherit}
.l-bento .role{color:inherit;opacity:.85;font-size:13.5px}
.l-bento .meta{justify-content:flex-start;margin-top:8px;gap:6px}
.l-bento .company,.l-bento .loc{background:color-mix(in srgb,var(--onp) 16%,transparent);color:inherit;border:0;font-size:11.5px;padding:4px 9px}
.l-bento .actions{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;padding:10px 16px 0}
.l-bento .act{height:86px;border-radius:24px;background:var(--card);border:1px solid var(--line);box-shadow:var(--sh)}
.l-bento .act:first-child{grid-column:span 2;background:var(--s);color:var(--ons)}
.l-bento .act:first-child span{color:inherit;opacity:.9}
.l-bento .save{margin:10px 16px 0;border-radius:24px;height:62px;background:var(--tx);color:var(--bg);box-shadow:none}
.l-bento .install{margin-inline:16px;width:calc(100% - 32px)}
.l-bento .sec{padding:10px 16px 0}
.l-bento .sec h3{margin:10px 6px 10px}
.l-bento .box{border-radius:26px}
.l-bento .s-about .box{background:var(--chip);border-color:transparent;font-size:16px}
.l-bento .social{grid-template-columns:repeat(4,1fr)}
.l-bento .social a{border-radius:24px}
.l-bento .links{grid-template-columns:1fr 1fr}
.l-bento .links a{flex-direction:column-reverse;align-items:flex-start;gap:18px;padding:16px;border-radius:24px;min-height:110px}
.l-bento .links a:first-child:nth-last-child(odd){grid-column:1/-1;min-height:auto;flex-direction:row;align-items:center}
.l-bento .pays{grid-template-columns:1fr 1fr}
.l-bento .pays a{flex-direction:column;align-items:flex-start;border-radius:24px}

/* ================================================================== marble: veined stone, arched portrait, gold hairlines */
.l-marble{--r:6px;background:
  linear-gradient(115deg,transparent 46%,color-mix(in srgb,var(--s) 12%,transparent) 47%,transparent 48.5%),
  linear-gradient(62deg,transparent 30%,color-mix(in srgb,var(--s) 9%,transparent) 31%,transparent 32%,transparent 70%,color-mix(in srgb,var(--s) 8%,transparent) 71%,transparent 72.5%),
  linear-gradient(150deg,transparent 60%,color-mix(in srgb,var(--s) 10%,transparent) 61%,transparent 62%),
  radial-gradient(80% 60% at 20% 10%,color-mix(in srgb,#fff 60%,transparent),transparent 70%),
  radial-gradient(70% 50% at 90% 80%,color-mix(in srgb,var(--s) 10%,transparent),transparent 70%),var(--bg);background-size:900px 1400px,700px 1000px,1100px 1300px,auto,auto,auto}
.l-marble .cover{display:none}
.l-marble .hero{padding-top:52px}
.l-marble .av{margin:0}
.l-marble .avatar{width:176px;height:228px;border-radius:999px 999px 10px 10px;border:0;padding:7px;background:var(--bg);box-shadow:0 0 0 1px var(--p),0 0 0 8px var(--bg),0 0 0 9px color-mix(in srgb,var(--p) 50%,transparent),0 34px 60px -30px rgba(40,30,20,.55)}
.l-marble .avatar.ph{background:linear-gradient(160deg,var(--p),var(--s)) content-box;font-size:52px}
.l-marble .id{padding-top:26px}
.l-marble .name{font-size:36px;font-weight:500;letter-spacing:.01em}
.l-marble .role{font-style:italic;font-size:17px}
.l-marble .id-text:after{content:"";display:block;width:120px;height:1px;margin:18px auto 0;background:linear-gradient(90deg,transparent,var(--p),transparent)}
.l-marble .company{background:transparent;color:var(--p);border:1px solid color-mix(in srgb,var(--p) 50%,transparent);border-radius:2px;letter-spacing:.14em;text-transform:uppercase;font-size:11px}
.l-marble .loc{border-radius:2px}
.l-marble .actions{padding:24px 26px 0}
.l-marble .act{border-radius:999px 999px 8px 8px;background:color-mix(in srgb,var(--bg) 70%,transparent);border:1px solid color-mix(in srgb,var(--p) 45%,transparent);color:var(--p);height:78px}
.l-marble .act:hover{background:var(--p)}
.l-marble .save{margin:14px 26px 0;border-radius:4px;background:var(--p);letter-spacing:.2em;text-transform:uppercase;font-size:12.5px}
.l-marble .install{margin-inline:26px;width:calc(100% - 52px)}
.l-marble .sec{padding:34px 26px 0}
.l-marble .sec h3{justify-content:center;color:var(--p);letter-spacing:.3em;font-size:11px}
.l-marble .sec h3 i{display:none}
.l-marble .sec h3:before,.l-marble .sec h3:after{content:"";width:28px;height:1px;background:color-mix(in srgb,var(--p) 60%,transparent)}
.l-marble .box,.l-marble .links a,.l-marble .social a,.l-marble .pays a,.l-marble .post,.l-marble .prod,.l-marble .embed{background:color-mix(in srgb,var(--bg) 72%,transparent);border-color:color-mix(in srgb,var(--p) 30%,transparent);box-shadow:0 18px 30px -26px rgba(40,30,20,.5);backdrop-filter:blur(4px)}
.l-marble .row>i:not(.go),.l-marble .links a i,.l-marble .pays a i{background:transparent;border:1px solid color-mix(in srgb,var(--p) 45%,transparent);border-radius:50%}
.l-marble .social a{border-radius:50%}

/* ================================================================== swiss: International Typographic Style, strict grid */
.l-swiss{--r:0px;font-size:15px}
.l-swiss .cover{height:14px;animation:none}
.l-swiss .cover.g,.l-swiss .cover.img,.l-swiss .cover.media{background:var(--p)}
.l-swiss .cover:before,.l-swiss .cover:after,.l-swiss .cover>*{display:none}
.l-swiss .hero{text-align:start;padding:30px 24px 0}
.l-swiss .hero-main{display:grid;grid-template-columns:1fr 96px;gap:18px;padding:0;align-items:start}
.l-swiss .av{order:2;margin:0}
.l-swiss .avatar{width:96px;height:120px;border-radius:0;border:0;box-shadow:none;filter:grayscale(1) contrast(1.05)}
.l-swiss .avatar.ph{background:var(--tx);color:var(--bg);font-size:30px;filter:none}
.l-swiss .id{order:1;padding:0;min-width:0}
.l-swiss .name{justify-content:flex-start;font-size:clamp(32px,9.5vw,44px);font-weight:800;letter-spacing:-.05em;line-height:.95}
.l-swiss .name i{color:var(--p)}
.l-swiss .role{color:var(--tx);font-weight:600;margin-top:14px;padding-top:10px;border-top:3px solid var(--tx)}
.l-swiss .meta{justify-content:flex-start;gap:0 14px}
.l-swiss .company,.l-swiss .loc{background:transparent;border:0;padding:0;border-radius:0;color:var(--muted);font-weight:500}
.l-swiss .company i{color:var(--p)}
.l-swiss .actions{display:grid;grid-auto-flow:column;grid-auto-columns:1fr;gap:0;padding:28px 24px 0}
.l-swiss .act{border-radius:0;height:76px;background:transparent;border:2px solid var(--tx);color:var(--tx);margin-left:-2px}
.l-swiss .act:first-child{margin-left:0}
.l-swiss .act:hover{background:var(--p);border-color:var(--p);color:var(--onp);transform:none;box-shadow:none}
.l-swiss .save{border-radius:0;margin:14px 24px 0;background:var(--p);box-shadow:none;justify-content:space-between;padding:0 20px;text-transform:uppercase;letter-spacing:.08em;font-size:14px}
.l-swiss .save:after{display:none}
.l-swiss .install{border-radius:0;margin-inline:24px;width:calc(100% - 48px)}
.l-swiss main,.l-swiss{counter-reset:sw}
.l-swiss .sec{padding:38px 24px 0;counter-increment:sw}
.l-swiss .sec h3{margin:0 0 14px;padding-top:10px;border-top:3px solid var(--tx);color:var(--tx);font-size:13px;letter-spacing:.06em}
.l-swiss .sec h3 i{display:none}
.l-swiss .sec h3:before{content:counter(sw,decimal-leading-zero);color:var(--p);margin-inline-end:10px}
.l-swiss .box,.l-swiss .links a,.l-swiss .social a,.l-swiss .pays a,.l-swiss .post,.l-swiss .prod,.l-swiss .embed{border-radius:0;box-shadow:none;background:transparent;border:0;border-bottom:1px solid var(--line)}
.l-swiss .box{padding:4px 0 14px}
.l-swiss .box.list{padding:0}
.l-swiss .row{padding:12px 0;border-radius:0}
.l-swiss .row>i:not(.go){background:transparent;color:var(--p);width:24px;border-radius:0}
.l-swiss .social a{border:2px solid var(--tx);color:var(--tx)}
.l-swiss .social a:hover{background:var(--p);border-color:var(--p);transform:none}
.l-swiss .links a{padding:16px 0}
.l-swiss .links a i{background:transparent;border-radius:0}
.l-swiss .svc{padding:0}
.l-swiss .hours{padding:0 0 10px}
.l-swiss .btn,.l-swiss form.enq input,.l-swiss form.enq textarea,.l-swiss .chips button,.l-swiss .prod .row2 a,.l-swiss .prod .row2 button{border-radius:0}
.l-swiss .foot{text-align:start;padding-inline:24px}

/* ================================================================== duotone: two-colour photo treatment, bold blocks */
.l-duotone{--r:20px}
.l-duotone .cover{height:230px;background:var(--s)}
.l-duotone .cover.img{filter:grayscale(1) contrast(1.15)}
.l-duotone .cover.img:before{content:"";position:absolute;inset:0;background:linear-gradient(135deg,var(--p),var(--s));mix-blend-mode:multiply;opacity:.9}
.l-duotone .cover.g{background:linear-gradient(135deg,var(--p) 50%,var(--s) 50%)}
.l-duotone .cover.g:before{background:radial-gradient(circle,rgba(255,255,255,.35) 1.6px,transparent 2px) 0 0/14px 14px}
.l-duotone .cover.g:after{display:none}
.l-duotone .hero-main{padding:0 24px}
.l-duotone .av{width:170px;margin:-96px auto 0;position:relative}
.l-duotone .av:after{content:"";position:absolute;inset:0;border-radius:28px;background:var(--p);mix-blend-mode:screen;opacity:.4;transform:rotate(-4deg);pointer-events:none}
.l-duotone .avatar{width:170px;height:170px;border-radius:28px;border:0;filter:grayscale(1) contrast(1.1);transform:rotate(-4deg);box-shadow:14px 14px 0 var(--s)}
.l-duotone .avatar.ph{filter:none}
.l-duotone .id{padding-top:30px}
.l-duotone .name{font-size:34px;font-weight:800;text-transform:uppercase;letter-spacing:-.02em;line-height:1}
.l-duotone .role{display:inline-block;margin-top:12px;padding:4px 12px;background:var(--p);color:var(--onp);font-weight:700;text-transform:uppercase;letter-spacing:.08em;font-size:12.5px;transform:rotate(-2deg)}
.l-duotone .company{background:var(--s);color:var(--ons)}
.l-duotone .act{border-radius:18px;background:var(--tx);color:var(--bg)}
.l-duotone .act span{color:inherit}
.l-duotone .act:hover{background:var(--p)}
.l-duotone .save{border-radius:18px;background:linear-gradient(90deg,var(--p),var(--s));box-shadow:6px 6px 0 var(--tx)}
.l-duotone .sec h3{color:var(--tx);font-size:13px;font-weight:800}
.l-duotone .sec h3 i{color:var(--p)}
.l-duotone .box,.l-duotone .links a,.l-duotone .pays a,.l-duotone .post,.l-duotone .prod{box-shadow:6px 6px 0 color-mix(in srgb,var(--s) 70%,transparent);border-color:var(--tx)}
.l-duotone .gal img,.l-duotone .post img{filter:grayscale(1) contrast(1.1)}
.l-duotone .gal a:hover img{filter:none}

/* ================================================================== monogram: letterpress crest with initials */
.l-monogram{--r:4px;background:repeating-linear-gradient(90deg,color-mix(in srgb,var(--tx) 3%,transparent) 0 1px,transparent 1px 7px),var(--bg)}
.l-monogram .cover{display:none}
.l-monogram .hero{padding-top:50px}
.l-monogram .deco{display:grid;place-items:center;width:132px;height:132px;margin:0 auto;border-radius:50%;color:var(--p);border:1.5px solid var(--p);box-shadow:0 0 0 6px var(--bg),0 0 0 7px color-mix(in srgb,var(--s) 70%,transparent),0 24px 40px -24px rgba(0,0,0,.4);background:radial-gradient(circle,color-mix(in srgb,var(--s) 10%,var(--bg)),var(--bg));animation:vc-pop .7s .1s cubic-bezier(.34,1.56,.64,1) both}
.l-monogram .deco span{font-family:'Playfair Display','Libre Baskerville',Georgia,serif;font-size:50px;font-weight:500;letter-spacing:.02em;line-height:1}
.l-monogram .av{margin:-30px 0 0;justify-content:center;transform:translateX(52px)}
.l-monogram .avatar{width:62px;height:62px;border:3px solid var(--bg);box-shadow:0 0 0 1px var(--s),0 10px 20px -10px rgba(0,0,0,.5)}
.l-monogram.no-av .av{display:none}
.l-monogram .id{padding-top:18px}
.l-monogram.no-av .id{padding-top:26px}
.l-monogram .name{font-size:27px;font-weight:600;letter-spacing:.14em;text-transform:uppercase}
.l-monogram .role{font-style:italic;font-size:16px;color:var(--s)}
.l-monogram .id-text:after{content:"\2726";display:block;margin-top:14px;color:var(--s);font-size:12px}
.l-monogram .company{background:transparent;color:var(--p);border-top:1px solid var(--s);border-bottom:1px solid var(--s);border-radius:0;letter-spacing:.12em;text-transform:uppercase;font-size:11px}
.l-monogram .loc{border:0}
.l-monogram .actions{padding:26px 24px 0}
.l-monogram .act{border-radius:4px;background:transparent;border:1px solid var(--p);color:var(--p);outline:1px solid color-mix(in srgb,var(--s) 60%,transparent);outline-offset:3px}
.l-monogram .act:hover{background:var(--p)}
.l-monogram .save{margin:18px 24px 0;border-radius:4px;letter-spacing:.2em;text-transform:uppercase;font-size:12.5px;box-shadow:none;outline:1px solid var(--p);outline-offset:4px}
.l-monogram .save:after{display:none}
.l-monogram .install{margin-inline:24px;width:calc(100% - 48px)}
.l-monogram .sec{padding:34px 24px 0}
.l-monogram .sec h3{justify-content:center;color:var(--p);letter-spacing:.28em}
.l-monogram .sec h3 i{display:none}
.l-monogram .sec h3:before,.l-monogram .sec h3:after{content:"";flex:1;height:0;border-top:3px double color-mix(in srgb,var(--s) 70%,transparent)}
.l-monogram .box,.l-monogram .links a,.l-monogram .pays a,.l-monogram .post,.l-monogram .prod,.l-monogram .embed{border-radius:2px;box-shadow:none;border-color:color-mix(in srgb,var(--p) 30%,transparent);outline:1px solid color-mix(in srgb,var(--s) 35%,transparent);outline-offset:3px}
.l-monogram .row>i:not(.go),.l-monogram .links a i,.l-monogram .pays a i{background:transparent;border:1px solid color-mix(in srgb,var(--s) 70%,transparent);border-radius:50%}
.l-monogram .social a{border-radius:50%;box-shadow:none}

/* ================================================================== timeline: identity on top, sections along a vertical line */
.l-timeline{--r:18px}
.l-timeline .cover{height:130px}
.l-timeline .hero,.l-timeline .name{text-align:start;justify-content:flex-start}
.l-timeline .hero-main{display:grid;grid-template-columns:auto 1fr;gap:16px;align-items:start;padding:0 22px}
.l-timeline .av{margin-top:-46px}
.l-timeline .avatar{width:104px;height:104px;border:4px solid var(--bg);box-shadow:0 0 0 2px var(--p),0 16px 30px -16px rgba(0,0,0,.4)}
.l-timeline .id{padding:14px 0 0;min-width:0}
.l-timeline .name{font-size:24px}
.l-timeline .meta{justify-content:flex-start;margin-top:10px}
.l-timeline .act{border-radius:16px}
.l-timeline .save{border-radius:16px}
.l-timeline .sec{position:relative;padding:22px 22px 0 60px}
.l-timeline .sec:before{content:"";position:absolute;left:33px;top:0;bottom:-8px;width:2px;background:linear-gradient(var(--p),var(--s));opacity:.35}
.l-timeline .sec h3{position:relative;margin-inline:0;color:var(--tx);font-size:12.5px}
.l-timeline .sec h3 i{position:absolute;left:-40px;top:50%;width:26px;height:26px;margin-top:-13px;border-radius:50%;display:grid;place-items:center;background:var(--p);color:var(--onp);font-size:13px;box-shadow:0 0 0 5px var(--bg),0 0 0 6px color-mix(in srgb,var(--p) 30%,transparent)}
.l-timeline .foot{padding-top:44px}
[dir=rtl] .l-timeline .sec{padding:22px 60px 0 22px}
[dir=rtl] .l-timeline .sec:before{left:auto;right:33px}
[dir=rtl] .l-timeline .sec h3 i{left:auto;right:-40px}

/* ================================================================== retro: 70s sunburst arcs, chunky outlines */
.l-retro{--r:22px}
.l-retro .cover{height:220px;background:var(--bg)}
.l-retro .cover.g{background:repeating-radial-gradient(circle at 50% 135%,var(--p) 0 26px,var(--s) 26px 52px,color-mix(in srgb,var(--p) 50%,var(--s)) 52px 78px,var(--bg) 78px 104px)}
.l-retro .cover.g:before,.l-retro .cover.g:after{display:none}
.l-retro .cover.img{border-bottom:4px solid var(--tx)}
.l-retro .av{margin-top:-74px}
.l-retro .avatar{width:140px;height:140px;border:4px solid var(--tx);box-shadow:6px 6px 0 var(--tx)}
.l-retro .name{font-size:32px;font-weight:800;letter-spacing:-.03em}
.l-retro .role{color:var(--p);font-weight:700}
.l-retro .company{background:var(--s);color:var(--ons);border:2px solid var(--tx)}
.l-retro .loc{border:2px solid var(--tx);color:var(--tx)}
.l-retro .act{border-radius:20px;background:var(--bg);border:3px solid var(--tx);color:var(--tx);box-shadow:3px 3px 0 var(--tx)}
.l-retro .act i{color:var(--p)}
.l-retro .act:hover{background:var(--s);color:var(--tx);box-shadow:5px 5px 0 var(--tx)}
.l-retro .act:hover i{color:var(--tx)}
.l-retro .save{border:3px solid var(--tx);box-shadow:5px 5px 0 var(--tx)}
.l-retro .save:after{display:none}
.l-retro .sec h3{color:var(--tx);font-size:14px;letter-spacing:.06em}
.l-retro .sec h3 i{color:var(--p)}
.l-retro .box,.l-retro .links a,.l-retro .social a,.l-retro .pays a,.l-retro .post,.l-retro .prod,.l-retro .embed{border:2.5px solid var(--tx);box-shadow:4px 4px 0 var(--tx)}
.l-retro .row>i:not(.go){background:var(--s);color:var(--tx);border:2px solid var(--tx);border-radius:50%}
.l-retro .links a i{background:var(--p);color:var(--onp)}
.l-retro .social a{border-radius:50%}

/* ================================================================== holo: iridescent holographic foil */
.l-holo{--r:22px;--holo:conic-gradient(from 0deg,var(--p),#f0abfc,var(--s),#a7f3d0,#fde68a,var(--p))}
.l-holo .cover{height:240px;-webkit-mask-image:linear-gradient(#000 50%,transparent);mask-image:linear-gradient(#000 50%,transparent)}
.l-holo .cover.g{background:var(--holo);filter:saturate(1.2);animation:vc-cover 1s var(--ease) both,pm-hue 10s linear infinite}
.l-holo .cover.g:before{background:linear-gradient(115deg,transparent 30%,rgba(255,255,255,.45) 45%,transparent 60%);background-size:250% 100%;animation:pm-foil 5s ease-in-out infinite}
.l-holo .av{margin-top:-96px}
.l-holo .avatar{border:0;padding:4px;background:var(--holo);box-shadow:inset 0 0 0 3px var(--bg),0 20px 50px -18px var(--p)}
.l-holo .name{background:linear-gradient(90deg,var(--tx),var(--p),var(--s),var(--tx));background-size:300% 100%;-webkit-background-clip:text;background-clip:text;color:transparent;animation:pm-foil 8s ease-in-out infinite}
.l-holo .name i{-webkit-text-fill-color:var(--s)}
.l-holo .company{background:transparent;border:1.5px solid transparent;background:linear-gradient(var(--bg),var(--bg)) padding-box,var(--holo) border-box;color:var(--tx)}
.l-holo .act,.l-holo .box,.l-holo .links a,.l-holo .social a,.l-holo .pays a,.l-holo .post,.l-holo .prod,.l-holo .embed{border:1.5px solid transparent;background:linear-gradient(var(--card),var(--card)) padding-box,linear-gradient(135deg,color-mix(in srgb,var(--p) 70%,transparent),color-mix(in srgb,var(--s) 70%,transparent),color-mix(in srgb,#f0abfc 60%,transparent)) border-box}
.l-holo .act{border-radius:22px;color:var(--p)}
.l-holo .act:hover{background:var(--holo);color:#111}
.l-holo .act:hover span{color:#111}
.l-holo .save{background:var(--holo);color:#111;background-size:200% 200%;animation:vc-up .6s .58s var(--ease) both,pm-hue 10s linear infinite}
.l-holo .sec h3 i{color:var(--s)}
@keyframes pm-hue{to{filter:hue-rotate(360deg)}}
@keyframes pm-foil{0%,100%{background-position:0% 50%}50%{background-position:100% 50%}}

/* ================================================================== spotlight: dark stage lit from above */
.l-spotlight{--r:18px;background:radial-gradient(42% 30% at 50% 0%,color-mix(in srgb,var(--p) 40%,transparent),transparent 100%),var(--bg)}
.l-spotlight:before{content:"";position:absolute;left:50%;top:-40px;width:520px;height:620px;margin-left:-260px;z-index:-1;background:conic-gradient(from 160deg at 50% 0%,transparent 0deg,color-mix(in srgb,var(--p) 30%,transparent) 20deg,color-mix(in srgb,#fff 10%,transparent) 20deg 22deg,color-mix(in srgb,var(--p) 18%,transparent) 30deg,transparent 40deg);-webkit-mask-image:linear-gradient(#000 30%,transparent);mask-image:linear-gradient(#000 30%,transparent);animation:vc-fade 1.6s .2s ease both}
.l-spotlight .cover{display:none}
.l-spotlight .hero{padding-top:70px}
.l-spotlight .av{margin:0}
.l-spotlight .avatar{width:150px;height:150px;border:0;box-shadow:0 0 0 1px color-mix(in srgb,var(--p) 60%,transparent),0 -20px 60px -20px var(--p),0 40px 60px -30px #000}
.l-spotlight .av:after{content:"";position:absolute;left:50%;bottom:-26px;width:220px;height:34px;margin-left:-110px;border-radius:50%;background:radial-gradient(closest-side,color-mix(in srgb,var(--p) 45%,transparent),transparent);z-index:-1}
.l-spotlight .id{padding-top:34px}
.l-spotlight .name{font-size:36px;font-weight:600;letter-spacing:-.01em}
.l-spotlight .role{color:var(--p);letter-spacing:.22em;text-transform:uppercase;font-size:11.5px;font-weight:700}
.l-spotlight .company{background:transparent;border:1px solid color-mix(in srgb,var(--p) 45%,transparent);color:var(--tx)}
.l-spotlight .act{border-radius:16px;background:color-mix(in srgb,var(--tx) 5%,transparent);border:1px solid var(--line);color:var(--p)}
.l-spotlight .act:hover{background:var(--p);color:var(--onp);box-shadow:0 0 40px -6px var(--p)}
.l-spotlight .save{border-radius:16px;box-shadow:0 0 50px -10px var(--p)}
.l-spotlight .sec h3{color:var(--p);letter-spacing:.24em}
.l-spotlight .box,.l-spotlight .links a,.l-spotlight .social a,.l-spotlight .pays a,.l-spotlight .post,.l-spotlight .prod,.l-spotlight .embed{background:linear-gradient(180deg,color-mix(in srgb,var(--tx) 6%,transparent),color-mix(in srgb,var(--tx) 2%,transparent));box-shadow:none}
`;
