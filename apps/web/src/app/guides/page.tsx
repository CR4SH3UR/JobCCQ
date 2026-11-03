import type { Metadata } from "next";
import Link from "next/link";
import { GUIDES } from "@/data/guides";
import { siteUrl } from "@/lib/site";

export const metadata: Metadata = {
  title: "Guides carrière construction — JobCCQc",
  description:
    "Guides et Q&R pour les métiers de la construction au Québec : devenir grutier, carte de compétence, ASP, taux CCQ 2026.",
  alternates: { canonical: siteUrl("/guides/") },
};

export default function GuidesIndexPage() {
  return (
    <div>
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-4xl px-4 py-6">
          <h1 className="text-2xl font-bold tracking-tight">Guides carrière</h1>
          <p className="mt-1 text-slate-600">
            Parcours, carte de compétence, ASP Construction et grilles salariales CCQ — pour
            s&apos;orienter avant de postuler.
          </p>
        </div>
      </div>
      <div className="mx-auto max-w-4xl px-4 py-6">
        <ul className="space-y-3">
          {GUIDES.map((g) => (
            <li key={g.slug}>
              <Link
                href={`/guides/${g.slug}/`}
                className="block rounded-lg border border-slate-200 bg-white px-4 py-3 hover:border-brand-300"
              >
                <span className="font-semibold text-slate-900 hover:text-brand-700">{g.title}</span>
                <span className="mt-1 block text-sm text-slate-600">{g.description}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
