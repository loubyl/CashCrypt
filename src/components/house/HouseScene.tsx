"use client";
import dynamic from "next/dynamic";
import { useId, useLayoutEffect, useRef } from "react";
import { useElementWidth } from "@/hooks/useElementWidth";
import { useReducedMotionPreference } from "@/hooks/useReducedMotionPreference";
import { SCENE_TEAL_LIGHT, VIEWBOX_HEIGHT, VIEWBOX_WIDTH } from "@/lib/scene";
import type { SceneModel } from "@/lib/scene";
import { DecayLayer } from "./DecayLayer";
import { GhostSwarm } from "./GhostSwarm";
import { GraveyardRow } from "./GraveyardRow";
import { ForegroundLayer } from "./ForegroundLayer";
import { HouseBase } from "./HouseBase";
import { HALO_BLUR, MOON_BLUR, SHINGLE_TILE, makeFilterIds } from "./houseGeometry";
import { Poltergeist } from "./Poltergeist";
import { SceneLabels } from "./SceneLabels";
import { WindowsLayer } from "./WindowsLayer";
import { ZombieBasement } from "./ZombieBasement";

export type HouseSceneProps = {
  /** What is drawn: the live model, or the frozen one while a Moment hold is active. */
  model: SceneModel;
  /** True while `model` is the frozen model of a hold. */
  held?: boolean;
  /** Called in a layout effect when the hold is released, in the same commit as the live model. */
  onRelease?: () => void;
  /** Layout utilities only. */
  className?: string;
};

const SCENE_ASPECT_RATIO = "4 / 3";

/** GSAP lives behind this boundary: the module is requested only when motion is enabled. */
const AmbientMotion = dynamic(() => import("./AmbientMotion").then((module) => module.AmbientMotion), {
  ssr: false,
});

/** Changes whenever the set of animated elements changes, so the loops rebuild only then. */
function getAmbientSignature(model: SceneModel): string {
  return [
    model.level,
    model.poltergeist?.state ?? "none",
    model.zombies.map((zombie) => zombie.id).join(","),
    model.ghosts.map((ghost) => ghost.id).join(","),
  ].join("|");
}

/** Static haunted house: one SVG painted from the scene model, with no animation library. */
export function HouseScene({ model, held = false, onRelease, className }: HouseSceneProps) {
  const filterIds = makeFilterIds(useId());
  const wasHeldRef = useRef(false);
  useLayoutEffect(() => {
    if (wasHeldRef.current && !held) onRelease?.();
    wasHeldRef.current = held;
  }, [held, onRelease]);
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneWidthPx = useElementWidth(containerRef);
  const reduced = useReducedMotionPreference();
  const motionEnabled = reduced === false;
  const classes = ["@container group/scene relative block w-full overflow-hidden rounded-lg bg-surface-void", className ?? ""]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      ref={containerRef}
      role="img"
      aria-label={model.summary}
      className={classes}
      style={{ aspectRatio: SCENE_ASPECT_RATIO }}
      data-part="scene"
      data-level={model.level}
      data-lighting={model.lighting}
      data-motion={reduced ? "reduced" : undefined}
    >
      <svg
        viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
        preserveAspectRatio="xMidYMid meet"
        aria-hidden="true"
        focusable="false"
        className="block h-full w-full"
      >
        <defs>
          <filter id={filterIds.halo} x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation={HALO_BLUR} />
          </filter>
          <filter id={filterIds.moon} x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation={MOON_BLUR} />
          </filter>
          {/* Scalloped shingle rows: two offset rows of downward arcs per tile. */}
          <pattern
            id={filterIds.shingles}
            patternUnits="userSpaceOnUse"
            width={SHINGLE_TILE.w}
            height={SHINGLE_TILE.h * 2}
          >
            <path
              d={`M0 ${SHINGLE_TILE.h} A${SHINGLE_TILE.w / 2} ${SHINGLE_TILE.h * 0.8} 0 0 0 ${SHINGLE_TILE.w} ${SHINGLE_TILE.h} M${-SHINGLE_TILE.w / 2} ${SHINGLE_TILE.h * 2} A${SHINGLE_TILE.w / 2} ${SHINGLE_TILE.h * 0.8} 0 0 0 ${SHINGLE_TILE.w / 2} ${SHINGLE_TILE.h * 2} M${SHINGLE_TILE.w / 2} ${SHINGLE_TILE.h * 2} A${SHINGLE_TILE.w / 2} ${SHINGLE_TILE.h * 0.8} 0 0 0 ${SHINGLE_TILE.w * 1.5} ${SHINGLE_TILE.h * 2}`}
              fill="none"
              stroke={SCENE_TEAL_LIGHT}
              strokeWidth={1.4}
            />
          </pattern>
        </defs>
        <HouseBase model={model} filterIds={filterIds} />
        <DecayLayer model={model} />
        <ZombieBasement zombies={model.zombies} />
        <GraveyardRow tombstones={model.tombstones} />
        <ForegroundLayer model={model} />
        <WindowsLayer model={model} filterIds={filterIds} />
        {/* Ghosts fly in front of the house, so they are drawn above the windows. */}
        <GhostSwarm ghosts={model.ghosts} />
        <Poltergeist poltergeist={model.poltergeist} filterIds={filterIds} />
      </svg>
      <SceneLabels model={model} sceneWidthPx={sceneWidthPx} />
      {motionEnabled ? <AmbientMotion scope={containerRef} signature={getAmbientSignature(model)} /> : null}
    </div>
  );
}
