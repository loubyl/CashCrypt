import { memo } from "react";
import { SCENE_STONE, SCENE_WALL } from "@/lib/scene";
import type { SceneTombstone } from "@/lib/scene";
import { isSameData } from "./houseGeometry";

export type GraveyardRowProps = {
  tombstones: readonly SceneTombstone[];
};

/** Local tombstone drawing in a 64 by 56 box: rounded slab, base mound and an engraved cross. */
const SLAB = { x: 10, y: 0, w: 44, h: 50, r: 20 } as const;
const MOUND = { cx: 32, cy: 52, rx: 30, ry: 5 } as const;
const CROSS_VERTICAL = { x1: 32, y1: 12, x2: 32, y2: 32 } as const;
const CROSS_HORIZONTAL = { x1: 24, y1: 19, x2: 40, y2: 19 } as const;
const CROSS_STROKE = 3;
const CROSS_OPACITY = 0.7;

type TombstoneFigureProps = { tombstone: SceneTombstone };

function TombstoneFigureBase({ tombstone }: TombstoneFigureProps) {
  const { box } = tombstone;
  const slabPath = `M${SLAB.x} ${SLAB.h} V${SLAB.r} A${SLAB.r} ${SLAB.r} 0 0 1 ${SLAB.x + SLAB.w} ${SLAB.r} V${SLAB.h}Z`;
  return (
    <g data-part="tombstone" data-id={tombstone.id} transform={`translate(${box.x} ${box.y})`}>
      <ellipse cx={MOUND.cx} cy={MOUND.cy} rx={MOUND.rx} ry={MOUND.ry} fill={SCENE_STONE} />
      <path d={slabPath} fill={SCENE_WALL} />
      <g stroke={SCENE_STONE} strokeWidth={CROSS_STROKE} strokeLinecap="round" opacity={CROSS_OPACITY}>
        <line {...CROSS_VERTICAL} />
        <line {...CROSS_HORIZONTAL} />
      </g>
    </g>
  );
}

const TombstoneFigure = memo(TombstoneFigureBase, isSameData);

/** Tombstones in the graveyard band. An empty graveyard draws no figure and no text; labels are an HTML overlay. */
export function GraveyardRow({ tombstones }: GraveyardRowProps) {
  return (
    <g data-part="graveyard">
      {tombstones.map((tombstone) => (
        <TombstoneFigure key={tombstone.id} tombstone={tombstone} />
      ))}
    </g>
  );
}
