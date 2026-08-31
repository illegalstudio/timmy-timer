import type { Metadata } from "next";
import TimmyTimer from "../tempo-app";

export const metadata: Metadata = {
  title: "Clienti | Timmy Timer",
  description: "Gestisci clienti, progetti collegati e tariffe.",
};

export default function ClientsPage() {
  return <TimmyTimer view="clienti" />;
}
