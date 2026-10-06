import { Coins, Globe2, Map as MapIcon, Building2, Languages as LangIcon, TicketPercent, Sparkles, Info, Quote, HelpCircle, Inbox, MailCheck, CreditCard, ImageOff } from 'lucide-react';
import api from '@/lib/api';
import CrudPage from '@/components/CrudPage';
import ExportMenu from '@/components/ExportMenu';
import { Badge, StatusBadge, Switch, run } from '@/components/ui';
import { fmtDate, fmtDateTime, money } from '@/lib/format';

const toggleCol = (endpoint, field = 'status', label = 'Status') => ({
  key: field, label,
  render: (row) => <Switch size="sm" checked={row[field]} onChange={async (v) => { row[field] = v; await run(api.put(`${endpoint}/${row.id}`, { ...row, [field]: v })).catch(() => { row[field] = !v; }); }} />,
});
const Thumb = ({ url }) => (url ? <img src={url} alt="" className="size-11 rounded-xl object-cover" /> : <span className="grid size-11 place-items-center rounded-xl bg-muted text-muted-foreground"><ImageOff className="size-4" /></span>);
const Clip = ({ text, n = 80 }) => <span className="block max-w-md truncate text-muted-foreground">{text && text.length > n ? `${text.slice(0, n)}...` : text}</span>;
const Detail = ({ rows }) => (
  <dl className="divide-y divide-border rounded-2xl border border-border">
    {rows.map(([k, v]) => <div key={k} className="grid grid-cols-3 gap-4 px-4 py-3 text-sm"><dt className="text-muted-foreground">{k}</dt><dd className="col-span-2 break-words whitespace-pre-wrap">{v || '-'}</dd></div>)}
  </dl>
);

export const Currencies = () => (
  <CrudPage title="Currencies" description="Currencies available for subscription plans." endpoint="/admin/currencies" singular="Currency" icon={Coins}
    columns={[
      { key: 'currency_name', label: 'Currency', render: (r) => <div className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-xl bg-primary-soft font-semibold text-primary">{r.currency_icon}</span><span className="font-medium">{r.currency_name}</span></div> },
      { key: 'currency_code', label: 'Code', render: (r) => <Badge tone="outline">{r.currency_code}</Badge> },
    ]}
    fields={[{ name: 'currency_name', label: 'Currency name', required: true }, { name: 'currency_icon', label: 'Symbol', half: true, required: true }, { name: 'currency_code', label: 'ISO code', half: true, required: true }]} />
);

export const Countries = () => (
  <CrudPage title="Countries" endpoint="/admin/countries" singular="Country" icon={Globe2}
    columns={[{ key: 'name', label: 'Country', render: (r) => <span className="font-medium">{r.name}</span> }, { key: 'short_code', label: 'Code', render: (r) => <Badge tone="outline">{r.short_code}</Badge> }, { key: 'phone_code', label: 'Phone code', render: (r) => (r.phone_code ? `+${r.phone_code}` : '-') }]}
    fields={[{ name: 'name', label: 'Name', required: true }, { name: 'short_code', label: 'Short code', half: true, required: true }, { name: 'phone_code', label: 'Phone code', half: true }]} />
);

const countryOpt = { optionsUrl: '/admin/countries', optionMap: (c) => ({ value: c.id, label: c.name }) };
export const States = () => (
  <CrudPage title="States" endpoint="/admin/states" singular="State" icon={MapIcon} filters={[{ name: 'country_id', label: 'All countries', ...countryOpt }]}
    columns={[{ key: 'name', label: 'State', render: (r) => <span className="font-medium">{r.name}</span> }, { key: 'country', label: 'Country', render: (r) => r.country?.name }]}
    fields={[{ name: 'name', label: 'Name', required: true }, { name: 'country_id', label: 'Country', type: 'select', required: true, ...countryOpt }]} />
);

const stateOpt = { optionsUrl: '/admin/states', optionMap: (s) => ({ value: s.id, label: `${s.name} - ${s.country?.name || ''}` }) };
export const Cities = () => (
  <CrudPage title="Cities" endpoint="/admin/cities" singular="City" icon={Building2} filters={[{ name: 'state_id', label: 'All states', ...stateOpt }]}
    columns={[{ key: 'name', label: 'City', render: (r) => <span className="font-medium">{r.name}</span> }, { key: 'state', label: 'State', render: (r) => r.state?.name }, { key: 'c', label: 'Country', render: (r) => r.state?.country?.name }]}
    fields={[{ name: 'name', label: 'Name', required: true }, { name: 'state_id', label: 'State', type: 'select', required: true, ...stateOpt }]} />
);

export const Languages = () => (
  <CrudPage title="Languages" description="Enable the languages users can choose for their vCards." endpoint="/admin/languages" singular="Language" icon={LangIcon}
    columns={[
      { key: 'name', label: 'Language', render: (r) => <span className="font-medium">{r.name}</span> },
      { key: 'iso_code', label: 'ISO', render: (r) => <Badge tone="outline">{r.iso_code}</Badge> },
      { key: 'is_default', label: 'Default', render: (r) => (r.is_default ? <Badge tone="primary">Default</Badge> : '') },
      toggleCol('/admin/languages', 'status', 'Enabled'),
    ]}
    fields={[{ name: 'name', label: 'Name', half: true, required: true }, { name: 'iso_code', label: 'ISO code', half: true, required: true, hint: 'e.g. en, fr, ar' }, { name: 'status', label: 'Enabled for vCards', type: 'switch' }]} />
);

export const CouponCodes = () => (
  <CrudPage title="Coupon Codes" description="Discounts users can apply at checkout." endpoint="/admin/coupon-codes" singular="Coupon" icon={TicketPercent}
    columns={[
      { key: 'coupon_name', label: 'Code', render: (r) => <span className="rounded-lg border border-dashed border-primary/50 bg-primary-soft px-2.5 py-1 font-mono text-xs font-semibold text-primary">{r.coupon_name}</span> },
      { key: 'discount', label: 'Discount', render: (r) => <span className="font-semibold">{r.type === 'percentage' ? `${Number(r.discount)}%` : money(r.discount)}</span> },
      { key: 'usage', label: 'Usage left', render: (r) => (r.coupon_limit ? `${r.coupon_limit_left ?? r.coupon_limit} / ${r.coupon_limit}` : <span className="text-muted-foreground">Unlimited</span>) },
      { key: 'expire_at', label: 'Expires', render: (r) => (r.expire_at ? fmtDate(r.expire_at) : <span className="text-muted-foreground">Never</span>) },
      toggleCol('/admin/coupon-codes'),
    ]}
    fields={[
      { name: 'coupon_name', label: 'Coupon code', required: true, hint: 'Saved in upper case without spaces' },
      { name: 'type', label: 'Type', type: 'select', half: true, options: [{ value: 'percentage', label: 'Percentage' }, { value: 'fixed', label: 'Fixed amount' }], default: 'percentage' },
      { name: 'discount', label: 'Discount', type: 'number', half: true, required: true, min: 0, step: '0.01' },
      { name: 'coupon_limit', label: 'Usage limit', type: 'number', half: true, min: 1, hint: 'Empty = unlimited' },
      { name: 'expire_at', label: 'Expires on', type: 'date', half: true },
      { name: 'status', label: 'Active', type: 'switch' },
    ]} />
);

export const Features = () => (
  <CrudPage title="Features" description="Feature cards shown on the landing page." endpoint="/admin/features" singular="Feature" icon={Sparkles}
    columns={[{ key: 'image', label: '', render: (r) => <Thumb url={r.image} /> }, { key: 'title', label: 'Title', render: (r) => <span className="font-medium">{r.title}</span> }, { key: 'description', label: 'Description', render: (r) => <Clip text={r.description} /> }]}
    fields={[{ name: 'title', label: 'Title', required: true }, { name: 'description', label: 'Description', type: 'textarea', required: true }, { name: 'image', label: 'Icon / image', type: 'image' }]} />
);

export const AboutUs = () => (
  <CrudPage title="About Us" description="'Why us' blocks on the landing page." endpoint="/admin/about-us" singular="Block" icon={Info}
    columns={[{ key: 'image', label: '', render: (r) => <Thumb url={r.image} /> }, { key: 'title', label: 'Title', render: (r) => <span className="font-medium">{r.title}</span> }, { key: 'description', label: 'Description', render: (r) => <Clip text={r.description} /> }]}
    fields={[{ name: 'title', label: 'Title', required: true }, { name: 'description', label: 'Description', type: 'textarea', required: true }, { name: 'image', label: 'Image', type: 'image' }]} />
);

export const FrontTestimonials = () => (
  <CrudPage title="Testimonials" endpoint="/admin/front-testimonials" singular="Testimonial" icon={Quote}
    view={(r) => <Detail rows={[['Name', r.name], ['Designation', r.designation], ['Testimonial', r.description]]} />}
    columns={[{ key: 'name', label: 'Person', render: (r) => <div className="flex items-center gap-3"><Thumb url={r.image} /><div><p className="font-medium">{r.name}</p><p className="text-xs text-muted-foreground">{r.designation}</p></div></div> }, { key: 'description', label: 'Quote', render: (r) => <Clip text={r.description} /> }]}
    fields={[{ name: 'name', label: 'Name', half: true, required: true }, { name: 'designation', label: 'Designation', half: true }, { name: 'description', label: 'Testimonial', type: 'textarea', required: true }, { name: 'image', label: 'Photo', type: 'image' }]} />
);

export const FrontFaqs = () => (
  <CrudPage title="FAQs" endpoint="/admin/front-faqs" singular="FAQ" icon={HelpCircle}
    view={(r) => <Detail rows={[['Question', r.title], ['Answer', r.description]]} />}
    columns={[{ key: 'title', label: 'Question', render: (r) => <span className="font-medium">{r.title}</span> }, { key: 'description', label: 'Answer', render: (r) => <Clip text={r.description} n={60} /> }]}
    fields={[{ name: 'title', label: 'Question', required: true }, { name: 'description', label: 'Answer', type: 'textarea', rows: 5, required: true }]} />
);

export const Enquiries = () => (
  <CrudPage title="Enquiries" description="Messages from the landing page contact form." endpoint="/admin/enquiries" singular="Enquiry" icon={Inbox} canCreate={false} canEdit={false} bulkDelete headerActions={<ExportMenu what="enquiries" base="/api/admin/export" />}
    view={(r) => <Detail rows={[['Name', r.name], ['E-mail', r.email], ['Subject', r.subject], ['Received', fmtDateTime(r.created_at)], ['Message', r.message]]} />}
    columns={[{ key: 'name', label: 'From', render: (r) => <div><p className="font-medium">{r.name}</p><p className="text-xs text-muted-foreground">{r.email}</p></div> }, { key: 'subject', label: 'Subject', render: (r) => <Clip text={r.subject || r.message} n={50} /> }, { key: 'created_at', label: 'Received', render: (r) => fmtDateTime(r.created_at) }]} />
);

export const Subscribers = () => (
  <CrudPage title="Email Subscribers" description="People who joined the newsletter from the website." endpoint="/admin/email-subscribers" singular="Subscriber" icon={MailCheck} canCreate={false} canEdit={false} bulkDelete headerActions={<ExportMenu what="subscribers" base="/api/admin/export" />}
    columns={[{ key: 'email', label: 'E-mail', render: (r) => <a href={`mailto:${r.email}`} className="font-medium hover:text-primary">{r.email}</a> }, { key: 'created_at', label: 'Subscribed', render: (r) => fmtDateTime(r.created_at) }]} />
);

export const NfcCards = () => (
  <CrudPage title="NFC Card Types" description="Physical NFC cards users can order for their vCards." endpoint="/admin/nfc-cards" singular="Card type" icon={CreditCard} size="lg"
    columns={[
      { key: 'name', label: 'Card', render: (r) => <div className="flex items-center gap-2"><Thumb url={r.front_image} /><Thumb url={r.back_image} /><span className="ml-1 font-medium">{r.name}</span></div> },
      { key: 'price', label: 'Price', render: (r) => <span className="font-semibold">{money(r.price)}</span> },
      { key: 'description', label: 'Description', render: (r) => <Clip text={r.description} n={50} /> },
      toggleCol('/admin/nfc-cards', 'status', 'Available'),
    ]}
    fields={[
      { name: 'name', label: 'Name', required: true }, { name: 'price', label: 'Price', type: 'number', half: true, required: true, min: 0, step: '0.01' },
      { name: 'description', label: 'Description', type: 'textarea', rows: 3 },
      { name: 'front_image', label: 'Front side', type: 'image', half: true }, { name: 'back_image', label: 'Back side', type: 'image', half: true },
      { name: 'status', label: 'Available for ordering', type: 'switch' },
    ]} />
);

export { StatusBadge };
