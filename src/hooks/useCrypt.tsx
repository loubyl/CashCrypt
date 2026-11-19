"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { getCryptDb } from "@/lib/db/crypt";
import {
  clearMode as clearStoredMode,
  readMode,
  subscribeMode,
  writeMode,
  type Mode,
  type ModeStorage,
} from "@/lib/db/modeStore";
import {
  CRYPT_DB_NAME,
  DEMO_DB_NAME,
  PROFILE_ID,
  type CryptDb,
} from "@/lib/db/schema";
import { getLocalDate, type Clock } from "@/lib/utils/calendar";

export type CryptStatus = "loading" | "none" | "demo" | "real" | "unavailable";

export type CryptContextValue = {
  status: CryptStatus;
  /** Database of the Active_Crypt; null unless status is "demo" or "real". */
  db: CryptDb | null;
  /** Read-only check of the real database; null while unknown. */
  hasRealProfile: boolean | null;
  setMode: (mode: Mode) => void;
  clearMode: () => void;
  /** Clock used by hooks that need today's date. */
  getClock: Clock;
  /** Opens the Demo_Crypt database on demand, even before the mode is demo. Rejects when it cannot open. */
  openDemoDb: () => Promise<CryptDb>;
  /** Opens the Real_Crypt database on demand, even before it has a Profile. Rejects when it cannot open. */
  openRealDb: () => Promise<CryptDb>;
};

export type CryptProviderProps = {
  children: ReactNode;
  /** Creates the database object for a name. Defaults to the browser singleton. */
  openDb?: (name: string) => CryptDb;
  /** Mode storage. Defaults to `window.localStorage`, read on the client only. */
  storage?: ModeStorage;
  /** Defaults to `getLocalDate`. */
  getClock?: Clock;
};

type ModeSnapshot = Mode | null | "unknown";
type OpenState = { status: "open" | "failed"; db: CryptDb | null };

const MODE_UNKNOWN: ModeSnapshot = "unknown";

const CryptContext = createContext<CryptContextValue | null>(null);

function getServerModeSnapshot(): ModeSnapshot {
  return MODE_UNKNOWN;
}

/** Resolves the storage on the client; null when the browser blocks it. */
function resolveStorage(storage: ModeStorage | undefined): ModeStorage | null {
  if (storage) return storage;
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function CryptProvider({
  children,
  openDb = getCryptDb,
  storage,
  getClock = getLocalDate,
}: CryptProviderProps) {
  const getModeSnapshot = useCallback((): ModeSnapshot => {
    const target = resolveStorage(storage);
    if (!target) return null;
    try {
      return readMode(target);
    } catch {
      return null;
    }
  }, [storage]);

  const mode = useSyncExternalStore(
    subscribeMode,
    getModeSnapshot,
    getServerModeSnapshot,
  );

  const [opened, setOpened] = useState<Record<string, OpenState>>({});
  const requested = useRef(new Map<string, Promise<OpenState>>());

  /** Opens a database once per name and records the result in state. */
  const openByName = useCallback(
    (name: string): Promise<OpenState> => {
      const cached = requested.current.get(name);
      if (cached) return cached;
      const attempt = new Promise<OpenState>((resolve) => {
        let db: CryptDb;
        try {
          db = openDb(name);
        } catch {
          resolve({ status: "failed", db: null });
          return;
        }
        db.open().then(
          () => resolve({ status: "open", db }),
          () => resolve({ status: "failed", db: null }),
        );
      });
      requested.current.set(name, attempt);
      void attempt.then((state) =>
        setOpened((previous) => ({ ...previous, [name]: state })),
      );
      return attempt;
    },
    [openDb],
  );

  const openDemoDb = useCallback(async (): Promise<CryptDb> => {
    const state = await openByName(DEMO_DB_NAME);
    if (state.status !== "open" || !state.db) {
      throw new Error("The demo crypt could not be opened.");
    }
    return state.db;
  }, [openByName]);

  const openRealDb = useCallback(async (): Promise<CryptDb> => {
    const state = await openByName(CRYPT_DB_NAME);
    if (state.status !== "open" || !state.db) {
      throw new Error("Your crypt could not be opened.");
    }
    return state.db;
  }, [openByName]);

  const wantsDemo = mode === "demo";
  useEffect(() => {
    if (mode === MODE_UNKNOWN) return;
    const names = wantsDemo ? [CRYPT_DB_NAME, DEMO_DB_NAME] : [CRYPT_DB_NAME];
    for (const name of names) void openByName(name);
  }, [mode, wantsDemo, openByName]);

  const realState = opened[CRYPT_DB_NAME];
  const demoState = opened[DEMO_DB_NAME];
  const realDb = realState?.status === "open" ? realState.db : null;

  const profileFound = useLiveQuery(
    async () => (realDb ? (await realDb.profile.get(PROFILE_ID)) !== undefined : null),
    [realDb],
    null,
  );
  const hasRealProfile = realDb ? profileFound : null;

  const status = useMemo<CryptStatus>(() => {
    if (mode === MODE_UNKNOWN) return "loading";
    if (realState?.status === "failed") return "unavailable";
    if (mode === null) return "none";
    if (mode === "demo") {
      if (demoState?.status === "failed") return "unavailable";
      return demoState?.status === "open" ? "demo" : "loading";
    }
    if (hasRealProfile === null) return "loading";
    return hasRealProfile ? "real" : "none";
  }, [mode, realState, demoState, hasRealProfile]);

  const db =
    status === "demo" ? (demoState?.db ?? null) : status === "real" ? realDb : null;

  const setMode = useCallback(
    (next: Mode): void => {
      const target = resolveStorage(storage);
      if (target) writeMode(target, next);
    },
    [storage],
  );
  const clearMode = useCallback((): void => {
    const target = resolveStorage(storage);
    if (target) clearStoredMode(target);
  }, [storage]);

  const value = useMemo<CryptContextValue>(
    () => ({
      status,
      db,
      hasRealProfile,
      setMode,
      clearMode,
      getClock,
      openDemoDb,
      openRealDb,
    }),
    [status, db, hasRealProfile, setMode, clearMode, getClock, openDemoDb, openRealDb],
  );

  return <CryptContext.Provider value={value}>{children}</CryptContext.Provider>;
}

export function useCrypt(): CryptContextValue {
  const value = useContext(CryptContext);
  if (!value) {
    throw new Error("useCrypt must be used inside a CryptProvider.");
  }
  return value;
}
