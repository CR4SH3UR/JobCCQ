/**
 * Fusion de deux fiches employeur : on garde `keep`, on absorbe `drop`.
 */
import { hasCustomScraper } from "./custom-scrapers.js";

export interface MergeableEmployer {
  id: string;
  name: string;
  homepage: string;
  careersUrl: string;
  method: string;
  /** 2e page carrières (ex. Jobillico en plus du site officiel). */
  careersUrl2?: string | null;
  method2?: string | null;
  region?: string | null;
  rbq?: string | null;
  scope?: string | null;
  sectors?: readonly string[] | null;
  verified?: boolean;
  enabled?: boolean;
  notes?: string | null;
}

const sameUrl = (a?: string | null, b?: string | null): boolean =>
  (a ?? "").trim().replace(/\/+$/, "").toLowerCase() === (b ?? "").trim().replace(/\/+$/, "").toLowerCase();

/** Choisit l'id à conserver (scraper sur mesure > vérifié > plus d'offres). */
export function pickKeepEmployerId(
  a: MergeableEmployer,
  b: MergeableEmployer,
  jobs: { a: number; b: number } = { a: 0, b: 0 },
): string {
  const aC = hasCustomScraper(a.id);
  const bC = hasCustomScraper(b.id);
  if (aC && !bC) return a.id;
  if (bC && !aC) return b.id;
  if (a.verified && !b.verified) return a.id;
  if (b.verified && !a.verified) return b.id;
  if (jobs.a !== jobs.b) return jobs.a >= jobs.b ? a.id : b.id;
  return a.id;
}

export const MERGE_FIELDS = [
  "name",
  "homepage",
  "careersUrl",
  "careersUrl2",
  "region",
  "rbq",
  "scope",
  "sectors",
  "verified",
  "enabled",
  "notes",
] as const;

export type MergeField = (typeof MERGE_FIELDS)[number];
/** Côté A, côté B, ou les deux (secteurs / notes / 2e URL). */
export type MergeSide = "a" | "b" | "both";
export type MergeFieldChoices = Record<MergeField, MergeSide>;

export interface MergePlan {
  keepId: string;
  fields: MergeFieldChoices;
}

const hasText = (v: unknown): boolean => String(v ?? "").trim().length > 0;
const hasList = (v: unknown): boolean => Array.isArray(v) && v.some((x) => String(x ?? "").trim());

function sideOf(id: string, a: MergeableEmployer, b: MergeableEmployer): "a" | "b" {
  return id === a.id ? "a" : "b";
}

function fromSide<T>(a: T, b: T, side: MergeSide, fallback: T): T {
  if (side === "a") return a;
  if (side === "b") return b;
  return fallback;
}

/** Suggestion initiale : id recommandé, champs du keep sauf vide → drop, secteurs/notes = les deux. */
export function suggestMergePlan(
  a: MergeableEmployer,
  b: MergeableEmployer,
  jobs: { a: number; b: number } = { a: 0, b: 0 },
): MergePlan {
  const keepId = pickKeepEmployerId(a, b, jobs);
  const keep = keepId === a.id ? a : b;
  const drop = keepId === a.id ? b : a;
  const k = sideOf(keep.id, a, b);
  const d = k === "a" ? "b" : "a";
  const pick = (keepVal: unknown, dropVal: unknown, list = false): MergeSide => {
    const keepHas = list ? hasList(keepVal) : hasText(keepVal);
    const dropHas = list ? hasList(dropVal) : hasText(dropVal);
    if (keepHas) return k;
    if (dropHas) return d;
    return k;
  };
  return {
    keepId,
    fields: {
      name: pick(keep.name, drop.name),
      homepage: pick(keep.homepage, drop.homepage),
      careersUrl: pick(keep.careersUrl, drop.careersUrl),
      careersUrl2: pick(keep.careersUrl2, drop.careersUrl2 || drop.careersUrl),
      region: pick(keep.region, drop.region),
      rbq: pick(keep.rbq, drop.rbq),
      scope: pick(keep.scope, drop.scope),
      sectors: "both",
      verified: keep.verified ? k : drop.verified ? d : k,
      enabled: keep.enabled !== false ? k : d,
      notes: "both",
    },
  };
}

/** Applique le plan : id = keepId, chaque champ selon le côté choisi. */
export function applyMergePlan(
  a: MergeableEmployer,
  b: MergeableEmployer,
  plan: MergePlan,
): MergeableEmployer {
  const keep = plan.keepId === a.id ? a : b;
  const drop = plan.keepId === a.id ? b : a;
  if (keep.id === drop.id) return { ...keep };
  const f = plan.fields;
  const emp = (side: "a" | "b") => (side === "a" ? a : b);

  const nameSrc = f.name === "both" ? (keep.name ? (keep.id === a.id ? "a" : "b") : "a") : f.name;
  const name = emp(nameSrc).name;

  const homeSrc = f.homepage === "both" ? (hasText(keep.homepage) ? sideOf(keep.id, a, b) : sideOf(drop.id, a, b)) : f.homepage;
  const homepage = emp(homeSrc).homepage || drop.homepage || keep.homepage;

  const urlSrc = f.careersUrl === "b" ? "b" : "a";
  const urlEmp = f.careersUrl === "both" ? keep : emp(urlSrc === "a" ? "a" : "b");
  const other = urlEmp.id === a.id ? b : a;
  let careersUrl = urlEmp.careersUrl || other.careersUrl;
  let method = urlEmp.careersUrl ? urlEmp.method : other.method;
  if (f.careersUrl === "both") {
    careersUrl = keep.careersUrl || drop.careersUrl;
    method = keep.careersUrl ? keep.method : drop.method;
  }

  const extraFrom = (e: MergeableEmployer, primary: string): { url?: string; method?: string } => {
    if (e.careersUrl2 && !sameUrl(e.careersUrl2, primary)) return { url: e.careersUrl2, method: e.method2 ?? undefined };
    if (e.careersUrl && !sameUrl(e.careersUrl, primary)) return { url: e.careersUrl, method: e.method };
    return {};
  };

  let careersUrl2: string | undefined;
  let method2: string | undefined;
  if (f.careersUrl === "both") {
    const extra = extraFrom(drop, careersUrl);
    careersUrl2 = keep.careersUrl2 || extra.url;
    method2 = keep.method2 || extra.method || undefined;
  } else if (f.careersUrl2 === "both") {
    const ka = extraFrom(keep, careersUrl);
    const da = extraFrom(drop, careersUrl);
    careersUrl2 = ka.url || da.url;
    method2 = ka.method || da.method;
  } else if (f.careersUrl2 === "a" || f.careersUrl2 === "b") {
    const extra = extraFrom(emp(f.careersUrl2), careersUrl);
    careersUrl2 = extra.url;
    method2 = extra.method;
  }

  const regionSrc = f.region === "both" ? (hasText(keep.region) ? sideOf(keep.id, a, b) : sideOf(drop.id, a, b)) : f.region;
  const rbqSrc = f.rbq === "both" ? (hasText(keep.rbq) ? sideOf(keep.id, a, b) : sideOf(drop.id, a, b)) : f.rbq;
  const scopeSrc = f.scope === "both" ? (hasText(keep.scope) ? sideOf(keep.id, a, b) : sideOf(drop.id, a, b)) : f.scope;

  const sectors =
    f.sectors === "both"
      ? [...new Set([...(a.sectors ?? []), ...(b.sectors ?? [])].filter(Boolean))]
      : [...(emp(f.sectors).sectors ?? [])];

  const notesParts =
    f.notes === "both"
      ? [a.notes, b.notes]
      : [emp(f.notes).notes];
  const notes = [...notesParts, `Fusionné depuis ${drop.id} (${drop.name})`]
    .map((s) => (s ?? "").trim())
    .filter(Boolean)
    .join("\n");

  const verified =
    f.verified === "both" ? !!(a.verified || b.verified) : !!emp(f.verified).verified;
  const enabled =
    f.enabled === "both" ? a.enabled !== false && b.enabled !== false : emp(f.enabled).enabled !== false;

  return {
    ...keep,
    name,
    homepage,
    careersUrl,
    method,
    careersUrl2: careersUrl2 || undefined,
    method2: method2 || undefined,
    region: fromSide(a.region, b.region, regionSrc, keep.region) || undefined,
    rbq: fromSide(a.rbq, b.rbq, rbqSrc, keep.rbq) || undefined,
    scope: fromSide(a.scope, b.scope, scopeSrc, keep.scope) || undefined,
    sectors,
    verified,
    enabled,
    notes,
  };
}

/** Champs de `keep` complétés par `drop` (id / méthode de keep inchangés). */
export function mergeEmployerFields(keep: MergeableEmployer, drop: MergeableEmployer): MergeableEmployer {
  const sectors = [...new Set([...(keep.sectors ?? []), ...(drop.sectors ?? [])].filter(Boolean))];
  const notes = [keep.notes, drop.notes, `Fusionné depuis ${drop.id} (${drop.name})`]
    .map((s) => (s ?? "").trim())
    .filter(Boolean)
    .join("\n");
  const dropAsSecond =
    drop.careersUrl && !sameUrl(keep.careersUrl, drop.careersUrl) ? drop.careersUrl : undefined;
  return {
    ...keep,
    homepage: keep.homepage || drop.homepage,
    careersUrl: keep.careersUrl || drop.careersUrl,
    careersUrl2: keep.careersUrl2 || dropAsSecond || drop.careersUrl2 || undefined,
    method2: keep.method2 || (dropAsSecond ? drop.method : undefined) || drop.method2 || undefined,
    region: keep.region || drop.region,
    rbq: keep.rbq || drop.rbq,
    scope: keep.scope || drop.scope,
    sectors,
    verified: !!(keep.verified || drop.verified),
    enabled: keep.enabled !== false,
    notes,
  };
}
