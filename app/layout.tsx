import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { LanguageProvider } from "@/src/components/i18n/language-provider";
import { Header } from "@/src/components/layout/header";
import { Footer } from "@/src/components/layout/footer";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "RF NEXT Helper - Diamond Tax & Material Conversion",
  description: "Unofficial RF ONLINE NEXT calculator for Diamond market tax and Material Conversion points.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body>
        <LanguageProvider>
          <div id="top" className="app-shell">
            <div className="ambient ambient-one" />
            <div className="ambient ambient-two" />
            <div className="page-frame">
              <Header />
              <main>{children}</main>
              <Footer />
            </div>
          </div>
        </LanguageProvider>
        <Analytics />
      </body>
    </html>
  );
}
