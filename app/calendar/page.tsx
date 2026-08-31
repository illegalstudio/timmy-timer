import type { Metadata } from "next";
import TimmyTimer from "../tempo-app";

export const metadata: Metadata = {
  title: "Agenda | Timmy Timer",
  description: "Organizza e registra le attività della tua settimana.",
};

export default function CalendarPage() {
  return <TimmyTimer view="registro" />;
}
