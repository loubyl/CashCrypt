// Dashboard triggers of the three new Moments, against the real Dashboard and a seeded demo Crypt
// (action-feedback Requirements 4.1, 4.5, 4.8, 4.9, 4.10, 8.2, 8.3, 11.5, 14.4).
// `playMoment` is recorded; under Reduced_Motion it runs the real loader, with GSAP mocked and counted.
import { cleanup, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Dashboard } from "@/components/dashboard/Dashboard";
import { MOMENT_GAP_MS } from "@/lib/scene";
import type { TransactionRow } from "@/types/finance";
import { renderWithCrypt, resetNavigationMock, setMockPathname } from "./helpers/crypt";

vi.mock("next/navigation", async () => (await import("./helpers/crypt")).createNavigationMock());

const gsapCalls = vi.hoisted(() => ({ timelines: 0, contexts: 0 }));
// Real GSAP with a counter on `timeline`, so the ambient loops keep working and
// every timeline created while the test runs is counted.
vi.mock("gsap", async (importOriginal) => {
  const actual = await importOriginal<typeof import("gsap")>();
  const core = actual.default;
  const realTimeline = core.timeline.bind(core);
  core.timeline = ((...args: Parameters<typeof realTimeline>) => {
    gsapCalls.timelines += 1;
    return realTimeline(...args);
  }) as typeof core.timeline;
  return { ...actual, default: core, gsap: core };
});

const playCalls = vi.hoisted(() => ({ kinds: [] as string[], reduced: [] as boolean[] }));
vi.mock("@/components/moments/momentLoader", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/components/moments/momentLoader")>();
  return {
    ...actual,
    playMoment: vi.fn((...args: Parameters<typeof actual.playMoment>) => {
      const [request, , , reducedMotion] = args;
      playCalls.kinds.push(request.kind);
      playCalls.reduced.push(reducedMotion);
      return reducedMotion ? actual.playMoment(...args) : Promise.resolve();
    }),
  };
});

const NOW = "2025-06-02";
const REDUCED_QUERY = "(prefers-reduced-motion: reduce)";
const QUIET_MS = MOMENT_GAP_MS * 3;
const WAIT = { timeout: 5000 };
const TEST_TIMEOUT_MS = 20000;
const NEW_KINDS = ["poltergeistFeed", "ghostArrival", "candleFlicker"];
const realMatchMedia = window.matchMedia;

function stubReducedPreference(reduced: boolean): void {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      matches: reduced && query === REDUCED_QUERY,
      media: query,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => true,
    }),
  });
}

type User = ReturnType<typeof userEvent.setup>;

const SMALL_ROW_CENTS = 1_499;
const REAL_INCOME_CENTS = 500_000;
const WOKE_TOAST = "Ghost added: $8 \u00b7 woke the Poltergeist, doesn't dim the light";
const ASLEEP_TOAST = /^Ghost added: \$8 \u00b7 doesn't dim the light \u00b7 \$[\d,.]+ more wakes the Poltergeist$/;

/** `count` small expenses of $14.99 dated today, so the 30-day total is count × $14.99. */
function smallRows(count: number): TransactionRow[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `seed-${i}`,
    amountCents: SMALL_ROW_CENTS,
    description: `Seed ${i}`,
    category: "Coffee",
    date: NOW,
  }));
}

async function renderRealDashboard(smallCount: number): Promise<void> {
  await renderWithCrypt(<Dashboard />, {
    mode: "real",
    seed: { profile: { monthlyIncomeCents: REAL_INCOME_CENTS }, transactions: smallRows(smallCount) },
    now: NOW,
    pathname: "/",
  });
  await screen.findByRole("button", { name: "Add expense" }, WAIT);
}

async function renderDashboard(seed: "level-1" | "level-2" | "level-4"): Promise<void> {
  await renderWithCrypt(<Dashboard />, { mode: "demo", seed, now: NOW, pathname: "/" });
  await screen.findAllByRole("checkbox", {}, WAIT);
}

async function addExpense(user: User, amount: string): Promise<void> {
  await user.click(screen.getByRole("button", { name: "Add expense" }));
  const dialog = await screen.findByRole("dialog");
  await user.type(within(dialog).getByLabelText("Amount"), amount);
  await user.type(within(dialog).getByLabelText("What was it?"), "Latte");
  await user.click(within(dialog).getByRole("button", { name: "Save expense" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull(), WAIT);
}

async function settle(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, QUIET_MS));
  });
}

const fallbackBox = (): HTMLInputElement =>
  screen.getByRole("checkbox", { name: /Set aside/ }) as HTMLInputElement;

beforeEach(() => {
  resetNavigationMock();
  playCalls.kinds.length = 0;
  playCalls.reduced.length = 0;
  gsapCalls.timelines = 0;
  gsapCalls.contexts = 0;
  stubReducedPreference(false);
});

afterEach(() => {
  cleanup();
  Object.defineProperty(window, "matchMedia", { configurable: true, writable: true, value: realMatchMedia });
});

describe("Dashboard small expense Moments", () => {
  it(
    "enqueues poltergeistFeed for a small expense at level 4",
    async () => {
      const user = userEvent.setup();
      await renderDashboard("level-4");
      await addExpense(user, "8");
      await waitFor(() => expect(playCalls.kinds).toEqual(["poltergeistFeed"]), WAIT);
      expect(
        await screen.findByText("Ghost added: $8 \u00b7 feeds the Poltergeist, doesn't dim the light"),
      ).toBeTruthy();
    },
    TEST_TIMEOUT_MS,
  );

  it(
    "enqueues poltergeistFeed and toasts 'woke' when the expense wakes the Poltergeist",
    async () => {
      const user = userEvent.setup();
      await renderRealDashboard(33);
      await addExpense(user, "8");
      await waitFor(() => expect(playCalls.kinds).toEqual(["poltergeistFeed"]), WAIT);
      expect(await screen.findByText(WOKE_TOAST)).toBeTruthy();
    },
    TEST_TIMEOUT_MS,
  );

  it(
    "enqueues ghostArrival and names the amount that wakes it when the Poltergeist stays asleep",
    async () => {
      const user = userEvent.setup();
      await renderRealDashboard(5);
      await addExpense(user, "8");
      await waitFor(() => expect(playCalls.kinds).toEqual(["ghostArrival"]), WAIT);
      expect(await screen.findByText(ASLEEP_TOAST)).toBeTruthy();
    },
    TEST_TIMEOUT_MS,
  );

  it(
    "enqueues ghostArrival for a small expense at level 2",
    async () => {
      const user = userEvent.setup();
      await renderDashboard("level-2");
      await addExpense(user, "8");
      await waitFor(() => expect(playCalls.kinds).toEqual(["ghostArrival"]), WAIT);
      expect(await screen.findByText(ASLEEP_TOAST)).toBeTruthy();
      expect(screen.queryByText(/feeds the Poltergeist/)).toBeNull();
    },
    TEST_TIMEOUT_MS,
  );

  it(
    "enqueues nothing for a $40 expense",
    async () => {
      const user = userEvent.setup();
      await renderDashboard("level-4");
      await addExpense(user, "40");
      await settle();
      expect(playCalls.kinds).toEqual([]);
    },
    TEST_TIMEOUT_MS,
  );

  it(
    "enqueues nothing for an expense added on /transactions",
    async () => {
      const user = userEvent.setup();
      const { TransactionsScreen } = await import("@/components/screens/TransactionsScreen");
      setMockPathname("/transactions");
      await renderWithCrypt(<TransactionsScreen />, { mode: "demo", seed: "level-4", now: NOW, pathname: "/transactions" });
      await user.click(await screen.findByRole("button", { name: /Add expense/ }, WAIT));
      const dialog = await screen.findByRole("dialog");
      await user.type(within(dialog).getByLabelText("Amount"), "8");
      await user.type(within(dialog).getByLabelText("What was it?"), "Latte");
      await user.click(within(dialog).getByRole("button", { name: "Save expense" }));
      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull(), WAIT);
      await settle();
      expect(playCalls.kinds).toEqual([]);
    },
    TEST_TIMEOUT_MS,
  );
});

describe("Dashboard candle flicker", () => {
  it(
    "enqueues candleFlicker for the level-1 fallback tick and nothing for its re-tick",
    async () => {
      const user = userEvent.setup();
      await renderDashboard("level-1");
      await user.click(fallbackBox());
      await waitFor(() => expect(playCalls.kinds).toEqual(["candleFlicker"]), WAIT);
      await settle();

      // A pending checkbox ignores clicks, so each click waits for the previous save to end.
      const notPending = (): void => expect(fallbackBox().getAttribute("aria-busy")).not.toBe("true");
      await waitFor(notPending, WAIT);
      await user.click(fallbackBox());
      await waitFor(() => expect(fallbackBox().checked).toBe(false), WAIT);
      await waitFor(notPending, WAIT);
      await user.click(fallbackBox());
      await waitFor(() => expect(fallbackBox().checked).toBe(true), WAIT);
      await settle();
      expect(playCalls.kinds).toEqual(["candleFlicker"]);
    },
    TEST_TIMEOUT_MS,
  );
});

describe("Dashboard without a user action", () => {
  it(
    "enqueues none of the new kinds on page load, demo load, reset and Skip_Week",
    async () => {
      const user = userEvent.setup();
      await renderDashboard("level-4");
      await settle();

      await user.click(screen.getByRole("radio", { name: "Level 2" }));
      await waitFor(() => expect(screen.getByRole("radio", { name: "Level 2" }).getAttribute("aria-checked")).toBe("true"), WAIT);
      await user.click(screen.getByRole("button", { name: "Reset demo" }));
      await screen.findByText("Demo reset", {}, WAIT);
      await user.click(screen.getByRole("button", { name: "Skip to next week" }));
      await screen.findByText(/^Skipped to /, {}, WAIT);
      await settle();

      expect(playCalls.kinds.filter((kind) => NEW_KINDS.includes(kind))).toEqual([]);
    },
    TEST_TIMEOUT_MS,
  );
});

describe("Dashboard under Reduced_Motion", () => {
  it(
    "plays the new Moments as a fade and creates no timeline",
    async () => {
      stubReducedPreference(true);
      const user = userEvent.setup();
      await renderDashboard("level-4");
      await addExpense(user, "8");
      await waitFor(() => expect(playCalls.kinds).toEqual(["poltergeistFeed"]), WAIT);
      expect(playCalls.reduced).toEqual([true]);
      await settle();
      expect(gsapCalls.timelines).toBe(0);
    },
    TEST_TIMEOUT_MS,
  );
});
