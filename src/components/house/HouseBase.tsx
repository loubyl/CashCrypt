import type { ReactNode } from "react";
import {
  BASEMENT_BAND,
  DECAY_TINTS,
  GRAVEYARD_BAND,
  SCENE_BAT,
  SCENE_BRICK,
  SCENE_CHAR,
  SCENE_EMBER,
  SCENE_FOG,
  SCENE_MOON,
  SCENE_SKY,
  SCENE_SOIL,
  SCENE_SOIL_GRAVE,
  SCENE_STONE,
  SCENE_STONE_LINE,
  SCENE_TEAL,
  SCENE_TEAL_LIGHT,
  SCENE_WALL,
  SCENE_WALL_LIGHT,
  SCENE_WALL_SHADE,
  VIEWBOX_HEIGHT,
  VIEWBOX_WIDTH,
} from "@/lib/scene";
import type { DecayLevel, GardenState, LevelFeatures, SceneModel, TreeState } from "@/lib/scene";
import {
  BAT_PATH,
  REDUCED_MOTION_HIDE_CLASS,
  BATS,
  BRICK_RADIUS,
  BRICK_TILT_DEG,
  BRICKS,
  BUSHES,
  CHIMNEY_BODY,
  EAVES,
  FENCE_MISSING,
  FENCE_PICKET,
  FENCE_POSTS,
  FIREFLIES,
  FOG_BACK_BARS,
  FOG_BAR_HEIGHT,
  FOG_BARS,
  FOG_MOUND_BASE_OPACITY,
  FOG_MOUND_STEP_OPACITY,
  FOG_MOUNDS,
  FOG_OPACITY,
  FOUNDATION_H,
  FOUNDATION_STONES,
  FOUNDATION_Y,
  GABLE_ROOF,
  GABLE_WALL,
  GABLE_WALL_COLLAPSED,
  GROUND_Y,
  LEFT_HIP,
  LEFT_HIP_COLLAPSED,
  MOON,
  MOON_HALO_RADIUS,
  RIGHT_HIP,
  RIGHT_HIP_COLLAPSED,
  RIGHT_HIP_PARTIAL,
  SHINGLE_OPACITY,
  SMOKE_PUFFS,
  SMOKE_PUFFS_BY_LEVEL,
  STARS,
  STUMP_LEFT,
  STUMP_RIGHT,
  TINT_OVERLAY_OPACITY,
  TOKEN,
  TOWER,
  TOWER_CENTER_X,
  TREE_LEFT_X,
  TREE_LIMBS,
  TREE_LIMBS_TWISTED,
  TREE_RIGHT_X,
  TREE_TRUNK,
  TREE_TRUNK_TWISTED,
  TUFT_PATH,
  TUFTS,
  WALL_DARK_VEIL,
  WALL_LIGHT_VEIL,
  WALLS,
  WING_LEFT,
  WING_RIGHT,
  WONK_MAX,
  getStructureTransform,
  signedUnit,
  taperedPath,
  wonkOffset,
  wonkyWallPoints,
} from "./houseGeometry";
import type { Limb, SceneFilterIds } from "./houseGeometry";

export type HouseBaseProps = {
  model: SceneModel;
  filterIds: SceneFilterIds;
};

const MOON_OPACITY = 0.95;
const MOON_OPACITY_DARK = 0.6;
const MOON_HALO_OPACITY = 0.35;
const STAR_OPACITY = 0.5;
const GRASS_TUFT_COUNT: Readonly<Record<GardenState, number>> = {
  green: 9,
  browning: 9,
  dead: 6,
  bare: 3,
  scorched: 0,
};
const SOIL_LINE_OPACITY = 0.7;
const BLOCK_ROWS: readonly number[] = [430, 460, 490];
const BLOCK_TICKS: readonly (readonly number[])[] = [
  [110, 230, 350, 470, 590, 690],
  [170, 290, 410, 530, 650],
  [110, 230, 350, 470, 590, 690],
];
const PEBBLES: readonly { cx: number; cy: number; r: number }[] = [
  { cx: 96, cy: 448, r: 3 },
  { cx: 640, cy: 470, r: 4 },
  { cx: 300, cy: 500, r: 3 },
  { cx: 120, cy: 552, r: 4 },
  { cx: 330, cy: 570, r: 3 },
  { cx: 560, cy: 556, r: 5 },
  { cx: 700, cy: 575, r: 3 },
  { cx: 28, cy: 440, r: 4 },
  { cx: 770, cy: 470, r: 3 },
];
const ROOTS: readonly string[] = [
  "M110 400 C106 414 116 424 108 440",
  "M690 400 C696 412 686 426 694 438",
  "M36 400 C30 416 42 430 34 452",
  "M768 400 C774 414 762 428 770 448",
  "M420 400 C416 408 424 414 418 424",
];
const ROOT_WIDTH = 2;
const BLOCK_LINE_WIDTH = 1.5;
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
const LANTERN_GLOW_OPACITY = { lit: 0.5, dim: 0.25, unlit: 0 } as const;
const LANTERN_GLOW_RADIUS = 24;

function renderSky(level: DecayLevel, filterIds: SceneFilterIds): ReactNode {
  const moonOpacity = level === 5 ? MOON_OPACITY_DARK : MOON_OPACITY;
  return (
    <g data-part="sky">
      <rect x={0} y={0} width={VIEWBOX_WIDTH} height={VIEWBOX_HEIGHT} fill={SCENE_SKY} />
      {STARS.map((star) => (
        <circle key={`${star.x}-${star.y}`} cx={star.x} cy={star.y} r={1.6} fill={TOKEN.tertiary} opacity={STAR_OPACITY} />
      ))}
      <g data-part="moon" opacity={moonOpacity}>
        <circle
          cx={MOON.cx}
          cy={MOON.cy}
          r={MOON_HALO_RADIUS}
          fill={SCENE_MOON}
          opacity={MOON_HALO_OPACITY}
          filter={`url(#${filterIds.moon})`}
        />
        <circle cx={MOON.cx} cy={MOON.cy} r={MOON.r} fill={SCENE_MOON} />
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
      data-ambient="fog"
    />
  ));
}

function renderBackAtmosphere(features: LevelFeatures): ReactNode {
  const backBars = Math.min(features.fog, FOG_BACK_BARS);
  const moundOpacity = FOG_MOUND_BASE_OPACITY + FOG_MOUND_STEP_OPACITY * features.fog;
  return (
    <g data-part="atmosphere-back">
      <g data-part="fog-mounds" fill={SCENE_FOG} opacity={moundOpacity}>
        {FOG_MOUNDS.map((mound) => (
          <ellipse key={`${mound.cx}-${mound.cy}`} cx={mound.cx} cy={mound.cy} rx={mound.rx} ry={mound.ry} />
        ))}
      </g>
      <g data-part="fog-back" className={REDUCED_MOTION_HIDE_CLASS}>{renderFogBars(0, backBars)}</g>
      {features.fireflies ? (
        <g data-part="fireflies" className={REDUCED_MOTION_HIDE_CLASS}>
          {FIREFLIES.map((fly) => (
            <g key={`${fly.x}-${fly.y}`} data-ambient="firefly">
              <circle cx={fly.x} cy={fly.y} r={3} fill={TOKEN.candle} opacity={0.8} />
            </g>
          ))}
        </g>
      ) : null}
      {features.bats ? (
        <g data-part="bats" className={REDUCED_MOTION_HIDE_CLASS}>
          {BATS.map((bat) => (
            <g key={`${bat.x}-${bat.y}`} data-ambient="bat">
              <path d={BAT_PATH} transform={`translate(${bat.x} ${bat.y})`} fill={SCENE_BAT} />
            </g>
          ))}
        </g>
      ) : null}
    </g>
  );
}

/** Canopy lumps of the full and thin trees (local space, trunk base at x 0). */
const CANOPY_FULL: readonly { cx: number; cy: number; r: number }[] = [
  { cx: -2, cy: 262, r: 40 },
  { cx: -38, cy: 290, r: 30 },
  { cx: 34, cy: 286, r: 32 },
  { cx: -16, cy: 236, r: 26 },
  { cx: 20, cy: 244, r: 24 },
  { cx: 2, cy: 306, r: 24 },
];
const CANOPY_THIN: readonly { cx: number; cy: number; r: number }[] = [
  { cx: -44, cy: 292, r: 15 },
  { cx: 44, cy: 276, r: 15 },
  { cx: -24, cy: 250, r: 13 },
  { cx: 26, cy: 238, r: 12 },
];
const CANOPY_LIGHT_OPACITY = 0.35;
const THIN_CANOPY_OPACITY = 0.9;

function renderCanopy(circles: readonly { cx: number; cy: number; r: number }[], fill: string, opacity?: number): ReactNode {
  return (
    <g fill={fill} opacity={opacity}>
      {circles.map((c) => (
        <circle key={`${c.cx}-${c.cy}`} cx={c.cx} cy={c.cy} r={c.r} />
      ))}
    </g>
  );
}

function renderLimbs(limbs: readonly Limb[], fill: string): ReactNode {
  return limbs.map((limb) => (
    <path
      key={`${limb.start.x}-${limb.start.y}-${limb.end.x}`}
      d={taperedPath(limb.start, limb.control, limb.end, limb.w0, limb.w1)}
      fill={fill}
    />
  ));
}

function renderTreeBody(tree: TreeState): ReactNode {
  const fill = tree === "charred" ? SCENE_CHAR : SCENE_TEAL;
  const trunk = tree === "twisted" || tree === "charred" ? TREE_TRUNK_TWISTED : TREE_TRUNK;
  const trunkPath = taperedPath(trunk.start, trunk.control, trunk.end, trunk.w0, trunk.w1);
  switch (tree) {
    case "full":
      return (
        <>
          <path d={trunkPath} fill={fill} />
          {renderCanopy(CANOPY_FULL, SCENE_TEAL)}
          <circle cx={-18} cy={244} r={22} fill={SCENE_TEAL_LIGHT} opacity={CANOPY_LIGHT_OPACITY} />
        </>
      );
    case "thin":
      return (
        <>
          <path d={trunkPath} fill={fill} />
          {renderLimbs(TREE_LIMBS, fill)}
          {renderCanopy(CANOPY_THIN, SCENE_TEAL, THIN_CANOPY_OPACITY)}
        </>
      );
    case "bare":
      return (
        <>
          <path d={trunkPath} fill={fill} />
          {renderLimbs(TREE_LIMBS, fill)}
        </>
      );
    default:
      return (
        <>
          <path d={trunkPath} fill={fill} />
          {renderLimbs(TREE_LIMBS_TWISTED, fill)}
          {tree === "charred" ? (
            <path d="M2 336 L6 352 L3 368" stroke={SCENE_EMBER} strokeWidth={2.5} strokeLinecap="round" fill="none" />
          ) : null}
        </>
      );
  }
}

/** One tree on each side at every level; the state sets how much of it is left. */
function renderTrees(features: LevelFeatures): ReactNode {
  const transforms = [`translate(${TREE_LEFT_X} 0)`, `translate(${TREE_RIGHT_X} 0) scale(-1 1)`];
  return (
    <g data-part="tree" data-tree={features.tree}>
      {transforms.map((transform) => (
        <g key={transform} transform={transform}>
          {renderTreeBody(features.tree)}
        </g>
      ))}
    </g>
  );
}

const FENCE_RAIL_HEIGHT = 4;
const FENCE_RAIL_TOP = 374;
const FENCE_RAIL_BOTTOM = 388;
const FENCE_BROKEN_TILT_INDEX = 4;
const FENCE_BROKEN_TILT_DEG = 18;

/** Pointed pickets whose height and lean grow uneven with the level's wonk. */
function renderFence(features: LevelFeatures): ReactNode {
  const broken = features.fence === "broken";
  const posts = broken ? FENCE_POSTS.filter((x) => !FENCE_MISSING.includes(x)) : FENCE_POSTS;
  const first = FENCE_POSTS[0];
  const last = FENCE_POSTS[FENCE_POSTS.length - 1] + FENCE_PICKET.w;
  return (
    <g data-part="fence" fill={SCENE_TEAL_LIGHT}>
      {posts.map((x, index) => {
        const height = FENCE_PICKET.h + wonkOffset(`picket:${x}:h`, features.wonk, WONK_MAX.picketHeight);
        const lean =
          wonkOffset(`picket:${x}:r`, features.wonk, WONK_MAX.picketRotateDeg) +
          (broken && index === FENCE_BROKEN_TILT_INDEX ? FENCE_BROKEN_TILT_DEG : 0);
        const top = GROUND_Y - height;
        const half = FENCE_PICKET.w / 2;
        return (
          <polygon
            key={x}
            points={`${x},${GROUND_Y} ${x},${top} ${x + half},${top - FENCE_PICKET.tip} ${x + FENCE_PICKET.w},${top} ${x + FENCE_PICKET.w},${GROUND_Y}`}
            transform={lean !== 0 ? `rotate(${lean.toFixed(2)} ${x + half} ${GROUND_Y})` : undefined}
          />
        );
      })}
      {broken ? (
        <>
          <rect x={first - 2} y={FENCE_RAIL_TOP} width={44} height={FENCE_RAIL_HEIGHT} transform="rotate(3 624 376)" />
          <rect x={694} y={FENCE_RAIL_TOP + 2} width={42} height={FENCE_RAIL_HEIGHT} transform="rotate(-6 694 378)" />
          <rect x={first - 2} y={FENCE_RAIL_BOTTOM} width={48} height={FENCE_RAIL_HEIGHT} />
        </>
      ) : (
        <>
          <rect x={first - 2} y={FENCE_RAIL_TOP} width={last - first + 4} height={FENCE_RAIL_HEIGHT} />
          <rect x={first - 2} y={FENCE_RAIL_BOTTOM} width={last - first + 4} height={FENCE_RAIL_HEIGHT} />
        </>
      )}
    </g>
  );
}

/** Ground: soil below the ground line, the teal line itself, trees and fence (behind the house). */
function renderGarden(features: LevelFeatures): ReactNode {
  return (
    <g data-part="garden">
      <rect x={0} y={GROUND_Y} width={VIEWBOX_WIDTH} height={VIEWBOX_HEIGHT - GROUND_Y} fill={TOKEN.card} />
      <rect x={16} y={GROUND_Y - 6} width={VIEWBOX_WIDTH - 32} height={6} rx={3} fill={SCENE_TEAL_LIGHT} />
      {renderTrees(features)}
      {renderFence(features)}
    </g>
  );
}

/** Two bushes and the grass tufts, drawn in front of the house. */
function renderGroundCover(features: LevelFeatures): ReactNode {
  const tufts = TUFTS.slice(0, GRASS_TUFT_COUNT[features.garden]);
  const tintLevel = GARDEN_TINT_LEVEL[features.garden];
  return (
    <g data-part="ground-cover">
      <g data-part="bushes" fill={SCENE_TEAL}>
        {BUSHES.map((bush) => (
          <circle key={`${bush.cx}-${bush.cy}`} cx={bush.cx} cy={bush.cy} r={bush.r} />
        ))}
      </g>
      <g data-part="tufts">
        {tufts.map((x) => (
          <g key={x} transform={`translate(${x} ${GROUND_Y - 6})`}>
            <path d={TUFT_PATH} fill={SCENE_TEAL_LIGHT} />
            <path d={TUFT_PATH} fill={DECAY_TINTS[tintLevel]} opacity={GARDEN_TINT_OPACITY[features.garden]} />
          </g>
        ))}
      </g>
    </g>
  );
}

/** Rotation of a roof part about a pivot, scaled by the level's wonk. */
function wonkRotate(key: string, wonk: number, maxDeg: number, pivot: { x: number; y: number }): string | undefined {
  const angle = wonkOffset(key, wonk, maxDeg);
  return angle === 0 ? undefined : `rotate(${angle.toFixed(2)} ${pivot.x} ${pivot.y})`;
}

const EAVE_TRIM_HEIGHT = 5;
const EAVE_SHADOW_HEIGHT = 12;
const EAVE_SHADOW_OPACITY = 0.35;
const GABLE_SHADOW_HEIGHT = 10;
const MISSING_SHINGLE_OPACITY = 0.6;

function renderRoof(features: LevelFeatures, filterIds: SceneFilterIds): ReactNode {
  const { roof, wonk } = features;
  const shingles = `url(#${filterIds.shingles})`;
  const leftHipTransform = [
    roof === "sagging" ? "rotate(-4 342 170)" : "",
    wonkRotate("hip:left", wonk, WONK_MAX.hipRotateDeg, { x: 342, y: 216 }) ?? "",
  ].join(" ").trim() || undefined;
  const rightHipTransform = wonkRotate("hip:right", wonk, WONK_MAX.hipRotateDeg, { x: 458, y: 216 });
  const gableTransform = wonkRotate("gable", wonk, WONK_MAX.gableRotateDeg, { x: TOWER_CENTER_X, y: 158 });
  if (roof === "collapsed") {
    return (
      <g data-part="roof" fill={SCENE_TEAL}>
        <polygon points={LEFT_HIP_COLLAPSED} transform={leftHipTransform} />
        <polygon points={RIGHT_HIP_COLLAPSED} transform={rightHipTransform} />
        <g transform={gableTransform}>
          <polygon points={STUMP_LEFT} />
          <polygon points={STUMP_RIGHT} />
        </g>
        <path d="M354 108 L380 76 M446 114 L424 84" stroke={SCENE_TEAL_LIGHT} strokeWidth={4} strokeLinecap="round" fill="none" />
      </g>
    );
  }
  return (
    <g data-part="roof" fill={SCENE_TEAL}>
      <g transform={leftHipTransform}>
        <polygon points={LEFT_HIP} />
        <polygon points={LEFT_HIP} fill={shingles} opacity={SHINGLE_OPACITY} />
        <rect x={184} y={EAVES[0].y} width={EAVES[0].x2 - EAVES[0].x1} height={EAVE_TRIM_HEIGHT} fill={SCENE_TEAL_LIGHT} />
      </g>
      {roof === "partialCollapse" ? (
        <g transform={rightHipTransform}>
          <polygon points="616,216 586,200 540,200 458,216" fill={TOKEN.void} opacity={0.85} />
          <polygon points={RIGHT_HIP_PARTIAL} />
          <polygon points={RIGHT_HIP_PARTIAL} fill={shingles} opacity={SHINGLE_OPACITY} />
        </g>
      ) : (
        <g transform={rightHipTransform}>
          <polygon points={RIGHT_HIP} />
          <polygon points={RIGHT_HIP} fill={shingles} opacity={SHINGLE_OPACITY} />
          <rect x={EAVES[1].x1} y={EAVES[1].y} width={EAVES[1].x2 - EAVES[1].x1} height={EAVE_TRIM_HEIGHT} fill={SCENE_TEAL_LIGHT} />
        </g>
      )}
      <g transform={gableTransform}>
        <polygon points={GABLE_ROOF} />
        <polygon points={GABLE_ROOF} fill={shingles} opacity={SHINGLE_OPACITY} />
      </g>
      {roof === "missingShingles" ? (
        <g fill={TOKEN.void} opacity={MISSING_SHINGLE_OPACITY}>
          <rect x={240} y={180} width={18} height={10} />
          <rect x={530} y={182} width={18} height={10} />
          <rect x={272} y={196} width={14} height={8} />
        </g>
      ) : null}
      {features.moss ? (
        <g fill={SCENE_TEAL_LIGHT}>
          <ellipse cx={262} cy={176} rx={24} ry={4} />
          <ellipse cx={520} cy={176} rx={20} ry={4} />
        </g>
      ) : null}
    </g>
  );
}

function renderLantern(features: LevelFeatures, filterIds: SceneFilterIds): ReactNode {
  const state = features.lantern;
  const fill = state === "unlit" ? TOKEN.raised : TOKEN.candle;
  return (
    <g data-part="lantern">
      <circle
        cx={338}
        cy={336}
        r={LANTERN_GLOW_RADIUS}
        fill={TOKEN.candle}
        opacity={LANTERN_GLOW_OPACITY[state]}
        filter={`url(#${filterIds.halo})`}
      />
      <rect x={336} y={346} width={4} height={54} fill={SCENE_TEAL_LIGHT} />
      <rect x={329} y={326} width={18} height={20} rx={3} fill={fill} opacity={LANTERN_FILL_OPACITY[state]} />
      <polygon points="326,326 338,316 350,326" fill={SCENE_TEAL} />
    </g>
  );
}

const MOON_EDGE_OPACITY = 0.18;
const MOON_EDGE_WIDTH = 2;

/** Shadow band under an eave: a dark strip on the wall just below the roof line. */
function renderEaveShadows(collapsed: boolean): ReactNode {
  return (
    <g data-part="eave-shadows" fill={TOKEN.void} opacity={EAVE_SHADOW_OPACITY}>
      {EAVES.map((eave) => (
        <rect
          key={eave.x1}
          x={Math.max(eave.x1, WALLS.x)}
          y={eave.y + EAVE_TRIM_HEIGHT}
          width={Math.min(eave.x2, WALLS.x + WALLS.w) - Math.max(eave.x1, WALLS.x)}
          height={EAVE_SHADOW_HEIGHT}
        />
      ))}
      {collapsed ? null : <rect x={TOWER.x} y={TOWER.y} width={TOWER.w} height={GABLE_SHADOW_HEIGHT} />}
    </g>
  );
}

/** Slate wings and a lighter tower, with a level tint, eave shadows, a dark stone base and a moonlit left edge. */
function renderWalls(level: DecayLevel, features: LevelFeatures): ReactNode {
  const collapsed = features.roof === "collapsed";
  const lightVeil = WALL_LIGHT_VEIL[level];
  const darkVeil = WALL_DARK_VEIL[level];
  const { wonk } = features;
  const wingLeft = wonkyWallPoints(WING_LEFT, "wing:left", wonk);
  const wingRight = wonkyWallPoints(WING_RIGHT, "wing:right", wonk);
  const tower = wonkyWallPoints(TOWER, "tower", wonk);
  const gable = collapsed ? GABLE_WALL_COLLAPSED : GABLE_WALL;
  const shapes = (fill: string, opacity?: number) => (
    <g fill={fill} opacity={opacity}>
      <polygon points={wingLeft} />
      <polygon points={wingRight} />
      <polygon points={tower} />
      <polygon points={gable} />
    </g>
  );
  return (
    <g data-part="wall-surface">
      <polygon points={wingLeft} fill={SCENE_WALL} />
      <polygon points={wingRight} fill={SCENE_WALL_SHADE} />
      <polygon points={tower} fill={SCENE_WALL_LIGHT} />
      <polygon points={gable} fill={SCENE_WALL_LIGHT} />
      {collapsed ? null : <polygon points={`${TOWER_CENTER_X},58 458,154 ${TOWER_CENTER_X},154`} fill={SCENE_WALL} />}
      <rect x={TOWER.x + TOWER.w * 0.7} y={TOWER.y} width={TOWER.w * 0.3} height={TOWER.h} fill={SCENE_WALL} opacity={0.45} />
      {shapes(DECAY_TINTS[level], TINT_OVERLAY_OPACITY)}
      {lightVeil ? shapes(TOKEN.ink, lightVeil) : null}
      {darkVeil ? shapes(TOKEN.void, darkVeil) : null}
      {renderEaveShadows(collapsed)}
      <g data-part="bricks" fill={SCENE_BRICK}>
        {BRICKS.map((brick) => (
          <rect
            key={`${brick.x}-${brick.y}`}
            x={brick.x}
            y={brick.y}
            width={brick.w}
            height={brick.h}
            rx={BRICK_RADIUS}
            transform={`rotate(${(signedUnit(`brick:${brick.x}:${brick.y}`) * BRICK_TILT_DEG).toFixed(2)} ${brick.x + brick.w / 2} ${brick.y + brick.h / 2})`}
          />
        ))}
      </g>
      <g data-part="foundation">
        <rect x={WALLS.x - 4} y={FOUNDATION_Y - 4} width={WALLS.w + 8} height={GROUND_Y - FOUNDATION_Y + 4} fill={SCENE_BRICK} />
        <g fill={SCENE_WALL_SHADE}>
          {FOUNDATION_STONES.map((stone) => (
            <rect key={stone.x} x={stone.x + 1} y={FOUNDATION_Y} width={stone.w - 2} height={FOUNDATION_H} rx={3} />
          ))}
        </g>
      </g>
      <g data-part="moonlit-edge" stroke={SCENE_MOON} strokeWidth={MOON_EDGE_WIDTH} opacity={MOON_EDGE_OPACITY} fill="none" strokeLinecap="round">
        <path d={`M${WING_LEFT.x + 1} ${WING_LEFT.y + 6} V${FOUNDATION_Y - 4}`} />
        <path d={`M${TOWER.x + 1} ${TOWER.y + 4} V${WING_LEFT.y - 2}`} />
        {collapsed ? null : <path d={`M343 152 L${TOWER_CENTER_X - 2} 62`} />}
      </g>
    </g>
  );
}

const DOOR_PLANKS: readonly number[] = [385, 400, 415];

function renderDoor(): ReactNode {
  return (
    <g data-part="door">
      <path d="M370 400 V344 A30 30 0 0 1 430 344 V400 Z" fill={TOKEN.void} opacity={0.85} />
      <g stroke={SCENE_WALL_SHADE} strokeWidth={1.5} opacity={0.45}>
        {DOOR_PLANKS.map((x) => (
          <path key={x} d={`M${x} ${x === 400 ? 318 : 324} V396`} />
        ))}
      </g>
      <circle cx={420} cy={372} r={3.5} fill={DECAY_TINTS[2]} />
      <rect x={354} y={326} width={6} height={74} fill={SCENE_TEAL} />
      <rect x={440} y={326} width={6} height={74} fill={SCENE_TEAL} />
      <polygon points="346,326 400,298 454,326" fill={SCENE_TEAL} />
      <rect x={342} y={324} width={116} height={4} rx={2} fill={SCENE_TEAL_LIGHT} />
      <rect x={366} y={396} width={68} height={4} rx={2} fill={SCENE_TEAL_LIGHT} />
    </g>
  );
}

const SMOKE_FILL = SCENE_BAT;

function renderChimney(model: SceneModel): ReactNode {
  const { features, level } = model;
  const baseX = CHIMNEY_BODY.x + CHIMNEY_BODY.w / 2;
  const tilt = wonkOffset("chimney", features.wonk, WONK_MAX.chimneyRotateDeg);
  const puffs = SMOKE_PUFFS.slice(0, SMOKE_PUFFS_BY_LEVEL[level] ?? 0);
  return (
    <g data-part="chimney" transform={`rotate(${tilt.toFixed(2)} ${baseX} ${CHIMNEY_BODY.y + CHIMNEY_BODY.h})`}>
      <g data-part="smoke" fill={SMOKE_FILL}>
        {puffs.map((puff) => (
          <circle key={puff.dy} cx={baseX + puff.dx} cy={CHIMNEY_BODY.y + puff.dy} r={puff.r} opacity={puff.opacity} />
        ))}
      </g>
      <rect x={CHIMNEY_BODY.x} y={CHIMNEY_BODY.y} width={CHIMNEY_BODY.w} height={CHIMNEY_BODY.h} fill={SCENE_WALL} />
      <rect x={baseX} y={CHIMNEY_BODY.y} width={CHIMNEY_BODY.w / 2} height={CHIMNEY_BODY.h} fill={SCENE_WALL_SHADE} />
      <rect x={CHIMNEY_BODY.x + 6} y={CHIMNEY_BODY.y + 18} width={14} height={6} rx={2} fill={SCENE_BRICK} />
      <rect x={CHIMNEY_BODY.x + 20} y={CHIMNEY_BODY.y + 34} width={12} height={6} rx={2} fill={SCENE_BRICK} />
      <rect x={CHIMNEY_BODY.x} y={CHIMNEY_BODY.y} width={CHIMNEY_BODY.w} height={CHIMNEY_BODY.h} fill={DECAY_TINTS[level]} opacity={TINT_OVERLAY_OPACITY} />
      <rect x={CHIMNEY_BODY.x - 3} y={CHIMNEY_BODY.y} width={CHIMNEY_BODY.w + 6} height={8} rx={2} fill={SCENE_TEAL_LIGHT} />
    </g>
  );
}

function renderHouse(model: SceneModel, filterIds: SceneFilterIds): ReactNode {
  const { features, level } = model;
  return (
    <g data-part="house" transform={getStructureTransform(features)}>
      {renderChimney(model)}
      {renderWalls(level, features)}
      {renderDoor()}
      {renderLantern(features, filterIds)}
      {renderRoof(features, filterIds)}
    </g>
  );
}

/** Underground cross-section: soil with a rounded top edge, stone-block lines, pebbles and roots. */
function renderBasement(): ReactNode {
  return (
    <>
      <g data-part="basement-bg">
        <rect
          x={BASEMENT_BAND.x}
          y={BASEMENT_BAND.y}
          width={BASEMENT_BAND.w}
          height={BASEMENT_BAND.h}
          rx={16}
          fill={SCENE_SOIL}
        />
        <g stroke={SCENE_STONE_LINE} strokeWidth={BLOCK_LINE_WIDTH} opacity={SOIL_LINE_OPACITY} fill="none" strokeLinecap="round">
          {BLOCK_ROWS.map((y, row) => (
            <g key={y}>
              <path d={`M${BASEMENT_BAND.x + 12} ${y} H${BASEMENT_BAND.x + BASEMENT_BAND.w - 12}`} />
              {BLOCK_TICKS[row].map((x) => (
                <path key={x} d={`M${x} ${y} V${y + 30}`} />
              ))}
            </g>
          ))}
        </g>
      </g>
      <rect
        data-part="graveyard-bg"
        x={GRAVEYARD_BAND.x}
        y={GRAVEYARD_BAND.y + 2}
        width={GRAVEYARD_BAND.w}
        height={GRAVEYARD_BAND.h - 2}
        rx={12}
        fill={SCENE_SOIL_GRAVE}
      />
      <g data-part="soil-details">
        <g fill={SCENE_STONE}>
          {PEBBLES.map((pebble) => (
            <circle key={`${pebble.cx}-${pebble.cy}`} cx={pebble.cx} cy={pebble.cy} r={pebble.r} />
          ))}
        </g>
        <g stroke={SCENE_STONE} strokeWidth={ROOT_WIDTH} strokeLinecap="round" fill="none">
          {ROOTS.map((d) => (
            <path key={d} d={d} />
          ))}
        </g>
      </g>
    </>
  );
}

/** Sky, back atmosphere, garden, house structure (walls, roof, chimney, door, lantern) and the basement and graveyard backdrops. */
export function HouseBase({ model, filterIds }: HouseBaseProps) {
  return (
    <g data-part="house-base" data-level={model.level}>
      {renderSky(model.level, filterIds)}
      {renderBackAtmosphere(model.features)}
      {renderGarden(model.features)}
      {renderHouse(model, filterIds)}
      {renderGroundCover(model.features)}
      {renderBasement()}
    </g>
  );
}
