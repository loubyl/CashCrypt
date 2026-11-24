import { useId } from "react";
import { POLTERGEIST_CENTER, SCENE_FOG, VIEWBOX_HEIGHT, VIEWBOX_WIDTH } from "@/lib/scene";
import type { SceneModel } from "@/lib/scene";
import {
  CHIMNEY_BODY,
  FOG_BACK_BARS,
  FOG_BAR_HEIGHT,
  FOG_BARS,
  FOG_FRONT_OPACITY,
  GABLE_WALL_COLLAPSED,
  LEFT_HIP_COLLAPSED,
  MOON,
  RIGHT_HIP_COLLAPSED,
  STUMP_LEFT,
  STUMP_RIGHT,
  TOKEN,
  WALLS,
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
const RIM_WIDTH = 2;
const RIM_OPACITY = 0.4;

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
  const frontBars = FOG_BARS.slice(FOG_BACK_BARS, model.features.fog);

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
            data-part="rim-light"
            transform={getStructureTransform(model.features)}
            fill="none"
            stroke={SCENE_FOG}
            strokeWidth={RIM_WIDTH}
            strokeLinejoin="round"
            opacity={RIM_OPACITY}
          >
            <rect x={WALLS.x} y={WALLS.y} width={WALLS.w} height={WALLS.h} />
            <polygon points={GABLE_WALL_COLLAPSED} />
            <polygon points={LEFT_HIP_COLLAPSED} />
            <polygon points={RIGHT_HIP_COLLAPSED} />
            <polygon points={STUMP_LEFT} />
            <polygon points={STUMP_RIGHT} />
            <rect x={CHIMNEY_BODY.x} y={CHIMNEY_BODY.y} width={CHIMNEY_BODY.w} height={CHIMNEY_BODY.h} />
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
