/* Background jobs (run in-process every hour): plan pre-expiration e-mails. */
const { Op } = require('sequelize');
const dayjs = require('dayjs');
const M = require('../models');
const settings = require('./settings');
const mail = require('./mail');
const { clientUrl } = require('../config');

async function expiryReminders() {
  const days = Number((await settings.get('expiry_reminder_days')) || 3);
  if (!days) return;
  const subs = await M.Subscription.findAll({
    where: { status: 'active', expiry_notified_at: null, ends_at: { [Op.between]: [new Date(), dayjs().add(days, 'day').toDate()] } },
    include: [M.User, M.Plan],
  });
  for (const s of subs) {
    if (!s.user?.email || !s.plan || s.plan.frequency === 'unlimited') continue;
    await mail.sendTemplate('plan_expiring', s.user.email, { name: s.user.first_name, plan: s.plan.name, date: dayjs(s.ends_at).format('DD MMM YYYY'), plans_url: `${clientUrl}/user/plans` }).catch((e) => console.error('mail', e.message));
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

/** Flag unpaid invoices past their due date */
async function overdueInvoices() {
  await M.Invoice.update({ status: 'overdue' }, { where: { status: { [Op.in]: ['sent', 'partial'] }, due_date: { [Op.lt]: dayjs().format('YYYY-MM-DD') } } });
}

function start() {
  const hourly = () => {
    expiryReminders().catch((e) => console.error('job expiryReminders', e.message));
    overdueInvoices().catch((e) => console.error('job overdueInvoices', e.message));
  };
  const courier = () => courierSync().catch((e) => console.error('job courierSync', e.message));
  setTimeout(hourly, 30_000);
  setInterval(hourly, 60 * 60 * 1000).unref();
  setTimeout(courier, 90_000);
  setInterval(courier, 30 * 60 * 1000).unref();
}

module.exports = { start, expiryReminders, courierSync, overdueInvoices };
