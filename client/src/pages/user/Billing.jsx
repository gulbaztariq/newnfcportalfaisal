import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { Check, X, Crown, TicketPercent, CreditCard, Banknote, Receipt, Nfc, Plus, Copy, Wallet, Users, ArrowRight, CheckCircle2, XCircle, Minus, Package, Download } from 'lucide-react';
import api, { toFormData } from '@/lib/api';
import { cn } from '@/lib/cn';
import { useAuth } from '@/lib/auth';
import { fmtDate, fmtDateTime, money, label } from '@/lib/format';
import {
  PageHeader, Card, CardHeader, CardBody, Button, ButtonLink, Field, Input, Textarea, Select, ImageUpload, Dialog, Segmented, Badge, StatusBadge, StatCard,
  EmptyState, Skeleton, Spinner, TableCard, DataTable, useList, useForm, run,
} from '@/components/ui';
import { FEATURE_LABELS } from '@/lib/features';

const GATEWAY = { stripe: ['Stripe', CreditCard], paypal: ['PayPal', CreditCard], razorpay: ['RazorPay', CreditCard], flutterwave: ['FlutterWave', CreditCard], paystack: ['PayStack', CreditCard], phonepe: ['PhonePe', CreditCard], mercadopago: ['MercadoPago', CreditCard], cashfree: ['Cashfree', CreditCard], sslcommerz: ['SSLCommerz', CreditCard], payfast: ['PayFast', CreditCard], iyzico: ['Iyzico', CreditCard], manual: ['Bank / cash', Banknote] };

function PayMethods({ methods, value, onChange }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {methods.map((g) => {
        const [l, I] = GATEWAY[g] || [g, CreditCard];
        const on = value === g;
        return (
          <button key={g} type="button" onClick={() => onChange(g)} className={cn('flex cursor-pointer items-center gap-3 rounded-2xl border-2 p-3 text-left transition', on ? 'border-primary bg-primary-soft/60' : 'border-border hover:border-primary/40')}>
            <span className={cn('grid size-9 place-items-center rounded-xl', on ? 'bg-primary text-white' : 'bg-muted text-muted-foreground')}><I className="size-4" /></span>
            <span className="text-sm font-medium">{l}</span>
            <span className={cn('ml-auto grid size-5 place-items-center rounded-full border-2', on ? 'border-primary bg-primary' : 'border-input')}>{on && <Check className="size-3 text-white" strokeWidth={3} />}</span>
          </button>
        );
      })}
    </div>
  );
}

export function UserPlans() {
  const [d, setD] = useState(null);
  const [freq, setFreq] = useState('monthly');
  const [params] = useSearchParams();
  const [plan, setPlan] = useState(null);
  const [coupon, setCoupon] = useState({ code: '', quote: null, error: '' });
  const [pay, setPay] = useState({ payment_type: '', notes: '', attachment: null });
  const [busy, setBusy] = useState(false);
  const load = () => api.get('/user/plans').then(({ data }) => { setD(data); if (data.current?.plan) setFreq(data.current.plan.frequency); });
  useEffect(() => { load(); if (params.get('cancelled')) toast.warning('Payment was cancelled'); }, []); // eslint-disable-line
  if (!d) return <div className="grid gap-5 md:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-[520px] rounded-3xl" />)}</div>;
  const freqs = ['monthly', 'yearly', 'unlimited'].filter((f) => d.data.some((p) => p.frequency === f));
  const shown = d.data.filter((p) => p.frequency === freq);
  const cur = d.current;
  const choose = (p) => { setPlan(p); setCoupon({ code: '', quote: null, error: '' }); setPay({ payment_type: d.gateways[0] || '', notes: '', attachment: null }); };
  const applyCoupon = async () => {
    try { const { data } = await api.post('/user/coupon/check', { plan_id: plan.id, code: coupon.code }); setCoupon({ ...coupon, quote: data, error: '' }); toast.success('Coupon applied'); } catch (e) { setCoupon({ ...coupon, quote: null, error: e.message }); }
  };
  const baseTax = plan ? Math.round(Number(plan.price) * Number(plan.tax_rate || 0)) / 100 : 0;
  const tax = coupon.quote ? coupon.quote.tax : baseTax;
  const payable = coupon.quote ? coupon.quote.payable : Math.round((Number(plan?.price || 0) + baseTax) * 100) / 100;
  const subscribe = async () => {
    setBusy(true);
    try {
      const { data } = await api.post('/user/subscribe', toFormData({ plan_id: plan.id, coupon: coupon.quote ? coupon.code : '', payment_type: payable <= 0 ? 'free' : pay.payment_type, notes: pay.notes, attachment: pay.attachment }));
      if (data.redirect) { window.location.href = data.redirect; return; }
      toast.success(data.message); setPlan(null); load();
    } catch (e) { toast.error(Object.values(e.errors || {})[0] || e.message); } finally { setBusy(false); }
  };
  return (
    <>
      <PageHeader title="Plans & billing" description="Pick the plan that fits you. Upgrade or renew anytime." />
      {cur && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="relative mb-8 flex flex-wrap items-center gap-4 overflow-hidden rounded-3xl bg-linear-to-r from-violet-600 to-fuchsia-600 p-6 text-white">
          <div className="bg-grid absolute inset-0 opacity-20" />
          <span className="relative grid size-12 place-items-center rounded-2xl bg-white/15 backdrop-blur"><Crown className="size-6" /></span>
          <div className="relative flex-1"><p className="text-sm text-white/70">Current plan</p><p className="font-display text-2xl font-bold">{cur.plan.name}</p></div>
          <div className="relative text-right"><p className="text-sm text-white/70">{cur.trial_ends_at ? 'Trial ends' : 'Renews'}</p><p className="font-semibold">{fmtDate(cur.ends_at)}</p></div>
        </motion.div>
      )}
      {freqs.length > 1 && <div className="mb-8 flex justify-center"><Segmented id="uf" value={freq} onChange={setFreq} options={freqs.map((f) => ({ value: f, label: f === 'unlimited' ? 'Lifetime' : label(f) }))} /></div>}
      <AnimatePresence mode="wait">
        <motion.div key={freq} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} className={cn('mx-auto grid gap-6', shown.length === 1 ? 'max-w-md' : 'md:grid-cols-2 xl:grid-cols-3')}>
          {shown.map((p, i) => {
            const isCur = cur?.plan_id === p.id;
            const featured = shown.length > 2 && i === 1;
            return (
              <Card key={p.id} className={cn('relative flex flex-col p-7 transition duration-500 hover:-translate-y-1 hover:shadow-lift', featured && 'border-beam border-transparent shadow-glow', isCur && 'ring-2 ring-primary')}>
                {isCur && <Badge tone="primary" className="absolute top-5 right-5">Current</Badge>}
                {featured && !isCur && <Badge tone="primary" className="absolute top-5 right-5">Popular</Badge>}
                <p className="font-display text-lg font-bold">{p.name}</p>
                <p className="mt-3 flex items-baseline gap-1"><span className="font-display text-4xl font-extrabold">{money(p.price, p.currency)}</span><span className="text-sm text-muted-foreground">/{p.frequency === 'unlimited' ? 'lifetime' : p.frequency === 'yearly' ? 'year' : 'month'}</span></p>
                {p.trial_days > 0 && <p className="mt-1 text-sm text-primary">{p.trial_days}-day free trial</p>}
                {Number(p.tax_rate) > 0 && <p className="mt-1 text-xs text-muted-foreground">+ {p.tax_name || 'tax'} {Number(p.tax_rate)}%</p>}
                {p.custom_duration_days && <p className="mt-1 text-xs text-muted-foreground">Valid for {p.custom_duration_days} days</p>}
                <ul className="mt-6 flex-1 space-y-2.5 text-sm">
                  <li className="flex gap-2.5"><Check className="size-4.5 text-success" /><b>{p.no_of_vcards}</b> vCards</li>
                  <li className="flex gap-2.5"><Check className="size-4.5 text-success" /><b>{p.templates.length}</b> templates</li>
                  {Object.entries(FEATURE_LABELS).slice(0, 12).map(([k, l]) => (
                    <li key={k} className={cn('flex gap-2.5', !p.features[k] && 'text-muted-foreground/60')}>{p.features[k] ? <Check className="size-4.5 text-success" /> : <X className="size-4.5" />}{l}</li>
                  ))}
                </ul>
                <Button className="mt-7 w-full" size="lg" variant={isCur ? 'outline' : 'primary'} onClick={() => choose(p)}>{isCur ? 'Renew plan' : 'Choose plan'}</Button>
                <a href={`/api/user/plans/${p.id}/pdf`} className="mt-3 inline-flex items-center justify-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-primary"><Download className="size-3.5" />Download plan PDF</a>
              </Card>
            );
          })}
        </motion.div>
      </AnimatePresence>

      <Dialog open={!!plan} onOpenChange={(o) => !o && setPlan(null)} size="lg" icon={Crown} title={plan ? `Subscribe to ${plan.name}` : ''} description="Review your order and choose how to pay."
        footer={<><Button variant="outline" onClick={() => setPlan(null)}>Cancel</Button><Button onClick={subscribe} loading={busy} disabled={payable > 0 && !pay.payment_type}>{payable > 0 ? `Pay ${money(payable, plan?.currency)}` : 'Activate plan'}<ArrowRight /></Button></>}>
        {plan && (
          <div className="space-y-5">
            <div className="rounded-2xl border border-border bg-muted/40 p-4">
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">{plan.name} plan</span><span>{money(plan.price, plan.currency)}</span></div>
              <AnimatePresence>{coupon.quote && <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mt-2 flex justify-between text-sm text-success"><span>Coupon {coupon.code}</span><span>-{money(coupon.quote.discount, plan.currency)}</span></motion.div>}</AnimatePresence>
              {tax > 0 && <div className="mt-2 flex justify-between text-sm"><span className="text-muted-foreground">{plan.tax_name || 'Tax'} ({Number(plan.tax_rate)}%)</span><span>{money(tax, plan.currency)}</span></div>}
              <div className="mt-3 flex justify-between border-t border-border pt-3 font-semibold"><span>Total</span><span className="font-display text-xl">{money(payable, plan.currency)}</span></div>
            </div>
            <Field label="Coupon code" error={coupon.error}>
              <div className="flex gap-2"><Input icon={TicketPercent} className="flex-1" value={coupon.code} onChange={(e) => setCoupon({ code: e.target.value.toUpperCase(), quote: null, error: '' })} placeholder="Have a coupon?" /><Button variant="soft" onClick={applyCoupon} disabled={!coupon.code}>Apply</Button></div>
            </Field>
            {payable > 0 && (
              <Field label="Payment method">
                {!d.gateways.length ? <p className="rounded-xl bg-warning-soft px-4 py-3 text-sm text-warning">No payment method is enabled yet. Please contact support.</p> : <PayMethods methods={d.gateways} value={pay.payment_type} onChange={(g) => setPay({ ...pay, payment_type: g })} />}
              </Field>
            )}
            <AnimatePresence>
              {payable > 0 && pay.payment_type === 'manual' && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="space-y-4 overflow-hidden">
                  <div className="prose-content rounded-2xl border border-border p-4 text-sm" dangerouslySetInnerHTML={{ __html: d.manual_payment_guide || '' }} />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Reference / notes"><Textarea rows={3} value={pay.notes} onChange={(e) => setPay({ ...pay, notes: e.target.value })} /></Field>
                    <Field label="Receipt"><ImageUpload value={pay.attachment} onChange={(f) => setPay({ ...pay, attachment: f })} label="Upload receipt" hint="Image or PDF" accept="image/png,image/jpeg,image/webp,application/pdf" /></Field>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </Dialog>
    </>
  );
}

export function PaymentSuccess() {
  const { gateway } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [state, setState] = useState({ loading: true });
  useEffect(() => {
    api.get(`/user/payment/${gateway}/success`, { params: Object.fromEntries(params) })
      .then(({ data }) => setState({ ok: !data.pending, pending: !!data.pending, message: data.message, purpose: data.purpose }))
      .catch((e) => setState({ ok: false, message: e.message }));
  }, []); // eslint-disable-line
  return (
    <div className="grid min-h-[60vh] place-items-center">
      <Card className="w-full max-w-md p-10 text-center">
        {state.loading ? <><Spinner className="mx-auto size-8" /><p className="mt-4 text-sm text-muted-foreground">Confirming your payment...</p></> : (
          <>
            <motion.span initial={{ scale: 0, rotate: -45 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 260, damping: 14 }} className={cn('mx-auto grid size-20 place-items-center rounded-full text-white', state.ok ? 'bg-success' : 'bg-danger')}>
              {state.ok ? <CheckCircle2 className="size-10" /> : <XCircle className="size-10" />}
            </motion.span>
            <h2 className="mt-5 font-display text-2xl font-bold">{state.ok ? 'Payment successful' : state.pending ? 'Payment processing' : 'Payment failed'}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{state.message}</p>
            <Button className="mt-6" onClick={() => navigate(state.purpose === 'nfc_order' ? '/user/nfc-orders' : '/user/plans')}>Continue <ArrowRight /></Button>
          </>
        )}
      </Card>
    </div>
  );
}

export function UserTransactions() {
  const list = useList('/user/transactions');
  return (
    <>
      <PageHeader title="Transactions" description="Your payment history." />
      <TableCard title="Payments" list={list}>
        <DataTable loading={list.loading} rows={list.rows} empty={<EmptyState icon={Receipt} title="No transactions yet" />} columns={[
          { key: 'inv', label: 'Invoice', render: (t) => <span className="font-mono text-xs font-semibold text-primary">#{String(t.id).padStart(6, '0')}</span> },
          { key: 'desc', label: 'Description', render: (t) => (t.purpose === 'subscription' ? `${t.subscription?.plan?.name || ''} plan` : 'NFC card order') },
          { key: 'type', label: 'Method', render: (t) => <Badge tone="outline">{GATEWAY[t.type]?.[0] || label(t.type)}</Badge> },
          { key: 'amt', label: 'Amount', render: (t) => <span className="font-semibold">{money(t.amount)}</span> },
          { key: 'date', label: 'Date', render: (t) => <span className="text-muted-foreground">{fmtDateTime(t.created_at)}</span> },
          { key: 'st', label: 'Status', render: (t) => <StatusBadge value={t.status} /> },
          { key: '_i', label: '', className: 'text-right', render: (t) => <a href={`/api/user/transactions/${t.id}/invoice`} className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"><Download className="size-3.5" />Invoice</a> },
        ]} />
      </TableCard>
    </>
  );
}

export function UserNfcOrders() {
  const [orders, setOrders] = useState(null);
  const [cards, setCards] = useState([]);
  const [vcards, setVcards] = useState([]);
  const [card, setCard] = useState(null);
  const [busy, setBusy] = useState(false);
  const form = useForm({ vcard_id: '', name: '', designation: '', company_name: '', email: '', phone: '', region_code: '', address: '', quantity: 1, payment_type: 'manual', logo: null });
  const [gateways, setGateways] = useState(['manual']);
  const { settings } = useAuth();
  const load = () => api.get('/user/nfc-orders').then(({ data }) => setOrders(data.data));
  useEffect(() => { load(); api.get('/user/nfc-cards').then(({ data }) => setCards(data.data)); api.get('/user/vcards').then(({ data }) => setVcards(data.data)); api.get('/user/plans').then(({ data }) => setGateways(data.gateways.length ? data.gateways : ['manual'])); }, []);
  const order = (c) => {
    const v = vcards[0];
    form.setErrors({});
    form.setValues({ ...form.values, vcard_id: v?.id || '', name: v ? `${v.first_name || ''} ${v.last_name || ''}`.trim() : '', email: v?.email || '', phone: v?.phone || '', region_code: v?.region_code || '', company_name: v?.company || '', designation: v?.job_title || '', quantity: 1 });
    setCard(c);
  };
  const qty = Math.max(1, Number(form.values.quantity) || 1);
  const submit = async () => {
    setBusy(true);
    try {
      const { data } = await api.post('/user/nfc-orders', toFormData({ ...form.values, nfc_card_id: card.id }));
      if (data.redirect) { window.location.href = data.redirect; return; }
      toast.success(data.message); setCard(null); load();
    } catch (e) { form.setErrors(e.errors); toast.error(Object.values(e.errors || {})[0] || e.message); } finally { setBusy(false); }
  };
  return (
    <>
      <PageHeader title="NFC card orders" description="Order physical NFC cards that open your vCard with a tap." />
      {!vcards.length && <div className="mb-6 flex items-center gap-3 rounded-2xl border border-warning/30 bg-warning-soft p-4 text-sm"><Nfc className="size-5 text-warning" /><span className="flex-1">Create a vCard first. The NFC card will open it when tapped.</span><ButtonLink as={Link} to="/user/vcards/create" size="sm"><Plus />Create vCard</ButtonLink></div>}
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {cards.map((c, i) => (
          <motion.div key={c.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}>
            <Card hover className="group overflow-hidden">
              <div className="relative grid h-44 place-items-center overflow-hidden bg-linear-to-br from-zinc-900 via-violet-950 to-zinc-900">
                <div className="bg-grid absolute inset-0 opacity-20" />
                {c.front_image ? <img src={c.front_image} alt="" className="relative h-32 rounded-xl object-cover shadow-2xl transition duration-700 group-hover:scale-105 group-hover:-rotate-3" /> : (
                  <div className="relative flex h-28 w-44 flex-col justify-between rounded-2xl bg-linear-to-br from-violet-500 to-fuchsia-600 p-4 text-white shadow-2xl transition duration-700 group-hover:-rotate-6 group-hover:scale-105">
                    <Nfc className="size-6" /><p className="font-display text-sm font-semibold">{c.name}</p>
                  </div>
                )}
              </div>
              <div className="p-5">
                <div className="flex items-start justify-between gap-3"><p className="font-display font-semibold">{c.name}</p><p className="font-display text-xl font-bold">{money(c.price)}</p></div>
                <p className="mt-1 text-sm text-muted-foreground">{c.description}</p>
                <Button className="mt-4 w-full" onClick={() => order(c)} disabled={!vcards.length}><Nfc />Order this card</Button>
              </div>
            </Card>
          </motion.div>
        ))}
      </div>
      <div className="mt-8">
        <TableCard title="My orders">
          <DataTable loading={!orders} rows={orders || []} empty={<EmptyState icon={Package} title="No orders yet" />} columns={[
            { key: 'no', label: 'Order', render: (o) => <div><p className="font-mono text-xs font-semibold text-primary">{o.order_number}</p><p className="text-xs text-muted-foreground">{fmtDate(o.created_at)}</p></div> },
            { key: 'card', label: 'Card', render: (o) => o.nfc_card?.name },
            { key: 'vc', label: 'vCard', render: (o) => o.vcard?.name },
            { key: 'q', label: 'Qty', render: (o) => o.quantity },
            { key: 'amt', label: 'Amount', render: (o) => <span className="font-semibold">{money(o.amount)}</span> },
            { key: 'pay', label: 'Payment', render: (o) => <StatusBadge value={o.payment_status} /> },
            { key: 'st', label: 'Status', render: (o) => <StatusBadge value={o.order_status} /> },
            { key: '_i', label: '', className: 'text-right', render: (o) => <a href={`/api/user/nfc-orders/${o.id}/invoice`} className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"><Download className="size-3.5" />Invoice</a> },
          ]} />
        </TableCard>
      </div>
      <Dialog open={!!card} onOpenChange={(o) => !o && setCard(null)} size="lg" icon={Nfc} title={card ? `Order ${card.name}` : ''} description="Details printed on the card and where to ship it."
        footer={<><div className="mr-auto"><p className="text-xs text-muted-foreground">Total</p><p className="font-display text-xl font-bold">{money((card?.price || 0) * qty)}</p></div><Button variant="outline" onClick={() => setCard(null)}>Cancel</Button><Button onClick={submit} loading={busy}>Place order</Button></>}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Linked vCard" required><Select value={form.values.vcard_id} onChange={(x) => form.set('vcard_id', x)} options={vcards.map((v) => ({ value: v.id, label: `${v.name} (/${v.url_alias})` }))} /></Field>
          <Field label="Quantity">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={() => form.set('quantity', Math.max(1, qty - 1))} aria-label="Less"><Minus /></Button>
              <Input className="text-center" type="number" min="1" max="1000" {...form.input('quantity')} />
              <Button variant="outline" size="icon" onClick={() => form.set('quantity', qty + 1)} aria-label="More"><Plus /></Button>
            </div>
          </Field>
          <Field label="Name on card" required error={form.errors.name}><Input {...form.input('name')} /></Field>
          <Field label="Designation"><Input {...form.input('designation')} /></Field>
          <Field label="Company"><Input {...form.input('company_name')} /></Field>
          <Field label="E-mail" required error={form.errors.email}><Input {...form.input('email')} type="email" /></Field>
          <Field label="Phone" required error={form.errors.phone}><Input {...form.input('phone')} /></Field>
          <Field label="Logo (optional)"><ImageUpload value={form.values.logo} onChange={(x) => form.set('logo', x)} /></Field>
          <Field label="Shipping address" required error={form.errors.address} className="sm:col-span-2"><Textarea {...form.input('address')} rows={2} /></Field>
          <Field label="Payment method" className="sm:col-span-2"><PayMethods methods={gateways} value={form.values.payment_type} onChange={(g) => form.set('payment_type', g)} /></Field>
          {Number(settings.nfc_tax_rate) > 0 && <p className="text-xs text-muted-foreground sm:col-span-2">{settings.nfc_tax_name || 'Tax'} of {Number(settings.nfc_tax_rate)}% is added at checkout.</p>}
        </div>
      </Dialog>
    </>
  );
}

export function Affiliation() {
  const [d, setD] = useState(null);
  const form = useForm({ amount: '', email: '', bank_details: '' });
  const [busy, setBusy] = useState(false);
  const load = () => api.get('/user/affiliation').then(({ data }) => setD(data));
  useEffect(() => { load(); }, []);
  if (!d) return <Skeleton className="h-96 rounded-3xl" />;
  const copy = async () => { try { await navigator.clipboard.writeText(d.link); toast.success('Referral link copied'); } catch { toast.info(d.link); } };
  const withdraw = async () => { setBusy(true); try { await run(api.post('/user/withdrawals', form.values)); form.setValues({ amount: '', email: '', bank_details: '' }); load(); } catch (e) { form.setErrors(e.errors); } finally { setBusy(false); } };
  return (
    <>
      <PageHeader title="Affiliation" description="Invite people and earn a reward for every approved sign-up." />
      <Card className="relative mb-6 overflow-hidden p-6 md:p-8">
        <div className="absolute -top-20 -right-20 size-64 rounded-full bg-primary/15 blur-3xl" />
        <p className="text-sm font-medium text-muted-foreground">Your referral link</p>
        <div className="mt-2 flex max-w-2xl gap-2"><Input readOnly value={d.link} className="flex-1 font-mono text-xs" /><Button onClick={copy}><Copy />Copy</Button></div>
      </Card>
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard index={0} icon={Users} color="violet" label="Referred users" value={d.referrals.length} />
        <StatCard index={1} icon={Wallet} color="emerald" label="Total earned" value={Number(d.earned)} format={(v) => money(v)} />
        <StatCard index={2} icon={Banknote} color="amber" label="Available balance" value={Number(d.balance)} format={(v) => money(v)} />
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-[380px_1fr]">
        <Card className="h-fit">
          <CardHeader icon={Banknote} title="Request payout" description={`Minimum ${money(d.min_withdrawal)}`} />
          <CardBody className="space-y-4">
            <Field label="Amount" error={form.errors.amount}><Input {...form.input('amount')} type="number" min="1" /></Field>
            <Field label="Payout e-mail" error={form.errors.email}><Input {...form.input('email')} type="email" /></Field>
            <Field label="Bank details" error={form.errors.bank_details}><Textarea {...form.input('bank_details')} rows={3} /></Field>
            <Button className="w-full" onClick={withdraw} loading={busy} disabled={d.balance < d.min_withdrawal}>Send request</Button>
          </CardBody>
        </Card>
        <div className="space-y-6">
          <TableCard title="Referrals">
            <DataTable rows={d.referrals} empty={<EmptyState icon={Users} title="No referrals yet" description="Share your link to start earning." />} columns={[
              { key: 'u', label: 'User', render: (r) => `${r.referred?.first_name || ''} ${r.referred?.last_name || ''}` },
              { key: 'a', label: 'Reward', render: (r) => <span className="font-semibold">{money(r.amount)}</span> },
              { key: 'd', label: 'Date', render: (r) => fmtDate(r.created_at) },
              { key: 's', label: 'Status', render: (r) => <StatusBadge value={r.status} /> },
            ]} />
          </TableCard>
          <TableCard title="Withdrawals">
            <DataTable rows={d.withdrawals} empty={<EmptyState icon={Wallet} title="No withdrawals yet" />} columns={[
              { key: 'a', label: 'Amount', render: (w) => <span className="font-semibold">{money(w.amount)}</span> },
              { key: 'e', label: 'E-mail', render: (w) => w.email },
              { key: 'd', label: 'Date', render: (w) => fmtDate(w.created_at) },
              { key: 's', label: 'Status', render: (w) => <StatusBadge value={w.status} /> },
              { key: 'n', label: 'Note', render: (w) => <span className="text-muted-foreground">{w.rejection_note || '-'}</span> },
            ]} />
          </TableCard>
        </div>
      </div>
    </>
  );
}
