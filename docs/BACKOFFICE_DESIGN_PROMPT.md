Redesign this portal's entire admin/backoffice UI with the design system below. Keep every existing feature, route, API call, field name and permission working — change only the presentation layer. Do not use Bootstrap/Adminor/MUI/Ant or any ready-made admin template. If the project is React, use Tailwind CSS v4 + Radix UI primitives + Motion (motion/react) + Lucide icons + Sonner toasts + Recharts; on another stack, reproduce the same look with its equivalents.

## 1. Look & feel
Modern, calm, premium SaaS dashboard (Linear / Vercel / Stripe quality). Lots of whitespace, soft rounded surfaces, subtle shadows, one strong violet brand colour, a lime accent used sparingly, smooth micro-animations everywhere, full light AND dark mode.

## 2. Design tokens (CSS variables, OKLCH)
Light (:root):
--background oklch(0.985 0.004 280) · --foreground oklch(0.21 0.025 280) · --card oklch(1 0 0)
--muted oklch(0.962 0.008 280) · --muted-foreground oklch(0.53 0.025 280)
--border oklch(0.915 0.012 280) · --input oklch(0.9 0.014 280) · --ring oklch(0.58 0.22 283)
--primary oklch(0.56 0.235 283) (violet) · --primary-foreground white · --primary-soft oklch(0.95 0.035 283)
--accent oklch(0.91 0.2 122) (lime) · --success oklch(0.63 0.16 155) · --warning oklch(0.72 0.16 70)
--danger oklch(0.6 0.22 25) · --info oklch(0.62 0.15 240), each with a "-soft" tint (L≈0.95, low chroma) for badges/backgrounds
--sidebar oklch(0.995 0.002 280)
Dark (.dark class on <html>):
--background oklch(0.145 0.018 280) · --foreground oklch(0.95 0.008 280) · --card oklch(0.185 0.02 280)
--muted oklch(0.225 0.022 280) · --muted-foreground oklch(0.7 0.02 280) · --border oklch(0.28 0.025 280)
--primary oklch(0.66 0.2 283) · --primary-soft oklch(0.3 0.08 283) · soft tints at L≈0.3 · --sidebar oklch(0.165 0.02 280)
Shadows: soft = 0 1px 2px hsl(250 40% 40% / .06), 0 4px 16px -4px hsl(250 40% 40% / .08);
lift = 0 2px 4px …/.06, 0 18px 40px -12px …/.22; glow = 0 10px 40px -10px var(--primary).
Radius: inputs/buttons 12px (rounded-xl), cards 18–24px (rounded-2xl/3xl), pills fully rounded.
Never hard-code colours in components — always use the tokens, so dark mode works automatically.

## 3. Typography
Body: Inter (400/500/600), font-feature-settings "cv11","ss01", antialiased. Headings / numbers: "Bricolage Grotesque" (600–800), tight tracking (-0.02em).
Scale: page title 24–30px bold; card title 15–16px semibold; body 14px; table/meta 13px; labels 12px medium; eyebrow 11px uppercase letter-spacing .12em muted.

## 4. Layout shell
- Left sidebar 268px (collapsible to 76px icon rail with a spring animation, state remembered in localStorage), bg --sidebar, right border. Logo at top, menu grouped under small uppercase group labels (Overview, Sales, Finance, Inventory, Management, Revenue, Configuration). Items: 40px tall, 12px radius, icon 18px + label; active item = primary-soft background with a sliding "active pill" (Motion layoutId) + primary icon; nested items expand with an animated height and a left border line. Collapsed rail shows tooltips. User/plan card at the bottom.
- Mobile (<1024px): sidebar becomes a slide-in sheet opened from a hamburger.
- Top bar: sticky, 64px, glassmorphism (bg-background/70 + backdrop-blur + bottom border). Left: current group + page name. Center: search button that opens a ⌘K / Ctrl K command palette (cmdk) listing every menu page. Right: primary quick action, notifications bell with unread badge (shake animation when unread), "view website", animated light/dark toggle (icon rotates/slides), avatar menu (profile, security, logout).
- Content: max-width 1440px, padding 16px mobile / 32px desktop. Every page starts with a PageHeader: optional eyebrow, title, one-line description, actions aligned right (wrap on mobile).
- Page transition: enter-only fade + 10px rise (0.3s, ease [0.16,1,0.3,1]); never wait for the old page to leave.

## 5. Components (build once, reuse everywhere)
- Button: variants primary (violet, white text, subtle glow on hover), secondary, outline, ghost, soft (primary-soft), danger, danger-soft, white; sizes xs 28 / sm 32 / md 40 / lg 48 / icon 36 / icon-sm 32; loading state with spinner; icons 16px inside with 8px gap.
- Input / Textarea / Select (Radix): 40px, rounded-xl, border --input, bg card, focus = primary border + 4px primary/15 ring; optional left icon and right suffix; error state red border + message under the field.
- Field wrapper: label (12–13px medium, red * when required), control, hint (muted 12px) or error.
- Switch (Radix) and SwitchRow (title + description + switch inside a bordered rounded-2xl row), Checkbox, Segmented control (pill group with a sliding active background), ColorInput, ImageUpload (drag & drop, preview, round variant), rich-text editor (Tiptap) with a compact toolbar.
- Card: rounded-2xl/3xl, bg card, border, shadow-soft; hover variant lifts (-translate-y-0.5 + shadow-lift). CardHeader = icon tile (40px, primary-soft, rounded-xl) + title + description + actions; CardBody p-5.
- StatCard / KPI: gradient icon tile (violet→indigo, pink, emerald, amber, sky, rose), label, big display-font number with a count-up animation, hint line, optional link; staggered entrance.
- Badge: pill, 12px, soft tones (neutral, primary, success, warning, danger, info, outline) with optional dot. StatusBadge maps statuses to tones automatically (paid/active/delivered = success, pending = warning, processing/shipped = info, cancelled/rejected/overdue = danger…).
- TableCard + DataTable: card with title, toolbar (search input, filter selects, bulk actions) and a clean table: header row bg-muted/40 with 11–12px uppercase muted labels; rows 56px, dividers, hover bg-muted/40, rows fade/slide in with a tiny stagger; optional checkbox selection column; row actions as 32px icon buttons with tooltips (view, edit = info tone, delete = danger tone) aligned right; skeleton rows while loading; illustrated EmptyState (icon in soft circle, title, text, CTA); pagination in the footer. Tables scroll horizontally inside the card on mobile, never the page.
- Dialog (Radix): centered, rounded-3xl, max 90vh, icon tile + title + description header, scrollable body, footer with Cancel + primary action; sizes sm/md/lg/xl; scale+fade in, blurred dark overlay.
- Confirm dialog helper for deletes (danger button, "This can't be undone").
- Dropdown menus: rounded-2xl card, shadow-lift, pop animation.
- Tooltips: glass dark surface with a thin violet→pink gradient border, 12px text, arrow, 200ms delay, short directional slide-in; rich variant with title + description + keyboard hint; inverted light surface in dark mode. Every icon-only button must have a tooltip.
- Toasts (Sonner): top-right, rounded-2xl, rich colours; every save/delete shows success or the server error.
- Tabs inside pages: vertical nav card on the left (desktop) with a sliding active pill, horizontal scroll chips on mobile; settings pages end with a sticky glass save bar ("Changes apply immediately after saving" + Save button).
- Charts (Recharts): smooth area chart with gradient fill for trends, rounded bars, donut with centre label; brand palette violet, pink, emerald, amber, sky, red; soft grid, no heavy axes, custom rounded tooltip.
- Status stepper for workflows: row of 44px rounded-2xl icon tiles connected by lines, completed = primary with glow, current slightly scaled, clickable with tooltips showing date/user.
- Announcement banner: full-width gradient card (by type), icon tile, title + one-line text, dismiss button.
- Skeletons: shimmering rounded blocks matching the final layout for every loading state.

## 6. Motion rules
Use Motion for: page enter, card/list stagger (≤0.03s per item, capped), dialog/sheet/popover open, sidebar collapse (spring stiffness 300 damping 32), active-tab pill (layoutId), number count-up, hover lift on cards, icon toggles. Durations 150–350ms, ease [0.16, 1, 0.3, 1]. Respect prefers-reduced-motion. Animations must never delay content or block clicks.

## 7. Quality rules
- Mobile first: works at 375px with no horizontal page scroll; grids collapse 4 → 2 → 1; toolbars wrap.
- Accessible: visible focus rings (2px ring colour), labels for every input, aria-labels on icon buttons, contrast AA in both themes.
- Every screen has loading, empty, error and success states.
- Consistent spacing scale (4px base; cards gap 16–24px; sections 24px).
- Money, dates and numbers formatted consistently (e.g. "Rs 12,500", "26 Sep 2026").
- Dark mode toggle persists (localStorage) and respects the system preference on first visit.

Deliver: the shared UI kit first (tokens, layout shell, components), then migrate every page to it, then verify each page at 375px and 1440px in light and dark mode.
