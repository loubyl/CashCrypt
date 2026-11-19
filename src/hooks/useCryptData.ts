"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { readAllRows } from "@/lib/db/queries";
import type { CryptRows } from "@/types/finance";
import { useCrypt } from "@/hooks/useCrypt";

export type CryptData =
  | { status: "loading"; rows: null }
  | { status: "ready"; rows: CryptRows };

/** One live query over every table of the Active_Crypt. */
export function useCryptData(): CryptData {
  const { db } = useCrypt();
  // useLiveQuery keeps the previous result while it resubscribes after `db`
  // changes, so each result carries its database and stale ones are dropped.
  const result = useLiveQuery(
    async () => (db ? { db, rows: await readAllRows(db) } : null),
    [db],
    null,
  );
  const rows = result !== null && result.db === db ? result.rows : null;
  return rows ? { status: "ready", rows } : { status: "loading", rows: null };
}
