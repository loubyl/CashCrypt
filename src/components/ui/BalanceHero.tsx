"use client";

import { animate, useMotionValue, useReducedMotion } from "framer-motion";
import { ArrowDown, ArrowUp } from "lucide-react";
import { forwardRef, useEffect, useState, type ComponentPropsWithoutRef } from "react";
import { getDeltaPresentation, type DeltaDirection, type DeltaIntent } from "@/lib/utils/delta";
import { formatCurrencyParts } from "@/lib/utils/money";
import { SCORE_MAX, formatScoreText } from "@/lib/utils/score";
import { Chip } from "./Chip";
import { COUNT_DURATION_S, type LayoutClassName } from "./motionTokens";

const ROOT_CLASSES = "flex flex-col items-start gap-1";
const LABEL_CLASSES = "font-sans text-body text-ink-secondary";
const VALUE_CLASSES = "font-display text-hero text-ink tabular-nums";
// Cents (and the "/100" suffix) render at 60% of the hero size.
const SMALL_PART_CLASSES = "text-[0.6em]";
const MAX_SUFFIX_CLASSES = "text-[0.6em] text-ink-secondary";
const DELTA_ICON: Record<"arrow-up" | "arrow-down", typeof ArrowUp> = {
  "arrow-up": ArrowUp,
  "arrow-down": ArrowDown,
};

const CURRENCY_DECIMAL = ".";
const MAX_SUFFIX = `/${SCORE_MAX}`;

export type BalanceHeroFormat = "currency" | "score";

export type BalanceHeroDelta = {
  /** Which way the number moved. Drives the sign and the arrow. */
  direction: DeltaDirection;
  /** Whether the move is good or bad. Drives the color tone. Independent of direction. */
  intent: DeltaIntent;
  /** Pre-formatted amount text without a sign, for example "$120.00". */
  amount: string;
};

type OwnPropNames = "label" | "value" | "format" | "showMax" | "delta" | "className" | "children";

type NativeProps = Omit<ComponentPropsWithoutRef<"div">, OwnPropNames>;

export type BalanceHeroProps = NativeProps & {
  /** Short label above the value. */
  label: string;
  /** Currency amount, or a light score from 0 to 100 when `format="score"`. */
  value: number;
  /** `currency` (default) or `score`. */
  format?: BalanceHeroFormat;
  /** Score format only: append the "/100" suffix. */
  showMax?: boolean;
  /** Optional change indicator rendered as a Chip. */
  delta?: BalanceHeroDelta;
  /** Layout utilities only (margin, width, grid placement). Never colors or spacing. */
  className?: LayoutClassName;
};

function getFinalText(value: number, format: BalanceHeroFormat, showMax: boolean): string {
  if (format === "score") {
    const text = formatScoreText(value);
    return showMax ? `${text} out of ${SCORE_MAX}` : text;
  }
  const { symbol, integer, cents } = formatCurrencyParts(value);
  return `${symbol}${integer}${CURRENCY_DECIMAL}${cents}`;
}

export const BalanceHero = forwardRef<HTMLDivElement, BalanceHeroProps>(function BalanceHero(
  { label, value, format = "currency", showMax = false, delta, className, ...rest },
  ref,
) {
  const reduced = Boolean(useReducedMotion());
  const motionValue = useMotionValue(value);
  const [displayed, setDisplayed] = useState(value);

  useEffect(() => {
    const unsubscribe = motionValue.on("change", setDisplayed);
    return unsubscribe;
  }, [motionValue]);

  useEffect(() => {
    if (reduced) {
      motionValue.set(value);
      return undefined;
    }
    const controls = animate(motionValue, value, { duration: COUNT_DURATION_S });
    return () => controls.stop();
  }, [value, reduced, motionValue]);

  // With reduced motion the new value shows immediately, even before the effect runs.
  const shown = reduced ? value : displayed;
  const classes = [ROOT_CLASSES, className ?? ""].filter(Boolean).join(" ");
  const presentation = delta
    ? getDeltaPresentation(delta.direction, delta.intent, delta.amount)
    : null;
  const DeltaIcon = presentation ? DELTA_ICON[presentation.icon] : null;

  let animatedValue;
  if (format === "score") {
    animatedValue = (
      <>
        <span>{formatScoreText(shown)}</span>
        {showMax ? <span className={MAX_SUFFIX_CLASSES}>{MAX_SUFFIX}</span> : null}
      </>
    );
  } else {
    const parts = formatCurrencyParts(shown);
    animatedValue = (
      <>
        <span>{parts.symbol}</span>
        <span>{parts.integer}</span>
        <span className={SMALL_PART_CLASSES}>
          {CURRENCY_DECIMAL}
          {parts.cents}
        </span>
      </>
    );
  }

  return (
    <div {...rest} ref={ref} className={classes} data-reduced-motion={reduced ? "true" : "false"}>
      <p className={LABEL_CLASSES}>{label}</p>
      <p className={VALUE_CLASSES}>
        <span aria-hidden="true">{animatedValue}</span>
        <span className="sr-only">{getFinalText(value, format, showMax)}</span>
      </p>
      {presentation && DeltaIcon ? (
        <Chip tone={presentation.tone} icon={DeltaIcon}>
          {presentation.text}
        </Chip>
      ) : null}
    </div>
  );
});
