/* Public WhatsApp store page: catalogue + cart; checkout creates the order and opens WhatsApp with the order message */
const { esc, url, color } = require('../utils/html');

const PRESETS = {
  modern: ['#6d5dfc', '#f5f5ff', '#16162a'], boutique: ['#be185d', '#fff1f5', '#3b0a1f'], grocery: ['#16a34a', '#f0fdf4', '#052e16'],
  restaurant: ['#ea580c', '#fff7ed', '#431407'], jewellery: ['#b08d57', '#fbf8f3', '#292524'], electronics: ['#0ea5e9', '#f0f9ff', '#082f49'],
  fashion: ['#111827', '#f9fafb', '#111827'], beauty: ['#db2777', '#fdf2f8', '#500724'], 'home-decor': ['#92400e', '#fffbeb', '#292524'], sports: ['#dc2626', '#fef2f2', '#1f2937'],
};

function renderStore({ st, categories, products, app, nonce, appUrl }) {
  const pre = PRESETS[st.template] || PRESETS.modern;
  const p = color(st.theme?.primary, pre[0]);
  const bg = color(st.theme?.background, pre[1]);
  const tx = color(st.theme?.text, pre[2]);
  const cur = esc(st.currency_icon || '$');
  const items = products.map((x) => ({ id: x.id, name: x.name, price: Number(x.sale_price ?? x.price), was: x.sale_price !== null && x.sale_price !== undefined ? Number(x.price) : null, img: (x.images || [])[0] || null, cat: x.category_id, out: x.stock !== null && x.stock !== undefined && x.stock <= 0, desc: x.description || '' }));
  const hours = st.business_hours || {};
  const days = [['mon', 'Mon'], ['tue', 'Tue'], ['wed', 'Wed'], ['thu', 'Thu'], ['fri', 'Fri'], ['sat', 'Sat'], ['sun', 'Sun']];
  const policies = [['terms', 'Terms'], ['privacy', 'Privacy'], ['refund_policy', 'Refunds'], ['shipping_policy', 'Shipping']].filter(([k]) => st[k]);
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(st.site_title || st.name)}</title><meta name="description" content="${esc(st.meta_description || st.slogan || '')}"><meta name="theme-color" content="${p}">
<meta property="og:title" content="${esc(st.name)}">${st.logo ? `<meta property="og:image" content="${esc(appUrl + st.logo)}">` : ''}
<link rel="icon" href="${url(st.logo || app.favicon)}"><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap"><link rel="stylesheet" href="/vendor/remixicon/remixicon.css">
<style>:root{--p:${p};--bg:${bg};--tx:${tx};--card:#fff;--line:rgba(0,0,0,.08);--muted:rgba(0,0,0,.55)}
*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Plus Jakarta Sans',system-ui,sans-serif;background:var(--bg);color:var(--tx);line-height:1.5}a{color:inherit;text-decoration:none}button{font-family:inherit;cursor:pointer}
@keyframes up{from{opacity:0;transform:translateY(16px)}}@keyframes pop{0%{transform:scale(1)}50%{transform:scale(1.25)}}
.ann{background:var(--p);color:#fff;text-align:center;font-size:13px;font-weight:600;padding:8px 14px}
header.top{position:sticky;top:0;z-index:20;background:color-mix(in srgb,var(--bg) 85%,transparent);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);border-bottom:1px solid var(--line)}
.bar{max-width:1100px;margin:0 auto;display:flex;align-items:center;gap:12px;padding:12px 16px}
.logo{width:42px;height:42px;border-radius:12px;object-fit:cover;background:var(--p)}.bar b{font-size:17px}.bar small{display:block;color:var(--muted);font-size:12px}
.cartbtn{margin-left:auto;position:relative;width:44px;height:44px;border-radius:14px;border:0;background:var(--p);color:#fff;font-size:20px}
.cartbtn span{position:absolute;top:-6px;right:-6px;min-width:20px;height:20px;border-radius:99px;background:#111;color:#fff;font-size:11px;display:grid;place-items:center;padding:0 5px}
.cartbtn.bump{animation:pop .35s}
.hero{max-width:1100px;margin:16px auto 0;padding:0 16px}.hero .cv{aspect-ratio:3/1;border-radius:24px;background:linear-gradient(135deg,var(--p),color-mix(in srgb,var(--p) 40%,#000));background-size:cover;background-position:center;overflow:hidden}
.hero iframe{width:100%;height:100%;border:0;pointer-events:none}
.search{max-width:1100px;margin:16px auto 0;padding:0 16px;display:flex;gap:10px}.search input{flex:1;padding:12px 16px;border-radius:14px;border:1px solid var(--line);background:#fff;font-family:inherit;font-size:14px}
.cats{max-width:1100px;margin:12px auto 0;padding:0 16px;display:flex;gap:8px;overflow-x:auto;scrollbar-width:none}
.cats button{flex:none;display:flex;align-items:center;gap:8px;padding:8px 14px;border-radius:99px;border:1px solid var(--line);background:#fff;font-weight:600;font-size:13px;color:var(--tx)}
.cats button img{width:22px;height:22px;border-radius:50%;object-fit:cover}.cats button.on{background:var(--p);color:#fff;border-color:var(--p)}
.grid{max-width:1100px;margin:16px auto 40px;padding:0 16px;display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:14px}
.card{background:#fff;border-radius:18px;overflow:hidden;border:1px solid var(--line);display:flex;flex-direction:column;animation:up .5s both;transition:transform .2s,box-shadow .2s}
.card:hover{transform:translateY(-3px);box-shadow:0 14px 30px -14px rgba(0,0,0,.25)}
.card .im{aspect-ratio:1;background:color-mix(in srgb,var(--p) 10%,#fff);position:relative}.card .im img{width:100%;height:100%;object-fit:cover}
.badge{position:absolute;top:8px;left:8px;background:#111;color:#fff;font-size:11px;font-weight:700;padding:3px 8px;border-radius:99px}.badge.sale{background:var(--p)}
.card .bd{padding:10px 12px 12px;display:flex;flex-direction:column;gap:4px;flex:1}.card b{font-size:14px;line-height:1.3}
.pr{font-weight:800;color:var(--p)}.pr s{color:var(--muted);font-weight:500;font-size:12px;margin-left:6px}
.add{margin-top:auto;padding:9px;border-radius:12px;border:0;background:var(--p);color:#fff;font-weight:700;font-size:13px}.add:disabled{background:#ccc}
.drawer{position:fixed;inset:0;z-index:40;background:rgba(0,0,0,.45);display:none}.drawer.show{display:block}
.panel{position:absolute;right:0;top:0;bottom:0;width:min(420px,100%);background:#fff;display:flex;flex-direction:column;animation:slide .35s cubic-bezier(.16,1,.3,1)}
@keyframes slide{from{transform:translateX(100%)}}
.panel h3{padding:18px 20px;border-bottom:1px solid var(--line);display:flex;justify-content:space-between;align-items:center}
.panel h3 button{border:0;background:none;font-size:22px}
.lines{flex:1;overflow:auto;padding:12px 20px}.line{display:flex;gap:12px;align-items:center;padding:10px 0;border-bottom:1px dashed var(--line)}
.line img{width:52px;height:52px;border-radius:12px;object-fit:cover;background:#f3f3f3}.line .n{flex:1;font-size:14px;font-weight:600}.line small{display:block;color:var(--muted);font-weight:500}
.qty{display:flex;align-items:center;gap:6px}.qty button{width:28px;height:28px;border-radius:8px;border:1px solid var(--line);background:#fff;font-weight:700}
.checkout{padding:16px 20px;border-top:1px solid var(--line);display:grid;gap:10px}
.checkout input,.checkout textarea{width:100%;padding:11px 13px;border-radius:12px;border:1px solid var(--line);font-family:inherit;font-size:14px}
.opts{display:flex;gap:8px}.opts label{flex:1;display:flex;align-items:center;gap:6px;padding:10px;border-radius:12px;border:1px solid var(--line);font-size:13px;font-weight:600}
.tot{display:flex;justify-content:space-between;font-weight:800;font-size:17px}
.go{padding:14px;border-radius:14px;border:0;background:#25d366;color:#fff;font-weight:800;font-size:15px;display:flex;align-items:center;justify-content:center;gap:8px}
.empty{text-align:center;color:var(--muted);padding:40px 0}
footer{max-width:1100px;margin:0 auto;padding:24px 16px 40px;display:grid;gap:14px;color:var(--muted);font-size:13px}
footer .hrs{display:flex;flex-wrap:wrap;gap:8px}footer .hrs span{background:#fff;border:1px solid var(--line);padding:4px 10px;border-radius:99px}
footer .pol{display:flex;gap:14px;flex-wrap:wrap}footer .pol a{text-decoration:underline}
.fab{position:fixed;right:18px;bottom:18px;width:56px;height:56px;border-radius:50%;background:#25d366;color:#fff;display:grid;place-items:center;font-size:28px;box-shadow:0 12px 30px -8px rgba(37,211,102,.7);z-index:30}
.modal{position:fixed;inset:0;z-index:45;background:rgba(0,0,0,.5);display:none;align-items:center;justify-content:center;padding:16px}.modal.show{display:flex}
.modal .box{background:#fff;border-radius:22px;max-width:520px;width:100%;overflow:hidden;animation:up .3s}.modal .box img{width:100%;aspect-ratio:4/3;object-fit:cover}.modal .box .in{padding:18px;display:grid;gap:8px}
.modal .box .x{position:absolute}
</style></head><body>
${st.announcement ? `<div class="ann">${esc(st.announcement)}</div>` : ''}
<header class="top"><div class="bar">${st.logo ? `<img class="logo" src="${url(st.logo)}" alt="">` : '<span class="logo"></span>'}<div><b>${esc(st.name)}</b>${st.slogan ? `<small>${esc(st.slogan)}</small>` : ''}</div>
<button class="cartbtn" id="cartbtn" aria-label="Cart"><i class="ri-shopping-bag-3-line"></i><span id="count">0</span></button></div></header>
<div class="hero"><div class="cv"${st.cover_image ? ` style="background-image:url('${url(st.cover_image)}')"` : ''}>${st.youtube_banner && /^[\w-]{11}$/.test(st.youtube_banner) ? `<iframe src="https://www.youtube-nocookie.com/embed/${st.youtube_banner}?autoplay=1&mute=1&loop=1&playlist=${st.youtube_banner}&controls=0" allow="autoplay" title="banner"></iframe>` : ''}</div></div>
<div class="search"><input id="q" placeholder="Search products" aria-label="Search"></div>
${categories.length ? `<div class="cats" id="cats"><button class="on" data-c="">All</button>${categories.map((c) => `<button data-c="${c.id}">${c.image ? `<img src="${url(c.image)}" alt="">` : ''}${esc(c.name)}</button>`).join('')}</div>` : ''}
<div class="grid" id="grid">${items.length ? items.map((x, i) => `<div class="card" data-c="${x.cat || ''}" data-n="${esc(x.name.toLowerCase())}" style="animation-delay:${Math.min(i * 40, 600)}ms"><div class="im" data-view="${x.id}">${x.img ? `<img src="${url(x.img)}" alt="${esc(x.name)}" loading="lazy">` : ''}${x.out ? '<span class="badge">Out of stock</span>' : x.was ? '<span class="badge sale">Sale</span>' : ''}</div>
<div class="bd"><b>${esc(x.name)}</b><span class="pr">${cur}${x.price.toFixed(2)}${x.was ? `<s>${cur}${x.was.toFixed(2)}</s>` : ''}</span><button class="add" data-add="${x.id}" ${x.out ? 'disabled' : ''}>${x.out ? 'Unavailable' : 'Add to cart'}</button></div></div>`).join('') : '<p class="empty">No products yet.</p>'}</div>
<footer>${st.address ? `<p><i class="ri-map-pin-line"></i> ${esc(st.address)}</p>` : ''}
${days.some(([d]) => hours[d]?.open) ? `<div class="hrs">${days.map(([d, l]) => `<span>${l}: ${hours[d]?.open ? `${esc(hours[d].from)}-${esc(hours[d].to)}` : 'Closed'}</span>`).join('')}</div>` : ''}
${policies.length ? `<div class="pol">${policies.map(([k, l]) => `<a href="/s/${esc(st.url_alias)}/${k.replace('_policy', '')}">${l}</a>`).join('')}</div>` : ''}
<p>Powered by <a href="${esc(appUrl)}" style="color:var(--p);font-weight:700">${esc(app.app_name)}</a></p></footer>
<a class="fab" href="https://wa.me/${esc(`${st.region_code || ''}${st.whatsapp_number}`.replace(/\D/g, ''))}" target="_blank" rel="noopener" aria-label="WhatsApp"><i class="ri-whatsapp-line"></i></a>
<div class="drawer" id="drawer"><div class="panel"><h3>Your order <button id="close" aria-label="Close">&times;</button></h3><div class="lines" id="lines"></div>
<form class="checkout" id="co"><input name="customer_name" placeholder="Your name" required maxlength="120"><input name="customer_phone" placeholder="WhatsApp / phone number" required maxlength="30">
<div class="opts">${st.delivery_enabled ? '<label><input type="radio" name="delivery_type" value="delivery" checked> Delivery</label>' : ''}${st.takeaway_enabled ? `<label><input type="radio" name="delivery_type" value="takeaway"${st.delivery_enabled ? '' : ' checked'}> Take-away</label>` : ''}</div>
<textarea name="customer_address" id="addr" rows="2" placeholder="Delivery address" maxlength="500"></textarea><textarea name="notes" rows="2" placeholder="Notes (optional)" maxlength="500"></textarea>
<div class="tot"><span>Total</span><span id="total">${cur}0.00</span></div><button class="go" type="submit"><i class="ri-whatsapp-line"></i>Order on WhatsApp</button><p id="err" style="color:#dc2626;font-size:13px"></p></form></div></div>
<div class="modal" id="pm"><div class="box" id="pmb"></div></div>
<script nonce="${nonce}">
(function(){var P=${JSON.stringify(items).replace(/</g, '\\u003c')},CUR=${JSON.stringify(st.currency_icon || '$')},DEL=${Number(st.delivery_charge || 0)},KEY='cart_${esc(st.url_alias)}',A=${JSON.stringify(st.url_alias)};
var $=function(s){return document.querySelector(s)},$$=function(s){return Array.prototype.slice.call(document.querySelectorAll(s))};
var cart={};try{cart=JSON.parse(localStorage.getItem(KEY)||'{}')}catch(e){}
function save(){try{localStorage.setItem(KEY,JSON.stringify(cart))}catch(e){}draw()}
function byId(id){return P.find(function(x){return x.id===Number(id)})}
function money(n){return CUR+Number(n).toFixed(2)}
function draw(){var n=0,sum=0,h='';Object.keys(cart).forEach(function(id){var p=byId(id);if(!p){delete cart[id];return}n+=cart[id];sum+=p.price*cart[id];
 h+='<div class="line">'+(p.img?'<img src="'+p.img+'" alt="">':'<img alt="">')+'<div class="n">'+p.name.replace(/</g,'&lt;')+'<small>'+money(p.price)+'</small></div><div class="qty"><button type="button" data-d="'+id+'">-</button><b>'+cart[id]+'</b><button type="button" data-i="'+id+'">+</button></div></div>'});
 $('#lines').innerHTML=h||'<p class="empty">Your cart is empty.</p>';$('#count').textContent=n;var del=($('input[name=delivery_type]:checked')||{}).value==='delivery'?DEL:0;$('#total').textContent=money(sum+(n?del:0));
 $$('[data-d]').forEach(function(b){b.onclick=function(){var id=b.getAttribute('data-d');cart[id]--;if(cart[id]<=0)delete cart[id];save()}});
 $$('[data-i]').forEach(function(b){b.onclick=function(){cart[b.getAttribute('data-i')]++;save()}})}
$$('[data-add]').forEach(function(b){b.addEventListener('click',function(){var id=b.getAttribute('data-add');cart[id]=(cart[id]||0)+1;save();var c=$('#cartbtn');c.classList.remove('bump');void c.offsetWidth;c.classList.add('bump')})});
$('#cartbtn').onclick=function(){$('#drawer').classList.add('show')};$('#close').onclick=function(){$('#drawer').classList.remove('show')};
$('#drawer').addEventListener('click',function(e){if(e.target.id==='drawer')e.target.classList.remove('show')});
$$('input[name=delivery_type]').forEach(function(r){r.onchange=function(){$('#addr').style.display=r.value==='takeaway'&&r.checked?'none':'';draw()}});
var q=$('#q'),cc='';function filt(){var s=q.value.toLowerCase();$$('#grid .card').forEach(function(c){c.style.display=(!cc||c.getAttribute('data-c')===cc)&&(!s||c.getAttribute('data-n').indexOf(s)>-1)?'':'none'})}
q.oninput=filt;$$('#cats button').forEach(function(b){b.onclick=function(){$$('#cats button').forEach(function(x){x.classList.remove('on')});b.classList.add('on');cc=b.getAttribute('data-c');filt()}});
$$('[data-view]').forEach(function(el){el.onclick=function(){var p=byId(el.getAttribute('data-view'));if(!p)return;var d=document.createElement('div');d.innerHTML=(p.img?'<img src="'+p.img+'" alt="">':'')+'<div class="in"><b style="font-size:18px"></b><span class="pr">'+money(p.price)+'</span><p style="color:var(--muted);font-size:14px"></p><button class="add" '+(p.out?'disabled':'')+'>Add to cart</button></div>';d.querySelector('b').textContent=p.name;d.querySelector('p').textContent=p.desc;
 d.querySelector('button').onclick=function(){cart[p.id]=(cart[p.id]||0)+1;save();$('#pm').classList.remove('show')};$('#pmb').innerHTML='';$('#pmb').appendChild(d);$('#pm').classList.add('show')}});
$('#pm').onclick=function(e){if(e.target.id==='pm')e.target.classList.remove('show')};
$('#co').addEventListener('submit',function(e){e.preventDefault();var d=Object.fromEntries(new FormData(e.target));d.items=Object.keys(cart).map(function(id){return{product_id:Number(id),qty:cart[id]}});if(!d.items.length){$('#err').textContent='Your cart is empty.';return}
 var b=e.target.querySelector('button');b.disabled=true;$('#err').textContent='';
 fetch('/api/public/stores/'+encodeURIComponent(A)+'/orders',{method:'POST',headers:{'Content-Type':'application/json','X-Requested-With':'XMLHttpRequest'},body:JSON.stringify(d)}).then(function(r){return r.json().then(function(j){return{ok:r.ok,j:j}})})
 .then(function(x){if(!x.ok){$('#err').textContent=x.j.errors?Object.values(x.j.errors)[0]:x.j.message;return}cart={};save();location.href=x.j.whatsapp_url}).catch(function(){$('#err').textContent='Could not place the order, please try again.'}).finally(function(){b.disabled=false})});
draw();})();
</script></body></html>`;
}

function renderStorePage({ st, title, html }) {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)} - ${esc(st.name)}</title>
<style>body{font-family:system-ui,sans-serif;max-width:760px;margin:0 auto;padding:32px 20px;line-height:1.7;color:#1f2937}a{color:#6d5dfc}h1{font-size:28px;margin-bottom:16px}</style></head>
<body><a href="/s/${esc(st.url_alias)}">&larr; ${esc(st.name)}</a><h1>${esc(title)}</h1>${html}</body></html>`;
}

module.exports = { renderStore, renderStorePage };
