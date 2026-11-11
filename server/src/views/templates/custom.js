/*
 * Card customisation: the validated schema for `vcard.theme`, and the CSS it produces.
 *
 * `theme` is plain data (colours, enums, numbers, whitelisted font names). Nothing from it is ever copied into the
 * stylesheet as free text: colours must match #rrggbb, fonts must be in GOOGLE_FONTS, every other option is an enum,
 * a clamped number or a boolean. Options only add a modifier class (c-*) or a CSS variable on <main class="wrap">,
 * so a card that has no custom options renders exactly as before.
 */
const GOOGLE_FONTS = {
  Inter: 'Inter:wght@400;500;600;700;800',
  Poppins: 'Poppins:wght@400;500;600;700;800',
  'Playfair Display': 'Playfair+Display:wght@400;500;600;700',
  Montserrat: 'Montserrat:wght@400;500;600;700;800',
  Lora: 'Lora:wght@400;500;600;700',
  'Space Grotesk': 'Space+Grotesk:wght@400;500;600;700',
  Roboto: 'Roboto:wght@400;500;700',
  Lato: 'Lato:wght@400;700;900',
  'Open Sans': 'Open+Sans:wght@400;600;700',
  'DM Sans': 'DM+Sans:wght@400;500;600;700',
  Outfit: 'Outfit:wght@400;500;600;700',
  'Plus Jakarta Sans': 'Plus+Jakarta+Sans:wght@400;500;600;700',
  Manrope: 'Manrope:wght@400;500;600;700',
  'Cormorant Garamond': 'Cormorant+Garamond:wght@400;500;600;700',
  Fraunces: 'Fraunces:wght@400;500;600;700',
  Sora: 'Sora:wght@400;500;600;700',
  Syne: 'Syne:wght@400;500;600;700',
  'JetBrains Mono': 'JetBrains+Mono:wght@400;500;600;700',
  'IBM Plex Mono': 'IBM+Plex+Mono:wght@400;500;600;700',
  Quicksand: 'Quicksand:wght@400;500;600;700',
  Urbanist: 'Urbanist:wght@400;500;600;700',
  Rubik: 'Rubik:wght@400;500;600;700',
  Lexend: 'Lexend:wght@400;500;600;700',
  'IBM Plex Sans': 'IBM+Plex+Sans:wght@400;500;600;700',
  Figtree: 'Figtree:wght@400;500;600;700',
  Barlow: 'Barlow:wght@400;500;600;700',
  Bitter: 'Bitter:wght@400;500;600;700',
  'Bodoni Moda': 'Bodoni+Moda:wght@400;500;600;700',
  Unbounded: 'Unbounded:wght@400;500;600;700',
  'Chakra Petch': 'Chakra+Petch:wght@400;500;600;700',
  'EB Garamond': 'EB+Garamond:wght@400;500;600;700',
  'Libre Franklin': 'Libre+Franklin:wght@400;500;600;700',
  Nunito: 'Nunito:wght@400;500;600;700;800',
  'Bricolage Grotesque': 'Bricolage+Grotesque:wght@400;500;600;700;800',
  Archivo: 'Archivo:wght@400;500;600;700;800',
  'Baloo 2': 'Baloo+2:wght@400;500;600;700;800',
  'Libre Baskerville': 'Libre+Baskerville:wght@400;700',
  Amiri: 'Amiri:wght@400;700',
};
const SERIF = new Set(['Playfair Display', 'Lora', 'Cormorant Garamond', 'Fraunces', 'Bitter', 'Bodoni Moda', 'EB Garamond', 'Libre Baskerville', 'Amiri']);
const MONO = new Set(['JetBrains Mono', 'IBM Plex Mono']);

const HEX = /^#[0-9a-f]{6}$/i;
const COLORS = ['primary', 'secondary', 'background', 'text', 'accent', 'heading', 'button', 'button_text', 'icon', 'border', 'surface', 'bg2'];
const FONT_KEYS = ['font', 'heading_font', 'name_font'];
const ENUMS = {
  radius: ['sharp', 'soft', 'round'],
  bg_type: ['solid', 'linear', 'radial', 'mesh', 'dots', 'grid', 'lines', 'animated', 'image'],
  align: ['start', 'center'],
  avatar_shape: ['circle', 'rounded', 'square'],
  avatar_size: ['s', 'm', 'l'],
  spacing: ['compact', 'cozy', 'airy'],
  width: ['narrow', 'wide'],
  btn_style: ['pill', 'rounded', 'square', 'outline', 'soft'],
  act_layout: ['row', 'grid'],
  social_style: ['filled', 'outline', 'plain', 'brand'],
  social_shape: ['round', 'square'],
  shadow: ['none', 'soft', 'strong'],
  anim: ['none', 'fade', 'slide', 'zoom'],
  anim_speed: ['slow', 'fast'],
  anim_intensity: ['subtle', 'strong'],
  reveal: ['off'],
};
// [min, max, decimals]
const NUMBERS = { weight: [300, 800, 0], scale: [0.85, 1.2, 2], tracking: [-0.04, 0.12, 3], leading: [1.3, 1.9, 2], bg_angle: [0, 360, 0] };
const BOOLS = ['hide_cover', 'hide_actions', 'hide_save', 'hide_meta', 'hide_role'];
const BG_IMAGE = /^\/uploads\/vcards\/[\w.-]{1,120}$/;
const KEYS = [...COLORS, ...FONT_KEYS, ...Object.keys(ENUMS), ...Object.keys(NUMBERS), ...BOOLS, 'bg_image'];
// layouts whose photo is the hero image itself: avatar shape / size are part of the design and stay fixed
const AVATAR_FIXED = new Set(['photo', 'editorial', 'cinema', 'splithero', 'paper', ...Object.keys(require('./signature').ARCH)]);

const fontName = (f) => String(f || '').split(',')[0].replace(/['"]/g, '').trim();
const fontStack = (name) => `'${name}', ${MONO.has(name) ? 'ui-monospace, monospace' : SERIF.has(name) ? 'Georgia, serif' : 'system-ui, sans-serif'}`;

/** one option -> its clean value, or undefined when it is not acceptable */
function clean(key, val) {
  if (COLORS.includes(key)) return typeof val === 'string' && HEX.test(val) ? val.toLowerCase() : undefined;
  if (FONT_KEYS.includes(key)) { const n = fontName(val); return GOOGLE_FONTS[n] ? fontStack(n) : undefined; }
  if (ENUMS[key]) return ENUMS[key].includes(val) ? val : undefined;
  if (NUMBERS[key]) {
    const [min, max, dp] = NUMBERS[key];
    const n = Number(val);
    if (val === '' || val === null || typeof val === 'boolean' || !Number.isFinite(n)) return undefined;
    return Number(Math.min(max, Math.max(min, n)).toFixed(dp));
  }
  if (BOOLS.includes(key)) return val === true || val === 'true' || val === '1' || val === 1 ? true : undefined;
  if (key === 'bg_image') return typeof val === 'string' && BG_IMAGE.test(val) ? val : undefined;
  return undefined;
}

/**
 * Merge an incoming theme into the saved one. Unknown keys are dropped, invalid values are ignored (the saved value stays),
 * and '' / null / false removes an option so the template default applies again.
 */
function sanitizeTheme(incoming, saved = {}) {
  const out = {};
  for (const k of KEYS) { const v = clean(k, (saved || {})[k]); if (v !== undefined) out[k] = v; }
  if (!incoming || typeof incoming !== 'object' || Array.isArray(incoming)) return out;
  for (const k of KEYS) {
    if (!Object.hasOwn(incoming, k)) continue;
    const raw = incoming[k];
    if (raw === '' || raw === null || raw === false || raw === 'false' || raw === '0') { delete out[k]; continue; }
    const v = clean(k, raw);
    if (v !== undefined) out[k] = v;
  }
  return out;
}

const hexLum = (c) => {
  const h = String(c).replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => { const x = parseInt(h.slice(i, i + 2), 16) / 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
/** WCAG contrast ratio between two #rrggbb colours (1 to 21) */
const contrast = (a, b) => { const [x, y] = [hexLum(a), hexLum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
const readable = (c) => (hexLum(c) > 0.38 ? '#0b0f19' : '#ffffff');

/**
 * Custom options -> CSS variables, modifier classes and extra font families for one card.
 * `t` must already be sanitised; `base` carries the resolved core colours of the card.
 */
function customOf(t, { layout, bg, dark }) {
  const vars = [];
  const cls = [];
  const fonts = [];
  const o = sanitizeTheme({}, t);
  if (o.heading && contrast(o.heading, bg) >= 2) { vars.push(`--hd:${o.heading}`); cls.push('c-hd'); }
  if (o.button) {
    const on = o.button_text && contrast(o.button_text, o.button) >= 2.5 ? o.button_text : readable(o.button);
    vars.push(`--btn:${o.button}`, `--onbtn:${on}`); cls.push('c-btn');
  } else if (o.button_text) { vars.push(`--onbtn:${o.button_text}`); cls.push('c-onbtn'); }
  if (o.icon) { vars.push(`--icn:${o.icon}`); cls.push('c-icn'); }
  if (o.accent) vars.push(`--chip:color-mix(in srgb,${o.accent} ${dark ? 20 : 13}%,transparent)`, `--acc:${o.accent}`), cls.push('c-acc');
  if (o.border) vars.push(`--line:${o.border}`);
  if (o.surface) vars.push(`--card:${o.surface}`), cls.push('c-sf');

  const b2 = o.bg2 || `color-mix(in srgb,var(--p) ${dark ? 26 : 14}%,var(--bg))`;
  if (o.bg_type && o.bg_type !== 'solid' && !(o.bg_type === 'image' && !o.bg_image)) {
    vars.push(`--bg2:${b2}`, `--bga:${o.bg_angle ?? 160}deg`);
    if (o.bg_type === 'image') vars.push(`--bgi:url('${o.bg_image}')`);
    cls.push('c-bg', `c-bg-${o.bg_type}`);
  } else if (o.bg_type === 'solid') cls.push('c-bg', 'c-bg-solid');

  for (const [key, v] of [['heading_font', '--hfont'], ['name_font', '--nfont']]) {
    if (!o[key]) continue;
    vars.push(`${v}:${o[key]}`); cls.push(key === 'heading_font' ? 'c-hf' : 'c-nf'); fonts.push(GOOGLE_FONTS[fontName(o[key])]);
  }
  if (o.weight) vars.push(`--fw:${o.weight}`), cls.push('c-fw');
  if (o.scale && o.scale !== 1) vars.push(`--fs:${o.scale}`), cls.push('c-fs');
  if (o.tracking !== undefined && o.tracking !== 0) vars.push(`--ls:${o.tracking}em`), cls.push('c-ls');
  if (o.leading) vars.push(`--lh:${o.leading}`), cls.push('c-lh');

  for (const k of ['align', 'spacing', 'width', 'btn_style', 'act_layout', 'social_style', 'social_shape', 'shadow', 'anim', 'anim_speed', 'anim_intensity', 'reveal']) if (o[k]) cls.push(`c-${k.replace('_', '')}-${o[k]}`);
  if (!AVATAR_FIXED.has(layout)) { if (o.avatar_shape) cls.push(`c-avs-${o.avatar_shape}`); if (o.avatar_size) cls.push(`c-avz-${o.avatar_size}`); }
  for (const k of BOOLS) if (o[k]) cls.push(`c-${k.replace('_', '-')}`);
  return { vars: vars.join(';'), cls, fonts: [...new Set(fonts)] };
}

/* Generic option styles. `.wrap.c-x` has higher specificity than any `.l-layout .thing` rule, and this sheet is appended last. */
const CUSTOM_CSS = String.raw`
/* colours */
.wrap.c-hd .name,.wrap.c-hd .sec h3,.wrap.c-hd .sec h3 i,.wrap.c-hd .page-body h1{color:var(--hd)}
.wrap.c-btn .save,.wrap.c-btn .btn,.wrap.c-btn .prod .row2 .pri,.wrap.c-btn .chips button.on,.wrap.c-btn .appt .day.on,.wrap.c-btn .appt .slot.on{background:var(--btn);color:var(--onbtn);border-color:var(--btn)}
.wrap.c-btn .save{box-shadow:0 18px 34px -18px var(--btn)}
.wrap.c-btn~.sticky .main{background:var(--btn);color:var(--onbtn)}
.wrap.c-onbtn .save,.wrap.c-onbtn .btn{color:var(--onbtn)}
.wrap.c-icn .x-a:not(:hover) i,.wrap.c-icn .social a:not(:hover),.wrap.c-icn .row>i:not(.go),.wrap.c-icn .act:not(:hover),.wrap.c-icn .links a i,.wrap.c-icn .pays a i,.wrap.c-icn .svc .ic,.wrap.c-icn .sec h3 i{color:var(--icn)}
.wrap.c-acc .company,.wrap.c-acc .hours .d.today,.wrap.c-acc .hours .d.today span:last-child,.wrap.c-acc .svc .more,.wrap.c-acc .prod .price,.wrap.c-acc .name i{color:var(--acc)}
.wrap.c-acc .hours .d.today span:first-child:after{background:var(--acc)}
.wrap.c-sf .box,.wrap.c-sf .links a,.wrap.c-sf .social a,.wrap.c-sf .pays a,.wrap.c-sf .post,.wrap.c-sf .prod,.wrap.c-sf .lcard{background:var(--card)}

/* background */
.wrap.c-bg-solid{background:var(--bg)}
.wrap.c-bg-linear{background:linear-gradient(var(--bga),var(--bg),var(--bg2))}
.wrap.c-bg-radial{background:radial-gradient(120% 70% at 50% 0%,var(--bg2),var(--bg) 70%)}
.wrap.c-bg-mesh{background:radial-gradient(60% 40% at 0% 0%,var(--bg2),transparent 70%),radial-gradient(55% 40% at 100% 30%,color-mix(in srgb,var(--s) 22%,transparent),transparent 70%),radial-gradient(70% 45% at 30% 100%,var(--bg2),transparent 70%),var(--bg)}
.wrap.c-bg-dots{background:radial-gradient(color-mix(in srgb,var(--tx) 16%,transparent) 1px,transparent 1.4px) 0 0/18px 18px,linear-gradient(var(--bga),var(--bg),var(--bg2))}
.wrap.c-bg-grid{background:linear-gradient(color-mix(in srgb,var(--tx) 7%,transparent) 1px,transparent 1px) 0 0/26px 26px,linear-gradient(90deg,color-mix(in srgb,var(--tx) 7%,transparent) 1px,transparent 1px) 0 0/26px 26px,linear-gradient(var(--bga),var(--bg),var(--bg2))}
.wrap.c-bg-lines{background:repeating-linear-gradient(135deg,color-mix(in srgb,var(--tx) 6%,transparent) 0 1px,transparent 1px 14px),linear-gradient(var(--bga),var(--bg),var(--bg2))}
.wrap.c-bg-animated{background:linear-gradient(var(--bga),var(--bg),var(--bg2),color-mix(in srgb,var(--s) 22%,var(--bg)),var(--bg));background-size:300% 300%;animation:vc-pan 16s ease-in-out infinite alternate}
.wrap.c-bg-image{background:linear-gradient(color-mix(in srgb,var(--bg) 80%,transparent),color-mix(in srgb,var(--bg) 92%,transparent)),var(--bgi) center/cover no-repeat}
@keyframes vc-pan{from{background-position:0% 0%}to{background-position:100% 100%}}

/* typography */
.wrap.c-hf .sec h3,.wrap.c-hf .svc b,.wrap.c-hf .prod b,.wrap.c-hf .post b,.wrap.c-hf .page-body h1{font-family:var(--hfont)}
.wrap.c-nf .name{font-family:var(--nfont)}
.wrap.c-hf:not(.c-nf) .name{font-family:var(--hfont)}
.wrap.c-fw .name,.wrap.c-fw .sec h3{font-weight:var(--fw)}
.wrap.c-fs>*{zoom:var(--fs)}
.wrap.c-ls .name,.wrap.c-ls .role,.wrap.c-ls .about,.wrap.c-ls .row span,.wrap.c-ls .svc p{letter-spacing:var(--ls)}
.wrap.c-lh,.wrap.c-lh .about,.wrap.c-lh .svc p,.wrap.c-lh .tst .q{line-height:var(--lh)}

/* layout */
.wrap.c-align-start .hero,.wrap.c-align-start .id,.wrap.c-align-start .name,.wrap.c-align-start .role{text-align:start;justify-content:flex-start}
.wrap.c-align-start .av,.wrap.c-align-start .meta{justify-content:flex-start}
.wrap.c-align-start .sec h3{justify-content:flex-start}
.wrap.c-align-center .hero,.wrap.c-align-center .id,.wrap.c-align-center .name,.wrap.c-align-center .role{text-align:center;justify-content:center}
.wrap.c-align-center .av,.wrap.c-align-center .meta{justify-content:center}
.wrap.c-align-center .sec h3{justify-content:center}
.wrap.c-avs-circle .avatar{border-radius:50%}
.wrap.c-avs-rounded .avatar{border-radius:28%}
.wrap.c-avs-square .avatar{border-radius:6px}
.wrap.c-avz-s .avatar{width:92px;height:92px}.wrap.c-avz-s .avatar.ph{font-size:30px}
.wrap.c-avz-m .avatar{width:128px;height:128px}
.wrap.c-avz-l .avatar{width:172px;height:172px}.wrap.c-avz-l .avatar.ph{font-size:56px}
.wrap.c-spacing-compact .sec{padding-top:18px}.wrap.c-spacing-compact .box{padding:14px}
.wrap.c-spacing-cozy .sec{padding-top:30px}
.wrap.c-spacing-airy .sec{padding-top:46px}.wrap.c-spacing-airy .actions{padding-top:32px}
.wrap.c-width-narrow{max-width:410px}
.wrap.c-width-wide{max-width:580px}
.wrap.c-hide-cover .cover{display:none}
.wrap.c-hide-cover .hero{padding-top:44px}
.wrap.c-hide-cover .av{margin-top:0}
.wrap.c-hide-actions .actions,.wrap.c-hide-actions .x-actions,.wrap.c-hide-actions~.x-dock .x-actions{display:none}
.wrap.c-hide-save .save{display:none}
.wrap.c-hide-meta .meta,.wrap.c-hide-meta .x-meta{display:none}
.wrap.c-hide-role .role{display:none}
.wrap.c-shadow-none{--sh:none}
.wrap.c-shadow-none .box,.wrap.c-shadow-none .links a,.wrap.c-shadow-none .social a,.wrap.c-shadow-none .save,.wrap.c-shadow-none .avatar{box-shadow:none}
.wrap.c-shadow-soft{--sh:0 1px 2px rgba(16,24,40,.05),0 10px 24px -14px rgba(16,24,40,.18)}
.wrap.c-shadow-strong{--sh:0 2px 4px rgba(16,24,40,.08),0 28px 50px -20px rgba(16,24,40,.45)}

/* buttons, actions, social icons */
.wrap.c-btnstyle-pill .save,.wrap.c-btnstyle-pill .btn,.wrap.c-btnstyle-pill .act{border-radius:999px}
.wrap.c-btnstyle-rounded .save,.wrap.c-btnstyle-rounded .btn,.wrap.c-btnstyle-rounded .act{border-radius:16px}
.wrap.c-btnstyle-square .save,.wrap.c-btnstyle-square .btn,.wrap.c-btnstyle-square .act{border-radius:4px}
.wrap.c-btnstyle-outline .save,.wrap.c-btnstyle-outline .btn{background:transparent;color:var(--btn,var(--p));border:1.5px solid var(--btn,var(--p));box-shadow:none}
.wrap.c-btnstyle-outline .save:after{display:none}
.wrap.c-btnstyle-outline .save:hover,.wrap.c-btnstyle-outline .btn:hover{background:var(--btn,var(--p));color:var(--onbtn,var(--onp))}
.wrap.c-btnstyle-soft .save,.wrap.c-btnstyle-soft .btn{background:var(--chip);color:var(--btn,var(--p));box-shadow:none;border:0}
.wrap.c-btnstyle-soft .save:after{display:none}
.wrap.c-actlayout-row .actions{display:flex;flex-wrap:nowrap}
.wrap.c-actlayout-grid .actions{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
.wrap.c-actlayout-grid .act{height:66px;border-radius:18px;flex:none}
.wrap.c-socialstyle-filled .social a{background:var(--icn,var(--p));color:var(--onp);border-color:transparent}
.wrap.c-socialstyle-outline .social a{background:transparent;border:1.5px solid var(--icn,var(--p));color:var(--icn,var(--p));box-shadow:none}
.wrap.c-socialstyle-plain .social a{background:transparent;border-color:transparent;box-shadow:none;color:var(--icn,var(--tx))}
.wrap.c-socialstyle-brand .social a{color:#fff;border-color:transparent;background:var(--tx)}
.wrap.c-socialstyle-brand .social a[aria-label=Facebook]{background:#1877f2}.wrap.c-socialstyle-brand .social a[aria-label=Instagram]{background:linear-gradient(45deg,#f58529,#dd2a7b,#8134af)}
.wrap.c-socialstyle-brand .social a[aria-label=LinkedIn]{background:#0a66c2}.wrap.c-socialstyle-brand .social a[aria-label=YouTube]{background:#ff0033}
.wrap.c-socialstyle-brand .social a[aria-label=WhatsApp]{background:#25d366}.wrap.c-socialstyle-brand .social a[aria-label=Telegram]{background:#2aabee}
.wrap.c-socialstyle-brand .social a[aria-label=Pinterest]{background:#e60023}.wrap.c-socialstyle-brand .social a[aria-label=Dribbble]{background:#ea4c89}
.wrap.c-socialstyle-brand .social a[aria-label=Discord]{background:#5865f2}.wrap.c-socialstyle-brand .social a[aria-label=Reddit]{background:#ff4500}
.wrap.c-socialstyle-brand .social a[aria-label=Behance]{background:#1769ff}.wrap.c-socialstyle-brand .social a[aria-label="X / Twitter"],.wrap.c-socialstyle-brand .social a[aria-label=TikTok],.wrap.c-socialstyle-brand .social a[aria-label=GitHub]{background:#111}
.wrap.c-socialstyle-brand .social a[aria-label=Snapchat]{background:#fffc00;color:#111}.wrap.c-socialstyle-brand .social a[aria-label=Website]{background:var(--p);color:var(--onp)}
.wrap.c-socialshape-round .social a{border-radius:50%}
.wrap.c-socialshape-square .social a{border-radius:10px}

/* motion */
@keyframes vc-up-s{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
@keyframes vc-up-l{from{opacity:0;transform:translateY(46px)}to{opacity:1;transform:none}}
@keyframes vc-pop-s{from{opacity:0;transform:scale(.94)}to{opacity:1;transform:none}}
@keyframes vc-pop-l{from{opacity:0;transform:scale(.5)}to{opacity:1;transform:none}}
.wrap.c-anim-none,.wrap.c-anim-none *,.wrap.c-anim-none *:before,.wrap.c-anim-none *:after,.wrap.c-anim-none~.sticky{animation:none!important}
.wrap.c-anim-fade .cover,.wrap.c-anim-fade .avatar,.wrap.c-anim-fade .id,.wrap.c-anim-fade .act,.wrap.c-anim-fade .save,.wrap.c-anim-fade .sec{animation-name:vc-fade}
.wrap.c-anim-slide .avatar,.wrap.c-anim-slide .id,.wrap.c-anim-slide .act,.wrap.c-anim-slide .save,.wrap.c-anim-slide .sec,.wrap.c-animintensity-subtle:not(.c-anim-fade):not(.c-anim-zoom) .sec,.wrap.c-animintensity-strong:not(.c-anim-fade):not(.c-anim-zoom) .sec{animation-name:vc-up}
.wrap.c-anim-zoom .avatar,.wrap.c-anim-zoom .id,.wrap.c-anim-zoom .act,.wrap.c-anim-zoom .save,.wrap.c-anim-zoom .sec{animation-name:vc-pop}
.wrap.c-animintensity-subtle:not(.c-anim-fade):not(.c-anim-zoom) .id,.wrap.c-animintensity-subtle:not(.c-anim-fade):not(.c-anim-zoom) .act,.wrap.c-animintensity-subtle:not(.c-anim-fade):not(.c-anim-zoom) .save,.wrap.c-animintensity-subtle:not(.c-anim-fade):not(.c-anim-zoom) .sec{animation-name:vc-up-s}
.wrap.c-animintensity-strong:not(.c-anim-fade):not(.c-anim-zoom) .id,.wrap.c-animintensity-strong:not(.c-anim-fade):not(.c-anim-zoom) .act,.wrap.c-animintensity-strong:not(.c-anim-fade):not(.c-anim-zoom) .save,.wrap.c-animintensity-strong:not(.c-anim-fade):not(.c-anim-zoom) .sec{animation-name:vc-up-l}
.wrap.c-anim-zoom.c-animintensity-subtle .avatar,.wrap.c-anim-zoom.c-animintensity-subtle .id,.wrap.c-anim-zoom.c-animintensity-subtle .act,.wrap.c-anim-zoom.c-animintensity-subtle .save,.wrap.c-anim-zoom.c-animintensity-subtle .sec{animation-name:vc-pop-s}
.wrap.c-anim-zoom.c-animintensity-strong .avatar,.wrap.c-anim-zoom.c-animintensity-strong .id,.wrap.c-anim-zoom.c-animintensity-strong .act,.wrap.c-anim-zoom.c-animintensity-strong .save,.wrap.c-anim-zoom.c-animintensity-strong .sec{animation-name:vc-pop-l}
.wrap.c-animspeed-slow .cover,.wrap.c-animspeed-slow .avatar,.wrap.c-animspeed-slow .id,.wrap.c-animspeed-slow .act,.wrap.c-animspeed-slow .save,.wrap.c-animspeed-slow .sec{animation-duration:1.3s}
.wrap.c-animspeed-fast .cover,.wrap.c-animspeed-fast .avatar,.wrap.c-animspeed-fast .id,.wrap.c-animspeed-fast .act,.wrap.c-animspeed-fast .save,.wrap.c-animspeed-fast .sec{animation-duration:.32s}
.wrap.c-reveal-off .sec{animation:none}
/* editor preview: no entrance motion while the owner is dragging sliders */
.wrap.pv-still,.wrap.pv-still *,.wrap.pv-still *:before,.wrap.pv-still *:after,.wrap.pv-still~.sticky{animation-duration:0s!important;animation-delay:0s!important}
@media (prefers-reduced-motion:reduce){.wrap.c-bg-animated{animation:none}}
`;

module.exports = { GOOGLE_FONTS, KEYS, COLORS, ENUMS, NUMBERS, BOOLS, FONT_KEYS, AVATAR_FIXED, sanitizeTheme, customOf, contrast, fontName, fontStack, CUSTOM_CSS };
