class HttpError extends Error {
  constructor(status, message, errors) { super(message); this.status = status; this.errors = errors; }
}
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const fail = (status, message, errors) => { throw new HttpError(status, message, errors); };

/** Minimal declarative validator: rules = { field: 'required|email|max:120|min:3|numeric|in:a,b' } */
function validate(body, rules) {
  const errors = {};
  for (const [field, spec] of Object.entries(rules)) {
    const v = body[field];
    const empty = v === undefined || v === null || String(v).trim() === '';
    for (const rule of spec.split('|')) {
      const [name, arg] = rule.split(':');
      if (name === 'required' && empty) { errors[field] = 'This field is required'; break; }
      if (empty) continue;
      const s = String(v);
      if (name === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) errors[field] = 'Enter a valid e-mail address';
      if (name === 'max' && s.length > Number(arg)) errors[field] = `Maximum ${arg} characters`;
      if (name === 'min' && s.length < Number(arg)) errors[field] = `Minimum ${arg} characters`;
      if (name === 'numeric' && Number.isNaN(Number(s))) errors[field] = 'Must be a number';
      if (name === 'in' && !arg.split(',').includes(s)) errors[field] = 'Invalid value';
      if (name === 'url' && !/^https?:\/\/[^\s]+$/i.test(s)) errors[field] = 'Enter a valid URL (http/https)';
      if (name === 'alias' && !/^[a-z0-9][a-z0-9-_]{1,79}$/i.test(s)) errors[field] = 'Only letters, numbers, - and _';
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

module.exports = { HttpError, wrap, fail, validate, pick, toBool, paginate, paged };
