import type { Job } from "@jobccq/shared";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const CHUNK = 100;

export interface ExpoPushPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
}

/** Titre + corps d'une notif à partir des offres qui matchent. */
export function formatExpoPush(jobs: Job[], label: string): ExpoPushPayload {
  const n = jobs.length;
  const first = jobs[0]!;
  const title = `JobCCQ — ${label}`;
  const body =
    n === 1
      ? `${first.title} · ${first.company}${first.city ? " · " + first.city : ""}`
      : `${n} nouvelles offres : ${jobs
          .slice(0, 3)
          .map((j) => j.title)
          .join(" · ")}`;
  return { title, body, data: { jobId: first.id } };
}

/**
 * Envoie des notifications Expo Push (API publique, pas de secret requis).
 * Retourne le nombre de jetons acceptés. Échec réseau → 0 (le cron continue).
 */
export async function sendExpoPush(tokens: string[], payload: ExpoPushPayload): Promise<number> {
  const unique = [...new Set(tokens.map((t) => t.trim()).filter(Boolean))];
  if (unique.length === 0) return 0;
  let accepted = 0;
  for (let i = 0; i < unique.length; i += CHUNK) {
    const chunk = unique.slice(i, i + CHUNK);
    const messages = chunk.map((to) => ({
      to,
      sound: "default" as const,
      title: payload.title,
      body: payload.body,
      data: payload.data ?? {},
    }));
    try {
      const res = await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(messages),
      });
      if (!res.ok) {
        console.error("Expo Push erreur:", res.status, await res.text().catch(() => ""));
        continue;
      }
      accepted += chunk.length;
    } catch (err) {
      console.error("Expo Push réseau:", (err as Error).message);
    }
  }
  return accepted;
}
