import { createElement } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { VIEWBOX_WIDTH } from "@/lib/scene";
import { getCandleBoxes } from "@/lib/scene/momentGeometry";
import type { MomentOptions, MomentTarget } from "./momentLoader";
import { driveOnWallClock } from "./driveOnWallClock";
import { ART_PART, CandlesArt } from "./MomentArt";

const MS_PER_S = 1000;
const CANDLE_COUNT = 3;
const WAX_FADE_S = 0.15;
const LIGHT_S = 0.18;
/** Share of the Moment duration used by the lighting steps; the rest is hold and fade-out. */
const LIGHT_SPAN_SHARE = 0.5;
const FADE_OUT_S = 0.2;

/**
 * Three-candles Moment: three candles above the Scene light one after another, hold, then fade out.
 * The completion card text is separate chrome and is never touched here. Only opacity is animated.
 * Reduced motion never reaches this file (the loader handles it without GSAP).
 */
export async function playThreeCandlesMoment(target: MomentTarget, options: MomentOptions): Promise<void> {
  const { request, signal, durationMs } = options;
  if (request.kind !== "exorcismComplete" || signal.aborted) return;

  const { gsap } = await import("gsap");
  if (signal.aborted) return;

  const scene = target.scene.getBoundingClientRect();
  const layer = target.layer.getBoundingClientRect();

  const container = target.layer.ownerDocument.createElement("div");
  container.style.position = "absolute";
  container.style.inset = "0";
  container.style.pointerEvents = "none";
  target.layer.appendChild(container);
  const root = createRoot(container);
  flushSync(() =>
    root.render(
      createElement(CandlesArt, {
        leftPx: scene.left - layer.left,
        topPx: scene.top - layer.top,
        widthPx: scene.width > 0 ? scene.width : VIEWBOX_WIDTH,
        boxes: getCandleBoxes(),
      }),
    ),
  );

  const waxes = Array.from(container.querySelectorAll<SVGElement>(`[data-moment="${ART_PART.candle}"]`));
  const flames = Array.from(container.querySelectorAll<SVGElement>(`[data-moment="${ART_PART.candleFlame}"]`));

  const totalS = durationMs / MS_PER_S;
  const stepS = (totalS * LIGHT_SPAN_SHARE) / CANDLE_COUNT;
  const fadeAt = Math.max(totalS - FADE_OUT_S, WAX_FADE_S + CANDLE_COUNT * stepS);

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

      tl.to(waxes, { opacity: 1, duration: WAX_FADE_S, ease: "power2.out" }, 0);
      flames.forEach((flame, index) => {
        tl.to(flame, { opacity: 1, duration: LIGHT_S, ease: "power2.out" }, WAX_FADE_S + index * stepS);
      });
      // End state: every candle and flame is gone.
      tl.to([...waxes, ...flames], { opacity: 0, duration: FADE_OUT_S, ease: "power2.in" }, fadeAt);
      // Keep the timeline at least as long as the Moment duration.
      tl.set({}, {}, Math.max(totalS, fadeAt + FADE_OUT_S));
      stopDriver = driveOnWallClock(gsap, tl);
    });

    if (signal.aborted) {
      onAbort();
      return;
    }
    signal.addEventListener("abort", onAbort, { once: true });
  });
}
