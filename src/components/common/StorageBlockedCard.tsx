import Link from "next/link";
import { Card } from "@/components/ui/Card";

export const STORAGE_BLOCKED_MESSAGE =
  "Your browser is blocking local storage, so CashCrypt cannot save your crypt here.";

export function StorageBlockedCard() {
  return (
    <Card title="Storage is blocked">
      <p className="text-body text-ink-secondary">{STORAGE_BLOCKED_MESSAGE}</p>
      <Link
        href="/"
        className="mt-4 inline-flex min-h-11 items-center rounded-pill text-body-lg text-candle underline underline-offset-4 focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      >
        Back to the landing page
      </Link>
    </Card>
  );
}
