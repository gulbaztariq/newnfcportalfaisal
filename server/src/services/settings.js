const { Setting } = require('../models');

/** Every configurable key with its default value. Secrets are never sent to the browser in public payloads. */
const DEFAULTS = {
  // general
  app_name: 'NFC Profile', email: 'support@example.com', phone: '', region_code: '1', address: '',
  app_logo: '/brand/logo-mark.svg', dashboard_logo: '/brand/logo-mark.svg',
  favicon: '/brand/favicon.svg', default_country_code: 'us', default_language: 'en',
  default_currency_id: '', affiliation_amount: '10', affiliation_amount_type: 'fixed', min_withdrawal_amount: '50',
  register_enable: '1', hide_decimal_values: '0', currency_after_amount: '0', mobile_validation: '0',
  // payments (enabled flags + credentials)
  stripe_enable: '0', stripe_key: '', stripe_secret: '',
  paypal_enable: '0', paypal_client_id: '', paypal_secret: '', paypal_mode: 'sandbox',
  razorpay_enable: '0', razorpay_key: '', razorpay_secret: '',
  flutterwave_enable: '0', flutterwave_key: '', flutterwave_secret: '',
  paystack_enable: '0', paystack_key: '', paystack_secret: '',
  phonepe_enable: '0', phonepe_merchant_id: '', phonepe_salt_key: '', phonepe_salt_index: '', phonepe_env: 'UAT',
  manual_payment_enable: '1', manual_payment_guide: '<p>Transfer the amount to our bank account and upload the receipt.</p>',
  // front CMS
  front_theme: '1', banner_enable: '1', banner_title: 'Create your Digital Business Card',
  banner_description: 'Share your contact details with a tap, a scan or a link.', banner_url: '/register', banner_button: 'Get Started',
  home_title: 'Digital Business Cards for Everyone', home_sub_text: 'Build a beautiful vCard in minutes and share it with an NFC card, QR code or link.',
  home_image: '', mobile_app_play_store_url: '', mobile_app_app_store_url: '',
  facebook_url: '', twitter_url: '', instagram_url: '', linkedin_url: '',
  // legal
  terms_conditions: '<p>Terms &amp; Conditions.</p>', privacy_policy: '<p>Privacy Policy.</p>',
  // google / seo
  site_title: 'NFC Profile', meta_keyword: 'vcard, nfc, digital business card', meta_description: 'Digital business card builder',
  google_analytics: '',
  // more payment gateways
  mercadopago_enable: '0', mercadopago_public_key: '', mercadopago_access_token: '',
  cashfree_enable: '0', cashfree_app_id: '', cashfree_secret: '', cashfree_mode: 'sandbox',
  sslcommerz_enable: '0', sslcommerz_store_id: '', sslcommerz_store_password: '', sslcommerz_mode: 'sandbox',
  payfast_enable: '0', payfast_merchant_id: '', payfast_merchant_key: '', payfast_passphrase: '', payfast_mode: 'sandbox',
  iyzico_enable: '0', iyzico_api_key: '', iyzico_secret: '', iyzico_mode: 'sandbox',
  // mail server (SMTP)
  mail_host: '', mail_port: '587', mail_username: '', mail_password: '', mail_encryption: 'tls', mail_from_address: '', mail_from_name: '',
  // integrations & security
  slack_enable: '0', slack_webhook_url: '', slack_events: 'user_registered,payment,nfc_order,store_order,appointment',
  recaptcha_enable: '0', recaptcha_site_key: '', recaptcha_secret: '', recaptcha_min_score: '0.5',
  google_login_enable: '0', google_client_id: '',
  email_verification_enable: '0', blocked_email_domains: '', expiry_reminder_days: '3',
  ai_enable: '0', anthropic_api_key: '',
  // regional
  timezone: 'UTC', date_format: 'DD MMM YYYY', time_format: '24',
  // tax on NFC orders
  nfc_tax_name: '', nfc_tax_rate: '0',
  // front site extras
  home_custom_css: '', home_whatsapp_number: '', newsletter_popup_enable: '0', business_directory_enable: '1', front_blog_enable: '1',
  // shop / checkout
  shop_enable: '1', shop_currency_code: 'PKR', shop_currency_icon: 'Rs', delivery_charges: '149', free_delivery_above: '0', dummy_email_domain: '',
  cod_enable: '1', cod_charges: '0', online_payment_enable: '1', shop_min_order: '0', shop_ai_design_enable: '1', shop_upload_design_enable: '1',
  // wholesale + samples
  wholesale_tiers: '[{"min":25,"percent":10},{"min":50,"percent":15},{"min":100,"percent":20},{"min":250,"percent":25}]',
  sample_markup_percent: '50', sample_max_qty: '5', sample_credit_enable: '1',
  // courier: Leopards
  leopards_enable: '0', leopards_mode: 'production', leopards_base_url: '', leopards_api_key: '', leopards_api_password: '',
  leopards_origin_city: 'self', leopards_shipper_id: '', leopards_shipper_name: '', leopards_shipper_phone: '', leopards_shipper_email: '',
  leopards_shipper_address: '', leopards_default_weight: '200', leopards_shipment_type: 'overnight', leopards_instructions: 'Handle with care',
  leopards_auto_sync: '1',
  // WhatsApp + SMS
  whatsapp_enable: '0', whatsapp_provider: 'meta', whatsapp_phone_number_id: '', whatsapp_access_token: '', whatsapp_api_version: 'v21.0',
  whatsapp_template_language: 'en', whatsapp_http_url: '', whatsapp_http_method: 'POST', whatsapp_http_body: '', whatsapp_http_headers: '',
  sms_enable: '0', sms_provider: 'http', sms_http_url: '', sms_http_method: 'GET', sms_http_body: '', sms_http_headers: '',
  phone_default_region: '92', twilio_sid: '', twilio_token: '', twilio_sms_from: '', twilio_whatsapp_from: '', notify_admin_numbers: '',
  // invoices
  invoice_prefix: 'INV-', invoice_next_number: '1', invoice_number_padding: '5', invoice_template: 'modern', invoice_accent: '',
  invoice_company_name: '', invoice_company_address: '', invoice_company_phone: '', invoice_company_email: '', invoice_tax_id: '',
  invoice_logo: '', invoice_bank_details: '', invoice_notes: 'Thank you for your business!', invoice_terms: '', invoice_footer: '',
  invoice_due_days: '7', invoice_auto_orders: '1', invoice_auto_subscriptions: '1',
  // security
  login_otp_enable: '0', enforce_2fa_staff: '1', max_login_attempts: '5', lockout_minutes: '15',
  // default vCard for new users
  default_vcard_enable: '1', default_vcard_template: 'vcard1',
};
const SECRET_KEYS = ['stripe_secret', 'paypal_secret', 'razorpay_secret', 'flutterwave_secret', 'paystack_secret', 'phonepe_salt_key',
  'mercadopago_access_token', 'cashfree_secret', 'sslcommerz_store_password', 'payfast_passphrase', 'iyzico_secret', 'mail_password',
  'slack_webhook_url', 'recaptcha_secret', 'anthropic_api_key', 'leopards_api_password', 'whatsapp_access_token', 'twilio_token'];
const PUBLIC_KEYS = [
  'app_name', 'email', 'phone', 'region_code', 'address', 'app_logo', 'dashboard_logo', 'favicon', 'default_country_code',
  'default_language', 'register_enable', 'front_theme', 'banner_enable', 'banner_title', 'banner_description', 'banner_url',
  'banner_button', 'home_title', 'home_sub_text', 'home_image', 'mobile_app_play_store_url', 'mobile_app_app_store_url',
  'facebook_url', 'twitter_url', 'instagram_url', 'linkedin_url', 'site_title', 'meta_keyword', 'meta_description',
  'stripe_enable', 'paypal_enable', 'razorpay_enable', 'flutterwave_enable', 'paystack_enable', 'phonepe_enable',
  'manual_payment_enable', 'manual_payment_guide', 'hide_decimal_values', 'currency_after_amount', 'min_withdrawal_amount',
  'mercadopago_enable', 'cashfree_enable', 'sslcommerz_enable', 'payfast_enable', 'iyzico_enable',
  'recaptcha_enable', 'recaptcha_site_key', 'google_login_enable', 'google_client_id', 'ai_enable', 'date_format', 'time_format', 'timezone',
  'home_whatsapp_number', 'home_custom_css', 'newsletter_popup_enable', 'business_directory_enable', 'front_blog_enable', 'email_verification_enable', 'nfc_tax_name', 'nfc_tax_rate',
  'shop_enable', 'shop_currency_code', 'shop_currency_icon', 'delivery_charges', 'free_delivery_above', 'cod_enable', 'cod_charges', 'online_payment_enable',
  'shop_min_order', 'shop_ai_design_enable', 'shop_upload_design_enable', 'login_otp_enable',
];
const isTemplateKey = (k) => /^mail_tpl_[a-z_]+_(subject|body)$/.test(k) || /^(msg_tpl|wa_tpl)_[a-z_]+$/.test(k) || /^notify_[a-z_]+_(whatsapp|sms)$/.test(k);

let cache = null;
async function all() {
  if (cache) return cache;
  const rows = await Setting.findAll();
  cache = { ...DEFAULTS };
  for (const r of rows) cache[r.key] = r.value ?? '';
  return cache;
}
async function get(key) { return (await all())[key]; }
async function set(values) {
  for (const [key, value] of Object.entries(values)) {
    if (!(key in DEFAULTS) && !isTemplateKey(key)) continue; // ignore unknown keys
    await Setting.upsert({ key, value: value === null || value === undefined ? '' : String(value) });
  }
  cache = null;
  return all();
}
async function publicSettings() {
  const s = await all();
  const out = PUBLIC_KEYS.reduce((o, k) => ((o[k] = s[k]), o), {});
  out.app_url = require('../config').appUrl;
  out.home_custom_css = String(s.home_custom_css || '').replace(/<\/?style[^>]*>/gi, '');
  return out;
}
/** Admin view: secrets are masked, the admin can overwrite but never read them back. */
async function adminSettings() {
  const s = { ...(await all()) };
  for (const k of SECRET_KEYS) s[k] = s[k] ? '********' : '';
  return s;
}

const clearCache = () => { cache = null; };

module.exports = { DEFAULTS, SECRET_KEYS, all, get, set, publicSettings, adminSettings, clearCache };
