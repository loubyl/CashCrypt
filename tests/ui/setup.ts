import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";
import { isReducedMotion, setReducedMotion } from "./helpers/motion";
import { installMatchMediaStub, resetViewport } from "./helpers/viewport";

// jsdom has no matchMedia.
installMatchMediaStub();

// Replace only `useReducedMotion`; everything else in framer-motion stays real.
vi.mock("framer-motion", async (importOriginal) => {
  const actual = await importOriginal<typeof import("framer-motion")>();
  return { ...actual, useReducedMotion: () => isReducedMotion() };
});

afterEach(() => {
  // Globals are off, so Testing Library does not register cleanup on its own.
  cleanup();
  setReducedMotion(false);
  resetViewport();
});
