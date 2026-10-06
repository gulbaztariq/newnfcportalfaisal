/* Inventory: items with stock per location, adjustments / transfers, movement history, purchases & imports with landed cost */
import { Fragment, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Boxes, Plus, Pencil, Trash2, SlidersHorizontal, ArrowLeftRight, AlertTriangle, Warehouse, History, ShoppingCart, Eye, Globe2, Home, PackagePlus, X, Calculator, MapPin,
} from 'lucide-react';
import api, { toFormData } from '@/lib/api';
import { cn } from '@/lib/cn';
import { fmtDate, fullName, label as humanize } from '@/lib/format';
import {
  PageHeader, Card, CardHeader, CardBody, TableCard, DataTable, SearchInput, FilterSelect, Segmented, Badge, EmptyState, Button, Action, Actions, Dialog,
  Field, Input, Textarea, Select, Switch, Tip, useList, useForm, run, confirm,
} from '@/components/ui';
import {
  pkr, num, qty as fq, sum, ymd, useFetch, useLookup, FadeIn, Tile, Hint, AttachmentLink, DocUpload, FieldControl, blankOf, rowToForm, TotalsRow, TotalItem,
  accountOpt, partnerOpt, vendorOpt,
} from '@/components/BizKit';

export const INVENTORY_CATEGORIES = [
  { value: 'blank_card', label: 'Blank card' }, { value: 'nfc_chip', label: 'NFC chip' }, { value: 'tag', label: 'NFC tag' }, { value: 'sticker', label: 'Sticker' },
  { value: 'standee', label: 'Standee' }, { value: 'packaging', label: 'Packaging' }, { value: 'other', label: 'Other' },
];
const catLabel = (c) => INVENTORY_CATEGORIES.find((x) => x.value === c)?.label || humanize(c);
const locValue = (id) => (id === null || id === undefined || id === '' ? 'main' : String(id));
const locId = (v) => (v === 'main' || v === '' || v === undefined ? null : Number(v));
const locOptions = (locations = []) => locations.map((l) => ({ value: locValue(l.id), label: l.name }));

/* ================================================================== items */
const itemFields = (editing) => [
  { name: 'name', label: 'Item name', required: true, placeholder: 'e.g. PVC blank card (white)' },
  { name: 'sku', label: 'SKU', half: true, placeholder: 'Auto if empty' },
  { name: 'category', label: 'Category', type: 'select', half: true, required: true, default: 'other', options: INVENTORY_CATEGORIES },
  { name: 'unit', label: 'Unit', half: true, default: 'pcs', placeholder: 'pcs, sheets, rolls' },
  { name: 'reorder_level', label: 'Reorder level', type: 'number', min: 0, half: true, default: 0, hint: 'Flag as low stock at or below this quantity (0 = off)' },
  ...(editing ? [] : [{ name: 'purchase_price', label: 'Opening cost per unit', type: 'money', half: true, default: 0, hint: 'Purchases keep this updated as the weighted average landed cost' }]),
  { name: 'sale_price', label: 'Sale price (per unit)', type: 'money', half: true, default: 0, hint: 'Used for the retail value of stock' },
  ...(editing ? [] : [
    { name: 'opening_stock', label: 'Opening stock', type: 'number', min: 0, step: 'any', half: true, placeholder: '0' },
    { name: 'opening_vendor_id', label: 'Opening stock is at', type: 'select', half: true, required: true, default: 'main' },
  ]),
  { name: 'description', label: 'Description', type: 'textarea', rows: 2 },
  { name: 'status', label: 'Active', type: 'switch' },
];

function LocationChips({ locations }) {
  if (!locations?.length) return <span className="text-xs text-muted-foreground">No stock</span>;
  return (
    <div className="flex max-w-xs flex-wrap gap-1">
      {locations.map((l) => (
        <span key={locValue(l.vendor_id)} className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium', l.vendor_id ? 'bg-info-soft text-info' : 'bg-muted text-foreground', num(l.qty) < 0 && 'bg-danger-soft text-danger')}>
          {l.vendor_id ? <MapPin className="size-3" /> : <Home className="size-3" />}{l.name}: {fq(l.qty)}
        </span>
      ))}
    </div>
  );
}

export function InventoryItems() {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [lowOnly, setLowOnly] = useState(false);
  const { data, loading, reload } = useFetch('/admin/inventory/items', { search: search || undefined, category: category || undefined });
  const items = data?.data || [];
  const locations = data?.locations || [];
  const rows = lowOnly ? items.filter((i) => i.low) : items;
  const [editing, setEditing] = useState(null);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const fields = itemFields(!!editing);
  const form = useForm(blankOf(fields));
  const [adjust, setAdjust] = useState(null);
  const [transfer, setTransfer] = useState(null);

  const openForm = (row) => {
    const fs = itemFields(!!row);
    setEditing(row || null); form.setErrors({});
    form.setValues(row ? rowToForm(fs, row) : blankOf(fs));
    setOpen(true);
  };
  const save = async (e) => {
    e?.preventDefault(); setSaving(true);
    const v = { ...form.values };
    if (!editing) v.opening_vendor_id = locId(v.opening_vendor_id);
    try { await run(editing ? api.put(`/admin/inventory/items/${editing.id}`, v) : api.post('/admin/inventory/items', v), editing ? 'Item updated' : 'Item added'); setOpen(false); reload(); } catch (ex) { form.setErrors(ex.errors || {}); } finally { setSaving(false); }
  };
  const remove = async (row) => {
    if (!(await confirm({ title: `Delete "${row.name}"?`, description: 'Its stock history is removed too. Products using it as a component lose that cost.' }))) return;
    await run(api.delete(`/admin/inventory/items/${row.id}`)).catch(() => {}); reload();
  };
  const value = sum(items, 'value');
  const lowCount = items.filter((i) => i.low).length;

  return (
    <>
      <PageHeader eyebrow="Inventory" title="Inventory items" description="Blank cards, NFC chips, tags, standees and packaging. Stock is tracked per location (main store or at a printing vendor) and valued at the weighted average landed cost.">
        <Button onClick={() => openForm()}><Plus />Add item</Button>
      </PageHeader>
      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <FadeIn><Tile label="Items" value={items.length} sub={`${items.filter((i) => i.status).length} active`} /></FadeIn>
        <FadeIn delay={0.05}><Tile label="Units in stock" value={fq(sum(items, 'stock'))} sub={`Across ${locations.length} location(s)`} /></FadeIn>
        <FadeIn delay={0.1}><Tile label="Stock value" value={pkr(value)} hint="Quantity on hand x weighted average landed cost." sub={`Retail ${pkr(sum(items, (i) => num(i.stock) * num(i.sale_price)))}`} /></FadeIn>
        <FadeIn delay={0.15}>
          <button type="button" onClick={() => setLowOnly((x) => !x)} className="block w-full cursor-pointer text-left">
            <Tile label="Low stock" value={lowCount} tone={lowCount ? 'warn' : undefined} sub={lowOnly ? 'Showing low stock only - click to show all' : 'Click to show only these'} className={cn('transition hover:bg-muted/40', lowOnly && 'border-warning')} />
          </button>
        </FadeIn>
      </div>
      <TableCard title="Stock on hand" toolbar={<>
        <FilterSelect value={category} onChange={setCategory} placeholder="All categories" options={INVENTORY_CATEGORIES} />
        <SearchInput value={search} onChange={setSearch} placeholder="Search name or SKU..." />
      </>}>
        <DataTable loading={loading} rows={rows}
          empty={<EmptyState icon={Boxes} title={items.length ? 'No items match' : 'No inventory items yet'} description={items.length ? undefined : 'Add your raw materials to track stock, costs and profit.'} action={!items.length && <Button onClick={() => openForm()}><Plus />Add item</Button>} />}
          columns={[
            { key: 'name', label: 'Item', render: (i) => <div className="max-w-xs"><p className={cn('truncate font-medium', !i.status && 'text-muted-foreground line-through')}>{i.name}</p><p className="font-mono text-xs text-muted-foreground">{i.sku}</p></div> },
            { key: 'category', label: 'Category', render: (i) => <Badge tone="outline">{catLabel(i.category)}</Badge> },
            { key: 'stock', label: 'In stock', className: 'text-right', render: (i) => (
              <div className="flex flex-col items-end gap-1">
                <span className={cn('font-semibold tabular-nums', num(i.stock) < 0 && 'text-danger')}>{fq(i.stock)} <span className="text-xs font-normal text-muted-foreground">{i.unit}</span></span>
                {i.low && <Tip content={`Reorder level ${i.reorder_level}`}><span><Badge tone="warning"><AlertTriangle className="size-3" />Low</Badge></span></Tip>}
              </div>
            ) },
            { key: 'locations', label: 'Where', render: (i) => <LocationChips locations={i.locations} /> },
            { key: 'purchase_price', label: <span className="inline-flex items-center gap-1">Avg cost<Hint>Weighted average landed cost per unit, updated by every purchase.</Hint></span>, className: 'text-right', render: (i) => pkr(i.purchase_price) },
            { key: 'sale_price', label: 'Sale price', className: 'text-right', render: (i) => <span className="text-muted-foreground">{pkr(i.sale_price)}</span> },
            { key: 'value', label: 'Value', className: 'text-right', render: (i) => <b className="tabular-nums">{pkr(i.value)}</b> },
            { key: '_a', label: '', className: 'text-right', render: (i) => (
              <Actions>
                <Action icon={SlidersHorizontal} label="Adjust stock" tone="warning" onClick={() => setAdjust(i)} />
                <Action icon={ArrowLeftRight} label="Transfer" tone="success" onClick={() => setTransfer(i)} />
                <Action icon={Pencil} label="Edit" tone="info" onClick={() => openForm(i)} />
                <Action icon={Trash2} label="Delete" tone="danger" onClick={() => remove(i)} />
              </Actions>
            ) },
          ]} />
        {rows.length > 0 && <TotalsRow><TotalItem label="Units">{fq(sum(rows, 'stock'))}</TotalItem><TotalItem label="Value">{pkr(sum(rows, 'value'))}</TotalItem></TotalsRow>}
      </TableCard>

      <Dialog open={open} onOpenChange={setOpen} size="lg" icon={Boxes} title={editing ? `Edit ${editing.name}` : 'New inventory item'}
        footer={<><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={save} loading={saving}>{editing ? 'Save changes' : 'Create item'}</Button></>}>
        <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
          {fields.map((f) => <FieldControl key={f.name} f={f} form={form} options={f.name === 'opening_vendor_id' ? locOptions(locations) : undefined} />)}
          {editing && (
            <div className="flex items-start gap-3 rounded-2xl bg-muted/60 p-4 text-sm sm:col-span-2">
              <Calculator className="mt-0.5 size-4 shrink-0 text-primary" />
              <p><span className="font-medium">Average cost {pkr(editing.purchase_price)}</span> <span className="text-muted-foreground">per {editing.unit || 'unit'}. This is the weighted average landed cost (price + share of shipping, duty and clearing) and is recalculated automatically by every purchase.</span></p>
            </div>
          )}
          <button type="submit" className="hidden" />
        </form>
      </Dialog>
      <AdjustDialog item={adjust} locations={locations} onClose={() => setAdjust(null)} onDone={reload} />
      <TransferDialog item={transfer} locations={locations} onClose={() => setTransfer(null)} onDone={reload} />
    </>
  );
}

const ADJ_TYPES = [{ value: 'adjustment', label: 'Stock count / correction' }, { value: 'damage', label: 'Damaged / lost' }, { value: 'return', label: 'Return' }];
function AdjustDialog({ item, locations, onClose, onDone }) {
  const form = useForm({});
  const [saving, setSaving] = useState(false);
  const [openFor, setOpenFor] = useState(null);
  if (item && openFor !== item.id) { setOpenFor(item.id); form.setValues({ type: 'adjustment', dir: '+', quantity: '', vendor_id: 'main', date: ymd(), note: '' }); form.setErrors({}); }
  if (!item && openFor !== null) setOpenFor(null);
  const v = form.values;
  const signed = v.type === 'damage' ? -Math.abs(num(v.quantity)) : (v.dir === '-' ? -1 : 1) * Math.abs(num(v.quantity));
  const here = num(item?.locations?.find((l) => locValue(l.vendor_id) === v.vendor_id)?.qty);
  const save = async (e) => {
    e?.preventDefault();
    if (!num(v.quantity)) { form.setErrors({ quantity: 'Enter a quantity' }); return; }
    setSaving(true);
    try { await run(api.post('/admin/inventory/adjust', { inventory_item_id: item.id, type: v.type, quantity: signed, vendor_id: locId(v.vendor_id), date: v.date, note: v.note })); onClose(); onDone(); } catch (ex) { form.setErrors(ex.errors || {}); } finally { setSaving(false); }
  };
  return (
    <Dialog open={!!item} onOpenChange={(o) => !o && onClose()} icon={SlidersHorizontal} title="Adjust stock" description={item ? `${item.name} · ${fq(item.stock)} ${item.unit} in total` : undefined}
      footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={save} loading={saving}>Update stock</Button></>}>
      <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
        <Field label="Reason" className="sm:col-span-2"><Select value={v.type} onChange={(x) => form.set('type', x)} options={ADJ_TYPES} /></Field>
        {v.type !== 'damage' && (
          <Field label="Direction" className="sm:col-span-2">
            <Segmented id="adj-dir" value={v.dir} onChange={(x) => form.set('dir', x)} options={[{ value: '+', label: 'Add to stock (+)' }, { value: '-', label: 'Remove from stock (-)' }]} />
          </Field>
        )}
        <Field label="Quantity" required error={form.errors.quantity}><Input {...form.input('quantity')} type="number" min="0" step="any" suffix={<span className="pr-2 text-xs text-muted-foreground">{item?.unit}</span>} /></Field>
        <Field label="Location" hint={`${fq(here)} here now`}><Select value={v.vendor_id} onChange={(x) => form.set('vendor_id', x)} options={locOptions(locations)} /></Field>
        <Field label="Date"><Input {...form.input('date')} type="date" /></Field>
        <div className="flex items-end"><p className="w-full rounded-xl bg-muted px-3 py-2.5 text-sm">After: <b className={cn(here + signed < 0 && 'text-danger')}>{fq(here + signed)}</b> <span className="text-muted-foreground">at this location</span></p></div>
        <Field label="Note" className="sm:col-span-2"><Textarea {...form.input('note')} rows={2} placeholder="Why the stock changed" /></Field>
        <button type="submit" className="hidden" />
      </form>
    </Dialog>
  );
}

function TransferDialog({ item, locations, onClose, onDone }) {
  const form = useForm({});
  const [saving, setSaving] = useState(false);
  const [openFor, setOpenFor] = useState(null);
  if (item && openFor !== item.id) {
    setOpenFor(item.id);
    const from = locValue(item.locations?.find((l) => num(l.qty) > 0)?.vendor_id);
    form.setValues({ from, to: locOptions(locations).find((o) => o.value !== from)?.value || '', quantity: '', date: ymd(), note: '' }); form.setErrors({});
  }
  if (!item && openFor !== null) setOpenFor(null);
  const v = form.values;
  const avail = num(item?.locations?.find((l) => locValue(l.vendor_id) === v.from)?.qty);
  const save = async (e) => {
    e?.preventDefault();
    if (v.from === v.to) { form.setErrors({ to: 'Pick a different location' }); return; }
    if (!(num(v.quantity) > 0)) { form.setErrors({ quantity: 'Enter a quantity' }); return; }
    if (num(v.quantity) > avail) { form.setErrors({ quantity: `Only ${fq(avail)} available` }); return; }
    setSaving(true);
    try { await run(api.post('/admin/inventory/transfer', { inventory_item_id: item.id, from_vendor_id: locId(v.from), to_vendor_id: locId(v.to), quantity: num(v.quantity), date: v.date, note: v.note })); onClose(); onDone(); } catch (ex) { form.setErrors(ex.errors || {}); } finally { setSaving(false); }
  };
  return (
    <Dialog open={!!item} onOpenChange={(o) => !o && onClose()} icon={ArrowLeftRight} title="Transfer stock" description={item ? `Move ${item.name} between the main store and vendors (e.g. send blank cards to the printer).` : undefined}
      footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={save} loading={saving}>Transfer</Button></>}>
      <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
        <Field label="From" hint={`${fq(avail)} ${item?.unit || ''} available`}><Select value={v.from} onChange={(x) => form.set('from', x)} options={locOptions(locations)} /></Field>
        <Field label="To" error={form.errors.to}><Select value={v.to} onChange={(x) => form.set('to', x)} options={locOptions(locations).filter((o) => o.value !== v.from)} invalid={!!form.errors.to} /></Field>
        <Field label="Quantity" required error={form.errors.quantity}>
          <Input {...form.input('quantity')} type="number" min="0" step="any" suffix={<button type="button" className="rounded-md px-2 py-1 text-xs font-medium text-primary hover:bg-primary-soft" onClick={() => form.set('quantity', String(avail))}>Max</button>} />
        </Field>
        <Field label="Date"><Input {...form.input('date')} type="date" /></Field>
        <Field label="Note" className="sm:col-span-2"><Textarea {...form.input('note')} rows={2} placeholder="e.g. Sent for printing batch #12" /></Field>
        <button type="submit" className="hidden" />
      </form>
    </Dialog>
  );
}

/* =============================================================== movements */
export const MOVEMENT_TYPES = {
  purchase: { label: 'Purchase', tone: 'success' }, opening: { label: 'Opening', tone: 'primary' }, transfer_in: { label: 'Transfer in', tone: 'info' }, transfer_out: { label: 'Transfer out', tone: 'info' },
  sale: { label: 'Sale', tone: 'primary' }, adjustment: { label: 'Adjustment', tone: 'warning' }, return: { label: 'Return', tone: 'neutral' }, damage: { label: 'Damage', tone: 'danger' },
};
export const MovementBadge = ({ type }) => <Badge tone={MOVEMENT_TYPES[type]?.tone || 'neutral'} dot>{MOVEMENT_TYPES[type]?.label || humanize(type)}</Badge>;

export function StockMovements() {
  const list = useList('/admin/inventory/movements');
  const items = useFetch('/admin/inventory/items');
  const itemOpts = (items.data?.data || []).map((i) => ({ value: i.id, label: i.name }));
  const locOpts = (items.data?.locations || []).map((l) => ({ value: l.id === null ? 'main' : l.id, label: l.name }));
  return (
    <>
      <PageHeader eyebrow="Inventory" title="Stock movements" description="Full history of every stock change: purchases, opening stock, transfers between locations, order consumption, adjustments, returns and damage." />
      <TableCard title="Movements" list={list} toolbar={<>
        <FilterSelect value={list.params.item_id} onChange={(v) => list.set({ item_id: v })} placeholder="All items" options={itemOpts} />
        <FilterSelect value={list.params.vendor_id} onChange={(v) => list.set({ vendor_id: v })} placeholder="All locations" options={locOpts} />
        <FilterSelect value={list.params.type} onChange={(v) => list.set({ type: v })} placeholder="All types" options={Object.entries(MOVEMENT_TYPES).map(([value, t]) => ({ value, label: t.label }))} />
      </>}>
        <DataTable loading={list.loading} rows={list.rows} empty={<EmptyState icon={History} title="No stock movements" description="Movements are created by purchases, adjustments, transfers and dispatched orders." />}
          columns={[
            { key: 'date', label: 'Date', render: (m) => <span className="text-muted-foreground">{fmtDate(m.date)}</span> },
            { key: 'item', label: 'Item', render: (m) => <span className="font-medium">{m.item?.name || '-'}</span> },
            { key: 'type', label: 'Type', render: (m) => <MovementBadge type={m.type} /> },
            { key: 'quantity', label: 'Qty', className: 'text-right', render: (m) => <span className={cn('font-semibold tabular-nums', num(m.quantity) < 0 ? 'text-danger' : 'text-success')}>{num(m.quantity) > 0 ? '+' : ''}{fq(m.quantity)} <span className="text-xs font-normal text-muted-foreground">{m.item?.unit}</span></span> },
            { key: 'unit_cost', label: 'Unit cost', className: 'text-right', render: (m) => pkr(m.unit_cost) },
            { key: 'value', label: 'Value', className: 'text-right', render: (m) => <span className="text-muted-foreground">{pkr(Math.abs(num(m.quantity) * num(m.unit_cost)))}</span> },
            { key: 'location', label: 'Location', render: (m) => (m.location ? <span className="inline-flex items-center gap-1"><MapPin className="size-3.5 text-info" />{m.location.name}</span> : <span className="inline-flex items-center gap-1"><Home className="size-3.5 text-muted-foreground" />Main store</span>) },
            { key: 'reference', label: 'Reference', render: (m) => <div className="max-w-52"><p className="truncate">{m.nfc_order?.order_number || m.reference || '-'}</p>{m.note && <p className="truncate text-xs text-muted-foreground">{m.note}</p>}</div> },
            { key: 'creator', label: 'By', render: (m) => <span className="text-muted-foreground">{m.creator ? fullName(m.creator) : 'System'}</span> },
          ]} />
      </TableCard>
    </>
  );
}

/* =============================================================== purchases */
const CHARGE_KEYS = [['shipping_cost', 'Shipping / freight'], ['customs_duty', 'Customs duty'], ['clearing_charges', 'Clearing / agent'], ['other_charges', 'Other charges']];

/** Same allocation as services/inventory.js applyPurchase: extras shared by line value */
export function landedLines(p, lines) {
  const rate = p.is_import ? (num(p.exchange_rate) || 1) : 1;
  const valid = lines.filter((l) => l.inventory_item_id && num(l.quantity) > 0);
  const base = sum(valid, (l) => num(l.quantity) * num(l.unit_price) * rate);
  const extras = sum(CHARGE_KEYS, ([k]) => num(p[k]));
  const out = lines.map((l) => {
    const ok = l.inventory_item_id && num(l.quantity) > 0;
    const value = num(l.quantity) * num(l.unit_price) * rate;
    const share = ok ? (base > 0 ? value / base : 1 / valid.length) : 0;
    return { ...l, value, extra: extras * share, landed: ok ? (value + extras * share) / num(l.quantity) : 0 };
  });
  return { lines: out, base, extras, total: base + extras, rate };
}

let lineSeq = 0;
const newLine = () => ({ key: ++lineSeq, inventory_item_id: '', quantity: '', unit_price: '' });
const blankPurchase = () => ({
  supplier_id: '', supplier_name: '', invoice_no: '', date: ymd(), is_import: false, origin_country: '', currency: 'USD', exchange_rate: '',
  shipping_cost: '', customs_duty: '', clearing_charges: '', other_charges: '', location_vendor_id: 'main', paid_amount: '', account_id: '', partner_id: '', note: '', attachment: '',
});

function PurchaseDialog({ open, onClose, onDone }) {
  const items = useFetch(open ? '/admin/inventory/items' : null);
  const vendors = useLookup('/admin/vendors', vendorOpt);
  const accounts = useLookup('/admin/finance/accounts', accountOpt);
  const partners = useLookup('/admin/finance/partners', partnerOpt);
  const form = useForm(blankPurchase());
  const [lines, setLines] = useState([newLine()]);
  const [saving, setSaving] = useState(false);
  const [was, setWas] = useState(false);
  if (open !== was) { setWas(open); if (open) { form.setValues(blankPurchase()); form.setErrors({}); setLines([newLine(), newLine()]); } }
  const v = form.values;
  const itemList = items.data?.data || [];
  const itemById = Object.fromEntries(itemList.map((i) => [String(i.id), i]));
  const calc = landedLines(v, lines);
  const cur = v.is_import ? (v.currency || 'USD') : 'Rs';
  const setLine = (key, p) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...p } : l)));

  const save = async (e) => {
    e?.preventDefault();
    const valid = calc.lines.filter((l) => l.inventory_item_id && num(l.quantity) > 0);
    if (!valid.length) { form.setErrors({ items: 'Add at least one item with a quantity' }); return; }
    if (v.is_import && !(num(v.exchange_rate) > 0)) { form.setErrors({ exchange_rate: 'Enter the exchange rate to PKR' }); return; }
    setSaving(true);
    const supplierName = v.supplier_name || vendors.find((o) => String(o.value) === String(v.supplier_id))?.label || '';
    const body = {
      ...v, supplier_name: supplierName, is_import: v.is_import ? '1' : '0',
      currency: v.is_import ? v.currency : 'PKR', exchange_rate: v.is_import ? v.exchange_rate : 1, origin_country: v.is_import ? v.origin_country : '',
      location_vendor_id: locId(v.location_vendor_id) ?? undefined, attachment: v.attachment instanceof File ? v.attachment : undefined,
      items: valid.map((l) => ({ inventory_item_id: Number(l.inventory_item_id), name: itemById[String(l.inventory_item_id)]?.name || '', quantity: num(l.quantity), unit_price: num(l.unit_price) })),
    };
    delete body.paid_amount;
    if (v.paid_amount !== '') body.paid_amount = v.paid_amount;
    try { await run(api.post('/admin/purchases', toFormData(body))); onClose(); onDone(); } catch (ex) { form.setErrors(ex.errors || {}); } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()} size="xl" icon={PackagePlus} title="New purchase / import" description="Stock is added at landed cost: shipping, duty and clearing are shared across the lines by value, and each item's average cost is updated."
      footer={<>
        <p className="mr-auto hidden text-sm text-muted-foreground sm:block">Landed total <b className="text-foreground">{pkr(calc.total)}</b></p>
        <Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={save} loading={saving}>Record purchase</Button>
      </>}>
      <form onSubmit={save} className="space-y-6">
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Type" className="sm:col-span-2 lg:col-span-4">
            <Segmented id="pur-type" value={v.is_import ? 'import' : 'local'} onChange={(x) => form.set('is_import', x === 'import')} options={[{ value: 'local', label: 'Local purchase', icon: Home }, { value: 'import', label: 'Import', icon: Globe2 }]} />
          </Field>
          <Field label="Supplier (vendor)" className="lg:col-span-2"><Select value={v.supplier_id} onChange={(x) => form.set('supplier_id', x)} options={vendors} allowEmpty placeholder="Not a saved vendor" /></Field>
          <Field label="or supplier name" className="lg:col-span-2"><Input {...form.input('supplier_name')} placeholder={v.supplier_id ? 'Uses the vendor name' : 'e.g. Alibaba - Shenzhen NFC Co.'} /></Field>
          <Field label="Invoice no."><Input {...form.input('invoice_no')} placeholder="Supplier invoice" /></Field>
          <Field label="Date" required error={form.errors.date}><Input {...form.input('date')} type="date" /></Field>
          {v.is_import && <>
            <Field label="Origin country"><Input {...form.input('origin_country')} placeholder="e.g. China" /></Field>
            <Field label="Currency"><Input {...form.input('currency')} maxLength={10} placeholder="USD" /></Field>
            <Field label="Exchange rate to PKR" required error={form.errors.exchange_rate} hint={`1 ${v.currency || 'USD'} = Rs ${num(v.exchange_rate) || '?'}`} className="sm:col-span-2 lg:col-span-1"><Input {...form.input('exchange_rate')} type="number" min="0" step="0.0001" placeholder="e.g. 280" /></Field>
          </>}
        </section>

        <section>
          <div className="mb-2 flex items-center justify-between">
            <h4 className="text-sm font-semibold">Items</h4>
            {!itemList.length && !items.loading && <Link to="/admin/inventory" className="text-xs font-medium text-primary hover:underline">Add inventory items first</Link>}
          </div>
          {form.errors.items && <p className="mb-2 rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger">{form.errors.items}</p>}
          <div className="overflow-x-auto rounded-2xl border border-border">
            <table className="w-full min-w-[640px] text-sm">
              <thead><tr className="border-b border-border bg-muted/40 text-left text-xs font-semibold text-muted-foreground uppercase">
                <th className="min-w-56 px-3 py-2.5">Item</th><th className="w-24 px-2 py-2.5 text-right">Qty</th><th className="w-32 px-2 py-2.5 text-right">Unit price ({cur})</th>
                <th className="px-2 py-2.5 text-right">Value (Rs)</th>
                <th className="px-2 py-2.5 text-right"><span className="inline-flex items-center gap-1">Landed / unit<Hint>(Line value in PKR + its share of all extra charges by value) / quantity.</Hint></span></th>
                <th className="w-10" />
              </tr></thead>
              <tbody className="divide-y divide-border">
                {calc.lines.map((l) => {
                  const it = itemById[String(l.inventory_item_id)];
                  const onHand = Math.max(0, num(it?.stock));
                  const newAvg = it && num(l.quantity) > 0 ? (onHand * num(it.purchase_price) + num(l.quantity) * l.landed) / (onHand + num(l.quantity)) : 0;
                  return (
                    <tr key={l.key} className="align-top">
                      <td className="px-3 py-2"><Select value={l.inventory_item_id} onChange={(x) => setLine(l.key, { inventory_item_id: x })} options={itemList.map((i) => ({ value: i.id, label: `${i.name}${i.sku ? ` (${i.sku})` : ''}` }))} placeholder={items.loading ? 'Loading...' : 'Pick an item'} />
                        {it && <p className="mt-1 text-[11px] text-muted-foreground">On hand {fq(it.stock)} · avg {pkr(it.purchase_price)}{newAvg ? <> → <b className="text-foreground">{pkr(newAvg)}</b></> : null}</p>}</td>
                      <td className="px-2 py-2"><Input type="number" min="0" step="any" value={l.quantity} onChange={(e) => setLine(l.key, { quantity: e.target.value })} className="text-right" aria-label="Quantity" /></td>
                      <td className="px-2 py-2"><Input type="number" min="0" step="0.0001" value={l.unit_price} onChange={(e) => setLine(l.key, { unit_price: e.target.value })} className="text-right" aria-label="Unit price" /></td>
                      <td className="px-2 py-4 text-right tabular-nums">{pkr(l.value)}</td>
                      <td className="px-2 py-4 text-right font-semibold text-primary tabular-nums">{l.landed ? pkr(l.landed) : '-'}</td>
                      <td className="py-3 pr-2"><Tip content="Remove line"><button type="button" aria-label="Remove line" disabled={lines.length < 2} onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))} className="grid size-8 cursor-pointer place-items-center rounded-lg text-muted-foreground transition hover:bg-danger-soft hover:text-danger disabled:opacity-30"><X className="size-4" /></button></Tip></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Button type="button" size="sm" variant="soft" className="mt-2" onClick={() => setLines((ls) => [...ls, newLine()])}><Plus />Add line</Button>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <div className="grid gap-4 sm:grid-cols-2">
            <h4 className="text-sm font-semibold sm:col-span-2">Extra charges (PKR)</h4>
            {CHARGE_KEYS.map(([k, l]) => <Field key={k} label={l}><Input {...form.input(k)} type="number" min="0" step="0.01" prefix="Rs" placeholder="0" /></Field>)}
          </div>
          <Card className="h-fit bg-muted/30 shadow-none">
            <CardBody className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Goods{v.is_import ? ` (x ${num(v.exchange_rate) || 1})` : ''}</span><span className="tabular-nums">{pkr(calc.base)}</span></div>
              {CHARGE_KEYS.map(([k, l]) => num(v[k]) > 0 && <div key={k} className="flex justify-between"><span className="text-muted-foreground">{l}</span><span className="tabular-nums">{pkr(v[k])}</span></div>)}
              <div className="flex justify-between border-t border-border pt-2 font-display text-base font-bold"><span>Landed total</span><span className="tabular-nums">{pkr(calc.total)}</span></div>
              {calc.base > 0 && <p className="text-xs text-muted-foreground">Charges add {((calc.extras / calc.base) * 100).toFixed(1)}% on top of the goods value.</p>}
            </CardBody>
          </Card>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Receive stock at" hint="Main store or directly at a vendor (e.g. the printer)"><Select value={v.location_vendor_id} onChange={(x) => form.set('location_vendor_id', x)} options={[{ value: 'main', label: 'Main store' }, ...vendors.map((o) => ({ value: String(o.value), label: o.label }))]} /></Field>
          <Field label="Amount paid" hint={v.paid_amount === '' ? `Empty = fully paid (${pkr(calc.total)})` : `${pkr(Math.max(0, calc.total - num(v.paid_amount)))} still owed`}><Input {...form.input('paid_amount')} type="number" min="0" step="0.01" prefix="Rs" placeholder={String(Math.round(calc.total * 100) / 100)} /></Field>
          <Field label="Paid from account"><Select value={v.account_id} onChange={(x) => form.set('account_id', x)} options={accounts} allowEmpty placeholder="No account" /></Field>
          <Field label="Paid by (partner)"><Select value={v.partner_id} onChange={(x) => form.set('partner_id', x)} options={partners} allowEmpty placeholder="Company account" /></Field>
          <Field label="Note" className="lg:col-span-2"><Input {...form.input('note')} placeholder="Optional" /></Field>
          <Field label="Invoice / receipt" className="sm:col-span-2 lg:col-span-3"><DocUpload value={v.attachment} onChange={(x) => form.set('attachment', x)} label="Upload supplier invoice, bill of entry or receipt" /></Field>
        </section>
        <button type="submit" className="hidden" />
      </form>
    </Dialog>
  );
}

function PurchaseView({ p, onClose }) {
  const calc = p ? landedLines(p, p.items || []) : null;
  return (
    <Dialog open={!!p} onOpenChange={(o) => !o && onClose()} size="lg" icon={ShoppingCart} title={p ? `${p.is_import ? 'Import' : 'Purchase'} ${p.invoice_no || `#${p.id}`}` : ''} description={p ? `${fmtDate(p.date)} · ${p.supplier?.name || p.supplier_name || 'Supplier'}` : undefined}>
      {p && (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <Tile label="Landed total" value={pkr(p.total)} />
            <Tile label="Paid" value={pkr(p.paid_amount)} tone="in" sub={p.partner?.name ? `by ${p.partner.name}` : undefined} />
            <Tile label="Balance" value={pkr(Math.max(0, num(p.total) - num(p.paid_amount)))} tone={num(p.total) - num(p.paid_amount) > 0.009 ? 'out' : undefined} />
          </div>
          <div className="overflow-x-auto rounded-2xl border border-border">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border bg-muted/40 text-left text-xs font-semibold text-muted-foreground uppercase"><th className="px-4 py-2.5">Item</th><th className="px-3 py-2.5 text-right">Qty</th><th className="px-3 py-2.5 text-right">Unit price{p.is_import ? ` (${p.currency})` : ''}</th><th className="px-4 py-2.5 text-right">Landed / unit</th></tr></thead>
              <tbody className="divide-y divide-border">{calc.lines.map((l, i) => <tr key={i}><td className="px-4 py-2.5 font-medium">{l.name}</td><td className="px-3 py-2.5 text-right">{fq(l.quantity)}</td><td className="px-3 py-2.5 text-right">{Number(l.unit_price).toLocaleString('en-US', { maximumFractionDigits: 4 })}</td><td className="px-4 py-2.5 text-right font-semibold">{pkr(l.landed)}</td></tr>)}</tbody>
            </table>
          </div>
          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            {p.is_import && <><dt className="text-muted-foreground">Origin / currency</dt><dd>{p.origin_country || '-'} · {p.currency} @ {num(p.exchange_rate)}</dd></>}
            {CHARGE_KEYS.map(([k, l]) => num(p[k]) > 0 && <Fragment key={k}><dt className="text-muted-foreground">{l}</dt><dd>{pkr(p[k])}</dd></Fragment>)}
            <dt className="text-muted-foreground">Stock received at</dt><dd>{p.location?.name || 'Main store'}</dd>
            {p.note && <><dt className="text-muted-foreground">Note</dt><dd>{p.note}</dd></>}
          </dl>
          {p.attachment && <div className="flex items-center gap-2 text-sm"><AttachmentLink url={p.attachment} size={40} /><span className="text-muted-foreground">Attached invoice / receipt</span></div>}
        </div>
      )}
    </Dialog>
  );
}

export function Purchases() {
  const list = useList('/admin/purchases');
  const [open, setOpen] = useState(false);
  const [viewing, setViewing] = useState(null);
  const remove = async (p) => {
    if (!(await confirm({ title: `Delete ${p.is_import ? 'import' : 'purchase'} ${p.invoice_no || `#${p.id}`}?`, description: 'The stock it added is removed. Average costs are not recalculated.' }))) return;
    await run(api.delete(`/admin/purchases/${p.id}`)).catch(() => {}); list.reload();
  };
  const kind = list.params.is_import ?? '';
  return (
    <>
      <PageHeader eyebrow="Inventory" title="Purchases & imports" description="Buy stock locally or import it. Shipping, customs duty and clearing are spread across the items by value to get the true landed cost per unit.">
        <Button onClick={() => setOpen(true)}><Plus />New purchase / import</Button>
      </PageHeader>
      <TableCard title="Purchase history" list={list} toolbar={
        <Segmented id="pur-kind" size="sm" value={kind} onChange={(x) => list.set({ is_import: x })} options={[{ value: '', label: 'All' }, { value: '0', label: 'Local' }, { value: '1', label: 'Imports' }]} />
      }>
        <DataTable loading={list.loading} rows={list.rows} onRowClick={setViewing}
          empty={<EmptyState icon={ShoppingCart} title="No purchases yet" description="Record stock you buy to keep quantities and costs accurate." action={<Button onClick={() => setOpen(true)}><Plus />New purchase</Button>} />}
          columns={[
            { key: 'date', label: 'Date', render: (p) => <span className="text-muted-foreground">{fmtDate(p.date)}</span> },
            { key: 'supplier', label: 'Supplier', render: (p) => <div><p className="font-medium">{p.supplier?.name || p.supplier_name || '-'}</p><p className="text-xs text-muted-foreground">{p.invoice_no || `#${p.id}`}</p></div> },
            { key: 'is_import', label: 'Type', render: (p) => (p.is_import ? <Badge tone="info"><Globe2 className="size-3" />Import{p.origin_country ? ` · ${p.origin_country}` : ''}</Badge> : <Badge tone="outline">Local</Badge>) },
            { key: 'items', label: 'Items', render: (p) => <Tip content={(p.items || []).map((l) => `${l.name} x ${fq(l.quantity)}`).join(', ') || '-'}><span className="cursor-default text-muted-foreground">{(p.items || []).length} line(s) · {fq(sum(p.items || [], 'quantity'))} units</span></Tip> },
            { key: 'location', label: 'Received at', render: (p) => p.location?.name || 'Main store' },
            { key: 'total', label: 'Landed total', className: 'text-right', render: (p) => <div><b className="tabular-nums">{pkr(p.total)}</b>{num(p.total) !== num(p.subtotal) && <p className="text-xs text-muted-foreground">goods {pkr(p.subtotal)}</p>}</div> },
            { key: 'paid_amount', label: 'Paid', className: 'text-right', render: (p) => { const due = num(p.total) - num(p.paid_amount); return <div><span className="tabular-nums">{pkr(p.paid_amount)}</span>{due > 0.009 && <p className="text-xs text-danger">{pkr(due)} due</p>}</div>; } },
            { key: 'partner', label: 'Paid by', render: (p) => p.partner?.name || <span className="text-muted-foreground">Company</span> },
            { key: 'attachment', label: 'Bill', className: 'text-center', render: (p) => <AttachmentLink url={p.attachment} /> },
            { key: '_a', label: '', className: 'text-right', render: (p) => <div onClick={(e) => e.stopPropagation()}><Actions><Action icon={Eye} label="View" onClick={() => setViewing(p)} /><Action icon={Trash2} label="Delete" tone="danger" onClick={() => remove(p)} /></Actions></div> },
          ]} />
      </TableCard>
      <PurchaseDialog open={open} onClose={() => setOpen(false)} onDone={list.reload} />
      <PurchaseView p={viewing} onClose={() => setViewing(null)} />
    </>
  );
}
