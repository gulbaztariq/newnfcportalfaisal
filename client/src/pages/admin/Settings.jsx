import { lazy, Suspense, useEffect, useState } from 'react';
import { NavLink, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Settings2, CreditCard, FileText, Search, Save, Image as ImageIcon, Palette, Megaphone, Smartphone, Share2, Home, Sun, Moon, Globe, Banknote, ExternalLink, Mail, Send, ShieldCheck, Bot, Hash, KeyRound, Clock, Percent, RotateCcw, MessageCircle, Code2, ShoppingBag, Truck, FileText as InvoiceIcon, Lock, IdCard } from 'lucide-react';
import { Plus as PlusIcon, Trash2 as TrashIcon, Package as PackageIcon } from 'lucide-react';
import { toast } from 'sonner';
import api, { toFormData } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/cn';
import { PageHeader, Card, CardHeader, CardBody, Button, ButtonLink, Field, Input, Textarea, Select, SwitchRow, ImageUpload, Skeleton, Badge, Segmented, Switch, run } from '@/components/ui';

const RichText = lazy(() => import('@/components/ui/RichText'));
const Editor = (p) => <Suspense fallback={<Skeleton className="h-60 rounded-xl" />}><RichText {...p} /></Suspense>;

function useSettings() {
  const [s, setS] = useState(null);
  const [currencies, setCurrencies] = useState([]);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  useEffect(() => { api.get('/admin/settings').then(({ data }) => { setS(data.data); setCurrencies(data.currencies); }); }, []);
  const set = (k, v) => { setS((x) => ({ ...x, [k]: v })); setErrors((e) => ({ ...e, [k]: undefined })); };
  const save = async (keys) => {
    setSaving(true);
    const payload = Object.fromEntries(keys.filter((k) => !(['app_logo', 'dashboard_logo', 'favicon', 'home_image', 'invoice_logo'].includes(k) && !(s[k] instanceof File))).map((k) => [k, s[k]]));
    try { const data = await run(api.put('/admin/settings', toFormData(payload))); setS(data.data); } catch (e) { setErrors(e.errors || {}); } finally { setSaving(false); }
  };
  const input = (k) => ({ id: `s-${k}`, value: s?.[k] ?? '', onChange: (e) => set(k, e.target.value), 'aria-invalid': !!errors[k] || undefined });
  const flag = (k) => ({ id: `t-${k}`, checked: s?.[k] === '1', onChange: (v) => set(k, v ? '1' : '0') });
  return { s, set, save, input, flag, errors, currencies, saving };
}

const TABS = [
  ['general', Settings2, 'General', 'Branding, contact & options'],
  ['payment', CreditCard, 'Payment gateways', 'Stripe, PayPal & more'],
  ['terms', FileText, 'Terms & privacy', 'Legal pages'],
  ['google', Search, 'SEO & Google', 'Meta tags & analytics'],
  ['mail', Mail, 'Mail & templates', 'SMTP server & e-mail texts'],
  ['integrations', ShieldCheck, 'Security & integrations', 'Login codes, reCAPTCHA, Slack, AI'],
  ['shop', ShoppingBag, 'Shop & delivery', 'COD, delivery, tax, designs'],
  ['courier', Truck, 'Courier (Leopards)', 'API, shipper, live tracking'],
  ['messaging', MessageCircle, 'WhatsApp & SMS', 'Order step messages'],
  ['invoices', InvoiceIcon, 'Invoices', 'Numbering, company, templates'],
];

function SaveBar({ onSave, saving }) {
  return (
    <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="glass sticky bottom-4 z-10 mt-6 flex items-center justify-between gap-3 rounded-2xl border border-border p-3 pl-5 shadow-lift">
      <p className="text-sm text-muted-foreground">Changes apply immediately after saving.</p>
      <Button onClick={onSave} loading={saving}><Save />Save changes</Button>
    </motion.div>
  );
}

export default function Settings() {
  const { tab = 'general' } = useParams();
  const st = useSettings();
  const current = TABS.find((t) => t[0] === tab) || TABS[0];
  return (
    <>
      <PageHeader title="Settings" description="Configure how the platform looks and works." />
      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        <Card className="h-fit p-2 lg:sticky lg:top-24">
          {TABS.map(([k, I, l, d]) => (
            <NavLink key={k} to={`/admin/settings/${k}`} className={({ isActive }) => cn('relative flex items-center gap-3 rounded-xl px-3 py-2.5 transition', isActive ? 'text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground')}>
              {({ isActive }) => (
                <>
                  {isActive && <motion.span layoutId="set-tab" className="absolute inset-0 rounded-xl bg-primary-soft" transition={{ type: 'spring', stiffness: 400, damping: 32 }} />}
                  <I className="relative size-4.5" />
                  <span className="relative"><span className="block text-sm font-medium">{l}</span><span className="block text-xs opacity-70">{d}</span></span>
                </>
              )}
            </NavLink>
          ))}
        </Card>
        <div>
          {!st.s ? <Skeleton className="h-[520px] rounded-2xl" /> : (
            <AnimatePresence mode="wait">
              <motion.div key={current[0]} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.25 }}>
                {tab === 'payment' ? <Payment st={st} /> : tab === 'terms' ? <Terms st={st} /> : tab === 'google' ? <Google st={st} /> : tab === 'mail' ? <MailSettings st={st} /> : tab === 'integrations' ? <Integrations st={st} /> : tab === 'shop' ? <ShopSettings st={st} /> : tab === 'courier' ? <CourierSettings st={st} /> : tab === 'messaging' ? <Messaging st={st} /> : tab === 'invoices' ? <InvoiceSettings st={st} /> : <General st={st} />}
              </motion.div>
            </AnimatePresence>
          )}
        </div>
      </div>
    </>
  );
}

function General({ st }) {
  const keys = ['app_name', 'email', 'phone', 'region_code', 'address', 'default_currency_id', 'affiliation_amount', 'min_withdrawal_amount', 'register_enable', 'hide_decimal_values', 'app_logo', 'dashboard_logo', 'favicon', 'timezone', 'date_format', 'time_format', 'nfc_tax_name', 'nfc_tax_rate', 'expiry_reminder_days', 'expiry_reminder_every_days', 'default_vcard_enable', 'default_vcard_template'];
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader icon={Settings2} title="Application" />
        <CardBody className="grid gap-4 sm:grid-cols-2">
          <Field label="App name" error={st.errors.app_name}><Input {...st.input('app_name')} /></Field>
          <Field label="Support e-mail" error={st.errors.email}><Input {...st.input('email')} type="email" /></Field>
          <Field label="Phone"><div className="flex gap-2"><Input className="w-20" placeholder="+1" value={st.s.region_code || ''} onChange={(e) => st.set('region_code', e.target.value.replace(/\D/g, ''))} /><Input {...st.input('phone')} className="flex-1" /></div></Field>
          <Field label="Default currency"><Select value={st.s.default_currency_id} onChange={(v) => st.set('default_currency_id', v)} options={st.currencies.map((c) => ({ value: c.id, label: `${c.currency_code} - ${c.currency_name}` }))} /></Field>
          <Field label="Address" className="sm:col-span-2"><Textarea {...st.input('address')} rows={2} /></Field>
        </CardBody>
      </Card>
      <Card>
        <CardHeader icon={ImageIcon} title="Branding" description="Logos used on the website, dashboard and browser tab" />
        <CardBody className="grid gap-4 md:grid-cols-3">
          <Field label="App logo"><ImageUpload value={st.s.app_logo} onChange={(v) => st.set('app_logo', v)} hint="Website header" /></Field>
          <Field label="Dashboard logo"><ImageUpload value={st.s.dashboard_logo} onChange={(v) => st.set('dashboard_logo', v)} hint="Portal sidebar" /></Field>
          <Field label="Favicon"><ImageUpload value={st.s.favicon} onChange={(v) => st.set('favicon', v)} hint="PNG or ICO" accept="image/png,image/x-icon,image/vnd.microsoft.icon" /></Field>
        </CardBody>
      </Card>
      <Card>
        <CardHeader icon={Banknote} title="Affiliation & options" />
        <CardBody className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Earning per referred user"><Input {...st.input('affiliation_amount')} type="number" min="0" step="0.01" /></Field>
            <Field label="Minimum withdrawal"><Input {...st.input('min_withdrawal_amount')} type="number" min="0" step="0.01" /></Field>
          </div>
          <SwitchRow title="User registration" description="Allow visitors to create accounts from the website" {...st.flag('register_enable')} />
          <SwitchRow title="Hide decimal values" description="Show prices without cents on the website" {...st.flag('hide_decimal_values')} />
        </CardBody>
      </Card>
      <Card>
        <CardHeader icon={Clock} title="Regional" description="How dates and times are shown in e-mails, invoices and exports" />
        <CardBody className="grid gap-4 sm:grid-cols-3">
          <Field label="Timezone"><Select value={st.s.timezone} onChange={(v) => st.set('timezone', v)} options={TIMEZONES.map((z) => ({ value: z, label: z }))} /></Field>
          <Field label="Date format"><Select value={st.s.date_format} onChange={(v) => st.set('date_format', v)} options={['DD MMM YYYY', 'DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD', 'DD.MM.YYYY'].map((f) => ({ value: f, label: f }))} /></Field>
          <Field label="Time format"><Select value={st.s.time_format} onChange={(v) => st.set('time_format', v)} options={[{ value: '24', label: '24 hour (14:30)' }, { value: '12', label: '12 hour (2:30 PM)' }]} /></Field>
        </CardBody>
      </Card>
      <Card>
        <CardHeader icon={IdCard} title="New accounts" />
        <CardBody className="space-y-4">
          <SwitchRow title="Create a starter vCard for every new user" description="When an admin creates a user, someone registers, or a shop buyer gets an account" {...st.flag('default_vcard_enable')} />
          <Field label="Template of the starter vCard" hint="Template slug, e.g. vcard1"><Input {...st.input('default_vcard_template')} /></Field>
        </CardBody>
      </Card>
      <Card>
        <CardHeader icon={Percent} title="NFC order tax & reminders" />
        <CardBody className="grid gap-4 sm:grid-cols-3">
          <Field label="Tax name" hint="e.g. VAT"><Input {...st.input('nfc_tax_name')} placeholder="-" /></Field>
          <Field label="Tax rate (%)" hint="Added to NFC card orders"><Input {...st.input('nfc_tax_rate')} type="number" min="0" max="100" step="0.01" /></Field>
          <Field label="Plan expiry reminder starts" hint="Days before expiry the first e-mail is sent (0 = no reminders)"><Input {...st.input('expiry_reminder_days')} type="number" min="0" max="90" /></Field>
          <Field label="Repeat reminder every" hint="Days between reminder e-mails until the plan is renewed"><Input {...st.input('expiry_reminder_every_days')} type="number" min="1" max="30" /></Field>
        </CardBody>
      </Card>
      <SaveBar onSave={() => st.save(keys)} saving={st.saving} />
    </div>
  );
}

const TIMEZONES = (() => { try { return Intl.supportedValuesOf('timeZone'); } catch { return ['UTC', 'Europe/London', 'Asia/Karachi', 'Asia/Dubai', 'Asia/Kolkata', 'America/New_York']; } })();

const GATEWAYS = [
  ['stripe', 'Stripe', 'from-indigo-500 to-violet-500', [['stripe_key', 'Publishable key'], ['stripe_secret', 'Secret key']], true],
  ['paypal', 'PayPal', 'from-sky-500 to-blue-600', [['paypal_client_id', 'Client ID'], ['paypal_secret', 'Secret'], ['paypal_mode', 'Mode (sandbox / live)']], true],
  ['razorpay', 'RazorPay', 'from-blue-500 to-cyan-500', [['razorpay_key', 'Key ID'], ['razorpay_secret', 'Key secret']]],
  ['flutterwave', 'FlutterWave', 'from-amber-500 to-orange-500', [['flutterwave_key', 'Public key'], ['flutterwave_secret', 'Secret key']]],
  ['paystack', 'PayStack', 'from-teal-500 to-emerald-500', [['paystack_key', 'Public key'], ['paystack_secret', 'Secret key']]],
  ['phonepe', 'PhonePe', 'from-purple-600 to-fuchsia-600', [['phonepe_merchant_id', 'Merchant ID'], ['phonepe_salt_key', 'Salt key'], ['phonepe_salt_index', 'Salt index'], ['phonepe_env', 'Environment (UAT / PROD)']]],
  ['mercadopago', 'MercadoPago', 'from-sky-400 to-cyan-500', [['mercadopago_public_key', 'Public key'], ['mercadopago_access_token', 'Access token']]],
  ['cashfree', 'Cashfree', 'from-violet-500 to-purple-700', [['cashfree_app_id', 'App ID'], ['cashfree_secret', 'Secret key'], ['cashfree_mode', 'Mode (sandbox / live)']]],
  ['sslcommerz', 'SSLCommerz', 'from-blue-600 to-indigo-700', [['sslcommerz_store_id', 'Store ID'], ['sslcommerz_store_password', 'Store password'], ['sslcommerz_mode', 'Mode (sandbox / live)']]],
  ['payfast', 'PayFast', 'from-red-500 to-rose-600', [['payfast_merchant_id', 'Merchant ID'], ['payfast_merchant_key', 'Merchant key'], ['payfast_passphrase', 'Passphrase'], ['payfast_mode', 'Mode (sandbox / live)']]],
  ['iyzico', 'Iyzico', 'from-cyan-500 to-blue-600', [['iyzico_api_key', 'API key'], ['iyzico_secret', 'Secret key'], ['iyzico_mode', 'Mode (sandbox / live)']]],
].map((g) => [g[0], g[1], g[2], g[3], true]);
function Payment({ st }) {
  const keys = [...GATEWAYS.flatMap(([g, , , f]) => [`${g}_enable`, ...f.map((x) => x[0])]), 'manual_payment_enable', 'manual_payment_guide'];
  return (
    <div className="space-y-4">
      <p className="rounded-2xl border border-info/30 bg-info-soft px-4 py-3 text-sm text-info">Secret keys are stored on the server and shown masked. Leave a masked value as it is to keep it.</p>
      {GATEWAYS.map(([g, name, grad, fields, live]) => {
        const on = st.s[`${g}_enable`] === '1';
        return (
          <Card key={g} className={cn('overflow-hidden transition', on && 'border-primary/40')}>
            <div className="flex items-center gap-4 p-5">
              <span className={`grid size-11 place-items-center rounded-2xl bg-linear-to-br ${grad} font-display text-lg font-bold text-white shadow-lg`}>{name[0]}</span>
              <div className="flex-1"><p className="flex items-center gap-2 font-semibold">{name}{live ? <Badge tone="success">Checkout ready</Badge> : <Badge>Credentials only</Badge>}</p><p className="text-xs text-muted-foreground">Accept payments through {name}</p></div>
              <SwitchRow className="border-0 p-0 hover:bg-transparent" title="" {...st.flag(`${g}_enable`)} />
            </div>
            <AnimatePresence initial={false}>
              {on && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                  <div className="grid gap-4 border-t border-border p-5 sm:grid-cols-2">
                    {fields.map(([k, l]) => <Field key={k} label={l}><Input {...st.input(k)} type={/secret|salt_key|password|passphrase|access_token/.test(k) ? 'password' : 'text'} autoComplete="off" /></Field>)}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </Card>
        );
      })}
      <Card>
        <div className="flex items-center gap-4 p-5">
          <span className="grid size-11 place-items-center rounded-2xl bg-linear-to-br from-zinc-600 to-zinc-800 text-white shadow-lg"><Banknote className="size-5" /></span>
          <div className="flex-1"><p className="font-semibold">Manual / cash payment</p><p className="text-xs text-muted-foreground">Users upload a receipt and you approve it in Cash Payments</p></div>
          <SwitchRow className="border-0 p-0 hover:bg-transparent" title="" {...st.flag('manual_payment_enable')} />
        </div>
        {st.s.manual_payment_enable === '1' && <div className="border-t border-border p-5"><Field label="Payment instructions shown to users"><Editor value={st.s.manual_payment_guide} onChange={(v) => st.set('manual_payment_guide', v)} height={140} /></Field></div>}
      </Card>
      <SaveBar onSave={() => st.save(keys)} saving={st.saving} />
    </div>
  );
}

function Terms({ st }) {
  return (
    <div className="space-y-6">
      <Card><CardHeader icon={FileText} title="Terms & Conditions" actions={<a href="/terms-conditions" target="_blank" className="inline-flex items-center gap-1 text-sm text-primary"><ExternalLink className="size-3.5" />View</a>} /><CardBody><Editor value={st.s.terms_conditions} onChange={(v) => st.set('terms_conditions', v)} height={280} /></CardBody></Card>
      <Card><CardHeader icon={FileText} title="Privacy Policy" actions={<a href="/privacy-policy" target="_blank" className="inline-flex items-center gap-1 text-sm text-primary"><ExternalLink className="size-3.5" />View</a>} /><CardBody><Editor value={st.s.privacy_policy} onChange={(v) => st.set('privacy_policy', v)} height={280} /></CardBody></Card>
      <SaveBar onSave={() => st.save(['terms_conditions', 'privacy_policy'])} saving={st.saving} />
    </div>
  );
}

function Google({ st }) {
  const title = st.s.site_title || st.s.app_name;
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader icon={Search} title="Search engine optimisation" />
        <CardBody className="grid gap-4">
          <Field label="Site title"><Input {...st.input('site_title')} /></Field>
          <Field label="Meta keywords" hint="Comma separated"><Input {...st.input('meta_keyword')} /></Field>
          <Field label="Meta description"><Textarea {...st.input('meta_description')} rows={3} /></Field>
          <div className="rounded-2xl border border-border bg-muted/40 p-4">
            <p className="mb-2 text-xs font-medium text-muted-foreground">Google preview</p>
            <p className="truncate text-lg text-[#1a0dab] dark:text-[#8ab4f8]">{title}</p>
            <p className="text-xs text-success">{st.s.app_url || window.location.origin}</p>
            <p className="line-clamp-2 text-sm text-muted-foreground">{st.s.meta_description}</p>
          </div>
        </CardBody>
      </Card>
      <Card>
        <CardHeader icon={Globe} title="Google Analytics" />
        <CardBody><Field label="Measurement ID" error={st.errors.google_analytics} hint="Only the ID. The tracking script is added to the website automatically."><Input {...st.input('google_analytics')} placeholder="G-XXXXXXXXXX" /></Field></CardBody>
      </Card>
      <SaveBar onSave={() => st.save(['site_title', 'meta_keyword', 'meta_description', 'google_analytics'])} saving={st.saving} />
    </div>
  );
}

function MailSettings({ st }) {
  const keys = ['mail_host', 'mail_port', 'mail_username', 'mail_password', 'mail_encryption', 'mail_from_address', 'mail_from_name'];
  const [to, setTo] = useState('');
  const [testing, setTesting] = useState(false);
  const [tpls, setTpls] = useState(null);
  const [cur, setCur] = useState(null);
  useEffect(() => { api.get('/admin/email-templates').then(({ data }) => { setTpls(data.data); setCur(data.data[0]?.key); }); }, []);
  const test = async () => { setTesting(true); await run(api.post('/admin/settings/test-mail', { email: to })).catch(() => {}); setTesting(false); };
  const t = tpls?.find((x) => x.key === cur);
  const tk = (k, f) => `mail_tpl_${k}_${f}`;
  const tv = (x, f) => st.s[tk(x.key, f)] ?? x[f];
  const saveTpls = () => st.save(tpls.flatMap((x) => [tk(x.key, 'subject'), tk(x.key, 'body')]).filter((k) => st.s[k] !== undefined));
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader icon={Mail} title="SMTP server" description="Used for welcome, verification, password reset and all other e-mails" />
        <CardBody className="grid gap-4 sm:grid-cols-2">
          <Field label="Host"><Input {...st.input('mail_host')} placeholder="smtp.example.com" /></Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Port"><Input {...st.input('mail_port')} type="number" /></Field>
            <Field label="Encryption"><Select value={st.s.mail_encryption} onChange={(v) => st.set('mail_encryption', v)} options={[{ value: 'tls', label: 'TLS / STARTTLS' }, { value: 'ssl', label: 'SSL' }, { value: 'none', label: 'None' }]} /></Field>
          </div>
          <Field label="Username"><Input {...st.input('mail_username')} autoComplete="off" /></Field>
          <Field label="Password"><Input {...st.input('mail_password')} type="password" autoComplete="new-password" /></Field>
          <Field label="From address"><Input {...st.input('mail_from_address')} type="email" placeholder="no-reply@example.com" /></Field>
          <Field label="From name"><Input {...st.input('mail_from_name')} /></Field>
        </CardBody>
      </Card>
      <SaveBar onSave={() => st.save(keys)} saving={st.saving} />
      <Card>
        <CardHeader icon={Send} title="Send a test e-mail" description="Save the settings first, then send a test" />
        <CardBody className="flex flex-wrap gap-2"><Input type="email" value={to} onChange={(e) => setTo(e.target.value)} placeholder="you@company.com" className="max-w-sm" /><Button variant="outline" onClick={test} loading={testing} disabled={!to}><Send />Send test</Button></CardBody>
      </Card>
      <Card>
        <CardHeader icon={FileText} title="E-mail templates" description="Customise the text of automatic e-mails. Placeholders are replaced when sending." />
        {!tpls ? <CardBody><Skeleton className="h-60" /></CardBody> : (
          <CardBody className="grid gap-5 lg:grid-cols-[220px_1fr]">
            <div className="flex flex-row flex-wrap gap-1 lg:flex-col">
              {tpls.map((x) => <button key={x.key} type="button" onClick={() => setCur(x.key)} className={cn('cursor-pointer rounded-xl px-3 py-2 text-left text-sm transition', cur === x.key ? 'bg-primary-soft font-medium text-primary' : 'text-muted-foreground hover:bg-muted')}>{x.key.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase())}</button>)}
            </div>
            {t && (
              <div key={t.key} className="space-y-4">
                <Field label="Subject"><Input value={tv(t, 'subject')} onChange={(e) => st.set(tk(t.key, 'subject'), e.target.value)} /></Field>
                <div className="grid gap-4 xl:grid-cols-2">
                  <Field label="Body (HTML)"><Textarea value={tv(t, 'body')} onChange={(e) => st.set(tk(t.key, 'body'), e.target.value)} rows={12} className="font-mono text-xs" /></Field>
                  <Field label="Preview"><div className="prose-content h-full min-h-40 rounded-xl border border-border bg-white p-4 text-sm text-zinc-800" dangerouslySetInnerHTML={{ __html: tv(t, 'body') }} /></Field>
                </div>
                {t.placeholders.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 text-xs"><span className="text-muted-foreground">Placeholders:</span>
                    {t.placeholders.map((ph) => <button type="button" key={ph} onClick={() => { navigator.clipboard?.writeText(ph); toast.success(`${ph} copied`); }} className="cursor-pointer rounded-md bg-muted px-1.5 py-0.5 font-mono hover:bg-primary-soft hover:text-primary">{ph}</button>)}
                  </div>
                )}
                <div className="flex gap-2">
                  <Button onClick={saveTpls} loading={st.saving}><Save />Save templates</Button>
                  <Button variant="ghost" onClick={() => { st.set(tk(t.key, 'subject'), t.default_subject); st.set(tk(t.key, 'body'), t.default_body); }}><RotateCcw />Reset to default</Button>
                </div>
              </div>
            )}
          </CardBody>
        )}
      </Card>
    </div>
  );
}

function Integrations({ st }) {
  const keys = ['login_otp_enable', 'enforce_2fa_staff', 'max_login_attempts', 'lockout_minutes', 'email_verification_enable', 'blocked_email_domains', 'recaptcha_enable', 'recaptcha_site_key', 'recaptcha_secret', 'recaptcha_min_score',
    'google_login_enable', 'google_client_id', 'slack_enable', 'slack_webhook_url', 'slack_events', 'ai_enable', 'anthropic_api_key'];
  const events = String(st.s.slack_events || '').split(',').filter(Boolean);
  const toggleEvent = (e) => st.set('slack_events', (events.includes(e) ? events.filter((x) => x !== e) : [...events, e]).join(','));
  const [testing, setTesting] = useState(false);
  const testSlack = async () => { setTesting(true); await run(api.post('/admin/settings/test-slack')).catch(() => {}); setTesting(false); };
  return (
    <div className="space-y-6">
      <p className="rounded-2xl border border-info/30 bg-info-soft px-4 py-3 text-sm text-info">Secrets are stored on the server and shown masked. Leave a masked value as it is to keep it.</p>
      <Card>
        <CardHeader icon={ShieldCheck} title="Account security" />
        <CardBody className="space-y-4">
          <SwitchRow title="E-mail code on every sign-in (all users)" description="After the password, a 6-digit code is e-mailed. Users with an authenticator app use that instead. Needs the SMTP server (Mail tab)." {...st.flag('login_otp_enable')} />
          <SwitchRow title="Two-step sign-in for staff" description="Super admin, admins, managers and supervisors always need a second step (authenticator app or e-mailed code)" {...st.flag('enforce_2fa_staff')} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Failed attempts before lock" hint="Per account"><Input {...st.input('max_login_attempts')} type="number" min="3" max="20" /></Field>
            <Field label="Lock duration (minutes)"><Input {...st.input('lockout_minutes')} type="number" min="1" max="1440" /></Field>
          </div>
          <SwitchRow title="E-mail verification" description="New users must confirm their e-mail address before signing in" {...st.flag('email_verification_enable')} />
          <Field label="Blocked e-mail domains" hint="One per line or comma separated, e.g. mailinator.com. Used for sign-up, contact and enquiry forms." error={st.errors.blocked_email_domains}><Textarea {...st.input('blocked_email_domains')} rows={3} placeholder="mailinator.com&#10;tempmail.com" /></Field>
        </CardBody>
      </Card>
      <Card>
        <CardHeader icon={KeyRound} title="Google reCAPTCHA v3" description="Invisible bot protection on registration and the contact form" />
        <CardBody className="space-y-4">
          <SwitchRow title="Enable reCAPTCHA" {...st.flag('recaptcha_enable')} />
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Site key"><Input {...st.input('recaptcha_site_key')} autoComplete="off" /></Field>
            <Field label="Secret key"><Input {...st.input('recaptcha_secret')} type="password" autoComplete="new-password" /></Field>
            <Field label="Minimum score" hint="0.0 - 1.0"><Input {...st.input('recaptcha_min_score')} type="number" min="0" max="1" step="0.1" /></Field>
          </div>
        </CardBody>
      </Card>
      <Card>
        <CardHeader icon={Globe} title="Sign in with Google" description="Add the website URL as an authorised JavaScript origin in Google Cloud" />
        <CardBody className="space-y-4">
          <SwitchRow title="Enable Google sign-in" {...st.flag('google_login_enable')} />
          <Field label="OAuth client ID"><Input {...st.input('google_client_id')} placeholder="xxxxxxxx.apps.googleusercontent.com" autoComplete="off" /></Field>
        </CardBody>
      </Card>
      <Card>
        <CardHeader icon={Hash} title="Slack notifications" actions={<Button size="xs" variant="outline" onClick={testSlack} loading={testing}><Send />Test</Button>} />
        <CardBody className="space-y-4">
          <SwitchRow title="Send events to Slack" {...st.flag('slack_enable')} />
          <Field label="Incoming webhook URL" error={st.errors.slack_webhook_url}><Input {...st.input('slack_webhook_url')} type="password" placeholder="https://hooks.slack.com/services/..." autoComplete="off" /></Field>
          <div className="flex flex-wrap gap-2">
            {[['user_registered', 'New user'], ['payment', 'Payment'], ['nfc_order', 'NFC order'], ['store_order', 'Store order'], ['appointment', 'Appointment']].map(([k, l]) => (
              <button key={k} type="button" onClick={() => toggleEvent(k)} className={cn('cursor-pointer rounded-full border px-3 py-1.5 text-xs font-medium transition', events.includes(k) ? 'border-primary bg-primary-soft text-primary' : 'border-border text-muted-foreground hover:border-primary/40')}>{l}</button>
            ))}
          </div>
        </CardBody>
      </Card>
      <Card>
        <CardHeader icon={Bot} title="AI writing tools" description="Lets users draft vCard bios, service texts and whole cards with Claude" />
        <CardBody className="space-y-4">
          <SwitchRow title="Enable AI tools" description="Only for plans with the AI writing tools feature" {...st.flag('ai_enable')} />
          <Field label="Anthropic API key" hint="Create one at console.anthropic.com"><Input {...st.input('anthropic_api_key')} type="password" placeholder="sk-ant-..." autoComplete="new-password" /></Field>
        </CardBody>
      </Card>
      <SaveBar onSave={() => st.save(keys)} saving={st.saving} />
    </div>
  );
}

/** Wholesale quantity tiers and sample rules: used by the Wholesale and Samples order types */
function WholesaleSettings({ st }) {
  let tiers = [];
  try { tiers = JSON.parse(st.s?.wholesale_tiers || '[]'); } catch { tiers = []; }
  if (!Array.isArray(tiers)) tiers = [];
  const setTiers = (t) => st.set('wholesale_tiers', JSON.stringify(t));
  const upd = (i, patch) => setTiers(tiers.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  return (
    <Card>
      <CardHeader icon={PackageIcon} title="Wholesale & samples" description="Used by the Wholesale and Samples order types. A product can override these tiers in its price list."
        actions={<Button size="sm" variant="outline" onClick={() => setTiers([...tiers, { min: (Number(tiers.at(-1)?.min) || 0) + 50, percent: (Number(tiers.at(-1)?.percent) || 0) + 5 }])}><PlusIcon />Add tier</Button>} />
      <CardBody className="space-y-5">
        <div>
          <p className="mb-2 text-sm font-medium">Quantity tiers (per product, per order)</p>
          {!tiers.length ? <p className="text-sm text-muted-foreground">No tiers: wholesale orders get the normal price.</p> : (
            <div className="space-y-2">
              {tiers.map((t, i) => (
                <div key={i} className="flex flex-wrap items-center gap-2 rounded-2xl border border-border p-2.5">
                  <span className="text-sm text-muted-foreground">From</span>
                  <Input className="w-24" type="number" min="1" aria-label="Minimum quantity" value={t.min ?? ''} onChange={(e) => upd(i, { min: e.target.value })} />
                  <span className="text-sm text-muted-foreground">pieces:</span>
                  <Input className="w-24" type="number" min="0" max="100" step="0.5" aria-label="Discount percent" value={t.percent ?? ''} onChange={(e) => upd(i, { percent: e.target.value })} />
                  <span className="flex-1 text-sm text-muted-foreground">% off</span>
                  <Button variant="danger-soft" size="icon-sm" onClick={() => setTiers(tiers.filter((_, j) => j !== i))} aria-label="Remove tier"><TrashIcon /></Button>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Sample markup (%)" hint="A sample costs the normal price plus this much, unless the product has its own sample price"><Input {...st.input('sample_markup_percent')} type="number" min="0" /></Field>
          <Field label="Max samples per product" hint="Samples are limited per product in one order"><Input {...st.input('sample_max_qty')} type="number" min="1" /></Field>
        </div>
        <SwitchRow title="Credit samples to the bulk order" description="When a customer orders in bulk after samples, what they paid for the samples is deducted (delivery is not)" {...st.flag('sample_credit_enable')} />
      </CardBody>
    </Card>
  );
}

function ShopSettings({ st }) {
  const keys = ['shop_enable', 'shop_currency_code', 'shop_currency_icon', 'delivery_charges', 'free_delivery_above', 'cod_enable', 'cod_charges', 'online_payment_enable', 'shop_min_order', 'shop_ai_design_enable', 'shop_upload_design_enable', 'nfc_tax_name', 'nfc_tax_rate', 'dummy_email_domain', 'wholesale_tiers', 'sample_markup_percent', 'sample_max_qty', 'sample_credit_enable'];
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader icon={ShoppingBag} title="Website shop" description="Products are managed in Orders > Products" />
        <CardBody className="space-y-4">
          <SwitchRow title="Shop open" description="Show the shop (/shop) and accept orders from the website" {...st.flag('shop_enable')} />
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Currency code"><Input {...st.input('shop_currency_code')} /></Field>
            <Field label="Currency symbol"><Input {...st.input('shop_currency_icon')} /></Field>
            <Field label="Minimum order"><Input {...st.input('shop_min_order')} type="number" min="0" /></Field>
          </div>
          <Field label="Dummy e-mail domain" hint="Used by the Dummy e-mail option in New order for customers without an e-mail, e.g. customers.yourdomain.com. Empty = your app domain. No e-mails are sent to these addresses."><Input {...st.input('dummy_email_domain')} placeholder="customers.yourdomain.com" /></Field>
        </CardBody>
      </Card>
      <Card>
        <CardHeader icon={Truck} title="Delivery, COD & tax" />
        <CardBody className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Delivery charges" hint="Added to every order"><Input {...st.input('delivery_charges')} type="number" min="0" /></Field>
            <Field label="Free delivery above" hint="0 = never free"><Input {...st.input('free_delivery_above')} type="number" min="0" /></Field>
          </div>
          <SwitchRow title="Cash on delivery (COD)" {...st.flag('cod_enable')} />
          <Field label="COD charges" hint="Extra fee for cash on delivery, 0 = none"><Input {...st.input('cod_charges')} type="number" min="0" /></Field>
          <SwitchRow title="Online / bank payment" description="Uses the gateways enabled in Payment gateways" {...st.flag('online_payment_enable')} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Tax name" hint="e.g. GST, Sales tax"><Input {...st.input('nfc_tax_name')} /></Field>
            <Field label="Tax rate (%)" hint="Applied to the order subtotal"><Input {...st.input('nfc_tax_rate')} type="number" min="0" max="100" step="0.01" /></Field>
          </div>
        </CardBody>
      </Card>
      <WholesaleSettings st={st} />
      <Card>
        <CardHeader icon={Palette} title="Customer designs" />
        <CardBody className="space-y-4">
          <SwitchRow title="Design with AI at checkout" description="Customers generate a card design with Claude (needs AI tools enabled in Security & integrations)" {...st.flag('shop_ai_design_enable')} />
          <SwitchRow title="Upload own design" description="PNG, JPG, WEBP or PDF up to 10 MB" {...st.flag('shop_upload_design_enable')} />
        </CardBody>
      </Card>
      <SaveBar onSave={() => st.save(keys)} saving={st.saving} />
    </div>
  );
}

function CourierSettings({ st }) {
  const keys = ['leopards_enable', 'leopards_mode', 'leopards_base_url', 'leopards_api_key', 'leopards_api_password', 'leopards_origin_city', 'leopards_shipper_id', 'leopards_shipper_name', 'leopards_shipper_phone', 'leopards_shipper_email', 'leopards_shipper_address', 'leopards_default_weight', 'leopards_shipment_type', 'leopards_instructions', 'leopards_auto_sync'];
  const [cities, setCities] = useState(null);
  const [testing, setTesting] = useState(false);
  const test = async () => { setTesting(true); try { const { data } = await api.get('/admin/courier/cities'); setCities(data.data); toast.success(`Connected: ${data.data.length} cities loaded`); } catch (e) { toast.error(e.message); } finally { setTesting(false); } };
  return (
    <div className="space-y-6">
      <p className="rounded-2xl border border-info/30 bg-info-soft px-4 py-3 text-sm text-info">Get your API key and password from the Leopards merchant portal (Settings &gt; API). Secrets are shown masked; leave them as they are to keep them.</p>
      <Card>
        <CardHeader icon={Truck} title="Leopards Courier API" actions={<Button size="xs" variant="outline" onClick={test} loading={testing}>Test connection</Button>} />
        <CardBody className="space-y-4">
          <SwitchRow title="Enable Leopards" description="Book packets and see live status from the order page" {...st.flag('leopards_enable')} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="API key"><Input {...st.input('leopards_api_key')} autoComplete="off" /></Field>
            <Field label="API password"><Input {...st.input('leopards_api_password')} type="password" autoComplete="new-password" /></Field>
            <Field label="Environment"><Select value={st.s.leopards_mode} onChange={(v) => st.set('leopards_mode', v)} options={[{ value: 'production', label: 'Production' }, { value: 'staging', label: 'Staging (testing)' }]} /></Field>
            <Field label="Custom API base URL" hint="Only if Leopards gave you a different URL"><Input {...st.input('leopards_base_url')} placeholder="https://merchantapi.leopardscourier.com/api/" /></Field>
          </div>
          <SwitchRow title="Auto-sync tracking every 30 minutes" description="Dispatched orders move to Delivered / Returned automatically" {...st.flag('leopards_auto_sync')} />
        </CardBody>
      </Card>
      <Card>
        <CardHeader title="Shipper (your business)" description="Use 'self' to take the details saved in your Leopards account" />
        <CardBody className="grid gap-4 sm:grid-cols-2">
          <Field label="Origin city ID" hint="'self' or a city ID from the list"><Input {...st.input('leopards_origin_city')} /></Field>
          <Field label="Shipper ID" hint="Optional"><Input {...st.input('leopards_shipper_id')} /></Field>
          <Field label="Name"><Input {...st.input('leopards_shipper_name')} /></Field>
          <Field label="Phone"><Input {...st.input('leopards_shipper_phone')} /></Field>
          <Field label="E-mail"><Input {...st.input('leopards_shipper_email')} /></Field>
          <Field label="Default weight (grams)"><Input {...st.input('leopards_default_weight')} type="number" min="1" /></Field>
          <Field label="Address" className="sm:col-span-2"><Textarea {...st.input('leopards_shipper_address')} rows={2} /></Field>
          <Field label="Shipment type"><Select value={st.s.leopards_shipment_type} onChange={(v) => st.set('leopards_shipment_type', v)} options={[{ value: 'overnight', label: 'Overnight' }, { value: 'detain', label: 'Detain' }, { value: 'overland', label: 'Overland' }]} /></Field>
          <Field label="Special instructions"><Input {...st.input('leopards_instructions')} maxLength={250} /></Field>
          {cities && <div className="max-h-44 overflow-auto rounded-xl border border-border p-3 text-xs sm:col-span-2">{cities.slice(0, 400).map((c) => <span key={c.id} className="mr-3 inline-block">{c.name} <span className="text-muted-foreground">#{c.id}</span></span>)}</div>}
        </CardBody>
      </Card>
      <SaveBar onSave={() => st.save(keys)} saving={st.saving} />
    </div>
  );
}

function Messaging({ st }) {
  const keys = ['whatsapp_enable', 'whatsapp_provider', 'whatsapp_phone_number_id', 'whatsapp_access_token', 'whatsapp_api_version', 'whatsapp_template_language', 'whatsapp_http_url', 'whatsapp_http_method', 'whatsapp_http_body', 'whatsapp_http_headers',
    'sms_enable', 'sms_provider', 'sms_http_url', 'sms_http_method', 'sms_http_body', 'sms_http_headers', 'twilio_sid', 'twilio_token', 'twilio_sms_from', 'twilio_whatsapp_from', 'notify_admin_numbers', 'phone_default_region'];
  const [events, setEvents] = useState(null);
  const [test, setTest] = useState({ to: '', channel: 'whatsapp' });
  const [sending, setSending] = useState(false);
  useEffect(() => { api.get('/admin/messaging/events').then(({ data }) => setEvents(data.data)); }, []);
  const ek = (e, f) => (f === 'text' ? `msg_tpl_${e}` : f === 'wa' ? `wa_tpl_${e}` : `notify_${e}_${f}`);
  const evVal = (e, f, def) => st.s[ek(e.key, f)] ?? def;
  const sendTest = async () => { setSending(true); await run(api.post('/admin/messaging/test', test)).catch(() => {}); setSending(false); };
  const saveAll = () => st.save([...keys, ...(events || []).flatMap((e) => ['text', 'wa', 'whatsapp', 'sms'].map((f) => ek(e.key, f))).filter((k) => st.s[k] !== undefined)]);
  const wa = st.s.whatsapp_provider || 'meta';
  const sms = st.s.sms_provider || 'http';
  const http = (prefix) => (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Gateway URL" className="sm:col-span-2" hint="Use {to} and {message} placeholders, e.g. https://api.gateway.pk/send?key=XXX&to={to}&text={message}"><Input {...st.input(`${prefix}_http_url`)} /></Field>
      <Field label="Method"><Select value={st.s[`${prefix}_http_method`] || 'GET'} onChange={(v) => st.set(`${prefix}_http_method`, v)} options={['GET', 'POST'].map((v) => ({ value: v, label: v }))} /></Field>
      <Field label="Headers (JSON)" hint='e.g. {"Authorization":"Bearer ..."}'><Input {...st.input(`${prefix}_http_headers`)} /></Field>
      <Field label="Body (POST)" className="sm:col-span-2" hint='JSON or form body with {to} / {message}, e.g. {"to":"{to}","text":"{message}"}'><Textarea {...st.input(`${prefix}_http_body`)} rows={2} className="font-mono text-xs" /></Field>
    </div>
  );
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader icon={MessageCircle} title="WhatsApp" description="Order step messages to customers and dispatch alerts to your team" />
        <CardBody className="space-y-4">
          <SwitchRow title="Send WhatsApp messages" {...st.flag('whatsapp_enable')} />
          <Field label="Provider"><Segmented id="wap" value={wa} onChange={(v) => st.set('whatsapp_provider', v)} options={[{ value: 'meta', label: 'WhatsApp Cloud API (Meta)' }, { value: 'twilio', label: 'Twilio' }, { value: 'http', label: 'Other gateway' }]} /></Field>
          {wa === 'meta' && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Phone number ID"><Input {...st.input('whatsapp_phone_number_id')} /></Field>
              <Field label="Permanent access token"><Input {...st.input('whatsapp_access_token')} type="password" autoComplete="new-password" /></Field>
              <Field label="Graph API version"><Input {...st.input('whatsapp_api_version')} /></Field>
              <Field label="Template language" hint="Code of your approved templates, e.g. en, en_US, ur"><Input {...st.input('whatsapp_template_language')} /></Field>
              <p className="text-xs text-muted-foreground sm:col-span-2">Meta only delivers business-initiated messages through approved templates. Put the template name next to each event below; its body variables are filled in the order of the placeholders in the text.</p>
            </div>
          )}
          {wa === 'twilio' && <Field label="Twilio WhatsApp sender number"><Input {...st.input('twilio_whatsapp_from')} placeholder="14155238886" /></Field>}
          {wa === 'http' && http('whatsapp')}
        </CardBody>
      </Card>
      <Card>
        <CardHeader icon={Send} title="SMS" />
        <CardBody className="space-y-4">
          <SwitchRow title="Send SMS" {...st.flag('sms_enable')} />
          <Field label="Provider"><Segmented id="smp" value={sms} onChange={(v) => st.set('sms_provider', v)} options={[{ value: 'http', label: 'Any HTTP SMS gateway' }, { value: 'twilio', label: 'Twilio' }]} /></Field>
          {sms === 'http' ? http('sms') : <Field label="Twilio SMS sender"><Input {...st.input('twilio_sms_from')} placeholder="+1..." /></Field>}
          {(sms === 'twilio' || wa === 'twilio') && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Twilio account SID"><Input {...st.input('twilio_sid')} /></Field>
              <Field label="Twilio auth token"><Input {...st.input('twilio_token')} type="password" autoComplete="new-password" /></Field>
            </div>
          )}
        </CardBody>
      </Card>
      <Card>
        <CardHeader title="Recipients" />
        <CardBody className="grid gap-4 sm:grid-cols-2">
          <Field label="Admin numbers" hint="Comma separated; they get the admin alerts (new order, dispatched)"><Input {...st.input('notify_admin_numbers')} placeholder="923001234567, 923331234567" /></Field>
          <Field label="Default country code" hint="Numbers like 03xx... become 92 3xx..."><Input {...st.input('phone_default_region')} /></Field>
        </CardBody>
      </Card>
      <Card>
        <CardHeader title="Messages per step" description="Placeholders: {{name}} {{order}} {{total}} {{payment}} {{payment_note}} {{courier}} {{tracking}} {{track_url}} {{city}} {{phone}} {{cod}} {{app_name}}" />
        <CardBody className="space-y-4">
          {!events ? <Skeleton className="h-60" /> : events.map((e) => (
            <div key={e.key} className="rounded-2xl border border-border p-4">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
                <p className="font-medium">{e.label}</p>
                <div className="flex items-center gap-4 text-sm">
                  <label className="flex items-center gap-2"><Switch size="sm" checked={evVal(e, 'whatsapp', e.whatsapp) === '1' || (evVal(e, 'whatsapp', e.whatsapp) === '' && ['order_placed', 'order_confirmed', 'order_shipped', 'order_delivered', 'admin_order_placed', 'admin_order_shipped'].includes(e.key))} onChange={(v) => st.set(ek(e.key, 'whatsapp'), v ? '1' : '0')} />WhatsApp</label>
                  <label className="flex items-center gap-2"><Switch size="sm" checked={evVal(e, 'sms', e.sms) === '1' || (evVal(e, 'sms', e.sms) === '' && e.key === 'order_shipped')} onChange={(v) => st.set(ek(e.key, 'sms'), v ? '1' : '0')} />SMS</label>
                </div>
              </div>
              <Textarea rows={2} value={evVal(e, 'text', e.text)} onChange={(x) => st.set(ek(e.key, 'text'), x.target.value)} />
              {wa === 'meta' && <Input className="mt-2" value={evVal(e, 'wa', e.wa_template)} onChange={(x) => st.set(ek(e.key, 'wa'), x.target.value)} placeholder="Approved WhatsApp template name (optional)" />}
            </div>
          ))}
        </CardBody>
      </Card>
      <SaveBar onSave={saveAll} saving={st.saving} />
      <Card>
        <CardHeader icon={Send} title="Send a test message" description="Save first" />
        <CardBody className="flex flex-wrap gap-2">
          <Segmented id="tch" value={test.channel} onChange={(v) => setTest({ ...test, channel: v })} options={[{ value: 'whatsapp', label: 'WhatsApp' }, { value: 'sms', label: 'SMS' }]} />
          <Input className="max-w-56" value={test.to} onChange={(e) => setTest({ ...test, to: e.target.value })} placeholder="03001234567" />
          <Button variant="outline" onClick={sendTest} loading={sending} disabled={!test.to}><Send />Send test</Button>
        </CardBody>
      </Card>
    </div>
  );
}

function InvoiceSettings({ st }) {
  const keys = ['invoice_prefix', 'invoice_next_number', 'invoice_number_padding', 'invoice_template', 'invoice_accent', 'invoice_company_name', 'invoice_company_address', 'invoice_company_phone', 'invoice_company_email', 'invoice_tax_id', 'invoice_logo', 'invoice_bank_details', 'invoice_notes', 'invoice_terms', 'invoice_footer', 'invoice_due_days', 'invoice_auto_orders', 'invoice_auto_subscriptions'];
  const [templates, setTemplates] = useState([]);
  useEffect(() => { api.get('/admin/invoices/templates').then(({ data }) => setTemplates(data.data)); }, []);
  const example = `${st.s.invoice_prefix || ''}${String(st.s.invoice_next_number || 1).padStart(Number(st.s.invoice_number_padding || 5), '0')}`;
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader icon={InvoiceIcon} title="Numbering & defaults" description={`Next invoice number: ${example}`} />
        <CardBody className="grid gap-4 sm:grid-cols-3">
          <Field label="Prefix"><Input {...st.input('invoice_prefix')} /></Field>
          <Field label="Next number"><Input {...st.input('invoice_next_number')} type="number" min="1" /></Field>
          <Field label="Digits"><Input {...st.input('invoice_number_padding')} type="number" min="1" max="10" /></Field>
          <Field label="Payment due after (days)"><Input {...st.input('invoice_due_days')} type="number" min="0" /></Field>
          <Field label="Accent colour" hint="Empty = template colour"><div className="flex gap-2"><input type="color" value={st.s.invoice_accent || '#6d5dfc'} onChange={(e) => st.set('invoice_accent', e.target.value)} className="h-10 w-12 cursor-pointer rounded-lg border border-border" aria-label="Accent colour" /><Input {...st.input('invoice_accent')} placeholder="#6d5dfc" /></div></Field>
          <div className="space-y-2 sm:col-span-3">
            <SwitchRow title="Create invoices for orders automatically" description="When an order is confirmed" {...st.flag('invoice_auto_orders')} />
            <SwitchRow title="Create invoices for plan payments automatically" description="When a subscription payment succeeds or a cash payment is approved" {...st.flag('invoice_auto_subscriptions')} />
          </div>
        </CardBody>
      </Card>
      <Card>
        <CardHeader title="Default template" />
        <CardBody className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {templates.map((t) => (
            <button key={t.key} type="button" onClick={() => st.set('invoice_template', t.key)} className={cn('cursor-pointer rounded-2xl border-2 p-3 text-left transition', st.s.invoice_template === t.key ? 'border-primary shadow-glow' : 'border-border hover:border-primary/40')}>
              <div className="h-24 overflow-hidden rounded-xl border border-border bg-white p-2">
                <div className="h-4 rounded" style={{ background: ['modern', 'bold', 'corporate'].includes(t.key) ? (st.s.invoice_accent || t.accent) : 'transparent', borderBottom: ['modern', 'bold', 'corporate'].includes(t.key) ? 0 : `2px solid ${st.s.invoice_accent || t.accent}` }} />
                <div className="mt-2 h-1.5 w-1/2 rounded bg-zinc-200" /><div className="mt-1 h-1.5 w-1/3 rounded bg-zinc-200" />
                <div className="mt-3 space-y-1">{[0, 1, 2].map((i) => <div key={i} className="h-1.5 rounded bg-zinc-100" />)}</div>
                <div className="mt-2 ml-auto h-3 w-1/3 rounded" style={{ background: st.s.invoice_accent || t.accent }} />
              </div>
              <p className="mt-2 text-sm font-medium">{t.label}</p>
            </button>
          ))}
        </CardBody>
      </Card>
      <Card>
        <CardHeader title="Your business on invoices" description="Empty fields fall back to the General settings" />
        <CardBody className="grid gap-4 sm:grid-cols-2">
          <Field label="Company name"><Input {...st.input('invoice_company_name')} /></Field>
          <Field label="Tax / NTN number"><Input {...st.input('invoice_tax_id')} /></Field>
          <Field label="Phone"><Input {...st.input('invoice_company_phone')} /></Field>
          <Field label="E-mail"><Input {...st.input('invoice_company_email')} /></Field>
          <Field label="Address" className="sm:col-span-2"><Textarea {...st.input('invoice_company_address')} rows={2} /></Field>
          <Field label="Invoice logo" hint="PNG or JPG (used in the PDF too)"><ImageUpload value={st.s.invoice_logo} onChange={(v) => st.set('invoice_logo', v)} accept="image/png,image/jpeg" /></Field>
          <Field label="Bank / payment details"><Textarea {...st.input('invoice_bank_details')} rows={5} placeholder={'Bank: ...\nAccount title: ...\nIBAN: ...\nJazzCash: ...'} /></Field>
          <Field label="Default notes" className="sm:col-span-2"><Textarea {...st.input('invoice_notes')} rows={2} /></Field>
          <Field label="Default terms & conditions" className="sm:col-span-2"><Textarea {...st.input('invoice_terms')} rows={3} /></Field>
          <Field label="Footer text" className="sm:col-span-2"><Input {...st.input('invoice_footer')} /></Field>
        </CardBody>
      </Card>
      <SaveBar onSave={() => st.save(keys)} saving={st.saving} />
    </div>
  );
}

/* ------------------------------------------------------ Front CMS settings */
export function FrontSettings() {
  const st = useSettings();
  const { settings } = useAuth();
  if (!st.s) return <Skeleton className="h-[600px] rounded-2xl" />;
  const keys = ['front_theme', 'home_title', 'home_sub_text', 'home_image', 'banner_enable', 'banner_title', 'banner_description', 'banner_url', 'banner_button', 'mobile_app_play_store_url', 'mobile_app_app_store_url', 'facebook_url', 'twitter_url', 'instagram_url', 'linkedin_url', 'home_whatsapp_number', 'newsletter_popup_enable', 'business_directory_enable', 'front_blog_enable', 'home_custom_css'];
  return (
    <>
      <PageHeader title="Front Settings" description="Control the look and content of the public website.">
        <ButtonLink href={`${settings.app_url || ''}/`} target="_blank" rel="noreferrer" variant="outline"><ExternalLink />View website</ButtonLink>
      </PageHeader>
      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader icon={Palette} title="Theme" description="Choose the website appearance" />
          <CardBody className="grid grid-cols-2 gap-4">
            {[['1', 'Light', Sun, 'bg-white', 'bg-zinc-100'], ['2', 'Dark', Moon, 'bg-zinc-900', 'bg-zinc-800']].map(([v, l, I, bg, bar]) => {
              const on = st.s.front_theme === v;
              return (
                <button key={v} type="button" onClick={() => st.set('front_theme', v)} className={cn('relative cursor-pointer rounded-2xl border-2 p-2 text-left transition', on ? 'border-primary shadow-glow' : 'border-border hover:border-primary/40')}>
                  <div className={`h-28 overflow-hidden rounded-xl border border-border ${bg} p-3`}>
                    <div className={`h-2.5 w-1/3 rounded ${bar}`} /><div className="mt-3 h-4 w-3/4 rounded bg-linear-to-r from-violet-500 to-fuchsia-500" /><div className={`mt-2 h-2 w-1/2 rounded ${bar}`} />
                    <div className="mt-3 flex gap-1.5"><div className="h-5 w-12 rounded bg-violet-500" /><div className={`h-5 w-12 rounded ${bar}`} /></div>
                  </div>
                  <p className="mt-2 flex items-center gap-2 px-1 text-sm font-medium"><I className="size-4" />{l}</p>
                </button>
              );
            })}
          </CardBody>
        </Card>
        <Card>
          <CardHeader icon={Megaphone} title="Homepage banner" description="A popup shown once per visit" />
          <CardBody className="space-y-4">
            <SwitchRow title="Show banner" {...st.flag('banner_enable')} />
            <Field label="Title"><Input {...st.input('banner_title')} /></Field>
            <Field label="Description"><Textarea {...st.input('banner_description')} rows={2} /></Field>
            <div className="grid gap-4 sm:grid-cols-2"><Field label="Button URL"><Input {...st.input('banner_url')} /></Field><Field label="Button text"><Input {...st.input('banner_button')} /></Field></div>
          </CardBody>
        </Card>
        <Card>
          <CardHeader icon={Home} title="Hero section" />
          <CardBody className="space-y-4">
            <Field label="Headline"><Input {...st.input('home_title')} /></Field>
            <Field label="Sub text"><Textarea {...st.input('home_sub_text')} rows={3} /></Field>
            <Field label="Hero image" hint="Optional. A live vCard phone is shown when empty."><ImageUpload value={st.s.home_image} onChange={(v) => st.set('home_image', v)} /></Field>
          </CardBody>
        </Card>
        <div className="space-y-6">
          <Card>
            <CardHeader icon={Smartphone} title="Mobile app download URLs" />
            <CardBody className="grid gap-4 sm:grid-cols-2">
              <Field label="Google Play"><Input {...st.input('mobile_app_play_store_url')} type="url" placeholder="https://play.google.com/..." /></Field>
              <Field label="App Store"><Input {...st.input('mobile_app_app_store_url')} type="url" placeholder="https://apps.apple.com/..." /></Field>
            </CardBody>
          </Card>
          <Card>
            <CardHeader icon={Share2} title="Social links" />
            <CardBody className="grid gap-4 sm:grid-cols-2">
              {['facebook', 'twitter', 'instagram', 'linkedin'].map((k) => <Field key={k} label={k[0].toUpperCase() + k.slice(1)}><Input {...st.input(`${k}_url`)} type="url" placeholder="https://" /></Field>)}
            </CardBody>
          </Card>
        </div>
        <Card>
          <CardHeader icon={MessageCircle} title="Website extras" />
          <CardBody className="space-y-4">
            <Field label="WhatsApp chat number" hint="With country code, digits only. Shows a floating chat button."><Input {...st.input('home_whatsapp_number')} placeholder="447700900123" /></Field>
            <SwitchRow title="Newsletter popup" description="Invite visitors to subscribe after a few seconds" {...st.flag('newsletter_popup_enable')} />
            <SwitchRow title="Business directory" description="Public /directory page listing vCards and stores that opted in" {...st.flag('business_directory_enable')} />
            <SwitchRow title="Blog" description="Show the blog on the website" {...st.flag('front_blog_enable')} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader icon={Code2} title="Custom CSS" description="Extra styles for the public website" />
          <CardBody><Textarea {...st.input('home_custom_css')} rows={10} className="font-mono text-xs" placeholder=".hero h1 { letter-spacing: -0.04em; }" /></CardBody>
        </Card>
      </div>
      <SaveBar onSave={() => st.save(keys)} saving={st.saving} />
    </>
  );
}
