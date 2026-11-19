import type { ReactNode } from "react";

export type PageHeaderProps = {
  /** Page title. Rendered as the screen's only `h1`. */
  title: string;
  /** Optional one-line description under the title. */
  description?: string;
  /** Optional control placed on the right of the title. */
  action?: ReactNode;
};

export function PageHeader({ title, description, action }: PageHeaderProps) {
  return (
    <header className="flex items-start justify-between gap-3 pb-4">
      <div className="min-w-0">
        <h1 className="font-display text-display text-ink">{title}</h1>
        {description ? (
          <p className="mt-1 text-body text-ink-secondary">{description}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </header>
  );
}
