class HttpError extends Error {
  constructor(status, message, errors) { super(message); this.status = status; this.errors = errors; }
}
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const fail = (status, message, errors) => { throw new HttpError(status, message, errors); };

/** Minimal declarative validator: rules = { field: 'required|email|max:120|min:3|numeric|in:a,b' } */
/* ----- validation: messages name the field the person sees ("E-mail address is required"), never just "This field is required" ----- */
const LABELS = {
  email: 'E-mail address', alternative_email: 'Alternative e-mail', customer_email: 'Customer e-mail', org_email: 'Company e-mail', to: 'Recipient e-mail',
  password: 'Password', password_confirmation: 'Password confirmation', current_password: 'Current password',
  first_name: 'First name', last_name: 'Last name', name: 'Name', contact: 'Phone number', phone: 'Phone number', alternative_phone: 'Alternative phone',
  whatsapp_number: 'WhatsApp number', customer_phone: 'Customer phone number', org_phone: 'Company phone', region_code: 'Country code',
  url_alias: 'Card link', location_url: 'Google Maps link', link_url: 'Link address', target_url: 'Destination address', product_url: 'Product link', service_url: 'Service link', url: 'Web address',
  short_code: 'Short code', job_title: 'Job title', company_name: 'Company name', org_name: 'Company name', org_website: 'Company website', org_address: 'Company address', org_city: 'City', org_country: 'Country', seats: 'Seats',
  customer_name: 'Customer name', customer_address: 'Customer address', customer_note: 'Note', delivery_type: 'Delivery type', delivery_charges: 'Delivery charges',
  no_of_vcards: 'Number of vCards', trial_days: 'Trial days', storage_limit: 'Storage limit', sale_price: 'Sale price', purchase_price: 'Purchase price', discount_value: 'Discount value',
  from_time: 'Start time', to_time: 'End time', ends_at: 'End date', starts_at: 'Start date', iso_code: 'ISO code', currency_name: 'Currency name', currency_icon: 'Currency symbol', currency_code: 'Currency code',
  design_prompt: 'Design description', service_name: 'Service name', product_name: 'Product name', nfc_card_id: 'NFC card', inventory_item_id: 'Inventory item', vcard_id: 'vCard',
  subject: 'Subject', message: 'Message', audience: 'Audience', content: 'Content', tone: 'Tone', language: 'Language', address: 'Address', city: 'City', notes: 'Notes', amount: 'Amount', price: 'Price', quantity: 'Quantity', stock: 'Stock', date: 'Date', status: 'Status', type: 'Type', title: 'Title', description: 'Description', details: 'Details', folder: 'Folder', token: 'Link token', code: 'Code',
};
/** a readable name for a request field: known names first, otherwise "customer_name" -> "Customer name", "plan_id" -> "Plan" */
function labelOf(field, labels) {
  if (labels?.[field]) return labels[field];
  if (LABELS[field]) return LABELS[field];
  const t = String(field).replace(/_id$/, '').replace(/[_-]+/g, ' ').trim();
  return t ? t[0].toUpperCase() + t.slice(1) : 'This field';
}
const lower = (l) => (/^[A-Z][a-z]/.test(l) && !/^(E-mail|WhatsApp|ISO|NFC|URL)/.test(l) ? l[0].toLowerCase() + l.slice(1) : l);

/**
 * rules: { field: 'required|max:100' }. Rules: required, email, phone, url, alias, numeric, integer, date, min:n / max:n (characters),
 * minv:n / maxv:n (numeric value), in:a,b,c, same:otherField. Optional third argument: { field: 'Label' } to override a field name.
 */
function validate(body, rules, labels) {
  const errors = {};
  for (const [field, spec] of Object.entries(rules)) {
    const v = body[field];
    const empty = v === undefined || v === null || String(v).trim() === '';
    const L = labelOf(field, labels);
    for (const rule of spec.split('|')) {
      const i = rule.indexOf(':');
      const name = i < 0 ? rule : rule.slice(0, i); const arg = i < 0 ? undefined : rule.slice(i + 1);
      if (name === 'required' && empty) { errors[field] = /_id$/.test(field) || /\bin:/.test(spec) ? `Please choose ${/^[aeiou]/i.test(lower(L)) ? 'an' : 'a'} ${lower(L)}` : `${L} is required`; break; }
      if (empty) continue;
      const s = String(v);
      const num = Number(s);
      if (name === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) errors[field] = field === 'email' ? 'Enter a valid e-mail address, like name@example.com' : `${L} must be a valid e-mail address`;
      if (name === 'phone' && !(/^[+()\d][\d\s().+-]{4,24}$/.test(s) && s.replace(/\D/g, '').length >= 5 && s.replace(/\D/g, '').length <= 15)) errors[field] = `${L} is not a valid phone number (use 5 to 15 digits)`;
      if (name === 'max' && s.length > Number(arg)) errors[field] = `${L} must be ${arg} characters or fewer`;
      if (name === 'min' && s.length < Number(arg)) errors[field] = `${L} must be at least ${arg} characters`;
      if (name === 'numeric' && (s.trim() === '' || Number.isNaN(num))) errors[field] = `${L} must be a number`;
      if (name === 'integer' && !/^-?\d+$/.test(s.trim())) errors[field] = `${L} must be a whole number`;
      if (name === 'minv' && !Number.isNaN(num) && num < Number(arg)) errors[field] = `${L} must be ${arg} or more`;
      if (name === 'maxv' && !Number.isNaN(num) && num > Number(arg)) errors[field] = `${L} must be ${arg} or less`;
      if (name === 'date' && Number.isNaN(Date.parse(s))) errors[field] = `${L} must be a valid date`;
      if (name === 'in' && !arg.split(',').includes(s)) errors[field] = `Choose a valid ${lower(L)}`;
      if (name === 'url' && !/^https?:\/\/[^\s]+$/i.test(s)) errors[field] = `${L} must be a valid web address starting with http:// or https://`;
      if (name === 'alias' && !/^[a-z0-9][a-z0-9-_]{1,79}$/i.test(s)) errors[field] = `${L} can only contain letters, numbers, - and _ (2 to 80 characters)`;
      if (name === 'same' && s !== String(body[arg] ?? '')) errors[field] = `${L} does not match ${lower(labelOf(arg, labels))}`;
      if (errors[field]) break;
    }
  }
  if (Object.keys(errors).length) fail(422, 'Validation failed', errors);
}


/** Copy only whitelisted keys from body */
const pick = (obj, keys) => keys.reduce((o, k) => { if (obj[k] !== undefined) o[k] = obj[k]; return o; }, {});

const toBool = (v) => v === true || v === 'true' || v === 1 || v === '1' || v === 'on';

const paginate = (req, def = 10) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const perPage = Math.min(100, Math.max(1, parseInt(req.query.per_page, 10) || def));
  return { page, perPage, offset: (page - 1) * perPage, limit: perPage };
};
const paged = (rows, count, { page, perPage }) => ({
  data: rows, meta: { total: count, page, per_page: perPage, last_page: Math.max(1, Math.ceil(count / perPage)) },
});

module.exports = { HttpError, wrap, fail, validate, labelOf, pick, toBool, paginate, paged };
