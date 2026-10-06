import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { ShieldCheck, ShieldOff, Copy, Download, KeyRound, Smartphone } from 'lucide-react';
import api from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Card, CardHeader, CardBody, Button, Field, Input, Badge, Dialog, run } from '@/components/ui';

function CodeInput({ value, onChange, autoFocus }) {
  return <Input value={value} onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" placeholder="123456" className="text-center font-mono text-lg tracking-[0.5em]" autoFocus={autoFocus} />;
}

function RecoveryCodes({ codes }) {
  const text = codes.join('\n');
  return (
    <div className="space-y-3">
      <p className="rounded-xl bg-warning-soft px-4 py-3 text-sm text-warning">Save these one-time recovery codes somewhere safe. Each code signs you in once if you lose your phone.</p>
      <div className="grid grid-cols-2 gap-2 rounded-2xl border border-border bg-muted/40 p-4 font-mono text-sm">{codes.map((c) => <span key={c}>{c}</span>)}</div>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => { navigator.clipboard?.writeText(text); toast.success('Codes copied'); }}><Copy />Copy</Button>
        <Button variant="outline" size="sm" onClick={() => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'text/plain' })); a.download = 'recovery-codes.txt'; a.click(); }}><Download />Download</Button>
      </div>
    </div>
  );
}

/** Two-factor authentication (TOTP) card for the profile page */
export default function TwoFactor() {
  const { user, setUser } = useAuth();
  const [setup, setSetup] = useState(null);
  const [code, setCode] = useState('');
  const [codes, setCodes] = useState(null);
  const [disable, setDisable] = useState(false);
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const start = async () => { setBusy(true); try { const { data } = await api.post('/auth/2fa/setup'); setSetup(data); setCode(''); } catch (e) { toast.error(e.message); } finally { setBusy(false); } };
  const enable = async () => {
    setBusy(true);
    try { const d = await run(api.post('/auth/2fa/enable', { code })); setCodes(d.recovery_codes); setSetup(null); setUser({ ...user, two_factor_enabled: true }); } catch { /* toast */ } finally { setBusy(false); }
  };
  const regen = async () => { setBusy(true); try { const d = await run(api.post('/auth/2fa/recovery-codes', { code })); setCodes(d.recovery_codes); setCode(''); } catch { /* toast */ } finally { setBusy(false); } };
  const off = async () => { setBusy(true); try { await run(api.post('/auth/2fa/disable', { password: pw })); setUser({ ...user, two_factor_enabled: false }); setDisable(false); setPw(''); } catch { /* toast */ } finally { setBusy(false); } };
  return (
    <Card>
      <CardHeader icon={ShieldCheck} title="Two-factor authentication" description="Protect your account with a code from an authenticator app (Google Authenticator, Authy, 1Password...)"
        actions={user.two_factor_enabled ? <Badge tone="success" dot>Enabled</Badge> : <Badge tone="warning" dot>Off</Badge>} />
      <CardBody>
        <AnimatePresence mode="wait">
          {codes ? (
            <motion.div key="codes" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}><RecoveryCodes codes={codes} /><Button className="mt-4" onClick={() => setCodes(null)}>Done</Button></motion.div>
          ) : setup ? (
            <motion.div key="setup" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="grid gap-6 md:grid-cols-[200px_1fr]">
              <div className="rounded-2xl border border-border bg-white p-3"><img src={setup.qr} alt="Scan with your authenticator app" className="w-full" /></div>
              <div className="space-y-4">
                <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
                  <li>Open your authenticator app and scan the QR code.</li>
                  <li>Or enter this key manually: <code className="rounded bg-muted px-1.5 py-0.5 text-xs break-all text-foreground">{setup.secret}</code></li>
                  <li>Type the 6-digit code it shows.</li>
                </ol>
                <Field label="Verification code"><CodeInput value={code} onChange={setCode} autoFocus /></Field>
                <div className="flex gap-2"><Button onClick={enable} loading={busy} disabled={code.length !== 6}><ShieldCheck />Enable 2FA</Button><Button variant="ghost" onClick={() => setSetup(null)}>Cancel</Button></div>
              </div>
            </motion.div>
          ) : user.two_factor_enabled ? (
            <motion.div key="on" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
              <p className="flex items-center gap-2 text-sm"><Smartphone className="size-4 text-success" />You will be asked for a code from your authenticator app every time you sign in.</p>
              <div className="flex flex-wrap items-end gap-2">
                <Field label="Current code (to create new recovery codes)"><CodeInput value={code} onChange={setCode} /></Field>
                <Button variant="outline" onClick={regen} loading={busy} disabled={code.length !== 6}><KeyRound />New recovery codes</Button>
                <Button variant="danger-soft" onClick={() => setDisable(true)}><ShieldOff />Turn off</Button>
              </div>
            </motion.div>
          ) : (
            <motion.div key="off" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-wrap items-center justify-between gap-4">
              <p className="max-w-md text-sm text-muted-foreground">Even if someone learns your password, they can't sign in without your phone.</p>
              <Button onClick={start} loading={busy}><ShieldCheck />Set up 2FA</Button>
            </motion.div>
          )}
        </AnimatePresence>
      </CardBody>
      <Dialog open={disable} onOpenChange={setDisable} size="sm" icon={ShieldOff} title="Turn off two-factor authentication?" description="Confirm with your password."
        footer={<><Button variant="outline" onClick={() => setDisable(false)}>Cancel</Button><Button variant="danger" onClick={off} loading={busy} disabled={!pw}>Turn off</Button></>}>
        <Input type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Password" autoComplete="current-password" />
      </Dialog>
    </Card>
  );
}
