import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowRight, ArrowLeft, MailCheck, IdCard, Link2, Star } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api';
import { useAuth, homeFor } from '@/lib/auth';
import { Button, Input, Field } from '@/components/ui';
import { Shell } from './AuthPages';

const ICON = { vcard: IdCard, redirect: Link2, review: Star };
const ABOUT = {
  vcard: ['Create your digital business card', 'Add your details, confirm your e-mail, and this link becomes your card.'],
  redirect: ['Connect your link', 'Tell us where this link should open, then confirm your e-mail.'],
  review: ['Connect your Google reviews', 'Paste your business review link, then confirm your e-mail.'],
};
const STATE_TEXT = {
  active: ['This link is already in use', 'It has been connected to an e-mail. You can open it from the link you were given.'],
  paused: ['This link is paused', 'Its owner has paused it for now.'],
  expired: ['This link has expired', 'Its plan has ended. Please contact its owner or our support.'],
  details_pending: ['This link is being set up', 'Its new owner is adding the details. Please check back soon.'],
};

/** The page opened by the first scan / tap of an unclaimed link: add the details, confirm an e-mail with a code, and the link is yours. */
export default function ClaimLink() {
  const { code } = useParams();
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const [info, setInfo] = useState(null);
  const [missing, setMissing] = useState(false);
  const [step, setStep] = useState(0); // 0 details + e-mail, 1 the e-mailed code
  const [f, setF] = useState({ email: '', first_name: '', last_name: '', job_title: '', company: '', phone: '', url: '', code: '' });
  const [err, setErr] = useState({});
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => { setF((x) => ({ ...x, [k]: e.target.value })); setErr((x) => ({ ...x, [k]: undefined })); };
  useEffect(() => { api.get(`/public/links/${code}`).then(({ data }) => { setInfo(data.data); if (data.data.preset_url) setF((x) => ({ ...x, url: data.data.preset_url })); }).catch(() => setMissing(true)); }, [code]);

  const fail = (e) => { setErr(e.errors || {}); toast.error(e.errors ? Object.values(e.errors)[0] : e.message); };
  const details = () => (info.kind === 'vcard' ? { first_name: f.first_name, last_name: f.last_name, job_title: f.job_title, company: f.company, phone: f.phone } : { url: f.url });
  const send = async () => {
    const bad = {};
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(f.email)) bad.email = 'Enter a valid e-mail address';
    if (info.kind === 'vcard' && !f.first_name.trim()) bad.first_name = 'Enter your first name';
    if (info.kind !== 'vcard' && !f.url.trim()) bad.url = info.kind === 'review' ? 'Paste the Google review link' : 'Enter the web address';
    if (Object.keys(bad).length) { setErr(bad); toast.error(Object.values(bad)[0]); return; }
    setBusy(true);
    try { await api.post(`/public/links/${code}/claim/start`, { email: f.email }); setStep(1); toast.success('We e-mailed you a code'); } catch (e) { fail(e); } finally { setBusy(false); }
  };
  const verify = async () => {
    setBusy(true);
    try {
      const { data } = await api.post(`/public/links/${code}/claim/verify`, { email: f.email, code: f.code, details: details() });
      setUser(data.user); toast.success(data.message); navigate(homeFor(data.user), { replace: true });
    } catch (e) { fail(e); if (e.errors && !e.errors.code) setStep(0); } finally { setBusy(false); }
  };

  if (missing) return <Shell title="Link not found" subtitle="This link does not exist. Check the address and try again."><Link to="/" className="text-sm font-medium text-primary hover:underline">Go to the home page</Link></Shell>;
  if (!info) return <Shell title="One moment..." subtitle=" "><div className="h-24" /></Shell>;
  if (info.state !== 'unclaimed') {
    const [t, d] = STATE_TEXT[info.state] || ['This link is not available', 'Please try again later.'];
    return <Shell title={t} subtitle={d}><Link to="/login" className="text-sm font-medium text-primary hover:underline">Sign in to manage your links</Link></Shell>;
  }
  const Icon = ICON[info.kind] || Link2;
  const [title, sub] = ABOUT[info.kind] || ABOUT.redirect;
  return (
    <Shell title={step ? 'Check your e-mail' : title} subtitle={step ? `We sent a 6-digit code to ${f.email}. Enter it to finish.` : sub}
      footer={<>Already have links? <Link to="/login" className="font-medium text-primary hover:underline">Sign in</Link></>}>
      {step === 0 ? (
        <form onSubmit={(e) => { e.preventDefault(); send(); }} noValidate className="space-y-4">
          <div className="flex items-center gap-3 rounded-2xl bg-primary-soft px-4 py-3 text-sm"><Icon className="size-5 text-primary" /><span><b>{info.kind_label}</b>{info.plan ? <span className="text-muted-foreground"> · {info.plan} plan</span> : null}</span></div>
          {info.kind === 'vcard' ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Field label="First name" required error={err.first_name}><Input value={f.first_name} onChange={set('first_name')} autoFocus autoComplete="given-name" /></Field>
                <Field label="Last name" error={err.last_name}><Input value={f.last_name} onChange={set('last_name')} autoComplete="family-name" /></Field>
              </div>
              <Field label="Job title" error={err.job_title}><Input value={f.job_title} onChange={set('job_title')} placeholder="e.g. Dentist" /></Field>
              <Field label="Company" error={err.company}><Input value={f.company} onChange={set('company')} /></Field>
              <Field label="Phone" error={err.phone}><Input value={f.phone} onChange={set('phone')} inputMode="tel" placeholder="03001234567" /></Field>
            </>
          ) : (
            <Field label={info.kind === 'review' ? 'Google review link' : 'Where should this link open?'} required error={err.url} hint={info.kind === 'review' ? 'Open your business on Google and copy its "Get more reviews" link.' : 'You can change it later.'}>
              <Input value={f.url} onChange={set('url')} placeholder="https://" autoFocus inputMode="url" />
            </Field>
          )}
          <Field label="Your e-mail" required error={err.email} hint="This link will belong to this e-mail. We send a code to confirm it."><Input type="email" value={f.email} onChange={set('email')} placeholder="you@example.com" autoComplete="email" /></Field>
          <Button type="submit" size="lg" className="w-full" loading={busy}>Send me a code <ArrowRight /></Button>
        </form>
      ) : (
        <form onSubmit={(e) => { e.preventDefault(); verify(); }} noValidate className="space-y-4">
          <Field label="6-digit code" error={err.code}><Input value={f.code} onChange={set('code')} inputMode="numeric" autoComplete="one-time-code" maxLength={6} autoFocus className="text-center text-2xl tracking-[0.4em]" icon={MailCheck} /></Field>
          <Button type="submit" size="lg" className="w-full" loading={busy} disabled={f.code.length < 6}>Confirm and connect <ArrowRight /></Button>
          <div className="flex justify-between text-sm">
            <button type="button" onClick={() => setStep(0)} className="inline-flex cursor-pointer items-center gap-1 text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" />Back</button>
            <button type="button" onClick={send} className="cursor-pointer font-medium text-primary hover:underline">Send a new code</button>
          </div>
        </form>
      )}
    </Shell>
  );
}
