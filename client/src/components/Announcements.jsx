/* Announcements: bell with unread count (top bar) + banner for the newest unread one (dashboards) */
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Bell, Megaphone, CheckCheck, X, ArrowRight, Info, CircleCheck, TriangleAlert, OctagonAlert, Gift } from 'lucide-react';
import * as P from '@radix-ui/react-popover';
import api from '@/lib/api';
import { cn } from '@/lib/cn';
import { fmtDateTime } from '@/lib/format';
import { Tip, Dialog, ButtonLink } from '@/components/ui';

const TYPES = {
  info: [Info, 'text-info bg-info-soft', 'from-sky-500 to-indigo-500'], success: [CircleCheck, 'text-success bg-success-soft', 'from-emerald-500 to-teal-500'],
  warning: [TriangleAlert, 'text-warning bg-warning-soft', 'from-amber-500 to-orange-500'], danger: [OctagonAlert, 'text-danger bg-danger-soft', 'from-rose-500 to-red-600'],
  promo: [Gift, 'text-primary bg-primary-soft', 'from-violet-500 to-fuchsia-500'],
};

const Ctx = createContext(null);
export function AnnouncementsProvider({ children }) {
  const [items, setItems] = useState([]);
  const load = useCallback(() => api.get('/auth/announcements').then(({ data }) => setItems(data.data)).catch(() => {}), []);
  useEffect(() => { load(); const t = setInterval(load, 5 * 60 * 1000); return () => clearInterval(t); }, [load]);
  const read = (id) => { setItems((l) => l.map((a) => (a.id === id ? { ...a, read: true } : a))); api.post(`/auth/announcements/${id}/read`).catch(() => {}); };
  const readAll = () => { setItems((l) => l.map((a) => ({ ...a, read: true }))); api.post('/auth/announcements/read-all').catch(() => {}); };
  return <Ctx.Provider value={{ items, read, readAll }}>{children}</Ctx.Provider>;
}
const useAnn = () => useContext(Ctx) || { items: [], read: () => {}, readAll: () => {} };

function Body({ a }) {
  return (
    <>
      {/* body is sanitised on the server when saved */}
      <div className="prose-content text-sm" dangerouslySetInnerHTML={{ __html: a.body || '' }} />
      {a.link_url && <ButtonLink href={a.link_url} target="_blank" rel="noreferrer" size="sm" className="mt-4">{a.link_label || 'Learn more'}<ArrowRight /></ButtonLink>}
    </>
  );
}

export function AnnouncementBell() {
  const { items, read, readAll } = useAnn();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(null);
  const unread = items.filter((a) => !a.read).length;
  return (
    <>
      <P.Root open={open} onOpenChange={setOpen}>
        <Tip content={unread ? `${unread} new announcement${unread > 1 ? 's' : ''}` : 'Announcements'}>
          <P.Trigger asChild>
            <button type="button" className="relative grid size-9 cursor-pointer place-items-center rounded-xl text-muted-foreground transition hover:bg-muted hover:text-foreground" aria-label="Announcements">
              <motion.span animate={unread ? { rotate: [0, -14, 12, -8, 6, 0] } : {}} transition={{ duration: 0.9, repeat: unread ? Infinity : 0, repeatDelay: 6 }}><Bell className="size-[18px]" /></motion.span>
              <AnimatePresence>{unread > 0 && <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} className="absolute top-1 right-1 grid min-w-4 place-items-center rounded-full bg-danger px-1 text-[10px] leading-4 font-bold text-white ring-2 ring-background">{unread}</motion.span>}</AnimatePresence>
            </button>
          </P.Trigger>
        </Tip>
        <P.Portal>
          <P.Content align="end" sideOffset={10} className="anim-pop z-50 w-[min(92vw,380px)] overflow-hidden rounded-2xl border border-border bg-card shadow-lift">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <p className="flex items-center gap-2 text-sm font-semibold"><Megaphone className="size-4 text-primary" />Announcements</p>
              {unread > 0 && <button type="button" onClick={readAll} className="flex cursor-pointer items-center gap-1 text-xs font-medium text-primary hover:underline"><CheckCheck className="size-3.5" />Mark all read</button>}
            </div>
            <div className="max-h-96 overflow-y-auto">
              {!items.length ? <p className="px-4 py-10 text-center text-sm text-muted-foreground">Nothing new right now.</p> : items.map((a) => {
                const [I, tone] = TYPES[a.type] || TYPES.info;
                return (
                  <button key={a.id} type="button" onClick={() => { setView(a); setOpen(false); read(a.id); }} className="flex w-full cursor-pointer gap-3 border-b border-border px-4 py-3 text-left transition last:border-0 hover:bg-muted/50">
                    <span className={cn('grid size-9 shrink-0 place-items-center rounded-xl', tone)}><I className="size-4" /></span>
                    <span className="min-w-0 flex-1"><span className="flex items-center gap-2"><span className={cn('truncate text-sm', a.read ? 'font-medium' : 'font-semibold')}>{a.title}</span>{!a.read && <span className="size-2 shrink-0 rounded-full bg-primary" />}</span><span className="block text-xs text-muted-foreground">{fmtDateTime(a.created_at)}</span></span>
                  </button>
                );
              })}
            </div>
          </P.Content>
        </P.Portal>
      </P.Root>
      <Dialog open={!!view} onOpenChange={(o) => !o && setView(null)} icon={Megaphone} title={view?.title || ''} description={view ? fmtDateTime(view.created_at) : ''}>{view && <Body a={view} />}</Dialog>
    </>
  );
}

export function AnnouncementBanner() {
  const { items, read } = useAnn();
  const [view, setView] = useState(null);
  const a = items.find((x) => !x.read) || items.find((x) => x.pinned);
  if (!a) return null;
  const [I, , grad] = TYPES[a.type] || TYPES.info;
  const text = String(a.body || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  return (
    <>
      <AnimatePresence>
        <motion.div key={a.id} initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }} className={cn('relative mb-6 flex items-center gap-4 overflow-hidden rounded-2xl bg-linear-to-r p-4 pr-12 text-white shadow-lift', grad)}>
          <div className="bg-grid absolute inset-0 opacity-15" />
          <span className="relative grid size-10 shrink-0 place-items-center rounded-xl bg-white/20"><I className="size-5" /></span>
          <button type="button" onClick={() => setView(a)} className="relative min-w-0 flex-1 cursor-pointer text-left">
            <p className="font-semibold">{a.title}</p>
            {text && <p className="truncate text-sm text-white/85">{text}</p>}
          </button>
          {!a.pinned && <Tip content="Dismiss"><button type="button" onClick={() => read(a.id)} className="absolute top-1/2 right-3 grid size-8 -translate-y-1/2 cursor-pointer place-items-center rounded-lg text-white/80 hover:bg-white/15" aria-label="Dismiss"><X className="size-4" /></button></Tip>}
        </motion.div>
      </AnimatePresence>
      <Dialog open={!!view} onOpenChange={(o) => { if (!o) { setView(null); read(a.id); } }} icon={Megaphone} title={a.title} description={fmtDateTime(a.created_at)}><Body a={a} /></Dialog>
    </>
  );
}
