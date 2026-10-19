import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { BadgeCheck, MapPin, Search, Store, IdCard, ArrowUpRight, ChevronLeft, ChevronRight, Flame, TrendingUp, Clock, LayoutGrid } from 'lucide-react';
import api from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/cn';
import { Spinner, Aurora, EmptyState, Stagger, StaggerItem } from '@/components/ui';
import { Navbar, Footer, ScrollProgress, SiteExtras, useSiteTheme } from './SiteChrome';

const SORTS = [['recent', 'Recent', Clock], ['popular', 'Popular', Flame], ['trending', 'Trending', TrendingUp], ['all', 'All', LayoutGrid]];
const TYPES = [['all', 'All types'], ['vcard', 'vCards'], ['store', 'WhatsApp stores']];
const initials = (n) => (n || '?').split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '');

function Tile({ x }) {
  const color = x.color || 'var(--primary)';
  return (
    <a href={x.url} target="_blank" rel="noreferrer" className="group flex h-full flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-soft transition duration-500 hover:-translate-y-1 hover:shadow-lift">
      <div className="relative h-28 overflow-hidden" style={{ background: x.cover ? undefined : `linear-gradient(135deg, ${color}, color-mix(in srgb, ${color} 50%, #000))` }}>
        {x.cover && <img src={x.cover} alt="" loading="lazy" className="size-full object-cover transition duration-700 group-hover:scale-105" />}
        <span className="absolute top-3 left-3 inline-flex items-center gap-1 rounded-full bg-black/45 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur">
          {x.type === 'store' ? <Store className="size-3" /> : <IdCard className="size-3" />}{x.label}
        </span>
      </div>
      <div className="flex flex-1 flex-col px-5 pb-5">
        <div className="-mt-9 size-[4.5rem] overflow-hidden rounded-2xl border-4 border-card bg-muted">
          {x.avatar ? <img src={x.avatar} alt="" loading="lazy" className="size-full object-cover" /> : <span className="grid size-full place-items-center font-display text-xl font-bold text-white" style={{ background: color }}>{initials(x.name)}</span>}
        </div>
        <p className="mt-3 flex items-center gap-1.5 font-display font-semibold group-hover:text-primary">{x.name}{x.verified && <BadgeCheck className="size-4 shrink-0 text-sky-500" />}</p>
        {x.tagline && <p className="mt-0.5 truncate text-sm text-muted-foreground">{x.tagline}</p>}
        {x.description && <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{x.description}</p>}
        {x.location && <p className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground"><MapPin className="size-3.5 shrink-0" /><span className="truncate">{x.location}</span></p>}
        <div className="mt-auto flex items-center justify-between gap-2 pt-4">
          <span className="text-xs text-muted-foreground">{fmtDate(x.date)}</span>
          <span className="inline-flex items-center gap-1 rounded-full bg-primary-soft px-3 py-1.5 text-xs font-semibold text-primary transition group-hover:bg-primary group-hover:text-white">{x.type === 'store' ? 'Visit store' : 'View card'}<ArrowUpRight className="size-3.5" /></span>
        </div>
      </div>
    </a>
  );
}

/** 1 2 3 ... 9 10 style page list */
const pageList = (cur, last) => {
  const set = new Set([1, 2, last - 1, last, cur - 1, cur, cur + 1].filter((p) => p >= 1 && p <= last));
  const out = []; let prev = 0;
  for (const p of [...set].sort((a, b) => a - b)) { if (p - prev > 1) out.push('...'); out.push(p); prev = p; }
  return out;
};

export default function Directory() {
  const { settings } = useAuth();
  useSiteTheme(settings.front_theme);
  const [q, setQ] = useState('');
  const [tpl, setTpl] = useState('');
  const [sort, setSort] = useState('recent');
  const [type, setType] = useState('all');
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  useEffect(() => { document.title = 'Business directory'; }, []);
  useEffect(() => { setPage(1); }, [q, tpl, sort, type]);
  useEffect(() => {
    const t = setTimeout(() => api.get('/public/directory', { params: { search: q || undefined, template_id: tpl || undefined, sort, type, page } }).then(({ data: d }) => setData(d)), 250);
    return () => clearTimeout(t);
  }, [q, tpl, sort, type, page]);
  const meta = data?.meta;
  const from = meta?.total ? (meta.page - 1) * meta.per_page + 1 : 0;
  const to = meta ? Math.min(meta.total, meta.page * meta.per_page) : 0;
  const go = (p) => { setPage(p); window.scrollTo({ top: 360, behavior: 'smooth' }); };
  return (
    <div className="overflow-x-clip">
      <ScrollProgress />
      <Navbar settings={settings} home={false} />
      <section className="relative overflow-hidden pt-36 pb-10">
        <Aurora className="opacity-60" />
        <div className="relative mx-auto max-w-3xl px-6 text-center">
          <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="font-display text-5xl font-extrabold tracking-tight md:text-6xl">Business directory</motion.h1>
          <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="mt-4 text-lg text-muted-foreground">Find professionals and businesses by name, profession or location.</motion.p>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="mx-auto mt-8 flex max-w-xl items-center gap-2 rounded-2xl border border-border bg-card p-2 shadow-lift focus-within:border-primary">
            <Search className="ml-2 size-5 text-muted-foreground" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, company, city..." className="min-w-0 flex-1 bg-transparent py-2 outline-none" aria-label="Search directory" />
          </motion.div>
        </div>
      </section>
      <div className="mx-auto max-w-6xl px-6 pb-24">
        <div className="mb-6 flex flex-wrap items-center gap-2">
          {SORTS.map(([k, l, I]) => (
            <button key={k} type="button" onClick={() => setSort(k)} aria-pressed={sort === k} className={cn('inline-flex cursor-pointer items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition', sort === k ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground hover:text-foreground')}><I className="size-4" />{l}</button>
          ))}
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <select value={type} onChange={(e) => setType(e.target.value)} className="rounded-full border border-border bg-card px-4 py-2 text-sm outline-none" aria-label="Type">
              {TYPES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
            {type !== 'store' && data?.templates?.length > 0 && (
              <select value={tpl} onChange={(e) => setTpl(e.target.value)} className="rounded-full border border-border bg-card px-4 py-2 text-sm outline-none" aria-label="Profession">
                <option value="">All professions</option>
                {[...new Map(data.templates.map((t) => [t.profession, t])).values()].map((t) => <option key={t.id} value={t.id}>{t.profession}</option>)}
              </select>
            )}
          </div>
        </div>
        {!data ? <div className="grid place-items-center py-20"><Spinner /></div> : !data.data.length ? <EmptyState icon={Search} title="Nothing found" description="Try a different search or filter." /> : (
          <>
            <Stagger key={`${sort}${type}${q}${tpl}${page}`} className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {data.data.map((x) => <StaggerItem key={`${x.type}-${x.id}`}><Tile x={x} /></StaggerItem>)}
            </Stagger>
            <div className="mt-10 flex flex-col items-center justify-between gap-4 sm:flex-row">
              <p className="text-sm text-muted-foreground">Showing <b className="text-foreground">{from}</b> to <b className="text-foreground">{to}</b> of <b className="text-foreground">{meta.total}</b> results</p>
              {meta.pages > 1 && (
                <nav className="flex flex-wrap items-center gap-1" aria-label="Pagination">
                  <button type="button" disabled={meta.page <= 1} onClick={() => go(meta.page - 1)} className="inline-flex size-10 cursor-pointer items-center justify-center rounded-full border border-border bg-card transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40" aria-label="Previous page"><ChevronLeft className="size-4" /></button>
                  {pageList(meta.page, meta.pages).map((p, i) => (p === '...'
                    ? <span key={`d${i}`} className="px-1 text-muted-foreground">...</span>
                    : <button key={p} type="button" onClick={() => go(p)} aria-current={p === meta.page ? 'page' : undefined} className={cn('inline-flex size-10 cursor-pointer items-center justify-center rounded-full text-sm font-medium transition', p === meta.page ? 'bg-foreground text-background' : 'border border-border bg-card hover:bg-muted')}>{p}</button>))}
                  <button type="button" disabled={meta.page >= meta.pages} onClick={() => go(meta.page + 1)} className="inline-flex size-10 cursor-pointer items-center justify-center rounded-full border border-border bg-card transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40" aria-label="Next page"><ChevronRight className="size-4" /></button>
                </nav>
              )}
            </div>
          </>
        )}
      </div>
      <Footer settings={settings} />
      <SiteExtras settings={settings} />
    </div>
  );
}
