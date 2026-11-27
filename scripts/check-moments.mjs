// Browser-level checks of the Moments against the real Dashboard (headless Chrome).
//
// How to run (nothing is added to package.json):
//   1. Install puppeteer-core outside the project:   npm i --prefix /tmp/cc-pw puppeteer-core
//   2. Point to Chrome (macOS example) and to that folder:
//        export CHROME_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
//        export PUPPETEER_DIR=/tmp/cc-pw
//   3. Build and start the app:                      npm run build && npm start
//   4. In another terminal:                          node scripts/check-moments.mjs
//
// Environment variables (all optional):
//   BASE_URL          app URL (default http://localhost:3000)
//   CHROME_PATH       Chrome executable (default: the macOS Google Chrome app)
//   PUPPETEER_DIR     folder where puppeteer-core was installed (default /tmp/cc-pw)
//   VIEWPORT          WIDTHxHEIGHT (default 1280x900)
//   RAF_THROTTLE_MS   makes animation frames arrive this far apart (default 0); use 700 to emulate a
//                     slow or background tab, where GSAP lag smoothing would stretch a Moment
//   MOMENTS           comma list of checks to run (default: all of MOMENT_CHECKS, e.g. "shovel,payment,sigil";
//                     "fullDemo" runs the whole level-4 flow and checks the order, gaps and overlap of the Moments)
//
// Each check runs in a fresh browser context (empty IndexedDB) and loads the demo crypt at level 4,
// except `landing`, which measures the Landing at 1280x720 and 375x667 and enters the demo from it.
// Every check also fails if anything wrote to the clipboard (navigator.clipboard, execCommand, "copy" event).
//
// To add a Moment: write an async `run(page)` that drives the UI and returns its sampled data, then
// add { name, run, assert } to MOMENT_CHECKS.
import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const CHROME_PATH = process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PUPPETEER_DIR = process.env.PUPPETEER_DIR ?? "/tmp/cc-pw";
const [VW, VH] = (process.env.VIEWPORT ?? "1280x900").split("x").map(Number);
const VIEWPORT = { width: VW, height: VH };
const RAF_THROTTLE_MS = Number(process.env.RAF_THROTTLE_MS ?? 0);
const ONLY = (process.env.MOMENTS ?? "").split(",").map((s) => s.trim()).filter(Boolean);

const SAMPLE_MS = 100;
const SETTLE_MS = 2500;
const MAX_MOMENT_MS = 6000;
const FLAME_NEAR_PX = 40;
const ORB_MIN_TRAVEL_PX = 150;
const LIGHT_RISE_MIN = 0.01;
const FAST_FRAME_MAX_MS = 200; // above this, short beats can fall between two frames and are not asserted
const PAYMENT_MAX_ON_SCREEN_MS = 3200; // sampler starts ~0.2 s before the click; the Moment lasts ~2 s
const SHOVEL_MAX_SPAN_MS = 2600; // art on screen: cancel Moment 1.4 s plus the wait for the tombstone
const SHOVEL_MIN_TRAVEL_PX = 100;
const SIGIL_MAX_SPAN_MS = 2200; // art on screen: sigil Moment 1.2 s plus sampler and unmount slack
const SIGIL_DRAWN_MIN = 0.98;
const SIGIL_BOUND_OPACITY = 0.5; // Poltergeist.tsx BOUND_OPACITY
const LIVE_EPSILON = 0.002;
const THROTTLED = RAF_THROTTLE_MS > FAST_FRAME_MAX_MS;
const CANDLE_COUNT = 3;
const CANDLES_MAX_SPAN_MS = 2400; // candles on screen: Moment 1.2 s plus sampler and unmount slack
const CANDLE_LIT = 0.5; // a flame counts as lit above this opacity
const CANDLE_ORDER_MIN_GAP_MS = 20; // consecutive flames must not light at the same sample
const OVERLAP_SLACK_PX = 0.5; // sub-pixel rounding of getBoundingClientRect
const RIP_TEXT = "R.I.P. $120/mo"; // Wraithcast, formatCentsShort (Requirement 11.2)
/**
 * Scene parts the three candles must not overlap ([name, selector inside the Scene]). Tree and bat
 * groups are read per child, so each tree and each bat (at its current circling position) is one box.
 */
const DRAWN_PART_SELECTORS = [
  ["moon", '[data-part="moon"]'],
  ["poltergeist", '[data-part="poltergeist"]'],
  ["chimney", '[data-part="chimney"]'],
  ["house", '[data-part="house"]'],
  ["tree", '[data-part="tree"] > g'],
  ["fence", '[data-part="fence"]'],
  ["bat", '[data-part="bats"] > g'],
  ["ground-cover", '[data-part="ground-cover"]'],
  ["zombies", '[data-part="zombies"]'],
  ["graveyard", '[data-part="graveyard"]'],
];
// Measured gap = next start (up to one sample late) minus last visible sample (up to one sample early).
const GAP_BELOW_MS = SAMPLE_MS; // sampling jitter below MOMENT_GAP_MS
const GAP_ABOVE_MS = 2 * SAMPLE_MS + 100 + RAF_THROTTLE_MS; // two samples, scheduling slack, one slow frame

/** Reads MOMENT_GAP_MS from the scene config (the script cannot import TypeScript). */
function readMomentGapMs() {
  const source = readFileSync(new URL("../src/lib/scene/config.ts", import.meta.url), "utf8");
  const match = source.match(/export const MOMENT_GAP_MS\s*=\s*(\d+)/);
  if (!match) throw new Error("MOMENT_GAP_MS not found in src/lib/scene/config.ts");
  return Number(match[1]);
}
const MOMENT_GAP_MS = readMomentGapMs();

/** Reads a numeric `export const NAME = 1.15;` from the scene config. */
function readSceneConstant(name) {
  const source = readFileSync(new URL("../src/lib/scene/config.ts", import.meta.url), "utf8");
  const match = source.match(new RegExp(`export const ${name}\\s*=\\s*([0-9.]+)`));
  if (!match) throw new Error(`${name} not found in src/lib/scene/config.ts`);
  return Number(match[1]);
}
const FEED_SCALE = readSceneConstant("FEED_SCALE");
const FLICKER_DIP_RATIO = readSceneConstant("FLICKER_DIP_RATIO");

/** Which Moment owns each art part in the Moment layer. */
const PART_OWNER = {
  shovel: "cancel", "name-label": "cancel", "tombstone-clip": "cancel", tombstone: "cancel", "dirt-puff": "cancel",
  flame: "payment", orb: "payment", "crack-flash": "payment",
  sigil: "sigil", "sigil-flash": "sigil",
  candle: "exorcismComplete", "candle-flame": "exorcismComplete",
  bat: "level", "creak-crack": "level", shutter: "level",
  "feed-particle": "poltergeistFeed", "poltergeist-copy": "poltergeistFeed", "poltergeist-copy-feed": "poltergeistFeed",
  "ghost-arrival": "ghostArrival", "ghost-arrival-rise": "ghostArrival", "marker-pulse": "ghostArrival", "marker-pulse-inner": "ghostArrival",
  "flicker-glow": "candleFlicker",
};

function loadPuppeteer() {
  for (const base of [import.meta.url, `file://${PUPPETEER_DIR}/`]) {
    try {
      return createRequire(base)("puppeteer-core");
    } catch {
      // try the next location
    }
  }
  throw new Error(`puppeteer-core not found. Run \`npm i --prefix ${PUPPETEER_DIR} puppeteer-core\``);
}

const overlapPx = (a, b) =>
  Math.min(a.left + a.width, b.left + b.width) - Math.max(a.left, b.left) > OVERLAP_SLACK_PX &&
  Math.min(a.top + a.height, b.top + b.height) - Math.max(a.top, b.top) > OVERLAP_SLACK_PX;
const insideRect = (r, outer) =>
  r.left >= outer.left - OVERLAP_SLACK_PX &&
  r.top >= outer.top - OVERLAP_SLACK_PX &&
  r.left + r.width <= outer.left + outer.width + OVERLAP_SLACK_PX &&
  r.top + r.height <= outer.top + outer.height + OVERLAP_SLACK_PX;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const fmt = (n) => (n === null || n === undefined || Number.isNaN(n) ? "  -  " : n.toFixed(3));

let failures = [];
const check = (ok, message) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${message}`);
  if (!ok) failures.push(message);
};

async function clickByText(page, selector, text) {
  const handle = await page.evaluateHandle(
    (sel, label) =>
      [...document.querySelectorAll(sel)].find(
        (el) => (el.getAttribute("aria-label") ?? el.textContent ?? "").trim().includes(label) && !el.closest("[inert]"),
      ) ?? null,
    selector,
    text,
  );
  const element = handle.asElement();
  if (!element) throw new Error(`No ${selector} with text "${text}"`);
  await element.click();
}

const waitFor = (page, fn, arg, timeout = 8000) => page.waitForFunction(fn, { timeout, polling: 50 }, arg);
const hasButton = (page, text) =>
  waitFor(page, (label) => [...document.querySelectorAll("button")].some((b) => b.textContent?.trim() === label), text);

/** Runs before any page script: clipboard spies, plus slow animation frames when RAF_THROTTLE_MS is set. */
function installPageHooks(throttleMs) {
  window.__clipboardCalls = [];
  const record = (name) => () => {
    window.__clipboardCalls.push(name);
    return Promise.resolve();
  };
  try {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: record("navigator.clipboard.writeText"), write: record("navigator.clipboard.write") },
    });
  } catch {
    // navigator.clipboard is not replaceable here; the execCommand and copy-event spies still run
  }
  document.execCommand = (command) => {
    if (/^(copy|cut)$/i.test(command)) window.__clipboardCalls.push(`execCommand(${command})`);
    return false;
  };
  document.addEventListener("copy", () => window.__clipboardCalls.push("copy event"), true);
  if (throttleMs > 0) {
    window.requestAnimationFrame = (cb) => setTimeout(() => cb(performance.now()), throttleMs);
    window.cancelAnimationFrame = (handle) => clearTimeout(handle);
  }
}

/** Installed in the page: samples the Moment layer and the Scene every sampleMs. */
function installSampler(sampleMs, DRAWN_PART_SELECTORS) {
  const rectOf = (el) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { left: r.left, top: r.top, width: r.width, height: r.height, cx: r.left + r.width / 2, cy: r.top + r.height / 2 };
  };
  const opacityOf = (el) => (el ? Number(getComputedStyle(el).opacity) : Number.NaN);
  // Share of the sigil ring's outline that is drawn (DrawSVGPlugin sets the dash array and offset).
  const sigilDrawn = (el) => {
    if (!el) return null;
    const total = el.getTotalLength();
    const dash = parseFloat(el.style.strokeDasharray || getComputedStyle(el).strokeDasharray);
    return total > 0 && Number.isFinite(dash) ? Math.min(1, dash / total) : null;
  };
  window.__saveRect = null;
  document.addEventListener(
    "click",
    (event) => {
      const button = event.target instanceof Element ? event.target.closest("button") : null;
      if (button && (button.textContent ?? "").trim() === "Save payment") window.__saveRect = rectOf(button);
    },
    true,
  );
  window.__samples = [];
  const t0 = performance.now();
  window.__samplerT0 = t0;
  setInterval(() => {
    const layer = document.querySelector('[data-part="moment-layer"]');
    const part = (name) => layer?.querySelector(`[data-moment="${name}"]`) ?? null;
    const scene = document.querySelector('[data-part="scene"]');
    const incoming = scene?.querySelector('[data-part="incoming-level"]') ?? null;
    const oldDecay = scene?.querySelector(':scope > svg > [data-part="decay"]') ?? null;
    const lit = [...document.querySelectorAll('[data-part="scene"] [data-state="lit"]')];
    const lightOf = (w) => Number(getComputedStyle(w.querySelector('[data-part="light"]')).opacity);
    window.__samples.push({
      t: Math.round(performance.now() - t0),
      layerChildren: layer ? layer.children.length : 0,
      flame: rectOf(part("flame")),
      flameOpacity: opacityOf(part("flame")),
      orb: rectOf(part("orb")),
      orbOpacity: opacityOf(part("orb")),
      shovel: rectOf(part("shovel")),
      shovelOpacity: opacityOf(part("shovel")),
      tombstoneArtOpacity: opacityOf(part("tombstone")),
      sigilOpacity: opacityOf(part("sigil")),
      sigilDrawn: sigilDrawn(part("sigil")),
      feedScale: (() => {
        const el = document.querySelector('[data-part="scene"] [data-part="poltergeist-feed"]');
        if (!el) return null;
        const t = getComputedStyle(el).transform;
        const m = t && t !== "none" ? new DOMMatrixReadOnly(t) : el.transform?.baseVal?.consolidate()?.matrix;
        return m ? Math.hypot(m.a, m.b) : 1;
      })(),
      arrival: rectOf(part("ghost-arrival")),
      arrivalOpacity: opacityOf(part("ghost-arrival")),
      ghostIds: [...document.querySelectorAll('[data-part="scene"] [data-part="ghost"]')].map((el) => el.getAttribute("data-id")),
      // Rect of each ghost at its rest point: the ambient orbit and bob translate the inner group, so remove that offset.
      ghostRects: Object.fromEntries(
        [...document.querySelectorAll('[data-part="scene"] [data-part="ghost"]')].map((el) => {
          const rect = rectOf(el);
          const inner = el.querySelector('[data-ambient="ghost-orbit"]');
          const matrix = inner?.transform?.baseVal?.consolidate()?.matrix;
          const svg = el.ownerSVGElement;
          const scale = svg && svg.viewBox.baseVal.width > 0 ? svg.getBoundingClientRect().width / svg.viewBox.baseVal.width : 1;
          const dx = matrix ? matrix.e * scale : 0;
          const dy = matrix ? matrix.f * scale : 0;
          return [el.getAttribute("data-id"), { ...rect, cx: rect.cx - dx, cy: rect.cy - dy }];
        }),
      ),
      bannerAmount: document.querySelector('[data-part="banner-amount"]')?.textContent ?? null,
      toastText: [...document.querySelectorAll('[role="status"], [role="alert"]')].map((el) => el.textContent ?? "").join(" | "),
      toastView: [...document.querySelectorAll("button")].map((b) => b.getAttribute("aria-label") ?? "").filter((l) => l.startsWith("View in")),
      polterBodyOpacity: opacityOf(document.querySelector('[data-part="scene"] [data-part="poltergeist-body"]')),
      polterState: document.querySelector('[data-part="scene"] [data-part="poltergeist"]')?.getAttribute("data-state") ?? null,
      zombies: document.querySelectorAll('[data-part="scene"] [data-part="zombie"]').length,
      tombstones: document.querySelectorAll('[data-part="scene"] [data-part="tombstone"]').length,
      lightMax: lit.length ? Math.max(...lit.map(lightOf)) : null,
      level: document.querySelector('[data-part="scene"]')?.getAttribute("data-level") ?? null,
      incomingPresent: Boolean(incoming),
      incomingOpacity: incoming ? opacityOf(incoming) : null,
      incomingCracks: incoming ? incoming.querySelectorAll('[data-part^="crack:"]').length : null,
      oldDecayOpacity: opacityOf(oldDecay),
      oldCracks: oldDecay ? oldDecay.querySelectorAll('[data-part^="crack:"]').length : null,
      frontFogOpacity: opacityOf(document.querySelector('[data-part="scene"] [data-part="atmosphere-front"]')),
      bat: rectOf(part("bat")),
      parts: layer ? [...new Set([...layer.querySelectorAll("[data-moment]")].map((el) => el.getAttribute("data-moment")))] : [],
      visibleParts: layer
        ? [...new Set([...layer.querySelectorAll("[data-moment]")].filter((el) => opacityOf(el) > 0.02).map((el) => el.getAttribute("data-moment")))]
        : [],
      candles: layer ? [...layer.querySelectorAll('[data-moment="candle-flame"]')].map((el) => ({ opacity: opacityOf(el), rect: rectOf(el) })) : [],
      candleWax: layer ? [...layer.querySelectorAll('[data-moment="candle"]')].map((el) => ({ opacity: opacityOf(el), rect: rectOf(el) })) : [],
      // Drawn Scene parts the candles must not cover; only read while candles are in the layer.
      drawnParts:
        layer?.querySelector('[data-moment="candle"]') && scene
          ? DRAWN_PART_SELECTORS.flatMap(([name, selector]) =>
              [...scene.querySelectorAll(selector)].map((el, i) => ({ name: `${name}${i ? ` ${i}` : ""}`, rect: rectOf(el) })),
            ).filter((part) => part.rect && part.rect.width > 0 && part.rect.height > 0)
          : [],
      // The label rides on the tombstone, which is translated down (and clipped) until the rise ends. A
      // sample can land mid-rise (frames 700 ms apart), so report the label at its risen position: the
      // rect minus the tombstone's offset from its clip, which is 0 once the rise is over.
      riseLabel: (() => {
        const slab = layer?.querySelector('[data-moment="tombstone"]') ?? null;
        const clip = slab?.parentElement ?? null;
        const rect = rectOf(slab?.querySelector(":scope > div") ?? null);
        if (!rect || !slab || !clip) return rect;
        const offset = slab.getBoundingClientRect().top - clip.getBoundingClientRect().top;
        return { ...rect, top: rect.top - offset, cy: rect.cy - offset };
      })(),
    });
  }, sampleMs);
}

const GUIDE_TITLE = "How your crypt works";
const GUIDE_GOT_IT = "Got it";
const GUIDE_VIEWPORT = { width: 1280, height: 720 };
const guideShown = (page) =>
  page.evaluate((title) => [...document.querySelectorAll("h2")].some((h) => (h.textContent ?? "").trim() === title), GUIDE_TITLE);

/**
 * Enters the demo crypt. The Guide must be shown on entry (action-feedback Requirement 5.1); unless
 * `keepGuide` is set, it is then dismissed with "Got it" so the Scene keeps the house-scene layout.
 */
async function openDemo(page, { keepGuide = false } = {}) {
  await page.goto(BASE_URL, { waitUntil: "networkidle0" });
  await clickByText(page, "button", "Enter the demo crypt");
  // The Landing preview is a level-4 Scene too, so also wait until the Landing button is gone.
  await waitFor(
    page,
    (label) =>
      document.querySelector('[data-part="scene"][data-level="4"]') !== null &&
      ![...document.querySelectorAll("button")].some((b) => (b.textContent ?? "").trim() === label),
    "Enter the demo crypt",
  );
  await sleep(1500);
  check(await guideShown(page), "openDemo: the Guide is shown on entering the demo");
  if (keepGuide) return;
  await clickByText(page, "button", GUIDE_GOT_IT);
  await waitFor(page, (title) => ![...document.querySelectorAll("h2")].some((h) => (h.textContent ?? "").trim() === title), GUIDE_TITLE);
  await sleep(300);
}

async function cancelWraithcast(page) {
  await clickByText(page, "button", "Do it: Cancel Wraithcast");
  await hasButton(page, "Cancel subscription");
  await clickByText(page, "button", "Cancel subscription");
}

const sceneRect = (page) =>
  page.evaluate(() => {
    const r = document.querySelector('[data-part="scene"]').getBoundingClientRect();
    return { left: r.left, top: r.top, width: r.width, height: r.height };
  });

// ---------------------------------------------------------------------------------------------
// Moment checks. `run` drives the UI and returns data; `assert` turns it into PASS/FAIL lines.
// ---------------------------------------------------------------------------------------------

async function runShovel(page) {
  await page.evaluate(installSampler, SAMPLE_MS, DRAWN_PART_SELECTORS);
  await cancelWraithcast(page);
  await sleep(MAX_MOMENT_MS);
  const labels = await page.evaluate(() =>
    [...document.querySelectorAll('[data-part="scene"] [data-part="tombstone-label"]')].map((el) => {
      const r = el.getBoundingClientRect();
      return { text: el.textContent ?? "", rect: { left: r.left, top: r.top, width: r.width, height: r.height } };
    }),
  );
  return { samples: await page.evaluate(() => window.__samples), labels, scene: await sceneRect(page) };
}

function assertShovel({ samples, labels, scene }) {
  // Tombstone labels (Requirement 5.7): inside the Scene, short amount (Requirement 11.2).
  check(labels.length > 0, `shovel: tombstone labels are shown at this Scene width (${scene.width.toFixed(0)} px)`);
  for (const label of labels) {
    const r = label.rect;
    check(
      insideRect(r, scene),
      `shovel: tombstone label "${label.text}" is inside the scene (bottom ${(r.top + r.height - scene.top).toFixed(1)} of ${scene.height.toFixed(1)} px)`,
    );
  }
  check(labels.some((l) => l.text.includes(RIP_TEXT)), `shovel: a tombstone label reads "${RIP_TEXT}" (${labels.map((l) => l.text).join(" | ")})`);
  // While rising, the label is hidden under the tombstone clip; once risen it must be inside the Scene.
  const risen = samples.map((s) => s.riseLabel).filter(Boolean).at(-1);
  check(
    Boolean(risen) && insideRect(risen, scene),
    `shovel: the risen tombstone label of the Moment is inside the scene${risen ? ` (bottom ${(risen.top + risen.height - scene.top).toFixed(1)} of ${scene.height.toFixed(1)} px)` : ""}`,
  );
  const during = samples.filter((s) => s.layerChildren > 0);
  check(during.length > 0, "shovel: Moment layer got children during the Moment");
  if (during.length === 0) return;
  const span = during.at(-1).t - during[0].t;
  check(span <= SHOVEL_MAX_SPAN_MS, `shovel: Moment art is on screen for ${span} ms (max ${SHOVEL_MAX_SPAN_MS})`);
  // From its starting position (set before the first frame) to the farthest point: with GSAP lag
  // smoothing at far-apart frames the shovel barely leaves the start, so this also catches a stretched Moment.
  const seen = during.filter((s) => s.shovel).map((s) => s.shovel);
  const travel = seen.length ? Math.max(...seen.map((p) => Math.hypot(p.cx - seen[0].cx, p.cy - seen[0].cy))) : 0;
  check(travel >= SHOVEL_MIN_TRAVEL_PX, `shovel: travels ${travel.toFixed(0)} px from its start (min ${SHOVEL_MIN_TRAVEL_PX})`);
  const first = samples[0];
  const final = samples.at(-1);
  check(final.layerChildren === 0, "shovel: Moment art removed at the end");
  check(final.zombies === first.zombies - 1, `shovel: one zombie left the basement (${first.zombies} -> ${final.zombies})`);
  check(final.tombstones === first.tombstones + 1, `shovel: one tombstone was added (${first.tombstones} -> ${final.tombstones})`);
}

async function runPayment(page) {
  await cancelWraithcast(page);
  await sleep(SETTLE_MS * 2);
  const coffee = await page.evaluateHandle(
    () =>
      [...document.querySelectorAll('[role="checkbox"], input[type="checkbox"]')].find((el) =>
        /coffee|small expenses/i.test(el.closest("[data-plan-action]")?.textContent ?? ""),
      ) ?? null,
  );
  if (!coffee.asElement()) throw new Error("Coffee action checkbox not found");
  await coffee.asElement().click();
  await sleep(SETTLE_MS * 2);

  await clickByText(page, "button", "Do it:");
  await hasButton(page, "Save payment");
  await sleep(600);
  await page.evaluate(installSampler, SAMPLE_MS, DRAWN_PART_SELECTORS);
  const frozenBefore = await page.evaluate(() => {
    const w = document.querySelector('[data-part="scene"] [data-state="lit"] [data-part="light"]');
    return w ? Number(getComputedStyle(w).opacity) : null;
  });
  await clickByText(page, "button", "Save payment");
  await sleep(MAX_MOMENT_MS);
  // The art stays until the queue drains (candles and level Moments follow); slow frames stretch that.
  await waitFor(page, () => document.querySelector('[data-part="moment-layer"]')?.children.length === 0, null, 20000).catch((e) => console.log('drain wait:', e.message));
  await sleep(SAMPLE_MS * 3); // let the sampler record the empty layer
  const { samples, saveRect } = await page.evaluate(() => ({ samples: window.__samples, saveRect: window.__saveRect }));
  return { samples, saveRect, frozenBefore, scene: await sceneRect(page) };
}

function assertPayment({ samples, saveRect, frozenBefore, scene }) {
  console.log("Save payment rect:", saveRect, " light opacity before click:", frozenBefore);
  const during = samples.filter((s) => s.layerChildren > 0);
  check(saveRect !== null, "payment: Save payment rect captured at click");
  check(during.length > 0, "payment: Moment layer got children during the Moment");
  if (during.length === 0 || !saveRect) return;
  const firstFlame = during.find((s) => s.flame && s.flameOpacity > 0.05);
  if (!THROTTLED) {
    check(
      Boolean(firstFlame) &&
        Math.abs(firstFlame.flame.cx - saveRect.cx) <= FLAME_NEAR_PX &&
        Math.abs(firstFlame.flame.cy - saveRect.cy) <= FLAME_NEAR_PX,
      `payment: flame starts at the center of the Save payment button (${firstFlame ? `${firstFlame.flame.cx.toFixed(0)},${firstFlame.flame.cy.toFixed(0)}` : "no flame"})`,
    );
  }
  const orbPoints = during.filter((s) => s.orb && s.orbOpacity > 0.05).map((s) => s.orb);
  const from = THROTTLED ? { cx: saveRect.cx, cy: saveRect.cy } : orbPoints[0];
  const travel = orbPoints.length > 0 && from ? Math.max(...orbPoints.map((p) => Math.hypot(p.cx - from.cx, p.cy - from.cy))) : 0;
  if (THROTTLED && orbPoints.length === 0) {
    // With frames 700 ms apart the ~1 s orb flight can fall entirely between two frames. The Moment is
    // still driven on the wall clock, so what is asserted is that its art is gone on time (below).
    console.log("payment: no frame landed during the orb flight at this frame rate; travel is not asserted");
  } else {
    check(travel >= ORB_MIN_TRAVEL_PX, `payment: orb travels ${travel.toFixed(0)} px away from its start (min ${ORB_MIN_TRAVEL_PX})`);
  }
  const lastOrb = orbPoints.at(-1);
  const inScene =
    Boolean(lastOrb) &&
    lastOrb.cx >= scene.left && lastOrb.cx <= scene.left + scene.width &&
    lastOrb.cy >= scene.top && lastOrb.cy <= scene.top + scene.height;
  if (!THROTTLED) check(inScene, "payment: orb ends inside the house scene");
  const peak = Math.max(...during.map((s) => s.lightMax).filter((v) => v !== null));
  const final = samples.at(-1);
  if (!THROTTLED) {
    check(
      peak >= Math.max(frozenBefore ?? 0, final.lightMax) + LIGHT_RISE_MIN,
      `payment: window light flares above both the frozen and the live value (frozen ${fmt(frozenBefore)}, peak ${fmt(peak)}, live ${fmt(final.lightMax)})`,
    );
  }
  // The art stays in the DOM until the hold is released (after later queued Moments), so measure visibility.
  const visible = during.filter((s) => s.visibleParts.some((p) => PART_OWNER[p] === "payment"));
  const last = visible.at(-1) ?? during.at(-1);
  check(last.t <= PAYMENT_MAX_ON_SCREEN_MS, `payment: Moment art is gone by ${PAYMENT_MAX_ON_SCREEN_MS} ms (last visible at ${last.t} ms)`);
  const stable = samples.slice(-3).map((s) => s.lightMax);
  check(final.layerChildren === 0, `payment: Moment art removed at the end (children ${final.layerChildren} at ${final.t} ms)`);
  check(
    stable.every((v) => v !== null && Math.abs(v - stable[0]) < LIVE_EPSILON),
    `payment: window light settles on a steady live value (${fmt(final.lightMax)})`,
  );
  check(final.lightMax !== null && final.lightMax >= (frozenBefore ?? 0) - LIVE_EPSILON, "payment: live light is not below the frozen light after a payment");
}

async function runSigil(page) {
  await page.evaluate(installSampler, SAMPLE_MS, DRAWN_PART_SELECTORS);
  const coffee = await page.evaluateHandle(
    () =>
      [...document.querySelectorAll('[role="checkbox"], input[type="checkbox"]')].find((el) =>
        /coffee/i.test(el.closest("[data-plan-action]")?.textContent ?? ""),
      ) ?? null,
  );
  if (!coffee.asElement()) throw new Error("Cut Coffee action checkbox not found");
  await coffee.asElement().click();
  await sleep(MAX_MOMENT_MS);
  return { samples: await page.evaluate(() => window.__samples) };
}

function assertSigil({ samples }) {
  const during = samples.filter((s) => s.layerChildren > 0);
  check(during.length > 0, "sigil: Moment layer got children during the Moment");
  if (during.length === 0) return;
  const span = during.at(-1).t - during[0].t;
  const peakDrawn = Math.max(...during.map((s) => s.sigilDrawn ?? 0));
  const final = samples.at(-1);
  const bodyFinal = final.polterBodyOpacity;
  console.log(
    `sigil: on screen ${span} ms, peak stroke drawn ${fmt(peakDrawn)}, Poltergeist body opacity at end ${fmt(bodyFinal)}, state ${final.polterState}`,
  );
  check(span <= SIGIL_MAX_SPAN_MS, `sigil: Moment art is on screen for ${span} ms (max ${SIGIL_MAX_SPAN_MS})`);
  check(peakDrawn >= SIGIL_DRAWN_MIN, `sigil: ring stroke is fully drawn (peak ${fmt(peakDrawn)}, min ${SIGIL_DRAWN_MIN})`);
  check(final.layerChildren === 0, "sigil: Moment art removed at the end");
  check(final.polterState === "bound", `sigil: Poltergeist is still present and bound (${final.polterState})`);
  check(
    Math.abs(bodyFinal - SIGIL_BOUND_OPACITY) < LIVE_EPSILON,
    `sigil: Poltergeist body ends at the bound opacity (${fmt(bodyFinal)}, expected ${SIGIL_BOUND_OPACITY})`,
  );
}

async function runLevel(page) {
  await cancelWraithcast(page);
  await sleep(SETTLE_MS * 2);
  const coffee = await page.evaluateHandle(
    () =>
      [...document.querySelectorAll('[role="checkbox"], input[type="checkbox"]')].find((el) =>
        /coffee|small expenses/i.test(el.closest("[data-plan-action]")?.textContent ?? ""),
      ) ?? null,
  );
  if (!coffee.asElement()) throw new Error("Coffee action checkbox not found");
  await coffee.asElement().click();
  await sleep(SETTLE_MS * 2);
  await clickByText(page, "button", "Do it:");
  await hasButton(page, "Save payment");
  await sleep(600);
  await page.evaluate(installSampler, SAMPLE_MS, DRAWN_PART_SELECTORS);
  await clickByText(page, "button", "Save payment");
  await sleep(MAX_MOMENT_MS + 2000);
  return { samples: await page.evaluate(() => window.__samples) };
}

function assertLevel({ samples }) {
  const withIncoming = samples.filter((s) => s.incomingPresent);
  const t0 = withIncoming[0]?.t ?? null;
  console.log("level: t(ms)  dataLevel  incomingOpacity  oldDecayOpacity  oldCracks  incomingCracks  frontFog  bat  layerChildren");
  for (const s of samples.filter((x) => x.layerChildren > 0 || x.incomingPresent || x.t >= (t0 ?? 0) - 300)) {
    if (t0 !== null && s.t > t0 + 3000) break;
    console.log(
      `  ${String(s.t).padStart(5)}  L${s.level}  in=${fmt(s.incomingOpacity)}  oldDecay=${fmt(s.oldDecayOpacity)}  cracks ${s.oldCracks}/${s.incomingCracks}  fog=${fmt(s.frontFogOpacity)}  bat=${s.bat ? "y" : "-"}  children=${s.layerChildren}`,
    );
  }
  check(withIncoming.length > 0, "level: incoming-level layer was rendered during the Moment");
  const final = samples.at(-1);
  check(final.level === "3", `level: scene ends at level 3 (${final.level})`);
  check(!final.incomingPresent && final.layerChildren === 0, "level: incoming layer and Moment art removed at the end");
  const firstFade = withIncoming.find((s) => s.incomingOpacity > 0.05);
  const fullIn = withIncoming.find((s) => s.incomingOpacity >= 0.95);
  const levelChange = samples.find((s) => s.level === "3");
  if (t0 !== null) {
    console.log(
      `level: incoming present at ${t0}, starts fading at ${firstFade?.t ?? "-"}, fully in at ${fullIn?.t ?? "-"}, data-level 3 at ${levelChange?.t ?? "-"}`,
    );
    if (!THROTTLED) check(Boolean(firstFade) && Boolean(fullIn) && fullIn.t - firstFade.t >= 200, "level: house cross-fades old to new level (not a pop)");
    check(Boolean(firstFade) && firstFade.t - t0 >= 400, "level: old level features stay until the midpoint");
  }
}


const runExorcismComplete = (page) => runPlanFlow(page);

/** Level-4 flow: cancel Wraithcast, tick the coffee action, then the $300 payment completes 3 of 3 actions. */
async function runPlanFlow(page, { sampleFromStart = false } = {}) {
  if (sampleFromStart) await page.evaluate(installSampler, SAMPLE_MS, DRAWN_PART_SELECTORS);
  await cancelWraithcast(page);
  await sleep(SETTLE_MS * 2);
  const coffee = await page.evaluateHandle(
    () =>
      [...document.querySelectorAll('[role="checkbox"], input[type="checkbox"]')].find((el) =>
        /coffee|small expenses/i.test(el.closest("[data-plan-action]")?.textContent ?? ""),
      ) ?? null,
  );
  if (!coffee.asElement()) throw new Error("Coffee action checkbox not found");
  await coffee.asElement().click();
  await sleep(SETTLE_MS * 2);
  await clickByText(page, "button", "Do it:");
  await hasButton(page, "Save payment");
  await sleep(600);
  if (!sampleFromStart) await page.evaluate(installSampler, SAMPLE_MS, DRAWN_PART_SELECTORS);
  const saveClickT = await page.evaluate(() => performance.now());
  await clickByText(page, "button", "Save payment");
  await sleep(MAX_MOMENT_MS * 2 + 2000);
  const { samples, t0 } = await page.evaluate(() => ({ samples: window.__samples, t0: window.__samplerT0 }));
  return { samples, scene: await sceneRect(page), saveClickT: Math.round(saveClickT - t0) };
}

function assertExorcismComplete({ samples, scene }) {
  const during = samples.filter((s) => s.parts.includes("candle-flame"));
  check(during.length > 0, "exorcismComplete: candles appeared in the Moment layer");
  if (during.length === 0) return;
  const visibleCandles = during.filter((s) => s.visibleParts.includes("candle-flame") || s.visibleParts.includes("candle"));
  const span = (visibleCandles.at(-1) ?? during.at(-1)).t - during[0].t;
  check(span <= CANDLES_MAX_SPAN_MS, `exorcismComplete: candles are visible for ${span} ms (max ${CANDLES_MAX_SPAN_MS})`);
  const count = Math.max(...during.map((s) => s.candles.length));
  check(count === CANDLE_COUNT, `exorcismComplete: ${count} candles drawn (expected ${CANDLE_COUNT})`);
  // Wax (with its holder) and flame boxes of every candle, at every sample where they are drawn.
  const candleBoxes = (s) => [...s.candleWax, ...s.candles].map((c) => c.rect).filter(Boolean);
  const outside = during.flatMap((s) => candleBoxes(s).filter((r) => !insideRect(r, scene)));
  check(
    during.every((s) => candleBoxes(s).length === CANDLE_COUNT * 2) && outside.length === 0,
    `exorcismComplete: every candle and flame stays inside the scene (${outside.length} box(es) outside)`,
  );
  const hits = new Set();
  for (const s of during) {
    for (const box of candleBoxes(s)) for (const part of s.drawnParts) if (overlapPx(box, part.rect)) hits.add(part.name);
  }
  const partNames = new Set(during.flatMap((s) => s.drawnParts.map((p) => p.name)));
  check(partNames.has("moon") && partNames.has("poltergeist"), `exorcismComplete: moon and Poltergeist were measured (${[...partNames].join(", ")})`);
  check(hits.size === 0, `exorcismComplete: candles overlap no drawn scene part${hits.size ? ` (overlap: ${[...hits].join(", ")})` : ""}`);
  // First sample at which each flame is lit; the flames must light one after another, left to right.
  const litAt = Array.from({ length: CANDLE_COUNT }, (_, i) => during.find((s) => (s.candles[i]?.opacity ?? 0) > CANDLE_LIT)?.t ?? null);
  console.log(`exorcismComplete: flame ${litAt.map((t, i) => `#${i + 1} lit at ${t ?? "-"}`).join(", ")} ms`);
  if (!THROTTLED) check(litAt.every((t) => t !== null), "exorcismComplete: all three flames light");
  if (!THROTTLED) {
    const ordered = litAt.every((t, i) => i === 0 || (t !== null && litAt[i - 1] !== null && t - litAt[i - 1] >= CANDLE_ORDER_MIN_GAP_MS));
    check(ordered, "exorcismComplete: flames light one after another in order (staggered)");
    // Opacity rises in order at every sample: a later flame is never brighter than an earlier one.
    const monotone = during.every((s) => s.candles.every((c, i) => i === 0 || c.opacity <= s.candles[i - 1].opacity + LIVE_EPSILON));
    check(monotone, "exorcismComplete: flame opacity never rises ahead of the previous flame");
  } else {
    // With frames this far apart a step can fall between two frames (the Moment still ends on schedule),
    // so only the order is asserted: a flame never lights before the one on its left.
    const inOrder = litAt.every((t, i) => t === null || i === 0 || (litAt[i - 1] !== null && t >= litAt[i - 1]));
    check(inOrder, "exorcismComplete: flames never light out of order (slow frames)");
  }
  const final = samples.at(-1);
  check(final.layerChildren === 0 && final.candles.length === 0, "exorcismComplete: no candles left behind (Moment layer empty at the end)");
}

const MOMENT_ORDER = ["payment", "exorcismComplete", "level"];

async function runFullDemo(page) {
  return runPlanFlow(page, { sampleFromStart: true });
}

const ownersOf = (parts) => new Set(parts.map((p) => PART_OWNER[p]).filter(Boolean));

/**
 * Per Moment: start = first sample with its art in the layer (the art is rendered when the Moment starts),
 * end = last sample with that art visible (opacity > 0). The art stays in the DOM until the hold is
 * released (design D9), so DOM presence alone says nothing about when a Moment ended.
 * The level Moment also counts the incoming-level layer as its art.
 */
function momentSpans(samples, afterT) {
  const spans = new Map();
  const touch = (owner, t, visible) => {
    const span = spans.get(owner) ?? { start: t, end: null };
    if (visible) span.end = t;
    spans.set(owner, span);
  };
  for (const s of samples) {
    if (s.t < afterT) continue;
    for (const owner of ownersOf(s.parts)) touch(owner, s.t, false);
    for (const owner of ownersOf(s.visibleParts)) touch(owner, s.t, true);
    if (s.incomingPresent) touch("level", s.t, s.incomingOpacity < 0.98);
  }
  for (const span of spans.values()) span.end ??= span.start;
  return spans;
}

function assertFullDemo({ samples, saveClickT }) {
  // Only the Moments after the payment; cancel and sigil happened earlier.
  const spans = momentSpans(samples, saveClickT);
  const seen = [...spans.entries()].sort((a, b) => a[1].start - b[1].start);
  const order = seen.map(([name]) => name);
  console.log(`fullDemo: MOMENT_GAP_MS=${MOMENT_GAP_MS}, allowed ${MOMENT_GAP_MS - GAP_BELOW_MS}..${MOMENT_GAP_MS + GAP_ABOVE_MS} ms, sampler ${SAMPLE_MS} ms`);
  console.log("fullDemo: Moment            start(ms)   end(ms)   gap since previous end(ms)");
  let prevEnd = null;
  const gaps = [];
  for (const [name, span] of seen) {
    const gap = prevEnd === null ? null : span.start - prevEnd;
    if (gap !== null) gaps.push({ name, gap });
    console.log(`fullDemo: ${name.padEnd(17)} ${String(span.start).padStart(8)}  ${String(span.end).padStart(8)}   ${gap === null ? "-" : gap}`);
    prevEnd = span.end;
  }
  check(JSON.stringify(order) === JSON.stringify(MOMENT_ORDER), `fullDemo: order after the payment is ${MOMENT_ORDER.join(" -> ")} (${order.join(" -> ") || "none"})`);
  for (const { name, gap } of gaps) {
    check(
      gap >= MOMENT_GAP_MS - GAP_BELOW_MS && gap <= MOMENT_GAP_MS + GAP_ABOVE_MS,
      `fullDemo: gap before ${name} is ${gap} ms (MOMENT_GAP_MS ${MOMENT_GAP_MS}, allowed -${GAP_BELOW_MS}/+${GAP_ABOVE_MS})`,
    );
  }
  const overlapping = samples.filter((s) => s.t >= saveClickT && ownersOf(s.visibleParts).size > 1);
  check(overlapping.length === 0, `fullDemo: the Moment layer never shows two Moments at once (${overlapping.length} sample(s) with two)`);
  const final = samples.at(-1);
  check(final.layerChildren === 0, "fullDemo: Moment layer empty at the end");
  check(final.level === "3", `fullDemo: scene ends at level 3 (${final.level})`);
}

const CHECKBOX_FOCUS_SAMPLE_MS = 5;
const CHECKBOX_FOCUS_WINDOW_MS = 500;

/** Level 4: focus the "Cut Coffee" checkbox, press Space and sample focus and `disabled` every 5 ms. */
async function runCheckboxFocus(page) {
  const found = await page.evaluate(() => {
    const box = [...document.querySelectorAll('input[type="checkbox"]')].find((el) =>
      /coffee/i.test(el.closest("[data-plan-action]")?.textContent ?? ""),
    );
    if (!box) return false;
    window.__cb = box;
    box.focus();
    return document.activeElement === box;
  });
  if (!found) throw new Error("Cut Coffee checkbox not found or not focusable");
  await page.evaluate((sampleMs, windowMs) => {
    window.__focusSamples = [];
    const start = performance.now();
    const id = setInterval(() => {
      const box = window.__cb;
      window.__focusSamples.push({
        t: Math.round(performance.now() - start),
        focused: document.activeElement === box,
        disabled: box.disabled || box.hasAttribute("disabled"),
        connected: box.isConnected,
      });
      if (performance.now() - start >= windowMs) clearInterval(id);
    }, sampleMs);
  }, CHECKBOX_FOCUS_SAMPLE_MS, CHECKBOX_FOCUS_WINDOW_MS);
  await page.keyboard.press("Space");
  await sleep(CHECKBOX_FOCUS_WINDOW_MS + 100);
  return page.evaluate(() => ({
    samples: window.__focusSamples,
    checked: window.__cb.checked,
    endFocused: document.activeElement === window.__cb,
  }));
}

function assertCheckboxFocus({ samples, checked, endFocused }) {
  const disabledAt = samples.filter((s) => s.disabled);
  const blurredAt = samples.filter((s) => !s.focused);
  console.log(
    `checkboxFocus: ${samples.length} samples over ${samples.at(-1)?.t ?? 0} ms, disabled in ${disabledAt.length}, not focused in ${blurredAt.length}, checked ${checked}, focused at end ${endFocused}`,
  );
  check(samples.length >= 50, `checkboxFocus: sampled ${samples.length} times (min 50)`);
  check(disabledAt.length === 0, `checkboxFocus: the checkbox is never disabled (${disabledAt.length} sample(s), first at ${disabledAt[0]?.t ?? "-"} ms)`);
  check(blurredAt.length === 0, `checkboxFocus: the checkbox keeps focus at every sample (${blurredAt.length} sample(s) without, first at ${blurredAt[0]?.t ?? "-"} ms)`);
  check(endFocused, "checkboxFocus: the checkbox is the active element at the end");
  check(checked, "checkboxFocus: the checkbox ends checked");
}

const CANCEL_TOAST_TEXT = "+$120/mo saved · Light +5.2";
const WRAITHCAST_PATTERN = "wraithcast";
/** Reads the Wraithcast plan checkbox: whether the cancel dialog is open and whether the box is checked. */
const readWraithcastBox = (page) =>
  page.evaluate((pattern) => {
    const box = [...document.querySelectorAll('input[type="checkbox"]')].find((el) =>
      new RegExp(pattern, "i").test(el.closest("[data-plan-action]")?.textContent ?? ""),
    );
    const dialog = document.querySelector('[role="dialog"]');
    return { found: box !== undefined, checked: box?.checked ?? null, dialogOpen: dialog !== null, dialogText: dialog?.textContent ?? "" };
  }, WRAITHCAST_PATTERN);
/** Ticks the Wraithcast checkbox on the level-4 Dashboard: the cancel sheet opens, confirming plays the shovel Moment. */
async function runCheckboxCancel(page) {
  await page.evaluate(installSampler, SAMPLE_MS, DRAWN_PART_SELECTORS);
  const box = await page.evaluateHandle(
    (pattern) =>
      [...document.querySelectorAll('input[type="checkbox"]')].find((el) =>
        new RegExp(pattern, "i").test(el.closest("[data-plan-action]")?.textContent ?? ""),
      ) ?? null,
    WRAITHCAST_PATTERN,
  );
  if (!box.asElement()) throw new Error("Wraithcast checkbox not found");
  await box.asElement().click();
  await hasButton(page, "Cancel subscription");
  const whileOpen = await readWraithcastBox(page);
  await clickByText(page, "button", "Cancel subscription");
  // The toast lasts about 6 s; read it as soon as it shows, before the Moment ends.
  await waitFor(page, (text) => document.body.innerText.includes(text), CANCEL_TOAST_TEXT).catch(() => undefined);
  const toast = await page.evaluate(
    () => document.body.innerText.split("\n").find((line) => line.includes("/mo saved")) ?? "",
  );
  await sleep(MAX_MOMENT_MS);
  const labels = await page.evaluate(() =>
    [...document.querySelectorAll('[data-part="scene"] [data-part="tombstone-label"]')].map((el) => {
      const r = el.getBoundingClientRect();
      return { text: el.textContent ?? "", rect: { left: r.left, top: r.top, width: r.width, height: r.height } };
    }),
  );
  const after = await readWraithcastBox(page);
  return { samples: await page.evaluate(() => window.__samples), labels, scene: await sceneRect(page), whileOpen, toast, checkedAfter: after.checked };
}
function assertCheckboxCancel({ samples, labels, scene, whileOpen, toast, checkedAfter }) {
  check(whileOpen.dialogOpen, "checkboxCancel: ticking the checkbox opens a dialog");
  check(whileOpen.dialogText.includes("Cancel subscription"), "checkboxCancel: the dialog offers \"Cancel subscription\"");
  check(whileOpen.checked === false, `checkboxCancel: the checkbox is still unchecked while the dialog is open (${whileOpen.checked})`);
  assertShovel({ samples, labels, scene });
  check(checkedAfter === true, `checkboxCancel: the checkbox ends checked (${checkedAfter})`);
  check(toast.includes(CANCEL_TOAST_TEXT), `checkboxCancel: the toast reads "${CANCEL_TOAST_TEXT}" (${JSON.stringify(toast)})`);
}
const OVERFLOW_WIDTHS = [320, 768, 1280, 1920];
const OVERFLOW_HEIGHT = 640;
const OVERFLOW_NARROW_WIDTH = 320;
const OVERFLOW_SETTLE_MS = 400;

/** Dashboard in demo mode at several widths: measures the page width, the header and the TabBar. */
async function runNoHorizontalScroll(page) {
  const results = [];
  for (const width of OVERFLOW_WIDTHS) {
    await page.setViewport({ width, height: OVERFLOW_HEIGHT });
    await sleep(OVERFLOW_SETTLE_MS);
    results.push(
      await page.evaluate((viewportWidth) => {
        const root = document.documentElement;
        const box = (el) => {
          if (!el) return null;
          const r = el.getBoundingClientRect();
          return { width: r.width, right: r.right, scrollWidth: el.scrollWidth };
        };
        return {
          width: viewportWidth,
          scrollWidth: root.scrollWidth,
          clientWidth: root.clientWidth,
          header: box(document.querySelector("header")),
          tabBar: box(document.querySelector('nav[aria-label="Main"]')),
        };
      }, width),
    );
  }
  return { results };
}

function assertNoHorizontalScroll({ results }) {
  for (const r of results) {
    check(
      r.scrollWidth <= r.clientWidth,
      `noHorizontalScroll: at ${r.width} px the page does not scroll sideways (scrollWidth ${r.scrollWidth}, clientWidth ${r.clientWidth})`,
    );
    if (r.width !== OVERFLOW_NARROW_WIDTH) continue;
    const { header, tabBar } = r;
    console.log(
      `noHorizontalScroll: at ${r.width} px header width ${header ? header.width.toFixed(1) : "-"} (right edge ${header ? header.right.toFixed(1) : "-"}, content ${header ? header.scrollWidth : "-"}), TabBar width ${tabBar ? tabBar.width.toFixed(1) : "-"}`,
    );
    // The header box is clamped to the viewport; its content (scrollWidth) is what overflows.
    check(
      Boolean(header) && Math.max(header.right, header.scrollWidth) <= r.width,
      `noHorizontalScroll: at ${r.width} px the header's content fits the viewport`,
    );
    check(Boolean(tabBar) && Math.abs(tabBar.width - r.clientWidth) < 1, `noHorizontalScroll: at ${r.width} px the TabBar width equals the viewport width`);
  }
}

const TAB_LABEL_WIDTHS = [320, 375, 768, 1280, 1920];
const TAB_LABEL_MIN_GAP_PX = 4;
const TAB_LABEL_WIDTH_TOLERANCE_PX = 1;
const TAB_MIN_HEIGHT_PX = 44;
const TAB_COUNT = 5;

/** Measures every TabBar label (the text range, not the whole tab) at several widths. */
async function runTabBarLabels(page) {
  const results = [];
  for (const width of TAB_LABEL_WIDTHS) {
    await page.setViewport({ width, height: OVERFLOW_HEIGHT });
    await sleep(OVERFLOW_SETTLE_MS);
    results.push(
      await page.evaluate((viewportWidth) => {
        // The Sidebar also has aria-label "Main"; the TabBar is the fixed one.
        const nav = [...document.querySelectorAll('nav[aria-label="Main"]')].find((n) => getComputedStyle(n).position === "fixed");
        const shown = Boolean(nav) && getComputedStyle(nav).display !== "none" && nav.getBoundingClientRect().height > 0;
        const tabs = shown ? [...nav.querySelectorAll("a")] : [];
        return {
          width: viewportWidth,
          shown,
          tabs: tabs.map((a) => {
            const span = a.querySelector("span");
            const range = document.createRange();
            range.selectNodeContents(span);
            const text = range.getBoundingClientRect();
            const tab = a.getBoundingClientRect();
            return {
              label: span.textContent,
              left: text.left,
              right: text.right,
              tabWidth: tab.width,
              tabHeight: tab.height,
              scrollWidth: span.scrollWidth,
              clientWidth: span.clientWidth,
            };
          }),
        };
      }, width),
    );
  }
  return { results };
}

function assertTabBarLabels({ results }) {
  for (const r of results) {
    if (r.width >= 1024) {
      check(!r.shown, `tabBarLabels: at ${r.width} px the TabBar is hidden (Sidebar takes over)`);
      continue;
    }
    check(r.shown && r.tabs.length === TAB_COUNT, `tabBarLabels: at ${r.width} px the TabBar shows ${TAB_COUNT} tabs (${r.tabs.length})`);
    const gaps = r.tabs.slice(1).map((t, i) => t.left - r.tabs[i].right);
    const widths = r.tabs.map((t) => t.tabWidth);
    console.log(
      `tabBarLabels: at ${r.width} px gaps [${gaps.map((g) => g.toFixed(1)).join(", ")}], tab widths [${widths.map((w) => w.toFixed(1)).join(", ")}]`,
    );
    gaps.forEach((gap, i) =>
      check(
        gap >= TAB_LABEL_MIN_GAP_PX,
        `tabBarLabels: at ${r.width} px gap ${r.tabs[i].label} to ${r.tabs[i + 1].label} is ${gap.toFixed(1)} px (min ${TAB_LABEL_MIN_GAP_PX})`,
      ),
    );
    check(
      Math.max(...widths) - Math.min(...widths) <= TAB_LABEL_WIDTH_TOLERANCE_PX,
      `tabBarLabels: at ${r.width} px the tabs have equal widths (within ${TAB_LABEL_WIDTH_TOLERANCE_PX} px)`,
    );
    r.tabs.forEach((t) => {
      check(t.scrollWidth <= t.clientWidth, `tabBarLabels: at ${r.width} px "${t.label}" is fully visible (scrollWidth ${t.scrollWidth}, clientWidth ${t.clientWidth})`);
      check(t.tabHeight >= TAB_MIN_HEIGHT_PX, `tabBarLabels: at ${r.width} px the "${t.label}" tab is ${t.tabHeight} px high (min ${TAB_MIN_HEIGHT_PX})`);
    });
  }
}

// ---------------------------------------------------------------------------------------------
// action-feedback Moments: feed, ghostArrival, candleFlicker
// ---------------------------------------------------------------------------------------------
const FEED_MAX_SPAN_MS = 1700;
const FEED_PEAK_SHARE = 0.9; // peak scale must reach 1 + share * (FEED_SCALE - 1)
const FEED_REST_EPSILON = 0.002;
// Level 4 has the Poltergeist awake before and after the expense, so the toast says it feeds it.
const FEED_TOAST = "Ghost added: $8 · feeds the Poltergeist, doesn't dim the light";
const FEED_AMOUNT_CENTS = 800;
// Level 2 has no Poltergeist, so the toast names the amount that wakes it (requirement 2.6).
const ARRIVAL_TOAST_PATTERN = /Ghost added: \$3 · doesn't dim the light · (\$[\d,]+(?:\.\d+)?) more wakes the Poltergeist/;
const ARRIVAL_AMOUNT_CENTS = 300;
const WAKE_ROUNDING_MAX_CENTS = 1; // the page shows the rounded threshold, the toast the exact strict excess
const FLICKER_SAMPLE_MS = 10; // fast sampler for beats shorter than the 100 ms sampler
const ARRIVAL_HIDDEN_MAX = 0.05;
const ARRIVAL_SHOWN_MIN = 0.95;
const ARRIVAL_BEAT_MIN_MS = 300;
const ARRIVAL_NEAR_PX = 6;
const ARRIVAL_MAX_SPAN_MS = 2200;
const FLICKER_DIP_SLACK = 0.5; // dip must reach this share of the value before (ratio 0.35 plus slack)
const FLICKER_MAX_SPAN_MS = 2200;
const FLICKER_TOAST = "Action completed · Light +1.0";

const parseCents = (text) => {
  const match = /\$([\d,]+(?:\.\d+)?)/.exec(text ?? "");
  return match ? Math.round(Number(match[1].replace(/,/g, "")) * 100) : null;
};

/** Opens the Add expense sheet from the Dashboard QuickAction and types without clicking a field. */
async function typeExpense(page, amount, description) {
  await clickByText(page, "button", "Add expense");
  await waitFor(page, () => document.querySelector('[role="dialog"]') !== null);
  await sleep(500); // the sheet's open animation and its initial focus
  const focus = await page.evaluate(() => {
    const a = document.activeElement;
    return { tag: a?.tagName ?? null, label: a?.getAttribute("aria-label") ?? a?.id ?? "", inDialog: Boolean(a?.closest('[role="dialog"]')) };
  });
  await page.keyboard.type(amount);
  const amountValue = await page.evaluate(() => document.querySelector('[role="dialog"] input')?.value ?? null);
  await page.keyboard.press("Tab");
  await page.keyboard.type(description);
  const descriptionValue = await page.evaluate(() => document.activeElement?.value ?? null);
  await clickByText(page, "button", "Save expense");
  return { focus, amountValue, descriptionValue };
}

async function runFeed(page) {
  const bannerBefore = await page.evaluate(() => document.querySelector('[data-part="banner-amount"]')?.textContent ?? null);
  await page.evaluate(installSampler, SAMPLE_MS, DRAWN_PART_SELECTORS);
  const typed = await typeExpense(page, "8", "Latte");
  await sleep(MAX_MOMENT_MS);
  await waitFor(page, () => document.querySelector('[data-part="moment-layer"]')?.children.length === 0, null, 20000).catch(() => undefined);
  await sleep(SAMPLE_MS * 3);
  return { samples: await page.evaluate(() => window.__samples), typed, bannerBefore };
}

function assertFeed({ samples, typed, bannerBefore }) {
  // Task 1: the sheet's initial focus is the Amount field, so typing without a click reaches it.
  console.log(`feed: initial focus ${typed.focus.tag} "${typed.focus.label}", amount field "${typed.amountValue}", description "${typed.descriptionValue}"`);
  check(typed.focus.inDialog && typed.focus.tag === "INPUT", `feed: the Add expense sheet focuses an input on open (${typed.focus.tag} "${typed.focus.label}")`);
  check(typed.amountValue === "8", `feed: typing without a click fills Amount with "8" (${JSON.stringify(typed.amountValue)})`);
  check(typed.descriptionValue === "Latte", `feed: Tab then typing fills the description (${JSON.stringify(typed.descriptionValue)})`);
  const during = samples.filter((s) => s.parts.some((p) => PART_OWNER[p] === "poltergeistFeed"));
  check(during.length > 0, "feed: feed art appeared in the Moment layer");
  const scales = samples.map((s) => s.feedScale).filter((v) => v !== null);
  const peak = Math.max(...scales, 0);
  const need = 1 + FEED_PEAK_SHARE * (FEED_SCALE - 1);
  const final = samples.at(-1);
  const particles = samples.filter((s) => s.visibleParts.includes("feed-particle"));
  const visible = samples.filter((s) => s.visibleParts.some((p) => PART_OWNER[p] === "poltergeistFeed"));
  const span = visible.length ? visible.at(-1).t - during[0].t : 0;
  console.log(`feed: peak scale ${fmt(peak)} (need ${fmt(need)}), end scale ${fmt(final.feedScale)}, particles visible in ${particles.length} sample(s), art span ${span} ms`);
  if (!THROTTLED) check(peak >= need, `feed: peak swell scale ${fmt(peak)} reaches ${fmt(need)}`);
  check(Math.abs((final.feedScale ?? 1) - 1) <= FEED_REST_EPSILON, `feed: scale is back to 1 at the end (${fmt(final.feedScale)})`);
  if (!THROTTLED) check(particles.length > 0, "feed: particles were visible");
  check(span <= FEED_MAX_SPAN_MS, `feed: art on screen for ${span} ms (max ${FEED_MAX_SPAN_MS})`);
  check(final.layerChildren === 0, "feed: Moment layer empty at the end");
  check(final.polterState !== null, `feed: Poltergeist still present (${final.polterState})`);
  const before = parseCents(bannerBefore);
  const after = parseCents(final.bannerAmount);
  check(before !== null && after === before + FEED_AMOUNT_CENTS, `feed: banner amount ${bannerBefore} -> ${final.bannerAmount} (+$8)`);
  const toast = samples.find((s) => s.toastText.includes(FEED_TOAST));
  check(Boolean(toast), `feed: toast reads "${FEED_TOAST}"`);
  check(Boolean(toast) && toast.toastView.includes("View in Transactions"), `feed: toast has "View in Transactions" (${toast?.toastView.join(", ") ?? "-"})`);
}

async function loadLevel(page, level) {
  await clickByText(page, '[role="radio"]', `Level ${level}`);
  await waitFor(page, (n) => document.querySelector(`[data-part="scene"][data-level="${n}"]`) !== null, String(level));
  await sleep(SETTLE_MS);
}

async function runGhostArrival(page) {
  await loadLevel(page, 2);
  await page.evaluate(installSampler, SAMPLE_MS, DRAWN_PART_SELECTORS);
  // Fast sampler for the arrival art's opacity: the first beats are shorter than two 100 ms samples.
  await page.evaluate((everyMs) => {
    window.__arrivalOpacity = [];
    setInterval(() => {
      const art = document.querySelector('[data-part="moment-layer"] [data-moment="ghost-arrival"]');
      if (art) window.__arrivalOpacity.push(Number(getComputedStyle(art).opacity));
    }, everyMs);
  }, FLICKER_SAMPLE_MS);
  // The art's opacity at the moment its node enters the Moment layer, read in the same MutationObserver
  // callback. The 10 ms sampler above can land a frame after the fade starts, so it cannot prove this.
  await page.evaluate(() => {
    window.__arrivalAddedOpacity = [];
    const layer = document.querySelector('[data-part="moment-layer"]');
    const selector = '[data-moment="ghost-arrival"]';
    const seen = new WeakSet(); // the container and its child are both added nodes holding the same art
    new MutationObserver((records) => {
      for (const record of records) {
        for (const node of record.addedNodes) {
          if (!(node instanceof Element)) continue;
          const arts = node.matches(selector) ? [node] : [...node.querySelectorAll(selector)];
          for (const art of arts) {
            if (seen.has(art)) continue;
            seen.add(art);
            window.__arrivalAddedOpacity.push(Number(getComputedStyle(art).opacity));
          }
        }
      }
    }).observe(layer, { childList: true, subtree: true });
  });
  await typeExpense(page, "3", "Gum");
  await sleep(MAX_MOMENT_MS);
  await waitFor(page, () => document.querySelector('[data-part="moment-layer"]')?.children.length === 0, null, 20000).catch(() => undefined);
  await sleep(SAMPLE_MS * 3);
  const samples = await page.evaluate(() => window.__samples);
  const fastOpacity = await page.evaluate(() => window.__arrivalOpacity);
  const addedOpacity = await page.evaluate(() => window.__arrivalAddedOpacity);
  return { samples, fastOpacity, addedOpacity, transactionsPage: await readTransactionsSummary(page) };
}
/** Opens Transactions through the visible Main nav link and reads the page's total and threshold. */
async function readTransactionsSummary(page) {
  await page.evaluate(() => {
    const link = [...document.querySelectorAll('nav[aria-label="Main"] a')].find(
      (a) => (a.getAttribute("aria-label") ?? a.textContent ?? "").includes("Transactions") && a.getBoundingClientRect().width > 0,
    );
    link?.click();
  });
  await waitFor(page, () => [...document.querySelectorAll("p")].some((p) => p.textContent?.startsWith("Poltergeist threshold:")));
  return page.evaluate(() => {
    const paragraphs = [...document.querySelectorAll("p")];
    const label = paragraphs.find((p) => p.textContent?.trim() === "Small expenses, last 30 days");
    return {
      total: label?.nextElementSibling?.textContent ?? null,
      threshold: paragraphs.find((p) => p.textContent?.startsWith("Poltergeist threshold:"))?.textContent ?? null,
    };
  });
}

function assertGhostArrival({ samples, fastOpacity, addedOpacity, transactionsPage }) {
  const toast = samples.map((s) => s.toastText).find((t) => ARRIVAL_TOAST_PATTERN.test(t));
  check(Boolean(toast), `ghostArrival: toast names what wakes the Poltergeist (${samples.map((s) => s.toastText).find((t) => t.includes("Ghost added")) ?? "none"})`);
  check(!samples.some((s) => /feeds the Poltergeist|woke the Poltergeist/.test(s.toastText)), "ghostArrival: toast never says it feeds or woke a Poltergeist that is not there");
  const wakes = toast ? parseCents(ARRIVAL_TOAST_PATTERN.exec(toast)[1]) : null;
  const total = parseCents(transactionsPage.total);
  const threshold = parseCents(transactionsPage.threshold);
  console.log(`ghostArrival: toast wake amount ${wakes} c, Transactions page total ${transactionsPage.total}, ${transactionsPage.threshold}`);
  check(total !== null && threshold !== null && total >= ARRIVAL_AMOUNT_CENTS, `ghostArrival: the page total ${transactionsPage.total} includes the $3 expense`);
  if (wakes !== null && total !== null && threshold !== null) {
    const gap = wakes - (threshold - total);
    check(gap >= 0 && gap <= WAKE_ROUNDING_MAX_CENTS, `ghostArrival: toast amount ${wakes} c is the page threshold minus total (${threshold - total} c) plus ${gap} c`);
  }
  const initial = new Set(samples[0].ghostIds);
  const during = samples.filter((s) => s.parts.some((p) => PART_OWNER[p] === "ghostArrival"));
  check(during.length > 0, "ghostArrival: arrival art appeared in the Moment layer");
  const arrivals = samples.filter((s) => s.arrival);
  const minOpacity = fastOpacity.length ? Math.min(...fastOpacity) : null;
  const addedAt = addedOpacity.length ? addedOpacity[0] : null;
  const shown = arrivals.filter((s) => s.arrivalOpacity >= ARRIVAL_SHOWN_MIN);
  const beat = shown.length ? shown.at(-1).t - shown[0].t + SAMPLE_MS : 0;
  const visible = samples.filter((s) => s.visibleParts.some((p) => PART_OWNER[p] === "ghostArrival"));
  const span = visible.length && during.length ? visible.at(-1).t - during[0].t : 0;
  console.log(`ghostArrival: art opacity when added ${fmt(addedAt)} (${addedOpacity.length} node(s)), sampled min ${fmt(minOpacity)}, max ${fmt(Math.max(...arrivals.map((s) => s.arrivalOpacity), 0))}, full-opacity beat ${beat} ms, art span ${span} ms`);
  if (!THROTTLED) {
    check(addedAt !== null && addedAt <= ARRIVAL_HIDDEN_MAX, `ghostArrival: art starts hidden (opacity ${fmt(addedAt)} when added to the Moment layer)`);
    check(shown.length > 0, "ghostArrival: art reaches full opacity");
    check(beat >= ARRIVAL_BEAT_MIN_MS, `ghostArrival: art stays fully visible ${beat} ms (min ${ARRIVAL_BEAT_MIN_MS})`);
  }
  check(span <= ARRIVAL_MAX_SPAN_MS, `ghostArrival: art on screen for ${span} ms (max ${ARRIVAL_MAX_SPAN_MS})`);
  const final = samples.at(-1);
  const fresh = final.ghostIds.filter((id) => !initial.has(id));
  check(fresh.length === 1, `ghostArrival: exactly one new drawn ghost after the release (${fresh.length})`);
  check(final.layerChildren === 0, "ghostArrival: Moment layer empty at the end");
  const lastShown = (shown.length ? shown : arrivals.filter((s) => s.arrivalOpacity > ARRIVAL_HIDDEN_MAX)).at(-1);
  if (fresh.length === 1 && lastShown) {
    const ghost = final.ghostRects[fresh[0]];
    const distance = Math.hypot(ghost.cx - lastShown.arrival.cx, ghost.cy - lastShown.arrival.cy);
    console.log(`ghostArrival: real ghost center vs art's last visible center: ${distance.toFixed(1)} px`);
    check(distance <= ARRIVAL_NEAR_PX, `ghostArrival: the new ghost lands ${distance.toFixed(1)} px from the art (max ${ARRIVAL_NEAR_PX})`);
  } else if (!THROTTLED) {
    check(false, "ghostArrival: art had a visible rect to compare with the new ghost");
  }
}

async function runCandleFlicker(page) {
  await loadLevel(page, 1);
  await page.evaluate(installSampler, SAMPLE_MS, DRAWN_PART_SELECTORS);
  // Fast sampler: the dip lasts 100 ms, which the 100 ms sampler can step over.
  await page.evaluate((everyMs) => {
    window.__light = [];
    const t0 = performance.now();
    setInterval(() => {
      const lit = [...document.querySelectorAll('[data-part="scene"] [data-state="lit"] [data-part="light"]')];
      window.__light.push({ t: Math.round(performance.now() - t0), max: lit.length ? Math.max(...lit.map((w) => Number(getComputedStyle(w).opacity))) : null });
    }, everyMs);
  }, FLICKER_SAMPLE_MS);
  await sleep(300);
  const box = await page.evaluateHandle(
    () => [...document.querySelectorAll('input[type="checkbox"]')].find((el) => /emergency/i.test(el.closest("[data-plan-action]")?.textContent ?? "")) ?? null,
  );
  if (!box.asElement()) throw new Error("Emergency fund checkbox not found");
  const tickT = await page.evaluate(() => performance.now());
  await box.asElement().click();
  await sleep(MAX_MOMENT_MS);
  await waitFor(page, () => document.querySelector('[data-part="moment-layer"]')?.children.length === 0, null, 20000).catch(() => undefined);
  await sleep(SAMPLE_MS * 3);
  return { samples: await page.evaluate(() => window.__samples), light: await page.evaluate(() => window.__light), tickT: Math.round(tickT) };
}

function assertCandleFlicker({ samples, light }) {
  const values = light.map((l) => l.max).filter((v) => v !== null);
  const before = values[0];
  // The live value after the tick is the last one; the dip is the minimum below the value just before the Moment.
  const final = values.at(-1);
  const dip = Math.min(...values);
  const during = samples.filter((s) => s.parts.some((p) => PART_OWNER[p] === "candleFlicker"));
  console.log(`candleFlicker: light trace (t ms:max) ${light.filter((_, i) => i % 5 === 0).slice(0, 80).map((l) => `${l.t}:${fmt(l.max).trim()}`).join(" ")}`);
  console.log(`candleFlicker: light before ${fmt(before)}, min ${fmt(dip)}, final ${fmt(final)}, flicker art in ${during.length} sample(s)`);
  if (!THROTTLED) check(dip <= before * FLICKER_DIP_SLACK, `candleFlicker: light dips to ${fmt(dip)} (<= ${fmt(before * FLICKER_DIP_SLACK)}, ratio ${FLICKER_DIP_RATIO})`);
  const tail = values.slice(-30);
  check(tail.every((v) => Math.abs(v - tail[0]) < LIVE_EPSILON), `candleFlicker: light settles on a steady value (${fmt(final)})`);
  check(final >= before - LIVE_EPSILON, `candleFlicker: settled light ${fmt(final)} is not below the value before ${fmt(before)}`);
  const last = samples.at(-1);
  check(last.layerChildren === 0, "candleFlicker: Moment layer empty at the end");
  const visible = samples.filter((s) => s.visibleParts.some((p) => PART_OWNER[p] === "candleFlicker"));
  const span = visible.length && during.length ? visible.at(-1).t - during[0].t : 0;
  check(span <= FLICKER_MAX_SPAN_MS, `candleFlicker: art on screen for ${span} ms (max ${FLICKER_MAX_SPAN_MS})`);
  const toast = samples.find((s) => s.toastText.includes(FLICKER_TOAST));
  check(Boolean(toast), `candleFlicker: toast reads "${FLICKER_TOAST}" (${samples.map((s) => s.toastText).find((t) => t.includes("Light")) ?? "none"})`);
}

/** Level 4 at 1280 by 720: Guide shown (Scene and Guide_Step fit), then dismissed (Scene, plan heading and actions fit). */
const measureGuideLayout = (page) =>
  page.evaluate((title) => {
    const bottomOf = (el) => (el ? el.getBoundingClientRect().bottom : null);
    const heading = [...document.querySelectorAll("h2")].find((h) => (h.textContent ?? "").trim() === title) ?? null;
    const card = heading?.closest("section, div[class*='rounded']") ?? null;
    const stepEl = card ? [...card.querySelectorAll("p")].find((p) => p.querySelector("svg")) ?? null : null;
    const plan = document.querySelector("#exorcism-plan-heading");
    const actions = [...document.querySelectorAll("[data-plan-action]")];
    return {
      viewportHeight: window.innerHeight,
      sceneBottom: bottomOf(document.querySelector('[data-part="scene"]')),
      stepBottom: bottomOf(stepEl),
      stepText: stepEl?.textContent ?? null,
      planHeadingBottom: bottomOf(plan),
      actionBottoms: actions.map(bottomOf),
    };
  }, GUIDE_TITLE);

const SHOW_ME_LABEL = "Show me: Cancel Wraithcast";
const DO_IT_LABEL = "Do it: Cancel Wraithcast";
const SCROLL_STABLE_MS = 300;
const SCROLL_TIMEOUT_MS = 4000;
const SHOW_ME_MIN_TARGET_PX = 44;
/** Clicks "Show me" below the fold, waits for the (smooth) scroll to stop, and reports where the Do it button ended up. */
async function runShowMe(page) {
  const before = await page.evaluate((label) => {
    const doIt = document.querySelector(`button[aria-label^="${label}"]`);
    const showMe = [...document.querySelectorAll("button")].find((b) => (b.getAttribute("aria-label") ?? "").startsWith("Show me"));
    return {
      doItTopBefore: doIt ? doIt.getBoundingClientRect().top : null,
      showMeName: showMe?.getAttribute("aria-label") ?? null,
      showMeHeight: showMe ? showMe.getBoundingClientRect().height : null,
    };
  }, DO_IT_LABEL);
  await clickByText(page, "button", SHOW_ME_LABEL);
  let last = -1;
  let stableSince = Date.now();
  const startedAt = Date.now();
  while (Date.now() - startedAt < SCROLL_TIMEOUT_MS) {
    const y = await page.evaluate(() => window.scrollY);
    if (y !== last) {
      last = y;
      stableSince = Date.now();
    } else if (Date.now() - stableSince >= SCROLL_STABLE_MS) break;
    await sleep(50);
  }
  const after = await page.evaluate((label) => {
    const doIt = document.querySelector(`button[aria-label^="${label}"]`);
    const rect = doIt ? doIt.getBoundingClientRect() : null;
    return {
      top: rect ? rect.top : null,
      bottom: rect ? rect.bottom : null,
      left: rect ? rect.left : null,
      right: rect ? rect.right : null,
      width: window.innerWidth,
      height: window.innerHeight,
      focused: document.activeElement === doIt,
      activeLabel: document.activeElement?.getAttribute("aria-label") ?? document.activeElement?.tagName ?? null,
    };
  }, DO_IT_LABEL);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await sleep(OVERFLOW_SETTLE_MS_GUIDE);
  return { ...before, ...after };
}
async function runGuide(page) {
  await page.setViewport(GUIDE_VIEWPORT);
  await sleep(OVERFLOW_SETTLE_MS_GUIDE);
  const shown = await measureGuideLayout(page);
  const showMe = await runShowMe(page);
  await clickByText(page, "button", GUIDE_GOT_IT);
  await waitFor(page, (title) => ![...document.querySelectorAll("h2")].some((h) => (h.textContent ?? "").trim() === title), GUIDE_TITLE);
  await sleep(OVERFLOW_SETTLE_MS_GUIDE);
  const dismissed = await measureGuideLayout(page);
  return { shown, dismissed, showMe };
}
const OVERFLOW_SETTLE_MS_GUIDE = 500;
const GUIDE_PLAN_ACTION_COUNT = 3;

function assertGuide({ shown, dismissed, showMe }) {
  const vh = GUIDE_VIEWPORT.height;
  check(showMe.showMeName === SHOW_ME_LABEL, `guide: the Show me Button is named "${SHOW_ME_LABEL}" (${showMe.showMeName})`);
  check(showMe.showMeHeight !== null && showMe.showMeHeight >= SHOW_ME_MIN_TARGET_PX, `guide: Show me is at least ${SHOW_ME_MIN_TARGET_PX}px tall (${fmt(showMe.showMeHeight)} px)`);
  check(showMe.doItTopBefore !== null && showMe.doItTopBefore > vh, `guide: before Show me the Do it button is below the fold (top ${fmt(showMe.doItTopBefore)} of ${vh} px)`);
  check(
    showMe.top !== null && showMe.top >= 0 && showMe.bottom <= showMe.height && showMe.left >= 0 && showMe.right <= showMe.width,
    `guide: after Show me the Do it button is fully in the viewport (top ${fmt(showMe.top)}, bottom ${fmt(showMe.bottom)} of ${showMe.height} px)`,
  );
  check(showMe.focused, `guide: after Show me the Do it button has focus (active: ${showMe.activeLabel})`);
  check(shown.sceneBottom !== null && shown.sceneBottom <= vh, `guide: with the Guide shown the whole Scene fits (bottom ${fmt(shown.sceneBottom)} of ${vh} px)`);
  check(shown.stepBottom !== null && shown.stepBottom <= vh, `guide: the Guide_Step fits (bottom ${fmt(shown.stepBottom)} of ${vh} px, "${shown.stepText}")`);
  check(
    Boolean(shown.stepText) && shown.stepText.includes("Cancel Wraithcast"),
    `guide: the Guide_Step names Cancel Wraithcast ("${shown.stepText}")`,
  );
  check(dismissed.sceneBottom !== null && dismissed.sceneBottom <= vh, `guide: after "Got it" the whole Scene fits (bottom ${fmt(dismissed.sceneBottom)} of ${vh} px)`);
  check(dismissed.planHeadingBottom !== null && dismissed.planHeadingBottom <= vh, `guide: after "Got it" the plan heading fits (bottom ${fmt(dismissed.planHeadingBottom)} of ${vh} px)`);
  check(
    dismissed.actionBottoms.length === GUIDE_PLAN_ACTION_COUNT && dismissed.actionBottoms.every((b) => b <= vh),
    `guide: after "Got it" the three plan actions fit (bottoms ${dismissed.actionBottoms.map(fmt).join(", ")} of ${vh} px)`,
  );
}

const LANDING_VIEWPORTS = [
  { width: 1280, height: 720 },
  { width: 375, height: 667 },
];
const LANDING_DEMO_LABEL = "Enter the demo crypt";
const LANDING_PREVIEW_PREFIX = "Preview of the demo house:";
const LANDING_PITCH_START = "Your money habits haunt your house";
const LANDING_SETTLE_MS = 500;
const DEMO_MODE_KEY = "cashcrypt:mode";
/** Measures the Landing (clean storage) and enters the demo from it. */
async function measureLanding(page, viewport) {
  await page.setViewport(viewport);
  await page.goto(BASE_URL, { waitUntil: "networkidle0" });
  await sleep(LANDING_SETTLE_MS);
  const layout = await page.evaluate(
    (demoLabel, previewPrefix, pitchStart) => {
      const box = (el) => {
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
      };
      const root = document.documentElement;
      const buttons = [...document.querySelectorAll("main button")];
      return {
        scrollY: window.scrollY,
        innerWidth: window.innerWidth,
        innerHeight: window.innerHeight,
        scrollWidth: root.scrollWidth,
        clientWidth: root.clientWidth,
        storedMode: localStorage.getItem("cashcrypt:mode"),
        preview: box(
          [...document.querySelectorAll('[role="img"]')].find((el) => (el.getAttribute("aria-label") ?? "").startsWith(previewPrefix)) ?? null,
        ),
        h1: box(document.querySelector("h1")),
        pitch: box([...document.querySelectorAll("main p")].find((el) => (el.textContent ?? "").startsWith(pitchStart)) ?? null),
        demoButton: box(buttons.find((b) => (b.textContent ?? "").trim() === demoLabel) ?? null),
        secondButton: box(buttons.find((b) => /^(Start my own crypt|Continue to my crypt)$/.test((b.textContent ?? "").trim())) ?? null),
      };
    },
    LANDING_DEMO_LABEL,
    LANDING_PREVIEW_PREFIX,
    LANDING_PITCH_START,
  );
  await clickByText(page, "button", LANDING_DEMO_LABEL);
  let reached = true;
  try {
    await waitFor(
      page,
      ({ key, title, label }) =>
        localStorage.getItem(key) === "demo" &&
        [...document.querySelectorAll("h2")].some((h) => (h.textContent ?? "").trim() === title) &&
        ![...document.querySelectorAll("button")].some((b) => (b.textContent ?? "").trim() === label),
      { key: DEMO_MODE_KEY, title: GUIDE_TITLE, label: LANDING_DEMO_LABEL },
    );
  } catch {
    reached = false;
  }
  const after = await page.evaluate((key) => ({
    path: location.pathname,
    storedMode: localStorage.getItem(key),
    demoChip: [...document.querySelectorAll("[title]")].some((el) => (el.getAttribute("title") ?? "").startsWith("Demo mode")),
    planHeading: [...document.querySelectorAll("h2")].some((h) => /exorcism/i.test(h.textContent ?? "")),
  }), DEMO_MODE_KEY);
  const guide = await guideShown(page);
  const clipboard = await page.evaluate(() => window.__clipboardCalls ?? []);
  return { viewport, layout, reached, after: { ...after, guide }, clipboard };
}
/** Each size runs in its own fresh context, so both start with clean storage. */
async function runLanding(page) {
  const results = [await measureLanding(page, LANDING_VIEWPORTS[0])];
  for (const viewport of LANDING_VIEWPORTS.slice(1)) {
    const context = await page.browser().createBrowserContext();
    try {
      const fresh = await context.newPage();
      await fresh.evaluateOnNewDocument(installPageHooks, RAF_THROTTLE_MS);
      fresh.on("pageerror", (error) => console.log("pageerror:", error.message));
      results.push(await measureLanding(fresh, viewport));
    } finally {
      await context.close();
    }
  }
  return { results };
}
function assertLanding({ results }) {
  for (const { viewport, layout, reached, after, clipboard } of results) {
    const size = `${viewport.width}x${viewport.height}`;
    const inView = (b) =>
      Boolean(b) && b.left >= -OVERLAP_SLACK_PX && b.top >= -OVERLAP_SLACK_PX && b.right <= layout.innerWidth + OVERLAP_SLACK_PX && b.bottom <= layout.innerHeight + OVERLAP_SLACK_PX;
    const where = (b) => (b ? `top ${fmt(b.top)}, bottom ${fmt(b.bottom)}, left ${fmt(b.left)}, right ${fmt(b.right)}` : "missing");
    check(layout.storedMode === null, `landing ${size}: starts with clean storage (mode ${layout.storedMode})`);
    check(layout.scrollY === 0, `landing ${size}: the page is not scrolled (scrollY ${layout.scrollY})`);
    check(inView(layout.preview), `landing ${size}: the preview role="img" is fully in the first viewport (${where(layout.preview)} of ${viewport.height} px)`);
    check(inView(layout.h1), `landing ${size}: the h1 is fully in the first viewport (${where(layout.h1)})`);
    check(inView(layout.pitch), `landing ${size}: the pitch is fully in the first viewport (${where(layout.pitch)})`);
    check(inView(layout.demoButton), `landing ${size}: "${LANDING_DEMO_LABEL}" is fully in the first viewport (${where(layout.demoButton)})`);
    check(inView(layout.secondButton), `landing ${size}: the second Button is fully in the first viewport (${where(layout.secondButton)})`);
    check(
      layout.scrollWidth <= layout.clientWidth,
      `landing ${size}: no horizontal scroll (scrollWidth ${layout.scrollWidth}, clientWidth ${layout.clientWidth})`,
    );
    check(reached, `landing ${size}: clicking "${LANDING_DEMO_LABEL}" reaches the Dashboard`);
    check(after.storedMode === "demo" && after.demoChip, `landing ${size}: the Dashboard is in demo mode (stored ${after.storedMode}, demo chip ${after.demoChip}, path ${after.path})`);
    check(after.guide, `landing ${size}: the Guide "${GUIDE_TITLE}" is shown`);
    check(clipboard.length === 0, `landing ${size}: nothing wrote to the clipboard`);
  }
}
const MOMENT_CHECKS = [
  { name: "shovel", run: runShovel, assert: assertShovel },
  { name: "payment", run: runPayment, assert: assertPayment },
  { name: "sigil", run: runSigil, assert: assertSigil },
  { name: "level", run: runLevel, assert: assertLevel },
  { name: "exorcismComplete", run: runExorcismComplete, assert: assertExorcismComplete },
  { name: "fullDemo", run: runFullDemo, assert: assertFullDemo },
  { name: "checkboxFocus", run: runCheckboxFocus, assert: assertCheckboxFocus },
  { name: "checkboxCancel", run: runCheckboxCancel, assert: assertCheckboxCancel },
  { name: "noHorizontalScroll", run: runNoHorizontalScroll, assert: assertNoHorizontalScroll },
  { name: "tabBarLabels", run: runTabBarLabels, assert: assertTabBarLabels },
  { name: "feed", run: runFeed, assert: assertFeed },
  { name: "ghostArrival", run: runGhostArrival, assert: assertGhostArrival },
  { name: "candleFlicker", run: runCandleFlicker, assert: assertCandleFlicker },
  { name: "guide", run: runGuide, assert: assertGuide, keepGuide: true },
  { name: "landing", run: runLanding, assert: assertLanding, startsOnLanding: true },
];

// ---------------------------------------------------------------------------------------------

const selected = ONLY.length ? MOMENT_CHECKS.filter((c) => ONLY.includes(c.name)) : MOMENT_CHECKS;
if (selected.length === 0) throw new Error(`No check matches MOMENTS=${process.env.MOMENTS}`);
const puppeteer = loadPuppeteer();
if (!existsSync(CHROME_PATH)) throw new Error(`Chrome not found at ${CHROME_PATH}`);
console.log(`Running: ${selected.map((c) => c.name).join(", ")} (RAF_THROTTLE_MS=${RAF_THROTTLE_MS}, viewport ${VW}x${VH})`);

const browser = await puppeteer.launch({ executablePath: CHROME_PATH, headless: true, defaultViewport: VIEWPORT });
try {
  for (const moment of selected) {
    console.log(`\n== ${moment.name} ==`);
    const context = await (browser.createBrowserContext ?? browser.createIncognitoBrowserContext).call(browser);
    try {
      const page = await context.newPage();
      await page.setViewport(VIEWPORT);
      await page.evaluateOnNewDocument(installPageHooks, RAF_THROTTLE_MS);
      page.on("pageerror", (error) => console.log("pageerror:", error.message));
      if (!moment.startsOnLanding) await openDemo(page, { keepGuide: Boolean(moment.keepGuide) });
      const data = await moment.run(page);
      moment.assert(data);
      const calls = await page.evaluate(() => window.__clipboardCalls);
      check(calls.length === 0, `${moment.name}: nothing wrote to the clipboard${calls.length ? ` (${calls.join(", ")})` : ""}`);
    } catch (error) {
      check(false, `${moment.name}: check crashed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
}

if (failures.length > 0) {
  console.log(`\n${failures.length} check(s) failed`);
  process.exitCode = 1;
} else {
  console.log("\nAll checks passed");
}
