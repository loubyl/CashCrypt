// Tests of the Dashboard Guide: visibility, dismissal, focus, storage and axe
// (Requirements 5.1 to 5.14, 12.3, 12.4, 14.3).
import { cleanup, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Dashboard } from "@/components/dashboard/Dashboard";
import { GUIDE_STORAGE_KEY, startGuideSession } from "@/components/dashboard/CryptGuide";
import { expectNoAxeViolations } from "./helpers/axe";
import { renderWithCrypt, resetNavigationMock, type RealSeed } from "./helpers/crypt";

vi.mock("next/navigation", async () => (await import("./helpers/crypt")).createNavigationMock());

const WAIT = { timeout: 8000 };
const TEST_TIMEOUT_MS = 60000;
const SETTLE_MS = 400;
const SCENE_IMG_NAME = /^Level \d, /;
const GUIDE_TITLE = "How your crypt works";
const GOT_IT_NAME = /^Got it/;
const HOW_IT_WORKS_NAME = "How it works";
const DEMO_STEP = "Press Do it on Cancel Wraithcast and watch the zombie get buried";
const STEP_PATTERN = /Press Do it|^Tick |once you've done it/;
const STATUS_ROLES = ["status", "alert", "log", "timer", "marquee"];
const GRID_SELECTOR = '[class~="lg:grid"]';
const GUIDE_PLACEMENT = ["lg:col-start-2", "lg:row-start-1"];
const LEFT_COLUMN_GUIDE = ["lg:col-start-1", "lg:row-start-1", "lg:row-span-2"];
const RIGHT_COLUMN_GUIDE = ["lg:col-start-2", "lg:row-start-2"];

const POPULATED: RealSeed = {
  debts: [
    { id: "debt-1", name: "Scarlet Moth Card", balanceCents: 180_000, apr: 0.24, minimumPaymentCents: 5_500 },
  ],
  subscriptions: [
    { id: "sub-1", name: "StreamMax", amountCents: 2_299, cadence: "monthly", usage: "never", active: true },
  ],
  transactions: [{ id: "tx-1", date: "2025-06-10", amountCents: 450, description: "Coffee", category: "Food" }],
};

async function settle(): Promise<void> {
  await screen.findByRole("img", { name: SCENE_IMG_NAME }, WAIT);
  await new Promise((resolve) => setTimeout(resolve, SETTLE_MS));
}

async function renderDemo() {
  const ctx = await renderWithCrypt(<Dashboard />, { mode: "demo", seed: "level-4" });
  await settle();
  return ctx;
}

async function renderReal() {
  const ctx = await renderWithCrypt(<Dashboard />, { mode: "real", seed: POPULATED });
  await settle();
  return ctx;
}

function guideHeading(): HTMLElement | null {
  return screen.queryByRole("heading", { name: GUIDE_TITLE });
}

function howItWorksButton(): HTMLElement {
  return screen.getByRole("button", { name: HOW_IT_WORKS_NAME });
}

beforeEach(() => {
  resetNavigationMock();
  window.sessionStorage.clear();
  startGuideSession();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  window.sessionStorage.clear();
  startGuideSession();
});

describe("Guide in the demo", () => {
  it("shows the Guide with the first step on entering the demo", async () => {
    await renderDemo();
    expect(guideHeading()).not.toBeNull();
    expect(screen.getByText(DEMO_STEP)).toBeTruthy();
    expect(screen.queryByRole("button", { name: HOW_IT_WORKS_NAME })).toBeNull();
  }, TEST_TIMEOUT_MS);

  it("hides the Guide on Got it and focuses How it works, which reopens it and focuses its heading", async () => {
    const user = userEvent.setup();
    await renderDemo();

    await user.click(screen.getByRole("button", { name: GOT_IT_NAME }));
    await waitFor(() => expect(guideHeading()).toBeNull());
    expect(document.activeElement).toBe(howItWorksButton());
    expect(window.sessionStorage.getItem(GUIDE_STORAGE_KEY)).toBe("1");

    await user.click(howItWorksButton());
    const heading = await screen.findByRole("heading", { name: GUIDE_TITLE });
    expect(document.activeElement).toBe(heading);
    expect(window.sessionStorage.getItem(GUIDE_STORAGE_KEY)).toBeNull();
  }, TEST_TIMEOUT_MS);

  it("keeps the dismissal after a remount, and startGuideSession shows the Guide again", async () => {
    const user = userEvent.setup();
    await renderDemo();
    await user.click(screen.getByRole("button", { name: GOT_IT_NAME }));
    await waitFor(() => expect(guideHeading()).toBeNull());
    cleanup();

    await renderDemo();
    expect(guideHeading()).toBeNull();
    expect(howItWorksButton()).toBeTruthy();
    cleanup();

    startGuideSession();
    await renderDemo();
    expect(guideHeading()).not.toBeNull();
  }, TEST_TIMEOUT_MS);

  it("keeps the dismissal through a scenario switch, a reset and Skip to next week", async () => {
    const user = userEvent.setup();
    await renderDemo();
    await user.click(screen.getByRole("button", { name: GOT_IT_NAME }));
    await waitFor(() => expect(guideHeading()).toBeNull());

    await user.click(screen.getByRole("radio", { name: "Level 2" }));
    await waitFor(() => expect(screen.getByRole("radio", { name: "Level 2" }).getAttribute("aria-checked")).toBe("true"), WAIT);
    await settle();
    expect(guideHeading()).toBeNull();

    await user.click(screen.getByRole("button", { name: "Reset demo" }));
    await screen.findByText("Demo reset", {}, WAIT);
    await settle();
    expect(guideHeading()).toBeNull();

    await user.click(screen.getByRole("button", { name: "Skip to next week" }));
    await screen.findByText(/^Skipped to /, {}, WAIT);
    await settle();
    expect(guideHeading()).toBeNull();
    expect(howItWorksButton()).toBeTruthy();
  }, TEST_TIMEOUT_MS);

  it("still works when sessionStorage throws", async () => {
    vi.spyOn(window, "sessionStorage", "get").mockImplementation(() => {
      throw new DOMException("denied", "SecurityError");
    });
    const user = userEvent.setup();
    await renderDemo();
    expect(guideHeading()).not.toBeNull();

    await user.click(screen.getByRole("button", { name: GOT_IT_NAME }));
    await waitFor(() => expect(guideHeading()).toBeNull());
    expect(document.activeElement).toBe(howItWorksButton());

    await user.click(howItWorksButton());
    await screen.findByRole("heading", { name: GUIDE_TITLE });
  }, TEST_TIMEOUT_MS);
});

describe("Guide in the real Crypt", () => {
  it("shows no Card until opened, then no step, and writes no storage", async () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    const user = userEvent.setup();
    await renderReal();
    expect(guideHeading()).toBeNull();

    await user.click(howItWorksButton());
    const heading = await screen.findByRole("heading", { name: GUIDE_TITLE });
    expect(document.activeElement).toBe(heading);
    expect(screen.queryByText(STEP_PATTERN)).toBeNull();

    await user.click(screen.getByRole("button", { name: GOT_IT_NAME }));
    await waitFor(() => expect(guideHeading()).toBeNull());
    expect(document.activeElement).toBe(howItWorksButton());

    expect(setItem).not.toHaveBeenCalled();
    expect(window.sessionStorage.getItem(GUIDE_STORAGE_KEY)).toBeNull();
  }, TEST_TIMEOUT_MS);
});

describe("Guide structure", () => {
  it("is not a live region", async () => {
    await renderDemo();
    const guide = screen.getByRole("heading", { name: GUIDE_TITLE }).closest("section");
    expect(guide).not.toBeNull();
    expect(guide?.closest("[aria-live]")).toBeNull();
    expect(guide?.querySelector("[aria-live]")).toBeNull();
    STATUS_ROLES.forEach((role) => expect(guide?.querySelector(`[role="${role}"]`)).toBeNull());
  }, TEST_TIMEOUT_MS);

  it("adds no primary Button and applies the grid placement only while shown", async () => {
    const user = userEvent.setup();
    const { container } = await renderDemo();
    const guide = screen.getByRole("heading", { name: GUIDE_TITLE }).closest("section");
    expect(guide?.querySelector('[data-variant="primary"]')).toBeNull();
    expect(container.querySelectorAll('[data-variant="primary"]').length).toBeLessThanOrEqual(1);
    expect(container.querySelectorAll("h1").length).toBe(1);

    const grid = container.querySelector(GRID_SELECTOR);
    expect(grid).not.toBeNull();
    expect(grid?.firstElementChild).toBe(guide);
    GUIDE_PLACEMENT.forEach((name) => expect(guide?.classList.contains(name)).toBe(true));
    const [, left, right] = Array.from(grid?.children ?? []);
    LEFT_COLUMN_GUIDE.forEach((name) => expect(left?.classList.contains(name)).toBe(true));
    RIGHT_COLUMN_GUIDE.forEach((name) => expect(right?.classList.contains(name)).toBe(true));

    await user.click(screen.getByRole("button", { name: GOT_IT_NAME }));
    await waitFor(() => expect(guideHeading()).toBeNull());
    const hiddenGrid = container.querySelector(GRID_SELECTOR);
    const gridClasses = Array.from(hiddenGrid?.children ?? []).flatMap((child) => Array.from(child.classList));
    [...GUIDE_PLACEMENT, ...LEFT_COLUMN_GUIDE, ...RIGHT_COLUMN_GUIDE, "lg:row-span-2"].forEach((name) =>
      expect(gridClasses).not.toContain(name),
    );
    expect(container.querySelectorAll('[data-variant="primary"]').length).toBeLessThanOrEqual(1);
    expect(container.querySelectorAll("h1").length).toBe(1);
  }, TEST_TIMEOUT_MS);
});

describe("Guide axe", () => {
  it("has no violations in demo level 4 with the Guide shown and dismissed", async () => {
    const user = userEvent.setup();
    const { container } = await renderDemo();
    expect(guideHeading()).not.toBeNull();
    await expectNoAxeViolations(container);

    await user.click(screen.getByRole("button", { name: GOT_IT_NAME }));
    await waitFor(() => expect(guideHeading()).toBeNull());
    await expectNoAxeViolations(container);
  }, TEST_TIMEOUT_MS);

  it("has no violations in the populated real crypt with the Guide opened", async () => {
    const user = userEvent.setup();
    const { container } = await renderReal();
    await user.click(howItWorksButton());
    await screen.findByRole("heading", { name: GUIDE_TITLE });
    await expectNoAxeViolations(container);
  }, TEST_TIMEOUT_MS);
});
