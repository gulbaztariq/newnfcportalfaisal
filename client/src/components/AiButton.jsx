import { useState } from 'react';
import { motion } from 'motion/react';
import { Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/cn';

/** "Write with AI" button. Calls /user/ai/describe and hands back the generated text. */
export default function AiButton({ kind = 'product', title, details, onResult, className, label = 'Write with AI' }) {
  const { settings } = useAuth();
  const [busy, setBusy] = useState(false);
  if (settings.ai_enable !== '1') return null;
  const go = async () => {
    if (!title) { toast.info('Add a name or title first so the AI knows what to write about'); return; }
    setBusy(true);
    try { const { data } = await api.post('/user/ai/describe', { kind, title, details: details || '' }); onResult(data.description); toast.success('Draft written - review and edit it'); } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };
  return (
    <button type="button" onClick={go} disabled={busy} className={cn('group inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-linear-to-r from-violet-500/10 to-fuchsia-500/10 px-2.5 py-1 text-xs font-semibold text-primary transition hover:from-violet-500/20 hover:to-fuchsia-500/20 disabled:opacity-60', className)}>
      <motion.span animate={busy ? { rotate: 360 } : { rotate: 0 }} transition={busy ? { repeat: Infinity, duration: 1, ease: 'linear' } : {}}><Sparkles className="size-3.5" /></motion.span>
      {busy ? 'Writing...' : label}
    </button>
  );
}
