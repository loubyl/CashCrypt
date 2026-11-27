import { IDBKeyRange as FakeIDBKeyRange, IDBFactory as FakeIDBFactory } from "fake-indexeddb";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Dexie from "dexie";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Landing } from "@/components/landing/Landing";
import { ToastRegion } from "@/components/ui/ToastRegion";
import { CryptProvider } from "@/hooks/useCrypt";
import { openCrypt } from "@/lib/db/crypt";
import { MODE_STORAGE_KEY } from "@/lib/db/modeStore";
import { buildLandingPreview } from "@/lib/demo/preview";
import {
  DEFAULT_TEST_NOW,
  createMemoryStorage,
  navigationSpies,
  renderWithCrypt,
  resetNavigationMock,
} from "./helpers/crypt";
import { expectNoAxeViolations } from "./helpers/axe";

vi.mock("next/navigation", async () => (await import("./helpers/crypt")).createNavigationMock());
vi.mock("@/components/house/AmbientMotion", () => ({
  AmbientMotion: () => <div data-testid="ambient-motion-mock" />,
}));

const DEMO_DB_NAME = "cashcrypt-demo";
const AMBIENT_SETTLE_MS = 200;

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

  it("shows the preview as one role=img labeled with the level-4 demo house", async () => {
    await renderWithCrypt(<Landing />);
    const preview = screen.getByRole("img", { name: /^Preview of the demo house:/ });
    expect(preview.getAttribute("aria-label")).toBe(buildLandingPreview().summary);
    expect(screen.getAllByRole("img")).toHaveLength(1);
  });

  it("shows no link to the styleguide", async () => {
    await renderWithCrypt(<Landing />);
    expect(screen.queryByRole("link", { name: "View the styleguide" })).toBeNull();
    expect(document.querySelector('a[href="/styleguide"]')).toBeNull();
  });

  it("has exactly one h1 and lists the three how-it-works lines", async () => {
    await renderWithCrypt(<Landing />);
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    const section = screen.getByRole("region", { name: "How it works" });
    expect(within(section).getAllByRole("listitem")).toHaveLength(3);
  });

  it("never renders AmbientMotion", async () => {
    await renderWithCrypt(<Landing />);
    // AmbientMotion is a next/dynamic import gated on the reduced-motion effect: give both time to settle.
    await new Promise((resolve) => setTimeout(resolve, AMBIENT_SETTLE_MS));
    expect(screen.queryByTestId("ambient-motion-mock")).toBeNull();
  });

  it("opens no demo database until the demo button is pressed", async () => {
    const opened: string[] = [];
    const indexedDB = new FakeIDBFactory();
    Dexie.dependencies.indexedDB = indexedDB;
    Dexie.dependencies.IDBKeyRange = FakeIDBKeyRange;
    const openDb = (name: string) => {
      opened.push(name);
      return openCrypt(name, { indexedDB, IDBKeyRange: FakeIDBKeyRange });
    };
    const user = userEvent.setup();
    const storage = createMemoryStorage();
    render(
      <CryptProvider openDb={openDb} storage={storage} getClock={() => DEFAULT_TEST_NOW}>
        <ToastRegion>
          <Landing />
        </ToastRegion>
      </CryptProvider>,
    );
    await screen.findByRole("button", { name: "Enter the demo crypt" });
    expect(opened).not.toContain(DEMO_DB_NAME);
    await user.click(screen.getByRole("button", { name: "Enter the demo crypt" }));
    await waitFor(() => expect(opened).toContain(DEMO_DB_NAME));
    // Let the enter-demo handler finish inside this test: otherwise its router.replace lands on the
    // shared navigation spies during a later test.
    await waitFor(() => expect(navigationSpies.replace).toHaveBeenCalledWith("/"));
    expect(storage.getItem(MODE_STORAGE_KEY)).toBe("demo");
  });

  it("has no axe violations", async () => {
    const { container } = await renderWithCrypt(<Landing />);
    await expectNoAxeViolations(container);
  });

  it("enters the demo crypt: sets mode demo, seeds level-4 and navigates to home", async () => {
    const user = userEvent.setup();
    const ctx = await renderWithCrypt(<Landing />);
    const modeAtNavigation: (string | null)[] = [];
    navigationSpies.replace.mockImplementation(() => {
      modeAtNavigation.push(ctx.storage.getItem(MODE_STORAGE_KEY));
    });
    await user.click(screen.getByRole("button", { name: "Enter the demo crypt" }));
    await waitFor(() => expect(navigationSpies.replace).toHaveBeenCalledWith("/"));
    expect(ctx.storage.getItem(MODE_STORAGE_KEY)).toBe("demo");
    // Exactly one navigation, made by this test's own click, after the mode was written.
    expect(modeAtNavigation).toEqual(["demo"]);
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
