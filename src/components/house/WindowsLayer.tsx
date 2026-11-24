import type { ReactNode } from "react";
import { SCENE_TEAL_LIGHT, WINDOW_INTERPOLATION_MS } from "@/lib/scene";
import type { SceneModel, SceneWindow } from "@/lib/scene";
import { TOKEN, getStructureTransform } from "./houseGeometry";

export type WindowsLayerProps = {
  model: SceneModel;
};

const GLOW_PAD = 10;
const GLOW_FACTOR = 0.3;
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
      stroke={TOKEN.void}
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

function renderLit(window: SceneWindow): ReactNode {
  const { x, y, w, h } = window.box;
  return (
    <>
      <g
        data-part="glow"
        className="transition-opacity motion-reduce:transition-none"
        style={{ transitionDuration: `${WINDOW_INTERPOLATION_MS}ms` }}
        opacity={window.opacity * GLOW_FACTOR}
      >
        {renderShape(window, GLOW_PAD, TOKEN.candle)}
      </g>
      {renderShape(window, 0, TOKEN.void)}
      <g
        data-part="light"
        className="transition-opacity motion-reduce:transition-none"
        style={{ transitionDuration: `${WINDOW_INTERPOLATION_MS}ms` }}
        opacity={window.opacity}
      >
        {renderShape(window, 0, TOKEN.candle)}
        <rect x={x + w / 2 - 2} y={y + h - 16} width={4} height={12} rx={1} fill={TOKEN.void} opacity={0.35} />
      </g>
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

function renderWindow(window: SceneWindow): ReactNode {
  return (
    <g key={window.index} data-part={`window:${window.index}`} data-state={window.state} data-shape={window.shape}>
      {window.state === "lit" ? renderLit(window) : null}
      {window.state === "boarded" ? renderBoarded(window) : null}
      {window.state === "broken" ? renderBroken(window) : null}
      {renderSill(window)}
    </g>
  );
}

/** Six windows with candlelight, boards or broken glass. Opacity comes straight from the model. */
export function WindowsLayer({ model }: WindowsLayerProps) {
  return (
    <g data-part="windows" transform={getStructureTransform(model.features)}>
      {model.windows.map(renderWindow)}
    </g>
  );
}
