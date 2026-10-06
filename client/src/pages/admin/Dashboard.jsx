import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { Users, IdCard, UserX, EyeOff, Wallet, ArrowUpRight, Plus, LayoutTemplate, Package, Mail, Building2, Store, ShoppingBag, Truck, FileText, Boxes, TrendingUp } from 'lucide-react';
import api from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { money, fmtDate, fullName } from '@/lib/format';
import { PageHeader, StatCard, Card, CardHeader, CardBody, Segmented, UserCell, StatusBadge, EmptyState, Skeleton, ButtonLink, Reveal } from '@/components/ui';
import { AreaTrend, Donut } from '@/components/ui/charts';

function Loading() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-32 rounded-2xl" />)}</div>
      <div className="grid gap-4 xl:grid-cols-3"><Skeleton className="h-96 rounded-2xl xl:col-span-2" /><Skeleton className="h-96 rounded-2xl" /></div>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [d, setD] = useState(null);
  const [range, setRange] = useState('week');
  useEffect(() => { api.get('/admin/dashboard').then((r) => setD(r.data)); }, []);
  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  if (!d) return <><PageHeader title={`${greet}, ${user.first_name}`} description="Here's what's happening across your platform." /><Loading /></>;
  const { stats } = d;
  const fmtMoney = (v) => money(v, d.currency).replace(/\.00$/, '');
  const income = d.income.labels.map((label, i) => ({ label, value: d.income.data[i] }));

  return (
    <>
      <PageHeader eyebrow="Overview" title={`${greet}, ${user.first_name}`} description="Here's what's happening across your platform today.">
        <ButtonLink as={Link} to="/admin/users" variant="outline"><Plus />Add user</ButtonLink>
        <ButtonLink as={Link} to="/admin/plans/create"><Package />New plan</ButtonLink>
      </PageHeader>

      {d.business && (
        <Reveal className="mb-6">
          <Card className="overflow-hidden">
            <CardHeader icon={ShoppingBag} title="Business today" description="Orders, cash on delivery, invoices and stock at a glance"
              actions={<ButtonLink as={Link} to="/admin/analytics" size="sm" variant="soft"><TrendingUp />Profit analytics</ButtonLink>} />
            <CardBody className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {[
                [ShoppingBag, 'Open orders', d.business.open_orders, `${d.business.today_orders} new today`, '/admin/orders'],
                [Wallet, 'Sales this month', `Rs ${Math.round(d.business.month_sales).toLocaleString()}`, `${d.business.month_orders} orders`, '/admin/orders'],
                [Truck, 'COD to collect', `Rs ${Math.round(d.business.cod_pending).toLocaleString()}`, 'Dispatched, not settled', '/admin/finance/settlements'],
                [FileText, 'Unpaid invoices', `Rs ${Math.round(d.business.unpaid_invoices).toLocaleString()}`, 'Outstanding balance', '/admin/invoices'],
                [Boxes, 'Low stock', d.business.low_stock.length, d.business.low_stock.slice(0, 2).map((i) => i.name).join(', ') || 'All good', '/admin/inventory'],
              ].map(([I, l, v, h, to]) => (
                <Link key={l} to={to} className="group rounded-2xl border border-border p-4 transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-soft">
                  <I className="size-5 text-primary" />
                  <p className="mt-3 text-xs text-muted-foreground">{l}</p>
                  <p className="font-display text-xl font-bold">{v}</p>
                  <p className="truncate text-xs text-muted-foreground">{h}</p>
                </Link>
              ))}
            </CardBody>
          </Card>
        </Reveal>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard index={0} icon={Users} color="violet" label="Active users" value={stats.activeUsers} hint="Currently able to sign in" to="/admin/users" />
        <StatCard index={1} icon={IdCard} color="pink" label="Active vCards" value={stats.activeVcards} hint="Published and public" to="/admin/vcards" />
        <StatCard index={2} icon={UserX} color="amber" label="Deactivated users" value={stats.inactiveUsers} to="/admin/users" />
        <StatCard index={3} icon={EyeOff} color="sky" label="Deactivated vCards" value={stats.inactiveVcards} to="/admin/vcards" />
        <StatCard index={4} icon={Building2} color="emerald" label="Organisations" value={stats.organisations || 0} hint="Team accounts" to="/admin/users" />
        <StatCard index={5} icon={Store} color="rose" label="WhatsApp stores" value={stats.stores || 0} hint="Product catalogues" to="/admin/whatsapp-stores" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Reveal className="xl:col-span-2">
          <Card className="h-full">
            <CardHeader icon={Wallet} title="Income overview" description="Paid transactions over the last 12 months"
              actions={<div className="text-right"><p className="text-xs text-muted-foreground">Total income</p><p className="font-display text-2xl font-bold">{money(stats.income, d.currency)}</p></div>} />
            <CardBody><AreaTrend data={income} name="Income" format={fmtMoney} height={300} /></CardBody>
          </Card>
        </Reveal>
        <Reveal delay={0.1}>
          <Card className="h-full">
            <CardHeader icon={Package} title="Plans by users" description="Active subscriptions per plan" />
            <CardBody>{d.plans.some((p) => p.total) ? <Donut data={d.plans.map((p) => ({ name: p.name, value: p.total }))} center="subscribers" /> : <EmptyState icon={Package} title="No subscriptions yet" />}</CardBody>
          </Card>
        </Reveal>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Reveal className="xl:col-span-2">
          <Card className="overflow-hidden">
            <CardHeader icon={Users} title="Recent registrations" description="New users who joined recently"
              actions={<Segmented id="range" size="sm" value={range} onChange={setRange} options={[{ value: 'day', label: 'Today' }, { value: 'week', label: 'Week' }, { value: 'month', label: 'Month' }]} />} />
            {!d.recent[range].length ? <EmptyState icon={Users} title="No sign-ups in this period" /> : (
              <ul className="divide-y divide-border">
                {d.recent[range].map((u, i) => (
                  <motion.li key={`${range}-${u.id}`} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}>
                    <Link to={`/admin/users/${u.id}`} className="group flex items-center gap-4 px-5 py-3.5 transition hover:bg-muted/40">
                      <UserCell user={u} />
                      <span className="ml-auto hidden text-sm text-muted-foreground sm:block">{fmtDate(u.created_at)}</span>
                      <StatusBadge value={u.is_active ? 'active' : 'inactive'} />
                      <ArrowUpRight className="size-4 text-muted-foreground opacity-0 transition group-hover:opacity-100" />
                    </Link>
                  </motion.li>
                ))}
              </ul>
            )}
          </Card>
        </Reveal>
        <Reveal delay={0.1}>
          <Card className="relative h-full overflow-hidden">
            <div className="absolute inset-0 bg-linear-to-br from-violet-600 to-fuchsia-600" />
            <div className="bg-grid absolute inset-0 opacity-20" />
            <div className="relative p-6 text-white">
              <p className="text-sm text-white/70">Quick actions</p>
              <h3 className="mt-1 font-display text-2xl font-bold">Keep things moving</h3>
              <div className="mt-6 grid gap-2">
                {[[LayoutTemplate, 'Manage templates', '/admin/templates'], [IdCard, 'Review vCards', '/admin/vcards'], [Wallet, 'Approve cash payments', '/admin/cash-payments'], [Mail, 'Send an e-mail', '/admin/send-email']].map(([I, l, to]) => (
                  <Link key={to} to={to} className="group flex items-center gap-3 rounded-2xl bg-white/10 px-4 py-3 text-sm font-medium backdrop-blur transition hover:bg-white/20">
                    <I className="size-4" />{l}<ArrowUpRight className="ml-auto size-4 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                  </Link>
                ))}
              </div>
              <p className="mt-6 text-xs text-white/60">Signed in as {fullName(user)}</p>
            </div>
          </Card>
        </Reveal>
      </div>
    </>
  );
}
