# Audit, testing and security report

Run the tests: `cd server && npm test` (Node 22). They use an in-memory sqlite database and a mocked mailer, never the shared MySQL.

## Final status: 106 tests, 106 PASSED, 0 FAILED

| Suite | Tests | Result | Covers |
|---|---:|---|---|
| auth.test.js | 19 | PASSED | login, lockout, sessions, CSRF header, e-mail OTP |
| access.test.js | 11 | PASSED | every admin/user endpoint anonymous + as normal user, IDOR, mass assignment, headers |
| crud.test.js | 10 | PASSED | CRUD, validation, SQL-injection strings, array/object params, pagination |
| shop.test.js | 23 | PASSED | pricing rules, checkout, tracking, contact tags |
| plans.test.js | 11 | PASSED | subscriptions, renewals, upgrade credit, concurrency |
| content.test.js | 17 | PASSED | uploads, SVG, 140 templates, vcf, payments |
| admin-orders.test.js | 7 | PASSED | staff order creation and validation |
| limits.test.js | 8 | PASSED | rate limits, brute force, IP ban, load |

## Defects found and fixed
| ID | Severity | Issue | Fix |
|---|---|---|---|
| B1 | Medium | `?search=a&search=b` crashed every list endpoint (500) | query parser keeps last value (`src/index.js`) |
| B2 | Medium | OTP resend had no cooldown | 60 s cooldown (`services/security.js`) |
| B3 | Medium | OTP stored as plain SHA-256 (1M-value space, brute-forceable if DB leaks) | HMAC with server secret |
| B4 | Low | OTP lifetime fixed at 10 min | configurable `login_otp_minutes`, default 5; template text updated |
| B5 | High | A renewal could be applied twice when two payment confirmations arrived together | atomic claim (`services/orders.js`) |
| B6 | High | Uploads trusted the client-declared type (script content labelled image/png was stored) | magic-byte check on every upload (`middleware/upload.js`) |
| B7 | High | A transaction could be fulfilled twice concurrently | atomic claim, reverts on failure (`services/payments.js`) |

## Already sound (verified by tests)
No raw SQL anywhere (Sequelize parameterised queries); CSRF header + SameSite=Strict HttpOnly cookies; generic login errors; account lockout; auto IP ban for scanners and floods; per-route rate limits; helmet CSP; uploads served nosniff + sandbox CSP; SVG sanitiser; tag pages never reveal owner contact details; order tracking needs token or phone; production refuses the default JWT secret.

## OTP login
Existing flow kept and hardened. Optional for customers (`login_otp_enable`), enforced for staff when SMTP is configured. If the code e-mail cannot be sent, no session is granted (tested). Code: 6 digits, `crypto.randomInt`, keyed hash, single use, 5 attempts, 60 s resend cooldown, expiry 5 min. Emergency switch: env `DISABLE_LOGIN_OTP=1`.
**Not active until SMTP is configured in admin Settings.**

## Performance (test machine, single process, sqlite)
300 simultaneous requests: 0 errors; p50 about 2.5 s, p95 about 2.9 s because one Node process handled all 300 at once. Per-endpoint cost was not profiled. Real numbers on Railway + MySQL were NOT measured.

## NOT DONE / BLOCKED
- Database least-privilege accounts, TLS to DB, backups and restore drill: need Hostinger access (BLOCKED, owner action).
- Row-level security: not applicable to MySQL here; ownership is enforced in application code and tested for vcards only.
- Not tested: order-source sync, AI design, Leopards courier, WhatsApp/SMS, Stripe and other gateways beyond fulfilment logic, invoices/PDF, finance, inventory, organisations, announcements, browser UI end to end.
- Tests run on sqlite; MySQL-specific behaviour (collation, FK actions) is not covered.
- No CI pipeline added.
- Network-level DDoS protection must come from Railway/Cloudflare; the app layer only throttles.
- Coverage percentage not measured.

This report does not claim the application is fully secure or production-ready.
