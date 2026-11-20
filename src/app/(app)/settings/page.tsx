import type { Metadata } from "next";
import { SettingsScreen } from "@/components/screens/SettingsScreen";

export const metadata: Metadata = {
  title: "Settings · CashCrypt",
  description: "Your monthly income, which crypt you see and your data.",
};

export default function SettingsPage() {
  return <SettingsScreen />;
}
