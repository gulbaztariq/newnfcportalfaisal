/* User portal: NFC product orders + tracking, dynamic links / QR, invoices */
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { motion } from 'motion/react';
import { toast } from 'sonner';
import {
  ShoppingBag, Package, ArrowLeft, Truck, Check, Clock, Palette, Printer, PackageCheck, Home, Undo2, XCircle, RefreshCw, FileText, Link2, Plus, Pencil, Trash2,
  Copy, QrCode, BarChart3, Tag, ExternalLink, Nfc, Lock,
} from 'lucide-react';
import api from '@/lib/api';
import { cn } from '@/lib/cn';
import { fmtDate, fmtDateTime, label } from '@/lib/format';
import { AreaTrend } from '@/components/ui/charts';
import {
  PageHeader, TableCard, DataTable, Card, CardHeader, CardBody, Button, ButtonLink, Dialog, Field, Input, Select, Segmented, SwitchRow, Badge, StatusBadge,
  EmptyState, Skeleton, Tip, Action, Actions, useForm, run, confirm,
} from '@/components/ui';

const rs = (v, cur = 'Rs') => `${cur} ${Number(v || 0).toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
const STEP_ICONS = { pending: Clock, confirmed: Check, designing: Palette, printing: Printer, ready: PackageCheck, shipped: Truck, delivered: Home, returned: Undo2, cancelled: XCircle, processing: RefreshCw };

/* ================================================================ orders */
export function UserOrders() {
  const [rows, setRows] = useState(null);
  useEffect(() => { api.get('/user/nfc-orders').then(({ data }) => setRows(data.data)); }, []);
  return (
    <>
      <PageHeader title="NFC orders" description="Order NFC cards, standees, tags and more for your vCard, then follow every step until delivery.">
        <ButtonLink as={Link} to="/shop"><ShoppingBag />Shop NFC products</ButtonLink>
      </PageHeader>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="relative mb-6 overflow-hidden rounded-3xl bg-linear-to-br from-violet-600 via-fuchsia-600 to-pink-500 p-6 text-white md:p-8">
        <div className="bg-grid absolute inset-0 opacity-20" />
        <div className="relative flex flex-wrap items-center gap-6">
          <span className="grid size-14 place-items-center rounded-2xl bg-white/15 backdrop-blur"><Nfc className="size-7" /></span>
          <div className="min-w-60 flex-1">
            <p className="font-display text-xl font-bold">Your card, on every surface</p>
            <p className="mt-1 text-sm text-white/80">Every product is programmed with your dynamic link, so it always opens your latest vCard. Design it yourself, upload your artwork or let our AI design it.</p>
          </div>
          <ButtonLink as={Link} to="/shop" variant="white">Browse products</ButtonLink>
        </div>
      </motion.div>
      <TableCard title="My orders">
        <DataTable loading={!rows} rows={rows || []} empty={<EmptyState icon={Package} title="No orders yet" description="Your NFC product orders appear here." action={<ButtonLink as={Link} to="/shop"><ShoppingBag />Shop now</ButtonLink>} />} columns={[
          { key: 'no', label: 'Order', render: (o) => <Link to={`/user/orders/${o.id}`} className="block"><p className="font-mono text-xs font-semibold text-primary">{o.order_number}</p><p className="text-xs text-muted-foreground">{fmtDate(o.created_at)}</p></Link> },
          { key: 'it', label: 'Items', render: (o) => <p className="max-w-64 truncate">{(o.items?.length ? o.items : [{ name: o.nfc_card?.name, quantity: o.quantity }]).map((i) => `${i.quantity}x ${i.name}`).join(', ')}</p> },
          { key: 'amt', label: 'Total', render: (o) => <span className="font-semibold">{rs(o.amount)}</span> },
          { key: 'pay', label: 'Payment', render: (o) => (o.is_cod && o.payment_status !== 'paid' ? <Badge tone="warning">Cash on delivery</Badge> : <StatusBadge value={o.payment_status} />) },
          { key: 'st', label: 'Status', render: (o) => <StatusBadge value={o.order_status}>{o.order_status === 'shipped' ? 'Dispatched' : undefined}</StatusBadge> },
          { key: 'tr', label: 'Tracking', render: (o) => (o.tracking_number ? <span className="font-mono text-xs">{o.tracking_number}</span> : '-') },
          { key: '_a', label: '', className: 'text-right', render: (o) => <Actions><Action icon={ExternalLink} label="Details & tracking" to={`/user/orders/${o.id}`} /></Actions> },
        ]} />
      </TableCard>
    </>
  );
}

export function UserOrderDetail() {
  const { id } = useParams();
  const [d, setD] = useState(null);
  useEffect(() => { api.get(`/user/orders/${id}`).then(({ data }) => setD(data)).catch((e) => toast.error(e.message)); }, [id]);
  if (!d) return <Skeleton className="h-[520px] rounded-3xl" />;
  const o = d.data;
  const idx = d.steps.indexOf(o.order_status);
  const terminal = ['cancelled', 'returned'].includes(o.order_status);
  return (
    <>
      <Link to="/user/nfc-orders" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" />My orders</Link>
      <PageHeader eyebrow={fmtDateTime(o.created_at)} title={`Order ${o.order_number}`} description={`${rs(o.amount)} · ${o.is_cod ? 'Cash on delivery' : label(o.payment_type || '')}`}>
        {d.invoice && <ButtonLink href={d.invoice.url} target="_blank" rel="noreferrer" variant="outline"><FileText />Invoice {d.invoice.number}</ButtonLink>}
      </PageHeader>
      <Card className="mb-6">
        <CardBody>
          {terminal ? <p className="rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger">This order was {d.labels[o.order_status].toLowerCase()}.</p> : (
            <ol className="grid gap-4 sm:grid-cols-7">
              {d.steps.map((s, i) => {
                const I = STEP_ICONS[s] || Clock;
                const done = i <= idx;
                const h = (o.status_history || []).filter((x) => x.status === s).pop();
                return (
                  <motion.li key={s} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }} className="flex items-center gap-3 sm:flex-col sm:text-center">
                    <span className={cn('grid size-11 shrink-0 place-items-center rounded-2xl transition', done ? 'bg-primary text-white shadow-glow' : 'bg-muted text-muted-foreground', i === idx && 'ring-4 ring-primary/20')}><I className="size-5" /></span>
                    <div><p className={cn('text-sm font-medium', !done && 'text-muted-foreground')}>{d.labels[s]}</p>{h && <p className="text-[11px] text-muted-foreground">{fmtDate(h.at)}</p>}</div>
                  </motion.li>
                );
              })}
            </ol>
          )}
        </CardBody>
      </Card>
      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <Card>
          <CardHeader icon={Package} title="Items" />
          <CardBody className="space-y-3 text-sm">
            {(o.items || []).map((it) => <div key={it.id} className="flex justify-between gap-3"><span>{it.quantity}x {it.name}{it.variant ? ` · ${it.variant}` : ''}{it.customization ? ' · customised' : ''}</span><span className="font-medium">{rs(it.total)}</span></div>)}
            <div className="space-y-1 border-t border-border pt-3">
              {[['Tax', o.tax_amount], ['Delivery', o.delivery_charges], ['COD charges', o.cod_charges], ['Discount', -o.discount]].filter(([, v]) => Number(v)).map(([k, v]) => <div key={k} className="flex justify-between text-muted-foreground"><span>{k}</span><span>{rs(v)}</span></div>)}
              <div className="flex justify-between text-base font-bold"><span>Total</span><span>{rs(o.amount)}</span></div>
            </div>
            {(o.design_front || o.design_back) && <div className="grid grid-cols-2 gap-3 pt-2">{[o.design_front, o.design_back].filter(Boolean).map((u) => <img key={u} src={u} alt="Design" className="aspect-[1.586] w-full rounded-xl border border-border bg-white object-contain" />)}</div>}
          </CardBody>
        </Card>
        <div className="space-y-6">
          <Card>
            <CardHeader icon={Truck} title="Delivery" />
            <CardBody className="space-y-2 text-sm">
              <p>{o.name}</p><p className="text-muted-foreground">{o.address}{o.city ? `, ${o.city}` : ''}</p>
              {o.tracking_number ? <div className="mt-3 rounded-2xl bg-muted/50 p-4"><p className="text-xs text-muted-foreground">{o.courier === 'leopards' ? 'Leopards Courier' : 'Courier'} tracking</p><p className="font-mono text-lg font-semibold">{o.tracking_number}</p><p>{o.courier_status}</p></div> : <p className="text-muted-foreground">Not dispatched yet.</p>}
            </CardBody>
          </Card>
          {d.links.length > 0 && (
            <Card>
              <CardHeader icon={Link2} title="Programmed link" description="Your products open this link. Change where it goes in Dynamic links." />
              <CardBody className="space-y-2">{d.links.map((l) => <div key={l.id} className="flex items-center justify-between rounded-xl border border-border px-3 py-2 text-sm"><span className="truncate font-mono text-xs">{l.short_url}</span><Link to="/user/short-links" className="text-xs font-medium text-primary">Manage</Link></div>)}</CardBody>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}

/* ================================================================ dynamic links */
export function UserShortLinks() {
  const [d, setD] = useState(null);
  const [vcards, setVcards] = useState([]);
  const [stores, setStores] = useState([]);
  const [editing, setEditing] = useState(null);
  const [claim, setClaim] = useState(false);
  const [stats, setStats] = useState(null);
  const load = () => api.get('/user/short-links').then(({ data }) => setD(data));
  useEffect(() => { load(); api.get('/user/vcards').then(({ data }) => setVcards(data.data)); api.get('/user/stores').then(({ data }) => setStores(data.data)).catch(() => {}); }, []);
  const copy = (t) => { navigator.clipboard?.writeText(t); toast.success('Link copied'); };
  return (
    <>
      <PageHeader title="Dynamic links & QR" description="Your QR codes and NFC products open these links. Change the destination any time - no re-printing needed.">
        <Button variant="outline" onClick={() => setClaim(true)}><Tag />Activate a tag</Button>
        <Tip content={d && !d.enabled ? 'Upgrade your plan to create extra dynamic links' : 'Create a dynamic link'}><span><Button onClick={() => setEditing({})} disabled={d && !d.enabled}><Plus />New link</Button></span></Tip>
      </PageHeader>
      {d && !d.enabled && <div className="mb-6 flex flex-wrap items-center gap-3 rounded-2xl border border-warning/30 bg-warning-soft p-4 text-sm"><Lock className="size-5 text-warning" /><span className="flex-1">Each vCard already has its own dynamic QR link. Extra links to any URL (reviews, menus, socials) are part of plans with the <b>URL shortener</b> feature.</span><ButtonLink as={Link} to="/user/plans" size="sm">See plans</ButtonLink></div>}
      {!d ? <Skeleton className="h-72 rounded-3xl" /> : !d.data.length ? <Card><EmptyState icon={Link2} title="No links yet" description="Open a vCard's QR tab to get its dynamic link, or activate a tag you bought." /></Card> : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {d.data.map((l, i) => (
            <motion.div key={l.id} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.04, 0.3) }}>
              <Card hover className="flex h-full flex-col p-5">
                <div className="flex items-start gap-4">
                  <img src={`/api/user/short-links/${l.id}/qrcode?size=240`} alt="QR code" className="size-20 shrink-0 rounded-xl border border-border bg-white p-1" loading="lazy" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{l.title || l.vcard?.name || l.code}</p>
                    <button type="button" onClick={() => copy(l.short_url)} className="flex max-w-full cursor-pointer items-center gap-1 truncate font-mono text-xs text-primary hover:underline">{l.short_url.replace(/^https?:\/\//, '')}<Copy className="size-3 shrink-0" /></button>
                    <p className="mt-1 truncate text-xs text-muted-foreground">→ {l.target_type === 'url' ? l.target_url : l.vcard ? `vCard /${l.vcard.url_alias}` : l.whatsapp_store ? `Store /s/${l.whatsapp_store.url_alias}` : 'Not activated'}</p>
                  </div>
                </div>
                <div className="mt-4 flex items-center gap-1 border-t border-border pt-3">
                  <Badge tone="outline">{l.clicks} scans</Badge>{l.locked && <Tip content="Managed by the administrator"><Lock className="ml-1 size-3.5 text-muted-foreground" /></Tip>}{!l.status && <Badge tone="danger" className="ml-1">Off</Badge>}
                  <span className="flex-1" />
                  <Tip content="Scan analytics"><Button size="icon-sm" variant="ghost" onClick={() => setStats(l)}><BarChart3 /></Button></Tip>
                  <Tip content="Download QR (PNG)"><ButtonLink size="icon-sm" variant="ghost" href={`/api/user/short-links/${l.id}/qrcode?size=1200&download=1`}><QrCode /></ButtonLink></Tip>
                  {!l.locked && <Tip content="Change destination"><Button size="icon-sm" variant="ghost" onClick={() => setEditing(l)}><Pencil /></Button></Tip>}
                  {!l.locked && !l.nfc_order_id && l.title && <Tip content="Delete"><Button size="icon-sm" variant="ghost" onClick={async () => { if (await confirm({ title: 'Delete this link?', description: 'Printed QR codes using it stop working.' })) { await run(api.delete(`/user/short-links/${l.id}`)).catch(() => {}); load(); } }}><Trash2 /></Button></Tip>}
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
      {editing && <UserLinkForm link={editing} vcards={vcards} stores={stores} canUrl={d?.enabled} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
      {claim && <ClaimTag vcards={vcards} onClose={() => setClaim(false)} onDone={() => { setClaim(false); load(); }} />}
      {stats && <UserLinkStats link={stats} onClose={() => setStats(null)} />}
    </>
  );
}

function UserLinkForm({ link, vcards, stores, canUrl, onClose, onSaved }) {
  const form = useForm({ title: link.title || '', target_type: link.target_type && link.target_type !== 'unassigned' ? link.target_type : (canUrl ? 'url' : 'vcard'), target_url: link.target_url || '', vcard_id: link.vcard_id || vcards[0]?.id || '', store_id: link.store_id || '', status: link.status !== false });
  const [busy, setBusy] = useState(false);
  const v = form.values;
  const save = async () => { setBusy(true); try { await run(link.id ? api.put(`/user/short-links/${link.id}`, v) : api.post('/user/short-links', v)); onSaved(); } catch (e) { form.setErrors(e.errors || {}); } finally { setBusy(false); } };
  const opts = [{ value: 'vcard', label: 'My vCard' }, canUrl && { value: 'url', label: 'Any URL' }, canUrl && stores.length && { value: 'store', label: 'My store' }].filter(Boolean);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} icon={Link2} title={link.id ? 'Change destination' : 'New dynamic link'} description={link.short_url}
      footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={save} loading={busy}>Save</Button></>}>
      <div className="space-y-4">
        <Field label="Title"><Input {...form.input('title')} placeholder="e.g. Google reviews" /></Field>
        <Field label="Opens"><Segmented id="ut" value={v.target_type} onChange={(x) => form.set('target_type', x)} options={opts} /></Field>
        {v.target_type === 'url' && <Field label="URL" error={form.errors.target_url}><Input {...form.input('target_url')} placeholder="https://" /></Field>}
        {v.target_type === 'vcard' && <Field label="vCard" error={form.errors.vcard_id}><Select value={v.vcard_id} onChange={(x) => form.set('vcard_id', x)} options={vcards.map((c) => ({ value: c.id, label: c.name }))} /></Field>}
        {v.target_type === 'store' && <Field label="Store" error={form.errors.store_id}><Select value={v.store_id} onChange={(x) => form.set('store_id', x)} options={stores.map((c) => ({ value: c.id, label: c.name }))} /></Field>}
        <SwitchRow title="Active" description="Switch off to show a 'link inactive' page" checked={v.status} onChange={(x) => form.set('status', x)} />
      </div>
    </Dialog>
  );
}

function ClaimTag({ vcards, onClose, onDone }) {
  const [code, setCode] = useState('');
  const [vcard, setVcard] = useState(vcards[0]?.id || '');
  const [busy, setBusy] = useState(false);
  const save = async () => { setBusy(true); try { await run(api.post('/user/short-links/claim', { code, vcard_id: vcard })); onDone(); } catch { /* toast */ } finally { setBusy(false); } };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} icon={Tag} title="Activate an NFC tag or QR sticker" description="Enter the code printed on the pack (or the last part of its link) to connect it to your card."
      footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={save} loading={busy} disabled={!code || !vcard}>Activate</Button></>}>
      <div className="space-y-4">
        <Field label="Tag code"><Input value={code} onChange={(e) => setCode(e.target.value.trim().split('/').pop())} placeholder="e.g. aB3xK9p" className="font-mono" /></Field>
        <Field label="Open this vCard"><Select value={vcard} onChange={setVcard} options={vcards.map((c) => ({ value: c.id, label: c.name }))} /></Field>
      </div>
    </Dialog>
  );
}

function UserLinkStats({ link, onClose }) {
  const [d, setD] = useState(null);
  useEffect(() => { api.get(`/user/short-links/${link.id}/stats`).then(({ data }) => setD(data)); }, [link.id]);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} size="lg" icon={BarChart3} title="Scans, last 30 days" description={link.short_url}>
      {!d ? <Skeleton className="h-52" /> : (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-3"><Badge tone="primary">{d.total} total</Badge>{d.devices.map((x) => <Badge key={x.name} tone="outline">{label(x.name)}: {x.value}</Badge>)}</div>
          <AreaTrend data={d.daily.map((x) => ({ label: x.date.slice(5), value: x.value }))} name="Scans" height={220} />
        </div>
      )}
    </Dialog>
  );
}

/* ================================================================ invoices */
export function UserInvoices() {
  const [rows, setRows] = useState(null);
  useEffect(() => { api.get('/user/invoices').then(({ data }) => setRows(data.data)); }, []);
  return (
    <>
      <PageHeader title="Invoices" description="Invoices for your orders and plan payments." />
      <TableCard title="All invoices">
        <DataTable loading={!rows} rows={rows || []} empty={<EmptyState icon={FileText} title="No invoices yet" />} columns={[
          { key: 'no', label: 'Invoice', render: (i) => <div><p className="font-mono text-xs font-semibold">{i.number}</p><p className="text-xs text-muted-foreground">{label(i.type)}</p></div> },
          { key: 'd', label: 'Date', render: (i) => fmtDate(i.issue_date) },
          { key: 'due', label: 'Due', render: (i) => fmtDate(i.due_date) },
          { key: 't', label: 'Total', render: (i) => <span className="font-semibold">{rs(i.total, i.currency_icon)}</span> },
          { key: 's', label: 'Status', render: (i) => <StatusBadge value={i.status} /> },
          { key: '_a', label: '', className: 'text-right', render: (i) => <Actions><Action icon={ExternalLink} label="Open" href={i.url} target="_blank" rel="noreferrer" /><Action icon={FileText} label="PDF" href={`${i.url}/pdf`} target="_blank" rel="noreferrer" /></Actions> },
        ]} />
      </TableCard>
    </>
  );
}
