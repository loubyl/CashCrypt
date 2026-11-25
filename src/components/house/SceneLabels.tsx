import {
  LABEL_LINE_HEIGHT_PX,
  MIN_LABEL_PX,
  TOMBSTONE_LABEL_MIN_SCENE_WIDTH_PX,
  VIEWBOX_HEIGHT,
  VIEWBOX_WIDTH,
  getOverflowAnchors,
  getTombstoneLabelBox,
} from "@/lib/scene";
import type { Point, SceneModel } from "@/lib/scene";

export type SceneLabelsProps = {
  model: SceneModel;
  /** Measured Scene width in CSS pixels; null before the first measurement. */
  sceneWidthPx: number | null;
};

const PERCENT = 100;

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
  const labelSceneWidthPx =
    sceneWidthPx !== null && sceneWidthPx >= TOMBSTONE_LABEL_MIN_SCENE_WIDTH_PX ? sceneWidthPx : null;

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
      {labelSceneWidthPx !== null
        ? model.tombstones.map((tombstone) => {
            // Bottom-anchored on the tombstone and capped at TOMBSTONE_LABEL_MAX_LINES lines, so the
            // label grows upward and never runs below the Scene (Requirement 5.7).
            const box = getTombstoneLabelBox(tombstone, labelSceneWidthPx);
            return (
              <div
                key={tombstone.id}
                data-part="tombstone-label"
                data-id={tombstone.id}
                className="absolute overflow-hidden text-center text-ink"
                style={{
                  ...textStyle,
                  left: toPercentX(box.x),
                  bottom: toPercentY(VIEWBOX_HEIGHT - (box.y + box.h)),
                  width: toPercentX(box.w),
                  maxHeight: toPercentY(box.h),
                }}
              >
                <div className="truncate font-medium">{tombstone.name}</div>
                <div className="truncate text-ink-secondary">{tombstone.ripText}</div>
              </div>
            );
          })
        : null}
    </div>
  );
}
