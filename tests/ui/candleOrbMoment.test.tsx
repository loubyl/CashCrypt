// Payment moment with the flare, tested against a recording GSAP mock
// (house-scene Requirements 14.3, 14.6, 14.7, 18.4, 20.3).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HALO_MIN, HALO_RANGE, PANE_MIN, PANE_RANGE } from "@/components/house/WindowsLayer";
import type { MomentOptions, MomentTarget } from "@/components/moments/momentLoader";
import type { HouseState } from "@/lib/haunting";
import type { DecayLevel } from "@/lib/haunting/config";
import { MOMENT_BEAT_MIN_MS, MOMENT_DURATION_MS, PAYMENT_FLARE_BOOST, buildSceneModel } from "@/lib/scene";
import type { SceneModel } from "@/lib/scene";

type Vars = Record<string, unknown>;
type Tween = { method: "to" | "fromTo" | "set"; target: unknown; from: Vars | null; vars: Vars; position: number };

const RECORDED_DURATION_S = 2;

const rec = vi.hoisted(() => ({
  tweens: [] as Tween[],
  timelines: 0,
  modules: 0,
  onComplete: null as (() => void) | null,
  paused: false,
  times: [] as number[],
  tickers: [] as Array<() => void>,
}));

vi.mock("gsap", () => {
  rec.modules += 1;
  const timeline = (config?: { onComplete?: () => void }) => {
    rec.timelines += 1;
    rec.onComplete = config?.onComplete ?? null;
    const own: Tween[] = [];
    const push = (tween: Tween): void => {
      own.push(tween);
      rec.tweens.push(tween);
    };
    const api = {
      to: (target: unknown, vars: Vars, position = 0) => {
        push({ method: "to", target, from: null, vars, position });
        return api;
      },
      fromTo: (target: unknown, from: Vars, vars: Vars, position = 0) => {
        push({ method: "fromTo", target, from, vars, position });
        return api;
      },
      set: (target: unknown, vars: Vars, position = 0) => {
        push({ method: "set", target, from: null, vars, position });
        return api;
      },
      pause: () => {
        rec.paused = true;
        return api;
      },
      time: (seconds: number) => {
        rec.times.push(seconds);
        return api;
      },
      duration: () => RECORDED_DURATION_S,
      // Jump to the end: apply the last opacity of every element, in timeline order.
      progress: () => {
        [...own]
          .sort((a, b) => a.position - b.position)
          .forEach((tween) => {
            if (tween.target instanceof Element && typeof tween.vars.opacity === "number") {
              (tween.target as HTMLElement).style.opacity = String(tween.vars.opacity);
            }
          });
        return api;
      },
    };
    return api;
  };
  const gsap = {
    timeline,
    set: () => undefined,
    ticker: {
      add: (callback: () => void) => void rec.tickers.push(callback),
      remove: (callback: () => void) => void (rec.tickers = rec.tickers.filter((entry) => entry !== callback)),
    },
    registerPlugin: () => undefined,
    context: () => ({ add: (fn: () => void) => fn(), revert: () => undefined }),
  };
  return { default: gsap, gsap };
});

vi.mock("gsap/MotionPathPlugin", () => ({ MotionPathPlugin: {} }));

const MONTHLY_INCOME_CENTS = 300_000;
const LEVEL: DecayLevel = 2;
const DRAWN_OPACITY = 0.05; // frozen (pre-payment) window opacity, below the live one
const EPSILON = 1e-9;
const REDUCED_FADE_WAIT_MS = 400;

function liveModel(): SceneModel {
  const houseState: HouseState = {
    lightScore: 70,
    baseScore: 70,
    momentum: 0,
    decayLevel: LEVEL,
    windowBrightness: 0.5,
    levelProgress: 0.5,
    zombies: [],
    ghosts: [],
    poltergeist: null,
  };
  return buildSceneModel({ houseState, monthlyIncomeCents: MONTHLY_INCOME_CENTS, graveyard: [], bound: false });
}

type Harness = { target: MomentTarget; model: SceneModel; lights: Map<number, Element>; glows: Map<number, Element>; layer: HTMLElement };

/** A Scene with one lit window drawn per lit model window, at the frozen opacity. */
function buildHarness(): Harness {
  const model = liveModel();
  const scene = document.createElement("div");
  const layer = document.createElement("div");
  const lights = new Map<number, Element>();
  const glows = new Map<number, Element>();
  for (const window of model.windows) {
    if (window.state !== "lit") continue;
    const root = document.createElement("div");
    root.setAttribute("data-part", `window:${window.index}`);
    root.setAttribute("data-state", "lit");
    const light = document.createElement("div");
    light.setAttribute("data-part", "light");
    light.setAttribute("opacity", String(PANE_MIN + PANE_RANGE * DRAWN_OPACITY));
    const glow = document.createElement("div");
    glow.setAttribute("data-part", "glow");
    root.append(light, glow);
    scene.append(root);
    lights.set(window.index, light);
    glows.set(window.index, glow);
  }
  document.body.append(scene, layer);
  const target: MomentTarget = { scene, layer, getLiveModel: () => model, registerCleanup: () => undefined };
  return { target, model, lights, glows, layer };
}

function options(hasCrack: boolean, signal: AbortSignal = new AbortController().signal): MomentOptions {
  return {
    request: { kind: "payment", origin: null, hasCrack },
    signal,
    durationMs: MOMENT_DURATION_MS.payment,
  };
}

type Player = (target: MomentTarget, options: MomentOptions) => Promise<void>;

async function loadPlayer(): Promise<Player> {
  return (await import("@/components/moments/CandleOrbMoment")).playCandleOrbMoment;
}

/** Plays the moment, waits for its timeline, then completes it. */
async function playToEnd(play: Player, target: MomentTarget, hasCrack: boolean): Promise<void> {
  const done = play(target, options(hasCrack));
  await vi.waitFor(() => expect(rec.timelines).toBe(1));
  rec.onComplete?.();
  await done;
}

/** The tweens recorded for one element, in timeline order. */
function tweensOf(element: Element): Tween[] {
  return rec.tweens.filter((tween) => tween.target === element).sort((a, b) => a.position - b.position);
}

const duration = (tween: Tween): number => (typeof tween.vars.duration === "number" ? tween.vars.duration : 0);
const opacityOf = (vars: Vars | null): number => (typeof vars?.opacity === "number" ? vars.opacity : Number.NaN);
const paneOf = (opacity: number): number => PANE_MIN + PANE_RANGE * opacity;
const haloOf = (opacity: number): number => HALO_MIN + HALO_RANGE * opacity;

beforeEach(() => {
  rec.tweens = [];
  rec.timelines = 0;
  rec.modules = 0;
  rec.onComplete = null;
  rec.paused = false;
  rec.times = [];
  rec.tickers = [];
  vi.resetModules();
});

afterEach(() => {
  document.body.innerHTML = "";
});

describe("payment moment flame origin", () => {
  it("centers the flame on the Save payment control, horizontally and vertically", async () => {
    const play = await loadPlayer();
    const { target } = buildHarness();
    const origin = { left: 252, top: 474, width: 200, height: 52 };
    const done = play(target, { ...options(false), request: { kind: "payment", origin, hasCrack: false } });
    await vi.waitFor(() => expect(rec.timelines).toBe(1));
    const flame = target.layer.querySelector<SVGElement>('[data-moment="flame"]');
    const size = Number(flame?.getAttribute("width"));
    // jsdom lays nothing out, so the layer rect is at (0, 0) and the flame center is the control center.
    expect(parseFloat(flame?.style.left ?? "") + size / 2).toBeCloseTo(origin.left + origin.width / 2);
    expect(parseFloat(flame?.style.top ?? "") + size / 2).toBeCloseTo(origin.top + origin.height / 2);
    rec.onComplete?.();
    await done;
  });
});

describe("payment moment flare", () => {
  it("records the flare steps from, peak and final for every lit window pane", async () => {
    const play = await loadPlayer();
    const { target, model, lights } = buildHarness();
    await playToEnd(play, target, true);

    expect(lights.size).toBeGreaterThan(0);
    for (const [index, light] of lights) {
      const live = model.windows[index]?.opacity ?? Number.NaN;
      const [rise, settle] = tweensOf(light);
      expect(rise?.method).toBe("fromTo");
      expect(opacityOf(rise?.from ?? null)).toBeCloseTo(paneOf(DRAWN_OPACITY), 9);
      expect(opacityOf(rise?.vars ?? null)).toBeCloseTo(paneOf(Math.min(1, live + PAYMENT_FLARE_BOOST)), 9);
      expect(opacityOf(settle?.vars ?? null)).toBeCloseTo(paneOf(live), 9);
      expect(tweensOf(light)).toHaveLength(2);
    }
  });

  it("keeps the peak at most 1 and at least the live opacity, for the halo too", async () => {
    const play = await loadPlayer();
    const { target, model, lights, glows } = buildHarness();
    await playToEnd(play, target, true);

    for (const [index, light] of lights) {
      const live = model.windows[index]?.opacity ?? Number.NaN;
      const lightPeak = opacityOf(tweensOf(light)[0]?.vars ?? null);
      const glowPeak = opacityOf(tweensOf(glows.get(index) as Element)[0]?.vars ?? null);
      expect(lightPeak).toBeLessThanOrEqual(paneOf(1) + EPSILON);
      expect(lightPeak).toBeGreaterThanOrEqual(paneOf(live) - EPSILON);
      expect(glowPeak).toBeLessThanOrEqual(haloOf(1) + EPSILON);
      expect(glowPeak).toBeGreaterThanOrEqual(haloOf(live) - EPSILON);
    }
  });

  it("holds the peak for MOMENT_BEAT_MIN_MS before settling", async () => {
    const play = await loadPlayer();
    const { target, lights } = buildHarness();
    await playToEnd(play, target, true);

    const [rise, settle] = tweensOf([...lights.values()][0] as Element);
    const holdS = (settle?.position ?? 0) - ((rise?.position ?? 0) + duration(rise as Tween));
    expect(holdS * 1000).toBeGreaterThanOrEqual(MOMENT_BEAT_MIN_MS - EPSILON);
  });

  it("jumps to the live opacity when the moment is aborted", async () => {
    const play = await loadPlayer();
    const { target, model, lights, glows } = buildHarness();
    const controller = new AbortController();
    const done = play(target, options(true, controller.signal));
    await vi.waitFor(() => expect(rec.timelines).toBe(1));
    controller.abort();
    await done;

    for (const [index, light] of lights) {
      const live = model.windows[index]?.opacity ?? Number.NaN;
      expect(Number((light as HTMLElement).style.opacity)).toBeCloseTo(paneOf(live), 9);
      expect(Number((glows.get(index) as HTMLElement).style.opacity)).toBeCloseTo(haloOf(live), 9);
    }
  });
});

describe("payment moment clock", () => {
  const MS_PER_S = 1000;
  const SLOW_FRAME_MS = 1500;

  afterEach(() => vi.restoreAllMocks());

  it("sets the timeline to the wall-clock time on every frame, however far apart the frames are", async () => {
    const play = await loadPlayer();
    const { target } = buildHarness();
    const now = vi.spyOn(performance, "now");
    now.mockReturnValue(1000);
    const done = play(target, options(true));
    await vi.waitFor(() => expect(rec.timelines).toBe(1));

    expect(rec.paused).toBe(true);
    expect(rec.tickers).toHaveLength(1);
    now.mockReturnValue(1000 + SLOW_FRAME_MS);
    rec.tickers[0]?.();

    expect(rec.times.at(-1)).toBeCloseTo(SLOW_FRAME_MS / MS_PER_S, 9);
    rec.onComplete?.();
    await done;
    expect(rec.tickers).toHaveLength(0);
  });

  it("stops the frame driver once the wall clock passes the timeline duration", async () => {
    const play = await loadPlayer();
    const { target } = buildHarness();
    const now = vi.spyOn(performance, "now");
    now.mockReturnValue(0);
    const done = play(target, options(true));
    await vi.waitFor(() => expect(rec.timelines).toBe(1));
    now.mockReturnValue((RECORDED_DURATION_S + 1) * MS_PER_S);
    rec.tickers[0]?.();

    expect(rec.tickers).toHaveLength(0);
    rec.onComplete?.();
    await done;
  });
});

describe("payment moment crack flash", () => {
  const crackTweens = (layer: HTMLElement): Tween[] => {
    const crack = layer.querySelector('[data-moment="crack-flash"]');
    return crack ? tweensOf(crack) : [];
  };

  it("flashes the crack once and fades it out when the house has a crack", async () => {
    const play = await loadPlayer();
    const { target, layer } = buildHarness();
    await playToEnd(play, target, true);
    const flash = crackTweens(layer);

    expect(flash.map((tween) => opacityOf(tween.vars))).toEqual([1, 0]);
  });

  it("omits the crack flash when there is no crack", async () => {
    const play = await loadPlayer();
    const { target, layer } = buildHarness();
    await playToEnd(play, target, false);
    const hasArt = layer.querySelector('[data-moment="crack-flash"]') !== null;

    expect(hasArt).toBe(false);
  });
});

describe("payment moment under reduced motion", () => {
  it("records no flare and never loads GSAP", async () => {
    const { playMoment } = await import("@/components/moments/momentLoader");
    const { target, lights } = buildHarness();

    await playMoment({ kind: "payment", origin: null, hasCrack: true }, target, new AbortController().signal, true);

    expect(rec.timelines).toBe(0);
    expect(rec.modules).toBe(0);
    for (const light of lights.values()) expect(tweensOf(light)).toHaveLength(0);
  }, REDUCED_FADE_WAIT_MS * 5);
});
