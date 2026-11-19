"use client";

import { useCallback, useEffect } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useCrypt } from "@/hooks/useCrypt";
import { toMutationError, type MutationResult } from "@/hooks/useCryptActions";
import { useNow } from "@/hooks/useNow";
import { completePlanAction, uncompletePlanAction } from "@/lib/db/mutations";
import { ensureWeeklyPlan } from "@/lib/db/plans";
import { getPlanWeekStart } from "@/lib/utils/calendar";
import type { LocalDate, WeeklyPlanRow } from "@/types/finance";

const NOT_READY_MESSAGE = "The crypt is not ready yet.";

export type ExorcismPlanState = {
  /** "loading" until the plan of the current week is stored and read. */
  status: "loading" | "ready";
  plan: WeeklyPlanRow | null;
  weekKey: LocalDate | null;
  toggleAction: (actionId: string, next: boolean) => Promise<MutationResult<void>>;
};

/** The stored plan of the current week; generates it when it does not exist yet. */
export function useExorcismPlan(): ExorcismPlanState {
  const { db } = useCrypt();
  const now = useNow();
  const weekKey = now === null ? null : getPlanWeekStart(now);

  // useLiveQuery keeps the previous result while it resubscribes, so each
  // result carries its database and week; a stale one counts as loading.
  const result = useLiveQuery(
    async () =>
      db && weekKey
        ? { db, weekKey, plan: (await db.weeklyPlans.get(weekKey)) ?? null }
        : undefined,
    [db, weekKey],
  );
  // undefined while loading, null when the week has no plan.
  const stored =
    result !== undefined && result.db === db && result.weekKey === weekKey
      ? result.plan
      : undefined;

  useEffect(() => {
    if (!db || now === null || stored !== null) return;
    ensureWeeklyPlan(db, now).catch(() => {
      // The live query stays without a plan; the screen keeps its skeleton.
    });
  }, [db, now, stored]);

  const toggleAction = useCallback(
    async (actionId: string, next: boolean): Promise<MutationResult<void>> => {
      if (!db || now === null || weekKey === null) {
        return { ok: false, error: { kind: "unknown", message: NOT_READY_MESSAGE } };
      }
      try {
        if (next) await completePlanAction(db, weekKey, actionId, { now });
        else await uncompletePlanAction(db, weekKey, actionId);
        return { ok: true, value: undefined };
      } catch (error) {
        return { ok: false, error: toMutationError(error) };
      }
    },
    [db, now, weekKey],
  );

  const plan = stored ?? null;
  return { status: plan ? "ready" : "loading", plan, weekKey, toggleAction };
}
