/* Organisation portal: users (add, CSV import, roles, lock / block, password reset, per-field locks), announcements and the company profile */
import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import {
  Users, Plus, Building2, IdCard, UserCog, Trash2, Lock, LockOpen, Ban, KeyRound, Upload, Download, Megaphone, MoreHorizontal, Copy, Wand2,
  ShieldCheck, Globe, Mail, Phone, MapPin, FileSpreadsheet, CircleCheck, TriangleAlert, Pencil, Send, Search,
} from 'lucide-react';
import api, { toFormData } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/cn';
import { fmtDate, fmtDateTime, fullName } from '@/lib/format';
import {
  PageHeader, Card, CardHeader, CardBody, Button, ButtonLink, Field, Input, Textarea, Select, Switch, SwitchRow, Badge, StatusBadge, StatCard, EmptyState, Skeleton, Segmented, Dialog,
  TableCard, DataTable, UserCell, Avatar, ImageUpload, Menu, MenuTrigger, MenuContent, MenuItem, MenuSeparator, Tip, useForm, run, confirm,
} from '@/components/ui';
import PermissionMatrix from '@/components/PermissionMatrix';

const RichText = lazy(() => import('@/components/ui/RichText'));

const ROLE_LABEL = { member: 'Member', supervisor: 'Supervisor', manager: 'Manager' };
const ROLE_HINT = {
  member: 'Their own account and cards, inside your plan',
  supervisor: 'Works on the company account with the permissions below (usually view + leads)',
  manager: 'Works on the company account. With "Team members" access they add users, lock / block them, reset passwords and send announcements.',
};
const STATUS = {
  active: ['success', 'Active', CircleCheck],
  locked: ['warning', 'Locked', Lock],
  blocked: ['danger', 'Blocked', Ban],
};
// card fields the organisation edits per user (key, label, type)
const CARD_FIELDS = [
  ['first_name', 'First name'], ['last_name', 'Last name'], ['occupation', 'Occupation'], ['job_title', 'Job title'], ['company', 'Company'],
  ['email', 'E-mail', 'email'], ['phone', 'Phone'], ['alternative_email', 'Alternative e-mail', 'email'], ['alternative_phone', 'Alternative phone'],
  ['location', 'Address / location'], ['location_url', 'Google Maps link', 'url'], ['description', 'About', 'textarea'],
];
const OTHER_LOCKS = ['profile_image', 'cover_image', 'social_links', 'custom_links', 'name', 'url_alias', 'template_id', 'theme', 'manage_cards'];
const SAMPLE_CSV = 'first_name,last_name,email,phone,job_title,role,password\nAyesha,Khan,ayesha@company.com,3001234567,Sales Manager,member,\nBilal,Ahmed,bilal@company.com,,Designer,member,\n';

const randomPassword = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  const a = new Uint32Array(12); crypto.getRandomValues(a);
  return `${[...a].map((n) => chars[n % chars.length]).join('')}#${(a[0] % 90) + 10}`;
};
const copy = (text, what = 'Copied') => { navigator.clipboard?.writeText(text); toast.success(what); };
const csvCell = (v) => (/[",\n]/.test(String(v ?? '')) ? `"${String(v).replace(/"/g, '""')}"` : String(v ?? ''));
function download(name, text) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: name }); a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const credentialsCsv = (rows) => ['name,email,password,login_url', ...rows.map((r) => [r.name, r.email, r.password, `${window.location.origin}/login`].map(csvCell).join(','))].join('\n');

function StatusPill({ value }) {
  const [tone, text, Icon] = STATUS[value || 'active'];
  return <Badge tone={tone}><Icon className="size-3" />{text}</Badge>;
}

/** The plain password, shown once after it is created or reset */
function Credentials({ name, email, password }) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-success/30 bg-success-soft/60 p-4">
      <p className="flex items-center gap-2 text-sm font-semibold text-success"><CircleCheck className="size-4" />Login details for {name}</p>
      <p className="mt-1 text-xs text-muted-foreground">Keep these safe: the password is shown only once. You can reset it any time.</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {[['E-mail', email], ['Password', password]].map(([l, v]) => (
          <button key={l} type="button" onClick={() => copy(v, `${l} copied`)} className="group flex cursor-pointer items-center justify-between gap-2 rounded-xl border border-border bg-card px-3 py-2 text-left transition hover:border-primary">
            <span className="min-w-0"><span className="block text-[11px] text-muted-foreground">{l}</span><span className="block truncate font-mono text-sm">{v}</span></span>
            <Copy className="size-4 shrink-0 text-muted-foreground group-hover:text-primary" />
          </button>
        ))}
      </div>
    </motion.div>
  );
}

function PasswordInput({ value, onChange, error, required, hint = 'Leave empty to generate one' }) {
  return (
    <Field label="Password" required={required} error={error} hint={hint}>
      <div className="flex gap-2">
        <Input value={value} onChange={(e) => onChange(e.target.value)} autoComplete="new-password" className="flex-1 font-mono" placeholder="Auto-generate" />
        <Tip content="Generate a strong password"><Button type="button" variant="outline" size="icon" onClick={() => onChange(randomPassword())} aria-label="Generate password"><Wand2 /></Button></Tip>
      </div>
    </Field>
  );
}

/* ------------------------------------------------------------- add user */
const addBlank = { first_name: '', last_name: '', email: '', contact: '', job_title: '', password: '', company_role: 'member', permissions: null, notify: true };
function AddUser({ meta, onClose, onSaved }) {
  const form = useForm(addBlank);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);
  const roles = Object.entries(ROLE_LABEL).filter(([k]) => meta.is_owner || k !== 'manager');
  const save = async () => {
    setBusy(true);
    try {
      const b = { ...form.values };
      if (b.company_role === 'member') delete b.permissions; else b.permissions = b.permissions || meta.defaults[b.company_role];
      if (!b.password) delete b.password;
      const data = await run(api.post('/user/organisation/members', b));
      setDone({ name: fullName(data.data), email: data.data.email, password: data.password });
      onSaved();
    } catch (e) { form.setErrors(e.errors || {}); } finally { setBusy(false); }
  };
  const again = () => { setDone(null); form.setValues(addBlank); };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} size="lg" icon={UserCog} title="Add user" description="You keep the login details. Optionally they are e-mailed to the user too."
      footer={done ? <><Button variant="outline" onClick={again}><Plus />Add another</Button><Button onClick={onClose}>Done</Button></> : <><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={save} loading={busy}>Add user</Button></>}>
      {done ? <Credentials {...done} /> : (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="First name" required error={form.errors.first_name}><Input {...form.input('first_name')} /></Field>
          <Field label="Last name" error={form.errors.last_name}><Input {...form.input('last_name')} /></Field>
          <Field label="E-mail (login)" required error={form.errors.email}><Input {...form.input('email')} type="email" /></Field>
          <Field label="Phone"><Input {...form.input('contact')} /></Field>
          <Field label="Job title" hint="Shown on their card"><Input {...form.input('job_title')} /></Field>
          <PasswordInput value={form.values.password} onChange={(v) => form.set('password', v)} error={form.errors.password} />
          <Field label="Role" className="sm:col-span-2" hint={ROLE_HINT[form.values.company_role]}><Select value={form.values.company_role} onChange={(x) => { form.set('company_role', x); form.set('permissions', null); }} options={roles.map(([value, l]) => ({ value, label: l }))} /></Field>
          {form.values.company_role !== 'member' && <div className="sm:col-span-2"><PermissionMatrix modules={meta.modules} value={form.values.permissions || meta.defaults[form.values.company_role]} defaults={meta.defaults[form.values.company_role]} onChange={(p) => form.set('permissions', p)} /></div>}
          <SwitchRow className="sm:col-span-2" id="notify" title="E-mail the login details to the user" description="Turn off to share them yourself" checked={form.values.notify} onChange={(v) => form.set('notify', v)} />
        </div>
      )}
    </Dialog>
  );
}

/* ----------------------------------------------------------- CSV import */
export function ImportUsers({ meta, seatsLeft, onClose, onSaved, endpoint = '/user/organisation/members/import' }) {
  const [file, setFile] = useState(null);
  const [role, setRole] = useState('member');
  const [notify, setNotify] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const go = async () => {
    if (!file) return toast.error('Choose a CSV file');
    setBusy(true);
    try { setResult(await run(api.post(endpoint, { csv: await file.text(), default_role: role, notify }))); onSaved(); } catch { /* toast */ } finally { setBusy(false); }
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} size="lg" icon={FileSpreadsheet} title="Import users from CSV" description={`Add many users at once. ${seatsLeft} seat(s) left.`}
      footer={result ? <><Button variant="outline" onClick={() => { setResult(null); setFile(null); }}>Import another file</Button><Button onClick={onClose}>Done</Button></> : <><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={go} loading={busy} disabled={!file}><Upload />Import</Button></>}>
      {!result ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-muted/60 p-4 text-sm">
            <div><p className="font-medium">Columns</p><p className="text-xs text-muted-foreground"><code>first_name</code>, <code>email</code> required · <code>last_name</code>, <code>phone</code>, <code>job_title</code>, <code>role</code>, <code>password</code> optional</p></div>
            <Button size="sm" variant="outline" onClick={() => download('users-sample.csv', SAMPLE_CSV)}><Download />Sample file</Button>
          </div>
          <label className={cn('flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed p-8 text-center transition', file ? 'border-primary bg-primary-soft/40' : 'border-border hover:border-primary/60')}>
            <input type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => setFile(e.target.files?.[0] || null)} />
            <FileSpreadsheet className="size-8 text-primary" />
            <span className="text-sm font-medium">{file ? file.name : 'Choose a CSV file'}</span>
            <span className="text-xs text-muted-foreground">{file ? `${(file.size / 1024).toFixed(1)} KB` : 'Exported from Excel or Google Sheets ("Save as CSV")'}</span>
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Role when the file has none"><Select value={role} onChange={setRole} options={Object.entries(ROLE_LABEL).filter(([k]) => meta.is_owner || k !== 'manager').map(([value, l]) => ({ value, label: l }))} /></Field>
            <SwitchRow id="imp-notify" title="E-mail login details" description="Otherwise download them after the import" checked={notify} onChange={setNotify} />
          </div>
          <p className="text-xs text-muted-foreground">Rows without a password get a generated one. You get every login back as a file after the import.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-success-soft p-4"><p className="font-display text-3xl font-bold text-success">{result.created.length}</p><p className="text-sm text-success">users created</p></div>
            <div className={cn('rounded-2xl p-4', result.errors.length ? 'bg-warning-soft' : 'bg-muted')}><p className={cn('font-display text-3xl font-bold', result.errors.length ? 'text-warning' : 'text-muted-foreground')}>{result.errors.length}</p><p className="text-sm text-muted-foreground">rows skipped</p></div>
          </div>
          {result.created.length > 0 && <Button className="w-full" variant="soft" onClick={() => download(`user-logins-${new Date().toISOString().slice(0, 10)}.csv`, credentialsCsv(result.created))}><Download />Download login details ({result.created.length})</Button>}
          {result.errors.length > 0 && (
            <div className="max-h-56 space-y-1.5 overflow-y-auto rounded-2xl border border-border p-3">
              {result.errors.map((e, i) => <p key={i} className="flex gap-2 text-sm"><TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" /><span><b>Row {e.line}</b>{e.email ? ` (${e.email})` : ''}: {e.message}</span></p>)}
            </div>
          )}
        </div>
      )}
    </Dialog>
  );
}

/* ------------------------------------------------------- reset password */
function ResetPassword({ member, onClose }) {
  const [password, setPassword] = useState('');
  const [notify, setNotify] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);
  const [error, setError] = useState();
  const save = async () => {
    setBusy(true); setError();
    try { const d = await run(api.patch(`/user/organisation/members/${member.id}`, { password, notify })); setDone(d.password); } catch (e) { setError(e.errors?.password); } finally { setBusy(false); }
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} icon={KeyRound} title={`Reset password · ${fullName(member)}`} description="They are signed out everywhere and use the new password from now on."
      footer={done ? <Button onClick={onClose}>Done</Button> : <><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={save} loading={busy}><KeyRound />Reset password</Button></>}>
      {done ? <Credentials name={fullName(member)} email={member.email} password={done} /> : (
        <div className="space-y-4">
          <PasswordInput value={password} onChange={setPassword} error={error} />
          <SwitchRow id="rp-notify" title="E-mail the new password to the user" checked={notify} onChange={setNotify} />
        </div>
      )}
    </Dialog>
  );
}

/* -------------------------------------------------- role & permissions */
function MemberRole({ member, meta, onClose, onSaved }) {
  const [role, setRole] = useState(member.company_role || 'member');
  const [perm, setPerm] = useState(member.effective_permissions || null);
  const [busy, setBusy] = useState(false);
  const save = async () => { setBusy(true); try { await run(api.patch(`/user/organisation/members/${member.id}`, { company_role: role, ...(role !== 'member' ? { permissions: perm || meta.defaults[role] } : {}) })); onSaved(); } catch { /* toast */ } finally { setBusy(false); } };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} size="lg" icon={ShieldCheck} title={`${fullName(member)} · role`} description="Managers and supervisors sign in with their own login and work on the company account."
      footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={save} loading={busy}>Save</Button></>}>
      <div className="space-y-4">
        <Field label="Role" hint={ROLE_HINT[role]}><Select value={role} onChange={(x) => { setRole(x); setPerm(null); }} options={Object.entries(ROLE_LABEL).filter(([k]) => meta.is_owner || k !== 'manager').map(([value, l]) => ({ value, label: l }))} /></Field>
        {role !== 'member' && <PermissionMatrix modules={meta.modules} value={perm || meta.defaults[role]} defaults={meta.defaults[role]} onChange={setPerm} />}
      </div>
    </Dialog>
  );
}

/* ------------------------------------------------ details & field locks */
function LockToggle({ locked, onChange, label: l }) {
  return (
    <Tip content={locked ? `${l} is locked: the user cannot change it` : `Lock ${l.toLowerCase()}`}>
      <button type="button" onClick={() => onChange(!locked)} aria-pressed={locked} aria-label={`${locked ? 'Unlock' : 'Lock'} ${l}`}
        className={cn('inline-flex cursor-pointer items-center gap-1 rounded-lg px-2 py-0.5 text-[11px] font-medium transition', locked ? 'bg-warning-soft text-warning' : 'text-muted-foreground hover:bg-muted hover:text-foreground')}>
        {locked ? <Lock className="size-3" /> : <LockOpen className="size-3" />}{locked ? 'Locked' : 'Lock'}
      </button>
    </Tip>
  );
}

function MemberDetails({ member, onClose, onSaved }) {
  const [d, setD] = useState(null);
  const [cardId, setCardId] = useState(null);
  const [locks, setLocks] = useState([]);
  const [photo, setPhoto] = useState(null);
  const [busy, setBusy] = useState(false);
  const account = useForm({ first_name: '', last_name: '', email: '', contact: '', region_code: '' });
  const card = useForm({});
  useEffect(() => {
    api.get(`/user/organisation/members/${member.id}/details`).then(({ data }) => {
      setD(data); setLocks(data.data.locked_fields || []);
      account.setValues({ first_name: data.data.first_name || '', last_name: data.data.last_name || '', email: data.data.email || '', contact: data.data.contact || '', region_code: data.data.region_code || '' });
      if (data.vcards[0]) { setCardId(data.vcards[0].id); card.setValues(data.vcards[0]); setPhoto(data.vcards[0].profile_image || null); }
    }).catch(() => onClose());
  }, [member.id]); // eslint-disable-line
  const pickCard = (id) => { const c = d.vcards.find((x) => x.id === Number(id)); setCardId(c.id); card.setValues(c); setPhoto(c.profile_image || null); };
  const toggle = (k, on) => setLocks((l) => (on ? [...new Set([...l, k])] : l.filter((x) => x !== k)));
  const save = async () => {
    setBusy(true);
    try {
      const payload = { ...account.values, locked_fields: locks };
      if (cardId) { payload.vcard_id = cardId; payload.card = Object.fromEntries(['name', ...CARD_FIELDS.map(([k]) => k), 'region_code'].map((k) => [k, card.values[k] ?? ''])); }
      if (photo instanceof File) payload.profile_image = photo;
      await run(api.put(`/user/organisation/members/${member.id}/details`, toFormData(payload)));
      onSaved();
    } catch (e) { account.setErrors(e.errors || {}); card.setErrors(e.errors || {}); } finally { setBusy(false); }
  };
  const L = (k) => <LockToggle locked={locks.includes(k)} onChange={(on) => toggle(k, on)} label={d?.lockable?.[k] || k} />;
  // the required mark sits inside the label row (Field's own mark would wrap below the lock button)
  const labelWithLock = (text, k, required) => <span className="flex w-full items-center justify-between gap-2"><span>{text}{required && <span className="ml-0.5 text-danger">*</span>}</span>{L(k)}</span>;
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} size="xl" icon={Pencil} title={`${fullName(member)} · details & locks`} description="Edit their information and lock the fields they must not change. Locked fields are read-only for the user."
      footer={<><span className="mr-auto text-xs text-muted-foreground">{locks.length} field(s) locked</span><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={save} loading={busy} disabled={!d}>Save</Button></>}>
      {!d ? <div className="space-y-3"><Skeleton className="h-10" /><Skeleton className="h-40" /></div> : (
        <div className="space-y-6">
          <section>
            <h3 className="mb-3 text-sm font-semibold">Account</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={labelWithLock('First name', 'first_name', true)} error={account.errors.first_name}><Input {...account.input('first_name')} /></Field>
              <Field label={labelWithLock('Last name', 'last_name')}><Input {...account.input('last_name')} /></Field>
              <Field label={labelWithLock('E-mail (login)', 'email', true)} error={account.errors.email}><Input {...account.input('email')} type="email" /></Field>
              <Field label={labelWithLock('Phone', 'phone')}><div className="flex gap-2"><Input className="w-20" placeholder="+92" value={account.values.region_code} onChange={(e) => account.set('region_code', e.target.value.replace(/\D/g, ''))} /><Input {...account.input('contact')} className="flex-1" /></div></Field>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">A lock covers the field on the account and on all of the user&apos;s cards.</p>
          </section>
          <section>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold">Card</h3>
              {d.vcards.length > 1 && <Select className="w-64" value={cardId} onChange={pickCard} options={d.vcards.map((v) => ({ value: v.id, label: `${v.name} (/${v.url_alias})` }))} />}
            </div>
            {!cardId ? <EmptyState icon={IdCard} title="This user has no card yet" /> : (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={labelWithLock('Card name', 'name', true)} error={card.errors.name}><Input {...card.input('name')} /></Field>
                <Field label={labelWithLock('Profile photo', 'profile_image')}><ImageUpload value={photo} onChange={setPhoto} round /></Field>
                {CARD_FIELDS.filter(([k]) => !['first_name', 'last_name'].includes(k)).map(([k, l, type]) => (
                  <Field key={k} label={labelWithLock(l, k)} error={card.errors[k]} className={type === 'textarea' ? 'sm:col-span-2' : ''}>
                    {type === 'textarea' ? <Textarea {...card.input(k)} rows={3} />
                      : k === 'phone' ? <div className="flex gap-2"><Input className="w-20" placeholder="+92" value={card.values.region_code || ''} onChange={(e) => card.set('region_code', e.target.value.replace(/\D/g, ''))} /><Input {...card.input('phone')} className="flex-1" /></div>
                        : <Input {...card.input(k)} type={type || 'text'} />}
                  </Field>
                ))}
              </div>
            )}
          </section>
          <section>
            <h3 className="mb-3 text-sm font-semibold">Other locks</h3>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {OTHER_LOCKS.filter((k) => !['profile_image', 'name'].includes(k)).map((k) => (
                <label key={k} className={cn('flex cursor-pointer items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-sm transition', locks.includes(k) ? 'border-warning/40 bg-warning-soft/50' : 'border-border hover:bg-muted/50')}>
                  <span className="flex items-center gap-2">{locks.includes(k) ? <Lock className="size-3.5 text-warning" /> : <LockOpen className="size-3.5 text-muted-foreground" />}{d.lockable[k]}</span>
                  <Switch size="sm" checked={locks.includes(k)} onChange={(on) => toggle(k, on)} />
                </label>
              ))}
            </div>
          </section>
        </div>
      )}
    </Dialog>
  );
}

/* ---------------------------------------------------------- users table */
function UsersTab({ meta, reload, onAdd, onImport }) {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [dialog, setDialog] = useState(null); // [kind, member]
  const rows = useMemo(() => (meta.data || []).filter((m) => (!status || (m.org_status || 'active') === status) && (!q || `${fullName(m)} ${m.email}`.toLowerCase().includes(q.toLowerCase()))), [meta.data, q, status]);
  const counts = (meta.data || []).reduce((o, m) => ((o[m.org_status || 'active'] = (o[m.org_status || 'active'] || 0) + 1), o), {});
  const canTouch = (m) => meta.is_owner || m.company_role !== 'manager';
  const setStatusOf = async (m, next) => {
    const text = {
      locked: [`Lock ${fullName(m)}?`, 'They are signed out and cannot sign in or change anything. They see "contact your organisation administrator". Their cards stay online.', 'Lock'],
      blocked: [`Block ${fullName(m)}?`, 'They are signed out and cannot sign in, and their cards stop showing to visitors.', 'Block'],
      active: [`Unlock ${fullName(m)}?`, 'They can sign in again and their cards are shown again.', 'Unlock'],
    }[next];
    if (!(await confirm({ title: text[0], description: text[1], confirmText: text[2], tone: next === 'active' ? 'primary' : 'danger' }))) return;
    await run(api.patch(`/user/organisation/members/${m.id}`, { org_status: next })).catch(() => {});
    reload();
  };
  const remove = async (m) => { if (await confirm({ title: `Remove ${fullName(m)}?`, description: 'Their account and cards are deleted. This frees a seat.' })) { await run(api.delete(`/user/organisation/members/${m.id}`)).catch(() => {}); reload(); } };
  return (
    <>
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Users} label="Users" value={meta.data.length} hint={`of ${meta.limit} seats`} color="violet" />
        <StatCard icon={CircleCheck} label="Active" value={counts.active || 0} color="emerald" index={1} />
        <StatCard icon={Lock} label="Locked" value={counts.locked || 0} color="amber" index={2} />
        <StatCard icon={Ban} label="Blocked" value={counts.blocked || 0} color="rose" index={3} />
      </div>
      <TableCard title="Users" description="Everyone in your organisation. You hold their logins: reset passwords, lock or block them, and lock what they may edit." toolbar={<>
        <Segmented size="sm" id="org-st" value={status} onChange={setStatus} options={[{ value: '', label: 'All' }, { value: 'active', label: 'Active' }, { value: 'locked', label: 'Locked' }, { value: 'blocked', label: 'Blocked' }]} />
        <Input icon={Search} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or e-mail..." className="w-56" />
      </>}>
        <DataTable rows={rows} empty={<EmptyState icon={Users} title={meta.data.length ? 'No users match' : 'No users yet'} description={meta.data.length ? undefined : 'Add them one by one or import a CSV file.'} action={!meta.data.length && <div className="flex gap-2"><Button variant="outline" onClick={onImport}><Upload />Import CSV</Button><Button onClick={onAdd}><Plus />Add user</Button></div>} />} columns={[
          { key: 'u', label: 'User', render: (m) => <UserCell user={m} /> },
          { key: 'r', label: 'Role', render: (m) => <Badge tone={m.company_role === 'manager' ? 'primary' : m.company_role === 'supervisor' ? 'info' : 'neutral'}>{ROLE_LABEL[m.company_role] || 'Member'}</Badge> },
          { key: 's', label: 'Status', render: (m) => <StatusPill value={m.org_status} /> },
          { key: 'l', label: 'Locks', render: (m) => (m.locked_fields?.length ? <Tip content={m.locked_fields.map((k) => meta.lockable[k]).join(', ')}><span className="inline-flex items-center gap-1 text-sm text-warning"><Lock className="size-3.5" />{m.locked_fields.length}</span></Tip> : <span className="text-muted-foreground">-</span>) },
          { key: 'c', label: 'Cards', render: (m) => <span className="font-medium">{m.vcards_count}</span> },
          { key: 'll', label: 'Last login', render: (m) => <span className="text-muted-foreground">{m.last_login_at ? fmtDate(m.last_login_at) : 'Never'}</span> },
          {
            key: '_a', label: '', className: 'text-right', render: (m) => (canTouch(m) ? (
              <Menu>
                <MenuTrigger asChild><Button size="icon-sm" variant="ghost" aria-label={`Actions for ${fullName(m)}`}><MoreHorizontal /></Button></MenuTrigger>
                <MenuContent>
                  <MenuItem icon={Pencil} onSelect={() => setDialog(['details', m])}>Edit details & locks</MenuItem>
                  <MenuItem icon={KeyRound} onSelect={() => setDialog(['password', m])}>Reset password</MenuItem>
                  {meta.is_owner || m.company_role !== 'manager' ? <MenuItem icon={ShieldCheck} onSelect={() => setDialog(['role', m])}>Role & permissions</MenuItem> : null}
                  <MenuSeparator />
                  {(m.org_status || 'active') !== 'active' && <MenuItem icon={LockOpen} onSelect={() => setStatusOf(m, 'active')}>Unlock</MenuItem>}
                  {(m.org_status || 'active') !== 'locked' && <MenuItem icon={Lock} onSelect={() => setStatusOf(m, 'locked')}>Lock account</MenuItem>}
                  {(m.org_status || 'active') !== 'blocked' && <MenuItem icon={Ban} danger onSelect={() => setStatusOf(m, 'blocked')}>Block account & cards</MenuItem>}
                  <MenuSeparator />
                  <MenuItem icon={Trash2} danger onSelect={() => remove(m)}>Remove user</MenuItem>
                </MenuContent>
              </Menu>
            ) : <Tip content="Only the organisation owner can change managers"><Lock className="ml-auto size-4 text-muted-foreground" /></Tip>),
          },
        ]} />
      </TableCard>
      {dialog?.[0] === 'details' && <MemberDetails member={dialog[1]} onClose={() => setDialog(null)} onSaved={() => { setDialog(null); reload(); }} />}
      {dialog?.[0] === 'password' && <ResetPassword member={dialog[1]} onClose={() => { setDialog(null); reload(); }} />}
      {dialog?.[0] === 'role' && <MemberRole member={dialog[1]} meta={meta} onClose={() => setDialog(null)} onSaved={() => { setDialog(null); reload(); }} />}
    </>
  );
}

/* --------------------------------------------------------- announcements */
const ANN_TYPES = [['info', 'Information'], ['success', 'Good news'], ['warning', 'Important'], ['danger', 'Urgent'], ['promo', 'Event / offer']];
function AnnouncementsTab() {
  const [list, setList] = useState(null);
  const form = useForm({ title: '', body: '', type: 'info' });
  const [busy, setBusy] = useState(false);
  const load = () => api.get('/user/organisation/announcements').then(({ data }) => setList(data)).catch(() => setList({ data: [], members: 0 }));
  useEffect(() => { load(); }, []);
  const send = async () => {
    if (!(await confirm({ title: `Send to ${list?.members || 0} user(s)?`, description: 'It is e-mailed to every user and shown in their portal.', confirmText: 'Send', tone: 'primary' }))) return;
    setBusy(true);
    try { await run(api.post('/user/organisation/announcements', form.values)); form.setValues({ title: '', body: '', type: 'info' }); load(); } catch (e) { form.setErrors(e.errors || {}); } finally { setBusy(false); }
  };
  const remove = async (a) => { if (await confirm({ title: 'Delete this announcement?', description: 'It disappears from users’ portals. E-mails already sent stay in their inbox.' })) { await run(api.delete(`/user/organisation/announcements/${a.id}`)).catch(() => {}); load(); } };
  return (
    <div className="grid gap-6 xl:grid-cols-5">
      <Card className="xl:col-span-3">
        <CardHeader icon={Megaphone} title="New announcement" description="E-mailed to all of your users and shown in their portal" />
        <CardBody className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Subject" required error={form.errors.title} className="sm:col-span-2"><Input {...form.input('title')} placeholder="e.g. New business cards are ready" /></Field>
            <Field label="Type"><Select value={form.values.type} onChange={(v) => form.set('type', v)} options={ANN_TYPES.map(([value, l]) => ({ value, label: l }))} /></Field>
          </div>
          <Field label="Message" required error={form.errors.body}>
            <Suspense fallback={<Skeleton className="h-56 rounded-xl" />}><RichText value={form.values.body} onChange={(x) => form.set('body', x)} height={220} placeholder="Write your message..." /></Suspense>
          </Field>
          <div className="flex justify-end"><Button onClick={send} loading={busy} disabled={!form.values.title}><Send />Send to all users</Button></div>
        </CardBody>
      </Card>
      <Card className="h-fit xl:col-span-2">
        <CardHeader title="Sent" description={list ? `${list.data.length} announcement(s)` : ''} />
        <div className="divide-y divide-border">
          {!list ? <div className="space-y-3 p-5"><Skeleton className="h-12" /><Skeleton className="h-12" /></div>
            : !list.data.length ? <EmptyState icon={Megaphone} title="Nothing sent yet" />
              : list.data.map((a) => (
                <div key={a.id} className="group flex items-start gap-3 px-5 py-4">
                  <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary"><Megaphone className="size-4" /></span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{a.title}</p>
                    <p className="text-xs text-muted-foreground">{fmtDateTime(a.created_at)}{a.creator ? ` · by ${fullName(a.creator)}` : ''}</p>
                    <p className="mt-1 text-xs text-muted-foreground">Read by {a.reads} of {list.members}</p>
                  </div>
                  <Button size="icon-sm" variant="ghost" onClick={() => remove(a)} aria-label="Delete announcement" className="opacity-60 group-hover:opacity-100"><Trash2 /></Button>
                </div>
              ))}
        </div>
      </Card>
    </div>
  );
}

/* --------------------------------------------------------- company profile */
function CompanyTab({ org, seats, onSaved }) {
  const form = useForm({ name: org.name || '', website: org.website || '', email: org.email || '', phone: org.phone || '', address: org.address || '', city: org.city || '', country: org.country || '', logo: org.logo || null });
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    const v = { ...form.values };
    if (!(v.logo instanceof File)) { if (!v.logo && org.logo) v.remove_logo = '1'; delete v.logo; }
    try { await run(api.put('/user/organisation', toFormData(v))); onSaved(); } catch (e) { form.setErrors(e.errors || {}); } finally { setBusy(false); }
  };
  return (
    <Card>
      <CardHeader icon={Building2} title="Company profile" description="Your users see this; new users' cards start with these company details" />
      <CardBody className="grid gap-6 lg:grid-cols-[200px_1fr]">
        <div className="space-y-3">
          <ImageUpload value={form.values.logo} onChange={(v) => form.set('logo', v)} label="Company logo" hint="PNG, JPG or WEBP up to 2 MB" />
          <div className="rounded-2xl bg-muted/60 p-3 text-center"><p className="font-display text-2xl font-bold">{seats.used} / {seats.limit}</p><p className="text-xs text-muted-foreground">users · contact the administrator for more</p></div>
        </div>
        <div className="grid content-start gap-4 sm:grid-cols-2">
          <Field label="Company name" required error={form.errors.name} className="sm:col-span-2"><Input {...form.input('name')} /></Field>
          <Field label="Website / domain" error={form.errors.website}><Input {...form.input('website')} icon={Globe} placeholder="company.com" /></Field>
          <Field label="Business e-mail" error={form.errors.email}><Input {...form.input('email')} type="email" icon={Mail} /></Field>
          <Field label="Business phone" error={form.errors.phone}><Input {...form.input('phone')} icon={Phone} /></Field>
          <Field label="Business address" error={form.errors.address}><Input {...form.input('address')} icon={MapPin} /></Field>
          <Field label="City"><Input {...form.input('city')} /></Field>
          <Field label="Country"><Input {...form.input('country')} /></Field>
          <div className="flex justify-end sm:col-span-2"><Button onClick={save} loading={busy}>Save profile</Button></div>
        </div>
      </CardBody>
    </Card>
  );
}

function CardsTab() {
  const [cards, setCards] = useState(null);
  useEffect(() => { api.get('/user/organisation/vcards').then(({ data }) => setCards(data.data)).catch(() => setCards([])); }, []);
  return (
    <TableCard title="Users' cards">
      <DataTable loading={!cards} rows={cards || []} empty={<EmptyState icon={IdCard} title="No cards yet" />} columns={[
        { key: 'n', label: 'Card', render: (v) => <span className="font-medium">{v.name}</span> },
        { key: 'o', label: 'User', render: (v) => <span className="flex items-center gap-2">{fullName(v.user)}{v.user?.org_status && v.user.org_status !== 'active' && <StatusPill value={v.user.org_status} />}</span> },
        { key: 'l', label: 'Link', render: (v) => <a href={`/${v.url_alias}`} target="_blank" rel="noreferrer" className="text-primary hover:underline">/{v.url_alias}</a> },
        { key: 'v', label: 'Views', render: (v) => v.views },
        { key: 's', label: 'Status', render: (v) => <StatusBadge value={v.status && v.user?.org_status !== 'blocked' ? 'active' : 'inactive'} /> },
      ]} />
    </TableCard>
  );
}

/* ------------------------------------------------------------------ page */
export default function Organisation() {
  const { user, refresh } = useAuth();
  const inOrg = user.is_organisation || (user.organisation_id && ['manager', 'supervisor'].includes(user.company_role));
  const [meta, setMeta] = useState(null);
  const [org, setOrg] = useState(null);
  const [features, setFeatures] = useState(null);
  const [tab, setTab] = useState('users');
  const [dialog, setDialog] = useState(null);
  const load = () => {
    api.get('/user/organisation/members').then(({ data }) => setMeta(data)).catch(() => setMeta(false));
    api.get('/user/organisation').then(({ data }) => setOrg(data)).catch(() => {});
  };
  useEffect(() => { if (inOrg) load(); else api.get('/user/features').then(({ data }) => setFeatures(data.features)); }, []); // eslint-disable-line
  const enable = async () => { await run(api.post('/user/organisation/enable')).catch(() => {}); await refresh(); load(); };

  if (!inOrg) {
    return (
      <>
        <PageHeader title="Organisation" description="Manage digital cards for your whole team from one account." />
        <Card className="relative overflow-hidden p-10 text-center">
          <div className="absolute -top-20 left-1/2 size-80 -translate-x-1/2 rounded-full bg-primary/15 blur-3xl" />
          <Building2 className="relative mx-auto size-12 text-primary" />
          <h2 className="relative mt-4 font-display text-2xl font-bold">Turn your account into an organisation</h2>
          <p className="relative mx-auto mt-2 max-w-md text-muted-foreground">Add your team, give each one their own card, and keep everything consistent.</p>
          {features && !features.organisation ? <ButtonLink as={Link} to="/user/plans" className="relative mt-6">Upgrade to enable</ButtonLink> : <Button className="relative mt-6" size="lg" onClick={enable}><Building2 />Enable organisation</Button>}
        </Card>
      </>
    );
  }
  if (meta === false) return <EmptyState icon={Lock} title="You don't have access to the users of this organisation" />;
  if (!meta || !org) return <div className="space-y-4"><Skeleton className="h-28 rounded-3xl" /><Skeleton className="h-80 rounded-2xl" /></div>;
  const left = Math.max(0, meta.limit - meta.data.length);
  const full = left === 0;
  const tabs = [{ value: 'users', label: 'Users' }, { value: 'announcements', label: 'Announcements' }, { value: 'cards', label: 'Cards' }, ...(org.is_owner ? [{ value: 'company', label: 'Company' }] : [])];
  return (
    <>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="relative mb-6 overflow-hidden">
          <div className="absolute inset-0 bg-linear-to-br from-violet-600/10 via-fuchsia-500/5 to-transparent" />
          <div className="relative flex flex-wrap items-center gap-5 p-6">
            {org.data.logo ? <img src={org.data.logo} alt="" className="size-16 rounded-2xl border border-border bg-card object-contain p-1.5" /> : <Avatar name={org.data.name} size={64} />}
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium tracking-wide text-primary uppercase">Organisation</p>
              <h1 className="font-display text-2xl font-bold">{org.data.name}</h1>
              <div className="mt-2 flex max-w-sm items-center gap-3">
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted"><motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(100, (meta.data.length / Math.max(1, meta.limit)) * 100)}%` }} transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }} className={cn('h-full rounded-full', full ? 'bg-warning' : 'bg-linear-to-r from-violet-500 to-fuchsia-500')} /></div>
                <span className="text-sm whitespace-nowrap text-muted-foreground">{meta.data.length} / {meta.limit} users</span>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Tip content={full ? 'No seats left' : 'Add many users from a CSV file'}><span><Button variant="outline" onClick={() => setDialog('import')} disabled={full}><Upload />Import CSV</Button></span></Tip>
              <Tip content={full ? 'No seats left. Contact the administrator for more.' : 'Add one user'}><span><Button onClick={() => setDialog('add')} disabled={full}><Plus />Add user</Button></span></Tip>
            </div>
          </div>
        </Card>
      </motion.div>
      <Segmented id="org-tab" className="mb-6" value={tab} onChange={setTab} options={tabs} />
      <AnimatePresence mode="wait">
        <motion.div key={tab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}>
          {tab === 'users' && <UsersTab meta={meta} reload={load} onAdd={() => setDialog('add')} onImport={() => setDialog('import')} />}
          {tab === 'announcements' && <AnnouncementsTab />}
          {tab === 'cards' && <CardsTab />}
          {tab === 'company' && org.is_owner && <CompanyTab org={org.data} seats={org.seats} onSaved={load} />}
        </motion.div>
      </AnimatePresence>
      {dialog === 'add' && <AddUser meta={meta} onClose={() => setDialog(null)} onSaved={load} />}
      {dialog === 'import' && <ImportUsers meta={meta} seatsLeft={left} onClose={() => setDialog(null)} onSaved={load} />}
    </>
  );
}

