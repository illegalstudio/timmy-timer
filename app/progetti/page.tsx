import type { Metadata } from "next";
import TimmyTimer from "../tempo-app";

export const metadata: Metadata = {
  title: "Progetti | Timmy Timer",
  description: "Organizza progetti, colori e tariffe dedicate.",
};

export default function ProjectsPage() {
  return <TimmyTimer view="progetti" />;
}
