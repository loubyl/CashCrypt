// Gate that keeps a Moment from starting while a bottom sheet is open or still closing.
// The BottomSheet layer carries `data-part="bottom-sheet"` and stays in the document until its exit
// transition ends, so "no such element" means "no sheet is open or closing". DOM only: no React,
// no Framer Motion, no GSAP.

/** Marks the layer of an open or closing BottomSheet (set in `BottomSheet.tsx`). */
export const SHEET_SELECTOR = '[data-part="bottom-sheet"]';

/** True while a bottom sheet is open or playing its exit transition. */
export function isSheetPresent(doc: Document): boolean {
  return doc.querySelector(SHEET_SELECTOR) !== null;
}

/**
 * Resolves when no sheet is in the document, after `maxWaitMs` at most (so a stuck sheet never
 * blocks a Moment), or at once when the signal aborts.
 */
export function waitForSheetsClosed(doc: Document, signal: AbortSignal, maxWaitMs: number): Promise<void> {
  return new Promise<void>((resolve) => {
    if (signal.aborted || !isSheetPresent(doc)) {
      resolve();
      return;
    }
    const view = doc.defaultView;
    const observer = view ? new view.MutationObserver(check) : null;
    const timer = setTimeout(finish, maxWaitMs);

    function check(): void {
      if (!isSheetPresent(doc)) finish();
    }

    function finish(): void {
      clearTimeout(timer);
      observer?.disconnect();
      signal.removeEventListener("abort", finish);
      resolve();
    }

    observer?.observe(doc.body, { childList: true, subtree: true });
    signal.addEventListener("abort", finish);
  });
}
