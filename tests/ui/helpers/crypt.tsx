/**
 * UI test helper for screens that read the Crypt.
 *
 * `renderWithCrypt(ui, { mode, seed, now, width })` renders `ui` inside
 * `ToastRegion` and `CryptProvider`, backed by a fresh `fake-indexeddb`
 * factory, an in-memory `Storage` and a fixed clock.
 *
 * Navigation mock: `vi.mock` is hoisted per test file, so each file that
 * renders a component using `useRouter` or `usePathname` declares it itself:
 *
 *   vi.mock("next/navigation", async () =>
 *     (await import("./helpers/crypt")).createNavigationMock(),
 *   );
 *
 * Then use `setMockPathname("/debts")` and `navigationSpies.replace` in the
 * test. The spies and the pathname reset in `resetNavigationMock()`, which
 * `renderWithCrypt` calls only when `pathname` is passed; call it in
 * `beforeEach` for full isolation.
 */
import { IDBKeyRange as FakeIDBKeyRange, IDBFactory as FakeIDBFactory } from "fake-indexeddb";
import { render, type RenderResult } from "@testing-library/react";
import Dexie from "dexie";
import type { ReactElement } from "react";
import { vi } from "vitest";
import { CryptProvider } from "@/hooks/useCrypt";
import { openCrypt } from "@/lib/db/crypt";
import { MODE_STORAGE_KEY, type Mode, type ModeStorage } from "@/lib/db/modeStore";
import { PROFILE_ID, type CryptDb } from "@/lib/db/schema";
import { loadScenario } from "@/lib/demo/service";
import { ToastRegion } from "@/components/ui/ToastRegion";
import type {
  CryptRows,
  DebtRow,
  EventRow,
  LocalDate,
  ProfileRow,
  ScenarioId,
  SubscriptionRow,
  TransactionRow,
  WeeklyPlanRow,
} from "@/types/finance";
import { setViewportWidth } from "./viewport";

export const DEFAULT_TEST_NOW: LocalDate = "2025-06-15";
const DEFAULT_PROFILE: ProfileRow = { monthlyIncomeCents: 500_000 };
const DEFAULT_DEMO_SCENARIO: ScenarioId = "level-4";

/** Rows to put in the Real_Crypt. Every field is optional. */
export type RealSeed = {
  profile?: ProfileRow | null;
  debts?: DebtRow[];
  subscriptions?: SubscriptionRow[];
  transactions?: TransactionRow[];
  events?: EventRow[];
  plans?: WeeklyPlanRow[];
};

export type RenderWithCryptOptions = {
  /** Active mode written to the in-memory storage. Omit for no Active_Crypt. */
  mode?: Mode;
  /** Demo: a scenario id (default "level-4"). Real: rows for `seedReal`. */
  seed?: ScenarioId | RealSeed;
  /** Fixed clock date, also the demo date. Defaults to DEFAULT_TEST_NOW. */
  now?: LocalDate;
  /** Simulated viewport width in px (see viewport.ts). */
  width?: number;
  /** Sets the mocked pathname before rendering. */
  pathname?: string;
};

export type CryptTestContext = RenderResult & {
  realDb: CryptDb;
  demoDb: CryptDb;
  storage: ModeStorage & { clear(): void };
  /** Re-renders with the same providers. */
  rerenderWithCrypt: (next: ReactElement) => void;
};

/** In-memory `Storage` stand-in; independent for each render. */
export function createMemoryStorage(
  initial: Record<string, string> = {},
): ModeStorage & { clear(): void } {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => void map.set(key, value),
    removeItem: (key) => void map.delete(key),
    clear: () => map.clear(),
  };
}

/** Writes rows into a real database. Missing arrays stay empty. */
export async function seedReal(db: CryptDb, seed: RealSeed = {}): Promise<void> {
  const rows: CryptRows = {
    profile: seed.profile === undefined ? DEFAULT_PROFILE : seed.profile,
    debts: seed.debts ?? [],
    subscriptions: seed.subscriptions ?? [],
    transactions: seed.transactions ?? [],
    events: seed.events ?? [],
    plans: seed.plans ?? [],
  };
  await db.transaction(
    "rw",
    [db.profile, db.debts, db.subscriptions, db.transactions, db.events, db.weeklyPlans],
    async () => {
      if (rows.profile) await db.profile.put({ ...rows.profile, id: PROFILE_ID });
      await db.debts.bulkPut(rows.debts);
      await db.subscriptions.bulkPut(rows.subscriptions);
      await db.transactions.bulkPut(rows.transactions);
      await db.events.bulkPut(rows.events);
      await db.weeklyPlans.bulkPut(rows.plans);
    },
  );
}

/**
 * Renders `ui` with a seeded Crypt. Async because seeding finishes before the
 * first render, so the provider sees the data when it opens the database.
 * Each call gets its own `IDBFactory`, so tests never share data while the
 * databases keep their real names (the demo guards check the name).
 */
export async function renderWithCrypt(
  ui: ReactElement,
  options: RenderWithCryptOptions = {},
): Promise<CryptTestContext> {
  const { mode, seed, now = DEFAULT_TEST_NOW, width, pathname } = options;
  const indexedDB = new FakeIDBFactory();
  // Dexie's liveQuery (used by CryptProvider) never emits unless Dexie's own
  // dependencies point at the same factory, so set them besides injecting it.
  Dexie.dependencies.indexedDB = indexedDB;
  Dexie.dependencies.IDBKeyRange = FakeIDBKeyRange;
  const openDb = (name: string): CryptDb =>
    openCrypt(name, { indexedDB, IDBKeyRange: FakeIDBKeyRange });
  const storage = createMemoryStorage();
  const realDb = openDb("cashcrypt");
  const demoDb = openDb("cashcrypt-demo");

  if (width !== undefined) setViewportWidth(width);
  if (pathname !== undefined) setMockPathname(pathname);

  if (mode === "real") {
    await seedReal(realDb, typeof seed === "object" ? seed : {});
  } else if (mode === "demo") {
    const id = typeof seed === "string" ? seed : DEFAULT_DEMO_SCENARIO;
    await loadScenario(demoDb, id, now);
  }
  if (mode) storage.setItem(MODE_STORAGE_KEY, mode);

  const getClock = (): LocalDate => now;
  const wrap = (node: ReactElement): ReactElement => (
    <CryptProvider openDb={openDb} storage={storage} getClock={getClock}>
      <ToastRegion>{node}</ToastRegion>
    </CryptProvider>
  );
  const result = render(wrap(ui));
  return {
    ...result,
    realDb,
    demoDb,
    storage,
    rerenderWithCrypt: (next) => result.rerender(wrap(next)),
  };
}

// ---------------------------------------------------------------------------
// next/navigation mock
// ---------------------------------------------------------------------------

const DEFAULT_PATHNAME = "/";
let mockPathname = DEFAULT_PATHNAME;

export const navigationSpies = {
  push: vi.fn(),
  replace: vi.fn(),
  back: vi.fn(),
  forward: vi.fn(),
  refresh: vi.fn(),
  prefetch: vi.fn(),
};

export function setMockPathname(pathname: string): void {
  mockPathname = pathname;
}

export function resetNavigationMock(): void {
  mockPathname = DEFAULT_PATHNAME;
  for (const spy of Object.values(navigationSpies)) spy.mockReset();
}

/** Factory for `vi.mock("next/navigation", ...)`; see the file header. */
export function createNavigationMock() {
  return {
    useRouter: () => navigationSpies,
    usePathname: () => mockPathname,
  };
}
