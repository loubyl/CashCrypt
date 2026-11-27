// Pure exorcism planner. No clock, no randomness, no I/O, no input mutation.

import { dollarsToCents } from "@/lib/haunting";
import { POLTERGEIST_RATIO } from "@/lib/haunting/config";
import type { FinancialSnapshot, HouseState } from "@/lib/haunting";
import { formatCentsShort } from "@/lib/utils/cents";
import {
  BASIS_POINTS_DENOMINATOR,
  CENTS_PER_WHOLE_DOLLAR,
  EMERGENCY_FUND_INCOME_BASIS_POINTS,
  EXTRA_PAYMENT_INCOME_BASIS_POINTS,
  FALLBACK_ID_PREFIX,
  FALLBACK_KEYS,
  FLOAT_NOISE_EPSILON,
  MONTHS_PER_YEAR_FOR_INTEREST,
  PLAN_SIZE,
  USAGE_WEIGHTS,
} from "./config";
import type { FallbackKey } from "./config";
import type { ExorcismAction } from "./types";

export type { ExorcismAction, ExorcismActionKind } from "./types";

const CANCEL_PREFIX = "cancel:";
const PAY_PREFIX = "pay:";
const REDUCE_PREFIX = "reduce:";
const CANCEL_SUBTITLE = "Open Subscriptions to cancel it";
const PAY_SUBTITLE = "Open Debts to log the payment";
const REDUCE_SUBTITLE = "Open Transactions to review it. Tick it when you are done.";
const EMERGENCY_FUND_GENERIC_TITLE = "Set aside a small amount for an emergency fund";
// There is no savings screen, so this subtitle points to no screen.
const EMERGENCY_FUND_SUBTITLE = "Move it to savings, then mark it done";
const REVIEW_EXPENSES_TITLE = "Review last week's small expenses";
const REVIEW_SUBSCRIPTIONS_TITLE = "Review your subscription list";
const REVIEW_SUBSCRIPTIONS_SUBTITLE = "Open Subscriptions to review it";

type DebtView = { debtId: string; name: string; balanceCents: number; apr: number };

/** Hostile numbers (NaN, Infinity, negative, non-number) become 0. */
function clean(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0;
}

function cleanText(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asArray<T>(value: readonly T[] | undefined | null): readonly T[] {
  return Array.isArray(value) ? value : [];
}

/** Code-point order comparison (not locale-aware). */
function compareText(a: string, b: string): number {
  const left = a[Symbol.iterator]();
  const right = b[Symbol.iterator]();
  for (;;) {
    const l = left.next();
    const r = right.next();
    if (l.done === true || r.done === true) {
      if (l.done === r.done) return 0;
      return l.done === true ? -1 : 1;
    }
    const lp = l.value.codePointAt(0) ?? 0;
    const rp = r.value.codePointAt(0) ?? 0;
    if (lp !== rp) return lp < rp ? -1 : 1;
  }
}

function isFallback(action: ExorcismAction): boolean {
  return action.kind === "fallback";
}

function compareActions(a: ExorcismAction, b: ExorcismAction): number {
  if (a.priorityCents !== b.priorityCents) return b.priorityCents - a.priorityCents;
  if (isFallback(a) !== isFallback(b)) return isFallback(a) ? 1 : -1;
  return compareText(a.id, b.id);
}

function wholeDollarsOfIncome(incomeCents: number, basisPoints: number): number {
  const dollars = Math.floor(
    (incomeCents * basisPoints) / (BASIS_POINTS_DENOMINATOR * CENTS_PER_WHOLE_DOLLAR),
  );
  return dollars * CENTS_PER_WHOLE_DOLLAR;
}

function buildCancellations(houseState: HouseState): ExorcismAction[] {
  return asArray(houseState.zombies).map((zombie) => {
    const monthlyCost = Math.round(clean(zombie.monthlyCost));
    const weight = USAGE_WEIGHTS[zombie.usage] ?? 0;
    const id = cleanText(zombie.subscriptionId);
    return {
      id: `${CANCEL_PREFIX}${id}`,
      kind: "cancel_subscription",
      title: `Cancel ${cleanText(zombie.name)} — saves ${formatCentsShort(monthlyCost)}/mo`,
      subtitle: CANCEL_SUBTITLE,
      targetId: id,
      monthlyAmountCents: monthlyCost,
      priorityCents: Math.round(monthlyCost * weight),
      done: false,
    };
  });
}

function compareDebtsForPayment(a: DebtView, b: DebtView): number {
  if (a.apr !== b.apr) return b.apr - a.apr;
  if (a.balanceCents !== b.balanceCents) return b.balanceCents - a.balanceCents;
  return compareText(a.debtId, b.debtId);
}

function buildExtraPayment(snapshot: FinancialSnapshot, incomeCents: number): ExorcismAction | null {
  const debts: DebtView[] = asArray(snapshot.debts)
    .map((debt) => ({
      debtId: cleanText(debt.debtId),
      name: cleanText(debt.name),
      balanceCents: dollarsToCents(clean(debt.balance)),
      apr: clean(debt.apr),
    }))
    .filter((debt) => debt.balanceCents > 0)
    .sort(compareDebtsForPayment);
  const target = debts[0];
  if (target === undefined) return null;
  const suggested = Math.min(
    target.balanceCents,
    wholeDollarsOfIncome(incomeCents, EXTRA_PAYMENT_INCOME_BASIS_POINTS),
  );
  if (suggested === 0) return null;
  const interest = clean(
    Math.round((suggested * target.apr) / MONTHS_PER_YEAR_FOR_INTEREST),
  );
  return {
    id: `${PAY_PREFIX}${target.debtId}`,
    kind: "extra_payment",
    title: `Pay ${formatCentsShort(suggested)} extra on ${target.name} — saves ${formatCentsShort(interest)}/mo in interest`,
    subtitle: PAY_SUBTITLE,
    targetId: target.debtId,
    suggestedAmountCents: suggested,
    monthlyAmountCents: interest,
    priorityCents: interest,
    done: false,
  };
}

function pickTopCategory(byCategory: Record<string, number>): string | null {
  let best: string | null = null;
  let bestValue = 0;
  for (const [category, raw] of Object.entries(byCategory)) {
    const value = clean(raw);
    if (value === 0) continue;
    if (value > bestValue || (value === bestValue && best !== null && compareText(category, best) < 0)) {
      best = category;
      bestValue = value;
    }
  }
  return best;
}

function buildReduction(houseState: HouseState, incomeCents: number): ExorcismAction | null {
  const poltergeist = houseState.poltergeist;
  if (poltergeist === null || poltergeist === undefined) return null;
  const category = pickTopCategory(poltergeist.byCategory ?? {});
  if (category === null) return null;
  const excessDollars = Math.ceil(
    (clean(poltergeist.totalAmount) - POLTERGEIST_RATIO * incomeCents) / CENTS_PER_WHOLE_DOLLAR -
      FLOAT_NOISE_EPSILON,
  );
  if (!Number.isFinite(excessDollars) || excessDollars <= 0) return null;
  const excessCents = excessDollars * CENTS_PER_WHOLE_DOLLAR;
  return {
    id: `${REDUCE_PREFIX}${category}`,
    kind: "reduce_small_expenses",
    title: `Cut ${category} by ${formatCentsShort(excessCents)} this month to dispel the Poltergeist`,
    subtitle: REDUCE_SUBTITLE,
    targetId: category,
    monthlyAmountCents: excessCents,
    priorityCents: excessCents,
    done: false,
  };
}

function emergencyFundTitle(incomeCents: number): string {
  const cents = wholeDollarsOfIncome(incomeCents, EMERGENCY_FUND_INCOME_BASIS_POINTS);
  return cents === 0
    ? EMERGENCY_FUND_GENERIC_TITLE
    : `Set aside ${formatCentsShort(cents)} for an emergency fund`;
}

function buildFallback(key: FallbackKey, incomeCents: number): ExorcismAction {
  const base = {
    id: `${FALLBACK_ID_PREFIX}${key}`,
    kind: "fallback" as const,
    monthlyAmountCents: 0,
    priorityCents: 0,
    done: false,
  };
  if (key === "emergency-fund") {
    return { ...base, title: emergencyFundTitle(incomeCents), subtitle: EMERGENCY_FUND_SUBTITLE };
  }
  if (key === "review-small-expenses") {
    return { ...base, title: REVIEW_EXPENSES_TITLE, subtitle: "Open Transactions to review it" };
  }
  return {
    ...base,
    title: REVIEW_SUBSCRIPTIONS_TITLE,
    subtitle: REVIEW_SUBSCRIPTIONS_SUBTITLE,
  };
}

/** Picks the plan from a ranked list, forcing the extra payment in when it ranks below the top. */
function selectPlan(ranking: ExorcismAction[]): ExorcismAction[] {
  const top = ranking.slice(0, PLAN_SIZE);
  const extra = ranking.find((action) => action.kind === "extra_payment");
  if (extra === undefined || top.includes(extra)) return top;
  const others = ranking.filter((action) => action.kind !== "extra_payment");
  // No re-sort needed: `extra` is outside the top three, so the first two non-extra actions are
  // ranking[0] and ranking[1], already in order and both ranked above `extra`.
  return [...others.slice(0, PLAN_SIZE - 1), extra];
}

/** Generates exactly three exorcism actions, ranked by monthly money freed. */
export function generateExorcismPlan(
  houseState: HouseState,
  snapshot: FinancialSnapshot,
): ExorcismAction[] {
  const incomeCents = dollarsToCents(clean(snapshot.monthlyIncome));
  const extra = buildExtraPayment(snapshot, incomeCents);
  const reduction = buildReduction(houseState, incomeCents);
  const candidates = [
    ...buildCancellations(houseState),
    ...(extra === null ? [] : [extra]),
    ...(reduction === null ? [] : [reduction]),
  ];
  const fallbacks = FALLBACK_KEYS.map((key) => buildFallback(key, incomeCents));
  const ranking = [...candidates, ...fallbacks].sort(compareActions);
  return selectPlan(ranking);
}
