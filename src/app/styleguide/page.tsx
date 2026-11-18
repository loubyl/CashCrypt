import type { Metadata } from "next";
import { StyleguideContent } from "@/components/styleguide/StyleguideContent";

export const metadata: Metadata = {
  title: "Styleguide",
  robots: { index: false, follow: false },
};

export default function StyleguidePage() {
  return <StyleguideContent />;
}
