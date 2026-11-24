import type { ReactNode } from "react";
import {
  BASEMENT_BAND,
  DECAY_TINTS,
  GRAVEYARD_BAND,
  SCENE_FOG,
  SCENE_TEAL,
  SCENE_TEAL_LIGHT,
  VIEWBOX_HEIGHT,
  VIEWBOX_WIDTH,
} from "@/lib/scene";
import type { DecayLevel, GardenState, LevelFeatures, SceneModel } from "@/lib/scene";
import {
  BAT_PATH,
  BATS,
  CHIMNEY_BODY,
  FIREFLIES,
  FOG_BACK_BARS,
  FOG_BAR_HEIGHT,
  FOG_BARS,
  FOG_OPACITY,
  GABLE_ROOF,
  GABLE_WALL,
  GABLE_WALL_COLLAPSED,
  GROUND_Y,
  LEFT_HIP,
  LEFT_HIP_COLLAPSED,
  MOON,
  RIGHT_HIP,
  RIGHT_HIP_COLLAPSED,
  RIGHT_HIP_PARTIAL,
  STARS,
  STUMP_LEFT,
  STUMP_RIGHT,
  TOKEN,
  WALLS,
  getStructureTransform,
} from "./houseGeometry";

export type HouseBaseProps = {
  model: SceneModel;
};

const MOON_OPACITY = 0.5;
const MOON_OPACITY_DARK = 0.3;
const STAR_OPACITY = 0.5;
const SHADE_OPACITY = 0.28;
const GARDEN_TINT_OPACITY: Readonly<Record<GardenState, number>> = {
  green: 0,
  browning: 0.3,
  dead: 0.6,
  bare: 0.8,
  scorched: 0.9,
};
const GARDEN_TINT_LEVEL: Readonly<Record<GardenState, DecayLevel>> = {
  green: 1,
  browning: 2,
  dead: 3,
  bare: 4,
  scorched: 5,
};
const LANTERN_FILL_OPACITY = { lit: 1, dim: 0.55, unlit: 1 } as const;
const LANTERN_GLOW_OPACITY = { lit: 0.22, dim: 0.1, unlit: 0 } as const;

function renderSky(level: DecayLevel): ReactNode {
  const moonOpacity = level === 5 ? MOON_OPACITY_DARK : MOON_OPACITY;
  return (
    <g data-part="sky">
      <rect x={0} y={0} width={VIEWBOX_WIDTH} height={VIEWBOX_HEIGHT} fill={TOKEN.void} />
      {STARS.map((star) => (
        <circle key={`${star.x}-${star.y}`} cx={star.x} cy={star.y} r={1.6} fill={TOKEN.tertiary} opacity={STAR_OPACITY} />
      ))}
      <g data-part="moon" opacity={moonOpacity}>
        <circle cx={MOON.cx} cy={MOON.cy} r={MOON.r} fill={TOKEN.tertiary} />
        <circle cx={MOON.cx - 8} cy={MOON.cy - 6} r={5} fill={TOKEN.void} opacity={0.18} />
        <circle cx={MOON.cx + 9} cy={MOON.cy + 8} r={7} fill={TOKEN.void} opacity={0.14} />
      </g>
    </g>
  );
}

function renderFogBars(from: number, to: number): ReactNode {
  return FOG_BARS.slice(from, to).map((bar) => (
    <rect
      key={`${bar.x}-${bar.y}`}
      x={bar.x}
      y={bar.y}
      width={bar.w}
      height={FOG_BAR_HEIGHT}
      rx={FOG_BAR_HEIGHT / 2}
      fill={SCENE_FOG}
      opacity={FOG_OPACITY}
    />
  ));
}

function renderBackAtmosphere(features: LevelFeatures): ReactNode {
  const backBars = Math.min(features.fog, FOG_BACK_BARS);
  return (
    <g data-part="atmosphere-back">
      <g data-part="fog-back">{renderFogBars(0, backBars)}</g>
      {features.fireflies ? (
        <g data-part="fireflies">
          {FIREFLIES.map((fly) => (
            <circle key={`${fly.x}-${fly.y}`} cx={fly.x} cy={fly.y} r={3} fill={TOKEN.candle} opacity={0.8} />
          ))}
        </g>
      ) : null}
      {features.bats ? (
        <g data-part="bats">
          {BATS.map((bat) => (
            <path key={`${bat.x}-${bat.y}`} d={BAT_PATH} transform={`translate(${bat.x} ${bat.y})`} fill={TOKEN.overlay} />
          ))}
        </g>
      ) : null}
    </g>
  );
}

function renderTree(features: LevelFeatures): ReactNode {
  if (features.tree === "none") return null;
  const charred = features.tree === "charred";
  const stroke = charred ? DECAY_TINTS[5] : SCENE_TEAL;
  return (
    <g data-part="tree" stroke={stroke} strokeLinecap="round" fill="none">
      <path d="M120 400 L124 330 L118 290" strokeWidth={9} />
      <path d="M122 340 L90 310 M121 318 L150 290 M119 300 L100 270 M120 292 L132 262" strokeWidth={5} />
      {charred ? <path d="M121 330 L124 366" stroke={TOKEN.void} strokeWidth={3} /> : null}
    </g>
  );
}

const FENCE_POSTS = [630, 650, 670, 690, 710, 730] as const;
const FENCE_MISSING = [650, 710] as const;
const FENCE_TILTED = 690;
const FENCE_TILT_DEG = 18;

function renderFence(features: LevelFeatures): ReactNode {
  const broken = features.fence === "broken";
  const posts = broken ? FENCE_POSTS.filter((x) => !(FENCE_MISSING as readonly number[]).includes(x)) : FENCE_POSTS;
  return (
    <g data-part="fence" fill={SCENE_TEAL_LIGHT}>
      {posts.map((x) => (
        <rect
          key={x}
          x={x}
          y={368}
          width={6}
          height={32}
          transform={broken && x === FENCE_TILTED ? `rotate(${FENCE_TILT_DEG} ${x} ${GROUND_Y})` : undefined}
        />
      ))}
      {broken ? (
        <>
          <rect x={628} y={376} width={40} height={4} />
          <rect x={700} y={376} width={36} height={4} />
          <rect x={628} y={388} width={40} height={4} />
        </>
      ) : (
        <>
          <rect x={628} y={376} width={108} height={4} />
          <rect x={628} y={388} width={108} height={4} />
        </>
      )}
    </g>
  );
}

function renderGarden(features: LevelFeatures): ReactNode {
  const tintLevel = GARDEN_TINT_LEVEL[features.garden];
  return (
    <g data-part="garden">
      <rect x={0} y={GROUND_Y} width={VIEWBOX_WIDTH} height={VIEWBOX_HEIGHT - GROUND_Y} fill={SCENE_TEAL} opacity={0.3} />
      <rect x={0} y={GROUND_Y - 8} width={VIEWBOX_WIDTH} height={8} fill={SCENE_TEAL_LIGHT} />
      <rect
        x={0}
        y={GROUND_Y - 8}
        width={VIEWBOX_WIDTH}
        height={8}
        fill={DECAY_TINTS[tintLevel]}
        opacity={GARDEN_TINT_OPACITY[features.garden]}
      />
      <ellipse cx={190} cy={394} rx={30} ry={18} fill={SCENE_TEAL} />
      <ellipse cx={612} cy={396} rx={26} ry={14} fill={SCENE_TEAL} />
      {renderTree(features)}
      {renderFence(features)}
    </g>
  );
}

function renderRoof(features: LevelFeatures): ReactNode {
  const roof = features.roof;
  if (roof === "collapsed") {
    return (
      <g data-part="roof" fill={SCENE_TEAL}>
        <polygon points={LEFT_HIP_COLLAPSED} />
        <polygon points={RIGHT_HIP_COLLAPSED} />
        <polygon points={STUMP_LEFT} />
        <polygon points={STUMP_RIGHT} />
        <path d="M330 150 L372 100 M470 160 L430 110" stroke={SCENE_TEAL_LIGHT} strokeWidth={4} strokeLinecap="round" fill="none" />
      </g>
    );
  }
  return (
    <g data-part="roof" fill={SCENE_TEAL}>
      <polygon points={GABLE_ROOF} />
      <polygon points={LEFT_HIP} transform={roof === "sagging" ? "rotate(-4 318 164)" : undefined} />
      {roof === "partialCollapse" ? (
        <>
          <polygon points="616,204 584,190 540,190 504,204" fill={TOKEN.void} opacity={0.85} />
          <polygon points={RIGHT_HIP_PARTIAL} />
        </>
      ) : (
        <polygon points={RIGHT_HIP} />
      )}
      <rect x={184} y={200} width={112} height={5} fill={SCENE_TEAL_LIGHT} />
      {roof === "partialCollapse" ? null : <rect x={504} y={200} width={112} height={5} fill={SCENE_TEAL_LIGHT} />}
      {roof === "missingShingles" ? (
        <g fill={TOKEN.void} opacity={0.6}>
          <rect x={240} y={172} width={18} height={10} />
          <rect x={530} y={174} width={18} height={10} />
          <rect x={268} y={186} width={14} height={8} />
        </g>
      ) : null}
      {features.moss ? (
        <g fill={SCENE_TEAL_LIGHT}>
          <ellipse cx={262} cy={168} rx={24} ry={4} />
          <ellipse cx={520} cy={168} rx={20} ry={4} />
        </g>
      ) : null}
    </g>
  );
}

function renderLantern(features: LevelFeatures): ReactNode {
  const state = features.lantern;
  const fill = state === "unlit" ? TOKEN.raised : TOKEN.candle;
  return (
    <g data-part="lantern">
      <circle cx={338} cy={340} r={26} fill={TOKEN.candle} opacity={LANTERN_GLOW_OPACITY[state]} />
      <rect x={336} y={346} width={4} height={54} fill={SCENE_TEAL_LIGHT} />
      <rect x={329} y={326} width={18} height={20} rx={3} fill={fill} opacity={LANTERN_FILL_OPACITY[state]} />
      <polygon points="326,326 338,316 350,326" fill={SCENE_TEAL} />
    </g>
  );
}

function renderHouse(model: SceneModel): ReactNode {
  const { features, level } = model;
  const tint = DECAY_TINTS[level];
  const collapsed = features.roof === "collapsed";
  return (
    <g data-part="house" transform={getStructureTransform(features)}>
      <rect data-part="chimney" x={CHIMNEY_BODY.x} y={CHIMNEY_BODY.y} width={CHIMNEY_BODY.w} height={CHIMNEY_BODY.h} fill={tint} />
      <rect x={CHIMNEY_BODY.x + CHIMNEY_BODY.w / 2} y={CHIMNEY_BODY.y} width={CHIMNEY_BODY.w / 2} height={CHIMNEY_BODY.h} fill={TOKEN.void} opacity={SHADE_OPACITY} />
      <rect x={CHIMNEY_BODY.x} y={CHIMNEY_BODY.y} width={CHIMNEY_BODY.w} height={7} fill={SCENE_TEAL_LIGHT} />
      <polygon data-part="gable" points={collapsed ? GABLE_WALL_COLLAPSED : GABLE_WALL} fill={tint} />
      <rect data-part="walls" x={WALLS.x} y={WALLS.y} width={WALLS.w} height={WALLS.h} fill={tint} />
      <rect x={WALLS.x + WALLS.w * 0.7} y={WALLS.y} width={WALLS.w * 0.3} height={WALLS.h} fill={TOKEN.void} opacity={SHADE_OPACITY} />
      <rect x={WALLS.x - 4} y={GROUND_Y - 12} width={WALLS.w + 8} height={12} fill={SCENE_TEAL_LIGHT} />
      <g data-part="door">
        <path d="M370 400 V344 A30 30 0 0 1 430 344 V400 Z" fill={TOKEN.void} opacity={0.85} />
        <polygon points="356,326 400,300 444,326" fill={SCENE_TEAL} />
        <rect x={352} y={324} width={96} height={4} fill={SCENE_TEAL_LIGHT} />
      </g>
      {renderLantern(features)}
      {renderRoof(features)}
    </g>
  );
}

function renderBasement(): ReactNode {
  return (
    <>
      <rect
        data-part="basement-bg"
        x={BASEMENT_BAND.x}
        y={BASEMENT_BAND.y}
        width={BASEMENT_BAND.w}
        height={BASEMENT_BAND.h}
        rx={16}
        fill={TOKEN.card}
      />
      <rect
        data-part="graveyard-bg"
        x={GRAVEYARD_BAND.x}
        y={GRAVEYARD_BAND.y + 2}
        width={GRAVEYARD_BAND.w}
        height={GRAVEYARD_BAND.h - 2}
        rx={12}
        fill={TOKEN.raised}
        opacity={0.5}
      />
    </>
  );
}

/** Sky, back atmosphere, garden, house structure (walls, roof, chimney, door, lantern) and the basement and graveyard backdrops. */
export function HouseBase({ model }: HouseBaseProps) {
  return (
    <g data-part="house-base" data-level={model.level}>
      {renderSky(model.level)}
      {renderBackAtmosphere(model.features)}
      {renderGarden(model.features)}
      {renderHouse(model)}
      {renderBasement()}
    </g>
  );
}
