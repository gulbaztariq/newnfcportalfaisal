/*
 * Shop cart: context + hook persisted in localStorage, plus the navbar CartButton and the CartDrawer (right-side sheet).
 * Several providers (e.g. one per page when the app has no top-level provider) stay in sync through a window event.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import * as D from '@radix-ui/react-dialog';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { ShoppingBag, Minus, Plus, Trash2, ArrowRight, Nfc, Sparkles, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui';
import api from '@/lib/api';

const KEY = 'shop-cart';
const CUR_KEY = 'shop-currency';
const EVENT = 'shop-cart-change';

const read = (k, fallback) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fallback; } catch { return fallback; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage full or blocked */ } };

/** Price like "Rs 1,199" (decimals only when needed) */
export const formatPrice = (amount, currency = 'Rs') => {
  const n = Number(amount || 0);
  return `${currency} ${n.toLocaleString('en-US', { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 })}`;
};

export const lineKey = (i) => `${i.product_id}|${i.variant || ''}|${i.customization ? 1 : 0}`;
export const unitPrice = (i) => Number(i.price || 0) + (i.customization ? Number(i.customization_price || 0) : 0);

const clean = (list) => (Array.isArray(list) ? list : [])
  .filter((i) => i && i.product_id)
  .map((i) => ({ ...i, key: lineKey(i), quantity: Math.min(1000, Math.max(1, parseInt(i.quantity, 10) || 1)) }));

/* ------------------------------------------------------------ catalogue */
let catalog = null;
/** GET /shop/products once per page load (retried after a failure). Resolves { data, categories, config } */
export function loadCatalog(force) {
  if (!catalog || force) {
    catalog = api.get('/shop/products').then(({ data }) => data);
    catalog.catch(() => { catalog = null; });
  }
  return catalog;
}
/** { data, error, reload } for the shop catalogue */
export function useCatalog(enabled = true) {
  const [state, setState] = useState({ data: null, error: null });
  const load = useCallback((force) => {
    setState((s) => ({ data: force ? null : s.data, error: null }));
    loadCatalog(force).then((d) => setState({ data: d, error: null })).catch((e) => setState({ data: null, error: e }));
  }, []);
  useEffect(() => { if (enabled) load(); }, [enabled, load]);
  return { ...state, reload: () => load(true) };
}

const CartCtx = createContext(null);

export function CartProvider({ children }) {
  const [items, setItems] = useState(() => clean(read(KEY, [])));
  const [currency, setCurrencyState] = useState(() => read(CUR_KEY, 'Rs') || 'Rs');
  const [open, setOpen] = useState(false);
  const id = useRef(Math.random().toString(36).slice(2));

  // sync with other providers in this tab and other tabs
  useEffect(() => {
    const reload = (e) => { if (e?.detail === id.current) return; setItems(clean(read(KEY, []))); setCurrencyState(read(CUR_KEY, 'Rs') || 'Rs'); };
    const onStorage = (e) => { if (e.key === KEY || e.key === CUR_KEY) reload(); };
    window.addEventListener(EVENT, reload);
    window.addEventListener('storage', onStorage);
    return () => { window.removeEventListener(EVENT, reload); window.removeEventListener('storage', onStorage); };
  }, []);

  const commit = useCallback((updater) => {
    setItems((prev) => {
      const next = clean(typeof updater === 'function' ? updater(prev) : updater);
      write(KEY, next.map(({ key, ...rest }) => rest)); // eslint-disable-line no-unused-vars
      setTimeout(() => window.dispatchEvent(new CustomEvent(EVENT, { detail: id.current })), 0);
      return next;
    });
  }, []);

  const add = useCallback((item, { silent } = {}) => {
    const line = { product_id: item.product_id, slug: item.slug, name: item.name, image: item.image || null, price: Number(item.price || 0), variant: item.variant || null, customization: !!item.customization, customization_price: item.customization ? Number(item.customization_price || 0) : 0, quantity: Math.max(1, parseInt(item.quantity, 10) || 1) };
    const k = lineKey(line);
    commit((prev) => (prev.some((i) => i.key === k) ? prev.map((i) => (i.key === k ? { ...i, ...line, quantity: i.quantity + line.quantity } : i)) : [...prev, line]));
    if (!silent) toast.success(`${line.name} added to cart`, { action: { label: 'View cart', onClick: () => setOpen(true) } });
  }, [commit]);
  const update = useCallback((key, quantity) => commit((prev) => prev.map((i) => (i.key === key ? { ...i, quantity } : i))), [commit]);
  const remove = useCallback((key) => commit((prev) => prev.filter((i) => i.key !== key)), [commit]);
  const clear = useCallback(() => commit([]), [commit]);
  const setCurrency = useCallback((c) => { if (!c) return; setCurrencyState(c); write(CUR_KEY, c); }, []);

  const value = useMemo(() => {
    const count = items.reduce((a, i) => a + i.quantity, 0);
    const subtotal = Math.round(items.reduce((a, i) => a + unitPrice(i) * i.quantity, 0) * 100) / 100;
    return { items, count, subtotal, currency, setCurrency, add, update, remove, clear, open, setOpen, format: (a) => formatPrice(a, currency) };
  }, [items, currency, open, add, update, remove, clear, setCurrency]);
  return <CartCtx.Provider value={value}>{children}</CartCtx.Provider>;
}

/** Cart state; null when no CartProvider is mounted above */
export const useCart = () => useContext(CartCtx);

/** Renders children inside a CartProvider, adding one only when none exists above */
export function EnsureCart({ children }) {
  const ctx = useContext(CartCtx);
  return ctx ? children : <CartProvider>{children}</CartProvider>;
}

/* ------------------------------------------------------------ button */
export function CartButton({ className }) {
  const cart = useCart();
  if (!cart) return null;
  return (
    <button type="button" onClick={() => cart.setOpen(true)} aria-label={`Cart, ${cart.count} item${cart.count === 1 ? '' : 's'}`}
      className={cn('relative grid size-9 cursor-pointer place-items-center rounded-xl text-muted-foreground transition hover:bg-muted hover:text-foreground', className)}>
      <motion.span key={cart.count} initial={{ rotate: 0 }} animate={cart.count ? { rotate: [0, -14, 10, -6, 0] } : {}} transition={{ duration: 0.5 }}><ShoppingBag className="size-5" /></motion.span>
      <AnimatePresence>
        {cart.count > 0 && (
          <motion.span key={cart.count} initial={{ scale: 0, y: 4 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0 }} transition={{ type: 'spring', stiffness: 500, damping: 18 }}
            className="absolute -top-1 -right-1 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-primary px-1 text-[10px] font-bold text-white ring-2 ring-background">
            {cart.count > 99 ? '99+' : cart.count}
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  );
}

/* ------------------------------------------------------------ stepper */
export function QtyStepper({ value, onChange, min = 1, max = 1000, size = 'md', label = 'Quantity' }) {
  const s = size === 'sm' ? 'h-8 [&_button]:size-8 text-sm' : 'h-11 [&_button]:size-11';
  return (
    <div role="group" aria-label={label} className={cn('inline-flex items-center rounded-xl border border-border bg-card', s)}>
      <button type="button" onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min} aria-label="Decrease quantity" className="grid cursor-pointer place-items-center rounded-l-xl text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"><Minus className="size-3.5" /></button>
      <span className="relative w-9 overflow-hidden text-center font-semibold tabular-nums" aria-live="polite">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span key={value} initial={{ y: 12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -12, opacity: 0 }} transition={{ duration: 0.18 }} className="block">{value}</motion.span>
        </AnimatePresence>
      </span>
      <button type="button" onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max} aria-label="Increase quantity" className="grid cursor-pointer place-items-center rounded-r-xl text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"><Plus className="size-3.5" /></button>
    </div>
  );
}

export function LineThumb({ image, className }) {
  return (
    <span className={cn('relative grid size-16 shrink-0 place-items-center overflow-hidden rounded-xl bg-linear-to-br from-violet-500 to-fuchsia-600 text-white', className)}>
      {image ? <img src={image} alt="" loading="lazy" className="size-full object-cover" /> : <Nfc className="size-6" />}
    </span>
  );
}

/* ------------------------------------------------------------ drawer */
const SHEET_CSS = `
@keyframes cart-in { from { transform: translateX(100%); } }
@keyframes cart-out { to { transform: translateX(100%); } }
.cart-sheet.anim-sheet[data-state="open"] { animation: cart-in .35s cubic-bezier(.16,1,.3,1); }
.cart-sheet.anim-sheet[data-state="closed"] { animation: cart-out .2s ease-in; }`;

export function CartDrawer() {
  const cart = useCart();
  const navigate = useNavigate();
  const { data: shop } = useCatalog(!!cart?.open);
  const setCurrency = cart?.setCurrency;
  useEffect(() => { if (shop?.config?.currency && setCurrency) setCurrency(shop.config.currency); }, [shop, setCurrency]);
  if (!cart) return null;
  const freeDeliveryAbove = Number(shop?.config?.free_delivery_above || 0);
  const { items, open, setOpen, format, subtotal, count } = cart;
  const left = freeDeliveryAbove > 0 ? Math.max(0, freeDeliveryAbove - subtotal) : 0;
  return (
    <>
      <style>{SHEET_CSS}</style>
      <D.Root open={open} onOpenChange={setOpen}>
        <D.Portal>
          <D.Overlay className="anim-overlay fixed inset-0 z-50 bg-zinc-950/50 backdrop-blur-sm" />
          <D.Content className="cart-sheet anim-sheet fixed inset-y-0 right-0 z-50 flex w-full max-w-[420px] flex-col border-l border-border bg-card shadow-2xl outline-none">
        <div className="flex items-center gap-3 border-b border-border px-5 py-4">
          <span className="grid size-10 place-items-center rounded-2xl bg-primary-soft text-primary"><ShoppingBag className="size-5" /></span>
          <div className="min-w-0 flex-1">
            <D.Title className="font-display text-lg font-semibold tracking-tight">Your cart</D.Title>
            <D.Description className="text-xs text-muted-foreground">{count ? `${count} item${count === 1 ? '' : 's'}` : 'No items yet'}</D.Description>
          </div>
          <D.Close aria-label="Close cart" className="grid size-9 cursor-pointer place-items-center rounded-xl text-muted-foreground transition hover:bg-muted hover:text-foreground"><X className="size-5" /></D.Close>
        </div>

        {!items.length ? (
          <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
            <div className="relative mb-5">
              <div className="absolute inset-0 animate-ping rounded-3xl bg-primary/10 [animation-duration:2.5s]" />
              <motion.span animate={{ y: [0, -6, 0] }} transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }} className="relative grid size-20 place-items-center rounded-3xl bg-primary-soft text-primary"><ShoppingBag className="size-9" /></motion.span>
            </div>
            <p className="font-display text-lg font-semibold">Your cart is empty</p>
            <p className="mt-1 text-sm text-muted-foreground">NFC cards, standees, tags and more, ready to share your profile with a tap.</p>
            <Button className="mt-6" onClick={() => { setOpen(false); navigate('/shop'); }}>Browse products <ArrowRight /></Button>
          </div>
        ) : (
          <>
            {freeDeliveryAbove > 0 && (
              <div className="border-b border-border px-5 py-3">
                <p className="text-xs font-medium">{left > 0 ? <>Add <b className="text-primary">{format(left)}</b> more for free delivery</> : <span className="inline-flex items-center gap-1 text-success"><Sparkles className="size-3.5" />You unlocked free delivery</span>}</p>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted"><motion.div initial={false} animate={{ width: `${Math.min(100, (subtotal / freeDeliveryAbove) * 100)}%` }} transition={{ type: 'spring', stiffness: 120, damping: 20 }} className="h-full rounded-full bg-linear-to-r from-violet-500 via-fuchsia-500 to-lime-300" /></div>
              </div>
            )}
            <ul className="min-h-0 flex-1 space-y-3 overflow-y-auto p-5">
              <AnimatePresence initial={false}>
                {items.map((i) => (
                  <motion.li key={i.key} layout initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 60, height: 0, marginTop: 0 }} transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                    className="flex gap-3 rounded-2xl border border-border bg-background/60 p-3">
                    <Link to={`/shop/${i.slug}`} onClick={() => setOpen(false)}><LineThumb image={i.image} /></Link>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start gap-2">
                        <Link to={`/shop/${i.slug}`} onClick={() => setOpen(false)} className="line-clamp-2 flex-1 text-sm leading-snug font-medium hover:text-primary">{i.name}</Link>
                        <button type="button" onClick={() => remove(i)} aria-label={`Remove ${i.name}`} className="-mt-1 -mr-1 grid size-8 shrink-0 cursor-pointer place-items-center rounded-lg text-muted-foreground transition hover:bg-danger-soft hover:text-danger"><Trash2 className="size-4" /></button>
                      </div>
                      <div className="mt-0.5 flex flex-wrap gap-1">
                        {i.variant && <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">{i.variant}</span>}
                        {i.customization && <span className="rounded-full bg-primary-soft px-2 py-0.5 text-[11px] font-medium text-primary">Customised +{format(i.customization_price)}</span>}
                      </div>
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <QtyStepper size="sm" value={i.quantity} onChange={(q) => cart.update(i.key, q)} label={`Quantity of ${i.name}`} />
                        <span className="font-display text-sm font-bold">{format(unitPrice(i) * i.quantity)}</span>
                      </div>
                    </div>
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
            <div className="border-t border-border p-5">
              <div className="flex items-baseline justify-between"><span className="text-sm text-muted-foreground">Subtotal</span><span className="font-display text-2xl font-extrabold">{format(subtotal)}</span></div>
              <p className="mt-1 text-xs text-muted-foreground">Delivery and taxes are calculated at checkout.</p>
              <Button size="lg" className="group mt-4 w-full" onClick={() => { setOpen(false); navigate('/checkout'); }}>Checkout <ArrowRight className="transition-transform group-hover:translate-x-1" /></Button>
              <button type="button" onClick={() => setOpen(false)} className="mt-2 w-full cursor-pointer rounded-xl py-2 text-sm font-medium text-muted-foreground transition hover:text-foreground">Continue shopping</button>
            </div>
          </>
        )}
          </D.Content>
        </D.Portal>
      </D.Root>
    </>
  );

  function remove(i) {
    cart.remove(i.key);
    toast(`${i.name} removed`, { action: { label: 'Undo', onClick: () => cart.add(i, { silent: true }) } });
  }
}
