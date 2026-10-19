import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence, Reorder, useDragControls } from 'motion/react';
import { ArrowLeft, ExternalLink, QrCode, Save, IdCard, Palette, Share2, Link2, Briefcase, Images, MessageSquareQuote, Clock, Settings2, Lock, Plus, Pencil, Trash2, ArrowUp, ArrowDown, RotateCcw, Smartphone, RefreshCw, Globe, MessageCircle, Music2, Send, Sparkles } from 'lucide-react';
import { Facebook, Instagram, Twitter, Linkedin, Youtube } from '@/components/BrandIcons';
import { Github, Dribbble } from '@/components/BrandIcons';
import api, { toFormData } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/cn';
import { PageHeader, Card, CardHeader, CardBody, Button, ButtonLink, Field, Input, Textarea, Select, Switch, SwitchRow, ImageUpload, ColorInput, Dialog, EmptyState, Skeleton, Badge, Tip, useForm, run, confirm } from '@/components/ui';
import { TemplatePicker } from './Vcards';
import AiButton from '@/components/AiButton';
import { MediaTab, PaymentLinksTab, LegalTab, QrTab, AppointmentsTab, ProductsTab, BlogTab, PagesTab, AdvancedExtras } from './EditorExtras';
import { GripVertical, Eye, EyeOff } from 'lucide-react';
import { Film, Package, CalendarClock, Newspaper, FileStack, Wallet as WalletIcon, QrCode as QrIcon, Scale, BarChart3 } from 'lucide-react';

const SOCIAL = [
  ['website', Globe, 'Website'], ['facebook', Facebook, 'Facebook'], ['instagram', Instagram, 'Instagram'], ['twitter', Twitter, 'X / Twitter'],
  ['linkedin', Linkedin, 'LinkedIn'], ['youtube', Youtube, 'YouTube'], ['whatsapp', MessageCircle, 'WhatsApp'], ['tiktok', Music2, 'TikTok'],
  ['github', 'GitHub'], ['telegram', Send, 'Telegram'], ['pinterest', Sparkles, 'Pinterest'], ['snapchat', Sparkles, 'Snapchat'],
  ['dribbble', 'Dribbble'], ['behance', Sparkles, 'Behance'], ['reddit', Sparkles, 'Reddit'], ['discord', MessageCircle, 'Discord'],
];
const DAYS = [['mon', 'Monday'], ['tue', 'Tuesday'], ['wed', 'Wednesday'], ['thu', 'Thursday'], ['fri', 'Friday'], ['sat', 'Saturday'], ['sun', 'Sunday']];
// every family the card renderer whitelists (server views/templates/render.js GOOGLE_FONTS)
const SANS = ['Inter', 'Poppins', 'Montserrat', 'Space Grotesk', 'Roboto', 'Open Sans', 'DM Sans', 'Outfit', 'Plus Jakarta Sans', 'Manrope', 'Sora', 'Syne', 'Quicksand', 'Urbanist', 'Rubik', 'Lexend', 'IBM Plex Sans', 'Figtree', 'Barlow', 'Unbounded', 'Chakra Petch', 'Libre Franklin', 'Nunito', 'Bricolage Grotesque', 'Archivo', 'Baloo 2'];
const SERIF = ['Playfair Display', 'Lora', 'Cormorant Garamond', 'Fraunces', 'Bitter', 'Bodoni Moda', 'EB Garamond', 'Libre Baskerville', 'Amiri'];
const MONO = ['JetBrains Mono', 'IBM Plex Mono'];
const FONTS = [...SANS.map((f) => `'${f}', system-ui, sans-serif`), ...SERIF.map((f) => `'${f}', Georgia, serif`), ...MONO.map((f) => `'${f}', ui-monospace, monospace`)];
const LINK_ICONS = [['ri-links-line', 'Link'], ['ri-book-open-line', 'Menu / catalogue'], ['ri-restaurant-2-line', 'Restaurant'], ['ri-shopping-bag-3-line', 'Shop'], ['ri-calendar-event-line', 'Booking'], ['ri-map-pin-2-line', 'Location'], ['ri-phone-line', 'Phone'], ['ri-mail-line', 'E-mail'], ['ri-file-text-line', 'Document'], ['ri-gift-line', 'Offer'], ['ri-star-line', 'Reviews'], ['ri-play-circle-line', 'Video'], ['ri-global-line', 'Website']].map(([value, label]) => ({ value, label }));
const RADII = [{ value: 'sharp', label: 'Sharp' }, { value: 'soft', label: 'Soft' }, { value: 'round', label: 'Round' }];
// [key, editor label, default heading on the card]; order = default order on the card
const SECTIONS = [['about', 'About', 'About'], ['contact', 'Contact details', 'Contact'], ['social', 'Social icons', 'Social'], ['links', 'Custom links', 'Links'], ['services', 'Services', 'Services'], ['products', 'Products', 'Products'], ['appointments', 'Appointments', 'Book an Appointment'], ['gallery', 'Gallery', 'Gallery'], ['testimonials', 'Testimonials', 'Testimonials'], ['payments', 'Payment links', 'Pay Me'], ['blog', 'Blog', 'Blog'], ['embeds', 'Embeds', 'Videos'], ['map', 'Map', 'Location'], ['hours', 'Business hours', 'Business Hours'], ['qr', 'QR code', 'QR Code'], ['enquiry', 'Enquiry form', 'Get in touch']];
const PALETTES = [['#6d5dfc', '#b44cf5'], ['#0ea5e9', '#22c55e'], ['#f43f5e', '#f59e0b'], ['#111827', '#d4af37'], ['#0f766e', '#84cc16'], ['#db2777', '#8b5cf6']];
const CODE_PLACEHOLDER = `<!doctype html>
<html>
<head><style>body{font-family:system-ui;text-align:center}</style></head>
<body>
  <img src="{{profile_image}}" width="120">
  <h1>{{name}}</h1>
  <p>{{occupation}} at {{company}}</p>
  <a href="{{vcf_url}}">Save contact</a>
</body>
</html>`;

const TABS = [
  ['basic', IdCard, 'Basic details'], ['design', Palette, 'Design'], ['media', Film, 'Media & embeds'], ['social', Share2, 'Social links'],
  ['links', Link2, 'Custom links'], ['services', Briefcase, 'Services'], ['products', Package, 'Products'], ['gallery', Images, 'Gallery'],
  ['testimonials', MessageSquareQuote, 'Testimonials'], ['appointments', CalendarClock, 'Appointments'], ['blog', Newspaper, 'Blog'],
  ['pages', FileStack, 'Custom pages'], ['payments', WalletIcon, 'Payment links'], ['hours', Clock, 'Business hours'], ['qr', QrIcon, 'QR code'],
  ['legal', Scale, 'Terms & privacy'], ['advanced', Settings2, 'Advanced & SEO'],
];

export default function VcardEditor() {
  const { id } = useParams();
  const { settings, user } = useAuth();
  const [data, setData] = useState(null);
  const [features, setFeatures] = useState({});
  const [templates, setTemplates] = useState([]);
  const [params] = useSearchParams();
  const [tab, setTab] = useState(() => (TABS.some((t) => t[0] === params.get('tab')) ? params.get('tab') : 'basic'));
  const [rev, setRev] = useState(0);
  const [saving, setSaving] = useState(false);
  const [snapshot, setSnapshot] = useState('');
  const form = useForm({});

  const load = async () => {
    const [{ data: d }, { data: t }] = await Promise.all([api.get(`/user/vcards/${id}`), api.get('/user/vcards/templates')]);
    const v = { ...d.data, password: '', theme: d.data.theme || {}, social_links: d.data.social_links || {}, custom_links: d.data.custom_links || [], business_hours: d.data.business_hours || {}, sections: d.data.sections || {}, section_order: d.data.section_order || [], section_titles: d.data.section_titles || {}, iframes: d.data.iframes || [], payment_links: d.data.payment_links || [], qr_settings: d.data.qr_settings || {}, appointment_settings: d.data.appointment_settings || {} };
    setData(d.data); setFeatures(d.features); setTemplates(t.data); form.setValues(v); setSnapshot(JSON.stringify(v));
  };
  useEffect(() => { load(); }, [id]); // eslint-disable-line
  const dirty = useMemo(() => snapshot && JSON.stringify(form.values) !== snapshot, [form.values, snapshot]);

  if (!data) return <div className="grid gap-6 xl:grid-cols-[220px_1fr_340px]"><Skeleton className="h-96 rounded-2xl" /><Skeleton className="h-[600px] rounded-2xl" /><Skeleton className="h-[640px] rounded-[3rem]" /></div>;
  const v = form.values;
  const link = `${settings.app_url}/${data.url_alias}`;
  const setIn = (key, k, val) => form.set(key, { ...v[key], [k]: val });
  const locked = (f) => !features[f];
  // fields locked by the user's organisation: read-only here (the server ignores changes to them as well)
  const orgLocks = new Set(user?.locked_fields || []);
  const lk = (k, node) => (orgLocks.has(k) ? <fieldset disabled className="contents">{node}</fieldset> : node);
  const ll = (text, k) => (orgLocks.has(k) ? <span className="inline-flex items-center gap-1.5">{text}<Lock className="size-3 text-warning" aria-label="Locked by your organisation" /></span> : text);

  const save = async () => {
    setSaving(true);
    const fields = ['name', 'url_alias', 'occupation', 'description', 'first_name', 'last_name', 'email', 'region_code', 'phone', 'alternative_email', 'alternative_phone', 'location', 'location_url', 'company', 'job_title', 'dob', 'default_language', 'template_id', 'theme', 'social_links', 'custom_links', 'business_hours', 'sections', 'section_order', 'section_titles', 'status', 'enable_enquiry_form', 'show_qr_code', 'hide_branding', 'custom_css', 'site_title', 'meta_keyword', 'meta_description', 'google_analytics', 'cover_type', 'youtube_link', 'instagram_embed', 'linkedin_embed', 'iframes', 'location_embed', 'payment_links', 'terms_conditions', 'privacy_policy', 'sticky_bar', 'newsletter_popup', 'ask_before_contact', 'enquiry_attachment', 'pwa_enable', 'business_directory', 'week_format', 'qr_settings', 'appointment_settings', 'custom_domain', 'custom_code', 'custom_code_enabled'];
    const payload = {};
    for (const f of fields) payload[f] = typeof v[f] === 'boolean' ? (v[f] ? '1' : '0') : v[f] ?? '';
    if (v.password || v.remove_password) payload.password = v.remove_password ? '' : v.password;
    for (const f of ['profile_image', 'cover_image']) if (v[f] instanceof File) payload[f] = v[f];
    try {
      const d = await run(api.put(`/user/vcards/${id}`, toFormData(payload)), 'Card saved');
      const nv = { ...v, ...d.data, password: '', remove_password: false };
      setData((x) => ({ ...x, ...d.data })); form.setValues(nv); setSnapshot(JSON.stringify(nv)); setRev((r) => r + 1);
    } catch (e) { form.setErrors(e.errors); } finally { setSaving(false); }
  };
  const Upgrade = ({ what }) => (
    <div className="flex items-center gap-4 rounded-2xl border border-warning/30 bg-warning-soft p-4">
      <Lock className="size-5 text-warning" /><p className="flex-1 text-sm"><b>{what}</b> isn&apos;t included in your plan.</p>
      <ButtonLink as={Link} to="/user/plans" size="sm">Upgrade</ButtonLink>
    </div>
  );

  return (
    <>
      <Link to="/user/vcards" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" />My vCards</Link>
      <PageHeader title={data.name} description={<a href={link} target="_blank" rel="noreferrer" className="text-primary hover:underline">{link.replace(/^https?:\/\//, '')}</a>}>
        <ButtonLink as={Link} to={`/user/vcards/${id}/analytics`} variant="outline"><BarChart3 />Analytics</ButtonLink>
        <ButtonLink href={`/api/user/vcards/${id}/qrcode`} variant="outline"><QrCode />QR code</ButtonLink>
        <ButtonLink href={link} target="_blank" rel="noreferrer" variant="outline"><ExternalLink />Open</ButtonLink>
        <Button onClick={save} loading={saving} disabled={!dirty && !saving}><Save />Save</Button>
      </PageHeader>

      {orgLocks.size > 0 && (
        <div className="mb-4 flex items-center gap-3 rounded-2xl border border-warning/30 bg-warning-soft p-4 text-sm">
          <Lock className="size-5 shrink-0 text-warning" />
          <p>Fields marked with <Lock className="inline size-3 text-warning" /> are managed by your organisation. Contact your organisation administrator to change them.</p>
        </div>
      )}
      <div className="grid gap-6 xl:grid-cols-[220px_1fr] 2xl:grid-cols-[220px_1fr_360px]">
        {/* section nav */}
        <Card className="h-fit min-w-0 p-2 xl:sticky xl:top-24">
          <div className="flex gap-1 overflow-x-auto xl:flex-col">
            {TABS.map(([k, I, l]) => (
              <button key={k} type="button" onClick={() => setTab(k)} className={cn('relative flex shrink-0 cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition', tab === k ? 'text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground')}>
                {tab === k && <motion.span layoutId="ed-tab" className="absolute inset-0 rounded-xl bg-primary-soft" transition={{ type: 'spring', stiffness: 400, damping: 32 }} />}
                <I className="relative size-4" /><span className="relative">{l}</span>
              </button>
            ))}
          </div>
        </Card>

        <AnimatePresence mode="wait">
          <motion.div key={tab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.22 }} className="min-w-0 space-y-6">
            {tab === 'basic' && (
              <>
                <Card>
                  <CardHeader icon={IdCard} title="Profile" description="Who you are and what you do" />
                  <CardBody className="grid gap-4 sm:grid-cols-2">
                    {lk('profile_image', <Field label={ll('Profile photo', 'profile_image')}><ImageUpload value={v.profile_image} onChange={(x) => form.set('profile_image', x)} round /></Field>)}
                    {lk('cover_image', <Field label={ll('Cover image', 'cover_image')} hint="Wide image, 1200x500"><ImageUpload value={v.cover_image} onChange={(x) => form.set('cover_image', x)} aspect="aspect-video" /></Field>)}
                    {lk('first_name', <Field label={ll('First name', 'first_name')}><Input {...form.input('first_name')} /></Field>)}
                    {lk('last_name', <Field label={ll('Last name', 'last_name')}><Input {...form.input('last_name')} /></Field>)}
                    {lk('occupation', <Field label={ll('Occupation', 'occupation')}><Input {...form.input('occupation')} /></Field>)}
                    {lk('job_title', <Field label={ll('Job title', 'job_title')}><Input {...form.input('job_title')} /></Field>)}
                    {lk('company', <Field label={ll('Company', 'company')} className="sm:col-span-2"><Input {...form.input('company')} /></Field>)}
                    {lk('description', <Field label={<span className="flex w-full items-center justify-between">{ll('About you', 'description')} <AiButton kind="vcard" title={`${v.first_name || ''} ${v.last_name || ''}, ${v.occupation || v.job_title || ''}`.trim()} details={[v.company, v.description].filter(Boolean).join('. ')} onResult={(t) => form.set('description', t)} /></span>} className="sm:col-span-2"><Textarea {...form.input('description')} rows={4} /></Field>)}
                  </CardBody>
                </Card>
                <Card>
                  <CardHeader title="Contact details" />
                  <CardBody className="grid gap-4 sm:grid-cols-2">
                    {lk('email', <Field label={ll('E-mail', 'email')} error={form.errors.email}><Input {...form.input('email')} type="email" /></Field>)}
                    {lk('phone', <Field label={ll('Phone', 'phone')}><div className="flex gap-2"><Input className="w-20" placeholder="+1" value={v.region_code || ''} onChange={(e) => form.set('region_code', e.target.value.replace(/\D/g, ''))} /><Input {...form.input('phone')} className="flex-1" /></div></Field>)}
                    {lk('alternative_email', <Field label={ll('Alternative e-mail', 'alternative_email')}><Input {...form.input('alternative_email')} type="email" /></Field>)}
                    {lk('alternative_phone', <Field label={ll('Alternative phone', 'alternative_phone')}><Input {...form.input('alternative_phone')} /></Field>)}
                    {lk('location', <Field label={ll('Location', 'location')}><Input {...form.input('location')} /></Field>)}
                    {lk('location_url', <Field label={ll('Google Maps link', 'location_url')} error={form.errors.location_url}><Input {...form.input('location_url')} type="url" placeholder="https://maps.google.com/..." /></Field>)}
                    <Field label="Birthday"><Input {...form.input('dob')} type="date" /></Field>
                  </CardBody>
                </Card>
                <Card>
                  <CardHeader title="Card settings" />
                  <CardBody className="grid gap-4 sm:grid-cols-2">
                    {lk('name', <Field label={ll('Card name', 'name')} required error={form.errors.name}><Input {...form.input('name')} /></Field>)}
                    {lk('url_alias', <Field label={ll('Card link', 'url_alias')} error={form.errors.url_alias} hint="Changing this changes the link on printed QR/NFC cards"><Input prefix="/" value={v.url_alias || ''} onChange={(e) => form.set('url_alias', e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, ''))} /></Field>)}
                    <SwitchRow className="sm:col-span-2" title="Published" description="Visitors can open this card" checked={v.status} onChange={(x) => form.set('status', x)} id="st" />
                  </CardBody>
                </Card>
              </>
            )}

            {tab === 'design' && (
              <>
                {lk('theme', <Card>
                  <CardHeader icon={Palette} title={ll('Colours & font', 'theme')} actions={<Button size="sm" variant="ghost" onClick={() => form.set('theme', templates.find((t) => t.id === v.template_id)?.defaults || {})}><RotateCcw />Reset</Button>} />
                  <CardBody className="space-y-5">
                    <div>
                      <p className="mb-2 text-[13px] font-medium">Quick palettes</p>
                      <div className="flex flex-wrap gap-2">
                        {PALETTES.map(([a, b]) => (
                          <button key={a} type="button" onClick={() => form.set('theme', { ...v.theme, primary: a, secondary: b })} className={cn('size-10 cursor-pointer rounded-full ring-offset-2 ring-offset-card transition hover:scale-110', v.theme.primary === a && 'ring-2 ring-primary')} style={{ background: `linear-gradient(135deg, ${a}, ${b})` }} aria-label="Palette" />
                        ))}
                      </div>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                      {[['primary', 'Primary'], ['secondary', 'Secondary'], ['background', 'Background'], ['text', 'Text']].map(([k, l]) => <ColorInput key={k} label={l} value={v.theme[k]} onChange={(x) => setIn('theme', k, x)} />)}
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field label="Font"><Select value={v.theme.font} onChange={(x) => setIn('theme', 'font', x)} allowEmpty placeholder="Template default" options={FONTS.map((f) => ({ value: f, label: f.split(',')[0].replace(/'/g, '') }))} /></Field>
                      <Field label="Corners"><Select value={v.theme.radius} onChange={(x) => setIn('theme', 'radius', x)} allowEmpty placeholder="Template default" options={RADII} /></Field>
                    </div>
                  </CardBody>
                </Card>)}
                <Card>
                  <CardHeader title="Sections" description="Drag to reorder, rename the headings, and show or hide each part of your card"
                    actions={<Button size="sm" variant="ghost" onClick={() => { form.set('section_order', []); form.set('section_titles', {}); }}><RotateCcw />Reset</Button>} />
                  <CardBody><SectionsEditor v={v} form={form} /></CardBody>
                </Card>
                {lk('template_id', <Card>
                  <CardHeader title={ll('Template', 'template_id')} description="Your content stays when you switch" />
                  <CardBody><TemplatePicker templates={templates} value={v.template_id} onChange={(tid) => form.set('template_id', tid)} /></CardBody>
                </Card>)}
              </>
            )}

            {tab === 'social' && lk('social_links',
              <Card>
                <CardHeader icon={Share2} title={ll('Social links', 'social_links')} description="Only filled-in networks appear on your card" />
                <CardBody>
                  {locked('social_links') ? <Upgrade what="Social links" /> : (
                    <div className="grid gap-3 sm:grid-cols-2">
                      {SOCIAL.map(([k, I, l]) => (
                        <div key={k} className={cn('flex items-center gap-3 rounded-2xl border p-2 pl-3 transition focus-within:border-primary', v.social_links[k] ? 'border-primary/30 bg-primary-soft/40' : 'border-border')}>
                          <span className={cn('grid size-9 shrink-0 place-items-center rounded-xl', v.social_links[k] ? 'bg-primary text-white' : 'bg-muted text-muted-foreground')}><I className="size-4" /></span>
                          <div className="min-w-0 flex-1"><p className="text-xs text-muted-foreground">{l}</p><input value={v.social_links[k] || ''} onChange={(e) => setIn('social_links', k, e.target.value)} placeholder="https://" className="w-full bg-transparent text-sm outline-none" /></div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardBody>
              </Card>,
            )}

            {tab === 'links' && lk('custom_links',
              <Card>
                <CardHeader icon={Link2} title={ll('Custom links', 'custom_links')} description="Big buttons, e.g. Portfolio, Book a meeting, Menu"
                  actions={!locked('custom_links') && <Button size="sm" onClick={() => form.set('custom_links', [...v.custom_links, { label: '', url: '', desc: '', badge: '', icon: '', featured: false }])}><Plus />Add link</Button>} />
                <CardBody>
                  {locked('custom_links') ? <Upgrade what="Custom links" /> : !v.custom_links.length ? <EmptyState icon={Link2} title="No links yet" /> : (
                    <div className="space-y-3">
                      <AnimatePresence initial={false}>
                        {v.custom_links.map((l, i) => {
                          const upd = (patch) => form.set('custom_links', v.custom_links.map((x, j) => (j === i ? { ...x, ...patch } : x)));
                          const move = (d) => { const a = [...v.custom_links]; const j = i + d; if (j < 0 || j >= a.length) return; [a[i], a[j]] = [a[j], a[i]]; form.set('custom_links', a); };
                          return (
                            <motion.div key={i} layout initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="flex flex-wrap items-center gap-2 rounded-2xl border border-border p-3">
                              <Input className="min-w-40 flex-1" placeholder="Button text" value={l.label} onChange={(e) => upd({ label: e.target.value })} />
                              <Input className="min-w-56 flex-[2]" placeholder="https://" value={l.url} onChange={(e) => upd({ url: e.target.value })} />
                              <div className="flex w-full flex-wrap items-center gap-2">
                                <Input className="min-w-48 flex-[2]" placeholder="Description (shown under the title on card designs)" maxLength={90} value={l.desc || ''} onChange={(e) => upd({ desc: e.target.value })} />
                                <Input className="w-28" placeholder="Badge" maxLength={20} value={l.badge || ''} onChange={(e) => upd({ badge: e.target.value })} />
                                <Select className="w-40" value={l.icon} onChange={(x) => upd({ icon: x })} allowEmpty placeholder="Icon: auto" options={LINK_ICONS} />
                                <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground"><Switch size="sm" checked={!!l.featured} onChange={(x) => upd({ featured: x })} />Highlight</label>
                              </div>
                              <div className="flex gap-1">
                                <Button variant="ghost" size="icon-sm" onClick={() => move(-1)} aria-label="Up"><ArrowUp /></Button>
                                <Button variant="ghost" size="icon-sm" onClick={() => move(1)} aria-label="Down"><ArrowDown /></Button>
                                <Button variant="danger-soft" size="icon-sm" onClick={() => form.set('custom_links', v.custom_links.filter((_, j) => j !== i))} aria-label="Remove"><Trash2 /></Button>
                              </div>
                            </motion.div>
                          );
                        })}
                      </AnimatePresence>
                    </div>
                  )}
                </CardBody>
              </Card>,
            )}

            {tab === 'services' && (locked('products_services') ? <Upgrade what="Services" /> : (
              <SubItems vcardId={id} kind="services" title="Services" icon={Briefcase} items={data.services} onChange={(services) => { setData({ ...data, services }); setRev((r) => r + 1); }}
                fields={[['name', 'Service name', 'text', true], ['description', 'Description', 'textarea'], ['service_url', 'Link (optional)', 'url']]} />
            ))}
            {tab === 'testimonials' && (locked('testimonials') ? <Upgrade what="Testimonials" /> : (
              <SubItems vcardId={id} kind="testimonials" title="Testimonials" icon={MessageSquareQuote} items={data.testimonials} onChange={(testimonials) => { setData({ ...data, testimonials }); setRev((r) => r + 1); }}
                fields={[['name', 'Name', 'text', true], ['description', 'Testimonial', 'textarea', true]]} />
            ))}
            {tab === 'gallery' && (locked('gallery') ? <Upgrade what="Gallery" /> : (
              <SubItems vcardId={id} kind="gallery" title="Gallery" icon={Images} items={data.gallery} onChange={(gallery) => { setData({ ...data, gallery }); setRev((r) => r + 1); }} fields={[['caption', 'Caption', 'text'], ['category', 'Category (optional, creates filter tabs)', 'text'], ['video_url', 'YouTube link (instead of an image)', 'url']]} />
            ))}

            {tab === 'hours' && (
              <Card>
                <CardHeader icon={Clock} title="Business hours" actions={<Button size="sm" variant="outline" onClick={() => form.set('business_hours', Object.fromEntries(DAYS.map(([d], i) => [d, { open: i < 5, from: '09:00', to: '17:00' }])))}>Mon-Fri 9-5</Button>} />
                <CardBody className="space-y-2">
                  {DAYS.map(([d, l]) => {
                    const h = v.business_hours[d] || { open: false, from: '09:00', to: '17:00' };
                    const upd = (p) => setIn('business_hours', d, { ...h, ...p });
                    return (
                      <div key={d} className={cn('flex flex-wrap items-center gap-3 rounded-2xl border p-3 transition', h.open ? 'border-border' : 'border-dashed border-border opacity-70')}>
                        <Switch checked={!!h.open} onChange={(x) => upd({ open: x })} />
                        <span className="w-28 text-sm font-medium">{l}</span>
                        {h.open ? (
                          <div className="flex items-center gap-2"><Input type="time" className="w-32" value={h.from} onChange={(e) => upd({ from: e.target.value })} /><span className="text-muted-foreground">to</span><Input type="time" className="w-32" value={h.to} onChange={(e) => upd({ to: e.target.value })} /></div>
                        ) : <Badge>Closed</Badge>}
                      </div>
                    );
                  })}
                </CardBody>
              </Card>
            )}

            {tab === 'media' && <MediaTab v={v} form={form} locked={locked} Upgrade={Upgrade} vcardId={id} onVideo={(nd) => { setData((x) => ({ ...x, ...nd })); form.set('cover_video', nd.cover_video); form.set('cover_type', 'video'); setRev((r) => r + 1); }} />}
            {tab === 'products' && <ProductsTab vcardId={id} locked={locked} Upgrade={Upgrade} onChanged={() => setRev((r) => r + 1)} />}
            {tab === 'appointments' && <AppointmentsTab v={v} form={form} locked={locked} Upgrade={Upgrade} />}
            {tab === 'blog' && <BlogTab vcardId={id} alias={data.url_alias} locked={locked} Upgrade={Upgrade} onChanged={() => setRev((r) => r + 1)} />}
            {tab === 'pages' && <PagesTab vcardId={id} alias={data.url_alias} locked={locked} Upgrade={Upgrade} onChanged={() => setRev((r) => r + 1)} />}
            {tab === 'payments' && <PaymentLinksTab v={v} form={form} locked={locked} Upgrade={Upgrade} />}
            {tab === 'qr' && <QrTab v={v} form={form} locked={locked} vcardId={id} alias={data.url_alias} rev={rev} />}
            {tab === 'legal' && <LegalTab v={v} form={form} />}
            {tab === 'advanced' && <AdvancedExtras v={v} form={form} locked={locked} data={data} />}
            {tab === 'advanced' && (
              <>
                <Card>
                  <CardHeader icon={Settings2} title="Options" />
                  <CardBody className="space-y-3">
                    <SwitchRow id="eq" title="Enquiry form" description="Let visitors send you a message" checked={v.enable_enquiry_form} onChange={(x) => form.set('enable_enquiry_form', x)} />
                    <SwitchRow id="qr" title="Show QR code" description="Display a downloadable QR code on the card" checked={v.show_qr_code} onChange={(x) => form.set('show_qr_code', x)} />
                    {!locked('hide_branding') && <SwitchRow id="hb" title="Hide branding" description={`Remove "Made with ${settings.app_name}"`} checked={v.hide_branding} onChange={(x) => form.set('hide_branding', x)} />}
                  </CardBody>
                </Card>
                <Card>
                  <CardHeader icon={Lock} title="Password protection" description="Visitors must enter a password to open the card" />
                  <CardBody>
                    {locked('password') ? <Upgrade what="Password protection" /> : (
                      <div className="space-y-3">
                        {data.has_password && <Badge tone="success" dot>This card is protected</Badge>}
                        <Field label={data.has_password ? 'New password' : 'Password'}><Input {...form.input('password')} type="password" autoComplete="new-password" /></Field>
                        {data.has_password && <SwitchRow id="rmpw" title="Remove password" checked={!!v.remove_password} onChange={(x) => form.set('remove_password', x)} />}
                      </div>
                    )}
                  </CardBody>
                </Card>
                <Card>
                  <CardHeader title="SEO" description="How your card appears in search and when shared" />
                  <CardBody>
                    {locked('seo') ? <Upgrade what="SEO" /> : (
                      <div className="grid gap-4">
                        <Field label="Page title"><Input {...form.input('site_title')} /></Field>
                        <Field label="Keywords"><Input {...form.input('meta_keyword')} /></Field>
                        <Field label="Description"><Textarea {...form.input('meta_description')} rows={2} /></Field>
                        <Field label="Google Analytics ID" error={form.errors.google_analytics}><Input {...form.input('google_analytics')} placeholder="G-XXXXXXX" /></Field>
                      </div>
                    )}
                  </CardBody>
                </Card>
                <Card>
                  <CardHeader title="Custom CSS" />
                  <CardBody>{locked('custom_css') ? <Upgrade what="Custom CSS" /> : <Textarea {...form.input('custom_css')} rows={6} className="font-mono text-xs" placeholder=".name { letter-spacing: 1px; }" />}</CardBody>
                </Card>
                <Card>
                  <CardHeader title="Your own design (HTML, CSS & JavaScript)" description="Replace the template with a page you coded yourself. It runs in a secure sandbox on your card link." />
                  <CardBody className="space-y-4">
                    {locked('custom_code') ? <Upgrade what="Custom code designs" /> : (
                      <>
                        <SwitchRow title="Use my own design instead of the template" description="Visitors see your code; switch off to go back to the template" checked={!!v.custom_code_enabled} onChange={(x) => form.set('custom_code_enabled', x)} />
                        <Textarea {...form.input('custom_code')} rows={16} spellCheck={false} className="font-mono text-xs leading-relaxed" placeholder={CODE_PLACEHOLDER} />
                        <p className="text-xs text-muted-foreground">Placeholders: {'{{name}} {{first_name}} {{last_name}} {{occupation}} {{company}} {{email}} {{phone}} {{location}} {{description}} {{profile_image}} {{cover_image}} {{vcf_url}} {{card_url}}'}. Any browser code works (HTML, CSS, JavaScript, CDN libraries). Server languages like PHP or Python cannot run here - paste their HTML output instead. Your code cannot read visitor or account data of this site.</p>
                      </>
                    )}
                  </CardBody>
                </Card>
              </>
            )}
          </motion.div>
        </AnimatePresence>

        {/* live preview */}
        <div className="hidden 2xl:block">
          <div className="sticky top-24">
            <div className="mb-3 flex items-center justify-between"><p className="flex items-center gap-2 text-sm font-medium"><Smartphone className="size-4" />Live preview</p><Tip content="Reload"><button type="button" onClick={() => setRev((r) => r + 1)} className="grid size-8 cursor-pointer place-items-center rounded-lg text-muted-foreground hover:bg-muted"><RefreshCw className="size-4" /></button></Tip></div>
            <div className="relative mx-auto w-fit rounded-[3rem] bg-zinc-900 p-3 shadow-[0_30px_80px_-30px_rgba(76,29,149,.55)] ring-1 ring-white/10">
              <div className="absolute top-5 left-1/2 z-10 h-6 w-24 -translate-x-1/2 rounded-full bg-zinc-900" />
              <div className="relative h-[640px] w-[310px] overflow-hidden rounded-[2.4rem] bg-white">
                <iframe key={rev} src={link} title="Preview" className="absolute top-0 left-0 h-[826px] w-[400px] origin-top-left scale-[0.775] border-0" />
              </div>
            </div>
            {dirty && <p className="mt-3 text-center text-xs text-muted-foreground">Save to see your changes here</p>}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {dirty && (
          <motion.div initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 80, opacity: 0 }} transition={{ type: 'spring', stiffness: 300, damping: 28 }}
            className="fixed inset-x-0 bottom-5 z-40 mx-auto flex w-[calc(100%-2rem)] max-w-md items-center justify-between gap-3 rounded-2xl bg-zinc-900 p-2 pl-5 text-white shadow-2xl dark:bg-white dark:text-zinc-900">
            <span className="flex items-center gap-2 text-sm font-medium"><span className="size-2 animate-pulse rounded-full bg-amber-400" />Unsaved changes</span>
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" className="text-inherit hover:bg-white/10" onClick={() => form.setValues(JSON.parse(snapshot))}>Discard</Button>
              <Button size="sm" onClick={save} loading={saving}><Save />Save</Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

/** Services / testimonials / gallery with dialog form */
/** Drag-and-drop list of card sections: order (section_order), heading (section_titles) and visibility (sections) */
function SectionsEditor({ v, form }) {
  const keys = SECTIONS.map(([k]) => k);
  const order = [...new Set([...(v.section_order || []).filter((k) => keys.includes(k)), ...keys])];
  const setOrder = (o) => form.set('section_order', o);
  const move = (i, d) => { const o = [...order]; const j = i + d; if (j < 0 || j >= o.length) return; [o[i], o[j]] = [o[j], o[i]]; setOrder(o); };
  return (
    <Reorder.Group axis="y" values={order} onReorder={setOrder} className="space-y-2">
      {order.map((k, i) => <SectionRow key={k} k={k} i={i} last={i === order.length - 1} v={v} form={form} move={move} />)}
    </Reorder.Group>
  );
}
function SectionRow({ k, i, last, v, form, move }) {
  const controls = useDragControls();
  const [, label, heading] = SECTIONS.find(([x]) => x === k);
  const on = v.sections[k] !== false;
  return (
    <Reorder.Item value={k} dragListener={false} dragControls={controls} className={cn('flex items-center gap-2 rounded-2xl border border-border bg-card p-2 pr-3 shadow-xs', !on && 'opacity-60')}
      whileDrag={{ scale: 1.02, boxShadow: '0 18px 40px -18px rgba(0,0,0,.35)' }}>
      <button type="button" onPointerDown={(e) => { e.preventDefault(); controls.start(e); }} className="grid size-9 shrink-0 cursor-grab touch-none place-items-center rounded-xl text-muted-foreground hover:bg-muted active:cursor-grabbing" aria-label={`Drag ${label}`}><GripVertical className="size-4" /></button>
      <div className="min-w-0 flex-1">
        <p className="mb-1 text-xs font-medium text-muted-foreground">{label}</p>
        <Input value={v.section_titles?.[k] || ''} placeholder={heading} maxLength={60} className="h-9" onChange={(e) => form.set('section_titles', { ...v.section_titles, [k]: e.target.value })} aria-label={`${label} heading`} />
      </div>
      <div className="flex shrink-0 flex-col">
        <button type="button" disabled={i === 0} onClick={() => move(i, -1)} className="grid size-6 cursor-pointer place-items-center rounded-md text-muted-foreground hover:bg-muted disabled:opacity-30" aria-label="Move up"><ArrowUp className="size-3.5" /></button>
        <button type="button" disabled={last} onClick={() => move(i, 1)} className="grid size-6 cursor-pointer place-items-center rounded-md text-muted-foreground hover:bg-muted disabled:opacity-30" aria-label="Move down"><ArrowDown className="size-3.5" /></button>
      </div>
      <span className="hidden text-muted-foreground sm:block">{on ? <Eye className="size-4" /> : <EyeOff className="size-4" />}</span>
      <Switch id={`sec-${k}`} checked={on} onChange={(x) => form.set('sections', { ...v.sections, [k]: x })} />
    </Reorder.Item>
  );
}

function SubItems({ vcardId, kind, title, icon, items, onChange, fields, imageRequired }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(false);
  const blank = { ...Object.fromEntries(fields.map((f) => [f[0], ''])), image: null };
  const form = useForm(blank);
  const openForm = (it) => { setEditing(it || null); form.setErrors({}); form.setValues(it ? { ...blank, ...it } : blank); setOpen(true); };
  const save = async () => {
    setBusy(true);
    const v = { ...form.values }; if (!(v.image instanceof File)) delete v.image;
    for (const k of ['id', 'vcard_id', 'created_at', 'updated_at']) delete v[k];
    if (kind === 'gallery') { v.type = v.video_url ? 'youtube' : 'image'; if (!v.video_url) delete v.video_url; }
    for (const k of Object.keys(v)) if (v[k] === null) delete v[k];
    try {
      const d = await run(editing ? api.put(`/user/vcards/${vcardId}/${kind}/${editing.id}`, toFormData(v)) : api.post(`/user/vcards/${vcardId}/${kind}`, toFormData(v)));
      onChange(editing ? items.map((i) => (i.id === editing.id ? d.data : i)) : [...items, d.data]); setOpen(false);
    } catch (e) { form.setErrors(e.errors); } finally { setBusy(false); }
  };
  const remove = async (it) => { if (await confirm({ title: 'Remove this item?' })) { await run(api.delete(`/user/vcards/${vcardId}/${kind}/${it.id}`), 'Removed').catch(() => {}); onChange(items.filter((i) => i.id !== it.id)); } };
  return (
    <>
      <Card>
        <CardHeader icon={icon} title={`${title} (${items.length})`} description="Changes here are saved instantly" actions={<Button size="sm" onClick={() => openForm()}><Plus />Add</Button>} />
        <CardBody>
          {!items.length ? <EmptyState icon={icon} title={`No ${title.toLowerCase()} yet`} action={<Button variant="soft" onClick={() => openForm()}><Plus />Add the first one</Button>} /> : kind === 'gallery' ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {items.map((g) => (
                <motion.div key={g.id} layout initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="group relative overflow-hidden rounded-2xl">
                  <img src={g.type === 'youtube' ? `https://i.ytimg.com/vi/${g.video_url}/hqdefault.jpg` : g.image} alt={g.caption || ''} className="aspect-square w-full object-cover transition duration-500 group-hover:scale-105" />
                  {g.type === 'youtube' && <span className="absolute top-2 left-2 rounded-md bg-red-600 px-1.5 py-0.5 text-[10px] font-bold text-white">VIDEO</span>}
                  {g.category && <span className="absolute bottom-2 left-2 rounded-md bg-zinc-900/70 px-1.5 py-0.5 text-[10px] font-medium text-white">{g.category}</span>}
                  <button type="button" onClick={() => remove(g)} className="absolute top-2 right-2 grid size-8 cursor-pointer place-items-center rounded-lg bg-zinc-900/70 text-white opacity-0 backdrop-blur transition group-hover:opacity-100" aria-label="Delete"><Trash2 className="size-4" /></button>
                  {g.caption && <p className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/70 p-2 text-xs text-white">{g.caption}</p>}
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {items.map((it) => (
                <motion.div key={it.id} layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="group flex items-center gap-4 rounded-2xl border border-border p-3 transition hover:border-primary/30">
                  {it.image ? <img src={it.image} alt="" className="size-12 rounded-xl object-cover" /> : <span className="grid size-12 place-items-center rounded-xl bg-primary-soft text-primary">{(it.name || '?')[0]}</span>}
                  <div className="min-w-0 flex-1"><p className="font-medium">{it.name}</p><p className="truncate text-sm text-muted-foreground">{it.description}</p></div>
                  <div className="flex gap-1 opacity-60 transition group-hover:opacity-100">
                    <Button variant="ghost" size="icon-sm" onClick={() => openForm(it)} aria-label="Edit"><Pencil /></Button>
                    <Button variant="danger-soft" size="icon-sm" onClick={() => remove(it)} aria-label="Delete"><Trash2 /></Button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>
      <Dialog open={open} onOpenChange={setOpen} icon={icon} title={`${editing ? 'Edit' : 'Add'} ${kind === 'gallery' ? 'photo' : title.toLowerCase().replace(/s$/, '')}`}
        footer={<><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={save} loading={busy}>Save</Button></>}>
        <div className="grid gap-4">
          {fields.map(([n, l, t, req]) => <Field key={n} label={n === 'description' && kind === 'services' ? <span className="flex w-full items-center justify-between">{l} <AiButton kind="service" title={form.values.name} onResult={(x) => form.set('description', x)} /></span> : l} required={req} error={form.errors[n]}>{t === 'textarea' ? <Textarea {...form.input(n)} rows={3} /> : <Input {...form.input(n)} type={t} />}</Field>)}
          {!(kind === 'gallery' && form.values.video_url) && <Field label="Image" required={imageRequired || (kind === 'gallery' && !editing)} error={form.errors.image}><ImageUpload value={form.values.image} onChange={(x) => form.set('image', x)} /></Field>}
        </div>
      </Dialog>
    </>
  );
}
