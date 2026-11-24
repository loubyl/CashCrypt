// Test-only fast-check generators for the Scene_Model (never imported by app code).
// Feature: house-scene, Requirement 24.1.

import * as fc from "fast-check";
import type { DecayLevel } from "@/lib/haunting/config";
import type { Ghost, HouseState, Poltergeist, Zombie } from "@/lib/haunting";
import type { Usage } from "@/lib/haunting/types";
import type { GraveyardEntry, SceneInput } from "@/lib/scene/types";

export const MAX_ZOMBIES = 40;
export const MAX_GHOSTS = 60;
export const MAX_GRAVEYARD = 20;

const DECAY_LEVELS: readonly DecayLevel[] = [1, 2, 3, 4, 5];
const USAGES: readonly Usage[] = ["often", "rarely", "never"];
const CATEGORIES = ["coffee", "snacks", "transport", "apps"] as const;
const MAX_CENTS = 100_000_00; // $100,000
const MAX_INCOME_CENTS = 1_000_000_00;
const MAX_TRANSACTION_COUNT = 500;
const MAX_NAME_LENGTH = 40;

/** Numbers that hostile callers could pass: NaN, +/-Infinity, negatives, -0, huge values. */
export const hostileNumberArb: fc.Arbitrary<number> = fc.oneof(
  fc.constant(Number.NaN),
  fc.constant(Number.POSITIVE_INFINITY),
  fc.constant(Number.NEGATIVE_INFINITY),
  fc.constant(-0),
  fc.constant(Number.MAX_VALUE),
  fc.constant(-Number.MAX_VALUE),
  fc.integer({ min: -MAX_CENTS, max: -1 }),
  fc.double({ min: -1e9, max: 1e9, noNaN: true }),
);

/** A date string YYYY-MM-DD with a valid calendar day (day capped at 28). */
export const dateArb: fc.Arbitrary<string> = fc
  .record({
    y: fc.integer({ min: 2000, max: 2100 }),
    m: fc.integer({ min: 1, max: 12 }),
    d: fc.integer({ min: 1, max: 28 }),
  })
  .map(({ y, m, d }) => `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`);

const nameArb = fc.string({ minLength: 1, maxLength: MAX_NAME_LENGTH });
const centsArb = fc.integer({ min: 0, max: MAX_CENTS });

export const zombieArb: fc.Arbitrary<Zombie> = fc.record({
  subscriptionId: fc.uuid(),
  name: nameArb,
  monthlyCost: centsArb,
  usage: fc.constantFrom(...USAGES),
});

export const ghostArb: fc.Arbitrary<Ghost> = fc.record({
  transactionId: fc.uuid(),
  amount: fc.integer({ min: 1, max: MAX_CENTS }),
  description: nameArb,
  category: fc.constantFrom(...CATEGORIES),
  date: dateArb,
});

export const poltergeistArb: fc.Arbitrary<Poltergeist> = fc
  .record({
    byCategory: fc.dictionary(fc.constantFrom(...CATEGORIES), fc.integer({ min: 1, max: MAX_CENTS })),
    transactionCount: fc.integer({ min: 0, max: MAX_TRANSACTION_COUNT }),
  })
  .map(({ byCategory, transactionCount }) => ({
    byCategory,
    transactionCount,
    totalAmount: Object.values(byCategory).reduce((sum, v) => sum + v, 0),
  }));

export const graveyardEntryArb: fc.Arbitrary<GraveyardEntry> = fc.record({
  subscriptionId: fc.uuid(),
  name: nameArb,
  monthlyCostCents: centsArb,
  canceledOn: dateArb,
});

/** Valid HouseState: score fields consistent with the level; lists within the given maxima. */
export function houseStateArb(
  limits: { maxZombies?: number; maxGhosts?: number } = {},
): fc.Arbitrary<HouseState> {
  const { maxZombies = MAX_ZOMBIES, maxGhosts = MAX_GHOSTS } = limits;
  return fc
    .record({
      lightScore: fc.double({ min: 0, max: 100, noNaN: true }),
      momentumShare: fc.double({ min: 0, max: 1, noNaN: true }),
      levelProgress: fc.double({ min: 0, max: 1, noNaN: true }),
      zombies: fc.array(zombieArb, { maxLength: maxZombies }),
      ghosts: fc.array(ghostArb, { maxLength: maxGhosts }),
      poltergeist: fc.option(poltergeistArb, { nil: null }),
    })
    .map(({ lightScore, momentumShare, levelProgress, ...rest }) => {
      const momentum = lightScore * momentumShare;
      return {
        ...rest,
        lightScore,
        baseScore: lightScore - momentum,
        momentum,
        decayLevel: levelForScore(lightScore),
        windowBrightness: lightScore / 100,
        levelProgress,
      };
    });
}

/** Mirrors the half-open bands of the engine: [80,100] 1, [60,80) 2, [40,60) 3, [20,40) 4, [0,20) 5. */
function levelForScore(score: number): DecayLevel {
  const BAND = 20;
  const level = Math.max(1, 5 - Math.floor(score / BAND));
  return level as DecayLevel;
}

/** A HouseState with a chosen decay level (score drawn inside that band). */
export function houseStateAtLevelArb(level: DecayLevel): fc.Arbitrary<HouseState> {
  return houseStateArb().map((state) => {
    const BAND = 20;
    const MAX_SCORE = 100;
    const low = (5 - level) * BAND;
    const high = level === 1 ? MAX_SCORE : low + BAND - 0.5;
    const lightScore = low + state.levelProgress * (high - low);
    return {
      ...state,
      lightScore,
      baseScore: lightScore,
      momentum: 0,
      decayLevel: level,
      windowBrightness: lightScore / 100,
    };
  });
}

/** Valid SceneInput with up to 40 zombies, 60 ghosts and 20 graveyard entries. */
export const sceneInputArb: fc.Arbitrary<SceneInput> = fc.record({
  houseState: houseStateArb(),
  monthlyIncomeCents: fc.integer({ min: 0, max: MAX_INCOME_CENTS }),
  graveyard: fc.array(graveyardEntryArb, { maxLength: MAX_GRAVEYARD }),
  bound: fc.boolean(),
});

/** SceneInput with every list empty. */
export const emptySceneInputArb: fc.Arbitrary<SceneInput> = fc
  .record({
    houseState: houseStateArb({ maxZombies: 0, maxGhosts: 0 }),
    monthlyIncomeCents: fc.integer({ min: 0, max: MAX_INCOME_CENTS }),
    bound: fc.boolean(),
  })
  .map((input) => ({ ...input, graveyard: [] }));

/** SceneInput at its size limits, to exercise overflow handling. */
export const maxSceneInputArb: fc.Arbitrary<SceneInput> = fc.record({
  houseState: fc.record({
    base: houseStateArb(),
    zombies: fc.array(zombieArb, { minLength: MAX_ZOMBIES, maxLength: MAX_ZOMBIES }),
    ghosts: fc.array(ghostArb, { minLength: MAX_GHOSTS, maxLength: MAX_GHOSTS }),
  }).map(({ base, zombies, ghosts }) => ({ ...base, zombies, ghosts })),
  monthlyIncomeCents: fc.integer({ min: 0, max: MAX_INCOME_CENTS }),
  graveyard: fc.array(graveyardEntryArb, { minLength: MAX_GRAVEYARD, maxLength: MAX_GRAVEYARD }),
  bound: fc.boolean(),
});

/**
 * SceneInput with hostile numbers in score fields, amounts and income.
 * Intentionally violates the HouseState contract: tests assert no throw and finite output.
 */
export const hostileSceneInputArb: fc.Arbitrary<SceneInput> = fc
  .record({
    input: sceneInputArb,
    lightScore: hostileNumberArb,
    baseScore: hostileNumberArb,
    momentum: hostileNumberArb,
    windowBrightness: hostileNumberArb,
    levelProgress: hostileNumberArb,
    income: hostileNumberArb,
    amount: hostileNumberArb,
    decayLevel: fc.oneof(fc.constantFrom(...DECAY_LEVELS), hostileNumberArb),
  })
  .map(({ input, income, amount, decayLevel, ...scores }) => ({
    ...input,
    monthlyIncomeCents: income,
    houseState: {
      ...input.houseState,
      ...scores,
      decayLevel: decayLevel as DecayLevel,
      zombies: input.houseState.zombies.map((z) => ({ ...z, monthlyCost: amount })),
      ghosts: input.houseState.ghosts.map((g) => ({ ...g, amount })),
    },
    graveyard: input.graveyard.map((e) => ({ ...e, monthlyCostCents: amount })),
  }));

/** Any SceneInput: mostly valid, sometimes empty, at the limits or hostile. */
export const anySceneInputArb: fc.Arbitrary<SceneInput> = fc.oneof(
  { arbitrary: sceneInputArb, weight: 6 },
  { arbitrary: emptySceneInputArb, weight: 1 },
  { arbitrary: maxSceneInputArb, weight: 1 },
  { arbitrary: hostileSceneInputArb, weight: 2 },
);

/** A random permutation of an array (the input is not mutated). */
export function permutationArb<T>(items: readonly T[]): fc.Arbitrary<T[]> {
  return fc.shuffledSubarray([...items], { minLength: items.length, maxLength: items.length });
}

/** The same SceneInput with zombies, ghosts and graveyard entries reordered. */
export function permutedSceneInputArb(input: SceneInput): fc.Arbitrary<SceneInput> {
  return fc
    .record({
      zombies: permutationArb(input.houseState.zombies),
      ghosts: permutationArb(input.houseState.ghosts),
      graveyard: permutationArb(input.graveyard),
    })
    .map(({ zombies, ghosts, graveyard }) => ({
      ...input,
      houseState: { ...input.houseState, zombies, ghosts },
      graveyard,
    }));
}

/** A SceneInput paired with a permutation of itself. */
export const sceneInputWithPermutationArb: fc.Arbitrary<{ input: SceneInput; permuted: SceneInput }> =
  sceneInputArb.chain((input) =>
    permutedSceneInputArb(input).map((permuted) => ({ input, permuted })),
  );
