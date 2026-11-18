const fs = require('fs'); const path = require('path');
const ids = (() => { try { return JSON.parse(fs.readFileSync(path.join(__dirname, '..', '.work', 'ids.json'), 'utf8')); } catch { return {}; } })();
const A = (s) => s.split(' ').map((x) => `/admin/${x}`);

const admin = [
  ...A('dashboard admins users templates vcards custom-domains whatsapp-stores cms/blog nfc-cards nfc-orders orders orders/new order-sources whatsapp-leads contact-tags guest-customers products short-links announcements logs card-analytics analytics finance finance/ledger finance/expenses finance/settlements finance/setup inventory inventory/movements purchases vendors invoices invoices/create plans plans/create subscriptions cash-payments transactions coupon-codes affiliations withdrawals currencies countries states cities languages translations send-email cms/settings cms/subscribers cms/about-us cms/features cms/testimonials cms/faqs cms/enquiries settings profile'),
  ...A('settings/general settings/email settings/payments settings/security settings/shop settings/invoices settings/whatsapp settings/roles'),
  ...(ids.orders || []).map((i) => `/admin/orders/${i}`), ...(ids.users || []).map((i) => `/admin/users/${i}`), ...(ids.vendors || []).map((i) => `/admin/vendors/${i}`),
  ...(ids.invoices || []).flatMap((i) => [`/admin/invoices/${i}`, `/admin/invoices/${i}/edit`]), ...(ids.guests || []).map((i) => `/admin/guest-customers/${i}`), ...(ids.plans || []).map((i) => `/admin/plans/${i}/edit`),
  '/admin/this-page-does-not-exist',
];
const user = [
  ...'dashboard vcards vcards/create analytics company-analytics appointments subscribers virtual-background organisation stores store-orders enquiries settings product-orders nfc-orders short-links invoices plans transactions affiliation profile'.split(' ').map((x) => `/user/${x}`),
  ...(ids.vcards || []).flatMap((i) => [`/user/vcards/${i}/edit`, `/user/vcards/${i}/analytics`]),
  '/user/this-page-does-not-exist',
];
const publicRoutes = [
  '/', '/terms-conditions', '/privacy-policy', '/directory', '/blog', '/shop', '/checkout', '/track',
  ...(ids.shop || []).map((s) => `/shop/${s}`), ...(ids.blog || []).map((s) => `/blog/${s}`), ...(ids.orderNumbers || []).map((n) => `/track/${n}`),
  ...(ids.adminVcards || []).filter((v) => v.alias).map((v) => `/${v.alias}`), '/this-page-does-not-exist',
];
const auth = ['/login', '/register', '/forgot-password', '/reset-password', '/verify-email'];

const VIEWPORTS = [[320, 568], [360, 740], [375, 667], [390, 844], [414, 896], [480, 854], [768, 1024], [820, 1180], [1024, 768], [1280, 720], [1366, 768], [1440, 900], [1920, 1080], [2560, 1440], [667, 375], [844, 390]];
module.exports = { admin, user, publicRoutes, auth, VIEWPORTS, ids };
