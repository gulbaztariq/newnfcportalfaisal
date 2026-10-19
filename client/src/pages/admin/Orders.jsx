/* Admin: orders (shop + portal + manual) with workflow, Leopards courier, invoices, NFC writing; products with costing */
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { motion } from 'motion/react';
import { toast } from 'sonner';
import {
  Package, Eye, Nfc, Plus, Truck, RefreshCw, FileText, MessageCircle, Check, Clock, Palette, Printer, PackageCheck, Home, Undo2, XCircle, ArrowLeft,
  ExternalLink, Copy, Link2, Trash2, Pencil, Boxes, ShoppingBag, Search, Phone, MapPin, Mail, Banknote, Calculator, Sparkles, Upload, Download, Store, Globe, IdCard, UserRound, Building2, Repeat, Wand2,
} from 'lucide-react';
import CrudPage from '@/components/CrudPage';
import api, { toFormData } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/cn';
import { fmtDate, fmtDateTime, label } from '@/lib/format';
import {
  PageHeader, TableCard, DataTable, SearchInput, FilterSelect, Action, Actions, Dialog, Sheet, Button, ButtonLink, Field, Input, Textarea, Select, Switch, SwitchRow,
  ImageUpload, Badge, StatusBadge, EmptyState, Card, CardHeader, CardBody, Skeleton, Tip, useList, useForm, run, confirm,
} from '@/components/ui';

export const rs = (v, cur = 'Rs') => `${cur} ${Number(v || 0).toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
const STEP_ICONS = { pending: Clock, confirmed: Check, designing: Palette, printing: Printer, ready: PackageCheck, shipped: Truck, delivered: Home, returned: Undo2, cancelled: XCircle, processing: RefreshCw };
const ORDER_TYPE_LABEL = { nfc_profile: 'NFC card + profile', social: 'Social / review card', wholesale: 'Wholesale', sample: 'Samples', printing: 'Printing only', digital: 'Digital profile' };
const SOURCE = { shop: ['Website', 'primary'], portal: ['Portal', 'info'], admin: ['Manual', 'neutral'] };
/** who created the order: the staff member, otherwise the customer (website / portal) */
const createdBy = (o) => (o.creator ? `${o.creator.first_name} ${o.creator.last_name}`.trim() : o.source === 'admin' ? 'Staff' : 'Customer');
const discountLabel = (o) => `Discount${o.discount_type === 'percent' ? ` (${Number(o.discount_value)}%)` : ''}`;
const paymentLabel = (o) => (o.is_cod ? 'Cash on delivery' : o.payment_type === 'collection' ? 'Pay at collection' : label(o.payment_type || 'manual'));

/* ================================================================ list */
export function Orders() {
  const list = useList('/admin/orders');
  const [meta, setMeta] = useState({ counts: {}, labels: {}, steps: [] });
  const [syncing, setSyncing] = useState(false);
  const [sources, setSources] = useState([]);
  const navigate = useNavigate();
  useEffect(() => { api.get('/admin/order-sources', { params: { all: 1 } }).then(({ data }) => setSources(data.data)).catch(() => {}); }, []);
  useEffect(() => { if (list.extra?.counts) setMeta({ counts: list.extra.counts, labels: list.extra.labels, steps: list.extra.steps }); }, [list.extra]);
  const status = list.params.order_status || '';
  const tabs = [['', 'All'], ...['pending', 'confirmed', 'designing', 'printing', 'ready', 'shipped', 'delivered', 'returned', 'cancelled'].map((s) => [s, meta.labels[s] || label(s)])];
  const sync = async () => { setSyncing(true); await run(api.post('/admin/courier/sync')).catch(() => {}); setSyncing(false); list.reload(); };
  return (
    <>
      <PageHeader title="Orders" description="Website shop, portal and manual orders: design, printing, Leopards dispatch, delivery and payment in one place.">
        <Tip content="Refresh Leopards tracking for every dispatched order"><Button variant="outline" onClick={sync} loading={syncing}><RefreshCw />Sync courier</Button></Tip>
        <ButtonLink as={Link} to="/admin/order-sources" variant="outline"><Globe />Order sources</ButtonLink>
        <ButtonLink as={Link} to="/admin/orders/new"><Plus />New order</ButtonLink>
      </PageHeader>
      <div className="-mx-1 mb-4 flex gap-1.5 overflow-x-auto px-1 pb-1">
        {tabs.map(([k, l]) => (
          <button key={k || 'all'} type="button" onClick={() => list.set({ order_status: k })} className={cn('flex shrink-0 cursor-pointer items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-medium transition', status === k ? 'border-primary bg-primary text-white shadow-glow' : 'border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground')}>
            {l}{k && meta.counts[k] ? <span className={cn('rounded-full px-1.5 text-[11px]', status === k ? 'bg-white/25' : 'bg-muted')}>{meta.counts[k]}</span> : null}
          </button>
        ))}
      </div>
      <TableCard title="Orders" list={list} toolbar={<>
        <FilterSelect value={list.params.source} onChange={(v) => list.set({ source: v })} placeholder="All channels" options={[{ value: 'shop', label: 'Website shop' }, { value: 'portal', label: 'User portal' }, { value: 'admin', label: 'Manual (staff)' }]} />
        {sources.length > 0 && <FilterSelect value={list.params.order_source_id} onChange={(v) => list.set({ order_source_id: v })} placeholder="All order sources" options={sources.map((x) => ({ value: x.id, label: x.name }))} />}
        <FilterSelect value={list.params.customer} onChange={(v) => list.set({ customer: v })} placeholder="All customers" options={[{ value: 'registered', label: 'Registered customers' }, { value: 'organisation', label: 'Organisations' }, { value: 'guest', label: 'Guests' }]} />
        <FilterSelect value={list.params.order_type} onChange={(v) => list.set({ order_type: v })} placeholder="All order types" options={Object.entries(ORDER_TYPE_LABEL).map(([value, label]) => ({ value, label }))} />
        <FilterSelect value={list.params.fulfilment} onChange={(v) => list.set({ fulfilment: v })} placeholder="Delivery / collection" options={[{ value: 'delivery', label: 'Courier delivery' }, { value: 'collection', label: 'Office collection' }]} />
        <FilterSelect value={list.params.is_cod} onChange={(v) => list.set({ is_cod: v })} placeholder="COD / prepaid" options={[{ value: '1', label: 'Cash on delivery' }, { value: '0', label: 'Prepaid / online' }]} />
        <FilterSelect value={list.params.payment_status} onChange={(v) => list.set({ payment_status: v })} placeholder="Payment" options={[{ value: 'pending', label: 'Pending' }, { value: 'paid', label: 'Paid' }, { value: 'rejected', label: 'Rejected' }]} />
        <SearchInput value={list.params.search} onChange={(search) => list.set({ search })} placeholder="Order, name, phone, tracking..." />
      </>}>
        <DataTable loading={list.loading} rows={list.rows} onRowClick={(o) => navigate(`/admin/orders/${o.id}`)} empty={<EmptyState icon={ShoppingBag} title="No orders yet" description="Orders from the website shop and the user portal appear here." />} columns={[
          { key: 'no', label: 'Order', render: (o) => <div><p className="font-mono text-xs font-semibold text-primary">{o.order_number}</p><p className="text-xs text-muted-foreground">{fmtDateTime(o.created_at)}</p>{o.order_type && o.order_type !== 'nfc_profile' && <Badge tone={o.order_type === 'wholesale' ? 'success' : o.order_type === 'sample' ? 'warning' : 'info'} className="mt-1">{ORDER_TYPE_LABEL[o.order_type]}</Badge>}</div> },
          { key: 'cust', label: 'Customer', render: (o) => <div><p className="font-medium">{o.name}</p><p className="text-xs text-muted-foreground">{o.phone}{o.city ? ` · ${o.city}` : ''}</p>{o.organisation_id ? <Badge tone="primary" className="mt-0.5"><Building2 className="size-3" />{o.organisation?.organisation?.name || 'Organisation'}</Badge> : o.guest_customer_id ? <Badge tone="info" className="mt-0.5"><UserRound className="size-3" />Guest</Badge> : null}</div> },
          { key: 'items', label: 'Items', render: (o) => <div className="max-w-56"><p className="truncate">{(o.items?.length ? o.items : [{ name: o.nfc_card?.name, quantity: o.quantity }]).map((i) => `${i.quantity}x ${i.name}`).join(', ')}</p><p className="text-xs text-muted-foreground">{o.design_type !== 'standard' ? `${label(o.design_type)} design` : 'Standard design'}</p></div> },
          { key: 'amt', label: 'Total', render: (o) => <div><p className="font-semibold">{rs(o.amount)}</p><p className="flex flex-wrap gap-1 text-xs">{o.is_cod ? <Badge tone="warning">COD</Badge> : <StatusBadge value={o.payment_status} />}{o.fulfilment === 'collection' && <Badge tone="info"><Store className="size-3" />Collection</Badge>}</p></div> },
          { key: 'src', label: 'Source', render: (o) => { const [l, t] = SOURCE[o.source] || SOURCE.portal; return <div className="space-y-0.5"><Badge tone={t}>{l}</Badge>{o.order_source && <p className="max-w-32 truncate text-xs text-muted-foreground">{o.order_source.name}</p>}</div>; } },
          { key: 'by', label: 'Created by', render: (o) => <span className={cn('text-sm', !o.creator && 'text-muted-foreground')}>{createdBy(o)}</span> },
          { key: 'st', label: 'Status', render: (o) => <StatusBadge value={o.order_status}>{meta.labels[o.order_status]}</StatusBadge> },
          { key: 'cr', label: 'Courier', render: (o) => (o.tracking_number ? <div><p className="font-mono text-xs">{o.tracking_number}</p><p className="max-w-36 truncate text-xs text-muted-foreground">{o.courier_status}</p></div> : <span className="text-xs text-muted-foreground">Not booked</span>) },
          { key: '_a', label: '', className: 'text-right', render: (o) => <Actions><Action icon={Eye} label="Open order" to={`/admin/orders/${o.id}`} /></Actions> },
        ]} />
      </TableCard>
    </>
  );
}

/* ================================================================ detail */
export function OrderDetail() {
  const { id } = useParams();
  const { settings } = useAuth();
  const [d, setD] = useState(null);
  const [cities, setCities] = useState(null);
  const [busy, setBusy] = useState('');
  const [note, setNote] = useState('');
  const [vendorId, setVendorId] = useState('');
  const load = () => api.get(`/admin/orders/${id}`).then(({ data }) => setD(data));
  useEffect(() => { load(); }, [id]); // eslint-disable-line
  const o = d?.data;
  const act = async (key, fn) => { setBusy(key); try { await fn(); await load(); } catch { /* toast shown */ } finally { setBusy(''); } };
  const patch = (body, msg) => act('patch', () => run(api.patch(`/admin/orders/${id}`, body), msg));
  const setStatus = (order_status) => act(order_status, () => run(api.patch(`/admin/orders/${id}`, { order_status, note: note || undefined, stock_vendor_id: vendorId || undefined }), `Order moved to ${d.labels[order_status]}`).then(() => setNote('')));
  const loadCities = () => { if (!cities) api.get('/admin/courier/cities').then(({ data }) => setCities(data.data)).catch((e) => { setCities([]); toast.error(e.message); }); };
  const copy = (t, msg = 'Copied') => { navigator.clipboard?.writeText(t); toast.success(msg); };
  const writeNfc = async () => {
    let link = d.links[0];
    if (!link) { const r = await run(api.post(`/admin/orders/${id}/short-link`, {})); link = r.data; await load(); }
    const url = link.short_url;
    if (!('NDEFReader' in window)) { copy(url, 'Dynamic link copied - write it with any NFC writer app (Web NFC needs Chrome on Android)'); return; }
    try {
      const ndef = new window.NDEFReader();
      toast.loading('Hold the NFC chip near your phone...', { id: 'nfc' });
      await ndef.write({ records: [{ recordType: 'url', data: url }] });
      await api.patch(`/admin/orders/${id}`, { nfc_written: true });
      toast.success('NFC chip written with the dynamic link', { id: 'nfc' }); load();
    } catch (e) { toast.error(`NFC write failed: ${e.message}`, { id: 'nfc' }); }
  };
  if (!d) return <Skeleton className="h-[640px] rounded-3xl" />;
  const idx = d.steps.indexOf(o.order_status);
  const terminal = ['cancelled', 'returned'].includes(o.order_status);
  const next = !terminal && idx >= 0 && idx < d.steps.length - 1 ? d.steps[idx + 1] : null;
  const items = o.items?.length ? o.items : [{ id: 0, name: o.nfc_card?.name || 'NFC card', quantity: o.quantity, unit_price: o.unit_price, total: o.amount }];
  return (
    <>
      <Link to="/admin/orders" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" />All orders</Link>
      <PageHeader eyebrow={`${SOURCE[o.source]?.[0] || 'Portal'} order${o.order_source ? ` · ${o.order_source.name}` : ''}${o.order_type && o.order_type !== 'nfc_profile' ? ` · ${ORDER_TYPE_LABEL[o.order_type]}` : ''}${Number(o.sample_credit) > 0 ? ` · sample credit ${Number(o.sample_credit)}` : ''} · ${fmtDateTime(o.created_at)} · by ${createdBy(o)}`} title={o.order_number} description={`${o.name} · ${rs(o.amount)} · ${paymentLabel(o)}${o.fulfilment === 'collection' ? ' · Office collection' : ''}`}>
        <Tip content="Same items and prices, straight to review"><ButtonLink as={Link} to={`/admin/orders/new?reorder=${o.id}`} variant="outline"><Repeat />Reorder</ButtonLink></Tip>
        <Tip content="Start from this order and change products, quantities or prices"><ButtonLink as={Link} to={`/admin/orders/new?reorder=${o.id}&edit=1`} variant="outline"><Wand2 />Reorder &amp; customise</ButtonLink></Tip>
        <Tip content="Copy the customer's tracking link"><Button variant="outline" onClick={() => copy(d.track_url, 'Tracking link copied')}><Copy />Tracking link</Button></Tip>
        {d.invoice ? <ButtonLink as={Link} to={`/admin/invoices/${d.invoice.id}`} variant="outline"><FileText />{d.invoice.number}</ButtonLink>
          : <Button variant="outline" loading={busy === 'inv'} onClick={() => act('inv', () => run(api.post(`/admin/orders/${id}/invoice`)))}><FileText />Create invoice</Button>}
        <Tip content="Write the order's dynamic link to an NFC chip"><Button variant="soft" onClick={writeNfc}><Nfc />{o.nfc_written ? 'Re-write NFC' : 'Write NFC'}</Button></Tip>
      </PageHeader>

      {/* workflow stepper */}
      <Card className="mb-6 overflow-hidden">
        <CardBody>
          <div className="flex items-center gap-1 overflow-x-auto pb-2">
            {d.steps.map((s, i) => {
              const I = STEP_ICONS[s] || Clock;
              const done = !terminal && i <= idx;
              const hist = (o.status_history || []).filter((h) => h.status === s).pop();
              return (
                <div key={s} className="flex min-w-24 flex-1 items-center gap-1">
                  <Tip content={hist ? `${d.labels[s]} · ${fmtDateTime(hist.at)}${hist.by ? ` · ${hist.by}` : ''}` : `Move to ${d.labels[s]}`}>
                    <button type="button" disabled={!!busy || i === idx} onClick={() => setStatus(s)} className="group flex flex-col items-center gap-1.5 text-center">
                      <motion.span initial={false} animate={{ scale: i === idx ? 1.1 : 1 }} className={cn('grid size-11 cursor-pointer place-items-center rounded-2xl border-2 transition', done ? 'border-primary bg-primary text-white shadow-glow' : 'border-border bg-card text-muted-foreground group-hover:border-primary/50')}>
                        <I className="size-5" />
                      </motion.span>
                      <span className={cn('text-xs font-medium', done ? 'text-foreground' : 'text-muted-foreground')}>{d.labels[s]}</span>
                    </button>
                  </Tip>
                  {i < d.steps.length - 1 && <span className={cn('mb-5 h-0.5 flex-1 rounded-full', !terminal && i < idx ? 'bg-primary' : 'bg-border')} />}
                </div>
              );
            })}
          </div>
          {terminal && <p className="mt-2 rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger">This order is {d.labels[o.order_status].toLowerCase()}.{o.stock_consumed ? '' : ' Stock was returned to inventory.'}</p>}
          <div className="mt-4 flex flex-wrap items-end gap-2 border-t border-border pt-4">
            <Field label="Note for this step (optional)" className="min-w-56 flex-1"><Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Sent for printing at vendor" /></Field>
            {!o.stock_consumed && (
              <Field label="Take stock from" className="w-52"><Select value={vendorId} onChange={setVendorId} placeholder="Main store" options={[{ value: '', label: 'Main store' }, ...d.vendors.map((v) => ({ value: v.id, label: v.name }))]} /></Field>
            )}
            {next && <Button onClick={() => setStatus(next)} loading={busy === next}>Move to {d.labels[next]}</Button>}
            {!terminal && <Button variant="danger-soft" onClick={async () => { if (await confirm({ title: 'Cancel this order?', description: 'Stock taken for it goes back to inventory.', confirmText: 'Cancel order' })) setStatus('cancelled'); }}>Cancel</Button>}
            {o.order_status === 'shipped' && <Button variant="outline" onClick={() => setStatus('returned')}>Mark returned</Button>}
          </div>
        </CardBody>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader icon={Package} title="Items" description={o.stock_consumed ? `Stock taken · cost ${rs(o.cost_amount)} · profit ${rs(o.amount - o.tax_amount - o.cost_amount - o.courier_charges)}` : 'Stock is taken from inventory when the order is dispatched'} />
            <CardBody className="p-0">
              <table className="w-full text-sm">
                <tbody className="divide-y divide-border">
                  {items.map((it) => (
                    <tr key={it.id}>
                      <td className="px-5 py-3"><p className="font-medium">{it.name}{it.variant ? ` · ${it.variant}` : ''}</p>{it.customization && <p className="text-xs text-primary">+ customisation {rs(it.customization_price)} / pc</p>}</td>
                      <td className="px-5 py-3 text-right text-muted-foreground">{it.quantity} x {rs(it.unit_price)}</td>
                      <td className="px-5 py-3 text-right font-semibold">{rs(it.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="space-y-1 border-t border-border px-5 py-4 text-sm">
                {[['Subtotal', o.subtotal], [discountLabel(o), -o.discount], ['Tax', o.tax_amount], ['Delivery', o.delivery_charges], ['COD charges', o.cod_charges]].filter(([, v]) => Number(v)).map(([k, v]) => <div key={k} className={cn('flex justify-between', v < 0 && 'font-medium text-success')}><span className={v < 0 ? '' : 'text-muted-foreground'}>{k}</span><span>{rs(v)}</span></div>)}
                <div className="flex justify-between pt-1 text-base font-bold"><span>Total</span><span>{rs(o.amount)}</span></div>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader icon={Palette} title="Design" description={o.design_type === 'ai' ? 'Designed by the customer with AI' : o.design_type === 'upload' ? 'Customer uploaded their own design' : 'Standard design'} />
            <CardBody className="space-y-4">
              {(o.design_front || o.design_back) && (
                <div className="grid gap-3 sm:grid-cols-2">
                  {[['Front', o.design_front], ['Back', o.design_back]].filter(([, u]) => u).map(([k, u]) => (
                    <a key={k} href={u} target="_blank" rel="noreferrer" className="group block overflow-hidden rounded-2xl border border-border bg-muted/40 p-2">
                      <img src={u} alt={`${k} design`} className="aspect-[1.586] w-full rounded-xl bg-white object-contain" />
                      <span className="mt-1.5 flex items-center justify-between px-1 text-xs text-muted-foreground">{k}<Download className="size-3.5 opacity-0 transition group-hover:opacity-100" /></span>
                    </a>
                  ))}
                </div>
              )}
              {o.design_file && <ButtonLink href={o.design_file} target="_blank" rel="noreferrer" variant="outline" size="sm"><Upload />Open uploaded design file</ButtonLink>}
              {o.logo && <img src={o.logo} alt="Logo" className="max-h-28 rounded-2xl border border-border" />}
              {(o.design_prompt || o.customer_note) && <div className="rounded-2xl bg-muted/50 p-4 text-sm whitespace-pre-wrap"><p className="mb-1 text-xs font-semibold text-muted-foreground">Customer notes</p>{o.design_prompt || ''}{o.design_prompt && o.customer_note ? '\n\n' : ''}{o.customer_note || ''}</div>}
              {!o.design_front && !o.design_file && !o.design_prompt && !o.customer_note && <p className="text-sm text-muted-foreground">No design files or notes.</p>}
            </CardBody>
          </Card>

          <Card>
            <CardHeader icon={MessageCircle} title="WhatsApp / SMS" description="Every step can notify the customer (Settings > WhatsApp & SMS)"
              actions={<Tip content="Send the message for the current step again"><Button size="xs" variant="outline" loading={busy === 'notify'} onClick={() => act('notify', () => run(api.post(`/admin/orders/${id}/notify`, {})))}><MessageCircle />Resend</Button></Tip>} />
            <CardBody className="p-0">
              {!d.messages.length ? <p className="px-5 py-4 text-sm text-muted-foreground">No messages yet.</p> : (
                <ul className="divide-y divide-border">
                  {d.messages.map((m) => (
                    <li key={m.id} className="flex items-start gap-3 px-5 py-3 text-sm">
                      <Badge tone={m.channel === 'whatsapp' ? 'success' : 'info'}>{m.channel === 'whatsapp' ? 'WhatsApp' : 'SMS'}</Badge>
                      <div className="min-w-0 flex-1"><p className="truncate">{m.body}</p><p className="text-xs text-muted-foreground">+{m.to} · {label(m.event)} · {fmtDateTime(m.created_at)}{m.error ? ` · ${m.error}` : ''}</p></div>
                      <StatusBadge value={m.status} />
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader icon={Phone} title="Customer" />
            <CardBody className="space-y-2.5 text-sm">
              <p className="font-semibold">{o.name}{o.company_name ? ` · ${o.company_name}` : ''}</p>
              {o.phone ? <>
                <a href={`tel:${o.phone}`} className="flex items-center gap-2 hover:text-primary"><Phone className="size-4 text-muted-foreground" />{o.phone}</a>
                <a href={`https://wa.me/${String(o.phone || '').replace(/\D/g, '').replace(/^0/, '92')}`} target="_blank" rel="noreferrer" className="flex items-center gap-2 hover:text-primary"><MessageCircle className="size-4 text-muted-foreground" />Chat on WhatsApp</a>
              </> : <p className="flex items-center gap-2 text-muted-foreground"><Phone className="size-4" />No phone number</p>}
              {o.email && <a href={`mailto:${o.email}`} className="flex items-center gap-2 hover:text-primary"><Mail className="size-4 text-muted-foreground" />{o.email}</a>}
              {(o.address || o.city) ? <p className="flex items-start gap-2"><MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" />{[o.address, o.city].filter(Boolean).join(', ')}</p> : <p className="flex items-center gap-2 text-muted-foreground"><MapPin className="size-4" />No address</p>}
              <p className="flex items-center gap-2 border-t border-border pt-2.5 text-muted-foreground"><UserRound className="size-4" />Created by <span className="font-medium text-foreground">{createdBy(o)}</span></p>
              {o.order_source && <p className="flex items-center gap-2 text-muted-foreground"><Globe className="size-4" />Source <span className="font-medium text-foreground">{o.order_source.name}</span></p>}
              {o.organisation_id && <p className="flex items-center gap-2 text-muted-foreground"><Building2 className="size-4" />Organisation <Link to={`/admin/users/${o.organisation_id}`} className="font-medium text-primary hover:underline">{o.organisation?.organisation?.name || 'Open'}</Link></p>}
              {o.guest_customer_id && <p className="flex items-center gap-2 text-muted-foreground"><UserRound className="size-4" />Guest customer <Link to={`/admin/guest-customers/${o.guest_customer_id}`} className="font-medium text-primary hover:underline">journey</Link></p>}
              {o.user && <p className="text-muted-foreground">{o.organisation_id ? 'Contact' : 'Account'}: <Link to={`/admin/users/${o.user.id}`} className="text-primary hover:underline">{o.user.email}</Link></p>}
              {o.vcard && <p className="text-muted-foreground">vCard: <a href={`${settings.app_url}/${o.vcard.url_alias}`} target="_blank" rel="noreferrer" className="text-primary hover:underline">/{o.vcard.url_alias}</a></p>}
            </CardBody>
          </Card>

          {o.fulfilment === 'collection' && (
            <Card className="border-info/30">
              <CardHeader icon={Store} title="Office collection" description="The customer collects this order from the office - no courier needed" />
              <CardBody className="text-sm text-muted-foreground">Move the order to <b className="text-foreground">Delivered</b> when it is collected{o.payment_type === 'collection' ? '; the payment is then marked as paid' : ''}.</CardBody>
            </Card>
          )}
          {o.fulfilment !== 'collection' && <Card>
            <CardHeader icon={Truck} title="Courier" description={o.courier === 'leopards' ? 'Leopards Courier' : 'Book with Leopards or enter a tracking number'} />
            <CardBody className="space-y-4">
              {o.tracking_number ? (
                <>
                  <div className="flex items-center justify-between rounded-2xl bg-muted/50 p-4">
                    <div><p className="text-xs text-muted-foreground">Tracking number</p><p className="font-mono text-lg font-semibold">{o.tracking_number}</p><p className="text-sm">{o.courier_status || '-'}{o.courier_status_at ? <span className="text-muted-foreground"> · {fmtDateTime(o.courier_status_at)}</span> : null}</p></div>
                    <Tip content="Copy"><Button variant="ghost" size="icon" onClick={() => copy(o.tracking_number)}><Copy /></Button></Tip>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {o.courier === 'leopards' && <Button size="sm" variant="outline" loading={busy === 'track'} onClick={() => act('track', () => run(api.post(`/admin/orders/${id}/courier/track`)))}><RefreshCw />Live status</Button>}
                    {o.courier_slip && <ButtonLink size="sm" variant="outline" href={o.courier_slip} target="_blank" rel="noreferrer"><Printer />Airway bill</ButtonLink>}
                    {o.courier === 'leopards' && o.order_status !== 'delivered' && <Button size="sm" variant="danger-soft" onClick={async () => { if (await confirm({ title: 'Cancel the Leopards booking?', confirmText: 'Cancel booking' })) act('cancel', () => run(api.post(`/admin/orders/${id}/courier/cancel`))); }}>Cancel booking</Button>}
                  </div>
                  {o.courier_history?.length > 0 && (
                    <ol className="relative ml-2 space-y-3 border-l border-border pl-5 text-sm">
                      {[...o.courier_history].reverse().slice(0, 12).map((h, i) => (
                        <li key={i}><span className={cn('absolute -left-1.5 mt-1 size-3 rounded-full border-2 border-card', i === 0 ? 'bg-primary' : 'bg-border')} /><p className="font-medium">{h.status}</p><p className="text-xs text-muted-foreground">{h.at}{h.reason ? ` · ${h.reason}` : ''}</p></li>
                      ))}
                    </ol>
                  )}
                </>
              ) : (
                <>
                  <Field label="Destination city (Leopards)" hint={cities === null ? 'Click to load the Leopards city list' : undefined}>
                    <div onFocusCapture={loadCities} onPointerDown={loadCities}>
                      <Select value={o.courier_city_id || ''} onChange={(v) => patch({ courier_city_id: v, city: cities?.find((c) => c.id === v)?.name || o.city }, 'City saved')} placeholder={o.city || 'Select city'} options={(cities || []).filter((c) => c.destination).map((c) => ({ value: c.id, label: c.name }))} />
                    </div>
                  </Field>
                  <Button className="w-full" loading={busy === 'book'} onClick={() => act('book', () => run(api.post(`/admin/orders/${id}/courier/book`, { stock_vendor_id: vendorId || undefined })))}><Truck />Book with Leopards &amp; dispatch</Button>
                  <ManualTracking onSave={(t, c) => patch({ tracking_number: t, courier: c || 'other' }, 'Tracking saved')} />
                </>
              )}
              <Field label="Courier charges (for profit)" hint="Filled from Leopards when available">
                <Input type="number" min="0" defaultValue={o.courier_charges} onBlur={(e) => Number(e.target.value) !== Number(o.courier_charges) && patch({ courier_charges: e.target.value }, 'Charges saved')} />
              </Field>
            </CardBody>
          </Card>}

          <Card>
            <CardHeader icon={Banknote} title="Payment" />
            <CardBody className="space-y-3">
              <div className="flex items-center justify-between text-sm"><span className="text-muted-foreground">Method</span><span className="font-medium">{paymentLabel(o)}</span></div>
              <div className="flex items-center justify-between text-sm"><span className="text-muted-foreground">Status</span><Select className="w-36" value={o.payment_status} onChange={(v) => patch({ payment_status: v }, 'Payment updated')} options={['pending', 'paid', 'rejected'].map((v) => ({ value: v, label: label(v) }))} /></div>
              {o.is_cod && <SwitchRow title="COD settled by courier" description="Leopards has paid this amount to you" checked={o.cod_settled} onChange={(v) => patch({ cod_settled: v }, 'Updated')} />}
            </CardBody>
          </Card>

          <Card>
            <CardHeader icon={Link2} title="Dynamic links" description="QR / NFC links of this order - change their destination any time" actions={<Button size="xs" variant="outline" onClick={() => act('link', () => run(api.post(`/admin/orders/${id}/short-link`, {})))}><Plus />Add</Button>} />
            <CardBody className="space-y-2">
              {!d.links.length && <p className="text-sm text-muted-foreground">No link yet. One is created when you write the NFC chip.</p>}
              {d.links.map((l) => (
                <div key={l.id} className="flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm">
                  <span className="min-w-0 flex-1 truncate font-mono text-xs">{l.short_url}</span>
                  <Tip content="Copy"><Button size="icon-sm" variant="ghost" onClick={() => copy(l.short_url)}><Copy /></Button></Tip>
                  <Tip content="Edit destination"><ButtonLink as={Link} size="icon-sm" variant="ghost" to={`/admin/short-links?search=${l.code}`}><Pencil /></ButtonLink></Tip>
                </div>
              ))}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Internal note" />
            <CardBody><Textarea rows={3} defaultValue={o.admin_note || ''} onBlur={(e) => e.target.value !== (o.admin_note || '') && patch({ admin_note: e.target.value }, 'Note saved')} placeholder="Only visible to staff" /></CardBody>
          </Card>
          {d.movements.length > 0 && (
            <Card>
              <CardHeader icon={Boxes} title="Stock movements" />
              <CardBody className="space-y-1.5 text-sm">
                {d.movements.map((m) => <div key={m.id} className="flex justify-between"><span>{m.item?.name} <span className="text-muted-foreground">@ {m.location?.name || 'Main store'}</span></span><span className={Number(m.quantity) < 0 ? 'text-danger' : 'text-success'}>{Number(m.quantity) > 0 ? '+' : ''}{Number(m.quantity)}</span></div>)}
              </CardBody>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}

function ManualTracking({ onSave }) {
  const [t, setT] = useState('');
  const [c, setC] = useState('');
  return (
    <div className="rounded-2xl border border-dashed border-border p-3">
      <p className="mb-2 text-xs font-medium text-muted-foreground">Other courier / manual</p>
      <div className="flex gap-2"><Input value={c} onChange={(e) => setC(e.target.value)} placeholder="Courier" className="w-28" /><Input value={t} onChange={(e) => setT(e.target.value)} placeholder="Tracking no." /><Button variant="outline" onClick={() => t && onSave(t, c)} disabled={!t}>Save</Button></div>
    </div>
  );
}

/* ================================================================ products */
const blankProduct = { plan_id: '', name: '', category: '', sku: '', price: '', compare_price: '', customization_price: 0, size_label: '', short_description: '', description: '', variants: [], featured: false, show_in_shop: true, status: true, sort: 0, weight_grams: 50, extra_cost: 0, track_stock: true, front_image: null, back_image: null };

export function Products() {
  const [rows, setRows] = useState(null);
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState(null);
  const [costing, setCosting] = useState(null);
  const load = () => api.get('/admin/nfc-cards', { params: { all: 1 } }).then(({ data }) => setRows(data.data));
  useEffect(() => { load(); }, []);
  const toggle = async (p, k, v) => { setRows((r) => r.map((x) => (x.id === p.id ? { ...x, [k]: v } : x))); await run(api.put(`/admin/nfc-cards/${p.id}`, { ...p, variants: JSON.stringify(p.variants || []), [k]: v, front_image: undefined, back_image: undefined })).catch(load); };
  const remove = async (p) => { if (await confirm({ title: `Delete ${p.name}?` })) { await run(api.delete(`/admin/nfc-cards/${p.id}`)).catch(() => {}); load(); } };
  const shown = (rows || []).filter((p) => !q || `${p.name} ${p.category} ${p.sku}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <>
      <PageHeader title="Products" description="NFC cards, standees, tags, keyrings and more - shown in the website shop and in user NFC orders.">
        <SearchInput value={q} onChange={setQ} placeholder="Search products..." />
        <ButtonLink href="/shop" target="_blank" rel="noreferrer" variant="outline"><ExternalLink />View shop</ButtonLink>
        <Button onClick={() => setEditing(blankProduct)}><Plus />Add product</Button>
      </PageHeader>
      {!rows ? <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-80 rounded-3xl" />)}</div> : !shown.length ? <Card><EmptyState icon={Package} title="No products" action={<Button onClick={() => setEditing(blankProduct)}><Plus />Add product</Button>} /></Card> : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {shown.map((p, i) => (
            <motion.div key={p.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.03, 0.3) }}>
              <Card hover className={cn('group flex h-full flex-col overflow-hidden', !p.status && 'opacity-60')}>
                <div className="relative aspect-[4/3] bg-linear-to-br from-violet-500/10 to-fuchsia-500/10">
                  {p.front_image ? <img src={p.front_image} alt="" className="size-full object-cover transition duration-500 group-hover:scale-105" /> : <div className="grid size-full place-items-center"><Nfc className="size-12 text-primary/40" /></div>}
                  <div className="absolute top-3 left-3 flex gap-1.5">{p.category && <Badge className="bg-card/90 shadow">{p.category}</Badge>}{p.featured && <Badge tone="primary" className="shadow"><Sparkles className="size-3" />Featured</Badge>}</div>
                  {!p.show_in_shop && <Badge tone="warning" className="absolute top-3 right-3 shadow">Hidden in shop</Badge>}
                </div>
                <div className="flex flex-1 flex-col p-4">
                  <p className="font-display font-semibold leading-snug">{p.name}</p>
                  <p className="text-xs text-muted-foreground">{p.size_label || '-'}{p.sku ? ` · ${p.sku}` : ''}</p>
                  <div className="mt-2 flex items-baseline gap-2"><span className="text-lg font-bold">{rs(p.price)}</span>{Number(p.compare_price) > Number(p.price) && <span className="text-sm text-muted-foreground line-through">{rs(p.compare_price)}</span>}</div>
                  {Number(p.customization_price) > 0 && <p className="text-xs text-primary">Customisation +{rs(p.customization_price)}</p>}
                  {p.variants?.length > 0 && <p className="text-xs text-muted-foreground">Options: {p.variants.map((v) => v.name).join(', ')}</p>}
                  <p className="mt-1.5">{p.plan ? <Badge tone="primary"><IdCard className="size-3" />Plan: {p.plan.name}</Badge> : <Badge tone="neutral">Non-plan product</Badge>}</p>
                  <div className="mt-auto flex items-center gap-2 pt-4">
                    <Tip content="Visible in the shop"><span><Switch size="sm" checked={p.show_in_shop} onChange={(v) => toggle(p, 'show_in_shop', v)} /></span></Tip>
                    <span className="flex-1" />
                    <Tip content="Costing: inventory components + printing cost"><Button size="icon-sm" variant="ghost" onClick={() => setCosting(p)}><Calculator /></Button></Tip>
                    <Tip content="Edit"><Button size="icon-sm" variant="ghost" onClick={() => setEditing(p)}><Pencil /></Button></Tip>
                    <Tip content="Delete"><Button size="icon-sm" variant="ghost" onClick={() => remove(p)}><Trash2 /></Button></Tip>
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
      {editing && <ProductForm product={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
      {costing && <ProductCosting product={costing} onClose={() => setCosting(null)} onSaved={load} />}
    </>
  );
}

function ProductForm({ product, onClose, onSaved }) {
  const form = useForm({ ...blankProduct, ...product, plan_id: product.plan_id || '', variants: product.variants || [] });
  const [busy, setBusy] = useState(false);
  const [plans, setPlans] = useState([]);
  useEffect(() => { api.get('/admin/lookups').then(({ data }) => setPlans(data.plans.map((x) => ({ value: x.id, label: x.name })))); }, []);
  const v = form.values;
  const save = async () => {
    setBusy(true);
    const body = { ...v, variants: JSON.stringify(v.variants.filter((x) => x.name)) };
    for (const k of ['front_image', 'back_image']) if (!(body[k] instanceof File)) delete body[k];
    for (const k of ['id', 'created_at', 'updated_at', 'components', 'images', 'slug', 'plan']) delete body[k];
    try { await run(product.id ? api.put(`/admin/nfc-cards/${product.id}`, toFormData(body)) : api.post('/admin/nfc-cards', toFormData(body))); onSaved(); } catch (e) { form.setErrors(e.errors || {}); } finally { setBusy(false); }
  };
  const setVar = (i, k, val) => form.set('variants', v.variants.map((x, j) => (j === i ? { ...x, [k]: val } : x)));
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} size="xl" icon={Package} title={product.id ? `Edit ${product.name}` : 'New product'}
      footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={save} loading={busy}>Save product</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" required error={form.errors.name} className="sm:col-span-2"><Input {...form.input('name')} /></Field>
        <Field label="Category" hint="e.g. Cards, Standees, Stickers"><Input {...form.input('category')} /></Field>
        <Field label="Size" hint="e.g. 100 x 120 mm"><Input {...form.input('size_label')} /></Field>
        <Field label="Price (Rs)" required error={form.errors.price}><Input {...form.input('price')} type="number" min="0" /></Field>
        <Field label="Compare-at price" hint="Shown struck through"><Input {...form.input('compare_price')} type="number" min="0" /></Field>
        <Field label="Customisation price" hint="0 = not offered"><Input {...form.input('customization_price')} type="number" min="0" /></Field>
        <Field label="SKU"><Input {...form.input('sku')} /></Field>
        <Field label="Plan included" className="sm:col-span-2" hint="Customers who get this product (e.g. an NFC card) also get this plan when an account is created with the order. Leave empty for non-plan products (stickers, stands...).">
          <Select value={v.plan_id} onChange={(x) => form.set('plan_id', x)} allowEmpty placeholder="Non-plan product" options={plans} />
        </Field>
        <Field label="Short description" className="sm:col-span-2"><Input {...form.input('short_description')} maxLength={500} /></Field>
        <Field label="Description" className="sm:col-span-2"><Textarea {...form.input('description')} rows={3} /></Field>
        <div className="space-y-2 sm:col-span-2">
          <div className="flex items-center justify-between"><p className="text-sm font-medium">Options (sizes, colours)</p><Button size="xs" variant="soft" onClick={() => form.set('variants', [...v.variants, { name: '', price_delta: 0 }])}><Plus />Add option</Button></div>
          {v.variants.map((x, i) => (
            <div key={i} className="flex gap-2"><Input value={x.name} onChange={(e) => setVar(i, 'name', e.target.value)} placeholder="e.g. Medium" /><Input type="number" className="w-36" value={x.price_delta} onChange={(e) => setVar(i, 'price_delta', e.target.value)} placeholder="+ price" /><Button variant="ghost" size="icon" onClick={() => form.set('variants', v.variants.filter((_, j) => j !== i))}><Trash2 /></Button></div>
          ))}
        </div>
        <Field label="Main image"><ImageUpload value={v.front_image} onChange={(f) => form.set('front_image', f)} /></Field>
        <Field label="Second image"><ImageUpload value={v.back_image} onChange={(f) => form.set('back_image', f)} /></Field>
        <Field label="Weight (grams)" hint="Used for courier booking"><Input {...form.input('weight_grams')} type="number" min="1" /></Field>
        <Field label="Sort order"><Input {...form.input('sort')} type="number" /></Field>
        <div className="grid gap-2 sm:col-span-2 sm:grid-cols-2">
          <SwitchRow title="Show in shop" {...{ checked: v.show_in_shop, onChange: (x) => form.set('show_in_shop', x) }} />
          <SwitchRow title="Featured" {...{ checked: v.featured, onChange: (x) => form.set('featured', x) }} />
          <SwitchRow title="Active" description="Inactive products cannot be ordered" {...{ checked: v.status, onChange: (x) => form.set('status', x) }} />
          <SwitchRow title="Track stock" description="Take components from inventory on dispatch" {...{ checked: v.track_stock, onChange: (x) => form.set('track_stock', x) }} />
        </div>
      </div>
    </Dialog>
  );
}

function ProductCosting({ product, onClose, onSaved }) {
  const [items, setItems] = useState([]);
  const [rows, setRows] = useState(null);
  const [extra, setExtra] = useState(product.extra_cost || 0);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    api.get('/admin/inventory/items').then(({ data }) => setItems(data.data));
    api.get(`/admin/nfc-cards/${product.id}/components`).then(({ data }) => setRows(data.data.map((c) => ({ inventory_item_id: c.inventory_item_id, quantity: Number(c.quantity) }))));
  }, [product.id]);
  const cost = useMemo(() => (rows || []).reduce((a, r) => a + Number(r.quantity || 0) * Number(items.find((i) => i.id === Number(r.inventory_item_id))?.purchase_price || 0), 0) + Number(extra || 0), [rows, items, extra]);
  const margin = Number(product.price) - cost;
  const save = async () => { setBusy(true); try { await run(api.put(`/admin/nfc-cards/${product.id}/components`, { components: rows, extra_cost: extra })); onSaved(); onClose(); } catch { /* toast */ } finally { setBusy(false); } };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} size="lg" icon={Calculator} title={`Costing · ${product.name}`} description="Inventory items used per unit (average landed cost) plus printing / labour. Drives stock deduction and profit analytics."
      footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={save} loading={busy}>Save costing</Button></>}>
      {!rows ? <Skeleton className="h-40" /> : (
        <div className="space-y-3">
          {rows.map((r, i) => {
            const it = items.find((x) => x.id === Number(r.inventory_item_id));
            return (
              <div key={i} className="flex items-center gap-2">
                <Select className="flex-1" value={r.inventory_item_id} onChange={(val) => setRows(rows.map((x, j) => (j === i ? { ...x, inventory_item_id: val } : x)))} placeholder="Inventory item" options={items.map((x) => ({ value: x.id, label: `${x.name} · ${rs(x.purchase_price)}/${x.unit} · ${x.stock} in stock` }))} />
                <Input type="number" step="0.01" min="0" className="w-24" value={r.quantity} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, quantity: e.target.value } : x)))} aria-label="Quantity per unit" />
                <span className="w-24 text-right text-sm text-muted-foreground">{rs(Number(r.quantity) * Number(it?.purchase_price || 0))}</span>
                <Button variant="ghost" size="icon" onClick={() => setRows(rows.filter((_, j) => j !== i))}><Trash2 /></Button>
              </div>
            );
          })}
          <Button size="sm" variant="soft" onClick={() => setRows([...rows, { inventory_item_id: '', quantity: 1 }])}><Plus />Add component</Button>
          <Field label="Printing / labour cost per unit (Rs)" hint="e.g. the vendor's printing rate"><Input type="number" min="0" value={extra} onChange={(e) => setExtra(e.target.value)} /></Field>
          <div className="grid grid-cols-3 gap-3 rounded-2xl bg-muted/50 p-4 text-center text-sm">
            <div><p className="text-xs text-muted-foreground">Unit cost</p><p className="text-lg font-bold">{rs(cost)}</p></div>
            <div><p className="text-xs text-muted-foreground">Sale price</p><p className="text-lg font-bold">{rs(product.price)}</p></div>
            <div><p className="text-xs text-muted-foreground">Margin</p><p className={cn('text-lg font-bold', margin >= 0 ? 'text-success' : 'text-danger')}>{rs(margin)} <span className="text-xs">({product.price > 0 ? Math.round((margin / product.price) * 100) : 0}%)</span></p></div>
          </div>
        </div>
      )}
    </Dialog>
  );
}


/* ================================================================ order sources: see OrderSources.jsx */
export { OrderSources } from './OrderSources';
