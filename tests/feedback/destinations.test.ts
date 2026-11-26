import { describe, expect, it } from "vitest";
import {
  DESTINATION_LABELS,
  DESTINATION_PATHS,
  HIGHLIGHT_TAG_TEXT,
  getDestinationLabel,
  getDestinationPath,
  getRowDomId,
  getViewActionName,
  type HighlightList,
} from "@/lib/utils/destinations";

const LISTS: HighlightList[] = ["debts", "transactions", "zombies", "graveyard", "plan"];

describe("destinations", () => {
  it("maps every list to its path", () => {
    expect(DESTINATION_PATHS).toEqual({
      debts: "/debts",
      transactions: "/transactions",
      zombies: "/subscriptions",
      graveyard: "/subscriptions",
      plan: "/exorcism",
    });
    expect(LISTS.map(getDestinationPath)).toEqual(LISTS.map((l) => DESTINATION_PATHS[l]));
  });

  it("maps every list to its label", () => {
    expect(DESTINATION_LABELS).toEqual({
      debts: "Debts",
      transactions: "Transactions",
      zombies: "Subscriptions",
      graveyard: "Subscriptions",
      plan: "Exorcism",
    });
    expect(LISTS.map(getDestinationLabel)).toEqual(LISTS.map((l) => DESTINATION_LABELS[l]));
  });

  it("builds row DOM ids as row-<list>-<rowId>", () => {
    expect(LISTS.map((l) => getRowDomId(l, "abc"))).toEqual([
      "row-debts-abc",
      "row-transactions-abc",
      "row-zombies-abc",
      "row-graveyard-abc",
      "row-plan-abc",
    ]);
  });

  it("gives distinct DOM ids to the same row id in different lists", () => {
    expect(new Set(LISTS.map((l) => getRowDomId(l, "1"))).size).toBe(LISTS.length);
  });

  it("names the View action after the destination", () => {
    expect(LISTS.map(getViewActionName)).toEqual([
      "View in Debts",
      "View in Transactions",
      "View in Subscriptions",
      "View in Subscriptions",
      "View in Exorcism",
    ]);
  });

  it("has visible text for both highlight tags", () => {
    expect(HIGHLIGHT_TAG_TEXT).toEqual({ new: "New", updated: "Updated" });
  });
});
