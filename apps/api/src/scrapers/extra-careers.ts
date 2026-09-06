import type { DiscoveredEmployer, DiscoveredMethod, RawJob } from "@jobccq/shared";
import { viaTag } from "@jobccq/shared";
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
 * (ex. excavationcaf.ca → cafortier-com). Sans ça, le 2e lien retombe sur le
 * parseur HTML générique et rate les offres en texte libre.
 */
export function pickPeerEmployerId(
  extraUrl: string,
  employers: readonly { id: string; careersUrl: string; homepage?: string }[],
  customIds: ReadonlySet<string>,
): string | undefined {
  const host = hostOf(extraUrl);
  if (!host) return undefined;
  const peer = employers.find((e) => {
    if (!customIds.has(e.id)) return false;
    return hostOf(e.careersUrl) === host || hostOf(e.homepage ?? "") === host;
  });
  return peer?.id;
}

const isJobillicoUrl = (url: string): boolean =>
  /jobillico\.com\/(?:[a-z]{2}\/)?(?:voir-entreprise|employeurs)\//i.test(url) ||
  /jobillico\.com\/.*voir-liste-emplois/i.test(url);

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

/** Union des offres : le 1er lien gagne en cas d'URL identique ; sourceId unifié. */
export function mergeRawJobsByUrl(
  primary: RawJob[],
  extra: RawJob[],
  extraMethod?: string,
  sourceIdOverride?: string,
): RawJob[] {
  const sourceId = sourceIdOverride ?? primary[0]?.sourceId ?? extra[0]?.sourceId;
  const seen = new Set(primary.map((j) => j.url));
  const out = [...primary];
  const tag = extraMethod ? viaTag(extraMethod) : undefined;
  for (const j of extra) {
    if (seen.has(j.url)) continue;
    seen.add(j.url);
    const tagged = tag && !(j.tags ?? []).includes(tag) ? { ...j, tags: [...(j.tags ?? []), tag] } : j;
    out.push(sourceId ? { ...tagged, sourceId } : tagged);
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
    id: primary.id,
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
