// Pure keyboard navigation for a segmented control. Given the disabled flags of
// each segment, it picks the next enabled index for a navigation key. Total: it
// never throws and falls back to `current` when no move is possible.

export type SegmentNavKey = "next" | "prev" | "first" | "last";

const STEP_FORWARD = 1;
const STEP_BACKWARD = -1;
const NO_INDEX = -1;

function isValidIndex(length: number, index: number): boolean {
  return Number.isInteger(index) && index >= 0 && index < length;
}

export function getNextEnabledIndex(
  disabled: readonly boolean[],
  current: number,
  key: SegmentNavKey,
): number {
  const count = disabled.length;
  if (!isValidIndex(count, current)) return current;

  if (key === "first" || key === "last") {
    const indices = disabled.map((_, i) => i);
    const enabled = indices.filter((i) => !disabled[i]);
    if (enabled.length === 0) return current;
    return key === "first" ? enabled[0] : enabled[enabled.length - 1];
  }

  const step = key === "next" ? STEP_FORWARD : STEP_BACKWARD;
  let found = NO_INDEX;
  // Walk the full cycle once; reaching `current` again means it is the only
  // enabled segment (or none is), so it is a valid result when enabled.
  for (let offset = 1; offset <= count; offset += 1) {
    const candidate = (((current + step * offset) % count) + count) % count;
    if (!disabled[candidate]) {
      found = candidate;
      break;
    }
  }
  return found === NO_INDEX ? current : found;
}
