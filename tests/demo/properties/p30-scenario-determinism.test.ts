import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { buildScenario } from "@/lib/demo/seed";
import { toFinancialSnapshot } from "@/lib/db/snapshotAdapter";
import { computeHouseState } from "@/lib/haunting";
import { addDays } from "@/lib/utils/calendar";
import type { CryptRows, LocalDate, ScenarioId } from "@/types/finance";

const NUM_RUNS = 100;
const SCORE_DECIMALS = 2;
const BASE_DATE: LocalDate = "2000-01-01";
const MAX_DAY_OFFSET = 36_500;
const SKIP_WEEK_DAYS = 7;
const MIN_GHOSTS_LOW_LEVELS = 3;

const SCENARIO_IDS: ScenarioId[] = [
  "level-1",
  "level-2",
  "level-3",
  "level-4",
  "level-5",
];

const EXPECTED: Record<ScenarioId, { score: number; level: number }> = {
  "level-1": { score: 87.22, level: 1 },
  "level-2": { score: 62.74, level: 2 },
  "level-3": { score: 42.74, level: 3 },
  "level-4": { score: 32.74, level: 4 },
  "level-5": { score: 17.07, level: 5 },
};

const scenarioIdArb = fc.constantFrom(...SCENARIO_IDS);
const demoNowArb: fc.Arbitrary<LocalDate> = fc
  .integer({ min: 0, max: MAX_DAY_OFFSET })
  .map((days) => addDays(BASE_DATE, days));

function houseStateAt(id: ScenarioId, demoNow: LocalDate, now: LocalDate) {
  const { profile, ...rest } = buildScenario(id, demoNow);
  const rows: CryptRows = { ...rest, profile, plans: [] };
  return computeHouseState(toFinancialSnapshot(rows, now));
}

function round2(value: number): number {
  return Number(value.toFixed(SCORE_DECIMALS));
}

describe("Property 30: scenarios are deterministic and date-independent", () => {
  // Feature: app-screens, Property 30: Scenarios are deterministic and date-independent
  // **Validates: Requirements 17.1, 17.2, 17.4, 17.5, 17.6**
  it("builds identical data twice, with unique ids and no future transactions", () => {
    fc.assert(
      fc.property(scenarioIdArb, demoNowArb, (id, demoNow) => {
        const first = buildScenario(id, demoNow);
        const second = buildScenario(id, demoNow);
        expect(second).toEqual(first);

        const ids = [
          ...first.debts.map((d) => d.id),
          ...first.subscriptions.map((s) => s.id),
          ...first.transactions.map((t) => t.id),
        ];
        expect(new Set(ids).size).toBe(ids.length);
        for (const t of first.transactions) {
          expect(t.date <= demoNow).toBe(true);
        }
      }),
      { numRuns: NUM_RUNS },
    );
  });

  // Feature: app-screens, Property 30: Scenarios are deterministic and date-independent
  it("gives the calibration light score and level for any demoNow", () => {
    fc.assert(
      fc.property(scenarioIdArb, demoNowArb, (id, demoNow) => {
        const house = houseStateAt(id, demoNow, demoNow);
        expect(round2(house.lightScore)).toBe(EXPECTED[id].score);
        expect(house.decayLevel).toBe(EXPECTED[id].level);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  // Feature: app-screens, Property 30: Scenarios are deterministic and date-independent
  it("has the required Ghosts and Poltergeist for any demoNow", () => {
    fc.assert(
      fc.property(scenarioIdArb, demoNowArb, (id, demoNow) => {
        const house = houseStateAt(id, demoNow, demoNow);
        if (id === "level-1" || id === "level-2" || id === "level-3") {
          expect(house.ghosts.length).toBeGreaterThanOrEqual(MIN_GHOSTS_LOW_LEVELS);
          expect(house.poltergeist).toBeNull();
        } else {
          expect(house.poltergeist).not.toBeNull();
        }
        if (id === "level-4") {
          const later = houseStateAt(id, demoNow, addDays(demoNow, SKIP_WEEK_DAYS));
          expect(later.poltergeist).not.toBeNull();
        }
      }),
      { numRuns: NUM_RUNS },
    );
  });
});
