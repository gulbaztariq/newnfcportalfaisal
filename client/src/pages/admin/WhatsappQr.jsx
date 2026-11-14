/* Admin: WhatsApp numbers linked by scanning a QR code (like WhatsApp Web), with safety limits, plus the reply inbox. */
import { useEffect, useRef, useState } from 'react';
import { Plus, Trash2, QrCode, ShieldCheck, Send, Unlink, RefreshCw, Settings2, MessageSquareText, Power } from 'lucide-react';
import api from '@/lib/api';
import { cn } from '@/lib/cn';
import { Whatsapp } from '@/components/BrandIcons';
import { check } from '@/lib/validate';
import { Card, CardBody, Button, Field, Input, Textarea, Select, Switch, Badge, Dialog, EmptyState, Skeleton, Spinner, useForm, run, confirm } from '@/components/ui';

const STATUS = {
  connected: { tone: 'success', text: 'Connected' }, qr: { tone: 'warning', text: 'Waiting for scan' }, starting: { tone: 'neutral', text: 'Starting...' },
  connecting: { tone: 'neutral', text: 'Connecting...' }, disconnected: { tone: 'warning', text: 'Reconnecting' }, logged_out: { tone: 'danger', text: 'Not linked' }, paused: { tone: 'danger', text: 'Paused: press Connect' },
};
const when = (d) => (d ? new Date(d).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '-');
const hours = (ms) => (ms >= 3600000 ? `${Math.floor(ms / 3600000)}h ${Math.round((ms % 3600000) / 60000)}m left` : `${Math.max(1, Math.round(ms / 60000))}m left`);

const RULES = [
  'Replies go only to people who messaged this number first, within the last 24 hours.',
  'Nobody is ever messaged in bulk. There is no broadcast, no import of contacts and no sending to new people.',
  'Replies are sent one at a time with a random pause of 6 to 20 seconds, after a short "typing..." pause.',
  'A daily and an hourly limit apply per number. A newly linked number starts with 10 a day and grows over a week.',
  'No replies during quiet hours. Someone who writes STOP is never messaged again.',
  'If WhatsApp refuses several messages or the link keeps dropping, sending pauses by itself.',
];

function QrDialog({ line, onClose }) {
  const [st, setSt] = useState({ status: line.qr_status, qr: null });
  useEffect(() => {
    let live = true;
    const poll = () => api.get(`/admin/whatsapp-lines/${line.id}/qr`).then(({ data }) => { if (live) setSt(data); if (live && data.status === 'connected') setTimeout(onClose, 1500); }).catch(() => {});
    poll(); const t = setInterval(poll, 2500);
    return () => { live = false; clearInterval(t); };
  }, [line.id]); // eslint-disable-line
  const s = STATUS[st.status] || STATUS.starting;
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} size="sm" icon={QrCode} title={`Link ${line.label}`} description="On the phone: WhatsApp > Settings > Linked devices > Link a device, then scan this code."
      footer={<Button variant="outline" onClick={onClose}>Close</Button>}>
      <div className="grid place-items-center gap-3 py-2">
        {st.status === 'connected' ? <div className="grid size-56 place-items-center rounded-2xl bg-success-soft text-success"><ShieldCheck className="size-16" /></div>
          : st.qr ? <img src={st.qr} alt="WhatsApp QR code" className="size-56 rounded-2xl border border-border bg-white p-2" />
            : <div className="grid size-56 place-items-center rounded-2xl bg-muted/50">{['logged_out', 'paused'].includes(st.status) ? <p className="px-6 text-center text-sm text-muted-foreground">Not linked. Close this and press <b>Connect</b>.</p> : <Spinner />}</div>}
        <Badge tone={s.tone} dot>{s.text}{st.phone ? ` ${st.phone}` : ''}</Badge>
        <p className="text-center text-xs text-muted-foreground">The code refreshes by itself every minute. Use the phone that owns this number, and keep it online for the first hour.</p>
      </div>
    </Dialog>
  );
}

function LimitsDialog({ line, tz, caps, onClose, onSaved }) {
  const form = useForm({ ...line.limits });
  const [saving, setSaving] = useState(false);
  const save = async () => {
    const ok = form.validate({ daily_limit: `required|integer|minv:1|maxv:${caps.daily}`, hourly_limit: `required|integer|minv:1|maxv:${caps.hourly}`, quiet_start: 'required', quiet_end: 'required' }, { daily_limit: 'Daily limit', hourly_limit: 'Hourly limit', quiet_start: 'Quiet hours start', quiet_end: 'Quiet hours end' });
    if (!ok) return;
    setSaving(true);
    try { await run(api.put(`/admin/whatsapp-lines/${line.id}/limits`, form.values)); onSaved(); onClose(); } catch (e) { form.setErrors(e.errors || {}); } finally { setSaving(false); }
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} size="md" icon={ShieldCheck} title={`Safety limits: ${line.label}`} description={`Lower is safer. Times are in ${tz}.`}
      footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={save} loading={saving}>Save limits</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Replies per day" required hint={`Up to ${caps.daily}. Recommended 40 or less.`} error={form.errors.daily_limit}><Input {...form.input('daily_limit')} inputMode="numeric" /></Field>
        <Field label="Replies per hour" required hint={`Up to ${caps.hourly}. Recommended 10 or less.`} error={form.errors.hourly_limit}><Input {...form.input('hourly_limit')} inputMode="numeric" /></Field>
        <Field label="Quiet hours start" required error={form.errors.quiet_start}><Input {...form.input('quiet_start')} placeholder="23:00" /></Field>
        <Field label="Quiet hours end" required error={form.errors.quiet_end}><Input {...form.input('quiet_end')} placeholder="07:00" /></Field>
      </div>
    </Dialog>
  );
}

export function QrNumbers({ data, cards, reload }) {
  const [adding, setAdding] = useState(false);
  const [qrFor, setQrFor] = useState(null);
  const [limits, setLimits] = useState(null);
  const [saving, setSaving] = useState(false);
  const form = useForm({ label: '', vcard_id: '' });
  const qr = data.qr;
  useEffect(() => { const t = setInterval(reload, 5000); return () => clearInterval(t); }, []); // eslint-disable-line
  const lines = data.data.filter((l) => l.provider === 'qr');

  const toggleGateway = async (on) => {
    if (on && !(await confirm({ title: 'Turn on QR numbers?', description: 'This links WhatsApp numbers the unofficial way (like WhatsApp Web). WhatsApp can ban numbers used like this, so keep the safety limits low and use numbers you can afford to lose.', confirmText: 'I understand, turn on' }))) return;
    await run(api.put('/admin/whatsapp-lines/qr-config', { enabled: on })).catch(() => {}); reload();
  };
  const add = async () => {
    if (!form.validate({ label: 'required|max:80' }, { label: 'Name' })) return;
    setSaving(true);
    try { const body = await run(api.post('/admin/whatsapp-lines/qr', form.values)); setAdding(false); form.setValues({ label: '', vcard_id: '' }); await reload(); setQrFor(body.data); } catch (e) { form.setErrors(e.errors || {}); } finally { setSaving(false); }
  };
  const connect = async (l) => { await run(api.post(`/admin/whatsapp-lines/${l.id}/connect`)).catch(() => {}); reload(); setQrFor(l); };
  const unlink = async (l) => { if (await confirm({ title: `Unlink ${l.label}?`, description: 'The number is logged out of this system. You can link it again with a new QR code. Leads already received stay.' })) { await run(api.post(`/admin/whatsapp-lines/${l.id}/unlink`)).catch(() => {}); reload(); } };
  const remove = async (l) => { if (await confirm({ title: `Remove ${l.label}?`, description: 'The number is unlinked and removed. Leads already received stay on the card.' })) { await run(api.delete(`/admin/whatsapp-lines/${l.id}`)).catch(() => {}); reload(); } };
  const toggle = async (l, v) => { await run(api.put(`/admin/whatsapp-lines/${l.id}`, { label: l.label, vcard_id: l.vcard_id, status: v })).catch(() => {}); reload(); };

  return (
    <>
      <Card className="mb-5">
        <CardBody className="grid gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="grid size-10 place-items-center rounded-2xl bg-primary-soft text-primary"><Power className="size-5" /></span>
            <div className="min-w-0 flex-1"><p className="font-display font-semibold">QR numbers (scan like WhatsApp Web)</p><p className="text-sm text-muted-foreground">Link a number by scanning a code. Messages become leads, and you reply from the Inbox under strict limits.</p></div>
            {qr.enabled && <Badge tone={qr.running ? 'success' : 'warning'} dot>{qr.running ? 'Gateway running' : 'Gateway starting...'}</Badge>}
            <Switch checked={qr.enabled} onChange={toggleGateway} />
          </div>
          <div className="rounded-2xl border border-warning/30 bg-warning-soft/40 p-4">
            <p className="mb-2 flex items-center gap-2 text-sm font-semibold"><ShieldCheck className="size-4 text-warning" />How this keeps your numbers safe (it can reduce the ban risk, not remove it)</p>
            <ul className="grid gap-1 text-sm text-muted-foreground">{RULES.map((r) => <li key={r} className="flex gap-2"><span className="mt-2 size-1.5 shrink-0 rounded-full bg-warning" />{r}</li>)}</ul>
            <p className="mt-2 text-xs text-muted-foreground">Keep your phone online and on the same SIM. Avoid linking brand-new numbers with no chats. Never link a number you cannot lose without a backup contact route.</p>
          </div>
        </CardBody>
      </Card>

      {qr.enabled && (
        <>
          <div className="mb-3 flex items-center">
            <p className="flex-1 font-display font-semibold">Your QR numbers</p>
            <Button onClick={() => { form.setErrors({}); setAdding(true); }}><Plus />Link a number</Button>
          </div>
          {!lines.length ? (
            <Card><EmptyState icon={QrCode} title="No QR numbers yet" description="Link a number and scan the code with the phone that owns it." action={<Button onClick={() => setAdding(true)}><Plus />Link a number</Button>} /></Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {lines.map((l) => {
                const s = STATUS[l.qr_status] || STATUS.starting;
                return (
                  <Card key={l.id} className={cn('h-full', !l.status && 'opacity-60')}>
                    <CardBody className="flex h-full flex-col gap-3">
                      <div className="flex items-start gap-3">
                        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-success-soft text-success"><Whatsapp className="size-5" /></span>
                        <div className="min-w-0 flex-1"><p className="truncate font-display text-lg font-semibold">{l.label}</p><p className="text-sm text-muted-foreground">{l.display_phone || 'Not linked yet'}</p></div>
                        <Switch size="sm" checked={l.status} onChange={(v) => toggle(l, v)} />
                      </div>
                      <div className="flex flex-wrap items-center gap-2"><Badge tone={s.tone} dot>{s.text}</Badge><Badge tone="outline">{l.limits.daily_limit}/day · {l.limits.hourly_limit}/hour</Badge></div>
                      <div className="rounded-2xl bg-muted/50 p-3 text-sm"><p><b>{l.messages_count}</b> messages received</p><p className="mt-0.5 text-xs text-muted-foreground">Last: {when(l.last_message_at)}</p></div>
                      <p className="text-sm">{l.card ? <>Leads go to <b>{l.card.name}</b></> : <span className="text-warning">No card chosen: messages are not saved as leads yet</span>}</p>
                      <div className="mt-auto flex flex-wrap items-center gap-2">
                        {l.qr_status === 'connected' ? <Button size="sm" variant="outline" onClick={() => unlink(l)}><Unlink />Unlink</Button> : <Button size="sm" onClick={() => connect(l)}><RefreshCw />{['qr', 'starting', 'connecting'].includes(l.qr_status) ? 'Show QR' : 'Connect'}</Button>}
                        <Button size="sm" variant="ghost" onClick={() => setLimits(l)}><Settings2 />Limits</Button>
                        <span className="flex-1" />
                        <Button size="icon-sm" variant="danger-soft" onClick={() => remove(l)} aria-label="Remove"><Trash2 /></Button>
                      </div>
                    </CardBody>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}

      <Dialog open={adding} onOpenChange={(o) => !o && setAdding(false)} size="md" icon={QrCode} title="Link a WhatsApp number"
        footer={<><Button variant="outline" onClick={() => setAdding(false)}>Cancel</Button><Button onClick={add} loading={saving}>Show QR code</Button></>}>
        <div className="grid gap-4">
          <Field label="Name" required error={form.errors.label}><Input {...form.input('label')} placeholder="e.g. Sales, Support" /></Field>
          <Field label="Save leads on this card" hint="Its owner sees the leads in Enquiries and gets an e-mail for each new one." error={form.errors.vcard_id}>
            <Select value={form.values.vcard_id || ''} onChange={(v) => form.set('vcard_id', v)} allowEmpty placeholder="Choose a card" options={cards.map((c) => ({ value: c.id, label: `${c.name} (${c.url_alias})` }))} />
          </Field>
        </div>
      </Dialog>
      {qrFor && <QrDialog line={qrFor} onClose={() => { setQrFor(null); reload(); }} />}
      {limits && <LimitsDialog line={limits} tz={qr.timezone} caps={qr.caps} onClose={() => setLimits(null)} onSaved={reload} />}
    </>
  );
}

export function WaInbox({ data }) {
  const lines = data.data.filter((l) => l.provider === 'qr');
  const [lineId, setLineId] = useState('');
  const [q, setQ] = useState('');
  const [list, setList] = useState(null);
  const [open, setOpen] = useState(null); // {line_id, wa_id, name}
  const [thread, setThread] = useState(null);
  const [text, setText] = useState('');
  const [err, setErr] = useState('');
  const [sending, setSending] = useState(false);
  const endRef = useRef(null);

  const loadList = () => api.get('/admin/whatsapp-lines/inbox', { params: { line_id: lineId || undefined, q: q || undefined } }).then(({ data: d }) => setList(d.data)).catch(() => setList([]));
  useEffect(() => { loadList(); const t = setInterval(loadList, 8000); return () => clearInterval(t); }, [lineId, q]); // eslint-disable-line
  const loadThread = (c) => api.get(`/admin/whatsapp-lines/${c.line_id}/thread/${c.wa_id}`).then(({ data: d }) => { setThread(d); setTimeout(() => endRef.current?.scrollIntoView({ block: 'end' }), 50); }).catch(() => {});
  useEffect(() => { if (!open) return undefined; loadThread(open); const t = setInterval(() => loadThread(open), 5000); return () => clearInterval(t); }, [open?.line_id, open?.wa_id]); // eslint-disable-line

  const send = async () => {
    setErr('');
    if (!text.trim()) { setErr('Message is required'); return; }
    setSending(true);
    try { await run(api.post(`/admin/whatsapp-lines/${open.line_id}/send`, { wa_id: open.wa_id, text })); setText(''); loadThread(open); } catch (e) { setErr(e.errors?.text || e.message || 'Could not queue the reply'); } finally { setSending(false); }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[22rem_1fr]">
      <Card className="overflow-hidden">
        <div className="grid gap-2 border-b border-border p-3">
          <Select value={lineId} onChange={setLineId} allowEmpty placeholder="All QR numbers" options={lines.map((l) => ({ value: l.id, label: l.label }))} />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or number" />
        </div>
        <div className="max-h-[32rem] overflow-y-auto">
          {!list ? <div className="p-4"><Skeleton className="h-16 rounded-xl" /></div> : !list.length ? <EmptyState icon={MessageSquareText} title="No chats yet" description="People who message a QR number appear here." /> : list.map((c) => (
            <button key={`${c.line_id}-${c.wa_id}`} type="button" onClick={() => { setThread(null); setErr(''); setOpen(c); }} className={cn('flex w-full cursor-pointer items-start gap-3 border-b border-border px-4 py-3 text-left hover:bg-muted/50', open?.line_id === c.line_id && open?.wa_id === c.wa_id && 'bg-primary-soft/50')}>
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary-soft font-semibold text-primary">{(c.name || '+')[0]}</span>
              <span className="min-w-0 flex-1"><span className="flex items-center gap-2"><b className="truncate">{c.name || `+${c.wa_id}`}</b>{c.opted_out && <Badge tone="danger">STOP</Badge>}</span><span className="block truncate text-xs text-muted-foreground">{c.last?.direction === 'out' ? 'You: ' : ''}{c.last?.body}</span><span className="text-[11px] text-muted-foreground">{c.line} · {when(c.last_in_at)}</span></span>
            </button>
          ))}
        </div>
      </Card>

      <Card className="flex min-h-[28rem] flex-col">
        {!open ? <EmptyState icon={Whatsapp} title="Pick a chat" description="Replies are sent slowly and only within 24 hours of their last message." /> : (
          <>
            <div className="flex items-center gap-3 border-b border-border p-4">
              <div className="min-w-0 flex-1"><p className="font-display font-semibold">{open.name || `+${open.wa_id}`}</p><p className="text-xs text-muted-foreground">+{open.wa_id} · {open.line}</p></div>
              {thread && (thread.contact.opted_out ? <Badge tone="danger">Asked to stop</Badge> : thread.contact.can_reply_for_ms > 0 ? <Badge tone="success" dot>Can reply: {hours(thread.contact.can_reply_for_ms)}</Badge> : <Badge tone="warning">Window closed: wait for them to write</Badge>)}
            </div>
            <div className="flex-1 space-y-2 overflow-y-auto p-4" style={{ maxHeight: '24rem' }}>
              {!thread ? <Skeleton className="h-16 rounded-xl" /> : thread.data.map((m) => (
                <div key={m.id} className={cn('flex', m.direction === 'out' && 'justify-end')}>
                  <div className={cn('max-w-[80%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-sm', m.direction === 'out' ? 'bg-primary text-primary-foreground' : 'bg-muted')}>
                    {m.body}
                    <p className={cn('mt-1 text-[10px]', m.direction === 'out' ? 'text-primary-foreground/70' : 'text-muted-foreground')}>{when(m.at)}{m.direction === 'out' && ` · ${m.status === 'queued' ? 'waiting to send' : m.status}`}{m.error ? ` (${m.error})` : ''}</p>
                  </div>
                </div>
              ))}
              <div ref={endRef} />
            </div>
            <div className="border-t border-border p-3">
              <Field error={err}><Textarea rows={2} value={text} onChange={(e) => { setText(e.target.value); setErr(''); }} placeholder="Write a reply. It is queued and sent after a short human-like pause." disabled={!thread || thread.contact.opted_out || thread.contact.can_reply_for_ms <= 0} /></Field>
              <div className="mt-2 flex items-center justify-end"><Button onClick={send} loading={sending} disabled={!text.trim() || !thread || thread.contact.opted_out || thread.contact.can_reply_for_ms <= 0}><Send />Queue reply</Button></div>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
