import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { motion } from 'motion/react';
import { Plus, Eye, Pencil, Trash2, UserCog, ShieldCheck, Users as UsersIcon, MailCheck, Send, ArrowLeft, ExternalLink, Calendar, Clock, Phone, IdCard, Package, Building2, Globe, MapPin, Mail, Armchair, Route, Upload, ShoppingBag, Lock, LockOpen, Ban, KeyRound, Megaphone, UserPlus, UserMinus, FileSpreadsheet, Sparkles } from 'lucide-react';
import { ImportUsers } from '@/pages/user/Organisation';
import { cn } from '@/lib/cn';
import api, { toFormData } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { fmtDate, fmtDateTime, fullName, label } from '@/lib/format';
import PermissionMatrix from '@/components/PermissionMatrix';
import ExportMenu from '@/components/ExportMenu';
import {
  PageHeader, TableCard, DataTable, SearchInput, FilterSelect, Action, Actions, Dialog, Button, ButtonLink, Field, Input, Select, Switch, ImageUpload, Badge, StatusBadge,
  UserCell, Avatar, Card, CardHeader, CardBody, EmptyState, Skeleton, useList, useForm, run, confirm,
} from '@/components/ui';

const blank = { first_name: '', last_name: '', email: '', contact: '', region_code: '', password: '', password_confirmation: '', is_active: true, plan_id: '', avatar: null, role: 'manager', permissions: null };
// organisation accounts: the owner's user fields + company details
const orgBlank = { is_organisation: false, org_name: '', org_website: '', org_email: '', org_phone: '', org_address: '', org_city: '', org_country: '', seats: '', logo: null };
const orgValues = (o = {}) => ({ org_name: o.name || '', org_website: o.website || '', org_email: o.email || '', org_phone: o.phone || '', org_address: o.address || '', org_city: o.city || '', org_country: o.country || '', seats: o.seats || '', logo: o.logo || null });
const ROLE_INFO = { admin: 'Full access to the admin panel (except staff management)', manager: 'Only the modules you allow below', supervisor: 'Only the modules you allow below (usually order handling)' };

function SectionTitle({ icon: Icon, title, hint }) {
  return (
    <div className="flex items-center gap-3 border-b border-border pb-2 sm:col-span-2 [&:not(:first-child)]:mt-2">
      <span className="grid size-8 place-items-center rounded-xl bg-primary-soft text-primary"><Icon className="size-4" /></span>
      <div><p className="text-sm font-semibold">{title}</p>{hint && <p className="text-xs text-muted-foreground">{hint}</p>}</div>
    </div>
  );
}

export default function Users({ role = 'user' }) {
  const isAdmin = role === 'admin';
  const endpoint = isAdmin ? '/admin/admins' : '/admin/users';
  const singular = isAdmin ? 'Staff member' : 'User';
  const [meta, setMeta] = useState(null);
  useEffect(() => { if (isAdmin) api.get('/admin/roles/meta').then(({ data }) => setMeta(data)); }, [isAdmin]);
  const navigate = useNavigate();
  const list = useList(endpoint);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [plans, setPlans] = useState([]);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState([]);
  const form = useForm({ ...blank, ...orgBlank });
  const isOrg = !isAdmin && form.values.is_organisation;
  useEffect(() => { if (!isAdmin) api.get('/admin/lookups').then(({ data }) => setPlans(data.plans.map((p) => ({ value: p.id, label: `${p.name} (${p.frequency})` })))); }, [isAdmin]);

  const openForm = (row, asOrg = false) => {
    setEditing(row || null); form.setErrors({});
    const base = row ? { ...blank, ...Object.fromEntries(Object.keys(blank).map((k) => [k, row[k] ?? blank[k]])), password: '', password_confirmation: '' } : blank;
    form.setValues({ ...base, ...orgBlank, is_organisation: row ? !!row.is_organisation : asOrg, ...(row?.is_organisation ? orgValues(row.organisation || {}) : {}) });
    if (isAdmin && row && !Array.isArray(row.permissions) && meta) form.set('permissions', meta.defaults[row.role] || null);
    setOpen(true);
  };
  const save = async (e) => {
    e?.preventDefault(); setSaving(true);
    const v = { ...form.values }; if (!(v.avatar instanceof File)) delete v.avatar;
    if (!(v.logo instanceof File)) delete v.logo;
    if (!v.is_organisation) for (const k of Object.keys(orgBlank)) delete v[k]; else v.is_organisation = '1';
    if (isAdmin) { if (v.role === 'admin' || !Array.isArray(v.permissions)) delete v.permissions; else v.permissions = JSON.stringify(v.permissions); } else { delete v.role; delete v.permissions; }
    try { await run(editing ? api.put(`${endpoint}/${editing.id}`, toFormData(v)) : api.post(endpoint, toFormData(v))); setOpen(false); list.reload(); } catch (ex) { form.setErrors(ex.errors); } finally { setSaving(false); }
  };
  const remove = async (u) => { if (await confirm({ title: `Delete ${fullName(u)}?`, description: isAdmin ? 'This admin will lose access immediately.' : 'The user and all of their vCards will be permanently deleted.' })) { await run(api.delete(`${endpoint}/${u.id}`)).catch(() => {}); list.reload(); } };
  const status = async (u, v) => { u.is_active = v; await run(api.patch(`${endpoint}/${u.id}/status`, { is_active: v })).catch(() => { u.is_active = !v; }); list.reload(); };
  const removeMany = async () => {
    if (!(await confirm({ title: `Delete ${selected.length} users?`, description: 'The users and all of their vCards will be permanently deleted.' }))) return;
    await run(api.post('/admin/users/bulk-delete', { ids: selected })).catch(() => {}); setSelected([]); list.reload();
  };
  const resend = (u) => run(api.post(`/admin/users/${u.id}/resend-verification`)).catch(() => {});
  const verify = async (u) => { await run(api.patch(`${endpoint}/${u.id}/verify-email`)).catch(() => {}); list.reload(); };
  const impersonate = async (u) => {
    if (!(await confirm({ title: `Log in as ${fullName(u)}?`, description: 'You will see the portal exactly as this user does. Use the banner to come back.', confirmText: 'Impersonate', tone: 'primary' }))) return;
    await run(api.post(`/admin/users/${u.id}/impersonate`)).then(() => { window.location.href = '/user/dashboard'; }).catch(() => {});
  };

  const columns = [
    { key: 'user', label: singular, render: (u) => <UserCell user={u} /> },
    !isAdmin && {
      key: 'type', label: 'Account', render: (u) => (u.is_organisation ? (
        <div className="flex items-center gap-2">
          {u.organisation?.logo ? <img src={u.organisation.logo} alt="" className="size-7 rounded-lg border border-border object-contain" /> : <span className="grid size-7 place-items-center rounded-lg bg-primary-soft text-primary"><Building2 className="size-3.5" /></span>}
          <div className="min-w-0"><p className="truncate text-sm font-medium">{u.organisation?.name || 'Organisation'}</p><p className="text-xs text-muted-foreground">{u.members_count} / {u.seats} users</p></div>
        </div>
      ) : u.organisation_id ? <div><Badge tone="info">{label(u.company_role || 'member')}</Badge><p className="mt-0.5 truncate text-xs text-muted-foreground">{u.organisation_name || 'Organisation'}</p></div>
        : <span className="text-xs text-muted-foreground">Individual</span>),
    },
    isAdmin && { key: 'role', label: 'Role', render: (u) => <Badge tone={u.role === 'admin' ? 'primary' : u.role === 'manager' ? 'info' : 'neutral'}>{label(u.role)}</Badge> },
    isAdmin && { key: 'perm', label: 'Access', render: (u) => <span className="text-xs text-muted-foreground">{u.role === 'admin' ? 'Everything' : `${(Array.isArray(u.permissions) ? u.permissions : meta?.defaults[u.role] || []).filter((k) => k.endsWith('.view')).length} modules`}</span> },
    !isAdmin && { key: 'plan', label: 'Plan', render: (u) => (u.plan ? <Badge tone="primary">{u.plan.name}</Badge> : <span className="text-muted-foreground">-</span>) },
    !isAdmin && { key: 'vcards', label: 'vCards', render: (u) => <span className="font-medium">{u.vcards_count}</span> },
    { key: 'verified', label: 'E-mail', render: (u) => (u.email_verified_at ? <StatusBadge value="verified" /> : <div className="flex gap-1"><Button size="xs" variant="soft" onClick={() => verify(u)}><MailCheck />Verify</Button>{!isAdmin && <Button size="xs" variant="ghost" onClick={() => resend(u)} title="Resend verification e-mail"><Send /></Button>}</div>) },
    { key: 'created', label: 'Joined', render: (u) => <span className="text-muted-foreground">{fmtDate(u.created_at)}</span> },
    { key: 'active', label: 'Active', render: (u) => <Switch size="sm" checked={u.is_active} onChange={(v) => status(u, v)} /> },
    {
      key: '_a', label: '', className: 'text-right', render: (u) => (
        <Actions>
          {!isAdmin && <Action icon={Eye} label="View details" onClick={() => navigate(`/admin/users/${u.id}`)} />}
          {!isAdmin && <Action icon={UserCog} label="Impersonate" tone="warning" onClick={() => impersonate(u)} />}
          <Action icon={Pencil} label="Edit" tone="info" onClick={() => openForm(u)} />
          <Action icon={Trash2} label="Delete" tone="danger" onClick={() => remove(u)} />
        </Actions>
      ),
    },
  ].filter(Boolean);

  return (
    <>
      <PageHeader title={isAdmin ? 'Staff & roles' : 'Users'} description={isAdmin ? 'Admins, managers and supervisors of the admin panel, with their permissions. Staff sign in with a second step: their authenticator app, or an e-mailed code once SMTP is set up.' : 'Everyone who has an account on the platform.'}>
        {!isAdmin && <ExportMenu what="users" base="/api/admin/export" />}
        {!isAdmin && <Button variant="outline" onClick={() => openForm(null, true)}><Building2 />Add organisation</Button>}
        <Button onClick={() => openForm()}><Plus />Add {singular.toLowerCase()}</Button>
      </PageHeader>
      <TableCard title={`All ${isAdmin ? 'admins' : 'users'}`} list={list} toolbar={<>
        {selected.length > 0 && <Button size="sm" variant="danger-soft" onClick={removeMany}><Trash2 />Delete {selected.length}</Button>}
        {!isAdmin && <FilterSelect value={list.params.type} onChange={(v) => list.set({ type: v })} placeholder="All accounts" options={[{ value: 'organisation', label: 'Organisations' }, { value: 'member', label: 'Organisation users' }, { value: 'individual', label: 'Individuals' }]} />}
        <FilterSelect value={list.params.status} onChange={(v) => list.set({ status: v })} placeholder="All statuses" options={[{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Deactivated' }]} />
        <SearchInput value={list.params.search} onChange={(search) => list.set({ search })} placeholder="Search name or e-mail..." />
      </>}>
        <DataTable loading={list.loading} rows={list.rows} columns={columns} selected={selected} onSelect={isAdmin ? undefined : setSelected}
          empty={<EmptyState icon={isAdmin ? ShieldCheck : UsersIcon} title={`No ${isAdmin ? 'admins' : 'users'} found`} action={<Button onClick={() => openForm()}><Plus />Add {singular.toLowerCase()}</Button>} />} />
      </TableCard>

      <Dialog open={open} onOpenChange={setOpen} size="lg" icon={isAdmin ? ShieldCheck : isOrg ? Building2 : UsersIcon} title={`${editing ? 'Edit' : 'New'} ${isOrg ? 'organisation' : singular.toLowerCase()}`}
        description={editing ? undefined : isOrg ? 'The organisation owner signs in with the login below and manages their users. Login details are e-mailed automatically.' : 'Login details are e-mailed to the new account automatically.'}
        footer={<><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={save} loading={saving}>{editing ? 'Save changes' : `Create ${isOrg ? 'organisation' : singular.toLowerCase()}`}</Button></>}>
        <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
          {isOrg && (
            <>
              <SectionTitle icon={Building2} title="Company" hint="Shown to the organisation's users and copied onto their new cards" />
              <Field label="Company name" htmlFor="f-org_name" required error={form.errors.org_name}><Input {...form.input('org_name')} /></Field>
              <Field label="Website / domain" htmlFor="f-org_website" error={form.errors.org_website}><Input {...form.input('org_website')} icon={Globe} placeholder="company.com" /></Field>
              <Field label="Business e-mail" htmlFor="f-org_email" error={form.errors.org_email}><Input {...form.input('org_email')} type="email" icon={Mail} /></Field>
              <Field label="Business phone" htmlFor="f-org_phone" error={form.errors.org_phone}><Input {...form.input('org_phone')} icon={Phone} /></Field>
              <Field label="Business address" htmlFor="f-org_address" className="sm:col-span-2" error={form.errors.org_address}><Input {...form.input('org_address')} icon={MapPin} /></Field>
              <Field label="City" htmlFor="f-org_city"><Input {...form.input('org_city')} /></Field>
              <Field label="Country" htmlFor="f-org_country"><Input {...form.input('org_country')} /></Field>
              <Field label="Number of users" htmlFor="f-seats" error={form.errors.seats} hint="How many users the organisation can add. Leave empty to use the plan's organisation-user limit."><Input {...form.input('seats')} type="number" min="0" icon={Armchair} /></Field>
              <Field label="Company logo"><ImageUpload value={form.values.logo} onChange={(v) => form.set('logo', v)} hint="PNG, JPG or WEBP up to 2 MB" /></Field>
              <SectionTitle icon={UserCog} title="Organisation owner" hint="Full access to the organisation: users, roles, locks and announcements" />
            </>
          )}
          <Field label="First name" htmlFor="f-first_name" required error={form.errors.first_name}><Input {...form.input('first_name')} /></Field>
          <Field label="Last name" htmlFor="f-last_name" required error={form.errors.last_name}><Input {...form.input('last_name')} /></Field>
          <Field label="E-mail" htmlFor="f-email" required error={form.errors.email}><Input {...form.input('email')} type="email" /></Field>
          <Field label="Phone" htmlFor="f-contact">
            <div className="flex gap-2"><Input className="w-20" placeholder="+1" value={form.values.region_code || ''} onChange={(e) => form.set('region_code', e.target.value.replace(/\D/g, ''))} /><Input {...form.input('contact')} className="flex-1" /></div>
          </Field>
          <Field label="Password" htmlFor="f-password" required={!editing} error={form.errors.password} hint={editing ? 'Leave empty to keep the current password' : 'Minimum 6 characters'}><Input {...form.input('password')} type="password" autoComplete="new-password" /></Field>
          <Field label="Confirm password" htmlFor="f-password_confirmation" required={!editing} error={form.errors.password_confirmation}><Input {...form.input('password_confirmation')} type="password" autoComplete="new-password" /></Field>
          {!isAdmin && editing && !editing.is_organisation && !editing.organisation_id && (
            <label className="flex cursor-pointer items-center justify-between rounded-2xl border border-border p-4 sm:col-span-2"><span><span className="block text-sm font-medium">Organisation account</span><span className="text-xs text-muted-foreground">Turn this user into an organisation that manages its own users</span></span><Switch checked={form.values.is_organisation} onChange={(v) => { form.set('is_organisation', v); if (v && !form.values.org_name) form.set('org_name', `${form.values.first_name} ${form.values.last_name}`.trim()); }} /></label>
          )}
          {!isAdmin && !editing && <Field label="Plan" className="sm:col-span-2" hint={isOrg ? 'The organisation and all of its users work with this plan' : 'Leave empty to give the default plan'}><Select value={form.values.plan_id} onChange={(v) => form.set('plan_id', v)} options={plans} placeholder="Default plan" allowEmpty /></Field>}
          {isAdmin && (
            <div className="space-y-3 sm:col-span-2">
              <Field label="Role" hint={ROLE_INFO[form.values.role]}>
                <Select value={form.values.role} onChange={(v) => { form.set('role', v); if (v !== 'admin' && meta && !Array.isArray(form.values.permissions)) form.set('permissions', meta.defaults[v]); }} options={[{ value: 'admin', label: 'Admin' }, { value: 'manager', label: 'Manager' }, { value: 'supervisor', label: 'Supervisor' }]} />
              </Field>
              {form.values.role !== 'admin' && meta && <PermissionMatrix modules={meta.modules} value={Array.isArray(form.values.permissions) ? form.values.permissions : meta.defaults[form.values.role]} defaults={meta.defaults[form.values.role]} onChange={(p) => form.set('permissions', p)} />}
            </div>
          )}
          <Field label="Profile photo" className="sm:col-span-2"><ImageUpload value={form.values.avatar} onChange={(v) => form.set('avatar', v)} round /></Field>
          <label className="flex cursor-pointer items-center justify-between rounded-2xl border border-border p-4 sm:col-span-2"><span><span className="block text-sm font-medium">Active</span><span className="text-xs text-muted-foreground">Inactive accounts cannot sign in</span></span><Switch checked={form.values.is_active} onChange={(v) => form.set('is_active', v)} /></label>
          <button type="submit" className="hidden" />
        </form>
      </Dialog>
    </>
  );
}

export function UserDetail() {
  const { id } = useParams();
  const { settings } = useAuth();
  const [u, setU] = useState(null);
  const load = () => api.get(`/admin/users/${id}`).then(({ data }) => setU(data.data));
  useEffect(() => { load(); }, [id]); // eslint-disable-line
  if (!u) return <div className="space-y-4"><Skeleton className="h-48 rounded-3xl" /><Skeleton className="h-64 rounded-2xl" /></div>;
  const sub = u.subscription;
  const days = sub ? Math.max(0, Math.ceil((new Date(sub.ends_at) - Date.now()) / 864e5)) : 0;
  return (
    <>
      <Link to="/admin/users" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" />All users</Link>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="overflow-hidden">
          <div className="relative h-36 bg-linear-to-br from-violet-600 via-fuchsia-600 to-orange-400"><div className="bg-grid absolute inset-0 opacity-25" /></div>
          <div className="flex flex-wrap items-end gap-5 px-6 pb-6">
            <Avatar src={u.avatar} name={fullName(u)} size={96} className="-mt-12 border-4 border-card shadow-lift" />
            <div className="min-w-0 flex-1 pt-3">
              <h1 className="font-display text-2xl font-bold">{fullName(u)}</h1>
              <p className="text-sm text-muted-foreground">{u.email}</p>
            </div>
            <div className="flex flex-wrap gap-2 pt-3"><StatusBadge value={u.is_active ? 'active' : 'inactive'} />{u.email_verified_at && <StatusBadge value="verified">E-mail verified</StatusBadge>}</div>
          </div>
          <div className="grid border-t border-border sm:grid-cols-4">
            {[[Calendar, 'Joined', fmtDate(u.created_at)], [Clock, 'Last login', fmtDate(u.last_login_at)], [Phone, 'Phone', u.contact ? `+${u.region_code || ''} ${u.contact}` : '-'], [IdCard, 'vCards', u.vcards.length]].map(([I, l, v], i) => (
              <div key={l} className={`flex items-center gap-3 px-6 py-4 ${i ? 'border-t border-border sm:border-t-0 sm:border-l' : ''}`}>
                <span className="grid size-9 place-items-center rounded-xl bg-muted text-muted-foreground"><I className="size-4" /></span>
                <div><p className="text-xs text-muted-foreground">{l}</p><p className="text-sm font-medium">{v}</p></div>
              </div>
            ))}
          </div>
        </Card>
      </motion.div>
      {u.organisation_profile && <OrganisationCard u={u} onChanged={load} />}
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader icon={Package} title="Subscription" />
          <CardBody>
            {sub ? (
              <>
                <p className="font-display text-2xl font-bold">{sub.plan?.name}</p>
                <p className="text-sm text-muted-foreground">{fmtDate(sub.starts_at)} → {fmtDate(sub.ends_at)}</p>
                <div className="mt-5 h-2 overflow-hidden rounded-full bg-muted"><motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(100, (days / 365) * 100)}%` }} transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }} className="h-full rounded-full bg-linear-to-r from-violet-500 to-fuchsia-500" /></div>
                <p className="mt-2 text-xs text-muted-foreground">{days} days remaining</p>
              </>
            ) : <EmptyState icon={Package} title="No active plan" />}
          </CardBody>
        </Card>
        <Card className="overflow-hidden lg:col-span-2">
          <CardHeader icon={IdCard} title={`vCards (${u.vcards.length})`} />
          <DataTable rows={u.vcards} empty={<EmptyState icon={IdCard} title="No vCards yet" />} columns={[
            { key: 'name', label: 'vCard', render: (v) => <div><p className="font-medium">{v.name}</p><p className="text-xs text-muted-foreground">{v.occupation}</p></div> },
            { key: 'url', label: 'Link', render: (v) => <a href={`${settings.app_url}/${v.url_alias}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">/{v.url_alias}<ExternalLink className="size-3" /></a> },
            { key: 'views', label: 'Views', render: (v) => <span className="font-medium">{v.views}</span> },
            { key: 'status', label: 'Status', render: (v) => <StatusBadge value={v.status ? 'active' : 'inactive'} /> },
          ]} />
        </Card>
      </div>
    </>
  );
}

const ORG_STATUS_TONE = { active: 'success', locked: 'warning', blocked: 'danger' };
function OrganisationCard({ u, onChanged }) {
  const o = u.organisation_profile;
  const [importing, setImporting] = useState(false);
  const [rev, setRev] = useState(0);
  if (o.member_of) {
    return (
      <Card className="mt-6 flex flex-wrap items-center gap-3 p-5">
        <span className="grid size-10 place-items-center rounded-xl bg-primary-soft text-primary"><Building2 className="size-5" /></span>
        <div className="flex-1"><p className="text-xs text-muted-foreground">Organisation user</p><p className="font-medium">{o.name}</p></div>
        <Badge tone="info">{label(u.company_role || 'member')}</Badge>
        <Badge tone={ORG_STATUS_TONE[u.org_status || 'active']} dot>{label(u.org_status || 'active')}</Badge>
        <ButtonLink as={Link} to={`/admin/users/${o.member_of.id}`} variant="outline" size="sm">Open organisation</ButtonLink>
      </Card>
    );
  }
  const rows = [[Globe, 'Website', o.website], [Mail, 'E-mail', o.email], [Phone, 'Phone', o.phone], [MapPin, 'Address', [o.address, o.city, o.country].filter(Boolean).join(', ')]].filter(([, , v]) => v);
  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-3">
      <Card>
        <CardHeader icon={Building2} title="Organisation" />
        <CardBody className="space-y-4">
          <div className="flex items-center gap-3">
            {o.logo ? <img src={o.logo} alt="" className="size-14 rounded-2xl border border-border object-contain p-1" /> : <span className="grid size-14 place-items-center rounded-2xl bg-primary-soft text-primary"><Building2 className="size-6" /></span>}
            <div><p className="font-display text-lg font-bold">{o.name}</p><p className="text-sm text-muted-foreground">{o.members.length} of {o.seats_limit} users</p></div>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted"><motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(100, (o.members.length / Math.max(1, o.seats_limit)) * 100)}%` }} transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }} className="h-full rounded-full bg-linear-to-r from-violet-500 to-fuchsia-500" /></div>
          {rows.map(([I, l, v]) => (
            <div key={l} className="flex items-start gap-3 text-sm"><I className="mt-0.5 size-4 shrink-0 text-muted-foreground" /><div className="min-w-0"><p className="text-xs text-muted-foreground">{l}</p><p className="break-words">{l === 'Website' ? <a href={v} target="_blank" rel="noreferrer" className="text-primary hover:underline">{v.replace(/^https?:\/\//, '')}</a> : v}</p></div></div>
          ))}
        </CardBody>
      </Card>
      <Card className="overflow-hidden lg:col-span-2">
        <CardHeader icon={UsersIcon} title={`Users (${o.members.length})`} actions={<div className="flex gap-2">
          <ButtonLink as={Link} to={`/admin/orders/new?organisation=${u.id}`} size="sm" variant="outline"><ShoppingBag />New order</ButtonLink>
          <Button size="sm" onClick={() => setImporting(true)} disabled={o.members.length >= o.seats_limit}><Upload />Import CSV</Button>
        </div>} />
        <DataTable rows={o.members} empty={<EmptyState icon={UsersIcon} title="No users yet" description="Import them from a CSV file, or the organisation adds them from its own portal." />} columns={[
          { key: 'u', label: 'User', render: (m) => <UserCell user={m} to={`/admin/users/${m.id}`} /> },
          { key: 'r', label: 'Role', render: (m) => <Badge tone={m.company_role === 'manager' ? 'primary' : m.company_role === 'supervisor' ? 'info' : 'neutral'}>{label(m.company_role || 'member')}</Badge> },
          { key: 's', label: 'Status', render: (m) => <Badge tone={ORG_STATUS_TONE[m.org_status || 'active']} dot>{label(m.org_status || 'active')}</Badge> },
          { key: 'l', label: 'Last login', render: (m) => <span className="text-muted-foreground">{fmtDate(m.last_login_at)}</span> },
        ]} />
      </Card>
      <OrganisationJourney ownerId={u.id} rev={rev} />
      {importing && <ImportUsers meta={{ is_owner: true }} seatsLeft={Math.max(0, o.seats_limit - o.members.length)} endpoint={`/admin/users/${u.id}/organisation/import`} onClose={() => setImporting(false)} onSaved={() => { onChanged(); setRev((r) => r + 1); }} />}
    </div>
  );
}

/* organisation journey: who did what, when (orders, users, access, locks, announcements...) */
const EVENT = {
  organisation_created: [Sparkles, 'bg-violet-500'], profile_updated: [Building2, 'bg-slate-500'], seats_changed: [Armchair, 'bg-slate-500'],
  order: [ShoppingBag, 'bg-emerald-500'], member_added: [UserPlus, 'bg-sky-500'], members_imported: [FileSpreadsheet, 'bg-sky-500'], member_removed: [UserMinus, 'bg-rose-500'],
  role_changed: [ShieldCheck, 'bg-indigo-500'], permissions_changed: [ShieldCheck, 'bg-indigo-500'], locks_changed: [Lock, 'bg-amber-500'], details_updated: [Pencil, 'bg-slate-500'],
  member_locked: [Lock, 'bg-amber-500'], member_blocked: [Ban, 'bg-rose-500'], member_unlocked: [LockOpen, 'bg-emerald-500'], member_activated: [LockOpen, 'bg-emerald-500'], member_deactivated: [Ban, 'bg-rose-500'],
  password_reset: [KeyRound, 'bg-amber-500'], announcement_sent: [Megaphone, 'bg-fuchsia-500'],
};
const GROUPS = { all: () => true, orders: (e) => e.type === 'order', people: (e) => /member|role|permission|lock|password|details/.test(e.type), company: (e) => /organisation|profile|seats|announcement/.test(e.type) };
const KIND = { staff: 'staff', owner: 'owner', manager: 'manager', supervisor: 'supervisor', member: 'member' };
function OrganisationJourney({ ownerId, rev }) {
  const [items, setItems] = useState(null);
  const [group, setGroup] = useState('all');
  const [all, setAll] = useState(false);
  useEffect(() => { api.get(`/admin/users/${ownerId}/timeline`).then(({ data }) => setItems(data.data)).catch(() => setItems([])); }, [ownerId, rev]);
  const shown = (items || []).filter(GROUPS[group]);
  return (
    <Card className="lg:col-span-3">
      <CardHeader icon={Route} title="Journey" description="Everything that happened with this organisation, newest first: who ordered, who was given access, locks, announcements..."
        actions={<div className="flex flex-wrap gap-1">{[['all', 'All'], ['orders', 'Orders'], ['people', 'Users & access'], ['company', 'Company']].map(([k, l]) => (
          <button key={k} type="button" onClick={() => setGroup(k)} className={cn('cursor-pointer rounded-full border px-3 py-1 text-xs font-medium transition', group === k ? 'border-primary bg-primary text-white' : 'border-border text-muted-foreground hover:text-foreground')}>{l}</button>
        ))}</div>} />
      <CardBody>
        {!items ? <div className="space-y-3"><Skeleton className="h-12" /><Skeleton className="h-12" /></div> : !shown.length ? <EmptyState icon={Route} title="Nothing here yet" /> : (
          <ol className="relative ml-3 space-y-4 border-l-2 border-border pl-7">
            {(all ? shown : shown.slice(0, 25)).map((e, i) => {
              const [I, bg] = EVENT[e.type] || [Clock, 'bg-slate-500'];
              return (
                <motion.li key={e.id} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: Math.min(i * 0.03, 0.3) }} className="relative">
                  <span className={cn('absolute top-0.5 -left-[2.3rem] grid size-6 place-items-center rounded-full border-2 border-card text-white', bg)}><I className="size-3" /></span>
                  <p className="text-sm">{e.message}{e.meta?.order_id && <Link to={`/admin/orders/${e.meta.order_id}`} className="ml-1.5 text-primary hover:underline">Open</Link>}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{fmtDateTime(e.at)}{e.actor_name ? ` · ${e.actor_name}` : ''}{KIND[e.actor_kind] ? ` (${KIND[e.actor_kind]})` : ''}{e.meta?.amount ? ` · Rs ${Number(e.meta.amount).toLocaleString('en-US')}` : ''}</p>
                </motion.li>
              );
            })}
          </ol>
        )}
        {shown.length > 25 && !all && <Button variant="ghost" size="sm" className="mt-4" onClick={() => setAll(true)}>Show all {shown.length}</Button>}
      </CardBody>
    </Card>
  );
}

export { ButtonLink };
