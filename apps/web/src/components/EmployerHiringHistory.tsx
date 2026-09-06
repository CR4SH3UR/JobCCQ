"use client";

import { useEffect, useState } from "react";
import { hiringExtent, type HiringPoint } from "@jobccq/shared";
import { getHiringPoints } from "@/lib/hiring-history";
import { HiringSparkline } from "./HiringSparkline";

/** Mini-graphe des offres trouvées au fil des scrapes (fiche employeur). */
export function EmployerHiringHistory({ sourceId }: { sourceId: string }) {
  const [points, setPoints] = useState<HiringPoint[] | null>(null);

  useEffect(() => {
    let alive = true;
    void getHiringPoints(sourceId).then((p) => {
      if (alive) setPoints(p);
    });
    return () => {
      alive = false;
    };
  }, [sourceId]);

  if (!points || points.length < 2) return null;
  const ext = hiringExtent(points);
  const first = formatDay(points[0]!.at);
  const last = formatDay(points[points.length - 1]!.at);

  return (
    <div className="mt-4 max-w-xs">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        Recrutement dans le temps
      </p>
      <HiringSparkline points={points} />
      <p className="mt-1 text-xs text-slate-500">
        {first} → {last}
        {ext ? ` · ${ext.min}–${ext.max} offres` : ""}
      </p>
    </div>
  );
}

function formatDay(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("fr-CA", { day: "numeric", month: "short" });
}
