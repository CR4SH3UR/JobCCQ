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
