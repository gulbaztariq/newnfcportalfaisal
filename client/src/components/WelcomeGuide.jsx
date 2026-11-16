/* Welcome guide: a short step-by-step tour shown to a user the first time they open the dashboard. It can be reopened any time. */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { IdCard, Palette, Share2, CreditCard, PartyPopper, ArrowRight, ArrowLeft, Compass } from 'lucide-react';
import { Dialog, Button, ButtonLink } from '@/components/ui';

const STEPS = [
  { icon: PartyPopper, title: 'Welcome!', text: 'Your digital business card is a web page with your details. People open it by tapping your NFC card, scanning your QR code or following your link. This short guide shows the four things to do first.' },
  { icon: IdCard, title: '1. Fill in your card', text: 'Open your vCard and add your name, photo, phone, e-mail and social links. Everything you save is live at once, so a printed card never goes out of date.', to: '/user/vcards', cta: 'Open my vCards' },
  { icon: Palette, title: '2. Pick a design', text: 'In the card editor choose a template, then set your colours and font. Use Preview to see it on a phone before you share it.', to: '/user/vcards', cta: 'Choose a design' },
  { icon: Share2, title: '3. Share it', text: 'Each card has a link and a QR code. Download the QR for print, order an NFC card, or just send the link. Analytics shows who opened it and what they tapped.', to: '/user/analytics', cta: 'See analytics' },
  { icon: CreditCard, title: '4. Get paid (optional)', text: 'Add products or paid appointments to your card, then switch on a payment method in Settings. Orders appear under Product Orders.', to: '/user/settings', cta: 'Set up payments' },
];
const KEY = (id) => `welcome-guide-${id}`;

export default function WelcomeGuide({ userId }) {
  const [open, setOpen] = useState(false);
  const [i, setI] = useState(0);
  useEffect(() => { try { if (!localStorage.getItem(KEY(userId))) setOpen(true); } catch { /* storage blocked: the guide stays behind its button */ } }, [userId]);
  const close = () => { setOpen(false); setI(0); try { localStorage.setItem(KEY(userId), '1'); } catch { /* ignore */ } };
  const s = STEPS[i]; const last = i === STEPS.length - 1;
  return (
    <>
      <button type="button" onClick={() => { setI(0); setOpen(true); }} className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-xl border border-white/20 px-4 text-sm font-medium text-white/85 transition hover:bg-white/10"><Compass className="size-4" />Welcome guide</button>
      <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : close())} size="md" icon={s.icon} title={s.title}
        footer={<>
          <span className="mr-auto flex items-center gap-1.5" aria-label={`Step ${i + 1} of ${STEPS.length}`}>{STEPS.map((_, n) => <span key={n} className={`h-1.5 rounded-full transition-all ${n === i ? 'w-6 bg-primary' : 'w-1.5 bg-border'}`} />)}</span>
          {i > 0 && <Button variant="outline" onClick={() => setI(i - 1)}><ArrowLeft />Back</Button>}
          {last ? <Button onClick={close}>Finish</Button> : <Button onClick={() => setI(i + 1)}>Next<ArrowRight /></Button>}
        </>}>
        <p className="text-sm leading-relaxed text-muted-foreground">{s.text}</p>
        {s.to && <div className="mt-4"><ButtonLink as={Link} to={s.to} variant="soft" size="sm" onClick={close}>{s.cta}<ArrowRight /></ButtonLink></div>}
      </Dialog>
    </>
  );
}
