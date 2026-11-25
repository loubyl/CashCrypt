import { createElement } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { MOMENT_BEAT_MIN_MS, SIGIL_SHAKE, SIGIL_STROKE, VIEWBOX_WIDTH } from "@/lib/scene";
import type { MomentOptions, MomentTarget } from "./momentLoader";
import { driveOnWallClock } from "./driveOnWallClock";
import { ART_PART, SigilArt } from "./MomentArt";

const MS_PER_S = 1000;
const HALF = 0.5;
const SHAKE_S = 0.1;
const SETTLE_S = 0.2;
const DRAW_FADE_IN_S = 0.05;
const FLASH_PEAK_OPACITY = 0.4;
const FLASH_RISE_SHARE = 0.4;
/** Body opacity of a bound Poltergeist (the value Poltergeist.tsx draws for the bound state). */
const BOUND_BODY_OPACITY = 0.5;
const SHAKE_STEPS = [1, -1, 0] as const;

/**
 * Sigil Moment: a ring draws itself around the Poltergeist (DrawSVGPlugin), a closing beat holds,
 * the Poltergeist shakes once and settles dimmed, with one brief flash. It never removes or splits the
 * Poltergeist. Reduced motion never reaches this file (the loader handles it without GSAP).
 */
export async function playSigilMoment(target: MomentTarget, options: MomentOptions): Promise<void> {
  const { request, signal, durationMs } = options;
  if (request.kind !== "sigil" || signal.aborted) return;

  const [{ gsap }, { DrawSVGPlugin }] = await Promise.all([import("gsap"), import("gsap/DrawSVGPlugin")]);
  if (signal.aborted) return;
  gsap.registerPlugin(DrawSVGPlugin);

  const poltergeist = target.getLiveModel().poltergeist;
  if (!poltergeist) return;

  const scene = target.scene.getBoundingClientRect();
  const layer = target.layer.getBoundingClientRect();
  const widthPx = scene.width;

  const container = target.layer.ownerDocument.createElement("div");
  container.style.position = "absolute";
  container.style.inset = "0";
  target.layer.appendChild(container);
  const root = createRoot(container);
  flushSync(() =>
    root.render(
      createElement(SigilArt, {
        leftPx: scene.left - layer.left,
        topPx: scene.top - layer.top,
        widthPx: widthPx > 0 ? widthPx : VIEWBOX_WIDTH,
        cx: poltergeist.sigil.cx,
        cy: poltergeist.sigil.cy,
        r: poltergeist.sigil.r,
        stroke: SIGIL_STROKE,
        flashR: poltergeist.sizeUnits * HALF,
      }),
    ),
  );

  const ring = container.querySelector<SVGElement>(`[data-moment="${ART_PART.sigil}"]`);
  const flash = container.querySelector<SVGElement>(`[data-moment="${ART_PART.sigilFlash}"]`);
  const figure = target.scene.querySelector<SVGElement>('[data-part="poltergeist"]');
  const body = target.scene.querySelector<SVGElement>('[data-part="poltergeist-body"]');

  const beatS = MOMENT_BEAT_MIN_MS / MS_PER_S;
  const drawS = Math.max(0.1, durationMs / MS_PER_S - beatS - SHAKE_S - SETTLE_S);
  const beatAt = drawS;
  const shakeAt = beatAt + beatS;
  const settleAt = shakeAt + SHAKE_S;

  const ctx = gsap.context(() => undefined, target.scene);
  const cleanup = (): void => {
    ctx.revert();
    root.unmount();
    container.remove();
  };
  target.registerCleanup(cleanup);

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

      if (ring) {
        gsap.set(ring, { drawSVG: "0%", opacity: 0 });
        tl.to(ring, { opacity: 1, duration: DRAW_FADE_IN_S, ease: "none" }, 0);
        tl.to(ring, { drawSVG: "0% 100%", duration: drawS, ease: "power2.inOut" }, 0);
      }

      if (figure) {
        // Shake once: the figure's x offset in ViewBox units, then back to rest.
        let at = shakeAt;
        const stepS = SHAKE_S / SHAKE_STEPS.length;
        SHAKE_STEPS.forEach((direction) => {
          tl.to(figure, { x: direction * SIGIL_SHAKE, duration: stepS, ease: "power2.inOut" }, at);
          at += stepS;
        });
      }

      if (body) tl.to(body, { opacity: BOUND_BODY_OPACITY, duration: SETTLE_S, ease: "power2.inOut" }, settleAt);

      if (flash) {
        tl.to(flash, { opacity: FLASH_PEAK_OPACITY, duration: SETTLE_S * FLASH_RISE_SHARE, ease: "power2.out" }, settleAt);
        tl.to(flash, { opacity: 0, duration: SETTLE_S * (1 - FLASH_RISE_SHARE), ease: "power2.in" }, settleAt + SETTLE_S * FLASH_RISE_SHARE);
      }

      // Keep the timeline at least as long as the Moment duration.
      tl.set({}, {}, Math.max(durationMs / MS_PER_S, settleAt + SETTLE_S));
      stopDriver = driveOnWallClock(gsap, tl);
    });

    if (signal.aborted) {
      onAbort();
      return;
    }
    signal.addEventListener("abort", onAbort, { once: true });
  });
}
