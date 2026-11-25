/**
 * Create (or promote) super admin accounts:  node src/scripts/add-super-admin.js a@x.com b@y.com
 * The password is random and never shown: the person signs in with an e-mailed code or "Forgot password".
 */
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const M = require('../models');

(async () => {
  const emails = process.argv.slice(2).map((e) => e.trim().toLowerCase()).filter(Boolean);
  if (!emails.length) { console.log('usage: add-super-admin.js email [email...]'); process.exit(1); }
  for (const email of emails) {
    let u = await M.User.findOne({ where: { email } });
    if (u) { await u.update({ role: 'super_admin', is_active: true, email_verified_at: u.email_verified_at || new Date() }); console.log(`promoted ${email} to super_admin`); continue; }
    const first = email.split('@')[0].replace(/[^a-z]/gi, '') || 'Admin';
    u = await M.User.create({ email, first_name: first.charAt(0).toUpperCase() + first.slice(1), last_name: 'Admin', role: 'super_admin', password: await bcrypt.hash(crypto.randomBytes(24).toString('hex'), 12), email_verified_at: new Date(), affiliate_code: crypto.randomBytes(5).toString('hex') });
    console.log(`created super_admin ${email}`);
  }
  process.exit(0);
})().catch((e) => { console.error(e.message); process.exit(1); });
