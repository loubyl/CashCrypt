// Subscriptions screen against a fake-indexeddb Real_Crypt: sorted rows, total,
// empty states, add form, cancel flow, graveyard and focus return.
import { cleanup, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { SubscriptionsScreen } from "@/components/screens/SubscriptionsScreen";
import type { SubscriptionRow } from "@/types/finance";
import { expectNoAxeViolations } from "./helpers/axe";
import { renderWithCrypt, type RealSeed } from "./helpers/crypt";

const AXE_TIMEOUT_MS = 30000;
const ADD_LABEL = "Add subscription";
const DIALOG_ROLE = "dialog";

const WRAITHCAST: SubscriptionRow = {
  id: "sub-wraith",
  name: "Wraithcast",
  amountCents: 12_000,
  cadence: "monthly",
  usage: "never",
  active: true,
};
const GAZETTE: SubscriptionRow = {
  id: "sub-gazette",
  name: "Gloom Gazette",
  amountCents: 1_549,
  cadence: "monthly",
  usage: "rarely",
  active: true,
};
const CRYPTFLIX: SubscriptionRow = {
  id: "sub-cryptflix",
  name: "Cryptflix",
  amountCents: 12_000,
  cadence: "yearly",
  usage: "often",
  active: true,
};
const OLD: SubscriptionRow = {
  id: "sub-old",
  name: "Bone Daily",
  amountCents: 800,
  cadence: "monthly",
  usage: "never",
  active: false,
  canceledOn: "2025-06-02",
};

async function renderScreen(seed: RealSeed = {}) {
  const ctx = await renderWithCrypt(<SubscriptionsScreen />, { mode: "real", seed });
  await screen.findByRole("button", { name: ADD_LABEL });
  return ctx;
}

afterEach(() => cleanup());

describe("Subscriptions screen lists", () => {
  it("lists active subscriptions sorted by monthly cost with a cadence subtitle and the usage in a chip", async () => {
    await renderScreen({ subscriptions: [CRYPTFLIX, GAZETTE, WRAITHCAST] });
    const zombies = screen.getByRole("heading", { name: "Zombies" }).closest("section, div") as HTMLElement;
    const names = within(zombies)
      .getAllByRole("button")
      .map((button) => button.textContent ?? "");
    const order = ["Wraithcast", "Gloom Gazette", "Cryptflix"].map((name) =>
      names.findIndex((text) => text.includes(name)),
    );
    expect(order.every((index) => index >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    // The usage appears once, in the Chip; the subtitle is only the cadence.
    expect(within(zombies).getAllByText("Monthly")).toHaveLength(2);
    expect(within(zombies).getByText("Yearly")).toBeTruthy();
    expect(within(zombies).queryByText(/ · (Never|Rarely|Often) used/)).toBeNull();
    for (const usage of ["Never used", "Rarely used", "Often used"]) {
      expect(within(zombies).getAllByText(usage)).toHaveLength(1);
    }
    // The chip sits inside its row, so the row's focus ring encloses it.
    const wraithRow = within(zombies).getByRole("button", { name: /^Wraithcast, Never used/ });
    expect(within(wraithRow).getByText("Never used")).toBeTruthy();
  });

  it("shows the total monthly cost of active subscriptions only", async () => {
    await renderScreen({ subscriptions: [WRAITHCAST, GAZETTE, OLD] });
    expect(screen.getByText("$135.49/mo")).toBeTruthy();
    expect(screen.getByText("2 active subscriptions")).toBeTruthy();
  });

  it("shows both empty states when there are no subscriptions", async () => {
    await renderScreen();
    expect(screen.getByText("No zombies in the basement. Suspiciously quiet.")).toBeTruthy();
    expect(screen.getByText("No tombstones yet. Suspiciously quiet.")).toBeTruthy();
    expect(screen.getByText("$0.00/mo")).toBeTruthy();
  });

  it("lists canceled subscriptions in the graveyard with R.I.P. and the date", async () => {
    await renderScreen({ subscriptions: [WRAITHCAST, OLD] });
    expect(screen.getByText("R.I.P. $8/mo · Canceled Jun 2")).toBeTruthy();
    expect(screen.queryByText("No tombstones yet. Suspiciously quiet.")).toBeNull();
  });
});

describe("Subscriptions screen add flow", () => {
  it("adds a subscription, closes the sheet and shows a toast", async () => {
    const user = userEvent.setup();
    const ctx = await renderScreen();
    await user.click(screen.getByRole("button", { name: ADD_LABEL }));
    const dialog = await screen.findByRole(DIALOG_ROLE);
    await user.type(within(dialog).getByLabelText("Name"), "Spooky Music");
    await user.type(within(dialog).getByLabelText("Amount"), "9.99");
    await user.click(within(dialog).getByRole("button", { name: "Save subscription" }));
    expect(await screen.findByText(/^Zombie\ added:\ Spooky\ Music,\ \$9\.99\/mo( · .+)?$/)).toBeTruthy();
    await waitFor(() => expect(screen.queryByRole(DIALOG_ROLE)).toBeNull());
    expect(await screen.findByText("Often used")).toBeTruthy();
    const rows = await ctx.realDb.subscriptions.toArray();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ name: "Spooky Music", amountCents: 999, active: true });
  });

  it("shows field errors and creates no row for an empty name and a missing amount", async () => {
    const user = userEvent.setup();
    const ctx = await renderScreen();
    await user.click(screen.getByRole("button", { name: ADD_LABEL }));
    const dialog = await screen.findByRole(DIALOG_ROLE);
    await user.click(within(dialog).getByRole("button", { name: "Save subscription" }));
    expect(await within(dialog).findByText("Enter the amount.")).toBeTruthy();
    expect(within(dialog).getByLabelText("Name").getAttribute("aria-invalid")).toBe("true");
    expect(within(dialog).getByLabelText("Amount").getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByRole(DIALOG_ROLE)).toBeTruthy();
    expect(await ctx.realDb.subscriptions.count()).toBe(0);
  });

  it("creates no row when the amount is 0", async () => {
    const user = userEvent.setup();
    const ctx = await renderScreen();
    await user.click(screen.getByRole("button", { name: ADD_LABEL }));
    const dialog = await screen.findByRole(DIALOG_ROLE);
    await user.type(within(dialog).getByLabelText("Name"), "Free Trial");
    await user.type(within(dialog).getByLabelText("Amount"), "0");
    await user.click(within(dialog).getByRole("button", { name: "Save subscription" }));
    await waitFor(() => expect(within(dialog).getByLabelText("Amount").getAttribute("aria-invalid")).toBe("true"));
    expect(screen.getByRole(DIALOG_ROLE)).toBeTruthy();
    expect(await ctx.realDb.subscriptions.count()).toBe(0);
  });

  it("returns focus to the Add subscription button after the sheet closes", async () => {
    const user = userEvent.setup();
    await renderScreen();
    const opener = screen.getByRole("button", { name: ADD_LABEL });
    await user.click(opener);
    await screen.findByRole(DIALOG_ROLE);
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole(DIALOG_ROLE)).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(opener));
  });
});

describe("Subscriptions screen cancel and graveyard", () => {
  it("cancels after confirmation, toasts the saving and adds a graveyard entry", async () => {
    const user = userEvent.setup();
    const ctx = await renderScreen({ subscriptions: [WRAITHCAST] });
    await user.click(screen.getByRole("button", { name: /^Wraithcast, Never used/ }));
    const details = await screen.findByRole(DIALOG_ROLE, { name: "Wraithcast" });
    await user.click(within(details).getByRole("button", { name: "Cancel subscription" }));
    const confirm = await screen.findByRole(DIALOG_ROLE, { name: "Cancel subscription" });
    expect(within(confirm).getByText("Cancel Wraithcast — saves $120/mo")).toBeTruthy();
    await user.click(within(confirm).getByRole("button", { name: "Cancel subscription" }));
    expect(await screen.findByText(/^\+\$120\/mo\ saved( · .+)?$/)).toBeTruthy();
    await waitFor(() => expect(screen.queryByRole(DIALOG_ROLE)).toBeNull());
    expect(await screen.findByText(/^R\.I\.P\. \$120\/mo/)).toBeTruthy();
    expect(screen.getByText("No zombies in the basement. Suspiciously quiet.")).toBeTruthy();
    expect((await ctx.realDb.subscriptions.get(WRAITHCAST.id))?.active).toBe(false);
  });

  it("brings a subscription back from the graveyard and toasts the returning cost", async () => {
    const user = userEvent.setup();
    const ctx = await renderScreen({ subscriptions: [OLD] });
    await user.click(screen.getByText("Bone Daily"));
    const dialog = await screen.findByRole(DIALOG_ROLE, { name: "Bone Daily" });
    await user.click(within(dialog).getByRole("button", { name: "Bring it back" }));
    expect(await screen.findByText(/^Bone\ Daily\ is\ back:\ \$8\/mo\ returns( · .+)?$/)).toBeTruthy();
    await waitFor(() => expect(screen.queryByRole(DIALOG_ROLE)).toBeNull());
    expect((await ctx.realDb.subscriptions.get(OLD.id))?.active).toBe(true);
    expect(await screen.findByText("No tombstones yet. Suspiciously quiet.")).toBeTruthy();
  });
});

describe("Subscriptions screen details and graveyard sheets", () => {
  it("shows only the per-month figure for a monthly subscription", async () => {
    const user = userEvent.setup();
    await renderScreen({ subscriptions: [WRAITHCAST] });
    await user.click(screen.getByRole("button", { name: /^Wraithcast, Never used/ }));
    const details = await screen.findByRole(DIALOG_ROLE, { name: "Wraithcast" });
    expect(within(details).getByText("$120/mo")).toBeTruthy();
    expect(within(details).queryByText(/per month/)).toBeNull();
  });

  it("adds the cadence line with the original amount for a non-monthly subscription", async () => {
    const user = userEvent.setup();
    await renderScreen({ subscriptions: [CRYPTFLIX] });
    await user.click(screen.getByRole("button", { name: /^Cryptflix, Often used/ }));
    const details = await screen.findByRole(DIALOG_ROLE, { name: "Cryptflix" });
    expect(within(details).getByText("Yearly · $120 per year")).toBeTruthy();
    expect(within(details).getByText("$10/mo")).toBeTruthy();
  });

  it("offers Bring it back as a secondary button", async () => {
    const user = userEvent.setup();
    await renderScreen({ subscriptions: [OLD] });
    await user.click(screen.getByText("Bone Daily"));
    const dialog = await screen.findByRole(DIALOG_ROLE, { name: "Bone Daily" });
    const button = within(dialog).getByRole("button", { name: "Bring it back" });
    expect(button.getAttribute("data-variant")).toBe("secondary");
    expect(dialog.querySelector('button[data-variant="primary"]')).toBeNull();
  });
});

describe("Subscriptions screen accessibility", () => {
  it(
    "has no axe violations with subscriptions and a graveyard entry",
    async () => {
      await renderScreen({ subscriptions: [WRAITHCAST, GAZETTE, OLD] });
      await expectNoAxeViolations(document.body);
    },
    AXE_TIMEOUT_MS,
  );

  it(
    "has no axe violations when empty",
    async () => {
      await renderScreen();
      await expectNoAxeViolations(document.body);
    },
    AXE_TIMEOUT_MS,
  );
});
