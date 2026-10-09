# ♻️ EcoRecycle Australia — Recycling & Waste Management System

### **Smart Waste. Better Future.**
> A modern, responsive web application designed to reduce contamination in recycling streams, simplify kerbside disposal rules, locate local drop-off centers, and empower Australian communities with real-time waste intelligence.

---

## 📌 1. Project Overview & Capstone Scenario

Many residents across Australia struggle with conflicting rules regarding everyday household waste disposal. Confusion over whether items like greasy pizza boxes, takeaway coffee cups, soft plastics, or lithium batteries are recyclable leads to two major issues:
1. **Recycling Stream Contamination**: Non-recyclable items dumped into yellow bins cause entire truckloads of recyclable materials to end up in landfills.
2. **Hazardous Waste Risks**: Improper disposal of e-waste and batteries poses fire hazards at waste sorting facilities.

**EcoRecycle Australia** solves these challenges by offering a single, centralized web application prototype. The platform provides an instant waste search engine, interactive location finder for drop-off centers, educational sorting guides, household bin collection schedules, resident impact tracking, and a full administrative control panel for municipal waste management.

---

## ✨ 2. Comprehensive Feature Breakdown

### 🔍 A. Instant Waste Search Engine & Lookup Directory
- **Real-Time Instant Search**: Dynamic filtering across household items (e.g., *Plastic Water Bottles*, *Clean Cardboard*, *Greasy Pizza Boxes*, *Glass Bottles*, *AA Lithium Batteries*, *Aluminium Cans*).
- **Recyclability Status Badges**: Clear color-coded badges indicating whether an item is:
  - 🟢 **Recyclable** (Kerbside Yellow Bin acceptable)
  - 🔴 **Not Recyclable** (General Landfill Waste)
  - 🟠 **Special Drop-off** (Requires designated drop-off facility or hazardous waste center)
- **Step-by-Step Disposal Instructions**: Clear preparation guidelines for every item (e.g., rinse containers, flatten boxes, tape battery terminals).
- **Quick Category Filter Chips**: One-click filtering tags for fast navigation across major material categories.
- **Citizen Request Submission**: When searching for an unlisted item, users can submit a request directly to the **Admin Operations Queue** for municipal review.

---

### 📖 B. Material Sorting & Educational Recycling Guide
- **5 Core Material Category Directories**:
  - 🥤 **Plastics**: PET #1, HDPE #2, Soft Plastics advisory, rigid plastics guide.
  - 📦 **Paper & Cardboard**: Clean boxes vs. food-contaminated paper, milk cartons, glossy paper.
  - 🍾 **Glass**: Clear, green, and brown bottles vs. prohibited Pyrex heat-resistant glass and mirrors.
  - 🥫 **Metals**: Aluminium beverage cans, tin cans, foil packaging rules.
  - ⚡ **E-Waste & Batteries**: Lithium-ion, AA/AAA batteries, old electronics, hazardous drop-off rules.
- **Accepted vs. Prohibited Listings**: Visual do's and don'ts for kerbside collection.
- **Recycling Symbol Decoder**: Explanations for plastic resin codes (#1 to #7) and environmental impact tips.

---

### 📍 C. Recycling Location & Drop-off Centre Finder
- **Suburb & Postcode Search**: Locate nearby drop-off hubs, community recycling centers, and battery depots.
- **Waste Category Filter Dropdown**: Filter centers by accepted waste streams (Plastic, Glass, Metal, Paper, E-Waste, Batteries).
- **Distance & Facility Info**: View real-time distance calculations (e.g., *1.8 km away*), street addresses, operating hours, and contact phone numbers.
- **Interactive Visual Map Interface**: Simulated interactive map layout displaying location pins and active hub cards.
- **GPS Route Directions Modal**: One-click route navigation trigger for instant direction instructions.
- **Favorite Hub Bookmarking**: Save frequently visited recycling centers to the user's dashboard.

---

### 👤 D. Personal Resident User Dashboard & Impact Tracker
- **Personal Eco Statistics Overview**:
  - 📦 **Total Items Recycled**: Real-time counter (e.g., *42 Items*).
  - ⚖️ **Landfill Waste Diverted**: Weight measurement in kg (e.g., *24.5 kg Diverted*).
  - 🌱 **Community Eco Score**: Dynamic percentage rating (e.g., *86% Score*).
- **Household Collection Calendar Widget**: Suburb Zone 4 collection schedule showing bin types:
  - 🟡 **Yellow Bin**: Recycling (Every Tuesday)
  - 🟢 **Green Bin**: Organics / FOGO (Every Tuesday)
  - 🔴 **Red/Dark Bin**: General Landfill Waste (Alternating Weeks)
- **Resident Activity History Log**: Interactive table tracking personal recycling history with date, category, disposal method, and status badge.
- **Log New Item Activity Modal**: Form allowing residents to log newly recycled items directly into their personal dashboard log.
- **Notification & Reminder Settings**: Toggle switches for bin collection SMS/email alerts.

---

### 🛡️ E. Administrator Operations Control Portal
*(Accessible via `admin@ecorecycle.org` / `AdminPassword123!`)*
- **City Operations Analytics**: High-level overview metrics (e.g., *74.2 City Tons Diverted*, *Active Waste Rules*, *Pending Citizen Items*).
- **Master Waste Rule Registry**:
  - Complete data table listing all published rules in the system database.
  - **Create & Publish Rules**: Form to add new waste items with categories and disposal methods.
  - **Edit Rule Modal**: Inline modal allowing administrators to update existing waste disposal rules in real time.
- **Citizen Request Moderation Queue**:
  - Live review queue showing items submitted by residents during search queries.
  - **Approve & Publish**: One-click action to approve a citizen request and instantly publish it to the public search engine database.
  - **Reject Request**: Moderation action to dismiss invalid or duplicate requests.
- **System Audit Logs & Verification Badges**: Rules display admin verification timestamps and editor notes (e.g., *"Verified by Tanu (Admin)"*).

---

### 🔑 F. Security, Authentication & User Management
- **Role-Based Authentication Engine**: Built-in state management supporting two primary user roles:
  - 👤 **Resident Role** (`alex.johnson@example.com`)
  - 🛡️ **Administrator Role** (`admin@ecorecycle.org`)
- **Protected Routing & Permission Guards**:
  - Restricts resident access from opening administrative control modules.
  - Displays an **Authentication Lock Overlay** if unauthenticated users attempt to view protected dashboard modules.
- **Tabbed Login & Register Interfaces**: Modern forms with client-side validation, password visibility toggle, and instant feedback toasts.
- **Persistent Session State**: Powered by browser `localStorage` for seamless navigation across pages.

---

### 🇦🇺 G. Australian Support & State Branch Directory
- **National Hotline & Emergency Contacts**: Sydney HQ details, hotline (`1300 326 732`), and state branch contacts across NSW, VIC, QLD, and WA.
- **Citizen Inquiry Form**: Interactive support form with category selection (General Inquiry, Kerbside Service, Report Contamination, Missed Collection) and instant confirmation notifications.

---

## 🔑 3. Test Account Credentials Matrix

| User Role | Test Email Address | Test Password | Accessible Features & Dashboard Modules |
|---|---|---|---|
| 👤 **Resident User** | `alex.johnson@example.com` | `Password123!` | Personal Recycling Impact Stats (*42 Items, 24.5kg Diverted, 86% Eco Score*), Suburb Zone 4 Household Collection Schedule, Personal Activity History Log, Log New Item Modal, Saved Drop-off Hubs, Bin Reminders & Account Preferences. |
| 🛡️ **System Administrator** | `admin@ecorecycle.org` | `AdminPassword123!` | **Admin Control Portal**: City Operations Analytics (*74.2 City Tons Diverted*), Citizen Moderation Queue (*Review & Approve/Reject pending resident item requests*), Master Waste Rule Registry (*Create, Edit & Publish waste rules*). |

---

## 📋 4. Functional Requirements (FR1 – FR6) Coverage

| Requirement Code | Description | Implementation in Prototype |
|---|---|---|
| **FR1** | Show recycling and waste collection information | **Collection Calendar Widget** on `index.html` & `pages/dashboard.html` showing bin types (🟢 Recycling, 🟤 Organic, ⚫ General Waste), suburb zone schedules, and reminder push notifications. |
| **FR2** | Allow users to search whether an item can be recycled | **Instant Search Engine** on `index.html` & `pages/waste-search.html` with real-time suggestions, recyclability status badges, and step-by-step preparation rules. |
| **FR3** | Display waste categories and disposal instructions | **Category Directories** covering Plastic, Paper & Cardboard, Glass, Metal, E-Waste, and General Waste on `pages/recycling-guide.html` with symbol decoders and accepted/prohibited lists. |
| **FR4** | Show recycling location / centre information | **Location Finder** on `pages/locations.html` with suburb search, waste type filters, distance listings, contact info, GPS directions trigger, and interactive map pins. |
| **FR5** | Provide Login/Register interfaces for personalized features | **Account Portal** on `pages/login.html` with client validation, password visibility toggles, session persistence, and role-protected dashboard routing. |
| **FR6** | Administrative rule maintenance structure | **Administrator Control Panel** in `pages/dashboard.html` for `admin@ecorecycle.org` featuring master waste rule creation, item edits, and a live citizen submission approval queue. |

---

## 💻 5. Technology Stack & Technical Architecture

- **Frontend Structure**: HTML5 (Semantic elements, accessibility standards, descriptive page metadata).
- **Styling & Design System**: Custom CSS3 utilizing HSL environmental design tokens, flexbox/grid layouts, custom dark/light modes, glassmorphism cards, and responsive viewports.
- **JavaScript Engine**: Vanilla ES6 JavaScript (`js/script.js`):
  - In-memory Master Waste Database & Pending Request Queue.
  - Event-driven DOM Manipulation & Search Filtering Logic.
  - Role-based Authentication Engine & `localStorage` Persistence.
  - Modal & Toast Notification Manager.
- **Iconography & Visual Assets**: Lucide Icons vector library.

---

## 📁 6. Project Structure

```text
recycling-waste-management-system/
├── index.html                     # Main Landing Page (Hero, Problem Statement, Search Widget, Categories, Calendar, Stats, Footer)
├── README.md                      # Comprehensive Project Documentation & Test Credentials
├── css/
│   └── style.css                  # Custom CSS3 Design Tokens, HSL Environmental Colors, Layout Grids, Responsive Styles
├── js/
│   └── script.js                  # ES6 Engine, Mock Database, Search Engine, Location Filters, Auth Guards & Admin Controls
└── pages/
    ├── waste-search.html          # Waste Search Directory & Filterable Material Directory Catalogue
    ├── recycling-guide.html       # Comprehensive Material Sorting Guide (Plastics, Paper, Glass, Metal, E-Waste)
    ├── locations.html             # Drop-off Centre Finder with Suburb Search, Filters & Interactive Map UI
    ├── contact.html               # Australian Contact Us Page (Sydney HQ, Hotline 1300 326 732, Branch Directory & Inquiry Form)
    ├── dashboard.html             # Dynamic User Dashboard (Resident Impact Tracker vs System Admin Portal)
    └── login.html                 # Authentication Portal (Tabbed Login & Registration Forms with Demo Credentials)
```

---

## 🎓 7. Recommended Demonstration User Journey

For evaluators reviewing the prototype, follow this step-by-step walkthrough:

1. **Public Home Page** (`index.html`): View Hero Banner, Capstone Problem Statement, Quick Search Bar, Waste Category Cards, and Collection Calendar.
2. **Search Waste Item** (`pages/waste-search.html`):
   - Type *"plastic bottle"*, *"battery"*, or *"pizza box"*.
   - Review recyclability badges, preparation steps, and disposal recommendations.
   - Click a search chip or test searching an unlisted item (e.g. *"light bulb"*) to see the **Submit to Admin Queue** workflow.
3. **Explore Material Sorting Guide** (`pages/recycling-guide.html`): Inspect accepted vs prohibited listings for plastics, paper, glass, metals, and e-waste.
4. **Locate Drop-off Centre** (`pages/locations.html`):
   - Filter by waste type *"E-Waste"* or *"Batteries"*.
   - Click **View Directions** or **Save Hub**.
5. **Contact Us Page** (`pages/contact.html`): View Australian support hotline (`1300 326 732`), Sydney HQ address, state branches, and submit a test inquiry.
6. **Resident Sign In** (`pages/login.html`):
   - Sign in with `alex.johnson@example.com` / `Password123!`.
   - Explore household collection calendar, personal impact stats, activity history log, and click **Log Recycled Item**.
7. **Administrator Sign In** (`pages/login.html`):
   - Click **Logout** and sign in with `admin@ecorecycle.org` / `AdminPassword123!`.
   - Observe the automatic transition to the **Admin Control Panel**.
   - Review the **Citizen Pending Queue**, click **Approve & Publish** on a pending item.
   - Click **Publish Waste Rule** or **Edit Rule** to modify a master waste rule.

---

## 🇦🇺 8. Australian Headquarters & Support Details

- **Headquarters**: Level 14, 200 George Street, Sydney NSW 2000, Australia
- **Waste Hotline**: `1300 326 732` (1300 ECO REC)
- **Support Email**: `support@ecorecycle.org.au`
- **State Branches**:
  - **New South Wales**: Sydney HQ & Parramatta Resource Centre
  - **Victoria**: Collins Street, Melbourne VIC 3000
  - **Queensland**: Queen Street, Brisbane QLD 4000
  - **Western Australia**: St Georges Terrace, Perth WA 6000

