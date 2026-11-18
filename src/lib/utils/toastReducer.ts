export type ToastTone = "success" | "info" | "warning" | "danger";

export type ToastItem = {
  id: string;
  tone: ToastTone;
  message: string;
  duration: number;
  actionLabel?: string;
};

export type ToastAction =
  | { type: "show"; toast: ToastItem }
  | { type: "dismiss"; id: string };

export type ToastRegion = "polite" | "assertive";

const REGION_POLITE: ToastRegion = "polite";
const REGION_ASSERTIVE: ToastRegion = "assertive";

const TONE_REGION: Record<ToastTone, ToastRegion> = {
  success: REGION_POLITE,
  info: REGION_POLITE,
  warning: REGION_ASSERTIVE,
  danger: REGION_ASSERTIVE,
};

export function getToastRegion(tone: ToastTone): ToastRegion {
  return TONE_REGION[tone];
}

export function toastReducer(
  state: readonly ToastItem[],
  action: ToastAction,
): readonly ToastItem[] {
  switch (action.type) {
    case "show":
      return [...state, action.toast];
    case "dismiss": {
      if (!state.some((toast) => toast.id === action.id)) {
        return state;
      }
      return state.filter((toast) => toast.id !== action.id);
    }
  }
}
