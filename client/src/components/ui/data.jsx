import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { ChevronLeft, ChevronRight, Inbox, Search, TrendingUp } from 'lucide-react';
import api from '@/lib/api';
import { cn } from '@/lib/cn';
import { fullName } from '@/lib/format';
import { Avatar, Card, Skeleton } from './primitives';
import { Tip } from './overlays';
import { CountUp } from './motion';

/* ------------------------------------------------------------ page header */
export function PageHeader({ title, description, children, eyebrow }) {
  useEffect(() => { document.title = title; }, [title]);
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow && <p className="mb-1 text-xs font-semibold tracking-wider text-primary uppercase">{eyebrow}</p>}
        <h1 className="font-display text-2xl font-bold tracking-tight md:text-[28px]">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}

/* ------------------------------------------------------------- list hook */
export function useList(url, initial = {}) {
  const [params, setParams] = useState({ page: 1, search: '', ...initial });
  const [state, setState] = useState({ rows: [], meta: null, loading: true });
  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true }));
    try {
      const { data } = await api.get(url, { params });
      setState({ rows: data.data, meta: data.meta, loading: false, extra: data });
    } catch (e) { toast.error(e.message); setState((s) => ({ ...s, loading: false })); }
  }, [url, JSON.stringify(params)]); // eslint-disable-line
  useEffect(() => { load(); }, [load]);
  return { ...state, params, set: (p) => setParams((x) => ({ ...x, page: 1, ...p })), setPage: (page) => setParams((x) => ({ ...x, page })), reload: load };
}

/** Run an API call with toast feedback; rethrows so callers can read validation errors */
export async function run(promise, success) {
  try {
    const { data } = await promise;
    toast.success(success || data.message || 'Done');
    return data;
  } catch (e) {
    toast.error(Object.values(e.errors || {})[0] || e.message);
    throw e;
  }
}

/* --------------------------------------------------------------- search */
export function SearchInput({ value, onChange, placeholder = 'Search...', className }) {
  const [v, setV] = useState(value || '');
  useEffect(() => { const t = setTimeout(() => v !== (value || '') && onChange(v), 350); return () => clearTimeout(t); }, [v]); // eslint-disable-line
  return (
    <div className={cn('relative', className)}>
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
      <input value={v} onChange={(e) => setV(e.target.value)} placeholder={placeholder} className="h-9 w-full min-w-52 rounded-xl border border-input bg-card pr-3 pl-9 text-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/15" />
    </div>
  );
}

/** Small native select used in toolbars */
export function FilterSelect({ value, onChange, options, placeholder }) {
  return (
    <select value={value ?? ''} onChange={(e) => onChange(e.target.value)} className="h-9 cursor-pointer rounded-xl border border-input bg-card px-3 text-sm outline-none focus:border-primary">
      <option value="">{placeholder}</option>
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

/* ---------------------------------------------------------------- empty */
export function EmptyState({ icon: Icon = Inbox, title = 'Nothing here yet', description, action }) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="relative mb-4">
        <div className="absolute inset-0 animate-ping rounded-3xl bg-primary/10 [animation-duration:2.5s]" />
        <span className="relative grid size-16 place-items-center rounded-3xl bg-primary-soft text-primary"><Icon className="size-7" /></span>
      </div>
      <p className="font-display text-base font-semibold">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </motion.div>
  );
}

/* ----------------------------------------------------------------- table */
/**
 * columns: [{ key, label, render(row), className }]
 */
export function DataTable({ columns: cols, rows, loading, empty, onRowClick, rowKey = 'id', selected, onSelect }) {
  const columns = onSelect ? [{
    key: '_sel', className: 'w-10 pr-0',
    label: <input type="checkbox" aria-label="Select all" className="size-4 cursor-pointer accent-[var(--primary)]" checked={rows.length > 0 && rows.every((r) => selected.includes(r[rowKey]))} onChange={(e) => onSelect(e.target.checked ? [...new Set([...selected, ...rows.map((r) => r[rowKey])])] : selected.filter((id) => !rows.some((r) => r[rowKey] === id)))} />,
    render: (r) => <input type="checkbox" aria-label="Select row" className="size-4 cursor-pointer accent-[var(--primary)]" checked={selected.includes(r[rowKey])} onClick={(e) => e.stopPropagation()} onChange={(e) => onSelect(e.target.checked ? [...selected, r[rowKey]] : selected.filter((id) => id !== r[rowKey]))} />,
  }, ...cols] : cols;
  if (loading && !rows.length) {
    return (
      <div className="divide-y divide-border">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-5 py-4"><Skeleton className="size-9 rounded-full" /><Skeleton className="h-4 w-1/4" /><Skeleton className="h-4 w-1/6" /><Skeleton className="ml-auto h-4 w-16" /></div>
        ))}
      </div>
    );
  }
  if (!rows.length) return empty || <EmptyState />;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/40">
            {columns.map((c) => <th key={c.key || String(c.label)} className={cn('px-5 py-3 text-left text-xs font-semibold tracking-wide whitespace-nowrap text-muted-foreground uppercase', c.className)}>{c.label}</th>)}
          </tr>
        </thead>
        <tbody className={cn('divide-y divide-border transition-opacity', loading && 'opacity-60')}>
          <AnimatePresence initial={false}>
            {rows.map((row, i) => (
              <motion.tr key={row[rowKey] ?? i} layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0, transition: { delay: Math.min(i * 0.025, 0.25) } }} exit={{ opacity: 0 }}
                onClick={onRowClick ? () => onRowClick(row) : undefined} className={cn('group transition-colors hover:bg-muted/40', onRowClick && 'cursor-pointer')}>
                {columns.map((c) => <td key={c.key || c.label} className={cn('px-5 py-3.5 whitespace-nowrap', c.className)}>{c.render ? c.render(row) : row[c.key]}</td>)}
              </motion.tr>
            ))}
          </AnimatePresence>
        </tbody>
      </table>
    </div>
  );
}

export function Pagination({ meta, onPage }) {
  if (!meta) return null;
  const { page, last_page: last, total, per_page: per } = meta;
  const from = total ? (page - 1) * per + 1 : 0;
  const to = Math.min(total, page * per);
  const pages = [];
  for (let p = Math.max(1, page - 2); p <= Math.min(last, page + 2); p++) pages.push(p);
  const btn = 'grid size-8 place-items-center rounded-lg text-sm transition disabled:opacity-40 cursor-pointer disabled:cursor-default';
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-3">
      <p className="text-xs text-muted-foreground">Showing <b className="text-foreground">{from}-{to}</b> of <b className="text-foreground">{total}</b></p>
      {last > 1 && (
        <div className="flex items-center gap-1">
          <button className={cn(btn, 'hover:bg-muted')} disabled={page <= 1} onClick={() => onPage(page - 1)}><ChevronLeft className="size-4" /></button>
          {pages.map((p) => (
            <button key={p} onClick={() => onPage(p)} className={cn(btn, 'relative font-medium', p === page ? 'text-primary-foreground' : 'hover:bg-muted')}>
              {p === page && <motion.span layoutId="page-pill" className="absolute inset-0 rounded-lg bg-primary" />}
              <span className="relative">{p}</span>
            </button>
          ))}
          <button className={cn(btn, 'hover:bg-muted')} disabled={page >= last} onClick={() => onPage(page + 1)}><ChevronRight className="size-4" /></button>
        </div>
      )}
    </div>
  );
}

/** Card with toolbar + table + pagination */
export function TableCard({ title, description, toolbar, children, list }) {
  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
        <div>
          <h3 className="font-display text-[15px] font-semibold">{title} {list?.meta && <span className="ml-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">{list.meta.total}</span>}</h3>
          {description && <p className="mt-0.5 text-[13px] text-muted-foreground">{description}</p>}
        </div>
        {toolbar && <div className="flex flex-wrap items-center gap-2">{toolbar}</div>}
      </div>
      <div className="border-t border-border">{children}</div>
      {list && <Pagination meta={list.meta} onPage={list.setPage} />}
    </Card>
  );
}

/* ------------------------------------------------------------------ cells */
export function UserCell({ user, sub, to }) {
  const inner = (
    <div className="flex items-center gap-3">
      <Avatar src={user?.avatar} name={fullName(user)} size={36} />
      <div className="min-w-0">
        <p className="truncate font-medium text-foreground">{fullName(user)}</p>
        <p className="truncate text-xs text-muted-foreground">{sub ?? user?.email}</p>
      </div>
    </div>
  );
  return to ? <Link to={to} className="hover:opacity-80">{inner}</Link> : inner;
}

const ACTION = {
  primary: 'hover:bg-primary-soft hover:text-primary',
  info: 'hover:bg-info-soft hover:text-info',
  success: 'hover:bg-success-soft hover:text-success',
  warning: 'hover:bg-warning-soft hover:text-warning',
  danger: 'hover:bg-danger-soft hover:text-danger',
};
/** Icon-only row action with tooltip */
export function Action({ icon: Icon, label, tone = 'primary', onClick, to, href, ...rest }) {
  const cls = cn('grid size-8 place-items-center rounded-lg text-muted-foreground transition cursor-pointer', ACTION[tone]);
  const el = to ? <Link to={to} className={cls} aria-label={label}><Icon className="size-4" /></Link>
    : href ? <a href={href} className={cls} aria-label={label} {...rest}><Icon className="size-4" /></a>
      : <button type="button" onClick={onClick} className={cls} aria-label={label}><Icon className="size-4" /></button>;
  return <Tip content={label}>{el}</Tip>;
}
export const Actions = ({ children }) => <div className="flex items-center justify-end gap-0.5">{children}</div>;

/* ------------------------------------------------------------ stat card */
const TILE = {
  violet: 'from-violet-500 to-indigo-500 shadow-violet-500/30',
  pink: 'from-fuchsia-500 to-pink-500 shadow-pink-500/30',
  sky: 'from-sky-500 to-cyan-500 shadow-sky-500/30',
  emerald: 'from-emerald-500 to-teal-500 shadow-emerald-500/30',
  amber: 'from-amber-500 to-orange-500 shadow-amber-500/30',
  rose: 'from-rose-500 to-red-500 shadow-rose-500/30',
};
export function StatCard({ icon: Icon, label, value, format, color = 'violet', hint, to, index = 0 }) {
  const body = (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.07, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}>
      <Card hover className="group relative overflow-hidden p-5">
        <div className={cn('pointer-events-none absolute -top-10 -right-10 size-32 rounded-full bg-linear-to-br opacity-10 blur-2xl transition-opacity duration-500 group-hover:opacity-25', TILE[color])} />
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[13px] font-medium text-muted-foreground">{label}</p>
            <p className="mt-2 font-display text-3xl font-bold tracking-tight">{typeof value === 'number' ? <CountUp value={value} format={format} /> : value}</p>
          </div>
          <span className={cn('grid size-11 place-items-center rounded-2xl bg-linear-to-br text-white shadow-lg transition-transform duration-500 group-hover:scale-110 group-hover:rotate-6', TILE[color])}><Icon className="size-5" /></span>
        </div>
        {hint && <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground"><TrendingUp className="size-3.5 text-success" />{hint}</p>}
      </Card>
    </motion.div>
  );
  return to ? <Link to={to} className="block">{body}</Link> : body;
}
