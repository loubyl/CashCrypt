const LINE_COUNT_DEFAULT = 3;

const BAR_CLASSES =
  "h-6 w-full rounded-md bg-linear-to-r from-surface-raised via-surface-card to-surface-raised bg-size-[200%_100%] animate-shimmer";

export type SkeletonProps = {
  /** Number of placeholder bars. */
  lines?: number;
  /** Layout utilities only (margin, width, grid placement). */
  className?: string;
};

/** Loading placeholder with the fog shimmer. Marks its region as busy. */
export function Skeleton({ lines = LINE_COUNT_DEFAULT, className }: SkeletonProps) {
  const bars = Array.from({ length: Math.max(1, lines) }, (_, index) => index);
  return (
    <div
      aria-busy="true"
      className={["flex w-full flex-col gap-gap", className ?? ""].filter(Boolean).join(" ")}
    >
      <span className="sr-only">Loading</span>
      {bars.map((bar) => (
        <div key={bar} aria-hidden="true" className={BAR_CLASSES} />
      ))}
    </div>
  );
}
