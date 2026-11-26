"use client";

import { CircleCheck, Info, OctagonAlert, TriangleAlert, type LucideIcon } from "lucide-react";
import { motion, useReducedMotion, type Variants } from "framer-motion";
import { useEffect, useRef, useState, type FocusEvent } from "react";
import type { ToastTone } from "@/lib/utils/toastReducer";
import { Button } from "./Button";
import {
  REDUCED_FADE_MAX_S,
  SHEET_DURATION_S,
  TOAST_DEFAULT_DURATION_MS,
  TOAST_RISE_PX,
  type LayoutClassName,
} from "./motionTokens";

const ICON_SIZE_PX = 20;
const ICON_STROKE_WIDTH = 2;

// Each tone has its own icon shape, so color is never the only signal.
const TONE_ICONS: Record<ToastTone, LucideIcon> = {
  success: CircleCheck,
  info: Info,
  warning: TriangleAlert,
  danger: OctagonAlert,
};

const TONE_ICON_CLASSES: Record<ToastTone, string> = {
  success: "text-ecto",
  info: "text-ghost",
  warning: "text-candle",
  danger: "text-blood",
};

const TOAST_CLASSES =
  "inline-flex max-w-full min-h-11 items-center gap-3 rounded-pill bg-surface-overlay py-1 pl-4 pr-4 " +
  "font-sans text-body text-ink shadow-overlay";

const toastVariants: Variants = {
  hidden: (reduced: boolean) => ({ opacity: 0, y: reduced ? 0 : TOAST_RISE_PX }),
  visible: (reduced: boolean) => ({
    opacity: 1,
    y: 0,
    transition: { duration: reduced ? REDUCED_FADE_MAX_S : SHEET_DURATION_S },
  }),
  // Reduced motion removes the toast immediately (zero-length exit).
  exit: (reduced: boolean) => ({
    opacity: 0,
    y: 0,
    transition: { duration: reduced ? 0 : SHEET_DURATION_S },
  }),
};

export type ToastProps = {
  tone: ToastTone;
  /** Message text. It wraps onto several lines when long. */
  message: string;
  /** Time in milliseconds before `onDismiss` is called. Default 4000. */
  duration?: number;
  /** When set, renders a ghost action button with this label. */
  actionLabel?: string;
  /** Sets the action button's `aria-label` (for example "Undo: Spotify canceled"). */
  actionAccessibleName?: string;
  /** Called when the action button is pressed, right before the toast dismisses itself. */
  onAction?: () => void;
  /**
   * Called exactly once: when the timer elapses or right after the action runs, whichever
   * comes first. The parent removes the Toast.
   */
  onDismiss: () => void;
  /** Layout utilities only (margin, width, placement). Never colors or spacing. */
  className?: LayoutClassName;
};

export function Toast({
  tone,
  message,
  duration = TOAST_DEFAULT_DURATION_MS,
  actionLabel,
  actionAccessibleName,
  onAction,
  onDismiss,
  className,
}: ToastProps) {
  const reduced = Boolean(useReducedMotion());
  const [pointerInside, setPointerInside] = useState(false);
  const [focusInside, setFocusInside] = useState(false);
  const paused = pointerInside || focusInside;

  const onDismissRef = useRef(onDismiss);
  const remainingRef = useRef(duration);
  const startedAtRef = useRef(0);
  const firedRef = useRef(false);

  useEffect(() => {
    onDismissRef.current = onDismiss;
  }, [onDismiss]);

  useEffect(() => {
    if (paused) {
      return;
    }
    startedAtRef.current = Date.now();
    const timer = setTimeout(() => {
      if (firedRef.current) {
        return;
      }
      firedRef.current = true;
      onDismissRef.current();
    }, remainingRef.current);
    return () => {
      clearTimeout(timer);
      remainingRef.current = Math.max(0, remainingRef.current - (Date.now() - startedAtRef.current));
    };
  }, [paused]);

  // The action runs once and then dismisses this toast. firedRef is shared with the timer,
  // so a second click or a later timeout does nothing.
  const handleAction = () => {
    if (firedRef.current) {
      return;
    }
    firedRef.current = true;
    try {
      onAction?.();
    } finally {
      onDismissRef.current();
    }
  };

  const handleBlur = (event: FocusEvent<HTMLDivElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget)) {
      setFocusInside(false);
    }
  };

  const Icon = TONE_ICONS[tone];
  const classes = [TOAST_CLASSES, className ?? ""].filter(Boolean).join(" ");

  return (
    <motion.div
      className={classes}
      data-tone={tone}
      data-reduced-motion={reduced ? "true" : "false"}
      variants={toastVariants}
      custom={reduced}
      initial="hidden"
      animate="visible"
      exit="exit"
      onPointerEnter={() => setPointerInside(true)}
      onPointerLeave={() => setPointerInside(false)}
      onFocus={() => setFocusInside(true)}
      onBlur={handleBlur}
    >
      <Icon
        size={ICON_SIZE_PX}
        strokeWidth={ICON_STROKE_WIDTH}
        aria-hidden="true"
        className={`shrink-0 ${TONE_ICON_CLASSES[tone]}`}
      />
      <span className="min-w-0 text-pretty">{message}</span>
      {actionLabel ? (
        <Button variant="ghost" size="sm" aria-label={actionAccessibleName} onClick={handleAction}>
          {actionLabel}
        </Button>
      ) : null}
    </motion.div>
  );
}
