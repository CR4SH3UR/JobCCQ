/**
 * Guides carrière / Q&R SEO evergreen (#98–99).
 * Contenu éditorial stable : parcours métier, carte de compétence, grilles CCQ.
 */

export interface GuideSection {
  readonly heading: string;
  readonly paragraphs: readonly string[];
  readonly bullets?: readonly string[];
}

export interface Guide {
  readonly slug: string;
  readonly title: string;
  readonly description: string;
  readonly updatedAt: string;
  readonly sections: readonly GuideSection[];
  /** Liens utiles vers le site (recherche, salaire…). */
  readonly related?: readonly { href: string; label: string }[];
}

export const GUIDES: readonly Guide[] = [
  {
    slug: "devenir-grutier-quebec",
    title: "Comment devenir grutier au Québec",
    description:
      "Parcours pour devenir grutier au Québec : formation, carte de compétence CCQ, ASP Construction, stages et salaires.",
    updatedAt: "2026-04-26",
    related: [
      { href: "/emplois/metier/grutier/", label: "Offres de grutier" },
      { href: "/salaire/grutier/", label: "Salaire grutier" },
      { href: "/guides/carte-competence-asp/", label: "Carte de compétence + ASP" },
    ],
    sections: [
      {
        heading: "Le métier en bref",
        paragraphs: [
          "Le grutier (opérateur de grue) manœuvre les grues à tour, mobiles ou sur chenilles sur les chantiers de construction. Au Québec, c'est un métier reconnu par la Commission de la construction du Québec (CCQ), encadré par les conventions collectives de l'industrie.",
          "La demande reste forte sur les projets institutionnels, commerciaux et industriels, surtout en région métropolitaine et sur les grands chantiers du Nord.",
        ],
      },
      {
        heading: "Parcours type",
        paragraphs: [
          "Il n'existe pas qu'une seule porte d'entrée, mais le chemin le plus courant combine formation professionnelle, attestation de santé-sécurité et accès à la carte de compétence :",
        ],
        bullets: [
          "Obtenir l'ASP Construction (cours Santé et sécurité sur les chantiers de construction) — obligatoire pour accéder au chantier.",
          "Suivre une formation reconnue (DEP ou attestation en conduite de grues / formation d'opérateur) ou entrer via un employeur qui sponsorise l'apprentissage.",
          "S'inscrire auprès de la CCQ et obtenir une carte de compétence (apprenti puis compagnon selon l'expérience et les heures).",
          "Accumuler les heures de métier sous supervision, puis viser le statut de compagnon.",
        ],
      },
      {
        heading: "Carte de compétence et ASP",
        paragraphs: [
          "Sans ASP Construction et sans carte (ou billet de dispense selon le cas), un entrepreneur ne peut généralement pas vous affecter légalement sur un chantier CCQ. Ces deux pièces sont le sésame du métier — voir notre guide dédié.",
          "Les exigences exactes (nombre d'heures, examens, équivalences hors Québec) évoluent : consultez toujours le site de la CCQ et votre association patronale/syndicale.",
        ],
      },
      {
        heading: "Salaire",
        paragraphs: [
          "Le taux compagnon grutier sur la grille institutionnelle et commerciale CCQ se situe autour de 50 $/h (en vigueur le 26 avril 2026, secteur ICI). Les primes de chantier, de région éloignée ou d'équipement spécialisé s'ajoutent souvent.",
          "Comparez les offres agrégées sur JobCCQc pour voir ce que les employeurs affichent réellement en ce moment.",
        ],
      },
    ],
  },
  {
    slug: "carte-competence-asp",
    title: "Carte de compétence CCQ et ASP Construction",
    description:
      "Tout comprendre sur la carte de compétence CCQ et l'ASP Construction : à quoi ça sert, comment les obtenir, et pourquoi les employeurs les exigent.",
    updatedAt: "2026-04-26",
    related: [
      { href: "/guides/devenir-grutier-quebec/", label: "Devenir grutier" },
      { href: "/emplois/?ccqOnly=1", label: "Offres métiers CCQ" },
      { href: "/salaire/", label: "Guide salarial" },
    ],
    sections: [
      {
        heading: "Pourquoi ces deux documents ?",
        paragraphs: [
          "Sur les chantiers régis par la Loi sur les relations du travail, la formation professionnelle et la gestion de la main-d'œuvre dans l'industrie de la construction, la CCQ gère l'accès aux métiers. La carte de compétence atteste votre métier et votre niveau (apprenti, compagnon…). L'ASP Construction prouve que vous avez suivi la formation de base en santé-sécurité.",
          "La plupart des offres de métiers de chantier sur JobCCQc mentionnent explicitement « carte de compétence » et/ou « ASP Construction » dans les exigences.",
        ],
      },
      {
        heading: "ASP Construction",
        paragraphs: [
          "L'ASP (cours de 30 heures, parfois appelé CSTS hors Québec) est souvent le premier jalon. Elle est offerte par divers organismes reconnus. Gardez votre attestation : les employeurs et la CCQ peuvent la demander.",
        ],
        bullets: [
          "Durée typique : 30 heures.",
          "Préalable fréquent à l'émission ou au renouvellement de la carte.",
          "Valable pour l'ensemble des métiers de la construction une fois obtenue.",
        ],
      },
      {
        heading: "Carte de compétence",
        paragraphs: [
          "La carte est délivrée selon le métier, le bassin et votre parcours (diplôme, heures d'apprentissage, examens). Un apprenti et un compagnon n'ont pas les mêmes droits ni le même taux salarial.",
          "Si vous arrivez d'une autre province ou d'un autre pays, des équivalences existent — démarrez par le carrefour construction de la CCQ plutôt que par une candidature à l'aveugle.",
        ],
      },
      {
        heading: "Côté employeur",
        paragraphs: [
          "Embaucher sans la couverture requise expose l'entrepreneur à des sanctions. C'est pourquoi les portails carrières insistent sur ces prérequis : ce n'est pas du jargon RH, c'est une obligation réglementaire.",
        ],
      },
    ],
  },
  {
    slug: "taux-compagnon-electricien-2026",
    title: "Taux compagnon électricien 2026 (grille CCQ)",
    description:
      "Taux horaire compagnon électricien au Québec en 2026 selon la grille CCQ (secteur institutionnel et commercial), et comment le comparer aux offres.",
    updatedAt: "2026-04-26",
    related: [
      { href: "/salaire/electricien/", label: "Salaire électricien (observé)" },
      { href: "/emplois/metier/electricien/", label: "Offres d'électricien" },
      { href: "/guides/carte-competence-asp/", label: "Carte de compétence + ASP" },
    ],
    sections: [
      {
        heading: "Le chiffre clé",
        paragraphs: [
          "Au 26 avril 2026, le taux compagnon électricien sur la grille institutionnelle et commerciale (ICI) de la CCQ est de 50,79 $ / h. Ce montant exclut certaines annexes (Baie-James, résidentiel, primes de disponibilité, etc.).",
          "Source publique : conventions collectives 2025-2029 / publications SQI et CCQ. Ce n'est pas un bulletin de paie personnalisé — vérifiez toujours votre annexe et votre région.",
        ],
      },
      {
        heading: "Apprenti vs compagnon",
        paragraphs: [
          "Les apprentis sont rémunérés à un pourcentage du taux compagnon selon la période d'apprentissage. Atteindre le statut de compagnon change donc nettement le salaire de base, en plus d'élargir les tâches autorisées.",
        ],
      },
      {
        heading: "Comparer aux offres du marché",
        paragraphs: [
          "Sur JobCCQc, certaines offres affichent un montant explicite ; d'autres indiquent « selon les taux de la CCQ ». Dans ce second cas, nous rattachons le taux compagnon du métier quand il est connu, pour que vous puissiez comparer.",
          "La médiane observée sur les offres agrégées peut différer de la grille (primes, travail hors convention, postes hybrides bureau/chantier).",
        ],
      },
      {
        heading: "Autres métiers à surveiller",
        paragraphs: [
          "Les grutiers, tuyauteurs, frigoristes et plusieurs métiers ICI partagent des taux proches de la cinquantaine de dollars de l'heure en 2026. Consultez le guide salarial par métier pour la grille complète et les médianes observées.",
        ],
      },
    ],
  },
];

const BY_SLUG = new Map(GUIDES.map((g) => [g.slug, g]));

export function guideBySlug(slug: string): Guide | undefined {
  return BY_SLUG.get(slug);
}
