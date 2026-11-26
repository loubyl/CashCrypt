const NON_CONTENT_TAGS = ["script", "style", "link", "template"] as const;
const ROUTE_ANNOUNCER_TAG = "next-route-announcer";
const NEXT_DEV_OVERLAY_TAG_PREFIX = "nextjs-";

const NO_INDEX = -1;
const FIRST_INDEX = 0;
const STEP = 1;

export const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Text-like Fields (not checkboxes or radios). The first one in DOM order gets initial focus in a sheet. */
export const FIELD_SELECTOR =
  'input:not([disabled]):not([type="hidden"]):not([type="checkbox"]):not([type="radio"]), textarea:not([disabled])';

/** An element carrying this attribute gets initial focus in a sheet, before any Field. */
export const INITIAL_FOCUS_ATTRIBUTE = "data-initial-focus";

/** Index to focus after Tab (shift=false) or Shift+Tab (shift=true). -1 means focus is not on a trap item. */
export function getNextFocusIndex(count: number, current: number, shift: boolean): number {
  if (count <= FIRST_INDEX) return NO_INDEX;
  if (current < FIRST_INDEX) return shift ? count - STEP : FIRST_INDEX;
  return shift ? (current - STEP + count) % count : (current + STEP) % count;
}

/** True when a direct child of <body> must NOT receive `inert` while a sheet is open. Total: never throws. */
export function shouldSkipInert(tagName: string, hasInertExemptAttribute: boolean): boolean {
  const tag = tagName.toLowerCase();
  return (
    hasInertExemptAttribute ||
    (NON_CONTENT_TAGS as readonly string[]).includes(tag) ||
    tag === ROUTE_ANNOUNCER_TAG ||
    tag.startsWith(NEXT_DEV_OVERLAY_TAG_PREFIX)
  );
}
