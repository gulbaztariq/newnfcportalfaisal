import { Download } from 'lucide-react';
import { Button, Menu, MenuTrigger, MenuContent, MenuItem } from '@/components/ui';

/** CSV / Excel / PDF download menu for an /export/:what endpoint */
export default function ExportMenu({ what, label = 'Export', base = '/api/user/export' }) {
  return (
    <Menu>
      <MenuTrigger asChild><Button variant="outline" size="sm"><Download />{label}</Button></MenuTrigger>
      <MenuContent>{[['csv', 'CSV'], ['xlsx', 'Excel (XLSX)'], ['pdf', 'PDF']].map(([f, l]) => <MenuItem key={f} onSelect={() => { window.location.href = `${base}/${what}${what.includes('?') ? '&' : '?'}format=${f}`; }}>{l}</MenuItem>)}</MenuContent>
    </Menu>
  );
}
