// Art structure of the scene that the review found wrong (house-scene checkpoint 2):
// ghosts in front of the windows, a spirit-shaped Poltergeist whose swirl turns, the
// attic window clear of the Poltergeist, and wonkiness that grows with decay.
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { HouseScene } from "@/components/house/HouseScene";
import type { HouseState } from "@/lib/haunting";
import type { DecayLevel } from "@/lib/haunting/config";
import { POLTERGEIST_CENTER, POLTERGEIST_SIZE, WINDOW_LAYOUT, buildSceneModel } from "@/lib/scene";

const INCOME = 300_000;

function houseAt(level: DecayLevel, extra: Partial<HouseState> = {}): HouseState {
  return {
    lightScore: 50,
    baseScore: 50,
    momentum: 0,
    decayLevel: level,
    windowBrightness: 0.5,
    levelProgress: 0.5,
    zombies: [],
    ghosts: [],
    poltergeist: null,
    ...extra,
  };
}

function renderScene(houseState: HouseState) {
  const model = buildSceneModel({ houseState, monthlyIncomeCents: INCOME, graveyard: [], bound: false });
  return render(<HouseScene model={model} />);
}

afterEach(() => cleanup());

describe("house scene art", () => {
  it("draws the ghosts after the windows, so a ghost is never hidden behind a window", () => {
    const ghost = { transactionId: "g-1", amount: 500, description: "Latte", category: "Coffee", date: "2025-06-01" };
    const { container } = renderScene(houseAt(2, { ghosts: [ghost] }));
    const windows = container.querySelector('[data-part="windows"]');
    const ghosts = container.querySelector('[data-part="ghosts"]');
    expect(windows && ghosts).toBeTruthy();
    expect(windows!.compareDocumentPosition(ghosts!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("draws the ghost body at 85% opacity so window light shows through, with solid eyes", () => {
    const ghost = { transactionId: "g-1", amount: 500, description: "Latte", category: "Coffee", date: "2025-06-01" };
    const { container } = renderScene(houseAt(1, { ghosts: [ghost] }));
    const figure = container.querySelector('[data-part="ghost"]') as Element;
    const body = figure.querySelector('[data-part="ghost-body"]') as Element;
    expect(Number(body.getAttribute("opacity"))).toBe(0.85);
    const eyes = figure.querySelectorAll('[data-part="ghost-eye"]');
    expect(eyes).toHaveLength(2);
    for (const eye of eyes) {
      expect(eye.hasAttribute("opacity")).toBe(false);
      for (let node = eye.parentElement; node && node !== figure; node = node.parentElement) {
        expect(node.hasAttribute("opacity")).toBe(false);
      }
    }
  });

  it("pulses the Poltergeist body and turns only its swirl, and keeps the attic window clear of it", () => {
    const poltergeist = { totalAmount: 36_000, transactionCount: 30, byCategory: { Coffee: 36_000 } };
    const { container } = renderScene(houseAt(4, { poltergeist }));
    expect(container.querySelector('[data-ambient="poltergeist"]')).toBeTruthy();
    expect(container.querySelector('[data-ambient="poltergeist-swirl"]')).toBeTruthy();
    expect(container.querySelector('[data-part="poltergeist-body"] polygon')).toBeNull();
    const attic = WINDOW_LAYOUT[5].box;
    const radius = (POLTERGEIST_SIZE / 2) * 1.08; // pulse peak
    const nearestX = Math.max(attic.x, Math.min(POLTERGEIST_CENTER.x, attic.x + attic.w));
    const nearestY = Math.max(attic.y, Math.min(POLTERGEIST_CENTER.y, attic.y + attic.h));
    expect(Math.hypot(nearestX - POLTERGEIST_CENTER.x, nearestY - POLTERGEIST_CENTER.y)).toBeGreaterThan(radius);
  });

  it("tilts no window at level 1 beyond a fraction of a degree, and tilts them more at level 5", () => {
    const tilt = (level: DecayLevel) =>
      Array.from(renderScene(houseAt(level)).container.querySelectorAll('[data-part^="window:"]')).map((node) => {
        const match = /rotate\((-?[\d.]+)/.exec(node.getAttribute("transform") ?? "");
        return Math.abs(Number(match?.[1] ?? 0));
      });
    const level1 = Math.max(...tilt(1));
    cleanup();
    const level5 = Math.max(...tilt(5));
    expect(level1).toBeLessThan(0.5);
    expect(level5).toBeGreaterThan(level1);
  });
});
