const dayjs = require('dayjs');
const { Subscription, Plan, Vcard, Template, CouponCode } = require('../models');

function endDate(plan, start = new Date()) {
  if (plan.custom_duration_days) return dayjs(start).add(plan.custom_duration_days, 'day').toDate();
  if (plan.frequency === 'unlimited') return dayjs(start).add(100, 'year').toDate();
  return dayjs(start).add(1, plan.frequency === 'yearly' ? 'year' : 'month').toDate();
}

/** Deactivate the current subscription and start a new active one. */
async function activate(userId, plan, { transactionId = null, paymentType = 'free', amount = 0, discount = 0, tax = 0, coupon = null, trial = false } = {}) {
  await Subscription.update({ status: 'inactive' }, { where: { user_id: userId, status: 'active' } });
  const now = new Date();
  const trialEnds = trial && plan.trial_days ? dayjs(now).add(plan.trial_days, 'day').toDate() : null;
  return Subscription.create({
    user_id: userId, plan_id: plan.id, transaction_id: transactionId, plan_amount: plan.price, discount,
    payable_amount: amount, plan_frequency: plan.frequency, starts_at: now,
    ends_at: trialEnds || endDate(plan, now), trial_ends_at: trialEnds, status: 'active', payment_type: paymentType,
    coupon_code_meta: coupon, tax_amount: tax,
  });
}

/**
 * Renew: the new period starts where the current one ends (renewing early never loses days);
 * an expired or missing subscription starts today. The plan can be the same or a different one.
 */
async function renew(userId, plan, opts = {}) {
  const now = new Date();
  const cur = await Subscription.findOne({ where: { user_id: userId, status: 'active' }, order: [['id', 'DESC']] });
  const base = cur && new Date(cur.ends_at) > now ? new Date(cur.ends_at) : now;
  await Subscription.update({ status: 'inactive' }, { where: { user_id: userId, status: 'active' } });
  return Subscription.create({
    user_id: userId, plan_id: plan.id, plan_amount: plan.price, discount: opts.discount || 0, payable_amount: opts.amount || 0, plan_frequency: plan.frequency,
    starts_at: now, ends_at: endDate(plan, base), status: 'active', payment_type: opts.paymentType || 'renewal', tax_amount: opts.tax || 0,
  });
}

async function current(userId) {
  return Subscription.findOne({ where: { user_id: userId, status: 'active' }, include: [{ model: Plan, include: [Template] }], order: [['id', 'DESC']] });
}

/** Gives the default plan (with trial) to a freshly registered user. */
async function assignDefaultPlan(userId) {
  const plan = await Plan.findOne({ where: { is_default: true } });
  if (plan) await activate(userId, plan, { trial: true });
}

/** true when the owner's plan has expired (their public vCards go offline) */
async function isExpired(userId) {
  const sub = await Subscription.findOne({ where: { user_id: userId, status: 'active' }, order: [['id', 'DESC']] });
  return !sub || new Date(sub.ends_at) < new Date();
}

async function canCreateVcard(userId) {
  const sub = await current(userId);
  if (!sub || new Date(sub.ends_at) < new Date()) return { ok: false, reason: 'You do not have an active subscription plan' };
  const count = await Vcard.count({ where: { user_id: userId } });
  if (count >= sub.plan.no_of_vcards) return { ok: false, reason: `Your plan allows ${sub.plan.no_of_vcards} vCard(s)` };
  return { ok: true, sub };
}

const withTax = (plan, price, discount, coupon) => {
  const subtotal = Math.round((price - discount) * 100) / 100;
  const tax = Math.round(subtotal * Number(plan.tax_rate || 0)) / 100;
  const total = Math.round((subtotal + tax) * 100) / 100;
  return { discount, subtotal, tax, tax_name: plan.tax_name || 'Tax', tax_rate: Number(plan.tax_rate || 0), total, payable: total, coupon };
};

/** Returns { discount, subtotal, tax, total, payable(=total), coupon } or throws a message */
async function applyCoupon(plan, code) {
  const price = Number(plan.price);
  if (!code) return withTax(plan, price, 0, null);
  const coupon = await CouponCode.findOne({ where: { coupon_name: code, status: true } });
  if (!coupon) throw new Error('Invalid coupon code');
  if (coupon.expire_at && dayjs(coupon.expire_at).endOf('day').isBefore(dayjs())) throw new Error('Coupon code has expired');
  if (coupon.coupon_limit && coupon.coupon_limit_left <= 0) throw new Error('Coupon usage limit reached');
  const d = coupon.type === 'percentage' ? (price * Number(coupon.discount)) / 100 : Number(coupon.discount);
  const discount = Math.min(price, Math.round(d * 100) / 100);
  return withTax(plan, price, discount, { id: coupon.id, code: coupon.coupon_name, type: coupon.type, discount: coupon.discount });
}
async function consumeCoupon(meta) {
  if (!meta?.id) return;
  const c = await CouponCode.findByPk(meta.id);
  if (c && c.coupon_limit) await c.update({ coupon_limit_left: Math.max(0, (c.coupon_limit_left ?? c.coupon_limit) - 1) });
}

module.exports = { renew, activate, current, assignDefaultPlan, canCreateVcard, applyCoupon, consumeCoupon, endDate, isExpired };
