import { SPONSORS, SPONSOR_CONTACT_EMAIL } from "@/lib/sponsors";
import { initials } from "@/lib/format";

/**
 * Bannière de commandite. Affiche les commanditaires configurés, ou — s'il n'y
 * en a pas — un encart « Votre publicité ici » qui vend l'espace (inventaire).
 * La configuration s'édite dans la console d'administration (onglet Sponsors).
 */
export function SponsorBanner({ className = "" }: { className?: string }) {
  if (SPONSORS.length === 0) {
    if (!SPONSOR_CONTACT_EMAIL) return null;
    const subject = encodeURIComponent("Commandite JobCCQ");
    return (
      <a
        href={`mailto:${SPONSOR_CONTACT_EMAIL}?subject=${subject}`}
        className={`card group flex items-center justify-between gap-4 border-dashed p-4 text-sm transition-colors hover:border-brand-400 hover:bg-brand-50/40 ${className}`}
      >
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-brand-50 text-lg ring-1 ring-brand-100">
            📣
          </span>
          <div>
            <p className="font-semibold text-slate-800">Votre entreprise ici</p>
            <p className="text-slate-500">
              Rejoignez une audience de la construction au Québec — commanditez JobCCQ.
            </p>
          </div>
        </div>
        <span className="hidden shrink-0 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white transition-transform group-hover:scale-105 sm:inline">
          Devenir commanditaire
        </span>
      </a>
    );
  }

  return (
    <div className={`grid gap-2 ${SPONSORS.length > 1 ? "sm:grid-cols-2" : ""} ${className}`}>
      {SPONSORS.map((s) => (
        <a
          key={s.id}
          href={s.url}
          target="_blank"
          rel="sponsored noopener noreferrer"
          className="group relative overflow-hidden rounded-xl border border-amber-200 bg-gradient-to-br from-amber-50/60 to-white p-4 shadow-sm transition-shadow hover:shadow-md"
        >
          {/* Étiquette « Commandité » (coin) */}
          <span className="absolute right-0 top-0 rounded-bl-lg bg-amber-400/90 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-950">
            Commandité
          </span>
          <div className="flex min-w-0 items-center gap-3 pr-16">
            {s.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={s.logoUrl}
                alt={s.name}
                className="h-12 w-12 shrink-0 rounded-lg object-contain ring-1 ring-slate-200"
              />
            ) : (
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-brand-50 text-sm font-bold text-brand-700 ring-1 ring-brand-100">
                {initials(s.name)}
              </span>
            )}
            <div className="min-w-0">
              <p className="truncate font-semibold text-slate-900 group-hover:text-brand-700">{s.name}</p>
              <p className="line-clamp-2 text-sm text-slate-500">{s.tagline}</p>
            </div>
          </div>
        </a>
      ))}
    </div>
  );
}
