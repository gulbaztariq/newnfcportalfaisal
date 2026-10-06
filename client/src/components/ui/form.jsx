import { useEffect, useState } from 'react';
import * as S from '@radix-ui/react-select';
import * as Sw from '@radix-ui/react-switch';
import * as Cb from '@radix-ui/react-checkbox';
import { motion } from 'motion/react';
import { Check, ChevronDown, ImagePlus, UploadCloud, X } from 'lucide-react';
import { cn } from '@/lib/cn';

/* ----------------------------------------------------------------- select */
const EMPTY = '__none__';
export function Select({ value, onChange, options, placeholder = 'Select...', className, invalid, allowEmpty, id }) {
  const v = value === null || value === undefined || value === '' ? (allowEmpty ? EMPTY : undefined) : String(value);
  return (
    <S.Root value={v} onValueChange={(x) => onChange(x === EMPTY ? '' : x)}>
      <S.Trigger id={id} aria-invalid={invalid || undefined} className={cn('flex h-10 w-full items-center justify-between gap-2 rounded-xl border border-input bg-card px-3.5 text-left text-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/15 aria-[invalid=true]:border-danger data-[placeholder]:text-muted-foreground/70 cursor-pointer', className)}>
        <span className="truncate"><S.Value placeholder={placeholder} /></span>
        <S.Icon><ChevronDown className="size-4 opacity-60" /></S.Icon>
      </S.Trigger>
      <S.Portal>
        <S.Content position="popper" sideOffset={6} className="anim-pop z-[60] max-h-72 min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-2xl border border-border bg-card p-1.5 shadow-lift">
          <S.Viewport>
            {allowEmpty && <Item value={EMPTY} label={placeholder} />}
            {options.map((o) => <Item key={o.value} value={String(o.value)} label={o.label} />)}
          </S.Viewport>
        </S.Content>
      </S.Portal>
    </S.Root>
  );
}
function Item({ value, label }) {
  return (
    <S.Item value={value} className="relative flex cursor-pointer items-center rounded-xl py-2 pr-8 pl-2.5 text-sm outline-none select-none data-[highlighted]:bg-muted data-[state=checked]:font-medium">
      <S.ItemText>{label}</S.ItemText>
      <S.ItemIndicator className="absolute right-2.5"><Check className="size-4 text-primary" /></S.ItemIndicator>
    </S.Item>
  );
}

/* ----------------------------------------------------------------- switch */
export function Switch({ checked, onChange, id, disabled, size = 'md' }) {
  const s = size === 'sm' ? { root: 'h-5 w-9', thumb: 'size-4 data-[state=checked]:translate-x-4' } : { root: 'h-6 w-11', thumb: 'size-5 data-[state=checked]:translate-x-5' };
  return (
    <Sw.Root id={id} checked={!!checked} disabled={disabled} onCheckedChange={onChange} className={cn('relative inline-flex shrink-0 cursor-pointer items-center rounded-full bg-input p-0.5 transition-colors duration-300 data-[state=checked]:bg-primary disabled:cursor-not-allowed disabled:opacity-50', s.root)}>
      <Sw.Thumb className={cn('block rounded-full bg-white shadow-md transition-transform duration-300 ease-[cubic-bezier(.34,1.56,.64,1)]', s.thumb)} />
    </Sw.Root>
  );
}
/** Title + description on the left, switch on the right */
export function SwitchRow({ title, description, checked, onChange, id, disabled, className }) {
  return (
    <label htmlFor={id} className={cn('flex cursor-pointer items-center justify-between gap-4 rounded-2xl border border-border p-4 transition hover:bg-muted/50', className)}>
      <div className="min-w-0">
        <p className="text-sm font-medium">{title}</p>
        {description && <p className="mt-0.5 text-[13px] text-muted-foreground">{description}</p>}
      </div>
      <Switch id={id} checked={checked} onChange={onChange} disabled={disabled} />
    </label>
  );
}

export function Checkbox({ checked, onChange, id, label, className }) {
  return (
    <label htmlFor={id} className={cn('flex cursor-pointer items-center gap-2.5 text-sm', className)}>
      <Cb.Root id={id} checked={!!checked} onCheckedChange={(v) => onChange(!!v)} className="grid size-[18px] shrink-0 place-items-center rounded-md border border-input bg-card transition data-[state=checked]:border-primary data-[state=checked]:bg-primary">
        <Cb.Indicator><Check className="size-3.5 text-white" strokeWidth={3} /></Cb.Indicator>
      </Cb.Root>
      {label}
    </label>
  );
}

/* ---------------------------------------------------- segmented control */
export function Segmented({ value, onChange, options, id = 'seg', className, size = 'md' }) {
  return (
    <div className={cn('inline-flex rounded-xl bg-muted p-1', className)}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button key={o.value} type="button" onClick={() => onChange(o.value)} className={cn('relative rounded-lg font-medium transition-colors cursor-pointer', size === 'sm' ? 'px-3 py-1 text-xs' : 'px-4 py-1.5 text-sm', active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground')}>
            {active && <motion.span layoutId={`seg-${id}`} className="absolute inset-0 rounded-lg bg-card shadow-soft" transition={{ type: 'spring', stiffness: 500, damping: 35 }} />}
            <span className="relative inline-flex items-center gap-1.5">{o.icon && <o.icon className="size-3.5" />}{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------- uploads */
export function ImageUpload({ value, onChange, label = 'Upload image', hint = 'PNG, JPG or WEBP up to 4 MB', round, accept = 'image/png,image/jpeg,image/webp,image/gif', className, aspect = 'aspect-square' }) {
  const [preview, setPreview] = useState(null);
  const [drag, setDrag] = useState(false);
  useEffect(() => {
    if (value instanceof File) {
      if (!value.type.startsWith('image/')) { setPreview(null); return undefined; }
      const u = URL.createObjectURL(value); setPreview(u); return () => URL.revokeObjectURL(u);
    }
    setPreview(value || null); return undefined;
  }, [value]);
  const pick = (f) => f && onChange(f);
  return (
    <label
      onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
      onDrop={(e) => { e.preventDefault(); setDrag(false); pick(e.dataTransfer.files[0]); }}
      className={cn('group relative flex cursor-pointer items-center gap-4 rounded-2xl border-2 border-dashed p-3 transition', drag ? 'border-primary bg-primary-soft' : 'border-border hover:border-primary/50 hover:bg-muted/40', className)}
    >
      <input type="file" accept={accept} className="sr-only" onChange={(e) => pick(e.target.files[0])} />
      <span className={cn('relative grid size-16 shrink-0 place-items-center overflow-hidden bg-muted', round ? 'rounded-full' : 'rounded-xl', aspect)}>
        {preview ? <img src={preview} alt="" className="size-full object-cover" /> : value instanceof File ? <UploadCloud className="size-6 text-primary" /> : <ImagePlus className="size-6 text-muted-foreground transition group-hover:scale-110 group-hover:text-primary" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{value instanceof File ? value.name : preview ? 'Change image' : label}</span>
        <span className="block text-xs text-muted-foreground">{drag ? 'Drop it here' : hint}</span>
      </span>
      {value instanceof File && (
        <button type="button" onClick={(e) => { e.preventDefault(); onChange(null); }} className="grid size-7 place-items-center rounded-lg text-muted-foreground hover:bg-muted"><X className="size-4" /></button>
      )}
    </label>
  );
}

export function ColorInput({ value, onChange, label }) {
  return (
    <div>
      {label && <p className="mb-1.5 text-[13px] font-medium">{label}</p>}
      <div className="flex h-10 items-center gap-2 rounded-xl border border-input bg-card pr-3 pl-1.5 focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/15">
        <input type="color" value={/^#[0-9a-f]{6}$/i.test(value || '') ? value : '#000000'} onChange={(e) => onChange(e.target.value)} className="size-7 shrink-0 cursor-pointer rounded-lg bg-transparent" />
        <input value={value || ''} maxLength={7} onChange={(e) => onChange(e.target.value)} className="w-full bg-transparent text-sm uppercase outline-none" />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ form hook */
export function useForm(initial) {
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState({});
  const set = (name, v) => { setValues((x) => ({ ...x, [name]: v })); setErrors((e) => ({ ...e, [name]: undefined })); };
  /** props for <Input>/<Textarea> */
  const input = (name) => ({ id: `f-${name}`, name, value: values[name] ?? '', onChange: (e) => set(name, e.target.value), 'aria-invalid': !!errors[name] || undefined });
  return { values, setValues, errors, setErrors, set, input };
}
