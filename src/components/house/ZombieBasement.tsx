import { memo } from "react";
import type { ReactNode } from "react";
import { BADGE_SIZE, DECAY_TINTS, ZOMBIE_BODY, ZOMBIE_CLOTHING } from "@/lib/scene";
import type { SceneZombie, ZombieBadge, ZombiePosture } from "@/lib/scene";
import { TOKEN, isSameData } from "./houseGeometry";

export type ZombieBasementProps = {
  zombies: readonly SceneZombie[];
};

/** Local drawing space of one zombie (a 40 by 64 figure scaled to its box), facing right. */
const FIGURE_W = 40;
const FIGURE_H = 64;
const HIP = { x: 19, y: 44 } as const;
const NECK = { x: 25, y: 19 } as const;
const HEAD = { x: 27, y: 13, r: 8 } as const;
const BADGE_BACKDROP_OPACITY = 0.9;
const BADGE_RING_OPACITY = 0.35;
const BADGE_ICON_SCALE = 0.72;
const BADGE_RING_WIDTH = 1.2;
const BADGE_PAD = 2;
const TEAR_OPACITY = 0.55;

/** Hunched torso in a torn shirt (jagged hem), leaning forward from the hip. */
const SHIRT = "10,24 24,18 31,23 31,45 28,42 25,46 22,42 19,46 16,42 13,46 10,43";
const SHIRT_TEARS: readonly string[] = ["15,30 19,29 17,34", "25,36 28,34 27,39"];
/** Legs (pants) and feet. */
const LEGS: readonly { x: number; w: number }[] = [
  { x: 12, w: 6 },
  { x: 21, w: 6 },
];
const LEG_TOP = 43;
const FOOT = { h: 3, w: 9 } as const;

/** Arms per posture: shoulder pivot, length, and angle (0 points straight forward, to the right). */
type Arm = { x: number; y: number; length: number; angle: number };
const ARM_WIDTH = 5;
const HAND_RADIUS = 3;
/** Posture changes the silhouette, so usage is readable without color. */
const POSTURES: Readonly<Record<ZombiePosture, { lean: number; headDrop: number; arms: readonly Arm[] }>> = {
  // Often used: hunched, both arms reaching straight forward.
  upright: {
    lean: 6,
    headDrop: 0,
    arms: [
      { x: 22, y: 23, length: 17, angle: -4 },
      { x: 26, y: 26, length: 16, angle: 4 },
    ],
  },
  // Rarely used: more hunched, one arm forward, one dangling.
  leaning: {
    lean: 14,
    headDrop: 2,
    arms: [
      { x: 22, y: 23, length: 16, angle: 10 },
      { x: 26, y: 26, length: 15, angle: 70 },
    ],
  },
  // Never used: slumped over, both arms hanging.
  slumped: {
    lean: 24,
    headDrop: 5,
    arms: [
      { x: 22, y: 24, length: 15, angle: 78 },
      { x: 26, y: 26, length: 14, angle: 88 },
    ],
  },
};

const BADGE_PATHS: Readonly<Record<ZombieBadge, string>> = {
  flame: "M0 -9 C4 -4 7 -1 7 3 A7 7 0 0 1 -7 3 C-7 0 -5 -2 -3 -4 C-3 -1 -1 0 0 -1 C1 -4 0 -6 0 -9Z",
  hourglass: "M-6 -9 H6 V-7 C6 -3 2 -1 0 0 C2 1 6 3 6 7 V9 H-6 V7 C-6 3 -2 1 0 0 C-2 -1 -6 -3 -6 -7Z",
  skull:
    "M0 -9 C6 -9 9 -5 9 -1 C9 2 7 4 6 5 V8 H-6 V5 C-7 4 -9 2 -9 -1 C-9 -5 -6 -9 0 -9Z M-4 -2 A2 2 0 1 0 -4 2 A2 2 0 1 0 -4 -2Z M4 -2 A2 2 0 1 0 4 2 A2 2 0 1 0 4 -2Z",
};

type ZombieFigureProps = { zombie: SceneZombie };

function renderArm(arm: Arm, fill: string): ReactNode {
  return (
    <g key={`${arm.x}-${arm.y}`} transform={`rotate(${arm.angle} ${arm.x} ${arm.y})`}>
      <rect x={arm.x} y={arm.y - ARM_WIDTH / 2} width={arm.length} height={ARM_WIDTH} rx={ARM_WIDTH / 2} fill={fill} />
      <circle cx={arm.x + arm.length} cy={arm.y} r={HAND_RADIUS} fill={fill} />
    </g>
  );
}

function ZombieFigureBase({ zombie }: ZombieFigureProps) {
  const { box, posture, badge, tiltDeg, badgeCenter } = zombie;
  const shape = POSTURES[posture];
  const scaleX = box.w / FIGURE_W;
  const scaleY = box.h / FIGURE_H;
  const [backArm, frontArm] = shape.arms;
  return (
    <g data-part="zombie" data-id={zombie.id} data-usage={zombie.usage} data-posture={posture}>
      <g
        data-ambient="zombie-sway"
        data-ambient-id={zombie.id}
        data-sway-phase={zombie.swayPhase}
        data-sway-period-ms={zombie.swayPeriodMs}
      >
        <g transform={`translate(${box.x} ${box.y}) scale(${scaleX} ${scaleY})`}>
          {LEGS.map((leg) => (
            <g key={leg.x}>
              <rect x={leg.x} y={LEG_TOP} width={leg.w} height={FIGURE_H - LEG_TOP - FOOT.h} rx={2} fill={ZOMBIE_CLOTHING} />
              <rect x={leg.x} y={FIGURE_H - FOOT.h} width={FOOT.w} height={FOOT.h} rx={1.5} fill={TOKEN.void} />
            </g>
          ))}
          <g transform={`rotate(${shape.lean} ${HIP.x} ${HIP.y})`}>
            {renderArm(backArm, ZOMBIE_CLOTHING)}
            <polygon points={SHIRT} fill={ZOMBIE_CLOTHING} />
            <g fill={TOKEN.void} opacity={TEAR_OPACITY}>
              {SHIRT_TEARS.map((points) => (
                <polygon key={points} points={points} />
              ))}
            </g>
            <g transform={`translate(0 ${shape.headDrop}) rotate(${tiltDeg} ${NECK.x} ${NECK.y})`}>
              <circle cx={HEAD.x} cy={HEAD.y} r={HEAD.r} fill={ZOMBIE_BODY} />
              <path d="M20 9 Q27 5 34 9" stroke={ZOMBIE_CLOTHING} strokeWidth={2} fill="none" strokeLinecap="round" />
              <circle cx={30} cy={12} r={2.3} fill={DECAY_TINTS[1]} />
              <circle cx={30.6} cy={12.3} r={1} fill={TOKEN.void} />
              <circle cx={24.5} cy={12.6} r={1.6} fill={DECAY_TINTS[1]} />
              <circle cx={24.8} cy={12.8} r={0.8} fill={TOKEN.void} />
              <path d="M24 17.5 L26 16.5 L28 18 L30 16.8 L32 17.6" stroke={TOKEN.void} strokeWidth={1.2} fill="none" strokeLinejoin="round" />
            </g>
            {renderArm(frontArm, ZOMBIE_BODY)}
          </g>
        </g>
        <g data-part="usage-badge" data-badge={badge} transform={`translate(${badgeCenter.x} ${badgeCenter.y})`}>
          <circle r={BADGE_SIZE / 2 + BADGE_PAD} fill={TOKEN.void} opacity={BADGE_BACKDROP_OPACITY} />
          <circle r={BADGE_SIZE / 2 + BADGE_PAD} fill="none" stroke={TOKEN.ink} strokeWidth={BADGE_RING_WIDTH} opacity={BADGE_RING_OPACITY} />
          <path d={BADGE_PATHS[badge]} fill={TOKEN.ink} fillRule="evenodd" transform={`scale(${BADGE_ICON_SCALE})`} />
        </g>
      </g>
    </g>
  );
}

const ZombieFigure = memo(ZombieFigureBase, isSameData);

/** The zombie row in the basement band. An empty basement draws no figure and no text. */
export function ZombieBasement({ zombies }: ZombieBasementProps) {
  return (
    <g data-part="zombies">
      {zombies.map((zombie) => (
        <ZombieFigure key={zombie.id} zombie={zombie} />
      ))}
    </g>
  );
}
