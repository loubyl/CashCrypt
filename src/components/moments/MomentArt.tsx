import {
  MIN_LABEL_PX,
  SCENE_EMBER,
  SCENE_MOON,
  SCENE_STONE,
  SCENE_WALL,
  SCENE_WALL_LIGHT,
} from "@/lib/scene";

// Static Moment art. It never imports GSAP: ShovelMoment mounts it in the Moment_Layer and animates it.
// Every piece renders hidden (opacity 0); the timeline reveals it. Original, rounded, cartoon art.

/** Local drawing space of the shovel (a 40 by 120 figure, blade down). */
const SHOVEL_VIEW_W = 40;
const SHOVEL_VIEW_H = 120;
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
} as const;

export type ShovelArtProps = { widthPx: number; heightPx: number };

/** Cartoon shovel: wooden D-grip and shaft, rounded pale blade. Blade points down. */
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
      <path d="M12 8 H28 A4 4 0 0 1 32 12 V14 A4 4 0 0 1 28 18 H12" fill="none" stroke={SCENE_WALL_LIGHT} strokeWidth={5} strokeLinecap="round" />
      <rect x={17.5} y={8} width={5} height={60} rx={2.5} fill={SCENE_EMBER} />
      <path d="M20 58 C8 58 4 72 6 88 C8 104 16 114 20 116 C24 114 32 104 34 88 C36 72 32 58 20 58Z" fill={SCENE_MOON} />
      <path d="M20 62 C12 64 10 74 11 86 C12 98 16 106 20 110" fill="none" stroke={SCENE_WALL_LIGHT} strokeWidth={2} strokeLinecap="round" opacity={0.5} />
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
