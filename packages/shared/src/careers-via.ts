/**
 * Origine d'une offre (site officiel vs Jobillico / 2e lien) à partir de l'URL,
 * des tags `via:…` collés au scrape, et des URLs carrières de l'employeur.
 */

export interface CareersViaEmployer {
  careersUrl: string;
  method: string;
  careersUrl2?: string | null;
  method2?: string | null;
}

const VIA_RE = /^via:(.+)$/i;

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return "";
  }
}

/** Portails dont l'hôte suffit, même si la fiche a une autre méthode. */
export function methodFromJobUrl(url: string): string | undefined {
  const h = hostOf(url);
  if (!h) return undefined;
  if (h === "jobillico.com" || h.endsWith(".jobillico.com")) return "jobillico";
  if (h === "jackstaff.ca" || h.endsWith(".jackstaff.ca")) return "jackstaff";
  if (h.includes("bamboohr.com")) return "bamboohr";
  if (h.includes("greenhouse.io")) return "greenhouse";
  if (h.includes("lever.co")) return "lever";
  if (h.includes("recruitee.com")) return "recruitee";
  if (h.includes("smartrecruiters.com")) return "smartrecruiters";
  if (h.includes("teamtailor.com")) return "teamtailor";
  if (h.includes("ultipro.ca") || h.includes("ultipro.com")) return "ultipro";
  if (h.includes("zohorecruit.com")) return "zoho";
  return undefined;
}

export function viaTag(method: string): string {
  return `via:${method}`;
}

/** Méthode d'origine d'une offre (pour le badge admin). */
export function careersMethodForUrl(
  jobUrl: string,
  employer: CareersViaEmployer,
  tags: readonly string[] = [],
): string {
  const fromHost = methodFromJobUrl(jobUrl);
  if (fromHost) return fromHost;
  const tagged = tags.map((t) => t.match(VIA_RE)?.[1]).find(Boolean);
  if (tagged) return tagged;
  const jobHost = hostOf(jobUrl);
  if (jobHost && employer.careersUrl2 && hostOf(employer.careersUrl2) === jobHost) {
    return employer.method2 || "html";
  }
  if (jobHost && hostOf(employer.careersUrl) === jobHost) {
    return employer.method;
  }
  return employer.method;
}

const LABELS: Record<string, string> = {
  html: "Site",
  jsonld: "Site",
  jobillico: "Jobillico",
  jackstaff: "Jack Staff",
  zoho: "Zoho",
  bamboohr: "BambooHR",
  greenhouse: "Greenhouse",
  lever: "Lever",
  recruitee: "Recruitee",
  smartrecruiters: "SmartRecruiters",
  teamtailor: "Teamtailor",
  ultipro: "UltiPro",
  avature: "Avature",
};

export function careersMethodLabel(method: string): string {
  return LABELS[method] ?? method;
}
