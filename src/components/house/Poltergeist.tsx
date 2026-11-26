import { memo } from "react";
import { SIGIL_STROKE } from "@/lib/scene";
import type { ScenePoltergeist } from "@/lib/scene";
import { TOKEN, isSameData } from "./houseGeometry";
import type { SceneFilterIds } from "./houseGeometry";

export type PoltergeistProps = {
  poltergeist: ScenePoltergeist | null;
  filterIds: SceneFilterIds;
};

const BODY_OPACITY = 0.78;
const BOUND_OPACITY = 0.5;
const CORE_OPACITY = 0.14;
const GLOW_OPACITY = 0.45;
const GLOW_RATIO = 1.1;
const SWIRL_OPACITY = 0.35;
const SWIRL_RADIUS = 1.02;
const SWIRL_WIDTH = 0.03;
const SWIRL_DASH = "0.32 0.22";
const RIM_OPACITY = 0.22;
const RIM_WIDTH = 0.025;
const SIGIL_INNER_RATIO = 0.88;
const SIGIL_DASH = "10 8";
const SIGIL_OPACITY = 0.9;
const SIGIL_INNER_OPACITY = 0.6;
const SIGIL_TICKS = 8;
const SIGIL_TICK_LENGTH_RATIO = 0.08;
const FULL_TURN_DEG = 360;
const HALF = 2;

/**
 * Spirit body in unit space (radius 1, centered): a wavy, bumpy head (no star spikes) flowing
 * down into a smoky tail that curls to the right. Every point stays within |y| < 1 so the
 * pulse never reaches the windows below.
 */
const SPIRIT_BODY =
  "M-0.70 0.05 C-0.84 -0.30 -0.66 -0.62 -0.44 -0.66 C-0.40 -0.86 -0.16 -0.94 -0.02 -0.82 " +
  "C0.12 -0.96 0.40 -0.90 0.44 -0.66 C0.68 -0.62 0.86 -0.30 0.70 0.04 C0.62 0.26 0.44 0.36 0.38 0.52 " +
  "C0.32 0.68 0.46 0.80 0.62 0.78 C0.50 0.94 0.20 0.92 0.16 0.72 C0.12 0.56 -0.02 0.62 -0.10 0.70 " +
  "C-0.20 0.80 -0.34 0.70 -0.32 0.58 C-0.44 0.66 -0.60 0.58 -0.56 0.42 C-0.70 0.36 -0.74 0.20 -0.70 0.05Z";
/** Smoke wisps trailing off the tail tip. */
const WISPS: readonly { cx: number; cy: number; r: number; opacity: number }[] = [
  { cx: 0.74, cy: 0.86, r: 0.07, opacity: 0.45 },
  { cx: 0.84, cy: 0.94, r: 0.045, opacity: 0.3 },
];
/** Hollow eyes and a small mouth. */
const EYES: readonly { cx: number; cy: number }[] = [
  { cx: -0.24, cy: -0.3 },
  { cx: 0.24, cy: -0.3 },
];
const EYE = { rx: 0.12, ry: 0.17 } as const;
const MOUTH = { cx: 0, cy: 0.06, rx: 0.08, ry: 0.1 } as const;
const SIGIL_TICK_ANGLES = Array.from({ length: SIGIL_TICKS }, (_, index) => (FULL_TURN_DEG / SIGIL_TICKS) * index);

export type PoltergeistShapeProps = {
  poltergeist: ScenePoltergeist;
  filterIds: SceneFilterIds;
  /** False for copies drawn by Moment art, so the ambient loops never pick them up. */
  ambient?: boolean;
};

/** Glow and body of the spirit, centered on the origin of its parent. Shared by the Scene and the Moment art. */
export function PoltergeistShape({ poltergeist, filterIds, ambient = true }: PoltergeistShapeProps) {
  const { sizeUnits, state } = poltergeist;
  const radius = sizeUnits / HALF;
  const bound = state === "bound";
  return (
    <>
      <circle
        data-part="poltergeist-glow"
        r={radius * GLOW_RATIO}
        fill={TOKEN.spirit}
        opacity={bound ? GLOW_OPACITY / HALF : GLOW_OPACITY}
        filter={`url(#${filterIds.halo})`}
      />
      <g
        data-part="poltergeist-body"
        data-ambient={bound || !ambient ? undefined : "poltergeist"}
        opacity={bound ? BOUND_OPACITY : BODY_OPACITY}
      >
        <g transform={`scale(${radius})`}>
          <g data-part="poltergeist-swirl" data-ambient={bound || !ambient ? undefined : "poltergeist-swirl"}>
            <circle
              r={SWIRL_RADIUS}
              fill="none"
              stroke={TOKEN.spirit}
              strokeWidth={SWIRL_WIDTH}
              strokeDasharray={SWIRL_DASH}
              strokeLinecap="round"
              opacity={SWIRL_OPACITY}
            />
          </g>
          <path d={SPIRIT_BODY} fill={TOKEN.spirit} />
          <path d={SPIRIT_BODY} fill="none" stroke={TOKEN.ink} strokeWidth={RIM_WIDTH} opacity={RIM_OPACITY} />
          <ellipse cx={0} cy={-0.2} rx={0.44} ry={0.4} fill={TOKEN.ink} opacity={CORE_OPACITY} />
          {WISPS.map((wisp) => (
            <circle key={wisp.cx} cx={wisp.cx} cy={wisp.cy} r={wisp.r} fill={TOKEN.spirit} opacity={wisp.opacity} />
          ))}
          {EYES.map((eye) => (
            <ellipse key={eye.cx} cx={eye.cx} cy={eye.cy} rx={EYE.rx} ry={EYE.ry} fill={TOKEN.void} />
          ))}
          <ellipse cx={MOUTH.cx} cy={MOUTH.cy} rx={MOUTH.rx} ry={MOUTH.ry} fill={TOKEN.void} />
        </g>
      </g>
    </>
  );
}

type PoltergeistFigureProps = { poltergeist: ScenePoltergeist; filterIds: SceneFilterIds };

function PoltergeistFigureBase({ poltergeist, filterIds }: PoltergeistFigureProps) {
  const { center, sigil, state } = poltergeist;
  const bound = state === "bound";
  return (
    <g data-part="poltergeist" data-state={state} transform={`translate(${center.x} ${center.y})`}>
      {bound ? (
        <g data-part="sigil" transform={`translate(${sigil.cx - center.x} ${sigil.cy - center.y})`} fill="none" stroke={TOKEN.spirit}>
          <ellipse data-part="sigil-ring" rx={sigil.r} ry={sigil.r} strokeWidth={SIGIL_STROKE} opacity={SIGIL_OPACITY} />
          <ellipse
            rx={sigil.r * SIGIL_INNER_RATIO}
            ry={sigil.r * SIGIL_INNER_RATIO}
            strokeWidth={SIGIL_STROKE / HALF}
            strokeDasharray={SIGIL_DASH}
            opacity={SIGIL_INNER_OPACITY}
          />
          {SIGIL_TICK_ANGLES.map((angle) => (
            <line
              key={angle}
              x1={0}
              y1={-sigil.r * SIGIL_INNER_RATIO}
              x2={0}
              y2={-sigil.r * (SIGIL_INNER_RATIO - SIGIL_TICK_LENGTH_RATIO)}
              strokeWidth={SIGIL_STROKE / HALF}
              transform={`rotate(${angle})`}
              opacity={SIGIL_INNER_OPACITY}
            />
          ))}
        </g>
      ) : null}
      <g data-part="poltergeist-feed">
        <PoltergeistShape poltergeist={poltergeist} filterIds={filterIds} />
      </g>
    </g>
  );
}

const PoltergeistFigure = memo(PoltergeistFigureBase, isSameData);

/** The single Poltergeist spirit, with the sigil ring when bound. Draws nothing when the engine reports none. */
export function Poltergeist({ poltergeist, filterIds }: PoltergeistProps) {
  if (poltergeist === null) return null;
  return <PoltergeistFigure poltergeist={poltergeist} filterIds={filterIds} />;
}
