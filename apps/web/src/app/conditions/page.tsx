import type { Metadata } from "next";
import { LegalShell } from "@/components/LegalShell";
import { LEGAL } from "@/lib/legal";

// ⚠️ Gabarit — à faire relire par un·e juriste avant un lancement public.
export const metadata: Metadata = {
  title: "Conditions d'utilisation — JobCCQc",
  description: "Conditions d'utilisation du service d'agrégation d'offres d'emploi JobCCQc.",
};

export default function ConditionsPage() {
  const mail = `mailto:${LEGAL.contactEmail}`;
  return (
    <LegalShell title="Conditions d'utilisation">
      <p>
        En utilisant {LEGAL.siteName}, vous acceptez les présentes conditions. Si vous ne les acceptez
        pas, veuillez ne pas utiliser le service.
      </p>

      <h2>1. Nature du service</h2>
      <p>
        {LEGAL.siteName} est un <strong>agrégateur</strong> qui recense des offres d'emploi de la
        construction au Québec publiées sur des sites tiers (sites d'entreprises, plateformes
        d'emploi). Chaque offre <strong>renvoie à sa source d'origine</strong>, où se fait la
        candidature. {LEGAL.siteName} n'est pas l'employeur et n'intervient pas dans le processus
        d'embauche.
      </p>

      <h2>2. Exactitude des informations</h2>
      <p>
        Les offres et renseignements proviennent de tiers et sont fournis{" "}
        <strong>« tels quels »</strong>, sans garantie d'exactitude, d'exhaustivité ou d'actualité.
        Une offre peut avoir été modifiée ou pourvue à la source. Les <strong>numéros de licence
        RBQ</strong> affichés sont <strong>indicatifs</strong> : dérivés par correspondance de noms à
        partir d'un registre public, ils peuvent comporter des erreurs et doivent être vérifiés auprès
        de la Régie du bâtiment du Québec.
      </p>

      <h2>3. Propriété intellectuelle</h2>
      <p>
        Les titres, descriptions et logos des offres appartiennent à leurs éditeurs respectifs. Les
        marques de commerce citées demeurent la propriété de leurs titulaires. {LEGAL.siteName} ne
        revendique aucun droit sur ces contenus.
      </p>

      <h2>4. Utilisation acceptable</h2>
      <ul>
        <li>Ne pas extraire massivement, copier ou revendre le contenu du site.</li>
        <li>Ne pas tenter de contourner la sécurité ni de perturber le service.</li>
        <li>Utiliser le service à des fins légales de recherche d'emploi ou de recrutement.</li>
      </ul>

      <h2>5. Comptes</h2>
      <p>
        Vous êtes responsable de l'usage de votre compte et de l'exactitude de l'adresse courriel
        fournie. Voir la{" "}
        <a href="/confidentialite">politique de confidentialité</a> pour le traitement de vos
        données.
      </p>

      <h2>6. Retrait de contenu</h2>
      <p>
        Vous êtes un employeur, un site source ou un titulaire de droits et souhaitez qu'une offre ou
        une fiche soit <strong>corrigée ou retirée</strong> ? Écrivez-nous à{" "}
        <a href={mail}>{LEGAL.contactEmail}</a> en précisant l'URL concernée ; nous traiterons la
        demande dans les meilleurs délais.
      </p>

      <h2>7. Non-affiliation</h2>
      <p>
        {LEGAL.siteName} est un service <strong>indépendant</strong>. Il n'est <strong>ni affilié,
        ni approuvé, ni commandité</strong> par la Commission de la construction du Québec (CCQ), la
        Régie du bâtiment du Québec (RBQ), ni aucun organisme gouvernemental.
      </p>

      <h2>8. Limitation de responsabilité</h2>
      <p>
        Dans les limites permises par la loi, {LEGAL.siteName} ne saurait être tenu responsable des
        dommages résultant de l'utilisation du service, d'une information inexacte ou de
        l'indisponibilité d'une offre.
      </p>

      <h2>9. Droit applicable</h2>
      <p>
        Les présentes conditions sont régies par les lois applicables dans la {LEGAL.jurisdiction}.
      </p>

      <h2>10. Modifications</h2>
      <p>
        Nous pouvons modifier ces conditions ; la date de mise à jour figure en haut de la page.
      </p>
    </LegalShell>
  );
}
