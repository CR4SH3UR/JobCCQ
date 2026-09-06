/**
 * Historique d'une offre (salaire modifié, titre, réactivation).
 * Calculé au scrape, plafonné, exposé sur la fiche.
 */
export type JobHistoryField = "salary" | "title" | "reactivated";

export interface JobHistoryEvent {
  at: string;
  field: JobHistoryField;
  from?: string;
  to?: string;
}

const MAX_EVENTS = 20;

export function parseJobHistory(raw?: string | null): JobHistoryEvent[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw) as unknown;
    if (!Array.isArray(v)) return [];
    return v
      .filter((e) => e && typeof e === "object" && typeof (e as JobHistoryEvent).at === "string")
      .map((e) => e as JobHistoryEvent)
      .slice(-MAX_EVENTS);
  } catch {
    return [];
  }
}

export function appendJobHistory(
  prev: JobHistoryEvent[],
  event: JobHistoryEvent,
): JobHistoryEvent[] {
  const last = prev[prev.length - 1];
  if (
    last &&
    last.field === event.field &&
    last.from === event.from &&
    last.to === event.to
  ) {
    return prev;
  }
  return [...prev, event].slice(-MAX_EVENTS);
}

export function formatHistoryEvent(e: JobHistoryEvent): string {
  if (e.field === "reactivated") return "Offre de nouveau en ligne";
  if (e.field === "title") return `Intitulé : ${e.from ?? "—"} → ${e.to ?? "—"}`;
  return `Salaire : ${e.from ?? "—"} → ${e.to ?? "—"}`;
}
