import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence, useScroll, useSpring, useMotionValueEvent } from 'motion/react';
import { ArrowRight, Menu, X, Send, Mail, Phone, MapPin, Apple, Play, ShoppingBag, Truck } from 'lucide-react';
import { CartButton, CartDrawer, useCart } from '@/lib/cart';
import { Facebook, Twitter, Instagram, Linkedin, Whatsapp } from '@/components/BrandIcons';
import { toast } from 'sonner';
import api from '@/lib/api';
import { useAuth, homeFor } from '@/lib/auth';
import { cn } from '@/lib/cn';
import Logo from '@/components/Logo';
import { ButtonLink, Dialog, Button, Input } from '@/components/ui';
import { MailCheck } from 'lucide-react';

export const NAV = [['features', 'Features'], ['how', 'How it works'], ['templates', 'Templates'], ['pricing', 'Pricing'], ['faq', 'FAQ'], ['contact', 'Contact']];

export function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const x = useSpring(scrollYProgress, { stiffness: 120, damping: 30 });
  return <motion.div style={{ scaleX: x }} className="fixed inset-x-0 top-0 z-[60] h-[3px] origin-left bg-linear-to-r from-violet-500 via-fuchsia-500 to-lime-300" />;
}

export function Navbar({ settings, home = true }) {
  const { user } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const { scrollY } = useScroll();
  useMotionValueEvent(scrollY, 'change', (v) => setScrolled(v > 24));
  const href = (id) => (home ? `#${id}` : `/#${id}`);
  const shop = settings.shop_enable !== '0';
  const cart = useCart();
  return (
    <header className="fixed inset-x-0 top-3 z-50 px-3">
      <motion.nav initial={{ y: -30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className={cn('mx-auto flex h-14 max-w-6xl items-center gap-2 rounded-2xl sm:gap-4 px-3 pl-4 transition-all duration-500', scrolled ? 'glass border border-border shadow-lift' : 'border border-transparent')}>
        <Link to="/" className="min-w-0 shrink"><Logo name={settings.app_name || 'NFC Profile'} mark="size-8 shrink-0" className="max-w-full min-w-0" textClass="truncate" /></Link>
        <div className="mx-auto hidden items-center gap-1 lg:flex">
          {NAV.map(([id, l]) => <a key={id} href={href(id)} className="rounded-xl px-3.5 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground">{l}</a>)}
          {shop && <Link to="/shop" className="rounded-xl px-3.5 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground">Shop</Link>}
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2 lg:ml-0">
          {shop && <CartButton />}
          {user ? <ButtonLink as={Link} to={homeFor(user)} size="sm">Dashboard <ArrowRight className="max-sm:hidden" /></ButtonLink> : (
            <>
              <Link to="/login" className="hidden rounded-xl px-3.5 py-2 text-sm font-medium text-muted-foreground transition hover:text-foreground sm:block">Sign in</Link>
              {settings.register_enable !== '0' && <ButtonLink as={Link} to="/register" size="sm" className="group">Get started <ArrowRight className="transition-transform group-hover:translate-x-0.5 max-sm:hidden" /></ButtonLink>}
            </>
          )}
          <button type="button" onClick={() => setOpen(!open)} className="grid size-9 cursor-pointer place-items-center rounded-xl hover:bg-muted lg:hidden" aria-label="Menu">{open ? <X className="size-5" /> : <Menu className="size-5" />}</button>
        </div>
      </motion.nav>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, y: -10, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -10, scale: 0.98 }} className="glass mx-auto mt-2 max-w-6xl rounded-2xl border border-border p-2 shadow-lift lg:hidden">
            {NAV.map(([id, l], i) => (
              <motion.a initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0, transition: { delay: i * 0.04 } }} key={id} href={href(id)} onClick={() => setOpen(false)} className="block rounded-xl px-4 py-3 text-sm font-medium hover:bg-muted">{l}</motion.a>
            ))}
            {shop && (
              <>
                <Link to="/shop" onClick={() => setOpen(false)} className="flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium hover:bg-muted"><ShoppingBag className="size-4 text-primary" />Shop</Link>
                {cart && <button type="button" onClick={() => { setOpen(false); cart.setOpen(true); }} className="flex w-full cursor-pointer items-center gap-2 rounded-xl px-4 py-3 text-left text-sm font-medium hover:bg-muted">Cart{cart.count > 0 && <span className="rounded-full bg-primary px-2 py-0.5 text-[11px] font-bold text-white">{cart.count}</span>}</button>}
                <Link to="/track" onClick={() => setOpen(false)} className="flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium hover:bg-muted"><Truck className="size-4 text-primary" />Track order</Link>
              </>
            )}
            {!user && <Link to="/login" className="block rounded-xl px-4 py-3 text-sm font-medium hover:bg-muted">Sign in</Link>}
          </motion.div>
        )}
      </AnimatePresence>
      {shop && <CartDrawer />}
    </header>
  );
}

export function Footer({ settings }) {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const subscribe = async (e) => {
    e.preventDefault(); setBusy(true);
    try { const { data } = await api.post('/public/subscribe', { email }); toast.success(data.message); setEmail(''); } catch (ex) { toast.error(Object.values(ex.errors || {})[0] || ex.message); } finally { setBusy(false); }
  };
  const socials = [[settings.facebook_url, Facebook], [settings.twitter_url, Twitter], [settings.instagram_url, Instagram], [settings.linkedin_url, Linkedin]].filter(([u]) => u);
  return (
    <footer className="relative overflow-hidden border-t border-border bg-card">
      <div className="mx-auto grid max-w-6xl gap-12 px-6 py-16 md:grid-cols-12">
        <div className="md:col-span-5">
          <Logo name={settings.app_name || 'NFC Profile'} />
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-muted-foreground">{settings.home_sub_text}</p>
          <form onSubmit={subscribe} className="mt-6 flex max-w-sm gap-2 rounded-2xl border border-border bg-background p-1.5 focus-within:border-primary">
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Your e-mail for updates" className="min-w-0 flex-1 bg-transparent px-3 text-sm outline-none" />
            <button disabled={busy} className="grid size-9 cursor-pointer place-items-center rounded-xl bg-primary text-white transition hover:brightness-110 disabled:opacity-50" aria-label="Subscribe"><Send className="size-4" /></button>
          </form>
          {(settings.mobile_app_play_store_url || settings.mobile_app_app_store_url) && (
            <div className="mt-5 flex flex-wrap gap-2">
              {settings.mobile_app_app_store_url && <a href={settings.mobile_app_app_store_url} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-xl bg-foreground px-3.5 py-2 text-background transition hover:opacity-90"><Apple className="size-5" /><span className="text-left text-[10px] leading-tight">Download on the<br /><b className="text-sm">App Store</b></span></a>}
              {settings.mobile_app_play_store_url && <a href={settings.mobile_app_play_store_url} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-xl bg-foreground px-3.5 py-2 text-background transition hover:opacity-90"><Play className="size-5" /><span className="text-left text-[10px] leading-tight">Get it on<br /><b className="text-sm">Google Play</b></span></a>}
            </div>
          )}
        </div>
        <div className="md:col-span-2">
          <p className="text-sm font-semibold">Product</p>
          <ul className="mt-4 space-y-2.5 text-sm text-muted-foreground">{NAV.slice(0, 4).map(([id, l]) => <li key={id}><a href={`/#${id}`} className="transition hover:text-foreground">{l}</a></li>)}</ul>
        </div>
        <div className="md:col-span-2">
          <p className="text-sm font-semibold">Company</p>
          <ul className="mt-4 space-y-2.5 text-sm text-muted-foreground">
            <li><a href="/#contact" className="hover:text-foreground">Contact</a></li>
            {settings.front_blog_enable !== '0' && <li><Link to="/blog" className="hover:text-foreground">Blog</Link></li>}
            {settings.business_directory_enable !== '0' && <li><Link to="/directory" className="hover:text-foreground">Directory</Link></li>}
            {settings.shop_enable !== '0' && <li><Link to="/shop" className="hover:text-foreground">Shop</Link></li>}
            {settings.shop_enable !== '0' && <li><Link to="/track" className="hover:text-foreground">Track order</Link></li>}
            <li><Link to="/terms-conditions" className="hover:text-foreground">Terms</Link></li>
            <li><Link to="/privacy-policy" className="hover:text-foreground">Privacy</Link></li>
            <li><Link to="/login" className="hover:text-foreground">Sign in</Link></li>
          </ul>
        </div>
        <div className="md:col-span-3">
          <p className="text-sm font-semibold">Get in touch</p>
          <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
            {settings.email && <li><a href={`mailto:${settings.email}`} className="flex items-center gap-2 hover:text-foreground"><Mail className="size-4" />{settings.email}</a></li>}
            {settings.phone && <li className="flex items-center gap-2"><Phone className="size-4" />+{settings.region_code} {settings.phone}</li>}
            {settings.address && <li className="flex items-start gap-2"><MapPin className="mt-0.5 size-4 shrink-0" />{settings.address}</li>}
          </ul>
          {socials.length > 0 && (
            <div className="mt-5 flex gap-2">
              {socials.map(([u, I]) => <a key={u} href={u} target="_blank" rel="noreferrer" className="grid size-9 place-items-center rounded-xl border border-border text-muted-foreground transition hover:-translate-y-0.5 hover:border-primary hover:text-primary"><I className="size-4" /></a>)}
            </div>
          )}
        </div>
      </div>
      <div className="border-t border-border py-6 text-center text-xs text-muted-foreground">© {new Date().getFullYear()} {settings.app_name || 'NFC Profile'}. All rights reserved.</div>
      <p aria-hidden className="pointer-events-none -mb-8 text-center font-display text-[18vw] leading-none font-extrabold tracking-tighter text-foreground/[0.035] select-none">{settings.app_name || 'NFC Profile'}</p>
    </footer>
  );
}

/** Newsletter popup, WhatsApp chat button and the admin's custom CSS for the public site */
export function SiteExtras({ settings }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (settings.newsletter_popup_enable !== '1') return undefined;
    let seen = false; try { seen = localStorage.getItem('newsletter-seen') === '1'; } catch { /* ignore */ }
    if (seen) return undefined;
    const t = setTimeout(() => { setOpen(true); try { localStorage.setItem('newsletter-seen', '1'); } catch { /* ignore */ } }, 12000);
    return () => clearTimeout(t);
  }, [settings.newsletter_popup_enable]);
  const subscribe = async (e) => {
    e.preventDefault(); setBusy(true);
    try { const { data } = await api.post('/public/subscribe', { email }); toast.success(data.message); setOpen(false); } catch (ex) { toast.error(Object.values(ex.errors || {})[0] || ex.message); } finally { setBusy(false); }
  };
  const wa = String(settings.home_whatsapp_number || '').replace(/\D/g, '');
  return (
    <>
      {settings.home_custom_css && <style>{settings.home_custom_css}</style>}
      {wa && (
        <motion.a initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 1.5, type: 'spring', stiffness: 260, damping: 18 }}
          href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer" aria-label="Chat on WhatsApp"
          className="group fixed right-5 bottom-5 z-40 grid size-14 place-items-center rounded-full bg-[#25d366] text-white shadow-lift transition hover:scale-110">
          <span className="absolute inset-0 animate-ping rounded-full bg-[#25d366]/40" />
          <Whatsapp className="relative size-7" />
        </motion.a>
      )}
      <Dialog open={open} onOpenChange={setOpen} size="sm" icon={MailCheck} title="Stay in the loop" description="Product news, networking tips and offers. No spam, unsubscribe anytime.">
        <form onSubmit={subscribe} className="flex gap-2">
          <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" aria-label="E-mail" />
          <Button type="submit" loading={busy}>Subscribe</Button>
        </form>
      </Dialog>
    </>
  );
}

/** Applies the Front CMS theme (1 = light, 2 = dark) while the public site is shown */
export function useSiteTheme(frontTheme) {
  useEffect(() => {
    if (!frontTheme) return undefined;
    const html = document.documentElement;
    const had = html.classList.contains('dark');
    html.classList.toggle('dark', frontTheme === '2');
    return () => html.classList.toggle('dark', had);
  }, [frontTheme]);
}
