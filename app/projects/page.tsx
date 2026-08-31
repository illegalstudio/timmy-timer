import type { Metadata } from "next";
import TimmyTimer from "../tempo-app";

export const metadata: Metadata = {
  title: "Projects | Timmy Timer",
  description: "Organize projects, colors, and dedicated hourly rates.",
};

export default function ProjectsPage() {
  return <TimmyTimer view="progetti" />;
}
