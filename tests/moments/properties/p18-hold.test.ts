import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  createInitialHoldState,
  holdReducer,
  type HoldEvent,
  type HoldState,
} from "@/lib/moments/hold";

// Feature: house-scene, Property 18: The hold keeps the first frozen model

type Model = { id: number };

const NUM_RUNS = 200;
const MAX_EVENTS = 40;

const modelArb: fc.Arbitrary<Model> = fc.nat().map((id) => ({ id }));

const eventArb: fc.Arbitrary<HoldEvent<Model>> = fc.oneof(
  fc.record({
    type: fc.constant("begin" as const),
    live: modelArb,
    freeze: fc.boolean(),
  }),
  fc.constant({ type: "settled" as const }),
  fc.constant({ type: "queueBusy" as const }),
  fc.constant({ type: "queueIdle" as const }),
);

const eventsArb = fc.array(eventArb, { maxLength: MAX_EVENTS });

describe("Property 18: the hold keeps the first frozen model", () => {
  it("keeps the first frozen model, freezes on first begin, never goes below 0 awaiting and releases when idle", () => {
    // **Validates: Requirements 12.19**
    fc.assert(
      fc.property(eventsArb, (events) => {
        let state: HoldState<Model> = createInitialHoldState<Model>();
        for (const event of events) {
          const before = state;
          state = holdReducer(before, event);

          if (event.type === "begin") {
            if (before.frozen !== null) {
              expect(state.frozen).toBe(before.frozen);
            } else if (event.freeze) {
              expect(state.frozen).toBe(event.live);
            } else {
              expect(state.frozen).toBeNull();
            }
          }
          expect(state.awaiting).toBeGreaterThanOrEqual(0);
          if (state.awaiting === 0 && state.queueIdle) {
            expect(state.frozen).toBeNull();
          }
        }
      }),
      { numRuns: NUM_RUNS },
    );
  });
});
