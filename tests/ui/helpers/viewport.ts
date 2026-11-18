const DEFAULT_VIEWPORT_WIDTH = 1024;

let viewportWidth = DEFAULT_VIEWPORT_WIDTH;

type Listener = (event: MediaQueryListEvent) => void;

type Registration = {
  query: string;
  list: MediaQueryList;
  listeners: Set<Listener>;
  matches: boolean;
};

const registrations = new Set<Registration>();

function evaluateQuery(query: string, width: number): boolean {
  const min = /\(min-width:\s*(\d+(?:\.\d+)?)px\)/.exec(query);
  const max = /\(max-width:\s*(\d+(?:\.\d+)?)px\)/.exec(query);
  if (!min && !max) return false;
  if (min && width < Number(min[1])) return false;
  if (max && width > Number(max[1])) return false;
  return true;
}

function createMediaQueryList(query: string): MediaQueryList {
  const listeners = new Set<Listener>();
  const registration: Registration = {
    query,
    listeners,
    matches: evaluateQuery(query, viewportWidth),
    list: undefined as unknown as MediaQueryList,
  };
  const list = {
    get matches() {
      return registration.matches;
    },
    media: query,
    onchange: null,
    addEventListener: (_type: string, listener: Listener) => {
      listeners.add(listener);
    },
    removeEventListener: (_type: string, listener: Listener) => {
      listeners.delete(listener);
    },
    addListener: (listener: Listener) => {
      listeners.add(listener);
    },
    removeListener: (listener: Listener) => {
      listeners.delete(listener);
    },
    dispatchEvent: () => true,
  } as unknown as MediaQueryList;
  registration.list = list;
  registrations.add(registration);
  return list;
}

/** Installs a `window.matchMedia` stub that evaluates min/max-width queries. */
export function installMatchMediaStub(): void {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: (query: string) => createMediaQueryList(query),
  });
}

/** Sets the simulated viewport width and notifies listeners whose result changed. */
export function setViewportWidth(width: number): void {
  viewportWidth = width;
  for (const registration of registrations) {
    const next = evaluateQuery(registration.query, width);
    if (next === registration.matches) continue;
    registration.matches = next;
    const event = { matches: next, media: registration.query } as MediaQueryListEvent;
    for (const listener of registration.listeners) listener(event);
  }
}

/** Restores the default viewport width. */
export function resetViewport(): void {
  setViewportWidth(DEFAULT_VIEWPORT_WIDTH);
}
