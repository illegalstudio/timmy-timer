import type { Metadata } from "next";
import TimmyTimer from "../tempo-app";

export const metadata: Metadata = {
  title: "Report | Timmy Timer",
  description: "Analizza ore e valori ed esporta i tuoi report.",
};

export default function ReportsPage() {
  return <TimmyTimer view="report" />;
}
