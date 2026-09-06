/**
 * Publications [ntfy](https://ntfy.sh) : topic public ou URL d'un serveur
 * auto-hébergé. Pas de compte requis — l'app ntfy s'abonne au même topic.
 *
 *   NTFY_TOPIC=jobccq-mon-topic          # serveur ntfy.sh
 *   NTFY_SERVER=https://ntfy.example.com # optionnel (défaut ntfy.sh)
 *   NTFY_TOKEN=tk_…                      # optionnel (topic protégé)
 */

const DEFAULT_SERVER = "https://ntfy.sh";
const TOPIC_RE = /^[a-zA-Z0-9_-]{1,64}$/;

export interface NtfyTarget {
  server: string;
  topic: string;
}

/** Topic seul (`jobccq-alertes`) ou URL (`https://ntfy.sh/jobccq-alertes`). */
export function parseNtfyTarget(raw: string, server = process.env.NTFY_SERVER): NtfyTarget | null {
  const s = raw.trim();
  if (!s) return null;
  if (/^https:\/\//i.test(s)) {
    try {
      const u = new URL(s);
      const topic = u.pathname.replace(/^\/+|\/+$/g, "").split("/")[0] ?? "";
      if (!TOPIC_RE.test(topic)) return null;
      return { server: `${u.protocol}//${u.host}`, topic };
    } catch {
      return null;
    }
  }
  if (!TOPIC_RE.test(s)) return null;
  const base = (server?.trim() || DEFAULT_SERVER).replace(/\/+$/, "");
  return { server: base, topic: s };
}

export async function postNtfy(
  topicOrUrl: string,
  title: string,
  message: string,
  click?: string,
): Promise<boolean> {
  const target = parseNtfyTarget(topicOrUrl);
  if (!target) return false;
  const token = process.env.NTFY_TOKEN?.trim();
  try {
    const res = await fetch(target.server, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        topic: target.topic,
        title: title.slice(0, 200),
        message: message.slice(0, 3900),
        tags: ["hammer"],
        ...(click ? { click } : {}),
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
