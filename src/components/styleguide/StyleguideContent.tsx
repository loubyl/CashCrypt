"use client";

import {
  ArrowDownLeft,
  ArrowUpRight,
  CreditCard,
  Ghost,
  Landmark,
  Music,
  Plus,
  Trash2,
  Tv,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { Button, type ButtonSize, type ButtonVariant } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ListRow } from "@/components/ui/ListRow";

type StyleguideSection = {
  id: string;
  title: string;
  render: () => ReactNode;
};

type SwatchDefinition = {
  token: string;
  swatchClassName: string;
  /** Color of the "Aa" sample: ink on dark surfaces, on-accent on light fills and accents. */
  sampleClassName: "text-ink" | "text-on-accent";
};

type TypeScaleEntry = {
  token: string;
  className: string;
  detail: string;
};

type RadiusEntry = {
  token: string;
  className: string;
};

type FontEntry = {
  name: string;
  className: string;
  usage: string;
};

const SURFACE_SWATCHES: SwatchDefinition[] = [
  { token: "--surface-void", swatchClassName: "bg-surface-void", sampleClassName: "text-ink" },
  { token: "--surface-card", swatchClassName: "bg-surface-card", sampleClassName: "text-ink" },
  { token: "--surface-raised", swatchClassName: "bg-surface-raised", sampleClassName: "text-ink" },
  { token: "--surface-overlay", swatchClassName: "bg-surface-overlay", sampleClassName: "text-ink" },
];

const TEXT_SWATCHES: SwatchDefinition[] = [
  { token: "--text-primary", swatchClassName: "bg-ink", sampleClassName: "text-on-accent" },
  { token: "--text-secondary", swatchClassName: "bg-ink-secondary", sampleClassName: "text-on-accent" },
  { token: "--text-tertiary", swatchClassName: "bg-ink-tertiary", sampleClassName: "text-on-accent" },
];

const ACCENT_SWATCHES: SwatchDefinition[] = [
  { token: "--accent-candle", swatchClassName: "bg-candle", sampleClassName: "text-on-accent" },
  { token: "--accent-ecto", swatchClassName: "bg-ecto", sampleClassName: "text-on-accent" },
  { token: "--accent-blood", swatchClassName: "bg-blood", sampleClassName: "text-on-accent" },
  { token: "--accent-ghost", swatchClassName: "bg-ghost", sampleClassName: "text-on-accent" },
  { token: "--accent-spirit", swatchClassName: "bg-spirit", sampleClassName: "text-on-accent" },
];

const TYPE_SCALE: TypeScaleEntry[] = [
  { token: "hero", className: "text-hero font-display", detail: "48/52, Manrope 800" },
  { token: "display", className: "text-display font-display", detail: "32/38, Manrope 700" },
  { token: "title", className: "text-title font-display", detail: "22/28, Manrope 700" },
  { token: "body-lg", className: "text-body-lg", detail: "16/24, Inter 500" },
  { token: "body", className: "text-body", detail: "15/22, Inter 400" },
  { token: "label", className: "text-label", detail: "13/18, Inter 500" },
  { token: "caption", className: "text-caption", detail: "12/16, Inter 400" },
];

const RADII: RadiusEntry[] = [
  { token: "pill", className: "rounded-pill" },
  { token: "lg", className: "rounded-lg" },
  { token: "md", className: "rounded-md" },
  { token: "circle", className: "rounded-circle" },
];

const FONTS: FontEntry[] = [
  { name: "Manrope", className: "font-display", usage: "Display and balances" },
  { name: "Inter", className: "font-sans", usage: "Body and UI" },
  { name: "Cinzel", className: "font-wordmark", usage: "Wordmark only" },
  { name: "JetBrains Mono", className: "font-mono", usage: "CSV preview only" },
];

const SWATCH_SAMPLE_TEXT = "Aa";

/**
 * Ref callback that writes the resolved token value into the element.
 * The value comes from the token sheet at runtime, so the source holds no hex literal.
 */
function writeTokenValue(token: string) {
  return (element: HTMLElement | null) => {
    if (!element) return;
    element.textContent = getComputedStyle(document.documentElement)
      .getPropertyValue(token)
      .trim();
  };
}

function ShowcaseCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="min-w-0 rounded-lg bg-surface-card p-card">
      <h3 className="mb-4 font-display text-title text-ink">{title}</h3>
      {children}
    </div>
  );
}

function Swatch({ token, swatchClassName, sampleClassName }: SwatchDefinition) {
  return (
    <li className="flex items-center gap-3">
      <span
        aria-hidden="true"
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-label ring-1 ring-control ${sampleClassName} ${swatchClassName}`}
      >
        {SWATCH_SAMPLE_TEXT}
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="break-all text-body-lg text-ink">{token}</span>
        <span
          ref={writeTokenValue(token)}
          className="text-caption text-ink-secondary tabular-nums"
        />
      </span>
    </li>
  );
}

function SwatchList({ swatches }: { swatches: SwatchDefinition[] }) {
  return (
    <ul className="flex flex-col gap-3">
      {swatches.map((swatch) => (
        <Swatch key={swatch.token} {...swatch} />
      ))}
    </ul>
  );
}

function TokensSection() {
  return (
    <>
      <ShowcaseCard title="Surfaces">
        <SwatchList swatches={SURFACE_SWATCHES} />
      </ShowcaseCard>
      <ShowcaseCard title="Text">
        <SwatchList swatches={TEXT_SWATCHES} />
      </ShowcaseCard>
      <ShowcaseCard title="Accents">
        <SwatchList swatches={ACCENT_SWATCHES} />
      </ShowcaseCard>
      <ShowcaseCard title="Type scale">
        <ul className="flex flex-col gap-4">
          {TYPE_SCALE.map((entry) => (
            <li key={entry.token} className="min-w-0">
              <p className={`${entry.className} truncate text-ink`}>Light returns</p>
              <p className="text-caption text-ink-secondary">
                {entry.token} · {entry.detail}
              </p>
            </li>
          ))}
        </ul>
      </ShowcaseCard>
      <ShowcaseCard title="Radius">
        <ul className="flex flex-wrap gap-4">
          {RADII.map((radius) => (
            <li key={radius.token} className="flex flex-col items-center gap-2">
              <span
                aria-hidden="true"
                className={`h-14 w-14 bg-surface-raised ring-1 ring-control ${radius.className}`}
              />
              <span className="text-caption text-ink-secondary">{radius.token}</span>
            </li>
          ))}
        </ul>
      </ShowcaseCard>
      <ShowcaseCard title="Font families">
        <ul className="flex flex-col gap-4">
          {FONTS.map((font) => (
            <li key={font.name} className="min-w-0">
              <p className={`${font.className} text-title text-ink`}>{font.name}</p>
              <p className="text-caption text-ink-secondary">{font.usage}</p>
            </li>
          ))}
        </ul>
      </ShowcaseCard>
    </>
  );
}

const BUTTON_VARIANTS: ButtonVariant[] = ["primary", "secondary", "ghost", "danger"];
const BUTTON_SIZES: ButtonSize[] = ["sm", "md", "lg"];

function ButtonLabel({ children }: { children: ReactNode }) {
  return <p className="mb-2 text-caption text-ink-secondary">{children}</p>;
}

function ButtonSuccessDemo({ variant }: { variant: ButtonVariant }) {
  const [success, setSuccess] = useState(false);
  return (
    <Button
      variant={variant}
      success={success}
      successAnnouncement="Payment saved"
      onClick={() => {
        setSuccess(false);
        // Re-trigger the morph on every click.
        requestAnimationFrame(() => setSuccess(true));
      }}
    >
      Save payment
    </Button>
  );
}

function ButtonSection() {
  return (
    <>
      {BUTTON_VARIANTS.map((variant) => (
        <ShowcaseCard key={variant} title={`Button ${variant}`}>
          <div className="flex flex-col gap-4">
            <div>
              <ButtonLabel>{variant}, sizes sm, md, lg</ButtonLabel>
              <div className="flex flex-wrap items-center gap-3">
                {BUTTON_SIZES.map((size) => (
                  <Button key={size} variant={variant} size={size}>
                    {`Label ${size}`}
                  </Button>
                ))}
              </div>
            </div>
            <div>
              <ButtonLabel>{variant}, disabled, sizes sm, md, lg</ButtonLabel>
              <div className="flex flex-wrap items-center gap-3">
                {BUTTON_SIZES.map((size) => (
                  <Button key={size} variant={variant} size={size} disabled>
                    {`Disabled ${size}`}
                  </Button>
                ))}
              </div>
            </div>
            <div>
              <ButtonLabel>{variant}, loading, sizes sm, md, lg</ButtonLabel>
              <div className="flex flex-wrap items-center gap-3">
                {BUTTON_SIZES.map((size) => (
                  <Button key={size} variant={variant} size={size} loading>
                    {`Loading ${size}`}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </ShowcaseCard>
      ))}
      <ShowcaseCard title="Button success morph">
        <ButtonLabel>primary, success: label morphs to a check for 600ms</ButtonLabel>
        <div className="flex flex-wrap items-center gap-3">
          <ButtonSuccessDemo variant="primary" />
        </div>
      </ShowcaseCard>
      <ShowcaseCard title="Button icons">
        <div className="flex flex-col gap-4">
          <div>
            <ButtonLabel>secondary, leading icon</ButtonLabel>
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="secondary" leadingIcon={Plus}>
                Add expense
              </Button>
            </div>
          </div>
          <div>
            <ButtonLabel>danger, leading icon</ButtonLabel>
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="danger" leadingIcon={Trash2}>
                Delete
              </Button>
            </div>
          </div>
          <div>
            <ButtonLabel>primary, icon-only, sizes sm, md, lg</ButtonLabel>
            <div className="flex flex-wrap items-center gap-3">
              {BUTTON_SIZES.map((size) => (
                <Button key={size} size={size} leadingIcon={Plus} aria-label={`Add, size ${size}`} />
              ))}
            </div>
          </div>
          <div>
            <ButtonLabel>ghost, icon-only, disabled</ButtonLabel>
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="ghost" leadingIcon={Plus} aria-label="Add, disabled" disabled />
            </div>
          </div>
        </div>
      </ShowcaseCard>
    </>
  );
}

function CardShowcaseItem({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <ButtonLabel>{label}</ButtonLabel>
      {children}
    </div>
  );
}

function CardSection() {
  return (
    <>
      <CardShowcaseItem label="Card, untitled">
        <Card>
          <p className="text-body text-ink">An untitled card is a plain container.</p>
        </Card>
      </CardShowcaseItem>
      <CardShowcaseItem label="Card, titled">
        <Card title="Subscriptions">
          <p className="text-body text-ink-secondary">Five zombies in the basement.</p>
        </Card>
      </CardShowcaseItem>
      <CardShowcaseItem label="Card, titled with action">
        <Card title="Debts" action={{ label: "See all", href: "#styleguide-card" }}>
          <p className="text-body text-ink-secondary">Three debts, one payment due this week.</p>
        </Card>
      </CardShowcaseItem>
    </>
  );
}

function noop() {}

function ListRowSection() {
  return (
    <>
      <CardShowcaseItem label="ListRow, static, with subtitle and amount">
        <Card>
          <ListRow icon={Tv} tone="ghost" title="StreamMax" subtitle="Renews on the 4th" amount="$22.99" />
        </Card>
      </CardShowcaseItem>
      <CardShowcaseItem label="ListRow, static, title only">
        <Card>
          <ListRow icon={Ghost} tone="spirit" title="Small expenses" />
        </Card>
      </CardShowcaseItem>
      <CardShowcaseItem label="ListRow, interactive button">
        <Card>
          <ListRow
            icon={CreditCard}
            tone="candle"
            title="Visa card"
            subtitle="Minimum $35.00"
            amount="$1,240.00"
            onClick={noop}
          />
        </Card>
      </CardShowcaseItem>
      <CardShowcaseItem label="ListRow, link">
        <Card>
          <ListRow
            icon={Landmark}
            tone="neutral"
            title="Student loan"
            subtitle="See details"
            amount="$8,300.00"
            href="#styleguide-listrow"
          />
        </Card>
      </CardShowcaseItem>
      <CardShowcaseItem label="ListRow, amount in (plus sign, ecto)">
        <Card>
          <ListRow
            icon={ArrowDownLeft}
            tone="ecto"
            title="Extra payment"
            subtitle="Saved this month"
            amount="$300.00"
            amountDirection="in"
          />
        </Card>
      </CardShowcaseItem>
      <CardShowcaseItem label="ListRow, amount out (minus sign)">
        <Card>
          <ListRow
            icon={ArrowUpRight}
            tone="blood"
            title="Coffee shop"
            subtitle="Yesterday"
            amount="$4.50"
            amountDirection="out"
          />
        </Card>
      </CardShowcaseItem>
      <CardShowcaseItem label="ListRow, with divider (two rows)">
        <Card>
          <ListRow icon={Tv} tone="ghost" title="StreamMax" amount="$22.99" amountDirection="out" divider />
          <ListRow icon={Music} tone="spirit" title="TuneBox" amount="$11.99" amountDirection="out" />
        </Card>
      </CardShowcaseItem>
      <CardShowcaseItem label="ListRow, without divider (two rows)">
        <Card>
          <ListRow icon={Tv} tone="ghost" title="StreamMax" amount="$22.99" amountDirection="out" />
          <ListRow icon={Music} tone="spirit" title="TuneBox" amount="$11.99" amountDirection="out" />
        </Card>
      </CardShowcaseItem>
      <CardShowcaseItem label="ListRow, link, disabled">
        <Card>
          <ListRow
            icon={Landmark}
            tone="neutral"
            title="Closed account"
            subtitle="Unavailable"
            href="#styleguide-listrow"
            disabled
          />
        </Card>
      </CardShowcaseItem>
    </>
  );
}

/**
 * Sections in the Req 19.5 order. Later tasks insert their primitive section at
 * the right position; a section for a primitive that is not built yet is omitted.
 * Tokens comes first, followed by the primitives.
 */
const SECTIONS: StyleguideSection[] = [
  { id: "tokens", title: "Tokens", render: () => <TokensSection /> },
  { id: "button", title: "Button", render: () => <ButtonSection /> },
  { id: "card", title: "Card", render: () => <CardSection /> },
  { id: "listrow", title: "ListRow", render: () => <ListRowSection /> },
];

export function StyleguideContent() {
  return (
    <main className="min-h-screen bg-surface-void px-page py-10 text-ink">
      <div className="mx-auto w-full max-w-content lg:max-w-5xl">
        <h1 className="font-display text-display text-ink">Styleguide</h1>
        <p className="mt-2 text-body text-ink-secondary">
          Every primitive and token of Crypt UI on the real dark background.
        </p>
        {SECTIONS.map((section) => (
          <section
            key={section.id}
            aria-labelledby={`styleguide-${section.id}`}
            className="mt-10"
          >
            <h2
              id={`styleguide-${section.id}`}
              className="mb-4 font-display text-title text-ink"
            >
              {section.title}
            </h2>
            <div className="grid grid-cols-1 gap-gap lg:grid-cols-2">
              {section.render()}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
