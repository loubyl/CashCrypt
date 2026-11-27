"use client";

import { useCallback, useState, useSyncExternalStore } from "react";
import { Footprints } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useReducedMotionPreference } from "@/hooks/useReducedMotionPreference";
import { getDoItDomId, getRowDomId } from "@/lib/utils/destinations";
import type { GuideStepTarget } from "@/lib/utils/planView";

export const GUIDE_STORAGE_KEY = "cashcrypt:guide-dismissed";

const GUIDE_DISMISSED_VALUE = "1";
const GUIDE_TITLE = "How your crypt works";
const GOT_IT_LABEL = "Got it";
const SHOW_ME_LABEL = "Show me";
const GUIDE_LINES = [
  "Debt darkens the house. Paying it down raises the light score (0–100), which sets the house level.",
  "Subscriptions are zombies in the basement.",
  "Small expenses are ghosts. Enough of them in 30 days merge into a Poltergeist.",
  "Each week's exorcism lists three actions that bring the light back.",
] as const;

export type GuideMode = "demo" | "real";

type GuideSnapshot = "dismissed" | "pending";

// In-memory dismissal, used when sessionStorage is unavailable (Requirement 5.10).
let memoryDismissed = false;
const listeners = new Set<() => void>();

function notifyListeners(): void {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function readStoredDismissal(): boolean {
  try {
    return window.sessionStorage.getItem(GUIDE_STORAGE_KEY) === GUIDE_DISMISSED_VALUE;
  } catch {
    return false;
  }
}

function getSnapshot(): GuideSnapshot {
  return memoryDismissed || readStoredDismissal() ? "dismissed" : "pending";
}

// The server never renders the Card, so nothing flashes on hydration.
function getServerSnapshot(): GuideSnapshot {
  return "dismissed";
}

function writeDismissal(): void {
  try {
    window.sessionStorage.setItem(GUIDE_STORAGE_KEY, GUIDE_DISMISSED_VALUE);
  } catch {
    memoryDismissed = true;
  }
  notifyListeners();
}

/** Starts a new Guide_Session: the Guide shows again in the demo. Never throws. */
export function startGuideSession(): void {
  memoryDismissed = false;
  try {
    window.sessionStorage.removeItem(GUIDE_STORAGE_KEY);
  } catch {
    // Storage is unavailable: the in-memory flag is already cleared.
  }
  notifyListeners();
}

export type GuideVisibility = {
  shown: boolean;
  dismiss: () => void;
  open: () => void;
};

/**
 * Demo: shown until dismissed in this tab's session. Real crypt: hidden until opened,
 * with component state only (nothing is written to storage).
 */
export function useGuideVisibility(mode: GuideMode): GuideVisibility {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [realOpen, setRealOpen] = useState(false);
  const isDemo = mode === "demo";

  const dismiss = useCallback(() => {
    if (isDemo) {
      writeDismissal();
    } else {
      setRealOpen(false);
    }
  }, [isDemo]);

  const open = useCallback(() => {
    if (isDemo) {
      startGuideSession();
    } else {
      setRealOpen(true);
    }
  }, [isDemo]);

  return { shown: isDemo ? snapshot === "pending" : realOpen, dismiss, open };
}

/** DOM id of the control a "Show me" step reveals, or null for the all-done step. */
export function getShowMeElementId(step: GuideStepTarget): string | null {
  if (step.kind === "doIt") return getDoItDomId(step.actionId);
  if (step.kind === "tick") return getRowDomId("plan", step.actionId);
  return null;
}

/** Accessible name of the "Show me" Button, which starts with its visible text. */
export function getShowMeLabel(shortTitle: string): string {
  return `${SHOW_ME_LABEL}: ${shortTitle}`;
}

/** Scrolls the control into view (smooth, instant under reduced motion) and focuses it. */
function revealControl(elementId: string, reduced: boolean): void {
  const element = document.getElementById(elementId);
  if (element === null) return;
  element.scrollIntoView({ behavior: reduced ? "instant" : "smooth", block: "center" });
  // preventScroll keeps the smooth scroll above from being cut short by the focus jump.
  element.focus({ preventScroll: true });
}

export type CryptGuideProps = {
  mode: GuideMode;
  /** The first-step line. Shown only in the demo. */
  step: string | null;
  /** What the step points at; drives the "Show me" Button. Demo only. */
  stepTarget?: GuideStepTarget | null;
  onDismiss: () => void;
  /** Id of the heading, so the Dashboard can move focus to it. */
  headingId: string;
  /** Layout utilities only. */
  className?: string;
};

export function CryptGuide({
  mode,
  step,
  stepTarget = null,
  onDismiss,
  headingId,
  className,
}: CryptGuideProps) {
  const reduced = useReducedMotionPreference();
  const showMeId = mode === "demo" && stepTarget !== null ? getShowMeElementId(stepTarget) : null;
  const showMeTitle = stepTarget !== null && stepTarget.kind !== "done" ? stepTarget.shortTitle : "";
  return (
    <Card
      title={GUIDE_TITLE}
      headingLevel="h2"
      headingId={headingId}
      action={{ label: GOT_IT_LABEL, onClick: onDismiss }}
      className={className}
    >
      <div className="flex flex-col gap-2">
        {GUIDE_LINES.map((line) => (
          <p key={line} className="font-sans text-body text-ink-secondary">
            {line}
          </p>
        ))}
        {mode === "demo" && step !== null ? (
          <p className="mt-2 flex items-start gap-2 font-sans text-body text-ink">
            <Footprints aria-hidden="true" size={20} strokeWidth={2} className="mt-0.5 shrink-0 text-candle" />
            <span>{step}</span>
          </p>
        ) : null}
        {showMeId !== null ? (
          <Button
            type="button"
            variant="ghost"
            size="md"
            aria-label={getShowMeLabel(showMeTitle)}
            onClick={() => revealControl(showMeId, reduced === true)}
            className="self-start"
          >
            {SHOW_ME_LABEL}
          </Button>
        ) : null}
      </div>
    </Card>
  );
}
