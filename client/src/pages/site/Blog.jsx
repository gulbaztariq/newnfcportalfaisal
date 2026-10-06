import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { motion } from 'motion/react';
import { ArrowLeft, ArrowRight, CalendarDays, Newspaper } from 'lucide-react';
import api from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { fmtDate } from '@/lib/format';
import { Spinner, Aurora, Stagger, StaggerItem, EmptyState } from '@/components/ui';
import { Navbar, Footer, ScrollProgress, SiteExtras, useSiteTheme } from './SiteChrome';

export function BlogCard({ b }) {
  return (
    <Link to={`/blog/${b.slug}`} className="group flex h-full flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-soft transition duration-500 hover:-translate-y-1 hover:shadow-lift">
      <div className="aspect-[16/9] overflow-hidden bg-muted">
        {b.image ? <img src={b.image} alt="" loading="lazy" className="size-full object-cover transition duration-700 group-hover:scale-105" />
          : <div className="grid size-full place-items-center bg-linear-to-br from-violet-500/20 to-fuchsia-500/20"><Newspaper className="size-10 text-primary/60" /></div>}
      </div>
      <div className="flex flex-1 flex-col p-6">
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><CalendarDays className="size-3.5" />{fmtDate(b.created_at)}</p>
        <h3 className="mt-2 font-display text-lg leading-snug font-semibold text-balance group-hover:text-primary">{b.title}</h3>
        {b.excerpt && <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{b.excerpt}</p>}
        <span className="mt-auto inline-flex items-center gap-1 pt-4 text-sm font-medium text-primary">Read article <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" /></span>
      </div>
    </Link>
  );
}

function Page({ children, title }) {
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

export function BlogList() {
  const [rows, setRows] = useState(null);
  useEffect(() => { api.get('/public/blogs').then(({ data }) => setRows(data.data)); }, []);
  return (
    <Page title="Blog">
      <section className="relative overflow-hidden pt-36 pb-14">
        <Aurora className="opacity-60" />
        <div className="relative mx-auto max-w-3xl px-6 text-center">
          <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="font-display text-5xl font-extrabold tracking-tight md:text-6xl">Blog</motion.h1>
          <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="mt-4 text-lg text-muted-foreground">Tips on networking, digital business cards and growing your brand.</motion.p>
        </div>
      </section>
      <div className="mx-auto max-w-6xl px-6 pb-24">
        {!rows ? <div className="grid place-items-center py-20"><Spinner /></div> : !rows.length ? <EmptyState icon={Newspaper} title="No articles yet" description="Check back soon." /> : (
          <Stagger className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">{rows.map((b) => <StaggerItem key={b.id}><BlogCard b={b} /></StaggerItem>)}</Stagger>
        )}
      </div>
    </Page>
  );
}

export function BlogPost() {
  const { slug } = useParams();
  const [post, setPost] = useState(null);
  const [missing, setMissing] = useState(false);
  useEffect(() => { setPost(null); setMissing(false); api.get(`/public/blogs/${encodeURIComponent(slug)}`).then(({ data }) => setPost(data.data)).catch(() => setMissing(true)); }, [slug]);
  return (
    <Page title={post?.title}>
      <article className="mx-auto max-w-3xl px-6 pt-32 pb-24">
        <Link to="/blog" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-primary"><ArrowLeft className="size-4" />All articles</Link>
        {missing ? <EmptyState icon={Newspaper} title="Article not found" /> : !post ? <div className="grid place-items-center py-20"><Spinner /></div> : (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <p className="mt-8 flex items-center gap-1.5 text-sm text-muted-foreground"><CalendarDays className="size-4" />{fmtDate(post.created_at)}</p>
            <h1 className="mt-3 font-display text-4xl leading-tight font-extrabold tracking-tight text-balance md:text-5xl">{post.title}</h1>
            {post.excerpt && <p className="mt-4 text-lg text-muted-foreground">{post.excerpt}</p>}
            {post.image && <img src={post.image} alt="" className="mt-8 w-full rounded-3xl border border-border object-cover shadow-soft" />}
            {/* content is sanitised server-side (sanitize-html) when saved */}
            <div className="prose-content mt-10" dangerouslySetInnerHTML={{ __html: post.content }} />
          </motion.div>
        )}
      </article>
    </Page>
  );
}
