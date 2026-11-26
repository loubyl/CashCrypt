import { createElement } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { FEED_PARTICLE_REACH, FEED_SCALE, VIEWBOX_WIDTH } from "@/lib/scene";
import type { MomentOptions, MomentTarget } from "./momentLoader";
import { driveOnWallClock } from "./driveOnWallClock";
import { ART_PART, FeedParticlesArt, PoltergeistCopyArt } from "./MomentArt";

const MS_PER_S = 1000;
/** Time the frozen Ghosts layer takes to fade out while the copy fades in (appear variant). */
const APPEAR_FADE_S = 0.4;
/** The swell, the held beat and the return each take a third of the feed sequence. */
const PHASES = 3;
const PARTICLE_PEAK_OPACITY = 0.9;
const REST_SCALE = 1;
/** Share of a phase the particles take to fade in, and the travel time in phases. */
const PARTICLE_FADE_IN_SHARE = 0.3;
const PARTICLE_TRAVEL_PHASES = 2;

/**
 * Poltergeist feed Moment: the Poltergeist swells once with a spirit particle burst, holds, and settles.
 * With `appeared` the frozen Scene has no figure yet, so a copy fades in first (the real one is drawn when
 * the hold is released). Only the wrapper group scales: a bound sigil ring stays drawn and unscaled.
 * Reduced motion never reaches this file (the loader handles it without GSAP).
 */
export async function playPoltergeistFeedMoment(target: MomentTarget, options: MomentOptions): Promise<void> {
  const { request, signal, durationMs } = options;
  if (request.kind !== "poltergeistFeed" || signal.aborted) return;
  const { gsap } = await import("gsap");
  if (signal.aborted) return;
  const poltergeist = target.getLiveModel().poltergeist;
  if (!poltergeist) return;
  const appeared = request.appeared;
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
        appeared ? createElement(PoltergeistCopyArt, { ...geometry, poltergeist }) : null,
        createElement(FeedParticlesArt, { ...geometry, cx: poltergeist.center.x, cy: poltergeist.center.y }),
      ),
    );
  });
  const swellTarget = appeared
    ? container.querySelector<SVGElement>(`[data-moment="${ART_PART.poltergeistCopyFeed}"]`)
    : target.scene.querySelector<SVGElement>('[data-part="poltergeist-feed"]');
  const copy = container.querySelector<SVGElement>(`[data-moment="${ART_PART.poltergeistCopy}"]`);
  const ghosts = appeared ? target.scene.querySelector<SVGElement>('[data-part="ghosts"]') : null;
  const particles = Array.from(container.querySelectorAll<SVGElement>(`[data-moment="${ART_PART.feedParticle}"]`));
  const ctx = gsap.context(() => undefined, target.scene);
  const cleanup = (): void => {
    ctx.revert();
    root.unmount();
    container.remove();
  };
  target.registerCleanup(cleanup);
  const totalS = durationMs / MS_PER_S;
  const feedStartS = appeared ? APPEAR_FADE_S : 0;
  const phaseS = (totalS - feedStartS) / PHASES;
  const holdAt = feedStartS + phaseS;
  const returnAt = holdAt + phaseS;
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
      if (appeared) {
        if (ghosts) tl.to(ghosts, { opacity: 0, duration: APPEAR_FADE_S, ease: "power2.out" }, 0);
        if (copy) tl.to(copy, { opacity: 1, duration: APPEAR_FADE_S, ease: "power2.out" }, 0);
      }
      if (swellTarget) {
        // The origin is the figure's own center (the wrapper sits inside the translated figure group).
        gsap.set(swellTarget, { transformOrigin: "0px 0px" });
        tl.to(swellTarget, { scale: FEED_SCALE, duration: phaseS, ease: "power2.out" }, feedStartS);
        tl.to(swellTarget, { scale: REST_SCALE, duration: phaseS, ease: "power2.inOut" }, returnAt);
      }
      particles.forEach((particle) => {
        const angle = Number(particle.getAttribute("data-angle"));
        tl.to(particle, { opacity: PARTICLE_PEAK_OPACITY, duration: phaseS * PARTICLE_FADE_IN_SHARE, ease: "none" }, feedStartS);
        tl.to(
          particle,
          { x: Math.cos(angle) * FEED_PARTICLE_REACH, y: Math.sin(angle) * FEED_PARTICLE_REACH, duration: phaseS * PARTICLE_TRAVEL_PHASES, ease: "power2.out" },
          feedStartS,
        );
        tl.to(particle, { opacity: 0, duration: phaseS, ease: "power2.in" }, holdAt);
      });
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
