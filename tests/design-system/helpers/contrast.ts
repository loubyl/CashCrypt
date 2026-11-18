// Test-only WCAG 2.x contrast helpers.

export type Rgb = readonly [number, number, number];

const HEX_PATTERN = /^#([0-9a-f]{6})$/i;
const HEX_RADIX = 16;
const CHANNEL_MAX = 255;
const LINEAR_THRESHOLD = 0.03928;
const LINEAR_DIVISOR = 12.92;
const GAMMA_OFFSET = 0.055;
const GAMMA_DIVISOR = 1.055;
const GAMMA_EXPONENT = 2.4;
const LUMA_RED = 0.2126;
const LUMA_GREEN = 0.7152;
const LUMA_BLUE = 0.0722;
const CONTRAST_OFFSET = 0.05;

/** Parses a `#rrggbb` color into [r, g, b] channels in 0-255. Throws on any other format. */
export function parseHex(hex: string): Rgb {
  const match = HEX_PATTERN.exec(hex.trim());
  if (!match) {
    throw new Error(`Invalid 6-digit hex color: ${hex}`);
  }
  const value = parseInt(match[1], HEX_RADIX);
  return [(value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff];
}

function linearize(channel: number): number {
  const c = channel / CHANNEL_MAX;
  return c <= LINEAR_THRESHOLD
    ? c / LINEAR_DIVISOR
    : Math.pow((c + GAMMA_OFFSET) / GAMMA_DIVISOR, GAMMA_EXPONENT);
}

/** WCAG relative luminance in [0, 1]. */
export function relativeLuminance(hex: string): number {
  const [r, g, b] = parseHex(hex);
  return LUMA_RED * linearize(r) + LUMA_GREEN * linearize(g) + LUMA_BLUE * linearize(b);
}

/** WCAG contrast ratio in [1, 21]; symmetric in its arguments. */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return (lighter + CONTRAST_OFFSET) / (darker + CONTRAST_OFFSET);
}
