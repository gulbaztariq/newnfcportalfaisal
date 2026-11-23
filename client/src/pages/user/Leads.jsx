import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useSearchParams } from 'react-router-dom';
import { MessageSquareText, ExternalLink, Trash2, Pencil, Webhook, Users, Plus, Copy, Send, RefreshCw, Zap } from 'lucide-react';
import api from '@/lib/api';
import { fmtDateTime } from '@/lib/format';
import {
  PageHeader, Card, CardHeader, CardBody, Button, Field, Input, Textarea, Select, Badge, EmptyState, Skeleton, Switch, SwitchRow,
  TableCard, DataTable, Action, Actions, SearchInput, FilterSelect, useList, run, confirm, Dialog,
} from '@/components/ui';
import ExportMenu from '@/components/ExportMenu';

const STATUSES = [['new', 'New', 'info'], ['contacted', 'Contacted', 'warning'], ['qualified', 'Qualified', 'primary'], ['won', 'Won', 'success'], ['lost', 'Lost', 'neutral']];
const tone = (s) => STATUSES.find((x) => x[0] === (s || 'new'))?.[2] || 'neutral';
const label = (s) => STATUSES.find((x) => x[0] === (s || 'new'))?.[1] || 'New';

/** a lead's follow-up: status, tags, private notes */
function LeadDialog({ lead, onClose, onSaved }) {
  const [status, setStatus] = useState(lead.status || 'new');
  const [tags, setTags] = useState((lead.tags || []).join(', '));
  const [notes, setNotes] = useState(lead.notes || '');
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    try { await run(api.patch(`/user/enquiries/${lead.id}`, { status, tags: tags.split(',').map((t) => t.trim()).filter(Boolean), notes }), 'Lead updated'); onSaved(); } catch { /* shown as a toast */ }
    setSaving(false);
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title={lead.name} description={[lead.email, lead.phone].filter(Boolean).join(' · ') || 'Lead details'} icon={MessageSquareText}
      footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button></>}>
      <div className="space-y-4">
        <div className="rounded-xl bg-muted/60 p-3 text-sm"><p className="mb-1 text-xs text-muted-foreground">Message{lead.product_name ? ` · about ${lead.product_name}` : ''}</p>{lead.message}</div>
        <Field label="Status"><Select value={status} onChange={setStatus} options={STATUSES.map(([value, l]) => ({ value, label: l }))} /></Field>
        <Field label="Tags" hint="Separate with commas, e.g. hot, expo-2026"><Input value={tags} onChange={(e) => setTags(e.target.value)} maxLength={200} /></Field>
        <Field label="Private notes" hint="Only you can see these"><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={4000} placeholder="Follow-up plan, what was agreed…" /></Field>
      </div>
    </Dialog>
  );
}

export function UserEnquiries() {
  const list = useList('/user/enquiries');
  const [open, setOpen] = useState(null);
  const counts = list.extra?.counts || {};
  const remove = async (e) => { if (await confirm({ title: 'Delete this lead?' })) { await run(api.delete(`/user/enquiries/${e.id}`)).catch(() => {}); list.reload(); } };
  const quick = async (e, status) => { await run(api.patch(`/user/enquiries/${e.id}`, { status })).catch(() => {}); list.reload(); };
  return (
    <>
      <PageHeader title="Leads" description="Messages and contact details visitors sent from your cards. Track each one from new to won."><ExportMenu what="enquiries" /></PageHeader>
      <div className="mb-4 flex flex-wrap gap-2">
        <button type="button" onClick={() => list.set({ status: '' })} className={`rounded-full border px-3 py-1 text-xs font-medium ${!list.params.status ? 'border-primary bg-primary-soft text-primary' : 'border-border text-muted-foreground'}`}>All</button>
        {STATUSES.map(([v, l]) => <button key={v} type="button" onClick={() => list.set({ status: v })} className={`rounded-full border px-3 py-1 text-xs font-medium ${list.params.status === v ? 'border-primary bg-primary-soft text-primary' : 'border-border text-muted-foreground'}`}>{l} · {counts[v] ?? 0}</button>)}
      </div>
      <TableCard title="Inbox" list={list} toolbar={<SearchInput value={list.params.search} onChange={(v) => list.set({ search: v })} placeholder="Search name, tag, note…" />}>
        <DataTable loading={list.loading} rows={list.rows} empty={<EmptyState icon={MessageSquareText} title="No leads here" description="Leads appear when visitors use the enquiry form or save your contact." />} columns={[
          { key: 'from', label: 'From', render: (e) => <div className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-full bg-primary-soft font-semibold text-primary">{(e.name || '?')[0]}</span><div><p className="font-medium">{e.name}</p><p className="text-xs text-muted-foreground">{e.email || e.phone}{e.source === 'whatsapp' && <Badge tone="success" className="ml-1.5">WhatsApp</Badge>}</p></div></div> },
          { key: 'status', label: 'Status', render: (e) => <FilterSelect value={e.status || 'new'} onChange={(v) => quick(e, v)} options={STATUSES.map(([value, l]) => ({ value, label: l }))} placeholder={label(e.status)} /> },
          { key: 'card', label: 'vCard', render: (e) => <Badge tone="outline">{e.vcard?.name}</Badge> },
          { key: 'msg', label: 'Message', className: 'whitespace-normal', render: (e) => <div className="max-w-md"><p className="text-sm text-muted-foreground">{e.message}</p>{!!(e.tags || []).length && <div className="mt-1 flex flex-wrap gap-1">{e.tags.map((t) => <Badge key={t} tone="outline">{t}</Badge>)}</div>}{e.notes && <p className="mt-1 text-xs italic text-muted-foreground">Note: {e.notes.slice(0, 80)}</p>}</div> },
          { key: 'date', label: 'Received', render: (e) => <span className="text-xs text-muted-foreground">{fmtDateTime(e.created_at)}</span> },
          { key: '_a', label: '', className: 'text-right', render: (e) => <Actions><Action icon={Pencil} label="Status, tags & notes" onClick={() => setOpen(e)} />{e.email && <Action icon={ExternalLink} label="Reply" href={`mailto:${e.email}`} />}{e.source === 'whatsapp' && e.wa_id && <Action icon={ExternalLink} label="Reply on WhatsApp" href={`https://wa.me/${e.wa_id}`} />}<Action icon={Trash2} label="Delete" tone="danger" onClick={() => remove(e)} /></Actions> },
        ]} />
      </TableCard>
      {open && <LeadDialog lead={open} onClose={() => setOpen(null)} onSaved={() => { setOpen(null); list.reload(); }} />}
    </>
  );
}

/* ---------------------------------------------------------------- webhooks */
function HookDialog({ hook, events, onClose, onSaved }) {
  const [f, setF] = useState({ name: hook?.name || '', url: hook?.url || '', events: hook?.events || ['lead.created'] });
  const [err, setErr] = useState({}); const [saving, setSaving] = useState(false);
  const toggle = (e) => setF((x) => ({ ...x, events: x.events.includes(e) ? x.events.filter((y) => y !== e) : [...x.events, e] }));
  const save = async () => {
    setSaving(true); setErr({});
    try { await run(hook ? api.put(`/user/webhooks/${hook.id}`, f) : api.post('/user/webhooks', f), hook ? 'Webhook saved' : 'Webhook added'); onSaved(); } catch (e) { setErr(e.errors || {}); }
    setSaving(false);
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title={hook ? 'Edit webhook' : 'Add webhook'} icon={Webhook}
      footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button></>}>
      <div className="space-y-4">
        <Field label="Name" required error={err.name}><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Zapier – new leads" maxLength={80} /></Field>
        <Field label="Webhook URL" required error={err.url} hint="Must start with https://. Paste the URL from Zapier (Catch Hook), Make, n8n or your CRM."><Input value={f.url} onChange={(e) => setF({ ...f, url: e.target.value })} placeholder="https://hooks.zapier.com/hooks/catch/…" /></Field>
        <Field label="Send me" error={err.events}>
          <div className="space-y-2">{Object.entries(events).map(([k, l]) => <label key={k} className="flex cursor-pointer items-center gap-2 text-sm"><input type="checkbox" checked={f.events.includes(k)} onChange={() => toggle(k)} className="size-4 accent-[var(--color-primary)]" />{l} <code className="text-xs text-muted-foreground">{k}</code></label>)}</div>
        </Field>
      </div>
    </Dialog>
  );
}

function Deliveries({ hook, onClose }) {
  const [rows, setRows] = useState(null);
  useEffect(() => { api.get(`/user/webhooks/${hook.id}/deliveries`).then(({ data }) => setRows(data.data)); }, [hook.id]);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title={`Deliveries · ${hook.name}`} description="The last 30 attempts" size="lg">
      {!rows ? <Skeleton className="h-24" /> : !rows.length ? <p className="py-6 text-center text-sm text-muted-foreground">Nothing sent yet. Use “Send test”.</p> : (
        <div className="divide-y divide-border text-sm">{rows.map((d) => <div key={d.id} className="flex items-center justify-between gap-3 py-2"><div><Badge tone={d.ok ? 'success' : 'danger'}>{d.ok ? 'Delivered' : 'Failed'}</Badge> <code className="ml-1 text-xs">{d.event}</code>{d.error && <p className="mt-0.5 text-xs text-danger">{d.error}</p>}</div><div className="text-right text-xs text-muted-foreground">{d.status || 'no reply'} · {d.ms} ms<br />{fmtDateTime(d.created_at)}</div></div>)}</div>
      )}
    </Dialog>
  );
}


/** connect a Google account so every new lead is added to the owner's Google Contacts */
function GoogleContacts() {
  const [st, setSt] = useState(null); const [busy, setBusy] = useState(false);
  const [q, setQ] = useSearchParams();
  const load = () => api.get('/user/integrations/google').then(({ data }) => setSt(data)).catch(() => setSt(false));
  useEffect(() => { load(); }, []);
  useEffect(() => {
    const r = q.get('google'); if (!r) return;
    if (r === 'connected') toast.success('Google Contacts connected'); else if (r === 'denied') toast.info('Google access was not allowed'); else toast.error(`Could not connect Google${q.get('reason') ? `: ${q.get('reason')}` : ''}`);
    setQ({}, { replace: true });
  }, []); // eslint-disable-line
  const connect = async () => { setBusy(true); try { const { data } = await api.post('/user/integrations/google/connect'); window.location.href = data.url; } catch (e) { toast.error(e.message); setBusy(false); } };
  const act = async (fn) => { setBusy(true); try { await fn(); await load(); } catch (e) { toast.error(e.message); } finally { setBusy(false); } };
  if (st === null) return <Skeleton className="mb-6 h-28" />;
  if (st === false) return null;
  return (
    <Card className="mb-6">
      <CardHeader icon={Users} title={<span className="flex items-center gap-2">Google Contacts{st.connected && <Badge tone="success">Connected</Badge>}</span>} description="Every new lead is added to your Google Contacts, so it is on your phone straight away." />
      <CardBody className="space-y-3">
        {!st.configured ? <p className="text-sm text-muted-foreground">The administrator has not set up Google access yet (Admin, Settings, Integrations: Google client ID and secret).</p> : !st.connected ? (
          <><p className="text-sm text-muted-foreground">You choose the Google account and can disconnect any time. Only contacts are written; your existing contacts are not read.</p><Button onClick={connect} loading={busy}>Connect Google</Button></>
        ) : (
          <>
            <p className="text-sm">Connected as <b>{st.email || 'your Google account'}</b></p>
            <SwitchRow id="g-auto" title="Add new leads automatically" checked={st.auto} onChange={(v) => act(() => api.put('/user/integrations/google', { auto: v }))} />
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" loading={busy} onClick={() => act(async () => { const { data } = await api.post('/user/integrations/google/sync-all'); toast.success(data.message); })}>Send existing leads</Button>
              <Button size="sm" variant="outline" onClick={() => act(() => api.post('/user/integrations/google/disconnect'))}>Disconnect</Button>
            </div>
          </>
        )}
      </CardBody>
    </Card>
  );
}

export function Webhooks() {
  const [state, setState] = useState({ rows: null, events: {} });
  const [edit, setEdit] = useState(null); const [log, setLog] = useState(null);
  const load = () => api.get('/user/webhooks').then(({ data }) => setState({ rows: data.data, events: data.events }));
  useEffect(() => { load(); }, []);
  const copy = async (t) => { try { await navigator.clipboard.writeText(t); toast.success('Copied'); } catch { toast.info(t); } };
  const test = async (h) => { try { const { data } = await api.post(`/user/webhooks/${h.id}/test`); data.data.ok ? toast.success('Test delivered') : toast.error(data.message); } catch (e) { toast.error(e.message); } load(); };
  const toggle = async (h, active) => { await run(api.put(`/user/webhooks/${h.id}`, { active })).catch(() => {}); load(); };
  const rotate = async (h) => { if (await confirm({ title: 'Create a new signing secret?', description: 'The old secret stops working. Update it in Zapier / your server.' })) { await run(api.post(`/user/webhooks/${h.id}/secret`)).catch(() => {}); load(); } };
  const remove = async (h) => { if (await confirm({ title: `Delete ${h.name}?` })) { await run(api.delete(`/user/webhooks/${h.id}`)).catch(() => {}); load(); } };
  return (
    <>
      <PageHeader title="Integrations & webhooks" description="Send new leads, bookings and subscribers to Zapier, Make, n8n or your own CRM the moment they arrive."><Button onClick={() => setEdit({})}><Plus />Add webhook</Button></PageHeader>
      <GoogleContacts />
      {!state.rows ? <Skeleton className="h-40" /> : !state.rows.length ? (
        <Card><CardBody><EmptyState icon={Zap} title="No webhooks yet" description="Add one to push every new lead into your CRM, Google Sheets or WhatsApp automations." action={<Button onClick={() => setEdit({})}><Plus />Add webhook</Button>} /></CardBody></Card>
      ) : (
        <div className="space-y-4">{state.rows.map((h) => (
          <Card key={h.id}>
            <CardHeader title={<span className="flex items-center gap-2">{h.name}{!h.active && <Badge tone="danger">Paused{h.failures >= 10 ? ' after repeated failures' : ''}</Badge>}{h.last_status >= 200 && h.last_status < 300 && <Badge tone="success">Last delivery OK</Badge>}</span>} description={h.url}
              actions={<div className="flex items-center gap-2"><Switch checked={h.active} onChange={(v) => toggle(h, v)} label="Active" /></div>} />
            <CardBody className="space-y-3">
              <div className="flex flex-wrap gap-1.5">{h.events.map((e) => <Badge key={e} tone="outline">{state.events[e] || e}</Badge>)}</div>
              <div className="flex items-center gap-2 rounded-xl bg-muted/60 px-3 py-2 text-xs"><span className="text-muted-foreground">Signing secret</span><code className="min-w-0 flex-1 truncate">{h.secret}</code><button type="button" aria-label="Copy secret" onClick={() => copy(h.secret)} className="text-muted-foreground hover:text-foreground"><Copy className="size-4" /></button></div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => test(h)}><Send />Send test</Button>
                <Button size="sm" variant="outline" onClick={() => setLog(h)}>Deliveries</Button>
                <Button size="sm" variant="outline" onClick={() => setEdit(h)}><Pencil />Edit</Button>
                <Button size="sm" variant="outline" onClick={() => rotate(h)}><RefreshCw />New secret</Button>
                <Button size="sm" variant="outline" onClick={() => remove(h)}><Trash2 />Delete</Button>
              </div>
            </CardBody>
          </Card>
        ))}</div>
      )}
      <Card className="mt-6"><CardHeader title="Verify the signature" description="Every request carries X-NFC-Timestamp and X-NFC-Signature." /><CardBody><pre className="overflow-x-auto rounded-xl bg-muted/60 p-3 text-xs">{`expected = "sha256=" + HMAC_SHA256(secret, timestamp + "." + rawBody)  // compare with X-NFC-Signature`}</pre></CardBody></Card>
      {edit && <HookDialog hook={edit.id ? edit : null} events={state.events} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); load(); }} />}
      {log && <Deliveries hook={log} onClose={() => setLog(null)} />}
    </>
  );
}
