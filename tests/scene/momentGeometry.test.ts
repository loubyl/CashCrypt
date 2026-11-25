// Example tests for the Moment art geometry (house-scene task 9.11). Requirements: 12.18, 24.6.
import { describe, expect, it } from "vitest";
import {
  BAT_CIRCLE_RADIUS_X,
  BAT_CIRCLE_RADIUS_Y,
  GHOST_OVERFLOW_ANCHOR,
  SCENE_CONFIG,
  SHOVEL_VIEW_H,
  SHOVEL_VIEW_W,
  TOMBSTONE_LABEL_MIN_SCENE_WIDTH_PX,
  VIEWBOX_HEIGHT,
  VIEWBOX_WIDTH,
  buildSceneModel,
  getTombstoneLabelBox,
} from "@/lib/scene";
import type { Box, SceneInput, SceneModel } from "@/lib/scene";
import {
  batPath,
  getCandleBoxes,
  getMomentExtents,
  getShovelStrikePoint,
  getSigilBox,
  getSinkingZombieBox,
  getTombstoneRiseBoxes,
  shovelArc,
} from "@/lib/scene/momentGeometry";
import type { MomentExtent } from "@/lib/scene/momentGeometry";
import {
  BATS,
  CHIMNEY_BODY,
  FENCE_PICKET,
  FENCE_POSTS,
  GROUND_Y,
  MOON,
  MOON_BLUR,
  MOON_HALO_RADIUS,
  SMOKE_PUFFS,
  STARS,
  TREE_LEFT_X,
  TREE_RIGHT_X,
  WONK_MAX,
} from "@/components/house/houseGeometry";

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

function overlaps(a: Box, b: Box): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function circleBox(cx: number, cy: number, r: number): Box {
  return { x: cx - r, y: cy - r, w: r * 2, h: r * 2 };
}

/** Local x range and top of a tree (trunk, limbs and canopy at their widest level), in tree space. */
const TREE_LOCAL = { left: -78, right: 68, top: 208 } as const;
/** Bat art in its local space (BAT_PATH spans x -16..16, y -12..6). */
const BAT_LOCAL = { left: -16, right: 16, top: -12, bottom: 6 } as const;
/** Three blur deviations around the moon halo still show some glow. */
const BLUR_REACH = 3;
const STAR_RADIUS = 1.6;

/**
 * Boxes of everything the Scene draws outside the moving ghosts (ViewBox units), at the widest
 * level: moon with its blurred halo, Poltergeist with its glow and bound sigil, house with roofs,
 * chimney and smoke, both trees, the fence, the lantern, stars, the circling bats and the "+N"
 * ghost marker.
 */
function drawnSceneBoxes(): { name: string; box: Box }[] {
  const polt = SCENE_CONFIG.POLTERGEIST_CENTER;
  const chimneyTop = CHIMNEY_BODY.y;
  const smoke = SMOKE_PUFFS.map((p) =>
    circleBox(CHIMNEY_BODY.x + CHIMNEY_BODY.w / 2 + p.dx + WONK_MAX.chimneyRotateDeg, chimneyTop + p.dy, p.r),
  );
  const tree = (x: number, mirrored: boolean): Box => ({
    x: mirrored ? x - TREE_LOCAL.right : x + TREE_LOCAL.left,
    y: TREE_LOCAL.top,
    w: TREE_LOCAL.right - TREE_LOCAL.left,
    h: GROUND_Y - TREE_LOCAL.top,
  });
  const fenceLeft = FENCE_POSTS[0] - 2;
  const fenceRight = FENCE_POSTS[FENCE_POSTS.length - 1] + FENCE_PICKET.w + 2;
  const fenceTop = GROUND_Y - FENCE_PICKET.h - FENCE_PICKET.tip - WONK_MAX.picketHeight;
  return [
    { name: "moon", box: circleBox(MOON.cx, MOON.cy, MOON_HALO_RADIUS + MOON_BLUR * BLUR_REACH) },
    { name: "poltergeist", box: circleBox(polt.x, polt.y, (SCENE_CONFIG.POLTERGEIST_SIZE / 2) * 1.1) },
    { name: "poltergeist sigil", box: getSigilBox(model) },
    { name: "house", box: { x: 184, y: 28, w: 616 - 184, h: GROUND_Y - 28 } },
    { name: "chimney", box: { x: CHIMNEY_BODY.x - 3, y: CHIMNEY_BODY.y, w: CHIMNEY_BODY.w + 6, h: CHIMNEY_BODY.h } },
    ...smoke.map((box, i) => ({ name: `smoke ${i}`, box })),
    { name: "left tree", box: tree(TREE_LEFT_X, false) },
    { name: "right tree", box: tree(TREE_RIGHT_X, true) },
    { name: "fence", box: { x: fenceLeft, y: fenceTop, w: fenceRight - fenceLeft, h: GROUND_Y - fenceTop } },
    ...STARS.map((s, i) => ({ name: `star ${i}`, box: circleBox(s.x, s.y, STAR_RADIUS) })),
    ...BATS.map((b, i) => ({
      name: `bat ${i}`,
      // The ambient loop moves a bat up to BAT_CIRCLE_RADIUS_X sideways and BAT_CIRCLE_RADIUS_Y / 2 up.
      box: {
        x: b.x + BAT_LOCAL.left - BAT_CIRCLE_RADIUS_X,
        y: b.y + BAT_LOCAL.top - BAT_CIRCLE_RADIUS_Y / 2,
        w: BAT_LOCAL.right - BAT_LOCAL.left + BAT_CIRCLE_RADIUS_X * 2,
        h: BAT_LOCAL.bottom - BAT_LOCAL.top + BAT_CIRCLE_RADIUS_Y / 2,
      },
    })),
    { name: "ghost marker", box: { x: GHOST_OVERFLOW_ANCHOR.x - 40, y: 0, w: 40, h: GHOST_OVERFLOW_ANCHOR.y } },
  ];
}

const input: SceneInput = {
  houseState: {
    lightScore: 30, baseScore: 30, momentum: 0, decayLevel: 4, windowBrightness: 0.3, levelProgress: 0.5,
    zombies: [{ subscriptionId: "s1", name: "StreamMax", monthlyCost: 2299, usage: "never" }],
    ghosts: [],
    poltergeist: null,
  },
  monthlyIncomeCents: 300000,
  graveyard: [{ subscriptionId: "s1", name: "StreamMax", monthlyCostCents: 2299, canceledOn: "2025-01-01" }],
  bound: false,
};
const model: SceneModel = buildSceneModel(input);

describe("shipped shovel arc", () => {
  const strike = { x: 400, y: 300 };
  const arc = shovelArc(strike);

  it("starts at the configured start point and ends at the strike point", () => {
    expect(arc.start).toEqual({ x: 660, y: 160 });
    expect(arc.end).toEqual(strike);
    expect(arc.samples[0]).toEqual(arc.start);
    expect(arc.samples[arc.samples.length - 1]).toEqual(arc.end);
  });

  it("has 33 samples and a bound radius of 120", () => {
    expect(arc.samples).toHaveLength(33);
    expect(arc.boundRadius).toBe(120);
  });

  it("lifts the control point 40 units above the higher end (kept inside the bound radius)", () => {
    expect(arc.control).toEqual({ x: 530, y: 120 });
  });

  it("clamps a strike point near the edge so the bound circle stays inside the ViewBox", () => {
    const clamped = shovelArc({ x: 5, y: 590 });
    expect(clamped.end).toEqual({ x: 120, y: 480 });
  });

  it("draws the shovel at least a quarter of the Scene height and inside its bound circle", () => {
    expect(SCENE_CONFIG.SHOVEL_HEIGHT).toBeGreaterThanOrEqual(VIEWBOX_HEIGHT / 4);
    const halfWidth = (SCENE_CONFIG.SHOVEL_HEIGHT * SHOVEL_VIEW_W) / SHOVEL_VIEW_H / 2;
    const halfDiagonal = Math.hypot(SCENE_CONFIG.SHOVEL_HEIGHT / 2, halfWidth);
    expect(halfDiagonal).toBeLessThanOrEqual(SCENE_CONFIG.SHOVEL_BOUND_RADIUS);
  });

  it("puts the blade tip on the top of the zombie at the strike point", () => {
    const zombie = model.zombies[0];
    const request = { kind: "cancel", subscriptionId: "s1", name: "StreamMax", monthlyCents: 2299, target: "zombie" } as const;
    const end = shovelArc(getShovelStrikePoint(model, request)).end;
    expect(end.y + SCENE_CONFIG.SHOVEL_HEIGHT / 2).toBeCloseTo(zombie.box.y);
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
  it("has three 24 by 48 candles, 40 units apart, starting at (640, 160)", () => {
    expect(getCandleBoxes()).toEqual([
      { x: 640, y: 160, w: 24, h: 48 },
      { x: 680, y: 160, w: 24, h: 48 },
      { x: 720, y: 160, w: 24, h: 48 },
    ]);
  });

  it("keeps every candle inside the ViewBox", () => {
    for (const box of getCandleBoxes()) expect(inside(box, VIEWBOX)).toBe(true);
  });

  it("keeps every candle clear of the moon, the Poltergeist, the house and every other drawn part", () => {
    const problems = getCandleBoxes().flatMap((box, i) =>
      drawnSceneBoxes()
        .filter((part) => overlaps(box, part.box))
        .map((part) => `candle ${i} overlaps ${part.name}`),
    );
    expect(problems).toEqual([]);
  });

  it("reports a candle row placed over the moon (the old top-left row)", () => {
    const oldRow = getCandleBoxes({ ...SCENE_CONFIG, CANDLE_ROW_ORIGIN: { x: 60, y: 40 }, CANDLE_BOX: { w: 24, h: 80 }, CANDLE_SPACING: 60 });
    const hit = new Set(oldRow.flatMap((box) => drawnSceneBoxes().filter((p) => overlaps(box, p.box)).map((p) => p.name)));
    expect(hit.has("moon")).toBe(true);
    expect(hit.has("poltergeist sigil")).toBe(true);
  });
});

describe("tombstone label", () => {
  it("reads R.I.P. with the short amount, without .00 for whole dollars", () => {
    const whole = buildSceneModel({
      ...input,
      graveyard: [{ subscriptionId: "s9", name: "Wraithcast", monthlyCostCents: 12000, canceledOn: "2025-01-01" }],
    });
    expect(whole.tombstones[0].ripText).toBe("R.I.P. $120/mo");
    expect(model.tombstones[0].ripText).toBe("R.I.P. $22.99/mo");
  });

  it("ends on the bottom of the graveyard band, inside the Scene, at the smallest width that shows labels", () => {
    const tombstone = model.tombstones[0];
    const box = getTombstoneLabelBox(tombstone, TOMBSTONE_LABEL_MIN_SCENE_WIDTH_PX);
    expect(box.y + box.h).toBeCloseTo(SCENE_CONFIG.GRAVEYARD_BAND.y + SCENE_CONFIG.GRAVEYARD_BAND.h);
    expect(box.x + box.w / 2).toBeCloseTo(tombstone.box.x + tombstone.box.w / 2);
    expect(inside(box, VIEWBOX)).toBe(true);
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
