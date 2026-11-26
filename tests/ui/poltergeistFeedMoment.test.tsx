// The Poltergeist feed Moment plays by the wall clock, swells to FEED_SCALE and settles back to 1,
// keeps a bound sigil ring unscaled, and leaves no art behind (action-feedback Requirements 4.2, 4.4, 4.10, 11.1 to 11.4).
// The GSAP mock applies each tween's end values to the DOM once the timeline time passes its end.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MomentOptions, MomentTarget } from "@/components/moments/momentLoader";
import type { HouseState } from "@/lib/haunting";
import { FEED_PARTICLES, FEED_SCALE, MOMENT_DURATION_MS, buildSceneModel } from "@/lib/scene";

type Vars = Record<string, unknown>;
type Tween = { target: unknown; vars: Vars; end: number };
const rec = vi.hoisted(() => ({
  paused: false,
  times: [] as number[],
  tickers: [] as Array<() => void>,
  scales: [] as number[],
}));

function applyVars(target: unknown, vars: Vars): void {
  if (!(target instanceof Element)) return;
  const el = target as SVGElement;
  if (typeof vars.opacity === "number") el.style.opacity = String(vars.opacity);
  if (typeof vars.scale === "number") {
    el.setAttribute("data-scale", String(vars.scale));
    rec.scales.push(vars.scale);
  }
}

vi.mock("gsap", () => {
  const timeline = (config?: { onComplete?: () => void }) => {
    const tweens: Tween[] = [];
    let end = 0;
    let completed = false;
    const add = (target: unknown, vars: Vars | undefined, position: number): void => {
      const length = typeof vars?.duration === "number" ? vars.duration : 0;
      end = Math.max(end, position + length);
      if (vars) tweens.push({ target, vars, end: position + length });
    };
    const settle = (seconds: number): void => {
      tweens
        .filter((tween) => tween.end <= seconds)
        .sort((a, b) => a.end - b.end)
        .forEach((tween) => applyVars(tween.target, tween.vars));
      if (seconds >= end && !completed) {
        completed = true;
        config?.onComplete?.();
      }
    };
    const api = {
      to: (target: unknown, vars: Vars, position = 0) => {
        add(target, vars, position);
        return api;
      },
      set: (_target: unknown, _vars: Vars, position = 0) => {
        add(undefined, undefined, position);
        return api;
      },
      pause: () => {
        rec.paused = true;
        return api;
      },
      time: (seconds: number) => {
        rec.times.push(seconds);
        settle(seconds);
        return api;
      },
      progress: (value: number) => {
        if (value >= 1) settle(end);
        return api;
      },
      duration: () => end,
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

const MS_PER_S = 1000;
const FRAME_GAP_MS = 700;
const MAX_FRAMES = 6;
const MONTHLY_INCOME_CENTS = 300_000;
const POLTERGEIST_STATE = { totalAmount: 5000, transactionCount: 5, byCategory: { coffee: 5000 } };
const FEED_SELECTOR = '[data-part="poltergeist-feed"]';

function buildTarget(bound = false): { target: MomentTarget; cleanups: Array<() => void> } {
  const houseState: HouseState = {
    lightScore: 30,
    baseScore: 30,
    momentum: 0,
    decayLevel: 4,
    windowBrightness: 0.2,
    levelProgress: 0.5,
    zombies: [],
    ghosts: [],
    poltergeist: POLTERGEIST_STATE,
  };
  const model = buildSceneModel({ houseState, monthlyIncomeCents: MONTHLY_INCOME_CENTS, graveyard: [], bound });
  const scene = document.createElement("div");
  scene.innerHTML = `<svg><g data-part="ghosts"></g><g data-part="poltergeist"><g data-part="sigil"><ellipse data-part="sigil-ring"></ellipse></g><g data-part="poltergeist-feed"></g></g></svg>`;
  const layer = document.createElement("div");
  document.body.append(scene, layer);
  const cleanups: Array<() => void> = [];
  return { target: { scene, layer, getLiveModel: () => model, registerCleanup: (fn) => void cleanups.push(fn) }, cleanups };
}

function options(appeared: boolean, signal: AbortSignal = new AbortController().signal): MomentOptions {
  return {
    request: { kind: "poltergeistFeed", appeared },
    signal,
    durationMs: MOMENT_DURATION_MS[appeared ? "poltergeistAppear" : "poltergeistFeed"],
  };
}

function swellOf(target: MomentTarget): SVGElement {
  const el = target.scene.querySelector<SVGElement>(FEED_SELECTOR);
  if (!el) throw new Error("feed wrapper not found");
  return el;
}

beforeEach(() => {
  rec.paused = false;
  rec.times = [];
  rec.tickers = [];
  rec.scales = [];
  vi.resetModules();
});

afterEach(() => {
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

describe("poltergeist feed moment", () => {
  it("ends on schedule by the wall clock with frames 700 ms apart, peaking at FEED_SCALE and settling at 1", async () => {
    const { playPoltergeistFeedMoment } = await import("@/components/moments/PoltergeistFeedMoment");
    const now = vi.spyOn(performance, "now");
    now.mockReturnValue(0);
    const { target } = buildTarget();
    let resolved = false;
    const done = playPoltergeistFeedMoment(target, options(false)).then(() => {
      resolved = true;
    });
    await vi.waitFor(() => expect(rec.tickers).toHaveLength(1), { timeout: 2000 });
    expect(rec.paused).toBe(true);
    expect(target.layer.querySelectorAll('[data-moment="feed-particle"]')).toHaveLength(FEED_PARTICLES);
    let frames = 0;
    while (!resolved && frames < MAX_FRAMES) {
      frames += 1;
      now.mockReturnValue(frames * FRAME_GAP_MS);
      rec.tickers[0]?.();
      await Promise.resolve();
    }
    await done;
    const durationS = MOMENT_DURATION_MS.poltergeistFeed / MS_PER_S;
    const lastTime = rec.times.at(-1) ?? 0;
    expect(resolved).toBe(true);
    expect(lastTime).toBeGreaterThanOrEqual(durationS);
    expect(lastTime).toBeLessThan(durationS + FRAME_GAP_MS / MS_PER_S);
    expect(rec.tickers, "the driver stops itself").toHaveLength(0);
    expect(Math.max(...rec.scales), "the swell reaches FEED_SCALE").toBe(FEED_SCALE);
    expect(swellOf(target).getAttribute("data-scale"), "ends at rest scale").toBe("1");
  });

  it("ends bound with its sigil ring still drawn and not scaled", async () => {
    const { playPoltergeistFeedMoment } = await import("@/components/moments/PoltergeistFeedMoment");
    const now = vi.spyOn(performance, "now");
    now.mockReturnValue(0);
    const { target } = buildTarget(true);
    const done = playPoltergeistFeedMoment(target, options(false));
    await vi.waitFor(() => expect(rec.tickers).toHaveLength(1), { timeout: 2000 });
    const ring = target.scene.querySelector<SVGElement>('[data-part="sigil-ring"]');
    expect(ring, "the ring is outside the feed wrapper").not.toBeNull();
    expect(swellOf(target).contains(ring)).toBe(false);
    expect(ring?.hasAttribute("data-scale")).toBe(false);
    now.mockReturnValue(MOMENT_DURATION_MS.poltergeistFeed + 1);
    rec.tickers[0]?.();
    await done;
    expect(target.scene.querySelector('[data-part="sigil-ring"]')).toBe(ring);
    expect(ring?.hasAttribute("data-scale")).toBe(false);
  });

  it("jumps to scale 1 and leaves no art after an abort", async () => {
    const { playPoltergeistFeedMoment } = await import("@/components/moments/PoltergeistFeedMoment");
    const controller = new AbortController();
    const { target, cleanups } = buildTarget();
    const done = playPoltergeistFeedMoment(target, options(false, controller.signal));
    await vi.waitFor(() => expect(rec.tickers).toHaveLength(1), { timeout: 2000 });
    controller.abort();
    await done;
    expect(rec.tickers, "the driver is stopped").toHaveLength(0);
    expect(swellOf(target).getAttribute("data-scale")).toBe("1");
    cleanups.forEach((fn) => fn());
    expect(target.layer.querySelector("[data-moment]"), "no art left in the layer").toBeNull();
    expect(target.layer.children).toHaveLength(0);
  });

  it("draws a copy of the Poltergeist when it appears and removes it on cleanup", async () => {
    const { playPoltergeistFeedMoment } = await import("@/components/moments/PoltergeistFeedMoment");
    const controller = new AbortController();
    const { target, cleanups } = buildTarget();
    const done = playPoltergeistFeedMoment(target, options(true, controller.signal));
    await vi.waitFor(() => expect(rec.tickers).toHaveLength(1), { timeout: 2000 });
    expect(target.layer.querySelector('[data-moment="poltergeist-copy"]')).not.toBeNull();
    controller.abort();
    await done;
    const copy = target.layer.querySelector<SVGElement>('[data-moment="poltergeist-copy"]');
    expect(copy?.style.opacity, "the copy is visible at the end").toBe("1");
    expect(target.layer.querySelector<SVGElement>('[data-moment="poltergeist-copy-feed"]')?.getAttribute("data-scale")).toBe("1");
    expect(target.scene.querySelector<SVGElement>('[data-part="ghosts"]')?.style.opacity).toBe("0");
    cleanups.forEach((fn) => fn());
    expect(target.layer.querySelector("[data-moment]")).toBeNull();
  });
});
