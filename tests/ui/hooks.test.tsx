import { act, render, renderHook, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { CryptProvider, useCrypt } from "@/hooks/useCrypt";
import { useHouseState } from "@/hooks/useHouseState";
import { useNow } from "@/hooks/useNow";
import { logPayment } from "@/lib/db/mutations";
import { MODE_STORAGE_KEY } from "@/lib/db/modeStore";
import type { CryptDb } from "@/lib/db/schema";
import { skipWeek } from "@/lib/demo/service";
import type { DebtRow } from "@/types/finance";
import { createMemoryStorage, renderWithCrypt } from "./helpers/crypt";

const NOW = "2025-06-15";
const DAYS_IN_WEEK = 7;
const DEBT_ID = "debt-1";
const DEBT: DebtRow = {
  id: DEBT_ID,
  name: "Test loan",
  balanceCents: 1_000_000,
  apr: 0.2,
  minimumPaymentCents: 20_000,
};
const EXTRA_PAYMENT_CENTS = 400_000;

type Probe = {
  houseState: ReturnType<typeof useHouseState>;
  now: ReturnType<typeof useNow>;
  crypt: ReturnType<typeof useCrypt>;
};

/** Renders hook results into a mutable holder so tests can read the latest values. */
function createProbe(): { holder: { current: Probe | null }; Component: () => ReactNode } {
  const holder: { current: Probe | null } = { current: null };
  const record = (probe: Probe): void => {
    holder.current = probe;
  };
  function Component(): ReactNode {
    const probe: Probe = {
      houseState: useHouseState(),
      now: useNow(),
      crypt: useCrypt(),
    };
    record(probe);
    return <p data-testid="state">{probe.houseState.status}</p>;
  }
  return { holder, Component };
}

function latest(holder: { current: Probe | null }): Probe {
  if (!holder.current) throw new Error("The probe has not rendered yet.");
  return holder.current;
}

describe("useHouseState", () => {
  it("returns a new house state after a mutation without reloading", async () => {
    const { holder, Component } = createProbe();
    const ctx = await renderWithCrypt(<Component />, {
      mode: "real",
      seed: { debts: [DEBT] },
      now: NOW,
    });

    await waitFor(() => expect(latest(holder).houseState.status).toBe("ready"));
    const before = latest(holder).houseState;
    if (before.status !== "ready") throw new Error("Expected a ready house state.");

    await act(async () => {
      await logPayment(ctx.realDb, DEBT_ID, EXTRA_PAYMENT_CENTS, { now: NOW });
    });

    await waitFor(() => {
      const after = latest(holder).houseState;
      expect(after.status).toBe("ready");
      if (after.status !== "ready") return;
      expect(after.houseState).not.toBe(before.houseState);
      expect(after.houseState.lightScore).toBeGreaterThan(before.houseState.lightScore);
      expect(after.rows.debts[0]?.balanceCents).toBe(DEBT.balanceCents - EXTRA_PAYMENT_CENTS);
    });
  });

  it("reports loading before the first query result", async () => {
    const { holder, Component } = createProbe();
    await renderWithCrypt(<Component />, { mode: "real", seed: { debts: [DEBT] }, now: NOW });

    const first = latest(holder).houseState;
    expect(first.status).toBe("loading");
    expect(first.loading).toBe(true);
    expect(first.houseState).toBeNull();
    expect(screen.getByTestId("state")).toHaveTextContent("loading");

    await waitFor(() => expect(latest(holder).houseState.status).toBe("ready"));
  });
});

describe("useCrypt", () => {
  it("reports unavailable when open rejects", async () => {
    const failingDb = {
      open: () => Promise.reject(new Error("blocked")),
    } as unknown as CryptDb;
    const storage = createMemoryStorage({ [MODE_STORAGE_KEY]: "real" });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <CryptProvider openDb={() => failingDb} storage={storage} getClock={() => NOW}>
        {children}
      </CryptProvider>
    );

    const { result } = renderHook(() => useCrypt(), { wrapper });

    await waitFor(() => expect(result.current.status).toBe("unavailable"));
    expect(result.current.db).toBeNull();
  });

  it("throws when used outside a provider", () => {
    expect(() => render(<ThrowingConsumer />)).toThrow(/CryptProvider/);
  });
});

function ThrowingConsumer(): ReactNode {
  useCrypt();
  return null;
}

describe("useNow", () => {
  it("uses the demo date in demo mode instead of the clock", async () => {
    const { holder, Component } = createProbe();
    const ctx = await renderWithCrypt(<Component />, { mode: "demo", now: NOW });

    await waitFor(() => expect(latest(holder).now).toBe(NOW));
    expect(latest(holder).crypt.status).toBe("demo");

    // The clock stays at NOW, so a moved demoNow proves the hook reads the profile.
    await act(async () => {
      await skipWeek(ctx.demoDb);
    });
    const expected = new Date(`${NOW}T00:00:00Z`);
    expected.setUTCDate(expected.getUTCDate() + DAYS_IN_WEEK);
    await waitFor(() => expect(latest(holder).now).toBe(expected.toISOString().slice(0, 10)));
  });

  it("uses the clock in real mode", async () => {
    const { holder, Component } = createProbe();
    await renderWithCrypt(<Component />, { mode: "real", seed: {}, now: NOW });

    await waitFor(() => expect(latest(holder).now).toBe(NOW));
    expect(latest(holder).crypt.status).toBe("real");
  });
});
