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

document.addEventListener('click', (event) => {
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
});

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
  return value.filter(isValid);
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

/* TEMPORARY bridge for dashboard code that has not been migrated yet. */
let WASTE_DATABASE = getRules().map((r) => ({ ...r, recyclable: r.status === 'recyclable' ? true : r.status === 'special' ? 'special' : false }));
let PENDING_SUBMISSIONS = getPending();
let RESIDENT_ACTIVITY = getActivity(ALEX_ID);
const MOCK_LOCATIONS = HUBS.map((h) => ({ id: h.id, name: h.name, address: `${h.street}, ${h.suburb} ${h.state} ${h.postcode}`, distance: '', types: h.types, hours: h.hours, phone: h.phone }));
const getCurrentUser = () => { const u = currentUser(); return u ? { ...u, loggedIn: true, avatar: initialsOf(u.name) } : null; };
const logoutUser = () => ACTIONS.logout();

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
      if (!list.hidden) event.stopPropagation();
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
function openDirectionsModal(locationName) {
  alert(`GPS Route Navigation: Displaying optimal route to ${locationName}.`);
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

/* ==========================================================================
   13. BOOT
   ========================================================================== */
document.addEventListener('DOMContentLoaded', () => {
  initStorage();
  initMobileMenu();
  renderNavActions();
  initQuickSearch();
  initWasteSearchPage();
  initLocationFinder();
  initAuthPage();
  initDashboard();
  renderIcons();
  showPendingFlash();
});
