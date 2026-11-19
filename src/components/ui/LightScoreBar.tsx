"use client";

import { motion, useReducedMotion, type Variants } from "framer-motion";
import { forwardRef, type ComponentPropsWithoutRef } from "react";
import {
  SCORE_MAX,
  SCORE_MIN,
  clampScore,
  formatBreakdown,
  formatScoreText,
  getFillPercent,
} from "@/lib/utils/score";
import { COUNT_DURATION_S, type LayoutClassName } from "./motionTokens";

/** Percent of the fill element that the gradient image spans when the fill is the whole track. */
const FULL_PERCENT = 100;

/** Smallest fill percent used to compute the gradient size, so a zero score never divides by zero. */
const MIN_FILL_PERCENT_FOR_SIZE = 1;

const ROOT_CLASSES = "flex w-full flex-col gap-2";

// 10px pill track on the raised surface.
const TRACK_CLASSES = "h-2.5 w-full overflow-hidden rounded-pill bg-surface-raised";

const FILL_CLASSES = "h-full rounded-pill bg-[image:var(--light-score-gradient)] bg-no-repeat";

const SCORE_CLASSES = "font-display text-title text-ink tabular-nums";

const BREAKDOWN_CLASSES = "font-sans text-label text-ink-secondary";
const CAPTION_CLASSES = BREAKDOWN_CLASSES;

type FillTarget = {
  width: string;
  backgroundSize: string;
};

/**
 * Width is the score in %. The gradient is sized in % of the fill so that it always spans the
 * full track: 100 / fill * 100 percent of the fill equals the track width.
 */
function getFillTarget(score: number): FillTarget {
  const percent = getFillPercent(score);
  const sizePercent = (FULL_PERCENT * FULL_PERCENT) / Math.max(percent, MIN_FILL_PERCENT_FOR_SIZE);
  return {
    width: `${percent}%`,
    backgroundSize: `${sizePercent}% ${FULL_PERCENT}%`,
  };
}

type FillCustom = { reduced: boolean };

const fillVariants: Variants = {
  show: (custom: FillCustom & { target: FillTarget }) => ({
    ...custom.target,
    transition: { duration: custom.reduced ? 0 : COUNT_DURATION_S },
  }),
};

type OwnPropNames =
  | "caption"
  | "score"
  | "baseScore"
  | "momentum"
  | "aria-label"
  | "className"
  | "children";

type NativeProps = Omit<ComponentPropsWithoutRef<"div">, OwnPropNames | "role">;

export type LightScoreBarProps = NativeProps & {
  /** Light score, 0 to 100. Values outside the range are clamped. */
  score: number;
  /** Base part of the score. The breakdown line renders only when this and `momentum` are given. */
  baseScore?: number;
  /** Momentum part of the score. */
  momentum?: number;
  /**
   * Replaces the score number above the track. Use only when the score is already shown next to
   * the bar (for example by a BalanceHero in the same card). A string renders as a caption, null
   * renders nothing. Omitted: the score number. `aria-valuetext` always states the score.
   */
  caption?: string | null;
  /** Accessible name of the meter. Required. */
  "aria-label": string;
  /** Layout utilities only (margin, width, grid placement). Never colors or spacing. */
  className?: LayoutClassName;
};

export const LightScoreBar = forwardRef<HTMLDivElement, LightScoreBarProps>(
  function LightScoreBar(
    { score, baseScore, momentum, caption, "aria-label": ariaLabel, className, ...rest },
    ref,
  ) {
    const reduced = Boolean(useReducedMotion());
    const clamped = clampScore(score);
    const scoreText = formatScoreText(score);
    const showBreakdown = baseScore !== undefined && momentum !== undefined;
    const classes = [ROOT_CLASSES, className ?? ""].filter(Boolean).join(" ");
    const target = getFillTarget(score);

    return (
      <div
        {...rest}
        ref={ref}
        role="meter"
        aria-label={ariaLabel}
        aria-valuemin={SCORE_MIN}
        aria-valuemax={SCORE_MAX}
        aria-valuenow={clamped}
        aria-valuetext={`Light score ${scoreText} of ${SCORE_MAX}`}
        className={classes}
        data-reduced-motion={reduced ? "true" : "false"}
      >
        {caption === undefined ? (
          <span className={SCORE_CLASSES}>{scoreText}</span>
        ) : caption === null ? null : (
          <span className={CAPTION_CLASSES}>{caption}</span>
        )}
        <div className={TRACK_CLASSES}>
          <motion.div
            className={FILL_CLASSES}
            variants={fillVariants}
            initial={false}
            animate="show"
            custom={{ reduced, target }}
          />
        </div>
        {showBreakdown ? (
          <span className={BREAKDOWN_CLASSES}>{formatBreakdown(baseScore, momentum, clamped)}</span>
        ) : null}
      </div>
    );
  },
);
