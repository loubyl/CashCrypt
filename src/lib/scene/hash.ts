// Deterministic hashing of row ids. Every "random-looking" scene value derives from it.

const FNV_OFFSET_BASIS = 0x811c9dc5;
const FNV_PRIME = 0x01000193;
const UINT32_RANGE = 0x100000000; // 2^32
const SALT_SEPARATOR = "\u0000";

// murmur3 fmix32 constants.
const FMIX_SHIFT_A = 16;
const FMIX_SHIFT_B = 13;
const FMIX_MULTIPLIER_A = 0x85ebca6b;
const FMIX_MULTIPLIER_B = 0xc2b2ae35;

/**
 * Final avalanche (murmur3 fmix32). FNV-1a alone mixes its last characters poorly: ids that
 * differ only in a trailing digit ("…tx:0", "…tx:1") got units about 0.004 apart, so demo
 * ghosts shared one lane and almost one phase. After fmix32 every input bit reaches every
 * output bit.
 */
function finalize(value: number): number {
  let hash = value;
  hash ^= hash >>> FMIX_SHIFT_A;
  hash = Math.imul(hash, FMIX_MULTIPLIER_A);
  hash ^= hash >>> FMIX_SHIFT_B;
  hash = Math.imul(hash, FMIX_MULTIPLIER_B);
  hash ^= hash >>> FMIX_SHIFT_A;
  return hash >>> 0;
}

/** 32-bit FNV-1a over `salt + "\u0000" + id` with an fmix32 finalizer, as an unsigned integer. */
export function hashId(id: string, salt: string): number {
  const text = `${salt}${SALT_SEPARATOR}${id}`;
  let hash = FNV_OFFSET_BASIS;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, FNV_PRIME);
  }
  return finalize(hash);
}

/** Maps an id and a salt to a number in [0, 1). */
export function unitFromId(id: string, salt: string): number {
  return hashId(id, salt) / UINT32_RANGE;
}
