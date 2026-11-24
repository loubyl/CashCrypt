// Reduced motion keeps GSAP out of the scene (house-scene Requirements 20.1, 20.2, 24.7).
import { act, cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HouseScene } from "@/components/house/HouseScene";
import type { HouseState } from "@/lib/haunting";
import type { DecayLevel } from "@/lib/haunting/config";
import { buildSceneModel } from "@/lib/scene";
import type { SceneModel } from "@/lib/scene";

const calls = vi.hoisted(() => ({ timeline: 0, ticker: 0, set: 0, to: 0, module: 0 }));

vi.mock("gsap", () => {
  const gsap = {
    timeline: () => {
      calls.timeline += 1;
      return { to: () => undefined, add: () => undefined, kill: () => undefined, pause: () => undefined, resume: () => undefined };
    },
    ticker: {
      add: () => {
        calls.ticker += 1;
      },
      remove: () => undefined,
    },
    set: () => {
      calls.set += 1;
    },
    to: () => {
      calls.to += 1;
    },
    quickSetter: () => () => undefined,
    registerPlugin: () => undefined,
    context: () => ({ add: () => undefined, revert: () => undefined, kill: () => undefined }),
  };
  return { default: gsap, gsap };
});

// The factory runs once, when the module is first imported.
vi.mock("@/components/house/AmbientMotion", () => {
  calls.module += 1;
  return { AmbientMotion: () => null };
});

const REDUCED_QUERY = "(prefers-reduced-motion: reduce)";
const MONTHLY_INCOME_CENTS = 300_000;
const HIDE_CLASS_PREFIX = "motion-reduce:hidden";
const LIVE_HIDE_CLASS = "group-data-[motion=reduced]/scene:hidden";
const ATMOSPHERE_KINDS = ["fog", "firefly", "bat"] as const;
const SETTLE_MS = 50;

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

/** Lets the lazy import and any effect settle. */
async function flush(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, SETTLE_MS));
  });
}

function resetCalls(): void {
  calls.timeline = 0;
  calls.ticker = 0;
  calls.set = 0;
  calls.to = 0;
  calls.module = 0;
}

beforeEach(() => {
  resetCalls();
  vi.resetModules();
});

afterEach(() => {
  cleanup();
  Object.defineProperty(window, "matchMedia", { configurable: true, writable: true, value: realMatchMedia });
});

describe("ambient motion under reduced motion", () => {
  it("creates no timeline, ticker callback or tween when reduced motion is on", async () => {
    stubReducedPreference(true);
    render(<HouseScene model={modelAt(4)} />);
    await flush();

    expect(calls.timeline).toBe(0);
    expect(calls.ticker).toBe(0);
    expect(calls.set).toBe(0);
    expect(calls.to).toBe(0);
  });

  it("never imports the ambient motion module when reduced motion is on", async () => {
    stubReducedPreference(true);
    const { rerender } = render(<HouseScene model={modelAt(4)} />);
    rerender(<HouseScene model={modelAt(2)} />);
    await flush();

    expect(calls.module).toBe(0);
  });

  it("requests the ambient motion module when reduced motion is off", async () => {
    stubReducedPreference(false);
    render(<HouseScene model={modelAt(4)} />);

    await waitFor(() => expect(calls.module).toBe(1));
  });

  it("marks the scene container as reduced", () => {
    stubReducedPreference(true);
    const { container } = render(<HouseScene model={modelAt(4)} />);

    expect(container.querySelector('[data-part="scene"]')?.getAttribute("data-motion")).toBe("reduced");
  });

  it("leaves the scene container unmarked when motion is allowed", () => {
    stubReducedPreference(false);
    const { container } = render(<HouseScene model={modelAt(4)} />);

    expect(container.querySelector('[data-part="scene"]')?.hasAttribute("data-motion")).toBe(false);
  });
});

describe("atmosphere hide rules", () => {
  function hiddenByAncestor(element: Element): boolean {
    for (let node: Element | null = element; node; node = node.parentElement) {
      const className = node.getAttribute("class") ?? "";
      if (className.includes(HIDE_CLASS_PREFIX) && className.includes(LIVE_HIDE_CLASS)) return true;
    }
    return false;
  }

  it.each([1, 4] as const)("hides every fog bar, firefly and bat through the reduced-motion classes at level %i", (level) => {
    stubReducedPreference(true);
    const { container } = render(<HouseScene model={modelAt(level)} />);

    const atmosphere = ATMOSPHERE_KINDS.flatMap((kind) =>
      Array.from(container.querySelectorAll(`[data-ambient="${kind}"]`)),
    );
    expect(atmosphere.length).toBeGreaterThan(0);
    for (const element of atmosphere) expect(hiddenByAncestor(element)).toBe(true);
  });

  it("draws fireflies at level 1 and bats at level 4 so the hide rules have something to hide", () => {
    stubReducedPreference(true);
    const level1 = render(<HouseScene model={modelAt(1)} />);
    expect(level1.container.querySelectorAll('[data-ambient="firefly"]').length).toBeGreaterThan(0);
    level1.unmount();

    const level4 = render(<HouseScene model={modelAt(4)} />);
    expect(level4.container.querySelectorAll('[data-ambient="bat"]').length).toBeGreaterThan(0);
  });
});
