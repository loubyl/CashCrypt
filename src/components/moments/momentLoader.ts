import { MOMENT_DURATION_MS, REDUCED_MOTION_FADE_MS } from "@/lib/scene";
import type { MomentDurationKey, SceneModel } from "@/lib/scene";
import type { MomentRequest } from "@/lib/moments/types";

/** What a Moment needs to play: the Scene, the Moment_Layer and cleanup registration. */
export type MomentTarget = {
  scene: HTMLElement;
  layer: HTMLElement;
  /** Post-action data (the Scene draws the frozen model while a hold is active). */
  getLiveModel: () => SceneModel;
  /** Registered cleanups run when the hold is released. */
  registerCleanup: (cleanup: () => void) => void;
};

export type MomentOptions = {
  request: MomentRequest;
  signal: AbortSignal;
  durationMs: number;
};

export type MomentPlayer = (target: MomentTarget, options: MomentOptions) => Promise<void>;

type MomentKind = MomentRequest["kind"];

/**
 * Request kind to dynamic import of its `playXMoment` function. A kind with no entry
 * yet ends at its End_State; each entry is `() => import("./XMoment").then((m) => m.playXMoment)`.
 */
const MOMENT_IMPORTS: Partial<Record<MomentKind, () => Promise<MomentPlayer>>> = {
  cancel: () => import("./ShovelMoment").then((module) => module.playShovelMoment),
  payment: () => import("./CandleOrbMoment").then((module) => module.playCandleOrbMoment),
  sigil: () => import("./SigilMoment").then((module) => module.playSigilMoment),
};

/** The duration key of a request. Better levels have a lower number. */
export function getDurationKey(request: MomentRequest): MomentDurationKey {
  switch (request.kind) {
    case "level":
      return request.to < request.from ? "levelBetter" : "levelWorse";
    default:
      return request.kind;
  }
}

/** Resolves after `ms`, or at once when the signal aborts. */
function wait(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise<void>((resolve) => {
    if (signal.aborted) {
      resolve();
      return;
    }
    const finish = (): void => {
      clearTimeout(timer);
      signal.removeEventListener("abort", finish);
      resolve();
    };
    const timer = setTimeout(finish, ms);
    signal.addEventListener("abort", finish);
  });
}

/**
 * The `play` option of the queue. Under reduced motion it resolves after the
 * short fade without importing any animation code. A kind with no entry yet, or an
 * import that fails, resolves at once so the Moment ends at its End_State.
 */
export async function playMoment(
  request: MomentRequest,
  target: MomentTarget,
  signal: AbortSignal,
  reducedMotion: boolean,
): Promise<void> {
  if (reducedMotion) {
    await wait(REDUCED_MOTION_FADE_MS, signal);
    return;
  }
  const load = MOMENT_IMPORTS[request.kind];
  if (!load) return;
  let player: MomentPlayer;
  try {
    player = await load();
  } catch {
    return;
  }
  if (signal.aborted) return;
  await player(target, { request, signal, durationMs: MOMENT_DURATION_MS[getDurationKey(request)] });
}
