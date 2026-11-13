/* Admin: WhatsApp numbers (Cloud API). Messages sent to a number become leads on the card chosen for it. */
import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Copy, CheckCircle2, PlugZap, KeyRound, Inbox } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api';
import { cn } from '@/lib/cn';
import { Whatsapp } from '@/components/BrandIcons';
import { check } from '@/lib/validate';
import { PageHeader, Card, CardBody, Button, Field, Input, Select, Switch, Badge, Dialog, EmptyState, Skeleton, useForm, run, confirm } from '@/components/ui';

const when = (d) => (d ? new Date(d).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : 'No messages yet');
const EMPTY = { label: '', phone_number_id: '', access_token: '', vcard_id: '', status: true };

function CopyRow({ label, value }) {
  const copy = () => navigator.clipboard?.writeText(value).then(() => toast.success(`${label} copied`)).catch(() => toast.error('Copy failed'));
  return (
    <div className="flex items-center gap-2 rounded-xl bg-muted/50 px-3 py-2">
      <div className="min-w-0 flex-1"><p className="text-xs text-muted-foreground">{label}</p><p className="truncate font-mono text-sm">{value}</p></div>
      <Button size="icon-sm" variant="ghost" onClick={copy} aria-label={`Copy ${label}`}><Copy /></Button>
    </div>
  );
}

export function WhatsappLeads() {
  const [data, setData] = useState(null);
  const [editing, setEditing] = useState(null); // {} = new
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(null);
  const [secret, setSecret] = useState('');
  const form = useForm(EMPTY);
  const load = () => api.get('/admin/whatsapp-lines').then(({ data: d }) => setData(d));
  useEffect(() => { load(); }, []);

  const openForm = (row) => { setEditing(row || {}); form.setErrors({}); form.setValues(row ? { label: row.label, phone_number_id: row.phone_number_id, access_token: '', vcard_id: row.vcard_id || '', status: row.status } : EMPTY); };
  const save = async (e) => {
    e?.preventDefault();
    const errs = check(form.values, { label: 'required|max:80', phone_number_id: 'required|numeric|max:40', ...(editing.id ? {} : { access_token: 'required' }) }, { phone_number_id: 'Phone number ID', access_token: 'Access token', label: 'Name' });
    if (Object.keys(errs).length) { form.setErrors(errs); return; }
    setSaving(true);
    try { await run(editing.id ? api.put(`/admin/whatsapp-lines/${editing.id}`, form.values) : api.post('/admin/whatsapp-lines', form.values)); setEditing(null); load(); } catch (ex) { form.setErrors(ex.errors || {}); } finally { setSaving(false); }
  };
  const test = async (l) => { setBusy(l.id); try { await run(api.post(`/admin/whatsapp-lines/${l.id}/test`)); } catch { /* toasted */ } finally { setBusy(null); load(); } };
  const remove = async (l) => { if (await confirm({ title: `Remove ${l.label}?`, description: 'New messages to this number stop creating leads. Leads already received stay on the card.' })) { await run(api.delete(`/admin/whatsapp-lines/${l.id}`)).catch(() => {}); load(); } };
  const toggle = async (l, v) => { await run(api.put(`/admin/whatsapp-lines/${l.id}`, { label: l.label, phone_number_id: l.phone_number_id, vcard_id: l.vcard_id, status: v })).catch(() => {}); load(); };
  const saveSecret = async () => { setBusy('secret'); try { await run(api.put('/admin/whatsapp-lines/config', { app_secret: secret })); setSecret(''); } catch { /* toasted */ } finally { setBusy(null); load(); } };

  const w = data?.webhook;
  return (
    <>
      <PageHeader title="WhatsApp leads" description="Connect your WhatsApp Business numbers. Anyone who messages one of them becomes a lead on the card you choose, in that card owner's Enquiries.">
        <Button onClick={() => openForm()}><Plus />Add number</Button>
      </PageHeader>

      {!data ? <Skeleton className="h-56 rounded-3xl" /> : (
        <>
          <Card className="mb-5">
            <CardBody className="grid gap-4">
              <div className="flex items-center gap-3">
                <span className="grid size-10 place-items-center rounded-2xl bg-primary-soft text-primary"><PlugZap className="size-5" /></span>
                <div className="min-w-0 flex-1"><p className="font-display font-semibold">Step 1: connect Meta to this app (once for all numbers)</p><p className="text-sm text-muted-foreground">In Meta for Developers open your app &gt; WhatsApp &gt; Configuration, paste these two values into Webhook, then subscribe to <b>messages</b>.</p></div>
                {w.has_app_secret ? <Badge tone="success"><CheckCircle2 className="size-3.5" />App secret saved</Badge> : <Badge tone="warning">App secret needed</Badge>}
              </div>
              <div className="grid gap-2 md:grid-cols-2"><CopyRow label="Callback URL" value={w.url} /><CopyRow label="Verify token" value={w.verify_token} /></div>
              <div className="flex flex-wrap items-end gap-2">
                <div className="min-w-64 flex-1"><Field label="Meta app secret" hint="Meta app > App settings > Basic > App secret. Used to confirm that messages really come from Meta. It is never shown again."><Input type="password" autoComplete="off" value={secret} onChange={(e) => setSecret(e.target.value)} placeholder={w.has_app_secret ? 'Saved. Paste a new one to replace it' : 'Paste the app secret'} /></Field></div>
                <Button onClick={saveSecret} loading={busy === 'secret'} disabled={!secret.trim()}><KeyRound />Save secret</Button>
              </div>
            </CardBody>
          </Card>

          <p className="mb-3 font-display font-semibold">Step 2: your numbers <span className="ml-1 text-sm font-normal text-muted-foreground">{data.leads} WhatsApp leads so far</span></p>
          {!data.data.length ? (
            <Card><EmptyState icon={Whatsapp} title="No WhatsApp numbers yet" description="Add each number with its Phone number ID and access token from Meta." action={<Button onClick={() => openForm()}><Plus />Add number</Button>} /></Card>
          ) : (
            <div className="grid gap-4 lg:grid-cols-3">
              {data.data.map((l) => (
                <Card key={l.id} className={cn('h-full', !l.status && 'opacity-60')}>
                  <CardBody className="flex h-full flex-col gap-3">
                    <div className="flex items-start gap-3">
                      <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-success-soft text-success"><Whatsapp className="size-5" /></span>
                      <div className="min-w-0 flex-1"><p className="truncate font-display text-lg font-semibold">{l.label}</p><p className="text-sm text-muted-foreground">{l.display_phone || `ID ${l.phone_number_id}`}</p></div>
                      <Switch size="sm" checked={l.status} onChange={(v) => toggle(l, v)} />
                    </div>
                    <div className="rounded-2xl bg-muted/50 p-3 text-sm">
                      <p className="flex items-center gap-1.5"><Inbox className="size-4 text-muted-foreground" /><b>{l.messages_count}</b> messages received</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">Last: {when(l.last_message_at)}</p>
                    </div>
                    <p className="text-sm">{l.card ? <>Leads go to <b>{l.card.name}</b></> : <span className="text-warning">No card chosen: messages are not saved as leads yet</span>}</p>
                    <div className="mt-auto flex items-center gap-2">
                      <Button size="sm" variant="outline" onClick={() => test(l)} loading={busy === l.id}><PlugZap />Test</Button>
                      <span className="flex-1" />
                      <Button size="icon-sm" variant="ghost" onClick={() => openForm(l)} aria-label="Edit"><Pencil /></Button>
                      <Button size="icon-sm" variant="danger-soft" onClick={() => remove(l)} aria-label="Remove"><Trash2 /></Button>
                    </div>
                  </CardBody>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)} size="md" icon={Whatsapp} title={editing?.id ? 'Edit WhatsApp number' : 'Connect a WhatsApp number'}
        footer={<><Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button><Button onClick={save} loading={saving}>{editing?.id ? 'Save changes' : 'Connect number'}</Button></>}>
        <form onSubmit={save} className="grid gap-4" noValidate>
          <Field label="Name" required error={form.errors.label}><Input {...form.input('label')} placeholder="e.g. Sales, Support, Orders" /></Field>
          <Field label="Phone number ID" required hint="Meta for Developers > WhatsApp > API Setup. This is not the phone number itself." error={form.errors.phone_number_id}><Input {...form.input('phone_number_id')} inputMode="numeric" placeholder="e.g. 109876543210987" /></Field>
          <Field label="Access token" required={!editing?.id} hint={editing?.id ? 'Leave empty to keep the saved token.' : 'Use a permanent token from a Meta system user (a temporary one expires in 24 hours).'} error={form.errors.access_token}><Input {...form.input('access_token')} type="password" autoComplete="off" placeholder={editing?.id ? 'Saved' : 'EAAG...'} /></Field>
          <Field label="Save leads on this card" hint="The card's owner sees the leads in Enquiries and gets an e-mail for each new one." error={form.errors.vcard_id}>
            <Select value={form.values.vcard_id || ''} onChange={(v) => form.set('vcard_id', v)} allowEmpty placeholder="Choose a card" options={(data?.cards || []).map((c) => ({ value: c.id, label: `${c.name} (${c.url_alias})` }))} />
          </Field>
          <label className="flex cursor-pointer items-center justify-between rounded-2xl border border-border p-4"><span className="text-sm font-medium">Active</span><Switch checked={!!form.values.status} onChange={(v) => form.set('status', v)} /></label>
          <button type="submit" className="hidden" />
        </form>
      </Dialog>
    </>
  );
}
