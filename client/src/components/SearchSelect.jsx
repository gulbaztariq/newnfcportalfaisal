/* Search-as-you-type dropdown (e.g. customers by name, e-mail or phone). The server does the matching. */
import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Search, X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/cn';

export default function SearchSelect({ value, onChange, search, renderItem, renderValue, placeholder = 'Search...', empty = 'Nothing found', className, autoFocus, invalid }) {
  const [q, setQ] = useState('');
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [active, setActive] = useState(0);
  const box = useRef(null);
  const input = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    setBusy(true);
    let live = true;
    const t = setTimeout(() => search(q).then((r) => { if (live) { setItems(r); setActive(0); } }).catch(() => live && setItems([])).finally(() => live && setBusy(false)), 250);
    return () => { live = false; clearTimeout(t); };
  }, [q, open]); // eslint-disable-line
  useEffect(() => {
    const close = (e) => { if (box.current && !box.current.contains(e.target)) setOpen(false); };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, []);
  const pick = (item) => { onChange(item); setOpen(false); setQ(''); };
  const onKey = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setActive((a) => Math.min(items.length - 1, a + 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
    if (e.key === 'Enter' && open && items[active]) { e.preventDefault(); pick(items[active]); }
    if (e.key === 'Escape') setOpen(false);
  };

  if (value && renderValue) {
    return (
      <div className={cn('flex items-center gap-3 rounded-xl border border-primary/40 bg-primary-soft/40 px-3 py-2', className)}>
        <div className="min-w-0 flex-1">{renderValue(value)}</div>
        <button type="button" onClick={() => { onChange(null); setTimeout(() => input.current?.focus(), 0); }} className="grid size-7 shrink-0 cursor-pointer place-items-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground" aria-label="Change"><X className="size-4" /></button>
      </div>
    );
  }
  return (
    <div ref={box} className={cn('relative', className)}>
      <div className={cn('flex h-10 items-center gap-2 rounded-xl border bg-card px-3 transition focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/15', invalid ? 'border-danger' : 'border-input')}>
        {busy ? <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" /> : <Search className="size-4 shrink-0 text-muted-foreground" />}
        <input ref={input} value={q} autoFocus={autoFocus} onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} onKeyDown={onKey}
          placeholder={placeholder} className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/70" role="combobox" aria-expanded={open} aria-autocomplete="list" />
      </div>
      <AnimatePresence>
        {open && (
          <motion.ul initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.12 }} role="listbox"
            className="absolute inset-x-0 top-full z-50 mt-1.5 max-h-72 overflow-y-auto rounded-2xl border border-border bg-card p-1.5 shadow-lift">
            {!items.length ? <li className="px-3 py-2.5 text-sm text-muted-foreground">{busy ? 'Searching...' : empty}</li> : items.map((it, i) => (
              <li key={it.id ?? i} role="option" aria-selected={i === active} onPointerEnter={() => setActive(i)} onPointerDown={(e) => { e.preventDefault(); pick(it); }}
                className={cn('cursor-pointer rounded-xl px-3 py-2 text-sm transition', i === active ? 'bg-muted' : '')}>
                {renderItem(it)}
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
