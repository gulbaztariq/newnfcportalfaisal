const { esc } = require('../utils/html');

/* Standalone error page (server side, no JS). */
module.exports = (code, title, text) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${code} - ${esc(title)}</title>
<link rel="icon" href="/brand/favicon.svg" type="image/svg+xml">
<style>
*{box-sizing:border-box;margin:0}
body{min-height:100vh;display:grid;place-items:center;font-family:Inter,system-ui,sans-serif;background:#0b0b14;color:#e7e7f3;overflow:hidden}
.glow{position:fixed;width:620px;height:620px;border-radius:50%;filter:blur(120px);opacity:.45;background:radial-gradient(circle,#6d5dfc,transparent 70%);top:-200px;left:-120px;animation:f 12s ease-in-out infinite alternate}
.glow.b{background:radial-gradient(circle,#b44cf5,transparent 70%);top:auto;bottom:-260px;left:auto;right:-160px;animation-delay:-6s}
@keyframes f{to{transform:translate(120px,80px) scale(1.1)}}
.grid{position:fixed;inset:0;background-image:linear-gradient(rgba(255,255,255,.04) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.04) 1px,transparent 1px);background-size:48px 48px;mask-image:radial-gradient(circle at center,#000 30%,transparent 75%)}
main{position:relative;text-align:center;padding:24px;animation:up .7s cubic-bezier(.16,1,.3,1)}
@keyframes up{from{opacity:0;transform:translateY(24px)}}
.code{font-size:clamp(96px,22vw,200px);font-weight:800;letter-spacing:-.06em;line-height:1;background:linear-gradient(135deg,#fff 20%,#8b7dff 60%,#d9ff4a);-webkit-background-clip:text;background-clip:text;color:transparent}
h1{font-size:22px;margin:12px 0 8px}p{color:#9a9ab5;max-width:420px;margin:0 auto 28px}
a{display:inline-flex;gap:8px;align-items:center;padding:12px 22px;border-radius:999px;background:#fff;color:#0b0b14;font-weight:600;text-decoration:none;transition:transform .2s}
a:hover{transform:translateY(-2px)}
</style>
</head>
<body><div class="glow"></div><div class="glow b"></div><div class="grid"></div>
<main><div class="code">${code}</div><h1>${esc(title)}</h1><p>${esc(text)}</p><a href="/">&larr; Back to home</a></main>
</body></html>`;
