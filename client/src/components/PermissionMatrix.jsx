/* Module x (view / manage) permission grid, shared by admin staff and company members */
import { Eye, PenLine } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Switch, Button, Tip } from '@/components/ui';

export default function PermissionMatrix({ modules, value, onChange, defaults }) {
  const set = new Set(value || []);
  const toggle = (key, on) => {
    const next = new Set(set);
    const [mod, action] = key.split('.');
    if (on) { next.add(key); if (action === 'manage') next.add(`${mod}.view`); } else { next.delete(key); if (action === 'view') next.delete(`${mod}.manage`); }
    onChange([...next]);
  };
  return (
    <div className="rounded-2xl border border-border">
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-2.5">
        <p className="text-sm font-semibold">Permissions</p>
        <div className="flex gap-1.5">
          {defaults && <Button size="xs" variant="ghost" onClick={() => onChange([...defaults])}>Role defaults</Button>}
          <Button size="xs" variant="ghost" onClick={() => onChange(Object.keys(modules).flatMap((m) => [`${m}.view`, `${m}.manage`]))}>All</Button>
          <Button size="xs" variant="ghost" onClick={() => onChange([])}>None</Button>
        </div>
      </div>
      <div className="grid grid-cols-[1fr_auto_auto] items-center gap-x-6 gap-y-1 px-4 py-3 text-sm">
        <span className="text-xs font-medium text-muted-foreground">Module</span>
        <Tip content="Can open and see"><span className="flex items-center gap-1 text-xs font-medium text-muted-foreground"><Eye className="size-3.5" />View</span></Tip>
        <Tip content="Can create, edit and delete"><span className="flex items-center gap-1 text-xs font-medium text-muted-foreground"><PenLine className="size-3.5" />Manage</span></Tip>
        {Object.entries(modules).map(([m, l]) => (
          <div key={m} className="contents">
            <span className={cn('py-1.5', set.has(`${m}.view`) ? 'text-foreground' : 'text-muted-foreground')}>{l}</span>
            <Switch size="sm" checked={set.has(`${m}.view`)} onChange={(v) => toggle(`${m}.view`, v)} />
            <Switch size="sm" checked={set.has(`${m}.manage`)} onChange={(v) => toggle(`${m}.manage`, v)} />
          </div>
        ))}
      </div>
    </div>
  );
}
