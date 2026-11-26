// Measured and serialized Mutations (action-feedback Requirements 1.1, 2.7, 2.8).
import Dexie from "dexie";
import { act, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ActionObserverContext } from "@/hooks/useActionObserver";
import type { ActionObserver } from "@/hooks/useActionObserver";
import { useCryptActions } from "@/hooks/useCryptActions";
import type { CryptActions } from "@/hooks/useCryptActions";
import type { DebtRow, SubscriptionRow } from "@/types/finance";
import { renderWithCrypt } from "./helpers/crypt";

const NOW = "2025-06-15";
const DEBT: DebtRow = {
  id: "debt-1",
  name: "Test loan",
  balanceCents: 1_000_000,
  apr: 0.2,
  minimumPaymentCents: 20_000,
};
const SMALL_SUB: SubscriptionRow = {
  id: "sub-small",
  name: "Small",
  amountCents: 1000,
  cadence: "monthly",
  usage: "never",
  active: true,
};
const BIG_SUB: SubscriptionRow = {
  id: "sub-big",
  name: "Big",
  amountCents: 9000,
  cadence: "monthly",
  usage: "never",
  active: true,
};
const SEED = { debts: [DEBT], subscriptions: [SMALL_SUB, BIG_SUB] };

function createProbe(): { current: CryptActions | null; Component: () => ReactNode } {
  const probe: { current: CryptActions | null; Component: () => ReactNode } = {
    current: null,
    Component: () => {
      probe.current = useCryptActions();
      return null;
    },
  };
  return probe;
}

async function setup(observer?: ActionObserver) {
  const probe = createProbe();
  const ui = observer ? (
    <ActionObserverContext.Provider value={observer}>
      <probe.Component />
    </ActionObserverContext.Provider>
  ) : (
    <probe.Component />
  );
  const ctx = await renderWithCrypt(ui, { mode: "real", seed: SEED, now: NOW });
  await waitFor(() => expect(probe.current?.clearAll).toBeDefined());
  await waitFor(async () => expect((await probe.current?.setIncome(500_000))?.ok).toBe(true));
  return { ctx, actions: (): CryptActions => probe.current as CryptActions };
}

afterEach(() => vi.restoreAllMocks());

describe("measured actions", () => {
  it("runs two actions started together in order, each reporting its own delta", async () => {
    const { actions } = await setup();
    let first: Awaited<ReturnType<CryptActions["cancelSubscription"]>> | undefined;
    let second: Awaited<ReturnType<CryptActions["cancelSubscription"]>> | undefined;
    await act(async () => {
      const a = actions().cancelSubscription(SMALL_SUB.id);
      const b = actions().cancelSubscription(BIG_SUB.id);
      [first, second] = await Promise.all([a, b]);
    });

    if (!first?.ok || !second?.ok || !first.change || !second.change) {
      throw new Error("Expected two measured results.");
    }
    expect(first.change.lightAfter).toBeGreaterThan(first.change.lightBefore);
    expect(second.change.lightAfter).toBeGreaterThan(second.change.lightBefore);
    expect(second.change.lightBefore).toBe(first.change.lightAfter);
    const firstDelta = first.change.lightAfter - first.change.lightBefore;
    const secondDelta = second.change.lightAfter - second.change.lightBefore;
    expect(secondDelta).not.toBeCloseTo(firstDelta, 6);
  });

  it("gives change null when a reading fails and the Mutation still succeeds", async () => {
    const { ctx, actions } = await setup();
    // Readings use a read-only transaction; Mutations use read-write ones.
    const realTransaction = Dexie.prototype.transaction as (...args: unknown[]) => unknown;
    vi.spyOn(Dexie.prototype, "transaction").mockImplementation(function (this: unknown, ...args: unknown[]) {
      return args[0] === "r" || args[0] === "readonly"
        ? Promise.reject(new Error("read failed"))
        : realTransaction.apply(this, args);
    } as never);

    let result: Awaited<ReturnType<CryptActions["cancelSubscription"]>> | undefined;
    await act(async () => {
      result = await actions().cancelSubscription(SMALL_SUB.id);
    });

    expect(result?.ok).toBe(true);
    expect(result?.ok && result.change).toBeNull();
    vi.restoreAllMocks();
    expect((await ctx.realDb.subscriptions.get(SMALL_SUB.id))?.active).toBe(false);
  });

  it("returns no change when the Mutation fails, and the next action still runs", async () => {
    const { actions } = await setup();
    let failed: Awaited<ReturnType<CryptActions["logPayment"]>> | undefined;
    let next: Awaited<ReturnType<CryptActions["cancelSubscription"]>> | undefined;
    await act(async () => {
      const a = actions().logPayment("missing-debt", 1000);
      const b = actions().cancelSubscription(SMALL_SUB.id);
      [failed, next] = await Promise.all([a, b]);
    });

    expect(failed?.ok).toBe(false);
    expect(failed && "change" in failed).toBe(false);
    expect(next?.ok).toBe(true);
  });

  it("calls begin synchronously, before the action waits in the chain", async () => {
    const calls: string[] = [];
    const observer: ActionObserver = {
      begin: (action) => {
        calls.push(`begin:${action.kind}`);
        return { id: calls.length };
      },
      resolve: (_ticket, outcome) => void calls.push(`resolve:${outcome.kind}`),
      fail: () => void calls.push("fail"),
    };
    const { actions } = await setup(observer);
    calls.length = 0;

    let pending: Promise<unknown> = Promise.resolve();
    await act(async () => {
      const a = actions().cancelSubscription(SMALL_SUB.id);
      const b = actions().logPayment(DEBT.id, DEBT.minimumPaymentCents + 5000);
      expect(calls).toEqual(["begin:cancel", "begin:payment"]);
      pending = Promise.all([a, b]);
      await pending;
    });

    expect(calls).toEqual(["begin:cancel", "begin:payment", "resolve:cancel", "resolve:payment"]);
  });
});
