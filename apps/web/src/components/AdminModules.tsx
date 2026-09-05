"use client";

import { useState } from "react";
import { AdminExplorer } from "@/components/AdminExplorer";
import { AdminSponsors } from "@/components/AdminSponsors";
import { AdminUsers } from "@/components/AdminUsers";

type AdminModuleKey = "overview" | "users" | "sources" | "sponsors";

const MODULES: Array<{
  key: AdminModuleKey;
  title: string;
  description: string;
  action: string;
}> = [
  {
    key: "overview",
    title: "Vue d'ensemble",
    description: "Accès rapide aux outils utiles.",
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
    key: "sponsors",
    title: "Sponsors",
    description: "Commandites et employeurs en vedette.",
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
          Modules séparés pour accéder vite aux comptes, sources, scraping et commandites.
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

      {active === "overview" ? <AdminOverview onOpen={setActive} /> : null}
      {active === "users" ? <AdminUsers /> : null}
      {active === "sources" ? <AdminExplorer /> : null}
      {active === "sponsors" ? <AdminSponsors /> : null}
    </div>
  );
}

function AdminOverview({ onOpen }: { onOpen: (module: AdminModuleKey) => void }) {
  return (
    <section className="grid gap-3 md:grid-cols-3">
      {MODULES.filter((module) => module.key !== "overview").map((module) => (
        <article key={module.key} className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
          <h2 className="text-base font-bold text-slate-950 dark:text-white">{module.title}</h2>
          <p className="mt-1 min-h-10 text-sm text-slate-600 dark:text-slate-300">{module.description}</p>
          <button
            type="button"
            onClick={() => onOpen(module.key)}
            className="mt-4 rounded-lg bg-brand-600 px-3 py-2 text-xs font-bold text-white hover:bg-brand-700 dark:bg-brand-400 dark:text-slate-950 dark:hover:bg-brand-300"
          >
            {module.action}
          </button>
        </article>
      ))}
    </section>
  );
}
