import { lazy, Suspense, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { motion } from 'motion/react';
import { toast } from 'sonner';
import {
  Store, Plus, ExternalLink, Pencil, Trash2, Copy, ShoppingBag, ArrowLeft, Save, Palette, Package, Truck, FileText, BarChart3, Tag, X, Eye, Check, Receipt, Download, MessageCircle,
} from 'lucide-react';
import api, { toFormData } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/cn';
import { fmtDateTime } from '@/lib/format';
import {
  PageHeader, Card, CardHeader, CardBody, Button, ButtonLink, Field, Input, Textarea, Select, Switch, SwitchRow, ImageUpload, ColorInput, Dialog, EmptyState, Skeleton, Badge, StatusBadge, StatCard,
  TableCard, DataTable, Action, Actions, FilterSelect, SearchInput, Menu, MenuTrigger, MenuContent, MenuItem, MenuSeparator, useList, useForm, run, confirm,
} from '@/components/ui';
import { Bars } from '@/components/ui/charts';
import AiButton from '@/components/AiButton';

const RichText = lazy(() => import('@/components/ui/RichText'));
const Editor = (p) => <Suspense fallback={<Skeleton className="h-40 rounded-xl" />}><RichText {...p} /></Suspense>;
const TEMPLATE_META = {
  modern: ['Modern', '#6d5dfc'], boutique: ['Boutique', '#be185d'], grocery: ['Grocery', '#16a34a'], restaurant: ['Restaurant', '#ea580c'], jewellery: ['Jewellery', '#b08d57'],
  electronics: ['Electronics', '#0ea5e9'], fashion: ['Fashion', '#111827'], beauty: ['Beauty', '#db2777'], 'home-decor': ['Home decor', '#92400e'], sports: ['Sports', '#dc2626'],
};
const DAYS = [['mon', 'Monday'], ['tue', 'Tuesday'], ['wed', 'Wednesday'], ['thu', 'Thursday'], ['fri', 'Friday'], ['sat', 'Saturday'], ['sun', 'Sunday']];

export function StoresList() {
  const [rows, setRows] = useState(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const { settings } = useAuth();
  const form = useForm({ name: '', url_alias: '', whatsapp_number: '', region_code: '', template: 'modern' });
  const load = () => api.get('/user/stores').then(({ data }) => setRows(data.data)).catch(() => setRows([]));
  useEffect(() => { load(); }, []);
  const create = async () => {
    setBusy(true);
    try { const d = await run(api.post('/user/stores', toFormData(form.values))); navigate(`/user/stores/${d.data.id}`); } catch (e) { form.setErrors(e.errors || {}); } finally { setBusy(false); }
  };
  const dup = async (s) => { await run(api.post(`/user/stores/${s.id}/duplicate`)).catch(() => {}); load(); };
  const remove = async (s) => { if (await confirm({ title: `Delete ${s.name}?`, description: 'Products, categories and orders are deleted too.' })) { await run(api.delete(`/user/stores/${s.id}`)).catch(() => {}); load(); } };
  const link = (s) => `${settings.app_url}/s/${s.url_alias}`;
  return (
    <>
      <PageHeader title="WhatsApp Stores" description="Catalogue shops where customers fill a cart and send the order to your WhatsApp.">
        <ButtonLink as={Link} to="/user/store-orders" variant="outline"><Receipt />Orders</ButtonLink>
        <Button onClick={() => setOpen(true)}><Plus />New store</Button>
      </PageHeader>
      {!rows ? <Skeleton className="h-64 rounded-3xl" /> : !rows.length ? (
        <Card><EmptyState icon={Store} title="Open your first WhatsApp store" description="Add products, share the link and receive orders straight in WhatsApp - no payment setup needed." action={<Button onClick={() => setOpen(true)}><Plus />Create store</Button>} /></Card>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((s, i) => {
            const [tl, col] = TEMPLATE_META[s.template] || TEMPLATE_META.modern;
            return (
              <motion.div key={s.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
                <Card hover className="group overflow-hidden">
                  <div className="relative h-32 bg-cover bg-center" style={{ backgroundColor: s.theme?.primary || col, backgroundImage: s.cover_image ? `url(${s.cover_image})` : undefined }}>
                    <div className="absolute inset-0 bg-linear-to-t from-black/50 to-transparent" />
                    <div className="absolute bottom-3 left-4 flex items-center gap-3">
                      {s.logo ? <img src={s.logo} alt="" className="size-12 rounded-2xl border-2 border-white object-cover" /> : <span className="grid size-12 place-items-center rounded-2xl border-2 border-white bg-white/20 text-white backdrop-blur"><Store className="size-5" /></span>}
                      <div className="text-white"><p className="font-display font-semibold">{s.name}</p><p className="text-xs text-white/80">/s/{s.url_alias}</p></div>
                    </div>
                    <div className="absolute top-3 right-3 flex gap-1.5"><Badge className="bg-white/90 text-zinc-900">{tl}</Badge>{!s.status && <Badge tone="danger">Offline</Badge>}</div>
                  </div>
                  <div className="grid grid-cols-2 divide-x divide-border border-b border-border text-center">
                    <div className="py-3"><p className="font-display text-xl font-bold">{s.orders_count}</p><p className="text-xs text-muted-foreground">Orders</p></div>
                    <div className="py-3"><p className="font-display text-xl font-bold">{s.views}</p><p className="text-xs text-muted-foreground">Visits</p></div>
                  </div>
                  <div className="flex items-center gap-2 p-3">
                    <ButtonLink as={Link} to={`/user/stores/${s.id}`} size="sm" className="flex-1"><Pencil />Manage</ButtonLink>
                    <ButtonLink href={link(s)} target="_blank" rel="noreferrer" size="sm" variant="outline"><ExternalLink /></ButtonLink>
                    <Menu>
                      <MenuTrigger asChild><Button variant="ghost" size="icon-sm" aria-label="More">⋯</Button></MenuTrigger>
                      <MenuContent>
                        <MenuItem icon={Copy} onSelect={() => { navigator.clipboard?.writeText(link(s)); toast.success('Store link copied'); }}>Copy link</MenuItem>
                        <MenuItem icon={Plus} onSelect={() => dup(s)}>Duplicate</MenuItem>
                        <MenuSeparator />
                        <MenuItem icon={Trash2} danger onSelect={() => remove(s)}>Delete</MenuItem>
                      </MenuContent>
                    </Menu>
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}
      <Dialog open={open} onOpenChange={setOpen} icon={Store} title="New WhatsApp store" footer={<><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={create} loading={busy}>Create store</Button></>}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Store name" required error={form.errors.name} className="sm:col-span-2"><Input {...form.input('name')} onChange={(e) => { form.set('name', e.target.value); if (!form.values._touched) form.set('url_alias', e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60)); }} /></Field>
          <Field label="Store link" required error={form.errors.url_alias} className="sm:col-span-2"><Input prefix="/s/" value={form.values.url_alias} onChange={(e) => { form.set('_touched', true); form.set('url_alias', e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, '')); }} /></Field>
          <Field label="Country code"><Input value={form.values.region_code} onChange={(e) => form.set('region_code', e.target.value.replace(/\D/g, ''))} placeholder="92" /></Field>
          <Field label="WhatsApp number" required error={form.errors.whatsapp_number}><Input {...form.input('whatsapp_number')} placeholder="3001234567" /></Field>
          <Field label="Template" className="sm:col-span-2"><div className="grid grid-cols-5 gap-2">{Object.entries(TEMPLATE_META).map(([k, [l, c]]) => <button key={k} type="button" onClick={() => form.set('template', k)} className={cn('cursor-pointer rounded-xl border-2 p-2 text-center text-[11px] font-medium transition', form.values.template === k ? 'border-primary' : 'border-border hover:border-primary/40')}><span className="mx-auto mb-1 block size-6 rounded-full" style={{ background: c }} />{l}</button>)}</div></Field>
        </div>
      </Dialog>
    </>
  );
}

/* ------------------------------------------------------------- editor */
const TABS = [['details', Store, 'Details'], ['design', Palette, 'Design'], ['catalogue', Package, 'Catalogue'], ['delivery', Truck, 'Delivery & hours'], ['policies', FileText, 'Policies & SEO'], ['stats', BarChart3, 'Analytics']];

export function StoreEditor() {
  const { sid } = useParams();
  const { settings } = useAuth();
  const [st, setSt] = useState(null);
  const [tab, setTab] = useState('details');
  const [saving, setSaving] = useState(false);
  const form = useForm({});
  const load = () => api.get(`/user/stores/${sid}`).then(({ data }) => { setSt(data.data); form.setValues({ ...data.data, theme: data.data.theme || {}, business_hours: data.data.business_hours || {} }); });
  useEffect(() => { load(); }, [sid]); // eslint-disable-line
  if (!st) return <Skeleton className="h-[600px] rounded-3xl" />;
  const v = form.values;
  const save = async () => {
    setSaving(true);
    const keys = ['name', 'url_alias', 'slogan', 'whatsapp_number', 'region_code', 'email', 'address', 'template', 'announcement', 'currency_code', 'currency_icon', 'delivery_charge', 'delivery_enabled', 'takeaway_enabled', 'status', 'business_directory', 'terms', 'privacy', 'refund_policy', 'shipping_policy', 'site_title', 'meta_description', 'theme', 'business_hours', 'youtube_banner'];
    const payload = Object.fromEntries(keys.map((k) => [k, typeof v[k] === 'boolean' ? (v[k] ? '1' : '0') : v[k] ?? '']));
    for (const f of ['logo', 'cover_image']) if (v[f] instanceof File) payload[f] = v[f];
    try { const d = await run(api.put(`/user/stores/${sid}`, toFormData(payload)), 'Store saved'); setSt((x) => ({ ...x, ...d.data })); } catch (e) { form.setErrors(e.errors || {}); } finally { setSaving(false); }
  };
  const link = `${settings.app_url}/s/${st.url_alias}`;
  const setIn = (k, key, val) => form.set(k, { ...v[k], [key]: val });
  return (
    <>
      <Link to="/user/stores" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" />All stores</Link>
      <PageHeader title={st.name} description={<a href={link} target="_blank" rel="noreferrer" className="text-primary hover:underline">{link.replace(/^https?:\/\//, '')}</a>}>
        <ButtonLink href={link} target="_blank" rel="noreferrer" variant="outline"><Eye />Preview</ButtonLink>
        {tab !== 'catalogue' && tab !== 'stats' && <Button onClick={save} loading={saving}><Save />Save</Button>}
      </PageHeader>
      <div className="grid gap-6 xl:grid-cols-[220px_1fr]">
        <Card className="h-fit p-2 xl:sticky xl:top-24">
          <div className="flex gap-1 overflow-x-auto xl:flex-col">
            {TABS.map(([k, I, l]) => (
              <button key={k} type="button" onClick={() => setTab(k)} className={cn('relative flex shrink-0 cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition', tab === k ? 'text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground')}>
                {tab === k && <motion.span layoutId="st-tab" className="absolute inset-0 rounded-xl bg-primary-soft" />}<I className="relative size-4" /><span className="relative">{l}</span>
              </button>
            ))}
          </div>
        </Card>
        <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="min-w-0 space-y-6">
          {tab === 'details' && (
            <Card><CardHeader icon={Store} title="Store details" /><CardBody className="grid gap-4 sm:grid-cols-2">
              <Field label="Logo"><ImageUpload value={v.logo} onChange={(x) => form.set('logo', x)} /></Field>
              <Field label="Cover image"><ImageUpload value={v.cover_image} onChange={(x) => form.set('cover_image', x)} aspect="aspect-video" /></Field>
              <Field label="Store name" required error={form.errors.name}><Input {...form.input('name')} /></Field>
              <Field label="Store link" error={form.errors.url_alias}><Input prefix="/s/" value={v.url_alias || ''} onChange={(e) => form.set('url_alias', e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, ''))} /></Field>
              <Field label={<span className="flex w-full items-center justify-between">Slogan <AiButton kind="store" title={v.name} label="AI tagline" onResult={(t) => form.set('slogan', t.split('. ')[0].slice(0, 200))} /></span>} className="sm:col-span-2"><Input {...form.input('slogan')} /></Field>
              <Field label="Country code"><Input value={v.region_code || ''} onChange={(e) => form.set('region_code', e.target.value.replace(/\D/g, ''))} /></Field>
              <Field label="WhatsApp number" required error={form.errors.whatsapp_number} hint="Orders are sent here"><Input {...form.input('whatsapp_number')} /></Field>
              <Field label="E-mail"><Input {...form.input('email')} type="email" /></Field>
              <Field label="Address"><Input {...form.input('address')} /></Field>
              <Field label="Announcement bar" className="sm:col-span-2" hint="Shown at the very top, e.g. Free delivery this weekend!"><Input {...form.input('announcement')} maxLength={500} /></Field>
              <div className="grid gap-3 sm:col-span-2 sm:grid-cols-2">
                <SwitchRow id="st-on" title="Store online" checked={v.status} onChange={(x) => form.set('status', x)} />
                {settings.business_directory_enable !== '0' && <SwitchRow id="st-dir" title="List in business directory" checked={v.business_directory} onChange={(x) => form.set('business_directory', x)} />}
              </div>
            </CardBody></Card>
          )}
          {tab === 'design' && (
            <>
              <Card><CardHeader icon={Palette} title="Template" /><CardBody className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                {Object.entries(TEMPLATE_META).map(([k, [l, c]]) => (
                  <button key={k} type="button" onClick={() => form.set('template', k)} className={cn('cursor-pointer rounded-2xl border-2 p-3 text-center transition', v.template === k ? 'border-primary shadow-glow' : 'border-border hover:border-primary/40')}>
                    <div className="mb-2 overflow-hidden rounded-xl border border-border"><div className="h-6" style={{ background: c }} /><div className="grid grid-cols-2 gap-1 bg-white p-1.5">{[0, 1, 2, 3].map((i) => <div key={i} className="h-5 rounded" style={{ background: `${c}22` }} />)}</div></div>
                    <span className="text-xs font-medium">{l}</span>
                  </button>
                ))}
              </CardBody></Card>
              <Card><CardHeader title="Colours" description="Override the template colours" /><CardBody className="grid gap-4 sm:grid-cols-3">
                <ColorInput label="Primary" value={v.theme.primary || TEMPLATE_META[v.template]?.[1]} onChange={(x) => setIn('theme', 'primary', x)} />
                <ColorInput label="Background" value={v.theme.background || '#f5f5ff'} onChange={(x) => setIn('theme', 'background', x)} />
                <ColorInput label="Text" value={v.theme.text || '#16162a'} onChange={(x) => setIn('theme', 'text', x)} />
              </CardBody></Card>
              <Card><CardHeader title="YouTube banner" description="Plays muted as the cover (optional)" /><CardBody><Input value={v.youtube_banner || ''} onChange={(e) => form.set('youtube_banner', e.target.value)} placeholder="https://youtube.com/watch?v=..." /></CardBody></Card>
            </>
          )}
          {tab === 'catalogue' && <Catalogue st={st} reload={load} />}
          {tab === 'delivery' && (
            <>
              <Card><CardHeader icon={Truck} title="Order options" /><CardBody className="space-y-3">
                <SwitchRow id="del" title="Delivery" description="Customers enter an address" checked={v.delivery_enabled} onChange={(x) => form.set('delivery_enabled', x)} />
                <SwitchRow id="take" title="Take-away / pick-up" checked={v.takeaway_enabled} onChange={(x) => form.set('takeaway_enabled', x)} />
                <div className="grid gap-4 sm:grid-cols-3">
                  <Field label="Delivery charge"><Input {...form.input('delivery_charge')} type="number" min="0" step="0.01" /></Field>
                  <Field label="Currency symbol"><Input {...form.input('currency_icon')} maxLength={10} /></Field>
                  <Field label="Currency code"><Input {...form.input('currency_code')} maxLength={10} /></Field>
                </div>
              </CardBody></Card>
              <Card><CardHeader title="Business hours" /><CardBody className="space-y-2">
                {DAYS.map(([d, l]) => {
                  const h = v.business_hours[d] || { open: false, from: '09:00', to: '21:00' };
                  const upd = (p) => setIn('business_hours', d, { ...h, ...p });
                  return (
                    <div key={d} className="flex flex-wrap items-center gap-3 rounded-2xl border border-border p-3">
                      <Switch checked={!!h.open} onChange={(x) => upd({ open: x })} /><span className="w-28 text-sm font-medium">{l}</span>
                      {h.open ? <div className="flex items-center gap-2"><Input type="time" className="w-32" value={h.from} onChange={(e) => upd({ from: e.target.value })} /><span className="text-muted-foreground">to</span><Input type="time" className="w-32" value={h.to} onChange={(e) => upd({ to: e.target.value })} /></div> : <Badge>Closed</Badge>}
                    </div>
                  );
                })}
              </CardBody></Card>
            </>
          )}
          {tab === 'policies' && (
            <>
              {[['terms', 'Terms & Conditions'], ['privacy', 'Privacy Policy'], ['refund_policy', 'Refund & Cancellation'], ['shipping_policy', 'Shipping & Delivery']].map(([k, l]) => (
                <Card key={k}><CardHeader icon={FileText} title={l} /><CardBody><Editor value={v[k] || ''} onChange={(x) => form.set(k, x)} height={140} /></CardBody></Card>
              ))}
              <Card><CardHeader title="SEO" /><CardBody className="grid gap-4"><Field label="Page title"><Input {...form.input('site_title')} /></Field><Field label="Meta description"><Textarea {...form.input('meta_description')} rows={2} /></Field></CardBody></Card>
            </>
          )}
          {tab === 'stats' && <StoreStats sid={sid} />}
        </motion.div>
      </div>
    </>
  );
}

function Catalogue({ st, reload }) {
  const [catOpen, setCatOpen] = useState(false);
  const [prodOpen, setProdOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [files, setFiles] = useState([]);
  const [keep, setKeep] = useState([]);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState('');
  const cat = useForm({ name: '', sort: 0, image: null });
  const prod = useForm({ name: '', description: '', price: '', sale_price: '', stock: '', category_id: '', sort: 0, status: true });
  const openCat = (c) => { setEditing(c || null); cat.setValues(c ? { name: c.name, sort: c.sort, image: c.image } : { name: '', sort: st.categories.length, image: null }); setCatOpen(true); };
  const saveCat = async () => {
    setBusy(true); const p = { ...cat.values }; if (!(p.image instanceof File)) delete p.image;
    try { await run(editing ? api.put(`/user/stores/${st.id}/categories/${editing.id}`, toFormData(p)) : api.post(`/user/stores/${st.id}/categories`, toFormData(p))); setCatOpen(false); reload(); } catch (e) { cat.setErrors(e.errors || {}); } finally { setBusy(false); }
  };
  const delCat = async (c) => { if (await confirm({ title: `Delete category ${c.name}?`, description: 'Products stay, without a category.' })) { await run(api.delete(`/user/stores/${st.id}/categories/${c.id}`)).catch(() => {}); reload(); } };
  const openProd = (p) => {
    setEditing(p || null); setFiles([]); setKeep(p?.images || []); prod.setErrors({});
    prod.setValues(p ? { name: p.name, description: p.description || '', price: p.price, sale_price: p.sale_price ?? '', stock: p.stock ?? '', category_id: p.category_id ? String(p.category_id) : '', sort: p.sort, status: p.status } : { name: '', description: '', price: '', sale_price: '', stock: '', category_id: filter, sort: st.products.length, status: true });
    setProdOpen(true);
  };
  const saveProd = async () => {
    setBusy(true);
    const fd = toFormData({ ...prod.values, status: prod.values.status ? '1' : '0', keep_images: editing ? JSON.stringify(keep) : undefined });
    files.forEach((f) => fd.append('images', f));
    try { await run(editing ? api.put(`/user/stores/${st.id}/products/${editing.id}`, fd) : api.post(`/user/stores/${st.id}/products`, fd)); setProdOpen(false); reload(); } catch (e) { prod.setErrors(e.errors || {}); } finally { setBusy(false); }
  };
  const delProd = async (p) => { if (await confirm({ title: `Delete ${p.name}?` })) { await run(api.delete(`/user/stores/${st.id}/products/${p.id}`)).catch(() => {}); reload(); } };
  const cur = st.currency_icon || '$';
  const products = st.products.filter((p) => !filter || String(p.category_id) === filter);
  return (
    <>
      <Card>
        <CardHeader icon={Tag} title={`Categories (${st.categories.length})`} actions={<Button size="sm" variant="soft" onClick={() => openCat()}><Plus />Category</Button>} />
        <CardBody className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setFilter('')} className={cn('cursor-pointer rounded-full border px-4 py-1.5 text-sm font-medium transition', !filter ? 'border-primary bg-primary text-white' : 'border-border hover:bg-muted')}>All ({st.products.length})</button>
          {st.categories.map((c) => (
            <span key={c.id} className={cn('group inline-flex items-center gap-2 rounded-full border py-1 pr-1.5 pl-1 text-sm font-medium transition', filter === String(c.id) ? 'border-primary bg-primary text-white' : 'border-border')}>
              <button type="button" className="inline-flex cursor-pointer items-center gap-2 pl-1" onClick={() => setFilter(String(c.id))}>{c.image ? <img src={c.image} alt="" className="size-6 rounded-full object-cover" /> : <Tag className="size-3.5" />}{c.name}</button>
              <button type="button" onClick={() => openCat(c)} className="grid size-6 cursor-pointer place-items-center rounded-full opacity-60 hover:opacity-100" aria-label="Edit"><Pencil className="size-3" /></button>
              <button type="button" onClick={() => delCat(c)} className="grid size-6 cursor-pointer place-items-center rounded-full opacity-60 hover:opacity-100" aria-label="Delete"><X className="size-3" /></button>
            </span>
          ))}
        </CardBody>
      </Card>
      <Card>
        <CardHeader icon={Package} title={`Products (${products.length})`} actions={<Button size="sm" onClick={() => openProd()}><Plus />Product</Button>} />
        <CardBody>
          {!products.length ? <EmptyState icon={Package} title="No products here yet" action={<Button variant="soft" onClick={() => openProd()}><Plus />Add product</Button>} /> : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {products.map((p) => (
                <motion.div layout key={p.id} className={cn('group overflow-hidden rounded-2xl border border-border bg-card', !p.status && 'opacity-50')}>
                  <div className="relative aspect-square bg-muted">
                    {p.images?.[0] ? <img src={p.images[0]} alt="" className="size-full object-cover transition duration-500 group-hover:scale-105" /> : <Package className="absolute inset-0 m-auto size-8 text-muted-foreground" />}
                    {p.stock !== null && p.stock !== undefined && <Badge tone={p.stock > 0 ? 'neutral' : 'danger'} className="absolute top-2 left-2 bg-white/90">{p.stock > 0 ? `${p.stock} in stock` : 'Out of stock'}</Badge>}
                  </div>
                  <div className="flex items-center gap-1 p-3">
                    <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{p.name}</p><p className="text-sm font-bold text-primary">{cur}{Number(p.sale_price ?? p.price).toFixed(2)}{p.sale_price !== null && p.sale_price !== undefined && <s className="ml-1.5 text-xs font-normal text-muted-foreground">{cur}{Number(p.price).toFixed(2)}</s>}</p></div>
                    <Button variant="ghost" size="icon-sm" onClick={() => openProd(p)} aria-label="Edit"><Pencil /></Button>
                    <Button variant="danger-soft" size="icon-sm" onClick={() => delProd(p)} aria-label="Delete"><Trash2 /></Button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>
      <Dialog open={catOpen} onOpenChange={setCatOpen} icon={Tag} title={editing ? 'Edit category' : 'New category'} footer={<><Button variant="outline" onClick={() => setCatOpen(false)}>Cancel</Button><Button onClick={saveCat} loading={busy}>Save</Button></>}>
        <div className="grid gap-4"><Field label="Name" required error={cat.errors.name}><Input {...cat.input('name')} /></Field><Field label="Sort order"><Input {...cat.input('sort')} type="number" /></Field><Field label="Image"><ImageUpload value={cat.values.image} onChange={(x) => cat.set('image', x)} round /></Field></div>
      </Dialog>
      <Dialog open={prodOpen} onOpenChange={setProdOpen} size="lg" icon={Package} title={editing ? 'Edit product' : 'New product'} footer={<><Button variant="outline" onClick={() => setProdOpen(false)}>Cancel</Button><Button onClick={saveProd} loading={busy}>Save product</Button></>}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" required error={prod.errors.name} className="sm:col-span-2"><Input {...prod.input('name')} /></Field>
          <Field label={<span className="flex w-full items-center justify-between">Description <AiButton kind="store product" title={prod.values.name} details={prod.values.description} onResult={(t) => prod.set('description', t)} /></span>} className="sm:col-span-2"><Textarea {...prod.input('description')} rows={3} /></Field>
          <Field label="Price" required error={prod.errors.price}><Input {...prod.input('price')} type="number" min="0" step="0.01" /></Field>
          <Field label="Sale price" hint="Optional - shows a Sale badge"><Input {...prod.input('sale_price')} type="number" min="0" step="0.01" /></Field>
          <Field label="Stock" hint="Empty = unlimited. Goes down with every order"><Input {...prod.input('stock')} type="number" min="0" /></Field>
          <Field label="Category"><Select value={prod.values.category_id} onChange={(x) => prod.set('category_id', x)} allowEmpty placeholder="No category" options={st.categories.map((c) => ({ value: String(c.id), label: c.name }))} /></Field>
          <Field label="Sort order"><Input {...prod.input('sort')} type="number" /></Field>
          <Field label="Visible"><div className="flex h-10 items-center"><Switch checked={prod.values.status} onChange={(x) => prod.set('status', x)} /></div></Field>
          <div className="sm:col-span-2">
            <p className="mb-1.5 text-[13px] font-medium">Photos (up to 6)</p>
            <div className="flex flex-wrap gap-2">
              {keep.map((u) => <div key={u} className="relative"><img src={u} alt="" className="size-20 rounded-xl object-cover" /><button type="button" onClick={() => setKeep(keep.filter((x) => x !== u))} className="absolute -top-2 -right-2 grid size-6 cursor-pointer place-items-center rounded-full bg-danger text-white"><X className="size-3" /></button></div>)}
              {files.map((f, i) => <div key={i} className="relative"><img src={URL.createObjectURL(f)} alt="" className="size-20 rounded-xl object-cover ring-2 ring-primary" /><button type="button" onClick={() => setFiles(files.filter((_, j) => j !== i))} className="absolute -top-2 -right-2 grid size-6 cursor-pointer place-items-center rounded-full bg-danger text-white"><X className="size-3" /></button></div>)}
              {keep.length + files.length < 6 && <label className="grid size-20 cursor-pointer place-items-center rounded-xl border-2 border-dashed border-border text-muted-foreground hover:border-primary hover:text-primary"><input type="file" accept="image/png,image/jpeg,image/webp" multiple className="sr-only" onChange={(e) => setFiles([...files, ...Array.from(e.target.files)].slice(0, 6 - keep.length))} /><Plus className="size-5" /></label>}
            </div>
          </div>
        </div>
      </Dialog>
    </>
  );
}

function StoreStats({ sid }) {
  const [d, setD] = useState(null);
  useEffect(() => { api.get(`/user/stores/${sid}/analytics`).then(({ data }) => setD(data)); }, [sid]);
  if (!d) return <Skeleton className="h-80 rounded-2xl" />;
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard index={0} icon={Eye} color="violet" label="Store visits" value={d.views} />
        <StatCard index={1} icon={ShoppingBag} color="emerald" label="Orders (30 days)" value={d.orders} />
        <StatCard index={2} icon={Receipt} color="amber" label="Revenue (30 days)" value={d.revenue} format={(x) => Number(x).toFixed(2)} />
      </div>
      <Card><CardHeader title="Orders per day" /><CardBody><Bars data={d.byDay} name="Orders" height={260} /></CardBody></Card>
      <Card><CardHeader title="Best sellers" /><CardBody>{!d.top.length ? <EmptyState icon={Package} title="No sales yet" /> : <div className="space-y-2">{d.top.map((t, i) => <div key={t.name} className="flex items-center gap-3 rounded-xl bg-muted/50 px-4 py-2.5"><span className="grid size-7 place-items-center rounded-lg bg-primary text-xs font-bold text-white">{i + 1}</span><span className="flex-1 font-medium">{t.name}</span><Badge tone="primary">{t.value} sold</Badge></div>)}</div>}</CardBody></Card>
    </>
  );
}

/* --------------------------------------------------------------- orders */
const ORDER_STATUS = ['pending', 'confirmed', 'dispatched', 'delivered', 'cancelled'];
export function StoreOrders() {
  const list = useList('/user/store-orders');
  const [stores, setStores] = useState([]);
  const [view, setView] = useState(null);
  useEffect(() => { api.get('/user/stores').then(({ data }) => setStores(data.data)); }, []);
  const setStatus = async (o, status) => { o.status = status; await run(api.patch(`/user/store-orders/${o.id}`, { status }), `Order ${status}`).catch(() => {}); list.reload(); };
  const remove = async (o) => { if (await confirm({ title: `Delete order ${o.order_number}?` })) { await run(api.delete(`/user/store-orders/${o.id}`)).catch(() => {}); list.reload(); } };
  const tone = { pending: 'pending', confirmed: 'processing', dispatched: 'shipped', delivered: 'delivered', cancelled: 'cancelled' };
  return (
    <>
      <Link to="/user/stores" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" />Stores</Link>
      <PageHeader title="Store orders" description="Orders placed from your WhatsApp stores. Cancelling puts the stock back." />
      <TableCard title="All orders" list={list} toolbar={<>
        <FilterSelect value={list.params.store_id} onChange={(v) => list.set({ store_id: v })} placeholder="All stores" options={stores.map((s) => ({ value: s.id, label: s.name }))} />
        <FilterSelect value={list.params.status} onChange={(v) => list.set({ status: v })} placeholder="All statuses" options={ORDER_STATUS.map((s) => ({ value: s, label: s[0].toUpperCase() + s.slice(1) }))} />
        <SearchInput value={list.params.search} onChange={(search) => list.set({ search })} placeholder="Order no, name, phone..." />
      </>}>
        <DataTable loading={list.loading} rows={list.rows} empty={<EmptyState icon={ShoppingBag} title="No orders yet" description="Share your store link to start receiving orders." />} columns={[
          { key: 'no', label: 'Order', render: (o) => <div><p className="font-mono text-xs font-semibold text-primary">{o.order_number}</p><p className="text-xs text-muted-foreground">{fmtDateTime(o.created_at)}</p></div> },
          { key: 'c', label: 'Customer', render: (o) => <div><p className="font-medium">{o.customer_name}</p><a href={`https://wa.me/${String(o.customer_phone).replace(/\D/g, '')}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-success hover:underline"><MessageCircle className="size-3" />{o.customer_phone}</a></div> },
          { key: 's', label: 'Store', render: (o) => <Badge tone="outline">{o.whatsapp_store?.name}</Badge> },
          { key: 't', label: 'Total', render: (o) => <div><p className="font-semibold">{o.whatsapp_store?.currency_icon}{Number(o.total).toFixed(2)}</p><p className="text-xs text-muted-foreground">{o.items.length} item(s) · {o.delivery_type}</p></div> },
          { key: 'st', label: 'Status', render: (o) => <div className="w-36"><Select value={o.status} onChange={(x) => setStatus(o, x)} options={ORDER_STATUS.map((s) => ({ value: s, label: s[0].toUpperCase() + s.slice(1) }))} className="h-8 rounded-lg text-xs" /></div> },
          { key: '_a', label: '', className: 'text-right', render: (o) => <Actions><Action icon={Eye} label="Details" onClick={() => setView(o)} /><Action icon={Download} label="Invoice PDF" tone="info" href={`/api/user/store-orders/${o.id}/invoice`} /><Action icon={Trash2} label="Delete" tone="danger" onClick={() => remove(o)} /></Actions> },
        ]} />
      </TableCard>
      <Dialog open={!!view} onOpenChange={(o) => !o && setView(null)} icon={Receipt} title={view ? `Order ${view.order_number}` : ''}>
        {view && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-border">
              {view.items.map((it) => <div key={it.product_id} className="flex justify-between border-b border-border px-4 py-2.5 text-sm last:border-0"><span>{it.qty} × {it.name}</span><span className="font-medium">{view.whatsapp_store?.currency_icon}{(it.qty * it.price).toFixed(2)}</span></div>)}
            </div>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{Number(view.subtotal).toFixed(2)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Delivery</span><span>{Number(view.delivery_charge).toFixed(2)}</span></div>
              <div className="flex justify-between font-display text-lg font-bold"><span>Total</span><span>{view.whatsapp_store?.currency_icon}{Number(view.total).toFixed(2)}</span></div>
            </div>
            <div className="rounded-2xl bg-muted/50 p-4 text-sm"><p className="font-medium">{view.customer_name} · {view.customer_phone}</p><p className="text-muted-foreground">{view.delivery_type === 'takeaway' ? 'Take-away' : view.customer_address}</p>{view.notes && <p className="mt-2">{view.notes}</p>}</div>
            <div className="flex gap-2"><StatusBadge value={tone[view.status]}>{view.status}</StatusBadge></div>
          </div>
        )}
      </Dialog>
    </>
  );
}

export { Check };
