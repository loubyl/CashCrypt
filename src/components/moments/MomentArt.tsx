import { useId } from "react";
import type { ReactNode } from "react";
import { HALO_BLUR, makeFilterIds } from "@/components/house/houseGeometry";
import { GhostShape } from "@/components/house/GhostSwarm";
import { PoltergeistShape } from "@/components/house/Poltergeist";
import {
  DECAY_TINTS,
  FEED_PARTICLES,
  FEED_PARTICLE_R,
  MIN_LABEL_PX,
  SIGIL_STROKE,
  SCENE_BAT,
  SCENE_DIRT,
  VIEWBOX_HEIGHT,
  VIEWBOX_WIDTH,
  SCENE_SHOVEL_OUTLINE,
  SCENE_SHOVEL_STEEL,
  SCENE_SHOVEL_STEEL_SHADE,
  SCENE_SHOVEL_WOOD,
  SCENE_STONE,
  SCENE_TEAL,
  SCENE_WALL,
  SHOVEL_VIEW_H,
  SHOVEL_VIEW_W,
} from "@/lib/scene";
import type { Point, SceneGhost, ScenePoltergeist } from "@/lib/scene";

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
  flame: "flame",
  orb: "orb",
  crack: "crack-flash",
  sigil: "sigil",
  sigilFlash: "sigil-flash",
  bat: "bat",
  creakCrack: "creak-crack",
  shutter: "shutter",
  candle: "candle",
  candleFlame: "candle-flame",
  feedParticle: "feed-particle",
  poltergeistCopy: "poltergeist-copy",
  poltergeistCopyFeed: "poltergeist-copy-feed",
  ghostArrival: "ghost-arrival",
  ghostArrivalRise: "ghost-arrival-rise",
  markerPulse: "marker-pulse",
  markerPulseInner: "marker-pulse-inner",
  flickerGlow: "flicker-glow",
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
  ripText: string;
};

/** Tombstone with its "R.I.P. $X/mo" label, inside a clip that hides the part still underground. */
export function TombstoneArt({ clip, box, labelWidthPx, ripText }: TombstoneArtProps) {
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
          className="absolute truncate text-center font-medium text-ink"
          style={{
            left: box.leftPx + box.widthPx / 2 - labelWidthPx / 2,
            // On the bottom of the clip (the graveyard band), like the Scene label, so it stays inside.
            bottom: 0,
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

// Payment Moment art: a candle flame, a light orb and a crack that seals. Drawn in screen pixels, hidden at first.
const FLAME_VIEW = 32;
const FLAME_OUTER_PATH = "M16 2 C22 10 27 15 27 21 C27 27 22 31 16 31 C10 31 5 27 5 21 C5 15 10 10 16 2 Z";
const FLAME_INNER_PATH = "M16 14 C19 18 21 21 21 24 C21 27 19 29 16 29 C13 29 11 27 11 24 C11 21 13 18 16 14 Z";
const ORB_VIEW = 28;
const ORB_CENTER = ORB_VIEW / 2;
const ORB_HALO_R = 13;
const ORB_HALO_OPACITY = 0.35;
const ORB_BODY_R = 8;
const ORB_CORE_R = 4;
const CANDLE_COLOR = "var(--accent-candle)";
const ECTO_COLOR = "var(--accent-ecto)";

export type FlameArtProps = { leftPx: number; topPx: number; sizePx: number };

/** Small rounded candle flame; `leftPx` and `topPx` are its top-left corner. Starts hidden. */
export function FlameArt({ leftPx, topPx, sizePx }: FlameArtProps) {
  return (
    <svg
      data-moment={ART_PART.flame}
      viewBox={`0 0 ${FLAME_VIEW} ${FLAME_VIEW}`}
      width={sizePx}
      height={sizePx}
      aria-hidden="true"
      focusable="false"
      className="absolute block"
      style={{ left: leftPx, top: topPx, opacity: 0 }}
    >
      <path d={FLAME_OUTER_PATH} fill={CANDLE_COLOR} />
      <path d={FLAME_INNER_PATH} fill={DECAY_TINTS[1]} />
    </svg>
  );
}

export type OrbArtProps = { sizePx: number };

/** Round ball of candlelight with a soft halo; GSAP moves it along the path from the origin. Starts hidden. */
export function OrbArt({ sizePx }: OrbArtProps) {
  return (
    <svg
      data-moment={ART_PART.orb}
      viewBox={`0 0 ${ORB_VIEW} ${ORB_VIEW}`}
      width={sizePx}
      height={sizePx}
      aria-hidden="true"
      focusable="false"
      className="absolute left-0 top-0 block"
      style={{ opacity: 0 }}
    >
      <circle cx={ORB_CENTER} cy={ORB_CENTER} r={ORB_HALO_R} fill={CANDLE_COLOR} opacity={ORB_HALO_OPACITY} />
      <circle cx={ORB_CENTER} cy={ORB_CENTER} r={ORB_BODY_R} fill={CANDLE_COLOR} />
      <circle cx={ORB_CENTER} cy={ORB_CENTER} r={ORB_CORE_R} fill={DECAY_TINTS[1]} />
    </svg>
  );
}

export type CrackFlashArtProps = {
  leftPx: number;
  topPx: number;
  widthPx: number;
  points: readonly { x: number; y: number }[];
  stroke: number;
};

/** The crack flash in --accent-ecto, drawn over the walls in ViewBox units. Starts hidden. */
export function CrackFlashArt({ leftPx, topPx, widthPx, points, stroke }: CrackFlashArtProps) {
  return (
    <svg
      data-moment={ART_PART.crack}
      viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
      width={widthPx}
      height={(widthPx * VIEWBOX_HEIGHT) / VIEWBOX_WIDTH}
      aria-hidden="true"
      focusable="false"
      className="absolute block"
      style={{ left: leftPx, top: topPx, opacity: 0 }}
    >
      <polyline
        points={points.map((p) => `${p.x},${p.y}`).join(" ")}
        fill="none"
        stroke={ECTO_COLOR}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// Sigil Moment art: a spirit-colored ring drawn around the Poltergeist and a brief white flash. Starts hidden.
const SPIRIT_COLOR = "var(--accent-spirit)";
const INK_COLOR = "var(--text-primary)";

export type SigilArtProps = {
  leftPx: number;
  topPx: number;
  widthPx: number;
  /** Ring center and radius, in ViewBox units. */
  cx: number;
  cy: number;
  r: number;
  stroke: number;
  /** Radius of the flash disc over the Poltergeist, in ViewBox units. */
  flashR: number;
};

/**
 * The sigil: one `<ellipse>` with equal radii (DrawSVGPlugin does not draw a `<circle>`), drawn in ViewBox
 * units over the Scene, plus a flash disc. The Moment_Layer is outside the Scene SVG, so the ring is not clipped.
 */
export function SigilArt({ leftPx, topPx, widthPx, cx, cy, r, stroke, flashR }: SigilArtProps) {
  return (
    <svg
      viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
      width={widthPx}
      height={(widthPx * VIEWBOX_HEIGHT) / VIEWBOX_WIDTH}
      aria-hidden="true"
      focusable="false"
      className="absolute block"
      style={{ left: leftPx, top: topPx }}
    >
      <ellipse
        data-moment={ART_PART.sigil}
        cx={cx}
        cy={cy}
        rx={r}
        ry={r}
        fill="none"
        stroke={SPIRIT_COLOR}
        strokeWidth={stroke}
        strokeLinecap="round"
        style={{ opacity: 0 }}
      />
      <ellipse data-moment={ART_PART.sigilFlash} cx={cx} cy={cy} rx={flashR} ry={flashR} fill={INK_COLOR} style={{ opacity: 0 }} />
    </svg>
  );
}

// Level-change Moment art: a bat for dawn, a drawn crack and a swinging shutter for creak. Drawn in ViewBox units, hidden at first.
const BAT_BODY_PATH = "M0 -3 C3 -3 4 1 0 5 C-4 1 -3 -3 0 -3 Z";
const BAT_WINGS_PATH = "M0 -1 C-6 -9 -14 -8 -19 -2 C-15 -3 -12 -1 -10 3 C-8 0 -5 0 -3 3 C-2 1 -1 1 0 3 C1 1 2 1 3 3 C5 0 8 0 10 3 C12 -1 15 -3 19 -2 C14 -8 6 -9 0 -1 Z";
const BAT_EAR_PATH = "M-3 -3 L-4 -7 L-1 -4 M3 -3 L4 -7 L1 -4";
const BAT_EAR_STROKE = 1.2;
const CREAK_CRACK_COLOR = "var(--surface-void)";
const SHUTTER_SLAT_COUNT = 3;
const SHUTTER_SLAT_STROKE = 1.2;
const SHUTTER_SLAT_OPACITY = 0.5;

type SceneOverlayProps = { leftPx: number; topPx: number; widthPx: number };

function SceneOverlay({ leftPx, topPx, widthPx, children }: SceneOverlayProps & { children: ReactNode }) {
  return (
    <svg
      viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
      width={widthPx}
      height={(widthPx * VIEWBOX_HEIGHT) / VIEWBOX_WIDTH}
      aria-hidden="true"
      focusable="false"
      className="absolute block"
      style={{ left: leftPx, top: topPx }}
    >
      {children}
    </svg>
  );
}

export type BatArtProps = SceneOverlayProps;

/** One small cartoon bat, centered on its own origin; GSAP moves it along the flight samples. Starts hidden. */
export function BatArt({ leftPx, topPx, widthPx }: BatArtProps) {
  return (
    <SceneOverlay leftPx={leftPx} topPx={topPx} widthPx={widthPx}>
      <g data-moment={ART_PART.bat} style={{ opacity: 0 }}>
        <path d={BAT_WINGS_PATH} fill={SCENE_BAT} />
        <path d={BAT_BODY_PATH} fill={SCENE_BAT} />
        <path d={BAT_EAR_PATH} fill="none" stroke={SCENE_BAT} strokeWidth={BAT_EAR_STROKE} strokeLinecap="round" />
      </g>
    </SceneOverlay>
  );
}

export type CreakArtProps = SceneOverlayProps & {
  crackPoints: readonly { x: number; y: number }[];
  crackStroke: number;
  /** Shutter slab in ViewBox units, hinged on `hingeX`. */
  shutter: { x: number; y: number; w: number; h: number; hingeX: number } | null;
};

/** A crack across the wall (a polyline for DrawSVG) and one shutter next to a window. Starts hidden. */
export function CreakArt({ leftPx, topPx, widthPx, crackPoints, crackStroke, shutter }: CreakArtProps) {
  return (
    <SceneOverlay leftPx={leftPx} topPx={topPx} widthPx={widthPx}>
      <polyline
        data-moment={ART_PART.creakCrack}
        points={crackPoints.map((p) => `${p.x},${p.y}`).join(" ")}
        fill="none"
        stroke={CREAK_CRACK_COLOR}
        strokeWidth={crackStroke}
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ opacity: 0 }}
      />
      {shutter ? (
        <g data-moment={ART_PART.shutter} style={{ opacity: 0 }}>
          <rect x={shutter.x} y={shutter.y} width={shutter.w} height={shutter.h} rx={2} fill={SCENE_TEAL} />
          {Array.from({ length: SHUTTER_SLAT_COUNT }, (_, i) => {
            const y = shutter.y + (shutter.h * (i + 1)) / (SHUTTER_SLAT_COUNT + 1);
            return (
              <line
                key={y}
                x1={shutter.x + 2}
                y1={y}
                x2={shutter.x + shutter.w - 2}
                y2={y}
                stroke={SCENE_BAT}
                strokeWidth={SHUTTER_SLAT_STROKE}
                opacity={SHUTTER_SLAT_OPACITY}
              />
            );
          })}
        </g>
      ) : null}
    </SceneOverlay>
  );
}

// Three-candles Moment art: three wax candles on small dish holders with dripping wax and a flame each,
// drawn in ViewBox units. Starts hidden.
const CANDLE_HOLDER_HEIGHT_SHARE = 0.14;
const CANDLE_HOLDER_RIM_SHARE = 0.4;
const CANDLE_WAX_WIDTH_SHARE = 0.6;
const CANDLE_WAX_HEIGHT_SHARE = 0.46;
const CANDLE_WAX_RADIUS = 3;
const CANDLE_FLAME_HEIGHT_SHARE = 0.28;
const CANDLE_FLAME_WIDTH_SHARE = 0.5;
const CANDLE_HALO_OPACITY = 0.3;
const CANDLE_HALO_RADIUS_SHARE = 0.34;
const CANDLE_WICK_WIDTH = 2;
const CANDLE_WICK_HEIGHT = 4;
const CANDLE_WICK_OPACITY = 0.8;
const CANDLE_PUDDLE_HEIGHT = 3;
const CANDLE_DRIP_WIDTH = 3.4;
const CANDLE_DRIP_OPACITY = 0.9;
/** Drips hang from the top of the wax: share of the wax width (center) and of the wax height (length). */
const CANDLE_DRIPS: readonly { at: number; length: number }[] = [
  { at: 0.22, length: 0.55 },
  { at: 0.7, length: 0.32 },
];
const HALF_SHARE = 0.5;

export type CandleBox = { x: number; y: number; w: number; h: number };
export type CandlesArtProps = SceneOverlayProps & { boxes: readonly CandleBox[] };

/** Three cartoon candles in their boxes; the wax and each flame start hidden and the Moment lights them in turn. */
export function CandlesArt({ leftPx, topPx, widthPx, boxes }: CandlesArtProps) {
  return (
    <SceneOverlay leftPx={leftPx} topPx={topPx} widthPx={widthPx}>
      {boxes.map((box) => {
        const holderH = box.h * CANDLE_HOLDER_HEIGHT_SHARE;
        const holderY = box.y + box.h - holderH;
        const waxW = box.w * CANDLE_WAX_WIDTH_SHARE;
        const waxH = box.h * CANDLE_WAX_HEIGHT_SHARE;
        const waxX = box.x + (box.w - waxW) * HALF_SHARE;
        const waxY = holderY - waxH;
        const flameH = box.h * CANDLE_FLAME_HEIGHT_SHARE;
        const flameW = box.w * CANDLE_FLAME_WIDTH_SHARE;
        const flameCx = box.x + box.w * HALF_SHARE;
        const flameBottom = waxY - CANDLE_WICK_HEIGHT;
        const flameTop = flameBottom - flameH;
        const flameMid = flameTop + flameH * HALF_SHARE;
        const rimH = holderH * CANDLE_HOLDER_RIM_SHARE;
        return (
          <g key={box.x}>
            <g data-moment={ART_PART.candle} style={{ opacity: 0 }}>
              <path
                d={`M${box.x} ${holderY} H${box.x + box.w} L${box.x + box.w - holderH * HALF_SHARE} ${holderY + holderH} H${box.x + holderH * HALF_SHARE} Z`}
                fill={SCENE_STONE}
              />
              <rect x={box.x} y={holderY} width={box.w} height={rimH} rx={rimH * HALF_SHARE} fill={SCENE_WALL} />
              <rect x={waxX} y={waxY} width={waxW} height={waxH} rx={CANDLE_WAX_RADIUS} fill={DECAY_TINTS[1]} />
              <ellipse cx={flameCx} cy={holderY} rx={waxW * HALF_SHARE + CANDLE_PUDDLE_HEIGHT} ry={CANDLE_PUDDLE_HEIGHT} fill={DECAY_TINTS[1]} />
              {CANDLE_DRIPS.map((drip) => {
                const cx = waxX + waxW * drip.at;
                const length = waxH * drip.length;
                return (
                  <rect
                    key={drip.at}
                    x={cx - CANDLE_DRIP_WIDTH * HALF_SHARE}
                    y={waxY + CANDLE_WAX_RADIUS}
                    width={CANDLE_DRIP_WIDTH}
                    height={length}
                    rx={CANDLE_DRIP_WIDTH * HALF_SHARE}
                    fill={DECAY_TINTS[2]}
                    opacity={CANDLE_DRIP_OPACITY}
                  />
                );
              })}
              <rect x={flameCx - CANDLE_WICK_WIDTH * HALF_SHARE} y={flameBottom} width={CANDLE_WICK_WIDTH} height={CANDLE_WICK_HEIGHT} fill={SCENE_WALL} opacity={CANDLE_WICK_OPACITY} />
            </g>
            <g data-moment={ART_PART.candleFlame} style={{ opacity: 0 }}>
              <circle cx={flameCx} cy={flameMid} r={box.w * CANDLE_HALO_RADIUS_SHARE} fill={CANDLE_COLOR} opacity={CANDLE_HALO_OPACITY} />
              <ellipse cx={flameCx} cy={flameMid} rx={flameW * HALF_SHARE} ry={flameH * HALF_SHARE} fill={CANDLE_COLOR} />
              <ellipse cx={flameCx} cy={flameMid + flameH * HALF_SHARE * HALF_SHARE} rx={flameW * HALF_SHARE * HALF_SHARE} ry={flameH * HALF_SHARE * HALF_SHARE * 1.2} fill={DECAY_TINTS[2]} />
            </g>
          </g>
        );
      })}
    </SceneOverlay>
  );
}

// Poltergeist feed Moment art: a ring of spirit-colored particles and, when the Poltergeist appears, a copy of its figure.
const FULL_TURN_RAD = Math.PI * 2;
const COPY_SIGIL_OPACITY = 0.9;

export type FeedParticlesArtProps = SceneOverlayProps & { cx: number; cy: number };

/** Small spirit dots stacked at the Poltergeist center; the Moment bursts them outward. Starts hidden. */
export function FeedParticlesArt({ leftPx, topPx, widthPx, cx, cy }: FeedParticlesArtProps) {
  return (
    <SceneOverlay leftPx={leftPx} topPx={topPx} widthPx={widthPx}>
      {Array.from({ length: FEED_PARTICLES }, (_, index) => (
        <circle
          key={index}
          data-moment={ART_PART.feedParticle}
          data-angle={(FULL_TURN_RAD * index) / FEED_PARTICLES}
          cx={cx}
          cy={cy}
          r={FEED_PARTICLE_R}
          fill={SPIRIT_COLOR}
          style={{ opacity: 0 }}
        />
      ))}
    </SceneOverlay>
  );
}

export type PoltergeistCopyArtProps = SceneOverlayProps & { poltergeist: ScenePoltergeist };

/**
 * A copy of the Poltergeist figure (the shared PoltergeistShape, no ambient loops) with its own halo filter,
 * for the Moment that wakes it: the frozen Scene does not contain the new figure. Starts hidden.
 */
export function PoltergeistCopyArt({ leftPx, topPx, widthPx, poltergeist }: PoltergeistCopyArtProps) {
  const filterIds = makeFilterIds(useId());
  const { center, sigil, state } = poltergeist;
  return (
    <SceneOverlay leftPx={leftPx} topPx={topPx} widthPx={widthPx}>
      <defs>
        <filter id={filterIds.halo} x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation={HALO_BLUR} />
        </filter>
      </defs>
      <g data-moment={ART_PART.poltergeistCopy} transform={`translate(${center.x} ${center.y})`} style={{ opacity: 0 }}>
        {state === "bound" ? (
          <ellipse
            cx={sigil.cx - center.x}
            cy={sigil.cy - center.y}
            rx={sigil.r}
            ry={sigil.r}
            fill="none"
            stroke={SPIRIT_COLOR}
            strokeWidth={SIGIL_STROKE}
            opacity={COPY_SIGIL_OPACITY}
          />
        ) : null}
        <g data-moment={ART_PART.poltergeistCopyFeed}>
          <PoltergeistShape poltergeist={poltergeist} filterIds={filterIds} ambient={false} />
        </g>
      </g>
    </SceneOverlay>
  );
}

export type GhostCopyArtProps = SceneOverlayProps & { ghost: SceneGhost };

/**
 * A copy of the arriving Ghost figure (the shared GhostShape, no orbit) at its live rest point, for the
 * Moment that shows it: the frozen Scene does not contain it. The inner group is the one that rises.
 * Starts hidden.
 */
export function GhostCopyArt({ leftPx, topPx, widthPx, ghost }: GhostCopyArtProps) {
  return (
    <SceneOverlay leftPx={leftPx} topPx={topPx} widthPx={widthPx}>
      <g data-moment={ART_PART.ghostArrival} transform={`translate(${ghost.rest.x} ${ghost.rest.y})`} style={{ opacity: 0 }}>
        <g data-moment={ART_PART.ghostArrivalRise}>
          <GhostShape sizeUnits={ghost.sizeUnits} />
        </g>
      </g>
    </SceneOverlay>
  );
}

export type MarkerPulseArtProps = SceneOverlayProps & { count: number; anchor: Point };

const PERCENT = 100;

/**
 * The Ghosts "+N" marker with the live Overflow_Count, bottom-right anchored like the Scene marker, in an
 * overlay with the Scene's proportions. The inner span is the one that pulses. Starts hidden.
 */
export function MarkerPulseArt({ leftPx, topPx, widthPx, count, anchor }: MarkerPulseArtProps) {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute"
      style={{ left: leftPx, top: topPx, width: widthPx, height: (widthPx * VIEWBOX_HEIGHT) / VIEWBOX_WIDTH }}
    >
      <span
        data-moment={ART_PART.markerPulse}
        className="absolute whitespace-nowrap font-medium tabular-nums text-ink-secondary"
        style={{
          fontSize: MIN_LABEL_PX,
          lineHeight: `${LABEL_LINE_HEIGHT_PX}px`,
          left: `${(anchor.x / VIEWBOX_WIDTH) * PERCENT}%`,
          top: `${(anchor.y / VIEWBOX_HEIGHT) * PERCENT}%`,
          transform: "translate(-100%, -100%)",
          opacity: 0,
        }}
      >
        <span data-moment={ART_PART.markerPulseInner} className="block" style={{ transformOrigin: "100% 100%" }}>
          {`+${count}`}
        </span>
      </span>
    </div>
  );
}

export type FlickerGlowBox = { x: number; y: number; w: number; h: number };
export type FlickerGlowArtProps = SceneOverlayProps & { boxes: readonly FlickerGlowBox[]; pad: number };

const FLICKER_GLOW_RADIUS = 6;

/**
 * Candle glow through the gaps of the boarded and broken windows, for the flicker Moment when no window is
 * lit: one candle-colored rounded rectangle per window box, padded by `pad`. Starts hidden.
 */
export function FlickerGlowArt({ leftPx, topPx, widthPx, boxes, pad }: FlickerGlowArtProps) {
  return (
    <SceneOverlay leftPx={leftPx} topPx={topPx} widthPx={widthPx}>
      {boxes.map((box) => (
        <rect
          key={`${box.x}:${box.y}`}
          data-moment={ART_PART.flickerGlow}
          x={box.x - pad}
          y={box.y - pad}
          width={box.w + pad * 2}
          height={box.h + pad * 2}
          rx={FLICKER_GLOW_RADIUS}
          fill={CANDLE_COLOR}
          style={{ opacity: 0 }}
        />
      ))}
    </SceneOverlay>
  );
}
