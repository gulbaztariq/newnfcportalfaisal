/*
 * Instant form checks that use the same rules and wording as the server (server/src/utils/http.js), so a message
 * always names the field: "E-mail address is required", never "This field is required". The server still re-checks everything.
 */
const LABELS = {
  email: 'E-mail address', alternative_email: 'Alternative e-mail', password: 'Password', password_confirmation: 'Password confirmation', current_password: 'Current password',
  first_name: 'First name', last_name: 'Last name', name: 'Name', contact: 'Phone number', phone: 'Phone number', alternative_phone: 'Alternative phone', whatsapp_number: 'WhatsApp number',
  url_alias: 'Card link', location_url: 'Google Maps link', job_title: 'Job title', company_name: 'Company name', code: 'Code', subject: 'Subject', message: 'Message', title: 'Title', description: 'Description',
};
export const labelOf = (field, labels) => {
  if (labels?.[field]) return labels[field];
  if (LABELS[field]) return LABELS[field];
  const t = String(field).replace(/_id$/, '').replace(/[_-]+/g, ' ').trim();
  return t ? t[0].toUpperCase() + t.slice(1) : 'This field';
};
const lower = (l) => (/^[A-Z][a-z]/.test(l) && !/^(E-mail|WhatsApp|ISO|NFC|URL)/.test(l) ? l[0].toLowerCase() + l.slice(1) : l);

/** @returns {Object} { field: message } (empty when everything is fine) */
export function check(values, rules, labels) {
  const errors = {};
  for (const [field, spec] of Object.entries(rules)) {
    const v = values[field];
    const empty = v === undefined || v === null || String(v).trim() === '';
    const L = labelOf(field, labels);
    for (const rule of spec.split('|')) {
      const i = rule.indexOf(':');
      const name = i < 0 ? rule : rule.slice(0, i); const arg = i < 0 ? undefined : rule.slice(i + 1);
      if (name === 'required' && empty) { errors[field] = /_id$/.test(field) ? `Please choose a ${lower(L)}` : `${L} is required`; break; }
      if (empty) continue;
      const s = String(v).trim(); const num = Number(s);
      if (name === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) errors[field] = field === 'email' ? 'Enter a valid e-mail address, like name@example.com' : `${L} must be a valid e-mail address`;
      if (name === 'phone' && !(/^[+()\d][\d\s().+-]{4,24}$/.test(s) && s.replace(/\D/g, '').length >= 5 && s.replace(/\D/g, '').length <= 15)) errors[field] = `${L} is not a valid phone number (use 5 to 15 digits)`;
      if (name === 'max' && s.length > Number(arg)) errors[field] = `${L} must be ${arg} characters or fewer`;
      if (name === 'min' && s.length < Number(arg)) errors[field] = `${L} must be at least ${arg} characters`;
      if (name === 'numeric' && Number.isNaN(num)) errors[field] = `${L} must be a number`;
      if (name === 'url' && !/^https?:\/\/[^\s]+$/i.test(s)) errors[field] = `${L} must be a valid web address starting with http:// or https://`;
      if (name === 'same' && String(v) !== String(values[arg] ?? '')) errors[field] = `${L} does not match ${lower(labelOf(arg, labels))}`;
      if (errors[field]) break;
    }
  }
  return errors;
}
