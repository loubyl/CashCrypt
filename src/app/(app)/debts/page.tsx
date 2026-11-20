import type { Metadata } from "next";
import { DebtsScreen } from "@/components/screens/DebtsScreen";

export const metadata: Metadata = {
  title: "Debts · CashCrypt",
  description: "Your debts, what you owe each month and the payments that bring the light back.",
};

export default function DebtsPage() {
  return <DebtsScreen />;
}
