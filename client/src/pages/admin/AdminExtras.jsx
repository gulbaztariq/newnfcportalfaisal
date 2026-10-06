import { useEffect, useState } from 'react';
import { Link2, Store, Newspaper, Check, X, ExternalLink, Trash2, Copy, ImageOff } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api';
import CrudPage from '@/components/CrudPage';
import { fmtDate, fmtDateTime } from '@/lib/format';
import {
  PageHeader, TableCard, DataTable, SearchInput, Segmented, Action, Actions, Switch, Badge, StatusBadge, UserCell, EmptyState, Card, CardBody, useList, run, confirm,
} from '@/components/ui';

const DOMAIN_TONE = { pending: 'warning', approved: 'success', rejected: 'danger' };

/** Custom domains requested by users for their vCards */
export function CustomDomains() {
  const [status, setStatus] = useState('');
  const [data, setData] = useState(null);
  const load = () => api.get('/admin/custom-domains', { params: status ? { status } : {} }).then(({ data: d }) => setData(d));
  useEffect(() => { load(); }, [status]); // eslint-disable-line
  const decide = async (v, s) => { await run(api.patch(`/admin/custom-domains/${v.id}`, { status: s })).catch(() => {}); load(); };
  const copy = (t) => { navigator.clipboard?.writeText(t); toast.success('Copied'); };
  return (
    <>
      <PageHeader title="Custom Domains" description="Users can point their own domain at a vCard. Approve a domain once its DNS is set up.">
        <Segmented id="cds" value={status} onChange={setStatus} options={[{ value: '', label: 'All' }, { value: 'pending', label: 'Pending' }, { value: 'approved', label: 'Approved' }, { value: 'rejected', label: 'Rejected' }]} />
      </PageHeader>
      {data && (
        <Card className="mb-5"><CardBody className="flex flex-wrap items-center gap-3 text-sm">
          <span className="text-muted-foreground">DNS for users: a <b className="text-foreground">CNAME</b> record pointing to</span>
          <button type="button" onClick={() => copy(data.target)} className="inline-flex items-center gap-1.5 rounded-lg bg-muted px-2.5 py-1 font-mono text-xs hover:bg-primary-soft hover:text-primary">{data.target}<Copy className="size-3" /></button>
          <span className="text-muted-foreground">The domain must also be added on the hosting platform so a TLS certificate is issued.</span>
        </CardBody></Card>
      )}
      <TableCard title="Domain requests">
        <DataTable loading={!data} rows={data?.data || []} empty={<EmptyState icon={Link2} title="No custom domains" description="Requests appear here when users add a domain in the vCard editor." />}
          columns={[
            { key: 'custom_domain', label: 'Domain', render: (v) => <a href={`https://${v.custom_domain}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 font-medium hover:text-primary">{v.custom_domain}<ExternalLink className="size-3.5" /></a> },
            { key: 'vcard', label: 'vCard', render: (v) => <a href={`/${v.url_alias}`} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-primary">{v.name} · /{v.url_alias}</a> },
            { key: 'user', label: 'Owner', render: (v) => <UserCell user={v.user} /> },
            { key: 'st', label: 'Status', render: (v) => <Badge tone={DOMAIN_TONE[v.custom_domain_status] || 'neutral'} dot>{v.custom_domain_status || 'pending'}</Badge> },
            { key: 'updated_at', label: 'Requested', render: (v) => fmtDateTime(v.updated_at) },
            { key: '_a', label: '', className: 'text-right', render: (v) => (
              <Actions>
                {v.custom_domain_status !== 'approved' && <Action icon={Check} label="Approve" tone="success" onClick={() => decide(v, 'approved')} />}
                {v.custom_domain_status !== 'rejected' && <Action icon={X} label="Reject" tone="danger" onClick={() => decide(v, 'rejected')} />}
              </Actions>
            ) },
          ]} />
      </TableCard>
    </>
  );
}

/** Every user's WhatsApp store */
export function AdminStores() {
  const list = useList('/admin/whatsapp-stores');
  const toggle = async (s, v) => { await run(api.patch(`/admin/whatsapp-stores/${s.id}`, { status: v }), v ? 'Store activated' : 'Store deactivated').catch(() => {}); list.reload(); };
  const remove = async (s) => { if (await confirm({ title: `Delete store "${s.name}"?`, description: 'Its products, categories and orders are removed too.' })) { await run(api.delete(`/admin/whatsapp-stores/${s.id}`)).catch(() => {}); list.reload(); } };
  return (
    <>
      <PageHeader title="WhatsApp Stores" description="Product catalogues where customers order straight through WhatsApp." />
      <TableCard title="All stores" list={list} toolbar={<SearchInput value={list.params.search} onChange={(search) => list.set({ search })} placeholder="Search stores..." />}>
        <DataTable loading={list.loading} rows={list.rows} empty={<EmptyState icon={Store} title="No stores yet" />}
          columns={[
            { key: 'name', label: 'Store', render: (s) => (
              <div className="flex items-center gap-3">
                {s.logo ? <img src={s.logo} alt="" className="size-10 rounded-xl object-cover" /> : <span className="grid size-10 place-items-center rounded-xl bg-muted text-muted-foreground"><ImageOff className="size-4" /></span>}
                <div><p className="font-medium">{s.name}</p><a href={`/s/${s.url_alias}`} target="_blank" rel="noreferrer" className="text-xs text-muted-foreground hover:text-primary">/s/{s.url_alias}</a></div>
              </div>
            ) },
            { key: 'user', label: 'Owner', render: (s) => <UserCell user={s.user} /> },
            { key: 'created_at', label: 'Created', render: (s) => fmtDate(s.created_at) },
            { key: 'status', label: 'Active', render: (s) => <Switch size="sm" checked={s.status} onChange={(v) => toggle(s, v)} /> },
            { key: '_a', label: '', className: 'text-right', render: (s) => <Actions><Action icon={ExternalLink} label="Open" href={`/s/${s.url_alias}`} target="_blank" rel="noreferrer" /><Action icon={Trash2} label="Delete" tone="danger" onClick={() => remove(s)} /></Actions> },
          ]} />
      </TableCard>
    </>
  );
}

/** Blog posts shown on the public website */
export const FrontBlogs = () => (
  <CrudPage title="Blog" description="Articles published on the landing page and at /blog." endpoint="/admin/front-blogs" singular="Post" icon={Newspaper} size="xl"
    columns={[
      { key: 'title', label: 'Post', render: (b) => (
        <div className="flex items-center gap-3">
          {b.image ? <img src={b.image} alt="" className="h-11 w-16 rounded-xl object-cover" /> : <span className="grid h-11 w-16 place-items-center rounded-xl bg-muted text-muted-foreground"><ImageOff className="size-4" /></span>}
          <div className="min-w-0"><p className="max-w-sm truncate font-medium">{b.title}</p><a href={`/blog/${b.slug}`} target="_blank" rel="noreferrer" className="text-xs text-muted-foreground hover:text-primary">/blog/{b.slug}</a></div>
        </div>
      ) },
      { key: 'status', label: 'Status', render: (b) => (b.status ? <Badge tone="success" dot>Published</Badge> : <Badge dot>Draft</Badge>) },
      { key: 'created_at', label: 'Created', render: (b) => fmtDate(b.created_at) },
    ]}
    fields={[
      { name: 'title', label: 'Title', required: true },
      { name: 'slug', label: 'Slug', half: true, hint: 'Leave empty to generate from the title' },
      { name: 'status', label: 'Published', type: 'switch' },
      { name: 'excerpt', label: 'Excerpt', type: 'textarea', rows: 2 },
      { name: 'image', label: 'Cover image', type: 'image' },
      { name: 'content', label: 'Content', type: 'richtext', required: true },
    ]} />
);
