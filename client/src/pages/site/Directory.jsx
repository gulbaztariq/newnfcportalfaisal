import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { BadgeCheck, Briefcase, MapPin, Search, Store, IdCard } from 'lucide-react';
import api from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/cn';
import { Spinner, Aurora, EmptyState, Stagger, StaggerItem } from '@/components/ui';
import { Navbar, Footer, ScrollProgress, SiteExtras, useSiteTheme } from './SiteChrome';

const initials = (v) => (v.first_name || v.name || '?').split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();

function VcardTile({ v }) {
  const color = v.theme?.primary || 'var(--primary)';
  return (
    <a href={`/${v.url_alias}`} target="_blank" rel="noreferrer" className="group block h-full overflow-hidden rounded-3xl border border-border bg-card shadow-soft transition duration-500 hover:-translate-y-1 hover:shadow-lift">
      <div className="relative h-24 overflow-hidden" style={{ background: v.cover_image ? undefined : color }}>
        {v.cover_image && <img src={v.cover_image} alt="" loading="lazy" className="size-full object-cover transition duration-700 group-hover:scale-105" />}
      </div>
      <div className="px-5 pb-5">
        <div className="-mt-9 size-18 overflow-hidden rounded-2xl border-4 border-card bg-muted">
          {v.profile_image ? <img src={v.profile_image} alt="" loading="lazy" className="size-full object-cover" /> : <span className="grid size-full place-items-center font-display text-xl font-bold text-white" style={{ background: color }}>{initials(v)}</span>}
        </div>
        <p className="mt-3 flex items-center gap-1.5 font-display font-semibold">{[v.first_name, v.last_name].filter(Boolean).join(' ') || v.name}{v.is_verified && <BadgeCheck className="size-4 text-sky-500" />}</p>
        {(v.occupation || v.company) && <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted-foreground"><Briefcase className="size-3.5 shrink-0" /><span className="truncate">{[v.occupation, v.company].filter(Boolean).join(' · ')}</span></p>}
        {v.location && <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted-foreground"><MapPin className="size-3.5 shrink-0" /><span className="truncate">{v.location}</span></p>}
        {v.template?.profession && <span className="mt-3 inline-block rounded-full bg-primary-soft px-2.5 py-0.5 text-xs font-medium text-primary">{v.template.profession}</span>}
      </div>
    </a>
  );
}

function StoreTile({ s }) {
  return (
    <a href={`/s/${s.url_alias}`} target="_blank" rel="noreferrer" className="group flex h-full items-center gap-4 rounded-3xl border border-border bg-card p-4 shadow-soft transition hover:-translate-y-1 hover:shadow-lift">
      <span className="size-16 shrink-0 overflow-hidden rounded-2xl bg-muted">{s.logo ? <img src={s.logo} alt="" loading="lazy" className="size-full object-cover" /> : <span className="grid size-full place-items-center text-muted-foreground"><Store className="size-6" /></span>}</span>
      <div className="min-w-0"><p className="truncate font-display font-semibold group-hover:text-primary">{s.name}</p>{s.slogan && <p className="truncate text-sm text-muted-foreground">{s.slogan}</p>}{s.address && <p className="truncate text-xs text-muted-foreground">{s.address}</p>}</div>
    </a>
  );
}

export default function Directory() {
  const { settings } = useAuth();
  useSiteTheme(settings.front_theme);
  const [q, setQ] = useState('');
  const [tpl, setTpl] = useState('');
  const [data, setData] = useState(null);
  const [tab, setTab] = useState('vcards');
  useEffect(() => { document.title = 'Business directory'; }, []);
  useEffect(() => {
    const t = setTimeout(() => api.get('/public/directory', { params: { search: q || undefined, template_id: tpl || undefined } }).then(({ data: d }) => setData(d)), 250);
    return () => clearTimeout(t);
  }, [q, tpl]);
  const list = tab === 'vcards' ? data?.data : data?.stores;
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
          {[['vcards', 'People', IdCard], ['stores', 'Stores', Store]].map(([k, l, I]) => (
            <button key={k} type="button" onClick={() => setTab(k)} className={cn('inline-flex cursor-pointer items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition', tab === k ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground hover:text-foreground')}><I className="size-4" />{l}</button>
          ))}
          {tab === 'vcards' && data?.templates?.length > 0 && (
            <select value={tpl} onChange={(e) => setTpl(e.target.value)} className="ml-auto rounded-full border border-border bg-card px-4 py-2 text-sm outline-none" aria-label="Profession">
              <option value="">All professions</option>
              {data.templates.map((t) => <option key={t.id} value={t.id}>{t.profession}</option>)}
            </select>
          )}
        </div>
        {!data ? <div className="grid place-items-center py-20"><Spinner /></div> : !list?.length ? <EmptyState icon={tab === 'vcards' ? IdCard : Store} title="Nothing found" description="Try a different search." /> : (
          <Stagger key={`${tab}${q}${tpl}`} className={cn('grid gap-5 sm:grid-cols-2', tab === 'vcards' ? 'lg:grid-cols-3 xl:grid-cols-4' : 'lg:grid-cols-3')}>
            {list.map((x) => <StaggerItem key={x.id}>{tab === 'vcards' ? <VcardTile v={x} /> : <StoreTile s={x} />}</StaggerItem>)}
          </Stagger>
        )}
      </div>
      <Footer settings={settings} />
      <SiteExtras settings={settings} />
    </div>
  );
}
