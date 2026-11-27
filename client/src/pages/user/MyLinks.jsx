import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { IdCard, Link2, Star, ExternalLink, Copy, QrCode, Pencil, MoreHorizontal, MailX, ArrowRightLeft, Pause, Play, Eye, CalendarClock } from 'lucide-react';
import api from '@/lib/api';
import { fmtDate } from '@/lib/format';
import { PageHeader, Card, Button, ButtonLink, Dialog, Field, Input, Checkbox, Badge, EmptyState, Skeleton, Menu, MenuTrigger, MenuContent, MenuItem, MenuSeparator } from '@/components/ui';

const ICON = { vcard: IdCard, redirect: Link2, review: Star };
const STATE = { active: ['success', 'Active'], paused: ['neutral', 'Paused'], expired: ['danger', 'Expired'], details_pending: ['warning', 'Needs your details'], unclaimed: ['warning', 'Unclaimed'] };
const err = (e) => toast.error(e.errors ? Object.values(e.errors)[0] : e.message);

/** destination (redirect / review) or profile (business card) for a link that is waiting for it */
function DetailsDialog({ link, onClose, onSaved }) {
  const [f, setF] = useState({});
  const [busy, setBusy] = useState(false);
  useEffect(() => setF({}), [link?.id]);
  const card = link?.kind === 'vcard';
  const save = async () => {
    setBusy(true);
    try { const { data } = await api.post(`/user/links/${link.id}/details`, card ? f : { url: f.url }); toast.success(data.message); onSaved(); onClose(); } catch (e) { err(e); } finally { setBusy(false); }
  };
  const s = (k) => ({ value: f[k] || '', onChange: (e) => setF({ ...f, [k]: e.target.value }) });
  return (
    <Dialog open={!!link} onOpenChange={(o) => !o && onClose()} size="sm" icon={card ? IdCard : Link2} title="Add the details first"
      description={card ? 'This card has no profile yet. Add your details and it goes live.' : 'This link has no destination yet. Enter where it should open.'}
      footer={<><Button variant="outline" onClick={onClose}>Later</Button><Button onClick={save} loading={busy}>Save</Button></>}>
      <div className="grid gap-4">
        {card ? (<>
          <div className="grid grid-cols-2 gap-3"><Field label="First name" required><Input {...s('first_name')} /></Field><Field label="Last name"><Input {...s('last_name')} /></Field></div>
          <Field label="Job title"><Input {...s('job_title')} /></Field><Field label="Company"><Input {...s('company')} /></Field><Field label="Phone"><Input {...s('phone')} inputMode="tel" /></Field>
        </>) : <Field label={link?.kind === 'review' ? 'Google review link' : 'Web address'} required><Input {...s('url')} placeholder="https://" autoFocus /></Field>}
      </div>
    </Dialog>
  );
}

function DestinationDialog({ link, onClose, onSaved }) {
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const card = link?.kind === 'vcard'; // a business-card link is sent elsewhere with an override; empty = back to the card
  useEffect(() => setUrl((card ? link?.redirect_url : link?.target_url) || ''), [link?.id]);
  const save = async () => { setBusy(true); try { const { data } = await api.put(`/user/links/${link.id}/${card ? 'redirect' : 'destination'}`, { url }); toast.success(data.message); onSaved(); onClose(); } catch (e) { err(e); } finally { setBusy(false); } };
  return (
    <Dialog open={!!link} onOpenChange={(o) => !o && onClose()} size="sm" icon={Pencil} title={card ? `Redirect ${link?.vcard?.name || 'this link'}` : 'Change where this link opens'} description={card ? 'Send this link to another address, for example google.com. Leave it empty to open your card again. Your card is not deleted.' : 'Printed QR codes and NFC tags keep working: they open the new address.'}
      footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={save} loading={busy}>Save</Button></>}>
      <Field label={link?.kind === 'review' ? 'Google review link' : 'Web address'}><Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" autoFocus /></Field>
    </Dialog>
  );
}

/** reset (code to your own e-mail) and move (code to the NEW e-mail): both ask whether the data is wiped */
function ResetMove({ link, mode, onClose, onDone }) {
  const [step, setStep] = useState(0);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [wipe, setWipe] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => { setStep(0); setEmail(''); setCode(''); setWipe(false); }, [link?.id, mode]);
  const move = mode === 'move';
  const card = link?.kind === 'vcard';
  const start = async () => {
    setBusy(true);
    try { const { data } = await api.post(`/user/links/${link.id}/${move ? 'transfer' : 'reset'}/start`, move ? { email } : {}); toast.success(data.message); setStep(1); } catch (e) { err(e); } finally { setBusy(false); }
  };
  const confirm = async () => {
    setBusy(true);
    try { const { data } = await api.post(`/user/links/${link.id}/${move ? 'transfer' : 'reset'}/confirm`, { ...(move ? { email } : {}), code, wipe }); toast.success(data.message); onDone(); onClose(); } catch (e) { err(e); } finally { setBusy(false); }
  };
  const hint = card ? (move ? (wipe ? 'The card is deleted. The new owner adds their own details first.' : 'The card moves to the new e-mail with all its content.') : (wipe ? 'The card is deleted for good.' : 'You keep the card as a normal card. It is no longer attached to this link.'))
    : (move ? (wipe ? 'The destination is removed. The new owner enters it first.' : 'The destination stays as it is.') : (wipe ? 'The destination is removed.' : 'The destination is remembered and shown to the next person.'));
  return (
    <Dialog open={!!link} onOpenChange={(o) => !o && onClose()} size="sm" icon={move ? ArrowRightLeft : MailX} title={move ? 'Move to another e-mail' : 'Reset the e-mail'}
      description={move ? 'The new e-mail gets a code. Enter it here to finish: the new owner has to agree.' : 'The link becomes unclaimed again. The next person who opens it attaches it to their own e-mail. We send a code to your e-mail to confirm.'}
      footer={step === 0 ? <><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={start} loading={busy} disabled={move && !email}>Send the code</Button></>
        : <><Button variant="outline" onClick={() => setStep(0)}>Back</Button><Button onClick={confirm} loading={busy} disabled={code.length < 6}>{move ? 'Move the link' : 'Reset the link'}</Button></>}>
      {step === 0 ? (
        <div className="space-y-4">
          {move && <Field label="New owner's e-mail" required><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" autoFocus /></Field>}
          <div className="rounded-2xl border border-border p-3.5"><Checkbox id="wp" checked={wipe} onChange={setWipe} label={<span className="font-medium">Wipe the data</span>} /><p className="mt-1.5 text-xs text-muted-foreground">{hint}</p></div>
        </div>
      ) : (
        <Field label={`6-digit code sent to ${move ? email : 'your e-mail'}`}><Input value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" maxLength={6} autoFocus className="text-center text-2xl tracking-[0.4em]" /></Field>
      )}
    </Dialog>
  );
}

function LinkCard({ l, reload, ask }) {
  const Icon = ICON[l.kind] || Link2;
  const [tone, label] = STATE[l.state] || ['neutral', l.state];
  const title = l.vcard?.name || l.title || l.kind_label;
  const open = l.vcard?.url || l.short_url;
  const copy = () => { navigator.clipboard?.writeText(l.short_url); toast.success('Link copied'); };
  const pause = async () => { try { const { data } = await api.post(`/user/links/${l.id}/pause`, { paused: l.state !== 'paused' }); toast.success(data.message); reload(); } catch (e) { err(e); } };
  return (
    <Card hover className="flex flex-col p-5">
      <div className="flex items-start justify-between gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-primary-soft text-primary">{l.vcard?.image ? <img src={l.vcard.image} alt="" className="size-11 rounded-2xl object-cover" /> : <Icon className="size-5" />}</span>
        <Badge tone={tone} dot>{label}</Badge>
      </div>
      <p className="mt-4 truncate font-display text-lg font-semibold">{title}</p>
      {l.redirect_url && <p className="truncate text-xs font-medium text-warning">Redirected to {l.redirect_url}</p>}
      <p className="truncate text-xs text-muted-foreground">{l.kind_label}{l.vcard?.occupation ? ` · ${l.vcard.occupation}` : ''}</p>
      <button type="button" onClick={copy} className="mt-3 flex cursor-pointer items-center gap-1.5 truncate text-left font-mono text-xs font-semibold text-primary hover:underline"><Copy className="size-3 shrink-0" />{l.short_url.replace(/^https?:\/\//, '')}</button>
      {l.target_url && <p className="mt-1 truncate text-xs text-muted-foreground">Opens {l.target_url}</p>}
      <div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5"><Eye className="size-3.5" />{(l.vcard?.views ?? l.clicks ?? 0).toLocaleString()} {l.vcard ? 'views' : 'scans'}</span>
        <span className="flex items-center gap-1.5" title="Plan and expiry of this link"><CalendarClock className="size-3.5" />{l.plan?.name || 'Plan'}{l.expires_at ? ` · until ${fmtDate(l.expires_at)}` : ''}</span>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {l.state === 'details_pending' ? <Button size="sm" onClick={() => ask('details', l)}>Add details</Button> : (
          <>
            <ButtonLink size="sm" variant="outline" href={open} target="_blank" rel="noreferrer"><ExternalLink />Open</ButtonLink>
            {l.vcard ? <ButtonLink as={Link} size="sm" to={`/user/vcards/${l.vcard.id}/edit`}><Pencil />Edit card</ButtonLink> : <Button size="sm" onClick={() => ask('destination', l)} disabled={l.locked}><Pencil />Edit link</Button>}
          </>
        )}
        <Menu>
          <MenuTrigger asChild><button type="button" className="ml-auto grid size-8 cursor-pointer place-items-center rounded-lg text-muted-foreground hover:bg-muted" aria-label="More"><MoreHorizontal className="size-4" /></button></MenuTrigger>
          <MenuContent>
            <MenuItem icon={Copy} onSelect={copy}>Copy link</MenuItem>
            {l.kind === 'vcard' && l.state !== 'details_pending' && <MenuItem icon={ExternalLink} onSelect={() => ask('destination', l)} disabled={l.locked}>{l.redirect_url ? 'Change the redirect' : 'Redirect this link'}</MenuItem>}
            <MenuItem icon={QrCode} onSelect={() => { window.location.href = `/api/user/short-links/${l.id}/qrcode?download=1&size=800`; }}>Download QR code</MenuItem>
            <MenuItem icon={l.state === 'paused' ? Play : Pause} onSelect={pause}>{l.state === 'paused' ? 'Resume' : 'Pause'}</MenuItem>
            <MenuSeparator />
            <MenuItem icon={MailX} onSelect={() => ask('reset', l)}>Reset the e-mail</MenuItem>
            <MenuItem icon={ArrowRightLeft} onSelect={() => ask('move', l)}>Move to another e-mail</MenuItem>
          </MenuContent>
        </Menu>
      </div>
    </Card>
  );
}

/** every link and business card the signed-in e-mail owns, as cards (used on the dashboard and on the My links page) */
export function LinkCards({ limit, title }) {
  const [rows, setRows] = useState(null);
  const [dlg, setDlg] = useState(null); // { type, link }
  const load = () => api.get('/user/links').then(({ data }) => setRows(data.data)).catch(() => setRows([]));
  useEffect(() => { load(); }, []);
  const ask = (type, link) => setDlg({ type, link });
  if (!rows) return title ? null : <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-56 rounded-2xl" />)}</div>;
  if (!rows.length) return null;
  const shown = limit ? rows.slice(0, limit) : rows;
  return (
    <>
      {title && <div className="mb-4 flex items-center justify-between"><h2 className="font-display text-xl font-semibold">{title}</h2>{rows.length > shown.length && <Link to="/user/links" className="text-sm font-medium text-primary hover:underline">View all {rows.length}</Link>}</div>}
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{shown.map((l) => <LinkCard key={l.id} l={l} reload={load} ask={ask} />)}</div>
      <DetailsDialog link={dlg?.type === 'details' ? dlg.link : null} onClose={() => setDlg(null)} onSaved={load} />
      <DestinationDialog link={dlg?.type === 'destination' ? dlg.link : null} onClose={() => setDlg(null)} onSaved={load} />
      <ResetMove link={dlg && ['reset', 'move'].includes(dlg.type) ? dlg.link : null} mode={dlg?.type} onClose={() => setDlg(null)} onDone={load} />
    </>
  );
}

export default function MyLinks() {
  const [count, setCount] = useState(null);
  useEffect(() => { api.get('/user/links').then(({ data }) => setCount(data.data.length)).catch(() => setCount(0)); }, []);
  return (
    <>
      <PageHeader title="My links & cards" description="Every business card and link attached to your e-mail. Each has its own plan and expiry." />
      {count === 0 ? <Card><EmptyState icon={Link2} title="Nothing attached to your e-mail yet" description="Open a link you were given (scan the QR code or tap the NFC card) to attach it to your e-mail." /></Card> : <LinkCards />}
    </>
  );
}
