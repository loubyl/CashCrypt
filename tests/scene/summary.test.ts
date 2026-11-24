import { describe, expect, it } from "vitest";
import { buildSceneSummary } from "@/lib/scene";
import type { SceneSummaryParts } from "@/lib/scene";

function parts(overrides: Partial<SceneSummaryParts> = {}): SceneSummaryParts {
  return {
    level: 3,
    levelName: "Haunted",
    totals: { zombies: 4, ghosts: 30, tombstones: 1 },
    poltergeist: "awake",
    ...overrides,
  };
}

describe("buildSceneSummary", () => {
  it("builds the example of requirement 19.2", () => {
    expect(buildSceneSummary(parts())).toBe(
      "Level 3, Haunted. 4 zombies, 30 ghosts, Poltergeist awake, 1 tombstone",
    );
  });

  it("uses singular forms for a count of one", () => {
    const text = buildSceneSummary(parts({ totals: { zombies: 1, ghosts: 1, tombstones: 1 } }));
    expect(text).toBe("Level 3, Haunted. 1 zombie, 1 ghost, Poltergeist awake, 1 tombstone");
  });

  it("says no zombies, no ghosts and no tombstones for zero counts", () => {
    const text = buildSceneSummary(parts({ totals: { zombies: 0, ghosts: 0, tombstones: 0 } }));
    expect(text).toBe("Level 3, Haunted. no zombies, no ghosts, Poltergeist awake, no tombstones");
  });

  it("states a bound Poltergeist", () => {
    expect(buildSceneSummary(parts({ poltergeist: "bound" }))).toContain("Poltergeist bound");
  });

  it("omits the Poltergeist clause when there is none", () => {
    const text = buildSceneSummary(parts({ poltergeist: null }));
    expect(text).toBe("Level 3, Haunted. 4 zombies, 30 ghosts, 1 tombstone");
  });
});
