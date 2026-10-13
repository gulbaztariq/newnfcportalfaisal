# NFC Profile: Node + React + MySQL

This rebuilds the InfyVCards **Super Admin** feature set (https://infyom.com/docs/infy-vcards/super-admin.html) on:

- **API / public site:** Node.js 18+, Express, Sequelize, **MySQL** (`server/`)
- **Website, admin and user portals:** React 19 + Vite (`client/`) with a custom design system: Tailwind CSS v4, Motion animations, Radix UI primitives, Recharts, cmdk (⌘K command palette), Sonner toasts, Tiptap rich text, Lucide icons
- **Public vCards:** rendered on the server (no JS framework) so they open instantly, with CSS entrance animations

## Quick start

```bash
# 1. install
npm run install:all

# 2. configure: copy server/.env.example to server/.env and fill in the DB_* values (MySQL)
#    create the database first:  CREATE DATABASE nfc_vcards CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

# 3. create the tables and seed the data
npm run db:setup

# 4. development: API on :5000, React on :5173
npm run dev:server
npm run dev:client
```

Production build: `npm run build`, then `npm start`. Express serves the built React app, the landing page, the vCards and the API from one port.

If you don't have MySQL yet, set `DB_DIALECT=sqlite` and `DB_STORAGE=./dev.sqlite` in `server/.env` to try it out.

### Seeded accounts (password `123456`, change it right away)

| Role | E-mail |
|---|---|
| Super Admin | sadmin@vcard.com |
| Admin | admin@vcard.com |
| Demo user (Premium plan, vCard at `/john-doe`) | user@vcard.com |

## URLs

| URL | What |
|---|---|
| `/` | Animated landing page (Front CMS driven: hero with live vCard phone, features bento, how it works, template carousel, pricing, testimonials, FAQ, contact, newsletter, banner popup) |
| `/{alias}` | Public vCard (plus `/{alias}/contact.vcf`, `/{alias}/qr.png`) |
| `/t/preview/{template}` | Template preview with sample data |
| `/s/{alias}` | WhatsApp store (orders go to WhatsApp) |
| `/shop`, `/shop/{slug}`, `/checkout`, `/track` | NFC product shop, checkout and order tracking |
| `/r/{code}` | Dynamic QR / NFC redirect |
| `/invoice/{token}` | Public invoice (print / PDF) |
| `/c/{alias}` | Sandboxed own-code vCard design |
| `/directory` | Business directory (vCards and stores that opted in) |
| `/blog`, `/blog/{slug}` | Front blog |
| `/login`, `/register`, `/forgot-password`, `/verify-email` | Auth (2FA step, Google sign-in, reCAPTCHA v3) |
| `/admin/*` | Super admin / admin panel |
| `/user/*` | User panel |
| `/terms-conditions`, `/privacy-policy` | Legal pages |

## Super admin features (per the InfyVCards documentation)

- **Dashboard:** active and deactivated users and vCards, total income, 12-month income chart, "plans by users" donut, recent registrations (day / week / month)
- **Admins:** create, edit, delete and activate admins (super admin only)
- **Users:** create, edit, delete, activate/deactivate, verify e-mail, **impersonate** (with "Back to Admin"), user detail page. New users get their login details by e-mail.
- **vCard Templates:** 32 profession templates (Developer, CEO, Lawyer, Doctor, Chef, Teacher and more) on 10 layouts, live previews, enable/disable
- **vCards:** all vCards, copy the preview URL, preview, **verify** (verified badge), activate/deactivate, delete
- **NFC Cards:** card types (front and back images, price) and NFC orders (status workflow, e-mail updates). **Write the NFC card** from the browser through Web NFC (Chrome on Android).
- **Plans:** price, currency, frequency (monthly / yearly / unlimited), trial days, number of vCards, storage, templates per plan, 19 feature switches, default plan
- **Subscribed User Plans:** edit the end date (+1/2/3/5 year shortcuts)
- **Cash Payments:** approve or reject manual payments (with receipt). Approving activates the plan or the NFC order.
- **Transactions**, **Coupon Codes** (percentage or fixed, usage limit, expiry)
- **Affiliations and Withdrawals:** approve or reject referral earnings, pay out or reject withdrawals with a reason
- **Currencies, Countries, States, Cities, Languages**
- **Send Email:** to all users, newsletter subscribers, contact-form enquiries or custom addresses (rich text, sent in BCC batches)
- **Front CMS:** email subscribers, About Us, Features, Testimonials, FAQs, Enquiries, theme choice (light or dark), banner, mobile app URLs, social links
- **Settings:** general (name, logos, favicon, dashboard logo, currency, affiliation amounts, registration switch), **payment configuration** (Stripe, PayPal, RazorPay, FlutterWave, PayStack, PhonePe, manual payment guide), Terms & Conditions / Privacy Policy, Google config (SEO meta and Analytics)
- Light / dark mode, ⌘K command palette, animated page transitions

## Features added from the release notes

Everything from the InfyVCards release notes that the first version was missing:

- **Accounts:** two-factor authentication (authenticator app + recovery codes), e-mail verification, Google sign-in, reCAPTCHA v3, blocked e-mail domains, phone number on sign-up
- **vCard sections:** products, appointments (slots, booking, double-booking guard), blog, custom pages, payment links, gallery videos, YouTube / video cover, Instagram and LinkedIn embeds, iFrames, newsletter popup, attachments on enquiries, terms and privacy per card, card language, PWA install, virtual background, custom QR code, custom domain (admin approval)
- **Analytics** per card (views, devices, browsers, countries, referrers) and exports (CSV / Excel / PDF) for enquiries, appointments, subscribers and users
- **WhatsApp stores:** categories, products with stock, cart and order sent to WhatsApp, order list
- **Organisations:** team accounts with members
- **AI writing tools** (Claude): bio / service texts and a whole vCard draft
- **Plans:** 31 feature switches, tax, custom duration, visitor, store and member limits, plan PDF, invoices (PDF)
- **Admin:** custom domains, WhatsApp stores, front blog, bulk delete, clone vCard to any user, resend verification, exports, organisation and store counts on the dashboard
- **Settings:** SMTP + test e-mail, editable e-mail templates, Slack notifications, reCAPTCHA, Google sign-in, AI key, timezone and date / time format, NFC order tax, expiry reminder days, 11 payment gateways, WhatsApp chat button, newsletter popup, directory and blog switches, custom CSS for the website

Not built: the portal UI translation manager, the mobile apps and paid add-on modules. Plain custom JavaScript is not injected into template vCards (it would run on the portal's origin); instead users can publish a full **own-code design** that runs in a sandboxed, unique origin (see below).

## Business modules (client wishlist)

- **Default vCard** for every new account (admin-created, registered, or shop buyer) plus the credentials e-mail
- **Dynamic links / URL shortener** (`/r/{code}`): every QR code and NFC chip points to a link whose destination (vCard, store or any URL) can be changed later. Bulk generation for pre-printed tags (batches, CSV/XLSX/PDF export), customers activate a tag with its code, scan analytics, admin lock, plan feature `url_shortener` + link limit
- **Shop** (`/shop`, `/checkout`, `/track`): the client's NFC product list in PKR (variants, customisation +Rs 400), cart, COD / bank / online payment, tax, delivery + COD charges, free-delivery threshold, design step (standard, **AI design with Claude** as SVG front/back, upload own artwork), auto account creation for new buyers, order tracking by number + phone
- **Orders**: workflow pending → confirmed → designing → printing → ready → dispatched → delivered (+ returned / cancelled) with history, notes, notifications, stock deduction on dispatch, NFC writing with the dynamic link, manual orders for phone/WhatsApp customers
- **Leopards Courier**: booking, airway bill, live status (manual + every 30 min), auto delivered/returned, cancel, COD payment sync and settlements; all credentials / shipper details editable in Settings > Courier
- **WhatsApp & SMS**: Meta WhatsApp Cloud API, Twilio or any HTTP gateway; editable message per step, approved-template mapping, admin numbers get new-order and dispatch alerts, message log
- **Invoices**: numbering, six templates (HTML print view + PDF), public share link, e-mail with PDF, partial payments, overdue flag, auto-invoice when an order is confirmed, invoice settings (company, logo, bank details, terms)
- **Finance**: live profit & loss (revenue, COGS, courier, expenses, net margin), per-product profit, ledger of every money movement, expenses/income with receipt screenshots, partner-wise spend, accounts with balances, receivables, COD outstanding, vendor payables, inventory value
- **Inventory & vendors**: items with weighted landed cost, local purchases and imports (exchange rate, shipping, customs, clearing allocated per unit), stock per location (main store or each printing vendor), transfers, adjustments, low-stock alerts, product costing (bill of materials + printing cost), vendor rates, bills (printing vs other) and payments with balances
- **Roles**: super admin, admin, manager, supervisor (permission matrix per module, view/manage) and company owner / manager / supervisor / member (company staff work on the company account with the permissions the owner grants)
- **Security**: e-mailed sign-in code on every login (optional for all users, always for staff once SMTP is set; authenticator app also supported), account lockout, automatic temporary IP bans for floods/scanners, global and per-route rate limits, audit log. Emergency switch: set `DISABLE_LOGIN_OTP=1` on the server if the mail server breaks. Put Cloudflare (or similar) in front for network-level DDoS protection
- **Announcements** to everyone / users / staff / a plan: bell with unread count, dashboard banner, optional e-mail
- **Templates**: 92 vCard templates on 24 layouts
- **Own-code vCard design**: HTML/CSS/JS written by the user, served from `/c/{alias}` with a CSP sandbox (opaque origin: it cannot read cookies or call the API), with `{{name}}`-style placeholders

## User panel

Dashboard with views, devices and enquiries charts. vCard builder: create a vCard, pick a template, then edit basic details, profile and cover images, colours and font, show or hide sections, social links, custom links, services, gallery, testimonials, business hours, password protection, SEO, custom CSS, live preview, QR download and duplicate. Also: enquiries, plan checkout (coupon, Stripe, PayPal, manual), transactions, NFC card ordering, affiliation link and withdrawals, profile and password.

## Security

bcrypt (cost 12), httpOnly `SameSite=strict` session cookies, JWT with token versioning (a password change or deactivation logs out every session), CSRF header check, Helmet with a nonce-based CSP, rate limits on auth, forms and the API, allow-listed request fields, server-side validation, sanitised rich text, escaped vCard output with scheme-checked URLs and hex-only colours, random upload filenames with MIME allow-list and size limits (no SVG), `/uploads` served with a sandbox CSP, reserved-alias protection, honeypots on public forms, secrets masked in the admin UI, no user enumeration on login or password reset.

## Payment gateways

Stripe, PayPal, PayStack, FlutterWave, RazorPay, MercadoPago, Cashfree, SSLCommerz, PayFast, PhonePe and Iyzico checkouts are in `server/src/services/payments.js` (redirect checkout + server-side verification on `/pay/return/{gateway}`), plus **manual / cash** payment. No gateway has been tested against real sandbox keys yet, so run a sandbox payment for each one you enable before going live.

## Project layout

```
server/src/
  index.js              Express app (security, static, API, SPA, pages)
  models/index.js       all Sequelize models
  routes/auth.js        login, register, reset, profile, impersonation exit
  routes/admin/         super admin API (index.js + users.js)
  routes/user/          user panel API
  routes/public.js      landing, vCard pages, public forms
  services/             settings, mail, subscription, payments
  views/templates/      vCard template catalogue and renderer
  scripts/              sync.js / seed.js
client/src/
  index.css             design tokens (light + dark), animations, utilities
  components/ui/        component library: buttons, inputs, dialogs, selects, tables, stat cards, charts, motion helpers
  layouts/              portal shell (animated sidebar, top bar, command palette) and menus
  pages/site|auth|admin|user
client/public/          brand SVGs, theme-init.js, Remix Icon font (used by public vCards)
```

The logo is an SVG component (`client/src/components/Logo.jsx`, `client/public/brand/`). Replace it with your own brand. Light/dark mode follows the user's system setting and can be toggled in the portal; the public site uses the Front CMS theme choice.

## Deployment (Railway)

Live at **https://web-production-2ed88.up.railway.app** (Railway project `nfc-vcards`: services `web` + `MySQL`, volume `/data` for uploads).

- Build: `npm run build` (installs server + client, builds React). Start: `npm start` (creates missing tables, seeds idempotently, starts the server).
- Variables on the `web` service: `NODE_ENV=production`, `JWT_SECRET`, `IMPERSONATE_SECRET`, `SUPER_ADMIN_EMAIL`, `SUPER_ADMIN_PASSWORD`, `MYSQL_URL=${{MySQL.MYSQL_URL}}`, `UPLOAD_DIR=/data/uploads`. Add `MAIL_HOST`, `MAIL_USER`, `MAIL_PASSWORD`, `MAIL_FROM` to send real e-mails.
- Redeploy after changes: `railway up --detach` from the project root (on Git Bash prefix with `MSYS_NO_PATHCONV=1`).
- `railway.json` (Config as Code) is supported by Railway until 2026-12-01; migrate with `railway config migrate` before then.
