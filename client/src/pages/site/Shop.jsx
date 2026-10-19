/*
 * Public NFC shop: catalogue (/shop), product (/shop/:slug), checkout (/checkout) and order tracking (/track, /track/:number).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence, useInView } from 'motion/react';
import * as Pop from '@radix-ui/react-popover';
import { toast } from 'sonner';
import {
  ShoppingBag, Plus, Eye, Star, Ruler, Sparkles, Truck, ShieldCheck, Smartphone, RefreshCw, ArrowRight, ArrowLeft, Check, ChevronDown,
  Search, MapPin, User, Palette, UploadCloud, FileText, CreditCard, Banknote, Wallet, Package, PackageCheck, Printer, PenTool, ClipboardCheck,
  XCircle, Undo2, Copy, Nfc, QrCode, LayoutTemplate, Wand2, AlertTriangle, LogIn, Receipt, X, PartyPopper, Hash, Home, Pencil, Link2,
} from 'lucide-react';
import api from '@/lib/api';
import { useAuth, homeFor } from '@/lib/auth';
import { cn } from '@/lib/cn';
import { fmtDate, fmtDateTime } from '@/lib/format';
import { recaptchaToken } from '@/lib/thirdparty';
import { useCart, EnsureCart, useCatalog, formatPrice, unitPrice, QtyStepper, LineThumb } from '@/lib/cart';
import { Button, ButtonLink, Input, Textarea, Field, Select, Dialog, Reveal, Spinner, Aurora, EmptyState, Switch, Skeleton, Badge, Ripples, Tilt } from '@/components/ui';
import { Navbar, Footer, ScrollProgress, SiteExtras, useSiteTheme } from './SiteChrome';

const ease = [0.16, 1, 0.3, 1];
const num = (v) => Number(v || 0) || 0;
const firstError = (e) => Object.values(e?.errors || {})[0] || e?.message || 'Something went wrong';
const store = {
  get: (k, fb) => { try { const v = sessionStorage.getItem(k); return v ? JSON.parse(v) : fb; } catch { return fb; } },
  set: (k, v) => { try { sessionStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ } },
  del: (k) => { try { sessionStorage.removeItem(k); } catch { /* ignore */ } },
};
const copy = async (text) => { try { await navigator.clipboard.writeText(text); toast.success('Copied'); } catch { toast.error('Could not copy'); } };

/* ================================================================ product helpers */
export const variantsOf = (p) => { const v = p?.variants; if (Array.isArray(v)) return v.filter((x) => x?.name); try { const j = JSON.parse(v); return Array.isArray(j) ? j.filter((x) => x?.name) : []; } catch { return []; } };
export const imagesOf = (p) => { if (!p) return []; const extra = Array.isArray(p.images) ? p.images : []; return [...new Set([p.front_image, p.back_image, ...extra.map((x) => (typeof x === 'string' ? x : x?.url))].filter(Boolean))]; };
export const sortProducts = (list) => [...(list || [])].sort((a, b) => Number(!!b.featured) - Number(!!a.featured) || num(a.sort) - num(b.sort) || a.id - b.id);
const discountPct = (p) => (num(p.compare_price) > num(p.price) && num(p.price) > 0 ? Math.round((1 - num(p.price) / num(p.compare_price)) * 100) : 0);

const GRADS = ['from-violet-600 via-fuchsia-600 to-pink-500', 'from-sky-500 via-indigo-600 to-violet-700', 'from-emerald-500 via-teal-600 to-cyan-700', 'from-amber-400 via-orange-500 to-rose-600', 'from-zinc-700 via-zinc-900 to-black', 'from-rose-500 via-fuchsia-600 to-indigo-700'];
function shapeOf(p) {
  const n = `${p?.name || ''} ${p?.category || ''}`.toLowerCase();
  if (n.includes('keyring')) return 'key';
  if (/\bring\b/.test(n)) return 'ring';
  if (n.includes('band')) return 'band';
  if (n.includes('standee')) return 'standee';
  if (/sticker|coin|epoxy/.test(n)) return 'round';
  if (/plate|tag/.test(n)) return 'plate';
  return 'card';
}

/** Illustrated product when the admin has not uploaded photos */
export function ProductArt({ p, side = 'front', className }) {
  const shape = shapeOf(p);
  const Icon = side === 'back' ? QrCode : Nfc;
  const glass = 'border border-white/35 bg-white/15 shadow-2xl backdrop-blur-md';
  const move = 'transition duration-700 ease-[cubic-bezier(.16,1,.3,1)] group-hover:scale-105 group-hover:-rotate-6';
  return (
    <div className={cn('relative grid size-full place-items-center overflow-hidden bg-linear-to-br text-white', GRADS[num(p?.id) % GRADS.length], className)}>
      <div className="bg-grid absolute inset-0 opacity-25" />
      <div className="absolute -top-1/4 -right-1/4 size-3/4 rounded-full bg-white/15 blur-3xl" />
      <div className="absolute inset-[30%]"><Ripples color="bg-white/10" count={2} /></div>
      {shape === 'card' && (
        <div className={cn('relative flex aspect-[1.586] w-[64%] flex-col justify-between rounded-[9%/14%] p-[6%]', glass, move)}>
          <div className="flex items-start justify-between"><Icon className="size-[22%] min-w-5" /><span className="h-[18%] w-[16%] rounded bg-linear-to-br from-amber-200 to-amber-400 opacity-90" /></div>
          <div className="space-y-1"><div className="h-1.5 w-2/3 rounded-full bg-white/70" /><div className="h-1.5 w-1/3 rounded-full bg-white/40" /></div>
        </div>
      )}
      {shape === 'standee' && (
        <div className={cn('relative flex w-[42%] flex-col items-center', move)}>
          <div className={cn('grid aspect-[5/6] w-full place-items-center rounded-2xl', glass)}><Icon className="size-1/3" /></div>
          <div className="-mt-1 h-3 w-[120%] rounded-full bg-white/40 shadow-xl" />
        </div>
      )}
      {shape === 'key' && (
        <div className={cn('relative flex w-[40%] flex-col items-center', move)}>
          <span className="size-[34%] rounded-full border-4 border-white/70" />
          <div className={cn('-mt-1 grid aspect-square w-full place-items-center rounded-[38%]', glass)}><Icon className="size-2/5" /></div>
        </div>
      )}
      {shape === 'ring' && (
        <div className={cn('relative grid aspect-square w-[46%] place-items-center rounded-full border-[12px] border-white/70 shadow-2xl', move)}>
          <span className="absolute -top-3 grid size-8 place-items-center rounded-xl bg-white text-violet-600 shadow-lg"><Icon className="size-4" /></span>
        </div>
      )}
      {shape === 'band' && (
        <div className={cn('relative grid h-[26%] w-[74%] place-items-center rounded-full', glass, move)}>
          <span className="grid size-10 place-items-center rounded-full bg-white/90 text-violet-600"><Icon className="size-5" /></span>
        </div>
      )}
      {shape === 'round' && <div className={cn('relative grid aspect-square w-[44%] place-items-center rounded-full', glass, move)}><Icon className="size-2/5" /></div>}
      {shape === 'plate' && <div className={cn('relative grid aspect-square w-[50%] place-items-center rounded-[22%]', glass, move)}><Icon className="size-2/5" /></div>}
    </div>
  );
}

function ProductMedia({ p, className }) {
  const imgs = imagesOf(p);
  if (!imgs.length) return <ProductArt p={p} className={className} />;
  return (
    <div className={cn('relative size-full', className)}>
      <img src={imgs[0]} alt={p.name} loading="lazy" className={cn('absolute inset-0 size-full object-cover transition duration-700 group-hover:scale-105', imgs[1] && 'group-hover:opacity-0')} />
      {imgs[1] && <img src={imgs[1]} alt="" loading="lazy" className="absolute inset-0 size-full scale-105 object-cover opacity-0 transition duration-700 group-hover:scale-100 group-hover:opacity-100" />}
    </div>
  );
}

/** Selected variant / customisation / quantity for a product */
function useOptions(p) {
  const variants = variantsOf(p);
  const [variant, setVariant] = useState(variants[0]?.name || null);
  const [custom, setCustom] = useState(false);
  const [qty, setQty] = useState(1);
  useEffect(() => { setVariant(variantsOf(p)[0]?.name || null); setCustom(false); setQty(1); }, [p?.id]); // eslint-disable-line
  const v = variants.find((x) => x.name === variant) || null;
  const unit = num(p?.price) + num(v?.price_delta);
  const cPrice = num(p?.customization_price);
  const each = unit + (custom && cPrice > 0 ? cPrice : 0);
  const item = p ? { product_id: p.id, slug: p.slug, name: p.name, image: imagesOf(p)[0] || null, price: unit, variant: v?.name || null, customization: custom && cPrice > 0, customization_price: cPrice, quantity: qty } : null;
  return { variants, variant, setVariant, custom, setCustom, qty, setQty, unit, cPrice, each, total: each * qty, item };
}

function ProductOptions({ p, o, money, onAdd, onBuy, addRef, compact }) {
  return (
    <div className="space-y-5">
      {o.variants.length > 0 && (
        <div>
          <p id={`var-${p.id}`} className="mb-2 text-[13px] font-medium">Choose an option</p>
          <div role="radiogroup" aria-labelledby={`var-${p.id}`} className="flex flex-wrap gap-2">
            {o.variants.map((v) => {
              const on = o.variant === v.name;
              return (
                <button key={v.name} type="button" role="radio" aria-checked={on} onClick={() => o.setVariant(v.name)}
                  className={cn('relative cursor-pointer rounded-xl border-2 px-4 py-2 text-sm font-medium transition', on ? 'border-primary text-primary' : 'border-border hover:border-primary/40')}>
                  {on && <motion.span layoutId={`vpill-${p.id}${compact ? 'q' : ''}`} className="absolute inset-0 -z-10 rounded-[10px] bg-primary-soft" transition={{ type: 'spring', stiffness: 500, damping: 35 }} />}
                  {v.name}{num(v.price_delta) !== 0 && <span className="ml-1 text-xs text-muted-foreground">{num(v.price_delta) > 0 ? '+' : ''}{money(v.price_delta)}</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}
      {o.cPrice > 0 && (
        <label htmlFor={`cust-${p.id}${compact ? 'q' : ''}`} className={cn('flex cursor-pointer items-center gap-3 rounded-2xl border-2 p-3.5 transition', o.custom ? 'border-primary bg-primary-soft/50' : 'border-border hover:border-primary/40')}>
          <span className={cn('grid size-10 shrink-0 place-items-center rounded-xl transition', o.custom ? 'bg-primary text-white' : 'bg-muted text-muted-foreground')}><Palette className="size-5" /></span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium">Customise it <span className="text-primary">+{money(o.cPrice)}</span></span>
            <span className="block text-xs text-muted-foreground">Your logo, colours and details printed on it</span>
          </span>
          <Switch id={`cust-${p.id}${compact ? 'q' : ''}`} checked={o.custom} onChange={o.setCustom} />
        </label>
      )}
      <div className="flex items-center justify-between gap-3">
        <QtyStepper value={o.qty} onChange={o.setQty} />
        <div className="text-right">
          <p className="text-xs text-muted-foreground">Total</p>
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.p key={o.total} initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -10, opacity: 0 }} className="font-display text-2xl font-extrabold">{money(o.total)}</motion.p>
          </AnimatePresence>
        </div>
      </div>
      <div ref={addRef} className="flex flex-col gap-2 sm:flex-row">
        <Button size="lg" className="group flex-1" onClick={onAdd}><ShoppingBag />Add to cart</Button>
        {onBuy && <Button size="lg" variant="outline" className="flex-1" onClick={onBuy}>Buy now <ArrowRight /></Button>}
      </div>
    </div>
  );
}

function PriceTag({ p, money, size = 'md' }) {
  const pct = discountPct(p);
  return (
    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
      <span className={cn('font-display font-extrabold tracking-tight', size === 'lg' ? 'text-3xl md:text-4xl' : 'text-base sm:text-lg')}>{num(p.price) > 0 ? money(p.price) : 'Price on request'}</span>
      {pct > 0 && <span className={cn('text-muted-foreground line-through', size === 'lg' ? 'text-lg' : 'text-xs sm:text-sm')}>{money(p.compare_price)}</span>}
      {pct > 0 && size === 'lg' && <Badge tone="success">Save {pct}%</Badge>}
    </div>
  );
}

/* ================================================================ product card + quick view */
export function ProductCard({ p, money, onQuick }) {
  const cart = useCart();
  const pct = discountPct(p);
  const hasVariants = variantsOf(p).length > 0;
  const quickAdd = () => {
    if (hasVariants) return onQuick?.(p);
    return cart?.add({ product_id: p.id, slug: p.slug, name: p.name, image: imagesOf(p)[0] || null, price: num(p.price), quantity: 1 });
  };
  return (
    <div className="group relative flex h-full flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-soft transition duration-500 hover:-translate-y-1 hover:shadow-lift">
      <Link to={`/shop/${p.slug}`} className="relative block aspect-square overflow-hidden bg-muted" aria-label={p.name}>
        <ProductMedia p={p} />
        <div className="absolute top-2.5 left-2.5 flex flex-col items-start gap-1.5 sm:top-3 sm:left-3">
          {p.featured && <span className="inline-flex items-center gap-1 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-semibold text-zinc-900 shadow sm:text-xs"><Star className="size-3 fill-amber-400 text-amber-400" />Bestseller</span>}
          {pct > 0 && <span className="rounded-full bg-lime-300 px-2 py-0.5 text-[10px] font-bold text-zinc-900 shadow sm:text-xs">-{pct}%</span>}
        </div>
      </Link>
      {onQuick && (
        <button type="button" onClick={() => onQuick(p)} aria-label={`Quick view ${p.name}`}
          className="absolute top-2.5 right-2.5 grid size-9 cursor-pointer place-items-center rounded-xl bg-white/90 text-zinc-900 shadow-lg transition duration-300 hover:scale-110 sm:top-3 sm:right-3 sm:translate-y-1 sm:opacity-0 sm:group-hover:translate-y-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100">
          <Eye className="size-4" />
        </button>
      )}
      <div className="flex flex-1 flex-col p-3 sm:p-5">
        {p.category && <p className="truncate text-[10px] font-semibold tracking-wider text-primary uppercase sm:text-[11px]">{p.category}</p>}
        <Link to={`/shop/${p.slug}`} className="mt-1 line-clamp-2 font-display text-sm leading-snug font-semibold text-balance transition hover:text-primary sm:text-base">{p.name}</Link>
        {p.size_label && <p className="mt-1 flex items-center gap-1 truncate text-[11px] text-muted-foreground sm:text-xs"><Ruler className="size-3 shrink-0" /><span className="truncate">{p.size_label}</span></p>}
        {num(p.customization_price) > 0 && (
          <span className="mt-2 inline-flex w-fit items-center gap-1 rounded-full bg-primary-soft px-2 py-0.5 text-[10px] font-medium text-primary sm:text-[11px]"><Sparkles className="size-3" />Customisable +{money(p.customization_price)}</span>
        )}
        <div className="mt-auto flex items-end justify-between gap-2 pt-3">
          <PriceTag p={p} money={money} />
          <motion.button type="button" whileTap={{ scale: 0.9 }} onClick={quickAdd} aria-label={hasVariants ? `Choose options for ${p.name}` : `Add ${p.name} to cart`}
            className="grid size-9 shrink-0 cursor-pointer place-items-center rounded-xl bg-primary text-white shadow-[0_6px_20px_-8px_var(--primary)] transition hover:brightness-110 sm:size-10">
            <Plus className="size-4 transition-transform duration-300 group-hover:rotate-90" />
          </motion.button>
        </div>
      </div>
    </div>
  );
}

function Gallery({ p, compact }) {
  const imgs = imagesOf(p);
  const slides = imgs.length ? imgs.map((src) => ({ src })) : [{ art: 'front' }, { art: 'back' }];
  const [i, setI] = useState(0);
  useEffect(() => setI(0), [p?.id]);
  const cur = slides[Math.min(i, slides.length - 1)];
  return (
    <div>
      <Tilt max={compact ? 4 : 6} className="group relative aspect-square overflow-hidden rounded-3xl border border-border bg-muted shadow-soft">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.div key={i} initial={{ opacity: 0, scale: 1.04 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.45, ease }} className="absolute inset-0">
            {cur.src ? <img src={cur.src} alt={p.name} className="size-full object-cover" /> : <ProductArt p={p} side={cur.art} />}
          </motion.div>
        </AnimatePresence>
        {!imgs.length && <span className="absolute bottom-3 left-3 rounded-full bg-black/35 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur">{cur.art === 'back' ? 'Back: QR code' : 'Front: NFC chip inside'}</span>}
      </Tilt>
      {slides.length > 1 && (
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {slides.map((s, k) => (
            <button key={s.src || s.art} type="button" onClick={() => setI(k)} aria-label={`Show image ${k + 1}`} aria-pressed={k === i}
              className={cn('relative shrink-0 cursor-pointer overflow-hidden rounded-xl border-2 transition', compact ? 'size-14' : 'size-16 sm:size-20', k === i ? 'border-primary' : 'border-transparent opacity-70 hover:opacity-100')}>
              {s.src ? <img src={s.src} alt="" className="size-full object-cover" /> : <ProductArt p={p} side={s.art} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function QuickView({ product, onClose, money }) {
  const cart = useCart();
  const last = useRef(null);
  if (product) last.current = product;
  const p = product || last.current;
  const o = useOptions(p);
  return (
    <Dialog open={!!product} onOpenChange={(v) => !v && onClose()} size="xl" title={p?.name || ''} description={p?.short_description || p?.size_label}>
      {p && (
        <div className="grid gap-6 md:grid-cols-2">
          <Gallery p={p} compact />
          <div className="flex flex-col">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              {p.category && <Badge tone="primary">{p.category}</Badge>}
              {p.size_label && <Badge tone="outline"><Ruler className="size-3" />{p.size_label}</Badge>}
            </div>
            <PriceTag p={{ ...p, price: o.unit }} money={money} size="lg" />
            <div className="mt-5 flex-1"><ProductOptions compact p={p} o={o} money={money} onAdd={() => { cart?.add(o.item); onClose(); }} /></div>
            <Link to={`/shop/${p.slug}`} onClick={onClose} className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">View full details <ArrowRight className="size-4" /></Link>
          </div>
        </div>
      )}
    </Dialog>
  );
}

/* ================================================================ page chrome */
function Page({ title, children }) {
  const { settings } = useAuth();
  useSiteTheme(settings.front_theme);
  useEffect(() => { if (title) document.title = title; }, [title]);
  return (
    <div className="overflow-x-clip">
      <ScrollProgress />
      <Navbar settings={settings} home={false} />
      {children}
      <Footer settings={settings} />
      <SiteExtras settings={settings} />
    </div>
  );
}

function useShopData() {
  const cat = useCatalog();
  const cart = useCart();
  const setCurrency = cart?.setCurrency;
  useEffect(() => { if (cat.data?.config?.currency && setCurrency) setCurrency(cat.data.config.currency); }, [cat.data, setCurrency]);
  const currency = cat.data?.config?.currency || cart?.currency || 'Rs';
  const money = useCallback((a) => formatPrice(a, currency), [currency]);
  return { ...cat, cfg: cat.data?.config || {}, money };
}

function LoadError({ error, reload }) {
  const closed = error?.response?.status === 404;
  return <EmptyState icon={closed ? ShoppingBag : AlertTriangle} title={closed ? 'The shop is closed right now' : 'Could not load the shop'} description={closed ? 'Please check back soon.' : error?.message} action={!closed && <Button variant="outline" onClick={reload}><RefreshCw />Try again</Button>} />;
}

function GridSkeleton({ n = 8 }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className="overflow-hidden rounded-3xl border border-border bg-card"><Skeleton className="aspect-square h-auto rounded-none" /><div className="space-y-2 p-4"><Skeleton className="h-3 w-1/3" /><Skeleton className="w-4/5" /><Skeleton className="h-6 w-1/2" /></div></div>
      ))}
    </div>
  );
}

const PERKS = [[Smartphone, 'Works with every phone', 'iPhone and Android, no app needed'], [RefreshCw, 'Update anytime', 'Change your profile, the tag stays the same'], [Truck, 'Delivered to your door', 'Tracked courier delivery'], [ShieldCheck, 'Quality checked', 'Every chip is tested before dispatch']];

/* ================================================================ /shop */
export function ShopPage() {
  return <EnsureCart><Page title="Shop NFC products"><ShopInner /></Page></EnsureCart>;
}

function ShopInner() {
  const { data, error, reload, cfg, money } = useShopData();
  const [params, setParams] = useSearchParams();
  const cat = params.get('category') || '';
  const [q, setQ] = useState('');
  const [quick, setQuick] = useState(null);
  const products = useMemo(() => sortProducts(data?.data), [data]);
  const shown = products.filter((p) => (!cat || p.category === cat) && (!q.trim() || `${p.name} ${p.category} ${p.short_description || ''}`.toLowerCase().includes(q.trim().toLowerCase())));
  const setCat = (c) => { const n = new URLSearchParams(params); if (c) n.set('category', c); else n.delete('category'); setParams(n, { replace: true }); };
  const chips = [
    cfg.free_delivery_above > 0 && [Truck, `Free delivery over ${money(cfg.free_delivery_above)}`],
    cfg.cod_enable && [Banknote, 'Cash on delivery'],
    cfg.ai_design && [Wand2, 'Design with AI'],
  ].filter(Boolean);
  return (
    <>
      <section className="relative overflow-hidden pt-32 pb-10 sm:pt-36">
        <Aurora className="opacity-60" />
        <div className="bg-grid mask-radial absolute inset-0 opacity-50" />
        <div className="relative mx-auto max-w-3xl px-4 text-center sm:px-6">
          <motion.span initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary-soft px-3 py-1 text-xs font-semibold tracking-wide text-primary uppercase"><span className="size-1.5 animate-pulse rounded-full bg-current" />NFC shop</motion.span>
          <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05, ease, duration: 0.7 }} className="mt-4 font-display text-4xl leading-[1.05] font-extrabold tracking-tight text-balance sm:text-5xl md:text-6xl">
            Tap once. <span className="text-gradient">Share everything.</span>
          </motion.h1>
          <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12, ease, duration: 0.7 }} className="mt-4 text-base text-balance text-muted-foreground sm:text-lg">NFC cards, standees, tags and wearables that open your digital profile, reviews or socials with a single tap.</motion.p>
          {chips.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, ease, duration: 0.7 }} className="mt-6 flex flex-wrap justify-center gap-2">
              {chips.map(([I, l]) => <span key={l} className="glass inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium"><I className="size-3.5 text-primary" />{l}</span>)}
            </motion.div>
          )}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.26, ease, duration: 0.7 }} className="mx-auto mt-7 flex max-w-md items-center gap-2 rounded-2xl border border-border bg-card p-2 shadow-lift focus-within:border-primary">
            <Search className="ml-2 size-5 shrink-0 text-muted-foreground" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search products..." className="min-w-0 flex-1 bg-transparent py-1.5 outline-none" aria-label="Search products" />
            {q && <button type="button" onClick={() => setQ('')} aria-label="Clear search" className="grid size-7 cursor-pointer place-items-center rounded-lg text-muted-foreground hover:bg-muted"><X className="size-4" /></button>}
          </motion.div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
        {data?.categories?.length > 1 && (
          <div className="-mx-4 mb-6 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0" role="tablist" aria-label="Categories">
            <div className="flex w-max gap-2 sm:w-auto sm:flex-wrap">
              {['', ...data.categories].map((c) => {
                const on = cat === c;
                const n = c ? products.filter((p) => p.category === c).length : products.length;
                return (
                  <button key={c || 'all'} type="button" role="tab" aria-selected={on} onClick={() => setCat(c)}
                    className={cn('relative cursor-pointer rounded-full px-4 py-2 text-sm font-medium whitespace-nowrap transition', on ? 'text-background' : 'bg-muted text-muted-foreground hover:text-foreground')}>
                    {on && <motion.span layoutId="shop-cat" className="absolute inset-0 rounded-full bg-foreground" transition={{ type: 'spring', stiffness: 500, damping: 35 }} />}
                    <span className="relative">{c || 'All'} <span className="opacity-60">{n}</span></span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
        {error ? <LoadError error={error} reload={reload} /> : !data ? <GridSkeleton /> : !products.length ? <EmptyState icon={Package} title="No products yet" description="New NFC products are on the way." /> : !shown.length ? (
          <EmptyState icon={Search} title="No products match" description="Try another search or category." action={<Button variant="outline" onClick={() => { setQ(''); setCat(''); }}>Clear filters</Button>} />
        ) : (
          <motion.div layout className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4">
            <AnimatePresence mode="popLayout">
              {shown.map((p, i) => (
                <motion.div key={p.id} layout initial={{ opacity: 0, y: 24, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1, transition: { duration: 0.5, ease, delay: Math.min(i * 0.04, 0.4) } }} exit={{ opacity: 0, scale: 0.94, transition: { duration: 0.2 } }}>
                  <ProductCard p={p} money={money} onQuick={setQuick} />
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        )}

        <div className="mt-20 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PERKS.map(([I, t, d], i) => (
            <Reveal key={t} delay={i * 0.06} className="group flex items-start gap-3 rounded-3xl border border-border bg-card p-5 shadow-soft">
              <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-primary-soft text-primary transition duration-500 group-hover:scale-110 group-hover:-rotate-6"><I className="size-5" /></span>
              <div><p className="font-display font-semibold">{t}</p><p className="mt-0.5 text-sm text-muted-foreground">{d}</p></div>
            </Reveal>
          ))}
        </div>
      </div>
      <QuickView product={quick} onClose={() => setQuick(null)} money={money} />
    </>
  );
}

/* ================================================================ /shop/:slug */
export function ProductPage() {
  return <EnsureCart><ProductInner /></EnsureCart>;
}

function ProductInner() {
  const { slug } = useParams();
  const { data: catalog, money } = useShopData();
  const [p, setP] = useState(null);
  const [err, setErr] = useState(null);
  const [quick, setQuick] = useState(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let live = true;
    setP(null); setErr(null);
    api.get(`/shop/products/${encodeURIComponent(slug)}`).then(({ data }) => live && setP(data.data)).catch((e) => live && setErr(e));
    return () => { live = false; };
  }, [slug, attempt]);
  const related = useMemo(() => { if (!p) return []; const others = sortProducts(catalog?.data).filter((x) => x.id !== p.id); return [...others.filter((x) => x.category === p.category), ...others.filter((x) => x.category !== p.category)].slice(0, 4); }, [catalog, p]);
  return (
    <Page title={p?.name || 'Shop'}>
      <div className="mx-auto max-w-6xl px-4 pt-28 pb-24 sm:px-6 sm:pt-32">
        <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground">
          <Link to="/shop" className="inline-flex shrink-0 items-center gap-1 font-medium hover:text-primary"><ArrowLeft className="size-4" />Shop</Link>
          {p?.category && <><span aria-hidden>/</span><Link to={`/shop?category=${encodeURIComponent(p.category)}`} className="shrink-0 hover:text-primary">{p.category}</Link></>}
          {p && <><span aria-hidden>/</span><span className="truncate text-foreground" aria-current="page">{p.name}</span></>}
        </nav>
        {err ? (
          err.response?.status === 404 ? <EmptyState icon={Package} title="Product not found" description="It may have been removed or renamed." action={<ButtonLink as={Link} to="/shop">Browse all products</ButtonLink>} />
            : <EmptyState icon={AlertTriangle} title="Could not load this product" description={err.message} action={<Button variant="outline" onClick={() => setAttempt((x) => x + 1)}><RefreshCw />Try again</Button>} />
        ) : !p ? (
          <div className="mt-6 grid gap-10 lg:grid-cols-2"><Skeleton className="aspect-square h-auto rounded-3xl" /><div className="space-y-4"><Skeleton className="h-4 w-24" /><Skeleton className="h-10 w-4/5" /><Skeleton className="h-8 w-1/3" /><Skeleton className="h-24" /><Skeleton className="h-12" /></div></div>
        ) : (
          <>
            <ProductDetail key={p.id} p={p} money={money} />
            {related.length > 0 && (
              <section className="mt-20">
                <Reveal className="mb-6 flex items-end justify-between gap-4"><h2 className="font-display text-2xl font-bold tracking-tight md:text-3xl">You may also like</h2><Link to="/shop" className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-primary hover:underline">View all <ArrowRight className="size-4" /></Link></Reveal>
                <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">{related.map((x, i) => <Reveal key={x.id} delay={i * 0.05} className="h-full"><ProductCard p={x} money={money} onQuick={setQuick} /></Reveal>)}</div>
              </section>
            )}
          </>
        )}
      </div>
      <QuickView product={quick} onClose={() => setQuick(null)} money={money} />
    </Page>
  );
}

function ProductDetail({ p, money }) {
  const { settings } = useAuth();
  const cart = useCart();
  const navigate = useNavigate();
  const o = useOptions(p);
  const addRef = useRef(null);
  const addVisible = useInView(addRef, { margin: '0px 0px -40px 0px' });
  const add = () => cart?.add(o.item);
  const buy = () => { cart?.add(o.item, { silent: true }); navigate('/checkout'); };
  const wa = !!String(settings.home_whatsapp_number || '').replace(/\D/g, '');
  return (
    <>
      <div className="mt-6 grid gap-8 lg:grid-cols-2 lg:gap-14">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease }} className="min-w-0 lg:sticky lg:top-24 lg:self-start"><Gallery p={p} /></motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease, delay: 0.08 }} className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {p.category && <Badge tone="primary">{p.category}</Badge>}
            {p.featured && <Badge tone="warning"><Star className="size-3 fill-current" />Bestseller</Badge>}
          </div>
          <h1 className="mt-3 font-display text-3xl leading-tight font-extrabold tracking-tight text-balance md:text-4xl">{p.name}</h1>
          {p.size_label && <p className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground"><Ruler className="size-4" />Size: {p.size_label}</p>}
          <div className="mt-5"><PriceTag p={{ ...p, price: o.unit }} money={money} size="lg" /></div>
          {p.short_description && <p className="mt-4 leading-relaxed text-muted-foreground">{p.short_description}</p>}
          <div className="mt-7 rounded-3xl border border-border bg-card p-4 shadow-soft sm:p-6">
            <ProductOptions p={p} o={o} money={money} onAdd={add} onBuy={buy} addRef={addRef} />
          </div>
          <ul className="mt-6 grid gap-3 sm:grid-cols-2">
            {PERKS.map(([I, t, d]) => (
              <li key={t} className="flex items-start gap-3 rounded-2xl bg-muted/50 p-3"><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-card text-primary shadow-soft"><I className="size-4" /></span><span><span className="block text-sm font-medium">{t}</span><span className="block text-xs text-muted-foreground">{d}</span></span></li>
            ))}
          </ul>
          {p.description && p.description !== p.short_description && (
            <div className="mt-8">
              <h2 className="font-display text-lg font-semibold">About this product</h2>
              <p className="mt-2 leading-relaxed whitespace-pre-line text-muted-foreground">{p.description}</p>
            </div>
          )}
        </motion.div>
      </div>
      <AnimatePresence>
        {!addVisible && (
          <motion.div initial={{ y: '110%' }} animate={{ y: 0 }} exit={{ y: '110%' }} transition={{ type: 'spring', stiffness: 320, damping: 32 }}
            className={cn('glass fixed inset-x-0 bottom-0 z-30 border-t border-border px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-lift lg:hidden', wa && 'pr-20')}>
            <div className="mx-auto flex max-w-6xl items-center gap-3">
              <LineThumb image={imagesOf(p)[0]} className="size-11" />
              <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{p.name}</p><p className="font-display text-sm font-bold">{money(o.total)}{o.qty > 1 && <span className="font-sans text-xs font-normal text-muted-foreground"> · {o.qty} pcs</span>}</p></div>
              <Button onClick={add} aria-label={`Add ${p.name} to cart`}><ShoppingBag />Add</Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

/* ================================================================ /checkout */
const GATEWAYS = ['stripe', 'paypal', 'razorpay', 'flutterwave', 'paystack', 'phonepe', 'mercadopago', 'cashfree', 'sslcommerz', 'payfast', 'iyzico'];
const PAY_LABEL = { cod: ['Cash on delivery', Banknote], manual: ['Bank transfer / cash', Wallet], stripe: ['Stripe', CreditCard], paypal: ['PayPal', CreditCard], razorpay: ['RazorPay', CreditCard], flutterwave: ['FlutterWave', CreditCard], paystack: ['PayStack', CreditCard], phonepe: ['PhonePe', CreditCard], mercadopago: ['MercadoPago', CreditCard], cashfree: ['Cashfree', CreditCard], sslcommerz: ['SSLCommerz', CreditCard], payfast: ['PayFast', CreditCard], iyzico: ['Iyzico', CreditCard] };
const STEP_META = [['Details', MapPin], ['Design', Palette], ['Payment', CreditCard]];
const DRAFT = 'shop-checkout';
const STYLES = ['Modern minimal', 'Luxury & elegant', 'Bold & colourful', 'Corporate & clean', 'Creative & playful', 'Dark & premium'].map((s) => ({ value: s, label: s }));
const CONTACT_KEYS = ['name', 'phone', 'email', 'address', 'city', 'company_name'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function Stepper({ step, maxStep, onGo }) {
  return (
    <div className="relative mx-auto max-w-xl">
      <div className="absolute top-5 right-[16.66%] left-[16.66%] h-0.5 rounded-full bg-border" aria-hidden />
      <motion.div className="absolute top-5 left-[16.66%] h-0.5 w-[66.66%] origin-left rounded-full bg-linear-to-r from-violet-500 to-fuchsia-500" initial={false} animate={{ scaleX: step / 2 }} transition={{ duration: 0.6, ease }} aria-hidden />
      <ol className="relative flex items-start justify-between" aria-label="Checkout steps">
      {STEP_META.map(([l, I], i) => {
        const done = i < step; const cur = i === step; const can = i <= maxStep && !cur;
        return (
          <li key={l} className="relative z-10 flex w-1/3 flex-col items-center">
            <button type="button" disabled={!can} onClick={() => onGo(i)} aria-current={cur ? 'step' : undefined} aria-label={`Step ${i + 1}: ${l}${done ? ' (done)' : ''}`}
              className={cn('relative grid size-10 place-items-center rounded-full border-2 transition-colors duration-500', done ? 'border-primary bg-primary text-white' : cur ? 'border-primary bg-card text-primary' : 'border-border bg-card text-muted-foreground', can ? 'cursor-pointer' : 'cursor-default')}>
              {cur && <span className="absolute inset-0 animate-ping rounded-full bg-primary/20 [animation-duration:2s]" />}
              <AnimatePresence mode="wait" initial={false}>
                <motion.span key={done ? 'd' : 'i'} initial={{ scale: 0, rotate: -90 }} animate={{ scale: 1, rotate: 0 }} exit={{ scale: 0 }} transition={{ type: 'spring', stiffness: 500, damping: 25 }}>
                  {done ? <Check className="size-4.5" strokeWidth={3} /> : <I className="size-4.5" />}
                </motion.span>
              </AnimatePresence>
            </button>
            <span className={cn('mt-2 text-xs font-medium transition-colors', cur || done ? 'text-foreground' : 'text-muted-foreground')}>{l}</span>
          </li>
        );
      })}
      </ol>
    </div>
  );
}

/** Searchable Leopards city picker (free text allowed when a city is not listed) */
function CityPicker({ cities, value, onChange, invalid, id }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [hi, setHi] = useState(0);
  const listRef = useRef(null);
  const needle = q.trim().toLowerCase();
  const matches = useMemo(() => {
    const all = needle ? cities.filter((c) => c.name.toLowerCase().includes(needle)) : cities;
    return [...all].sort((a, b) => (needle ? Number(!b.name.toLowerCase().startsWith(needle)) - Number(!a.name.toLowerCase().startsWith(needle)) : 0) || a.name.localeCompare(b.name)).slice(0, 80);
  }, [cities, needle]);
  useEffect(() => setHi(0), [needle]);
  useEffect(() => { listRef.current?.querySelector(`[data-i="${hi}"]`)?.scrollIntoView({ block: 'nearest' }); }, [hi]);
  const choose = (c) => { onChange(c); setOpen(false); setQ(''); };
  const custom = needle && !cities.some((c) => c.name.toLowerCase() === needle);
  const onKey = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setHi((h) => Math.min(matches.length - 1, h + 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setHi((h) => Math.max(0, h - 1)); }
    if (e.key === 'Enter') { e.preventDefault(); if (matches[hi]) choose(matches[hi]); else if (custom) choose({ id: '', name: q.trim() }); }
  };
  return (
    <Pop.Root open={open} onOpenChange={setOpen}>
      <Pop.Trigger id={id} aria-invalid={invalid || undefined} className={cn('flex h-10 w-full cursor-pointer items-center gap-2 rounded-xl border border-input bg-card px-3.5 text-left text-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/15 aria-[invalid=true]:border-danger', !value && 'text-muted-foreground/70')}>
        <MapPin className="size-4 shrink-0 text-muted-foreground" /><span className="flex-1 truncate">{value || 'Select your city'}</span><ChevronDown className="size-4 opacity-60" />
      </Pop.Trigger>
      <Pop.Portal>
        <Pop.Content align="start" sideOffset={6} className="anim-pop z-[60] w-[var(--radix-popover-trigger-width)] overflow-hidden rounded-2xl border border-border bg-card shadow-lift" onOpenAutoFocus={(e) => { e.preventDefault(); e.currentTarget.querySelector('input')?.focus(); }}>
          <div className="flex items-center gap-2 border-b border-border px-3"><Search className="size-4 text-muted-foreground" /><input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onKey} placeholder="Search city..." aria-label="Search city" className="h-11 min-w-0 flex-1 bg-transparent text-sm outline-none" /></div>
          <ul ref={listRef} role="listbox" aria-label="Cities" className="max-h-64 overflow-y-auto p-1.5">
            {matches.map((c, i) => (
              <li key={c.id || c.name} data-i={i} role="option" aria-selected={c.name === value} onMouseEnter={() => setHi(i)} onClick={() => choose(c)}
                className={cn('flex cursor-pointer items-center justify-between rounded-xl px-3 py-2 text-sm', i === hi && 'bg-muted', c.name === value && 'font-medium')}>
                {c.name}{c.name === value && <Check className="size-4 text-primary" />}
              </li>
            ))}
            {custom && <li role="option" aria-selected={false} onClick={() => choose({ id: '', name: q.trim() })} className={cn('cursor-pointer rounded-xl px-3 py-2 text-sm text-primary hover:bg-muted', !matches.length && 'bg-muted')}>Use “{q.trim()}”</li>}
            {!matches.length && !custom && <li className="px-3 py-6 text-center text-sm text-muted-foreground">Type to search</li>}
          </ul>
        </Pop.Content>
      </Pop.Portal>
    </Pop.Root>
  );
}

function AiProgress() {
  const [t, setT] = useState(0);
  useEffect(() => { const i = setInterval(() => setT((x) => x + 1), 1000); return () => clearInterval(i); }, []);
  const pct = Math.min(96, 100 * (1 - Math.exp(-t / 24)));
  const msgs = ['Reading your details', 'Sketching layout ideas', 'Choosing colours and type', 'Drawing the front side', 'Composing the back side', 'Adding the final polish'];
  const m = msgs[Math.min(msgs.length - 1, Math.floor(t / 8))];
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="relative overflow-hidden rounded-3xl border border-primary/30 bg-linear-to-br from-violet-600/10 via-fuchsia-500/10 to-lime-300/10 p-5 sm:p-6" role="status" aria-live="polite">
      <div className="grid grid-cols-2 gap-3">
        {[0, 1].map((k) => (
          <motion.div key={k} animate={{ rotateY: [0, 8, -8, 0], y: [0, -4, 0] }} transition={{ duration: 3.2, repeat: Infinity, delay: k * 0.4, ease: 'easeInOut' }} style={{ transformPerspective: 800 }}
            className="skeleton relative aspect-[1.586] overflow-hidden rounded-xl border border-border">
            <motion.span className="absolute inset-y-0 w-1/3 bg-linear-to-r from-transparent via-white/40 to-transparent" animate={{ x: ['-100%', '300%'] }} transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut', delay: k * 0.3 }} />
            <span className="absolute bottom-2 left-2 text-[10px] font-medium text-muted-foreground">{k ? 'Back' : 'Front'}</span>
          </motion.div>
        ))}
      </div>
      <div className="mt-5 flex items-center gap-3">
        <motion.span animate={{ rotate: 360 }} transition={{ duration: 4, repeat: Infinity, ease: 'linear' }} className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary text-white"><Sparkles className="size-4" /></motion.span>
        <div className="min-w-0 flex-1">
          <AnimatePresence mode="wait"><motion.p key={m} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className="truncate text-sm font-medium">{m}...</motion.p></AnimatePresence>
          <p className="text-xs text-muted-foreground">{t}s · usually 30 to 60 seconds, please keep this page open</p>
        </div>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted"><motion.div className="h-full rounded-full bg-linear-to-r from-violet-500 via-fuchsia-500 to-lime-300" animate={{ width: `${pct}%` }} transition={{ duration: 0.9, ease: 'easeOut' }} /></div>
    </motion.div>
  );
}

function DesignPreview({ front, back, className }) {
  return (
    <div className={cn('grid grid-cols-2 gap-3', className)}>
      {[['Front', front], ['Back', back]].map(([l, src]) => (
        <figure key={l} className="min-w-0">
          <div className="grid aspect-[1.586] place-items-center overflow-hidden rounded-xl border border-border bg-white shadow-soft">
            {src ? <img src={src} alt={`${l} of the design`} className="size-full object-contain" /> : <span className="text-xs text-zinc-400">No {l.toLowerCase()}</span>}
          </div>
          <figcaption className="mt-1.5 text-center text-xs text-muted-foreground">{l}</figcaption>
        </figure>
      ))}
    </div>
  );
}

const isPdf = (u) => /\.pdf($|\?)/i.test(String(u || ''));

function UploadBox({ value, onChange }) {
  const [drag, setDrag] = useState(false);
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState('');
  const upload = async (file) => {
    if (!file) return;
    setError('');
    if (!/^(image\/(png|jpe?g|webp)|application\/pdf)$/.test(file.type)) { setError('Choose a PNG, JPG, WEBP or PDF file'); return; }
    if (file.size > 10 * 1024 * 1024) { setError('The file is larger than 10 MB'); return; }
    const fd = new FormData(); fd.append('file', file);
    setProgress(0);
    try {
      const { data } = await api.post('/shop/design/upload', fd, { onUploadProgress: (e) => e.total && setProgress(Math.round((e.loaded * 100) / e.total)) });
      onChange({ url: data.url, name: data.name || file.name });
    } catch (e) { setError(firstError(e)); } finally { setProgress(null); }
  };
  if (value?.url) {
    return (
      <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col gap-4 rounded-2xl border border-border bg-background/60 p-4 sm:flex-row sm:items-center">
        <div className="grid h-32 w-full shrink-0 place-items-center overflow-hidden rounded-xl border border-border bg-white sm:w-48">
          {isPdf(value.url) ? <FileText className="size-10 text-danger" /> : <img src={value.url} alt="Uploaded design" className="size-full object-contain" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-sm font-medium text-success"><Check className="size-4" />Design uploaded</p>
          <p className="mt-0.5 truncate text-sm text-muted-foreground">{value.name}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <a href={value.url} target="_blank" rel="noreferrer" className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-3 text-[13px] font-medium hover:bg-muted"><Eye className="size-4" />Open</a>
            <Button size="sm" variant="ghost" onClick={() => onChange(null)}><X />Remove</Button>
          </div>
        </div>
      </motion.div>
    );
  }
  return (
    <div>
      <label onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={(e) => { e.preventDefault(); setDrag(false); upload(e.dataTransfer.files[0]); }}
        className={cn('group relative flex cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed px-6 py-10 text-center transition', drag ? 'border-primary bg-primary-soft' : 'border-border hover:border-primary/50 hover:bg-muted/40', progress !== null && 'pointer-events-none')}>
        <input type="file" accept="image/png,image/jpeg,image/webp,application/pdf" className="sr-only" onChange={(e) => { upload(e.target.files[0]); e.target.value = ''; }} aria-label="Upload your design" />
        <motion.span animate={drag ? { scale: 1.15, y: -4 } : { scale: 1, y: 0 }} className="grid size-14 place-items-center rounded-2xl bg-primary-soft text-primary transition group-hover:-translate-y-1"><UploadCloud className="size-7" /></motion.span>
        <p className="mt-3 text-sm font-medium">{drag ? 'Drop it here' : progress !== null ? `Uploading ${progress}%` : 'Drag & drop your design, or click to browse'}</p>
        <p className="mt-1 text-xs text-muted-foreground">PNG, JPG, WEBP or PDF up to 10 MB. Print-ready files work best.</p>
        {progress !== null && <div className="mt-4 h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-muted"><motion.div className="h-full rounded-full bg-primary" animate={{ width: `${progress}%` }} /></div>}
      </label>
      {error && <p className="mt-2 text-xs font-medium text-danger">{error}</p>}
    </div>
  );
}

function OrderSummary({ cart, quote, money, cfg, isCod }) {
  const q = quote.data;
  const busy = quote.loading;
  const val = (v) => <span className={cn('tabular-nums transition-opacity', busy && 'opacity-40')}>{v}</span>;
  const sub = q?.subtotal ?? cart.subtotal;
  const left = cfg.free_delivery_above > 0 ? Math.max(0, cfg.free_delivery_above - sub) : 0;
  return (
    <div className="rounded-3xl border border-border bg-card p-5 shadow-soft">
      <p className="flex items-center gap-2 font-display font-semibold"><Receipt className="size-4.5 text-primary" />Order summary</p>
      <ul className="mt-4 space-y-3">
        {cart.items.map((i) => (
          <li key={i.key} className="flex items-center gap-3">
            <span className="relative"><LineThumb image={i.image} className="size-12" /><span className="absolute -top-1.5 -right-1.5 grid size-5 place-items-center rounded-full bg-foreground text-[10px] font-bold text-background">{i.quantity}</span></span>
            <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{i.name}</p><p className="truncate text-xs text-muted-foreground">{[i.variant, i.customization && 'Customised'].filter(Boolean).join(' · ') || `${money(unitPrice(i))} each`}</p></div>
            <span className="text-sm font-semibold">{money(unitPrice(i) * i.quantity)}</span>
          </li>
        ))}
      </ul>
      <dl className="mt-4 space-y-2 border-t border-border pt-4 text-sm">
        <div className="flex justify-between"><dt className="text-muted-foreground">Subtotal</dt><dd>{val(money(sub))}</dd></div>
        {num(q?.discount) > 0 && <div className="flex justify-between text-success"><dt>Discount</dt><dd>-{val(money(q.discount))}</dd></div>}
        {(q ? num(q.tax) > 0 : cfg.tax_rate > 0) && <div className="flex justify-between"><dt className="text-muted-foreground">{q?.tax_name || cfg.tax_name || 'Tax'} ({q?.tax_rate ?? cfg.tax_rate}%)</dt><dd>{val(q ? money(q.tax) : '...')}</dd></div>}
        <div className="flex justify-between"><dt className="text-muted-foreground">Delivery</dt><dd>{val(!q ? '...' : num(q.delivery) === 0 ? <span className="font-medium text-success">Free</span> : money(q.delivery))}</dd></div>
        {isCod && num(q?.cod) > 0 && <div className="flex justify-between"><dt className="text-muted-foreground">Cash on delivery charges</dt><dd>{val(money(q.cod))}</dd></div>}
        <div className="flex items-baseline justify-between border-t border-border pt-3"><dt className="font-semibold">Total</dt><dd className="font-display text-2xl font-extrabold">{busy && !q ? <Spinner className="size-4" /> : val(money(q?.total ?? sub))}</dd></div>
      </dl>
      {cfg.free_delivery_above > 0 && (
        <div className="mt-4 rounded-2xl bg-muted/60 p-3">
          <p className="text-xs font-medium">{left > 0 ? <>Add <b className="text-primary">{money(left)}</b> more to get free delivery</> : <span className="inline-flex items-center gap-1 text-success"><Truck className="size-3.5" />Free delivery unlocked</span>}</p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-background"><motion.div initial={false} animate={{ width: `${Math.min(100, (sub / cfg.free_delivery_above) * 100)}%` }} className="h-full rounded-full bg-linear-to-r from-violet-500 via-fuchsia-500 to-lime-300" /></div>
        </div>
      )}
      {quote.error && <p className="mt-3 flex items-start gap-1.5 rounded-xl bg-danger-soft px-3 py-2 text-xs font-medium text-danger"><AlertTriangle className="mt-px size-3.5 shrink-0" />{quote.error}</p>}
    </div>
  );
}

const CONFETTI = ['#8b5cf6', '#d946ef', '#bef264', '#38bdf8', '#f59e0b', '#f43f5e'];
function Confetti() {
  const pieces = useMemo(() => Array.from({ length: 80 }, (_, i) => ({ id: i, x: Math.random() * 100, d: Math.random() * 0.8, dur: 2.6 + Math.random() * 2, r: Math.random() * 900 - 450, c: CONFETTI[i % CONFETTI.length], w: 6 + Math.random() * 6, h: 8 + Math.random() * 10, drift: (Math.random() - 0.5) * 24, round: Math.random() > 0.7 })), []);
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-[70] overflow-hidden">
      {pieces.map((p) => (
        <motion.span key={p.id} initial={{ y: '-10vh', x: `${p.x}vw`, rotate: 0, opacity: 1 }} animate={{ y: '110vh', x: `${p.x + p.drift}vw`, rotate: p.r, opacity: [1, 1, 1, 0] }} transition={{ duration: p.dur, delay: p.d, ease: [0.2, 0.6, 0.4, 1] }}
          className="absolute top-0 left-0" style={{ width: p.w, height: p.h, background: p.c, borderRadius: p.round ? 999 : 2 }} />
      ))}
    </div>
  );
}

function Success({ done, email }) {
  const { user } = useAuth();
  return (
    <div className="relative mx-auto max-w-xl px-4 pt-32 pb-24 text-center sm:px-6">
      <Confetti />
      <motion.div initial={{ scale: 0, rotate: -30 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 220, damping: 14, delay: 0.1 }} className="relative mx-auto grid size-24 place-items-center">
        <Ripples color="bg-success/20" />
        <span className="relative grid size-20 place-items-center rounded-full bg-success text-white shadow-[0_12px_40px_-10px_var(--success)]">
          <motion.svg viewBox="0 0 24 24" className="size-10" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"><motion.path d="M5 12.5l4.5 4.5L19 7.5" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.6, delay: 0.45, ease }} /></motion.svg>
        </span>
      </motion.div>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4, duration: 0.7, ease }}>
        <p className="mt-8 inline-flex items-center gap-1.5 text-sm font-semibold text-primary"><PartyPopper className="size-4" />Thank you!</p>
        <h1 className="mt-2 font-display text-3xl font-extrabold tracking-tight text-balance sm:text-4xl">{done.message || 'Your order is placed'}</h1>
        <div className="mx-auto mt-6 flex w-fit max-w-full items-center gap-2 rounded-2xl border border-border bg-card py-2 pr-2 pl-4 shadow-soft">
          <Hash className="size-4 shrink-0 text-muted-foreground" /><span className="truncate font-mono text-lg font-bold tracking-wide">{done.order}</span>
          <button type="button" onClick={() => copy(done.order)} aria-label="Copy order number" className="grid size-9 cursor-pointer place-items-center rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground"><Copy className="size-4" /></button>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">We sent a confirmation to <b className="text-foreground">{email}</b>. Keep your order number to track the delivery.</p>
        {done.account_created && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.8 }} className="mt-6 flex items-start gap-3 rounded-2xl border border-primary/25 bg-primary-soft/60 p-4 text-left">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary text-white"><User className="size-5" /></span>
            <div className="text-sm"><p className="font-semibold">Your account is ready</p><p className="mt-0.5 text-muted-foreground">We created an account with a digital business card for you and e-mailed your login details. You are now signed in, so you can set up the profile your NFC product will open.</p></div>
          </motion.div>
        )}
        <div className="mt-8 flex flex-col justify-center gap-2 sm:flex-row">
          <ButtonLink as={Link} to={done.track_url} size="lg" className="group"><Truck />Track order<ArrowRight className="transition-transform group-hover:translate-x-1" /></ButtonLink>
          {user ? <ButtonLink as={Link} to={homeFor(user)} size="lg" variant="outline">Go to dashboard</ButtonLink> : <ButtonLink as={Link} to="/shop" size="lg" variant="outline">Continue shopping</ButtonLink>}
        </div>
      </motion.div>
    </div>
  );
}

export function CheckoutPage() {
  return <EnsureCart><Page title="Checkout"><CheckoutInner /></Page></EnsureCart>;
}

function CheckoutInner() {
  const { user, settings, refresh } = useAuth();
  const cart = useCart();
  const { data: catalog, error: catErr, reload, cfg, money } = useShopData();
  const draft = useMemo(() => store.get(DRAFT, {}), []);
  const [f, setF] = useState(() => ({
    name: '', phone: '', email: '', company_name: '', address: '', city: '', courier_city_id: '', customer_note: '', design_type: 'standard', design_notes: '', payment: '', vcard_id: '',
    ...draft.f,
  }));
  const [ai, setAi] = useState(() => ({ name: '', title: '', company: '', phone: '', email: '', website: '', style: 'Modern minimal', colors: '', prompt: '', results: [], picked: -1, view: 0, ...draft.ai, busy: false, error: '' }));
  const [upload, setUpload] = useState(draft.upload || null);
  const [errors, setErrors] = useState({});
  const [step, setStep] = useState(0);
  const [maxStep, setMaxStep] = useState(0);
  const [dir, setDir] = useState(1);
  const [busy, setBusy] = useState(false);
  const [conflict, setConflict] = useState('');
  const [done, setDone] = useState(null);
  const [cities, setCities] = useState(null);
  const [vcards, setVcards] = useState([]);
  const [quote, setQuote] = useState({ data: null, loading: false, error: '' });
  const [showSummary, setShowSummary] = useState(false);
  const topRef = useRef(null);

  const set = (k, v) => { setF((x) => ({ ...x, [k]: v })); setErrors((e) => ({ ...e, [k]: undefined })); };
  const inp = (k) => ({ id: `co-${k}`, value: f[k] ?? '', onChange: (e) => set(k, e.target.value), 'aria-invalid': !!errors[k] || undefined });
  const setA = (k, v) => setAi((x) => ({ ...x, [k]: v }));

  // prefill from the signed-in user
  useEffect(() => {
    if (!user) return;
    setF((x) => ({ ...x, name: x.name || `${user.first_name || ''} ${user.last_name || ''}`.trim(), email: x.email || user.email || '', phone: x.phone || user.contact || '' }));
    if (user.role === 'user') api.get('/user/vcards').then(({ data }) => setVcards(data.data || [])).catch(() => {});
  }, [user]);
  useEffect(() => { api.get('/shop/cities').then(({ data }) => setCities(data.data || [])).catch(() => setCities([])); }, []);
  // keep the draft (survives the sign-in round trip)
  useEffect(() => { if (!done) store.set(DRAFT, { f, ai: { ...ai, busy: undefined, error: undefined }, upload }); }, [f, ai, upload, done]);

  const methods = useMemo(() => {
    const online = cfg.online_payment ? GATEWAYS.filter((g) => settings[`${g}_enable`] === '1') : [];
    return [...(cfg.cod_enable ? ['cod'] : []), ...(settings.manual_payment_enable === '1' ? ['manual'] : []), ...online];
  }, [cfg, settings]);
  useEffect(() => { if (catalog && methods.length && !methods.includes(f.payment)) set('payment', methods[0]); }, [methods, catalog]); // eslint-disable-line
  useEffect(() => {
    const allowed = ['standard', cfg.ai_design && 'ai', cfg.upload_design && 'upload'].filter(Boolean);
    if (catalog && !allowed.includes(f.design_type)) set('design_type', 'standard');
  }, [catalog]); // eslint-disable-line
  const isCod = f.payment === 'cod';

  // live quote
  const itemsKey = JSON.stringify(cart.items.map((i) => [i.product_id, i.quantity, i.variant, i.customization]));
  useEffect(() => {
    if (!cart.items.length) return undefined;
    setQuote((q) => ({ ...q, loading: true }));
    const t = setTimeout(() => {
      api.post('/shop/quote', { items: cart.items.map((i) => ({ product_id: i.product_id, quantity: i.quantity, variant: i.variant, customization: i.customization })), is_cod: isCod })
        .then(({ data }) => setQuote({ data, loading: false, error: '' }))
        .catch((e) => setQuote({ data: null, loading: false, error: firstError(e) }));
    }, 250);
    return () => clearTimeout(t);
  }, [itemsKey, isCod]); // eslint-disable-line

  const go = (n) => { setDir(n > step ? 1 : -1); setStep(n); setMaxStep((m) => Math.max(m, n)); requestAnimationFrame(() => topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })); };

  const validateContact = () => {
    const e = {};
    if (!f.name.trim()) e.name = 'Enter your full name';
    if (String(f.phone).replace(/\D/g, '').length < 7) e.phone = 'Enter a valid phone number';
    if (!EMAIL_RE.test(f.email.trim())) e.email = 'Enter a valid e-mail address';
    if (!f.city.trim()) e.city = 'Choose your city';
    if (f.address.trim().length < 5) e.address = 'Enter your full delivery address';
    setErrors(e);
    if (Object.keys(e).length) { toast.error(Object.values(e)[0]); document.getElementById(`co-${Object.keys(e)[0]}`)?.focus(); return false; }
    return true;
  };
  const current = ai.results[ai.picked] || null;
  const validateDesign = () => {
    if (f.design_type === 'ai' && !current) { toast.error('Generate an AI design and pick one, or choose another option'); return false; }
    if (f.design_type === 'upload' && !upload?.url) { toast.error('Upload your design file, or choose another option'); return false; }
    return true;
  };
  const next = () => { if (step === 0 && validateContact()) { setAi((a) => ({ ...a, name: a.name || f.name, company: a.company || f.company_name, phone: a.phone || f.phone, email: a.email || f.email })); go(1); } else if (step === 1 && validateDesign()) go(2); };

  const generate = async () => {
    setAi((a) => ({ ...a, busy: true, error: '' }));
    try {
      const token = await recaptchaToken(settings, 'ai_design');
      const { data } = await api.post('/shop/design/ai', { name: ai.name, title: ai.title, company: ai.company, phone: ai.phone, email: ai.email, website: ai.website, style: ai.style, colors: ai.colors, prompt: ai.prompt, product_id: cart.items[0]?.product_id, recaptcha_token: token });
      setAi((a) => { const results = [...a.results, data].slice(-6); return { ...a, busy: false, results, picked: results.length - 1, view: results.length - 1 }; });
      toast.success('Your design is ready');
    } catch (e) {
      setAi((a) => ({ ...a, busy: false, error: firstError(e) }));
      toast.error(firstError(e));
    }
  };

  const place = async () => {
    if (!validateDesign()) return;
    if (!methods.length) { toast.error('No payment method is available'); return; }
    setBusy(true); setConflict('');
    try {
      const token = await recaptchaToken(settings, 'checkout');
      const design = f.design_type === 'ai' ? { design_front: current?.front, design_back: current?.back, design_prompt: [ai.prompt, f.design_notes].filter(Boolean).join('\n\n') }
        : f.design_type === 'upload' ? { design_file: upload?.url, design_prompt: f.design_notes } : { design_prompt: f.design_notes };
      const body = {
        name: f.name.trim(), phone: f.phone.trim(), email: f.email.trim(), address: f.address.trim(), city: f.city.trim(), courier_city_id: f.courier_city_id || undefined,
        company_name: f.company_name.trim() || undefined, customer_note: f.customer_note.trim() || undefined, is_cod: isCod, payment_type: isCod ? 'cod' : f.payment,
        items: cart.items.map((i) => ({ product_id: i.product_id, quantity: i.quantity, variant: i.variant, customization: i.customization })),
        design_type: f.design_type, ...design, recaptcha_token: token, vcard_id: f.vcard_id || undefined,
      };
      const { data } = await api.post('/shop/checkout', body);
      store.del(DRAFT);
      if (data.redirect) { cart.clear(); window.location.href = data.redirect; return; }
      cart.clear();
      setDone({ ...data, email: body.email });
      window.scrollTo({ top: 0 });
      if (data.account_created) refresh().catch(() => {});
    } catch (e) {
      if (e.response?.status === 409) { setConflict(e.message); window.scrollTo({ top: 0, behavior: 'smooth' }); } else {
        const errs = e.errors || {};
        setErrors(errs);
        if (Object.keys(errs).some((k) => CONTACT_KEYS.includes(k))) go(0);
        toast.error(firstError(e));
      }
    } finally { setBusy(false); }
  };

  if (done) return <Success done={done} email={done.email} />;

  const header = (
    <section className="relative overflow-hidden pt-28 pb-8 sm:pt-32">
      <Aurora className="opacity-40" />
      <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
        <Link to="/shop" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-primary"><ArrowLeft className="size-4" />Continue shopping</Link>
        <motion.h1 initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="mt-3 font-display text-4xl font-extrabold tracking-tight md:text-5xl">Checkout</motion.h1>
      </div>
    </section>
  );
  if (!cart.items.length) {
    return <>{header}<div className="mx-auto max-w-6xl px-4 pb-24 sm:px-6"><EmptyState icon={ShoppingBag} title="Your cart is empty" description="Add an NFC product to start your order." action={<ButtonLink as={Link} to="/shop">Browse products <ArrowRight /></ButtonLink>} /></div></>;
  }
  if (catErr) return <>{header}<div className="mx-auto max-w-6xl px-4 pb-24 sm:px-6"><LoadError error={catErr} reload={reload} /></div></>;
  if (!catalog) return <>{header}<div className="grid place-items-center pb-32"><Spinner /></div></>;

  const minShort = cfg.min_order > 0 && (quote.data?.subtotal ?? cart.subtotal) < cfg.min_order;
  const summary = <OrderSummary cart={cart} quote={quote} money={money} cfg={cfg} isCod={isCod} />;
  const designChoices = [
    ['standard', LayoutTemplate, 'Our standard design', 'Our designers create a clean, professional layout from your details. Free.'],
    cfg.ai_design && ['ai', Wand2, 'Design with AI', 'Describe your style and get a front and back design in about a minute.'],
    cfg.upload_design && ['upload', UploadCloud, 'Upload my own design', 'Have print-ready artwork? Upload a PNG, JPG, WEBP or PDF.'],
  ].filter(Boolean);
  const payLabel = PAY_LABEL[f.payment]?.[0] || f.payment;
  const view = ai.results[ai.view];

  return (
    <>
      {header}
      <div ref={topRef} className="mx-auto max-w-6xl scroll-mt-24 px-4 pb-24 sm:px-6">
        <AnimatePresence>
          {conflict && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
              <div role="alert" className="mb-6 flex flex-col gap-3 rounded-2xl border border-warning/40 bg-warning-soft p-4 sm:flex-row sm:items-center">
                <AlertTriangle className="size-5 shrink-0 text-warning" />
                <p className="flex-1 text-sm">{conflict}</p>
                <div className="flex gap-2">
                  <ButtonLink as={Link} to={`/login?redirect=${encodeURIComponent('/checkout')}`} size="sm"><LogIn />Sign in</ButtonLink>
                  {cfg.cod_enable && !isCod && <Button size="sm" variant="outline" onClick={() => { set('payment', 'cod'); setConflict(''); }}>Use cash on delivery</Button>}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <Stepper step={step} maxStep={maxStep} onGo={go} />

        {/* mobile summary toggle */}
        <div className="mt-6 lg:hidden">
          <button type="button" onClick={() => setShowSummary((s) => !s)} aria-expanded={showSummary} className="flex w-full cursor-pointer items-center gap-2 rounded-2xl border border-border bg-card px-4 py-3 text-sm shadow-soft">
            <ShoppingBag className="size-4 text-primary" /><span className="font-medium">{showSummary ? 'Hide' : 'Show'} order summary</span>
            <ChevronDown className={cn('size-4 transition-transform', showSummary && 'rotate-180')} />
            <span className="ml-auto font-display font-bold">{money(quote.data?.total ?? cart.subtotal)}</span>
          </button>
          <AnimatePresence initial={false}>{showSummary && <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden"><div className="pt-3">{summary}</div></motion.div>}</AnimatePresence>
        </div>

        <div className="mt-6 grid gap-8 lg:mt-10 lg:grid-cols-[1fr_380px]">
          <div className="min-w-0">
            <AnimatePresence mode="wait" custom={dir} initial={false}>
              <motion.div key={step} custom={dir} initial={{ opacity: 0, x: dir * 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: dir * -40 }} transition={{ duration: 0.35, ease }}
                className="rounded-3xl border border-border bg-card p-4 shadow-soft sm:p-7">
                {step === 0 && (
                  <>
                    <StepTitle icon={MapPin} title="Contact & delivery" text="Where should we deliver your order?" />
                    {user ? <p className="mb-5 flex items-center gap-2 rounded-2xl bg-primary-soft/60 px-4 py-3 text-sm"><User className="size-4 shrink-0 text-primary" />Signed in as <b className="truncate">{user.email}</b>. The order will be saved to your account.</p>
                      : <p className="mb-5 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-2xl bg-muted/60 px-4 py-3 text-sm text-muted-foreground"><User className="size-4 shrink-0 text-primary" />New here? We create your account automatically.<Link to={`/login?redirect=${encodeURIComponent('/checkout')}`} className="font-medium text-primary hover:underline">Already have one? Sign in</Link></p>}
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field label="Full name" htmlFor="co-name" required error={errors.name}><Input {...inp('name')} autoComplete="name" maxLength={120} /></Field>
                      <Field label="Phone" htmlFor="co-phone" required error={errors.phone}><Input {...inp('phone')} type="tel" inputMode="tel" autoComplete="tel" maxLength={30} placeholder="03XX XXXXXXX" /></Field>
                      <Field label="E-mail" htmlFor="co-email" required error={errors.email} hint={!user ? 'Your login details and order updates are sent here' : undefined}><Input {...inp('email')} type="email" autoComplete="email" maxLength={191} disabled={!!user && user.role === 'user'} /></Field>
                      <Field label="Company (optional)" htmlFor="co-company_name" error={errors.company_name}><Input {...inp('company_name')} autoComplete="organization" maxLength={150} /></Field>
                      <Field label="City" htmlFor="co-city" required error={errors.city} className="sm:col-span-2">
                        {cities === null ? <Skeleton className="h-10 rounded-xl" /> : cities.length ? (
                          <CityPicker id="co-city" cities={cities} value={f.city} invalid={!!errors.city} onChange={(c) => { setF((x) => ({ ...x, city: c.name, courier_city_id: c.id || '' })); setErrors((e) => ({ ...e, city: undefined })); }} />
                        ) : <Input {...inp('city')} icon={MapPin} autoComplete="address-level2" maxLength={120} placeholder="e.g. Lahore" />}
                      </Field>
                      <Field label="Delivery address" htmlFor="co-address" required error={errors.address} className="sm:col-span-2"><Textarea {...inp('address')} rows={3} autoComplete="street-address" maxLength={1000} placeholder="House / street, area, landmark" /></Field>
                    </div>
                  </>
                )}

                {step === 1 && (
                  <>
                    <StepTitle icon={Palette} title="Card design" text="How would you like your NFC product to look?" />
                    {vcards.length > 0 && (
                      <Field label="Which profile should your NFC product open?" className="mb-5" hint="You can change the link later from your dashboard.">
                        <Select value={f.vcard_id} onChange={(v) => set('vcard_id', v)} allowEmpty placeholder="My first vCard (default)" options={vcards.map((v) => ({ value: v.id, label: `${v.name}${v.url_alias ? ` (/${v.url_alias})` : ''}` }))} />
                      </Field>
                    )}
                    <div role="radiogroup" aria-label="Design option" className={cn('grid gap-3', designChoices.length === 3 ? 'sm:grid-cols-3' : designChoices.length === 2 && 'sm:grid-cols-2')}>
                      {designChoices.map(([k, I, t, d]) => {
                        const on = f.design_type === k;
                        return (
                          <button key={k} type="button" role="radio" aria-checked={on} onClick={() => set('design_type', k)}
                            className={cn('group relative flex cursor-pointer flex-row items-start gap-3 overflow-hidden rounded-2xl border-2 p-4 text-left transition sm:flex-col', on ? 'border-primary bg-primary-soft/50' : 'border-border hover:border-primary/40')}>
                            {k === 'ai' && <span className="absolute top-2.5 right-2.5 rounded-full bg-linear-to-r from-violet-500 to-fuchsia-500 px-2 py-0.5 text-[10px] font-bold text-white">NEW</span>}
                            <span className={cn('grid size-11 shrink-0 place-items-center rounded-xl transition duration-500 group-hover:-rotate-6', on ? 'bg-primary text-white' : 'bg-muted text-muted-foreground')}><I className="size-5" /></span>
                            <span className="min-w-0"><span className="block text-sm font-semibold">{t}</span><span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">{d}</span></span>
                          </button>
                        );
                      })}
                    </div>

                    <AnimatePresence mode="wait" initial={false}>
                      <motion.div key={f.design_type} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.25 }} className="mt-6">
                        {f.design_type === 'standard' && (
                          <div className="flex items-start gap-3 rounded-2xl bg-muted/50 p-4 text-sm">
                            <ClipboardCheck className="mt-0.5 size-5 shrink-0 text-primary" />
                            <p className="text-muted-foreground">We use your name, company and contact details to design the card and share a preview if anything needs your input. Add any wishes below.</p>
                          </div>
                        )}
                        {f.design_type === 'ai' && (
                          <div className="space-y-5">
                            <div className="grid gap-4 sm:grid-cols-2">
                              <Field label="Name on card" htmlFor="ai-name"><Input id="ai-name" value={ai.name} onChange={(e) => setA('name', e.target.value)} maxLength={120} /></Field>
                              <Field label="Job title" htmlFor="ai-title"><Input id="ai-title" value={ai.title} onChange={(e) => setA('title', e.target.value)} maxLength={120} placeholder="e.g. Marketing Manager" /></Field>
                              <Field label="Company" htmlFor="ai-company"><Input id="ai-company" value={ai.company} onChange={(e) => setA('company', e.target.value)} maxLength={150} /></Field>
                              <Field label="Website" htmlFor="ai-website"><Input id="ai-website" value={ai.website} onChange={(e) => setA('website', e.target.value)} maxLength={191} placeholder="www.example.com" /></Field>
                              <Field label="Phone" htmlFor="ai-phone"><Input id="ai-phone" value={ai.phone} onChange={(e) => setA('phone', e.target.value)} maxLength={30} /></Field>
                              <Field label="E-mail" htmlFor="ai-email"><Input id="ai-email" type="email" value={ai.email} onChange={(e) => setA('email', e.target.value)} maxLength={191} /></Field>
                              <Field label="Style" htmlFor="ai-style"><Select id="ai-style" value={ai.style} onChange={(v) => setA('style', v)} options={STYLES} /></Field>
                              <Field label="Colours" htmlFor="ai-colors"><Input id="ai-colors" value={ai.colors} onChange={(e) => setA('colors', e.target.value)} maxLength={120} placeholder="e.g. navy and gold" /></Field>
                              <Field label="Describe your idea" htmlFor="ai-prompt" className="sm:col-span-2" hint="Mood, icons, layout, anything you have in mind."><Textarea id="ai-prompt" rows={3} value={ai.prompt} onChange={(e) => setA('prompt', e.target.value)} maxLength={1000} placeholder="A clean card with a subtle geometric pattern and my logo initials on the back..." /></Field>
                            </div>
                            {ai.busy ? <AiProgress /> : (
                              <Button onClick={generate} size="lg" className="w-full sm:w-auto"><Sparkles />{ai.results.length ? 'Generate another design' : 'Generate my design'}</Button>
                            )}
                            {ai.error && !ai.busy && <p role="alert" className="flex items-start gap-2 rounded-2xl bg-danger-soft px-4 py-3 text-sm text-danger"><AlertTriangle className="mt-0.5 size-4 shrink-0" /><span>{ai.error} You can also pick our standard design or upload your own.</span></p>}
                            {view && !ai.busy && (
                              <motion.div key={ai.view} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="rounded-3xl border border-border bg-background/60 p-4">
                                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                                  <p className="text-sm font-semibold">Design {ai.view + 1}{ai.results.length > 1 && <span className="font-normal text-muted-foreground"> of {ai.results.length}</span>}</p>
                                  {ai.picked === ai.view ? <Badge tone="success"><Check className="size-3" />Selected</Badge> : <Button size="sm" onClick={() => setA('picked', ai.view)}><Check />Use this design</Button>}
                                </div>
                                <DesignPreview front={view.front} back={view.back} />
                                {view.concept && <p className="mt-3 text-sm text-muted-foreground">{view.concept}</p>}
                                <div className="mt-4 flex flex-wrap items-center gap-2">
                                  <Button size="sm" variant="outline" onClick={generate}><RefreshCw />Regenerate</Button>
                                  {ai.results.length > 1 && (
                                    <div className="ml-auto flex gap-1.5" aria-label="Previous designs">
                                      {ai.results.map((r, k) => (
                                        <button key={r.front} type="button" onClick={() => setA('view', k)} aria-label={`Show design ${k + 1}`} aria-pressed={k === ai.view}
                                          className={cn('relative h-9 w-14 cursor-pointer overflow-hidden rounded-lg border-2 bg-white transition', k === ai.view ? 'border-primary' : 'border-border opacity-70 hover:opacity-100')}>
                                          <img src={r.front} alt="" className="size-full object-cover" />
                                          {k === ai.picked && <span className="absolute right-0.5 bottom-0.5 grid size-3.5 place-items-center rounded-full bg-success text-white"><Check className="size-2.5" strokeWidth={4} /></span>}
                                        </button>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </motion.div>
                            )}
                          </div>
                        )}
                        {f.design_type === 'upload' && <UploadBox value={upload} onChange={setUpload} />}
                      </motion.div>
                    </AnimatePresence>
                    <Field label="Design notes (optional)" htmlFor="co-design_notes" className="mt-6" hint="Text to print, logo placement, colours or anything else for our designers."><Textarea {...inp('design_notes')} rows={3} maxLength={2000} /></Field>
                  </>
                )}

                {step === 2 && (
                  <>
                    <StepTitle icon={CreditCard} title="Payment" text="Choose how you'd like to pay." />
                    {!methods.length ? <p className="rounded-2xl bg-warning-soft px-4 py-3 text-sm text-warning">No payment method is available right now. Please contact us to complete your order.</p> : (
                      <div role="radiogroup" aria-label="Payment method" className="grid gap-2 sm:grid-cols-2">
                        {methods.map((g) => {
                          const [l, I] = PAY_LABEL[g] || [g, CreditCard];
                          const on = f.payment === g;
                          const sub = g === 'cod' ? (cfg.cod_charges > 0 ? `+${money(cfg.cod_charges)} handling` : 'Pay when it arrives') : g === 'manual' ? 'Order ships after payment approval' : 'Pay securely online';
                          return (
                            <button key={g} type="button" role="radio" aria-checked={on} onClick={() => { set('payment', g); setConflict(''); }}
                              className={cn('flex cursor-pointer items-center gap-3 rounded-2xl border-2 p-3 text-left transition', on ? 'border-primary bg-primary-soft/60' : 'border-border hover:border-primary/40')}>
                              <span className={cn('grid size-10 shrink-0 place-items-center rounded-xl transition', on ? 'bg-primary text-white' : 'bg-muted text-muted-foreground')}><I className="size-4.5" /></span>
                              <span className="min-w-0 flex-1"><span className="block text-sm font-medium">{l}</span><span className="block truncate text-xs text-muted-foreground">{sub}</span></span>
                              <span className={cn('grid size-5 shrink-0 place-items-center rounded-full border-2 transition', on ? 'border-primary bg-primary' : 'border-input')}>{on && <Check className="size-3 text-white" strokeWidth={3} />}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                    <AnimatePresence>
                      {f.payment === 'manual' && settings.manual_payment_guide && (
                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                          {/* admin-authored HTML, same as the Billing page */}
                          <div className="prose-content mt-4 rounded-2xl border border-border bg-muted/40 p-4 text-sm" dangerouslySetInnerHTML={{ __html: settings.manual_payment_guide }} />
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <div className="mt-6 grid gap-3 sm:grid-cols-2">
                      <Review icon={MapPin} title="Deliver to" onEdit={() => go(0)}>
                        <p className="font-medium text-foreground">{f.name}</p><p>{f.phone}</p><p className="line-clamp-2">{f.address}</p><p>{f.city}</p>
                      </Review>
                      <Review icon={Palette} title="Design" onEdit={() => go(1)}>
                        {f.design_type === 'ai' && current ? <DesignPreview front={current.front} back={current.back} className="mt-1" /> : f.design_type === 'upload' && upload ? <p className="flex items-center gap-1.5"><FileText className="size-4" /><span className="truncate">{upload.name}</span></p> : <p>Our standard design</p>}
                      </Review>
                    </div>
                    <Field label="Order note (optional)" htmlFor="co-customer_note" className="mt-5"><Textarea {...inp('customer_note')} rows={2} maxLength={2000} placeholder="Delivery instructions or anything else" /></Field>
                    <div className="mt-6 lg:hidden">{summary}</div>
                    {minShort && <p className="mt-4 rounded-2xl bg-warning-soft px-4 py-3 text-sm text-warning">The minimum order is {money(cfg.min_order)}. Add a few more items to continue.</p>}
                  </>
                )}

                <div className="mt-8 flex flex-col-reverse gap-2 border-t border-border pt-5 sm:flex-row sm:items-center">
                  {step > 0 && <Button variant="ghost" onClick={() => go(step - 1)}><ArrowLeft />Back</Button>}
                  <div className="sm:ml-auto">
                    {step < 2 ? (
                      <Button size="lg" className="group w-full sm:w-auto" onClick={next} disabled={step === 1 && ai.busy}>Continue <ArrowRight className="transition-transform group-hover:translate-x-1" /></Button>
                    ) : (
                      <Button size="lg" className="group w-full sm:w-auto" onClick={place} loading={busy} disabled={!methods.length || minShort || !!quote.error || quote.loading}>
                        {!busy && <ShieldCheck />}{isCod || f.payment === 'manual' ? 'Place order' : `Pay with ${payLabel}`}{quote.data && <span className="opacity-80">· {money(quote.data.total)}</span>}
                      </Button>
                    )}
                  </div>
                </div>
                {step === 2 && <p className="mt-3 text-center text-xs text-muted-foreground sm:text-right">By placing your order you agree to our <Link to="/terms-conditions" className="underline hover:text-foreground">terms</Link> and <Link to="/privacy-policy" className="underline hover:text-foreground">privacy policy</Link>.</p>}
              </motion.div>
            </AnimatePresence>
          </div>
          <aside className="hidden lg:block"><div className="sticky top-24">{summary}</div></aside>
        </div>
      </div>
    </>
  );
}

function StepTitle({ icon: I, title, text }) {
  return (
    <div className="mb-6 flex items-center gap-3">
      <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-primary-soft text-primary"><I className="size-5" /></span>
      <div><h2 className="font-display text-xl font-bold tracking-tight">{title}</h2><p className="text-sm text-muted-foreground">{text}</p></div>
    </div>
  );
}

function Review({ icon: I, title, onEdit, children }) {
  return (
    <div className="min-w-0 rounded-2xl border border-border p-4">
      <div className="mb-2 flex items-center justify-between"><p className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase"><I className="size-3.5" />{title}</p><button type="button" onClick={onEdit} className="inline-flex cursor-pointer items-center gap-1 text-xs font-medium text-primary hover:underline"><Pencil className="size-3" />Edit</button></div>
      <div className="space-y-0.5 text-sm text-muted-foreground">{children}</div>
    </div>
  );
}

/* ================================================================ /track */
const STEP_ICON = { pending: Receipt, confirmed: ClipboardCheck, designing: PenTool, printing: Printer, ready: Package, shipped: Truck, delivered: Home, returned: Undo2, cancelled: XCircle, processing: RefreshCw };
const STEP_TEXT = {
  pending: 'We received your order.', confirmed: 'Your order is confirmed.', designing: 'Our team is preparing your design.', printing: 'Your NFC product is being printed and encoded.',
  ready: 'Packed and ready to hand to the courier.', shipped: 'On its way with the courier.', delivered: 'Delivered. Tap away!', returned: 'The parcel was returned to us.', cancelled: 'This order was cancelled.',
};

export function TrackPage() {
  return <EnsureCart><Page title="Track your order"><TrackInner /></Page></EnsureCart>;
}

function TrackInner() {
  const { number } = useParams();
  const [params] = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const token = params.get('t') || '';
  const [form, setForm] = useState({ number: number || '', phone: '' });
  const [res, setRes] = useState(null);
  const [state, setState] = useState({ loading: false, error: '' });
  const lastQuery = useRef(null);

  const lookup = useCallback(async (num, q, { silent } = {}) => {
    lastQuery.current = { num, q };
    setState({ loading: true, error: '' });
    try {
      const { data } = await api.get(`/shop/track/${encodeURIComponent(num.trim().toUpperCase())}`, { params: q });
      setRes(data); setState({ loading: false, error: '' });
    } catch (e) { setState({ loading: false, error: silent ? '' : firstError(e) }); }
  }, []);

  useEffect(() => {
    setForm((x) => ({ ...x, number: number || x.number }));
    if (!number || authLoading) return;
    if (token) lookup(number, { t: token });
    else if (user) lookup(number, {}, { silent: true });
  }, [number, token, user, authLoading, lookup]);

  const submit = (e) => {
    e.preventDefault();
    if (!form.number.trim()) { setState({ loading: false, error: 'Enter your order number' }); return; }
    if (String(form.phone).replace(/\D/g, '').length < 7) { setState({ loading: false, error: 'Enter the phone number used for the order' }); return; }
    lookup(form.number, { phone: form.phone });
  };

  return (
    <>
      <section className="relative overflow-hidden pt-32 pb-10 sm:pt-36">
        <Aurora className="opacity-60" />
        <div className="relative mx-auto max-w-3xl px-4 text-center sm:px-6">
          <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 16 }} className="relative mx-auto grid size-16 place-items-center">
            <Ripples />
            <span className="relative grid size-14 place-items-center rounded-2xl bg-primary text-white shadow-glow"><Truck className="size-7" /></span>
          </motion.span>
          <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="mt-6 font-display text-4xl font-extrabold tracking-tight sm:text-5xl md:text-6xl">Track your order</motion.h1>
          <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="mt-4 text-base text-muted-foreground sm:text-lg">From design and printing to your doorstep, follow every step.</motion.p>
        </div>
      </section>
      <div className="mx-auto max-w-6xl px-4 pb-24 sm:px-6">
        <AnimatePresence mode="wait">
          {res ? (
            <motion.div key="res" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.5, ease }}>
              <TrackResult res={res} auth={lastQuery.current} loading={state.loading} onRefresh={() => lastQuery.current && lookup(lastQuery.current.num, lastQuery.current.q)} onReset={() => { setRes(null); setForm({ number: '', phone: '' }); }} />
            </motion.div>
          ) : (
            <motion.form key="form" onSubmit={submit} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} noValidate
              className="mx-auto max-w-xl rounded-3xl border border-border bg-card p-5 shadow-lift sm:p-7">
              {state.loading && !form.phone ? <div className="grid place-items-center py-10"><Spinner /></div> : (
                <>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Order number" htmlFor="tr-number" required><Input id="tr-number" icon={Hash} value={form.number} onChange={(e) => setForm({ ...form, number: e.target.value.toUpperCase() })} placeholder="ORD-240101-ABC123" autoComplete="off" /></Field>
                    <Field label="Phone number" htmlFor="tr-phone" required><Input id="tr-phone" type="tel" inputMode="tel" autoComplete="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="Used when ordering" /></Field>
                  </div>
                  <AnimatePresence>{state.error && <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} role="alert" className="mt-4 flex items-start gap-2 overflow-hidden rounded-2xl bg-danger-soft px-4 py-3 text-sm text-danger"><AlertTriangle className="mt-0.5 size-4 shrink-0" />{state.error}</motion.p>}</AnimatePresence>
                  <Button type="submit" size="lg" className="mt-5 w-full" loading={state.loading}><Search />Track order</Button>
                  <p className="mt-4 text-center text-xs text-muted-foreground">Your order number is in the confirmation e-mail.{user?.role === 'user' && <> You can also see all orders in your <Link to="/user/nfc-orders" className="font-medium text-primary hover:underline">dashboard</Link>.</>}</p>
                </>
              )}
            </motion.form>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}

function ReceiptUpload({ number, auth, onDone }) {
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const send = async () => {
    setBusy(true);
    const fd = new FormData(); fd.append('receipt', file);
    for (const [k, v] of Object.entries(auth?.q || {})) fd.append(k, v);
    try { const { data } = await api.post(`/shop/track/${encodeURIComponent(number)}/receipt`, fd); toast.success(data.message); onDone(); } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };
  return (
    <div className="rounded-3xl border border-warning/40 bg-warning-soft/60 p-5">
      <p className="font-display font-semibold">Upload your payment receipt</p>
      <p className="mt-1 text-sm text-muted-foreground">Paid by bank transfer, JazzCash or Easypaisa? Upload the screenshot so we can confirm your order.</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input type="file" accept="image/png,image/jpeg,image/webp,application/pdf" onChange={(e) => setFile(e.target.files?.[0] || null)} className="min-w-0 flex-1 text-sm file:mr-3 file:cursor-pointer file:rounded-xl file:border-0 file:bg-card file:px-3 file:py-2 file:text-sm file:font-medium" aria-label="Payment receipt" />
        <Button onClick={send} loading={busy} disabled={!file}>Send receipt</Button>
      </div>
    </div>
  );
}

function TrackResult({ res, auth, loading, onRefresh, onReset }) {
  const o = res.data;
  const steps = res.steps || ['pending', 'confirmed', 'designing', 'printing', 'ready', 'shipped', 'delivered'];
  const labels = res.labels || {};
  const money = (a) => formatPrice(a, res.currency || 'Rs');
  const status = o.order_status;
  const terminal = status === 'cancelled' || status === 'returned';
  const history = o.history || [];
  const reached = terminal ? Math.max(0, ...history.map((h) => steps.indexOf(h.status))) : status === 'processing' ? steps.indexOf('confirmed') : Math.max(0, steps.indexOf(status));
  const atOf = (s) => [...history].reverse().find((h) => h.status === s)?.at;
  const nodes = steps.map((s, i) => ({ s, state: terminal ? (i <= reached ? 'done' : 'skip') : i < reached || (i === reached && s === 'delivered') ? 'done' : i === reached ? 'current' : 'todo' }));
  const shown = terminal ? [...nodes.filter((n) => n.state === 'done'), { s: status, state: 'terminal' }] : nodes;
  const fillIdx = terminal ? shown.length - 1 : reached;
  const tone = terminal ? 'danger' : status === 'delivered' ? 'success' : 'primary';
  return (
    <div className="space-y-6">
      <div className={cn('relative overflow-hidden rounded-3xl p-5 text-white sm:p-7', terminal ? 'bg-linear-to-r from-rose-600 to-orange-500' : status === 'delivered' ? 'bg-linear-to-r from-emerald-600 to-teal-500' : 'bg-linear-to-r from-violet-600 to-fuchsia-600')}>
        <div className="bg-grid absolute inset-0 opacity-20" />
        <div className="relative flex flex-wrap items-start gap-4">
          <div className="min-w-[13rem] flex-1">
            <p className="text-sm text-white/70">Order</p>
            <p className="flex items-center gap-2 font-mono text-xl font-bold [overflow-wrap:anywhere] sm:text-2xl">{o.order_number}<button type="button" onClick={() => copy(o.order_number)} aria-label="Copy order number" className="grid size-8 shrink-0 cursor-pointer place-items-center rounded-lg hover:bg-white/15"><Copy className="size-4" /></button></p>
            <p className="mt-1 text-sm text-white/70">Placed {fmtDate(o.created_at)}{o.name ? ` by ${o.name}` : ''}</p>
          </div>
          <div className="text-left sm:text-right">
            <p className="text-sm text-white/70">Status</p>
            <p className="font-display text-2xl font-extrabold">{labels[status] || status}</p>
            <p className="mt-1 text-sm text-white/80">{money(o.amount)} · {o.is_cod ? 'Cash on delivery' : o.payment_status === 'paid' ? 'Paid' : `Payment ${o.payment_status || 'pending'}`}</p>
          </div>
        </div>
        <div className="relative mt-5 flex flex-wrap gap-2">
          <Button size="sm" variant="white" onClick={onRefresh} loading={loading}>{!loading && <RefreshCw />}Refresh</Button>
          <Button size="sm" variant="ghost" className="text-white hover:bg-white/15 hover:text-white" onClick={onReset}><Search />Track another order</Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="rounded-3xl border border-border bg-card p-5 shadow-soft sm:p-7 lg:col-span-3">
          <h2 className="mb-6 font-display text-lg font-semibold">Order progress</h2>
          <ol className="relative">
            {shown.map((n, i) => {
              const I = STEP_ICON[n.s] || Package;
              const at = atOf(n.s) || (n.s === 'shipped' && o.dispatched_at) || (n.s === 'delivered' && o.delivered_at) || (n.s === 'pending' && o.created_at);
              const last = i === shown.length - 1;
              const lit = n.state === 'done' || n.state === 'current' || n.state === 'terminal';
              return (
                <motion.li key={n.s} initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 + i * 0.08, duration: 0.5, ease }} className="relative flex gap-4 pb-7 last:pb-0">
                  {!last && (
                    <span className="absolute top-11 bottom-1 left-[21px] w-0.5 overflow-hidden rounded-full bg-border" aria-hidden>
                      <motion.span className={cn('absolute inset-0 origin-top', tone === 'danger' ? 'bg-danger' : tone === 'success' ? 'bg-success' : 'bg-primary')} initial={{ scaleY: 0 }} animate={{ scaleY: i < fillIdx ? 1 : 0 }} transition={{ delay: 0.3 + i * 0.12, duration: 0.5, ease }} />
                    </span>
                  )}
                  <span className={cn('relative grid size-11 shrink-0 place-items-center rounded-2xl border-2 transition',
                    n.state === 'terminal' ? 'border-danger bg-danger text-white' : n.state === 'done' ? (tone === 'success' ? 'border-success bg-success text-white' : tone === 'danger' ? 'border-danger/40 bg-danger-soft text-danger' : 'border-primary bg-primary text-white') : n.state === 'current' ? 'border-primary bg-primary-soft text-primary' : 'border-border bg-card text-muted-foreground')}>
                    {n.state === 'current' && <span className="absolute inset-0 animate-ping rounded-2xl bg-primary/25 [animation-duration:2s]" />}
                    {n.state === 'done' && tone !== 'danger' ? <Check className="size-5" strokeWidth={3} /> : <I className="size-5" />}
                  </span>
                  <div className={cn('min-w-0 flex-1 pt-1', !lit && 'opacity-55')}>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <p className="font-display font-semibold">{labels[n.s] || n.s}</p>
                      {n.state === 'current' && <Badge tone="primary" dot>Now</Badge>}
                    </div>
                    <p className="mt-0.5 text-sm text-muted-foreground">{STEP_TEXT[n.s]}</p>
                    {lit && at && <p className="mt-1 text-xs text-muted-foreground">{fmtDateTime(at)}</p>}
                  </div>
                </motion.li>
              );
            })}
          </ol>
        </div>

        <div className="space-y-6 lg:col-span-2">
          {o.tags?.length > 0 && (
            <div className="rounded-3xl border border-border bg-card p-5 shadow-soft">
              <div className="flex items-center gap-3">
                <span className="grid size-11 place-items-center rounded-2xl bg-primary-soft text-primary"><ShieldCheck className="size-5" /></span>
                <div className="min-w-0 flex-1"><p className="font-display font-semibold">Your {o.tags.length > 1 ? `${o.tags.length} tags` : 'tag'}</p><p className="text-sm text-muted-foreground">Anyone who scans can reach you, and your number stays hidden.</p></div>
              </div>
              <ul className="mt-4 space-y-2">
                {o.tags.slice(0, 10).map((t) => (
                  <li key={t.code} className="rounded-2xl bg-muted/60 p-3">
                    <p className="flex items-center justify-between gap-2"><span className="font-mono font-semibold tracking-wide">{t.code}</span><span className="truncate text-xs text-muted-foreground">{t.label || (t.kind === 'luggage' ? 'Luggage tag' : 'Car tag')}</span></p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <a href={t.url} target="_blank" rel="noreferrer" className="rounded-full border border-border bg-card px-3 py-1 text-xs font-medium hover:border-primary hover:text-primary">Preview</a>
                      <a href={t.qr_url} target="_blank" rel="noreferrer" className="rounded-full border border-border bg-card px-3 py-1 text-xs font-medium hover:border-primary hover:text-primary">QR code</a>
                      {t.manage_url && <a href={t.manage_url} target="_blank" rel="noreferrer" className="rounded-full bg-primary px-3 py-1 text-xs font-semibold text-white">Set up your tag</a>}
                    </div>
                  </li>
                ))}
              </ul>
              {o.tags.some((t) => t.manage_url) && <p className="mt-3 text-xs text-muted-foreground">Add your label, who to contact and how you want to be alerted. Keep the "Set up" links private.</p>}
            </div>
          )}
          {(o.tracking_number || o.courier_status) && (
            <div className="rounded-3xl border border-border bg-card p-5 shadow-soft">
              <div className="flex items-center gap-3">
                <span className="grid size-11 place-items-center rounded-2xl bg-info-soft text-info"><Truck className="size-5" /></span>
                <div className="min-w-0 flex-1"><p className="font-display font-semibold">{o.courier ? `${o.courier[0].toUpperCase()}${o.courier.slice(1)}` : 'Courier'}</p>{o.courier_status && <p className="truncate text-sm text-muted-foreground">{o.courier_status}{o.courier_status_at ? ` · ${fmtDateTime(o.courier_status_at)}` : ''}</p>}</div>
              </div>
              {o.tracking_number && (
                <div className="mt-4 flex items-center gap-2 rounded-2xl bg-muted/60 py-2 pr-2 pl-4">
                  <div className="min-w-0 flex-1"><p className="text-[11px] text-muted-foreground">Tracking number</p><p className="truncate font-mono font-semibold">{o.tracking_number}</p></div>
                  <button type="button" onClick={() => copy(o.tracking_number)} aria-label="Copy tracking number" className="grid size-9 cursor-pointer place-items-center rounded-xl text-muted-foreground hover:bg-card hover:text-foreground"><Copy className="size-4" /></button>
                </div>
              )}
              {o.courier_history?.length > 0 && (
                <ol className="mt-4 space-y-3 border-l-2 border-border pl-4">
                  {[...o.courier_history].reverse().map((h, i) => (
                    <li key={`${h.at}${i}`} className="relative">
                      <span className={cn('absolute top-1.5 -left-[21px] size-2.5 rounded-full ring-4 ring-card', i === 0 ? 'bg-info' : 'bg-border')} />
                      <p className={cn('text-sm', i === 0 ? 'font-medium' : 'text-muted-foreground')}>{h.status}</p>
                      <p className="text-xs text-muted-foreground">{[h.at && (Number.isNaN(Date.parse(h.at)) ? h.at : fmtDateTime(h.at)), h.reason].filter(Boolean).join(' · ')}</p>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          )}

          <div className="rounded-3xl border border-border bg-card p-5 shadow-soft">
            <p className="flex items-center gap-2 font-display font-semibold"><Package className="size-4.5 text-primary" />Items</p>
            <ul className="mt-4 space-y-3">
              {(o.items || []).map((it, i) => (
                <li key={i} className="flex items-start gap-3 text-sm">
                  <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary-soft font-semibold text-primary">{it.quantity}×</span>
                  <div className="min-w-0 flex-1"><p className="font-medium">{it.name}</p><p className="text-xs text-muted-foreground">{[it.variant, it.customization && `Customised +${money(it.customization_price)}`, `${money(it.unit_price)} each`].filter(Boolean).join(' · ')}</p></div>
                  <span className="font-semibold">{money(it.total)}</span>
                </li>
              ))}
            </ul>
            <dl className="mt-4 space-y-1.5 border-t border-border pt-4 text-sm">
              {[['Subtotal', o.subtotal], ['Discount', -num(o.discount)], ['Tax', o.tax_amount], ['Delivery', o.delivery_charges], ['Cash on delivery charges', o.cod_charges]].filter(([k, v]) => k === 'Subtotal' || num(v) !== 0).map(([k, v]) => (
                <div key={k} className="flex justify-between"><dt className="text-muted-foreground">{k}</dt><dd>{num(v) < 0 ? `-${money(-num(v))}` : money(v)}</dd></div>
              ))}
              <div className="flex items-baseline justify-between border-t border-border pt-2"><dt className="font-semibold">Total</dt><dd className="font-display text-xl font-extrabold">{money(o.amount)}</dd></div>
            </dl>
            <div className="mt-4 flex flex-wrap gap-2 text-xs">
              {o.city && <Badge tone="outline"><MapPin className="size-3" />{o.city}</Badge>}
              <Badge tone={o.payment_status === 'paid' ? 'success' : 'warning'} dot>{o.is_cod ? 'Cash on delivery' : `Payment ${o.payment_status || 'pending'}`}</Badge>
            </div>
          </div>

          {o.payment_type === 'manual' && o.payment_status === 'pending' && (o.receipt_uploaded
            ? <p className="rounded-3xl border border-border bg-card p-5 text-sm shadow-soft">Payment receipt received - we are confirming it.</p>
            : <ReceiptUpload number={o.order_number} auth={auth} onDone={onRefresh} />)}
          {(o.design_front || o.design_back) && (
            <div className="rounded-3xl border border-border bg-card p-5 shadow-soft">
              <p className="mb-3 flex items-center gap-2 font-display font-semibold"><Palette className="size-4.5 text-primary" />Your design</p>
              {isPdf(o.design_front) ? <a href={o.design_front} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"><FileText className="size-4" />Open design file</a>
                : <DesignPreview front={o.design_front} back={o.design_back} />}
            </div>
          )}
          {!o.design_front && !o.design_back && o.design_type && o.design_type !== 'standard' && (
            <p className="flex items-center gap-2 rounded-2xl bg-muted/60 px-4 py-3 text-sm text-muted-foreground"><Link2 className="size-4" />{o.design_type === 'upload' ? 'Your uploaded design is with our team.' : 'Your design is with our team.'}</p>
          )}
        </div>
      </div>
    </div>
  );
}
