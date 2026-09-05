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
import type { OfferPatch } from "@/components/AdminOfferEditor";

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
  return out;
}

/**
 * Enregistre (ou remplace) le patch d'une offre. Réservé aux admins (contrôle
 * d'accès par RLS côté Supabase). Lève si Supabase n'est pas configuré.
 */
export async function upsertJobOverride(jobId: string, patch: OfferPatch): Promise<void> {
  const { supabase } = await import("./supabase");
  if (!supabase) throw new Error("Supabase n'est pas configuré.");
  const { error } = await supabase.from("job_overrides").upsert(
    { job_id: jobId, patch: normalizePatch(patch), updated_at: new Date().toISOString() },
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
