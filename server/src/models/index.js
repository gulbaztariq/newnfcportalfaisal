const { DataTypes: T } = require('sequelize');
const sequelize = require('../db');

const json = (name, def = null) => ({
  type: T.TEXT('long'),
  allowNull: true, // no DEFAULT: MySQL does not allow defaults on TEXT columns; the getter returns `def` instead
  get() {
    const raw = this.getDataValue(name);
    if (raw === null || raw === undefined || raw === '') return def;
    try { return JSON.parse(raw); } catch { return def; }
  },
  set(v) { this.setDataValue(name, v === null || v === undefined ? null : JSON.stringify(v)); },
});

const SECRETS = ['password', 'reset_token', 'reset_expires_at', 'token_version', 'two_factor_secret', 'two_factor_recovery', 'email_verify_token', 'login_otp_hash', 'login_otp_expires_at', 'login_otp_attempts', 'failed_logins', 'locked_until'];
// platform staff roles (admin panel) and company roles (inside an organisation)
const STAFF_ROLES = ['super_admin', 'admin', 'manager', 'supervisor'];
const COMPANY_ROLES = ['owner', 'manager', 'supervisor', 'member'];

/* ------------------------------------------------------------------ users */
const User = sequelize.define('user', {
  first_name: { type: T.STRING(100), allowNull: false },
  last_name: { type: T.STRING(100), allowNull: false, defaultValue: '' },
  email: { type: T.STRING(191), allowNull: false, unique: true },
  contact: T.STRING(30),
  region_code: T.STRING(8),
  password: { type: T.STRING(191), allowNull: false },
  role: { type: T.ENUM('super_admin', 'admin', 'manager', 'supervisor', 'user'), allowNull: false, defaultValue: 'user' },
  permissions: json('permissions', null), // null = role defaults; otherwise an array of 'module.view' / 'module.manage'
  company_role: T.STRING(20), // owner | manager | supervisor | member (inside organisation_id)
  is_active: { type: T.BOOLEAN, defaultValue: true },
  email_verified_at: T.DATE,
  avatar: T.STRING(255),
  language: { type: T.STRING(10), defaultValue: 'en' },
  theme_mode: { type: T.STRING(10), defaultValue: 'light' },
  affiliate_code: { type: T.STRING(32), unique: true },
  last_login_at: T.DATE,
  token_version: { type: T.INTEGER, defaultValue: 0 },
  reset_token: T.STRING(191),
  reset_expires_at: T.DATE,
  // two-factor authentication (TOTP) + one-time recovery codes (sha256 hashes)
  two_factor_enabled: { type: T.BOOLEAN, defaultValue: false },
  two_factor_secret: T.STRING(64),
  two_factor_recovery: json('two_factor_recovery', []),
  email_verify_token: T.STRING(191),
  storage_used: { type: T.BIGINT, defaultValue: 0 }, // bytes uploaded
  is_organisation: { type: T.BOOLEAN, defaultValue: false }, // company owner account
  organisation_id: T.INTEGER, // member of the organisation owned by this user id
  org_status: { type: T.STRING(10), defaultValue: 'active' }, // set by the organisation: active | locked (no sign-in) | blocked (no sign-in, cards hidden)
  locked_fields: json('locked_fields', []), // card / profile fields the organisation locked for this member
  timezone: T.STRING(60),
  // e-mail login code (sent on every sign-in when enabled) + brute-force lockout
  login_otp_hash: T.STRING(128),
  login_otp_expires_at: T.DATE,
  login_otp_attempts: { type: T.INTEGER, defaultValue: 0 },
  failed_logins: { type: T.INTEGER, defaultValue: 0 },
  locked_until: T.DATE,
}, {
  defaultScope: { attributes: { exclude: SECRETS } },
  scopes: { withSecrets: { attributes: { include: SECRETS } } },
});
User.prototype.fullName = function () { return `${this.first_name} ${this.last_name}`.trim(); };
// never serialise secrets, whatever scope the instance was loaded with
User.prototype.toJSON = function () {
  const j = { ...this.get() };
  for (const k of SECRETS) delete j[k];
  return j;
};
const vcardToJSON = function () { const j = { ...this.get() }; j.has_password = !!j.password; delete j.password; return j; };

/* --------------------------------------------------- organisation profile */
// company details of an organisation account (owner_id = the owner user); members point at the owner via users.organisation_id
const Organisation = sequelize.define('organisation', {
  owner_id: { type: T.INTEGER, allowNull: false, unique: true },
  name: { type: T.STRING(150), allowNull: false },
  website: T.STRING(255), // company domain / website link
  logo: T.STRING(255),
  email: T.STRING(191),
  phone: T.STRING(40),
  address: T.STRING(500),
  city: T.STRING(120),
  country: T.STRING(120),
  seats: { type: T.INTEGER, defaultValue: 0 }, // number of users allowed, 0 = the plan's organisation-user limit
});
User.hasOne(Organisation, { foreignKey: 'owner_id', onDelete: 'CASCADE' }); Organisation.belongsTo(User, { as: 'owner', foreignKey: 'owner_id' });

/* ------------------------------------------------------------ locations */
const Currency = sequelize.define('currency', {
  currency_name: { type: T.STRING(100), allowNull: false },
  currency_icon: { type: T.STRING(10), allowNull: false },
  currency_code: { type: T.STRING(10), allowNull: false, unique: true },
});
const Country = sequelize.define('country', {
  name: { type: T.STRING(120), allowNull: false },
  short_code: { type: T.STRING(5), allowNull: false },
  phone_code: T.STRING(10),
});
const State = sequelize.define('state', { name: { type: T.STRING(120), allowNull: false } });
const City = sequelize.define('city', { name: { type: T.STRING(120), allowNull: false } });
Country.hasMany(State, { foreignKey: 'country_id', onDelete: 'CASCADE' }); State.belongsTo(Country, { foreignKey: 'country_id' });
State.hasMany(City, { foreignKey: 'state_id', onDelete: 'CASCADE' }); City.belongsTo(State, { foreignKey: 'state_id' });

const Language = sequelize.define('language', {
  name: { type: T.STRING(60), allowNull: false },
  iso_code: { type: T.STRING(10), allowNull: false, unique: true },
  status: { type: T.BOOLEAN, defaultValue: true },
  is_default: { type: T.BOOLEAN, defaultValue: false },
});

/* ------------------------------------------------------------ templates */
const Template = sequelize.define('template', {
  name: { type: T.STRING(100), allowNull: false },
  slug: { type: T.STRING(60), allowNull: false, unique: true }, // renderer key (views/templates)
  profession: T.STRING(100),
  defaults: json('defaults', {}), // default colours / font
  status: { type: T.BOOLEAN, defaultValue: true },
});

/* --------------------------------------------------------------- plans */
const PLAN_FEATURES = [
  'products_services', 'testimonials', 'hide_branding', 'enquiry_form', 'social_links', 'custom_links',
  'password', 'custom_css', 'custom_js', 'custom_fonts', 'gallery', 'analytics', 'seo', 'blog',
  'affiliation', 'custom_qrcode', 'iframes', 'allow_custom_domain', 'nfc_cards',
  'products', 'appointments', 'instagram_embed', 'linkedin_embed', 'payment_links', 'pwa', 'virtual_background',
  'custom_pages', 'newsletter', 'business_directory', 'whatsapp_store', 'ai_tools', 'organisation',
  'url_shortener', 'custom_code',
];
const Plan = sequelize.define('plan', {
  name: { type: T.STRING(100), allowNull: false },
  price: { type: T.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
  frequency: { type: T.ENUM('monthly', 'yearly', 'unlimited'), defaultValue: 'monthly' },
  trial_days: { type: T.INTEGER, defaultValue: 0 },
  no_of_vcards: { type: T.INTEGER, defaultValue: 1 },
  storage_limit: { type: T.INTEGER, defaultValue: 100 }, // MB
  is_default: { type: T.BOOLEAN, defaultValue: false },
  status: { type: T.BOOLEAN, defaultValue: true },
  custom_select: { type: T.BOOLEAN, defaultValue: false }, // allow users to pick any of the plan templates
  features: json('features', {}),
  tax_name: T.STRING(60),
  tax_rate: { type: T.DECIMAL(6, 2), defaultValue: 0 }, // percent added on top of the price
  no_of_visitors: { type: T.INTEGER, defaultValue: 0 }, // vCard openings per plan period, 0 = unlimited
  no_of_organization_users: { type: T.INTEGER, defaultValue: 0 },
  no_of_whatsapp_stores: { type: T.INTEGER, defaultValue: 0 },
  custom_duration_days: T.INTEGER, // optional custom plan length (e.g. 730 = 2 years), overrides frequency
  no_of_short_links: { type: T.INTEGER, defaultValue: 0 }, // dynamic redirect links, 0 = unlimited (when the feature is on)
});
Plan.belongsTo(Currency, { foreignKey: 'currency_id' });
Plan.belongsToMany(Template, { through: 'plan_templates', foreignKey: 'plan_id', otherKey: 'template_id' });
Template.belongsToMany(Plan, { through: 'plan_templates', foreignKey: 'template_id', otherKey: 'plan_id' });

const CouponCode = sequelize.define('coupon_code', {
  coupon_name: { type: T.STRING(60), allowNull: false, unique: true },
  type: { type: T.ENUM('percentage', 'fixed'), defaultValue: 'percentage' },
  discount: { type: T.DECIMAL(12, 2), allowNull: false },
  expire_at: T.DATEONLY,
  coupon_limit: T.INTEGER,
  coupon_limit_left: T.INTEGER,
  status: { type: T.BOOLEAN, defaultValue: true },
});

const Transaction = sequelize.define('transaction', {
  transaction_id: { type: T.STRING(191) },
  amount: { type: T.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
  type: { type: T.STRING(30), allowNull: false }, // stripe | paypal | razorpay | flutterwave | paystack | phonepe | manual | free
  status: { type: T.ENUM('pending', 'paid', 'rejected'), defaultValue: 'pending' },
  purpose: { type: T.STRING(30), defaultValue: 'subscription' }, // subscription | nfc_order | appointment | store_order
  tax_amount: { type: T.DECIMAL(12, 2), defaultValue: 0 },
  notes: T.TEXT,
  attachment: T.STRING(255),
  meta: json('meta', {}),
});
Transaction.belongsTo(User, { foreignKey: 'user_id' }); User.hasMany(Transaction, { foreignKey: 'user_id' });

const Subscription = sequelize.define('subscription', {
  plan_amount: { type: T.DECIMAL(12, 2), defaultValue: 0 },
  discount: { type: T.DECIMAL(12, 2), defaultValue: 0 },
  payable_amount: { type: T.DECIMAL(12, 2), defaultValue: 0 },
  plan_frequency: T.STRING(20),
  starts_at: T.DATE,
  ends_at: T.DATE,
  trial_ends_at: T.DATE,
  status: { type: T.ENUM('active', 'inactive', 'pending'), defaultValue: 'active' },
  payment_type: T.STRING(30),
  coupon_code_meta: json('coupon_code_meta', null),
  notes: T.TEXT,
  tax_amount: { type: T.DECIMAL(12, 2), defaultValue: 0 },
  expiry_notified_at: T.DATE,
});
Subscription.belongsTo(User, { foreignKey: 'user_id' }); User.hasMany(Subscription, { foreignKey: 'user_id' });
Subscription.belongsTo(Plan, { foreignKey: 'plan_id' }); Plan.hasMany(Subscription, { foreignKey: 'plan_id' });
Subscription.belongsTo(Transaction, { foreignKey: 'transaction_id' }); Transaction.hasOne(Subscription, { foreignKey: 'transaction_id' });

/* --------------------------------------------------------------- vcards */
const Vcard = sequelize.define('vcard', {
  url_alias: { type: T.STRING(80), allowNull: false, unique: true },
  name: { type: T.STRING(120), allowNull: false },
  occupation: T.STRING(120),
  description: T.TEXT,
  first_name: T.STRING(100),
  last_name: T.STRING(100),
  email: T.STRING(191),
  region_code: T.STRING(8),
  phone: T.STRING(30),
  alternative_email: T.STRING(191),
  alternative_phone: T.STRING(30),
  location: T.STRING(255),
  location_url: T.STRING(500),
  company: T.STRING(150),
  job_title: T.STRING(150),
  dob: T.DATEONLY,
  profile_image: T.STRING(255),
  cover_image: T.STRING(255),
  status: { type: T.BOOLEAN, defaultValue: true },
  is_verified: { type: T.BOOLEAN, defaultValue: false },
  theme: json('theme', {}), // { primary, secondary, background, text, font }
  social_links: json('social_links', {}),
  custom_links: json('custom_links', []), // [{label,url}]
  business_hours: json('business_hours', {}), // { mon: {open:true, from:'09:00', to:'17:00'} }
  sections: json('sections', {}), // { services:true, gallery:true, ... } visibility switches
  section_order: json('section_order', []), // ['about','contact',...] owner's drag-and-drop order
  section_titles: json('section_titles', {}), // { services: 'What I do' } custom section headings
  menu_pages: json('menu_pages', []), // ['/uploads/vcards/..jpg', ...] pages of the full menu / catalogue viewer
  menu_title: T.STRING(80), // 'View Full Menu'
  menu_desc: T.STRING(120), // 'Burgers, pizzas and deals'
  password: T.STRING(191),
  custom_css: T.TEXT,
  custom_code: T.TEXT('long'), // own HTML/CSS/JS design, served sandboxed from /c/{alias}
  custom_code_enabled: { type: T.BOOLEAN, defaultValue: false },
  site_title: T.STRING(150),
  meta_keyword: T.STRING(255),
  meta_description: T.STRING(500),
  google_analytics: T.TEXT,
  default_language: { type: T.STRING(10), defaultValue: 'en' },
  enable_enquiry_form: { type: T.BOOLEAN, defaultValue: true },
  show_qr_code: { type: T.BOOLEAN, defaultValue: true },
  hide_branding: { type: T.BOOLEAN, defaultValue: false },
  views: { type: T.INTEGER, defaultValue: 0 },
  // media & embeds
  cover_type: { type: T.STRING(10), defaultValue: 'image' }, // image | video | youtube
  cover_video: T.STRING(255),
  youtube_link: T.STRING(255),
  instagram_embed: T.TEXT, // post / reel URL
  linkedin_embed: T.TEXT, // post URL
  iframes: json('iframes', []), // [{title,url}]
  location_embed: T.STRING(1000), // Google Maps embed URL
  terms_conditions: T.TEXT,
  privacy_policy: T.TEXT,
  payment_links: json('payment_links', []), // [{label,url}]
  // behaviour
  sticky_bar: { type: T.BOOLEAN, defaultValue: true },
  newsletter_popup: { type: T.BOOLEAN, defaultValue: false },
  ask_before_contact: { type: T.BOOLEAN, defaultValue: false },
  enquiry_attachment: { type: T.BOOLEAN, defaultValue: false },
  pwa_enable: { type: T.BOOLEAN, defaultValue: true },
  week_format: { type: T.STRING(3), defaultValue: 'mon' }, // week starts on mon | sun
  business_directory: { type: T.BOOLEAN, defaultValue: false },
  qr_settings: json('qr_settings', {}), // { fg, bg, size, margin }
  appointment_settings: json('appointment_settings', {}), // { enabled, paid, price, duration, slots:{mon:[{from,to}]}, blocked:[date] }
  custom_domain: T.STRING(191),
  custom_domain_status: T.STRING(20), // pending | approved | rejected
  organisation_id: T.INTEGER,
});
Vcard.prototype.toJSON = vcardToJSON;
Vcard.belongsTo(User, { foreignKey: 'user_id' }); User.hasMany(Vcard, { foreignKey: 'user_id' });
Vcard.belongsTo(Template, { foreignKey: 'template_id' }); Template.hasMany(Vcard, { foreignKey: 'template_id' });

const VcardService = sequelize.define('vcard_service', {
  name: { type: T.STRING(150), allowNull: false },
  description: T.TEXT,
  service_url: T.STRING(500),
  image: T.STRING(255),
  sort: { type: T.INTEGER, defaultValue: 0 },
});
const VcardGallery = sequelize.define('vcard_gallery', {
  image: T.STRING(255),
  caption: T.STRING(150),
  category: T.STRING(80),
  type: { type: T.STRING(10), defaultValue: 'image' }, // image | youtube
  video_url: T.STRING(500),
});
const VcardTestimonial = sequelize.define('vcard_testimonial', {
  name: { type: T.STRING(120), allowNull: false },
  description: T.TEXT,
  image: T.STRING(255),
});
const VcardEnquiry = sequelize.define('vcard_enquiry', {
  name: { type: T.STRING(120), allowNull: false },
  email: T.STRING(191),
  phone: T.STRING(30),
  message: T.TEXT,
  attachment: T.STRING(255),
  product_name: T.STRING(150), // enquiry about a product / service
});
const VcardProduct = sequelize.define('vcard_product', {
  name: { type: T.STRING(150), allowNull: false },
  description: T.TEXT,
  price: T.DECIMAL(12, 2),
  currency_code: T.STRING(10),
  product_url: T.STRING(500),
  images: json('images', []),
  in_stock: { type: T.BOOLEAN, defaultValue: true },
  sort: { type: T.INTEGER, defaultValue: 0 },
});
const Appointment = sequelize.define('appointment', {
  name: { type: T.STRING(120), allowNull: false },
  email: T.STRING(191),
  phone: T.STRING(30),
  date: { type: T.DATEONLY, allowNull: false },
  from_time: { type: T.STRING(5), allowNull: false },
  to_time: { type: T.STRING(5), allowNull: false },
  service_name: T.STRING(150),
  notes: T.TEXT,
  status: { type: T.STRING(20), defaultValue: 'pending' }, // pending | confirmed | completed | cancelled
  amount: { type: T.DECIMAL(12, 2), defaultValue: 0 },
  paid: { type: T.BOOLEAN, defaultValue: false },
});
const VcardBlog = sequelize.define('vcard_blog', {
  title: { type: T.STRING(200), allowNull: false },
  slug: { type: T.STRING(200), allowNull: false },
  description: T.TEXT('long'),
  image: T.STRING(255),
  status: { type: T.BOOLEAN, defaultValue: true },
});
const VcardPage = sequelize.define('vcard_page', {
  title: { type: T.STRING(150), allowNull: false },
  slug: { type: T.STRING(150), allowNull: false },
  content: T.TEXT('long'),
  status: { type: T.BOOLEAN, defaultValue: true },
});
const VcardSubscriber = sequelize.define('vcard_subscriber', { email: { type: T.STRING(191), allowNull: false } });
const VcardView = sequelize.define('vcard_view', {
  ip_hash: T.STRING(64),
  user_agent: T.STRING(255),
  referrer: T.STRING(255),
  device: T.STRING(20),
}, { updatedAt: false });
for (const M of [VcardService, VcardGallery, VcardTestimonial, VcardEnquiry, VcardView, VcardProduct, Appointment, VcardBlog, VcardPage, VcardSubscriber]) {
  Vcard.hasMany(M, { foreignKey: 'vcard_id', onDelete: 'CASCADE' }); M.belongsTo(Vcard, { foreignKey: 'vcard_id' });
}

/* ------------------------------------------------------------------ NFC */
const NfcCard = sequelize.define('nfc_card', {
  name: { type: T.STRING(120), allowNull: false },
  description: T.TEXT,
  price: { type: T.DECIMAL(12, 2), defaultValue: 0 },
  front_image: T.STRING(255),
  back_image: T.STRING(255),
  status: { type: T.BOOLEAN, defaultValue: true },
  // shop fields
  slug: { type: T.STRING(150), unique: true },
  category: T.STRING(60),
  sku: T.STRING(60),
  short_description: T.STRING(500),
  compare_price: T.DECIMAL(12, 2),
  customization_price: { type: T.DECIMAL(12, 2), defaultValue: 0 },
  size_label: T.STRING(80),
  variants: json('variants', []), // [{name, price_delta}]
  images: json('images', []),
  featured: { type: T.BOOLEAN, defaultValue: false },
  show_in_shop: { type: T.BOOLEAN, defaultValue: true },
  sort: { type: T.INTEGER, defaultValue: 0 },
  weight_grams: { type: T.INTEGER, defaultValue: 50 },
  extra_cost: { type: T.DECIMAL(12, 2), defaultValue: 0 }, // printing / labour per unit on top of inventory components
  track_stock: { type: T.BOOLEAN, defaultValue: true },
  plan_id: T.INTEGER, // subscription plan that comes with this product (null = non-plan product)
  // order types and sources
  product_kind: T.STRING(20), // nfc_profile | social_static | social_dynamic | social_profile | printing | digital (drives the order wizard)
  discount_type: T.STRING(10), discount_value: { type: T.DECIMAL(12, 2), defaultValue: 0 }, // product discount: fixed | percent off the price
  sample_price: T.DECIMAL(12, 2), // price of ONE sample; empty = price + the sample markup from the settings
  wholesale_tiers: json('wholesale_tiers', null), // [{min, percent}] overrides the global tiers for this product
  tags_per_unit: { type: T.INTEGER, defaultValue: 1 }, // contact / airport tags: how many tags one unit makes (a pack of 2 = 2)
  no_wholesale_tiers: { type: T.BOOLEAN, defaultValue: false }, // already priced for wholesale: wholesale orders get no tier discount on it
  // synced from an order source (website)
  order_source_id: T.INTEGER, external_id: T.STRING(80), source_url: T.STRING(500),
  source_price: T.DECIMAL(12, 2), price_locked: { type: T.BOOLEAN, defaultValue: false }, // locked = edited by hand, sync no longer overwrites the price
  synced_at: T.DATE,
});
const NfcOrder = sequelize.define('nfc_order', {
  order_number: { type: T.STRING(30), unique: true },
  name: { type: T.STRING(120), allowNull: false },
  designation: T.STRING(120),
  company_name: T.STRING(150),
  email: T.STRING(191),
  phone: T.STRING(30),
  region_code: T.STRING(8),
  address: T.TEXT,
  logo: T.STRING(255),
  quantity: { type: T.INTEGER, defaultValue: 1 },
  unit_price: { type: T.DECIMAL(12, 2), defaultValue: 0 },
  tax_amount: { type: T.DECIMAL(12, 2), defaultValue: 0 },
  amount: { type: T.DECIMAL(12, 2), defaultValue: 0 },
  order_status: { type: T.ENUM('pending', 'confirmed', 'designing', 'printing', 'processing', 'ready', 'shipped', 'delivered', 'returned', 'cancelled'), defaultValue: 'pending' },
  payment_status: { type: T.ENUM('pending', 'paid', 'rejected'), defaultValue: 'pending' },
  payment_type: T.STRING(30),
  nfc_written: { type: T.BOOLEAN, defaultValue: false },
  // shop / checkout
  source: { type: T.STRING(20), defaultValue: 'portal' }, // portal | shop | admin
  access_token: T.STRING(64), // guest order tracking link
  city: T.STRING(120), courier_city_id: T.STRING(20),
  is_cod: { type: T.BOOLEAN, defaultValue: false },
  subtotal: { type: T.DECIMAL(12, 2), defaultValue: 0 },
  discount: { type: T.DECIMAL(12, 2), defaultValue: 0 },
  delivery_charges: { type: T.DECIMAL(12, 2), defaultValue: 0 },
  cod_charges: { type: T.DECIMAL(12, 2), defaultValue: 0 },
  customer_note: T.TEXT, admin_note: T.TEXT,
  // design
  design_type: { type: T.STRING(20), defaultValue: 'standard' }, // standard | ai | upload | custom_code
  design_file: T.STRING(255), design_front: T.STRING(255), design_back: T.STRING(255), design_prompt: T.TEXT,
  // courier
  courier: T.STRING(30), tracking_number: T.STRING(60), courier_slip: T.STRING(500),
  courier_status: T.STRING(120), courier_status_at: T.DATE, courier_history: json('courier_history', []),
  courier_charges: { type: T.DECIMAL(12, 2), defaultValue: 0 },
  cod_settled: { type: T.BOOLEAN, defaultValue: false },
  // inventory + workflow
  stock_vendor_id: T.INTEGER, stock_consumed: { type: T.BOOLEAN, defaultValue: false },
  cost_amount: { type: T.DECIMAL(12, 2), defaultValue: 0 },
  status_history: json('status_history', []),
  dispatched_at: T.DATE, delivered_at: T.DATE,
  // admin orders
  fulfilment: { type: T.STRING(20), defaultValue: 'delivery' }, // delivery (courier) | collection (customer collects at the office)
  order_source_id: T.INTEGER, // where the order came from (Orders > Order sources)
  created_by: T.INTEGER, // staff member who created the order
  guest_customer_id: T.INTEGER, // walk-in / non-account customer (Guest customers)
  organisation_id: T.INTEGER, // order placed for an organisation (owner user id); user_id is the contact person
  discount_type: T.STRING(10), // fixed | percent
  discount_value: { type: T.DECIMAL(12, 2), defaultValue: 0 },
  // order type: nfc_profile | social | wholesale | sample | printing | digital
  order_type: { type: T.STRING(20), defaultValue: 'nfc_profile' },
  social_variant: T.STRING(20), // static | dynamic | profile (for the social / review card type)
  parent_order_id: T.INTEGER, // wholesale order placed after this sample order
  sample_credit: { type: T.DECIMAL(12, 2), defaultValue: 0 }, // sample charge deducted from the bulk order
  plan_credit: { type: T.DECIMAL(12, 2), defaultValue: 0 }, // plan upgrades: unused time of the current plan, deducted from the price
  plan_applied_at: T.DATE, // renewal orders: when the paid plan was added to the customer's subscription
});
NfcOrder.belongsTo(User, { foreignKey: 'user_id' }); User.hasMany(NfcOrder, { foreignKey: 'user_id' });
NfcOrder.belongsTo(User, { as: 'creator', foreignKey: 'created_by', constraints: false });
NfcCard.belongsTo(Plan, { as: 'plan', foreignKey: 'plan_id', constraints: false });
NfcOrder.belongsTo(Vcard, { foreignKey: 'vcard_id' }); NfcOrder.belongsTo(NfcCard, { foreignKey: 'nfc_card_id' });
NfcOrder.belongsTo(Transaction, { foreignKey: 'transaction_id' });

/* ----------------------------------------------------------- affiliation */
const AffiliateUser = sequelize.define('affiliate_user', {
  amount: { type: T.DECIMAL(12, 2), defaultValue: 0 },
  is_verified: { type: T.BOOLEAN, defaultValue: false },
  status: { type: T.ENUM('pending', 'approved', 'rejected'), defaultValue: 'pending' },
});
AffiliateUser.belongsTo(User, { as: 'affiliator', foreignKey: 'affiliated_by' });
AffiliateUser.belongsTo(User, { as: 'referred', foreignKey: 'user_id' });

const Withdrawal = sequelize.define('withdrawal', {
  email: T.STRING(191),
  bank_details: T.TEXT,
  amount: { type: T.DECIMAL(12, 2), allowNull: false },
  status: { type: T.ENUM('pending', 'approved', 'rejected'), defaultValue: 'pending' },
  rejection_note: T.TEXT,
  paid_by: T.STRING(30),
});
Withdrawal.belongsTo(User, { foreignKey: 'user_id' }); User.hasMany(Withdrawal, { foreignKey: 'user_id' });

/* ------------------------------------------------------------ front CMS */
const Setting = sequelize.define('setting', {
  key: { type: T.STRING(100), allowNull: false, unique: true },
  value: T.TEXT('long'),
});
const Feature = sequelize.define('feature', {
  title: { type: T.STRING(150), allowNull: false },
  description: T.TEXT,
  image: T.STRING(255),
});
const AboutUs = sequelize.define('about_us', {
  title: { type: T.STRING(150), allowNull: false },
  description: T.TEXT,
  image: T.STRING(255),
}, { tableName: 'about_us' });
const FrontTestimonial = sequelize.define('front_testimonial', {
  name: { type: T.STRING(120), allowNull: false },
  designation: T.STRING(120),
  description: T.TEXT,
  image: T.STRING(255),
});
const FrontFaq = sequelize.define('front_faq', {
  title: { type: T.STRING(255), allowNull: false },
  description: T.TEXT,
});
const Enquiry = sequelize.define('enquiry', {
  name: { type: T.STRING(120), allowNull: false },
  email: { type: T.STRING(191), allowNull: false },
  subject: T.STRING(255),
  message: T.TEXT,
});
const EmailSubscription = sequelize.define('email_subscription', {
  email: { type: T.STRING(191), allowNull: false, unique: true },
});
const SentEmail = sequelize.define('sent_email', {
  subject: { type: T.STRING(255), allowNull: false },
  description: T.TEXT,
  recipients: json('recipients', []),
  status: { type: T.STRING(20), defaultValue: 'sent' },
});
SentEmail.belongsTo(User, { as: 'sender', foreignKey: 'sender_id' });

const FrontBlog = sequelize.define('front_blog', {
  title: { type: T.STRING(200), allowNull: false },
  slug: { type: T.STRING(200), allowNull: false, unique: true },
  excerpt: T.STRING(500),
  content: T.TEXT('long'),
  image: T.STRING(255),
  status: { type: T.BOOLEAN, defaultValue: true },
});

/* ------------------------------------------------------- WhatsApp store */
const WhatsappStore = sequelize.define('whatsapp_store', {
  name: { type: T.STRING(150), allowNull: false },
  url_alias: { type: T.STRING(80), allowNull: false, unique: true },
  slogan: T.STRING(255),
  whatsapp_number: { type: T.STRING(30), allowNull: false },
  region_code: T.STRING(8),
  email: T.STRING(191),
  address: T.STRING(500),
  logo: T.STRING(255),
  cover_image: T.STRING(255),
  youtube_banner: T.STRING(255),
  template: { type: T.STRING(40), defaultValue: 'modern' },
  theme: json('theme', {}),
  currency_code: { type: T.STRING(10), defaultValue: 'USD' },
  currency_icon: { type: T.STRING(10), defaultValue: '$' },
  announcement: T.STRING(500),
  delivery_enabled: { type: T.BOOLEAN, defaultValue: true },
  takeaway_enabled: { type: T.BOOLEAN, defaultValue: true },
  delivery_charge: { type: T.DECIMAL(12, 2), defaultValue: 0 },
  business_hours: json('business_hours', {}),
  terms: T.TEXT, privacy: T.TEXT, refund_policy: T.TEXT, shipping_policy: T.TEXT,
  site_title: T.STRING(150), meta_description: T.STRING(500),
  views: { type: T.INTEGER, defaultValue: 0 },
  status: { type: T.BOOLEAN, defaultValue: true },
  business_directory: { type: T.BOOLEAN, defaultValue: false },
});
WhatsappStore.belongsTo(User, { foreignKey: 'user_id' }); User.hasMany(WhatsappStore, { foreignKey: 'user_id' });
const StoreCategory = sequelize.define('store_category', {
  name: { type: T.STRING(120), allowNull: false },
  image: T.STRING(255),
  sort: { type: T.INTEGER, defaultValue: 0 },
});
const StoreProduct = sequelize.define('store_product', {
  name: { type: T.STRING(150), allowNull: false },
  description: T.TEXT,
  price: { type: T.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
  sale_price: T.DECIMAL(12, 2),
  images: json('images', []),
  stock: T.INTEGER, // null = unlimited
  sort: { type: T.INTEGER, defaultValue: 0 },
  status: { type: T.BOOLEAN, defaultValue: true },
});
const StoreOrder = sequelize.define('store_order', {
  order_number: { type: T.STRING(30), unique: true },
  customer_name: { type: T.STRING(120), allowNull: false },
  customer_phone: { type: T.STRING(30), allowNull: false },
  customer_address: T.TEXT,
  delivery_type: { type: T.STRING(20), defaultValue: 'delivery' }, // delivery | takeaway
  items: json('items', []),
  subtotal: { type: T.DECIMAL(12, 2), defaultValue: 0 },
  delivery_charge: { type: T.DECIMAL(12, 2), defaultValue: 0 },
  total: { type: T.DECIMAL(12, 2), defaultValue: 0 },
  notes: T.TEXT,
  status: { type: T.STRING(20), defaultValue: 'pending' }, // pending | confirmed | dispatched | delivered | cancelled
});
for (const M of [StoreCategory, StoreProduct, StoreOrder]) {
  WhatsappStore.hasMany(M, { foreignKey: 'store_id', onDelete: 'CASCADE' }); M.belongsTo(WhatsappStore, { foreignKey: 'store_id' });
}
StoreCategory.hasMany(StoreProduct, { foreignKey: 'category_id' }); StoreProduct.belongsTo(StoreCategory, { foreignKey: 'category_id' });

const business = require('./business')(sequelize, json, { User, Vcard, NfcCard, NfcOrder, WhatsappStore, Transaction, Plan });

module.exports = {
  sequelize, PLAN_FEATURES, STAFF_ROLES, COMPANY_ROLES, ...business,
  User, Organisation, Currency, Country, State, City, Language, Template, Plan, CouponCode, Transaction, Subscription,
  Vcard, VcardService, VcardGallery, VcardTestimonial, VcardEnquiry, VcardView, VcardProduct, Appointment, VcardBlog, VcardPage, VcardSubscriber,
  FrontBlog, WhatsappStore, StoreCategory, StoreProduct, StoreOrder,
  NfcCard, NfcOrder, AffiliateUser, Withdrawal,
  Setting, Feature, AboutUs, FrontTestimonial, FrontFaq, Enquiry, EmailSubscription, SentEmail,
};
