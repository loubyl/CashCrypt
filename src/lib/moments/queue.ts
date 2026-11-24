/**
 * Pure Promise-based Moment queue.
 *
 * FIFO, one request at a time, `gapMs` between two Moments. Every promise
 * returned by `enqueue` settles exactly once. No React, no DOM types except
 * `AbortSignal`; timers are `setTimeout` so fake timers can drive it.
 */

import type { MomentRequest } from "@/lib/moments/types";

export type MomentOutcome = "completed" | "skipped" | "dropped";

export type MomentQueueState = "idle" | "playing" | "gap";

export type MomentQueueOptions = {
  play: (request: MomentRequest, signal: AbortSignal) => Promise<void>;
  isTargetMounted: () => boolean;
  shouldDrop?: (request: MomentRequest) => boolean;
  gapMs: number;
  hardCapMs: number;
  maxPending: number;
  /** Called when the queue leaves idle (an enqueue arrives while idle). Pairs with `onIdle`. */
  onBusy?: () => void;
  /** Called every time the queue returns to idle, including when a lone request is dropped. */
  onIdle?: () => void;
};

export type MomentQueue = {
  enqueue(request: MomentRequest): Promise<MomentOutcome>;
  skipAll(): void;
  destroy(): void;
  readonly state: MomentQueueState;
  readonly pendingCount: number;
};

type Entry = {
  request: MomentRequest;
  settled: boolean;
  resolve: (outcome: MomentOutcome) => void;
};

type Current = {
  entry: Entry;
  controller: AbortController;
  hardCapTimer: ReturnType<typeof setTimeout> | null;
};

function settle(entry: Entry, outcome: MomentOutcome): void {
  if (entry.settled) return;
  entry.settled = true;
  entry.resolve(outcome);
}

export function createMomentQueue(options: MomentQueueOptions): MomentQueue {
  const pending: Entry[] = [];
  let state: MomentQueueState = "idle";
  let current: Current | null = null;
  let gapTimer: ReturnType<typeof setTimeout> | null = null;
  let destroyed = false;

  function goIdle(): void {
    state = "idle";
    options.onIdle?.();
  }

  function shouldDropRequest(request: MomentRequest): boolean {
    return !options.isTargetMounted() || (options.shouldDrop?.(request) ?? false);
  }

  function afterPlay(): void {
    current = null;
    if (pending.length === 0) {
      goIdle();
      return;
    }
    state = "gap";
    gapTimer = setTimeout(() => {
      gapTimer = null;
      startNext();
    }, options.gapMs);
  }

  function finishCurrent(run: Current, outcome: MomentOutcome): void {
    if (current !== run || run.entry.settled) return;
    if (run.hardCapTimer !== null) clearTimeout(run.hardCapTimer);
    run.hardCapTimer = null;
    settle(run.entry, outcome);
    afterPlay();
  }

  function startPlay(entry: Entry): void {
    const controller = new AbortController();
    const run: Current = { entry, controller, hardCapTimer: null };
    current = run;
    state = "playing";
    run.hardCapTimer = setTimeout(() => {
      controller.abort();
      finishCurrent(run, "skipped");
    }, options.hardCapMs);
    let playing: Promise<void>;
    try {
      playing = Promise.resolve(options.play(entry.request, controller.signal));
    } catch {
      playing = Promise.reject(new Error("moment play failed"));
    }
    playing.then(
      () => finishCurrent(run, controller.signal.aborted ? "skipped" : "completed"),
      () => finishCurrent(run, "skipped"),
    );
  }

  function startNext(): void {
    while (pending.length > 0) {
      const entry = pending.shift() as Entry;
      if (shouldDropRequest(entry.request)) {
        settle(entry, "dropped");
        continue;
      }
      startPlay(entry);
      return;
    }
    // Also reached from an idle enqueue whose requests were all dropped:
    // `onBusy` already fired, so `onIdle` must fire to release any hold.
    // Also reached from an idle enqueue whose requests were all dropped:
    // `onBusy` already fired, so `onIdle` must fire to release any hold.
    goIdle();
  }

  function mergeLevel(request: Extract<MomentRequest, { kind: "level" }>): Entry | null {
    const index = pending.findIndex((e) => e.request.kind === "level");
    if (index < 0) return null;
    const earlier = pending[index];
    const first = earlier.request as Extract<MomentRequest, { kind: "level" }>;
    settle(earlier, "skipped");
    const merged: Entry = {
      request: { kind: "level", from: first.from, to: request.to },
      settled: false,
      resolve: () => undefined,
    };
    pending[index] = merged;
    return merged;
  }

  function trimPending(): void {
    while (pending.length > options.maxPending) {
      const oldest = pending.shift() as Entry;
      settle(oldest, "skipped");
    }
  }

  function enqueue(request: MomentRequest): Promise<MomentOutcome> {
    if (destroyed) return Promise.resolve("dropped");
    return new Promise<MomentOutcome>((resolve) => {
      let entry: Entry = { request, settled: false, resolve };
      const merged = request.kind === "level" ? mergeLevel(request) : null;
      if (merged) {
        // The merged entry carries the latest caller's promise.
        merged.resolve = resolve;
        entry = merged;
        const level = merged.request as Extract<MomentRequest, { kind: "level" }>;
        if (level.from === level.to) {
          pending.splice(pending.indexOf(merged), 1);
          settle(merged, "dropped");
        }
      } else {
        pending.push(entry);
      }
      if (state === "idle") {
        options.onBusy?.();
        startNext();
      }
      trimPending();
    });
  }

  function skipAll(): void {
    const wasIdle = state === "idle";
    if (gapTimer !== null) clearTimeout(gapTimer);
    gapTimer = null;
    const run = current;
    current = null;
    if (run) {
      if (run.hardCapTimer !== null) clearTimeout(run.hardCapTimer);
      run.controller.abort();
      settle(run.entry, "skipped");
    }
    const drained = pending.splice(0, pending.length);
    for (const entry of drained) settle(entry, "skipped");
    state = "idle";
    if (!wasIdle) options.onIdle?.();
  }

  return {
    enqueue,
    skipAll,
    destroy(): void {
      if (destroyed) return;
      skipAll();
      destroyed = true;
    },
    get state() {
      return state;
    },
    get pendingCount() {
      return pending.length;
    },
  };
}
