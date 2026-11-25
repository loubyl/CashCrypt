// Level-change Moment (task 14.2): sequences by direction, one Moment for a multi-step change, skip,
// no extra announcement, and the timeline checked at spaced frames
// (house-scene Requirements 16.2, 16.3, 16.4, 16.5, 16.7).
import { render } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { HouseScene } from "@/components/house/HouseScene";
import type { MomentOptions, MomentTarget } from "@/components/moments/momentLoader";
import { playLevelChangeMoment } from "@/components/moments/LevelChangeMoment";
import type { HouseState } from "@/lib/haunting";
import type { DecayLevel } from "@/lib/haunting/config";
import type { MomentRequest } from "@/lib/moments/types";
import { MOMENT_DURATION_MS, buildSceneModel } from "@/lib/scene";
import type { SceneModel } from "@/lib/scene";
import gsap from "gsap";

const MONTHLY_INCOME_CENTS = 300_000;
const REDUCED_QUERY = "(prefers-reduced-motion: reduce)";
const FAKE_PATH_LENGTH = 100;
const WAIT_MS = 3000;
const BETTER_MS = MOMENT_DURATION_MS.levelBetter;
const WORSE_MS = MOMENT_DURATION_MS.levelWorse;
const BEFORE_MIDPOINT_MS = 400;
const AFTER_MIDPOINT_MS = 1200;
const PAST_END_MS = 100;
const FAR_FRAME_MS = 5000;
const INCOMING = '[data-part="incoming-level"]';
const CRACK_PREFIX = '[data-part^="crack:"]';
const realMatchMedia = window.matchMedia;

function stubReducedPreference(): void {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      matches: query === REDUCED_QUERY,
      media: query,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => true,
    }),
  });
}

function modelAt(level: DecayLevel): SceneModel {
  const houseState: HouseState = {
    lightScore: 50,
    baseScore: 50,
    momentum: 0,
    decayLevel: level,
    windowBrightness: 0.5,
    levelProgress: 0.5,
    zombies: [],
    ghosts: [],
    poltergeist: null,
  };
  return buildSceneModel({ houseState, monthlyIncomeCents: MONTHLY_INCOME_CENTS, graveyard: [], bound: false });
}

type Setup = { target: MomentTarget; scene: HTMLElement; layer: HTMLElement; cleanups: Array<() => void>; frozen: SceneModel; live: SceneModel };

/** The Scene shows the old (frozen) level; the live model is the new level. */
function setup(from: DecayLevel, to: DecayLevel): Setup {
  const frozen = modelAt(from);
  const live = modelAt(to);
  const view = render(<HouseScene model={frozen} held />);
  const scene = view.container.querySelector<HTMLElement>('[data-part="scene"]');
  if (!scene) throw new Error("The Scene did not render.");
  const layer = document.createElement("div");
  layer.setAttribute("data-part", "moment-layer");
  layer.setAttribute("aria-hidden", "true");
  document.body.appendChild(layer);
  const cleanups: Array<() => void> = [];
  const target: MomentTarget = { scene, layer, getLiveModel: () => live, registerCleanup: (cleanup) => void cleanups.push(cleanup) };
  return { target, scene, layer, cleanups, frozen, live };
}

function options(request: MomentRequest, signal: AbortSignal): MomentOptions {
  const better = request.kind === "level" && request.to < request.from;
  return { request, signal, durationMs: better ? BETTER_MS : WORSE_MS };
}

type Run = { frame: (ms: number) => void; isDone: () => boolean; done: Promise<void>; controller: AbortController };

let tickers: Array<() => void> = [];
let clock = 0;

/** Starts the Moment and waits until its timeline is driven by the (captured) ticker. */
async function start(setupResult: Setup, request: MomentRequest): Promise<Run> {
  const controller = new AbortController();
  clock = 0;
  let finished = false;
  const done = playLevelChangeMoment(setupResult.target, options(request, controller.signal)).then(() => {
    finished = true;
  });
  await vi.waitFor(() => expect(tickers).toHaveLength(1), { timeout: WAIT_MS });
  return {
    frame: (ms) => {
      clock = ms;
      tickers[0]?.();
    },
    isDone: () => finished,
    done,
    controller,
  };
}

const incomingOf = (scene: HTMLElement): HTMLElement | null => scene.querySelector<HTMLElement>(INCOMING);
const incomingOpacity = (scene: HTMLElement): number => Number(incomingOf(scene)?.style.opacity ?? Number.NaN);
const layerPart = (layer: HTMLElement, name: string): Element | null => layer.querySelector(`[data-moment="${name}"]`);
const BAT = "bat";
const CRACK = "creak-crack";
const SHUTTER = "shutter";

beforeAll(() => {
  // jsdom has no SVG geometry; DrawSVGPlugin needs a path length.
  Object.defineProperty(SVGElement.prototype, "getTotalLength", { configurable: true, value: () => FAKE_PATH_LENGTH });
});

beforeEach(() => {
  tickers = [];
  stubReducedPreference();
  vi.spyOn(performance, "now").mockImplementation(() => clock);
  // Capture the driver's callback instead of letting the real ticker run it.
  vi.spyOn(gsap.ticker, "add").mockImplementation((callback: (...args: never[]) => void) => {
    tickers.push(callback as () => void);
    return callback;
  });
  vi.spyOn(gsap.ticker, "remove").mockImplementation((callback: (...args: never[]) => void) => {
    tickers = tickers.filter((entry) => entry !== (callback as () => void));
    return gsap.ticker;
  });
});

afterEach(() => {
  document.body.innerHTML = "";
  vi.restoreAllMocks();
  Object.defineProperty(window, "matchMedia", { configurable: true, writable: true, value: realMatchMedia });
});

describe("level-change Moment sequences", () => {
  it("plays dawn for a better level: one bat, no crack and no shutter", async () => {
    const s = setup(4, 3);
    const run = await start(s, { kind: "level", from: 4, to: 3 });
    expect(layerPart(s.layer, BAT)).not.toBeNull();
    expect(layerPart(s.layer, CRACK)).toBeNull();
    expect(layerPart(s.layer, SHUTTER)).toBeNull();
    run.frame(BETTER_MS + PAST_END_MS);
    await run.done;
  });

  it("plays creak for a worse level: one crack and one shutter, no bat", async () => {
    const s = setup(2, 3);
    const run = await start(s, { kind: "level", from: 2, to: 3 });
    expect(layerPart(s.layer, CRACK)).not.toBeNull();
    expect(layerPart(s.layer, SHUTTER)).not.toBeNull();
    expect(layerPart(s.layer, BAT)).toBeNull();
    run.frame(WORSE_MS + PAST_END_MS);
    await run.done;
  });

  it("plays one Moment for a multi-step change and ends showing the new level", async () => {
    const s = setup(5, 2);
    const run = await start(s, { kind: "level", from: 5, to: 2 });
    expect(tickers, "one timeline for the whole change").toHaveLength(1);
    expect(s.scene.querySelectorAll(INCOMING)).toHaveLength(1);
    // The incoming layer carries the new level's features, not the old ones.
    expect(incomingOf(s.scene)?.querySelectorAll(CRACK_PREFIX).length).toBe(s.live.features.crackCount);
    expect(s.live.features.crackCount).not.toBe(s.frozen.features.crackCount);
    run.frame(BETTER_MS + PAST_END_MS);
    await run.done;
    expect(incomingOpacity(s.scene)).toBe(1);
  });
});

describe("level-change Moment timing (spaced frames)", () => {
  it("keeps the old level before the midpoint and shows the new level at the end (better)", async () => {
    const s = setup(4, 3);
    const run = await start(s, { kind: "level", from: 4, to: 3 });
    expect(incomingOpacity(s.scene), "hidden before the first frame").toBe(0);
    run.frame(BEFORE_MIDPOINT_MS);
    expect(incomingOpacity(s.scene), "old level still shown before the midpoint").toBe(0);
    run.frame(AFTER_MIDPOINT_MS);
    const mid = incomingOpacity(s.scene);
    expect(mid, "new level is fading in after the midpoint").toBeGreaterThan(0);
    expect(mid).toBeLessThan(1);
    expect(run.isDone()).toBe(false);
    run.frame(BETTER_MS + PAST_END_MS);
    await run.done;
    expect(incomingOpacity(s.scene), "new level fully shown at the end").toBe(1);
  });

  it("shows the new level only at the end of a worse change", async () => {
    const s = setup(2, 3);
    const run = await start(s, { kind: "level", from: 2, to: 3 });
    run.frame(WORSE_MS / 2);
    expect(incomingOpacity(s.scene), "old level still shown at the midpoint").toBe(0);
    expect(run.isDone()).toBe(false);
    run.frame(WORSE_MS + PAST_END_MS);
    await run.done;
    expect(incomingOpacity(s.scene)).toBe(1);
  });

  it("ends on schedule when frames arrive seconds apart", async () => {
    const s = setup(4, 3);
    const run = await start(s, { kind: "level", from: 4, to: 3 });
    run.frame(FAR_FRAME_MS);
    await run.done;
    expect(incomingOpacity(s.scene)).toBe(1);
    expect(tickers, "the driver stopped itself").toHaveLength(0);
  });
});

describe("level-change Moment skip, announcement and cleanup", () => {
  it("jumps to the new level when skipped before the midpoint", async () => {
    const s = setup(4, 3);
    const run = await start(s, { kind: "level", from: 4, to: 3 });
    run.frame(BEFORE_MIDPOINT_MS);
    expect(incomingOpacity(s.scene)).toBe(0);
    run.controller.abort();
    await run.done;
    expect(incomingOpacity(s.scene), "skip shows the new level").toBe(1);
    expect(tickers, "the driver is stopped").toHaveLength(0);
  });

  it("adds no live region or text of its own", async () => {
    const s = setup(4, 3);
    const liveRegionsBefore = document.querySelectorAll('[aria-live], [role="status"], [role="alert"]').length;
    const sceneLabelBefore = s.scene.getAttribute("aria-label");
    const run = await start(s, { kind: "level", from: 4, to: 3 });
    expect(s.layer.getAttribute("aria-hidden")).toBe("true");
    expect(s.layer.querySelectorAll('[aria-live], [role="status"], [role="alert"]')).toHaveLength(0);
    expect((s.layer.textContent ?? "").trim()).toBe("");
    run.frame(BETTER_MS + PAST_END_MS);
    await run.done;
    expect(document.querySelectorAll('[aria-live], [role="status"], [role="alert"]')).toHaveLength(liveRegionsBefore);
    expect(s.scene.getAttribute("aria-label")).toBe(sceneLabelBefore);
  });

  it("leaves no element behind after the registered cleanup runs", async () => {
    const s = setup(4, 3);
    const run = await start(s, { kind: "level", from: 4, to: 3 });
    run.frame(BETTER_MS + PAST_END_MS);
    await run.done;
    expect(s.cleanups).toHaveLength(1);
    s.cleanups[0]?.();
    expect(incomingOf(s.scene)).toBeNull();
    expect(s.layer.children).toHaveLength(0);
  });
});
