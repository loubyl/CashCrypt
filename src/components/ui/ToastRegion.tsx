"use client";

import { AnimatePresence } from "framer-motion";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from "react";
import {
  getToastRegion,
  toastReducer,
  type ToastItem,
  type ToastRegion as ToastRegionKind,
  type ToastTone,
} from "@/lib/utils/toastReducer";
import { TOAST_DEFAULT_DURATION_MS } from "./motionTokens";
import { Toast } from "./Toast";

const TOAST_ID_PREFIX = "toast-";
const USE_TOAST_ERROR = "useToast must be used inside a ToastRegion";

const WRAPPER_CLASSES =
  "pointer-events-none fixed inset-x-0 bottom-0 z-50 flex flex-col items-center gap-gap p-page";
const REGION_CLASSES = "flex w-full flex-col items-center gap-gap";
const TOAST_LAYOUT_CLASSES = "pointer-events-auto";

export type ToastShowInput = {
  tone: ToastTone;
  message: string;
  duration?: number;
  actionLabel?: string;
  /** Accessible name of the action button; overrides the visible label for assistive tech. */
  actionAccessibleName?: string;
  onAction?: () => void;
};

export type ToastApi = {
  /** Adds a toast to the region that matches its tone and returns its id. */
  show: (input: ToastShowInput) => string;
  /** Removes a toast. Unknown ids are ignored. */
  dismiss: (id: string) => void;
};

const ToastApiContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const api = useContext(ToastApiContext);
  if (api === null) {
    throw new Error(USE_TOAST_ERROR);
  }
  return api;
}

export function ToastRegion({ children }: { children: ReactNode }) {
  const [toasts, dispatch] = useReducer(toastReducer, [] as readonly ToastItem[]);
  const counterRef = useRef(0);
  const actionsRef = useRef(new Map<string, () => void>());

  const dismiss = useCallback((id: string) => {
    actionsRef.current.delete(id);
    dispatch({ type: "dismiss", id });
  }, []);

  const show = useCallback((input: ToastShowInput) => {
    counterRef.current += 1;
    const id = `${TOAST_ID_PREFIX}${counterRef.current}`;
    if (input.onAction) {
      actionsRef.current.set(id, input.onAction);
    }
    dispatch({
      type: "show",
      toast: {
        id,
        tone: input.tone,
        message: input.message,
        duration: input.duration ?? TOAST_DEFAULT_DURATION_MS,
        actionLabel: input.actionLabel,
        actionAccessibleName: input.actionAccessibleName,
      },
    });
    return id;
  }, []);

  // Runs a toast's action at most once. The Toast dismisses itself right after it.
  const runAction = useCallback((id: string) => {
    const action = actionsRef.current.get(id);
    actionsRef.current.delete(id);
    action?.();
  }, []);

  const api = useMemo<ToastApi>(() => ({ show, dismiss }), [show, dismiss]);

  const renderRegion = (kind: ToastRegionKind) =>
    toasts
      .filter((toast) => getToastRegion(toast.tone) === kind)
      .map((toast) => (
        <Toast
          key={toast.id}
          tone={toast.tone}
          message={toast.message}
          duration={toast.duration}
          actionLabel={toast.actionLabel}
          actionAccessibleName={toast.actionAccessibleName}
          onAction={() => runAction(toast.id)}
          onDismiss={() => dismiss(toast.id)}
          className={TOAST_LAYOUT_CLASSES}
        />
      ));

  return (
    <ToastApiContext.Provider value={api}>
      {children}
      <div data-inert-exempt className={WRAPPER_CLASSES}>
        <div role="status" aria-live="polite" className={REGION_CLASSES}>
          <AnimatePresence>{renderRegion("polite")}</AnimatePresence>
        </div>
        <div role="alert" aria-live="assertive" className={REGION_CLASSES}>
          <AnimatePresence>{renderRegion("assertive")}</AnimatePresence>
        </div>
      </div>
    </ToastApiContext.Provider>
  );
}
