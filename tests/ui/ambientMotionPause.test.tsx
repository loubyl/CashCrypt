// Ambient motion pauses only its own timeline when off screen (house-scene Requirements 21.3, 21.4, 21.8, 24.7).
// Real gsap core; IntersectionObserver is mocked so the test can drive visibility.
import { act, cleanup, render } from "@testing-library/react";
import gsap from "gsap";
import { useMemo, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AmbientMotion } from "@/components/house/AmbientMotion";

const SWAY_PERIOD_MS = 4000;
const WAIT_MS = 250;
const IN_FLIGHT_TARGET = 100;

type ObserverCallback = (entries: Array<{ isIntersecting: boolean }>) => void;
let observerCallback: ObserverCallback | null = null;

class FakeIntersectionObserver {
  observe = vi.fn();
  disconnect = vi.fn();
  unobserve = vi.fn();
  constructor(callback: ObserverCallback) {
    observerCallback = callback;
  }
}

function Harness() {
  // The scope ref is attached after child layout effects run, so mount the motion once the node exists.
  const [node, setNode] = useState<HTMLDivElement | null>(null);
  const scope = useMemo(() => ({ current: node }), [node]);
  return (
    <div ref={setNode} data-level="1">
      <svg>
        <g data-testid="sway" data-ambient="zombie-sway" data-sway-phase="0" data-sway-period-ms={SWAY_PERIOD_MS} />
      </svg>
      {node ? <AmbientMotion scope={scope} signature="a" /> : null}
    </div>
  );
}

function setOnScreen(isIntersecting: boolean): void {
  act(() => observerCallback?.([{ isIntersecting }]));
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

let ambientRoot: gsap.core.Timeline;

beforeEach(() => {
  observerCallback = null;
  vi.stubGlobal("IntersectionObserver", FakeIntersectionObserver);
  const timelineSpy = vi.spyOn(gsap, "timeline");
  render(<Harness />);
  ambientRoot = timelineSpy.mock.results[0].value as gsap.core.Timeline;
  timelineSpy.mockRestore();
});

afterEach(() => {
  cleanup();
  gsap.globalTimeline.resume();
  vi.unstubAllGlobals();
});

describe("AmbientMotion pause", () => {
  it("runs while on screen", async () => {
    expect(ambientRoot.paused()).toBe(false);
    await wait(WAIT_MS);
    expect(ambientRoot.time()).toBeGreaterThan(0);
  });

  it("pauses only the ambient root timeline when the scene leaves the screen", async () => {
    setOnScreen(false);
    expect(ambientRoot.paused()).toBe(true);
    expect(gsap.globalTimeline.paused()).toBe(false);
    const frozenAt = ambientRoot.time();
    await wait(WAIT_MS);
    expect(ambientRoot.time()).toBe(frozenAt);
  });

  it("keeps a separate in-flight timeline progressing while the scene is off screen", async () => {
    const target = { value: 0 };
    const moment = gsap.timeline();
    moment.to(target, { value: IN_FLIGHT_TARGET, duration: 5, ease: "none" });
    setOnScreen(false);
    await wait(WAIT_MS);
    expect(ambientRoot.paused()).toBe(true);
    expect(moment.paused()).toBe(false);
    expect(target.value).toBeGreaterThan(0);
    moment.kill();
  });

  it("resumes the ambient root when the scene returns to the screen", async () => {
    setOnScreen(false);
    setOnScreen(true);
    expect(ambientRoot.paused()).toBe(false);
    const before = ambientRoot.time();
    await wait(WAIT_MS);
    expect(ambientRoot.time()).toBeGreaterThan(before);
  });
});
