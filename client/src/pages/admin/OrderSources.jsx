/* Admin: order sources = the websites orders come from. Each one syncs its products and keeps its own editable price list. */
import { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { Globe, Plus, Pencil, Trash2, RefreshCw, ListChecks, ClipboardPaste, ExternalLink, Lock, RotateCcw, Package, Save } from 'lucide-react';
import api from '@/lib/api';
import { cn } from '@/lib/cn';
import { PageHeader, Card, CardBody, Button, Field, Input, Textarea, Select, Switch, Badge, Dialog, EmptyState, Skeleton, SearchInput, useForm, run, confirm } from '@/components/ui';

const KINDS = [
  { value: 'airport_tag', label: 'Airport tag (luggage)' }, { value: 'contact_tag', label: 'Car contact tag (number hidden)' }, { value: 'blank_card', label: 'Blank NFC card / tag' }, { value: 'nfc_profile', label: 'NFC Business Card' }, { value: 'social_static', label: 'Social card: static link' }, { value: 'social_dynamic', label: 'Social card: dynamic link' },
  { value: 'social_profile', label: 'Social profile (all-in-one)' }, { value: 'printing', label: 'Printing only' }, { value: 'reprint', label: 'Card reprinting (metal / wood / PVC)' }, { value: 'digital', label: 'Digital profile' },
];
const DISCOUNTS = [{ value: 'fixed', label: 'Rs off' }, { value: 'percent', label: '% off' }];
const num = (v) => (v === '' || v === null || v === undefined ? 0 : Number(v));
const money = (v) => Number(v || 0).toLocaleString('en-US', { maximumFractionDigits: 2 });
const sellAt = (p) => {
  const price = num(p.price); const v = num(p.discount_value);
  return Math.max(0, p.discount_type === 'percent' ? price * (1 - Math.min(100, v) / 100) : p.discount_type === 'fixed' ? price - v : price);
};
const ago = (d) => (d ? new Date(d).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : 'never');

function PriceList({ source, onClose }) {
  const [rows, setRows] = useState(null);
  const [orig, setOrig] = useState({});
  const [q, setQ] = useState('');
  const [saving, setSaving] = useState(false);
  const load = () => api.get(`/admin/order-sources/${source.id}/products`).then(({ data }) => { setRows(data.data); setOrig(Object.fromEntries(data.data.map((p) => [p.id, JSON.stringify(p)]))); });
  useEffect(() => { load(); }, [source.id]); // eslint-disable-line
  const upd = (id, patch) => setRows((r) => r.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  const changed = useMemo(() => (rows || []).filter((p) => orig[p.id] !== JSON.stringify(p)), [rows, orig]);
  const shown = (rows || []).filter((p) => !q || `${p.name} ${p.sku || ''}`.toLowerCase().includes(q.toLowerCase()));
  const save = async () => {
    setSaving(true);
    try {
      await run(api.put(`/admin/order-sources/${source.id}/products`, { products: changed.map((p) => ({ id: p.id, price: p.price, discount_type: p.discount_type || '', discount_value: p.discount_value, sample_price: p.sample_price ?? '', product_kind: p.product_kind || '', no_wholesale_tiers: !!p.no_wholesale_tiers, status: p.status })) }));
      await load();
    } catch { /* toasted */ } finally { setSaving(false); }
  };
  const reset = async (p) => { await run(api.post(`/admin/nfc-cards/${p.id}/reset-price`)).catch(() => {}); load(); };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} size="xl" icon={ListChecks} title={`Price list: ${source.name}`} description="Website prices come from the sync. Your price, discount and sample price are yours: a sync never overwrites them."
      footer={<><span className="mr-auto text-sm text-muted-foreground">{changed.length ? `${changed.length} unsaved change${changed.length > 1 ? 's' : ''}` : 'All changes saved'}</span><Button variant="outline" onClick={onClose}>Close</Button><Button onClick={save} loading={saving} disabled={!changed.length}><Save />Save changes</Button></>}>
      <div className="mb-4 max-w-sm"><SearchInput value={q} onChange={setQ} placeholder="Search products..." /></div>
      {!rows ? <Skeleton className="h-64 rounded-2xl" /> : !shown.length ? <EmptyState icon={Package} title="No products" description="Sync the website or paste a list from the Order sources page." /> : (
        <div className="overflow-x-auto rounded-2xl border border-border">
          <table className="w-full min-w-[1080px] text-sm">
            <thead className="bg-muted/50 text-left text-xs font-medium text-muted-foreground">
              <tr><th className="px-3 py-2.5">Product</th><th className="px-3 py-2.5">Website price</th><th className="px-3 py-2.5">Your price</th><th className="px-3 py-2.5">Discount</th><th className="px-3 py-2.5">You sell at</th><th className="px-3 py-2.5">Sample price</th><th className="px-3 py-2.5">Order type</th><th className="px-3 py-2.5" title="Off = already a wholesale price: no quantity-tier discount">Wholesale tiers</th><th className="px-3 py-2.5">Active</th></tr>
            </thead>
            <tbody>
              {shown.map((p) => (
                <tr key={p.id} className={cn('border-t border-border align-middle', !p.status && 'opacity-55')}>
                  <td className="max-w-64 px-3 py-2">
                    <div className="flex items-center gap-2.5">
                      <span className="size-10 shrink-0 overflow-hidden rounded-lg bg-muted">{(p.front_image || p.images?.[0]) && <img src={p.front_image || p.images[0]} alt="" loading="lazy" className="size-full object-cover" />}</span>
                      <div className="min-w-0"><p className="truncate font-medium">{p.name}</p><p className="truncate text-xs text-muted-foreground">{p.sku || (p.variants?.length ? `${p.variants.length} options` : '')}{p.source_url && <a href={p.source_url} target="_blank" rel="noreferrer" className="ml-1 inline-flex text-primary" aria-label="Open on website"><ExternalLink className="size-3" /></a>}</p></div>
                    </div>
                  </td>
                  <td className="px-3 py-2 tabular-nums text-muted-foreground">{p.source_price === null ? '-' : money(p.source_price)}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1.5">
                      <Input className="h-9 w-28" type="number" min="0" step="0.01" value={p.price ?? ''} onChange={(e) => upd(p.id, { price: e.target.value })} aria-label={`Price of ${p.name}`} />
                      {p.price_locked && p.source_price !== null && <button type="button" onClick={() => reset(p)} className="cursor-pointer text-warning" title={`Edited by you. Click to go back to ${money(p.source_price)}`}><Lock className="size-3.5" /></button>}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1.5">
                      <Input className="h-9 w-20" type="number" min="0" step="0.01" placeholder="0" value={p.discount_value ?? ''} onChange={(e) => upd(p.id, { discount_value: e.target.value, discount_type: p.discount_type || 'fixed' })} aria-label={`Discount on ${p.name}`} />
                      <Select className="h-9 w-24" value={p.discount_type || 'fixed'} onChange={(x) => upd(p.id, { discount_type: x })} options={DISCOUNTS} />
                    </div>
                  </td>
                  <td className="px-3 py-2 font-semibold tabular-nums">{money(sellAt(p))}</td>
                  <td className="px-3 py-2"><Input className="h-9 w-28" type="number" min="0" step="0.01" placeholder="Auto" value={p.sample_price ?? ''} onChange={(e) => upd(p.id, { sample_price: e.target.value })} aria-label={`Sample price of ${p.name}`} /></td>
                  <td className="px-3 py-2"><Select className="h-9 w-48" value={p.product_kind} onChange={(x) => upd(p.id, { product_kind: x })} allowEmpty placeholder="Not set" options={KINDS} /></td>
                  <td className="px-3 py-2"><Switch size="sm" checked={!p.no_wholesale_tiers} onChange={(v) => upd(p.id, { no_wholesale_tiers: !v })} /></td>
                  <td className="px-3 py-2"><Switch size="sm" checked={!!p.status} onChange={(v) => upd(p.id, { status: v })} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-3 text-xs text-muted-foreground">Sample price empty = normal price plus the sample markup in Settings &gt; Shop &amp; delivery. Wholesale tiers are in the same place; switch tiers off for products that are already priced for wholesale.</p>
    </Dialog>
  );
}

export function OrderSources() {
  const [rows, setRows] = useState(null);
  const [counts, setCounts] = useState({});
  const [editing, setEditing] = useState(null); // {} = new
  const [prices, setPrices] = useState(null);
  const [pasting, setPasting] = useState(null);
  const [pasteText, setPasteText] = useState('');
  const [busy, setBusy] = useState(null);
  const form = useForm({ name: '', url: '', status: true });
  const [saving, setSaving] = useState(false);
  const load = async () => {
    const [{ data: a }, { data: b }] = await Promise.all([api.get('/admin/order-sources', { params: { all: 1 } }), api.get('/admin/order-sources/summary')]);
    setRows(a.data); setCounts(b.data);
  };
  useEffect(() => { load(); }, []);
  const openForm = (row) => { setEditing(row || {}); form.setErrors({}); form.setValues(row ? { name: row.name, url: row.url || '', status: !!row.status } : { name: '', url: '', status: true }); };
  const save = async (e) => {
    e?.preventDefault(); setSaving(true);
    try { await run(editing.id ? api.put(`/admin/order-sources/${editing.id}`, form.values) : api.post('/admin/order-sources', form.values)); setEditing(null); load(); } catch (ex) { form.setErrors(ex.errors || {}); } finally { setSaving(false); }
  };
  const remove = async (r) => { if (await confirm({ title: `Delete ${r.name}?`, description: 'Its synced products stay in Products.' })) { await run(api.delete(`/admin/order-sources/${r.id}`)).catch(() => {}); load(); } };
  const sync = async (r) => { setBusy(r.id); try { await run(api.post(`/admin/order-sources/${r.id}/sync`)); } catch { /* toasted */ } finally { setBusy(null); load(); } };
  const importList = async () => { setBusy(pasting.id); try { await run(api.post(`/admin/order-sources/${pasting.id}/import`, { text: pasteText })); setPasting(null); setPasteText(''); } catch { /* toasted */ } finally { setBusy(null); load(); } };
  return (
    <>
      <PageHeader title="Order sources" description="Your websites and other places orders come from. Sync a website to bring in its products and prices, then adjust prices and discounts here.">
        <Button onClick={() => openForm()}><Plus />Add source</Button>
      </PageHeader>
      {!rows ? <div className="grid gap-4 lg:grid-cols-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-44 rounded-3xl" />)}</div> : !rows.length ? (
        <Card><EmptyState icon={Globe} title="No order sources yet" description="Add each website you take orders from, then sync its products." action={<Button onClick={() => openForm()}><Plus />Add source</Button>} /></Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {rows.map((r, i) => (
            <motion.div key={r.id} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.04, 0.3) }}>
              <Card className={cn('h-full', !r.status && 'opacity-60')}>
                <CardBody className="flex h-full flex-col gap-4">
                  <div className="flex items-start gap-3">
                    <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-primary-soft text-primary"><Globe className="size-5" /></span>
                    <div className="min-w-0 flex-1">
                      <p className="font-display text-lg font-semibold">{r.name}</p>
                      {r.url ? <a href={r.url} target="_blank" rel="noreferrer" className="block truncate text-sm text-primary hover:underline">{r.url.replace(/^https?:\/\//, '')}</a> : <p className="text-sm text-muted-foreground">No website address</p>}
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {!r.status && <Badge tone="neutral">Inactive</Badge>}
                      {r.platform && <Badge tone="primary" className="capitalize">{r.platform}</Badge>}
                    </div>
                  </div>
                  <div className="rounded-2xl bg-muted/50 p-3 text-sm">
                    <p><b>{counts[r.id] || 0}</b> products <span className="text-muted-foreground">· last sync {ago(r.last_synced_at)}</span></p>
                    {r.sync_message && <p className="mt-0.5 text-xs text-muted-foreground">{r.sync_message}</p>}
                  </div>
                  <div className="mt-auto flex flex-wrap items-center gap-2">
                    <Button size="sm" onClick={() => sync(r)} loading={busy === r.id} disabled={!r.url}><RefreshCw />Sync products</Button>
                    <Button size="sm" variant="outline" onClick={() => setPrices(r)} disabled={!counts[r.id]}><ListChecks />Price list</Button>
                    <Button size="sm" variant="ghost" onClick={() => { setPasting(r); setPasteText(''); }}><ClipboardPaste />Paste list</Button>
                    <span className="flex-1" />
                    <Button size="icon-sm" variant="ghost" onClick={() => openForm(r)} aria-label="Edit"><Pencil /></Button>
                    <Button size="icon-sm" variant="danger-soft" onClick={() => remove(r)} aria-label="Delete"><Trash2 /></Button>
                  </div>
                </CardBody>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)} size="md" icon={Globe} title={editing?.id ? 'Edit order source' : 'New order source'}
        footer={<><Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button><Button onClick={save} loading={saving}>{editing?.id ? 'Save changes' : 'Add source'}</Button></>}>
        <form onSubmit={save} className="grid gap-4">
          <Field label="Name" required error={form.errors.name}><Input {...form.input('name')} placeholder="e.g. cardshop.pk, Daraz, Instagram, Walk-in" /></Field>
          <Field label="Website address" hint="Needed to sync products. WooCommerce and Shopify stores are supported." error={form.errors.url}><Input {...form.input('url')} type="url" placeholder="https://" /></Field>
          <label className="flex cursor-pointer items-center justify-between rounded-2xl border border-border p-4"><span className="text-sm font-medium">Active</span><Switch checked={!!form.values.status} onChange={(v) => form.set('status', v)} /></label>
          <button type="submit" className="hidden" />
        </form>
      </Dialog>

      <Dialog open={!!pasting} onOpenChange={(o) => !o && setPasting(null)} size="md" icon={ClipboardPaste} title={`Paste products for ${pasting?.name || ''}`} description="For sites without a product feed. One product per line: name, then price. Existing names are updated."
        footer={<><Button variant="outline" onClick={() => setPasting(null)}>Cancel</Button><Button onClick={importList} loading={busy === pasting?.id} disabled={!pasteText.trim()}>Save products</Button></>}>
        <Textarea rows={10} value={pasteText} onChange={(e) => setPasteText(e.target.value)} placeholder={'Blue NFC card, 1500\nGoogle review stand, 2200\nSocial profile card 1800'} />
      </Dialog>

      {prices && <PriceList source={prices} onClose={() => { setPrices(null); load(); }} />}
    </>
  );
}
