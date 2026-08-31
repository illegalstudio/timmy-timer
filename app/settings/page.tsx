import type { Metadata } from "next";
import TimmyTimer from "../tempo-app";

export const metadata: Metadata = {
  title: "Settings | Timmy Timer",
  description: "Choose your Timmy Timer language and preferences.",
};

export default function SettingsPage() {
  return <TimmyTimer view="settings" />;
}
