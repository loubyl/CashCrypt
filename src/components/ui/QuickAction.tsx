"use client";

import type { LucideIcon } from "lucide-react";
import { motion, useAnimationControls, useReducedMotion, type Variants } from "framer-motion";
import { forwardRef, type ComponentPropsWithoutRef, type MouseEvent } from "react";
import {
  PRESS_DURATION_S,
  PRESS_SCALE,
  WIGGLE_DEGREES,
  WIGGLE_DURATION_S,
  type LayoutClassName,
} from "./motionTokens";

const ICON_SIZE_PX = 22;
const ICON_STROKE_WIDTH = 2;

const BASE_CLASSES =
  "inline-flex min-h-11 min-w-11 shrink-0 select-none flex-col items-center gap-2 bg-transparent font-sans text-label font-medium text-ink " +
  "outline-none focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus " +
  "disabled:cursor-not-allowed disabled:opacity-40";

const CIRCLE_CLASSES =
  "inline-flex size-13 items-center justify-center rounded-pill bg-surface-raised text-ink";

const quickActionVariants: Variants = {
  rest: { scale: 1 },
  pressed: { scale: PRESS_SCALE, transition: { duration: PRESS_DURATION_S } },
};

const iconVariants: Variants = {
  rest: { rotate: 0 },
  wiggle: {
    rotate: [0, WIGGLE_DEGREES, -WIGGLE_DEGREES, 0],
    transition: { duration: WIGGLE_DURATION_S, ease: "linear" },
  },
};

// Props that clash between native button handlers and Framer Motion's own.
type ConflictingNativeProps =
  | "className"
  | "type"
  | "children"
  | "onDrag"
  | "onDragStart"
  | "onDragEnd"
  | "onAnimationStart";

export type QuickActionProps = Omit<ComponentPropsWithoutRef<"button">, ConflictingNativeProps> & {
  icon: LucideIcon;
  /** Visible label, also the accessible name. */
  label: string;
  /** Layout utilities only (margin, width, placement). Never colors or spacing. */
  className?: LayoutClassName;
};

export const QuickAction = forwardRef<HTMLButtonElement, QuickActionProps>(function QuickAction(
  { icon: Icon, label, className, disabled, onClick, ...rest },
  ref,
) {
  const reduced = Boolean(useReducedMotion());
  const iconControls = useAnimationControls();

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (disabled) {
      event.preventDefault();
      return;
    }
    if (!reduced) {
      void iconControls.start("wiggle");
    }
    onClick?.(event);
  };

  return (
    <motion.button
      ref={ref}
      type="button"
      className={`${BASE_CLASSES} ${className ?? ""}`}
      disabled={disabled}
      data-reduced-motion={reduced ? "true" : "false"}
      variants={quickActionVariants}
      initial="rest"
      whileTap={reduced || disabled ? undefined : "pressed"}
      onClick={handleClick}
      {...rest}
    >
      <span className={CIRCLE_CLASSES}>
        <motion.span
          className="inline-flex"
          variants={iconVariants}
          initial="rest"
          animate={iconControls}
        >
          <Icon size={ICON_SIZE_PX} strokeWidth={ICON_STROKE_WIDTH} aria-hidden="true" />
        </motion.span>
      </span>
      <span>{label}</span>
    </motion.button>
  );
});
