"use client";

import Link from "next/link";
import type { Job } from "@jobccq/shared";
import { JobCard } from "./JobCard";

/** Grille « Pour toi » (accueil, favoris) — recommandations ou profil. */
export function ForYouSection({
  jobs,
  title = "Pour toi",
  subtitle,
  href,
  reasonsById,
  embedded = false,
}: {
  jobs: Job[];
  title?: string;
  subtitle?: string;
  href?: string;
  reasonsById?: Map<string, string[]>;
  /** Sans marges de page (favoris / espace compte). */
  embedded?: boolean;
}) {
  if (jobs.length === 0) return null;
  return (
    <section className={embedded ? "mt-8" : "mx-auto max-w-6xl px-4 pb-4"}>
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight">{title}</h2>
          {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
        </div>
        {href && (
          <Link href={href} className="shrink-0 text-sm font-semibold text-brand-600 hover:underline">
            Voir toutes →
          </Link>
        )}
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {jobs.map((job) => {
          const reasons = reasonsById?.get(job.id) ?? [];
          return (
            <div key={job.id}>
              <JobCard job={job} />
              {reasons.length > 0 && (
                <p className="mt-1 px-1 text-xs text-slate-500">
                  Parce que tu as déjà regardé : {reasons.join(" · ")}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
