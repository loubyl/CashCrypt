// The Ghost arrival Moment plays by the wall clock: the drawn copy rises to the live rest point and fades in,
// the overflow variant shows the live count and hides the frozen marker for the duration, and an abort leaves
// no art (action-feedback Requirements 4.6, 4.7, 4.10, 11.1 to 11.4).
// The GSAP mock applies each tween's end values to the DOM once the timeline time passes its end.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MomentOptions, MomentTarget } from "@/components/moments/momentLoader";
import type { HouseState } from "@/lib/haunting";
import { GHOST_ARRIVAL_RISE, MARKER_PULSE_SCALE, MOMENT_DURATION_MS, SCENE_CONFIG, buildSceneModel } from "@/lib/scene";
type Vars = Record<string, unknown>;
type Tween = { target: unknown; vars: Vars; end: number };
const rec = vi.hoisted(() => ({
  paused: false,
  times: [] as number[],
  tickers: [] as Array<() => void>,
  scales: [] as number[],
  ys: [] as number[],
}));
function applyVars(target: unknown, vars: Vars): void {
  if (!(target instanceof Element)) return;
  const el = target as SVGElement;
  if (typeof vars.opacity === "number") el.style.opacity = String(vars.opacity);
  if (typeof vars.scale === "number") {
    el.setAttribute("data-scale", String(vars.scale));
    rec.scales.push(vars.scale);
  }
  if (typeof vars.y === "number") {
    el.setAttribute("data-y", String(vars.y));
    rec.ys.push(vars.y);
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
const MS_PER_S = 1000;
const FRAME_GAP_MS = 700;
const FIRST_FRAME_MS = 1500;
const MAX_FRAMES = 6;
const MONTHLY_INCOME_CENTS = 300_000;
const NEW_ID = "new-ghost";
const MARKER_SELECTOR = '[data-part="overflow-marker"][data-kind="ghosts"]';
function ghostsOf(count: number): HouseState["ghosts"] {
  return Array.from({ length: count }, (_, index) => ({
    transactionId: index === 0 ? NEW_ID : `g${index}`,
    amount: index === 0 ? 1 : 400 + index,
    description: "coffee",
    date: "2025-01-01",
    category: "coffee",
  })) ;
}
function buildTarget(ghostCount: number, frozenOverflow = 0): { target: MomentTarget; cleanups: Array<() => void> } {
  const houseState: HouseState = {
    lightScore: 50,
    baseScore: 50,
    momentum: 0,
    decayLevel: 3,
    windowBrightness: 0.4,
    levelProgress: 0.5,
    zombies: [],
    ghosts: ghostsOf(ghostCount),
    poltergeist: null,
  };
  const model = buildSceneModel({ houseState, monthlyIncomeCents: MONTHLY_INCOME_CENTS, graveyard: [], bound: false });
  const scene = document.createElement("div");
  scene.innerHTML =
    `<svg><g data-part="ghosts"></g></svg>` +
    (frozenOverflow > 0 ? `<span data-part="overflow-marker" data-kind="ghosts">+${frozenOverflow}</span>` : "");
  const layer = document.createElement("div");
  document.body.append(scene, layer);
  const cleanups: Array<() => void> = [];
  return { target: { scene, layer, getLiveModel: () => model, registerCleanup: (fn) => void cleanups.push(fn) }, cleanups };
}
function options(transactionId: string, signal: AbortSignal = new AbortController().signal): MomentOptions {
  return { request: { kind: "ghostArrival", transactionId }, signal, durationMs: MOMENT_DURATION_MS.ghostArrival };
}
async function runToEnd(target: MomentTarget, id: string, firstFrameMs: number): Promise<{ resolved: boolean }> {
  const { playGhostArrivalMoment } = await import("@/components/moments/GhostArrivalMoment");
  const now = vi.spyOn(performance, "now");
  now.mockReturnValue(0);
  const state = { resolved: false };
  const done = playGhostArrivalMoment(target, options(id)).then(() => {
    state.resolved = true;
  });
  await vi.waitFor(() => expect(rec.tickers).toHaveLength(1), { timeout: 2000 });
  let frames = 0;
  while (!state.resolved && frames < MAX_FRAMES) {
    now.mockReturnValue(firstFrameMs + frames * FRAME_GAP_MS);
    frames += 1;
    rec.tickers[0]?.();
    await Promise.resolve();
  }
  await done;
  return state;
}
beforeEach(() => {
  rec.paused = false;
  rec.times = [];
  rec.tickers = [];
  rec.scales = [];
  rec.ys = [];
  vi.resetModules();
});
afterEach(() => {
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});
describe("ghost arrival moment", () => {
  it("draws the copy at the live rest point, rises by GHOST_ARRIVAL_RISE and ends by the wall clock", async () => {
    const { target } = buildTarget(3);
    const ghost = target.getLiveModel().ghosts.find((entry) => entry.id === NEW_ID);
    expect(ghost, "the new ghost is drawn").toBeDefined();
    const state = await runToEnd(target, NEW_ID, FRAME_GAP_MS);
    const copy = target.layer.querySelector<SVGElement>('[data-moment="ghost-arrival"]');
    const durationS = MOMENT_DURATION_MS.ghostArrival / MS_PER_S;
    expect(state.resolved).toBe(true);
    expect(rec.paused).toBe(true);
    expect(rec.ys[0], "starts below the rest point").toBe(GHOST_ARRIVAL_RISE);
    expect(target.layer.querySelector('[data-moment="ghost-arrival-rise"]')?.getAttribute("data-y")).toBe("0");
    expect(copy?.style.opacity, "visible at the end").toBe("1");
    expect(copy?.getAttribute("transform")).toBe(`translate(${ghost?.rest.x} ${ghost?.rest.y})`);
    expect(rec.times.at(-1) ?? 0).toBeGreaterThanOrEqual(durationS);
    expect(rec.tickers, "the driver stops itself").toHaveLength(0);
  });
  it("ends after a first frame 1.5 s in, and settles the halo back to 25%", async () => {
    const { target } = buildTarget(2);
    const state = await runToEnd(target, NEW_ID, FIRST_FRAME_MS);
    const halo = target.layer.querySelector<SVGElement>('[data-moment="ghost-arrival"] [data-part="ghost-halo"] path');
    expect(state.resolved).toBe(true);
    expect(halo?.style.opacity).toBe("0.25");
  });
  it("shows the live count and hides the frozen marker for the overflow variant, restoring it on cleanup", async () => {
    const overCap = SCENE_CONFIG.MAX_VISIBLE_GHOSTS + 3;
    const { target, cleanups } = buildTarget(overCap, overCap - 1 - SCENE_CONFIG.MAX_VISIBLE_GHOSTS);
    const live = target.getLiveModel();
    expect(live.ghosts.some((entry) => entry.id === NEW_ID), "the new ghost is beyond the cap").toBe(false);
    const { playGhostArrivalMoment } = await import("@/components/moments/GhostArrivalMoment");
    const now = vi.spyOn(performance, "now");
    now.mockReturnValue(0);
    const done = playGhostArrivalMoment(target, options(NEW_ID));
    await vi.waitFor(() => expect(rec.tickers).toHaveLength(1), { timeout: 2000 });
    const frozen = target.scene.querySelector<HTMLElement>(MARKER_SELECTOR);
    const marker = target.layer.querySelector<HTMLElement>('[data-moment="marker-pulse"]');
    expect(marker?.textContent).toBe(`+${live.overflow.ghosts}`);
    expect(marker?.style.opacity).toBe("1");
    expect(frozen?.style.opacity, "frozen marker hidden while playing").toBe("0");
    now.mockReturnValue(MOMENT_DURATION_MS.ghostArrival + 1);
    rec.tickers[0]?.();
    await done;
    expect(Math.max(...rec.scales)).toBe(MARKER_PULSE_SCALE);
    expect(target.layer.querySelector('[data-moment="marker-pulse-inner"]')?.getAttribute("data-scale")).toBe("1");
    expect(frozen?.style.opacity, "still hidden until the hold is released").toBe("0");
    cleanups.forEach((fn) => fn());
    expect(frozen?.style.opacity).toBe("");
    expect(target.layer.children).toHaveLength(0);
  });
  it("jumps to the end state and leaves no art after an abort", async () => {
    const { playGhostArrivalMoment } = await import("@/components/moments/GhostArrivalMoment");
    const controller = new AbortController();
    const { target, cleanups } = buildTarget(2);
    const done = playGhostArrivalMoment(target, options(NEW_ID, controller.signal));
    await vi.waitFor(() => expect(rec.tickers).toHaveLength(1), { timeout: 2000 });
    controller.abort();
    await done;
    expect(rec.tickers, "the driver is stopped").toHaveLength(0);
    expect(target.layer.querySelector<SVGElement>('[data-moment="ghost-arrival"]')?.style.opacity).toBe("1");
    cleanups.forEach((fn) => fn());
    expect(target.layer.querySelector("[data-moment]"), "no art left in the layer").toBeNull();
    expect(target.layer.children).toHaveLength(0);
  });
});
