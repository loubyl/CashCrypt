// Onboarding order: the Profile is written before the mode is set to real, so
// the Dashboard never renders without a Profile and the Landing never bounces back.
import { act, cleanup, render, renderHook, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Dexie from "dexie";
import { IDBFactory, IDBKeyRange } from "fake-indexeddb";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HomeScreen } from "@/components/screens/HomeScreen";
import { AppShell } from "@/components/shell/AppShell";
import { CryptProvider } from "@/hooks/useCrypt";
import { useCreateCrypt } from "@/hooks/useCryptActions";
import { openCrypt } from "@/lib/db/crypt";
import { MODE_STORAGE_KEY } from "@/lib/db/modeStore";
import { CRYPT_DB_NAME, PROFILE_ID, type CryptDb } from "@/lib/db/schema";
import { ToastRegion } from "@/components/ui/ToastRegion";
import { createMemoryStorage, navigationSpies, resetNavigationMock } from "./helpers/crypt";
import { resetViewport, setViewportWidth } from "./helpers/viewport";

vi.mock("next/navigation", async () => (await import("./helpers/crypt")).createNavigationMock());

const OPEN_SHEET_LABEL = "Start my own crypt";
const SUBMIT_LABEL = "Create my crypt";
const INCOME_LABEL = "Monthly income";
const VALID_INCOME_TEXT = "4000";
const VALID_INCOME_CENTS = 400_000;
const WRITE_FAILURE_MESSAGE = "profile write failed";
const SETTLE_MS = 150;
const MOBILE_WIDTH = 390;

const EVENT_PROFILE_COMMITTED = "profile-committed";
const EVENT_MODE_REAL = "mode-real";

const NOW = "2025-06-15";

/** One database object per name, shared by the provider and the test, so hooks on it apply. */
function createCrypt() {
  const indexedDB = new IDBFactory();
  Dexie.dependencies.indexedDB = indexedDB;
  Dexie.dependencies.IDBKeyRange = IDBKeyRange;
  const dbs = new Map<string, CryptDb>();
  const openDb = (name: string): CryptDb => {
    const existing = dbs.get(name);
    if (existing) return existing;
    const created = openCrypt(name, { indexedDB, IDBKeyRange });
    dbs.set(name, created);
    return created;
  };
  const storage = createMemoryStorage();
  return { realDb: openDb(CRYPT_DB_NAME), openDb, storage };
}

function renderApp() {
  setViewportWidth(MOBILE_WIDTH);
  const crypt = createCrypt();
  render(
    <CryptProvider openDb={crypt.openDb} storage={crypt.storage} getClock={() => NOW}>
      <ToastRegion>
        <AppShell>
          <HomeScreen />
        </AppShell>
      </ToastRegion>
    </CryptProvider>,
  );
  return crypt;
}

async function submitOnboarding(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole("button", { name: OPEN_SHEET_LABEL }));
  const input = await screen.findByLabelText(INCOME_LABEL);
  await user.type(input, VALID_INCOME_TEXT);
  await user.click(screen.getByRole("button", { name: SUBMIT_LABEL }));
  return input;
}

describe("onboarding order", () => {
  beforeEach(() => {
    resetNavigationMock();
  });

  afterEach(() => {
    cleanup();
    resetViewport();
  });

  it("useCreateCrypt commits the Profile before it sets the mode to real", async () => {
    const events: string[] = [];
    const ctx = createCrypt();
    ctx.realDb.profile.hook("creating", (_key, _row, transaction) => {
      transaction.on("complete", () => events.push(EVENT_PROFILE_COMMITTED));
    });
    const originalSetItem = ctx.storage.setItem.bind(ctx.storage);
    ctx.storage.setItem = (key, value) => {
      if (key === MODE_STORAGE_KEY && value === "real") events.push(EVENT_MODE_REAL);
      originalSetItem(key, value);
    };

    const wrapper = ({ children }: { children: ReactNode }) => (
      <CryptProvider openDb={ctx.openDb} storage={ctx.storage}>
        {children}
      </CryptProvider>
    );
    const { result } = renderHook(() => useCreateCrypt(), { wrapper });
    let outcome: Awaited<ReturnType<typeof result.current>> | undefined;
    await act(async () => {
      outcome = await result.current(VALID_INCOME_CENTS);
    });

    expect(outcome?.ok).toBe(true);
    expect(events).toEqual([EVENT_PROFILE_COMMITTED, EVENT_MODE_REAL]);
    expect((await ctx.realDb.profile.get(PROFILE_ID))?.monthlyIncomeCents).toBe(VALID_INCOME_CENTS);
  });

  it("shows the Dashboard after onboarding, with no bounce back to the Landing", async () => {
    const user = userEvent.setup();
    const ctx = renderApp();
    await submitOnboarding(user);

    expect(await screen.findByRole("heading", { name: "Your crypt" })).toBeTruthy();
    expect(ctx.storage.getItem(MODE_STORAGE_KEY)).toBe("real");
    expect(navigationSpies.replace).toHaveBeenCalledWith("/");
    expect(screen.getByRole("navigation", { name: "Main" })).toBeTruthy();

    // Stay on the Dashboard while the live queries settle.
    await new Promise((resolve) => setTimeout(resolve, SETTLE_MS));
    expect(screen.getByRole("heading", { name: "Your crypt" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: OPEN_SHEET_LABEL })).toBeNull();
    expect(screen.queryByRole("heading", { level: 1, name: "CashCrypt" })).toBeNull();
  });

  it("keeps mode none and shows an error when the Profile write fails", async () => {
    const user = userEvent.setup();
    const ctx = renderApp();
    ctx.realDb.profile.hook("creating", () => {
      throw new Error(WRITE_FAILURE_MESSAGE);
    });
    const input = await submitOnboarding(user);

    await waitFor(() => expect(input.getAttribute("aria-invalid")).toBe("true"));
    expect(screen.getByText(new RegExp(WRITE_FAILURE_MESSAGE))).toBeTruthy();
    expect(ctx.storage.getItem(MODE_STORAGE_KEY)).toBeNull();
    expect(await ctx.realDb.profile.count()).toBe(0);
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Your crypt" })).toBeNull();
  });
});
