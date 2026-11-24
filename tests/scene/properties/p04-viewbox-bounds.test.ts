// Feature: house-scene, Property 4: Everything stays inside the ViewBox
// Model part (task 6.7). The Moment art part is added in task 9.10.
// **Validates: Requirements 3.8, 15.7**
import { describe, expect, it } from "vitest";
import fc from "fast-check";
import {
  CHIMNEY_BOX,
  GHOST_SIZE_MAX,
  SCENE_CONFIG,
  SIGIL_GLOW_PAD,
  SIGIL_SHAKE,
  SIGIL_STROKE,
  VIEWBOX_HEIGHT,
  VIEWBOX_WIDTH,
  buildSceneModel,
  getLanePoint,
  getOverflowAnchors,
  getSigilExtent,
} from "@/lib/scene";
import type { Box, Point } from "@/lib/scene";
import { anySceneInputArb } from "../arbitraries";

const NUM_RUNS = 200;
const HALF = 0.5;
const PHASE_SAMPLES = 64;
const FULL_TURN = 2 * Math.PI;

function boxInside(box: Box): boolean {
  return (
    Number.isFinite(box.x + box.y + box.w + box.h) &&
    box.x >= 0 &&
    box.y >= 0 &&
    box.x + box.w <= VIEWBOX_WIDTH &&
    box.y + box.h <= VIEWBOX_HEIGHT
  );
}

function pointInside(p: Point): boolean {
  return p.x >= 0 && p.x <= VIEWBOX_WIDTH && p.y >= 0 && p.y <= VIEWBOX_HEIGHT;
}

function squareAround(p: Point, size: number): Box {
  return { x: p.x - size * HALF, y: p.y - size * HALF, w: size, h: size };
}

describe("Property 4: everything stays inside the ViewBox (model part)", () => {
  it("keeps windows, zombies, tombstones, Poltergeist, ghost orbits, anchors and sigil inside", () => {
    fc.assert(
      fc.property(anySceneInputArb, (input) => {
        const model = buildSceneModel(input);

        for (const w of model.windows) expect(boxInside(w.box)).toBe(true);
        for (const z of model.zombies) expect(boxInside(z.box)).toBe(true);
        for (const t of model.tombstones) expect(boxInside(t.box)).toBe(true);

        const anchors = getOverflowAnchors();
        for (const anchor of [anchors.zombies, anchors.ghosts, anchors.tombstones]) {
          expect(pointInside(anchor)).toBe(true);
        }

        for (const g of model.ghosts) {
          expect(g.sizeUnits).toBeLessThanOrEqual(GHOST_SIZE_MAX);
          for (let i = 0; i < PHASE_SAMPLES; i += 1) {
            const p = getLanePoint(g.orbit, (FULL_TURN * i) / PHASE_SAMPLES + g.phase);
            expect(boxInside(squareAround(p, g.sizeUnits))).toBe(true);
          }
          expect(boxInside(squareAround(g.rest, g.sizeUnits))).toBe(true);
        }

        const polt = model.poltergeist;
        if (polt !== null) {
          expect(boxInside(squareAround(polt.center, polt.sizeUnits))).toBe(true);
          const extent = getSigilExtent(
            polt.center,
            polt.sigil.r * 2,
            SIGIL_STROKE,
            SIGIL_GLOW_PAD,
            SIGIL_SHAKE,
          );
          expect(extent.left).toBeGreaterThanOrEqual(0);
          expect(extent.top).toBeGreaterThanOrEqual(0);
          expect(extent.right).toBeLessThanOrEqual(VIEWBOX_WIDTH);
          expect(extent.bottom).toBeLessThanOrEqual(VIEWBOX_HEIGHT);
          const overlapsChimney =
            extent.left < CHIMNEY_BOX.x + CHIMNEY_BOX.w &&
            extent.right > CHIMNEY_BOX.x &&
            extent.top < CHIMNEY_BOX.y + CHIMNEY_BOX.h &&
            extent.bottom > CHIMNEY_BOX.y;
          expect(overlapsChimney).toBe(false);
        }
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it("keeps the chimney box and every configured ghost lane extreme inside the ViewBox", () => {
    expect(boxInside(CHIMNEY_BOX)).toBe(true);
    for (const lane of SCENE_CONFIG.GHOST_LANES) {
      const reach = GHOST_SIZE_MAX * HALF;
      expect(lane.cx - lane.rx - reach).toBeGreaterThanOrEqual(0);
      expect(lane.cx + lane.rx + reach).toBeLessThanOrEqual(VIEWBOX_WIDTH);
      // y extreme of the figure eight is cy +/- ry / 2 (max of sin(t)cos(t) is 1/2).
      expect(lane.cy - lane.ry * HALF - reach).toBeGreaterThanOrEqual(0);
      expect(lane.cy + lane.ry * HALF + reach).toBeLessThanOrEqual(VIEWBOX_HEIGHT);
    }
  });
});
