import Link from "next/link";
import { LEGAL } from "@/lib/legal";

const adminEnabled = process.env.NEXT_PUBLIC_ENABLE_ADMIN === "1";

export function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto max-w-6xl px-4 py-8 text-sm text-slate-500">
        <p className="font-semibold text-slate-700">
          Job<span className="text-brand-600">CCQc</span>
        </p>
        <p className="mt-1 max-w-xl">
          Agrégateur d'offres d'emploi de la construction au Québec. Les offres proviennent de
          sources tierces et appartiennent à leurs éditeurs respectifs.
        </p>
        <p className="mt-2 max-w-xl text-xs text-slate-400">
          Service indépendant, non affilié à la Commission de la construction du Québec (CCQ) ni à la
          Régie du bâtiment du Québec (RBQ). Numéros RBQ indicatifs, dérivés de Données Québec.
        </p>

        <nav className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs font-medium text-slate-500">
          <Link href="/a-propos" className="hover:text-brand-600 hover:underline">
            À propos
          </Link>
          <Link href="/confidentialite" className="hover:text-brand-600 hover:underline">
            Confidentialité
          </Link>
          <Link href="/conditions" className="hover:text-brand-600 hover:underline">
            Conditions d'utilisation
          </Link>
          <Link href="/sources" className="hover:text-brand-600 hover:underline">
            Sources
          </Link>
          <a
            href={`mailto:${LEGAL.contactEmail}?subject=${encodeURIComponent("Retour — JobCCQc")}`}
            className="hover:text-brand-600 hover:underline"
          >
            Nous écrire
          </a>
          {adminEnabled && (
            <Link href="/admin" className="hover:text-brand-600 hover:underline">
              Admin
            </Link>
          )}
        </nav>

        <p className="mt-4 text-xs text-slate-400">© {year} JobCCQc</p>
      </div>
    </footer>
  );
}
