// Example tests for the Moment queue (house-scene task 9.11). Requirements: 12.4, 12.6, 12.12.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createInitialHoldState, holdReducer } from "@/lib/moments/hold";
import type { HoldEvent } from "@/lib/moments/hold";
import { createMomentQueue } from "@/lib/moments/queue";
import type { MomentOutcome } from "@/lib/moments/queue";
import type { MomentRequest } from "@/lib/moments/types";

const GAP_MS = 200;
const HARD_CAP_MS = 2500;
const MAX_PENDING = 4;
const SIGIL: MomentRequest = { kind: "sigil" };
const COMPLETE: MomentRequest = { kind: "exorcismComplete" };

type Gate = { request: MomentRequest; signal: AbortSignal; finish: () => void };

function setup(
  overrides: {
    isTargetMounted?: () => boolean;
    shouldDrop?: (request: MomentRequest) => boolean;
    onBusy?: () => void;
    onIdle?: () => void;
  } = {},
) {
  const started: Gate[] = [];
  const queue = createMomentQueue({
    play: (request, signal) =>
      new Promise<void>((resolve) => {
        started.push({ request, signal, finish: resolve });
      }),
    isTargetMounted: overrides.isTargetMounted ?? (() => true),
    gapMs: GAP_MS,
    hardCapMs: HARD_CAP_MS,
    maxPending: MAX_PENDING,
    shouldDrop: overrides.shouldDrop,
    onBusy: overrides.onBusy,
    onIdle: overrides.onIdle,
  });
  return { queue, started };
}

async function flush(): Promise<void> {
  await vi.advanceTimersByTimeAsync(0);
}

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe("Moment queue gap", () => {
  it("starts the first request right away", async () => {
    const { queue, started } = setup();
    void queue.enqueue(SIGIL);
    expect(queue.state).toBe("playing");
    expect(started).toHaveLength(1);
  });

  it("waits the gap length between two Moments", async () => {
    const { queue, started } = setup();
    const first = queue.enqueue(SIGIL);
    void queue.enqueue(COMPLETE);
    started[0].finish();
    await expect(first).resolves.toBe("completed");
    expect(queue.state).toBe("gap");
    await vi.advanceTimersByTimeAsync(GAP_MS - 1);
    expect(started).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(started).toHaveLength(2);
    expect(queue.state).toBe("playing");
  });

  it("goes idle after the last Moment without a gap", async () => {
    const { queue, started } = setup();
    const done = queue.enqueue(SIGIL);
    started[0].finish();
    await done;
    expect(queue.state).toBe("idle");
  });
});

describe("Moment queue skip", () => {
  it("skips the playing Moment and every pending one, and aborts the signal", async () => {
    const { queue, started } = setup();
    const outcomes: Promise<MomentOutcome>[] = [queue.enqueue(SIGIL), queue.enqueue(COMPLETE), queue.enqueue(SIGIL)];
    queue.skipAll();
    await expect(Promise.all(outcomes)).resolves.toEqual(["skipped", "skipped", "skipped"]);
    expect(started[0].signal.aborted).toBe(true);
    expect(queue.state).toBe("idle");
    expect(queue.pendingCount).toBe(0);
  });

  it("skips pending Moments during a gap so nothing starts later", async () => {
    const { queue, started } = setup();
    const first = queue.enqueue(SIGIL);
    const second = queue.enqueue(COMPLETE);
    started[0].finish();
    await first;
    queue.skipAll();
    await expect(second).resolves.toBe("skipped");
    await vi.advanceTimersByTimeAsync(GAP_MS * 2);
    expect(started).toHaveLength(1);
  });

  it("drops a request whose target is no longer mounted", async () => {
    let mounted = true;
    const { queue, started } = setup({ isTargetMounted: () => mounted });
    const first = queue.enqueue(SIGIL);
    const second = queue.enqueue(COMPLETE);
    mounted = false;
    started[0].finish();
    await first;
    await vi.advanceTimersByTimeAsync(GAP_MS);
    await expect(second).resolves.toBe("dropped");
    expect(started).toHaveLength(1);
  });
});

describe("Moment queue hard cap", () => {
  it("skips a Moment that never finishes once the hard cap passes", async () => {
    const { queue, started } = setup();
    const outcome = queue.enqueue(SIGIL);
    await vi.advanceTimersByTimeAsync(HARD_CAP_MS - 1);
    expect(queue.state).toBe("playing");
    await vi.advanceTimersByTimeAsync(1);
    await expect(outcome).resolves.toBe("skipped");
    expect(started[0].signal.aborted).toBe(true);
  });

  it("starts the next Moment after a capped one and the gap", async () => {
    const { queue, started } = setup();
    void queue.enqueue(SIGIL);
    void queue.enqueue(COMPLETE);
    await vi.advanceTimersByTimeAsync(HARD_CAP_MS + GAP_MS);
    expect(started).toHaveLength(2);
  });

  it("skips the oldest pending request when more than the maximum are waiting", async () => {
    const { queue } = setup();
    void queue.enqueue(SIGIL);
    const pending = Array.from({ length: MAX_PENDING + 1 }, () => queue.enqueue(COMPLETE));
    await flush();
    await expect(pending[0]).resolves.toBe("skipped");
    expect(queue.pendingCount).toBe(MAX_PENDING);
  });
});

describe("Moment queue level merge", () => {
  it("merges two pending level requests into one from the first to the last level", async () => {
    const { queue, started } = setup();
    void queue.enqueue(SIGIL);
    const early = queue.enqueue({ kind: "level", from: 5, to: 4 });
    const late = queue.enqueue({ kind: "level", from: 4, to: 3 });
    await expect(early).resolves.toBe("skipped");
    expect(queue.pendingCount).toBe(1);
    started[0].finish();
    await vi.advanceTimersByTimeAsync(GAP_MS);
    expect(started[1].request).toEqual({ kind: "level", from: 5, to: 3 });
    started[1].finish();
    await expect(late).resolves.toBe("completed");
  });

  it("drops the merged request when it ends on the level it started from", async () => {
    const { queue } = setup();
    void queue.enqueue(SIGIL);
    const early = queue.enqueue({ kind: "level", from: 4, to: 3 });
    const late = queue.enqueue({ kind: "level", from: 3, to: 4 });
    await expect(early).resolves.toBe("skipped");
    await expect(late).resolves.toBe("dropped");
    expect(queue.pendingCount).toBe(0);
  });
});

describe("Moment queue idle notification for dropped requests", () => {
  it("fires onBusy then onIdle when a lone request is dropped by shouldDrop", async () => {
    const events: string[] = [];
    const { queue, started } = setup({
      shouldDrop: () => true,
      onBusy: () => events.push("busy"),
      onIdle: () => events.push("idle"),
    });
    await expect(queue.enqueue(SIGIL)).resolves.toBe("dropped");
    expect(events).toEqual(["busy", "idle"]);
    expect(queue.state).toBe("idle");
    expect(started).toHaveLength(0);
  });

  it("fires onBusy then onIdle when a lone request is dropped because the target is not mounted", async () => {
    const events: string[] = [];
    const { queue } = setup({
      isTargetMounted: () => false,
      onBusy: () => events.push("busy"),
      onIdle: () => events.push("idle"),
    });
    await expect(queue.enqueue(SIGIL)).resolves.toBe("dropped");
    expect(events).toEqual(["busy", "idle"]);
  });

  it("releases a hold driven by queueBusy and queueIdle when the only request is dropped", async () => {
    let hold = createInitialHoldState<string>();
    const apply = (event: HoldEvent<string>) => {
      hold = holdReducer(hold, event);
    };
    const { queue } = setup({
      shouldDrop: () => true,
      onBusy: () => apply({ type: "queueBusy" }),
      onIdle: () => apply({ type: "queueIdle" }),
    });
    apply({ type: "begin", live: "scene", freeze: true });
    const outcome = await queue.enqueue(SIGIL);
    apply({ type: "settled" });
    expect(outcome).toBe("dropped");
    expect(hold.frozen).toBeNull();
  });

  it("does not call onBusy or onIdle when enqueueing after destroy", async () => {
    const events: string[] = [];
    const { queue } = setup({ onBusy: () => events.push("busy"), onIdle: () => events.push("idle") });
    queue.destroy();
    await expect(queue.enqueue(SIGIL)).resolves.toBe("dropped");
    expect(events).toEqual([]);
    expect(queue.state).toBe("idle");
  });
});
