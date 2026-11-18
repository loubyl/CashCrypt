import { useId, type ReactNode } from "react";
import type { LayoutClassName } from "./motionTokens";

export type CardHeadingLevel = "h1" | "h2" | "h3" | "h4" | "h5" | "h6";

type CardActionBase = {
  /** Visible label, for example "See all". The card title is appended for assistive technology. */
  label: string;
};

export type CardAction =
  | (CardActionBase & { href: string; onClick?: undefined })
  | (CardActionBase & { onClick: () => void; href?: undefined });

export type CardProps = {
  /** Card title rendered as a heading. Without it the card is a plain container. */
  title?: string;
  headingLevel?: CardHeadingLevel;
  /** Optional header action. Only rendered when `title` is set. */
  action?: CardAction;
  /** Layout utilities only (margin, width, grid placement). Never colors or spacing. */
  className?: LayoutClassName;
  children?: ReactNode;
};

const BASE_CLASSES = "bg-surface-card rounded-lg p-card";

const TITLE_CLASSES = "font-display text-title text-ink";

const ACTION_CLASSES =
  "inline-flex min-h-11 shrink-0 items-center rounded-pill bg-transparent px-2 font-sans text-label font-semibold text-candle " +
  "outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";

type CardActionControlProps = {
  action: CardAction;
  title: string;
};

function CardActionControl({ action, title }: CardActionControlProps) {
  // The space is its own text node outside the hidden span, so the accessible name
  // is always "<label> <title>" and the space cannot be collapsed with the span.
  const content = (
    <>
      {action.label}
      {" "}
      <span className="sr-only">{title}</span>
    </>
  );

  if (action.href !== undefined) {
    return (
      <a href={action.href} className={ACTION_CLASSES}>
        {content}
      </a>
    );
  }

  return (
    <button type="button" onClick={action.onClick} className={ACTION_CLASSES}>
      {content}
    </button>
  );
}

export function Card({
  title,
  headingLevel = "h2",
  action,
  className,
  children,
}: CardProps) {
  const titleId = useId();
  const classes = [BASE_CLASSES, className ?? ""].filter(Boolean).join(" ");

  if (title === undefined) {
    return <div className={classes}>{children}</div>;
  }

  const Heading = headingLevel;

  return (
    <section aria-labelledby={titleId} className={classes}>
      <header className="mb-4 flex items-center justify-between gap-3">
        <Heading id={titleId} className={TITLE_CLASSES}>
          {title}
        </Heading>
        {action ? <CardActionControl action={action} title={title} /> : null}
      </header>
      {children}
    </section>
  );
}
