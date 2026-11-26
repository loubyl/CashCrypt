// Feature: house-scene, Property 4: Everything stays inside the ViewBox (Moment art part, task 9.10)
// **Validates: Requirements 12.18, 15.7**
import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { VIEWBOX_HEIGHT, VIEWBOX_WIDTH, buildSceneModel } from "@/lib/scene";
import type { Box, SceneModel } from "@/lib/scene";
import { getMomentExtents } from "@/lib/scene/momentGeometry";
import type { MomentExtent } from "@/lib/scene/momentGeometry";
import type { MomentRequest, RectLike } from "@/lib/moments/types";
import type { DecayLevel } from "@/lib/haunting/config";
import { maxSceneInputArb, sceneInputArb } from "../arbitraries";

const NUM_RUNS = 150;
const LEVELS: readonly DecayLevel[] = [1, 2, 3, 4, 5];
const ORIGIN: RectLike = { left: 10, top: 20, width: 100, height: 40 };

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

function extentProblems(extent: MomentExtent): string[] {
  const bounds = extent.clip ?? VIEWBOX;
  const problems: string[] = [];
  if (extent.clip && !inside(extent.clip, VIEWBOX)) problems.push(`${extent.name}: clip outside ViewBox`);
  extent.boxes.forEach((box, i) => {
    if (!inside(box, bounds)) problems.push(`${extent.name}[${i}]: ${JSON.stringify(box)} outside ${extent.clip ? "clip" : "ViewBox"}`);
  });
  return problems;
}

function requestsFor(model: SceneModel): MomentRequest[] {
  const requests: MomentRequest[] = [];
  const cancel = (subscriptionId: string, target: "zombie" | "overflow"): MomentRequest => ({
    kind: "cancel",
    subscriptionId,
    name: "x",
    monthlyCents: 100,
    target,
  });
  for (const z of model.zombies) requests.push(cancel(z.id, "zombie"));
  requests.push(cancel("overflow-sub", "overflow"));
  for (const t of model.tombstones) requests.push(cancel(t.id, "zombie"));
  for (const origin of [ORIGIN, null]) {
    for (const hasCrack of [true, false]) requests.push({ kind: "payment", origin, hasCrack });
  }
  for (const from of LEVELS) for (const to of LEVELS) requests.push({ kind: "level", from, to });
  requests.push({ kind: "sigil" }, { kind: "exorcismComplete" });
  // action-feedback: feed and appear, arrival at every drawn slot and at the marker, flicker.
  requests.push({ kind: "poltergeistFeed", appeared: false }, { kind: "poltergeistFeed", appeared: true });
  for (const g of model.ghosts) requests.push({ kind: "ghostArrival", transactionId: g.id });
  requests.push({ kind: "ghostArrival", transactionId: "overflow-transaction" });
  requests.push({ kind: "candleFlicker", litWindows: true }, { kind: "candleFlicker", litWindows: false });
  return requests;
}

describe("Property 4: Moment art stays inside the ViewBox", () => {
  it("keeps every extent inside the ViewBox, or inside a clip that is inside it", () => {
    fc.assert(
      fc.property(fc.oneof(sceneInputArb, maxSceneInputArb), (input) => {
        // Every drawn zombie is also canceled into a tombstone with the same id.
        const graveyard = [
          ...input.graveyard,
          ...input.houseState.zombies.map((z) => ({
            subscriptionId: z.subscriptionId,
            name: z.name,
            monthlyCostCents: z.monthlyCost,
            canceledOn: "2025-01-01",
          })),
        ];
        const model = buildSceneModel({ ...input, graveyard });
        const problems = requestsFor(model).flatMap((request) =>
          getMomentExtents(model, request).flatMap(extentProblems),
        );
        expect(problems).toEqual([]);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it("covers the sigil at the default Poltergeist position", () => {
    const model = buildSceneModel({
      houseState: {
        lightScore: 30, baseScore: 30, momentum: 0, decayLevel: 4, windowBrightness: 0.3, levelProgress: 0.5,
        zombies: [], ghosts: [],
        poltergeist: { byCategory: { coffee: 100 }, transactionCount: 1, totalAmount: 100 },
      },
      monthlyIncomeCents: 100000,
      graveyard: [],
      bound: false,
    });
    const sigil = getMomentExtents(model, { kind: "sigil" })[0];
    expect(extentProblems(sigil)).toEqual([]);
  });
});
