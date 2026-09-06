import type { Job } from "./types.js";
import { ccqTradeById, ccqTradeOf } from "./ccq.js";
import { labelForCategory, labelForRegion } from "./taxonomy.js";
import { matchJobToProfile, profileIsSet, type JobSeekerProfile } from "./profile-match.js";

/**
 * Signaux implicites du visiteur : offres sauvegardées et candidatures suivies.
 * Sert un filtrage collaboratif item-item simple (offres proches de celles
 * déjà « notées »), sans agrégat inter-utilisateurs.
 */
export interface UserJobSignals {
  favoriteIds: readonly string[];
  appliedIds: readonly string[];
}

export interface RecommendOptions {
  limit?: number;
  /** Bonus d'adéquation si un profil métier est aussi renseigné. */
  profile?: JobSeekerProfile | null;
}

export interface RecommendedJob {
  job: Job;
  score: number;
  reasons: string[];
}

const W = {
  trade: 3,
  region: 2,
  category: 2,
  source: 1,
  company: 1,
} as const;

const RATING = {
  favorite: 1,
  applied: 1.25,
} as const;

/** Poids max du score d'adéquation (0–100) ajouté au score collaboratif. */
const PROFILE_BOOST = 0.4;

type Feat = Map<string, number>;

function companyKey(job: Job): string | undefined {
  const n = (job.company ?? "").trim().toLowerCase();
  return n || undefined;
}

/** Vecteur d'attributs pondérés (métier, région, domaine, employeur). */
export function jobFeatureWeights(job: Job): Feat {
  const m = new Map<string, number>();
  const trade = ccqTradeOf(job.title);
  if (trade) m.set(`t:${trade.id}`, W.trade);
  if (job.regionId) m.set(`r:${job.regionId}`, W.region);
  if (job.categoryId) m.set(`c:${job.categoryId}`, W.category);
  if (job.sourceId) m.set(`s:${job.sourceId}`, W.source);
  const co = companyKey(job);
  if (co) m.set(`co:${co}`, W.company);
  return m;
}

/** Similarité cosinus entre deux vecteurs d'attributs. */
export function featureCosine(a: Feat, b: Feat): number {
  if (a.size === 0 || b.size === 0) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (const w of a.values()) na += w * w;
  for (const [k, w] of b) {
    nb += w * w;
    const aw = a.get(k);
    if (aw) dot += aw * w;
  }
  if (na === 0 || nb === 0 || dot === 0) return 0;
  return dot / Math.sqrt(na * nb);
}

function sharedKeys(a: Feat, b: Feat): string[] {
  const out: string[] = [];
  for (const k of a.keys()) if (b.has(k)) out.push(k);
  return out;
}

function reasonLabels(keys: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const k of keys) {
    const sep = k.indexOf(":");
    const kind = sep === -1 ? k : k.slice(0, sep);
    const id = sep === -1 ? "" : k.slice(sep + 1);
    let label: string | undefined;
    if (kind === "t") label = ccqTradeById(id)?.label;
    else if (kind === "r") label = labelForRegion(id);
    else if (kind === "c") label = labelForCategory(id);
    else if (kind === "s" || kind === "co") label = "même employeur";
    if (!label || seen.has(label)) continue;
    seen.add(label);
    out.push(label);
  }
  return out;
}

function ratingFor(id: string, fav: Set<string>, app: Set<string>): number {
  let r = 0;
  if (fav.has(id)) r += RATING.favorite;
  if (app.has(id)) r += RATING.applied;
  return r;
}

/** Ids uniques, dans l'ordre favoris puis candidatures. */
export function seedJobIds(signals: UserJobSignals): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of [...signals.favoriteIds, ...signals.appliedIds]) {
    const id = String(raw ?? "").trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

/**
 * Classe les offres encore ouvertes selon leur proximité avec les favoris
 * et candidatures du visiteur (filtrage collaboratif item-item).
 * Les graines elles-mêmes sont exclues. Tableau vide s'il n'y a aucun signal
 * résolu dans le catalogue.
 */
export function recommendJobs(
  jobs: readonly Job[],
  signals: UserJobSignals,
  options: RecommendOptions = {},
): RecommendedJob[] {
  const limit = options.limit ?? 6;
  if (limit <= 0) return [];

  const fav = new Set(signals.favoriteIds.map(String));
  const app = new Set(signals.appliedIds.map(String));
  const seeds = seedJobIds(signals);
  if (!seeds.length) return [];

  const byId = new Map(jobs.map((j) => [j.id, j]));
  const seedJobs = seeds.map((id) => byId.get(id)).filter((j): j is Job => !!j);
  if (!seedJobs.length) return [];

  const seedFeat = seedJobs.map((j) => ({
    job: j,
    feat: jobFeatureWeights(j),
    rating: ratingFor(j.id, fav, app),
  }));
  const excluded = new Set(seedJobs.map((j) => j.id));
  const scored: RecommendedJob[] = [];

  for (const job of jobs) {
    if (excluded.has(job.id)) continue;
    const feat = jobFeatureWeights(job);
    let score = 0;
    let bestShared: string[] = [];
    let bestSim = 0;
    for (const s of seedFeat) {
      const sim = featureCosine(s.feat, feat);
      if (sim <= 0) continue;
      score += s.rating * sim;
      if (sim > bestSim) {
        bestSim = sim;
        bestShared = sharedKeys(s.feat, feat);
      }
    }
    if (score <= 0) continue;
    if (options.profile && profileIsSet(options.profile)) {
      const m = matchJobToProfile(job, options.profile);
      if (m) score += (m.score / 100) * PROFILE_BOOST;
    }
    scored.push({ job, score, reasons: reasonLabels(bestShared) });
  }

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const ta = Date.parse(a.job.postedAt ?? a.job.scrapedAt) || 0;
    const tb = Date.parse(b.job.postedAt ?? b.job.scrapedAt) || 0;
    return tb - ta;
  });

  return scored.slice(0, limit);
}
