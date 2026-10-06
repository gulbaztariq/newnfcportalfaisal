/* Announcements: who sees what, and the optional e-mail blast */
const { Op } = require('sequelize');
const mail = require('./mail');

const M = () => require('../models');

/** Active announcements for a user (+ read flag) */
async function visibleFor(user) {
  const now = new Date();
  const staff = M().STAFF_ROLES.includes(user.role);
  const audiences = staff ? ['all', 'staff'] : ['all', 'users', 'plan'];
  // organisation members (and the owner) also see their organisation's announcements
  const orgId = user.organisation_id || (user.is_organisation ? user.id : null);
  const audience = orgId ? { [Op.or]: [{ audience: audiences }, { audience: 'organisation', organisation_id: orgId }] } : { audience: audiences };
  const rows = await M().Announcement.findAll({
    where: { status: true, ...audience, [Op.and]: [{ [Op.or]: [{ starts_at: null }, { starts_at: { [Op.lte]: now } }] }, { [Op.or]: [{ ends_at: null }, { ends_at: { [Op.gte]: now } }] }] },
    order: [['pinned', 'DESC'], ['id', 'DESC']], limit: 50,
  });
  let planId = null;
  if (rows.some((a) => a.audience === 'plan')) planId = (await require('./subscription').current(user.id))?.plan_id || null;
  const list = rows.filter((a) => a.audience !== 'plan' || (a.plan_id && a.plan_id === planId));
  const reads = await M().AnnouncementRead.findAll({ where: { user_id: user.id, announcement_id: list.map((a) => a.id) }, attributes: ['announcement_id'], raw: true });
  const readSet = new Set(reads.map((r) => r.announcement_id));
  return list.map((a) => ({ ...a.toJSON(), read: readSet.has(a.id) }));
}

async function email(a) {
  const X = M();
  const where = { is_active: true };
  if (a.audience === 'users' || a.audience === 'plan') where.role = 'user';
  if (a.audience === 'staff') where.role = X.STAFF_ROLES;
  let users = await X.User.findAll({ where, attributes: ['id', 'email', 'first_name'] });
  if (a.audience === 'plan' && a.plan_id) {
    const subs = await X.Subscription.findAll({ where: { plan_id: a.plan_id, status: 'active' }, attributes: ['user_id'], raw: true });
    const ids = new Set(subs.map((s) => s.user_id));
    users = users.filter((u) => ids.has(u.id));
  }
  await a.update({ emailed_at: new Date() });
  for (const u of users) {
    await mail.sendTemplate('announcement', u.email, { name: u.first_name, title: a.title, body_html: a.body || '' }).catch((e) => console.error('[announcement mail]', e.message));
  }
  return users.length;
}

module.exports = { visibleFor, email };
