# NFC Profile: project handoff

Written 2026-11-03 so work can continue in a new Claude account. Paste this file (or point Claude at it) at the start of the new session.
It contains **no passwords or API keys**. Secrets live in `server/.env` (gitignored) and in Railway variables.

---

## 1. What this is

An NFC / digital business-card SaaS, branded **NFC Profile**.

- **Server:** Node 22 + Express + Sequelize (MySQL), in `server/`.
- **Client:** React 19 + Vite + Tailwind v4 + Radix UI + `motion`, in `client/`.
- **Public vCards:** server-rendered HTML (`server/src/views/templates/*`), 140 templates.
- **Shop:** public NFC product store, COD checkout, order tracking.
- **Admin:** orders, order wizard, order sources, plans, contact tags, directory, and more.

Owner: gulbaztariq1@gmail.com (GitHub user `gulbaztariq`).

## 2. Where everything lives

| Thing | Value |
|---|---|
| Local folder | `/Users/gulbaztariq/NFCNEWSYSTEMFAISAL` |
| Git remotes | `target` = `https://github.com/gulbaztariq/newnfcportalfaisal` (**push here**, branch `main`). `origin` = original author's repo (Railway cannot read it). |
| Hosting | Railway project `epic-website` (id `42a8d748-f5a2-4e73-9d21-98c187303ac7`), service `nfc-profile` (id `8cbca1ec-8ab3-4c0b-a4dc-9d0eb9f22a5d`), environment id `aaa118ab-a15f-4f78-bc24-e2acb4db3464` |
| Live URL | https://nfc-profile-production.up.railway.app |
| Auto-deploy | Railway deploys every push to `target/main`. The start script runs `sync.js --safe` (adds new columns/tables) and then `seed.js`. |
| Database | Hostinger MySQL, db `u876570813_Nfcnewsystem`, user `u876570813_Nfcsystemuser`, host `srv1712.hstgr.io`. Password is in `server/.env` and the Railway variable `DB_PASSWORD`. |
| **Local and live share the SAME database** | Anything you write to the DB locally is live immediately. Be careful. |

**Standing instruction from the owner:** "deploy every time". After each change: commit, `git push target main`, check the Railway deploy succeeded. Do not ask first.
Commit trailer used: `Co-Authored-By: Claude ... <noreply@anthropic.com>`.

### Railway access in a new account
The previous session used the Railway MCP connector. In the new account you need to reconnect it (or use the Railway CLI). Without it, a push still deploys. You just cannot see the build status from Claude.

## 3. Running it locally

- **Needs Node 22.** The system Node 21.5 crashes the API and Vite. Install with `nvm install 22`, or similar.
- `.claude/launch.json` currently points at a Node 22 binary in a temp scratchpad that **no longer exists**. Edit it to use your Node 22 path.
- API: `node --watch server/src/index.js` on port **5001** (port 5000 is taken by macOS).
- Client: `node client/node_modules/vite/bin/vite.js client`, with env `VITE_API_TARGET=http://localhost:5001`, on port 5173.
- **After adding any model column, run `node server/src/scripts/sync.js --safe` before using it**, or the API throws "unknown column". It runs automatically on deploy.
- `seed.js` is idempotent but **slow against the remote DB (about 10 minutes locally)**. Production runs it at every start.
- Seeded logins: `sadmin@vcard.com` / `123456` (super admin), plus `admin@vcard.com` and `user@vcard.com`. **Change these passwords.**
- If Rolldown complains about a missing native binding: `npm i --no-save @rolldown/binding-darwin-x64` in `client/`.

## 4. Architecture notes you will need

### vCard templates
- `server/src/views/templates/catalog.js` holds TEMPLATES (vcard1–vcard140). It sets the LAYOUTS / SOCIAL_LAYOUTS / BAR_LAYOUTS / LINK_LAYOUTS tables.
- One shared HTML structure is rendered by `render.js`. Each layout is pure CSS in `styles.js`, `premium.js`, `social.js`, `business.js`, `linkcards.js`.
- `render.js` builds sections as a keyed `blocks` map ordered by `section_order`, with headings from `section_titles`.
- Every template supports: colors, show/hide sections, drag-to-reorder, rename headings, sticky WhatsApp buttons, a multi-page "View Full Menu" viewer, and a two-row header chips layout. The editor is `client/src/pages/user/VcardEditor.jsx`.
- Business directory: `client/src/pages/site/Directory.jsx`, API `/api/public/directory`.

### Orders (`server/src/services/orders.js`)
`ORDER_TYPES`:

| Key | Label |
|---|---|
| `nfc_profile` | NFC Business Card |
| `social` | Social / review card |
| `wholesale` | Wholesale (bulk) |
| `sample` | Samples before bulk |
| `card_printing` | Card + printing (no profile) |
| `printing` | Printing only |
| `reprint` | Card reprinting (metal / wood / PVC...) |
| `digital` | Digital profile only |
| `renewal` | Plan renewal |
| `upgrade` | Plan upgrade |
| `contact_tag` | Car contact tag (number hidden) |
| `airport_tag` | Airport tag (luggage) |

- `NO_SHIP_TYPES = digital, renewal, upgrade` have no delivery or COD charge.
- `quote()` applies, in order: product discount, then per-type rules.
  - Wholesale quantity tiers (editable in Settings, default 25+:10%, 50+:15%, 100+:20%, 250+:25%). A per-product switch `no_wholesale_tiers` turns tiers off.
  - Samples are charged at a higher editable price (markup 50%, max 5 per product). The sample charge is credited to the later wholesale order.
  - Plan credit for upgrades (unused time).
- Delivery charge is 149 (Settings, `delivery_charges`).
- `applyRenewal` adds the plan to the customer's subscription once an order is paid (exactly once, via `plan_applied_at`).
- Admin order wizard: `client/src/pages/admin/OrderWizard.jsx`. The step flow is type, then products, then customer, delivery, review. Renewal and upgrade go type, customer, products. The products screen shows live prices fetched from the source websites, each editable.
- `NfcCard` is the product model. Important columns: `product_kind`, `plan_id`, `price`, `discount_*`, `sample_price`, `wholesale_tiers`, `no_wholesale_tiers`, `tags_per_unit`, `order_source_id`, `source_price`, `price_locked`.
- `product_kind` values (server `PRODUCT_KINDS` in `routes/admin/business.js`): `plan`, `reprint`, `airport_tag`, `contact_tag`, `blank_card`, `nfc_profile`, `social_static`, `social_dynamic`, `social_profile`, `printing`, `digital`. The wizard filters products by kind in `kindsFor()`.
- **Renewal and upgrade orders only offer products that have a `plan_id`.**

### Order sources and product sync (`server/src/services/productsync.js`)
- Admin page `OrderSources.jsx`. Sources: nfcreviewcard.pk, nfcproducts.com.pk, smartvisitingcards.com, nfcbusinesscard.pk, digitalbusinesscard.pk, digitalvisitingcard.pk, nfcvisitingcard.pk.
- Supports WooCommerce Store API (with per-option variation prices), Shopify `products.json`, and pasted lists.
- It has an SSRF guard and a 10-minute cache. `price_locked` keeps hand-edited prices.
- smartvisitingcards.com lists prices in USD (11 and 15), so its 2 products are hidden until you supply rupee prices.
- 17 old products were deleted on request (a record is kept in a scratchpad file that no longer exists).

### Plans and subscriptions
- **Current plans (all PKR, 2-year validity = `custom_duration_days` 730, unless noted):**

| Group | Plan | Price (PKR) |
|---|---|---|
| Individual | Individual Starter | 999 |
| Individual | Individual Professional | 1,999 |
| Individual | Individual Executive | 3,999 |
| Corporate | Corporate Business | 9,999 |
| Corporate | Corporate Enterprise | 24,999 |
| Social | Social Static Link (1 year) | 499 |
| Social | Social Dynamic Link (1 year) | 799 |
| Social | Social All-in-One | 1,199 |
| Digital only | Digital Basic | 799 |
| Digital only | Digital Plus | 1,499 |
| Digital only | Digital Pro | 2,999 |

- Digital Basic / Plus / Pro have the same feature sets as Individual Starter / Professional / Executive.
- **No Free plan and no default plan.** New sign-ups get no plan and must buy one. The old Free, Standard, Premium and Lifetime plans were deleted. The only subscriber, the demo `user@vcard.com`, was moved to Individual Executive.
- Prices are starting points. **The prices were NOT doubled for the 2-year validity.**
- Each plan has a plan-linked product named "`<plan>` plan (2 years)" (Static and Dynamic: "(1 year)"). These are what renewal and upgrade orders sell. If you change a plan price, change its product price too. They do not sync.
- The plans are created by `server/src/scripts/seed.js` (the `FAMILIES` array). The seed no longer contains Free, Standard, Premium or Lifetime. **If you ever re-add them to the seed, the deploy will resurrect them.**
- **Expiry reminder emails** (`server/src/services/jobs.js`, runs hourly): the first email goes 30 days before the plan ends, then repeats every 3 days until renewed or expired. Settings keys `expiry_reminder_days` (30) and `expiry_reminder_every_days` (3) are editable in admin Settings. Emails only send for real if SMTP is configured. Locally they are only logged.

### Contact tags (QR/NFC tags that reach the owner without showing their number)
- Public pages: `/tag/:code` (never shows owner phone or email), `POST /tag/:code/send` (rate limited, honeypot), `/tag/:code/qr.png`. The owner's private setup link uses a secret `manage_token`.
- Code: `server/src/services/contacttags.js`, views in `server/src/views/tag.js`, admin page `ContactTags.jsx`.
- Kinds: car (`contact_tag`) and luggage (`airport_tag`). `tags_per_unit` makes packs create several tags.
- Shop products: Car Contact Tag 699, Pack of 2 999, Airport Tag 999, Pack of 3 2,499. All four have drawn product images in `client/public/brand/tags/*.svg`.
- Shop checkout creates the tags, and the tracking page shows "Your tags" with QR codes. The private "Set up" link is shown only with the order token or when the owner is signed in.
- **Owner alerts need WhatsApp or SMS enabled**, and that is not set up (see section 6).

## 5. What was built (history, newest last)
1. Cloned the original repo, connected Hostinger MySQL, ran schema and seed.
2. Renamed the app to NFC Profile.
3. Deployed to Railway (old Railway projects deleted). Auto-deploy from `target/main`.
4. About 120 new templates: premium, social, business, and link-in-bio "link cards" (inspired by Linktree, HiHello, Mobilo, Blinq).
5. Customization for all templates, sticky WhatsApp buttons, menu viewer, two-row header chips, business directory.
6. Simplified order system: order sources, live product prices, order types, tiers, samples, renewal, upgrade, bulk-from-order.
7. Contact tags plus airport tags, sold in the shop, and renamed "Car contact tag".
8. Product photos for the tag products.
9. Plan families (individual, corporate, social, digital), card reprinting order type with 3 reprint products (PVC 499, Wood 1,299, Metal 2,499, not shown in the shop), and plan products for renewals.
10. All plans in PKR, no free plan, 2-year validity, old dollar plans removed, expiry reminders 30 days before and every 3 days.

## 6. Open items and things to tell the owner

1. **WhatsApp/SMS alerts are OFF.** No provider is configured (Meta Cloud API, Twilio and custom HTTP gateway are all empty). The owner must enter credentials in admin Settings, under "WhatsApp & SMS", and turn on Enable WhatsApp. Until then, tag owners get no alert, and visitors are told "saved but could not alert the owner". For Meta, business-initiated messages need an approved template. Claude cannot enter API keys for the owner.
2. **The Hostinger DB password was pasted in chat.** Rotate it, then update `server/.env` and the Railway `DB_PASSWORD` variable.
3. **Seeded passwords are `123456`.** Change them.
4. **The last deploy was not confirmed.** Right after the latest commit (`78b83cd`), the network dropped. The live plan list was verified to show exactly the 11 new plans. Re-check that the Railway deploy is `SUCCESS` and that no old plan came back (Free, Standard, Premium, Lifetime) in the admin Plans page.
5. **Prices are placeholders:** all plan prices, reprint product prices, and the Social All-in-One price. Confirm with the owner.
6. **Open question:** the owner's note "except static social media/review plan (dynamic)" was ambiguous. Both Social Static Link and Social Dynamic Link were left at 1 year. Possible alternatives: static = never expires, or dynamic = 2 years.
7. **Plan prices are per 2 years but unchanged from the 1-year amounts.** Ask whether to double them.
8. smartvisitingcards.com products are hidden until rupee prices are given.
9. Renewal and upgrade orders only sell plan-linked products. Card products (for example "NFC Business Card") are not linked to a plan, so buying a card does not start a plan automatically. Ask whether first purchases should be linked.
10. The shop order confirmation email does not mention tags.
11. Tracking-page "Your tags" card in the shop was not visually checked in a browser.

## 7. Working conventions the owner expects
- Deploy after every change (commit, push to `target`, verify Railway). No need to ask.
- Test with temporary data, then delete it. The database is shared with production.
- Never print or commit secrets.
- The owner prefers short, plain answers and screenshots when asked to "show" a page.
- When showing a page, use the built-in browser pane on `http://localhost:5173` (log in as `sadmin@vcard.com`).

## 8. First steps in the new session
1. `cd /Users/gulbaztariq/NFCNEWSYSTEMFAISAL && git status && git log --oneline -5` (expected head: `78b83cd`, plus this file if committed).
2. Fix `.claude/launch.json` to a real Node 22 path, then start the `api` and `client` servers.
3. Reconnect the Railway connector, then check the latest deployment.
4. Read this file's section 6 and ask the owner which open items to do next.
