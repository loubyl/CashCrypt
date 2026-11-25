import { createElement, Fragment } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import { DecayLayer } from "@/components/house/DecayLayer";
import { HouseBase } from "@/components/house/HouseBase";
import { MOMENT_BEAT_MIN_MS, SHUTTER_WIDTH, VIEWBOX_WIDTH } from "@/lib/scene";
import type { SceneModel } from "@/lib/scene";
import { batPath, getCrackFlash, getShutterBox, pickShutterWindow } from "@/lib/scene/momentGeometry";
import type { MomentOptions, MomentTarget } from "./momentLoader";
import { driveOnWallClock } from "./driveOnWallClock";
import { ART_PART, BatArt, CreakArt } from "./MomentArt";

const MS_PER_S = 1000;
const HALF = 0.5;
const SVG_NS = "http://www.w3.org/2000/svg";
const INCOMING_PART = "incoming-level";
const SCENE_DECAY_SELECTOR = ':scope > svg > [data-part="decay"]';
const FRONT_FOG_SELECTOR = '[data-part="atmosphere-front"]';
const FOG_THIN_OPACITY = 0.35;
const PREPARE_FRAME_FALLBACK_MS = 50;
const FILTER_ID_PATTERN = /^scene-(halo|moon|shingles)-/;
// Better level (dawn): the old level shows until the midpoint, then the new level fades in over the second half.
const DAWN_BAT_FADE_IN_S = 0.05;
const DAWN_FOG_END_SHARE = 0.5;
// Worse level (creak): the crack draws, the shutter swings once, the new level appears at the end.
const CREAK_CRACK_FADE_S = 0.05;
const CREAK_SWING_OPEN_SCALE = 1;
const CREAK_SWING_CLOSED_SCALE = 0.15;
const CREAK_SWING_SHARE = 0.4;
const CREAK_FADE_OUT_S = 0.1;
const TRANSITION_SHARE = 0.5;

type FilterIds = { halo: string; moon: string; shingles: string };

/** The filter and pattern ids the Scene defines in its `<defs>`, read back from the DOM. */
function readFilterIds(scene: HTMLElement): FilterIds | null {
  const ids: Partial<FilterIds> = {};
  scene.querySelectorAll("defs [id]").forEach((element) => {
    const match = FILTER_ID_PATTERN.exec(element.id);
    if (match) ids[match[1] as keyof FilterIds] = element.id;
  });
  return ids.halo && ids.moon && ids.shingles ? { halo: ids.halo, moon: ids.moon, shingles: ids.shingles } : null;
}

type Incoming = { slot: SVGGElement; root: Root };

/** Resolves after one frame, or at once on abort, or after a short fallback when frames do not fire. */
function waitOneFrame(signal: AbortSignal): Promise<void> {
  return new Promise<void>((resolve) => {
    if (signal.aborted) {
      resolve();
      return;
    }
    const done = (): void => {
      clearTimeout(fallback);
      signal.removeEventListener("abort", done);
      resolve();
    };
    const fallback = setTimeout(done, PREPARE_FRAME_FALLBACK_MS);
    signal.addEventListener("abort", done);
    requestAnimationFrame(done);
  });
}

/**
 * Prepare step: renders the incoming level layer (house base and decay of the live model) in an
 * `incoming-level` group of the Scene SVG, hidden, above the old decay layer and below the creatures,
 * then waits one frame. Returns null when the Scene cannot host it; the Moment then ends by the hold release.
 */
export async function prepareIncomingLevel(
  target: MomentTarget,
  model: SceneModel,
  signal: AbortSignal,
): Promise<Incoming | null> {
  const oldDecay = target.scene.querySelector<SVGGElement>(SCENE_DECAY_SELECTOR);
  const filterIds = readFilterIds(target.scene);
  if (!oldDecay || !oldDecay.parentNode || !filterIds) return null;
  const slot = target.scene.ownerDocument.createElementNS(SVG_NS, "g") as SVGGElement;
  slot.setAttribute("data-part", INCOMING_PART);
  slot.style.opacity = "0";
  oldDecay.parentNode.insertBefore(slot, oldDecay.nextSibling);
  const root = createRoot(slot);
  flushSync(() =>
    root.render(createElement(Fragment, null, createElement(HouseBase, { model, filterIds }), createElement(DecayLayer, { model }))),
  );
  await waitOneFrame(signal);
  return { slot, root };
}

type Geometry = { leftPx: number; topPx: number; widthPx: number };

function readGeometry(target: MomentTarget): Geometry {
  const scene = target.scene.getBoundingClientRect();
  const layer = target.layer.getBoundingClientRect();
  return { leftPx: scene.left - layer.left, topPx: scene.top - layer.top, widthPx: scene.width > 0 ? scene.width : VIEWBOX_WIDTH };
}

/** Shutter slab and hinge for the lowest-index window of the live model, or null without windows. */
function planShutter(model: SceneModel) {
  const window = pickShutterWindow(model);
  if (!window) return null;
  const box = getShutterBox(window);
  const swingsLeft = box.x < window.box.x;
  return {
    x: swingsLeft ? box.x : window.box.x + window.box.w,
    y: box.y,
    w: SHUTTER_WIDTH,
    h: box.h,
    hingeX: swingsLeft ? window.box.x : window.box.x + window.box.w,
  };
}

/**
 * Level-change Moment. Better level: dawn (the new level fades in at the midpoint, the fog thins, one bat
 * flies away). Worse level: creak (one crack draws, one shutter swings once, the new level appears at the
 * end). The Moment adds no announcement; the Dashboard live region owns it. Reduced motion never reaches
 * this file (the loader handles it without GSAP).
 */
export async function playLevelChangeMoment(target: MomentTarget, options: MomentOptions): Promise<void> {
  const { request, signal, durationMs } = options;
  if (request.kind !== "level" || signal.aborted) return;
  const better = request.to < request.from;
  const [{ gsap }, { DrawSVGPlugin }] = await Promise.all([import("gsap"), import("gsap/DrawSVGPlugin")]);
  if (signal.aborted) return;
  gsap.registerPlugin(DrawSVGPlugin);
  const live = target.getLiveModel();
  const incoming = await prepareIncomingLevel(target, live, signal);
  const geometry = readGeometry(target);
  const container = target.layer.ownerDocument.createElement("div");
  container.style.position = "absolute";
  container.style.inset = "0";
  target.layer.appendChild(container);
  const root = createRoot(container);
  if (better) {
    flushSync(() => root.render(createElement(BatArt, geometry)));
  } else {
    const crack = getCrackFlash();
    flushSync(() =>
      root.render(createElement(CreakArt, { ...geometry, crackPoints: crack.points, crackStroke: crack.stroke, shutter: planShutter(live) })),
    );
  }
  const bat = container.querySelector<SVGElement>(`[data-moment="${ART_PART.bat}"]`);
  const crackLine = container.querySelector<SVGElement>(`[data-moment="${ART_PART.creakCrack}"]`);
  const shutter = container.querySelector<SVGElement>(`[data-moment="${ART_PART.shutter}"]`);
  const frontFog = target.scene.querySelector<SVGElement>(FRONT_FOG_SELECTOR);
  const totalS = durationMs / MS_PER_S;
  const midS = totalS * TRANSITION_SHARE;
  const ctx = gsap.context(() => undefined, target.scene);
  const cleanup = (): void => {
    ctx.revert();
    incoming?.root.unmount();
    incoming?.slot.remove();
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
      if (better) {
        const samples = batPath();
        if (bat && samples.length > 0) {
          const first = samples[0]!;
          gsap.set(bat, { x: first.point.x, y: first.point.y, opacity: 0, svgOrigin: "0 0" });
          tl.to(bat, { opacity: first.opacity, duration: DAWN_BAT_FADE_IN_S, ease: "none" }, 0);
          const stepS = (totalS - DAWN_BAT_FADE_IN_S) / Math.max(1, samples.length - 1);
          samples.slice(1).forEach((sample, index) => {
            tl.to(
              bat,
              { x: sample.point.x, y: sample.point.y, opacity: sample.opacity, duration: stepS, ease: "none" },
              DAWN_BAT_FADE_IN_S + index * stepS,
            );
          });
        }
        if (frontFog) tl.to(frontFog, { opacity: FOG_THIN_OPACITY, duration: totalS * DAWN_FOG_END_SHARE, ease: "power2.inOut" }, 0);
        if (incoming) tl.to(incoming.slot, { opacity: 1, duration: totalS - midS, ease: "power2.inOut" }, midS);
      } else {
        const beatS = MOMENT_BEAT_MIN_MS / MS_PER_S;
        const swingS = Math.max(0.1, (totalS - beatS) * CREAK_SWING_SHARE);
        const drawS = Math.max(0.1, totalS * HALF - CREAK_CRACK_FADE_S);
        if (crackLine) {
          gsap.set(crackLine, { drawSVG: "0%", opacity: 0 });
          tl.to(crackLine, { opacity: 1, duration: CREAK_CRACK_FADE_S, ease: "none" }, 0);
          tl.to(crackLine, { drawSVG: "0% 100%", duration: drawS, ease: "power2.inOut" }, 0);
        }
        const swingAt = Math.min(midS, totalS - swingS * 2 - CREAK_FADE_OUT_S);
        if (shutter) {
          const hingeX = planShutter(live)?.hingeX ?? 0;
          const hingeY = planShutter(live)?.y ?? 0;
          gsap.set(shutter, { opacity: 0, scaleX: CREAK_SWING_CLOSED_SCALE, svgOrigin: `${hingeX} ${hingeY}` });
          tl.to(shutter, { opacity: 1, duration: CREAK_CRACK_FADE_S, ease: "none" }, Math.max(0, swingAt));
          tl.to(shutter, { scaleX: CREAK_SWING_OPEN_SCALE, duration: swingS, ease: "power2.out" }, Math.max(0, swingAt));
          tl.to(shutter, { scaleX: CREAK_SWING_CLOSED_SCALE, duration: swingS, ease: "power2.inOut" }, Math.max(0, swingAt) + swingS);
          tl.to(shutter, { opacity: 0, duration: CREAK_FADE_OUT_S, ease: "none" }, Math.max(0, swingAt) + swingS * 2);
        }
        // The new level's features appear at the end of the Moment.
        if (incoming) tl.to(incoming.slot, { opacity: 1, duration: CREAK_FADE_OUT_S, ease: "none" }, Math.max(0, totalS - CREAK_FADE_OUT_S));
      }
      // Keep the timeline at least as long as the Moment duration.
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
