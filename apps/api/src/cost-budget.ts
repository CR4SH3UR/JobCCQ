/**
 * Budgets souples (idée 121) : instantané Pages + quotas Turso / Workers.
 * Dépassement = alerte, pas un plantage du scrape.
 */

export type CostSample = {
  jobsCount: number;
  jobsJsonBytes: number;
  shardsBytes?: number;
  tursoRowsRead?: number;
  tursoRowsWritten?: number;
  tursoStorageBytes?: number;
  workersRequests?: number;
};

export type CostBudget = {
  jobsCount: number;
  jobsJsonBytes: number;
  shardsBytes: number;
  tursoRowsRead: number;
  tursoRowsWritten: number;
  tursoStorageBytes: number;
  workersRequests: number;
};

/** ~80 % des plafonds starter / gratuit habituels. Surcharge via env COST_*. */
export const DEFAULT_COST_BUDGET: CostBudget = {
  jobsCount: 15_000,
  jobsJsonBytes: 8_000_000,
  shardsBytes: 10_000_000,
  tursoRowsRead: 400_000_000,
  tursoRowsWritten: 8_000_000,
  tursoStorageBytes: 4_000_000_000,
  workersRequests: 80_000,
};

export type CostBreach = {
  key: keyof CostSample;
  used: number;
  max: number;
  pct: number;
};

export function budgetFromEnv(base: CostBudget = DEFAULT_COST_BUDGET): CostBudget {
  const num = (name: string, fallback: number) => {
    const raw = process.env[name]?.trim();
    if (!raw) return fallback;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : fallback;
  };
  return {
    jobsCount: num("COST_JOBS_COUNT", base.jobsCount),
    jobsJsonBytes: num("COST_JOBS_JSON_BYTES", base.jobsJsonBytes),
    shardsBytes: num("COST_SHARDS_BYTES", base.shardsBytes),
    tursoRowsRead: num("COST_TURSO_ROWS_READ", base.tursoRowsRead),
    tursoRowsWritten: num("COST_TURSO_ROWS_WRITTEN", base.tursoRowsWritten),
    tursoStorageBytes: num("COST_TURSO_STORAGE_BYTES", base.tursoStorageBytes),
    workersRequests: num("COST_WORKERS_REQUESTS", base.workersRequests),
  };
}

export function evaluateCosts(sample: CostSample, budget: CostBudget = DEFAULT_COST_BUDGET): {
  ok: boolean;
  breaches: CostBreach[];
} {
  const checks: { key: keyof CostSample; used?: number; max: number }[] = [
    { key: "jobsCount", used: sample.jobsCount, max: budget.jobsCount },
    { key: "jobsJsonBytes", used: sample.jobsJsonBytes, max: budget.jobsJsonBytes },
    { key: "shardsBytes", used: sample.shardsBytes, max: budget.shardsBytes },
    { key: "tursoRowsRead", used: sample.tursoRowsRead, max: budget.tursoRowsRead },
    { key: "tursoRowsWritten", used: sample.tursoRowsWritten, max: budget.tursoRowsWritten },
    { key: "tursoStorageBytes", used: sample.tursoStorageBytes, max: budget.tursoStorageBytes },
    { key: "workersRequests", used: sample.workersRequests, max: budget.workersRequests },
  ];
  const breaches: CostBreach[] = [];
  for (const c of checks) {
    if (c.used == null) continue;
    if (c.used > c.max) {
      breaches.push({
        key: c.key,
        used: c.used,
        max: c.max,
        pct: Math.round((c.used / c.max) * 100),
      });
    }
  }
  return { ok: breaches.length === 0, breaches };
}

export function formatCostReport(sample: CostSample, budget: CostBudget, breaches: CostBreach[]): string {
  const line = (label: string, used: number | undefined, max: number) => {
    if (used == null) return `${label} : n/d (budget ${max})`;
    const pct = Math.round((used / max) * 100);
    return `${label} : ${used} / ${max} (${pct} %)`;
  };
  const lines = [
    line("Offres", sample.jobsCount, budget.jobsCount),
    line("jobs.json octets", sample.jobsJsonBytes, budget.jobsJsonBytes),
    line("shards octets", sample.shardsBytes, budget.shardsBytes),
    line("Turso lectures", sample.tursoRowsRead, budget.tursoRowsRead),
    line("Turso écritures", sample.tursoRowsWritten, budget.tursoRowsWritten),
    line("Turso stockage", sample.tursoStorageBytes, budget.tursoStorageBytes),
    line("Workers req.", sample.workersRequests, budget.workersRequests),
  ];
  if (breaches.length) {
    lines.push("");
    lines.push(`⚠ ${breaches.length} dépassement(s) : ${breaches.map((b) => b.key).join(", ")}`);
  }
  return lines.join("\n");
}
