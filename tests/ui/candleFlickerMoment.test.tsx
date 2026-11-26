// Candle flicker moment, tested against a recording GSAP mock
// (action-feedback Requirements 8.4, 8.5, 8.6, 11.1 to 11.4).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HALO_MIN, HALO_RANGE, PANE_MIN, PANE_RANGE } from "@/components/house/WindowsLayer";
import type { MomentOptions, MomentTarget } from "@/components/moments/momentLoader";
import type { HouseState } from "@/lib/haunting";
import type { DecayLevel } from "@/lib/haunting/config";
import { FLICKER_DIP_RATIO, MOMENT_BEAT_MIN_MS, MOMENT_DURATION_MS, buildSceneModel } from "@/lib/scene";
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

const MONTHLY_INCOME_CENTS = 300_000;
const LIT_LEVEL: DecayLevel = 2;
const DARK_LEVEL: DecayLevel = 5;
const FROZEN_OPACITY = 0.2;
const EPSILON = 1e-9;
const MS_PER_S = 1000;
const REDUCED_FADE_WAIT_MS = 400;

function modelAt(level: DecayLevel): SceneModel {
  const houseState: HouseState = {
    lightScore: 70,
    baseScore: 70,
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

type Harness = { target: MomentTarget; model: SceneModel; lights: Map<number, HTMLElement>; glows: Map<number, HTMLElement>; layer: HTMLElement };

/** A Scene with one lit window drawn per lit model window, at the frozen opacity, with a CSS transition. */
function buildHarness(level: DecayLevel): Harness {
  const model = modelAt(level);
  const scene = document.createElement("div");
  const layer = document.createElement("div");
  const lights = new Map<number, HTMLElement>();
  const glows = new Map<number, HTMLElement>();
  for (const window of model.windows) {
    if (window.state !== "lit") continue;
    const root = document.createElement("div");
    root.setAttribute("data-part", `window:${window.index}`);
    root.setAttribute("data-state", "lit");
    const light = document.createElement("div");
    light.setAttribute("data-part", "light");
    light.setAttribute("opacity", String(PANE_MIN + PANE_RANGE * FROZEN_OPACITY));
    light.style.transition = "opacity 600ms";
    const glow = document.createElement("div");
    glow.setAttribute("data-part", "glow");
    glow.setAttribute("opacity", String(HALO_MIN + HALO_RANGE * FROZEN_OPACITY));
    glow.style.transition = "opacity 600ms";
    root.append(light, glow);
    scene.append(root);
    lights.set(window.index, light);
    glows.set(window.index, glow);
  }
  document.body.append(scene, layer);
  const target: MomentTarget = { scene, layer, getLiveModel: () => model, registerCleanup: () => undefined };
  return { target, model, lights, glows, layer };
}

function options(litWindows: boolean, signal: AbortSignal = new AbortController().signal): MomentOptions {
  return { request: { kind: "candleFlicker", litWindows }, signal, durationMs: MOMENT_DURATION_MS.candleFlicker };
}

type Player = (target: MomentTarget, options: MomentOptions) => Promise<void>;

async function loadPlayer(): Promise<Player> {
  return (await import("@/components/moments/CandleFlickerMoment")).playCandleFlickerMoment;
}

async function playToEnd(play: Player, target: MomentTarget, litWindows: boolean): Promise<void> {
  const done = play(target, options(litWindows));
  await vi.waitFor(() => expect(rec.timelines).toBe(1));
  rec.onComplete?.();
  await done;
}

function tweensOf(element: Element): Tween[] {
  return rec.tweens.filter((tween) => tween.target === element).sort((a, b) => a.position - b.position);
}

const opacityOf = (vars: Vars | null): number => (typeof vars?.opacity === "number" ? vars.opacity : Number.NaN);
const durationOf = (tween: Tween | undefined): number => (typeof tween?.vars.duration === "number" ? tween.vars.duration : 0);
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
  vi.restoreAllMocks();
});

describe("candle flicker with lit windows", () => {
  it("dips to FLICKER_DIP_RATIO times the frozen opacity with ease none, then steps back", async () => {
    const play = await loadPlayer();
    const { target, lights, glows } = buildHarness(LIT_LEVEL);
    await playToEnd(play, target, true);

    expect(lights.size).toBeGreaterThan(0);
    const cases: Array<[HTMLElement, number]> = [];
    lights.forEach((light) => cases.push([light, paneOf(FROZEN_OPACITY)]));
    glows.forEach((glow) => cases.push([glow, haloOf(FROZEN_OPACITY)]));
    for (const [element, frozen] of cases) {
      const [dip, back] = tweensOf(element);
      expect(dip?.method).toBe("fromTo");
      expect(dip?.vars.ease).toBe("none");
      expect(opacityOf(dip?.from ?? null)).toBeCloseTo(frozen, 9);
      expect(opacityOf(dip?.vars ?? null)).toBeCloseTo(frozen * FLICKER_DIP_RATIO, 9);
      expect(back?.method).toBe("set");
      expect(opacityOf(back?.vars ?? null)).toBeCloseTo(frozen, 9);
    }
  });

  it("rises to the live opacity and holds the brightest step for at least MOMENT_BEAT_MIN_MS", async () => {
    const play = await loadPlayer();
    const { target, model, lights, glows } = buildHarness(LIT_LEVEL);
    await playToEnd(play, target, true);

    for (const [index, light] of lights) {
      const live = model.windows[index]?.opacity ?? Number.NaN;
      const rise = tweensOf(light)[2];
      expect(opacityOf(rise?.vars ?? null)).toBeCloseTo(paneOf(live), 9);
      expect(rise?.vars.ease).toBe("power2.out");
      expect(opacityOf(tweensOf(glows.get(index) as Element)[2]?.vars ?? null)).toBeCloseTo(haloOf(live), 9);
      const endS = (rise?.position ?? 0) + durationOf(rise);
      const padding = rec.tweens.find((tween) => tween.method === "set" && !(tween.target instanceof Element));
      expect(((padding?.position ?? 0) - endS) * MS_PER_S).toBeGreaterThanOrEqual(MOMENT_BEAT_MIN_MS - EPSILON);
    }
  });

  it("turns the CSS transitions off while it plays and restores them on cleanup", async () => {
    const play = await loadPlayer();
    const { target, lights, glows } = buildHarness(LIT_LEVEL);
    let cleanup: () => void = () => undefined;
    target.registerCleanup = (fn) => void (cleanup = fn);
    await playToEnd(play, target, true);

    const elements = [...lights.values(), ...glows.values()];
    elements.forEach((el) => expect(el.style.transition).toBe("none"));
    cleanup();
    elements.forEach((el) => expect(el.style.transition).toContain("opacity"));
  });

  it("jumps to the live opacity when aborted", async () => {
    const play = await loadPlayer();
    const { target, model, lights, glows } = buildHarness(LIT_LEVEL);
    const controller = new AbortController();
    const done = play(target, options(true, controller.signal));
    await vi.waitFor(() => expect(rec.timelines).toBe(1));
    controller.abort();
    await done;

    for (const [index, light] of lights) {
      const live = model.windows[index]?.opacity ?? Number.NaN;
      expect(Number(light.style.opacity)).toBeCloseTo(paneOf(live), 9);
      expect(Number((glows.get(index) as HTMLElement).style.opacity)).toBeCloseTo(haloOf(live), 9);
    }
  });

  it("draws no glow art", async () => {
    const play = await loadPlayer();
    const { target, layer } = buildHarness(LIT_LEVEL);
    await playToEnd(play, target, true);

    expect(layer.querySelector('[data-moment="flicker-glow"]')).toBeNull();
  });
});

describe("candle flicker without lit windows", () => {
  it("fades a glow in and out to opacity 0 over every unlit window", async () => {
    const play = await loadPlayer();
    const { target, model, layer } = buildHarness(DARK_LEVEL);
    await playToEnd(play, target, false);

    const glows = Array.from(layer.querySelectorAll('[data-moment="flicker-glow"]'));
    expect(glows).toHaveLength(model.windows.filter((w) => w.state !== "lit").length);
    expect(glows.length).toBeGreaterThan(0);
    for (const glow of glows) {
      const [fadeIn, fadeOut] = tweensOf(glow);
      expect(opacityOf(fadeIn?.vars ?? null)).toBeGreaterThan(0);
      expect(opacityOf(fadeOut?.vars ?? null)).toBe(0);
    }
  });

  it("leaves no glow behind when aborted, and removes the art on cleanup", async () => {
    const play = await loadPlayer();
    const { target, layer } = buildHarness(DARK_LEVEL);
    let cleanup: () => void = () => undefined;
    target.registerCleanup = (fn) => void (cleanup = fn);
    const controller = new AbortController();
    const done = play(target, options(false, controller.signal));
    await vi.waitFor(() => expect(rec.timelines).toBe(1));
    controller.abort();
    await done;

    layer.querySelectorAll<SVGElement>('[data-moment="flicker-glow"]').forEach((glow) => expect(Number(glow.style.opacity)).toBe(0));
    cleanup();
    expect(layer.querySelector('[data-moment="flicker-glow"]')).toBeNull();
  });
});

describe("candle flicker clock", () => {
  const SLOW_FRAME_MS = 1500;

  it("sets the timeline to the wall-clock time on every frame", async () => {
    const play = await loadPlayer();
    const { target } = buildHarness(LIT_LEVEL);
    const now = vi.spyOn(performance, "now");
    now.mockReturnValue(1000);
    const done = play(target, options(true));
    await vi.waitFor(() => expect(rec.timelines).toBe(1));

    expect(rec.paused).toBe(true);
    now.mockReturnValue(1000 + SLOW_FRAME_MS);
    rec.tickers[0]?.();
    expect(rec.times.at(-1)).toBeCloseTo(SLOW_FRAME_MS / MS_PER_S, 9);
    rec.onComplete?.();
    await done;
    expect(rec.tickers).toHaveLength(0);
  });
});

describe("candle flicker under reduced motion", () => {
  it("records no tween and never loads GSAP", async () => {
    const { playMoment } = await import("@/components/moments/momentLoader");
    const { target } = buildHarness(LIT_LEVEL);

    await playMoment({ kind: "candleFlicker", litWindows: true }, target, new AbortController().signal, true);

    expect(rec.timelines).toBe(0);
    expect(rec.modules).toBe(0);
  }, REDUCED_FADE_WAIT_MS * 5);
});
