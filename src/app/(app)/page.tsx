import type { Metadata } from "next";
import { HomeScreen } from "@/components/screens/HomeScreen";

export const metadata: Metadata = {
  title: "CashCrypt",
  description:
    "Your money habits haunt your house. Pay down the haunting, and the lights come back on.",
};

export default function Home() {
  return <HomeScreen />;
}
