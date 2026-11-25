/**
 * Change the role of an account:  node src/scripts/set-role.js person@x.com user   (roles: user, admin, super_admin ...)
 * The change is written to the activity log, and the person is signed out everywhere.
 */
const M = require('../models');

(async () => {
  const [email, role] = [String(process.argv[2] || '').trim().toLowerCase(), String(process.argv[3] || '').trim()];
  if (!email || !role) { console.log('usage: set-role.js email role'); process.exit(1); }
  const u = await M.User.findOne({ where: { email } });
  if (!u) { console.log(`no account with ${email}`); process.exit(1); }
  const before = u.role;
  await u.update({ role, token_version: (u.token_version || 0) + 1 });
  await M.ActivityLog.create({ user_id: null, actor_email: 'server script', actor_role: 'super_admin', action: 'user.role_change', entity: 'user', entity_id: u.id, meta: { email, from: before, to: role } });
  console.log(`${email}: ${before} -> ${role}`);
  process.exit(0);
})().catch((e) => { console.error(e.message); process.exit(1); });
