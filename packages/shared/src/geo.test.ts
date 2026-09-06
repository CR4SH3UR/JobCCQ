import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { applyQuery } from "./filters.js";
import type { Job, JobQuery } from "./types.js";
import {
  coordsForCity,
  coordsForJob,
  haversineKm,
  originFromNear,
} from "./geo.js";

describe("geo — distances QC", () => {
  it("Montréal–Québec ~ 230–270 km", () => {
    const mtl = coordsForCity("Montréal")!;
    const qc = coordsForCity("Québec")!;
    const km = haversineKm(mtl, qc);
    assert.ok(km > 220 && km < 280, String(km));
  });

  it("un FSA montréalais donne le centroïde de Montréal", () => {
    const o = originFromNear("H2X 1Y4");
    assert.ok(o);
    assert.ok(Math.abs(o.lat - 45.5) < 0.2);
  });

  it("filtre par rayon autour d'un code postal", () => {
    const jobs: Job[] = [
      {
        id: "a",
        sourceId: "s",
        url: "https://ex.com/a",
        title: "A",
        company: "X",
        city: "Montréal",
        regionId: "montreal",
        tags: [],
        languages: [],
        scrapedAt: new Date().toISOString(),
      },
      {
        id: "b",
        sourceId: "s",
        url: "https://ex.com/b",
        title: "B",
        company: "Y",
        city: "Rimouski",
        regionId: "bas-saint-laurent",
        tags: [],
        languages: [],
        scrapedAt: new Date().toISOString(),
      },
    ];
    const q = { near: "H2X 1Y4", radiusKm: 50, sort: "distance", page: 1, pageSize: 20 } as JobQuery;
    const r = applyQuery(jobs, q);
    assert.equal(r.total, 1);
    assert.equal(r.items[0]?.city, "Montréal");
    assert.ok((r.items[0]?.distanceKm ?? 99) < 30);
  });
});
