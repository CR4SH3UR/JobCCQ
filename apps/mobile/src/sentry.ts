/**
 * Suivi Sentry (idée 112) — copie autonome, sans @jobccq/shared.
 * No-op si EXPO_PUBLIC_SENTRY_DSN est vide.
 */

type Target = { storeUrl: string; key: string };

function parseDsn(dsn?: string | null): Target | null {
  const raw = (dsn ?? "").trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    const key = url.username;
    const projectId = url.pathname.replace(/^\/+/, "").split("/")[0] ?? "";
    if (!key || !projectId) return null;
    return { key, storeUrl: `${url.protocol}//${url.host}/api/${projectId}/store/` };
  } catch {
    return null;
  }
}

export function installMobileSentry(): void {
  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
  const target = parseDsn(dsn);
  if (!target) return;

  const send = (err: unknown) => {
    const e = err instanceof Error ? err : new Error(String(err));
    void fetch(target.storeUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Sentry-Auth": `Sentry sentry_version=7, sentry_client=jobccq-mobile/0.1, sentry_key=${target.key}`,
      },
      body: JSON.stringify({
        event_id: `${Date.now().toString(16)}${Math.random().toString(16).slice(2, 10)}`.slice(0, 32),
        timestamp: new Date().toISOString(),
        platform: "javascript",
        logger: "jobccq.mobile",
        tags: { app: "mobile" },
        exception: { values: [{ type: e.name || "Error", value: e.message, stacktrace: { frames: [{ context_line: e.stack }] } }] },
      }),
    }).catch(() => {});
  };

  const ErrorUtils = (globalThis as { ErrorUtils?: { getGlobalHandler?: () => (e: Error, fatal?: boolean) => void; setGlobalHandler?: (h: (e: Error, fatal?: boolean) => void) => void } }).ErrorUtils;
  const prev = ErrorUtils?.getGlobalHandler?.();
  ErrorUtils?.setGlobalHandler?.((e, fatal) => {
    send(e);
    prev?.(e, fatal);
  });
}
