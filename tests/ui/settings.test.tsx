// Settings screen against fake-indexeddb: income save and validation, crypt
// switch, onboarding on switch, clear all data, demo controls and no sound toggle.
import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SettingsScreen } from "@/components/screens/SettingsScreen";
import { MODE_STORAGE_KEY } from "@/lib/db/modeStore";
import { expectNoAxeViolations } from "./helpers/axe";
import {
  navigationSpies,
  renderWithCrypt,
  resetNavigationMock,
  seedReal,
  type RealSeed,
} from "./helpers/crypt";

vi.mock("next/navigation", async () => (await import("./helpers/crypt")).createNavigationMock());

const AXE_TIMEOUT_MS = 30000;
const INCOME_LABEL = "Monthly income";
const SAVE_INCOME_LABEL = "Save income";
const CLEAR_LABEL = "Clear all data";
const CLEAR_HINT = "Switch to your own crypt to use this.";
const MY_CRYPT_LABEL = "My crypt";
const DEMO_CRYPT_LABEL = "Demo crypt";
const DEMO_CONTROLS_TITLE = "Demo controls";
const DIALOG_ROLE = "dialog";
const INITIAL_INCOME_CENTS = 500_000;

const REAL_SEED: RealSeed = {
  profile: { monthlyIncomeCents: INITIAL_INCOME_CENTS },
  debts: [{ id: "debt-a", name: "Scarlet Moth Card", balanceCents: 100_000, apr: 0.2, minimumPaymentCents: 5_000 }],
};

async function renderReal(seed: RealSeed = REAL_SEED) {
  const ctx = await renderWithCrypt(<SettingsScreen />, { mode: "real", seed });
  await screen.findByLabelText(INCOME_LABEL);
  return ctx;
}

async function renderDemo() {
  const ctx = await renderWithCrypt(<SettingsScreen />, { mode: "demo" });
  await screen.findByLabelText(INCOME_LABEL);
  return ctx;
}

beforeEach(() => resetNavigationMock());
afterEach(() => cleanup());

describe("Settings income", () => {
  it("saves a new income, shows the toast and writes the Profile", async () => {
    const user = userEvent.setup();
    const ctx = await renderReal();
    const input = screen.getByLabelText(INCOME_LABEL);
    await user.clear(input);
    await user.type(input, "6200");
    await user.click(screen.getByRole("button", { name: SAVE_INCOME_LABEL }));
    expect(await screen.findByText(/^Income\ saved( · .+)?$/)).toBeTruthy();
    await waitFor(async () => {
      const rows = await ctx.realDb.profile.toArray();
      expect(rows[0]?.monthlyIncomeCents).toBe(620_000);
    });
  });

  it("shows an error and writes nothing when the income is below $1.00", async () => {
    const user = userEvent.setup();
    const ctx = await renderReal();
    const input = screen.getByLabelText(INCOME_LABEL);
    await user.clear(input);
    await user.type(input, "0.50");
    await user.click(screen.getByRole("button", { name: SAVE_INCOME_LABEL }));
    await waitFor(() => expect(input.getAttribute("aria-invalid")).toBe("true"));
    expect(screen.queryByText("Income saved")).toBeNull();
    const rows = await ctx.realDb.profile.toArray();
    expect(rows).toHaveLength(1);
    expect(rows[0].monthlyIncomeCents).toBe(INITIAL_INCOME_CENTS);
  });
});

describe("Settings crypt switch", () => {
  it("switches the mode store to real when a Profile exists", async () => {
    const user = userEvent.setup();
    const ctx = await renderDemo();
    await seedReal(ctx.realDb, REAL_SEED);
    expect(ctx.storage.getItem(MODE_STORAGE_KEY)).toBe("demo");
    await waitFor(async () => expect(await ctx.realDb.profile.count()).toBe(1));
    await user.click(screen.getByRole("radio", { name: MY_CRYPT_LABEL }));
    await waitFor(() => expect(ctx.storage.getItem(MODE_STORAGE_KEY)).toBe("real"));
    expect(screen.queryByRole(DIALOG_ROLE)).toBeNull();
  });

  it("opens the onboarding sheet when switching to My crypt without a Profile", async () => {
    const user = userEvent.setup();
    const ctx = await renderDemo();
    await user.click(screen.getByRole("radio", { name: MY_CRYPT_LABEL }));
    expect(await screen.findByRole(DIALOG_ROLE)).toBeTruthy();
    expect(ctx.storage.getItem(MODE_STORAGE_KEY)).toBe("demo");
  });

  it("switches back to the demo crypt from the real crypt", async () => {
    const user = userEvent.setup();
    const ctx = await renderReal();
    await user.click(screen.getByRole("radio", { name: DEMO_CRYPT_LABEL }));
    await waitFor(() => expect(ctx.storage.getItem(MODE_STORAGE_KEY)).toBe("demo"));
  });
});

describe("Settings clear all data", () => {
  it("empties only the real crypt, leaves the demo crypt and returns to the Landing", async () => {
    const user = userEvent.setup();
    const ctx = await renderReal();
    const { loadScenario } = await import("@/lib/demo/service");
    await loadScenario(ctx.demoDb, "level-4", "2025-06-15");
    const demoDebts = await ctx.demoDb.debts.count();
    expect(demoDebts).toBeGreaterThan(0);

    await user.click(screen.getByRole("button", { name: CLEAR_LABEL }));
    const dialog = await screen.findByRole(DIALOG_ROLE);
    await user.click(within(dialog).getByRole("button", { name: CLEAR_LABEL }));

    await waitFor(() => expect(navigationSpies.replace).toHaveBeenCalledWith("/"));
    expect(await ctx.realDb.profile.count()).toBe(0);
    expect(await ctx.realDb.debts.count()).toBe(0);
    expect(await ctx.demoDb.debts.count()).toBe(demoDebts);
    expect(ctx.storage.getItem(MODE_STORAGE_KEY)).toBeNull();
  });

  it("keeps the data when the confirmation is dismissed", async () => {
    const user = userEvent.setup();
    const ctx = await renderReal();
    await user.click(screen.getByRole("button", { name: CLEAR_LABEL }));
    const dialog = await screen.findByRole(DIALOG_ROLE);
    await user.click(within(dialog).getByRole("button", { name: "Keep my data" }));
    await waitFor(() => expect(screen.queryByRole(DIALOG_ROLE)).toBeNull());
    expect(await ctx.realDb.debts.count()).toBe(1);
    expect(navigationSpies.replace).not.toHaveBeenCalled();
  });

  it("disables the clear control with a hint in demo mode", async () => {
    await renderDemo();
    const button = screen.getByRole("button", { name: CLEAR_LABEL }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(screen.getByText(CLEAR_HINT)).toBeTruthy();
    fireEvent.click(button);
    expect(screen.queryByRole(DIALOG_ROLE)).toBeNull();
  });

  it("enables the clear control without a hint in the real crypt", async () => {
    await renderReal();
    const button = screen.getByRole("button", { name: CLEAR_LABEL }) as HTMLButtonElement;
    expect(button.disabled).toBe(false);
    expect(screen.queryByText(CLEAR_HINT)).toBeNull();
  });
});

describe("Settings sections", () => {
  it("shows Demo controls only in demo mode", async () => {
    await renderDemo();
    expect(screen.getByText(DEMO_CONTROLS_TITLE)).toBeTruthy();
    cleanup();
    await renderReal();
    expect(screen.queryByText(DEMO_CONTROLS_TITLE)).toBeNull();
  });

  it("names the crypt switch Active crypt under the Crypt card title", async () => {
    await renderReal();
    expect(screen.getByRole("heading", { name: "Crypt" })).toBeTruthy();
    expect(screen.getByRole("radiogroup", { name: "Active crypt" })).toBeTruthy();
  });

  it("says This can't be undone. in the clear-all confirmation", async () => {
    const user = userEvent.setup();
    await renderReal();
    await user.click(screen.getByRole("button", { name: CLEAR_LABEL }));
    const dialog = await screen.findByRole("dialog", { name: "Clear all data?" });
    expect(within(dialog).getByText(/This can't be undone\.$/)).toBeTruthy();
    expect(within(dialog).queryByText(/cannot be undone/)).toBeNull();
  });

  it("has no sound toggle", async () => {
    await renderReal();
    expect(screen.queryByText(/sound/i)).toBeNull();
    expect(screen.queryByRole("switch")).toBeNull();
  });
});

describe("Settings accessibility", () => {
  it(
    "has no axe violations in the real crypt",
    async () => {
      await renderReal();
      await expectNoAxeViolations(document.body);
    },
    AXE_TIMEOUT_MS,
  );

  it(
    "has no axe violations in the demo crypt",
    async () => {
      await renderDemo();
      await expectNoAxeViolations(document.body);
    },
    AXE_TIMEOUT_MS,
  );
});
