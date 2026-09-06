import type { Metadata } from "next";
import Link from "next/link";
import { ContactEmailButton } from "@/components/ContactEmailButton";
import { SPONSOR_CONTACT_EMAIL, SPONSOR_PACKS } from "@/lib/sponsors";
import { siteUrl } from "@/lib/site";
import { cn } from "@/lib/format";

export const metadata: Metadata = {
  title: "Commanditer JobCCQc — offres et tarifs",
  description:
    "Trois packs de commandite pour rejoindre les chercheurs d'emploi de la construction au Québec : Argent, Or, et Bronze (offre épinglée 7 jours).",
  alternates: { canonical: siteUrl("/commandite/") },
};

const SUBJECT: Record<string, string> = {
  argent: "Commandite Argent — JobCCQc",
  or: "Commandite Or — JobCCQc",
  bronze: "Commandite Bronze (offre épinglée) — JobCCQc",
};

export default function CommanditePage() {
  const email = SPONSOR_CONTACT_EMAIL || "contact@jobccqc.ca";

  return (
    <div>
      <section className="relative overflow-hidden border-b border-slate-200 bg-gradient-to-b from-brand-50 to-white">
        <div
          aria-hidden
          className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-brand-400/20 blur-3xl"
        />
        <div className="relative mx-auto max-w-3xl px-4 py-14 text-center sm:py-16">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">Commandite</p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
            Devant les gens qui cherchent vraiment un chantier
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-slate-600">
            Placement natif, libellé <strong>Commandité</strong>, sans cookies pub. Trois packs, un
            courriel pour démarrer.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-10">
        <div className="grid gap-4 lg:grid-cols-3">
          {SPONSOR_PACKS.map((pack) => {
            const featured = pack.id === "or";
            return (
              <article
                key={pack.id}
                className={cn(
                  "card flex flex-col p-5",
                  featured && "ring-2 ring-amber-300 shadow-md",
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-500">
                    {pack.medal} {pack.name}
                  </p>
                  {featured && (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-amber-900">
                      Le plus choisi
                    </span>
                  )}
                </div>
                <p className="mt-2 text-2xl font-extrabold tracking-tight text-slate-900">
                  {pack.price}
                </p>
                <p className="mt-2 text-sm text-slate-600">{pack.blurb}</p>
                <ul className="mt-4 flex-1 space-y-1.5 text-sm text-slate-700">
                  {pack.includes.map((line) => (
                    <li key={line} className="flex gap-2">
                      <span aria-hidden className="text-brand-600">
                        ✓
                      </span>
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
                <ContactEmailButton
                  email={email}
                  subject={SUBJECT[pack.id]}
                  className={cn(
                    "mt-5 w-full rounded-lg px-4 py-2.5 text-sm font-semibold text-white",
                    featured ? "bg-amber-500 hover:bg-amber-600" : "bg-brand-600 hover:bg-brand-700",
                  )}
                >
                  Demander {pack.name}
                </ContactEmailButton>
              </article>
            );
          })}
        </div>

        <div className="mt-10 grid gap-6 md:grid-cols-2">
          <div className="card p-5">
            <h2 className="text-lg font-bold text-slate-900">Ce que vous achetez</h2>
            <ul className="mt-3 space-y-2 text-sm text-slate-600">
              <li>
                <strong className="text-slate-800">Argent</strong> — carte compacte sous la bannière
                vedette, accueil et <Link href="/emplois" className="text-brand-700 hover:underline">/emplois</Link>.
              </li>
              <li>
                <strong className="text-slate-800">Or</strong> — rotator en tête + vos offres déjà
                scrapées avec badge et carte « employeur en vedette ».
              </li>
              <li>
                <strong className="text-slate-800">Bronze</strong> — une offre précise collée en haut
                de la liste pendant 7 jours (2 max. à la fois), badge « Épinglée ».
              </li>
            </ul>
          </div>
          <div className="card p-5">
            <h2 className="text-lg font-bold text-slate-900">Règles du jeu</h2>
            <ul className="mt-3 space-y-2 text-sm text-slate-600">
              <li>Toujours identifié : Commandité / Épinglée. Pas de faux JobPosting.</li>
              <li>Pas de régie ouverte, pas de pistage inter-sites (Loi 25).</li>
              <li>Indépendant : pas de logo CCQ / RBQ — on ne vend pas l&apos;institution.</li>
              <li>
                Facture : impressions pages + clics « Postuler » sur vos offres, quand on les a.
              </li>
            </ul>
          </div>
        </div>

        <p className="mt-8 text-center text-sm text-slate-500">
          Une question avant d&apos;écrire ? Voir{" "}
          <Link href="/a-propos" className="text-brand-700 hover:underline">
            à propos
          </Link>{" "}
          et les{" "}
          <Link href="/conditions" className="text-brand-700 hover:underline">
            conditions
          </Link>
          .
        </p>
      </section>
    </div>
  );
}
