import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Mail, Copy, Code2, Download, Check } from 'lucide-react';
import api from '@/lib/api';
import { PageHeader, Card, CardHeader, CardBody, Button, Field, Input, Select, Segmented, SwitchRow, Skeleton, EmptyState, ColorInput } from '@/components/ui';

const wrap = (html) => `<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0;padding:18px;background:#ffffff;">${html}</body></html>`;

export default function Signatures() {
  const [cards, setCards] = useState(null);
  const [id, setId] = useState('');
  const [o, setO] = useState({ style: 'classic', color: '', photo: true, qr: false, social: true, button: 'Save my contact' });
  const [styles, setStyles] = useState({ classic: 'Classic', modern: 'Modern bar', compact: 'Compact', banner: 'With button' });
  const [html, setHtml] = useState('');
  const [done, setDone] = useState('');
  const frame = useRef(null);
  useEffect(() => { api.get('/user/vcards').then(({ data }) => { setCards(data.data); if (data.data[0]) setId(String(data.data[0].id)); }).catch(() => setCards([])); }, []);
  useEffect(() => {
    if (!id) return undefined;
    const t = setTimeout(() => {
      const params = { style: o.style, photo: o.photo ? 1 : 0, qr: o.qr ? 1 : 0, social: o.social ? 1 : 0, button: o.button };
      if (/^#[0-9a-f]{6}$/i.test(o.color)) params.color = o.color;
      api.get(`/user/vcards/${id}/signature`, { params }).then(({ data }) => { setHtml(data.html); setStyles(data.styles); }).catch((e) => toast.error(e.message));
    }, 250);
    return () => clearTimeout(t);
  }, [id, o]);
  const flag = (k) => { setDone(k); setTimeout(() => setDone(''), 1800); };
  /** copies the signature as formatted text (paste straight into Gmail / Outlook settings), falling back to selecting the preview */
  const copyRich = async () => {
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'text/html': new Blob([html], { type: 'text/html' }), 'text/plain': new Blob([html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()], { type: 'text/plain' }) })]);
      flag('rich'); toast.success('Signature copied. Paste it into your email settings.');
    } catch {
      try { const d = frame.current.contentDocument; const r = d.createRange(); r.selectNodeContents(d.body); const s = d.defaultView.getSelection(); s.removeAllRanges(); s.addRange(r); d.execCommand('copy'); s.removeAllRanges(); flag('rich'); toast.success('Signature copied. Paste it into your email settings.'); } catch { toast.error('Copy is blocked here. Use "Copy HTML code" instead.'); }
    }
  };
  const copyCode = async () => { try { await navigator.clipboard.writeText(html); flag('code'); toast.success('HTML code copied'); } catch { toast.error('Copy is blocked in this browser'); } };
  const download = () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([wrap(html)], { type: 'text/html' })); a.download = 'email-signature.html'; a.click(); URL.revokeObjectURL(a.href); };

  if (!cards) return <Skeleton className="h-96 rounded-2xl" />;
  if (!cards.length) return <><PageHeader title="Email signature" description="A signature that links to your digital card." /><EmptyState icon={Mail} title="Create a vCard first" description="Your signature is built from your card's details." /></>;
  const set = (patch) => setO((x) => ({ ...x, ...patch }));
  return (
    <>
      <PageHeader title="Email signature" description="A ready-made signature with your details and a link to your digital card. Clicks are counted under Analytics > Campaigns." />
      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <Card>
          <CardHeader icon={Mail} title="Design" />
          <CardBody className="space-y-4">
            {cards.length > 1 && <Field label="Card"><Select value={id} onChange={setId} options={cards.map((c) => ({ value: String(c.id), label: c.name }))} /></Field>}
            <Field label="Style"><Segmented id="sig-style" value={o.style} onChange={(v) => set({ style: v })} options={Object.entries(styles).map(([value, label]) => ({ value, label }))} size="sm" /></Field>
            <ColorInput label="Accent colour (empty = your card colour)" value={o.color} onChange={(v) => set({ color: v })} />
            <SwitchRow id="sig-photo" title="Profile photo" checked={o.photo} onChange={(v) => set({ photo: v })} />
            <SwitchRow id="sig-social" title="Social links" checked={o.social} onChange={(v) => set({ social: v })} />
            <SwitchRow id="sig-qr" title="QR code" description="Skipped when your card uses a styled QR" checked={o.qr} onChange={(v) => set({ qr: v })} />
            {o.style === 'banner' && <Field label="Button text"><Input value={o.button} maxLength={40} onChange={(e) => set({ button: e.target.value })} /></Field>}
          </CardBody>
        </Card>
        <div className="space-y-4">
          <Card>
            <CardHeader icon={Mail} title="Preview" actions={<div className="flex flex-wrap gap-2"><Button size="sm" onClick={copyRich} disabled={!html}>{done === 'rich' ? <Check /> : <Copy />}Copy signature</Button><Button size="sm" variant="outline" onClick={copyCode} disabled={!html}>{done === 'code' ? <Check /> : <Code2 />}Copy HTML code</Button><Button size="sm" variant="outline" onClick={download} disabled={!html}><Download />Download</Button></div>} />
            <CardBody><iframe ref={frame} title="Signature preview" sandbox="allow-same-origin" srcDoc={wrap(html)} className="h-56 w-full rounded-xl border border-border bg-white" /></CardBody>
          </Card>
          <Card>
            <CardHeader title="How to add it" />
            <CardBody className="space-y-2 text-sm text-muted-foreground">
              <p><b className="text-foreground">Gmail:</b> Settings, See all settings, Signature, Create new, then paste after "Copy signature".</p>
              <p><b className="text-foreground">Outlook:</b> Settings, Mail, Compose and reply, Email signature, then paste.</p>
              <p><b className="text-foreground">Apple Mail / others without paste:</b> use "Copy HTML code" or "Download" and follow your app's HTML signature option.</p>
              <p>Your photo and QR load from your card's address, so they show for people who allow images.</p>
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
