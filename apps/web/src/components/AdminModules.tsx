"use client";

import { useState } from "react";
import { AdminExplorer } from "@/components/AdminExplorer";
import { AdminRegions } from "@/components/AdminRegions";
import { AdminSponsors } from "@/components/AdminSponsors";
import { AdminUsers } from "@/components/AdminUsers";
import { AdminDashboard } from "@/components/AdminDashboard";
import { AdminJobs } from "@/components/AdminJobs";
import { AdminReports } from "@/components/AdminReports";

type AdminModuleKey = "overview" | "users" | "sources" | "jobs" | "reports" | "sponsors" | "regions";

const MODULES: Array<{
  key: AdminModuleKey;
  title: string;
  description: string;
  action: string;
}> = [
  {
    key: "overview",
    title: "Vue d'ensemble",
    description: "Chiffres, top sources, diffs de scrape.",
    action: "Ouvrir",
  },
  {
    key: "users",
    title: "Utilisateurs",
    description: "Comptes, invitations, export CSV.",
    action: "Gérer",
  },
  {
    key: "sources",
    title: "Sources / employeurs",
    description: "Employeurs, scraping, vérifications.",
    action: "Gérer",
  },
  {
    key: "jobs",
    title: "Offres",
    description: "Chercher, éditer, supprimer, exporter.",
    action: "Gérer",
  },
  {
    key: "reports",
    title: "Signalements",
    description: "Offres signalées, file de modération.",
    action: "Traiter",
  },
  {
    key: "sponsors",
    title: "Sponsors",
    description: "Commandites et employeurs en vedette.",
    action: "Gérer",
  },
  {
    key: "regions",
    title: "Régions & municipalités",
    description: "Associer une ville à sa région administrative.",
    action: "Gérer",
  },
];

export function AdminModules() {
  const [active, setActive] = useState<AdminModuleKey>("overview");

  return (
    <div className="admin-console mx-auto max-w-7xl px-4 py-6 text-slate-900 dark:text-slate-100">
      <header className="mb-5">
        <p className="text-xs font-bold uppercase text-brand-700 dark:text-brand-300">Panel admin</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950 dark:text-white">
          Centre de contrôle JobCCQc
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-600 dark:text-slate-300">
          Modules : tableau de bord, comptes, sources, offres, signalements, commandites et régions.
        </p>
      </header>

      <nav className="mb-5 grid gap-2 md:grid-cols-4" aria-label="Modules admin">
        {MODULES.map((module) => {
          const selected = active === module.key;
          return (
            <button
              key={module.key}
              type="button"
              onClick={() => setActive(module.key)}
              className={`rounded-lg border p-3 text-left transition ${
                selected
                  ? "border-brand-400 bg-brand-50 text-brand-950 shadow-sm dark:border-brand-400 dark:bg-brand-500/15 dark:text-white"
                  : "border-slate-200 bg-white text-slate-800 hover:border-brand-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:border-brand-500 dark:hover:bg-slate-800"
              }`}
            >
              <span className="block text-sm font-bold">{module.title}</span>
              <span className="mt-1 block text-xs text-slate-600 dark:text-slate-300">{module.description}</span>
            </button>
          );
        })}
      </nav>

      {active === "overview" ? <AdminDashboard /> : null}
      {active === "users" ? <AdminUsers /> : null}
      {active === "sources" ? <AdminExplorer /> : null}
      {active === "jobs" ? <AdminJobs /> : null}
      {active === "reports" ? <AdminReports /> : null}
      <div hidden={active !== "sponsors"}>
        <AdminSponsors />
      </div>
      {active === "regions" ? <AdminRegions /> : null}
    </div>
  );
}
