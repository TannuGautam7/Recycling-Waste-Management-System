# EcoRecycle Australia: Pre-Polish Audit

Audited commit `d4bb958` before any edits. Every page was read and also loaded in headless Chrome at 375px, 768px and 1280px, with axe-core (WCAG 2 A/AA rules) at 1280px.

Severity: **H** = broken or misleading in a demo, **M** = visibly wrong or incomplete, **L** = polish.

## Fake or broken behaviour

| ID | Sev | Page | Finding |
|---|---|---|---|
| F1 | H | Login | **Any password logs in.** `loginWithAccount` ignores the password. Probe: `nobody@example.com` / `wrong` signed in as Alex Johnson. Any email containing "admin" or "tanu" becomes administrator. |
| F2 | H | Login | Register creates no account. It signs in as Alex and discards the name, email and password. |
| F3 | H | All | No app data persists. Rules, requests and activity are in-memory arrays, so approvals, edits and logged items vanish on refresh or navigation. |
| F4 | H | Waste Search / Dashboard | Citizen request and admin approval cannot work across pages, because the submission never reaches the dashboard. An approved item never reaches public search. |
| F5 | H | Waste Search | Only 6 items are seeded while the home page claims "100+". The "Electronics" chip searches `smartphone` and returns "No item found". |
| F6 | H | Waste Search | The bottom "Submit Item" form only shows a toast and stores nothing. |
| F7 | H | Waste Search | Search returns only the first match, has no suggestions, and the home search bar stays on the home page. |
| F8 | H | Locations | The map is CSS dots with absolutely positioned labels. Pins never respond to filters. |
| F9 | H | Locations | "View Directions" is an `alert()`. "Save Hub" only shows a toast. Saved Hubs on the dashboard is hard-coded. |
| F10 | H | Locations | `?type=E-Waste` links from the guide are ignored. The heading is hard-coded to "4 Found". Waste types Paper and Organics are missing from the filter. Text search matches only name and address, and no hub has a real postcode. |
| F11 | H | Dashboard | Stats (42, 31, 24.5 kg, 86%) are static text. The log modal adds a row but changes no stat, and "6 Logged Entries" is static. |
| F12 | H | Dashboard | Admin Delete does not exist. "Create" hard-codes `recyclable: true`, so every new rule is published as recyclable. Approve does the same, so a battery could be approved as recyclable. |
| F13 | H | Dashboard | "120 Items" and "1,420 Users" are invented numbers. The pending counter updates but the rule counter does not. |
| F14 | M | Dashboard | The "Full Personal Recycling Log" tab has no table. Notification toggles described in the README do not exist. Settings "Save" only shows a toast. |
| F15 | M | Dashboard | All dates are hard-coded to Oct 2026 and "Friday, 10 October" is actually a Saturday. "Next Pickup Tomorrow" is static. Tuesday collection in the README contradicts Friday in the UI. |
| F16 | M | Dashboard | Alex's name, address and account ID are hard-coded in the HTML, so every user sees them. They also appear in the source before the guard runs. |
| F17 | M | Home / Dashboard | "Set Reminder" and "Sync with Phone Calendar" only show toasts and store nothing. |
| F18 | M | Login | "Forgot Password?" claims to send an email that cannot exist. "Remember me" does nothing. There is no show/hide password toggle, no logout feedback and no demo-account labelling. |
| F19 | M | Contact | The form only shows a toast. Inputs have no validation beyond `required`, nothing is stored, and categories differ from the README. |
| F20 | M | Home | Category counts ("28 Items Covered", and so on) are invented. |
| F21 | M | Guide | Glass, Metal and E-Waste have no real accepted/prohibited lists. The resin-code decoder (#1–#7) is missing. Organics and General Waste have no section. |
| F22 | M | Guide | No category navigation exists. Home's `#general` link points to an anchor that doesn't exist. |
| F23 | M | Login | `login.html#register` works only through inline script and the tabs are not keyboard operable. |
| F24 | L | Hubs | Phone numbers such as `(02) 9876 54321` have too many digits and are not valid Australian numbers. |
| F25 | L | Contact | HQ address and Brisbane branch differ from the README. |

## Security

| ID | Sev | Page | Finding |
|---|---|---|---|
| S1 | H | All | User-supplied text goes into `innerHTML` unescaped (search query, item names, request fields), which allows stored and reflected XSS. |
| S2 | H | Login | No password hashing exists because no password is ever stored or checked (see F1). |
| S3 | M | All | `onclick="fn('${name}')"` interpolation breaks on names with an apostrophe and is an injection path. |

## Navigation and links

| ID | Sev | Page | Finding |
|---|---|---|---|
| N1 | H | All | Below 768px, Login and Start Recycling are hidden with no replacement. The login page has no hamburger button at all. |
| N2 | H | Dashboard | The public navbar is missing. The sidebar is off-canvas below 768px with no way to open it, so **module tabs are unreachable on mobile**. |
| N3 | M | All | Footer differs between pages (full on Home and Contact, one line elsewhere). |
| N4 | M | All | Hamburger has no `aria-expanded`, and only Home labels it. |
| N5 | M | Login | The nav is different on this page: no Login link, and "Start Recycling" points at login instead of search. |
| N6 | L | All | No favicon (404 on every page). No custom 404 page. |
| N7 | L | Home | Footer "About EcoRecycle" and "Recycling Tips" links both go to the top of the guide. |

## Layout (measured horizontal overflow)

| ID | Sev | Page | Width | Overflow | Cause |
|---|---|---|---|---|---|
| L1 | H | Waste Search | 375 / 768 | 720px / 327px | Inline `repeat(3, 1fr)` beats the media queries |
| L2 | H | Contact | 375 / 768 | 596px / 203px | Inline two-column form grids, no responsive rule for `.contact-grid` |
| L3 | H | Dashboard | 375 | 336px | Inline grids, topbar does not wrap, tables overflow |
| L4 | M | Home | 375 | 107px | Calendar card header and legend |
| L5 | M | Guide | 375 | 56px | Inline two-column accepted/prohibited grids |
| L6 | M | All | n/a | n/a | `body { overflow-x: hidden }` hides these from users visually but clips content. It also breaks sticky positioning. |
| L7 | M | All | 769–1100 | n/a | The nav has no room for its links between the tablet breakpoint and about 1100px. |

## Accessibility

| ID | Sev | Page | Finding |
|---|---|---|---|
| A1 | H | All | **Colour contrast fails on every page** (axe: Home 15, Locations 11, Search 5, Dashboard 5, Contact 4, Guide 3, Login 3 nodes). The main cause is white text on `#16A34A` (3.3:1), also green nav text, `#94A3B8` placeholder and the info badge. |
| A2 | H | All | `button, input, select, textarea { outline: none }` removes focus indicators. |
| A3 | H | Dashboard | Modals have no `role="dialog"`, focus trap or Esc-to-close. Close is a `<span>` that keyboards can't reach. Focus isn't returned. |
| A4 | H | Contact / Dashboard | Unlabelled inputs: Contact 7, Dashboard 11, Search 1. axe reports `select-name` on Contact. |
| A5 | M | All but Dashboard | No `<main>` landmark, no skip link. |
| A6 | M | Login | No `<h1>`. |
| A7 | M | All | Heading levels skip (h2 → h4), and the footer uses h4. |
| A8 | M | All | Toasts are created without an `aria-live` region. |
| A9 | M | Dashboard | Sidebar uses `javascript:void(0)` links. Auth tabs and map pins are clickable `div`s. |
| A10 | M | Home | Hero image alt ("Person sorting…") doesn't match the photo, which shows only bins. |
| A11 | L | All | Smooth scrolling and hover animations ignore `prefers-reduced-motion`. |

## Performance and code quality

| ID | Sev | Area | Finding |
|---|---|---|---|
| P1 | H | All | `lucide@latest` is unpinned with no fallback. A breaking release would change or remove icons without warning. |
| P2 | H | Home | Wrong photos on category cards: Glass shows people at a laptop, Metal shows a man with a tool, Paper shows plastic litter on a beach. |
| P3 | M | Home | All 8 images are hot-linked with no `width`/`height`, so layout shifts. Up to 219 KB each, none lazy-loaded. |
| P4 | M | CSS | Page-level `<style>` blocks and hundreds of inline `style=""` attributes. Duplicate colour literals outside the palette, many ad-hoc font sizes. |
| C1 | M | JS | Logic is spread over `script.js` and inline `<script>` blocks. Globals and inline handlers throughout. `localStorage` reads are not guarded. |
| C2 | L | JS / CSS | Dead code: `.mock-map-*`, unused `.btn-icon`, and duplicated table rendering. |
| C3 | L | README | FR1 bin colours (green / brown / black) contradict section C (yellow / green / red). |

## Outcome

Status after the `final-polish` work. Evidence for each area is in [TESTING.md](TESTING.md).

| IDs | Status | How it was resolved |
|---|---|---|
| F1, F2, S2 | Fixed | Real accounts with salted SHA-256 hashes, and a clear wrong-credentials error |
| F3, F4 | Fixed | All data goes through a guarded `localStorage` layer, so approvals reach public search |
| F5, F6, F7 | Fixed | 58 seeded items, live suggestions and results, working chips, and a stored Admin Queue request form |
| F8, F9, F10 | Fixed | Leaflet map, directions modal, saved hubs on the dashboard, postcode and type filters, and URL state |
| F11, F12, F13, F14 | Fixed | Live stats and counters, full log tab, notification toggles, settings, rule status field, and Delete with confirmation |
| F15, F16 | Fixed | Dates are calculated from today; profile data is rendered only after the guard passes |
| F17 | Fixed in part | Set Reminder now saves. **Sync with Phone Calendar was removed**, because it is not a README feature |
| F18 | Fixed in part | Remember me, the password toggle, logout and demo labels work. **Forgot Password was removed**, because no email can be sent |
| F19, F20, F25 | Fixed | Validated contact form, stored enquiries, live category counts, and details aligned with the README |
| F21, F22, F23, F24 | Fixed | 7 guide sections, resin decoder, category navigation, ARIA tabs, and reserved fictional phone numbers |
| S1, S3 | Fixed | All dynamic text is escaped, and inline handlers are replaced by delegated `data-action` events |
| N1 to N7 | Fixed | One nav and footer on every page, working hamburger, dashboard tab strip, favicon and custom 404. The hamburger starts at 1180px rather than 768px, because the full nav needs about 1164px |
| L1 to L7 | Fixed | No inline grids; `overflow-x: hidden` removed; measured at 320 to 1280px |
| A1 to A11 | Fixed | axe-core reports 0 WCAG A/AA violations; modals, focus, labels, landmarks, headings, alt text and live regions all addressed |
| P1 to P4 | Fixed | Pinned libraries with integrity hashes and fallbacks; correct local WebP images with dimensions; page styles consolidated |
| C1 to C3 | Fixed | One sectioned `js/script.js`; dead code removed; README corrected |

### Found and fixed during the work

- Pressing Esc in the search box cleared the query as well as closing the suggestions.
- Saving a hub from a map popup toggled it twice.
- Dashboard tables were silently clipped at tablet widths. They now stack according to the width of their container.
- The Locations page had about 1,000px of blank space below the footer on desktop, caused by hidden text escaping the scrolling list.
- On phones, the map sat below all of the hub cards, so filter changes were out of sight.
