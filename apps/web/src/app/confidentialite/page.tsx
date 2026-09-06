import type { Metadata } from "next";
import { ContactEmailButton } from "@/components/ContactEmailButton";
import { LegalShell } from "@/components/LegalShell";
import { LEGAL } from "@/lib/legal";

// ⚠️ Gabarit conforme à l'esprit de la Loi 25 (Québec) — à faire relire par un·e juriste.
export const metadata: Metadata = {
  title: "Politique de confidentialité — JobCCQc",
  description:
    "Comment JobCCQc recueille, utilise et protège vos renseignements personnels (Loi 25 — Québec).",
};

export default function ConfidentialitePage() {
  return (
    <LegalShell title="Politique de confidentialité">
      <p>
        La présente politique explique quels renseignements personnels {LEGAL.siteName} recueille,
        pourquoi, comment ils sont protégés et quels sont vos droits. Elle est rédigée dans le respect
        de la <strong>Loi sur la protection des renseignements personnels dans le secteur privé</strong>{" "}
        du Québec (dite « Loi 25 »).
      </p>

      <h2>Renseignements que nous recueillons</h2>
      <p>Nous limitons la collecte au strict nécessaire au fonctionnement du service :</p>
      <ul>
        <li>
          <strong>Adresse courriel</strong> — uniquement si vous créez un compte (connexion par lien
          magique, sans mot de passe) ou une alerte emploi.
        </li>
        <li>
          <strong>Favoris, profil et alertes</strong> — les offres que vous enregistrez, votre
          profil métier (métiers, régions, mobilité) et les critères de vos alertes, associés à
          votre compte pour suivre d'un appareil à l'autre.
        </li>
        <li>
          <strong>Préférences locales</strong> — thème (clair/sombre) et favoris hors connexion,
          stockés dans votre navigateur (<em>localStorage</em>). Un miroir des signalements déjà
          envoyés y figure aussi (l'envoi lui-même sert à la modération).
        </li>
      </ul>
      <p>
        Nous ne recueillons <strong>aucune donnée de paiement</strong>, aucun renseignement sensible,
        et nous n'utilisons pas de témoins (<em>cookies</em>) publicitaires ni de pistage
        inter-sites.
      </p>

      <h2>Finalités</h2>
      <ul>
        <li>Vous authentifier et synchroniser vos favoris, candidatures et profil entre vos appareils.</li>
        <li>Vous envoyer, si vous y consentez, des alertes courriel sur de nouvelles offres.</li>
        <li>Assurer la sécurité et le bon fonctionnement du service.</li>
        <li>Traiter les signalements d'offres (expirée, trompeuse, doublon) pour la modération.</li>
      </ul>

      <h2>Consentement</h2>
      <p>
        La collecte repose sur votre <strong>consentement</strong>, donné lorsque vous créez un compte
        ou une alerte. Vous pouvez le <strong>retirer en tout temps</strong> en supprimant votre
        compte ou vos alertes, ou en nous écrivant à{" "}
        <ContactEmailButton
          label={LEGAL.contactEmail}
          className="text-brand-600 underline underline-offset-2 hover:text-brand-700"
        />
        .
      </p>

      <h2>Hébergement et tiers (sous-traitants)</h2>
      <p>Nous faisons appel à des fournisseurs qui traitent des données pour notre compte :</p>
      <ul>
        <li>
          <strong>Supabase</strong> — authentification et base de données (favoris, profil,
          alertes, signalements).
        </li>
        <li>
          <strong>Resend</strong> — envoi des courriels d'alerte et de connexion.
        </li>
        <li>
          <strong>GitHub Pages</strong> — hébergement du site (contenu statique).
        </li>
      </ul>
      <p>
        Certains de ces fournisseurs peuvent traiter ou stocker des données{" "}
        <strong>à l'extérieur du Québec</strong>. Nous choisissons des prestataires reconnus offrant
        des garanties de protection appropriées. Aucune donnée personnelle n'est vendue ni louée.
      </p>

      <h2>Durée de conservation</h2>
      <p>
        Vos renseignements sont conservés tant que votre compte est actif. Sur demande de suppression,
        ou après une longue inactivité, ils sont détruits ou anonymisés.
      </p>

      <h2>Vos droits</h2>
      <p>Conformément à la Loi 25, vous pouvez :</p>
      <ul>
        <li>accéder à vos renseignements et en obtenir une copie ;</li>
        <li>les faire rectifier s'ils sont inexacts ;</li>
        <li>retirer votre consentement et demander leur suppression ;</li>
        <li>
          porter plainte auprès de la{" "}
          <a href="https://www.cai.gouv.qc.ca" target="_blank" rel="noopener noreferrer">
            Commission d'accès à l'information du Québec
          </a>
          .
        </li>
      </ul>

      <h2>Sécurité</h2>
      <p>
        Les accès sont protégés par des règles de sécurité au niveau des lignes (RLS) : chaque
        personne ne peut consulter que ses propres données. Les échanges se font en HTTPS.
      </p>

      <h2>Responsable de la protection des renseignements personnels</h2>
      <p>
        Pour toute question ou demande relative à vos renseignements personnels, écrivez à notre{" "}
        {LEGAL.privacyOfficer} :{" "}
        <ContactEmailButton
          label={LEGAL.contactEmail}
          className="text-brand-600 underline underline-offset-2 hover:text-brand-700"
        />
        .
      </p>

      <h2>Modifications</h2>
      <p>
        Cette politique peut être mise à jour ; la date de dernière mise à jour figure en haut de la
        page. En cas de changement important, nous en informerons les personnes concernées.
      </p>
    </LegalShell>
  );
}
