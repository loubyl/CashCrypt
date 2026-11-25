import { createElement, Fragment } from "react";
import type { ReactElement } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { FLAME_PX, MOMENT_BEAT_MIN_MS, ORB_PX, PAYMENT_FLARE_BOOST, VIEWBOX_WIDTH, getFlareSteps } from "@/lib/scene";
import type { Point, SceneModel } from "@/lib/scene";
import { getCrackFlash, getFlameFallbackPoint, getOrbEndpoint } from "@/lib/scene/momentGeometry";
import { HALO_MIN, HALO_RANGE, PANE_MIN, PANE_RANGE } from "@/components/house/WindowsLayer";
import type { MomentOptions, MomentTarget } from "./momentLoader";
import { driveOnWallClock } from "./driveOnWallClock";
import { ART_PART, CrackFlashArt, FlameArt, OrbArt } from "./MomentArt";

const MS_PER_S = 1000;
const HALF = 0.5;
const MIN_ART_PX = 24;

// Timeline phases in seconds. The orb flight takes what is left of the Moment duration.
const FLAME_FLICKER_S = 0.3;
const FLAME_FADE_IN_S = 0.06;
const FLAME_FADE_OUT_S = 0.08;
const FLAME_FLICKER_STEPS = [
  { scale: 1.18, duration: 0.07 },
  { scale: 0.92, duration: 0.07 },
  { scale: 1.1, duration: 0.08 },
  { scale: 1, duration: 0.08 },
] as const;
const FLARE_RISE_S = 0.1;
const FLARE_SETTLE_S = 0.15;
const MIN_FLIGHT_S = 0.2;
const ORB_FADE_IN_S = 0.05;
const ORB_FADE_OUT_S = 0.08;
const ORB_END_SCALE = 1.6;
const CRACK_FADE_S = 0.06;
const FLIGHT_CURVE_LIFT_SHARE = 0.3;
const MIN_CURVE_LIFT_PX = 40;
const FLIGHT_CURVINESS = 1.5;

type Geometry = { originX: number; originY: number; scale: number };

function readGeometry(target: MomentTarget): Geometry {
  const scene = target.scene.getBoundingClientRect();
  const layer = target.layer.getBoundingClientRect();
  return { originX: scene.left - layer.left, originY: scene.top - layer.top, scale: scene.width / VIEWBOX_WIDTH };
}

function toPx(geometry: Geometry, point: Point): Point {
  return { x: geometry.originX + point.x * geometry.scale, y: geometry.originY + point.y * geometry.scale };
}

export type LitWindow = {
  glow: Element | null;
  light: Element | null;
  from: number;
  peak: number;
  final: number;
};

/** Reads the drawn (frozen) opacity of a lit window back from its pane opacity attribute. */
function readDrawnOpacity(light: Element | null, fallback: number): number {
  const raw = light?.getAttribute("opacity");
  const value = raw === null || raw === undefined ? Number.NaN : Number(raw);
  return Number.isFinite(value) ? (value - PANE_MIN) / PANE_RANGE : fallback;
}

/** The lit windows drawn in the Scene that are also lit in the live model, with their flare steps. */
export function planLitWindows(scene: HTMLElement, live: SceneModel): LitWindow[] {
  const planned: LitWindow[] = [];
  for (const window of live.windows) {
    if (window.state !== "lit") continue;
    const root = scene.querySelector(`[data-part="window:${window.index}"][data-state="lit"]`);
    if (!root) continue;
    const light = root.querySelector('[data-part="light"]');
    const glow = root.querySelector('[data-part="glow"]');
    if (!light && !glow) continue;
    const steps = getFlareSteps(readDrawnOpacity(light, window.opacity), window.opacity, PAYMENT_FLARE_BOOST);
    planned.push({ glow, light, ...steps });
  }
  return planned;
}

const paneOpacity = (opacity: number): number => PANE_MIN + PANE_RANGE * opacity;
const haloOpacity = (opacity: number): number => HALO_MIN + HALO_RANGE * opacity;

/** Flame start (art center) in layer pixels: left edge of the submit control, or the Scene bottom center. */
function planStart(
  request: Extract<MomentOptions["request"], { kind: "payment" }>,
  geometry: Geometry,
  layerRect: DOMRect,
  flamePx: number,
): { flameLeft: number; flameTop: number; center: Point } {
  if (request.origin) {
    const left = request.origin.left - layerRect.left;
    const top = request.origin.top + request.origin.height * HALF - layerRect.top - flamePx * HALF;
    return { flameLeft: left, flameTop: top, center: { x: left + flamePx * HALF, y: top + flamePx * HALF } };
  }
  const center = toPx(geometry, getFlameFallbackPoint());
  return { flameLeft: center.x - flamePx * HALF, flameTop: center.y - flamePx * HALF, center };
}

/**
 * Extra-payment Moment: a flame flickers at the Save payment control, a light orb flies to the
 * first lit window along a curved path, the lit windows flare up and hold while the crack flashes,
 * then settle on the live opacity. Reduced motion never reaches this file (the loader handles it).
 */
export async function playCandleOrbMoment(target: MomentTarget, options: MomentOptions): Promise<void> {
  const { request, signal, durationMs } = options;
  if (request.kind !== "payment" || signal.aborted) return;

  const [{ gsap }, { MotionPathPlugin }] = await Promise.all([import("gsap"), import("gsap/MotionPathPlugin")]);
  if (signal.aborted) return;
  gsap.registerPlugin(MotionPathPlugin);

  const live = target.getLiveModel();
  const geometry = readGeometry(target);
  const layerRect = target.layer.getBoundingClientRect();
  const flamePx = Math.max(MIN_ART_PX, FLAME_PX);
  const orbPx = Math.max(MIN_ART_PX, ORB_PX);
  const start = planStart(request, geometry, layerRect, flamePx);
  const end = toPx(geometry, getOrbEndpoint(live));
  const crack = request.hasCrack ? getCrackFlash() : null;
  const windows = planLitWindows(target.scene, live);

  const children: ReactElement[] = [
    createElement(FlameArt, { key: "flame", leftPx: start.flameLeft, topPx: start.flameTop, sizePx: flamePx }),
    createElement(OrbArt, { key: "orb", sizePx: orbPx }),
  ];
  if (crack) {
    children.push(
      createElement(CrackFlashArt, {
        key: "crack",
        leftPx: geometry.originX,
        topPx: geometry.originY,
        widthPx: VIEWBOX_WIDTH * geometry.scale,
        points: crack.points,
        stroke: crack.stroke,
      }),
    );
  }
  const container = target.layer.ownerDocument.createElement("div");
  container.style.position = "absolute";
  container.style.inset = "0";
  target.layer.appendChild(container);
  const root = createRoot(container);
  flushSync(() => root.render(createElement(Fragment, null, ...children)));

  const flame = container.querySelector<SVGElement>(`[data-moment="${ART_PART.flame}"]`);
  const orb = container.querySelector<SVGElement>(`[data-moment="${ART_PART.orb}"]`);
  const crackFlash = container.querySelector<SVGElement>(`[data-moment="${ART_PART.crack}"]`);

  // The windows fade through a CSS transition; GSAP drives them now, so the transition must not lag behind.
  const animated = windows.flatMap((w) => [w.glow, w.light]).filter((el): el is Element => el !== null);
  const previousTransitions = animated.map((el) => (el as SVGElement).style.transition);
  animated.forEach((el) => ((el as SVGElement).style.transition = "none"));

  const beatS = MOMENT_BEAT_MIN_MS / MS_PER_S;
  const flightS = Math.max(MIN_FLIGHT_S, durationMs / MS_PER_S - FLAME_FLICKER_S - FLARE_RISE_S - beatS - FLARE_SETTLE_S);
  const launchAt = FLAME_FLICKER_S;
  const arriveAt = launchAt + flightS;
  const holdEndAt = arriveAt + FLARE_RISE_S + beatS;

  const dx = end.x - start.center.x;
  const dy = end.y - start.center.y;
  const lift = Math.max(MIN_CURVE_LIFT_PX, Math.hypot(dx, dy) * FLIGHT_CURVE_LIFT_SHARE);
  const half = orbPx * HALF;
  const path = [
    { x: start.center.x - half, y: start.center.y - half },
    { x: start.center.x + dx * HALF - half, y: Math.min(start.center.y, end.y) - lift - half },
    { x: end.x - half, y: end.y - half },
  ];

  const ctx = gsap.context(() => undefined, target.scene);
  const cleanup = (): void => {
    ctx.revert();
    animated.forEach((el, index) => ((el as SVGElement).style.transition = previousTransitions[index] ?? ""));
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

      if (flame) {
        gsap.set(flame, { opacity: 0, scale: 1, transformOrigin: "50% 100%" });
        tl.to(flame, { opacity: 1, duration: FLAME_FADE_IN_S, ease: "none" }, 0);
        let flickerAt = 0;
        FLAME_FLICKER_STEPS.forEach((step) => {
          tl.to(flame, { scale: step.scale, duration: step.duration, ease: "sine.inOut" }, flickerAt);
          flickerAt += step.duration;
        });
        tl.to(flame, { opacity: 0, duration: FLAME_FADE_OUT_S, ease: "none" }, launchAt);
      }

      if (orb) {
        gsap.set(orb, { x: path[0]?.x ?? 0, y: path[0]?.y ?? 0, opacity: 0, scale: 1, transformOrigin: "50% 50%" });
        tl.to(orb, { opacity: 1, duration: ORB_FADE_IN_S, ease: "none" }, launchAt);
        tl.to(orb, { motionPath: { path, type: "thru", curviness: FLIGHT_CURVINESS }, duration: flightS, ease: "power2.inOut" }, launchAt);
        tl.to(orb, { scale: ORB_END_SCALE, opacity: 0, duration: ORB_FADE_OUT_S, ease: "power2.out" }, arriveAt - ORB_FADE_OUT_S / 2);
      }

      windows.forEach((w) => {
        const tween = (el: Element | null, map: (opacity: number) => number): void => {
          if (!el) return;
          tl.fromTo(el, { opacity: map(w.from) }, { opacity: map(w.peak), duration: FLARE_RISE_S, ease: "power2.out", immediateRender: false }, arriveAt);
          tl.to(el, { opacity: map(w.final), duration: FLARE_SETTLE_S, ease: "power2.inOut" }, holdEndAt);
        };
        tween(w.light, paneOpacity);
        tween(w.glow, haloOpacity);
      });

      if (crackFlash) {
        tl.to(crackFlash, { opacity: 1, duration: CRACK_FADE_S, ease: "none" }, arriveAt);
        tl.to(crackFlash, { opacity: 0, duration: FLARE_SETTLE_S, ease: "power2.in" }, holdEndAt);
      }

      // Keep the timeline at least as long as the Moment duration.
      tl.set({}, {}, Math.max(durationMs / MS_PER_S, holdEndAt + FLARE_SETTLE_S));
      // Play by the wall clock so a slow frame rate cannot stretch the Moment (see driveOnWallClock).
      stopDriver = driveOnWallClock(gsap, tl);
    });

    if (signal.aborted) {
      onAbort();
      return;
    }
    signal.addEventListener("abort", onAbort, { once: true });
  });
}
