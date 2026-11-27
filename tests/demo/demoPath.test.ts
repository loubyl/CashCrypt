// The level-4 demo path keeps its light scores after the fallback rule (action-feedback Requirement 17.7):
// cancel Wraithcast, tick the Coffee action, pay $300 extra on Scarlet Moth Card.
import { IDBFactory, IDBKeyRange } from "fake-indexeddb";
import { describe, expect, it } from "vitest";
import { openCrypt } from "@/lib/db/crypt";
import { cancelSubscription, completePlanAction, logPayment } from "@/lib/db/mutations";
import { readHouseReading } from "@/lib/db/queries";
import { DEMO_DB_NAME } from "@/lib/db/schema";
import { loadScenario } from "@/lib/demo/service";

const NOW = "2025-06-02";
const EXTRA_PAYMENT_CENTS = 30_000;
const DECIMALS = 2;

describe("level-4 demo path", () => {
  it("reads 32.74, 37.95, 38.95 and 43.49 after each real action", async () => {
    const db = openCrypt(DEMO_DB_NAME, { indexedDB: new IDBFactory(), IDBKeyRange });
    try {
      await loadScenario(db, "level-4", NOW);
      let next = 0;
      const ctx = { now: NOW, newId: () => `path-${(next += 1)}` };
      const light = async (): Promise<number> => Number((await readHouseReading(db, NOW)).lightScore.toFixed(DECIMALS));
      const scores = [await light()];
      await cancelSubscription(db, "demo:level-4:sub:wraithcast", ctx);
      scores.push(await light());
      await completePlanAction(db, NOW, "reduce:Coffee", ctx);
      scores.push(await light());
      const card = (await db.debts.toArray()).find((debt) => debt.name === "Scarlet Moth Card")!;
      await logPayment(db, card.id, card.minimumPaymentCents + EXTRA_PAYMENT_CENTS, ctx);
      scores.push(await light());
      expect(scores).toEqual([32.74, 37.95, 38.95, 43.49]);
    } finally {
      await db.delete();
    }
  });
});
