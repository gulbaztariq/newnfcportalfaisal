import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Palette, Type, LayoutTemplate, Image as ImageIcon, MousePointerClick, Sparkles, RotateCcw, Undo2, Redo2, X, AlertTriangle, Smartphone, Monitor, RefreshCw, Lock } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Card, CardBody, Button, Field, Select, Segmented, SwitchRow, ColorInput, ImageUpload, Tip } from '@/components/ui';

/* ------------------------------------------------------------------ helpers */
const HEX = /^#[0-9a-f]{6}$/i;
const lum = (c) => { const h = c.slice(1); const [r, g, b] = [0, 2, 4].map((i) => { const x = parseInt(h.slice(i, i + 2), 16) / 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
/** WCAG contrast ratio of two #rrggbb colours, or null when either is missing */
export const contrast = (a, b) => { if (!HEX.test(a || '') || !HEX.test(b || '')) return null; const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
const SERIF = ['Playfair Display', 'Lora', 'Cormorant Garamond', 'Fraunces', 'Bitter', 'Bodoni Moda', 'EB Garamond', 'Libre Baskerville', 'Amiri'];
const MONO = ['JetBrains Mono', 'IBM Plex Mono'];
const stack = (f) => `'${f}', ${MONO.includes(f) ? 'ui-monospace, monospace' : SERIF.includes(f) ? 'Georgia, serif' : 'system-ui, sans-serif'}`;
const famOf = (s) => String(s || '').split(',')[0].replace(/['"]/g, '').trim();
const b64url = (s) => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const ANIM_KEYS = ['anim', 'anim_speed', 'anim_intensity', 'reveal', 'bg_type'];

/** the design part of a card: what the preview shows before saving and what undo / redo steps through */
export const designOf = (v) => ({ template_id: v.template_id, theme: v.theme || {}, sections: v.sections || {}, section_order: v.section_order || [], section_titles: v.section_titles || {} });
/** theme as sent to the server: every option present, '' meaning "use the template default" */
export const themePayload = (theme, keys) => Object.fromEntries((keys || Object.keys(theme || {})).map((k) => [k, theme?.[k] ?? '']));

// primary, secondary, background, text
const PALETTES = [
  ['Midnight gold', '#d4af37', '#f4e3a8', '#08080a', '#f4efe2'], ['Royal navy', '#12284f', '#c9a24b', '#ffffff', '#101b33'], ['Ivory & ink', '#111827', '#6b7280', '#fbfaf7', '#111827'],
  ['Emerald', '#0f766e', '#14b8a6', '#f8fbfa', '#102a27'], ['Violet dusk', '#7c3aed', '#f472b6', '#ffffff', '#1c1530'], ['Sunset', '#ea580c', '#db2777', '#fff8f3', '#2a1410'],
  ['Ocean', '#0369a1', '#06b6d4', '#f2f9fc', '#0c2a3f'], ['Neon night', '#22d3ee', '#f0abfc', '#05060d', '#eaf6ff'], ['Rose quartz', '#be185d', '#f9a8d4', '#fff5f8', '#4a1030'],
  ['Forest', '#166534', '#a3a35b', '#f6f8f3', '#142514'], ['Graphite', '#9ca3af', '#d4af37', '#0c0c0e', '#ececf0'], ['Sand', '#8a6f5a', '#c9a27e', '#faf7f2', '#2b2520'],
];
const MORE_COLORS = [['heading', 'Headings'], ['accent', 'Accent'], ['button', 'Buttons'], ['button_text', 'Button text'], ['icon', 'Icons'], ['surface', 'Card surface'], ['border', 'Borders']];
const opt = (pairs, first = 'Template default') => [{ value: '', label: first }, ...pairs.map(([value, label]) => ({ value, label }))];
const BG_TYPES = [['', 'Template'], ['solid', 'Solid'], ['linear', 'Gradient'], ['radial', 'Radial'], ['mesh', 'Soft mesh'], ['dots', 'Dots'], ['grid', 'Grid'], ['lines', 'Lines'], ['animated', 'Moving'], ['image', 'Image']];
const PANELS = [['colors', Palette, 'Colours'], ['type', Type, 'Typography'], ['layout', LayoutTemplate, 'Layout'], ['background', ImageIcon, 'Background'], ['buttons', MousePointerClick, 'Buttons & icons'], ['motion', Sparkles, 'Animation']];

/* ------------------------------------------------------------------ small controls */
function Choice({ label, value, onChange, options, hint, disabled }) {
  return (
    <div className={cn(disabled && 'pointer-events-none opacity-50')}>
      <p className="mb-1.5 text-[13px] font-medium">{label}</p>
      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={label}>
        {options.map((o) => (
          <button key={o.value || 'default'} type="button" role="radio" aria-checked={(value || '') === o.value} onClick={() => onChange(o.value)}
            className={cn('cursor-pointer rounded-full border px-3 py-1.5 text-xs font-medium transition', (value || '') === o.value ? 'border-primary bg-primary-soft text-primary' : 'border-border text-muted-foreground hover:border-primary/40 hover:text-foreground')}>{o.label}</button>
        ))}
      </div>
      {hint && <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
function Slider({ label, value, onChange, min, max, step, fallback, format = (x) => x }) {
  const set = value !== undefined && value !== '' && value !== null;
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between text-[13px]"><span className="font-medium">{label}</span>
        <span className="flex items-center gap-1.5 text-muted-foreground">{set ? format(value) : 'Default'}{set && <button type="button" onClick={() => onChange('')} className="grid size-5 cursor-pointer place-items-center rounded-md hover:bg-muted" aria-label={`Reset ${label}`}><X className="size-3" /></button>}</span></div>
      <input type="range" min={min} max={max} step={step} value={set ? value : fallback} onChange={(e) => onChange(Number(e.target.value))} aria-label={label} className="h-2 w-full cursor-pointer appearance-none rounded-full bg-muted accent-[var(--primary)]" />
    </div>
  );
}
function OptColor({ label, value, onChange }) {
  return (
    <div className="relative">
      <ColorInput label={label} value={value} onChange={(x) => onChange(HEX.test(x) ? x : x === '' ? '' : x)} />
      {value ? <button type="button" onClick={() => onChange('')} className="absolute top-0 right-0 flex cursor-pointer items-center gap-1 text-xs text-muted-foreground hover:text-foreground" aria-label={`Clear ${label}`}><X className="size-3" />Clear</button>
        : <span className="pointer-events-none absolute right-3 bottom-2.5 text-xs text-muted-foreground">Auto</span>}
    </div>
  );
}

/* ------------------------------------------------------------------ studio */
/**
 * Grouped design controls for one card. Everything edits `form.values.theme`; an empty value means "template default".
 * `history` (from useDesignHistory) supplies undo / redo; the live preview sits next to it in the editor.
 */
export default function DesignStudio({ v, form, template, schema, history, bgFile, onBgFile }) {
  const [panel, setPanel] = useState('colors');
  const th = v.theme || {};
  // always build on the latest theme, so quick successive changes never overwrite each other
  const patch = (fn) => form.setValues((x) => ({ ...x, theme: fn({ ...(x.theme || {}) }) }));
  const set = (k, val) => patch((n) => { if (val === '' || val === undefined || val === null || val === false) delete n[k]; else n[k] = val; return n; });
  const defaults = template?.defaults || {};
  const eff = (k) => th[k] ?? defaults[k];
  const fonts = (schema?.fonts || []).map((f) => ({ value: stack(f), label: f }));
  const font = (k) => { const f = famOf(th[k]); return f ? stack(f) : ''; };
  const cText = contrast(eff('text'), eff('background'));
  const cBtn = contrast(th.button_text, th.button || eff('primary'));
  const fixed = !!template?.avatar_fixed;

  return (
    <Card>
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
        <p className="mr-auto flex items-center gap-2 font-display font-semibold"><Palette className="size-4 text-primary" />Design studio</p>
        <Tip content="Undo"><Button size="icon-sm" variant="ghost" onClick={history.undo} disabled={!history.canUndo} aria-label="Undo"><Undo2 /></Button></Tip>
        <Tip content="Redo"><Button size="icon-sm" variant="ghost" onClick={history.redo} disabled={!history.canRedo} aria-label="Redo"><Redo2 /></Button></Tip>
        <Button size="sm" variant="ghost" onClick={() => form.set('theme', { ...defaults })}><RotateCcw />Reset to template</Button>
      </div>
      <div className="flex gap-1 overflow-x-auto border-b border-border px-3 py-2" role="tablist" aria-label="Design options">
        {PANELS.map(([k, I, l]) => (
          <button key={k} type="button" role="tab" aria-selected={panel === k} onClick={() => setPanel(k)} className={cn('relative flex shrink-0 cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-[13px] font-medium transition', panel === k ? 'text-primary' : 'text-muted-foreground hover:text-foreground')}>
            {panel === k && <motion.span layoutId="studio-tab" className="absolute inset-0 rounded-xl bg-primary-soft" transition={{ type: 'spring', stiffness: 400, damping: 32 }} />}
            <I className="relative size-4" /><span className="relative">{l}</span>
          </button>
        ))}
      </div>
      <CardBody>
        <AnimatePresence mode="wait">
          <motion.div key={panel} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.18 }} className="space-y-5">
            {panel === 'colors' && (
              <>
                <div>
                  <p className="mb-2 text-[13px] font-medium">Suggested combinations</p>
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
                    {PALETTES.map(([name, p, s, bg, tx]) => {
                      const on = th.primary === p && th.background === bg;
                      return (
                        <button key={name} type="button" onClick={() => patch((n) => ({ ...n, primary: p, secondary: s, background: bg, text: tx }))} aria-pressed={on} title={name}
                          className={cn('cursor-pointer overflow-hidden rounded-xl border-2 text-left transition hover:scale-[1.03]', on ? 'border-primary' : 'border-border')}>
                          <span className="flex h-9" style={{ background: bg }}><span className="m-auto flex gap-1"><i className="size-4 rounded-full" style={{ background: p }} /><i className="size-4 rounded-full" style={{ background: s }} /><i className="size-4 rounded-full border border-black/10" style={{ background: tx }} /></span></span>
                          <span className="block truncate px-2 py-1 text-[11px] font-medium">{name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {[['primary', 'Primary'], ['secondary', 'Secondary'], ['background', 'Background'], ['text', 'Text']].map(([k, l]) => <ColorInput key={k} label={l} value={eff(k)} onChange={(x) => set(k, x)} />)}
                </div>
                {cText !== null && cText < 4.5 && <Warn>Text on this background has low contrast ({cText.toFixed(1)}:1). Aim for 4.5:1 or more so the card stays readable.</Warn>}
                <div>
                  <p className="mb-2 text-[13px] font-medium">Fine tuning <span className="font-normal text-muted-foreground">(optional, leave empty to follow the template)</span></p>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{MORE_COLORS.map(([k, l]) => <OptColor key={k} label={l} value={th[k]} onChange={(x) => set(k, x)} />)}</div>
                </div>
                {cBtn !== null && cBtn < 2.5 && <Warn>That button text is hard to read on the button colour, so the card will use black or white instead.</Warn>}
              </>
            )}

            {panel === 'type' && (
              <>
                <div className="grid gap-4 sm:grid-cols-3">
                  <Field label="Body font"><Select value={font('font')} onChange={(x) => set('font', x)} allowEmpty placeholder="Template default" options={fonts} /></Field>
                  <Field label="Heading font"><Select value={font('heading_font')} onChange={(x) => set('heading_font', x)} allowEmpty placeholder="Same as body" options={fonts} /></Field>
                  <Field label="Name font"><Select value={font('name_font')} onChange={(x) => set('name_font', x)} allowEmpty placeholder="Same as headings" options={fonts} /></Field>
                </div>
                <Choice label="Name and heading weight" value={th.weight ? String(th.weight) : ''} onChange={(x) => set('weight', x ? Number(x) : '')} options={opt([['400', 'Regular'], ['500', 'Medium'], ['600', 'Semibold'], ['700', 'Bold'], ['800', 'Extra bold']])} />
                <div className="grid gap-5 sm:grid-cols-3">
                  <Slider label="Size" value={th.scale} onChange={(x) => set('scale', x)} min={0.85} max={1.2} step={0.05} fallback={1} format={(x) => `${Math.round(x * 100)}%`} />
                  <Slider label="Letter spacing" value={th.tracking} onChange={(x) => set('tracking', x)} min={-0.04} max={0.12} step={0.01} fallback={0} format={(x) => `${x > 0 ? '+' : ''}${Number(x).toFixed(2)}`} />
                  <Slider label="Line height" value={th.leading} onChange={(x) => set('leading', x)} min={1.3} max={1.9} step={0.05} fallback={1.55} format={(x) => Number(x).toFixed(2)} />
                </div>
                <Choice label="Text alignment" value={th.align} onChange={(x) => set('align', x)} options={opt([['start', 'Left'], ['center', 'Centre']])} hint="Applies to the name block and section headings where the design allows it." />
              </>
            )}

            {panel === 'layout' && (
              <>
                {fixed && <p className="flex items-center gap-2 rounded-xl bg-muted px-3 py-2 text-xs text-muted-foreground"><Lock className="size-3.5" />In this template the photo is part of the design, so its shape and size are fixed.</p>}
                <div className="grid gap-5 sm:grid-cols-2">
                  <Choice label="Photo shape" disabled={fixed} value={th.avatar_shape} onChange={(x) => set('avatar_shape', x)} options={opt([['circle', 'Circle'], ['rounded', 'Rounded'], ['square', 'Square']])} />
                  <Choice label="Photo size" disabled={fixed} value={th.avatar_size} onChange={(x) => set('avatar_size', x)} options={opt([['s', 'Small'], ['m', 'Medium'], ['l', 'Large']])} />
                  <Choice label="Corners" value={th.radius} onChange={(x) => set('radius', x)} options={opt([['sharp', 'Sharp'], ['soft', 'Soft'], ['round', 'Round']])} />
                  <Choice label="Spacing" value={th.spacing} onChange={(x) => set('spacing', x)} options={opt([['compact', 'Compact'], ['cozy', 'Cosy'], ['airy', 'Airy']])} />
                  <Choice label="Card width" value={th.width} onChange={(x) => set('width', x)} options={opt([['narrow', 'Narrow'], ['wide', 'Wide']], 'Standard')} hint="Visible on tablets and computers." />
                  <Choice label="Shadows" value={th.shadow} onChange={(x) => set('shadow', x)} options={opt([['none', 'None'], ['soft', 'Soft'], ['strong', 'Strong']])} />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {[['hide_cover', 'Hide cover / banner', 'Classic templates only'], ['hide_actions', 'Hide quick action buttons', 'Call, e-mail, WhatsApp, directions'], ['hide_save', 'Hide the Save contact button', 'The bottom bar still offers it'], ['hide_meta', 'Hide company and location chips', ''], ['hide_role', 'Hide job title', '']].map(([k, t, d]) => (
                    <SwitchRow key={k} id={`st-${k}`} title={t} description={d} checked={!!th[k]} onChange={(x) => set(k, x)} />
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">Section order, visibility and headings are in the Sections card below.</p>
              </>
            )}

            {panel === 'background' && (
              <>
                <div>
                  <p className="mb-2 text-[13px] font-medium">Background style</p>
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                    {BG_TYPES.map(([k, l]) => {
                      const bg = eff('background') || '#ffffff'; const b2 = th.bg2 || eff('primary') || '#888888'; const ink = eff('text') || '#111111';
                      const sw = { '': bg, solid: bg, linear: `linear-gradient(${th.bg_angle ?? 160}deg, ${bg}, ${b2})`, radial: `radial-gradient(120% 80% at 50% 0%, ${b2}, ${bg} 70%)`, mesh: `radial-gradient(60% 50% at 0% 0%, ${b2}, transparent 70%), radial-gradient(60% 50% at 100% 100%, ${b2}, transparent 70%), ${bg}`,
                        dots: `radial-gradient(${ink}55 1px, transparent 1.4px) 0 0/9px 9px, ${bg}`, grid: `linear-gradient(${ink}22 1px, transparent 1px) 0 0/10px 10px, linear-gradient(90deg, ${ink}22 1px, transparent 1px) 0 0/10px 10px, ${bg}`, lines: `repeating-linear-gradient(135deg, ${ink}22 0 1px, transparent 1px 7px), ${bg}`, animated: `linear-gradient(120deg, ${bg}, ${b2}, ${bg})`, image: `linear-gradient(${bg}cc, ${bg}cc), ${b2}` }[k];
                      return (
                        <button key={k || 'tpl'} type="button" onClick={() => set('bg_type', k)} aria-pressed={(th.bg_type || '') === k} className={cn('cursor-pointer overflow-hidden rounded-xl border-2 text-left transition hover:scale-[1.03]', (th.bg_type || '') === k ? 'border-primary' : 'border-border')}>
                          <span className="block h-10" style={{ background: sw }} /><span className="block truncate px-2 py-1 text-[11px] font-medium">{l}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
                {th.bg_type && th.bg_type !== 'solid' && (
                  <div className="grid gap-5 sm:grid-cols-2">
                    <OptColor label="Second colour" value={th.bg2} onChange={(x) => set('bg2', x)} />
                    {['linear', 'dots', 'grid', 'lines', 'animated'].includes(th.bg_type) && <Slider label="Angle" value={th.bg_angle} onChange={(x) => set('bg_angle', x)} min={0} max={360} step={5} fallback={160} format={(x) => `${x}°`} />}
                  </div>
                )}
                {th.bg_type === 'image' && (
                  <Field label="Background image" hint="A soft overlay in your background colour keeps the text readable. The preview shows it after you save.">
                    <ImageUpload value={bgFile || th.bg_image} onChange={onBgFile} aspect="aspect-video" label="Upload a background" />
                  </Field>
                )}
                <p className="text-xs text-muted-foreground">Templates that paint their own backdrop (glass, aurora, neon) keep it unless you pick a style here.</p>
              </>
            )}

            {panel === 'buttons' && (
              <div className="grid gap-5 sm:grid-cols-2">
                <Choice label="Button style" value={th.btn_style} onChange={(x) => set('btn_style', x)} options={opt([['pill', 'Pill'], ['rounded', 'Rounded'], ['square', 'Square'], ['outline', 'Outline'], ['soft', 'Soft']])} />
                <Choice label="Quick actions layout" value={th.act_layout} onChange={(x) => set('act_layout', x)} options={opt([['row', 'One row'], ['grid', 'Grid']])} hint="Classic templates." />
                <Choice label="Social icon style" value={th.social_style} onChange={(x) => set('social_style', x)} options={opt([['filled', 'Filled'], ['outline', 'Outline'], ['plain', 'Plain'], ['brand', 'Brand colours']])} />
                <Choice label="Social icon shape" value={th.social_shape} onChange={(x) => set('social_shape', x)} options={opt([['round', 'Round'], ['square', 'Square']])} />
              </div>
            )}

            {panel === 'motion' && (
              <>
                <Choice label="Entrance animation" value={th.anim} onChange={(x) => set('anim', x)} options={opt([['fade', 'Fade'], ['slide', 'Slide up'], ['zoom', 'Zoom'], ['none', 'No animation']])} />
                <div className={cn('grid gap-5 sm:grid-cols-2', th.anim === 'none' && 'pointer-events-none opacity-50')}>
                  <Choice label="Speed" value={th.anim_speed} onChange={(x) => set('anim_speed', x)} options={opt([['slow', 'Slow'], ['fast', 'Fast']], 'Normal')} />
                  <Choice label="Intensity" value={th.anim_intensity} onChange={(x) => set('anim_intensity', x)} options={opt([['subtle', 'Subtle'], ['strong', 'Strong']], 'Normal')} />
                </div>
                <SwitchRow id="st-reveal" title="Reveal sections while scrolling" description="Sections glide in as the visitor scrolls down" checked={th.reveal !== 'off' && th.anim !== 'none'} disabled={th.anim === 'none'} onChange={(x) => set('reveal', x ? '' : 'off')} />
                <p className="text-xs text-muted-foreground">Visitors who switch on &quot;reduce motion&quot; on their phone never see animations, whatever you choose here.</p>
              </>
            )}
          </motion.div>
        </AnimatePresence>
      </CardBody>
    </Card>
  );
}
const Warn = ({ children }) => <p className="flex items-start gap-2 rounded-xl border border-warning/30 bg-warning-soft px-3 py-2 text-xs"><AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-warning" />{children}</p>;

/* ------------------------------------------------------------------ undo / redo */
/** Undo / redo over the design part of the form (template, theme, sections). Typing bursts are grouped into one step. */
export function useDesignHistory(values, apply, ready = true) {
  const stack = useRef({ past: [], future: [], last: null, skip: false });
  const [, bump] = useState(0);
  const snap = JSON.stringify(designOf(values || {}));
  useEffect(() => {
    const s = stack.current;
    if (!ready) { s.last = null; return undefined; }
    if (s.last === null) { s.last = snap; return undefined; }
    if (snap === s.last) return undefined;
    if (s.skip) { s.skip = false; s.last = snap; bump((n) => n + 1); return undefined; }
    const prev = s.last;
    const t = setTimeout(() => { s.past.push(prev); if (s.past.length > 60) s.past.shift(); s.future = []; s.last = snap; bump((n) => n + 1); }, 450);
    return () => clearTimeout(t);
  }, [snap, ready]);
  const move = (from, to) => { const s = stack.current; if (!s[from].length) return; s[to].push(snap); const d = s[from].pop(); s.skip = true; apply(JSON.parse(d)); };
  const s = stack.current;
  return { undo: () => move('past', 'future'), redo: () => move('future', 'past'), canUndo: s.past.length > 0, canRedo: s.future.length > 0, reset: () => { s.past = []; s.future = []; s.last = snap; bump((n) => n + 1); } };
}

/* ------------------------------------------------------------------ live preview */
/**
 * The owner's real card, rendered by the server with the unsaved design (GET /api/user/vcards/:id/preview?d=...).
 * Nothing is stored. Entrance motion is skipped while options change, and replayed when an animation option changes.
 */
export function LivePreview({ vcardId, design, keys, rev = 0, className, tall }) {
  const [device, setDevice] = useState('phone');
  const [src, setSrc] = useState('');
  const [busy, setBusy] = useState(true);
  const [tick, setTick] = useState(0);
  const lastAnim = useRef('');
  const json = useMemo(() => JSON.stringify({ ...design, theme: themePayload(design.theme, keys) }), [design, keys]);
  useEffect(() => {
    const anim = JSON.stringify(ANIM_KEYS.map((k) => design.theme?.[k] ?? ''));
    const t = setTimeout(() => {
      const still = lastAnim.current !== '' && anim === lastAnim.current;
      lastAnim.current = anim;
      setBusy(true);
      setSrc(`/api/user/vcards/${vcardId}/preview?d=${b64url(JSON.stringify({ ...JSON.parse(json), still }))}&r=${rev}-${tick}`);
    }, src ? 260 : 0);
    return () => clearTimeout(t);
  }, [json, vcardId, rev, tick]); // eslint-disable-line react-hooks/exhaustive-deps
  const phone = device === 'phone';
  return (
    <div className={className}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-medium"><span className={cn('size-2 rounded-full', busy ? 'animate-pulse bg-amber-400' : 'bg-emerald-500')} />Live preview</p>
        <div className="flex items-center gap-1">
          <Segmented id="pv-device" size="sm" value={device} onChange={setDevice} options={[{ value: 'phone', label: 'Phone', icon: Smartphone }, { value: 'desktop', label: 'Desktop', icon: Monitor }]} />
          <Tip content="Replay"><button type="button" onClick={() => { lastAnim.current = ''; setTick((n) => n + 1); }} className="grid size-8 cursor-pointer place-items-center rounded-lg text-muted-foreground hover:bg-muted" aria-label="Replay animations"><RefreshCw className="size-4" /></button></Tip>
        </div>
      </div>
      {phone ? (
        <div className="relative mx-auto w-fit rounded-[3rem] bg-zinc-900 p-3 shadow-[0_30px_80px_-30px_rgba(76,29,149,.55)] ring-1 ring-white/10">
          <div className="absolute top-5 left-1/2 z-10 h-6 w-24 -translate-x-1/2 rounded-full bg-zinc-900" />
          <div className={cn('relative w-[310px] overflow-hidden rounded-[2.4rem] bg-white', tall ? 'h-[min(640px,62vh)]' : 'h-[640px]')}>
            {src && <iframe src={src} title="Live preview" onLoad={() => setBusy(false)} className="absolute top-0 left-0 w-[400px] origin-top-left scale-[0.775] border-0" style={{ height: `${100 / 0.775}%` }} />}
          </div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl bg-zinc-900 p-2 shadow-lift ring-1 ring-white/10">
          <div className="mb-2 flex gap-1.5 px-1"><i className="size-2.5 rounded-full bg-red-400" /><i className="size-2.5 rounded-full bg-amber-400" /><i className="size-2.5 rounded-full bg-emerald-400" /></div>
          <div className="relative h-[520px] overflow-hidden rounded-xl bg-white">
            {src && <iframe src={src} title="Live preview" onLoad={() => setBusy(false)} className="absolute top-0 left-0 h-[200%] w-[200%] origin-top-left scale-50 border-0" />}
          </div>
        </div>
      )}
    </div>
  );
}
