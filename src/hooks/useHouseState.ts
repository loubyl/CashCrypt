"use client";

import { useMemo } from "react";
import { toFinancialSnapshot } from "@/lib/db/snapshotAdapter";
import {
  computeHouseState,
  type FinancialSnapshot,
  type HouseState,
} from "@/lib/haunting";
import type { CryptRows, LocalDate } from "@/types/finance";
import { useCryptData } from "@/hooks/useCryptData";
import { useNow } from "@/hooks/useNow";

export type HouseStateResult =
  | {
      status: "loading";
      loading: true;
      houseState: null;
      snapshot: null;
      rows: CryptRows | null;
      now: LocalDate | null;
    }
  | {
      status: "ready";
      loading: false;
      houseState: HouseState;
      snapshot: FinancialSnapshot;
      rows: CryptRows;
      now: LocalDate;
    };

/** The only source of a House_State for screens. */
export function useHouseState(): HouseStateResult {
  const data = useCryptData();
  const now = useNow();
  const rows = data.rows;

  const computed = useMemo(() => {
    if (!rows || !now) return null;
    const snapshot = toFinancialSnapshot(rows, now);
    return { snapshot, houseState: computeHouseState(snapshot) };
  }, [rows, now]);

  if (!rows || !now || !computed) {
    return {
      status: "loading",
      loading: true,
      houseState: null,
      snapshot: null,
      rows,
      now,
    };
  }
  return {
    status: "ready",
    loading: false,
    houseState: computed.houseState,
    snapshot: computed.snapshot,
    rows,
    now,
  };
}
