import Link from "next/link";
import { LEGAL } from "@/lib/legal";

/** Cadre commun des pages légales : titre, date de MAJ, prose et navigation. */
export function LegalShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <nav className="mb-4 text-sm text-slate-500">
        <Link href="/" className="hover:text-brand-700">
          Accueil
        </Link>
        <span className="text-slate-400"> › {title}</span>
      </nav>
      <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">{title}</h1>
      <p className="mt-2 text-sm text-slate-500">Dernière mise à jour : {LEGAL.lastUpdated}</p>
      <div className="legal-prose mt-6 space-y-4 text-slate-600">{children}</div>

      <div className="mt-10 flex flex-wrap gap-x-4 gap-y-1 border-t border-slate-200 pt-4 text-sm">
        <Link href="/a-propos" className="text-brand-600 hover:underline">
          À propos
        </Link>
        <Link href="/confidentialite" className="text-brand-600 hover:underline">
          Confidentialité
        </Link>
        <Link href="/conditions" className="text-brand-600 hover:underline">
          Conditions d'utilisation
        </Link>
      </div>
    </div>
  );
}
