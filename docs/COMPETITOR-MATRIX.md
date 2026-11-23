# Competitor research and feature matrix

Researched 2026-11-23 from each platform's **public pages only** (homepage, features, pricing, teams/enterprise, integrations). Nothing behind a login or paywall was tested, so those points are marked **UNVERIFIED**. Marketing claims (user counts, "10x faster", certifications) are reported as claims, not facts. Prices are as displayed that day.

## 1. What each platform offers (verified on public pages)

| Platform | Strongest public features | Team / enterprise | Integrations stated | Pricing model |
|---|---|---|---|---|
| **Lead2Team** (lead2team.com) | Wallet pass, card form, OCR paper-card scan, QR email signature, own domain (PRO), accessibility audit | CSV/Excel bulk import, roles, change history, brand + templates, white label (Enterprise) | HR systems (Factorial, Personio, BambooHR, SuccessFactors, Google Workspace, Entra ID), API, Zapier, webhooks | Free; PRO EUR 3/user/mo (first year); Teams EUR 1.67/user/mo (first year); Enterprise custom |
| **HiHello** (hihello.com) | Universal scanner, lead forms with consent, virtual backgrounds, Gmail/Outlook signature deployment, offline sharing | Directory sync, 10 card + 10 signature templates, SAML SSO + SCIM, user roles, domain lockdown, branded subdomain | Salesforce, HubSpot, Dynamics 365, Marketo, Google Contacts, Outlook, webhook (Enterprise) | Free; Professional $6/mo; Business $5/user/mo (5+ users); Enterprise custom |
| **Blinq** (blinq.me) | Scanner (badge, paper, QR, LinkedIn), two-way exchange, AI notetaker, widgets, Apple Watch, virtual backgrounds | Admin templates, field locking, auto provisioning, corporate contact book; Enterprise: SSO, SCIM, bulk creation via API, webhooks | Salesforce, HubSpot, Dynamics, Pipedrive, Zoho, GoHighLevel, Marketo, monday, Outlook, Zapier, Okta, Entra, MCP | Free; Premium $9.99/mo; Pro $22.49/mo; Business $6.99/mo (5+ cards); Enterprise custom |
| **Mobilo** (mobilocard.com) | Three modes (landing page / lead gen / card), AI scanner with lead scoring, follow-up by SMS/WhatsApp/email | Lock fields, reassign cards, branding rules, roles, audit logs, HR directory sync, SAML SSO | Salesforce, HubSpot, Pipedrive, Dynamics, Zapier | Cards from $19.99 + Pro ~$3/mo; Team ~$4/mo; Enterprise custom |
| **Popl** (popl.co) | Event lead capture, badge/paper/QR scanning, AI voice notes, enrichment, QR email signatures, Apple/Google Wallet, offline | Admin dashboard, subteams, templates, CSV/HR sync/email invite, SSO (Azure/Okta), roles | Salesforce, HubSpot, Marketo, Dynamics, Pipedrive, Zoho, Pardot, Outlook, Slack, Zapier, API | Free individual; teams by quote |
| **V1CE** (v1ce.co) | Two-way exchange, paper-card scanner, voice/video intro, virtual backgrounds, booking/checkout services, wallet pass, custom domain, AI follow-up that waits for approval | One admin login, brand template, lock card when someone leaves, lead visibility rules, SSO | HubSpot, Salesforce, Mailchimp, Google/Outlook Calendar, Zapier, Make | Card + free software; paid OS ~PKR 18k/mo; team metal card ~PKR 40.7k |
| **Evrycard** (evrycard.co.uk) | Contact form, file/link blocks, wallet passes, mobile app with NFC tap alerts, lifetime free hosting | 1-click bulk CSV, roles, brand + asset lock, free custom domain on Team | Salesforce, HubSpot, Dynamics, Pipedrive, Zoho, Google Sheets, Zapier, Make, Slack (native vs Zapier UNVERIFIED) | One-off cards GBP 14.99-79.99; team from GBP 16.99/card |
| **Tapitag** (tapitag.co) | Exchange-contact button (both sides emailed), Smart Actions (call, WhatsApp prefilled, directions), Calendly links, review/WiFi/check-in tags | Team dashboard, edit permissions (bulk import UNVERIFIED) | Calendly, Google/Outlook calendar, Zapier/API for teams, wallet (Pro) | Cards one-off; Pro EUR 2.99/mo; Teams from EUR 59.99/user |
| **Tapilink** (tapilink.co.uk) | AI lead capture (paper, signboards), branded email signatures, welcome/follow-up emails, wallet | Bulk upload, field locking, lead management (Plus+), analytics tiers | CRM sync stated (named CRMs not stated) | Team GBP ~3-11 per user/mo by tier |
| **MyTag UAE** (mytag.ae) | English + Arabic profiles, wallet passes, QR + NFC, contacts manager with Excel export, "Exchange Contact" button, analytics (scans, location) | Create/update team member profiles centrally | Excel export for CRM import (no CRM integrations stated) | Digital licence; Standard / Personal / Business cards (prices not shown) |
| **iCard UAE** (icard.ae) | Admin panel, unlimited card management, Google review card, savings calculator | Company branding; bulk ordering UNVERIFIED | None stated | One-off AED 40-230 per card, no subscription |
| **360 Smart Business Card** (360smartbusinesscard.com) | Auto QR, splash screen, multiple phones/emails, mobile app | Dashboard, mobile app for corporates | None stated | Cards AED 95-125; software USD 499-1,129/yr by tier (custom domain only on top tier) |
| **ZeeQR** (zeeqr.com) | Public page shows only a shop with review/feedback cards and tap counters | UNVERIFIED | UNVERIFIED | UNVERIFIED |

## 2. Feature matrix with recommendation

| Competitor(s) | Feature | How it works | Business value | Implement? | Priority | Status in our system |
|---|---|---|---|---|---|---|
| Lead2Team, HiHello, Blinq, Popl, V1CE, Evrycard, Tapitag, MyTag | **Contact exchange + lead capture form** | Visitor sends their details back; owner sees them in a contact list | Core B2B value | Yes | High | **Have.** Enquiry form, "ask before saving" gate; leads now have status, tags, notes, search, CSV |
| 8 platforms | **Apple / Google Wallet pass** | Card added to phone wallet | Fast re-access, premium feel | Yes, but needs Apple developer certificate and a Google Wallet issuer account | High | **Missing** |
| HiHello, Blinq, Popl, Mobilo, V1CE, Lead2Team, Tapilink | **Paper card / badge scanner (OCR)** | Phone camera reads another card into a lead | Event networking | Yes, via a paid OCR/vision API (needs a key) | Medium | **Missing** |
| Popl, Blinq, Lead2Team, Evrycard, V1CE, HiHello, Mobilo | **CRM / automation integrations** | Push leads to HubSpot, Salesforce, Zapier... | Fits the sales workflow | Yes, webhooks first, native later | High | **Partial.** Signed webhooks (Zapier, Make, n8n) done; no native HubSpot/Salesforce/Google Contacts |
| Lead2Team, HiHello, Popl, Tapilink, V1CE | **Email signature generator** | Branded signature with card link or QR | Daily exposure of the card | Yes, no external dependency | High | **Missing** |
| HiHello, Blinq, V1CE | **Virtual backgrounds** | Zoom/Teams background with QR | Cheap, memorable | Yes | Low | **Have** (Virtual Background) |
| Lead2Team, HiHello, Evrycard, V1CE, Mobilo, Popl | **Team admin: bulk import, brand template, locking, roles** | One admin controls all cards | Enterprise sales | Yes | High | **Have.** CSV import with check step, team design applied to all cards, field locks, roles, company analytics, member export |
| HiHello, Popl, Blinq, Lead2Team, V1CE, Mobilo | **SSO / SCIM / directory sync** | Entra, Okta, Google sync | Large-company requirement | Later, only on a real enterprise deal | Low | Missing |
| V1CE, Lead2Team, Evrycard, HiHello | **Custom domain** | Card on the customer's own domain | Brand trust | Yes | Medium | **Have** (custom domain with admin approval) |
| Lead2Team, HiHello, Popl, MyTag, Blinq | **Analytics: views, taps, saves, leads** | Dashboard with period filter and breakdowns | Proof of ROI | Yes | High | **Have.** Views, devices, referrers, action clicks, per-card and company level; no UTM/campaign breakdown yet |
| MyTag, Lead2Team, Popl | **Multilingual cards** | Profile in more than one language (MyTag: English + Arabic) | Gulf and Pakistan market | Yes | Medium | **Have** (en, ur, ar, fr, es, de) |
| Tapitag | **Smart actions** (WhatsApp with prefilled text, directions) | One-tap actions | Conversion | Yes | Medium | **Partial.** WhatsApp and directions exist; prefilled text not offered |
| V1CE | **Booking + paid services** | Calendar slots and checkout on the card | Sells services | Yes | Medium | **Have** (appointments, store, products, payments) |
| Tapitag, iCard, Tapilink | **Review / feedback cards, WiFi, check-in tags** | Special-purpose NFC tags | Extra product lines | Optional | Low | Partial (review links possible; no dedicated product type) |
| Blinq, Popl, V1CE, Mobilo | **AI notes, enrichment, lead scoring, follow-up drafts** | AI works on captured leads | Differentiator, but costly and privacy-heavy | Later | Low | Missing |
| Blinq, Evrycard | **Native mobile app, widgets, watch** | Installable app with tap alerts | Retention | Not now (PWA exists) | Low | Partial (PWA on) |
| HiHello, Lead2Team | **Approval workflow for team card edits** | Manager approves changes | Brand control | Maybe | Low | Missing (field locks cover most of it) |
| V1CE, Lead2Team | **Card expiry / deactivation when someone leaves** | Lock or reassign card | HR hygiene | Yes | Medium | **Have** (lock, block, reassign via organisation) |
| Evrycard, iCard, Tapitag | **One-off card pricing, no subscription** | Pay once per card | Easy sale in Pakistan/UAE | Already how NFC orders work | Info | Have |

## 3. Where we already match or beat the field

112 templates with gallery and live preview; dynamic styled QR; bank/wallet accounts with copy buttons (none of the 13 mention anything like it, and it fits Pakistan); WhatsApp lead inbox; shop, orders, courier and invoices for the physical cards; six card languages; password-protected cards; signed webhooks; team design applied to every card.

## 4. Gaps worth building, in order

1. **Email signature generator** (no external dependency, shown by 5 competitors).
2. **UTM / campaign analytics and QR-vs-NFC split** (small change to existing analytics).
3. **Native contact sync**: Google Contacts and HubSpot push using the webhook framework (needs the owner's OAuth credentials).
4. **Apple / Google Wallet passes** (needs an Apple Developer certificate and a Google Wallet issuer account; cannot be done without them).
5. **Paper-card scanner** (needs a paid OCR/vision API key).
6. WhatsApp prefilled-message action; review-card product type.

## 5. Limits of this research

- mytag.ae and zeeqr.com load with JavaScript; mytag.ae was read in a real browser, zeeqr.com showed almost nothing (everything else UNVERIFIED).
- No competitor dashboard or editor was opened, so editor UX, template quality and real analytics depth are UNVERIFIED for all of them.
- Several sites contradict themselves (HiHello CRM tiers, Blinq per card vs per user, Tapilink trial length, Evrycard Pro scope). Those points are flagged rather than resolved.
- Prices are public list prices on 2026-11-23 and change often.
