/* Admin: dynamic short links (QR / NFC redirects), announcements, activity & message logs */
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Link2, Plus, Pencil, Trash2, Copy, QrCode, Download, BarChart3, Layers, Megaphone, History, MessageSquare, Lock, ShieldBan } from 'lucide-react';
import api from '@/lib/api';
import CrudPage from '@/components/CrudPage';
import ExportMenu from '@/components/ExportMenu';
import { fmtDate, fmtDateTime, label } from '@/lib/format';
import { AreaTrend, Donut } from '@/components/ui/charts';
import {
  PageHeader, TableCard, DataTable, SearchInput, FilterSelect, Action, Actions, Dialog, Button, Field, Input, Select, Segmented, SwitchRow, Badge, StatusBadge,
  EmptyState, Card, CardBody, UserCell, Skeleton, Tip, useList, useForm, run, confirm,
} from '@/components/ui';

const TARGETS = { url: 'Any URL', vcard: 'vCard', store: 'WhatsApp store', unassigned: 'Not activated' };

export function ShortLinks() {
  const [params] = useSearchParams();
  const list = useList('/admin/short-links', { search: params.get('search') || '' });
  const [editing, setEditing] = useState(null);
  const [bulk, setBulk] = useState(false);
  const [stats, setStats] = useState(null);
  const [selected, setSelected] = useState([]);
  const batches = list.extra?.batches || [];
  const copy = (t) => { navigator.clipboard?.writeText(t); toast.success('Copied'); };
  const removeMany = async () => { if (await confirm({ title: `Delete ${selected.length} links?`, description: 'QR codes and NFC tags using them will stop working.' })) { await run(api.post('/admin/short-links/bulk-delete', { ids: selected })).catch(() => {}); setSelected([]); list.reload(); } };
  return (
    <>
      <PageHeader title="Short links & QR" description="Every QR code and NFC tag points to a dynamic link. Change where it goes at any time without re-printing.">
        <ExportMenu what={`short-links/export?batch=${encodeURIComponent(list.params.batch || '')}`} base="/api/admin" label="Export" />
        <Button variant="outline" onClick={() => setBulk(true)}><Layers />Bulk generate</Button>
        <Button onClick={() => setEditing({ target_type: 'url', status: true })}><Plus />New link</Button>
      </PageHeader>
      <TableCard title="Links" list={list} toolbar={<>
        {selected.length > 0 && <Button size="sm" variant="danger-soft" onClick={removeMany}><Trash2 />Delete {selected.length}</Button>}
        <FilterSelect value={list.params.target_type} onChange={(v) => list.set({ target_type: v })} placeholder="All destinations" options={Object.entries(TARGETS).map(([value, l]) => ({ value, label: l }))} />
        {batches.length > 0 && <FilterSelect value={list.params.batch} onChange={(v) => list.set({ batch: v })} placeholder="All batches" options={batches.map((b) => ({ value: b, label: b }))} />}
        <SearchInput value={list.params.search} onChange={(search) => list.set({ search })} placeholder="Code, title, URL..." />
      </>}>
        <DataTable loading={list.loading} rows={list.rows} selected={selected} onSelect={setSelected} empty={<EmptyState icon={Link2} title="No links yet" />} columns={[
          { key: 'code', label: 'Link', render: (l) => <div><button type="button" onClick={() => copy(l.short_url)} className="flex cursor-pointer items-center gap-1.5 font-mono text-xs font-semibold text-primary hover:underline">{l.short_url.replace(/^https?:\/\//, '')}<Copy className="size-3" /></button><p className="text-xs text-muted-foreground">{l.title || l.batch || '-'}</p></div> },
          { key: 'to', label: 'Destination', render: (l) => <div className="max-w-64"><Badge tone={l.target_type === 'unassigned' ? 'warning' : 'outline'}>{TARGETS[l.target_type]}</Badge><p className="mt-0.5 truncate text-xs text-muted-foreground">{l.target_type === 'url' ? l.target_url : l.vcard ? `/${l.vcard.url_alias}` : ''}</p></div> },
          { key: 'owner', label: 'Owner', render: (l) => (l.user ? <UserCell user={l.user} /> : <span className="text-xs text-muted-foreground">-</span>) },
          { key: 'clicks', label: 'Scans', render: (l) => <div><p className="font-semibold">{l.clicks}</p><p className="text-xs text-muted-foreground">{l.last_clicked_at ? fmtDate(l.last_clicked_at) : 'never'}</p></div> },
          { key: 'st', label: 'Status', render: (l) => <div className="flex items-center gap-1.5">{l.status ? <StatusBadge value="active" /> : <StatusBadge value="inactive" />}{l.locked && <Tip content="Only admins can change it"><Lock className="size-3.5 text-muted-foreground" /></Tip>}</div> },
          { key: '_a', label: '', className: 'text-right', render: (l) => (
            <Actions>
              <Action icon={BarChart3} label="Scan analytics" onClick={() => setStats(l)} />
              <Action icon={QrCode} label="Download QR" href={`/api/admin/short-links/${l.id}/qrcode?size=800`} />
              <Action icon={Pencil} label="Change destination" tone="info" onClick={() => setEditing(l)} />
              <Action icon={Trash2} label="Delete" tone="danger" onClick={async () => { if (await confirm({ title: 'Delete this link?', description: 'QR codes and NFC tags using it stop working.' })) { await run(api.delete(`/admin/short-links/${l.id}`)).catch(() => {}); list.reload(); } }} />
            </Actions>
          ) },
        ]} />
      </TableCard>
      {editing && <LinkForm link={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); list.reload(); }} />}
      {bulk && <BulkForm onClose={() => setBulk(false)} onDone={(b) => { setBulk(false); list.set({ batch: b }); }} />}
      {stats && <LinkStats link={stats} onClose={() => setStats(null)} />}
    </>
  );
}

function LinkForm({ link, onClose, onSaved }) {
  const form = useForm({ code: link.code || '', title: link.title || '', note: link.note || '', target_type: link.target_type === 'unassigned' ? 'vcard' : link.target_type, target_url: link.target_url || '', vcard_id: link.vcard_id || '', store_id: link.store_id || '', status: link.status !== false, locked: !!link.locked });
  const [vcards, setVcards] = useState([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => { api.get('/admin/vcards', { params: { per_page: 100 } }).then(({ data }) => setVcards(data.data)); }, []);
  const v = form.values;
  const save = async () => { setBusy(true); try { await run(link.id ? api.put(`/admin/short-links/${link.id}`, v) : api.post('/admin/short-links', v)); onSaved(); } catch (e) { form.setErrors(e.errors || {}); } finally { setBusy(false); } };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} icon={Link2} title={link.id ? 'Change destination' : 'New dynamic link'} description={link.id ? link.short_url : 'The printed QR / written NFC keeps working when you change the destination later.'}
      footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={save} loading={busy}>Save</Button></>}>
      <div className="space-y-4">
        <Field label="Opens" error={form.errors.target_type}><Segmented id="tt" value={v.target_type} onChange={(x) => form.set('target_type', x)} options={[{ value: 'vcard', label: 'A vCard' }, { value: 'url', label: 'Any URL' }]} /></Field>
        {v.target_type === 'url' && <Field label="Destination URL" error={form.errors.target_url}><Input {...form.input('target_url')} placeholder="https://g.page/r/... (Google review), instagram.com/..." /></Field>}
        {v.target_type === 'vcard' && <Field label="vCard" error={form.errors.vcard_id}><Select value={v.vcard_id} onChange={(x) => form.set('vcard_id', x)} options={vcards.map((c) => ({ value: c.id, label: `${c.name} · /${c.url_alias}` }))} placeholder="Choose a vCard" /></Field>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Title"><Input {...form.input('title')} /></Field>
          <Field label="Custom code" hint="Letters, numbers, - or _" error={form.errors.code}><Input {...form.input('code')} placeholder="auto" /></Field>
        </div>
        <Field label="Note"><Input {...form.input('note')} /></Field>
        <SwitchRow title="Active" checked={v.status} onChange={(x) => form.set('status', x)} />
        <SwitchRow title="Locked" description="The owner cannot change the destination" checked={v.locked} onChange={(x) => form.set('locked', x)} />
      </div>
    </Dialog>
  );
}

function BulkForm({ onClose, onDone }) {
  const form = useForm({ count: 100, batch: '', target_url: '', locked: false, length: 7 });
  const [busy, setBusy] = useState(false);
  const save = async () => { setBusy(true); try { const d = await run(api.post('/admin/short-links/bulk', form.values)); onDone(d.batch); } catch (e) { form.setErrors(e.errors || {}); } finally { setBusy(false); } };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} icon={Layers} title="Bulk generate links" description="For pre-printed NFC tags, stickers and QR cards. Customers activate a tag by entering its code in their portal (Short links > Activate tag), or you assign it here."
      footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={save} loading={busy}>Generate</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="How many" hint="Up to 5000"><Input {...form.input('count')} type="number" min="1" max="5000" /></Field>
        <Field label="Code length"><Input {...form.input('length')} type="number" min="5" max="12" /></Field>
        <Field label="Batch name" className="sm:col-span-2"><Input {...form.input('batch')} placeholder="e.g. Review standees - Oct 2026" /></Field>
        <Field label="Default destination (optional)" hint="Leave empty = 'not activated' page until assigned" error={form.errors.target_url} className="sm:col-span-2"><Input {...form.input('target_url')} placeholder="https://" /></Field>
        <div className="sm:col-span-2"><SwitchRow title="Lock links" description="Only admins can change their destination" checked={form.values.locked} onChange={(x) => form.set('locked', x)} /></div>
      </div>
    </Dialog>
  );
}

function LinkStats({ link, onClose }) {
  const [d, setD] = useState(null);
  useEffect(() => { api.get(`/admin/short-links/${link.id}/stats`).then(({ data }) => setD(data)); }, [link.id]);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} size="lg" icon={BarChart3} title={`Scans · ${link.code}`} description={link.short_url}>
      {!d ? <Skeleton className="h-64" /> : (
        <div className="space-y-5">
          <p className="text-3xl font-bold">{d.total}<span className="ml-2 text-sm font-normal text-muted-foreground">total scans / taps</span></p>
          <AreaTrend data={d.daily.map((x) => ({ label: x.date.slice(5), value: x.value }))} name="Scans" height={200} />
          <div className="grid gap-4 sm:grid-cols-3">
            {[['Devices', d.devices], ['Systems', d.os], ['Browsers', d.browsers]].map(([t, rows]) => <Card key={t}><CardBody><p className="mb-2 text-sm font-semibold">{t}</p>{rows.length ? <Donut data={rows} height={150} /> : <p className="text-sm text-muted-foreground">No data</p>}</CardBody></Card>)}
          </div>
        </div>
      )}
    </Dialog>
  );
}

/* ------------------------------------------------------------ announcements */
const planOpt = { optionsUrl: '/admin/plans', optionMap: (p) => ({ value: p.id, label: p.name }) };
const TYPE_TONE = { info: 'info', success: 'success', warning: 'warning', danger: 'danger', promo: 'primary' };
export const Announcements = () => (
  <CrudPage title="Announcements" description="Show news, maintenance notices or offers to every registered user (bell + dashboard banner), optionally by e-mail." endpoint="/admin/announcements" singular="Announcement" icon={Megaphone} size="xl"
    columns={[
      { key: 'title', label: 'Announcement', render: (a) => <div><p className="font-medium">{a.title}</p><p className="text-xs text-muted-foreground">{a.pinned ? 'Pinned · ' : ''}{fmtDateTime(a.created_at)}</p></div> },
      { key: 'type', label: 'Type', render: (a) => <Badge tone={TYPE_TONE[a.type]} dot>{label(a.type)}</Badge> },
      { key: 'aud', label: 'Audience', render: (a) => (a.audience === 'plan' ? `Plan: ${a.plan?.name || '-'}` : { all: 'Everyone', users: 'Users', staff: 'Staff' }[a.audience]) },
      { key: 'win', label: 'Visible', render: (a) => <span className="text-xs text-muted-foreground">{a.starts_at ? fmtDate(a.starts_at) : 'now'} → {a.ends_at ? fmtDate(a.ends_at) : 'no end'}</span> },
      { key: 'mail', label: 'E-mail', render: (a) => (a.emailed_at ? <StatusBadge value="sent" /> : a.send_email ? <Badge>Queued</Badge> : '-') },
      { key: 'status', label: 'Status', render: (a) => <StatusBadge value={a.status ? 'active' : 'inactive'} /> },
    ]}
    fields={[
      { name: 'title', label: 'Title', required: true },
      { name: 'type', label: 'Type', type: 'select', half: true, default: 'info', options: [['info', 'Information'], ['success', 'Good news'], ['warning', 'Warning'], ['danger', 'Important'], ['promo', 'Offer / promo']].map(([value, l]) => ({ value, label: l })) },
      { name: 'audience', label: 'Audience', type: 'select', half: true, default: 'all', options: [['all', 'Everyone'], ['users', 'Users only'], ['staff', 'Staff only'], ['plan', 'Users on a plan']].map(([value, l]) => ({ value, label: l })) },
      { name: 'plan_id', label: 'Plan (for "Users on a plan")', type: 'select', half: true, ...planOpt },
      { name: 'starts_at', label: 'Show from', type: 'datetime-local', half: true },
      { name: 'ends_at', label: 'Show until', type: 'datetime-local', half: true },
      { name: 'link_url', label: 'Button link', half: true, placeholder: 'https://' },
      { name: 'link_label', label: 'Button text', half: true, placeholder: 'Learn more' },
      { name: 'body', label: 'Message', type: 'richtext' },
      { name: 'pinned', label: 'Pin to the top', type: 'switch', default: false },
      { name: 'send_email', label: 'Also send by e-mail (once, when saved active)', type: 'switch', default: false },
      { name: 'status', label: 'Active', type: 'switch' },
    ]} />
);

/* ------------------------------------------------------------ logs */
export function Logs() {
  const [tab, setTab] = useState('activity');
  return (
    <>
      <PageHeader title="Logs" description="Who did what in the admin panel, WhatsApp / SMS delivery, and temporarily blocked IP addresses.">
        <Segmented id="lg" value={tab} onChange={setTab} options={[{ value: 'activity', label: 'Activity' }, { value: 'messages', label: 'WhatsApp & SMS' }, { value: 'bans', label: 'Blocked IPs' }]} />
      </PageHeader>
      {tab === 'activity' ? <ActivityLog /> : tab === 'messages' ? <MessageLog /> : <Bans />}
    </>
  );
}
function ActivityLog() {
  const list = useList('/admin/activity-logs');
  return (
    <TableCard title="Activity" list={list} toolbar={<SearchInput value={list.params.search} onChange={(search) => list.set({ search })} placeholder="Action e.g. order." />}>
      <DataTable loading={list.loading} rows={list.rows} empty={<EmptyState icon={History} title="No activity yet" />} columns={[
        { key: 'at', label: 'When', render: (l) => <span className="text-xs">{fmtDateTime(l.created_at)}</span> },
        { key: 'who', label: 'By', render: (l) => (l.user ? <UserCell user={l.user} sub={label(l.user.role)} /> : 'System') },
        { key: 'a', label: 'Action', render: (l) => <Badge tone="outline" className="font-mono">{l.action}</Badge> },
        { key: 'e', label: 'Record', render: (l) => (l.entity ? `${label(l.entity)} #${l.entity_id}` : '-') },
        { key: 'ip', label: 'IP', render: (l) => <span className="font-mono text-xs text-muted-foreground">{l.ip}</span> },
      ]} />
    </TableCard>
  );
}
function MessageLog() {
  const list = useList('/admin/message-logs');
  return (
    <TableCard title="Messages" list={list} toolbar={<>
      <FilterSelect value={list.params.channel} onChange={(v) => list.set({ channel: v })} placeholder="All channels" options={[{ value: 'whatsapp', label: 'WhatsApp' }, { value: 'sms', label: 'SMS' }]} />
      <FilterSelect value={list.params.status} onChange={(v) => list.set({ status: v })} placeholder="All statuses" options={['sent', 'failed', 'skipped'].map((v) => ({ value: v, label: label(v) }))} />
    </>}>
      <DataTable loading={list.loading} rows={list.rows} empty={<EmptyState icon={MessageSquare} title="No messages yet" />} columns={[
        { key: 'at', label: 'When', render: (m) => <span className="text-xs">{fmtDateTime(m.created_at)}</span> },
        { key: 'ch', label: 'Channel', render: (m) => <Badge tone={m.channel === 'whatsapp' ? 'success' : 'info'}>{m.channel === 'whatsapp' ? 'WhatsApp' : 'SMS'}</Badge> },
        { key: 'to', label: 'To', render: (m) => <span className="font-mono text-xs">+{m.to}</span> },
        { key: 'ev', label: 'Event', render: (m) => <div><p>{label(m.event)}</p>{m.nfc_order && <p className="text-xs text-muted-foreground">{m.nfc_order.order_number}</p>}</div> },
        { key: 'body', label: 'Message', render: (m) => <p className="max-w-80 truncate text-muted-foreground" title={m.body}>{m.body}</p> },
        { key: 'st', label: 'Status', render: (m) => <Tip content={m.error || label(m.status)}><span><StatusBadge value={m.status} /></span></Tip> },
      ]} />
    </TableCard>
  );
}
function Bans() {
  const [rows, setRows] = useState(null);
  const load = () => api.get('/admin/security/bans').then(({ data }) => setRows(data.data));
  useEffect(() => { load(); }, []);
  return (
    <Card>
      <CardBody>
        <p className="mb-4 text-sm text-muted-foreground">IPs that flooded the login, hit rate limits repeatedly or scanned for exploits are blocked for 30 minutes automatically. The list resets when the server restarts.</p>
        {!rows ? <Skeleton className="h-24" /> : !rows.length ? <EmptyState icon={ShieldBan} title="No blocked IPs right now" /> : (
          <ul className="divide-y divide-border">{rows.map((b) => <li key={b.ip} className="flex items-center justify-between py-2.5 text-sm"><span className="font-mono">{b.ip}</span><span className="text-muted-foreground">until {fmtDateTime(b.until)}</span><Button size="xs" variant="outline" onClick={async () => { await run(api.delete(`/admin/security/bans/${encodeURIComponent(b.ip)}`)); load(); }}>Unblock</Button></li>)}</ul>
        )}
      </CardBody>
    </Card>
  );
}
