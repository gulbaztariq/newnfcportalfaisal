import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { motion } from 'motion/react';
import { Plus, Pencil, Trash2, Star, Package, Check, ArrowLeft, Users, IdCard, Clock, HardDrive, Eye, Download, Store, Receipt } from 'lucide-react';
import api from '@/lib/api';
import { cn } from '@/lib/cn';
import { money, label } from '@/lib/format';
import { PageHeader, Card, CardHeader, CardBody, Button, ButtonLink, Field, Input, Select, Switch, Badge, Segmented, Skeleton, EmptyState, Tip, useForm, run, confirm } from '@/components/ui';

import { FEATURE_LABELS } from '@/lib/features';

export { FEATURE_LABELS };

export default function Plans() {
  const [rows, setRows] = useState(null);
  const load = () => api.get('/admin/plans').then(({ data }) => setRows(data.data));
  useEffect(() => { load(); }, []);
  const makeDefault = async (p) => { await run(api.patch(`/admin/plans/${p.id}/default`)).catch(() => {}); load(); };
  const status = async (p, v) => { setRows((r) => r.map((x) => (x.id === p.id ? { ...x, status: v } : x))); await run(api.patch(`/admin/plans/${p.id}/status`, { status: v })).catch(load); };
  const remove = async (p) => { if (await confirm({ title: `Delete the ${p.name} plan?` })) { await run(api.delete(`/admin/plans/${p.id}`)).catch(() => {}); load(); } };
  return (
    <>
      <PageHeader title="Plans" description="Subscription plans, pricing and the features each plan unlocks.">
        <ButtonLink as={Link} to="/admin/plans/create"><Plus />New plan</ButtonLink>
      </PageHeader>
      {!rows ? <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-96 rounded-3xl" />)}</div> : !rows.length ? <Card><EmptyState icon={Package} title="No plans yet" /></Card> : (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {rows.map((p, i) => {
            const feats = Object.entries(FEATURE_LABELS).filter(([k]) => p.features?.[k]);
            return (
              <motion.div key={p.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}>
                <Card hover className={cn('relative flex h-full flex-col p-6', p.is_default && 'border-beam border-transparent', !p.status && 'opacity-60')}>
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2"><h3 className="font-display text-lg font-bold">{p.name}</h3>{p.is_default && <Badge tone="primary"><Star className="size-3 fill-current" />Default</Badge>}</div>
                      <p className="text-xs text-muted-foreground">{label(p.frequency)}</p>
                    </div>
                    <Switch size="sm" checked={p.status} disabled={p.is_default} onChange={(v) => status(p, v)} />
                  </div>
                  <p className="mt-5 font-display text-4xl font-extrabold tracking-tight">{money(p.price, p.currency)}</p>
                  {(Number(p.tax_rate) > 0 || p.custom_duration_days) && <p className="mt-1 text-xs text-muted-foreground">{[Number(p.tax_rate) > 0 && `+ ${p.tax_name || 'tax'} ${Number(p.tax_rate)}%`, p.custom_duration_days && `${p.custom_duration_days} days`].filter(Boolean).join(' · ')}</p>}
                  <div className="mt-5 grid grid-cols-2 gap-2 text-xs">
                    {[[IdCard, `${p.no_of_vcards} vCards`], [Clock, `${p.trial_days || 0}d trial`], [HardDrive, `${p.storage_limit} MB`], [Users, `${p.subscribers} active`]].map(([I, t]) => (
                      <span key={t} className="flex items-center gap-1.5 rounded-xl bg-muted px-2.5 py-2 text-muted-foreground"><I className="size-3.5" />{t}</span>
                    ))}
                  </div>
                  <ul className="mt-5 flex-1 space-y-2 text-sm">
                    {feats.slice(0, 6).map(([k, l]) => <li key={k} className="flex items-center gap-2"><Check className="size-4 text-success" />{l}</li>)}
                    {feats.length > 6 && <li className="text-xs text-muted-foreground">+{feats.length - 6} more features</li>}
                    <li className="flex items-center gap-2 text-muted-foreground"><Check className="size-4 text-success" />{p.templates.length} templates</li>
                  </ul>
                  <div className="mt-6 flex items-center gap-2 border-t border-border pt-4">
                    <ButtonLink as={Link} to={`/admin/plans/${p.id}/edit`} variant="soft" size="sm" className="flex-1"><Pencil />Edit</ButtonLink>
                    <Tip content="Download PDF"><a href={`/api/admin/plans/${p.id}/pdf`} className="grid size-8 place-items-center rounded-xl border border-border text-muted-foreground transition hover:border-primary hover:text-primary"><Download className="size-4" /></a></Tip>
                    {!p.is_default && <Tip content="Make default"><Button variant="outline" size="icon-sm" onClick={() => makeDefault(p)}><Star /></Button></Tip>}
                    {!p.is_default && <Tip content="Delete"><Button variant="danger-soft" size="icon-sm" onClick={() => remove(p)}><Trash2 /></Button></Tip>}
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}
    </>
  );
}

export function PlanForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [lookups, setLookups] = useState(null);
  const [saving, setSaving] = useState(false);
  const form = useForm({ name: '', currency_id: '', price: '', frequency: 'monthly', trial_days: 0, no_of_vcards: 1, storage_limit: 100, status: true, custom_select: false, features: {}, template_ids: [], tax_name: '', tax_rate: 0, no_of_visitors: 0, no_of_organization_users: 0, no_of_whatsapp_stores: 0, no_of_short_links: 0, custom_duration_days: '' });
  useEffect(() => {
    api.get('/admin/lookups').then(({ data }) => setLookups(data));
    if (id) api.get(`/admin/plans/${id}`).then(({ data }) => form.setValues({ ...data.data, tax_name: data.data.tax_name || '', custom_duration_days: data.data.custom_duration_days || '', template_ids: data.data.templates.map((t) => t.id) }));
  }, [id]); // eslint-disable-line
  if (!lookups) return <Skeleton className="h-[600px] rounded-3xl" />;
  const v = form.values;
  const toggleTpl = (tid) => form.set('template_ids', v.template_ids.includes(tid) ? v.template_ids.filter((x) => x !== tid) : [...v.template_ids, tid]);
  const save = async () => { setSaving(true); try { await run(id ? api.put(`/admin/plans/${id}`, v) : api.post('/admin/plans', v)); navigate('/admin/plans'); } catch (e) { form.setErrors(e.errors); } finally { setSaving(false); } };
  const allOn = Object.keys(FEATURE_LABELS).every((k) => v.features[k]);
  return (
    <>
      <Link to="/admin/plans" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" />All plans</Link>
      <PageHeader title={id ? `Edit ${v.name || 'plan'}` : 'New plan'} description="Set pricing, limits, features and the templates included.">
        <Button variant="outline" onClick={() => navigate('/admin/plans')}>Cancel</Button>
        <Button onClick={save} loading={saving}>Save plan</Button>
      </PageHeader>
      <div className="grid gap-6 xl:grid-cols-[1fr_1.1fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader icon={Package} title="Plan details" />
            <CardBody className="grid gap-4 sm:grid-cols-2">
              <Field label="Plan name" required error={form.errors.name} className="sm:col-span-2"><Input {...form.input('name')} placeholder="e.g. Professional" /></Field>
              <Field label="Billing" className="sm:col-span-2" error={form.errors.frequency}>
                <Segmented id="freq" value={v.frequency} onChange={(x) => form.set('frequency', x)} options={[{ value: 'monthly', label: 'Monthly' }, { value: 'yearly', label: 'Yearly' }, { value: 'unlimited', label: 'Lifetime' }]} />
              </Field>
              <Field label="Currency" required error={form.errors.currency_id}><Select value={v.currency_id} onChange={(x) => form.set('currency_id', x)} options={lookups.currencies.map((c) => ({ value: c.id, label: `${c.currency_code} (${c.currency_icon})` }))} invalid={!!form.errors.currency_id} /></Field>
              <Field label="Price" required error={form.errors.price}><Input {...form.input('price')} type="number" min="0" step="0.01" /></Field>
              <Field label="Number of vCards" required error={form.errors.no_of_vcards}><Input {...form.input('no_of_vcards')} type="number" min="1" /></Field>
              <Field label="Trial days" hint="0 = no trial"><Input {...form.input('trial_days')} type="number" min="0" /></Field>
              <Field label="Storage limit (MB)"><Input {...form.input('storage_limit')} type="number" min="1" /></Field>
              <Field label="Custom duration (days)" hint="Optional, overrides the billing period (e.g. 730 = 2 years)"><Input {...form.input('custom_duration_days')} type="number" min="1" placeholder="-" /></Field>
              <Field label="Monthly vCard visitors" hint="0 = unlimited"><Input {...form.input('no_of_visitors')} type="number" min="0" /></Field>
              <Field label="WhatsApp stores" hint="Needs the WhatsApp store feature"><Input {...form.input('no_of_whatsapp_stores')} type="number" min="0" /></Field>
              <Field label="Organisation members" hint="Needs the organisation feature"><Input {...form.input('no_of_organization_users')} type="number" min="0" /></Field>
              <Field label="Dynamic links" hint="Extra QR / redirect links, 0 = unlimited (needs the feature)"><Input {...form.input('no_of_short_links')} type="number" min="0" /></Field>
              <Field label="Tax name" hint="e.g. VAT, GST"><Input {...form.input('tax_name')} placeholder="-" /></Field>
              <Field label="Tax rate (%)" error={form.errors.tax_rate}><Input {...form.input('tax_rate')} type="number" min="0" max="100" step="0.01" /></Field>
              <div className="space-y-3 sm:col-span-2">
                <label className="flex cursor-pointer items-center justify-between rounded-2xl border border-border p-4"><span className="text-sm font-medium">Active (visible to users)</span><Switch checked={v.status} onChange={(x) => form.set('status', x)} /></label>
                <label className="flex cursor-pointer items-center justify-between rounded-2xl border border-border p-4"><span className="text-sm font-medium">Allow switching between all plan templates</span><Switch checked={v.custom_select} onChange={(x) => form.set('custom_select', x)} /></label>
              </div>
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Features" description="What users on this plan can use"
              actions={<Button size="xs" variant="outline" onClick={() => form.set('features', Object.fromEntries(Object.keys(FEATURE_LABELS).map((k) => [k, !allOn])))}>{allOn ? 'Clear all' : 'Select all'}</Button>} />
            <CardBody className="grid gap-2 sm:grid-cols-2">
              {Object.entries(FEATURE_LABELS).map(([k, l]) => (
                <label key={k} className={cn('flex cursor-pointer items-center justify-between rounded-xl border px-3.5 py-2.5 text-sm transition', v.features[k] ? 'border-primary/40 bg-primary-soft/60' : 'border-border hover:bg-muted/50')}>
                  {l}<Switch size="sm" checked={!!v.features[k]} onChange={(x) => form.set('features', { ...v.features, [k]: x })} />
                </label>
              ))}
            </CardBody>
          </Card>
        </div>
        <Card className="h-fit xl:sticky xl:top-24">
          <CardHeader title={`Templates (${v.template_ids.length} selected)`} description="Templates available on this plan"
            actions={<><Button size="xs" variant="outline" onClick={() => form.set('template_ids', lookups.templates.map((t) => t.id))}>All</Button><Button size="xs" variant="ghost" onClick={() => form.set('template_ids', [])}>None</Button></>} />
          <CardBody>
            {form.errors.template_ids && <p className="mb-3 rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger">{form.errors.template_ids}</p>}
            <div className="grid max-h-[640px] gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
              {lookups.templates.map((t) => {
                const on = v.template_ids.includes(t.id);
                return (
                  <button type="button" key={t.id} onClick={() => toggleTpl(t.id)} className={cn('group flex cursor-pointer items-center gap-3 rounded-xl border p-3 text-left transition', on ? 'border-primary bg-primary-soft/60' : 'border-border hover:border-primary/40')}>
                    <span className={cn('grid size-5 shrink-0 place-items-center rounded-md border transition', on ? 'border-primary bg-primary text-white' : 'border-input')}>{on && <Check className="size-3.5" strokeWidth={3} />}</span>
                    <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{t.name}</span><span className="block truncate text-xs text-muted-foreground">{t.profession}</span></span>
                    <a href={`/t/preview/${t.slug}`} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="text-muted-foreground opacity-0 transition group-hover:opacity-100 hover:text-primary"><Eye className="size-4" /></a>
                  </button>
                );
              })}
            </div>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
