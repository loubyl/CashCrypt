// Paying off a debt removes its minimum payment from factor A (Requirement 4.3).
// Level-4 demo: income $3,000/mo; minimums Scarlet Moth Card $400, Car loan $150,
// Student loan $60. Paying the $2,000 Student loan in full drops A from 610/3000 to 550/3000.
import { IDBFactory, IDBKeyRange } from "fake-indexeddb";
import { afterEach, describe, expect, it } from "vitest";
import { openCrypt } from "@/lib/db/crypt";
import { logPayment } from "@/lib/db/mutations";
import { readAllRows } from "@/lib/db/queries";
import { DEMO_DB_NAME, type CryptDb } from "@/lib/db/schema";
import { toFinancialSnapshot } from "@/lib/db/snapshotAdapter";
import { loadScenario } from "@/lib/demo/service";
import { computeHouseState, type FinancialSnapshot } from "@/lib/haunting";

const NOW = "2025-06-02";
const STUDENT_MINIMUM_DOLLARS = 60;
const DECIMALS = 9;

const opened: CryptDb[] = [];
afterEach(() => {
  while (opened.length > 0) opened.pop()?.close();
});

function factorA(snapshot: FinancialSnapshot): number {
  const minimums = snapshot.debts.reduce((sum, d) => sum + d.minimumMonthlyPayment, 0);
  return minimums / snapshot.monthlyIncome;
}

describe("Student loan on the level-4 demo", () => {
  it("drops its $60 minimum from factor A once paid off, while the stored minimum stays", async () => {
    const db = openCrypt(DEMO_DB_NAME, { indexedDB: new IDBFactory(), IDBKeyRange });
    opened.push(db);
    await db.open();
    await loadScenario(db, "level-4", NOW);
    const before = toFinancialSnapshot(await readAllRows(db), NOW);
    const loan = (await db.debts.toArray()).find((d) => d.name === "Student loan");
    if (!loan) throw new Error("Student loan is missing from the level-4 seed.");

    await logPayment(db, loan.id, loan.balanceCents, { now: NOW });
    const rows = await readAllRows(db);
    const after = toFinancialSnapshot(rows, NOW);

    expect(factorA(before)).toBeCloseTo(610 / 3000, DECIMALS);
    expect(factorA(after)).toBeCloseTo(550 / 3000, DECIMALS);
    expect((factorA(before) - factorA(after)) * after.monthlyIncome).toBeCloseTo(STUDENT_MINIMUM_DOLLARS, DECIMALS);
    // Stored data is unchanged: the paid-off row keeps its $60 minimum.
    expect(rows.debts.find((d) => d.id === loan.id)).toMatchObject({ balanceCents: 0, minimumPaymentCents: 6_000 });

    // The engine sees the smaller burden: a higher base score than with the stored minimum kept.
    const withStoredMinimum: FinancialSnapshot = {
      ...after,
      debts: after.debts.map((d) => (d.debtId === loan.id ? { ...d, minimumMonthlyPayment: STUDENT_MINIMUM_DOLLARS } : d)),
    };
    expect(computeHouseState(after).baseScore).toBeGreaterThan(computeHouseState(withStoredMinimum).baseScore);
  });
});
