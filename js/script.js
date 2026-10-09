/* ==========================================
   EcoRecycle - Comprehensive JavaScript Logic
   Account Authentication & Dynamic Dashboard Engine
   ========================================== */

// --- 1. REAL-WORLD MASTER WASTE DATABASE ---
let WASTE_DATABASE = [
  {
    id: 'plastic-bottle',
    name: 'Plastic Water Bottle (PET #1)',
    category: 'Plastic',
    recyclable: true,
    disposalMethod: 'Yellow Recycling Bin',
    instructions: [
      'Empty all liquid contents completely.',
      'Rinse out any residue with clean water.',
      'Leave caps on or flatten the bottle to save space.'
    ],
    adminNote: 'Verified by Tanu (Admin) • Standard PET #1 Recycling Rule',
    status: 'Published',
    updatedDate: '2026-10-01'
  },
  {
    id: 'cardboard-box',
    name: 'Cardboard Box (Clean)',
    category: 'Paper & Cardboard',
    recyclable: true,
    disposalMethod: 'Yellow Recycling Bin',
    instructions: [
      'Flatten all cardboard boxes completely to maximize bin volume.',
      'Remove tape, heavy plastic wrapping, and shipping labels if possible.',
      'Keep cardboard dry; wet cardboard cannot be processed at recycling plants.'
    ],
    adminNote: 'Verified by Tanu (Admin) • Updated Oct 2026',
    status: 'Published',
    updatedDate: '2026-10-02'
  },
  {
    id: 'pizza-box',
    name: 'Pizza Box (Soiled / Greasy)',
    category: 'Paper & Cardboard',
    recyclable: false,
    disposalMethod: 'General Waste Bin / Organics',
    instructions: [
      'Grease and food residue contaminate paper recycling streams.',
      'Tear off the clean lid and place the clean half in the Recycling Bin.',
      'Dispose of the greasy bottom portion in General Waste or Green Organics.'
    ],
    adminNote: 'Verified by Tanu (Admin) • Contamination Rule',
    status: 'Published',
    updatedDate: '2026-09-28'
  },
  {
    id: 'glass-bottle',
    name: 'Glass Drink Bottle (Clear/Green/Brown)',
    category: 'Glass',
    recyclable: true,
    disposalMethod: 'Yellow Recycling Bin / Glass Hub',
    instructions: [
      'Rinse thoroughly to remove syrup or residue.',
      'Metal bottle caps can be recycled separately or placed back on tight.'
    ],
    adminNote: 'Verified by Tanu (Admin) • Glass Standard',
    status: 'Published',
    updatedDate: '2026-09-25'
  },
  {
    id: 'battery-aa',
    name: 'AA / AAA Lithium Battery',
    category: 'E-Waste',
    recyclable: 'special',
    disposalMethod: 'E-Waste Drop-off Centre Only',
    instructions: [
      'NEVER put batteries in regular household recycling or garbage bins (Fire Hazard!).',
      'Tape battery terminals with clear tape to prevent short circuits.'
    ],
    adminNote: 'Verified by Tanu (Admin) • Hazmat Advisory',
    status: 'Published',
    updatedDate: '2026-09-20'
  },
  {
    id: 'aluminium-can',
    name: 'Aluminium Beverage Can',
    category: 'Metal',
    recyclable: true,
    disposalMethod: 'Yellow Recycling Bin',
    instructions: [
      'Empty all liquid contents and rinse lightly.'
    ],
    adminNote: 'Verified by Tanu (Admin) • 100% Recyclable',
    status: 'Published',
    updatedDate: '2026-09-15'
  }
];

// --- 2. PENDING CITIZEN ITEM SUBMISSIONS (Admin Queue) ---
let PENDING_SUBMISSIONS = [
  {
    id: 'aerosol-can-req',
    name: 'Empty Aerosol Spray Can',
    category: 'Metal',
    disposalMethod: 'Yellow Recycling Bin / Hazmat',
    submittedBy: 'Resident (alex.johnson@example.com)',
    dateSubmitted: 'Oct 07, 2026',
    reason: 'Residents confused whether pressure valve can go into kerbside recycling bin.'
  },
  {
    id: 'bubble-wrap-req',
    name: 'Bubble Wrap Packaging Film',
    category: 'Plastic',
    disposalMethod: 'Soft Plastic Drop-off',
    submittedBy: 'Resident (maria.garcia@example.com)',
    dateSubmitted: 'Oct 06, 2026',
    reason: 'Plastic film tangles sorting machines; requires special supermarket collection.'
  },
  {
    id: 'coffee-cup-req',
    name: 'Takeaway Paper Coffee Cup',
    category: 'Paper & Cardboard',
    disposalMethod: 'General Waste Bin',
    submittedBy: 'Resident (david.chen@example.com)',
    dateSubmitted: 'Oct 05, 2026',
    reason: 'Internal plastic lining prevents regular paper pulping.'
  },
  {
    id: 'pyrex-dish-req',
    name: 'Broken Pyrex Baking Dish',
    category: 'Glass',
    disposalMethod: 'General Waste Bin',
    submittedBy: 'Resident (resident.lee@example.com)',
    dateSubmitted: 'Oct 03, 2026',
    reason: 'Treated heat-resistant glass ruins recycled bottle melt batches.'
  }
];

// --- 3. MOCK RESIDENT ACTIVITY LOG DATA ---
let RESIDENT_ACTIVITY = [
  { id: 1, item: 'Plastic Water Bottle (PET #1)', category: 'Plastic', disposal: 'Yellow Recycling Bin', date: 'Oct 08', status: 'Recycled' },
  { id: 2, item: 'Cardboard Delivery Box', category: 'Paper & Cardboard', disposal: 'Yellow Recycling Bin', date: 'Oct 07', status: 'Recycled' },
  { id: 3, item: 'Expired AA Batteries (4x)', category: 'E-Waste', disposal: 'EcoHub Drop-off Hub', date: 'Oct 05', status: 'Drop-off' },
  { id: 4, item: 'Soiled Pizza Box (Bottom)', category: 'General Waste', disposal: 'Landfill Waste Bin', date: 'Oct 04', status: 'Landfill' },
  { id: 5, item: 'Aluminium Soda Can', category: 'Metal', disposal: 'Yellow Recycling Bin', date: 'Oct 02', status: 'Recycled' },
  { id: 6, item: 'Glass Jam Jar', category: 'Glass', disposal: 'Yellow Recycling Bin', date: 'Sep 29', status: 'Recycled' }
];

// --- 4. MOCK RECYCLING LOCATIONS ---
const MOCK_LOCATIONS = [
  {
    id: 1,
    name: 'GreenPoint Community Recycling Centre',
    address: '142 Environmental Way, Greenpoint Suburb',
    distance: '1.8 km',
    types: ['Plastic', 'Glass', 'Metal', 'Paper'],
    hours: 'Mon–Sat: 8:00 AM – 5:00 PM',
    phone: '(02) 9876 54321'
  },
  {
    id: 2,
    name: 'EcoHub E-Waste & Battery Depot',
    address: '88 Innovation Boulevard, Tech Park',
    distance: '3.2 km',
    types: ['E-Waste', 'Batteries', 'Metal'],
    hours: 'Mon–Fri: 9:00 AM – 6:00 PM',
    phone: '(02) 9876 54322'
  },
  {
    id: 3,
    name: 'Metro Glass & Organics Drop-off',
    address: '12 Recycling Crescent, Central City',
    distance: '4.5 km',
    types: ['Glass', 'General Recycling'],
    hours: '7 Days: 7:00 AM – 7:00 PM',
    phone: '(02) 9876 54323'
  },
  {
    id: 4,
    name: 'Northside Hazardous Waste & Chemical Facility',
    address: '50 Industrial Highway, Northville',
    distance: '6.1 km',
    types: ['Batteries', 'E-Waste', 'Plastic'],
    hours: 'Sat & Sun: 9:00 AM – 3:00 PM',
    phone: '(02) 9876 54324'
  }
];

// --- 5. AUTHENTICATION ENGINE ---
function getCurrentUser() {
  const user = localStorage.getItem('ecorecycle_user');
  if (user) {
    try { return JSON.parse(user); } catch(e) {}
  }
  return null;
}

function loginWithAccount(email, password) {
  const cleanEmail = (email || '').toLowerCase().trim();
  let userObj = {};

  if (cleanEmail === 'admin@ecorecycle.org' || cleanEmail.includes('admin') || cleanEmail.includes('tanu')) {
    userObj = {
      loggedIn: true,
      role: 'admin',
      name: 'Tanu',
      email: 'admin@ecorecycle.org',
      avatar: 'TN',
      roleTitle: 'Senior Waste Operations Manager'
    };
  } else {
    userObj = {
      loggedIn: true,
      role: 'resident',
      name: 'Alex Johnson',
      email: 'alex.johnson@example.com',
      avatar: 'AJ',
      roleTitle: 'Resident • Suburb Zone 4'
    };
  }

  localStorage.setItem('ecorecycle_user', JSON.stringify(userObj));
  return userObj;
}

function logoutUser() {
  localStorage.removeItem('ecorecycle_user');
  showToast('Logged out successfully.');
  setTimeout(() => { window.location.href = '../index.html'; }, 800);
}

// --- 6. DOM INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
  if (window.lucide) lucide.createIcons();

  initAuthUI();
  initWasteSearch();
  initLocationFinder();
  initMobileMenu();
  initAuthForms();
  initDashboard();
});

function initAuthUI() {
  const currentUser = getCurrentUser();
  const navActions = document.querySelector('.nav-actions');

  if (navActions && currentUser && currentUser.loggedIn) {
    const roleBadge = currentUser.role === 'admin' ? '🛡️ Admin' : '👤 Resident';
    navActions.innerHTML = `
      <div style="display: flex; align-items: center; gap: 0.75rem;">
        <a href="${window.location.pathname.includes('/pages/') ? 'dashboard.html' : 'pages/dashboard.html'}" class="btn btn-secondary btn-sm">
          <i data-lucide="user"></i> ${currentUser.name} (${roleBadge})
        </a>
        <button onclick="logoutUser()" class="btn btn-sm btn-dark" title="Logout">
          <i data-lucide="log-out"></i>
        </button>
      </div>
    `;
    if (window.lucide) lucide.createIcons();
  }
}

// --- 7. WASTE SEARCH ENGINE ---
function initWasteSearch() {
  const searchInput = document.getElementById('wasteSearchInput');
  const searchBtn = document.getElementById('wasteSearchBtn');
  const resultContainer = document.getElementById('searchResultContainer');
  const searchChips = document.querySelectorAll('.search-chip');

  if (!searchInput) return;

  function performSearch(query) {
    if (!query || query.trim() === '') {
      if (resultContainer) resultContainer.style.display = 'none';
      return;
    }

    const cleanQuery = query.toLowerCase().trim();
    const matched = WASTE_DATABASE.find(item => 
      item.name.toLowerCase().includes(cleanQuery) ||
      item.category.toLowerCase().includes(cleanQuery) ||
      item.id.includes(cleanQuery)
    );

    if (matched) {
      renderSearchResult(matched);
    } else {
      renderNotFoundResult(query);
    }
  }

  if (searchBtn) {
    searchBtn.addEventListener('click', () => performSearch(searchInput.value));
  }

  if (searchInput) {
    searchInput.addEventListener('keyup', (e) => {
      if (e.key === 'Enter') performSearch(searchInput.value);
    });

    searchInput.addEventListener('input', (e) => {
      if (e.target.value.length >= 3) {
        performSearch(e.target.value);
      } else if (e.target.value.length === 0) {
        if (resultContainer) resultContainer.style.display = 'none';
      }
    });
  }

  searchChips.forEach(chip => {
    chip.addEventListener('click', () => {
      const term = chip.getAttribute('data-search') || chip.innerText.trim();
      searchInput.value = term;
      performSearch(term);
      searchChips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
    });
  });
}

function renderSearchResult(item) {
  const container = document.getElementById('searchResultContainer');
  if (!container) return;

  let badgeHtml = item.recyclable === true
    ? `<span class="badge badge-recyclable"><i data-lucide="check-circle-2"></i> Recyclable</span>`
    : item.recyclable === 'special'
    ? `<span class="badge badge-special"><i data-lucide="alert-triangle"></i> Special Drop-off</span>`
    : `<span class="badge badge-non-recyclable"><i data-lucide="x-circle"></i> Not Recyclable</span>`;

  const instructionsList = item.instructions
    .map(step => `<li><i data-lucide="check"></i> <span>${step}</span></li>`)
    .join('');

  container.innerHTML = `
    <div class="result-card">
      <div class="result-header">
        <div class="result-item-info">
          <h3>${item.name}</h3>
          <div class="result-category-meta">
            <span><strong>Category:</strong> ${item.category}</span>
          </div>
        </div>
        ${badgeHtml}
      </div>

      <div class="result-grid">
        <div class="result-box">
          <div class="result-box-label">Recommended Disposal</div>
          <div class="result-box-val">${item.disposalMethod}</div>
        </div>
        <div class="result-box">
          <div class="result-box-label">Kerbside Recyclability</div>
          <div class="result-box-val">${item.recyclable === true ? 'Kerbside Bin Acceptable' : item.recyclable === 'special' ? 'Drop-off Facility Only' : 'Landfill / General Waste'}</div>
        </div>
      </div>

      <div class="instructions-section">
        <h4><i data-lucide="info" style="color: var(--main-green)"></i> Step-by-Step Instructions</h4>
        <ul class="instructions-list">
          ${instructionsList}
        </ul>
      </div>

      <div class="result-footer-meta">
        <span><i data-lucide="shield-check" style="vertical-align: middle"></i> ${item.adminNote}</span>
        <button class="btn btn-sm btn-secondary" onclick="logSearchToActivity('${item.name}', '${item.category}', '${item.disposalMethod}')">
          <i data-lucide="bookmark"></i> Save to Dashboard Log
        </button>
      </div>
    </div>
  `;

  container.style.display = 'block';
  if (window.lucide) lucide.createIcons();
  container.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function renderNotFoundResult(query) {
  const container = document.getElementById('searchResultContainer');
  if (!container) return;

  container.innerHTML = `
    <div class="result-card" style="text-align: center; padding: 3rem 2rem;">
      <div style="font-size: 3rem; margin-bottom: 1rem;">🔍</div>
      <h3 style="margin-bottom: 0.5rem;">No item found for "${query}"</h3>
      <p style="color: var(--secondary-text); max-width: 500px; margin: 0 auto 1.5rem auto;">
        This item isn't in our instant index yet. Submit a guidance request to our Admin Operations queue.
      </p>
      <div style="display: flex; justify-content: center; gap: 1rem;">
        <button class="btn btn-primary" onclick="submitItemRequest('${query}')">
          Submit Request to Admin Queue
        </button>
        <button class="btn btn-secondary" onclick="document.getElementById('wasteSearchInput').value=''; document.getElementById('searchResultContainer').style.display='none';">
          Clear Search
        </button>
      </div>
    </div>
  `;
  container.style.display = 'block';
}

function submitItemRequest(itemName) {
  const currentUser = getCurrentUser() || { email: 'alex.johnson@example.com' };
  PENDING_SUBMISSIONS.unshift({
    id: 'req-' + Date.now(),
    name: itemName,
    category: 'Under Review',
    disposalMethod: 'Pending Admin Classification',
    submittedBy: currentUser.email || 'alex.johnson@example.com',
    dateSubmitted: 'Just Now',
    reason: 'Citizen requested guidance on unlisted item.'
  });
  showToast(`Item "${itemName}" submitted to Admin queue for review.`);
  document.getElementById('searchResultContainer').style.display = 'none';
}

// --- 8. LOCATION FINDER LOGIC ---
function initLocationFinder() {
  const locationSearch = document.getElementById('locationSearchInput');
  const typeFilter = document.getElementById('wasteTypeSelect');
  const searchBtn = document.getElementById('findLocationsBtn');
  const locationList = document.getElementById('locationListContainer');

  if (!locationList) return;

  function renderLocations(filterText = '', filterType = 'All') {
    const filtered = MOCK_LOCATIONS.filter(loc => {
      const matchText = loc.name.toLowerCase().includes(filterText.toLowerCase()) || 
                        loc.address.toLowerCase().includes(filterText.toLowerCase());
      const matchType = filterType === 'All' || loc.types.includes(filterType);
      return matchText && matchType;
    });

    if (filtered.length === 0) {
      locationList.innerHTML = `
        <div style="padding: 2rem; text-align: center; color: var(--secondary-text);">
          No recycling locations match your filter. Try selecting "All" waste types.
        </div>
      `;
      return;
    }

    locationList.innerHTML = filtered.map(loc => `
      <div class="location-card">
        <div class="location-card-header">
          <h4 class="location-name">${loc.name}</h4>
          <span class="location-distance">${loc.distance}</span>
        </div>
        <p class="location-meta"><i data-lucide="map-pin"></i> ${loc.address}</p>
        <p class="location-meta"><i data-lucide="clock"></i> ${loc.hours}</p>
        <p class="location-meta"><i data-lucide="phone"></i> ${loc.phone}</p>
        <div class="location-tags">
          ${loc.types.map(t => `<span class="location-tag">${t}</span>`).join('')}
        </div>
        <div style="margin-top: 1rem; display: flex; gap: 0.5rem;">
          <button class="btn btn-sm btn-primary" onclick="openDirectionsModal('${loc.name}')">
            View Directions
          </button>
          <button class="btn btn-sm btn-secondary" onclick="saveLocationToFav('${loc.name}')">
            <i data-lucide="heart"></i> Save Hub
          </button>
        </div>
      </div>
    `).join('');

    if (window.lucide) lucide.createIcons();
  }

  renderLocations();

  if (searchBtn) {
    searchBtn.addEventListener('click', () => {
      const text = locationSearch ? locationSearch.value : '';
      const type = typeFilter ? typeFilter.value : 'All';
      renderLocations(text, type);
    });
  }
}

function saveLocationToFav(locName) {
  showToast(`Saved ${locName} to your Favorite Drop-off Hubs.`);
}

// --- 9. MOBILE MENU LOGIC ---
function initMobileMenu() {
  const toggleBtn = document.getElementById('mobileMenuToggle');
  const navMenu = document.getElementById('navMenu');
  if (toggleBtn && navMenu) {
    toggleBtn.addEventListener('click', () => navMenu.classList.toggle('mobile-active'));
  }
}

// --- 10. AUTH FORMS & LOGIN LOGIC ---
function initAuthForms() {
  const loginForm = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');

  if (loginForm) {
    loginForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const email = document.getElementById('loginEmail').value;
      const pass = document.getElementById('loginPassword').value;
      const user = loginWithAccount(email, pass);
      showToast(`Login Successful! Welcome, ${user.name}. Redirecting...`);
      setTimeout(() => { window.location.href = 'dashboard.html'; }, 1000);
    });
  }

  if (registerForm) {
    registerForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = document.getElementById('regName').value || 'Alex Johnson';
      const email = document.getElementById('regEmail').value || 'alex@example.com';
      const user = loginWithAccount(email, 'Password123!');
      showToast(`Account created! Welcome, ${name}. Redirecting...`);
      setTimeout(() => { window.location.href = 'dashboard.html'; }, 1000);
    });
  }
}

// --- 11. DASHBOARD CONTROLLER & PERMISSION ENFORCEMENT ---
function initDashboard() {
  const dashboardMain = document.querySelector('.dashboard-main');
  if (!dashboardMain) return;

  const currentUser = getCurrentUser();
  const authLockOverlay = document.getElementById('authLockOverlay');

  if (!currentUser || !currentUser.loggedIn) {
    if (authLockOverlay) authLockOverlay.style.display = 'flex';
    return;
  } else {
    if (authLockOverlay) authLockOverlay.style.display = 'none';
  }

  // Update UI Elements with User Info & Role Badges
  const welcomeHeading = document.getElementById('welcomeHeading');
  const welcomeSub = document.getElementById('welcomeSub');
  const sidebarAvatar = document.getElementById('sidebarAvatar');
  const topActionBtn = document.getElementById('topActionBtn');

  // Update User Profiles
  document.querySelectorAll('.user-info-name').forEach(el => el.innerText = currentUser.name);
  document.querySelectorAll('.user-info-role').forEach(el => el.innerText = currentUser.roleTitle);

  if (sidebarAvatar) {
    sidebarAvatar.innerText = currentUser.avatar || (currentUser.role === 'admin' ? 'TN' : 'AJ');
  }

  const residentNav = document.getElementById('residentSidebarNav');
  const adminNav = document.getElementById('adminSidebarNav');

  if (currentUser.role === 'admin') {
    // ADMIN DASHBOARD SETUP
    if (welcomeHeading) welcomeHeading.innerText = `Dashboard`;
    if (welcomeSub) welcomeSub.innerText = 'Welcome, Tanu • City Environmental Protection Services Control Portal';
    
    if (topActionBtn) {
      topActionBtn.innerHTML = `<button class="btn btn-primary" onclick="openModal('addAdminItemModal')"><i data-lucide="plus-circle"></i> Publish Waste Rule</button>`;
    }

    if (residentNav) residentNav.style.display = 'none';
    if (adminNav) adminNav.style.display = 'flex';

    renderAdminWasteTable();
    renderAdminPendingQueue();
    switchDashboardTab('admin-tab');

  } else {
    // RESIDENT DASHBOARD SETUP
    if (welcomeHeading) welcomeHeading.innerText = `Dashboard`;
    if (welcomeSub) welcomeSub.innerText = 'Good Morning, Alex Johnson • Household Waste Separation & Collection Schedules';

    if (topActionBtn) {
      topActionBtn.innerHTML = `<button class="btn btn-primary" onclick="openModal('addActivityModal')"><i data-lucide="plus"></i> Log Recycled Item</button>`;
    }

    if (residentNav) residentNav.style.display = 'flex';
    if (adminNav) adminNav.style.display = 'none';

    renderResidentActivityTable();
    switchDashboardTab('overview-tab');
  }
}

// Permission Guarded Dashboard Module Switcher
function switchDashboardTab(tabId, el) {
  const currentUser = getCurrentUser();

  // STRICT AUTHORIZATION CHECK FOR ADMIN MODULES
  if (tabId.includes('admin') && (!currentUser || currentUser.role !== 'admin')) {
    showToast('⛔ Access Denied: Administrator account authorization required.');
    return;
  }

  document.querySelectorAll('.dash-module').forEach(m => m.style.display = 'none');
  document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('active'));

  const targetModule = document.getElementById(tabId);
  if (targetModule) {
    targetModule.style.display = 'block';
  }

  if (el) {
    el.classList.add('active');
  } else {
    // Auto highlight matching link
    const matchLink = document.querySelector(`.sidebar-link[onclick*="${tabId}"]`);
    if (matchLink) matchLink.classList.add('active');
  }

  if (window.lucide) lucide.createIcons();
}

// Render Resident Activity Log Table
function renderResidentActivityTable() {
  const tbody = document.getElementById('activityTableBody');
  if (!tbody) return;

  tbody.innerHTML = RESIDENT_ACTIVITY.map(entry => {
    let badgeClass = entry.status === 'Recycled' ? 'badge-recyclable' : entry.status === 'Drop-off' ? 'badge-special' : 'badge-non-recyclable';
    return `
      <tr>
        <td><strong>${entry.item}</strong></td>
        <td>${entry.category}</td>
        <td>${entry.disposal}</td>
        <td>${entry.date}</td>
        <td><span class="badge ${badgeClass}">${entry.status}</span></td>
      </tr>
    `;
  }).join('');
}

// Render Admin Master Database Table
function renderAdminWasteTable() {
  const tableBody = document.getElementById('adminWasteTableBody');
  const tableBody2 = document.getElementById('adminWasteTableBody2');
  if (!tableBody && !tableBody2) return;

  const html = WASTE_DATABASE.map(item => `
    <tr>
      <td><strong>${item.name}</strong></td>
      <td>${item.category}</td>
      <td>${item.disposalMethod}</td>
      <td>
        <span class="badge badge-recyclable">Published</span>
      </td>
      <td>
        <button class="btn btn-sm btn-secondary" onclick="openEditAdminItemModal('${item.id}')">
          <i data-lucide="edit"></i> Edit Rule
        </button>
      </td>
    </tr>
  `).join('');

  if (tableBody) tableBody.innerHTML = html;
  if (tableBody2) tableBody2.innerHTML = html;
  if (window.lucide) lucide.createIcons();
}

// Open Edit Modal for Admin
let currentEditingItemId = null;
function openEditAdminItemModal(itemId) {
  const item = WASTE_DATABASE.find(i => i.id === itemId);
  if (!item) return;

  currentEditingItemId = itemId;
  document.getElementById('editAdminName').value = item.name;
  document.getElementById('editAdminCategory').value = item.category;
  document.getElementById('editAdminDisposal').value = item.disposalMethod;

  openModal('editAdminItemModal');
}

function saveEditedAdminWasteItem(e) {
  e.preventDefault();
  if (!currentEditingItemId) return;

  const item = WASTE_DATABASE.find(i => i.id === currentEditingItemId);
  if (item) {
    item.name = document.getElementById('editAdminName').value;
    item.category = document.getElementById('editAdminCategory').value;
    item.disposalMethod = document.getElementById('editAdminDisposal').value;
    item.updatedDate = 'Just Now';
    item.adminNote = 'Updated by Tanu (Admin)';

    renderAdminWasteTable();
    closeModal('editAdminItemModal');
    showToast(`Waste rule for "${item.name}" updated successfully!`);
  }
}

// Render Admin Pending Submissions Queue Table
function renderAdminPendingQueue() {
  const container = document.getElementById('adminPendingQueueContainer');
  const container2 = document.getElementById('adminPendingQueueContainer2');
  const countBadge = document.getElementById('pendingCountBadge');

  if (countBadge) countBadge.innerText = PENDING_SUBMISSIONS.length;

  if (!container && !container2) return;

  let html = '';
  if (PENDING_SUBMISSIONS.length === 0) {
    html = `<div style="padding: 1.5rem; text-align: center; color: var(--secondary-text);">No pending item submissions from citizens. All items reviewed!</div>`;
  } else {
    html = PENDING_SUBMISSIONS.map((req, idx) => `
      <div style="background-color: var(--white); border: 1px solid var(--border-light); border-radius: var(--radius-md); padding: 1.25rem; display: flex; align-items: center; justify-content: space-between; gap: 1rem;">
        <div>
          <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.25rem;">
            <h4 style="font-size: 1.1rem; color: var(--dark-text);">${req.name}</h4>
            <span class="badge badge-special">Submitted ${req.dateSubmitted}</span>
          </div>
          <p style="font-size: 0.875rem; color: var(--secondary-text); margin-bottom: 0.25rem;">
            <strong>Category:</strong> ${req.category} | <strong>Target Disposal:</strong> ${req.disposalMethod}
          </p>
          <p style="font-size: 0.8rem; color: var(--secondary-text); italic;">
            Submitted by ${req.submittedBy} • Note: "${req.reason}"
          </p>
        </div>

        <div style="display: flex; gap: 0.5rem; flex-shrink: 0;">
          <button class="btn btn-sm btn-primary" onclick="approvePendingItem(${idx})">
            <i data-lucide="check"></i> Approve & Publish
          </button>
          <button class="btn btn-sm btn-secondary" onclick="rejectPendingItem(${idx})" style="color: var(--error);">
            <i data-lucide="x"></i> Reject
          </button>
        </div>
      </div>
    `).join('');
  }

  if (container) container.innerHTML = html;
  if (container2) container2.innerHTML = html;
  if (window.lucide) lucide.createIcons();
}

function approvePendingItem(index) {
  const req = PENDING_SUBMISSIONS[index];
  if (req) {
    WASTE_DATABASE.unshift({
      id: req.id,
      name: req.name,
      category: req.category === 'Under Review' ? 'Metal' : req.category,
      recyclable: true,
      disposalMethod: req.disposalMethod === 'Pending Admin Classification' ? 'Yellow Recycling Bin' : req.disposalMethod,
      instructions: ['Follow verified municipal disposal rules.'],
      adminNote: 'Approved by Tanu (Admin)',
      status: 'Published',
      updatedDate: 'Just Now'
    });

    PENDING_SUBMISSIONS.splice(index, 1);
    renderAdminWasteTable();
    renderAdminPendingQueue();
    showToast(`Approved "${req.name}"! Rule published to search database.`);
  }
}

function rejectPendingItem(index) {
  const req = PENDING_SUBMISSIONS[index];
  if (req) {
    PENDING_SUBMISSIONS.splice(index, 1);
    renderAdminPendingQueue();
    showToast(`Item "${req.name}" rejected.`);
  }
}

function addAdminWasteItem(e) {
  e.preventDefault();
  const currentUser = getCurrentUser();
  if (!currentUser || currentUser.role !== 'admin') {
    showToast('⛔ Access Denied: Only Administrators can publish system rules.');
    return;
  }

  const name = document.getElementById('adminNewName').value;
  const category = document.getElementById('adminNewCategory').value;
  const disposal = document.getElementById('adminNewDisposal').value;

  WASTE_DATABASE.unshift({
    id: name.toLowerCase().replace(/\s+/g, '-'),
    name: name,
    category: category,
    recyclable: true,
    disposalMethod: disposal,
    instructions: ['Follow standard kerbside recycling rules.'],
    adminNote: 'Added by Tanu (Admin)',
    status: 'Published',
    updatedDate: 'Just Now'
  });

  renderAdminWasteTable();
  closeModal('addAdminItemModal');
  showToast(`Successfully published "${name}" to system database.`);
}

function logSearchToActivity(name, category, disposal) {
  showToast(`Saved "${name}" to your Activity Log.`);
  const today = new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit' });
  RESIDENT_ACTIVITY.unshift({ id: Date.now(), item: name, category: category, disposal: disposal, date: today, status: 'Recycled' });
  renderResidentActivityTable();
}

// --- 12. UTILITY TOAST & MODAL ENGINE ---
function showToast(message) {
  let toastContainer = document.getElementById('toastContainer');
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'toastContainer';
    toastContainer.className = 'toast-container';
    document.body.appendChild(toastContainer);
  }

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `<i data-lucide="info"></i> <span>${message}</span>`;
  toastContainer.appendChild(toast);

  if (window.lucide) lucide.createIcons();

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(50px)';
    setTimeout(() => toast.remove(), 300);
  }, 3200);
}

function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.add('active');
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.remove('active');
}

function openDirectionsModal(locationName) {
  alert(`GPS Route Navigation: Displaying optimal route to ${locationName}.`);
}
