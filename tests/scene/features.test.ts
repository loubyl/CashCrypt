// Example tests for the level feature table against visual-language.md
// (house-scene task 1.4). Requirements: 6.1, 6.2.

import { describe, expect, it } from "vitest";
import { getLevelFeatures, isSeverityMonotone, LEVEL_FEATURES } from "@/lib/scene/features";
import { assignWindowStates } from "@/lib/scene/windows";

describe("level 1, Pristine", () => {
  const f = LEVEL_FEATURES[1];

  it("has a clean wall with no cracks, stains or plaster hole", () => {
    expect([f.crackCount, f.stainCount, f.plasterHole]).toEqual([0, 0, false]);
  });

  it("has an intact roof, green grass and a lit lantern", () => {
    expect([f.roof, f.moss, f.garden, f.lantern]).toEqual(["intact", false, "green", "lit"]);
  });

  it("has fireflies, no fog, no bats and no darkness", () => {
    expect([f.fireflies, f.fog, f.bats, f.darkness]).toEqual([true, 0, false, 0]);
  });

  it("has every window lit", () => {
    expect(assignWindowStates(f).every((s) => s === "lit")).toBe(true);
  });
});

describe("level 2, Uneasy", () => {
  const f = LEVEL_FEATURES[2];

  it("has one hairline crack", () => {
    expect(f.crackCount).toBe(1);
    expect(f.plasterHole).toBe(false);
  });

  it("has a roof with missing shingles, browning grass and a dim lantern", () => {
    expect([f.roof, f.garden, f.lantern]).toEqual(["missingShingles", "browning", "dim"]);
  });

  it("has faint fog, no bats and no fireflies", () => {
    expect([f.fog, f.bats, f.fireflies]).toEqual([1, false, false]);
  });

  it("has every window lit", () => {
    expect(f.boardedWindows + f.brokenWindows).toBe(0);
  });
});

describe("level 3, Haunted", () => {
  const f = LEVEL_FEATURES[3];

  it("has cracks on two sides and staining near the foundation", () => {
    expect(f.crackCount).toBe(2);
    expect(f.stainCount).toBeGreaterThanOrEqual(1);
  });

  it("has exactly one boarded window and none broken", () => {
    expect([f.boardedWindows, f.brokenWindows]).toEqual([1, 0]);
  });

  it("has a sagging mossy roof, dead grass and an unlit lantern", () => {
    expect([f.roof, f.moss, f.garden, f.lantern]).toEqual(["sagging", true, "dead", "unlit"]);
  });

  it("has thicker fog and a shadow passing behind a window", () => {
    expect(f.fog).toBeGreaterThan(LEVEL_FEATURES[2].fog);
    expect(f.shadowPass).toBe(true);
  });

  it("has no bats yet", () => {
    expect(f.bats).toBe(false);
  });
});

describe("level 4, Crumbling", () => {
  const f = LEVEL_FEATURES[4];

  it("has large cracks and a missing plaster section", () => {
    expect(f.crackCount).toBeGreaterThan(LEVEL_FEATURES[3].crackCount);
    expect(f.plasterHole).toBe(true);
  });

  it("has two boarded windows and one broken window", () => {
    expect([f.boardedWindows, f.brokenWindows]).toEqual([2, 1]);
  });

  it("has a partly collapsed roof", () => {
    expect(f.roof).toBe("partialCollapse");
  });

  it("has bare earth, a dead tree and a broken fence", () => {
    expect([f.garden, f.tree, f.fence]).toEqual(["bare", "bare", "broken"]);
  });

  it("has heavy fog and bats circling", () => {
    expect(f.fog).toBeGreaterThan(LEVEL_FEATURES[3].fog);
    expect(f.bats).toBe(true);
  });

  it("still stands sound", () => {
    expect(f.structure).toBe("sound");
  });
});

describe("level 5, Condemned", () => {
  const f = LEVEL_FEATURES[5];

  it("has every window boarded or broken, so no candlelight remains", () => {
    expect(f.boardedWindows + f.brokenWindows).toBe(6);
    expect(assignWindowStates(f).every((s) => s !== "lit")).toBe(true);
  });

  it("has a collapsed roof and leaning walls close to collapse", () => {
    expect([f.roof, f.structure]).toEqual(["collapsed", "collapsing"]);
  });

  it("has scorched earth, a charred tree and a broken fence", () => {
    expect([f.garden, f.tree, f.fence]).toEqual(["scorched", "charred", "broken"]);
  });

  it("has an unlit lantern and near-total darkness", () => {
    expect(f.lantern).toBe("unlit");
    expect(f.darkness).toBeGreaterThanOrEqual(0.8);
  });

  it("has the heaviest fog", () => {
    expect(f.fog).toBe(Math.max(...[1, 2, 3, 4, 5].map((l) => LEVEL_FEATURES[l as 1 | 2 | 3 | 4 | 5].fog)));
  });
});

describe("whole feature table", () => {
  it("is monotone in severity from level 1 to level 5", () => {
    expect(isSeverityMonotone(LEVEL_FEATURES)).toBe(true);
  });

  it("shows fireflies only at level 1", () => {
    expect([1, 2, 3, 4, 5].map((l) => LEVEL_FEATURES[l as 1 | 2 | 3 | 4 | 5].fireflies)).toEqual([
      true, false, false, false, false,
    ]);
  });

  it("returns the table entry for a level and clamps out-of-range input", () => {
    expect(getLevelFeatures(3)).toBe(LEVEL_FEATURES[3]);
    expect(getLevelFeatures(0)).toBe(LEVEL_FEATURES[1]);
    expect(getLevelFeatures(9)).toBe(LEVEL_FEATURES[5]);
    expect(getLevelFeatures(Number.NaN)).toBe(LEVEL_FEATURES[1]);
  });
});
