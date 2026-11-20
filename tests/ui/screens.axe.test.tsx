// axe pass for every screen in four states: empty real crypt, populated real
// crypt, demo level 4 and loading (the provider has not opened the database).
import { cleanup, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { afterEach, beforeEach, describe, it, vi } from "vitest";
import { Dashboard } from "@/components/dashboard/Dashboard";
import { Landing } from "@/components/landing/Landing";
import { DebtsScreen } from "@/components/screens/DebtsScreen";
import { ExorcismScreen } from "@/components/screens/ExorcismScreen";
import { SettingsScreen } from "@/components/screens/SettingsScreen";
import { SubscriptionsScreen } from "@/components/screens/SubscriptionsScreen";
import { TransactionsScreen } from "@/components/screens/TransactionsScreen";
import type { DebtRow, SubscriptionRow, TransactionRow } from "@/types/finance";
import { expectNoAxeViolations } from "./helpers/axe";
import {
  renderWithCrypt,
  resetNavigationMock,
  type RealSeed,
  type RenderWithCryptOptions,
} from "./helpers/crypt";

vi.mock("next/navigation", async () => (await import("./helpers/crypt")).createNavigationMock());

const AXE_TIMEOUT_MS = 60000;
const SETTLE_MS = 400;

const POPULATED: RealSeed = {
  debts: [
    {
      id: "debt-1",
      name: "Scarlet Moth Card",
      balanceCents: 180_000,
      apr: 0.24,
      minimumPaymentCents: 5_500,
    } satisfies DebtRow,
  ],
  subscriptions: [
    {
      id: "sub-1",
      name: "StreamMax",
      amountCents: 2_299,
      cadence: "monthly",
      usage: "never",
      active: true,
    } satisfies SubscriptionRow,
  ],
  transactions: [
    {
      id: "tx-1",
      date: "2025-06-10",
      amountCents: 450,
      description: "Coffee",
      category: "Food",
    } satisfies TransactionRow,
  ],
};

type ScreenCase = { name: string; element: () => ReactElement };

const SCREENS: ScreenCase[] = [
  { name: "Landing", element: () => <Landing /> },
  { name: "Dashboard", element: () => <Dashboard /> },
  { name: "Exorcism", element: () => <ExorcismScreen /> },
  { name: "Subscriptions", element: () => <SubscriptionsScreen /> },
  { name: "Debts", element: () => <DebtsScreen /> },
  { name: "Transactions", element: () => <TransactionsScreen /> },
  { name: "Settings", element: () => <SettingsScreen /> },
];

type StateCase = { name: string; options: RenderWithCryptOptions };

const SETTLED_STATES: StateCase[] = [
  { name: "empty real crypt", options: { mode: "real", seed: {} } },
  { name: "populated real crypt", options: { mode: "real", seed: POPULATED } },
  { name: "demo level 4", options: { mode: "demo", seed: "level-4" } },
];

/** Lets the provider open the database and the live queries emit. */
async function settle(): Promise<void> {
  await screen.findByRole("main", {}, { timeout: 5000 }).catch(() => undefined);
  await new Promise((resolve) => setTimeout(resolve, SETTLE_MS));
}

beforeEach(() => resetNavigationMock());
afterEach(() => cleanup());

describe.each(SCREENS)("$name axe", ({ element }) => {
  it.each(SETTLED_STATES)(
    "has no violations in $name",
    async ({ options }) => {
      const { container } = await renderWithCrypt(element(), options);
      await settle();
      await expectNoAxeViolations(container);
    },
    AXE_TIMEOUT_MS,
  );

  it(
    "has no violations while loading",
    async () => {
      const { container } = await renderWithCrypt(element(), { mode: "real", seed: POPULATED });
      await expectNoAxeViolations(container);
    },
    AXE_TIMEOUT_MS,
  );
});
