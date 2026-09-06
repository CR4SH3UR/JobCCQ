/**
 * Texte ntfy / webhook de fin de scrape : résumé + diff des offres
 * (ajoutées / modifiées / retirées), plafonné à la limite ntfy (~4 ko).
 */

export interface ScrapeNtfyDiff {
  added: { title: string }[];
  changed: { title: string }[];
  removed: { title: string }[];
}

export interface ScrapeNtfyRun {
  sourceId: string;
  name?: string;
  status: string;
  found: number;
  inserted: number;
  updated: number;
  error?: string | null;
  diff?: ScrapeNtfyDiff | null;
}

const MAX_CHARS = 3800;
const MAX_SOURCES = 18;
const MAX_TITLES = { added: 8, changed: 4, removed: 6 };

export function parseScrapeDiff(raw: string | null | undefined): ScrapeNtfyDiff | undefined {
  if (!raw) return undefined;
  try {
    const d = JSON.parse(raw) as Partial<ScrapeNtfyDiff>;
    const asList = (v: unknown): { title: string }[] =>
      Array.isArray(v)
        ? v
            .map((x) => ({ title: String((x as { title?: unknown })?.title ?? "").trim() }))
            .filter((x) => x.title)
        : [];
    return { added: asList(d.added), changed: asList(d.changed), removed: asList(d.removed) };
  } catch {
    return undefined;
  }
}

function label(r: ScrapeNtfyRun): string {
  return (r.name ?? "").trim() || r.sourceId;
}

function showTitles(sign: string, entries: { title: string }[], cap: number): string[] {
  const lines = entries.slice(0, cap).map((e) => `${sign} ${e.title}`);
  if (entries.length > cap) lines.push(`${sign} … et ${entries.length - cap} autre(s)`);
  return lines;
}

/** Message ntfy : totaux, erreurs, puis diff par source. */
export function formatScrapeNtfy(runs: ScrapeNtfyRun[]): string {
  if (!runs.length) return "Aucun scrape récent.";

  const ok = runs.filter((r) => r.status === "success").length;
  const err = runs.filter((r) => r.status === "error").length;
  const addedN = runs.reduce((n, r) => n + (r.diff?.added.length ?? r.inserted), 0);
  const changedN = runs.reduce((n, r) => n + (r.diff?.changed.length ?? r.updated), 0);
  const removedN = runs.reduce((n, r) => n + (r.diff?.removed.length ?? 0), 0);

  const lines: string[] = [
    `${runs.length} source${runs.length > 1 ? "s" : ""} · ${ok} succès · ${err} erreur${err > 1 ? "s" : ""}`,
    `+${addedN} · ~${changedN} MAJ · -${removedN}`,
  ];

  const ranked = [...runs].sort((a, b) => {
    const score = (r: ScrapeNtfyRun) =>
      (r.status === "error" ? 1000 : 0) +
      (r.diff?.added.length ?? r.inserted) * 10 +
      (r.diff?.removed.length ?? 0) * 5 +
      (r.diff?.changed.length ?? 0);
    return score(b) - score(a);
  });

  const shown = ranked.slice(0, MAX_SOURCES);
  for (const r of shown) {
    lines.push("");
    if (r.status === "error") {
      const msg = (r.error ?? "échec").replace(/\s+/g, " ").slice(0, 120);
      lines.push(`❌ ${label(r)} — ${msg}`);
      continue;
    }
    const d = r.diff;
    const add = d?.added.length ?? r.inserted;
    const ch = d?.changed.length ?? r.updated;
    const rm = d?.removed.length ?? 0;
    lines.push(`${label(r)} — ${r.found} trouvée(s) · +${add} ~${ch} -${rm}`);
    if (d) {
      lines.push(...showTitles("+", d.added, MAX_TITLES.added));
      lines.push(...showTitles("-", d.removed, MAX_TITLES.removed));
      lines.push(...showTitles("~", d.changed, MAX_TITLES.changed));
    }
  }
  if (ranked.length > shown.length) {
    lines.push("", `… et ${ranked.length - shown.length} autre(s) source(s)`);
  }

  let text = lines.join("\n").trim();
  if (text.length > MAX_CHARS) text = `${text.slice(0, MAX_CHARS - 20).trimEnd()}\n… (tronqué)`;
  return text;
}
