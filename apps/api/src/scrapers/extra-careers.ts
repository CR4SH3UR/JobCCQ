import type { DiscoveredEmployer, DiscoveredMethod, RawJob } from "@jobccq/shared";
import { normalizeTitle, viaTag } from "@jobccq/shared";
import { buildDiscoveredScraper } from "./discovered.js";
import type { Scraper } from "./types.js";

/** Sous-ensemble utile pour brancher un 2e lien carrières. */
export type ExtraCareersEmployer = Pick<DiscoveredEmployer, "id" | "name" | "homepage" | "careersUrl" | "method"> & {
  careersUrl2?: string;
  method2?: DiscoveredMethod | string;
};

const normUrl = (u: string): string => u.trim().replace(/\/+$/, "").toLowerCase();

function hostOf(url: string): string {
  try {
    const href = url.includes("://") ? url : `https://${url}`;
    return new URL(href).hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return "";
  }
}

/**
 * Employeur qui a déjà un scraper sur mesure pour le même hôte que `extraUrl`
 * (ex. excavationcaf.ca → charles-auguste-fortier-inc-caf). Sans ça, le 2e lien retombe sur le
 * parseur HTML générique et rate les offres en texte libre.
 */
export function pickPeerEmployerId(
  extraUrl: string,
  employers: readonly {
    id: string;
    careersUrl: string;
    homepage?: string;
    careersUrl2?: string | null;
  }[],
  customIds: ReadonlySet<string>,
): string | undefined {
  const host = hostOf(extraUrl);
  if (!host) return undefined;
  const viaExtra = employers.find((e) => customIds.has(e.id) && hostOf(e.careersUrl2 ?? "") === host);
  if (viaExtra) return viaExtra.id;
  const peer = employers.find((e) => {
    if (!customIds.has(e.id)) return false;
    const careersHost = hostOf(e.careersUrl);
    const homeHost = hostOf(e.homepage ?? "");
    if (isPortalCareersUrl(e.careersUrl) && careersHost === host) return false;
    if (homeHost && isPortalCareersUrl(e.homepage ?? "") && homeHost === host) return false;
    return careersHost === host || homeHost === host;
  });
  return peer?.id;
}

/** L'ancienne fiche dont le site est déjà le 2e lien d'un autre employeur. */
export function extraCareersAbsorbs(
  d: { id: string; careersUrl: string },
  employers: readonly { id: string; enabled?: boolean; careersUrl2?: string | null }[],
): boolean {
  const host = hostOf(d.careersUrl);
  if (!host) return false;
  return employers.some(
    (e) => e.id !== d.id && e.enabled !== false && hostOf(e.careersUrl2 ?? "") === host,
  );
}

const isJobillicoUrl = (url: string): boolean =>
  /jobillico\.com\/(?:[a-z]{2}\/)?(?:voir-entreprise|employeurs)\//i.test(url) ||
  /jobillico\.com\/.*voir-liste-emplois/i.test(url);

/** Portail d'offres (Jobillico, Indeed…) — pas le site de l'employeur. */
export function isPortalCareersUrl(url: string): boolean {
  const h = hostOf(url);
  return h.includes("jobillico.com") || h.includes("indeed.") || isJobillicoUrl(url);
}

/** Méthode du 2e lien : `method2` si fournie, sinon Jobillico détecté, sinon html. */
export function guessExtraMethod(url: string, method2?: string): DiscoveredMethod {
  if (method2 && method2 !== "html") return method2 as DiscoveredMethod;
  if (isJobillicoUrl(url)) return "jobillico";
  return (method2 as DiscoveredMethod) || "html";
}

/** Config du 2e scrape, ou undefined s'il n'y a rien à lancer. */
export function extraCareersConfig(
  d: Pick<ExtraCareersEmployer, "careersUrl" | "careersUrl2" | "method2">,
): { careersUrl: string; method: DiscoveredMethod } | undefined {
  const url2 = (d.careersUrl2 ?? "").trim();
  if (!url2) return undefined;
  if (normUrl(url2) === normUrl(d.careersUrl)) return undefined;
  return { careersUrl: url2, method: guessExtraMethod(url2, d.method2) };
}

/** Combien de champs utiles sont remplis (salaire, lieu, description…). */
function rawJobScore(j: RawJob): number {
  let n = 0;
  if (j.salaryMin != null || j.salaryMax != null) n += 10;
  if (j.location) n += 10;
  if (j.description && j.description.length >= 80) n += 10;
  if (j.employmentType) n += 10;
  if (j.postedAt) n += 10;
  n += Math.min(8, Math.floor((j.description?.length ?? 0) / 80));
  return n;
}

/** Lien de candidature réel > ancre `#poste` d'une page d'accueil. */
function urlQuality(url: string): number {
  if (/jobillico|indeed|workday|greenhouse|lever|smartrecruiters/i.test(url)) return 2;
  try {
    const u = new URL(url);
    if (u.hash && !u.search) return 0;
  } catch {
    /* ignore */
  }
  return 1;
}

function preferRawJob(a: RawJob, b: RawJob): RawJob {
  const sa = rawJobScore(a);
  const sb = rawJobScore(b);
  if (sa !== sb) return sa > sb ? a : b;
  const ua = urlQuality(a.url);
  const ub = urlQuality(b.url);
  if (ua !== ub) return ua > ub ? a : b;
  return a;
}

function samePlace(a?: string, b?: string): boolean {
  const la = (a ?? "").trim().toLowerCase();
  const lb = (b ?? "").trim().toLowerCase();
  if (!la || !lb) return true;
  return la === lb;
}

/** Même URL, ou même titre (lieu compatible) — un poste publié sur les 2 sites. */
export function isSameRawJob(a: RawJob, b: RawJob): boolean {
  if (normUrl(a.url) === normUrl(b.url)) return true;
  const ta = normalizeTitle(a.title);
  const tb = normalizeTitle(b.title);
  if (!ta || ta !== tb) return false;
  return samePlace(a.location, b.location);
}

/** Garde la fiche la plus complète et y verse les champs manquants de l'autre. */
export function mergeRicherRawJob(a: RawJob, b: RawJob): RawJob {
  const keep = preferRawJob(a, b);
  const other = keep === a ? b : a;
  const description =
    (keep.description?.length ?? 0) >= (other.description?.length ?? 0)
      ? keep.description
      : other.description;
  return {
    ...keep,
    location: keep.location || other.location,
    remote: keep.remote || other.remote,
    employmentType: keep.employmentType || other.employmentType,
    salaryMin: keep.salaryMin ?? other.salaryMin,
    salaryMax: keep.salaryMax ?? other.salaryMax,
    salaryPeriod: keep.salaryPeriod || other.salaryPeriod,
    description: description || other.description,
    postedAt: keep.postedAt || other.postedAt,
    companyLogoUrl: keep.companyLogoUrl || other.companyLogoUrl,
    tags: [...new Set([...(keep.tags ?? []), ...(other.tags ?? [])])],
  };
}

/** Union des offres : on garde la version la plus complète ; sourceId unifié. */
export function mergeRawJobsByUrl(
  primary: RawJob[],
  extra: RawJob[],
  extraMethod?: string,
  sourceIdOverride?: string,
): RawJob[] {
  const sourceId = sourceIdOverride ?? primary[0]?.sourceId ?? extra[0]?.sourceId;
  const remap = (j: RawJob): RawJob => (sourceId && j.sourceId !== sourceId ? { ...j, sourceId } : j);
  const tag = extraMethod ? viaTag(extraMethod) : undefined;
  const taggedExtra = extra.map((j) => {
    const tagged = tag && !(j.tags ?? []).includes(tag) ? { ...j, tags: [...(j.tags ?? []), tag] } : j;
    return remap(tagged);
  });
  const out: RawJob[] = [];
  const usedExtra = new Set<number>();

  for (const p of primary.map(remap)) {
    const ei = taggedExtra.findIndex((e, i) => !usedExtra.has(i) && isSameRawJob(p, e));
    if (ei >= 0) {
      usedExtra.add(ei);
      out.push(mergeRicherRawJob(p, taggedExtra[ei]!));
    } else {
      out.push(p);
    }
  }
  for (let i = 0; i < taggedExtra.length; i++) {
    if (usedExtra.has(i)) continue;
    out.push(taggedExtra[i]!);
  }
  return out;
}

/**
 * Enveloppe un scraper pour aussi visiter `careersUrl2` (ex. Jobillico en plus
 * du site officiel). Les offres restent sous le même `sourceId`. Un échec du
 * 2e lien (403 Jobillico fréquent en CI) n'annule pas le 1er.
 */
export function withExtraCareersScraper(
  d: ExtraCareersEmployer,
  primary: Scraper,
  extraOverride?: Scraper,
): Scraper {
  const extra = extraCareersConfig(d);
  if (!extra) return primary;
  const extraScraper =
    extraOverride ??
    buildDiscoveredScraper({
      id: d.id,
      name: d.name,
      homepage: d.homepage,
      careersUrl: extra.careersUrl,
      method: extra.method,
    });
  return {
    id: d.id,
    parseList: primary.parseList?.bind(primary),
    async scrape(params, ctx) {
      const a = await primary.scrape(params, ctx);
      let b: RawJob[] = [];
      try {
        ctx.log(`${d.id} — 2e carrière (${extra.method}) : ${extra.careersUrl}`);
        b = await extraScraper.scrape(params, ctx);
        ctx.log(`${d.id} — 2e carrière : ${b.length} poste(s)`);
      } catch (err) {
        ctx.log(`${d.id} — 2e carrière échouée : ${(err as Error).message}`);
      }
      return mergeRawJobsByUrl(a, b, extra.method, d.id);
    },
  };
}
