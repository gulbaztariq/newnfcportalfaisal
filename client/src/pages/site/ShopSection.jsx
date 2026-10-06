/* Landing-page "Shop NFC products" section: featured products with quick add. Renders nothing when the shop is off or empty. */
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Truck, Banknote, Wand2 } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { EnsureCart, useCart, useCatalog, formatPrice } from '@/lib/cart';
import { ButtonLink, Reveal, Stagger, StaggerItem } from '@/components/ui';
import { ProductCard, QuickView, sortProducts } from './Shop';

export function ShopSection({ limit = 4 }) {
  const { settings } = useAuth() || {};
  if (settings?.shop_enable === '0') return null;
  return <EnsureCart><ShopSectionInner limit={limit} /></EnsureCart>;
}

function ShopSectionInner({ limit }) {
  const { data } = useCatalog();
  const cart = useCart();
  const [quick, setQuick] = useState(null);
  const setCurrency = cart?.setCurrency;
  useEffect(() => { if (data?.config?.currency && setCurrency) setCurrency(data.config.currency); }, [data, setCurrency]);
  const products = useMemo(() => sortProducts(data?.data).filter((p) => Number(p.price) > 0).slice(0, limit), [data, limit]);
  if (!products.length) return null;
  const cfg = data.config || {};
  const money = (a) => formatPrice(a, cfg.currency || 'Rs');
  const perks = [
    cfg.free_delivery_above > 0 && [Truck, `Free delivery over ${money(cfg.free_delivery_above)}`],
    cfg.cod_enable && [Banknote, 'Cash on delivery'],
    cfg.ai_design && [Wand2, 'Design your card with AI'],
  ].filter(Boolean);
  return (
    <section id="shop" className="relative overflow-hidden py-28">
      <div className="pointer-events-none absolute inset-x-0 top-1/3 -z-10 mx-auto h-96 max-w-4xl rounded-full bg-linear-to-r from-violet-500/15 via-fuchsia-500/15 to-lime-300/15 blur-[120px]" />
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <Reveal className="mx-auto mb-12 max-w-2xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary-soft px-3 py-1 text-xs font-semibold tracking-wide text-primary uppercase"><span className="size-1.5 animate-pulse rounded-full bg-current" />Shop</span>
          <h2 className="mt-4 font-display text-4xl leading-[1.08] font-bold tracking-tight text-balance md:text-5xl">Shop NFC <span className="text-gradient">products</span></h2>
          <p className="mt-4 text-lg text-balance text-muted-foreground">Cards, standees, tags and wearables that open your profile with one tap. Delivered to your door.</p>
          {perks.length > 0 && (
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              {perks.map(([I, l]) => <span key={l} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium"><I className="size-3.5 text-primary" />{l}</span>)}
            </div>
          )}
        </Reveal>
        <Stagger className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
          {products.map((p) => <StaggerItem key={p.id} className="h-full"><ProductCard p={p} money={money} onQuick={setQuick} /></StaggerItem>)}
        </Stagger>
        <Reveal className="mt-10 flex justify-center">
          <ButtonLink as={Link} to="/shop" size="lg" variant="outline" className="group">View all products <ArrowRight className="transition-transform group-hover:translate-x-1" /></ButtonLink>
        </Reveal>
      </div>
      <QuickView product={quick} onClose={() => setQuick(null)} money={money} />
    </section>
  );
}

export default ShopSection;
