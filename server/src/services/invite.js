/*
 * Invitations: someone (an admin or a company) adds a person with only a name and an e-mail.
 * The person gets a link to choose their own password, so nobody ever has to send or type a temporary password.
 *   1. the account is created with a random, unknown password
 *   2. an invitation link (valid 7 days, one use) is e-mailed: /reset-password?invite=1&token=...&email=...
 *   3. they choose a password, then sign in with their e-mail + password (+ the e-mailed code, if enabled)
 * The link reuses the password-reset token fields, so "Forgot password" on the sign-in page always works as "send me a new link".
 */
const crypto = require('crypto');
const { clientUrl } = require('../config');
const mail = require('./mail');

const DAYS = 7;
const hash = (t) => crypto.createHash('sha256').update(t).digest('hex');

/** a fresh invitation link for the user (stores only its hash) */
async function issue(user, { days = DAYS } = {}) {
  const token = crypto.randomBytes(32).toString('hex');
  await user.update({ reset_token: hash(token), reset_expires_at: new Date(Date.now() + days * 86400000) });
  return { token, url: `${clientUrl}/reset-password?invite=1&token=${token}&email=${encodeURIComponent(user.email)}`, days };
}

/** issue + e-mail. Returns the link too, so the person who invited can share it if the e-mail does not arrive. */
async function send(user, { inviter, days = DAYS } = {}) {
  const link = await issue(user, { days });
  const sent = await mail.sendTemplate('invite', user.email, { name: user.first_name, email: user.email, inviter: inviter || 'Your administrator', invite_url: link.url, days: String(days), login_url: `${clientUrl}/login` })
    .then(() => true).catch((e) => { console.error('[invite mail]', e.message); return false; });
  return { url: link.url, days, sent };
}

module.exports = { issue, send, DAYS };
