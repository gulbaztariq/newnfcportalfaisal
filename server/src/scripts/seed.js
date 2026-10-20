/* Seeds master data, the super admin and demo content. Safe to run more than once. */
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { Op } = require('sequelize');
const M = require('../models');
const { TEMPLATES } = require('../views/templates/catalog');
const { seed } = require('../config');

const CURRENCIES = [
  ['United States Dollar', '$', 'USD'], ['Euro', '€', 'EUR'], ['British Pound', '£', 'GBP'], ['Indian Rupee', '₹', 'INR'],
  ['Pakistani Rupee', '₨', 'PKR'], ['UAE Dirham', 'AED', 'AED'], ['Saudi Riyal', 'SAR', 'SAR'], ['Canadian Dollar', 'C$', 'CAD'],
  ['Australian Dollar', 'A$', 'AUD'], ['Japanese Yen', '¥', 'JPY'], ['Chinese Yuan', 'CN¥', 'CNY'], ['Swiss Franc', 'CHF', 'CHF'],
  ['Turkish Lira', '₺', 'TRY'], ['Brazilian Real', 'R$', 'BRL'], ['South African Rand', 'R', 'ZAR'], ['Nigerian Naira', '₦', 'NGN'],
  ['Kenyan Shilling', 'KSh', 'KES'], ['Singapore Dollar', 'S$', 'SGD'], ['Malaysian Ringgit', 'RM', 'MYR'], ['Bangladeshi Taka', '৳', 'BDT'],
];
const COUNTRIES = [
  ['United States', 'US', '1', { California: ['Los Angeles', 'San Francisco', 'San Diego'], 'New York': ['New York City', 'Buffalo'], Texas: ['Houston', 'Austin', 'Dallas'] }],
  ['United Kingdom', 'GB', '44', { England: ['London', 'Manchester', 'Birmingham'], Scotland: ['Edinburgh', 'Glasgow'] }],
  ['India', 'IN', '91', { Maharashtra: ['Mumbai', 'Pune'], Gujarat: ['Ahmedabad', 'Surat'], Karnataka: ['Bengaluru'] }],
  ['Pakistan', 'PK', '92', { Punjab: ['Lahore', 'Faisalabad', 'Rawalpindi'], Sindh: ['Karachi', 'Hyderabad'], 'Islamabad Capital Territory': ['Islamabad'] }],
  ['United Arab Emirates', 'AE', '971', { Dubai: ['Dubai'], 'Abu Dhabi': ['Abu Dhabi', 'Al Ain'] }],
  ['Saudi Arabia', 'SA', '966', { Riyadh: ['Riyadh'], Makkah: ['Jeddah', 'Mecca'] }],
  ['Canada', 'CA', '1', { Ontario: ['Toronto', 'Ottawa'], 'British Columbia': ['Vancouver'] }],
  ['Australia', 'AU', '61', { 'New South Wales': ['Sydney'], Victoria: ['Melbourne'] }],
  ['Germany', 'DE', '49', { Bavaria: ['Munich'], Berlin: ['Berlin'] }],
  ['France', 'FR', '33', { 'Ile-de-France': ['Paris'] }],
];
const LANGUAGES = [['English', 'en', true], ['Arabic', 'ar'], ['Chinese', 'zh'], ['French', 'fr'], ['German', 'de'], ['Portuguese', 'pt'], ['Russian', 'ru'], ['Spanish', 'es'], ['Turkish', 'tr'], ['Urdu', 'ur']];

const all = (keys, v = true) => Object.fromEntries(keys.map((k) => [k, v]));

(async () => {
  await M.sequelize.authenticate();

  for (const [currency_name, currency_icon, currency_code] of CURRENCIES) await M.Currency.findOrCreate({ where: { currency_code }, defaults: { currency_name, currency_icon } });
  for (const [name, short_code, phone_code, states] of COUNTRIES) {
    const [c] = await M.Country.findOrCreate({ where: { short_code }, defaults: { name, phone_code } });
    for (const [sName, cities] of Object.entries(states)) {
      const [s] = await M.State.findOrCreate({ where: { name: sName, country_id: c.id } });
      for (const city of cities) await M.City.findOrCreate({ where: { name: city, state_id: s.id } });
    }
  }
  for (const [name, iso_code, is_default] of LANGUAGES) await M.Language.findOrCreate({ where: { iso_code }, defaults: { name, status: true, is_default: !!is_default } });
  for (const t of TEMPLATES) {
    const [row] = await M.Template.findOrCreate({ where: { slug: t.slug }, defaults: { name: t.name, profession: t.profession, defaults: t.defaults } });
    if (!row.defaults || !Object.keys(row.defaults).length) await row.update({ defaults: t.defaults });
  }

  const usd = await M.Currency.findOne({ where: { currency_code: 'USD' } });
  const templates = await M.Template.findAll({ order: [['id', 'ASC']] });
  const plans = [
  ];
  for (const p of plans) {
    const [plan, created] = await M.Plan.findOrCreate({ where: { name: p.name }, defaults: { ...p, currency_id: usd.id, custom_select: p.tpl > 20 } });
    if (created) await plan.setTemplates(templates.slice(0, p.tpl));
  }

  // social-profile plan: only the social / link-card templates (price is a placeholder, edit it in Plans)
  {
    const socialTpl = templates.filter((t) => TEMPLATES.some((c) => c.slug === t.slug && /^(Social|Link Cards):/.test(c.profession)));
    const [sp, created] = await M.Plan.findOrCreate({ where: { name: ['Social Profile', 'Social All-in-One'] }, defaults: { name: 'Social Profile', price: 0, frequency: 'monthly', trial_days: 0, no_of_vcards: 1, storage_limit: 200, features: all(['social_links', 'custom_links', 'enquiry_form', 'analytics', 'payment_links', 'gallery']), currency_id: usd.id, custom_select: true } });
    if (created) await sp.setTemplates(socialTpl);
  }

  // sellable plan families (PKR per year; prices are starting points, edit them in Plans)
  {
    const pkr = await M.Currency.findOne({ where: { currency_code: 'PKR' } });
    const isSocial = (t) => TEMPLATES.some((c) => c.slug === t.slug && /^Social/.test(c.profession));
    const isLink = (t) => TEMPLATES.some((c) => c.slug === t.slug && /^Link Cards/.test(c.profession));
    const people = templates.filter((t) => !isSocial(t) && !isLink(t));
    const FEAT = {
      basic: ['social_links', 'enquiry_form', 'products_services', 'custom_links'],
      pro: ['social_links', 'enquiry_form', 'products_services', 'custom_links', 'testimonials', 'gallery', 'analytics', 'seo', 'password', 'payment_links', 'custom_qrcode', 'appointments', 'nfc_cards'],
      full: M.PLAN_FEATURES.filter((k) => !['organisation', 'whatsapp_store', 'affiliation'].includes(k)),
      corp: M.PLAN_FEATURES.filter((k) => !['affiliation'].includes(k)),
    };
    const FAMILIES = [
      // individual clients with a physical card
      { name: 'Individual Starter', price: 999, vcards: 1, storage: 200, tpl: people.slice(0, 20), f: FEAT.basic },
      { name: 'Individual Professional', price: 1999, vcards: 3, storage: 1024, tpl: people.slice(0, 60), f: FEAT.pro },
      { name: 'Individual Executive', price: 3999, vcards: 5, storage: 3072, tpl: people, f: FEAT.full, extra: { no_of_short_links: 0 } },
      // companies
      { name: 'Corporate Business', price: 9999, vcards: 10, storage: 5120, tpl: people, f: [...FEAT.full, 'organisation'], extra: { no_of_organization_users: 10 } },
      { name: 'Corporate Enterprise', price: 24999, vcards: 50, storage: 20480, tpl: templates.filter((t) => !isSocial(t) && !isLink(t)), f: FEAT.corp, extra: { no_of_organization_users: 50, no_of_whatsapp_stores: 5 } },
      // social / review cards
      { name: 'Social Static Link', short: true, price: 499, vcards: 1, storage: 50, tpl: templates.filter(isSocial), f: ['social_links', 'custom_links'] },
      { name: 'Social Dynamic Link', short: true, price: 799, vcards: 1, storage: 100, tpl: templates.filter((t) => isSocial(t) || isLink(t)), f: ['social_links', 'custom_links', 'url_shortener', 'analytics', 'enquiry_form'], extra: { no_of_short_links: 0 } },
      // digital profile only (same features as the individual tiers, no card)
      { name: 'Digital Basic', price: 799, vcards: 1, storage: 200, tpl: people.slice(0, 20), f: FEAT.basic },
      { name: 'Digital Plus', price: 1499, vcards: 3, storage: 1024, tpl: people.slice(0, 60), f: FEAT.pro },
      { name: 'Digital Pro', price: 2999, vcards: 5, storage: 3072, tpl: people, f: FEAT.full },
    ];
    for (const fam of FAMILIES) {
      const [pl, created] = await M.Plan.findOrCreate({ where: { name: fam.name }, defaults: { name: fam.name, price: fam.price, frequency: 'yearly', custom_duration_days: fam.short ? null : 730, trial_days: 0, no_of_vcards: fam.vcards, storage_limit: fam.storage, features: { ...all(M.PLAN_FEATURES, false), ...all(fam.f) }, currency_id: pkr?.id || usd.id, custom_select: fam.tpl.length > 20, ...(fam.extra || {}) } });
      if (created) await pl.setTemplates(fam.tpl);
    }
    // the existing Social Profile plan becomes the all-in-one social plan (its products stay linked)
    const aio = await M.Plan.findOne({ where: { name: 'Social Profile' } });
    if (aio && Number(aio.price) === 0 && !(await M.Subscription.count({ where: { plan_id: aio.id } }))) {
      await aio.update({ name: 'Social All-in-One', price: 1199, frequency: 'yearly', currency_id: pkr?.id || usd.id, no_of_vcards: 1, storage_limit: 300, features: { ...(aio.features || {}), ...all(['social_links', 'custom_links', 'url_shortener', 'analytics', 'enquiry_form', 'payment_links', 'gallery', 'products_services', 'seo']) }, no_of_short_links: 0 });
    }
  }

  // card reprinting products (order type "Card reprinting"); prices are starting points, edit them in Orders > Products
  for (const [name, slug, price] of [['Card Reprint: PVC', 'reprint-pvc', 499], ['Card Reprint: Wood', 'reprint-wood', 1299], ['Card Reprint: Metal', 'reprint-metal', 2499]]) {
    await M.NfcCard.findOrCreate({ where: { slug }, defaults: { name, slug, price, category: 'Card reprinting', product_kind: 'reprint', show_in_shop: false, status: true, short_description: 'Same design printed again on a new card' } });
  }

  // one product per sellable plan: this is what renewal and upgrade orders sell (price follows the plan, edit it in Orders > Products)
  for (const plan of await M.Plan.findAll({ where: { name: ['Social All-in-One', 'Individual Starter', 'Individual Professional', 'Individual Executive', 'Corporate Business', 'Corporate Enterprise', 'Social Static Link', 'Social Dynamic Link', 'Digital Basic', 'Digital Plus', 'Digital Pro'] } })) {
    const slug = `plan-${plan.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
    await M.NfcCard.findOrCreate({ where: { slug }, defaults: { name: `${plan.name} plan (${/^Social (Static|Dynamic)/.test(plan.name) ? '1 year' : '2 years'})`, slug, price: plan.price, category: 'Plans', plan_id: plan.id, product_kind: plan.name.startsWith('Digital') ? 'digital' : 'plan', show_in_shop: false, status: true, short_description: 'Renew or upgrade to this plan' } });
  }

  // plans created before new features existed: add the missing feature keys (premium tiers get them on)
  for (const plan of await M.Plan.findAll()) {
    const rich = ['Premium', 'Lifetime'].includes(plan.name);
    const f = { ...(plan.features || {}) };
    let changed = false;
    for (const k of M.PLAN_FEATURES) if (f[k] === undefined) { f[k] = rich; changed = true; }
    const extra = {};
    if (rich && !plan.no_of_whatsapp_stores) extra.no_of_whatsapp_stores = plan.name === 'Lifetime' ? 5 : 2;
    if (rich && !plan.no_of_organization_users) extra.no_of_organization_users = plan.name === 'Lifetime' ? 25 : 5;
    if (changed || Object.keys(extra).length) await plan.update({ ...(changed ? { features: f } : {}), ...extra });
  }

  const hash = await bcrypt.hash(seed.password, 12);
  const mk = async (email, first_name, last_name, role) => {
    const [u] = await M.User.findOrCreate({ where: { email }, defaults: { first_name, last_name, role, password: hash, email_verified_at: new Date(), affiliate_code: crypto.randomBytes(5).toString('hex') } });
    return u;
  };
  await mk(seed.email, 'Super', 'Admin', 'super_admin');
  await mk('admin@vcard.com', 'Admin', 'User', 'admin');
  const demo = await mk('user@vcard.com', 'John', 'Doe', 'user');
  if (!(await M.Subscription.findOne({ where: { user_id: demo.id } }))) {
    const premium = await M.Plan.findOne({ where: { name: 'Individual Executive' } });
    await require('../services/subscription').activate(demo.id, premium, { paymentType: 'admin' });
  }
  if (!(await M.Vcard.findOne({ where: { user_id: demo.id } }))) {
    const tpl = templates.find((t) => t.slug === 'vcard8');
    const v = await M.Vcard.create({
      user_id: demo.id, template_id: tpl.id, url_alias: 'john-doe', name: 'John Doe - Designer', first_name: 'John', last_name: 'Doe',
      occupation: 'Product Designer', company: 'Acme Studio', job_title: 'Lead Product Designer', email: 'user@vcard.com', phone: '5550100', region_code: '1',
      location: 'San Francisco, CA', description: 'I design delightful digital products and brand experiences.', theme: tpl.defaults, is_verified: true,
      social_links: { website: 'https://example.com', linkedin: 'https://linkedin.com', instagram: 'https://instagram.com', whatsapp: 'https://wa.me/15550100' },
      custom_links: [{ label: 'Portfolio', url: 'https://example.com' }],
      business_hours: Object.fromEntries(['mon', 'tue', 'wed', 'thu', 'fri'].map((d) => [d, { open: true, from: '09:00', to: '17:00' }])),
      sections: { contact: true, social: true, services: true, gallery: true, testimonials: true, hours: true, qr: true, enquiry: true, links: true },
    });
    await M.VcardService.bulkCreate([{ vcard_id: v.id, name: 'Brand Identity', description: 'Logos, colour systems and guidelines.' }, { vcard_id: v.id, name: 'UI / UX Design', description: 'Web and mobile product design.' }]);
    await M.VcardTestimonial.create({ vcard_id: v.id, name: 'Jamie Lee', description: 'Wonderful to work with, delivered beyond expectations.' });
  }

  if (!(await M.Feature.count())) {
    await M.Feature.bulkCreate([
      { title: 'NFC Business Cards', description: 'Tap an NFC card on any phone to open your digital profile instantly.' },
      { title: 'QR Code Sharing', description: 'Every vCard gets a downloadable QR code in your brand colour.' },
      { title: '90+ Templates', description: 'Beautiful templates for every profession, fully customisable.' },
      { title: 'Analytics', description: 'See how many people view your card and from which devices.' },
      { title: 'Lead Capture', description: 'Visitors can send you enquiries straight from your card.' },
      { title: 'Save to Contacts', description: 'One tap adds your details to the visitor address book.' },
    ]);
  }
  if (!(await M.AboutUs.count())) {
    await M.AboutUs.bulkCreate([
      { title: 'Eco friendly', description: 'Replace thousands of paper cards with one digital card you can update anytime.' },
      { title: 'Always up to date', description: 'Changed your number or job? Update once and every shared card is current.' },
      { title: 'Made for teams', description: 'Manage cards for your whole company from one dashboard.' },
    ]);
  }
  if (!(await M.FrontFaq.count())) {
    await M.FrontFaq.bulkCreate([
      { title: 'What is a digital business card?', description: 'A web page with your contact details, social links and more that you can share with a link, QR code or NFC tap.' },
      { title: 'Do people need an app to open my card?', description: 'No. The card opens in any web browser.' },
      { title: 'Can I change my card after sharing it?', description: 'Yes, every change is live immediately for everyone who has your link.' },
    ]);
  }
  if (!(await M.FrontTestimonial.count())) {
    await M.FrontTestimonial.bulkCreate([
      { name: 'Sarah Johnson', designation: 'Real Estate Agent', description: 'My clients love tapping my card. I get more calls than ever.' },
      { name: 'Ahmed Khan', designation: 'Startup Founder', description: 'We moved the whole team to digital cards in one afternoon.' },
      { name: 'Maria Garcia', designation: 'Photographer', description: 'The templates are gorgeous and the analytics are really useful.' },
    ]);
  }
  if (!(await M.NfcCard.count())) {
    await M.NfcCard.bulkCreate([
      { name: 'Classic PVC Card', description: 'Glossy PVC card with your design printed on both sides.', price: 19 },
      { name: 'Matte Black Card', description: 'Premium matte black finish with spot UV.', price: 29 },
      { name: 'Metal Card', description: 'Stainless steel card with laser engraving.', price: 59 },
    ]);
  }
  // shop catalogue (PKR). Prices from the client's product list; edit anything in Admin > Products.
  const PRODUCTS = [
    ['nfc-review-social-media-card', 'NFC Review / Social Media Card', 'Cards', 999, 400, 'Standard card (85.6 x 54 mm)', 'Tap to open your Google review page, Instagram, WhatsApp or any link.'],
    ['nfc-review-social-media-standee', 'NFC Review / Social Media Standee', 'Standees', 1199, 0, '100 x 120 mm', 'Counter standee: customers tap or scan to review or follow you.'],
    ['nfc-all-in-1-multipurpose-standee', 'NFC All in 1 & Multipurpose Standee', 'Standees', 2499, 0, 'Customised', 'One standee for reviews, socials, menu, payments and more. Customisation included.'],
    ['nfc-review-plate-desk-smart-tag', 'NFC Review Plate / Desk Smart Tag', 'Plates & Tags', 1199, 400, '100 x 100 mm', 'Desk or wall plate that opens your review page with a tap.'],
    ['nfc-epoxy-tag-anti-metal', 'NFC Epoxy Tag Anti-Metal (All in 1 & Multipurpose)', 'Plates & Tags', 1499, 0, '30 mm', 'Works on metal surfaces: POS machines, fridges, doors.'],
    ['nfc-keyring', 'NFC Keyring', 'Keyrings', 699, 0, '30 mm', 'Your digital card on your keys.'],
    ['nfc-all-in-1-multipurpose-keyring', 'NFC All in 1 & Multipurpose Keyring', 'Keyrings', 1199, 0, '1.5 x 1.5 inch', 'Share everything with one tap from your keyring.'],
    ['nfc-coin', 'NFC Coin', 'Plates & Tags', 499, 0, '25 mm', 'Small NFC coin tag - stick it anywhere.'],
    ['nfc-band', 'NFC Band', 'Wearables', 999, 0, 'Standard size', 'Silicone wristband with a built-in NFC chip.'],
    ['nfc-ring', 'NFC Ring', 'Wearables', 2999, 0, 'Small / Medium / Large', 'Smart ring: share your profile with a handshake.', [{ name: 'Small', price_delta: 0 }, { name: 'Medium', price_delta: 0 }, { name: 'Large', price_delta: 0 }]],
    ['nfc-wet-inlay-sticker', 'NFC Wet Inlay Sticker', 'Stickers', 249, 0, '25 mm', 'Transparent wet inlay NFC sticker.'],
    ['nfc-white-round-sticker', 'NFC White Round Sticker', 'Stickers', 299, 0, '25 mm', 'Printable white round NFC sticker.'],
    ['nfc-white-round-anti-metal-sticker', 'NFC White Round Anti-Metal Sticker', 'Stickers', 399, 0, '25 mm', 'Anti-metal NFC sticker for phones, laptops and metal surfaces.'],
    ['airport-nfc-tags-cards', 'Airport NFC Tags / Cards', 'Travel', 0, 0, '', 'Luggage NFC tags and cards. Set the price before publishing.', [], false],
  ];
  // only on the first run, so products the admin deletes later do not come back on the next deploy
  if (!(await M.NfcCard.count({ where: { slug: { [Op.ne]: null } } }))) for (const [slug, name, category, price, custom, size, desc, variants = [], shop = true] of PRODUCTS) {
    await M.NfcCard.findOrCreate({ where: { slug }, defaults: { name, category, price, customization_price: custom, size_label: size, short_description: desc, description: desc, variants, show_in_shop: shop, status: true, sort: PRODUCTS.findIndex((p) => p[0] === slug) } });
  }
  // the three demo cards from the first release are hidden from the new shop (they had USD demo prices)
  await M.NfcCard.update({ show_in_shop: false }, { where: { slug: null, name: ['Classic PVC Card', 'Matte Black Card', 'Metal Card'], price: [19, 29, 59] } });
  if (!(await M.InventoryItem.count())) for (const [name, category] of [['Blank PVC NFC card', 'blank_card'], ['Plastic card', 'blank_card'], ['NFC chip (NTAG215)', 'nfc_chip'], ['NFC review tag blank', 'tag'], ['NFC sticker 25mm', 'sticker'], ['Acrylic standee blank', 'standee'], ['Packaging box', 'packaging']]) {
    await M.InventoryItem.findOrCreate({ where: { name }, defaults: { category, sku: `INV-${name.replace(/[^A-Za-z0-9]+/g, '-').toUpperCase().slice(0, 40)}` } });
  }
  if (!(await M.FinanceAccount.count())) await M.FinanceAccount.bulkCreate([{ name: 'Cash in hand', type: 'cash' }, { name: 'Bank account', type: 'bank' }, { name: 'JazzCash / Easypaisa', type: 'wallet' }]);
  if (!(await M.FinanceCategory.count())) {
    await M.FinanceCategory.bulkCreate([...['Rent', 'Salaries', 'Marketing & ads', 'Printing', 'Packaging', 'Courier', 'Utilities', 'Software & hosting', 'Travel', 'Office supplies', 'Miscellaneous'].map((name) => ({ name, type: 'expense' })), ...['Design services', 'Other income'].map((name) => ({ name, type: 'income' }))]);
  }
  // premium tiers include every template, also the ones added later
  for (const plan of await M.Plan.findAll({ where: { name: ['Premium', 'Lifetime'] }, include: [M.Template] })) {
    const have = new Set(plan.templates.map((t) => t.id));
    const missing = templates.filter((t) => !have.has(t.id));
    if (missing.length) await plan.addTemplates(missing);
  }

  await M.CouponCode.findOrCreate({ where: { coupon_name: 'WELCOME10' }, defaults: { type: 'percentage', discount: 10, status: true } });
  const settings = require('../services/settings');
  if (!(await settings.get('default_currency_id'))) await settings.set({ default_currency_id: usd.id });

  console.log(`Seed complete. Super admin: ${seed.email}`);
  await M.sequelize.close();
})().catch((e) => { console.error(e); process.exit(1); });
