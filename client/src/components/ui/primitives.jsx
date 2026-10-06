import { forwardRef } from 'react';
import { motion } from 'motion/react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/cn';

/* ----------------------------------------------------------------- button */
const VARIANTS = {
  primary: 'bg-primary text-primary-foreground shadow-[0_1px_0_rgb(255_255_255/.15)_inset,0_6px_20px_-8px_var(--primary)] hover:brightness-110',
  secondary: 'bg-muted text-foreground hover:bg-muted/70',
  outline: 'border border-border bg-card text-foreground hover:bg-muted',
  ghost: 'text-muted-foreground hover:bg-muted hover:text-foreground',
  danger: 'bg-danger text-white hover:brightness-110 shadow-[0_6px_20px_-8px_var(--danger)]',
  'danger-soft': 'bg-danger-soft text-danger hover:bg-danger hover:text-white',
  'success-soft': 'bg-success-soft text-success hover:bg-success hover:text-white',
  soft: 'bg-primary-soft text-primary hover:bg-primary hover:text-primary-foreground',
  white: 'bg-white text-zinc-900 hover:bg-white/90 shadow-lg',
  accent: 'bg-accent text-accent-foreground hover:brightness-105 shadow-[0_8px_30px_-8px_var(--accent)]',
};
const SIZES = {
  xs: 'h-7 px-2.5 text-xs gap-1 rounded-lg',
  sm: 'h-8 px-3 text-[13px] gap-1.5 rounded-lg',
  md: 'h-10 px-4 text-sm gap-2 rounded-xl',
  lg: 'h-12 px-6 text-[15px] gap-2 rounded-xl',
  xl: 'h-14 px-8 text-base gap-2.5 rounded-2xl',
  icon: 'size-9 rounded-xl',
  'icon-sm': 'size-8 rounded-lg',
};

export const Button = forwardRef(function Button({ variant = 'primary', size = 'md', loading, className, children, disabled, asChild, ...props }, ref) {
  return (
    <motion.button
      ref={ref}
      whileTap={{ scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      disabled={disabled || loading}
      className={cn('inline-flex shrink-0 items-center justify-center font-medium whitespace-nowrap transition-[background,color,filter,box-shadow] duration-200 disabled:pointer-events-none disabled:opacity-50 cursor-pointer select-none [&_svg]:size-4 [&_svg]:shrink-0', VARIANTS[variant], SIZES[size], className)}
      {...props}
    >
      {loading && <Loader2 className="animate-spin" />}
      {children}
    </motion.button>
  );
});

/** Same look as Button for <a>/<Link>. Pass `as={Link}` */
export function ButtonLink({ as: Comp = 'a', variant = 'primary', size = 'md', className, ...props }) {
  return <Comp className={cn('inline-flex items-center justify-center font-medium whitespace-nowrap transition-all duration-200 active:scale-[.97] [&_svg]:size-4 [&_svg]:shrink-0', VARIANTS[variant], SIZES[size], className)} {...props} />;
}

/* ------------------------------------------------------------------ input */
const inputBase = 'w-full rounded-xl border border-input bg-card px-3.5 text-sm text-foreground placeholder:text-muted-foreground/70 transition-[border,box-shadow] duration-200 outline-none focus:border-primary focus:ring-4 focus:ring-primary/15 disabled:opacity-60 aria-[invalid=true]:border-danger aria-[invalid=true]:ring-danger/15';

export const Input = forwardRef(function Input({ className, icon: Icon, suffix, prefix, ...props }, ref) {
  if (!Icon && !suffix && !prefix) return <input ref={ref} className={cn(inputBase, 'h-10', className)} {...props} />;
  return (
    <div className={cn('relative flex items-center', className)}>
      {Icon && <Icon className="pointer-events-none absolute left-3.5 size-4 text-muted-foreground" />}
      {prefix && <span className="flex h-10 items-center rounded-l-xl border border-r-0 border-input bg-muted px-3 text-sm text-muted-foreground">{prefix}</span>}
      <input ref={ref} className={cn(inputBase, 'h-10', Icon && 'pl-10', prefix && 'rounded-l-none', suffix && 'pr-11')} {...props} />
      {suffix && <span className="absolute right-1.5 flex items-center">{suffix}</span>}
    </div>
  );
});

export const Textarea = forwardRef(function Textarea({ className, ...props }, ref) {
  return <textarea ref={ref} className={cn(inputBase, 'min-h-24 py-2.5 leading-relaxed', className)} {...props} />;
});

export function Label({ className, children, required, ...props }) {
  return <label className={cn('mb-1.5 block text-[13px] font-medium text-foreground/90', className)} {...props}>{children}{required && <span className="ml-0.5 text-danger">*</span>}</label>;
}

/** Label + control + hint + error */
export function Field({ label, htmlFor, error, hint, required, className, children }) {
  return (
    <div className={className}>
      {label && <Label htmlFor={htmlFor} required={required}>{label}</Label>}
      {children}
      {error ? <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="mt-1.5 text-xs font-medium text-danger">{error}</motion.p>
        : hint ? <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

/* ------------------------------------------------------------------ badge */
const TONES = {
  neutral: 'bg-muted text-muted-foreground',
  primary: 'bg-primary-soft text-primary',
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning',
  danger: 'bg-danger-soft text-danger',
  info: 'bg-info-soft text-info',
  outline: 'border border-border text-muted-foreground',
};
export function Badge({ tone = 'neutral', dot, className, children }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap', TONES[tone], className)}>
      {dot && <span className="size-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

const STATUS = {
  active: 'success', paid: 'success', approved: 'success', delivered: 'success', verified: 'success', written: 'success',
  pending: 'warning', processing: 'info', ready: 'primary', shipped: 'info', inactive: 'danger', rejected: 'danger', cancelled: 'danger', expired: 'danger',
  confirmed: 'info', designing: 'primary', printing: 'primary', returned: 'danger', sent: 'info', partial: 'warning', overdue: 'danger', unpaid: 'warning',
  failed: 'danger', skipped: 'neutral', draft: 'neutral', dispatched: 'info', settled: 'success', low: 'danger',
};
export const StatusBadge = ({ value, children }) => (
  <Badge tone={STATUS[String(value).toLowerCase()] || 'neutral'} dot>{children || String(value).replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}</Badge>
);

/* ------------------------------------------------------------------- card */
export function Card({ className, children, hover, ...props }) {
  return <div className={cn('rounded-2xl border border-border bg-card text-card-foreground shadow-soft', hover && 'transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lift', className)} {...props}>{children}</div>;
}
export function CardHeader({ title, description, actions, className, icon: Icon }) {
  return (
    <div className={cn('flex flex-wrap items-start justify-between gap-3 border-b border-border px-5 py-4', className)}>
      <div className="flex min-w-0 items-center gap-3">
        {Icon && <span className="grid size-9 place-items-center rounded-xl bg-primary-soft text-primary"><Icon className="size-4.5" /></span>}
        <div className="min-w-0">
          <h3 className="font-display text-[15px] font-semibold tracking-tight">{title}</h3>
          {description && <p className="mt-0.5 text-[13px] text-muted-foreground">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
export const CardBody = ({ className, ...p }) => <div className={cn('p-5', className)} {...p} />;
export const CardFooter = ({ className, ...p }) => <div className={cn('flex items-center justify-end gap-2 border-t border-border px-5 py-3.5', className)} {...p} />;

/* ---------------------------------------------------------------- avatar */
const PALETTE = ['from-violet-500 to-fuchsia-500', 'from-sky-500 to-indigo-500', 'from-emerald-500 to-teal-500', 'from-amber-500 to-orange-500', 'from-rose-500 to-pink-500', 'from-cyan-500 to-blue-500'];
export function Avatar({ src, name = '', size = 36, className, ring }) {
  const initials = String(name).split(/\s+/).filter(Boolean).map((w) => w[0]).slice(0, 2).join('').toUpperCase() || '?';
  const grad = PALETTE[[...String(name)].reduce((a, c) => a + c.charCodeAt(0), 0) % PALETTE.length];
  return (
    <span className={cn('relative inline-grid shrink-0 place-items-center overflow-hidden rounded-full bg-linear-to-br font-semibold text-white', grad, ring && 'ring-2 ring-card', className)} style={{ width: size, height: size, fontSize: size * 0.36 }}>
      {src ? <img src={src} alt="" className="size-full object-cover" loading="lazy" /> : initials}
    </span>
  );
}

export const Skeleton = ({ className }) => <div className={cn('skeleton h-4', className)} />;
export const Spinner = ({ className }) => <Loader2 className={cn('size-5 animate-spin text-primary', className)} />;
export const Kbd = ({ children }) => <kbd className="rounded-md border border-border bg-muted px-1.5 py-0.5 font-sans text-[10px] font-medium text-muted-foreground">{children}</kbd>;
export const Divider = ({ className }) => <div className={cn('h-px w-full bg-border', className)} />;
