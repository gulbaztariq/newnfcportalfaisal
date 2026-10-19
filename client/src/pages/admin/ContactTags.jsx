/* Admin: contact tags (QR / NFC tags that reach the owner without showing their number) made by contact-tag orders */
import { useState } from 'react';
import { ShieldCheck, Copy, ExternalLink, QrCode, MessageSquare, PhoneCall, Download, KeyRound, Power, Check } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api';
import { cn } from '@/lib/cn';
import { fmtDateTime } from '@/lib/format';
import { PageHeader, TableCard, DataTable, SearchInput, FilterSelect, Button, ButtonLink, Badge, Dialog, EmptyState, Skeleton, Tip, Switch, useList, run, confirm } from '@/components/ui';

const copy = (text, what) => { navigator.clipboard?.writeText(text); toast.success(`${what} copied`); };

function Messages({ tag, onClose, onChanged }) {
  const [rows, setRows] = useState(null);
  const load = () => api.get(`/admin/contact-tags/${tag.id}/messages`).then(({ data }) => setRows(data.data));
  if (rows === null) load();
  const mark = async (m) => { await api.patch(`/admin/contact-tags/messages/${m.id}`, { status: m.status === 'new' ? 'handled' : 'new' }); await load(); onChanged(); };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} size="md" icon={MessageSquare} title={`Messages for ${tag.label || tag.code}`} description="What people sent through the tag page. Their numbers are shown here for staff only.">
      {!rows ? <Skeleton className="h-40 rounded-2xl" /> : !rows.length ? <EmptyState icon={MessageSquare} title="No messages yet" /> : (
        <div className="space-y-2">
          {rows.map((m) => (
            <div key={m.id} className={cn('rounded-2xl border p-3 text-sm', m.status === 'new' ? 'border-primary/40 bg-primary-soft/30' : 'border-border')}>
              <div className="flex items-center justify-between gap-2">
                <p className="flex items-center gap-2 font-medium">{m.type === 'callback' ? <PhoneCall className="size-4 text-primary" /> : <MessageSquare className="size-4 text-primary" />}{m.type === 'callback' ? 'Call-back request' : 'Message'} · {m.name || 'someone'}{m.phone && <a href={`tel:${m.phone}`} className="text-primary hover:underline">{m.phone}</a>}</p>
                <Button size="sm" variant="ghost" onClick={() => mark(m)}>{m.status === 'new' ? <><Check />Mark handled</> : 'Reopen'}</Button>
              </div>
              {m.text && <p className="mt-1">{m.text}</p>}
              <p className="mt-1 text-xs text-muted-foreground">{fmtDateTime(m.created_at)} · to {m.to_role}{m.delivery && Object.keys(m.delivery).length ? ` · ${Object.entries(m.delivery).map(([k, v]) => `${k}: ${v}`).join(', ')}` : ''}</p>
            </div>
          ))}
        </div>
      )}
    </Dialog>
  );
}

export function ContactTags() {
  const list = useList('/admin/contact-tags');
  const [open, setOpen] = useState(null);
  const toggle = async (t, status) => { await run(api.patch(`/admin/contact-tags/${t.id}`, { status })).catch(() => {}); list.reload(); };
  const resetLink = async (t) => {
    if (!(await confirm({ title: 'Reset the owner link?', description: 'The old private link stops working. Copy the new one afterwards.' }))) return;
    const d = await run(api.patch(`/admin/contact-tags/${t.id}`, { reset_link: true })).catch(() => null);
    if (d) { copy(d.data.manage_url, 'New owner link'); list.reload(); }
  };
  return (
    <>
      <PageHeader title="Contact tags" description="QR / NFC tags that let anyone reach the owner without seeing their phone number. Car contact tags and airport (luggage) tags, made by orders from the shop or the New order screen.">
        <ButtonLink href="/api/admin/contact-tags/export" variant="outline"><Download />Export links (CSV)</ButtonLink>
      </PageHeader>
      <TableCard title="Tags" list={list} toolbar={<>
        <FilterSelect value={list.params.status} onChange={(v) => list.set({ status: v })} placeholder="All tags" options={[{ value: '1', label: 'Active' }, { value: '0', label: 'Switched off' }]} />
        <SearchInput value={list.params.search} onChange={(search) => list.set({ search })} placeholder="Code, label, owner, phone..." />
      </>}>
        <DataTable loading={list.loading} rows={list.rows}
          empty={<EmptyState icon={ShieldCheck} title="No contact tags yet" description="Choose Car contact tag or Airport tag in New order, or sell them in the shop. One tag is made per piece, each with its own link and QR code." />}
          columns={[
            { key: 'c', label: 'Tag', render: (t) => <div><p className="flex items-center gap-2 font-mono text-sm font-semibold text-primary">{t.code}{t.kind === 'luggage' && <Badge tone="info">Luggage</Badge>}</p><p className="text-xs text-muted-foreground">{t.label || 'No label yet'}{t.order_number ? ` · ${t.order_number}` : ''}</p></div> },
            { key: 'o', label: 'Owner', render: (t) => <div className="text-sm"><p>{t.owner_name || '-'}</p><p className="text-xs text-muted-foreground">{t.owner_phone || t.owner_email || ''}</p></div> },
            { key: 's', label: 'Scans', render: (t) => <span className="tabular-nums">{t.scans}</span> },
            { key: 'm', label: 'Messages', render: (t) => <button type="button" onClick={() => setOpen(t)} className="cursor-pointer">{t.messages ? <Badge tone={t.new_messages ? 'primary' : 'neutral'}>{t.messages}{t.new_messages ? ` · ${t.new_messages} new` : ''}</Badge> : <span className="text-muted-foreground">0</span>}</button> },
            { key: 'st', label: 'Active', render: (t) => <Switch size="sm" checked={!!t.status} onChange={(v) => toggle(t, v)} /> },
            { key: 'a', label: '', className: 'text-right', render: (t) => (
              <div className="flex justify-end gap-1">
                <Tip content="Copy the tag link (for the NFC chip / QR)"><Button size="icon-sm" variant="ghost" onClick={() => copy(t.url, 'Tag link')} aria-label="Copy tag link"><Copy /></Button></Tip>
                <Tip content="Open the tag page"><ButtonLink size="icon-sm" variant="ghost" href={t.url} target="_blank" rel="noreferrer" aria-label="Open"><ExternalLink /></ButtonLink></Tip>
                <Tip content="QR code image"><ButtonLink size="icon-sm" variant="ghost" href={`${t.url}/qr.png`} target="_blank" rel="noreferrer" aria-label="QR code"><QrCode /></ButtonLink></Tip>
                <Tip content="Copy the owner's private link (to send to the customer)"><Button size="icon-sm" variant="ghost" onClick={() => copy(t.manage_url, 'Owner link')} aria-label="Copy owner link"><KeyRound /></Button></Tip>
                <Tip content="Reset the owner link"><Button size="icon-sm" variant="ghost" onClick={() => resetLink(t)} aria-label="Reset owner link"><Power /></Button></Tip>
              </div>
            ) },
          ]} />
      </TableCard>
      {open && <Messages tag={open} onClose={() => setOpen(null)} onChanged={list.reload} />}
    </>
  );
}
