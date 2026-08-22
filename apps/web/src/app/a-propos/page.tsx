import type { Metadata } from "next";
import { LegalShell } from "@/components/LegalShell";
import { LEGAL } from "@/lib/legal";

export const metadata: Metadata = {
  title: "À propos — JobCCQ",
  description:
    "JobCCQ, agrégateur indépendant d'offres d'emploi de la construction au Québec. Sources, données et contact.",
};

export default function AProposPage() {
  const mail = `mailto:${LEGAL.contactEmail}`;
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
        Une information est inexacte, ou vous souhaitez qu'une offre ou une fiche soit corrigée ou
        retirée ? Écrivez-nous à <a href={mail}>{LEGAL.contactEmail}</a> — nous traiterons votre
        demande rapidement.
      </p>

      <h2>En savoir plus</h2>
      <p>
        Consultez notre <a href="/confidentialite">politique de confidentialité</a> et nos{" "}
        <a href="/conditions">conditions d'utilisation</a>.
      </p>
    </LegalShell>
  );
}
