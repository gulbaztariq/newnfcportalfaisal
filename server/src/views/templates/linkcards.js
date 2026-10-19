/*
 * Link-card layouts (appended after business.js): a centred identity block with a glowing ring, location / hours chips and a
 * stack of rich link cards (brand icon tile, title, subtitle, chevron, optional badge, highlighted card).
 * All layouts are in LINK_LAYOUTS (catalog.js); render.js adds the shared `.lk` class and the .hrs chip.
 */
module.exports = String.raw`
.hrs,.br{display:none}

/* ================================================================== menu / catalogue page viewer */
.mv{position:fixed;inset:0;z-index:70;background:#07080c;display:none;flex-direction:column;color:#fff}
.mv.show{display:flex;animation:vc-fade .25s ease}
.mv-bar{display:flex;align-items:center;gap:12px;padding:12px 16px calc(8px);flex:none}
.mv-bar b{flex:1;font-size:16px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.mv-bar span{font-size:13px;opacity:.75;font-variant-numeric:tabular-nums}
.mv-x{width:42px;height:42px;border-radius:50%;border:0;background:rgba(255,255,255,.14);color:#fff;font-size:24px;line-height:1;cursor:pointer}
.mv-track{flex:1;min-height:0;display:flex;overflow-x:auto;overflow-y:hidden;scroll-snap-type:x mandatory;scrollbar-width:none;-webkit-overflow-scrolling:touch}
.mv-track::-webkit-scrollbar{display:none}
.mv-s{flex:0 0 100%;min-width:0;scroll-snap-align:center;scroll-snap-stop:always;display:grid;place-items:center;overflow:auto;padding:0 10px 18px}
.mv-s img{max-width:100%;max-height:100%;object-fit:contain;border-radius:10px;cursor:zoom-in;background:#111;user-select:none}
.mv-s.z{place-items:start}
.mv-s.z img{max-width:none;max-height:none;width:230%;cursor:zoom-out}
.mv-n{position:absolute;top:50%;width:46px;height:46px;margin-top:-23px;border-radius:50%;border:0;background:rgba(255,255,255,.16);color:#fff;font-size:26px;cursor:pointer;display:grid;place-items:center;backdrop-filter:blur(8px)}
.mv-n.prev{left:12px}.mv-n.next{right:12px}
@media(hover:none){.mv-n{display:none}}
.s-menu .links a small{font-weight:500}

/* ================================================================== shared base */
.lk{--r:22px;background:var(--bg)}
.lk:before{content:"";position:absolute;left:0;right:0;top:0;height:560px;z-index:-1;pointer-events:none;background:radial-gradient(60% 50% at 50% 0%,color-mix(in srgb,var(--p) 28%,transparent),transparent 72%),radial-gradient(40% 30% at 90% 30%,color-mix(in srgb,var(--s) 12%,transparent),transparent 70%)}
.lk .cover{display:none}
.lk .hero{padding-top:54px}
.lk .av{margin:0}
.lk .avatar{width:138px;height:138px;border:0;padding:4px;background:linear-gradient(135deg,var(--p),var(--s));box-shadow:inset 0 0 0 4px var(--bg),0 0 70px -10px color-mix(in srgb,var(--p) 80%,transparent);object-fit:cover}
.lk .avatar.ph{color:var(--onp);font-size:44px}
.lk .id{padding-top:22px}
.lk .name{font-size:31px;font-weight:800;letter-spacing:-.03em}
.lk .name i{color:var(--p)}
.lk .role{font-size:17px;margin-top:6px;opacity:.75;color:var(--tx);font-weight:400}
.lk .meta{flex-direction:row;flex-wrap:wrap;justify-content:center;align-items:center;gap:10px;margin-top:18px}
.lk .br{display:block;flex-basis:100%;height:0;margin:-4px 0}
.lk .company,.lk .loc,.lk .hrs{display:inline-flex;align-items:center;gap:7px;padding:8px 16px;border-radius:999px;background:color-mix(in srgb,var(--tx) 6%,var(--bg));border:1px solid var(--line);color:var(--tx);font-size:14px;font-weight:600;line-height:1.3}
.lk .company{color:var(--p)}
.lk .loc i,.lk .hrs i{color:var(--p)}
.lk .actions{display:none}
.lk .save{margin:22px 20px 0;height:50px;border-radius:16px;font-size:15px;font-weight:700;box-shadow:none;background:color-mix(in srgb,var(--tx) 7%,var(--bg));color:var(--tx);border:1px solid var(--line)}
.lk .save:after{display:none}
.lk .save i{color:var(--p)}
.lk .sec{padding:18px 20px 0}
.lk .s-links{padding-top:22px}
.lk .sec h3{justify-content:center;color:var(--muted)}
.lcards{display:grid;gap:12px}
.lcard{position:relative;display:flex;align-items:center;gap:14px;padding:14px 16px;border-radius:var(--r);background:var(--card);border:1px solid var(--line);box-shadow:var(--sh);transition:transform .3s var(--ease),border-color .25s,box-shadow .3s,background .25s;animation:vc-up .6s var(--ease) both}
.lcard:nth-child(2){animation-delay:.06s}.lcard:nth-child(3){animation-delay:.12s}.lcard:nth-child(4){animation-delay:.18s}.lcard:nth-child(5){animation-delay:.24s}.lcard:nth-child(n+6){animation-delay:.3s}
.lcard:hover{transform:translateY(-2px);border-color:color-mix(in srgb,var(--ic) 55%,transparent)}
.lcard:active{transform:scale(.985)}
.lic{flex:none;width:54px;height:54px;border-radius:16px;display:grid;place-items:center;font-size:26px;color:var(--ic);background:color-mix(in srgb,var(--ic) 15%,transparent);border:1px solid color-mix(in srgb,var(--ic) 32%,transparent)}
.ltx{min-width:0;flex:1;display:flex;flex-direction:column;gap:2px}
.ltx b{display:flex;align-items:center;flex-wrap:wrap;gap:8px;font-size:17.5px;font-weight:700;letter-spacing:-.01em;line-height:1.25}
.ltx em{font-style:normal;padding:3px 10px;border-radius:999px;background:linear-gradient(90deg,var(--p),var(--s));color:var(--onp);font-size:11px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;line-height:1.2}
.ltx small{color:var(--muted);font-size:14px;line-height:1.35;overflow-wrap:anywhere}
.lcard .go{flex:none;font-size:22px;color:var(--muted);transition:transform .25s var(--ease),color .25s}
.lcard:hover .go{transform:translateX(3px);color:var(--ic)}
.lcard.feat{--ic:var(--p);border-color:color-mix(in srgb,var(--p) 50%,transparent);background:linear-gradient(135deg,color-mix(in srgb,var(--p) 18%,var(--card)),color-mix(in srgb,var(--s) 8%,var(--card)));box-shadow:0 0 44px -16px var(--p)}
.lk .box,.lk .pays a,.lk .post,.lk .prod,.lk .embed{border-radius:var(--r)}
.lk .foot{padding-top:34px}

/* ================================================================== ember: warm black with an orange glow (restaurants, food) */
.l-lkember .lic{border-radius:16px}

/* ================================================================== midnight: deep indigo, round icon tiles */
.l-lkmidnight{--r:18px}
.l-lkmidnight:before{background:radial-gradient(70% 50% at 50% 0%,color-mix(in srgb,var(--p) 34%,transparent),transparent 72%),radial-gradient(50% 40% at 0% 40%,color-mix(in srgb,var(--s) 14%,transparent),transparent 70%)}
.l-lkmidnight .lic{border-radius:50%}
.l-lkmidnight .lcard{background:linear-gradient(135deg,color-mix(in srgb,var(--tx) 7%,transparent),color-mix(in srgb,var(--tx) 2%,transparent))}
.l-lkmidnight .name{font-weight:700;letter-spacing:-.02em}

/* ================================================================== frost: frosted glass over a colour wash */
.l-lkglass{--r:24px;background:linear-gradient(160deg,color-mix(in srgb,var(--p) 30%,var(--bg)),var(--bg) 45%,color-mix(in srgb,var(--s) 26%,var(--bg)))}
.l-lkglass .lcard,.l-lkglass .save,.l-lkglass .company,.l-lkglass .loc,.l-lkglass .hrs,.l-lkglass .box{background:rgba(255,255,255,.09);border-color:rgba(255,255,255,.2);backdrop-filter:blur(16px) saturate(1.4);-webkit-backdrop-filter:blur(16px) saturate(1.4)}
.l-lkglass .lic{background:rgba(255,255,255,.14);border-color:rgba(255,255,255,.25)}
.l-lkglass .lcard.feat{background:linear-gradient(135deg,color-mix(in srgb,var(--p) 40%,transparent),rgba(255,255,255,.08))}

/* ================================================================== mint: light and fresh, solid colour icon tiles */
.l-lkmint{--r:20px}
.l-lkmint:before{background:radial-gradient(60% 40% at 50% 0%,color-mix(in srgb,var(--p) 22%,transparent),transparent 72%)}
.l-lkmint .lcard{background:#fff;border-color:transparent;box-shadow:0 1px 2px rgba(15,40,30,.05),0 14px 30px -20px rgba(15,40,30,.3)}
.l-lkmint .lic{background:var(--ic);color:#fff;border:0;box-shadow:0 10px 18px -10px var(--ic)}
.l-lkmint .lcard[style*="#fffc00"] .lic{color:#111}
.l-lkmint .lcard.feat .lic{color:var(--onp)}
.l-lkmint .lcard.feat{background:linear-gradient(135deg,color-mix(in srgb,var(--p) 14%,#fff),#fff)}
.l-lkmint .save,.l-lkmint .company,.l-lkmint .loc,.l-lkmint .hrs{background:#fff;border-color:transparent;box-shadow:0 8px 20px -16px rgba(15,40,30,.4)}

/* ================================================================== cream: warm paper, serif titles, stamped squares */
.l-lkcream{--r:14px}
.l-lkcream:before{background:radial-gradient(60% 40% at 50% 0%,color-mix(in srgb,var(--p) 14%,transparent),transparent 72%)}
.l-lkcream .name,.l-lkcream .ltx b{font-family:'Fraunces','Playfair Display',Georgia,serif}
.l-lkcream .avatar{background:conic-gradient(var(--p),var(--s),var(--p));box-shadow:inset 0 0 0 4px var(--bg),0 18px 36px -20px var(--p)}
.l-lkcream .lcard{background:#fffdf8;border:1.5px solid color-mix(in srgb,var(--tx) 78%,transparent);box-shadow:4px 4px 0 color-mix(in srgb,var(--tx) 78%,transparent)}
.l-lkcream .lcard:hover{transform:translate(-2px,-2px);box-shadow:6px 6px 0 color-mix(in srgb,var(--tx) 78%,transparent)}
.l-lkcream .lic{border-radius:10px;background:color-mix(in srgb,var(--ic) 14%,#fffdf8);border:1.5px solid var(--tx);color:var(--tx)}
.l-lkcream .lcard.feat{background:color-mix(in srgb,var(--p) 14%,#fffdf8)}
.l-lkcream .save,.l-lkcream .company,.l-lkcream .loc,.l-lkcream .hrs{background:#fffdf8;border:1.5px solid var(--tx)}

/* ================================================================== volt: black, hard neon outlines */
.l-lkneon{--r:12px}
.l-lkneon:before{background:linear-gradient(color-mix(in srgb,var(--p) 14%,transparent) 1px,transparent 1px) 0 0/100% 34px,linear-gradient(90deg,color-mix(in srgb,var(--p) 14%,transparent) 1px,transparent 1px) 0 0/34px 100%;-webkit-mask-image:linear-gradient(#000,transparent 85%);mask-image:linear-gradient(#000,transparent 85%)}
.l-lkneon .avatar{background:var(--p);box-shadow:inset 0 0 0 4px var(--bg),0 0 34px var(--p),0 0 80px -10px var(--s)}
.l-lkneon .name{text-shadow:0 0 22px color-mix(in srgb,var(--p) 60%,transparent);letter-spacing:-.02em}
.l-lkneon .lcard{background:color-mix(in srgb,var(--p) 4%,transparent);border:1px solid color-mix(in srgb,var(--ic) 55%,transparent);box-shadow:inset 0 0 20px -12px var(--ic)}
.l-lkneon .lcard:hover{box-shadow:0 0 28px -6px var(--ic),inset 0 0 20px -8px var(--ic)}
.l-lkneon .lic{border-radius:8px;background:transparent;filter:drop-shadow(0 0 6px var(--ic))}
.l-lkneon .company,.l-lkneon .loc,.l-lkneon .hrs,.l-lkneon .save{border-radius:8px;border-color:color-mix(in srgb,var(--p) 50%,transparent);background:transparent}
.l-lkneon .ltx em{border-radius:4px}

/* ================================================================== royal: black and gold, serif, hairline gold cards */
.l-lkroyal{--r:14px}
.l-lkroyal:before{background:radial-gradient(60% 40% at 50% 0%,color-mix(in srgb,var(--p) 22%,transparent),transparent 72%)}
.l-lkroyal .name,.l-lkroyal .ltx b{font-weight:500;letter-spacing:.02em}
.l-lkroyal .name{font-size:35px}
.l-lkroyal .role{text-transform:uppercase;letter-spacing:.22em;font-size:12px;color:var(--p);opacity:1;font-weight:600}
.l-lkroyal .avatar{background:linear-gradient(135deg,var(--p),var(--s),var(--p))}
.l-lkroyal .lcard{--ic:var(--p);background:color-mix(in srgb,var(--p) 5%,transparent);border-color:color-mix(in srgb,var(--p) 35%,transparent);box-shadow:none}
.l-lkroyal .lic{border-radius:50%;background:transparent;border-color:color-mix(in srgb,var(--p) 55%,transparent)}
.l-lkroyal .ltx em{border-radius:2px;letter-spacing:.14em}
.l-lkroyal .company,.l-lkroyal .loc,.l-lkroyal .hrs,.l-lkroyal .save{border-radius:2px;background:transparent;border-color:color-mix(in srgb,var(--p) 40%,transparent)}
.l-lkroyal .save{letter-spacing:.2em;text-transform:uppercase;font-size:12.5px}

/* ================================================================== dusk: gradient evening sky, bright cards */
.l-lksunset{--r:22px;background:linear-gradient(170deg,var(--bg),color-mix(in srgb,var(--p) 40%,var(--bg)) 60%,color-mix(in srgb,var(--s) 55%,var(--bg)))}
.l-lksunset .lcard{background:rgba(255,255,255,.95);color:#1a1020;border-color:transparent;box-shadow:0 16px 30px -18px rgba(0,0,0,.6)}
.l-lksunset .lcard small,.l-lksunset .lcard .go{color:#6b5b70}
.l-lksunset .lic{background:var(--ic);color:#fff;border:0}
.l-lksunset .lcard[style*="#fffc00"] .lic,.l-lksunset .lcard[style*="#25f4ee"] .lic{color:#111}
.l-lksunset .lcard.feat{background:linear-gradient(135deg,#fff,color-mix(in srgb,var(--p) 18%,#fff))}
.l-lksunset .lcard.feat .lic{color:var(--onp)}
.l-lksunset .save,.l-lksunset .company,.l-lksunset .loc,.l-lksunset .hrs{background:rgba(255,255,255,.12);border-color:rgba(255,255,255,.25)}

/* ================================================================== line: black outlines on white, monochrome icons */
.l-lkmono{--r:14px}
.l-lkmono:before{display:none}
.l-lkmono .avatar{background:var(--tx);box-shadow:inset 0 0 0 4px var(--bg)}
.l-lkmono .name{font-weight:700;letter-spacing:-.04em}
.l-lkmono .name i{color:var(--tx)}
.l-lkmono .lcard{--ic:var(--tx);background:transparent;border:1.5px solid var(--tx);box-shadow:none}
.l-lkmono .lcard:hover{background:var(--tx);color:var(--bg);border-color:var(--tx)}
.l-lkmono .lcard:hover small,.l-lkmono .lcard:hover .go{color:var(--bg)}
.l-lkmono .lic{background:transparent;border:1.5px solid currentColor;color:inherit;border-radius:50%}
.l-lkmono .ltx em{background:var(--tx);color:var(--bg);border-radius:4px}
.l-lkmono .lcard.feat{background:color-mix(in srgb,var(--tx) 6%,transparent)}
.l-lkmono .company,.l-lkmono .loc,.l-lkmono .hrs,.l-lkmono .save{background:transparent;border:1.5px solid var(--tx)}
.l-lkmono .loc i,.l-lkmono .hrs i,.l-lkmono .save i,.l-lkmono .company{color:var(--tx)}

/* ================================================================== candy: bubbly, thick outlines, pastel */
.l-lkcandy{--r:28px}
.l-lkcandy:before{background:radial-gradient(40% 25% at 15% 5%,color-mix(in srgb,var(--p) 30%,transparent),transparent 70%),radial-gradient(40% 25% at 90% 18%,color-mix(in srgb,var(--s) 30%,transparent),transparent 70%)}
.l-lkcandy .name{font-weight:800}
.l-lkcandy .avatar{box-shadow:inset 0 0 0 4px var(--bg),8px 8px 0 var(--s)}
.l-lkcandy .lcard{background:#fff;border:3px solid var(--tx);box-shadow:5px 5px 0 var(--ic);color:#2a1020}
.l-lkcandy .lcard:hover{transform:translate(-2px,-2px);box-shadow:7px 7px 0 var(--ic);border-color:var(--tx)}
.l-lkcandy .lcard small,.l-lkcandy .lcard .go{color:#7a5a6e}
.l-lkcandy .lic{border-radius:50%;width:56px;height:56px;background:var(--ic);color:#fff;border:3px solid var(--tx)}
.l-lkcandy .lcard[style*="#fffc00"] .lic,.l-lkcandy .lcard[style*="#25f4ee"] .lic{color:#111}
.l-lkcandy .lcard.feat{--ic:var(--s);background:color-mix(in srgb,var(--p) 14%,#fff)}
.l-lkcandy .lcard.feat .lic{color:var(--ons)}
.l-lkcandy .ltx em{border:2px solid var(--tx)}
.l-lkcandy .company,.l-lkcandy .loc,.l-lkcandy .hrs,.l-lkcandy .save{background:#fff;border:2.5px solid var(--tx);color:#2a1020}
`;
