import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DatabaseSync } from "node:sqlite";
import {
  EMPLOYER_INDEX_SQL,
  FREQUENT_QUERIES,
  JOB_INDEX_SQL,
  planIsFullScan,
  planUsesIndex,
  summarizeExplain,
} from "./profile-queries.js";

function seed(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE "Job" (
      "id" TEXT PRIMARY KEY,
      "sourceId" TEXT NOT NULL,
      "url" TEXT NOT NULL UNIQUE,
      "title" TEXT NOT NULL,
      "company" TEXT NOT NULL,
      "regionId" TEXT,
      "categoryId" TEXT,
      "postedAt" DATETIME,
      "scrapedAt" DATETIME,
      "linkStatus" TEXT
    );
    CREATE TABLE "Employer" (
      "id" TEXT PRIMARY KEY,
      "enabled" INTEGER,
      "verified" INTEGER
    );
  `);
  for (const sql of [...JOB_INDEX_SQL, ...EMPLOYER_INDEX_SQL]) db.exec(sql);
  db.exec(`
    INSERT INTO "Job" VALUES
      ('j1','hamel-construction','https://ex.test/a','Manœuvre','Hamel','montreal','construction','2026-01-01','2026-01-02','ok'),
      ('j2','pomerleau','https://ex.test/b','Ingénieur','Pomerleau','laval','genie','2026-01-03','2026-01-04','gone');
    INSERT INTO "Employer" VALUES ('hamel-construction', 1, 1);
  `);
}

function detailsOf(db: DatabaseSync, sql: string): string[] {
  const rows = db.prepare(`EXPLAIN QUERY PLAN ${sql}`).all() as Record<string, unknown>[];
  return rows.map((r) => String(r.detail ?? r.DETAIL ?? Object.values(r).at(-1) ?? ""));
}

describe("EXPLAIN des filtres fréquents", () => {
  it("détecte index vs scan", () => {
    assert.equal(planUsesIndex(["SEARCH Job USING INDEX Job_regionId_postedAt_idx (regionId=?)"]), true);
    assert.equal(planIsFullScan(["SCAN Job"]), true);
    assert.equal(planIsFullScan(["SCAN Job USING INDEX Job_postedAt_idx"]), false);
  });

  it("les filtres fréquents passent par un index", () => {
    const db = new DatabaseSync(":memory:");
    seed(db);
    const filtered = FREQUENT_QUERIES.filter((q) => q.id !== "stats-by-region");
    for (const q of filtered) {
      const details = detailsOf(db, q.sql);
      const s = summarizeExplain(q.id, details);
      assert.equal(s.fullScan, false, `${q.id} en SCAN : ${s.plan}`);
      assert.equal(s.usesIndex, true, `${q.id} sans INDEX : ${s.plan}`);
    }
    db.close();
  });
});
