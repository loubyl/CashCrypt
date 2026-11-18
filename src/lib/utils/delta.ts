// Pure presentation mapping for balance deltas. Direction (sign/icon) and intent
// (tone) are independent: a decrease can be good and an increase can be bad.

export type DeltaDirection = "up" | "down";
export type DeltaIntent = "good" | "bad";
export type DeltaPresentation = {
  sign: "+" | "−";
  icon: "arrow-up" | "arrow-down";
  tone: "success" | "danger";
  text: string;
};

const SIGN_UP = "+";
const SIGN_DOWN = "−";

export function getDeltaPresentation(
  direction: DeltaDirection,
  intent: DeltaIntent,
  amountText: string,
): DeltaPresentation {
  const isUp = direction === "up";
  const sign = isUp ? SIGN_UP : SIGN_DOWN;
  return {
    sign,
    icon: isUp ? "arrow-up" : "arrow-down",
    tone: intent === "good" ? "success" : "danger",
    text: `${sign}${amountText}`,
  };
}
