import { IDBFactory, IDBKeyRange } from "fake-indexeddb";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { openCrypt } from "@/lib/db/crypt";
import { DbNotFoundError, DbValidationError } from "@/lib/db/errors";
import {
  addDebt,
  addSubscription,
  addTransaction,
  cancelSubscription,
  completePlanAction,
  editDebt,
  editSubscription,
  logPayment,
  reactivateSubscription,
  setMonthlyIncome,
  uncompletePlanAction,
  type MutationContext,
} from "@/lib/db/mutations";
import { PROFILE_ID, type CryptDb } from "@/lib/db/schema";
import { addDays, getPlanWeekStart } from "@/lib/utils/calendar";
import { MAX_MONEY_CENTS, MAX_NAME_LENGTH, MIN_INCOME_CENTS_INPUT } from "@/lib/validation/limits";
import type { DebtInput, SubscriptionInput, TransactionInput } from "@/types/finance";

const NUM_RUNS = 300; // many mutation kinds, so more than the 100 minimum
const NOW = "2025-06-18";
const CTX: MutationContext = { now: NOW, newId: () => "generated-id" };
const WEEK_KEY = getPlanWeekStart(NOW);
const MISSING_WEEK_KEY = "1999-01-04";
const OPEN_DEBT_ID = "debt-open";
const PAID_DEBT_ID = "debt-paid";
const OPEN_BALANCE = 5000;
const SUB_ID = "sub-1";
const ACTION_ID = "action-1";
const MAX_DAYS_AHEAD = 4000;
const MAX_OVER_NAME = 200;

let counter = 0;

type Mutation = (db: CryptDb) => Promise<unknown>;
type InvalidCase = { label: string; run: Mutation; error: "validation" | "notFound" };

// ---- valid base inputs and invalid field generators ----

const validDebt: DebtInput = { name: "Card", balanceCents: 1000, apr: 0.2, minimumPaymentCents: 100 };
const validSub: SubscriptionInput = {
  name: "Stream",
  amountCents: 999,
  cadence: "monthly",
  usage: "never",
  active: true,
};
const validTx: TransactionInput = {
  amountCents: 500,
  description: "Coffee",
  category: "food",
  date: NOW,
};

const nonIntegerArb = fc
  .double({ min: 0.01, max: 1_000_000, noNaN: true })
  .filter((x) => !Number.isInteger(x));

/** Amounts that are never valid, even where 0 would be allowed. */
const badAmountArb: fc.Arbitrary<number> = fc.oneof(
  fc.constantFrom(Number.NaN, Infinity, -Infinity),
  nonIntegerArb,
  fc.integer({ min: -MAX_MONEY_CENTS, max: -1 }),
  fc.integer({ min: MAX_MONEY_CENTS + 1, max: MAX_MONEY_CENTS * 10 }),
);
/** Amounts that must be at least 1 cent: adds 0. */
const badPositiveAmountArb = fc.oneof(badAmountArb, fc.constant(0));

const badNameArb: fc.Arbitrary<string> = fc.oneof(
  fc.constantFrom("", " ", "   ", "\t\n"),
  fc
    .integer({ min: MAX_NAME_LENGTH + 1, max: MAX_OVER_NAME })
    .map((n) => "a".repeat(n)),
);

const badAprArb = fc.oneof(
  fc.double({ min: -1000, max: -Number.MIN_VALUE, noNaN: true }),
  fc.double({ min: 1 + Number.EPSILON, max: 1000, noNaN: true }).filter((x) => x > 1),
  fc.constantFrom(Number.NaN, Infinity, -Infinity),
);

const futureDateArb = fc
  .integer({ min: 1, max: MAX_DAYS_AHEAD })
  .map((days) => addDays(NOW, days));

const unknownIdArb = fc.uuid();

const badIncomeArb = fc.oneof(
  fc.integer({ min: -MAX_MONEY_CENTS, max: MIN_INCOME_CENTS_INPUT - 1 }),
  badAmountArb,
);

// ---- invalid mutation cases ----

const v = (label: string, run: Mutation): InvalidCase => ({ label, run, error: "validation" });
const n = (label: string, run: Mutation): InvalidCase => ({ label, run, error: "notFound" });

const invalidCaseArb: fc.Arbitrary<InvalidCase> = fc.oneof(
  badIncomeArb.map((c) => v("setMonthlyIncome", (db) => setMonthlyIncome(db, c))),
  badNameArb.map((name) => v("addDebt name", (db) => addDebt(db, { ...validDebt, name }, CTX))),
  badAprArb.map((apr) => v("addDebt apr", (db) => addDebt(db, { ...validDebt, apr }, CTX))),
  badAmountArb.map((c) =>
    v("addDebt balance", (db) => addDebt(db, { ...validDebt, balanceCents: c }, CTX)),
  ),
  badAmountArb.map((c) =>
    v("addDebt minimum", (db) => addDebt(db, { ...validDebt, minimumPaymentCents: c }, CTX)),
  ),
  fc
    .tuple(badNameArb, badAprArb)
    .map(([name, apr]) =>
      v("editDebt invalid", (db) => editDebt(db, OPEN_DEBT_ID, { ...validDebt, name, apr })),
    ),
  unknownIdArb.map((id) => n("editDebt unknown id", (db) => editDebt(db, id, validDebt))),
  badNameArb.map((name) =>
    v("addSubscription name", (db) => addSubscription(db, { ...validSub, name }, CTX)),
  ),
  badPositiveAmountArb.map((c) =>
    v("addSubscription amount", (db) =>
      addSubscription(db, { ...validSub, amountCents: c }, CTX),
    ),
  ),
  badPositiveAmountArb.map((c) =>
    v("editSubscription amount", (db) =>
      editSubscription(db, SUB_ID, { ...validSub, amountCents: c }),
    ),
  ),
  unknownIdArb.map((id) =>
    n("editSubscription unknown id", (db) => editSubscription(db, id, validSub)),
  ),
  badPositiveAmountArb.map((c) =>
    v("addTransaction amount", (db) =>
      addTransaction(db, { ...validTx, amountCents: c }, CTX),
    ),
  ),
  badNameArb.map((description) =>
    v("addTransaction description", (db) =>
      addTransaction(db, { ...validTx, description }, CTX),
    ),
  ),
  futureDateArb.map((date) =>
    v("addTransaction future date", (db) => addTransaction(db, { ...validTx, date }, CTX)),
  ),
  badPositiveAmountArb.map((c) =>
    v("logPayment bad amount", (db) => logPayment(db, OPEN_DEBT_ID, c, CTX)),
  ),
  fc
    .integer({ min: OPEN_BALANCE + 1, max: MAX_MONEY_CENTS })
    .map((c) => v("logPayment above balance", (db) => logPayment(db, OPEN_DEBT_ID, c, CTX))),
  fc
    .integer({ min: 1, max: MAX_MONEY_CENTS })
    .map((c) => v("logPayment on paid-off debt", (db) => logPayment(db, PAID_DEBT_ID, c, CTX))),
  fc
    .tuple(unknownIdArb, fc.integer({ min: 1, max: OPEN_BALANCE }))
    .map(([id, c]) => n("logPayment unknown id", (db) => logPayment(db, id, c, CTX))),
  unknownIdArb.map((id) => n("cancelSubscription unknown id", (db) => cancelSubscription(db, id, CTX))),
  unknownIdArb.map((id) => n("reactivateSubscription unknown id", (db) => reactivateSubscription(db, id, CTX))),
  fc.uuid().map((id) =>
    n("completePlanAction missing plan", (db) =>
      completePlanAction(db, MISSING_WEEK_KEY, id, CTX),
    ),
  ),
  fc.uuid().map((id) =>
    n("completePlanAction missing action", (db) => completePlanAction(db, WEEK_KEY, id, CTX)),
  ),
  fc.uuid().map((id) =>
    n("uncompletePlanAction missing plan", (db) =>
      uncompletePlanAction(db, MISSING_WEEK_KEY, id),
    ),
  ),
  fc.uuid().map((id) =>
    n("uncompletePlanAction missing action", (db) => uncompletePlanAction(db, WEEK_KEY, id)),
  ),
);

// ---- seeding and snapshots ----

async function seed(db: CryptDb): Promise<void> {
  await db.profile.put({ id: PROFILE_ID, monthlyIncomeCents: 400_000 });
  await db.debts.bulkAdd([
    { id: OPEN_DEBT_ID, name: "Open", balanceCents: OPEN_BALANCE, apr: 0.1, minimumPaymentCents: 100 },
    { id: PAID_DEBT_ID, name: "Paid", balanceCents: 0, apr: 0.1, minimumPaymentCents: 0 },
  ]);
  await db.subscriptions.add({
    id: SUB_ID,
    name: "Sub",
    amountCents: 1000,
    cadence: "monthly",
    usage: "rarely",
    active: true,
  });
  await db.transactions.add({
    id: "tx-1",
    amountCents: 300,
    description: "Tea",
    category: "food",
    date: NOW,
  });
  await db.events.add({ id: "ev-1", type: "debt_payment", date: NOW, extraPrincipalCents: 0 });
  await db.weeklyPlans.put({
    weekKey: WEEK_KEY,
    startLightScore: 40,
    generatedOn: NOW,
    actions: [
      {
        id: ACTION_ID,
        kind: "fallback",
        title: "Fallback",
        subtitle: "Do it",
        monthlyAmountCents: 0,
        priorityCents: 0,
        done: false,
      },
    ],
  });
}

async function snapshot(db: CryptDb): Promise<unknown[]> {
  return Promise.all(
    [db.profile, db.debts, db.subscriptions, db.transactions, db.events, db.weeklyPlans].map(
      (table) => table.toArray(),
    ),
  );
}

describe("Property 6: invalid mutation input is rejected and writes nothing", () => {
  // Feature: app-screens, Property 6: Invalid mutation input is rejected and writes nothing
  // **Validates: Requirements 4.9, 5.3, 5.4, 5.7, 5.8, 6.4, 6.5, 8.4, 9.1, 9.2, 9.5, 9.6**
  it("rejects with a validation or not-found error and leaves every table unchanged", async () => {
    await fc.assert(
      fc.asyncProperty(invalidCaseArb, async (invalid) => {
        const name = `test-${(counter += 1)}`;
        const db = openCrypt(name, { indexedDB: new IDBFactory(), IDBKeyRange });
        try {
          await seed(db);
          const before = await snapshot(db);

          const error = await invalid.run(db).then(
            () => null,
            (caught: unknown) => caught,
          );

          const expected = invalid.error === "validation" ? DbValidationError : DbNotFoundError;
          expect(error, invalid.label).toBeInstanceOf(expected);
          expect(await snapshot(db), invalid.label).toEqual(before);
        } finally {
          db.close();
          await db.delete();
        }
      }),
      { numRuns: NUM_RUNS },
    );
  });
});
