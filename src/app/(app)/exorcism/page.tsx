import type { Metadata } from "next";
import { ExorcismScreen } from "@/components/screens/ExorcismScreen";

export const metadata: Metadata = {
  title: "Exorcism · CashCrypt",
  description: "Your three actions for this week and the money they free.",
};

export default function ExorcismPage() {
  return <ExorcismScreen />;
}
