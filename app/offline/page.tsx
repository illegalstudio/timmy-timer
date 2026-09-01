import type { Metadata } from "next";
import { OfflineScreen } from "../components/offline-screen";

export const metadata: Metadata = {
  title: "Offline | Timmy Timer",
  description: "Reconnect to continue using Timmy Timer.",
};

export default function OfflinePage() {
  return <OfflineScreen />;
}
