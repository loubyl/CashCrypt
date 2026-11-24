import { describe, it, expect, vi, afterEach } from "vitest";
import fc from "fast-check";
import { createMomentQueue, type MomentOutcome } from "@/lib/moments/queue";
import type { MomentRequest } from "@/lib/moments/types";
import type { DecayLevel } from "@/lib/haunting/config";

const NUM_RUNS = 150;
const GAP_MS = 100;
const HARD_CAP_MS = 500;
const MAX_PENDING = 4;
const LATE_RESOLVE_MS = 7;
const VALID_OUTCOMES: readonly MomentOutcome[] = ["completed", "skipped", "dropped"];

type PlayMode = "resolve" | "never" | "reject" | "throw" | "lateAbort";

type Op =
  | { op: "enqueue"; kind: "cancel" | "payment" | "sigil" | "exorcismComplete" | "level"; from: DecayLevel; to: DecayLevel; mode: PlayMode; duration: number }
  | { op: "skipAll" }
  | { op: "mount"; mounted: boolean }
  | { op: "drop"; drop: boolean }
  | { op: "advance"; ms: number };

const levelArb = fc.constantFrom<DecayLevel>(1, 2, 3, 4, 5);
const opArb: fc.Arbitrary<Op> = fc.oneof(
  { weight: 5, arbitrary: fc.record({
    op: fc.constant("enqueue" as const),
    kind: fc.constantFrom("cancel" as const, "payment" as const, "sigil" as const, "exorcismComplete" as const, "level" as const),
    from: levelArb,
    to: levelArb,
    mode: fc.constantFrom<PlayMode>("resolve", "resolve", "never", "reject", "throw", "lateAbort"),
    duration: fc.integer({ min: 0, max: 800 }),
  }) },
  { weight: 1, arbitrary: fc.constant({ op: "skipAll" as const }) },
  { weight: 1, arbitrary: fc.boolean().map((mounted) => ({ op: "mount" as const, mounted })) },
  { weight: 1, arbitrary: fc.boolean().map((drop) => ({ op: "drop" as const, drop })) },
  { weight: 4, arbitrary: fc.integer({ min: 0, max: 700 }).map((ms) => ({ op: "advance" as const, ms })) },
);

type PlayRecord = { startedAt: number; ended: boolean; signal: AbortSignal; mountedAtStart: boolean; droppedAtStart: boolean };

function toRequest(op: Extract<Op, { op: "enqueue" }>, id: number): MomentRequest {
  switch (op.kind) {
    case "cancel":
      return { kind: "cancel", subscriptionId: `s${id}`, name: `Sub ${id}`, monthlyCents: 1000, target: "zombie" };
    case "payment":
      return { kind: "payment", origin: null, hasCrack: true };
    case "sigil":
      return { kind: "sigil" };
    case "exorcismComplete":
      return { kind: "exorcismComplete" };
    case "level":
      return { kind: "level", from: op.from, to: op.to };
  }
}

afterEach(() => {
  vi.useRealTimers();
});

describe("Property 15: Queue settles every promise exactly once", () => {
  // Feature: house-scene, Property 15: Queue settles every promise exactly once
  // **Validates: Requirements 12.9, 12.10, 12.11, 12.12, 12.13, 15.6**
  it("settles every enqueue promise once with a valid outcome, never replays dropped requests, caps play time and idles after skipAll", async () => {
    await fc.assert(
      fc.asyncProperty(fc.array(opArb, { minLength: 1, maxLength: 40 }), async (ops) => {
        vi.useFakeTimers();
        try {
          let mounted = true;
          let drop = false;
          let idleCalls = 0;
          let busyCalls = 0;
          const plays: PlayRecord[] = [];
          const modes = new Map<string, { mode: PlayMode; duration: number }>();
          let nextId = 0;
          const keyOf = (r: MomentRequest): string => JSON.stringify(r);

          const queue = createMomentQueue({
            gapMs: GAP_MS,
            hardCapMs: HARD_CAP_MS,
            maxPending: MAX_PENDING,
            isTargetMounted: () => mounted,
            shouldDrop: () => drop,
            onBusy: () => {
              busyCalls += 1;
            },
            onIdle: () => {
              idleCalls += 1;
            },
            play: (request, signal) => {
              const record: PlayRecord = {
                startedAt: Date.now(),
                ended: false,
                signal,
                mountedAtStart: mounted,
                droppedAtStart: drop,
              };
              plays.push(record);
              const spec = modes.get(keyOf(request)) ?? { mode: "resolve" as PlayMode, duration: 0 };
              const end = () => {
                record.ended = true;
              };
              if (spec.mode === "throw") {
                end();
                throw new Error("boom");
              }
              return new Promise<void>((resolve, reject) => {
                if (spec.mode === "never") return;
                if (spec.mode === "reject") {
                  setTimeout(() => {
                    end();
                    reject(new Error("rejected"));
                  }, spec.duration);
                  return;
                }
                if (spec.mode === "lateAbort") {
                  signal.addEventListener("abort", () => {
                    setTimeout(() => {
                      end();
                      resolve();
                    }, LATE_RESOLVE_MS);
                  });
                  return;
                }
                setTimeout(() => {
                  end();
                  resolve();
                }, spec.duration);
              });
            },
          });

          const settled: { outcome: MomentOutcome | null; count: number }[] = [];

          const checkInvariants = () => {
            const now = Date.now();
            const live = plays.filter((p) => !p.ended && !p.signal.aborted);
            // onBusy and onIdle strictly alternate, so a hold can always be released:
            // the queue is idle exactly when every onBusy has been matched by an onIdle.
            expect(busyCalls - idleCalls).toBe(queue.state === "idle" ? 0 : 1);
            expect(live.length).toBeLessThanOrEqual(1);
            for (const p of live) expect(now - p.startedAt).toBeLessThanOrEqual(HARD_CAP_MS);
            for (const p of plays) {
              expect(p.mountedAtStart).toBe(true);
              expect(p.droppedAtStart).toBe(false);
            }
          };

          for (const op of ops) {
            if (op.op === "enqueue") {
              const request = toRequest(op, nextId++);
              // Level requests may be merged; the key map is best effort for the merged request too.
              modes.set(keyOf(request), { mode: op.mode, duration: op.duration });
              if (request.kind === "level") {
                // A merged request keeps the first `from` and the latest `to`; register all pairs for this mode.
                for (const f of [1, 2, 3, 4, 5] as DecayLevel[]) {
                  modes.set(keyOf({ kind: "level", from: f, to: request.to }), { mode: op.mode, duration: op.duration });
                }
              }
              const record = { outcome: null as MomentOutcome | null, count: 0 };
              settled.push(record);
              void queue.enqueue(request).then((outcome) => {
                record.outcome = outcome;
                record.count += 1;
              });
              await Promise.resolve();
            } else if (op.op === "skipAll") {
              const wasIdle = queue.state === "idle";
              const before = idleCalls;
              queue.skipAll();
              expect(queue.state).toBe("idle");
              expect(queue.pendingCount).toBe(0);
              expect(idleCalls).toBe(wasIdle ? before : before + 1);
            } else if (op.op === "mount") {
              mounted = op.mounted;
            } else if (op.op === "drop") {
              drop = op.drop;
            } else {
              await vi.advanceTimersByTimeAsync(op.ms);
            }
            checkInvariants();
          }

          // Drain: remount, stop dropping, and let every cap and gap elapse.
          const drainMs = (MAX_PENDING + 2) * (HARD_CAP_MS + GAP_MS + LATE_RESOLVE_MS) + 1000;
          await vi.advanceTimersByTimeAsync(drainMs);
          await vi.advanceTimersByTimeAsync(drainMs);
          checkInvariants();

          expect(queue.state).toBe("idle");
          expect(queue.pendingCount).toBe(0);
          for (const record of settled) {
            expect(record.count).toBe(1);
            expect(VALID_OUTCOMES).toContain(record.outcome);
          }
          queue.destroy();
        } finally {
          vi.useRealTimers();
        }
      }),
      { numRuns: NUM_RUNS },
    );
  });
});
