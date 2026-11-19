/**
 * Mode store: records which Crypt is active ("demo" or "real") in a
 * localStorage-style entry. Holds no financial data.
 */

export type Mode = "demo" | "real";

/** Minimal storage surface, satisfied by `window.localStorage`. */
export type ModeStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

export const MODE_STORAGE_KEY = "cashcrypt:mode";
const MODE_DEMO: Mode = "demo";
const MODE_REAL: Mode = "real";
const STORAGE_EVENT_NAME = "storage";

type ModeListener = () => void;

const listeners = new Set<ModeListener>();

function notifyListeners(): void {
  for (const listener of Array.from(listeners)) {
    listener();
  }
}

/** Returns the stored mode, or null when empty or holding any other value. */
export function readMode(storage: ModeStorage): Mode | null {
  const value = storage.getItem(MODE_STORAGE_KEY);
  return value === MODE_DEMO || value === MODE_REAL ? value : null;
}

export function writeMode(storage: ModeStorage, mode: Mode): void {
  storage.setItem(MODE_STORAGE_KEY, mode);
  notifyListeners();
}

export function clearMode(storage: ModeStorage): void {
  storage.removeItem(MODE_STORAGE_KEY);
  notifyListeners();
}

/**
 * Subscribes to mode changes made in this tab (via writeMode/clearMode) and
 * in other tabs (window `storage` event for the mode key). Returns an
 * unsubscribe function.
 */
export function subscribeMode(listener: ModeListener): () => void {
  listeners.add(listener);

  const hasWindow = typeof window !== "undefined";
  const onStorage = (event: StorageEvent): void => {
    // key is null when the whole storage was cleared; that also affects the mode.
    if (event.key === null || event.key === MODE_STORAGE_KEY) {
      listener();
    }
  };
  if (hasWindow) {
    window.addEventListener(STORAGE_EVENT_NAME, onStorage);
  }

  return () => {
    listeners.delete(listener);
    if (hasWindow) {
      window.removeEventListener(STORAGE_EVENT_NAME, onStorage);
    }
  };
}
