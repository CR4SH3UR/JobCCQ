/**
 * Données structurées schema.org (JSON-LD).
 *
 * `JobPosting` rend chaque offre éligible à l'affichage enrichi de Google et à
 * Google for Jobs ; `Organization` décrit l'employeur. Les URL sont absolues
 * (exigence de Google). Voir https://developers.google.com/search/docs/appearance/structured-data/job-posting
 */
import { getEmployer, labelForRegion, type Job } from "@jobccq/shared";
import { siteUrl } from "./site";

/** Type de poste interne → énuméré schema.org. */
const EMPLOYMENT_TYPE_LD: Record<string, string> = {
  "temps-plein": "FULL_TIME",
  "temps-partiel": "PART_TIME",
  contrat: "CONTRACTOR",
  stage: "INTERN",
  saisonnier: "TEMPORARY",
  occasionnel: "PER_DIEM",
};

const SALARY_UNIT_LD: Record<string, string> = {
  heure: "HOUR",
  semaine: "WEEK",
  mois: "MONTH",
  annee: "YEAR",
};

/** Ajoute N jours à une date ISO et renvoie une date ISO (pour validThrough). */
function addDays(iso: string, days: number): string | undefined {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return undefined;
  return new Date(t + days * 86_400_000).toISOString();
}

/** Description HTML pour l'offre : la vraie si disponible, sinon un résumé. */
export function jobDescriptionHtml(job: Job): string {
  if (job.description && job.description.trim().length > 0) {
    return `<p>${escapeHtml(job.description.trim())}</p>`;
  }
  const region = labelForRegion(job.regionId);
  const where = region ? ` dans la région ${region}` : " au Québec";
  return `<p>${escapeHtml(job.title)} chez ${escapeHtml(job.company)}${where}. Consultez les détails et postulez directement à la source.</p>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Objet JSON-LD `JobPosting` pour une offre. */
export function jobPostingLd(job: Job): Record<string, unknown> {
  const employer = getEmployer(job.sourceId);
  const datePosted = (job.postedAt ?? job.scrapedAt).slice(0, 10);
  const region = labelForRegion(job.regionId);

  const ld: Record<string, unknown> = {
    "@context": "https://schema.org/",
    "@type": "JobPosting",
    title: job.title,
    description: jobDescriptionHtml(job),
    datePosted,
    hiringOrganization: {
      "@type": "Organization",
      name: job.company,
      ...(employer?.homepage ? { sameAs: employer.homepage } : {}),
    },
    identifier: {
      "@type": "PropertyValue",
      name: job.company,
      value: job.id,
    },
    url: siteUrl(`/emplois/${job.id}/`),
  };

  const validThrough = addDays(job.postedAt ?? job.scrapedAt, 60);
  if (validThrough) ld.validThrough = validThrough;

  const et = job.employmentType && EMPLOYMENT_TYPE_LD[job.employmentType];
  if (et) ld.employmentType = et;

  // Lieu : télétravail explicite → TELECOMMUTE ; sinon région administrative.
  if (job.remote === "teletravail") {
    ld.jobLocationType = "TELECOMMUTE";
    ld.applicantLocationRequirements = { "@type": "Country", name: "Canada" };
  } else {
    ld.jobLocation = {
      "@type": "Place",
      address: {
        "@type": "PostalAddress",
        ...(job.city ? { addressLocality: job.city } : {}),
        ...(region ? { addressRegion: region } : {}),
        addressCountry: "CA",
      },
    };
  }

  if (job.salaryMin != null || job.salaryMax != null) {
    const unit = job.salaryPeriod && SALARY_UNIT_LD[job.salaryPeriod];
    ld.baseSalary = {
      "@type": "MonetaryAmount",
      currency: job.currency ?? "CAD",
      value: {
        "@type": "QuantitativeValue",
        ...(job.salaryMin != null ? { minValue: job.salaryMin } : {}),
        ...(job.salaryMax != null ? { maxValue: job.salaryMax } : {}),
        ...(unit ? { unitText: unit } : {}),
      },
    };
  }

  return ld;
}

/** Objet JSON-LD `Organization` pour une page employeur. */
export function organizationLd(id: string, name: string): Record<string, unknown> {
  const employer = getEmployer(id);
  const ld: Record<string, unknown> = {
    "@context": "https://schema.org/",
    "@type": "Organization",
    name,
    url: siteUrl(`/entreprises/${id}/`),
  };
  if (employer?.homepage) ld.sameAs = employer.homepage;
  return ld;
}

/** Sérialise un objet JSON-LD pour insertion dans <script type="application/ld+json">. */
export function ldJson(obj: unknown): string {
  // `<` échappé pour ne pas fermer prématurément la balise <script>.
  return JSON.stringify(obj).replace(/</g, "\\u003c");
}
