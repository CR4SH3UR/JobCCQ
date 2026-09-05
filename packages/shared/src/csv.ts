import type { Job } from "./types.js";
import { labelForRegion } from "./taxonomy.js";

function csvField(v: unknown): string {
  const s = String(v ?? "");
  if (/[",\n\r]/.test(s)) return `"${s.replaceAll('"', '""')}"`;
  return s;
}

/**
 * Export CSV d'un lot d'offres (favoris, candidatures, recherche).
 * Séparateur virgule, champs quotés seulement si nécessaire.
 */
export function jobsToCsv(jobs: Job[], opts?: { siteUrl?: string }): string {
  const origin = (opts?.siteUrl ?? "").replace(/\/$/, "");
  const lines = ["titre,entreprise,ville,region,url,fiche"];
  for (const j of jobs) {
    const fiche = `${origin}/emplois/${encodeURIComponent(j.id)}/`;
    lines.push(
      [
        csvField(j.title),
        csvField(j.company),
        csvField(j.city ?? j.location ?? ""),
        csvField(labelForRegion(j.regionId) ?? j.regionId ?? ""),
        csvField(j.url),
        csvField(fiche),
      ].join(","),
    );
  }
  return lines.join("\n");
}
