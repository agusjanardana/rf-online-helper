import type { Metadata } from "next";
import { MaterialConversionCalculator } from "@/src/components/conversion/material-conversion-calculator";

export const metadata: Metadata = {
  title: "Material Conversion Calculator | RF NEXT Helper",
  description: "Calculate official RF ONLINE NEXT Material Conversion points for 4–6 equipment pieces.",
};

export default function MaterialConversionPage() {
  return <div className="tool-page"><MaterialConversionCalculator /></div>;
}
