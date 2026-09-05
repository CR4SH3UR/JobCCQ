import type { Metadata } from "next";
import { AdminGate } from "@/components/AdminGate";
import { AdminModules } from "@/components/AdminModules";

export const metadata: Metadata = {
  title: "Administration — JobCCQc",
  description: "Console de gestion des employeurs : vérifier, corriger les URLs, relancer le scraping.",
  robots: { index: false, follow: false },
};

export default function AdminPage() {
  return (
    <AdminGate>
      <AdminModules />
    </AdminGate>
  );
}
