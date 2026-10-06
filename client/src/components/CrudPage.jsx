/* Generic list + dialog create/edit screen */
import { useEffect, useState, lazy, Suspense } from 'react';
import { Plus, Eye, Pencil, Trash2 } from 'lucide-react';
import api, { toFormData } from '@/lib/api';
import {
  PageHeader, TableCard, DataTable, SearchInput, FilterSelect, Action, Actions, Dialog, Button, Field, Input, Textarea, Select, Switch, ImageUpload,
  useList, useForm, run, confirm, EmptyState,
} from '@/components/ui';

const RichText = lazy(() => import('@/components/ui/RichText'));

export function useOptions(url, map) {
  const [opts, setOpts] = useState([]);
  useEffect(() => { if (url) api.get(url, { params: { all: 1 } }).then(({ data }) => setOpts(data.data.map(map))); }, [url]); // eslint-disable-line
  return opts;
}

function FormField({ f, form, options }) {
  const v = form.values[f.name];
  const set = (x) => form.set(f.name, x);
  const err = form.errors[f.name];
  let control;
  if (f.type === 'select') control = <Select id={`f-${f.name}`} value={v} onChange={set} options={options[f.name] || f.options || []} invalid={!!err} placeholder={`Select ${f.label.toLowerCase()}`} />;
  else if (f.type === 'image') control = <ImageUpload value={v} onChange={set} />;
  else if (f.type === 'switch') return <label className="flex cursor-pointer items-center justify-between rounded-2xl border border-border p-4 sm:col-span-2"><span className="text-sm font-medium">{f.label}</span><Switch checked={v} onChange={set} /></label>;
  else if (f.type === 'richtext') control = <Suspense fallback={<div className="skeleton h-56 rounded-2xl" />}><RichText value={v || ''} onChange={set} height={f.height || 260} /></Suspense>;
  else if (f.type === 'datetime-local') control = <Input id={`f-${f.name}`} type="datetime-local" value={v ? String(v).slice(0, 16) : ''} onChange={(e) => set(e.target.value)} />;
  else if (f.type === 'textarea') control = <Textarea {...form.input(f.name)} rows={f.rows || 4} placeholder={f.placeholder} />;
  else control = <Input {...form.input(f.name)} type={f.type || 'text'} placeholder={f.placeholder || f.label} min={f.min} max={f.max} step={f.step} />;
  return <Field label={f.label} htmlFor={`f-${f.name}`} required={f.required} error={err} hint={f.hint} className={f.half ? '' : 'sm:col-span-2'}>{control}</Field>;
}

export default function CrudPage({ title, description, endpoint, singular, icon, columns, fields = [], filters = [], canCreate = true, canEdit = true, canDelete = true, view, defaults = {}, size = 'md', searchPlaceholder, headerActions, bulkDelete }) {
  const list = useList(endpoint);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [viewing, setViewing] = useState(null);
  const blank = Object.fromEntries(fields.map((f) => [f.name, f.type === 'switch' ? (f.default ?? true) : (f.default ?? '')]));
  const form = useForm({ ...blank, ...defaults });
  const [saving, setSaving] = useState(false);
  const [options, setOptions] = useState({});
  useEffect(() => {
    fields.filter((f) => f.optionsUrl).forEach((f) => api.get(f.optionsUrl, { params: { all: 1 } }).then(({ data }) => setOptions((o) => ({ ...o, [f.name]: data.data.map(f.optionMap) }))));
  }, []); // eslint-disable-line
  const filterOptions = useOptions(filters[0]?.optionsUrl, filters[0]?.optionMap || ((x) => x));

  const openForm = (row) => {
    setEditing(row || null);
    form.setErrors({});
    form.setValues(row ? Object.fromEntries(fields.map((f) => [f.name, row[f.name] ?? (f.type === 'switch' ? false : '')])) : { ...blank, ...defaults });
    setOpen(true);
  };
  const save = async (e) => {
    e?.preventDefault();
    setSaving(true);
    const payload = { ...form.values };
    for (const f of fields) if (f.type === 'image' && !(payload[f.name] instanceof File)) delete payload[f.name];
    const body = fields.some((f) => f.type === 'image') ? toFormData(payload) : payload;
    try { await run(editing ? api.put(`${endpoint}/${editing.id}`, body) : api.post(endpoint, body)); setOpen(false); list.reload(); } catch (ex) { form.setErrors(ex.errors || {}); } finally { setSaving(false); }
  };
  const remove = async (row) => { if (await confirm({ title: `Delete this ${singular.toLowerCase()}?` })) { await run(api.delete(`${endpoint}/${row.id}`)).catch(() => {}); list.reload(); } };
  const hasActions = canEdit || canDelete || view;
  const [selected, setSelected] = useState([]);
  const removeMany = async () => {
    if (!(await confirm({ title: `Delete ${selected.length} ${title.toLowerCase()}?` }))) return;
    await run(api.post(`${endpoint}/bulk-delete`, { ids: selected })).catch(() => {});
    setSelected([]); list.reload();
  };

  return (
    <>
      <PageHeader title={title} description={description}>
        {headerActions}
        {canCreate && <Button onClick={() => openForm()}><Plus />Add {singular}</Button>}
      </PageHeader>
      <TableCard title={`All ${title.toLowerCase()}`} list={list} toolbar={<>
        {bulkDelete && selected.length > 0 && <Button size="sm" variant="danger-soft" onClick={removeMany}><Trash2 />Delete {selected.length}</Button>}
        {filters.map((f) => <FilterSelect key={f.name} value={list.params[f.name]} onChange={(v) => list.set({ [f.name]: v })} placeholder={f.label} options={f.options || filterOptions} />)}
        <SearchInput value={list.params.search} onChange={(search) => list.set({ search })} placeholder={searchPlaceholder || `Search ${title.toLowerCase()}...`} />
      </>}>
        <DataTable loading={list.loading} rows={list.rows} selected={selected} onSelect={bulkDelete ? setSelected : undefined}
          empty={<EmptyState icon={icon} title={`No ${title.toLowerCase()} yet`} description={canCreate ? `Create your first ${singular.toLowerCase()} to get started.` : undefined} action={canCreate && <Button onClick={() => openForm()}><Plus />Add {singular}</Button>} />}
          columns={[...columns, hasActions && {
            key: '_a', label: '', className: 'text-right', render: (row) => (
              <Actions>
                {view && <Action icon={Eye} label="View" onClick={() => setViewing(row)} />}
                {canEdit && <Action icon={Pencil} label="Edit" tone="info" onClick={() => openForm(row)} />}
                {canDelete && <Action icon={Trash2} label="Delete" tone="danger" onClick={() => remove(row)} />}
              </Actions>
            ),
          }].filter(Boolean)} />
      </TableCard>

      {fields.length > 0 && (
        <Dialog open={open} onOpenChange={setOpen} size={size} icon={icon} title={`${editing ? 'Edit' : 'New'} ${singular.toLowerCase()}`}
          footer={<><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={save} loading={saving}>{editing ? 'Save changes' : `Create ${singular.toLowerCase()}`}</Button></>}>
          <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
            {fields.map((f) => <FormField key={f.name} f={f} form={form} options={options} />)}
            <button type="submit" className="hidden" />
          </form>
        </Dialog>
      )}
      {view && <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)} size="lg" title={`${singular} details`} icon={icon}>{viewing && view(viewing)}</Dialog>}
    </>
  );
}
