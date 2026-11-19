import Link from "next/link";

// Placeholder home until the app screens spec replaces it.
// Server Component: native elements and design-token utilities only.
export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-content flex-1 flex-col justify-center gap-6 px-page py-10">
      <h1 className="font-wordmark text-display font-medium text-ink">CashCrypt</h1>
      <p className="text-body-lg text-ink-secondary">
        CashCrypt is a personal finance app where your money habits haunt your house.
      </p>
      <Link
        href="/styleguide"
        className="self-start rounded-md text-body-lg text-candle underline underline-offset-4 focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      >
        View the styleguide
      </Link>
    </main>
  );
}
