"use client";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import type { RefObject } from "react";
import {
  BAT_CIRCLE_RADIUS_X,
  BAT_CIRCLE_RADIUS_Y,
  BAT_PERIOD_MS,
  BAT_STAGGER_MS,
  FIREFLY_DRIFT_DISTANCE,
  FIREFLY_MIN_OPACITY,
  FIREFLY_PERIOD_MS,
  FIREFLY_RISE_DISTANCE,
  FIREFLY_STAGGER_MS,
  FOG_DRIFT_DISTANCE,
  FOG_DRIFT_PERIOD_MS,
  FOG_DRIFT_STAGGER_MS,
  FULL_TURN_RADIANS,
  GHOST_BOB_AMPLITUDE_PX,
  GHOST_ORBIT_PERIOD_MS,
  POLTERGEIST_PULSE_MS,
  POLTERGEIST_PULSE_SCALE,
  POLTERGEIST_ROTATION_MS,
  UNITS_PER_REFERENCE_PX,
  WINDOW_FLICKER_L2_MIN_OPACITY,
  WINDOW_FLICKER_L2_PERIOD_MS,
  WINDOW_FLICKER_L3_MIN_OPACITY,
  WINDOW_FLICKER_L3_MS,
  WINDOW_FLICKER_L3_PAUSE_MS,
  WINDOW_FLICKER_STAGGER_MS,
  ZOMBIE_SWAY_AMPLITUDE_PX,
  getLanePoint,
} from "@/lib/scene";

export type AmbientMotionProps = {
  /** The scene container; every query is scoped to it. */
  scope: RefObject<HTMLElement | null>;
  /** Changes when the animated elements change (level, creature ids, Poltergeist state). */
  signature: string;
};

const MS_PER_S = 1000;
const HALF = 2;
const FULL_TURN_DEG = 360;
const FLICKER_LEVEL_SLOW = 2;
const FLICKER_LEVEL_FAST = 3;
const MAX_TICK_DELTA_MS = 100;
const ORIGIN_CENTER = "50% 50%";
const DEFAULT_NUMBER = 0;
const OBSERVER_THRESHOLD = 0;
const SELECTOR_AMBIENT = "[data-ambient=";

/** Seconds from a duration in milliseconds. */
function seconds(ms: number): number {
  return ms / MS_PER_S;
}

/** Reads a numeric `data-*` hook; a missing or malformed value becomes 0. */
function readNumber(element: Element, name: string): number {
  const value = Number(element.getAttribute(name));
  return Number.isFinite(value) ? value : DEFAULT_NUMBER;
}

/** Looks up the elements of one ambient kind inside the scope. */
function query(root: HTMLElement, kind: string): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(`${SELECTOR_AMBIENT}"${kind}"]`));
}

/** Ease that moves a value from 0 to its target along sin(2πp + phase), looping without a seam. */
function sineEase(phase: number): (progress: number) => number {
  return (progress) => Math.sin(FULL_TURN_RADIANS * progress + phase);
}

/** Zombie sway: a smooth side-to-side loop whose start comes from the model phase. */
function addZombieSway(root: gsap.core.Timeline, scope: HTMLElement): void {
  const amplitude = ZOMBIE_SWAY_AMPLITUDE_PX * UNITS_PER_REFERENCE_PX;
  for (const element of query(scope, "zombie-sway")) {
    const phase = readNumber(element, "data-sway-phase");
    const periodMs = readNumber(element, "data-sway-period-ms");
    if (periodMs <= 0) continue;
    root.to(element, { x: amplitude, duration: seconds(periodMs), ease: sineEase(phase), repeat: -1 }, 0);
  }
}

/**
 * Poltergeist: its smoke swirl turns constantly and its body pulses. The spirit has a face and a
 * tail, so the swirl rotates instead of the whole body. Only the awake figure carries the hooks.
 */
function addPoltergeist(root: gsap.core.Timeline, scope: HTMLElement): void {
  for (const element of query(scope, "poltergeist-swirl")) {
    gsap.set(element, { transformOrigin: ORIGIN_CENTER });
    root.to(element, { rotation: FULL_TURN_DEG, duration: seconds(POLTERGEIST_ROTATION_MS), ease: "none", repeat: -1 }, 0);
  }
  for (const element of query(scope, "poltergeist")) {
    gsap.set(element, { transformOrigin: ORIGIN_CENTER });
    root.to(
      element,
      {
        scale: POLTERGEIST_PULSE_SCALE,
        duration: seconds(POLTERGEIST_PULSE_MS) / HALF,
        ease: "power2.inOut",
        yoyo: true,
        repeat: -1,
      },
      0,
    );
  }
}

/** Fog bars drift sideways, each starting a little later than the previous one. */
function addFog(root: gsap.core.Timeline, scope: HTMLElement): void {
  query(scope, "fog").forEach((element, index) => {
    const direction = index % HALF === 0 ? 1 : -1;
    root.to(
      element,
      {
        x: direction * FOG_DRIFT_DISTANCE,
        duration: seconds(FOG_DRIFT_PERIOD_MS) / HALF,
        ease: "power2.inOut",
        yoyo: true,
        repeat: -1,
      },
      seconds(FOG_DRIFT_STAGGER_MS) * index,
    );
  });
}

/** Fireflies rise, drift and glow, then sink back. */
function addFireflies(root: gsap.core.Timeline, scope: HTMLElement): void {
  query(scope, "firefly").forEach((element, index) => {
    const direction = index % HALF === 0 ? 1 : -1;
    gsap.set(element, { opacity: FIREFLY_MIN_OPACITY });
    root.to(
      element,
      {
        y: -FIREFLY_RISE_DISTANCE,
        x: direction * FIREFLY_DRIFT_DISTANCE,
        opacity: 1,
        duration: seconds(FIREFLY_PERIOD_MS) / HALF,
        ease: "power2.inOut",
        yoyo: true,
        repeat: -1,
      },
      seconds(FIREFLY_STAGGER_MS) * index,
    );
  });
}

/** Bats circle on a small ellipse that passes through their rest position. */
function addBats(root: gsap.core.Timeline, scope: HTMLElement): void {
  query(scope, "bat").forEach((element, index) => {
    const duration = seconds(BAT_PERIOD_MS);
    const delay = seconds(BAT_STAGGER_MS) * index;
    root.to(element, { x: BAT_CIRCLE_RADIUS_X, duration, ease: sineEase(0), repeat: -1 }, delay);
    root.to(
      element,
      { y: -BAT_CIRCLE_RADIUS_Y * HALF, duration, ease: (p: number) => (1 - Math.cos(FULL_TURN_RADIANS * p)) / HALF, repeat: -1 },
      delay,
    );
  });
}

/** Level 2: slow 4s flicker. Level 3: short 200ms flickers with a pause between. */
function addWindowFlicker(root: gsap.core.Timeline, scope: HTMLElement, level: number): void {
  if (level !== FLICKER_LEVEL_SLOW && level !== FLICKER_LEVEL_FAST) return;
  query(scope, "window-flicker").forEach((element, index) => {
    const start = seconds(WINDOW_FLICKER_STAGGER_MS) * index;
    if (level === FLICKER_LEVEL_SLOW) {
      root.to(
        element,
        {
          opacity: WINDOW_FLICKER_L2_MIN_OPACITY,
          duration: seconds(WINDOW_FLICKER_L2_PERIOD_MS) / HALF,
          ease: "power2.inOut",
          yoyo: true,
          repeat: -1,
        },
        start,
      );
      return;
    }
    const half = seconds(WINDOW_FLICKER_L3_MS) / HALF;
    const flicker = gsap.timeline({ repeat: -1, repeatDelay: seconds(WINDOW_FLICKER_L3_PAUSE_MS) });
    flicker.to(element, { opacity: WINDOW_FLICKER_L3_MIN_OPACITY, duration: half, ease: "none" });
    flicker.to(element, { opacity: 1, duration: half, ease: "none" });
    root.add(flicker, start);
  });
}

/**
 * Ghost figure-eight and bob. A parametric ticker callback moves each ghost; it keeps its own
 * clock so removing it while paused never makes the ghosts jump on resume.
 */
function createGhostTicker(scope: HTMLElement): (time: number, deltaMs: number) => void {
  const bobAmplitude = GHOST_BOB_AMPLITUDE_PX * UNITS_PER_REFERENCE_PX;
  const ghosts = query(scope, "ghost-orbit").map((element) => {
    const orbit = {
      cx: readNumber(element, "data-orbit-cx"),
      cy: readNumber(element, "data-orbit-cy"),
      rx: readNumber(element, "data-orbit-rx"),
      ry: readNumber(element, "data-orbit-ry"),
    };
    const phase = readNumber(element, "data-phase");
    return {
      orbit,
      phase,
      rest: getLanePoint(orbit, phase),
      bobPeriodMs: readNumber(element, "data-bob-period-ms"),
      setX: gsap.quickSetter(element, "x", "px") as (value: number) => void,
      setY: gsap.quickSetter(element, "y", "px") as (value: number) => void,
    };
  });
  let elapsedMs = 0;
  return (_time, deltaMs) => {
    elapsedMs += Math.min(deltaMs, MAX_TICK_DELTA_MS);
    for (const ghost of ghosts) {
      const angle = ghost.phase + (FULL_TURN_RADIANS * elapsedMs) / GHOST_ORBIT_PERIOD_MS;
      const point = getLanePoint(ghost.orbit, angle);
      const bob =
        ghost.bobPeriodMs > 0 ? bobAmplitude * Math.sin((FULL_TURN_RADIANS * elapsedMs) / ghost.bobPeriodMs) : 0;
      ghost.setX(point.x - ghost.rest.x);
      ghost.setY(point.y - ghost.rest.y + bob);
    }
  };
}

/** Keeps decorative loops running only while the scene is on screen and the tab is visible. */
function watchActivity(
  scope: HTMLElement,
  onChange: (active: boolean) => void,
): () => void {
  let onScreen = true;
  const notify = () => onChange(onScreen && !document.hidden);
  const handleVisibility = () => notify();
  document.addEventListener("visibilitychange", handleVisibility);
  let observer: IntersectionObserver | null = null;
  if (typeof IntersectionObserver !== "undefined") {
    observer = new IntersectionObserver(
      (entries) => {
        const latest = entries[entries.length - 1];
        if (!latest) return;
        onScreen = latest.isIntersecting;
        notify();
      },
      { threshold: OBSERVER_THRESHOLD },
    );
    observer.observe(scope);
  }
  notify();
  return () => {
    document.removeEventListener("visibilitychange", handleVisibility);
    observer?.disconnect();
  };
}

/**
 * Lazy GSAP decoration of the already painted scene. Every tween is a child of one `ambientRoot`
 * timeline; pausing touches only that timeline and the ghost ticker callback, never
 * `gsap.globalTimeline`, so a Moment that is playing keeps going. Only transform and opacity change.
 */
export function AmbientMotion({ scope, signature }: AmbientMotionProps) {
  useGSAP(
    () => {
      const container = scope.current;
      if (!container) return undefined;
      const level = Number(container.getAttribute("data-level"));
      const ambientRoot = gsap.timeline();
      addZombieSway(ambientRoot, container);
      addPoltergeist(ambientRoot, container);
      addFog(ambientRoot, container);
      addFireflies(ambientRoot, container);
      addBats(ambientRoot, container);
      addWindowFlicker(ambientRoot, container, level);

      const tick = createGhostTicker(container);
      let ticking = false;
      const stopWatching = watchActivity(container, (active) => {
        if (active) {
          ambientRoot.resume();
          if (!ticking) gsap.ticker.add(tick);
          ticking = true;
        } else {
          ambientRoot.pause();
          if (ticking) gsap.ticker.remove(tick);
          ticking = false;
        }
      });

      return () => {
        stopWatching();
        if (ticking) gsap.ticker.remove(tick);
        ticking = false;
        ambientRoot.kill();
      };
    },
    { scope, dependencies: [signature], revertOnUpdate: true },
  );
  return null;
}
