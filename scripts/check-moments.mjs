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
// Each check runs in a fresh browser context (empty IndexedDB) and loads the demo crypt at level 4.
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

/** Which Moment owns each art part in the Moment layer. */
const PART_OWNER = {
  shovel: "cancel", "name-label": "cancel", "tombstone-clip": "cancel", tombstone: "cancel", "dirt-puff": "cancel",
  flame: "payment", orb: "payment", "crack-flash": "payment",
  sigil: "sigil", "sigil-flash": "sigil",
  candle: "exorcismComplete", "candle-flame": "exorcismComplete",
  bat: "level", "creak-crack": "level", shutter: "level",
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
function installSampler(sampleMs) {
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
    });
  }, sampleMs);
}

async function openDemo(page) {
  await page.goto(BASE_URL, { waitUntil: "networkidle0" });
  await clickByText(page, "button", "Enter the demo crypt");
  await waitFor(page, () => document.querySelector('[data-part="scene"][data-level="4"]') !== null);
  await sleep(1500);
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
  await page.evaluate(installSampler, SAMPLE_MS);
  await cancelWraithcast(page);
  await sleep(MAX_MOMENT_MS);
  return { samples: await page.evaluate(() => window.__samples) };
}

function assertShovel({ samples }) {
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
  await page.evaluate(installSampler, SAMPLE_MS);
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
        Math.abs(firstFlame.flame.cx - saveRect.left) <= FLAME_NEAR_PX + saveRect.width / 2 &&
        Math.abs(firstFlame.flame.cy - saveRect.cy) <= FLAME_NEAR_PX,
      `payment: flame starts near the Save payment button (${firstFlame ? `${firstFlame.flame.cx.toFixed(0)},${firstFlame.flame.cy.toFixed(0)}` : "no flame"})`,
    );
  }
  const orbPoints = during.filter((s) => s.orb && s.orbOpacity > 0.05).map((s) => s.orb);
  const from = THROTTLED ? { cx: saveRect.left, cy: saveRect.cy } : orbPoints[0];
  const travel = orbPoints.length > 0 && from ? Math.max(...orbPoints.map((p) => Math.hypot(p.cx - from.cx, p.cy - from.cy))) : 0;
  check(travel >= ORB_MIN_TRAVEL_PX, `payment: orb travels ${travel.toFixed(0)} px away from its start (min ${ORB_MIN_TRAVEL_PX})`);
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
  await page.evaluate(installSampler, SAMPLE_MS);
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
  await page.evaluate(installSampler, SAMPLE_MS);
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
  if (sampleFromStart) await page.evaluate(installSampler, SAMPLE_MS);
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
  if (!sampleFromStart) await page.evaluate(installSampler, SAMPLE_MS);
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
  const first = during[0].candles.map((c) => c.rect).filter(Boolean);
  const inUpperScene =
    first.length === CANDLE_COUNT &&
    first.every(
      (r) => r.cx >= scene.left && r.cx <= scene.left + scene.width && r.cy >= scene.top && r.cy <= scene.top + scene.height / 2,
    );
  check(inUpperScene, "exorcismComplete: candles sit in the upper half of the scene");
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

const MOMENT_CHECKS = [
  { name: "shovel", run: runShovel, assert: assertShovel },
  { name: "payment", run: runPayment, assert: assertPayment },
  { name: "sigil", run: runSigil, assert: assertSigil },
  { name: "level", run: runLevel, assert: assertLevel },
  { name: "exorcismComplete", run: runExorcismComplete, assert: assertExorcismComplete },
  { name: "fullDemo", run: runFullDemo, assert: assertFullDemo },
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
      await openDemo(page);
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
