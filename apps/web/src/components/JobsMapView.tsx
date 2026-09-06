"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { coordsForJob, labelForRegion, type Job } from "@jobccq/shared";
import { buildQuery, searchJobs } from "@/lib/data";

type LeafletMap = {
  setView: (ll: [number, number], z: number) => LeafletMap;
  remove: () => void;
};
type LeafletNS = {
  map: (el: HTMLElement) => LeafletMap;
  tileLayer: (url: string, opts: Record<string, unknown>) => { addTo: (m: LeafletMap) => void };
  circleMarker: (
    ll: [number, number],
    opts: Record<string, unknown>,
  ) => { bindPopup: (html: string) => { addTo: (m: LeafletMap) => void } };
};

function loadLeaflet(): Promise<LeafletNS> {
  const w = window as unknown as { L?: LeafletNS };
  if (w.L) return Promise.resolve(w.L);
  return new Promise((resolve, reject) => {
    if (!document.querySelector("link[data-leaflet]")) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      link.dataset.leaflet = "1";
      document.head.appendChild(link);
    }
    const s = document.createElement("script");
    s.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    s.async = true;
    s.onload = () => {
      const L = (window as unknown as { L?: LeafletNS }).L;
      if (L) resolve(L);
      else reject(new Error("Leaflet indisponible"));
    };
    s.onerror = () => reject(new Error("Impossible de charger la carte"));
    document.head.appendChild(s);
  });
}

type Pin = { lat: number; lng: number; label: string; jobs: Job[] };

function groupPins(jobs: Job[]): Pin[] {
  const map = new Map<string, Pin>();
  for (const job of jobs) {
    const c = coordsForJob(job);
    if (!c) continue;
    const key = `${c.lat.toFixed(2)},${c.lng.toFixed(2)}`;
    const label = job.city || labelForRegion(job.regionId) || "Québec";
    const pin = map.get(key);
    if (pin) pin.jobs.push(job);
    else map.set(key, { lat: c.lat, lng: c.lng, label, jobs: [job] });
  }
  return [...map.values()];
}

/**
 * Carte des offres (OpenStreetMap via Leaflet, chargé à la demande).
 */
export function JobsMapView() {
  const host = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    searchJobs(buildQuery({ pageSize: 100, page: 1 }))
      .then(async (first) => {
        const pages = Math.min(first.totalPages, 20);
        let all = first.items;
        for (let p = 2; p <= pages; p++) {
          const r = await searchJobs(buildQuery({ pageSize: 100, page: p }));
          all = all.concat(r.items);
        }
        if (alive) setJobs(all);
      })
      .catch((e: Error) => alive && setError(e.message))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  const pins = useMemo(() => groupPins(jobs), [jobs]);

  useEffect(() => {
    if (!host.current || !pins.length) return;
    let cancelled = false;
    loadLeaflet()
      .then((L) => {
        if (cancelled || !host.current) return;
        mapRef.current?.remove();
        const map = L.map(host.current).setView([46.8, -71.2], 6);
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: "&copy; OpenStreetMap",
          maxZoom: 12,
        }).addTo(map);
        for (const pin of pins) {
          const n = pin.jobs.length;
          const links = pin.jobs
            .slice(0, 8)
            .map(
              (j) =>
                `<a href="${(process.env.NEXT_PUBLIC_BASE_PATH ?? "")}/emplois/${j.id}/">${j.title.replace(/</g, "")}</a> — ${j.company.replace(/</g, "")}`,
            )
            .join("<br>");
          L.circleMarker([pin.lat, pin.lng], {
            radius: Math.min(14, 5 + Math.sqrt(n) * 2),
            color: "#1a34d8",
            fillColor: "#3f68f7",
            fillOpacity: 0.7,
            weight: 1,
          })
            .bindPopup(
              `<strong>${pin.label}</strong> · ${n} offre${n > 1 ? "s" : ""}<br>${links}${
                n > 8 ? `<br>…` : ""
              }`,
            )
            .addTo(map);
        }
        mapRef.current = map;
      })
      .catch((e: Error) => setError(e.message));
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [pins]);

  return (
    <div>
      {loading && <p className="text-slate-500">Chargement des offres…</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div ref={host} className="mt-3 h-[28rem] overflow-hidden rounded-xl border border-slate-200" />
      <p className="mt-2 text-xs text-slate-400">
        {pins.length} lieu{pins.length > 1 ? "x" : ""} · positions approximatives (ville ou région).{" "}
        <Link href="/emplois/" className="text-brand-700 hover:underline">
          Recherche par rayon
        </Link>
      </p>
    </div>
  );
}
