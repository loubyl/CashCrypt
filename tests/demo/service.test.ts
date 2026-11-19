// Demo service tests: scenario scores, stored plan, Real_Crypt isolation, reset.
// Each test opens a crypt on its own fake-indexeddb factory, so the fixed
// database names never collide between tests.
import { IDBFactory, IDBKeyRange } from "fake-indexeddb";
import { afterEach, describe, expect, it } from "vitest";
import { openCrypt } from "@/lib/db/crypt";
import { readAllRows } from "@/lib/db/queries";
import {
  CRYPT_DB_NAME,
  DEMO_DB_NAME,
  PROFILE_ID,
  type CryptDb,
} from "@/lib/db/schema";
import { toFinancialSnapshot } from "@/lib/db/snapshotAdapter";
import { loadScenario, resetDemo, skipWeek } from "@/lib/demo/service";
import { computeHouseState } from "@/lib/haunting";
import { getPlanWeekStart } from "@/lib/utils/calendar";
import type { ScenarioId } from "@/types/finance";

const DEMO_NOW = "2025-06-04"; // a Wednesday
const TODAY = "2025-09-17";
const PLAN_SIZE = 3;
const SCORE_DECIMALS = 2;

const opened: CryptDb[] = [];

function open(name: string): CryptDb {
  const db = openCrypt(name, { indexedDB: new IDBFactory(), IDBKeyRange });
  opened.push(db);
  return db;
}

afterEach(async () => {
  for (const db of opened.splice(0)) {
    await db.delete();
  }
});

async function tableCounts(db: CryptDb) {
  const rows = await readAllRows(db);
  return {
    profile: rows.profile,
    debts: rows.debts.length,
    subscriptions: rows.subscriptions.length,
    transactions: rows.transactions.length,
    events: rows.events.length,
    plans: await db.weeklyPlans.count(),
  };
}

describe("loadScenario", () => {
  const cases: Array<[ScenarioId, number, number]> = [
    ["level-1", 87.22, 1],
    ["level-2", 62.74, 2],
    ["level-3", 42.74, 3],
    ["level-4", 32.74, 4],
    ["level-5", 17.07, 5],
  ];

  it.each(cases)("%s gives score %s at decay level %s", async (id, score, level) => {
    const db = open(DEMO_DB_NAME);
    await loadScenario(db, id, DEMO_NOW);
    const house = computeHouseState(
      toFinancialSnapshot(await readAllRows(db), DEMO_NOW),
    );
    expect(Number(house.lightScore.toFixed(SCORE_DECIMALS))).toBe(score);
    expect(house.decayLevel).toBe(level);
  });

  it("stores the scenario id and demoNow in the profile", async () => {
    const db = open(DEMO_DB_NAME);
    await loadScenario(db, "level-3", DEMO_NOW);
    const profile = await db.profile.get(PROFILE_ID);
    expect(profile?.scenarioId).toBe("level-3");
    expect(profile?.demoNow).toBe(DEMO_NOW);
  });

  it("stores a plan of three pending actions for the week of demoNow", async () => {
    const db = open(DEMO_DB_NAME);
    await loadScenario(db, "level-4", DEMO_NOW);
    const plans = await db.weeklyPlans.toArray();
    expect(plans).toHaveLength(1);
    expect(plans[0].weekKey).toBe(getPlanWeekStart(DEMO_NOW));
    expect(plans[0].actions).toHaveLength(PLAN_SIZE);
    expect(plans[0].actions.every((a) => a.done === false)).toBe(true);
  });

  it("replaces the previous data when another scenario is loaded", async () => {
    const db = open(DEMO_DB_NAME);
    await loadScenario(db, "level-4", DEMO_NOW);
    await loadScenario(db, "level-1", DEMO_NOW);
    expect((await db.profile.get(PROFILE_ID))?.scenarioId).toBe("level-1");
    expect(await db.weeklyPlans.count()).toBe(1);
  });
});

describe("skipWeek", () => {
  it("moves demoNow seven days ahead and returns the new date", async () => {
    const db = open(DEMO_DB_NAME);
    await loadScenario(db, "level-4", DEMO_NOW);
    expect(await skipWeek(db)).toBe("2025-06-11");
    expect((await db.profile.get(PROFILE_ID))?.demoNow).toBe("2025-06-11");
  });
});

describe("resetDemo", () => {
  it("reloads the current scenario with the passed today as demoNow", async () => {
    const db = open(DEMO_DB_NAME);
    await loadScenario(db, "level-2", DEMO_NOW);
    await skipWeek(db);
    await resetDemo(db, TODAY);
    const profile = await db.profile.get(PROFILE_ID);
    expect(profile?.demoNow).toBe(TODAY);
    expect(profile?.scenarioId).toBe("level-2");
    const plans = await db.weeklyPlans.toArray();
    expect(plans.map((p) => p.weekKey)).toEqual([getPlanWeekStart(TODAY)]);
  });
});

describe("Real_Crypt isolation", () => {
  it("rejects loadScenario, skipWeek and resetDemo and writes nothing", async () => {
    const real = open(CRYPT_DB_NAME);
    const before = await tableCounts(real);
    await expect(loadScenario(real, "level-4", DEMO_NOW)).rejects.toThrow();
    await expect(skipWeek(real)).rejects.toThrow();
    await expect(resetDemo(real, TODAY)).rejects.toThrow();
    expect(await tableCounts(real)).toEqual(before);
    expect(before.profile).toBeNull();
  });
});
