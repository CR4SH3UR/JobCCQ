/**
 * Instantané `hiring-history.json` (scrapes réussis → offres trouvées).
 */
import { collapseHiringPoints, type HiringHistory, type HiringPoint } from "@jobccq/shared";

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

let cache: Promise<HiringHistory> | null = null;

function loadHistory(): Promise<HiringHistory> {
  if (!cache) {
    cache = fetch(`${BASE_PATH}/data/hiring-history.json`, { cache: "no-cache" })
      .then((r) => (r.ok ? (r.json() as Promise<HiringHistory>) : {}))
      .catch(() => ({}));
  }
  return cache;
}

export async function getHiringPoints(sourceId: string): Promise<HiringPoint[]> {
  const all = await loadHistory();
  return collapseHiringPoints(all[sourceId] ?? []);
}
