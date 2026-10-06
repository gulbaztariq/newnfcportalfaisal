import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { toast } from 'sonner';
import { Eye, Copy, Trash2, BadgeCheck, IdCard, LayoutTemplate, ExternalLink, CopyPlus } from 'lucide-react';
import api from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/cn';
import { fmtDate } from '@/lib/format';
import { PageHeader, TableCard, DataTable, SearchInput, FilterSelect, Action, Actions, Switch, Badge, UserCell, EmptyState, Skeleton, Card, Segmented, Dialog, Button, Field, Select, useList, run, confirm } from '@/components/ui';

/** Live, scaled preview of a template or vCard */
export function Preview({ src, title, scale = 0.62, className }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <div className={cn('tpl-box', className)} style={{ '--tpl-scale': scale }}>
      {!loaded && <div className="skeleton absolute inset-0 rounded-none" />}
      <iframe src={src} title={title} loading="lazy" tabIndex={-1} scrolling="no" onLoad={() => setLoaded(true)} className={cn('tpl-frame transition-opacity duration-500', loaded ? 'opacity-100' : 'opacity-0')} />
    </div>
  );
}

export function Templates() {
  const [rows, setRows] = useState(null);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('all');
  const load = () => api.get('/admin/templates').then(({ data }) => setRows(data.data));
  useEffect(() => { load(); }, []);
  const toggle = async (t, v) => { setRows((r) => r.map((x) => (x.id === t.id ? { ...x, status: v } : x))); await run(api.patch(`/admin/templates/${t.id}`, { status: v }), v ? 'Template enabled' : 'Template disabled').catch(load); };
  const shown = (rows || []).filter((t) => (!q || `${t.name} ${t.profession}`.toLowerCase().includes(q.toLowerCase())) && (filter === 'all' || (filter === 'on' ? t.status : !t.status)));
  return (
    <>
      <PageHeader title="vCard Templates" description="Every template is fully customisable by users: colours, fonts and sections.">
        <Segmented id="tf" value={filter} onChange={setFilter} options={[{ value: 'all', label: 'All' }, { value: 'on', label: 'Enabled' }, { value: 'off', label: 'Disabled' }]} />
        <SearchInput value={q} onChange={setQ} placeholder="Search profession..." />
      </PageHeader>
      {!rows ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-96 rounded-3xl" />)}</div>
      ) : !shown.length ? <Card><EmptyState icon={LayoutTemplate} title="No templates match" /></Card> : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {shown.map((t, i) => (
            <motion.div key={t.id} layout initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.04, 0.4) }}>
              <Card hover className={cn('group overflow-hidden', !t.status && 'opacity-60')}>
                <div className="relative">
                  <Preview src={`/t/preview/${t.slug}`} title={t.name} />
                  <a href={`/t/preview/${t.slug}`} target="_blank" rel="noreferrer" className="absolute inset-0 grid place-items-center bg-zinc-950/0 opacity-0 transition duration-300 group-hover:bg-zinc-950/40 group-hover:opacity-100">
                    <span className="flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-medium text-zinc-900 shadow-lg"><ExternalLink className="size-4" />Open preview</span>
                  </a>
                  <Badge tone="primary" className="absolute top-3 left-3 shadow">{t.vcards_count} in use</Badge>
                </div>
                <div className="flex items-center justify-between gap-3 p-4">
                  <div className="min-w-0"><p className="truncate font-display font-semibold">{t.name}</p><p className="truncate text-xs text-muted-foreground">{t.profession}</p></div>
                  <Switch checked={t.status} onChange={(v) => toggle(t, v)} />
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </>
  );
}

export function Vcards() {
  const list = useList('/admin/vcards');
  const { settings } = useAuth();
  const [templates, setTemplates] = useState([]);
  useEffect(() => { api.get('/admin/lookups').then(({ data }) => setTemplates(data.templates)); }, []);
  const url = (v) => `${settings.app_url}/${v.url_alias}`;
  const copy = async (v) => { try { await navigator.clipboard.writeText(url(v)); toast.success('Link copied'); } catch { toast.info(url(v)); } };
  const patch = async (v, data, msg) => { Object.assign(v, data); await run(api.patch(`/admin/vcards/${v.id}`, data), msg).catch(() => {}); list.reload(); };
  const remove = async (v) => { if (await confirm({ title: `Delete ${v.name}?`, description: 'The public link will stop working immediately.' })) { await run(api.delete(`/admin/vcards/${v.id}`)).catch(() => {}); list.reload(); } };
  const [selected, setSelected] = useState([]);
  const [cloning, setCloning] = useState(null);
  const [cloneTo, setCloneTo] = useState('');
  const [users, setUsers] = useState([]);
  const [busy, setBusy] = useState(false);
  const removeMany = async () => {
    if (!(await confirm({ title: `Delete ${selected.length} vCards?`, description: 'Their public links stop working immediately.' }))) return;
    await run(api.post('/admin/vcards/bulk-delete', { ids: selected })).catch(() => {}); setSelected([]); list.reload();
  };
  const openClone = (v) => { setCloning(v); setCloneTo(v.user?.id || ''); if (!users.length) api.get('/admin/users', { params: { per_page: 100 } }).then(({ data }) => setUsers(data.data.map((u) => ({ value: u.id, label: `${u.first_name} ${u.last_name} (${u.email})` })))); };
  const clone = async () => { setBusy(true); try { await run(api.post(`/admin/vcards/${cloning.id}/clone`, { user_id: cloneTo })); setCloning(null); list.reload(); } catch { /* toast */ } finally { setBusy(false); } };
  return (
    <>
      <PageHeader title="vCards" description="Every digital card created on the platform." />
      <TableCard title="All vCards" list={list} toolbar={<>
        {selected.length > 0 && <Button size="sm" variant="danger-soft" onClick={removeMany}><Trash2 />Delete {selected.length}</Button>}
        <FilterSelect value={list.params.template_id} onChange={(v) => list.set({ template_id: v })} placeholder="All templates" options={templates.map((t) => ({ value: t.id, label: t.name }))} />
        <FilterSelect value={list.params.status} onChange={(v) => list.set({ status: v })} placeholder="All statuses" options={[{ value: '1', label: 'Active' }, { value: '0', label: 'Inactive' }]} />
        <SearchInput value={list.params.search} onChange={(search) => list.set({ search })} placeholder="Search vCards..." />
      </>}>
        <DataTable loading={list.loading} rows={list.rows} selected={selected} onSelect={setSelected} empty={<EmptyState icon={IdCard} title="No vCards yet" />} columns={[
          {
            key: 'name', label: 'vCard', render: (v) => (
              <div className="flex items-center gap-3">
                {v.profile_image ? <img src={v.profile_image} alt="" className="size-10 rounded-xl object-cover" /> : <span className="grid size-10 place-items-center rounded-xl bg-primary-soft text-primary"><IdCard className="size-4.5" /></span>}
                <div><p className="flex items-center gap-1 font-medium">{v.name}{v.is_verified && <BadgeCheck className="size-4 text-primary" />}</p><a href={url(v)} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline">/{v.url_alias}</a></div>
              </div>
            ),
          },
          { key: 'owner', label: 'Owner', render: (v) => <UserCell user={v.user} /> },
          { key: 'tpl', label: 'Template', render: (v) => <Badge tone="outline">{v.template?.name}</Badge> },
          { key: 'views', label: 'Views', render: (v) => <span className="font-semibold">{v.views.toLocaleString()}</span> },
          { key: 'verified', label: 'Verified', render: (v) => <Switch size="sm" checked={v.is_verified} onChange={(x) => patch(v, { is_verified: x }, x ? 'Verified badge added' : 'Verified badge removed')} /> },
          { key: 'status', label: 'Active', render: (v) => <Switch size="sm" checked={v.status} onChange={(x) => patch(v, { status: x })} /> },
          { key: 'created', label: 'Created', render: (v) => <span className="text-muted-foreground">{fmtDate(v.created_at)}</span> },
          {
            key: '_a', label: '', className: 'text-right', render: (v) => (
              <Actions>
                <Action icon={Eye} label="Preview" href={url(v)} target="_blank" rel="noreferrer" />
                <Action icon={Copy} label="Copy preview URL" tone="info" onClick={() => copy(v)} />
                <Action icon={CopyPlus} label="Clone" tone="success" onClick={() => openClone(v)} />
                <Action icon={Trash2} label="Delete" tone="danger" onClick={() => remove(v)} />
              </Actions>
            ),
          },
        ]} />
      </TableCard>
      <Dialog open={!!cloning} onOpenChange={(o) => !o && setCloning(null)} size="sm" icon={CopyPlus} title={`Clone ${cloning?.name || ''}`} description="Creates a copy with all sections. Pick who should own the copy."
        footer={<><Button variant="outline" onClick={() => setCloning(null)}>Cancel</Button><Button onClick={clone} loading={busy}>Clone vCard</Button></>}>
        <Field label="Owner"><Select value={cloneTo} onChange={setCloneTo} options={users.length ? users : cloning?.user ? [{ value: cloning.user.id, label: `${cloning.user.first_name} ${cloning.user.last_name}` }] : []} /></Field>
      </Dialog>
    </>
  );
}
