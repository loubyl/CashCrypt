// The level-2 and level-4 demo scenes, built through the real seed, adapter and engine.
import { describe, expect, it } from "vitest";
import { toFinancialSnapshot } from "@/lib/db/snapshotAdapter";
import { buildScenario } from "@/lib/demo/seed";
import { computeHouseState } from "@/lib/haunting";
import { GHOST_MIN_REST_DISTANCE, buildSceneModel } from "@/lib/scene";
import type { ScenarioId } from "@/types/finance";

const NOW = "2025-06-02";

function demoModel(id: ScenarioId) {
  const data = buildScenario(id, NOW);
  const houseState = computeHouseState(toFinancialSnapshot({ ...data, plans: [] }, NOW));
  return {
    houseState,
    model: buildSceneModel({ houseState, monthlyIncomeCents: data.profile.monthlyIncomeCents, graveyard: [], bound: false }),
  };
}

describe("demo scenes", () => {
  it("spreads the four level-2 ghosts over more than one lane, at least the minimum apart", () => {
    const { model } = demoModel("level-2");
    expect(model.ghosts).toHaveLength(4);
    expect(new Set(model.ghosts.map((g) => g.lane)).size).toBeGreaterThan(1);
    for (const a of model.ghosts) {
      for (const b of model.ghosts) {
        if (a.id === b.id) continue;
        expect(Math.hypot(a.rest.x - b.rest.x, a.rest.y - b.rest.y)).toBeGreaterThanOrEqual(GHOST_MIN_REST_DISTANCE);
      }
    }
  });

  it("counts the 30 small expenses merged into the level-4 Poltergeist", () => {
    const { houseState, model } = demoModel("level-4");
    expect(houseState.ghosts).toHaveLength(0);
    expect(houseState.poltergeist?.transactionCount).toBe(30);
    expect(model.totals.ghosts).toBe(30);
    expect(model.summary).toBe("Level 4, Crumbling. 5 zombies, 30 ghosts, Poltergeist awake, no tombstones");
  });
});
