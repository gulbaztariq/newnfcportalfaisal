import { lazy, Suspense, useState } from 'react';
import { motion } from 'motion/react';
import { Users, MailCheck, MessagesSquare, AtSign, Send, Mail, History } from 'lucide-react';
import api from '@/lib/api';
import { cn } from '@/lib/cn';
import { fmtDateTime, fullName } from '@/lib/format';
import { PageHeader, Card, CardHeader, CardBody, CardFooter, Button, Field, Input, Textarea, Skeleton, EmptyState, Pagination, useList, useForm, run, confirm } from '@/components/ui';

const RichText = lazy(() => import('@/components/ui/RichText'));
const AUDIENCES = [
  ['all_users', Users, 'All active users', 'Everyone with an active account'],
  ['subscribers', MailCheck, 'Newsletter', 'Website e-mail subscribers'],
  ['enquiries', MessagesSquare, 'Enquiries', 'People who used the contact form'],
  ['custom', AtSign, 'Custom list', 'Type the addresses yourself'],
];

export default function SendEmail() {
  const form = useForm({ audience: 'all_users', emails: '', subject: '', description: '' });
  const history = useList('/admin/sent-emails');
  const [busy, setBusy] = useState(false);
  const v = form.values;
  const send = async () => {
    if (!(await confirm({ title: 'Send this e-mail?', description: 'It will be delivered to everyone in the selected audience.', confirmText: 'Send now', tone: 'primary' }))) return;
    setBusy(true);
    try { await run(api.post('/admin/send-email', v)); form.setValues({ ...v, subject: '', description: '', emails: '' }); history.reload(); } catch (e) { form.setErrors(e.errors); } finally { setBusy(false); }
  };
  return (
    <>
      <PageHeader title="Send Email" description="Send an announcement or newsletter. Recipients never see each other's address." />
      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <Card>
          <CardHeader icon={Mail} title="Compose" />
          <CardBody className="space-y-5">
            <div>
              <p className="mb-2 text-[13px] font-medium">Audience</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {AUDIENCES.map(([k, I, l, d]) => {
                  const on = v.audience === k;
                  return (
                    <button key={k} type="button" onClick={() => form.set('audience', k)} className={cn('relative flex cursor-pointer items-center gap-3 rounded-2xl border p-3.5 text-left transition', on ? 'border-primary bg-primary-soft/60' : 'border-border hover:border-primary/40')}>
                      <span className={cn('grid size-10 place-items-center rounded-xl transition', on ? 'bg-primary text-white' : 'bg-muted text-muted-foreground')}><I className="size-4.5" /></span>
                      <span><span className="block text-sm font-medium">{l}</span><span className="block text-xs text-muted-foreground">{d}</span></span>
                      {on && <motion.span layoutId="aud" className="absolute inset-0 rounded-2xl ring-2 ring-primary" />}
                    </button>
                  );
                })}
              </div>
            </div>
            {v.audience === 'custom' && <Field label="E-mail addresses" hint="Separate with commas or new lines" error={form.errors.emails}><Textarea {...form.input('emails')} rows={2} placeholder="alex@example.com, sam@example.com" /></Field>}
            <Field label="Subject" required error={form.errors.subject}><Input {...form.input('subject')} placeholder="What's this about?" /></Field>
            <Field label="Message" error={form.errors.description}>
              <Suspense fallback={<Skeleton className="h-64 rounded-xl" />}><RichText value={v.description} onChange={(x) => form.set('description', x)} height={260} placeholder="Write your message..." /></Suspense>
            </Field>
          </CardBody>
          <CardFooter><Button onClick={send} loading={busy} size="lg"><Send />Send e-mail</Button></CardFooter>
        </Card>
        <Card className="h-fit overflow-hidden">
          <CardHeader icon={History} title="Sent e-mails" />
          {history.loading && !history.rows.length ? <div className="space-y-3 p-5"><Skeleton className="h-12" /><Skeleton className="h-12" /></div> : !history.rows.length ? <EmptyState icon={Send} title="Nothing sent yet" /> : (
            <ul className="divide-y divide-border">
              {history.rows.map((m) => (
                <li key={m.id} className="px-5 py-3.5">
                  <p className="truncate text-sm font-medium">{m.subject}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{m.recipients.length} recipients · {fmtDateTime(m.created_at)} · {fullName(m.sender)}</p>
                </li>
              ))}
            </ul>
          )}
          <Pagination meta={history.meta} onPage={history.setPage} />
        </Card>
      </div>
    </>
  );
}
