/*
 * One definition of "a vCard is available to the public", used by the admin lists, the dashboard and (through the same
 * rules) the public page: the card is switched on, its owner is active (and not blocked) and the owner's plan has not expired.
 */
const { Op } = require('sequelize');
const M = require('../models');

const REASONS = {
  live: 'Live',
  hidden: 'Switched off',
  owner_inactive: 'Owner inactive',
  plan_expired: 'Plan expired',
};

/** { [cardId]: 'live' | 'hidden' | 'owner_inactive' | 'plan_expired' } for cards loaded with their `user` */
async function forCards(cards) {
  const owners = [...new Set(cards.map((c) => c.user_id))];
  const subs = owners.length ? await M.Subscription.findAll({ where: { user_id: owners, status: 'active' }, attributes: ['user_id', 'ends_at'], raw: true }) : [];
  const valid = new Set(subs.filter((s) => new Date(s.ends_at) >= new Date()).map((s) => s.user_id));
  const out = {};
  for (const c of cards) {
    const u = c.user;
    out[c.id] = !c.status ? 'hidden' : !u || !u.is_active || u.org_status === 'blocked' ? 'owner_inactive' : !valid.has(c.user_id) ? 'plan_expired' : 'live';
  }
  return out;
}

async function allCards() {
  return M.Vcard.findAll({ attributes: ['id', 'status', 'user_id'], include: [{ model: M.User, attributes: ['id', 'is_active', 'org_status'] }] });
}
async function countLive() { const cards = await allCards(); const a = await forCards(cards); return Object.values(a).filter((x) => x === 'live').length; }
async function countNotLive() { const cards = await allCards(); const a = await forCards(cards); return Object.values(a).filter((x) => x !== 'live').length; }

module.exports = { forCards, countLive, countNotLive, REASONS };
