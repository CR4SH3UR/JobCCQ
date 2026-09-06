/**
 * Pose les index puis lance EXPLAIN QUERY PLAN sur les filtres fréquents.
 *
 *   npm run profile:queries -w @jobccq/api
 *
 * Sans TURSO_* : SQLite local (prisma/dev.db) s'il existe, sinon base mémoire.
 */
import "./env.js";
import { createClient, type Client } from "@libsql/client";
import {
  EMPLOYER_INDEX_SQL,
  FREQUENT_QUERIES,
  JOB_INDEX_SQL,
  summarizeExplain,
} from "./profile-queries.js";

async function openClient(): Promise<{ client: Client; label: string }> {
  const turso = process.env.TURSO_DATABASE_URL;
  if (turso) {
    return {
      label: "Turso",
      client: createClient({ url: turso, authToken: process.env.TURSO_AUTH_TOKEN }),
    };
  }
  const file = process.env.DATABASE_URL?.replace(/^file:/, "") || "./prisma/dev.db";
  return { label: `SQLite ${file}`, client: createClient({ url: `file:${file}` }) };
}

async function explain(client: Client, sql: string): Promise<string[]> {
  const res = await client.execute(`EXPLAIN QUERY PLAN ${sql}`);
  return res.rows.map((row) => {
    const rec = row as Record<string, unknown>;
    return String(rec.detail ?? rec.DETAIL ?? Object.values(rec).at(-1) ?? "");
  });
}

async function main() {
  const { client, label } = await openClient();
  for (const sql of [...JOB_INDEX_SQL, ...EMPLOYER_INDEX_SQL]) {
    await client.execute(sql).catch(() => {
      /* table absente en base vide */
    });
  }

  console.log(`EXPLAIN QUERY PLAN (${label})`);
  let scans = 0;
  for (const q of FREQUENT_QUERIES) {
    let details: string[];
    try {
      details = await explain(client, q.sql);
    } catch (err) {
      console.log(`  ⚠ ${q.id} — ${q.why} : ${(err as Error).message}`);
      continue;
    }
    const s = summarizeExplain(q.id, details);
    const mark = s.usesIndex ? "INDEX" : s.fullScan ? "SCAN" : "ok";
    if (s.fullScan) scans++;
    console.log(`  [${mark}] ${q.id} — ${q.why}`);
    console.log(`         ${s.plan || "(vide)"}`);
  }
  if (scans) {
    console.log(`⚠ ${scans} requête(s) en parcours complet.`);
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
