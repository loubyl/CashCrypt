"use client";
import { useEffect, useState } from "react";
import type { RefObject } from "react";

/**
 * Width in CSS pixels of the referenced element, kept current with a ResizeObserver.
 * Null before the first measurement and when ResizeObserver is unavailable.
 */
export function useElementWidth(ref: RefObject<HTMLElement | null>): number | null {
  const [width, setWidth] = useState<number | null>(null);

  useEffect(() => {
    const element = ref.current;
    if (element === null || typeof ResizeObserver === "undefined") return undefined;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[entries.length - 1];
      if (entry === undefined) return;
      const measured = entry.contentRect.width;
      setWidth(Number.isFinite(measured) ? measured : null);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);

  return width;
}
