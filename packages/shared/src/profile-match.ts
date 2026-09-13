import type { Job } from "./types.js";
import { ccqTradeById, ccqTradeOf } from "./ccq.js";
import { extractRequirements } from "./extract.js";
import {
  QUEBEC_REGIONS,
  REMOTE_TYPES,
  labelForRegion,
  labelForRemote,
} from "./taxonomy.js";

/**
 * Profil métier du visiteur (métiers CCQ, régions, mobilité, permis).
 * Sert l'accueil personnalisé, l'onboarding et le score d'adéquation.
 */
export interface JobSeekerProfile {
  trades: string[];
  regions: string[];
  remote: Array<"presentiel" | "hybride" | "teletravail">;
  /** Permis de conduire QC (`permis-classe-1` / `3` / `5`). */
  licenses: string[];
}

export const EMPTY_PROFILE: JobSeekerProfile = {
  trades: [],
  regions: [],
  remote: [],
  licenses: [],
};

/** Permis de conduire du Québec sélectionnables dans « Mon profil ». */
export const PROFILE_LICENSES = [
  { id: "permis-classe-1", label: "Classe 1", hint: "Ensemble de véhicules routiers" },
  { id: "permis-classe-3", label: "Classe 3", hint: "Camion / véhicule routier" },
  { id: "permis-classe-5", label: "Classe 5", hint: "Véhicule de promenade" },
] as const;

const LICENSE_IDS: ReadonlySet<string> = new Set(PROFILE_LICENSES.map((l) => l.id));
/** Classe 1 couvre 3 et 5 ; classe 3 couvre 5. */
const LICENSE_LEVEL: Record<string, number> = {
  "permis-classe-5": 1,
  "permis-classe-3": 2,
  "permis-classe-1": 3,
};

/** Le profil satisfait-il une exigence de permis (classe supérieure inclusive) ? */
export function profileCoversLicense(have: readonly string[], requiredId: string): boolean {
  const need = LICENSE_LEVEL[requiredId];
  if (need == null) return have.includes(requiredId);
  return have.some((id) => (LICENSE_LEVEL[id] ?? 0) >= need);
}

/** Les 17 régions administratives — hors fourre-tout (autre / hors QC / télétravail). */
export const PROFILE_REGIONS = QUEBEC_REGIONS.filter(
  (r) => r.id !== "autre" && r.id !== "canada-autre" && r.id !== "teletravail",
);

const REGION_IDS: ReadonlySet<string> = new Set(QUEBEC_REGIONS.map((r) => r.id));
const REMOTE_IDS: ReadonlySet<string> = new Set(REMOTE_TYPES.map((r) => r.id));

export function profileIsSet(p: JobSeekerProfile | null | undefined): boolean {
  if (!p) return false;
  return (
    p.trades.length > 0 ||
    p.regions.length > 0 ||
    p.remote.length > 0 ||
    (p.licenses?.length ?? 0) > 0
  );
}

function uniqKnown(ids: unknown, known: (id: string) => boolean): string[] {
  if (!Array.isArray(ids)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of ids) {
    const id = String(raw ?? "").trim();
    if (!id || seen.has(id) || !known(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

/** Parse / assainit un profil (ids inconnus ignorés). */
export function parseProfile(raw: unknown): JobSeekerProfile {
  if (!raw || typeof raw !== "object") return { ...EMPTY_PROFILE };
  const o = raw as Record<string, unknown>;
  return {
    trades: uniqKnown(o.trades, (id) => !!ccqTradeById(id)),
    regions: uniqKnown(o.regions, (id) => REGION_IDS.has(id)),
    remote: uniqKnown(o.remote, (id) => REMOTE_IDS.has(id)) as JobSeekerProfile["remote"],
    licenses: uniqKnown(o.licenses, (id) => LICENSE_IDS.has(id)),
  };
}

/** Union de deux profils (ids uniques, ordre : `a` puis ajouts de `b`). */
export function mergeProfiles(a: JobSeekerProfile, b: JobSeekerProfile): JobSeekerProfile {
  return parseProfile({
    trades: [...a.trades, ...b.trades],
    regions: [...a.regions, ...b.regions],
    remote: [...a.remote, ...b.remote],
    licenses: [...(a.licenses ?? []), ...(b.licenses ?? [])],
  });
}

export interface ProfileSyncSides {
  local: JobSeekerProfile;
  /** Epoch ms ; 0 = ancien stockage sans horodatage. */
  localAt: number;
  remote: JobSeekerProfile | null;
  remoteAt: number;
}

export type ProfileSyncDecision =
  | { action: "keep-local"; profile: JobSeekerProfile; persistRemote: boolean }
  | { action: "use-remote"; profile: JobSeekerProfile }
  | { action: "merge"; profile: JobSeekerProfile };

/**
 * Décide quoi garder à la connexion : dernière écriture gagne si les deux
 * côtés ont un horodatage ; sinon union pour ne rien perdre (migration).
 */
export function decideProfileSync(s: ProfileSyncSides): ProfileSyncDecision {
  const localSet = profileIsSet(s.local);
  const remoteSet = !!(s.remote && profileIsSet(s.remote));
  if (!localSet && !remoteSet) {
    return { action: "keep-local", profile: s.local, persistRemote: false };
  }
  if (!remoteSet) {
    return { action: "keep-local", profile: s.local, persistRemote: localSet };
  }
  if (!localSet) {
    return { action: "use-remote", profile: s.remote! };
  }
  if (s.localAt > 0 && s.remoteAt > 0) {
    if (s.localAt >= s.remoteAt) {
      return { action: "keep-local", profile: s.local, persistRemote: s.localAt > s.remoteAt };
    }
    return { action: "use-remote", profile: s.remote! };
  }
  return { action: "merge", profile: mergeProfiles(s.local, s.remote!) };
}

export interface ProfileMatch {
  /** 0–100, axes renseignés du profil uniquement. */
  score: number;
  reasons: string[];
}

const WEIGHT = { trade: 50, region: 35, remote: 15, license: 20 } as const;

/**
 * Score d'adéquation offre ↔ profil. `null` si le profil est vide
 * (rien à comparer). Les axes non renseignés ne pénalisent pas.
 */
export function matchJobToProfile(
  job: Job,
  profile: JobSeekerProfile,
): ProfileMatch | null {
  if (!profileIsSet(profile)) return null;

  let points = 0;
  let max = 0;
  const reasons: string[] = [];

  if (profile.trades.length) {
    const trade = ccqTradeOf(job.title);
    // Pas un métier de la liste : on n'en fait pas un 0 % (contremaître hors
    // profil, préventionniste, estimateur…). L'axe métier ne compte que si
    // l'offre est reconnue CCQ.
    if (trade) {
      max += WEIGHT.trade;
      if (profile.trades.includes(trade.id)) {
        points += WEIGHT.trade;
        reasons.push(trade.label);
      }
    }
  }

  if (profile.regions.length) {
    max += WEIGHT.region;
    if (job.regionId && profile.regions.includes(job.regionId)) {
      points += WEIGHT.region;
      reasons.push(labelForRegion(job.regionId) ?? job.regionId);
    } else if (job.remote === "teletravail") {
      // Accessible depuis n'importe laquelle des régions du profil.
      points += WEIGHT.region;
      reasons.push("Télétravail");
    }
  }

  if (profile.remote.length) {
    max += WEIGHT.remote;
    const jobRemote = job.remote ?? "presentiel";
    if (profile.remote.includes(jobRemote)) {
      points += WEIGHT.remote;
      reasons.push(labelForRemote(jobRemote) ?? jobRemote);
    }
  }

  if (profile.licenses.length) {
    const needed = extractRequirements(job.title, job.description)
      .map((f) => f.id)
      .filter((id) => LICENSE_IDS.has(id));
    // Comme le métier CCQ : l'axe ne compte que si l'offre mentionne un permis.
    if (needed.length) {
      max += WEIGHT.license;
      if (needed.every((id) => profileCoversLicense(profile.licenses ?? [], id))) {
        points += WEIGHT.license;
        const labels = PROFILE_LICENSES.filter((l) => needed.includes(l.id)).map((l) => l.label);
        reasons.push(labels.join(", ") || "Permis");
      }
    }
  }

  if (max === 0) return null;
  return { score: Math.round((100 * points) / max), reasons };
}

/** Trie les offres par adéquation (puis ordre d'origine). */
export function rankJobsByProfile(jobs: Job[], profile: JobSeekerProfile): Job[] {
  if (!profileIsSet(profile)) return jobs;
  return [...jobs]
    .map((j, i) => ({ j, i, s: matchJobToProfile(j, profile)?.score ?? 0 }))
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .map((x) => x.j);
}
