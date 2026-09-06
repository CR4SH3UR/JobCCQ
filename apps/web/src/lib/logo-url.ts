import { getEmployer, type HiringCompany } from "@jobccq/shared";

const DEFAULT_LOGO_PROXY = "https://images.weserv.nl/";

/**
 * Plateformes d'emploi / ATS / réseaux : leur favicon n'est pas le logo
 * de l'employeur. On les ignore pour le repli.
 */
const GENERIC_HOSTS = new Set([
  "jobillico.com",
  "indeed.com",
  "indeed.ca",
  "linkedin.com",
  "glassdoor.com",
  "glassdoor.ca",
  "facebook.com",
  "instagram.com",
  "twitter.com",
  "x.com",
  "youtube.com",
  "google.com",
  "jobs.gc.ca",
  "emplois.gc.ca",
  "workopolis.com",
  "option-carrieres.com",
  "jobboom.com",
  "recruiting.ultipro.ca",
  "recruiting.ultipro.com",
  "myworkdayjobs.com",
  "myworkday.com",
  "workday.com",
  "greenhouse.io",
  "boards.greenhouse.io",
  "lever.co",
  "jobs.lever.co",
  "bamboohr.com",
  "zoho.com",
  "zohorecruit.com",
  "recruit.zoho.com",
  "avature.net",
  "successfactors.com",
  "successfactors.eu",
  "njoyn.com",
  "teamtailor.com",
  "smartrecruiters.com",
  "recruitee.com",
  "ashbyhq.com",
  "jobs.ashbyhq.com",
  "applytojob.com",
  "workable.com",
  "icims.com",
  "taleo.net",
  "oraclecloud.com",
  "adp.com",
  "jobvite.com",
  "apply.workable.com",
  "wixsite.com",
  "squarespace.com",
  "wordpress.com",
  "github.com",
  "github.io",
]);

/** Hôte d'une URL (sans `www.`), ou null. */
export function hostFromUrl(raw?: string | null): string | null {
  const s = (raw ?? "").trim();
  if (!s) return null;
  try {
    const u = new URL(s.includes("://") ? s : `https://${s}`);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    const host = u.hostname.toLowerCase().replace(/^www\./, "");
    if (!host || host === "localhost" || /^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return null;
    return host;
  } catch {
    return null;
  }
}

export function isGenericLogoHost(host: string): boolean {
  const h = host.toLowerCase().replace(/^www\./, "");
  if (GENERIC_HOSTS.has(h)) return true;
  for (const g of GENERIC_HOSTS) {
    if (h.endsWith(`.${g}`)) return true;
  }
  return false;
}

/** Favicon DuckDuckGo (pas de scrape). À passer dans `optimizedLogoUrl`. */
export function faviconForHost(host: string): string | undefined {
  const h = host.toLowerCase().replace(/^www\./, "");
  if (!h || isGenericLogoHost(h)) return undefined;
  return `https://icons.duckduckgo.com/ip3/${h}.ico`;
}

/**
 * Logo d'offre s'il existe, sinon favicon du site employeur (homepage, puis
 * carrières, puis URL d'offre — en sautant les ATS).
 */
export function resolveCompanyLogoUrl(input: {
  logoUrl?: string | null;
  homepage?: string | null;
  careersUrl?: string | null;
  pageUrl?: string | null;
}): string | undefined {
  const explicit = (input.logoUrl ?? "").trim();
  if (explicit) return explicit;
  for (const page of [input.homepage, input.careersUrl, input.pageUrl]) {
    const host = hostFromUrl(page);
    if (!host) continue;
    const fav = faviconForHost(host);
    if (fav) return fav;
  }
  return undefined;
}

/** Logo pour une offre : JSON-LD si présent, sinon site de l'employeur. */
export function logoForJob(job: {
  companyLogoUrl?: string;
  sourceId?: string;
  url?: string;
}): string | undefined {
  const emp = job.sourceId ? getEmployer(job.sourceId) : undefined;
  return resolveCompanyLogoUrl({
    logoUrl: job.companyLogoUrl,
    homepage: emp?.homepage,
    careersUrl: emp?.careersUrl,
    pageUrl: job.url,
  });
}

/** Logo pour une carte « qui recrute ». */
export function logoForHiringCompany(c: Pick<HiringCompany, "companyLogoUrl" | "sources">): string | undefined {
  if (c.companyLogoUrl?.trim()) return c.companyLogoUrl.trim();
  for (const id of c.sources) {
    const emp = getEmployer(id);
    const src = resolveCompanyLogoUrl({ homepage: emp?.homepage, careersUrl: emp?.careersUrl });
    if (src) return src;
  }
  return undefined;
}

/** Passe un logo externe par images.weserv.nl (WebP, carré, cache 31 j). */
export function optimizedLogoUrl(src: string | undefined, size = 88): string | undefined {
  if (!src) return undefined;
  if (src.startsWith("/") || src.startsWith("data:") || src.startsWith("blob:")) return src;
  try {
    const u = new URL(src);
    if (u.protocol !== "https:" && u.protocol !== "http:") return src;
    const proxy = process.env.NEXT_PUBLIC_LOGO_PROXY_URL ?? DEFAULT_LOGO_PROXY;
    const p = new URL(proxy);
    p.searchParams.set("url", `${u.host}${u.pathname}${u.search}`);
    p.searchParams.set("w", String(size));
    p.searchParams.set("h", String(size));
    p.searchParams.set("fit", "contain");
    p.searchParams.set("output", "webp");
    p.searchParams.set("maxage", "31d");
    return p.toString();
  } catch {
    return src;
  }
}
