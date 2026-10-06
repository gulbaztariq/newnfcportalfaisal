import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import api from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Spinner, Aurora } from '@/components/ui';
import { Navbar, Footer, ScrollProgress, SiteExtras, useSiteTheme } from './SiteChrome';

export default function Legal({ slug }) {
  const { settings } = useAuth();
  const [page, setPage] = useState(null);
  useSiteTheme(settings.front_theme);
  useEffect(() => { setPage(null); api.get(`/public/pages/${slug}`).then(({ data }) => { setPage(data); document.title = data.title; }); }, [slug]);
  return (
    <div className="overflow-x-clip">
      <ScrollProgress />
      <Navbar settings={settings} home={false} />
      <section className="relative overflow-hidden pt-36 pb-16">
        <Aurora className="opacity-60" />
        <div className="relative mx-auto max-w-3xl px-6 text-center">
          <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="font-display text-5xl font-extrabold tracking-tight">{page?.title || '...'}</motion.h1>
        </div>
      </section>
      <div className="mx-auto max-w-3xl px-6 pb-24">
        {!page ? <div className="grid place-items-center py-20"><Spinner /></div> : (
          <motion.article initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="prose-content rounded-3xl border border-border bg-card p-8 shadow-soft md:p-12" dangerouslySetInnerHTML={{ __html: page.html }} />
        )}
      </div>
      <Footer settings={settings} />
      <SiteExtras settings={settings} />
    </div>
  );
}
