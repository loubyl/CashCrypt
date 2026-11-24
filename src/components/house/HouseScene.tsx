"use client";
import dynamic from "next/dynamic";
import { useId, useRef } from "react";
import { useElementWidth } from "@/hooks/useElementWidth";
import { useReducedMotionPreference } from "@/hooks/useReducedMotionPreference";
import { VIEWBOX_HEIGHT, VIEWBOX_WIDTH } from "@/lib/scene";
import type { SceneModel } from "@/lib/scene";
import { DecayLayer } from "./DecayLayer";
import { GhostSwarm } from "./GhostSwarm";
import { GraveyardRow } from "./GraveyardRow";
import { ForegroundLayer } from "./ForegroundLayer";
import { HouseBase } from "./HouseBase";
import { HALO_BLUR, MOON_BLUR, makeFilterIds } from "./houseGeometry";
import { Poltergeist } from "./Poltergeist";
import { SceneLabels } from "./SceneLabels";
import { WindowsLayer } from "./WindowsLayer";
import { ZombieBasement } from "./ZombieBasement";

export type HouseSceneProps = {
  model: SceneModel;
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
export function HouseScene({ model, className }: HouseSceneProps) {
  const filterIds = makeFilterIds(useId());
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
        </defs>
        <HouseBase model={model} filterIds={filterIds} />
        <DecayLayer model={model} />
        <ZombieBasement zombies={model.zombies} />
        <GraveyardRow tombstones={model.tombstones} />
        <GhostSwarm ghosts={model.ghosts} />
        <ForegroundLayer model={model} />
        <WindowsLayer model={model} filterIds={filterIds} />
        <Poltergeist poltergeist={model.poltergeist} />
      </svg>
      <SceneLabels model={model} sceneWidthPx={sceneWidthPx} />
      {motionEnabled ? <AmbientMotion scope={containerRef} signature={getAmbientSignature(model)} /> : null}
    </div>
  );
}
