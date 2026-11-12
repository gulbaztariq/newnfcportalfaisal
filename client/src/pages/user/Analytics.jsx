import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom';
import { motion } from 'motion/react';
import { ResponsiveContainer, ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, AreaChart, PieChart, Pie, Cell } from 'recharts';
import { Eye, Users, MousePointerClick, UserPlus, MessageSquareText, Percent, TrendingUp, TrendingDown, Minus, Download, Lightbulb, Globe2, Smartphone, Clock, Filter, Link2, BarChart3, Share2, AlertTriangle, Info, CheckCircle2, ExternalLink, RefreshCw } from 'lucide-react';
import api from '@/lib/api';
import { cn } from '@/lib/cn';
import { PageHeader, Card, CardHeader, CardBody, Segmented, Select, Button, Badge, Skeleton, EmptyState, Tip, CountUp } from '@/components/ui';
import { CHART_COLORS } from '@/components/ui/charts';

const PERIODS = [{ value: '7', label: '7 days' }, { value: '30', label: '30 days' }, { value: '90', label: '90 days' }, { value: '365', label: 'Year' }];
const nf = new Intl.NumberFormat('en-US');
const compact = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 });
const tzNow = () => -new Date().getTimezoneOffset();
const hourLabel = (h) => `${((h + 11) % 12) + 1}${h < 12 ? 'a' : 'p'}`;
const WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/* ------------------------------------------------------------------ small pieces */
/** ▲ 12.4% / ▼ 3% / — : `invert` for numbers where lower is better */
function Delta({ change, unit = '%', invert, className }) {
  if (change === null || change === undefined) return <span className={cn('inline-flex h-5 items-center rounded-full bg-muted px-2 text-[11px] font-medium text-muted-foreground', className)}>New</span>;
  const up = change > 0; const flat = change === 0;
  const good = invert ? !up : up;
  const Icon = flat ? Minus : up ? TrendingUp : TrendingDown;
  return (
    <span className={cn('inline-flex h-5 items-center gap-1 rounded-full px-2 text-[11px] font-semibold', flat ? 'bg-muted text-muted-foreground' : good ? 'bg-success-soft text-success' : 'bg-danger-soft text-danger', className)}>
      <Icon className="size-3" />{flat ? '0' : `${up ? '+' : ''}${change}`}{unit}
    </span>
  );
}

function Spark({ data, k, color = 'var(--primary)' }) {
  return (
    <div className="h-10 w-full" aria-hidden="true">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
          <defs><linearGradient id={`sp-${k}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity={0.35} /><stop offset="100%" stopColor={color} stopOpacity={0} /></linearGradient></defs>
          <Area type="monotone" dataKey={k} stroke={color} strokeWidth={2} fill={`url(#sp-${k})`} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

const KPI_TILE = { violet: 'from-violet-500 to-fuchsia-500', pink: 'from-pink-500 to-rose-500', sky: 'from-sky-500 to-cyan-500', emerald: 'from-emerald-500 to-teal-500', amber: 'from-amber-500 to-orange-500', indigo: 'from-indigo-500 to-blue-500' };
/** every KPI card has the same structure and height: label + icon, number, change, sparkline */
function Kpi({ icon: Icon, label, hint, k, kpi, series, color, index, unit, spark, suffix }) {
  return (
    <motion.div className="h-full" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05, duration: 0.45, ease: [0.16, 1, 0.3, 1] }}>
      <Card className="flex h-full min-h-[10.5rem] flex-col p-4">
        <div className="flex items-start justify-between gap-2">
          <p className="flex items-center gap-1 text-[13px] font-medium text-muted-foreground">{label}{hint && <Tip content={hint}><Info className="size-3.5 cursor-help opacity-60" aria-label={hint} /></Tip>}</p>
          <span className={cn('grid size-8 shrink-0 place-items-center rounded-xl bg-linear-to-br text-white shadow-sm', KPI_TILE[color])}><Icon className="size-4" /></span>
        </div>
        <p className="mt-2 font-display text-[1.75rem] leading-none font-bold tracking-tight">{unit === '%' ? <>{kpi.value}<span className="text-lg">%</span></> : <CountUp value={kpi.value} format={(v) => nf.format(Math.round(v))} />}{suffix}</p>
        <div className="mt-2 flex items-center gap-2"><Delta change={kpi.change} unit={unit === '%' ? ' pts' : '%'} /><span className="truncate text-[11px] text-muted-foreground">vs {nf.format(kpi.previous)}{unit === '%' ? '%' : ''} before</span></div>
        <div className="mt-auto pt-2">{spark ? <Spark data={series} k={k} color={`var(--chart-${color}, var(--primary))`} /> : <div className="h-10" />}</div>
      </Card>
    </motion.div>
  );
}

function Section({ icon, title, description, actions, className, children, bodyClass }) {
  return (
    <Card className={cn('flex h-full flex-col', className)}>
      <CardHeader icon={icon} title={title} description={description} actions={actions} />
      <CardBody className={cn('flex-1', bodyClass)}>{children}</CardBody>
    </Card>
  );
}

/** ranked list with a bar behind each row */
function BarList({ rows, total, color = 'var(--primary)', empty = 'No data yet', format = nf.format }) {
  if (!rows?.length) return <p className="py-8 text-center text-sm text-muted-foreground">{empty}</p>;
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <ul className="space-y-3">
      {rows.map((r, i) => (
        <li key={r.name}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-sm"><span className="min-w-0 truncate font-medium">{r.name}</span><span className="shrink-0 tabular-nums text-muted-foreground">{format(r.value)}{total ? <span className="ml-1.5 text-xs">{Math.round((r.value / total) * 100)}%</span> : null}</span></div>
          <div className="h-2 overflow-hidden rounded-full bg-muted"><motion.div className="h-full rounded-full" style={{ background: color, opacity: 1 - i * 0.07 }} initial={{ width: 0 }} animate={{ width: `${(r.value / max) * 100}%` }} transition={{ delay: i * 0.05, duration: 0.7, ease: [0.16, 1, 0.3, 1] }} /></div>
        </li>
      ))}
    </ul>
  );
}

function DonutLegend({ rows, center, centerLabel }) {
  const total = rows.reduce((a, r) => a + r.value, 0);
  if (!total) return <p className="py-8 text-center text-sm text-muted-foreground">No data yet</p>;
  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row">
      <div className="relative size-40 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart><Pie data={rows} dataKey="value" nameKey="name" innerRadius={52} outerRadius={74} paddingAngle={2} stroke="none" animationDuration={900}>{rows.map((r, i) => <Cell key={r.name} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}</Pie><Tooltip formatter={(v, n) => [nf.format(v), n]} contentStyle={{ borderRadius: 12, border: '1px solid var(--border)', background: 'var(--card)', fontSize: 12 }} /></PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-center"><div><p className="font-display text-xl font-bold">{compact.format(center ?? total)}</p><p className="text-[11px] text-muted-foreground">{centerLabel}</p></div></div>
      </div>
      <ul className="w-full min-w-0 flex-1 space-y-2">
        {rows.map((r, i) => (
          <li key={r.name} className="flex items-center gap-2 text-sm"><span className="size-2.5 shrink-0 rounded-full" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} /><span className="min-w-0 flex-1 leading-tight break-words" title={r.name}>{r.name}</span><span className="tabular-nums text-muted-foreground">{Math.round((r.value / total) * 100)}%</span></li>
        ))}
      </ul>
    </div>
  );
}

/** weekday x hour grid: darker = more views. Scrolls sideways on small screens */
function Heatmap({ grid }) {
  const max = Math.max(1, ...grid.flat());
  return (
    <div className="overflow-x-auto pb-1">
      <div className="min-w-[620px]" role="img" aria-label="Views by weekday and hour of the day">
        <div className="ml-10 grid grid-cols-24 gap-[3px] text-[10px] text-muted-foreground" style={{ gridTemplateColumns: 'repeat(24, minmax(0, 1fr))' }}>
          {Array.from({ length: 24 }, (_, h) => <span key={h} className="text-center">{h % 3 === 0 ? hourLabel(h) : ''}</span>)}
        </div>
        {grid.map((row, d) => (
          <div key={d} className="mt-[3px] flex items-center gap-1.5">
            <span className="w-8 shrink-0 text-[11px] font-medium text-muted-foreground">{WEEK[d]}</span>
            <div className="grid flex-1 gap-[3px]" style={{ gridTemplateColumns: 'repeat(24, minmax(0, 1fr))' }}>
              {row.map((n, h) => (
                <span key={h} title={`${WEEK[d]} ${hourLabel(h)}: ${n} view${n === 1 ? '' : 's'}`} className="aspect-square rounded-[4px] transition hover:ring-2 hover:ring-primary/50"
                  style={{ background: n ? `color-mix(in srgb, var(--primary) ${12 + Math.round((n / max) * 88)}%, var(--muted))` : 'var(--muted)' }} />
              ))}
            </div>
          </div>
        ))}
        <div className="mt-3 flex items-center justify-end gap-2 text-[11px] text-muted-foreground">Fewer<span className="flex gap-[3px]">{[0, 25, 50, 75, 100].map((p) => <i key={p} className="size-3.5 rounded-[4px]" style={{ background: p ? `color-mix(in srgb, var(--primary) ${12 + p * 0.88}%, var(--muted))` : 'var(--muted)' }} />)}</span>More</div>
      </div>
    </div>
  );
}

function TrafficChart({ series, metric }) {
  const names = { views: 'Views', visitors: 'Visitors', actions: 'Actions', leads: 'Leads' };
  const tick = series.length > 45 ? Math.ceil(series.length / 12) - 1 : series.length > 14 ? 3 : 0;
  return (
    <ResponsiveContainer width="100%" height={320}>
      <ComposedChart data={series} margin={{ top: 10, right: 8, left: -12, bottom: 0 }}>
        <defs><linearGradient id="tr-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--primary)" stopOpacity={0.32} /><stop offset="100%" stopColor="var(--primary)" stopOpacity={0} /></linearGradient></defs>
        <CartesianGrid strokeDasharray="4 4" vertical={false} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={10} interval={tick} />
        <YAxis tickLine={false} axisLine={false} allowDecimals={false} width={52} tickFormatter={(v) => compact.format(v)} />
        <Tooltip content={({ active, payload, label }) => active && payload?.length ? (
          <div className="rounded-xl border border-border bg-card/95 px-3 py-2 text-xs shadow-lift backdrop-blur"><p className="mb-1 font-medium text-muted-foreground">{label}</p>
            {payload.map((p) => <p key={p.dataKey} className="font-semibold"><span className="mr-1.5 inline-block size-2 rounded-full" style={{ background: p.color }} />{p.dataKey === 'previous' ? 'Previous period' : names[metric]}: {nf.format(p.value)}</p>)}</div>
        ) : null} />
        {metric === 'views' && <Line type="monotone" dataKey="previous" stroke="var(--muted-foreground)" strokeDasharray="5 5" strokeWidth={1.5} dot={false} isAnimationActive={false} />}
        <Area type="monotone" dataKey={metric} stroke="var(--primary)" strokeWidth={2.5} fill="url(#tr-fill)" animationDuration={900} activeDot={{ r: 5, strokeWidth: 3, stroke: 'var(--card)' }} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

function Funnel({ steps }) {
  const top = Math.max(steps[0]?.value || 0, 1);
  return (
    <ol className="space-y-3">
      {steps.map((s, i) => {
        const prev = i ? steps[i - 1].value : null;
        return (
          <li key={s.name}>
            <div className="mb-1 flex items-baseline justify-between text-sm"><span className="font-medium">{s.name}</span><span className="tabular-nums text-muted-foreground">{nf.format(s.value)}{i > 0 && prev > 0 ? <span className="ml-2 text-xs">{Math.round((s.value / prev) * 100)}% of previous step</span> : null}</span></div>
            <div className="h-7 overflow-hidden rounded-lg bg-muted"><motion.div className="flex h-full items-center rounded-lg px-2 text-[11px] font-semibold text-white" style={{ background: CHART_COLORS[i % CHART_COLORS.length], minWidth: s.value ? 28 : 0 }} initial={{ width: 0 }} animate={{ width: `${(s.value / top) * 100}%` }} transition={{ delay: i * 0.1, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}>{s.value && s.value / top > 0.12 ? `${Math.round((s.value / top) * 100)}%` : ''}</motion.div></div>
          </li>
        );
      })}
    </ol>
  );
}

const TONE = { good: [CheckCircle2, 'text-success bg-success-soft'], warn: [AlertTriangle, 'text-warning bg-warning-soft'], info: [Info, 'text-primary bg-primary-soft'] };

/* ------------------------------------------------------------------ CSV */
function exportCsv(d, name) {
  const rows = [['Date', 'Views', 'Visitors', 'Actions', 'Leads', 'Previous period views'], ...d.series.map((p) => [p.date, p.views, p.visitors, p.actions, p.leads, p.previous])];
  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); a.download = `${name}-${d.range.from}-to-${d.range.to}.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

/* ------------------------------------------------------------------ the dashboard */
/**
 * @param endpoint  '/user/analytics' or '/admin/dashboard/card-analytics'
 * @param admin     platform view: no card picker, shows platform totals
 */
export function AnalyticsDashboard({ endpoint, admin = false, initialCard = 'all' }) {
  const [days, setDays] = useState('30');
  const [card, setCard] = useState(initialCard);
  const [res, setRes] = useState(null);
  const [err, setErr] = useState(null);
  const [metric, setMetric] = useState('views');
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let live = true; setErr(null);
    api.get(endpoint, { params: { days, vcard: card === 'all' ? undefined : card, tz: tzNow() } }).then(({ data }) => { if (live) setRes(data); }).catch((e) => { if (live) setErr(e.message || 'Could not load analytics'); });
    return () => { live = false; };
  }, [endpoint, days, card, tick]);
  const d = res?.data;
  const cards = res?.cards || [];
  const cardName = card === 'all' ? (admin ? 'all cards' : 'all your cards') : cards.find((c) => String(c.id) === String(card))?.name || 'this card';
  const periodText = d ? `${new Date(d.range.from).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} - ${new Date(d.range.to).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}` : '';

  const controls = (
    <div className="flex flex-wrap items-center gap-2">
      {!admin && cards.length > 1 && <div className="w-52"><Select value={String(card)} onChange={(x) => { setRes(null); setCard(x || 'all'); }} options={[{ value: 'all', label: 'All cards' }, ...cards.map((c) => ({ value: String(c.id), label: c.name }))]} /></div>}
      <Segmented id="an-period" size="sm" value={days} onChange={(x) => { setRes(null); setDays(x); }} options={PERIODS} />
      <Tip content="Refresh"><Button variant="outline" size="icon" onClick={() => { setRes(null); setTick((n) => n + 1); }} aria-label="Refresh"><RefreshCw /></Button></Tip>
      <Button variant="outline" onClick={() => d && exportCsv(d, `analytics-${cardName.replace(/\W+/g, '-')}`)} disabled={!d?.series?.length}><Download />Export CSV</Button>
    </div>
  );

  return (
    <>
      <PageHeader title={admin ? 'Card analytics' : 'Analytics'} description={d ? `${cardName[0].toUpperCase()}${cardName.slice(1)} · ${periodText} · compared with the ${days} days before` : 'How visitors find and use your digital cards.'}>{controls}</PageHeader>

      {err ? <Card><EmptyState icon={AlertTriangle} title="Could not load analytics" description={err} action={<Button onClick={() => setTick((n) => n + 1)}>Try again</Button>} /></Card>
        : !d ? <AnalyticsSkeleton />
          : !cards.length && !admin ? <Card><EmptyState icon={BarChart3} title="Create a card to see analytics" description="Views, taps and leads appear here as soon as people open your card." action={<Button as={Link} to="/user/vcards/create">Create a card</Button>} /></Card>
            : (
              <div className="space-y-6">
                {!d.hasData && (
                  <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-primary/25 bg-primary-soft p-4">
                    <span className="grid size-10 place-items-center rounded-xl bg-primary text-white"><Lightbulb className="size-5" /></span>
                    <div className="min-w-0 flex-1"><p className="font-medium">No activity in this period yet</p><p className="text-sm text-muted-foreground">Share your card link, show its QR code or tap an NFC card. Views appear here within seconds; taps on buttons and links are counted as actions.</p></div>
                    {card !== 'all' && cards.find((c) => String(c.id) === String(card)) && <Button variant="outline" as="a" href={`/${cards.find((c) => String(c.id) === String(card)).alias}`} target="_blank" rel="noreferrer"><ExternalLink />Open card</Button>}
                  </div>
                )}

                {/* headline numbers: six cards, one grid, one height */}
                <div className="grid auto-rows-fr gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
                  <Kpi index={0} icon={Eye} color="violet" label="Views" hint="Times a card was opened. The same visitor counts once per 30 minutes; bots are ignored." k="views" kpi={d.kpis.views} series={d.series} spark />
                  <Kpi index={1} icon={Users} color="sky" label="Visitors" hint="Distinct visitors, counted by an anonymised network address." k="visitors" kpi={d.kpis.visitors} series={d.series} spark />
                  <Kpi index={2} icon={MousePointerClick} color="pink" label="Actions" hint="Taps on call, e-mail, WhatsApp, directions, share, social and custom links, plus saved contacts." k="actions" kpi={d.kpis.actions} series={d.series} spark />
                  <Kpi index={3} icon={UserPlus} color="emerald" label="Contacts saved" hint="Times the contact file (.vcf) was downloaded." kpi={d.kpis.saves} series={d.series} />
                  <Kpi index={4} icon={MessageSquareText} color="amber" label="Leads" hint="Enquiries, appointment bookings and newsletter sign-ups." k="leads" kpi={d.kpis.leads} series={d.series} spark />
                  <Kpi index={5} icon={Percent} color="indigo" label="Engagement" hint="Share of views where the same visitor did at least one action on the same day." unit="%" kpi={d.kpis.engagement} series={d.series} />
                </div>

                <div className="grid gap-6 xl:grid-cols-3">
                  <Section className="xl:col-span-2" icon={BarChart3} title="Traffic over time" description="Dashed line: the previous period (views)"
                    actions={<Segmented id="an-metric" size="sm" value={metric} onChange={setMetric} options={[{ value: 'views', label: 'Views' }, { value: 'visitors', label: 'Visitors' }, { value: 'actions', label: 'Actions' }, { value: 'leads', label: 'Leads' }]} />}>
                    {d.series.length ? <TrafficChart series={d.series} metric={metric} /> : <p className="py-16 text-center text-sm text-muted-foreground">No data</p>}
                  </Section>
                  <Section icon={Lightbulb} title="Insights" description="Plain-language read-out of your numbers">
                    <ul className="space-y-3">
                      {d.insights.map((x, i) => { const [I, c] = TONE[x.tone] || TONE.info; return <li key={i} className="flex gap-3 text-sm"><span className={cn('grid size-7 shrink-0 place-items-center rounded-lg', c)}><I className="size-4" /></span><span className="pt-0.5 leading-snug">{x.text}</span></li>; })}
                      {!d.insights.length && <li className="text-sm text-muted-foreground">Insights appear once your cards have some traffic.</li>}
                    </ul>
                  </Section>
                </div>

                <div className="grid gap-6 xl:grid-cols-3">
                  <Section icon={Filter} title="Conversion funnel" description="From opening the card to becoming a lead"><Funnel steps={d.funnel} /></Section>
                  <Section icon={Share2} title="What visitors do" description="Taps on buttons and links, with change vs previous period">
                    {d.actions.length ? (
                      <ul className="space-y-3">{d.actions.map((a) => { const total = d.kpis.actions.value || 1; return (
                        <li key={a.type}><div className="mb-1 flex items-center justify-between gap-2 text-sm"><span className="font-medium">{a.name}</span><span className="flex items-center gap-2 tabular-nums"><span className="text-muted-foreground">{nf.format(a.value)}</span><Delta change={a.previous ? Math.round(((a.value - a.previous) / a.previous) * 1000) / 10 : a.value ? null : 0} /></span></div><div className="h-2 overflow-hidden rounded-full bg-muted"><motion.div className="h-full rounded-full bg-primary" initial={{ width: 0 }} animate={{ width: `${Math.min(100, (a.value / total) * 100)}%` }} transition={{ duration: 0.7 }} /></div></li>); })}</ul>
                    ) : <p className="py-8 text-center text-sm text-muted-foreground">No taps recorded yet. They appear when visitors press call, e-mail, WhatsApp, directions, share or a link.</p>}
                  </Section>
                  <Section icon={Link2} title="Top links" description="Most tapped social and custom links"><BarList rows={d.topLinks} total={d.topLinks.reduce((a, b) => a + b.value, 0)} empty="No link taps yet" /></Section>
                </div>

                <div className="grid gap-6 xl:grid-cols-3">
                  <Section icon={Globe2} title="Where visitors come from" description="Direct includes NFC taps, QR scans and typed or shared links"><DonutLegend rows={d.channels} center={d.kpis.views.value} centerLabel="views" /></Section>
                  <Section icon={ExternalLink} title="Top sources" description="Websites and apps that sent visitors"><BarList rows={d.sources} total={d.kpis.views.value} /></Section>
                  <Section icon={Smartphone} title="Devices" description="What visitors use"><DonutLegend rows={d.devices} center={d.kpis.views.value} centerLabel="views" /></Section>
                </div>

                <div className="grid gap-6 xl:grid-cols-3">
                  <Section className="xl:col-span-2" icon={Clock} title="When people open your card" description="Views by weekday and hour, in your local time"><Heatmap grid={d.heatmap} /></Section>
                  <div className="grid gap-6">
                    <Section icon={Smartphone} title="Browsers"><BarList rows={d.browsers} total={d.kpis.views.value} /></Section>
                    <Section icon={Smartphone} title="Operating systems"><BarList rows={d.systems} total={d.kpis.views.value} /></Section>
                  </div>
                </div>

                <Card>
                  <CardHeader icon={Eye} title={admin ? 'Top cards' : 'Your cards'} description="Ranked by views in this period" />
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[640px] text-sm">
                      <thead><tr className="border-y border-border bg-muted/40 text-left text-xs text-muted-foreground"><th className="px-5 py-2.5 font-medium">Card</th><th className="px-3 py-2.5 text-right font-medium">Views</th><th className="px-3 py-2.5 text-right font-medium">Change</th><th className="px-3 py-2.5 text-right font-medium">Visitors</th><th className="px-3 py-2.5 text-right font-medium">Actions</th><th className="px-3 py-2.5 text-right font-medium">Saved</th><th className="px-3 py-2.5 text-right font-medium">Leads</th><th className="px-5 py-2.5 text-right font-medium">Action rate</th></tr></thead>
                      <tbody>
                        {d.topCards.map((c) => (
                          <tr key={c.id} className="border-b border-border/60 last:border-0 hover:bg-muted/30">
                            <td className="px-5 py-3"><a href={`/${c.alias}`} target="_blank" rel="noreferrer" className="font-medium hover:text-primary">{c.name}</a><p className="text-xs text-muted-foreground">/{c.alias}{!c.live && <Badge tone="warning" className="ml-2">Hidden</Badge>}</p></td>
                            <td className="px-3 py-3 text-right font-semibold tabular-nums">{nf.format(c.views)}</td><td className="px-3 py-3 text-right"><Delta change={c.change} /></td>
                            <td className="px-3 py-3 text-right tabular-nums">{nf.format(c.visitors)}</td><td className="px-3 py-3 text-right tabular-nums">{nf.format(c.actions)}</td><td className="px-3 py-3 text-right tabular-nums">{nf.format(c.saves)}</td><td className="px-3 py-3 text-right tabular-nums">{nf.format(c.leads)}</td>
                            <td className="px-5 py-3 text-right tabular-nums">{c.conversion === null ? '-' : `${c.conversion}%`}</td>
                          </tr>
                        ))}
                        {!d.topCards.length && <tr><td colSpan={8} className="px-5 py-10 text-center text-muted-foreground">No card activity in this period</td></tr>}
                      </tbody>
                    </table>
                  </div>
                </Card>

                <p className="flex items-start gap-2 text-xs text-muted-foreground"><Info className="mt-0.5 size-3.5 shrink-0" /><span>Visitors are counted by an anonymised, salted hash of the network address. No cookies are set and no personal data is stored. Times use your local time zone. {d.truncated && 'This period has more activity than can be shown in full, so the oldest data is left out.'}</span></p>
              </div>
            )}
    </>
  );
}

function AnalyticsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid auto-rows-fr gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-[10.5rem] rounded-2xl" />)}</div>
      <div className="grid gap-6 xl:grid-cols-3"><Skeleton className="h-[26rem] rounded-2xl xl:col-span-2" /><Skeleton className="h-[26rem] rounded-2xl" /></div>
      <div className="grid gap-6 xl:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-72 rounded-2xl" />)}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ routes */
export function UserAnalytics() {
  const [params] = useSearchParams();
  return <AnalyticsDashboard endpoint="/user/analytics" initialCard={params.get('card') || 'all'} />;
}
export function AdminCardAnalytics() { return <AnalyticsDashboard endpoint="/admin/dashboard/card-analytics" admin />; }
/** the old per-card address now opens the new dashboard filtered to that card */
export function LegacyCardAnalytics() { const { id } = useParams(); return <Navigate to={`/user/analytics?card=${id}`} replace />; }
