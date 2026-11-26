"use client";

import { useLayoutEffect, type RefObject } from "react";

const INVALID_SELECTOR = '[aria-invalid="true"]';
const NO_ATTEMPT = 0;

/**
 * Moves focus to the first invalid Field of a form after the commit in which `attempt` changed.
 * The form bumps `attempt` on each submit that finds errors, so the error state and the new
 * `aria-invalid` attributes are already in the DOM when this runs. Attempt 0 (mount) does nothing.
 */
export function useFocusFirstInvalid(formRef: RefObject<HTMLFormElement | null>, attempt: number): void {
  useLayoutEffect(() => {
    if (attempt === NO_ATTEMPT) return;
    formRef.current?.querySelector<HTMLElement>(INVALID_SELECTOR)?.focus();
  }, [formRef, attempt]);
}
