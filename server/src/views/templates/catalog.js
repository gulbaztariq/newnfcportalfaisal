/**
 * vCard template catalogue. `layout` selects the structural design (see styles.js), the rest are the
 * default design tokens copied into a new vCard; users can change every colour/font afterwards.
 * Every font used here must also be listed in GOOGLE_FONTS (render.js).
 */
const F = {
  inter: "'Inter', system-ui, sans-serif",
  poppins: "'Poppins', system-ui, sans-serif",
  playfair: "'Playfair Display', Georgia, serif",
  montserrat: "'Montserrat', system-ui, sans-serif",
  lora: "'Lora', Georgia, serif",
  space: "'Space Grotesk', system-ui, sans-serif",
  dmsans: "'DM Sans', system-ui, sans-serif",
  outfit: "'Outfit', system-ui, sans-serif",
  jakarta: "'Plus Jakarta Sans', system-ui, sans-serif",
  manrope: "'Manrope', system-ui, sans-serif",
  cormorant: "'Cormorant Garamond', Georgia, serif",
  fraunces: "'Fraunces', Georgia, serif",
  sora: "'Sora', system-ui, sans-serif",
  syne: "'Syne', system-ui, sans-serif",
  jetbrains: "'JetBrains Mono', ui-monospace, monospace",
  plexmono: "'IBM Plex Mono', ui-monospace, monospace",
  nunito: "'Nunito', system-ui, sans-serif",
  quicksand: "'Quicksand', system-ui, sans-serif",
  bricolage: "'Bricolage Grotesque', system-ui, sans-serif",
  archivo: "'Archivo', system-ui, sans-serif",
  baskerville: "'Libre Baskerville', Georgia, serif",
  urbanist: "'Urbanist', system-ui, sans-serif",
  rubik: "'Rubik', system-ui, sans-serif",
  lexend: "'Lexend', system-ui, sans-serif",
  plex: "'IBM Plex Sans', system-ui, sans-serif",
  figtree: "'Figtree', system-ui, sans-serif",
  barlow: "'Barlow', system-ui, sans-serif",
  bitter: "'Bitter', Georgia, serif",
  bodoni: "'Bodoni Moda', Georgia, serif",
  unbounded: "'Unbounded', system-ui, sans-serif",
  chakra: "'Chakra Petch', system-ui, sans-serif",
  garamond: "'EB Garamond', Georgia, serif",
  amiri: "'Amiri', Georgia, serif",
  franklin: "'Libre Franklin', system-ui, sans-serif",
  baloo: "'Baloo 2', system-ui, sans-serif",
};

const SOCIAL_LAYOUTS = new Set(['story', 'beat', 'flash', 'channel', 'xfeed', 'network', 'pinboard', 'groove', 'stream', 'chat', 'plane', 'thread']);

// business layouts that get the labelled Call / WhatsApp / Directions / Save bar at the bottom of the screen
const BAR_LAYOUTS = new Set(['local', 'shopfront', 'clinic', 'estate', 'bistro', 'boardroom']);

// link-card layouts (linkcards.js): socials and custom links become rich cards, hours chip in the header
const LINK_LAYOUTS = new Set(['lkember', 'lkmidnight', 'lkglass', 'lkmint', 'lkcream', 'lkneon', 'lkroyal', 'lksunset', 'lkmono', 'lkcandy']);
// signature collection (signature.js): designs with their own page structure, category, description and default design
const SIGNATURE_LAYOUTS = Object.keys(require('./signature').ARCH);
const CATEGORIES = ['Minimal', 'Luxury', 'Corporate', 'Professional', 'Creative', 'Influencer', 'Technology', 'Healthcare', 'Real Estate', 'Hospitality', 'Personal Branding'];
const META = {};
/** signature template: catalogue entry plus its gallery metadata. `extra` holds default custom options (see custom.js). */
const S = (slug, name, profession, layout, category, description, [primary, secondary, background, text], font, extra = {}) => {
  META[slug] = { category, description, version: 1, collection: 'signature', is_new: true };
  return { slug, name, profession, layout, defaults: { primary, secondary, background, text, font, ...extra } };
};
/** category of an older template, derived from its layout and profession */
function categoryOf(t) {
  if (META[t.slug]) return META[t.slug].category;
  const p = t.profession || '';
  if (/^(Social|Link Cards)/.test(p) || /Influencer|Creator|YouTuber|Streamer|Podcaster/.test(p)) return 'Influencer';
  if (/Doctor|Dentist|Nurse|Pharmac|Surgeon|Optomet|Physio|Psycholog|Nutrition|Veterinar|Clinic|Health|Wellness/.test(p)) return 'Healthcare';
  if (/Real Estate|Property/.test(p)) return 'Real Estate';
  if (/Hotel|Restaurant|Chef|Cafe|Baker|Travel|Tour|Events/.test(p)) return 'Hospitality';
  if (['luxe', 'metal', 'marble', 'monogram', 'boardroom'].includes(t.layout)) return 'Luxury';
  if (['minimal', 'mono', 'swiss', 'paper'].includes(t.layout)) return 'Minimal';
  if (['neon', 'glass', 'holo', 'bento', 'saas'].includes(t.layout) || /Developer|Engineer|Data|Cyber|Crypto|Tech|Gamer/.test(p)) return 'Technology';
  if (/Designer|Artist|Photograph|Musician|DJ|Actor|Model|Author|Tattoo|Makeup|Agency|Fashion|Architect/.test(p)) return 'Creative';
  if (/Personal Brand|Coach|Speaker|Performer|Politician|General/.test(p)) return 'Personal Branding';
  if (/^Business|CEO|Executive|Banker|Accountant|Logistics|Sales|Insurance|Recruiter|HR|Marketing|Financial/.test(p)) return 'Corporate';
  return 'Professional';
}
/** gallery metadata for any template slug */
// designs the gallery lists first (the Tap profile family)
const FEATURED = new Set(Array.from({ length: 10 }, (_, i) => `vcard${171 + i}`));
const metaOf = (t) => ({ featured: FEATURED.has(t.slug), category: categoryOf(t), description: META[t.slug]?.description || '', version: META[t.slug]?.version || 1, collection: META[t.slug]?.collection || 'classic', is_new: !!META[t.slug]?.is_new });

const T = (slug, name, profession, layout, primary, secondary, background, text, font) => ({ slug, name, profession, layout, defaults: { primary, secondary, background, text, font } });

module.exports = {
  FONTS: F,
  SOCIAL_LAYOUTS,
  BAR_LAYOUTS,
  LINK_LAYOUTS,
  SIGNATURE_LAYOUTS,
  CATEGORIES,
  metaOf,
  LAYOUTS: [
    'classic', 'modern', 'minimal', 'dark', 'card', 'split', 'bold', 'elegant', 'soft', 'corporate',
    'photo', 'glass', 'sidebar', 'editorial', 'brutal', 'mesh', 'mono', 'luxe', 'playful', 'splithero', 'stack', 'neon', 'paper', 'aurora',
    // premium layouts (premium.js)
    'banner', 'wave', 'linkhub', 'breeze', 'cinema', 'metal', 'ticket', 'bento', 'marble', 'swiss', 'duotone', 'monogram', 'timeline', 'retro', 'holo', 'spotlight',
    // social-media layouts (social.js): these also get the floating WhatsApp / call action stack
    ...SOCIAL_LAYOUTS,
    // business layouts (business.js)
    ...LINK_LAYOUTS,
    'agency', 'letterhead', 'saas', 'bizcard', 'local', 'shopfront', 'clinic', 'estate', 'bistro', 'boardroom',
    // signature collection (signature.js)
    ...SIGNATURE_LAYOUTS,
  ],
  TEMPLATES: [
    T('vcard1', 'Code Craft', 'Developer', 'dark', '#22d3ee', '#a78bfa', '#0b1020', '#e2e8f0', F.space),
    T('vcard2', 'Executive', 'Corporate CEO / CXO', 'corporate', '#1e3a8a', '#c9a227', '#f5f7fb', '#1f2937', F.montserrat),
    T('vcard3', 'Counsel', 'Lawyer', 'elegant', '#7c2d12', '#b08d57', '#fbf8f3', '#292524', F.playfair),
    T('vcard4', 'Care Plus', 'Doctor', 'soft', '#0e7490', '#14b8a6', '#f0fdfa', '#134e4a', F.poppins),
    T('vcard5', 'Chef Table', 'Chef', 'bold', '#b91c1c', '#f59e0b', '#fffbeb', '#1c1917', F.poppins),
    T('vcard6', 'Classroom', 'Teacher', 'classic', '#4f46e5', '#f59e0b', '#f8fafc', '#1e293b', F.poppins),
    T('vcard7', 'Lens', 'Photographer', 'photo', '#111827', '#f43f5e', '#ffffff', '#111827', F.montserrat),
    T('vcard8', 'Studio', 'Designer', 'split', '#db2777', '#8b5cf6', '#fdf2f8', '#1f2937', F.space),
    T('vcard9', 'Estate', 'Real Estate Agent', 'modern', '#065f46', '#d4a373', '#f7faf8', '#1f2937', F.montserrat),
    T('vcard11', 'Encore', 'Musician', 'card', '#7c3aed', '#ec4899', '#faf5ff', '#1e1b4b', F.poppins),
    T('vcard12', 'Advisor', 'Consultant', 'minimal', '#0f172a', '#2563eb', '#ffffff', '#0f172a', F.inter),
    T('vcard25', 'Spotlight', 'Influencer', 'aurora', '#e11d48', '#f59e0b', '#fff7f8', '#1f2937', F.poppins),
    T('vcard30', 'Canvas', 'Artist', 'playful', '#9333ea', '#f97316', '#fefce8', '#27272a', F.bricolage),
    T('vcard32', 'Pixel', 'Photographer / Videographer', 'neon', '#f43f5e', '#38bdf8', '#0b0710', '#fafafa', F.space),

    /* ---------- professions ---------- */
    T('vcard35', 'Headline', 'Journalist', 'editorial', '#b91c1c', '#1f2937', '#faf8f4', '#141414', F.fraunces),
    T('vcard36', 'Stack Trace', 'Software Engineer', 'mono', '#059669', '#0ea5e9', '#ffffff', '#0a0a0a', F.jetbrains),
    T('vcard37', 'Insight', 'Data Scientist', 'mesh', '#6366f1', '#06b6d4', '#f7f8fc', '#0f172a', F.sora),
    T('vcard40', 'Skyrise', 'Property Developer', 'splithero', '#1f2937', '#c8a15a', '#f7f5f0', '#1c1917', F.manrope),
    T('vcard41', 'Interiors', 'Interior Designer', 'sidebar', '#8a6f5a', '#c9a27e', '#faf7f2', '#2b2520', F.cormorant),
    T('vcard43', 'Bespoke', 'Tailor', 'paper', '#1e3a5f', '#b45309', '#f6f1e7', '#1f2937', F.baskerville),
    T('vcard44', 'Fade', 'Barber', 'brutal', '#111111', '#ef4444', '#fde047', '#111111', F.archivo),
    T('vcard45', 'Blush', 'Makeup Artist', 'glass', '#f472b6', '#a78bfa', '#1b1027', '#fdf4ff', F.poppins),
    T('vcard57', 'Sparkle', 'Cleaning Services', 'stack', '#0ea5e9', '#22c55e', '#f3faff', '#0c4a6e', F.rubik),
    T('vcard58', 'Chauffeur', 'Chauffeur / Driver', 'luxe', '#c9a45c', '#e8d8a8', '#0b0b0c', '#f5f1e8', F.cormorant),

    /* ---------- general purpose ---------- */

    /* ---------- premium designs ---------- */
    T('vcard93', 'Banner', 'Business Professional', 'banner', '#2563eb', '#0ea5e9', '#ffffff', '#0f172a', F.jakarta),
    T('vcard94', 'Tide', 'Consultant / Sales', 'wave', '#0f766e', '#5eead4', '#f7fbfa', '#0f2a2a', F.manrope),
    T('vcard95', 'Linkhub', 'Creator / Influencer', 'linkhub', '#7c3aed', '#ec4899', '#ffffff', '#1f1235', F.outfit),
    T('vcard96', 'Breeze', 'Wellness / Coach', 'breeze', '#f472b6', '#60a5fa', '#fbfaff', '#1e1b3a', F.urbanist),
    T('vcard97', 'Cinema', 'Personal Brand / Model', 'cinema', '#111111', '#f5c26b', '#fafafa', '#0a0a0a', F.sora),
    T('vcard98', 'Titanium', 'Executive / Director', 'metal', '#9ca3af', '#d4af37', '#0c0c0e', '#ececf0', F.montserrat),
    T('vcard99', 'Boarding Pass', 'Travel / Events', 'ticket', '#1d4ed8', '#f59e0b', '#f4f6fb', '#0f172a', F.space),
    T('vcard100', 'Bento', 'Product / Tech', 'bento', '#4f46e5', '#f97316', '#f6f6f9', '#111827', F.figtree),
    T('vcard101', 'Marble', 'Luxury / Bridal / Jewellery', 'marble', '#b08d57', '#7a6a58', '#f7f4ef', '#2b2520', F.cormorant),
    T('vcard102', 'Helvetica', 'Architect / Designer', 'swiss', '#e11d1d', '#111111', '#ffffff', '#111111', F.archivo),
    T('vcard103', 'Duotone', 'Photographer / Artist', 'duotone', '#ff3d7f', '#2b2bff', '#ffffff', '#111111', F.syne),
    T('vcard104', 'Monogram', 'Lawyer / Advocate', 'monogram', '#1f3a2e', '#b8975a', '#fbf8f1', '#1c2420', F.baskerville),
    T('vcard105', 'Journey', 'Coach / Speaker', 'timeline', '#0ea5e9', '#8b5cf6', '#ffffff', '#0f172a', F.lexend),
    T('vcard106', 'Groovy', 'Cafe / Creative Studio', 'retro', '#e4572e', '#f3a712', '#fdf3e1', '#2b1d0e', F.bricolage),
    T('vcard107', 'Prism', 'Tech / Web3 / Creative', 'holo', '#a78bfa', '#22d3ee', '#0d0b1a', '#f1efff', F.space),
    T('vcard108', 'Spotlight', 'Performer / Speaker', 'spotlight', '#fbbf24', '#f97316', '#09090b', '#fafafa', F.playfair),

    /* ---------- social media ---------- */
    T('vcard109', 'Story', 'Social: Instagram creator', 'story', '#e1306c', '#f58529', '#ffffff', '#171717', F.jakarta),
    T('vcard110', 'Beat', 'Social: TikTok creator', 'beat', '#25f4ee', '#fe2c55', '#0a0a0c', '#fafafa', F.sora),
    T('vcard111', 'Flash', 'Social: Snapchat creator', 'flash', '#fffc00', '#111111', '#fffc00', '#111111', F.nunito),
    T('vcard112', 'Channel', 'Social: YouTube channel', 'channel', '#ff0033', '#111111', '#ffffff', '#0f0f0f', F.archivo),
    T('vcard113', 'Feed', 'Social: X / Twitter', 'xfeed', '#1d9bf0', '#0f1419', '#ffffff', '#0f1419', F.inter),
    T('vcard114', 'Network', 'Social: LinkedIn professional', 'network', '#0a66c2', '#378fe9', '#f4f2ee', '#191919', F.figtree),
    T('vcard115', 'Pinboard', 'Social: Pinterest / Lifestyle', 'pinboard', '#e60023', '#f4c2c2', '#fbf7f4', '#211922', F.urbanist),
    T('vcard116', 'Groove', 'Social: Musician / Spotify', 'groove', '#1ed760', '#b3b3b3', '#121212', '#ffffff', F.montserrat),
    T('vcard117', 'Stream', 'Social: Twitch / Gamer', 'stream', '#9146ff', '#00e5a0', '#0e0e10', '#efeff1', F.chakra),
    T('vcard118', 'Chat', 'Social: WhatsApp business', 'chat', '#128c7e', '#25d366', '#efe7dd', '#111b21', F.dmsans),
    T('vcard119', 'Paper Plane', 'Social: Telegram channel', 'plane', '#2aabee', '#229ed9', '#eef6fb', '#10202b', F.manrope),
    T('vcard120', 'Thread', 'Social: Threads / Minimal', 'thread', '#101010', '#8e8e93', '#fafafa', '#101010', F.plex),

    /* ---------- business ---------- */
    T('vcard121', 'Studio Bold', 'Business: Creative Agency', 'agency', '#ff4d00', '#111111', '#ffffff', '#111111', F.archivo),
    T('vcard122', 'Letterhead', 'Business: Law / Accounting Firm', 'letterhead', '#1b2f4b', '#8a6d3b', '#fcfbf8', '#1c2330', F.baskerville),
    T('vcard123', 'Product', 'Business: SaaS / Startup', 'saas', '#5b5bf0', '#22d3ee', '#ffffff', '#0b1020', F.jakarta),
    T('vcard124', 'Card', 'Business: Sales / Networking', 'bizcard', '#0f766e', '#0ea5e9', '#ffffff', '#0f172a', F.dmsans),
    T('vcard125', 'Local', 'Business: Shop / Local Services', 'local', '#e11d48', '#f59e0b', '#ffffff', '#1c1917', F.poppins),
    T('vcard126', 'Storefront', 'Business: Online Store / Retail', 'shopfront', '#7c3aed', '#f472b6', '#faf9ff', '#1e1b3a', F.outfit),
    T('vcard127', 'Wellness', 'Business: Clinic / Healthcare', 'clinic', '#0891b2', '#34d399', '#ffffff', '#0b2a33', F.nunito),
    T('vcard128', 'Estate Pro', 'Business: Real Estate Agency', 'estate', '#0f2742', '#c9a24b', '#ffffff', '#0f172a', F.manrope),
    T('vcard129', 'Table', 'Business: Restaurant / Hotel', 'bistro', '#3b1d12', '#d9a441', '#18110d', '#f6ede0', F.cormorant),
    T('vcard130', 'Boardroom', 'Business: Executive / Director', 'boardroom', '#1f2937', '#c9a24b', '#0f1115', '#eceae4', F.fraunces),

    /* ---------- link cards (link-in-bio with rich cards) ---------- */
    T('vcard131', 'Ember', 'Link Cards: Restaurant / Food', 'lkember', '#f59e0b', '#ef4444', '#0b0b0d', '#f5f5f5', F.jakarta),
    T('vcard132', 'Midnight', 'Link Cards: Creator / Brand', 'lkmidnight', '#818cf8', '#38bdf8', '#090b16', '#eef0ff', F.sora),
    T('vcard133', 'Frost', 'Link Cards: Lifestyle / Beauty', 'lkglass', '#f472b6', '#a78bfa', '#16102b', '#fdf4ff', F.urbanist),
    T('vcard134', 'Mint', 'Link Cards: Health / Wellness', 'lkmint', '#10b981', '#06b6d4', '#f1faf6', '#0b2a22', F.nunito),
    T('vcard135', 'Cream', 'Link Cards: Cafe / Bakery', 'lkcream', '#b45309', '#d97706', '#fbf5ea', '#2b1b0e', F.fraunces),
    T('vcard136', 'Volt', 'Link Cards: Gaming / Tech', 'lkneon', '#a3e635', '#22d3ee', '#050607', '#f4fff0', F.chakra),
    T('vcard137', 'Royal', 'Link Cards: Luxury / Jewellery', 'lkroyal', '#d4af37', '#f3e5ab', '#0a0a0a', '#f6f0e0', F.cormorant),
    T('vcard138', 'Dusk', 'Link Cards: Events / Music', 'lksunset', '#fb7185', '#f59e0b', '#2a0f2e', '#fff4f0', F.outfit),
    T('vcard139', 'Line', 'Link Cards: Consultant / Minimal', 'lkmono', '#111111', '#6b7280', '#ffffff', '#111111', F.inter),
    T('vcard140', 'Candy', 'Link Cards: Kids / Fun Shop', 'lkcandy', '#ec4899', '#8b5cf6', '#fff5fa', '#3b0a2a', F.baloo),

    /* ---------- signature collection: each design has its own page structure (signature.js) ---------- */
    S('vcard141', 'Obsidian Luxury', 'Signature: Luxury', 'sxcard', 'Luxury', 'A black metal card with gold foil. It tilts as you move and flips over when tapped.', ['#d4af37', '#f4e3a8', '#08080a', '#f4efe2'], F.cormorant),
    S('vcard142', 'Designer Portfolio', 'Signature: Creative', 'sxsheet', 'Creative', 'Your photo fills the screen. Content slides up in a sheet with tabs and a floating save bar.', ['#c93216', '#111111', '#ffffff', '#111111'], F.sora),
    S('vcard143', 'Material Motion', 'Signature: Technology', 'sxbento', 'Technology', 'A grid of tiles in the Material Design 3 style. Photo, name, actions and socials are all tiles that change shape.', ['#6750a4', '#7d5260', '#fffbfe', '#1c1b1f'], "'Roboto', system-ui, sans-serif"),
    S('vcard144', 'Mono Elegance', 'Signature: Minimal', 'sxeditorial', 'Minimal', 'A black and white magazine cover: a huge name, a moving ticker and swipeable galleries.', ['#e11d48', '#525252', '#ffffff', '#0a0a0a'], F.inter, { name_font: F.bodoni, heading_font: F.bodoni }),
    S('vcard145', 'Royal Executive', 'Signature: Corporate', 'sxpass', 'Corporate', 'A navy and gold wallet pass with a tear-off stub. Sections fold open like a stack of passes.', ['#12284f', '#c9a24b', '#ffffff', '#101b33'], F.manrope, { name_font: F.playfair }),
    S('vcard146', 'Neon Future', 'Signature: Technology', 'sxorbit', 'Technology', 'A glowing control panel. Your social icons orbit your photo.', ['#22d3ee', '#f0abfc', '#05060d', '#eaf6ff'], F.chakra),

    /* minimal & modern */
    S('vcard147', 'Aura Minimal', 'Signature: Minimal', 'sxindex', 'Minimal', 'Pure typography: one statement, a table of contact rows and sections that open on hairlines.', ['#2563eb', '#6b7280', '#ffffff', '#111827'], F.inter),
    S('vcard148', 'Nordic White', 'Signature: Minimal', 'sxarch', 'Minimal', 'An arched portrait on a shelf, soft pill buttons and a chip bar that jumps between sections.', ['#5c6b5e', '#d8cfc0', '#f7f4ee', '#2c2f2b'], F.dmsans, { name_font: F.fraunces }),
    S('vcard149', 'Soft Gradient', 'Signature: Minimal', 'sxwave', 'Minimal', 'A soft colour wash, a photo that slowly changes shape and an app-style bar with a raised save button.', ['#4f46e5', '#ec4899', '#fbfbff', '#1e1b4b'], F.jakarta),
    S('vcard150', 'Essential Pro', 'Signature: Professional', 'sxcontact', 'Professional', 'Looks like the contact screen on a phone: square action buttons and grouped lists.', ['#0062cc', '#34c759', '#ffffff', '#111111'], F.inter),

    /* luxury & premium */
    S('vcard151', 'Platinum Elite', 'Signature: Luxury', 'sxdeck', 'Luxury', 'A brushed platinum card, with every section as a slide you swipe sideways.', ['#4b5563', '#9ca3af', '#f3f4f7', '#1b2030'], F.montserrat),
    S('vcard152', 'Midnight Gold', 'Signature: Luxury', 'sxspot', 'Luxury', 'A dark stage: a beam of gold light on your portrait and engraved gold lettering.', ['#e0b663', '#f3dca6', '#0b0b10', '#f3efe6'], F.cormorant),
    S('vcard153', 'Signature Black', 'Signature: Luxury', 'sxsign', 'Luxury', 'A wide black and white photo, and your name written like a signature that draws itself.', ['#c8a96a', '#e8d9b5', '#0b0b0c', '#f2efe9'], F.manrope, { name_font: F.playfair, heading_font: F.playfair }),

    /* corporate & professional */
    S('vcard154', 'Corporate Executive', 'Signature: Corporate', 'sxrail', 'Corporate', 'A full-height colour rail holds the company name and actions; the content sits beside it.', ['#0f3d68', '#e5a823', '#ffffff', '#0f1e2e'], F.plex),
    S('vcard155', 'Business Elite', 'Signature: Corporate', 'sxdash', 'Corporate', 'A business dashboard with a figures strip and two large call buttons.', ['#1d4ed8', '#f59e0b', '#ffffff', '#0f172a'], F.jakarta),
    S('vcard156', 'Consultant Pro', 'Signature: Professional', 'sxtimeline', 'Professional', 'Your sections hang on a numbered line that fills as visitors scroll.', ['#0f766e', '#14b8a6', '#fbfdfc', '#102a27'], F.manrope),
    S('vcard157', 'Legal Professional', 'Signature: Professional', 'sxletter', 'Professional', 'A formal letter: letterhead, your bio as the letter, a signature and numbered contact notes.', ['#1c2b3a', '#7a5f36', '#fdfcf9', '#1c2330'], F.baskerville),
    S('vcard158', 'Medical Professional', 'Signature: Healthcare', 'sxclinic', 'Healthcare', 'Appointment first: an open-now status, a booking card and a call bar that stays on screen.', ['#0e7490', '#10b981', '#ffffff', '#0b2a33'], F.nunito),

    /* creative & personal branding */
    S('vcard159', 'Creative Studio', 'Signature: Creative', 'sxposter', 'Creative', 'A bold poster grid with giant initials, a turning ring of text and sticker buttons.', ['#c2410c', '#ffd23f', '#fffaf2', '#141414'], F.bricolage),
    S('vcard160', 'Influencer Social', 'Signature: Influencer', 'sxstory', 'Influencer', 'A social profile with story bars, a highlight circle for each network and a tight photo grid.', ['#c81e5b', '#f58529', '#ffffff', '#1a1a1a'], F.outfit),
    S('vcard161', 'Personal Brand', 'Signature: Personal Branding', 'sxbrand', 'Personal Branding', 'Your first name in giant outline letters on a colour panel, a pull quote and big paired buttons.', ['#7c3aed', '#f472b6', '#ffffff', '#1c1530'], F.urbanist),
    S('vcard162', 'Artist Signature', 'Signature: Creative', 'sxpolaroid', 'Creative', 'A fan of photo prints that spreads when touched, stamp buttons and taped paper notes.', ['#9f1239', '#e7c9a9', '#f6f1e7', '#221a14'], F.dmsans, { name_font: F.cormorant, heading_font: F.cormorant }),

    /* tech & futuristic */
    S('vcard163', 'Cyber Glass', 'Signature: Technology', 'sxholo', 'Technology', 'A holographic ID badge that hangs from a strap and gently swings.', ['#8b5cf6', '#22d3ee', '#0a0b1a', '#eef0ff'], F.space),
    S('vcard164', 'Digital Matrix', 'Signature: Technology', 'sxterm', 'Technology', 'A terminal window that types out who you are, with numbered shortcuts.', ['#22c55e', '#06b6d4', '#060a08', '#d7fbe6'], F.jetbrains),
    S('vcard165', 'Aurora Tech', 'Signature: Technology', 'sxaurora', 'Technology', 'Moving aurora light, a floating island bar and keycap rows.', ['#34d399', '#818cf8', '#07090f', '#f1f5f9'], F.sora),

    /* specialised */
    S('vcard166', 'Real Estate Pro', 'Signature: Real Estate', 'sxlisting', 'Real Estate', 'A property listing: swipeable photos on top, an agent card and a call bar that stays on screen.', ['#12324a', '#c9a24b', '#ffffff', '#0f1e2a'], F.manrope),
    S('vcard167', 'Sales Champion', 'Signature: Corporate', 'sxchat', 'Corporate', 'A chat conversation: message bubbles, quick-reply buttons and a contact card to save.', ['#be123c', '#f59e0b', '#ffffff', '#111827'], F.outfit),
    S('vcard168', 'Startup Founder', 'Signature: Technology', 'sxpitch', 'Technology', 'A pitch deck: a progress bar, a statement name and sections as numbered slides.', ['#4f46e5', '#06b6d4', '#ffffff', '#0b1020'], F.space),
    S('vcard169', 'Hospitality Elite', 'Signature: Hospitality', 'sxmenu', 'Hospitality', 'A fine-dining menu: photo header, medallion portrait and services listed with dotted leaders.', ['#3a2a1e', '#c8a15a', '#fbf7f0', '#2a2018'], F.dmsans, { name_font: F.cormorant, heading_font: F.cormorant }),
    S('vcard170', 'Modern Glass Premium', 'Signature: Luxury', 'sxglass', 'Luxury', 'Layered glass panes with depth, widgets and a phone-style dock of app icons.', ['#7c3aed', '#06b6d4', '#0d0f1f', '#f5f6ff'], F.jakarta),

    /* tap profile cards: cover photo, round portrait, round actions, a "Connect with me" button and a "My links" sheet of round brand icons (signature5.js) */
    S('vcard171', 'Tap Profile', 'Signature: Personal Branding', 'sxtap', 'Personal Branding', 'The profile you get when a card is tapped on a phone: cover photo, verified badge, three round actions, a black Connect button and a My links sheet of round brand icons.', ['#0a0a0a', '#6b7280', '#eeeeef', '#111111'], F.poppins),
    S('vcard172', 'Tap Midnight', 'Signature: Technology', 'sxtapnight', 'Technology', 'The tap profile in the dark: a deep indigo cover, glass action buttons, a white Connect button and a frosted links sheet.', ['#ffffff', '#818cf8', '#0b0b12', '#f4f4f8'], F.poppins),
    S('vcard173', 'Tap Rings', 'Signature: Creative', 'sxtapring', 'Creative', 'No cover photo: a colour ring turns around your portrait, actions are labelled pills and the links sit in a compact four-column grid.', ['#7c3aed', '#f472b6', '#ffffff', '#1c1530'], F.outfit),
    S('vcard174', 'Tap Full Cover', 'Signature: Influencer', 'sxtapfull', 'Influencer', 'A tall full-width cover photo with one big sheet rising over it that holds your portrait, actions, Connect button and links.', ['#e11d48', '#fb923c', '#ffffff', '#1a1a1a'], F.manrope),
    S('vcard175', 'Tap Wallet', 'Signature: Professional', 'sxtapwallet', 'Professional', 'A colour background with your profile as a floating card, and your links as a row of round icons you swipe sideways.', ['#0f766e', '#99f6e4', '#f0fdfa', '#0b2a27'], F.dmsans),
    S('vcard176', 'Tap List', 'Signature: Corporate', 'sxtaplist', 'Corporate', 'The tap profile with every link as a clean row: a round brand icon, the name and a chevron.', ['#1d4ed8', '#60a5fa', '#f5f7fb', '#0f172a'], F.jakarta),
    S('vcard177', 'Tap Gradient', 'Signature: Creative', 'sxtapgrad', 'Creative', 'A gradient cover that curves away, a rounded-square portrait and links drawn as app icons.', ['#5457ee', '#ec4899', '#fbfbff', '#1e1b4b'], F.jakarta),
    S('vcard178', 'Tap Compact', 'Signature: Minimal', 'sxtapsplit', 'Minimal', 'Compact and quick: portrait and name side by side, actions in one row and links in four columns.', ['#0f172a', '#64748b', '#ffffff', '#0f172a'], F.inter),
    S('vcard179', 'Tap Bold', 'Signature: Influencer', 'sxtapbold', 'Influencer', 'Your name in big letters over the cover photo, outlined round icons and a Connect button that stays at the bottom of the screen.', ['#d63500', '#ffb800', '#fff8f0', '#141414'], F.bricolage),
    S('vcard180', 'Tap Pastel', 'Signature: Personal Branding', 'sxtapsoft', 'Personal Branding', 'Soft pastel colour with a dotted header, a rounded-square portrait and tinted round links on a white sheet.', ['#7c4ddf', '#f9a8d4', '#fdf4ff', '#3b0764'], F.nunito),
  ],
};
