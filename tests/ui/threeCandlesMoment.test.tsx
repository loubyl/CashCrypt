// Three-candles Moment (task 15.1): timing checked at spaced frames, so the Moment ends on schedule
// when frames arrive far apart (it plays by the wall clock, see driveOnWallClock).
import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HouseScene } from "@/components/house/HouseScene";
import type { MomentOptions, MomentTarget } from "@/components/moments/momentLoader";
import { playThreeCandlesMoment } from "@/components/moments/ThreeCandlesMoment";
import type { HouseState } from "@/lib/haunting";
import { MOMENT_DURATION_MS, buildSceneModel } from "@/lib/scene";
import gsap from "gsap";

const MONTHLY_INCOME_CENTS = 300_000;
const WAIT_MS = 3000;
const DURATION_MS = MOMENT_DURATION_MS.exorcismComplete;
const SLOW_FRAME_MS = 700;
const PAST_END_MS = 100;
const WAX = '[data-moment="candle"]';
const FLAME = '[data-moment="candle-flame"]';

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

let tickers: Array<() => void> = [];
let clock = 0;

/** The wall-clock driver's callback (GSAP registers its own anonymous ticker callbacks too). */
const driverTicks = (): Array<() => void> => tickers.filter((entry) => entry.name === "tick");

beforeEach(() => {
  tickers = [];
  clock = 0;
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
});

async function start(signal: AbortSignal) {
  const model = buildSceneModel({ houseState, monthlyIncomeCents: MONTHLY_INCOME_CENTS, graveyard: [], bound: false });
  const view = render(<HouseScene model={model} held />);
  const scene = view.container.querySelector<HTMLElement>('[data-part="scene"]');
  if (!scene) throw new Error("The Scene did not render.");
  const layer = document.createElement("div");
  document.body.appendChild(layer);
  const cleanups: Array<() => void> = [];
  const target: MomentTarget = { scene, layer, getLiveModel: () => model, registerCleanup: (c) => void cleanups.push(c) };
  const options: MomentOptions = { request: { kind: "exorcismComplete" }, signal, durationMs: DURATION_MS };
  let finished = false;
  const done = playThreeCandlesMoment(target, options).then(() => {
    finished = true;
  });
  await vi.waitFor(() => expect(driverTicks()).toHaveLength(1), { timeout: WAIT_MS });
  return {
    layer,
    cleanups,
    done,
    isDone: () => finished,
    frame: (ms: number) => {
      clock = ms;
      driverTicks()[0]?.();
    },
  };
}

const opacities = (layer: HTMLElement, selector: string): number[] =>
  Array.from(layer.querySelectorAll<HTMLElement>(selector)).map((el) => Number(el.style.opacity));

describe("three-candles Moment timing (spaced frames)", () => {
  it("lights the candles in order and ends on schedule when frames arrive 700 ms apart", async () => {
    const run = await start(new AbortController().signal);
    expect(opacities(run.layer, FLAME)).toEqual([0, 0, 0]);

    // Frames 700 ms apart: at 700 ms the first two flames are lit and the third is still rising.
    run.frame(SLOW_FRAME_MS);
    const [first, second, third] = opacities(run.layer, FLAME);
    expect(first).toBe(1);
    expect(second).toBe(1);
    expect(third).toBeGreaterThan(0);
    expect(third).toBeLessThan(1);
    expect(run.isDone()).toBe(false);

    // 1400 ms is past the 1200 ms Moment: with plain GSAP ticker playback, lag smoothing would count
    // each slow frame as 33 ms and the Moment would still be near its start.
    run.frame(2 * SLOW_FRAME_MS);
    await run.done;
    expect(run.isDone()).toBe(true);
    expect(opacities(run.layer, WAX).every((value) => value === 0)).toBe(true);
    expect(opacities(run.layer, FLAME).every((value) => value === 0)).toBe(true);
    expect(driverTicks(), "the driver stopped itself").toHaveLength(0);
  });

  it("stops the driver and shows the end state when aborted", async () => {
    const controller = new AbortController();
    const run = await start(controller.signal);
    run.frame(PAST_END_MS);
    controller.abort();
    await run.done;
    expect(driverTicks()).toHaveLength(0);
    run.cleanups[0]?.();
    expect(run.layer.children).toHaveLength(0);
  });
});
