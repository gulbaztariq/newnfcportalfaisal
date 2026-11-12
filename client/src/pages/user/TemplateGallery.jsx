import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Search, Check, Lock, Heart, Eye, X, ChevronLeft, ChevronRight, Smartphone, Monitor, Sparkles, LayoutGrid } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Input, Button, Badge, Segmented, EmptyState } from '@/components/ui';
import { Preview } from '../admin/VcardsAdmin';

const FAV_KEY = 'tpl_favourites';
const readFavs = () => { try { return JSON.parse(localStorage.getItem(FAV_KEY) || '[]'); } catch { return []; } };
const PAGE = 12;
const SORTS = [{ value: 'recommended', label: 'Recommended' }, { value: 'new', label: 'New' }, { value: 'popular', label: 'Popular' }, { value: 'favourites', label: 'Favourites' }];

/**
 * Template gallery: search, category chips, sorting, favourites (kept in this browser), badges and a full-screen live preview.
 * `value` is the applied template id; choosing a template only calls onChange, the card content is never touched.
 */
export default function TemplateGallery({ templates, value, onChange }) {
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const [sort, setSort] = useState('recommended');
  const [mine, setMine] = useState(false);
  const [favs, setFavs] = useState(readFavs);
  const [limit, setLimit] = useState(PAGE);
  const [open, setOpen] = useState(null); // template shown full screen

  const cats = useMemo(() => [...new Set(templates.map((t) => t.category).filter(Boolean))], [templates]);
  const toggleFav = (slug) => setFavs((f) => { const n = f.includes(slug) ? f.filter((x) => x !== slug) : [...f, slug]; try { localStorage.setItem(FAV_KEY, JSON.stringify(n)); } catch { /* private mode */ } return n; });

  const shown = useMemo(() => {
    const text = q.trim().toLowerCase();
    let rows = templates.filter((t) => (!text || `${t.name} ${t.profession} ${t.category} ${t.description || ''}`.toLowerCase().includes(text)) && (!cat || t.category === cat) && (!mine || t.allowed !== false));
    if (sort === 'favourites') rows = rows.filter((t) => favs.includes(t.slug));
    const rank = (t) => (t.id === value ? 0 : t.collection === 'signature' ? 1 : 2);
    if (sort === 'recommended') rows = [...rows].sort((a, b) => rank(a) - rank(b) || a.id - b.id);
    if (sort === 'new') rows = [...rows].sort((a, b) => Number(!!b.is_new) - Number(!!a.is_new) || b.id - a.id);
    if (sort === 'popular') rows = [...rows].sort((a, b) => (b.uses || 0) - (a.uses || 0) || a.id - b.id);
    return rows;
  }, [templates, q, cat, sort, mine, favs, value]);
  useEffect(() => { setLimit(PAGE); }, [q, cat, sort, mine]);

  const index = open ? shown.findIndex((t) => t.id === open.id) : -1;
  const step = (d) => { const n = shown[index + d]; if (n) setOpen(n); };

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Input icon={Search} placeholder="Search templates, e.g. luxury, doctor, glass" value={q} onChange={(e) => setQ(e.target.value)} className="min-w-56 flex-1 sm:max-w-sm" aria-label="Search templates" />
        <Segmented id="tpl-sort" size="sm" value={sort} onChange={setSort} options={SORTS} className="max-w-full overflow-x-auto" />
        <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground"><input type="checkbox" className="size-4 accent-[var(--primary)]" checked={mine} onChange={(e) => setMine(e.target.checked)} />In my plan</label>
      </div>
      <div className="mb-5 flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Categories">
        {['', ...cats].map((c) => (
          <button key={c || 'all'} type="button" role="tab" aria-selected={cat === c} onClick={() => setCat(c)}
            className={cn('shrink-0 cursor-pointer rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition', cat === c ? 'border-primary bg-primary text-white shadow-glow' : 'border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground')}>
            {c || 'All'}<span className="ml-1.5 opacity-70">{templates.filter((t) => !c || t.category === c).length}</span>
          </button>
        ))}
      </div>

      {!shown.length ? <EmptyState icon={LayoutGrid} title={sort === 'favourites' ? 'No favourites yet' : 'No templates match'} description={sort === 'favourites' ? 'Tap the heart on a template to keep it here.' : 'Try another search or category.'} /> : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {shown.slice(0, limit).map((t) => {
            const on = value === t.id;
            const locked = t.allowed === false;
            return (
              <motion.div key={t.id} layout initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} whileHover={{ y: -4 }}
                className={cn('group relative overflow-hidden rounded-3xl border-2 bg-card transition-colors', on ? 'border-primary shadow-glow' : 'border-border hover:border-primary/40')}>
                <button type="button" onClick={() => setOpen(t)} className="relative block w-full cursor-pointer text-left" aria-label={`Preview ${t.name}`}>
                  <Preview src={`/t/preview/${t.slug}`} title={t.name} scale={0.55} className={locked ? 'opacity-60 grayscale' : ''} />
                  <span className="absolute inset-0 grid place-items-center bg-zinc-950/0 opacity-0 transition duration-300 group-hover:bg-zinc-950/35 group-hover:opacity-100"><span className="flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-medium text-zinc-900 shadow-lg"><Eye className="size-4" />Preview</span></span>
                </button>
                <div className="pointer-events-none absolute top-3 left-3 flex flex-wrap gap-1.5">
                  {t.collection === 'signature' && <Badge tone="primary"><Sparkles className="size-3" />Signature</Badge>}
                  {t.is_new && <Badge tone="success">New</Badge>}
                  {locked && <Badge tone="warning"><Lock className="size-3" />Upgrade</Badge>}
                </div>
                <div className="absolute top-3 right-3 flex gap-1.5">
                  <button type="button" onClick={() => toggleFav(t.slug)} aria-pressed={favs.includes(t.slug)} aria-label={favs.includes(t.slug) ? 'Remove from favourites' : 'Add to favourites'}
                    className={cn('grid size-8 cursor-pointer place-items-center rounded-full shadow-lg backdrop-blur transition', favs.includes(t.slug) ? 'bg-rose-500 text-white' : 'bg-white/90 text-zinc-700 hover:text-rose-500')}><Heart className="size-4" fill={favs.includes(t.slug) ? 'currentColor' : 'none'} /></button>
                  <AnimatePresence>{on && <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} className="grid size-8 place-items-center rounded-full bg-primary text-white shadow-lg" title="Applied"><Check className="size-4" strokeWidth={3} /></motion.span>}</AnimatePresence>
                </div>
                <div className="flex items-center gap-3 p-3.5">
                  <div className="min-w-0 flex-1"><p className="truncate font-display text-sm font-semibold">{t.name}</p><p className="truncate text-xs text-muted-foreground">{t.category}{t.collection !== 'signature' && t.profession ? ` · ${t.profession}` : ''}</p></div>
                  {on ? <Badge tone="primary" dot>Applied</Badge> : <Button size="sm" variant="soft" disabled={locked} onClick={() => onChange(t.id)}>Use</Button>}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
      {shown.length > limit && <div className="mt-6 flex justify-center"><Button variant="outline" onClick={() => setLimit((l) => l + PAGE)}>Show more ({shown.length - limit} left)</Button></div>}

      <FullPreview t={open} applied={open && value === open.id} onClose={() => setOpen(null)} onUse={() => { onChange(open.id); setOpen(null); }}
        onPrev={index > 0 ? () => step(-1) : null} onNext={index >= 0 && index < shown.length - 1 ? () => step(1) : null} fav={open && favs.includes(open.slug)} onFav={() => toggleFav(open.slug)} />
    </>
  );
}

/** Full-screen live preview of one template (the real page, with a sample profile), phone or desktop width */
function FullPreview({ t, applied, onClose, onUse, onPrev, onNext, fav, onFav }) {
  const [device, setDevice] = useState('phone');
  useEffect(() => {
    if (!t) return undefined;
    const key = (e) => { if (e.key === 'Escape') onClose(); if (e.key === 'ArrowLeft' && onPrev) onPrev(); if (e.key === 'ArrowRight' && onNext) onNext(); };
    window.addEventListener('keydown', key); document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', key); document.body.style.overflow = ''; };
  }, [t, onClose, onPrev, onNext]);
  return createPortal(
    <AnimatePresence>
      {t && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[60] flex flex-col bg-zinc-950/90 backdrop-blur-md" role="dialog" aria-modal="true" aria-label={`${t.name} preview`}>
          <div className="flex flex-wrap items-center gap-3 px-4 py-3 text-white">
            <div className="min-w-0 flex-1"><p className="truncate font-display font-semibold">{t.name}</p><p className="truncate text-xs text-white/60">{t.description || t.profession}</p></div>
            <div className="hidden rounded-xl bg-white/10 p-1 sm:flex">
              {[['phone', Smartphone], ['desktop', Monitor]].map(([d, I]) => <button key={d} type="button" onClick={() => setDevice(d)} aria-pressed={device === d} aria-label={`${d} width`} className={cn('grid size-9 cursor-pointer place-items-center rounded-lg transition', device === d ? 'bg-white text-zinc-900' : 'text-white/70 hover:text-white')}><I className="size-4" /></button>)}
            </div>
            <button type="button" onClick={onFav} aria-pressed={!!fav} aria-label="Favourite" className={cn('grid size-10 cursor-pointer place-items-center rounded-xl transition', fav ? 'bg-rose-500 text-white' : 'bg-white/10 text-white hover:bg-white/20')}><Heart className="size-4" fill={fav ? 'currentColor' : 'none'} /></button>
            {applied ? <Badge tone="success" dot>Applied</Badge> : <Button onClick={onUse} disabled={t.allowed === false}>{t.allowed === false ? <><Lock />Not in your plan</> : <><Check />Use this template</>}</Button>}
            <button type="button" onClick={onClose} aria-label="Close preview" className="grid size-10 cursor-pointer place-items-center rounded-xl bg-white/10 text-white hover:bg-white/20"><X className="size-5" /></button>
          </div>
          <div className="relative flex min-h-0 flex-1 items-center justify-center gap-4 px-3 pb-4">
            <button type="button" onClick={onPrev || undefined} disabled={!onPrev} aria-label="Previous template" className="grid size-11 shrink-0 cursor-pointer place-items-center rounded-full bg-white/10 text-white transition hover:bg-white/20 disabled:opacity-20"><ChevronLeft /></button>
            <motion.div key={`${t.slug}-${device}`} initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.25 }}
              className={cn('h-full overflow-hidden bg-white shadow-2xl ring-1 ring-white/10', device === 'phone' ? 'aspect-[9/19] max-h-[820px] max-w-full rounded-[2.2rem]' : 'w-full max-w-5xl rounded-2xl')}>
              <iframe src={`/t/preview/${t.slug}?full=1`} title={`${t.name} live preview`} className="size-full border-0" />
            </motion.div>
            <button type="button" onClick={onNext || undefined} disabled={!onNext} aria-label="Next template" className="grid size-11 shrink-0 cursor-pointer place-items-center rounded-full bg-white/10 text-white transition hover:bg-white/20 disabled:opacity-20"><ChevronRight /></button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
