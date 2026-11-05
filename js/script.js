/* ==========================================================================
   EcoRecycle Australia: application script (vanilla JS, no build step)

   Sections
     1. CORE       paths and small helpers
     2. DATA       seed data: waste rules, requests, accounts, hubs, resin codes
     3. STORAGE    guarded localStorage access with fallback to seed data
     4. UI         icons, toasts, modals, confirm dialog, form validation
     5. AUTH       salted SHA-256 accounts, sessions, login and register pages
     6. NAVIGATION hamburger menu and signed-in nav state
     7. SCHEDULE   collection calendar and reminders
     8. SEARCH     waste search, suggestions, admin queue requests
     9. GUIDE      category navigation and resin-code decoder
    10. LOCATIONS  hub finder, Leaflet map, directions, saved hubs
    11. CONTACT    enquiry form
    12. DASHBOARD  route guard, resident view, admin view
    13. BOOT       page start-up
   ========================================================================== */
'use strict';

/* ==========================================================================
   1. CORE
   ========================================================================== */

/* Site root worked out from this script's own URL, so links work from
   index.html, /pages/ and a GitHub Pages sub-folder alike. */
const SITE_ROOT = new URL('../', document.currentScript ? document.currentScript.src : window.location.href).href;
const sitePath = (path) => new URL(path, SITE_ROOT).href;

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

/** Escapes text for safe use inside HTML. All dynamic markup goes through this. */
function esc(value) {
  return String(value === undefined || value === null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const clone = (value) => JSON.parse(JSON.stringify(value));

/** Local calendar date as YYYY-MM-DD (not UTC, which can be a day out in Australia). */
function toISODate(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function daysAgoISO(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return toISODate(d);
}

function parseISODate(iso) {
  const parts = String(iso || '').split('-').map(Number);
  const date = parts.length === 3 ? new Date(parts[0], parts[1] - 1, parts[2]) : new Date(NaN);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDate(iso, options = { day: 'numeric', month: 'short', year: 'numeric' }) {
  const date = parseISODate(iso);
  return date ? date.toLocaleDateString('en-AU', options) : String(iso || '');
}

/**
 * Click handlers registered by name. Markup uses data-action="name" rather than
 * inline onclick, which keeps user content out of attribute strings.
 */
const ACTIONS = {};

function handleActionClick(event) {
  const trigger = event.target.closest('[data-action]');
  if (!trigger) return;
  const handler = ACTIONS[trigger.dataset.action];
  if (!handler) return;
  if (trigger.tagName === 'A' && trigger.getAttribute('href') === '#') event.preventDefault();
  Promise.resolve()
    .then(() => handler(trigger, event))
    .catch((error) => {
      console.error(error);
      showToast('Something went wrong. Please try again.', 'error');
    });
}

document.addEventListener('click', handleActionClick);

/* ==========================================================================
   2. DATA (seed values, copied into localStorage on first visit)
   ========================================================================== */

const CATEGORIES = ['Plastic', 'Paper & Cardboard', 'Glass', 'Metal', 'E-Waste', 'Organics', 'General Waste'];

/* How each disposal status is displayed and logged. */
const RULE_STATUS = {
  recyclable: { label: 'Recyclable', badge: 'badge-recyclable', icon: 'check-circle-2', logStatus: 'Recycled' },
  'not-recyclable': { label: 'Not Recyclable', badge: 'badge-non-recyclable', icon: 'x-circle', logStatus: 'Landfill' },
  special: { label: 'Special Drop-off', badge: 'badge-special', icon: 'alert-triangle', logStatus: 'Drop-off' },
};

const LOG_STATUS_BADGE = { Recycled: 'badge-recyclable', 'Drop-off': 'badge-special', Landfill: 'badge-non-recyclable' };

const YELLOW_BIN = 'Yellow Recycling Bin';
const GREEN_BIN = 'Green FOGO Bin';
const RED_BIN = 'Red General Waste Bin';

const SEED_RULES = [
  /* [id, name, category, status, disposal method, preparation steps, search keywords] */

  // Plastic
  ['plastic-bottle', 'Plastic Water Bottle (PET #1)', 'Plastic', 'recyclable', YELLOW_BIN, ['Empty out all liquid.', 'Rinse out any residue with a little water.', 'Screw the cap back on so it is not lost during sorting.', 'Eligible drink bottles can also earn a 10c refund through your state\'s container deposit scheme.'], 'soft drink soda container deposit pet'],
  ['milk-bottle', 'Plastic Milk Bottle (HDPE #2)', 'Plastic', 'recyclable', YELLOW_BIN, ['Empty and rinse the bottle.', 'Screw the lid back on.', 'Place it in the bin loose, not in a plastic bag.'], 'hdpe juice jug'],
  ['detergent-bottle', 'Shampoo & Detergent Bottle', 'Plastic', 'recyclable', YELLOW_BIN, ['Use up the contents and rinse the bottle.', 'Remove pump dispensers, which contain metal springs, and put them in the red bin.', 'Replace the screw cap.'], 'conditioner body wash laundry dishwashing cleaning'],
  ['yoghurt-tub', 'Yoghurt & Margarine Tub (PP #5)', 'Plastic', 'recyclable', YELLOW_BIN, ['Scrape out any food.', 'Rinse lightly.', 'Keep the tub and lid together, or put small lids in the red bin.'], 'ice cream butter container polypropylene'],
  ['takeaway-container', 'Rigid Plastic Takeaway Container', 'Plastic', 'recyclable', YELLOW_BIN, ['Scrape out all food scraps.', 'Rinse off sauce and oil.', 'Check that it holds its shape: firm plastic only.'], 'food punnet tray clamshell berry'],
  ['soft-plastic', 'Soft Plastic Bag & Wrapper', 'Plastic', 'special', 'Soft Plastics Drop-off (where available)', ['Never put soft plastics in the yellow bin, because they tangle sorting machinery.', 'Use the scrunch test: if it springs back after scrunching, it is soft plastic.', 'Take clean, dry soft plastics to a collection point if one operates near you. Otherwise use the red bin.'], 'shopping bag bread bag chip packet wrapper film freezer lolly'],
  ['polystyrene', 'Polystyrene Foam Packaging', 'Plastic', 'not-recyclable', RED_BIN, ['Foam breaks apart and contaminates recycling.', 'Break large pieces down so the bin lid closes.', 'Some councils accept clean foam at drop-off days, so check locally.'], 'styrofoam esky foam meat tray packing peanuts'],
  ['plastic-cutlery', 'Plastic Straws & Cutlery', 'Plastic', 'not-recyclable', RED_BIN, ['These items are too small to be sorted at recycling facilities.', 'Place them in the red bin.', 'Switch to reusable cutlery where you can.'], 'fork spoon knife single use'],
  ['cling-wrap', 'Cling Wrap', 'Plastic', 'not-recyclable', RED_BIN, ['Soiled film cannot be recycled.', 'Place it in the red bin, not the yellow bin.'], 'glad wrap plastic film'],
  ['garden-hose', 'Garden Hose & PVC Pipe (#3)', 'Plastic', 'not-recyclable', RED_BIN, ['Hoses wrap around sorting equipment and stop the line.', 'Cut long lengths to fit the red bin, or book a council bulky collection.'], 'pvc pipe tube irrigation'],

  // Paper & Cardboard
  ['cardboard-box', 'Cardboard Box (Clean)', 'Paper & Cardboard', 'recyclable', YELLOW_BIN, ['Flatten the box completely to save bin space.', 'Remove heavy plastic wrapping and polystyrene.', 'Keep it dry, because wet cardboard cannot be processed.'], 'delivery parcel carton shipping moving'],
  ['pizza-box', 'Pizza Box (Soiled / Greasy)', 'Paper & Cardboard', 'not-recyclable', `${RED_BIN} or ${GREEN_BIN}`, ['Grease and food residue contaminate paper recycling.', 'Tear off any clean lid and put that part in the yellow bin.', 'Put the greasy base in the green FOGO bin if your council accepts it, otherwise the red bin.'], 'greasy food container takeaway'],
  ['newspaper', 'Newspapers & Magazines', 'Paper & Cardboard', 'recyclable', YELLOW_BIN, ['Remove any plastic wrapping.', 'Keep them dry and place them in the bin loose.'], 'junk mail catalogue brochure glossy'],
  ['office-paper', 'Office Paper & Envelopes', 'Paper & Cardboard', 'recyclable', YELLOW_BIN, ['Place sheets in the bin loose, not bagged.', 'Staples and envelope windows can stay in place.'], 'printer letter notebook'],
  ['cereal-box', 'Cereal & Food Boxes', 'Paper & Cardboard', 'recyclable', YELLOW_BIN, ['Remove the inner plastic liner and put it in the red bin.', 'Flatten the box.'], 'cracker pasta tissue box paperboard'],
  ['milk-carton', 'Milk & Juice Carton', 'Paper & Cardboard', 'recyclable', YELLOW_BIN, ['Empty and rinse the carton.', 'Flatten it and replace the cap.', 'Most councils accept cartons, but check locally for long-life cartons.'], 'liquid paperboard tetra pak'],
  ['egg-carton', 'Cardboard Egg Carton', 'Paper & Cardboard', 'recyclable', YELLOW_BIN, ['Remove any broken egg.', 'Place the clean carton in the bin. Soiled cartons can go in the green FOGO bin.'], 'eggs'],
  ['coffee-cup', 'Takeaway Coffee Cup', 'Paper & Cardboard', 'not-recyclable', RED_BIN, ['Paper cups have a thin plastic lining that stops them being pulped with paper.', 'Put the cup in the red bin.', 'Rigid plastic lids are accepted by some councils, so check locally.', 'A reusable cup avoids this waste altogether.'], 'disposable paper tea'],
  ['tissues', 'Used Tissues & Paper Towels', 'Paper & Cardboard', 'not-recyclable', `${RED_BIN} or ${GREEN_BIN}`, ['Used paper fibres are too short and too soiled to recycle.', 'Put them in the green FOGO bin if your council accepts them, otherwise the red bin.'], 'napkin serviette kitchen towel'],
  ['receipts', 'Thermal Receipts', 'Paper & Cardboard', 'not-recyclable', RED_BIN, ['Shiny thermal paper contains chemical coatings that contaminate paper recycling.', 'Place it in the red bin.'], 'docket eftpos'],
  ['shredded-paper', 'Shredded Paper', 'Paper & Cardboard', 'not-recyclable', `${GREEN_BIN} or ${RED_BIN}`, ['Shreds are too small to sort and they scatter at the facility.', 'Add them to home compost or the green FOGO bin if accepted.', 'Otherwise use the red bin.'], 'documents confidential'],

  // Glass
  ['glass-bottle', 'Glass Drink Bottle (Clear/Green/Brown)', 'Glass', 'recyclable', YELLOW_BIN, ['Empty and rinse the bottle.', 'Remove the lid, then see "Metal Jar Lids & Bottle Caps".', 'Eligible bottles can also earn a 10c refund through your state\'s container deposit scheme.'], 'beer wine soft drink container deposit'],
  ['glass-jar', 'Glass Food Jar', 'Glass', 'recyclable', YELLOW_BIN, ['Scrape out food and rinse.', 'Remove the lid. Labels can stay on.'], 'jam sauce pasta pickle honey vegemite'],
  ['drinking-glass', 'Drinking Glass & Glassware', 'Glass', 'not-recyclable', RED_BIN, ['Drinking glass melts at a different temperature from bottles and spoils recycled glass.', 'Wrap broken pieces in newspaper before putting them in the red bin.', 'Donate unbroken items instead.'], 'tumbler wine glass vase'],
  ['mirror', 'Mirror & Window Glass', 'Glass', 'not-recyclable', RED_BIN, ['Treated glass cannot be recycled with bottles and jars.', 'Wrap sharp pieces securely.', 'Use a council bulky collection for large panes.'], 'window pane sheet glass'],
  ['ceramic', 'Ceramic Plate & Mug', 'Glass', 'not-recyclable', RED_BIN, ['Ceramics do not melt with glass and contaminate whole batches.', 'Wrap broken pieces. Donate items in good condition.'], 'crockery bowl cup porcelain china terracotta'],
  ['broken-glass', 'Broken Glass', 'Glass', 'not-recyclable', RED_BIN, ['Broken glass is a hazard for sorting staff.', 'Wrap it in newspaper or put it in a sealed box, and label it "glass".', 'Place it in the red bin.'], 'shards smashed'],

  // Metal
  ['aluminium-can', 'Aluminium Beverage Can', 'Metal', 'recyclable', YELLOW_BIN, ['Empty out all liquid and rinse lightly.', 'Do not crush the can, because sorting machines identify it by shape.', 'Eligible cans can also earn a 10c refund through your state\'s container deposit scheme.'], 'soft drink beer soda container deposit'],
  ['steel-tin', 'Steel Food Tin', 'Metal', 'recyclable', YELLOW_BIN, ['Empty and rinse to prevent odours.', 'Push the lid inside the tin if it has come off.'], 'can soup tuna pet food baked beans'],
  ['aluminium-foil', 'Aluminium Foil & Foil Trays', 'Metal', 'recyclable', YELLOW_BIN, ['Wipe off any food.', 'Scrunch foil into a ball at least the size of a golf ball, so it can be sorted.', 'Foil-lined chip packets are soft plastics, not foil.'], 'baking tray takeaway pie'],
  ['jar-lids', 'Metal Jar Lids & Bottle Caps', 'Metal', 'recyclable', YELLOW_BIN, ['Small lids are lost in sorting if loose.', 'Collect them inside a steel tin and pinch the top closed.', 'Place the tin in the yellow bin.'], 'beer cap crown seal'],
  ['scrap-metal', 'Pots, Pans & Scrap Metal', 'Metal', 'special', 'Council Drop-off or Scrap Metal Dealer', ['Do not put heavy metal items in the yellow bin, because they damage equipment.', 'Take them to a council resource centre or scrap dealer.', 'Donate cookware that is still usable.'], 'saucepan frying pan cutlery tools wire'],
  ['gas-bottle', 'Gas Bottle (LPG)', 'Metal', 'special', 'Bottle Swap or Council Drop-off', ['Never put gas bottles in any bin, because they can explode in collection trucks.', 'Swap them at a retailer that exchanges bottles.', 'Take damaged or out-of-date bottles to a council facility.'], 'bbq barbecue butane camping cylinder'],

  ['coat-hanger', 'Wire Coat Hanger', 'Metal', 'not-recyclable', RED_BIN, ['Hangers snag sorting machinery, so keep them out of the yellow bin.', 'Return them to a dry cleaner or donate them.', 'Otherwise take them to a scrap metal dealer or use the red bin.'], 'wire clothes dry cleaner'],

  // E-Waste
  ['battery-aa', 'AA / AAA Household Battery', 'E-Waste', 'special', 'Battery Drop-off Point', ['Never put batteries in a household bin, because they are a fire hazard.', 'Tape the terminals with clear tape to prevent short circuits.', 'Take them to a B-cycle drop-off point, found at many major retailers.'], 'batteries lithium alkaline remote torch 9v button'],
  ['lithium-battery', 'Lithium-ion Battery & Power Bank', 'E-Waste', 'special', 'Battery Drop-off Point', ['Never put these in a bin, because damaged lithium batteries can start fires in trucks.', 'Tape the terminals and store them somewhere cool until drop-off.', 'Take them to a battery drop-off or e-waste hub. Damaged batteries go to a hazardous waste facility.'], 'batteries powerbank laptop battery e-bike scooter tool'],
  ['car-battery', 'Car Battery', 'E-Waste', 'special', 'Auto Retailer or Council Drop-off', ['Lead-acid batteries contain hazardous acid.', 'Keep the battery upright and do not stack it.', 'Return it to an auto retailer or council chemical drop-off.'], 'batteries lead acid vehicle boat'],
  ['mobile-phone', 'Mobile Phone & Tablet', 'E-Waste', 'special', 'E-Waste Hub or MobileMuster Point', ['Back up your data and perform a factory reset.', 'Remove the SIM card.', 'Drop it off at a MobileMuster point or e-waste hub, including chargers and accessories.'], 'smartphone iphone android ipad electronics'],
  ['laptop', 'Laptop & Desktop Computer', 'E-Waste', 'special', 'E-Waste Hub', ['Back up and securely wipe your data.', 'Take the computer and accessories to an e-waste hub.', 'Donate working equipment where possible.'], 'computer monitor keyboard mouse printer electronics pc'],
  ['television', 'Television', 'E-Waste', 'special', 'E-Waste Hub', ['Do not leave TVs on the kerb.', 'Take it to a free e-waste collection point or council drop-off.'], 'tv screen electronics'],
  ['printer-cartridge', 'Printer Cartridge', 'E-Waste', 'special', 'Cartridge Collection Box', ['Keep the cartridge in a bag or its original packaging to stop leaks.', 'Drop it at a Cartridges 4 Planet Ark box, found at many office supply stores.'], 'ink toner'],
  ['cables', 'Chargers & Cables', 'E-Waste', 'special', 'E-Waste Hub', ['Cables tangle sorting machinery, so keep them out of the yellow bin.', 'Bundle them with a rubber band and take them to an e-waste hub.'], 'usb cord adapter power lead electronics'],
  ['small-appliance', 'Small Appliance (Kettle, Toaster)', 'E-Waste', 'special', 'E-Waste Hub or Council Drop-off', ['Empty any water and clear out crumbs.', 'Take it to an e-waste hub or council resource centre.', 'Consider repair or donation if it still works.'], 'hairdryer microwave blender iron electronics'],

  // Organics
  ['fruit-veg', 'Fruit & Vegetable Scraps', 'Organics', 'recyclable', GREEN_BIN, ['Collect scraps in a kitchen caddy.', 'Remove stickers and plastic ties.', 'Put them in the green FOGO bin if your council offers it, or home compost.'], 'peel peelings banana apple food scraps fogo'],
  ['cooked-food', 'Cooked Food, Meat & Bones', 'Organics', 'recyclable', GREEN_BIN, ['Remove all packaging.', 'Wrap in newspaper to reduce smells.', 'If your council has no FOGO service, use the red bin. Do not add meat to home compost.'], 'leftovers chicken fish dairy food scraps fogo'],
  ['coffee-grounds', 'Coffee Grounds & Tea Leaves', 'Organics', 'recyclable', GREEN_BIN, ['Empty grounds into the caddy or compost.', 'Remove plastic pods and tea bags with plastic mesh.'], 'tea bag espresso compost fogo'],
  ['garden-waste', 'Grass Clippings & Prunings', 'Organics', 'recyclable', GREEN_BIN, ['Place garden waste in the bin loose.', 'Cut branches to fit under the closed lid.', 'Remove any soil, rocks, plastic pots or treated timber.'], 'lawn leaves branches weeds flowers garden fogo'],
  ['eggshells', 'Eggshells & Nut Shells', 'Organics', 'recyclable', GREEN_BIN, ['Add them to the kitchen caddy with other food scraps.', 'Crush shells to help them break down faster in home compost.'], 'egg shell peanut walnut compost food scraps fogo'],
  ['compostable-liner', 'Compostable Caddy Liner', 'Organics', 'recyclable', GREEN_BIN, ['Only use liners supplied or approved by your council.', 'Plastic and "degradable" bags contaminate FOGO, so put those in the red bin.'], 'bag compostable biodegradable fogo'],

  // General Waste
  ['nappies', 'Disposable Nappies', 'General Waste', 'not-recyclable', RED_BIN, ['Empty solids into the toilet where possible.', 'Wrap the nappy and place it in the red bin.', 'Never put nappies in yellow or green bins.'], 'diaper baby wipes'],
  ['face-masks', 'Face Masks & Disposable Gloves', 'General Waste', 'not-recyclable', RED_BIN, ['Used personal protective items are a hygiene risk for sorting staff.', 'Bag them and place them in the red bin.'], 'ppe medical rubber latex'],
  ['cigarette-butts', 'Cigarette Butts', 'General Waste', 'not-recyclable', RED_BIN, ['Make sure they are fully extinguished.', 'Place them in the red bin, never on the ground or in drains.'], 'smoking ash tobacco'],
  ['pet-waste', 'Pet Waste & Kitty Litter', 'General Waste', 'not-recyclable', RED_BIN, ['Bag it securely.', 'Place it in the red bin. It is not accepted in FOGO bins.'], 'dog cat poo animal'],
  ['toothbrush', 'Toothbrush & Toothpaste Tube', 'General Waste', 'not-recyclable', RED_BIN, ['Mixed materials cannot be separated at recycling facilities.', 'Place them in the red bin, or use a dedicated oral-care recycling program if one is near you.'], 'dental floss oral care'],
  ['clothing', 'Clothing & Textiles', 'General Waste', 'special', 'Charity or Textile Collection', ['Donate clean items in good condition.', 'Check whether a textile recycling service operates nearby for worn items.', 'Damaged items with no other option go in the red bin.'], 'clothes shoes fabric sheets towels'],
  ['mattress', 'Mattress & Furniture', 'General Waste', 'special', 'Council Bulky Waste Collection', ['Book your council\'s bulky waste collection or take it to a resource centre.', 'Many facilities recover the steel and foam from mattresses.', 'Donate furniture that is still usable.'], 'couch sofa bed table chair hard rubbish'],
  ['medicines', 'Expired Medicines', 'General Waste', 'special', 'Pharmacy Return (RUM Project)', ['Never flush medicines or put them in a bin.', 'Return them to any community pharmacy for free, safe disposal.'], 'tablets pills prescription rum sharps'],
  ['household-chemicals', 'Household Chemicals & Paint', 'General Waste', 'special', 'Household Chemical Drop-off', ['Never pour chemicals down the drain.', 'Keep them in the original container with the lid on.', 'Take them to a household chemical drop-off or Paintback site.'], 'paint tin pesticide pool cleaner solvent motor oil hazardous'],
].map(([id, name, category, status, disposalMethod, instructions, keywords]) => ({
  id, name, category, status, disposalMethod, instructions, keywords,
  adminNote: 'Verified by Tanu (Admin)',
  updatedDate: '2026-10-01',
}));

/* Requests already waiting in the admin queue. They are deliberately not in the
   rule list, so approving one visibly adds it to public search. */
function seedPendingRequests() {
  return [
    { id: 'req-aerosol', name: 'Empty Aerosol Spray Can', category: 'Metal', status: 'recyclable', disposalMethod: YELLOW_BIN, instructions: ['Make sure the can is completely empty.', 'Remove the plastic lid and put it in the red bin.', 'Do not pierce or crush the can.'], submittedBy: 'alex.johnson@example.com', dateSubmitted: daysAgoISO(2), reason: 'Residents are unsure whether a pressurised can may go in the kerbside bin.' },
    { id: 'req-bubble-wrap', name: 'Bubble Wrap Packaging Film', category: 'Plastic', status: 'special', disposalMethod: 'Soft Plastics Drop-off (where available)', instructions: ['Keep bubble wrap out of the yellow bin, because film tangles sorting machines.', 'Reuse it for packing if you can.', 'Take it to a soft plastics collection point where available. Otherwise use the red bin.'], submittedBy: 'maria.garcia@example.com', dateSubmitted: daysAgoISO(3), reason: 'Plastic film tangles sorting machines, so a clear rule is needed.' },
    { id: 'req-vape', name: 'Disposable Vape', category: 'E-Waste', status: 'special', disposalMethod: 'Household Chemical Drop-off', instructions: ['Never put vapes in a household bin, because the lithium battery is a fire risk.', 'Do not try to take the device apart.', 'Take it to a household chemical or hazardous waste drop-off.'], submittedBy: 'david.chen@example.com', dateSubmitted: daysAgoISO(4), reason: 'Vapes contain a lithium battery and nicotine residue.' },
    { id: 'req-pyrex', name: 'Broken Pyrex Baking Dish', category: 'Glass', status: 'not-recyclable', disposalMethod: RED_BIN, instructions: ['Heat-resistant glass melts at a different temperature and spoils recycled glass.', 'Wrap it securely in newspaper.', 'Place it in the red bin.'], submittedBy: 'resident.lee@example.com', dateSubmitted: daysAgoISO(6), reason: 'Treated heat-resistant glass ruins recycled bottle batches.' },
  ];
}

/* Demo accounts: dummy data only. Passwords are stored as salted SHA-256 hashes. */
const ALEX_ID = 'user-alex-johnson';
const ADMIN_ID = 'user-admin';

const SEED_USERS = [
  {
    id: ALEX_ID,
    name: 'Alex Johnson',
    email: 'alex.johnson@example.com',
    role: 'resident',
    roleTitle: 'Resident • Suburb Zone 4',
    salt: '6f1d2c9ab34e4f7c8a10d5e2b7c46a93',
    passwordHash: '3f8638bfc1fbd5179958def458cb1f28234063c19b96fd40d074258060652a80',
    address: '142 Greenpoint Avenue',
    accountId: 'ECO-88421',
    createdAt: '2026-01-15',
    demo: true,
    // Earlier history, so 6 logged rows + 36 = 42 items, 24.5 kg and an 86% score.
    baseline: { items: 36, diverted: 31, kg: 21.8 },
  },
  {
    id: ADMIN_ID,
    name: 'Tanu',
    email: 'admin@ecorecycle.org',
    role: 'admin',
    roleTitle: 'Senior Waste Operations Manager',
    salt: 'c27e91b04d3a48f6b5e8127fa9d3360e',
    passwordHash: 'cdb956785db272942be7a8464d8640fee4e978f171b1050ce34135c5c9da81b4',
    address: '',
    accountId: 'ECO-00001',
    createdAt: '2026-01-01',
    demo: true,
    baseline: { items: 0, diverted: 0, kg: 0 },
  },
];

function seedActivity() {
  const rows = [
    ['Plastic Water Bottle (PET #1)', 'Plastic', YELLOW_BIN, 0.4, 'Recycled', 1],
    ['Cardboard Delivery Box', 'Paper & Cardboard', YELLOW_BIN, 1.2, 'Recycled', 3],
    ['Expired AA Batteries (4x)', 'E-Waste', 'Battery Drop-off Point', 0.2, 'Drop-off', 5],
    ['Soiled Pizza Box (Base)', 'General Waste', RED_BIN, 0.3, 'Landfill', 7],
    ['Aluminium Soda Can', 'Metal', YELLOW_BIN, 0.3, 'Recycled', 9],
    ['Glass Jam Jar', 'Glass', YELLOW_BIN, 0.6, 'Recycled', 12],
  ];
  return {
    [ALEX_ID]: rows.map(([item, category, disposal, kg, status, days], index) => ({
      id: `seed-${index + 1}`, item, category, disposal, kg, status, date: daysAgoISO(days),
    })),
  };
}

/* Sample drop-off hubs. Names, street addresses and hours are fictional; suburbs,
   postcodes and map positions are real. Phone numbers use the (0x) 5550 range that
   ACMA reserves for fictional use. */
const HUBS = [
  { id: 'greenpoint', name: 'GreenPoint Community Recycling Centre', street: '142 Environmental Way', suburb: 'Alexandria', state: 'NSW', postcode: '2015', lat: -33.9105, lng: 151.1945, types: ['Plastic', 'Paper', 'Glass', 'Metal'], hours: 'Mon–Sat: 8:00 AM – 5:00 PM', phone: '(02) 5550 0101' },
  { id: 'ecohub', name: 'EcoHub E-Waste & Battery Depot', street: '88 Innovation Boulevard', suburb: 'Macquarie Park', state: 'NSW', postcode: '2113', lat: -33.7756, lng: 151.1208, types: ['E-Waste', 'Batteries', 'Metal'], hours: 'Mon–Fri: 9:00 AM – 6:00 PM', phone: '(02) 5550 0102' },
  { id: 'metro-glass', name: 'Metro Glass & Organics Drop-off', street: '12 Recycling Crescent', suburb: 'Haymarket', state: 'NSW', postcode: '2000', lat: -33.8802, lng: 151.2032, types: ['Glass', 'Organics'], hours: '7 Days: 7:00 AM – 7:00 PM', phone: '(02) 5550 0103' },
  { id: 'northside', name: 'Northside Hazardous Waste & Chemical Facility', street: '50 Industrial Highway', suburb: 'Hornsby', state: 'NSW', postcode: '2077', lat: -33.7027, lng: 151.0994, types: ['Batteries', 'E-Waste', 'Plastic'], hours: 'Sat & Sun: 9:00 AM – 3:00 PM', phone: '(02) 5550 0104' },
  { id: 'parramatta', name: 'Parramatta Resource Centre', street: '27 River Road', suburb: 'Parramatta', state: 'NSW', postcode: '2150', lat: -33.8148, lng: 151.0017, types: ['Plastic', 'Paper', 'Glass', 'Metal', 'Organics'], hours: 'Mon–Sun: 8:00 AM – 4:30 PM', phone: '(02) 5550 0105' },
  { id: 'brunswick', name: 'Brunswick Circular Drop-off', street: '310 Merri Street', suburb: 'Brunswick', state: 'VIC', postcode: '3056', lat: -37.7667, lng: 144.9601, types: ['Plastic', 'Paper', 'E-Waste', 'Batteries'], hours: 'Tue–Sun: 9:00 AM – 5:00 PM', phone: '(03) 5550 0106' },
  { id: 'woolloongabba', name: 'Woolloongabba Recovery Hub', street: '19 Stanley Lane', suburb: 'Woolloongabba', state: 'QLD', postcode: '4102', lat: -27.4886, lng: 153.0365, types: ['Glass', 'Metal', 'E-Waste', 'Batteries'], hours: 'Mon–Sat: 7:30 AM – 4:00 PM', phone: '(07) 5550 0107' },
  { id: 'osborne-park', name: 'Osborne Park Resource Depot', street: '6 Scarborough Link', suburb: 'Osborne Park', state: 'WA', postcode: '6017', lat: -31.9012, lng: 115.8142, types: ['Plastic', 'Paper', 'Metal', 'E-Waste', 'Organics'], hours: 'Mon–Fri: 8:00 AM – 5:00 PM', phone: '(08) 5550 0108' },
];

/* Distances are measured from here until the visitor shares their location. */
const DEFAULT_REFERENCE = { lat: -33.8688, lng: 151.2093, label: 'Sydney CBD' };

/* Plastic resin identification codes for the Recycling Guide decoder. */
const RESIN_CODES = [
  { code: 1, abbr: 'PET', name: 'Polyethylene Terephthalate', examples: 'Water and soft drink bottles, some food jars.', kerbside: 'Accepted in most yellow bins.', status: 'recyclable', tip: 'Eligible bottles earn a 10c refund through container deposit schemes, which keeps high-quality PET in circulation.' },
  { code: 2, abbr: 'HDPE', name: 'High-Density Polyethylene', examples: 'Milk bottles, detergent and shampoo bottles.', kerbside: 'Accepted in most yellow bins.', status: 'recyclable', tip: 'Recycled HDPE is often made into new bottles, pipes and outdoor furniture.' },
  { code: 3, abbr: 'PVC', name: 'Polyvinyl Chloride', examples: 'Pipes, garden hoses, some blister packs.', kerbside: 'Generally not accepted.', status: 'not-recyclable', tip: 'Small amounts of PVC can spoil a whole batch of recycled PET, so keep it out of the yellow bin.' },
  { code: 4, abbr: 'LDPE', name: 'Low-Density Polyethylene', examples: 'Soft squeeze bottles, plastic bags, cling film.', kerbside: 'Not accepted loose in the yellow bin. Use a soft plastics collection where available.', status: 'special', tip: 'Film tangles sorting machinery and can shut a facility down for cleaning.' },
  { code: 5, abbr: 'PP', name: 'Polypropylene', examples: 'Yoghurt tubs, takeaway containers, bottle caps.', kerbside: 'Rigid items are accepted by most councils.', status: 'recyclable', tip: 'Rinse food residue off tubs and containers so that they do not contaminate paper in the bin.' },
  { code: 6, abbr: 'PS', name: 'Polystyrene', examples: 'Foam packaging, meat trays, disposable cups.', kerbside: 'Generally not accepted.', status: 'not-recyclable', tip: 'Foam breaks up easily and pollutes waterways, so choose alternatives where you can.' },
  { code: 7, abbr: 'Other', name: 'Other Plastics', examples: 'Mixed or layered plastics, acrylic, some compostable plastics.', kerbside: 'Generally not accepted. Check with your council.', status: 'not-recyclable', tip: 'Mixed plastics are hard to recycle, so buy single-material packaging when you have the choice.' },
];

/* ==========================================================================
   3. STORAGE
   All persistent data goes through this section. If localStorage is blocked,
   full or corrupted, the app falls back to seed data or an in-memory copy and
   keeps working for the current page.
   ========================================================================== */

const KEYS = {
  users: 'ecorecycle_users',
  session: 'ecorecycle_session',
  rememberedEmail: 'ecorecycle_remembered_email',
  rules: 'ecorecycle_waste_rules',
  pending: 'ecorecycle_pending_requests',
  activity: 'ecorecycle_activity_log',
  savedHubs: 'ecorecycle_saved_hubs',
  reminders: 'ecorecycle_reminders',
  preferences: 'ecorecycle_preferences',
  enquiries: 'ecorecycle_enquiries',
};

const Store = {
  memory: {},
  warned: false,

  read(key, fallback) {
    if (Object.prototype.hasOwnProperty.call(this.memory, key)) return clone(this.memory[key]);
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return clone(fallback);
      return JSON.parse(raw);
    } catch (error) {
      console.warn(`Could not read ${key}; using default data.`, error);
      return clone(fallback);
    }
  },

  write(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      delete this.memory[key];
      return true;
    } catch (error) {
      // Keep the change for this page view so the action still appears to work.
      this.memory[key] = clone(value);
      if (!this.warned) {
        this.warned = true;
        console.warn('Browser storage is unavailable; changes will not be kept.', error);
        showToast('Your browser is blocking storage, so changes will not be saved.', 'error');
      }
      return false;
    }
  },

  remove(key) {
    delete this.memory[key];
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.warn(`Could not remove ${key}.`, error);
    }
  },
};

const isPlainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

/** Reads a list, keeping only well-formed records. Corrupt or empty data falls back to the seed. */
function readList(key, seed, isValid) {
  const value = Store.read(key, seed);
  if (!Array.isArray(value)) return clone(seed);
  const valid = value.filter(isValid);
  return valid.length || !value.length ? valid : clone(seed);
}

function readMap(key, seed = {}) {
  const value = Store.read(key, seed);
  return isPlainObject(value) ? value : clone(seed);
}

const isValidRule = (r) => isPlainObject(r) && typeof r.id === 'string' && typeof r.name === 'string'
  && CATEGORIES.includes(r.category) && Boolean(RULE_STATUS[r.status]) && Array.isArray(r.instructions);
const isValidRequest = (r) => isPlainObject(r) && typeof r.id === 'string' && typeof r.name === 'string';
const isValidUser = (u) => isPlainObject(u) && typeof u.id === 'string' && typeof u.email === 'string'
  && typeof u.salt === 'string' && typeof u.passwordHash === 'string';

/* Typed accessors */
const getRules = () => readList(KEYS.rules, SEED_RULES, isValidRule);
const saveRules = (rules) => Store.write(KEYS.rules, rules);
const getPending = () => readList(KEYS.pending, seedPendingRequests(), isValidRequest);
const savePending = (requests) => Store.write(KEYS.pending, requests);
const getEnquiries = () => readList(KEYS.enquiries, [], isPlainObject);
const saveEnquiries = (enquiries) => Store.write(KEYS.enquiries, enquiries);

function getUsers() {
  const users = readList(KEYS.users, SEED_USERS, isValidUser);
  // The demo accounts always exist, so the README journey can't be locked out.
  SEED_USERS.forEach((seed) => {
    if (!users.some((user) => user.id === seed.id)) users.push(clone(seed));
  });
  return users;
}
const saveUsers = (users) => Store.write(KEYS.users, users);

function getActivityMap() {
  return readMap(KEYS.activity, seedActivity());
}

function getActivity(userId) {
  const rows = getActivityMap()[userId];
  return Array.isArray(rows) ? rows.filter(isPlainObject) : [];
}

function saveActivity(userId, rows) {
  const map = getActivityMap();
  map[userId] = rows;
  Store.write(KEYS.activity, map);
}

/* Per-user records are keyed by user id; signed-out visitors share the "guest" key. */
const GUEST_KEY = 'guest';

function getSavedHubIds(owner) {
  const ids = readMap(KEYS.savedHubs)[owner];
  return Array.isArray(ids) ? ids.filter((id) => HUBS.some((hub) => hub.id === id)) : [];
}

function saveSavedHubIds(owner, ids) {
  const map = readMap(KEYS.savedHubs);
  map[owner] = ids;
  Store.write(KEYS.savedHubs, map);
}

function getPreferences(userId) {
  const prefs = readMap(KEYS.preferences)[userId];
  return { email: true, sms: false, ...(isPlainObject(prefs) ? prefs : {}) };
}

function savePreferences(userId, prefs) {
  const map = readMap(KEYS.preferences);
  map[userId] = prefs;
  Store.write(KEYS.preferences, map);
}

function getReminders(owner) {
  const dates = readMap(KEYS.reminders)[owner];
  return Array.isArray(dates) ? dates.filter((d) => typeof d === 'string') : [];
}

function saveReminders(owner, dates) {
  const map = readMap(KEYS.reminders);
  map[owner] = dates;
  Store.write(KEYS.reminders, map);
}

/** First visit: writes the seed data so that later reads share one source of truth. */
function initStorage() {
  const seedIfMissing = (key, value) => {
    try {
      if (localStorage.getItem(key) === null) Store.write(key, value);
    } catch (error) {
      /* Reads fall back to seed data when storage is blocked. */
    }
  };
  seedIfMissing(KEYS.users, SEED_USERS);
  seedIfMissing(KEYS.rules, SEED_RULES);
  seedIfMissing(KEYS.pending, seedPendingRequests());
  seedIfMissing(KEYS.activity, seedActivity());
  // Remove the session format used by the original prototype.
  Store.remove('ecorecycle_user');
}

/* ==========================================================================
   4. UI
   ========================================================================== */

/* ---- Icons ---- */

/* Text glyphs used when the Lucide CDN can't be reached, so icon-only buttons
   stay visible. Other icons are decorative and simply disappear. */
const ICON_FALLBACKS = {
  menu: '☰', x: '✕', 'log-out': '⇥', eye: '👁', 'eye-off': '🙈', recycle: '♻', check: '✓',
  'check-circle-2': '✓', 'x-circle': '✕', 'alert-triangle': '⚠', search: '🔍', plus: '+', trash: '🗑',
};

function renderIcons() {
  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons({ attrs: { 'aria-hidden': 'true', focusable: 'false' } });
    return;
  }
  $$('i[data-lucide]').forEach((el) => {
    el.classList.add('icon-fallback');
    el.setAttribute('aria-hidden', 'true');
    el.textContent = ICON_FALLBACKS[el.dataset.lucide] || '';
  });
}

/* ---- Toasts ---- */

function toastRegion() {
  let region = document.getElementById('toastContainer');
  if (!region) {
    region = document.createElement('div');
    region.id = 'toastContainer';
    region.className = 'toast-container';
    region.setAttribute('role', 'status');
    region.setAttribute('aria-live', 'polite');
    region.setAttribute('aria-atomic', 'false');
    document.body.appendChild(region);
  }
  return region;
}

function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  const iconName = type === 'error' ? 'alert-triangle' : type === 'info' ? 'info' : 'check-circle-2';
  toast.innerHTML = `<i data-lucide="${iconName}"></i><span></span>`;
  toast.querySelector('span').textContent = message;
  toastRegion().appendChild(toast);
  renderIcons();
  setTimeout(() => {
    toast.classList.add('is-leaving');
    setTimeout(() => toast.remove(), 300);
  }, 4500);
}

/** Shows a toast on the next page, for messages that come just before a redirect. */
function flashToast(message, type = 'success') {
  try {
    sessionStorage.setItem('ecorecycle_flash', JSON.stringify({ message, type }));
  } catch (error) {
    /* Session storage blocked: the redirect still happens, only the toast is lost. */
  }
}

function showPendingFlash() {
  try {
    const raw = sessionStorage.getItem('ecorecycle_flash');
    if (!raw) return;
    sessionStorage.removeItem('ecorecycle_flash');
    const flash = JSON.parse(raw);
    if (flash && flash.message) showToast(flash.message, flash.type);
  } catch (error) {
    /* A flash message is never essential. */
  }
}

/* ---- Modals: focus trap, Esc to close, focus returned to the opener ---- */

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])';
const modalStack = [];

function focusableIn(container) {
  return $$(FOCUSABLE, container).filter((el) => el.offsetParent !== null || el === document.activeElement);
}

function openModal(modalId) {
  const overlay = document.getElementById(modalId);
  if (!overlay || overlay.classList.contains('active')) return;
  modalStack.push({ overlay, opener: document.activeElement });
  overlay.classList.add('active');
  document.body.style.overflow = 'hidden';
  const box = $('.modal-box', overlay) || overlay;
  const first = $('[data-autofocus]', box) || focusableIn(box).find((el) => !el.classList.contains('modal-close')) || focusableIn(box)[0];
  if (first) first.focus();
}

function closeModal(modalId) {
  const overlay = document.getElementById(modalId);
  if (!overlay || !overlay.classList.contains('active')) return;
  overlay.classList.remove('active');
  const index = modalStack.findIndex((entry) => entry.overlay === overlay);
  const entry = index >= 0 ? modalStack.splice(index, 1)[0] : null;
  if (!modalStack.length) document.body.style.overflow = '';
  if (entry && entry.opener && document.contains(entry.opener)) entry.opener.focus();
  overlay.dispatchEvent(new CustomEvent('modal:closed'));
}

document.addEventListener('keydown', (event) => {
  const top = modalStack[modalStack.length - 1];
  if (!top) return;
  if (event.key === 'Escape') {
    event.preventDefault();
    closeModal(top.overlay.id);
    return;
  }
  if (event.key !== 'Tab') return;
  const items = focusableIn($('.modal-box', top.overlay) || top.overlay);
  if (!items.length) return;
  const first = items[0];
  const last = items[items.length - 1];
  if (event.shiftKey && (document.activeElement === first || !top.overlay.contains(document.activeElement))) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && (document.activeElement === last || !top.overlay.contains(document.activeElement))) {
    event.preventDefault();
    first.focus();
  }
});

// Clicking the dimmed backdrop closes a modal. Mousedown is used so that dragging
// a text selection out of a field never closes the form by accident.
document.addEventListener('mousedown', (event) => {
  if (event.target.classList && event.target.classList.contains('modal-overlay')) closeModal(event.target.id);
});

ACTIONS['close-modal'] = (trigger) => {
  const overlay = trigger.closest('.modal-overlay');
  if (overlay) closeModal(overlay.id);
};

/** Creates a modal on first use. Body markup must already be escaped. */
function buildModal(id, title, bodyHtml, boxClass = '') {
  let overlay = document.getElementById(id);
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = id;
    overlay.className = 'modal-overlay';
    document.body.appendChild(overlay);
  }
  overlay.innerHTML = `
    <div class="modal-box ${boxClass}" role="dialog" aria-modal="true" aria-labelledby="${id}Title">
      <button type="button" class="modal-close" data-action="close-modal" aria-label="Close dialog"><i data-lucide="x"></i></button>
      <h2 class="modal-title" id="${id}Title">${esc(title)}</h2>
      ${bodyHtml}
    </div>`;
  renderIcons();
  return overlay;
}

/** Accessible replacement for window.confirm. Resolves to true or false. */
function confirmDialog({ title, message, confirmLabel = 'Confirm', danger = true }) {
  return new Promise((resolve) => {
    const overlay = buildModal('confirmModal', title, `
      <p class="muted">${esc(message)}</p>
      <div class="modal-actions">
        <button type="button" class="btn btn-secondary" id="confirmCancel" data-autofocus>Cancel</button>
        <button type="button" class="btn ${danger ? 'btn-danger' : 'btn-primary'}" id="confirmOk">${esc(confirmLabel)}</button>
      </div>`, 'narrow');
    overlay.setAttribute('role', 'presentation');
    $('.modal-box', overlay).setAttribute('role', 'alertdialog');
    let result = false;
    $('#confirmOk', overlay).addEventListener('click', () => { result = true; closeModal('confirmModal'); });
    $('#confirmCancel', overlay).addEventListener('click', () => closeModal('confirmModal'));
    overlay.addEventListener('modal:closed', () => resolve(result), { once: true });
    openModal('confirmModal');
  });
}

/* ---- Form validation ---- */

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const isValidEmail = (value) => EMAIL_PATTERN.test(String(value || '').trim());

function setFieldError(input, message) {
  const group = input.closest('.form-group') || input.parentElement;
  const errorId = `${input.id}-error`;
  let error = document.getElementById(errorId);
  if (!error) {
    error = document.createElement('p');
    error.id = errorId;
    error.className = 'field-error';
    group.appendChild(error);
  }
  error.textContent = message;
  input.setAttribute('aria-invalid', 'true');
  const described = (input.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean);
  if (!described.includes(errorId)) described.push(errorId);
  input.setAttribute('aria-describedby', described.join(' '));
}

function clearFieldError(input) {
  const errorId = `${input.id}-error`;
  const error = document.getElementById(errorId);
  if (error) error.remove();
  input.removeAttribute('aria-invalid');
  const described = (input.getAttribute('aria-describedby') || '').split(/\s+/).filter((id) => id && id !== errorId);
  if (described.length) input.setAttribute('aria-describedby', described.join(' '));
  else input.removeAttribute('aria-describedby');
}

function clearFormErrors(form) {
  $$('[aria-invalid="true"]', form).forEach(clearFieldError);
  clearFormAlert(form);
}

/** Applies an {inputId: message} map. Returns true if there were no errors. */
function applyFormErrors(form, errors) {
  clearFormErrors(form);
  const ids = Object.keys(errors);
  ids.forEach((id) => setFieldError(document.getElementById(id), errors[id]));
  if (ids.length) document.getElementById(ids[0]).focus();
  return ids.length === 0;
}

function showFormAlert(form, message, type = 'error') {
  let alert = $('.form-alert', form);
  if (!alert) {
    alert = document.createElement('div');
    form.prepend(alert);
  }
  alert.className = `form-alert ${type}`;
  alert.setAttribute('role', type === 'error' ? 'alert' : 'status');
  alert.textContent = message;
}

function clearFormAlert(form) {
  const alert = $('.form-alert', form);
  if (alert) alert.remove();
}

// An error clears as soon as the user starts correcting that field.
document.addEventListener('input', (event) => {
  if (event.target.getAttribute && event.target.getAttribute('aria-invalid') === 'true') clearFieldError(event.target);
});

/* ==========================================================================
   5. AUTH
   Client-side only: this demonstrates the flow, but it isn't real security.
   A production system would need server-side accounts and sessions.
   ========================================================================== */

const REMEMBER_DAYS = 30;
const SESSION_TOKEN_KEY = 'ecorecycle_session_token';

const normaliseEmail = (email) => String(email || '').trim().toLowerCase();

function initialsOf(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

function randomHex(byteCount) {
  const bytes = crypto.getRandomValues(new Uint8Array(byteCount));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** SHA-256 of "salt:password", as hex. Web Crypto needs HTTPS or localhost. */
async function hashPassword(salt, password) {
  if (!window.crypto || !crypto.subtle) throw new Error('insecure-context');
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${salt}:${password}`));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Returns the list of unmet password rules (empty when the password is acceptable). */
function passwordProblems(password) {
  const problems = [];
  if (password.length < 8) problems.push('at least 8 characters');
  if (!/[A-Z]/.test(password)) problems.push('an uppercase letter');
  if (!/[a-z]/.test(password)) problems.push('a lowercase letter');
  if (!/[0-9]/.test(password)) problems.push('a number');
  if (!/[^A-Za-z0-9]/.test(password)) problems.push('a symbol');
  return problems;
}

/* ---- Sessions ----
   "Remember me" on:  the session lasts 30 days, across browser restarts.
   "Remember me" off: the session is tied to a token in sessionStorage, so it
   ends when this browser tab or window closes. */

function readSessionToken() {
  try {
    return sessionStorage.getItem(SESSION_TOKEN_KEY);
  } catch (error) {
    return null;
  }
}

function getSession() {
  const session = Store.read(KEYS.session, null);
  if (!isPlainObject(session) || typeof session.userId !== 'string') return null;
  if (session.remember) {
    if (Number(session.expiresAt) < Date.now()) {
      Store.remove(KEYS.session);
      return null;
    }
    return session;
  }
  return session.token && session.token === readSessionToken() ? session : null;
}

function currentUser() {
  const session = getSession();
  return session ? getUsers().find((user) => user.id === session.userId) || null : null;
}

function startSession(user, remember) {
  const token = randomHex(16);
  Store.write(KEYS.session, {
    userId: user.id,
    remember: Boolean(remember),
    token,
    createdAt: Date.now(),
    expiresAt: Date.now() + REMEMBER_DAYS * 24 * 60 * 60 * 1000,
  });
  try {
    sessionStorage.setItem(SESSION_TOKEN_KEY, token);
  } catch (error) {
    /* A non-remembered session then can't survive a reload; login still succeeds. */
  }
  moveGuestHubsTo(user);
}

function endSession() {
  Store.remove(KEYS.session);
  try {
    sessionStorage.removeItem(SESSION_TOKEN_KEY);
  } catch (error) {
    /* Nothing further to clear. */
  }
}

/** Hubs saved before signing in move onto the resident's account. */
function moveGuestHubsTo(user) {
  if (user.role !== 'resident') return;
  const guestIds = getSavedHubIds(GUEST_KEY);
  if (!guestIds.length) return;
  saveSavedHubIds(user.id, Array.from(new Set([...getSavedHubIds(user.id), ...guestIds])));
  saveSavedHubIds(GUEST_KEY, []);
}

async function authenticate(email, password) {
  const user = getUsers().find((candidate) => normaliseEmail(candidate.email) === normaliseEmail(email));
  // Hash even when the email is unknown, so both failures behave the same way.
  const hash = await hashPassword(user ? user.salt : '0'.repeat(32), password);
  return user && hash === user.passwordHash ? user : null;
}

async function createResidentAccount({ name, email, password }) {
  const salt = randomHex(16);
  const user = {
    id: `user-${randomHex(8)}`,
    name,
    email: normaliseEmail(email),
    role: 'resident',
    roleTitle: 'Resident • Suburb Zone 4',
    salt,
    passwordHash: await hashPassword(salt, password),
    address: '',
    accountId: `ECO-${String(10000 + Math.floor(Math.random() * 89999))}`,
    createdAt: toISODate(),
    demo: false,
    baseline: { items: 0, diverted: 0, kg: 0 },
  };
  saveUsers([...getUsers(), user]);
  return user;
}

ACTIONS.logout = () => {
  endSession();
  flashToast('You have been logged out.', 'info');
  window.location.href = sitePath('index.html');
};

/* ---- Login page ---- */

function selectAuthTab(tabName, moveFocus = false) {
  $$('.auth-tab').forEach((tab) => {
    const selected = tab.dataset.tab === tabName;
    tab.setAttribute('aria-selected', String(selected));
    tab.tabIndex = selected ? 0 : -1;
    if (selected && moveFocus) tab.focus();
  });
  $$('[data-tab-panel]').forEach((panel) => {
    panel.hidden = panel.dataset.tabPanel !== tabName;
  });
}

ACTIONS['auth-tab'] = (trigger) => selectAuthTab(trigger.dataset.tab);

ACTIONS['toggle-password'] = (trigger) => {
  const input = document.getElementById(trigger.dataset.target);
  if (!input) return;
  const show = input.type === 'password';
  input.type = show ? 'text' : 'password';
  trigger.setAttribute('aria-pressed', String(show));
  trigger.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
  trigger.innerHTML = `<i data-lucide="${show ? 'eye-off' : 'eye'}"></i>`;
  renderIcons();
};

ACTIONS['use-demo'] = (trigger) => {
  selectAuthTab('login');
  clearFormErrors($('#loginForm'));
  $('#loginEmail').value = trigger.dataset.email;
  $('#loginPassword').value = trigger.dataset.password;
  $('#loginForm button[type="submit"]').focus();
  showToast('Demo details filled in. Press Sign In to continue.', 'info');
};

function authFailureMessage(error) {
  return error && error.message === 'insecure-context'
    ? 'Secure sign-in needs HTTPS or localhost. Please open the site from one of those addresses.'
    : 'Sign-in is unavailable right now. Please try again.';
}

function initAuthPage() {
  const loginForm = document.getElementById('loginForm');
  if (!loginForm) return;

  if (currentUser()) {
    window.location.replace(sitePath('pages/dashboard.html'));
    return;
  }

  // Tabs: click is handled by ACTIONS, the arrow keys follow the ARIA tabs pattern.
  $('.auth-tabs').addEventListener('keydown', (event) => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    event.preventDefault();
    const next = event.target.dataset.tab === 'login' ? 'register' : 'login';
    selectAuthTab(next, true);
  });
  const syncTabToHash = () => selectAuthTab(window.location.hash === '#register' ? 'register' : 'login');
  window.addEventListener('hashchange', syncTabToHash);
  syncTabToHash();

  const remembered = Store.read(KEYS.rememberedEmail, '');
  if (typeof remembered === 'string' && remembered) {
    $('#loginEmail').value = remembered;
    $('#rememberMe').checked = true;
  }

  loginForm.addEventListener('submit', handleLoginSubmit);
  $('#registerForm').addEventListener('submit', handleRegisterSubmit);
}

async function handleLoginSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const emailInput = $('#loginEmail');
  const passwordInput = $('#loginPassword');
  const errors = {};
  if (!emailInput.value.trim()) errors.loginEmail = 'Enter your email address.';
  else if (!isValidEmail(emailInput.value)) errors.loginEmail = 'Enter a valid email address, for example name@example.com.';
  if (!passwordInput.value) errors.loginPassword = 'Enter your password.';
  if (!applyFormErrors(form, errors)) return;

  const submit = $('button[type="submit"]', form);
  submit.disabled = true;
  try {
    const user = await authenticate(emailInput.value, passwordInput.value);
    if (!user) {
      showFormAlert(form, 'Incorrect email or password. Please check your details and try again.');
      passwordInput.value = '';
      passwordInput.focus();
      return;
    }
    const remember = $('#rememberMe').checked;
    if (remember) Store.write(KEYS.rememberedEmail, normaliseEmail(emailInput.value));
    else Store.remove(KEYS.rememberedEmail);
    startSession(user, remember);
    flashToast(`Welcome back, ${user.name}.`);
    window.location.href = sitePath('pages/dashboard.html');
  } catch (error) {
    showFormAlert(form, authFailureMessage(error));
  } finally {
    submit.disabled = false;
  }
}

async function handleRegisterSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const name = $('#regName').value.trim();
  const email = $('#regEmail').value.trim();
  const password = $('#regPass').value;
  const confirm = $('#regConfirmPass').value;

  const errors = {};
  if (name.length < 2) errors.regName = 'Enter your full name.';
  if (!email) errors.regEmail = 'Enter your email address.';
  else if (!isValidEmail(email)) errors.regEmail = 'Enter a valid email address, for example name@example.com.';
  else if (getUsers().some((user) => normaliseEmail(user.email) === normaliseEmail(email))) {
    errors.regEmail = 'An account with this email already exists. Try logging in instead.';
  }
  const problems = passwordProblems(password);
  if (problems.length) errors.regPass = `Password needs ${problems.join(', ').replace(/, ([^,]*)$/, ' and $1')}.`;
  if (!confirm) errors.regConfirmPass = 'Confirm your password.';
  else if (confirm !== password) errors.regConfirmPass = 'Passwords do not match.';
  if (!applyFormErrors(form, errors)) return;

  const submit = $('button[type="submit"]', form);
  submit.disabled = true;
  try {
    const user = await createResidentAccount({ name, email, password });
    startSession(user, false);
    flashToast(`Account created. Welcome, ${user.name}!`);
    window.location.href = sitePath('pages/dashboard.html');
  } catch (error) {
    showFormAlert(form, authFailureMessage(error));
  } finally {
    submit.disabled = false;
  }
}

/* ==========================================================================
   6. NAVIGATION
   ========================================================================== */

function initMobileMenu() {
  const toggle = document.getElementById('mobileMenuToggle');
  const menu = document.getElementById('navCollapse');
  if (!toggle || !menu) return;

  const setOpen = (open) => {
    menu.classList.toggle('mobile-active', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Close navigation menu' : 'Open navigation menu');
  };

  toggle.addEventListener('click', () => setOpen(!menu.classList.contains('mobile-active')));
  menu.addEventListener('click', (event) => {
    if (event.target.closest('a')) setOpen(false);
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && menu.classList.contains('mobile-active')) {
      setOpen(false);
      toggle.focus();
    }
  });
}

/** Moves focus directly, so the link also works on the 404 page, which uses a <base> tag. */
function initSkipLink() {
  const link = $('.skip-link');
  const main = document.getElementById('main');
  if (!link || !main) return;
  link.addEventListener('click', (event) => {
    event.preventDefault();
    main.focus();
    main.scrollIntoView();
  });
}

/** Swaps the Login button for the dashboard and logout controls when signed in. */
function renderNavActions() {
  const container = document.getElementById('navActions');
  const user = currentUser();
  if (!container || !user) return;
  container.innerHTML = `
    <a href="${esc(sitePath('pages/dashboard.html'))}" class="btn btn-secondary btn-sm nav-user" aria-label="My dashboard, signed in as ${esc(user.name)}">
      <i data-lucide="${user.role === 'admin' ? 'shield-check' : 'user'}"></i><span>${esc(user.name)}</span>
    </a>
    <button type="button" class="btn btn-dark btn-sm" data-action="logout"><i data-lucide="log-out"></i> Logout</button>`;
}

/* ==========================================================================
   7. SCHEDULE
   Suburb Zone 4: yellow and green bins every Tuesday, red bin on alternate
   Tuesdays. Dates are worked out from today, so the calendar never goes stale.
   ========================================================================== */

const COLLECTION_WEEKDAY = 2; // Tuesday
const RED_BIN_ANCHOR = new Date(2026, 0, 6); // a Tuesday with a red bin collection

const BIN_INFO = {
  yellow: { label: 'Yellow Recycling', dot: 'dot-yellow' },
  green: { label: 'Green Organics (FOGO)', dot: 'dot-green' },
  red: { label: 'Red General Waste', dot: 'dot-red' },
};

function binsOn(date) {
  if (date.getDay() !== COLLECTION_WEEKDAY) return [];
  const weeks = Math.round((date - RED_BIN_ANCHOR) / (7 * 24 * 60 * 60 * 1000));
  return weeks % 2 === 0 ? ['yellow', 'green', 'red'] : ['yellow', 'green'];
}

/** Next collection day. Today counts until noon, when trucks have finished. */
function nextCollectionDate(from = new Date()) {
  const date = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  let days = (COLLECTION_WEEKDAY - date.getDay() + 7) % 7;
  if (days === 0 && from.getHours() >= 12) days = 7;
  date.setDate(date.getDate() + days);
  return date;
}

function upcomingCollections(count) {
  const first = nextCollectionDate();
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(first.getFullYear(), first.getMonth(), first.getDate() + index * 7);
    return { date, bins: binsOn(date) };
  });
}

function nextDateForBin(bin) {
  return upcomingCollections(4).find((collection) => collection.bins.includes(bin)).date;
}

const LONG_DATE = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
const SHORT_DATE = { weekday: 'short', day: 'numeric', month: 'short' };
const formatDateObj = (date, options) => date.toLocaleDateString('en-AU', options);

function collectionRelativeLabel(date) {
  const today = new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());
  const days = Math.round((date - today) / (24 * 60 * 60 * 1000));
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  return `In ${days} days`;
}

function binDots(bins) {
  return bins.map((bin) => `<span class="dot ${BIN_INFO[bin].dot}" aria-hidden="true"></span>`).join('');
}

function binNames(bins) {
  return bins.map((bin) => `<span><span class="dot ${BIN_INFO[bin].dot}" aria-hidden="true"></span>${esc(BIN_INFO[bin].label)}</span>`).join('');
}

/* ---- Reminders ---- */

const reminderOwner = () => {
  const user = currentUser();
  return user ? user.id : GUEST_KEY;
};

function reminderButtonHtml(iso) {
  const active = getReminders(reminderOwner()).includes(iso);
  return `<button type="button" class="btn btn-sm ${active ? 'btn-secondary' : 'btn-primary'}" data-action="toggle-reminder" data-date="${iso}" aria-pressed="${active}">
    <i data-lucide="${active ? 'bell-ring' : 'bell'}"></i> ${active ? 'Reminder Set' : 'Set Reminder'}
  </button>`;
}

ACTIONS['toggle-reminder'] = (trigger) => {
  const iso = trigger.dataset.date;
  const owner = reminderOwner();
  const reminders = getReminders(owner);
  const active = reminders.includes(iso);
  saveReminders(owner, active ? reminders.filter((date) => date !== iso) : [...reminders, iso]);
  const label = formatDate(iso, SHORT_DATE);
  showToast(active
    ? `Reminder for ${label} removed.`
    : `Reminder saved for ${label}. This prototype stores it in your browser and does not send messages.`, active ? 'info' : 'success');
  renderCollectionWidgets();
};

/* ---- Widgets ---- */

function collectionBoxHtml() {
  const date = nextCollectionDate();
  const bins = binsOn(date);
  return `
    <div class="upcoming-collection-box">
      <div>
        <div class="collection-info-title">Next Collection • ${esc(collectionRelativeLabel(date))}</div>
        <div class="collection-info-type">${binNames(bins)}</div>
        <div class="collection-info-time">${esc(formatDateObj(date, LONG_DATE))} • Bins out by 7:00 AM</div>
      </div>
      ${reminderButtonHtml(toISODate(date))}
    </div>`;
}

function monthGridHtml() {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const title = today.toLocaleDateString('en-AU', { month: 'long', year: 'numeric' });
  const firstOffset = (new Date(year, month, 1).getDay() + 6) % 7; // weeks start on Monday
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstOffset; i += 1) cells.push('<td></td>');
  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(year, month, day);
    const bins = binsOn(date);
    const classes = [bins.length ? 'is-collection' : '', day === today.getDate() ? 'is-today' : ''].filter(Boolean).join(' ');
    const hidden = bins.length ? `<span class="sr-only">: ${bins.map((bin) => BIN_INFO[bin].label).join(', ')}</span>` : '';
    cells.push(`<td${classes ? ` class="${classes}"` : ''}>${day}${hidden}${bins.length ? `<div class="cal-dots">${binDots(bins)}</div>` : ''}</td>`);
  }
  while (cells.length % 7) cells.push('<td></td>');
  const rows = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(`<tr>${cells.slice(i, i + 7).join('')}</tr>`);
  return {
    title,
    html: `
      <table class="cal-grid">
        <caption class="sr-only">Bin collection days for ${esc(title)}, Suburb Zone 4</caption>
        <thead><tr>${['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => `<th scope="col">${d}</th>`).join('')}</tr></thead>
        <tbody>${rows.join('')}</tbody>
      </table>`,
  };
}

/** Fills every collection widget on the page (home page and dashboard). */
function renderCollectionWidgets() {
  $$('[data-collection-calendar]').forEach((container) => {
    const grid = monthGridHtml();
    container.innerHTML = `
      <div class="calendar-header">
        <h3 class="calendar-month-title"><i data-lucide="calendar"></i> ${esc(grid.title)}</h3>
        <span class="badge badge-recyclable">Suburb Zone 4</span>
      </div>
      <div class="calendar-legend">
        ${Object.keys(BIN_INFO).map((bin) => `<div class="legend-item"><span class="dot ${BIN_INFO[bin].dot}" aria-hidden="true"></span> ${esc(BIN_INFO[bin].label)}</div>`).join('')}
      </div>
      ${grid.html}
      ${collectionBoxHtml()}`;
  });
  $$('[data-next-collection]').forEach((container) => {
    container.innerHTML = collectionBoxHtml();
  });
  $$('[data-upcoming-collections]').forEach((container) => {
    container.innerHTML = upcomingCollections(4).map(({ date, bins }) => `
      <div class="upcoming-row">
        <span>${esc(formatDateObj(date, SHORT_DATE))}</span>
        <span class="upcoming-bins">${binNames(bins)}</span>
      </div>`).join('');
  });
  $$('[data-next-bin]').forEach((container) => {
    container.textContent = formatDateObj(nextDateForBin(container.dataset.nextBin), LONG_DATE);
  });
  renderIcons();
}

/* ==========================================================================
   8. SEARCH
   ========================================================================== */

/* ---- Matching ---- */

function stemWord(word) {
  if (word.length > 4 && word.endsWith('ies')) return `${word.slice(0, -3)}y`;
  if (/(ch|sh|x|ss)es$/.test(word)) return word.slice(0, -2);
  if (word.length > 3 && word.endsWith('s') && !word.endsWith('ss')) return word.slice(0, -1);
  return word;
}

function wordsOf(text) {
  return String(text || '').toLowerCase().replace(/-/g, '').split(/[^a-z0-9#]+/).filter(Boolean);
}

const STOP_WORDS = new Set(['a', 'an', 'and', 'the', 'of', 'for', 'in', 'my', 'old', 'used']);

function queryTokens(query) {
  return wordsOf(query).filter((word) => !STOP_WORDS.has(word)).map(stemWord);
}

/** A token matches a word when the word starts with it, so results appear while typing. */
const tokenMatches = (token, words) => words.some((word) => word.startsWith(token) || stemWord(word) === token);

/** Relevance score: 0 = no match. Every token must match somewhere in the rule. */
function scoreRule(rule, tokens) {
  const nameWords = wordsOf(rule.name);
  const otherWords = wordsOf(`${rule.keywords || ''} ${rule.category} ${rule.disposalMethod}`);
  let score = 0;
  for (const token of tokens) {
    if (tokenMatches(token, nameWords)) score += 10;
    else if (tokenMatches(token, otherWords)) score += 3;
    else return 0;
  }
  if (tokens.length && nameWords[0] && nameWords[0].startsWith(tokens[0])) score += 5;
  return score;
}

function searchRules(query, rules = getRules()) {
  const tokens = queryTokens(query);
  if (!tokens.length) return [];
  return rules
    .map((rule) => ({ rule, score: scoreRule(rule, tokens) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.rule.name.localeCompare(b.rule.name))
    .map((entry) => entry.rule);
}

/* ---- Shared markup ---- */

function statusBadge(status) {
  const info = RULE_STATUS[status] || RULE_STATUS['not-recyclable'];
  return `<span class="badge ${info.badge}"><i data-lucide="${info.icon}"></i> ${esc(info.label)}</span>`;
}

function itemCardHtml(rule, { open = false, canLog = false } = {}) {
  const steps = rule.instructions.map((step) => `<li>${esc(step)}</li>`).join('');
  return `
    <article class="item-card" data-rule-id="${esc(rule.id)}">
      <div class="item-card-head">
        <h3>${esc(rule.name)}</h3>
        ${statusBadge(rule.status)}
      </div>
      <dl class="item-meta">
        <div><dt>Category:</dt><dd>${esc(rule.category)}</dd></div>
        <div><dt>Where it goes:</dt><dd>${esc(rule.disposalMethod)}</dd></div>
      </dl>
      <details class="item-steps"${open ? ' open' : ''}>
        <summary>Preparation steps (${rule.instructions.length})</summary>
        <ol class="steps-list">${steps}</ol>
      </details>
      <div class="item-foot">
        <span class="verify-note"><i data-lucide="shield-check"></i> ${esc(rule.adminNote)} • ${esc(formatDate(rule.updatedDate))}</span>
        ${canLog ? `<button type="button" class="btn btn-sm btn-secondary" data-action="log-rule" data-id="${esc(rule.id)}"><i data-lucide="bookmark"></i> Log this item</button>` : ''}
      </div>
    </article>`;
}

/* ---- Combobox suggestions, on the home page and the search page ---- */

function initSuggestions(input, list, onPick) {
  let options = [];
  let activeIndex = -1;

  const close = () => {
    list.hidden = true;
    list.innerHTML = '';
    options = [];
    activeIndex = -1;
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
  };

  const setActive = (index) => {
    activeIndex = index;
    $$('.suggestion', list).forEach((el, i) => {
      el.classList.toggle('is-active', i === index);
      el.setAttribute('aria-selected', String(i === index));
      if (i === index) {
        input.setAttribute('aria-activedescendant', el.id);
        el.scrollIntoView({ block: 'nearest' });
      }
    });
  };

  const update = () => {
    options = searchRules(input.value).slice(0, 6);
    if (!options.length || !input.value.trim()) {
      close();
      return;
    }
    list.innerHTML = options.map((rule, i) => `
      <li class="suggestion" id="suggestion-${i}" role="option" aria-selected="false" data-index="${i}">
        <span class="suggestion-name">${esc(rule.name)}</span>
        ${statusBadge(rule.status)}
      </li>`).join('');
    list.hidden = false;
    input.setAttribute('aria-expanded', 'true');
    activeIndex = -1;
    input.removeAttribute('aria-activedescendant');
    renderIcons();
  };

  input.addEventListener('input', update);
  input.addEventListener('blur', () => setTimeout(close, 120));
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      // With the list open, Esc only dismisses it. Otherwise Chrome would also clear the box.
      if (!list.hidden) {
        event.preventDefault();
        event.stopPropagation();
      }
      close();
    } else if (event.key === 'ArrowDown' && options.length) {
      event.preventDefault();
      setActive((activeIndex + 1) % options.length);
    } else if (event.key === 'ArrowUp' && options.length) {
      event.preventDefault();
      setActive((activeIndex - 1 + options.length) % options.length);
    } else if (event.key === 'Enter' && activeIndex >= 0) {
      event.preventDefault();
      const rule = options[activeIndex];
      close();
      onPick(rule);
    }
  });
  // Mousedown keeps focus in the input until the pick has been handled.
  list.addEventListener('mousedown', (event) => {
    const el = event.target.closest('.suggestion');
    if (!el) return;
    event.preventDefault();
    const rule = options[Number(el.dataset.index)];
    close();
    if (rule) onPick(rule);
  });
  return { close };
}

/** Home page: the form submits to pages/waste-search.html?q=... (it works without JS too). */
function initQuickSearch() {
  const form = document.getElementById('quickSearchForm');
  if (!form) return;
  initSuggestions($('#wasteSearchInput', form), $('#searchSuggestions', form), (rule) => {
    window.location.href = `${sitePath('pages/waste-search.html')}?q=${encodeURIComponent(rule.name)}`;
  });
}

/** Home page counters come from the live rule list, so they can never be out of date. */
function initHomeStats() {
  const rules = getRules();
  $$('[data-rule-count]').forEach((el) => {
    el.textContent = rules.length;
  });
  $$('[data-category-count]').forEach((el) => {
    el.textContent = rules.filter((rule) => rule.category === el.dataset.categoryCount).length;
  });
}

/* ---- Waste Search page ---- */

const searchState = { query: '', category: 'all' };

function syncSearchUrl() {
  const params = new URLSearchParams();
  if (searchState.query) params.set('q', searchState.query);
  if (searchState.category !== 'all') params.set('category', searchState.category);
  const qs = params.toString();
  window.history.replaceState(null, '', qs ? `?${qs}` : window.location.pathname);
}

function renderSearchResults() {
  const grid = document.getElementById('catalogueGrid');
  if (!grid) return;

  const rules = getRules();
  const hasQuery = queryTokens(searchState.query).length > 0;
  const matches = hasQuery
    ? searchRules(searchState.query, rules)
    : [...rules].sort((a, b) => a.name.localeCompare(b.name));
  const visible = searchState.category === 'all' ? matches : matches.filter((rule) => rule.category === searchState.category);

  const user = currentUser();
  const canLog = Boolean(user && user.role === 'resident');
  grid.innerHTML = visible.map((rule) => itemCardHtml(rule, { open: hasQuery && visible.length <= 3, canLog })).join('');
  grid.hidden = visible.length === 0;

  const noneAtAll = hasQuery && matches.length === 0;
  const onlyFilteredOut = visible.length === 0 && !noneAtAll;

  const noResults = document.getElementById('noResultsPanel');
  noResults.hidden = !noneAtAll;
  document.getElementById('filterEmptyPanel').hidden = !onlyFilteredOut;
  if (onlyFilteredOut) {
    $('#filterEmptyText').textContent = hasQuery
      ? `No ${searchState.category} items match "${searchState.query.trim()}", but ${matches.length} ${matches.length === 1 ? 'item matches' : 'items match'} in other categories.`
      : `There are no ${searchState.category} items published at the moment.`;
  }

  // One request form: it sits in the no-results panel when needed, otherwise in the banner.
  const form = document.getElementById('requestForm');
  const nameInput = $('#reqName');
  if (noneAtAll) {
    $('#noResultsTitle').textContent = `We couldn't find "${searchState.query.trim()}" yet`;
    $('#noResultsFormSlot').appendChild(form);
    if (nameInput.dataset.touched !== 'true') nameInput.value = searchState.query.trim();
  } else {
    $('#bannerFormSlot').appendChild(form);
    if (nameInput.dataset.touched !== 'true') nameInput.value = '';
  }
  document.getElementById('requestSection').hidden = noneAtAll;

  const noun = visible.length === 1 ? 'item' : 'items';
  const where = searchState.category === 'all' ? '' : ` in ${searchState.category}`;
  $('#searchSummary').textContent = noneAtAll
    ? `No results for "${searchState.query.trim()}".`
    : hasQuery
      ? `${visible.length} ${noun} matching "${searchState.query.trim()}"${where}.`
      : `Showing ${visible.length} ${noun}${where}.`;

  $$('[data-action="filter-category"]').forEach((chip) => {
    chip.setAttribute('aria-pressed', String(chip.dataset.category === searchState.category));
  });
  $$('[data-action="popular-search"]').forEach((chip) => {
    chip.setAttribute('aria-pressed', String(chip.dataset.search === searchState.query.trim().toLowerCase()));
  });

  renderIcons();
}

function runSearch({ scroll = false } = {}) {
  syncSearchUrl();
  renderSearchResults();
  if (scroll) document.getElementById('resultsHeading').scrollIntoView({ block: 'start' });
}

ACTIONS['filter-category'] = (trigger) => {
  searchState.category = trigger.dataset.category;
  runSearch();
};

ACTIONS['popular-search'] = (trigger) => {
  searchState.query = trigger.dataset.search;
  $('#wasteSearchInput').value = trigger.dataset.search;
  runSearch({ scroll: true });
};

ACTIONS['clear-search'] = () => {
  searchState.query = '';
  searchState.category = 'all';
  const input = $('#wasteSearchInput');
  input.value = '';
  runSearch();
  input.focus();
};

ACTIONS['show-all-categories'] = () => {
  searchState.category = 'all';
  runSearch();
};

ACTIONS['log-rule'] = (trigger) => {
  const user = currentUser();
  const rule = getRules().find((candidate) => candidate.id === trigger.dataset.id);
  if (!user || user.role !== 'resident' || !rule) return;
  addActivityEntry(user.id, {
    item: rule.name,
    category: rule.category,
    disposal: rule.disposalMethod,
    kg: 0.2,
    status: RULE_STATUS[rule.status].logStatus,
  });
  showToast(`"${rule.name}" added to your recycling log.`);
};

/** Adds a row to a resident's history log (newest first). */
function addActivityEntry(userId, entry) {
  const row = { id: `log-${Date.now()}`, date: toISODate(), ...entry };
  saveActivity(userId, [row, ...getActivity(userId)]);
  return row;
}

function initWasteSearchPage() {
  if (!document.getElementById('catalogueGrid')) return;

  const params = new URLSearchParams(window.location.search);
  const input = $('#wasteSearchInput');
  searchState.query = (params.get('q') || '').slice(0, 100);
  const category = params.get('category');
  searchState.category = CATEGORIES.includes(category) ? category : 'all';
  input.value = searchState.query;

  let timer;
  input.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      searchState.query = input.value;
      runSearch();
    }, 100);
  });

  initSuggestions(input, $('#searchSuggestions'), (rule) => {
    input.value = rule.name;
    searchState.query = rule.name;
    runSearch({ scroll: true });
  });

  $('#wasteSearchForm').addEventListener('submit', (event) => {
    event.preventDefault();
    clearTimeout(timer);
    searchState.query = input.value;
    runSearch({ scroll: true });
  });

  const form = document.getElementById('requestForm');
  form.addEventListener('submit', handleRequestSubmit);
  $('#reqName').addEventListener('input', (event) => {
    event.target.dataset.touched = 'true';
  });

  const user = currentUser();
  if (user) $('#reqEmail').value = user.email;

  // An admin publishing in another tab shows up here without a refresh.
  window.addEventListener('storage', (event) => {
    if (event.key === KEYS.rules) renderSearchResults();
  });

  renderSearchResults();
}

function handleRequestSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const name = $('#reqName').value.trim();
  const category = $('#reqCategory').value;
  const email = $('#reqEmail').value.trim();
  const note = $('#reqNote').value.trim();
  const key = name.toLowerCase();

  const errors = {};
  if (name.length < 2) errors.reqName = 'Enter the name of the item (at least 2 characters).';
  else if (name.length > 80) errors.reqName = 'Keep the item name under 80 characters.';
  else if (getRules().some((rule) => rule.name.toLowerCase() === key)) errors.reqName = 'This item is already in the directory.';
  else if (getPending().some((request) => request.name.toLowerCase() === key)) errors.reqName = 'This item is already waiting for admin review.';
  if (!category) errors.reqCategory = 'Choose a category, or "Not sure".';
  if (email && !isValidEmail(email)) errors.reqEmail = 'Enter a valid email address, or leave this blank.';
  if (note.length > 300) errors.reqNote = 'Keep your note under 300 characters.';
  if (!applyFormErrors(form, errors)) return;

  savePending([{
    id: `req-${Date.now()}`,
    name,
    category: category === 'unknown' ? '' : category,
    status: '',
    disposalMethod: '',
    instructions: [],
    submittedBy: email || 'Guest resident',
    dateSubmitted: toISODate(),
    reason: note || 'Citizen requested guidance on an unlisted item.',
  }, ...getPending()]);

  form.reset();
  $('#reqName').dataset.touched = 'false';
  const user = currentUser();
  if (user) $('#reqEmail').value = user.email;
  $('#reqName').value = '';
  showFormAlert(form, `"${name}" has been sent to the Admin Queue for review.`, 'success');
  showToast(`Thanks! "${name}" was submitted to the Admin Queue.`);
}

/* ==========================================================================
   9. GUIDE
   ========================================================================== */

function selectResinCode(code) {
  const resin = RESIN_CODES.find((item) => item.code === code);
  if (!resin) return;
  $$('.resin-btn').forEach((btn) => {
    btn.setAttribute('aria-pressed', String(Number(btn.dataset.code) === code));
  });
  $('#resinPanel').innerHTML = `
    <div class="row-between mb-sm">
      <h3>#${resin.code} ${esc(resin.abbr)}: ${esc(resin.name)}</h3>
      ${statusBadge(resin.status)}
    </div>
    <dl>
      <div><dt>Common examples</dt><dd>${esc(resin.examples)}</dd></div>
      <div><dt>Kerbside recycling</dt><dd>${esc(resin.kerbside)}</dd></div>
      <div><dt>Environmental tip</dt><dd>${esc(resin.tip)}</dd></div>
    </dl>`;
  renderIcons();
}

ACTIONS['resin-select'] = (trigger) => selectResinCode(Number(trigger.dataset.code));

function initRecyclingGuide() {
  const nav = document.getElementById('guideNav');
  if (!nav) return;

  $('#resinButtons').innerHTML = RESIN_CODES.map((resin) => `
    <button type="button" class="resin-btn" data-action="resin-select" data-code="${resin.code}" aria-pressed="false" aria-label="Code ${resin.code}, ${esc(resin.abbr)}">
      <span class="resin-num">#${resin.code}</span>
      <span class="resin-abbr">${esc(resin.abbr)}</span>
    </button>`).join('');
  selectResinCode(1);

  // Highlight the category currently on screen.
  const chips = $$('a', nav);
  const setCurrent = (id) => {
    chips.forEach((chip) => {
      if (chip.getAttribute('href') === `#${id}`) {
        chip.setAttribute('aria-current', 'true');
        if (nav.scrollWidth > nav.clientWidth) nav.scrollLeft = chip.offsetLeft - nav.offsetLeft - 16;
      } else {
        chip.removeAttribute('aria-current');
      }
    });
  };
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      entries.filter((entry) => entry.isIntersecting).forEach((entry) => setCurrent(entry.target.id));
    }, { rootMargin: '-30% 0px -60% 0px' });
    $$('.guide-section').forEach((section) => observer.observe(section));
  }
  if (window.location.hash) setCurrent(window.location.hash.slice(1));
  nav.addEventListener('click', (event) => {
    const chip = event.target.closest('a');
    if (chip) setCurrent(chip.getAttribute('href').slice(1));
  });
}

/* ==========================================================================
   10. LOCATIONS
   ========================================================================== */

let hubReference = { ...DEFAULT_REFERENCE };

function haversineKm(a, b) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

const hubDistanceKm = (hub) => haversineKm(hubReference, hub);
const formatKm = (km) => `${km < 10 ? km.toFixed(1) : Math.round(km)} km`;
const hubAddress = (hub) => `${hub.street}, ${hub.suburb} ${hub.state} ${hub.postcode}`;
const findHub = (id) => HUBS.find((hub) => hub.id === id);

function matchingHubs(query, type) {
  const tokens = String(query || '').toLowerCase().split(/[\s,]+/).filter(Boolean);
  return HUBS
    .filter((hub) => {
      const text = `${hub.name} ${hub.street} ${hub.suburb} ${hub.state} ${hub.postcode}`.toLowerCase();
      return tokens.every((token) => text.includes(token)) && (type === 'All' || !type || hub.types.includes(type));
    })
    .sort((a, b) => hubDistanceKm(a) - hubDistanceKm(b));
}

/* ---- Saved hubs ---- */

/** Whose list a save goes to: the resident, the guest list, or null for admins. */
function savedHubOwner() {
  const user = currentUser();
  if (!user) return GUEST_KEY;
  return user.role === 'resident' ? user.id : null;
}

function isHubSaved(hubId) {
  const owner = savedHubOwner();
  return owner ? getSavedHubIds(owner).includes(hubId) : false;
}

ACTIONS['hub-save'] = (trigger) => {
  const hub = findHub(trigger.dataset.id);
  const owner = savedHubOwner();
  if (!hub) return;
  if (!owner) {
    showToast('Saved hubs are a resident feature. Administrator accounts do not have a saved list.', 'info');
    return;
  }
  const ids = getSavedHubIds(owner);
  const saved = ids.includes(hub.id);
  saveSavedHubIds(owner, saved ? ids.filter((id) => id !== hub.id) : [...ids, hub.id]);
  if (saved) showToast(`Removed ${hub.name} from your saved hubs.`, 'info');
  else if (owner === GUEST_KEY) showToast(`Saved ${hub.name}. Sign in as a resident to see it on your dashboard.`);
  else showToast(`Saved ${hub.name} to your dashboard.`);
  document.dispatchEvent(new CustomEvent('hubs:changed'));
};

/* ---- Directions modal ---- */

ACTIONS['hub-directions'] = (trigger) => {
  const hub = findHub(trigger.dataset.id);
  if (!hub) return;
  const destination = `${hub.lat},${hub.lng}`;
  const google = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`;
  const osm = `https://www.openstreetmap.org/directions?to=${encodeURIComponent(destination)}`;
  buildModal('directionsModal', `Directions to ${hub.name}`, `
    <dl class="directions-list">
      <div><dt class="form-label">Address</dt><dd>${esc(hubAddress(hub))}</dd></div>
      <div><dt class="form-label">Opening hours</dt><dd>${esc(hub.hours)}</dd></div>
      <div><dt class="form-label">Phone</dt><dd>${esc(hub.phone)}</dd></div>
      <div><dt class="form-label">Distance</dt><dd>${esc(formatKm(hubDistanceKm(hub)))} in a straight line from ${esc(hubReference.label)}</dd></div>
    </dl>
    <div class="row-wrap">
      <a class="btn btn-primary" href="${esc(google)}" target="_blank" rel="noopener noreferrer"><i data-lucide="navigation"></i> Open in Google Maps<span class="sr-only"> (opens in a new tab)</span></a>
      <a class="btn btn-secondary" href="${esc(osm)}" target="_blank" rel="noopener noreferrer"><i data-lucide="map"></i> Open in OpenStreetMap<span class="sr-only"> (opens in a new tab)</span></a>
    </div>`);
  openModal('directionsModal');
};

/* ---- Hub cards, shared by the finder, home page and dashboard ---- */

function hubCardHtml(hub, { showMapButton = false, headingLevel = 3 } = {}) {
  const saved = isHubSaved(hub.id);
  const heading = `h${headingLevel}`;
  return `
    <article class="location-card" data-hub-id="${esc(hub.id)}">
      <div class="location-card-header">
        <${heading} class="location-name">${esc(hub.name)}</${heading}>
        <span class="location-distance">${esc(formatKm(hubDistanceKm(hub)))}</span>
      </div>
      <p class="location-meta"><i data-lucide="map-pin"></i> ${esc(hubAddress(hub))}</p>
      <p class="location-meta"><i data-lucide="clock"></i> ${esc(hub.hours)}</p>
      <p class="location-meta"><i data-lucide="phone"></i> ${esc(hub.phone)}</p>
      <div class="location-tags">${hub.types.map((type) => `<span class="location-tag">${esc(type)}</span>`).join('')}</div>
      <div class="location-actions">
        <button type="button" class="btn btn-sm btn-primary" data-action="hub-directions" data-id="${esc(hub.id)}"><i data-lucide="navigation"></i> View Directions</button>
        <button type="button" class="btn btn-sm btn-secondary" data-action="hub-save" data-id="${esc(hub.id)}" aria-pressed="${saved}">
          <i data-lucide="${saved ? 'check' : 'heart'}"></i> ${saved ? 'Saved' : 'Save Hub'}<span class="sr-only">: ${esc(hub.name)}</span>
        </button>
        ${showMapButton ? `<button type="button" class="btn btn-sm btn-secondary" data-action="hub-focus" data-id="${esc(hub.id)}"><i data-lucide="map-pin"></i> Show on Map<span class="sr-only">: ${esc(hub.name)}</span></button>` : ''}
      </div>
    </article>`;
}

/* ---- Leaflet map ---- */

const hubMapState = { map: null, layer: null, markers: {}, tilesLoaded: 0, tileErrors: 0 };

function setMapNotice(message) {
  const notice = document.getElementById('mapNotice');
  if (!notice) return;
  notice.textContent = message || '';
  notice.hidden = !message;
}

const MAP_TILES_FAILED = 'Map tiles could not load, so the background may be blank. The pins and the hub list still work.';

function initHubMap() {
  const element = document.getElementById('hubMap');
  if (!element) return;

  if (typeof window.L === 'undefined') {
    setMapNotice('The interactive map could not load. You can still use the hub list and View Directions.');
    return;
  }

  const map = window.L.map(element, { scrollWheelZoom: false });
  hubMapState.map = map;
  hubMapState.layer = window.L.layerGroup().addTo(map);

  const tiles = window.L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    referrerPolicy: 'strict-origin-when-cross-origin',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
  });
  tiles.on('tileload', () => {
    hubMapState.tilesLoaded += 1;
    setMapNotice('');
  });
  tiles.on('tileerror', () => {
    hubMapState.tileErrors += 1;
    if (!hubMapState.tilesLoaded && hubMapState.tileErrors >= 2) setMapNotice(MAP_TILES_FAILED);
  });
  tiles.addTo(map);
  setTimeout(() => {
    if (!hubMapState.tilesLoaded) setMapNotice(MAP_TILES_FAILED);
  }, 8000);

}

function hubPopupHtml(hub) {
  return `
    <div class="hub-popup">
      <h3>${esc(hub.name)}</h3>
      <p>${esc(hubAddress(hub))}</p>
      <p>${esc(hub.hours)}</p>
      <div class="location-actions">
        <button type="button" class="btn btn-sm btn-primary" data-action="hub-directions" data-id="${esc(hub.id)}">Directions</button>
        <button type="button" class="btn btn-sm btn-secondary" data-action="hub-save" data-id="${esc(hub.id)}" aria-pressed="${isHubSaved(hub.id)}">${isHubSaved(hub.id) ? 'Saved' : 'Save Hub'}</button>
      </div>
    </div>`;
}

function updateHubMarkers(hubs, { refit = true } = {}) {
  const { map, layer } = hubMapState;
  if (!map) return;

  layer.clearLayers();
  hubMapState.markers = {};
  hubs.forEach((hub) => {
    const marker = window.L.marker([hub.lat, hub.lng], {
      title: hub.name,
      alt: hub.name,
      riseOnHover: true,
      icon: window.L.divIcon({
        className: 'hub-pin-icon',
        html: `<span class="hub-pin${isHubSaved(hub.id) ? ' is-saved' : ''}"><span class="hub-pin-dot"></span></span>`,
        iconSize: [34, 34],
        iconAnchor: [17, 41],
        popupAnchor: [0, -38],
      }),
    });
    marker.bindPopup(() => hubPopupHtml(hub), { maxWidth: 280 });
    marker.addTo(layer);
    hubMapState.markers[hub.id] = marker;
  });

  if (!refit) return;
  if (!hubs.length) {
    map.setView([-28.5, 134], 4);
    return;
  }
  // Favour hubs near the reference point, so interstate pins don't zoom the map out to all of Australia.
  const nearby = hubs.filter((hub) => hubDistanceKm(hub) <= 150);
  const focus = nearby.length ? nearby : hubs;
  if (focus.length === 1) map.setView([focus[0].lat, focus[0].lng], 13);
  else map.fitBounds(focus.map((hub) => [hub.lat, hub.lng]), { padding: [50, 50], maxZoom: 13 });
}

ACTIONS['hub-focus'] = (trigger) => {
  const marker = hubMapState.markers[trigger.dataset.id];
  if (!marker) {
    showToast('The map is not available right now.', 'info');
    return;
  }
  const hub = findHub(trigger.dataset.id);
  hubMapState.map.setView([hub.lat, hub.lng], 14);
  marker.openPopup();
  document.querySelector('.map-shell').scrollIntoView({ block: 'nearest' });
};

/* ---- Hub finder page ---- */

function renderHubFinder({ refit = true } = {}) {
  const list = document.getElementById('locationListContainer');
  if (!list) return;

  const query = $('#locationSearchInput').value.trim();
  const type = $('#wasteTypeSelect').value;
  const hubs = matchingHubs(query, type);

  $('#hubCount').textContent = `${hubs.length === 1 ? '1 Drop-off Hub' : `${hubs.length} Drop-off Hubs`} Found`;
  $('#distanceNote').textContent = `Straight-line distances from ${hubReference.label}.`;

  list.innerHTML = hubs.length
    ? hubs.map((hub) => hubCardHtml(hub, { showMapButton: true })).join('')
    : `<div class="empty-state">
         <h3>No hubs match your search</h3>
         <p>No drop-off hubs match${query ? ` "${esc(query)}"` : ''}${type !== 'All' ? ` for ${esc(type)}` : ''}. Try a nearby suburb, or show every waste type.</p>
         <button type="button" class="btn btn-secondary btn-sm" data-action="hub-clear">Clear filters</button>
       </div>`;

  updateHubMarkers(hubs, { refit });
  renderIcons();

  const params = new URLSearchParams();
  if (query) params.set('q', query);
  if (type !== 'All') params.set('type', type);
  const qs = params.toString();
  window.history.replaceState(null, '', qs ? `?${qs}` : window.location.pathname);
}

ACTIONS['hub-clear'] = () => {
  $('#locationSearchInput').value = '';
  $('#wasteTypeSelect').value = 'All';
  renderHubFinder();
  $('#locationSearchInput').focus();
};

ACTIONS['hub-use-location'] = (trigger) => {
  if (!navigator.geolocation) {
    showToast('Your browser cannot share a location. Distances remain from Sydney CBD.', 'info');
    return;
  }
  trigger.disabled = true;
  navigator.geolocation.getCurrentPosition((position) => {
    trigger.disabled = false;
    hubReference = { lat: position.coords.latitude, lng: position.coords.longitude, label: 'your location' };
    renderHubFinder();
    showToast('Distances updated from your location.');
  }, () => {
    trigger.disabled = false;
    showToast('Location not available, so distances remain from Sydney CBD.', 'info');
  }, { timeout: 8000 });
};

function initHubFinder() {
  if (!document.getElementById('locationListContainer')) return;

  const params = new URLSearchParams(window.location.search);
  const input = $('#locationSearchInput');
  const select = $('#wasteTypeSelect');
  input.value = (params.get('q') || '').slice(0, 80);
  const type = params.get('type');
  if (type && Array.from(select.options).some((option) => option.value === type)) select.value = type;

  initHubMap();

  let timer;
  input.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(renderHubFinder, 150);
  });
  select.addEventListener('change', () => renderHubFinder());
  $('#hubFilterForm').addEventListener('submit', (event) => {
    event.preventDefault();
    clearTimeout(timer);
    renderHubFinder();
  });

  document.addEventListener('hubs:changed', () => {
    if (hubMapState.map) hubMapState.map.closePopup();
    renderHubFinder({ refit: false });
  });

  renderHubFinder();
}

/** Home page preview: the three nearest hubs. */
function renderHomeHubPreview() {
  const container = document.getElementById('homeHubPreview');
  if (!container) return;
  container.innerHTML = matchingHubs('', 'All').slice(0, 3).map((hub) => hubCardHtml(hub)).join('');
  renderIcons();
}

function initHomeHubPreview() {
  if (!document.getElementById('homeHubPreview')) return;
  renderHomeHubPreview();
  document.addEventListener('hubs:changed', renderHomeHubPreview);
}

/* ==========================================================================
   11. CONTACT
   ========================================================================== */

const MIN_MESSAGE_LENGTH = 20;

function initContactForm() {
  const form = document.getElementById('contactForm');
  if (!form) return;

  const user = currentUser();
  if (user) {
    $('#contactName').value = user.name;
    $('#contactEmail').value = user.email;
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const values = {
      name: $('#contactName').value.trim(),
      email: $('#contactEmail').value.trim(),
      phone: $('#contactPhone').value.trim(),
      suburb: $('#contactSuburb').value.trim(),
      state: $('#contactState').value,
      category: $('#contactCategory').value,
      message: $('#contactMessage').value.trim(),
    };

    const errors = {};
    if (values.name.length < 2) errors.contactName = 'Enter your full name.';
    if (!values.email) errors.contactEmail = 'Enter your email address.';
    else if (!isValidEmail(values.email)) errors.contactEmail = 'Enter a valid email address, for example name@example.com.';
    if (values.phone && !/^[0-9 ()+-]{8,16}$/.test(values.phone)) errors.contactPhone = 'Enter a valid phone number, or leave this blank.';
    if (!values.suburb) errors.contactSuburb = 'Enter your suburb or postcode.';
    if (!values.state) errors.contactState = 'Choose your state or territory.';
    if (!values.category) errors.contactCategory = 'Choose an inquiry category.';
    if (!values.message) errors.contactMessage = 'Enter your message.';
    else if (values.message.length < MIN_MESSAGE_LENGTH) {
      errors.contactMessage = `Your message needs at least ${MIN_MESSAGE_LENGTH} characters (${values.message.length} so far).`;
    }
    if (!applyFormErrors(form, errors)) return;

    const reference = `ENQ-${Date.now().toString().slice(-6)}`;
    saveEnquiries([{ reference, ...values, createdAt: new Date().toISOString() }, ...getEnquiries()]);

    form.hidden = true;
    const success = document.getElementById('contactSuccess');
    success.hidden = false;
    $('#contactReference').textContent = reference;
    $('#contactReply').textContent = values.email;
    success.focus();
    showToast('Thank you! Your message has been received.');
  });
}

ACTIONS['contact-again'] = () => {
  const form = document.getElementById('contactForm');
  form.reset();
  clearFormErrors(form);
  const user = currentUser();
  if (user) {
    $('#contactName').value = user.name;
    $('#contactEmail').value = user.email;
  }
  form.hidden = false;
  document.getElementById('contactSuccess').hidden = true;
  $('#contactName').focus();
};

/* ==========================================================================
   12. DASHBOARD
   ========================================================================== */

/* Tabs are addressed by URL hash, so a refresh stays on the same module. */
const DASHBOARD_TABS = {
  resident: ['overview', 'schedule', 'history', 'saved', 'notifications', 'settings'],
  admin: ['admin', 'admin-directory', 'admin-pending'],
};

function dashboardRole(user) {
  return user.role === 'admin' ? 'admin' : 'resident';
}

/* ---- Route guard and tab switching ---- */

function showAuthLock() {
  const overlay = document.getElementById('authLockOverlay');
  overlay.hidden = false;
  $$('body > header, body > main, body > footer, .skip-link').forEach((el) => {
    el.inert = true;
  });
  $('a', overlay).focus();
}

function showDashboardTab(requested) {
  const user = currentUser();
  if (!user) return;
  const role = dashboardRole(user);
  const allowed = DASHBOARD_TABS[role];
  let tab = requested;

  // Residents cannot open administrator modules, even by editing the URL.
  if (role === 'resident' && DASHBOARD_TABS.admin.includes(tab)) {
    showToast('Access denied: this module needs an administrator account.', 'error');
    tab = allowed[0];
    window.history.replaceState(null, '', `#${tab}`);
  }
  if (!allowed.includes(tab)) tab = allowed[0];

  $$('.dash-module').forEach((module) => {
    module.hidden = module.dataset.module !== tab;
  });
  $$('.sidebar-link').forEach((link) => {
    const active = link.dataset.tab === tab;
    link.classList.toggle('active', active);
    if (active) {
      link.setAttribute('aria-current', 'page');
      // On phones the sidebar is a scrolling strip, so keep the active tab in view.
      const strip = link.parentElement;
      if (strip.scrollWidth > strip.clientWidth) strip.scrollLeft = link.offsetLeft - strip.offsetLeft - 16;
    } else {
      link.removeAttribute('aria-current');
    }
  });
}

/* ---- Profile and shared rendering ---- */

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  return hour < 18 ? 'Good afternoon' : 'Good evening';
}

function renderDashboardProfile(user) {
  $$('.user-info-name').forEach((el) => { el.textContent = user.name; });
  $$('.user-info-role').forEach((el) => { el.textContent = user.roleTitle; });
  $('#sidebarAvatar').textContent = initialsOf(user.name);
  $('#welcomeSub').textContent = user.role === 'admin'
    ? `Welcome, ${user.name} • City Waste Operations Control Portal`
    : `${greeting()}, ${user.name} • Household waste and collection schedule`;
  renderNavActions();
}

/* ---- Resident: stats ---- */

function residentStats(user) {
  const rows = getActivity(user.id);
  const base = { items: 0, diverted: 0, kg: 0, ...(user.baseline || {}) };
  const divertedRows = rows.filter((row) => row.status !== 'Landfill');
  const items = base.items + rows.length;
  const diverted = base.diverted + divertedRows.length;
  const kg = divertedRows.reduce((sum, row) => sum + (Number(row.kg) || 0), base.kg);
  return { items, diverted, kg, score: items ? Math.round((diverted / items) * 100) : 0 };
}

function ecoLevel(score, items) {
  if (!items) return 'Log your first item to start';
  if (score >= 75) return 'Level 3 Champion';
  return score >= 50 ? 'Level 2 Sorter' : 'Level 1 Starter';
}

function renderResidentStats(user) {
  const stats = residentStats(user);
  $('[data-stat="items"]').textContent = stats.items;
  $('[data-stat="diverted"]').textContent = stats.diverted;
  $('[data-stat="kg"]').textContent = `${stats.kg.toFixed(1)} kg`;
  $('[data-stat="score"]').textContent = `${stats.score}%`;
  $('[data-stat="level"]').textContent = ecoLevel(stats.score, stats.items);
}

/* ---- Resident: history log ---- */

function activityRowHtml(row) {
  return `
    <tr>
      <td data-label="Item"><strong>${esc(row.item)}</strong></td>
      <td data-label="Category">${esc(row.category)}</td>
      <td data-label="Disposal">${esc(row.disposal)}</td>
      <td data-label="Weight">${esc((Number(row.kg) || 0).toFixed(1))} kg</td>
      <td data-label="Date">${esc(formatDate(row.date))}</td>
      <td data-label="Status"><span class="badge ${LOG_STATUS_BADGE[row.status] || 'badge-info'}">${esc(row.status)}</span></td>
    </tr>`;
}

function renderActivityLog(user) {
  const rows = getActivity(user.id);
  const label = rows.length === 1 ? '1 Logged Entry' : `${rows.length} Logged Entries`;
  $$('.js-activity-count').forEach((el) => { el.textContent = label; });
  $$('.js-activity-rows').forEach((tbody) => {
    const limit = Number(tbody.dataset.limit) || rows.length;
    tbody.innerHTML = rows.length
      ? rows.slice(0, limit).map(activityRowHtml).join('')
      : '<tr><td colspan="6" class="cell-full muted">No items logged yet. Use "Log Recycled Item" to add your first one.</td></tr>';
  });
}

function refreshResidentLog() {
  const user = currentUser();
  if (!user || user.role !== 'resident') return;
  renderResidentStats(user);
  renderActivityLog(user);
}

/* ---- Resident: log item modal ---- */

ACTIONS['open-log-modal'] = () => {
  const form = document.getElementById('logItemForm');
  form.reset();
  clearFormErrors(form);
  $('#logItemKg').value = '0.5';
  $('#logItemNames').innerHTML = getRules().map((rule) => `<option value="${esc(rule.name)}"></option>`).join('');
  openModal('logItemModal');
};

const LOG_DISPOSAL_STATUS = {
  'Yellow Recycling Bin': 'Recycled',
  'Green FOGO Bin': 'Recycled',
  'Drop-off Centre': 'Drop-off',
  'Red General Waste Bin': 'Landfill',
};

/** Picks the matching bin choice for a known item name. */
function disposalChoiceForRule(rule) {
  if (rule.status === 'special') return 'Drop-off Centre';
  if (rule.status === 'not-recyclable') return 'Red General Waste Bin';
  return rule.disposalMethod === GREEN_BIN ? 'Green FOGO Bin' : 'Yellow Recycling Bin';
}

function initLogItemForm() {
  const form = document.getElementById('logItemForm');
  if (!form) return;

  $('#logItemName').addEventListener('change', (event) => {
    const rule = getRules().find((candidate) => candidate.name.toLowerCase() === event.target.value.trim().toLowerCase());
    if (!rule) return;
    $('#logItemCategory').value = rule.category;
    $('#logItemDisposal').value = disposalChoiceForRule(rule);
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const user = currentUser();
    if (!user || user.role !== 'resident') return;

    const item = $('#logItemName').value.trim();
    const category = $('#logItemCategory').value;
    const disposal = $('#logItemDisposal').value;
    const kg = Number($('#logItemKg').value);

    const errors = {};
    if (item.length < 2) errors.logItemName = 'Enter the item name.';
    if (!category) errors.logItemCategory = 'Choose a category.';
    if (!disposal) errors.logItemDisposal = 'Choose where the item went.';
    if (!Number.isFinite(kg) || kg <= 0 || kg > 100) errors.logItemKg = 'Enter a weight between 0.1 and 100 kg.';
    if (!applyFormErrors(form, errors)) return;

    addActivityEntry(user.id, { item, category, disposal, kg, status: LOG_DISPOSAL_STATUS[disposal] });
    closeModal('logItemModal');
    refreshResidentLog();
    showToast(`"${item}" added to your recycling log.`);
  });
}

/* ---- Resident: saved hubs ---- */

function renderSavedHubs() {
  const container = document.getElementById('savedHubsList');
  const user = currentUser();
  if (!container || !user || user.role !== 'resident') return;
  const hubs = getSavedHubIds(user.id).map(findHub).filter(Boolean);
  container.innerHTML = hubs.length
    ? hubs.map((hub) => hubCardHtml(hub)).join('')
    : `<div class="empty-state">
         <h3>No saved hubs yet</h3>
         <p>Save the drop-off hubs you use most, and they will appear here.</p>
         <a class="btn btn-primary btn-sm" href="locations.html"><i data-lucide="map-pin"></i> Find a Hub</a>
       </div>`;
  renderIcons();
}

/* ---- Resident: notifications and settings ---- */

function initNotificationToggles(user) {
  const prefs = getPreferences(user.id);
  $$('[data-pref]').forEach((input) => {
    input.checked = Boolean(prefs[input.dataset.pref]);
    input.addEventListener('change', () => {
      const current = getPreferences(user.id);
      current[input.dataset.pref] = input.checked;
      savePreferences(user.id, current);
      const name = input.dataset.pref === 'sms' ? 'SMS' : 'Email';
      showToast(`${name} bin reminders turned ${input.checked ? 'on' : 'off'}.`, 'info');
    });
  });
}

function fillSettingsForm(user) {
  $('#settingsName').value = user.name;
  $('#settingsEmail').value = user.email;
  $('#settingsAddress').value = user.address || '';
  $('#settingsEmail').readOnly = Boolean(user.demo);
  $('#settingsEmailHint').hidden = !user.demo;
}

function initSettingsForm(user) {
  const form = document.getElementById('settingsForm');
  fillSettingsForm(user);
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const name = $('#settingsName').value.trim();
    const email = $('#settingsEmail').value.trim();
    const address = $('#settingsAddress').value.trim();
    const users = getUsers();
    const me = users.find((candidate) => candidate.id === user.id);
    if (!me) return;

    const errors = {};
    if (name.length < 2) errors.settingsName = 'Enter your full name.';
    if (!email) errors.settingsEmail = 'Enter your email address.';
    else if (!isValidEmail(email)) errors.settingsEmail = 'Enter a valid email address, for example name@example.com.';
    else if (users.some((other) => other.id !== me.id && normaliseEmail(other.email) === normaliseEmail(email))) {
      errors.settingsEmail = 'Another account already uses this email.';
    }
    if (!applyFormErrors(form, errors)) return;

    me.name = name;
    if (!me.demo) me.email = normaliseEmail(email);
    me.address = address;
    saveUsers(users);
    renderDashboardProfile(me);
    renderAccountBanner(me);
    showToast('Your account details have been updated.');
  });
}

function renderAccountBanner(user) {
  $('#accountBadge').textContent = user.demo ? 'Demo Account (dummy data)' : 'Resident Account';
  $('#accountName').textContent = `${user.name} — Suburb Zone 4`;
  const parts = [
    user.address ? `Address: ${user.address}` : 'Address not set',
    `Account ID: ${user.accountId || 'n/a'}`,
    `Member since ${formatDate(user.createdAt, { month: 'short', year: 'numeric' })}`,
  ];
  $('#accountDetails').textContent = parts.join(' • ');
}

function initResidentDashboard(user) {
  renderAccountBanner(user);
  renderResidentStats(user);
  renderActivityLog(user);
  renderSavedHubs();
  initLogItemForm();
  initNotificationToggles(user);
  initSettingsForm(user);
  document.addEventListener('hubs:changed', () => {
    renderSavedHubs();
  });
}

/* ---- Start-up ---- */

function initDashboard() {
  const app = document.getElementById('dashboardApp');
  if (!app) return;

  const user = currentUser();
  if (!user) {
    showAuthLock();
    return;
  }

  const role = dashboardRole(user);
  // Modules for the other role are removed from the page, not just hidden.
  $$('[data-role]').forEach((el) => {
    if (el.dataset.role !== role) el.remove();
  });
  app.hidden = false;

  renderDashboardProfile(user);
  if (role === 'admin') initAdminDashboard(user);
  else initResidentDashboard(user);

  showDashboardTab(window.location.hash.slice(1));
  window.addEventListener('hashchange', () => showDashboardTab(window.location.hash.slice(1)));

  // Keep data current if another tab changes it; log out here if that tab logged out.
  window.addEventListener('storage', () => {
    const latest = currentUser();
    if (!latest) {
      window.location.reload();
      return;
    }
    if (dashboardRole(latest) === 'admin') renderAdminDashboard();
    else refreshResidentLog();
  });
}

/* ---- Administrator view ----
   Every action rechecks the role first, because residents must not be able to
   change rules even if they call these handlers from the browser console. */

function requireAdmin() {
  const user = currentUser();
  if (user && user.role === 'admin') return user;
  showToast('Access denied: only administrators can do this.', 'error');
  return null;
}

const CITY_TONS_DIVERTED = 74.2; // demo figure from the project brief

function renderAdminStats() {
  $('[data-admin-stat="rules"]').textContent = getRules().length;
  $('[data-admin-stat="pending"]').textContent = getPending().length;
  $('[data-admin-stat="residents"]').textContent = getUsers().filter((user) => user.role === 'resident').length;
  $('[data-admin-stat="tons"]').textContent = `${CITY_TONS_DIVERTED} t`;
}

/* ---- Citizen request queue ---- */

const isClassified = (request) => Boolean(RULE_STATUS[request.status] && request.disposalMethod && CATEGORIES.includes(request.category)
  && Array.isArray(request.instructions) && request.instructions.length);

function queueCardHtml(request) {
  const classified = isClassified(request);
  return `
    <article class="queue-card">
      <div class="queue-info">
        <div class="row-wrap mb-sm">
          <h3>${esc(request.name)}</h3>
          <span class="badge badge-info">Submitted ${esc(formatDate(request.dateSubmitted))}</span>
          ${classified ? statusBadge(request.status) : '<span class="badge badge-special">Needs classification</span>'}
        </div>
        <p class="small muted"><strong>Category:</strong> ${esc(request.category || 'Not specified')} • <strong>Target disposal:</strong> ${esc(request.disposalMethod || 'To be decided')}</p>
        <p class="small muted">Submitted by ${esc(request.submittedBy)} • "${esc(request.reason)}"</p>
      </div>
      <div class="queue-actions">
        <button type="button" class="btn btn-sm btn-primary" data-action="approve-request" data-id="${esc(request.id)}"><i data-lucide="check"></i> Approve &amp; Publish<span class="sr-only">: ${esc(request.name)}</span></button>
        <button type="button" class="btn btn-sm btn-danger-outline" data-action="reject-request" data-id="${esc(request.id)}"><i data-lucide="x"></i> Reject<span class="sr-only">: ${esc(request.name)}</span></button>
      </div>
    </article>`;
}

function renderPendingQueue() {
  const requests = getPending();
  $$('.js-pending-queue').forEach((container) => {
    container.innerHTML = requests.length
      ? requests.map(queueCardHtml).join('')
      : '<div class="empty-state"><h3>All caught up</h3><p>There are no citizen requests waiting for review.</p></div>';
  });
}

/* ---- Master rule registry ---- */

function ruleRowHtml(rule) {
  return `
    <tr>
      <td data-label="Item" class="cell-full"><strong>${esc(rule.name)}</strong><span class="rule-note">${esc(rule.adminNote)} • ${esc(formatDate(rule.updatedDate))}</span></td>
      <td data-label="Category">${esc(rule.category)}</td>
      <td data-label="Status">${statusBadge(rule.status)}</td>
      <td data-label="Disposal">${esc(rule.disposalMethod)}</td>
      <td data-label="Actions" class="cell-full">
        <div class="table-actions">
          <button type="button" class="btn btn-sm btn-secondary" data-action="edit-rule" data-id="${esc(rule.id)}"><i data-lucide="pencil"></i> Edit<span class="sr-only">: ${esc(rule.name)}</span></button>
          <button type="button" class="btn btn-sm btn-danger-outline" data-action="delete-rule" data-id="${esc(rule.id)}"><i data-lucide="trash-2"></i> Delete<span class="sr-only">: ${esc(rule.name)}</span></button>
        </div>
      </td>
    </tr>`;
}

function renderRuleRegistry() {
  const tbody = document.getElementById('ruleTableBody');
  if (!tbody) return;
  const query = $('#registrySearch').value;
  const category = $('#registryCategory').value;
  const rules = getRules();
  const base = queryTokens(query).length
    ? searchRules(query, rules)
    : [...rules].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0) || a.name.localeCompare(b.name));
  const visible = category === 'all' ? base : base.filter((rule) => rule.category === category);
  $('#registryCount').textContent = `${visible.length} of ${rules.length} rules`;
  tbody.innerHTML = visible.length
    ? visible.map(ruleRowHtml).join('')
    : '<tr><td colspan="5" class="cell-full muted">No rules match this filter.</td></tr>';
}

function renderRecentChanges() {
  const list = document.getElementById('recentRuleChanges');
  if (!list) return;
  const recent = getRules().filter((rule) => rule.updatedAt).sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 5);
  list.innerHTML = recent.length
    ? recent.map((rule) => `
        <div class="upcoming-row">
          <span>${esc(rule.name)}</span>
          <span class="rule-note">${esc(rule.adminNote)} • ${esc(formatDate(rule.updatedDate))}</span>
        </div>`).join('')
    : '<p class="muted small">No changes yet. Rules you create, edit or approve will be listed here with a verification note.</p>';
}

function renderAdminDashboard() {
  renderAdminStats();
  renderPendingQueue();
  renderRuleRegistry();
  renderRecentChanges();
  renderIcons();
}

/* ---- Create, edit and approve share one form ---- */

const ruleFormState = { mode: 'create', ruleId: null, requestId: null };

function openRuleForm({ mode, rule = null, request = null }) {
  const form = document.getElementById('ruleForm');
  form.reset();
  clearFormErrors(form);
  ruleFormState.mode = mode;
  ruleFormState.ruleId = rule ? rule.id : null;
  ruleFormState.requestId = request ? request.id : null;

  const source = rule || request || {};
  $('#ruleName').value = source.name || '';
  $('#ruleCategory').value = CATEGORIES.includes(source.category) ? source.category : '';
  $('#ruleStatus').value = RULE_STATUS[source.status] ? source.status : '';
  $('#ruleDisposal').value = source.disposalMethod || '';
  $('#ruleSteps').value = Array.isArray(source.instructions) ? source.instructions.join('\n') : '';
  $('#ruleNote').value = '';

  const titles = { create: 'Publish New Waste Rule', edit: 'Edit Waste Rule', approve: 'Classify and Publish Request' };
  const labels = { create: 'Publish Waste Rule', edit: 'Save Changes', approve: 'Approve & Publish' };
  $('#ruleModalTitle').textContent = titles[mode];
  $('#ruleSubmitLabel').textContent = labels[mode];
  const hint = document.getElementById('ruleRequestHint');
  hint.hidden = mode !== 'approve';
  if (mode === 'approve') hint.textContent = `Submitted by ${request.submittedBy}: "${request.reason}" Add the disposal details before publishing.`;
  openModal('ruleModal');
}

ACTIONS['new-rule'] = () => {
  if (requireAdmin()) openRuleForm({ mode: 'create' });
};

ACTIONS['edit-rule'] = (trigger) => {
  if (!requireAdmin()) return;
  const rule = getRules().find((candidate) => candidate.id === trigger.dataset.id);
  if (rule) openRuleForm({ mode: 'edit', rule });
};

ACTIONS['delete-rule'] = async (trigger) => {
  if (!requireAdmin()) return;
  const rule = getRules().find((candidate) => candidate.id === trigger.dataset.id);
  if (!rule) return;
  const confirmed = await confirmDialog({
    title: 'Delete this waste rule?',
    message: `"${rule.name}" will be removed from public Waste Search. This cannot be undone.`,
    confirmLabel: 'Delete Rule',
  });
  if (!confirmed || !requireAdmin()) return;
  saveRules(getRules().filter((candidate) => candidate.id !== rule.id));
  renderAdminDashboard();
  showToast(`Deleted "${rule.name}".`, 'info');
};

function uniqueRuleId(name, rules) {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'rule';
  let id = slug;
  let counter = 2;
  while (rules.some((rule) => rule.id === id)) {
    id = `${slug}-${counter}`;
    counter += 1;
  }
  return id;
}

/** Adds a queue request to the live rule list and removes it from the queue. */
function publishRequest(request, values, admin) {
  const rules = getRules();
  const rule = {
    id: uniqueRuleId(values.name, rules),
    keywords: '',
    ...values,
    adminNote: values.adminNote || `Approved by ${admin.name} (Admin)`,
    updatedDate: toISODate(),
    updatedAt: Date.now(),
  };
  saveRules([rule, ...rules]);
  savePending(getPending().filter((candidate) => candidate.id !== request.id));
  return rule;
}

ACTIONS['approve-request'] = (trigger) => {
  const admin = requireAdmin();
  if (!admin) return;
  const request = getPending().find((candidate) => candidate.id === trigger.dataset.id);
  if (!request) return;

  const duplicate = getRules().some((rule) => rule.name.toLowerCase() === request.name.toLowerCase());
  // Unclassified requests need disposal details first, so nothing inaccurate is ever published.
  if (!isClassified(request) || duplicate) {
    openRuleForm({ mode: 'approve', request });
    if (duplicate) setFieldError($('#ruleName'), 'A rule with this name already exists. Rename it or reject this request.');
    return;
  }
  publishRequest(request, {
    name: request.name,
    category: request.category,
    status: request.status,
    disposalMethod: request.disposalMethod,
    instructions: request.instructions,
  }, admin);
  renderAdminDashboard();
  showToast(`Approved "${request.name}". It is now live in Waste Search.`);
};

ACTIONS['reject-request'] = async (trigger) => {
  if (!requireAdmin()) return;
  const request = getPending().find((candidate) => candidate.id === trigger.dataset.id);
  if (!request) return;
  const confirmed = await confirmDialog({
    title: 'Reject this request?',
    message: `"${request.name}" will be removed from the queue and will not be published.`,
    confirmLabel: 'Reject Request',
  });
  if (!confirmed || !requireAdmin()) return;
  savePending(getPending().filter((candidate) => candidate.id !== request.id));
  renderAdminDashboard();
  showToast(`Rejected "${request.name}".`, 'info');
};

function handleRuleSubmit(event) {
  event.preventDefault();
  const admin = requireAdmin();
  if (!admin) return;
  const form = event.currentTarget;
  const values = {
    name: $('#ruleName').value.trim(),
    category: $('#ruleCategory').value,
    status: $('#ruleStatus').value,
    disposalMethod: $('#ruleDisposal').value.trim(),
    instructions: $('#ruleSteps').value.split('\n').map((step) => step.trim()).filter(Boolean),
  };
  const note = $('#ruleNote').value.trim();
  const rules = getRules();
  const { mode, ruleId, requestId } = ruleFormState;

  const errors = {};
  if (values.name.length < 2) errors.ruleName = 'Enter the item name.';
  else if (rules.some((rule) => rule.id !== ruleId && rule.name.toLowerCase() === values.name.toLowerCase())) {
    errors.ruleName = 'A rule with this name already exists.';
  }
  if (!values.category) errors.ruleCategory = 'Choose a category.';
  if (!values.status) errors.ruleStatus = 'Choose a disposal status.';
  if (values.disposalMethod.length < 2) errors.ruleDisposal = 'Enter where this item should go.';
  if (!values.instructions.length) errors.ruleSteps = 'Add at least one preparation step.';
  if (!applyFormErrors(form, errors)) return;

  if (mode === 'approve') {
    const request = getPending().find((candidate) => candidate.id === requestId);
    if (!request) return;
    publishRequest(request, { ...values, adminNote: note }, admin);
    closeModal('ruleModal');
    renderAdminDashboard();
    showToast(`Approved "${values.name}". It is now live in Waste Search.`);
    return;
  }

  const stamp = { updatedDate: toISODate(), updatedAt: Date.now() };
  if (mode === 'edit') {
    saveRules(rules.map((rule) => (rule.id === ruleId
      ? { ...rule, ...values, ...stamp, adminNote: note || `Updated by ${admin.name} (Admin)` }
      : rule)));
    showToast(`Updated the rule for "${values.name}".`);
  } else {
    saveRules([{
      id: uniqueRuleId(values.name, rules),
      keywords: '',
      ...values,
      ...stamp,
      adminNote: note || `Verified by ${admin.name} (Admin)`,
    }, ...rules]);
    showToast(`Published "${values.name}" to Waste Search.`);
  }
  closeModal('ruleModal');
  renderAdminDashboard();
}

function initAdminDashboard() {
  $('#ruleForm').addEventListener('submit', handleRuleSubmit);
  $('#registrySearch').addEventListener('input', () => {
    renderRuleRegistry();
    renderIcons();
  });
  $('#registryCategory').addEventListener('change', () => {
    renderRuleRegistry();
    renderIcons();
  });
  renderAdminDashboard();
}

/* ==========================================================================
   13. BOOT
   Each step is isolated, so one failure can't stop the rest of the page.
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  [
    initStorage,
    toastRegion, // the aria-live region must exist before the first message
    initMobileMenu,
    initSkipLink,
    renderNavActions,
    initHomeStats,
    initQuickSearch,
    renderCollectionWidgets,
    initWasteSearchPage,
    initRecyclingGuide,
    initHubFinder,
    initHomeHubPreview,
    initContactForm,
    initAuthPage,
    initDashboard,
    renderIcons,
    showPendingFlash,
  ].forEach((step) => {
    try {
      step();
    } catch (error) {
      console.error(`Start-up step "${step.name}" failed.`, error);
    }
  });
});
