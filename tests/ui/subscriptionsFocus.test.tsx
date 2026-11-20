// Focus after a subscription moves between the Zombies list and the Graveyard.
// The row that opened the sheet is replaced by a row in the other list, so the
// sheet cannot return focus to its trigger. Focus must land on the moved row,
// never on <body>.
import { cleanup, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { SubscriptionsScreen } from "@/components/screens/SubscriptionsScreen";
import type { SubscriptionRow } from "@/types/finance";
import { renderWithCrypt, type RealSeed } from "./helpers/crypt";

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
const OLD: SubscriptionRow = {
  id: "sub-old",
  name: "Bone Daily",
  amountCents: 800,
  cadence: "monthly",
  usage: "never",
  active: false,
  canceledOn: "2025-06-02",
};

async function renderScreen(seed: RealSeed) {
  await renderWithCrypt(<SubscriptionsScreen />, { mode: "real", seed });
  await screen.findByRole("button", { name: "Add subscription" });
}

function sectionOf(title: string): HTMLElement {
  const heading = screen.getByRole("heading", { name: title });
  const section = heading.closest("section");
  if (!section) throw new Error(`No section for ${title}.`);
  return section;
}

afterEach(() => cleanup());

describe("Subscriptions focus after a row moves", () => {
  it("focuses the moved row in the Graveyard after canceling from its detail sheet", async () => {
    const user = userEvent.setup();
    await renderScreen({ subscriptions: [WRAITHCAST, GAZETTE] });
    await user.click(screen.getByRole("button", { name: /^Wraithcast, Never used/ }));
    const details = await screen.findByRole(DIALOG_ROLE, { name: "Wraithcast" });
    await user.click(within(details).getByRole("button", { name: "Cancel subscription" }));
    const confirm = await screen.findByRole(DIALOG_ROLE, { name: "Cancel subscription" });
    await user.click(within(confirm).getByRole("button", { name: "Cancel subscription" }));
    await waitFor(() => expect(screen.queryByRole(DIALOG_ROLE)).toBeNull());
    await waitFor(() => {
      expect(document.activeElement).not.toBe(document.body);
      const graveRow = within(sectionOf("Graveyard")).getByRole("button", { name: /Wraithcast/ });
      expect(document.activeElement).toBe(graveRow);
    });
  });

  it("returns focus to the row itself when the cancel is kept", async () => {
    const user = userEvent.setup();
    await renderScreen({ subscriptions: [WRAITHCAST] });
    const row = screen.getByRole("button", { name: /^Wraithcast, Never used/ });
    await user.click(row);
    const details = await screen.findByRole(DIALOG_ROLE, { name: "Wraithcast" });
    await user.click(within(details).getByRole("button", { name: "Cancel subscription" }));
    const confirm = await screen.findByRole(DIALOG_ROLE, { name: "Cancel subscription" });
    await user.click(within(confirm).getByRole("button", { name: "Keep it" }));
    await waitFor(() => expect(screen.queryByRole(DIALOG_ROLE)).toBeNull());
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole("button", { name: /^Wraithcast, Never used/ })),
    );
  });

  it("focuses the moved row in Zombies after Bring it back", async () => {
    const user = userEvent.setup();
    await renderScreen({ subscriptions: [OLD, GAZETTE] });
    await user.click(screen.getByRole("button", { name: /Bone Daily/ }));
    const dialog = await screen.findByRole(DIALOG_ROLE, { name: "Bone Daily" });
    await user.click(within(dialog).getByRole("button", { name: "Bring it back" }));
    await waitFor(() => expect(screen.queryByRole(DIALOG_ROLE)).toBeNull());
    await waitFor(() => {
      expect(document.activeElement).not.toBe(document.body);
      const zombieRow = within(sectionOf("Zombies")).getByRole("button", { name: /^Bone Daily, Never used/ });
      expect(document.activeElement).toBe(zombieRow);
    });
  });
});
