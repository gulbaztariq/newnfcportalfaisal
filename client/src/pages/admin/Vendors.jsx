/* Vendors (printing houses, suppliers, couriers): balances, rates, stock held, bills and payments */
import { useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Factory, Plus, Pencil, Trash2, Eye, ArrowLeft, Phone, Mail, MapPin, Boxes, Tag, FileText, HandCoins, X, Printer, Truck, Package, Building2 } from 'lucide-react';
import api from '@/lib/api';
import { cn } from '@/lib/cn';
import { fmtDate, label as humanize } from '@/lib/format';
import {
  PageHeader, Card, CardHeader, CardBody, TableCard, DataTable, SearchInput, FilterSelect, Badge, EmptyState, Skeleton, Button, ButtonLink, Action, Actions, Dialog, Input, Tip,
  useForm, run, confirm,
} from '@/components/ui';
import {
  pkr, num, qty as fq, sum, ymd, useFetch, useLookup, FadeIn, Tile, TabBar, AttachmentLink, FieldControl, blankOf, rowToForm, CrudTable, TotalsRow, TotalItem, Amount,
  PAYMENT_METHODS, accountOpt, partnerOpt,
} from '@/components/BizKit';

export const VENDOR_TYPES = [{ value: 'printing', label: 'Printing' }, { value: 'supplier', label: 'Supplier' }, { value: 'courier', label: 'Courier' }, { value: 'other', label: 'Other' }];
const TYPE_ICON = { printing: Printer, supplier: Package, courier: Truck, other: Building2 };
const TYPE_TONE = { printing: 'primary', supplier: 'info', courier: 'warning', other: 'neutral' };
const TypeBadge = ({ type }) => { const I = TYPE_ICON[type] || Building2; return <Badge tone={TYPE_TONE[type] || 'neutral'}><I className="size-3" />{humanize(type)}</Badge>; };

const VENDOR_FIELDS = [
  { name: 'name', label: 'Vendor name', required: true, placeholder: 'e.g. Al-Noor Printers' },
  { name: 'type', label: 'Type', type: 'select', half: true, required: true, default: 'printing', options: VENDOR_TYPES },
  { name: 'contact_person', label: 'Contact person', half: true },
  { name: 'phone', label: 'Phone', half: true },
  { name: 'email', label: 'E-mail', type: 'email', half: true },
  { name: 'address', label: 'Address', type: 'textarea', rows: 2 },
  { name: 'opening_balance', label: 'Opening balance owed', type: 'money', half: true, default: 0, hint: 'What you already owed them before using this system' },
  { name: 'status', label: 'Active', type: 'switch', half: true },
  { name: 'notes', label: 'Notes', type: 'textarea', rows: 2 },
];

/* -------------------------------------------------------------- rates editor */
function RatesEditor({ value, onChange }) {
  const rows = value || [];
  const set = (i, p) => onChange(rows.map((r, j) => (j === i ? { ...r, ...p } : r)));
  return (
    <div className="sm:col-span-2">
      <div className="mb-1.5 flex items-center justify-between">
        <p className="text-[13px] font-medium">Rate card</p>
        <Button type="button" size="xs" variant="soft" onClick={() => onChange([...rows, { label: '', rate: '', unit: 'pc' }])}><Plus />Add rate</Button>
      </div>
      {!rows.length ? <p className="rounded-2xl border border-dashed border-border px-4 py-5 text-center text-sm text-muted-foreground">No rates yet. Add what they charge, e.g. "PVC card printing (both sides)" Rs 35 / pc.</p> : (
        <div className="space-y-2">
          {rows.map((r, i) => (
            <div key={i} className="grid grid-cols-[1fr_6.5rem_4.5rem_2rem] items-center gap-2">
              <Input value={r.label} onChange={(e) => set(i, { label: e.target.value })} placeholder="Service / item" aria-label="Rate label" />
              <Input value={r.rate} onChange={(e) => set(i, { rate: e.target.value })} type="number" min="0" step="0.01" placeholder="Rate" aria-label="Rate" />
              <Input value={r.unit} onChange={(e) => set(i, { unit: e.target.value })} placeholder="pc" aria-label="Unit" />
              <Tip content="Remove"><button type="button" aria-label="Remove rate" onClick={() => onChange(rows.filter((_, j) => j !== i))} className="grid size-8 cursor-pointer place-items-center rounded-lg text-muted-foreground hover:bg-danger-soft hover:text-danger"><X className="size-4" /></button></Tip>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function VendorDialog({ open, vendor, onClose, onSaved }) {
  const form = useForm({ ...blankOf(VENDOR_FIELDS), rates: [] });
  const [saving, setSaving] = useState(false);
  const [was, setWas] = useState(false);
  if (open !== was) {
    setWas(open);
    if (open) { form.setErrors({}); form.setValues(vendor ? { ...rowToForm(VENDOR_FIELDS, vendor), rates: (vendor.rates || []).map((r) => ({ ...r })) } : { ...blankOf(VENDOR_FIELDS), rates: [] }); }
  }
  const save = async (e) => {
    e?.preventDefault(); setSaving(true);
    const body = { ...form.values, rates: JSON.stringify((form.values.rates || []).filter((r) => String(r.label || '').trim())) };
    try { await run(vendor ? api.put(`/admin/vendors/${vendor.id}`, body) : api.post('/admin/vendors', body), vendor ? 'Vendor updated' : 'Vendor added'); onClose(); onSaved?.(); } catch (ex) { form.setErrors(ex.errors || {}); } finally { setSaving(false); }
  };
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()} size="lg" icon={Factory} title={vendor ? `Edit ${vendor.name}` : 'New vendor'}
      footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={save} loading={saving}>{vendor ? 'Save changes' : 'Create vendor'}</Button></>}>
      <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
        {VENDOR_FIELDS.map((f) => <FieldControl key={f.name} f={f} form={form} />)}
        <RatesEditor value={form.values.rates} onChange={(r) => form.set('rates', r)} />
        <button type="submit" className="hidden" />
      </form>
    </Dialog>
  );
}

/* ============================================================== list */
export function Vendors() {
  const navigate = useNavigate();
  const [type, setType] = useState('');
  const [q, setQ] = useState('');
  const { data, loading, reload } = useFetch('/admin/vendors', type ? { type } : undefined);
  const [dialog, setDialog] = useState({ open: false, vendor: null });
  const all = data?.data || [];
  const s = q.trim().toLowerCase();
  const rows = s ? all.filter((v) => [v.name, v.contact_person, v.phone, v.email].some((x) => String(x || '').toLowerCase().includes(s))) : all;
  const remove = async (v) => {
    if (!(await confirm({ title: `Delete ${v.name}?`, description: 'Their bills and payments are deleted too. Stock held at this vendor stays in the movement history.' }))) return;
    await run(api.delete(`/admin/vendors/${v.id}`)).catch(() => {}); reload();
  };
  const owed = sum(all.filter((v) => num(v.balance) > 0), 'balance');
  return (
    <>
      <PageHeader eyebrow="Vendors" title="Vendors" description="Printing houses, material suppliers and couriers you work with. Track their rates, the stock they hold for you, bills and what you still owe.">
        <Button onClick={() => setDialog({ open: true, vendor: null })}><Plus />Add vendor</Button>
      </PageHeader>
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <FadeIn><Tile label="Total billed" value={pkr(sum(all, 'billed'))} sub={`${all.length} vendor(s)`} /></FadeIn>
        <FadeIn delay={0.05}><Tile label="Total paid" value={pkr(sum(all, 'paid'))} tone="in" /></FadeIn>
        <FadeIn delay={0.1}><Tile label="You owe" value={pkr(owed)} tone={owed > 0 ? 'out' : undefined} hint="Opening balance + bills - payments, summed over vendors with a positive balance." sub={`${all.filter((v) => num(v.balance) > 0).length} vendor(s) with a balance`} /></FadeIn>
      </div>
      <TableCard title="All vendors" toolbar={<>
        <FilterSelect value={type} onChange={setType} placeholder="All types" options={VENDOR_TYPES} />
        <SearchInput value={q} onChange={setQ} placeholder="Search vendors..." />
      </>}>
        <DataTable loading={loading} rows={rows} onRowClick={(v) => navigate(`/admin/vendors/${v.id}`)}
          empty={<EmptyState icon={Factory} title={all.length ? 'No vendors match' : 'No vendors yet'} description={all.length ? undefined : 'Add your printer, suppliers and courier to track bills and payments.'} action={!all.length && <Button onClick={() => setDialog({ open: true, vendor: null })}><Plus />Add vendor</Button>} />}
          columns={[
            { key: 'name', label: 'Vendor', render: (v) => <div className="max-w-xs"><p className={cn('truncate font-medium', v.status === false && 'text-muted-foreground')}>{v.name}</p><p className="truncate text-xs text-muted-foreground">{[v.contact_person, v.phone].filter(Boolean).join(' · ') || v.email || '-'}</p></div> },
            { key: 'type', label: 'Type', render: (v) => <TypeBadge type={v.type} /> },
            { key: 'rates', label: 'Rates', render: (v) => <span className="text-muted-foreground">{(v.rates || []).length || '-'}</span> },
            { key: 'billed', label: 'Billed', className: 'text-right', render: (v) => pkr(v.billed) },
            { key: 'paid', label: 'Paid', className: 'text-right', render: (v) => <span className="text-muted-foreground">{pkr(v.paid)}</span> },
            { key: 'balance', label: 'Balance', className: 'text-right', render: (v) => (num(v.balance) > 0 ? <Amount value={v.balance} tone="out" /> : num(v.balance) < 0 ? <Tip content="You paid more than billed (advance)"><span><Amount value={-num(v.balance)} tone="in" /></span></Tip> : <span className="text-muted-foreground">Settled</span>) },
            { key: 'status', label: 'Status', render: (v) => <Badge tone={v.status === false ? 'neutral' : 'success'} dot>{v.status === false ? 'Inactive' : 'Active'}</Badge> },
            { key: '_a', label: '', className: 'text-right', render: (v) => (
              <div onClick={(e) => e.stopPropagation()}><Actions>
                <Action icon={Eye} label="Open" to={`/admin/vendors/${v.id}`} />
                <Action icon={Pencil} label="Edit" tone="info" onClick={() => setDialog({ open: true, vendor: v })} />
                <Action icon={Trash2} label="Delete" tone="danger" onClick={() => remove(v)} />
              </Actions></div>
            ) },
          ]} />
        {rows.length > 0 && <TotalsRow><TotalItem label="Billed">{pkr(sum(rows, 'billed'))}</TotalItem><TotalItem label="Paid">{pkr(sum(rows, 'paid'))}</TotalItem><TotalItem label="Balance">{pkr(sum(rows, 'balance'))}</TotalItem></TotalsRow>}
      </TableCard>
      <VendorDialog open={dialog.open} vendor={dialog.vendor} onClose={() => setDialog({ open: false, vendor: null })} onSaved={reload} />
    </>
  );
}

/* ============================================================== detail */
export function VendorDetail() {
  const { id } = useParams();
  const ov = useFetch(`/admin/vendors/${id}/overview`);
  const accounts = useLookup('/admin/finance/accounts', accountOpt);
  const partners = useLookup('/admin/finance/partners', partnerOpt);
  const [tab, setTab] = useState('bills');
  const [editOpen, setEditOpen] = useState(false);
  const bills = useRef(null);
  const pays = useRef(null);
  const d = ov.data;
  const v = d?.data;
  if (!d) {
    return (
      <>
        <Skeleton className="mb-4 h-4 w-28" />
        <Skeleton className="mb-6 h-10 w-72" />
        <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}</div>
        <Skeleton className="h-80 rounded-2xl" />
      </>
    );
  }
  const stockValue = sum(d.stock, 'value');
  const billOpts = d.bills.map((b) => ({ value: b.id, label: `${b.bill_no || `Bill #${b.id}`} · ${fmtDate(b.date)} · ${pkr(b.amount)}` }));
  const go = (t, ref) => { setTab(t); setTimeout(() => ref.current?.open(null, { date: ymd(), ...(t === 'payments' && num(d.totals.balance) > 0 ? { amount: String(d.totals.balance) } : {}) }), 60); };

  return (
    <>
      <Link to="/admin/vendors" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" />All vendors</Link>
      <PageHeader eyebrow={<span className="inline-flex items-center gap-2">Vendor <TypeBadge type={v.type} /></span>} title={v.name} description={v.notes || 'Bills, payments, rates and the stock this vendor holds for you.'}>
        <Button variant="outline" onClick={() => setEditOpen(true)}><Pencil />Edit</Button>
        <Button variant="outline" onClick={() => go('bills', bills)}><FileText />Add bill</Button>
        <Button onClick={() => go('payments', pays)}><HandCoins />Record payment</Button>
      </PageHeader>

      <FadeIn>
        <Card className="mb-6">
          <CardBody className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
            {v.contact_person && <span className="font-medium text-foreground">{v.contact_person}</span>}
            {v.phone && <a href={`tel:${v.phone}`} className="inline-flex items-center gap-1.5 hover:text-primary"><Phone className="size-4" />{v.phone}</a>}
            {v.email && <a href={`mailto:${v.email}`} className="inline-flex items-center gap-1.5 hover:text-primary"><Mail className="size-4" />{v.email}</a>}
            {v.address && <span className="inline-flex items-center gap-1.5"><MapPin className="size-4" />{v.address}</span>}
            {!v.contact_person && !v.phone && !v.email && !v.address && <span>No contact details yet.</span>}
          </CardBody>
        </Card>
      </FadeIn>

      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <FadeIn><Tile label="Billed" value={pkr(d.totals.billed)} sub={`${d.bills.length} bill(s)${num(v.opening_balance) ? ` + opening ${pkr(v.opening_balance)}` : ''}`} /></FadeIn>
        <FadeIn delay={0.05}><Tile label="Paid" value={pkr(d.totals.paid)} tone="in" sub={`${d.payments.length} payment(s)`} /></FadeIn>
        <FadeIn delay={0.1}><Tile label={num(d.totals.balance) < 0 ? 'Advance paid' : 'Balance due'} value={pkr(Math.abs(num(d.totals.balance)))} tone={num(d.totals.balance) > 0 ? 'out' : 'in'} hint="Opening balance + all bills - all payments." /></FadeIn>
        <FadeIn delay={0.15}><Tile label="Stock held here" value={pkr(stockValue)} sub={`${fq(sum(d.stock, 'qty'))} units of ${d.stock.length} item(s)`} hint="Your inventory currently at this vendor, at average cost." /></FadeIn>
      </div>

      <TabBar id="vendor-tabs" value={tab} onChange={setTab} options={[
        { value: 'bills', label: `Bills (${d.bills.length})`, icon: FileText }, { value: 'payments', label: `Payments (${d.payments.length})`, icon: HandCoins },
        { value: 'stock', label: `Stock (${d.stock.length})`, icon: Boxes }, { value: 'rates', label: `Rates (${(v.rates || []).length})`, icon: Tag },
      ]} />

      <FadeIn key={tab}>
        {tab === 'stock' && (
          <Card className="overflow-hidden">
            <CardHeader icon={Boxes} title="Stock held at this vendor" description="Move stock here or back to the main store from Inventory > Transfer" actions={<ButtonLink as={Link} to="/admin/inventory" size="sm" variant="outline">Open inventory</ButtonLink>} />
            <DataTable rows={d.stock} empty={<EmptyState icon={Boxes} title="No stock at this vendor" description="Transfer blank cards or chips here when you send them for printing." />}
              columns={[
                { key: 'name', label: 'Item', render: (s) => <span className="font-medium">{s.name}</span> },
                { key: 'qty', label: 'Quantity', className: 'text-right', render: (s) => <span className={cn('font-semibold tabular-nums', s.qty < 0 && 'text-danger')}>{fq(s.qty)} <span className="text-xs font-normal text-muted-foreground">{s.unit}</span></span> },
                { key: 'value', label: 'Value', className: 'text-right', render: (s) => pkr(s.value) },
              ]} />
            {d.stock.length > 0 && <TotalsRow><TotalItem label="Units">{fq(sum(d.stock, 'qty'))}</TotalItem><TotalItem label="Value">{pkr(stockValue)}</TotalItem></TotalsRow>}
          </Card>
        )}
        {tab === 'rates' && (
          <Card className="overflow-hidden">
            <CardHeader icon={Tag} title="Rate card" description="What this vendor charges" actions={<Button size="sm" variant="outline" onClick={() => setEditOpen(true)}><Pencil />Edit rates</Button>} />
            <DataTable rows={(v.rates || []).map((r, i) => ({ ...r, id: i }))} empty={<EmptyState icon={Tag} title="No rates saved" action={<Button size="sm" onClick={() => setEditOpen(true)}><Plus />Add rates</Button>} />}
              columns={[
                { key: 'label', label: 'Service / item', render: (r) => <span className="font-medium">{r.label}</span> },
                { key: 'rate', label: 'Rate', className: 'text-right', render: (r) => <b>{pkr(r.rate)}</b> },
                { key: 'unit', label: 'Per', render: (r) => <span className="text-muted-foreground">{r.unit || 'pc'}</span> },
              ]} />
          </Card>
        )}
        {tab === 'bills' && (
          <CrudTable ref={bills} endpoint="/admin/vendor-bills" fixed={{ vendor_id: Number(id) }} title="Bills" singular="Bill" icon={FileText} search={false} size="lg" onChanged={ov.reload}
            defaults={{ date: ymd(), category: 'printing' }}
            filters={[{ name: 'category', label: 'All categories', options: [{ value: 'printing', label: 'Printing' }, { value: 'other', label: 'Other' }] }]}
            emptyDescription="Add the vendor's bills with a photo or PDF so the balance stays correct."
            columns={[
              { key: 'date', label: 'Date', render: (b) => fmtDate(b.date) },
              { key: 'bill_no', label: 'Bill no.', render: (b) => <div className="max-w-xs"><p className="font-medium">{b.bill_no || `#${b.id}`}</p>{b.description && <p className="truncate text-xs text-muted-foreground">{b.description}</p>}</div> },
              { key: 'category', label: 'Category', render: (b) => (b.category === 'other' ? <Tip content="Counted as an operating expense"><span><Badge tone="warning">Other expense</Badge></span></Tip> : <Tip content="Already inside product cost (COGS), not counted again as an expense"><span><Badge tone="primary">Printing</Badge></span></Tip>) },
              { key: 'due_date', label: 'Due', render: (b) => (b.due_date ? fmtDate(b.due_date) : <span className="text-muted-foreground">-</span>) },
              { key: 'amount', label: 'Amount', className: 'text-right', render: (b) => <b className="tabular-nums">{pkr(b.amount)}</b> },
              { key: 'attachment', label: 'Bill', className: 'text-center', render: (b) => <AttachmentLink url={b.attachment} /> },
            ]}
            footer={(list) => <TotalsRow><TotalItem label="This page">{pkr(sum(list.rows, 'amount'))}</TotalItem></TotalsRow>}
            fields={[
              { name: 'bill_no', label: 'Bill no.', half: true },
              { name: 'amount', label: 'Amount', type: 'money', required: true, half: true },
              { name: 'date', label: 'Bill date', type: 'date', required: true, half: true },
              { name: 'due_date', label: 'Due date', type: 'date', half: true },
              { name: 'category', label: 'Category', type: 'select', required: true, options: [{ value: 'printing', label: 'Printing / production (already in product cost)' }, { value: 'other', label: 'Other (operating expense)' }], hint: (x) => (x.category === 'other' ? 'Counted as an expense in the profit report.' : 'Not counted as an expense: the product cost (COGS) already includes printing.') },
              { name: 'description', label: 'Description', type: 'textarea', rows: 2, placeholder: 'e.g. 500 cards printed, batch #14' },
              { name: 'attachment', label: 'Bill copy', type: 'file', placeholder: 'Upload bill photo or PDF' },
            ]} />
        )}
        {tab === 'payments' && (
          <CrudTable ref={pays} endpoint="/admin/vendor-payments" fixed={{ vendor_id: Number(id) }} title="Payments" singular="Payment" icon={HandCoins} search={false} size="lg" onChanged={ov.reload}
            defaults={{ date: ymd() }} fieldOptions={{ account_id: accounts, partner_id: partners, vendor_bill_id: billOpts }}
            filters={partners.length ? [{ name: 'partner_id', label: 'All partners', options: partners }] : []}
            emptyDescription="Record what you paid this vendor and who paid it."
            columns={[
              { key: 'date', label: 'Date', render: (p) => fmtDate(p.date) },
              { key: 'amount', label: 'Amount', className: 'text-right', render: (p) => <Amount value={p.amount} tone="out" /> },
              { key: 'method', label: 'Method', render: (p) => <div><p>{p.method || '-'}</p>{p.reference && <p className="text-xs text-muted-foreground">{p.reference}</p>}</div> },
              { key: 'account', label: 'From account', render: (p) => p.account?.name || <span className="text-muted-foreground">-</span> },
              { key: 'partner', label: 'Paid by', render: (p) => p.partner?.name || <span className="text-muted-foreground">Company</span> },
              { key: 'attachment', label: 'Receipt', className: 'text-center', render: (p) => <AttachmentLink url={p.attachment} /> },
            ]}
            footer={(list) => <TotalsRow><TotalItem label="This page">{pkr(sum(list.rows, 'amount'))}</TotalItem></TotalsRow>}
            fields={[
              { name: 'amount', label: 'Amount', type: 'money', required: true, half: true, hint: num(d.totals.balance) > 0 ? `Balance due ${pkr(d.totals.balance)}` : undefined },
              { name: 'date', label: 'Date', type: 'date', required: true, half: true },
              { name: 'method', label: 'Method', type: 'select', half: true, options: PAYMENT_METHODS, placeholder: 'Not set' },
              { name: 'reference', label: 'Reference', half: true, placeholder: 'Cheque / transaction no.' },
              { name: 'account_id', label: 'Paid from account', type: 'select', half: true, placeholder: 'No account' },
              { name: 'partner_id', label: 'Paid by (partner)', type: 'select', half: true, placeholder: 'Company account' },
              { name: 'vendor_bill_id', label: 'Against bill', type: 'select', placeholder: 'Not linked to a bill' },
              { name: 'note', label: 'Note', type: 'textarea', rows: 2 },
              { name: 'attachment', label: 'Payment receipt', type: 'file', placeholder: 'Upload transfer screenshot or receipt' },
            ]} />
        )}
      </FadeIn>
      <VendorDialog open={editOpen} vendor={v} onClose={() => setEditOpen(false)} onSaved={ov.reload} />
    </>
  );
}
