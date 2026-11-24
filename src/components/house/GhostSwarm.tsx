import { memo } from "react";
import type { SceneGhost } from "@/lib/scene";
import { TOKEN, isSameData } from "./houseGeometry";

export type GhostSwarmProps = {
  ghosts: readonly SceneGhost[];
};

/** Local figure, centered on the origin and scaled by the ghost size. */
const WIDTH_RATIO = 0.8;
const BODY_OPACITY = 0.9;
const HALO_OPACITY = 0.25;
const HALO_SCALE = 1.22;
const RIM_OPACITY = 0.45;
const RIM_WIDTH = 1.2;
const EYE_OFFSET = 0.15;
const EYE_Y = -0.12;
const EYE_RX = 0.085;
const EYE_RY = 0.12;
const SHINE_RADIUS = 0.028;
const MOUTH = { cy: 0.07, rx: 0.05, ry: 0.065 } as const;

/**
 * Dome head with a wavy hem that flows into a tail curling to the right, in a unit box
 * (-0.5..0.5 on x and y). Distinct from the Poltergeist: small, smooth, two round eyes.
 */
const GHOST_PATH =
  "M0 -0.5 C0.30 -0.5 0.46 -0.26 0.46 0.02 C0.46 0.18 0.44 0.28 0.40 0.34 " +
  "C0.44 0.42 0.52 0.44 0.56 0.40 C0.52 0.52 0.36 0.54 0.28 0.46 " +
  "C0.20 0.52 0.12 0.40 0.04 0.46 C-0.04 0.52 -0.12 0.40 -0.20 0.46 " +
  "C-0.28 0.52 -0.36 0.42 -0.42 0.34 C-0.46 0.24 -0.46 0.14 -0.46 0.02 " +
  "C-0.46 -0.26 -0.30 -0.5 0 -0.5Z";

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
          <path
            d={GHOST_PATH}
            fill="none"
            stroke={TOKEN.ink}
            strokeWidth={RIM_WIDTH}
            vectorEffect="non-scaling-stroke"
            opacity={RIM_OPACITY}
          />
          {[-EYE_OFFSET, EYE_OFFSET].map((cx) => (
            <g key={cx}>
              <ellipse cx={cx} cy={EYE_Y} rx={EYE_RX} ry={EYE_RY} fill={TOKEN.void} />
              <circle cx={cx + EYE_RX * 0.35} cy={EYE_Y - EYE_RY * 0.4} r={SHINE_RADIUS} fill={TOKEN.ink} />
            </g>
          ))}
          <ellipse cx={0} cy={MOUTH.cy} rx={MOUTH.rx} ry={MOUTH.ry} fill={TOKEN.void} />
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
