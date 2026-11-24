// Example tests for the Moment art geometry (house-scene task 9.11). Requirements: 12.18, 24.6.
import { describe, expect, it } from "vitest";
import { SCENE_CONFIG, VIEWBOX_HEIGHT, VIEWBOX_WIDTH, buildSceneModel } from "@/lib/scene";
import type { Box, SceneModel } from "@/lib/scene";
import {
  batPath,
  getCandleBoxes,
  getMomentExtents,
  getSinkingZombieBox,
  getTombstoneRiseBoxes,
  shovelArc,
} from "@/lib/scene/momentGeometry";
import type { MomentExtent } from "@/lib/scene/momentGeometry";

const VIEWBOX: Box = { x: 0, y: 0, w: VIEWBOX_WIDTH, h: VIEWBOX_HEIGHT };

function inside(box: Box, bounds: Box): boolean {
  return (
    Number.isFinite(box.x + box.y + box.w + box.h) &&
    box.x >= bounds.x &&
    box.y >= bounds.y &&
    box.x + box.w <= bounds.x + bounds.w &&
    box.y + box.h <= bounds.y + bounds.h
  );
}

/** The three bounds rules: finite boxes inside the ViewBox, boxes inside their clip, clip inside the ViewBox. */
function boundsProblems(extent: MomentExtent): string[] {
  const problems: string[] = [];
  if (extent.clip && !inside(extent.clip, VIEWBOX)) problems.push("clip outside ViewBox");
  const bounds = extent.clip ?? VIEWBOX;
  extent.boxes.forEach((box, i) => {
    if (!inside(box, bounds)) problems.push(`box ${i} outside ${extent.clip ? "clip" : "ViewBox"}`);
  });
  return problems;
}

const model: SceneModel = buildSceneModel({
  houseState: {
    lightScore: 30, baseScore: 30, momentum: 0, decayLevel: 4, windowBrightness: 0.3, levelProgress: 0.5,
    zombies: [{ subscriptionId: "s1", name: "StreamMax", monthlyCost: 2299, usage: "never" }],
    ghosts: [],
    poltergeist: null,
  },
  monthlyIncomeCents: 300000,
  graveyard: [{ subscriptionId: "s1", name: "StreamMax", monthlyCostCents: 2299, canceledOn: "2025-01-01" }],
  bound: false,
});

describe("shipped shovel arc", () => {
  const strike = { x: 400, y: 300 };
  const arc = shovelArc(strike);

  it("starts at the configured start point and ends at the strike point", () => {
    expect(arc.start).toEqual({ x: 700, y: 140 });
    expect(arc.end).toEqual(strike);
    expect(arc.samples[0]).toEqual(arc.start);
    expect(arc.samples[arc.samples.length - 1]).toEqual(arc.end);
  });

  it("has 33 samples and a bound radius of 100", () => {
    expect(arc.samples).toHaveLength(33);
    expect(arc.boundRadius).toBe(100);
  });

  it("lifts the control point 40 units above the higher end and centers it between them", () => {
    expect(arc.control).toEqual({ x: 550, y: 100 });
  });

  it("clamps a strike point near the edge so the bound circle stays inside the ViewBox", () => {
    const clamped = shovelArc({ x: 5, y: 590 });
    expect(clamped.end).toEqual({ x: 100, y: 500 });
  });
});

describe("shipped bat path", () => {
  const path = batPath();

  it("has 17 samples from the start point to the end point", () => {
    expect(path).toHaveLength(17);
    expect(path[0].point).toEqual({ x: 520, y: 70 });
    expect(path[16].point).toEqual({ x: 750, y: 40 });
  });

  it("is fully opaque at the start, fully faded at the end, and never brightens", () => {
    expect(path[0].opacity).toBe(1);
    expect(path[16].opacity).toBe(0);
    for (let i = 1; i < path.length; i++) expect(path[i].opacity).toBeLessThanOrEqual(path[i - 1].opacity);
  });

  it("stays fully opaque until 70% of the path", () => {
    expect(path[11].opacity).toBe(1);
    expect(path[12].opacity).toBeLessThan(1);
  });

  it("draws a 40 by 40 box around each point", () => {
    expect(path[0].box).toEqual({ x: 500, y: 50, w: 40, h: 40 });
  });
});

describe("shipped candle row", () => {
  it("has three 24 by 80 candles, 60 units apart, starting at (60, 40)", () => {
    expect(getCandleBoxes()).toEqual([
      { x: 60, y: 40, w: 24, h: 80 },
      { x: 120, y: 40, w: 24, h: 80 },
      { x: 180, y: 40, w: 24, h: 80 },
    ]);
  });
});

describe("tombstone rise", () => {
  it("starts 56 units below the final box", () => {
    const final = { x: 100, y: 520, w: 64, h: 56 };
    expect(getTombstoneRiseBoxes(final)).toEqual({ start: { ...final, y: 576 }, final });
  });
});

describe("shipped extents pass the bounds rules", () => {
  it("keeps a zombie cancel, a payment and a level drop inside the ViewBox or clip", () => {
    const requests = [
      { kind: "cancel", subscriptionId: "s1", name: "StreamMax", monthlyCents: 2299, target: "zombie" },
      { kind: "payment", origin: null, hasCrack: true },
      { kind: "level", from: 4, to: 2 },
      { kind: "level", from: 2, to: 4 },
      { kind: "sigil" },
      { kind: "exorcismComplete" },
    ] as const;
    for (const request of requests) {
      expect(getMomentExtents(model, request).flatMap(boundsProblems)).toEqual([]);
    }
  });

  it("scales the sinking zombie by 1.4 around its bottom center and keeps it in the sink clip", () => {
    const zombie = { x: 300, y: 400, w: 40, h: 64 };
    const sunk = getSinkingZombieBox(zombie);
    expect(sunk.w).toBeCloseTo(56);
    expect(sunk.h).toBeCloseTo(89.6);
    expect(inside(sunk, SCENE_CONFIG.ZOMBIE_SINK_CLIP)).toBe(true);
  });
});

describe("bounds rules reject bad examples", () => {
  it("rejects a box that sticks out of the ViewBox", () => {
    expect(boundsProblems({ name: "x", boxes: [{ x: 790, y: 10, w: 20, h: 20 }] })).toEqual(["box 0 outside ViewBox"]);
  });

  it("rejects a box with a non-finite number", () => {
    expect(boundsProblems({ name: "x", boxes: [{ x: Number.NaN, y: 10, w: 20, h: 20 }] })).toEqual(["box 0 outside ViewBox"]);
  });

  it("rejects a box that sticks out of its clip even when it is inside the ViewBox", () => {
    const clip = { x: 100, y: 100, w: 100, h: 100 };
    expect(boundsProblems({ name: "x", boxes: [{ x: 90, y: 120, w: 20, h: 20 }], clip })).toEqual(["box 0 outside clip"]);
  });

  it("rejects a clip that sticks out of the ViewBox", () => {
    const clip = { x: 700, y: 500, w: 200, h: 200 };
    expect(boundsProblems({ name: "x", boxes: [], clip })).toEqual(["clip outside ViewBox"]);
  });

  it("catches a bat path configured to start outside the ViewBox", () => {
    const config = { ...SCENE_CONFIG, BAT_START: { x: -50, y: 70 } };
    const boxes = batPath(config).map((s) => s.box);
    expect(boundsProblems({ name: "bat", boxes }).length).toBeGreaterThan(0);
  });
});
