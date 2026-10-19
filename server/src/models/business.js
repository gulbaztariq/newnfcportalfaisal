/*
 * Business modules: shop orders, short links, invoices, finance, inventory, vendors, messaging, announcements, audit log.
 * Defined in their own file to keep models/index.js readable; registered from models/index.js.
 */
const { DataTypes: T } = require('sequelize');

module.exports = function defineBusiness(sequelize, json, M) {
  const { User, Vcard, NfcCard, NfcOrder, WhatsappStore, Transaction, Plan } = M;
  const money = () => ({ type: T.DECIMAL(14, 2), defaultValue: 0 });

  /* ------------------------------------------------ order line items (shop + portal) */
  const NfcOrderItem = sequelize.define('nfc_order_item', {
    name: { type: T.STRING(150), allowNull: false },
    variant: T.STRING(80),
    quantity: { type: T.INTEGER, defaultValue: 1 },
    unit_price: money(),
    customization: { type: T.BOOLEAN, defaultValue: false },
    customization_price: money(),
    total: money(),
    unit_cost: money(), // cost snapshot (materials + printing) used for profit analytics
  });
  NfcOrder.hasMany(NfcOrderItem, { as: 'items', foreignKey: 'nfc_order_id', onDelete: 'CASCADE' }); NfcOrderItem.belongsTo(NfcOrder, { foreignKey: 'nfc_order_id' });
  NfcOrderItem.belongsTo(NfcCard, { as: 'product', foreignKey: 'nfc_card_id' });

  /* ------------------------------------------------ order sources (websites, marketplaces, social pages ...) */
  const OrderSource = sequelize.define('order_source', {
    name: { type: T.STRING(100), allowNull: false },
    url: T.STRING(255),
    status: { type: T.BOOLEAN, defaultValue: true },
    platform: T.STRING(20), // detected on the first sync: woocommerce | shopify
    last_synced_at: T.DATE,
    sync_message: T.STRING(255),
  });
  NfcOrder.belongsTo(OrderSource, { as: 'order_source', foreignKey: 'order_source_id', constraints: false });

  /* ------------------------------------------------ guest customers (orders without an account, mostly non-plan products) */
  const GuestCustomer = sequelize.define('guest_customer', {
    name: { type: T.STRING(120), allowNull: false },
    phone: T.STRING(30),
    phone_key: T.STRING(15), // last 10 digits, to recognise returning guests
    email: T.STRING(191),
    company_name: T.STRING(150),
    address: T.TEXT,
    city: T.STRING(120),
    notes: T.TEXT,
  });
  NfcOrder.belongsTo(GuestCustomer, { as: 'guest', foreignKey: 'guest_customer_id', constraints: false });
  GuestCustomer.hasMany(NfcOrder, { as: 'orders', foreignKey: 'guest_customer_id', constraints: false });
  NfcOrder.belongsTo(User, { as: 'organisation', foreignKey: 'organisation_id', constraints: false });

  /* ------------------------------------------------ organisation journey (timeline shown to the super admin) */
  const OrganisationEvent = sequelize.define('organisation_event', {
    owner_id: { type: T.INTEGER, allowNull: false }, // the organisation (owner user id)
    actor_id: T.INTEGER,
    actor_name: T.STRING(150), // kept even if the user is deleted later
    actor_kind: T.STRING(20), // staff | owner | manager | supervisor | member | system
    type: { type: T.STRING(40), allowNull: false },
    message: { type: T.STRING(500), allowNull: false },
    meta: json('meta', {}),
  }, { updatedAt: false, indexes: [{ fields: ['owner_id', 'created_at'] }] });

  /* ------------------------------------------------ dynamic short links / redirects */
  const ShortLink = sequelize.define('short_link', {
    code: { type: T.STRING(40), allowNull: false, unique: true },
    title: T.STRING(150),
    target_type: { type: T.STRING(20), defaultValue: 'url' }, // url | vcard | store | unassigned
    target_url: T.STRING(1000),
    clicks: { type: T.INTEGER, defaultValue: 0 },
    last_clicked_at: T.DATE,
    status: { type: T.BOOLEAN, defaultValue: true },
    batch: T.STRING(60), // bulk generated batch name (pre-printed tags)
    note: T.STRING(500),
    locked: { type: T.BOOLEAN, defaultValue: false }, // only admins can change the target
  });
  ShortLink.belongsTo(User, { foreignKey: 'user_id' }); User.hasMany(ShortLink, { foreignKey: 'user_id' });
  ShortLink.belongsTo(Vcard, { foreignKey: 'vcard_id' }); Vcard.hasMany(ShortLink, { foreignKey: 'vcard_id' });
  ShortLink.belongsTo(WhatsappStore, { foreignKey: 'store_id' });
  ShortLink.belongsTo(NfcOrder, { foreignKey: 'nfc_order_id' });
  const ShortLinkClick = sequelize.define('short_link_click', {
    device: T.STRING(20), browser: T.STRING(40), os: T.STRING(40), referrer: T.STRING(255), country: T.STRING(8), ip_hash: T.STRING(64),
  }, { updatedAt: false });
  ShortLink.hasMany(ShortLinkClick, { foreignKey: 'short_link_id', onDelete: 'CASCADE' }); ShortLinkClick.belongsTo(ShortLink, { foreignKey: 'short_link_id' });

  /* ------------------------------------------------ invoices */
  const Invoice = sequelize.define('invoice', {
    number: { type: T.STRING(40), allowNull: false, unique: true },
    token: { type: T.STRING(64), allowNull: false, unique: true }, // public share link
    type: { type: T.STRING(20), defaultValue: 'manual' }, // manual | order | subscription
    customer_name: { type: T.STRING(150), allowNull: false },
    customer_email: T.STRING(191),
    customer_phone: T.STRING(30),
    customer_address: T.TEXT,
    customer_company: T.STRING(150),
    items: json('items', []), // [{description, quantity, unit_price, total}]
    subtotal: money(), discount: money(), tax_name: T.STRING(60), tax_rate: { type: T.DECIMAL(6, 2), defaultValue: 0 }, tax_amount: money(),
    delivery_charges: money(), total: money(), paid_amount: money(),
    currency_code: { type: T.STRING(10), defaultValue: 'PKR' }, currency_icon: { type: T.STRING(10), defaultValue: 'Rs' },
    status: { type: T.STRING(20), defaultValue: 'draft' }, // draft | sent | partial | paid | overdue | cancelled
    issue_date: T.DATEONLY, due_date: T.DATEONLY,
    template: { type: T.STRING(30), defaultValue: 'modern' },
    notes: T.TEXT, terms: T.TEXT,
    sent_at: T.DATE,
  });
  Invoice.belongsTo(NfcOrder, { foreignKey: 'nfc_order_id' }); NfcOrder.hasOne(Invoice, { foreignKey: 'nfc_order_id' });
  Invoice.belongsTo(Transaction, { foreignKey: 'transaction_id' });
  Invoice.belongsTo(User, { foreignKey: 'user_id' });
  Invoice.belongsTo(User, { as: 'creator', foreignKey: 'created_by' });
  const InvoicePayment = sequelize.define('invoice_payment', {
    amount: { type: T.DECIMAL(14, 2), allowNull: false }, date: T.DATEONLY, method: T.STRING(40), reference: T.STRING(120), note: T.STRING(500),
  });
  Invoice.hasMany(InvoicePayment, { as: 'payments', foreignKey: 'invoice_id', onDelete: 'CASCADE' }); InvoicePayment.belongsTo(Invoice, { foreignKey: 'invoice_id' });

  /* ------------------------------------------------ finance */
  const FinanceAccount = sequelize.define('finance_account', {
    name: { type: T.STRING(120), allowNull: false }, type: { type: T.STRING(20), defaultValue: 'cash' }, // cash | bank | wallet
    opening_balance: money(), note: T.STRING(500), status: { type: T.BOOLEAN, defaultValue: true },
  });
  const Partner = sequelize.define('partner', {
    name: { type: T.STRING(120), allowNull: false }, email: T.STRING(191), phone: T.STRING(30),
    share_percent: { type: T.DECIMAL(6, 2), defaultValue: 0 }, note: T.STRING(500), status: { type: T.BOOLEAN, defaultValue: true },
  });
  Partner.belongsTo(User, { foreignKey: 'user_id' });
  const FinanceCategory = sequelize.define('finance_category', {
    name: { type: T.STRING(120), allowNull: false }, type: { type: T.STRING(10), defaultValue: 'expense' }, // expense | income
  });
  /** Manual income / expense entries (expenses with receipts, partner who paid, account) */
  const FinanceEntry = sequelize.define('finance_entry', {
    type: { type: T.STRING(10), allowNull: false, defaultValue: 'expense' }, // expense | income
    date: { type: T.DATEONLY, allowNull: false },
    title: { type: T.STRING(200), allowNull: false },
    category: T.STRING(120),
    amount: { type: T.DECIMAL(14, 2), allowNull: false },
    payment_method: T.STRING(40),
    reference: T.STRING(120),
    description: T.TEXT,
    attachment: T.STRING(255), // bill screenshot / receipt
    status: { type: T.STRING(20), defaultValue: 'paid' }, // paid | unpaid
  });
  FinanceEntry.belongsTo(FinanceAccount, { as: 'account', foreignKey: 'account_id' });
  FinanceEntry.belongsTo(Partner, { as: 'partner', foreignKey: 'partner_id' });
  FinanceEntry.belongsTo(User, { as: 'creator', foreignKey: 'created_by' });

  /* ------------------------------------------------ vendors, inventory, purchases */
  const Vendor = sequelize.define('vendor', {
    name: { type: T.STRING(150), allowNull: false },
    type: { type: T.STRING(20), defaultValue: 'printing' }, // printing | supplier | courier | other
    contact_person: T.STRING(120), phone: T.STRING(30), email: T.STRING(191), address: T.TEXT,
    rates: json('rates', []), // [{label, rate, unit}] e.g. PVC card printing 35 / pc
    opening_balance: money(), notes: T.TEXT, status: { type: T.BOOLEAN, defaultValue: true },
  });
  Vendor.hasMany(FinanceEntry, { foreignKey: 'vendor_id' }); FinanceEntry.belongsTo(Vendor, { foreignKey: 'vendor_id' });

  const InventoryItem = sequelize.define('inventory_item', {
    name: { type: T.STRING(150), allowNull: false },
    sku: { type: T.STRING(60), unique: true },
    category: { type: T.STRING(40), defaultValue: 'other' },
    unit: { type: T.STRING(20), defaultValue: 'pcs' },
    purchase_price: money(), // weighted average landed cost
    sale_price: money(),
    reorder_level: { type: T.INTEGER, defaultValue: 0 },
    description: T.TEXT,
    status: { type: T.BOOLEAN, defaultValue: true },
  });
  const ProductComponent = sequelize.define('product_component', { quantity: { type: T.DECIMAL(10, 3), defaultValue: 1 } });
  NfcCard.hasMany(ProductComponent, { as: 'components', foreignKey: 'nfc_card_id', onDelete: 'CASCADE' }); ProductComponent.belongsTo(NfcCard, { foreignKey: 'nfc_card_id' });
  ProductComponent.belongsTo(InventoryItem, { as: 'item', foreignKey: 'inventory_item_id' }); InventoryItem.hasMany(ProductComponent, { foreignKey: 'inventory_item_id' });

  const Purchase = sequelize.define('purchase', {
    supplier_name: T.STRING(150), invoice_no: T.STRING(80), date: { type: T.DATEONLY, allowNull: false },
    is_import: { type: T.BOOLEAN, defaultValue: false },
    origin_country: T.STRING(80), currency: { type: T.STRING(10), defaultValue: 'PKR' }, exchange_rate: { type: T.DECIMAL(14, 4), defaultValue: 1 },
    items: json('items', []), // [{inventory_item_id, name, quantity, unit_price (in purchase currency)}]
    shipping_cost: money(), customs_duty: money(), clearing_charges: money(), other_charges: money(),
    subtotal: money(), total: money(), // PKR, landed
    paid_amount: money(), attachment: T.STRING(255), note: T.TEXT,
  });
  Purchase.belongsTo(Vendor, { as: 'supplier', foreignKey: 'supplier_id' });
  Purchase.belongsTo(Vendor, { as: 'location', foreignKey: 'location_vendor_id' }); // where the stock is kept (null = main store)
  Purchase.belongsTo(FinanceAccount, { as: 'account', foreignKey: 'account_id' });
  Purchase.belongsTo(Partner, { as: 'partner', foreignKey: 'partner_id' });

  const StockMovement = sequelize.define('stock_movement', {
    type: { type: T.STRING(20), allowNull: false }, // purchase | transfer_in | transfer_out | sale | adjustment | return | damage | opening
    quantity: { type: T.DECIMAL(12, 3), allowNull: false }, // signed
    unit_cost: money(),
    date: { type: T.DATEONLY, allowNull: false },
    reference: T.STRING(120), note: T.STRING(500),
  });
  StockMovement.belongsTo(InventoryItem, { as: 'item', foreignKey: 'inventory_item_id' }); InventoryItem.hasMany(StockMovement, { as: 'movements', foreignKey: 'inventory_item_id', onDelete: 'CASCADE' });
  StockMovement.belongsTo(Vendor, { as: 'location', foreignKey: 'vendor_id' }); // null = main store / office
  StockMovement.belongsTo(Purchase, { foreignKey: 'purchase_id' }); Purchase.hasMany(StockMovement, { foreignKey: 'purchase_id', onDelete: 'CASCADE' });
  StockMovement.belongsTo(NfcOrder, { foreignKey: 'nfc_order_id' });
  StockMovement.belongsTo(User, { as: 'creator', foreignKey: 'created_by' });

  const VendorBill = sequelize.define('vendor_bill', {
    bill_no: T.STRING(80), date: { type: T.DATEONLY, allowNull: false }, due_date: T.DATEONLY,
    amount: { type: T.DECIMAL(14, 2), allowNull: false },
    category: { type: T.STRING(20), defaultValue: 'printing' }, // printing (already part of product cost) | other (operating expense)
    items: json('items', []), description: T.TEXT, attachment: T.STRING(255),
  });
  Vendor.hasMany(VendorBill, { as: 'bills', foreignKey: 'vendor_id', onDelete: 'CASCADE' }); VendorBill.belongsTo(Vendor, { foreignKey: 'vendor_id' });
  const VendorPayment = sequelize.define('vendor_payment', {
    amount: { type: T.DECIMAL(14, 2), allowNull: false }, date: { type: T.DATEONLY, allowNull: false },
    method: T.STRING(40), reference: T.STRING(120), attachment: T.STRING(255), note: T.STRING(500),
  });
  Vendor.hasMany(VendorPayment, { as: 'payments', foreignKey: 'vendor_id', onDelete: 'CASCADE' }); VendorPayment.belongsTo(Vendor, { foreignKey: 'vendor_id' });
  VendorPayment.belongsTo(VendorBill, { foreignKey: 'vendor_bill_id' });
  VendorPayment.belongsTo(FinanceAccount, { as: 'account', foreignKey: 'account_id' });
  VendorPayment.belongsTo(Partner, { as: 'partner', foreignKey: 'partner_id' });

  /* ------------------------------------------------ courier (Leopards) COD settlements */
  const CourierSettlement = sequelize.define('courier_settlement', {
    courier: { type: T.STRING(30), defaultValue: 'leopards' },
    date: { type: T.DATEONLY, allowNull: false }, reference: T.STRING(120),
    cod_amount: money(), charges: money(), net_amount: money(),
    tracking_numbers: json('tracking_numbers', []), note: T.STRING(500), attachment: T.STRING(255),
  });
  CourierSettlement.belongsTo(FinanceAccount, { as: 'account', foreignKey: 'account_id' });

  /* ------------------------------------------------ WhatsApp / SMS log */
  const MessageLog = sequelize.define('message_log', {
    channel: { type: T.STRING(20), allowNull: false }, // whatsapp | sms
    to: { type: T.STRING(40), allowNull: false },
    event: T.STRING(60), body: T.TEXT,
    status: { type: T.STRING(20), defaultValue: 'queued' }, // sent | failed | skipped
    error: T.STRING(500),
  });
  MessageLog.belongsTo(NfcOrder, { foreignKey: 'nfc_order_id' });

  /* ------------------------------------------------ announcements */
  const Announcement = sequelize.define('announcement', {
    title: { type: T.STRING(200), allowNull: false },
    body: T.TEXT('long'),
    type: { type: T.STRING(20), defaultValue: 'info' }, // info | success | warning | danger | promo
    audience: { type: T.STRING(20), defaultValue: 'all' }, // all | users | staff | plan | organisation
    organisation_id: T.INTEGER, // audience 'organisation': owner id of the organisation that posted it
    starts_at: T.DATE, ends_at: T.DATE,
    pinned: { type: T.BOOLEAN, defaultValue: false },
    send_email: { type: T.BOOLEAN, defaultValue: false },
    emailed_at: T.DATE,
    link_url: T.STRING(500), link_label: T.STRING(60),
    status: { type: T.BOOLEAN, defaultValue: true },
  });
  Announcement.belongsTo(Plan, { foreignKey: 'plan_id' });
  Announcement.belongsTo(User, { as: 'creator', foreignKey: 'created_by' });
  const AnnouncementRead = sequelize.define('announcement_read', {}, { updatedAt: false });
  Announcement.hasMany(AnnouncementRead, { as: 'reads', foreignKey: 'announcement_id', onDelete: 'CASCADE' }); AnnouncementRead.belongsTo(Announcement, { foreignKey: 'announcement_id' });
  AnnouncementRead.belongsTo(User, { foreignKey: 'user_id' });

  /* ------------------------------------------------ audit log */
  const ActivityLog = sequelize.define('activity_log', {
    action: { type: T.STRING(80), allowNull: false }, entity: T.STRING(60), entity_id: T.INTEGER,
    ip: T.STRING(64), user_agent: T.STRING(255), meta: json('meta', {}),
  }, { updatedAt: false });
  ActivityLog.belongsTo(User, { foreignKey: 'user_id' });

  return {
    NfcOrderItem, ShortLink, ShortLinkClick, Invoice, InvoicePayment, FinanceAccount, Partner, FinanceCategory, FinanceEntry,
    Vendor, InventoryItem, ProductComponent, Purchase, StockMovement, VendorBill, VendorPayment, CourierSettlement,
    GuestCustomer, OrganisationEvent,
    OrderSource,
    MessageLog, Announcement, AnnouncementRead, ActivityLog,
  };
};
