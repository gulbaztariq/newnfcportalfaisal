/** URL segments that can never be used as a vCard alias (they are app routes). */
module.exports = new Set([
  'admin', 'user', 'api', 'uploads', 'assets', 'login', 'register', 'logout', 'forgot-password', 'reset-password',
  'terms-conditions', 'privacy-policy', 'faqs', 'pricing', 'contact-us', 'about-us', 'features', 'home', 'dashboard',
  'favicon.ico', 'robots.txt', 'sitemap.xml', 'static', 'src', 'node_modules', 't', 's', 'pay', 'directory', 'verify-email', 'two-factor', 'sw.js', 'v', 'vcard', 'vcards', 'nfc', 'blog', 'r', 'shop', 'track', 'invoice', 'i', 'c', 'cart', 'checkout', 'orders', 'announcements',
]);
