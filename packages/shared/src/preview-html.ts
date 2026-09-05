export interface HtmlPreviewItem {
  title: string;
  url: string;
  city?: string;
}

function decodeEntities(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;|&#x27;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function absUrl(href: string, baseUrl: string): string {
  try {
    return new URL(href.trim(), baseUrl).href;
  } catch {
    return href.trim();
  }
}

function collectJobPostings(data: unknown, out: Record<string, unknown>[], depth = 0): void {
  if (depth > 8 || data == null) return;
  if (Array.isArray(data)) {
    for (const x of data) collectJobPostings(x, out, depth + 1);
    return;
  }
  if (typeof data !== "object") return;
  const o = data as Record<string, unknown>;
  const type = o["@type"];
  const isJob = type === "JobPosting" || (Array.isArray(type) && type.includes("JobPosting"));
  if (isJob) out.push(o);
  if ("@graph" in o) collectJobPostings(o["@graph"], out, depth + 1);
  if ("itemListElement" in o) collectJobPostings(o["itemListElement"], out, depth + 1);
  if ("item" in o) collectJobPostings(o["item"], out, depth + 1);
}

function cityOf(node: Record<string, unknown>): string | undefined {
  const loc = node.jobLocation;
  const first = Array.isArray(loc) ? loc[0] : loc;
  if (!first || typeof first !== "object") return undefined;
  const address = (first as Record<string, unknown>).address;
  if (!address || typeof address !== "object") return undefined;
  const locality = (address as Record<string, unknown>).addressLocality;
  return typeof locality === "string" ? locality : undefined;
}

function previewJsonLd(html: string, baseUrl: string): HtmlPreviewItem[] {
  const out: HtmlPreviewItem[] = [];
  const re = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    try {
      const nodes: Record<string, unknown>[] = [];
      collectJobPostings(JSON.parse(m[1]!), nodes);
      for (const n of nodes) {
        const title = decodeEntities(String(n.title ?? ""));
        const url = String(n.url ?? n.sameAs ?? baseUrl);
        if (!title) continue;
        out.push({ title, url: absUrl(url, baseUrl), city: cityOf(n) });
      }
    } catch {
      /* JSON-LD invalide */
    }
  }
  return out;
}

function previewRss(xml: string, baseUrl: string): HtmlPreviewItem[] {
  const blocks = xml.match(/<item[\s\S]*?<\/item>|<entry[\s\S]*?<\/entry>/gi) ?? [];
  const out: HtmlPreviewItem[] = [];
  for (const b of blocks) {
    const title = decodeEntities(b.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "");
    const linkTag = b.match(/<link[^>]*href=["']([^"']+)["'][^>]*\/?>/i)?.[1]
      ?? b.match(/<link[^>]*>([\s\S]*?)<\/link>/i)?.[1]
      ?? "";
    const url = decodeEntities(linkTag);
    if (!title || !url) continue;
    out.push({ title, url: absUrl(url, baseUrl) });
  }
  return out;
}

/**
 * Aperçu hors-ligne d'une page carrières : JSON-LD JobPosting, sinon RSS/Atom.
 * Sert l'admin (API locale ou fonction Supabase) sans Cheerio.
 */
export function previewFromHtml(html: string, baseUrl: string): HtmlPreviewItem[] {
  const jsonld = previewJsonLd(html, baseUrl);
  if (jsonld.length) return jsonld.slice(0, 20);
  return previewRss(html, baseUrl).slice(0, 20);
}
