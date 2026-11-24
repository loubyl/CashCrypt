import { memo } from "react";
import { BADGE_SIZE, ZOMBIE_BODY, ZOMBIE_CLOTHING } from "@/lib/scene";
import type { SceneZombie, ZombieBadge, ZombiePosture } from "@/lib/scene";
import { TOKEN, isSameData } from "./houseGeometry";

export type ZombieBasementProps = {
  zombies: readonly SceneZombie[];
};

/** Local drawing space of one zombie (a 40 by 64 figure scaled to its box). */
const FIGURE_W = 40;
const FIGURE_H = 64;
const HIP = { x: 20, y: 46 } as const;
const NECK = { x: 20, y: 19 } as const;
const SHOULDER_LEFT = { x: 8, y: 23 } as const;
const SHOULDER_RIGHT = { x: 32, y: 23 } as const;
const HEAD = { x: 20, y: 11, r: 8 } as const;
const EYE_OFFSET_X = 3;
const EYE_RADIUS = 1.4;
const BODY_RADIUS = 5;
const ARM = { w: 5, h: 20, r: 2.5 } as const;
const LEG = { w: 6, h: 18, r: 2 } as const;
const LEG_LEFT_X = 12;
const LEG_RIGHT_X = 22;
const TORSO = { x: 9, y: 19, w: 22, h: 29 } as const;
const BADGE_CENTER_Y_RATIO = 0.5;
const BADGE_BACKDROP_OPACITY = 0.85;
const BADGE_ICON_SCALE = 0.7;

/** Posture changes the silhouette, so usage is readable without color. */
const POSTURES: Readonly<Record<ZombiePosture, { lean: number; armSwing: number; headDrop: number }>> = {
  upright: { lean: 0, armSwing: 6, headDrop: 0 },
  leaning: { lean: 12, armSwing: 55, headDrop: 1 },
  slumped: { lean: 28, armSwing: 2, headDrop: 4 },
};

const BADGE_PATHS: Readonly<Record<ZombieBadge, string>> = {
  flame: "M0 -9 C4 -4 7 -1 7 3 A7 7 0 0 1 -7 3 C-7 0 -5 -2 -3 -4 C-3 -1 -1 0 0 -1 C1 -4 0 -6 0 -9Z",
  hourglass: "M-6 -9 H6 V-7 C6 -3 2 -1 0 0 C2 1 6 3 6 7 V9 H-6 V7 C-6 3 -2 1 0 0 C-2 -1 -6 -3 -6 -7Z",
  skull:
    "M0 -9 C6 -9 9 -5 9 -1 C9 2 7 4 6 5 V8 H-6 V5 C-7 4 -9 2 -9 -1 C-9 -5 -6 -9 0 -9Z M-4 -2 A2 2 0 1 0 -4 2 A2 2 0 1 0 -4 -2Z M4 -2 A2 2 0 1 0 4 2 A2 2 0 1 0 4 -2Z",
};

type ZombieFigureProps = { zombie: SceneZombie };

function ZombieFigureBase({ zombie }: ZombieFigureProps) {
  const { box, posture, badge, tiltDeg } = zombie;
  const shape = POSTURES[posture];
  const scaleX = box.w / FIGURE_W;
  const scaleY = box.h / FIGURE_H;
  return (
    <g data-part="zombie" data-id={zombie.id} data-usage={zombie.usage} data-posture={posture}>
      <g
        data-ambient="zombie-sway"
        data-ambient-id={zombie.id}
        data-sway-phase={zombie.swayPhase}
        data-sway-period-ms={zombie.swayPeriodMs}
      >
        <g transform={`translate(${box.x} ${box.y}) scale(${scaleX} ${scaleY})`}>
          <rect x={LEG_LEFT_X} y={HIP.y} width={LEG.w} height={LEG.h} rx={LEG.r} fill={ZOMBIE_CLOTHING} />
          <rect x={LEG_RIGHT_X} y={HIP.y} width={LEG.w} height={LEG.h} rx={LEG.r} fill={ZOMBIE_CLOTHING} />
          <g transform={`rotate(${shape.lean} ${HIP.x} ${HIP.y})`}>
            <g transform={`rotate(${shape.armSwing} ${SHOULDER_LEFT.x} ${SHOULDER_LEFT.y})`}>
              <rect x={SHOULDER_LEFT.x - ARM.w / 2} y={SHOULDER_LEFT.y} width={ARM.w} height={ARM.h} rx={ARM.r} fill={ZOMBIE_BODY} />
            </g>
            <g transform={`rotate(${-shape.armSwing} ${SHOULDER_RIGHT.x} ${SHOULDER_RIGHT.y})`}>
              <rect x={SHOULDER_RIGHT.x - ARM.w / 2} y={SHOULDER_RIGHT.y} width={ARM.w} height={ARM.h} rx={ARM.r} fill={ZOMBIE_BODY} />
            </g>
            <rect x={TORSO.x} y={TORSO.y} width={TORSO.w} height={TORSO.h} rx={BODY_RADIUS} fill={ZOMBIE_CLOTHING} />
            <g transform={`translate(0 ${shape.headDrop}) rotate(${tiltDeg} ${NECK.x} ${NECK.y})`}>
              <circle cx={HEAD.x} cy={HEAD.y} r={HEAD.r} fill={ZOMBIE_BODY} />
              <circle cx={HEAD.x - EYE_OFFSET_X} cy={HEAD.y - 1} r={EYE_RADIUS} fill={TOKEN.void} />
              <circle cx={HEAD.x + EYE_OFFSET_X} cy={HEAD.y - 1} r={EYE_RADIUS} fill={TOKEN.void} />
            </g>
          </g>
        </g>
        <g
          data-part="usage-badge"
          data-badge={badge}
          transform={`translate(${box.x + box.w / 2} ${box.y + box.h * BADGE_CENTER_Y_RATIO})`}
        >
          <circle r={BADGE_SIZE / 2} fill={TOKEN.void} opacity={BADGE_BACKDROP_OPACITY} />
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
