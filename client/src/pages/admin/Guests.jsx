/* Admin: guest customers (orders without an account) with their order journey, reorder and reorder-with-changes */
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { motion } from 'motion/react';
import { UserRound, ArrowLeft, Phone, Mail, MapPin, Building2, Pencil, Repeat, Wand2, Plus, ShoppingBag, Package, Wallet, CalendarDays, ExternalLink, Store, Truck, StickyNote } from 'lucide-react';
import api from '@/lib/api';
import { cn } from '@/lib/cn';
import { fmtDate, fmtDateTime } from '@/lib/format';
import {
  PageHeader, TableCard, DataTable, SearchInput, Card, CardHeader, CardBody, Button, ButtonLink, Field, Input, Textarea, Dialog, Badge, StatusBadge, StatCard, EmptyState, Skeleton, Avatar, Tip, useList, useForm, run,
} from '@/components/ui';
import { rs } from './Orders';

export function GuestCustomers() {
  const list = useList('/admin/guest-customers');
  const navigate = useNavigate();
  return (
    <>
      <PageHeader title="Guest customers" description="Customers who ordered without an account (mostly non-plan products). Open one to see everything they bought and reorder in one click.">
        <ButtonLink as={Link} to="/admin/orders/new"><Plus />New order</ButtonLink>
      </PageHeader>
      <TableCard title="Guests" list={list} toolbar={<SearchInput value={list.params.search} onChange={(search) => list.set({ search })} placeholder="Name, phone, e-mail, city..." />}>
        <DataTable loading={list.loading} rows={list.rows} onRowClick={(g) => navigate(`/admin/guest-customers/${g.id}`)}
          empty={<EmptyState icon={UserRound} title="No guest customers yet" description="Choose Guest in New order; returning guests are recognised by phone or e-mail." />} columns={[
            { key: 'n', label: 'Guest', render: (g) => <div className="flex items-center gap-3"><Avatar name={g.name} size={36} /><div className="min-w-0"><p className="truncate font-medium">{g.name}</p><p className="truncate text-xs text-muted-foreground">{g.company_name || g.city || '-'}</p></div></div> },
            { key: 'c', label: 'Contact', render: (g) => <div className="text-sm"><p>{g.phone || '-'}</p><p className="text-xs text-muted-foreground">{g.email || ''}</p></div> },
            { key: 'o', label: 'Orders', render: (g) => <span className="font-semibold">{g.orders}</span> },
            { key: 's', label: 'Spent', render: (g) => <span className="font-semibold">{rs(g.spent)}</span> },
            { key: 'l', label: 'Last order', render: (g) => <span className="text-muted-foreground">{g.last_order ? fmtDate(g.last_order) : '-'}</span> },
          ]} />
      </TableCard>
    </>
  );
}

function EditGuest({ guest, onClose, onSaved }) {
  const form = useForm({ name: guest.name || '', phone: guest.phone || '', email: guest.email || '', company_name: guest.company_name || '', city: guest.city || '', address: guest.address || '', notes: guest.notes || '' });
  const [busy, setBusy] = useState(false);
  const save = async () => { setBusy(true); try { await run(api.put(`/admin/guest-customers/${guest.id}`, form.values)); onSaved(); } catch (e) { form.setErrors(e.errors || {}); } finally { setBusy(false); } };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} size="lg" icon={UserRound} title="Edit guest" footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={save} loading={busy}>Save</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" required error={form.errors.name}><Input {...form.input('name')} /></Field>
        <Field label="Phone" error={form.errors.phone}><Input {...form.input('phone')} /></Field>
        <Field label="E-mail" error={form.errors.email}><Input {...form.input('email')} type="email" /></Field>
        <Field label="Company"><Input {...form.input('company_name')} /></Field>
        <Field label="City"><Input {...form.input('city')} /></Field>
        <Field label="Address"><Input {...form.input('address')} /></Field>
        <Field label="Notes" hint="Preferences, design details... only staff see this" className="sm:col-span-2"><Textarea {...form.input('notes')} rows={3} /></Field>
      </div>
    </Dialog>
  );
}

export function GuestDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [d, setD] = useState(null);
  const [editing, setEditing] = useState(false);
  const load = () => api.get(`/admin/guest-customers/${id}`).then(({ data }) => setD(data));
  useEffect(() => { load(); }, [id]); // eslint-disable-line
  if (!d) return <div className="space-y-4"><Skeleton className="h-40 rounded-3xl" /><Skeleton className="h-96 rounded-3xl" /></div>;
  const g = d.data;
  const reorder = (o, edit) => navigate(`/admin/orders/new?reorder=${o.id}${edit ? '&edit=1' : ''}`);
  return (
    <>
      <Link to="/admin/guest-customers" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" />All guests</Link>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="relative mb-6 overflow-hidden">
          <div className="absolute inset-0 bg-linear-to-br from-sky-500/10 via-violet-500/5 to-transparent" />
          <div className="relative flex flex-wrap items-start gap-5 p-6">
            <Avatar name={g.name} size={64} />
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="flex flex-wrap items-center gap-2"><h1 className="font-display text-2xl font-bold">{g.name}</h1><Badge tone="info">Guest</Badge></div>
              <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground">
                {g.phone && <a href={`tel:${g.phone}`} className="flex items-center gap-1.5 hover:text-primary"><Phone className="size-4" />{g.phone}</a>}
                {g.email && <a href={`mailto:${g.email}`} className="flex items-center gap-1.5 hover:text-primary"><Mail className="size-4" />{g.email}</a>}
                {g.company_name && <span className="flex items-center gap-1.5"><Building2 className="size-4" />{g.company_name}</span>}
                {(g.address || g.city) && <span className="flex items-center gap-1.5"><MapPin className="size-4" />{[g.address, g.city].filter(Boolean).join(', ')}</span>}
              </div>
              {g.notes && <p className="flex items-start gap-1.5 text-sm"><StickyNote className="mt-0.5 size-4 shrink-0 text-warning" />{g.notes}</p>}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setEditing(true)}><Pencil />Edit</Button>
              <ButtonLink as={Link} to={`/admin/orders/new?guest=${g.id}`}><Plus />New order</ButtonLink>
            </div>
          </div>
        </Card>
      </motion.div>
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={ShoppingBag} label="Orders" value={d.stats.orders} color="violet" />
        <StatCard icon={Wallet} label="Total spent" value={d.stats.spent} format={(v) => rs(v)} color="emerald" index={1} />
        <StatCard icon={Package} label="Items bought" value={d.stats.items} color="amber" index={2} />
        <StatCard icon={CalendarDays} label="Customer since" value={d.stats.first ? fmtDate(d.stats.first) : '-'} color="sky" index={3} />
      </div>
      <Card>
        <CardHeader icon={Repeat} title="Journey" description="Every order, newest first. Reorder repeats it as it was; Reorder & customise lets you change products, quantities and prices first." />
        <CardBody>
          {!d.orders.length ? <EmptyState icon={ShoppingBag} title="No orders yet" /> : (
            <ol className="relative ml-3 space-y-6 border-l-2 border-border pl-7">
              {d.orders.map((o, i) => (
                <motion.li key={o.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: Math.min(i * 0.05, 0.4) }} className="relative">
                  <span className={cn('absolute top-1 -left-[2.32rem] grid size-6 place-items-center rounded-full border-2 border-card', o.order_status === 'cancelled' ? 'bg-danger' : o.order_status === 'delivered' ? 'bg-success' : 'bg-primary')}><ShoppingBag className="size-3 text-white" /></span>
                  <div className="rounded-2xl border border-border p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link to={`/admin/orders/${o.id}`} className="font-mono text-sm font-semibold text-primary hover:underline">{o.order_number}</Link>
                      <StatusBadge value={o.order_status} />
                      {o.fulfilment === 'collection' ? <Badge tone="info"><Store className="size-3" />Collection</Badge> : <Badge tone="neutral"><Truck className="size-3" />Delivery</Badge>}
                      {o.order_source && <Badge tone="outline">{o.order_source.name}</Badge>}
                      <span className="ml-auto text-xs text-muted-foreground">{fmtDateTime(o.created_at)}{o.creator ? ` · by ${o.creator.first_name} ${o.creator.last_name}` : ''}</span>
                    </div>
                    <ul className="mt-3 space-y-1 text-sm">
                      {(o.items || []).map((it) => (
                        <li key={it.id} className="flex justify-between gap-3"><span>{it.quantity} × {it.name}{it.variant ? ` · ${it.variant}` : ''}{it.customization ? <span className="text-primary"> + customisation</span> : null}</span><span className="text-muted-foreground">{rs(it.total)}</span></li>
                      ))}
                    </ul>
                    {(o.status_history || []).length > 1 && (
                      <div className="mt-3 flex flex-wrap items-center gap-1 text-[11px] text-muted-foreground">
                        {o.status_history.map((h, j) => <Tip key={j} content={`${fmtDateTime(h.at)}${h.by ? ` · ${h.by}` : ''}${h.note ? ` · ${h.note}` : ''}`}><span className="rounded-full bg-muted px-2 py-0.5">{h.status}</span></Tip>)}
                      </div>
                    )}
                    <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
                      <span className="font-semibold">{rs(o.amount)}</span>
                      {Number(o.discount) > 0 && <span className="text-xs text-success">saved {rs(o.discount)}</span>}
                      <span className="flex-1" />
                      <Tip content="Open the order"><ButtonLink as={Link} to={`/admin/orders/${o.id}`} size="sm" variant="ghost"><ExternalLink /></ButtonLink></Tip>
                      <Button size="sm" variant="outline" onClick={() => reorder(o, true)}><Wand2 />Reorder &amp; customise</Button>
                      <Button size="sm" onClick={() => reorder(o, false)}><Repeat />Reorder</Button>
                    </div>
                  </div>
                </motion.li>
              ))}
            </ol>
          )}
        </CardBody>
      </Card>
      {editing && <EditGuest guest={g} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); load(); }} />}
    </>
  );
}
