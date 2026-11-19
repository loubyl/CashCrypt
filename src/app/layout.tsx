import type { Metadata } from "next";
import { Cinzel, Inter, JetBrains_Mono, Manrope } from "next/font/google";
import { CryptProvider } from "@/hooks/useCrypt";
import { ToastRegion } from "@/components/ui/ToastRegion";
import "./globals.css";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  weight: ["700", "800"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

const cinzel = Cinzel({
  variable: "--font-cinzel",
  subsets: ["latin"],
  weight: "500",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: "400",
  display: "swap",
});

export const metadata: Metadata = {
  title: "CashCrypt",
  description:
    "A personal finance app where your money habits haunt your house.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${manrope.variable} ${inter.variable} ${cinzel.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      {/* A browser extension adds attributes to <body> before hydration (confirmed in incognito). */}
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <CryptProvider>
          <ToastRegion>{children}</ToastRegion>
        </CryptProvider>
      </body>
    </html>
  );
}
