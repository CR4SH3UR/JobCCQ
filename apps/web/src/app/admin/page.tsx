import type { Metadata } from "next";
import { AdminExplorer } from "@/components/AdminExplorer";
import { AdminGate } from "@/components/AdminGate";
import { AdminSponsors } from "@/components/AdminSponsors";
import { AdminUsers } from "@/components/AdminUsers";

export const metadata: Metadata = {
  title: "Administration — JobCCQc",
  description: "Console de gestion des employeurs : vérifier, corriger les URLs, relancer le scraping.",
  robots: { index: false, follow: false },
};

export default function AdminPage() {
  return (
    <AdminGate>
      <AdminUsers />
      <AdminExplorer />
      <AdminSponsors />
    </AdminGate>
  );
}
