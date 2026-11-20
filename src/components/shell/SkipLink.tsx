"use client";
import type { MouseEvent } from "react";

const SKIP_LABEL = "Skip to content";
const MAIN_TARGET = "#main";
// Hidden until focused, then a white pill at the top left with the candle focus ring and a
// 44px target like every other link.
const SKIP_LINK_CLASSES =
  "sr-only rounded-pill bg-ink px-4 py-2 font-sans text-label font-semibold text-surface-void " +
  "min-h-11 min-w-11 items-center focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:inline-flex " +
  "outline-none focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";

/** Moves focus to the screen's `<main>`. `tabindex="-1"` makes it focusable without a tab stop. */
function focusMain(event: MouseEvent<HTMLAnchorElement>): void {
  const main = document.querySelector("main");
  if (!main) return;
  event.preventDefault();
  if (!main.hasAttribute("tabindex")) main.setAttribute("tabindex", "-1");
  main.focus();
}

/** First focusable element of every app screen: skips the navigation to the content. */
export function SkipLink() {
  return (
    <a href={MAIN_TARGET} className={SKIP_LINK_CLASSES} onClick={focusMain}>
      {SKIP_LABEL}
    </a>
  );
}
