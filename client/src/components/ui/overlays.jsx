import { useEffect, useState } from 'react';
import * as D from '@radix-ui/react-dialog';
import * as DM from '@radix-ui/react-dropdown-menu';
import * as T from '@radix-ui/react-tooltip';
import { X, AlertTriangle, HelpCircle } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Button, Textarea } from './primitives';

/* ----------------------------------------------------------------- dialog */
export function Dialog({ open, onOpenChange, title, description, children, footer, size = 'md', icon: Icon }) {
  const w = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' }[size];
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal>
        <D.Overlay className="anim-overlay fixed inset-0 z-50 bg-zinc-950/50 backdrop-blur-sm" />
        <D.Content className={cn('anim-dialog fixed top-1/2 left-1/2 z-50 flex max-h-[90vh] w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col rounded-3xl border border-border bg-card shadow-2xl outline-none', w)}>
          <div className="flex items-start gap-3 px-6 pt-6 pb-4">
            {Icon && <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-primary-soft text-primary"><Icon className="size-5" /></span>}
            <div className="min-w-0 flex-1">
              <D.Title className="font-display text-lg font-semibold tracking-tight">{title}</D.Title>
              {description ? <D.Description className="mt-1 text-sm text-muted-foreground">{description}</D.Description> : <D.Description className="sr-only">{title}</D.Description>}
            </div>
            <D.Close className="grid size-8 place-items-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground cursor-pointer"><X className="size-4" /></D.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6">{children}</div>
          {footer && <div className="flex items-center justify-end gap-2 border-t border-border px-6 py-4">{footer}</div>}
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}

/** Mobile side drawer */
export function Sheet({ open, onOpenChange, children, className }) {
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal>
        <D.Overlay className="anim-overlay fixed inset-0 z-50 bg-zinc-950/50 backdrop-blur-sm" />
        <D.Content className={cn('anim-sheet fixed inset-y-0 left-0 z-50 w-[290px] bg-sidebar shadow-2xl outline-none', className)}>
          <D.Title className="sr-only">Menu</D.Title><D.Description className="sr-only">Navigation</D.Description>
          {children}
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}

/* --------------------------------------------------------------- dropdown */
export const Menu = DM.Root;
export const MenuTrigger = DM.Trigger;
export function MenuContent({ children, align = 'end', className }) {
  return (
    <DM.Portal>
      <DM.Content align={align} sideOffset={8} className={cn('anim-pop z-50 min-w-52 rounded-2xl border border-border bg-card p-1.5 shadow-lift', className)}>{children}</DM.Content>
    </DM.Portal>
  );
}
export function MenuItem({ icon: Icon, children, danger, className, ...props }) {
  return (
    <DM.Item className={cn('flex cursor-pointer items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm outline-none transition data-[highlighted]:bg-muted', danger ? 'text-danger' : 'text-foreground', className)} {...props}>
      {Icon && <Icon className="size-4 opacity-70" />}{children}
    </DM.Item>
  );
}
export const MenuSeparator = () => <DM.Separator className="my-1 h-px bg-border" />;
export const MenuLabel = ({ children }) => <DM.Label className="px-2.5 py-1.5 text-xs font-medium text-muted-foreground">{children}</DM.Label>;

/* ---------------------------------------------------------------- tooltip */
export const TooltipProvider = ({ children }) => <T.Provider delayDuration={200} skipDelayDuration={400}>{children}</T.Provider>;
/**
 * Tooltip. content can be a string/node, or { title, description, kbd } for a richer card.
 * Glass surface with a gradient edge and a short directional slide.
 */
export function Tip({ content, children, side = 'top', align = 'center', className }) {
  if (!content) return children;
  const rich = content && typeof content === 'object' && !Array.isArray(content) && ('title' in content || 'description' in content);
  return (
    <T.Root>
      <T.Trigger asChild>{children}</T.Trigger>
      <T.Portal>
        <T.Content side={side} align={align} sideOffset={8} collisionPadding={10}
          className={cn('tip-surface anim-tip z-[60] max-w-72 rounded-xl px-3 py-2 text-xs leading-snug text-white shadow-[0_12px_32px_-8px_rgb(0_0_0/0.45)]', rich && 'px-3.5 py-2.5', className)}>
          {rich ? (
            <span className="block">
              <span className="flex items-center justify-between gap-3"><span className="text-[13px] font-semibold">{content.title}</span>{content.kbd && <kbd className="rounded-md bg-white/15 px-1.5 py-0.5 font-sans text-[10px] font-semibold">{content.kbd}</kbd>}</span>
              {content.description && <span className="mt-1 block text-white/70">{content.description}</span>}
            </span>
          ) : <span className="font-medium">{content}</span>}
          <T.Arrow width={12} height={6} className="tip-arrow" />
        </T.Content>
      </T.Portal>
    </T.Root>
  );
}

/* ------------------------------------------ promise based confirm / prompt */
let push = null;
export function DialogHost() {
  const [req, setReq] = useState(null);
  const [text, setText] = useState('');
  useEffect(() => { push = (r) => { setText(''); setReq(r); }; return () => { push = null; }; }, []);
  const close = (v) => { req?.resolve(v); setReq(null); };
  const danger = req?.tone !== 'primary';
  return (
    <Dialog open={!!req} onOpenChange={(o) => !o && close(req?.prompt ? null : false)} size="sm" title={req?.title} description={req?.description} icon={danger ? AlertTriangle : HelpCircle}
      footer={<>
        <Button variant="outline" onClick={() => close(req?.prompt ? null : false)}>Cancel</Button>
        <Button variant={danger ? 'danger' : 'primary'} disabled={req?.prompt && req.required !== false && !text.trim()} onClick={() => close(req?.prompt ? text.trim() : true)}>{req?.confirmText || 'Confirm'}</Button>
      </>}>
      {req?.prompt && <Textarea autoFocus placeholder={req.placeholder} value={text} onChange={(e) => setText(e.target.value)} />}
    </Dialog>
  );
}
/** await confirm({ title, description, confirmText, tone: 'danger' | 'primary' }) */
export const confirm = (opts = {}) => new Promise((resolve) => (push ? push({ title: 'Are you sure?', description: "This action can't be undone.", confirmText: 'Delete', ...opts, resolve }) : resolve(window.confirm(opts.title || 'Are you sure?'))));
export const promptText = (opts = {}) => new Promise((resolve) => (push ? push({ confirmText: 'Submit', tone: 'danger', ...opts, prompt: true, resolve }) : resolve(window.prompt(opts.title))));
