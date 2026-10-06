import { useState } from 'react';
import { toast } from 'sonner';
import { CalendarClock, Check, X, Eye, Nfc, Paperclip, Receipt, Banknote, ArrowLeftRight, Network, Wallet, Package } from 'lucide-react';
import api from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { fmtDate, fmtDateTime, money, label } from '@/lib/format';
import { PageHeader, TableCard, DataTable, SearchInput, FilterSelect, Action, Actions, Dialog, Button, Field, Input, Textarea, Badge, StatusBadge, UserCell, EmptyState, Select, useList, run, confirm, promptText } from '@/components/ui';

const statusOpts = (arr) => arr.map((v) => ({ value: v, label: label(v) }));
const Detail = ({ rows }) => (
  <dl className="divide-y divide-border rounded-2xl border border-border">
    {rows.filter(Boolean).map(([k, v]) => <div key={k} className="grid grid-cols-3 gap-4 px-4 py-3 text-sm"><dt className="text-muted-foreground">{k}</dt><dd className="col-span-2 break-words whitespace-pre-wrap">{v || '-'}</dd></div>)}
  </dl>
);

/* --------------------------------------------------------- subscriptions */
export function Subscriptions() {
  const list = useList('/admin/subscriptions');
  const [edit, setEdit] = useState(null);
  const save = async () => { await run(api.put(`/admin/subscriptions/${edit.id}`, edit)).then(() => { setEdit(null); list.reload(); }).catch(() => {}); };
  const add = (years) => setEdit((e) => { const d = new Date(e.ends_at || Date.now()); d.setFullYear(d.getFullYear() + years); return { ...e, ends_at: d.toISOString().slice(0, 10) }; });
  return (
    <>
      <PageHeader title="Subscriptions" description="Plans subscribed by users. You can extend or shorten any subscription." />
      <TableCard title="Subscribed user plans" list={list} toolbar={<>
        <FilterSelect value={list.params.status} onChange={(v) => list.set({ status: v })} placeholder="All statuses" options={statusOpts(['active', 'inactive', 'pending'])} />
        <SearchInput value={list.params.search} onChange={(search) => list.set({ search })} placeholder="Search user..." />
      </>}>
        <DataTable loading={list.loading} rows={list.rows} empty={<EmptyState icon={Receipt} title="No subscriptions" />} columns={[
          { key: 'user', label: 'User', render: (s) => <UserCell user={s.user} /> },
          { key: 'plan', label: 'Plan', render: (s) => <div><p className="font-medium">{s.plan?.name}</p><p className="text-xs text-muted-foreground">{label(s.plan_frequency)}</p></div> },
          { key: 'amt', label: 'Paid', render: (s) => <div><p className="font-semibold">{money(s.payable_amount, s.plan?.currency)}</p>{Number(s.discount) > 0 && <p className="text-xs text-success">-{money(s.discount, s.plan?.currency)} coupon</p>}</div> },
          { key: 'type', label: 'Method', render: (s) => <Badge tone="outline">{label(s.payment_type || '-')}</Badge> },
          { key: 'period', label: 'Period', render: (s) => <div className="text-xs"><p>{fmtDate(s.starts_at)}</p><p className="text-muted-foreground">→ {fmtDate(s.ends_at)}{s.trial_ends_at && ' (trial)'}</p></div> },
          { key: 'status', label: 'Status', render: (s) => (s.status === 'active' && new Date(s.ends_at) < new Date() ? <StatusBadge value="expired" /> : <StatusBadge value={s.status} />) },
          { key: '_a', label: '', className: 'text-right', render: (s) => <Actions><Action icon={CalendarClock} label="Change end date" tone="info" onClick={() => setEdit({ id: s.id, name: `${s.user?.first_name} ${s.user?.last_name}`, plan: s.plan?.name, ends_at: String(s.ends_at).slice(0, 10), notes: s.notes || '' })} /></Actions> },
        ]} />
      </TableCard>
      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)} icon={CalendarClock} title="Change subscription end date" description={edit && `${edit.name} · ${edit.plan}`}
        footer={<><Button variant="outline" onClick={() => setEdit(null)}>Cancel</Button><Button onClick={save}>Save</Button></>}>
        {edit && (
          <div className="space-y-4">
            <Field label="End date"><Input type="date" value={edit.ends_at} onChange={(e) => setEdit({ ...edit, ends_at: e.target.value })} /></Field>
            <div className="flex flex-wrap gap-2">{[1, 2, 3, 5].map((y) => <Button key={y} size="sm" variant="soft" onClick={() => add(y)}>+{y} year{y > 1 ? 's' : ''}</Button>)}</div>
            <Field label="Notes"><Textarea rows={2} value={edit.notes} onChange={(e) => setEdit({ ...edit, notes: e.target.value })} /></Field>
          </div>
        )}
      </Dialog>
    </>
  );
}

/* ---------------------------------------------------------- cash payments */
export function CashPayments() {
  const list = useList('/admin/transactions', { type: 'manual' });
  const decide = async (t, status) => {
    const ok = await confirm(status === 'paid'
      ? { title: 'Approve this payment?', description: 'The plan or NFC order will be activated and the user notified.', confirmText: 'Approve', tone: 'primary' }
      : { title: 'Reject this payment?', description: 'The user will be notified by e-mail.', confirmText: 'Reject' });
    if (!ok) return;
    await run(api.patch(`/admin/transactions/${t.id}/status`, { status })).catch(() => {}); list.reload();
  };
  return (
    <>
      <PageHeader title="Cash Payments" description="Manual bank transfers and cash payments waiting for your approval." />
      <TableCard title="Manual payments" list={list} toolbar={<FilterSelect value={list.params.status} onChange={(v) => list.set({ status: v })} placeholder="All statuses" options={statusOpts(['pending', 'paid', 'rejected'])} />}>
        <DataTable loading={list.loading} rows={list.rows} empty={<EmptyState icon={Banknote} title="No manual payments" description="Payments made with the manual method appear here." />} columns={[
          { key: 'user', label: 'User', render: (t) => <UserCell user={t.user} /> },
          { key: 'for', label: 'For', render: (t) => (t.purpose === 'subscription' ? <div><p className="font-medium">{t.subscription?.plan?.name || 'Plan'}</p><p className="text-xs text-muted-foreground">Subscription</p></div> : <Badge tone="info"><Nfc className="size-3" />NFC order</Badge>) },
          { key: 'amount', label: 'Amount', render: (t) => <span className="font-semibold">{money(t.amount)}</span> },
          { key: 'notes', label: 'Notes', render: (t) => <span className="block max-w-56 truncate text-xs text-muted-foreground">{t.notes || '-'}</span> },
          { key: 'att', label: 'Receipt', render: (t) => (t.attachment ? <a href={t.attachment} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-primary hover:underline"><Paperclip className="size-3.5" />View</a> : '-') },
          { key: 'date', label: 'Date', render: (t) => <span className="text-muted-foreground">{fmtDateTime(t.created_at)}</span> },
          { key: 'status', label: 'Status', render: (t) => <StatusBadge value={t.status}>{t.status === 'paid' ? 'Approved' : undefined}</StatusBadge> },
          {
            key: '_a', label: '', className: 'text-right', render: (t) => (t.status === 'pending' ? (
              <div className="flex justify-end gap-1.5"><Button size="xs" variant="success-soft" onClick={() => decide(t, 'paid')}><Check />Approve</Button><Button size="xs" variant="danger-soft" onClick={() => decide(t, 'rejected')}><X />Reject</Button></div>
            ) : null),
          },
        ]} />
      </TableCard>
    </>
  );
}

/* ----------------------------------------------------------- transactions */
export function Transactions() {
  const list = useList('/admin/transactions');
  return (
    <>
      <PageHeader title="Transactions" description="Every payment across all gateways." />
      <TableCard title="All transactions" list={list} toolbar={<>
        <FilterSelect value={list.params.type} onChange={(v) => list.set({ type: v })} placeholder="All gateways" options={statusOpts(['stripe', 'paypal', 'razorpay', 'flutterwave', 'paystack', 'phonepe', 'manual'])} />
        <FilterSelect value={list.params.status} onChange={(v) => list.set({ status: v })} placeholder="All statuses" options={statusOpts(['pending', 'paid', 'rejected'])} />
      </>}>
        <DataTable loading={list.loading} rows={list.rows} empty={<EmptyState icon={ArrowLeftRight} title="No transactions yet" />} columns={[
          { key: 'ref', label: 'Reference', render: (t) => <div><p className="font-mono text-xs font-semibold text-primary">#{String(t.id).padStart(6, '0')}</p><p className="max-w-40 truncate text-xs text-muted-foreground">{t.transaction_id || '-'}</p></div> },
          { key: 'user', label: 'User', render: (t) => <UserCell user={t.user} /> },
          { key: 'purpose', label: 'Purpose', render: (t) => label(t.purpose) },
          { key: 'type', label: 'Gateway', render: (t) => <Badge tone="outline">{label(t.type)}</Badge> },
          { key: 'amount', label: 'Amount', render: (t) => <span className="font-semibold">{money(t.amount)}</span> },
          { key: 'date', label: 'Date', render: (t) => <span className="text-muted-foreground">{fmtDateTime(t.created_at)}</span> },
          { key: 'status', label: 'Status', render: (t) => <StatusBadge value={t.status} /> },
        ]} />
      </TableCard>
    </>
  );
}

/* ----------------------------------------------------------- affiliations */
export function Affiliations() {
  const list = useList('/admin/affiliations');
  const set = async (a, status) => { await run(api.patch(`/admin/affiliations/${a.id}`, { status })).catch(() => {}); list.reload(); };
  return (
    <>
      <PageHeader title="Affiliations" description="Referral earnings. Approve them to make the amount withdrawable." />
      <TableCard title="Affiliation users" list={list} toolbar={<FilterSelect value={list.params.status} onChange={(v) => list.set({ status: v })} placeholder="All statuses" options={statusOpts(['pending', 'approved', 'rejected'])} />}>
        <DataTable loading={list.loading} rows={list.rows} empty={<EmptyState icon={Network} title="No referrals yet" />} columns={[
          { key: 'by', label: 'Referred by', render: (a) => <UserCell user={a.affiliator} /> },
          { key: 'user', label: 'New user', render: (a) => <UserCell user={a.referred} /> },
          { key: 'amount', label: 'Earning', render: (a) => <span className="font-semibold">{money(a.amount)}</span> },
          { key: 'date', label: 'Date', render: (a) => <span className="text-muted-foreground">{fmtDate(a.created_at)}</span> },
          { key: 'status', label: 'Status', render: (a) => <StatusBadge value={a.status} /> },
          {
            key: '_a', label: '', className: 'text-right', render: (a) => (a.status === 'pending' ? (
              <Actions><Action icon={Check} label="Approve" tone="success" onClick={() => set(a, 'approved')} /><Action icon={X} label="Reject" tone="danger" onClick={() => set(a, 'rejected')} /></Actions>
            ) : null),
          },
        ]} />
      </TableCard>
    </>
  );
}

export function Withdrawals() {
  const list = useList('/admin/withdrawals');
  const [view, setView] = useState(null);
  const approve = async (w) => {
    if (!(await confirm({ title: 'Mark as paid?', description: `Confirm ${money(w.amount)} was paid to ${w.email}.`, confirmText: 'Mark paid', tone: 'primary' }))) return;
    await run(api.patch(`/admin/withdrawals/${w.id}`, { status: 'approved', paid_by: 'manual' })).catch(() => {}); list.reload();
  };
  const reject = async (w) => {
    const note = await promptText({ title: 'Reject withdrawal', description: 'Give a reason. The user will see it.', placeholder: 'Reason...', confirmText: 'Reject' });
    if (!note) return;
    await run(api.patch(`/admin/withdrawals/${w.id}`, { status: 'rejected', rejection_note: note })).catch(() => {}); list.reload();
  };
  return (
    <>
      <PageHeader title="Withdrawals" description="Affiliate payout requests." />
      <TableCard title="Withdrawal requests" list={list} toolbar={<FilterSelect value={list.params.status} onChange={(v) => list.set({ status: v })} placeholder="All statuses" options={statusOpts(['pending', 'approved', 'rejected'])} />}>
        <DataTable loading={list.loading} rows={list.rows} empty={<EmptyState icon={Wallet} title="No withdrawal requests" />} columns={[
          { key: 'user', label: 'User', render: (w) => <UserCell user={w.user} /> },
          { key: 'email', label: 'Payout e-mail', render: (w) => w.email },
          { key: 'amount', label: 'Amount', render: (w) => <span className="font-semibold">{money(w.amount)}</span> },
          { key: 'date', label: 'Requested', render: (w) => <span className="text-muted-foreground">{fmtDate(w.created_at)}</span> },
          { key: 'status', label: 'Status', render: (w) => <StatusBadge value={w.status} /> },
          {
            key: '_a', label: '', className: 'text-right', render: (w) => (
              <Actions>
                <Action icon={Eye} label="Details" onClick={() => setView(w)} />
                {w.status === 'pending' && <><Action icon={Check} label="Mark paid" tone="success" onClick={() => approve(w)} /><Action icon={X} label="Reject" tone="danger" onClick={() => reject(w)} /></>}
              </Actions>
            ),
          },
        ]} />
      </TableCard>
      <Dialog open={!!view} onOpenChange={(o) => !o && setView(null)} icon={Wallet} title="Withdrawal details">
        {view && <Detail rows={[['Amount', money(view.amount)], ['E-mail', view.email], ['Bank details', view.bank_details], view.rejection_note && ['Rejection note', view.rejection_note]]} />}
      </Dialog>
    </>
  );
}

/* ------------------------------------------------------------ NFC orders */
const ORDER_STATUSES = ['pending', 'processing', 'ready', 'shipped', 'delivered', 'cancelled'];
export function NfcOrders() {
  const list = useList('/admin/nfc-orders');
  const { settings } = useAuth();
  const [view, setView] = useState(null);
  const setStatus = async (o, order_status) => { o.order_status = order_status; await run(api.patch(`/admin/nfc-orders/${o.id}`, { order_status }), `Order marked ${order_status}`).catch(() => {}); list.reload(); };
  const writeNfc = async (o) => {
    const url = `${settings.app_url}/${o.vcard?.url_alias}`;
    if (!('NDEFReader' in window)) {
      try { await navigator.clipboard.writeText(url); } catch { /* ignore */ }
      toast.info('Web NFC works in Chrome on Android. The card URL was copied so you can use any NFC writer app.', { description: url });
      return;
    }
    try {
      const ndef = new window.NDEFReader();
      toast.loading('Hold the NFC card near your phone...', { id: 'nfc' });
      await ndef.write({ records: [{ recordType: 'url', data: url }] });
      await api.patch(`/admin/nfc-orders/${o.id}`, { nfc_written: true });
      toast.success('NFC card written', { id: 'nfc' }); list.reload();
    } catch (e) { toast.error(`NFC write failed: ${e.message}`, { id: 'nfc' }); }
  };
  return (
    <>
      <PageHeader title="NFC Orders" description="Physical NFC card orders. Update their status or write the cards directly." />
      <TableCard title="Orders" list={list} toolbar={<>
        <FilterSelect value={list.params.order_status} onChange={(v) => list.set({ order_status: v })} placeholder="Order status" options={statusOpts(ORDER_STATUSES)} />
        <FilterSelect value={list.params.payment_status} onChange={(v) => list.set({ payment_status: v })} placeholder="Payment" options={statusOpts(['pending', 'paid', 'rejected'])} />
        <SearchInput value={list.params.search} onChange={(search) => list.set({ search })} placeholder="Order no, name..." />
      </>}>
        <DataTable loading={list.loading} rows={list.rows} empty={<EmptyState icon={Nfc} title="No NFC orders yet" />} columns={[
          { key: 'no', label: 'Order', render: (o) => <div><p className="font-mono text-xs font-semibold text-primary">{o.order_number}</p><p className="text-xs text-muted-foreground">{fmtDate(o.created_at)}</p></div> },
          { key: 'cust', label: 'Customer', render: (o) => <div><p className="font-medium">{o.name}</p><p className="text-xs text-muted-foreground">{o.email}</p></div> },
          { key: 'card', label: 'Card', render: (o) => <div><p>{o.nfc_card?.name}</p><p className="text-xs text-muted-foreground">x{o.quantity} · {money(o.amount)}</p></div> },
          { key: 'pay', label: 'Payment', render: (o) => <StatusBadge value={o.payment_status} /> },
          { key: 'st', label: 'Status', render: (o) => <div className="w-36"><Select value={o.order_status} onChange={(v) => setStatus(o, v)} options={statusOpts(ORDER_STATUSES)} className="h-8 rounded-lg text-xs" /></div> },
          { key: 'nfc', label: 'NFC', render: (o) => (o.nfc_written ? <StatusBadge value="written" /> : <Badge>Not written</Badge>) },
          {
            key: '_a', label: '', className: 'text-right', render: (o) => (
              <Actions><Action icon={Eye} label="Details" onClick={() => setView(o)} /><Action icon={Nfc} label="Write NFC card" tone="success" onClick={() => writeNfc(o)} /></Actions>
            ),
          },
        ]} />
      </TableCard>
      <Dialog open={!!view} onOpenChange={(o) => !o && setView(null)} size="lg" icon={Package} title={view ? `Order ${view.order_number}` : ''}>
        {view && (
          <div className="grid gap-4 md:grid-cols-2">
            <Detail rows={[['Name', view.name], ['Designation', view.designation], ['Company', view.company_name], ['E-mail', view.email], ['Phone', `${view.region_code ? `+${view.region_code} ` : ''}${view.phone}`], ['Address', view.address]]} />
            <div className="space-y-4">
              <Detail rows={[['Card', view.nfc_card?.name], ['Quantity', `${view.quantity} x ${money(view.unit_price)}`], ['Total', money(view.amount)], ['Payment', label(view.payment_type)], ['vCard', view.vcard && `/${view.vcard.url_alias}`]]} />
              {view.logo && <img src={view.logo} alt="Logo" className="max-h-32 rounded-2xl border border-border" />}
            </div>
          </div>
        )}
      </Dialog>
    </>
  );
}
