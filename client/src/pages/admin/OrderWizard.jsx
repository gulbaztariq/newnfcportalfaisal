/* Admin: new order wizard (phone / WhatsApp / walk-in / other websites). Staff only - the website checkout is separate. */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import {
  ArrowLeft, ArrowRight, Check, User, Package, Truck, ClipboardCheck, Plus, Trash2, Store, Wand2, IdCard, Copy, ExternalLink,
  BadgePercent, Banknote, ShoppingBag, Settings2, Sparkles, UserCheck, UserPlus, UserRound, Building2, Repeat,
  Share2, Boxes, FlaskConical, Printer, Smartphone, Layers, CreditCard, CalendarClock, TrendingUp, RefreshCw, ShieldCheck,
} from 'lucide-react';
import api from '@/lib/api';
import SearchSelect from '@/components/SearchSelect';
import { cn } from '@/lib/cn';
import {
  Card, CardHeader, CardBody, Button, Field, Input, Textarea, Select, Segmented, Checkbox, Badge, Tip, Skeleton, Avatar, run,
} from '@/components/ui';

const STEP_META = { type: ['Order type', Layers], customer: ['Customer', User], products: ['Products', Package], delivery: ['Delivery & payment', Truck], review: ['Review', ClipboardCheck] };
/** Products come right after the order type (prices are fetched from the website). Renewals and upgrades need the customer first: their plan decides what is offered. */
const flowFor = (type) => (['renewal', 'upgrade'].includes(type) ? ['type', 'customer', 'products', 'delivery', 'review'] : ['type', 'products', 'customer', 'delivery', 'review']);
let lineId = 0;
/* order types: what the customer wants decides the products, the pricing rules and whether anything ships */
const ORDER_TYPES = [
  { key: 'nfc_profile', title: 'NFC Business Card', text: 'Business card linked to a profile on our portal', icon: IdCard },
  { key: 'social', title: 'Social / review card', text: 'Static link, dynamic link or all-in-one social profile', icon: Share2 },
  { key: 'wholesale', title: 'Wholesale', text: 'Bulk quantities with quantity discounts', icon: Boxes },
  { key: 'sample', title: 'Samples first', text: 'Paid samples, credited to the bulk order later', icon: FlaskConical },
  { key: 'card_printing', title: 'Card + printing', text: 'NFC card with your print, no profile or plan', icon: CreditCard },
  { key: 'printing', title: 'Printing only', text: 'Printing service on cards the client already has', icon: Printer },
  { key: 'digital', title: 'Digital profile only', text: 'Profile and plan, nothing shipped', icon: Smartphone },
  { key: 'renewal', title: 'Renewal', text: 'Extend an existing customer\'s plan', icon: CalendarClock },
  { key: 'upgrade', title: 'Upgrade plan', text: 'Move a customer to a higher plan, unused time credited', icon: TrendingUp },
  { key: 'contact_tag', title: 'Contact tag', text: 'QR / NFC tag that reaches the owner without showing their number', icon: ShieldCheck },
];
const NO_SHIP = ['digital', 'renewal', 'upgrade'];
const PLAN_CHANGE = ['renewal', 'upgrade']; // nothing is delivered
const noShip = (t) => NO_SHIP.includes(t);
const TYPE_TITLE = Object.fromEntries(ORDER_TYPES.map((t) => [t.key, t.title]));
const SOCIAL_VARIANTS = [{ value: 'static', label: 'Static link', kind: 'social_static' }, { value: 'dynamic', label: 'Dynamic link', kind: 'social_dynamic' }, { value: 'profile', label: 'All-in-one social profile', kind: 'social_profile' }];
/** which product kinds an order type offers (an untagged product counts as a normal NFC product) */
const kindsFor = (type, variant) => ({
  nfc_profile: ['nfc_profile', null], printing: ['printing', null], card_printing: ['blank_card', 'printing', null], digital: ['digital', null], renewal: ['__plan'], upgrade: ['__plan'], contact_tag: ['contact_tag'],
  social: [SOCIAL_VARIANTS.find((v) => v.value === variant)?.kind].filter(Boolean).concat(variant ? [] : ['social_static', 'social_dynamic', 'social_profile']),
}[type] || null); // null = every product (wholesale, samples)
const afterDisc = (price, t, v) => Math.max(0, t === 'percent' ? price * (1 - Math.min(100, Number(v) || 0) / 100) : t === 'fixed' ? price - (Number(v) || 0) : price);
const newLine = () => ({ key: ++lineId, product_id: '', variant: '', quantity: 1, unit_price: '', customization: false });
const money = (cur, v) => `${cur} ${Number(v || 0).toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
const slug = (s) => String(s || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '.').replace(/^\.+|\.+$/g, '').slice(0, 30);
const dummyEmail = (name, domain) => `${slug(name) || 'customer'}.${Math.random().toString(36).slice(2, 6)}@${domain}`;

function Stepper({ screens, step, done, onGo }) {
  return (
    <div className="flex items-center gap-1">
      {screens.map((k, i) => {
        const [l, I] = STEP_META[k];
        const active = i === step; const ok = done[i] && i < step;
        return (
          <div key={k} className="flex flex-1 items-center gap-1 last:flex-none">
            <button type="button" onClick={() => onGo(i)} disabled={i > step && !done.slice(0, i).every(Boolean)}
              className={cn('flex cursor-pointer items-center gap-2.5 rounded-2xl px-2 py-1.5 text-left transition disabled:cursor-not-allowed', active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground')}>
              <motion.span initial={false} animate={{ scale: active ? 1.08 : 1 }} className={cn('grid size-9 shrink-0 place-items-center rounded-xl border-2 transition', active ? 'border-primary bg-primary text-white shadow-glow' : ok ? 'border-primary/40 bg-primary-soft text-primary' : 'border-border bg-card')}>
                {ok ? <Check className="size-4" /> : <I className="size-4" />}
              </motion.span>
              <span className="hidden text-sm font-medium md:block">{l}</span>
            </button>
            {i < screens.length - 1 && <span className={cn('h-0.5 flex-1 rounded-full', i < step ? 'bg-primary' : 'bg-border')} />}
          </div>
        );
      })}
    </div>
  );
}

/* the summary box on the right: lines, discount, editable delivery charges, total */
function Summary({ meta, quote, lines, form, setForm, loading }) {
  const cur = meta.currency;
  const products = Object.fromEntries(meta.products.map((p) => [p.id, p]));
  const collection = form.fulfilment === 'collection';
  const digital = noShip(form.order_type);
  return (
    <Card className="overflow-hidden lg:sticky lg:top-24">
      <CardHeader icon={ShoppingBag} title="Order summary" />
      <CardBody className="space-y-3 text-sm">
        <Badge tone="primary">{TYPE_TITLE[form.order_type]}</Badge>
        {!lines.some((l) => l.product_id) ? <p className="text-muted-foreground">No products yet.</p> : (
          <ul className="space-y-1.5">
            {lines.filter((l) => l.product_id).map((l, i) => {
              const q = quote?.lines?.[i]; // quote lines follow the order of the chosen products
              return (
                <li key={l.key} className="flex justify-between gap-3">
                  <span className="min-w-0 truncate">{products[l.product_id]?.name}{l.variant ? ` · ${l.variant}` : ''} <span className="text-muted-foreground">× {l.quantity || 1}</span></span>
                  <span className="shrink-0">{q ? money(cur, q.total) : '…'}</span>
                </li>
              );
            })}
          </ul>
        )}
        <div className="space-y-1.5 border-t border-border pt-3">
          <Row label="Subtotal" value={money(cur, quote?.subtotal)} />
          {quote?.discount > 0 && <Row label={`Discount${quote.discount_type === 'percent' ? ` (${quote.discount_value}%)` : ''}`} value={`- ${money(cur, quote.discount)}`} className="font-medium text-success" />}
          {quote?.plan_credit > 0 && <Row label="Credit for unused time" value={`- ${money(cur, quote.plan_credit)}`} className="font-medium text-success" />}
          {quote?.sample_credit > 0 && <Row label="Sample credit" value={`- ${money(cur, quote.sample_credit)}`} className="font-medium text-success" />}
          {quote?.tax > 0 && <Row label={`${quote.tax_name} (${quote.tax_rate}%)`} value={money(cur, quote.tax)} />}
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">Delivery</span>
            {digital ? <span className="text-muted-foreground">No shipping</span> : collection ? <span className="text-muted-foreground">Office collection</span> : (
              <Tip content={`Leave empty for the default (${money(cur, quote?.delivery_default ?? meta.delivery_charges)})`}>
                <Input type="number" min="0" aria-label="Delivery charges" value={form.delivery_charges} onChange={(e) => setForm('delivery_charges', e.target.value)} placeholder={String(quote?.delivery_default ?? meta.delivery_charges)} className="h-8 w-28 text-right" />
              </Tip>
            )}
          </div>
          {quote?.cod > 0 && <Row label="COD charges" value={money(cur, quote.cod)} />}
        </div>
        <div className={cn('flex items-center justify-between rounded-2xl bg-primary-soft px-4 py-3 text-primary transition-opacity', loading && 'opacity-60')}>
          <span className="font-semibold">Total</span><span className="font-display text-xl font-bold">{money(cur, quote?.total)}</span>
        </div>
        {quote?.error && <p className="text-xs text-danger">{quote.error}</p>}
        {(quote?.warnings || []).map((w) => <p key={w} className="rounded-xl bg-warning-soft px-3 py-2 text-xs text-warning">{w}</p>)}
      </CardBody>
    </Card>
  );
}
const Row = ({ label, value, className }) => <div className={cn('flex justify-between gap-3', className)}><span className="text-muted-foreground">{label}</span><span>{value}</span></div>;

const TYPES = [
  ['existing', 'Existing customer', 'Registered (plan) customer', UserCheck],
  ['new', 'New customer', 'Creates an account + vCard', UserPlus],
  ['organisation', 'Organisation', 'Order for a company', Building2],
  ['guest', 'Guest', 'No account · non-plan products', UserRound],
];
const TYPE_LABEL = Object.fromEntries(TYPES.map(([k, l]) => [k, l]));
const fetchList = (url) => (q) => api.get(url, { params: { q, search: q, per_page: 15 } }).then(({ data }) => data.data);
const PersonLine = ({ p, sub }) => (
  <div className="flex min-w-0 items-center gap-3">
    <Avatar name={p.name} size={32} />
    <div className="min-w-0"><p className="truncate font-medium">{p.name}</p><p className="truncate text-xs text-muted-foreground">{sub}</p></div>
  </div>
);

function ChoiceCard({ active, onClick, icon: Icon, title, text }) {
  return (
    <button type="button" onClick={onClick} className={cn('flex cursor-pointer items-start gap-3 rounded-2xl border-2 p-4 text-left transition', active ? 'border-primary bg-primary-soft/50' : 'border-border hover:border-primary/40')}>
      <span className={cn('grid size-10 shrink-0 place-items-center rounded-xl', active ? 'bg-primary text-white' : 'bg-muted text-muted-foreground')}><Icon className="size-5" /></span>
      <span><span className="block font-semibold">{title}</span><span className="text-xs text-muted-foreground">{text}</span></span>
    </button>
  );
}

/** estimate of the price per piece before the server quotes it (type, tier, product discount) */
function estimate(meta, p, variant, qty, type) {
  const base = Number(p.price || 0) + Number((p.variants || []).find((v) => v.name === variant)?.price_delta || 0);
  const disc = afterDisc(base, p.discount_type, p.discount_value);
  if (type === 'sample') return Number(p.sample_price) > 0 ? Number(p.sample_price) + Number((p.variants || []).find((v) => v.name === variant)?.price_delta || 0) : base * (1 + Number(meta.sample_markup_percent || 0) / 100);
  if (type === 'wholesale') {
    if (p.no_wholesale_tiers) return disc; // already a wholesale price
    const tiers = (Array.isArray(p.wholesale_tiers) && p.wholesale_tiers.length ? p.wholesale_tiers : meta.wholesale_tiers || []).filter((t) => Number(t.min) <= Number(qty || 1)).at(-1);
    return disc * (1 - (tiers?.percent || 0) / 100);
  }
  return disc;
}

/** product catalog: search, categories, live website price next to your editable price, quantity per product */
function Catalog({ meta, offered, lines, setLines, quote, valid, form, cur, sampleMax, refresh, onRefresh }) {
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const [pending, setPending] = useState({}); // option chosen before the product has a quantity
  const sourceName = (id) => meta.sources.find((x) => x.id === id)?.name;
  const cats = [...new Set(offered.map((p) => p.category).filter(Boolean))].sort();
  const shown = offered.filter((p) => (!cat || p.category === cat) && (!q || `${p.name} ${p.sku || ''} ${p.category || ''}`.toLowerCase().includes(q.toLowerCase())));
  const lineOf = (p) => lines.find((l) => String(l.product_id) === String(p.id));
  const firstQty = form.order_type === 'wholesale' ? Number(meta.wholesale_tiers?.[0]?.min) || 1 : 1;
  const clamp = (n) => (form.order_type === 'sample' ? Math.min(sampleMax, n) : n);
  const upsert = (p, patch) => setLines((ls) => {
    const has = ls.some((l) => String(l.product_id) === String(p.id));
    if (has) return ls.map((l) => (String(l.product_id) === String(p.id) ? { ...l, ...patch } : l));
    return [...ls.filter((l) => l.product_id), { key: ++lineId, product_id: p.id, variant: pending[p.id] ?? p.variants?.[0]?.name ?? '', quantity: firstQty, unit_price: '', customization: false, ...patch }];
  });
  const setQty = (p, raw) => {
    const n = clamp(Math.max(0, parseInt(raw, 10) || 0));
    if (n <= 0) setLines((ls) => ls.filter((l) => String(l.product_id) !== String(p.id)));
    else upsert(p, { quantity: n });
  };
  const setVariant = (p, name) => { setPending((x) => ({ ...x, [p.id]: name })); if (lineOf(p)) upsert(p, { variant: name, unit_price: '' }); };
  const failed = (refresh.results || []).filter((r) => r.status === 'failed');
  const when = refresh.at ? refresh.at.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-48 flex-1"><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search products..." aria-label="Search products" /></div>
        <Button size="sm" variant="outline" onClick={onRefresh} loading={refresh.loading}><RefreshCw />Refresh prices</Button>
      </div>
      <p className="text-xs text-muted-foreground">
        {refresh.loading ? 'Reading the latest prices from the website...' : when ? `Prices read from ${form.order_source_id ? sourceName(Number(form.order_source_id)) : 'your websites'} at ${when}.` : 'Showing saved prices.'}
        {' '}The <b>Your price</b> box is editable for this order; the website price is shown next to it.
      </p>
      {failed.map((r) => <p key={r.id} className="rounded-xl bg-warning-soft px-3 py-2 text-xs text-warning">{r.name}: {r.message} Saved prices are used.</p>)}
      {cats.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          {[['', 'All'], ...cats.map((c) => [c, c])].map(([k, l]) => <button key={k} type="button" onClick={() => setCat(k)} className={cn('cursor-pointer rounded-full px-3 py-1 text-xs font-medium transition', cat === k ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground hover:text-foreground')}>{l}</button>)}
        </div>
      )}
      <div className="max-h-[520px] space-y-2 overflow-y-auto pr-1">
        {!shown.length && <p className="py-8 text-center text-sm text-muted-foreground">No products found.</p>}
        {shown.map((p) => {
          const line = lineOf(p);
          const variant = line?.variant ?? pending[p.id] ?? p.variants?.[0]?.name ?? '';
          const qty = line ? Number(line.quantity) || 0 : 0;
          const ql = line ? quote?.lines?.[valid.findIndex((x) => x.key === line.key)] : null;
          const est = estimate(meta, p, variant, qty || firstQty, form.order_type);
          const unit = line && line.unit_price !== '' ? Number(line.unit_price) : ql ? Number(ql.unit_price) : est;
          const site = p.source_price === null || p.source_price === undefined ? null : Number(p.source_price) + Number((p.variants || []).find((v) => v.name === variant)?.price_delta || 0);
          const img = p.front_image || p.images?.[0];
          return (
            <div key={p.id} className={cn('rounded-2xl border p-2.5 transition', qty ? 'border-primary bg-primary-soft/30' : 'border-border')}>
              <div className="flex flex-wrap items-center gap-3">
                <span className="size-12 shrink-0 overflow-hidden rounded-xl bg-muted">{img && <img src={img} alt="" loading="lazy" className="size-full object-cover" />}</span>
                <div className="min-w-44 flex-1">
                  <p className="text-sm leading-snug font-medium">{p.name}</p>
                  <p className="text-xs text-muted-foreground">{[p.category, !form.order_source_id && p.order_source_id ? sourceName(p.order_source_id) : null].filter(Boolean).join(' · ')}</p>
                </div>
                {p.variants?.length > 0 && (
                  <Select className="h-9 w-52" value={variant} onChange={(v) => setVariant(p, v)} options={p.variants.map((v) => ({ value: v.name, label: `${v.name}${Number(v.price_delta) ? ` (+${v.price_delta})` : ''}` }))} />
                )}
                <div className="text-right">
                  <p className="text-[11px] text-muted-foreground">Website</p>
                  <p className="text-sm tabular-nums">{site === null ? '-' : money(cur, site)}</p>
                </div>
                <div className="w-28">
                  <p className="text-[11px] text-muted-foreground">Your price</p>
                  <Input className="h-9" type="number" min="0" step="0.01" aria-label={`Price of ${p.name}`} value={line?.unit_price ?? ''} placeholder={String(Math.round(unit * 100) / 100)}
                    onChange={(e) => upsert(p, { unit_price: e.target.value })} />
                </div>
                <div className="flex items-center gap-1">
                  <Button size="icon-sm" variant="outline" onClick={() => setQty(p, qty - (qty > firstQty ? 1 : qty))} aria-label="Less" disabled={!qty}>-</Button>
                  <Input className="h-9 w-16 text-center" type="number" min="0" max={form.order_type === 'sample' ? sampleMax : undefined} value={qty || ''} placeholder="0" aria-label={`Quantity of ${p.name}`} onChange={(e) => setQty(p, e.target.value)} />
                  <Button size="icon-sm" variant="outline" onClick={() => setQty(p, qty ? qty + 1 : firstQty)} aria-label="More">+</Button>
                </div>
              </div>
              {qty > 0 && (
                <div className="mt-2 flex flex-wrap items-center gap-2 px-1 text-xs">
                  <span className="font-semibold">{money(cur, ql && line.unit_price === '' ? ql.total : unit * qty)}</span>
                  {ql?.tier_percent > 0 && <Badge tone="success">Wholesale tier {ql.tier_percent}% off</Badge>}
                  {form.order_type === 'sample' && <Badge tone="warning">Sample price</Badge>}
                  {p.plan && <Badge tone="primary"><IdCard className="size-3" />Plan: {p.plan.name}</Badge>}
                  {Number(p.discount_value) > 0 && form.order_type !== 'sample' && <Badge tone="success">Discount {p.discount_type === 'percent' ? `${Number(p.discount_value)}%` : money(cur, p.discount_value)}</Badge>}
                  {line.unit_price !== '' && ql && Number(line.unit_price) !== Number(ql.list_price) && <span className="text-muted-foreground">Edited from {money(cur, ql.list_price)}</span>}
                  {Number(p.customization_price) > 0 && <Checkbox id={`cz-${p.id}`} checked={!!line.customization} onChange={(v) => upsert(p, { customization: v })} label={`Customisation +${money(cur, p.customization_price)} / pc`} />}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function OrderWizard() {
  const navigate = useNavigate();
  const [meta, setMeta] = useState(null);
  const [step, setStep] = useState(0);
  const [lines, setLines] = useState([newLine()]);
  const [params] = useSearchParams();
  const [form, setValues] = useState({
    customer_type: 'guest', customer: null, organisation: null, contact_id: '', guest: null,
    name: '', phone: '', email: '', dummy: false, company_name: '', city: '', address: '', order_source_id: '',
    fulfilment: 'delivery', payment: 'cod', delivery_charges: '', discount_type: 'fixed', discount_value: '', admin_note: '',
    order_type: 'nfc_profile', social_variant: '', sample_order: null, plan_credit: '',
  });
  const [showAll, setShowAll] = useState(false);
  const [refresh, setRefresh] = useState({ loading: false, results: [], at: null });
  const refreshedKey = useRef('');
  const [subInfo, setSubInfo] = useState(undefined); // current plan of the customer being renewed
  const [errors, setErrors] = useState({});
  const screens = flowFor(form.order_type);
  const screen = screens[step];
  const goTo = (k) => setStep(screens.indexOf(k));
  const [quote, setQuote] = useState(null);
  const [quoting, setQuoting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const nameRef = useRef(null);
  const set = (k, v) => { setValues((f) => ({ ...f, [k]: v })); setErrors((e) => ({ ...e, [k]: undefined })); };
  const [people, setPeople] = useState([]);
  const [reorderOf, setReorderOf] = useState(null);
  useEffect(() => { api.get('/admin/orders-meta').then(({ data }) => setMeta(data)); }, []);
  // contact people of the chosen organisation
  useEffect(() => { if (form.organisation) api.get(`/admin/organisations/${form.organisation.id}/people`).then(({ data }) => setPeople(data.data)); else setPeople([]); }, [form.organisation?.id]); // eslint-disable-line
  // prefill: ?reorder=<order id>[&edit=1], ?guest=<id>, ?organisation=<owner id>, ?customer=<user id>
  useEffect(() => {
    if (!meta) return;
    const fill = (patch) => setValues((f) => ({ ...f, ...patch }));
    if (params.get('reorder')) {
      api.get(`/admin/orders/${params.get('reorder')}`).then(({ data }) => {
        const o = data.data;
        const base = { name: o.name, phone: o.phone || '', email: o.email || '', company_name: o.company_name || '', city: o.city || '', address: o.address || '', order_source_id: o.order_source_id || '',
          fulfilment: o.fulfilment || 'delivery', payment: o.is_cod ? 'cod' : o.payment_type === 'collection' ? 'collection' : 'pending',
          discount_type: o.discount_type || 'fixed', discount_value: Number(o.discount) ? String(Number(o.discount_value) || Number(o.discount)) : '',
          delivery_charges: o.fulfilment === 'collection' ? '' : String(Number(o.delivery_charges)) };
        if (o.guest_customer_id) fill({ ...base, customer_type: 'guest', guest: { id: o.guest_customer_id, name: o.guest?.name || o.name, phone: o.phone } });
        else if (o.organisation_id) fill({ ...base, customer_type: 'organisation', organisation: { id: o.organisation_id, name: o.organisation?.organisation?.name || o.name }, contact_id: o.user_id || '' });
        else if (o.user_id) fill({ ...base, customer_type: 'existing', customer: { id: o.user_id, name: `${o.user?.first_name || ''} ${o.user?.last_name || ''}`.trim() || o.name, email: o.user?.email } });
        else fill({ ...base, customer_type: 'guest' });
        const items = o.items?.length ? o.items : [];
        setLines(items.length ? items.map((it) => ({ key: ++lineId, product_id: it.nfc_card_id, variant: it.variant || '', quantity: it.quantity, unit_price: String(Number(it.unit_price)), customization: !!it.customization })) : [newLine()]);
        setReorderOf(o.order_number);
        setStep(params.get('edit') ? 1 : 4);
      }).catch(() => toast.error('Could not load the order to reorder'));
    } else if (params.get('bulk') || params.get('sample')) {
      // bulk order from any order: same customer and products at wholesale pricing; a sample order's charge is credited
      api.get(`/admin/orders/${params.get('bulk') || params.get('sample')}`).then(({ data }) => {
        const o = data.data; const minQty = meta.wholesale_tiers?.[0]?.min || 25;
        const base = { name: o.name, phone: o.phone || '', email: o.email || '', company_name: o.company_name || '', city: o.city || '', address: o.address || '', order_source_id: o.order_source_id || '', order_type: 'wholesale',
          sample_order: o.order_type === 'sample' ? { id: o.id, order_number: o.order_number, credit: (o.items || []).reduce((a, i) => a + Number(i.total), 0) } : null };
        if (o.guest_customer_id) fill({ ...base, customer_type: 'guest', guest: { id: o.guest_customer_id, name: o.guest?.name || o.name, phone: o.phone } });
        else if (o.organisation_id) fill({ ...base, customer_type: 'organisation', organisation: { id: o.organisation_id, name: o.organisation?.organisation?.name || o.name }, contact_id: o.user_id || '' });
        else if (o.user_id) fill({ ...base, customer_type: 'existing', customer: { id: o.user_id, name: `${o.user?.first_name || ''} ${o.user?.last_name || ''}`.trim() || o.name, email: o.user?.email } });
        else fill({ ...base, customer_type: 'guest' });
        setLines((o.items?.length ? o.items : []).map((it) => ({ key: ++lineId, product_id: it.nfc_card_id, variant: it.variant || '', quantity: minQty, unit_price: '', customization: !!it.customization })));
        setReorderOf(`bulk from ${o.order_number}`); setStep(1);
      }).catch(() => toast.error('Could not load the order'));
    } else if (params.get('guest')) {
      api.get(`/admin/guest-customers/${params.get('guest')}`).then(({ data }) => { const g = data.data; fill({ customer_type: 'guest', guest: g, name: g.name, phone: g.phone || '', email: g.email || '', company_name: g.company_name || '', city: g.city || '', address: g.address || '' }); });
    } else if (params.get('organisation')) {
      api.get('/admin/organisations/search', { params: { q: '' } }).then(({ data }) => { const o = data.data.find((x) => String(x.id) === params.get('organisation')); if (o) pickOrganisation(o); });
    }
  }, [meta]); // eslint-disable-line
  useEffect(() => { if (meta && screen === 'customer') nameRef.current?.focus(); }, [meta, screen]);

  const products = useMemo(() => Object.fromEntries((meta?.products || []).map((p) => [p.id, p])), [meta]);
  const sampleMax = meta?.sample_max_qty || 5;
  // live prices: when the product screen opens, the chosen website (or all of them) is read again; saved prices show meanwhile
  const doRefresh = async (force = false) => {
    setRefresh((r) => ({ ...r, loading: true }));
    try {
      const { data } = await api.post('/admin/order-sources/refresh', { ids: form.order_source_id ? [Number(form.order_source_id)] : undefined, force });
      const { data: m } = await api.get('/admin/orders-meta');
      setMeta((x) => ({ ...x, products: m.products, sources: m.sources }));
      setRefresh({ loading: false, results: data.results, at: new Date() });
    } catch { setRefresh((r) => ({ ...r, loading: false })); toast.error('Could not refresh the prices. Saved prices are shown.'); }
  };
  useEffect(() => {
    if (screen !== 'products' || !meta) return;
    const key = String(form.order_source_id || 'all');
    if (refreshedKey.current === key) return;
    refreshedKey.current = key; doRefresh(false);
  }, [screen, !!meta, form.order_source_id]); // eslint-disable-line
  const renewFor = form.customer?.id || form.organisation?.id;
  useEffect(() => {
    if (!PLAN_CHANGE.includes(form.order_type) || !renewFor) { setSubInfo(undefined); return; }
    api.get(`/admin/customers/${renewFor}/subscription`).then(({ data }) => setSubInfo(data.data)).catch(() => setSubInfo(null));
  }, [form.order_type, renewFor]);
  const kinds = kindsFor(form.order_type, form.social_variant);
  const offered = useMemo(() => (meta?.products || []).filter((p) => (!form.order_source_id || !p.order_source_id || String(p.order_source_id) === String(form.order_source_id))
    && (showAll || !kinds || kinds.includes(p.product_kind || null) || (noShip(form.order_type) && p.plan_id && (form.order_type !== 'upgrade' || !subInfo || (p.plan_id !== subInfo.plan_id && Number(p.plan?.price) > Number(subInfo.plan_price)))))), [meta, subInfo, form.order_source_id, form.order_type, form.social_variant, showAll]); // eslint-disable-line
  const valid = lines.filter((l) => l.product_id);
  const payload = () => ({
    items: valid.map(({ product_id, variant, quantity, unit_price, customization }) => ({ product_id, variant, quantity, unit_price, customization })),
    order_type: form.order_type, social_variant: form.order_type === 'social' ? form.social_variant : undefined, sample_order_id: form.order_type === 'wholesale' ? form.sample_order?.id : undefined, plan_credit: form.order_type === 'upgrade' && form.plan_credit !== '' ? form.plan_credit : undefined,
    fulfilment: noShip(form.order_type) ? 'digital' : form.fulfilment, is_cod: !noShip(form.order_type) && form.fulfilment === 'delivery' && form.payment === 'cod', delivery_charges: form.delivery_charges,
    discount_type: form.discount_type, discount_value: form.discount_value || 0,
  });
  // live price from the server (same rules as the saved order)
  useEffect(() => {
    if (!valid.length || valid.some((l) => products[l.product_id]?.variants?.length && !l.variant)) { setQuote(null); return undefined; }
    setQuoting(true);
    const t = setTimeout(() => api.post('/admin/orders/quote', payload()).then(({ data }) => setQuote(data)).catch((e) => setQuote({ error: e.message })).finally(() => setQuoting(false)), 300);
    return () => clearTimeout(t);
  }, [JSON.stringify(payload()), products]); // eslint-disable-line

  const setLine = (key, patch) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const listPrice = (p, variant) => afterDisc(Number(p?.price || 0) + Number((p?.variants || []).find((v) => v.name === variant)?.price_delta || 0), p?.discount_type, p?.discount_value);
  // the price per piece is worked out by the server (type, tier, discount); typing one here overrides it
  const pickProduct = (key, id) => setLine(key, { product_id: id, variant: '', customization: false, unit_price: '', quantity: form.order_type === 'sample' ? 1 : undefined });
  const pickVariant = (key, p, variant) => setLine(key, { variant, unit_price: '' });
  const pickType = (key) => setValues((f) => {
    const untouched = !f.name && !f.customer && !f.organisation && !f.guest;
    const account = ['nfc_profile', 'digital'].includes(key) || (key === 'social' && f.social_variant === 'profile');
    const customerType = PLAN_CHANGE.includes(key) ? 'existing' : account ? 'new' : 'guest';
    return { ...f, order_type: key, social_variant: key === 'social' ? f.social_variant : '', sample_order: key === 'wholesale' ? f.sample_order : null,
      fulfilment: noShip(key) ? 'digital' : f.fulfilment === 'digital' ? 'delivery' : f.fulfilment, payment: noShip(key) ? 'pending' : f.payment === 'pending' && f.fulfilment === 'digital' ? 'cod' : f.payment,
      ...(untouched ? { customer_type: customerType } : {}) };
  });
  const toggleDummy = (on) => { set('dummy', on); set('email', on ? dummyEmail(form.name, meta.dummy_domain) : ''); };
  const setType = (t) => { setValues((f) => ({ ...f, customer_type: t, customer: null, organisation: null, contact_id: '', guest: null, dummy: false, ...(t === f.customer_type ? {} : { name: '', phone: '', email: '', company_name: '', city: '', address: '' }) })); setErrors({}); };
  const pickCustomer = (u) => setValues((f) => ({ ...f, customer: u, name: u?.name || '', email: u?.email || '', phone: u?.contact || '', company_name: u?.organisation_name || f.company_name }));
  const pickOrganisation = (o) => setValues((f) => ({ ...f, organisation: o, contact_id: '', name: o?.owner || '', company_name: o?.name || '', phone: o?.phone || '', email: o?.email || '', address: o?.address || '', city: o?.city || '' }));
  const pickContact = (id) => { const p = people.find((x) => String(x.id) === String(id)); setValues((f) => ({ ...f, contact_id: id, name: p ? `${p.first_name} ${p.last_name}`.trim() : f.name, email: p?.email || f.email, phone: p?.contact || f.phone })); };
  const pickGuest = (g) => setValues((f) => ({ ...f, guest: g, ...(g ? { name: g.name, phone: g.phone || '', email: g.email || '', company_name: g.company_name || '', city: g.city || '', address: g.address || '' } : {}) }));

  const checkList = [
    () => { const e = {}; if (form.order_type === 'social' && !form.social_variant) e.social_variant = 'Choose static, dynamic or all-in-one'; return e; },
    () => { const e = {}; if (form.order_type === 'contact_tag' && String(form.phone).replace(/\D/g, '').length < 7) e.phone = 'The tag owner\'s phone number is needed: messages are sent there'; if (PLAN_CHANGE.includes(form.order_type) && !['existing', 'organisation'].includes(form.customer_type)) e.name = 'A renewal or upgrade is for an existing customer or organisation'; if (form.customer_type === 'existing' && !form.customer) e.user_id = 'Search and choose the customer'; if (form.customer_type === 'organisation' && !form.organisation) e.organisation_id = 'Search and choose the organisation'; if (!form.name.trim()) e.name = 'Enter the customer name'; if (form.customer_type === 'new' && !form.email) e.email = 'An account needs an e-mail. Tick "Dummy e-mail" if the customer has none.'; if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Enter a valid e-mail address'; return e; },
    () => { const e = {}; if (!valid.length) e.products = 'Add at least one product'; else if (valid.some((l) => products[l.product_id]?.variants?.length && !l.variant)) e.products = 'Choose an option for every product'; else if (valid.some((l) => l.unit_price !== '' && Number(l.unit_price) < 0)) e.products = 'Prices cannot be negative'; else if (form.order_type === 'sample' && valid.some((l) => Number(l.quantity) > sampleMax)) e.products = `Samples are limited to ${sampleMax} pieces per product`; return e; },
    () => { const e = {}; if (form.discount_type === 'percent' && Number(form.discount_value) > 100) e.discount_value = 'Maximum 100%'; if (Number(form.discount_value) < 0) e.discount_value = 'Cannot be negative'; return e; },
    () => ({}),
  ];
  const checks = Object.fromEntries(['type', 'customer', 'products', 'delivery', 'review'].map((k, i) => [k, checkList[i]]));
  const done = screens.map((k) => !Object.keys(checks[k]()).length);
  const next = () => { const e = checks[screen](); setErrors(e); if (Object.keys(e).length) { toast.error(Object.values(e)[0]); return; } setStep((s) => Math.min(screens.length - 1, s + 1)); };
  const go = (i) => { if (i <= step || done.slice(0, i).every(Boolean)) setStep(i); };

  const create = async () => {
    setBusy(true);
    try {
      const body = {
        ...payload(), name: form.name, phone: form.phone, email: form.email, company_name: form.company_name, city: form.city, address: form.fulfilment === 'collection' && !form.address ? '' : form.address,
        order_source_id: form.order_source_id || undefined, admin_note: form.admin_note, customer_type: form.customer_type,
        user_id: form.customer?.id, organisation_id: form.organisation?.id, contact_id: form.contact_id || undefined, guest_customer_id: form.guest?.id,
        payment_status: form.payment === 'paid' ? 'paid' : 'pending',
      };
      const d = await run(api.post('/admin/orders', body));
      setResult(d);
    } catch (e) { setErrors(e.errors || {}); if (e.errors && Object.keys(e.errors).some((k) => ['name', 'email', 'phone', 'address', 'user_id', 'organisation_id', 'contact_id'].includes(k))) goTo('customer'); } finally { setBusy(false); }
  };
  const restart = () => { setResult(null); setStep(0); setLines([newLine()]); setQuote(null); setReorderOf(null); setValues((f) => ({ ...f, customer: null, organisation: null, contact_id: '', guest: null, name: '', phone: '', email: '', dummy: false, company_name: '', city: '', address: '', delivery_charges: '', discount_value: '', admin_note: '' })); };

  if (!meta) return <div className="grid gap-6 lg:grid-cols-[1fr_340px]"><Skeleton className="h-[520px] rounded-3xl" /><Skeleton className="h-80 rounded-3xl" /></div>;
  const cur = meta.currency;
  const srcName = meta.sources.find((s) => String(s.id) === String(form.order_source_id))?.name;

  if (result) {
    const o = result.data; const acc = result.account;
    return (
      <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} className="mx-auto max-w-xl">
        <Card className="relative overflow-hidden p-8 text-center">
          <div className="absolute -top-24 left-1/2 size-72 -translate-x-1/2 rounded-full bg-success/20 blur-3xl" />
          <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 18 }} className="relative mx-auto grid size-16 place-items-center rounded-2xl bg-success text-white shadow-lift"><Check className="size-8" /></motion.span>
          <h2 className="relative mt-4 font-display text-2xl font-bold">Order {o.order_number} created</h2>
          {result.tags?.length > 0 && (
            <div className="relative mt-6 space-y-2 rounded-2xl border border-border bg-muted/40 p-4 text-left text-sm">
              <p className="flex items-center gap-2 font-semibold"><ShieldCheck className="size-4 text-primary" />{result.tags.length} contact tag{result.tags.length > 1 ? 's' : ''} created</p>
              {result.tags.slice(0, 5).map((t) => (
                <div key={t.id} className="flex items-center justify-between gap-2 rounded-xl bg-card px-3 py-2">
                  <span className="font-mono font-semibold">{t.code}</span>
                  <span className="flex gap-1"><Button size="sm" variant="ghost" onClick={() => { navigator.clipboard?.writeText(t.url); toast.success('Tag link copied'); }}><Copy />Tag link</Button><Button size="sm" variant="ghost" onClick={() => { navigator.clipboard?.writeText(t.manage_url); toast.success('Owner link copied'); }}><Copy />Owner link</Button></span>
                </div>
              ))}
              <p className="px-1 text-xs text-muted-foreground">{result.tags.length > 5 ? 'All tags are in ' : 'Find them again in '}<Link to="/admin/contact-tags" className="text-primary hover:underline">Contact tags</Link> (with a CSV of links for programming the chips). The owner link is private: send it only to the customer.</p>
            </div>
          )}
          {result.renewed && <p className="relative mt-1 font-medium text-success">Plan {o.order_type === 'upgrade' ? 'upgraded, valid until' : 'renewed until'} {new Date(result.renewed.ends_at).toLocaleDateString()}</p>}
          <p className="relative mt-1 text-muted-foreground">{form.name} · {money(cur, o.amount)} · {o.fulfilment === 'digital' ? 'Digital, no shipping' : o.fulfilment === 'collection' ? 'Office collection' : o.is_cod ? 'Cash on delivery' : 'Courier delivery'}</p>
          {acc && (
            <div className="relative mt-6 space-y-2 rounded-2xl border border-border bg-muted/40 p-4 text-left text-sm">
              <p className="flex items-center gap-2 font-semibold"><IdCard className="size-4 text-primary" />{acc.created ? 'Customer account & vCard created' : 'Linked to the existing customer account'}</p>
              {[['E-mail', acc.email], acc.created && ['Password', acc.password], acc.plan && ['Plan', acc.plan]].filter(Boolean).map(([k, v]) => (
                <button key={k} type="button" onClick={() => { navigator.clipboard?.writeText(v); toast.success(`${k} copied`); }} className="flex w-full cursor-pointer items-center justify-between gap-2 rounded-xl bg-card px-3 py-2 text-left hover:ring-1 hover:ring-primary">
                  <span className="text-muted-foreground">{k}</span><span className="flex min-w-0 items-center gap-2 font-mono"><span className="truncate">{v}</span><Copy className="size-3.5 shrink-0 text-muted-foreground" /></span>
                </button>
              ))}
              {acc.vcard_url && <a href={acc.vcard_url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 px-1 text-primary hover:underline"><ExternalLink className="size-3.5" />{acc.vcard_url.replace(/^https?:\/\//, '')}</a>}
              {acc.created && <p className="px-1 text-xs text-muted-foreground">The password is shown only once.</p>}
            </div>
          )}
          <div className="relative mt-6 flex justify-center gap-2">
            {o.order_type === 'sample' && <Button variant="outline" onClick={() => navigate(`/admin/orders/new?sample=${o.id}`)}><Boxes />Bulk order from this sample</Button>}
            {result.guest && <Button variant="outline" onClick={() => navigate(`/admin/guest-customers/${result.guest.id}`)}><UserRound />Guest journey</Button>}
            <Button variant="outline" onClick={restart}><Plus />New order</Button>
            <Button onClick={() => navigate(`/admin/orders/${o.id}`)}>Open order<ArrowRight /></Button>
          </div>
        </Card>
      </motion.div>
    );
  }

  return (
    <>
      {/* compact header: the whole wizard fits on a laptop screen without scrolling */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Tip content="All orders"><Link to="/admin/orders" className="grid size-9 place-items-center rounded-xl border border-border text-muted-foreground transition hover:border-primary hover:text-primary" aria-label="All orders"><ArrowLeft className="size-4" /></Link></Tip>
        <h1 className="font-display text-2xl font-bold">New order</h1>
        <span className="text-sm text-muted-foreground">Phone, WhatsApp, walk-in or other-website orders</span>
        {reorderOf && <Badge tone="primary"><Repeat className="size-3" />Reorder of {reorderOf}</Badge>}
      </div>
      <div className="grid items-start gap-6 lg:grid-cols-[1fr_340px]">
        <Card className="overflow-hidden">
          <div className="border-b border-border px-4 py-3"><Stepper screens={screens} step={step} done={done} onGo={go} /></div>
          <AnimatePresence mode="wait">
            <motion.div key={screen} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.2 }}>
              <CardBody className="min-h-[300px]">
                {screen === 'type' && (
                  <div className="space-y-5">
                    <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
                      {ORDER_TYPES.map((t) => <ChoiceCard key={t.key} active={form.order_type === t.key} onClick={() => pickType(t.key)} icon={t.icon} title={t.title} text={t.text} />)}
                    </div>
                    {form.order_type === 'social' && (
                      <Field label="Which social card?" required error={errors.social_variant}>
                        <Segmented id="sv" value={form.social_variant} onChange={(v) => set('social_variant', v)} options={SOCIAL_VARIANTS.map(({ value, label }) => ({ value, label }))} />
                        {form.social_variant === 'profile' && <p className="mt-2 text-xs text-muted-foreground">The all-in-one card comes with a social profile account on the Social Profile plan: choose New customer in the next step.</p>}
                      </Field>
                    )}
                    {form.order_type === 'wholesale' && (meta.wholesale_tiers || []).length > 0 && (
                      <div className="rounded-2xl bg-primary-soft/40 p-3 text-sm"><p className="mb-1.5 font-semibold">Wholesale pricing (per product)</p>
                        <div className="flex flex-wrap gap-2">{meta.wholesale_tiers.map((t) => <Badge key={t.min} tone="primary">{t.min}+ pcs: {t.percent}% off</Badge>)}</div>
                      </div>
                    )}
                    {form.order_type === 'sample' && <p className="rounded-2xl bg-primary-soft/40 p-3 text-sm text-muted-foreground">Samples are charged at a higher price than normal pieces (up to <b>{sampleMax}</b> per product). When the customer orders in bulk, choose <b>Wholesale</b> and the sample charge is deducted.</p>}
                    {form.order_type === 'card_printing' && <p className="rounded-2xl bg-primary-soft/40 p-3 text-sm text-muted-foreground">The client buys NFC cards and gets them printed with their design. No profile, no plan, no account needed: choose <b>Guest</b> in the next step.</p>}
                    {form.order_type === 'renewal' && <p className="rounded-2xl bg-primary-soft/40 p-3 text-sm text-muted-foreground">Extends an existing customer's plan. The new period starts where the current one ends, and is added as soon as the order is marked <b>Paid</b>. Nothing is shipped.</p>}
                    {form.order_type === 'contact_tag' && <p className="rounded-2xl bg-primary-soft/40 p-3 text-sm text-muted-foreground">One tag is made for every piece. Anyone who scans it can send the owner a message or ask for a call back, and <b>the owner's number is never shown</b>. Enter the owner's phone in the next step: that is where messages go. Each tag gets its own link and QR code, and the owner can edit their details from a private link.</p>}
                    {form.order_type === 'upgrade' && <p className="rounded-2xl bg-primary-soft/40 p-3 text-sm text-muted-foreground">Moves an existing customer to a more expensive plan <b>now</b>. What they paid for the unused time of the current plan is deducted from the price (you can change that amount). The new plan starts when the order is marked <b>Paid</b>. Nothing is shipped.</p>}
                    {form.order_type === 'digital' && <p className="rounded-2xl bg-primary-soft/40 p-3 text-sm text-muted-foreground">No delivery charge and no courier: only the profile and its plan are set up.</p>}
                    <Field label={<span className="flex w-full items-center justify-between">Which website is this order for?<Link to="/admin/order-sources" className="text-xs font-normal text-primary hover:underline">Manage sources</Link></span>} hint="Products and prices come from this website's price list">
                      <Select value={form.order_source_id} onChange={(v) => set('order_source_id', v)} allowEmpty placeholder={meta.sources.length ? 'Phone / walk-in / other (all products)' : 'No sources yet'} options={meta.sources.map((x) => ({ value: x.id, label: x.name }))} />
                    </Field>
                  </div>
                )}

                {screen === 'customer' && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
                      {TYPES.map(([k, l, text, I]) => (
                        <button key={k} type="button" onClick={() => setType(k)} className={cn('flex cursor-pointer items-center gap-2.5 rounded-2xl border-2 p-2.5 text-left transition', form.customer_type === k ? 'border-primary bg-primary-soft/50' : 'border-border hover:border-primary/40')}>
                          <span className={cn('grid size-9 shrink-0 place-items-center rounded-xl', form.customer_type === k ? 'bg-primary text-white' : 'bg-muted text-muted-foreground')}><I className="size-4" /></span>
                          <span className="min-w-0"><span className="block truncate text-sm font-semibold">{l}</span><span className="block truncate text-[11px] text-muted-foreground">{text}</span></span>
                        </button>
                      ))}
                    </div>
                    <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2 xl:grid-cols-3">
                      {form.customer_type === 'existing' && (
                        <Field label="Customer" required error={errors.user_id} className="sm:col-span-2 xl:col-span-3">
                          <SearchSelect value={form.customer} onChange={pickCustomer} search={fetchList('/admin/customers/search')} autoFocus invalid={!!errors.user_id}
                            placeholder="Search by name, e-mail or phone..." empty="No customer found. Use New customer or Guest."
                            renderItem={(u) => <div className="flex items-center justify-between gap-3"><PersonLine p={u} sub={[u.email, u.contact].filter(Boolean).join(' · ')} />{u.organisation_name && <Badge tone="info" className="shrink-0"><Building2 className="size-3" />{u.organisation_name}</Badge>}</div>}
                            renderValue={(u) => <PersonLine p={u} sub={[u.email, u.contact, u.organisation_name].filter(Boolean).join(' · ')} />} />
                        </Field>
                      )}
                      {form.customer_type === 'organisation' && (
                        <>
                          <Field label="Organisation" required error={errors.organisation_id} className="sm:col-span-2">
                            <SearchSelect value={form.organisation} onChange={pickOrganisation} search={fetchList('/admin/organisations/search')} autoFocus invalid={!!errors.organisation_id}
                              placeholder="Search company, owner, e-mail or phone..." empty="No organisation found"
                              renderItem={(o) => <div className="flex items-center gap-3">{o.logo ? <img src={o.logo} alt="" className="size-8 rounded-lg border border-border object-contain" /> : <span className="grid size-8 place-items-center rounded-lg bg-primary-soft text-primary"><Building2 className="size-4" /></span>}<div className="min-w-0"><p className="truncate font-medium">{o.name}</p><p className="truncate text-xs text-muted-foreground">{o.owner} · {o.email}</p></div></div>}
                              renderValue={(o) => <div className="flex items-center gap-3"><Building2 className="size-4 text-primary" /><span className="truncate font-medium">{o.name}</span></div>} />
                          </Field>
                          <Field label="Contact person" error={errors.contact_id} hint="Who asked for this order">
                            <Select value={form.contact_id} onChange={pickContact} placeholder={form.organisation ? 'Owner (default)' : 'Choose the organisation first'} allowEmpty
                              options={people.map((p) => ({ value: p.id, label: `${p.first_name} ${p.last_name} · ${p.company_role || 'member'}` }))} />
                          </Field>
                        </>
                      )}
                      {form.customer_type === 'guest' && (
                        <Field label="Returning guest?" className="sm:col-span-2 xl:col-span-3" hint={form.guest ? 'Their details are filled in below and kept up to date' : 'Optional: find a guest who ordered before, or just fill in the details'}>
                          <SearchSelect value={form.guest} onChange={pickGuest} search={fetchList('/admin/guest-customers')} placeholder="Search guests by name, phone or e-mail..." empty="No guest found - fill in the details below"
                            renderItem={(g) => <PersonLine p={g} sub={[g.phone, g.email, g.orders ? `${g.orders} order(s)` : null].filter(Boolean).join(' · ')} />}
                            renderValue={(g) => <PersonLine p={g} sub={[g.phone, g.email].filter(Boolean).join(' · ') || 'Guest customer'} />} />
                        </Field>
                      )}
                      <Field label={form.customer_type === 'organisation' ? 'Contact name' : 'Customer name'} required error={errors.name}><Input ref={nameRef} value={form.name} onChange={(e) => set('name', e.target.value)} onKeyDown={(e) => e.key === 'Enter' && next()} /></Field>
                      <Field label="Phone" error={errors.phone}><Input value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="Optional · 03xx xxxxxxx" /></Field>
                      <Field label={<span className="flex w-full items-center justify-between gap-2">E-mail{['new', 'guest'].includes(form.customer_type) && <Checkbox id="dummy" checked={form.dummy} onChange={toggleDummy} label="Dummy e-mail" className="text-xs font-normal" />}</span>} required={form.customer_type === 'new'} error={errors.email} hint={form.dummy ? `On ${meta.dummy_domain} · no e-mails are sent to it` : undefined}>
                        <div className="flex gap-2">
                          <Input value={form.email} onChange={(e) => set('email', e.target.value)} type="email" className="flex-1" readOnly={form.dummy} placeholder={form.customer_type === 'new' ? 'Login e-mail' : 'Optional'} />
                          {form.dummy && <Tip content="Generate another"><Button type="button" variant="outline" size="icon" onClick={() => set('email', dummyEmail(form.name, meta.dummy_domain))} aria-label="Generate another dummy e-mail"><Wand2 /></Button></Tip>}
                        </div>
                      </Field>
                      {form.customer_type !== 'organisation' && <Field label="Company"><Input value={form.company_name} onChange={(e) => set('company_name', e.target.value)} placeholder="Optional" /></Field>}
                      <Field label="City"><Input value={form.city} onChange={(e) => set('city', e.target.value)} placeholder="Optional" /></Field>
                      <Field label="Address" className={form.customer_type === 'organisation' ? 'sm:col-span-2 xl:col-span-3' : 'sm:col-span-2'}><Input value={form.address} onChange={(e) => set('address', e.target.value)} placeholder="Optional · not needed for office collection" /></Field>
                    </div>
                    {form.customer_type === 'new' && <p className="flex items-center gap-2 rounded-xl bg-primary-soft/50 px-3 py-2 text-xs text-muted-foreground"><Sparkles className="size-4 shrink-0 text-primary" />A login and a starter vCard are created and linked to this order. The plan comes from the products; an existing account with this e-mail is reused.</p>}
                  </div>
                )}

                {screen === 'products' && (
                  <div className="space-y-3">
                    <Catalog meta={meta} offered={offered} lines={lines} setLines={setLines} quote={quote} valid={valid} form={form} cur={cur} sampleMax={sampleMax} refresh={refresh} onRefresh={() => doRefresh(true)} />
                    {errors.products && <p className="text-sm text-danger">{errors.products}</p>}
                    {form.order_type === 'wholesale' && meta.sample_credit_enable && (
                      <div className="rounded-2xl border border-border p-3">
                        <p className="mb-2 text-sm font-semibold">Samples already paid for?</p>
                        <SearchSelect value={form.sample_order} onChange={(o) => set('sample_order', o)} search={(q) => api.get('/admin/sample-orders', { params: { q } }).then(({ data }) => data.data)} placeholder="Find the sample order (number, name or phone)..." empty="No open sample orders"
                          renderItem={(o) => <div className="flex items-center justify-between gap-3"><span className="min-w-0 truncate">{o.order_number} · {o.name}</span><Badge tone="success" className="shrink-0">Credit {money(cur, o.credit)}</Badge></div>}
                          renderValue={(o) => <span className="truncate">{o.order_number}{o.name ? ` · ${o.name}` : ''} <span className="text-success">(credit {money(cur, o.credit)})</span></span>} />
                        {form.sample_order && <button type="button" onClick={() => set('sample_order', null)} className="mt-2 cursor-pointer text-xs text-muted-foreground hover:text-danger">Remove credit</button>}
                      </div>
                    )}
                    {PLAN_CHANGE.includes(form.order_type) && (
                      <div className="space-y-3 rounded-2xl border border-border p-3 text-sm">
                        {subInfo === undefined ? <p className="text-muted-foreground">Choose the customer first.</p> : subInfo === null ? <p className="text-muted-foreground">This customer has no plan yet{form.order_type === 'upgrade' ? ': use Renewal instead.' : ': the renewal starts today.'}</p>
                          : <p><b>{subInfo.plan}</b> {subInfo.expired ? <span className="text-danger">expired on {new Date(subInfo.ends_at).toLocaleDateString()}</span> : <>runs until <b>{new Date(subInfo.ends_at).toLocaleDateString()}</b></>}.{' '}
                            {form.order_type === 'renewal' ? <>The renewal {subInfo.expired ? 'starts today' : 'starts after that date'}.</> : subInfo.expired ? <span className="text-danger">It has expired: use Renewal instead.</span> : <>Choose the plan to upgrade to below.</>}</p>}
                        {form.order_type === 'upgrade' && subInfo && !subInfo.expired && (
                          <Field label="Credit for the unused time" hint={`Calculated from what they paid (${money(cur, subInfo.paid)}) and the time left. Leave empty to use it.`}>
                            <Input type="number" min="0" value={form.plan_credit} onChange={(e) => set('plan_credit', e.target.value)} placeholder={String(subInfo.unused_credit)} className="max-w-48" />
                          </Field>
                        )}
                      </div>
                    )}
                    {kinds && !showAll && offered.length === 0 && <p className="rounded-xl bg-warning-soft px-3 py-2 text-xs text-warning">No products are tagged for this order type{form.order_source_id ? ' on this website' : ''} yet. Tag them in Order sources &gt; Price list, or show all products.</p>}
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">{valid.length ? `${valid.length} product${valid.length > 1 ? 's' : ''} selected` : 'Set a quantity to add a product'}</span>
                      <div className="flex items-center gap-3">{kinds && <Checkbox id="showall" checked={showAll} onChange={setShowAll} label="Show all products" className="text-xs" />}<Link to="/admin/products" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"><Settings2 className="size-3.5" />Products & plans</Link></div>
                    </div>
                  </div>
                )}

                {screen === 'delivery' && (
                  <div className="space-y-5">
                    {noShip(form.order_type) ? (
                      <div className="rounded-2xl bg-primary-soft/40 p-4 text-sm"><p className="flex items-center gap-2 font-semibold"><Smartphone className="size-4 text-primary" />{{ renewal: 'Renewal', upgrade: 'Upgrade' }[form.order_type] || 'Digital profile'}: nothing to ship</p><p className="mt-1 text-muted-foreground">No delivery or COD charges. Just record the payment.</p></div>
                    ) : <div className="grid gap-3 sm:grid-cols-2">
                      <ChoiceCard active={form.fulfilment === 'delivery'} onClick={() => { set('fulfilment', 'delivery'); if (form.payment === 'collection') set('payment', 'cod'); }} icon={Truck} title="Courier delivery" text="Sent by courier to the customer's address" />
                      <ChoiceCard active={form.fulfilment === 'collection'} onClick={() => { set('fulfilment', 'collection'); if (form.payment === 'cod') set('payment', 'collection'); }} icon={Store} title="Office collection" text="Customer collects from the office. No delivery or COD charges." />
                    </div>}
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field label="Payment">
                        <Segmented id="pay" value={form.payment} onChange={(v) => set('payment', v)} options={noShip(form.order_type) ? [{ value: 'paid', label: 'Paid' }, { value: 'pending', label: 'Unpaid' }] : form.fulfilment === 'collection'
                          ? [{ value: 'collection', label: 'Pay at collection' }, { value: 'paid', label: 'Paid' }]
                          : [{ value: 'cod', label: 'COD' }, { value: 'paid', label: 'Paid' }, { value: 'pending', label: 'Unpaid' }]} />
                      </Field>
                      {form.fulfilment === 'delivery' && !noShip(form.order_type) && (
                        <Field label="Delivery charges" hint={`Empty = default (${money(cur, quote?.delivery_default ?? meta.delivery_charges)})`}><Input type="number" min="0" value={form.delivery_charges} onChange={(e) => set('delivery_charges', e.target.value)} placeholder={String(quote?.delivery_default ?? meta.delivery_charges)} /></Field>
                      )}
                    </div>
                    <div className="rounded-2xl border border-border p-4">
                      <p className="mb-3 flex items-center gap-2 text-sm font-semibold"><BadgePercent className="size-4 text-primary" />Discount</p>
                      <div className="flex flex-wrap items-start gap-3">
                        <Segmented id="dt" value={form.discount_type} onChange={(v) => set('discount_type', v)} options={[{ value: 'fixed', label: `Fixed (${cur})` }, { value: 'percent', label: 'Percent (%)' }]} />
                        <Field error={errors.discount_value} className="w-40"><Input type="number" min="0" max={form.discount_type === 'percent' ? 100 : undefined} value={form.discount_value} onChange={(e) => set('discount_value', e.target.value)} placeholder={form.discount_type === 'percent' ? 'e.g. 10' : 'e.g. 500'} suffix={form.discount_type === 'percent' ? '%' : cur} /></Field>
                        {quote?.discount > 0 && <Badge tone="success" className="mt-2">Saves {money(cur, quote.discount)}</Badge>}
                      </div>
                    </div>
                    <Field label="Internal note" hint="Only staff see this"><Textarea rows={2} value={form.admin_note} onChange={(e) => set('admin_note', e.target.value)} /></Field>
                  </div>
                )}

                {screen === 'review' && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <ReviewBlock title="Customer" icon={User} onEdit={() => goTo('customer')} rows={[
                      ['Order type', `${TYPE_TITLE[form.order_type]}${form.order_type === 'social' && form.social_variant ? ` · ${SOCIAL_VARIANTS.find((v) => v.value === form.social_variant)?.label}` : ''}`],
                      ['Type', `${TYPE_LABEL[form.customer_type]}${form.customer_type === 'organisation' && form.organisation ? ` · ${form.organisation.name}` : ''}`],
                      ['Name', form.name], ['Phone', form.phone || '-'], ['E-mail', form.email ? `${form.email}${form.dummy ? ' (dummy)' : ''}` : '-'],
                      ['Company', form.company_name || '-'], ['Address', [form.address, form.city].filter(Boolean).join(', ') || '-'], ['Source', srcName || '-'],
                    ]} />
                    <ReviewBlock title="Delivery & payment" icon={Banknote} onEdit={() => goTo('delivery')} rows={[
                      ['Fulfilment', noShip(form.order_type) ? 'No shipping' : form.fulfilment === 'collection' ? 'Office collection' : 'Courier delivery'],
                      ['Payment', { cod: 'Cash on delivery', paid: 'Paid', pending: 'Unpaid', collection: 'Pay at collection' }[form.payment]],
                      ['Sample credit', quote?.sample_credit > 0 ? money(cur, quote.sample_credit) : 'None'],
                      ...(form.order_type === 'upgrade' ? [['Credit for unused time', quote?.plan_credit > 0 ? money(cur, quote.plan_credit) : 'None']] : []),
                      ['Discount', quote?.discount > 0 ? `${money(cur, quote.discount)}${quote.discount_type === 'percent' ? ` (${quote.discount_value}%)` : ''}` : 'None'],
                      ['Note', form.admin_note || '-'],
                    ]} />
                    <ReviewBlock title="Products" icon={Package} onEdit={() => goTo('products')} className="sm:col-span-2" rows={(quote?.lines || []).map((l) => [
                      `${l.name}${l.variant ? ` · ${l.variant}` : ''}`, `${l.quantity} × ${money(cur, l.unit_price)} = ${money(cur, l.total)}${l.plan ? ` · Plan: ${l.plan.name}` : ' · Non-plan'}`,
                    ])} />
                  </div>
                )}
              </CardBody>
            </motion.div>
          </AnimatePresence>
          <div className="flex items-center justify-between gap-2 border-t border-border px-5 py-3.5">
            <Button variant="ghost" onClick={() => (step ? setStep(step - 1) : navigate('/admin/orders'))}><ArrowLeft />{step ? 'Back' : 'Cancel'}</Button>
            <span className="text-xs text-muted-foreground">Step {step + 1} of {screens.length}</span>
            {step < screens.length - 1
              ? <Button onClick={next}>Next<ArrowRight /></Button>
              : <Button onClick={create} loading={busy} disabled={!quote || quote.error}><Check />Create order{quote?.total ? ` · ${money(cur, quote.total)}` : ''}</Button>}
          </div>
        </Card>
        <Summary meta={meta} quote={quote} lines={lines} form={form} setForm={set} loading={quoting} />
      </div>
    </>
  );
}

function ReviewBlock({ title, icon: Icon, rows, onEdit, className }) {
  return (
    <div className={cn('rounded-2xl border border-border p-4', className)}>
      <div className="mb-2 flex items-center justify-between"><p className="flex items-center gap-2 text-sm font-semibold"><Icon className="size-4 text-primary" />{title}</p><button type="button" onClick={onEdit} className="cursor-pointer text-xs text-primary hover:underline">Edit</button></div>
      <dl className="space-y-1 text-sm">{rows.map(([k, v], i) => <div key={i} className="flex justify-between gap-4"><dt className="shrink-0 whitespace-nowrap text-muted-foreground">{k}</dt><dd className="min-w-0 text-right break-words">{v}</dd></div>)}</dl>
    </div>
  );
}

