/*
 * Public pages of a contact tag: the scan page (message / call-back, number never shown) and the owner's manage page.
 * Plain server-rendered HTML like the vCard pages, with one small inline script (CSP nonce).
 */
const { esc } = require('../utils/html');
const { KINDS } = require('../services/contacttags');

const KIND_LABEL = { vehicle: 'Vehicle', luggage: 'Luggage (airport)', bag: 'Bag', keys: 'Keys', pet: 'Pet', door: 'Door', other: 'Other' };
const KIND_ICON = { vehicle: 'ri-car-line', luggage: 'ri-suitcase-3-line', bag: 'ri-handbag-line', keys: 'ri-key-2-line', pet: 'ri-bear-smile-line', door: 'ri-door-open-line', other: 'ri-price-tag-3-line' };

const CSS = `
:root{--bg:#f4f6fb;--card:#fff;--tx:#0f172a;--muted:#64748b;--line:#e2e8f0;--p:#4f46e5;--onp:#fff;--ok:#16a34a;--bad:#dc2626}
@media(prefers-color-scheme:dark){:root{--bg:#0b1020;--card:#131a2e;--tx:#e8ecf8;--muted:#93a0bd;--line:#232c47;--p:#818cf8;--onp:#0b1020}}
[hidden]{display:none!important}*{box-sizing:border-box;margin:0}body{font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;background:var(--bg);color:var(--tx);min-height:100vh;display:grid;place-items:center;padding:20px;line-height:1.5}
.card{width:min(440px,100%);background:var(--card);border:1px solid var(--line);border-radius:28px;padding:30px 24px 22px;box-shadow:0 30px 60px -34px rgba(15,23,42,.45);text-align:center}
.shield{width:64px;height:64px;margin:0 auto 14px;border-radius:20px;display:grid;place-items:center;font-size:30px;color:var(--onp);background:linear-gradient(135deg,var(--p),color-mix(in srgb,var(--p) 55%,#06b6d4))}
h1{font-size:24px;letter-spacing:-.02em;line-height:1.2}.note{color:var(--muted);margin:8px 0 20px;font-size:15px}
.acts{display:grid;gap:10px}.btn{display:flex;align-items:center;justify-content:center;gap:9px;height:54px;border-radius:16px;border:1.5px solid var(--line);background:var(--card);color:var(--tx);font:inherit;font-weight:600;font-size:16px;cursor:pointer;transition:transform .2s,border-color .2s}
.btn:hover{border-color:var(--p);transform:translateY(-1px)}.btn.pri{background:var(--p);border-color:var(--p);color:var(--onp)}.btn i{font-size:20px}
form{display:grid;gap:10px;text-align:left;margin-top:16px}label{font-size:13px;font-weight:600;color:var(--muted)}
input,textarea,select{width:100%;padding:13px 14px;border-radius:14px;border:1.5px solid var(--line);background:var(--bg);color:var(--tx);font:inherit;font-size:16px}input:focus,textarea:focus,select:focus{outline:0;border-color:var(--p)}
textarea{resize:vertical;min-height:96px}.hp{position:absolute;left:-9999px;opacity:0}
.priv{display:flex;gap:8px;align-items:flex-start;justify-content:center;margin-top:18px;color:var(--muted);font-size:13px;text-align:left}.priv i{color:var(--ok);font-size:17px;margin-top:1px}
.msg{padding:12px 14px;border-radius:14px;font-size:14px;text-align:left}.msg.ok{background:color-mix(in srgb,var(--ok) 14%,transparent);color:var(--ok)}.msg.bad{background:color-mix(in srgb,var(--bad) 14%,transparent);color:var(--bad)}
.foot{margin-top:18px;font-size:12px;color:var(--muted)}.foot a{color:var(--p);font-weight:600;text-decoration:none}
.row{display:grid;gap:10px}@media(min-width:420px){.row.two{grid-template-columns:1fr 1fr}}
.sw{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 14px;border:1.5px solid var(--line);border-radius:14px}.sw input{width:auto}
.inbox{text-align:left;margin-top:22px}.inbox h2{font-size:15px;margin-bottom:8px}.m{padding:12px 14px;border:1px solid var(--line);border-radius:14px;margin-bottom:8px;font-size:14px}.m small{color:var(--muted);display:block}
.card.wide{width:min(560px,100%);text-align:left}
`;

const head = (title, appUrl, favicon) => `<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>${esc(title)}</title><link rel="icon" href="${esc(favicon || '/brand/favicon.svg')}"><link rel="stylesheet" href="/vendor/remixicon/remixicon.css"><style>${CSS}</style>`;

/** the page someone sees after scanning the tag: no phone number anywhere in it */
function renderTag({ tag, app, appUrl, nonce }) {
  const hasEmergency = !!tag.emergency_phone;
  const lug = tag.kind === 'luggage'; // airport / luggage tag: wording for someone who found a bag
  const title = tag.label || (lug ? 'Found this bag?' : 'Contact the owner');
  const hint = lug ? 'e.g. The bag is at Lost & Found, Terminal 1' : 'e.g. Your car is blocking mine';
  return `<!doctype html><html lang="en"><head>${head(title, appUrl, app.favicon)}</head><body><main class="card">
<div class="shield"><i class="${KIND_ICON[tag.kind] || KIND_ICON.other}" aria-hidden="true"></i></div>
<h1>${esc(title)}</h1>
<p class="note">${esc(tag.public_note || (lug ? 'Thank you for helping. Tell the owner where the bag is and they will get in touch. Their phone number stays private.' : 'Need to reach the owner? Send a message or ask for a call back. Their phone number stays private.'))}</p>
<div class="acts" id="acts"><button class="btn pri" type="button" data-t="message"><i class="${lug ? 'ri-map-pin-user-line' : 'ri-chat-3-line'}"></i>${lug ? 'I found this bag' : 'Send a message'}</button><button class="btn" type="button" data-t="callback"><i class="ri-phone-line"></i>${lug ? 'Ask the owner to call me' : 'Ask for a call back'}</button></div>
<form id="f" hidden novalidate>
  ${hasEmergency ? `<div><label for="to">Who do you want to reach?</label><select id="to" name="to_role"><option value="owner">The owner</option><option value="emergency">${esc(tag.emergency_name || 'Emergency contact')} (emergency)</option></select></div>` : '<input type="hidden" name="to_role" value="owner">'}
  <div class="row two"><div><label for="n">Your name</label><input id="n" name="name" maxlength="80" autocomplete="name" placeholder="Optional"></div><div><label for="p" id="pl">Your phone number</label><input id="p" name="phone" maxlength="20" type="tel" inputmode="tel" autocomplete="tel" placeholder="So they can reach you"></div></div>
  <div><label for="t">Message</label><textarea id="t" name="text" maxlength="500" placeholder="${esc(hint)}"></textarea></div>
  <input class="hp" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">
  <button class="btn pri" type="submit" id="go"><i class="ri-send-plane-line"></i><span>Send</span></button>
  <div id="out" role="status" hidden></div>
</form>
<div class="priv"><i class="ri-shield-check-fill"></i><span>The owner's phone number is never shown. Your number is shared only with them.</span></div>
<p class="foot">Protected by <a href="${esc(appUrl)}" target="_blank" rel="noopener">${esc(app.app_name || 'NFC Profile')}</a></p>
</main>
<script nonce="${nonce}">
(function(){var f=document.getElementById('f'),acts=document.getElementById('acts'),out=document.getElementById('out'),type='message';
function show(t){type=t;f.hidden=false;document.getElementById('pl').textContent=t==='callback'?'Your phone number (required)':'Your phone number';document.getElementById('t').placeholder=t==='callback'?'When is a good time? (optional)':${JSON.stringify(hint)};f.querySelector('#p').focus()}
acts.addEventListener('click',function(e){var b=e.target.closest('[data-t]');if(b)show(b.getAttribute('data-t'))});
f.addEventListener('submit',function(e){e.preventDefault();var d=Object.fromEntries(new FormData(f));d.type=type;out.hidden=false;
if(type==='callback'&&!/^\\+?[0-9 ()-]{7,20}$/.test(d.phone||'')){out.className='msg bad';out.textContent='Please enter your phone number so the owner can call you back.';return}
if(type==='message'&&!(d.text||'').trim()){out.className='msg bad';out.textContent='Please write a short message.';return}
var go=document.getElementById('go');go.disabled=true;
fetch('/tag/${tag.code}/send',{method:'POST',headers:{'Content-Type':'application/json','X-Requested-With':'XMLHttpRequest'},body:JSON.stringify(d)}).then(function(r){return r.json().then(function(j){return{ok:r.ok,j:j}})})
.then(function(x){out.className='msg '+(x.ok&&x.j.delivered!==false?'ok':'bad');out.textContent=x.j.message||(x.ok?'Sent.':'Could not send.');if(x.ok){f.reset();go.hidden=true}}).catch(function(){out.className='msg bad';out.textContent='Could not send, please try again.'}).finally(function(){go.disabled=false})});})();
</script></body></html>`;
}

function renderInactive({ app, appUrl }) {
  return `<!doctype html><html lang="en"><head>${head('Tag not available', appUrl, app.favicon)}</head><body><main class="card"><div class="shield"><i class="ri-forbid-2-line"></i></div><h1>This tag is not active</h1><p class="note">The owner has switched it off, or it does not exist.</p><p class="foot"><a href="${esc(appUrl)}">${esc(app.app_name || 'NFC Profile')}</a></p></main></body></html>`;
}

/** the owner's private page (secret link): details, who gets notified, recent messages */
function renderManage({ tag, messages = [], app, appUrl, nonce, saved, error }) {
  const t = tag;
  const sw = (name, label, on, hint) => `<label class="sw"><span><b style="color:var(--tx)">${esc(label)}</b>${hint ? `<small style="display:block;color:var(--muted);font-weight:400">${esc(hint)}</small>` : ''}</span><input type="checkbox" name="${name}" value="1"${on ? ' checked' : ''}></label>`;
  return `<!doctype html><html lang="en"><head>${head('Manage your tag', appUrl, app.favicon)}</head><body><main class="card wide">
<div class="shield" style="margin-left:0"><i class="${KIND_ICON[t.kind] || KIND_ICON.other}"></i></div>
<h1>Manage your tag</h1>
<p class="note">${esc(`${appUrl}/tag/${t.code}`)} · ${t.scans} scan${t.scans === 1 ? '' : 's'}. Keep this page's link private: anyone with it can change your tag.</p>
${saved ? '<div class="msg ok">Saved.</div>' : ''}${error ? `<div class="msg bad">${esc(error)}</div>` : ''}
<form method="post" action="/tag/${t.code}/manage" autocomplete="off">
<input type="hidden" name="k" value="${esc(t.manage_token)}">
<div class="row two"><div><label>Label (shown on the tag page)</label><input name="label" maxlength="80" value="${esc(t.label)}" placeholder="${t.kind === 'luggage' ? 'e.g. Black Samsonite suitcase' : 'e.g. LEB-1234 Honda Civic'}"></div>
<div><label>Type</label><select name="kind">${KINDS.map((k) => `<option value="${k}"${t.kind === k ? ' selected' : ''}>${KIND_LABEL[k]}</option>`).join('')}</select></div></div>
<div><label>Message shown to people who scan</label><input name="public_note" maxlength="300" value="${esc(t.public_note)}" placeholder="${t.kind === 'luggage' ? 'e.g. Reward offered. Flying LHE to DXB, back on 14 Nov' : 'Optional'}"></div>
<div class="row two"><div><label>Your name</label><input name="owner_name" maxlength="120" value="${esc(t.owner_name)}"></div><div><label>Your phone (never shown)</label><input name="owner_phone" maxlength="20" type="tel" value="${esc(t.owner_phone)}"></div></div>
<div><label>Your e-mail</label><input name="owner_email" type="email" maxlength="191" value="${esc(t.owner_email)}"></div>
<div class="row two"><div><label>Emergency contact name</label><input name="emergency_name" maxlength="120" value="${esc(t.emergency_name)}" placeholder="Optional"></div><div><label>Emergency phone (never shown)</label><input name="emergency_phone" maxlength="20" type="tel" value="${esc(t.emergency_phone)}"></div></div>
${sw('notify_whatsapp', 'Tell me on WhatsApp', t.notify_whatsapp)}${sw('notify_sms', 'Tell me by SMS', t.notify_sms)}${sw('notify_email', 'Tell me by e-mail', t.notify_email)}${sw('status', 'Tag is active', t.status, 'Switch off to hide this tag completely')}
<button class="btn pri" type="submit"><i class="ri-save-3-line"></i>Save</button>
</form>
<div class="inbox"><h2>Recent messages</h2>${messages.length ? messages.map((m) => `<div class="m"><b>${m.type === 'callback' ? 'Call-back request' : 'Message'}</b> from ${esc(m.name || 'someone')}${m.phone ? ` · <a href="tel:${esc(m.phone)}" style="color:var(--p)">${esc(m.phone)}</a>` : ''}${m.text ? `<div>${esc(m.text)}</div>` : ''}<small>${esc(new Date(m.created_at).toLocaleString('en-GB'))}${m.to_role === 'emergency' ? ' · sent to your emergency contact' : ''}</small></div>`).join('') : '<p class="note" style="margin:0">Nothing yet.</p>'}</div>
<p class="foot">${esc(app.app_name || 'NFC Profile')}</p></main></body></html>`;
}

module.exports = { renderTag, renderInactive, renderManage };
