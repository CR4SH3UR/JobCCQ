import Link from "next/link";
import { labelForRegion, type Job } from "@jobccq/shared";

export interface RelatedLink {
  href: string;
  label: string;
  count?: number;
}

/**
 * Page de résultats pré-générée (SSG) pour le SEO : rendu **serveur** (le
 * contenu est dans le HTML, indexable), sans interactivité. Liste les offres,
 * pointe vers l'explorateur complet (filtre pré-appliqué) et interconnecte les
 * pages sœurs (autres régions / métiers).
 */
export function SeoResultsPage({
  title,
  intro,
  jobs,
  exploreHref,
  relatedTitle,
  related,
}: {
  title: string;
  intro: string;
  jobs: Job[];
  exploreHref: string;
  relatedTitle: string;
  related: RelatedLink[];
}) {
  return (
    <div>
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-4xl px-4 py-6">
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          <p className="mt-1 text-slate-600">{intro}</p>
          <p className="mt-3 text-sm text-slate-500">
            {jobs.length} offre{jobs.length > 1 ? "s" : ""} —{" "}
            <Link href={exploreHref} className="font-medium text-brand-700 hover:underline">
              affiner dans la recherche →
            </Link>
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-4 py-6">
        {jobs.length === 0 ? (
          <p className="text-slate-600">Aucune offre pour le moment. Revenez bientôt.</p>
        ) : (
          <ul className="space-y-2">
            {jobs.map((j) => {
              const region = labelForRegion(j.regionId);
              const place = [j.city, region].filter(Boolean).join(" · ");
              return (
                <li key={j.id} className="card p-3 sm:p-4">
                  <Link href={`/emplois/${j.id}/`} className="block">
                    <span className="font-semibold text-slate-900 hover:text-brand-700">{j.title}</span>
                    <span className="mt-0.5 block text-sm text-slate-600">
                      {j.company}
                      {place ? ` — ${place}` : ""}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}

        {related.length > 0 && (
          <nav className="mt-8 border-t border-slate-200 pt-5">
            <h2 className="text-sm font-semibold text-slate-700">{relatedTitle}</h2>
            <ul className="mt-2 flex flex-wrap gap-2">
              {related.map((r) => (
                <li key={r.href}>
                  <Link
                    href={r.href}
                    className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1 text-sm text-slate-700 hover:border-brand-300 hover:text-brand-700"
                  >
                    {r.label}
                    {r.count != null && <span className="text-xs text-slate-400">({r.count})</span>}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        )}
      </div>
    </div>
  );
}
