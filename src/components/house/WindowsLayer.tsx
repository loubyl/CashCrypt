import type { ReactNode } from "react";
import { DECAY_TINTS, SCENE_TEAL, SCENE_TEAL_LIGHT, WINDOW_INTERPOLATION_MS } from "@/lib/scene";
import type { SceneModel, SceneWindow } from "@/lib/scene";
import { TOKEN, getStructureTransform } from "./houseGeometry";
import type { SceneFilterIds } from "./houseGeometry";

export type WindowsLayerProps = {
  model: SceneModel;
  filterIds: SceneFilterIds;
};

/** Model opacity (0..1) maps linearly to halo strength and pane brightness, so even 0.26 reads as lit. */
const HALO_PAD = 8;
const HALO_MIN = 0.25;
const HALO_RANGE = 0.6;
const PANE_MIN = 0.6;
const PANE_RANGE = 0.4;
const FRAME_PAD = 3;
const CANDLE_WIDTH = 5;
const CANDLE_HEIGHT = 12;
const FLAME_RX = 2.6;
const FLAME_RY = 4.2;
const FLAME_LIFT = 4;
const CANDLE_BASE_GAP = 4;
const SILL_HEIGHT = 5;
const MULLION_WIDTH = 2.5;
const PLANK_WIDTH = 8;
const FRAME_FILL_OPACITY = 0.9;

/** Outline of the pane for each window shape. */
function paneProps(window: SceneWindow, pad = 0): { d?: string; cx?: number; cy?: number; r?: number } {
  const { x, y, w, h } = window.box;
  if (window.shape === "round") {
    return { cx: x + w / 2, cy: y + h / 2, r: w / 2 + pad };
  }
  if (window.shape === "arched") {
    const radius = w / 2 + pad;
    const left = x - pad;
    const right = x + w + pad;
    const top = y + w / 2;
    return {
      d: `M${left} ${y + h + pad} V${top} A${radius} ${radius} 0 0 1 ${right} ${top} V${y + h + pad} Z`,
    };
  }
  return { d: `M${x - pad} ${y - pad} H${x + w + pad} V${y + h + pad} H${x - pad} Z` };
}

function renderShape(window: SceneWindow, pad: number, fill: string, opacity?: number): ReactNode {
  const props = paneProps(window, pad);
  if (props.d) return <path d={props.d} fill={fill} opacity={opacity} />;
  return <circle cx={props.cx} cy={props.cy} r={props.r} fill={fill} opacity={opacity} />;
}

function renderMullions(window: SceneWindow): ReactNode {
  const { x, y, w, h } = window.box;
  const cx = x + w / 2;
  const cy = y + h / 2;
  return (
    <path
      d={`M${cx} ${y} V${y + h} M${x} ${cy} H${x + w}`}
      stroke={SCENE_TEAL}
      strokeWidth={MULLION_WIDTH}
      fill="none"
    />
  );
}

function renderSill(window: SceneWindow): ReactNode {
  const { x, y, w, h } = window.box;
  if (window.shape === "round") return null;
  return <rect x={x - 4} y={y + h} width={w + 8} height={SILL_HEIGHT} fill={SCENE_TEAL_LIGHT} />;
}

function renderCandle(window: SceneWindow): ReactNode {
  const { x, y, w, h } = window.box;
  const cx = x + w / 2;
  const top = y + h - CANDLE_BASE_GAP - CANDLE_HEIGHT;
  return (
    <g data-part="candle">
      <rect x={cx - CANDLE_WIDTH / 2} y={top} width={CANDLE_WIDTH} height={CANDLE_HEIGHT} rx={1.5} fill={DECAY_TINTS[1]} />
      <ellipse cx={cx} cy={top - FLAME_LIFT} rx={FLAME_RX} ry={FLAME_RY} fill={DECAY_TINTS[2]} />
    </g>
  );
}

function renderLit(window: SceneWindow, filterIds: SceneFilterIds): ReactNode {
  return (
    <>
      <g
        data-part="glow"
        className="transition-opacity motion-reduce:transition-none"
        style={{ transitionDuration: `${WINDOW_INTERPOLATION_MS}ms` }}
        opacity={HALO_MIN + HALO_RANGE * window.opacity}
        filter={`url(#${filterIds.halo})`}
      >
        {renderShape(window, HALO_PAD, TOKEN.candle)}
      </g>
      {renderShape(window, FRAME_PAD, SCENE_TEAL)}
      {renderShape(window, 0, TOKEN.void)}
      <g
        data-part="light"
        className="transition-opacity motion-reduce:transition-none"
        style={{ transitionDuration: `${WINDOW_INTERPOLATION_MS}ms` }}
        opacity={PANE_MIN + PANE_RANGE * window.opacity}
      >
        {renderShape(window, 0, TOKEN.candle)}
      </g>
      {renderCandle(window)}
      {renderMullions(window)}
    </>
  );
}

/** Boarded: two crossed planks over a dark pane. */
function renderBoarded(window: SceneWindow): ReactNode {
  const { x, y, w, h } = window.box;
  return (
    <>
      {renderShape(window, 0, TOKEN.void, FRAME_FILL_OPACITY)}
      <path
        d={`M${x - 4} ${y + 6} L${x + w + 4} ${y + h - 6} M${x + w + 4} ${y + 6} L${x - 4} ${y + h - 6}`}
        stroke={SCENE_TEAL_LIGHT}
        strokeWidth={PLANK_WIDTH}
        strokeLinecap="butt"
        fill="none"
      />
    </>
  );
}

/** Broken: a dark pane with jagged glass teeth along the frame and a gap at the center. */
function renderBroken(window: SceneWindow): ReactNode {
  const { x, y, w, h } = window.box;
  const third = w / 3;
  return (
    <>
      {renderShape(window, 0, TOKEN.void, FRAME_FILL_OPACITY)}
      <g fill={TOKEN.overlay}>
        <polygon points={`${x},${y + h} ${x + third / 2},${y + h * 0.55} ${x + third},${y + h}`} />
        <polygon points={`${x + third},${y + h} ${x + third * 1.6},${y + h * 0.7} ${x + third * 2},${y + h}`} />
        <polygon points={`${x + third * 2},${y + h} ${x + third * 2.5},${y + h * 0.5} ${x + w},${y + h}`} />
        <polygon points={`${x},${y + h * 0.3} ${x + third * 0.7},${y + h * 0.15} ${x + third * 0.4},${y + h * 0.42}`} />
        <polygon points={`${x + w},${y + h * 0.3} ${x + w - third * 0.7},${y + h * 0.12} ${x + w - third * 0.4},${y + h * 0.4}`} />
      </g>
    </>
  );
}

function renderWindow(window: SceneWindow, filterIds: SceneFilterIds, unlitOpacity: number): ReactNode {
  const lit = window.state === "lit";
  return (
    <g
      key={window.index}
      data-part={`window:${window.index}`}
      data-state={window.state}
      data-shape={window.shape}
      opacity={lit ? undefined : unlitOpacity}
    >
      {lit ? renderLit(window, filterIds) : null}
      {window.state === "boarded" ? renderBoarded(window) : null}
      {window.state === "broken" ? renderBroken(window) : null}
      {renderSill(window)}
    </g>
  );
}

/**
 * Six windows with candlelight, boards or broken glass. Opacity comes straight from the model.
 * Drawn above the darkness overlay so lit windows stay the brightest element; windows that
 * give no light are dimmed by the same amount as the rest of the house.
 */
export function WindowsLayer({ model, filterIds }: WindowsLayerProps) {
  const unlitOpacity = 1 - model.features.darkness;
  return (
    <g data-part="windows" transform={getStructureTransform(model.features)}>
      {model.windows.map((window) => renderWindow(window, filterIds, unlitOpacity))}
    </g>
  );
}
