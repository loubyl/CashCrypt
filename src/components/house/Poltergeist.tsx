import { memo } from "react";
import { SIGIL_STROKE } from "@/lib/scene";
import type { ScenePoltergeist } from "@/lib/scene";
import { TOKEN, isSameData } from "./houseGeometry";

export type PoltergeistProps = {
  poltergeist: ScenePoltergeist | null;
};

const BODY_OPACITY = 1;
const BOUND_OPACITY = 0.55;
const INNER_GLOW_OPACITY = 0.6;
const INNER_GLOW_RATIO = 0.55;
const EYE_OFFSET = 0.28;
const EYE_Y = -0.1;
const EYE_SIZE = 0.12;
const SIGIL_INNER_RATIO = 0.88;
const SIGIL_DASH = "10 8";
const SIGIL_OPACITY = 0.9;
const SIGIL_INNER_OPACITY = 0.6;
const SIGIL_TICKS = 8;
const SIGIL_TICK_LENGTH_RATIO = 0.08;
const FULL_TURN_DEG = 360;
const HALF = 2;

/** Jagged outline: alternating outer and inner radii around the center (unit radius 1). */
const JAGGED_RADII: readonly number[] = [1, 0.62, 0.92, 0.55, 1, 0.6, 0.88, 0.58, 0.98, 0.64, 0.9, 0.56, 1, 0.6];
const JAGGED_POINTS = JAGGED_RADII.map((radius, index) => {
  const angle = (index / JAGGED_RADII.length) * Math.PI * HALF;
  return `${(Math.cos(angle) * radius).toFixed(3)},${(Math.sin(angle) * radius).toFixed(3)}`;
}).join(" ");
const JAGGED_EYE = "-0.5,-0.4 0.5,0 -0.5,0.4";

const SIGIL_TICK_ANGLES = Array.from({ length: SIGIL_TICKS }, (_, index) => (FULL_TURN_DEG / SIGIL_TICKS) * index);

type PoltergeistFigureProps = { poltergeist: ScenePoltergeist };

function PoltergeistFigureBase({ poltergeist }: PoltergeistFigureProps) {
  const { center, sizeUnits, sigil, state } = poltergeist;
  const radius = sizeUnits / HALF;
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
      <g
        data-part="poltergeist-body"
        data-ambient={bound ? undefined : "poltergeist"}
        opacity={bound ? BOUND_OPACITY : BODY_OPACITY}
      >
        <g transform={`scale(${radius})`}>
          <polygon points={JAGGED_POINTS} fill={TOKEN.spirit} strokeLinejoin="miter" />
          <g transform={`scale(${INNER_GLOW_RATIO})`}>
            <polygon points={JAGGED_POINTS} fill={TOKEN.ink} opacity={INNER_GLOW_OPACITY * INNER_GLOW_RATIO} />
          </g>
          <g transform={`translate(${-EYE_OFFSET} ${EYE_Y}) scale(${EYE_SIZE})`}>
            <polygon points={JAGGED_EYE} fill={TOKEN.void} />
          </g>
          <g transform={`translate(${EYE_OFFSET} ${EYE_Y}) scale(${-EYE_SIZE} ${EYE_SIZE})`}>
            <polygon points={JAGGED_EYE} fill={TOKEN.void} />
          </g>
        </g>
      </g>
    </g>
  );
}

const PoltergeistFigure = memo(PoltergeistFigureBase, isSameData);

/** The single Poltergeist, with the sigil ring when bound. Draws nothing when the engine reports none. */
export function Poltergeist({ poltergeist }: PoltergeistProps) {
  if (poltergeist === null) return null;
  return <PoltergeistFigure poltergeist={poltergeist} />;
}
