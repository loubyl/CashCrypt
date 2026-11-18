import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { getDeltaPresentation } from "@/lib/utils/delta";

const NUM_RUNS = 100;

const direction = fc.constantFrom("up" as const, "down" as const);
const intent = fc.constantFrom("good" as const, "bad" as const);
const amountText = fc.string({ maxLength: 12 });

describe("getDeltaPresentation", () => {
  // Feature: design-system-foundation, Property 9: Delta direction and intent are independent
  it("derives sign and icon from direction only and tone from intent only", () => {
    fc.assert(
      fc.property(direction, intent, intent, direction, amountText, (d, i, otherIntent, otherDirection, amount) => {
        const result = getDeltaPresentation(d, i, amount);
        expect(result.sign).toBe(d === "up" ? "+" : "−");
        expect(result.icon).toBe(d === "up" ? "arrow-up" : "arrow-down");
        expect(result.tone).toBe(i === "good" ? "success" : "danger");
        expect(result.text).toBe(`${result.sign}${amount}`);
        // Changing intent never changes sign or icon.
        const sameDirection = getDeltaPresentation(d, otherIntent, amount);
        expect(sameDirection.sign).toBe(result.sign);
        expect(sameDirection.icon).toBe(result.icon);
        // Changing direction never changes tone.
        expect(getDeltaPresentation(otherDirection, i, amount).tone).toBe(result.tone);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it("allows a down delta with good intent and an up delta with bad intent", () => {
    expect(getDeltaPresentation("down", "good", "$5")).toEqual({
      sign: "−",
      icon: "arrow-down",
      tone: "success",
      text: "−$5",
    });
    expect(getDeltaPresentation("up", "bad", "$5")).toMatchObject({ icon: "arrow-up", tone: "danger" });
  });
});
