import type { Metadata } from "next";
import TimmyTimer from "../tempo-app";

export const metadata: Metadata = {
  title: "Clients | Timmy Timer",
  description: "Manage clients, related projects, and hourly rates.",
};

export default function ClientsPage() {
  return <TimmyTimer view="clienti" />;
}
