import { describe, expect, it } from "vitest";
import { buildScenario } from "@/lib/demo/seed";
import { toFinancialSnapshot } from "@/lib/db/snapshotAdapter";
import { computeHouseState } from "@/lib/haunting";
import { addDays } from "@/lib/utils/calendar";
import type { CryptRows, ScenarioId } from "@/types/finance";

const DEMO_NOW = "2025-06-02";
const SPREAD_DAYS = 23;
const SKIP_WEEK_DAYS = 7;
const COFFEE_COUNT = 30;
const COFFEE_CENTS = 1200;

function houseFor(id: ScenarioId, now: string) {
  const { profile, ...rest } = buildScenario(id, DEMO_NOW);
  const rows: CryptRows = { ...rest, profile, plans: [] };
  return computeHouseState(toFinancialSnapshot(rows, now));
}

describe("level-4 scenario content", () => {
  const data = buildScenario("level-4", DEMO_NOW);

  it("has a $3,000 monthly income", () => {
    expect(data.profile.monthlyIncomeCents).toBe(300_000);
  });

  it("has the three exact debts", () => {
    expect(
      data.debts.map((d) => [d.name, d.balanceCents, d.minimumPaymentCents, d.apr]),
    ).toEqual([
      ["Scarlet Moth Card", 1_800_000, 40_000, 0.22],
      ["Car loan", 600_000, 15_000, 0.18],
      ["Student loan", 200_000, 6_000, 0.12],
    ]);
  });

  it("has the five exact monthly subscriptions", () => {
    expect(
      data.subscriptions.map((s) => [s.name, s.amountCents, s.usage, s.cadence]),
    ).toEqual([
      ["Wraithcast", 12_000, "never", "monthly"],
      ["Dirgebox", 6_000, "rarely", "monthly"],
      ["Gravelift Gym", 5_000, "often", "monthly"],
      ["Mistlocker", 3_000, "often", "monthly"],
      ["Gloom Gazette", 1_549, "never", "monthly"],
    ]);
  });

  it("has 30 Coffee transactions of $12.00 within the 23 days ending on demoNow", () => {
    expect(data.transactions).toHaveLength(COFFEE_COUNT);
    const earliest = addDays(DEMO_NOW, -(SPREAD_DAYS - 1));
    for (const t of data.transactions) {
      expect(t.amountCents).toBe(COFFEE_CENTS);
      expect(t.category).toBe("Coffee");
      expect(t.description).toBe("Coffee");
      expect(t.date >= earliest && t.date <= DEMO_NOW).toBe(true);
    }
  });

  it("starts with no events", () => {
    expect(data.events).toEqual([]);
  });

  it("has an active Poltergeist on day one and after one Skip_Week", () => {
    expect(houseFor("level-4", DEMO_NOW).poltergeist).not.toBeNull();
    expect(
      houseFor("level-4", addDays(DEMO_NOW, SKIP_WEEK_DAYS)).poltergeist,
    ).not.toBeNull();
  });
});

describe("scenario scores", () => {
  const cases: Array<[ScenarioId, number, number]> = [
    ["level-1", 87.22, 1],
    ["level-2", 62.74, 2],
    ["level-3", 42.74, 3],
    ["level-4", 32.74, 4],
    ["level-5", 17.07, 5],
  ];

  it.each(cases)("%s scores %s at decay level %s", (id, score, level) => {
    const house = houseFor(id, DEMO_NOW);
    expect(Number(house.lightScore.toFixed(2))).toBe(score);
    expect(house.decayLevel).toBe(level);
  });
});
