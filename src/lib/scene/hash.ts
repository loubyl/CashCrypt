// Deterministic hashing of row ids. Every "random-looking" scene value derives from it.

const FNV_OFFSET_BASIS = 0x811c9dc5;
const FNV_PRIME = 0x01000193;
const UINT32_RANGE = 0x100000000; // 2^32
const SALT_SEPARATOR = "\u0000";

/** 32-bit FNV-1a over `salt + "\u0000" + id`, returned as an unsigned integer. */
export function hashId(id: string, salt: string): number {
  const text = `${salt}${SALT_SEPARATOR}${id}`;
  let hash = FNV_OFFSET_BASIS;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, FNV_PRIME);
  }
  return hash >>> 0;
}

/** Maps an id and a salt to a number in [0, 1). */
export function unitFromId(id: string, salt: string): number {
  return hashId(id, salt) / UINT32_RANGE;
}
