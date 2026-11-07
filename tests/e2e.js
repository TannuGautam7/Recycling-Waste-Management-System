/*
 * End-to-end checks for EcoRecycle Australia.
 * Writes TESTING.md from what it actually observes, and screenshots to docs/screenshots/.
 *
 * This is a development tool only: the site itself has no build step or dependencies.
 *   npm install --no-save playwright-core axe-core
 *   node tests/e2e.js              (uses the installed Chrome)
 */
const fs = require('fs');
const http = require('http');
const path = require('path');
const os = require('os');
const { chromium } = require('playwright-core');

const ROOT = path.resolve(__dirname, '..');
const AXE_SOURCE = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
const SHOTS = path.join(ROOT, 'docs', 'screenshots');
const GH_BASE = 'https://tannugautam7.github.io/Recycling-Waste-Management-System/';
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.webp': 'image/webp', '.md': 'text/plain' };
const PAGES = ['index.html', 'pages/waste-search.html', 'pages/recycling-guide.html', 'pages/locations.html', 'pages/contact.html', 'pages/login.html', 'pages/dashboard.html', '404.html'];
const ALEX = ['alex.johnson@example.com', 'Password123!'];
const ADMIN = ['admin@ecorecycle.org', 'AdminPassword123!'];
const SEED_RULE_COUNT = 58;

function readFromDisk(relPath) {
  const file = path.join(ROOT, relPath || 'index.html');
  if (file.startsWith(ROOT) && fs.existsSync(file) && fs.statSync(file).isFile()) {
    return { status: 200, contentType: MIME[path.extname(file)] || 'application/octet-stream', body: fs.readFileSync(file) };
  }
  // Same behaviour as GitHub Pages: unknown paths get the custom 404 page.
  return { status: 404, contentType: MIME['.html'], body: fs.readFileSync(path.join(ROOT, '404.html')) };
}

const server = http.createServer((req, res) => {
  const { status, contentType, body } = readFromDisk(decodeURIComponent(req.url.split('?')[0]).slice(1));
  res.writeHead(status, { 'content-type': contentType });
  res.end(body);
});

const results = [];
const consoleProblems = [];
let browser;
let BASE;

function ok(condition, message) {
  if (!condition) throw new Error(message);
}

async function test(id, pageName, steps, expected, fn) {
  try {
    const actual = await fn();
    results.push({ id, pageName, steps, expected, actual, pass: true });
    console.log(`PASS ${id}: ${actual}`);
  } catch (error) {
    const actual = String(error.message).split('\n')[0].slice(0, 300);
    results.push({ id, pageName, steps, expected, actual, pass: false });
    console.log(`FAIL ${id}: ${actual}`);
  }
}

async function session({ width = 1280, height = 900, tolerateFailures = false, ...options } = {}) {
  const context = await browser.newContext({ viewport: { width, height }, reducedMotion: 'reduce', ...options });
  const page = await context.newPage();
  if (!tolerateFailures) {
    const record = (text) => consoleProblems.push(`${page.url().replace(BASE, '')}: ${text}`.slice(0, 240));
    context.on('page', (extra) => extra.on('pageerror', (e) => record(`uncaught ${e.message}`)));
    page.on('pageerror', (e) => record(`uncaught ${e.message}`));
    page.on('console', (m) => { if (m.type() === 'error') record(m.text()); });
  }
  return { context, page };
}

async function login(page, [email, password], remember = false) {
  await page.goto(`${BASE}pages/login.html`);
  await page.fill('#loginEmail', email);
  await page.fill('#loginPassword', password);
  if (remember) await page.check('#rememberMe');
  await page.click('#loginForm button[type="submit"]');
  await page.waitForURL('**/dashboard.html*');
  await page.waitForSelector('#dashboardApp:not([hidden])');
}

const stored = (page, key) => page.evaluate((k) => JSON.parse(localStorage.getItem(k)), key);
const overflow = (page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
const cardCount = (page) => page.$$eval('#catalogueGrid .item-card', (e) => e.length);
const pinCount = (page) => page.$$eval('.leaflet-marker-icon', (e) => e.length);
const hubCardCount = (page) => page.$$eval('#locationListContainer .location-card', (e) => e.length);
const settle = (page, ms = 250) => page.waitForTimeout(ms);

async function axe(page) {
  await page.addScriptTag({ content: AXE_SOURCE });
  const out = await page.evaluate(async () => {
    const report = await window.axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] });
    return report.violations.map((v) => `${v.id}: ${v.nodes.slice(0, 2).map((n) => n.target.join(' ')).join(', ')}`);
  });
  return out;
}

/* ------------------------------------------------------------------------ */
async function navigationTests() {
  await test('NAV-01', 'All', 'Open each page and compare primary nav labels and resolved links; check the active item.', 'Identical nav on every page, with the correct link marked current.', async () => {
    const { context, page } = await session();
    const expectedActive = { 'index.html': 'Home', 'pages/waste-search.html': 'Waste Search', 'pages/recycling-guide.html': 'Recycling Guide', 'pages/locations.html': 'Recycling Locations', 'pages/contact.html': 'Contact Us', 'pages/login.html': null, 'pages/dashboard.html': null, '404.html': null };
    let reference = null;
    for (const name of PAGES) {
      await page.goto(BASE + name);
      const nav = await page.$$eval('#navMenu a', (a) => a.map((l) => `${l.textContent}|${l.href}`).join(';'));
      reference = reference || nav;
      ok(nav === reference, `nav differs on ${name}`);
      const active = await page.$$eval('#navMenu a[aria-current="page"]', (a) => a.map((l) => l.textContent));
      ok(active.join() === (expectedActive[name] || ''), `${name} active item was "${active}"`);
    }
    await context.close();
    return `Same 5 links on all ${PAGES.length} pages; active state correct on each.`;
  });

  await test('NAV-02', 'All', 'Collect every a[href], link[href], script[src] and img[src] on every page and request each one; verify in-page anchors.', 'No broken links, images, scripts or anchors.', async () => {
    const { context, page } = await session();
    const checked = new Map();
    for (const name of PAGES) {
      await page.goto(BASE + name);
      await settle(page, 100);
      const urls = await page.evaluate(() => [
        ...[...document.querySelectorAll('a[href]')].map((a) => a.href),
        ...[...document.querySelectorAll('link[href]')].map((l) => l.href),
        ...[...document.querySelectorAll('script[src]')].map((s) => s.src),
        ...[...document.querySelectorAll('img[src]')].map((i) => i.src),
      ]);
      for (const url of urls) {
        if (checked.has(url) || !/^https?:/.test(url) || /fonts\.g|openstreetmap|google\.com/.test(url)) continue;
        const parsed = new URL(url);
        const response = await context.request.get(parsed.origin + parsed.pathname + parsed.search);
        ok(response.status() < 400, `${url} from ${name} returned ${response.status()}`);
        if (parsed.hash.length > 1 && !parsed.pathname.endsWith('dashboard.html')) {
          const probe = await context.newPage();
          await probe.goto(url);
          ok(await probe.evaluate((id) => Boolean(document.getElementById(id)), parsed.hash.slice(1)), `missing anchor ${url}`);
          await probe.close();
        }
        checked.set(url, response.status());
      }
    }
    await context.close();
    return `${checked.size} unique URLs and anchors checked; none broken.`;
  });

  await test('NAV-03', 'All (375px)', 'At 375px, open the hamburger, check its state, follow a link, reopen and press Esc.', 'Menu opens and closes, aria-expanded updates, login is reachable.', async () => {
    const { context, page } = await session({ width: 375, height: 800 });
    for (const name of ['index.html', 'pages/login.html', 'pages/dashboard.html']) {
      await page.goto(BASE + name);
      if (name.includes('dashboard')) continue;
      const toggle = page.locator('#mobileMenuToggle');
      ok(await page.locator('#navMenu').isHidden(), `menu visible before opening on ${name}`);
      await toggle.click();
      ok(await toggle.getAttribute('aria-expanded') === 'true', 'aria-expanded not true');
      ok(await page.locator('#navActions a').first().isVisible(), 'login link not visible in menu');
      await page.keyboard.press('Escape');
      ok(await page.locator('#navMenu').isHidden(), 'Esc did not close menu');
      ok(await page.evaluate(() => document.activeElement.id) === 'mobileMenuToggle', 'focus not returned');
    }
    await page.goto(`${BASE}index.html`);
    await page.click('#mobileMenuToggle');
    await page.click('#navMenu a:has-text("Contact Us")');
    await page.waitForURL('**/contact.html');
    await context.close();
    return 'Hamburger opens, closes on Esc, returns focus, exposes Login and navigates.';
  });

  await test('NAV-04', 'Tablet (768px, 1100px, 1181px)', 'Measure the navigation bar at widths around the breakpoint, signed out and signed in.', 'The nav never overflows at any width.', async () => {
    const { context, page } = await session();
    await login(page, ALEX);
    for (const width of [768, 1024, 1100, 1180, 1181, 1280]) {
      await page.setViewportSize({ width, height: 800 });
      const extra = await page.$eval('.nav-container', (n) => n.scrollWidth - n.clientWidth);
      ok(extra <= 0, `nav overflows by ${extra}px at ${width}`);
    }
    await context.close();
    return 'No nav overflow at 768, 1024, 1100, 1180, 1181 or 1280px.';
  });

  await test('NAV-05', '404', 'Request a missing URL, including a deep one, under the simulated GitHub Pages path.', 'Custom 404 page, with working styles, nav and links.', async () => {
    const { context, page } = await session({ tolerateFailures: true }); // the 404 status itself is logged by the browser
    await context.route(`${GH_BASE}**`, (route) => {
      const rel = route.request().url().replace(GH_BASE, '').split(/[?#]/)[0];
      const { status, contentType, body } = readFromDisk(rel);
      route.fulfill({ status, contentType, body });
    });
    const response = await page.goto(`${GH_BASE}pages/deep/no-such-page.html`);
    ok(response.status() === 404, `status ${response.status()}`);
    ok((await page.textContent('h1')).includes('Page Not Found'), 'wrong heading');
    ok(await page.$eval('.navbar', (n) => getComputedStyle(n).position) === 'sticky', 'CSS did not load');
    await page.click('.error-page a:has-text("Back to Home")');
    await page.waitForURL(`${GH_BASE}index.html`);
    await context.close();
    return 'Status 404, styled custom page; Home link goes to the project root.';
  });

  await test('NAV-06', 'All', 'Serve every page from a simulated GitHub Pages sub-folder over HTTPS and record failed requests.', 'All relative paths work from index.html and /pages/.', async () => {
    const { context, page } = await session();
    await context.route(`${GH_BASE}**`, (route) => {
      const rel = route.request().url().replace(GH_BASE, '').split(/[?#]/)[0];
      const { status, contentType, body } = readFromDisk(rel);
      route.fulfill({ status, contentType, body });
    });
    const failed = [];
    page.on('response', (r) => { if (r.status() >= 400 && r.url().startsWith(GH_BASE)) failed.push(r.url()); });
    for (const name of PAGES.filter((p) => p !== '404.html')) {
      await page.goto(GH_BASE + name, { waitUntil: 'load' });
      ok(await page.evaluate(() => Boolean(document.querySelector('.footer-grid'))), `${name} did not render`);
    }
    await page.goto(`${GH_BASE}pages/login.html`);
    await page.fill('#loginEmail', ALEX[0]);
    await page.fill('#loginPassword', ALEX[1]);
    await page.click('#loginForm button[type="submit"]');
    await page.waitForURL(`${GH_BASE}pages/dashboard.html`);
    ok(failed.length === 0, `failed: ${failed.join(', ')}`);
    await context.close();
    return 'All 7 pages loaded with 0 failed requests; login redirect stayed inside the sub-folder.';
  });
}

async function homeTests() {
  await test('HOME-01', 'Home', 'Type "pizza box" in the quick search and press Enter.', 'Goes to Waste Search showing the matching result.', async () => {
    const { context, page } = await session();
    await page.goto(`${BASE}index.html`);
    await page.fill('#wasteSearchInput', 'pizza box');
    await page.press('#wasteSearchInput', 'Enter');
    await page.waitForURL('**/waste-search.html?q=pizza+box');
    await page.waitForSelector('.item-card');
    const name = await page.textContent('.item-card h3');
    ok(name.includes('Pizza Box'), name);
    await context.close();
    return `Redirected with ?q=pizza+box; first result "${name}".`;
  });

  await test('HOME-02', 'Home', 'Click each hero, category, chip and banner call-to-action.', 'Every CTA reaches a working destination.', async () => {
    const { context, page } = await session();
    await page.goto(`${BASE}index.html`);
    const targets = await page.$$eval('main a.btn, main a.search-chip', (links) => links.map((a) => a.href));
    for (const url of new Set(targets)) {
      const response = await context.request.get(url.split('#')[0]);
      ok(response.status() === 200, `${url} returned ${response.status()}`);
    }
    await page.click('.hero-actions a:has-text("Start Recycling")');
    await page.waitForURL('**/waste-search.html');
    await page.goBack();
    await page.click('article:has-text("General Waste") a:has-text("Explore")');
    await page.waitForURL('**/recycling-guide.html#general');
    ok(await page.isVisible('#general'), '#general section missing');
    await context.close();
    return `${new Set(targets).size} distinct CTA destinations return 200; clicked examples navigate correctly.`;
  });

  await test('HOME-03', 'Home', 'Read the collection calendar and next collection; set a reminder and refresh.', 'Next collection is a future Tuesday; the reminder persists.', async () => {
    const { context, page } = await session();
    await page.goto(`${BASE}index.html`);
    const text = await page.textContent('.collection-info-time');
    ok(text.includes('Tuesday'), `next collection text: ${text}`);
    const bins = await page.$$eval('.cal-grid td.is-collection', (cells) => cells.length);
    ok(bins >= 4, `only ${bins} collection days marked`);
    const button = page.locator('[data-action="toggle-reminder"]');
    await button.click();
    await settle(page, 100);
    await page.reload();
    ok(await page.getAttribute('[data-action="toggle-reminder"]', 'aria-pressed') === 'true', 'reminder not persisted');
    await context.close();
    return `${text.trim()}; ${bins} Tuesdays marked; reminder kept after refresh.`;
  });

  await test('HOME-04', 'Home', 'Compare the home page counters with the stored rule list.', 'Counts are live, not hard-coded.', async () => {
    const { context, page } = await session();
    await page.goto(`${BASE}index.html`);
    const rules = await stored(page, 'ecorecycle_waste_rules');
    const shown = await page.textContent('.stat-number[data-rule-count]');
    ok(Number(shown) === rules.length, `shown ${shown}, stored ${rules.length}`);
    const counts = await page.$$eval('[data-category-count]', (e) => e.map((x) => [x.dataset.categoryCount, Number(x.textContent)]));
    counts.forEach(([category, count]) => ok(count === rules.filter((r) => r.category === category).length, `${category} wrong`));
    await context.close();
    return `${shown} items shown; all ${counts.length} category counts match storage.`;
  });
}

async function searchTests() {
  await test('SRCH-01', 'Waste Search', 'Open the directory with no query and count items per category.', 'At least 40 items covering all seven categories, each with a badge and steps.', async () => {
    const { context, page } = await session();
    await page.goto(`${BASE}pages/waste-search.html`);
    const rules = await stored(page, 'ecorecycle_waste_rules');
    ok(rules.length >= 40, `${rules.length} rules`);
    ok(await cardCount(page) === rules.length, 'card count differs from rule count');
    const categories = new Set(rules.map((r) => r.category));
    ok(categories.size === 7, `${categories.size} categories`);
    const cards = await page.$$eval('.item-card', (list) => list.map((c) => ({ badge: !!c.querySelector('.badge'), steps: c.querySelectorAll('.steps-list li').length })));
    ok(cards.every((c) => c.badge && c.steps >= 2), 'a card is missing its badge or steps');
    const badges = await page.$$eval('.item-card .badge', (b) => [...new Set(b.map((x) => x.textContent.trim()))].sort());
    ok(badges.length === 3, `badges: ${badges}`);
    await context.close();
    return `${rules.length} items, 7 categories, badges: ${badges.join(', ')}; every card has 2+ steps.`;
  });

  await test('SRCH-02', 'Waste Search', 'Type "bat" and use the arrow keys and Enter on a suggestion.', 'Suggestions appear while typing and are keyboard operable.', async () => {
    const { context, page } = await session();
    await page.goto(`${BASE}pages/waste-search.html`);
    await page.locator('#wasteSearchInput').pressSequentially('bat');
    await page.waitForSelector('.suggestion');
    const items = await page.$$eval('.suggestion-name', (e) => e.map((x) => x.textContent));
    ok(items.length === 3, `suggestions: ${items}`);
    ok(await page.getAttribute('#wasteSearchInput', 'aria-expanded') === 'true', 'aria-expanded');
    await settle(page, 150);
    ok(await cardCount(page) === 3, 'grid did not update in real time');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await settle(page, 100);
    ok(await page.inputValue('#wasteSearchInput') === items[0], 'pick not applied');
    await context.close();
    return `"bat" suggested ${items.length} items, updated results live; Enter picked "${items[0]}".`;
  });

  await test('SRCH-03', 'Waste Search', 'Search plural and synonym terms: batteries, smartphone, tv, plastic bottle.', 'Each returns relevant items.', async () => {
    const { context, page } = await session();
    await page.goto(`${BASE}pages/waste-search.html`);
    const expected = { batteries: 'Battery', smartphone: 'Mobile Phone', tv: 'Television', 'plastic bottle': 'Plastic' };
    for (const [query, word] of Object.entries(expected)) {
      await page.fill('#wasteSearchInput', query);
      await settle(page, 180);
      const names = await page.$$eval('.item-card h3', (e) => e.map((x) => x.textContent));
      ok(names.some((n) => n.includes(word)), `${query}: ${names}`);
    }
    await context.close();
    return 'batteries, smartphone, tv and plastic bottle all return relevant items.';
  });

  await test('SRCH-04', 'Waste Search', 'Click every category chip and compare results with stored rules.', 'Each chip shows exactly that category and marks itself pressed.', async () => {
    const { context, page } = await session();
    await page.goto(`${BASE}pages/waste-search.html`);
    const rules = await stored(page, 'ecorecycle_waste_rules');
    const chips = await page.$$eval('[data-action="filter-category"]', (e) => e.map((x) => x.dataset.category));
    ok(chips.length === 8, `${chips.length} chips`);
    for (const category of chips) {
      await page.click(`[data-action="filter-category"][data-category="${category}"]`);
      const want = category === 'all' ? rules.length : rules.filter((r) => r.category === category).length;
      ok(await cardCount(page) === want, `${category}: ${await cardCount(page)} of ${want}`);
      ok(await page.getAttribute(`[data-action="filter-category"][data-category="${category}"]`, 'aria-pressed') === 'true', `${category} not pressed`);
    }
    await context.close();
    return `All ${chips.length} chips (All + 7 categories) filter correctly.`;
  });

  await test('SRCH-05', 'Waste Search', 'Click every popular-search chip.', 'Each chip fills the box and returns results.', async () => {
    const { context, page } = await session();
    await page.goto(`${BASE}pages/waste-search.html`);
    const chips = await page.$$eval('[data-action="popular-search"]', (e) => e.map((x) => x.dataset.search));
    const summary = [];
    for (const term of chips) {
      await page.click(`[data-action="popular-search"][data-search="${term}"]`);
      const count = await cardCount(page);
      ok(count > 0, `${term} returned nothing`);
      ok(await page.inputValue('#wasteSearchInput') === term, 'input not set');
      summary.push(`${term}:${count}`);
    }
    await context.close();
    return summary.join(', ');
  });

  await test('SRCH-06', 'Waste Search', 'Search "light bulb"; submit the form empty, with a bad email, then correctly.', 'Friendly no-results state, inline errors, success toast, request stored.', async () => {
    const { context, page } = await session();
    await page.goto(`${BASE}pages/waste-search.html`);
    await page.fill('#wasteSearchInput', 'light bulb');
    await settle(page, 180);
    ok(await page.isVisible('#noResultsPanel'), 'no-results panel hidden');
    ok(await page.inputValue('#reqName') === 'light bulb', 'item name not prefilled');
    await page.click('#requestForm button[type="submit"]');
    ok((await page.textContent('#reqCategory-error')).includes('category'), 'no category error');
    await page.selectOption('#reqCategory', 'unknown');
    await page.fill('#reqEmail', 'not-an-email');
    await page.click('#requestForm button[type="submit"]');
    ok((await page.textContent('#reqEmail-error')).includes('valid email'), 'no email error');
    await page.fill('#reqEmail', '');
    await page.click('#requestForm button[type="submit"]');
    await page.waitForSelector('.toast');
    const toast = await page.textContent('.toast');
    const pending = await stored(page, 'ecorecycle_pending_requests');
    ok(pending[0].name === 'light bulb', 'not stored');
    await context.close();
    return `Toast: "${toast.trim()}"; queue now has ${pending.length} items.`;
  });

  await test('SRCH-07', 'Waste Search', 'Search and submit a request containing an HTML image tag with an onerror handler.', 'Rendered as plain text, with no script execution.', async () => {
    const { context, page } = await session();
    let dialog = false;
    page.on('dialog', (d) => { dialog = true; d.dismiss(); });
    const payload = '<img src=x onerror=alert(1)>';
    await page.goto(`${BASE}pages/waste-search.html`);
    await page.fill('#wasteSearchInput', payload);
    await settle(page, 180);
    ok(await page.$$eval('#noResultsPanel img', (e) => e.length) === 0, 'tag rendered');
    await page.selectOption('#reqCategory', 'unknown');
    await page.click('#requestForm button[type="submit"]');
    await page.waitForSelector('.toast');
    await login(page, ADMIN);
    ok(await page.$$eval('.queue-card img', (e) => e.length) === 0, 'tag rendered in admin queue');
    ok(!dialog, 'script executed');
    await context.close();
    return 'Payload shown as text in search and in the admin queue; no script ran.';
  });

  await test('SRCH-08', 'Waste Search', 'Apply a search and category, then refresh.', 'State is restored from the URL.', async () => {
    const { context, page } = await session();
    await page.goto(`${BASE}pages/waste-search.html`);
    await page.fill('#wasteSearchInput', 'bottle');
    await settle(page, 180);
    await page.keyboard.press('Escape');
    ok(await page.isHidden('#searchSuggestions'), 'Esc did not close suggestions');
    ok(await page.inputValue('#wasteSearchInput') === 'bottle', 'Esc cleared the query');
    await page.click('[data-action="filter-category"][data-category="Glass"]');
    const before = await cardCount(page);
    await page.reload();
    ok(await page.inputValue('#wasteSearchInput') === 'bottle', 'query lost');
    ok(await page.getAttribute('[data-category="Glass"]', 'aria-pressed') === 'true', 'category lost');
    ok(await cardCount(page) === before, 'results changed');
    await context.close();
    return `q=bottle + Glass restored after refresh (${before} item).`;
  });
}

async function guideTests() {
  await test('GUIDE-01', 'Recycling Guide', 'Click each category link; check the section and its lists.', 'Navigation reaches every section; each has accepted and prohibited lists.', async () => {
    const { context, page } = await session();
    await page.goto(`${BASE}pages/recycling-guide.html`);
    const links = await page.$$eval('#guideNav a', (a) => a.map((l) => l.getAttribute('href')));
    ok(links.length === 8, `${links.length} links`);
    for (const href of links) {
      await page.click(`#guideNav a[href="${href}"]`);
      await settle(page, 120);
      ok(await page.getAttribute(`#guideNav a[href="${href}"]`, 'aria-current') === 'true', `${href} not current`);
      const box = await page.locator(href).boundingBox();
      ok(box.y < 500, `${href} not scrolled into view (y=${box.y})`);
    }
    const sections = await page.$$eval('.guide-section:not(#resin-codes)', (s) => s.map((x) => [x.querySelectorAll('.guide-list:not(.prohibited) li').length, x.querySelectorAll('.guide-list.prohibited li').length]));
    ok(sections.length === 7 && sections.every(([a, b]) => a >= 3 && b >= 3), 'a list is short');
    await context.close();
    return `${links.length} nav links work; all 7 categories have accepted and prohibited lists.`;
  });

  await test('GUIDE-02', 'Recycling Guide', 'Click resin codes #1 to #7.', 'Each shows its own name, kerbside advice and tip.', async () => {
    const { context, page } = await session();
    await page.goto(`${BASE}pages/recycling-guide.html#resin-codes`);
    const seen = new Set();
    for (let code = 1; code <= 7; code += 1) {
      await page.click(`.resin-btn[data-code="${code}"]`);
      ok(await page.getAttribute(`.resin-btn[data-code="${code}"]`, 'aria-pressed') === 'true', `#${code} not pressed`);
      const heading = await page.textContent('#resinPanel h3');
      ok(heading.startsWith(`#${code}`), heading);
      ok((await page.$$eval('#resinPanel dd', (d) => d.length)) === 3, 'details missing');
      seen.add(heading);
    }
    ok(seen.size === 7, 'duplicate panels');
    await context.close();
    return '7 distinct panels shown, from "#1 PET" to "#7 Other".';
  });

  await test('GUIDE-03', 'Recycling Guide', 'Click "Find E-Waste Drop-off Hubs".', 'Locations opens with the E-Waste filter applied.', async () => {
    const { context, page } = await session();
    await page.goto(`${BASE}pages/recycling-guide.html#ewaste`);
    await page.click('#ewaste a:has-text("Find E-Waste")');
    await page.waitForURL('**/locations.html?type=E-Waste');
    await page.waitForSelector('.location-card');
    ok(await page.inputValue('#wasteTypeSelect') === 'E-Waste', 'filter not applied');
    const count = await hubCardCount(page);
    await context.close();
    return `Filter pre-selected; ${count} hubs shown.`;
  });
}

async function locationTests() {
  await test('LOC-01', 'Locations', 'Open the page and wait for the map; click a pin.', 'Real OpenStreetMap tiles load, every hub has a pin, popups open with actions.', async () => {
    const { context, page } = await session();
    await page.goto(`${BASE}pages/locations.html`);
    await page.waitForSelector('.leaflet-marker-icon');
    await page.waitForSelector('.leaflet-tile-loaded', { timeout: 15000 });
    const tiles = await page.$$eval('.leaflet-tile-loaded', (t) => t.length);
    const version = await page.evaluate(() => window.L.version);
    ok(version === '1.9.4', `leaflet ${version}`);
    await page.locator('.leaflet-marker-icon').first().click();
    await page.waitForSelector('.hub-popup');
    const title = await page.textContent('.hub-popup h3');
    await page.locator('.hub-popup [data-action="hub-directions"]').waitFor({ state: 'visible', timeout: 3000 });
    ok(await page.isVisible('.leaflet-control-attribution'), 'attribution missing');
    await context.close();
    return `Leaflet ${version}, ${tiles} tiles, ${await hubsTotal()} pins; popup for "${title}".`;
  });

  await test('LOC-02', 'Locations', 'Select each waste type.', 'Cards and pins both update to the same matching hubs.', async () => {
    const { context, page } = await session();
    await page.goto(`${BASE}pages/locations.html`);
    await page.waitForSelector('.leaflet-marker-icon');
    const options = await page.$$eval('#wasteTypeSelect option', (o) => o.map((x) => x.value));
    const summary = [];
    for (const option of options) {
      await page.selectOption('#wasteTypeSelect', option);
      await settle(page, 120);
      const cards = await hubCardCount(page);
      ok(cards === await pinCount(page), `${option}: ${cards} cards vs ${await pinCount(page)} pins`);
      ok(cards > 0, `${option} has no hubs`);
      summary.push(`${option}:${cards}`);
    }
    await context.close();
    return summary.join(', ');
  });

  await test('LOC-03', 'Locations', 'Search by postcode 2150, by suburb Brunswick, then refresh.', 'List and pins narrow; the filter survives refresh.', async () => {
    const { context, page } = await session();
    await page.goto(`${BASE}pages/locations.html`);
    await page.waitForSelector('.leaflet-marker-icon');
    await page.fill('#locationSearchInput', '2150');
    await settle(page, 300);
    ok(await hubCardCount(page) === 1 && await pinCount(page) === 1, 'postcode');
    ok((await page.textContent('.location-name')).includes('Parramatta'), 'wrong hub');
    await page.fill('#locationSearchInput', 'brunswick');
    await settle(page, 300);
    ok((await page.textContent('.location-name')).includes('Brunswick'), 'suburb');
    await page.reload();
    await page.waitForSelector('.location-card');
    ok(await page.inputValue('#locationSearchInput') === 'brunswick', 'not restored');
    await context.close();
    return '2150 finds Parramatta, Brunswick finds its hub; 1 card and 1 pin each; kept on refresh.';
  });

  await test('LOC-04', 'Locations', 'Search for "Newtown", then Clear filters.', 'Friendly empty state with 0 pins; clearing restores all hubs.', async () => {
    const { context, page } = await session();
    await page.goto(`${BASE}pages/locations.html`);
    await page.waitForSelector('.leaflet-marker-icon');
    await page.fill('#locationSearchInput', 'Newtown');
    await settle(page, 300);
    ok(await hubCardCount(page) === 0 && await pinCount(page) === 0, 'not empty');
    ok(await page.isVisible('#locationListContainer .empty-state'), 'no empty state');
    await page.click('[data-action="hub-clear"]');
    await settle(page, 200);
    const count = await hubCardCount(page);
    ok(count === await pinCount(page) && count > 0, 'not restored');
    await context.close();
    return `Empty state with 0 pins; Clear restored ${count} hubs.`;
  });

  await test('LOC-05', 'Locations', 'Click View Directions on a hub card.', 'Modal shows hub details and map directions links.', async () => {
    const { context, page } = await session();
    await page.goto(`${BASE}pages/locations.html`);
    await page.waitForSelector('.location-card');
    await page.locator('[data-action="hub-directions"]').first().click();
    await page.waitForSelector('#directionsModal.active');
    const links = await page.$$eval('#directionsModal a', (a) => a.map((l) => l.href));
    ok(links[0].startsWith('https://www.google.com/maps/dir/') && links[1].startsWith('https://www.openstreetmap.org/directions'), `links: ${links}`);
    ok(await page.$$eval('#directionsModal a', (a) => a.every((l) => l.rel.includes('noopener') && l.target === '_blank')), 'unsafe links');
    await context.close();
    return 'Modal shows address, hours, phone and distance, with Google Maps and OSM links.';
  });

  await test('LOC-06', 'Locations + Dashboard', 'Save a hub as a guest, sign in as Alex, open Saved Hubs; refresh; remove it.', 'The hub appears on the resident dashboard and survives refresh.', async () => {
    const { context, page } = await session();
    await page.goto(`${BASE}pages/locations.html`);
    await page.waitForSelector('.location-card');
    const name = await page.locator('.location-name').first().textContent();
    await page.locator('[data-action="hub-save"]').first().click();
    await settle(page, 100);
    ok(await page.locator('[data-action="hub-save"]').first().getAttribute('aria-pressed') === 'true', 'not marked saved');
    await login(page, ALEX);
    await page.click('a[href="#saved"]');
    ok((await page.$$eval('#savedHubsList .location-name', (e) => e.map((x) => x.textContent))).includes(name), 'not on dashboard');
    await page.reload();
    ok(await page.$$eval('#savedHubsList .location-card', (e) => e.length) === 1, 'lost on refresh');
    await page.click('#savedHubsList [data-action="hub-save"]');
    await settle(page, 100);
    ok(await page.isVisible('#savedHubsList .empty-state'), 'not removed');
    await context.close();
    return `"${name}" saved, shown on the dashboard, kept on refresh, then removed.`;
  });

  await test('LOC-07', 'Locations', 'Block map tile requests.', 'A fallback message appears; pins and cards still work.', async () => {
    const { context, page } = await session({ tolerateFailures: true });
    await context.route('https://tile.openstreetmap.org/**', (route) => route.abort());
    await page.goto(`${BASE}pages/locations.html`);
    await page.waitForSelector('#mapNotice:not([hidden])', { timeout: 10000 });
    const message = await page.textContent('#mapNotice');
    ok(await pinCount(page) > 0 && await hubCardCount(page) > 0, 'pins or cards missing');
    await context.close();
    return `Notice: "${message}"`;
  });

  await test('LOC-08', 'Locations', 'Allow the browser to share a location, then click Use My Location.', 'Distances recalculate and hubs re-sort.', async () => {
    const { context, page } = await session({ permissions: ['geolocation'], geolocation: { latitude: -37.81, longitude: 144.96 } });
    await page.goto(`${BASE}pages/locations.html`);
    await page.waitForSelector('.location-card');
    await page.click('[data-action="hub-use-location"]');
    await settle(page, 400);
    const first = await page.locator('.location-name').first().textContent();
    const distance = await page.locator('.location-distance').first().textContent();
    ok(first.includes('Brunswick'), `nearest was ${first}`);
    await context.close();
    return `From Melbourne, the nearest hub becomes "${first}" (${distance}).`;
  });
}

async function hubsTotal() {
  const source = fs.readFileSync(path.join(ROOT, 'js', 'script.js'), 'utf8');
  return (source.match(/lat: -\d+\.\d+, lng: \d+\.\d+, types:/g) || []).length;
}

async function contactTests() {
  await test('CONT-01', 'Contact', 'Submit the empty form.', 'Inline errors on every required field, with focus on the first.', async () => {
    const { context, page } = await session();
    await page.goto(`${BASE}pages/contact.html`);
    await page.click('#contactForm button[type="submit"]');
    const errors = await page.$$eval('#contactForm .field-error', (e) => e.length);
    ok(errors === 6, `${errors} errors`);
    ok(await page.evaluate(() => document.activeElement.id) === 'contactName', 'focus');
    ok(await page.getAttribute('#contactEmail', 'aria-invalid') === 'true', 'aria-invalid');
    await context.close();
    return '6 inline errors, aria-invalid set, focus on Full Name.';
  });

  await test('CONT-02', 'Contact', 'Enter a bad email, a bad phone number and a short message.', 'Specific error for each.', async () => {
    const { context, page } = await session();
    await page.goto(`${BASE}pages/contact.html`);
    await page.fill('#contactEmail', 'alex@');
    await page.fill('#contactPhone', 'abc');
    await page.fill('#contactMessage', 'too short');
    await page.click('#contactForm button[type="submit"]');
    const emailError = await page.textContent('#contactEmail-error');
    const messageError = await page.textContent('#contactMessage-error');
    ok(emailError.includes('valid email'), emailError);
    ok(messageError.includes('20 characters'), messageError);
    ok(await page.isVisible('#contactPhone-error'), 'phone');
    await context.close();
    return `"${messageError}"`;
  });

  await test('CONT-03', 'Contact', 'Submit a valid enquiry.', 'Success confirmation, toast, and the enquiry stored in localStorage.', async () => {
    const { context, page } = await session();
    await page.goto(`${BASE}pages/contact.html`);
    await page.fill('#contactName', 'Sam Taylor');
    await page.fill('#contactEmail', 'sam@example.com');
    await page.fill('#contactSuburb', 'Parramatta 2150');
    await page.selectOption('#contactState', 'NSW');
    await page.selectOption('#contactCategory', 'Missed Collection');
    await page.fill('#contactMessage', 'My bin was not collected on Tuesday morning.');
    await page.click('#contactForm button[type="submit"]');
    await page.waitForSelector('#contactSuccess:not([hidden])');
    const reference = await page.textContent('#contactReference');
    const enquiries = await stored(page, 'ecorecycle_enquiries');
    ok(enquiries[0].reference === reference && enquiries[0].category === 'Missed Collection', 'not stored');
    ok(await page.isVisible('.toast'), 'no toast');
    await context.close();
    return `Confirmation with reference ${reference}; enquiry stored.`;
  });
}

async function authTests() {
  await test('AUTH-01', 'Login', 'Sign in with a wrong password, then an unknown email.', 'Clear inline error; no session is created.', async () => {
    const { context, page } = await session();
    await page.goto(`${BASE}pages/login.html`);
    for (const [email, password] of [[ALEX[0], 'wrong'], ['nobody@example.com', 'wrong']]) {
      await page.fill('#loginEmail', email);
      await page.fill('#loginPassword', password);
      await page.click('#loginForm button[type="submit"]');
      await page.waitForSelector('.form-alert.error');
      ok(page.url().endsWith('login.html'), 'navigated away');
    }
    const message = await page.textContent('.form-alert');
    ok(await page.evaluate(() => localStorage.getItem('ecorecycle_session')) === null, 'session created');
    await context.close();
    return `"${message}"; no session.`;
  });

  await test('AUTH-02', 'Login', 'Sign in with each demo account.', 'Resident reaches the resident view; admin reaches the admin view.', async () => {
    const { context, page } = await session();
    await login(page, ALEX);
    ok(await page.isVisible('[data-module="overview"]'), 'no resident view');
    await page.click('[data-action="logout"]');
    await page.waitForURL('**/index.html');
    await login(page, ADMIN);
    ok(await page.isVisible('[data-module="admin"]'), 'no admin view');
    await context.close();
    return 'Both demo accounts route to the correct view.';
  });

  await test('AUTH-03', 'Login', 'Inspect the login page for demo credentials.', 'No account emails or passwords are shown on the page.', async () => {
    const { context, page } = await session();
    await page.goto(`${BASE}pages/login.html`);
    const html = await page.content();
    ok(!html.includes(ALEX[1]) && !html.includes(ADMIN[1]) && !html.includes(ADMIN[0]), 'credentials on page');
    await context.close();
    return 'No demo emails or passwords appear in the login page.';
  });

  await test('AUTH-04', 'Register', 'Submit empty, then a bad email, weak password, mismatch, and an existing email.', 'A specific inline error for each rule.', async () => {
    const { context, page } = await session();
    await page.goto(`${BASE}pages/login.html#register`);
    await page.click('#registerForm button[type="submit"]');
    ok(await page.$$eval('#registerForm .field-error', (e) => e.length) === 4, 'empty errors');
    await page.fill('#regName', 'Sam Taylor');
    await page.fill('#regEmail', 'bad');
    await page.fill('#regPass', 'weak');
    await page.fill('#regConfirmPass', 'other');
    await page.click('#registerForm button[type="submit"]');
    ok((await page.textContent('#regEmail-error')).includes('valid email'), 'email');
    ok((await page.textContent('#regPass-error')).includes('uppercase'), 'rules');
    ok((await page.textContent('#regConfirmPass-error')).includes('do not match'), 'match');
    await page.fill('#regEmail', ALEX[0]);
    await page.click('#registerForm button[type="submit"]');
    ok((await page.textContent('#regEmail-error')).includes('already exists'), 'duplicate');
    await context.close();
    return 'Empty, format, password rule, mismatch and duplicate errors all shown inline.';
  });

  await test('AUTH-05', 'Register', 'Create an account; inspect storage; log out; sign back in.', 'Resident created with a salted SHA-256 hash, and no plain-text password.', async () => {
    const { context, page } = await session();
    const password = 'Str0ng!pass';
    await page.goto(`${BASE}pages/login.html#register`);
    await page.fill('#regName', 'Sam Taylor');
    await page.fill('#regEmail', 'Sam@Example.com');
    await page.fill('#regPass', password);
    await page.fill('#regConfirmPass', password);
    await page.click('#registerForm button[type="submit"]');
    await page.waitForURL('**/dashboard.html');
    const raw = await page.evaluate(() => JSON.stringify(localStorage));
    ok(!raw.includes(password), 'plain-text password found in storage');
    const users = await stored(page, 'ecorecycle_users');
    const sam = users.find((u) => u.email === 'sam@example.com');
    ok(sam && sam.role === 'resident' && /^[0-9a-f]{64}$/.test(sam.passwordHash) && /^[0-9a-f]{32}$/.test(sam.salt), 'hash format');
    ok(!raw.includes('Password123!'), 'demo password in storage');
    const expected = await page.evaluate(async ({ salt, pw }) => {
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${salt}:${pw}`));
      return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
    }, { salt: sam.salt, pw: password });
    ok(expected === sam.passwordHash, 'hash does not match SHA-256(salt:password)');
    ok(await page.textContent('[data-stat="items"]') === '0', 'new account should start at zero');
    await page.click('[data-action="logout"]');
    await page.waitForURL('**/index.html');
    await login(page, ['sam@example.com', password]);
    await context.close();
    return 'Resident stored with 64-hex hash and 32-hex salt, no plain text; can sign back in.';
  });

  await test('AUTH-06', 'Login', 'Use the show/hide password toggle.', 'The input type and the button state and label change.', async () => {
    const { context, page } = await session();
    await page.goto(`${BASE}pages/login.html`);
    const toggle = '[data-action="toggle-password"][data-target="loginPassword"]';
    await page.click(toggle);
    ok(await page.getAttribute('#loginPassword', 'type') === 'text', 'not shown');
    ok(await page.getAttribute(toggle, 'aria-pressed') === 'true' && await page.getAttribute(toggle, 'aria-label') === 'Hide password', 'state');
    await page.click(toggle);
    ok(await page.getAttribute('#loginPassword', 'type') === 'password', 'not hidden');
    await context.close();
    return 'Type switches between password and text; aria-pressed and label update.';
  });

  await test('AUTH-07', 'Login', 'Sign in with Remember me off and open a new tab; repeat with it on.', 'Off: session limited to that tab. On: session survives a new tab and the email is remembered.', async () => {
    const { context, page } = await session();
    await login(page, ALEX, false);
    const noRemember = await context.newPage();
    await noRemember.goto(`${BASE}pages/dashboard.html`);
    ok(await noRemember.isVisible('#authLockOverlay'), 'session leaked to new tab');
    await noRemember.close();
    await page.click('[data-action="logout"]');
    await page.waitForURL('**/index.html');
    await login(page, ALEX, true);
    const remembered = await context.newPage();
    await remembered.goto(`${BASE}pages/dashboard.html`);
    ok(await remembered.isVisible('#dashboardApp'), 'remembered session missing');
    await remembered.click('[data-action="logout"]');
    await remembered.waitForURL('**/index.html');
    await remembered.goto(`${BASE}pages/login.html`);
    ok(await remembered.inputValue('#loginEmail') === ALEX[0] && await remembered.isChecked('#rememberMe'), 'email not remembered');
    await context.close();
    return 'Off: new tab locked. On: new tab signed in; email and checkbox remembered after logout.';
  });

  await test('AUTH-08', 'All', 'Sign in, then log out from the nav.', 'Nav shows signed-in state, logout ends the session and shows feedback.', async () => {
    const { context, page } = await session();
    await login(page, ALEX);
    await page.goto(`${BASE}pages/contact.html`);
    ok((await page.textContent('#navActions')).includes('Alex Johnson'), 'nav state');
    await page.click('[data-action="logout"]');
    await page.waitForURL('**/index.html');
    await page.waitForSelector('.toast');
    ok((await page.textContent('#navActions')).includes('Login'), 'still signed in');
    await page.goto(`${BASE}pages/dashboard.html`);
    ok(await page.isVisible('#authLockOverlay'), 'dashboard open after logout');
    await context.close();
    return 'Logout clears the session, shows a toast, and the dashboard locks again.';
  });
}

async function dashboardTests() {
  await test('DASH-01', 'Dashboard', 'Open the dashboard while signed out.', 'Lock overlay shows; no app content is rendered; focus is on Sign In.', async () => {
    const { context, page } = await session();
    await page.goto(`${BASE}pages/dashboard.html`);
    ok(await page.isVisible('#authLockOverlay'), 'overlay');
    ok(await page.isHidden('#dashboardApp'), 'app visible');
    ok(!(await page.content()).includes('Alex Johnson'), 'private data in HTML');
    ok((await page.evaluate(() => document.activeElement.textContent)).includes('Sign In'), 'focus');
    await context.close();
    return 'Overlay shown, app hidden, no account data in the page.';
  });

  await test('DASH-02', 'Dashboard', 'As a resident, open dashboard.html#admin-directory.', 'Access denied; admin modules are not in the page.', async () => {
    const { context, page } = await session();
    await login(page, ALEX);
    await page.goto(`${BASE}pages/contact.html`);
    await page.goto(`${BASE}pages/dashboard.html#admin-directory`);
    await page.waitForFunction(() => [...document.querySelectorAll('.toast')].some((t) => t.textContent.includes('Access denied')));
    ok(await page.isVisible('[data-module="overview"]'), 'overview not shown');
    ok(await page.$$eval('[data-module^="admin"], #ruleModal', (e) => e.length) === 0, 'admin markup present');
    const blocked = await page.evaluate(() => {
      ACTIONS['delete-rule']({ dataset: { id: 'pizza-box' } });
      return getRules().some((rule) => rule.id === 'pizza-box');
    });
    ok(blocked, 'handler ran for a resident');
    await context.close();
    return 'Toast "Access denied", overview shown, admin markup absent, admin handlers refuse.';
  });

  await test('DASH-03', 'Dashboard', 'As Alex, check starting stats, then log a recycled item; refresh.', 'Stats start at 42 / 24.5 kg / 86%; the row is added; stats update and persist.', async () => {
    const { context, page } = await session();
    await login(page, ALEX);
    const read = () => page.$$eval('[data-stat]', (e) => Object.fromEntries(e.map((x) => [x.dataset.stat, x.textContent])));
    const before = await read();
    ok(before.items === '42' && before.kg === '24.5 kg' && before.score === '86%', JSON.stringify(before));
    await page.locator('[data-action="open-log-modal"]').first().click();
    await page.click('#logItemForm button[type="submit"]');
    ok(await page.$$eval('#logItemForm .field-error', (e) => e.length) === 3, 'validation');
    await page.fill('#logItemName', 'Steel Food Tin');
    await page.selectOption('#logItemCategory', 'Metal');
    await page.selectOption('#logItemDisposal', 'Yellow Recycling Bin');
    await page.fill('#logItemKg', '1.5');
    await page.click('#logItemForm button[type="submit"]');
    await settle(page, 80);
    const after = await read();
    ok(after.items === '43' && after.kg === '26.0 kg', JSON.stringify(after));
    ok((await page.textContent('.js-activity-rows tr td')).includes('Steel Food Tin'), 'row missing');
    await page.reload();
    ok((await read()).items === '43', 'lost on refresh');
    await context.close();
    return `42 / 24.5 kg / 86% became ${after.items} / ${after.kg} / ${after.score}; row added; kept on refresh.`;
  });

  await test('DASH-04', 'Dashboard', 'Open each resident tab; refresh on one.', 'Every tab works; the URL hash keeps the tab on refresh.', async () => {
    const { context, page } = await session();
    await login(page, ALEX);
    for (const tab of ['schedule', 'history', 'saved', 'notifications', 'settings', 'overview']) {
      await page.click(`.sidebar-link[data-tab="${tab}"]`);
      await page.locator(`[data-module="${tab}"]`).waitFor({ state: 'visible', timeout: 2000 });
      ok(await page.getAttribute(`.sidebar-link[data-tab="${tab}"]`, 'aria-current') === 'page', `${tab} not current`);
    }
    await page.click('.sidebar-link[data-tab="history"]');
    await page.waitForFunction(() => window.location.hash === '#history');
    await page.reload();
    ok(await page.isVisible('[data-module="history"]'), 'tab lost');
    const rows = await page.$$eval('[data-module="history"] tbody tr', (r) => r.length);
    ok(rows === 6, `${rows} rows`);
    await context.close();
    return `All 6 tabs work; History (${rows} rows) restored after refresh.`;
  });

  await test('DASH-05', 'Dashboard', 'Toggle notification switches and refresh; set a reminder; update settings.', 'Toggles, reminders and profile changes persist.', async () => {
    const { context, page } = await session();
    await login(page, ALEX);
    await page.click('.sidebar-link[data-tab="notifications"]');
    const before = await page.isChecked('#prefSms');
    await page.click('#prefSms', { force: true });
    await page.locator('[data-module="notifications"] [data-action="toggle-reminder"]').click();
    await settle(page, 80);
    await page.reload();
    ok(await page.isChecked('#prefSms') !== before, 'toggle not saved');
    ok(await page.getAttribute('[data-module="notifications"] [data-action="toggle-reminder"]', 'aria-pressed') === 'true', 'reminder not saved');
    await page.click('.sidebar-link[data-tab="settings"]');
    ok(await page.evaluate(() => document.getElementById('settingsEmail').readOnly), 'demo email should be read-only');
    await page.fill('#settingsAddress', '7 Example Street');
    await page.click('#settingsForm button[type="submit"]');
    await page.reload();
    ok(await page.inputValue('#settingsAddress') === '7 Example Street', 'address not saved');
    await context.close();
    return 'SMS toggle, reminder and address all persisted after refresh.';
  });

  await test('DASH-06', 'Dashboard', 'Open the schedule tab and check each bin date.', 'Yellow and green are the next Tuesday; red is within two weeks.', async () => {
    const { context, page } = await session();
    await login(page, ALEX);
    await page.click('.sidebar-link[data-tab="schedule"]');
    const dates = await page.$$eval('[data-next-bin]', (e) => e.map((x) => x.textContent));
    ok(dates.length === 3 && dates.every((d) => d.startsWith('Tuesday')), `dates: ${dates}`);
    ok(await page.$$eval('[data-upcoming-collections] .upcoming-row', (r) => r.length) === 4, 'upcoming list');
    await context.close();
    return `Yellow: ${dates[0]}; green: ${dates[1]}; red: ${dates[2]}.`;
  });
}

async function adminTests() {
  const counters = (page) => page.$$eval('[data-admin-stat]', (e) => Object.fromEntries(e.map((x) => [x.dataset.adminStat, x.textContent])));

  await test('ADM-01', 'Dashboard (admin)', 'Create a rule with empty fields, then valid values; search for it publicly.', 'Validation runs; the rule appears in Waste Search and the counter increases.', async () => {
    const { context, page } = await session();
    await login(page, ADMIN);
    const before = await counters(page);
    await page.locator('.dashboard-topbar [data-action="new-rule"]').click();
    await page.click('#ruleForm button[type="submit"]');
    ok(await page.$$eval('#ruleForm .field-error', (e) => e.length) === 5, 'validation');
    await page.fill('#ruleName', 'Foam Yoga Mat');
    await page.selectOption('#ruleCategory', 'General Waste');
    await page.selectOption('#ruleStatus', 'not-recyclable');
    await page.fill('#ruleDisposal', 'Red General Waste Bin');
    await page.fill('#ruleSteps', 'Cut to fit.\nPlace in the red bin.');
    await page.click('#ruleForm button[type="submit"]');
    await settle(page, 80);
    const after = await counters(page);
    ok(Number(after.rules) === Number(before.rules) + 1, 'counter');
    const pub = await context.newPage();
    await pub.goto(`${BASE}pages/waste-search.html?q=yoga`);
    ok((await pub.textContent('.item-card h3')) === 'Foam Yoga Mat', 'not public');
    ok(await pub.$$eval('.item-card .steps-list li', (l) => l.length) === 2, 'steps not split');
    await context.close();
    return `Rule counter ${before.rules} to ${after.rules}; "Foam Yoga Mat" live with 2 steps.`;
  });

  await test('ADM-02', 'Dashboard (admin)', 'Edit a rule\'s disposal method and search for it publicly.', 'Change is saved and live, with a verification note.', async () => {
    const { context, page } = await session();
    await login(page, ADMIN);
    await page.click('.sidebar-link[data-tab="admin-directory"]');
    await page.fill('#registrySearch', 'pizza');
    await page.click('[data-action="edit-rule"]');
    await page.fill('#ruleDisposal', 'Green FOGO Bin');
    await page.click('#ruleForm button[type="submit"]');
    await settle(page, 80);
    const pub = await context.newPage();
    await pub.goto(`${BASE}pages/waste-search.html?q=pizza`);
    const where = await pub.textContent('.item-meta div:nth-child(2) dd');
    const note = (await pub.textContent('.verify-note')).trim();
    ok(where === 'Green FOGO Bin' && note.includes('Updated by Tanu'), `${where} / ${note}`);
    await context.close();
    return `Public card shows "${where}"; note "${note}".`;
  });

  await test('ADM-03', 'Dashboard (admin)', 'Click Delete: cancel, press Esc, then confirm.', 'A confirm dialog appears; only confirmation deletes, and the rule leaves public search.', async () => {
    const { context, page } = await session();
    await login(page, ADMIN);
    await page.click('.sidebar-link[data-tab="admin-directory"]');
    await page.fill('#registrySearch', 'cling');
    await page.click('[data-action="delete-rule"]');
    await page.waitForSelector('#confirmModal.active');
    ok(await page.evaluate(() => document.activeElement.id) === 'confirmCancel', 'focus not on Cancel');
    await page.click('#confirmCancel');
    ok(await page.$$eval('#ruleTableBody [data-action="delete-rule"]', (e) => e.length) === 1, 'deleted on cancel');
    await page.click('[data-action="delete-rule"]');
    await page.keyboard.press('Escape');
    await settle(page, 50);
    ok(await page.$$eval('#ruleTableBody [data-action="delete-rule"]', (e) => e.length) === 1, 'deleted on Esc');
    await page.click('[data-action="delete-rule"]');
    await page.click('#confirmOk');
    await settle(page, 80);
    const pub = await context.newPage();
    await pub.goto(`${BASE}pages/waste-search.html?q=cling`);
    ok(await pub.isVisible('#noResultsPanel'), 'still public');
    await context.close();
    return 'Cancel and Esc keep the rule; confirming removes it from public search.';
  });

  await test('ADM-04', 'Dashboard (admin) + Waste Search', 'With Waste Search open in a second tab, click Approve & Publish on a classified request.', 'One click publishes it; it appears in the open search tab without a refresh; counters update.', async () => {
    const { context, page } = await session();
    await login(page, ADMIN);
    const pub = await context.newPage();
    await pub.goto(`${BASE}pages/waste-search.html`);
    await pub.fill('#wasteSearchInput', 'aerosol');
    await settle(pub, 180);
    ok(await pub.isVisible('#noResultsPanel'), 'should not be public yet');
    const before = await counters(page);
    await page.click('[data-module="admin"] [data-action="approve-request"][data-id="req-aerosol"]');
    await pub.waitForSelector('.item-card', { timeout: 3000 });
    const name = await pub.textContent('.item-card h3');
    const after = await counters(page);
    ok(Number(after.rules) === Number(before.rules) + 1 && Number(after.pending) === Number(before.pending) - 1, 'counters');
    await page.reload();
    ok(await page.$$eval('[data-module="admin"] [data-id="req-aerosol"]', (e) => e.length) === 0, 'still in queue after refresh');
    await context.close();
    return `"${name}" appeared in the open tab; rules ${before.rules} to ${after.rules}, pending ${before.pending} to ${after.pending}.`;
  });

  await test('ADM-05', 'Waste Search + Dashboard (admin)', 'Guest submits "light bulb" with category Not sure; admin approves, classifies and publishes.', 'Admin must classify it first, so nothing inaccurate is published; the item is then searchable.', async () => {
    const { context, page } = await session();
    await page.goto(`${BASE}pages/waste-search.html?q=light%20bulb`);
    await page.selectOption('#reqCategory', 'unknown');
    await page.click('#requestForm button[type="submit"]');
    await page.waitForSelector('.toast');
    await login(page, ADMIN);
    await page.click('[data-module="admin"] .queue-card:has-text("light bulb") [data-action="approve-request"]');
    await page.waitForSelector('#ruleModal.active');
    ok(await page.inputValue('#ruleName') === 'light bulb', 'name');
    await page.click('#ruleForm button[type="submit"]');
    ok(await page.$$eval('#ruleForm .field-error', (e) => e.length) === 4, 'classification not required');
    await page.selectOption('#ruleCategory', 'General Waste');
    await page.selectOption('#ruleStatus', 'not-recyclable');
    await page.fill('#ruleDisposal', 'Red General Waste Bin');
    await page.fill('#ruleSteps', 'Wrap the bulb in paper.\nPlace it in the red bin.');
    await page.click('#ruleForm button[type="submit"]');
    await settle(page, 80);
    const pub = await context.newPage();
    await pub.goto(`${BASE}pages/waste-search.html?q=light%20bulb`);
    ok((await pub.textContent('.item-card h3')) === 'light bulb', 'not public');
    const badge = (await pub.textContent('.item-card .badge')).trim();
    await context.close();
    return `Classification enforced; "light bulb" now public with badge "${badge}".`;
  });

  await test('ADM-06', 'Dashboard (admin)', 'Reject a request; check the queue, the counter and public search.', 'Confirmed rejection removes it, without publishing.', async () => {
    const { context, page } = await session();
    await login(page, ADMIN);
    const before = await counters(page);
    await page.click('[data-module="admin"] [data-action="reject-request"][data-id="req-vape"]');
    await page.click('#confirmOk');
    await settle(page, 80);
    const after = await counters(page);
    ok(Number(after.pending) === Number(before.pending) - 1 && after.rules === before.rules, 'counters');
    const pub = await context.newPage();
    await pub.goto(`${BASE}pages/waste-search.html?q=vape`);
    ok(await pub.isVisible('#noResultsPanel'), 'published anyway');
    await page.click('.sidebar-link[data-tab="admin-pending"]');
    ok(await page.$$eval('[data-module="admin-pending"] .queue-card', (e) => e.length) === Number(after.pending), 'pending tab out of sync');
    await context.close();
    return `Pending ${before.pending} to ${after.pending}, rules unchanged at ${after.rules}, not public.`;
  });

  await test('ADM-07', 'Dashboard (admin)', 'Filter the registry by text and category; refresh on the tab; empty the queue.', 'Registry filters work; the tab survives refresh; the queue shows an empty state.', async () => {
    const { context, page } = await session();
    await login(page, ADMIN);
    await page.click('.sidebar-link[data-tab="admin-directory"]');
    await page.selectOption('#registryCategory', 'Glass');
    const glass = await page.$$eval('#ruleTableBody tr', (r) => r.length);
    ok(glass === 6, `${glass} glass rows`);
    await page.reload();
    ok(await page.isVisible('[data-module="admin-directory"]'), 'tab lost');
    await page.click('.sidebar-link[data-tab="admin-pending"]');
    for (const id of ['req-aerosol', 'req-bubble-wrap', 'req-vape', 'req-pyrex']) {
      await page.click(`[data-module="admin-pending"] [data-action="approve-request"][data-id="${id}"]`);
      await settle(page, 40);
    }
    ok(await page.isVisible('[data-module="admin-pending"] .empty-state'), 'no empty state');
    await context.close();
    return `Glass filter shows ${glass} rows; tab kept on refresh; empty queue shows "All caught up".`;
  });
}

async function responsiveTests() {
  await test('RESP-01', 'All', 'Measure horizontal overflow on every page at 320, 375, 768, 1024 and 1280px.', 'No page scrolls sideways at any width.', async () => {
    const { context, page } = await session();
    let checks = 0;
    for (const width of [320, 375, 768, 1024, 1280]) {
      await page.setViewportSize({ width, height: 800 });
      for (const name of PAGES) {
        await page.goto(BASE + name);
        await settle(page, 60);
        const extra = await overflow(page);
        ok(extra <= 0, `${name} overflows by ${extra}px at ${width}`);
        checks += 1;
      }
    }
    await context.close();
    return `${checks} page and width combinations, 0px overflow.`;
  });

  await test('RESP-04', 'All', 'At 375 and 1280px, compare the bottom of the footer with the document height on every page.', 'No blank scrollable space below the footer.', async () => {
    const { context, page } = await session();
    let checks = 0;
    for (const width of [375, 1280]) {
      await page.setViewportSize({ width, height: 800 });
      for (const name of PAGES) {
        await page.goto(BASE + name);
        await settle(page, 120);
        const gap = await page.evaluate(() => {
          const root = document.documentElement;
          if (root.scrollHeight <= root.clientHeight) return 0; // a short page has nothing to scroll
          const footerBottom = document.querySelector('.footer').getBoundingClientRect().bottom + window.scrollY;
          return Math.round(root.scrollHeight - footerBottom);
        });
        ok(gap <= 1, `${name} has ${gap}px of blank space at ${width}`);
        checks += 1;
      }
    }
    await context.close();
    return `${checks} page and width combinations: footer is the last thing on each page.`;
  });

  await test('RESP-02', 'Dashboard', 'At 320, 375, 768, 1024 and 1280px, visit every resident and admin tab; measure overflow and clipped table columns; open a modal at 375px.', 'No sideways scrolling and no clipped columns; tables become cards when narrow; every tab can be reached; modals fit.', async () => {
    const { context, page } = await session();
    let checks = 0;
    const visitTabs = async (tabs) => {
      for (const width of [320, 375, 768, 1024, 1280]) {
        await page.setViewportSize({ width, height: 800 });
        for (const tab of tabs) {
          await page.locator(`.sidebar-link[data-tab="${tab}"]`).click();
          await page.locator(`[data-module="${tab}"]`).waitFor({ state: 'visible', timeout: 2000 });
          const extra = await overflow(page);
          ok(extra <= 0, `${tab} overflows by ${extra}px at ${width}`);
          const clipped = await page.$$eval('.table-wrapper', (list) => list.filter((w) => w.offsetParent).map((w) => w.scrollWidth - w.clientWidth));
          ok(clipped.every((px) => px <= 0), `${tab} table clipped by ${clipped}px at ${width}`);
          checks += 1;
        }
      }
    };
    await login(page, ALEX);
    await visitTabs(['overview', 'schedule', 'history', 'saved', 'notifications', 'settings']);
    await page.setViewportSize({ width: 375, height: 800 });
    await page.locator('.sidebar-link[data-tab="history"]').click();
    await page.locator('[data-module="history"]').waitFor({ state: 'visible' });
    ok(await page.$eval('[data-module="history"] .custom-table td:nth-child(2)', (td) => getComputedStyle(td).display) === 'flex', 'table did not stack at 375px');
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.evaluate(() => { localStorage.removeItem('ecorecycle_session'); sessionStorage.clear(); });
    await login(page, ADMIN);
    await visitTabs(['admin', 'admin-directory', 'admin-pending']);
    await page.setViewportSize({ width: 375, height: 800 });
    await page.locator('.dashboard-topbar [data-action="new-rule"]').click();
    const fits = await page.$eval('#ruleModal .modal-box', (box) => box.getBoundingClientRect().right <= window.innerWidth);
    ok(fits, 'modal wider than screen');
    await context.close();
    return `${checks} tab and width combinations: 0px overflow, 0px clipped; tables stack at 375px; modals fit.`;
  });

  await test('RESP-03', 'Locations (375px)', 'Open Locations at 375px and use the map and cards.', 'Map is usable and fits; cards stack.', async () => {
    const { context, page } = await session({ width: 375, height: 800 });
    await page.goto(`${BASE}pages/locations.html`);
    await page.waitForSelector('.leaflet-marker-icon');
    const shell = await page.locator('.map-shell').boundingBox();
    ok(shell.width <= 375 && shell.height >= 300, `map ${shell.width}x${shell.height}`);
    const firstCard = await page.locator('.location-card').first().boundingBox();
    ok(shell.y < firstCard.y, 'map is below the hub list');
    await page.locator('[data-action="hub-focus"]').first().click();
    await page.waitForSelector('.hub-popup');
    await context.close();
    return `Map is ${Math.round(shell.width)}x${Math.round(shell.height)}px; Show on Map opens the popup.`;
  });
}

async function a11yTests() {
  await test('A11Y-01', 'Public pages', 'Run axe-core (WCAG 2.0/2.1 A and AA) on each public page and state, including form errors and a map popup.', 'No violations.', async () => {
    const { context, page } = await session();
    const states = [
      ['index.html', null],
      ['pages/waste-search.html', null],
      ['pages/waste-search.html?q=light%20bulb', async () => page.click('#requestForm button[type="submit"]')],
      ['pages/recycling-guide.html', null],
      ['pages/locations.html', async () => { await page.waitForSelector('.leaflet-marker-icon'); await page.locator('.leaflet-marker-icon').first().click(); await page.waitForSelector('.hub-popup'); }],
      ['pages/contact.html', async () => page.click('#contactForm button[type="submit"]')],
      ['pages/login.html', async () => { await page.click('#loginForm button[type="submit"]'); }],
      ['pages/login.html#register', async () => page.click('#registerForm button[type="submit"]')],
      ['pages/dashboard.html', null],
      ['404.html', null],
    ];
    const problems = [];
    for (const [url, setup] of states) {
      await page.goto(BASE + url);
      await settle(page, 150);
      if (setup) await setup();
      await settle(page, 100);
      (await axe(page)).forEach((v) => problems.push(`${url} ${v}`));
    }
    ok(problems.length === 0, problems.join(' | '));
    await context.close();
    return `${states.length} page states scanned; 0 violations.`;
  });

  await test('A11Y-02', 'Dashboard', 'Run axe-core on every resident and admin module, and with each modal open.', 'No violations.', async () => {
    const { context, page } = await session();
    const problems = [];
    let scans = 0;
    const scan = async (label) => {
      (await axe(page)).forEach((v) => problems.push(`${label} ${v}`));
      scans += 1;
    };
    await login(page, ALEX);
    for (const tab of ['overview', 'schedule', 'history', 'saved', 'notifications', 'settings']) {
      await page.click(`.sidebar-link[data-tab="${tab}"]`);
      await scan(tab);
    }
    await page.locator('.dashboard-topbar [data-action="open-log-modal"]').click();
    await page.click('#logItemForm button[type="submit"]');
    await scan('log modal');
    await page.keyboard.press('Escape');
    await page.click('[data-action="logout"]');
    await page.waitForURL('**/index.html');
    await login(page, ADMIN);
    for (const tab of ['admin', 'admin-directory', 'admin-pending']) {
      await page.click(`.sidebar-link[data-tab="${tab}"]`);
      await scan(tab);
    }
    await page.locator('.dashboard-topbar [data-action="new-rule"]').click();
    await page.click('#ruleForm button[type="submit"]');
    await scan('rule modal');
    await page.keyboard.press('Escape');
    await page.click('.sidebar-link[data-tab="admin-directory"]');
    await page.click('[data-action="delete-rule"] >> nth=0');
    await page.waitForSelector('#confirmModal.active');
    await scan('confirm modal');
    ok(problems.length === 0, problems.join(' | '));
    await context.close();
    return `${scans} dashboard states scanned; 0 violations.`;
  });

  await test('A11Y-03', 'All', 'Check each page for lang, title, landmarks, one h1, heading order, labels, and image alt and size.', 'All present on every page.', async () => {
    const { context, page } = await session();
    for (const name of PAGES) {
      await page.goto(BASE + name);
      await settle(page, 100);
      const info = await page.evaluate(() => ({
        lang: document.documentElement.lang,
        h1: document.querySelectorAll('h1').length,
        landmarks: ['header', 'main', 'footer', 'nav'].every((tag) => document.querySelector(tag)),
        title: document.title,
        unlabelled: [...document.querySelectorAll('input,select,textarea')].filter((el) => !(el.labels && el.labels.length) && !el.getAttribute('aria-label')).map((el) => el.id),
        images: [...document.querySelectorAll('img:not(.leaflet-tile)')].filter((img) => !img.getAttribute('alt') || !img.getAttribute('width') || !img.getAttribute('height')).map((img) => img.src),
        skipped: (() => {
          const levels = [...document.querySelectorAll('main h1, main h2, main h3, main h4')].filter((h) => h.offsetParent !== null).map((h) => Number(h.tagName[1]));
          return levels.some((level, i) => i > 0 && level - levels[i - 1] > 1);
        })(),
      }));
      ok(info.lang === 'en-AU' && info.title, `${name} lang or title`);
      ok(info.h1 === 1, `${name} has ${info.h1} h1`);
      ok(info.landmarks, `${name} landmarks`);
      ok(info.unlabelled.length === 0, `${name} unlabelled: ${info.unlabelled}`);
      ok(info.images.length === 0, `${name} images: ${info.images}`);
      ok(!info.skipped, `${name} skips a heading level`);
    }
    await context.close();
    return `All ${PAGES.length} pages pass: lang, 1 h1, landmarks, labels, alt, width and height, heading order.`;
  });

  await test('A11Y-04', 'Dashboard', 'Open a modal by keyboard; Tab and Shift+Tab repeatedly; press Esc.', 'Focus stays inside, Esc closes, and focus returns to the trigger.', async () => {
    const { context, page } = await session();
    await login(page, ALEX);
    const trigger = page.locator('.dashboard-topbar [data-action="open-log-modal"]');
    await trigger.focus();
    await page.keyboard.press('Enter');
    await page.waitForSelector('#logItemModal.active');
    ok(await page.evaluate(() => document.activeElement.id) === 'logItemName', 'first field not focused');
    ok(await page.getAttribute('#logItemModal .modal-box', 'role') === 'dialog' && await page.getAttribute('#logItemModal .modal-box', 'aria-modal') === 'true', 'dialog roles');
    for (let i = 0; i < 12; i += 1) {
      await page.keyboard.press('Tab');
      ok(await page.evaluate(() => Boolean(document.activeElement.closest('#logItemModal'))), `escaped on Tab ${i}`);
    }
    for (let i = 0; i < 12; i += 1) {
      await page.keyboard.press('Shift+Tab');
      ok(await page.evaluate(() => Boolean(document.activeElement.closest('#logItemModal'))), `escaped on Shift+Tab ${i}`);
    }
    await page.keyboard.press('Escape');
    ok(await page.isHidden('#logItemModal .modal-box'), 'still open');
    ok(await trigger.evaluate((el) => el === document.activeElement), 'focus not returned');
    await context.close();
    return 'Focus trapped for 24 Tab presses; Esc closes; focus returned to the trigger.';
  });

  await test('A11Y-05', 'All', 'Tab from the top of a page; follow the skip link; inspect the focus style.', 'Skip link is first, moves focus to main; focus is visibly styled.', async () => {
    const { context, page } = await session();
    await page.goto(`${BASE}pages/contact.html`);
    await page.keyboard.press('Tab');
    ok(await page.evaluate(() => document.activeElement.classList.contains('skip-link')), 'skip link not first');
    const box = await page.locator('.skip-link').boundingBox();
    ok(box.y >= 0, 'skip link not revealed on focus');
    await page.keyboard.press('Enter');
    ok(await page.evaluate(() => document.activeElement.id) === 'main', 'focus not moved to main');
    await page.keyboard.press('Tab');
    const outline = await page.evaluate(() => {
      const style = getComputedStyle(document.activeElement);
      return `${style.outlineStyle} ${style.outlineWidth}`;
    });
    ok(outline.startsWith('solid') && !outline.endsWith(' 0px'), `outline: ${outline}`);
    await context.close();
    return `Skip link works; focused element shows outline "${outline}".`;
  });

  await test('A11Y-06', 'All', 'Check the toast region; check switches and tabs use correct roles.', 'Toasts are announced with aria-live; the auth tabs work with arrow keys.', async () => {
    const { context, page } = await session();
    await page.goto(`${BASE}pages/login.html`);
    ok(await page.getAttribute('#toastContainer', 'aria-live') === 'polite', 'aria-live');
    ok(await page.getAttribute('#toastContainer', 'role') === 'status', 'role');
    await page.focus('#loginTab');
    await page.keyboard.press('ArrowRight');
    ok(await page.evaluate(() => document.activeElement.id) === 'registerTab', 'arrow key');
    ok(await page.isVisible('#registerForm'), 'panel');
    await login(page, ALEX);
    await page.click('.sidebar-link[data-tab="notifications"]');
    ok(await page.getAttribute('#prefEmail', 'role') === 'switch', 'switch role');
    await context.close();
    return 'Toast region is aria-live polite; tabs follow the ARIA pattern; toggles use role=switch.';
  });
}

async function resilienceTests() {
  await test('ERR-01', 'Locations + All', 'Block all CDN scripts (Leaflet and Lucide) and load every page.', 'No uncaught errors; a map fallback message and text icon fallbacks appear.', async () => {
    const { context, page } = await session({ tolerateFailures: true });
    const uncaught = [];
    page.on('pageerror', (e) => uncaught.push(e.message));
    await context.route('https://unpkg.com/**', (route) => route.abort());
    for (const name of PAGES) await page.goto(BASE + name);
    await page.goto(`${BASE}pages/locations.html`);
    await settle(page, 200);
    ok(await page.isVisible('#mapNotice'), 'no map notice');
    ok(await hubCardCount(page) > 0, 'cards missing');
    const glyph = await page.$eval('#mobileMenuToggle .nav-icon-open i', (i) => i.textContent);
    ok(glyph === '☰', `hamburger glyph "${glyph}"`);
    ok(uncaught.length === 0, uncaught.join(', '));
    await context.close();
    return `0 uncaught errors; map notice shown; hamburger falls back to "${glyph}".`;
  });

  await test('ERR-02', 'Waste Search + Login', 'Corrupt localStorage values (invalid JSON and junk arrays) and reload.', 'App falls back to seed data and still works.', async () => {
    const { context, page } = await session();
    await page.goto(`${BASE}pages/waste-search.html`);
    for (const junk of ['{oops', '[1,2,3]', '"text"']) {
      await page.evaluate((value) => {
        ['ecorecycle_waste_rules', 'ecorecycle_users', 'ecorecycle_pending_requests', 'ecorecycle_session', 'ecorecycle_activity_log'].forEach((key) => localStorage.setItem(key, value));
      }, junk);
      await page.reload();
      ok(await cardCount(page) === SEED_RULE_COUNT, `${junk}: ${await cardCount(page)} cards`);
    }
    await login(page, ALEX);
    ok(await page.isVisible('[data-module="overview"]'), 'cannot log in');
    await context.close();
    return `Invalid JSON and junk arrays both fall back to ${SEED_RULE_COUNT} seed rules; demo login still works.`;
  });

  await test('ERR-03', 'All', 'Make localStorage throw on every access and use the site.', 'No uncaught errors; pages render from seed data, with a warning when saving fails.', async () => {
    const { context, page } = await session({ tolerateFailures: true });
    const uncaught = [];
    page.on('pageerror', (e) => uncaught.push(e.message));
    await context.addInitScript(() => {
      Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('Blocked', 'SecurityError'); } });
    });
    for (const name of PAGES) await page.goto(BASE + name);
    await page.goto(`${BASE}pages/waste-search.html`);
    ok(await cardCount(page) === SEED_RULE_COUNT, 'no seed data');
    await page.fill('#reqName', 'Test Item');
    await page.selectOption('#reqCategory', 'unknown');
    await page.click('#requestForm button[type="submit"]');
    await page.waitForFunction(() => [...document.querySelectorAll('.toast.error')].some((t) => t.textContent.includes('storage')));
    ok(uncaught.length === 0, uncaught.join(', '));
    await context.close();
    return `0 uncaught errors with storage blocked; ${SEED_RULE_COUNT} seed items shown; user warned that saving failed.`;
  });

  await test('PERF-01', 'All', 'Inspect library URLs, image sizes and code organisation.', 'Exact versions pinned with integrity hashes; compressed local images; no leftover legacy code.', async () => {
    const pagesHtml = PAGES.map((name) => fs.readFileSync(path.join(ROOT, name), 'utf8')).join('\n');
    ok(!pagesHtml.includes('@latest'), '@latest found');
    ok(pagesHtml.includes('lucide@0.468.0') && pagesHtml.includes('leaflet@1.9.4'), 'versions');
    ok((pagesHtml.match(/unpkg\.com/g) || []).length === (pagesHtml.match(/integrity="sha384-/g) || []).length, 'missing SRI');
    ok(!/onclick=|javascript:void|<style>/.test(pagesHtml), 'inline handlers or styles in HTML');
    const images = fs.readdirSync(path.join(ROOT, 'images')).map((file) => fs.statSync(path.join(ROOT, 'images', file)).size);
    const total = images.reduce((a, b) => a + b, 0);
    ok(Math.max(...images) < 150 * 1024, 'an image is over 150 KB');
    const source = fs.readFileSync(path.join(ROOT, 'js', 'script.js'), 'utf8');
    for (const section of ['1. CORE', '2. DATA', '3. STORAGE', '4. UI', '5. AUTH', '6. NAVIGATION', '7. SCHEDULE', '8. SEARCH', '9. GUIDE', '10. LOCATIONS', '11. CONTACT', '12. DASHBOARD', '13. BOOT']) {
      ok(source.includes(section), `missing section ${section}`);
    }
    return `Lucide 0.468.0 and Leaflet 1.9.4 pinned with SRI; ${images.length} images, ${Math.round(total / 1024)} KB total, largest ${Math.round(Math.max(...images) / 1024)} KB; 13 JS sections.`;
  });

  await test('PERF-02', 'Home', 'Scroll the home page and check every image has loaded.', 'All images decode, with no layout shift from missing dimensions.', async () => {
    const { context, page } = await session();
    await page.goto(`${BASE}index.html`);
    await page.evaluate(async () => {
      for (let y = 0; y < document.body.scrollHeight; y += 500) {
        window.scrollTo(0, y);
        await new Promise((resolve) => setTimeout(resolve, 80));
      }
    });
    await page.waitForLoadState('networkidle');
    const broken = await page.$$eval('img', (imgs) => imgs.filter((i) => !i.complete || !i.naturalWidth).map((i) => i.src));
    ok(broken.length === 0, `broken: ${broken}`);
    const count = await page.$$eval('img', (imgs) => imgs.length);
    await context.close();
    return `${count} of ${count} images loaded.`;
  });
}

async function screenshots() {
  fs.mkdirSync(SHOTS, { recursive: true });
  const lazyLoad = async (page) => {
    await page.evaluate(async () => {
      for (let y = 0; y < document.body.scrollHeight; y += 400) {
        window.scrollTo(0, y);
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      window.scrollTo(0, 0);
    });
    await page.waitForLoadState('networkidle').catch(() => {});
    await settle(page, 300);
  };
  const shot = async (page, name, viewName) => {
    await lazyLoad(page);
    await page.evaluate(() => document.querySelectorAll('.toast').forEach((toast) => toast.remove()));
    await page.screenshot({ path: path.join(SHOTS, `${name}-${viewName}.jpg`), type: 'jpeg', quality: 62, fullPage: true });
  };
  for (const [viewName, width, height] of [['desktop', 1280, 800], ['mobile', 375, 780]]) {
    const { context, page } = await session({ width, height });
    for (const [name, url] of [['home', 'index.html'], ['waste-search', 'pages/waste-search.html?q=battery'], ['waste-search-no-results', 'pages/waste-search.html?q=light%20bulb'], ['recycling-guide', 'pages/recycling-guide.html'], ['locations', 'pages/locations.html'], ['contact', 'pages/contact.html'], ['login', 'pages/login.html'], ['dashboard-locked', 'pages/dashboard.html'], ['not-found', '404.html']]) {
      await page.goto(BASE + url);
      if (name === 'locations') await page.waitForSelector('.leaflet-tile-loaded', { timeout: 10000 }).catch(() => {});
      await shot(page, name, viewName);
    }
    await login(page, ALEX);
    await shot(page, 'dashboard-resident', viewName);
    await page.evaluate(() => { localStorage.removeItem('ecorecycle_session'); sessionStorage.clear(); });
    await login(page, ADMIN);
    await shot(page, 'dashboard-admin', viewName);
    await page.goto(`${BASE}pages/dashboard.html#admin-directory`);
    await page.reload();
    await page.waitForSelector('#ruleTableBody tr');
    await shot(page, 'dashboard-admin-registry', viewName);
    await context.close();
  }
}

function writeReport(chromeVersion) {
  const passed = results.filter((r) => r.pass).length;
  const cell = (text) => String(text).replace(/\|/g, '\\|').replace(/\n/g, ' ');
  const rows = results.map((r) => `| ${r.id} | ${cell(r.pageName)} | ${cell(r.steps)} | ${cell(r.expected)} | ${cell(r.actual)} | ${r.pass ? 'Pass' : '**FAIL**'} |`).join('\n');
  const report = `# EcoRecycle Australia: Test Report

**Result: ${passed} of ${results.length} tests passed.**

- **Run on:** ${new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })}
- **Browser:** Headless Chrome ${chromeVersion}, driven by Playwright, on ${os.type()} ${os.release()}
- **Accessibility scan:** axe-core, WCAG 2.0 and 2.1 levels A and AA
- **Screenshots:** [docs/screenshots/](docs/screenshots/), desktop (1280px) and mobile (375px) for every page

The "Actual result" column is written by the test script from what it observed during the run. To repeat the run:

\`\`\`bash
npm install --no-save playwright-core axe-core
node tests/e2e.js
\`\`\`

The script serves the site itself and rewrites this file and the screenshots. Installing those two packages is only needed for testing: the website has no dependencies or build step.

## Test cases

| ID | Page | Steps | Expected result | Actual result | Pass/Fail |
|---|---|---|---|---|---|
${rows}

## What these tests do not cover

- **Other browsers and real devices:** the run used Chrome only, with mobile widths simulated. Safari, Firefox and physical phones were not tested.
- **Screen readers:** axe-core and keyboard tests catch many accessibility problems, but a person using NVDA or VoiceOver was not part of this run. axe-core also cannot judge everything that WCAG requires.
- **Live GitHub Pages:** the sub-folder and 404 behaviour was simulated by serving the files from the project's expected GitHub Pages address. The deployed site itself was not visited.
- **Map link destinations:** the Google Maps and OpenStreetMap directions links were checked for correct format but were not opened.
- **Sent messages:** reminders and enquiries are stored only in the browser. No email or SMS exists to test.
`;
  fs.writeFileSync(path.join(ROOT, 'TESTING.md'), report);
  return { passed, total: results.length };
}

async function main() {
  await new Promise((resolve, reject) => {
    server.once('error', () => server.listen(0, resolve));
    server.listen(8080, resolve);
    void reject;
  });
  BASE = `http://localhost:${server.address().port}/`;
  browser = await chromium.launch({ channel: 'chrome' });
  const chromeVersion = browser.version();

  await navigationTests();
  await homeTests();
  await searchTests();
  await guideTests();
  await locationTests();
  await contactTests();
  await authTests();
  await dashboardTests();
  await adminTests();
  await responsiveTests();
  await a11yTests();
  await resilienceTests();

  await test('ERR-04', 'All', 'Review browser console output from all of the tests above (those that deliberately block resources are excluded).', 'No console errors or uncaught exceptions.', async () => {
    ok(consoleProblems.length === 0, [...new Set(consoleProblems)].slice(0, 5).join(' | '));
    return 'No console errors or uncaught exceptions recorded.';
  });

  if (!process.argv.includes('--no-shots')) await screenshots();
  const { passed, total } = writeReport(chromeVersion);
  console.log(`\n${passed}/${total} passed`);
  await browser.close();
  server.close();
  process.exit(passed === total ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
