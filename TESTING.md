# EcoRecycle Australia: Test Report

**Result: 69 of 69 tests passed.**

- **Run on:** 7 November 2026
- **Browser:** Headless Chrome 156.0.8078.80, driven by Playwright, on Windows_NT 10.0.26300
- **Accessibility scan:** axe-core, WCAG 2.0 and 2.1 levels A and AA

The "Actual result" column is written by the test script from what it observed during the run. To repeat the run:

```bash
npm install --no-save playwright-core axe-core
node tests/e2e.js
```

The script serves the site itself and rewrites this file. Add `--shots` to also save desktop and mobile screenshots to `docs/screenshots/`. Installing those two packages is only needed for testing: the website has no dependencies or build step.

## Test cases

| ID | Page | Steps | Expected result | Actual result | Pass/Fail |
|---|---|---|---|---|---|
| NAV-01 | All | Open each page and compare primary nav labels and resolved links; check the active item. | Identical nav on every page, with the correct link marked current. | Same 5 links on all 8 pages; active state correct on each. | Pass |
| NAV-02 | All | Collect every a[href], link[href], script[src] and img[src] on every page and request each one; verify in-page anchors. | No broken links, images, scripts or anchors. | 67 unique URLs and anchors checked; none broken. | Pass |
| NAV-03 | All (375px) | At 375px, open the hamburger, check its state, follow a link, reopen and press Esc. | Menu opens and closes, aria-expanded updates, login is reachable. | Hamburger opens, closes on Esc, returns focus, exposes Login and navigates. | Pass |
| NAV-04 | Tablet (768px, 1100px, 1181px) | Measure the navigation bar at widths around the breakpoint, signed out and signed in. | The nav never overflows at any width. | No nav overflow at 768, 1024, 1100, 1180, 1181 or 1280px. | Pass |
| NAV-05 | 404 | Request a missing URL, including a deep one, under the simulated GitHub Pages path. | Custom 404 page, with working styles, nav and links. | Status 404, styled custom page; Home link goes to the project root. | Pass |
| NAV-06 | All | Serve every page from a simulated GitHub Pages sub-folder over HTTPS and record failed requests. | All relative paths work from index.html and /pages/. | All 7 pages loaded with 0 failed requests; login redirect stayed inside the sub-folder. | Pass |
| HOME-01 | Home | Type "pizza box" in the quick search and press Enter. | Goes to Waste Search showing the matching result. | Redirected with ?q=pizza+box; first result "Pizza Box (Soiled / Greasy)". | Pass |
| HOME-02 | Home | Click each hero, category, chip and banner call-to-action. | Every CTA reaches a working destination. | 16 distinct CTA destinations return 200; clicked examples navigate correctly. | Pass |
| HOME-03 | Home | Read the collection calendar and next collection; set a reminder and refresh. | Next collection is a future Tuesday; the reminder persists. | Tuesday 10 November 2026 • Bins out by 7:00 AM; 4 Tuesdays marked; reminder kept after refresh. | Pass |
| HOME-04 | Home | Compare the home page counters with the stored rule list. | Counts are live, not hard-coded. | 58 items shown; all 7 category counts match storage. | Pass |
| SRCH-01 | Waste Search | Open the directory with no query and count items per category. | At least 40 items covering all seven categories, each with a badge and steps. | 58 items, 7 categories, badges: Not Recyclable, Recyclable, Special Drop-off; every card has 2+ steps. | Pass |
| SRCH-02 | Waste Search | Type "bat" and use the arrow keys and Enter on a suggestion. | Suggestions appear while typing and are keyboard operable. | "bat" suggested 3 items, updated results live; Enter picked "AA / AAA Household Battery". | Pass |
| SRCH-03 | Waste Search | Search plural and synonym terms: batteries, smartphone, tv, plastic bottle. | Each returns relevant items. | batteries, smartphone, tv and plastic bottle all return relevant items. | Pass |
| SRCH-04 | Waste Search | Click every category chip and compare results with stored rules. | Each chip shows exactly that category and marks itself pressed. | All 8 chips (All + 7 categories) filter correctly. | Pass |
| SRCH-05 | Waste Search | Click every popular-search chip. | Each chip fills the box and returns results. | plastic bottle:3, cardboard:11, glass bottle:1, battery:3, pizza box:1, smartphone:1 | Pass |
| SRCH-06 | Waste Search | Search "light bulb"; submit the form empty, with a bad email, then correctly. | Friendly no-results state, inline errors, success toast, request stored. | Toast: "Thanks! "light bulb" was submitted to the Admin Queue."; queue now has 5 items. | Pass |
| SRCH-07 | Waste Search | Search and submit a request containing an HTML image tag with an onerror handler. | Rendered as plain text, with no script execution. | Payload shown as text in search and in the admin queue; no script ran. | Pass |
| SRCH-08 | Waste Search | Apply a search and category, then refresh. | State is restored from the URL. | q=bottle + Glass restored after refresh (1 item). | Pass |
| GUIDE-01 | Recycling Guide | Click each category link; check the section and its lists. | Navigation reaches every section; each has accepted and prohibited lists. | 8 nav links work; all 7 categories have accepted and prohibited lists. | Pass |
| GUIDE-02 | Recycling Guide | Click resin codes #1 to #7. | Each shows its own name, kerbside advice and tip. | 7 distinct panels shown, from "#1 PET" to "#7 Other". | Pass |
| GUIDE-03 | Recycling Guide | Click "Find E-Waste Drop-off Hubs". | Locations opens with the E-Waste filter applied. | Filter pre-selected; 5 hubs shown. | Pass |
| LOC-01 | Locations | Open the page and wait for the map; click a pin. | Real OpenStreetMap tiles load, every hub has a pin, popups open with actions. | Leaflet 1.9.4, 9 tiles, 8 pins; popup for "Metro Glass & Organics Drop-off". | Pass |
| LOC-02 | Locations | Select each waste type. | Cards and pins both update to the same matching hubs. | All:8, Plastic:5, Paper:4, Glass:4, Metal:5, E-Waste:5, Batteries:4, Organics:3 | Pass |
| LOC-03 | Locations | Search by postcode 2150, by suburb Brunswick, then refresh. | List and pins narrow; the filter survives refresh. | 2150 finds Parramatta, Brunswick finds its hub; 1 card and 1 pin each; kept on refresh. | Pass |
| LOC-04 | Locations | Search for "Newtown", then Clear filters. | Friendly empty state with 0 pins; clearing restores all hubs. | Empty state with 0 pins; Clear restored 8 hubs. | Pass |
| LOC-05 | Locations | Click View Directions on a hub card. | Modal shows hub details and map directions links. | Modal shows address, hours, phone and distance, with Google Maps and OSM links. | Pass |
| LOC-06 | Locations + Dashboard | Save a hub as a guest, sign in as Alex, open Saved Hubs; refresh; remove it. | The hub appears on the resident dashboard and survives refresh. | "Metro Glass & Organics Drop-off" saved, shown on the dashboard, kept on refresh, then removed. | Pass |
| LOC-07 | Locations | Block map tile requests. | A fallback message appears; pins and cards still work. | Notice: "Map tiles could not load, so the background may be blank. The pins and the hub list still work." | Pass |
| LOC-08 | Locations | Allow the browser to share a location, then click Use My Location. | Distances recalculate and hubs re-sort. | From Melbourne, the nearest hub becomes "Brunswick Circular Drop-off" (4.8 km). | Pass |
| CONT-01 | Contact | Submit the empty form. | Inline errors on every required field, with focus on the first. | 6 inline errors, aria-invalid set, focus on Full Name. | Pass |
| CONT-02 | Contact | Enter a bad email, a bad phone number and a short message. | Specific error for each. | "Your message needs at least 20 characters (9 so far)." | Pass |
| CONT-03 | Contact | Submit a valid enquiry. | Success confirmation, toast, and the enquiry stored in localStorage. | Confirmation with reference ENQ-940982; enquiry stored. | Pass |
| AUTH-01 | Login | Sign in with a wrong password, then an unknown email. | Clear inline error; no session is created. | "Incorrect email or password. Please check your details and try again."; no session. | Pass |
| AUTH-02 | Login | Sign in with each demo account. | Resident reaches the resident view; admin reaches the admin view. | Both demo accounts route to the correct view. | Pass |
| AUTH-03 | Login | Inspect the login page for demo credentials. | No account emails or passwords are shown on the page. | No demo emails or passwords appear in the login page. | Pass |
| AUTH-04 | Register | Submit empty, then a bad email, weak password, mismatch, and an existing email. | A specific inline error for each rule. | Empty, format, password rule, mismatch and duplicate errors all shown inline. | Pass |
| AUTH-05 | Register | Create an account; inspect storage; log out; sign back in. | Resident created with a salted SHA-256 hash, and no plain-text password. | Resident stored with 64-hex hash and 32-hex salt, no plain text; can sign back in. | Pass |
| AUTH-06 | Login | Use the show/hide password toggle. | The input type and the button state and label change. | Type switches between password and text; aria-pressed and label update. | Pass |
| AUTH-07 | Login | Sign in with Remember me off and open a new tab; repeat with it on. | Off: session limited to that tab. On: session survives a new tab and the email is remembered. | Off: new tab locked. On: new tab signed in; email and checkbox remembered after logout. | Pass |
| AUTH-08 | All | Sign in, then log out from the nav. | Nav shows signed-in state, logout ends the session and shows feedback. | Logout clears the session, shows a toast, and the dashboard locks again. | Pass |
| DASH-01 | Dashboard | Open the dashboard while signed out. | Lock overlay shows; no app content is rendered; focus is on Sign In. | Overlay shown, app hidden, no account data in the page. | Pass |
| DASH-02 | Dashboard | As a resident, open dashboard.html#admin-directory. | Access denied; admin modules are not in the page. | Toast "Access denied", overview shown, admin markup absent, admin handlers refuse. | Pass |
| DASH-03 | Dashboard | As Alex, check starting stats, then log a recycled item; refresh. | Stats start at 42 / 24.5 kg / 86%; the row is added; stats update and persist. | 42 / 24.5 kg / 86% became 43 / 26.0 kg / 86%; row added; kept on refresh. | Pass |
| DASH-04 | Dashboard | Open each resident tab; refresh on one. | Every tab works; the URL hash keeps the tab on refresh. | All 6 tabs work; History (6 rows) restored after refresh. | Pass |
| DASH-05 | Dashboard | Toggle notification switches and refresh; set a reminder; update settings. | Toggles, reminders and profile changes persist. | SMS toggle, reminder and address all persisted after refresh. | Pass |
| DASH-06 | Dashboard | Open the schedule tab and check each bin date. | Yellow and green are the next Tuesday; red is within two weeks. | Yellow: Tuesday 10 November 2026; green: Tuesday 10 November 2026; red: Tuesday 10 November 2026. | Pass |
| ADM-01 | Dashboard (admin) | Create a rule with empty fields, then valid values; search for it publicly. | Validation runs; the rule appears in Waste Search and the counter increases. | Rule counter 58 to 59; "Foam Yoga Mat" live with 2 steps. | Pass |
| ADM-02 | Dashboard (admin) | Edit a rule's disposal method and search for it publicly. | Change is saved and live, with a verification note. | Public card shows "Green FOGO Bin"; note "Updated by Tanu (Admin) • 7 Nov 2026". | Pass |
| ADM-03 | Dashboard (admin) | Click Delete: cancel, press Esc, then confirm. | A confirm dialog appears; only confirmation deletes, and the rule leaves public search. | Cancel and Esc keep the rule; confirming removes it from public search. | Pass |
| ADM-04 | Dashboard (admin) + Waste Search | With Waste Search open in a second tab, click Approve & Publish on a classified request. | One click publishes it; it appears in the open search tab without a refresh; counters update. | "Empty Aerosol Spray Can" appeared in the open tab; rules 58 to 59, pending 4 to 3. | Pass |
| ADM-05 | Waste Search + Dashboard (admin) | Guest submits "light bulb" with category Not sure; admin approves, classifies and publishes. | Admin must classify it first, so nothing inaccurate is published; the item is then searchable. | Classification enforced; "light bulb" now public with badge "Not Recyclable". | Pass |
| ADM-06 | Dashboard (admin) | Reject a request; check the queue, the counter and public search. | Confirmed rejection removes it, without publishing. | Pending 4 to 3, rules unchanged at 58, not public. | Pass |
| ADM-07 | Dashboard (admin) | Filter the registry by text and category; refresh on the tab; empty the queue. | Registry filters work; the tab survives refresh; the queue shows an empty state. | Glass filter shows 6 rows; tab kept on refresh; empty queue shows "All caught up". | Pass |
| RESP-01 | All | Measure horizontal overflow on every page at 320, 375, 768, 1024 and 1280px. | No page scrolls sideways at any width. | 40 page and width combinations, 0px overflow. | Pass |
| RESP-04 | All | At 375 and 1280px, compare the bottom of the footer with the document height on every page. | No blank scrollable space below the footer. | 16 page and width combinations: footer is the last thing on each page. | Pass |
| RESP-02 | Dashboard | At 320, 375, 768, 1024 and 1280px, visit every resident and admin tab; measure overflow and clipped table columns; open a modal at 375px. | No sideways scrolling and no clipped columns; tables become cards when narrow; every tab can be reached; modals fit. | 45 tab and width combinations: 0px overflow, 0px clipped; tables stack at 375px; modals fit. | Pass |
| RESP-03 | Locations (375px) | Open Locations at 375px and use the map and cards. | Map is usable and fits; cards stack. | Map is 327x380px; Show on Map opens the popup. | Pass |
| A11Y-01 | Public pages | Run axe-core (WCAG 2.0/2.1 A and AA) on each public page and state, including form errors and a map popup. | No violations. | 10 page states scanned; 0 violations. | Pass |
| A11Y-02 | Dashboard | Run axe-core on every resident and admin module, and with each modal open. | No violations. | 12 dashboard states scanned; 0 violations. | Pass |
| A11Y-03 | All | Check each page for lang, title, landmarks, one h1, heading order, labels, and image alt and size. | All present on every page. | All 8 pages pass: lang, 1 h1, landmarks, labels, alt, width and height, heading order. | Pass |
| A11Y-04 | Dashboard | Open a modal by keyboard; Tab and Shift+Tab repeatedly; press Esc. | Focus stays inside, Esc closes, and focus returns to the trigger. | Focus trapped for 24 Tab presses; Esc closes; focus returned to the trigger. | Pass |
| A11Y-05 | All | Tab from the top of a page; follow the skip link; inspect the focus style. | Skip link is first, moves focus to main; focus is visibly styled. | Skip link works; focused element shows outline "solid 3px". | Pass |
| A11Y-06 | All | Check the toast region; check switches and tabs use correct roles. | Toasts are announced with aria-live; the auth tabs work with arrow keys. | Toast region is aria-live polite; tabs follow the ARIA pattern; toggles use role=switch. | Pass |
| ERR-01 | Locations + All | Block all CDN scripts (Leaflet and Lucide) and load every page. | No uncaught errors; a map fallback message and text icon fallbacks appear. | 0 uncaught errors; map notice shown; hamburger falls back to "☰". | Pass |
| ERR-02 | Waste Search + Login | Corrupt localStorage values (invalid JSON and junk arrays) and reload. | App falls back to seed data and still works. | Invalid JSON and junk arrays both fall back to 58 seed rules; demo login still works. | Pass |
| ERR-03 | All | Make localStorage throw on every access and use the site. | No uncaught errors; pages render from seed data, with a warning when saving fails. | 0 uncaught errors with storage blocked; 58 seed items shown; user warned that saving failed. | Pass |
| PERF-01 | All | Inspect library URLs, image sizes and code organisation. | Exact versions pinned with integrity hashes; compressed local images; no leftover legacy code. | Lucide 0.468.0 and Leaflet 1.9.4 pinned with SRI; 9 images, 663 KB total, largest 140 KB; 13 JS sections. | Pass |
| PERF-02 | Home | Scroll the home page and check every image has loaded. | All images decode, with no layout shift from missing dimensions. | 9 of 9 images loaded. | Pass |
| ERR-04 | All | Review browser console output from all of the tests above (those that deliberately block resources are excluded). | No console errors or uncaught exceptions. | No console errors or uncaught exceptions recorded. | Pass |

## What these tests do not cover

- **Other browsers and real devices:** the run used Chrome only, with mobile widths simulated. Safari, Firefox and physical phones were not tested.
- **Screen readers:** axe-core and keyboard tests catch many accessibility problems, but a person using NVDA or VoiceOver was not part of this run. axe-core also cannot judge everything that WCAG requires.
- **Live GitHub Pages:** the sub-folder and 404 behaviour was simulated by serving the files from the project's expected GitHub Pages address. The deployed site itself was not visited.
- **Map link destinations:** the Google Maps and OpenStreetMap directions links were checked for correct format but were not opened.
- **Sent messages:** reminders and enquiries are stored only in the browser. No email or SMS exists to test.
