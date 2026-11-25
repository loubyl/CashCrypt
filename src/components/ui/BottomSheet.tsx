"use client";

import { X } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion, type Variants } from "framer-motion";
import {
  useId,
  useLayoutEffect,
  useRef,
  useSyncExternalStore,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { FOCUSABLE_SELECTOR, getNextFocusIndex, shouldSkipInert } from "@/lib/utils/focusTrap";
import { Button } from "./Button";
import { REDUCED_FADE_MAX_S, SHEET_DURATION_S, type LayoutClassName } from "./motionTokens";

const DESKTOP_QUERY = "(min-width: 1024px)";
const SHEET_BOUNCE = 0.1;
const MODAL_HIDDEN_SCALE = 0.96;
const SHEET_HIDDEN_OFFSET = "100%";
const INERT_ATTRIBUTE = "inert";
const INERT_EXEMPT_ATTRIBUTE = "data-inert-exempt";
const SCROLL_LOCK_ATTRIBUTE = "data-scroll-locked";
const ESCAPE_KEY = "Escape";
const TAB_KEY = "Tab";
const NO_INDEX = -1;

// z-40 keeps the ToastRegion (z-50) above an open sheet.
const LAYER_CLASSES = "fixed inset-0 z-40 flex items-end justify-center lg:items-center";
const SCRIM_CLASSES = "absolute inset-0 bg-scrim";
const PANEL_CLASSES =
  "relative flex max-h-[90dvh] w-full flex-col gap-4 overflow-y-auto rounded-t-lg bg-surface-card p-card " +
  "text-ink shadow-overlay outline-none lg:max-w-content lg:rounded-lg";
const HANDLE_CLASSES = "mx-auto h-1 w-10 shrink-0 rounded-pill bg-surface-overlay lg:hidden";
const HEADER_CLASSES = "flex items-center justify-between gap-3";
const TITLE_CLASSES = "font-display text-title text-ink";

type SheetMotionContext = { reduced: boolean; desktop: boolean };

const sheetTransition = (reduced: boolean) =>
  reduced
    ? { duration: REDUCED_FADE_MAX_S }
    : { type: "spring" as const, duration: SHEET_DURATION_S, bounce: SHEET_BOUNCE };

const layerVariants: Variants = {
  hidden: {},
  visible: {},
  exit: {},
};

const scrimVariants: Variants = {
  hidden: { opacity: 0 },
  visible: ({ reduced }: SheetMotionContext) => ({
    opacity: 1,
    transition: { duration: reduced ? REDUCED_FADE_MAX_S : SHEET_DURATION_S },
  }),
  exit: ({ reduced }: SheetMotionContext) => ({
    opacity: 0,
    transition: { duration: reduced ? REDUCED_FADE_MAX_S : SHEET_DURATION_S },
  }),
};

// Reduced motion keeps only opacity; otherwise the sheet slides up and the modal fades and scales.
const panelVariants: Variants = {
  hidden: ({ reduced, desktop }: SheetMotionContext) => ({
    opacity: 0,
    y: reduced || desktop ? 0 : SHEET_HIDDEN_OFFSET,
    scale: reduced || !desktop ? 1 : MODAL_HIDDEN_SCALE,
  }),
  visible: ({ reduced }: SheetMotionContext) => ({
    opacity: 1,
    y: 0,
    scale: 1,
    transition: sheetTransition(reduced),
  }),
  exit: ({ reduced, desktop }: SheetMotionContext) => ({
    opacity: 0,
    y: reduced || desktop ? 0 : SHEET_HIDDEN_OFFSET,
    scale: reduced || !desktop ? 1 : MODAL_HIDDEN_SCALE,
    transition: sheetTransition(reduced),
  }),
};

function subscribeNoop(): () => void {
  return () => undefined;
}

function getClientSnapshot(): boolean {
  return true;
}

function getServerSnapshot(): boolean {
  return false;
}

function subscribeDesktop(onChange: () => void): () => void {
  if (typeof window.matchMedia !== "function") {
    return () => undefined;
  }
  const query = window.matchMedia(DESKTOP_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function getDesktopSnapshot(): boolean {
  return typeof window.matchMedia === "function" && window.matchMedia(DESKTOP_QUERY).matches;
}

/** Sets `inert` on body children (except exempt ones) and returns a function that restores the prior state. */
function applyInertBackground(layer: HTMLElement): () => void {
  const changed: Element[] = [];
  for (const child of Array.from(document.body.children)) {
    const exempt = shouldSkipInert(child.tagName, child.hasAttribute(INERT_EXEMPT_ATTRIBUTE));
    if (child === layer || exempt || child.hasAttribute(INERT_ATTRIBUTE)) {
      continue;
    }
    child.setAttribute(INERT_ATTRIBUTE, "");
    changed.push(child);
  }
  return () => {
    for (const child of changed) {
      child.removeAttribute(INERT_ATTRIBUTE);
    }
  };
}

function lockScroll(): () => void {
  const root = document.documentElement;
  const hadLock = root.hasAttribute(SCROLL_LOCK_ATTRIBUTE);
  root.setAttribute(SCROLL_LOCK_ATTRIBUTE, "");
  return () => {
    if (!hadLock) {
      root.removeAttribute(SCROLL_LOCK_ATTRIBUTE);
    }
  };
}

function moveFocusIn(dialog: HTMLElement): void {
  const first = dialog.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
  (first ?? dialog).focus();
}

export type BottomSheetProps = {
  open: boolean;
  /** Called once per Escape press, scrim click or Close button activation. The parent sets `open` to false. */
  onClose: () => void;
  /** Visible heading; also the accessible name of the dialog. */
  title: string;
  /** Layout utilities only (margin, width, placement). Never colors or spacing. */
  className?: LayoutClassName;
  children?: ReactNode;
};

export function BottomSheet({ open, onClose, title, className, children }: BottomSheetProps) {
  const isClient = useSyncExternalStore(subscribeNoop, getClientSnapshot, getServerSnapshot);
  const desktop = useSyncExternalStore(subscribeDesktop, getDesktopSnapshot, getServerSnapshot);
  const reduced = Boolean(useReducedMotion());
  const titleId = useId();
  const layerRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const active = open && isClient;

  useLayoutEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  // Inert background and scroll lock. This effect lives here (not in the animated layer) so its
  // cleanup runs when `open` turns false, before the exit animation ends.
  useLayoutEffect(() => {
    const layer = layerRef.current;
    const dialog = dialogRef.current;
    if (!active || !layer || !dialog) {
      return;
    }
    returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const restoreInert = applyInertBackground(layer);
    const restoreScroll = lockScroll();
    moveFocusIn(dialog);
    return () => {
      restoreInert();
      restoreScroll();
    };
  }, [active]);

  // Focus restore runs as an effect setup, not in the cleanup above: React restores the element that
  // was focused before a commit (the still-mounted dialog) after cleanups run, which would undo it.
  // By now the cleanup has removed `inert`, so the trigger can take focus.
  useLayoutEffect(() => {
    const target = returnFocusRef.current;
    if (active || !target) {
      return;
    }
    returnFocusRef.current = null;
    if (target.isConnected) {
      target.focus();
    }
  }, [active]);

  // Unmounted while open: the dialog leaves the document, so React has nothing to restore over us.
  useLayoutEffect(
    () => () => {
      if (returnFocusRef.current?.isConnected) {
        returnFocusRef.current.focus();
      }
    },
    [],
  );

  useLayoutEffect(() => {
    if (!active) {
      return;
    }
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === ESCAPE_KEY) {
        onCloseRef.current();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [active]);

  const handleDialogKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== TAB_KEY) {
      return;
    }
    const dialog = event.currentTarget;
    const items = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
    event.preventDefault();
    if (items.length === 0) {
      dialog.focus();
      return;
    }
    const current = items.findIndex((item) => item === document.activeElement);
    const next = getNextFocusIndex(items.length, current, event.shiftKey);
    if (next !== NO_INDEX) {
      items[next].focus();
    }
  };

  if (!isClient) {
    return null;
  }

  const motionContext: SheetMotionContext = { reduced, desktop };
  const layerClasses = [LAYER_CLASSES, className ?? ""].filter(Boolean).join(" ");

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          key="bottom-sheet"
          ref={layerRef}
          data-part="bottom-sheet"
          className={layerClasses}
          data-reduced-motion={reduced ? "true" : "false"}
          variants={layerVariants}
          custom={motionContext}
          initial="hidden"
          animate="visible"
          exit="exit"
        >
          <motion.div
            role="presentation"
            aria-hidden="true"
            className={SCRIM_CLASSES}
            variants={scrimVariants}
            custom={motionContext}
            onClick={() => onCloseRef.current()}
          />
          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            tabIndex={-1}
            className={PANEL_CLASSES}
            variants={panelVariants}
            custom={motionContext}
            onKeyDown={handleDialogKeyDown}
          >
            <div aria-hidden="true" className={HANDLE_CLASSES} />
            <div className={HEADER_CLASSES}>
              <h2 id={titleId} className={TITLE_CLASSES}>
                {title}
              </h2>
              <Button
                variant="secondary"
                size="md"
                aria-label="Close"
                leadingIcon={X}
                onClick={() => onCloseRef.current()}
              />
            </div>
            {children}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}
