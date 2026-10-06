import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowRight, Eye, EyeOff, Lock, Mail, User, CheckCircle2, ShieldCheck, Nfc, QrCode, Share2, Phone, Sparkles, KeyRound, MailCheck } from 'lucide-react';
import api from '@/lib/api';
import { useAuth, homeFor } from '@/lib/auth';
import Logo from '@/components/Logo';
import { recaptchaToken, googleEnabled, renderGoogleButton } from '@/lib/thirdparty';
import { Button, Input, Field, Checkbox, Ripples, Aurora } from '@/components/ui';

/* ------------------------------------------------------------- showcase */
const CARDS = [
  { name: 'Sarah Chen', role: 'Product Designer', grad: 'from-fuchsia-500 to-violet-600', initials: 'SC' },
  { name: 'Omar Farooq', role: 'Real Estate Advisor', grad: 'from-emerald-500 to-teal-600', initials: 'OF' },
  { name: 'Dr. Lena Park', role: 'Dentist', grad: 'from-sky-500 to-indigo-600', initials: 'LP' },
];
function MiniCard({ c, className, delay }) {
  return (
    <motion.div initial={{ opacity: 0, y: 40, rotate: 0 }} animate={{ opacity: 1, y: 0 }} transition={{ delay, duration: 0.9, ease: [0.16, 1, 0.3, 1] }} className={className}>
      <div className="animate-float w-60 rounded-3xl border border-white/15 bg-white/10 p-4 shadow-2xl backdrop-blur-xl" style={{ animationDelay: `${delay * 2}s` }}>
        <div className={`h-16 rounded-2xl bg-linear-to-br ${c.grad}`} />
        <div className="-mt-7 ml-3 grid size-14 place-items-center rounded-2xl border-4 border-zinc-900/40 bg-white font-display text-lg font-bold text-zinc-900">{c.initials}</div>
        <p className="mt-2 font-display font-semibold text-white">{c.name}</p>
        <p className="text-xs text-white/60">{c.role}</p>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {[Phone, Mail, Share2].map((I, i) => <span key={i} className="grid h-9 place-items-center rounded-xl bg-white/10 text-white/80"><I className="size-4" /></span>)}
        </div>
      </div>
    </motion.div>
  );
}

function Showcase() {
  return (
    <div className="relative hidden overflow-hidden bg-zinc-950 lg:flex lg:flex-col">
      <Aurora />
      <div className="bg-grid mask-radial absolute inset-0 opacity-40" />
      <div className="relative flex flex-1 items-center justify-center">
        <div className="relative size-[460px] scale-[.8] xl:scale-100">
          <div className="absolute top-1/2 left-1/2 size-40 -translate-x-1/2 -translate-y-1/2"><Ripples color="bg-violet-400/20" /></div>
          <div className="absolute top-1/2 left-1/2 grid size-20 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-linear-to-br from-violet-500 to-fuchsia-500 shadow-[0_0_60px_-5px] shadow-violet-500"><Nfc className="size-9 text-white" /></div>
          <MiniCard c={CARDS[0]} delay={0.2} className="absolute top-0 left-0 -rotate-6" />
          <MiniCard c={CARDS[1]} delay={0.35} className="absolute top-16 right-0 rotate-6" />
          <MiniCard c={CARDS[2]} delay={0.5} className="absolute bottom-0 left-16 rotate-2" />
        </div>
      </div>
      <div className="relative space-y-4 p-10">
        <div className="flex flex-wrap gap-2">
          {[[Nfc, 'NFC tap'], [QrCode, 'QR code'], [Share2, 'Share link'], [ShieldCheck, 'Secure']].map(([I, t]) => (
            <span key={t} className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70"><I className="size-3.5" />{t}</span>
          ))}
        </div>
        <p className="max-w-md font-display text-2xl leading-snug font-semibold text-white">&ldquo;Your whole professional identity, one tap away.&rdquo;</p>
      </div>
    </div>
  );
}

function Shell({ title, subtitle, children, footer }) {
  useEffect(() => { document.title = title; }, [title]);
  return (
    <div className="grid min-h-screen lg:grid-cols-[1fr_1.05fr]">
      <div className="relative flex flex-col px-6 py-8 sm:px-12 lg:px-16">
        <Link to="/" className="w-fit"><Logo /></Link>
        <div className="flex flex-1 items-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }} className="mx-auto w-full max-w-sm py-10">
            <h1 className="font-display text-3xl font-bold tracking-tight">{title}</h1>
            <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>
            <div className="mt-8">{children}</div>
            {footer && <div className="mt-8 text-center text-sm text-muted-foreground">{footer}</div>}
          </motion.div>
        </div>
        <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} InfyVCards · <Link to="/privacy-policy" className="hover:text-foreground">Privacy</Link> · <Link to="/terms-conditions" className="hover:text-foreground">Terms</Link></p>
      </div>
      <Showcase />
    </div>
  );
}

function PasswordInput({ value, onChange, id, placeholder = '••••••••', invalid, autoComplete = 'current-password' }) {
  const [show, setShow] = useState(false);
  return (
    <Input id={id} icon={Lock} type={show ? 'text' : 'password'} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-invalid={invalid || undefined} autoComplete={autoComplete}
      suffix={<button type="button" onClick={() => setShow(!show)} className="grid size-8 cursor-pointer place-items-center rounded-lg text-muted-foreground hover:bg-muted" aria-label="Show password">{show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button>} />
  );
}

const Alert = ({ tone = 'danger', children }) => (
  <AnimatePresence>
    {children && (
      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
        <div className={`mb-5 rounded-xl px-4 py-3 text-sm ${tone === 'danger' ? 'bg-danger-soft text-danger' : 'bg-success-soft text-success'}`}>{children}</div>
      </motion.div>
    )}
  </AnimatePresence>
);

function GoogleSignIn({ text, referral, onError }) {
  const { settings, setUser } = useAuth();
  const navigate = useNavigate();
  const ref = useRef(null);
  const [challenge, setChallenge] = useState(null);
  useEffect(() => {
    if (!googleEnabled(settings)) return;
    renderGoogleButton(ref.current, settings, async (credential) => {
      try {
        const { data } = await api.post('/auth/google', { credential, referral });
        if (data.two_factor) return setChallenge({ id: data.challenge, method: data.method, hint: data.email_hint });
        setUser(data.user); navigate(afterLogin(data.user));
      } catch (ex) { onError?.(ex.message); }
    }, text).catch(() => {});
  }, [settings.google_client_id]); // eslint-disable-line
  if (!googleEnabled(settings)) return null;
  if (challenge) return <TwoFactorStep challenge={challenge.id} method={challenge.method} hint={challenge.hint} onBack={() => setChallenge(null)} />;
  return (
    <div className="mt-6">
      <div className="relative mb-6 text-center text-xs text-muted-foreground"><span className="absolute inset-x-0 top-1/2 h-px bg-border" /><span className="relative bg-background px-3">or continue with</span></div>
      <div ref={ref} className="flex min-h-11 justify-center" />
    </div>
  );
}

function TwoFactorStep({ challenge, method = 'totp', hint, onBack }) {
  const { setUser } = useAuth();
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [recovery, setRecovery] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(0);
  const email = method === 'email';
  const resend = async () => { try { await api.post('/auth/two-factor/resend', { challenge }); setSent(Date.now()); setErr(''); } catch (ex) { setErr(ex.message); } };
  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setErr('');
    try { const { data } = await api.post('/auth/two-factor', { challenge, code }); setUser(data.user); navigate(afterLogin(data.user)); } catch (ex) { setErr(ex.errors?.code || ex.message); setBusy(false); }
  };
  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
      <div className="mb-6 flex items-center gap-3 rounded-2xl bg-primary-soft p-4 text-sm text-primary">{email ? <Mail className="size-5 shrink-0" /> : <ShieldCheck className="size-5 shrink-0" />}{email ? `We e-mailed a 6-digit sign-in code to ${hint || 'your address'}. It expires in 10 minutes.` : recovery ? 'Enter one of your saved recovery codes.' : 'Enter the 6-digit code from your authenticator app.'}</div>
      <Alert>{err}</Alert>
      <form onSubmit={submit} noValidate className="space-y-5">
        <Field label={email ? 'Code from your e-mail' : recovery ? 'Recovery code' : 'Authentication code'} htmlFor="otp">
          {recovery
            ? <Input id="otp" icon={KeyRound} value={code} onChange={(e) => setCode(e.target.value.trim())} placeholder="xxxxx-xxxxx" autoComplete="off" autoFocus />
            : <Input id="otp" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" placeholder="123456" className="text-center font-mono text-lg tracking-[0.5em]" autoFocus />}
        </Field>
        <Button type="submit" size="lg" className="w-full" loading={busy} disabled={recovery ? code.length < 8 : code.length !== 6}>Verify <ArrowRight /></Button>
      </form>
      <div className="mt-5 flex justify-between text-sm">
        {email
          ? <button type="button" onClick={resend} disabled={Date.now() - sent < 30000} className="cursor-pointer font-medium text-primary hover:underline disabled:cursor-default disabled:opacity-50">{sent ? 'Code sent again' : 'Send a new code'}</button>
          : <button type="button" onClick={() => { setRecovery(!recovery); setCode(''); setErr(''); }} className="cursor-pointer font-medium text-primary hover:underline">{recovery ? 'Use authenticator code' : 'Use a recovery code'}</button>}
        <button type="button" onClick={onBack} className="cursor-pointer text-muted-foreground hover:text-foreground">Back</button>
      </div>
    </motion.div>
  );
}

const safeRedirect = () => { const r = new URLSearchParams(window.location.search).get('redirect') || ''; return /^\/(?!\/)[\w\-/?=&.%]*$/.test(r) ? r : null; };
const afterLogin = (u) => (u.role === 'user' && safeRedirect()) || homeFor(u);

export function Login() {
  const { user, loading, setUser, settings } = useAuth();
  const navigate = useNavigate();
  const [f, setF] = useState({ email: '', password: '' });
  const [err, setErr] = useState({ message: '', errors: {} });
  const [busy, setBusy] = useState(false);
  const [challenge, setChallenge] = useState(null);
  const [unverified, setUnverified] = useState(false);
  useEffect(() => { if (!loading && user) navigate(afterLogin(user), { replace: true }); }, [user, loading]); // eslint-disable-line
  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setUnverified(false);
    try {
      const { data } = await api.post('/auth/login', f);
      if (data.two_factor) { setChallenge({ id: data.challenge, method: data.method, hint: data.email_hint }); setBusy(false); return; }
      setUser(data.user); navigate(afterLogin(data.user));
    } catch (ex) { setErr({ message: ex.message, errors: ex.errors }); setUnverified(/verif/i.test(ex.message)); setBusy(false); }
  };
  const resend = async () => { try { const { data } = await api.post('/auth/resend-verification', { email: f.email }); setErr({ message: '', errors: {} }); setUnverified(false); setOk(data.message); } catch (ex) { setErr({ message: ex.message, errors: ex.errors || {} }); } };
  const [ok, setOk] = useState('');
  if (challenge) return <Shell title="Two-step verification" subtitle="One more step to keep your account safe."><TwoFactorStep challenge={challenge.id} method={challenge.method} hint={challenge.hint} onBack={() => setChallenge(null)} /></Shell>;
  return (
    <Shell title="Welcome back" subtitle="Sign in to manage your digital business cards."
      footer={settings.register_enable !== '0' && <>Don&apos;t have an account? <Link to="/register" className="font-medium text-primary hover:underline">Create one free</Link></>}>
      <Alert tone="success">{ok}</Alert>
      <Alert>{err.message !== 'Validation failed' && err.message && <>{err.message}{unverified && f.email && <button type="button" onClick={resend} className="ml-1 cursor-pointer font-semibold underline">Resend link</button>}</>}</Alert>
      <form onSubmit={submit} noValidate className="space-y-5">
        <Field label="E-mail" htmlFor="email" error={err.errors.email}>
          <Input id="email" icon={Mail} type="email" autoComplete="username" placeholder="you@company.com" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} aria-invalid={!!err.errors.email || undefined} />
        </Field>
        <Field label={<span className="flex w-full justify-between">Password <Link to="/forgot-password" className="text-xs font-medium text-primary hover:underline">Forgot password?</Link></span>} htmlFor="pw" error={err.errors.password}>
          <PasswordInput id="pw" value={f.password} onChange={(v) => setF({ ...f, password: v })} invalid={!!err.errors.password} />
        </Field>
        <Button type="submit" size="lg" className="w-full" loading={busy}>Sign in <ArrowRight /></Button>
      </form>
      <GoogleSignIn onError={(m) => setErr({ message: m, errors: {} })} />
    </Shell>
  );
}

export function Register() {
  const [params] = useSearchParams();
  const { setUser, settings } = useAuth();
  const navigate = useNavigate();
  const [f, setF] = useState({ first_name: '', last_name: '', email: '', contact: '', password: '', password_confirmation: '', terms: false, referral: params.get('ref') || '' });
  const [done, setDone] = useState('');
  const [err, setErr] = useState({ message: '', errors: {} });
  const [busy, setBusy] = useState(false);
  const set = (k, v) => { setF((x) => ({ ...x, [k]: v })); setErr((e) => ({ ...e, errors: { ...e.errors, [k]: undefined } })); };
  const submit = async (e) => {
    e.preventDefault(); setBusy(true);
    try {
      const { data } = await api.post('/auth/register', { ...f, recaptcha_token: await recaptchaToken(settings, 'register') });
      if (data.verify) { setDone(data.message); setBusy(false); return; }
      setUser(data.user); navigate('/user/dashboard');
    } catch (ex) { setErr({ message: ex.message, errors: ex.errors }); setBusy(false); }
  };
  if (settings.register_enable === '0') return <Shell title="Registration closed" subtitle="New sign-ups are currently disabled."><Link to="/login" className="text-primary">Back to sign in</Link></Shell>;
  if (done) return (
    <Shell title="Check your inbox" subtitle={f.email}>
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="rounded-3xl border border-border p-6 text-center">
        <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-success-soft text-success"><MailCheck className="size-7" /></span>
        <p className="mt-4 text-sm text-muted-foreground">{done}</p>
        <Link to="/login" className="mt-5 inline-flex text-sm font-medium text-primary hover:underline">Go to sign in</Link>
      </motion.div>
    </Shell>
  );
  const strength = [/.{8,}/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter((r) => r.test(f.password)).length;
  return (
    <Shell title="Create your account" subtitle="Your first digital card is ready in under a minute." footer={<>Already have an account? <Link to="/login" className="font-medium text-primary hover:underline">Sign in</Link></>}>
      <Alert>{err.message !== 'Validation failed' && err.message}</Alert>
      <form onSubmit={submit} noValidate className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="First name" htmlFor="fn" error={err.errors.first_name}><Input id="fn" icon={User} value={f.first_name} onChange={(e) => set('first_name', e.target.value)} aria-invalid={!!err.errors.first_name || undefined} /></Field>
          <Field label="Last name" htmlFor="ln" error={err.errors.last_name}><Input id="ln" value={f.last_name} onChange={(e) => set('last_name', e.target.value)} aria-invalid={!!err.errors.last_name || undefined} /></Field>
        </div>
        <Field label="E-mail" htmlFor="em" error={err.errors.email}><Input id="em" icon={Mail} type="email" value={f.email} onChange={(e) => set('email', e.target.value)} placeholder="you@company.com" aria-invalid={!!err.errors.email || undefined} /></Field>
        <Field label="Phone (optional)" htmlFor="ph" error={err.errors.contact}><Input id="ph" icon={Phone} type="tel" value={f.contact} onChange={(e) => set('contact', e.target.value)} placeholder="+44 7700 900123" autoComplete="tel" /></Field>
        <Field label="Password" htmlFor="p1" error={err.errors.password}>
          <PasswordInput id="p1" value={f.password} onChange={(v) => set('password', v)} invalid={!!err.errors.password} autoComplete="new-password" />
          <div className="mt-2 flex gap-1">{[0, 1, 2, 3].map((i) => <motion.span key={i} animate={{ backgroundColor: i < strength ? ['#ef4444', '#f59e0b', '#84cc16', '#22c55e'][strength - 1] : 'var(--muted)' }} className="h-1 flex-1 rounded-full" />)}</div>
        </Field>
        <Field label="Confirm password" htmlFor="p2" error={err.errors.password_confirmation}><PasswordInput id="p2" value={f.password_confirmation} onChange={(v) => set('password_confirmation', v)} invalid={!!err.errors.password_confirmation} autoComplete="new-password" /></Field>
        <div>
          <Checkbox id="terms" checked={f.terms} onChange={(v) => set('terms', v)} label={<span className="text-muted-foreground">I agree to the <a href="/terms-conditions" target="_blank" className="text-primary hover:underline">Terms</a> and <a href="/privacy-policy" target="_blank" className="text-primary hover:underline">Privacy Policy</a></span>} />
          {err.errors.terms && <p className="mt-1.5 text-xs text-danger">{err.errors.terms}</p>}
        </div>
        <Button type="submit" size="lg" className="w-full" loading={busy}><Sparkles />Create account</Button>
        {settings.recaptcha_enable === '1' && <p className="text-center text-[11px] text-muted-foreground">Protected by reCAPTCHA. Google&apos;s Privacy Policy and Terms apply.</p>}
      </form>
      <GoogleSignIn text="signup_with" referral={f.referral} onError={(m) => setErr({ message: m, errors: {} })} />
    </Shell>
  );
}

export function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [msg, setMsg] = useState({});
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault(); setBusy(true);
    try { const { data } = await api.post('/auth/forgot-password', { email }); setMsg({ ok: data.message }); } catch (ex) { setMsg({ err: Object.values(ex.errors)[0] || ex.message }); } finally { setBusy(false); }
  };
  return (
    <Shell title="Forgot password?" subtitle="Enter your e-mail and we'll send you a secure reset link." footer={<Link to="/login" className="font-medium text-primary hover:underline">Back to sign in</Link>}>
      <Alert tone="success">{msg.ok && <span className="flex items-center gap-2"><CheckCircle2 className="size-4" />{msg.ok}</span>}</Alert>
      <Alert>{msg.err}</Alert>
      <form onSubmit={submit} noValidate className="space-y-5">
        <Field label="E-mail" htmlFor="fe"><Input id="fe" icon={Mail} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" /></Field>
        <Button type="submit" size="lg" className="w-full" loading={busy}>Send reset link</Button>
      </form>
    </Shell>
  );
}

export function ResetPassword() {
  const [params] = useSearchParams();
  const [f, setF] = useState({ password: '', password_confirmation: '' });
  const [msg, setMsg] = useState({ errors: {} });
  const submit = async (e) => {
    e.preventDefault();
    try { const { data } = await api.post('/auth/reset-password', { ...f, token: params.get('token'), email: params.get('email') }); setMsg({ ok: data.message, errors: {} }); } catch (ex) { setMsg({ err: ex.message === 'Validation failed' ? '' : ex.message, errors: ex.errors }); }
  };
  return (
    <Shell title="Set a new password" subtitle="Choose a strong password you don't use elsewhere." footer={<Link to="/login" className="font-medium text-primary hover:underline">Back to sign in</Link>}>
      <Alert tone="success">{msg.ok}</Alert><Alert>{msg.err}</Alert>
      <form onSubmit={submit} noValidate className="space-y-5">
        <Field label="New password" htmlFor="n1" error={msg.errors.password}><PasswordInput id="n1" value={f.password} onChange={(v) => setF({ ...f, password: v })} autoComplete="new-password" /></Field>
        <Field label="Confirm password" htmlFor="n2" error={msg.errors.password_confirmation}><PasswordInput id="n2" value={f.password_confirmation} onChange={(v) => setF({ ...f, password_confirmation: v })} autoComplete="new-password" /></Field>
        <Button type="submit" size="lg" className="w-full">Save password</Button>
      </form>
    </Shell>
  );
}

export function VerifyEmail() {
  const [params] = useSearchParams();
  const [state, setState] = useState({ busy: true });
  useEffect(() => {
    api.post('/auth/verify-email', { email: params.get('email'), token: params.get('token') })
      .then(({ data }) => setState({ ok: data.message }))
      .catch((ex) => setState({ err: ex.message === 'Validation failed' ? 'This verification link is incomplete.' : ex.message }));
  }, []); // eslint-disable-line
  return (
    <Shell title="E-mail verification" subtitle={params.get('email') || ''} footer={<Link to="/login" className="font-medium text-primary hover:underline">Go to sign in</Link>}>
      {state.busy ? <div className="skeleton h-24 rounded-3xl" /> : (
        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="rounded-3xl border border-border p-6 text-center">
          <span className={`mx-auto grid size-14 place-items-center rounded-2xl ${state.ok ? 'bg-success-soft text-success' : 'bg-danger-soft text-danger'}`}>{state.ok ? <CheckCircle2 className="size-7" /> : <MailCheck className="size-7" />}</span>
          <p className="mt-4 text-sm">{state.ok || state.err}</p>
        </motion.div>
      )}
    </Shell>
  );
}

export default Login;
