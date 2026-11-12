import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { MessageSquareText, Sparkles, Plus, ArrowUpRight, Nfc, Pencil, ChevronDown } from 'lucide-react';
import api from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { fmtDate, fmtDateTime } from '@/lib/format';
import { Card, CardHeader, CardBody, ButtonLink, EmptyState, Skeleton, Reveal, Ripples, Segmented, Menu, MenuTrigger, MenuContent, MenuItem, MenuLabel } from '@/components/ui';
import { AnalyticsDashboard } from './Analytics';

export default function UserDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [d, setD] = useState(null);
  const [scope, setScope] = useState('mine');
  const isCompany = !!user.is_organisation || ['manager', 'supervisor'].includes(user.company_role);
  useEffect(() => { api.get('/user/dashboard').then((r) => setD(r.data)); }, []);
  if (!d) return <div className="space-y-6"><Skeleton className="h-44 rounded-3xl" /><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-32 rounded-2xl" />)}</div></div>;
  const sub = d.subscription;
  const days = sub ? Math.max(0, Math.ceil((new Date(sub.ends_at) - Date.now()) / 864e5)) : 0;
    return (
    <>
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="relative mb-8 overflow-hidden rounded-3xl bg-zinc-950 p-6 text-white md:p-8">
        <div className="absolute -top-24 -right-10 size-80 rounded-full bg-violet-600/50 blur-[100px]" />
        <div className="absolute -bottom-24 left-1/3 size-72 rounded-full bg-fuchsia-600/40 blur-[100px]" />
        <div className="bg-grid absolute inset-0 opacity-15" />
        <div className="relative flex flex-wrap items-center justify-between gap-6">
          <div>
            <p className="text-sm text-white/60">Welcome back</p>
            <h1 className="mt-1 font-display text-3xl font-bold md:text-4xl">Hey {user.first_name} 👋</h1>
            <p className="mt-2 max-w-md text-white/65">Here is how your cards are performing. Share your link, QR code or NFC card to grow these numbers.</p>
            <div className="mt-6 flex flex-wrap gap-3">
              {d.vcards?.length === 1 && <ButtonLink as={Link} to={`/user/vcards/${d.vcards[0].id}/edit`} variant="white"><Pencil />Edit my vCard</ButtonLink>}
              {d.vcards?.length > 1 && (
                <Menu>
                  <MenuTrigger asChild><button type="button" className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-xl bg-white px-5 text-sm font-medium text-zinc-900 transition hover:bg-white/90"><Pencil className="size-4" />Edit a vCard<ChevronDown className="size-4 opacity-60" /></button></MenuTrigger>
                  <MenuContent align="start">
                    <MenuLabel>Choose a card to edit</MenuLabel>
                    {d.vcards.map((v) => <MenuItem key={v.id} icon={Pencil} onSelect={() => navigate(`/user/vcards/${v.id}/edit`)}>{v.name}{!v.live && ' (hidden)'}</MenuItem>)}
                  </MenuContent>
                </Menu>
              )}
              <ButtonLink as={Link} to="/user/vcards/create" variant={d.vcards?.length ? 'ghost' : 'white'} className={d.vcards?.length ? 'border border-white/20 bg-white/10 text-white hover:bg-white/20' : ''}><Plus />New vCard</ButtonLink>
              <ButtonLink as={Link} to="/user/nfc-orders" className="border border-white/20 bg-white/10 text-white hover:bg-white/20"><Nfc />Order NFC card</ButtonLink>
            </div>
          </div>
          <div className="relative hidden size-40 md:block"><Ripples color="bg-white/10" /><span className="absolute inset-0 m-auto grid size-20 place-items-center rounded-full bg-linear-to-br from-violet-500 to-fuchsia-500 shadow-2xl"><Nfc className="size-9" /></span></div>
        </div>
      </motion.div>

      {/* the dashboard is the analytics dashboard: headline numbers, traffic, sources, heatmap, top cards */}
      {isCompany && <div className="mb-5 flex justify-end"><Segmented id="dash-scope" size="sm" value={scope} onChange={setScope} options={[{ value: 'mine', label: 'My cards' }, { value: 'company', label: 'Whole company' }]} /></div>}
      {scope === 'company' && isCompany ? <AnalyticsDashboard key="company" endpoint="/user/analytics/company" company embedded /> : <AnalyticsDashboard key="mine" endpoint="/user/analytics" embedded />}

      <div className="mt-8 grid gap-6 xl:grid-cols-3">
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

