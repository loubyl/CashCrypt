// Static house scene and its Dashboard layout (house-scene Requirements 19.1, 19.3, 19.6, 21.7, 22.5, 22.11, 24.7, 24.8).
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Dashboard } from "@/components/dashboard/Dashboard";
import { HouseScene } from "@/components/house/HouseScene";
import type { HouseState } from "@/lib/haunting";
import type { DecayLevel } from "@/lib/haunting/config";
import { buildSceneModel } from "@/lib/scene";
import type { SceneModel } from "@/lib/scene";
import { renderWithCrypt, resetNavigationMock } from "./helpers/crypt";
import { resetViewport, setViewportWidth } from "./helpers/viewport";

vi.mock("next/navigation", async () => (await import("./helpers/crypt")).createNavigationMock());

const MONTHLY_INCOME_CENTS = 300_000;
const DESKTOP_WIDTH = 1280;
const MOBILE_WIDTH = 600;
const FOCUSABLE_SELECTOR =
  "a[href], button, input, select, textarea, summary, [tabindex], [contenteditable], audio[controls], video[controls]";
const REACT_PROPS_PREFIX = "__reactProps$";
const HANDLER_PATTERN = /^on[A-Z]/;
const LEVEL_4_PREFIX = /^Level 4, Crumbling\./;
const EMPTY_TAIL = " no zombies, no ghosts, no tombstones";
const LEVEL_4_SUMMARY = `Level 4, Crumbling.${EMPTY_TAIL}`;
const LEVEL_2_SUMMARY = `Level 2, Uneasy.${EMPTY_TAIL}`;

function modelAt(level: DecayLevel): SceneModel {
  const houseState: HouseState = {
    lightScore: 50,
    baseScore: 50,
    momentum: 0,
    decayLevel: level,
    windowBrightness: 0.5,
    levelProgress: 0.5,
    zombies: [],
    ghosts: [],
    poltergeist: null,
  };
  return buildSceneModel({ houseState, monthlyIncomeCents: MONTHLY_INCOME_CENTS, graveyard: [], bound: false });
}

/** Names of React event handler props found on a DOM node. */
function handlerNames(node: Element): string[] {
  const key = Object.keys(node).find((k) => k.startsWith(REACT_PROPS_PREFIX));
  if (!key) return [];
  const props = (node as unknown as Record<string, Record<string, unknown>>)[key];
  return Object.keys(props).filter((name) => HANDLER_PATTERN.test(name) && typeof props[name] === "function");
}

beforeEach(() => resetNavigationMock());
afterEach(() => {
  cleanup();
  resetViewport();
});

describe("HouseScene accessibility", () => {
  it("exposes exactly one image role whose label equals the model summary", () => {
    const model = modelAt(4);
    const { container } = render(<HouseScene model={model} />);
    expect(container.querySelectorAll('[role="img"]')).toHaveLength(1);
    expect(screen.getAllByRole("img")).toHaveLength(1);
    expect(screen.getByRole("img").getAttribute("aria-label")).toBe(model.summary);
    expect(model.summary).toBe(LEVEL_4_SUMMARY);
  });

  it("updates the label when the model changes", () => {
    const { rerender } = render(<HouseScene model={modelAt(4)} />);
    expect(screen.getByRole("img").getAttribute("aria-label")).toBe(LEVEL_4_SUMMARY);
    rerender(<HouseScene model={modelAt(2)} />);
    expect(screen.getByRole("img").getAttribute("aria-label")).toBe(LEVEL_2_SUMMARY);
    expect(screen.getAllByRole("img")).toHaveLength(1);
  });

  it("hides the svg from assistive technology", () => {
    const { container } = render(<HouseScene model={modelAt(3)} />);
    const svg = container.querySelector("svg") as SVGSVGElement;
    expect(svg.getAttribute("aria-hidden")).toBe("true");
    expect(svg.getAttribute("focusable")).toBe("false");
  });

  it("contains no focusable element and no event handler", () => {
    const { container } = render(<HouseScene model={modelAt(4)} />);
    const root = container.firstElementChild as Element;
    expect(root.querySelectorAll(FOCUSABLE_SELECTOR)).toHaveLength(0);
    for (const node of [root, ...Array.from(root.querySelectorAll("*"))]) {
      expect(handlerNames(node)).toEqual([]);
    }
  });

  it("keeps the same svg node when the model changes", () => {
    const { container, rerender } = render(<HouseScene model={modelAt(4)} />);
    const before = container.querySelector("svg");
    const root = container.firstElementChild;
    rerender(<HouseScene model={modelAt(1)} />);
    expect(container.querySelector("svg")).toBe(before);
    expect(container.firstElementChild).toBe(root);
    expect(root?.getAttribute("data-level")).toBe("1");
  });
});

describe("Dashboard scene states", () => {
  it("shows the scene in the level 4 demo and keeps its svg across a data change", async () => {
    const ctx = await renderWithCrypt(<Dashboard />, { mode: "demo", seed: "level-4" });
    const scene = await screen.findByRole("img", { name: LEVEL_4_PREFIX });
    const svg = scene.querySelector("svg");
    expect(svg?.getAttribute("aria-hidden")).toBe("true");
    expect(screen.getAllByRole("img")).toHaveLength(1);
    // Lowering the debt balances changes the model; the scene node must survive.
    await ctx.demoDb.debts.toCollection().modify((debt) => {
      debt.balanceCents = 1;
    });
    await screen.findByRole("img");
    const after = screen.getByRole("img");
    expect(after.querySelector("svg")).toBe(svg);
  });

  it("shows the scene for an empty real crypt", async () => {
    await renderWithCrypt(<Dashboard />, { mode: "real", seed: {} });
    const scene = await screen.findByRole("img");
    expect(scene.getAttribute("aria-label")).toMatch(/^Level [1-5], \w+\./);
    expect(scene.getAttribute("data-part")).toBe("scene");
    expect(scene.querySelector("svg")).toBeTruthy();
  });

  it("shows a busy skeleton with the scene aspect ratio while loading", async () => {
    const { container } = await renderWithCrypt(<Dashboard />, { mode: "demo", seed: "level-4" });
    const skeleton = container.querySelector('[data-part="scene-skeleton"]') as HTMLElement | null;
    expect(skeleton).not.toBeNull();
    expect(skeleton?.getAttribute("aria-busy")).toBe("true");
    expect(skeleton?.style.aspectRatio).toBe("4 / 3");
    expect(container.querySelector("main")?.getAttribute("aria-busy")).toBe("true");
    expect(screen.queryByRole("img")).toBeNull();
    await screen.findByRole("img", { name: LEVEL_4_PREFIX });
    expect(container.querySelector('[data-part="scene-skeleton"]')).toBeNull();
    expect(container.querySelector("main")?.hasAttribute("aria-busy")).toBe(false);
  });

  it.each([
    ["desktop", DESKTOP_WIDTH],
    ["mobile", MOBILE_WIDTH],
  ])("uses a single column by default and two columns from the lg breakpoint on %s", async (_name, width) => {
    const { container } = await renderWithCrypt(<Dashboard />, { mode: "demo", seed: "level-4", width });
    await screen.findByRole("img", { name: LEVEL_4_PREFIX });
    const grid = container.querySelector("main > div.lg\\:grid") as HTMLElement;
    const classes = grid.className.split(/\s+/);
    // Unprefixed classes apply below lg: a single flex column.
    expect(classes).toContain("flex");
    expect(classes).toContain("flex-col");
    expect(classes).not.toContain("grid-cols-2");
    // Prefixed classes switch to two columns at lg (1024px) and a 7fr/5fr split at xl.
    expect(classes).toContain("lg:grid");
    expect(classes).toContain("lg:grid-cols-2");
    expect(classes).toContain("xl:grid-cols-[7fr_5fr]");
    // Below lg the two column wrappers dissolve so the order is a single stack.
    for (const column of Array.from(grid.children)) {
      expect(column.className.split(/\s+/)).toContain("contents");
      expect(column.className).toContain("lg:flex-col");
    }
  });
});

describe("Viewport helper", () => {
  it("can simulate both widths used by the layout test", () => {
    setViewportWidth(MOBILE_WIDTH);
    expect(window.matchMedia("(min-width: 1024px)").matches).toBe(false);
    setViewportWidth(DESKTOP_WIDTH);
    expect(window.matchMedia("(min-width: 1024px)").matches).toBe(true);
  });
});
