/* Admin (super admin): roles for staff. A role is a named set of permissions; staff get a role, never a plan. */
import { useState } from 'react';
import { Plus, Pencil, Trash2, ShieldCheck, Users as UsersIcon } from 'lucide-react';
import api from '@/lib/api';
import PermissionMatrix from '@/components/PermissionMatrix';
import { Card, CardBody, Button, Field, Input, Dialog, EmptyState, Skeleton, Badge, useForm, run, confirm } from '@/components/ui';

export default function StaffRoles({ roles, modules, reload }) {
  const [editing, setEditing] = useState(null); // {} = new
  const [saving, setSaving] = useState(false);
  const form = useForm({ name: '', description: '', permissions: [] });
  const open = (r) => { setEditing(r || {}); form.setErrors({}); form.setValues(r ? { name: r.name, description: r.description || '', permissions: r.permissions || [] } : { name: '', description: '', permissions: [] }); };
  const save = async (e) => {
    e?.preventDefault();
    if (!form.validate({ name: 'required|max:60', description: 'max:255' }, { name: 'Role name', description: 'Description' })) return;
    if (!form.values.permissions.length) { form.setErrors({ permissions: 'Give the role access to at least one module' }); return; }
    setSaving(true);
    try { await run(editing.id ? api.put(`/admin/admins/roles/${editing.id}`, form.values) : api.post('/admin/admins/roles', form.values)); setEditing(null); reload(); } catch (ex) { form.setErrors(ex.errors || {}); } finally { setSaving(false); }
  };
  const remove = async (r) => { if (await confirm({ title: `Delete the role ${r.name}?`, description: 'Roles that staff are using cannot be deleted.' })) { await run(api.delete(`/admin/admins/roles/${r.id}`)).catch(() => {}); reload(); } };
  const count = (r) => (r.permissions || []).filter((k) => k.endsWith('.view')).length;
  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <p className="min-w-0 flex-1 text-sm text-muted-foreground">A role decides which parts of the admin panel a staff member can see and change. Change a role and everyone who has it gets the new access at once. <b className="text-foreground">Admin</b> is built in and always has full access.</p>
        <Button onClick={() => open()}><Plus />Add role</Button>
      </div>
      {!roles ? <Skeleton className="h-48 rounded-3xl" /> : !roles.length ? <Card><EmptyState icon={ShieldCheck} title="No roles yet" action={<Button onClick={() => open()}><Plus />Add role</Button>} /></Card> : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {roles.map((r) => (
            <Card key={r.id} className="h-full">
              <CardBody className="flex h-full flex-col gap-3">
                <div className="flex items-start gap-3">
                  <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-primary-soft text-primary"><ShieldCheck className="size-5" /></span>
                  <div className="min-w-0 flex-1"><p className="truncate font-display text-lg font-semibold">{r.name}</p><p className="text-sm text-muted-foreground">{r.description || 'No description'}</p></div>
                </div>
                <div className="flex flex-wrap gap-2"><Badge tone="primary">{count(r)} of {Object.keys(modules).length} modules</Badge><Badge tone="outline"><UsersIcon className="size-3.5" />{r.users_count} staff</Badge></div>
                <p className="text-xs text-muted-foreground">{Object.entries(modules).filter(([m]) => r.permissions.includes(`${m}.view`) || r.permissions.includes(`${m}.manage`)).map(([, l]) => l).join(', ')}</p>
                <div className="mt-auto flex items-center justify-end gap-2">
                  <Button size="sm" variant="outline" onClick={() => open(r)}><Pencil />Edit</Button>
                  <Button size="icon-sm" variant="danger-soft" onClick={() => remove(r)} aria-label={`Delete ${r.name}`}><Trash2 /></Button>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)} size="lg" icon={ShieldCheck} title={editing?.id ? `Edit role: ${editing.name}` : 'New role'} description={editing?.users_count ? `${editing.users_count} staff member(s) have this role. Their access changes as soon as you save.` : undefined}
        footer={<><Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button><Button onClick={save} loading={saving}>{editing?.id ? 'Save role' : 'Create role'}</Button></>}>
        <form onSubmit={save} className="grid gap-4 sm:grid-cols-2" noValidate>
          <Field label="Role name" required error={form.errors.name}><Input {...form.input('name')} maxLength={60} placeholder="e.g. Order desk, Accountant, Support" /></Field>
          <Field label="Description" error={form.errors.description}><Input {...form.input('description')} maxLength={255} placeholder="What this role is for" /></Field>
          <div className="sm:col-span-2">
            <PermissionMatrix modules={modules} value={form.values.permissions} onChange={(p) => { form.set('permissions', p); }} />
            {form.errors.permissions && <p className="mt-2 text-xs text-danger">{form.errors.permissions}</p>}
          </div>
          <button type="submit" className="hidden" />
        </form>
      </Dialog>
    </>
  );
}
