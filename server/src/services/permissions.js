/*
 * Role & permission model.
 *  Platform staff (admin panel): super_admin (everything), admin (everything except super-admin-only screens),
 *  manager and supervisor (only the permissions the super admin grants them).
 *  Companies (organisations): owner (everything in the company), manager and supervisor work on the company
 *  account with the permissions the owner grants them; members only have their own account.
 * Permission keys are `<module>.view` and `<module>.manage` (manage implies view).
 */

const ADMIN_MODULES = {
  dashboard: 'Dashboard',
  users: 'Users',
  vcards: 'vCards & templates',
  shortlinks: 'Short links & QR',
  domains: 'Custom domains',
  stores: 'WhatsApp stores',
  orders: 'Orders & NFC products',
  invoices: 'Invoices',
  finance: 'Finance & expenses',
  inventory: 'Inventory & vendors',
  analytics: 'Profit analytics',
  plans: 'Plans & subscriptions',
  payments: 'Payments & transactions',
  coupons: 'Coupon codes',
  affiliations: 'Affiliations',
  masters: 'Currencies, locations & languages',
  email: 'Send e-mail',
  announcements: 'Announcements',
  cms: 'Front CMS',
  settings: 'Settings',
  logs: 'Activity & message logs',
};

const COMPANY_MODULES = {
  vcards: 'vCards',
  leads: 'Enquiries, appointments & subscribers',
  stores: 'WhatsApp stores',
  shortlinks: 'Short links',
  orders: 'NFC orders',
  analytics: 'Analytics',
  billing: 'Plans & billing',
  members: 'Team members (add, lock, block, reset passwords, announcements)',
};

const keysOf = (mods) => Object.keys(mods).flatMap((m) => [`${m}.view`, `${m}.manage`]);

const DEFAULTS = {
  manager: ['dashboard', 'users', 'vcards', 'shortlinks', 'domains', 'stores', 'orders', 'invoices', 'announcements'].flatMap((m) => [`${m}.view`, `${m}.manage`]).concat(['finance.view', 'inventory.view', 'analytics.view', 'plans.view', 'payments.view']),
  supervisor: ['dashboard.view', 'orders.view', 'orders.manage', 'vcards.view', 'shortlinks.view', 'inventory.view', 'users.view'],
  company_manager: ['vcards', 'leads', 'stores', 'shortlinks', 'orders', 'analytics', 'members'].flatMap((m) => [`${m}.view`, `${m}.manage`]),
  company_supervisor: ['vcards.view', 'leads.view', 'leads.manage', 'analytics.view', 'orders.view'],
};

/** Effective permission list of a user (null = unrestricted) */
function permissionsOf(user) {
  if (!user) return [];
  if (user.role === 'super_admin' || user.role === 'admin') return null;
  if (user.role === 'manager' || user.role === 'supervisor') return Array.isArray(user.permissions) ? user.permissions : DEFAULTS[user.role];
  if (user.company_role === 'manager' || user.company_role === 'supervisor') return Array.isArray(user.permissions) ? user.permissions : DEFAULTS[`company_${user.company_role}`];
  return null; // regular users / company owners: their own account, no restriction
}

function can(user, key) {
  const list = permissionsOf(user);
  if (list === null) return true;
  const [mod, action] = key.split('.');
  return list.includes(key) || (action === 'view' && list.includes(`${mod}.manage`));
}

/** Only keep known keys (for saving) */
const clean = (list, company) => {
  const allowed = new Set(keysOf(company ? COMPANY_MODULES : ADMIN_MODULES));
  return [...new Set((Array.isArray(list) ? list : []).map(String))].filter((k) => allowed.has(k));
};

/* admin API path prefix -> module */
const ADMIN_PATHS = [
  [/^\/dashboard/, 'dashboard'], [/^\/(users|admins)/, 'users'], [/^\/(vcards|templates)/, 'vcards'], [/^\/short-links/, 'shortlinks'],
  [/^\/custom-domains/, 'domains'], [/^\/whatsapp-stores/, 'stores'], [/^\/(nfc-cards|nfc-orders|orders|orders-meta|order-sources|products|customers|organisations|guest-customers)/, 'orders'],
  [/^\/invoices/, 'invoices'], [/^\/(finance|expenses|partners|accounts|courier-settlements)/, 'finance'],
  [/^\/(inventory|vendors|purchases|stock)/, 'inventory'], [/^\/analytics/, 'analytics'],
  [/^\/(plans|subscriptions)/, 'plans'], [/^\/(transactions|cash-payments)/, 'payments'], [/^\/coupon-codes/, 'coupons'],
  [/^\/(affiliations|withdrawals)/, 'affiliations'], [/^\/(currencies|countries|states|cities|languages)/, 'masters'],
  [/^\/(send-email|sent-emails)/, 'email'], [/^\/announcements/, 'announcements'],
  [/^\/(features|about-us|front-testimonials|front-faqs|enquiries|email-subscribers|front-blogs)/, 'cms'],
  [/^\/(settings|email-templates)/, 'settings'], [/^\/(activity-logs|message-logs)/, 'logs'], [/^\/export\/(users)/, 'users'], [/^\/export\/(enquiries|subscribers)/, 'cms'],
];
const COMPANY_PATHS = [
  [/^\/(vcards|features)/, 'vcards'], [/^\/(enquiries|appointments|subscribers)/, 'leads'], [/^\/(stores|store-orders)/, 'stores'],
  [/^\/short-links/, 'shortlinks'], [/^\/(nfc-cards|nfc-orders|orders)/, 'orders'], [/^\/invoices/, 'billing'], [/^\/dashboard/, 'vcards'], [/^\/export/, 'analytics'],
  [/^\/(plans|subscribe|coupon|payment|transactions|affiliation|withdrawals)/, 'billing'], [/^\/organisation/, 'members'], [/^\/ai\//, 'vcards'],
  [/^\/announcements/, null],
];
const moduleFor = (table, path) => { for (const [re, m] of table) if (re.test(path)) return m; return undefined; };
const actionOf = (method) => (method === 'GET' || method === 'HEAD' ? 'view' : 'manage');

module.exports = { ADMIN_MODULES, COMPANY_MODULES, DEFAULTS, permissionsOf, can, clean, moduleFor, actionOf, ADMIN_PATHS, COMPANY_PATHS };
