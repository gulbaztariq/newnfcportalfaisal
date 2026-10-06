import { cn } from '@/lib/cn';

export function LogoMark({ className }) {
  return (
    <svg viewBox="0 0 64 64" className={cn('size-9', className)} aria-hidden="true">
      <defs>
        <linearGradient id="lg-mark" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#6d5dfc" /><stop offset="1" stopColor="#b44cf5" /></linearGradient>
      </defs>
      <rect width="64" height="64" rx="18" fill="url(#lg-mark)" />
      <g fill="none" stroke="#fff" strokeWidth="4.5" strokeLinecap="round">
        <path d="M30 22a14 14 0 0 1 0 20" /><path d="M37 16a22 22 0 0 1 0 32" /><path d="M44 10a30 30 0 0 1 0 44" stroke="#d9ff4a" />
      </g>
      <circle cx="22" cy="32" r="5" fill="#fff" />
    </svg>
  );
}

export default function Logo({ name = 'InfyVCards', className, mark, textClass }) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <LogoMark className={mark} />
      <span className={cn('font-display text-[19px] font-bold tracking-tight', textClass)}>
        {name.slice(0, 4)}<span className="text-primary">{name.slice(4)}</span>
      </span>
    </span>
  );
}
