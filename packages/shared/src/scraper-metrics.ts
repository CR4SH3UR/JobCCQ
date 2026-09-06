/**
 * Métriques **historisées** des scrapers (#113) : à partir de l'historique des
 * exécutions (`ScrapeRun`), calcule par source le taux de succès, la durée
 * moyenne et la tendance de volume — pour des graphes de santé au-delà du simple
 * « en échec depuis N jours ». Fonction pure et testable (aucun accès base).
 */

/** Ligne d'exécution minimale (sous-ensemble de ScrapeRun suffisant aux métriques). */
export interface ScrapeRunLite {
  sourceId: string;
  status: string; // "success" | "error" | "running"
  found?: number | null;
  startedAt?: string | null;
  finishedAt?: string | null;
}

export interface SourceMetrics {
  sourceId: string;
  runs: number;
  successes: number;
  errors: number;
  /** Part de runs réussis (0..1). */
  successRate: number;
  /** Durée moyenne des runs terminés (ms), ou null si inconnue. */
  avgDurationMs: number | null;
  /** Volume d'offres trouvées, du plus ancien au plus récent (pour un sparkline). */
  volumeTrend: number[];
  lastStatus: string | null;
  lastAt: string | null;
}

export interface ScraperMetrics {
  totalRuns: number;
  successRate: number;
  sources: SourceMetrics[];
}

/** Horodatage d'un run pour l'ordre chronologique (fin, sinon début). */
function runTime(r: ScrapeRunLite): string {
  return r.finishedAt ?? r.startedAt ?? "";
}

/** Durée (ms) d'un run terminé, ou null (non terminé / horodatage invalide / négatif). */
function durationMs(r: ScrapeRunLite): number | null {
  if (!r.startedAt || !r.finishedAt) return null;
  const a = Date.parse(r.startedAt);
  const b = Date.parse(r.finishedAt);
  if (Number.isNaN(a) || Number.isNaN(b) || b < a) return null;
  return b - a;
}

/**
 * Agrège une liste de runs (ordre quelconque) en métriques par source + global.
 * `trendMax` borne la longueur de la tendance de volume (points les plus récents).
 * Les sources sont triées : d'abord les plus fragiles (taux de succès croissant),
 * puis par nombre de runs décroissant.
 */
export function computeScraperMetrics(runs: readonly ScrapeRunLite[], trendMax = 20): ScraperMetrics {
  const bySource = new Map<string, ScrapeRunLite[]>();
  for (const r of runs) {
    if (!r?.sourceId) continue;
    let list = bySource.get(r.sourceId);
    if (!list) bySource.set(r.sourceId, (list = []));
    list.push(r);
  }

  const sources: SourceMetrics[] = [];
  let totalRuns = 0;
  let totalSuccess = 0;

  for (const [sourceId, list] of bySource) {
    const ordered = [...list].sort((a, b) => runTime(a).localeCompare(runTime(b)));
    const runsN = ordered.length;
    const successes = ordered.filter((r) => r.status === "success").length;
    const errors = ordered.filter((r) => r.status === "error").length;
    const durations = ordered.map(durationMs).filter((d): d is number => d != null);
    const avgDurationMs = durations.length
      ? Math.round(durations.reduce((s, d) => s + d, 0) / durations.length)
      : null;
    const volumeTrend = ordered
      .map((r) => (Number.isFinite(r.found) ? Number(r.found) : 0))
      .slice(-trendMax);
    const last = ordered[ordered.length - 1];

    totalRuns += runsN;
    totalSuccess += successes;
    sources.push({
      sourceId,
      runs: runsN,
      successes,
      errors,
      successRate: runsN ? successes / runsN : 0,
      avgDurationMs,
      volumeTrend,
      lastStatus: last?.status ?? null,
      lastAt: last ? runTime(last) || null : null,
    });
  }

  sources.sort((a, b) => a.successRate - b.successRate || b.runs - a.runs);
  return {
    totalRuns,
    successRate: totalRuns ? totalSuccess / totalRuns : 0,
    sources,
  };
}
