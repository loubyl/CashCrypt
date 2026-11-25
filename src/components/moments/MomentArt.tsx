import {
  MIN_LABEL_PX,
  SCENE_DIRT,
  SCENE_SHOVEL_OUTLINE,
  SCENE_SHOVEL_STEEL,
  SCENE_SHOVEL_STEEL_SHADE,
  SCENE_SHOVEL_WOOD,
  SCENE_STONE,
  SCENE_WALL,
  SHOVEL_VIEW_H,
  SHOVEL_VIEW_W,
} from "@/lib/scene";

// Static Moment art. It never imports GSAP: ShovelMoment mounts it in the Moment_Layer and animates it.
// Every piece renders hidden (opacity 0); the timeline reveals it. Original, rounded, cartoon art.

/** Height over width of the shovel drawing (the drawing space is SHOVEL_VIEW_W by SHOVEL_VIEW_H, blade down). */
export const SHOVEL_ASPECT = SHOVEL_VIEW_H / SHOVEL_VIEW_W;
// Shovel drawing details, in its drawing space.
const SHOVEL_AXIS_X = 24;
const SHOVEL_OUTLINE_W = 8;
const SHOVEL_WOOD_W = 4.5;
const SHOVEL_PART_OUTLINE_W = 2.2;
const SHOVEL_SHADE_OPACITY = 0.55;
const D_GRIP_PATH = "M13 22 V11 Q13 5 19 5 H29 Q35 5 35 11 V22";
const D_GRIP_BAR_PATH = "M13 22 H35";
const BLADE_PATH = "M10 72 H38 L39 92 C39 104 31 112 24 118 C17 112 9 104 9 92 Z";
const BLADE_SHADE_PATH = "M24 74 V116 C31 110 39 104 39 92 L38 74 Z";
const TREAD = { x: 6, y: 67, w: 36, h: 8, r: 3 } as const;
const SOCKET = { x: 19, y: 62, w: 10, h: 12, r: 2 } as const;
/** Local drawing space of the dirt puff. */
const PUFF_VIEW_W = 60;
const PUFF_VIEW_H = 30;
const PUFF_BLOBS = [
  { cx: 14, cy: 20, r: 9 },
  { cx: 30, cy: 14, r: 12 },
  { cx: 46, cy: 20, r: 9 },
  { cx: 30, cy: 22, r: 9 },
] as const;
/** Local drawing space of the tombstone (the same 64 by 56 figure as the Scene tombstone). */
const TOMBSTONE_VIEW_W = 64;
const TOMBSTONE_VIEW_H = 56;
const SLAB = { x: 10, y: 0, w: 44, h: 50, r: 20 } as const;
const MOUND = { cx: 32, cy: 52, rx: 30, ry: 5 } as const;
const CROSS_STROKE = 3;
const CROSS_OPACITY = 0.7;
const LABEL_LINE_HEIGHT_PX = MIN_LABEL_PX + 2;

/** Attribute values the Moment file queries; kept here so art and animation agree. */
export const ART_PART = {
  shovel: "shovel",
  name: "name-label",
  tombstoneClip: "tombstone-clip",
  tombstone: "tombstone",
  dirtPuff: "dirt-puff",
} as const;

export type ShovelArtProps = { widthPx: number; heightPx: number };

/**
 * Cartoon digging shovel with a dark outline: wooden D-grip and shaft, steel socket, a flat tread
 * (the step for the foot) and a pointed steel blade. The blade tip is at the bottom center.
 */
export function ShovelArt({ widthPx, heightPx }: ShovelArtProps) {
  return (
    <svg
      data-moment={ART_PART.shovel}
      viewBox={`0 0 ${SHOVEL_VIEW_W} ${SHOVEL_VIEW_H}`}
      width={widthPx}
      height={heightPx}
      aria-hidden="true"
      focusable="false"
      className="absolute left-0 top-0 block"
      style={{ opacity: 0 }}
    >
      <g fill="none" strokeLinecap="round" strokeLinejoin="round">
        <g stroke={SCENE_SHOVEL_OUTLINE} strokeWidth={SHOVEL_OUTLINE_W}>
          <path d={D_GRIP_PATH} />
          <path d={D_GRIP_BAR_PATH} />
          <line x1={SHOVEL_AXIS_X} y1={22} x2={SHOVEL_AXIS_X} y2={66} />
        </g>
        <g stroke={SCENE_SHOVEL_WOOD} strokeWidth={SHOVEL_WOOD_W}>
          <path d={D_GRIP_PATH} />
          <path d={D_GRIP_BAR_PATH} />
          <line x1={SHOVEL_AXIS_X} y1={22} x2={SHOVEL_AXIS_X} y2={66} />
        </g>
      </g>
      <g stroke={SCENE_SHOVEL_OUTLINE} strokeWidth={SHOVEL_PART_OUTLINE_W} strokeLinejoin="round">
        <path d={BLADE_PATH} fill={SCENE_SHOVEL_STEEL} />
        <path d={BLADE_SHADE_PATH} fill={SCENE_SHOVEL_STEEL_SHADE} stroke="none" opacity={SHOVEL_SHADE_OPACITY} />
        <rect x={TREAD.x} y={TREAD.y} width={TREAD.w} height={TREAD.h} rx={TREAD.r} fill={SCENE_SHOVEL_STEEL_SHADE} />
        <rect x={SOCKET.x} y={SOCKET.y} width={SOCKET.w} height={SOCKET.h} rx={SOCKET.r} fill={SCENE_SHOVEL_STEEL} />
      </g>
    </svg>
  );
}

export type DirtPuffArtProps = { leftPx: number; topPx: number; widthPx: number };

/** A small round cloud of soil that bursts where the zombie goes under. Starts hidden. */
export function DirtPuffArt({ leftPx, topPx, widthPx }: DirtPuffArtProps) {
  return (
    <svg
      data-moment={ART_PART.dirtPuff}
      viewBox={`0 0 ${PUFF_VIEW_W} ${PUFF_VIEW_H}`}
      width={widthPx}
      height={(widthPx * PUFF_VIEW_H) / PUFF_VIEW_W}
      aria-hidden="true"
      focusable="false"
      className="absolute block"
      style={{ left: leftPx, top: topPx, opacity: 0 }}
    >
      {PUFF_BLOBS.map((blob) => (
        <circle key={`${blob.cx}-${blob.cy}`} cx={blob.cx} cy={blob.cy} r={blob.r} fill={SCENE_DIRT} />
      ))}
    </svg>
  );
}

export type NameLabelProps = {
  name: string;
  leftPx: number;
  topPx: number;
  /** True when the label sits to the left of its anchor. */
  alignEnd: boolean;
};

/** The subscription name, shown during the bonk beat. Real text in a pill so it stays readable. */
export function NameLabel({ name, leftPx, topPx, alignEnd }: NameLabelProps) {
  return (
    <div
      className="absolute flex w-0"
      style={{ left: leftPx, top: topPx, justifyContent: alignEnd ? "flex-end" : "flex-start" }}
    >
      <span
        data-moment={ART_PART.name}
        className="shrink-0 whitespace-nowrap rounded-full bg-surface-overlay px-2 py-0.5 font-medium text-ink"
        style={{ opacity: 0, fontSize: MIN_LABEL_PX, lineHeight: `${LABEL_LINE_HEIGHT_PX}px` }}
      >
        {name}
      </span>
    </div>
  );
}

export type TombstoneArtProps = {
  /** The clip rectangle in layer pixels; the tombstone rises under it. */
  clip: { leftPx: number; topPx: number; widthPx: number; heightPx: number };
  /** The final tombstone box, relative to the clip's top-left corner, in pixels. */
  box: { leftPx: number; topPx: number; widthPx: number; heightPx: number };
  /** Width of the label slot, centered on the tombstone, in pixels. */
  labelWidthPx: number;
  /** Distance from the top of the tombstone to its label, in pixels. */
  labelTopPx: number;
  ripText: string;
};

/** Tombstone with its "R.I.P. $X/mo" label, inside a clip that hides the part still underground. */
export function TombstoneArt({ clip, box, labelWidthPx, labelTopPx, ripText }: TombstoneArtProps) {
  const slabPath = `M${SLAB.x} ${SLAB.h} V${SLAB.r} A${SLAB.r} ${SLAB.r} 0 0 1 ${SLAB.x + SLAB.w} ${SLAB.r} V${SLAB.h}Z`;
  return (
    <div
      data-moment={ART_PART.tombstoneClip}
      className="absolute overflow-hidden"
      style={{ left: clip.leftPx, top: clip.topPx, width: clip.widthPx, height: clip.heightPx }}
    >
      <div
        data-moment={ART_PART.tombstone}
        className="absolute left-0 top-0"
        style={{ opacity: 0, width: clip.widthPx, height: clip.heightPx }}
      >
        <svg
          viewBox={`0 0 ${TOMBSTONE_VIEW_W} ${TOMBSTONE_VIEW_H}`}
          width={box.widthPx}
          height={box.heightPx}
          aria-hidden="true"
          focusable="false"
          className="absolute block"
          style={{ left: box.leftPx, top: box.topPx }}
        >
          <ellipse cx={MOUND.cx} cy={MOUND.cy} rx={MOUND.rx} ry={MOUND.ry} fill={SCENE_STONE} />
          <path d={slabPath} fill={SCENE_WALL} />
          <g stroke={SCENE_STONE} strokeWidth={CROSS_STROKE} strokeLinecap="round" opacity={CROSS_OPACITY}>
            <line x1={32} y1={12} x2={32} y2={32} />
            <line x1={24} y1={19} x2={40} y2={19} />
          </g>
        </svg>
        <div
          className="absolute text-center font-medium text-ink"
          style={{
            left: box.leftPx + box.widthPx / 2 - labelWidthPx / 2,
            top: box.topPx + labelTopPx,
            width: labelWidthPx,
            fontSize: MIN_LABEL_PX,
            lineHeight: `${LABEL_LINE_HEIGHT_PX}px`,
          }}
        >
          {ripText}
        </div>
      </div>
    </div>
  );
}
