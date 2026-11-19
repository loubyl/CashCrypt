import type { Metadata } from "next";
import { SubscriptionsScreen } from "@/components/screens/SubscriptionsScreen";

export const metadata: Metadata = {
  title: "Subscriptions · CashCrypt",
  description: "Your zombies, the money they cost each month and the graveyard of canceled ones.",
};

export default function SubscriptionsPage() {
  return <SubscriptionsScreen />;
}
