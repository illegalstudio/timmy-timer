import type { Metadata } from "next";
import TimmyTimer from "../tempo-app";

export const metadata: Metadata = {
  title: "Calendar | Timmy Timer",
  description: "Organize and track the activities in your week.",
};

export default function CalendarPage() {
  return <TimmyTimer view="registro" />;
}
