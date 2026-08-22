import type { Metadata } from "next";
import { AdminExplorer } from "@/components/AdminExplorer";
import { AdminSponsors } from "@/components/AdminSponsors";
import { AdminGate } from "@/components/AdminGate";

export const metadata: Metadata = {
  title: "Administration — JobCCQ",
  description: "Console de gestion des employeurs : vérifier, corriger les URLs, relancer le scraping.",
};

export default function AdminPage() {
  return (
    <AdminGate>
      <AdminExplorer />
      <AdminSponsors />
    </AdminGate>
  );
}
