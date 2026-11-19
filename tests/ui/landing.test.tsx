import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Landing } from "@/components/landing/Landing";
import { MODE_STORAGE_KEY } from "@/lib/db/modeStore";
import { navigationSpies, renderWithCrypt, resetNavigationMock } from "./helpers/crypt";

vi.mock("next/navigation", async () => (await import("./helpers/crypt")).createNavigationMock());

const OPEN_SHEET_LABEL = "Start my own crypt";
const SUBMIT_LABEL = "Create my crypt";
const INCOME_LABEL = "Monthly income";
const TOO_LOW_INCOME_TEXT = "0.99";
const VALID_INCOME_TEXT = "4000";
const VALID_INCOME_CENTS = 400_000;

async function openSheetAndType(user: ReturnType<typeof userEvent.setup>, text: string) {
  await user.click(await screen.findByRole("button", { name: OPEN_SHEET_LABEL }));
  const input = await screen.findByLabelText(INCOME_LABEL);
  await user.type(input, text);
  return input;
}

describe("Landing", () => {
  beforeEach(() => {
    resetNavigationMock();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders the wordmark and the pitch line", async () => {
    await renderWithCrypt(<Landing />);
    expect(screen.getByRole("heading", { level: 1, name: "CashCrypt" })).toBeTruthy();
    expect(screen.getByText(/Your money habits haunt your house/)).toBeTruthy();
  });

  it("renders exactly one primary button", async () => {
    await renderWithCrypt(<Landing />);
    const primary = document.querySelectorAll('button[data-variant="primary"]');
    expect(primary).toHaveLength(1);
    expect(primary[0]?.textContent).toContain("Enter the demo crypt");
  });

  it("links to the styleguide", async () => {
    await renderWithCrypt(<Landing />);
    const link = screen.getByRole("link", { name: "View the styleguide" });
    expect(link.getAttribute("href")).toBe("/styleguide");
  });

  it("enters the demo crypt: sets mode demo, seeds level-4 and navigates to home", async () => {
    const user = userEvent.setup();
    const ctx = await renderWithCrypt(<Landing />);
    await user.click(screen.getByRole("button", { name: "Enter the demo crypt" }));
    await waitFor(() => expect(navigationSpies.replace).toHaveBeenCalledWith("/"));
    expect(ctx.storage.getItem(MODE_STORAGE_KEY)).toBe("demo");
    const profile = await ctx.demoDb.profile.toCollection().first();
    expect(profile?.scenarioId).toBe("level-4");
    expect(await ctx.realDb.profile.count()).toBe(0);
  });

  it("creates the Profile and sets mode real through onboarding", async () => {
    const user = userEvent.setup();
    const ctx = await renderWithCrypt(<Landing />);
    await openSheetAndType(user, VALID_INCOME_TEXT);
    await user.click(screen.getByRole("button", { name: SUBMIT_LABEL }));
    await waitFor(() => expect(navigationSpies.replace).toHaveBeenCalledWith("/"));
    expect(ctx.storage.getItem(MODE_STORAGE_KEY)).toBe("real");
    const profile = await ctx.realDb.profile.toCollection().first();
    expect(profile?.monthlyIncomeCents).toBe(VALID_INCOME_CENTS);
  });

  it("keeps the sheet open with an error and writes nothing for an income of $0.99", async () => {
    const user = userEvent.setup();
    const ctx = await renderWithCrypt(<Landing />);
    const input = await openSheetAndType(user, TOO_LOW_INCOME_TEXT);
    await user.click(screen.getByRole("button", { name: SUBMIT_LABEL }));
    await waitFor(() => expect(input.getAttribute("aria-invalid")).toBe("true"));
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(await ctx.realDb.profile.count()).toBe(0);
    expect(ctx.storage.getItem(MODE_STORAGE_KEY)).toBeNull();
    expect(navigationSpies.replace).not.toHaveBeenCalled();
  });

  it("offers 'Continue to my crypt' when a Profile exists and sets mode real", async () => {
    const ctx = await renderWithCrypt(<Landing />, { mode: "real", seed: {} });
    ctx.storage.removeItem(MODE_STORAGE_KEY);
    const button = await screen.findByRole("button", { name: "Continue to my crypt" });
    expect(screen.queryByRole("button", { name: OPEN_SHEET_LABEL })).toBeNull();
    fireEvent.click(button);
    expect(ctx.storage.getItem(MODE_STORAGE_KEY)).toBe("real");
    expect(navigationSpies.replace).toHaveBeenCalledWith("/");
  });
});
