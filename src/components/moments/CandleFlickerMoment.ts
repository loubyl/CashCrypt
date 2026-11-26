import { createElement } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { FLICKER_DIP_RATIO, FLICKER_GLOW_PAD, MOMENT_BEAT_MIN_MS, VIEWBOX_WIDTH } from "@/lib/scene";
import { HALO_MIN, HALO_RANGE, PANE_MIN, PANE_RANGE } from "@/components/house/WindowsLayer";
import type { MomentOptions, MomentTarget } from "./momentLoader";
import { driveOnWallClock } from "./driveOnWallClock";
import { ART_PART, FlickerGlowArt } from "./MomentArt";

const MS_PER_S = 1000;
// Lit variant beats in seconds: dip, return, rise to the live opacity, then the held beat.
const DIP_S = 0.1;
const RETURN_AT_S = 0.1;
const RISE_AT_S = 0.2;
const RISE_S = 0.2;
// No-lit variant: the glow fades in, holds, and fades out to 0.
const GLOW_PEAK_OPACITY = 0.35;
const GLOW_FADE_IN_S = 0.2;
const GLOW_FADE_OUT_AT_S = 0.5;
const GLOW_FADE_OUT_S = 0.2;

type FlickerElement = { element: Element; frozen: number; live: number };

/** The drawn (frozen) opacity of an element, read from its opacity attribute. */
function readOpacity(element: Element, fallback: number): number {
  const raw = element.getAttribute("opacity");
  const value = raw === null ? Number.NaN : Number(raw);
  return Number.isFinite(value) ? value : fallback;
}

/** The light and glow elements of every window lit in both the Scene and the live model. */
function planFlicker(target: MomentTarget): FlickerElement[] {
  const planned: FlickerElement[] = [];
  for (const window of target.getLiveModel().windows) {
    if (window.state !== "lit") continue;
    const root = target.scene.querySelector(`[data-part="window:${window.index}"][data-state="lit"]`);
    if (!root) continue;
    const livePane = PANE_MIN + PANE_RANGE * window.opacity;
    const liveHalo = HALO_MIN + HALO_RANGE * window.opacity;
    const light = root.querySelector('[data-part="light"]');
    const glow = root.querySelector('[data-part="glow"]');
    if (light) planned.push({ element: light, frozen: readOpacity(light, livePane), live: livePane });
    if (glow) planned.push({ element: glow, frozen: readOpacity(glow, liveHalo), live: liveHalo });
  }
  return planned;
}

/**
 * Candle flicker Moment: every lit window dips and returns once, then rises to the live opacity and holds.
 * With no lit window, a brief candle glow shows through the gaps of the boarded and broken windows and ends
 * at opacity 0. Reduced motion never reaches this file (the loader handles it without GSAP).
 */
export async function playCandleFlickerMoment(target: MomentTarget, options: MomentOptions): Promise<void> {
  const { request, signal, durationMs } = options;
  if (request.kind !== "candleFlicker" || signal.aborted) return;
  const { gsap } = await import("gsap");
  if (signal.aborted) return;

  const lit = request.litWindows;
  const planned = lit ? planFlicker(target) : [];
  const gapBoxes = lit ? [] : target.getLiveModel().windows.filter((w) => w.state !== "lit").map((w) => w.box);

  const container = target.layer.ownerDocument.createElement("div");
  container.style.position = "absolute";
  container.style.inset = "0";
  target.layer.appendChild(container);
  const root = createRoot(container);
  if (gapBoxes.length > 0) {
    const scene = target.scene.getBoundingClientRect();
    const layer = target.layer.getBoundingClientRect();
    flushSync(() =>
      root.render(
        createElement(FlickerGlowArt, {
          leftPx: scene.left - layer.left,
          topPx: scene.top - layer.top,
          widthPx: scene.width > 0 ? scene.width : VIEWBOX_WIDTH,
          boxes: gapBoxes,
          pad: FLICKER_GLOW_PAD,
        }),
      ),
    );
  }
  const glows = Array.from(container.querySelectorAll<SVGElement>(`[data-moment="${ART_PART.flickerGlow}"]`));

  // The windows fade through a CSS transition; GSAP drives them now, so the transition must not lag behind.
  const animated = planned.map((entry) => entry.element as SVGElement);
  const previousTransitions = animated.map((el) => el.style.transition);
  const previousOpacities = animated.map((el) => el.style.opacity);
  animated.forEach((el) => (el.style.transition = "none"));

  const ctx = gsap.context(() => undefined, target.scene);
  const cleanup = (): void => {
    ctx.revert();
    // GSAP's revert can leave the last tweened inline opacity (the dip) on the element, which would
    // override the live opacity attribute. Put back the inline value the element had before the Moment.
    animated.forEach((el, index) => {
      const previous = previousOpacities[index] ?? "";
      if (previous === "") el.style.removeProperty("opacity");
      else el.style.opacity = previous;
      el.style.transition = previousTransitions[index] ?? "";
    });
    root.unmount();
    container.remove();
  };
  target.registerCleanup(cleanup);
  const totalS = durationMs / MS_PER_S;
  const beatS = MOMENT_BEAT_MIN_MS / MS_PER_S;

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
      planned.forEach((entry) => {
        tl.fromTo(entry.element, { opacity: entry.frozen }, { opacity: entry.frozen * FLICKER_DIP_RATIO, duration: DIP_S, ease: "none", immediateRender: false }, 0);
        tl.set(entry.element, { opacity: entry.frozen }, RETURN_AT_S);
        tl.to(entry.element, { opacity: entry.live, duration: RISE_S, ease: "power2.out" }, RISE_AT_S);
      });
      glows.forEach((glow) => {
        tl.to(glow, { opacity: GLOW_PEAK_OPACITY, duration: GLOW_FADE_IN_S, ease: "power2.out" }, 0);
        tl.to(glow, { opacity: 0, duration: GLOW_FADE_OUT_S, ease: "power2.in" }, GLOW_FADE_OUT_AT_S);
      });
      // Keep the timeline at least as long as the Moment duration and the held beat.
      tl.set({}, {}, Math.max(totalS, RISE_AT_S + RISE_S + beatS));
      stopDriver = driveOnWallClock(gsap, tl);
    });

    if (signal.aborted) {
      onAbort();
      return;
    }
    signal.addEventListener("abort", onAbort, { once: true });
  });
}
