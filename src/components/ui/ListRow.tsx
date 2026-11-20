import {
  forwardRef,
  type ComponentPropsWithoutRef,
  type MouseEvent,
  type ReactNode,
  type Ref,
} from "react";
import type { LucideIcon } from "lucide-react";
import type { LayoutClassName } from "./motionTokens";

const ICON_SIZE_PX = 20;
const ICON_STROKE_WIDTH = 2;
const PLUS_SIGN = "+";
// U+2212 MINUS SIGN, so the sign is a real minus and not a hyphen.
const MINUS_SIGN = "\u2212";

export type ListRowTone = "candle" | "ecto" | "blood" | "ghost" | "spirit" | "neutral";
export type ListRowAmountDirection = "in" | "out";

const TONE_CLASSES: Record<ListRowTone, string> = {
  candle: "bg-candle-tint text-candle",
  ecto: "bg-ecto-tint text-ecto",
  blood: "bg-blood-tint text-blood",
  ghost: "bg-ghost-tint text-ghost",
  spirit: "bg-spirit-tint text-spirit",
  neutral: "bg-surface-raised text-ink-secondary",
};

const DIRECTION_CLASSES: Record<ListRowAmountDirection, string> = {
  in: "text-ecto",
  out: "text-ink",
};

const DIRECTION_SIGNS: Record<ListRowAmountDirection, string> = {
  in: PLUS_SIGN,
  out: MINUS_SIGN,
};

// The divider is inset from the left by the avatar width (40px = w-10).
const DIVIDER_CLASSES =
  "after:pointer-events-none after:absolute after:bottom-0 after:left-10 after:right-0 after:h-px after:bg-divider after:content-['']";

// At least 64px high. With a badge the row grows (padding instead of a fixed height), so the
// badge stays inside the row and inside its focus ring.
const ROW_CLASSES = "relative flex min-h-16 w-full items-center gap-3 py-2 text-left font-sans";

const INTERACTIVE_CLASSES =
  "rounded-md outline-none transition-colors active:bg-surface-raised " +
  "focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus " +
  "disabled:cursor-not-allowed disabled:opacity-40 aria-disabled:cursor-not-allowed aria-disabled:opacity-40";

type ListRowContentProps = {
  /** Lucide icon shown in the avatar. Decorative, hidden from assistive technology. */
  icon: LucideIcon;
  tone?: ListRowTone;
  title: string;
  subtitle?: string;
  /** Amount text without a sign, for example "$22.99". */
  amount?: string;
  /** Optional status shown under the subtitle, inside the row (for example a Chip). */
  badge?: ReactNode;
  /** Adds a `+` (in) or `−` (out) sign to the amount as text. */
  amountDirection?: ListRowAmountDirection;
  /** Draws a 1px divider at the bottom, inset by the avatar width. */
  divider?: boolean;
  /** Layout utilities only (margin, width, grid placement). Never colors or spacing. */
  className?: LayoutClassName;
};

type OwnPropNames = keyof ListRowContentProps;

type StaticListRowProps = ListRowContentProps &
  Omit<ComponentPropsWithoutRef<"div">, OwnPropNames | "onClick"> & {
    onClick?: undefined;
    href?: undefined;
    disabled?: undefined;
  };

type ButtonListRowProps = ListRowContentProps &
  Omit<ComponentPropsWithoutRef<"button">, OwnPropNames | "type"> & {
    onClick: NonNullable<ComponentPropsWithoutRef<"button">["onClick"]>;
    href?: undefined;
    type?: "button" | "submit" | "reset";
  };

type LinkListRowProps = ListRowContentProps &
  Omit<ComponentPropsWithoutRef<"a">, OwnPropNames | "href"> & {
    href: string;
    onClick?: ComponentPropsWithoutRef<"a">["onClick"];
    disabled?: boolean;
  };

export type ListRowProps = StaticListRowProps | ButtonListRowProps | LinkListRowProps;

type RowBodyProps = Pick<
  ListRowContentProps,
  "icon" | "tone" | "title" | "subtitle" | "badge" | "amount" | "amountDirection"
>;

function RowBody({ icon: Icon, tone = "neutral", title, subtitle, badge, amount, amountDirection }: RowBodyProps) {
  const sign = amountDirection ? DIRECTION_SIGNS[amountDirection] : "";
  const amountColor = amountDirection ? DIRECTION_CLASSES[amountDirection] : "text-ink";

  return (
    <>
      <span
        className={`inline-flex size-10 shrink-0 items-center justify-center rounded-circle ${TONE_CLASSES[tone]}`}
      >
        <Icon size={ICON_SIZE_PX} strokeWidth={ICON_STROKE_WIDTH} aria-hidden="true" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-body-lg text-ink">{title}</span>
        {subtitle ? <span className="truncate text-caption text-ink-secondary">{subtitle}</span> : null}
        {badge ? <span className="mt-1 flex">{badge}</span> : null}
      </span>
      {amount ? (
        <span className={`shrink-0 text-right text-body-lg tabular-nums ${amountColor}`}>
          {sign}
          {amount}
        </span>
      ) : null}
    </>
  );
}

export const ListRow = forwardRef<HTMLElement, ListRowProps>(function ListRow(props, ref) {
  const {
    icon,
    tone,
    title,
    subtitle,
    badge,
    amount,
    amountDirection,
    divider = false,
    className,
    ...rest
  } = props;

  const body = (
    <RowBody
      icon={icon}
      tone={tone}
      title={title}
      subtitle={subtitle}
      badge={badge}
      amount={amount}
      amountDirection={amountDirection}
    />
  );
  const shared = [ROW_CLASSES, divider ? DIVIDER_CLASSES : "", className ?? ""].filter(Boolean);

  if (rest.href !== undefined) {
    const { href, disabled, onClick, ...anchorRest } = rest as Omit<LinkListRowProps, OwnPropNames>;
    const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
      if (disabled) {
        event.preventDefault();
        return;
      }
      onClick?.(event);
    };
    return (
      <a
        {...anchorRest}
        ref={ref as Ref<HTMLAnchorElement>}
        href={href}
        aria-disabled={disabled ? true : undefined}
        tabIndex={disabled ? -1 : anchorRest.tabIndex}
        onClick={handleClick}
        className={[...shared, INTERACTIVE_CLASSES].join(" ")}
      >
        {body}
      </a>
    );
  }

  if (rest.onClick !== undefined) {
    const { type = "button", ...buttonRest } = rest as Omit<ButtonListRowProps, OwnPropNames>;
    return (
      <button
        {...buttonRest}
        ref={ref as Ref<HTMLButtonElement>}
        type={type}
        className={[...shared, INTERACTIVE_CLASSES].join(" ")}
      >
        {body}
      </button>
    );
  }

  const divProps = rest as Omit<StaticListRowProps, OwnPropNames>;
  return (
    <div {...divProps} ref={ref as Ref<HTMLDivElement>} className={shared.join(" ")}>
      {body}
    </div>
  );
});
