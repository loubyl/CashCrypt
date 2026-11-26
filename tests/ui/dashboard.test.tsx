// Dashboard behavior against a fake-indexeddb crypt (Requirements 21.x, 22.9-22.11, 31.8).
import { cleanup, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Dashboard } from "@/components/dashboard/Dashboard";
import type { StoredPlanAction, WeeklyPlanRow } from "@/types/finance";
import {
  navigationSpies,
  renderWithCrypt,
  resetNavigationMock,
  type CryptTestContext,
} from "./helpers/crypt";

vi.mock("next/navigation", async () => (await import("./helpers/crypt")).createNavigationMock());

const REAL_NOW = "2025-06-02";
const DIALOG_ROLE = "dialog";
const DO_IT_NAME = /^Do it: /;
const PAYMENT_LABEL = "Payment amount";
const SAVE_PAYMENT_LABEL = "Save payment";
const KEEP_LABEL = "Keep it";
const CANCEL_LABEL = "Cancel subscription";
const COMPLETION_TOAST = /freed|Action completed/;
const QUICK_ACTION_LABELS = ["Log payment", "Add expense", "Import CSV", "Exorcise"];
const POLTERGEIST_TEXT = /A Poltergeist is haunting you: \$[\d,.]+ in small expenses in 30 days/;
const L4_SCORE_TEXT = "32 out of 100";
const SUGGESTED_EXTRA_CENTS = 30_000;
const CENTS_PER_DOLLAR = 100;

function action(partial: Partial<StoredPlanAction> & { id: string }): StoredPlanAction {
  return {
    kind: "fallback",
    title: partial.id,
    subtitle: "",
    monthlyAmountCents: 0,
    priorityCents: 0,
    done: false,
    ...partial,
  };
}

function storedPlan(actions: StoredPlanAction[], startLightScore = 100): WeeklyPlanRow {
  return { weekKey: REAL_NOW, actions, startLightScore, generatedOn: REAL_NOW };
}

async function renderDemo(): Promise<CryptTestContext> {
  const ctx = await renderWithCrypt(<Dashboard />, { mode: "demo", seed: "level-4" });
  // The full suite runs files in parallel; the default 1s wait is too short under that load.
  await screen.findAllByRole("button", { name: DO_IT_NAME }, { timeout: 5000 });
  return ctx;
}

async function readPlan(ctx: CryptTestContext): Promise<WeeklyPlanRow> {
  const plans = await ctx.demoDb.weeklyPlans.toArray();
  expect(plans).toHaveLength(1);
  return plans[0] as WeeklyPlanRow;
}

function checkboxFor(title: string): HTMLInputElement {
  return screen.getByRole("checkbox", { name: `Mark "${title}" as done` }) as HTMLInputElement;
}

beforeEach(() => resetNavigationMock());
afterEach(() => cleanup());

describe("Dashboard on the level 4 demo", () => {
  it("shows the light score, breakdown, Poltergeist banner, scene and live region", async () => {
    await renderDemo();
    expect(screen.getByText("Light score", { selector: "p" })).toBeTruthy();
    expect(screen.getByText(L4_SCORE_TEXT)).toBeTruthy();
    expect(screen.getByText("32 = 32 base + 0 momentum")).toBeTruthy();
    const meter = screen.getByRole("meter", { name: "Light score" });
    // The BalanceHero shows the score once; the bar shows the distance to the next level.
    expect(within(meter).getByText("8 to Level 3")).toBeTruthy();
    expect(within(meter).queryByText("32")).toBeNull();
    expect(meter.getAttribute("aria-valuetext")).toBe("Light score 32 of 100");
    expect(screen.getByText(POLTERGEIST_TEXT)).toBeTruthy();
    expect(screen.getByText("Poltergeist")).toBeTruthy();
    expect(screen.getByRole("img", { name: /^Level 4, Crumbling\./ })).toBeTruthy();
    expect(screen.getByRole("img", { name: /^Level 4, Crumbling\./ }).getAttribute("data-part")).toBe("scene");
    const live = screen.getByText("House is now Crumbling — light score 32");
    expect(live.getAttribute("aria-live")).toBe("polite");
    expect(live.className).toContain("sr-only");
  });

  it("orders Scene, score card, banner, plan card, demo controls and applies the two-column classes", async () => {
    const { container } = await renderDemo();
    const grid = container.querySelector("main > div.lg\\:grid") as HTMLElement;
    expect(grid.className).toContain("lg:grid-cols-2");
    expect(grid.className).toContain("xl:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]");
    expect(grid.className).toContain("flex-col");
    for (const column of Array.from(grid.children)) expect(column.className).toContain("contents");
    const scene = screen.getByRole("img", { name: /^Level 4, Crumbling\./ });
    const score = screen.getByText("Light score", { selector: "p" });
    const banner = screen.getByText(POLTERGEIST_TEXT);
    const plan = screen.getByRole("heading", { name: "This week's exorcism" });
    const demo = screen.getByRole("button", { name: "Skip to next week" });
    const ordered = [scene, score, banner, plan, demo];
    ordered.slice(1).forEach((node, index) => {
      const previous = ordered[index] as HTMLElement;
      expect(previous.compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });
  });

  it("shows the plan card with three rows and no delta at the start of the week", async () => {
    await renderDemo();
    expect(screen.getByRole("heading", { name: "This week's exorcism" })).toBeTruthy();
    expect(screen.getByRole("link", { name: /See all/ }).getAttribute("href")).toBe("/exorcism");
    expect(screen.getAllByRole("checkbox")).toHaveLength(3);
    expect(screen.queryByText(/this week/)).toBeNull();
  });

  it("shows four quick actions in order with Import CSV disabled", async () => {
    await renderDemo();
    const names = screen
      .getAllByRole("button")
      .map((button) => button.textContent?.trim() ?? "")
      .filter((text) => QUICK_ACTION_LABELS.includes(text));
    expect(names).toEqual(QUICK_ACTION_LABELS);
    expect((screen.getByRole("button", { name: "Import CSV" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Log payment" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("opens the Log payment and Add expense sheets and navigates on Exorcise", async () => {
    const user = userEvent.setup();
    await renderDemo();
    await user.click(screen.getByRole("button", { name: "Log payment" }));
    expect(await screen.findByRole(DIALOG_ROLE)).toBeTruthy();
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole(DIALOG_ROLE)).toBeNull());
    await user.click(screen.getByRole("button", { name: "Add expense" }));
    expect(await within(await screen.findByRole(DIALOG_ROLE)).findByLabelText("Amount")).toBeTruthy();
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole(DIALOG_ROLE)).toBeNull());
    await user.click(screen.getByRole("button", { name: "Exorcise" }));
    expect(navigationSpies.push).toHaveBeenCalledWith("/exorcism");
  });

  it("generates a new plan on Skip to next week", async () => {
    const user = userEvent.setup();
    const ctx = await renderDemo();
    const first = await readPlan(ctx);
    await user.click(screen.getByRole("button", { name: "Skip to next week" }));
    await waitFor(async () => expect(await ctx.demoDb.weeklyPlans.count()).toBe(2));
    const plans = await ctx.demoDb.weeklyPlans.toArray();
    expect(plans.map((plan) => plan.weekKey)).toContain(first.weekKey);
    expect(new Set(plans.map((plan) => plan.weekKey)).size).toBe(2);
    await waitFor(() => expect(screen.getAllByRole("checkbox")).toHaveLength(3));
  });

  it.each([
    ["shows a rise when the start score was lower", 27.5, "+5 this week"],
    ["shows a drop when the start score was higher", 40, "−8 this week"],
  ])("%s", async (_name, start, text) => {
    const ctx = await renderDemo();
    const plan = await readPlan(ctx);
    await ctx.demoDb.weeklyPlans.update(plan.weekKey, { startLightScore: start });
    expect(await screen.findByText(text)).toBeTruthy();
  });

  it("shows no delta when the floored scores are equal", async () => {
    const ctx = await renderDemo();
    const plan = await readPlan(ctx);
    // 32.1 and 32.74 differ as numbers but both display as 32.
    await ctx.demoDb.weeklyPlans.update(plan.weekKey, { startLightScore: 32.1 });
    await waitFor(async () => expect((await readPlan(ctx)).startLightScore).toBe(32.1));
    expect(screen.queryByText(/this week/)).toBeNull();
  });
});

describe("Do it flows on the level 4 demo", () => {
  it("cancels through the sheet, shows the action done and toasts once", async () => {
    const user = userEvent.setup();
    const ctx = await renderDemo();
    const plan = await readPlan(ctx);
    const target = plan.actions.find((a) => a.kind === "cancel_subscription") as StoredPlanAction;
    expect(target).toBeTruthy();
    await user.click(screen.getByRole("button", { name: `Do it: ${target.title}` }));
    const dialog = await screen.findByRole(DIALOG_ROLE);
    expect(target.title).toContain("Wraithcast");
    expect(within(dialog).getByText("Cancel Wraithcast — saves $120/mo")).toBeTruthy();
    const confirm = Array.from(dialog.querySelectorAll("button")).find(
      (b) => b.textContent?.includes(CANCEL_LABEL) && !b.textContent.includes(KEEP_LABEL),
    );
    await user.click(confirm as HTMLButtonElement);
    expect(await screen.findByText("+$120/mo saved")).toBeTruthy();
    await waitFor(() => expect(checkboxFor(target.title).checked).toBe(true));
    await waitFor(() => expect(screen.queryByRole("button", { name: `Do it: ${target.title}` })).toBeNull());
    expect(screen.queryByText(COMPLETION_TOAST)).toBeNull();
    expect(screen.getAllByText(/saved$/)).toHaveLength(1);
  });

  it("opens the Log payment sheet pre-filled with the minimum plus $300 and shows the action done", async () => {
    const user = userEvent.setup();
    const ctx = await renderDemo();
    const plan = await readPlan(ctx);
    const target = plan.actions.find((a) => a.kind === "extra_payment") as StoredPlanAction;
    expect(target.suggestedAmountCents).toBe(SUGGESTED_EXTRA_CENTS);
    const debt = (await ctx.demoDb.debts.get(target.targetId as string))!;
    const expectedCents = Math.min(debt.minimumPaymentCents + SUGGESTED_EXTRA_CENTS, debt.balanceCents);
    expect(target.title).toContain("Scarlet Moth Card");
    await user.click(screen.getByRole("button", { name: `Do it: ${target.title}` }));
    const input = (await screen.findByLabelText(PAYMENT_LABEL)) as HTMLInputElement;
    expect(within(screen.getByRole(DIALOG_ROLE)).getByText("Scarlet Moth Card")).toBeTruthy();
    expect(input.value).toBe((expectedCents / CENTS_PER_DOLLAR).toFixed(2));
    expect(screen.getByText("$300 goes above your minimum")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: SAVE_PAYMENT_LABEL }));
    expect(await screen.findByText(/^Payment saved\./)).toBeTruthy();
    await waitFor(() => expect(checkboxFor(target.title).checked).toBe(true));
    expect(screen.queryByText(COMPLETION_TOAST)).toBeNull();
    expect((await ctx.demoDb.debts.get(debt.id))?.balanceCents).toBe(debt.balanceCents - expectedCents);
  });

  it("keeps the sheet open and the action undone when the payment is invalid", async () => {
    const user = userEvent.setup();
    const ctx = await renderDemo();
    const plan = await readPlan(ctx);
    const target = plan.actions.find((a) => a.kind === "extra_payment") as StoredPlanAction;
    await user.click(screen.getByRole("button", { name: `Do it: ${target.title}` }));
    const input = await screen.findByLabelText(PAYMENT_LABEL);
    await user.clear(input);
    await user.type(input, "999999");
    await user.click(screen.getByRole("button", { name: SAVE_PAYMENT_LABEL }));
    expect(await screen.findByText(/cannot be more than the balance/i)).toBeTruthy();
    expect(screen.getByRole(DIALOG_ROLE)).toBeTruthy();
    expect(await ctx.demoDb.events.filter((e) => e.type === "debt_payment").count()).toBe(0);
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole(DIALOG_ROLE)).toBeNull());
    expect(checkboxFor(target.title).checked).toBe(false);
  });
});

describe("Delta baseline", () => {
  it("measures the delta against the plan's startLightScore and nothing else", async () => {
    const ctx = await renderDemo();
    const plan = await readPlan(ctx);
    // Live score is 32.74; a stored start of 100 must give exactly -68, not 0 or a momentum figure.
    await ctx.demoDb.weeklyPlans.update(plan.weekKey, { startLightScore: 100 });
    expect(await screen.findByText("−68 this week")).toBeTruthy();
    await ctx.demoDb.weeklyPlans.update(plan.weekKey, { startLightScore: 0 });
    expect(await screen.findByText("+32 this week")).toBeTruthy();
    expect(screen.queryByText("−68 this week")).toBeNull();
  });
});

describe("Demo controls visibility", () => {
  it("shows the level control, Reset demo and Skip to next week in demo mode", async () => {
    await renderDemo();
    expect(screen.getByRole("radiogroup", { name: "Start scenario" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Reset demo" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Skip to next week" })).toBeTruthy();
    // The name is visible text, so it is not mistaken for the current house level.
    expect(screen.getByText("Start scenario", { selector: "p" })).toBeTruthy();
  });

  it("renders none of the demo controls in real mode with data", async () => {
    await renderWithCrypt(<Dashboard />, {
      mode: "real",
      now: REAL_NOW,
      seed: { plans: [storedPlan([action({ id: "a" }), action({ id: "b" }), action({ id: "c" })])] },
    });
    await screen.findByRole("heading", { name: "This week's exorcism" });
    expect(screen.queryByRole("radiogroup", { name: "Start scenario" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Reset demo" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Skip to next week" })).toBeNull();
    expect(screen.queryByText("Demo controls")).toBeNull();
  });
});

describe("Plan actions without a Do it flow", () => {
  const FALLBACK = action({ id: "fallback:review", kind: "fallback", title: "Review last week's small expenses" });
  const REDUCE = action({
    id: "reduce:small",
    kind: "reduce_small_expenses",
    title: "Skip two coffees",
    monthlyAmountCents: 4_150,
  });
  const THIRD = action({ id: "fallback:fund", kind: "fallback", title: "Set aside $50 for an emergency fund" });

  it("shows no Do it button on fallback or reduce_small_expenses actions", async () => {
    await renderWithCrypt(<Dashboard />, {
      mode: "real",
      now: REAL_NOW,
      seed: { plans: [storedPlan([REDUCE, FALLBACK, THIRD])] },
    });
    await screen.findByText(REDUCE.title);
    expect(screen.queryAllByRole("button", { name: DO_IT_NAME })).toHaveLength(0);
    expect((screen.getByRole("button", { name: "Log payment" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByText(POLTERGEIST_TEXT)).toBeNull();
  });

  it("shows Done <date> instead of the instruction once an action is done", async () => {
    const user = userEvent.setup();
    const instruction = "Open Transactions to review it. Tick it when you are done.";
    await renderWithCrypt(<Dashboard />, {
      mode: "real",
      now: REAL_NOW,
      seed: { plans: [storedPlan([{ ...REDUCE, subtitle: instruction }, FALLBACK, THIRD])] },
    });
    expect(await screen.findByText(instruction)).toBeTruthy();
    await user.click(checkboxFor(REDUCE.title));
    expect(await screen.findByText("Done Jun 2")).toBeTruthy();
    expect(screen.queryByText(instruction)).toBeNull();
  });

  it("completes an action when its checkbox is ticked and shows the money toast", async () => {
    const user = userEvent.setup();
    const ctx = await renderWithCrypt(<Dashboard />, {
      mode: "real",
      now: REAL_NOW,
      seed: { plans: [storedPlan([REDUCE, FALLBACK, THIRD])] },
    });
    await screen.findByText(REDUCE.title);
    await user.click(checkboxFor(REDUCE.title));
    expect(await screen.findByText("+$41.50/mo freed")).toBeTruthy();
    await waitFor(() => expect(checkboxFor(REDUCE.title).checked).toBe(true));
    await user.click(checkboxFor(FALLBACK.title));
    expect(await screen.findByText("Action completed")).toBeTruthy();
    const stored = await ctx.realDb.weeklyPlans.get(REAL_NOW);
    expect(stored?.actions.filter((a) => a.done)).toHaveLength(2);
    expect(await ctx.realDb.events.filter((e) => e.type === "exorcism_action_completed").count()).toBe(2);
  });
});
