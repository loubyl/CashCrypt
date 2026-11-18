import type { ComponentPropsWithoutRef, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import type { LayoutClassName } from "./motionTokens";

const ICON_SIZE_PX = 14;
const ICON_STROKE_WIDTH = 2;

export type ChipAccentTone = "success" | "warning" | "danger" | "info" | "spirit";
export type ChipTone = ChipAccentTone | "neutral";

const TONE_CLASSES: Record<ChipTone, string> = {
  success: "bg-ecto-tint text-ecto",
  warning: "bg-candle-tint text-candle",
  danger: "bg-blood-tint text-blood",
  info: "bg-ghost-tint text-ghost",
  spirit: "bg-spirit-tint text-spirit",
  neutral: "bg-surface-raised text-ink-secondary",
};

// 24px pill. `text-label` (13/18) keeps the text at or above 12px.
const CHIP_CLASSES =
  "inline-flex h-6 shrink-0 items-center gap-1 rounded-pill px-2 font-sans text-label whitespace-nowrap";

type ChipBaseProps = {
  /** Visible label. Required so the chip always has an accessible name. */
  children: ReactNode;
  /** Layout utilities only (margin, width, grid placement). Never colors or spacing. */
  className?: LayoutClassName;
};

type OwnPropNames = keyof ChipBaseProps | "tone" | "icon";

type NativeProps = Omit<ComponentPropsWithoutRef<"span">, OwnPropNames>;

type AccentChipProps = ChipBaseProps &
  NativeProps & {
    tone: ChipAccentTone;
    /** Lucide icon. Required for every tone except `neutral`, so color is never the only signal. */
    icon: LucideIcon;
  };

type NeutralChipProps = ChipBaseProps &
  NativeProps & {
    tone: "neutral";
    /** Optional for the neutral tone. */
    icon?: LucideIcon;
  };

export type ChipProps = AccentChipProps | NeutralChipProps;

export function Chip({ tone, icon: Icon, children, className, ...rest }: ChipProps) {
  const classes = [CHIP_CLASSES, TONE_CLASSES[tone], className ?? ""].filter(Boolean).join(" ");

  return (
    <span {...rest} className={classes}>
      {Icon ? <Icon size={ICON_SIZE_PX} strokeWidth={ICON_STROKE_WIDTH} aria-hidden="true" /> : null}
      <span>{children}</span>
    </span>
  );
}
