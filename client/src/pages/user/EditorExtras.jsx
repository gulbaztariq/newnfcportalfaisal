/* Extra vCard editor tabs: media & embeds, payment links, legal pages, QR code, appointments, products, blog, custom pages, advanced */
import { lazy, Suspense, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { Youtube as YtIcon, Instagram as InstaIcon, Linkedin as LinkedIcon } from '@/components/BrandIcons';
import {
  Film, Image as ImageIcon, Code2, MapPin, Plus, Trash2, Wallet, FileText, QrCode, Download,
  CalendarClock, Package, Pencil, Newspaper, FileStack, X, Globe2, Upload, CheckCircle2, Clock3, ShieldCheck,
} from 'lucide-react';
import api, { toFormData } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/cn';
import { Card, CardHeader, CardBody, Button, ButtonLink, Field, Input, Textarea, Select, Switch, SwitchRow, ImageUpload, ColorInput, Dialog, EmptyState, Skeleton, Badge, Segmented, run, confirm, useForm } from '@/components/ui';
import AiButton from '@/components/AiButton';

const RichText = lazy(() => import('@/components/ui/RichText'));
const Editor = (p) => <Suspense fallback={<Skeleton className="h-48 rounded-xl" />}><RichText {...p} /></Suspense>;
const DAYS = [['mon', 'Monday'], ['tue', 'Tuesday'], ['wed', 'Wednesday'], ['thu', 'Thursday'], ['fri', 'Friday'], ['sat', 'Saturday'], ['sun', 'Sunday']];
export const LANGUAGES = [['en', 'English'], ['ar', 'Arabic (RTL)'], ['ur', 'Urdu (RTL)'], ['fa', 'Persian (RTL)'], ['hi', 'Hindi'], ['fr', 'French'], ['es', 'Spanish'], ['de', 'German'], ['pt', 'Portuguese'], ['it', 'Italian'], ['tr', 'Turkish'], ['ru', 'Russian'], ['zh', 'Chinese'], ['vi', 'Vietnamese']];

/* ------------------------------------------------------------- media */
export function MediaTab({ v, form, locked, Upgrade, vcardId, onVideo }) {
  const [uploading, setUploading] = useState(false);
  const uploadVideo = async (file) => {
    if (!file) return;
    setUploading(true);
    try { const d = await run(api.post(`/user/vcards/${vcardId}/cover-video`, toFormData({ video: file }))); onVideo(d.data); } catch { /* toast shown */ } finally { setUploading(false); }
  };
  const list = (k) => v[k] || [];
  return (
    <>
      <Card>
        <CardHeader icon={Film} title="Cover media" description="Show an image, a looping video or a YouTube video at the top of your card" />
        <CardBody className="space-y-4">
          <Segmented id="cover" value={v.cover_type || 'image'} onChange={(x) => form.set('cover_type', x)} options={[{ value: 'image', label: 'Image', icon: ImageIcon }, { value: 'video', label: 'Video', icon: Film }, { value: 'youtube', label: 'YouTube', icon: YtIcon }]} />
          <AnimatePresence mode="wait">
            <motion.div key={v.cover_type || 'image'} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              {(v.cover_type || 'image') === 'image' && <p className="text-sm text-muted-foreground">Upload the cover image in <b>Basic details</b>.</p>}
              {v.cover_type === 'video' && (
                <div className="space-y-3">
                  {v.cover_video && <video src={v.cover_video} className="aspect-[3/1] w-full rounded-2xl object-cover" autoPlay muted loop playsInline />}
                  <label className="flex cursor-pointer items-center gap-3 rounded-2xl border-2 border-dashed border-border p-4 transition hover:border-primary/50">
                    <input type="file" accept="video/mp4,video/webm" className="sr-only" onChange={(e) => uploadVideo(e.target.files[0])} />
                    <span className="grid size-10 place-items-center rounded-xl bg-primary-soft text-primary"><Upload className="size-4.5" /></span>
                    <span className="text-sm"><b>{uploading ? 'Uploading...' : v.cover_video ? 'Replace video' : 'Upload a video'}</b><span className="block text-xs text-muted-foreground">MP4 or WebM, up to 25 MB. Plays muted with a sound toggle.</span></span>
                  </label>
                </div>
              )}
              {v.cover_type === 'youtube' && (
                <Field label="YouTube link" error={form.errors.youtube_link} hint="Plays muted in a loop as your cover">
                  <Input icon={YtIcon} value={v.youtube_link || ''} onChange={(e) => form.set('youtube_link', e.target.value)} placeholder="https://youtube.com/watch?v=..." />
                </Field>
              )}
            </motion.div>
          </AnimatePresence>
        </CardBody>
      </Card>
      <Card>
        <CardHeader icon={Code2} title="Embeds" description="Show social posts, videos or any web page inside your card" />
        <CardBody className="space-y-4">
          {locked('instagram_embed') ? <Upgrade what="Instagram embed" /> : <Field label="Instagram post or reel" error={form.errors.instagram_embed}><Input icon={InstaIcon} value={v.instagram_embed || ''} onChange={(e) => form.set('instagram_embed', e.target.value)} placeholder="https://www.instagram.com/p/..." /></Field>}
          {locked('linkedin_embed') ? <Upgrade what="LinkedIn embed" /> : <Field label="LinkedIn post" error={form.errors.linkedin_embed} hint="Paste the post URL or its Embed code"><Input icon={LinkedIcon} value={v.linkedin_embed || ''} onChange={(e) => form.set('linkedin_embed', e.target.value)} placeholder="https://www.linkedin.com/posts/..." /></Field>}
          {locked('iframes') ? <Upgrade what="iFrames" /> : (
            <div>
              <div className="mb-2 flex items-center justify-between"><p className="text-[13px] font-medium">iFrames (https only, up to 5)</p><Button size="xs" variant="soft" onClick={() => form.set('iframes', [...list('iframes'), { title: '', url: '' }])} disabled={list('iframes').length >= 5}><Plus />Add</Button></div>
              <div className="space-y-2">
                {list('iframes').map((f, i) => (
                  <div key={i} className="flex gap-2">
                    <Input className="w-40" placeholder="Title" value={f.title} onChange={(e) => form.set('iframes', list('iframes').map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} />
                    <Input className="flex-1" placeholder="https://..." value={f.url} onChange={(e) => form.set('iframes', list('iframes').map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))} />
                    <Button variant="danger-soft" size="icon" onClick={() => form.set('iframes', list('iframes').filter((_, j) => j !== i))} aria-label="Remove"><Trash2 /></Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardBody>
      </Card>
      <Card>
        <CardHeader icon={MapPin} title="Location map" description='In Google Maps choose Share → "Embed a map" and paste the code here' />
        <CardBody className="space-y-3">
          <Field error={form.errors.location_embed}><Textarea rows={2} value={v.location_embed || ''} onChange={(e) => form.set('location_embed', e.target.value)} placeholder='<iframe src="https://www.google.com/maps/embed?pb=..."></iframe>' /></Field>
          {/^https:\/\/(www\.)?google\.[a-z.]+\/maps\/embed/.test(v.location_embed || '') && <iframe title="map preview" src={v.location_embed} className="h-56 w-full rounded-2xl border border-border" loading="lazy" />}
        </CardBody>
      </Card>
    </>
  );
}

/* ------------------------------------------------------ payment links */
const PAY_TYPES = [{ value: 'link', label: 'Payment link' }, { value: 'paypal', label: 'PayPal' }, { value: 'upi', label: 'UPI / wallet' }, { value: 'bank', label: 'Bank' }, { value: 'crypto', label: 'Crypto' }];
export function PaymentLinksTab({ v, form, locked, Upgrade }) {
  const list = v.payment_links || [];
  const upd = (i, patch) => form.set('payment_links', list.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  return (
    <Card>
      <CardHeader icon={Wallet} title="Payment links" description="Let people pay you straight from your card (PayPal.me, Stripe links, UPI...)"
        actions={!locked('payment_links') && <Button size="sm" onClick={() => form.set('payment_links', [...list, { label: '', url: '', type: 'link' }])}><Plus />Add</Button>} />
      <CardBody>
        {locked('payment_links') ? <Upgrade what="Payment links" /> : !list.length ? <EmptyState icon={Wallet} title="No payment links yet" /> : (
          <div className="space-y-2">
            {list.map((l, i) => (
              <motion.div layout key={i} className="flex flex-wrap items-center gap-2 rounded-2xl border border-border p-3">
                <div className="w-40"><Select value={l.type} onChange={(x) => upd(i, { type: x })} options={PAY_TYPES} /></div>
                <Input className="min-w-36 flex-1" placeholder="Label, e.g. Pay with PayPal" value={l.label} onChange={(e) => upd(i, { label: e.target.value })} />
                <Input className="min-w-52 flex-[2]" placeholder="https://" value={l.url} onChange={(e) => upd(i, { url: e.target.value })} />
                <Button variant="danger-soft" size="icon" onClick={() => form.set('payment_links', list.filter((_, j) => j !== i))} aria-label="Remove"><Trash2 /></Button>
              </motion.div>
            ))}
          </div>
        )}
      </CardBody>
    </Card>
  );
}

/* ----------------------------------------------------------- legal */
export function LegalTab({ v, form }) {
  return (
    <>
      <Card><CardHeader icon={FileText} title="Terms & Conditions" description="Linked in your card's footer when filled" /><CardBody><Editor value={v.terms_conditions || ''} onChange={(x) => form.set('terms_conditions', x)} height={200} /></CardBody></Card>
      <Card><CardHeader icon={ShieldCheck} title="Privacy Policy" /><CardBody><Editor value={v.privacy_policy || ''} onChange={(x) => form.set('privacy_policy', x)} height={200} /></CardBody></Card>
    </>
  );
}

/* ------------------------------------------------------------ QR */
export function QrTab({ v, form, locked, vcardId, alias, rev }) {
  const q = v.qr_settings || {};
  const set = (k, x) => form.set('qr_settings', { ...q, [k]: x });
  const [link, setLink] = useState(null);
  useEffect(() => { if (vcardId) api.get(`/user/vcards/${vcardId}/short-link`).then(({ data }) => setLink(data.data)).catch(() => {}); }, [vcardId]);
  return (
    <Card>
      <CardHeader icon={QrCode} title="QR code" description="Colours apply after saving" />
      <CardBody className="grid gap-6 md:grid-cols-[1fr_220px]">
        <div className="space-y-4">
          {link && (
            <div className="rounded-2xl border border-primary/30 bg-primary-soft/50 p-4 text-sm">
              <p className="font-medium">This QR code opens your dynamic link</p>
              <div className="mt-2 flex items-center gap-2">
                <code className="min-w-0 flex-1 truncate rounded-lg bg-card px-2.5 py-1.5 text-xs">{link.short_url}</code>
                <Button size="sm" variant="outline" onClick={() => { navigator.clipboard?.writeText(link.short_url); toast.success('Link copied'); }}>Copy</Button>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">It points to this card now; you can send it somewhere else later without reprinting. <Link to="/user/short-links" className="font-medium text-primary hover:underline">Manage links</Link> · {link.clicks} scans</p>
            </div>
          )}
          {locked('custom_qrcode') ? <p className="rounded-xl bg-warning-soft px-4 py-3 text-sm text-warning">Custom QR colours need a plan with the Custom QR code feature.</p> : (
            <div className="grid gap-4 sm:grid-cols-2">
              <ColorInput label="Foreground" value={q.fg || v.theme?.primary || '#000000'} onChange={(x) => set('fg', x)} />
              <ColorInput label="Background" value={q.bg || '#ffffff'} onChange={(x) => set('bg', x)} />
            </div>
          )}
          <Field label={`Download size: ${q.size || 600}px`}><input type="range" min="200" max="1200" step="50" value={q.size || 600} onChange={(e) => set('size', Number(e.target.value))} className="w-full accent-[var(--primary)]" /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Error correction" hint="Higher survives print damage and logos"><Select value={q.ec || 'M'} onChange={(x) => set('ec', x)} options={[{ value: 'L', label: 'Low (7%)' }, { value: 'M', label: 'Medium (15%)' }, { value: 'Q', label: 'Quartile (25%)' }, { value: 'H', label: 'High (30%)' }]} /></Field>
            <Field label="Quiet zone"><Select value={String(q.margin ?? 2)} onChange={(x) => set('margin', Number(x))} options={[0, 1, 2, 4, 6].map((m) => ({ value: String(m), label: `${m} modules` }))} /></Field>
          </div>
          <SwitchRow id="showqr" title="Show QR code on the card" checked={v.show_qr_code} onChange={(x) => form.set('show_qr_code', x)} />
        </div>
        <div className="text-center">
          <div className="rounded-3xl border border-border bg-white p-4 shadow-soft"><img key={rev} src={`/api/user/vcards/${vcardId}/qrcode?size=400&r=${rev}`} alt="QR code" className="mx-auto aspect-square w-full" /></div>
          <div className="mt-3 grid gap-2">
            <ButtonLink href={`/api/user/vcards/${vcardId}/qrcode`} variant="outline" size="sm"><Download />PNG</ButtonLink>
            <ButtonLink href={`/api/user/vcards/${vcardId}/qrcode?format=svg`} variant="outline" size="sm"><Download />SVG (print)</ButtonLink>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}

/* --------------------------------------------------- appointments */
export function AppointmentsTab({ v, form, locked, Upgrade }) {
  const a = { duration: 30, slots: {}, blocked: [], ...(v.appointment_settings || {}) };
  const set = (patch) => form.set('appointment_settings', { ...a, ...patch });
  const setDay = (d, rows) => set({ slots: { ...a.slots, [d]: rows } });
  const [block, setBlock] = useState('');
  if (locked('appointments')) return <Upgrade what="Appointments" />;
  return (
    <>
      <Card>
        <CardHeader icon={CalendarClock} title="Appointment booking" description="Visitors pick a free slot on your card; you confirm it in Appointments"
          actions={<ButtonLink as={Link} to="/user/appointments" size="sm" variant="outline">View bookings</ButtonLink>} />
        <CardBody className="space-y-4">
          <SwitchRow id="ap-on" title="Accept appointments" description="Shows a booking widget on your card" checked={!!a.enabled} onChange={(x) => set({ enabled: x })} />
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Slot length"><Select value={String(a.duration)} onChange={(x) => set({ duration: Number(x) })} options={[15, 20, 30, 45, 60, 90, 120].map((m) => ({ value: String(m), label: `${m} minutes` }))} /></Field>
            <Field label="Paid appointments"><div className="flex h-10 items-center"><Switch checked={!!a.paid} onChange={(x) => set({ paid: x })} /></div></Field>
            {a.paid && <Field label="Price per appointment"><Input type="number" min="0" step="0.01" value={a.price || ''} onChange={(e) => set({ price: e.target.value })} /></Field>}
          </div>
          <SwitchRow id="ap-svc" title="Book by service" description="Visitors choose one of your services when booking" checked={!!a.by_service} onChange={(x) => set({ by_service: x })} />
        </CardBody>
      </Card>
      <Card>
        <CardHeader icon={Clock3} title="Weekly availability" actions={<Button size="xs" variant="outline" onClick={() => set({ slots: Object.fromEntries(DAYS.map(([d], i) => [d, i < 5 ? [{ from: '09:00', to: '17:00' }] : []])) })}>Mon-Fri 9-5</Button>} />
        <CardBody className="space-y-2">
          {DAYS.map(([d, l]) => {
            const rows = a.slots?.[d] || [];
            return (
              <div key={d} className="flex flex-wrap items-start gap-3 rounded-2xl border border-border p-3">
                <span className="w-28 pt-2 text-sm font-medium">{l}</span>
                <div className="flex-1 space-y-2">
                  {!rows.length && <p className="pt-2 text-sm text-muted-foreground">Unavailable</p>}
                  {rows.map((r, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Input type="time" className="w-32" value={r.from} onChange={(e) => setDay(d, rows.map((x, j) => (j === i ? { ...x, from: e.target.value } : x)))} />
                      <span className="text-muted-foreground">to</span>
                      <Input type="time" className="w-32" value={r.to} onChange={(e) => setDay(d, rows.map((x, j) => (j === i ? { ...x, to: e.target.value } : x)))} />
                      <Button variant="ghost" size="icon-sm" onClick={() => setDay(d, rows.filter((_, j) => j !== i))} aria-label="Remove"><X /></Button>
                    </div>
                  ))}
                </div>
                <Button variant="soft" size="sm" onClick={() => setDay(d, [...rows, { from: '09:00', to: '12:00' }])}><Plus />Hours</Button>
              </div>
            );
          })}
        </CardBody>
      </Card>
      <Card>
        <CardHeader title="Unavailable dates" description="Holidays or days off - no slots are offered on these dates" />
        <CardBody>
          <div className="flex gap-2"><Input type="date" value={block} onChange={(e) => setBlock(e.target.value)} className="w-48" /><Button variant="soft" onClick={() => { if (block && !a.blocked.includes(block)) set({ blocked: [...a.blocked, block].sort() }); setBlock(''); }}><Plus />Add date</Button></div>
          <div className="mt-3 flex flex-wrap gap-2">{a.blocked.map((d) => <Badge key={d} tone="outline" className="gap-2">{d}<button type="button" className="cursor-pointer" onClick={() => set({ blocked: a.blocked.filter((x) => x !== d) })}><X className="size-3" /></button></Badge>)}</div>
        </CardBody>
      </Card>
    </>
  );
}

/* -------------------------------------------------------- products */
export function ProductsTab({ vcardId, locked, Upgrade, onChanged }) {
  const [rows, setRows] = useState(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [files, setFiles] = useState([]);
  const [keep, setKeep] = useState([]);
  const [busy, setBusy] = useState(false);
  const form = useForm({ name: '', description: '', price: '', currency_code: 'USD', product_url: '', in_stock: true, sort: 0 });
  const load = () => api.get(`/user/vcards/${vcardId}/products`).then(({ data }) => setRows(data.data));
  useEffect(() => { load(); }, [vcardId]); // eslint-disable-line
  if (locked('products')) return <Upgrade what="Products" />;
  const openForm = (p) => {
    setEditing(p || null); setFiles([]); setKeep(p?.images || []); form.setErrors({});
    form.setValues(p ? { name: p.name, description: p.description || '', price: p.price ?? '', currency_code: p.currency_code || 'USD', product_url: p.product_url || '', in_stock: p.in_stock, sort: p.sort } : { name: '', description: '', price: '', currency_code: 'USD', product_url: '', in_stock: true, sort: (rows?.length || 0) });
    setOpen(true);
  };
  const save = async () => {
    setBusy(true);
    const fd = toFormData({ ...form.values, in_stock: form.values.in_stock ? '1' : '0', keep_images: editing ? JSON.stringify(keep) : undefined });
    files.forEach((f) => fd.append('images', f));
    try { await run(editing ? api.put(`/user/vcards/${vcardId}/products/${editing.id}`, fd) : api.post(`/user/vcards/${vcardId}/products`, fd)); setOpen(false); load(); onChanged(); } catch (e) { form.setErrors(e.errors || {}); } finally { setBusy(false); }
  };
  const remove = async (p) => { if (await confirm({ title: `Delete ${p.name}?` })) { await run(api.delete(`/user/vcards/${vcardId}/products/${p.id}`)).catch(() => {}); load(); onChanged(); } };
  return (
    <>
      <Card>
        <CardHeader icon={Package} title={`Products (${rows?.length ?? 0})`} description="Showcase items with photos, prices and a buy or enquire button" actions={<Button size="sm" onClick={() => openForm()}><Plus />Add product</Button>} />
        <CardBody>
          {!rows ? <Skeleton className="h-40 rounded-2xl" /> : !rows.length ? <EmptyState icon={Package} title="No products yet" action={<Button variant="soft" onClick={() => openForm()}><Plus />Add your first product</Button>} /> : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {rows.map((p) => (
                <motion.div layout key={p.id} className="group overflow-hidden rounded-2xl border border-border bg-card">
                  <div className="relative aspect-[4/3] bg-muted">{p.images?.[0] ? <img src={p.images[0]} alt="" className="size-full object-cover transition duration-500 group-hover:scale-105" /> : <Package className="absolute inset-0 m-auto size-8 text-muted-foreground" />}
                    {p.images?.length > 1 && <Badge className="absolute right-2 bottom-2 bg-zinc-900/70 text-white">+{p.images.length - 1}</Badge>}
                    {!p.in_stock && <Badge tone="danger" className="absolute top-2 left-2">Out of stock</Badge>}</div>
                  <div className="flex items-center gap-2 p-3">
                    <div className="min-w-0 flex-1"><p className="truncate font-medium">{p.name}</p><p className="text-sm font-semibold text-primary">{p.price !== null && p.price !== undefined ? `${p.currency_code || ''} ${Number(p.price).toFixed(2)}` : '—'}</p></div>
                    <Button variant="ghost" size="icon-sm" onClick={() => openForm(p)} aria-label="Edit"><Pencil /></Button>
                    <Button variant="danger-soft" size="icon-sm" onClick={() => remove(p)} aria-label="Delete"><Trash2 /></Button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>
      <Dialog open={open} onOpenChange={setOpen} size="lg" icon={Package} title={editing ? 'Edit product' : 'Add product'} footer={<><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={save} loading={busy}>Save product</Button></>}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" required error={form.errors.name} className="sm:col-span-2"><Input {...form.input('name')} /></Field>
          <Field label={<span className="flex w-full items-center justify-between">Description <AiButton kind="product" title={form.values.name} details={form.values.description} onResult={(t) => form.set('description', t)} /></span>} className="sm:col-span-2"><Textarea {...form.input('description')} rows={3} /></Field>
          <Field label="Price" error={form.errors.price}><Input {...form.input('price')} type="number" min="0" step="0.01" /></Field>
          <Field label="Currency"><Input {...form.input('currency_code')} maxLength={10} placeholder="USD" /></Field>
          <Field label="Buy link (optional)" className="sm:col-span-2"><Input {...form.input('product_url')} placeholder="https://your-shop.com/product" /></Field>
          <Field label="Sort order"><Input {...form.input('sort')} type="number" /></Field>
          <Field label="In stock"><div className="flex h-10 items-center"><Switch checked={form.values.in_stock} onChange={(x) => form.set('in_stock', x)} /></div></Field>
          <div className="sm:col-span-2">
            <p className="mb-1.5 text-[13px] font-medium">Photos (up to 6)</p>
            <div className="flex flex-wrap gap-2">
              {keep.map((u) => <div key={u} className="relative"><img src={u} alt="" className="size-20 rounded-xl object-cover" /><button type="button" onClick={() => setKeep(keep.filter((x) => x !== u))} className="absolute -top-2 -right-2 grid size-6 cursor-pointer place-items-center rounded-full bg-danger text-white"><X className="size-3" /></button></div>)}
              {files.map((f, i) => <div key={i} className="relative"><img src={URL.createObjectURL(f)} alt="" className="size-20 rounded-xl object-cover ring-2 ring-primary" /><button type="button" onClick={() => setFiles(files.filter((_, j) => j !== i))} className="absolute -top-2 -right-2 grid size-6 cursor-pointer place-items-center rounded-full bg-danger text-white"><X className="size-3" /></button></div>)}
              {keep.length + files.length < 6 && (
                <label className="grid size-20 cursor-pointer place-items-center rounded-xl border-2 border-dashed border-border text-muted-foreground transition hover:border-primary hover:text-primary">
                  <input type="file" accept="image/png,image/jpeg,image/webp" multiple className="sr-only" onChange={(e) => setFiles([...files, ...Array.from(e.target.files)].slice(0, 6 - keep.length))} /><Plus className="size-5" />
                </label>
              )}
            </div>
          </div>
        </div>
      </Dialog>
    </>
  );
}

/* ------------------------------------------ blog posts / custom pages */
function ContentList({ vcardId, kind, alias, locked, Upgrade, onChanged }) {
  const isBlog = kind === 'blogs';
  const feature = isBlog ? 'blog' : 'custom_pages';
  const [rows, setRows] = useState(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(false);
  const blank = { title: '', slug: '', body: '', status: true, image: null };
  const form = useForm(blank);
  const load = () => api.get(`/user/vcards/${vcardId}/${kind}`).then(({ data }) => setRows(data.data));
  useEffect(() => { load(); }, [vcardId]); // eslint-disable-line
  if (locked(feature)) return <Upgrade what={isBlog ? 'Blog' : 'Custom pages'} />;
  const openForm = (x) => { setEditing(x || null); form.setErrors({}); form.setValues(x ? { title: x.title, slug: x.slug, body: (isBlog ? x.description : x.content) || '', status: x.status, image: x.image || null } : blank); setOpen(true); };
  const save = async () => {
    setBusy(true);
    const v = form.values;
    const payload = { title: v.title, slug: v.slug, status: v.status ? '1' : '0', [isBlog ? 'description' : 'content']: v.body };
    if (isBlog && v.image instanceof File) payload.image = v.image;
    const body = isBlog ? toFormData(payload) : payload;
    try { await run(editing ? api.put(`/user/vcards/${vcardId}/${kind}/${editing.id}`, body) : api.post(`/user/vcards/${vcardId}/${kind}`, body)); setOpen(false); load(); onChanged(); } catch (e) { form.setErrors(e.errors || {}); } finally { setBusy(false); }
  };
  const remove = async (x) => { if (await confirm({ title: `Delete "${x.title}"?` })) { await run(api.delete(`/user/vcards/${vcardId}/${kind}/${x.id}`)).catch(() => {}); load(); onChanged(); } };
  const Icon = isBlog ? Newspaper : FileStack;
  const path = (x) => `/${alias}/${isBlog ? 'blog' : 'p'}/${x.slug}`;
  return (
    <>
      <Card>
        <CardHeader icon={Icon} title={isBlog ? 'Blog posts' : 'Custom pages'} description={isBlog ? 'Share news and articles on your card' : 'Extra pages linked in your card footer (menu, FAQ, policies...)'} actions={<Button size="sm" onClick={() => openForm()}><Plus />{isBlog ? 'New post' : 'New page'}</Button>} />
        <CardBody>
          {!rows ? <Skeleton className="h-32 rounded-2xl" /> : !rows.length ? <EmptyState icon={Icon} title={isBlog ? 'No posts yet' : 'No pages yet'} /> : (
            <div className="space-y-2">
              {rows.map((x) => (
                <motion.div layout key={x.id} className="flex items-center gap-3 rounded-2xl border border-border p-3">
                  {isBlog && (x.image ? <img src={x.image} alt="" className="size-12 rounded-xl object-cover" /> : <span className="grid size-12 place-items-center rounded-xl bg-primary-soft text-primary"><Newspaper className="size-5" /></span>)}
                  <div className="min-w-0 flex-1"><p className="truncate font-medium">{x.title}</p><a href={path(x)} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline">{path(x)}</a></div>
                  {x.status ? <Badge tone="success" dot>Published</Badge> : <Badge>Draft</Badge>}
                  <Button variant="ghost" size="icon-sm" onClick={() => openForm(x)} aria-label="Edit"><Pencil /></Button>
                  <Button variant="danger-soft" size="icon-sm" onClick={() => remove(x)} aria-label="Delete"><Trash2 /></Button>
                </motion.div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>
      <Dialog open={open} onOpenChange={setOpen} size="xl" icon={Icon} title={editing ? 'Edit' : isBlog ? 'New blog post' : 'New page'} footer={<><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={save} loading={busy}>Save</Button></>}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Title" required error={form.errors.title}><Input {...form.input('title')} /></Field>
          <Field label="URL slug" hint="Leave empty to generate from the title"><Input {...form.input('slug')} placeholder="my-post" /></Field>
          {isBlog && <Field label="Cover image" className="sm:col-span-2"><ImageUpload value={form.values.image} onChange={(x) => form.set('image', x)} aspect="aspect-video" /></Field>}
          <Field label={<span className="flex w-full items-center justify-between">Content {isBlog && <AiButton kind="blog post" title={form.values.title} onResult={(t) => form.set('body', `${form.values.body || ''}<p>${t}</p>`)} label="AI intro" />}</span>} error={form.errors.description || form.errors.content} className="sm:col-span-2">
            <Editor value={form.values.body} onChange={(x) => form.set('body', x)} height={260} />
          </Field>
          <SwitchRow id="pub" className="sm:col-span-2" title="Published" checked={form.values.status} onChange={(x) => form.set('status', x)} />
        </div>
      </Dialog>
    </>
  );
}
export const BlogTab = (p) => <ContentList {...p} kind="blogs" />;
export const PagesTab = (p) => <ContentList {...p} kind="pages" />;

/* -------------------------------------------------- advanced extras */
export function AdvancedExtras({ v, form, locked, data }) {
  const { settings } = useAuth();
  const statusTone = { approved: 'success', pending: 'warning', rejected: 'danger' }[data.custom_domain_status];
  return (
    <>
      <Card>
        <CardHeader icon={Globe2} title="Experience" />
        <CardBody className="space-y-3">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Card language" hint="Labels on your card; Arabic, Urdu and Persian switch to right-to-left"><Select value={v.default_language || 'en'} onChange={(x) => form.set('default_language', x)} options={LANGUAGES.map(([value, label]) => ({ value, label }))} /></Field>
            <Field label="Week starts on"><Select value={v.week_format || 'mon'} onChange={(x) => form.set('week_format', x)} options={[{ value: 'mon', label: 'Monday' }, { value: 'sun', label: 'Sunday' }]} /></Field>
          </div>
          <SwitchRow id="sticky" title="Sticky quick-action bar" description="Floating call / WhatsApp / save buttons at the bottom" checked={v.sticky_bar !== false} onChange={(x) => form.set('sticky_bar', x)} />
          <SwitchRow id="ask" title="Ask for details before saving the contact" description="Visitors leave their name before downloading your vCard file - you get them as leads" checked={!!v.ask_before_contact} onChange={(x) => form.set('ask_before_contact', x)} />
          <SwitchRow id="att" title="Allow attachments in enquiries" description="Visitors can attach an image or PDF (max 5 MB)" checked={!!v.enquiry_attachment} onChange={(x) => form.set('enquiry_attachment', x)} />
          <SwitchRow id="nl" title="Newsletter popup" description={locked('newsletter') ? 'Not included in your plan' : 'Collect e-mail subscribers with a friendly popup'} checked={!!v.newsletter_popup} disabled={locked('newsletter')} onChange={(x) => form.set('newsletter_popup', x)} />
          <SwitchRow id="pwa" title="Installable app (PWA)" description={locked('pwa') ? 'Not included in your plan' : 'Visitors can add your card to their home screen'} checked={!!v.pwa_enable} disabled={locked('pwa')} onChange={(x) => form.set('pwa_enable', x)} />
          {settings.business_directory_enable !== '0' && <SwitchRow id="dir" title="List in the business directory" description={locked('business_directory') ? 'Not included in your plan' : 'Appear on the public directory so new clients can find you'} checked={!!v.business_directory} disabled={locked('business_directory')} onChange={(x) => form.set('business_directory', x)} />}
        </CardBody>
      </Card>
      <Card>
        <CardHeader icon={Globe2} title="Custom domain" description="Open this card on your own domain, e.g. card.yourcompany.com" />
        <CardBody className="space-y-3">
          {locked('allow_custom_domain') ? <p className="rounded-xl bg-warning-soft px-4 py-3 text-sm text-warning">Custom domains need a plan with the Custom domain feature.</p> : (
            <>
              <Field error={form.errors.custom_domain}><Input icon={Globe2} value={v.custom_domain || ''} onChange={(e) => form.set('custom_domain', e.target.value)} placeholder="card.yourcompany.com" /></Field>
              {data.custom_domain && <p className="flex items-center gap-2 text-sm">Status: <Badge tone={statusTone} dot>{data.custom_domain_status}</Badge></p>}
              <div className="rounded-2xl bg-muted/60 p-4 text-sm text-muted-foreground">
                <p className="mb-1 font-medium text-foreground">How to connect</p>
                1. Add a <b>CNAME</b> record for your domain pointing to <code className="rounded bg-card px-1.5">{(settings.app_url || '').replace(/^https?:\/\//, '')}</code>. 2. Save here - an admin approves the domain and adds it to the server. 3. Your card opens on your domain.
              </div>
            </>
          )}
        </CardBody>
      </Card>
    </>
  );
}

export { CheckCircle2 };
