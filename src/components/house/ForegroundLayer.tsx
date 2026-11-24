import { useId } from "react";
import { POLTERGEIST_CENTER, SCENE_FOG, SCENE_MOON, VIEWBOX_HEIGHT, VIEWBOX_WIDTH } from "@/lib/scene";
import type { SceneModel } from "@/lib/scene";
import {
  FOG_BACK_BARS,
  FOG_BAR_HEIGHT,
  FOG_BARS,
  FOG_FRONT_OPACITY,
  FOG_DOOR_BAR_INDEX,
  FOG_DOOR_CLEAR_BARS,
  FOG_DOOR_CLEAR_MIN_LEVEL,
  MOON,
  MOON_EDGE_POLYLINES,
  TOKEN,
  getStructureTransform,
} from "./houseGeometry";

export type ForegroundLayerProps = {
  model: SceneModel;
};

const GLOW_HOLE_RADIUS = 190;
const SPIRIT_HALO_RADIUS = 140;
const SPIRIT_HALO_OPACITY = 0.3;
const MOON_GLOW_RADIUS = 80;
const MOON_GLOW_OPACITY = 0.3;
const EDGE_WIDTH = 1.5;
const EDGE_OPACITY = 0.28;

/** Front fog bars plus the darkness overlay (level 5 keeps one light source through a mask). */
export function ForegroundLayer({ model }: ForegroundLayerProps) {
  const rawId = useId();
  const id = rawId.replace(/[^a-zA-Z0-9_-]/g, "");
  const maskId = `scene-dark-mask-${id}`;
  const spiritId = `scene-spirit-${id}`;
  const moonId = `scene-moon-${id}`;
  const glow = model.lighting === "poltergeistGlow";
  const moonlight = model.lighting === "moonlight";
  const center = POLTERGEIST_CENTER;
  const frontBars = FOG_BARS.slice(FOG_BACK_BARS, model.features.fog).flatMap((bar, index) =>
    model.level >= FOG_DOOR_CLEAR_MIN_LEVEL && index + FOG_BACK_BARS === FOG_DOOR_BAR_INDEX
      ? FOG_DOOR_CLEAR_BARS
      : [bar],
  );

  return (
    <>
      <g data-part="atmosphere-front">
        {frontBars.map((bar) => (
          <rect
            key={`${bar.x}-${bar.y}`}
            x={bar.x}
            y={bar.y}
            width={bar.w}
            height={FOG_BAR_HEIGHT}
            rx={FOG_BAR_HEIGHT / 2}
            fill={SCENE_FOG}
            opacity={FOG_FRONT_OPACITY}
          />
        ))}
      </g>
      <g data-part="darkness" data-lighting={model.lighting}>
        <defs>
          <radialGradient id={maskId}>
            <stop offset="0" stopColor="black" />
            <stop offset="1" stopColor="white" />
          </radialGradient>
          <radialGradient id={spiritId}>
            <stop offset="0" style={{ stopColor: TOKEN.spirit, stopOpacity: SPIRIT_HALO_OPACITY }} />
            <stop offset="1" style={{ stopColor: TOKEN.spirit, stopOpacity: 0 }} />
          </radialGradient>
          <radialGradient id={moonId}>
            <stop offset="0" style={{ stopColor: TOKEN.tertiary, stopOpacity: MOON_GLOW_OPACITY }} />
            <stop offset="1" style={{ stopColor: TOKEN.tertiary, stopOpacity: 0 }} />
          </radialGradient>
          {glow ? (
            <mask id={`${maskId}-m`} maskUnits="userSpaceOnUse" x={0} y={0} width={VIEWBOX_WIDTH} height={VIEWBOX_HEIGHT}>
              <rect x={0} y={0} width={VIEWBOX_WIDTH} height={VIEWBOX_HEIGHT} fill="white" />
              <circle cx={center.x} cy={center.y} r={GLOW_HOLE_RADIUS} fill={`url(#${maskId})`} />
            </mask>
          ) : null}
        </defs>
        {model.features.darkness > 0 ? (
          <rect
            data-part="darkness-overlay"
            x={0}
            y={0}
            width={VIEWBOX_WIDTH}
            height={VIEWBOX_HEIGHT}
            fill={TOKEN.void}
            opacity={model.features.darkness}
            mask={glow ? `url(#${maskId}-m)` : undefined}
          />
        ) : null}
        {model.level === 5 ? (
          <g
            data-part="moon-edge"
            transform={getStructureTransform(model.features)}
            fill="none"
            stroke={SCENE_MOON}
            strokeWidth={EDGE_WIDTH}
            strokeLinejoin="round"
            strokeLinecap="round"
            opacity={EDGE_OPACITY}
          >
            {MOON_EDGE_POLYLINES.map((points) => (
              <polyline key={points} points={points} />
            ))}
          </g>
        ) : null}
        {glow ? (
          <circle data-part="spirit-glow" cx={center.x} cy={center.y} r={SPIRIT_HALO_RADIUS} fill={`url(#${spiritId})`} />
        ) : null}
        {moonlight ? (
          <circle data-part="moon-glow" cx={MOON.cx} cy={MOON.cy} r={MOON_GLOW_RADIUS} fill={`url(#${moonId})`} />
        ) : null}
      </g>
    </>
  );
}
