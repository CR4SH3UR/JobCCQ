import type { HiringPoint } from "@jobccq/shared";

const W = 720;
const H = 180;
const PAD = 24;

function fmtDay(iso: string): string {
  const d = new Date(iso.length <= 10 ? `${iso}T00:00:00` : iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("fr-CA", { day: "numeric", month: "short" });
}

/**
 * Courbe d'aire de l'évolution des offres dans le temps (dashboard marché).
 * Axe Y basé à 0 (lecture en volume absolu). Composant serveur : SVG statique.
 */
export function MarketTrendChart({ points }: { points: HiringPoint[] }) {
  if (points.length < 2) return null;
  const values = points.map((p) => p.found);
  const max = Math.max(...values, 1);
  const innerW = W - 2 * PAD;
  const innerH = H - 2 * PAD;
  const xy = (i: number, v: number) => {
    const x = PAD + (i / (points.length - 1)) * innerW;
    const y = PAD + (1 - v / max) * innerH;
    return [x, y] as const;
  };
  const line = values.map((v, i) => xy(i, v).join(",")).join(" ");
  const [x0] = xy(0, values[0]!);
  const [xN] = xy(points.length - 1, values[points.length - 1]!);
  const baseY = PAD + innerH;
  const area = `${x0},${baseY} ${line} ${xN},${baseY}`;
  const first = fmtDay(points[0]!.at);
  const last = fmtDay(points[points.length - 1]!.at);
  const lastVal = values[values.length - 1] ?? 0;

  return (
    <figure className="m-0">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-44 w-full text-brand-600"
        role="img"
        aria-label={`Évolution des offres du ${first} au ${last} (max ${max}, ${lastVal} au dernier relevé)`}
        preserveAspectRatio="none"
      >
        <polygon points={area} fill="currentColor" opacity="0.12" />
        <polyline
          points={line}
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </svg>
      <figcaption className="mt-1 flex justify-between text-xs text-slate-500">
        <span>{first}</span>
        <span>Sommet : {max} offres</span>
        <span>{last}</span>
      </figcaption>
    </figure>
  );
}
