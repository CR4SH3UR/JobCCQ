/**
 * Helpers PURS pour l'administration des comptes (durées de ban, extraction
 * d'IP client, parsing géoIP). Aucune I/O — testables hors-ligne.
 */

/** Ban permanent (Supabase attend une durée explicite ; ~100 ans). */
export const BAN_PERMANENT = "876000h";

/**
 * Durée de ban Supabase (`ban_duration`) depuis un nombre d'heures.
 * 0, absent ou négatif ⇒ permanent. Sinon `<n>h`.
 */
export function banDurationFromHours(hours?: number | null): string {
  if (hours == null || !Number.isFinite(hours) || hours <= 0) return BAN_PERMANENT;
  return `${Math.floor(hours)}h`;
}

/** Préfixe IPv4-mappé IPv6 (« ::ffff:1.2.3.4 ») → « 1.2.3.4 ». */
function unmapV4(ip: string): string {
  const m = /^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/i.exec(ip);
  return m ? m[1]! : ip;
}

/**
 * IP cliente à partir des en-têtes (derrière proxy). Prend la première IP de
 * `x-forwarded-for`, sinon `x-real-ip`, sinon l'IP socket fournie en repli.
 */
export function clientIpFromHeaders(
  headers: Record<string, string | string[] | undefined>,
  socketIp?: string,
): string | undefined {
  const xff = headers["x-forwarded-for"];
  const raw = Array.isArray(xff) ? xff[0] : xff;
  const first = raw?.split(",")[0]?.trim();
  const realIp = headers["x-real-ip"];
  const real = Array.isArray(realIp) ? realIp[0] : realIp;
  const ip = (first || real?.trim() || socketIp || "").trim();
  if (!ip) return undefined;
  return unmapV4(ip) || undefined;
}

/** IP privée / locale (inutile d'interroger un service géoIP). */
export function isPrivateIp(ip?: string): boolean {
  if (!ip) return true;
  const v = unmapV4(ip.trim());
  if (v === "::1" || v.toLowerCase().startsWith("fe80") || v.toLowerCase().startsWith("fc") || v.toLowerCase().startsWith("fd")) {
    return true;
  }
  if (/^(10|127)\./.test(v)) return true;
  if (/^192\.168\./.test(v)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(v)) return true;
  if (v === "0.0.0.0" || v === "") return true;
  return false;
}

export interface GeoInfo {
  country?: string;
  countryCode?: string;
  region?: string;
  city?: string;
}

/**
 * Normalise la réponse d'un service géoIP (format ipwho.is / ip-api). Tolérant :
 * champs manquants ⇒ `undefined`. Renvoie `null` si l'échec est explicite.
 */
export function parseGeo(json: unknown): GeoInfo | null {
  if (!json || typeof json !== "object") return null;
  const o = json as Record<string, unknown>;
  if (o.success === false || o.status === "fail") return null;
  const str = (v: unknown): string | undefined => {
    const s = typeof v === "string" ? v.trim() : "";
    return s || undefined;
  };
  const geo: GeoInfo = {
    country: str(o.country) ?? str(o.country_name),
    countryCode: str(o.country_code) ?? str(o.countryCode),
    region: str(o.region) ?? str(o.region_name) ?? str(o.regionName),
    city: str(o.city),
  };
  if (!geo.country && !geo.region && !geo.city) return null;
  return geo;
}

/** « Montréal, Québec, Canada » (segments non vides, dédoublonnés). */
export function formatGeo(geo?: GeoInfo | null): string {
  if (!geo) return "";
  const parts = [geo.city, geo.region, geo.country]
    .map((p) => (p ?? "").trim())
    .filter(Boolean);
  return [...new Set(parts)].join(", ");
}
