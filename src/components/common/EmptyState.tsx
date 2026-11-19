import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

const ICON_SIZE_PX = 22;
const ICON_STROKE_WIDTH = 2;

export type EmptyStateProps = {
  icon: LucideIcon;
  /** Short title, for example "No zombies in the basement." */
  title: string;
  /** One line of plain explanation. */
  description?: string;
  /** Optional action, usually a Button. */
  action?: ReactNode;
};

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-3 px-4 py-8 text-center">
      <span className="flex size-14 items-center justify-center rounded-circle bg-surface-raised text-ink-secondary">
        <Icon size={ICON_SIZE_PX} strokeWidth={ICON_STROKE_WIDTH} aria-hidden="true" />
      </span>
      <p className="font-display text-title text-ink">{title}</p>
      {description ? <p className="text-body text-ink-secondary">{description}</p> : null}
      {action ? <div className="pt-1">{action}</div> : null}
    </div>
  );
}
