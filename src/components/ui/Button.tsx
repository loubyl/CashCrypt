"use client";

import { Check, LoaderCircle, type LucideIcon } from "lucide-react";
import { motion, useReducedMotion, type Variants } from "framer-motion";
import {
  forwardRef,
  useEffect,
  useState,
  type ComponentPropsWithoutRef,
  type MouseEvent,
  type ReactNode,
} from "react";
import {
  PRESS_DURATION_S,
  PRESS_SCALE,
  SUCCESS_MORPH_MS,
  type LayoutClassName,
} from "./motionTokens";

const ICON_SIZE_PX = 20;
const ICON_STROKE_WIDTH = 2;
const DEFAULT_SUCCESS_ANNOUNCEMENT = "Done";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: "bg-ink text-surface-void",
  secondary: "bg-surface-raised text-ink",
  ghost: "bg-transparent text-candle",
  danger: "bg-blood text-on-accent",
};

// `sm` is 36px tall; its pseudo-element adds 4px above and below for a 44px hit area.
const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: "h-9 text-label before:absolute before:inset-x-0 before:-inset-y-1 before:content-['']",
  md: "h-11 text-body",
  lg: "h-13 text-body-lg",
};

const LABELED_PADDING: Record<ButtonSize, string> = {
  sm: "px-4",
  md: "px-5",
  lg: "px-6",
};

const ICON_ONLY_WIDTH: Record<ButtonSize, string> = {
  sm: "w-9",
  md: "w-11",
  lg: "w-13",
};

const BASE_CLASSES =
  "relative inline-flex shrink-0 select-none items-center justify-center rounded-pill font-sans font-semibold " +
  "outline-none focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus " +
  "disabled:cursor-not-allowed disabled:opacity-40 aria-disabled:cursor-progress";

const buttonVariants: Variants = {
  rest: { scale: 1 },
  pressed: { scale: PRESS_SCALE, transition: { duration: PRESS_DURATION_S } },
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

type ButtonBaseProps = Omit<ComponentPropsWithoutRef<"button">, ConflictingNativeProps> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  type?: "button" | "submit" | "reset";
  /** Layout utilities only (margin, width, placement). Never colors or spacing. */
  className?: LayoutClassName;
  loading?: boolean;
  /** Morphs the label into a check for a short moment when set to true. */
  success?: boolean;
  /** Text announced to assistive technology when `success` becomes true. */
  successAnnouncement?: string;
  leadingIcon?: LucideIcon;
};

type LabeledButtonProps = ButtonBaseProps & {
  children: ReactNode;
};

// Icon-only buttons have no visible label, so they must carry an accessible name.
type IconOnlyButtonProps = ButtonBaseProps & {
  children?: undefined;
  leadingIcon: LucideIcon;
  "aria-label": string;
};

export type ButtonProps = LabeledButtonProps | IconOnlyButtonProps;

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "primary",
    size = "md",
    type = "button",
    className,
    loading = false,
    success = false,
    successAnnouncement = DEFAULT_SUCCESS_ANNOUNCEMENT,
    leadingIcon: LeadingIcon,
    disabled,
    onClick,
    children,
    ...rest
  },
  ref,
) {
  const reduced = Boolean(useReducedMotion());
  const [showCheck, setShowCheck] = useState(false);
  const [previousSuccess, setPreviousSuccess] = useState(false);

  // Adjust state during render when `success` flips on (no setState inside an effect).
  if (success !== previousSuccess) {
    setPreviousSuccess(success);
    if (success) {
      setShowCheck(true);
    }
  }

  useEffect(() => {
    if (!showCheck) {
      return;
    }
    const timer = setTimeout(() => setShowCheck(false), SUCCESS_MORPH_MS);
    return () => clearTimeout(timer);
  }, [showCheck]);

  const isInactive = Boolean(disabled) || loading;
  const hasLabel = children !== undefined && children !== null && children !== false;
  const showOverlay = loading || showCheck;

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (isInactive) {
      event.preventDefault();
      return;
    }
    onClick?.(event);
  };

  const classes = [
    BASE_CLASSES,
    VARIANT_CLASSES[variant],
    SIZE_CLASSES[size],
    hasLabel ? LABELED_PADDING[size] : ICON_ONLY_WIDTH[size],
    className ?? "",
  ].join(" ");

  return (
    <>
      <motion.button
        ref={ref}
        type={type}
        className={classes}
        disabled={disabled}
        aria-busy={loading ? true : undefined}
        aria-disabled={loading ? true : undefined}
        data-variant={variant}
        data-size={size}
        data-reduced-motion={reduced ? "true" : "false"}
        variants={buttonVariants}
        initial="rest"
        whileTap={reduced || isInactive ? undefined : "pressed"}
        onClick={handleClick}
        {...rest}
      >
        {/* Label and overlay share one grid cell, so the width never changes. */}
        <span className="inline-grid place-items-center">
          <span
            className={`col-start-1 row-start-1 inline-flex items-center gap-2 ${showOverlay ? "opacity-0" : ""}`}
          >
            {LeadingIcon ? (
              <LeadingIcon size={ICON_SIZE_PX} strokeWidth={ICON_STROKE_WIDTH} aria-hidden="true" />
            ) : null}
            {children}
          </span>
          {showOverlay ? (
            <span className="col-start-1 row-start-1 inline-flex items-center justify-center">
              {loading ? (
                <LoaderCircle
                  size={ICON_SIZE_PX}
                  strokeWidth={ICON_STROKE_WIDTH}
                  aria-hidden="true"
                  className={reduced ? "" : "animate-spin"}
                />
              ) : (
                <Check size={ICON_SIZE_PX} strokeWidth={ICON_STROKE_WIDTH} aria-hidden="true" />
              )}
            </span>
          ) : null}
        </span>
      </motion.button>
      <span className="sr-only" aria-live="polite">
        {showCheck ? successAnnouncement : ""}
      </span>
    </>
  );
});
