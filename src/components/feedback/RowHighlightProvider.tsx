"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  HIGHLIGHT_PENDING_TTL_MS,
  HIGHLIGHT_WAIT_MS,
  ROW_HIGHLIGHT_MS,
} from "@/components/ui/motionTokens";
import { useReducedMotionPreference } from "@/hooks/useReducedMotionPreference";
import {
  getRowDomId,
  type HighlightList,
  type HighlightTag,
  type HighlightTarget,
} from "@/lib/utils/destinations";

type HighlightRequest = HighlightTarget & { focus: boolean };
type Pending = HighlightRequest & { requestedAt: number };

type RowHighlightContextValue = {
  version: number;
  request: (target: HighlightRequest) => void;
  announce: (message: string) => void;
  /** The fresh pending request aimed at `list`, or null. A stale one is dropped. */
  peek: (list: HighlightList) => Pending | null;
  /** Consumes `pending` when it is still the current one. */
  consume: (pending: Pending) => boolean;
};

const MISSING_ROW_MESSAGE = "That item is no longer here";

const RowHighlightContext = createContext<RowHighlightContextValue | null>(null);

export function RowHighlightProvider({ children }: { children: ReactNode }) {
  const pendingRef = useRef<Pending | null>(null);
  const [version, setVersion] = useState(0);
  const [message, setMessage] = useState("");

  const request = useCallback((target: HighlightRequest) => {
    pendingRef.current = { ...target, requestedAt: Date.now() };
    setVersion((current) => current + 1);
  }, []);

  const peek = useCallback((list: HighlightList): Pending | null => {
    const pending = pendingRef.current;
    if (!pending) return null;
    if (Date.now() - pending.requestedAt > HIGHLIGHT_PENDING_TTL_MS) {
      pendingRef.current = null;
      return null;
    }
    return pending.list === list ? pending : null;
  }, []);

  const consume = useCallback((pending: Pending): boolean => {
    if (pendingRef.current !== pending) return false;
    pendingRef.current = null;
    return true;
  }, []);

  const value = useMemo<RowHighlightContextValue>(
    () => ({ version, request, announce: setMessage, peek, consume }),
    [version, request, peek, consume],
  );

  return (
    <RowHighlightContext.Provider value={value}>
      {children}
      <p role="status" aria-live="polite" className="sr-only">
        {message}
      </p>
    </RowHighlightContext.Provider>
  );
}

const noopRequest = (): void => undefined;

export function useRequestHighlight(): (target: HighlightRequest) => void {
  return useContext(RowHighlightContext)?.request ?? noopRequest;
}

type UseRowHighlightOptions = {
  list: HighlightList;
  rows: readonly { id: string; label: string }[] | null;
  listLabel: string;
  headingId: string;
};

type UseRowHighlightResult = { highlightedId: string | null; tag: HighlightTag | null };

export function useRowHighlight({
  list,
  rows,
  listLabel,
  headingId,
}: UseRowHighlightOptions): UseRowHighlightResult {
  const context = useContext(RowHighlightContext);
  const reduced = useReducedMotionPreference();
  const [state, setState] = useState<UseRowHighlightResult>({ highlightedId: null, tag: null });
  const clearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const version = context?.version ?? 0;

  useEffect(() => {
    return () => {
      if (clearTimer.current) clearTimeout(clearTimer.current);
    };
  }, []);

  useEffect(() => {
    if (!context || rows === null) return;
    const pending = context.peek(list);
    if (!pending) return;
    const row = rows.find((candidate) => candidate.id === pending.rowId);

    if (row) {
      context.consume(pending);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setState({ highlightedId: row.id, tag: pending.tag });
      if (pending.focus) {
        const element = document.getElementById(getRowDomId(list, row.id));
        element?.scrollIntoView({ block: "center", behavior: reduced ? "auto" : "smooth" });
        element?.focus({ preventScroll: true });
      }
      context.announce(`${row.label} highlighted in ${listLabel}`);
      if (clearTimer.current) clearTimeout(clearTimer.current);
      clearTimer.current = setTimeout(() => {
        clearTimer.current = null;
        setState({ highlightedId: null, tag: null });
      }, ROW_HIGHLIGHT_MS);
      return;
    }

    const waitTimer = setTimeout(() => {
      if (!context.consume(pending)) return;
      if (pending.focus) document.getElementById(headingId)?.focus();
      context.announce(MISSING_ROW_MESSAGE);
    }, HIGHLIGHT_WAIT_MS);
    return () => clearTimeout(waitTimer);
    // `context` changes with `version`; `rows` is the other trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version, rows]);

  return state;
}
