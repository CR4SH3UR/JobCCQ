/**
 * Éditions admin d'offres — **overlay en direct via Supabase** (table `job_overrides`).
 *
 * Le site public est un export statique qui lit un instantané `jobs.json` **figé
 * au build**. Pour que les corrections faites dans la console `/admin`
 * apparaissent **sans attendre un redéploiement**, chaque édition est aussi
 * enregistrée ici sous forme de « patch » (les champs éditables de l'offre). Le
 * site lit cette table au chargement et **superpose** les patchs sur
 * l'instantané côté navigateur — exactement comme le reclassement
 * municipalité → région (voir `lib/data.ts`).
 *
 * - Lecture **publique** (RLS `select using (true)`) → l'édition est visible pour
 *   tous les visiteurs, en direct.
 * - Écriture **réservée aux admins** (RLS sur le courriel du jeton), comme la
 *   table `municipalities`. Voir `infra/README-supabase.md`.
 *
 * Le patch est **durable** : il est re-appliqué à chaque chargement, donc il
 * survit même à un re-scrape qui réécrirait l'offre en base (la correction admin
 * l'emporte tant qu'un admin ne la change pas). Supabase absent / table absente →
 * aucun overlay, l'instantané est servi tel quel (rien ne casse).
 */
import type { Job } from "@jobccq/shared";
import type { OfferPatch } from "../components/AdminOfferEditor";

/**
 * Champs d'offre éditables dans la console (miroir de `AdminOfferEditor`).
 * L'ordre est sans importance ; c'est l'ensemble qui compte.
 */
const EDITABLE_KEYS = [
  "title",
  "company",
  "url",
  "location",
  "city",
  "regionId",
  "remote",
  "categoryId",
  "employmentType",
  "salaryMin",
  "salaryMax",
  "salaryPeriod",
  "currency",
  "description",
  "tags",
  "languages",
  "postedAt",
  "companyLogoUrl",
] as const;

/** Ligne telle que stockée dans Supabase. */
interface Row {
  job_id: string;
  patch: Record<string, unknown> | null;
}

/** Un patch stocké : valeur par champ éditable (`null` = champ effacé). */
export type StoredPatch = Record<string, unknown>;

/** Flag admin : offre hors construction, masquée du site public. */
export function isOffConstruction(patch?: StoredPatch | null): boolean {
  return patch?.offConstruction === true;
}

/** Masquée suite à un signalement (file de modération). */
export function isModerationHidden(patch?: StoredPatch | null): boolean {
  return patch?.hidden === true;
}

/** Hors construction ou masquée par modération — absente du site public. */
export function isHiddenFromPublic(patch?: StoredPatch | null): boolean {
  return isOffConstruction(patch) || isModerationHidden(patch);
}

/**
 * Overlay admin sans masquer : sert la console (pour dé-flagger une offre).
 */
export function overlayJobs(jobs: Job[], overrides: Map<string, StoredPatch>): Job[] {
  if (!overrides.size) return jobs;
  return jobs.map((j) => {
    const patch = overrides.get(j.id);
    return patch ? applyPatch(j, patch) : j;
  });
}

/**
 * Instantané + overlay, sans les offres flaggées « hors construction ».
 * Sert le site public (recherche, fiches, stats).
 */
export function publicJobs(jobs: Job[], overrides: Map<string, StoredPatch>): Job[] {
  return overlayJobs(jobs, overrides).filter((j) => !isHiddenFromPublic(overrides.get(j.id)));
}

/** Pose le flag overlay sur des lignes admin (l'offre reste visible dans la console). */
export function attachOffConstruction<T extends { id: string }>(
  rows: T[],
  overrides: Map<string, StoredPatch>,
): (T & { offConstruction: boolean })[] {
  if (!overrides.size) return rows.map((r) => ({ ...r, offConstruction: false }));
  return rows.map((r) => ({ ...r, offConstruction: isOffConstruction(overrides.get(r.id)) }));
}

/**
 * Lit tous les patchs d'offres (lecture publique). Renvoie une Map vide si
 * Supabase n'est pas configuré ou si la table est absente / indisponible.
 */
export async function fetchJobOverrides(): Promise<Map<string, StoredPatch>> {
  const { supabase } = await import("./supabase");
  if (!supabase) return new Map();
  const { data, error } = await supabase.from("job_overrides").select("job_id, patch");
  if (error || !data) return new Map();
  const map = new Map<string, StoredPatch>();
  for (const r of data as Row[]) {
    if (r?.job_id && r.patch && typeof r.patch === "object") {
      map.set(r.job_id, r.patch as StoredPatch);
    }
  }
  return map;
}

/**
 * Applique un patch admin sur une offre. **Ne mute pas** l'original (copie) :
 * l'instantané partagé reste intact. `null`/"" = champ effacé, sinon valeur posée.
 * `postedAt` est stocké en millisecondes (comme dans l'éditeur) et reconverti en
 * ISO pour coller au modèle `Job`.
 */
export function applyPatch(job: Job, patch: StoredPatch): Job {
  const out = { ...job } as Record<string, unknown>;
  for (const k of EDITABLE_KEYS) {
    if (!(k in patch)) continue;
    const v = patch[k];
    if (k === "postedAt") {
      out.postedAt = v == null ? undefined : new Date(Number(v)).toISOString();
      continue;
    }
    if (v == null || v === "") {
      delete out[k];
    } else {
      out[k] = v;
    }
  }
  return out as unknown as Job;
}

/**
 * Normalise un patch de l'éditeur pour le stockage : chaque champ éditable est
 * présent explicitement (`undefined` → `null`), afin de distinguer « champ effacé »
 * (l'admin a vidé la valeur) de « champ inchangé ». L'éditeur envoyant toujours
 * l'ensemble des champs, le patch stocké décrit l'état admin complet de l'offre.
 */
function normalizePatch(patch: OfferPatch): StoredPatch {
  const out: StoredPatch = {};
  for (const k of EDITABLE_KEYS) {
    const v = (patch as Record<string, unknown>)[k];
    out[k] = v === undefined ? null : v;
  }
  out.offConstruction = patch.offConstruction === true;
  return out;
}

/**
 * Enregistre (ou remplace) le patch d'une offre. Réservé aux admins (contrôle
 * d'accès par RLS côté Supabase). Lève si Supabase n'est pas configuré.
 */
export async function upsertJobOverride(jobId: string, patch: OfferPatch): Promise<void> {
  const { supabase } = await import("./supabase");
  if (!supabase) throw new Error("Supabase n'est pas configuré.");
  const stored = normalizePatch(patch);
  const existing = (await fetchJobOverrides()).get(jobId);
  // Une édition depuis l'éditeur ne doit pas lever un masquage posé par un signalement.
  if (existing?.hidden === true) stored.hidden = true;
  const { error } = await supabase.from("job_overrides").upsert(
    { job_id: jobId, patch: stored, updated_at: new Date().toISOString() },
    { onConflict: "job_id" },
  );
  if (error) throw new Error(error.message);
}

/**
 * Supprime le patch d'une offre (l'offre reprend alors les valeurs de
 * l'instantané). Réservé aux admins (RLS).
 */
export async function deleteJobOverride(jobId: string): Promise<void> {
  const { supabase } = await import("./supabase");
  if (!supabase) throw new Error("Supabase n'est pas configuré.");
  const { error } = await supabase.from("job_overrides").delete().eq("job_id", jobId);
  if (error) throw new Error(error.message);
}

/**
 * Pose ou lève le flag `hidden` sans écraser le reste du patch (titre, etc.).
 * Sert la file de signalements : masquer une offre du site public.
 */
export async function setJobHidden(jobId: string, hidden: boolean): Promise<void> {
  const { supabase } = await import("./supabase");
  if (!supabase) throw new Error("Supabase n'est pas configuré.");
  const existing = (await fetchJobOverrides()).get(jobId) ?? {};
  const patch: StoredPatch = { ...existing, hidden };
  const { error } = await supabase.from("job_overrides").upsert(
    { job_id: jobId, patch, updated_at: new Date().toISOString() },
    { onConflict: "job_id" },
  );
  if (error) throw new Error(error.message);
}
