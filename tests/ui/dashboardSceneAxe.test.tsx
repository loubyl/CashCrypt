// axe pass for the Dashboard with the house Scene in three states: empty real crypt,
// demo level 4 and loading (Requirements 19.9, 24.7).
import { cleanup, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Dashboard } from "@/components/dashboard/Dashboard";
import { expectNoAxeViolations } from "./helpers/axe";
import { renderWithCrypt, resetNavigationMock } from "./helpers/crypt";

// While `holdRowsLoad.active` is true, the live query over the Crypt rows never resolves.
const holdRowsLoad = vi.hoisted(() => ({ active: false }));

vi.mock("@/lib/db/queries", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/db/queries")>();
  return {
    ...original,
    readAllRows: (...args: Parameters<typeof original.readAllRows>) =>
      holdRowsLoad.active ? new Promise<never>(() => {}) : original.readAllRows(...args),
  };
});

vi.mock("next/navigation", async () => (await import("./helpers/crypt")).createNavigationMock());

const AXE_TIMEOUT_MS = 60000;
const SETTLE_MS = 400;
const SCENE_IMG_NAME = /^Level \d, /;
const SCENE_SKELETON_SELECTOR = '[data-part="scene-skeleton"]';

async function settle(): Promise<void> {
  await screen.findByRole("img", { name: SCENE_IMG_NAME }, { timeout: 5000 });
  await new Promise((resolve) => setTimeout(resolve, SETTLE_MS));
}

beforeEach(() => {
  resetNavigationMock();
  holdRowsLoad.active = false;
});
afterEach(() => {
  cleanup();
  holdRowsLoad.active = false;
});

describe("Dashboard with the Scene axe", () => {
  it(
    "has no violations in the empty real crypt",
    async () => {
      const { container } = await renderWithCrypt(<Dashboard />, { mode: "real", seed: {} });
      await settle();
      expect(screen.getByRole("img", { name: SCENE_IMG_NAME }).getAttribute("data-part")).toBe("scene");
      await expectNoAxeViolations(container);
    },
    AXE_TIMEOUT_MS,
  );

  it(
    "has no violations in demo level 4",
    async () => {
      const { container } = await renderWithCrypt(<Dashboard />, { mode: "demo", seed: "level-4" });
      await settle();
      expect(screen.getByRole("img", { name: /^Level 4, Crumbling\./ })).toBeTruthy();
      await expectNoAxeViolations(container);
    },
    AXE_TIMEOUT_MS,
  );

  it(
    "has no violations while loading",
    async () => {
      holdRowsLoad.active = true;
      const { container } = await renderWithCrypt(<Dashboard />, { mode: "real", seed: {} });
      // The load never resolves, so the Scene skeleton must stay on screen.
      await new Promise((resolve) => setTimeout(resolve, SETTLE_MS));
      const skeleton = container.querySelector(SCENE_SKELETON_SELECTOR);
      expect(skeleton).not.toBeNull();
      expect(skeleton?.getAttribute("aria-busy")).toBe("true");
      expect(screen.queryByRole("img", { name: SCENE_IMG_NAME })).toBeNull();
      await expectNoAxeViolations(container);
    },
    AXE_TIMEOUT_MS,
  );
});
