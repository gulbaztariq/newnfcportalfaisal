/* Background jobs (run in-process every hour): plan pre-expiration e-mails. */
const { Op } = require('sequelize');
const dayjs = require('dayjs');
const M = require('../models');
const settings = require('./settings');
const mail = require('./mail');
const { clientUrl } = require('../config');

/** E-mails every user whose plan ends within N days (default 30), again every M days (default 3) until it is renewed or ends. */
async function expiryReminders() {
  const days = Number((await settings.get('expiry_reminder_days')) || 30);
  if (!days) return;
  const every = Math.max(1, Number((await settings.get('expiry_reminder_every_days')) || 3));
  const now = new Date();
  const lastBefore = dayjs().subtract(every * 24 - 1, 'hour').toDate(); // 1h slack: the job runs hourly
  const subs = await M.Subscription.findAll({
    where: {
      status: 'active', ends_at: { [Op.between]: [now, dayjs().add(days, 'day').toDate()] },
      [Op.or]: [{ expiry_notified_at: null }, { expiry_notified_at: { [Op.lte]: lastBefore } }],
    },
    include: [M.User, M.Plan],
  });
  for (const s of subs) {
    if (!s.user?.email || !s.plan || s.plan.frequency === 'unlimited') continue;
    const left = Math.max(1, Math.ceil(dayjs(s.ends_at).diff(now, 'hour') / 24));
    await mail.sendTemplate('plan_expiring', s.user.email, { name: s.user.first_name, plan: s.plan.name, date: dayjs(s.ends_at).format('DD MMM YYYY'), days: left, plans_url: `${clientUrl}/user/plans` }).catch((e) => console.error('mail plan_expiring', e.message));
    await s.update({ expiry_notified_at: new Date() });
  }
}

/** Refresh Leopards tracking for dispatched orders (moves them to delivered / returned automatically) */
async function courierSync() {
  const s = await settings.all();
  if (s.leopards_enable !== '1' || s.leopards_auto_sync === '0' || !s.leopards_api_key) return;
  const leopards = require('./leopards');
  const orders = require('./orders');
  const list = await M.NfcOrder.findAll({ where: { courier: 'leopards', tracking_number: { [Op.ne]: null }, order_status: 'shipped' }, limit: 200 });
  for (let i = 0; i < list.length; i += 20) {
    const chunk = list.slice(i, i + 20);
    const res = await leopards.track(chunk.map((o) => o.tracking_number)).catch(() => []);
    for (const t of res) {
      const o = chunk.find((x) => x.tracking_number === t.track_number);
      if (!o) continue;
      await o.update({ courier_status: t.status, courier_status_at: new Date(), courier_history: t.history, ...(t.charges && !Number(o.courier_charges) ? { courier_charges: t.charges } : {}) });
      const wf = leopards.workflowStatus(t.status);
      if (wf && wf !== 'shipped' && wf !== o.order_status) await orders.setStatus(o, wf, { note: `Leopards: ${t.status}` });
    }
  }
}

/** Once a week: re-read the products and prices of every order source (edited prices stay, see productsync) */
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
async function weeklyProductSync() {
  const last = Number(await settings.get('product_sync_last_run')) || 0;
  if (Date.now() - last < WEEK_MS - 60 * 60 * 1000) return; // 1h slack: the job checks hourly
  await settings.set({ product_sync_last_run: Date.now() }); // claim the run first so a restart never repeats it
  const res = await require('./productsync').syncAll();
  console.log(`weekly product sync: ${res.filter((r) => r.status === 'updated').length}/${res.length} sources updated`);
}

/** Flag unpaid invoices past their due date */
async function overdueInvoices() {
  await M.Invoice.update({ status: 'overdue' }, { where: { status: { [Op.in]: ['sent', 'partial'] }, due_date: { [Op.lt]: dayjs().format('YYYY-MM-DD') } } });
}

/** Everything the hourly timer does, awaitable (used by scripts/cron.js on hosts that cannot keep timers alive) */
async function runHourly() {
  for (const [name, fn] of [['expiryReminders', expiryReminders], ['weeklyProductSync', weeklyProductSync], ['overdueInvoices', overdueInvoices]]) {
    try { await fn(); } catch (e) { console.error(`job ${name}`, e.message); }
  }
}

function start() {
  // JOBS_MODE=cron: the host cannot keep timers running (idle apps are stopped); run `node server/src/scripts/cron.js` from its cron scheduler instead
  if (process.env.JOBS_MODE === 'cron') { console.log('background timers off (JOBS_MODE=cron); run scripts/cron.js from cron'); return; }
  const hourly = () => {
    expiryReminders().catch((e) => console.error('job expiryReminders', e.message));
    weeklyProductSync().catch((e) => console.error('job weeklyProductSync', e.message));
    overdueInvoices().catch((e) => console.error('job overdueInvoices', e.message));
  };
  const courier = () => courierSync().catch((e) => console.error('job courierSync', e.message));
  setTimeout(hourly, 30_000);
  setInterval(hourly, 60 * 60 * 1000).unref();
  setTimeout(courier, 90_000);
  setInterval(courier, 30 * 60 * 1000).unref();
}

module.exports = { start, runHourly, weeklyProductSync, expiryReminders, courierSync, overdueInvoices };
