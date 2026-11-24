import { createElement, Fragment } from "react";
import type { ReactElement } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { formatCentsShort } from "@/lib/utils/cents";
import {
  MAX_VISIBLE_TOMBSTONES,
  MOMENT_BEAT_MIN_MS,
  SHOVEL_HEIGHT,
  SHOVEL_STRIKE_OFFSET,
  TOMBSTONE_SLOT_UNITS,
  VIEWBOX_WIDTH,
  ZOMBIE_SINK_CLIP,
  ZOMBIE_SINK_SCALE,
} from "@/lib/scene";
import type { Box, Point, SceneModel, SceneTombstone } from "@/lib/scene";
import {
  getShovelStrikePoint,
  getSinkClip,
  getTombstoneClip,
  getTombstoneRiseBoxes,
  shovelArc,
} from "@/lib/scene/momentGeometry";
import type { MomentOptions, MomentTarget } from "./momentLoader";
import { ART_PART, NameLabel, ShovelArt, TombstoneArt } from "./MomentArt";

type CancelRequest = Extract<MomentOptions["request"], { kind: "cancel" }>;

const MS_PER_S = 1000;
const HALF = 0.5;
const SVG_NS = "http://www.w3.org/2000/svg";
const SINK_CLIP_ID = "moment-sink-clip";

// Shape of the shovel figure (a 40 by 120 drawing) and of the swing.
const SHOVEL_ASPECT = 3;
const SHOVEL_START_TILT_DEG = 70;
const SHOVEL_BONK_TILT_DEG = -16;
const SHOVEL_FADE_IN_S = 0.08;
const SHOVEL_BONK_DOWN_S = 0.08;
const SHOVEL_BONK_UP_S = 0.1;
const SHOVEL_FADE_OUT_S = 0.12;

// Timeline phases as shares of the Moment duration; the bonk beat keeps its own minimum length.
const ARC_SHARE = 500 / 1400;
const SINK_SHARE = 300 / 1400;
const TOMBSTONE_FADE_IN_S = 0.1;
const NAME_FADE_S = 0.1;
const WOBBLE_DEG = 6;
const WOBBLE_STEPS_S = [0.07, 0.1, 0.07] as const;
const SINK_SCALE_SHARE = 0.4;
const SINK_ZONE_PAD = 4;

// Layout of the overlay pieces.
const NAME_GAP_UNITS = 6;
const NAME_LABEL_RISE_PX = 22;
const TOMBSTONE_LABEL_TOP_UNITS = 22;

// Waiting for the live model to show the new tombstone (the data settles shortly after the click).
const TOMBSTONE_POLL_MS = 50;
const TOMBSTONE_WAIT_MS = 300;

type Geometry = { originX: number; originY: number; scale: number };

function readGeometry(target: MomentTarget): Geometry {
  const scene = target.scene.getBoundingClientRect();
  const layer = target.layer.getBoundingClientRect();
  return {
    originX: scene.left - layer.left,
    originY: scene.top - layer.top,
    scale: scene.width / VIEWBOX_WIDTH,
  };
}

function toPx(geometry: Geometry, point: Point): Point {
  return { x: geometry.originX + point.x * geometry.scale, y: geometry.originY + point.y * geometry.scale };
}

/** A drawn zombie, or null when its figure is not in the Scene (overflow, or already gone). */
function findZombieElement(scene: HTMLElement, id: string): SVGGraphicsElement | null {
  for (const element of scene.querySelectorAll<SVGGraphicsElement>('[data-part="zombie"]')) {
    if (element.getAttribute("data-id") === id) return element;
  }
  return null;
}

function readBox(element: SVGGraphicsElement): Box | null {
  if (typeof element.getBBox !== "function") return null;
  const bbox = element.getBBox();
  return { x: bbox.x, y: bbox.y, w: bbox.width, h: bbox.height };
}

function findOverflowMarker(scene: HTMLElement): HTMLElement | null {
  return scene.querySelector<HTMLElement>('[data-part="overflow-marker"][data-kind="zombies"]');
}

function parseMarkerCount(text: string): number | null {
  const match = /^\+(\d+)$/.exec(text.trim());
  return match ? Number(match[1]) : null;
}

function findTombstone(model: SceneModel, id: string): SceneTombstone | null {
  return model.tombstones.find((tombstone) => tombstone.id === id) ?? null;
}

/** Waits (bounded) until the live model draws the new tombstone; resolves at once when it cannot appear. */
async function waitForTombstone(target: MomentTarget, id: string, signal: AbortSignal): Promise<SceneTombstone | null> {
  const canAppear = (model: SceneModel): boolean =>
    model.overflow.tombstones === 0 && model.tombstones.length < MAX_VISIBLE_TOMBSTONES;
  let waited = 0;
  for (;;) {
    const model = target.getLiveModel();
    const found = findTombstone(model, id);
    if (found || signal.aborted || !canAppear(model) || waited >= TOMBSTONE_WAIT_MS) return found;
    await new Promise<void>((resolve) => setTimeout(resolve, TOMBSTONE_POLL_MS));
    waited += TOMBSTONE_POLL_MS;
  }
}

type SinkSetup = {
  element: SVGGraphicsElement;
  box: Box;
  /** Distance in ViewBox units that hides the scaled figure under the bottom of the sink clip. */
  sinkDistance: number;
  svgOrigin: string;
};

function planSink(scene: HTMLElement, id: string): SinkSetup | null {
  const element = findZombieElement(scene, id);
  const box = element ? readBox(element) : null;
  if (!element || !box) return null;
  const bottom = box.y + box.h;
  const scaledTop = bottom - box.h * ZOMBIE_SINK_SCALE;
  const clipBottom = ZOMBIE_SINK_CLIP.y + ZOMBIE_SINK_CLIP.h;
  return {
    element,
    box,
    sinkDistance: Math.max(0, clipBottom - scaledTop + SINK_ZONE_PAD),
    svgOrigin: `${box.x + box.w * HALF} ${bottom}`,
  };
}

/** Clips the zombie row to the sink clip so the sinking figure disappears under the ground line. */
function installSinkClip(zombieElement: SVGGraphicsElement): () => void {
  const group = zombieElement.parentElement;
  const svg = zombieElement.ownerSVGElement;
  if (!group || !svg) return () => undefined;
  const clip = getSinkClip();
  const clipPath = document.createElementNS(SVG_NS, "clipPath");
  clipPath.setAttribute("id", SINK_CLIP_ID);
  const rect = document.createElementNS(SVG_NS, "rect");
  rect.setAttribute("x", String(clip.x));
  rect.setAttribute("y", String(clip.y));
  rect.setAttribute("width", String(clip.w));
  rect.setAttribute("height", String(clip.h));
  clipPath.appendChild(rect);
  svg.appendChild(clipPath);
  const previous = group.getAttribute("clip-path");
  group.setAttribute("clip-path", `url(#${SINK_CLIP_ID})`);
  return () => {
    if (previous === null) group.removeAttribute("clip-path");
    else group.setAttribute("clip-path", previous);
    clipPath.remove();
  };
}

type ArtPlan = {
  element: ReactElement;
  shovelSize: { w: number; h: number };
  nameAnchor: { left: number; top: number; alignEnd: boolean };
};

function pickNameAnchor(
  geometry: Geometry,
  sink: SinkSetup | null,
  marker: HTMLElement | null,
  layerTop: number,
  layerLeft: number,
): ArtPlan["nameAnchor"] {
  const gap = NAME_GAP_UNITS * geometry.scale;
  const sceneMiddle = geometry.originX + VIEWBOX_WIDTH * geometry.scale * HALF;
  if (sink) {
    const right = toPx(geometry, { x: sink.box.x + sink.box.w, y: sink.box.y });
    const left = toPx(geometry, { x: sink.box.x, y: sink.box.y });
    const alignEnd = right.x > sceneMiddle;
    return { left: alignEnd ? left.x - gap : right.x + gap, top: left.y, alignEnd };
  }
  if (marker) {
    const rect = marker.getBoundingClientRect();
    return { left: rect.left - layerLeft - gap, top: rect.top - layerTop - NAME_LABEL_RISE_PX, alignEnd: true };
  }
  return { left: sceneMiddle, top: geometry.originY, alignEnd: false };
}

function buildArt(
  request: CancelRequest,
  geometry: Geometry,
  tombstone: SceneTombstone | null,
  nameAnchor: ArtPlan["nameAnchor"],
): { element: ReactElement; shovelSize: { w: number; h: number } } {
  const heightPx = SHOVEL_HEIGHT * geometry.scale;
  const shovelSize = { w: heightPx / SHOVEL_ASPECT, h: heightPx };
  const children: ReactElement[] = [
    createElement(ShovelArt, { key: "shovel", widthPx: shovelSize.w, heightPx: shovelSize.h }),
    createElement(NameLabel, {
      key: "name",
      name: request.name,
      leftPx: nameAnchor.left,
      topPx: nameAnchor.top,
      alignEnd: nameAnchor.alignEnd,
    }),
  ];
  if (tombstone) {
    const clip = getTombstoneClip();
    const clipOrigin = toPx(geometry, { x: clip.x, y: clip.y });
    children.push(
      createElement(TombstoneArt, {
        key: "tombstone",
        clip: { leftPx: clipOrigin.x, topPx: clipOrigin.y, widthPx: clip.w * geometry.scale, heightPx: clip.h * geometry.scale },
        box: {
          leftPx: (tombstone.box.x - clip.x) * geometry.scale,
          topPx: (tombstone.box.y - clip.y) * geometry.scale,
          widthPx: tombstone.box.w * geometry.scale,
          heightPx: tombstone.box.h * geometry.scale,
        },
        labelWidthPx: TOMBSTONE_SLOT_UNITS * geometry.scale,
        labelTopPx: TOMBSTONE_LABEL_TOP_UNITS * geometry.scale,
        ripText: `R.I.P. ${formatCentsShort(request.monthlyCents)}/mo`,
      }),
    );
  }
  return { element: createElement(Fragment, null, ...children), shovelSize };
}

function queryArt<T extends Element>(container: HTMLElement, part: string): T | null {
  return container.querySelector<T>(`[data-moment="${part}"]`);
}

/**
 * Cancel-subscription Moment: shovel arc, bonk beat with the name, zombie wobble and sink,
 * tombstone rise. Reduced motion never reaches this file (the loader handles it without GSAP).
 */
export async function playShovelMoment(target: MomentTarget, options: MomentOptions): Promise<void> {
  const { request, signal, durationMs } = options;
  if (request.kind !== "cancel" || signal.aborted) return;

  const tombstoneDraft = await waitForTombstone(target, request.subscriptionId, signal);
  if (signal.aborted) return;
  const [{ gsap }, { MotionPathPlugin }] = await Promise.all([import("gsap"), import("gsap/MotionPathPlugin")]);
  if (signal.aborted) return;
  gsap.registerPlugin(MotionPathPlugin);

  const geometry = readGeometry(target);
  const layerRect = target.layer.getBoundingClientRect();
  const sink = request.target === "zombie" ? planSink(target.scene, request.subscriptionId) : null;
  const marker = sink ? null : findOverflowMarker(target.scene);
  const nameAnchor = pickNameAnchor(geometry, sink, marker, layerRect.top, layerRect.left);
  const art = buildArt(request, geometry, tombstoneDraft, nameAnchor);

  const container = target.layer.ownerDocument.createElement("div");
  container.style.position = "absolute";
  container.style.inset = "0";
  target.layer.appendChild(container);
  const root = createRoot(container);
  flushSync(() => root.render(art.element));

  const removeSinkClip = sink ? installSinkClip(sink.element) : () => undefined;
  const markerText = marker?.firstChild ?? null;
  const markerOriginal = markerText?.nodeValue ?? null;
  let markerWritten: string | null = null;
  const restoreMarker = (): void => {
    // React owns this text node: restore only if it still holds the value this Moment wrote.
    if (markerText && markerOriginal !== null && markerWritten !== null && markerText.nodeValue === markerWritten) {
      markerText.nodeValue = markerOriginal;
    }
    if (marker) marker.style.opacity = "";
  };
  const decrementMarker = (): void => {
    if (!marker || !markerText || markerOriginal === null) return;
    const count = parseMarkerCount(markerOriginal);
    if (count === null) return;
    markerWritten = `+${Math.max(0, count - 1)}`;
    markerText.nodeValue = markerWritten;
    if (count <= 1) marker.style.opacity = "0";
  };

  const shovel = queryArt<SVGElement>(container, ART_PART.shovel);
  const nameLabel = queryArt<HTMLElement>(container, ART_PART.name);
  const tombstone = queryArt<HTMLElement>(container, ART_PART.tombstone);

  const arc = shovelArc(
    sink
      ? { x: sink.box.x + sink.box.w * HALF, y: sink.box.y - SHOVEL_STRIKE_OFFSET }
      : getShovelStrikePoint(target.getLiveModel(), request),
  );
  const path = arc.samples.map((sample) => {
    const px = toPx(geometry, sample);
    return { x: px.x - art.shovelSize.w * HALF, y: px.y - art.shovelSize.h * HALF };
  });

  const arcS = (ARC_SHARE * durationMs) / MS_PER_S;
  const beatS = MOMENT_BEAT_MIN_MS / MS_PER_S;
  const sinkS = (SINK_SHARE * durationMs) / MS_PER_S;
  const bonkAt = arcS;
  const sinkAt = bonkAt + beatS;
  const tombstoneAt = sinkAt + sinkS;
  const endS = Math.max(durationMs / MS_PER_S, tombstoneAt);
  const rise = tombstoneDraft ? getTombstoneRiseBoxes(tombstoneDraft.box) : null;
  const riseDistancePx = rise ? (rise.start.y - rise.final.y) * geometry.scale : 0;

  const ctx = gsap.context(() => undefined, target.scene);
  const cleanup = (): void => {
    ctx.revert();
    removeSinkClip();
    restoreMarker();
    root.unmount();
    container.remove();
  };
  target.registerCleanup(cleanup);

  return new Promise<void>((resolve) => {
    let timeline: gsap.core.Timeline | null = null;
    const finish = (): void => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    };
    const onAbort = (): void => {
      timeline?.progress(1, false);
      finish();
    };

    ctx.add(() => {
      const tl = gsap.timeline({ onComplete: finish });
      timeline = tl;

      if (shovel) {
        gsap.set(shovel, { x: path[0]?.x ?? 0, y: path[0]?.y ?? 0, rotation: SHOVEL_START_TILT_DEG, opacity: 0, transformOrigin: "50% 50%" });
        tl.to(shovel, { opacity: 1, duration: SHOVEL_FADE_IN_S, ease: "none" }, 0);
        tl.to(shovel, { motionPath: { path, type: "thru", curviness: 0 }, duration: arcS, ease: "power2.inOut" }, 0);
        tl.to(shovel, { rotation: 0, duration: arcS, ease: "power2.inOut" }, 0);
        tl.to(shovel, { rotation: SHOVEL_BONK_TILT_DEG, duration: SHOVEL_BONK_DOWN_S, ease: "power2.out" }, bonkAt);
        tl.to(shovel, { rotation: 0, duration: SHOVEL_BONK_UP_S, ease: "power2.inOut" }, bonkAt + SHOVEL_BONK_DOWN_S);
        tl.to(shovel, { opacity: 0, duration: SHOVEL_FADE_OUT_S, ease: "none" }, sinkAt);
      }

      if (nameLabel) {
        tl.to(nameLabel, { opacity: 1, duration: NAME_FADE_S, ease: "power2.out" }, bonkAt);
        tl.to(nameLabel, { opacity: 0, duration: NAME_FADE_S, ease: "power2.in" }, sinkAt);
      }

      if (sink) {
        gsap.set(sink.element, { svgOrigin: sink.svgOrigin });
        let wobbleAt = bonkAt;
        WOBBLE_STEPS_S.forEach((duration, index) => {
          const rotation = index === 0 ? WOBBLE_DEG : index === 1 ? -WOBBLE_DEG : 0;
          tl.to(sink.element, { rotation, duration, ease: "power2.inOut" }, wobbleAt);
          wobbleAt += duration;
        });
        tl.to(sink.element, { scale: ZOMBIE_SINK_SCALE, duration: sinkS * SINK_SCALE_SHARE, ease: "power2.out" }, sinkAt);
        tl.to(sink.element, { y: sink.sinkDistance, opacity: 0, duration: sinkS, ease: "power2.in" }, sinkAt);
      }

      if (marker) tl.call(decrementMarker, [], sinkAt);

      if (tombstone) {
        gsap.set(tombstone, { y: riseDistancePx, opacity: 0 });
        tl.to(tombstone, { opacity: 1, duration: TOMBSTONE_FADE_IN_S, ease: "none" }, tombstoneAt);
        tl.to(tombstone, { y: 0, duration: Math.max(endS - tombstoneAt, TOMBSTONE_FADE_IN_S), ease: "power2.out" }, tombstoneAt);
      }
    });

    if (signal.aborted) {
      onAbort();
      return;
    }
    signal.addEventListener("abort", onAbort, { once: true });
  });
}
