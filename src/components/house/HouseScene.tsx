import { useId } from "react";
import { VIEWBOX_HEIGHT, VIEWBOX_WIDTH } from "@/lib/scene";
import type { SceneModel } from "@/lib/scene";
import { DecayLayer } from "./DecayLayer";
import { ForegroundLayer } from "./ForegroundLayer";
import { HouseBase } from "./HouseBase";
import { HALO_BLUR, MOON_BLUR, makeFilterIds } from "./houseGeometry";
import { WindowsLayer } from "./WindowsLayer";

export type HouseSceneProps = {
  model: SceneModel;
  /** Layout utilities only. */
  className?: string;
};

const SCENE_ASPECT_RATIO = "4 / 3";

/** Static haunted house: one SVG painted from the scene model, with no animation library. */
export function HouseScene({ model, className }: HouseSceneProps) {
  const filterIds = makeFilterIds(useId());
  const classes = ["@container relative block w-full overflow-hidden rounded-lg bg-surface-void", className ?? ""]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      role="img"
      aria-label={model.summary}
      className={classes}
      style={{ aspectRatio: SCENE_ASPECT_RATIO }}
      data-part="scene"
      data-level={model.level}
      data-lighting={model.lighting}
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
        <ForegroundLayer model={model} />
        <WindowsLayer model={model} filterIds={filterIds} />
      </svg>
    </div>
  );
}
