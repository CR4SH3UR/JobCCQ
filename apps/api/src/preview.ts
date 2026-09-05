import { RawJobSchema, type RawJob } from "@jobccq/shared";
import { isJunkTitle } from "./normalize.js";

export interface PreviewItem {
  title: string;
  city?: string;
  url: string;
}

/** Aperçu d'un parseList : valide + écarte les titres parasites, sans écrire en base. */
export function toPreviewSample(raw: RawJob[]): PreviewItem[] {
  const out: PreviewItem[] = [];
  for (const candidate of raw) {
    const parsed = RawJobSchema.safeParse(candidate);
    if (!parsed.success) continue;
    if (isJunkTitle(parsed.data.title)) continue;
    out.push({
      title: parsed.data.title,
      city: parsed.data.location,
      url: parsed.data.url,
    });
  }
  return out;
}

/** Nom de fichier sûr pour une fixture HTML (`boless.html`). */
export function fixtureFilename(id: string): string {
  const slug = id.replace(/[^a-z0-9-]+/gi, "").toLowerCase() || "source";
  return `${slug}.html`;
}
