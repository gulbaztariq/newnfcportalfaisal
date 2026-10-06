import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { IdCard, Eye, MessageSquareText, Sparkles, Plus, ArrowUpRight, Monitor, Smartphone, Tablet, Nfc, Crown } from 'lucide-react';
import api from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { fmtDate, fmtDateTime } from '@/lib/format';
import { PageHeader, StatCard, Card, CardHeader, CardBody, ButtonLink, EmptyState, Skeleton, Reveal, Ripples } from '@/components/ui';
import { Bars, Donut } from '@/components/ui/charts';

export default function UserDashboard() {
  const { user } = useAuth();
  const [d, setD] = useState(null);
  useEffect(() => { api.get('/user/dashboard').then((r) => setD(r.data)); }, []);
  if (!d) return <div className="space-y-6"><Skeleton className="h-44 rounded-3xl" /><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-32 rounded-2xl" />)}</div></div>;
  const sub = d.subscription;
  const days = sub ? Math.max(0, Math.ceil((new Date(sub.ends_at) - Date.now()) / 864e5)) : 0;
  const chart = d.chart.labels.map((label, i) => ({ label, value: d.chart.data[i] }));
  const devices = Object.entries(d.devices).map(([name, value]) => ({ name: name[0].toUpperCase() + name.slice(1), value }));
  return (
    <>
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="relative mb-6 overflow-hidden rounded-3xl bg-zinc-950 p-8 text-white md:p-10">
        <div className="absolute -top-24 -right-10 size-80 rounded-full bg-violet-600/50 blur-[100px]" />
        <div className="absolute -bottom-24 left-1/3 size-72 rounded-full bg-fuchsia-600/40 blur-[100px]" />
        <div className="bg-grid absolute inset-0 opacity-15" />
        <div className="relative flex flex-wrap items-center justify-between gap-6">
          <div>
            <p className="text-sm text-white/60">Welcome back</p>
            <h1 className="mt-1 font-display text-3xl font-bold md:text-4xl">Hey {user.first_name} 👋</h1>
            <p className="mt-2 max-w-md text-white/65">Your cards were viewed <b className="text-white">{d.stats.views.toLocaleString()}</b> times. Keep sharing!</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <ButtonLink as={Link} to="/user/vcards/create" variant="white"><Plus />New vCard</ButtonLink>
              <ButtonLink as={Link} to="/user/nfc-orders" className="border border-white/20 bg-white/10 text-white hover:bg-white/20"><Nfc />Order NFC card</ButtonLink>
            </div>
          </div>
          <div className="relative hidden size-40 md:block"><Ripples color="bg-white/10" /><span className="absolute inset-0 m-auto grid size-20 place-items-center rounded-full bg-linear-to-br from-violet-500 to-fuchsia-500 shadow-2xl"><Nfc className="size-9" /></span></div>
        </div>
      </motion.div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard index={0} icon={IdCard} color="violet" label="My vCards" value={d.stats.vcards} hint={`${d.stats.active} published`} to="/user/vcards" />
        <StatCard index={1} icon={Eye} color="pink" label="Total views" value={d.stats.views} />
        <StatCard index={2} icon={MessageSquareText} color="sky" label="Enquiries" value={d.stats.enquiries} to="/user/enquiries" />
        <StatCard index={3} icon={Crown} color="amber" label="Plan" value={sub?.plan?.name || 'None'} hint={sub ? `${days} days left` : undefined} to="/user/plans" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Reveal className="xl:col-span-2">
          <Card className="h-full"><CardHeader icon={Eye} title="Views" description="Last 30 days across all your cards" /><CardBody><Bars data={chart} name="Views" height={290} /></CardBody></Card>
        </Reveal>
        <Reveal delay={0.1}>
          <Card className="h-full">
            <CardHeader icon={Monitor} title="Devices" description="Where visitors open your cards" />
            <CardBody>{devices.length ? <Donut data={devices} center="views" height={220} /> : <EmptyState icon={Smartphone} title="No views yet" description="Share your card link or QR code to see stats here." />}</CardBody>
          </Card>
        </Reveal>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Reveal className="xl:col-span-2">
          <Card className="overflow-hidden">
            <CardHeader icon={MessageSquareText} title="Latest enquiries" actions={<Link to="/user/enquiries" className="text-sm font-medium text-primary hover:underline">View all</Link>} />
            {!d.recentEnquiries.length ? <EmptyState icon={MessageSquareText} title="No enquiries yet" description="Messages from your card's contact form appear here." /> : (
              <ul className="divide-y divide-border">
                {d.recentEnquiries.map((e) => (
                  <li key={e.id} className="flex items-start gap-3 px-5 py-4">
                    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary-soft font-semibold text-primary">{e.name[0]}</span>
                    <div className="min-w-0 flex-1"><p className="text-sm font-medium">{e.name} <span className="font-normal text-muted-foreground">via {e.vcard?.name}</span></p><p className="truncate text-sm text-muted-foreground">{e.message}</p></div>
                    <span className="text-xs whitespace-nowrap text-muted-foreground">{fmtDateTime(e.created_at)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </Reveal>
        <Reveal delay={0.1}>
          <Card className="relative h-full overflow-hidden p-6">
            <div className="absolute -top-10 -right-10 size-40 rounded-full bg-primary/15 blur-2xl" />
            <Sparkles className="size-6 text-primary" />
            <p className="mt-3 font-display text-xl font-bold">{sub?.plan?.name || 'No active'} plan</p>
            {sub ? (
              <>
                <p className="text-sm text-muted-foreground">Renews on {fmtDate(sub.ends_at)}</p>
                <div className="mt-5 space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">vCards used</span><span className="font-medium">{d.stats.vcards} / {sub.plan.no_of_vcards}</span></div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted"><motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(100, (d.stats.vcards / sub.plan.no_of_vcards) * 100)}%` }} transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }} className="h-full rounded-full bg-linear-to-r from-violet-500 to-fuchsia-500" /></div>
                </div>
              </>
            ) : <p className="text-sm text-muted-foreground">Choose a plan to create cards.</p>}
            <ButtonLink as={Link} to="/user/plans" variant="soft" className="mt-6 w-full">Upgrade plan <ArrowUpRight /></ButtonLink>
          </Card>
        </Reveal>
      </div>
    </>
  );
}

export { Tablet };
