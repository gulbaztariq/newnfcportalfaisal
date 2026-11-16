/* vCard editor: gallery extras (audio clips, short videos and PDF files). */
import { useRef, useState } from 'react';
import { Music, FileText, Film, Plus, Trash2, Upload } from 'lucide-react';
import api, { toFormData } from '@/lib/api';
import { Card, CardHeader, CardBody, Button, Field, Input, Dialog, run, confirm } from '@/components/ui';

const ICON = { audio: Music, video: Film, file: FileText };
const KIND = { audio: 'Audio', video: 'Video', file: 'PDF file' };
const MAX_MB = 15;

export function GalleryMedia({ vcardId, items, onChange }) {
  const media = (items || []).filter((g) => ['audio', 'video', 'file'].includes(g.type));
  const [open, setOpen] = useState(false);
  const [caption, setCaption] = useState('');
  const [file, setFile] = useState(null);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const input = useRef(null);
  const start = () => { setCaption(''); setFile(null); setErrors({}); setOpen(true); };
  const save = async () => {
    const e = {};
    if (!caption.trim()) e.caption = 'Title is required';
    if (!file) e.file = 'File is required';
    else if (file.size > MAX_MB * 1024 * 1024) e.file = `File must be ${MAX_MB} MB or smaller`;
    if (Object.keys(e).length) { setErrors(e); return; }
    setBusy(true);
    try { const d = await run(api.post(`/user/vcards/${vcardId}/gallery-media`, toFormData({ caption, file }))); onChange([...(items || []), d.data]); setOpen(false); } catch (ex) { setErrors(ex.errors || { file: ex.message }); } finally { setBusy(false); }
  };
  const remove = async (it) => { if (await confirm({ title: `Remove ${it.caption || 'this file'}?` })) { await run(api.delete(`/user/vcards/${vcardId}/gallery/${it.id}`), 'Removed').catch(() => {}); onChange(items.filter((i) => i.id !== it.id)); } };
  return (
    <>
      <Card className="mt-5">
        <CardHeader icon={Music} title={`Audio, video and files (${media.length})`} description="Shown under your photos: an audio player, a video player or a download link" actions={<Button size="sm" onClick={start}><Plus />Add</Button>} />
        <CardBody>
          {!media.length ? <p className="text-sm text-muted-foreground">Nothing here yet. Add an MP3, a short MP4 video or a PDF such as a price list or brochure.</p> : (
            <div className="space-y-2">
              {media.map((it) => { const Ic = ICON[it.type] || FileText; return (
                <div key={it.id} className="flex items-center gap-3 rounded-2xl border border-border p-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary"><Ic className="size-5" /></span>
                  <div className="min-w-0 flex-1"><p className="truncate font-medium">{it.caption}</p><p className="text-xs text-muted-foreground">{KIND[it.type]}</p></div>
                  <Button variant="danger-soft" size="icon-sm" onClick={() => remove(it)} aria-label="Delete"><Trash2 /></Button>
                </div>
              ); })}
            </div>
          )}
        </CardBody>
      </Card>
      <Dialog open={open} onOpenChange={setOpen} icon={Upload} title="Add audio, video or a file" description={`MP3, WAV, OGG, M4A, MP4 or PDF, up to ${MAX_MB} MB`}
        footer={<><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={save} loading={busy}>Upload</Button></>}>
        <div className="grid gap-4">
          <Field label="Title" required error={errors.caption}><Input value={caption} maxLength={150} onChange={(e) => { setCaption(e.target.value); setErrors((x) => ({ ...x, caption: undefined })); }} placeholder="e.g. Our jingle, Price list 2026" /></Field>
          <Field label="File" required error={errors.file}>
            <input ref={input} type="file" className="hidden" accept="audio/mpeg,audio/wav,audio/ogg,audio/mp4,audio/x-m4a,video/mp4,application/pdf,.mp3,.wav,.ogg,.m4a,.mp4,.pdf" onChange={(e) => { setFile(e.target.files?.[0] || null); setErrors((x) => ({ ...x, file: undefined })); }} />
            <Button variant="outline" onClick={() => input.current?.click()}><Upload />{file ? file.name : 'Choose a file'}</Button>
          </Field>
        </div>
      </Dialog>
    </>
  );
}
