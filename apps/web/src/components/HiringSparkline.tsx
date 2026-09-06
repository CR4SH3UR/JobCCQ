import { sparklinePoints, type HiringPoint } from "@jobccq/shared";

const W = 180;
const H = 40;

export function HiringSparkline({ points }: { points: HiringPoint[] }) {
  const values = points.map((p) => p.found);
  const d = sparklinePoints(values, W, H);
  if (!d) return null;
  const last = values[values.length - 1] ?? 0;
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width={W}
      height={H}
      className="mt-1 text-brand-600"
      role="img"
      aria-label={`${points.length} scrapes, ${last} offre${last > 1 ? "s" : ""} au dernier passage`}
    >
      <polyline
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
        points={d}
      />
    </svg>
  );
}
