import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom';
import { motion } from 'motion/react';
import { ResponsiveContainer, ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, AreaChart, PieChart, Pie, Cell, BarChart, Bar } from 'recharts';
import { Eye, Users, MousePointerClick, UserPlus, MessageSquareText, Percent, TrendingUp, TrendingDown, Minus, Download, Lightbulb, Globe2, Smartphone, Clock, Filter, Link2, BarChart3, Share2, AlertTriangle, Info, CheckCircle2, ExternalLink, RefreshCw, ChevronDown, X, Printer, SlidersHorizontal, Search, ArrowUp, ArrowDown, ArrowUpDown, Repeat, Target, Layers, CalendarDays, Building2, Armchair, UserCheck, IdCard, Trophy } from 'lucide-react';
import api from '@/lib/api';
import { cn } from '@/lib/cn';
import { PageHeader, Card, CardHeader, CardBody, Segmented, Select, Button, Badge, Skeleton, EmptyState, Tip, CountUp, Input, Menu, MenuTrigger, MenuContent, MenuItem, MenuLabel, MenuSeparator } from '@/components/ui';
import { CHART_COLORS } from '@/components/ui/charts';

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
function Kpi({ icon: Icon, label, hint, k, kpi, series, color, index, unit, spark, suffix, off }) {
  return (
    <motion.div className="h-full" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05, duration: 0.45, ease: [0.16, 1, 0.3, 1] }}>
      <Card className="flex h-full min-h-[10.5rem] flex-col p-4">
        <div className="flex items-start justify-between gap-2">
          <p className="flex items-center gap-1 text-[13px] font-medium text-muted-foreground">{label}{hint && <Tip content={hint}><Info className="size-3.5 cursor-help opacity-60" aria-label={hint} /></Tip>}</p>
          <span className={cn('grid size-8 shrink-0 place-items-center rounded-xl bg-linear-to-br text-white shadow-sm', KPI_TILE[color])}><Icon className="size-4" /></span>
        </div>
        <p className="mt-2 font-display text-[1.75rem] leading-none font-bold tracking-tight">{unit === '%' ? <>{kpi.value}<span className="text-lg">%</span></> : <CountUp value={kpi.value} format={(v) => nf.format(Math.round(v))} />}{suffix}</p>
        <div className="mt-2 flex items-center gap-2">{off ? <span className="text-[11px] text-muted-foreground">Comparison off</span> : <><Delta change={kpi.change} unit={unit === '%' ? ' pts' : '%'} /><span className="truncate text-[11px] text-muted-foreground">vs {nf.format(kpi.previous)}{unit === '%' ? '%' : ''} before</span></>}</div>
        <div className="mt-auto pt-2">{spark ? <Spark data={series} k={k} color={`var(--chart-${color}, var(--primary))`} /> : <div className="h-10" />}</div>
      </Card>
    </motion.div>
  );
}

function Section({ icon, title, description, actions, className, children, bodyClass }) {
  return (
    <Card className={cn('flex h-full min-w-0 flex-col', className)}>
      <CardHeader icon={icon} title={title} description={description} actions={actions} />
      <CardBody className={cn('flex-1', bodyClass)}>{children}</CardBody>
    </Card>
  );
}

function Row({ onPick, on, children }) {
  return onPick ? <button type="button" onClick={onPick} aria-pressed={!!on} className={cn('-mx-2 block w-[calc(100%+1rem)] rounded-lg px-2 py-1 text-left transition hover:bg-muted/60', on && 'bg-primary-soft')}>{children}</button> : <div>{children}</div>;
}

/** ranked list with a bar behind each row (click a row to filter) */
function BarList({ rows, total, color = 'var(--primary)', empty = 'No data yet', format = nf.format, onPick, active }) {
  if (!rows?.length) return <p className="py-8 text-center text-sm text-muted-foreground">{empty}</p>;
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <ul className="space-y-3">
      {rows.map((r, i) => (
        <li key={r.name}>
          <Row onPick={onPick && r.name !== 'Other' && r.name !== 'Unknown' ? () => onPick(r.name) : null} on={active === r.name}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-sm"><span className="min-w-0 truncate font-medium">{r.name}</span><span className="shrink-0 tabular-nums text-muted-foreground">{format(r.value)}{total ? <span className="ml-1.5 text-xs">{Math.round((r.value / total) * 100)}%</span> : null}</span></div>
          <div className="h-2 overflow-hidden rounded-full bg-muted"><motion.div className="h-full rounded-full" style={{ background: color, opacity: 1 - i * 0.07 }} initial={{ width: 0 }} animate={{ width: `${(r.value / max) * 100}%` }} transition={{ delay: i * 0.05, duration: 0.7, ease: [0.16, 1, 0.3, 1] }} /></div>
          </Row>
        </li>
      ))}
    </ul>
  );
}

function DonutLegend({ rows, center, centerLabel, onPick }) {
  const total = rows.reduce((a, r) => a + r.value, 0);
  if (!total) return <p className="py-8 text-center text-sm text-muted-foreground">No data yet</p>;
  return (
    <div className="flex flex-col items-center gap-5">
      <div className="relative size-40 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart><Pie data={rows} dataKey="value" nameKey="name" innerRadius={52} outerRadius={74} paddingAngle={2} stroke="none" animationDuration={900}>{rows.map((r, i) => <Cell key={r.name} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}</Pie><Tooltip formatter={(v, n) => [nf.format(v), n]} contentStyle={{ borderRadius: 12, border: '1px solid var(--border)', background: 'var(--card)', fontSize: 12 }} /></PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-center"><div><p className="font-display text-xl font-bold">{compact.format(center ?? total)}</p><p className="text-[11px] text-muted-foreground">{centerLabel}</p></div></div>
      </div>
      <ul className="w-full min-w-0 space-y-1.5">
        {rows.map((r, i) => (
          <li key={r.name}><Row onPick={onPick && r.name !== 'Other' && r.name !== 'Unknown' ? () => onPick(r.name) : null}><span className="flex items-center gap-2 text-sm"><span className="size-2.5 shrink-0 rounded-full" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} /><span className="min-w-0 flex-1 leading-tight break-words" title={r.name}>{r.name}</span><span className="tabular-nums text-muted-foreground">{nf.format(r.value)} · {Math.round((r.value / total) * 100)}%</span></span></Row></li>
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

/* ------------------------------------------------------------------ dates, filters, CSV */
const pad = (n) => String(n).padStart(2, '0');
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const PRESETS = [
  { value: 'today', label: 'Today' }, { value: 'yesterday', label: 'Yesterday' }, { value: '7', label: 'Last 7 days' }, { value: '14', label: 'Last 14 days' },
  { value: '30', label: 'Last 30 days' }, { value: '90', label: 'Last 90 days' }, { value: 'month', label: 'This month' }, { value: 'lastmonth', label: 'Last month' },
  { value: 'ytd', label: 'Year to date' }, { value: '365', label: 'Last 12 months' }, { value: 'custom', label: 'Custom range' },
];
function rangeFor(preset, custom) {
  const t = new Date(); t.setHours(12, 0, 0, 0);
  if (preset === 'today') return { from: iso(t), to: iso(t) };
  if (preset === 'yesterday') return { from: iso(addDays(t, -1)), to: iso(addDays(t, -1)) };
  if (preset === 'month') return { from: iso(new Date(t.getFullYear(), t.getMonth(), 1)), to: iso(t) };
  if (preset === 'lastmonth') return { from: iso(new Date(t.getFullYear(), t.getMonth() - 1, 1)), to: iso(new Date(t.getFullYear(), t.getMonth(), 0)) };
  if (preset === 'ytd') return { from: iso(new Date(t.getFullYear(), 0, 1)), to: iso(t) };
  if (preset === 'custom') return custom;
  const n = Number(preset) || 30;
  return { from: iso(addDays(t, -(n - 1))), to: iso(t) };
}
const COMPARE = [{ value: 'previous', label: 'Previous period' }, { value: 'year', label: 'Same period last year' }, { value: 'none', label: 'No comparison' }];
const GRAN = [{ value: 'auto', label: 'Auto' }, { value: 'day', label: 'Day' }, { value: 'week', label: 'Week' }, { value: 'month', label: 'Month' }];
const ALL = { value: 'all', label: 'All' };
const FILTERS = [
  { key: 'channel', label: 'Channel', options: ['Direct / NFC / QR', 'Search', 'Social', 'Referral'].map((x) => ({ value: x, label: x })) },
  { key: 'device', label: 'Device', options: [{ value: 'mobile', label: 'Mobile' }, { value: 'tablet', label: 'Tablet' }, { value: 'desktop', label: 'Desktop' }] },
  { key: 'os', label: 'System', options: ['iOS', 'Android', 'Windows', 'macOS', 'Linux', 'ChromeOS'].map((x) => ({ value: x, label: x })) },
  { key: 'browser', label: 'Browser', options: ['Chrome', 'Safari', 'Edge', 'Firefox', 'Samsung Internet', 'Opera', 'In-app browser'].map((x) => ({ value: x, label: x })) },
  { key: 'visitor', label: 'Visitors', options: [{ value: 'new', label: 'New (one day)' }, { value: 'returning', label: 'Returning (2+ days)' }] },
  { key: 'action', label: 'Action', options: [['save', 'Saved contact'], ['call', 'Calls'], ['email', 'E-mails'], ['whatsapp', 'WhatsApp'], ['map', 'Directions'], ['share', 'Shares'], ['social', 'Social links'], ['link', 'Custom links']].map(([value, label]) => ({ value, label })) },
];
const INITIAL = { preset: '30', custom: { from: iso(addDays(new Date(), -29)), to: iso(new Date()) }, compare: 'previous', granularity: 'auto', card: 'all', cardName: '', member: 'all', channel: 'all', device: 'all', os: 'all', browser: 'all', source: 'all', visitor: 'all', action: 'all' };
const FILTER_KEYS = ['channel', 'device', 'os', 'browser', 'source', 'visitor', 'action'];
const fmtDay = (s, o = { day: 'numeric', month: 'short' }) => new Date(`${s}T12:00:00`).toLocaleDateString('en-GB', o);

function download(name, rows) {
  const csv = rows.map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
const exporters = {
  daily: (d) => ['Traffic', [['Date', 'Views', 'Visitors', 'Actions', 'Leads', 'Previous views', 'Previous visitors', 'Previous actions'], ...d.series.map((p) => [p.date, p.views, p.visitors, p.actions, p.leads, p.previous, p.previousVisitors, p.previousActions])]],
  cards: (d) => ['Cards', [['Card', 'Link', 'Views', 'Change %', 'Visitors', 'Actions', 'Saved', 'Leads', 'Action rate %', 'Share of views %'], ...d.topCards.map((c) => [c.name, `/${c.alias}`, c.views, c.change, c.visitors, c.actions, c.saves, c.leads, c.conversion, c.share])]],
  breakdown: (d) => ['Breakdown', [['Group', 'Name', 'Views'], ...[['Channel', d.channels], ['Source', d.sources], ['Device', d.devices], ['Browser', d.browsers], ['System', d.systems]].flatMap(([g, rows]) => rows.map((r) => [g, r.name, r.value])), ...d.actions.map((a) => ['Action', a.name, a.value])]],
};

/* ------------------------------------------------------------------ extra pieces */
const METRICS = [
  { key: 'views', label: 'Views', prev: 'previous', color: 'var(--primary)' },
  { key: 'visitors', label: 'Visitors', prev: 'previousVisitors', color: 'oklch(0.65 0.16 240)' },
  { key: 'actions', label: 'Actions', prev: 'previousActions', color: 'oklch(0.66 0.24 330)' },
  { key: 'leads', label: 'Leads', prev: null, color: 'oklch(0.72 0.17 160)' },
];

function TrafficChart({ series, metrics, compare }) {
  const sel = METRICS.filter((m) => metrics.includes(m.key));
  const main = sel[0];
  const tick = series.length > 45 ? Math.ceil(series.length / 12) - 1 : series.length > 14 ? 3 : 0;
  return (
    <ResponsiveContainer width="100%" height={340}>
      <ComposedChart data={series} margin={{ top: 10, right: 8, left: -12, bottom: 0 }}>
        <defs>{sel.map((m) => <linearGradient key={m.key} id={`tr-${m.key}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={m.color} stopOpacity={sel.length > 1 ? 0.2 : 0.32} /><stop offset="100%" stopColor={m.color} stopOpacity={0} /></linearGradient>)}</defs>
        <CartesianGrid strokeDasharray="4 4" vertical={false} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={10} interval={tick} />
        <YAxis tickLine={false} axisLine={false} allowDecimals={false} width={52} tickFormatter={(v) => compact.format(v)} />
        <Tooltip content={({ active, payload, label }) => active && payload?.length ? (
          <div className="min-w-40 rounded-xl border border-border bg-card/95 px-3 py-2 text-xs shadow-lift backdrop-blur"><p className="mb-1.5 font-medium text-muted-foreground">{label}</p>
            {payload.map((p) => <p key={p.dataKey} className="flex items-center justify-between gap-4 py-0.5 font-semibold"><span className="flex items-center"><span className="mr-1.5 inline-block size-2 rounded-full" style={{ background: p.color || p.stroke }} />{p.name}</span><span className="tabular-nums">{nf.format(p.value)}</span></p>)}</div>
        ) : null} />
        {compare !== 'none' && main?.prev && <Line name={compare === 'year' ? 'Last year' : 'Previous period'} type="monotone" dataKey={main.prev} stroke="var(--muted-foreground)" strokeDasharray="5 5" strokeWidth={1.5} dot={false} isAnimationActive={false} />}
        {sel.map((m) => <Area key={m.key} name={m.label} type="monotone" dataKey={m.key} stroke={m.color} strokeWidth={2.5} fill={`url(#tr-${m.key})`} animationDuration={900} activeDot={{ r: 5, strokeWidth: 3, stroke: 'var(--card)' }} />)}
      </ComposedChart>
    </ResponsiveContainer>
  );
}

function MiniBars({ data, x, labelOf, height = 190 }) {
  const max = Math.max(...data.map((r) => r.value), 0);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 6, right: 4, left: -22, bottom: 0 }}>
        <CartesianGrid strokeDasharray="4 4" vertical={false} />
        <XAxis dataKey={x} tickLine={false} axisLine={false} tickFormatter={labelOf} interval="preserveStartEnd" tick={{ fontSize: 11 }} />
        <YAxis tickLine={false} axisLine={false} allowDecimals={false} width={44} tickFormatter={(v) => compact.format(v)} tick={{ fontSize: 11 }} />
        <Tooltip cursor={{ fill: 'var(--muted)', opacity: 0.5 }} formatter={(v) => [nf.format(v), 'Views']} labelFormatter={(l) => (labelOf ? labelOf(l, true) : l)} contentStyle={{ borderRadius: 12, border: '1px solid var(--border)', background: 'var(--card)', fontSize: 12 }} />
        <Bar dataKey="value" radius={[6, 6, 0, 0]} animationDuration={800}>{data.map((r, i) => <Cell key={i} fill="var(--primary)" fillOpacity={max && r.value === max ? 1 : 0.35} />)}</Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function MiniStat({ icon: Icon, label, hint, kpi, format = (v) => nf.format(v), unit, off }) {
  return (
    <Card className="flex h-full min-h-[6.75rem] flex-col justify-between p-4">
      <p className="flex items-center gap-1.5 text-[13px] font-medium text-muted-foreground"><Icon className="size-3.5" />{label}{hint && <Tip content={hint}><Info className="size-3.5 cursor-help opacity-60" aria-label={hint} /></Tip>}</p>
      <div className="mt-2 flex items-end justify-between gap-2">
        <p className="font-display text-2xl leading-none font-bold tracking-tight">{format(kpi.value)}{unit}</p>
        {off ? null : <Delta change={kpi.change} unit={unit === '%' ? ' pts' : '%'} />}
      </div>
    </Card>
  );
}

function Hero({ d, label }) {
  const h = d.highlights || {};
  const items = [
    { icon: Eye, k: 'Average per day', v: nf.format(d.kpis.perDay.value), s: `${nf.format(h.activeDays || 0)} of ${h.days || 0} days with views` },
    { icon: TrendingUp, k: d.granularity === 'day' ? 'Best day' : 'Best period', v: h.bestBucket ? nf.format(h.bestBucket.value) : '-', s: h.bestBucket ? `${h.bestBucket.label}, views` : 'No views yet' },
    { icon: Clock, k: 'Peak hour', v: h.peakHour ? `${((h.peakHour.hour + 11) % 12) + 1} ${h.peakHour.hour < 12 ? 'AM' : 'PM'}` : '-', s: h.busiestWeekday ? `Busiest on ${h.busiestWeekday.name}` : 'No pattern yet' },
    { icon: Globe2, k: 'Top source', v: h.topSource ? h.topSource.name : '-', s: h.topSource ? `${nf.format(h.topSource.value)} views` : 'No source data' },
  ];
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="relative overflow-hidden rounded-3xl bg-zinc-950 p-5 text-white md:p-6">
      <div className="absolute -top-24 -right-10 size-72 rounded-full bg-violet-600/40 blur-[90px]" /><div className="absolute -bottom-24 left-1/4 size-64 rounded-full bg-fuchsia-600/30 blur-[90px]" /><div className="bg-grid absolute inset-0 opacity-10" />
      <div className="relative">
        <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-medium text-white/70">Performance summary · {label}</p><span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[11px] text-white/80"><span className="size-1.5 rounded-full bg-emerald-400" />Live data</span></div>
        <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((x) => (
            <div key={x.k} className="min-w-0 border-white/10 lg:border-l lg:pl-5 first:lg:border-l-0 first:lg:pl-0">
              <p className="flex items-center gap-1.5 text-xs text-white/60"><x.icon className="size-3.5" />{x.k}</p>
              <p className="mt-1 truncate font-display text-2xl font-bold tracking-tight" title={x.v}>{x.v}</p>
              <p className="mt-0.5 truncate text-xs text-white/55">{x.s}</p>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

function Chips({ icon: Icon, items, onClear, onClearAll }) {
  if (!items.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground"><Icon className="size-3.5" />Filtered by</span>
      {items.map((c) => <button key={c.key} type="button" onClick={() => onClear(c.key)} className="group inline-flex h-7 items-center gap-1.5 rounded-full border border-primary/25 bg-primary-soft pr-1.5 pl-3 text-xs font-medium text-primary transition hover:border-primary/50"><span className="text-muted-foreground">{c.label}:</span>{c.value}<span className="grid size-4 place-items-center rounded-full bg-primary/15 transition group-hover:bg-primary group-hover:text-white"><X className="size-3" /></span></button>)}
      <button type="button" onClick={onClearAll} className="text-xs font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">Clear all</button>
    </div>
  );
}

function CardsTable({ rows, admin, onFocus, focusId }) {
  const [q, setQ] = useState('');
  const [sort, setSort] = useState({ key: 'views', dir: -1 });
  const [page, setPage] = useState(0);
  const per = 8;
  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    return rows.filter((c) => !t || c.name.toLowerCase().includes(t) || c.alias.toLowerCase().includes(t)).sort((a, b) => ((a[sort.key] ?? -1) > (b[sort.key] ?? -1) ? 1 : (a[sort.key] ?? -1) < (b[sort.key] ?? -1) ? -1 : 0) * sort.dir);
  }, [rows, q, sort]);
  useEffect(() => setPage(0), [q, sort, rows]);
  const pages = Math.max(1, Math.ceil(list.length / per));
  const maxViews = Math.max(1, ...rows.map((r) => r.views));
  const th = (key, label, first) => (
    <th className={cn('py-2.5 font-medium', first ? 'px-5 text-left' : 'px-3 text-right')} aria-sort={sort.key === key ? (sort.dir > 0 ? 'ascending' : 'descending') : 'none'}>
      <button type="button" onClick={() => setSort((s) => ({ key, dir: s.key === key ? -s.dir : -1 }))} className={cn('inline-flex items-center gap-1 hover:text-foreground', sort.key === key && 'text-foreground')}>{label}{sort.key === key ? (sort.dir > 0 ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />) : <ArrowUpDown className="size-3 opacity-40" />}</button>
    </th>
  );
  return (
    <Card>
      <CardHeader icon={Eye} title={admin ? 'Top cards' : 'Card performance'} description="Compare cards side by side. Click a column to sort." actions={rows.length > 4 ? <div className="w-52"><Input icon={Search} placeholder="Search cards" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search cards" /></div> : null} />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] text-sm">
          <thead><tr className="border-y border-border bg-muted/40 text-xs text-muted-foreground">{th('name', 'Card', true)}{th('views', 'Views')}{th('change', 'Change')}{th('visitors', 'Visitors')}{th('actions', 'Actions')}{th('saves', 'Saved')}{th('leads', 'Leads')}{th('conversion', 'Action rate')}<th className="px-5 py-2.5" /></tr></thead>
          <tbody>
            {list.slice(page * per, page * per + per).map((c) => (
              <tr key={c.id} className={cn('border-b border-border/60 last:border-0 hover:bg-muted/30', String(focusId) === String(c.id) && 'bg-primary-soft/50')}>
                <td className="px-5 py-3"><a href={`/${c.alias}`} target="_blank" rel="noreferrer" className="font-medium hover:text-primary">{c.name}</a><p className="text-xs text-muted-foreground">/{c.alias}{!c.live && <Badge tone="warning" className="ml-2">Hidden</Badge>}</p></td>
                <td className="px-3 py-3 text-right"><span className="font-semibold tabular-nums">{nf.format(c.views)}</span><div className="mt-1 ml-auto h-1 w-20 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${(c.views / maxViews) * 100}%` }} /></div></td>
                <td className="px-3 py-3 text-right">{c.change === null && rows.length ? <span className="text-xs text-muted-foreground">-</span> : <Delta change={c.change} />}</td>
                <td className="px-3 py-3 text-right tabular-nums">{nf.format(c.visitors)}</td><td className="px-3 py-3 text-right tabular-nums">{nf.format(c.actions)}</td><td className="px-3 py-3 text-right tabular-nums">{nf.format(c.saves)}</td><td className="px-3 py-3 text-right tabular-nums">{nf.format(c.leads)}</td>
                <td className="px-3 py-3 text-right tabular-nums">{c.conversion === null ? '-' : `${c.conversion}%`}</td>
                <td className="px-5 py-3 text-right"><Tip content={String(focusId) === String(c.id) ? 'Showing only this card' : 'Show only this card'}><Button variant={String(focusId) === String(c.id) ? 'soft' : 'ghost'} size="icon" onClick={() => onFocus(c)} aria-label={`Filter to ${c.name}`}><Filter /></Button></Tip></td>
              </tr>
            ))}
            {!list.length && <tr><td colSpan={9} className="px-5 py-10 text-center text-muted-foreground">{rows.length ? 'No cards match your search' : 'No card activity in this period'}</td></tr>}
          </tbody>
        </table>
      </div>
      {pages > 1 && <div className="flex items-center justify-between border-t border-border px-5 py-3 text-xs text-muted-foreground"><span>{list.length} cards · page {page + 1} of {pages}</span><span className="flex gap-1"><Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Previous</Button><Button variant="outline" size="sm" disabled={page >= pages - 1} onClick={() => setPage((p) => p + 1)}>Next</Button></span></div>}
    </Card>
  );
}

function CompanyStrip({ c, d }) {
  const withCards = (d.members || []).filter((m) => m.cards > 0).length;
  const active = (d.members || []).filter((m) => m.views > 0).length;
  const seatPct = c.seats.limit ? Math.min(100, Math.round((c.seats.used / c.seats.limit) * 100)) : 0;
  const items = [
    { icon: Users, label: 'Team members', value: nf.format(c.members.total), note: `${c.members.active} active${c.members.locked ? ` · ${c.members.locked} locked` : ''}${c.members.blocked ? ` · ${c.members.blocked} blocked` : ''}` },
    { icon: Armchair, label: 'Seats used', value: c.seats.limit ? `${c.seats.used} / ${c.seats.limit}` : nf.format(c.seats.used), note: c.seats.limit ? `${seatPct}% of your plan` : 'No seat limit set', bar: c.seats.limit ? seatPct : null },
    { icon: IdCard, label: 'Company cards', value: nf.format(c.cards.total), note: `${c.cards.live} live · ${c.cards.total - c.cards.live} hidden` },
    { icon: UserCheck, label: 'People with views', value: `${active} / ${withCards}`, note: withCards ? `${Math.round((active / withCards) * 100)}% of people with a card` : 'Nobody has a card yet', bar: withCards ? Math.round((active / withCards) * 100) : null },
  ];
  return (
    <div className="grid auto-rows-fr gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((x, i) => (
        <motion.div key={x.label} className="h-full" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
          <Card className="flex h-full min-h-[7.5rem] flex-col justify-between p-4">
            <p className="flex items-center gap-1.5 text-[13px] font-medium text-muted-foreground"><span className="grid size-6 place-items-center rounded-lg bg-primary-soft text-primary"><x.icon className="size-3.5" /></span>{x.label}</p>
            <div><p className="mt-2 font-display text-2xl leading-none font-bold tracking-tight">{x.value}</p>
              {x.bar !== null && x.bar !== undefined && <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-linear-to-r from-violet-500 to-fuchsia-500" style={{ width: `${x.bar}%` }} /></div>}
              <p className="mt-1.5 text-xs text-muted-foreground">{x.note}</p></div>
          </Card>
        </motion.div>
      ))}
    </div>
  );
}

function TeamTable({ rows, onFocus, focusId, onExport }) {
  const [q, setQ] = useState('');
  const [sort, setSort] = useState({ key: 'views', dir: -1 });
  const [page, setPage] = useState(0);
  const per = 10;
  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    return rows.filter((m) => !t || m.name.toLowerCase().includes(t) || (m.email || '').toLowerCase().includes(t))
      .sort((a, b) => ((a[sort.key] ?? -1) > (b[sort.key] ?? -1) ? 1 : (a[sort.key] ?? -1) < (b[sort.key] ?? -1) ? -1 : 0) * sort.dir);
  }, [rows, q, sort]);
  useEffect(() => setPage(0), [q, sort, rows]);
  const pages = Math.max(1, Math.ceil(list.length / per));
  const maxViews = Math.max(1, ...rows.map((r) => r.views));
  const th = (key, label, first) => (
    <th className={cn('py-2.5 font-medium', first ? 'px-5 text-left' : 'px-3 text-right')} aria-sort={sort.key === key ? (sort.dir > 0 ? 'ascending' : 'descending') : 'none'}>
      <button type="button" onClick={() => setSort((s) => ({ key, dir: s.key === key ? -s.dir : -1 }))} className={cn('inline-flex items-center gap-1 hover:text-foreground', sort.key === key && 'text-foreground')}>{label}{sort.key === key ? (sort.dir > 0 ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />) : <ArrowUpDown className="size-3 opacity-40" />}</button>
    </th>
  );
  const tone = { active: 'success', locked: 'warning', blocked: 'danger' };
  return (
    <Card>
      <CardHeader icon={Building2} title="Team performance" description="Every person's cards added together. Click a column to sort."
        actions={<div className="flex items-center gap-2">{rows.length > 5 && <div className="w-48"><Input icon={Search} placeholder="Search people" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search people" /></div>}<Button variant="outline" onClick={onExport}><Download />CSV</Button></div>} />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] text-sm">
          <thead><tr className="border-y border-border bg-muted/40 text-xs text-muted-foreground">{th('name', 'Person', true)}{th('cards', 'Cards')}{th('views', 'Views')}{th('change', 'Change')}{th('visitors', 'Visitors')}{th('actions', 'Actions')}{th('saves', 'Saved')}{th('leads', 'Leads')}{th('conversion', 'Action rate')}<th className="px-5 py-2.5" /></tr></thead>
          <tbody>
            {list.slice(page * per, page * per + per).map((m) => (
              <tr key={m.id} className={cn('border-b border-border/60 last:border-0 hover:bg-muted/30', String(focusId) === String(m.id) && 'bg-primary-soft/50')}>
                <td className="px-5 py-3"><p className="flex items-center gap-2 font-medium">{m.name}{m.status !== 'active' && <Badge tone={tone[m.status] || 'neutral'}>{m.status}</Badge>}</p><p className="text-xs text-muted-foreground"><span className="capitalize">{m.role}</span>{m.email ? ` · ${m.email}` : ''}</p></td>
                <td className="px-3 py-3 text-right tabular-nums">{nf.format(m.cards)}</td>
                <td className="px-3 py-3 text-right"><span className="font-semibold tabular-nums">{nf.format(m.views)}</span><div className="mt-1 ml-auto h-1 w-20 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${(m.views / maxViews) * 100}%` }} /></div></td>
                <td className="px-3 py-3 text-right">{m.change === null ? <span className="text-xs text-muted-foreground">-</span> : <Delta change={m.change} />}</td>
                <td className="px-3 py-3 text-right tabular-nums">{nf.format(m.visitors)}</td><td className="px-3 py-3 text-right tabular-nums">{nf.format(m.actions)}</td><td className="px-3 py-3 text-right tabular-nums">{nf.format(m.saves)}</td><td className="px-3 py-3 text-right tabular-nums">{nf.format(m.leads)}</td>
                <td className="px-3 py-3 text-right tabular-nums">{m.conversion === null ? '-' : `${m.conversion}%`}</td>
                <td className="px-5 py-3 text-right"><Tip content={String(focusId) === String(m.id) ? 'Showing only this person' : 'Show only this person'}><Button variant={String(focusId) === String(m.id) ? 'soft' : 'ghost'} size="icon" onClick={() => onFocus(m)} aria-label={`Filter to ${m.name}`}><Filter /></Button></Tip></td>
              </tr>
            ))}
            {!list.length && <tr><td colSpan={10} className="px-5 py-10 text-center text-muted-foreground">No people match your search</td></tr>}
          </tbody>
        </table>
      </div>
      {pages > 1 && <div className="flex items-center justify-between border-t border-border px-5 py-3 text-xs text-muted-foreground"><span>{list.length} people · page {page + 1} of {pages}</span><span className="flex gap-1"><Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Previous</Button><Button variant="outline" size="sm" disabled={page >= pages - 1} onClick={() => setPage((p) => p + 1)}>Next</Button></span></div>}
    </Card>
  );
}

/* ------------------------------------------------------------------ the dashboard */
/**
 * @param endpoint  '/user/analytics' or '/admin/dashboard/card-analytics'
 * @param admin     platform view: no card picker, shows platform totals
 * @param embedded  used inside the Dashboard page: a section heading instead of the page header
 */
export function AnalyticsDashboard({ endpoint, admin = false, company = false, initialCard = 'all', embedded = false }) {
  const [f, setF] = useState({ ...INITIAL, card: initialCard });
  const [res, setRes] = useState(null);
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const [metrics, setMetrics] = useState(['views']);
  const [tick, setTick] = useState(0);
  const set = (patch) => setF((x) => ({ ...x, ...patch }));
  const range = useMemo(() => rangeFor(f.preset, f.custom), [f.preset, f.custom]);
  const validRange = range.from && range.to && range.from <= range.to;
  const key = JSON.stringify([endpoint, range, f.compare, f.granularity, f.card, f.member, ...FILTER_KEYS.map((k) => f[k]), tick]);
  useEffect(() => {
    if (!validRange) return undefined;
    let live = true; setErr(null); setBusy(true);
    const params = { from: range.from, to: range.to, compare: f.compare, granularity: f.granularity, tz: tzNow(), vcard: f.card === 'all' ? undefined : f.card, member: company && f.member !== 'all' ? f.member : undefined };
    for (const k of FILTER_KEYS) if (f[k] !== 'all') params[k] = f[k];
    api.get(endpoint, { params }).then(({ data }) => { if (live) { setRes(data); setBusy(false); } }).catch((e) => { if (live) { setErr(e.message || 'Could not load analytics'); setBusy(false); } });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, validRange]);

  const d = res?.data;
  const cards = res?.cards || [];
  const cardName = f.card === 'all' ? (admin ? 'all cards' : company ? (f.member === 'all' ? 'the whole company' : `${memberName}'s cards`) : 'all your cards') : cards.find((c) => String(c.id) === String(f.card))?.name || f.cardName || 'this card';
  const periodText = d ? (d.range.from === d.range.to ? fmtDay(d.range.from, { day: 'numeric', month: 'short', year: 'numeric' }) : `${fmtDay(d.range.from)} - ${fmtDay(d.range.to, { day: 'numeric', month: 'short', year: 'numeric' })}`) : '';
  const compareText = !d ? '' : d.range.compare === 'none' ? 'comparison off' : d.range.compare === 'year' ? `compared with ${fmtDay(d.range.previousFrom)} - ${fmtDay(d.range.previousTo, { day: 'numeric', month: 'short', year: 'numeric' })}` : `compared with the ${d.range.days} ${d.range.days === 1 ? 'day' : 'days'} before`;
  const compareOn = d ? d.range.compare !== 'none' : true;
  const people = res?.people || [];
  const memberName = people.find((x) => String(x.id) === String(f.member))?.name || 'this person';
  const active = [
    ...(company && f.member !== 'all' ? [{ key: 'member', label: 'Person', value: memberName }] : []),
    ...(f.card !== 'all' ? [{ key: 'card', label: 'Card', value: cardName }] : []),
    ...FILTERS.filter((x) => f[x.key] !== 'all').map((x) => ({ key: x.key, label: x.label, value: x.options.find((o) => o.value === f[x.key])?.label || f[x.key] })),
    ...(f.source !== 'all' ? [{ key: 'source', label: 'Source', value: f.source }] : []),
  ];
  const clear = (k) => set(k === 'card' ? { card: 'all', cardName: '' } : { [k]: 'all', ...(k === 'member' ? { card: 'all', cardName: '' } : {}) });
  const clearAll = () => set({ card: 'all', cardName: '', member: 'all', ...Object.fromEntries(FILTER_KEYS.map((k) => [k, 'all'])) });
  const pick = (k, v) => v && v !== 'Other' && v !== 'Unknown' && set({ [k]: f[k] === v ? 'all' : v });
  const toggleMetric = (m) => setMetrics((cur) => (cur.includes(m) ? (cur.length > 1 ? cur.filter((x) => x !== m) : cur) : [...cur, m]));
  const exportAs = (what) => { if (!d) return; const [n, rows] = exporters[what](d); download(`analytics-${n.toLowerCase()}-${cardName.replace(/\W+/g, '-')}-${d.range.from}-to-${d.range.to}.csv`, rows); };

  const toolbar = (
    <Card className="p-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-full sm:w-44"><p className="mb-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Period</p><Select value={f.preset} onChange={(x) => set({ preset: x })} options={PRESETS} /></div>
        {f.preset === 'custom' && (
          <div className="flex items-end gap-2">
            <div><p className="mb-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">From</p><Input type="date" max={f.custom.to || iso(new Date())} value={f.custom.from} onChange={(e) => set({ custom: { ...f.custom, from: e.target.value } })} aria-label="From date" /></div>
            <div><p className="mb-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">To</p><Input type="date" min={f.custom.from} max={iso(new Date())} value={f.custom.to} onChange={(e) => set({ custom: { ...f.custom, to: e.target.value } })} aria-label="To date" /></div>
          </div>
        )}
        <div className="w-full sm:w-52"><p className="mb-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Compare with</p><Select value={f.compare} onChange={(x) => set({ compare: x })} options={COMPARE} /></div>
        {company && people.length > 1 && <div className="w-full sm:w-52"><p className="mb-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Person</p><Select value={String(f.member)} onChange={(x) => set({ member: x || 'all', card: 'all', cardName: '' })} options={[{ value: 'all', label: 'Everyone' }, ...people.map((x) => ({ value: String(x.id), label: x.name }))]} /></div>}
        {!admin && cards.length > 1 && <div className="w-full sm:w-52"><p className="mb-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Card</p><Select value={String(f.card)} onChange={(x) => set({ card: x || 'all', cardName: '' })} options={[{ value: 'all', label: 'All cards' }, ...cards.map((c) => ({ value: String(c.id), label: c.name }))]} /></div>}
        <div className="ml-auto flex items-center gap-2">
          <Tip content="Refresh"><Button variant="outline" size="icon" onClick={() => setTick((n) => n + 1)} aria-label="Refresh" disabled={busy}><RefreshCw className={cn(busy && 'animate-spin')} /></Button></Tip>
          <Menu>
            <MenuTrigger asChild><Button variant="outline" disabled={!d?.hasData}><Download />Export<ChevronDown className="opacity-60" /></Button></MenuTrigger>
            <MenuContent>
              <MenuLabel>Download as CSV</MenuLabel>
              <MenuItem icon={BarChart3} onSelect={() => exportAs('daily')}>Traffic over time</MenuItem>
              <MenuItem icon={Eye} onSelect={() => exportAs('cards')}>Card performance</MenuItem>
              <MenuItem icon={Globe2} onSelect={() => exportAs('breakdown')}>Sources, devices and actions</MenuItem>
              <MenuSeparator />
              <MenuItem icon={Printer} onSelect={() => window.print()}>Print or save as PDF</MenuItem>
            </MenuContent>
          </Menu>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-end gap-3 border-t border-border pt-3">
        <span className="mb-2.5 hidden items-center gap-1.5 text-xs font-medium text-muted-foreground sm:flex"><SlidersHorizontal className="size-3.5" />Filters</span>
        {FILTERS.map((x) => (
          <div key={x.key} className="w-[calc(50%-0.375rem)] sm:w-36"><p className="mb-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">{x.label}</p><Select value={f[x.key]} onChange={(v) => set({ [x.key]: v || 'all' })} options={[{ ...ALL, label: `All` }, ...x.options]} /></div>
        ))}
      </div>
      {!validRange && <p className="mt-3 text-sm text-danger">Pick a start date that is on or before the end date.</p>}
      {active.length > 0 && <div className="mt-3"><Chips icon={Filter} items={active} onClear={clear} onClearAll={clearAll} /></div>}
    </Card>
  );

  const title = embedded ? (company ? 'Company analytics' : 'Analytics') : admin ? 'Card analytics' : company ? 'Company analytics' : 'Analytics';
  const description = d ? `${cardName[0].toUpperCase()}${cardName.slice(1)} · ${periodText} · ${compareText}` : 'How visitors find and use your digital cards.';
  const head = embedded
    ? <div className="mb-5 min-w-0"><h2 className="font-display text-xl font-bold tracking-tight">{title}</h2><p className="text-sm text-muted-foreground">{description}</p></div>
    : <PageHeader title={title} description={description} />;
  const total = d?.kpis.views.value || 0;
  const cardFor = (c) => set({ card: String(c.id), cardName: c.name });

  return (
    <>
      {head}
      <div className="space-y-6">
        {toolbar}
        {err ? <Card><EmptyState icon={AlertTriangle} title="Could not load analytics" description={err} action={<Button onClick={() => setTick((n) => n + 1)}>Try again</Button>} /></Card>
          : !d ? <AnalyticsSkeleton />
            : !cards.length && !admin ? <Card><EmptyState icon={BarChart3} title="Create a card to see analytics" description="Views, taps and leads appear here as soon as people open your card." action={<Button as={Link} to="/user/vcards/create">Create a card</Button>} /></Card>
              : (
                <div className={cn('space-y-6 transition-opacity', busy && 'pointer-events-none opacity-60')} aria-busy={busy}>
                  {!d.hasData && (
                    <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-primary/25 bg-primary-soft p-4">
                      <span className="grid size-10 place-items-center rounded-xl bg-primary text-white"><Lightbulb className="size-5" /></span>
                      <div className="min-w-0 flex-1"><p className="font-medium">{active.length ? 'Nothing matches these filters' : 'No activity in this period yet'}</p><p className="text-sm text-muted-foreground">{active.length ? 'Remove a filter or choose a longer period to see data.' : 'Share your card link, show its QR code or tap an NFC card. Views appear here within seconds; taps on buttons and links are counted as actions.'}</p></div>
                      {active.length ? <Button variant="outline" onClick={clearAll}>Clear filters</Button> : f.card !== 'all' && cards.find((c) => String(c.id) === String(f.card)) && <Button variant="outline" as="a" href={`/${cards.find((c) => String(c.id) === String(f.card)).alias}`} target="_blank" rel="noreferrer"><ExternalLink />Open card</Button>}
                    </div>
                  )}

                  {company && res.company && <CompanyStrip c={res.company} d={d} />}
                  <Hero d={d} label={periodText} />

                  {/* headline numbers: six cards, one grid, one height */}
                  <div className="grid auto-rows-fr gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
                    <Kpi index={0} icon={Eye} color="violet" label="Views" hint="Times a card was opened. The same visitor counts once per 30 minutes; bots are ignored." k="views" kpi={d.kpis.views} series={d.series} spark off={!compareOn} />
                    <Kpi index={1} icon={Users} color="sky" label="Visitors" hint="Distinct visitors, counted by an anonymised network address." k="visitors" kpi={d.kpis.visitors} series={d.series} spark off={!compareOn} />
                    <Kpi index={2} icon={MousePointerClick} color="pink" label="Actions" hint="Taps on call, e-mail, WhatsApp, directions, share, social and custom links, plus saved contacts." k="actions" kpi={d.kpis.actions} series={d.series} spark off={!compareOn} />
                    <Kpi index={3} icon={UserPlus} color="emerald" label="Contacts saved" hint="Times the contact file (.vcf) was downloaded." kpi={d.kpis.saves} series={d.series} off={!compareOn} />
                    <Kpi index={4} icon={MessageSquareText} color="amber" label="Leads" hint={d.leadsNotFiltered ? 'Enquiries, appointments and sign-ups. They cannot be matched to a device or source, so these filters do not change this number.' : 'Enquiries, appointment bookings and newsletter sign-ups.'} k="leads" kpi={d.kpis.leads} series={d.series} spark off={!compareOn} />
                    <Kpi index={5} icon={Percent} color="indigo" label="Engagement" hint="Share of views where the same visitor did at least one action on the same day." unit="%" kpi={d.kpis.engagement} series={d.series} off={!compareOn} />
                  </div>
                  <div className="grid auto-rows-fr gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <MiniStat icon={Repeat} label="Returning visitors" hint="Visitors who opened a card on two or more different days in this period." kpi={d.kpis.returning} unit="%" off={!compareOn} />
                    <MiniStat icon={Target} label="Conversion rate" hint="Views that led to an action or a lead, as a share of all views." kpi={d.kpis.conversion} unit="%" off={!compareOn} />
                    <MiniStat icon={Layers} label="Views per visitor" hint="Average number of times each visitor opened a card." kpi={d.kpis.viewsPerVisitor} format={(v) => v} off={!compareOn} />
                    <MiniStat icon={CalendarDays} label="Views per day" hint="Average views for each day of the period." kpi={d.kpis.perDay} format={(v) => v} off={!compareOn} />
                  </div>

                  <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
                    <Section className="xl:col-span-2" icon={BarChart3} title="Traffic over time" description={compareOn ? `Dashed line: ${d.range.compare === 'year' ? 'the same period last year' : 'the previous period'}` : 'Comparison is off'}
                      actions={<div className="flex flex-wrap items-center gap-2">
                        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Metrics to show">{METRICS.map((m) => { const on = metrics.includes(m.key); return <button key={m.key} type="button" aria-pressed={on} onClick={() => toggleMetric(m.key)} className={cn('inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition', on ? 'border-transparent bg-muted text-foreground' : 'border-border text-muted-foreground hover:text-foreground')}><span className="size-2 rounded-full" style={{ background: on ? m.color : 'var(--border)' }} />{m.label}</button>; })}</div>
                        <Segmented id="an-gran" size="sm" value={f.granularity} onChange={(x) => set({ granularity: x })} options={GRAN} />
                      </div>}>
                      {d.series.length ? <TrafficChart series={d.series} metrics={metrics} compare={d.range.compare} /> : <p className="py-16 text-center text-sm text-muted-foreground">No data</p>}
                    </Section>
                    <Section icon={Lightbulb} title="Insights" description="Plain-language read-out of your numbers">
                      <ul className="space-y-3">
                        {d.insights.map((x, i) => { const [I, c] = TONE[x.tone] || TONE.info; return <li key={i} className="flex gap-3 text-sm"><span className={cn('grid size-7 shrink-0 place-items-center rounded-lg', c)}><I className="size-4" /></span><span className="pt-0.5 leading-snug">{x.text}</span></li>; })}
                        {!d.insights.length && <li className="text-sm text-muted-foreground">Insights appear once your cards have some traffic.</li>}
                      </ul>
                    </Section>
                  </div>

                  <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
                    <Section icon={Filter} title="Conversion funnel" description="From opening the card to becoming a lead"><Funnel steps={d.funnel} /></Section>
                    <Section icon={Share2} title="What visitors do" description="Click an action to filter. Change vs comparison">
                      {d.actions.length ? (
                        <ul className="space-y-3">{d.actions.map((a) => { const sum = d.kpis.actions.value || 1; return (
                          <li key={a.type}><button type="button" onClick={() => set({ action: f.action === a.type ? 'all' : a.type })} className="block w-full text-left"><div className="mb-1 flex items-center justify-between gap-2 text-sm"><span className={cn('font-medium', f.action === a.type && 'text-primary')}>{a.name}</span><span className="flex items-center gap-2 tabular-nums"><span className="text-muted-foreground">{nf.format(a.value)}</span>{a.previous !== null && <Delta change={a.previous ? Math.round(((a.value - a.previous) / a.previous) * 1000) / 10 : a.value ? null : 0} />}</span></div><div className="h-2 overflow-hidden rounded-full bg-muted"><motion.div className="h-full rounded-full bg-primary" initial={{ width: 0 }} animate={{ width: `${Math.min(100, (a.value / sum) * 100)}%` }} transition={{ duration: 0.7 }} /></div></button></li>); })}</ul>
                      ) : <p className="py-8 text-center text-sm text-muted-foreground">No taps recorded yet. They appear when visitors press call, e-mail, WhatsApp, directions, share or a link.</p>}
                    </Section>
                    <Section icon={Link2} title="Top links" description="Most tapped social and custom links"><BarList rows={d.topLinks} total={d.topLinks.reduce((a, b) => a + b.value, 0)} empty="No link taps yet" /></Section>
                  </div>

                  <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
                    <Section icon={Users} title="New and returning" description="Returning = opened on two or more days">
                      <DonutLegend rows={d.newVsReturning} center={d.kpis.visitors.value} centerLabel="visitors" onPick={(n) => set({ visitor: f.visitor === (n.startsWith('New') ? 'new' : 'returning') ? 'all' : n.startsWith('New') ? 'new' : 'returning' })} />
                    </Section>
                    <Section icon={MessageSquareText} title="Leads" description={d.leadsNotFiltered ? 'Not affected by device and source filters' : 'Enquiries, bookings and sign-ups'}>
                      <BarList rows={d.leadParts} total={d.kpis.leads.value} empty="No leads yet" />
                    </Section>
                    <Section icon={Clock} title="Views by weekday" description="In your local time"><MiniBars data={d.byWeekday} x="name" /></Section>
                  </div>

                  <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
                    <Section icon={Globe2} title="Where visitors come from" description="Click a channel to filter. Direct includes NFC taps and QR scans"><DonutLegend rows={d.channels} center={total} centerLabel="views" onPick={(n) => pick('channel', n)} /></Section>
                    <Section icon={ExternalLink} title="Top sources" description="Click a site to filter"><BarList rows={d.sources} total={total} onPick={(n) => pick('source', n)} active={f.source} /></Section>
                    <Section icon={Smartphone} title="Devices" description="Click a device to filter"><DonutLegend rows={d.devices} center={total} centerLabel="views" onPick={(n) => pick('device', n.toLowerCase())} /></Section>
                  </div>

                  <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
                    <Section className="xl:col-span-2" icon={Clock} title="When people open your card" description="Views by weekday and hour, in your local time"><Heatmap grid={d.heatmap} /></Section>
                    <Section icon={Clock} title="Views by hour" description="Your busiest hours are highlighted"><MiniBars data={d.byHour} x="hour" labelOf={(h, full) => (full ? `${((h + 11) % 12) + 1} ${h < 12 ? 'AM' : 'PM'}` : h % 4 === 0 ? hourLabel(h) : '')} /></Section>
                  </div>

                  <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                    <Section icon={Globe2} title="Browsers" description="Click to filter"><BarList rows={d.browsers} total={total} onPick={(n) => pick('browser', n)} active={f.browser} /></Section>
                    <Section icon={Smartphone} title="Operating systems" description="Click to filter"><BarList rows={d.systems} total={total} onPick={(n) => pick('os', n)} active={f.os} /></Section>
                  </div>

                  {company && d.members && (
                    <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
                      <Section className="xl:col-span-2" icon={Trophy} title="Team leaderboard" description="Views by person. Click a person to focus on their cards">
                        <BarList rows={d.members.filter((m) => m.views > 0).slice(0, 8).map((m) => ({ name: m.name, value: m.views, id: m.id }))} total={total} empty="No views yet" onPick={(n) => { const m = d.members.find((x) => x.name === n); if (m) set({ member: String(m.id), card: 'all', cardName: '' }); }} />
                      </Section>
                      <Section icon={Lightbulb} title="Team insights" description="Who needs attention">
                        <ul className="space-y-3">{(d.teamInsights || []).map((x, i) => { const [I, c] = TONE[x.tone] || TONE.info; return <li key={i} className="flex gap-3 text-sm"><span className={cn('grid size-7 shrink-0 place-items-center rounded-lg', c)}><I className="size-4" /></span><span className="pt-0.5 leading-snug">{x.text}</span></li>; })}{!(d.teamInsights || []).length && <li className="text-sm text-muted-foreground">Insights appear once your team has some traffic.</li>}</ul>
                      </Section>
                    </div>
                  )}
                  {company && d.members && <TeamTable rows={d.members} onFocus={(m) => set({ member: String(f.member) === String(m.id) ? 'all' : String(m.id), card: 'all', cardName: '' })} focusId={f.member} onExport={() => { const rows = [['Person', 'E-mail', 'Role', 'Status', 'Cards', 'Views', 'Change %', 'Visitors', 'Actions', 'Saved', 'Leads', 'Action rate %', 'Share of views %'], ...d.members.map((m) => [m.name, m.email, m.role, m.status, m.cards, m.views, m.change, m.visitors, m.actions, m.saves, m.leads, m.conversion, m.share])]; download(`company-team-${d.range.from}-to-${d.range.to}.csv`, rows); }} />}

                  <CardsTable rows={d.topCards} admin={admin} onFocus={(c) => (String(f.card) === String(c.id) ? clear('card') : cardFor(c))} focusId={f.card} />

                  <p className="flex items-start gap-2 text-xs text-muted-foreground"><Info className="mt-0.5 size-3.5 shrink-0" /><span>Visitors are counted by an anonymised, salted hash of the network address. No cookies are set and no personal data is stored. Times use your local time zone. {d.truncated && 'This period has more activity than can be shown in full, so the oldest data is left out.'}</span></p>
                </div>
              )}
      </div>
    </>
  );
}

function AnalyticsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid auto-rows-fr gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-[10.5rem] rounded-2xl" />)}</div>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3"><Skeleton className="h-[26rem] rounded-2xl xl:col-span-2" /><Skeleton className="h-[26rem] rounded-2xl" /></div>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-72 rounded-2xl" />)}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ routes */
export function UserAnalytics() {
  const [params] = useSearchParams();
  return <AnalyticsDashboard endpoint="/user/analytics" initialCard={params.get('card') || 'all'} />;
}
export function CompanyAnalytics() { return <AnalyticsDashboard endpoint="/user/analytics/company" company />; }
export function AdminCardAnalytics() { return <AnalyticsDashboard endpoint="/admin/dashboard/card-analytics" admin />; }
/** the old per-card address now opens the new dashboard filtered to that card */
export function LegacyCardAnalytics() { const { id } = useParams(); return <Navigate to={`/user/analytics?card=${id}`} replace />; }
