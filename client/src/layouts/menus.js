import {
  LayoutDashboard, ShieldCheck, Users, LayoutTemplate, IdCard, Nfc, Package, Receipt, Banknote, ArrowLeftRight, TicketPercent,
  Network, Coins, Globe2, Languages, Mail, Newspaper, Settings, MessageSquareText, UserCircle, Wallet, Store, Link2, CalendarClock, MailCheck, MonitorPlay, Building2,
  ShoppingBag, FileText, TrendingUp, BookOpen, Boxes, Truck, Megaphone, History, QrCode, Landmark,
  UserRound,
} from 'lucide-react';
import { can } from '@/lib/perms';

/** keep items the user may see; drop empty groups / child lists */
function filterMenu(groups, allowed) {
  return groups.map((g) => ({
    ...g,
    items: g.items.filter(Boolean).map((i) => (i.children ? { ...i, children: i.children.filter((c) => allowed(c.perm || i.perm)) } : i))
      .filter((i) => (i.children ? i.children.length : allowed(i.perm))),
  })).filter((g) => g.items.length);
}

/* Super admin menu: InfyVCards super admin documentation + business modules (orders, finance, inventory) */
export const adminMenu = (user) => filterMenu([
  { group: 'Overview', items: [{ label: 'Dashboard', icon: LayoutDashboard, to: '/admin/dashboard', perm: 'dashboard' }, { label: 'Profit analytics', icon: TrendingUp, to: '/admin/analytics', perm: 'analytics' }] },
  {
    group: 'Sales', items: [
      { label: 'Orders', icon: ShoppingBag, to: '/admin/orders', perm: 'orders' },
      { label: 'Products', icon: Nfc, to: '/admin/products', perm: 'orders' },
      { label: 'Contact tags', icon: ShieldCheck, to: '/admin/contact-tags', perm: 'orders' },
      { label: 'Guest customers', icon: UserRound, to: '/admin/guest-customers', perm: 'orders' },
      { label: 'Order sources', icon: Globe2, to: '/admin/order-sources', perm: 'orders' },
      { label: 'Invoices', icon: FileText, to: '/admin/invoices', perm: 'invoices' },
      { label: 'Short links & QR', icon: QrCode, to: '/admin/short-links', perm: 'shortlinks' },
    ],
  },
  {
    group: 'Finance', items: [
      { label: 'Ledger', icon: BookOpen, to: '/admin/finance/ledger', perm: 'finance' },
      { label: 'Expenses & income', icon: Receipt, to: '/admin/finance/expenses', perm: 'finance' },
      { label: 'COD settlements', icon: Truck, to: '/admin/finance/settlements', perm: 'finance' },
      { label: 'Accounts & partners', icon: Landmark, to: '/admin/finance/setup', perm: 'finance' },
    ],
  },
  {
    group: 'Inventory', items: [
      { label: 'Stock', icon: Boxes, to: '/admin/inventory', perm: 'inventory' },
      { label: 'Stock movements', icon: ArrowLeftRight, to: '/admin/inventory/movements', perm: 'inventory' },
      { label: 'Purchases & imports', icon: Package, to: '/admin/purchases', perm: 'inventory' },
      { label: 'Printing vendors', icon: Building2, to: '/admin/vendors', perm: 'inventory' },
    ],
  },
  {
    group: 'Management', items: [
      user?.role === 'super_admin' && { label: 'Staff & roles', icon: ShieldCheck, to: '/admin/admins', perm: 'super' },
      { label: 'Users', icon: Users, to: '/admin/users', perm: 'users' },
      { label: 'vCard Templates', icon: LayoutTemplate, to: '/admin/templates', perm: 'vcards' },
      { label: 'vCards', icon: IdCard, to: '/admin/vcards', perm: 'vcards' },
      { label: 'Custom Domains', icon: Link2, to: '/admin/custom-domains', perm: 'domains' },
      { label: 'WhatsApp Stores', icon: Store, to: '/admin/whatsapp-stores', perm: 'stores' },
    ],
  },
  {
    group: 'Revenue', items: [
      { label: 'Plans', icon: Package, to: '/admin/plans', perm: 'plans' },
      { label: 'Subscriptions', icon: Receipt, to: '/admin/subscriptions', perm: 'plans' },
      { label: 'Cash Payments', icon: Banknote, to: '/admin/cash-payments', perm: 'payments' },
      { label: 'Transactions', icon: ArrowLeftRight, to: '/admin/transactions', perm: 'payments' },
      { label: 'Coupon Codes', icon: TicketPercent, to: '/admin/coupon-codes', perm: 'coupons' },
      { label: 'Affiliations', icon: Network, perm: 'affiliations', children: [{ label: 'Affiliation Users', to: '/admin/affiliations' }, { label: 'Withdrawals', to: '/admin/withdrawals' }] },
    ],
  },
  {
    group: 'Configuration', items: [
      { label: 'Announcements', icon: Megaphone, to: '/admin/announcements', perm: 'announcements' },
      { label: 'Send Email', icon: Mail, to: '/admin/send-email', perm: 'email' },
      { label: 'Currencies', icon: Coins, to: '/admin/currencies', perm: 'masters' },
      { label: 'Locations', icon: Globe2, perm: 'masters', children: [{ label: 'Countries', to: '/admin/countries' }, { label: 'States', to: '/admin/states' }, { label: 'Cities', to: '/admin/cities' }] },
      { label: 'Languages', icon: Languages, to: '/admin/languages', perm: 'masters' },
      {
        label: 'Front CMS', icon: Newspaper, perm: 'cms', children: [
          { label: 'Front Settings', to: '/admin/cms/settings', perm: 'settings' }, { label: 'Email Subscribers', to: '/admin/cms/subscribers' },
          { label: 'About Us', to: '/admin/cms/about-us' }, { label: 'Features', to: '/admin/cms/features' },
          { label: 'Testimonials', to: '/admin/cms/testimonials' }, { label: 'FAQs', to: '/admin/cms/faqs' }, { label: 'Blog', to: '/admin/cms/blog' }, { label: 'Enquiries', to: '/admin/cms/enquiries' },
        ],
      },
      {
        label: 'Settings', icon: Settings, perm: 'settings', children: [
          { label: 'General', to: '/admin/settings/general' }, { label: 'Payment Gateways', to: '/admin/settings/payment' },
          { label: 'Shop & delivery', to: '/admin/settings/shop' }, { label: 'Courier (Leopards)', to: '/admin/settings/courier' },
          { label: 'WhatsApp & SMS', to: '/admin/settings/messaging' }, { label: 'Invoices', to: '/admin/settings/invoices' },
          { label: 'Terms & Privacy', to: '/admin/settings/terms' }, { label: 'SEO & Google', to: '/admin/settings/google' },
          { label: 'Mail & Templates', to: '/admin/settings/mail' }, { label: 'Security & Integrations', to: '/admin/settings/integrations' },
        ],
      },
      { label: 'Logs', icon: History, to: '/admin/logs', perm: 'logs' },
    ],
  },
], (perm) => (perm === 'super' ? user?.role === 'super_admin' : !perm || can(user, `${perm}.view`)));

export const userMenu = (user) => filterMenu([
  { group: 'Overview', items: [{ label: 'Dashboard', icon: LayoutDashboard, to: '/user/dashboard', perm: 'vcards' }] },
  {
    group: 'My Cards', items: [
      { label: 'vCards', icon: IdCard, to: '/user/vcards', perm: 'vcards' },
      { label: 'Dynamic links & QR', icon: QrCode, to: '/user/short-links', perm: 'shortlinks' },
      { label: 'NFC orders', icon: Nfc, to: '/user/nfc-orders', perm: 'orders' },
      { label: 'Virtual Background', icon: MonitorPlay, to: '/user/virtual-background', perm: 'vcards' },
    ],
  },
  {
    group: 'Leads', items: [
      { label: 'Enquiries', icon: MessageSquareText, to: '/user/enquiries', perm: 'leads' },
      { label: 'Appointments', icon: CalendarClock, to: '/user/appointments', perm: 'leads' },
      { label: 'Subscribers', icon: MailCheck, to: '/user/subscribers', perm: 'leads' },
    ],
  },
  {
    group: 'Commerce', items: [
      { label: 'WhatsApp Stores', icon: Store, to: '/user/stores', perm: 'stores' },
      { label: 'Store Orders', icon: Receipt, to: '/user/store-orders', perm: 'stores' },
    ],
  },
  {
    group: 'Account', items: [
      { label: 'Plans & Billing', icon: Package, to: '/user/plans', perm: 'billing' },
      { label: 'Transactions', icon: Receipt, to: '/user/transactions', perm: 'billing' },
      { label: 'Invoices', icon: FileText, to: '/user/invoices', perm: 'billing' },
      { label: 'Affiliation', icon: Wallet, to: '/user/affiliation', perm: 'billing' },
      { label: 'Organisation', icon: Building2, to: '/user/organisation', perm: 'members' },
      { label: 'Profile', icon: UserCircle, to: '/user/profile' },
    ],
  },
], (perm) => !perm || !['manager', 'supervisor'].includes(user?.company_role) || can(user, `${perm}.view`));

/** flatten for the command palette */
export const flatten = (menu) => menu.flatMap((g) => g.items.flatMap((i) => (i.children ? i.children.map((c) => ({ ...c, icon: i.icon, group: i.label })) : [{ ...i, group: g.group }])));
