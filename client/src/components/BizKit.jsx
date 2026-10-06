/*
 * Shared building blocks for the business admin screens (finance, inventory, vendors, invoices):
 * money / date helpers, date-range presets, fetch hooks, attachment upload + preview, CSV export,
 * money charts and a header-less CRUD table (list + dialog form) used inside tabs.
 */
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { toast } from 'sonner';
import { FileText, Info, Plus, Pencil, Trash2, UploadCloud, X, ExternalLink } from 'lucide-react';
import { ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, Cell } from 'recharts';
import api, { toFormData } from '@/lib/api';
import { cn } from '@/lib/cn';
import {
  TableCard, DataTable, SearchInput, FilterSelect, Action, Actions, Dialog, Button, Field, Input, Textarea, Select, Switch, Segmented, Pagination,
  EmptyState, Tip, useList, useForm, run, confirm,
} from '@/components/ui';
import { CHART_COLORS } from '@/components/ui/charts';

/* ------------------------------------------------------------------ money */
/** Rs 12,500 (uses the record's currency icon when given) */
export const pkr = (v, icon) => {
  const n = Number(v || 0);
  return `${n < 0 ? '-' : ''}${icon || 'Rs'} ${Math.abs(n).toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
};
/** Rs 12.5k style for chart axes */
export const pkrShort = (v) => {
  const n = Number(v || 0);
  const a = Math.abs(n);
  const s = a >= 1e7 ? `${(a / 1e7).toFixed(1)}cr` : a >= 1e5 ? `${(a / 1e5).toFixed(1)}L` : a >= 1e3 ? `${(a / 1e3).toFixed(a >= 1e4 ? 0 : 1)}k` : String(Math.round(a));
  return `${n < 0 ? '-' : ''}${s}`;
};
export const num = (v) => Number(v || 0);
export const qty = (v) => Number(v || 0).toLocaleString('en-US', { maximumFractionDigits: 3 });
export const sum = (rows, f) => rows.reduce((a, r) => a + num(typeof f === 'function' ? f(r) : r[f]), 0);

/** Coloured signed amount */
export function Amount({ value, icon, tone, className, sign }) {
  const t = tone || (num(value) < 0 ? 'out' : 'in');
  return <span className={cn('font-semibold tabular-nums', t === 'in' && 'text-success', t === 'out' && 'text-danger', t === 'warn' && 'text-warning', className)}>{sign ? (t === 'out' ? '- ' : t === 'in' ? '+ ' : '') : ''}{pkr(Math.abs(num(value)), icon)}</span>;
}

export const PAYMENT_METHODS = ['Cash', 'Bank transfer', 'JazzCash', 'Easypaisa', 'Card', 'Cheque', 'Other'].map((m) => ({ value: m, label: m }));
export const accountOpt = (a) => ({ value: a.id, label: a.name });
export const partnerOpt = (p) => ({ value: p.id, label: p.name });
export const vendorOpt = (v) => ({ value: v.id, label: v.name });

/* ------------------------------------------------------------------ dates */
const pad = (n) => String(n).padStart(2, '0');
export const ymd = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const monthLabel = (k) => { const [y, m] = String(k).split('-').map(Number); return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'short', year: '2-digit' }); };
export const monthKey = (d) => String(d || '').slice(0, 7);

export const RANGE_PRESETS = [
  { value: 'month', label: 'This month' }, { value: '3m', label: '3 months' }, { value: '6m', label: '6 months' },
  { value: '12m', label: '12 months' }, { value: 'year', label: 'This year' }, { value: 'custom', label: 'Custom' },
];
export function presetRange(key) {
  const now = new Date(); const y = now.getFullYear(); const m = now.getMonth();
  const back = { month: 0, '3m': 2, '6m': 5, '12m': 11 }[key];
  if (back !== undefined) return { from: ymd(new Date(y, m - back, 1)), to: ymd(now) };
  if (key === 'year') return { from: ymd(new Date(y, 0, 1)), to: ymd(now) };
  return null;
}
export function useDateRange(initial = '12m') {
  const [state, setState] = useState(() => ({ preset: initial, ...presetRange(initial) }));
  return {
    ...state,
    setPreset: (p) => setState((s) => ({ ...s, preset: p, ...(presetRange(p) || {}) })),
    setDates: (d) => setState((s) => ({ ...s, preset: 'custom', ...d })),
  };
}
export function RangePicker({ range, id = 'range' }) {
  return (
    <div className="flex max-w-full flex-wrap items-center gap-2">
      <ScrollX><Segmented id={id} size="sm" value={range.preset} onChange={range.setPreset} options={RANGE_PRESETS} className="[&_button]:whitespace-nowrap" /></ScrollX>
      {range.preset === 'custom' && (
        <motion.div initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-1.5">
          <input type="date" value={range.from || ''} max={range.to || undefined} onChange={(e) => range.setDates({ from: e.target.value })} className="h-8 rounded-lg border border-input bg-card px-2 text-xs outline-none focus:border-primary" aria-label="From" />
          <span className="text-xs text-muted-foreground">to</span>
          <input type="date" value={range.to || ''} min={range.from || undefined} onChange={(e) => range.setDates({ to: e.target.value })} className="h-8 rounded-lg border border-input bg-card px-2 text-xs outline-none focus:border-primary" aria-label="To" />
        </motion.div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ data */
export function useFetch(url, params) {
  const [state, setState] = useState({ data: null, loading: true });
  const key = JSON.stringify(params || {});
  const load = useCallback(async () => {
    if (!url) return;
    setState((s) => ({ ...s, loading: true }));
    try { const { data } = await api.get(url, { params }); setState({ data, loading: false }); } catch (e) { toast.error(e.message); setState((s) => ({ ...s, loading: false, error: e })); }
  }, [url, key]); // eslint-disable-line
  useEffect(() => { load(); }, [load]);
  return { ...state, reload: load };
}
/** Unpaged option list: useLookup('/admin/finance/accounts', (a) => ({ value: a.id, label: a.name })) */
export function useLookup(url, map, params) {
  const { data } = useFetch(url, { all: 1, ...(params || {}) });
  return useMemo(() => (data?.data || []).map(map), [data]); // eslint-disable-line
}
/** Client-side paging for unpaged endpoints */
export function useClientPage(rows, perPage = 25) {
  const [page, setPage] = useState(1);
  const last = Math.max(1, Math.ceil(rows.length / perPage));
  useEffect(() => { if (page > last) setPage(1); }, [last]); // eslint-disable-line
  return { rows: rows.slice((page - 1) * perPage, page * perPage), meta: { page: Math.min(page, last), last_page: last, total: rows.length, per_page: perPage }, setPage };
}
export const ClientPager = ({ pager }) => <Pagination meta={pager.meta} onPage={pager.setPage} />;

/* -------------------------------------------------------------- CSV export */
export function downloadCsv(filename, cols, rows) {
  const esc = (v) => { const s = v === null || v === undefined ? '' : String(v); return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const csv = [cols.map((c) => esc(c.label)).join(','), ...rows.map((r) => cols.map((c) => esc(typeof c.value === 'function' ? c.value(r) : r[c.key])).join(','))].join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8' }));
  a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

/* ------------------------------------------------------------------- misc */
export function Hint({ children, side = 'top' }) {
  return (
    <Tip content={<span className="block max-w-64 leading-relaxed font-normal">{children}</span>} side={side}>
      <button type="button" aria-label="How is this calculated?" className="inline-grid size-4 cursor-help place-items-center rounded-full text-muted-foreground/70 transition hover:text-primary" onClick={(e) => e.preventDefault()}><Info className="size-3.5" /></button>
    </Tip>
  );
}
export const LabelHint = ({ label, hint }) => <span className="inline-flex items-center gap-1">{label}{hint && <Hint>{hint}</Hint>}</span>;
export const FadeIn = ({ children, delay = 0, className }) => (
  <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay, duration: 0.5, ease: [0.16, 1, 0.3, 1] }} className={className}>{children}</motion.div>
);
/** Horizontal scroller that never pushes the page wider than the viewport (for segmented controls on phones) */
export const ScrollX = ({ children, className }) => <div className={cn('max-w-[calc(100vw-2.5rem)] overflow-x-auto', className)}>{children}</div>;
export const TabBar = ({ value, onChange, options, id = 'tabs' }) => <ScrollX className="mb-5 pb-1"><Segmented id={id} value={value} onChange={onChange} options={options} className="[&_button]:whitespace-nowrap" /></ScrollX>;
/** Coloured progress bar (margin etc.) */
export function Meter({ value, max = 100, tone }) {
  const pct = Math.max(0, Math.min(100, (num(value) / (max || 1)) * 100));
  const t = tone || (num(value) < 0 ? 'bg-danger' : num(value) < 15 ? 'bg-warning' : 'bg-success');
  return (
    <div className="h-1.5 w-full min-w-16 overflow-hidden rounded-full bg-muted">
      <motion.div initial={{ width: 0 }} animate={{ width: `${num(value) < 0 ? 100 : pct}%` }} transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }} className={cn('h-full rounded-full', t)} />
    </div>
  );
}
/** Small key / value tile */
export function Tile({ label, value, sub, tone, hint, className }) {
  return (
    <div className={cn('rounded-2xl border border-border p-4', className)}>
      <p className="flex items-center gap-1 text-xs font-medium text-muted-foreground">{label}{hint && <Hint>{hint}</Hint>}</p>
      <p className={cn('mt-1 font-display text-xl font-bold tracking-tight tabular-nums', tone === 'in' && 'text-success', tone === 'out' && 'text-danger', tone === 'warn' && 'text-warning')}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

/* ------------------------------------------------------------ attachments */
export const isPdf = (v) => (v instanceof File ? v.type === 'application/pdf' : /\.pdf($|\?)/i.test(String(v || '')));
export function AttachmentLink({ url, size = 36 }) {
  if (!url) return <span className="text-muted-foreground">-</span>;
  return (
    <Tip content={isPdf(url) ? 'Open PDF' : 'Open receipt'}>
      <a href={url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="inline-block transition hover:scale-105">
        {isPdf(url)
          ? <span className="grid place-items-center rounded-lg bg-danger-soft text-danger" style={{ width: size, height: size }}><FileText className="size-4" /></span>
          : <img src={url} alt="Receipt" loading="lazy" className="rounded-lg object-cover ring-1 ring-border" style={{ width: size, height: size }} />}
      </a>
    </Tip>
  );
}
/** Image or PDF upload with preview (receipts, bills) */
export function DocUpload({ value, onChange, label = 'Upload receipt / bill', hint = 'Screenshot, photo or PDF up to 8 MB' }) {
  const [preview, setPreview] = useState(null);
  const [drag, setDrag] = useState(false);
  useEffect(() => {
    if (value instanceof File) {
      if (!value.type.startsWith('image/')) { setPreview(null); return undefined; }
      const u = URL.createObjectURL(value); setPreview(u); return () => URL.revokeObjectURL(u);
    }
    setPreview(value && !isPdf(value) ? value : null); return undefined;
  }, [value]);
  const pick = (f) => f && onChange(f);
  const pdf = isPdf(value);
  return (
    <div className="space-y-2">
      <label
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); pick(e.dataTransfer.files[0]); }}
        className={cn('group relative flex cursor-pointer items-center gap-4 rounded-2xl border-2 border-dashed p-3 transition', drag ? 'border-primary bg-primary-soft' : 'border-border hover:border-primary/50 hover:bg-muted/40')}
      >
        <input type="file" accept="image/png,image/jpeg,image/webp,image/gif,application/pdf" className="sr-only" onChange={(e) => pick(e.target.files[0])} />
        <span className="relative grid size-16 shrink-0 place-items-center overflow-hidden rounded-xl bg-muted">
          {preview ? <img src={preview} alt="" className="size-full object-cover" /> : pdf ? <FileText className="size-6 text-danger" /> : <UploadCloud className="size-6 text-muted-foreground transition group-hover:scale-110 group-hover:text-primary" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{value instanceof File ? value.name : value ? 'Replace file' : label}</span>
          <span className="block text-xs text-muted-foreground">{drag ? 'Drop it here' : hint}</span>
        </span>
        {value instanceof File && <button type="button" aria-label="Remove file" onClick={(e) => { e.preventDefault(); onChange(''); }} className="grid size-7 place-items-center rounded-lg text-muted-foreground hover:bg-muted"><X className="size-4" /></button>}
      </label>
      {value && !(value instanceof File) && <a href={value} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"><ExternalLink className="size-3.5" />View current file</a>}
    </div>
  );
}

/* ----------------------------------------------------------------- charts */
function MoneyTip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-border bg-card/95 px-3 py-2 text-xs shadow-lift backdrop-blur">
      {label && <p className="mb-1 font-medium text-muted-foreground">{label}</p>}
      {payload.map((p) => <p key={p.dataKey || p.name} className="font-semibold"><span className="mr-1.5 inline-block size-2 rounded-full" style={{ background: p.color || p.payload?.fill }} />{p.name}: {pkr(p.value)}</p>)}
    </div>
  );
}
/** Grouped bars + optional line, all money. series: [{ key, name, color, type: 'bar'|'line' }] */
export function MoneyChart({ data, series, height = 300 }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 10, right: 8, left: -8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="4 4" vertical={false} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={10} minTickGap={8} />
        <YAxis tickLine={false} axisLine={false} tickFormatter={pkrShort} width={48} />
        <Tooltip content={<MoneyTip />} cursor={{ fill: 'var(--muted)', opacity: 0.5 }} />
        {series.map((s) => (s.type === 'line'
          ? <Line key={s.key} type="monotone" dataKey={s.key} name={s.name} stroke={s.color} strokeWidth={2.5} dot={{ r: 3, strokeWidth: 0, fill: s.color }} activeDot={{ r: 5, strokeWidth: 3, stroke: 'var(--card)' }} animationDuration={1200} />
          : <Bar key={s.key} dataKey={s.key} name={s.name} fill={s.color} radius={[6, 6, 2, 2]} maxBarSize={22} animationDuration={1000} stackId={s.stack} />))}
      </ComposedChart>
    </ResponsiveContainer>
  );
}
export const ChartLegend = ({ series }) => (
  <div className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-2">
    {series.map((s) => <span key={s.key} className="flex items-center gap-1.5 text-xs text-muted-foreground"><span className={cn('size-2.5', s.type === 'line' ? 'h-0.5 w-3 rounded' : 'rounded-full')} style={{ background: s.color }} />{s.name}</span>)}
  </div>
);
export function MoneyDonut({ data, height = 220, center = 'total' }) {
  const total = sum(data, 'value');
  return (
    <div>
      <div className="relative">
        <ResponsiveContainer width="100%" height={height}>
          <PieChart>
            <Tooltip content={<MoneyTip />} />
            <Pie data={data} dataKey="value" nameKey="name" innerRadius="68%" outerRadius="92%" paddingAngle={3} cornerRadius={6} stroke="none" animationDuration={1100}>
              {data.map((d, i) => <Cell key={d.name} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
          <div><p className="font-display text-xl font-bold">{pkr(Math.round(total))}</p><p className="text-xs text-muted-foreground">{center}</p></div>
        </div>
      </div>
      <ul className="mt-3 space-y-1.5">
        {data.map((d, i) => (
          <li key={d.name} className="flex items-center gap-2 text-xs">
            <span className="size-2.5 shrink-0 rounded-full" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
            <span className="min-w-0 flex-1 truncate text-muted-foreground">{d.name}</span>
            <span className="text-muted-foreground">{total ? Math.round((d.value / total) * 100) : 0}%</span>
            <b className="tabular-nums">{pkr(d.value)}</b>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ----------------------------------------------------------- form fields */
/**
 * field: { name, label, type: text|number|money|date|textarea|select|switch|file, options, required, half, hint, placeholder,
 *          show(values), fromRow(row), rows, min, step }
 */
export function FieldControl({ f, form, options }) {
  const v = form.values[f.name];
  const set = (x) => form.set(f.name, x);
  const err = form.errors[f.name];
  const hint = typeof f.hint === 'function' ? f.hint(form.values) : f.hint;
  let control;
  if (f.type === 'select') control = <Select id={`f-${f.name}`} value={v} onChange={set} options={options || f.options || []} invalid={!!err} allowEmpty={!f.required} placeholder={f.placeholder || `Select ${f.label.toLowerCase()}`} />;
  else if (f.type === 'switch') return <label className={cn('flex cursor-pointer items-center justify-between rounded-2xl border border-border p-4', !f.half && 'sm:col-span-2')}><span className="text-sm font-medium">{f.label}</span><Switch checked={v} onChange={set} /></label>;
  else if (f.type === 'file') control = <DocUpload value={v} onChange={set} label={f.placeholder} />;
  else if (f.type === 'textarea') control = <Textarea {...form.input(f.name)} rows={f.rows || 3} placeholder={f.placeholder} />;
  else if (f.type === 'money') control = <Input {...form.input(f.name)} type="number" min={f.min ?? 0} step={f.step || '0.01'} prefix={f.prefix || 'Rs'} placeholder={f.placeholder || '0'} />;
  else control = <Input {...form.input(f.name)} type={f.type || 'text'} placeholder={f.placeholder || (f.type === 'date' ? undefined : f.label)} min={f.min} max={f.max} step={f.step} />;
  return <Field label={f.label} htmlFor={`f-${f.name}`} required={f.required} error={err} hint={hint} className={f.half ? '' : 'sm:col-span-2'}>{control}</Field>;
}
export const blankOf = (fields) => Object.fromEntries(fields.map((f) => [f.name, f.type === 'switch' ? (f.default ?? true) : (f.default ?? '')]));
export const rowToForm = (fields, row) => Object.fromEntries(fields.map((f) => [f.name, f.fromRow ? f.fromRow(row) : (row[f.name] ?? (f.type === 'switch' ? false : ''))]));
/** Strip unchanged files, choose multipart when the resource has file fields */
export function payloadOf(fields, values, extra = {}) {
  const payload = { ...extra, ...values };
  const hasFile = fields.some((f) => f.type === 'file');
  for (const f of fields) {
    if (f.type === 'file' && !(payload[f.name] instanceof File)) delete payload[f.name];
    if (f.toPayload) payload[f.name] = f.toPayload(payload[f.name], payload);
  }
  return hasFile ? toFormData(payload) : payload;
}

/* ---------------------------------------------------------------- CRUD table */
/**
 * Header-less list + dialog CRUD for use inside tabs / detail pages.
 * `fixed` is sent both as list filter and in the saved payload (e.g. { vendor_id }).
 * ref: { open(row?, preset?), reload() }
 */
export const CrudTable = forwardRef(function CrudTable({
  endpoint, title, description, icon, singular, columns, fields, defaults = {}, fixed = {}, filters = [], search = true, searchPlaceholder,
  canCreate = true, canEdit = true, canDelete = true, size = 'md', onChanged, toolbar, footer, emptyTitle, emptyDescription, extraActions, fieldOptions = {}, formExtra,
}, ref) {
  const list = useList(endpoint, { ...fixed });
  const form = useForm({ ...blankOf(fields), ...defaults });
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const openForm = (row, preset) => {
    setEditing(row || null); form.setErrors({});
    form.setValues(row ? rowToForm(fields, row) : { ...blankOf(fields), ...defaults, ...(preset || {}) });
    setOpen(true);
  };
  useImperativeHandle(ref, () => ({ open: openForm, reload: list.reload }));
  const save = async (e) => {
    e?.preventDefault();
    setSaving(true);
    const body = payloadOf(fields, form.values, fixed);
    try { await run(editing ? api.put(`${endpoint}/${editing.id}`, body) : api.post(endpoint, body)); setOpen(false); list.reload(); onChanged?.(); } catch (ex) { form.setErrors(ex.errors || {}); } finally { setSaving(false); }
  };
  const remove = async (row) => {
    if (!(await confirm({ title: `Delete this ${singular.toLowerCase()}?` }))) return;
    await run(api.delete(`${endpoint}/${row.id}`)).catch(() => {});
    list.reload(); onChanged?.();
  };
  const addBtn = canCreate && <Button size="sm" onClick={() => openForm()}><Plus />Add {singular.toLowerCase()}</Button>;
  return (
    <>
      <TableCard title={title} description={description} list={list} toolbar={<>
        {toolbar}
        {filters.map((f) => <FilterSelect key={f.name} value={list.params[f.name]} onChange={(v) => list.set({ [f.name]: v })} placeholder={f.label} options={f.options || []} />)}
        {search && <SearchInput value={list.params.search} onChange={(s) => list.set({ search: s })} placeholder={searchPlaceholder || 'Search...'} />}
        {addBtn}
      </>}>
        <DataTable loading={list.loading} rows={list.rows}
          empty={<EmptyState icon={icon} title={emptyTitle || `No ${title.toLowerCase()} yet`} description={emptyDescription} action={addBtn} />}
          columns={[...columns, (canEdit || canDelete || extraActions) && {
            key: '_a', label: '', className: 'text-right', render: (row) => (
              <Actions>
                {extraActions?.(row)}
                {canEdit && <Action icon={Pencil} label="Edit" tone="info" onClick={() => openForm(row)} />}
                {canDelete && <Action icon={Trash2} label="Delete" tone="danger" onClick={() => remove(row)} />}
              </Actions>
            ),
          }].filter(Boolean)} />
        {footer && list.rows.length > 0 && footer(list)}
      </TableCard>
      <Dialog open={open} onOpenChange={setOpen} size={size} icon={icon} title={`${editing ? 'Edit' : 'New'} ${singular.toLowerCase()}`}
        footer={<><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={save} loading={saving}>{editing ? 'Save changes' : `Save ${singular.toLowerCase()}`}</Button></>}>
        <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
          {fields.filter((f) => !f.show || f.show(form.values)).map((f) => <FieldControl key={f.name} f={f} form={form} options={fieldOptions[f.name]} />)}
          {formExtra?.(form)}
          <button type="submit" className="hidden" />
        </form>
      </Dialog>
    </>
  );
});

/** Totals strip under a table */
export const TotalsRow = ({ children }) => <div className="flex flex-wrap items-center justify-end gap-x-6 gap-y-1 border-t border-border bg-muted/30 px-5 py-3 text-sm">{children}</div>;
export const TotalItem = ({ label, children }) => <span className="text-muted-foreground">{label} <b className="ml-1 text-foreground tabular-nums">{children}</b></span>;
