const DEFAULT_LOGO_PROXY = "https://images.weserv.nl/";

export function optimizedLogoUrl(src: string | undefined, size = 88): string | undefined {
  if (!src) return undefined;
  if (src.startsWith("/") || src.startsWith("data:") || src.startsWith("blob:")) return src;
  try {
    const u = new URL(src);
    if (u.protocol !== "https:" && u.protocol !== "http:") return src;
    const proxy = process.env.NEXT_PUBLIC_LOGO_PROXY_URL ?? DEFAULT_LOGO_PROXY;
    const p = new URL(proxy);
    p.searchParams.set("url", `${u.host}${u.pathname}${u.search}`);
    p.searchParams.set("w", String(size));
    p.searchParams.set("h", String(size));
    p.searchParams.set("fit", "contain");
    p.searchParams.set("output", "webp");
    p.searchParams.set("maxage", "31d");
    return p.toString();
  } catch {
    return src;
  }
}
