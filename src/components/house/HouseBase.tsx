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
  SCENE_WALL_SHADE,
  VIEWBOX_HEIGHT,
  VIEWBOX_WIDTH,
} from "@/lib/scene";
import type { DecayLevel, GardenState, LevelFeatures, SceneModel, TreeState } from "@/lib/scene";
import {
  BAT_PATH,
  BATS,
  BRICK_HEIGHT,
  BRICK_RADIUS,
  BRICKS,
  BUSHES,
  CHIMNEY_BODY,
  FIREFLIES,
  FOG_BACK_BARS,
  FOG_BAR_HEIGHT,
  FOG_BARS,
  FOG_MOUND_BASE_OPACITY,
  FOG_MOUND_STEP_OPACITY,
  FOG_MOUNDS,
  FOG_OPACITY,
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
  STARS,
  STUMP_LEFT,
  STUMP_RIGHT,
  TINT_OVERLAY_OPACITY,
  TOKEN,
  TREE_LEFT_X,
  TREE_RIGHT_X,
  TUFT_PATH,
  TUFTS,
  WALL_DARK_VEIL,
  WALL_LIGHT_VEIL,
  WALLS,
  getStructureTransform,
} from "./houseGeometry";
import type { SceneFilterIds } from "./houseGeometry";

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
const TREE_BRANCHES = "M2 340 L-30 310 M1 318 L30 290 M-1 300 L-20 270 M0 292 L12 262";
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
            <path key={`${bat.x}-${bat.y}`} d={BAT_PATH} transform={`translate(${bat.x} ${bat.y})`} fill={SCENE_BAT} />
          ))}
        </g>
      ) : null}
    </g>
  );
}

const CANOPY_FULL: readonly { cx: number; cy: number; r: number }[] = [
  { cx: 0, cy: 270, r: 44 },
  { cx: -36, cy: 300, r: 32 },
  { cx: 36, cy: 300, r: 32 },
  { cx: 0, cy: 316, r: 26 },
];
const CANOPY_THIN: readonly { cx: number; cy: number; r: number }[] = [
  { cx: -30, cy: 310, r: 15 },
  { cx: 30, cy: 290, r: 15 },
  { cx: -20, cy: 270, r: 13 },
  { cx: 12, cy: 262, r: 14 },
];
const CANOPY_LIGHT_OPACITY = 0.35;
const THIN_CANOPY_OPACITY = 0.9;
const TWISTED_TRUNK = "M0 400 C-16 372 14 342 -8 312 C-20 292 6 272 -2 246";
const TWISTED_BRANCHES = "M-6 316 L-38 300 L-52 270 M-4 296 L26 288 L40 258 M2 270 L-22 250 M-2 250 L18 232";
const TRUNK_WIDTH = 9;
const BRANCH_WIDTH = 5;
const FULL_TRUNK_WIDTH = 12;

function renderCanopy(circles: readonly { cx: number; cy: number; r: number }[], opacity?: number): ReactNode {
  return (
    <g fill={SCENE_TEAL} opacity={opacity}>
      {circles.map((c) => (
        <circle key={`${c.cx}-${c.cy}`} cx={c.cx} cy={c.cy} r={c.r} />
      ))}
    </g>
  );
}

function renderTreeBody(tree: TreeState): ReactNode {
  switch (tree) {
    case "full":
      return (
        <>
          <path d="M0 400 L0 310" strokeWidth={FULL_TRUNK_WIDTH} />
          {renderCanopy(CANOPY_FULL)}
          <circle cx={-14} cy={262} r={24} fill={SCENE_TEAL_LIGHT} opacity={CANOPY_LIGHT_OPACITY} stroke="none" />
        </>
      );
    case "thin":
      return (
        <>
          <path d="M0 400 L4 330 L-2 290" strokeWidth={TRUNK_WIDTH} />
          <path d={TREE_BRANCHES} strokeWidth={BRANCH_WIDTH} />
          {renderCanopy(CANOPY_THIN, THIN_CANOPY_OPACITY)}
        </>
      );
    case "twisted":
      return (
        <>
          <path d={TWISTED_TRUNK} strokeWidth={TRUNK_WIDTH + 1} />
          <path d={TWISTED_BRANCHES} strokeWidth={BRANCH_WIDTH} strokeLinejoin="round" />
        </>
      );
    default:
      return (
        <>
          <path d="M0 400 L4 330 L-2 290" strokeWidth={TRUNK_WIDTH} />
          <path d={TREE_BRANCHES} strokeWidth={BRANCH_WIDTH} />
          {tree === "charred" ? <path d="M3 330 L6 366" stroke={SCENE_EMBER} strokeWidth={3} /> : null}
        </>
      );
  }
}

/** One tree on each side at every level; the state sets how much of it is left. */
function renderTrees(features: LevelFeatures): ReactNode {
  const stroke = features.tree === "charred" ? SCENE_CHAR : SCENE_TEAL;
  const transforms = [`translate(${TREE_LEFT_X} 0)`, `translate(${TREE_RIGHT_X} 0) scale(-1 1)`];
  return (
    <g data-part="tree" data-tree={features.tree} stroke={stroke} strokeLinecap="round" fill="none">
      {transforms.map((transform) => (
        <g key={transform} transform={transform}>
          {renderTreeBody(features.tree)}
        </g>
      ))}
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

function renderWallShapes(fill: string, collapsed: boolean, opacity?: number): ReactNode {
  return (
    <g fill={fill} opacity={opacity}>
      <polygon points={collapsed ? GABLE_WALL_COLLAPSED : GABLE_WALL} />
      <rect x={WALLS.x} y={WALLS.y} width={WALLS.w} height={WALLS.h} />
    </g>
  );
}

/** Slate walls with a subtle level tint, level veil, shaded faces and brick accents. */
function renderWalls(level: DecayLevel, collapsed: boolean): ReactNode {
  const lightVeil = WALL_LIGHT_VEIL[level];
  const darkVeil = WALL_DARK_VEIL[level];
  return (
    <g data-part="wall-surface">
      {renderWallShapes(SCENE_WALL, collapsed)}
      {collapsed ? null : <polygon points="400,84 480,196 400,196" fill={SCENE_WALL_SHADE} />}
      <rect x={WALLS.x + WALLS.w * 0.7} y={WALLS.y} width={WALLS.w * 0.3} height={WALLS.h} fill={SCENE_WALL_SHADE} />
      <rect x={WALLS.x} y={284} width={WALLS.w} height={5} fill={SCENE_WALL_SHADE} />
      {renderWallShapes(DECAY_TINTS[level], collapsed, TINT_OVERLAY_OPACITY)}
      {lightVeil ? renderWallShapes(TOKEN.ink, collapsed, lightVeil) : null}
      {darkVeil ? renderWallShapes(TOKEN.void, collapsed, darkVeil) : null}
      <g data-part="bricks" fill={SCENE_BRICK}>
        {BRICKS.map((brick) => (
          <rect key={`${brick.x}-${brick.y}`} x={brick.x} y={brick.y} width={brick.w} height={BRICK_HEIGHT} rx={BRICK_RADIUS} />
        ))}
      </g>
    </g>
  );
}

function renderDoor(): ReactNode {
  return (
    <g data-part="door">
      <path d="M370 400 V344 A30 30 0 0 1 430 344 V400 Z" fill={TOKEN.void} opacity={0.85} />
      <circle cx={420} cy={372} r={3.5} fill={DECAY_TINTS[2]} />
      <rect x={354} y={326} width={6} height={74} fill={SCENE_TEAL} />
      <rect x={440} y={326} width={6} height={74} fill={SCENE_TEAL} />
      <polygon points="346,326 400,298 454,326" fill={SCENE_TEAL} />
      <rect x={342} y={324} width={116} height={4} rx={2} fill={SCENE_TEAL_LIGHT} />
      <rect x={366} y={396} width={68} height={4} rx={2} fill={SCENE_TEAL_LIGHT} />
    </g>
  );
}

function renderHouse(model: SceneModel, filterIds: SceneFilterIds): ReactNode {
  const { features, level } = model;
  const collapsed = features.roof === "collapsed";
  return (
    <g data-part="house" transform={getStructureTransform(features)}>
      <g data-part="chimney">
        <rect x={CHIMNEY_BODY.x} y={CHIMNEY_BODY.y} width={CHIMNEY_BODY.w} height={CHIMNEY_BODY.h} fill={SCENE_WALL} />
        <rect x={CHIMNEY_BODY.x + CHIMNEY_BODY.w / 2} y={CHIMNEY_BODY.y} width={CHIMNEY_BODY.w / 2} height={CHIMNEY_BODY.h} fill={SCENE_WALL_SHADE} />
        <rect x={CHIMNEY_BODY.x} y={CHIMNEY_BODY.y} width={CHIMNEY_BODY.w} height={CHIMNEY_BODY.h} fill={DECAY_TINTS[level]} opacity={TINT_OVERLAY_OPACITY} />
        <rect x={CHIMNEY_BODY.x - 3} y={CHIMNEY_BODY.y} width={CHIMNEY_BODY.w + 6} height={8} rx={2} fill={SCENE_TEAL_LIGHT} />
      </g>
      {renderWalls(level, collapsed)}
      <rect x={WALLS.x - 4} y={GROUND_Y - 12} width={WALLS.w + 8} height={12} fill={SCENE_TEAL_LIGHT} />
      {renderDoor()}
      {renderLantern(features, filterIds)}
      {renderRoof(features)}
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
