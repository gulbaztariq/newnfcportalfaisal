import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { motion } from 'motion/react';
import { toast } from 'sonner';
import {
  ArrowLeft, Eye, MessageSquareText, CalendarClock, MailCheck, Smartphone, Globe2, Check, X, Trash2, CalendarDays, List, Download, ChevronLeft, ChevronRight,
  MonitorPlay, RefreshCw, ImageDown,
} from 'lucide-react';
import api from '@/lib/api';
import { cn } from '@/lib/cn';
import { fmtDate, fmtDateTime } from '@/lib/format';
import {
  PageHeader, Card, CardHeader, CardBody, Button, ButtonLink, Field, Select, Switch, Badge, StatusBadge, StatCard, EmptyState, Skeleton, Segmented,
  TableCard, DataTable, Action, Actions, FilterSelect, UserCell, Menu, MenuTrigger, MenuContent, MenuItem, useList, run, confirm, ColorInput,
} from '@/components/ui';
import { AreaTrend, Donut } from '@/components/ui/charts';
import ExportMenu from '@/components/ExportMenu';

export { ExportMenu };

/* ------------------------------------------------------ vCard analytics */
export function VcardAnalytics() {
  const { id } = useParams();
  const [days, setDays] = useState('30');
  const [d, setD] = useState(null);
  useEffect(() => { setD(null); api.get(`/user/vcards/${id}/analytics`, { params: { days } }).then(({ data }) => setD(data)); }, [id, days]);
  return (
    <>
      <Link to={`/user/vcards/${id}/edit`} className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" />Back to editor</Link>
      <PageHeader title="Card analytics" description="Who is opening your card and how they found it.">
        <Segmented id="ad" value={days} onChange={setDays} options={[{ value: '7', label: '7 days' }, { value: '30', label: '30 days' }, { value: '90', label: '90 days' }, { value: '365', label: 'Year' }]} />
      </PageHeader>
      {!d ? <Skeleton className="h-96 rounded-3xl" /> : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard index={0} icon={Eye} color="violet" label="Views in period" value={d.period} hint={`${d.total.toLocaleString()} all time`} />
            <StatCard index={1} icon={MessageSquareText} color="pink" label="Enquiries" value={d.enquiries} to="/user/enquiries" />
            <StatCard index={2} icon={CalendarClock} color="sky" label="Appointments" value={d.appointments} to="/user/appointments" />
            <StatCard index={3} icon={MailCheck} color="emerald" label="Subscribers" value={d.subscribers} to="/user/subscribers" />
          </div>
          <div className="mt-6 grid gap-6 xl:grid-cols-3">
            <Card className="xl:col-span-2"><CardHeader icon={Eye} title="Views" /><CardBody><AreaTrend data={d.byDay} name="Views" height={300} /></CardBody></Card>
            <Card><CardHeader icon={Smartphone} title="Devices" /><CardBody>{d.devices.length ? <Donut data={d.devices.map((x) => ({ ...x, name: x.name[0].toUpperCase() + x.name.slice(1) }))} center="views" height={220} /> : <EmptyState icon={Smartphone} title="No views yet" />}</CardBody></Card>
          </div>
          <Card className="mt-6">
            <CardHeader icon={Globe2} title="Top sources" description="Direct includes NFC taps, QR scans and shared links" />
            <CardBody>
              {!d.referrers.length ? <EmptyState icon={Globe2} title="No data yet" /> : (
                <div className="space-y-3">
                  {d.referrers.map((r, i) => {
                    const pct = Math.round((r.value / d.period) * 100);
                    return (
                      <div key={r.name}>
                        <div className="mb-1 flex justify-between text-sm"><span className="font-medium">{r.name}</span><span className="text-muted-foreground">{r.value} · {pct}%</span></div>
                        <div className="h-2 overflow-hidden rounded-full bg-muted"><motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ delay: i * 0.08, duration: 0.8, ease: [0.16, 1, 0.3, 1] }} className="h-full rounded-full bg-linear-to-r from-violet-500 to-fuchsia-500" /></div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardBody>
          </Card>
        </>
      )}
    </>
  );
}

/* --------------------------------------------------------- appointments */
const APPT_STATUS = [['pending', 'Pending'], ['confirmed', 'Confirmed'], ['completed', 'Completed'], ['cancelled', 'Cancelled']];
export function Appointments() {
  const [view, setView] = useState('list');
  const list = useList('/user/appointments');
  const setStatus = async (a, status) => { a.status = status; await run(api.patch(`/user/appointments/${a.id}`, { status }), `Appointment ${status}`).catch(() => {}); list.reload(); };
  const remove = async (a) => { if (await confirm({ title: 'Delete this appointment?' })) { await run(api.delete(`/user/appointments/${a.id}`)).catch(() => {}); list.reload(); } };
  return (
    <>
      <PageHeader title="Appointments" description="Bookings made from your vCards. Customers are e-mailed when you confirm or cancel.">
        <Segmented id="av" value={view} onChange={setView} options={[{ value: 'list', label: 'List', icon: List }, { value: 'calendar', label: 'Calendar', icon: CalendarDays }]} />
        <ExportMenu what="appointments" />
      </PageHeader>
      {view === 'calendar' ? <ApptCalendar /> : (
        <TableCard title="All appointments" list={list} toolbar={<FilterSelect value={list.params.status} onChange={(v) => list.set({ status: v })} placeholder="All statuses" options={APPT_STATUS.map(([value, label]) => ({ value, label }))} />}>
          <DataTable loading={list.loading} rows={list.rows} empty={<EmptyState icon={CalendarClock} title="No appointments yet" description="Enable appointments in your vCard editor to start taking bookings." />} columns={[
            { key: 'when', label: 'When', render: (a) => <div><p className="font-medium">{fmtDate(a.date)}</p><p className="text-xs text-muted-foreground">{a.from_time} - {a.to_time}</p></div> },
            { key: 'who', label: 'Customer', render: (a) => <div><p className="font-medium">{a.name}</p><p className="text-xs text-muted-foreground">{a.email || a.phone}</p></div> },
            { key: 'card', label: 'vCard', render: (a) => <div><Badge tone="outline">{a.vcard?.name}</Badge>{a.service_name && <p className="mt-1 text-xs text-muted-foreground">{a.service_name}</p>}</div> },
            { key: 'notes', label: 'Notes', className: 'whitespace-normal', render: (a) => <p className="max-w-xs text-sm text-muted-foreground">{a.notes || '-'}</p> },
            { key: 'status', label: 'Status', render: (a) => <StatusBadge value={a.status === 'confirmed' || a.status === 'completed' ? 'approved' : a.status}>{a.status[0].toUpperCase() + a.status.slice(1)}</StatusBadge> },
            {
              key: '_a', label: '', className: 'text-right', render: (a) => (
                <Actions>
                  {a.status === 'pending' && <Action icon={Check} label="Confirm" tone="success" onClick={() => setStatus(a, 'confirmed')} />}
                  {a.status === 'confirmed' && <Action icon={Check} label="Mark completed" tone="info" onClick={() => setStatus(a, 'completed')} />}
                  {a.status !== 'cancelled' && a.status !== 'completed' && <Action icon={X} label="Cancel" tone="warning" onClick={() => setStatus(a, 'cancelled')} />}
                  <Action icon={Trash2} label="Delete" tone="danger" onClick={() => remove(a)} />
                </Actions>
              ),
            },
          ]} />
        </TableCard>
      )}
    </>
  );
}

function ApptCalendar() {
  const [month, setMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [rows, setRows] = useState([]);
  const key = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`;
  useEffect(() => { api.get('/user/appointments/calendar', { params: { month: key } }).then(({ data }) => setRows(data.data)); }, [key]);
  const cells = useMemo(() => {
    const start = (month.getDay() + 6) % 7;
    const daysIn = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    return Array.from({ length: Math.ceil((start + daysIn) / 7) * 7 }, (_, i) => (i < start || i >= start + daysIn ? null : i - start + 1));
  }, [month]);
  const today = new Date().toISOString().slice(0, 10);
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <p className="font-display text-lg font-semibold">{month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</p>
        <div className="flex gap-1">
          <Button variant="outline" size="icon-sm" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} aria-label="Previous month"><ChevronLeft /></Button>
          <Button variant="outline" size="sm" onClick={() => { const d = new Date(); setMonth(new Date(d.getFullYear(), d.getMonth(), 1)); }}>Today</Button>
          <Button variant="outline" size="icon-sm" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} aria-label="Next month"><ChevronRight /></Button>
        </div>
      </div>
      <div className="grid grid-cols-7 border-b border-border bg-muted/40 text-center text-xs font-semibold text-muted-foreground uppercase">{['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => <div key={d} className="py-2">{d}</div>)}</div>
      <div className="grid grid-cols-7">
        {cells.map((day, i) => {
          const iso = day ? `${key}-${String(day).padStart(2, '0')}` : null;
          const items = iso ? rows.filter((r) => r.date === iso) : [];
          return (
            <div key={i} className={cn('min-h-28 border-r border-b border-border p-1.5 [&:nth-child(7n)]:border-r-0', !day && 'bg-muted/30')}>
              {day && <span className={cn('mb-1 inline-grid size-6 place-items-center rounded-full text-xs font-semibold', iso === today ? 'bg-primary text-white' : 'text-muted-foreground')}>{day}</span>}
              <div className="space-y-1">
                {items.slice(0, 3).map((a) => <div key={a.id} title={`${a.name} · ${a.vcard?.name}`} className={cn('truncate rounded-md px-1.5 py-0.5 text-[11px] font-medium', a.status === 'confirmed' || a.status === 'completed' ? 'bg-success-soft text-success' : 'bg-warning-soft text-warning')}>{a.from_time} {a.name}</div>)}
                {items.length > 3 && <p className="px-1 text-[11px] text-muted-foreground">+{items.length - 3} more</p>}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

/* ---------------------------------------------------------- subscribers */
export function Subscribers() {
  const list = useList('/user/subscribers');
  const remove = async (s) => { if (await confirm({ title: `Remove ${s.email}?` })) { await run(api.delete(`/user/subscribers/${s.id}`)).catch(() => {}); list.reload(); } };
  return (
    <>
      <PageHeader title="Subscribers" description="People who joined the newsletter popup on your cards."><ExportMenu what="subscribers" /></PageHeader>
      <TableCard title="Newsletter subscribers" list={list}>
        <DataTable loading={list.loading} rows={list.rows} empty={<EmptyState icon={MailCheck} title="No subscribers yet" description="Turn on the newsletter popup in your vCard's Advanced settings." />} columns={[
          { key: 'email', label: 'E-mail', render: (s) => <a href={`mailto:${s.email}`} className="font-medium hover:text-primary">{s.email}</a> },
          { key: 'card', label: 'vCard', render: (s) => <Badge tone="outline">{s.vcard?.name}</Badge> },
          { key: 'date', label: 'Subscribed', render: (s) => <span className="text-muted-foreground">{fmtDateTime(s.created_at)}</span> },
          { key: '_a', label: '', className: 'text-right', render: (s) => <Actions><Action icon={Trash2} label="Remove" tone="danger" onClick={() => remove(s)} /></Actions> },
        ]} />
      </TableCard>
    </>
  );
}

/* ------------------------------------------------- virtual background */
const BG_STYLES = [['aurora', 'Aurora'], ['minimal', 'Minimal'], ['split', 'Split'], ['dark', 'Midnight']];
function drawBackground(canvas, { style, primary, secondary, name, title, company, email, phone, qr, logo }) {
  const W = 1920; const H = 1080;
  canvas.width = W; canvas.height = H;
  const c = canvas.getContext('2d');
  const grad = c.createLinearGradient(0, 0, W, H);
  if (style === 'dark') { grad.addColorStop(0, '#0b0b14'); grad.addColorStop(1, '#1a1433'); } else if (style === 'minimal') { grad.addColorStop(0, '#f7f7fb'); grad.addColorStop(1, '#eceaf6'); } else { grad.addColorStop(0, primary); grad.addColorStop(1, secondary); }
  c.fillStyle = grad; c.fillRect(0, 0, W, H);
  if (style === 'aurora' || style === 'dark') {
    for (const [x, y, r, col] of [[W * 0.85, H * 0.1, 520, 'rgba(255,255,255,.18)'], [W * 0.1, H * 0.95, 480, 'rgba(255,255,255,.1)']]) {
      const g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, style === 'dark' ? primary : col); g.addColorStop(1, 'rgba(0,0,0,0)'); c.globalAlpha = style === 'dark' ? 0.45 : 1; c.fillStyle = g; c.fillRect(0, 0, W, H); c.globalAlpha = 1;
    }
  }
  if (style === 'split') { c.fillStyle = 'rgba(255,255,255,.95)'; c.fillRect(W * 0.62, 0, W * 0.38, H); }
  const light = style === 'minimal' || style === 'split';
  const tx = light ? '#16162a' : '#ffffff';
  const panelX = style === 'split' ? W * 0.65 : W - 640; const panelY = H - 380;
  if (style !== 'split') { c.fillStyle = light ? 'rgba(255,255,255,.85)' : 'rgba(255,255,255,.12)'; c.beginPath(); c.roundRect(panelX - 40, panelY - 40, 620, 340, 36); c.fill(); }
  c.fillStyle = tx; c.font = '700 64px Inter, system-ui, sans-serif'; c.fillText(name || 'Your Name', panelX, panelY + 40, 520);
  c.globalAlpha = 0.8; c.font = '500 34px Inter, system-ui, sans-serif'; c.fillText([title, company].filter(Boolean).join(' · ') || 'Your title', panelX, panelY + 95, 520);
  c.font = '400 28px Inter, system-ui, sans-serif'; if (email) c.fillText(email, panelX, panelY + 170, 360); if (phone) c.fillText(phone, panelX, panelY + 215, 360); c.globalAlpha = 1;
  if (qr) { c.fillStyle = '#fff'; c.beginPath(); c.roundRect(panelX + 380, panelY + 130, 170, 170, 18); c.fill(); c.drawImage(qr, panelX + 390, panelY + 140, 150, 150); }
  if (logo) { c.save(); c.beginPath(); c.arc(140, 140, 70, 0, Math.PI * 2); c.clip(); c.drawImage(logo, 70, 70, 140, 140); c.restore(); }
}
const loadImg = (src) => new Promise((resolve) => { if (!src) return resolve(null); const i = new Image(); i.crossOrigin = 'anonymous'; i.onload = () => resolve(i); i.onerror = () => resolve(null); i.src = src; });

export function VirtualBackground() {
  const [vcards, setVcards] = useState([]);
  const [sel, setSel] = useState('');
  const [style, setStyle] = useState('aurora');
  const [colors, setColors] = useState({ primary: '#6d5dfc', secondary: '#b44cf5' });
  const [withQr, setWithQr] = useState(true);
  const canvas = useRef(null);
  const [features, setFeatures] = useState(null);
  useEffect(() => { api.get('/user/vcards').then(({ data }) => { setVcards(data.data); if (data.data[0]) setSel(String(data.data[0].id)); }); api.get('/user/features').then(({ data }) => setFeatures(data.features)); }, []);
  const v = vcards.find((x) => String(x.id) === sel);
  useEffect(() => { if (v?.theme?.primary) setColors({ primary: v.theme.primary, secondary: v.theme.secondary || v.theme.primary }); }, [v?.id]); // eslint-disable-line
  useEffect(() => {
    if (!canvas.current) return;
    let alive = true;
    Promise.all([withQr && v ? loadImg(`/api/user/vcards/${v.id}/qrcode?size=300`) : null, v?.profile_image ? loadImg(v.profile_image) : null]).then(([qr, logo]) => {
      if (!alive) return;
      drawBackground(canvas.current, { style, ...colors, name: v ? [v.first_name, v.last_name].filter(Boolean).join(' ') || v.name : '', title: v?.job_title || v?.occupation, company: v?.company, email: v?.email, phone: v?.phone ? `+${v.region_code || ''} ${v.phone}` : '', qr, logo });
    });
    return () => { alive = false; };
  }, [v, style, colors, withQr]);
  const download = () => { const a = document.createElement('a'); a.download = `${v?.url_alias || 'virtual'}-background.png`; a.href = canvas.current.toDataURL('image/png'); a.click(); toast.success('Background downloaded - set it in Zoom, Teams or Meet'); };
  if (features && !features.virtual_background) {
    return <><PageHeader title="Virtual background" /><Card><EmptyState icon={MonitorPlay} title="Virtual backgrounds aren't in your plan" action={<ButtonLink as={Link} to="/user/plans">Upgrade plan</ButtonLink>} /></Card></>;
  }
  return (
    <>
      <PageHeader title="Virtual background" description="A branded background for Zoom, Google Meet and Teams with your details and QR code." />
      <div className="grid gap-6 xl:grid-cols-[340px_1fr]">
        <Card className="h-fit">
          <CardHeader icon={MonitorPlay} title="Design" />
          <CardBody className="space-y-4">
            <Field label="vCard"><Select value={sel} onChange={setSel} options={vcards.map((x) => ({ value: String(x.id), label: x.name }))} /></Field>
            <Field label="Style">
              <div className="grid grid-cols-2 gap-2">{BG_STYLES.map(([k, l]) => <button key={k} type="button" onClick={() => setStyle(k)} className={cn('cursor-pointer rounded-xl border-2 px-3 py-2 text-sm font-medium transition', style === k ? 'border-primary bg-primary-soft text-primary' : 'border-border hover:border-primary/40')}>{l}</button>)}</div>
            </Field>
            <div className="grid grid-cols-2 gap-3"><ColorInput label="Primary" value={colors.primary} onChange={(x) => setColors({ ...colors, primary: x })} /><ColorInput label="Secondary" value={colors.secondary} onChange={(x) => setColors({ ...colors, secondary: x })} /></div>
            <label className="flex cursor-pointer items-center justify-between rounded-2xl border border-border p-3 text-sm font-medium">Show QR code<Switch checked={withQr} onChange={setWithQr} /></label>
            <Button className="w-full" size="lg" onClick={download} disabled={!v}><ImageDown />Download 1920×1080 PNG</Button>
          </CardBody>
        </Card>
        <Card className="overflow-hidden p-3">
          <canvas ref={canvas} className="aspect-video w-full rounded-2xl shadow-lift" />
          <p className="mt-3 flex items-center gap-2 px-2 text-xs text-muted-foreground"><RefreshCw className="size-3.5" />Preview updates as you change options. Most apps mirror your own view - others see it the right way round.</p>
        </Card>
      </div>
    </>
  );
}
