import { useEffect, useRef, useState } from 'react';
import { motion, useInView, useMotionValue, useSpring, animate } from 'motion/react';
import { cn } from '@/lib/cn';

const ease = [0.16, 1, 0.3, 1];

/** Fade/slide in when scrolled into view */
export function Reveal({ children, delay = 0, y = 24, className, as = 'div', once = true }) {
  const M = motion[as];
  return (
    <M initial={{ opacity: 0, y }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once, margin: '-60px' }} transition={{ duration: 0.7, delay, ease }} className={className}>
      {children}
    </M>
  );
}

/** Children animate one after another when in view */
export function Stagger({ children, className, gap = 0.08 }) {
  return (
    <motion.div initial="hidden" whileInView="show" viewport={{ once: true, margin: '-60px' }} variants={{ show: { transition: { staggerChildren: gap } } }} className={className}>
      {children}
    </motion.div>
  );
}
export const StaggerItem = ({ children, className }) => (
  <motion.div variants={{ hidden: { opacity: 0, y: 24, scale: 0.98 }, show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.6, ease } } }} className={className}>{children}</motion.div>
);

/** Animated number */
export function CountUp({ value, format = (v) => Math.round(v).toLocaleString(), duration = 1.2 }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true });
  const target = Number(value) || 0;
  useEffect(() => {
    const el = ref.current;
    const show = (v) => { if (el) el.textContent = format(v); };
    // the real number is always shown: when the tab is hidden, the element is off screen or animation is unavailable it must never stay at 0
    if (!inView || (typeof document !== 'undefined' && document.hidden)) { show(target); return undefined; }
    const c = animate(0, target, { duration, ease, onUpdate: show, onComplete: () => show(target) });
    const t = setTimeout(() => show(target), (duration + 0.4) * 1000);
    return () => { c.stop(); clearTimeout(t); show(target); };
  }, [inView, target]); // eslint-disable-line
  return <span ref={ref}>{format(target)}</span>;
}

/** Infinite horizontal marquee */
export function Marquee({ children, reverse, duration = 40, className, pauseOnHover = true }) {
  return (
    <div className={cn('group flex overflow-hidden mask-fade-x', className)} style={{ '--marquee-duration': `${duration}s` }}>
      {[0, 1].map((k) => (
        <div key={k} aria-hidden={k === 1} className={cn('flex shrink-0 items-center gap-4 pr-4', reverse ? 'animate-marquee-reverse' : 'animate-marquee', pauseOnHover && 'group-hover:[animation-play-state:paused]')} style={{ width: 'max-content' }}>
          {children}
        </div>
      ))}
    </div>
  );
}

/** Tracks the mouse to drive the .spotlight radial highlight */
export function Spotlight({ className, children, ...props }) {
  const onMove = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty('--mx', `${e.clientX - r.left}px`);
    e.currentTarget.style.setProperty('--my', `${e.clientY - r.top}px`);
  };
  return <div onMouseMove={onMove} className={cn('spotlight', className)} {...props}>{children}</div>;
}

/** 3D tilt that follows the cursor */
export function Tilt({ children, className, max = 10 }) {
  const rx = useSpring(useMotionValue(0), { stiffness: 150, damping: 15 });
  const ry = useSpring(useMotionValue(0), { stiffness: 150, damping: 15 });
  return (
    <motion.div
      className={className}
      style={{ rotateX: rx, rotateY: ry, transformPerspective: 1000 }}
      onMouseMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        ry.set(((e.clientX - r.left) / r.width - 0.5) * max * 2);
        rx.set(-((e.clientY - r.top) / r.height - 0.5) * max * 2);
      }}
      onMouseLeave={() => { rx.set(0); ry.set(0); }}
    >
      {children}
    </motion.div>
  );
}

/** Concentric NFC "tap" ripples */
export function Ripples({ className, color = 'bg-primary/25', count = 3 }) {
  return (
    <div className={cn('pointer-events-none absolute inset-0 grid place-items-center', className)}>
      {Array.from({ length: count }).map((_, i) => (
        <span key={i} className={cn('absolute size-full animate-ripple rounded-full', color)} style={{ animationDelay: `${i * 0.8}s` }} />
      ))}
    </div>
  );
}

/** true on screens wide enough for the heavy background effects, when the person has not asked for reduced motion */
function useRichMotion() {
  const q = '(min-width: 768px) and (prefers-reduced-motion: no-preference)';
  const [ok, setOk] = useState(() => typeof window !== 'undefined' && window.matchMedia(q).matches);
  useEffect(() => { const m = window.matchMedia(q); const f = () => setOk(m.matches); m.addEventListener('change', f); return () => m.removeEventListener('change', f); }, []);
  return ok;
}

/** Soft animated colour blobs for backgrounds (still, and lighter, on phones and with reduced motion: huge blurred layers are costly to repaint) */
export function Aurora({ className }) {
  const rich = useRichMotion();
  const B = rich ? motion.div : 'div';
  const anim = (a, d) => (rich ? { animate: a, transition: { duration: d, repeat: Infinity, ease: 'easeInOut' } } : {});
  return (
    <div className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)}>
      <B {...anim({ x: [0, 80, -40, 0], y: [0, 60, 20, 0], scale: [1, 1.15, 0.95, 1] }, 18)} className={cn('absolute -top-40 -left-32 size-[560px] rounded-full bg-violet-500/30 dark:bg-violet-600/30', rich ? 'blur-[120px]' : 'blur-[60px]')} />
      <B {...anim({ x: [0, -70, 30, 0], y: [0, 40, -30, 0], scale: [1, 0.9, 1.1, 1] }, 22)} className={cn('absolute top-10 -right-40 size-[520px] rounded-full bg-fuchsia-500/25 dark:bg-fuchsia-600/25', rich ? 'blur-[120px]' : 'blur-[60px]')} />
      <B {...anim({ x: [0, 50, -60, 0], y: [0, -40, 30, 0] }, 26)} className={cn('absolute -bottom-48 left-1/3 size-[480px] rounded-full bg-lime-300/20', rich ? 'blur-[120px]' : 'blur-[60px]')} />
    </div>
  );
}
