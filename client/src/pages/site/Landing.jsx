import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence, useScroll, useTransform } from 'motion/react';
import * as Acc from '@radix-ui/react-accordion';
import { toast } from 'sonner';
import {
  ArrowRight, Nfc, QrCode, LayoutTemplate, BarChart3, MessageSquareHeart, UserPlus, Sparkles, Check, X, ChevronLeft, ChevronRight, ChevronDown,
  Eye, BellRing, Contact, Zap, Palette, Share2, Star, Mail, Send, Leaf, RefreshCw, Users, Quote, ShieldCheck, Globe2,
} from 'lucide-react';
import api from '@/lib/api';
import { cn } from '@/lib/cn';
import { Button, ButtonLink, Dialog, Input, Textarea, Segmented, Reveal, Stagger, StaggerItem, CountUp, Marquee, Spotlight, Tilt, Ripples, Aurora, Spinner } from '@/components/ui';
import { Navbar, Footer, ScrollProgress, SiteExtras, useSiteTheme } from './SiteChrome';
import { BlogCard } from './Blog';
import { ShopSection } from './ShopSection';
import { FEATURE_LABELS } from '@/lib/features';
import { recaptchaToken } from '@/lib/thirdparty';

const FEATURE_ICONS = [Nfc, QrCode, LayoutTemplate, BarChart3, MessageSquareHeart, UserPlus, Palette, ShieldCheck, Globe2];
const ABOUT_ICONS = [Leaf, RefreshCw, Users, Zap, ShieldCheck, Sparkles];

function SectionHead({ eyebrow, title, text, center = true, light }) {
  return (
    <Reveal className={cn('mb-14 max-w-2xl', center && 'mx-auto text-center')}>
      <span className={cn('inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold tracking-wide uppercase', light ? 'border-white/15 bg-white/5 text-white/80' : 'border-primary/20 bg-primary-soft text-primary')}>
        <span className="size-1.5 animate-pulse rounded-full bg-current" />{eyebrow}
      </span>
      <h2 className={cn('mt-4 font-display text-4xl leading-[1.08] font-bold tracking-tight text-balance md:text-5xl', light && 'text-white')}>{title}</h2>
      {text && <p className={cn('mt-4 text-lg text-balance', light ? 'text-white/65' : 'text-muted-foreground')}>{text}</p>}
    </Reveal>
  );
}

/* ================================================================= hero */
function RotatingWord({ words }) {
  const [i, setI] = useState(0);
  useEffect(() => { const t = setInterval(() => setI((x) => (x + 1) % words.length), 2200); return () => clearInterval(t); }, [words.length]);
  return (
    <span className="relative inline-flex h-[1.15em] overflow-hidden align-bottom">
      <AnimatePresence mode="popLayout">
        <motion.span key={words[i]} initial={{ y: '100%', opacity: 0, filter: 'blur(6px)' }} animate={{ y: 0, opacity: 1, filter: 'blur(0px)' }} exit={{ y: '-100%', opacity: 0, filter: 'blur(6px)' }} transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }} className="text-gradient whitespace-nowrap">
          {words[i]}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

function FloatChip({ icon: Icon, title, sub, className, delay, tone = 'bg-primary' }) {
  return (
    <motion.div initial={{ opacity: 0, scale: 0.8, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ delay, type: 'spring', stiffness: 200, damping: 18 }} className={cn('absolute z-10', className)}>
      <div className="glass animate-float flex items-center gap-3 rounded-2xl border border-border p-3 pr-4 shadow-lift" style={{ animationDelay: `${delay}s` }}>
        <span className={cn('grid size-9 place-items-center rounded-xl text-white', tone)}><Icon className="size-4.5" /></span>
        <div><p className="text-[13px] font-semibold leading-tight">{title}</p><p className="text-[11px] text-muted-foreground">{sub}</p></div>
      </div>
    </motion.div>
  );
}

function Phone({ slug = 'vcard8', className }) {
  return (
    <div className={cn('relative rounded-[3rem] bg-zinc-900 p-3 shadow-[0_40px_100px_-30px_rgba(76,29,149,.6)] ring-1 ring-white/10 dark:ring-white/15', className)}>
      <div className="absolute top-5 left-1/2 z-10 h-6 w-24 -translate-x-1/2 rounded-full bg-zinc-900" />
      <div className="relative h-[620px] w-[300px] overflow-hidden rounded-[2.4rem] bg-white">
        <iframe src={`/t/preview/${slug}`} title="Live vCard preview" loading="lazy" tabIndex={-1} scrolling="no" className="pointer-events-none absolute top-0 left-0 h-[827px] w-[400px] origin-top-left scale-75 border-0" />
      </div>
    </div>
  );
}

function Hero({ s, professions }) {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] });
  const y = useTransform(scrollYProgress, [0, 1], [0, 140]);
  const fade = useTransform(scrollYProgress, [0, 0.7], [1, 0]);
  const title = s.home_title || 'Digital Business Cards for Everyone';
  const words = title.split(' ');
  return (
    <section ref={ref} id="home" className="relative overflow-hidden pt-32 pb-20 md:pt-40">
      <Aurora />
      <div className="bg-grid mask-radial absolute inset-0 opacity-60" />
      <div className="relative mx-auto grid max-w-6xl items-center gap-16 px-6 lg:grid-cols-[1.1fr_1fr]">
        <motion.div style={{ opacity: fade }}>
          <motion.a href="#how" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}
            className="group inline-flex items-center gap-2 rounded-full border border-border bg-card/70 py-1 pr-3 pl-1 text-xs font-medium shadow-soft backdrop-blur">
            <span className="rounded-full bg-primary px-2 py-0.5 text-[11px] font-semibold text-white">New</span>
            NFC · QR · Link sharing in one card <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
          </motion.a>
          <h1 className="mt-6 font-display text-5xl leading-[1.02] font-extrabold tracking-tight text-balance sm:text-6xl lg:text-7xl">
            {words.map((w, i) => (
              <motion.span key={i} initial={{ opacity: 0, y: 30, filter: 'blur(8px)' }} animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }} transition={{ delay: 0.1 + i * 0.07, duration: 0.7, ease: [0.16, 1, 0.3, 1] }} className="mr-[0.22em] inline-block">{w}</motion.span>
            ))}
          </h1>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }} className="mt-5 font-display text-2xl font-semibold text-muted-foreground sm:text-3xl">
            Made for <RotatingWord words={professions} />
          </motion.p>
          <motion.p initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7, duration: 0.6 }} className="mt-6 max-w-lg text-lg leading-relaxed text-muted-foreground">{s.home_sub_text}</motion.p>
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.85, duration: 0.6 }} className="mt-9 flex flex-wrap items-center gap-3">
            <ButtonLink as={Link} to={s.register_enable !== '0' ? '/register' : '/login'} size="xl" className="group">Create your card free <ArrowRight className="transition-transform group-hover:translate-x-1" /></ButtonLink>
            <ButtonLink href="#templates" variant="outline" size="xl"><LayoutTemplate />Browse templates</ButtonLink>
          </motion.div>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.05 }} className="mt-10 flex items-center gap-4">
            <div className="flex -space-x-3">
              {['from-violet-500 to-fuchsia-500', 'from-sky-500 to-cyan-400', 'from-amber-400 to-orange-500', 'from-emerald-400 to-teal-500'].map((g, i) => (
                <span key={g} className={`grid size-10 place-items-center rounded-full border-2 border-background bg-linear-to-br ${g} text-xs font-bold text-white`}>{['AK', 'SR', 'MJ', 'LP'][i]}</span>
              ))}
            </div>
            <div className="text-sm">
              <div className="flex text-amber-400">{[0, 1, 2, 3, 4].map((i) => <Star key={i} className="size-4 fill-current" />)}</div>
              <p className="text-muted-foreground">Loved by professionals worldwide</p>
            </div>
          </motion.div>
        </motion.div>

        <motion.div style={{ y }} className="relative mx-auto">
          <div className="absolute top-1/2 left-1/2 size-[420px] -translate-x-1/2 -translate-y-1/2"><Ripples color="bg-primary/15" /></div>
          <motion.div initial={{ opacity: 0, y: 60, rotateX: 20 }} animate={{ opacity: 1, y: 0, rotateX: 0 }} transition={{ delay: 0.3, duration: 1.1, ease: [0.16, 1, 0.3, 1] }}>
            <Tilt max={8}><Phone /></Tilt>
          </motion.div>
          <FloatChip icon={Eye} title="+128 views" sub="this week" tone="bg-linear-to-br from-violet-500 to-indigo-500" delay={1.1} className="top-16 -left-20 max-sm:-left-4" />
          <FloatChip icon={BellRing} title="New lead" sub="Sarah sent a message" tone="bg-linear-to-br from-fuchsia-500 to-pink-500" delay={1.3} className="top-1/2 -right-20 max-sm:-right-4" />
          <FloatChip icon={Contact} title="Saved to contacts" sub="just now" tone="bg-linear-to-br from-emerald-500 to-teal-500" delay={1.5} className="bottom-20 -left-16 max-sm:-left-2" />
        </motion.div>
      </div>
    </section>
  );
}

/* ============================================================ marquee */
function Professions({ templates }) {
  const list = [...new Set(templates.map((t) => t.profession))];
  return (
    <section className="border-y border-border bg-card/50 py-8">
      <p className="mb-6 text-center text-xs font-semibold tracking-[0.2em] text-muted-foreground uppercase">Templates crafted for every profession</p>
      <Marquee duration={50}>
        {list.map((p) => <span key={p} className="flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium whitespace-nowrap shadow-soft"><Sparkles className="size-3.5 text-primary" />{p}</span>)}
      </Marquee>
    </section>
  );
}

/* =========================================================== features */
function Features({ features }) {
  if (!features.length) return null;
  const spans = ['md:col-span-2 md:row-span-2', '', '', 'md:col-span-2', '', ''];
  return (
    <section id="features" className="relative py-28">
      <div className="mx-auto max-w-6xl px-6">
        <SectionHead eyebrow="Features" title={<>Everything a paper card <span className="text-gradient">never could</span></>} text="Share instantly, update anytime, and see exactly who's engaging with your card." />
        <Stagger className="grid auto-rows-[minmax(200px,auto)] gap-4 md:grid-cols-4">
          {features.map((f, i) => {
            const Icon = FEATURE_ICONS[i % FEATURE_ICONS.length];
            const big = i === 0;
            return (
              <StaggerItem key={f.id} className={cn(spans[i % spans.length])}>
                <Spotlight className={cn('group h-full rounded-3xl border border-border bg-card p-7 shadow-soft transition-all duration-500 hover:-translate-y-1 hover:shadow-lift', big && 'bg-linear-to-br from-violet-600 to-fuchsia-600 text-white')}>
                  {f.image ? <img src={f.image} alt="" className="mb-5 size-12 rounded-2xl object-cover" /> : (
                    <span className={cn('mb-5 grid size-12 place-items-center rounded-2xl transition-transform duration-500 group-hover:scale-110 group-hover:-rotate-6', big ? 'bg-white/20 text-white' : 'bg-primary-soft text-primary')}><Icon className="size-6" /></span>
                  )}
                  <h3 className={cn('font-display font-bold tracking-tight', big ? 'text-3xl' : 'text-lg')}>{f.title}</h3>
                  <p className={cn('mt-2 leading-relaxed', big ? 'max-w-sm text-lg text-white/80' : 'text-sm text-muted-foreground')}>{f.description}</p>
                  {big && (
                    <div className="relative mt-10 h-40">
                      <div className="absolute bottom-0 left-4 grid size-28 place-items-center"><Ripples color="bg-white/25" /><span className="relative grid size-16 place-items-center rounded-full bg-white text-violet-600 shadow-2xl"><Nfc className="size-8" /></span></div>
                      <motion.div animate={{ x: [0, 18, 0], rotate: [-8, -2, -8] }} transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }} className="absolute right-4 bottom-2 h-36 w-24 rounded-2xl border border-white/30 bg-white/15 p-2 backdrop-blur">
                        <div className="h-8 rounded-lg bg-white/40" /><div className="mt-2 h-2 w-3/4 rounded bg-white/50" /><div className="mt-1.5 h-2 w-1/2 rounded bg-white/30" />
                        <div className="mt-3 grid grid-cols-3 gap-1">{[0, 1, 2].map((k) => <div key={k} className="h-5 rounded bg-white/30" />)}</div>
                      </motion.div>
                    </div>
                  )}
                </Spotlight>
              </StaggerItem>
            );
          })}
        </Stagger>
      </div>
    </section>
  );
}

/* ======================================================= how it works */
function HowItWorks() {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 70%', 'end 60%'] });
  const width = useTransform(scrollYProgress, [0, 1], ['0%', '100%']);
  const steps = [
    { icon: UserPlus, title: 'Create your card', text: 'Sign up and pick a template made for your profession. Your first card is ready in seconds.' },
    { icon: Palette, title: 'Make it yours', text: 'Add photos, links, services and business hours. Change colours, fonts and sections anytime.' },
    { icon: Share2, title: 'Tap, scan or share', text: 'Share with an NFC card, QR code or link. Every update is live instantly, everywhere.' },
  ];
  return (
    <section id="how" ref={ref} className="relative overflow-hidden bg-zinc-950 py-28 text-white">
      <div className="bg-grid mask-radial absolute inset-0 opacity-20" />
      <div className="absolute -top-40 left-1/2 size-[600px] -translate-x-1/2 rounded-full bg-violet-600/30 blur-[140px]" />
      <div className="relative mx-auto max-w-6xl px-6">
        <SectionHead light eyebrow="How it works" title="Three steps to a smarter first impression" />
        <div className="relative">
          <div className="absolute top-8 right-[16%] left-[16%] hidden h-0.5 rounded bg-white/10 md:block">
            <motion.div style={{ width }} className="h-full rounded bg-linear-to-r from-violet-400 via-fuchsia-400 to-lime-300" />
          </div>
          <div className="grid gap-10 md:grid-cols-3">
            {steps.map((st, i) => (
              <Reveal key={st.title} delay={i * 0.15} className="relative text-center">
                <div className="relative mx-auto grid size-16 place-items-center rounded-2xl border border-white/15 bg-zinc-900 shadow-[0_0_40px_-10px] shadow-violet-500">
                  <st.icon className="size-7 text-violet-300" />
                  <span className="absolute -top-2 -right-2 grid size-6 place-items-center rounded-full bg-lime-300 text-xs font-bold text-zinc-900">{i + 1}</span>
                </div>
                <h3 className="mt-6 font-display text-xl font-bold">{st.title}</h3>
                <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-white/60">{st.text}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ========================================================= templates */
function Templates({ templates }) {
  const scroller = useRef(null);
  const list = templates.slice(0, 14);
  const by = (d) => scroller.current?.scrollBy({ left: d * 320, behavior: 'smooth' });
  return (
    <section id="templates" className="py-28">
      <div className="mx-auto max-w-6xl px-6">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <SectionHead center={false} eyebrow={`${templates.length}+ templates`} title="Beautiful from the very first tap" text="Every template is live below. Pick one, then make every colour, font and section your own." />
          <div className="mb-14 flex gap-2">
            <Button variant="outline" size="icon" onClick={() => by(-1)} aria-label="Previous"><ChevronLeft /></Button>
            <Button variant="outline" size="icon" onClick={() => by(1)} aria-label="Next"><ChevronRight /></Button>
          </div>
        </div>
      </div>
      <div ref={scroller} className="flex snap-x snap-mandatory gap-5 overflow-x-auto px-6 pb-6 [scrollbar-width:none] md:px-[max(1.5rem,calc((100vw-72rem)/2+1.5rem))]">
        {list.map((t, i) => (
          <motion.a key={t.id} href={`/t/preview/${t.slug}`} target="_blank" rel="noreferrer" initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: (i % 5) * 0.08, duration: 0.6 }}
            whileHover={{ y: -8 }} className="group w-[260px] shrink-0 snap-start">
            <div className="tpl-box rounded-3xl border border-border shadow-soft transition-shadow duration-500 group-hover:shadow-lift" style={{ '--tpl-scale': 0.65 }}>
              <iframe src={`/t/preview/${t.slug}`} title={t.name} loading="lazy" tabIndex={-1} scrolling="no" className="tpl-frame" />
              <div className="absolute inset-x-3 bottom-3 flex translate-y-3 items-center justify-center gap-1.5 rounded-xl bg-zinc-900/85 py-2 text-xs font-medium text-white opacity-0 backdrop-blur transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100"><Eye className="size-3.5" />Live preview</div>
            </div>
            <p className="mt-3 font-display font-semibold">{t.name}</p>
            <p className="text-sm text-muted-foreground">{t.profession}</p>
          </motion.a>
        ))}
      </div>
    </section>
  );
}

/* ============================================================== stats */
function Stats({ templates, plans }) {
  const items = [[templates.length, '+', 'Profession templates'], [100, '%', 'Live updates, no reprints'], [3, '', 'Ways to share: tap, scan, link'], [plans.length, '', 'Plans for every stage']];
  return (
    <section className="mx-auto max-w-6xl px-6">
      <Reveal className="grid overflow-hidden rounded-3xl border border-border bg-card shadow-soft sm:grid-cols-2 lg:grid-cols-4">
        {items.map(([v, suf, l], i) => (
          <div key={l} className={cn('p-8 text-center', i && 'border-t border-border sm:border-t-0 sm:border-l')}>
            <p className="font-display text-5xl font-extrabold tracking-tight"><span className="text-gradient"><CountUp value={v} />{suf}</span></p>
            <p className="mt-2 text-sm text-muted-foreground">{l}</p>
          </div>
        ))}
      </Reveal>
    </section>
  );
}

/* ============================================================== about */
function About({ about, appName }) {
  if (!about.length) return null;
  return (
    <section id="about" className="py-28">
      <div className="mx-auto max-w-6xl px-6">
        <SectionHead eyebrow="Why us" title={<>Why teams choose <span className="text-gradient">{appName}</span></>} />
        <div className="grid gap-5 md:grid-cols-3">
          {about.map((a, i) => {
            const Icon = ABOUT_ICONS[i % ABOUT_ICONS.length];
            return (
              <Reveal key={a.id} delay={i * 0.1}>
                <div className="group h-full overflow-hidden rounded-3xl border border-border bg-card shadow-soft transition duration-500 hover:shadow-lift">
                  {a.image ? <div className="overflow-hidden"><img src={a.image} alt="" className="aspect-video w-full object-cover transition duration-700 group-hover:scale-105" /></div> : (
                    <div className="relative grid aspect-video place-items-center overflow-hidden bg-linear-to-br from-primary-soft to-transparent">
                      <div className="bg-grid absolute inset-0 opacity-50" />
                      <Icon className="relative size-14 text-primary transition duration-500 group-hover:scale-110 group-hover:rotate-6" />
                    </div>
                  )}
                  <div className="p-6"><h3 className="font-display text-lg font-bold">{a.title}</h3><p className="mt-2 text-sm leading-relaxed text-muted-foreground">{a.description}</p></div>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ============================================================ pricing */
function Pricing({ plans, registerEnabled }) {
  const freqs = ['monthly', 'yearly', 'unlimited'].filter((f) => plans.some((p) => p.frequency === f));
  const [freq, setFreq] = useState(freqs[0] || 'monthly');
  const shown = plans.filter((p) => p.frequency === freq);
  const per = { monthly: '/month', yearly: '/year', unlimited: ' lifetime' };
  return (
    <section id="pricing" className="relative overflow-hidden bg-muted/40 py-28">
      <div className="mx-auto max-w-6xl px-6">
        <SectionHead eyebrow="Pricing" title="Simple pricing that grows with you" text="Start free. Upgrade when you need more cards, templates and features." />
        {freqs.length > 1 && <div className="mb-12 flex justify-center"><Segmented id="price" value={freq} onChange={setFreq} options={freqs.map((f) => ({ value: f, label: f === 'unlimited' ? 'Lifetime' : f[0].toUpperCase() + f.slice(1) }))} /></div>}
        <AnimatePresence mode="wait">
          <motion.div key={freq} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className={cn('mx-auto grid gap-6', shown.length === 1 ? 'max-w-md' : shown.length === 2 ? 'max-w-3xl md:grid-cols-2' : 'md:grid-cols-3')}>
            {shown.map((p, i) => {
              const featured = shown.length > 1 ? i === Math.min(1, shown.length - 1) : true;
              return (
                <div key={p.id} className={cn('relative flex flex-col rounded-3xl border bg-card p-8 shadow-soft transition duration-500 hover:-translate-y-1 hover:shadow-lift', featured ? 'border-beam border-transparent shadow-glow' : 'border-border')}>
                  {featured && <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-linear-to-r from-violet-600 to-fuchsia-600 px-3 py-1 text-xs font-semibold text-white shadow-lg">Most popular</span>}
                  <p className="font-display text-lg font-bold">{p.name}</p>
                  <p className="mt-4 flex items-baseline gap-1"><span className="font-display text-5xl font-extrabold tracking-tight">{p.currency?.currency_icon || '$'}{Number(p.price).toLocaleString()}</span><span className="text-muted-foreground">{per[p.frequency]}</span></p>
                  {p.trial_days > 0 ? <p className="mt-2 text-sm font-medium text-primary">{p.trial_days}-day free trial</p> : <p className="mt-2 text-sm text-muted-foreground">No credit card required</p>}
                  <ul className="mt-7 flex-1 space-y-3 text-sm">
                    <li className="flex gap-3"><Check className="size-5 shrink-0 text-success" /><span><b>{p.no_of_vcards}</b> digital card{p.no_of_vcards > 1 ? 's' : ''}</span></li>
                    <li className="flex gap-3"><Check className="size-5 shrink-0 text-success" /><span><b>{p.templates_count}</b> premium templates</span></li>
                    {Object.entries(FEATURE_LABELS).slice(0, 9).map(([k, l]) => (
                      <li key={k} className={cn('flex gap-3', !p.features?.[k] && 'text-muted-foreground/60')}>
                        {p.features?.[k] ? <Check className="size-5 shrink-0 text-success" /> : <X className="size-5 shrink-0" />}{l}
                      </li>
                    ))}
                  </ul>
                  <ButtonLink as={Link} to={registerEnabled ? '/register' : '/login'} variant={featured ? 'primary' : 'outline'} size="lg" className="mt-8 w-full">Get started</ButtonLink>
                </div>
              );
            })}
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
}

/* ======================================================= testimonials */
function Testimonials({ testimonials }) {
  if (!testimonials.length) return null;
  const list = testimonials.length < 5 ? [...testimonials, ...testimonials, ...testimonials] : testimonials;
  const card = (t, k) => (
    <figure key={k} className="w-[360px] shrink-0 rounded-3xl border border-border bg-card p-6 shadow-soft">
      <Quote className="size-7 text-primary/30" />
      <blockquote className="mt-3 text-[15px] leading-relaxed">{t.description}</blockquote>
      <figcaption className="mt-5 flex items-center gap-3">
        {t.image ? <img src={t.image} alt="" className="size-10 rounded-full object-cover" /> : <span className="grid size-10 place-items-center rounded-full bg-linear-to-br from-violet-500 to-fuchsia-500 font-semibold text-white">{t.name[0]}</span>}
        <div><p className="text-sm font-semibold">{t.name}</p><p className="text-xs text-muted-foreground">{t.designation}</p></div>
        <div className="ml-auto flex text-amber-400">{[0, 1, 2, 3, 4].map((i) => <Star key={i} className="size-3.5 fill-current" />)}</div>
      </figcaption>
    </figure>
  );
  return (
    <section id="testimonials" className="py-28">
      <SectionHead eyebrow="Testimonials" title="People love tapping into it" />
      <div className="space-y-5">
        <Marquee duration={60}>{list.map((t, i) => card(t, `a${i}`))}</Marquee>
        <Marquee duration={70} reverse>{[...list].reverse().map((t, i) => card(t, `b${i}`))}</Marquee>
      </div>
    </section>
  );
}

/* ================================================================ faq */
function Faq({ faqs }) {
  if (!faqs.length) return null;
  return (
    <section id="faq" className="py-28">
      <div className="mx-auto grid max-w-6xl gap-12 px-6 lg:grid-cols-[1fr_1.4fr]">
        <SectionHead center={false} eyebrow="FAQ" title="Questions? We've got answers." text="Can't find what you're looking for? Send us a message below." />
        <Reveal>
          <Acc.Root type="single" collapsible defaultValue={String(faqs[0].id)} className="space-y-3">
            {faqs.map((f) => (
              <Acc.Item key={f.id} value={String(f.id)} className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft transition data-[state=open]:border-primary/40 data-[state=open]:shadow-lift">
                <Acc.Header>
                  <Acc.Trigger className="group flex w-full cursor-pointer items-center justify-between gap-4 px-6 py-5 text-left font-medium">
                    {f.title}
                    <span className="grid size-8 shrink-0 place-items-center rounded-full bg-muted transition duration-300 group-data-[state=open]:rotate-180 group-data-[state=open]:bg-primary group-data-[state=open]:text-white"><ChevronDown className="size-4" /></span>
                  </Acc.Trigger>
                </Acc.Header>
                <Acc.Content className="anim-acc overflow-hidden"><p className="px-6 pb-5 text-sm leading-relaxed text-muted-foreground">{f.description}</p></Acc.Content>
              </Acc.Item>
            ))}
          </Acc.Root>
        </Reveal>
      </div>
    </section>
  );
}

/* ================================================================ cta */
function Cta({ registerEnabled }) {
  return (
    <section className="px-6">
      <Reveal className="relative mx-auto max-w-6xl overflow-hidden rounded-[2.5rem] bg-linear-to-br from-violet-700 via-violet-600 to-fuchsia-600 px-8 py-20 text-center text-white shadow-[0_40px_100px_-30px] shadow-violet-600">
        <div className="bg-grid absolute inset-0 opacity-20 mask-radial" />
        <div className="absolute top-1/2 left-1/2 size-72 -translate-x-1/2 -translate-y-1/2"><Ripples color="bg-white/10" /></div>
        <div className="relative">
          <span className="mx-auto mb-6 grid size-16 place-items-center rounded-2xl bg-white/15 backdrop-blur"><Nfc className="size-8" /></span>
          <h2 className="mx-auto max-w-2xl font-display text-4xl font-extrabold tracking-tight text-balance md:text-6xl">Ready to make every hello count?</h2>
          <p className="mx-auto mt-5 max-w-lg text-lg text-white/75">Create your digital business card in minutes. No design skills needed.</p>
          <div className="mt-9 flex flex-wrap justify-center gap-3">
            <ButtonLink as={Link} to={registerEnabled ? '/register' : '/login'} variant="white" size="xl" className="group">Get started free <ArrowRight className="transition-transform group-hover:translate-x-1" /></ButtonLink>
            <ButtonLink href="#contact" size="xl" className="border border-white/30 bg-white/10 text-white backdrop-blur hover:bg-white/20">Talk to us</ButtonLink>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

/* ============================================================ contact */
function ContactSection({ s }) {
  const [f, setF] = useState({ name: '', email: '', subject: '', message: '', website: '' });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const set = (k) => (e) => { setF({ ...f, [k]: e.target.value }); setErrors({ ...errors, [k]: undefined }); };
  const submit = async (e) => {
    e.preventDefault(); setBusy(true);
    try { const { data } = await api.post('/public/contact', { ...f, recaptcha_token: await recaptchaToken(s, 'contact') }); toast.success(data.message); setSent(true); setF({ name: '', email: '', subject: '', message: '', website: '' }); } catch (ex) { setErrors(ex.errors || {}); toast.error(Object.values(ex.errors || {})[0] || ex.message); } finally { setBusy(false); }
  };
  return (
    <section id="contact" className="py-28">
      <div className="mx-auto grid max-w-6xl gap-10 px-6 lg:grid-cols-[1fr_1.3fr]">
        <div>
          <SectionHead center={false} eyebrow="Contact" title="Let's talk" text="Questions about plans, NFC cards or bulk orders for your team? We usually reply within a day." />
          <div className="space-y-3">
            {[[Mail, 'E-mail', s.email, `mailto:${s.email}`], [Send, 'Phone', s.phone && `+${s.region_code} ${s.phone}`, s.phone && `tel:+${s.region_code}${s.phone}`], [Globe2, 'Address', s.address]].filter((x) => x[2]).map(([I, l, v, h]) => (
              <Reveal key={l}><a href={h || undefined} className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4 shadow-soft transition hover:border-primary/40">
                <span className="grid size-11 place-items-center rounded-xl bg-primary-soft text-primary"><I className="size-5" /></span>
                <div><p className="text-xs text-muted-foreground">{l}</p><p className="font-medium">{v}</p></div>
              </a></Reveal>
            ))}
          </div>
        </div>
        <Reveal>
          <form onSubmit={submit} noValidate className="relative overflow-hidden rounded-3xl border border-border bg-card p-8 shadow-lift">
            <AnimatePresence>{sent && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-10 grid place-items-center bg-card/95 text-center backdrop-blur">
                <div>
                  <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 14 }} className="mx-auto grid size-16 place-items-center rounded-full bg-success text-white"><Check className="size-8" /></motion.span>
                  <p className="mt-4 font-display text-xl font-bold">Message sent!</p><p className="mt-1 text-sm text-muted-foreground">We&apos;ll get back to you soon.</p>
                  <Button variant="outline" className="mt-5" onClick={() => setSent(false)}>Send another</Button>
                </div>
              </motion.div>
            )}</AnimatePresence>
            <div className="grid gap-4 sm:grid-cols-2">
              <div><Input placeholder="Full name" value={f.name} onChange={set('name')} aria-invalid={!!errors.name || undefined} />{errors.name && <p className="mt-1 text-xs text-danger">{errors.name}</p>}</div>
              <div><Input type="email" placeholder="E-mail" value={f.email} onChange={set('email')} aria-invalid={!!errors.email || undefined} />{errors.email && <p className="mt-1 text-xs text-danger">{errors.email}</p>}</div>
              <Input className="sm:col-span-2" placeholder="Subject" value={f.subject} onChange={set('subject')} />
              <div className="sm:col-span-2"><Textarea rows={6} placeholder="How can we help?" value={f.message} onChange={set('message')} aria-invalid={!!errors.message || undefined} />{errors.message && <p className="mt-1 text-xs text-danger">{errors.message}</p>}</div>
              <input tabIndex={-1} autoComplete="off" className="hidden" value={f.website} onChange={set('website')} />
            </div>
            <Button type="submit" size="lg" loading={busy} className="mt-5 w-full">Send message <Send /></Button>
          </form>
        </Reveal>
      </div>
    </section>
  );
}

/* =============================================================== blog */
function BlogSection({ blogs, enabled }) {
  if (!enabled || !blogs?.length) return null;
  return (
    <section id="blog" className="py-28">
      <div className="mx-auto max-w-6xl px-6">
        <SectionHead eyebrow="Blog" title="Fresh from the blog" text="Ideas to network smarter and make every introduction count." />
        <Stagger className="grid gap-6 md:grid-cols-3">{blogs.map((b) => <StaggerItem key={b.id}><BlogCard b={b} /></StaggerItem>)}</Stagger>
        <div className="mt-10 text-center"><ButtonLink as={Link} to="/blog" variant="outline">All articles <ArrowRight /></ButtonLink></div>
      </div>
    </section>
  );
}

/* ============================================================= banner */
function Banner({ s }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (s.banner_enable !== '1') return undefined;
    let seen = false; try { seen = sessionStorage.getItem('banner-seen') === '1'; } catch { /* ignore */ }
    if (seen) return undefined;
    const t = setTimeout(() => { setOpen(true); try { sessionStorage.setItem('banner-seen', '1'); } catch { /* ignore */ } }, 2500);
    return () => clearTimeout(t);
  }, [s.banner_enable]);
  return (
    <Dialog open={open} onOpenChange={setOpen} size="sm" title={s.banner_title} description={s.banner_description} icon={Sparkles}
      footer={<><Button variant="outline" onClick={() => setOpen(false)}>Maybe later</Button><ButtonLink href={s.banner_url || '/register'}>{s.banner_button || 'Get started'} <ArrowRight /></ButtonLink></>} />
  );
}

export default function Landing() {
  const [d, setD] = useState(null);
  useEffect(() => { api.get('/public/landing').then(({ data }) => setD(data)); }, []);
  useSiteTheme(d?.settings.front_theme);
  useEffect(() => { if (d) document.title = d.settings.site_title || d.settings.app_name; }, [d]);
  if (!d) return <div className="grid min-h-screen place-items-center"><Spinner /></div>;
  const s = d.settings;
  const professions = [...new Set(d.templates.map((t) => `${t.profession.split(/[ /]/)[0].toLowerCase()}s`))].slice(0, 12);
  const reg = s.register_enable !== '0';
  return (
    <div className="overflow-x-clip">
      <ScrollProgress />
      <Navbar settings={s} />
      <Hero s={s} professions={professions.length ? professions : ['everyone']} />
      <Professions templates={d.templates} />
      <Features features={d.features} />
      <ShopSection />
      <Stats templates={d.templates} plans={d.plans} />
      <HowItWorks />
      <Templates templates={d.templates} />
      <About about={d.about} appName={s.app_name} />
      <Pricing plans={d.plans} registerEnabled={reg} />
      <Testimonials testimonials={d.testimonials} />
      <Faq faqs={d.faqs} />
      <BlogSection blogs={d.blogs} enabled={s.front_blog_enable !== '0'} />
      <Cta registerEnabled={reg} />
      <ContactSection s={s} />
      <Footer settings={s} />
      <Banner s={s} />
      <SiteExtras settings={s} />
    </div>
  );
}
