let reduced = false;

/** Sets the reduced-motion preference seen by the mocked `useReducedMotion`. */
export function setReducedMotion(value: boolean): void {
  reduced = value;
}

/** Returns the current mocked reduced-motion preference. */
export function isReducedMotion(): boolean {
  return reduced;
}
