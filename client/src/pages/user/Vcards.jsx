import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { Sparkles, Plus, Pencil, Share2, QrCode, Copy, Trash2, Eye, ExternalLink, Lock, Check, ArrowLeft, ArrowRight, Search, MessageSquareText, IdCard, Loader2, CheckCircle2, XCircle, MoreHorizontal } from 'lucide-react';
import api, { toFormData } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/cn';
import { fmtDate, fmtDateTime } from '@/lib/format';
import { PageHeader, Card, Button, ButtonLink, Field, Input, Textarea, Badge, StatusBadge, EmptyState, Skeleton, Menu, MenuTrigger, MenuContent, MenuItem, MenuSeparator, TableCard, DataTable, Action, Actions, useList, useForm, run, confirm } from '@/components/ui';
import { Preview } from '../admin/VcardsAdmin';

export function VcardList() {
  const [rows, setRows] = useState(null);
  const { settings, user } = useAuth();
  const cardsLocked = user?.locked_fields?.includes('manage_cards'); // the organisation manages this user's cards
  const load = () => api.get('/user/vcards').then(({ data }) => setRows(data.data));
  useEffect(() => { load(); }, []);
  const url = (v) => `${settings.app_url}/${v.url_alias}`;
  const copy = async (v) => { try { await navigator.clipboard.writeText(url(v)); toast.success('Link copied to clipboard'); } catch { toast.info(url(v)); } };
  const share = (v) => (navigator.share ? navigator.share({ title: v.name, url: url(v) }).catch(() => {}) : copy(v));
  const remove = async (v) => { if (await confirm({ title: `Delete ${v.name}?`, description: 'The link, QR code and NFC cards pointing to it will stop working.' })) { await run(api.delete(`/user/vcards/${v.id}`)).catch(() => {}); load(); } };
  const dup = async (v) => { await run(api.post(`/user/vcards/${v.id}/duplicate`)).catch(() => {}); load(); };
  return (
    <>
      <PageHeader title="My vCards" description="Your digital business cards. Click one to edit it.">
        {cardsLocked ? <Badge tone="warning"><Lock className="size-3" />Cards managed by your organisation</Badge> : <ButtonLink as={Link} to="/user/vcards/create"><Plus />New vCard</ButtonLink>}
      </PageHeader>
      {!rows ? <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-[420px] rounded-3xl" />)}</div> : !rows.length ? (
        <Card><EmptyState icon={IdCard} title="Create your first digital card" description="Pick a template, add your details and start sharing in minutes." action={!cardsLocked && <ButtonLink as={Link} to="/user/vcards/create" size="lg"><Plus />Create vCard</ButtonLink>} /></Card>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {rows.map((v, i) => (
            <motion.div key={v.id} layout initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
              <Card hover className="group overflow-hidden">
                <Link to={`/user/vcards/${v.id}/edit`} className="relative block">
                  <Preview src={url(v)} title={v.name} />
                  <span className="absolute inset-0 grid place-items-center bg-zinc-950/0 opacity-0 transition duration-300 group-hover:bg-zinc-950/40 group-hover:opacity-100"><span className="flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-medium text-zinc-900 shadow-lg"><Pencil className="size-4" />Edit card</span></span>
                  <div className="absolute top-3 left-3 flex gap-1.5"><StatusBadge value={v.status ? 'active' : 'inactive'}>{v.status ? 'Live' : 'Hidden'}</StatusBadge>{v.has_password && <Badge tone="warning"><Lock className="size-3" />Locked</Badge>}</div>
                </Link>
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0"><p className="truncate font-display font-semibold">{v.name}</p><a href={url(v)} target="_blank" rel="noreferrer" className="truncate text-xs text-primary hover:underline">/{v.url_alias}</a></div>
                    <Menu>
                      <MenuTrigger asChild><button type="button" className="grid size-8 cursor-pointer place-items-center rounded-lg text-muted-foreground hover:bg-muted" aria-label="More"><MoreHorizontal className="size-4" /></button></MenuTrigger>
                      <MenuContent>
                        <MenuItem icon={ExternalLink} onSelect={() => window.open(url(v), '_blank')}>Open card</MenuItem>
                        <MenuItem icon={Copy} onSelect={() => copy(v)}>Copy link</MenuItem>
                        <MenuItem icon={QrCode} onSelect={() => { window.location.href = `/api/user/vcards/${v.id}/qrcode`; }}>Download QR code</MenuItem>
                        {!cardsLocked && <MenuItem icon={Plus} onSelect={() => dup(v)}>Duplicate</MenuItem>}
                        {!cardsLocked && <MenuSeparator />}
                        {!cardsLocked && <MenuItem icon={Trash2} danger onSelect={() => remove(v)}>Delete</MenuItem>}
                      </MenuContent>
                    </Menu>
                  </div>
                  <div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5"><Eye className="size-3.5" />{v.views.toLocaleString()} views</span>
                    <span>{v.template?.name}</span>
                    <button type="button" onClick={() => share(v)} className="flex cursor-pointer items-center gap-1 font-medium text-primary"><Share2 className="size-3.5" />Share</button>
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </>
  );
}

/** Template grid with live previews */
export function TemplatePicker({ templates, value, onChange }) {
  const [q, setQ] = useState('');
  const shown = templates.filter((t) => !q || `${t.name} ${t.profession}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <>
      <Input icon={Search} placeholder="Search by profession, e.g. doctor, lawyer, developer" value={q} onChange={(e) => setQ(e.target.value)} className="mb-5 max-w-md" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
        {shown.map((t) => {
          const on = value === t.id;
          const locked = t.allowed === false;
          return (
            <motion.button type="button" key={t.id} whileHover={{ y: locked ? 0 : -4 }} onClick={() => !locked && onChange(t.id)}
              className={cn('group relative overflow-hidden rounded-3xl border-2 bg-card text-left transition', on ? 'border-primary shadow-glow' : 'border-border hover:border-primary/40', locked ? 'cursor-not-allowed' : 'cursor-pointer')}>
              <Preview src={`/t/preview/${t.slug}`} title={t.name} scale={0.55} className={locked ? 'opacity-50 grayscale' : ''} />
              <AnimatePresence>{on && <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} className="absolute top-3 right-3 grid size-8 place-items-center rounded-full bg-primary text-white shadow-lg"><Check className="size-4" strokeWidth={3} /></motion.span>}</AnimatePresence>
              {locked && <span className="absolute top-3 right-3"><Badge tone="warning"><Lock className="size-3" />Upgrade</Badge></span>}
              <div className="p-3.5"><p className="font-display text-sm font-semibold">{t.name}</p><p className="text-xs text-muted-foreground">{t.profession}</p></div>
            </motion.button>
          );
        })}
      </div>
    </>
  );
}

export function VcardCreate() {
  const navigate = useNavigate();
  const { settings } = useAuth();
  const [templates, setTemplates] = useState(null);
  const [step, setStep] = useState(0);
  const [alias, setAlias] = useState(null);
  const [busy, setBusy] = useState(false);
  const touched = useRef(false);
  const form = useForm({ name: '', url_alias: '', occupation: '', description: '', template_id: null });
  const [draft, setDraft] = useState(null);
  const [aiBusy, setAiBusy] = useState(false);
  const aiDraft = async () => {
    if (!form.values.occupation) { toast.info('Tell the AI your occupation first'); return; }
    setAiBusy(true);
    try {
      const { data } = await api.post('/user/ai/vcard-draft', { name: form.values.name, profession: form.values.occupation, brief: form.values.description });
      setDraft(data.data); form.set('occupation', data.data.occupation || form.values.occupation); form.set('description', data.data.description || form.values.description);
      toast.success('AI drafted your bio, services and colours');
    } catch (e) { toast.error(e.message); } finally { setAiBusy(false); }
  };
  useEffect(() => { api.get('/user/vcards/templates').then(({ data }) => { setTemplates(data.data); const first = data.data.find((t) => t.allowed); if (first) form.set('template_id', first.id); }); }, []); // eslint-disable-line
  useEffect(() => { if (!touched.current) form.set('url_alias', form.values.name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60)); }, [form.values.name]); // eslint-disable-line
  useEffect(() => {
    const a = form.values.url_alias;
    if (!a) { setAlias(null); return undefined; }
    setAlias('checking');
    const t = setTimeout(() => api.get('/user/vcards/check-alias', { params: { alias: a } }).then(({ data }) => setAlias(data.available)), 350);
    return () => clearTimeout(t);
  }, [form.values.url_alias]);
  const save = async () => {
    setBusy(true);
    try {
      const d = await run(api.post('/user/vcards', form.values));
      if (draft) {
        if (draft.theme && Object.keys(draft.theme).length) await api.put(`/user/vcards/${d.data.id}`, toFormData({ theme: { ...(d.data.theme || {}), ...draft.theme } })).catch(() => {});
        for (const sv of (draft.services || []).slice(0, 4)) await api.post(`/user/vcards/${d.data.id}/services`, toFormData(sv)).catch(() => {});
      }
      navigate(`/user/vcards/${d.data.id}/edit`);
    } catch (e) { form.setErrors(e.errors); if (e.errors?.name || e.errors?.url_alias) setStep(0); } finally { setBusy(false); }
  };
  const steps = ['Basics', 'Template'];
  const canNext = form.values.name && form.values.url_alias && alias === true;
  return (
    <>
      <Link to="/user/vcards" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" />My vCards</Link>
      <PageHeader title="Create a new vCard" description="Two quick steps. You can change everything later." />
      <div className="mb-8 flex items-center gap-3">
        {steps.map((s, i) => (
          <div key={s} className="flex items-center gap-3">
            <span className={cn('grid size-8 place-items-center rounded-full text-sm font-semibold transition', i <= step ? 'bg-primary text-white' : 'bg-muted text-muted-foreground')}>{i < step ? <Check className="size-4" /> : i + 1}</span>
            <span className={cn('text-sm font-medium', i <= step ? 'text-foreground' : 'text-muted-foreground')}>{s}</span>
            {i < steps.length - 1 && <span className="relative h-0.5 w-16 overflow-hidden rounded bg-muted"><motion.span animate={{ width: step > i ? '100%' : '0%' }} className="absolute inset-y-0 left-0 bg-primary" /></span>}
          </div>
        ))}
      </div>
      <AnimatePresence mode="wait">
        {step === 0 ? (
          <motion.div key="s0" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <Card className="max-w-2xl p-6">
              <div className="grid gap-5">
                <Field label="Card name" required error={form.errors.name} hint="For you only, e.g. 'Work card'"><Input {...form.input('name')} autoFocus placeholder="My business card" /></Field>
                <Field label="Your card link" required error={form.errors.url_alias || (alias === false ? 'This link is already taken' : null)}>
                  <Input prefix={`${(settings.app_url || '').replace(/^https?:\/\//, '')}/`} value={form.values.url_alias} onChange={(e) => { touched.current = true; form.set('url_alias', e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, '')); }}
                    suffix={<span className="px-2">{alias === 'checking' ? <Loader2 className="size-4 animate-spin text-muted-foreground" /> : alias === true ? <CheckCircle2 className="size-4 text-success" /> : alias === false ? <XCircle className="size-4 text-danger" /> : null}</span>} />
                </Field>
                <Field label="Occupation"><Input {...form.input('occupation')} placeholder="e.g. Product Designer" /></Field>
                <Field label="Short bio"><Textarea {...form.input('description')} rows={3} placeholder="A sentence or two about you" /></Field>
                {settings.ai_enable === '1' && (
                  <div className="relative overflow-hidden rounded-2xl border border-primary/30 bg-linear-to-br from-violet-500/10 to-fuchsia-500/10 p-4">
                    <p className="flex items-center gap-2 font-medium"><Sparkles className="size-4 text-primary" />Let AI design your card</p>
                    <p className="mt-1 text-sm text-muted-foreground">Fill in your occupation (and a few words about you) - AI writes your bio, suggests services and picks colours.</p>
                    <Button className="mt-3" size="sm" onClick={aiDraft} loading={aiBusy}><Sparkles />{draft ? 'Regenerate' : 'Generate with AI'}</Button>
                    {draft && <div className="mt-3 flex flex-wrap items-center gap-2 text-xs"><span className="text-muted-foreground">Palette:</span>{Object.values(draft.theme || {}).map((c) => <span key={c} className="size-5 rounded-full border border-white shadow" style={{ background: c }} />)}<span className="text-muted-foreground">· {draft.services?.length || 0} services</span></div>}
                  </div>
                )}
              </div>
              <div className="mt-6 flex justify-end"><Button onClick={() => setStep(1)} disabled={!canNext}>Choose template <ArrowRight /></Button></div>
            </Card>
          </motion.div>
        ) : (
          <motion.div key="s1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            {form.errors.template_id && <p className="mb-4 rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger">{form.errors.template_id}</p>}
            {!templates ? <Skeleton className="h-96 rounded-3xl" /> : <TemplatePicker templates={templates} value={form.values.template_id} onChange={(id) => form.set('template_id', id)} />}
            <div className="glass sticky bottom-4 mt-6 flex items-center justify-between rounded-2xl border border-border p-3 shadow-lift">
              <Button variant="ghost" onClick={() => setStep(0)}><ArrowLeft />Back</Button>
              <Button onClick={save} loading={busy} disabled={!form.values.template_id} size="lg">Create vCard <ArrowRight /></Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

export function UserEnquiries() {
  const list = useList('/user/enquiries');
  const remove = async (e) => { if (await confirm({ title: 'Delete this enquiry?' })) { await run(api.delete(`/user/enquiries/${e.id}`)).catch(() => {}); list.reload(); } };
  return (
    <>
      <PageHeader title="Enquiries" description="Messages visitors sent from your cards." />
      <TableCard title="Inbox" list={list}>
        <DataTable loading={list.loading} rows={list.rows} empty={<EmptyState icon={MessageSquareText} title="No enquiries yet" description="Enable the enquiry form on your card to receive messages." />} columns={[
          { key: 'from', label: 'From', render: (e) => <div className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-full bg-primary-soft font-semibold text-primary">{e.name[0]}</span><div><p className="font-medium">{e.name}</p><p className="text-xs text-muted-foreground">{e.email || e.phone}</p></div></div> },
          { key: 'card', label: 'vCard', render: (e) => <Badge tone="outline">{e.vcard?.name}</Badge> },
          { key: 'msg', label: 'Message', className: 'whitespace-normal', render: (e) => <p className="max-w-md text-sm text-muted-foreground">{e.message}</p> },
          { key: 'date', label: 'Received', render: (e) => <span className="text-xs text-muted-foreground">{fmtDateTime(e.created_at)}</span> },
          { key: '_a', label: '', className: 'text-right', render: (e) => <Actions>{e.email && <Action icon={ExternalLink} label="Reply" href={`mailto:${e.email}`} />}<Action icon={Trash2} label="Delete" tone="danger" onClick={() => remove(e)} /></Actions> },
        ]} />
      </TableCard>
    </>
  );
}

export { fmtDate };
