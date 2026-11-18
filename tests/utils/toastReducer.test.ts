import fc from "fast-check";
import { describe, expect, it } from "vitest";

import {
  getToastRegion,
  toastReducer,
  type ToastItem,
  type ToastRegion,
  type ToastTone,
} from "@/lib/utils/toastReducer";

const NUM_RUNS = 100;
const TONES: readonly ToastTone[] = ["success", "info", "warning", "danger"];
const POLITE_TONES: readonly ToastTone[] = ["success", "info"];
const ASSERTIVE_TONES: readonly ToastTone[] = ["warning", "danger"];

const toneArb = fc.constantFrom(...TONES);

const toastArb: fc.Arbitrary<ToastItem> = fc.record({
  id: fc.string({ minLength: 1, maxLength: 8 }),
  tone: toneArb,
  message: fc.string({ maxLength: 40 }),
  duration: fc.integer({ min: 0, max: 10000 }),
});

const uniqueToastsArb = fc.uniqueArray(toastArb, {
  selector: (toast) => toast.id,
  maxLength: 10,
});

function partition(list: readonly ToastItem[], region: ToastRegion): ToastItem[] {
  return list.filter((toast) => getToastRegion(toast.tone) === region);
}

function makeToast(id: string, tone: ToastTone): ToastItem {
  return { id, tone, message: `message ${id}`, duration: 5000 };
}

describe("toastReducer properties", () => {
  // Feature: design-system-foundation, Property 13: Toast reducer adds to the matching region and ignores unknown dismissals
  // **Validates: Requirements 15.3, 15.7, 15.8**
  it("show appends the toast and places it in the region matching its tone", () => {
    fc.assert(
      fc.property(uniqueToastsArb, toastArb, (list, toast) => {
        const next = toastReducer(list, { type: "show", toast });
        expect(next).toHaveLength(list.length + 1);
        expect(next[next.length - 1]).toBe(toast);
        expect(next.slice(0, -1)).toEqual(list);
        const expectedRegion: ToastRegion = POLITE_TONES.includes(toast.tone)
          ? "polite"
          : "assertive";
        expect(getToastRegion(toast.tone)).toBe(expectedRegion);
        expect(partition(next, expectedRegion)).toContain(toast);
        const other: ToastRegion = expectedRegion === "polite" ? "assertive" : "polite";
        expect(partition(next, other)).not.toContain(toast);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  // Feature: design-system-foundation, Property 13: Toast reducer adds to the matching region and ignores unknown dismissals
  it("dismiss of an unknown id returns the same array reference", () => {
    fc.assert(
      fc.property(uniqueToastsArb, fc.string({ maxLength: 8 }), (list, id) => {
        fc.pre(!list.some((toast) => toast.id === id));
        expect(toastReducer(list, { type: "dismiss", id })).toBe(list);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  // Feature: design-system-foundation, Property 13: Toast reducer adds to the matching region and ignores unknown dismissals
  it("dismiss of a known id removes only that item", () => {
    fc.assert(
      fc.property(
        uniqueToastsArb.filter((list) => list.length > 0),
        fc.nat(),
        (list, index) => {
          const target = list[index % list.length];
          const next = toastReducer(list, { type: "dismiss", id: target.id });
          expect(next).toEqual(list.filter((toast) => toast.id !== target.id));
          expect(next).toHaveLength(list.length - 1);
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  // Feature: design-system-foundation, Property 13: Toast reducer adds to the matching region and ignores unknown dismissals
  it("show followed by dismiss of that id returns a list equal to the original", () => {
    fc.assert(
      fc.property(uniqueToastsArb, toastArb, (list, toast) => {
        fc.pre(!list.some((item) => item.id === toast.id));
        const shown = toastReducer(list, { type: "show", toast });
        const result = toastReducer(shown, { type: "dismiss", id: toast.id });
        expect(result).toEqual(list);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  // Feature: design-system-foundation, Property 13: Toast reducer adds to the matching region and ignores unknown dismissals
  it("does not mutate its input", () => {
    fc.assert(
      fc.property(uniqueToastsArb, toastArb, fc.string({ maxLength: 8 }), (list, toast, id) => {
        const snapshot = structuredClone(list);
        const frozen = Object.freeze([...list]);
        toastReducer(frozen, { type: "show", toast });
        toastReducer(frozen, { type: "dismiss", id });
        toastReducer(frozen, { type: "dismiss", id: toast.id });
        expect(frozen).toEqual(snapshot);
      }),
      { numRuns: NUM_RUNS },
    );
  });
});

describe("toastReducer examples", () => {
  it("adds a shown toast to the end of the list", () => {
    const first = makeToast("a", "success");
    const second = makeToast("b", "danger");
    const result = toastReducer([first], { type: "show", toast: second });
    expect(result).toEqual([first, second]);
  });

  it("maps success and info to the polite region", () => {
    for (const tone of POLITE_TONES) {
      expect(getToastRegion(tone)).toBe("polite");
    }
  });

  it("maps warning and danger to the assertive region", () => {
    for (const tone of ASSERTIVE_TONES) {
      expect(getToastRegion(tone)).toBe("assertive");
    }
  });

  it("returns the same array when dismissing an unknown id", () => {
    const list = [makeToast("a", "info")];
    expect(toastReducer(list, { type: "dismiss", id: "missing" })).toBe(list);
  });

  it("removes only the dismissed toast", () => {
    const a = makeToast("a", "info");
    const b = makeToast("b", "warning");
    const c = makeToast("c", "success");
    expect(toastReducer([a, b, c], { type: "dismiss", id: "b" })).toEqual([a, c]);
  });
});
