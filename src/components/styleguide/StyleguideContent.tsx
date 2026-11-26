"use client";

import {
  ArrowDown,
  ArrowDownLeft,
  ArrowUp,
  ArrowUpRight,
  Banknote,
  Check,
  CreditCard,
  Ghost,
  Info,
  Landmark,
  Minus,
  Music,
  Plus,
  Trash2,
  TriangleAlert,
  Tv,
  Upload,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { BalanceHero } from "@/components/ui/BalanceHero";
import { Button, type ButtonSize, type ButtonVariant } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { ExorcismActionRow } from "@/components/ui/ExorcismActionRow";
import { Input } from "@/components/ui/Input";
import { LightScoreBar } from "@/components/ui/LightScoreBar";
import { ListRow } from "@/components/ui/ListRow";
import { QuickAction } from "@/components/ui/QuickAction";
import { SegmentedControl, type SegmentedControlOption } from "@/components/ui/SegmentedControl";
import { useToast } from "@/components/ui/ToastRegion";
import { getDeltaPresentation, type DeltaDirection, type DeltaIntent } from "@/lib/utils/delta";
import type { ToastTone } from "@/lib/utils/toastReducer";

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

const BUTTON_VARIANTS: ButtonVariant[] = ["primary", "secondary", "ghost", "danger", "danger-ghost"];
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

function QuickActionSection() {
  return (
    <>
      <CardShowcaseItem label="QuickAction, row of four">
        <div className="flex flex-wrap items-start gap-4">
          <QuickAction icon={Banknote} label="Log payment" onClick={noop} />
          <QuickAction icon={Plus} label="Add expense" onClick={noop} />
          <QuickAction icon={Upload} label="Import CSV" onClick={noop} />
          <QuickAction icon={Ghost} label="Exorcise" onClick={noop} />
        </div>
      </CardShowcaseItem>
      <CardShowcaseItem label="QuickAction, disabled">
        <div className="flex flex-wrap items-start gap-4">
          <QuickAction icon={Banknote} label="Log payment" onClick={noop} disabled />
        </div>
      </CardShowcaseItem>
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

const DELTA_DIRECTIONS: DeltaDirection[] = ["up", "down"];
const DELTA_INTENTS: DeltaIntent[] = ["good", "bad"];
const DELTA_AMOUNT_TEXT = "$120.00";

function BalanceHeroSection() {
  return (
    <>
      <CardShowcaseItem label="BalanceHero, currency, down and good">
        <Card>
          <BalanceHero
            label="Total debt"
            value={12480.5}
            delta={{ direction: "down", intent: "good", amount: DELTA_AMOUNT_TEXT }}
          />
        </Card>
      </CardShowcaseItem>
      <CardShowcaseItem label="BalanceHero, score, up and good">
        <Card>
          <BalanceHero
            label="Light score"
            format="score"
            showMax
            value={72}
            delta={{ direction: "up", intent: "good", amount: "4" }}
          />
        </Card>
      </CardShowcaseItem>
      {DELTA_DIRECTIONS.map((direction) =>
        DELTA_INTENTS.map((intent) => {
          const presentation = getDeltaPresentation(direction, intent, DELTA_AMOUNT_TEXT);
          const Icon = presentation.icon === "arrow-up" ? ArrowUp : ArrowDown;
          return (
            <CardShowcaseItem key={`${direction}-${intent}`} label={`Delta chip, ${direction} and ${intent}`}>
              <Card>
                <Chip tone={presentation.tone} icon={Icon}>
                  {presentation.text}
                </Chip>
              </Card>
            </CardShowcaseItem>
          );
        }),
      )}
    </>
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
        <Card title="Subscriptions" headingLevel="h3">
          <p className="text-body text-ink-secondary">Five zombies in the basement.</p>
        </Card>
      </CardShowcaseItem>
      <CardShowcaseItem label="Card, titled with action">
        <Card title="Debts" headingLevel="h3" action={{ label: "See all", href: "#styleguide-card" }}>
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
      <CardShowcaseItem label="ListRow, highlighted (New and Updated tags)">
        <Card>
          <ListRow icon={Tv} tone="ghost" title="StreamMax" amount="$22.99" highlight="new" divider />
          <ListRow icon={Music} tone="spirit" title="TuneBox" amount="$11.99" highlight="updated" />
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

function ChipSection() {
  return (
    <>
      <CardShowcaseItem label="Chip, success">
        <Card>
          <Chip tone="success" icon={Check}>Paid off</Chip>
        </Card>
      </CardShowcaseItem>
      <CardShowcaseItem label="Chip, warning">
        <Card>
          <Chip tone="warning" icon={TriangleAlert}>Due soon</Chip>
        </Card>
      </CardShowcaseItem>
      <CardShowcaseItem label="Chip, danger">
        <Card>
          <Chip tone="danger" icon={ArrowUpRight}>Overdue</Chip>
        </Card>
      </CardShowcaseItem>
      <CardShowcaseItem label="Chip, info">
        <Card>
          <Chip tone="info" icon={Info}>Small expense</Chip>
        </Card>
      </CardShowcaseItem>
      <CardShowcaseItem label="Chip, spirit">
        <Card>
          <Chip tone="spirit" icon={Ghost}>Poltergeist</Chip>
        </Card>
      </CardShowcaseItem>
      <CardShowcaseItem label="Chip, neutral, with icon">
        <Card>
          <Chip tone="neutral" icon={Minus}>No change</Chip>
        </Card>
      </CardShowcaseItem>
      <CardShowcaseItem label="Chip, neutral, label only">
        <Card>
          <Chip tone="neutral">Draft</Chip>
        </Card>
      </CardShowcaseItem>
    </>
  );
}

const TWO_OPTIONS: SegmentedControlOption[] = [
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" },
];

const THREE_OPTIONS: SegmentedControlOption[] = [
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
  { value: "year", label: "Year" },
];

const DISABLED_SEGMENT_OPTIONS: SegmentedControlOption[] = [
  { value: "debts", label: "Debts" },
  { value: "subscriptions", label: "Subscriptions" },
  { value: "archive", label: "Archive", disabled: true },
];

function SegmentedControlSection() {
  const [twoValue, setTwoValue] = useState("monthly");
  const [threeValue, setThreeValue] = useState("month");
  const [disabledValue, setDisabledValue] = useState("debts");
  return (
    <>
      <CardShowcaseItem label="SegmentedControl, two options">
        <SegmentedControl
          aria-label="Billing period, two options"
          options={TWO_OPTIONS}
          value={twoValue}
          onChange={setTwoValue}
        />
      </CardShowcaseItem>
      <CardShowcaseItem label="SegmentedControl, three options">
        <SegmentedControl
          aria-label="Time range, three options"
          options={THREE_OPTIONS}
          value={threeValue}
          onChange={setThreeValue}
        />
      </CardShowcaseItem>
      <CardShowcaseItem label="SegmentedControl, with a disabled segment">
        <SegmentedControl
          aria-label="List type, one segment disabled"
          options={DISABLED_SEGMENT_OPTIONS}
          value={disabledValue}
          onChange={setDisabledValue}
        />
      </CardShowcaseItem>
    </>
  );
}

const INPUT_ERROR_TEXT = "Enter an amount greater than zero.";
const INPUT_HINT_TEXT = "Use the amount from your statement.";
const NAME_HINT_TEXT = "Use the name shown on your bank statement.";

function InputSection() {
  return (
    <>
      <CardShowcaseItem label="Input, text, default">
        <Input label="Debt name" />
      </CardShowcaseItem>
      <CardShowcaseItem label="Input, text, filled">
        <Input label="Debt name" defaultValue="Visa card" />
      </CardShowcaseItem>
      <CardShowcaseItem label="Input, text, error">
        <Input label="Debt name" defaultValue="V" error="Use at least two characters." />
      </CardShowcaseItem>
      <CardShowcaseItem label="Input, text, disabled">
        <Input label="Debt name" defaultValue="Visa card" disabled />
      </CardShowcaseItem>
      <CardShowcaseItem label="Input, text, with hint">
        <Input label="Subscription name" hint={NAME_HINT_TEXT} />
      </CardShowcaseItem>
      <CardShowcaseItem label="Input, text, raised fill">
        <Card>
          <Input label="Note" fill="raised" />
        </Card>
      </CardShowcaseItem>
      <CardShowcaseItem label="Money input, default">
        <Input variant="money" label="Payment amount" />
      </CardShowcaseItem>
      <CardShowcaseItem label="Money input, filled">
        <Input variant="money" label="Payment amount" defaultValue="300.00" />
      </CardShowcaseItem>
      <CardShowcaseItem label="Money input, error">
        <Input variant="money" label="Payment amount" defaultValue="0.00" error={INPUT_ERROR_TEXT} />
      </CardShowcaseItem>
      <CardShowcaseItem label="Money input, disabled">
        <Input variant="money" label="Payment amount" defaultValue="300.00" disabled />
      </CardShowcaseItem>
      <CardShowcaseItem label="Money input, with hint">
        <Input variant="money" label="Monthly cost" hint={INPUT_HINT_TEXT} />
      </CardShowcaseItem>
    </>
  );
}

type ToastTrigger = {
  tone: ToastTone;
  label: string;
  message: string;
};

const TOAST_TRIGGERS: ToastTrigger[] = [
  { tone: "success", label: "Toast, success", message: "+$11.99/mo saved" },
  { tone: "info", label: "Toast, info", message: "Small expenses are up this week" },
  { tone: "warning", label: "Toast, warning", message: "Visa card payment is due in 3 days" },
  { tone: "danger", label: "Toast, danger", message: "Payment could not be saved" },
];

const TOAST_ACTION_LABEL = "Undo";
const TOAST_ACTION_MESSAGE = "StreamMax canceled, saves $22.99/mo";

function ToastSection() {
  const { show } = useToast();
  return (
    <>
      {TOAST_TRIGGERS.map((trigger) => (
        <CardShowcaseItem key={trigger.tone} label={trigger.label}>
          <Button
            variant="secondary"
            onClick={() => show({ tone: trigger.tone, message: trigger.message })}
          >
            {`Show ${trigger.tone} toast`}
          </Button>
        </CardShowcaseItem>
      ))}
      <CardShowcaseItem label="Toast, success, with action">
        <Button
          variant="secondary"
          onClick={() =>
            show({
              tone: "success",
              message: TOAST_ACTION_MESSAGE,
              actionLabel: TOAST_ACTION_LABEL,
              onAction: noop,
            })
          }
        >
          Show toast with action
        </Button>
      </CardShowcaseItem>
    </>
  );
}

const SHEET_TITLE = "Log a payment";

function BottomSheetSection() {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  return (
    <>
      <CardShowcaseItem label="BottomSheet, opens a sheet below 1024px and a modal from 1024px">
        <Button variant="secondary" onClick={() => setOpen(true)}>
          Open sheet
        </Button>
      </CardShowcaseItem>
      <BottomSheet open={open} onClose={close} title={SHEET_TITLE}>
        <Input variant="money" label="Payment amount" />
        <div className="flex flex-wrap gap-3">
          <Button onClick={close}>Save payment</Button>
          <Button variant="secondary" onClick={close}>
            Cancel
          </Button>
        </div>
      </BottomSheet>
    </>
  );
}

type LightScoreSample = {
  score: number;
  baseScore?: number;
  momentum?: number;
};

const LIGHT_SCORE_SAMPLES: LightScoreSample[] = [
  { score: 0 },
  { score: 19 },
  { score: 20 },
  { score: 39 },
  { score: 40, baseScore: 35, momentum: 5 },
  { score: 59 },
  { score: 60 },
  { score: 79 },
  { score: 80 },
  { score: 100 },
];

function LightScoreBarSection() {
  return (
    <>
      {LIGHT_SCORE_SAMPLES.map((sample) => {
        const withBreakdown = sample.baseScore !== undefined;
        const label = `LightScoreBar, score ${sample.score}${withBreakdown ? ", with breakdown" : ""}`;
        return (
          <CardShowcaseItem key={sample.score} label={label}>
            <Card>
              <LightScoreBar
                score={sample.score}
                baseScore={sample.baseScore}
                momentum={sample.momentum}
                aria-label={`Light score ${sample.score}${withBreakdown ? " with breakdown" : ""}`}
              />
            </Card>
          </CardShowcaseItem>
        );
      })}
    </>
  );
}

const EXORCISM_IMPACT_TEXT = "$22.99";

function ExorcismActionRowSection() {
  const [openDone, setOpenDone] = useState(false);
  return (
    <>
      <CardShowcaseItem label="ExorcismActionRow, open (toggle it)">
        <Card>
          <ExorcismActionRow
            id="styleguide-exorcism-open"
            title="Cancel StreamMax"
            subtitle="Renews on the 4th"
            impactText={EXORCISM_IMPACT_TEXT}
            done={openDone}
            onToggle={setOpenDone}
          />
        </Card>
      </CardShowcaseItem>
      <CardShowcaseItem label="ExorcismActionRow, done">
        <Card>
          <ExorcismActionRow
            id="styleguide-exorcism-done"
            title="Cancel TuneBox"
            subtitle="Canceled this week"
            impactText={EXORCISM_IMPACT_TEXT}
            done
            onToggle={noop}
          />
        </Card>
      </CardShowcaseItem>
      <CardShowcaseItem label="ExorcismActionRow, highlighted">
        <Card>
          <ExorcismActionRow
            id="styleguide-exorcism-highlight"
            title="Cancel TuneBox"
            impactText={EXORCISM_IMPACT_TEXT}
            done={false}
            onToggle={noop}
            highlight="new"
          />
        </Card>
      </CardShowcaseItem>
      <CardShowcaseItem label="ExorcismActionRow, disabled">
        <Card>
          <ExorcismActionRow
            id="styleguide-exorcism-disabled"
            title="Cancel CloudVault"
            subtitle="Unavailable"
            impactText={EXORCISM_IMPACT_TEXT}
            done={false}
            onToggle={noop}
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
// Tokens first, then one section per built primitive in the Requirement 19.5 order:
// Button, QuickAction, BalanceHero, Card, ListRow, Chip, SegmentedControl, Input,
// BottomSheet, Toast, LightScoreBar, ExorcismActionRow. Unbuilt primitives are omitted.
const SECTIONS: StyleguideSection[] = [
  { id: "tokens", title: "Tokens", render: () => <TokensSection /> },
  { id: "button", title: "Button", render: () => <ButtonSection /> },
  { id: "quickaction", title: "QuickAction", render: () => <QuickActionSection /> },
  { id: "balancehero", title: "BalanceHero", render: () => <BalanceHeroSection /> },
  { id: "card", title: "Card", render: () => <CardSection /> },
  { id: "listrow", title: "ListRow", render: () => <ListRowSection /> },
  { id: "chip", title: "Chip", render: () => <ChipSection /> },
  { id: "segmentedcontrol", title: "SegmentedControl", render: () => <SegmentedControlSection /> },
  { id: "input", title: "Input", render: () => <InputSection /> },
  { id: "bottomsheet", title: "BottomSheet", render: () => <BottomSheetSection /> },
  { id: "toast", title: "Toast", render: () => <ToastSection /> },
  { id: "lightscorebar", title: "LightScoreBar", render: () => <LightScoreBarSection /> },
  { id: "exorcismactionrow", title: "ExorcismActionRow", render: () => <ExorcismActionRowSection /> },
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
