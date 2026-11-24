// Feature: house-scene, Property 14: Queue order, no overlap, gap and pending limit
import { afterEach, describe, expect, it, vi } from "vitest";
import fc from "fast-check";
import { createMomentQueue, type MomentOutcome } from "@/lib/moments/queue";
import type { MomentRequest } from "@/lib/moments/types";
import type { DecayLevel } from "@/lib/haunting/config";

/**
 * **Validates: Requirements 12.4, 12.6, 18.6**
 *
 * Drives a real queue with fake timers and a command language, and checks
 * against a small model of the pending list: at most one play at a time,
 * FIFO start order after level merging, the gap between plays, the pending
 * limit and a single pending level request.
 */

type Command =
  | { type: "enqueue"; kind: "cancel" | "payment" | "level" }
  | { type: "advance"; ms: number }
  | { type: "skipAll" }
  | { type: "unmount" }
  | { type: "resolvePlay" }
  | { type: "rejectPlay" }
  | { type: "neverResolve" };

type PlayRecord = {
  id: number;
  startedAt: number;
  endedAt: number | null;
  hung: boolean;
  resolve: () => void;
  reject: () => void;
};

type ModelEntry = { id: number; isLevel: boolean };

const LEVEL_TARGET_OFFSET = 1000;

const commandArbitrary: fc.Arbitrary<Command> = fc.oneof(
  { weight: 5, arbitrary: fc.constantFrom<"cancel" | "payment" | "level">("cancel", "payment", "level").map((kind): Command => ({ type: "enqueue", kind })) },
  { weight: 5, arbitrary: fc.integer({ min: 0, max: 800 }).map((ms): Command => ({ type: "advance", ms })) },
  { weight: 1, arbitrary: fc.constant<Command>({ type: "skipAll" }) },
  { weight: 1, arbitrary: fc.constant<Command>({ type: "unmount" }) },
  { weight: 4, arbitrary: fc.constant<Command>({ type: "resolvePlay" }) },
  { weight: 1, arbitrary: fc.constant<Command>({ type: "rejectPlay" }) },
  { weight: 1, arbitrary: fc.constant<Command>({ type: "neverResolve" }) },
);

function makeRequest(kind: "cancel" | "payment" | "level", id: number): MomentRequest {
  if (kind === "cancel") {
    return { kind: "cancel", subscriptionId: String(id), name: `s${id}`, monthlyCents: 100, target: "zombie" };
  }
  if (kind === "payment") return { kind: "payment", origin: null, hasCrack: false };
  return { kind: "level", from: id as DecayLevel, to: (id + LEVEL_TARGET_OFFSET) as DecayLevel };
}

/** Identifies a played request by its position id (levels keep the earliest `from`). */
function requestId(request: MomentRequest, paymentIds: WeakMap<object, number>): number {
  if (request.kind === "cancel") return Number(request.subscriptionId);
  if (request.kind === "level") return request.from;
  return paymentIds.get(request) ?? -1;
}

async function runScenario(
  commands: Command[],
  gapMs: number,
  hardCapMs: number,
  maxPending: number,
): Promise<void> {
  vi.useFakeTimers();
  try {
    const plays: PlayRecord[] = [];
    const model: ModelEntry[] = [];
    const paymentIds = new WeakMap<object, number>();
    let inEnqueue = false;
    const violations: string[] = [];
    let destroyed = false;
    let nextId = 1;
    let enqueued = 0;
    let settled = 0;
    const outcomes: MomentOutcome[] = [];

    const queue = createMomentQueue({
      gapMs,
      hardCapMs,
      maxPending,
      isTargetMounted: () => true,
      play: (request, signal) => {
        const previous = plays[plays.length - 1];
        // At most one play at a time.
        if (previous && previous.endedAt === null) violations.push("overlap: previous play still running");
        // The gap applies when the next play follows a play (gap timer); an enqueue on an idle queue starts at once.
        if (previous && !inEnqueue && Date.now() < (previous.endedAt as number) + gapMs) {
          violations.push("gap: next play started before gapMs elapsed");
        }
        // FIFO order after level merging: the started request is the model head.
        const head = model.shift();
        if (!head || requestId(request, paymentIds) !== head.id) violations.push("order: started request is not the oldest pending");
        const record: PlayRecord = {
          id: head?.id ?? -1,
          startedAt: Date.now(),
          endedAt: null,
          hung: false,
          resolve: () => undefined,
          reject: () => undefined,
        };
        plays.push(record);
        signal.addEventListener("abort", () => {
          if (record.endedAt === null) record.endedAt = Date.now();
        });
        return new Promise<void>((resolve, reject) => {
          record.resolve = resolve;
          record.reject = reject;
        });
      },
    });

    const checkInvariants = (): void => {
      expect(violations).toEqual([]);
      expect(queue.pendingCount).toBe(model.length);
      expect(model.filter((e) => e.isLevel).length).toBeLessThanOrEqual(1);
    };

    const flush = async (ms: number): Promise<void> => {
      await vi.advanceTimersByTimeAsync(ms);
    };

    const current = (): PlayRecord | undefined => {
      const last = plays[plays.length - 1];
      return last && last.endedAt === null ? last : undefined;
    };

    for (const command of commands) {
      switch (command.type) {
        case "enqueue": {
          const id = nextId++;
          const request = makeRequest(command.kind, id);
          if (command.kind === "payment") paymentIds.set(request, id);
          if (destroyed) {
            // A destroyed queue drops every request without queueing it.
            enqueued++;
            void queue.enqueue(request).then((outcome) => {
              settled++;
              expect(outcome).toBe("dropped");
            });
            break;
          }
          if (command.kind === "level") {
            const existing = model.find((e) => e.isLevel);
            if (!existing) model.push({ id, isLevel: true });
          } else {
            model.push({ id, isLevel: false });
          }
          enqueued++;
          inEnqueue = true;
          void queue.enqueue(request).then((outcome) => {
            settled++;
            outcomes.push(outcome);
          });
          inEnqueue = false;
          // The queue trims after it may have started a play (which shifted the model head).
          while (model.length > maxPending) model.shift();
          expect(queue.pendingCount).toBeLessThanOrEqual(maxPending);
          break;
        }
        case "advance":
          await flush(command.ms);
          break;
        case "skipAll":
        case "unmount":
          if (command.type === "skipAll") queue.skipAll();
          else {
            queue.destroy();
            destroyed = true;
          }
          model.length = 0;
          await flush(0);
          expect(queue.pendingCount).toBe(0);
          break;
        case "resolvePlay":
        case "rejectPlay": {
          const play = current();
          if (play && !play.hung) {
            play.endedAt = Date.now();
            if (command.type === "resolvePlay") play.resolve();
            else play.reject();
          }
          await flush(0);
          break;
        }
        case "neverResolve": {
          const play = current();
          if (play) play.hung = true;
          break;
        }
      }
      checkInvariants();
    }

    // The hard cap ends hung plays and every promise settles exactly once.
    queue.skipAll();
    await flush(hardCapMs + gapMs + 1);
    expect(settled).toBe(enqueued);
  } finally {
    vi.useRealTimers();
  }
}

describe("Property 14: queue order, no overlap, gap and pending limit", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps order, one play at a time, the gap and the pending limit for any command sequence", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(commandArbitrary, { minLength: 1, maxLength: 40 }),
        fc.integer({ min: 1, max: 300 }),
        fc.integer({ min: 200, max: 2000 }),
        fc.integer({ min: 1, max: 4 }),
        async (commands, gapMs, hardCapMs, maxPending) => {
          await runScenario(commands, gapMs, hardCapMs, maxPending);
        },
      ),
      { numRuns: 150 },
    );
  });
});
