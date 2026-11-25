// The sigil Moment plays by the wall clock, so far-apart animation frames cannot stretch it
// (house-scene design, "Moment clock"; same mechanism as tests/ui/shovelMomentClock.test.tsx).
// The GSAP mock below applies each tween's end values to the DOM once the timeline time passes its end,
// so the tests can check the final state, not only the timing.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MomentOptions, MomentTarget } from "@/components/moments/momentLoader";
import type { HouseState } from "@/lib/haunting";
import { MOMENT_DURATION_MS, POLTERGEIST_SIZE, SIGIL_MIN_RATIO, buildSceneModel } from "@/lib/scene";

type Vars = Record<string, unknown>;
type Tween = { target: unknown; vars: Vars; end: number };

const rec = vi.hoisted(() => ({
  paused: false,
  times: [] as number[],
  tickers: [] as Array<() => void>,
}));

/** Writes the end values of a tween onto the element, the way GSAP leaves it. */
function applyVars(target: unknown, vars: Vars): void {
  if (!(target instanceof Element)) return;
  const el = target as SVGElement;
  if (typeof vars.opacity === "number") el.style.opacity = String(vars.opacity);
  if (typeof vars.drawSVG === "string") el.setAttribute("data-draw", vars.drawSVG);
  if (typeof vars.x === "number") el.setAttribute("data-x", String(vars.x));
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
      // Like GSAP: progress(1) renders the end state.
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
    set: (target: unknown, vars: Vars) => applyVars(target, vars),
    ticker: {
      add: (callback: () => void) => void rec.tickers.push(callback),
      remove: (callback: () => void) => void (rec.tickers = rec.tickers.filter((entry) => entry !== callback)),
    },
    registerPlugin: () => undefined,
    context: () => ({ add: (fn: () => void) => fn(), revert: () => undefined }),
  };
  return { default: gsap, gsap };
});

vi.mock("gsap/DrawSVGPlugin", () => ({ DrawSVGPlugin: {} }));

const MS_PER_S = 1000;
const FRAME_GAP_MS = 700;
const MAX_FRAMES = 6;
const MONTHLY_INCOME_CENTS = 300_000;
const BOUND_OPACITY = "0.5";
const FULL_DRAW = "0% 100%";
const DIAMETER_FACTOR = 2;

const POLTERGEIST_STATE = { totalAmount: 5000, transactionCount: 5, byCategory: { coffee: 5000 } };

function buildTarget(): MomentTarget {
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
  const model = buildSceneModel({ houseState, monthlyIncomeCents: MONTHLY_INCOME_CENTS, graveyard: [], bound: false });
  const scene = document.createElement("div");
  scene.innerHTML =
    '<svg><g data-part="poltergeist"><g data-part="poltergeist-body" style="opacity: 0.78"></g></g></svg>';
  const layer = document.createElement("div");
  document.body.append(scene, layer);
  return { scene, layer, getLiveModel: () => model, registerCleanup: () => undefined };
}

function options(signal: AbortSignal = new AbortController().signal): MomentOptions {
  return { request: { kind: "sigil" }, signal, durationMs: MOMENT_DURATION_MS.sigil };
}

function ringOf(target: MomentTarget): SVGElement {
  const ring = target.layer.querySelector<SVGElement>('[data-moment="sigil"]');
  if (!ring) throw new Error("sigil ring not found");
  return ring;
}

function expectBoundEndState(target: MomentTarget): void {
  const ring = ringOf(target);
  expect(ring.getAttribute("data-draw"), "the sigil stroke is fully drawn").toBe(FULL_DRAW);
  expect(ring.style.opacity, "the sigil ring is visible").toBe("1");
  const body = target.scene.querySelector<SVGElement>('[data-part="poltergeist-body"]');
  expect(body, "the Poltergeist body is still in the scene").not.toBeNull();
  expect(body?.style.opacity, "the Poltergeist body ends at the bound opacity").toBe(BOUND_OPACITY);
  const figure = target.scene.querySelector<SVGElement>('[data-part="poltergeist"]');
  expect(figure, "the Poltergeist figure is not removed").not.toBeNull();
  expect(figure?.getAttribute("data-x"), "the shake ends back at rest").toBe("0");
}

beforeEach(() => {
  rec.paused = false;
  rec.times = [];
  rec.tickers = [];
  vi.resetModules();
});

afterEach(() => {
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

describe("sigil moment clock", () => {
  it("reaches its end state by the wall clock when frames arrive 700 ms apart", async () => {
    const { playSigilMoment } = await import("@/components/moments/SigilMoment");
    const now = vi.spyOn(performance, "now");
    now.mockReturnValue(0);
    const target = buildTarget();
    let resolved = false;
    const done = playSigilMoment(target, options()).then(() => {
      resolved = true;
    });

    await vi.waitFor(() => expect(rec.tickers, "the timeline is driven by a ticker callback").toHaveLength(1), { timeout: 2000 });
    expect(rec.paused).toBe(true);

    let frames = 0;
    while (!resolved && frames < MAX_FRAMES) {
      frames += 1;
      now.mockReturnValue(frames * FRAME_GAP_MS);
      rec.tickers[0]?.();
      await Promise.resolve();
    }
    await done;

    const durationS = MOMENT_DURATION_MS.sigil / MS_PER_S;
    const lastTime = rec.times.at(-1) ?? 0;
    expect(resolved, "the Moment resolves within a few far-apart frames").toBe(true);
    expect(lastTime, "resolved only once the wall clock passed the Moment duration").toBeGreaterThanOrEqual(durationS);
    expect(lastTime, "resolved on the first frame past the duration").toBeLessThan(durationS + FRAME_GAP_MS / MS_PER_S);
    expect(rec.tickers, "the driver stops itself").toHaveLength(0);
    expectBoundEndState(target);
  });

  it("draws a ring at least 1.5 times as wide as the Poltergeist", async () => {
    const { playSigilMoment } = await import("@/components/moments/SigilMoment");
    const target = buildTarget();
    void playSigilMoment(target, options());
    await vi.waitFor(() => expect(rec.tickers).toHaveLength(1), { timeout: 2000 });

    const ring = ringOf(target);
    const diameter = Number(ring.getAttribute("rx")) * DIAMETER_FACTOR;
    expect(diameter).toBeGreaterThanOrEqual(SIGIL_MIN_RATIO * POLTERGEIST_SIZE);
  });

  it("jumps to the end state when the Moment is aborted", async () => {
    const { playSigilMoment } = await import("@/components/moments/SigilMoment");
    const controller = new AbortController();
    const target = buildTarget();
    const done = playSigilMoment(target, options(controller.signal));
    await vi.waitFor(() => expect(rec.tickers).toHaveLength(1), { timeout: 2000 });

    controller.abort();
    await done;

    expect(rec.tickers, "the driver is stopped").toHaveLength(0);
    expectBoundEndState(target);
  });
});
