/* Client mirror of server/src/services/permissions.js (the server is the real gate; this only hides menu items) */
export function can(user, key) {
  if (!user) return false;
  const list = user.permissions;
  if (list === null || list === undefined) return true;
  const [mod, action] = key.split('.');
  return list.includes(key) || (action === 'view' && list.includes(`${mod}.manage`));
}
