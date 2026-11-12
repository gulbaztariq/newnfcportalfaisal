# Hosting on Hostinger (Node.js web app, subdomain)

Works on Business / Cloud web hosting with the Node.js apps feature. Hostinger stops idle apps and does not keep timers alive, so this setup turns the in-process timers off and uses cron jobs instead.

## 1. Create the app (hPanel)
1. Websites > Add website > **Node.js Apps**. Choose the subdomain you created (for example `cards.yourdomain.com`).
2. Import from **GitHub**: repository `gulbaztariq/newnfcportalfaisal`, branch `main`. (A hosting plan connects to one GitHub account at a time.)
3. Settings:
   - Node.js version: **22.x**
   - Build command: `npm run build`
   - Start command: `npm run start:host`
   - Entry file (if asked): `server/src/index.js`
4. Do **not** use `npm start`: it runs the database sync and seed on every cold start.

## 2. Environment variables (hPanel > the app > Environment variables)
| Name | Value |
|---|---|
| `NODE_ENV` | `production` |
| `APP_URL` | `https://cards.yourdomain.com` (your real subdomain, with https) |
| `CLIENT_URL` | same as `APP_URL` |
| `JWT_SECRET` | a long random string (64+ characters). The app refuses to start in production without one |
| `IMPERSONATE_SECRET` | another long random string |
| `DB_DIALECT` | `mysql` |
| `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` | the MySQL details from hPanel > Databases. Use a NEW password (the old one was shared in chat) |
| `JOBS_MODE` | `cron` |
| `UPLOAD_DIR` | a folder outside the deploy folder, e.g. `/home/<user>/nfc-uploads` (create it first), so redeploys never delete customer images |
| `MAIL_HOST`, `MAIL_PORT`, `MAIL_SECURE`, `MAIL_USER`, `MAIL_PASSWORD`, `MAIL_FROM` | your SMTP details (needed for password reset and e-mail codes) |

Never commit these. Settings such as WhatsApp, Stripe and AI keys are entered later in the admin panel.

## 3. Create the tables (once, and after updates that add tables or columns)
In hPanel open **SSH** (or the app's terminal), go to the app folder and run:
```
npm run db:update
```
It adds missing tables and columns and seeds the default data. It never drops data. The first run can take several minutes.

## 4. Cron jobs (hPanel > Advanced > Cron Jobs)
Use the full path to the app folder and the same environment variables as the app (or an `.env` file in `server/`).
| Schedule | Command |
|---|---|
| every hour | `cd /home/<user>/<app-folder> && node server/src/scripts/cron.js` |
| every 30 minutes | `cd /home/<user>/<app-folder> && node server/src/scripts/cron.js courier` |

The hourly job sends plan-expiry reminders, marks overdue invoices and runs the weekly product sync (it runs itself once a week).

## 5. After it is running
- Open `https://cards.yourdomain.com` and sign in as `sadmin@vcard.com` with the seeded password, then **change the seeded passwords** (`sadmin@`, `admin@`, `user@` all start with `123456`).
- Admin > Settings: set SMTP, then the e-mail login code (OTP) becomes active.
- The first visit after a quiet spell is slower (Hostinger restarts idle apps).
- Each `git push` to `main` redeploys. Check hPanel > Deployments if a build fails.

## Limits to know
5 Node.js apps per Business plan, 120 s request timeout, shared process limits, no custom ports, no inbound WebSockets, idle apps are stopped. If the app feels slow or hits process limits, a Hostinger VPS removes all of these.
