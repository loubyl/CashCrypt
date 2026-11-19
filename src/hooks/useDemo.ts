"use client";

import { useCallback } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useCrypt } from "@/hooks/useCrypt";
import { toMutationError, type MutationResult } from "@/hooks/useCryptActions";
import { PROFILE_ID } from "@/lib/db/schema";
import { loadScenario, resetDemo, skipWeek } from "@/lib/demo/service";
import type { LocalDate, ScenarioId } from "@/types/finance";

const DEFAULT_SCENARIO: ScenarioId = "level-4";
const NOT_READY_MESSAGE = "The demo crypt is not ready yet.";

export type DemoState = {
  scenarioId: ScenarioId | null;
  demoNow: LocalDate | null;
  loadScenario: (id: ScenarioId) => Promise<MutationResult<void>>;
  reset: () => Promise<MutationResult<void>>;
  skipWeek: () => Promise<MutationResult<LocalDate>>;
  /** Seeds the default scenario when the Demo_Crypt is empty, then sets the demo mode. Rejects when the demo database cannot open. */
  enterDemo: () => Promise<void>;
};

/** Demo_Crypt controls. Reading and the control actions apply while the mode is demo. */
export function useDemo(): DemoState {
  const { status, db, getClock, setMode, openDemoDb } = useCrypt();
  const demoDb = status === "demo" ? db : null;

  const profile = useLiveQuery(
    async () => (demoDb ? ((await demoDb.profile.get(PROFILE_ID)) ?? null) : null),
    [demoDb],
    null,
  );

  const run = useCallback(
    async <T>(task: (target: NonNullable<typeof demoDb>) => Promise<T>): Promise<MutationResult<T>> => {
      if (!demoDb) {
        return { ok: false, error: { kind: "unknown", message: NOT_READY_MESSAGE } };
      }
      try {
        return { ok: true, value: await task(demoDb) };
      } catch (error) {
        return { ok: false, error: toMutationError(error) };
      }
    },
    [demoDb],
  );

  const load = useCallback(
    (id: ScenarioId) =>
      run((target) => loadScenario(target, id, profile?.demoNow ?? getClock())),
    [run, profile, getClock],
  );
  const reset = useCallback(() => run((target) => resetDemo(target, getClock())), [run, getClock]);
  const skip = useCallback(() => run((target) => skipWeek(target)), [run]);

  const enterDemo = useCallback(async (): Promise<void> => {
    const target = await openDemoDb();
    if ((await target.profile.get(PROFILE_ID)) === undefined) {
      await loadScenario(target, DEFAULT_SCENARIO, getClock());
    }
    setMode("demo");
  }, [openDemoDb, getClock, setMode]);

  return {
    scenarioId: profile?.scenarioId ?? null,
    demoNow: profile?.demoNow ?? null,
    loadScenario: load,
    reset,
    skipWeek: skip,
    enterDemo,
  };
}
