import { describe, expect, it } from "vitest";
import { formatWeekResult, getNextLevelText } from "@/lib/utils/scoreView";

describe("getNextLevelText", () => {
  it("states the distance from the displayed score to the next healthier level", () => {
    expect(getNextLevelText(3, 43.49)).toBe("17 to Level 2");
    expect(getNextLevelText(4, 32.74)).toBe("8 to Level 3");
    expect(getNextLevelText(2, 60)).toBe("20 to Level 1");
    expect(getNextLevelText(5, 0)).toBe("20 to Level 4");
  });

  it("uses the floored score, so just below a boundary is 1 away", () => {
    expect(getNextLevelText(2, 79.99)).toBe("1 to Level 1");
    expect(getNextLevelText(3, 59.99)).toBe("1 to Level 2");
    expect(getNextLevelText(5, 19.99)).toBe("1 to Level 4");
  });

  it("returns null at level 1, which has no next level", () => {
    expect(getNextLevelText(1, 80)).toBeNull();
    expect(getNextLevelText(1, 100)).toBeNull();
  });
});

describe("formatWeekResult", () => {
  it("shows the floored start and current scores and the current level", () => {
    expect(formatWeekResult(32.74, 43.49, 3)).toBe("Light score 32 → 43 · Level 3 — Haunted");
    expect(formatWeekResult(79.99, 80, 1)).toBe("Light score 79 → 80 · Level 1 — Pristine");
  });
});
