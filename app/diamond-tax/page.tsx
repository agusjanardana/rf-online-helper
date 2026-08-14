import type { Metadata } from "next";
import { DiamondTaxCalculator } from "@/src/components/diamond/diamond-tax-calculator";

export const metadata: Metadata = {
  title: "Diamond Tax Calculator | RF NEXT Helper",
  description: "Calculate the 8% RF ONLINE NEXT market tax and your net Diamond amount.",
};

export default function DiamondTaxPage() {
  return <div className="tool-page"><DiamondTaxCalculator /></div>;
}
