import { createElement } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { GHOST_ARRIVAL_RISE, MARKER_PULSE_SCALE, VIEWBOX_WIDTH, getOverflowAnchors } from "@/lib/scene";
import type { MomentOptions, MomentTarget } from "./momentLoader";
import { driveOnWallClock } from "./driveOnWallClock";
import { ART_PART, GhostCopyArt, MarkerPulseArt } from "./MomentArt";
const MS_PER_S = 1000;
/** Beats of the 800 ms sequence, in seconds: rise or swell, hold, settle. */
const RISE_S = 0.4;
const HOLD_END_S = 0.7;
const MARKER_SWELL_S = 0.3;
const MARKER_HOLD_END_S = 0.6;
/** Halo opacity at the top of the arrival glow, and the normal 25% it settles to. */
const HALO_PEAK_OPACITY = 0.6;
const HALO_REST_OPACITY = 0.25;
const REST_SCALE = 1;
const REST_OFFSET = 0;
const VISIBLE = 1;
/**
 * Ghost arrival Moment. Drawn variant: a copy of the new Ghost rises GHOST_ARRIVAL_RISE to its live rest
 * point while fading in with a brief halo glow. Overflow variant (the Ghost is beyond the Visible_Cap):
 * the "+N" marker shows the live Overflow_Count, the frozen marker is hidden, and it pulses once.
 * Reduced motion never reaches this file (the loader handles it without GSAP).
 */
export async function playGhostArrivalMoment(target: MomentTarget, options: MomentOptions): Promise<void> {
  const { request, signal, durationMs } = options;
  if (request.kind !== "ghostArrival" || signal.aborted) return;
  const { gsap } = await import("gsap");
  if (signal.aborted) return;
  const model = target.getLiveModel();
  const ghost = model.ghosts.find((entry) => entry.id === request.transactionId) ?? null;
  const scene = target.scene.getBoundingClientRect();
  const layer = target.layer.getBoundingClientRect();
  const geometry = {
    leftPx: scene.left - layer.left,
    topPx: scene.top - layer.top,
    widthPx: scene.width > 0 ? scene.width : VIEWBOX_WIDTH,
  };
  const container = target.layer.ownerDocument.createElement("div");
  container.style.position = "absolute";
  container.style.inset = "0";
  target.layer.appendChild(container);
  const root = createRoot(container);
  flushSync(() => {
    root.render(
      createElement(
        "div",
        null,
        ghost
          ? createElement(GhostCopyArt, { ...geometry, ghost })
          : createElement(MarkerPulseArt, { ...geometry, count: model.overflow.ghosts, anchor: getOverflowAnchors().ghosts }),
      ),
    );
  });
  const copy = container.querySelector<SVGElement>(`[data-moment="${ART_PART.ghostArrival}"]`);
  const rise = container.querySelector<SVGElement>(`[data-moment="${ART_PART.ghostArrivalRise}"]`);
  const halo = copy?.querySelector<SVGElement>('[data-part="ghost-halo"] path') ?? null;
  const marker = container.querySelector<HTMLElement>(`[data-moment="${ART_PART.markerPulse}"]`);
  const pulse = container.querySelector<HTMLElement>(`[data-moment="${ART_PART.markerPulseInner}"]`);
  // The frozen marker shows the old count: hide it while the copy with the live count is drawn.
  const frozenMarker = ghost
    ? null
    : target.scene.querySelector<HTMLElement>('[data-part="overflow-marker"][data-kind="ghosts"]');
  const frozenOpacity = frozenMarker?.style.opacity ?? "";
  if (frozenMarker) frozenMarker.style.opacity = "0";
  // The live marker takes the frozen one's place at once; only its inner span pulses.
  if (marker) marker.style.opacity = String(VISIBLE);
  const ctx = gsap.context(() => undefined, target.scene);
  const cleanup = (): void => {
    ctx.revert();
    if (frozenMarker) frozenMarker.style.opacity = frozenOpacity;
    root.unmount();
    container.remove();
  };
  target.registerCleanup(cleanup);
  const totalS = durationMs / MS_PER_S;
  return new Promise<void>((resolve) => {
    let timeline: gsap.core.Timeline | null = null;
    let stopDriver: () => void = () => undefined;
    const finish = (): void => {
      stopDriver();
      signal.removeEventListener("abort", onAbort);
      resolve();
    };
    const onAbort = (): void => {
      stopDriver();
      timeline?.progress(1, false);
      finish();
    };
    ctx.add(() => {
      const tl = gsap.timeline({ onComplete: finish });
      timeline = tl;
      if (copy && rise) {
        gsap.set(rise, { y: GHOST_ARRIVAL_RISE });
        tl.to(copy, { opacity: VISIBLE, duration: RISE_S, ease: "power2.out" }, 0);
        tl.to(rise, { y: REST_OFFSET, duration: RISE_S, ease: "power2.out" }, 0);
        if (halo) {
          tl.to(halo, { opacity: HALO_PEAK_OPACITY, duration: RISE_S, ease: "power2.out" }, 0);
          tl.to(halo, { opacity: HALO_REST_OPACITY, duration: totalS - HOLD_END_S, ease: "power2.inOut" }, HOLD_END_S);
        }
      } else if (marker && pulse) {
        tl.to(pulse, { scale: MARKER_PULSE_SCALE, duration: MARKER_SWELL_S, ease: "power2.out" }, 0);
        tl.to(pulse, { scale: REST_SCALE, duration: totalS - MARKER_HOLD_END_S, ease: "power2.inOut" }, MARKER_HOLD_END_S);
      }
      // Keep the timeline exactly as long as the Moment duration.
      tl.set({}, {}, totalS);
      stopDriver = driveOnWallClock(gsap, tl);
    });
    if (signal.aborted) {
      onAbort();
      return;
    }
    signal.addEventListener("abort", onAbort, { once: true });
  });
}
