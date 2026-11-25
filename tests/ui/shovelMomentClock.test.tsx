// The cancel (shovel) Moment plays by the wall clock, so far-apart animation frames cannot stretch it
// (house-scene design, "Moment clock"; same mechanism as tests/ui/candleOrbMoment.test.tsx).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MomentOptions, MomentTarget } from "@/components/moments/momentLoader";
import type { HouseState } from "@/lib/haunting";
import { MOMENT_DURATION_MS, buildSceneModel } from "@/lib/scene";

type Vars = Record<string, unknown>;

const rec = vi.hoisted(() => ({
  timelines: 0,
  paused: false,
  times: [] as number[],
  tickers: [] as Array<() => void>,
}));

vi.mock("gsap", () => {
  const timeline = (config?: { onComplete?: () => void }) => {
    rec.timelines += 1;
    let end = 0;
    let completed = false;
    const extend = (position: number, vars: Vars | undefined): void => {
      const length = typeof vars?.duration === "number" ? vars.duration : 0;
      end = Math.max(end, position + length);
    };
    const api = {
      to: (_target: unknown, vars: Vars, position = 0) => {
        extend(position, vars);
        return api;
      },
      call: (_fn: () => void, _args: unknown[], position = 0) => {
        extend(position, undefined);
        return api;
      },
      pause: () => {
        rec.paused = true;
        return api;
      },
      // Like GSAP: setting the time to the end of a paused timeline fires onComplete once.
      time: (seconds: number) => {
        rec.times.push(seconds);
        if (seconds >= end && !completed) {
          completed = true;
          config?.onComplete?.();
        }
        return api;
      },
      duration: () => end,
      progress: () => api,
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

const MS_PER_S = 1000;
const FRAME_GAP_MS = 1500;
const MAX_FRAMES = 4;
const MONTHLY_INCOME_CENTS = 300_000;
const CANCELED_CENTS = 1549;

function buildTarget(): MomentTarget {
  const houseState: HouseState = {
    lightScore: 50,
    baseScore: 50,
    momentum: 0,
    decayLevel: 3,
    windowBrightness: 0.5,
    levelProgress: 0.5,
    zombies: [],
    ghosts: [],
    poltergeist: null,
  };
  const model = buildSceneModel({ houseState, monthlyIncomeCents: MONTHLY_INCOME_CENTS, graveyard: [], bound: false });
  const scene = document.createElement("div");
  const layer = document.createElement("div");
  document.body.append(scene, layer);
  return { scene, layer, getLiveModel: () => model, registerCleanup: () => undefined };
}

function options(): MomentOptions {
  return {
    request: { kind: "cancel", subscriptionId: "sub-1", name: "Wraithcast", monthlyCents: CANCELED_CENTS, target: "overflow" },
    signal: new AbortController().signal,
    durationMs: MOMENT_DURATION_MS.cancel,
  };
}

beforeEach(() => {
  rec.timelines = 0;
  rec.paused = false;
  rec.times = [];
  rec.tickers = [];
  vi.resetModules();
});

afterEach(() => {
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

describe("shovel moment clock", () => {
  it("reaches its end state by the wall clock when frames arrive 1.5 s apart", async () => {
    const { playShovelMoment } = await import("@/components/moments/ShovelMoment");
    const now = vi.spyOn(performance, "now");
    now.mockReturnValue(0);
    let resolved = false;
    const done = playShovelMoment(buildTarget(), options()).then(() => {
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

    expect(resolved, "the Moment resolves within a few far-apart frames").toBe(true);
    // The driver stops itself on the frame that passes the duration, so later frames do nothing.
    expect(rec.times).toHaveLength(1);
    expect(rec.times[0]).toBeCloseTo(FRAME_GAP_MS / MS_PER_S, 9);
    expect(rec.times[0]).toBeGreaterThanOrEqual(MOMENT_DURATION_MS.cancel / MS_PER_S);
    expect(rec.tickers).toHaveLength(0);
  });
});
