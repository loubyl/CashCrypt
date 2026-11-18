"use client";

import { motion, useReducedMotion } from "framer-motion";
import {
  forwardRef,
  useId,
  useRef,
  type ComponentPropsWithoutRef,
  type KeyboardEvent,
} from "react";
import { getNextEnabledIndex, type SegmentNavKey } from "@/lib/utils/segmentedNav";
import { REDUCED_FADE_MAX_S, TAB_DURATION_S, type LayoutClassName } from "./motionTokens";

const TRACK_CLASSES = "inline-flex items-center gap-1 rounded-pill bg-surface-raised p-1 font-sans";

const SEGMENT_CLASSES =
  "relative inline-flex min-h-11 min-w-11 select-none items-center justify-center rounded-pill bg-transparent px-4 text-label font-medium whitespace-nowrap " +
  "outline-none focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus " +
  "disabled:cursor-not-allowed disabled:opacity-40";

const SELECTED_TEXT_CLASSES = "text-surface-void";
const UNSELECTED_TEXT_CLASSES = "text-ink-secondary";

const INDICATOR_CLASSES = "absolute inset-0 rounded-pill bg-ink";

const KEY_TO_NAV: Record<string, SegmentNavKey> = {
  ArrowRight: "next",
  ArrowDown: "next",
  ArrowLeft: "prev",
  ArrowUp: "prev",
  Home: "first",
  End: "last",
};

export type SegmentedControlOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

type ConflictingNativeProps =
  | "className"
  | "children"
  | "onChange"
  | "role"
  | "aria-label"
  | "aria-labelledby"
  | "onDrag"
  | "onDragStart"
  | "onDragEnd"
  | "onAnimationStart";

type SegmentedControlBaseProps = Omit<ComponentPropsWithoutRef<"div">, ConflictingNativeProps> & {
  options: readonly SegmentedControlOption[];
  /** Value of the selected option. */
  value: string;
  /** Called once with the new value when the selection changes. */
  onChange: (value: string) => void;
  /** Layout utilities only (margin, width, placement). Never colors or spacing. */
  className?: LayoutClassName;
};

type LabelledByAriaLabel = { "aria-label": string; "aria-labelledby"?: never };
type LabelledByElement = { "aria-labelledby": string; "aria-label"?: never };

export type SegmentedControlProps = SegmentedControlBaseProps &
  (LabelledByAriaLabel | LabelledByElement);

export const SegmentedControl = forwardRef<HTMLDivElement, SegmentedControlProps>(
  function SegmentedControl({ options, value, onChange, className, ...rest }, ref) {
    const reduced = Boolean(useReducedMotion());
    const layoutId = useId();
    const buttonRefs = useRef<Array<HTMLButtonElement | null>>([]);

    const disabledFlags = options.map((option) => Boolean(option.disabled));
    const selectedIndex = options.findIndex((option) => option.value === value);
    // Roving tabindex: the selected segment, or the first enabled one when nothing is selected.
    const tabStopIndex =
      selectedIndex >= 0 && !disabledFlags[selectedIndex]
        ? selectedIndex
        : disabledFlags.findIndex((isDisabled) => !isDisabled);

    const select = (index: number) => {
      const option = options[index];
      if (!option || option.disabled || option.value === value) return;
      onChange(option.value);
    };

    const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
      const navKey = KEY_TO_NAV[event.key];
      if (!navKey) return;
      event.preventDefault();
      const nextIndex = getNextEnabledIndex(disabledFlags, index, navKey);
      buttonRefs.current[nextIndex]?.focus();
      select(nextIndex);
    };

    const indicatorMotion = reduced
      ? {
          initial: { opacity: 0 },
          animate: { opacity: 1 },
          transition: { duration: REDUCED_FADE_MAX_S },
        }
      : {
          layoutId,
          transition: { duration: TAB_DURATION_S },
        };

    return (
      <div
        {...rest}
        ref={ref}
        role="radiogroup"
        className={`${TRACK_CLASSES} ${className ?? ""}`}
        data-reduced-motion={reduced ? "true" : "false"}
      >
        {options.map((option, index) => {
          const isSelected = index === selectedIndex;
          return (
            <button
              key={option.value}
              ref={(node) => {
                buttonRefs.current[index] = node;
              }}
              type="button"
              role="radio"
              aria-checked={isSelected}
              tabIndex={index === tabStopIndex ? 0 : -1}
              disabled={option.disabled}
              className={`${SEGMENT_CLASSES} ${
                isSelected ? SELECTED_TEXT_CLASSES : UNSELECTED_TEXT_CLASSES
              }`}
              onClick={() => select(index)}
              onKeyDown={(event) => handleKeyDown(event, index)}
            >
              {isSelected ? (
                <motion.span
                  aria-hidden="true"
                  className={INDICATOR_CLASSES}
                  {...indicatorMotion}
                />
              ) : null}
              <span className="relative">{option.label}</span>
            </button>
          );
        })}
      </div>
    );
  },
);
