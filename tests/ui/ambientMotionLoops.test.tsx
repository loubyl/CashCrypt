// Ambient motion loops start after the lazy import and clean up on unmount
// (house-scene Requirements 20.1, 20.2, 21.3, 21.4, 21.8, 24.7). gsap is wrapped with spies; the real library still runs.
import { cleanup, render, waitFor } from "@testing-library/react";
import gsap from "gsap";
import { useMemo, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AmbientMotion } from "@/components/house/AmbientMotion";
import { HouseScene } from "@/components/house/HouseScene";
import type { HouseState } from "@/lib/haunting";
import { buildSceneModel } from "@/lib/scene";

vi.mock("gsap", async (importOriginal) => {
  const actual = await importOriginal<typeof import("gsap")>();
  const core = actual.default;
  vi.spyOn(core, "timeline");
  vi.spyOn(core.ticker, "add");
  vi.spyOn(core.ticker, "remove");
  return { ...actual, default: core };
});

const VISIBILITY_EVENT = "visibilitychange";
const MONTHLY_INCOME_CENTS = 300_000;
const SWAY_PERIOD_MS = 4000;

type ObserverInstance = { observe: ReturnType<typeof vi.fn>; disconnect: ReturnType<typeof vi.fn> };
const observers: ObserverInstance[] = [];

class FakeIntersectionObserver {
  observe = vi.fn();
  disconnect = vi.fn();
  unobserve = vi.fn();
  constructor() {
    observers.push(this);
  }
}

function Harness() {
  // The scope ref is attached after child layout effects run, so mount the motion once the node exists.
  const [node, setNode] = useState<HTMLDivElement | null>(null);
  const scope = useMemo(() => ({ current: node }), [node]);
  return (
    <div ref={setNode} data-level="3">
      <svg>
        <g data-ambient="zombie-sway" data-sway-phase="0" data-sway-period-ms={SWAY_PERIOD_MS} />
        <g data-ambient="fog" />
        <g data-ambient="window-flicker" />
        <g
          data-ambient="ghost-orbit"
          data-orbit-cx="100"
          data-orbit-cy="100"
          data-orbit-rx="50"
          data-orbit-ry="20"
          data-phase="0"
          data-bob-period-ms="3000"
        />
      </svg>
      {node ? <AmbientMotion scope={scope} signature="a" /> : null}
    </div>
  );
}

/** Every timeline currently attached to the global timeline, at any depth. */
function liveTimelines(): gsap.core.Animation[] {
  return gsap.globalTimeline.getChildren(true, false, true);
}

beforeEach(() => {
  observers.length = 0;
  vi.stubGlobal("IntersectionObserver", FakeIntersectionObserver);
  vi.mocked(gsap.timeline).mockClear();
  vi.mocked(gsap.ticker.add).mockClear();
  vi.mocked(gsap.ticker.remove).mockClear();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("AmbientMotion loops", () => {
  it("starts the loops and the ghost ticker when motion is on", () => {
    render(<Harness />);
    expect(gsap.timeline).toHaveBeenCalled();
    expect(gsap.ticker.add).toHaveBeenCalledTimes(1);
    expect(observers).toHaveLength(1);
    expect(observers[0].observe).toHaveBeenCalledTimes(1);
    expect(liveTimelines().length).toBeGreaterThan(0);
  });

  it("removes timelines, the ticker callback and listeners on unmount", () => {
    const addListener = vi.spyOn(document, "addEventListener");
    const removeListener = vi.spyOn(document, "removeEventListener");
    const { unmount } = render(<Harness />);
    const tick = vi.mocked(gsap.ticker.add).mock.calls[0][0];
    const visibilityHandler = addListener.mock.calls.find(([type]) => type === VISIBILITY_EVENT)?.[1];
    expect(visibilityHandler).toBeDefined();
    expect(liveTimelines().length).toBeGreaterThan(0);

    unmount();

    expect(liveTimelines()).toHaveLength(0);
    expect(vi.mocked(gsap.ticker.remove).mock.calls.some(([fn]) => fn === tick)).toBe(true);
    expect(removeListener.mock.calls.some(([type, fn]) => type === VISIBILITY_EVENT && fn === visibilityHandler)).toBe(true);
    expect(observers[0].disconnect).toHaveBeenCalledTimes(1);
    addListener.mockRestore();
    removeListener.mockRestore();
  });
});

describe("HouseScene lazy ambient motion", () => {
  it("creates the loops only after the AmbientMotion module has loaded", async () => {
    const houseState: HouseState = {
      lightScore: 90,
      baseScore: 90,
      momentum: 0,
      decayLevel: 1,
      windowBrightness: 0.5,
      levelProgress: 0.5,
      zombies: [],
      ghosts: [],
      poltergeist: null,
    };
    const model = buildSceneModel({ houseState, monthlyIncomeCents: MONTHLY_INCOME_CENTS, graveyard: [], bound: false });
    const { unmount } = render(<HouseScene model={model} />);
    await waitFor(() => expect(gsap.timeline).toHaveBeenCalled());
    expect(gsap.ticker.add).toHaveBeenCalledTimes(1);
    unmount();
    expect(liveTimelines()).toHaveLength(0);
  });
});
