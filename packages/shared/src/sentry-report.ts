/**
 * Envoi Sentry sans SDK (idée 112). No-op si le DSN est vide.
 * Store API v7 : https://docs.sentry.io/api/store/
 */

export type SentryTarget = { storeUrl: string; key: string; projectId: string };

/** Décode un DSN `https://<key>@<host>/<projet>`. */
export function parseSentryDsn(dsn?: string | null): SentryTarget | null {
  const raw = (dsn ?? "").trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    const key = url.username;
    const projectId = url.pathname.replace(/^\/+/, "").split("/")[0] ?? "";
    if (!key || !projectId) return null;
    return {
      key,
      projectId,
      storeUrl: `${url.protocol}//${url.host}/api/${projectId}/store/`,
    };
  } catch {
    return null;
  }
}

function eventId(): string {
  const bytes = new Uint8Array(16);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) crypto.getRandomValues(bytes);
  else for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function asError(err: unknown): { type: string; value: string; stack?: string } {
  if (err instanceof Error) return { type: err.name || "Error", value: err.message, stack: err.stack };
  return { type: "Error", value: String(err) };
}

export function sentryStorePayload(
  err: unknown,
  ctx: { app: string; extra?: Record<string, string> },
): Record<string, unknown> {
  const e = asError(err);
  return {
    event_id: eventId(),
    timestamp: new Date().toISOString(),
    platform: "javascript",
    logger: `jobccq.${ctx.app}`,
    tags: { app: ctx.app, ...ctx.extra },
    exception: {
      values: [
        {
          type: e.type,
          value: e.value,
          stacktrace: e.stack ? { frames: [{ filename: "app", function: e.type, context_line: e.stack }] } : undefined,
        },
      ],
    },
  };
}

/** Envoie l'erreur à Sentry. Silencieux si DSN absent ou réseau en échec. */
export async function reportToSentry(
  dsn: string | undefined | null,
  err: unknown,
  ctx: { app: string; extra?: Record<string, string> },
): Promise<boolean> {
  const target = parseSentryDsn(dsn);
  if (!target) return false;
  try {
    const res = await fetch(target.storeUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Sentry-Auth": `Sentry sentry_version=7, sentry_client=jobccq/0.1, sentry_key=${target.key}`,
      },
      body: JSON.stringify(sentryStorePayload(err, ctx)),
    });
    return res.ok;
  } catch {
    return false;
  }
}
