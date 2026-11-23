# NFC Profile upgrade: final report

Date: 2026-11-23. Stack unchanged (Node 22, Express 5, Sequelize/MySQL, React 19/Vite/Tailwind). Everything below is deployed at https://app.smartvisitingcards.com unless marked otherwise. The competitor research is in [COMPETITOR-MATRIX.md](COMPETITOR-MATRIX.md).

## 1. Existing system audit (before this work)

Already built and kept: 112 server-rendered vCard templates with gallery and live preview, section ordering, 6 card languages, styled dynamic QR, short links for NFC tags, `.vcf` download, enquiry form, appointments, store and orders, WhatsApp lead inbox (QR gateway and Meta API), analytics (views, devices, referrers, actions), organisation accounts (members, roles, locks, announcements, company analytics, CSV import), custom domains, password-protected cards, plans and subscriptions with gateways, admin back office (orders, invoices, inventory, courier, finance), translations, 2FA and login lockout.

Gaps found: weak `.vcf`, no lead follow-up fields, no outbound integrations, no campaign/UTM or QR-vs-NFC tracking, no email signatures, no team design, no native contact sync.

## 2-3. Competitor research and matrix

13 platforms, public pages only. See [COMPETITOR-MATRIX.md](COMPETITOR-MATRIX.md). Anything behind a login is UNVERIFIED; zeeqr.com exposed almost nothing publicly.

## 4. Features implemented (with where they live)

| Feature | Where in the app | Main source files |
|---|---|---|
| Bank and wallet accounts with copy buttons, Pakistani bank/wallet list | Editor > Payments; shown on every template | `client/src/lib/pkBanks.js`, `client/src/pages/user/EditorExtras.jsx`, `server/src/views/templates/render.js` |
| 68 duplicate-layout templates removed (112 remain) | Template gallery | `server/src/views/templates/catalog.js` |
| Rewritten `.vcf` (RFC-correct escaping and folding, +country phone numbers, photo, social profiles, note, card URL) | `/{alias}/contact.vcf` | `server/src/services/vcf.js` |
| Lead status, tags, notes, search, filters, export | User menu > Leads | `server/src/routes/user/index.js`, `client/src/pages/user/Leads.jsx` |
| Signed outgoing webhooks (lead, appointment, subscriber) with delivery log | User menu > Integrations | `server/src/services/webhooks.js` |
| WhatsApp leads also fire webhooks and Google sync | automatic | `server/src/services/whatsapp.js` |
| Google Contacts sync (OAuth per user) | Integrations page; admin credentials in Admin > Settings | `server/src/services/googlecontacts.js` |
| Campaign (utm_*) analytics, QR vs NFC channel split, campaign link builder | Analytics page | `server/src/services/analytics.js`, `server/src/routes/redirects.js`, `client/src/pages/user/Analytics.jsx` |
| Email signature generator (4 styles) | User menu > Email signature | `server/src/services/signature.js`, `client/src/pages/user/Signatures.jsx` |
| Team: CSV check before import, extra CSV columns, team card design applied to new and existing cards, team export, team signature file | Organisation page | `server/src/services/organisation.js`, `server/src/routes/user/content.js`, `client/src/pages/user/Organisation.jsx` |
| WhatsApp button with a prepared opening message | Editor > Advanced | `server/src/views/templates/render.js`, `EditorExtras.jsx` |

## 5. Partly implemented or not built, and why

| Item | Status | Reason |
|---|---|---|
| Google Contacts sync | Built, inactive | Needs your Google OAuth client ID and secret; tested only against a mocked Google; Google app verification needed beyond test users |
| Apple / Google Wallet passes | Not built | Needs Apple Developer certificate and Google Wallet issuer account |
| Paper-card / badge scanner | Not built | Needs a paid OCR/vision API key |
| HubSpot, Salesforce, Outlook native sync | Not built | Needs their OAuth apps; webhooks (Zapier/Make) cover them meanwhile |
| SSO, SCIM, directory sync | Not built | Enterprise-customer feature; no demand yet |
| Approval workflow for team edits | Not built | Needs a product decision; field locks cover most of it |
| Plan-based limits on webhooks, Google sync, signatures | Not built | Deliberately open to all plans for now; add flags in `PLAN_FEATURES` if you want them paid |
| Signature rollout per person's mailbox | Not built | Team file download only |

## 6. Database changes (all additive, applied to the live DB before each deploy)

`vcards.bank_accounts`; `vcard_enquiries.status`, `tags`, `notes`, `google_contact`; new tables `webhooks`, `webhook_deliveries`; `organisations.brand`; `vcard_views.via`, `utm_source`, `utm_medium`, `utm_campaign`; setting `google_client_secret` (stored hidden). Applied with `server/src/scripts/sync.js --safe`. No data was deleted except the 68 unused templates.

## 7. New and changed API endpoints

User API (`/api/user/...`): `GET/PATCH /enquiries`, `GET /export/enquiries`; `GET/POST/PUT/DELETE /webhooks`, `POST /webhooks/:id/test`, `POST /webhooks/:id/secret`, `GET /webhooks/:id/deliveries`; `GET/PUT /integrations/google`, `POST /integrations/google/connect|disconnect|sync-all`; `GET /vcards/:id/signature`; `PUT /organisation/brand`, `POST /organisation/brand/apply`, `GET /organisation/members/export`, `GET /organisation/members/signatures`, `POST /organisation/members/import` (new `dry_run`). Public: `GET /api/public/integrations/google/callback`; `/{alias}/contact.vcf`, `/r/:code`, `/{alias}/qr.*` changed (via tags). New event hooks on `POST /api/public/vcards/:alias/enquiry|subscribe|appointment`.

## 8. Frontend

New: `Leads.jsx` (leads, integrations, webhooks, Google), `Signatures.jsx`. Changed: `Organisation.jsx` (check import, team design, exports), `Analytics.jsx` (campaigns, link builder, new channels), `EditorExtras.jsx` (bank accounts, WhatsApp message), admin `Settings.jsx` (Google secret), `menus.js`, `App.jsx`.

## 9. Security work

- Webhooks: https only, no credentials in URL, private/internal addresses refused at save time and again at connect time (guards DNS rebinding), IPv6-mapped and reserved ranges covered, no redirects, 6 s timeout, HMAC-SHA256 signature with timestamp, auto-pause after 10 failures, max 10 per account, secrets rotatable.
- Google: signed, expiring OAuth state; refresh token stored AES-sealed and never returned to the browser; revoked tokens detected and dropped.
- Ownership checks on every new route (leads, webhooks, signatures, brand, exports): another account gets 404 or 403; tests cover this.
- Input: campaign tags restricted to short plain text with no leading formula characters; lead tags/notes length-limited; signature and team-file HTML fully escaped, no scripts; `.vcf` fields escaped so a visitor cannot inject properties.
- Product sync and webhooks share one hardened private-address check.
- Dependency audit run (2026-11-23): `npm audit fix` applied; client has 0 known vulnerabilities and the server went from 10 to 3 moderate. The 3 left are `uuid` inside `exceljs` and `sequelize`; the advisory only applies when code passes its own buffer to uuid v3/v5/v6, which this app does not, and the only fix offered is a breaking downgrade (sequelize 3), so it was left alone.
- Not done: no external penetration test, no rate limit specific to webhook creation beyond the 10-per-account cap.

## 10. Testing

Server suite: 337 of 338 pass. The one failure is the long-standing "LOAD: 300 concurrent page + API requests" test, which is timing-sensitive on this machine and passes on some runs. New test files: `leads-webhooks.test.js`, `team-brand.test.js`, `campaigns.test.js`, `signature.test.js`, `googlecontacts.test.js`, plus additions to `content.test.js` and `templates.test.js`. New screens were checked in the browser against a throwaway local database. **Not done:** a logged-in click-through of the new screens on production (no production login was used), and testing signatures pasted into real Gmail/Outlook or `.vcf` import on a real iPhone/Android.

## 11. Known limitations

- Printed QR codes made before this release cannot be told apart from NFC taps; they count as "NFC / short link".
- Google Contacts has never been run against real Google.
- Email signatures load photos/QR from your server, so recipients who block images will not see them.
- Template count is 112 distinct layouts; further colour variants were removed on purpose.
- Phone width (375 px): Leads, Integrations, Email signature and Organisation were checked for horizontal overflow with none found.

## 12. Credentials and services needed

Google OAuth client (ID + secret, People API enabled, redirect `https://app.smartvisitingcards.com/api/public/integrations/google/callback`); later, optionally: Apple Developer certificate and Google Wallet issuer account, an OCR/vision API key, HubSpot/Salesforce OAuth apps.

## 13. Deployment

`main` is pushed to `target`; the `hostinger` branch is `main` plus the prebuilt `client/dist`; zip it with `git archive --format=zip -o nfc-hostinger.zip hostinger`, upload in hPanel > Deployments > Settings and redeploy > Upload new files, then Save and redeploy. Run `node server/src/scripts/sync.js --safe` against the live database before any deploy that adds columns.

## 14. Recommended next phase

1. Add the Google credentials and test Google Contacts with a real account.
2. Decide on plan limits for the new features.
3. Wallet passes once the Apple/Google accounts exist.
4. Native HubSpot connector (largest request among competitors' sales teams).
5. A logged-in production walkthrough of every new screen on a phone and a desktop.
