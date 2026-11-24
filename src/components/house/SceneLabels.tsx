import {
  MIN_LABEL_PX,
  TOMBSTONE_LABEL_MIN_SCENE_WIDTH_PX,
  TOMBSTONE_SLOT_UNITS,
  VIEWBOX_HEIGHT,
  VIEWBOX_WIDTH,
  getOverflowAnchors,
} from "@/lib/scene";
import type { Point, SceneModel } from "@/lib/scene";

export type SceneLabelsProps = {
  model: SceneModel;
  /** Measured Scene width in CSS pixels; null before the first measurement. */
  sceneWidthPx: number | null;
};

const PERCENT = 100;
/** Tombstone label starts this far below the top of its box (ViewBox units), under the engraved cross. */
const TOMBSTONE_LABEL_TOP_OFFSET = 22;
const LABEL_LINE_HEIGHT_PX = MIN_LABEL_PX + 2;

function toPercentX(x: number): string {
  return `${(x / VIEWBOX_WIDTH) * PERCENT}%`;
}

function toPercentY(y: number): string {
  return `${(y / VIEWBOX_HEIGHT) * PERCENT}%`;
}

const textStyle = { fontSize: MIN_LABEL_PX, lineHeight: `${LABEL_LINE_HEIGHT_PX}px` } as const;

type OverflowMarkerProps = { kind: string; count: number; anchor: Point };

/** "+N" marker whose bottom-right corner sits on the anchor, so it stays inside the Scene. */
function OverflowMarker({ kind, count, anchor }: OverflowMarkerProps) {
  return (
    <span
      data-part="overflow-marker"
      data-kind={kind}
      className="absolute whitespace-nowrap font-medium tabular-nums text-ink-secondary"
      style={{
        ...textStyle,
        left: toPercentX(anchor.x),
        top: toPercentY(anchor.y),
        transform: "translate(-100%, -100%)",
      }}
    >
      {`+${count}`}
    </span>
  );
}

/**
 * HTML text overlay for the Scene (design D2): "+N" markers and tombstone labels in real pixels.
 * Tombstone labels need the measured width to reach the minimum; an unmeasured width hides them.
 */
export function SceneLabels({ model, sceneWidthPx }: SceneLabelsProps) {
  const anchors = getOverflowAnchors();
  const showTombstoneLabels = sceneWidthPx !== null && sceneWidthPx >= TOMBSTONE_LABEL_MIN_SCENE_WIDTH_PX;

  return (
    <div aria-hidden="true" data-part="labels" className="pointer-events-none absolute inset-0">
      {model.overflow.zombies > 0 ? (
        <OverflowMarker kind="zombies" count={model.overflow.zombies} anchor={anchors.zombies} />
      ) : null}
      {model.overflow.ghosts > 0 ? (
        <OverflowMarker kind="ghosts" count={model.overflow.ghosts} anchor={anchors.ghosts} />
      ) : null}
      {model.overflow.tombstones > 0 ? (
        <OverflowMarker kind="tombstones" count={model.overflow.tombstones} anchor={anchors.tombstones} />
      ) : null}
      {showTombstoneLabels
        ? model.tombstones.map((tombstone) => (
            <div
              key={tombstone.id}
              data-part="tombstone-label"
              data-id={tombstone.id}
              className="absolute text-center text-ink"
              style={{
                ...textStyle,
                left: toPercentX(tombstone.box.x + tombstone.box.w / 2 - TOMBSTONE_SLOT_UNITS / 2),
                top: toPercentY(tombstone.box.y + TOMBSTONE_LABEL_TOP_OFFSET),
                width: toPercentX(TOMBSTONE_SLOT_UNITS),
              }}
            >
              <div className="truncate font-medium">{tombstone.name}</div>
              <div className="text-ink-secondary">{tombstone.ripText}</div>
            </div>
          ))
        : null}
    </div>
  );
}
