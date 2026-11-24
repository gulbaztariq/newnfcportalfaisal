import { useEffect, useState } from 'react';
import { Copy } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api';
import { Dialog, Button, Checkbox, EmptyState, Skeleton } from '@/components/ui';

// what can be copied; the server maps each group to the card fields (routes/user/index.js COPY_GROUPS)
const GROUPS = [
  ['contact', 'Contact details', 'E-mail, phone, alternative contact, location and map link'],
  ['business', 'Business details', 'Company, job title, occupation and the About text'],
  ['social', 'Social links', 'Facebook, Instagram, LinkedIn, WhatsApp and the rest'],
  ['links', 'Custom links', 'The big link buttons'],
  ['payments', 'Payments & bank accounts', 'Every bank / wallet account and payment link'],
  ['hours', 'Business hours', 'Opening hours for each day'],
  ['design', 'Design', 'Template, colours, fonts, section order and visibility'],
];

/** One person often manages several cards under one login: copy parts of this card onto the others in one click. */
export default function CopyToCards({ card, onClose }) {
  const [cards, setCards] = useState(null);
  const [targets, setTargets] = useState([]);
  const [groups, setGroups] = useState([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!card) return;
    setTargets([]); setGroups([]); setCards(null);
    api.get('/user/vcards').then(({ data }) => setCards(data.data.filter((c) => c.id !== card.id)));
  }, [card?.id]); // eslint-disable-line
  const flip = (list, set, v) => set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const go = async () => {
    setBusy(true);
    try {
      const { data } = await api.post(`/user/vcards/${card.id}/copy-to`, { target_ids: targets, groups });
      toast.success(data.message);
      onClose();
    } catch (e) { toast.error(e.errors ? Object.values(e.errors)[0] : e.message); } finally { setBusy(false); }
  };
  return (
    <Dialog open={!!card} onOpenChange={(o) => !o && onClose()} icon={Copy} title="Copy details to my other cards"
      description={`Copies the chosen parts of "${card?.name || ''}" onto your other cards. Their card links never change.`}
      footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={go} loading={busy} disabled={!targets.length || !groups.length}>Copy to {targets.length || ''} card{targets.length === 1 ? '' : 's'}</Button></>}>
      {!cards ? <Skeleton className="h-40 rounded-2xl" /> : !cards.length ? <EmptyState icon={Copy} title="You have no other cards" description="Create or duplicate a card first." /> : (
        <div className="space-y-5">
          <div>
            <div className="mb-2 flex items-center justify-between"><p className="text-sm font-medium">Copy to</p>
              <button type="button" className="cursor-pointer text-xs text-primary hover:underline" onClick={() => setTargets(targets.length === cards.length ? [] : cards.map((c) => c.id))}>{targets.length === cards.length ? 'Clear' : 'Select all'}</button></div>
            <div className="max-h-48 space-y-1 overflow-y-auto rounded-2xl border border-border p-2">
              {cards.map((c) => <Checkbox key={c.id} id={`cp-${c.id}`} checked={targets.includes(c.id)} onChange={() => flip(targets, setTargets, c.id)} label={<span>{c.name} <span className="text-xs text-muted-foreground">/{c.url_alias}</span></span>} />)}
            </div>
          </div>
          <div>
            <p className="mb-2 text-sm font-medium">What to copy</p>
            <div className="space-y-1 rounded-2xl border border-border p-2">
              {GROUPS.map(([k, label, hint]) => <Checkbox key={k} id={`cg-${k}`} checked={groups.includes(k)} onChange={() => flip(groups, setGroups, k)} label={<span>{label} <span className="block text-xs text-muted-foreground">{hint}</span></span>} />)}
            </div>
          </div>
          <p className="text-xs text-muted-foreground">This replaces those details on the chosen cards. Photos, cover images, services, gallery and each card&apos;s link are not touched.</p>
        </div>
      )}
    </Dialog>
  );
}
