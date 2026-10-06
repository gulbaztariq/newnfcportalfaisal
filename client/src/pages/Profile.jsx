import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Camera, User, KeyRound, Save, ShieldCheck, Lock } from 'lucide-react';
import api, { toFormData } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/cn';
import { fullName, label } from '@/lib/format';
import { PageHeader, Card, CardHeader, CardBody, CardFooter, Button, Field, Input, Avatar, Segmented, useForm, run } from '@/components/ui';
import TwoFactor from '@/components/TwoFactor';

export default function Profile() {
  const { user, setUser } = useAuth();
  // fields locked by the user's organisation
  const locks = new Set(user?.locked_fields || []);
  const orgLock = (k, text) => (locks.has(k) ? <span className="inline-flex items-center gap-1.5">{text}<Lock className="size-3 text-warning" aria-label="Locked by your organisation" /></span> : text);
  const [params, setParams] = useSearchParams();
  const tab = ['password', 'security'].includes(params.get('tab')) ? params.get('tab') : 'profile';
  const form = useForm({ first_name: user.first_name, last_name: user.last_name, email: user.email, contact: user.contact || '', region_code: user.region_code || '', avatar: null });
  const pw = useForm({ current_password: '', password: '', password_confirmation: '' });
  const [preview, setPreview] = useState(user.avatar);
  const [busy, setBusy] = useState(false);
  const saveProfile = async () => {
    setBusy(true);
    const v = { ...form.values }; if (!(v.avatar instanceof File)) delete v.avatar;
    try { const d = await run(api.put('/auth/profile', toFormData(v))); setUser(d.user); } catch (e) { form.setErrors(e.errors); } finally { setBusy(false); }
  };
  const savePassword = async () => {
    setBusy(true);
    try { await run(api.put('/auth/password', pw.values)); pw.setValues({ current_password: '', password: '', password_confirmation: '' }); } catch (e) { pw.setErrors(e.errors); } finally { setBusy(false); }
  };
  return (
    <>
      <PageHeader title="My profile" description="Manage your personal details and password." />
      <Card className="mb-6 overflow-hidden">
        <div className="relative h-32 bg-linear-to-r from-violet-600 via-fuchsia-600 to-orange-400"><div className="bg-grid absolute inset-0 opacity-25" /></div>
        <div className="flex flex-wrap items-end gap-5 px-6 pb-6">
          <label className={locks.has('profile_image') ? 'relative -mt-12' : 'group relative -mt-12 cursor-pointer'} title={locks.has('profile_image') ? 'Your photo is managed by your organisation' : undefined}>
            <Avatar src={preview} name={fullName(user)} size={96} className="border-4 border-card shadow-lift" />
            <span className="absolute inset-0 grid place-items-center rounded-full bg-zinc-950/50 text-white opacity-0 transition group-hover:opacity-100"><Camera className="size-6" /></span>
            <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" disabled={locks.has('profile_image')} onChange={(e) => { const f = e.target.files[0]; if (f) { form.set('avatar', f); setPreview(URL.createObjectURL(f)); } }} />
          </label>
          <div className="flex-1 pt-3"><h2 className="font-display text-xl font-bold">{fullName(user)}</h2><p className="text-sm text-muted-foreground">{user.email} · {label(user.role)}</p></div>
          <Segmented id="pt" value={tab} onChange={(v) => setParams(v === 'profile' ? {} : { tab: v })} options={[{ value: 'profile', label: 'Profile', icon: User }, { value: 'password', label: 'Password', icon: KeyRound }, { value: 'security', label: 'Security', icon: ShieldCheck }]} />
        </div>
      </Card>
      <AnimatePresence mode="wait">
        <motion.div key={tab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.25 }} className="max-w-3xl">
          {tab === 'security' ? <TwoFactor /> : tab === 'profile' ? (
            <Card>
              <CardHeader icon={User} title="Personal information" />
              <CardBody className="grid gap-4 sm:grid-cols-2">
                {[['first_name', 'First name'], ['last_name', 'Last name'], ['email', 'E-mail', 'email']].map(([k, l, type]) => (
                  <Field key={k} label={orgLock(k, l)} error={form.errors[k]}><Input {...form.input(k)} type={type || 'text'} disabled={locks.has(k)} /></Field>
                ))}
                <Field label={orgLock('phone', 'Phone')}><fieldset disabled={locks.has('phone')} className="flex gap-2"><Input className="w-20" placeholder="+1" value={form.values.region_code} onChange={(e) => form.set('region_code', e.target.value.replace(/\D/g, ''))} /><Input {...form.input('contact')} className="flex-1" /></fieldset></Field>
                {form.values.avatar instanceof File && <p className="text-xs text-primary sm:col-span-2">New photo selected - save to apply.</p>}
              </CardBody>
              <CardFooter><Button onClick={saveProfile} loading={busy}><Save />Save changes</Button></CardFooter>
            </Card>
          ) : (
            <Card>
              <CardHeader icon={ShieldCheck} title="Change password" description="Changing your password signs you out on other devices." />
              <CardBody className="grid gap-4 sm:grid-cols-2">
                <Field label="Current password" error={pw.errors.current_password} className="sm:col-span-2"><Input {...pw.input('current_password')} type="password" autoComplete="current-password" /></Field>
                <Field label="New password" error={pw.errors.password} hint="At least 6 characters"><Input {...pw.input('password')} type="password" autoComplete="new-password" /></Field>
                <Field label="Confirm new password" error={pw.errors.password_confirmation}><Input {...pw.input('password_confirmation')} type="password" autoComplete="new-password" /></Field>
              </CardBody>
              <CardFooter><Button onClick={savePassword} loading={busy} className={cn()}><KeyRound />Update password</Button></CardFooter>
            </Card>
          )}
        </motion.div>
      </AnimatePresence>
    </>
  );
}
