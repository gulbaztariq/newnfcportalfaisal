/* User: Settings (preferences, getting paid, own e-mail, storage, delete account) and the orders placed on their vCards. */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CreditCard, Mail, HardDrive, Trash2, SlidersHorizontal, ShoppingBag, FileDown, Check, X, Truck, Banknote, Send, ShieldAlert } from 'lucide-react';
import api from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/cn';
import { fmtDateTime, label } from '@/lib/format';
import {
  PageHeader, Card, CardHeader, CardBody, Button, Field, Input, Textarea, Select, SwitchRow, Badge, StatusBadge, EmptyState, Skeleton, Segmented,
  TableCard, DataTable, SearchInput, FilterSelect, Action, Actions, useList, run, confirm,
} from '@/components/ui';

const GATEWAYS = [
  { id: 'stripe', name: 'Stripe', hint: 'Cards, Apple Pay and Google Pay', fields: [['stripe_secret', 'Secret key', 'sk_live_...', true]] },
  { id: 'paypal', name: 'PayPal', hint: 'PayPal balance and cards', fields: [['paypal_client_id', 'Client ID', '', false], ['paypal_secret', 'Secret', '', true]], mode: true },
  { id: 'razorpay', name: 'Razorpay', hint: 'India: UPI, cards, net banking', fields: [['razorpay_key', 'Key ID', 'rzp_live_...', false], ['razorpay_secret', 'Key secret', '', true]] },
  { id: 'paystack', name: 'Paystack', hint: 'Nigeria, Ghana, South Africa, Kenya', fields: [['paystack_secret', 'Secret key', 'sk_live_...', true]] },
  { id: 'flutterwave', name: 'Flutterwave', hint: 'Cards and mobile money across Africa', fields: [['flutterwave_secret', 'Secret key', 'FLWSECK-...', true]] },
];
const mb = (bytes) => (bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`);

function useSettings() {
  const [s, setS] = useState(null);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  useEffect(() => { api.get('/user/settings').then(({ data }) => setS(data.data)); }, []);
  const set = (k, v) => { setS((x) => ({ ...x, [k]: v })); setErrors((e) => ({ ...e, [k]: undefined })); };
  const on = (k) => s?.[k] === '1' || s?.[k] === true;
  const save = async (keys) => {
    setSaving(true);
    try {
      const body = Object.fromEntries(keys.filter((k) => s[k] !== undefined).map((k) => [k, s[k]]));
      const d = await run(api.put('/user/settings', body));
      setS(d.data); // secrets typed in the form are dropped: the server only says whether one is saved
      setErrors({});
    } catch (e) { setErrors(e.errors || {}); } finally { setSaving(false); }
  };
  return { s, set, on, save, saving, errors };
}

function Preferences({ st }) {
  return (
    <Card>
      <CardHeader icon={SlidersHorizontal} title="Preferences" description="Used for prices on your cards and times in your panel" />
      <CardBody className="grid gap-4 sm:grid-cols-2">
        <Field label="Currency" hint="3-letter code, for example USD, PKR, AED. Used for paid appointments and for products without their own currency." error={st.errors.currency_code}><Input value={st.s.currency_code || ''} onChange={(e) => st.set('currency_code', e.target.value.toUpperCase())} maxLength={3} placeholder="USD" /></Field>
        <Field label="Time format" error={st.errors.time_format}><Select value={st.s.time_format || '24'} onChange={(v) => st.set('time_format', v)} options={[{ value: '24', label: '24-hour (14:30)' }, { value: '12', label: '12-hour (2:30 PM)' }]} /></Field>
        <div className="sm:col-span-2"><SwitchRow id="oe" title="E-mail me about new orders" description="An e-mail for every product order and paid appointment on your cards" checked={st.s.order_emails !== '0' && st.s.order_emails !== false} onChange={(v) => st.set('order_emails', v)} /></div>
        <div className="sm:col-span-2 flex justify-end"><Button onClick={() => st.save(['currency_code', 'time_format', 'order_emails'])} loading={st.saving}>Save preferences</Button></div>
      </CardBody>
    </Card>
  );
}

function Payments({ st }) {
  const keys = ['manual_enable', 'manual_guide', ...GATEWAYS.flatMap((g) => [`${g.id}_enable`, ...g.fields.map((f) => f[0]), ...(g.mode ? ['paypal_mode'] : [])])];
  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader icon={CreditCard} title="Get paid on your cards" description="Visitors pay you directly for products and paid appointments. The money goes to your own account; keys are stored encrypted and never shown again." />
        <CardBody className="grid gap-3">
          {st.s.methods?.length ? <p className="text-sm">Active now: {st.s.methods.map((m) => <Badge key={m.id} tone="success" className="mr-1.5">{m.label}</Badge>)}</p> : <p className="rounded-2xl bg-warning-soft/50 p-3 text-sm">No payment method is active yet, so the Buy button and online appointment payment are hidden on your cards.</p>}
          <div>
            <SwitchRow id="pm-manual" title="Bank transfer / cash" description="The visitor sees your instructions and you mark the order as paid yourself" checked={st.on('manual_enable')} onChange={(v) => st.set('manual_enable', v)} />
            {st.on('manual_enable') && <div className="mt-3"><Field label="Payment instructions" required error={st.errors.manual_guide}><Textarea rows={3} value={st.s.manual_guide || ''} onChange={(e) => st.set('manual_guide', e.target.value)} placeholder="Bank name, account title, account number / IBAN, or your mobile wallet number" /></Field></div>}
          </div>
          {GATEWAYS.map((g) => (
            <div key={g.id}>
              <SwitchRow id={`pm-${g.id}`} title={g.name} description={g.hint} checked={st.on(`${g.id}_enable`)} onChange={(v) => st.set(`${g.id}_enable`, v)} />
              {st.on(`${g.id}_enable`) && (
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {g.fields.map(([k, lbl, ph, secret]) => (
                    <Field key={k} label={lbl} required={!secret || !st.s[`has_${k}`]} hint={secret && st.s[`has_${k}`] ? 'Saved. Leave empty to keep it.' : undefined} error={st.errors[k]}>
                      <Input type={secret ? 'password' : 'text'} autoComplete="off" value={st.s[k] || ''} onChange={(e) => st.set(k, e.target.value)} placeholder={secret && st.s[`has_${k}`] ? 'Saved' : ph} />
                    </Field>
                  ))}
                  {g.mode && <Field label="Mode"><Select value={st.s.paypal_mode || 'sandbox'} onChange={(v) => st.set('paypal_mode', v)} options={[{ value: 'sandbox', label: 'Sandbox (testing)' }, { value: 'live', label: 'Live' }]} /></Field>}
                </div>
              )}
            </div>
          ))}
          <div className="flex justify-end"><Button onClick={() => st.save(keys)} loading={st.saving}>Save payment settings</Button></div>
        </CardBody>
      </Card>
    </div>
  );
}

function OwnMail({ st }) {
  const [testing, setTesting] = useState(false);
  const test = async () => { setTesting(true); await run(api.post('/user/settings/test-mail')).catch(() => {}); setTesting(false); };
  return (
    <Card>
      <CardHeader icon={Mail} title="My e-mail" description="Send e-mails to your customers (order and appointment updates) from your own address. If it is off or fails, the system address is used." />
      <CardBody className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2"><SwitchRow id="smtp" title="Use my own mail server" checked={st.on('smtp_enable')} onChange={(v) => st.set('smtp_enable', v)} /></div>
        {st.on('smtp_enable') && (
          <>
            <Field label="Mail server" required error={st.errors.smtp_host}><Input value={st.s.smtp_host || ''} onChange={(e) => st.set('smtp_host', e.target.value)} placeholder="smtp.yourdomain.com" /></Field>
            <Field label="Port" required hint="Usually 465 (SSL) or 587" error={st.errors.smtp_port}><Input value={st.s.smtp_port || ''} onChange={(e) => st.set('smtp_port', e.target.value)} inputMode="numeric" placeholder="587" /></Field>
            <Field label="User name" error={st.errors.smtp_user}><Input value={st.s.smtp_user || ''} onChange={(e) => st.set('smtp_user', e.target.value)} autoComplete="off" /></Field>
            <Field label="Password" hint={st.s.has_smtp_password ? 'Saved. Leave empty to keep it.' : undefined}><Input type="password" autoComplete="new-password" value={st.s.smtp_password || ''} onChange={(e) => st.set('smtp_password', e.target.value)} placeholder={st.s.has_smtp_password ? 'Saved' : ''} /></Field>
            <Field label="From name" error={st.errors.smtp_from_name}><Input value={st.s.smtp_from_name || ''} onChange={(e) => st.set('smtp_from_name', e.target.value)} placeholder="Your business name" /></Field>
            <Field label="From e-mail address" required error={st.errors.smtp_from_email}><Input type="email" value={st.s.smtp_from_email || ''} onChange={(e) => st.set('smtp_from_email', e.target.value)} placeholder="hello@yourdomain.com" /></Field>
          </>
        )}
        <div className="sm:col-span-2 flex justify-end gap-2">
          {st.on('smtp_enable') && <Button variant="outline" onClick={test} loading={testing}><Send />Send test e-mail</Button>}
          <Button onClick={() => st.save(['smtp_enable', 'smtp_host', 'smtp_port', 'smtp_user', 'smtp_password', 'smtp_from_name', 'smtp_from_email'])} loading={st.saving}>Save e-mail settings</Button>
        </div>
      </CardBody>
    </Card>
  );
}

function Storage() {
  const [d, setD] = useState(null);
  useEffect(() => { api.get('/user/storage').then(({ data }) => setD(data.data)); }, []);
  if (!d) return <Skeleton className="h-64 rounded-3xl" />;
  const pct = d.limit ? Math.min(100, Math.round((d.used / d.limit) * 100)) : 0;
  const rows = [...d.parts, ...(d.other > 0 ? [{ label: 'Other files', bytes: d.other }] : [])].filter((x) => x.bytes > 0);
  return (
    <Card>
      <CardHeader icon={HardDrive} title="Storage" description="Space used by the images and files you uploaded" />
      <CardBody className="grid gap-5">
        <div>
          <div className="mb-2 flex items-end justify-between"><p className="font-display text-2xl font-semibold">{mb(d.used)} <span className="text-sm font-normal text-muted-foreground">used{d.limit ? ` of ${mb(d.limit)}` : ''}</span></p>{d.limit > 0 && <p className="text-sm text-muted-foreground">{mb(d.free)} free</p>}</div>
          {d.limit > 0 && <div className="h-3 overflow-hidden rounded-full bg-muted"><div className={cn('h-full rounded-full', pct > 90 ? 'bg-danger' : pct > 70 ? 'bg-warning' : 'bg-primary')} style={{ width: `${pct}%` }} /></div>}
        </div>
        {rows.length ? (
          <div className="divide-y divide-border rounded-2xl border border-border">
            {rows.map((x) => <div key={x.label} className="flex items-center justify-between px-4 py-3 text-sm"><span>{x.label}</span><span className="tabular-nums text-muted-foreground">{mb(x.bytes)}</span></div>)}
          </div>
        ) : <p className="text-sm text-muted-foreground">Nothing uploaded yet.</p>}
      </CardBody>
    </Card>
  );
}

function DeleteAccount() {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const [text, setText] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const go = async () => {
    if (text.trim().toLowerCase() !== String(user.email).toLowerCase()) { setErr('Type your e-mail address exactly to confirm'); return; }
    if (!(await confirm({ title: 'Delete your account for good?', description: 'Your vCards, stores, leads and orders are removed and your card links stop working. This cannot be undone.', confirmText: 'Delete my account', tone: 'danger' }))) return;
    setBusy(true);
    try { await run(api.delete('/user/account', { data: { confirm: text } })); setUser?.(null); navigate('/login'); window.location.reload(); } catch (e) { setErr(e.errors?.confirm || e.message); } finally { setBusy(false); }
  };
  return (
    <Card>
      <CardHeader icon={ShieldAlert} title="Delete account" description="Permanently remove your account and everything in it" />
      <CardBody className="grid gap-4">
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground"><li>All your vCards, WhatsApp stores, enquiries, appointments and orders are deleted.</li><li>Your card links and QR codes stop working at once.</li><li>An active plan is not refunded.</li></ul>
        <Field label={`Type ${user?.email} to confirm`} error={err}><Input value={text} onChange={(e) => { setText(e.target.value); setErr(''); }} autoComplete="off" placeholder={user?.email} /></Field>
        <div><Button variant="danger" onClick={go} loading={busy} disabled={!text.trim()}><Trash2 />Delete my account</Button></div>
      </CardBody>
    </Card>
  );
}

export function UserSettings() {
  const st = useSettings();
  const [tab, setTab] = useState('payments');
  return (
    <>
      <PageHeader title="Settings" description="How you get paid, your preferences, your own e-mail, storage and your account." />
      <div className="mb-5 overflow-x-auto"><Segmented id="us-tab" value={tab} onChange={setTab} options={[{ value: 'payments', label: 'Payments' }, { value: 'prefs', label: 'Preferences' }, { value: 'mail', label: 'My e-mail' }, { value: 'storage', label: 'Storage' }, { value: 'delete', label: 'Delete account' }]} /></div>
      {tab === 'storage' ? <Storage /> : tab === 'delete' ? <DeleteAccount /> : !st.s ? <Skeleton className="h-72 rounded-3xl" /> : tab === 'payments' ? <Payments st={st} /> : tab === 'prefs' ? <Preferences st={st} /> : <OwnMail st={st} />}
    </>
  );
}

const PAY = { stripe: 'Stripe', paypal: 'PayPal', paystack: 'Paystack', flutterwave: 'Flutterwave', razorpay: 'Razorpay', manual: 'Bank / cash' };
export function ProductOrders() {
  const list = useList('/user/product-orders');
  const upd = async (o, patch) => { await run(api.patch(`/user/product-orders/${o.id}`, patch)).catch(() => {}); list.reload(); };
  const remove = async (o) => { if (await confirm({ title: `Delete order ${o.order_number}?` })) { await run(api.delete(`/user/product-orders/${o.id}`)).catch(() => {}); list.reload(); } };
  return (
    <>
      <PageHeader title="Product orders" description="Products and paid appointments that visitors ordered on your vCards. Set up how you get paid in Settings." />
      <TableCard title="Orders" list={list} toolbar={<>
        <FilterSelect value={list.params.kind} onChange={(v) => list.set({ kind: v })} placeholder="Products and appointments" options={[{ value: 'product', label: 'Products' }, { value: 'appointment', label: 'Appointments' }]} />
        <FilterSelect value={list.params.payment_status} onChange={(v) => list.set({ payment_status: v })} placeholder="Any payment" options={[{ value: 'paid', label: 'Paid' }, { value: 'pending', label: 'Not paid yet' }, { value: 'failed', label: 'Failed' }]} />
        <FilterSelect value={list.params.status} onChange={(v) => list.set({ status: v })} placeholder="Any status" options={['pending', 'approved', 'rejected', 'delivered', 'cancelled'].map((s) => ({ value: s, label: label(s) }))} />
        <SearchInput value={list.params.search} onChange={(search) => list.set({ search })} placeholder="Order, customer, product..." />
      </>}>
        <DataTable loading={list.loading} rows={list.rows} empty={<EmptyState icon={ShoppingBag} title="No orders yet" description="Add a price to a product on your card and switch on a payment method in Settings. Visitors then see a Buy button." />} columns={[
          { key: 'no', label: 'Order', render: (o) => <div><p className="font-mono text-xs font-semibold text-primary">{o.order_number}</p><p className="text-xs text-muted-foreground">{fmtDateTime(o.created_at)}</p></div> },
          { key: 'item', label: 'Item', render: (o) => <div className="max-w-56"><p className="truncate font-medium">{o.quantity > 1 ? `${o.quantity} x ` : ''}{o.item_name}</p><p className="text-xs text-muted-foreground">{o.vcard?.name}</p></div> },
          { key: 'cust', label: 'Customer', className: 'whitespace-normal', render: (o) => <div><p className="font-medium">{o.customer_name}</p><p className="text-xs text-muted-foreground">{[o.customer_phone, o.customer_email].filter(Boolean).join(' · ')}</p>{o.customer_address && <p className="max-w-56 text-xs text-muted-foreground">{o.customer_address}</p>}</div> },
          { key: 'amt', label: 'Total', render: (o) => <div><p className="font-semibold tabular-nums">{o.currency_code} {Number(o.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p><p className="text-xs text-muted-foreground">{PAY[o.gateway] || o.gateway}</p></div> },
          { key: 'pay', label: 'Payment', render: (o) => <StatusBadge value={o.payment_status}>{o.payment_status === 'pending' ? 'Not paid yet' : undefined}</StatusBadge> },
          { key: 'st', label: 'Status', render: (o) => <StatusBadge value={o.status} /> },
          { key: '_a', label: '', className: 'text-right', render: (o) => (
            <Actions>
              {o.gateway === 'manual' && o.payment_status !== 'paid' && <Action icon={Banknote} label="Mark as paid" onClick={() => upd(o, { payment_status: 'paid' })} />}
              {o.status === 'pending' && <Action icon={Check} label="Approve" onClick={() => upd(o, { status: 'approved' })} />}
              {o.status === 'pending' && <Action icon={X} label="Reject" tone="danger" onClick={() => upd(o, { status: 'rejected' })} />}
              {o.status === 'approved' && <Action icon={Truck} label="Mark as delivered" onClick={() => upd(o, { status: 'delivered' })} />}
              <Action icon={FileDown} label="Download PDF" href={`/api/user/product-orders/${o.id}/invoice`} />
              {['delivered', 'cancelled', 'rejected'].includes(o.status) && <Action icon={Trash2} label="Delete" tone="danger" onClick={() => remove(o)} />}
            </Actions>
          ) },
        ]} />
      </TableCard>
    </>
  );
}
