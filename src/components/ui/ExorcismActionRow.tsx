"use client";

import { forwardRef, type ChangeEvent } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Check } from "lucide-react";
import { REDUCED_FADE_MAX_S, TAB_DURATION_S, type LayoutClassName } from "./motionTokens";

const CHECK_ICON_SIZE_PX = 16;
const CHECK_ICON_STROKE_WIDTH = 3;
const MS_PER_S = 1000;
const IMPACT_SIGN = "+";
const IMPACT_SUFFIX = "/mo";

// Same row metrics as ListRow (at least 64px high, 12px gap). The title may wrap to two lines so
// the saving in it stays visible; the row then grows instead of truncating.
const ROW_CLASSES = "relative flex min-h-16 w-full items-center gap-3 py-2 text-left font-sans";

// 44px touch target around the 24px round checkbox.
const TARGET_CLASSES = "relative inline-flex size-11 shrink-0 cursor-pointer items-center justify-center";

const CHECKBOX_CLASSES =
  "size-6 shrink-0 cursor-pointer appearance-none rounded-circle border-2 border-control bg-transparent outline-none " +
  "transition-colors checked:border-candle checked:bg-candle " +
  "focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus " +
  "disabled:cursor-not-allowed disabled:opacity-40 aria-disabled:cursor-not-allowed aria-disabled:opacity-40";

export type ExorcismActionRowProps = {
  /** Id of the native checkbox. Required so the row can be targeted and labelled. */
  id: string;
  title: string;
  subtitle?: string;
  /** Monthly impact without sign or suffix, for example "$22.99". When omitted, no impact is rendered. */
  impactText?: string;
  done: boolean;
  /** Called once per activation with the next done value. */
  onToggle: (next: boolean) => void;
  disabled?: boolean;
  /**
   * Busy while a save runs. Unlike `disabled`, the checkbox stays focusable (aria-disabled and
   * aria-busy), so keyboard focus is not lost. Changes are ignored until it clears.
   */
  pending?: boolean;
  /** Layout utilities only (margin, width, grid placement). Never colors or spacing. */
  className?: LayoutClassName;
};

export const ExorcismActionRow = forwardRef<HTMLDivElement, ExorcismActionRowProps>(
  function ExorcismActionRow(
    { id, title, subtitle, impactText, done, onToggle, disabled = false, pending = false, className },
    ref,
  ) {
    const reduced = useReducedMotion();
    const fillDurationS = reduced ? REDUCED_FADE_MAX_S : TAB_DURATION_S;
    const rowColor = done ? "text-ink-tertiary" : "text-ink";
    const impactColor = done ? "text-ink-tertiary" : "text-ecto";
    const subtitleColor = done ? "text-ink-tertiary" : "text-ink-secondary";

    const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
      if (disabled || pending) {
        return;
      }
      onToggle(event.target.checked);
    };

    return (
      <motion.div
        ref={ref}
        data-reduced-motion={reduced ? "true" : "false"}
        data-done={done ? "true" : "false"}
        className={[ROW_CLASSES, className ?? ""].filter(Boolean).join(" ")}
      >
        <label className={TARGET_CLASSES}>
          <input
            id={id}
            type="checkbox"
            checked={done}
            disabled={disabled}
            aria-disabled={pending ? true : undefined}
            aria-busy={pending ? true : undefined}
            onChange={handleChange}
            aria-label={`Mark "${title}" as done`}
            className={CHECKBOX_CLASSES}
            style={{ transitionDuration: `${Math.round(fillDurationS * MS_PER_S)}ms` }}
          />
          <motion.span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 flex items-center justify-center text-on-accent"
            initial={false}
            animate={{ opacity: done ? 1 : 0 }}
            transition={{ duration: fillDurationS }}
          >
            <Check size={CHECK_ICON_SIZE_PX} strokeWidth={CHECK_ICON_STROKE_WIDTH} aria-hidden="true" />
          </motion.span>
        </label>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className={`line-clamp-2 text-body-lg ${rowColor} ${done ? "line-through" : ""}`}>{title}</span>
          {subtitle ? <span className={`truncate text-caption ${subtitleColor}`}>{subtitle}</span> : null}
        </span>
        {impactText ? (
          <span className={`shrink-0 text-right text-body-lg tabular-nums ${impactColor}`}>
            {IMPACT_SIGN}
            {impactText}
            {IMPACT_SUFFIX}
          </span>
        ) : null}
      </motion.div>
    );
  },
);
