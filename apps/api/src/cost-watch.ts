/**
 * Surveillance des coûts (idée 121) : taille de l'instantané + usage Turso /
 * Workers si les jetons sont là. Alerte ntfy en cas de dépassement.
 *
 *   npm run cost:watch -w @jobccq/api
 */
import "./env.js";
import { readdir, readFile, stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import {
  budgetFromEnv,
  evaluateCosts,
  formatCostReport,
  type CostSample,
} from "./cost-budget.js";
import { postNtfy } from "./ntfy.js";

const DATA = resolve(process.cwd(), "../web/public/data");

async function snapshotSample(): Promise<Pick<CostSample, "jobsCount" | "jobsJsonBytes" | "shardsBytes">> {
  const jobsPath = join(DATA, "jobs.json");
  const jobsStat = await stat(jobsPath);
  const jobs = JSON.parse(await readFile(jobsPath, "utf8")) as unknown[];
  let shardsBytes = 0;
  try {
    const dir = join(DATA, "jobs", "r");
    const files = await readdir(dir);
    for (const f of files) {
      if (!f.endsWith(".json")) continue;
      shardsBytes += (await stat(join(dir, f))).size;
    }
  } catch {
    shardsBytes = 0;
  }
  return { jobsCount: jobs.length, jobsJsonBytes: jobsStat.size, shardsBytes: shardsBytes || undefined };
}

function num(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim()) {
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

async function tursoSample(): Promise<Partial<CostSample>> {
  const token = process.env.TURSO_API_TOKEN?.trim();
  const org = process.env.TURSO_ORG?.trim();
  const db = process.env.TURSO_DB?.trim() || "jobccq";
  if (!token || !org) return {};
  const url = `https://api.turso.tech/v1/organizations/${encodeURIComponent(org)}/databases/${encodeURIComponent(db)}/usage`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    console.warn(`Turso usage HTTP ${res.status} — ignoré.`);
    return {};
  }
  const json = (await res.json()) as {
    database?: { total?: Record<string, unknown>; usage?: Record<string, unknown> };
  };
  const total = json.database?.total ?? json.database?.usage ?? {};
  return {
    tursoRowsRead: num(total.rows_read ?? total.rowsRead),
    tursoRowsWritten: num(total.rows_written ?? total.rowsWritten),
    tursoStorageBytes: num(total.storage_bytes ?? total.storageBytes ?? total.storage),
  };
}

/** Invocations Workers du mois (GraphQL Analytics). Absent = on saute. */
async function workersSample(): Promise<Partial<CostSample>> {
  const token = process.env.CF_API_TOKEN?.trim();
  const account = process.env.CF_ACCOUNT_ID?.trim();
  if (!token || !account) return {};
  const from = new Date();
  from.setUTCDate(1);
  from.setUTCHours(0, 0, 0, 0);
  const query = `query($account: String!, $from: Time!) {
    viewer {
      accounts(filter: { accountTag: $account }) {
        workersInvocationsAdaptive(limit: 10000, filter: { datetime_geq: $from }) {
          sum { requests }
        }
      }
    }
  }`;
  const res = await fetch("https://api.cloudflare.com/client/v4/graphql", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables: { account, from: from.toISOString() } }),
  });
  if (!res.ok) {
    console.warn(`Cloudflare GraphQL HTTP ${res.status} — ignoré.`);
    return {};
  }
  const json = (await res.json()) as {
    data?: { viewer?: { accounts?: { workersInvocationsAdaptive?: { sum?: { requests?: number } }[] }[] } };
  };
  const series = json.data?.viewer?.accounts?.[0]?.workersInvocationsAdaptive ?? [];
  const total = series.reduce((n, row) => n + (row.sum?.requests ?? 0), 0);
  return total ? { workersRequests: total } : {};
}

async function main() {
  const sample: CostSample = {
    ...(await snapshotSample()),
    ...(await tursoSample()),
    ...(await workersSample()),
  };
  const budget = budgetFromEnv();
  const { ok, breaches } = evaluateCosts(sample, budget);
  const report = formatCostReport(sample, budget, breaches);
  console.log(report);

  if (!ok) {
    const topic = process.env.NTFY_TOPIC?.trim();
    if (topic) {
      await postNtfy(topic, "JobCCQ — dépassement de budget", report, "https://jobccqc.ca");
    }
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
