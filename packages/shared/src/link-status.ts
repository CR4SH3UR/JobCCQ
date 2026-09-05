/**
 * Statut du lien original d'une offre (404 / redirection → peut-être pourvue).
 */
export const LINK_STATUSES = ["ok", "gone", "unknown"] as const;
export type LinkStatus = (typeof LINK_STATUSES)[number];

export function isLinkStatus(v: unknown): v is LinkStatus {
  return v === "ok" || v === "gone" || v === "unknown";
}

/**
 * Interprète une réponse HTTP (HEAD/GET, `redirect: "manual"`).
 * 404/410 et redirections 3xx → `gone` ; 2xx → `ok` ; le reste (timeout, 403…)
 * → `unknown` (pas de badge : souvent un blocage, pas une offre comblée).
 */
export function interpretLinkCheck(input: { status: number }): LinkStatus {
  const s = input.status;
  if (s === 404 || s === 410) return "gone";
  if (s >= 300 && s < 400) return "gone";
  if (s >= 200 && s < 300) return "ok";
  return "unknown";
}
