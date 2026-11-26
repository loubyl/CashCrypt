"use client";
import { useRouter, usePathname } from "next/navigation";
import { useCallback } from "react";
import { useRequestHighlight } from "@/components/feedback/RowHighlightProvider";
import { ACTION_TOAST_DURATION_MS } from "@/components/ui/motionTokens";
import { useToast } from "@/components/ui/ToastRegion";
import type { HouseChange } from "@/hooks/useCryptActions";
import {
  getDestinationPath,
  getViewActionName,
  type HighlightTarget,
} from "@/lib/utils/destinations";
import { getLightClause, joinToastText } from "@/lib/utils/lightClause";
import type { ToastTone } from "@/lib/utils/toastReducer";

const VIEW_LABEL = "View";

export type ToastEffect =
  | { kind: "light"; change: HouseChange | null | undefined }
  | { kind: "fixed"; clause: string };

export type ActionToastInput = {
  tone: ToastTone;
  base: string;
  effect: ToastEffect;
  /** Omitted for actions with no row to show (income, deletes). */
  destination?: HighlightTarget;
};

function getClause(effect: ToastEffect): string | null {
  if (effect.kind === "fixed") return effect.clause;
  return effect.change ? getLightClause(effect.change.lightBefore, effect.change.lightAfter) : null;
}

/** Returns a function that shows a Light_Toast with an optional "View" or in-place highlight. */
export function useActionToast(): (input: ActionToastInput) => void {
  const { show } = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const requestHighlight = useRequestHighlight();

  return useCallback(
    ({ tone, base, effect, destination }: ActionToastInput) => {
      const message = joinToastText(base, getClause(effect));
      if (!destination) {
        show({ tone, message });
        return;
      }
      const path = getDestinationPath(destination.list);
      if (pathname === path) {
        requestHighlight({ ...destination, focus: false });
        show({ tone, message });
        return;
      }
      show({
        tone,
        message,
        actionLabel: VIEW_LABEL,
        actionAccessibleName: getViewActionName(destination.list),
        duration: ACTION_TOAST_DURATION_MS,
        onAction: () => {
          requestHighlight({ ...destination, focus: true });
          router.push(path);
        },
      });
    },
    [show, router, pathname, requestHighlight],
  );
}
