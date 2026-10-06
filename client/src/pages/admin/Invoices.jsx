/* Invoices: list with summary, editor with live totals + template picker, detail with live preview, payments and sending */
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import {
  FileText, Plus, Eye, Pencil, Trash2, Download, ArrowLeft, Send, Copy, ExternalLink, Wallet, CheckCircle2, Clock, AlertTriangle, Receipt, User, CalendarDays,
  X, Palette, HandCoins, Save, MessageCircle,
} from 'lucide-react';
import api from '@/lib/api';
import { cn } from '@/lib/cn';
import { fmtDate, fmtDateTime, label as humanize } from '@/lib/format';
import {
  PageHeader, StatCard, Card, CardHeader, CardBody, TableCard, DataTable, SearchInput, FilterSelect, Badge, EmptyState, Skeleton, Button, ButtonLink, Action, Actions,
  Dialog, Field, Input, Textarea, Select, Checkbox, Tip, useList, useForm, run, confirm,
} from '@/components/ui';
import { pkr, num, ymd, useFetch, FadeIn, Tile, Hint, PAYMENT_METHODS } from '@/components/BizKit';

export const INVOICE_STATUS = {
  draft: { label: 'Draft', tone: 'neutral' }, sent: { label: 'Sent', tone: 'info' }, partial: { label: 'Partly paid', tone: 'warning' },
  paid: { label: 'Paid', tone: 'success' }, overdue: { label: 'Overdue', tone: 'danger' }, cancelled: { label: 'Cancelled', tone: 'neutral' },
};
export const InvoiceStatus = ({ value }) => <Badge tone={INVOICE_STATUS[value]?.tone || 'neutral'} dot>{INVOICE_STATUS[value]?.label || humanize(value)}</Badge>;
const TYPES = [{ value: 'manual', label: 'Manual' }, { value: 'order', label: 'Order' }, { value: 'subscription', label: 'Subscription' }];
const TEMPLATE_FALLBACK = [
  { key: 'modern', label: 'Modern', accent: '#6d5dfc' }, { key: 'classic', label: 'Classic', accent: '#1f2937' }, { key: 'minimal', label: 'Minimal', accent: '#111111' },
  { key: 'bold', label: 'Bold', accent: '#e11d48' }, { key: 'elegant', label: 'Elegant', accent: '#b08d57' }, { key: 'corporate', label: 'Corporate', accent: '#0f4c81' },
];
const balanceOf = (i) => Math.max(0, num(i.total) - num(i.paid_amount));

/* ------------------------------------------------------ template thumbnails */
const Ln = ({ w = '100%', c = '#e5e7eb', h = 3, className, style }) => <span className={cn('block rounded-full', className)} style={{ width: w, height: h, background: c, ...style }} />;
function Rows({ n = 3, zebra, line }) {
  return Array.from({ length: n }).map((_, i) => (
    <div key={i} className="flex items-center justify-between gap-2 px-1 py-[3px]" style={{ background: zebra && i % 2 ? '#f5f5f8' : undefined, borderBottom: line ? `1px solid ${line}` : undefined }}>
      <Ln w="45%" /><Ln w="14%" />
    </div>
  ));
}
/** Paper-like miniature of each invoice template (always light, like the printed page) */
export function TemplateThumb({ tpl, accent }) {
  const a = accent || TEMPLATE_FALLBACK.find((t) => t.key === tpl)?.accent || '#6d5dfc';
  const body = {
    modern: (
      <>
        <div className="relative overflow-hidden px-2 pt-2 pb-3" style={{ background: `linear-gradient(135deg, ${a}, ${a}cc 60%, #b44cf5)` }}>
          <span className="absolute -top-4 -right-4 size-10 rounded-full bg-white/15" />
          <Ln w="40%" c="rgba(255,255,255,.95)" h={4} /><Ln w="25%" c="rgba(255,255,255,.6)" className="mt-1" />
        </div>
        <div className="space-y-1 p-2">
          <div className="rounded px-1 py-[3px]" style={{ background: `${a}22` }}><Ln w="30%" c={a} /></div>
          <Rows n={3} />
          <div className="ml-auto mt-1 w-1/2 rounded px-1 py-[3px]" style={{ background: a }}><Ln w="60%" c="#fff" /></div>
        </div>
      </>
    ),
    classic: (
      <div className="p-2" style={{ borderTop: `5px solid ${a}` }}>
        <div className="flex items-end justify-between pb-1.5" style={{ borderBottom: '1.5px solid #111' }}><Ln w="35%" c="#111" h={4} /><span className="font-serif text-[7px] font-bold tracking-[.2em] text-zinc-900">INVOICE</span></div>
        <div className="mt-2" style={{ borderTop: '1.5px solid #111', borderBottom: '1px solid #111' }}><div className="px-1 py-[3px]"><Ln w="30%" c="#111" /></div></div>
        <Rows n={3} line="#eee" />
        <div className="mt-1 ml-auto w-1/2 py-[3px]" style={{ borderTop: '1.5px solid #111', borderBottom: '3px double #111' }}><Ln w="60%" c="#111" /></div>
      </div>
    ),
    minimal: (
      <div className="p-2">
        <p className="text-[13px] leading-none font-light tracking-tight text-zinc-900">Invoice</p>
        <Ln w="30%" className="mt-1.5" />
        <div className="mt-2 pb-[3px]" style={{ borderBottom: '1px solid #111' }}><Ln w="25%" c="#9ca3af" /></div>
        <Rows n={3} line="#f1f1f1" />
        <div className="mt-1 ml-auto w-1/2 pt-[3px]" style={{ borderTop: '1px solid #111' }}><Ln w="60%" c="#111" /></div>
      </div>
    ),
    bold: (
      <>
        <div className="relative bg-[#0b0b12] px-2 pt-2 pb-3">
          <p className="text-[12px] leading-none font-black" style={{ color: a }}>INVOICE</p>
          <Ln w="35%" c="#a1a1aa" className="mt-1" />
          <span className="absolute inset-x-0 bottom-0 h-1" style={{ background: a }} />
        </div>
        <div className="space-y-1 p-2">
          <div className="rounded-sm bg-[#0b0b12] px-1 py-[3px]"><Ln w="30%" c="#fff" /></div>
          <Rows n={3} zebra />
          <div className="ml-auto mt-1 w-1/2 px-1 py-1" style={{ background: a }}><Ln w="60%" c="#fff" h={4} /></div>
        </div>
      </>
    ),
    elegant: (
      <div className="m-1 flex h-[calc(100%-8px)] flex-col items-stretch p-1.5" style={{ border: `1px solid ${a}88` }}>
        <div className="flex flex-col items-center"><Ln w="40%" c="#27272a" h={4} /><span className="mt-1 font-serif text-[6px] font-bold tracking-[.45em]" style={{ color: a }}>INVOICE</span></div>
        <span className="my-1.5 block h-px" style={{ background: `linear-gradient(90deg, transparent, ${a}, transparent)` }} />
        <div className="pb-[3px]" style={{ borderBottom: `1px solid ${a}` }}><Ln w="30%" c={a} /></div>
        <Rows n={3} />
        <div className="mt-1 ml-auto w-1/2 pt-[3px]" style={{ borderTop: `1px solid ${a}` }}><Ln w="60%" c={a} /></div>
      </div>
    ),
    corporate: (
      <div className="flex h-full">
        <span className="w-2.5 shrink-0" style={{ background: a, boxShadow: `3px 0 0 ${a}33` }} />
        <div className="min-w-0 flex-1 space-y-1 p-2 pl-3">
          <div className="flex justify-between"><Ln w="35%" c="#0f172a" h={4} /><Ln w="20%" c={a} /></div>
          <Ln w="50%" className="mt-1" />
          <div className="mt-2 rounded-sm bg-[#eef2f7] px-1 py-[3px]"><Ln w="30%" c="#0f172a" /></div>
          <Rows n={3} />
          <div className="ml-auto mt-1 w-1/2 bg-[#0f172a] px-1 py-[3px]"><Ln w="60%" c="#fff" /></div>
        </div>
      </div>
    ),
  }[tpl];
  return <div className="aspect-[3/4] w-full overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-black/5">{body || <div className="p-2"><Ln w="40%" /><Rows n={4} /></div>}</div>;
}
function TemplatePicker({ templates, value, onChange, compact }) {
  return (
    <div className={cn('grid gap-2.5', compact ? 'grid-cols-3 sm:grid-cols-6' : 'grid-cols-3')}>
      {templates.map((t) => {
        const on = value === t.key;
        return (
          <button key={t.key} type="button" onClick={() => onChange(t.key)} aria-pressed={on}
            className={cn('group cursor-pointer rounded-xl border-2 p-1.5 text-left transition', on ? 'border-primary bg-primary-soft/50' : 'border-transparent hover:border-primary/30 hover:bg-muted/50')}>
            <div className="transition duration-300 group-hover:-translate-y-0.5"><TemplateThumb tpl={t.key} accent={t.accent} /></div>
            <p className={cn('mt-1.5 flex items-center gap-1 text-xs font-medium', on ? 'text-primary' : 'text-muted-foreground')}><span className="size-2 rounded-full" style={{ background: t.accent }} />{t.label}</p>
          </button>
        );
      })}
    </div>
  );
}
const useTemplates = () => { const { data } = useFetch('/admin/invoices/templates'); return data?.data?.length ? data.data : TEMPLATE_FALLBACK; };

/* ==================================================================== list */
export function Invoices() {
  const list = useList('/admin/invoices');
  const s = list.extra?.summary;
  const remove = async (i) => {
    if (!(await confirm({ title: `Delete invoice ${i.number}?`, description: 'Its payments are deleted too. The public link stops working.' }))) return;
    await run(api.delete(`/admin/invoices/${i.id}`)).catch(() => {}); list.reload();
  };
  const f = (v) => pkr(Math.round(v));
  return (
    <>
      <PageHeader eyebrow="Billing" title="Invoices" description="Invoices for orders, subscriptions and manual sales. Share them online, send by e-mail or WhatsApp, download PDFs and record payments.">
        <ButtonLink as={Link} to="/admin/invoices/create"><Plus />New invoice</ButtonLink>
      </PageHeader>
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {s ? <>
          <StatCard index={0} icon={Receipt} color="violet" label="Total invoiced" value={s.total} format={f} hint="Excluding cancelled" />
          <StatCard index={1} icon={CheckCircle2} color="emerald" label="Paid" value={s.paid} format={f} hint="Payments received" />
          <StatCard index={2} icon={Clock} color="amber" label="Outstanding" value={s.outstanding} format={f} hint="Sent but not fully paid" />
          <StatCard index={3} icon={AlertTriangle} color="rose" label="Overdue" value={s.overdue} format={f} hint="Past the due date" />
        </> : [0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-32 rounded-2xl" />)}
      </div>
      <TableCard title="All invoices" list={list} toolbar={<>
        <FilterSelect value={list.params.status} onChange={(v) => list.set({ status: v })} placeholder="All statuses" options={Object.entries(INVOICE_STATUS).map(([value, x]) => ({ value, label: x.label }))} />
        <FilterSelect value={list.params.type} onChange={(v) => list.set({ type: v })} placeholder="All types" options={TYPES} />
        <SearchInput value={list.params.search} onChange={(search) => list.set({ search })} placeholder="Number, customer, e-mail..." />
      </>}>
        <DataTable loading={list.loading} rows={list.rows}
          empty={<EmptyState icon={FileText} title="No invoices found" description="Create one manually, or generate it from an order or a subscription payment." action={<ButtonLink as={Link} to="/admin/invoices/create"><Plus />New invoice</ButtonLink>} />}
          columns={[
            { key: 'number', label: 'Invoice', render: (i) => <Link to={`/admin/invoices/${i.id}`} className="group"><p className="font-semibold group-hover:text-primary">{i.number}</p><p className="text-xs text-muted-foreground">{humanize(i.type)}{i.nfc_order ? ` · ${i.nfc_order.order_number}` : ''}</p></Link> },
            { key: 'customer', label: 'Customer', render: (i) => <div className="max-w-56"><p className="truncate font-medium">{i.customer_name}</p><p className="truncate text-xs text-muted-foreground">{i.customer_company || i.customer_email || i.customer_phone || '-'}</p></div> },
            { key: 'issue_date', label: 'Issued', render: (i) => <span className="text-muted-foreground">{fmtDate(i.issue_date)}</span> },
            { key: 'due_date', label: 'Due', render: (i) => <span className={cn(i.status === 'overdue' ? 'font-medium text-danger' : 'text-muted-foreground')}>{fmtDate(i.due_date)}</span> },
            { key: 'total', label: 'Total', className: 'text-right', render: (i) => <b className="tabular-nums">{pkr(i.total, i.currency_icon)}</b> },
            { key: 'balance', label: 'Balance', className: 'text-right', render: (i) => (balanceOf(i) > 0.009 && i.status !== 'cancelled' ? <span className="tabular-nums text-danger">{pkr(balanceOf(i), i.currency_icon)}</span> : <span className="text-muted-foreground">-</span>) },
            { key: 'status', label: 'Status', render: (i) => <InvoiceStatus value={i.status} /> },
            { key: '_a', label: '', className: 'text-right', render: (i) => (
              <Actions>
                <Action icon={Eye} label="View" to={`/admin/invoices/${i.id}`} />
                <Action icon={Pencil} label="Edit" tone="info" to={`/admin/invoices/${i.id}/edit`} />
                <Action icon={Download} label="Download PDF" tone="success" href={`/api/admin/invoices/${i.id}/pdf`} />
                <Action icon={Trash2} label="Delete" tone="danger" onClick={() => remove(i)} />
              </Actions>
            ) },
          ]} />
      </TableCard>
    </>
  );
}

/* ================================================================== editor */
let seq = 0;
const line = (x = {}) => ({ key: ++seq, description: '', quantity: 1, unit_price: '', ...x });
const r2 = (n) => Math.round(num(n) * 100) / 100;
/** mirrors services/invoices.js totals() */
export function invoiceTotals(v, items) {
  const rows = items.map((it) => ({ ...it, total: r2(num(it.quantity || 1) * num(it.unit_price)) }));
  const subtotal = r2(rows.reduce((a, it) => a + it.total, 0));
  const discount = Math.min(subtotal, r2(v.discount));
  const tax = r2(((subtotal - discount) * num(v.tax_rate)) / 100);
  return { rows, subtotal, discount, tax, total: r2(subtotal - discount + tax + num(v.delivery_charges)) };
}
const EDIT_FIELDS = ['customer_name', 'customer_email', 'customer_phone', 'customer_company', 'customer_address', 'issue_date', 'due_date', 'template', 'discount', 'tax_name', 'tax_rate', 'delivery_charges', 'notes', 'terms', 'currency_code', 'currency_icon'];
const blankInvoice = () => ({ customer_name: '', customer_email: '', customer_phone: '', customer_company: '', customer_address: '', issue_date: ymd(), due_date: '', template: '', discount: '', tax_name: '', tax_rate: '', delivery_charges: '', notes: '', terms: '', currency_code: 'PKR', currency_icon: 'Rs' });

export function InvoiceEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const templates = useTemplates();
  const form = useForm(blankInvoice());
  const [items, setItems] = useState([line()]);
  const [inv, setInv] = useState(null);
  const [loading, setLoading] = useState(!!id);
  const [saving, setSaving] = useState('');
  useEffect(() => {
    if (!id) return;
    api.get(`/admin/invoices/${id}`).then(({ data }) => {
      const d = data.data;
      setInv(d);
      form.setValues(Object.fromEntries(EDIT_FIELDS.map((k) => [k, d[k] ?? ''])));
      setItems((d.items || []).length ? d.items.map((it) => line({ description: it.description, quantity: it.quantity, unit_price: it.unit_price })) : [line()]);
    }).catch((e) => toast.error(e.message)).finally(() => setLoading(false));
  }, [id]); // eslint-disable-line
  const v = form.values;
  const t = invoiceTotals(v, items);
  const cur = v.currency_icon || 'Rs';
  const setItem = (key, p) => setItems((xs) => xs.map((x) => (x.key === key ? { ...x, ...p } : x)));

  const save = async (status) => {
    const list = items.filter((it) => String(it.description).trim() || num(it.unit_price));
    if (!v.customer_name.trim()) { form.setErrors({ customer_name: 'Enter the customer name' }); return; }
    if (!list.length) { form.setErrors({ items: 'Add at least one line item' }); return; }
    setSaving(status);
    const body = { ...v, items: list.map((it) => ({ description: it.description, quantity: num(it.quantity) || 1, unit_price: num(it.unit_price) })), status };
    for (const k of ['discount', 'tax_rate', 'delivery_charges']) body[k] = num(body[k]);
    if (!id) { for (const k of ['notes', 'terms', 'template', 'due_date']) if (!String(body[k] || '').trim()) delete body[k]; }
    try {
      const res = await run(id ? api.put(`/admin/invoices/${id}`, body) : api.post('/admin/invoices', body));
      navigate(`/admin/invoices/${res.data?.id || id}`);
    } catch (ex) { form.setErrors(ex.errors || {}); } finally { setSaving(''); }
  };
  if (loading) return <div className="space-y-6"><Skeleton className="h-10 w-64" /><div className="grid gap-6 xl:grid-cols-[1fr_380px]"><Skeleton className="h-[640px] rounded-2xl" /><Skeleton className="h-[480px] rounded-2xl" /></div></div>;
  const keepStatus = inv && !['draft'].includes(inv.status) ? (inv.status === 'cancelled' ? 'cancelled' : 'sent') : 'sent';

  return (
    <>
      <Link to={id ? `/admin/invoices/${id}` : '/admin/invoices'} className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" />{id ? 'Back to invoice' : 'All invoices'}</Link>
      <PageHeader eyebrow="Billing" title={id ? `Edit ${inv?.number || 'invoice'}` : 'New invoice'} description="Customer details, line items, tax and delivery. Totals update as you type; the number is assigned automatically.">
        <Button variant="outline" onClick={() => save('draft')} loading={saving === 'draft'} disabled={!!saving}><Save />Save as draft</Button>
        <Button onClick={() => save(keepStatus)} loading={saving === keepStatus} disabled={!!saving}><CheckCircle2 />{id && inv?.status !== 'draft' ? 'Save invoice' : 'Save & mark as sent'}</Button>
      </PageHeader>
      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <div className="min-w-0 space-y-6">
          <FadeIn>
            <Card>
              <CardHeader icon={User} title="Bill to" />
              <CardBody className="grid gap-4 sm:grid-cols-2">
                <Field label="Customer name" required error={form.errors.customer_name}><Input {...form.input('customer_name')} placeholder="Full name" /></Field>
                <Field label="Company"><Input {...form.input('customer_company')} placeholder="Optional" /></Field>
                <Field label="E-mail" error={form.errors.customer_email}><Input {...form.input('customer_email')} type="email" placeholder="For sending the invoice" /></Field>
                <Field label="Phone / WhatsApp"><Input {...form.input('customer_phone')} placeholder="03xx xxxxxxx" /></Field>
                <Field label="Address" className="sm:col-span-2"><Textarea {...form.input('customer_address')} rows={2} /></Field>
              </CardBody>
            </Card>
          </FadeIn>
          <FadeIn delay={0.05}>
            <Card>
              <CardHeader icon={CalendarDays} title="Dates & currency" />
              <CardBody className="grid gap-4 sm:grid-cols-4">
                <Field label="Issue date" className="sm:col-span-1"><Input {...form.input('issue_date')} type="date" /></Field>
                <Field label="Due date" hint={!id && !v.due_date ? 'Empty = default payment terms' : undefined}><Input {...form.input('due_date')} type="date" min={v.issue_date || undefined} /></Field>
                <Field label="Currency code"><Input {...form.input('currency_code')} maxLength={10} /></Field>
                <Field label="Symbol"><Input {...form.input('currency_icon')} maxLength={10} /></Field>
              </CardBody>
            </Card>
          </FadeIn>
          <FadeIn delay={0.1}>
            <Card>
              <CardHeader icon={Receipt} title="Line items" actions={<Button size="sm" variant="soft" onClick={() => setItems((xs) => [...xs, line()])}><Plus />Add line</Button>} />
              <CardBody className="p-0">
                {form.errors.items && <p className="mx-5 mt-4 rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger">{form.errors.items}</p>}
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[600px] text-sm">
                    <thead><tr className="border-b border-border bg-muted/40 text-left text-xs font-semibold text-muted-foreground uppercase"><th className="px-5 py-2.5">Description</th><th className="w-24 px-2 py-2.5 text-right">Qty</th><th className="w-36 px-2 py-2.5 text-right">Price ({cur})</th><th className="w-32 px-2 py-2.5 text-right">Amount</th><th className="w-12" /></tr></thead>
                    <tbody className="divide-y divide-border">
                      {t.rows.map((it) => (
                        <tr key={it.key}>
                          <td className="px-5 py-2"><Input value={it.description} onChange={(e) => setItem(it.key, { description: e.target.value })} placeholder="e.g. Premium metal NFC card" aria-label="Description" /></td>
                          <td className="px-2 py-2"><Input value={it.quantity} onChange={(e) => setItem(it.key, { quantity: e.target.value })} type="number" min="1" step="1" className="text-right" aria-label="Quantity" /></td>
                          <td className="px-2 py-2"><Input value={it.unit_price} onChange={(e) => setItem(it.key, { unit_price: e.target.value })} type="number" min="0" step="0.01" className="text-right" aria-label="Unit price" placeholder="0" /></td>
                          <td className="px-2 py-2 text-right font-medium tabular-nums">{pkr(it.total, cur)}</td>
                          <td className="py-2 pr-3"><Tip content="Remove line"><button type="button" aria-label="Remove line" disabled={items.length < 2} onClick={() => setItems((xs) => xs.filter((x) => x.key !== it.key))} className="grid size-8 cursor-pointer place-items-center rounded-lg text-muted-foreground transition hover:bg-danger-soft hover:text-danger disabled:opacity-30"><X className="size-4" /></button></Tip></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="grid gap-4 border-t border-border p-5 sm:grid-cols-4">
                  <Field label="Discount"><Input {...form.input('discount')} type="number" min="0" step="0.01" prefix={cur} placeholder="0" /></Field>
                  <Field label="Tax name"><Input {...form.input('tax_name')} placeholder="e.g. GST" /></Field>
                  <Field label="Tax rate %"><Input {...form.input('tax_rate')} type="number" min="0" max="100" step="0.01" placeholder="0" /></Field>
                  <Field label="Delivery"><Input {...form.input('delivery_charges')} type="number" min="0" step="0.01" prefix={cur} placeholder="0" /></Field>
                </div>
              </CardBody>
            </Card>
          </FadeIn>
          <FadeIn delay={0.15}>
            <Card>
              <CardHeader icon={FileText} title="Notes & terms" description={!id ? 'Leave empty to use the defaults from Settings > Invoices' : undefined} />
              <CardBody className="grid gap-4 sm:grid-cols-2">
                <Field label="Notes"><Textarea {...form.input('notes')} rows={4} placeholder="Thank you for your business" /></Field>
                <Field label="Terms & conditions"><Textarea {...form.input('terms')} rows={4} placeholder="Payment within 7 days" /></Field>
              </CardBody>
            </Card>
          </FadeIn>
        </div>

        <div className="space-y-6 xl:sticky xl:top-24 xl:h-fit">
          <FadeIn delay={0.1}>
            <Card>
              <CardHeader icon={Wallet} title="Summary" />
              <CardBody className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span className="tabular-nums">{pkr(t.subtotal, cur)}</span></div>
                {t.discount > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Discount</span><span className="tabular-nums text-danger">- {pkr(t.discount, cur)}</span></div>}
                {t.tax > 0 && <div className="flex justify-between"><span className="text-muted-foreground">{v.tax_name || 'Tax'} ({num(v.tax_rate)}%)</span><span className="tabular-nums">{pkr(t.tax, cur)}</span></div>}
                {num(v.delivery_charges) > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Delivery</span><span className="tabular-nums">{pkr(v.delivery_charges, cur)}</span></div>}
                <div className="flex items-center justify-between rounded-xl bg-primary px-3.5 py-3 font-display text-lg font-bold text-primary-foreground"><span>Total</span><span className="tabular-nums">{pkr(t.total, cur)}</span></div>
                {inv && num(inv.paid_amount) > 0 && <div className="flex justify-between pt-1"><span className="text-muted-foreground">Already paid</span><span className="tabular-nums text-success">{pkr(inv.paid_amount, cur)}</span></div>}
              </CardBody>
            </Card>
          </FadeIn>
          <FadeIn delay={0.15}>
            <Card>
              <CardHeader icon={Palette} title="Template" description={v.template ? `${templates.find((x) => x.key === v.template)?.label || v.template} selected` : 'Default template from settings'}
                actions={v.template && !id && <Button size="xs" variant="ghost" onClick={() => form.set('template', '')}>Use default</Button>} />
              <CardBody><TemplatePicker templates={templates} value={v.template} onChange={(k) => form.set('template', k)} /></CardBody>
            </Card>
          </FadeIn>
        </div>
      </div>
    </>
  );
}

/* ==================================================================== view */
function PaymentDialog({ inv, open, onClose, onDone }) {
  const form = useForm({});
  const [saving, setSaving] = useState(false);
  const [was, setWas] = useState(false);
  if (open !== was) { setWas(open); if (open) { form.setErrors({}); form.setValues({ amount: String(balanceOf(inv)), date: ymd(), method: '', reference: '', note: '' }); } }
  const save = async (e) => {
    e?.preventDefault(); setSaving(true);
    try { await run(api.post(`/admin/invoices/${inv.id}/payments`, form.values)); onClose(); onDone(); } catch (ex) { form.setErrors(ex.errors || {}); } finally { setSaving(false); }
  };
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()} icon={HandCoins} title="Record payment" description={inv ? `Balance due ${pkr(balanceOf(inv), inv.currency_icon)}` : undefined}
      footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={save} loading={saving}>Record payment</Button></>}>
      <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
        <Field label="Amount" required error={form.errors.amount}><Input {...form.input('amount')} type="number" min="0" step="0.01" prefix={inv?.currency_icon || 'Rs'} /></Field>
        <Field label="Date"><Input {...form.input('date')} type="date" /></Field>
        <Field label="Method"><Select value={form.values.method} onChange={(x) => form.set('method', x)} options={PAYMENT_METHODS} allowEmpty placeholder="Not set" /></Field>
        <Field label="Reference"><Input {...form.input('reference')} placeholder="Transaction no." /></Field>
        <Field label="Note" className="sm:col-span-2"><Textarea {...form.input('note')} rows={2} /></Field>
        <button type="submit" className="hidden" />
      </form>
    </Dialog>
  );
}

function SendDialog({ inv, open, onClose, onDone }) {
  const [email, setEmail] = useState('');
  const [wa, setWa] = useState(false);
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);
  const [was, setWas] = useState(false);
  if (open !== was) { setWas(open); if (open) { setEmail(inv?.customer_email || ''); setWa(!!inv?.customer_phone); setErr(''); } }
  const send = async (e) => {
    e?.preventDefault(); setSaving(true);
    try { await run(api.post(`/admin/invoices/${inv.id}/send`, { email, whatsapp: wa })); onClose(); onDone(); } catch (ex) { setErr(ex.errors?.email || ''); } finally { setSaving(false); }
  };
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()} icon={Send} title={`Send ${inv?.number || 'invoice'}`} description="The PDF is attached and the e-mail links to the online invoice."
      footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={send} loading={saving} disabled={!email.trim()}><Send />Send invoice</Button></>}>
      <form onSubmit={send} className="space-y-4">
        <Field label="Send to" required error={err}><Input value={email} onChange={(e) => { setEmail(e.target.value); setErr(''); }} type="email" placeholder="customer@example.com" aria-invalid={!!err || undefined} /></Field>
        <div className="rounded-2xl border border-border p-4">
          <Checkbox id="inv-wa" checked={wa} onChange={setWa} label={<span className="inline-flex items-center gap-1.5"><MessageCircle className="size-4 text-success" />Also send the link on WhatsApp</span>} />
          <p className="mt-1.5 pl-7 text-xs text-muted-foreground">{inv?.customer_phone ? `To ${inv.customer_phone}, if WhatsApp messaging is configured.` : 'Add a customer phone number to use WhatsApp.'}</p>
        </div>
        <button type="submit" className="hidden" />
      </form>
    </Dialog>
  );
}

export function InvoiceView() {
  const { id } = useParams();
  const { data, reload } = useFetch(`/admin/invoices/${id}`);
  const templates = useTemplates();
  const inv = data?.data;
  const [tpl, setTpl] = useState('');
  const [frameKey, setFrameKey] = useState(0);
  const [loadingFrame, setLoadingFrame] = useState(true);
  const [payOpen, setPayOpen] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);
  const [savingTpl, setSavingTpl] = useState(false);
  useEffect(() => { if (inv && !tpl) setTpl(inv.template || 'modern'); }, [inv]); // eslint-disable-line
  const src = useMemo(() => (data?.public_url && tpl ? `${data.public_url}?embed=1&template=${encodeURIComponent(tpl)}` : null), [data?.public_url, tpl]);
  useEffect(() => { setLoadingFrame(true); }, [src, frameKey]);
  const refresh = () => { reload(); setFrameKey((k) => k + 1); };

  if (!inv) {
    return (
      <>
        <Skeleton className="mb-4 h-4 w-28" /><Skeleton className="mb-6 h-10 w-72" />
        <div className="grid gap-6 xl:grid-cols-[1fr_380px]"><Skeleton className="h-[720px] rounded-2xl" /><Skeleton className="h-[480px] rounded-2xl" /></div>
      </>
    );
  }
  const cur = inv.currency_icon;
  const bal = balanceOf(inv);
  const copy = () => { navigator.clipboard?.writeText(data.public_url).then(() => toast.success('Share link copied'), () => toast.error('Could not copy')); };
  const removePayment = async (p) => {
    if (!(await confirm({ title: `Remove payment of ${pkr(p.amount, cur)}?` }))) return;
    await run(api.delete(`/admin/invoices/${inv.id}/payments/${p.id}`)).catch(() => {}); refresh();
  };
  const applyTemplate = async () => {
    setSavingTpl(true);
    const body = { ...Object.fromEntries(EDIT_FIELDS.map((k) => [k, inv[k] ?? ''])), template: tpl, items: inv.items, status: ['draft', 'cancelled'].includes(inv.status) ? inv.status : 'sent' };
    try { await run(api.put(`/admin/invoices/${inv.id}`, body), 'Template saved for this invoice'); reload(); } catch { /* toast shown */ } finally { setSavingTpl(false); }
  };

  return (
    <>
      <Link to="/admin/invoices" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" />All invoices</Link>
      <PageHeader eyebrow={<span className="inline-flex items-center gap-2">Invoice <InvoiceStatus value={inv.status} /></span>} title={inv.number} description={`${inv.customer_name}${inv.customer_company ? ` · ${inv.customer_company}` : ''} · issued ${fmtDate(inv.issue_date)}${inv.sent_at ? ` · last sent ${fmtDateTime(inv.sent_at)}` : ''}`}>
        <Tip content="Copy share link"><Button variant="outline" size="icon" aria-label="Copy share link" onClick={copy}><Copy /></Button></Tip>
        <Tip content="Open public page"><ButtonLink href={data.public_url} target="_blank" rel="noreferrer" variant="outline" size="icon" aria-label="Open public page"><ExternalLink /></ButtonLink></Tip>
        <Tip content="Download PDF"><ButtonLink href={`/api/admin/invoices/${inv.id}/pdf`} variant="outline" size="icon" aria-label="Download PDF"><Download /></ButtonLink></Tip>
        <ButtonLink as={Link} to={`/admin/invoices/${inv.id}/edit`} variant="outline"><Pencil />Edit</ButtonLink>
        <Button onClick={() => setSendOpen(true)}><Send />Send</Button>
      </PageHeader>

      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <FadeIn className="min-w-0">
          <Card className="overflow-hidden">
            <CardHeader icon={Eye} title="Live preview" description="Exactly what the customer sees on the share link"
              actions={tpl !== inv.template && <Button size="sm" onClick={applyTemplate} loading={savingTpl}><Palette />Use {templates.find((x) => x.key === tpl)?.label || tpl}</Button>} />
            <div className="border-b border-border p-4"><TemplatePicker compact templates={templates} value={tpl} onChange={setTpl} /></div>
            <div className="relative bg-muted/50">
              {loadingFrame && <div className="absolute inset-0 grid place-items-center"><Skeleton className="h-[90%] w-[90%] rounded-xl" /></div>}
              {src && <iframe key={`${src}-${frameKey}`} src={src} title={`Invoice ${inv.number} preview`} onLoad={() => setLoadingFrame(false)} className={cn('block h-[78vh] min-h-[560px] w-full border-0 transition-opacity duration-300', loadingFrame ? 'opacity-0' : 'opacity-100')} />}
            </div>
          </Card>
        </FadeIn>

        <div className="space-y-6">
          <FadeIn delay={0.08}>
            <Card>
              <CardHeader icon={Wallet} title="Amounts" />
              <CardBody className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <Tile label="Total" value={pkr(inv.total, cur)} />
                  <Tile label="Balance due" value={pkr(bal, cur)} tone={bal > 0.009 && inv.status !== 'cancelled' ? 'out' : 'in'} />
                </div>
                <dl className="space-y-1.5 text-sm">
                  <div className="flex justify-between"><dt className="text-muted-foreground">Paid</dt><dd className="text-success tabular-nums">{pkr(inv.paid_amount, cur)}</dd></div>
                  <div className="flex justify-between"><dt className="text-muted-foreground">Due date</dt><dd className={cn(inv.status === 'overdue' && 'font-medium text-danger')}>{fmtDate(inv.due_date)}</dd></div>
                  <div className="flex justify-between"><dt className="text-muted-foreground">Type</dt><dd>{humanize(inv.type)}{inv.nfc_order ? ` · ${inv.nfc_order.order_number}` : ''}</dd></div>
                  <div className="flex justify-between"><dt className="text-muted-foreground">Customer</dt><dd className="max-w-52 truncate text-right">{inv.customer_email || inv.customer_phone || '-'}</dd></div>
                </dl>
                {bal > 0.009 && inv.status !== 'cancelled' && <Button className="w-full" variant="success-soft" onClick={() => setPayOpen(true)}><HandCoins />Record payment</Button>}
              </CardBody>
            </Card>
          </FadeIn>
          <FadeIn delay={0.14}>
            <Card className="overflow-hidden">
              <CardHeader icon={HandCoins} title="Payments" description={`${(inv.payments || []).length} recorded`} actions={<Tip content="Add payment"><Button size="icon-sm" variant="soft" aria-label="Add payment" onClick={() => setPayOpen(true)}><Plus /></Button></Tip>} />
              {!(inv.payments || []).length ? <EmptyState icon={HandCoins} title="No payments yet" description="Record bank transfers, cash or wallet payments against this invoice." /> : (
                <ul className="divide-y divide-border">
                  {inv.payments.map((p) => (
                    <li key={p.id} className="group flex items-center gap-3 px-5 py-3">
                      <span className="grid size-9 place-items-center rounded-xl bg-success-soft text-success"><CheckCircle2 className="size-4" /></span>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold tabular-nums">{pkr(p.amount, cur)}</p>
                        <p className="truncate text-xs text-muted-foreground">{fmtDate(p.date)}{p.method ? ` · ${p.method}` : ''}{p.reference ? ` · ${p.reference}` : ''}</p>
                        {p.note && <p className="truncate text-xs text-muted-foreground">{p.note}</p>}
                      </div>
                      <Action icon={Trash2} label="Remove payment" tone="danger" onClick={() => removePayment(p)} />
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </FadeIn>
          <FadeIn delay={0.2}>
            <Card>
              <CardBody className="space-y-2 text-sm">
                <p className="flex items-center gap-1.5 font-medium">Share link <Hint>Anyone with this link can view and download the invoice. It does not expire.</Hint></p>
                <div className="flex items-center gap-2">
                  <Input readOnly value={data.public_url} onFocus={(e) => e.target.select()} className="font-mono text-xs" aria-label="Share link" />
                  <Tip content="Copy"><Button size="icon" variant="outline" aria-label="Copy share link" onClick={copy}><Copy /></Button></Tip>
                </div>
              </CardBody>
            </Card>
          </FadeIn>
        </div>
      </div>
      <PaymentDialog inv={inv} open={payOpen} onClose={() => setPayOpen(false)} onDone={refresh} />
      <SendDialog inv={inv} open={sendOpen} onClose={() => setSendOpen(false)} onDone={reload} />
    </>
  );
}
