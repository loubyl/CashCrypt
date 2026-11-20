import type { Metadata } from "next";
import { TransactionsScreen } from "@/components/screens/TransactionsScreen";

export const metadata: Metadata = {
  title: "Transactions · CashCrypt",
  description: "Your recent expenses and the small ones that turn into ghosts.",
};

export default function TransactionsPage() {
  return <TransactionsScreen />;
}
