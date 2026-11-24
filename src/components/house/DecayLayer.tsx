import { SCENE_TEAL_LIGHT } from "@/lib/scene";
import type { SceneModel } from "@/lib/scene";
import { CRACK_PATHS, PLASTER_HOLE, STAINS, TOKEN, WALLS, getStructureTransform } from "./houseGeometry";

export type DecayLayerProps = {
  model: SceneModel;
};

const CRACK_WIDTH = 2.5;
const CRACK_OPACITY = 0.8;
const STAIN_OPACITY = 0.35;
const HOLE_OPACITY = 0.9;

/** Cracks, stains, plaster hole and exposed beams of the current level. */
export function DecayLayer({ model }: DecayLayerProps) {
  const { features } = model;
  const cracks = CRACK_PATHS.slice(0, features.crackCount);
  const stains = STAINS.slice(0, features.stainCount);
  return (
    <g data-part="decay" transform={getStructureTransform(features)}>
      {stains.map((stain, index) => (
        <ellipse
          key={`stain-${index}`}
          data-part={`stain:${index}`}
          cx={stain.cx}
          cy={stain.cy}
          rx={stain.rx}
          ry={stain.ry}
          fill={TOKEN.void}
          opacity={STAIN_OPACITY}
        />
      ))}
      {cracks.map((d, index) => (
        <path
          key={`crack-${index}`}
          data-part={`crack:${index}`}
          d={d}
          fill="none"
          stroke={TOKEN.void}
          strokeWidth={CRACK_WIDTH}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={CRACK_OPACITY}
        />
      ))}
      {features.plasterHole ? (
        <polygon data-part="plaster-hole" points={PLASTER_HOLE} fill={TOKEN.void} opacity={HOLE_OPACITY} />
      ) : null}
      {features.structure === "collapsing" ? (
        <g data-part="exposed-beams" fill={SCENE_TEAL_LIGHT}>
          <rect x={WALLS.x - 4} y={WALLS.y - 4} width={64} height={6} transform={`rotate(-14 ${WALLS.x - 4} ${WALLS.y - 1})`} />
          <rect x={WALLS.x + WALLS.w - 56} y={WALLS.y + 2} width={64} height={6} transform={`rotate(12 ${WALLS.x + WALLS.w + 8} ${WALLS.y + 5})`} />
          <rect x={WALLS.x + 150} y={WALLS.y + 40} width={6} height={44} transform="rotate(-8 400 230)" />
        </g>
      ) : null}
    </g>
  );
}
