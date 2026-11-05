# ♻️ EcoRecycle Australia: Recycling & Waste Management System

### **Smart Waste. Better Future.**
> A responsive web application prototype that helps reduce contamination in recycling streams, simplifies kerbside disposal rules, locates drop-off centres, and gives Australian communities clear waste guidance.

DAT709 Capstone Project. Static site: HTML, CSS and vanilla JavaScript, with no build step and no back-end.

---

## 🚀 Running the Site

Web Crypto, which is used for password hashing, needs `localhost` or HTTPS, so run the site from a local server. Use either of these commands from the project folder:

```bash
npx http-server -p 8080     # needs Node.js
python -m http.server 8080  # needs Python
```

Then open <http://localhost:8080>. The site also runs on GitHub Pages, because every path is relative.

To return to the original demo data, clear this site's data in your browser (DevTools → Application → Storage → Clear site data).

---

## 📌 1. Project Overview & Capstone Scenario

Many residents across Australia struggle with conflicting rules about everyday household waste. Confusion over items like greasy pizza boxes, takeaway coffee cups, soft plastics and lithium batteries leads to two major issues:

1. **Recycling Stream Contamination**: Non-recyclable items in yellow bins can send entire truckloads of recyclable material to landfill.
2. **Hazardous Waste Risks**: Improper disposal of e-waste and batteries creates fire hazards at waste sorting facilities.

**EcoRecycle Australia** addresses these problems with a single web application prototype: an instant waste search engine, an interactive drop-off location finder, sorting guides, household bin schedules, resident impact tracking, and an administrative control panel.

---

## ✨ 2. Core Features

### 🌟 Primary Feature: Instant Waste Search & Disposal Rules (`pages/waste-search.html`)
- **Real-Time Search with Suggestions**: Results update while you type, across 58 seeded Australian items in 7 categories. The home page search bar sends you straight to these results.
- **Recyclability Status Badges**:
  - 🟢 **Recyclable**: Kerbside yellow or green bin.
  - 🔴 **Not Recyclable**: Red general waste bin.
  - 🟠 **Special Drop-off**: Designated depot, e-waste hub, pharmacy or chemical station.
- **Step-by-Step Preparation Rules** for every item.
- **Category Filter Chips and Popular Searches**.
- **Citizen Request Queue**: Searching for an unlisted item such as *light bulb* shows a form that sends it to the **Admin Queue**.

### 📖 A. Recycling Guide (`pages/recycling-guide.html`)
- Category navigation for **Plastic, Paper & Cardboard, Glass, Metal, E-Waste & Batteries, Organics and General Waste**.
- **Accepted vs Prohibited lists** for each category.
- **Recycling Symbol Decoder**: Explains plastic resin codes #1 to #7, with an environmental tip for each.

### 📍 B. Recycling Locations (`pages/locations.html`)
- **Interactive Map**: Leaflet 1.9.4 with OpenStreetMap tiles, hub pins and popups. A message appears if the tiles or the library cannot load.
- **Suburb & Postcode Search and Waste Type Filter**: Updates both the hub cards and the map pins.
- **Distance & Facility Info**: Straight-line distance from Sydney CBD, or from your location with **Use My Location**, plus address, hours and phone.
- **View Directions**: Modal with hub details and Google Maps and OpenStreetMap directions links.
- **Save Hub**: Appears on the resident dashboard. Hubs saved before signing in move to your account when you sign in as a resident.

### 👤 C. Resident Dashboard (`pages/dashboard.html`)
- **Live Statistics**, updated with each logged item:
  - 📦 **Total Items Logged** (*42*)
  - ♻️ **Recycled or Dropped Off** (*36*)
  - ⚖️ **Landfill Waste Diverted** (*24.5 kg*)
  - 🌱 **Community Eco Score** (*86%*)
- **Collection Calendar**, calculated from today's date for Suburb Zone 4:
  - 🟡 **Yellow Bin**: Recycling (every Tuesday)
  - 🟢 **Green Bin**: Organics / FOGO (every Tuesday)
  - 🔴 **Red Bin**: General waste (alternating Tuesdays)
- **History Log** with a **Log Recycled Item** modal.
- **Saved Hubs**, **Reminders**, **Notification Toggles** and **Account Settings**.

### 🛡️ D. Administrator Portal (`pages/dashboard.html`)
- **City Operations Analytics**: Active waste rules, pending citizen items and registered residents are live counts. *74.2 city tons diverted* is a fixed demo figure.
- **Master Rule Registry**: Search, filter, **Create**, **Edit** and **Delete** (with a confirmation dialog).
- **Citizen Request Queue**:
  - **Approve & Publish**: The item is immediately live in public Waste Search. Requests that have no disposal details yet open a form first, so nothing is published without a classification.
  - **Reject** (with a confirmation dialog).
- **Verification Notes**: Rules show the editor and date, for example *"Updated by Tanu (Admin) • 5 Nov 2026"*.

### 🔑 E. Accounts & Security (`pages/login.html`)
- **Login and Register tabs** with inline validation, a show/hide password toggle and a clear wrong-credentials error.
- **Hashed Passwords**: Salted SHA-256 through the Web Crypto API. Plain-text passwords are never stored.
- **Remember Me**: On keeps you signed in for 30 days and remembers your email. Off ends the session when the tab or window closes.
- **Route Guards**: Signed-out visitors see a lock overlay on the dashboard. Residents cannot open admin modules.

### 🇦🇺 F. Contact (`pages/contact.html`)
- Sydney HQ, national hotline (`1300 326 732`) and state branches.
- **Inquiry Form** with validation, inline errors and a confirmation. Enquiries are stored in `localStorage`.

---

## 🔑 3. Demo Accounts

**These are dummy accounts for testing only. They do not belong to real people.** The login page also lists them.

| Role | Email | Password | Opens |
|---|---|---|---|
| 👤 **Resident** | `alex.johnson@example.com` | `Password123!` | Impact stats, collection schedule, history log, saved hubs, reminders and settings |
| 🛡️ **Administrator** | `admin@ecorecycle.org` | `AdminPassword123!` | Analytics, citizen request queue and master rule registry |

---

## 📋 4. Functional Requirements (FR1 – FR6) Coverage

| Code | Description | Implementation |
|---|---|---|
| **FR1** | Show recycling and waste collection information | **Collection Calendar** on `index.html` and `pages/dashboard.html`, with yellow, green and red bin days, Suburb Zone 4 dates and reminders |
| **FR2** | Search whether an item can be recycled | **Search Engine** on `pages/waste-search.html`, reached from `index.html`, with suggestions, badges and preparation steps |
| **FR3** | Display waste categories and disposal instructions | **Recycling Guide** on `pages/recycling-guide.html`, with accepted and prohibited lists and the resin code decoder |
| **FR4** | Show recycling location / centre information | **Location Finder** on `pages/locations.html`, with suburb and postcode search, waste type filter, map pins, distances, contact details and directions |
| **FR5** | Login/Register interfaces for personalised features | **Account Portal** on `pages/login.html`, with validation, hashed passwords, sessions and role-protected dashboard routing |
| **FR6** | Administrative rule maintenance | **Administrator Portal** in `pages/dashboard.html`, with rule create, edit and delete, and a citizen approval queue |

---

## 💻 5. Technology

- **Structure**: Semantic HTML5 with landmarks, skip links and labelled forms.
- **Styling**: Custom CSS with design tokens for colour and type, flexbox and grid layouts, WCAG AA colours and responsive breakpoints.
- **Logic**: Vanilla JavaScript in `js/script.js`, organised into sections: core, data, storage, UI, auth, navigation, schedule, search, guide, locations, contact, dashboard and boot.
- **Persistence**: Browser `localStorage`, with guarded reads and writes that fall back to seed data.
- **Libraries from a CDN, with exact versions**: [Leaflet](https://leafletjs.com/) 1.9.4 and [Lucide Icons](https://lucide.dev/) 0.468.0. The site shows fallbacks if either fails to load.
- **Map data**: © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors.
- **Images**: Compressed WebP copies of photos from [Unsplash](https://unsplash.com/).

---

## 📁 6. Project Structure

```text
├── index.html                 # Home page
├── 404.html                   # Custom "page not found" page
├── README.md                  # This file
├── AUDIT.md                   # Audit of the prototype before the final polish, with outcomes
├── TESTING.md                 # Test cases and latest results
├── css/style.css              # Design tokens, components and responsive styles
├── js/script.js               # All application logic, in commented sections
├── images/                    # Compressed local images
├── pages/
│   ├── waste-search.html      # Waste search and directory
│   ├── recycling-guide.html   # Sorting guide and resin code decoder
│   ├── locations.html         # Hub finder and map
│   ├── contact.html           # Contact details and enquiry form
│   ├── login.html             # Login and registration
│   └── dashboard.html         # Resident and administrator dashboards
├── tests/e2e.js               # Automated browser checks (development only)
└── docs/screenshots/          # Desktop and mobile screenshots of every page
```

---

## 🎓 7. Recommended Demonstration Journey

1. **Home** (`index.html`): View the hero, problem statement, category cards and collection calendar. Search for *pizza box* to go to the results.
2. **Waste Search** (`pages/waste-search.html`):
   - Type *plastic bottle* or *battery* and watch the suggestions and results update.
   - Use a category chip, then expand an item's preparation steps.
   - Search for *light bulb* and use **Submit to Admin Queue**.
3. **Recycling Guide** (`pages/recycling-guide.html`): Use the category navigation and try the resin code decoder.
4. **Recycling Locations** (`pages/locations.html`):
   - Filter by *E-Waste*, then search for postcode *2150*, and watch the cards and pins change.
   - Click **View Directions**, then **Save Hub**.
5. **Contact** (`pages/contact.html`): View the hotline and branches, and submit a test enquiry.
6. **Resident Sign In** (`pages/login.html`):
   - Use the resident demo account.
   - Click **Log Recycled Item** and watch the stats update. Open **Saved Hubs** and **Bin Schedule**.
7. **Administrator Sign In**:
   - Click **Logout**, then sign in with the admin demo account.
   - Approve the *light bulb* request. It needs a classification before it can be published.
   - Search for *light bulb* in Waste Search to see it live.
   - Open **Master Rule Registry** to edit or delete a rule.

---

## ⚠️ 8. Known Limitations

- **Authentication is client-side only.** Accounts, password hashes, roles and sessions all live in the browser, where a technical user can read or change them. The route guards demonstrate the intended behaviour but do not provide real security. **A production system would need a back-end** with server-side authentication and authorisation. It should also use a slow password hash such as Argon2 or bcrypt, not SHA-256.
- **Data stays in one browser.** Everything is stored in `localStorage`, so it is not shared between devices or browsers, and an admin approval is only visible in the same browser profile. Clearing site data resets the demo.
- **No messages are sent.** Reminders, notification preferences and enquiries are saved but never delivered, because there is no email or SMS service.
- **Sample data.** Hub names, street addresses, hours and phone numbers are fictional, though suburbs, postcodes and map positions are real. Waste guidance is general: rules vary between councils, so it is not official advice.
- **The custom 404 page depends on the host.** GitHub Pages serves it automatically, but `python -m http.server` shows its own plain error page instead.
- **An internet connection is needed for** the map tiles, Leaflet, icons and web fonts. Without one, the site still works with fallback messages, text icons and system fonts.

---

## 🧪 9. Testing

See [TESTING.md](TESTING.md) for the test cases and latest results, and [docs/screenshots/](docs/screenshots/) for desktop and mobile screenshots.

---

## 🇦🇺 10. Australian Headquarters & Support Details

*Fictional details for this prototype.*

- **Headquarters**: Level 14, 200 George Street, Sydney NSW 2000, Australia
- **Waste Hotline**: `1300 326 732` (1300 ECO REC)
- **Support Email**: `support@ecorecycle.org.au`
- **State Branches**:
  - **New South Wales**: Sydney HQ & Parramatta Resource Centre
  - **Victoria**: Collins Street, Melbourne VIC 3000
  - **Queensland**: Queen Street, Brisbane QLD 4000
  - **Western Australia**: St Georges Terrace, Perth WA 6000
