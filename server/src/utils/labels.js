/* Shared labels + invoice builders */
const FEATURE_LABELS = {
  products_services: 'Services', products: 'Products', appointments: 'Appointments', testimonials: 'Testimonials', gallery: 'Gallery',
  social_links: 'Social links', custom_links: 'Custom links', enquiry_form: 'Enquiry form', payment_links: 'Payment links',
  instagram_embed: 'Instagram embed', linkedin_embed: 'LinkedIn embed', iframes: 'iFrames', blog: 'Blog', custom_pages: 'Custom pages',
  newsletter: 'Newsletter popup', pwa: 'Install as app (PWA)', virtual_background: 'Virtual background', analytics: 'Analytics', seo: 'SEO',
  password: 'Password protection', hide_branding: 'Hide branding', custom_css: 'Custom CSS', custom_fonts: 'Custom fonts',
  custom_qrcode: 'Custom QR code', allow_custom_domain: 'Custom domain', business_directory: 'Business directory listing',
  whatsapp_store: 'WhatsApp store', ai_tools: 'AI writing tools', organisation: 'Organisation / team', affiliation: 'Affiliation', nfc_cards: 'NFC cards',
  url_shortener: 'Dynamic links & QR', custom_code: 'Own code design (HTML/JS)',
};

function transactionInvoice(t) {
  const plan = t.subscription?.plan;
  const tax = Number(t.tax_amount || t.meta?.tax || 0);
  const discount = Number(t.meta?.discount || t.subscription?.discount || 0);
  const total = Number(t.amount);
  const subtotal = total - tax + discount;
  return {
    number: String(t.id).padStart(6, '0'), date: t.created_at, status: t.status, method: t.type,
    billTo: { name: t.user ? `${t.user.first_name} ${t.user.last_name}` : '', email: t.user?.email },
    items: [{ description: plan ? `${plan.name} plan subscription` : t.purpose === 'nfc_order' ? 'NFC card order' : 'Payment', qty: 1, price: subtotal }],
    subtotal, discount, taxName: plan?.tax_name, taxAmount: tax, total, currency: plan?.currency?.currency_icon || '$',
  };
}

function nfcInvoice(o) {
  const tax = Number(o.tax_amount || 0);
  const sub = Number(o.unit_price) * o.quantity;
  return {
    number: o.order_number, date: o.created_at, status: o.payment_status, method: o.payment_type,
    billTo: { name: o.name, email: o.email, address: [o.company_name, o.address, o.phone].filter(Boolean).join('\n') },
    items: [{ description: o.nfc_card?.name || 'NFC card', qty: o.quantity, price: Number(o.unit_price) }],
    subtotal: sub, discount: 0, taxName: 'Tax', taxAmount: tax, total: Number(o.amount), currency: '$',
  };
}

module.exports = { FEATURE_LABELS, transactionInvoice, nfcInvoice };
