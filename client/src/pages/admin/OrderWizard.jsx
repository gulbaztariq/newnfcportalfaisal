/* Admin: new order on ONE page (phone / WhatsApp / walk-in / other websites). Staff only - the website checkout is separate. */
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'motion/react';
import { toast } from 'sonner';
import { ArrowLeft, ArrowRight, Check, Plus, Trash2, Copy, ShoppingBag, ShieldCheck, Link2, IdCard, Boxes, UserRound, Repeat } from 'lucide-react';
import api from '@/lib/api';
import { MadeLinks } from './LinkGenerator';
import SearchSelect from '@/components/SearchSelect';
import { cn } from '@/lib/cn';
import { Card, CardHeader, CardBody, Button, Field, Input, Textarea, Select, Segmented, Badge, Tip, Skeleton, run } from '@/components/ui';

/* order types: what the customer wants decides the pricing rules and whether anything ships */
const ORDER_TYPES = [
  { key: 'nfc_profile', title: 'NFC Business Card', text: 'Business card linked to a profile on our portal' },
  { key: 'social', title: 'Social / review card', text: 'Static link, dynamic link or all-in-one social profile' },
  { key: 'wholesale', title: 'Wholesale', text: 'Bulk quantities with quantity discounts' },
  { key: 'sample', title: 'Samples first', text: 'Paid samples, credited to the bulk order later' },
  { key: 'card_printing', title: 'Card + printing', text: 'NFC card with your print, no profile or plan' },
  { key: 'printing', title: 'Printing only', text: 'Printing service on cards the client already has' },
  { key: 'reprint', title: 'Card reprinting', text: 'Same design again on a new card: metal, wood, PVC and more' },
  { key: 'digital', title: 'Digital profile only', text: 'Profile and plan, nothing shipped' },
  { key: 'renewal', title: 'Renewal', text: 'Extend an existing customer\'s plan' },
  { key: 'upgrade', title: 'Upgrade plan', text: 'Move a customer to a higher plan, unused time credited' },
  { key: 'contact_tag', title: 'Car contact tag', text: 'Tag for a car: anyone can reach the owner, number hidden' },
  { key: 'airport_tag', title: 'Airport tag', text: 'Luggage tag: a finder can reach the owner, number hidden' },
];
const TAG_TYPES = ['contact_tag', 'airport_tag'];
const NO_SHIP = ['digital', 'renewal', 'upgrade'];
const PLAN_CHANGE = ['renewal', 'upgrade']; // an existing customer's plan changes: nothing is delivered
const SOCIAL_KIND = { social_static: 'static', social_dynamic: 'dynamic', social_profile: 'profile' };
const LINK_KINDS = [{ value: 'vcard', label: 'Business card (vCard)' }, { value: 'review', label: 'Review link' }, { value: 'redirect', label: 'Redirect link' }];
const afterDisc = (price, t, v) => Math.max(0, t === 'percent' ? price * (1 - Math.min(100, Number(v) || 0) / 100) : t === 'fixed' ? price - (Number(v) || 0) : price);
let lineId = 0;
const newLine = () => ({ key: ++lineId, product_id: '', variant: '', quantity: 1, unit_price: '' });
const money = (cur, v) => `${cur} ${Number(v || 0).toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
const fetchList = (url) => (q) => api.get(url, { params: { q, search: q, per_page: 15 } }).then(({ data }) => data.data);
const PersonLine = ({ p, sub }) => <div className="min-w-0"><p className="truncate font-medium">{p.name}</p><p className="truncate text-xs text-muted-foreground">{sub}</p></div>;
/** which order type a product is sold as: its kind says so, everything else is a normal NFC product */
function deriveType(p) {
  const k = p?.product_kind;
  if (k === 'blank_card') return 'card_printing';
  if (['printing', 'reprint', 'digital', 'contact_tag', 'airport_tag'].includes(k)) return k;
  if (k && k.startsWith('social_')) return 'social';
  return 'nfc_profile';
}
const decimal = (v) => v.replace(/[^\d.]/g, '').replace(/(\..*)\./g, '$1');

/** price per piece shown before the server quotes it (type, tier, product discount) */
function estimate(meta, p, variant, qty, type) {
  const delta = Number((p.variants || []).find((v) => v.name === variant)?.price_delta || 0);
  const base = Number(p.price || 0) + delta;
  const disc = afterDisc(base, p.discount_type, p.discount_value);
  if (type === 'sample') return Number(p.sample_price) > 0 ? Number(p.sample_price) + delta : base * (1 + Number(meta.sample_markup_percent || 0) / 100);
  if (type === 'wholesale') {
    if (p.no_wholesale_tiers) return disc;
    const tier = (Array.isArray(p.wholesale_tiers) && p.wholesale_tiers.length ? p.wholesale_tiers : meta.wholesale_tiers || []).filter((t) => Number(t.min) <= Number(qty || 1)).at(-1);
    return disc * (1 - (tier?.percent || 0) / 100);
  }
  return disc;
}

export default function OrderWizard() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [meta, setMeta] = useState(null);
  const [lines, setLines] = useState([newLine()]);
  const [form, setValues] = useState({
    type_override: '', order_source_id: '', name: '', phone: '', email: '', customer: null, guest: null,
    discount_type: 'fixed', discount_value: '', payment: 'cod', advance_amount: '', payment_account_id: '', admin_note: '', sample_order: null, plan_credit: '',
    make_links: false, link_kind: 'vcard', link_plan_id: '', link_qty: '', more: false,
  });
  const [errors, setErrors] = useState({});
  const [quote, setQuote] = useState(null);
  const [quoting, setQuoting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [reorderOf, setReorderOf] = useState(null);
  const [totalText, setTotalText] = useState(null); // what is being typed in the Total amount box
  const [subInfo, setSubInfo] = useState(undefined); // current plan of the customer being renewed
  const set = (k, v) => { setValues((f) => ({ ...f, [k]: v })); setErrors((e) => ({ ...e, [k]: undefined })); };
  useEffect(() => { api.get('/admin/orders-meta').then(({ data }) => setMeta(data)); }, []);
  useEffect(() => { setErrors((e) => (e.products ? { ...e, products: undefined } : e)); }, [lines]);

  const products = useMemo(() => Object.fromEntries((meta?.products || []).map((p) => [p.id, p])), [meta]);
  const valid = lines.filter((l) => l.product_id);
  // the product decides the order type (its kind, set on the Products page); "More options" can override it
  const type = form.type_override || deriveType(products[valid[0]?.product_id]);
  const planChange = PLAN_CHANGE.includes(type);
  const noShip = NO_SHIP.includes(type);
  const tagType = TAG_TYPES.includes(type);
  const cod = form.payment === 'cod' && !noShip;
  const cur = meta?.currency;
  const sampleMax = meta?.sample_max_qty || 5;

  // no cash on delivery for plan orders: a stale choice is corrected
  useEffect(() => { if (noShip && form.payment === 'cod') setValues((f) => ({ ...f, payment: 'online' })); }, [noShip]); // eslint-disable-line
  // online payment: the money went into one of your payment methods; the first one is chosen until told otherwise
  useEffect(() => { if (meta?.accounts?.length) setValues((f) => (f.payment_account_id ? f : { ...f, payment_account_id: String(meta.accounts[0].id) })); }, [meta]);

  // every product added on the Products page is in the list; renewals and upgrades sell plans only (an upgrade only offers a dearer one)
  const renewFor = form.customer?.id;
  useEffect(() => {
    if (!planChange || !renewFor) { setSubInfo(undefined); return; }
    api.get(`/admin/customers/${renewFor}/subscription`).then(({ data }) => setSubInfo(data.data)).catch(() => setSubInfo(null));
  }, [planChange, renewFor]);
  const pool = useMemo(() => (meta?.products || []).filter((p) => !planChange || (p.plan_id && (type !== 'upgrade' || !subInfo || (p.plan_id !== subInfo.plan_id && Number(p.plan?.price) > Number(subInfo.plan_price))))), [meta, planChange, type, subInfo]);

  const payload = () => ({
    items: valid.map(({ product_id, variant, quantity, unit_price }) => ({ product_id, variant, quantity, unit_price, customization: false })),
    order_type: type, social_variant: type === 'social' ? SOCIAL_KIND[products[valid[0]?.product_id]?.product_kind] : undefined,
    sample_order_id: type === 'wholesale' ? form.sample_order?.id : undefined, plan_credit: type === 'upgrade' && form.plan_credit !== '' ? form.plan_credit : undefined,
    fulfilment: noShip ? 'digital' : cod ? 'delivery' : 'collection', is_cod: cod, delivery_charges: '', details_later: true,
    discount_type: form.discount_type, discount_value: form.discount_value === '' ? 0 : form.discount_value,
  });
  // live price from the server (the same rules as the saved order)
  useEffect(() => {
    if (!valid.length || valid.some((l) => products[l.product_id]?.variants?.length && !l.variant)) { setQuote(null); return undefined; }
    setQuoting(true);
    const t = setTimeout(() => api.post('/admin/orders/quote', payload()).then(({ data }) => setQuote(data)).catch((e) => setQuote({ error: e.message })).finally(() => setQuoting(false)), 300);
    return () => clearTimeout(t);
  }, [JSON.stringify(payload()), products]); // eslint-disable-line

  // prefill: ?reorder=<order id>, ?bulk=<order id> / ?sample=<order id>, ?guest=<id>
  useEffect(() => {
    if (!meta) return;
    const fill = (patch) => setValues((f) => ({ ...f, ...patch }));
    const person = (o) => (o.guest_customer_id ? { guest: { id: o.guest_customer_id, name: o.guest?.name || o.name, phone: o.phone } } : o.user_id ? { customer: { id: o.user_id, name: `${o.user?.first_name || ''} ${o.user?.last_name || ''}`.trim() || o.name, email: o.user?.email } } : {});
    const base = (o) => ({ name: o.name, phone: o.phone || '', email: o.email || '', order_source_id: o.order_source_id ? String(o.order_source_id) : '', ...person(o) });
    if (params.get('reorder')) {
      api.get(`/admin/orders/${params.get('reorder')}`).then(({ data }) => {
        const o = data.data;
        fill({ ...base(o), payment: o.is_cod ? 'cod' : 'online', discount_type: o.discount_type || 'fixed', discount_value: Number(o.discount) ? String(Number(o.discount_value) || Number(o.discount)) : '' });
        setLines(o.items?.length ? o.items.map((it) => ({ key: ++lineId, product_id: it.nfc_card_id, variant: it.variant || '', quantity: it.quantity, unit_price: String(Number(it.unit_price)) })) : [newLine()]);
        setReorderOf(o.order_number);
      }).catch(() => toast.error('Could not load the order to reorder'));
    } else if (params.get('bulk') || params.get('sample')) {
      api.get(`/admin/orders/${params.get('bulk') || params.get('sample')}`).then(({ data }) => {
        const o = data.data; const minQty = meta.wholesale_tiers?.[0]?.min || 25;
        fill({ ...base(o), type_override: 'wholesale', sample_order: o.order_type === 'sample' ? { id: o.id, order_number: o.order_number, credit: (o.items || []).reduce((a, i) => a + Number(i.total), 0) } : null });
        setLines((o.items?.length ? o.items : []).map((it) => ({ key: ++lineId, product_id: it.nfc_card_id, variant: it.variant || '', quantity: minQty, unit_price: '' })));
        setReorderOf(`bulk from ${o.order_number}`);
      }).catch(() => toast.error('Could not load the order'));
    } else if (params.get('guest')) {
      api.get(`/admin/guest-customers/${params.get('guest')}`).then(({ data }) => { const g = data.data; fill({ guest: g, name: g.name, phone: g.phone || '', email: g.email || '' }); });
    }
  }, [meta]); // eslint-disable-line

  const pickType = (key) => {
    const next = key || deriveType(products[valid[0]?.product_id]);
    if (PLAN_CHANGE.includes(next) !== planChange) setLines([newLine()]); // plans and physical products never share one order
    setValues((f) => ({ ...f, type_override: key, sample_order: next === 'wholesale' ? f.sample_order : null, customer: PLAN_CHANGE.includes(next) ? f.customer : null }));
  };
  const setLine = (key, patch) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const pickProduct = (key, p) => setLine(key, { product_id: p ? p.id : '', variant: p?.variants?.[0]?.name ?? '', unit_price: '', quantity: type === 'sample' ? 1 : (type === 'wholesale' && p ? Number(meta.wholesale_tiers?.[0]?.min) || 1 : 1) });
  const setQty = (l, raw) => { let n = Math.max(1, parseInt(raw, 10) || 1); if (type === 'sample') n = Math.min(sampleMax, n); setLine(l.key, { quantity: n }); };
  const srcName = (id) => meta.sources.find((x) => x.id === id)?.name;
  const searchProducts = (key) => (q) => {
    const t = q.trim().toLowerCase(); const taken = new Set(valid.filter((l) => l.key !== key).map((l) => String(l.product_id)));
    return Promise.resolve(pool.filter((p) => !taken.has(String(p.id)) && (!t || `${p.name} ${p.sku || ''} ${p.category || ''} ${srcName(p.order_source_id) || ''}`.toLowerCase().includes(t))).slice(0, 500));
  };
  const first = valid[0];
  const linkCount = Math.max(1, parseInt(form.link_qty, 10) || Number(first?.quantity) || 1);
  const linkNeedsPlan = form.link_kind !== 'review';

  const validate = () => {
    const e = {};
    if (planChange) { if (!form.customer) e.customer = 'Search and choose the customer'; } else if (!form.name.trim()) e.name = 'Enter the name of the client';
    if (!valid.length) e.products = 'Select a product';
    else if (valid.some((l) => products[l.product_id]?.variants?.length && !l.variant)) e.products = 'Choose an option for every product';
    else if (valid.some((l) => l.unit_price !== '' && Number(l.unit_price) < 0)) e.products = 'Prices cannot be negative';
    else if (type === 'sample' && valid.some((l) => Number(l.quantity) > sampleMax)) e.products = `Samples are limited to ${sampleMax} pieces per product`;
    if (form.phone && !/^\+?[\d\s().-]{7,20}$/.test(String(form.phone).trim())) e.phone = 'Phone number is not valid. Use digits only, like 03001234567';
    if (tagType && String(form.phone).replace(/\D/g, '').length < 7) e.phone = 'The tag owner\'s phone number is needed: messages are sent there';
    if (form.discount_type === 'percent' && Number(form.discount_value) > 100) e.discount_value = 'A percentage cannot be more than 100';
    if (form.payment === 'online' && !form.payment_account_id) e.payment_account_id = 'Choose where the money was received';
    if (form.payment === 'advance') { const a = Number(form.advance_amount); if (!(a > 0)) e.advance_amount = 'Enter the advance received'; else if (quote && !quote.error && a > Number(quote.total)) e.advance_amount = 'The advance is more than the order total'; }
    if (form.make_links && linkNeedsPlan && !form.link_plan_id) e.link_plan_id = 'Choose the plan of the link';
    return e;
  };
  const create = async () => {
    const e = validate(); setErrors(e);
    if (Object.keys(e).length) { toast.error(Object.values(e)[0]); return; }
    setBusy(true);
    try {
      const body = {
        ...payload(), name: planChange ? form.customer.name : form.name, phone: form.phone, email: form.email,
        order_source_id: form.order_source_id || undefined, admin_note: form.admin_note,
        customer_type: planChange ? 'existing' : 'guest', user_id: planChange ? form.customer.id : undefined, guest_customer_id: planChange ? undefined : form.guest?.id,
        payment_status: form.payment === 'online' ? 'paid' : 'pending', payment_type: form.payment === 'cod' ? undefined : form.payment, advance_amount: form.payment === 'advance' ? form.advance_amount : undefined,
        payment_account_id: form.payment !== 'cod' && form.payment_account_id ? form.payment_account_id : undefined,
      };
      const d = await run(api.post('/admin/orders', body));
      let made = null;
      if (form.make_links) {
        try { made = (await api.post('/admin/links/generate', { order_id: d.data.id, user_id: d.data.user_id || form.customer?.id || undefined, links: [{ kind: form.link_kind, plan_id: linkNeedsPlan ? Number(form.link_plan_id) : undefined, qty: linkCount }] })).data.data; }
        catch (err) { toast.error(`The order was created, but the links were not: ${err.errors ? Object.values(err.errors)[0] : err.message}. Add them from the Short links page.`); }
      }
      setResult({ ...d, links: made });
    } catch (err) { setErrors(err.errors || {}); } finally { setBusy(false); }
  };
  const restart = () => { setResult(null); setLines([newLine()]); setQuote(null); setReorderOf(null); setValues((f) => ({ ...f, customer: null, guest: null, name: '', phone: '', email: '', discount_value: '', advance_amount: '', admin_note: '', make_links: false, link_qty: '', sample_order: null })); };

  if (!meta) return <div className="grid gap-6 lg:grid-cols-[1fr_340px]"><Skeleton className="h-[520px] rounded-3xl" /><Skeleton className="h-80 rounded-3xl" /></div>;

  if (result) {
    const o = result.data;
    return (
      <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} className="mx-auto max-w-xl">
        <Card className="relative overflow-hidden p-8 text-center">
          <div className="absolute -top-24 left-1/2 size-72 -translate-x-1/2 rounded-full bg-success/20 blur-3xl" />
          <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 18 }} className="relative mx-auto grid size-16 place-items-center rounded-2xl bg-success text-white shadow-lift"><Check className="size-8" /></motion.span>
          <h2 className="relative mt-4 font-display text-2xl font-bold">Order {o.order_number} created</h2>
          {result.tags?.length > 0 && (
            <div className="relative mt-6 space-y-2 rounded-2xl border border-border bg-muted/40 p-4 text-left text-sm">
              <p className="flex items-center gap-2 font-semibold"><ShieldCheck className="size-4 text-primary" />{result.tags.length} {o.order_type === 'airport_tag' ? 'airport' : 'car contact'} tag{result.tags.length > 1 ? 's' : ''} created</p>
              {result.tags.slice(0, 5).map((t) => (
                <div key={t.id} className="flex items-center justify-between gap-2 rounded-xl bg-card px-3 py-2">
                  <span className="font-mono font-semibold">{t.code}</span>
                  <span className="flex gap-1"><Button size="sm" variant="ghost" onClick={() => { navigator.clipboard?.writeText(t.url); toast.success('Tag link copied'); }}><Copy />Tag link</Button><Button size="sm" variant="ghost" onClick={() => { navigator.clipboard?.writeText(t.manage_url); toast.success('Owner link copied'); }}><Copy />Owner link</Button></span>
                </div>
              ))}
              <p className="px-1 text-xs text-muted-foreground">{result.tags.length > 5 ? 'All tags are in ' : 'Find them again in '}<Link to="/admin/orders?view=tags" className="text-primary hover:underline">Contact tags</Link>. The owner link is private: send it only to the customer.</p>
            </div>
          )}
          {result.renewed && <p className="relative mt-1 font-medium text-success">Plan {o.order_type === 'upgrade' ? 'upgraded, valid until' : 'renewed until'} {new Date(result.renewed.ends_at).toLocaleDateString()}</p>}
          <p className="relative mt-1 text-muted-foreground">{planChange ? form.customer?.name : form.name} · {money(cur, o.amount)} · {o.fulfilment === 'digital' ? 'Digital, no shipping' : o.fulfilment === 'collection' ? 'No delivery' : o.is_cod ? 'Cash on delivery' : 'Courier delivery'}</p>
          {result.links?.length > 0 && <div className="relative mt-6 space-y-2 rounded-2xl border border-border bg-muted/40 p-4 text-left text-sm"><p className="flex items-center gap-2 font-semibold"><Link2 className="size-4 text-primary" />{result.links.length} link{result.links.length === 1 ? '' : 's'} generated</p><MadeLinks made={result.links} /></div>}
          <div className="relative mt-6 flex flex-wrap justify-center gap-2">
            {o.order_type === 'sample' && <Button variant="outline" onClick={() => navigate(`/admin/orders/new?sample=${o.id}`)}><Boxes />Bulk order from this sample</Button>}
            {result.guest && <Button variant="outline" onClick={() => navigate(`/admin/guest-customers/${result.guest.id}`)}><UserRound />Guest journey</Button>}
            <Button variant="outline" onClick={restart}><Plus />New order</Button>
            <Button onClick={() => navigate(`/admin/orders/${o.id}`)}>Open order<ArrowRight /></Button>
          </div>
        </Card>
      </motion.div>
    );
  }

  const typeInfo = ORDER_TYPES.find((t) => t.key === type);
  const l0 = valid[0]; const ql0 = l0 ? quote?.lines?.[0] : null;
  const unit0 = l0 ? (l0.unit_price !== '' ? Number(l0.unit_price) : ql0 ? Number(ql0.unit_price) : estimate(meta, products[l0.product_id], l0.variant, Number(l0.quantity) || 1, type)) : 0;
  const totalDerived = valid.length === 1 ? Math.round(unit0 * (Number(l0.quantity) || 1) * 100) / 100 : Number(quote?.subtotal || 0);
  const advance = Number(form.advance_amount) || 0;
  const total = quote && !quote.error ? Number(quote.total) : 0;
  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Tip content="All orders"><Link to="/admin/orders" className="grid size-9 place-items-center rounded-xl border border-border text-muted-foreground transition hover:border-primary hover:text-primary" aria-label="All orders"><ArrowLeft className="size-4" /></Link></Tip>
        <h1 className="font-display text-2xl font-bold">New order</h1>
        <span className="text-sm text-muted-foreground">Phone, WhatsApp, walk-in or other-website orders</span>
        {reorderOf && <Badge tone="primary"><Repeat className="size-3" />Reorder of {reorderOf}</Badge>}
      </div>
      <div className="grid items-start gap-5 lg:grid-cols-[1fr_330px]">
        <Card>
          <CardBody className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Order source" hint="The website or channel this order came from">
                <Select value={form.order_source_id} onChange={(v) => set('order_source_id', v)} allowEmpty placeholder="Choose the source" options={meta.sources.map((x) => ({ value: x.id, label: x.name }))} />
              </Field>
              {planChange ? (
                <Field label="Client" required error={errors.customer} hint={subInfo === undefined ? 'The plan of this customer is renewed or upgraded' : subInfo === null ? 'This customer has no plan yet' : `${subInfo.plan}${subInfo.expired ? ' expired' : ' runs'} until ${new Date(subInfo.ends_at).toLocaleDateString()}`}>
                  <SearchSelect value={form.customer} onChange={(u) => set('customer', u)} search={fetchList('/admin/customers/search')} invalid={!!errors.customer} placeholder="Search by name, e-mail or phone..." empty="No customer found"
                    renderItem={(u) => <PersonLine p={u} sub={[u.email, u.contact].filter(Boolean).join(' · ')} />} renderValue={(u) => <PersonLine p={u} sub={[u.email, u.contact].filter(Boolean).join(' · ')} />} />
                </Field>
              ) : (
                <Field label="Name of client" required error={errors.name}><Input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Client name" autoComplete="off" /></Field>
              )}
            </div>

            {/* products: every product added on the Products page is in the list */}
            <div className="space-y-3">
              <div><p className="text-sm font-semibold">Product</p><p className="text-xs text-muted-foreground">Every product from your Products page is in this list. It also decides the order type: {typeInfo?.title}.</p></div>
              {lines.map((l, i) => {
                const p = products[l.product_id];
                const qty = Number(l.quantity) || 1;
                const ql = p ? quote?.lines?.[valid.findIndex((x) => x.key === l.key)] : null;
                const unit = ql ? Number(ql.unit_price) : p ? estimate(meta, p, l.variant, qty, type) : 0;
                const where = (x) => [srcName(x.order_source_id) || 'Own products', x.category].filter(Boolean).join(' · ');
                return (
                  <div key={l.key} className="space-y-2 rounded-2xl border border-border p-3">
                    <div className="flex items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <SearchSelect value={p || null} onChange={(x) => pickProduct(l.key, x)} search={searchProducts(l.key)} invalid={!!errors.products && !p}
                          placeholder={`Select a product (${pool.length} available)...`} empty="No product found"
                          renderItem={(x) => <div className="flex items-center justify-between gap-3"><div className="min-w-0"><p className="truncate font-medium">{x.name}</p><p className="truncate text-xs text-muted-foreground">{where(x)}</p></div><span className="shrink-0 text-xs text-muted-foreground tabular-nums">{money(cur, x.price)}</span></div>}
                          renderValue={(x) => <div className="min-w-0"><p className="truncate font-medium">{x.name}</p><p className="truncate text-xs text-muted-foreground">{where(x)}</p></div>} />
                      </div>
                      {lines.length > 1 && <Button size="icon" variant="ghost" onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))} aria-label="Remove product"><Trash2 /></Button>}
                    </div>
                    {p && (
                      <div className="grid gap-3 sm:grid-cols-3">
                        {p.variants?.length > 0 && <Field label="Option" className="sm:col-span-3"><Select value={l.variant} onChange={(v) => setLine(l.key, { variant: v, unit_price: '' })} options={p.variants.map((v) => ({ value: v.name, label: `${v.name}${Number(v.price_delta) ? ` (+${v.price_delta})` : ''}` }))} /></Field>}
                        <Field label="Qty"><Input type="text" inputMode="numeric" autoComplete="off" value={l.quantity} onChange={(e) => setQty(l, e.target.value)} /></Field>
                        <Field label="Actual price" hint="Per piece. Leave as it is for the list price"><Input type="text" inputMode="decimal" autoComplete="off" value={l.unit_price} placeholder={String(Math.round(unit * 100) / 100)} onChange={(e) => setLine(l.key, { unit_price: decimal(e.target.value) })} /></Field>
                        <div className="flex flex-wrap content-end items-end gap-1.5 pb-2 text-xs">
                          {ql?.tier_percent > 0 && <Badge tone="success">Wholesale {ql.tier_percent}% off</Badge>}
                          {type === 'sample' && <Badge tone="warning">Sample price</Badge>}
                          {p.plan && <Badge tone="primary"><IdCard className="size-3" />Plan: {p.plan.name}</Badge>}
                          {Number(p.discount_value) > 0 && type !== 'sample' && <Badge tone="success">Product discount {p.discount_type === 'percent' ? `${Number(p.discount_value)}%` : money(cur, p.discount_value)}</Badge>}
                        </div>
                      </div>
                    )}
                    {i === 0 && errors.products && <p className="text-sm text-danger">{errors.products}</p>}
                  </div>
                );
              })}
              {!planChange && <Button size="sm" variant="outline" onClick={() => setLines((ls) => [...ls, newLine()])}><Plus />Add another product</Button>}
              {type === 'upgrade' && subInfo && !subInfo.expired && (
                <Field label="Credit for the unused time" hint={`Calculated from what they paid (${money(cur, subInfo.paid)}) and the time left. Leave empty to use it.`}>
                  <Input type="number" min="0" value={form.plan_credit} onChange={(e) => set('plan_credit', e.target.value)} placeholder={String(subInfo.unused_credit)} className="max-w-48" />
                </Field>
              )}
              {type === 'wholesale' && meta.sample_credit_enable && (
                <Field label="Samples already paid for?" hint="Optional: the sample charge is taken off this bulk order">
                  <SearchSelect value={form.sample_order} onChange={(o) => set('sample_order', o)} search={(q) => api.get('/admin/sample-orders', { params: { q } }).then(({ data }) => data.data)} placeholder="Find the sample order (number, name or phone)..." empty="No open sample orders"
                    renderItem={(o) => <div className="flex items-center justify-between gap-3"><span className="min-w-0 truncate">{o.order_number} · {o.name}</span><Badge tone="success" className="shrink-0">Credit {money(cur, o.credit)}</Badge></div>}
                    renderValue={(o) => <span className="truncate">{o.order_number}{o.name ? ` · ${o.name}` : ''} <span className="text-success">(credit {money(cur, o.credit)})</span></span>} />
                </Field>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Total amount" hint={valid.length === 1 ? 'Quantity × price, before the discount. Type a total to set the price per piece.' : 'All products together, before the discount'}>
                <Input type="text" inputMode="decimal" autoComplete="off" readOnly={valid.length !== 1} value={totalText ?? String(totalDerived)}
                  onChange={(e) => { const t = decimal(e.target.value); setTotalText(t); const q = Number(valid[0]?.quantity) || 1; if (t !== '' && Number(t) >= 0) setLine(valid[0].key, { unit_price: String(Math.round((Number(t) / q) * 10000) / 10000) }); }}
                  onBlur={() => setTotalText(null)} />
              </Field>
              <Field label="Discount" error={errors.discount_value} hint={quote?.discount > 0 ? `Takes off ${money(cur, quote.discount)}` : undefined}>
                <div className="flex gap-2">
                  <Input className="flex-1" type="text" inputMode="decimal" autoComplete="off" value={form.discount_value} placeholder="0" onChange={(e) => set('discount_value', decimal(e.target.value))} />
                  <Segmented id="dt" value={form.discount_type} onChange={(v) => set('discount_type', v)} options={[{ value: 'fixed', label: cur }, { value: 'percent', label: '%' }]} />
                </div>
              </Field>
            </div>

            <div className="space-y-3 rounded-2xl border border-border p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div><p className="text-sm font-semibold">Create a link?</p><p className="text-xs text-muted-foreground">A link to write on the NFC card or print as a QR code. Whoever opens it first attaches it to their e-mail.</p></div>
                <Segmented id="ml" value={form.make_links ? 'yes' : 'no'} onChange={(v) => set('make_links', v === 'yes')} options={[{ value: 'no', label: 'No' }, { value: 'yes', label: 'Yes' }]} />
              </div>
              {form.make_links && (
                <div className="grid gap-3 sm:grid-cols-3">
                  <Field label="Link type"><Select value={form.link_kind} onChange={(v) => { set('link_kind', v); if (v === 'review') set('link_plan_id', ''); }} options={LINK_KINDS} /></Field>
                  {linkNeedsPlan
                    ? <Field label="Plan" required error={errors.link_plan_id} hint="Its length counts from when the link is claimed"><Select value={form.link_plan_id} onChange={(v) => set('link_plan_id', v)} invalid={!!errors.link_plan_id} placeholder="Choose a plan" options={(meta.plans || []).map((x) => ({ value: x.id, label: x.name }))} /></Field>
                    : <Field label="Plan" hint="A review link has no plan"><Input value="No plan" readOnly /></Field>}
                  <Field label="How many links" hint="One per piece by default"><Input type="text" inputMode="numeric" value={form.link_qty} placeholder={String(Number(first?.quantity) || 1)} onChange={(e) => set('link_qty', e.target.value.replace(/\D/g, '').slice(0, 3))} /></Field>
                </div>
              )}
            </div>

            <div className="space-y-3">
              <Field label="Payment" required>
                <Segmented id="pay" value={form.payment} onChange={(v) => set('payment', v)} options={[...(noShip ? [] : [{ value: 'cod', label: 'COD' }]), { value: 'online', label: 'Online payment' }, { value: 'advance', label: 'Advance' }]} />
              </Field>
              {form.payment === 'advance' && <Field label="Advance received" required error={errors.advance_amount} hint={total ? `Balance due: ${money(cur, Math.max(0, total - advance))}` : undefined}><Input type="text" inputMode="decimal" autoComplete="off" value={form.advance_amount} placeholder="0" onChange={(e) => set('advance_amount', decimal(e.target.value))} className="max-w-56" /></Field>}
              {form.payment !== 'cod' && (
                <Field label="Received in" required={form.payment === 'online'} error={errors.payment_account_id} hint={meta.accounts?.length ? 'The cash, bank or wallet account the money went into' : 'Add a payment method under Finance first'}>
                  <Select value={form.payment_account_id} onChange={(v) => set('payment_account_id', v)} allowEmpty={form.payment === 'advance'} invalid={!!errors.payment_account_id} placeholder="Choose the account" options={(meta.accounts || []).map((a) => ({ value: a.id, label: a.name }))} />
                </Field>
              )}
              {tagType && <Field label="Tag owner's phone" required error={errors.phone} hint="Messages from whoever scans the tag are sent here. The number is never shown."><Input value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="03xx xxxxxxx" className="max-w-64" /></Field>}
            </div>
            <Field label="Note"><Textarea rows={2} value={form.admin_note} onChange={(e) => set('admin_note', e.target.value)} placeholder="Optional: card details, delivery instructions..." /></Field>
            <div>
              <button type="button" onClick={() => set('more', !form.more)} className="cursor-pointer text-sm font-medium text-primary hover:underline">{form.more ? 'Hide more options' : 'More options'}</button>
              {form.more && (
                <div className="mt-3 max-w-md"><Field label="Order type" hint="Normally chosen from the product. Change it for a renewal, an upgrade, a wholesale order or samples.">
                  <Select value={form.type_override} onChange={pickType} allowEmpty placeholder="Automatic (from the product)" options={ORDER_TYPES.map((t) => ({ value: t.key, label: t.title }))} />
                </Field></div>
              )}
            </div>
          </CardBody>
        </Card>

        <Card className="overflow-hidden lg:sticky lg:top-24">
          <CardHeader icon={ShoppingBag} title="Order summary" />
          <CardBody className="space-y-3 text-sm">
            <Badge tone="primary">{typeInfo?.title}</Badge>
            {!valid.length ? <p className="text-muted-foreground">No product yet.</p> : (
              <ul className="space-y-1.5">
                {valid.map((l, i) => (
                  <li key={l.key} className="flex justify-between gap-3">
                    <span className="min-w-0 truncate">{products[l.product_id]?.name}{l.variant ? ` · ${l.variant}` : ''} <span className="text-muted-foreground">× {l.quantity || 1}</span></span>
                    <span className="shrink-0">{quote?.lines?.[i] ? money(cur, quote.lines[i].total) : '…'}</span>
                  </li>
                ))}
              </ul>
            )}
            <div className="space-y-1.5 border-t border-border pt-3">
              <Row label="Subtotal" value={money(cur, quote?.subtotal)} />
              {quote?.discount > 0 && <Row label={`Discount${quote.discount_type === 'percent' ? ` (${quote.discount_value}%)` : ''}`} value={`- ${money(cur, quote.discount)}`} className="font-medium text-success" />}
              {quote?.plan_credit > 0 && <Row label="Credit for unused time" value={`- ${money(cur, quote.plan_credit)}`} className="font-medium text-success" />}
              {quote?.sample_credit > 0 && <Row label="Sample credit" value={`- ${money(cur, quote.sample_credit)}`} className="font-medium text-success" />}
              {quote?.tax > 0 && <Row label={`${quote.tax_name} (${quote.tax_rate}%)`} value={money(cur, quote.tax)} />}
              <Row label="Delivery" value={noShip ? 'No shipping' : cod ? money(cur, quote?.delivery ?? meta.delivery_charges) : 'None'} />
              {quote?.cod > 0 && <Row label="COD charges" value={money(cur, quote.cod)} />}
            </div>
            <div className={cn('flex items-center justify-between rounded-2xl bg-primary-soft px-4 py-3 text-primary transition-opacity', quoting && 'opacity-60')}>
              <span className="font-semibold">Total</span><span className="font-display text-xl font-bold">{money(cur, quote?.total)}</span>
            </div>
            {form.payment === 'advance' && advance > 0 && total > 0 && <Row label="Balance after advance" value={money(cur, Math.max(0, total - advance))} className="font-medium" />}
            {quote?.error && <p className="text-xs text-danger">{quote.error}</p>}
            {(quote?.warnings || []).map((w) => <p key={w} className="rounded-xl bg-warning-soft px-3 py-2 text-xs text-warning">{w}</p>)}
            <Button size="lg" className="w-full" onClick={create} loading={busy}>Create order<ArrowRight /></Button>
            {form.make_links && <p className="text-center text-xs text-muted-foreground">{linkCount} {form.link_kind === 'review' ? 'review' : form.link_kind === 'vcard' ? 'business card' : 'redirect'} link{linkCount === 1 ? '' : 's'} will be created</p>}
          </CardBody>
        </Card>
      </div>
    </>
  );
}
const Row = ({ label, value, className }) => <div className={cn('flex justify-between gap-3', className)}><span className="text-muted-foreground">{label}</span><span>{value}</span></div>;
