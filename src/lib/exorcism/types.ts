// Types for the exorcism planner. Types only; no runtime code.

export type ExorcismActionKind =
  | "cancel_subscription"
  | "extra_payment"
  | "reduce_small_expenses"
  | "fallback";

export type ExorcismAction = {
  id: string;
  kind: ExorcismActionKind;
  title: string;
  subtitle: string;
  targetId?: string; // debt or subscription id the action refers to
  suggestedAmountCents?: number; // integer cents (e.g. suggested extra payment)
  monthlyAmountCents: number; // integer cents freed per month
  priorityCents: number; // integer cents; ranking score
  done: boolean;
};
