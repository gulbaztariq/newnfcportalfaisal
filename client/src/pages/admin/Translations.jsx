/* Admin: translation manager for the texts visitors see on vCards (buttons, section titles, form labels), per language. */
import { useEffect, useMemo, useState } from 'react';
import { Languages as LangIcon, Save, RotateCcw } from 'lucide-react';
import api from '@/lib/api';
import { PageHeader, Card, CardBody, Button, Input, Select, SearchInput, Skeleton, Badge, EmptyState, run } from '@/components/ui';

export function Translations() {
  const [lang, setLang] = useState('en');
  const [d, setD] = useState(null);
  const [values, setValues] = useState({});
  const [saved, setSaved] = useState('{}');
  const [q, setQ] = useState('');
  const [saving, setSaving] = useState(false);
  const load = (l) => api.get('/admin/translations', { params: { lang: l } }).then(({ data }) => {
    const v = Object.fromEntries(data.data.filter((r) => r.value).map((r) => [r.key, r.value]));
    setD(data); setValues(v); setSaved(JSON.stringify(v));
  });
  useEffect(() => { setD(null); load(lang); }, [lang]); // eslint-disable-line
  const dirty = JSON.stringify(values) !== saved;
  const rows = useMemo(() => (d?.data || []).filter((r) => !q || `${r.key} ${r.english} ${r.standard} ${values[r.key] || ''}`.toLowerCase().includes(q.toLowerCase())), [d, q, values]);
  const set = (k, v) => setValues((x) => { const n = { ...x }; if (v) n[k] = v; else delete n[k]; return n; });
  const save = async () => { setSaving(true); try { await run(api.put('/admin/translations', { lang, values })); setSaved(JSON.stringify(values)); } catch { /* toasted */ } finally { setSaving(false); } };
  const current = d?.languages.find((l) => l.code === lang);
  return (
    <>
      <PageHeader title="Translations" description="Change the wording visitors see on vCards, for each language. Leave a box empty to keep the standard text. The admin and user panels themselves stay in English.">
        <Button onClick={save} loading={saving} disabled={!dirty}><Save />Save translations</Button>
      </PageHeader>
      <Card>
        <CardBody className="grid gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="w-56"><Select value={lang} onChange={setLang} options={(d?.languages || [{ code: 'en', name: 'English' }]).map((l) => ({ value: l.code, label: `${l.name} (${l.code})` }))} /></div>
            <div className="min-w-56 flex-1"><SearchInput value={q} onChange={setQ} placeholder="Search a text..." /></div>
            {current && !current.builtin && <Badge tone="warning">New language: untranslated texts show in English</Badge>}
            <span className="text-sm text-muted-foreground">{Object.keys(values).length} changed</span>
          </div>
          {!d ? <Skeleton className="h-72 rounded-2xl" /> : !rows.length ? <EmptyState icon={LangIcon} title="No text matches your search" /> : (
            <div className="overflow-x-auto rounded-2xl border border-border">
              <table className="w-full min-w-[720px] text-sm">
                <thead className="bg-muted/50 text-left text-xs font-medium text-muted-foreground"><tr><th className="px-4 py-2.5">English</th><th className="px-4 py-2.5">Standard text in this language</th><th className="px-4 py-2.5">Your text</th></tr></thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.key} className="border-t border-border align-middle">
                      <td className="px-4 py-2"><p>{r.english}</p><p className="font-mono text-[11px] text-muted-foreground">{r.key}</p></td>
                      <td className="px-4 py-2 text-muted-foreground" dir="auto">{r.standard}</td>
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-1.5">
                          <Input className="h-9" dir="auto" maxLength={200} value={values[r.key] || ''} onChange={(e) => set(r.key, e.target.value)} placeholder={r.standard} aria-label={`Your text for ${r.english}`} />
                          {values[r.key] && <Button size="icon-sm" variant="ghost" onClick={() => set(r.key, '')} aria-label="Use the standard text"><RotateCcw /></Button>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>
    </>
  );
}
