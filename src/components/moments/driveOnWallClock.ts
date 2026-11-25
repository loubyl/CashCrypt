const MS_PER_S = 1000;

/** The small part of GSAP the driver needs (kept structural so tests can pass a recording mock). */
type DrivenTimeline = {
  pause: () => unknown;
  time: (seconds: number, suppressEvents?: boolean) => unknown;
  duration: () => number;
};
type DriverTicker = {
  ticker: { add: (callback: () => void) => unknown; remove: (callback: () => void) => unknown };
};

/**
 * Plays a timeline by the wall clock instead of by the GSAP ticker's own time.
 *
 * GSAP's lag smoothing counts a gap between frames longer than 500 ms as 33 ms. On a slow or
 * background tab that stretches a 2 s Moment into a minute: the flame never leaves the button, the orb
 * never flies, and the hold ends by its hard cap with the flare unplayed. Reading `performance.now()`
 * on each frame keeps the Moment on schedule at any frame rate. The timeline is paused and set to the
 * elapsed time, so its `onComplete` fires when the wall clock passes its duration.
 * Returns a function that stops the driver (safe to call more than once).
 */
export function driveOnWallClock(gsap: DriverTicker, timeline: DrivenTimeline): () => void {
  const startedAt = performance.now();
  let stopped = false;
  const stop = (): void => {
    if (stopped) return;
    stopped = true;
    gsap.ticker.remove(tick);
  };
  function tick(): void {
    if (stopped) return;
    const elapsed = (performance.now() - startedAt) / MS_PER_S;
    if (elapsed >= timeline.duration()) stop();
    timeline.time(elapsed, false);
  }
  timeline.pause();
  gsap.ticker.add(tick);
  return stop;
}
