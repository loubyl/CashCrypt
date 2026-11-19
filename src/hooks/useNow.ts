"use client";

import { useCallback, useSyncExternalStore } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { PROFILE_ID } from "@/lib/db/schema";
import type { LocalDate } from "@/types/finance";
import { useCrypt } from "@/hooks/useCrypt";

const REFRESH_EVENTS = ["visibilitychange", "focus"] as const;

function subscribeToRefresh(listener: () => void): () => void {
  for (const name of REFRESH_EVENTS) window.addEventListener(name, listener);
  return () => {
    for (const name of REFRESH_EVENTS) window.removeEventListener(name, listener);
  };
}

function getServerNow(): LocalDate | null {
  return null;
}

/**
 * Today's date for the Active_Crypt.
 * Demo: the Profile's `demoNow`. Real: the local date, refreshed when the tab
 * becomes visible or focused. Null until known (and on the server).
 */
export function useNow(): LocalDate | null {
  const { status, db, getClock } = useCrypt();

  const getClientNow = useCallback((): LocalDate => getClock(), [getClock]);
  const clockNow = useSyncExternalStore(
    subscribeToRefresh,
    getClientNow,
    getServerNow,
  );

  const demoNow = useLiveQuery(
    async () =>
      db && status === "demo"
        ? ((await db.profile.get(PROFILE_ID))?.demoNow ?? null)
        : null,
    [db, status],
    null,
  );

  if (status === "demo") return demoNow;
  if (status === "real") return clockNow;
  return null;
}
