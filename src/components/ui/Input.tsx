"use client";

import { CircleAlert } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import {
  forwardRef,
  useId,
  type ChangeEvent,
  type ComponentPropsWithoutRef,
  type FocusEvent,
} from "react";
import { formatMoneyOnBlur, sanitizeMoneyInput } from "@/lib/utils/money";
import { SHAKE_DURATION_S, SHAKE_PX, type LayoutClassName } from "./motionTokens";

const ICON_SIZE_PX = 16;
const ICON_STROKE_WIDTH = 2;
const CURRENCY_PREFIX = "$";
const MONEY_PLACEHOLDER = "0.00";
// A single space lets CSS (`:placeholder-shown`) detect an empty field without showing text.
const FLOAT_PLACEHOLDER = " ";
const INPUT_EVENT = "input";

export type InputVariant = "text" | "money";
export type InputFill = "card" | "raised";

const FILL_CLASSES: Record<InputFill, string> = {
  card: "bg-surface-card",
  raised: "bg-surface-raised",
};

const BASE_FIELD_CLASSES =
  "peer h-13 w-full rounded-md border bg-clip-padding px-4 pb-1 pt-5 font-sans text-body-lg text-ink " +
  "outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus " +
  "disabled:cursor-not-allowed disabled:opacity-60";

const MONEY_FIELD_CLASSES = "px-10 text-center font-display text-title tabular-nums";

const LABEL_BASE_CLASSES =
  "pointer-events-none absolute left-4 font-sans text-ink-secondary transition-all duration-200 " +
  "motion-reduce:transition-none";

// Floated: small, pinned to the top. The floating variant rests vertically centered like a placeholder.
const LABEL_FLOATED_CLASSES = "top-2 translate-y-0 text-caption";
const LABEL_FLOATING_CLASSES =
  "top-1/2 -translate-y-1/2 text-body " +
  "peer-focus:top-2 peer-focus:translate-y-0 peer-focus:text-caption " +
  "peer-[:not(:placeholder-shown)]:top-2 peer-[:not(:placeholder-shown)]:translate-y-0 " +
  "peer-[:not(:placeholder-shown)]:text-caption";

// Three back-and-forth steps of SHAKE_PX, ending at rest.
const SHAKE_KEYFRAMES = [0, SHAKE_PX, -SHAKE_PX, SHAKE_PX, -SHAKE_PX, SHAKE_PX, -SHAKE_PX, 0];
const REST_POSITION = { x: 0 };

type OwnPropNames = "className" | "type" | "placeholder";

export type InputProps = Omit<ComponentPropsWithoutRef<"input">, OwnPropNames> & {
  /** Visible label, floats above the value. It is the accessible name. */
  label: string;
  variant?: InputVariant;
  /** Surface the field sits on. Use `raised` inside cards. */
  fill?: InputFill;
  /** Error message. Sets `aria-invalid`, shows an icon and text, and uses the blood border. */
  error?: string;
  /** Helper text linked through `aria-describedby`. */
  hint?: string;
  /** Layout utilities only (margin, width, grid placement). Never colors or spacing. */
  className?: LayoutClassName;
};

function joinIds(...ids: Array<string | undefined>): string | undefined {
  const joined = ids.filter(Boolean).join(" ");
  return joined === "" ? undefined : joined;
}

/** Writes a value through the native setter and fires `input`, so React `onChange` sees it. */
function writeNativeValue(element: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  setter?.call(element, value);
  element.dispatchEvent(new Event(INPUT_EVENT, { bubbles: true }));
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  {
    label,
    variant = "text",
    fill = "card",
    error,
    hint,
    className,
    id,
    disabled,
    onChange,
    onBlur,
    "aria-describedby": describedByProp,
    ...rest
  },
  ref,
) {
  const generatedId = useId();
  const reduced = Boolean(useReducedMotion());
  const inputId = id ?? generatedId;
  const errorId = `${inputId}-error`;
  const hintId = `${inputId}-hint`;
  const isMoney = variant === "money";
  const hasError = Boolean(error);

  const describedBy = joinIds(
    describedByProp,
    hasError ? errorId : undefined,
    hint ? hintId : undefined,
  );

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (isMoney) {
      const sanitized = sanitizeMoneyInput(event.target.value);
      if (sanitized !== event.target.value) {
        event.target.value = sanitized;
      }
    }
    onChange?.(event);
  };

  const handleBlur = (event: FocusEvent<HTMLInputElement>) => {
    if (isMoney) {
      const formatted = formatMoneyOnBlur(event.target.value);
      if (formatted !== event.target.value) {
        writeNativeValue(event.target, formatted);
      }
    }
    onBlur?.(event);
  };

  const fieldClasses = [
    BASE_FIELD_CLASSES,
    FILL_CLASSES[fill],
    hasError ? "border-blood" : "border-control",
    isMoney ? MONEY_FIELD_CLASSES : "",
  ]
    .filter(Boolean)
    .join(" ");

  const labelClasses = [LABEL_BASE_CLASSES, isMoney ? LABEL_FLOATED_CLASSES : LABEL_FLOATING_CLASSES].join(" ");

  const shake = hasError && !reduced;

  return (
    <div className={["flex min-w-0 flex-col gap-1", className ?? ""].filter(Boolean).join(" ")}>
      <motion.div
        className="relative"
        data-reduced-motion={reduced ? "true" : "false"}
        animate={shake ? { x: SHAKE_KEYFRAMES } : REST_POSITION}
        transition={{ duration: shake ? SHAKE_DURATION_S : 0 }}
      >
        {isMoney ? (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute left-4 top-5 font-display text-title text-ink-secondary"
          >
            {CURRENCY_PREFIX}
          </span>
        ) : null}
        <input
          {...rest}
          ref={ref}
          id={inputId}
          type="text"
          inputMode={isMoney ? "decimal" : rest.inputMode}
          placeholder={isMoney ? MONEY_PLACEHOLDER : FLOAT_PLACEHOLDER}
          disabled={disabled}
          aria-invalid={hasError ? true : undefined}
          aria-describedby={describedBy}
          data-variant={variant}
          className={fieldClasses}
          onChange={handleChange}
          onBlur={handleBlur}
        />
        <label htmlFor={inputId} className={labelClasses}>
          {label}
        </label>
      </motion.div>
      {hasError ? (
        <p id={errorId} className="flex items-center gap-1 text-caption text-blood">
          <CircleAlert size={ICON_SIZE_PX} strokeWidth={ICON_STROKE_WIDTH} aria-hidden="true" />
          <span>{error}</span>
        </p>
      ) : null}
      {hint ? (
        <p id={hintId} className="text-caption text-ink-secondary">
          {hint}
        </p>
      ) : null}
    </div>
  );
});
