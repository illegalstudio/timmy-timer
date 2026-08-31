import type { Metadata } from "next";
import TimmyTimer from "../tempo-app";

export const metadata: Metadata = {
  title: "Reports | Timmy Timer",
  description: "Analyze hours and value, then export your reports.",
};

export default function ReportsPage() {
  return <TimmyTimer view="report" />;
}
