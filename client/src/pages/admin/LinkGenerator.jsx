import { useEffect, useState } from 'react';
import { Plus, Trash2, Link2, IdCard, Star, Copy, QrCode, MailX, ArrowRightLeft } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api';
import { Dialog, Button, ButtonLink, Field, Input, Select, Checkbox, Badge } from '@/components/ui';

/** the three kinds of managed link. The kind is fixed here, by the admin: whoever claims the link cannot change it. */
export const KINDS = [
  { value: 'vcard', label: 'Business card', icon: IdCard, hint: 'The owner adds their profile and gets a vCard' },
  { value: 'redirect', label: 'Redirect link', icon: Link2, hint: 'Opens a web address the owner can change later' },
  { value: 'review', label: 'Review link', icon: Star, hint: 'Opens the Google review form of a business' },
];
export const kindLabel = (k) => KINDS.find((x) => x.value === k)?.label || k;
export const newRow = () => ({ kind: 'vcard', plan_id: '', qty: 1, template_id: '', preset_url: '' });
export const rowsValid = (rows) => rows.length > 0 && rows.every((r) => r.kind && r.plan_id && Number(r.qty) >= 1);
export const rowsPayload = (rows) => rows.map((r) => ({ kind: r.kind, plan_id: Number(r.plan_id), qty: Number(r.qty) || 1, template_id: r.kind === 'vcard' && r.template_id ? Number(r.template_id) : undefined, preset_url: r.kind !== 'vcard' && r.preset_url ? r.preset_url : undefined }));

let cache = null;
export function useLookups() {
  const [v, setV] = useState(cache);
  useEffect(() => { if (!cache) api.get('/admin/lookups').then(({ data }) => { cache = data; setV(data); }); }, []);
  return v;
}

/** the rows: one per link type, each with its own plan and quantity */
export function LinkRows({ rows, setRows }) {
  const lookups = useLookups();
  const upd = (i, patch) => setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  return (
    <div className="space-y-3">
      {rows.map((r, i) => (
        <div key={i} className="space-y-3 rounded-2xl border border-border p-3.5">
          <div className="flex flex-wrap items-end gap-3">
            <Field label="Link type" className="min-w-44 flex-1" hint={KINDS.find((k) => k.value === r.kind)?.hint}>
              <Select value={r.kind} onChange={(x) => upd(i, { kind: x, preset_url: '', template_id: '' })} options={KINDS.map((k) => ({ value: k.value, label: k.label }))} />
            </Field>
            <Field label="Plan" className="min-w-44 flex-1" required hint="Each link has its own plan and expiry, counted from when it is claimed">
              <Select value={r.plan_id} onChange={(x) => upd(i, { plan_id: x })} placeholder="Choose a plan" options={(lookups?.plans || []).map((p) => ({ value: p.id, label: `${p.name} (${p.frequency})` }))} />
            </Field>
            <Field label="How many" className="w-24"><Input type="number" min={1} max={200} value={r.qty} onChange={(e) => upd(i, { qty: e.target.value })} /></Field>
            {rows.length > 1 && <Button variant="danger-soft" size="icon" onClick={() => setRows(rows.filter((_, j) => j !== i))} aria-label="Remove"><Trash2 /></Button>}
          </div>
          {r.kind === 'vcard'
            ? <Field label="Starting template" hint="Optional. The default template is used if left empty."><Select value={r.template_id} onChange={(x) => upd(i, { template_id: x })} allowEmpty placeholder="Default template" options={(lookups?.templates || []).map((t) => ({ value: t.id, label: t.name }))} /></Field>
            : <Field label={r.kind === 'review' ? 'Google review link (optional)' : 'Destination (optional)'} hint="If you already know it. Otherwise the owner enters it when they claim the link."><Input value={r.preset_url} onChange={(e) => upd(i, { preset_url: e.target.value })} placeholder="https://" /></Field>}
        </div>
      ))}
      <Button size="sm" variant="outline" onClick={() => setRows([...rows, newRow()])}><Plus />Add another link type</Button>
    </div>
  );
}

/** a generated link: copy / QR */
export function MadeLinks({ made }) {
  return (
    <div className="space-y-2">
      {made.map((l) => (
        <div key={l.id} className="flex items-center justify-between gap-2 rounded-xl border border-border px-3 py-2 text-sm">
          <div className="min-w-0"><p className="truncate font-mono font-semibold">{l.short_url}</p><p className="text-xs text-muted-foreground">{kindLabel(l.kind)}</p></div>
          <div className="flex shrink-0 gap-1">
            <Button size="sm" variant="ghost" onClick={() => { navigator.clipboard?.writeText(l.short_url); toast.success('Link copied'); }}><Copy />Copy</Button>
            <ButtonLink size="sm" variant="ghost" href={`/api/admin/short-links/${l.id}/qrcode?size=800`}><QrCode />QR</ButtonLink>
          </div>
        </div>
      ))}
    </div>
  );
}

/** Generate links for a customer (from the Users page), an order, or on their own */
export function GenerateLinksDialog({ open, onClose, user, orderId, onDone }) {
  const [rows, setRows] = useState([newRow()]);
  const [busy, setBusy] = useState(false);
  const [made, setMade] = useState(null);
  useEffect(() => { if (open) { setRows([newRow()]); setMade(null); } }, [open]);
  const go = async () => {
    setBusy(true);
    try {
      const { data } = await api.post('/admin/links/generate', { user_id: user?.id, order_id: orderId, links: rowsPayload(rows) });
      setMade(data.data); toast.success(data.message); onDone?.();
    } catch (e) { toast.error(e.errors ? Object.values(e.errors)[0] : e.message); } finally { setBusy(false); }
  };
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()} icon={Link2} title={made ? 'Links ready' : `Generate links${user ? ` for ${user.first_name} ${user.last_name}` : ''}`} size="lg"
      description={made ? 'Write each link to an NFC chip or print it as a QR code. The first person to open one attaches it to their e-mail.' : 'Nothing is attached to anyone yet. Whoever opens a link first confirms their e-mail with a code and becomes its owner.'}
      footer={made ? <Button onClick={onClose}>Done</Button> : <><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={go} loading={busy} disabled={!rowsValid(rows)}>Generate</Button></>}>
      {made ? <MadeLinks made={made} /> : <LinkRows rows={rows} setRows={setRows} />}
    </Dialog>
  );
}

/** Reset to unclaimed / move to another e-mail, as the admin (no code needed). The data is kept or wiped, as the admin chooses. */
export function ResetMoveDialog({ link, mode, onClose, onDone }) {
  const [email, setEmail] = useState('');
  const [wipe, setWipe] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => { setEmail(''); setWipe(false); }, [link?.id, mode]);
  const move = mode === 'move';
  const go = async () => {
    setBusy(true);
    try {
      const { data } = await api.post(`/admin/short-links/${link.id}/${move ? 'transfer' : 'reset'}`, move ? { email, wipe } : { wipe });
      toast.success(data.message); onDone?.(); onClose();
    } catch (e) { toast.error(e.errors ? Object.values(e.errors)[0] : e.message); } finally { setBusy(false); }
  };
  return (
    <Dialog open={!!link} onOpenChange={(o) => !o && onClose()} size="sm" icon={move ? ArrowRightLeft : MailX} title={move ? 'Move to another e-mail' : 'Reset the e-mail'}
      description={move ? `This link belongs to ${link?.claimed_email || 'its owner'}. It will belong to the e-mail below.` : `Makes the link unclaimed again: the next person who opens it attaches it to their own e-mail. It now belongs to ${link?.claimed_email || 'its owner'}.`}
      footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={go} loading={busy} disabled={move && !email}>{move ? 'Move link' : 'Reset'}</Button></>}>
      <div className="space-y-4">
        {move && <Field label="New owner's e-mail" required><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" autoFocus /></Field>}
        <div className="rounded-2xl border border-border p-3.5">
          <Checkbox id="wipe" checked={wipe} onChange={setWipe} label={<span className="font-medium">Wipe the data</span>} />
          <p className="mt-1.5 text-xs text-muted-foreground">
            {link?.kind === 'vcard'
              ? (move ? (wipe ? 'The card is deleted. The new owner adds their profile details first.' : 'The card moves to the new owner with all its content.') : (wipe ? 'The card is deleted for good.' : 'The previous owner keeps the card as a normal card, no longer attached to this link.'))
              : (move ? (wipe ? 'The destination is removed. The new owner enters it first.' : 'The destination stays as it is.') : (wipe ? 'The destination is removed.' : 'The destination is remembered and shown to the next person.'))}
          </p>
        </div>
      </div>
    </Dialog>
  );
}

export const StateBadge = ({ state }) => {
  const map = { unclaimed: ['warning', 'Unclaimed'], active: ['success', 'Active'], paused: ['neutral', 'Paused'], expired: ['danger', 'Expired'], details_pending: ['warning', 'Needs details'], legacy: ['neutral', 'Manual'] };
  const [tone, label] = map[state] || ['neutral', state];
  return <Badge tone={tone}>{label}</Badge>;
};
