import { memo } from "react";
import type { SceneGhost } from "@/lib/scene";
import { TOKEN, isSameData } from "./houseGeometry";

export type GhostSwarmProps = {
  ghosts: readonly SceneGhost[];
};

/** Local ovoid, centered on the origin and scaled by the ghost size. */
const WIDTH_RATIO = 0.8;
const BODY_OPACITY = 0.75;
const HALO_OPACITY = 0.2;
const HALO_SCALE = 1.25;
const EYE_OFFSET = 0.16;
const EYE_Y = -0.12;
const EYE_RADIUS = 0.06;
/** Ovoid with a wavy hem, in a unit box (-0.5..0.5 on x, -0.5..0.5 on y). */
const GHOST_PATH =
  "M0 -0.5 C0.28 -0.5 0.5 -0.28 0.5 0 V0.4 L0.33 0.3 L0.17 0.5 L0 0.3 L-0.17 0.5 L-0.33 0.3 L-0.5 0.4 V0 C-0.5 -0.28 -0.28 -0.5 0 -0.5Z";

type GhostFigureProps = { ghost: SceneGhost };

function GhostFigureBase({ ghost }: GhostFigureProps) {
  const { rest, sizeUnits, orbit } = ghost;
  const width = sizeUnits * WIDTH_RATIO;
  return (
    <g data-part="ghost" data-id={ghost.id} transform={`translate(${rest.x} ${rest.y})`}>
      <g
        data-ambient="ghost-orbit"
        data-ambient-id={ghost.id}
        data-phase={ghost.phase}
        data-bob-period-ms={ghost.bobPeriodMs}
        data-lane={ghost.lane}
        data-orbit-cx={orbit.cx}
        data-orbit-cy={orbit.cy}
        data-orbit-rx={orbit.rx}
        data-orbit-ry={orbit.ry}
      >
        <g transform={`scale(${width} ${sizeUnits})`}>
          <g data-part="ghost-halo" transform={`scale(${HALO_SCALE})`}>
            <path d={GHOST_PATH} fill={TOKEN.ghost} opacity={HALO_OPACITY} />
          </g>
          <path d={GHOST_PATH} fill={TOKEN.ghost} opacity={BODY_OPACITY} />
          <ellipse cx={-EYE_OFFSET} cy={EYE_Y} rx={EYE_RADIUS} ry={EYE_RADIUS * WIDTH_RATIO} fill={TOKEN.void} />
          <ellipse cx={EYE_OFFSET} cy={EYE_Y} rx={EYE_RADIUS} ry={EYE_RADIUS * WIDTH_RATIO} fill={TOKEN.void} />
        </g>
      </g>
    </g>
  );
}

const GhostFigure = memo(GhostFigureBase, isSameData);

/** Ghosts at their rest position. The model holds none while a Poltergeist exists. */
export function GhostSwarm({ ghosts }: GhostSwarmProps) {
  return (
    <g data-part="ghosts">
      {ghosts.map((ghost) => (
        <GhostFigure key={ghost.id} ghost={ghost} />
      ))}
    </g>
  );
}
