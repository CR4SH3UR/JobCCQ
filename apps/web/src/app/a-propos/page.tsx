import type { Metadata } from "next";
import { ContactEmailButton } from "@/components/ContactEmailButton";
import { LegalShell } from "@/components/LegalShell";
import { LEGAL } from "@/lib/legal";

export const metadata: Metadata = {
  title: "À propos — JobCCQc",
  description:
    "JobCCQc, agrégateur indépendant d'offres d'emploi de la construction au Québec. Sources, données et contact.",
};

export default function AProposPage() {
  return (
    <LegalShell title="À propos">
      <p>
        <strong>{LEGAL.siteName}</strong> rassemble en un seul endroit les offres d'emploi de la
        construction et des métiers au Québec, publiées par des centaines d'entreprises et de
        plateformes. Notre but : vous aider à voir <strong>qui recrute</strong>, pour quels postes et
        dans quelle région, puis à postuler <strong>directement à la source</strong>.
      </p>

      <h2>Service indépendant</h2>
      <p>
        {LEGAL.siteName} est un projet <strong>indépendant</strong>. Il n'est <strong>ni affilié, ni
        approuvé, ni commandité</strong> par la Commission de la construction du Québec (CCQ), la
        Régie du bâtiment du Québec (RBQ), ni aucun organisme gouvernemental. Les noms et marques
        cités appartiennent à leurs titulaires respectifs.
      </p>

      <h2>D'où viennent les données</h2>
      <ul>
        <li>
          <strong>Offres d'emploi</strong> — recensées à partir des sites d'entreprises et de
          plateformes d'emploi ; chaque offre renvoie à sa source d'origine.
        </li>
        <li>
          <strong>Numéros de licence RBQ et régions</strong> — dérivés de la{" "}
          <a
            href="https://www.donneesquebec.ca/recherche/dataset/liste-des-licences-actives-de-la-rbq"
            target="_blank"
            rel="noopener noreferrer"
          >
            Liste des licences actives de la RBQ
          </a>{" "}
          diffusée sur Données Québec, sous{" "}
          <a href="https://www.donneesquebec.ca/fr/licence/" target="_blank" rel="noopener noreferrer">
            licence ouverte
          </a>
          . Ils sont fournis à titre <strong>indicatif</strong> et peuvent comporter des erreurs
          d'appariement.
        </li>
      </ul>

      <h2>Signaler une erreur ou demander un retrait</h2>
      <p>
        Sur chaque fiche d'offre, le bouton <strong>Signaler</strong> permet d'indiquer qu'une offre
        est expirée, trompeuse ou en doublon — la file arrive dans la console d'administration. Vous
        pouvez aussi nous écrire à{" "}
        <ContactEmailButton
          label={LEGAL.contactEmail}
          className="text-brand-600 underline underline-offset-2 hover:text-brand-700"
        />{" "}
        pour une correction ou un retrait.
      </p>

      <h2>En savoir plus</h2>
      <p>
        Consultez notre <a href="/confidentialite">politique de confidentialité</a>, nos{" "}
        <a href="/conditions">conditions d'utilisation</a> et la page{" "}
        <a href="/commandite">commandite</a> (placements identifiés, sans cookies publicitaires).
      </p>
    </LegalShell>
  );
}
