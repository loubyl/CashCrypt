import type { DecayLevel } from "@/lib/haunting/config";
import { getLevelLabel } from "@/lib/utils/scoreView";

const PLACEHOLDER_TEXT = "House scene arrives in the next update";
const REGION_LABEL = "House scene";

export type ScenePlaceholderProps = {
  level: DecayLevel;
  /** Layout utilities only. */
  className?: string;
};

export function ScenePlaceholder({ level, className }: ScenePlaceholderProps) {
  const classes = [
    "flex min-h-48 flex-col items-center justify-center gap-2 rounded-lg bg-surface-void p-card text-center",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <section aria-label={REGION_LABEL} className={classes}>
      <p className="font-display text-title text-ink">{getLevelLabel(level)}</p>
      <p className="font-sans text-body text-ink-secondary">{PLACEHOLDER_TEXT}</p>
    </section>
  );
}
