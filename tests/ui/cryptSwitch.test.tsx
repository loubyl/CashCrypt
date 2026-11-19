// Switching the Active_Crypt: every hook reads from the new database, and no
// render shows rows (or a plan) from the previous one while the new live
// queries resubscribe.
import { act, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { useCrypt } from "@/hooks/useCrypt";
import { useCryptData } from "@/hooks/useCryptData";
import { useExorcismPlan } from "@/hooks/useExorcismPlan";
import { useHouseState } from "@/hooks/useHouseState";
import { writeMode } from "@/lib/db/modeStore";
import { DEMO_DB_NAME, CRYPT_DB_NAME } from "@/lib/db/schema";
import { loadScenario } from "@/lib/demo/service";
import type { DebtRow, WeeklyPlanRow } from "@/types/finance";
import { renderWithCrypt } from "./helpers/crypt";

const NOW = "2025-06-02"; // a Monday, so the week key equals NOW
const REAL_DEBT: DebtRow = {
  id: "real-debt",
  name: "Only in the real crypt",
  balanceCents: 500_000,
  apr: 0.1,
  minimumPaymentCents: 10_000,
};
const REAL_PLAN: WeeklyPlanRow = {
  weekKey: NOW,
  actions: [
    { id: "fallback:real-only", kind: "fallback", title: "Real plan", subtitle: "", monthlyAmountCents: 0, priorityCents: 0, done: false },
  ],
  startLightScore: 99,
  generatedOn: NOW,
};

type Seen = {
  dbName: string | null;
  dataDebtIds: string[] | null;
  houseDebtIds: string[] | null;
  planTitles: string[] | null;
};

function createRecorder() {
  const seen: Seen[] = [];
  function Recorder(): ReactNode {
    const { db } = useCrypt();
    const data = useCryptData();
    const house = useHouseState();
    const plan = useExorcismPlan();
    seen.push({
      dbName: db?.name ?? null,
      dataDebtIds: data.rows ? data.rows.debts.map((d) => d.id) : null,
      houseDebtIds: house.rows ? house.rows.debts.map((d) => d.id) : null,
      planTitles: plan.plan ? plan.plan.actions.map((a) => a.title) : null,
    });
    return null;
  }
  return { seen, Recorder };
}

/** True when a render on `dbName` shows any row or plan from the other crypt. */
function leaks(entry: Seen): boolean {
  const realIds = [REAL_DEBT.id];
  const shows = (ids: string[] | null) => ids !== null && ids.some((id) => realIds.includes(id));
  const showsRealPlan = entry.planTitles?.includes("Real plan") ?? false;
  if (entry.dbName === DEMO_DB_NAME) {
    return shows(entry.dataDebtIds) || shows(entry.houseDebtIds) || showsRealPlan;
  }
  if (entry.dbName === CRYPT_DB_NAME) {
    const demoOnly = (ids: string[] | null) => ids !== null && ids.some((id) => !realIds.includes(id));
    return demoOnly(entry.dataDebtIds) || demoOnly(entry.houseDebtIds) ||
      (entry.planTitles !== null && !entry.planTitles.includes("Real plan"));
  }
  // No Active_Crypt: nothing may be shown at all.
  return entry.dataDebtIds !== null || entry.houseDebtIds !== null || entry.planTitles !== null;
}

describe("switching between the real and the demo crypt", () => {
  it("reads only the new database after real → demo → real, with no stale rows in any render", async () => {
    const { seen, Recorder } = createRecorder();
    const ctx = await renderWithCrypt(<Recorder />, {
      mode: "real",
      seed: { debts: [REAL_DEBT], plans: [REAL_PLAN] },
      now: NOW,
    });
    // The demo crypt holds the level-4 scenario, as after "Try the Demo Crypt".
    await loadScenario(ctx.demoDb, "level-4", NOW);

    const settledOn = async (name: string, check: (s: Seen) => boolean) =>
      waitFor(() => {
        const last = seen[seen.length - 1];
        expect(last.dbName).toBe(name);
        expect(check(last)).toBe(true);
      });

    await settledOn(CRYPT_DB_NAME, (s) =>
      s.dataDebtIds?.join() === REAL_DEBT.id && s.planTitles?.[0] === "Real plan");

    const switchAt = seen.length;
    act(() => writeMode(ctx.storage, "demo"));
    await settledOn(DEMO_DB_NAME, (s) =>
      (s.dataDebtIds?.length ?? 0) > 0 &&
      !s.dataDebtIds!.includes(REAL_DEBT.id) &&
      s.planTitles !== null &&
      s.planTitles[0].startsWith("Cancel Wraithcast"));

    const backAt = seen.length;
    act(() => writeMode(ctx.storage, "real"));
    await settledOn(CRYPT_DB_NAME, (s) =>
      s.dataDebtIds?.join() === REAL_DEBT.id && s.planTitles?.[0] === "Real plan");

    const afterSwitches = seen.slice(switchAt);
    expect(afterSwitches.filter(leaks)).toEqual([]);
    expect(seen.slice(backAt).some((s) => s.dbName === CRYPT_DB_NAME)).toBe(true);
  });
});
