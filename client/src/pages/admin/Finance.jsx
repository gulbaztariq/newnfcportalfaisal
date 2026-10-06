/* Finance: profit analytics, unified ledger, expenses / income, accounts & partners, courier COD settlements */
import { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  TrendingUp, Wallet, PiggyBank, Package, Truck, Receipt, Landmark, ShoppingBag, RefreshCw, Download, BookOpen, Users, Tags, Plus, Pencil, Trash2,
  HandCoins, FileClock, Boxes, Building2, Banknote, ArrowDownLeft, ArrowUpRight, CircleDollarSign, Percent, ClipboardList,
} from 'lucide-react';
import api from '@/lib/api';
import ExportMenu from '@/components/ExportMenu';
import { cn } from '@/lib/cn';
import { fmtDate, label as humanize } from '@/lib/format';
import {
  PageHeader, StatCard, Card, CardHeader, CardBody, DataTable, TableCard, SearchInput, FilterSelect, Segmented, Badge, EmptyState, Skeleton, Button, ButtonLink,
  Action, Actions, Dialog, Tip, Reveal, useForm, run, confirm,
} from '@/components/ui';
import { CHART_COLORS } from '@/components/ui/charts';
import {
  pkr, num, sum, ymd, monthLabel, monthKey, useDateRange, RangePicker, useFetch, useLookup, useClientPage, ClientPager, downloadCsv, Hint, LabelHint, FadeIn, TabBar,
  Meter, Tile, ScrollX, AttachmentLink, MoneyChart, ChartLegend, MoneyDonut, FieldControl, blankOf, rowToForm, payloadOf, CrudTable, TotalsRow, TotalItem, Amount,
  PAYMENT_METHODS, accountOpt, partnerOpt, vendorOpt,
} from '@/components/BizKit';

const HOW = {
  revenue: 'Paid subscriptions (excl. tax) + orders that are delivered or paid (excl. tax) + manual income + payments on standalone invoices.',
  cogs: 'Cost snapshot of each order: inventory materials at weighted average landed cost + printing / extra cost. Estimated from current costs until the order is dispatched.',
  gross: 'Revenue - cost of goods sold.',
  net: 'Revenue - COGS - courier charges - expenses.',
  courier: 'Courier charges of dispatched orders (from Leopards or entered on the order).',
  expenses: 'Manual expenses + vendor bills marked "Other". Printing bills are excluded because they are already inside product cost (COGS).',
  tax: 'Tax collected on subscriptions and orders. Not part of revenue.',
  orders: 'Orders counted as revenue in this period and the units sold.',
};

/* ================================================================ overview */
function OverviewSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-2xl" />)}</div>
      <div className="grid gap-6 xl:grid-cols-3"><Skeleton className="h-96 rounded-2xl xl:col-span-2" /><Skeleton className="h-96 rounded-2xl" /></div>
      <Skeleton className="h-72 rounded-2xl" />
    </div>
  );
}

const TREND_SERIES = [
  { key: 'revenue', name: 'Revenue', color: 'var(--primary)' },
  { key: 'cogs', name: 'COGS', color: CHART_COLORS[3], stack: 'c' },
  { key: 'courier', name: 'Courier', color: CHART_COLORS[4], stack: 'c' },
  { key: 'expenses', name: 'Expenses', color: CHART_COLORS[1], stack: 'c' },
  { key: 'profit', name: 'Net profit', color: 'var(--success)', type: 'line' },
];

export function FinanceOverview() {
  const range = useDateRange('12m');
  const { data: d, loading, reload } = useFetch('/admin/finance/report', { from: range.from, to: range.to });
  const s = d?.summary;
  const trend = useMemo(() => (d?.series || []).map((x) => ({ ...x, label: monthLabel(x.month) })), [d]);
  const payables = (d?.vendors || []).filter((v) => num(v.balance) > 0);
  const f = (v) => pkr(Math.round(v));

  return (
    <>
      <PageHeader eyebrow="Finance" title="Profit & finance overview" description="Live profit analytics computed from subscriptions, orders, inventory costs, courier charges, expenses and vendor bills. Hover the info icons to see how each figure is worked out.">
        <RangePicker range={range} id="fin-range" />
        <ExportMenu what={`report/export?from=${range.from}&to=${range.to}`} base="/api/admin/finance" label="P&L" />
        <ExportMenu what={`report/export?what=products&from=${range.from}&to=${range.to}`} base="/api/admin/finance" label="Products" />
        <Tip content="Refresh"><Button variant="outline" size="icon-sm" aria-label="Refresh" onClick={reload}><RefreshCw className={cn(loading && 'animate-spin')} /></Button></Tip>
      </PageHeader>
      {!d ? <OverviewSkeleton /> : (
        <div className={cn('space-y-6 transition-opacity', loading && 'opacity-60')}>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard index={0} icon={TrendingUp} color="violet" label={<LabelHint label="Revenue" hint={HOW.revenue} />} value={s.revenue} format={f} hint={`${pkr(s.order_revenue)} orders · ${pkr(s.subscription_revenue)} plans`} />
            <StatCard index={1} icon={PiggyBank} color="sky" label={<LabelHint label="Gross profit" hint={HOW.gross} />} value={s.gross_profit} format={f} hint={s.revenue ? `${Math.round((s.gross_profit / s.revenue) * 100)}% gross margin` : 'No revenue yet'} />
            <StatCard index={2} icon={Wallet} color={s.net_profit < 0 ? 'rose' : 'emerald'} label={<LabelHint label="Net profit" hint={HOW.net} />} value={s.net_profit} format={f} hint={`${num(s.margin).toFixed(1)}% net margin`} />
            <StatCard index={3} icon={Package} color="amber" label={<LabelHint label="Cost of goods" hint={HOW.cogs} />} value={s.cogs} format={f} hint="Materials + printing" />
            <StatCard index={4} icon={Truck} color="pink" label={<LabelHint label="Courier charges" hint={HOW.courier} />} value={s.courier} format={f} hint={`${pkr(s.cash_in_settlements)} received in COD settlements`} />
            <StatCard index={5} icon={Receipt} color="rose" label={<LabelHint label="Expenses" hint={HOW.expenses} />} value={s.expenses} format={f} to="/admin/finance/expenses" hint="Manual + other vendor bills" />
            <StatCard index={6} icon={Landmark} color="sky" label={<LabelHint label="Tax collected" hint={HOW.tax} />} value={s.tax_collected} format={f} hint={`${pkr(s.delivery_collected)} delivery collected`} />
            <StatCard index={7} icon={ShoppingBag} color="violet" label={<LabelHint label="Orders" hint={HOW.orders} />} value={s.orders} hint={`${Number(s.units).toLocaleString()} units sold`} />
          </div>

          <div className="grid gap-6 xl:grid-cols-3">
            <Reveal className="min-w-0 xl:col-span-2">
              <Card className="h-full">
                <CardHeader icon={TrendingUp} title="Revenue vs costs vs profit" description={`Monthly, ${fmtDate(d.range.from)} - ${fmtDate(d.range.to)}`}
                  actions={<div className="text-right"><p className="text-xs text-muted-foreground">Net profit</p><p className={cn('font-display text-2xl font-bold', s.net_profit < 0 ? 'text-danger' : 'text-success')}>{pkr(s.net_profit)}</p></div>} />
                <CardBody>
                  {trend.some((x) => x.revenue || x.cogs || x.expenses || x.courier) ? <><MoneyChart data={trend} series={TREND_SERIES} height={300} /><ChartLegend series={TREND_SERIES} /></> : <EmptyState icon={TrendingUp} title="No activity in this period" description="Revenue and costs appear here as orders, payments and expenses come in." />}
                </CardBody>
              </Card>
            </Reveal>
            <Reveal delay={0.08} className="min-w-0">
              <Card className="h-full">
                <CardHeader icon={Receipt} title="Expense categories" description="Where the money went" />
                <CardBody>{d.expense_categories.length ? <MoneyDonut data={d.expense_categories} center="expenses" /> : <EmptyState icon={Receipt} title="No expenses recorded" action={<ButtonLink as={Link} to="/admin/finance/expenses" size="sm"><Plus />Add expense</ButtonLink>} />}</CardBody>
              </Card>
            </Reveal>
          </div>

          <Reveal>
            <Card>
              <CardHeader icon={CircleDollarSign} title="Revenue breakdown" description="What makes up the revenue figure" />
              <CardBody className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <Tile label="Subscriptions" value={pkr(s.subscription_revenue)} sub="Paid plan payments, excl. tax" />
                <Tile label="Shop / portal orders" value={pkr(s.order_revenue)} sub="Delivered or paid, excl. tax" />
                <Tile label="Other income" value={pkr(s.other_income)} sub="Manual income + invoice payments" />
                <Tile label="Delivery charged" value={pkr(s.delivery_collected)} sub="Included in order revenue" />
              </CardBody>
            </Card>
          </Reveal>

          <Reveal>
            <Card className="overflow-hidden">
              <CardHeader icon={Package} title="Product profitability" description="Units sold, revenue and cost per product (best first)" />
              <DataTable rows={d.products} rowKey="name" empty={<EmptyState icon={Package} title="No product sales in this period" />}
                columns={[
                  { key: 'name', label: 'Product', render: (p) => <span className="font-medium">{p.name}</span> },
                  { key: 'units', label: 'Units', className: 'text-right', render: (p) => Number(p.units).toLocaleString() },
                  { key: 'revenue', label: 'Revenue', className: 'text-right', render: (p) => pkr(p.revenue) },
                  { key: 'cost', label: 'Cost', className: 'text-right', render: (p) => <span className="text-muted-foreground">{pkr(p.cost)}</span> },
                  { key: 'profit', label: 'Profit', className: 'text-right', render: (p) => <Amount value={p.profit} /> },
                  { key: 'margin', label: 'Margin', className: 'w-44', render: (p) => { const m = p.revenue ? (p.profit / p.revenue) * 100 : 0; return <div className="flex items-center gap-2"><Meter value={m} /><span className="w-11 text-right text-xs font-medium tabular-nums">{m.toFixed(0)}%</span></div>; } },
                ]} />
            </Card>
          </Reveal>

          <div className="grid gap-6 xl:grid-cols-2">
            <Reveal className="min-w-0">
              <Card className="h-full overflow-hidden">
                <CardHeader icon={Users} title="Partner-wise spend" description="Who paid for expenses, vendors and stock in this period" />
                <DataTable rows={d.partners} rowKey="name" empty={<EmptyState icon={Users} title="No partner spending yet" />}
                  columns={[
                    { key: 'name', label: 'Paid by', render: (p) => <span className="font-medium">{p.name}</span> },
                    { key: 'expenses', label: 'Expenses', className: 'text-right', render: (p) => pkr(p.expenses) },
                    { key: 'vendor_payments', label: 'Vendors', className: 'text-right', render: (p) => pkr(p.vendor_payments) },
                    { key: 'purchases', label: 'Stock', className: 'text-right', render: (p) => pkr(p.purchases) },
                    { key: 'total', label: 'Total', className: 'text-right', render: (p) => <b>{pkr(p.total)}</b> },
                  ]} />
              </Card>
            </Reveal>
            <Reveal delay={0.06} className="min-w-0">
              <Card className="h-full">
                <CardHeader icon={Banknote} title="Account balances" description="All-time: opening + income + settlements - paid expenses - vendor payments - purchases"
                  actions={<ButtonLink as={Link} to="/admin/finance/setup" size="sm" variant="outline">Manage</ButtonLink>} />
                <CardBody>
                  {!d.accounts.length ? <EmptyState icon={Banknote} title="No accounts yet" description="Add your cash, bank and wallet accounts to track balances." /> : (
                    <ul className="grid gap-3 sm:grid-cols-2">
                      {d.accounts.map((a, i) => (
                        <FadeIn key={a.id} delay={i * 0.04}>
                          <li className="flex items-center gap-3 rounded-2xl border border-border p-4">
                            <span className="grid size-10 place-items-center rounded-xl bg-primary-soft text-primary">{a.type === 'bank' ? <Landmark className="size-4.5" /> : <Wallet className="size-4.5" />}</span>
                            <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{a.name}</p><p className="text-xs text-muted-foreground capitalize">{a.type}</p></div>
                            <Amount value={a.balance} />
                          </li>
                        </FadeIn>
                      ))}
                    </ul>
                  )}
                </CardBody>
              </Card>
            </Reveal>
          </div>

          <Reveal>
            <Card>
              <CardHeader icon={ClipboardList} title="Position today" description="Money owed to you, money you owe and stock on hand (all-time, not limited to the date range)" />
              <CardBody className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <Link to="/admin/invoices" className="block transition hover:-translate-y-0.5"><Tile label="Receivables" hint="Unpaid balance of sent, partially paid and overdue invoices." value={pkr(d.receivables.amount)} tone="in" sub={`${d.receivables.count} unpaid invoice(s) · ${d.receivables.overdue} overdue`} /></Link>
                <Link to="/admin/finance/settlements" className="block transition hover:-translate-y-0.5"><Tile label="COD outstanding" hint="Cash-on-delivery orders shipped or delivered that Leopards has not settled yet." value={pkr(d.cod_outstanding.amount)} tone="warn" sub={`${d.cod_outstanding.count} shipment(s) · ${d.cod_outstanding.delivered} delivered`} /></Link>
                <Link to="/admin/vendors" className="block transition hover:-translate-y-0.5"><Tile label="Vendor payables" hint="Opening balance + bills - payments, per vendor with money owed." value={pkr(sum(payables, 'balance'))} tone="out" sub={`${payables.length} vendor(s) to pay`} /></Link>
                <Link to="/admin/inventory" className="block transition hover:-translate-y-0.5"><Tile label="Inventory value" hint="Stock on hand x weighted average landed cost. Retail uses the sale price." value={pkr(d.inventory_value.cost)} sub={`${Number(d.inventory_value.units).toLocaleString()} units · retail ${pkr(d.inventory_value.retail)}`} /></Link>
              </CardBody>
              {payables.length > 0 && (
                <div className="border-t border-border">
                  <DataTable rows={payables.slice(0, 6)} columns={[
                    { key: 'name', label: 'Vendor', render: (v) => <Link to={`/admin/vendors/${v.id}`} className="font-medium hover:text-primary">{v.name}</Link> },
                    { key: 'type', label: 'Type', render: (v) => <Badge tone="outline">{humanize(v.type)}</Badge> },
                    { key: 'billed', label: 'Billed', className: 'text-right', render: (v) => pkr(v.billed) },
                    { key: 'paid', label: 'Paid', className: 'text-right', render: (v) => pkr(v.paid) },
                    { key: 'balance', label: 'Balance due', className: 'text-right', render: (v) => <Amount value={v.balance} tone="out" /> },
                  ]} />
                </div>
              )}
            </Card>
          </Reveal>
        </div>
      )}
    </>
  );
}

/* ================================================================== ledger */
const KIND = { income: { tone: 'success', label: 'Income' }, expense: { tone: 'danger', label: 'Expense' }, bill: { tone: 'warning', label: 'Bill' }, purchase: { tone: 'info', label: 'Purchase' } };
const KindBadge = ({ kind }) => <Badge tone={KIND[kind]?.tone || 'neutral'} dot>{KIND[kind]?.label || humanize(kind)}</Badge>;
const flow = (r) => (r.kind === 'income' ? 'in' : r.kind === 'bill' ? 'warn' : 'out');

export function Ledger() {
  const range = useDateRange('month');
  const { data, loading, reload } = useFetch('/admin/finance/ledger', { from: range.from, to: range.to });
  const [kind, setKind] = useState('');
  const [source, setSource] = useState('');
  const [q, setQ] = useState('');
  const all = data?.data || [];
  const sources = [...new Set(all.map((r) => r.source))].sort().map((x) => ({ value: x, label: x }));
  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return all.filter((r) => (!kind || r.kind === kind) && (!source || r.source === source)
      && (!s || [r.title, r.category, r.party, r.account, r.source].some((x) => String(x || '').toLowerCase().includes(s))));
  }, [all, kind, source, q]);
  const pager = useClientPage(rows, 25);
  const counted = rows.filter((r) => !r.info);
  const tIn = sum(counted.filter((r) => r.kind === 'income'), 'amount');
  const tOut = sum(counted.filter((r) => r.kind === 'expense' || r.kind === 'purchase'), 'amount');
  const tBills = sum(rows.filter((r) => r.kind === 'bill'), 'amount');
  const exportCsv = () => downloadCsv(`ledger-${range.from}-to-${range.to}.csv`, [
    { key: 'date', label: 'Date' }, { key: 'kind', label: 'Kind' }, { key: 'source', label: 'Source' }, { key: 'title', label: 'Title' }, { key: 'category', label: 'Category' },
    { key: 'party', label: 'Party' }, { key: 'account', label: 'Account' }, { label: 'Money in', value: (r) => (r.kind === 'income' ? num(r.amount).toFixed(2) : '') },
    { label: 'Money out', value: (r) => (r.kind === 'expense' || r.kind === 'purchase' ? num(r.amount).toFixed(2) : '') }, { label: 'Bill', value: (r) => (r.kind === 'bill' ? num(r.amount).toFixed(2) : '') },
    { key: 'attachment', label: 'Receipt' },
  ], rows);

  return (
    <>
      <PageHeader eyebrow="Finance" title="Ledger" description="Every rupee in and out in one place: orders, subscriptions, invoice payments, manual income and expenses, vendor bills and payments, stock purchases and COD settlements.">
        <RangePicker range={range} id="led-range" />
        <Button variant="outline" size="sm" onClick={exportCsv} disabled={!rows.length}><Download />Export CSV</Button>
        <ExportMenu what={`ledger/export?from=${range.from}&to=${range.to}`} base="/api/admin/finance" label="Excel / PDF" />
      </PageHeader>
      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <FadeIn><Tile label="Money in" value={pkr(tIn)} tone="in" sub={`${counted.filter((r) => r.kind === 'income').length} entries`} hint="Income rows, excluding COD settlements (the order is already counted as income)." /></FadeIn>
        <FadeIn delay={0.05}><Tile label="Money out" value={pkr(tOut)} tone="out" sub="Expenses, courier, vendor payments, stock" /></FadeIn>
        <FadeIn delay={0.1}><Tile label="Net cash flow" value={pkr(tIn - tOut)} tone={tIn - tOut < 0 ? 'out' : 'in'} sub="Money in - money out" /></FadeIn>
        <FadeIn delay={0.15}><Tile label="Vendor bills" value={pkr(tBills)} tone="warn" sub="Payables raised (not cash)" hint="Bills are what vendors charged you; the matching vendor payments are the cash out." /></FadeIn>
      </div>
      <TableCard title="Transactions" description={`${fmtDate(range.from)} - ${fmtDate(range.to)}`} toolbar={<>
        <ScrollX><Segmented id="led-kind" size="sm" value={kind} onChange={setKind} options={[{ value: '', label: 'All' }, { value: 'income', label: 'In' }, { value: 'expense', label: 'Out' }, { value: 'bill', label: 'Bills' }, { value: 'purchase', label: 'Stock' }]} /></ScrollX>
        <FilterSelect value={source} onChange={setSource} placeholder="All sources" options={sources} />
        <SearchInput value={q} onChange={setQ} placeholder="Search title, party..." />
        <Tip content="Refresh"><Button variant="ghost" size="icon-sm" aria-label="Refresh" onClick={reload}><RefreshCw className={cn(loading && 'animate-spin')} /></Button></Tip>
      </>}>
        <DataTable loading={loading && !data} rows={pager.rows} empty={<EmptyState icon={BookOpen} title="Nothing in this period" description="Try a wider date range or clear the filters." />}
          columns={[
            { key: 'date', label: 'Date', render: (r) => <span className="text-muted-foreground">{fmtDate(r.date)}</span> },
            { key: 'kind', label: 'Kind', render: (r) => <KindBadge kind={r.kind} /> },
            { key: 'source', label: 'Source', render: (r) => <span className="text-xs text-muted-foreground">{r.source}</span> },
            { key: 'title', label: 'Title', render: (r) => (
              <div className="max-w-xs">
                <p className="truncate font-medium">{r.title}</p>
                {r.info && <p className="text-xs text-muted-foreground">Cash received for orders already counted, excluded from totals</p>}
              </div>
            ) },
            { key: 'category', label: 'Category', render: (r) => r.category ? <Badge tone="outline">{r.category}</Badge> : '-' },
            { key: 'party', label: 'Party', render: (r) => r.party || <span className="text-muted-foreground">-</span> },
            { key: 'account', label: 'Account', render: (r) => r.account || <span className="text-muted-foreground">-</span> },
            { key: 'amount', label: 'Amount', className: 'text-right', render: (r) => <Amount value={r.amount} tone={flow(r)} sign className={cn(r.info && 'opacity-60')} /> },
            { key: 'attachment', label: 'Receipt', className: 'text-center', render: (r) => <AttachmentLink url={r.attachment} size={30} /> },
          ]} />
        {rows.length > 0 && (
          <TotalsRow>
            <TotalItem label="In"><span className="text-success">{pkr(tIn)}</span></TotalItem>
            <TotalItem label="Out"><span className="text-danger">{pkr(tOut)}</span></TotalItem>
            <TotalItem label="Bills"><span className="text-warning">{pkr(tBills)}</span></TotalItem>
            <TotalItem label="Net">{pkr(tIn - tOut)}</TotalItem>
          </TotalsRow>
        )}
        <ClientPager pager={pager} />
      </TableCard>
    </>
  );
}

/* ================================================================ expenses */
const entryFields = (type, cats) => [
  { name: 'title', label: 'Title', required: true, placeholder: type === 'expense' ? 'e.g. Facebook ads, office rent' : 'e.g. Design service' },
  { name: 'date', label: 'Date', type: 'date', required: true, half: true },
  { name: 'amount', label: 'Amount', type: 'money', required: true, half: true },
  { name: 'category', label: 'Category', type: 'select', half: true, options: cats, placeholder: cats.length ? 'Select category' : 'No categories yet' },
  { name: 'status', label: 'Status', type: 'select', half: true, required: true, options: [{ value: 'paid', label: type === 'expense' ? 'Paid' : 'Received' }, { value: 'unpaid', label: type === 'expense' ? 'Unpaid (payable)' : 'Not received yet' }] },
  { name: 'partner_id', label: type === 'expense' ? 'Paid by (partner)' : 'Received by (partner)', type: 'select', half: true, placeholder: 'Company account' },
  { name: 'account_id', label: 'Account', type: 'select', half: true, placeholder: 'No account' },
  { name: 'vendor_id', label: 'Vendor', type: 'select', half: true, placeholder: 'No vendor' },
  { name: 'payment_method', label: 'Payment method', type: 'select', half: true, options: PAYMENT_METHODS, placeholder: 'Not set' },
  { name: 'reference', label: 'Reference', placeholder: 'Receipt / transaction no.' },
  { name: 'description', label: 'Description', type: 'textarea', rows: 2 },
  { name: 'attachment', label: 'Receipt / bill', type: 'file', placeholder: 'Upload bill screenshot or PDF' },
];

function monthsBack(n = 12) {
  const now = new Date();
  return Array.from({ length: n }, (_, i) => { const d = new Date(now.getFullYear(), now.getMonth() - i, 1); return ymd(d).slice(0, 7); });
}

export function Expenses() {
  const [type, setType] = useState('expense');
  const [flt, setFlt] = useState({ partner_id: '', account_id: '', category: '', status: '', search: '' });
  const [month, setMonth] = useState('');
  const params = { all: 1, type, ...Object.fromEntries(Object.entries(flt).filter(([, v]) => v)) };
  const { data, loading, reload } = useFetch('/admin/finance/entries', params);
  const partners = useLookup('/admin/finance/partners', partnerOpt);
  const accounts = useLookup('/admin/finance/accounts', accountOpt);
  const vendors = useLookup('/admin/vendors', vendorOpt);
  const cats = useLookup('/admin/finance/categories', (c) => ({ value: c.name, label: c.name }), { type });
  const all = data?.data || [];
  const rows = month ? all.filter((r) => monthKey(r.date) === month) : all;
  const pager = useClientPage(rows, 20);
  const [selected, setSelected] = useState([]);
  const fields = entryFields(type, cats);
  const form = useForm(blankOf(fields));
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const isExp = type === 'expense';
  const noun = isExp ? 'expense' : 'income';
  const setF = (p) => setFlt((x) => ({ ...x, ...p }));

  const openForm = (row) => {
    setEditing(row || null); form.setErrors({});
    form.setValues(row ? rowToForm(fields, row) : { ...blankOf(fields), date: ymd(), status: 'paid' });
    setOpen(true);
  };
  const save = async (e) => {
    e?.preventDefault(); setSaving(true);
    const body = payloadOf(fields, form.values, { type });
    try { await run(editing ? api.put(`/admin/finance/entries/${editing.id}`, body) : api.post('/admin/finance/entries', body), editing ? `${humanize(noun)} updated` : `${humanize(noun)} added`); setOpen(false); reload(); } catch (ex) { form.setErrors(ex.errors || {}); } finally { setSaving(false); }
  };
  const remove = async (row) => { if (await confirm({ title: `Delete "${row.title}"?` })) { await run(api.delete(`/admin/finance/entries/${row.id}`)).catch(() => {}); reload(); } };
  const removeMany = async () => {
    if (!(await confirm({ title: `Delete ${selected.length} ${noun} entries?` }))) return;
    await run(api.post('/admin/finance/entries/bulk-delete', { ids: selected })).catch(() => {});
    setSelected([]); reload();
  };
  const total = sum(rows, 'amount');
  const paid = sum(rows.filter((r) => r.status !== 'unpaid'), 'amount');

  return (
    <>
      <PageHeader eyebrow="Finance" title={isExp ? 'Expenses' : 'Other income'} description={isExp ? 'Record business expenses with the bill or receipt, who paid it and from which account. Expenses reduce net profit.' : 'Income outside orders and subscriptions (services, commissions, refunds received). Added to revenue.'}>
        <Segmented id="exp-type" value={type} onChange={(t) => { setType(t); setSelected([]); setF({ category: '' }); }} options={[{ value: 'expense', label: 'Expenses', icon: ArrowUpRight }, { value: 'income', label: 'Income', icon: ArrowDownLeft }]} />
        <Button onClick={() => openForm()}><Plus />Add {noun}</Button>
      </PageHeader>

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <FadeIn><Tile label={`Total ${noun}`} value={pkr(total)} tone={isExp ? 'out' : 'in'} sub={`${rows.length} entr${rows.length === 1 ? 'y' : 'ies'}${month ? ` in ${monthLabel(month)}` : ''}`} /></FadeIn>
        <FadeIn delay={0.05}><Tile label={isExp ? 'Paid' : 'Received'} value={pkr(paid)} sub="Deducted from / added to accounts" /></FadeIn>
        <FadeIn delay={0.1}><Tile label={isExp ? 'Unpaid (payable)' : 'Not received'} value={pkr(total - paid)} tone="warn" sub="Still to settle" /></FadeIn>
      </div>

      <TableCard title={isExp ? 'Expense entries' : 'Income entries'} toolbar={<>
        {selected.length > 0 && <Button size="sm" variant="danger-soft" onClick={removeMany}><Trash2 />Delete {selected.length}</Button>}
        <FilterSelect value={month} onChange={setMonth} placeholder="All months" options={monthsBack(12).map((m) => ({ value: m, label: monthLabel(m) }))} />
        <FilterSelect value={flt.category} onChange={(v) => setF({ category: v })} placeholder="All categories" options={cats} />
        <FilterSelect value={flt.partner_id} onChange={(v) => setF({ partner_id: v })} placeholder="All partners" options={partners} />
        <FilterSelect value={flt.account_id} onChange={(v) => setF({ account_id: v })} placeholder="All accounts" options={accounts} />
        <FilterSelect value={flt.status} onChange={(v) => setF({ status: v })} placeholder="Any status" options={[{ value: 'paid', label: isExp ? 'Paid' : 'Received' }, { value: 'unpaid', label: isExp ? 'Unpaid' : 'Not received' }]} />
        <SearchInput value={flt.search} onChange={(v) => setF({ search: v })} placeholder="Search title, reference..." />
      </>}>
        <DataTable loading={loading} rows={pager.rows} selected={selected} onSelect={setSelected}
          empty={<EmptyState icon={Receipt} title={`No ${noun} entries`} description={all.length ? 'Nothing matches these filters.' : `Add your first ${noun} with its receipt.`} action={<Button onClick={() => openForm()}><Plus />Add {noun}</Button>} />}
          columns={[
            { key: 'date', label: 'Date', render: (r) => <span className="text-muted-foreground">{fmtDate(r.date)}</span> },
            { key: 'title', label: 'Title', render: (r) => <div className="max-w-xs"><p className="truncate font-medium">{r.title}</p>{r.category && <p className="text-xs text-muted-foreground">{r.category}</p>}</div> },
            { key: 'amount', label: 'Amount', className: 'text-right', render: (r) => <Amount value={r.amount} tone={isExp ? 'out' : 'in'} /> },
            { key: 'partner', label: isExp ? 'Paid by' : 'Received by', render: (r) => r.partner?.name || <span className="text-muted-foreground">Company</span> },
            { key: 'account', label: 'Account', render: (r) => r.account?.name || <span className="text-muted-foreground">-</span> },
            { key: 'vendor', label: 'Vendor', render: (r) => (r.vendor ? <Link to={`/admin/vendors/${r.vendor.id}`} className="hover:text-primary">{r.vendor.name}</Link> : <span className="text-muted-foreground">-</span>) },
            { key: 'payment_method', label: 'Method', render: (r) => r.payment_method || <span className="text-muted-foreground">-</span> },
            { key: 'status', label: 'Status', render: (r) => <Badge tone={r.status === 'unpaid' ? 'warning' : 'success'} dot>{r.status === 'unpaid' ? (isExp ? 'Unpaid' : 'Pending') : (isExp ? 'Paid' : 'Received')}</Badge> },
            { key: 'attachment', label: 'Receipt', className: 'text-center', render: (r) => <AttachmentLink url={r.attachment} /> },
            { key: '_a', label: '', className: 'text-right', render: (r) => <Actions><Action icon={Pencil} label="Edit" tone="info" onClick={() => openForm(r)} /><Action icon={Trash2} label="Delete" tone="danger" onClick={() => remove(r)} /></Actions> },
          ]} />
        {rows.length > 0 && <TotalsRow><TotalItem label="Entries">{rows.length}</TotalItem><TotalItem label={isExp ? 'Paid' : 'Received'}>{pkr(paid)}</TotalItem><TotalItem label="Pending">{pkr(total - paid)}</TotalItem><TotalItem label="Total">{pkr(total)}</TotalItem></TotalsRow>}
        <ClientPager pager={pager} />
      </TableCard>

      <Dialog open={open} onOpenChange={setOpen} size="lg" icon={Receipt} title={`${editing ? 'Edit' : 'New'} ${noun}`} description={isExp ? 'Attach the bill so partners can verify the spend.' : undefined}
        footer={<><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={save} loading={saving}>{editing ? 'Save changes' : `Save ${noun}`}</Button></>}>
        <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
          {fields.map((f) => <FieldControl key={f.name} f={f} form={form} options={{ partner_id: partners, account_id: accounts, vendor_id: vendors }[f.name]} />)}
          {!cats.length && <p className="text-xs text-muted-foreground sm:col-span-2">Tip: create {noun} categories under <Link to="/admin/finance/setup" className="font-medium text-primary hover:underline">Finance setup</Link>.</p>}
          <button type="submit" className="hidden" />
        </form>
      </Dialog>
    </>
  );
}

/* ================================================================== setup */
export function FinanceSetup() {
  const [tab, setTab] = useState('accounts');
  const report = useFetch('/admin/finance/report');
  const balances = Object.fromEntries((report.data?.accounts || []).map((a) => [a.id, a.balance]));
  const partnersList = useFetch('/admin/finance/partners', { all: 1 });
  const shareTotal = sum((partnersList.data?.data || []).filter((p) => p.status), 'share_percent');
  const status = { key: 'status', label: 'Status', render: (r) => <Badge tone={r.status ? 'success' : 'neutral'} dot>{r.status ? 'Active' : 'Inactive'}</Badge> };

  return (
    <>
      <PageHeader eyebrow="Finance" title="Finance setup" description="The accounts money moves through, the partners who fund the business and the categories used to group income and expenses." />
      <TabBar id="fin-setup" value={tab} onChange={setTab} options={[{ value: 'accounts', label: 'Accounts', icon: Banknote }, { value: 'partners', label: 'Partners', icon: Users }, { value: 'categories', label: 'Categories', icon: Tags }]} />
      <FadeIn key={tab}>
        {tab === 'accounts' && (
          <CrudTable endpoint="/admin/finance/accounts" title="Accounts" description="Balances update live from entries, settlements, vendor payments and purchases" singular="Account" icon={Banknote} search={false} onChanged={report.reload}
            columns={[
              { key: 'name', label: 'Account', render: (a) => <div className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-xl bg-primary-soft text-primary">{a.type === 'bank' ? <Landmark className="size-4" /> : <Wallet className="size-4" />}</span><div><p className="font-medium">{a.name}</p>{a.note && <p className="max-w-xs truncate text-xs text-muted-foreground">{a.note}</p>}</div></div> },
              { key: 'type', label: 'Type', render: (a) => <Badge tone="outline">{humanize(a.type)}</Badge> },
              { key: 'opening_balance', label: 'Opening', className: 'text-right', render: (a) => pkr(a.opening_balance) },
              { key: 'balance', label: <LabelHint label="Balance" hint="Opening + income + COD settlements - paid expenses - vendor payments - purchases paid from this account." />, className: 'text-right', render: (a) => (report.loading && balances[a.id] === undefined ? <Skeleton className="ml-auto h-4 w-20" /> : <Amount value={balances[a.id] ?? a.opening_balance} />) },
              status,
            ]}
            fields={[
              { name: 'name', label: 'Account name', required: true, placeholder: 'e.g. Meezan Bank, Cash box, JazzCash' },
              { name: 'type', label: 'Type', type: 'select', half: true, required: true, default: 'cash', options: [{ value: 'cash', label: 'Cash' }, { value: 'bank', label: 'Bank' }, { value: 'wallet', label: 'Mobile wallet' }] },
              { name: 'opening_balance', label: 'Opening balance', type: 'money', half: true, default: 0 },
              { name: 'note', label: 'Note', type: 'textarea', rows: 2 },
              { name: 'status', label: 'Active', type: 'switch' },
            ]} />
        )}
        {tab === 'partners' && (
          <>
            {partnersList.data && shareTotal !== 100 && shareTotal > 0 && <p className="mb-4 rounded-2xl bg-warning-soft px-4 py-3 text-sm text-warning">Active partner shares add up to <b>{shareTotal}%</b>, not 100%.</p>}
            <CrudTable endpoint="/admin/finance/partners" title="Partners" description="Pick a partner as 'paid by' on expenses, vendor payments and purchases to see who funded what" singular="Partner" icon={Users} onChanged={partnersList.reload} searchPlaceholder="Search partners..."
              columns={[
                { key: 'name', label: 'Partner', render: (p) => <div><p className="font-medium">{p.name}</p><p className="text-xs text-muted-foreground">{[p.email, p.phone].filter(Boolean).join(' · ') || '-'}</p></div> },
                { key: 'share_percent', label: 'Share', render: (p) => <div className="flex w-36 items-center gap-2"><Meter value={p.share_percent} tone="bg-primary" /><span className="w-12 text-right text-xs font-semibold tabular-nums">{num(p.share_percent)}%</span></div> },
                status,
              ]}
              fields={[
                { name: 'name', label: 'Name', required: true },
                { name: 'email', label: 'E-mail', type: 'email', half: true },
                { name: 'phone', label: 'Phone', half: true },
                { name: 'share_percent', label: 'Profit share %', type: 'number', min: 0, max: 100, step: '0.01', half: true, default: 0 },
                { name: 'note', label: 'Note', type: 'textarea', rows: 2 },
                { name: 'status', label: 'Active', type: 'switch' },
              ]} />
          </>
        )}
        {tab === 'categories' && (
          <CrudTable endpoint="/admin/finance/categories" title="Categories" singular="Category" icon={Tags} searchPlaceholder="Search categories..."
            filters={[{ name: 'type', label: 'Expense & income', options: [{ value: 'expense', label: 'Expense' }, { value: 'income', label: 'Income' }] }]}
            columns={[
              { key: 'name', label: 'Category', render: (c) => <span className="font-medium">{c.name}</span> },
              { key: 'type', label: 'Type', render: (c) => <Badge tone={c.type === 'income' ? 'success' : 'danger'} dot>{humanize(c.type)}</Badge> },
            ]}
            fields={[
              { name: 'name', label: 'Name', required: true, placeholder: 'e.g. Marketing, Rent, Salaries' },
              { name: 'type', label: 'Type', type: 'select', required: true, default: 'expense', options: [{ value: 'expense', label: 'Expense' }, { value: 'income', label: 'Income' }] },
            ]} />
        )}
      </FadeIn>
    </>
  );
}

/* ============================================================ settlements */
export function CourierSettlements() {
  const table = useRef(null);
  const pending = useFetch('/admin/finance/cod-pending');
  const accounts = useLookup('/admin/finance/accounts', accountOpt);
  const [selected, setSelected] = useState([]);
  const [syncing, setSyncing] = useState(false);
  const pend = pending.data?.data || [];
  const picked = pend.filter((o) => selected.includes(o.id));
  const sync = async () => {
    setSyncing(true);
    try { await run(api.post('/admin/courier/payments-sync')); pending.reload(); table.current?.reload(); } catch { /* toast shown */ } finally { setSyncing(false); }
  };
  const prefill = () => {
    table.current?.open(null, {
      date: ymd(), cod_amount: sum(picked, 'amount').toFixed(2), charges: sum(picked, 'courier_charges').toFixed(2),
      tracking_numbers: picked.map((o) => o.tracking_number).filter(Boolean).join('\n'),
    });
  };
  const afterSave = () => { setSelected([]); pending.reload(); };

  return (
    <>
      <PageHeader eyebrow="Finance" title="Courier COD settlements" description="Record the cash-on-delivery payments Leopards transfers to you. Adding tracking numbers marks those orders as settled and the net amount is added to the chosen account.">
        <Button variant="outline" onClick={sync} loading={syncing}><RefreshCw />Sync from Leopards</Button>
        <Button onClick={() => table.current?.open(null, { date: ymd() })}><Plus />New settlement</Button>
      </PageHeader>

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <FadeIn><Tile label="COD outstanding" value={pkr(sum(pend, 'amount'))} tone="warn" sub={`${pend.length} shipment(s) not settled`} hint="COD orders shipped or delivered that are not marked as settled yet." /></FadeIn>
        <FadeIn delay={0.05}><Tile label="Delivered, awaiting payment" value={pkr(sum(pend.filter((o) => o.order_status === 'delivered'), 'amount'))} sub={`${pend.filter((o) => o.order_status === 'delivered').length} delivered`} /></FadeIn>
        <FadeIn delay={0.1}><Tile label="Courier charges on these" value={pkr(sum(pend, 'courier_charges'))} tone="out" sub="Usually deducted by Leopards" /></FadeIn>
      </div>

      <div className="space-y-6">
        <FadeIn delay={0.1}>
          <Card className="overflow-hidden">
            <CardHeader icon={FileClock} title="Pending COD shipments" description="Tick the shipments included in a Leopards payment to prefill a settlement"
              actions={picked.length > 0 && <Button size="sm" onClick={prefill}><HandCoins />Settle {picked.length} · {pkr(sum(picked, 'amount'))}</Button>} />
            <DataTable loading={pending.loading} rows={pend} selected={selected} onSelect={setSelected}
              empty={<EmptyState icon={Truck} title="No pending COD shipments" description="Every shipped cash-on-delivery order has been settled." />}
              columns={[
                { key: 'order_number', label: 'Order', render: (o) => <span className="font-medium">{o.order_number}</span> },
                { key: 'name', label: 'Customer', render: (o) => <div><p>{o.name}</p><p className="text-xs text-muted-foreground">{o.city || '-'}</p></div> },
                { key: 'tracking_number', label: 'Tracking', render: (o) => (o.tracking_number ? <span className="font-mono text-xs">{o.tracking_number}</span> : <span className="text-muted-foreground">-</span>) },
                { key: 'order_status', label: 'Status', render: (o) => <Badge tone={o.order_status === 'delivered' ? 'success' : 'info'} dot>{humanize(o.order_status)}</Badge> },
                { key: 'dispatched_at', label: 'Dispatched', render: (o) => <span className="text-muted-foreground">{fmtDate(o.delivered_at || o.dispatched_at)}</span> },
                { key: 'amount', label: 'COD amount', className: 'text-right', render: (o) => <b>{pkr(o.amount)}</b> },
                { key: 'courier_charges', label: 'Charges', className: 'text-right', render: (o) => <span className="text-muted-foreground">{pkr(o.courier_charges)}</span> },
              ]} />
          </Card>
        </FadeIn>

        <FadeIn delay={0.15}>
          <CrudTable ref={table} endpoint="/admin/finance/settlements" title="Settlements received" singular="Settlement" icon={HandCoins} search={false} size="lg" onChanged={afterSave}
            defaults={{ date: ymd() }} fieldOptions={{ account_id: accounts }}
            emptyDescription="Record each Leopards payment with its receipt."
            columns={[
              { key: 'date', label: 'Date', render: (s) => fmtDate(s.date) },
              { key: 'reference', label: 'Reference', render: (s) => <span className="font-medium">{s.reference || '-'}</span> },
              { key: 'cod_amount', label: 'COD amount', className: 'text-right', render: (s) => pkr(s.cod_amount) },
              { key: 'charges', label: 'Charges', className: 'text-right', render: (s) => <span className="text-danger">- {pkr(s.charges)}</span> },
              { key: 'net_amount', label: 'Net received', className: 'text-right', render: (s) => <Amount value={s.net_amount} /> },
              { key: 'tracking_numbers', label: 'Shipments', render: (s) => { const t = s.tracking_numbers || []; return t.length ? <Tip content={<span className="block max-w-60 font-mono break-all">{t.slice(0, 12).join(', ')}{t.length > 12 ? ' ...' : ''}</span>}><span className="cursor-default"><Badge tone="primary">{t.length} tracking no.</Badge></span></Tip> : <span className="text-muted-foreground">-</span>; } },
              { key: 'account', label: 'Account', render: (s) => s.account?.name || <span className="text-muted-foreground">-</span> },
              { key: 'attachment', label: 'Receipt', className: 'text-center', render: (s) => <AttachmentLink url={s.attachment} /> },
            ]}
            fields={[
              { name: 'date', label: 'Date received', type: 'date', required: true, half: true },
              { name: 'reference', label: 'Reference', half: true, placeholder: 'Leopards payment / cheque no.' },
              { name: 'cod_amount', label: 'COD amount', type: 'money', half: true },
              { name: 'charges', label: 'Courier charges deducted', type: 'money', half: true },
              { name: 'net_amount', label: 'Net received', type: 'money', half: true, placeholder: 'Auto', hint: (v) => `Leave empty to use COD - charges = ${pkr(num(v.cod_amount) - num(v.charges))}` },
              { name: 'account_id', label: 'Deposited to account', type: 'select', half: true, placeholder: 'No account' },
              { name: 'tracking_numbers', label: 'Tracking numbers', type: 'textarea', rows: 4, placeholder: 'One per line (or separated by commas)', hint: 'Orders with these tracking numbers are marked as COD settled.', fromRow: (r) => (Array.isArray(r.tracking_numbers) ? r.tracking_numbers.join('\n') : r.tracking_numbers || '') },
              { name: 'note', label: 'Note', type: 'textarea', rows: 2 },
              { name: 'attachment', label: 'Payment receipt', type: 'file', placeholder: 'Upload payment advice / screenshot' },
            ]} />
        </FadeIn>
      </div>
    </>
  );
}
