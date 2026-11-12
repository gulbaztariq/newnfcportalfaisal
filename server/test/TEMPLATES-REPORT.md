# Signature templates: test, accessibility and performance report

Scope: the 30 new designs (vcard141 to vcard170), the design studio, the live preview and the template gallery.
Checked on a separate local test database (sqlite in the scratchpad), never the shared Hostinger database.

## Result
- **Automated tests:** 178 of 178 pass (`cd server && npm test`). 70 of them cover templates, the theme schema and the editor preview; 2 cover the order and invoice fixes below.
- **Every design, in the browser** (Chromium, phone 375 px and 320 px, tablet 768 px, desktop 1280 px, landscape 812x375): renders, no horizontal page scroll, every button and link has an accessible name, every image has alt text, gallery lightbox, menu viewer and "Enquire" prefill work, and the design's own interaction works.
- **Contrast:** 1,466 text elements across the 30 designs measured against their real background: all meet WCAG 2.2 AA (4.5:1, or 3:1 for large text). Text drawn over a photo (Designer Portfolio, Hospitality Elite header, Real Estate photo count) sits on a dark overlay and was checked by eye, not measured.
- **Tap targets:** every action, tab, chip and dot is at least 44 x 44 px at 320 px and 375 px width (WCAG 2.2 AA needs 24 px; 44 px is Apple's guideline). Small icons in compact bars get an invisible larger hit area.
- **Reduced motion:** every design honours the phone's "reduce motion" setting (no entrance, ticker, orbit, sheen or swing animation).

## Per design
| Template | Name | Interaction checked | Result | Page size (raw / gzip) | Server render |
|---|---|---|---|---|---|
| vcard141 | Obsidian Luxury | tap flips the card; pointer tilt | Pass | 67 KB / 16.1 KB | 0.11 ms |
| vcard142 | Designer Portfolio | section tabs; floating save bar | Pass | 65 KB / 15.7 KB | 0.08 ms |
| vcard143 | Material Motion | tiles; social tiles | Pass | 64 KB / 15.3 KB | 0.09 ms |
| vcard144 | Mono Elegance | contact index; swipe rows | Pass | 65 KB / 15.7 KB | 0.08 ms |
| vcard145 | Royal Executive | folding sections (one open at a time) | Pass | 65 KB / 15.5 KB | 0.09 ms |
| vcard146 | Neon Future | orbiting social icons | Pass | 65 KB / 15.6 KB | 0.08 ms |
| vcard147 | Aura Minimal | hairline accordions (one open at a time) | Pass | 63 KB / 15.1 KB | 0.07 ms |
| vcard148 | Nordic White | section chips jump to sections | Pass | 63 KB / 15.2 KB | 0.07 ms |
| vcard149 | Soft Gradient | tab bar with raised save | Pass | 62 KB / 15.1 KB | 0.07 ms |
| vcard150 | Essential Pro | grouped contact lists | Pass | 62 KB / 14.9 KB | 0.06 ms |
| vcard151 | Platinum Elite | slide dots centre the slide; dot follows swipe | Pass | 65 KB / 15.7 KB | 0.07 ms |
| vcard152 | Midnight Gold | engraved links | Pass | 62 KB / 15.1 KB | 0.07 ms |
| vcard153 | Signature Black | swipe key row | Pass | 63 KB / 15.3 KB | 0.07 ms |
| vcard154 | Corporate Executive | side rail actions stay on screen | Pass | 62 KB / 15 KB | 0.07 ms |
| vcard155 | Business Elite | figures strip; call buttons | Pass | 63 KB / 15.2 KB | 0.07 ms |
| vcard156 | Consultant Pro | numbered line | Pass | 62 KB / 14.9 KB | 0.07 ms |
| vcard157 | Legal Professional | numbered contact notes | Pass | 63 KB / 15.3 KB | 0.06 ms |
| vcard158 | Medical Professional | booking card; bottom call bar | Pass | 63 KB / 15.3 KB | 0.07 ms |
| vcard159 | Creative Studio | sticker buttons | Pass | 63 KB / 15.3 KB | 0.06 ms |
| vcard160 | Influencer Social | highlight circles | Pass | 62 KB / 15.1 KB | 0.06 ms |
| vcard161 | Personal Brand | paired buttons | Pass | 62 KB / 15 KB | 0.06 ms |
| vcard162 | Artist Signature | tap spreads the photo fan | Pass | 63 KB / 15.3 KB | 0.06 ms |
| vcard163 | Cyber Glass | swinging badge | Pass | 63 KB / 15.3 KB | 0.07 ms |
| vcard164 | Digital Matrix | numbered shortcuts | Pass | 63 KB / 15.3 KB | 0.06 ms |
| vcard165 | Aurora Tech | keycap rows | Pass | 63 KB / 15.2 KB | 0.07 ms |
| vcard166 | Real Estate Pro | photo carousel; bottom call bar | Pass | 63 KB / 15.2 KB | 0.07 ms |
| vcard167 | Sales Champion | quick-reply buttons; contact card | Pass | 63 KB / 15.2 KB | 0.07 ms |
| vcard168 | Startup Founder | progress bar; slides | Pass | 63 KB / 15.1 KB | 0.06 ms |
| vcard169 | Hospitality Elite | dotted service list | Pass | 63 KB / 15.3 KB | 0.07 ms |
| vcard170 | Modern Glass Premium | app-icon dock | Pass | 63 KB / 15.3 KB | 0.06 ms |

Page size is the full HTML for a sample profile with its own CSS inline. Before this work every card carried the CSS of all layouts (about 300 KB raw, 55 KB gzip); now each card carries only its own (about 62 to 67 KB raw, 15 to 16 KB gzip). Render time is server-side only, averaged over 200 renders on the development machine.

## Design studio and gallery (browser, logged in as the seeded test user)
| Check | Result |
|---|---|
| Palette, colours, fine-tuning colours reach the live preview | Pass |
| Size, letter spacing and line height sliders | Pass |
| Heading font picker (real clicks) loads the font in the preview and styles the headings | Pass |
| Weight and alignment choices | Pass |
| Background image upload: saved, served, used on the card; replacing deletes the old file; a fake PNG is refused | Pass |
| Animation choice replays in the preview; other changes do not replay it | Pass |
| Undo, redo, reset to template, undo of the reset | Pass |
| Save stores the theme; public card uses it | Pass |
| Switching template keeps bio and other content; Undo in the toast | Pass |
| Gallery: categories with counts, sorting, favourites, full-screen preview with previous / next | Pass |
| Editor at 1500 px (three columns), 1024 px and 768 px (preview behind a floating button), 375 px (preview sheet) | Pass, no horizontal scroll |

## Defects found in this round and fixed
| # | Severity | Problem | Fix |
|---|---|---|---|
| T1 | Medium | Two studio changes made in quick succession: the first was lost | Studio changes now build on the latest state |
| T2 | Medium | Corporate Executive: on desktop the side rail was taller than the window, the last action was off screen | Rail height accounts for the page margin |
| T3 | Medium | Small grey labels in several designs, and the default main or accent colour of 8 designs, were under 4.5:1 contrast | Darker defaults for 8 designs (Designer Portfolio, Soft Gradient, Essential Pro, Legal Professional, Medical Professional, Creative Studio, Influencer Social, Sales Champion), stronger secondary text in all 30 |
| T4 | Low | Buttons, tabs, chips or dots under 44 px in 16 designs | Larger hit areas |
| T5 | Low | Cyber Glass: white text on its purple buttons was 4.2:1 | Its buttons use a darker shade |
| T6 | Medium | Order numbers have 3 random bytes per day; at about 1,000 orders a day there is roughly a 3% daily chance that a checkout fails on a duplicate number | Order creation retries with a fresh number (up to 5 times) |
| T7 | Low | The very first invoices created at the same moment could both try to create the invoice counter and one would fail | The counter row is created safely before numbering |

## Not checked / limits
- **Real devices:** only Chromium in the desktop app with emulated sizes. Not tested on a real iPhone (Safari), Android phone, Firefox or Samsung Internet.
- **App Clip:** the project has no App Clip setup, so there is nothing to test; cards are plain web pages and need no special browser feature. Scroll-linked effects (Designer Portfolio parallax, Consultant Pro line, Platinum Elite slide scaling, Startup Founder progress bar) are skipped by browsers that lack them; the page still works.
- **Smooth scrolling in this test browser:** the browser pane was hidden, which pauses animation frames, so slide dots and section chips were verified by checking the exact scroll target and state, not by watching the motion.
- **Concurrent invoices:** the fix relies on the database's unique key; the test database (sqlite) cannot run two transactions at once, so only the sequential path is tested.
- **Order-number test failure seen once earlier:** not reproduced in 65 later runs (30 of the plans file, 5 full suites plus earlier ones); one later failure came from two overlapping test runs writing to the same log.
- **Favourites** are stored in the browser only.
- **Not live:** the Railway site still reports "Application not found". The new templates reach the shared database only when the seed runs on deploy.
