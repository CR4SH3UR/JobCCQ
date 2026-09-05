import Link from "next/link";
import { labelForRegion, type HiringCompany } from "@jobccq/shared";

export interface RelatedLink {
  href: string;
  label: string;
  count?: number;
}

/**
 * Classement « qui recrute » pré-généré (SSG) : employeurs triés par volume
 * d'offres, pour une région ou un métier.
 */
export function SeoRankingPage({
  title,
  intro,
  companies,
  exploreHref,
  relatedTitle,
  related,
}: {
  title: string;
  intro: string;
  companies: HiringCompany[];
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
            {companies.length} entreprise{companies.length > 1 ? "s" : ""} —{" "}
            <Link href={exploreHref} className="font-medium text-brand-700 hover:underline">
              affiner dans Qui recrute →
            </Link>
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-4 py-6">
        {companies.length === 0 ? (
          <p className="text-slate-600">Aucun employeur pour le moment. Revenez bientôt.</p>
        ) : (
          <ol className="space-y-2">
            {companies.map((c, i) => {
              const href = c.sources[0] ? `/entreprises/${c.sources[0]}/` : "/entreprises";
              const regions = c.regions
                .slice(0, 3)
                .map((r) => labelForRegion(r) ?? r)
                .filter(Boolean)
                .join(" · ");
              return (
                <li key={c.company} className="card flex items-baseline gap-3 p-3 sm:p-4">
                  <span className="w-8 shrink-0 text-right text-sm font-semibold text-slate-400">
                    {i + 1}.
                  </span>
                  <Link href={href} className="min-w-0 flex-1">
                    <span className="font-semibold text-slate-900 hover:text-brand-700">{c.company}</span>
                    {regions ? <span className="mt-0.5 block text-sm text-slate-600">{regions}</span> : null}
                  </Link>
                  <span className="shrink-0 text-sm text-brand-700">
                    {c.openings} poste{c.openings > 1 ? "s" : ""}
                  </span>
                </li>
              );
            })}
          </ol>
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
