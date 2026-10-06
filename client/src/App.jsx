import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Toaster } from 'sonner';
import { AuthProvider, useAuth, homeFor } from '@/lib/auth';
import { CartProvider } from '@/lib/cart';
import { DialogHost, TooltipProvider, Spinner } from '@/components/ui';
import { LogoMark } from '@/components/Logo';

const PortalLayout = lazy(() => import('@/layouts/PortalLayout'));
const Landing = lazy(() => import('@/pages/site/Landing'));
const Legal = lazy(() => import('@/pages/site/Legal'));
const lazyNamed = (loader, name) => lazy(() => loader().then((m) => ({ default: m[name] })));

const A = {
  Dashboard: lazy(() => import('@/pages/admin/Dashboard')),
  Users: lazy(() => import('@/pages/admin/Users')),
  UserDetail: lazyNamed(() => import('@/pages/admin/Users'), 'UserDetail'),
  Templates: lazyNamed(() => import('@/pages/admin/VcardsAdmin'), 'Templates'),
  Vcards: lazyNamed(() => import('@/pages/admin/VcardsAdmin'), 'Vcards'),
  Plans: lazy(() => import('@/pages/admin/Plans')),
  PlanForm: lazyNamed(() => import('@/pages/admin/Plans'), 'PlanForm'),
  Subscriptions: lazyNamed(() => import('@/pages/admin/Payments'), 'Subscriptions'),
  CashPayments: lazyNamed(() => import('@/pages/admin/Payments'), 'CashPayments'),
  Transactions: lazyNamed(() => import('@/pages/admin/Payments'), 'Transactions'),
  Affiliations: lazyNamed(() => import('@/pages/admin/Payments'), 'Affiliations'),
  Withdrawals: lazyNamed(() => import('@/pages/admin/Payments'), 'Withdrawals'),
  NfcOrders: lazyNamed(() => import('@/pages/admin/Payments'), 'NfcOrders'),
  SendEmail: lazy(() => import('@/pages/admin/SendEmail')),
  Settings: lazy(() => import('@/pages/admin/Settings')),
  FrontSettings: lazyNamed(() => import('@/pages/admin/Settings'), 'FrontSettings'),
};
const masters = ['NfcCards', 'CouponCodes', 'Currencies', 'Countries', 'States', 'Cities', 'Languages', 'Subscribers', 'AboutUs', 'Features', 'FrontTestimonials', 'FrontFaqs', 'Enquiries'];
const MS = Object.fromEntries(masters.map((n) => [n, lazyNamed(() => import('@/pages/admin/Masters'), n)]));
const U = {
  Dashboard: lazy(() => import('@/pages/user/UserDashboard')),
  VcardList: lazyNamed(() => import('@/pages/user/Vcards'), 'VcardList'),
  VcardCreate: lazyNamed(() => import('@/pages/user/Vcards'), 'VcardCreate'),
  Enquiries: lazyNamed(() => import('@/pages/user/Vcards'), 'UserEnquiries'),
  Editor: lazy(() => import('@/pages/user/VcardEditor')),
  Plans: lazyNamed(() => import('@/pages/user/Billing'), 'UserPlans'),
  PaymentSuccess: lazyNamed(() => import('@/pages/user/Billing'), 'PaymentSuccess'),
  Transactions: lazyNamed(() => import('@/pages/user/Billing'), 'UserTransactions'),
  NfcOrders: lazyNamed(() => import('@/pages/user/Billing'), 'UserNfcOrders'),
  Affiliation: lazyNamed(() => import('@/pages/user/Billing'), 'Affiliation'),
  Analytics: lazyNamed(() => import('@/pages/user/UserExtras'), 'VcardAnalytics'),
  Appointments: lazyNamed(() => import('@/pages/user/UserExtras'), 'Appointments'),
  Subscribers: lazyNamed(() => import('@/pages/user/UserExtras'), 'Subscribers'),
  VirtualBg: lazyNamed(() => import('@/pages/user/UserExtras'), 'VirtualBackground'),
  Organisation: lazy(() => import('@/pages/user/Organisation')),
  Stores: lazyNamed(() => import('@/pages/user/Stores'), 'StoresList'),
  StoreEditor: lazyNamed(() => import('@/pages/user/Stores'), 'StoreEditor'),
  StoreOrders: lazyNamed(() => import('@/pages/user/Stores'), 'StoreOrders'),
};
const AX = {
  Domains: lazyNamed(() => import('@/pages/admin/AdminExtras'), 'CustomDomains'),
  Stores: lazyNamed(() => import('@/pages/admin/AdminExtras'), 'AdminStores'),
  Blog: lazyNamed(() => import('@/pages/admin/AdminExtras'), 'FrontBlogs'),
};
const BZ = {
  Orders: lazyNamed(() => import('@/pages/admin/Orders'), 'Orders'),
  OrderDetail: lazyNamed(() => import('@/pages/admin/Orders'), 'OrderDetail'),
  OrderWizard: lazy(() => import('@/pages/admin/OrderWizard')),
  OrderSources: lazyNamed(() => import('@/pages/admin/Orders'), 'OrderSources'),
  GuestCustomers: lazyNamed(() => import('@/pages/admin/Guests'), 'GuestCustomers'),
  GuestDetail: lazyNamed(() => import('@/pages/admin/Guests'), 'GuestDetail'),
  Products: lazyNamed(() => import('@/pages/admin/Orders'), 'Products'),
  ShortLinks: lazyNamed(() => import('@/pages/admin/AdminTools'), 'ShortLinks'),
  Announcements: lazyNamed(() => import('@/pages/admin/AdminTools'), 'Announcements'),
  Logs: lazyNamed(() => import('@/pages/admin/AdminTools'), 'Logs'),
};
const UB = {
  Orders: lazyNamed(() => import('@/pages/user/UserBusiness'), 'UserOrders'),
  OrderDetail: lazyNamed(() => import('@/pages/user/UserBusiness'), 'UserOrderDetail'),
  ShortLinks: lazyNamed(() => import('@/pages/user/UserBusiness'), 'UserShortLinks'),
  Invoices: lazyNamed(() => import('@/pages/user/UserBusiness'), 'UserInvoices'),
};
const SH = Object.fromEntries(['ShopPage', 'ProductPage', 'CheckoutPage', 'TrackPage'].map((n) => [n, lazyNamed(() => import('@/pages/site/Shop'), n)]));
const FN = Object.fromEntries([['FinanceOverview', 'Finance'], ['Ledger', 'Finance'], ['Expenses', 'Finance'], ['CourierSettlements', 'Finance'], ['FinanceSetup', 'Finance'], ['InventoryItems', 'Inventory'], ['StockMovements', 'Inventory'], ['Purchases', 'Inventory'], ['Vendors', 'Vendors'], ['VendorDetail', 'Vendors'], ['Invoices', 'Invoices'], ['InvoiceEditor', 'Invoices'], ['InvoiceView', 'Invoices']]
  .map(([n, f]) => [n, lazyNamed(() => import(`./pages/admin/${f}.jsx`), n)]));
const Directory = lazy(() => import('@/pages/site/Directory'));
const BlogList = lazyNamed(() => import('@/pages/site/Blog'), 'BlogList');
const BlogPost = lazyNamed(() => import('@/pages/site/Blog'), 'BlogPost');
const Profile = lazy(() => import('@/pages/Profile'));
const AuthPage = (name) => lazyNamed(() => import('@/pages/auth/AuthPages'), name);
const Login = AuthPage('Login'); const Register = AuthPage('Register'); const Forgot = AuthPage('ForgotPassword'); const Reset = AuthPage('ResetPassword'); const Verify = AuthPage('VerifyEmail');

function Splash() {
  return <div className="grid min-h-screen place-items-center"><div className="flex flex-col items-center gap-4"><LogoMark className="size-12 animate-pulse" /><Spinner /></div></div>;
}

function Guard({ area, children }) {
  const { user, loading } = useAuth();
  if (loading) return <Splash />;
  if (!user) return <Navigate to="/login" replace />;
  const isAdmin = user.role === 'super_admin' || user.role === 'admin';
  if ((area === 'admin' && !isAdmin) || (area === 'user' && user.role !== 'user')) return <Navigate to={homeFor(user)} replace />;
  return children;
}

function NotFound() {
  return (
    <div className="grid min-h-[60vh] place-items-center text-center">
      <div>
        <p className="text-gradient font-display text-8xl font-extrabold">404</p>
        <p className="mt-3 font-display text-xl font-semibold">Page not found</p>
        <p className="mt-1 text-sm text-muted-foreground">The page you are looking for does not exist.</p>
        <a href="/" className="mt-6 inline-flex h-10 items-center rounded-xl bg-primary px-5 text-sm font-medium text-white">Back home</a>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <TooltipProvider>
        <BrowserRouter>
          <CartProvider>
          <Suspense fallback={<Splash />}>
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/terms-conditions" element={<Legal slug="terms-conditions" />} />
              <Route path="/privacy-policy" element={<Legal slug="privacy-policy" />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/forgot-password" element={<Forgot />} />
              <Route path="/reset-password" element={<Reset />} />
              <Route path="/verify-email" element={<Verify />} />
              <Route path="/directory" element={<Directory />} />
              <Route path="/blog" element={<BlogList />} />
              <Route path="/shop" element={<SH.ShopPage />} />
              <Route path="/shop/:slug" element={<SH.ProductPage />} />
              <Route path="/checkout" element={<SH.CheckoutPage />} />
              <Route path="/track" element={<SH.TrackPage />} />
              <Route path="/track/:number" element={<SH.TrackPage />} />
              <Route path="/blog/:slug" element={<BlogPost />} />

              <Route path="/admin" element={<Guard area="admin"><PortalLayout area="admin" /></Guard>}>
                <Route index element={<Navigate to="dashboard" replace />} />
                <Route path="dashboard" element={<A.Dashboard />} />
                <Route path="admins" element={<A.Users role="admin" />} />
                <Route path="users" element={<A.Users role="user" />} />
                <Route path="users/:id" element={<A.UserDetail />} />
                <Route path="templates" element={<A.Templates />} />
                <Route path="vcards" element={<A.Vcards />} />
                <Route path="custom-domains" element={<AX.Domains />} />
                <Route path="whatsapp-stores" element={<AX.Stores />} />
                <Route path="cms/blog" element={<AX.Blog />} />
                <Route path="nfc-cards" element={<Navigate to="/admin/products" replace />} />
                <Route path="nfc-orders" element={<Navigate to="/admin/orders" replace />} />
                <Route path="orders" element={<BZ.Orders />} />
                <Route path="orders/new" element={<BZ.OrderWizard />} />
                <Route path="orders/:id" element={<BZ.OrderDetail />} />
                <Route path="order-sources" element={<BZ.OrderSources />} />
                <Route path="guest-customers" element={<BZ.GuestCustomers />} />
                <Route path="guest-customers/:id" element={<BZ.GuestDetail />} />
                <Route path="products" element={<BZ.Products />} />
                <Route path="short-links" element={<BZ.ShortLinks />} />
                <Route path="announcements" element={<BZ.Announcements />} />
                <Route path="logs" element={<BZ.Logs />} />
                <Route path="analytics" element={<FN.FinanceOverview />} />
                <Route path="finance" element={<FN.FinanceOverview />} />
                <Route path="finance/ledger" element={<FN.Ledger />} />
                <Route path="finance/expenses" element={<FN.Expenses />} />
                <Route path="finance/settlements" element={<FN.CourierSettlements />} />
                <Route path="finance/setup" element={<FN.FinanceSetup />} />
                <Route path="inventory" element={<FN.InventoryItems />} />
                <Route path="inventory/movements" element={<FN.StockMovements />} />
                <Route path="purchases" element={<FN.Purchases />} />
                <Route path="vendors" element={<FN.Vendors />} />
                <Route path="vendors/:id" element={<FN.VendorDetail />} />
                <Route path="invoices" element={<FN.Invoices />} />
                <Route path="invoices/create" element={<FN.InvoiceEditor />} />
                <Route path="invoices/:id/edit" element={<FN.InvoiceEditor />} />
                <Route path="invoices/:id" element={<FN.InvoiceView />} />
                <Route path="plans" element={<A.Plans />} />
                <Route path="plans/create" element={<A.PlanForm />} />
                <Route path="plans/:id/edit" element={<A.PlanForm />} />
                <Route path="subscriptions" element={<A.Subscriptions />} />
                <Route path="cash-payments" element={<A.CashPayments />} />
                <Route path="transactions" element={<A.Transactions />} />
                <Route path="coupon-codes" element={<MS.CouponCodes />} />
                <Route path="affiliations" element={<A.Affiliations />} />
                <Route path="withdrawals" element={<A.Withdrawals />} />
                <Route path="currencies" element={<MS.Currencies />} />
                <Route path="countries" element={<MS.Countries />} />
                <Route path="states" element={<MS.States />} />
                <Route path="cities" element={<MS.Cities />} />
                <Route path="languages" element={<MS.Languages />} />
                <Route path="send-email" element={<A.SendEmail />} />
                <Route path="cms/settings" element={<A.FrontSettings />} />
                <Route path="cms/subscribers" element={<MS.Subscribers />} />
                <Route path="cms/about-us" element={<MS.AboutUs />} />
                <Route path="cms/features" element={<MS.Features />} />
                <Route path="cms/testimonials" element={<MS.FrontTestimonials />} />
                <Route path="cms/faqs" element={<MS.FrontFaqs />} />
                <Route path="cms/enquiries" element={<MS.Enquiries />} />
                <Route path="settings" element={<Navigate to="general" replace />} />
                <Route path="settings/:tab" element={<A.Settings />} />
                <Route path="profile" element={<Profile />} />
                <Route path="*" element={<NotFound />} />
              </Route>

              <Route path="/user" element={<Guard area="user"><PortalLayout area="user" /></Guard>}>
                <Route index element={<Navigate to="dashboard" replace />} />
                <Route path="dashboard" element={<U.Dashboard />} />
                <Route path="vcards" element={<U.VcardList />} />
                <Route path="vcards/create" element={<U.VcardCreate />} />
                <Route path="vcards/:id/edit" element={<U.Editor />} />
                <Route path="vcards/:id/analytics" element={<U.Analytics />} />
                <Route path="appointments" element={<U.Appointments />} />
                <Route path="subscribers" element={<U.Subscribers />} />
                <Route path="virtual-background" element={<U.VirtualBg />} />
                <Route path="organisation" element={<U.Organisation />} />
                <Route path="stores" element={<U.Stores />} />
                <Route path="stores/:sid" element={<U.StoreEditor />} />
                <Route path="store-orders" element={<U.StoreOrders />} />
                <Route path="enquiries" element={<U.Enquiries />} />
                <Route path="nfc-orders" element={<UB.Orders />} />
                <Route path="orders/:id" element={<UB.OrderDetail />} />
                <Route path="short-links" element={<UB.ShortLinks />} />
                <Route path="invoices" element={<UB.Invoices />} />
                <Route path="plans" element={<U.Plans />} />
                <Route path="payment/:gateway/success" element={<U.PaymentSuccess />} />
                <Route path="transactions" element={<U.Transactions />} />
                <Route path="affiliation" element={<U.Affiliation />} />
                <Route path="profile" element={<Profile />} />
                <Route path="*" element={<NotFound />} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
          </CartProvider>
          <DialogHost />
          <Toaster position="top-right" richColors closeButton toastOptions={{ className: '!rounded-2xl !font-sans' }} />
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  );
}

