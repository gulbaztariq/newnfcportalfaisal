/* Admin: new order wizard (phone / WhatsApp / walk-in / other websites). Staff only - the website checkout is separate. */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import {
  ArrowLeft, ArrowRight, Check, User, Package, Truck, ClipboardCheck, Plus, Trash2, Store, Wand2, IdCard, Copy, ExternalLink,
  BadgePercent, Banknote, ShoppingBag, Settings2, Sparkles, UserCheck, UserPlus, UserRound, Building2, Repeat,
} from 'lucide-react';
import api from '@/lib/api';
import SearchSelect from '@/components/SearchSelect';
import { cn } from '@/lib/cn';
import {
  Card, CardHeader, CardBody, Button, Field, Input, Textarea, Select, Segmented, Checkbox, Badge, Tip, Skeleton, Avatar, run,
} from '@/components/ui';

const STEPS = [
  ['customer', 'Customer', User],
  ['products', 'Products', Package],
  ['delivery', 'Delivery & payment', Truck],
  ['review', 'Review', ClipboardCheck],
];
let lineId = 0;
const newLine = () => ({ key: ++lineId, product_id: '', variant: '', quantity: 1, unit_price: '', customization: false });
const money = (cur, v) => `${cur} ${Number(v || 0).toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
const slug = (s) => String(s || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '.').replace(/^\.+|\.+$/g, '').slice(0, 30);
const dummyEmail = (name, domain) => `${slug(name) || 'customer'}.${Math.random().toString(36).slice(2, 6)}@${domain}`;

function Stepper({ step, done, onGo }) {
  return (
    <div className="flex items-center gap-1">
      {STEPS.map(([k, l, I], i) => {
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
            {i < STEPS.length - 1 && <span className={cn('h-0.5 flex-1 rounded-full', i < step ? 'bg-primary' : 'bg-border')} />}
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
  return (
    <Card className="overflow-hidden lg:sticky lg:top-24">
      <CardHeader icon={ShoppingBag} title="Order summary" />
      <CardBody className="space-y-3 text-sm">
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
          {quote?.tax > 0 && <Row label={`${quote.tax_name} (${quote.tax_rate}%)`} value={money(cur, quote.tax)} />}
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">Delivery</span>
            {collection ? <span className="text-muted-foreground">Office collection</span> : (
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
  });
  const [errors, setErrors] = useState({});
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
        setStep(params.get('edit') ? 1 : 3);
      }).catch(() => toast.error('Could not load the order to reorder'));
    } else if (params.get('guest')) {
      api.get(`/admin/guest-customers/${params.get('guest')}`).then(({ data }) => { const g = data.data; fill({ customer_type: 'guest', guest: g, name: g.name, phone: g.phone || '', email: g.email || '', company_name: g.company_name || '', city: g.city || '', address: g.address || '' }); });
    } else if (params.get('organisation')) {
      api.get('/admin/organisations/search', { params: { q: '' } }).then(({ data }) => { const o = data.data.find((x) => String(x.id) === params.get('organisation')); if (o) pickOrganisation(o); });
    }
  }, [meta]); // eslint-disable-line
  useEffect(() => { if (meta && step === 0) nameRef.current?.focus(); }, [meta, step]);

  const products = useMemo(() => Object.fromEntries((meta?.products || []).map((p) => [p.id, p])), [meta]);
  const valid = lines.filter((l) => l.product_id);
  const payload = () => ({
    items: valid.map(({ product_id, variant, quantity, unit_price, customization }) => ({ product_id, variant, quantity, unit_price, customization })),
    fulfilment: form.fulfilment, is_cod: form.fulfilment === 'delivery' && form.payment === 'cod', delivery_charges: form.delivery_charges,
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
  const listPrice = (p, variant) => Number(p?.price || 0) + Number((p?.variants || []).find((v) => v.name === variant)?.price_delta || 0);
  const pickProduct = (key, id) => { const p = products[id]; setLine(key, { product_id: id, variant: '', customization: false, unit_price: p && !p.variants?.length ? String(listPrice(p, '')) : '' }); };
  const pickVariant = (key, p, variant) => setLine(key, { variant, unit_price: String(listPrice(p, variant)) });
  const toggleDummy = (on) => { set('dummy', on); set('email', on ? dummyEmail(form.name, meta.dummy_domain) : ''); };
  const setType = (t) => { setValues((f) => ({ ...f, customer_type: t, customer: null, organisation: null, contact_id: '', guest: null, dummy: false, ...(t === f.customer_type ? {} : { name: '', phone: '', email: '', company_name: '', city: '', address: '' }) })); setErrors({}); };
  const pickCustomer = (u) => setValues((f) => ({ ...f, customer: u, name: u?.name || '', email: u?.email || '', phone: u?.contact || '', company_name: u?.organisation_name || f.company_name }));
  const pickOrganisation = (o) => setValues((f) => ({ ...f, organisation: o, contact_id: '', name: o?.owner || '', company_name: o?.name || '', phone: o?.phone || '', email: o?.email || '', address: o?.address || '', city: o?.city || '' }));
  const pickContact = (id) => { const p = people.find((x) => String(x.id) === String(id)); setValues((f) => ({ ...f, contact_id: id, name: p ? `${p.first_name} ${p.last_name}`.trim() : f.name, email: p?.email || f.email, phone: p?.contact || f.phone })); };
  const pickGuest = (g) => setValues((f) => ({ ...f, guest: g, ...(g ? { name: g.name, phone: g.phone || '', email: g.email || '', company_name: g.company_name || '', city: g.city || '', address: g.address || '' } : {}) }));

  const checks = [
    () => { const e = {}; if (form.customer_type === 'existing' && !form.customer) e.user_id = 'Search and choose the customer'; if (form.customer_type === 'organisation' && !form.organisation) e.organisation_id = 'Search and choose the organisation'; if (!form.name.trim()) e.name = 'Enter the customer name'; if (form.customer_type === 'new' && !form.email) e.email = 'An account needs an e-mail. Tick "Dummy e-mail" if the customer has none.'; if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Enter a valid e-mail address'; return e; },
    () => { const e = {}; if (!valid.length) e.products = 'Add at least one product'; else if (valid.some((l) => products[l.product_id]?.variants?.length && !l.variant)) e.products = 'Choose an option for every product'; else if (valid.some((l) => l.unit_price !== '' && Number(l.unit_price) < 0)) e.products = 'Prices cannot be negative'; return e; },
    () => { const e = {}; if (form.discount_type === 'percent' && Number(form.discount_value) > 100) e.discount_value = 'Maximum 100%'; if (Number(form.discount_value) < 0) e.discount_value = 'Cannot be negative'; return e; },
    () => ({}),
  ];
  const done = checks.map((c) => !Object.keys(c()).length);
  const next = () => { const e = checks[step](); setErrors(e); if (Object.keys(e).length) { toast.error(Object.values(e)[0]); return; } setStep((s) => Math.min(STEPS.length - 1, s + 1)); };
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
    } catch (e) { setErrors(e.errors || {}); if (e.errors && Object.keys(e.errors).some((k) => ['name', 'email', 'phone', 'address', 'user_id', 'organisation_id', 'contact_id'].includes(k))) setStep(0); } finally { setBusy(false); }
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
          <p className="relative mt-1 text-muted-foreground">{form.name} · {money(cur, o.amount)} · {o.fulfilment === 'collection' ? 'Office collection' : o.is_cod ? 'Cash on delivery' : 'Courier delivery'}</p>
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
          <div className="border-b border-border px-4 py-3"><Stepper step={step} done={done} onGo={go} /></div>
          <AnimatePresence mode="wait">
            <motion.div key={step} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.2 }}>
              <CardBody className="min-h-[300px]">
                {step === 0 && (
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
                      <Field label={<span className="flex w-full items-center justify-between">Order source<Link to="/admin/order-sources" className="text-xs font-normal text-primary hover:underline">Manage</Link></span>} error={errors.order_source_id}>
                        <Select value={form.order_source_id} onChange={(v) => set('order_source_id', v)} allowEmpty placeholder={meta.sources.length ? 'Where did it come from?' : 'No sources yet'} options={meta.sources.map((x) => ({ value: x.id, label: x.name }))} />
                      </Field>
                      <Field label="City"><Input value={form.city} onChange={(e) => set('city', e.target.value)} placeholder="Optional" /></Field>
                      <Field label="Address" className={form.customer_type === 'organisation' ? 'sm:col-span-2 xl:col-span-3' : 'sm:col-span-2'}><Input value={form.address} onChange={(e) => set('address', e.target.value)} placeholder="Optional · not needed for office collection" /></Field>
                    </div>
                    {form.customer_type === 'new' && <p className="flex items-center gap-2 rounded-xl bg-primary-soft/50 px-3 py-2 text-xs text-muted-foreground"><Sparkles className="size-4 shrink-0 text-primary" />A login and a starter vCard are created and linked to this order. The plan comes from the products; an existing account with this e-mail is reused.</p>}
                  </div>
                )}

                {step === 1 && (
                  <div className="space-y-3">
                    <div className="hidden grid-cols-[1fr_7rem_5rem_7.5rem_6.5rem_2.25rem] gap-2 px-1 text-xs font-medium text-muted-foreground sm:grid"><span>Product</span><span>Option</span><span>Qty</span><span>Price ({cur})</span><span className="text-right">Total</span><span /></div>
                    {lines.map((l) => {
                      const p = products[l.product_id];
                      const unit = l.unit_price === '' ? listPrice(p, l.variant) : Number(l.unit_price);
                      const total = (unit + (l.customization ? Number(p?.customization_price || 0) : 0)) * (Number(l.quantity) || 1);
                      return (
                        <motion.div key={l.key} layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-border p-2.5">
                          <div className="grid grid-cols-2 gap-2 sm:grid-cols-[1fr_7rem_5rem_7.5rem_6.5rem_2.25rem] sm:items-center">
                            <Select className="col-span-2 sm:col-span-1" value={l.product_id} onChange={(v) => pickProduct(l.key, v)} placeholder="Choose product" options={meta.products.map((x) => ({ value: x.id, label: x.name }))} />
                            {p?.variants?.length ? <Select value={l.variant} onChange={(v) => pickVariant(l.key, p, v)} placeholder="Option" options={p.variants.map((v) => ({ value: v.name, label: v.name }))} /> : <span className="hidden text-center text-xs text-muted-foreground sm:block">-</span>}
                            <Input type="number" min="1" value={l.quantity} onChange={(e) => setLine(l.key, { quantity: e.target.value })} aria-label="Quantity" />
                            <Input type="number" min="0" value={l.unit_price} onChange={(e) => setLine(l.key, { unit_price: e.target.value })} placeholder={p ? String(listPrice(p, l.variant)) : 'Price'} aria-label="Price per piece" />
                            <span className="text-right font-semibold">{p ? money(cur, total) : '-'}</span>
                            <Tip content="Remove"><Button variant="ghost" size="icon" onClick={() => setLines((ls) => (ls.length > 1 ? ls.filter((x) => x.key !== l.key) : [newLine()]))} aria-label="Remove product"><Trash2 /></Button></Tip>
                          </div>
                          {p && (
                            <div className="mt-2 flex flex-wrap items-center gap-2 px-1 text-xs">
                              {p.plan ? <Badge tone="primary"><IdCard className="size-3" />Plan: {p.plan.name}</Badge> : <Badge tone="neutral">Non-plan product</Badge>}
                              {l.unit_price !== '' && Number(l.unit_price) !== listPrice(p, l.variant) && <span className="text-muted-foreground">List price {money(cur, listPrice(p, l.variant))}</span>}
                              {Number(p.customization_price) > 0 && <Checkbox id={`cz-${l.key}`} checked={l.customization} onChange={(v) => setLine(l.key, { customization: v })} label={`Customisation +${money(cur, p.customization_price)} / pc`} />}
                            </div>
                          )}
                        </motion.div>
                      );
                    })}
                    {errors.products && <p className="text-sm text-danger">{errors.products}</p>}
                    <div className="flex items-center justify-between">
                      <Button variant="soft" size="sm" onClick={() => setLines((ls) => [...ls, newLine()])}><Plus />Add product</Button>
                      <Link to="/admin/products" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"><Settings2 className="size-3.5" />Products & plans</Link>
                    </div>
                  </div>
                )}

                {step === 2 && (
                  <div className="space-y-5">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <ChoiceCard active={form.fulfilment === 'delivery'} onClick={() => { set('fulfilment', 'delivery'); if (form.payment === 'collection') set('payment', 'cod'); }} icon={Truck} title="Courier delivery" text="Sent by courier to the customer's address" />
                      <ChoiceCard active={form.fulfilment === 'collection'} onClick={() => { set('fulfilment', 'collection'); if (form.payment === 'cod') set('payment', 'collection'); }} icon={Store} title="Office collection" text="Customer collects from the office. No delivery or COD charges." />
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field label="Payment">
                        <Segmented id="pay" value={form.payment} onChange={(v) => set('payment', v)} options={form.fulfilment === 'collection'
                          ? [{ value: 'collection', label: 'Pay at collection' }, { value: 'paid', label: 'Paid' }]
                          : [{ value: 'cod', label: 'COD' }, { value: 'paid', label: 'Paid' }, { value: 'pending', label: 'Unpaid' }]} />
                      </Field>
                      {form.fulfilment === 'delivery' && (
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

                {step === 3 && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <ReviewBlock title="Customer" icon={User} onEdit={() => setStep(0)} rows={[
                      ['Type', `${TYPE_LABEL[form.customer_type]}${form.customer_type === 'organisation' && form.organisation ? ` · ${form.organisation.name}` : ''}`],
                      ['Name', form.name], ['Phone', form.phone || '-'], ['E-mail', form.email ? `${form.email}${form.dummy ? ' (dummy)' : ''}` : '-'],
                      ['Company', form.company_name || '-'], ['Address', [form.address, form.city].filter(Boolean).join(', ') || '-'], ['Source', srcName || '-'],
                    ]} />
                    <ReviewBlock title="Delivery & payment" icon={Banknote} onEdit={() => setStep(2)} rows={[
                      ['Fulfilment', form.fulfilment === 'collection' ? 'Office collection' : 'Courier delivery'],
                      ['Payment', { cod: 'Cash on delivery', paid: 'Paid', pending: 'Unpaid', collection: 'Pay at collection' }[form.payment]],
                      ['Discount', quote?.discount > 0 ? `${money(cur, quote.discount)}${quote.discount_type === 'percent' ? ` (${quote.discount_value}%)` : ''}` : 'None'],
                      ['Note', form.admin_note || '-'],
                    ]} />
                    <ReviewBlock title="Products" icon={Package} onEdit={() => setStep(1)} className="sm:col-span-2" rows={(quote?.lines || []).map((l) => [
                      `${l.name}${l.variant ? ` · ${l.variant}` : ''}`, `${l.quantity} × ${money(cur, l.unit_price)} = ${money(cur, l.total)}${l.plan ? ` · Plan: ${l.plan.name}` : ' · Non-plan'}`,
                    ])} />
                  </div>
                )}
              </CardBody>
            </motion.div>
          </AnimatePresence>
          <div className="flex items-center justify-between gap-2 border-t border-border px-5 py-3.5">
            <Button variant="ghost" onClick={() => (step ? setStep(step - 1) : navigate('/admin/orders'))}><ArrowLeft />{step ? 'Back' : 'Cancel'}</Button>
            <span className="text-xs text-muted-foreground">Step {step + 1} of {STEPS.length}</span>
            {step < STEPS.length - 1
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

