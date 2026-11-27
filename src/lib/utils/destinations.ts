/** Pure map of the lists a toast action can point to (Requirement 3). */

export type HighlightList = "debts" | "transactions" | "zombies" | "graveyard" | "plan";
export type HighlightTag = "new" | "updated";
export type HighlightTarget = { list: HighlightList; rowId: string; tag: HighlightTag };

export const DESTINATION_PATHS: Record<HighlightList, string> = {
  debts: "/debts",
  transactions: "/transactions",
  zombies: "/subscriptions",
  graveyard: "/subscriptions",
  plan: "/exorcism",
};

export const DESTINATION_LABELS: Record<HighlightList, string> = {
  debts: "Debts",
  transactions: "Transactions",
  zombies: "Subscriptions",
  graveyard: "Subscriptions",
  plan: "Exorcism",
};

export const HIGHLIGHT_TAG_TEXT: Record<HighlightTag, string> = {
  new: "New",
  updated: "Updated",
};

/** DOM id of a list row: `row-<list>-<rowId>`. */
export function getRowDomId(list: HighlightList, rowId: string): string {
  return `row-${list}-${rowId}`;
}

/** DOM id of a plan action's "Do it" button: `do-it-<actionId>`. */
export function getDoItDomId(actionId: string): string {
  return `do-it-${actionId}`;
}

export function getDestinationPath(list: HighlightList): string {
  return DESTINATION_PATHS[list];
}

export function getDestinationLabel(list: HighlightList): string {
  return DESTINATION_LABELS[list];
}

/** Accessible name of the toast "View" action, for example "View in Debts". */
export function getViewActionName(list: HighlightList): string {
  return `View in ${DESTINATION_LABELS[list]}`;
}
